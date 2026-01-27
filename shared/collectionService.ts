import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { CollectionItem } from './types';

/**
 * Add an item to user's personal collection
 */
export async function addCollectionItem(
  userId: string,
  itemData: Omit<CollectionItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  transaction?: any
): Promise<string> {
  if (!db) throw new Error('Firestore not initialized');

  const collectionRef = collection(db, 'users', userId, 'collection');
  
  const data: any = {
    userId,
    name: itemData.name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // Add optional fields only if they have values
  if (itemData.description) data.description = itemData.description;
  if (itemData.images && itemData.images.length > 0) data.images = itemData.images;
  if (itemData.country) data.country = itemData.country;
  if (itemData.year) data.year = itemData.year;
  if (itemData.era) data.era = itemData.era;
  if (itemData.denomination) data.denomination = itemData.denomination;
  if (itemData.metal) data.metal = itemData.metal;
  if (itemData.grade) data.grade = itemData.grade;
  if (itemData.mintMark) data.mintMark = itemData.mintMark;
  if (itemData.rarity) data.rarity = itemData.rarity;
  if (itemData.weight) data.weight = itemData.weight;
  if (itemData.diameter) data.diameter = itemData.diameter;
  if (itemData.category) data.category = itemData.category;
  if (itemData.acquisitionDate) data.acquisitionDate = Timestamp.fromDate(itemData.acquisitionDate);
  if (itemData.acquisitionPrice) data.acquisitionPrice = itemData.acquisitionPrice;
  if (itemData.currentValue) data.currentValue = itemData.currentValue;
  if (itemData.notes) data.notes = itemData.notes;
  if (itemData.tags && itemData.tags.length > 0) data.tags = itemData.tags;

  if (transaction) {
    // If transaction is provided, use it to add the document
    const docRef = doc(collectionRef);
    transaction.set(docRef, data);
    return docRef.id;
  } else {
    // If no transaction, perform regular add operation
    const docRef = await addDoc(collectionRef, data);
    return docRef.id;
  }
}

/**
 * Update a collection item
 */
export async function updateCollectionItem(
  userId: string,
  itemId: string,
  updates: Partial<Omit<CollectionItem, 'id' | 'userId' | 'createdAt'>>
): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  const itemRef = doc(db, 'users', userId, 'collection', itemId);
  
  const data: any = {
    updatedAt: serverTimestamp(),
  };

  // Add fields that are being updated
  Object.keys(updates).forEach(key => {
    const value = (updates as any)[key];
    if (value !== undefined) {
      if (key === 'acquisitionDate' && value instanceof Date) {
        data[key] = Timestamp.fromDate(value);
      } else {
        data[key] = value;
      }
    }
  });

  await updateDoc(itemRef, data);
}

/**
 * Delete a collection item
 */
export async function deleteCollectionItem(
  userId: string,
  itemId: string
): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  const itemRef = doc(db, 'users', userId, 'collection', itemId);
  await deleteDoc(itemRef);
}

/**
 * Get a single collection item
 */
export async function getCollectionItem(
  userId: string,
  itemId: string
): Promise<CollectionItem | null> {
  if (!db) throw new Error('Firestore not initialized');

  const itemRef = doc(db, 'users', userId, 'collection', itemId);
  const itemDoc = await getDoc(itemRef);

  if (!itemDoc.exists()) return null;

  const data = itemDoc.data();
  return {
    id: itemDoc.id,
    ...data,
    acquisitionDate: data.acquisitionDate?.toDate(),
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  } as CollectionItem;
}

/**
 * Subscribe to user's collection items
 */
export function subscribeToUserCollection(
  userId: string,
  callback: (items: CollectionItem[]) => void,
  orderByField: 'createdAt' | 'name' | 'year' | 'currentValue' = 'createdAt',
  orderDirection: 'asc' | 'desc' = 'desc'
): () => void {
  if (!db) throw new Error('Firestore not initialized');

  const collectionRef = collection(db, 'users', userId, 'collection');
  const q = query(collectionRef, orderBy(orderByField, orderDirection));

  return onSnapshot(q, (snapshot) => {
    const items: CollectionItem[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      items.push({
        id: doc.id,
        ...data,
        acquisitionDate: data.acquisitionDate?.toDate(),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as CollectionItem);
    });
    callback(items);
  });
}

/**
 * Get collection statistics
 */
export async function getCollectionStats(userId: string): Promise<{
  totalItems: number;
  totalValue: number;
  totalInvestment: number;
  byCountry: { [country: string]: number };
  byMetal: { [metal: string]: number };
  byRarity: { [rarity: string]: number };
}> {
  if (!db) throw new Error('Firestore not initialized');

  const collectionRef = collection(db, 'users', userId, 'collection');
  const snapshot = await getDocs(collectionRef);

  const stats = {
    totalItems: 0,
    totalValue: 0,
    totalInvestment: 0,
    byCountry: {} as { [country: string]: number },
    byMetal: {} as { [metal: string]: number },
    byRarity: {} as { [rarity: string]: number },
  };

  snapshot.forEach((doc) => {
    const data = doc.data() as CollectionItem;
    stats.totalItems++;
    
    if (data.currentValue) stats.totalValue += data.currentValue;
    if (data.acquisitionPrice) stats.totalInvestment += data.acquisitionPrice;
    
    if (data.country) {
      stats.byCountry[data.country] = (stats.byCountry[data.country] || 0) + 1;
    }
    if (data.metal) {
      stats.byMetal[data.metal] = (stats.byMetal[data.metal] || 0) + 1;
    }
    if (data.rarity) {
      stats.byRarity[data.rarity] = (stats.byRarity[data.rarity] || 0) + 1;
    }
  });

  return stats;
}

/**
 * Search collection items
 */
export async function searchCollectionItems(
  userId: string,
  searchTerm: string
): Promise<CollectionItem[]> {
  if (!db) throw new Error('Firestore not initialized');

  const collectionRef = collection(db, 'users', userId, 'collection');
  const snapshot = await getDocs(collectionRef);

  const items: CollectionItem[] = [];
  const searchLower = searchTerm.toLowerCase();

  snapshot.forEach((doc) => {
    const data = doc.data();
    const matchesSearch =
      data.name?.toLowerCase().includes(searchLower) ||
      data.description?.toLowerCase().includes(searchLower) ||
      data.country?.toLowerCase().includes(searchLower) ||
      data.denomination?.toLowerCase().includes(searchLower) ||
      data.notes?.toLowerCase().includes(searchLower) ||
      data.tags?.some((tag: string) => tag.toLowerCase().includes(searchLower));

    if (matchesSearch) {
      items.push({
        id: doc.id,
        ...data,
        acquisitionDate: data.acquisitionDate?.toDate(),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as CollectionItem);
    }
  });

  return items;
}