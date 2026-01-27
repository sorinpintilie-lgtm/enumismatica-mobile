import { collection, addDoc, Timestamp, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { User, Product, Auction, Bid } from './types';
import { uploadLocalImage } from './storageService';

/**
 * Super Admin UID - protected from deletion
 */
const SUPER_ADMIN_UID = 'QEm0DSIzylNQIHpQAZlgtWQkYYE3';

/**
 * Enhanced sample data seeding functions for development and testing.
 */

// Expanded sample users (10 users)
const sampleUsers: Omit<User, 'id'>[] = [
  {
    email: 'alice.collector@example.com',
    name: 'Alice Collector',
    displayName: 'Alice Collector',
    avatar: 'https://i.pravatar.cc/150?img=1',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    email: 'bob.numismatist@example.com',
    name: 'Bob Numismatist',
    displayName: 'Bob Numismatist',
    avatar: 'https://i.pravatar.cc/150?img=2',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    email: 'charlie.dealer@example.com',
    name: 'Charlie Dealer',
    displayName: 'Charlie Dealer',
    avatar: 'https://i.pravatar.cc/150?img=3',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    email: 'diana.expert@example.com',
    name: 'Diana Expert',
    displayName: 'Diana Expert',
    avatar: 'https://i.pravatar.cc/150?img=4',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    email: 'edward.trader@example.com',
    name: 'Edward Trader',
    displayName: 'Edward Trader',
    avatar: 'https://i.pravatar.cc/150?img=5',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    email: 'fiona.buyer@example.com',
    name: 'Fiona Buyer',
    displayName: 'Fiona Buyer',
    avatar: 'https://i.pravatar.cc/150?img=6',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    email: 'george.seller@example.com',
    name: 'George Seller',
    displayName: 'George Seller',
    avatar: 'https://i.pravatar.cc/150?img=7',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    email: 'hannah.investor@example.com',
    name: 'Hannah Investor',
    displayName: 'Hannah Investor',
    avatar: 'https://i.pravatar.cc/150?img=8',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    email: 'ivan.enthusiast@example.com',
    name: 'Ivan Enthusiast',
    displayName: 'Ivan Enthusiast',
    avatar: 'https://i.pravatar.cc/150?img=9',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    email: 'julia.curator@example.com',
    name: 'Julia Curator',
    displayName: 'Julia Curator',
    avatar: 'https://i.pravatar.cc/150?img=10',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Expanded sample products (25 products with mixed statuses)
const generateProducts = (): Omit<Product, 'id'>[] => {
  // Real coin images from monede folder
  const coinImages = [
    '3burY-0-small.jpg', '4mTCT-0-small.jpg', '49H3s-0-small.jpg', 'CtBLn-0-small.jpg',
    'DYTJR-0-small.jpg', 'eeoyM-0-small.jpg', 'Eyoqt-0-small.jpg', 'FCNnG-0-small.jpg',
    'FRMiG-0-small.jpg', 'g52NM-0-small.jpg', 'Hdizv-0-medium.jpg', 'HnVr4-0-small.jpg',
    'J2ZHF-0-small.jpg', 'jn9SK-0-small.jpg', 'JNJXT-0-small.jpg', 'JthsJ-0-small.jpg',
    'kiQ7E-0-small.jpg', 'MFpz2-0-small.jpg', 'oCrPZ-0-small.jpg', 'om2wt-0-small.jpg',
    'PXCh6-0-small.jpg', 'pYUs9-0-small.jpg', 'QUDtY-0-small.jpg', 'TmxTF-0-small.jpg',
    'UfTK2-0-small.jpg', 'V4ryX-0-small.jpg', 'VV8yA-0-small.jpg'
  ];

  const coinNames = [
    'Roman Denarius', 'Greek Tetradrachm', 'Byzantine Solidus', 'Persian Daric', 'Carthaginian Shekel',
    'Celtic Stater', 'Egyptian Drachma', 'Phoenician Half-Shekel', 'Lydian Electrum', 'Athenian Owl',
    'Roman Aureus', 'Macedonian Tetradrachm', 'Seleucid Tetradrachm', 'Ptolemaic Octadrachm', 'Roman Sestertius',
    'Greek Drachma', 'Roman Quinarius', 'Byzantine Follis', 'Persian Siglos', 'Punic Shekel',
    'Gallic Stater', 'Iberian Denarius', 'Thracian Tetradrachm', 'Bactrian Tetradrachm', 'Parthian Drachm'
  ];

  const descriptions = [
    'Excellent condition with clear details',
    'Well-preserved ancient coin',
    'Rare specimen from private collection',
    'Museum-quality piece',
    'Historical significance with provenance',
    'Beautiful patina and detail',
    'Certified authentic by expert',
    'From renowned collection',
    'Exceptional strike quality',
    'Investment-grade numismatic item'
  ];

  const countries = ['Roma', 'Grecia', 'Bizanț', 'Persia', 'Cartagina', 'Egipt', 'Fenicia', 'Lidia', 'Atena', 'Macedonia'];
  const metals = ['Aur', 'Argint', 'Bronz', 'Cupru', 'Electrum'];
  const rarities: ('common' | 'uncommon' | 'rare' | 'very-rare' | 'extremely-rare')[] = ['common', 'uncommon', 'rare', 'very-rare', 'extremely-rare'];
  const grades = ['G', 'VG', 'F', 'VF', 'XF', 'AU', 'MS'];
  const denominations = ['Denarius', 'Tetradrachm', 'Solidus', 'Daric', 'Shekel', 'Stater', 'Drachma', 'Aureus', 'Sestertius', 'Quinarius', 'Follis', 'Siglos'];

  // 15 approved, 7 pending, 3 rejected
  const statuses: ('approved' | 'pending' | 'rejected')[] = [
    'approved', 'approved', 'approved', 'approved', 'approved',
    'approved', 'approved', 'approved', 'approved', 'approved',
    'approved', 'approved', 'approved', 'approved', 'approved',
    'pending', 'pending', 'pending', 'pending', 'pending', 'pending', 'pending',
    'rejected', 'rejected', 'rejected'
  ];

  return coinNames.map((name, i) => ({
    name,
    description: descriptions[i % descriptions.length] + `. ${name} from ancient times.`,
    images: [], // Will be populated during seeding with Firebase Storage URLs
    price: Math.floor(Math.random() * 1500) + 200,
    country: countries[i % countries.length],
    year: 100 + Math.floor(Math.random() * 400), // Years between 100-500 AD
    metal: metals[i % metals.length],
    rarity: rarities[i % rarities.length],
    grade: grades[i % grades.length],
    denomination: denominations[i % denominations.length],
    weight: parseFloat((Math.random() * 10 + 2).toFixed(2)),
    diameter: parseFloat((Math.random() * 10 + 15).toFixed(1)),
    ownerId: '',
    status: statuses[i],
    createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(),
  }));
};

// Expanded sample auctions (20 auctions with mixed statuses)
const generateAuctions = (): Omit<Auction, 'id'>[] => {
  // 8 active, 6 pending, 4 ended, 2 rejected
  const statuses: ('pending' | 'active' | 'ended' | 'rejected')[] = [
    'active', 'active', 'active', 'active', 'active', 'active', 'active', 'active',
    'pending', 'pending', 'pending', 'pending', 'pending', 'pending',
    'ended', 'ended', 'ended', 'ended',
    'rejected', 'rejected'
  ];

  return Array.from({ length: 20 }, (_, i) => {
    const daysOffset = Math.floor(Math.random() * 14) + 1;
    const status = statuses[i];
    const startTime =
      status === 'ended'
        ? new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
        : new Date();
    const endTime =
      status === 'ended'
        ? new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + daysOffset * 24 * 60 * 60 * 1000);

    const reservePrice = Math.floor(Math.random() * 400) + 200; // 200-600 RON
    const currentBid =
      status === 'active' || status === 'ended'
        ? reservePrice + Math.floor(Math.random() * 100)
        : undefined; // Current bids 200-700 RON

    // Configure "Cumpără acum" for a subset of ACTIVE auctions so UI can show the button.
    // We keep it a bit above reserve/current bid to look realistic.
    const hasBuyNow = status === 'active' && Math.random() < 0.6; // ~60% of active auctions
    const buyNowPrice = hasBuyNow
      ? reservePrice + Math.floor(Math.random() * 300) + 150 // reserve + 150–450 RON
      : undefined;

    return {
      productId: '',
      startTime,
      endTime,
      reservePrice,
      currentBid,
      currentBidderId: currentBid ? '' : undefined,
      status,
      buyNowPrice,
      buyNowUsed: false,
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
    };
  });
};

/**
 * Seeds sample users into the 'users' collection.
 */
export async function seedUsers(): Promise<string[]> {
  const userIds: string[] = [];
  for (const userData of sampleUsers) {
    const docRef = await addDoc(collection(db, 'users'), {
      ...userData,
      seeded: true,
      createdAt: Timestamp.fromDate(userData.createdAt),
      updatedAt: Timestamp.fromDate(userData.updatedAt || new Date()),
    });
    userIds.push(docRef.id);
  }
  return userIds;
}

/**
 * Seeds sample products into the 'products' collection.
 */
export async function seedProducts(userIds: string[]): Promise<string[]> {
  const products = generateProducts();
  const productIds: string[] = [];
  
  // Coin images from monede folder
  const coinImages = [
    '3burY-0-small.jpg', '4mTCT-0-small.jpg', '49H3s-0-small.jpg', 'CtBLn-0-small.jpg',
    'DYTJR-0-small.jpg', 'eeoyM-0-small.jpg', 'Eyoqt-0-small.jpg', 'FCNnG-0-small.jpg',
    'FRMiG-0-small.jpg', 'g52NM-0-small.jpg', 'Hdizv-0-medium.jpg', 'HnVr4-0-small.jpg',
    'J2ZHF-0-small.jpg', 'jn9SK-0-small.jpg', 'JNJXT-0-small.jpg', 'JthsJ-0-small.jpg',
    'kiQ7E-0-small.jpg', 'MFpz2-0-small.jpg', 'oCrPZ-0-small.jpg', 'om2wt-0-small.jpg',
    'PXCh6-0-small.jpg', 'pYUs9-0-small.jpg', 'QUDtY-0-small.jpg', 'TmxTF-0-small.jpg',
    'UfTK2-0-small.jpg', 'V4ryX-0-small.jpg', 'VV8yA-0-small.jpg'
  ];
  
  // Existing seed images in Firebase Storage for coins (already uploaded)
  const storageCoinFiles = [
    '1763979112991_0_1.jpg',
    '1763979114876_0_2.jpg',
    '1763979116387_1_1.jpg',
    '1763979117146_1_2.jpg',
    '1763979119136_2_1.jpg',
    '1763979119811_2_2.jpg',
    '1763979121148_3_1.jpg',
    '1763979121786_3_2.jpg',
    '1763979124135_4_1.jpg',
    '1763979124710_4_2.jpg',
    '1763979126146_5_1.jpg',
    '1763979126580_5_2.jpg',
    '1763979127180_6_1.jpg',
    '1763979127653_6_2.jpg',
    '1763979128286_7_1.jpg',
    '1763979128718_7_2.jpg',
    '1763979129351_8_1.jpg',
    '1763979129777_8_2.jpg',
    '1763979130466_9_1.jpg',
    '1763979130842_9_2.jpg',
    '1763979134287_10_1.jpg',
    '1763979139776_10_2.jpg',
    '1763979140442_11_1.jpg',
    '1763979140795_11_2.jpg',
    '1763979141392_12_1.jpg',
    '1763979141757_12_2.jpg',
    '1763979142320_13_1.jpg',
    '1763979142706_13_2.jpg',
    '1763979143297_14_1.jpg',
    '1763979143654_14_2.jpg',
    '1763979144196_15_1.jpg',
    '1763979144564_15_2.jpg',
    '1763979145186_16_1.jpg',
    '1763979145532_16_2.jpg',
    '1763979146135_17_1.jpg',
    '1763979146506_17_2.jpg',
    '1763979147068_18_1.jpg',
    '1763979147432_18_2.jpg',
    '1763979147994_19_1.jpg',
    '1763979148359_19_2.jpg',
    '1763979148912_20_1.jpg',
    '1763979149286_20_2.jpg',
    '1763979149893_21_1.jpg',
    '1763979150240_21_2.jpg',
    '1763979150761_22_1.jpg',
    '1763979151176_22_2.jpg',
    '1763979151802_23_1.jpg',
    '1763979152256_23_2.jpg',
    '1763979152809_24_1.jpg',
    '1763979153172_24_2.jpg',
  ];

  const buildStorageUrl = (fileName: string) =>
    `https://firebasestorage.googleapis.com/v0/b/e-numismatica-ro.firebasestorage.app/o/products%2Fseed%2F${encodeURIComponent(
      fileName,
    )}?alt=media`;

  for (let i = 0; i < products.length; i++) {
    console.log(`Assigning storage images for product ${i + 1}/${products.length}...`);

    // Use pre-seeded Storage images instead of uploading from /monede
    const baseIndex = (2 * i) % storageCoinFiles.length;
    const imageUrls: string[] = [
      buildStorageUrl(storageCoinFiles[baseIndex]),
      buildStorageUrl(storageCoinFiles[(baseIndex + 1) % storageCoinFiles.length]),
    ];

    const productData = {
      ...products[i],
      ownerId: userIds[i % userIds.length],
      images: imageUrls,
    };

    const docRef = await addDoc(collection(db, 'products'), {
      ...productData,
      seeded: true,
      createdAt: Timestamp.fromDate(productData.createdAt),
      updatedAt: Timestamp.fromDate(productData.updatedAt),
    });
    productIds.push(docRef.id);

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return productIds;
}

/**
 * Seeds sample auctions into the 'auctions' collection.
 */
export async function seedAuctions(productIds: string[], userIds: string[]): Promise<string[]> {
  const auctions = generateAuctions();
  const auctionIds: string[] = [];
  
  for (let i = 0; i < auctions.length; i++) {
    const auction = auctions[i];
    
    // For active auctions, we'll set currentBid after creating bids
    // For now, just create the auction without currentBid; bids seeding will update it.
    const auctionData: any = {
      productId: productIds[i % productIds.length],
      startTime: Timestamp.fromDate(auction.startTime),
      endTime: Timestamp.fromDate(auction.endTime),
      reservePrice: auction.reservePrice,
      status: auction.status,
      // Only add buyNowPrice when it is actually defined; Firestore does not accept undefined.
      buyNowUsed: false,
      createdAt: Timestamp.fromDate(auction.createdAt),
      updatedAt: Timestamp.fromDate(auction.updatedAt),
    };

    if (typeof auction.buyNowPrice === 'number' && auction.buyNowPrice > 0) {
      auctionData.buyNowPrice = auction.buyNowPrice;
    }
    
    const docRef = await addDoc(collection(db, 'auctions'), {
      ...auctionData,
      seeded: true,
    });
    auctionIds.push(docRef.id);
  }
  return auctionIds;
}

/**
 * Seeds sample bids into auctions.
 */
export async function seedBids(auctionIds: string[], userIds: string[]): Promise<void> {
  // Create 2-5 bids per active auction (first 8 are active)
  for (const auctionId of auctionIds.slice(0, 8)) {
    const numBids = Math.floor(Math.random() * 4) + 2;
    let highestBid = 0;
    let highestBidderId = '';
    
    for (let i = 0; i < numBids; i++) {
      const amount = 250 + (i * 30) + Math.floor(Math.random() * 40); // Start bids at 250-290, increment by 30-70
      const timestamp = new Date(Date.now() - (numBids - i) * 60 * 60 * 1000);
      const bidderId = userIds[i % userIds.length];
      
      const bidData = {
        auctionId,
        userId: bidderId,
        amount,
        timestamp,
      };
      
      // Track highest bid
      if (amount > highestBid) {
        highestBid = amount;
        highestBidderId = bidderId;
      }
      
      // Add bid
      await addDoc(collection(db, 'auctions', auctionId, 'bids'), {
        ...bidData,
        timestamp: Timestamp.fromDate(bidData.timestamp),
      });
      
      // Add corresponding price history entry
      await addDoc(collection(db, 'auctions', auctionId, 'priceHistory'), {
        price: amount,
        source: 'auction_bid',
        note: `Licitare de ${bidderId.slice(-6)}`,
        timestamp: Timestamp.fromDate(timestamp),
      });
    }
    
    // Update auction with highest bid
    const auctionRef = doc(db, 'auctions', auctionId);
    await updateDoc(auctionRef, {
      currentBid: highestBid,
      currentBidderId: highestBidderId,
      updatedAt: Timestamp.fromDate(new Date()),
    });
  }
}

/**
 * Seeds price history for products and auctions
 */
async function seedPriceHistories(productIds: string[], auctionIds: string[]): Promise<void> {
  console.log('Starting price history seeding...');
  
  // Seed product price histories (5-10 entries per product)
  for (let p = 0; p < Math.min(15, productIds.length); p++) {
    const productId = productIds[p];
    const numEntries = Math.floor(Math.random() * 6) + 5; // 5-10 entries
    const basePrice = Math.floor(Math.random() * 800) + 300; // Base price between $300-$1100
    
    console.log(`Seeding ${numEntries} price entries for product ${p + 1}/${Math.min(15, productIds.length)}`);
    
    for (let i = 0; i < numEntries; i++) {
      // Create entries going back in time (most recent first in iteration)
      const daysAgo = (numEntries - i - 1) * 7; // Weekly intervals, going backwards
      const timestamp = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      
      // Create realistic price variation with trend
      const trendFactor = i * 15; // Upward trend of $15 per week
      const randomVariation = (Math.random() - 0.5) * 80; // +/- $40 random variation
      const price = Math.max(Math.round(basePrice + trendFactor + randomVariation), 100);
      
      const sources: ('manual' | 'market_update')[] = ['manual', 'market_update'];
      const source = sources[Math.floor(Math.random() * sources.length)];
      
      // Create price history entry directly in Firestore
      await addDoc(collection(db, 'products', productId, 'priceHistory'), {
        price,
        source,
        note: `Price update from ${timestamp.toLocaleDateString()}`,
        timestamp: Timestamp.fromDate(timestamp),
      });
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  console.log('Product price histories seeded');
  // Note: Auction price histories are now created together with bids in seedBids()
}

/**
 * Seeds sample watchlists for users (products + auctions)
 * Best-effort only – logs and continues on permission errors.
 */
async function seedWatchlists(
  userIds: string[],
  productIds: string[],
  auctionIds: string[],
): Promise<void> {
  console.log('Seeding watchlists...');

  if (!userIds.length) {
    console.log('No users available to seed watchlists');
    return;
  }

  if (!productIds.length && !auctionIds.length) {
    console.log('No products or auctions available to seed watchlists');
    return;
  }

  // If Firestore rules block these writes (permission-denied), avoid spamming
  // the console by detecting it once and skipping the rest of the seeding.
  let permissionDenied = false;

  const isPermissionError = (err: any): boolean => {
    if (!err) return false;
    const code = (err as any).code as string | undefined;
    const message = (err as any).message as string | undefined;
    return (
      code === 'permission-denied' ||
      (typeof message === 'string' && message.includes('Missing or insufficient permissions'))
    );
  };

  for (const userId of userIds) {
    if (permissionDenied) {
      break;
    }

    try {
      const watchlistRef = collection(db, 'users', userId, 'watchlist');

      // Up to 3 random products per user
      const numProducts = Math.min(3, productIds.length);
      for (let i = 0; i < numProducts; i++) {
        if (permissionDenied) break;

        const index = (i + Math.floor(Math.random() * productIds.length)) % productIds.length;
        const productId = productIds[index];

        try {
          await addDoc(watchlistRef, {
            userId,
            itemType: 'product',
            itemId: productId,
            addedAt: Timestamp.fromDate(
              new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
            ),
            notes: '',
            notificationPreferences: {
              priceChanges: true,
              auctionUpdates: true,
              bidActivity: true,
            },
          });
        } catch (err) {
          if (isPermissionError(err)) {
            permissionDenied = true;
            console.warn(
              'Watchlist seeding skipped due to Firestore security rules (permission-denied).',
              { userId, productId },
            );
          } else {
            console.error(
              'Failed to seed product watchlist entry',
              { userId, productId },
              err,
            );
          }
        }
      }

      // Up to 2 random auctions per user
      const numAuctions = Math.min(2, auctionIds.length);
      for (let i = 0; i < numAuctions; i++) {
        if (permissionDenied) break;

        const index = (i + Math.floor(Math.random() * auctionIds.length)) % auctionIds.length;
        const auctionId = auctionIds[index];

        try {
          await addDoc(watchlistRef, {
            userId,
            itemType: 'auction',
            itemId: auctionId,
            addedAt: Timestamp.fromDate(
              new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
            ),
            notes: '',
            notificationPreferences: {
              priceChanges: true,
              auctionUpdates: true,
              bidActivity: true,
            },
          });
        } catch (err) {
          if (isPermissionError(err)) {
            permissionDenied = true;
            console.warn(
              'Watchlist seeding skipped due to Firestore security rules (permission-denied).',
              { userId, auctionId },
            );
          } else {
            console.error(
              'Failed to seed auction watchlist entry',
              { userId, auctionId },
              err,
            );
          }
        }
      }
    } catch (userErr) {
      if (isPermissionError(userErr)) {
        permissionDenied = true;
        console.warn(
          'Watchlist seeding skipped for remaining users due to Firestore security rules (permission-denied).',
          { userId },
        );
      } else {
        console.error('Failed to seed watchlist for user', userId, userErr);
      }
    }
  }

  if (permissionDenied) {
    console.warn(
      'Watchlist seeding could not complete due to Firestore security rules. This only affects sample watchlists; the rest of the sample data was seeded successfully.',
    );
  } else {
    console.log('Watchlists seeded for users (best effort)');
  }
}


/**
 * Resets the entire database by deleting all collections.
 * WARNING: This will delete ALL data except the super admin user!
 */
export async function resetDatabase(): Promise<void> {
  try {
    console.log('Resetting database...');
    
    // Delete seeded auctions and their subcollections
    const auctionsSnapshot = await getDocs(collection(db, 'auctions'));
    for (const auctionDoc of auctionsSnapshot.docs) {
      if (auctionDoc.data().seeded) {
        // Delete bids subcollection
        const bidsSnapshot = await getDocs(collection(db, 'auctions', auctionDoc.id, 'bids'));
        for (const bidDoc of bidsSnapshot.docs) {
          await deleteDoc(bidDoc.ref);
        }
        // Delete autoBids subcollection
        const autoBidsSnapshot = await getDocs(collection(db, 'auctions', auctionDoc.id, 'autoBids'));
        for (const autoBidDoc of autoBidsSnapshot.docs) {
          await deleteDoc(autoBidDoc.ref);
        }
        // Delete auction
        await deleteDoc(auctionDoc.ref);
      }
    }
    console.log('Deleted seeded auctions');

    // Delete seeded products
    const productsSnapshot = await getDocs(collection(db, 'products'));
    for (const productDoc of productsSnapshot.docs) {
      if (productDoc.data().seeded) {
        await deleteDoc(productDoc.ref);
      }
    }
    console.log('Deleted seeded products');

    // Delete seeded users EXCEPT super admin
    const usersSnapshot = await getDocs(collection(db, 'users'));
    let deletedCount = 0;
    for (const userDoc of usersSnapshot.docs) {
      if (userDoc.id !== SUPER_ADMIN_UID && userDoc.data().seeded) {
        await deleteDoc(userDoc.ref);
        deletedCount++;
      }
    }
    console.log(`Deleted ${deletedCount} seeded users (preserved super admin and manual users)`);

    console.log('Database reset completed successfully!');
  } catch (error) {
    console.error('Error resetting database:', error);
    throw error;
  }
}

/**
 * Seeds all sample data in the correct order.
 */
export async function seedAllData(): Promise<void> {
  try {
    console.log('Seeding users...');
    const userIds = await seedUsers();
    console.log(`Seeded ${userIds.length} users`);

    console.log('Seeding products...');
    const productIds = await seedProducts(userIds);
    console.log(`Seeded ${productIds.length} products (15 approved, 7 pending, 3 rejected)`);

    console.log('Seeding auctions...');
    const auctionIds = await seedAuctions(productIds, userIds);
    console.log(`Seeded ${auctionIds.length} auctions (8 active, 6 pending, 4 ended, 2 rejected)`);

    console.log('Seeding bids...');
    await seedBids(auctionIds, userIds);
    console.log('Seeded bids for active auctions');

    console.log('Seeding price histories...');
    await seedPriceHistories(productIds, auctionIds);
    console.log('Seeded price histories for products and auctions');

    // Seed watchlists in best-effort mode; don't fail entire seeding on permission issues
    try {
      console.log('Seeding watchlists...');
      await seedWatchlists(userIds, productIds, auctionIds);
      console.log('Seeded watchlists for users');
    } catch (watchlistError) {
      console.error(
        'Failed to seed watchlists (likely due to Firestore security rules). Continuing without watchlists seed.',
        watchlistError,
      );
    }

    console.log('Sample data seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding data:', error);
    throw error;
  }
}