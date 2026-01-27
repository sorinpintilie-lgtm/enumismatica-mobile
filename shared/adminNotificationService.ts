import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  updateDoc,
  doc,
  Timestamp,
  onSnapshot,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from './firebaseConfig';

export type NotificationSeverity = 'info' | 'warning' | 'critical' | 'security';

export type NotificationType =
  | 'suspicious_activity'
  | 'rate_limit_exceeded'
  | 'unauthorized_access'
  | 'multiple_failed_logins'
  | 'admin_action_required'
  | 'system_error'
  | 'high_value_transaction'
  | 'user_banned'
  | 'mass_deletion'
  | 'security_breach_attempt';

export interface AdminNotification {
  id?: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  userId?: string;
  userEmail?: string;
  metadata?: Record<string, any>;
  read: boolean;
  actionTaken: boolean;
  actionTakenBy?: string;
  actionTakenAt?: Timestamp;
  createdAt: Timestamp;
}

/**
 * Create an admin notification
 */
export async function createAdminNotification(
  type: NotificationType,
  severity: NotificationSeverity,
  title: string,
  message: string,
  metadata?: Record<string, any>,
  userId?: string,
  userEmail?: string
): Promise<string> {
  try {
    const notification: Omit<AdminNotification, 'id'> = {
      type,
      severity,
      title,
      message,
      userId,
      userEmail,
      metadata,
      read: false,
      actionTaken: false,
      createdAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, 'adminNotifications'), notification);
    console.log(`Admin notification created: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error('Failed to create admin notification:', error);
    throw error;
  }
}

/**
 * Get admin notifications with filtering
 */
export async function getAdminNotifications(
  filters: {
    severity?: NotificationSeverity;
    type?: NotificationType;
    unreadOnly?: boolean;
    limit?: number;
  } = {}
): Promise<AdminNotification[]> {
  try {
    const constraints: QueryConstraint[] = [];

    if (filters.severity) {
      constraints.push(where('severity', '==', filters.severity));
    }

    if (filters.type) {
      constraints.push(where('type', '==', filters.type));
    }

    if (filters.unreadOnly) {
      constraints.push(where('read', '==', false));
    }

    constraints.push(orderBy('createdAt', 'desc'));
    constraints.push(limit(filters.limit || 50));

    const q = query(collection(db, 'adminNotifications'), ...constraints);
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as AdminNotification[];
  } catch (error) {
    console.error('Failed to get admin notifications:', error);
    throw error;
  }
}

/**
 * Subscribe to real-time admin notifications
 */
export function subscribeToAdminNotifications(
  callback: (notifications: AdminNotification[]) => void,
  filters: {
    severity?: NotificationSeverity;
    unreadOnly?: boolean;
  } = {},
  onError?: (error: Error) => void
): () => void {
  try {
    const constraints: QueryConstraint[] = [];

    if (filters.severity) {
      constraints.push(where('severity', '==', filters.severity));
    }

    if (filters.unreadOnly) {
      constraints.push(where('read', '==', false));
    }

    constraints.push(orderBy('createdAt', 'desc'));
    constraints.push(limit(100));

    const q = query(collection(db, 'adminNotifications'), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifications: AdminNotification[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as AdminNotification[];
        callback(notifications);
      },
      (error) => {
        console.error('Admin notifications subscription error:', error);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Failed to subscribe to admin notifications:', error);
    throw error;
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    const notificationRef = doc(db, 'adminNotifications', notificationId);
    await updateDoc(notificationRef, {
      read: true,
    });
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    throw error;
  }
}

/**
 * Mark notification as action taken
 */
export async function markNotificationActionTaken(
  notificationId: string,
  adminUserId: string
): Promise<void> {
  try {
    const notificationRef = doc(db, 'adminNotifications', notificationId);
    await updateDoc(notificationRef, {
      actionTaken: true,
      actionTakenBy: adminUserId,
      actionTakenAt: Timestamp.now(),
      read: true,
    });
  } catch (error) {
    console.error('Failed to mark notification action taken:', error);
    throw error;
  }
}

/**
 * Get unread notification count
 */
export async function getUnreadNotificationCount(): Promise<number> {
  try {
    const q = query(
      collection(db, 'adminNotifications'),
      where('read', '==', false)
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error('Failed to get unread notification count:', error);
    return 0;
  }
}

/**
 * Get critical notification count
 */
export async function getCriticalNotificationCount(): Promise<number> {
  try {
    const q = query(
      collection(db, 'adminNotifications'),
      where('severity', '==', 'critical'),
      where('actionTaken', '==', false)
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error('Failed to get critical notification count:', error);
    return 0;
  }
}

/**
 * Helper function to create notification for suspicious activity
 */
export async function notifySuspiciousActivity(
  userId: string,
  userEmail: string,
  activityType: string,
  details: Record<string, any>
): Promise<void> {
  await createAdminNotification(
    'suspicious_activity',
    'security',
    'Activitate Suspectă Detectată',
    `Utilizatorul ${userEmail} a efectuat activități suspecte: ${activityType}`,
    details,
    userId,
    userEmail
  );
}

/**
 * Helper function to create notification for failed login attempts
 */
export async function notifyFailedLogins(
  email: string,
  attemptCount: number,
  ipAddress?: string
): Promise<void> {
  await createAdminNotification(
    'multiple_failed_logins',
    'warning',
    'Încercări Multiple de Autentificare Eșuate',
    `${attemptCount} încercări eșuate de autentificare pentru ${email}`,
    { attemptCount, ipAddress },
    undefined,
    email
  );
}

/**
 * Helper function to create notification for unauthorized access
 */
export async function notifyUnauthorizedAccess(
  userId: string,
  userEmail: string,
  resource: string,
  details: Record<string, any>
): Promise<void> {
  await createAdminNotification(
    'unauthorized_access',
    'security',
    'Tentativă de Acces Neautorizat',
    `Utilizatorul ${userEmail} a încercat să acceseze: ${resource}`,
    details,
    userId,
    userEmail
  );
}

/**
 * Helper function to create notification for system errors
 */
export async function notifySystemError(
  errorMessage: string,
  errorStack?: string,
  context?: Record<string, any>
): Promise<void> {
  await createAdminNotification(
    'system_error',
    'critical',
    'Eroare de Sistem',
    errorMessage,
    { errorStack, context }
  );
}