import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import type { AuctionNotification, ChatNotification } from '@shared/types';
import { colors } from '../styles/sharedStyles';

function getTypeLabel(type: ChatNotification['type'] | AuctionNotification['type']): string {
  switch (type) {
    case 'outbid':
      return 'Depășit la licitație';
    case 'auction_won':
      return 'Licitație câștigată';
    case 'auction_ended_no_win':
      return 'Licitație încheiată';
    case 'new_message':
      return 'Mesaj nou';
    case 'conversation_started':
      return 'Conversație nouă';
    case 'message_read':
      return 'Mesaj citit';
    case 'system':
      return 'Actualizare sistem';
    default:
      return 'Notificare';
  }
}

export type NotificationItemProps = {
  notification: ChatNotification | AuctionNotification;
  onPress: () => void;
  onMarkAsRead: () => void;
  disabled?: boolean;
};

export default function NotificationItem({
  notification,
  onPress,
  onMarkAsRead,
  disabled,
}: NotificationItemProps) {
  const relativeTime = useMemo(() => {
    try {
      return formatDistanceToNow(notification.createdAt, { addSuffix: true, locale: ro });
    } catch {
      return '';
    }
  }, [notification.createdAt]);

  const typeLabel = useMemo(() => getTypeLabel(notification.type as ChatNotification['type']), [notification.type]);
  const unread = !notification.read;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      disabled={disabled}
      style={[styles.card, unread ? styles.cardUnread : styles.cardRead, disabled && styles.cardDisabled]}
      accessibilityRole="button"
      accessibilityLabel={`Notificare: ${typeLabel}`}
    >
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={styles.topRow}>
            <View style={styles.typeRow}>
              {unread && <View style={styles.unreadDot} />}
              <Text style={styles.typeText} numberOfLines={1}>
                {typeLabel}
              </Text>
            </View>
            <Text style={styles.timeText}>{relativeTime}</Text>
          </View>

          {'title' in notification && notification.title ? (
            <Text style={styles.titleText} numberOfLines={1}>
              {notification.title}
            </Text>
          ) : notification.auctionTitle ? (
            <Text style={styles.titleText} numberOfLines={1}>
              {notification.auctionTitle}
            </Text>
          ) : null}

          <Text style={styles.messageText} numberOfLines={3}>
            {notification.message}
          </Text>

          {typeof notification.bidAmount === 'number' ? (
            <Text style={styles.metaText}>Sumă: {notification.bidAmount.toFixed(2)}</Text>
          ) : null}
        </View>

        <View style={styles.right}>
          {unread ? (
            <TouchableOpacity
              onPress={onMarkAsRead}
              style={styles.markReadButton}
              accessibilityRole="button"
              accessibilityLabel="Marchează ca citit"
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Ionicons name="checkmark-done" size={18} color={colors.primary} />
            </TouchableOpacity>
          ) : (
            <Ionicons name="checkmark" size={18} color={colors.textSecondary} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    backgroundColor: colors.cardBackground,
  },
  cardUnread: {
    borderColor: 'rgba(231, 183, 60, 0.55)',
  },
  cardRead: {
    borderColor: 'rgba(231, 183, 60, 0.18)',
    opacity: 0.75,
  },
  cardDisabled: {
    opacity: 0.6,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  left: {
    flex: 1,
  },
  right: {
    width: 28,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#60A5FA',
  },
  typeText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 13,
    flex: 1,
  },
  timeText: {
    color: colors.textSecondary,
    fontSize: 12,
    flexShrink: 0,
  },
  titleText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  messageText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  metaText: {
    marginTop: 8,
    color: 'rgba(148, 163, 184, 0.85)',
    fontSize: 12,
  },
  markReadButton: {
    padding: 2,
  },
});


