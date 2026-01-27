import { useState, useEffect } from 'react';
import {
  subscribeToAuctionNotifications,
  markAuctionNotificationAsRead,
  markAllAuctionNotificationsAsRead,
} from '@shared/auctionNotificationService';
import { AuctionNotification } from '@shared/types';

/**
 * Hook for managing auction notifications in mobile app
 */
export function useAuctionNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<AuctionNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeToAuctionNotifications(userId, (newNotifications, count) => {
      setNotifications(newNotifications);
      setUnreadCount(count);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const markAsRead = async (notificationId: string) => {
    if (!userId) return;
    await markAuctionNotificationAsRead(userId, notificationId);
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    await markAllAuctionNotificationsAsRead(userId);
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
  };
}

