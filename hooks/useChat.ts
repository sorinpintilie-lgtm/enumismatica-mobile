import { useState, useEffect, useCallback, useRef } from 'react';
import {
  subscribeToAuctionChat,
  subscribeToConversationMessages,
  subscribeToUserConversations,
  sendAuctionChatMessage,
  sendPrivateMessage,
  createOrGetConversation,
  markConversationAsRead,
  editMessage,
  deleteMessage,
  markMessageAsRead,
  setTypingIndicator,
  subscribeToTypingIndicators,
  searchMessages,
  subscribeToNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  requestNotificationPermission,
} from '../../shared/chatService';
import { ChatMessage, Conversation, ChatNotification } from '../../shared/types';

/**
 * Hook for managing auction public chat in mobile app
 */
export function useAuctionChat(auctionId: string, userId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!auctionId) return;

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToAuctionChat(auctionId, (newMessages) => {
      setMessages(newMessages);
      setLoading(false);
      
      // Mark messages as read
      if (userId) {
        newMessages.forEach((msg) => {
          if (msg.senderId !== userId && (!msg.readBy || !msg.readBy.includes(userId))) {
            markMessageAsRead(msg.id, userId, true, auctionId).catch(console.error);
          }
        });
      }
    });

    return () => unsubscribe();
  }, [auctionId, userId]);

  const handleSearch = useCallback(
    async (term: string) => {
      if (!term.trim()) {
        setSearchResults([]);
        return;
      }

      setSearching(true);
      try {
        const results = await searchMessages(auctionId, term, true, auctionId);
        setSearchResults(results);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setSearching(false);
      }
    },
    [auctionId]
  );

  const sendMessage = useCallback(
    async (message: string, isAnonymous: boolean = true) => {
      if (!userId || !message.trim()) return;

      setSending(true);
      setError(null);

      try {
        await sendAuctionChatMessage(auctionId, userId, message.trim(), isAnonymous);
      } catch (err: any) {
        setError(err.message || 'Failed to send message');
        throw err;
      } finally {
        setSending(false);
      }
    },
    [auctionId, userId]
  );

  const editChatMessage = useCallback(
    async (messageId: string, newMessage: string) => {
      if (!userId || !newMessage.trim()) return;

      try {
        await editMessage(messageId, newMessage.trim(), true, auctionId);
      } catch (err: any) {
        setError(err.message || 'Failed to edit message');
        throw err;
      }
    },
    [auctionId, userId]
  );

  const deleteChatMessage = useCallback(
    async (messageId: string) => {
      if (!userId) return;

      try {
        await deleteMessage(messageId, true, auctionId);
      } catch (err: any) {
        setError(err.message || 'Failed to delete message');
        throw err;
      }
    },
    [auctionId, userId]
  );

  return {
    messages,
    loading,
    error,
    sending,
    sendMessage,
    editMessage: editChatMessage,
    deleteMessage: deleteChatMessage,
    searchTerm,
    setSearchTerm,
    searchResults,
    searching,
    handleSearch,
  };
}

/**
 * Hook for managing private conversations in mobile app
 */
export function useConversation(conversationId: string | null, userId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [searching, setSearching] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToConversationMessages(conversationId, (newMessages) => {
      setMessages(newMessages);
      setLoading(false);
      
      // Mark messages as read
      if (userId) {
        newMessages.forEach((msg) => {
          if (msg.senderId !== userId && (!msg.readBy || !msg.readBy.includes(userId))) {
            markMessageAsRead(msg.id, userId, false, conversationId).catch(console.error);
          }
        });
      }
    });

    // Mark conversation as read when opening
    if (userId) {
      markConversationAsRead(conversationId, userId).catch(console.error);
    }

    return () => unsubscribe();
  }, [conversationId, userId]);

  // Subscribe to typing indicators
  useEffect(() => {
    if (!conversationId) return;

    const unsubscribe = subscribeToTypingIndicators(conversationId, (users) => {
      // Filter out current user
      setTypingUsers(users.filter(id => id !== userId));
    });

    return () => unsubscribe();
  }, [conversationId, userId]);

  const handleTyping = useCallback(() => {
    if (!conversationId || !userId) return;

    // Set typing indicator
    setTypingIndicator(conversationId, userId, true).catch(console.error);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to clear typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setTypingIndicator(conversationId, userId, false).catch(console.error);
    }, 3000);
  }, [conversationId, userId]);

  const handleSearch = useCallback(
    async (term: string) => {
      if (!conversationId || !term.trim()) {
        setSearchResults([]);
        return;
      }

      setSearching(true);
      try {
        const results = await searchMessages(conversationId, term, false);
        setSearchResults(results);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setSearching(false);
      }
    },
    [conversationId]
  );

  const sendMessage = useCallback(
    async (message: string) => {
      if (!userId || !conversationId || !message.trim()) return;

      setSending(true);
      setError(null);

      try {
        await sendPrivateMessage(conversationId, userId, message.trim());
      } catch (err: any) {
        setError(err.message || 'Failed to send message');
        throw err;
      } finally {
        setSending(false);
      }
    },
    [conversationId, userId]
  );

  const editChatMessage = useCallback(
    async (messageId: string, newMessage: string) => {
      if (!userId || !conversationId || !newMessage.trim()) return;

      try {
        await editMessage(messageId, newMessage.trim(), false, conversationId);
      } catch (err: any) {
        setError(err.message || 'Failed to edit message');
        throw err;
      }
    },
    [conversationId, userId]
  );

  const deleteChatMessage = useCallback(
    async (messageId: string) => {
      if (!userId || !conversationId) return;

      try {
        await deleteMessage(messageId, false, conversationId);
      } catch (err: any) {
        setError(err.message || 'Failed to delete message');
        throw err;
      }
    },
    [conversationId, userId]
  );

  return {
    messages,
    loading,
    error,
    sending,
    sendMessage,
    editMessage: editChatMessage,
    deleteMessage: deleteChatMessage,
    typingUsers,
    handleTyping,
    searchTerm,
    setSearchTerm,
    searchResults,
    searching,
    handleSearch,
  };
}

/**
 * Hook for managing user's conversations list in mobile app
 */
export function useConversations(userId: string | null) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setConversations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const unsubscribe = subscribeToUserConversations(userId, (newConversations) => {
        setConversations(newConversations);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err: any) {
      setError(err.message || 'Failed to load conversations');
      setLoading(false);
    }
  }, [userId]);

  const startConversation = useCallback(
    async (
      sellerId: string,
      auctionId?: string,
      productId?: string,
      isAdminSupport: boolean = false
    ): Promise<string> => {
      if (!userId) throw new Error('User not authenticated');

      try {
        const conversationId = await createOrGetConversation(
          userId,
          sellerId,
          auctionId,
          productId,
          isAdminSupport
        );
        return conversationId;
      } catch (err: any) {
        setError(err.message || 'Failed to start conversation');
        throw err;
      }
    },
    [userId]
  );

  const markAsRead = useCallback(
    async (conversationId: string) => {
      if (!userId) return;

      try {
        await markConversationAsRead(conversationId, userId);
      } catch (err: any) {
        console.error('Failed to mark conversation as read:', err);
      }
    },
    [userId]
  );

  const totalUnreadCount = conversations.reduce((total, conv) => {
    return total + (userId && conv.unreadCount ? ((conv.unreadCount as any)[userId] || 0) : 0);
  }, 0);

  return {
    conversations,
    loading,
    error,
    startConversation,
    markAsRead,
    totalUnreadCount,
  };
}

/**
 * Hook for managing notifications in mobile app
 */
export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<ChatNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeToNotifications(userId, (newNotifications, count) => {
      setNotifications(newNotifications);
      setUnreadCount(count);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const requestPermission = useCallback(async () => {
    const granted = await requestNotificationPermission();
    setPermissionGranted(granted);
    return granted;
  }, []);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!userId) return;
      try {
        await markNotificationAsRead(userId, notificationId);
      } catch (err) {
        console.error('Failed to mark notification as read:', err);
      }
    },
    [userId]
  );

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    try {
      await markAllNotificationsAsRead(userId);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  }, [userId]);

  return {
    notifications,
    unreadCount,
    loading,
    permissionGranted,
    requestPermission,
    markAsRead,
    markAllAsRead,
  };
}
