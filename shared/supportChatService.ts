import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  serverTimestamp,
  increment,
  setDoc,
  limit,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { ChatMessage } from './types';
import { shouldSendNotification } from './notificationPreferencesService';

/**
 * SupportChat interface for support conversations
 * These are visible to ALL admins, not just one
 */
export interface SupportChat {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  userAvatar?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  lastMessage?: string;
  lastMessageAt?: Date;
  lastMessageBy?: string;
  createdAt: Date;
  updatedAt: Date;
  assignedAdminId?: string;
  assignedAdminName?: string;
  unreadCountUser: number;
  unreadCountAdmin: number;
  tags?: string[];
  notes?: string; // Internal admin notes
}

/**
 * Create a new support chat (called when user starts a support conversation)
 */
export async function createSupportChat(
  userId: string,
  initialMessage: string
): Promise<string> {
  if (!db) throw new Error('Firestore not initialized');

  // Get user details
  const userDoc = await getDoc(doc(db, 'users', userId));
  let userName: string | undefined;
  let userEmail: string | undefined;
  let userAvatar: string | undefined;

  if (userDoc.exists()) {
    const userData = userDoc.data();
    userName = userData.displayName || userData.name || userData.email;
    userEmail = userData.email;
    userAvatar = userData.avatar;
  }

  // Create the support chat document
  const supportChatsRef = collection(db, 'supportChats');
  const chatData: any = {
    userId,
    userName,
    userEmail,
    userAvatar,
    status: 'open',
    priority: 'normal',
    unreadCountUser: 0,
    unreadCountAdmin: 1, // Initial message is unread by admins
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const chatDocRef = await addDoc(supportChatsRef, chatData);

  // Add the initial message
  const messagesRef = collection(db, 'supportChats', chatDocRef.id, 'messages');
  await addDoc(messagesRef, {
    senderId: userId,
    senderName: userName || 'User',
    senderAvatar: userAvatar,
    message: initialMessage,
    timestamp: serverTimestamp(),
    isFromAdmin: false,
    readBy: [userId],
  });

  // Update the chat with last message info
  await updateDoc(chatDocRef, {
    lastMessage: initialMessage.substring(0, 100),
    lastMessageAt: serverTimestamp(),
    lastMessageBy: userId,
  });

  // Notify all admins about new support chat
  await notifyAdminsOfNewSupportChat(chatDocRef.id, userName || 'User', initialMessage);

  return chatDocRef.id;
}

/**
 * Send a message in a support chat
 */
export async function sendSupportMessage(
  chatId: string,
  senderId: string,
  message: string,
  isAdmin: boolean
): Promise<string> {
  if (!db) throw new Error('Firestore not initialized');

  // Get sender details
  const userDoc = await getDoc(doc(db, 'users', senderId));
  let senderName = 'Unknown';
  let senderAvatar: string | undefined;

  if (userDoc.exists()) {
    const userData = userDoc.data();
    senderName = userData.displayName || userData.name || userData.email || 'Unknown';
    senderAvatar = userData.avatar;
  }

  const messagesRef = collection(db, 'supportChats', chatId, 'messages');
  const messageData = {
    senderId,
    senderName,
    senderAvatar,
    message,
    timestamp: serverTimestamp(),
    isFromAdmin: isAdmin,
    readBy: [senderId],
  };

  const docRef = await addDoc(messagesRef, messageData);

  // Update the support chat
  const chatRef = doc(db, 'supportChats', chatId);
  const chatDoc = await getDoc(chatRef);

  if (chatDoc.exists()) {
    const chatData = chatDoc.data();
    const updates: any = {
      lastMessage: message.substring(0, 100),
      lastMessageAt: serverTimestamp(),
      lastMessageBy: senderId,
      updatedAt: serverTimestamp(),
    };

    if (isAdmin) {
      // Admin sent message - increment user's unread count
      updates.unreadCountUser = increment(1);
      updates.status = 'in_progress';
      if (!chatData.assignedAdminId) {
        updates.assignedAdminId = senderId;
        updates.assignedAdminName = senderName;
      }
    } else {
      // User sent message - increment admin unread count
      updates.unreadCountAdmin = increment(1);
    }

    await updateDoc(chatRef, updates);

    // Send notification
    if (isAdmin) {
      // Notify the user
      await createSupportNotification(
        chatData.userId,
        'new_message',
        senderName,
        message,
        chatId
      );
    } else {
      // Notify all admins
      await notifyAdminsOfNewMessage(chatId, senderName, message);
    }
  }

  return docRef.id;
}

/**
 * Subscribe to support chat messages
 */
export function subscribeToSupportChatMessages(
  chatId: string,
  callback: (messages: ChatMessage[]) => void
): () => void {
  if (!db) throw new Error('Firestore not initialized');

  const messagesRef = collection(db, 'supportChats', chatId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(200));

  return onSnapshot(q, (snapshot) => {
    const messages: ChatMessage[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      messages.push({
        id: doc.id,
        senderId: data.senderId,
        senderName: data.senderName,
        senderAvatar: data.senderAvatar,
        message: data.message,
        timestamp: data.timestamp?.toDate() || new Date(),
        readBy: data.readBy || [],
      } as ChatMessage);
    });
    callback(messages);
  });
}

/**
 * Subscribe to a user's support chats
 */
export function subscribeToUserSupportChats(
  userId: string,
  callback: (chats: SupportChat[]) => void
): () => void {
  if (!db) throw new Error('Firestore not initialized');

  const supportChatsRef = collection(db, 'supportChats');
  const q = query(
    supportChatsRef,
    where('userId', '==', userId),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const chats: SupportChat[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      chats.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        lastMessageAt: data.lastMessageAt?.toDate(),
      } as SupportChat);
    });
    callback(chats);
  });
}

/**
 * Subscribe to ALL support chats (admin only)
 */
export function subscribeToAllSupportChats(
  callback: (chats: SupportChat[]) => void
): () => void {
  if (!db) throw new Error('Firestore not initialized');

  const supportChatsRef = collection(db, 'supportChats');
  const q = query(
    supportChatsRef,
    orderBy('updatedAt', 'desc'),
    limit(100)
  );

  return onSnapshot(q, (snapshot) => {
    const chats: SupportChat[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      chats.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        lastMessageAt: data.lastMessageAt?.toDate(),
      } as SupportChat);
    });
    callback(chats);
  });
}

/**
 * Mark support chat messages as read
 */
export async function markSupportChatAsRead(
  chatId: string,
  userId: string,
  isAdmin: boolean
): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  const chatRef = doc(db, 'supportChats', chatId);

  if (isAdmin) {
    await updateDoc(chatRef, {
      unreadCountAdmin: 0,
      updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(chatRef, {
      unreadCountUser: 0,
      updatedAt: serverTimestamp(),
    });
  }

  // Mark all messages as read by this user
  const messagesRef = collection(db, 'supportChats', chatId, 'messages');
  const snapshot = await getDocs(messagesRef);

  const updatePromises = snapshot.docs.map((msgDoc) => {
    const data = msgDoc.data();
    if (!data.readBy?.includes(userId)) {
      return updateDoc(msgDoc.ref, {
        readBy: [...(data.readBy || []), userId],
      });
    }
    return Promise.resolve();
  });

  await Promise.all(updatePromises);
}

/**
 * Update support chat status
 */
export async function updateSupportChatStatus(
  chatId: string,
  status: SupportChat['status'],
  adminId?: string
): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  const updates: any = {
    status,
    updatedAt: serverTimestamp(),
  };

  if (adminId && (status === 'in_progress' || status === 'resolved')) {
    const adminDoc = await getDoc(doc(db, 'users', adminId));
    if (adminDoc.exists()) {
      updates.assignedAdminId = adminId;
      updates.assignedAdminName = adminDoc.data().displayName || adminDoc.data().email;
    }
  }

  await updateDoc(doc(db, 'supportChats', chatId), updates);
}

/**
 * Update support chat priority
 */
export async function updateSupportChatPriority(
  chatId: string,
  priority: SupportChat['priority']
): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  await updateDoc(doc(db, 'supportChats', chatId), {
    priority,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Add internal notes to support chat (admin only)
 */
export async function updateSupportChatNotes(
  chatId: string,
  notes: string
): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  await updateDoc(doc(db, 'supportChats', chatId), {
    notes,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get support chat by ID
 */
export async function getSupportChat(chatId: string): Promise<SupportChat | null> {
  if (!db) throw new Error('Firestore not initialized');

  const chatDoc = await getDoc(doc(db, 'supportChats', chatId));
  if (!chatDoc.exists()) return null;

  const data = chatDoc.data();
  return {
    id: chatDoc.id,
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
    lastMessageAt: data.lastMessageAt?.toDate(),
  } as SupportChat;
}

/**
 * Notify all admins of a new support chat
 */
async function notifyAdminsOfNewSupportChat(
  chatId: string,
  userName: string,
  message: string
): Promise<void> {
  if (!db) return;

  try {
    // Get all admins
    const usersRef = collection(db, 'users');
    const adminQuery = query(
      usersRef,
      where('role', 'in', ['admin', 'superadmin'])
    );
    const adminSnapshot = await getDocs(adminQuery);

    // Create notification for each admin
    const notificationPromises = adminSnapshot.docs.map((adminDoc) => {
      return createSupportNotification(
        adminDoc.id,
        'new_support_chat',
        userName,
        `Cerere de suport nouă: ${message.substring(0, 50)}...`,
        chatId
      );
    });

    await Promise.all(notificationPromises);
  } catch (error) {
    console.error('Failed to notify admins of new support chat:', error);
  }
}

/**
 * Notify all admins of a new message in a support chat
 */
async function notifyAdminsOfNewMessage(
  chatId: string,
  userName: string,
  message: string
): Promise<void> {
  if (!db) return;

  try {
    // Get all admins
    const usersRef = collection(db, 'users');
    const adminQuery = query(
      usersRef,
      where('role', 'in', ['admin', 'superadmin'])
    );
    const adminSnapshot = await getDocs(adminQuery);

    // Create notification for each admin
    const notificationPromises = adminSnapshot.docs.map((adminDoc) => {
      return createSupportNotification(
        adminDoc.id,
        'new_message',
        userName,
        message.substring(0, 100),
        chatId
      );
    });

    await Promise.all(notificationPromises);
  } catch (error) {
    console.error('Failed to notify admins of new message:', error);
  }
}

/**
 * Create a support notification
 */
async function createSupportNotification(
  userId: string,
  type: 'new_message' | 'new_support_chat' | 'support_resolved',
  senderName: string,
  message: string,
  chatId: string
): Promise<void> {
  if (!db) return;

  try {
    if (!(await shouldSendNotification(userId, 'messageUpdates'))) {
      return;
    }

    const notificationsRef = collection(db, 'users', userId, 'notifications');
    await addDoc(notificationsRef, {
      userId,
      type,
      senderName,
      message,
      supportChatId: chatId,
      read: false,
      pushed: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to create support notification:', error);
  }
}

/**
 * Get unread support chats count for admin
 */
export async function getUnreadSupportChatsCount(): Promise<number> {
  if (!db) return 0;

  try {
    const supportChatsRef = collection(db, 'supportChats');
    const q = query(
      supportChatsRef,
      where('unreadCountAdmin', '>', 0)
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error('Failed to get unread support chats count:', error);
    return 0;
  }
}

/**
 * Subscribe to unread support chats count for admin
 */
export function subscribeToUnreadSupportChatsCount(
  callback: (count: number) => void
): () => void {
  if (!db) throw new Error('Firestore not initialized');

  const supportChatsRef = collection(db, 'supportChats');
  const q = query(supportChatsRef);

  return onSnapshot(q, (snapshot) => {
    let count = 0;
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.unreadCountAdmin > 0) {
        count++;
      }
    });
    callback(count);
  });
}
