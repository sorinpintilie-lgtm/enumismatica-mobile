import { collection, doc, getDoc, getDocs, setDoc, query, where, Timestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { SiteAsset } from './types';
import { uploadImage } from './storageService';
import { createResponsiveImageProps } from './utils/responsiveImageUtils';

const SITE_ASSETS_COLLECTION = 'siteAssets';

/**
 * Get a site asset by its name
 * @param name - The unique name of the asset (e.g., 'logo', 'homepage-hero')
 * @returns The site asset or null if not found
 */
export async function getSiteAsset(name: string): Promise<SiteAsset | null> {
  try {
    // Fast path: we use the asset "name" as the Firestore document ID,
    // so we can read it directly instead of running a query.
    const docRef = doc(db, SITE_ASSETS_COLLECTION, name);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();

    // Respect the "active" flag if present
    if (data.active === false) {
      return null;
    }

    return {
      id: snapshot.id,
      name: data.name,
      description: data.description,
      imageUrl: data.imageUrl,
      altText: data.altText,
      type: data.type,
      active: data.active,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  } catch (error) {
    console.error('Error getting site asset:', error);
    throw error;
  }
}

/**
 * Get all active site assets
 * @returns Array of active site assets
 */
export async function getAllSiteAssets(): Promise<SiteAsset[]> {
  try {
    const q = query(
      collection(db, SITE_ASSETS_COLLECTION),
      where('active', '==', true)
    );
    
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        description: data.description,
        imageUrl: data.imageUrl,
        altText: data.altText,
        type: data.type,
        active: data.active,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };
    });
  } catch (error) {
    console.error('Error getting all site assets:', error);
    throw error;
  }
}

/**
 * Create or update a site asset
 * @param asset - The site asset data (without id)
 * @param file - Optional file to upload
 * @returns The created/updated site asset
 */
export async function createOrUpdateSiteAsset(
  asset: Omit<SiteAsset, 'id' | 'createdAt' | 'updatedAt'>,
  file?: File
): Promise<SiteAsset> {
  try {
    // Check if asset with this name already exists
    const existingAsset = await getSiteAsset(asset.name);
    
    let imageUrl = asset.imageUrl;
    
    // Upload new image if file is provided
    if (file) {
      const storagePath = `site-assets/${asset.name}/${Date.now()}_${file.name}`;
      imageUrl = await uploadImage(file, storagePath);
    }
    
    const now = Timestamp.now();
    const assetData = {
      name: asset.name,
      description: asset.description || '',
      imageUrl,
      altText: asset.altText,
      type: asset.type,
      active: asset.active,
      updatedAt: now,
      ...(existingAsset ? {} : { createdAt: now }),
    };
    
    // Use the name as the document ID for easy retrieval
    const docRef = doc(db, SITE_ASSETS_COLLECTION, asset.name);
    await setDoc(docRef, assetData, { merge: true });
    
    return {
      id: asset.name,
      ...asset,
      imageUrl,
      createdAt: existingAsset?.createdAt || now.toDate(),
      updatedAt: now.toDate(),
    };
  } catch (error) {
    console.error('Error creating/updating site asset:', error);
    throw error;
  }
}

/**
 * Upload a local file as a site asset
 * @param name - Unique name for the asset
 * @param localPath - Path to the local file
 * @param altText - Alt text for the image
 * @param type - Type of asset
 * @param description - Optional description
 * @returns The created site asset
 */
export async function uploadLocalFileAsSiteAsset(
  name: string,
  localPath: string,
  altText: string,
  type: SiteAsset['type'],
  description?: string
): Promise<SiteAsset> {
  try {
    // Fetch the local file
    const response = await fetch(localPath);
    const blob = await response.blob();
    
    // Create a File object from the blob
    const filename = localPath.split('/').pop() || 'asset.png';
    const file = new File([blob], filename, { type: blob.type });
    
    // Upload using the createOrUpdateSiteAsset function
    return await createOrUpdateSiteAsset(
      {
        name,
        description: description || '',
        imageUrl: '', // Will be set by uploadImage
        altText,
        type,
        active: true,
      },
      file
    );
  } catch (error) {
    console.error('Error uploading local file as site asset:', error);
    throw error;
  }
}

/**
 * Deactivate a site asset
 * @param name - The name of the asset to deactivate
 */
export async function deactivateSiteAsset(name: string): Promise<void> {
  try {
    const docRef = doc(db, SITE_ASSETS_COLLECTION, name);
    await setDoc(docRef, { active: false, updatedAt: Timestamp.now() }, { merge: true });
  } catch (error) {
    console.error('Error deactivating site asset:', error);
    throw error;
  }
}

/**
 * Get responsive image props for a site asset
 * @param asset - Site asset
 * @returns Object with responsive image props
 */
export function getResponsiveImageProps(asset: SiteAsset): {
  srcSet: string;
  sizes: string;
  src: string;
  alt?: string;
} {
  const { srcSet, sizes } = createResponsiveImageProps(asset.imageUrl, {
    widths: [400, 800, 1200, 1600],
    defaultSize: '100vw'
  });

  return {
    srcSet,
    sizes,
    src: asset.imageUrl,
    alt: (asset.altText || '') as string,
  };
}
