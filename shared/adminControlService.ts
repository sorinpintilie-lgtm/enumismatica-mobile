import {
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  setDoc,
} from 'firebase/firestore';
import { db, auth } from './firebaseConfig';
import {
  sendPasswordResetEmail,
  updatePassword,
  deleteUser as deleteAuthUser,
} from 'firebase/auth';
import { logActivity } from './activityLogService';

export interface UserControlAction {
  userId: string;
  action: 'ban' | 'unban' | 'delete' | 'role_change' | 'password_reset';
  reason?: string;
  performedBy: string;
  performedByEmail: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Reset a user's password (admin action)
 * Sends password reset email to the user
 */
export async function adminResetUserPassword(
  targetUserId: string,
  targetUserEmail: string,
  adminUserId: string,
  adminEmail: string,
  reason?: string
): Promise<void> {
  try {
    // Send password reset email
    await sendPasswordResetEmail(auth, targetUserEmail);

    // Log the admin action
    await logActivity(
      adminUserId,
      'admin_password_reset',
      {
        targetUserId,
        targetUserEmail,
        reason,
        adminAction: 'password_reset',
      },
      adminEmail,
      adminEmail,
      true
    );

    // Record the action in admin logs
    await setDoc(doc(collection(db, 'adminActions')), {
      userId: targetUserId,
      action: 'password_reset',
      reason,
      performedBy: adminUserId,
      performedByEmail: adminEmail,
      timestamp: Timestamp.now(),
      metadata: {
        targetUserEmail,
      },
    });

    console.log(`Password reset email sent to ${targetUserEmail}`);
  } catch (error) {
    console.error('Failed to reset user password:', error);
    throw error;
  }
}

/**
 * Ban a user (prevents login and access)
 */
export async function banUser(
  targetUserId: string,
  adminUserId: string,
  adminEmail: string,
  reason: string
): Promise<void> {
  try {
    const userRef = doc(db, 'users', targetUserId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();

    // Update user document with ban status
    await updateDoc(userRef, {
      banned: true,
      bannedAt: Timestamp.now(),
      bannedBy: adminUserId,
      banReason: reason,
      updatedAt: Timestamp.now(),
    });

    // Log the admin action
    await logActivity(
      adminUserId,
      'admin_user_ban',
      {
        targetUserId,
        targetUserEmail: userData.email,
        reason,
        adminAction: 'ban',
      },
      adminEmail,
      adminEmail,
      true
    );

    // Record in admin actions
    await setDoc(doc(collection(db, 'adminActions')), {
      userId: targetUserId,
      action: 'ban',
      reason,
      performedBy: adminUserId,
      performedByEmail: adminEmail,
      timestamp: Timestamp.now(),
      metadata: {
        targetUserEmail: userData.email,
        targetUserName: userData.displayName,
      },
    });

    console.log(`User ${targetUserId} has been banned`);
  } catch (error) {
    console.error('Failed to ban user:', error);
    throw error;
  }
}

/**
 * Unban a user
 */
export async function unbanUser(
  targetUserId: string,
  adminUserId: string,
  adminEmail: string,
  reason?: string
): Promise<void> {
  try {
    const userRef = doc(db, 'users', targetUserId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();

    // Remove ban status
    await updateDoc(userRef, {
      banned: false,
      bannedAt: null,
      bannedBy: null,
      banReason: null,
      unbannedAt: Timestamp.now(),
      unbannedBy: adminUserId,
      updatedAt: Timestamp.now(),
    });

    // Log the admin action
    await logActivity(
      adminUserId,
      'admin_user_unban',
      {
        targetUserId,
        targetUserEmail: userData.email,
        reason,
        adminAction: 'unban',
      },
      adminEmail,
      adminEmail,
      true
    );

    // Record in admin actions
    await setDoc(doc(collection(db, 'adminActions')), {
      userId: targetUserId,
      action: 'unban',
      reason,
      performedBy: adminUserId,
      performedByEmail: adminEmail,
      timestamp: Timestamp.now(),
      metadata: {
        targetUserEmail: userData.email,
        targetUserName: userData.displayName,
      },
    });

    console.log(`User ${targetUserId} has been unbanned`);
  } catch (error) {
    console.error('Failed to unban user:', error);
    throw error;
  }
}

/**
 * Change user role (admin/user)
 */
export async function changeUserRole(
  targetUserId: string,
  newRole: 'superadmin' | 'admin' | 'user',
  adminUserId: string,
  adminEmail: string,
  reason?: string
): Promise<void> {
  try {
    const userRef = doc(db, 'users', targetUserId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();
    const oldRole = userData.role || 'user';

    // Update user role
    await updateDoc(userRef, {
      role: newRole,
      updatedAt: Timestamp.now(),
    });

    // Log the admin action
    await logActivity(
      adminUserId,
      'admin_role_change',
      {
        targetUserId,
        targetUserEmail: userData.email,
        previousValue: oldRole,
        newValue: newRole,
        reason,
        adminAction: 'role_change',
      },
      adminEmail,
      adminEmail,
      true
    );

    // Record in admin actions
    await setDoc(doc(collection(db, 'adminActions')), {
      userId: targetUserId,
      action: 'role_change',
      reason,
      performedBy: adminUserId,
      performedByEmail: adminEmail,
      timestamp: Timestamp.now(),
      metadata: {
        targetUserEmail: userData.email,
        targetUserName: userData.displayName,
        oldRole,
        newRole,
      },
    });

    console.log(`User ${targetUserId} role changed from ${oldRole} to ${newRole}`);
  } catch (error) {
    console.error('Failed to change user role:', error);
    throw error;
  }
}

/**
 * Delete user account (soft delete - marks as deleted)
 */
export async function deleteUserAccount(
  targetUserId: string,
  adminUserId: string,
  adminEmail: string,
  reason: string
): Promise<void> {
  try {
    const userRef = doc(db, 'users', targetUserId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();

    // Soft delete - mark as deleted instead of actually deleting
    await updateDoc(userRef, {
      deleted: true,
      deletedAt: Timestamp.now(),
      deletedBy: adminUserId,
      deleteReason: reason,
      updatedAt: Timestamp.now(),
    });

    // Log the admin action
    await logActivity(
      adminUserId,
      'admin_user_delete',
      {
        targetUserId,
        targetUserEmail: userData.email,
        reason,
        adminAction: 'delete',
      },
      adminEmail,
      adminEmail,
      true
    );

    // Record in admin actions
    await setDoc(doc(collection(db, 'adminActions')), {
      userId: targetUserId,
      action: 'delete',
      reason,
      performedBy: adminUserId,
      performedByEmail: adminEmail,
      timestamp: Timestamp.now(),
      metadata: {
        targetUserEmail: userData.email,
        targetUserName: userData.displayName,
      },
    });

    console.log(`User ${targetUserId} has been deleted`);
  } catch (error) {
    console.error('Failed to delete user:', error);
    throw error;
  }
}

/**
 * Get all admin actions
 */
export async function getAdminActions(limit: number = 100): Promise<UserControlAction[]> {
  try {
    const q = query(
      collection(db, 'adminActions'),
      where('timestamp', '>', Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))), // Last 30 days
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      ...doc.data(),
      timestamp: doc.data().timestamp.toDate(),
    })) as UserControlAction[];
  } catch (error) {
    console.error('Failed to get admin actions:', error);
    throw error;
  }
}

/**
 * Update user credits (admin action)
 */
export async function updateUserCredits(
  targetUserId: string,
  newCredits: number,
  adminUserId: string,
  adminEmail: string,
  reason: string
): Promise<void> {
  try {
    const userRef = doc(db, 'users', targetUserId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();
    const oldCredits = userData.credits || 0;

    await updateDoc(userRef, {
      credits: newCredits,
      updatedAt: Timestamp.now(),
    });

    // Log the admin action
    await logActivity(
      adminUserId,
      'admin_user_edit',
      {
        targetUserId,
        targetUserEmail: userData.email,
        field: 'credits',
        previousValue: oldCredits,
        newValue: newCredits,
        reason,
        adminAction: 'update_credits',
      },
      adminEmail,
      adminEmail,
      true
    );

    // Record in admin actions
    await setDoc(doc(collection(db, 'adminActions')), {
      userId: targetUserId,
      action: 'update_credits',
      reason,
      performedBy: adminUserId,
      performedByEmail: adminEmail,
      timestamp: Timestamp.now(),
      metadata: {
        targetUserEmail: userData.email,
        oldCredits,
        newCredits,
      },
    });

    console.log(`User ${targetUserId} credits updated from ${oldCredits} to ${newCredits}`);
  } catch (error) {
    console.error('Failed to update user credits:', error);
    throw error;
  }
}

/**
 * Force logout user by invalidating their session
 */
export async function forceLogoutUser(
  targetUserId: string,
  adminUserId: string,
  adminEmail: string,
  reason: string
): Promise<void> {
  try {
    const userRef = doc(db, 'users', targetUserId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();

    // Set a flag that will be checked on next request
    await updateDoc(userRef, {
      forceLogout: true,
      forceLogoutAt: Timestamp.now(),
      forceLogoutBy: adminUserId,
      forceLogoutReason: reason,
      updatedAt: Timestamp.now(),
    });

    // Log the admin action
    await logActivity(
      adminUserId,
      'admin_user_edit',
      {
        targetUserId,
        targetUserEmail: userData.email,
        reason,
        adminAction: 'force_logout',
      },
      adminEmail,
      adminEmail,
      true
    );

    console.log(`User ${targetUserId} will be forced to logout`);
  } catch (error) {
    console.error('Failed to force logout user:', error);
    throw error;
  }
}