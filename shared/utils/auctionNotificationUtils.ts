export type UnreadableNotification = { read: boolean };

/**
 * Pure helper used by both mobile and shared layers.
 */
export function countUnreadAuctionNotifications(notifications: UnreadableNotification[]): number {
  let count = 0;
  for (const n of notifications) {
    if (!n.read) count += 1;
  }
  return count;
}

