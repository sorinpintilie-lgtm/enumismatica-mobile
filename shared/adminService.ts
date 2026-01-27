import {
  doc,
  getDoc,
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  addDoc,
  setDoc,
  limit,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { User, Product, Auction, CollectionItem, Conversation, ChatMessage } from './types';
import {
  sendProductApprovedEmail,
  sendProductRejectedEmail,
  sendAuctionApprovedEmail,
  sendAuctionRejectedEmail,
} from './emailService';
import { endAuction } from './auctionService';

/**
 * Admin UID - hardcoded for security
 */
const ADMIN_UID = 'QEm0DSIzylNQIHpQAZlgtWQkYYE3';

/**
 * Check if a user is a super-admin (full control) based on their UID or role in Firestore.
 *
 * Super-admins:
 *  - The hardcoded ADMIN_UID
 *  - Any user document with role === 'superadmin'
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  try {
    // Hardcoded super admin UID
    if (userId === ADMIN_UID) return true;

    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return false;

    const userData = userDoc.data();
    return userData.role === 'superadmin';
  } catch (error) {
    console.error('Error checking super admin status:', error);
    return false;
  }
}

/**
 * Check if a user is an admin (normal admin OR super-admin).
 *
 * This is used for general admin access (products/auctions approval, etc.).
 * For super-admin-only features (user management, analytics, logs), use isSuperAdmin().
 */
export async function isAdmin(userId: string): Promise<boolean> {
  try {
    // Super admin is always considered admin
    if (await isSuperAdmin(userId)) return true;

    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return false;

    const userData = userDoc.data();
    // Normal admin role
    return userData.role === 'admin';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Set a user as admin (only callable by super-admin)
 */
export async function setUserAsAdmin(userId: string, isCurrentUserSuperAdmin: boolean): Promise<{ success: boolean; error?: string }> {
	if (!isCurrentUserSuperAdmin) {
		return { success: false, error: 'Unauthorized: Only super-admin can set other users as admin' };
	}

	try {
		await updateDoc(doc(db, 'users', userId), {
			role: 'admin',
			updatedAt: Timestamp.fromDate(new Date()),
		});
		return { success: true };
	} catch (error: any) {
		return { success: false, error: error.message };
	}
}

/**
 * Remove admin role from a user (only callable by super-admin)
 */
export async function removeAdminRole(userId: string, isCurrentUserSuperAdmin: boolean): Promise<{ success: boolean; error?: string }> {
	if (!isCurrentUserSuperAdmin) {
		return { success: false, error: 'Unauthorized: Only super-admin can remove admin role' };
	}

	try {
		await updateDoc(doc(db, 'users', userId), {
			role: 'user',
			updatedAt: Timestamp.fromDate(new Date()),
		});
		return { success: true };
	} catch (error: any) {
		return { success: false, error: error.message };
	}
}

/**
 * Get all users (admin only)
 */
export async function getAllUsers(): Promise<User[]> {
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    return usersSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        email: data.email || '',
        name: data.name || '',
        displayName: data.displayName || data.email || '',
        role: data.role || 'user',
        idVerificationStatus: data.idVerificationStatus,
        idDocumentType: data.idDocumentType,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as User;
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

/**
 * Get user details by ID (admin only)
 */
export async function getUserDetails(userId: string): Promise<User | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return null;
    }
    const data = userDoc.data();
    return {
      id: userDoc.id,
      email: data.email || '',
      name: data.name || '',
      displayName: data.displayName || data.email || '',
      role: data.role || 'user',
      idVerificationStatus: data.idVerificationStatus,
      idDocumentType: data.idDocumentType,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as User;
  } catch (error) {
    console.error('Error fetching user details:', error);
    return null;
  }
}

/**
 * Update manual identity verification status for a user (admin/superadmin only).
 */
export async function updateUserVerificationStatus(
  userId: string,
  status: 'verified' | 'rejected' | 'pending',
  adminUserId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateDoc(doc(db, 'users', userId), {
      idVerificationStatus: status,
      idVerifiedAt: status === 'verified' ? Timestamp.fromDate(new Date()) : null,
      idVerifiedBy: status === 'verified' ? adminUserId : null,
      updatedAt: Timestamp.fromDate(new Date()),
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error updating user verification status:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all products (admin only)
 */
export async function getAllProducts(): Promise<Product[]> {
  try {
    const productsSnapshot = await getDocs(collection(db, 'products'));
    const products = productsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as Product[];
    return products.filter(p => p.listingType === 'direct');
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
}

/**
 * Get product by ID (admin only)
 */
export async function getProductById(productId: string): Promise<Product | null> {
  try {
    const productDoc = await getDoc(doc(db, 'products', productId));
    if (!productDoc.exists()) {
      return null;
    }
    return {
      id: productDoc.id,
      ...productDoc.data(),
      createdAt: productDoc.data().createdAt?.toDate() || new Date(),
      updatedAt: productDoc.data().updatedAt?.toDate() || new Date(),
    } as Product;
  } catch (error) {
    console.error('Error fetching product:', error);
    return null;
  }
}

/**
 * Get all auctions (admin only)
 */
export async function getAllAuctions(): Promise<Auction[]> {
  try {
    const auctionsSnapshot = await getDocs(collection(db, 'auctions'));
    return auctionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      startTime: doc.data().startTime?.toDate() || new Date(),
      endTime: doc.data().endTime?.toDate() || new Date(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as Auction[];
  } catch (error) {
    console.error('Error fetching auctions:', error);
    return [];
  }
}

/**
 * Delete a product (admin only)
 */
export async function deleteProduct(productId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteDoc(doc(db, 'products', productId));
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete an auction (admin only)
 */
export async function deleteAuction(auctionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteDoc(doc(db, 'auctions', auctionId));
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Update auction status (admin only)
 */
export async function updateAuctionStatus(
  auctionId: string,
  status: 'active' | 'ended' | 'cancelled'
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateDoc(doc(db, 'auctions', auctionId), {
      status,
      updatedAt: Timestamp.fromDate(new Date()),
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Create a new product (admin can create for any user)
 */
export async function createProduct(productData: Omit<Product, 'id'>): Promise<{ success: boolean; productId?: string; error?: string }> {
  try {
    const docRef = await addDoc(collection(db, 'products'), {
      ...productData,
      createdAt: Timestamp.fromDate(productData.createdAt),
      updatedAt: Timestamp.fromDate(productData.updatedAt),
    });
    return { success: true, productId: docRef.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Update a product (admin can update any product)
 */
export async function updateProduct(
  productId: string,
  updates: Partial<Omit<Product, 'id' | 'createdAt'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: any = {
      ...updates,
      updatedAt: Timestamp.fromDate(new Date()),
    };
    await updateDoc(doc(db, 'products', productId), updateData);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Create a new auction (admin can create for any product)
 */
export async function createAuction(auctionData: Omit<Auction, 'id'>): Promise<{ success: boolean; auctionId?: string; error?: string }> {
  try {
    const docRef = await addDoc(collection(db, 'auctions'), {
      ...auctionData,
      startTime: Timestamp.fromDate(auctionData.startTime),
      endTime: Timestamp.fromDate(auctionData.endTime),
      createdAt: Timestamp.fromDate(auctionData.createdAt),
      updatedAt: Timestamp.fromDate(auctionData.updatedAt),
    });
    return { success: true, auctionId: docRef.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get platform statistics (admin only)
 */
export async function getPlatformStats(): Promise<{
  totalUsers: number;
  totalProducts: number;
  totalAuctions: number;
  activeAuctions: number;
  endedAuctions: number;
}> {
  try {
    const [usersSnapshot, productsSnapshot, auctionsSnapshot] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'products')),
      getDocs(collection(db, 'auctions')),
    ]);

    const auctions = auctionsSnapshot.docs.map(doc => doc.data());
    const activeAuctions = auctions.filter(a => a.status === 'active').length;
    const endedAuctions = auctions.filter(a => a.status === 'ended').length;

    return {
      totalUsers: usersSnapshot.size,
      totalProducts: productsSnapshot.size,
      totalAuctions: auctionsSnapshot.size,
      activeAuctions,
      endedAuctions,
    };
  } catch (error) {
    console.error('Error fetching platform stats:', error);
    return {
      totalUsers: 0,
      totalProducts: 0,
      totalAuctions: 0,
      activeAuctions: 0,
      endedAuctions: 0,
    };
  }
}

/**
 * Delete a user (admin only) - WARNING: This will not delete user's auth account
 */
export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteDoc(doc(db, 'users', userId));
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Approve a product (admin only)
 */
export async function approveProduct(productId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await updateDoc(doc(db, 'products', productId), {
      status: 'approved',
      updatedAt: Timestamp.fromDate(new Date()),
    });

    // Send email notification to product owner (non-blocking)
    const productDoc = await getDoc(doc(db, 'products', productId));
    if (productDoc.exists()) {
      const productData = productDoc.data();
      if (productData.ownerId) {
        const ownerDoc = await getDoc(doc(db, 'users', productData.ownerId));
        if (ownerDoc.exists()) {
          const ownerData = ownerDoc.data();
          sendProductApprovedEmail(
            ownerData.email,
            productData.name || 'Produs',
            productId
          ).catch(error => {
            console.error('Failed to send product approved email:', error);
          });
        }

        // Remove the collection item if it was created from collection
        try {
          const collectionRef = collection(db, 'users', productData.ownerId, 'collection');
          const q = query(collectionRef, where('salePendingId', '==', productId));
          const snapshot = await getDocs(q);

          if (!snapshot.empty) {
            // Remove the collection item
            await deleteDoc(snapshot.docs[0].ref);
          } else {
            // Check for auction pending
            const auctionQ = query(collectionRef, where('auctionPendingId', '==', productId));
            const auctionSnapshot = await getDocs(auctionQ);
            if (!auctionSnapshot.empty) {
              await deleteDoc(auctionSnapshot.docs[0].ref);
            }
          }
        } catch (error) {
          console.error('Failed to remove collection item after product approval:', error);
          // Don't fail the approval for this
        }
      }
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Reject a product (admin only)
 */
export async function rejectProduct(productId: string, reason: string = 'Produsul nu îndeplinește criteriile platformei'): Promise<{ success: boolean; error?: string }> {
  try {
    await updateDoc(doc(db, 'products', productId), {
      status: 'rejected',
      updatedAt: Timestamp.fromDate(new Date()),
    });

    // Send email notification to product owner (non-blocking)
    const productDoc = await getDoc(doc(db, 'products', productId));
    if (productDoc.exists()) {
      const productData = productDoc.data();
      if (productData.ownerId) {
        const ownerDoc = await getDoc(doc(db, 'users', productData.ownerId));
        if (ownerDoc.exists()) {
          const ownerData = ownerDoc.data();
          sendProductRejectedEmail(
            ownerData.email,
            productData.name || 'Produs',
            reason
          ).catch(error => {
            console.error('Failed to send product rejected email:', error);
          });
        }
      }
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Approve an auction (admin only) - changes status from pending to active
 */
export async function approveAuction(auctionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get auction data first
    const auctionDoc = await getDoc(doc(db, 'auctions', auctionId));
    if (!auctionDoc.exists()) {
      return { success: false, error: 'Auction not found' };
    }
    const auctionData = auctionDoc.data();

    await updateDoc(doc(db, 'auctions', auctionId), {
      status: 'active',
      updatedAt: Timestamp.fromDate(new Date()),
    });

    // Also approve the associated product
    if (auctionData.productId) {
      try {
        await updateDoc(doc(db, 'products', auctionData.productId), {
          status: 'approved',
          updatedAt: Timestamp.fromDate(new Date()),
        });

        // Send email notification to product owner (non-blocking)
        const productDoc = await getDoc(doc(db, 'products', auctionData.productId));
        if (productDoc.exists()) {
          const productData = productDoc.data();
          if (productData.ownerId) {
            const ownerDoc = await getDoc(doc(db, 'users', productData.ownerId));
            if (ownerDoc.exists()) {
              const ownerData = ownerDoc.data();
              sendProductApprovedEmail(
                ownerData.email,
                productData.name || 'Produs',
                auctionData.productId
              ).catch(error => {
                console.error('Failed to send product approved email:', error);
              });
            }
          }
        }
      } catch (error) {
        console.error('Failed to approve associated product:', error);
      }
    }

    // Send email notification to auction owner (non-blocking)
    if (auctionData.ownerId) {
      const ownerDoc = await getDoc(doc(db, 'users', auctionData.ownerId));
      if (ownerDoc.exists()) {
        const ownerData = ownerDoc.data();
        // Get product name for better email
        let auctionTitle = `Licitație ${auctionId}`;
        if (auctionData.productId) {
          const productDoc = await getDoc(doc(db, 'products', auctionData.productId));
          if (productDoc.exists()) {
            auctionTitle = productDoc.data().name || auctionTitle;
          }
        }
        sendAuctionApprovedEmail(
          ownerData.email,
          auctionTitle,
          auctionId
        ).catch(error => {
          console.error('Failed to send auction approved email:', error);
        });
      }

      // Remove the collection item if it was created from collection
      try {
        const collectionRef = collection(db, 'users', auctionData.ownerId, 'collection');
        const q = query(collectionRef, where('auctionPendingId', '==', auctionData.productId));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          // Remove the collection item
          await deleteDoc(snapshot.docs[0].ref);
        }
      } catch (error) {
        console.error('Failed to remove collection item after auction approval:', error);
        // Don't fail the approval for this
      }
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Reject an auction (admin only)
 */
export async function rejectAuction(auctionId: string, reason: string = 'Licitația nu îndeplinește criteriile platformei'): Promise<{ success: boolean; error?: string }> {
  try {
    await updateDoc(doc(db, 'auctions', auctionId), {
      status: 'rejected',
      updatedAt: Timestamp.fromDate(new Date()),
    });

    // Send email notification to auction owner (non-blocking)
    const auctionDoc = await getDoc(doc(db, 'auctions', auctionId));
    if (auctionDoc.exists()) {
      const auctionData = auctionDoc.data();
      if (auctionData.ownerId) {
        const ownerDoc = await getDoc(doc(db, 'users', auctionData.ownerId));
        if (ownerDoc.exists()) {
          const ownerData = ownerDoc.data();
          // Get product name for better email
          let auctionTitle = `Licitație ${auctionId}`;
          if (auctionData.productId) {
            const productDoc = await getDoc(doc(db, 'products', auctionData.productId));
            if (productDoc.exists()) {
              auctionTitle = productDoc.data().name || auctionTitle;
            }
          }
          sendAuctionRejectedEmail(
            ownerData.email,
            auctionTitle,
            reason
          ).catch(error => {
            console.error('Failed to send auction rejected email:', error);
          });
        }
      }
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get pending products (admin only)
 */
export async function getPendingProducts(): Promise<Product[]> {
  try {
    const q = query(collection(db, 'products'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as Product[];
  } catch (error) {
    console.error('Error fetching pending products:', error);
    return [];
  }
}

/**
 * Get pending auctions (admin only)
 */
export async function getPendingAuctions(): Promise<Auction[]> {
  try {
    const q = query(collection(db, 'auctions'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      startTime: doc.data().startTime?.toDate() || new Date(),
      endTime: doc.data().endTime?.toDate() || new Date(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as Auction[];
  } catch (error) {
    console.error('Error fetching pending auctions:', error);
    return [];
  }
}

/**
 * Force end an auction (admin only)
 */
export async function forceEndAuction(auctionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Call the endAuction function to handle winner determination logic
    await endAuction(auctionId);
    
    // Set the auction time to 0 when ended by admins
    const now = new Date();
    await updateDoc(doc(db, 'auctions', auctionId), {
      endTime: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
    });
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get users with pending identity verification (admin only)
 */
export async function getUsersWithPendingVerification(): Promise<User[]> {
  try {
    const q = query(
      collection(db, 'users'),
      where('idVerificationStatus', '==', 'pending'),
      orderBy('updatedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as User[];
  } catch (error) {
    console.error('Error fetching users with pending verification:', error);
    return [];
  }
}

/**
 * Get rejected items for review (admin only)
 */
export async function getRejectedProducts(): Promise<Product[]> {
  try {
    const q = query(collection(db, 'products'), where('status', '==', 'rejected'), orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as Product[];
  } catch (error) {
    console.error('Error fetching rejected products:', error);
    return [];
  }
}

/**
 * Get rejected auctions for review (admin only)
 */
export async function getRejectedAuctions(): Promise<Auction[]> {
  try {
    const q = query(collection(db, 'auctions'), where('status', '==', 'rejected'), orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      startTime: doc.data().startTime?.toDate() || new Date(),
      endTime: doc.data().endTime?.toDate() || new Date(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as Auction[];
  } catch (error) {
    console.error('Error fetching rejected auctions:', error);
    return [];
  }
}

/**
 * Get user's collection items (admin only)
 */
export async function getUserCollection(userId: string): Promise<CollectionItem[]> {
  try {
    const collectionRef = collection(db, 'users', userId, 'collection');
    const snapshot = await getDocs(query(collectionRef, orderBy('createdAt', 'desc')));
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      acquisitionDate: doc.data().acquisitionDate?.toDate(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as CollectionItem[];
  } catch (error) {
    console.error('Error fetching user collection:', error);
    return [];
  }
}

/**
 * Get user's conversations (admin only)
 * Tries ordered query first; falls back to simple where() if Firestore index is missing.
 */
export async function getUserConversations(userId: string): Promise<Conversation[]> {
  try {
    const conversationsRef = collection(db, 'conversations');

    let snapshot;
    try {
      // Prefer ordered conversations by updatedAt
      const q = query(
        conversationsRef,
        where('participants', 'array-contains', userId),
        orderBy('updatedAt', 'desc'),
      );
      snapshot = await getDocs(q);
    } catch (err) {
      // Fallback without orderBy if index is missing or query fails
      console.error(
        'Error fetching user conversations with orderBy, retrying without orderBy:',
        err,
      );
      const fallbackQ = query(
        conversationsRef,
        where('participants', 'array-contains', userId),
      );
      snapshot = await getDocs(fallbackQ);
    }

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        lastMessageAt: data.lastMessageAt?.toDate(),
      } as Conversation;
    });
  } catch (error) {
    console.error('Error fetching user conversations:', error);
    return [];
  }
}

/**
 * Get conversation messages (admin only)
 */
export async function getConversationMessages(conversationId: string): Promise<ChatMessage[]> {
  try {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(100));
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() || new Date(),
      editedAt: doc.data().editedAt?.toDate(),
    })) as ChatMessage[];
  } catch (error) {
    console.error('Error fetching conversation messages:', error);
    return [];
  }
}

/**
 * Get auction chat messages (admin only)
 */
export async function getAuctionChatMessages(auctionId: string): Promise<ChatMessage[]> {
  try {
    const chatRef = collection(db, 'auctions', auctionId, 'publicChat');
    const q = query(chatRef, orderBy('timestamp', 'asc'), limit(100));
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() || new Date(),
      editedAt: doc.data().editedAt?.toDate(),
    })) as ChatMessage[];
  } catch (error) {
    console.error('Error fetching auction chat messages:', error);
    return [];
  }
}

/**
 * Get detailed user analytics (admin only)
 */
export async function getUserAnalytics(userId: string): Promise<{
  totalProducts: number;
  approvedProducts: number;
  pendingProducts: number;
  rejectedProducts: number;
  totalAuctions: number;
  activeAuctions: number;
  endedAuctions: number;
  totalBids: number;
  totalCollectionItems: number;
  totalConversations: number;
  collectionValue: number;
}> {
  try {
    // Get user's products
    const productsRef = collection(db, 'products');
    const productsQuery = query(productsRef, where('ownerId', '==', userId));
    const productsSnapshot = await getDocs(productsQuery);
    const products = productsSnapshot.docs.map(doc => doc.data());

    // Get auctions for user's products
    const productIds = productsSnapshot.docs.map(doc => doc.id);
    let auctions: any[] = [];
    if (productIds.length > 0) {
      const auctionsRef = collection(db, 'auctions');
      const auctionsQuery = query(auctionsRef, where('productId', 'in', productIds.slice(0, 10))); // Firestore limit
      const auctionsSnapshot = await getDocs(auctionsQuery);
      auctions = auctionsSnapshot.docs.map(doc => doc.data());
    }

    // Get user's bids across all auctions
    const allAuctionsSnapshot = await getDocs(collection(db, 'auctions'));
    let totalBids = 0;
    for (const auctionDoc of allAuctionsSnapshot.docs) {
      const bidsRef = collection(db, 'auctions', auctionDoc.id, 'bids');
      const bidsQuery = query(bidsRef, where('userId', '==', userId));
      const bidsSnapshot = await getDocs(bidsQuery);
      totalBids += bidsSnapshot.size;
    }

    // Get user's collection
    const collectionRef = collection(db, 'users', userId, 'collection');
    const collectionSnapshot = await getDocs(collectionRef);
    const collectionItems = collectionSnapshot.docs.map(doc => doc.data());
    const collectionValue = collectionItems.reduce((sum, item) => sum + (item.currentValue || 0), 0);

    // Get user's conversations (shared logic with admin conversations view)
    const userConversations = await getUserConversations(userId);

    return {
      totalProducts: products.length,
      approvedProducts: products.filter(p => p.status === 'approved').length,
      pendingProducts: products.filter(p => p.status === 'pending').length,
      rejectedProducts: products.filter(p => p.status === 'rejected').length,
      totalAuctions: auctions.length,
      activeAuctions: auctions.filter(a => a.status === 'active').length,
      endedAuctions: auctions.filter(a => a.status === 'ended').length,
      totalBids,
      totalCollectionItems: collectionSnapshot.size,
      totalConversations: userConversations.length,
      collectionValue,
    };
  } catch (error) {
    console.error('Error fetching user analytics:', error);
    return {
      totalProducts: 0,
      approvedProducts: 0,
      pendingProducts: 0,
      rejectedProducts: 0,
      totalAuctions: 0,
      activeAuctions: 0,
      endedAuctions: 0,
      totalBids: 0,
      totalCollectionItems: 0,
      totalConversations: 0,
      collectionValue: 0,
    };
  }
}

/**
 * Get all conversations (admin only)
 */
export async function getAllConversations(): Promise<Conversation[]> {
  try {
    const conversationsRef = collection(db, 'conversations');
    const q = query(conversationsRef, orderBy('updatedAt', 'desc'), limit(100));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      lastMessageAt: doc.data().lastMessageAt?.toDate(),
    })) as Conversation[];
  } catch (error) {
    console.error('Error fetching all conversations:', error);
    return [];
  }
}

/**
 * Delete a conversation (admin only)
 */
export async function deleteConversation(conversationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete all messages first
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const messagesSnapshot = await getDocs(messagesRef);
    
    const deletePromises = messagesSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    
    // Delete conversation
    await deleteDoc(doc(db, 'conversations', conversationId));
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete a collection item (admin only)
 */
export async function deleteUserCollectionItem(
  userId: string,
  itemId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteDoc(doc(db, 'users', userId, 'collection', itemId));
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Republish a sold product back to e-shop (admin only)
 */
export async function republishProduct(productId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await updateDoc(doc(db, 'products', productId), {
      isSold: false,
      status: 'approved',
      updatedAt: Timestamp.fromDate(new Date()),
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Update user status (admin only) - suspend, ban, or verify a user
 */
export async function updateUserStatus(
  userId: string,
  action: 'suspend' | 'ban' | 'verify',
  adminUserId: string,
  adminEmail: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const updates: any = {
      updatedAt: Timestamp.fromDate(new Date()),
    };

    switch (action) {
      case 'suspend':
        updates.status = 'suspended';
        updates.suspendedAt = Timestamp.fromDate(new Date());
        updates.suspendedBy = adminUserId;
        updates.suspensionReason = reason;
        break;
      case 'ban':
        updates.status = 'banned';
        updates.bannedAt = Timestamp.fromDate(new Date());
        updates.bannedBy = adminUserId;
        updates.banReason = reason;
        break;
      case 'verify':
        updates.verified = true;
        updates.verifiedAt = Timestamp.fromDate(new Date());
        updates.verifiedBy = adminUserId;
        updates.verificationReason = reason;
        break;
    }

    await updateDoc(doc(db, 'users', userId), updates);

    // Log the admin action
    await addDoc(collection(db, 'adminActions'), {
      adminUserId,
      adminEmail,
      action: `user_${action}`,
      targetUserId: userId,
      reason,
      timestamp: Timestamp.fromDate(new Date()),
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error updating user status:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user activity logs (admin only)
 */
export async function getUserActivity(userId: string): Promise<any[]> {
  try {
    // Get activity logs from activityLogs collection
    const activityLogsRef = collection(db, 'activityLogs');
    const q = query(
      activityLogsRef,
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(100)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp,
      type: doc.data().eventType || 'activity',
      description: formatActivityDescription(doc.data()),
      details: doc.data().metadata ? JSON.stringify(doc.data().metadata, null, 2) : undefined,
    }));
  } catch (error) {
    console.error('Error fetching user activity:', error);
    return [];
  }
}

/**
 * Helper function to format activity description
 */
function formatActivityDescription(data: any): string {
  const eventType = data.eventType;
  const metadata = data.metadata || {};

  switch (eventType) {
    case 'user_login':
      return 'Utilizator autentificat';
    case 'user_logout':
      return 'Utilizator deconectat';
    case 'user_register':
      return 'Cont creat';
    case 'product_view':
      return `Produs vizualizat: ${metadata.productName || metadata.productId || 'N/A'}`;
    case 'product_create':
      return `Produs creat: ${metadata.productName || metadata.productId || 'N/A'}`;
    case 'product_update':
      return `Produs actualizat: ${metadata.productName || metadata.productId || 'N/A'}`;
    case 'product_delete':
      return `Produs șters: ${metadata.productName || metadata.productId || 'N/A'}`;
    case 'auction_view':
      return `Licitație vizualizată: ${metadata.auctionId || 'N/A'}`;
    case 'auction_create':
      return `Licitație creată: ${metadata.auctionId || 'N/A'}`;
    case 'auction_bid':
      return `Ofertă plasată: ${metadata.bidAmount || 'N/A'} RON`;
    case 'message_send':
      return `Mesaj trimis în conversația ${metadata.conversationId || 'N/A'}`;
    case 'page_view':
      return `Pagină vizualizată: ${metadata.page || 'N/A'}`;
    default:
      return eventType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
  }
}
