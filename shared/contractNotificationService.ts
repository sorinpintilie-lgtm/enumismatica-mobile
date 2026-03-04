import {
  collection,
  addDoc,
  doc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import type { ContractNotification } from './types';
import { shouldSendNotification } from './notificationPreferencesService';

/**
 * Contract Notification Service
 * Creates in-app notifications for contract events
 */

type ContractNotificationType = ContractNotification['type'];

/**
 * Create a contract notification for a user
 */
export async function createContractNotification(
  userId: string,
  type: ContractNotificationType,
  contractId: string,
  contractNumber: string,
  productName: string,
  otherPartyName: string,
  message: string
): Promise<string> {
  if (!db) {
    console.warn('[ContractNotification] Firestore not initialized');
    return '';
  }

  // Check if user wants this type of notification
  if (!(await shouldSendNotification(userId, 'orderUpdates'))) {
    return '';
  }

  try {
    const notificationsRef = collection(db, 'users', userId, 'notifications');
    
    const notificationData: Omit<ContractNotification, 'id'> = {
      userId,
      type,
      contractId,
      contractNumber,
      productName,
      otherPartyName,
      message,
      read: false,
      pushed: false,
      createdAt: new Date(),
    };

    const docRef = await addDoc(notificationsRef, {
      ...notificationData,
      createdAt: serverTimestamp(),
    });

    return docRef.id;
  } catch (error) {
    console.error('[ContractNotification] Failed to create notification:', error);
    return '';
  }
}

/**
 * Notify other party about contract creation
 */
export async function notifyContractCreated(
  buyerId: string,
  sellerId: string,
  contractId: string,
  contractNumber: string,
  productName: string,
  buyerName: string,
  sellerName: string,
  price: number
): Promise<void> {
  // Notify buyer
  await createContractNotification(
    buyerId,
    'contract_created',
    contractId,
    contractNumber,
    productName,
    sellerName,
    `Contract de vânzare-cumpărare creat pentru "${productName}" (${price} EUR). Vânzător: ${sellerName}`
  );

  // Notify seller
  await createContractNotification(
    sellerId,
    'contract_created',
    contractId,
    contractNumber,
    productName,
    buyerName,
    `Contract de vânzare-cumpărare creat pentru "${productName}" (${price} EUR). Cumpărător: ${buyerName}`
  );
}

/**
 * Notify other party about contract acceptance
 */
export async function notifyContractAccepted(
  buyerId: string,
  sellerId: string,
  contractId: string,
  contractNumber: string,
  productName: string,
  acceptedBy: string,
  otherPartyName: string
): Promise<void> {
  // Determine who to notify
  const notifyBuyer = acceptedBy !== buyerId;
  const notifySeller = acceptedBy !== sellerId;

  if (notifyBuyer) {
    await createContractNotification(
      buyerId,
      'contract_accepted',
      contractId,
      contractNumber,
      productName,
      otherPartyName,
      `${otherPartyName} a acceptat contractul pentru "${productName}". Contractul este acum în așteptarea acceptării tale.`
    );
  }

  if (notifySeller) {
    await createContractNotification(
      sellerId,
      'contract_accepted',
      contractId,
      contractNumber,
      productName,
      otherPartyName,
      `${otherPartyName} a acceptat contractul pentru "${productName}". Contractul este acum în așteptarea acceptării tale.`
    );
  }
}

/**
 * Notify other party about contract rejection/cancellation
 */
export async function notifyContractRejected(
  buyerId: string,
  sellerId: string,
  contractId: string,
  contractNumber: string,
  productName: string,
  rejectedBy: string,
  otherPartyName: string,
  reason: string
): Promise<void> {
  // Determine who to notify
  const notifyBuyer = rejectedBy !== buyerId;
  const notifySeller = rejectedBy !== sellerId;

  if (notifyBuyer) {
    await createContractNotification(
      buyerId,
      'contract_rejected',
      contractId,
      contractNumber,
      productName,
      otherPartyName,
      `${otherPartyName} a respins contractul pentru "${productName}". Motiv: ${reason}`
    );
  }

  if (notifySeller) {
    await createContractNotification(
      sellerId,
      'contract_rejected',
      contractId,
      contractNumber,
      productName,
      otherPartyName,
      `${otherPartyName} a respins contractul pentru "${productName}". Motiv: ${reason}`
    );
  }
}

/**
 * Notify parties about a dispute
 */
export async function notifyContractDisputed(
  buyerId: string,
  sellerId: string,
  contractId: string,
  contractNumber: string,
  productName: string,
  disputedBy: string,
  disputeReason: string
): Promise<void> {
  // Notify the other party
  if (disputedBy !== buyerId) {
    await createContractNotification(
      buyerId,
      'contract_disputed',
      contractId,
      contractNumber,
      productName,
      'Administrator',
      `O dispută a fost ridicată pentru contractul "${productName}". Motiv: ${disputeReason}`
    );
  }

  if (disputedBy !== sellerId) {
    await createContractNotification(
      sellerId,
      'contract_disputed',
      contractId,
      contractNumber,
      productName,
      'Administrator',
      `O dispută a fost ridicată pentru contractul "${productName}". Motiv: ${disputeReason}`
    );
  }
}

/**
 * Notify parties about dispute resolution
 */
export async function notifyDisputeResolved(
  buyerId: string,
  sellerId: string,
  contractId: string,
  contractNumber: string,
  productName: string,
  resolution: string
): Promise<void> {
  // Notify both parties
  await createContractNotification(
    buyerId,
    'contract_dispute_resolved',
    contractId,
    contractNumber,
    productName,
    'Administrator',
    `Disputa pentru contractul "${productName}" a fost rezolvată. Rezoluție: ${resolution}`
  );

  await createContractNotification(
    sellerId,
    'contract_dispute_resolved',
    contractId,
    contractNumber,
    productName,
    'Administrator',
    `Disputa pentru contractul "${productName}" a fost rezolvată. Rezoluție: ${resolution}`
  );
}

/**
 * Mark contract notification as read
 */
export async function markContractNotificationAsRead(
  userId: string,
  notificationId: string
): Promise<void> {
  if (!db) return;

  const notificationRef = doc(db, 'users', userId, 'notifications', notificationId);
  await getDoc(notificationRef).then((snap) => {
    if (snap.exists()) {
      import('firebase/firestore').then(({ updateDoc }) => {
        updateDoc(notificationRef, { read: true });
      });
    }
  });
}

export default {
  createContractNotification,
  notifyContractCreated,
  notifyContractAccepted,
  notifyContractRejected,
  notifyContractDisputed,
  notifyDisputeResolved,
  markContractNotificationAsRead,
};
