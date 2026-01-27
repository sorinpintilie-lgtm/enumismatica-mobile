declare const jest: any;
declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;

import {
  calculateEngagementScore,
  calculateSuspiciousScore,
  getUserActivityAnalytics,
  getAggregatedUserActivityStats,
  detectBehavioralPatterns,
  getSessionMetrics,
  ActivityLog,
  ActivityEventType
} from '../activityLogService';
import { Timestamp } from 'firebase/firestore';

// Mock data
const mockActivityLogs: ActivityLog[] = [
  {
    id: '1',
    userId: 'user1',
    eventType: 'auction_bid' as ActivityEventType,
    timestamp: Timestamp.fromDate(new Date('2023-01-01T10:00:00Z')),
    metadata: {},
    sessionId: 'session1',
    isAdmin: false,
    sessionDuration: 300,
    engagementScore: 80,
    suspiciousScore: 10,
    geoLocation: { country: 'Romania', city: 'Bucharest' }
  },
  {
    id: '2',
    userId: 'user1',
    eventType: 'product_view' as ActivityEventType,
    timestamp: Timestamp.fromDate(new Date('2023-01-01T10:05:00Z')),
    metadata: {},
    sessionId: 'session1',
    isAdmin: false,
    sessionDuration: 300,
    engagementScore: 80,
    suspiciousScore: 5,
    geoLocation: { country: 'Romania', city: 'Bucharest' }
  },
  {
    id: '3',
    userId: 'user1',
    eventType: 'error_occurred' as ActivityEventType,
    timestamp: Timestamp.fromDate(new Date('2023-01-01T10:10:00Z')),
    metadata: { errorCode: 'NETWORK_ERROR' },
    sessionId: 'session1',
    isAdmin: false,
    sessionDuration: 300,
    engagementScore: 80,
    suspiciousScore: 30,
    geoLocation: { country: 'Romania', city: 'Bucharest' }
  },
  {
    id: '4',
    userId: 'user2',
    eventType: 'user_login' as ActivityEventType,
    timestamp: Timestamp.fromDate(new Date('2023-01-02T15:00:00Z')),
    metadata: {},
    sessionId: 'session2',
    isAdmin: false,
    sessionDuration: 600,
    engagementScore: 60,
    suspiciousScore: 5,
    geoLocation: { country: 'Germany', city: 'Berlin' }
  }
];

describe('Activity Log Service - Analytics Functions', () => {
  describe('calculateEngagementScore', () => {
    it('should return 0 for empty logs', () => {
      const score = calculateEngagementScore([]);
      expect(score).toBe(0);
    });

    it('should calculate engagement score correctly', () => {
      const score = calculateEngagementScore(mockActivityLogs);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should give higher scores to high-engagement events', () => {
      const highEngagementLogs = [
        { ...mockActivityLogs[0], eventType: 'auction_create' as ActivityEventType },
        { ...mockActivityLogs[1], eventType: 'product_create' as ActivityEventType },
        { ...mockActivityLogs[2], eventType: 'conversation_start' as ActivityEventType }
      ];

      const score = calculateEngagementScore(highEngagementLogs);
      expect(score).toBeGreaterThan(50);
    });
  });

  describe('calculateSuspiciousScore', () => {
    it('should return 0 for empty logs', () => {
      const score = calculateSuspiciousScore([]);
      expect(score).toBe(0);
    });

    it('should detect suspicious activity patterns', () => {
      const suspiciousLogs = [
        { ...mockActivityLogs[2], eventType: 'unauthorized_access_attempt' as ActivityEventType },
        { ...mockActivityLogs[2], eventType: 'rate_limit_exceeded' as ActivityEventType },
        { ...mockActivityLogs[2], eventType: 'suspicious_activity' as ActivityEventType }
      ];

      const score = calculateSuspiciousScore(suspiciousLogs);
      expect(score).toBeGreaterThan(20);
    });

    it('should detect rapid sequence of events', () => {
      const rapidLogs = [
        {
          ...mockActivityLogs[0],
          timestamp: Timestamp.fromDate(new Date('2023-01-01T10:00:00Z'))
        },
        {
          ...mockActivityLogs[1],
          timestamp: Timestamp.fromDate(new Date('2023-01-01T10:00:00.500Z')) // 500ms later
        },
        {
          ...mockActivityLogs[2],
          timestamp: Timestamp.fromDate(new Date('2023-01-01T10:00:01Z')) // 1s later
        }
      ];

      const score = calculateSuspiciousScore(rapidLogs);
      expect(score).toBeGreaterThan(5);
    });
  });

  describe('getUserActivityAnalytics', () => {
    it('should return correct analytics structure', async () => {
      // Mock the getActivityLogs function
      const mockGetActivityLogs = jest.fn().mockResolvedValue({ logs: mockActivityLogs });

      // Replace the actual implementation with our mock
      jest.doMock('../activityLogService', async () => {
        const actual = await jest.requireActual('../activityLogService');
        return {
          ...actual,
          getActivityLogs: mockGetActivityLogs
        };
      });

      const analytics = await getUserActivityAnalytics('user1');

      expect(analytics).toHaveProperty('totalEvents');
      expect(analytics).toHaveProperty('eventsByType');
      expect(analytics).toHaveProperty('lastActivity');
      expect(analytics).toHaveProperty('sessionsCount');
      expect(analytics).toHaveProperty('engagementScore');
      expect(analytics).toHaveProperty('suspiciousScore');
      expect(analytics).toHaveProperty('sessionDurationStats');
      expect(analytics).toHaveProperty('geoDistribution');

      expect(analytics.totalEvents).toBe(3);
      expect(analytics.sessionsCount).toBe(1);
    });

    it('should handle empty logs gracefully', async () => {
      const analytics = await getUserActivityAnalytics('nonexistent-user');
      expect(analytics.totalEvents).toBe(0);
      expect(analytics.engagementScore).toBe(0);
    });
  });

  describe('getAggregatedUserActivityStats', () => {
    it('should return aggregated statistics', async () => {
      const stats = await getAggregatedUserActivityStats();
      expect(stats).toHaveProperty('totalUsers');
      expect(stats).toHaveProperty('totalEvents');
      expect(stats).toHaveProperty('averageEngagement');
      expect(stats).toHaveProperty('averageSessions');
      expect(stats).toHaveProperty('eventTypeDistribution');
      expect(stats).toHaveProperty('suspiciousActivityCount');
    });
  });

  describe('detectBehavioralPatterns', () => {
    it('should detect suspicious users', async () => {
      const patterns = await detectBehavioralPatterns();
      expect(patterns).toHaveProperty('suspiciousUsers');
      expect(patterns).toHaveProperty('unusualPatterns');
      expect(Array.isArray(patterns.suspiciousUsers)).toBe(true);
      expect(Array.isArray(patterns.unusualPatterns)).toBe(true);
    });
  });

  describe('getSessionMetrics', () => {
    it('should return session metrics', async () => {
      const metrics = await getSessionMetrics();
      expect(metrics).toHaveProperty('totalSessions');
      expect(metrics).toHaveProperty('activeSessions');
      expect(metrics).toHaveProperty('averageSessionDuration');
      expect(metrics).toHaveProperty('sessionDurationDistribution');
      expect(metrics).toHaveProperty('engagementBySession');
    });
  });
});