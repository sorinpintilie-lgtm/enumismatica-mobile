import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import type { User as AuthUser } from 'firebase/auth';
import { db } from './firebaseConfig';

// Simple credit & referral support shared between web and mobile.
// Updated to support time-limited signup bonuses, referral bonuses,
// Stripe purchases and various credit-based platform fees.

// Signup promo window
const SIGNUP_PROMO_END_DATE = new Date('2026-03-15T00:00:00Z'); // Until 15 March 2026 (approx. UTC)

// Signup bonuses
const SIGNUP_BONUS_BEFORE_PROMO_END = 200; // 200 credits before 15 March 2026
const SIGNUP_BONUS_AFTER_PROMO_END = 50;   // 50 credits after 15 March 2026

// Signup bonus validity (months)
const SIGNUP_BONUS_MONTHS_BEFORE_PROMO_END = 3; // 3 months validity
const SIGNUP_BONUS_MONTHS_AFTER_PROMO_END = 1;  // 1 month validity

// Referral bonuses
const REFERRAL_NEW_USER_BONUS = 50;  // Extra for the referred new user
const REFERRAL_INVITER_BONUS = 50;   // Bonus per successful referral for inviter

// Generic boost for regular visibility (existing feature)
const BOOST_COST = 5;
const BOOST_DURATION_DAYS = 7;

// Stripe purchases
const CREDIT_PRICE_RON = 1; // 1 RON per credit

// Collection subscription
const COLLECTION_SUBSCRIPTION_COST_PER_YEAR = 50; // 50 credits / year

// Auction creation fees
const AUCTION_BASE_COST = 10; // 10 credits for base duration
const AUCTION_BASE_DURATION_HOURS = 72; // 72 hours
const AUCTION_DISCOUNTED_DURATION_HOURS = 168; // 168 hours (7 days)
const AUCTION_DISCOUNTED_COST = 15; // 15 credits for 7 days (discount)

// Product listing
const PRODUCT_LISTING_COST_PER_30_DAYS = 5; // 5 credits / 30 days

// Strong promotion (homepage / first page highlight)
const PROMOTION_COST = 20; // 20 credits per promotion
const PROMOTION_DEFAULT_DURATION_DAYS = 7; // default 7 days of promotion

interface NormalizedCredits {
  credits: number;
  signupBonusCreditsRemaining: number;
  changed: boolean;
}

/**
 * Normalize user's credits by expiring any remaining signup bonus when needed.
 * This is applied lazily when reading/spending credits.
 */
function normalizeUserCreditsWithSignupExpiry(userData: any, now: Date): NormalizedCredits {
  const rawCredits = typeof userData.credits === 'number' ? userData.credits : 0;

  let expiresAt: Date | null = null;
  const rawExpiresAt = userData.signupBonusExpiresAt;

  if (rawExpiresAt instanceof Timestamp) {
    expiresAt = rawExpiresAt.toDate();
  } else if (rawExpiresAt instanceof Date) {
    expiresAt = rawExpiresAt;
  }

  const remaining = typeof userData.signupBonusCreditsRemaining === 'number'
    ? userData.signupBonusCreditsRemaining
    : 0;

  if (!expiresAt || remaining <= 0) {
    return {
      credits: rawCredits,
      signupBonusCreditsRemaining: remaining,
      changed: false,
    };
  }

  if (now <= expiresAt) {
    return {
      credits: rawCredits,
      signupBonusCreditsRemaining: remaining,
      changed: false,
    };
  }

  // Signup bonus expired – remove any remaining promotional credits.
  const creditsAfterExpiry = Math.max(rawCredits - remaining, 0);

  return {
    credits: creditsAfterExpiry,
    signupBonusCreditsRemaining: 0,
    changed: true,
  };
}

/**
  * Ensure there is a Firestore user profile document after signup and
  * optionally attach referral metadata + apply bonuses.
  */
export async function createUserProfileAfterSignup(
  authUser: AuthUser,
  referralCode?: string | null,
  extraProfileData?: Record<string, any>,
): Promise<void> {
  if (!db || !authUser) return;

  const uid = authUser.uid;
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);

  const baseDisplayName =
    authUser.displayName ||
    (authUser.email ? authUser.email.split('@')[0] : 'Utilizator');

  const now = new Date();
  const isWithinPromoWindow = now < SIGNUP_PROMO_END_DATE;

  const signupBonusAmount = isWithinPromoWindow
    ? SIGNUP_BONUS_BEFORE_PROMO_END
    : SIGNUP_BONUS_AFTER_PROMO_END;

  const signupBonusValidityMonths = isWithinPromoWindow
    ? SIGNUP_BONUS_MONTHS_BEFORE_PROMO_END
    : SIGNUP_BONUS_MONTHS_AFTER_PROMO_END;

  const signupBonusExpiry = new Date(now);
  signupBonusExpiry.setMonth(signupBonusExpiry.getMonth() + signupBonusValidityMonths);

  if (!snap.exists()) {
    const data: any = {
      email: authUser.email || '',
      displayName: baseDisplayName,
      avatar: authUser.photoURL || null,
      role: 'user',
      credits: signupBonusAmount,
      referralCode: uid,
      signupBonusCreditsRemaining: signupBonusAmount,
      signupBonusExpiresAt: Timestamp.fromDate(signupBonusExpiry),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (referralCode && referralCode !== uid) {
      data.referredBy = referralCode;
      data.referralBonusApplied = false;
    }

    if (extraProfileData) {
      Object.assign(data, extraProfileData);
    }

    await Promise.all([
      setDoc(userRef, data),
      addDoc(collection(db, 'users', uid, 'creditTransactions'), {
        userId: uid,
        type: 'signup_bonus',
        amount: signupBonusAmount,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(signupBonusExpiry),
      }),
    ]);
  } else {
    const existing = snap.data() as any;

    if (referralCode && referralCode !== uid && !existing.referredBy) {
      await updateDoc(userRef, {
        referredBy: referralCode,
        updatedAt: serverTimestamp(),
      });
    }

    if (extraProfileData) {
      await updateDoc(userRef, {
        ...extraProfileData,
        updatedAt: serverTimestamp(),
      });
    }
  }

  // Referral bonuses (extra 50 credits to new user + 50 to inviter)
  // are now applied by a Cloud Function on user document creation,
  // using the `referredBy` and `referralBonusApplied` fields.
  // We deliberately avoid cross-user writes from the client here
  // to respect Firestore security rules.
}

async function applyReferralBonus(newUserId: string, inviterId: string): Promise<void> {
  if (!db) return;

  const newUserRef = doc(db, 'users', newUserId);
  const inviterRef = doc(db, 'users', inviterId);

  const [newUserSnap, inviterSnap] = await Promise.all([
    getDoc(newUserRef),
    getDoc(inviterRef),
  ]);

  if (!newUserSnap.exists() || !inviterSnap.exists()) return;

  const newUserData = newUserSnap.data() as any;
  if (newUserData.referralBonusApplied) {
    return;
  }

  const inviterData = inviterSnap.data() as any;

  const newUserCurrentCredits = (newUserData.credits || 0) as number;
  const inviterCurrentCredits = (inviterData.credits || 0) as number;

  const newUserCredits = newUserCurrentCredits + REFERRAL_NEW_USER_BONUS;
  const inviterCredits = inviterCurrentCredits + REFERRAL_INVITER_BONUS;

  const currentSignupRemaining =
    typeof newUserData.signupBonusCreditsRemaining === 'number'
      ? newUserData.signupBonusCreditsRemaining
      : 0;

  const newSignupRemaining = currentSignupRemaining + REFERRAL_NEW_USER_BONUS;

  await Promise.all([
    updateDoc(newUserRef, {
      credits: newUserCredits,
      signupBonusCreditsRemaining: newSignupRemaining,
      referralBonusApplied: true,
      updatedAt: serverTimestamp(),
    }),
    updateDoc(inviterRef, {
      credits: inviterCredits,
      updatedAt: serverTimestamp(),
    }),
    addDoc(collection(db, 'users', newUserId, 'creditTransactions'), {
      userId: newUserId,
      type: 'referral_new_user_bonus',
      amount: REFERRAL_NEW_USER_BONUS,
      relatedUserId: inviterId,
      // Use the same expiry as the signup bonus if present
      expiresAt: newUserData.signupBonusExpiresAt || null,
      createdAt: serverTimestamp(),
    }),
    addDoc(collection(db, 'users', inviterId, 'creditTransactions'), {
      userId: inviterId,
      type: 'referral_inviter_bonus',
      amount: REFERRAL_INVITER_BONUS,
      relatedUserId: newUserId,
      createdAt: serverTimestamp(),
    }),
  ]);
}

/**
 * Spend credits to boost a product's visibility for a limited time.
 */
export async function boostProductWithCredits(
  userId: string,
  productId: string,
  cost: number = BOOST_COST,
  durationDays: number = BOOST_DURATION_DAYS,
): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  const userRef = doc(db, 'users', userId);
  const productRef = doc(db, 'products', productId);

  await runTransaction(db, async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) {
      throw new Error('Profilul utilizatorului nu există');
    }
    const userData = userSnap.data() as any;

    const now = new Date();
    const normalized = normalizeUserCreditsWithSignupExpiry(userData, now);

    if (normalized.credits < cost) {
      throw new Error('Nu ai suficiente credite pentru a aplica boost-ul');
    }

    const productSnap = await tx.get(productRef);
    if (!productSnap.exists()) {
      throw new Error('Produsul nu există');
    }
    const productData = productSnap.data() as any;
    if (productData.ownerId !== userId) {
      throw new Error('Poți boosta doar produsele tale');
    }

    // Compute boost expiry. If there's an active boost, extend it (stack duration).
    const rawBoostExpiry = productData.boostExpiresAt;
    let currentBoostExpiry: Date | null = null;
    if (rawBoostExpiry instanceof Timestamp) {
      currentBoostExpiry = rawBoostExpiry.toDate();
    } else if (rawBoostExpiry instanceof Date) {
      currentBoostExpiry = rawBoostExpiry;
    }

    const baseDate = currentBoostExpiry && currentBoostExpiry > now ? currentBoostExpiry : now;
    const boostUntil = new Date(baseDate);
    boostUntil.setDate(boostUntil.getDate() + durationDays);

    const newCredits = normalized.credits - cost;

    // Spend from promotional signup credits first, if still available
    let newSignupRemaining = normalized.signupBonusCreditsRemaining;
    if (newSignupRemaining > 0) {
      const promoUsed = Math.min(newSignupRemaining, cost);
      newSignupRemaining -= promoUsed;
    }

    const userUpdates: any = {
      credits: newCredits,
      updatedAt: serverTimestamp(),
    };

    if (
      normalized.changed ||
      newSignupRemaining !== normalized.signupBonusCreditsRemaining
    ) {
      userUpdates.signupBonusCreditsRemaining = newSignupRemaining;
    }

    tx.update(userRef, userUpdates);

    tx.update(productRef, {
      boostedAt: serverTimestamp(),
      boostExpiresAt: Timestamp.fromDate(boostUntil),
      updatedAt: serverTimestamp(),
    });
  });

  await addDoc(collection(db, 'users', userId, 'creditTransactions'), {
    userId,
    type: 'spend_boost',
    amount: -cost,
    productId,
    createdAt: serverTimestamp(),
  });
}

/**
 * Convenience helper to fetch current credit balance once.
 * Applies lazy signup bonus expiry, so the returned balance always
 * reflects only non-expired credits.
 */
export async function getUserCredits(userId: string): Promise<number> {
  if (!db) return 0;
  const ref = doc(db, 'users', userId);

  const credits = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return 0;

    const data = snap.data() as any;
    const now = new Date();
    const normalized = normalizeUserCreditsWithSignupExpiry(data, now);

    if (normalized.changed) {
      const updates: any = {
        credits: normalized.credits,
        signupBonusCreditsRemaining: normalized.signupBonusCreditsRemaining,
        updatedAt: serverTimestamp(),
      };
      tx.update(ref, updates);
    }

    return normalized.credits;
  });

  return credits;
}

/**
 * Calculate how many credits a Stripe payment in RON should generate.
 */
export function calculateCreditsFromRON(ronAmount: number): number {
  if (!ronAmount || ronAmount <= 0) return 0;
  return Math.floor(ronAmount / CREDIT_PRICE_RON);
}

/**
 * Apply a successful Stripe payment and credit the user's balance.
 * This should be called only after Stripe confirms the payment.
 */
export async function applyCreditsPurchaseFromStripe(
  userId: string,
  ronAmount: number,
  paymentReference: string,
): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  const creditsToAdd = calculateCreditsFromRON(ronAmount);
  if (creditsToAdd <= 0) {
    // Nothing to credit (e.g. very small amount)
    return;
  }

  const userRef = doc(db, 'users', userId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) {
      throw new Error('Profilul utilizatorului nu există');
    }
    const data = snap.data() as any;
    const currentCredits = typeof data.credits === 'number' ? data.credits : 0;
    const newCredits = currentCredits + creditsToAdd;

    tx.update(userRef, {
      credits: newCredits,
      updatedAt: serverTimestamp(),
    });
  });

  await addDoc(collection(db, 'users', userId, 'creditTransactions'), {
    userId,
    type: 'purchase_stripe',
    provider: 'stripe',
    paymentReference,
    ronAmount,
    amount: creditsToAdd,
    createdAt: serverTimestamp(),
  });
}

/**
 * Pay collection subscription with credits.
 * 50 credits per year; extends existing subscription if still active.
 */
export async function payCollectionSubscriptionWithCredits(
  userId: string,
  years: number = 1,
): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');
  if (years <= 0) throw new Error('Numărul de ani trebuie să fie pozitiv');

  const userRef = doc(db, 'users', userId);
  const totalCost = COLLECTION_SUBSCRIPTION_COST_PER_YEAR * years;

  let newExpiresAt: Date | null = null;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) {
      throw new Error('Profilul utilizatorului nu există');
    }

    const data = snap.data() as any;
    const now = new Date();
    const normalized = normalizeUserCreditsWithSignupExpiry(data, now);

    if (normalized.credits < totalCost) {
      throw new Error('Nu ai suficiente credite pentru a activa / prelungi abonamentul colecției.');
    }

    const currentExpiryRaw = data.collectionSubscriptionExpiresAt;
    let currentExpiry: Date | null = null;
    if (currentExpiryRaw instanceof Timestamp) {
      currentExpiry = currentExpiryRaw.toDate();
    } else if (currentExpiryRaw instanceof Date) {
      currentExpiry = currentExpiryRaw;
    }

    const baseDate = currentExpiry && currentExpiry > now ? currentExpiry : now;
    newExpiresAt = new Date(baseDate);
    newExpiresAt.setFullYear(newExpiresAt.getFullYear() + years);

    const newCredits = normalized.credits - totalCost;

    // Spend from promotional signup credits first
    let newSignupRemaining = normalized.signupBonusCreditsRemaining;
    if (newSignupRemaining > 0) {
      const promoUsed = Math.min(newSignupRemaining, totalCost);
      newSignupRemaining -= promoUsed;
    }

    const updates: any = {
      credits: newCredits,
      collectionSubscriptionExpiresAt: Timestamp.fromDate(newExpiresAt),
      updatedAt: serverTimestamp(),
    };

    if (
      normalized.changed ||
      newSignupRemaining !== normalized.signupBonusCreditsRemaining
    ) {
      updates.signupBonusCreditsRemaining = newSignupRemaining;
    }

    tx.update(userRef, updates);
  });

  await addDoc(collection(db, 'users', userId, 'creditTransactions'), {
    userId,
    type: 'collection_subscription',
    amount: -totalCost,
    years,
    newExpiresAt: newExpiresAt ? Timestamp.fromDate(newExpiresAt) : null,
    createdAt: serverTimestamp(),
  });
}

/**
 * Calculate auction creation cost based on duration.
 *
 * - Up to 72h  (3 days)    - 10 credits
 * - Up to 168h (7 days)    - 15 credits (discount)
 * - After 168h: each extra 72h block costs +5 credits
 */
export function calculateAuctionCreationCost(durationHours: number): number {
  if (durationHours <= AUCTION_BASE_DURATION_HOURS) {
    return AUCTION_BASE_COST;
  }
  if (durationHours <= AUCTION_DISCOUNTED_DURATION_HOURS) {
    return AUCTION_DISCOUNTED_COST;
  }

  const extraHours = durationHours - AUCTION_DISCOUNTED_DURATION_HOURS;
  const extraBlocks = Math.ceil(extraHours / AUCTION_BASE_DURATION_HOURS);
  const extraCostPerBlock = AUCTION_BASE_COST / 2; // 5 credits per 72h block after discount threshold

  return AUCTION_DISCOUNTED_COST + extraBlocks * extraCostPerBlock;
}

/**
 * Charge credits when a user starts an auction.
 * The auction itself still needs admin approval via existing workflow.
 */
export async function chargeAuctionCreationWithCredits(
  userId: string,
  auctionId: string,
  durationHours: number,
): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');
  if (!durationHours || durationHours <= 0) {
    throw new Error('Durata licitației trebuie să fie mai mare decât 0.');
  }

  const userRef = doc(db, 'users', userId);
  const auctionRef = doc(db, 'auctions', auctionId);
  const cost = calculateAuctionCreationCost(durationHours);

  await runTransaction(db, async (tx) => {
    const [userSnap, auctionSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(auctionRef),
    ]);

    if (!userSnap.exists()) {
      throw new Error('Profilul utilizatorului nu există');
    }
    if (!auctionSnap.exists()) {
      throw new Error('Licitația nu există');
    }

    const userData = userSnap.data() as any;
    const auctionData = auctionSnap.data() as any;

    // Optional ownership check if ownerId is present on auction
    if (auctionData.ownerId && auctionData.ownerId !== userId) {
      throw new Error('Poți plăti taxa doar pentru licitațiile tale.');
    }

    const now = new Date();
    const normalized = normalizeUserCreditsWithSignupExpiry(userData, now);

    if (normalized.credits < cost) {
      throw new Error('Nu ai suficiente credite pentru a crea această licitație.');
    }

    const newCredits = normalized.credits - cost;

    // Spend from promotional signup credits first
    let newSignupRemaining = normalized.signupBonusCreditsRemaining;
    if (newSignupRemaining > 0) {
      const promoUsed = Math.min(newSignupRemaining, cost);
      newSignupRemaining -= promoUsed;
    }

    const userUpdates: any = {
      credits: newCredits,
      updatedAt: serverTimestamp(),
    };

    if (
      normalized.changed ||
      newSignupRemaining !== normalized.signupBonusCreditsRemaining
    ) {
      userUpdates.signupBonusCreditsRemaining = newSignupRemaining;
    }

    const auctionUpdates: any = {
      creditFeeAmount: cost,
      paidDurationHours: durationHours,
      updatedAt: serverTimestamp(),
    };

    tx.update(userRef, userUpdates);
    tx.update(auctionRef, auctionUpdates);
  });

  await addDoc(collection(db, 'users', userId, 'creditTransactions'), {
    userId,
    type: 'auction_creation_fee',
    auctionId,
    durationHours,
    amount: -cost,
    createdAt: serverTimestamp(),
  });
}

/**
 * Calculate product listing cost based on desired listing duration.
 * 5 credits per 30 days (rounded up).
 */
export function calculateProductListingCost(listingDays: number): number {
  if (!listingDays || listingDays <= 0) return PRODUCT_LISTING_COST_PER_30_DAYS;
  const periods = Math.ceil(listingDays / 30);
  return periods * PRODUCT_LISTING_COST_PER_30_DAYS;
}

/**
 * Charge credits to list a product in the shop for a given duration.
 * Extends existing listing if still active.
 */
export async function chargeProductListingWithCredits(
  userId: string,
  productId: string,
  listingDays: number = 30,
): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  const userRef = doc(db, 'users', userId);
  const productRef = doc(db, 'products', productId);
  const cost = calculateProductListingCost(listingDays);

  await runTransaction(db, async (tx) => {
    const [userSnap, productSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(productRef),
    ]);

    if (!userSnap.exists()) {
      throw new Error('Profilul utilizatorului nu există');
    }
    if (!productSnap.exists()) {
      throw new Error('Produsul nu există');
    }

    const userData = userSnap.data() as any;
    const productData = productSnap.data() as any;

    if (productData.ownerId && productData.ownerId !== userId) {
      throw new Error('Poți plăti listarea doar pentru produsele tale.');
    }

    const now = new Date();
    const normalized = normalizeUserCreditsWithSignupExpiry(userData, now);

    if (normalized.credits < cost) {
      throw new Error('Nu ai suficiente credite pentru a lista acest produs în magazin.');
    }

    const newCredits = normalized.credits - cost;

    // Spend from promotional signup credits first
    let newSignupRemaining = normalized.signupBonusCreditsRemaining;
    if (newSignupRemaining > 0) {
      const promoUsed = Math.min(newSignupRemaining, cost);
      newSignupRemaining -= promoUsed;
    }

    // Compute new listing expiry
    const rawListingExpiry = productData.listingExpiresAt;
    let currentExpiry: Date | null = null;
    if (rawListingExpiry instanceof Timestamp) {
      currentExpiry = rawListingExpiry.toDate();
    } else if (rawListingExpiry instanceof Date) {
      currentExpiry = rawListingExpiry;
    }

    const baseDate = currentExpiry && currentExpiry > now ? currentExpiry : now;
    const newListingExpiry = new Date(baseDate);
    newListingExpiry.setDate(newListingExpiry.getDate() + listingDays);

    const userUpdates: any = {
      credits: newCredits,
      updatedAt: serverTimestamp(),
    };

    if (
      normalized.changed ||
      newSignupRemaining !== normalized.signupBonusCreditsRemaining
    ) {
      userUpdates.signupBonusCreditsRemaining = newSignupRemaining;
    }

    const productUpdates: any = {
      listingExpiresAt: Timestamp.fromDate(newListingExpiry),
      updatedAt: serverTimestamp(),
    };

    tx.update(userRef, userUpdates);
    tx.update(productRef, productUpdates);
  });

  await addDoc(collection(db, 'users', userId, 'creditTransactions'), {
    userId,
    type: 'product_listing_fee',
    productId,
    listingDays,
    amount: -cost,
    createdAt: serverTimestamp(),
  });
}

/**
 * Relist an unsold direct product for another paid listing window.
 */
export async function relistProductWithCredits(
  userId: string,
  productId: string,
  listingDays: number = 30,
): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  const productRef = doc(db, 'products', productId);
  const snap = await getDoc(productRef);
  if (!snap.exists()) {
    throw new Error('Produsul nu există');
  }

  const product = snap.data() as any;
  if (product.ownerId !== userId) {
    throw new Error('Poți relista doar produsele tale.');
  }
  if (product.listingType !== 'direct') {
    throw new Error('Doar produsele cu vânzare directă pot fi relistate aici.');
  }
  if (product.isSold === true) {
    throw new Error('Produsul este vândut și nu poate fi relistat.');
  }
  if (product.status !== 'approved') {
    throw new Error('Produsul nu este aprobat pentru listare în magazin.');
  }

  await chargeProductListingWithCredits(userId, productId, listingDays);
}

export interface PromoteWithCreditsOptions {
  userId: string;
  productId?: string;
  auctionId?: string;
  durationDays?: number;
}

/**
 * Promote a product or auction (homepage / first page highlight).
 * Costs 20 credits and marks the item as promoted for a period.
 */
export async function promoteItemWithCredits(options: PromoteWithCreditsOptions): Promise<void> {
  const { userId, productId, auctionId, durationDays = PROMOTION_DEFAULT_DURATION_DAYS } = options;

  if (!db) throw new Error('Firestore not initialized');

  if ((productId && auctionId) || (!productId && !auctionId)) {
    throw new Error('Trebuie să specifici exact un produs sau o licitație pentru promovare.');
  }

  const targetType = productId ? 'product' : 'auction';
  const targetId = productId || auctionId!;

  const userRef = doc(db, 'users', userId);
  const targetRef =
    targetType === 'product'
      ? doc(db, 'products', targetId)
      : doc(db, 'auctions', targetId);

  const cost = PROMOTION_COST;

  await runTransaction(db, async (tx) => {
    const [userSnap, targetSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(targetRef),
    ]);

    if (!userSnap.exists()) {
      throw new Error('Profilul utilizatorului nu există');
    }
    if (!targetSnap.exists()) {
      throw new Error(targetType === 'product' ? 'Produsul nu există' : 'Licitația nu există');
    }

    const userData = userSnap.data() as any;
    const targetData = targetSnap.data() as any;

    // Ownership checks if ownerId present
    if (targetType === 'product') {
      if (targetData.ownerId && targetData.ownerId !== userId) {
        throw new Error('Poți promova doar produsele tale.');
      }
    } else {
      if (targetData.ownerId && targetData.ownerId !== userId) {
        throw new Error('Poți promova doar licitațiile tale.');
      }
    }

    const now = new Date();
    const normalized = normalizeUserCreditsWithSignupExpiry(userData, now);

    if (normalized.credits < cost) {
      throw new Error('Nu ai suficiente credite pentru a promova acest element.');
    }

    const newCredits = normalized.credits - cost;

    // Spend from promotional signup credits first
    let newSignupRemaining = normalized.signupBonusCreditsRemaining;
    if (newSignupRemaining > 0) {
      const promoUsed = Math.min(newSignupRemaining, cost);
      newSignupRemaining -= promoUsed;
    }

    // Compute new promotion expiry (stacking if already active)
    const rawPromoExpiry = targetData.promotionExpiresAt;
    let currentPromoExpiry: Date | null = null;
    if (rawPromoExpiry instanceof Timestamp) {
      currentPromoExpiry = rawPromoExpiry.toDate();
    } else if (rawPromoExpiry instanceof Date) {
      currentPromoExpiry = rawPromoExpiry;
    }

    const baseDate = currentPromoExpiry && currentPromoExpiry > now ? currentPromoExpiry : now;
    const newPromoExpiry = new Date(baseDate);
    newPromoExpiry.setDate(newPromoExpiry.getDate() + durationDays);

    const userUpdates: any = {
      credits: newCredits,
      updatedAt: serverTimestamp(),
    };

    if (
      normalized.changed ||
      newSignupRemaining !== normalized.signupBonusCreditsRemaining
    ) {
      userUpdates.signupBonusCreditsRemaining = newSignupRemaining;
    }

    const targetUpdates: any = {
      isPromoted: true,
      promotedAt: serverTimestamp(),
      promotionExpiresAt: Timestamp.fromDate(newPromoExpiry),
      updatedAt: serverTimestamp(),
    };

    tx.update(userRef, userUpdates);
    tx.update(targetRef, targetUpdates);
  });

  const txData: any = {
    userId,
    type: targetType === 'product' ? 'promotion_product' : 'promotion_auction',
    amount: -cost,
    durationDays,
    createdAt: serverTimestamp(),
  };

  if (targetType === 'product') {
    txData.productId = targetId;
  } else {
    txData.auctionId = targetId;
  }

  await addDoc(collection(db, 'users', userId, 'creditTransactions'), txData);
}
