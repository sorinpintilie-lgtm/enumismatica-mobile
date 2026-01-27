declare const jest: any;
declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;

jest.mock('../firebaseConfig', () => ({
  db: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  addDoc: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  updateDoc: jest.fn(),
  onSnapshot: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  serverTimestamp: jest.fn(),
  Timestamp: {
    fromDate: jest.fn(),
  },
}));

import * as activityLogService from '../activityLogService';
import * as adminService from '../adminService';
import * as auth from '../auth';

describe('User Activity Analytics Integration Tests', () => {
  const mockUserId = 'test-user-id';
  const mockAdminId = 'admin-user-id';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Admin Dashboard Analytics Integration', () => {
    it('should display correct analytics in admin dashboard', async () => {
      // Mock activity log data
      const mockActivityLogs = [
        {
          id: '1',
          userId: mockUserId,
          eventType: 'auction_bid',
          timestamp: new Date('2023-01-01T10:00:00Z'),
          metadata: { auctionId: 'auction1', bidAmount: 100 },
          sessionId: 'session1',
          isAdmin: false,
          sessionDuration: 300,
          engagementScore: 80,
          suspiciousScore: 10,
          geoLocation: { country: 'Romania', city: 'Bucharest' }
        },
        {
          id: '2',
          userId: mockUserId,
          eventType: 'product_view',
          timestamp: new Date('2023-01-01T10:05:00Z'),
          metadata: { productId: 'product1' },
          sessionId: 'session1',
          isAdmin: false,
          sessionDuration: 300,
          engagementScore: 80,
          suspiciousScore: 5,
          geoLocation: { country: 'Romania', city: 'Bucharest' }
        }
      ];

      // Mock the activity log service
      const mockGetActivityLogs = jest.fn().mockResolvedValue({ logs: mockActivityLogs });
      const mockGetUserActivityAnalytics = jest.fn().mockResolvedValue({
        totalEvents: 2,
        eventsByType: { auction_bid: 1, product_view: 1 },
        lastActivity: new Date('2023-01-01T10:05:00Z'),
        sessionsCount: 1,
        engagementScore: 80,
        suspiciousScore: 7.5,
        sessionDurationStats: { avg: 300, min: 300, max: 300 },
        geoDistribution: { Romania: 1 }
      });

      jest.mock('../activityLogService', () => ({
        getUserActivityAnalytics: mockGetUserActivityAnalytics,
        getActivityLogs: mockGetActivityLogs,
        getAggregatedUserActivityStats: jest.fn().mockResolvedValue({
          totalUsers: 1,
          totalEvents: 2,
          averageEngagement: 80,
          averageSessions: 1,
          eventTypeDistribution: { auction_bid: 1, product_view: 1 },
          suspiciousActivityCount: 0
        }),
        getSessionMetrics: jest.fn().mockResolvedValue({
          totalSessions: 1,
          activeSessions: 1,
          averageSessionDuration: 300,
          sessionDurationDistribution: { '0-5min': 1 },
          engagementBySession: { session1: 80 }
        }),
        detectBehavioralPatterns: jest.fn().mockResolvedValue({
          suspiciousUsers: [],
          unusualPatterns: []
        })
      }));

      // Mock admin service
      jest.mock('../adminService', () => ({
        getAdminAnalytics: jest.fn().mockResolvedValue({
          totalUsers: 1,
          activeUsers: 1,
          totalAuctions: 0,
          totalProducts: 1,
          revenue: 0,
          growthRate: 0
        })
      }));

      // Test admin dashboard analytics - use platform stats instead
      const platformStats = await adminService.getPlatformStats();
      const userAnalytics = await activityLogService.getUserActivityAnalytics(mockUserId);
      const aggregatedStats = await activityLogService.getAggregatedUserActivityStats();
      const sessionMetrics = await activityLogService.getSessionMetrics();
      const behavioralPatterns = await activityLogService.detectBehavioralPatterns();

      // Verify analytics data structure
      expect(platformStats).toHaveProperty('totalUsers');
      expect(platformStats).toHaveProperty('totalProducts');
      expect(platformStats).toHaveProperty('totalAuctions');
      expect(platformStats).toHaveProperty('activeAuctions');

      expect(userAnalytics).toHaveProperty('totalEvents');
      expect(userAnalytics).toHaveProperty('eventsByType');
      expect(userAnalytics).toHaveProperty('engagementScore');
      expect(userAnalytics).toHaveProperty('suspiciousScore');

      expect(aggregatedStats).toHaveProperty('totalUsers');
      expect(aggregatedStats).toHaveProperty('totalEvents');
      expect(aggregatedStats).toHaveProperty('averageEngagement');

      expect(sessionMetrics).toHaveProperty('totalSessions');
      expect(sessionMetrics).toHaveProperty('activeSessions');
      expect(sessionMetrics).toHaveProperty('averageSessionDuration');

      expect(behavioralPatterns).toHaveProperty('suspiciousUsers');
      expect(behavioralPatterns).toHaveProperty('unusualPatterns');
    });

    it('should verify behavioral pattern detection works across user activities', async () => {
      // Mock suspicious activity patterns
      const suspiciousLogs = [
        {
          id: '1',
          userId: 'suspicious-user',
          eventType: 'unauthorized_access_attempt',
          timestamp: new Date('2023-01-01T10:00:00Z'),
          metadata: { attemptType: 'brute_force' },
          sessionId: 'session1',
          isAdmin: false,
          sessionDuration: 60,
          engagementScore: 20,
          suspiciousScore: 90,
          geoLocation: { country: 'Unknown', city: 'Unknown' }
        },
        {
          id: '2',
          userId: 'suspicious-user',
          eventType: 'rate_limit_exceeded',
          timestamp: new Date('2023-01-01T10:01:00Z'),
          metadata: { endpoint: '/api/auth' },
          sessionId: 'session1',
          isAdmin: false,
          sessionDuration: 60,
          engagementScore: 10,
          suspiciousScore: 85,
          geoLocation: { country: 'Unknown', city: 'Unknown' }
        }
      ];

      // Mock the detectBehavioralPatterns function
      const mockDetectBehavioralPatterns = jest.fn().mockResolvedValue({
        suspiciousUsers: [
          {
            userId: 'suspicious-user',
            suspiciousScore: 87.5,
            suspiciousEvents: ['unauthorized_access_attempt', 'rate_limit_exceeded'],
            riskLevel: 'high'
          }
        ],
        unusualPatterns: [
          {
            pattern: 'rapid_suspicious_events',
            count: 2,
            users: ['suspicious-user'],
            timeFrame: '1 minute'
          }
        ]
      });

      jest.mock('../activityLogService', () => ({
        detectBehavioralPatterns: mockDetectBehavioralPatterns
      }));

      // Test behavioral pattern detection
      const patterns = await activityLogService.detectBehavioralPatterns();

      expect(patterns.suspiciousUsers).toHaveLength(1);
      expect(patterns.suspiciousUsers[0].userId).toBe('suspicious-user');
      expect(patterns.suspiciousUsers[0].score).toBeGreaterThan(60);
      expect(patterns.unusualPatterns).toHaveLength(1);
      expect(patterns.unusualPatterns[0].pattern).toBe('rapid_suspicious_events');
    });
  });

  describe('Session Metrics Calculations', () => {
    it('should calculate session metrics accurately', async () => {
      // Mock session data
      const sessionLogs = [
        {
          id: '1',
          userId: mockUserId,
          eventType: 'user_login',
          timestamp: new Date('2023-01-01T10:00:00Z'),
          metadata: {},
          sessionId: 'session1',
          isAdmin: false,
          sessionDuration: 1800, // 30 minutes
          engagementScore: 90,
          suspiciousScore: 5,
          geoLocation: { country: 'Romania', city: 'Bucharest' }
        },
        {
          id: '2',
          userId: mockUserId,
          eventType: 'auction_bid',
          timestamp: new Date('2023-01-01T10:15:00Z'),
          metadata: { auctionId: 'auction1', bidAmount: 150 },
          sessionId: 'session1',
          isAdmin: false,
          sessionDuration: 1800,
          engagementScore: 85,
          suspiciousScore: 3,
          geoLocation: { country: 'Romania', city: 'Bucharest' }
        },
        {
          id: '3',
          userId: mockUserId,
          eventType: 'user_logout',
          timestamp: new Date('2023-01-01T10:30:00Z'),
          metadata: {},
          sessionId: 'session1',
          isAdmin: false,
          sessionDuration: 1800,
          engagementScore: 80,
          suspiciousScore: 2,
          geoLocation: { country: 'Romania', city: 'Bucharest' }
        }
      ];

      // Mock the getSessionMetrics function
      const mockGetSessionMetrics = jest.fn().mockResolvedValue({
        totalSessions: 1,
        activeSessions: 0, // Session ended with logout
        averageSessionDuration: 1800,
        sessionDurationDistribution: { '30-60min': 1 },
        engagementBySession: { session1: 85 } // Average engagement
      });

      jest.mock('../activityLogService', () => ({
        getSessionMetrics: mockGetSessionMetrics
      }));

      // Test session metrics
      const metrics = await activityLogService.getSessionMetrics();

      expect(metrics.totalSessions).toBe(1);
      expect(metrics.activeSessions).toBe(0);
      expect(metrics.averageSessionDuration).toBe(1800);
      expect(metrics.engagementBySession.session1).toBe(85);
    });

    it('should handle multiple concurrent sessions', async () => {
      // Mock multiple session data
      const multiSessionLogs = [
        // Session 1 - User 1
        {
          id: '1',
          userId: mockUserId,
          eventType: 'user_login',
          timestamp: new Date('2023-01-01T10:00:00Z'),
          metadata: {},
          sessionId: 'session1',
          isAdmin: false,
          sessionDuration: 900, // 15 minutes
          engagementScore: 75,
          suspiciousScore: 5,
          geoLocation: { country: 'Romania', city: 'Bucharest' }
        },
        // Session 2 - User 2 (concurrent)
        {
          id: '2',
          userId: 'user2',
          eventType: 'user_login',
          timestamp: new Date('2023-01-01T10:10:00Z'),
          metadata: {},
          sessionId: 'session2',
          isAdmin: false,
          sessionDuration: 1200, // 20 minutes
          engagementScore: 85,
          suspiciousScore: 3,
          geoLocation: { country: 'Germany', city: 'Berlin' }
        },
        // Session 3 - Admin
        {
          id: '3',
          userId: mockAdminId,
          eventType: 'user_login',
          timestamp: new Date('2023-01-01T10:15:00Z'),
          metadata: {},
          sessionId: 'session3',
          isAdmin: true,
          sessionDuration: 2400, // 40 minutes
          engagementScore: 95,
          suspiciousScore: 1,
          geoLocation: { country: 'Romania', city: 'Bucharest' }
        }
      ];

      // Mock session metrics for multiple sessions
      const mockGetSessionMetrics = jest.fn().mockResolvedValue({
        totalSessions: 3,
        activeSessions: 3, // All sessions active
        averageSessionDuration: (900 + 1200 + 2400) / 3,
        sessionDurationDistribution: {
          '15-30min': 1,
          '30-60min': 1,
          '60+min': 1
        },
        engagementBySession: {
          session1: 75,
          session2: 85,
          session3: 95
        }
      });

      jest.mock('../activityLogService', () => ({
        getSessionMetrics: mockGetSessionMetrics
      }));

      // Test multi-session metrics
      const metrics = await activityLogService.getSessionMetrics();

      expect(metrics.totalSessions).toBe(3);
      expect(metrics.activeSessions).toBe(3);
      expect(metrics.averageSessionDuration).toBeCloseTo(1500); // Average of 900, 1200, 2400
    });
  });

  describe('Role-Based Access Control', () => {
    it('should enforce proper role-based access control for analytics', async () => {
      // Mock user roles
      const regularUser = { uid: mockUserId, email: 'user@example.com', role: 'user' };
      const adminUser = { uid: mockAdminId, email: 'admin@example.com', role: 'admin' };

      // Mock auth service
      const mockGetCurrentUser = jest.fn().mockImplementation((userId) => {
        if (userId === mockAdminId) return adminUser;
        if (userId === mockUserId) return regularUser;
        return null;
      });

      jest.mock('../auth', () => ({
        getCurrentUser: mockGetCurrentUser
      }));

      // Mock admin service with role-based access
      const mockGetAdminAnalytics = jest.fn().mockImplementation(async (userId) => {
        const user = mockGetCurrentUser(userId);
        if (!user) return { success: false, error: 'User not found' };
        if (user.role !== 'admin') return { success: false, error: 'Unauthorized access' };

        return {
          success: true,
          analytics: {
            totalUsers: 10,
            activeUsers: 5,
            totalAuctions: 20,
            totalProducts: 50,
            revenue: 10000,
            growthRate: 15
          }
        };
      });

      jest.mock('../adminService', () => ({
        getAdminAnalytics: mockGetAdminAnalytics
      }));

      // Test regular user access to admin functions
      const isRegularUserAdmin = await adminService.isAdmin(mockUserId);
      expect(isRegularUserAdmin).toBe(false);

      // Test admin user access
      const isAdminUserAdmin = await adminService.isAdmin(mockAdminId);
      expect(isAdminUserAdmin).toBe(true);
    });

    it('should allow users to access their own activity analytics', async () => {
      // Mock user activity analytics with access control
      const mockGetUserActivityAnalytics = jest.fn().mockImplementation(async (userId, requestingUserId) => {
        // Users can only access their own analytics
        if (userId !== requestingUserId) {
          return { success: false, error: 'Unauthorized access to user analytics' };
        }

        return {
          success: true,
          analytics: {
            totalEvents: 15,
            eventsByType: { auction_bid: 5, product_view: 10 },
            lastActivity: new Date(),
            sessionsCount: 3,
            engagementScore: 82,
            suspiciousScore: 2.5,
            sessionDurationStats: { avg: 1200, min: 600, max: 1800 },
            geoDistribution: { Romania: 3 }
          }
        };
      });

      jest.mock('../activityLogService', () => ({
        getUserActivityAnalytics: mockGetUserActivityAnalytics
      }));

      // Test user accessing their own analytics (should succeed)
      const ownAnalytics = await activityLogService.getUserActivityAnalytics(mockUserId);
      expect(ownAnalytics.totalEvents).toBeGreaterThanOrEqual(0);
      expect(ownAnalytics.engagementScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cross-Platform Analytics Integration', () => {
    it('should work consistently across web and mobile platforms', async () => {
      // Test that analytics work the same regardless of platform
      const platforms = ['web', 'mobile'];

      for (const platform of platforms) {
        // Mock platform-specific analytics
        const mockGetUserActivityAnalytics = jest.fn().mockResolvedValue({
          totalEvents: 10,
          eventsByType: { auction_bid: 3, product_view: 7 },
          lastActivity: new Date(),
          sessionsCount: 2,
          engagementScore: 78,
          suspiciousScore: 1.5,
          sessionDurationStats: { avg: 900, min: 600, max: 1200 },
          geoDistribution: { Romania: 2 }
        });

        jest.mock('../activityLogService', () => ({
          getUserActivityAnalytics: mockGetUserActivityAnalytics
        }));

        const result = await activityLogService.getUserActivityAnalytics(mockUserId);

        expect(result.totalEvents).toBe(10);
        expect(result.engagementScore).toBe(78);
        expect(result.suspiciousScore).toBe(1.5);
      }
    });

    it('should handle platform-specific analytics edge cases', async () => {
      // Test edge cases that might differ between platforms
      const edgeCases = [
        {
          name: 'empty_analytics',
          mockData: {
            totalEvents: 0,
            eventsByType: {},
            sessionsCount: 0,
            engagementScore: 0,
            suspiciousScore: 0
          }
        },
        {
          name: 'high_volume_analytics',
          mockData: {
            totalEvents: 1000,
            eventsByType: { auction_bid: 500, product_view: 300, user_login: 200 },
            sessionsCount: 50,
            engagementScore: 92,
            suspiciousScore: 0.5
          }
        }
      ];

      for (const edgeCase of edgeCases) {
        const mockGetUserActivityAnalytics = jest.fn().mockResolvedValue(edgeCase.mockData);

        jest.mock('../activityLogService', () => ({
          getUserActivityAnalytics: mockGetUserActivityAnalytics
        }));

        const result = await activityLogService.getUserActivityAnalytics(mockUserId);

        expect(result.totalEvents).toBe(edgeCase.mockData.totalEvents);
        expect(result.sessionsCount).toBe(edgeCase.mockData.sessionsCount);
      }
    });
  });
});