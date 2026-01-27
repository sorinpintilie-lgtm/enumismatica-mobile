import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
  onSnapshot,
  QueryConstraint,
  startAfter,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebaseConfig';

export type ActivityEventType =
  // Authentication Events
  | 'user_login'
  | 'user_logout'
  | 'user_register'
  | 'password_reset_request'
  | 'password_reset_complete'
  | 'email_verification'
  // Navigation Events
  | 'page_view'
  | 'page_leave'
    // Product Events
    | 'product_view'
    | 'product_search'
    | 'product_filter'
    | 'product_create'
    | 'product_update'
    | 'product_delete'
    | 'product_buy'
    // Auction Events
  | 'auction_view'
  | 'auction_create'
  | 'auction_bid'
  | 'auction_auto_bid_set'
  | 'auction_auto_bid_cancel'
  | 'auction_end'
  | 'auction_win'
  // Collection Events
  | 'collection_add'
  | 'collection_remove'
  | 'collection_view'
  // Chat Events
  | 'message_send'
  | 'message_read'
  | 'conversation_start'
  // Admin Events
  | 'admin_user_view'
  | 'admin_user_edit'
  | 'admin_user_delete'
  | 'admin_user_ban'
  | 'admin_user_unban'
  | 'admin_password_reset'
  | 'admin_role_change'
  | 'admin_auction_edit'
  | 'admin_auction_cancel'
  | 'admin_product_edit'
  | 'admin_product_delete'
  | 'admin_logs_view'
  // Error Events
  | 'error_occurred'
  | 'api_error'
  | 'payment_error'
  // Security Events
  | 'suspicious_activity'
  | 'rate_limit_exceeded'
  | 'unauthorized_access_attempt'
  // Admin Analytics Events
  | 'admin_analytics_access'
  | 'security_error';

export interface ActivityLogMetadata {
  // Page/Navigation
  page?: string;
  previousPage?: string;
  referrer?: string;
  
  // User Agent & Device
  userAgent?: string;
  browser?: string;
  os?: string;
  device?: string;
  screenResolution?: string;
  
  // Location (if available)
  ipAddress?: string;
  country?: string;
  city?: string;
  
  // Action specific data
  productId?: string;
  productName?: string;
  auctionId?: string;
  bidAmount?: number;
  searchTerm?: string;
  filters?: Record<string, any>;
  messageId?: string;
  conversationId?: string;
  targetUserId?: string;
  targetUserEmail?: string;
  
  // Error details
  errorMessage?: string;
  errorStack?: string;
  errorCode?: string;
  
  // Admin action details
  adminAction?: string;
  previousValue?: any;
  newValue?: any;
  reason?: string;
  
  // Performance metrics
  loadTime?: number;
  responseTime?: number;
  
  // Additional context
  [key: string]: any;
}

export interface ActivityLog {
  id?: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  eventType: ActivityEventType;
  timestamp: Timestamp;
  metadata: ActivityLogMetadata;
  sessionId?: string;
  isAdmin?: boolean;
  sessionDuration?: number; // Duration in seconds
  engagementScore?: number; // Calculated engagement metric (0-100)
  suspiciousScore?: number; // Anomaly detection score (0-100)
  geoLocation?: {
    country?: string;
    city?: string;
    coordinates?: [number, number];
  };
}

export interface ActivityLogFilter {
  userId?: string;
  eventType?: ActivityEventType | ActivityEventType[];
  startDate?: Date;
  endDate?: Date;
  isAdmin?: boolean;
  searchTerm?: string;
  limit?: number;
  lastDoc?: DocumentSnapshot;
}

// Get browser and device information
function getBrowserInfo(): { browser: string; os: string; device: string } {
  // Check if we're in a browser environment
  if (typeof navigator === 'undefined' || !navigator.userAgent) {
    return { browser: 'React Native', os: 'Mobile', device: 'Mobile' };
  }

  const ua = navigator.userAgent;
  let browser = 'Unknown';
  let os = 'Unknown';
  let device = 'Desktop';

  // Detect browser
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';
  else if (ua.includes('Opera')) browser = 'Opera';

  // Detect OS
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS')) os = 'iOS';

  // Detect device type
  if (/Mobile|Android|iPhone|iPad|iPod/.test(ua)) {
    device = /iPad|Tablet/.test(ua) ? 'Tablet' : 'Mobile';
  }

  return { browser, os, device };
}

// Generate session ID (stored in sessionStorage for web, memory for React Native)
function getSessionId(): string {
  // Check if we're in a browser environment with sessionStorage
  if (typeof sessionStorage !== 'undefined') {
    let sessionId = sessionStorage.getItem('activitySessionId');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('activitySessionId', sessionId);
    }
    return sessionId;
  } else {
    // For React Native or server environments, use a simple in-memory approach
    // In a real app, you'd want to use AsyncStorage or similar
    return `rn_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Log a user activity event
 */
export async function logActivity(
  userId: string,
  eventType: ActivityEventType,
  metadata: ActivityLogMetadata = {},
  userEmail?: string,
  userName?: string,
  isAdmin: boolean = false
): Promise<string> {
  // Skip activity logging in React Native for now to avoid Firebase compatibility issues
  if (typeof navigator === 'undefined' || !navigator.userAgent || navigator.userAgent.includes('React Native')) {
    return `skipped_${Date.now()}`;
  }

  try {
    const { browser, os, device } = getBrowserInfo();
    const sessionId = getSessionId();

    // Build metadata without undefined values for Firestore
    const baseMetadata: ActivityLogMetadata = {
      ...metadata,
      browser,
      os,
      device,
    };

    // Add browser-specific metadata if available
    if (typeof navigator !== 'undefined' && navigator.userAgent) {
      baseMetadata.userAgent = navigator.userAgent;
    }

    if (typeof window !== 'undefined' && window.screen) {
      baseMetadata.screenResolution = `${window.screen.width}x${window.screen.height}`;
    }

    if (typeof window !== 'undefined' && window.location) {
      baseMetadata.page = window.location.pathname;
    }

    if (typeof document !== 'undefined' && document.referrer) {
      baseMetadata.referrer = document.referrer;
    }

    // Avoid writing undefined values (Firestore does not allow them)
    const activityLog: Omit<ActivityLog, 'id'> = {
      userId,
      eventType,
      timestamp: Timestamp.now(),
      sessionId,
      isAdmin,
      metadata: baseMetadata,
    };

    if (userEmail) {
      activityLog.userEmail = userEmail;
    }
    if (userName) {
      activityLog.userName = userName;
    }

    const docRef = await addDoc(collection(db, 'activityLogs'), activityLog);
    return docRef.id;
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Activity logging must never block the primary user flow (login, navigation, etc.).
    // Returning a synthetic id keeps call sites simple while avoiding runtime breakage.
    return `failed_${Date.now()}`;
  }
}

/**
 * Get activity logs with filtering
 */
export async function getActivityLogs(
  filter: ActivityLogFilter = {}
): Promise<{ logs: ActivityLog[]; lastDoc?: DocumentSnapshot }> {
  try {
    const constraints: QueryConstraint[] = [];

    if (filter.userId) {
      constraints.push(where('userId', '==', filter.userId));
    }

    if (filter.eventType) {
      if (Array.isArray(filter.eventType)) {
        constraints.push(where('eventType', 'in', filter.eventType));
      } else {
        constraints.push(where('eventType', '==', filter.eventType));
      }
    }

    if (filter.isAdmin !== undefined) {
      constraints.push(where('isAdmin', '==', filter.isAdmin));
    }

    if (filter.startDate) {
      constraints.push(where('timestamp', '>=', Timestamp.fromDate(filter.startDate)));
    }

    if (filter.endDate) {
      constraints.push(where('timestamp', '<=', Timestamp.fromDate(filter.endDate)));
    }

    constraints.push(orderBy('timestamp', 'desc'));

    if (filter.lastDoc) {
      constraints.push(startAfter(filter.lastDoc));
    }

    constraints.push(limit(filter.limit || 50));

    const q = query(collection(db, 'activityLogs'), ...constraints);
    const snapshot = await getDocs(q);

    const logs: ActivityLog[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ActivityLog[];

    const lastDoc = snapshot.docs[snapshot.docs.length - 1];

    return { logs, lastDoc };
  } catch (error) {
    console.error('Failed to get activity logs:', error);
    throw error;
  }
}

/**
 * Subscribe to real-time activity logs
 */
export function subscribeToActivityLogs(
  filter: ActivityLogFilter,
  callback: (logs: ActivityLog[]) => void,
  onError?: (error: Error) => void
): () => void {
  try {
    const constraints: QueryConstraint[] = [];

    if (filter.userId) {
      constraints.push(where('userId', '==', filter.userId));
    }

    if (filter.eventType) {
      if (Array.isArray(filter.eventType)) {
        constraints.push(where('eventType', 'in', filter.eventType));
      } else {
        constraints.push(where('eventType', '==', filter.eventType));
      }
    }

    if (filter.isAdmin !== undefined) {
      constraints.push(where('isAdmin', '==', filter.isAdmin));
    }

    constraints.push(orderBy('timestamp', 'desc'));
    constraints.push(limit(filter.limit || 50));

    const q = query(collection(db, 'activityLogs'), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const logs: ActivityLog[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ActivityLog[];
        callback(logs);
      },
      (error) => {
        console.error('Activity logs subscription error:', error);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Failed to subscribe to activity logs:', error);
    throw error;
  }
}

/**
 * Get activity statistics for a user
 */
export async function getUserActivityStats(userId: string): Promise<{
  totalEvents: number;
  eventsByType: Record<string, number>;
  lastActivity: Date | null;
  sessionsCount: number;
}> {
  try {
    const { logs } = await getActivityLogs({ userId, limit: 1000 });

    const eventsByType: Record<string, number> = {};
    const sessions = new Set<string>();
    let lastActivity: Date | null = null;

    logs.forEach((log) => {
      // Count by event type
      eventsByType[log.eventType] = (eventsByType[log.eventType] || 0) + 1;

      // Track sessions
      if (log.sessionId) {
        sessions.add(log.sessionId);
      }

      // Track last activity
      const logDate = log.timestamp.toDate();
      if (!lastActivity || logDate > lastActivity) {
        lastActivity = logDate;
      }
    });

    return {
      totalEvents: logs.length,
      eventsByType,
      lastActivity,
      sessionsCount: sessions.size,
    };
  } catch (error) {
    console.error('Failed to get user activity stats:', error);
    throw error;
  }
}

/**
 * Get recent activity across all users (admin only)
 */
export async function getRecentActivity(limitCount: number = 100): Promise<ActivityLog[]> {
  try {
    const q = query(
      collection(db, 'activityLogs'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ActivityLog[];
  } catch (error) {
    console.error('Failed to get recent activity:', error);
    throw error;
  }
}

/**
 * Search activity logs by metadata
 */
export async function searchActivityLogs(
  searchTerm: string,
  filter: ActivityLogFilter = {}
): Promise<ActivityLog[]> {
  try {
    // Get all logs with basic filters
    const { logs } = await getActivityLogs({ ...filter, limit: 1000 });

    // Filter by search term in metadata
    const searchLower = searchTerm.toLowerCase();
    return logs.filter((log) => {
      const metadataStr = JSON.stringify(log.metadata).toLowerCase();
      return (
        metadataStr.includes(searchLower) ||
        log.userEmail?.toLowerCase().includes(searchLower) ||
        log.userName?.toLowerCase().includes(searchLower) ||
        log.eventType.toLowerCase().includes(searchLower)
      );
    });
  } catch (error) {
    console.error('Failed to search activity logs:', error);
    throw error;
  }
}

/**
 * Calculate engagement score for a user based on their activity
 */
export function calculateEngagementScore(logs: ActivityLog[]): number {
  if (logs.length === 0) return 0;

  let score = 0;
  const eventWeights: Record<ActivityEventType, number> = {
    // High engagement events
    'auction_bid': 10,
    'auction_create': 15,
    'product_create': 15,
    'product_buy': 12,
    'message_send': 8,
    'conversation_start': 10,

    // Medium engagement events
    'product_view': 5,
    'auction_view': 5,
    'product_search': 6,
    'collection_add': 7,
    'page_view': 3,

    // Low engagement events
    'user_login': 2,
    'user_logout': 1,
    'page_leave': 1,

    // Default weight for other events
    'user_register': 3,
    'password_reset_request': 2,
    'password_reset_complete': 3,
    'email_verification': 2,
    'product_filter': 4,
    'product_update': 10,
    'product_delete': 8,
    'auction_auto_bid_set': 8,
    'auction_auto_bid_cancel': 5,
    'auction_end': 7,
    'auction_win': 12,
    'collection_remove': 5,
    'collection_view': 4,
    'message_read': 3,
    'admin_user_view': 6,
    'admin_user_edit': 8,
    'admin_user_delete': 10,
    'admin_user_ban': 12,
    'admin_user_unban': 8,
    'admin_password_reset': 7,
    'admin_role_change': 9,
    'admin_auction_edit': 8,
    'admin_auction_cancel': 10,
    'admin_product_edit': 8,
    'admin_product_delete': 10,
    'admin_logs_view': 5,
    'admin_analytics_access': 5,
    'security_error': 4,
    'error_occurred': 2,
    'api_error': 3,
    'payment_error': 4,
    'suspicious_activity': 15,
    'rate_limit_exceeded': 10,
    'unauthorized_access_attempt': 20
  };

  // Calculate base score from events
  logs.forEach(log => {
    score += eventWeights[log.eventType] || 3;
  });

  // Normalize score to 0-100 range
  const maxPossibleScore = logs.length * 15; // Max weight is 15
  const normalizedScore = Math.min(100, Math.round((score / maxPossibleScore) * 100));

  return normalizedScore;
}

/**
 * Calculate suspicious activity score for a user
 */
export function calculateSuspiciousScore(logs: ActivityLog[]): number {
  if (logs.length === 0) return 0;

  let score = 0;

  // Check for suspicious patterns
  const suspiciousPatterns: Partial<Record<ActivityEventType, number>> = {
    'error_occurred': 20,
    'api_error': 25,
    'payment_error': 30,
    'suspicious_activity': 50,
    'rate_limit_exceeded': 25,
    'unauthorized_access_attempt': 40
  };

  // Check for rapid sequence of events (potential bot activity)
  const timestamps = logs
    .map(log => log.timestamp.toDate().getTime())
    .sort((a, b) => a - b);

  let rapidSequenceCount = 0;
  for (let i = 1; i < timestamps.length; i++) {
    const timeDiff = timestamps[i] - timestamps[i - 1];
    if (timeDiff < 1000) { // Less than 1 second between events
      rapidSequenceCount++;
      score += 5;
    }
  }

  // Check for suspicious event types
  logs.forEach(log => {
    score += suspiciousPatterns[log.eventType] || 0;
  });

  // Check for unusual geographic patterns
  const uniqueCountries = new Set(logs
    .filter(log => log.geoLocation?.country)
    .map(log => log.geoLocation?.country));

  if (uniqueCountries.size > 3) {
    score += uniqueCountries.size * 5; // Multiple countries in short time
  }

  // Normalize to 0-100 range
  return Math.min(100, Math.round(score / logs.length * 2));
}

/**
 * Get user activity analytics with enhanced metrics
 */
export async function getUserActivityAnalytics(userId: string): Promise<{
  totalEvents: number;
  eventsByType: Record<string, number>;
  lastActivity: Date | null;
  sessionsCount: number;
  engagementScore: number;
  suspiciousScore: number;
  sessionDurationStats: {
    average: number;
    total: number;
    longest: number;
    shortest: number;
  };
  geoDistribution: Record<string, number>;
}> {
  try {
    const { logs } = await getActivityLogs({ userId, limit: 1000 });

    if (logs.length === 0) {
      return {
        totalEvents: 0,
        eventsByType: {},
        lastActivity: null,
        sessionsCount: 0,
        engagementScore: 0,
        suspiciousScore: 0,
        sessionDurationStats: {
          average: 0,
          total: 0,
          longest: 0,
          shortest: 0
        },
        geoDistribution: {}
      };
    }

    const eventsByType: Record<string, number> = {};
    const sessions = new Set<string>();
    let lastActivity: Date | null = null;
    const sessionDurations: number[] = [];
    const geoDistribution: Record<string, number> = {};

    logs.forEach((log) => {
      // Count by event type
      eventsByType[log.eventType] = (eventsByType[log.eventType] || 0) + 1;

      // Track sessions
      if (log.sessionId) {
        sessions.add(log.sessionId);
      }

      // Track session durations
      if (log.sessionDuration) {
        sessionDurations.push(log.sessionDuration);
      }

      // Track last activity
      const logDate = log.timestamp.toDate();
      if (!lastActivity || logDate > lastActivity) {
        lastActivity = logDate;
      }

      // Track geographic distribution
      if (log.geoLocation?.country) {
        geoDistribution[log.geoLocation.country] = (geoDistribution[log.geoLocation.country] || 0) + 1;
      }
    });

    // Calculate session duration stats
    const sessionDurationStats = {
      average: sessionDurations.length > 0 ? Math.round(sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length) : 0,
      total: sessionDurations.reduce((a, b) => a + b, 0),
      longest: sessionDurations.length > 0 ? Math.max(...sessionDurations) : 0,
      shortest: sessionDurations.length > 0 ? Math.min(...sessionDurations) : 0
    };

    return {
      totalEvents: logs.length,
      eventsByType,
      lastActivity,
      sessionsCount: sessions.size,
      engagementScore: calculateEngagementScore(logs),
      suspiciousScore: calculateSuspiciousScore(logs),
      sessionDurationStats,
      geoDistribution
    };
  } catch (error) {
    console.error('Failed to get user activity analytics:', error);
    throw error;
  }
}

/**
 * Get aggregated user activity statistics across all users
 */
export async function getAggregatedUserActivityStats(): Promise<{
  totalUsers: number;
  totalEvents: number;
  averageEngagement: number;
  averageSessions: number;
  eventTypeDistribution: Record<string, number>;
  suspiciousActivityCount: number;
}> {
  try {
    // Get recent activity from multiple users
    const { logs } = await getActivityLogs({ limit: 1000 });

    const userIds = new Set<string>();
    const eventTypeDistribution: Record<string, number> = {};
    let suspiciousActivityCount = 0;

    logs.forEach((log) => {
      userIds.add(log.userId);

      // Count event types
      eventTypeDistribution[log.eventType] = (eventTypeDistribution[log.eventType] || 0) + 1;

      // Count suspicious activity
      if (log.suspiciousScore && log.suspiciousScore > 70) {
        suspiciousActivityCount++;
      }
    });

    // Calculate engagement scores for users with sufficient data
    const usersWithData = Array.from(userIds);
    let totalEngagement = 0;
    let usersWithEngagementData = 0;

    for (const userId of usersWithData) {
      const userLogs = logs.filter(log => log.userId === userId);
      if (userLogs.length >= 5) { // Only calculate for users with enough data
        totalEngagement += calculateEngagementScore(userLogs);
        usersWithEngagementData++;
      }
    }

    return {
      totalUsers: userIds.size,
      totalEvents: logs.length,
      averageEngagement: usersWithEngagementData > 0 ? Math.round(totalEngagement / usersWithEngagementData) : 0,
      averageSessions: Math.round(logs.length / userIds.size),
      eventTypeDistribution,
      suspiciousActivityCount
    };
  } catch (error) {
    console.error('Failed to get aggregated user activity stats:', error);
    throw error;
  }
}

/**
 * Detect unusual behavioral patterns
 */
export async function detectBehavioralPatterns(): Promise<{
  suspiciousUsers: Array<{
    userId: string;
    score: number;
    suspiciousEvents: ActivityEventType[];
    reason: string;
  }>;
  unusualPatterns: Array<{
    pattern: string;
    count: number;
    usersAffected: string[];
  }>;
}> {
  try {
    const { logs } = await getActivityLogs({ limit: 2000 });
    const suspiciousUsers: Array<{
      userId: string;
      score: number;
      suspiciousEvents: ActivityEventType[];
      reason: string;
    }> = [];

    const unusualPatterns: Array<{
      pattern: string;
      count: number;
      usersAffected: string[];
    }> = [];

    // Group logs by user
    const logsByUser: Record<string, ActivityLog[]> = {};
    logs.forEach(log => {
      if (!logsByUser[log.userId]) {
        logsByUser[log.userId] = [];
      }
      logsByUser[log.userId].push(log);
    });

    // Analyze each user's activity
    for (const [userId, userLogs] of Object.entries(logsByUser)) {
      if (userLogs.length < 5) continue; // Skip users with insufficient data

      const suspiciousScore = calculateSuspiciousScore(userLogs);
      if (suspiciousScore > 60) { // Threshold for suspicious activity
        const suspiciousEvents = userLogs
          .filter(log => log.suspiciousScore && log.suspiciousScore > 30)
          .map(log => log.eventType);

        let reason = 'High suspicious activity score';
        if (suspiciousEvents.includes('unauthorized_access_attempt')) {
          reason = 'Unauthorized access attempts detected';
        } else if (suspiciousEvents.includes('rate_limit_exceeded')) {
          reason = 'Rate limit violations detected';
        }

        suspiciousUsers.push({
          userId,
          score: suspiciousScore,
          suspiciousEvents: suspiciousEvents as ActivityEventType[],
          reason
        });
      }
    }

    // Detect unusual patterns across all users
    const errorLogs = logs.filter(log =>
      log.eventType.includes('error') ||
      log.eventType.includes('suspicious') ||
      log.eventType.includes('unauthorized')
    );

    if (errorLogs.length > 0) {
      const errorPatterns: Record<string, { count: number; users: Set<string> }> = {};

      errorLogs.forEach(log => {
        const patternKey = `${log.eventType}_${log.metadata.errorCode || 'general'}`;
        if (!errorPatterns[patternKey]) {
          errorPatterns[patternKey] = { count: 0, users: new Set() };
        }
        errorPatterns[patternKey].count++;
        errorPatterns[patternKey].users.add(log.userId);
      });

      // Convert to array and sort by count
      const sortedPatterns = Object.entries(errorPatterns)
        .map(([pattern, data]) => ({
          pattern,
          count: data.count,
          usersAffected: Array.from(data.users)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5); // Top 5 patterns

      unusualPatterns.push(...sortedPatterns);
    }

    return {
      suspiciousUsers,
      unusualPatterns
    };
  } catch (error) {
    console.error('Failed to detect behavioral patterns:', error);
    throw error;
  }
}

/**
 * Get session metrics and engagement data
 */
export async function getSessionMetrics(): Promise<{
  totalSessions: number;
  activeSessions: number;
  averageSessionDuration: number;
  sessionDurationDistribution: Record<string, number>;
  engagementBySession: Record<string, {
    sessionId: string;
    duration: number;
    engagementScore: number;
    eventCount: number;
  }>;
}> {
  try {
    const { logs } = await getActivityLogs({ limit: 1000 });

    const sessions = new Set<string>();
    const activeSessions = new Set<string>();
    const sessionDurations: number[] = [];
    const sessionDurationDistribution: Record<string, number> = {
      '0-30s': 0,
      '30s-2m': 0,
      '2m-10m': 0,
      '10m-30m': 0,
      '30m+': 0
    };

    const engagementBySession: Record<string, {
      sessionId: string;
      duration: number;
      engagementScore: number;
      eventCount: number;
    }> = {};

    // Group logs by session
    const logsBySession: Record<string, ActivityLog[]> = {};
    logs.forEach(log => {
      if (log.sessionId) {
        if (!logsBySession[log.sessionId]) {
          logsBySession[log.sessionId] = [];
        }
        logsBySession[log.sessionId].push(log);
      }
    });

    // Calculate metrics for each session
    for (const [sessionId, sessionLogs] of Object.entries(logsBySession)) {
      sessions.add(sessionId);

      // Check if session is active (recent activity)
      const mostRecentLog = sessionLogs[0];
      const timeSinceLastActivity = Date.now() - mostRecentLog.timestamp.toDate().getTime();
      if (timeSinceLastActivity < 300000) { // 5 minutes
        activeSessions.add(sessionId);
      }

      // Calculate session metrics
      const sessionDuration = sessionLogs[0].sessionDuration || 0;
      if (sessionDuration > 0) {
        sessionDurations.push(sessionDuration);

        // Categorize duration
        if (sessionDuration < 30) sessionDurationDistribution['0-30s']++;
        else if (sessionDuration < 120) sessionDurationDistribution['30s-2m']++;
        else if (sessionDuration < 600) sessionDurationDistribution['2m-10m']++;
        else if (sessionDuration < 1800) sessionDurationDistribution['10m-30m']++;
        else sessionDurationDistribution['30m+']++;
      }

      // Calculate engagement for this session
      const engagementScore = calculateEngagementScore(sessionLogs);
      engagementBySession[sessionId] = {
        sessionId,
        duration: sessionDuration,
        engagementScore,
        eventCount: sessionLogs.length
      };
    }

    return {
      totalSessions: sessions.size,
      activeSessions: activeSessions.size,
      averageSessionDuration: sessionDurations.length > 0
        ? Math.round(sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length)
        : 0,
      sessionDurationDistribution,
      engagementBySession
    };
  } catch (error) {
    console.error('Failed to get session metrics:', error);
    throw error;
  }
}
