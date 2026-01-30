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
  arrayUnion,
  arrayRemove,
  deleteField,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { ChatMessage, Conversation, ChatNotification, UserPresence } from './types';
import { shouldSendNotification } from './notificationPreferencesService';

/**
 * Basic content validation for public auction chat:
 * - Blocks obvious profanity
 * - Blocks email addresses
 * - Blocks phone numbers / long digit strings (contact sharing)
 */
function validateAuctionChatContent(rawMessage: string): void {
  const message = rawMessage.toLowerCase();

  // Simple profanity filter – extendable list
  const bannedWords = [
    // English
    'fuck',
    'shit',
    'bitch',
    'asshole',
    'idiot',
    'retard',
    // Romanian generic insults
    'prost',
    'proasta',
    'prostule',
    'bou',
    'boule',
    'handicapat',
    'handicapata',
    'psihopat',
    'jegos',
    // Explicit sexual / vulgar terms (Romanian)
    'pula',
    'pulă',
    'pule',
    'muie',
    'pizda',
    'pizdă',
    'curva',
    'curvă',
    'coaie',
    'coaiele',
  ];

  if (bannedWords.some((w) => message.includes(w))) {
    throw new Error(
      'Mesajul conține limbaj nepotrivit. Te rugăm să reformulezi fără cuvinte vulgare sau jigniri.',
    );
  }

  // Email detection
  const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  if (emailRegex.test(rawMessage)) {
    throw new Error(
      'Nu este permis să postezi adrese de email în chatul public. Folosește mesajele private pentru date de contact.',
    );
  }

  // Phone / contact-like detection:
  // Normalize common obfuscations (spaces, letters instead of digits, digit words),
  // then strip non-digits and block if there are 7+ digits in total.
  const normalizedForPhone = rawMessage
    .toLowerCase()
    // Romanian number words to digits
    .replace(/\bzero\b/g, '0')
    .replace(/\bunu\b/g, '1')
    .replace(/\bdoi\b/g, '2')
    .replace(/\btrei\b/g, '3')
    .replace(/\bpatru\b/g, '4')
    .replace(/\bcinci\b/g, '5')
    .replace(/\bșase\b/g, '6')
    .replace(/\bsase\b/g, '6')
    .replace(/\bșapte\b/g, '7')
    .replace(/\bsapte\b/g, '7')
    .replace(/\bopt\b/g, '8')
    .replace(/\bnouă\b/g, '9')
    .replace(/\bnoua\b/g, '9')
    // English number words to digits (just in case)
    .replace(/\bzero\b/g, '0')
    .replace(/\bone\b/g, '1')
    .replace(/\btwo\b/g, '2')
    .replace(/\bthree\b/g, '3')
    .replace(/\bfour\b/g, '4')
    .replace(/\bfive\b/g, '5')
    .replace(/\bsix\b/g, '6')
    .replace(/\bseven\b/g, '7')
    .replace(/\beight\b/g, '8')
    .replace(/\bnine\b/g, '9')
    // Letter-to-digit obfuscations often used in phone numbers
    .replace(/o/g, '0')
    .replace(/l/g, '1')
    .replace(/i/g, '1')
    .replace(/s/g, '5');

  const digitsOnly = normalizedForPhone.replace(/\D/g, '');
  if (digitsOnly.length >= 7) {
    throw new Error(
      'Nu este permis să postezi numere de telefon sau alte date de contact (chiar scrise cu spații sau litere) în chatul public. Folosește mesajele private pentru astfel de informații.',
    );
  }
}

/**
 * Send a message to an auction's public chat
 * Messages are anonymous during active bidding
 */
export async function sendAuctionChatMessage(
  auctionId: string,
  userId: string,
  message: string,
  isAnonymous: boolean = true,
): Promise<string> {
  if (!db) throw new Error('Firestore not initialized');

  const trimmed = message.trim();
  if (!trimmed) {
    throw new Error('Mesajul nu poate fi gol.');
  }

  // Validate content for profanity and contact info before writing to Firestore
  validateAuctionChatContent(trimmed);

  const chatRef = collection(db, 'auctions', auctionId, 'publicChat');

  let senderName: string | undefined;
  let senderAvatar: string | undefined;

  // If not anonymous, fetch user details
  if (!isAnonymous) {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      senderName = userData.displayName;
      senderAvatar = userData.avatar;
    }
  }

  const messageData: any = {
    senderId: userId,
    message: trimmed,
    timestamp: serverTimestamp(),
    isAnonymous,
    edited: false,
    deleted: false,
  };

  // Only add optional fields if they have values
  if (!isAnonymous && senderName) {
    messageData.senderName = senderName;
  }
  if (!isAnonymous && senderAvatar) {
    messageData.senderAvatar = senderAvatar;
  }

  const docRef = await addDoc(chatRef, messageData);

  // Notify auction owner about new chat message
  try {
    const auctionDoc = await getDoc(doc(db, 'auctions', auctionId));
    if (auctionDoc.exists()) {
      const auctionData = auctionDoc.data();
      const ownerId = auctionData.ownerId;
      
      // Only notify if sender is not the owner
      if (ownerId && ownerId !== userId) {
        const displayName = isAnonymous ? 'Un utilizator' : (senderName || 'Un utilizator');
        await createChatNotification(
          ownerId,
          'new_message',
          userId,
          displayName,
          `Mesaj nou în licitația ta: ${trimmed.substring(0, 50)}${trimmed.length > 50 ? '...' : ''}`,
          undefined,
          auctionId
        );
      }
    }
  } catch (error) {
    console.error('Failed to notify auction owner about chat message:', error);
    // Don't throw - message was sent successfully
  }

  return docRef.id;
}

/**
 * Send a message to a private conversation
 */
export async function sendPrivateMessage(
  conversationId: string,
  userId: string,
  message: string
): Promise<string> {
  if (!db) throw new Error('Firestore not initialized');

  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  
  // Fetch user details
  const userDoc = await getDoc(doc(db, 'users', userId));
  let senderName = 'Unknown User';
  let senderAvatar: string | undefined;

  if (userDoc.exists()) {
    const userData = userDoc.data();
    senderName = userData.displayName || 'Unknown User';
    senderAvatar = userData.avatar;
  }

  const messageData: Omit<ChatMessage, 'id'> = {
    senderId: userId,
    senderName,
    senderAvatar,
    message,
    timestamp: new Date(),
    isAnonymous: false,
    edited: false,
    deleted: false,
  };

  const docRef = await addDoc(messagesRef, {
    ...messageData,
    timestamp: serverTimestamp(),
  });

  // Update conversation with last message info
  const conversationRef = doc(db, 'conversations', conversationId);
  const conversationDoc = await getDoc(conversationRef);
  
  if (conversationDoc.exists()) {
    const conversation = conversationDoc.data() as Conversation;
    const otherUserId = conversation.participants.find(id => id !== userId);
    
    await updateDoc(conversationRef, {
      lastMessage: message.substring(0, 100), // Preview
      lastMessageAt: serverTimestamp(),
      [`unreadCount.${otherUserId}`]: increment(1),
      updatedAt: serverTimestamp(),
    });

    // Create notification for the other user
    if (otherUserId) {
      await createChatNotification(
        otherUserId,
        'new_message',
        userId,
        senderName,
        message.substring(0, 100),
        conversationId
      );
    }
  }

  return docRef.id;
}

/**
 * Create or get a conversation between buyer and seller, or admin support chat
 */
export async function createOrGetConversation(
  buyerId: string,
  sellerId: string,
  auctionId?: string,
  productId?: string,
  isAdminSupport: boolean = false
): Promise<string> {
  if (!db) throw new Error('Firestore not initialized');

  const setIfNonEmptyString = (target: Record<string, any>, key: string, value: unknown) => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed) return;
    target[key] = trimmed;
  };

  // Check if conversation already exists
  const conversationsRef = collection(db, 'conversations');
  let q;

  if (isAdminSupport) {
    // For admin support, check if admin already has a support conversation with this user
    q = query(
      conversationsRef,
      where('participants', 'array-contains', buyerId),
      where('isAdminSupport', '==', true)
    );
  } else {
    q = query(
      conversationsRef,
      where('participants', 'array-contains', buyerId)
    );
  }

  const snapshot = await getDocs(q);
  const existingConversation = snapshot.docs.find(doc => {
    const data = doc.data() as Conversation;
    if (isAdminSupport) {
      return data.participants.includes(sellerId) && data.isAdminSupport === true;
    } else {
      return data.participants.includes(sellerId) &&
             (auctionId ? data.auctionId === auctionId : true) &&
             (productId ? data.productId === productId : true);
    }
  });

  if (existingConversation) {
    // Backfill participant metadata for older conversations that were created
    // before we started storing names/emails/phones on the conversation.
    try {
      const data = existingConversation.data() as any;
      const needsBackfill =
        !data.buyerName ||
        !data.sellerName ||
        !data.buyerEmail ||
        !data.sellerEmail ||
        !data.buyerPhone ||
        !data.sellerPhone;

      if (needsBackfill) {
        const [buyerDoc, sellerDoc] = await Promise.all([
          getDoc(doc(db, 'users', buyerId)),
          getDoc(doc(db, 'users', sellerId)),
        ]);

        const patch: any = { updatedAt: serverTimestamp() };

        if (buyerDoc.exists()) {
          const d = buyerDoc.data() as any;
          setIfNonEmptyString(patch, 'buyerName', d.displayName || d.name || d.email || data.buyerName);
          setIfNonEmptyString(patch, 'buyerEmail', d.email || data.buyerEmail);
          setIfNonEmptyString(patch, 'buyerPhone', d.personalDetails?.phone || data.buyerPhone);
        }
        if (sellerDoc.exists()) {
          const d = sellerDoc.data() as any;
          setIfNonEmptyString(patch, 'sellerName', d.displayName || d.name || d.email || data.sellerName);
          setIfNonEmptyString(patch, 'sellerEmail', d.email || data.sellerEmail);
          setIfNonEmptyString(patch, 'sellerPhone', d.personalDetails?.phone || data.sellerPhone);
        }

        // Avoid writing empty patches (Firestore rejects undefined fields).
        if (Object.keys(patch).length > 1) {
          await updateDoc(doc(db, 'conversations', existingConversation.id), patch);
        }
      }
    } catch (err) {
      console.error('Failed to backfill conversation participant metadata:', err);
    }

    return existingConversation.id;
  }

  // Resolve participant display names once, so chat UI can show usernames without needing extra reads.
  // (Also helps when reading user docs is restricted outside of participants.)
  let buyerName: string | undefined = undefined;
  let sellerName: string | undefined = undefined;
  let buyerEmail: string | undefined = undefined;
  let sellerEmail: string | undefined = undefined;
  let buyerPhone: string | undefined = undefined;
  let sellerPhone: string | undefined = undefined;
  try {
    const [buyerDoc, sellerDoc] = await Promise.all([
      getDoc(doc(db, 'users', buyerId)),
      getDoc(doc(db, 'users', sellerId)),
    ]);
    if (buyerDoc.exists()) {
      const d = buyerDoc.data() as any;
      buyerName = d.displayName || d.name || d.email || undefined;
      buyerEmail = d.email || undefined;
      buyerPhone = d.personalDetails?.phone || undefined;
    }
    if (sellerDoc.exists()) {
      const d = sellerDoc.data() as any;
      sellerName = d.displayName || d.name || d.email || undefined;
      sellerEmail = d.email || undefined;
      sellerPhone = d.personalDetails?.phone || undefined;
    }
  } catch (err) {
    console.error('Failed to resolve buyer/seller names for conversation:', err);
  }

  // Create new conversation
  const conversationData: any = {
    buyerId,
    sellerId,
    participants: [buyerId, sellerId],
    unreadCount: {
      [buyerId]: 0,
      [sellerId]: 0,
    },
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Firestore rejects `undefined` values; only include optional fields when present.
  setIfNonEmptyString(conversationData, 'buyerName', buyerName);
  setIfNonEmptyString(conversationData, 'sellerName', sellerName);
  setIfNonEmptyString(conversationData, 'buyerEmail', buyerEmail);
  setIfNonEmptyString(conversationData, 'sellerEmail', sellerEmail);
  setIfNonEmptyString(conversationData, 'buyerPhone', buyerPhone);
  setIfNonEmptyString(conversationData, 'sellerPhone', sellerPhone);

  if (isAdminSupport) {
    conversationData.isAdminSupport = true;
  } else {
    // Only include auction/product IDs for regular conversations
    if (auctionId) conversationData.auctionId = auctionId;
    if (productId) conversationData.productId = productId;
  }

  const docRef = await addDoc(conversationsRef, {
    ...conversationData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Notify seller about new conversation
  const senderNameForNotification = buyerName || 'A user';

  await createChatNotification(
    sellerId,
    'conversation_started',
    buyerId,
    senderNameForNotification,
    isAdminSupport ? 'A new support conversation has been started' : 'A new conversation has been started',
    docRef.id,
    auctionId // This will be undefined for admin support, which is fine now
  );

  return docRef.id;
}

/**
 * Mark conversation messages as read
 */
export async function markConversationAsRead(
  conversationId: string,
  userId: string
): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  const conversationRef = doc(db, 'conversations', conversationId);
  await updateDoc(conversationRef, {
    [`unreadCount.${userId}`]: 0,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get user's conversations
 */
export function subscribeToUserConversations(
  userId: string,
  callback: (conversations: Conversation[]) => void
): () => void {
  if (!db) throw new Error('Firestore not initialized');

  const conversationsRef = collection(db, 'conversations');
  const q = query(
    conversationsRef,
    where('participants', 'array-contains', userId),
    where('status', '==', 'active'),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const conversations: Conversation[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      conversations.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        lastMessageAt: data.lastMessageAt?.toDate(),
      } as Conversation);
    });
    callback(conversations);
  });
}

/**
 * Subscribe to auction public chat messages
 */
export function subscribeToAuctionChat(
  auctionId: string,
  callback: (messages: ChatMessage[]) => void
): () => void {
  if (!db) throw new Error('Firestore not initialized');

  const chatRef = collection(db, 'auctions', auctionId, 'publicChat');
  const q = query(chatRef, orderBy('timestamp', 'asc'), limit(100));

  return onSnapshot(q, (snapshot) => {
    const messages: ChatMessage[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (!data.deleted) {
        messages.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate() || new Date(),
          editedAt: data.editedAt?.toDate(),
        } as ChatMessage);
      }
    });
    callback(messages);
  });
}

/**
 * Subscribe to private conversation messages
 */
export function subscribeToConversationMessages(
  conversationId: string,
  callback: (messages: ChatMessage[]) => void
): () => void {
  if (!db) throw new Error('Firestore not initialized');

  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(100));

  return onSnapshot(q, (snapshot) => {
    const messages: ChatMessage[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (!data.deleted) {
        messages.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate() || new Date(),
          editedAt: data.editedAt?.toDate(),
        } as ChatMessage);
      }
    });
    callback(messages);
  });
}

/**
 * Create a chat notification
 */
async function createChatNotification(
  userId: string,
  type: ChatNotification['type'],
  senderId: string,
  senderName: string,
  message: string,
  conversationId?: string,
  auctionId?: string
): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  if (!(await shouldSendNotification(userId, 'messageUpdates'))) {
    return;
  }

  const notificationsRef = collection(db, 'users', userId, 'notifications');

  const notificationData: any = {
    userId,
    type,
    senderId,
    senderName,
    message,
    read: false,
    pushed: false,
    createdAt: new Date(),
  };

  // Only include optional fields if they have values
  if (conversationId) notificationData.conversationId = conversationId;
  if (auctionId) notificationData.auctionId = auctionId;

  const docRef = await addDoc(notificationsRef, {
    ...notificationData,
    createdAt: serverTimestamp(),
  });

  // Send browser notification (for web users)
  try {
    await sendPushNotification(
      userId,
      `Mesaj nou de la ${senderName}`,
      message,
      { conversationId, auctionId, notificationId: docRef.id }
    );
  } catch (error) {
    console.error('Failed to send browser notification:', error);
  }

  // Note: The Firebase Cloud Function (sendChatMessagePush) will handle
  // sending push notifications to Expo devices and mark the notification as pushed.
  // We don't mark it as pushed here to allow the Cloud Function to process it.
}

/**
 * Reveal identities in auction chat after auction ends
 * This updates all anonymous messages to show sender details
 */
export async function revealAuctionChatIdentities(auctionId: string): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  const chatRef = collection(db, 'auctions', auctionId, 'publicChat');
  const q = query(chatRef, where('isAnonymous', '==', true));

  const snapshot = await getDocs(q);
  
  const updatePromises = snapshot.docs.map(async (messageDoc) => {
    const messageData = messageDoc.data();
    const userId = messageData.senderId;
    
    // Fetch user details
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      await updateDoc(messageDoc.ref, {
        isAnonymous: false,
        senderName: userData.displayName,
        senderAvatar: userData.avatar,
      });
    }
  });

  await Promise.all(updatePromises);
}

/**
 * Delete a message (soft delete)
 */
export async function deleteMessage(
  messageId: string,
  isAuctionChat: boolean,
  parentId: string // auctionId or conversationId
): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  const messageRef = isAuctionChat
    ? doc(db, 'auctions', parentId, 'publicChat', messageId)
    : doc(db, 'conversations', parentId, 'messages', messageId);

  await updateDoc(messageRef, {
    deleted: true,
    message: '[Message deleted]',
  });
}

/**
 * Edit a message
 */
export async function editMessage(
  messageId: string,
  newMessage: string,
  isAuctionChat: boolean,
  parentId: string // auctionId or conversationId
): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  const messageRef = isAuctionChat
    ? doc(db, 'auctions', parentId, 'publicChat', messageId)
    : doc(db, 'conversations', parentId, 'messages', messageId);

  await updateDoc(messageRef, {
    message: newMessage,
    edited: true,
    editedAt: serverTimestamp(),
  });
}

/**
 * Mark message as read by user
 */
export async function markMessageAsRead(
  messageId: string,
  userId: string,
  isAuctionChat: boolean,
  parentId: string
): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  const messageRef = isAuctionChat
    ? doc(db, 'auctions', parentId, 'publicChat', messageId)
    : doc(db, 'conversations', parentId, 'messages', messageId);

  await updateDoc(messageRef, {
    readBy: arrayUnion(userId),
  });
}

/**
 * Set typing indicator for a conversation
 */
export async function setTypingIndicator(
  conversationId: string,
  userId: string,
  isTyping: boolean
): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  const conversationRef = doc(db, 'conversations', conversationId);
  
  if (isTyping) {
    await updateDoc(conversationRef, {
      typingUsers: arrayUnion(userId),
    });
  } else {
    await updateDoc(conversationRef, {
      typingUsers: arrayRemove(userId),
    });
  }
}

/**
 * Subscribe to typing indicators for a conversation
 */
export function subscribeToTypingIndicators(
  conversationId: string,
  callback: (typingUsers: string[]) => void
): () => void {
  if (!db) throw new Error('Firestore not initialized');

  const conversationRef = doc(db, 'conversations', conversationId);

  return onSnapshot(conversationRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      callback(data.typingUsers || []);
    } else {
      callback([]);
    }
  });
}

/**
 * Search messages in a conversation
 */
export async function searchMessages(
  conversationId: string,
  searchTerm: string,
  isAuctionChat: boolean = false,
  parentId?: string
): Promise<ChatMessage[]> {
  if (!db) throw new Error('Firestore not initialized');

  const messagesRef = isAuctionChat && parentId
    ? collection(db, 'auctions', parentId, 'publicChat')
    : collection(db, 'conversations', conversationId, 'messages');

  const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(100));
  const snapshot = await getDocs(q);

  const messages: ChatMessage[] = [];
  const searchLower = searchTerm.toLowerCase();

  snapshot.forEach((doc) => {
    const data = doc.data();
    if (!data.deleted && data.message.toLowerCase().includes(searchLower)) {
      messages.push({
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate() || new Date(),
        editedAt: data.editedAt?.toDate(),
      } as ChatMessage);
    }
  });

  return messages;
}

/**
 * Get unread notifications count for user
 */
export function subscribeToNotifications(
  userId: string,
  callback: (notifications: ChatNotification[], unreadCount: number) => void
): () => void {
  if (!db) throw new Error('Firestore not initialized');

  const notificationsRef = collection(db, 'users', userId, 'notifications');
  const q = query(notificationsRef, orderBy('createdAt', 'desc'), limit(50));

  return onSnapshot(q, (snapshot) => {
    const notifications: ChatNotification[] = [];
    let unreadCount = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      const notification: ChatNotification = {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as ChatNotification;
      
      notifications.push(notification);
      if (!notification.read) {
        unreadCount++;
      }
    });

    callback(notifications, unreadCount);
  });
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(
  userId: string,
  notificationId: string
): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  const notificationRef = doc(db, 'users', userId, 'notifications', notificationId);
  await updateDoc(notificationRef, {
    read: true,
  });
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  const notificationsRef = collection(db, 'users', userId, 'notifications');
  const q = query(notificationsRef, where('read', '==', false));
  const snapshot = await getDocs(q);

  const updatePromises = snapshot.docs.map((doc) =>
    updateDoc(doc.ref, { read: true })
  );

  await Promise.all(updatePromises);
}

/**
 * Request browser notification permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

/**
 * Show browser notification
 */
export function showBrowserNotification(
  title: string,
  options?: NotificationOptions
): void {
  if (Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/icon.png',
      badge: '/badge.png',
      ...options,
    });
  }
}

/**
 * Send push notification (browser notification)
 */
async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: any
): Promise<void> {
  // Check if we're in a browser environment and Notification API is available
  if (typeof window !== 'undefined' && 'Notification' in window) {
    // Check if user has granted permission
    if (Notification.permission === 'granted') {
      showBrowserNotification(title, {
        body,
        data,
        tag: `chat-${userId}`,
        requireInteraction: false,
      });
    }
  }

  // For mobile (Expo), the Firebase function will handle push notifications
  // The notification document is created in Firestore, which triggers the Firebase function
  // to send push notifications to Expo
}
