declare const describe: any;
declare const it: any;
declare const expect: any;

import { countUnreadAuctionNotifications } from '../utils/auctionNotificationUtils';

describe('auctionNotificationUtils', () => {
  it('counts unread notifications', () => {
    const count = countUnreadAuctionNotifications([
      { read: false },
      { read: true },
      { read: false },
      { read: false },
    ]);
    expect(count).toBe(3);
  });

  it('returns 0 for empty list', () => {
    expect(countUnreadAuctionNotifications([])).toBe(0);
  });
});

