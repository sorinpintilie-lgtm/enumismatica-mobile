declare const jest: any;
declare const describe: any;
declare const it: any;
declare const expect: any;

import { isAuctionEligibleForPullbackData, isProductEligibleForPullbackData } from '../pullbackEligibility';

describe('pullback eligibility (pure helpers)', () => {
  describe('isProductEligibleForPullbackData', () => {
    it('returns true for owner + unsold + not pulled back', () => {
      expect(
        isProductEligibleForPullbackData(
          { ownerId: 'u1', isSold: false, isPulledBack: false },
          'u1',
        ),
      ).toBe(true);
    });

    it('returns false when not owner / sold / already pulled back', () => {
      expect(
        isProductEligibleForPullbackData(
          { ownerId: 'u1', isSold: false, isPulledBack: false },
          'u2',
        ),
      ).toBe(false);
      expect(
        isProductEligibleForPullbackData(
          { ownerId: 'u1', isSold: true, isPulledBack: false },
          'u1',
        ),
      ).toBe(false);
      expect(
        isProductEligibleForPullbackData(
          { ownerId: 'u1', isSold: false, isPulledBack: true },
          'u1',
        ),
      ).toBe(false);
    });
  });

  describe('isAuctionEligibleForPullbackData', () => {
    it('returns true for owner + ended + no winner + not pulled back', () => {
      expect(
        isAuctionEligibleForPullbackData(
          { ownerId: 'u1', status: 'ended', winnerId: null, isPulledBack: false },
          'u1',
        ),
      ).toBe(true);
    });

    it('returns false when active / has winner / already pulled back / not owner', () => {
      expect(
        isAuctionEligibleForPullbackData(
          { ownerId: 'u1', status: 'active', winnerId: null, isPulledBack: false },
          'u1',
        ),
      ).toBe(false);
      expect(
        isAuctionEligibleForPullbackData(
          { ownerId: 'u1', status: 'ended', winnerId: 'someone', isPulledBack: false },
          'u1',
        ),
      ).toBe(false);
      expect(
        isAuctionEligibleForPullbackData(
          { ownerId: 'u1', status: 'ended', winnerId: null, isPulledBack: true },
          'u1',
        ),
      ).toBe(false);
      expect(
        isAuctionEligibleForPullbackData(
          { ownerId: 'u1', status: 'ended', winnerId: null, isPulledBack: false },
          'u2',
        ),
      ).toBe(false);
    });
  });
});

