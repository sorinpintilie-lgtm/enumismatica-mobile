import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { storage } from './firebaseConfig';
import { convertToWebP } from './utils/imageUtils';

const MAX_UPLOAD_IMAGE_KB = 750;
const MAX_CONCURRENT_IMAGE_UPLOADS = 2;

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const current = nextIndex++;
      if (current >= items.length) return;
      results[current] = await mapper(items[current], current);
    }
  });

  await Promise.all(workers);
  return results;
}

async function optimizeImageForUpload(file: File): Promise<File> {
	// Fast-path: already in target format and under size limit.
	if (file.type === 'image/webp' && file.size <= MAX_UPLOAD_IMAGE_KB * 1024) {
		console.log('[uploadImage] Optimization skipped (already WebP + under limit)', {
			name: file.name,
			size: file.size,
			type: file.type,
		});
		return file;
	}

	// Use server-side Tinify (via Next.js API route) when running in a browser.
	// This keeps the Tinify API key on the server (Netlify env: TINIFY_API_KEY).
	const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
	const hasCreateImageBitmap = isBrowser && typeof (window as any).createImageBitmap !== 'undefined';
	const hasOffscreenCanvas = isBrowser && typeof (window as any).OffscreenCanvas !== 'undefined';
	const hasCanvasToBlob = isBrowser && typeof (document?.createElement('canvas') as any)?.toBlob !== 'undefined';
	const canClientConvertToWebP = isBrowser && hasCanvasToBlob;

	console.log('[uploadImage] Optimization decision inputs', {
		name: file.name,
		size: file.size,
		type: file.type,
		isBrowser,
		hasCreateImageBitmap,
		hasOffscreenCanvas,
		hasCanvasToBlob,
		canClientConvertToWebP,
	});

	// If the file is relatively small and the browser can convert locally, prefer local conversion.
	// This significantly reduces Tinify traffic when many users upload at once.
	const LOCAL_CONVERT_THRESHOLD_BYTES = 1024 * 1024; // 1MB
	if (canClientConvertToWebP && file.size <= LOCAL_CONVERT_THRESHOLD_BYTES) {
		console.log('[uploadImage] Using local WebP conversion (small file)', {
			name: file.name,
			size: file.size,
			threshold: LOCAL_CONVERT_THRESHOLD_BYTES,
		});
		return await convertToWebP(file, MAX_UPLOAD_IMAGE_KB);
	}

	if (isBrowser) {
		try {
			console.log('[uploadImage] Using server Tinify via /api/tinify', {
				name: file.name,
				size: file.size,
				type: file.type,
			});
			const formData = new FormData();
			formData.append('file', file);

			const response = await fetch('/api/tinify', {
				method: 'POST',
				body: formData,
			});

			if (response.status === 429) {
				console.warn('[uploadImage] Tinify rate-limited (429). Falling back to local WebP conversion.');
				return await convertToWebP(file, MAX_UPLOAD_IMAGE_KB);
			}

			if (response.ok) {
				const originalSizeHeader = response.headers.get('x-original-size');
				const optimizedSizeHeader = response.headers.get('x-optimized-size');
				console.log('[uploadImage] Tinify responded OK', {
					name: file.name,
					xOriginalSize: originalSizeHeader,
					xOptimizedSize: optimizedSizeHeader,
				});
				const blob = await response.blob();
				const tinified = new File(
					[blob],
					file.name.replace(/\.[^/.]+$/, '.webp'),
					{ type: 'image/webp' }
				);

				// Hard guarantee: if Tinify output is still too large, do an extra browser WebP pass.
				if (tinified.size <= MAX_UPLOAD_IMAGE_KB * 1024) {
					console.log('[uploadImage] Tinify output under limit', {
						name: tinified.name,
						size: tinified.size,
						maxBytes: MAX_UPLOAD_IMAGE_KB * 1024,
					});
					return tinified;
				}

				console.warn('[uploadImage] Tinify output still over limit; attempting extra local pass', {
					name: tinified.name,
					size: tinified.size,
					maxBytes: MAX_UPLOAD_IMAGE_KB * 1024,
				});
				return await convertToWebP(tinified, MAX_UPLOAD_IMAGE_KB);
			}
		} catch (error) {
			console.warn('[uploadImage] Tinify optimization failed, falling back to browser WebP conversion', error);
		}
	}

	// Fallback: browser-only WebP conversion (or original file if conversion is unsupported).
	console.log('[uploadImage] Falling back to local WebP conversion', {
		name: file.name,
		size: file.size,
		type: file.type,
	});
	return await convertToWebP(file, MAX_UPLOAD_IMAGE_KB);
}

/**
 * Upload an image to Firebase Storage
 * @param file - The image file to upload
 * @param path - The storage path (e.g., 'products/userId/filename.jpg')
 * @returns The download URL of the uploaded image
 */
export async function uploadImage(file: File, path: string): Promise<string> {
	if (!storage) throw new Error('Firebase Storage not initialized');

	console.log('[uploadImage] Preparing upload', {
		path,
		originalSize: file.size,
		originalType: file.type,
	});

	// Optimize for upload (hard target: <= 750KB)
	const webpFile = await optimizeImageForUpload(file);

	// Update path to use .webp extension
	const webpPath = path.replace(/\.[^/.]+$/, '.webp');
	const storageRef = ref(storage, webpPath);

	console.log('[uploadImage] Uploading WebP image', {
		path: webpPath,
		size: webpFile.size,
		type: (webpFile as any).type,
	});

	try {
		const snapshot = await uploadBytes(storageRef, webpFile);
		const downloadURL = await getDownloadURL(snapshot.ref);
		console.log('[uploadImage] Upload successful', { path: webpPath });
		return downloadURL;
	} catch (error) {
		console.error('[uploadImage] Upload failed', { path: webpPath, error });
		throw error;
	}
}

/**
 * Upload a video to Firebase Storage (without conversion)
 * @param file - The video file to upload
 * @param path - The storage path (e.g., 'products/userId/videos/filename.mp4')
 * @returns The download URL of the uploaded video
 */
export async function uploadVideo(file: File, path: string): Promise<string> {
  if (!storage) throw new Error('Firebase Storage not initialized');

  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(snapshot.ref);

  return downloadURL;
}

/**
 * Upload multiple images
 * @param files - Array of image files
 * @param basePath - Base path for storage (e.g., 'products/userId')
 * @returns Array of download URLs
 */
export async function uploadMultipleImages(files: File[], basePath: string): Promise<string[]> {
	console.log('[uploadMultipleImages] Starting batch upload', {
		count: files.length,
		basePath,
		concurrency: MAX_CONCURRENT_IMAGE_UPLOADS,
	});

	return mapWithConcurrency(files, MAX_CONCURRENT_IMAGE_UPLOADS, async (file, index) => {
		const timestamp = Date.now();
		const filename = `${timestamp}_${index}_${file.name}`;
		const path = `${basePath}/${filename}`;
		console.log('[uploadMultipleImages] Uploading', {
			index,
			originalName: file.name,
			originalSize: file.size,
			path,
		});
		return uploadImage(file, path);
	});
}

/**
 * Upload product images as *raw/originals* for async server-side optimization.
 *
 * The Firebase Storage trigger (Cloud Function) will detect these uploads via metadata
 * and will write an optimized WebP back, then update the Firestore product document.
 *
 * This lets users navigate away while compression happens in the background.
 */
export async function uploadMultipleProductImagesForAsyncCompression(
	files: File[],
	ownerId: string,
	productId: string,
): Promise<string[]> {
	if (!storage) throw new Error('Firebase Storage not initialized');

	console.log('[uploadMultipleProductImagesForAsyncCompression] Starting', {
		count: files.length,
		ownerId,
		productId,
		concurrency: MAX_CONCURRENT_IMAGE_UPLOADS,
	});

	return mapWithConcurrency(files, MAX_CONCURRENT_IMAGE_UPLOADS, async (file, index) => {
		const timestamp = Date.now();
		const safeName = (file.name || `image_${index}`).replace(/[^a-zA-Z0-9._-]+/g, '_');
		const path = `products/${ownerId}/${productId}__${index}__raw__${timestamp}__${safeName}`;

		console.log('[uploadMultipleProductImagesForAsyncCompression] Uploading raw image', {
			index,
			name: file.name,
			size: file.size,
			type: file.type,
			path,
		});

		const storageRef = ref(storage, path);
		const snapshot = await uploadBytes(storageRef, file, {
			contentType: file.type || 'application/octet-stream',
			customMetadata: {
				needsOptimization: 'true',
				ownerId,
				productId,
				index: String(index),
			},
		});

		const downloadURL = await getDownloadURL(snapshot.ref);
		return downloadURL;
	});
}

/**
 * Delete an image from Firebase Storage
 * @param imageUrl - The full download URL of the image
 */
export async function deleteImage(imageUrl: string): Promise<void> {
  if (!storage) throw new Error('Firebase Storage not initialized');

  try {
    // Extract the path from the download URL
    const url = new URL(imageUrl);
    const pathMatch = url.pathname.match(/\/o\/(.+?)\?/);
    
    if (pathMatch && pathMatch[1]) {
      const path = decodeURIComponent(pathMatch[1]);
      const storageRef = ref(storage, path);
      await deleteObject(storageRef);
    }
  } catch (error) {
    console.error('Error deleting image:', error);
    throw error;
  }
}

/**
 * Delete multiple images
 * @param imageUrls - Array of image URLs to delete
 */
export async function deleteMultipleImages(imageUrls: string[]): Promise<void> {
  const deletePromises = imageUrls.map(url => deleteImage(url).catch(console.error));
  await Promise.all(deletePromises);
}

/**
 * Upload image from URL (for seeding)
 * @param imageUrl - URL of the image to fetch and upload
 * @param storagePath - Path in Firebase Storage
 * @returns Download URL
 */
export async function uploadImageFromURL(imageUrl: string, storagePath: string): Promise<string> {
  if (!storage) throw new Error('Firebase Storage not initialized');

  try {
    // Fetch the image
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    
    // Upload to Firebase Storage
    const storageRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading image from URL:', error);
    throw error;
  }
}

/**
 * Upload local file to Firebase Storage (for seeding from local files)
 * @param localPath - Local file path
 * @param storagePath - Path in Firebase Storage
 * @returns Download URL
 */
export async function uploadLocalImage(localPath: string, storagePath: string): Promise<string> {
  if (!storage) throw new Error('Firebase Storage not initialized');
  
  // For browser environment, we need to fetch the file from public folder
  const response = await fetch(localPath);
  const blob = await response.blob();
  
  const storageRef = ref(storage, storagePath);
  const snapshot = await uploadBytes(storageRef, blob);
  const downloadURL = await getDownloadURL(snapshot.ref);
  
  return downloadURL;
}

/**
 * List all images in a storage path
 * @param path - Storage path to list
 * @returns Array of download URLs
 */
export async function listImages(path: string): Promise<string[]> {
  if (!storage) throw new Error('Firebase Storage not initialized');

  const storageRef = ref(storage, path);
  const result = await listAll(storageRef);
  
  const urlPromises = result.items.map(itemRef => getDownloadURL(itemRef));
  return Promise.all(urlPromises);
}

/**
 * Validate image file
 * @param file - File to validate
 * @returns Validation result
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
	// Keep this limit in sync with storage.rules:isValidImageFile (15MB)
	const maxSize = 15 * 1024 * 1024; // 15MB
	const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

	if (!allowedTypes.includes(file.type)) {
		return { valid: false, error: 'Tip de fișier invalid. Folosește JPG, PNG sau WebP.' };
	}

	if (file.size > maxSize) {
		return { valid: false, error: 'Fișierul este prea mare. Dimensiunea maximă este 15MB pentru imagini.' };
	}

  return { valid: true };
}

/**
 * Upload ID document photo
 * @param file - The document photo file to upload
 * @param userId - User ID
 * @param documentType - Type of document (ci or passport)
 * @returns The download URL of the uploaded document photo
 */
export async function uploadIdDocumentPhoto(file: File, userId: string, documentType: 'ci' | 'passport'): Promise<string> {
	if (!storage) throw new Error('Firebase Storage not initialized');

	// Validate file
	const validation = validateImageFile(file);
	if (!validation.valid) {
		throw new Error(validation.error);
	}

	// Create storage path
	const timestamp = Date.now();
	const filename = `${timestamp}_${documentType}_${file.name}`;
	const path = `id-documents/${userId}/${filename}`;

	// Upload the file
	return uploadImage(file, path);
}

/**
 * Get ID document photo URLs for a user
 * @param userId - User ID
 * @returns Array of document photo URLs
 */
export async function getIdDocumentPhotos(userId: string): Promise<string[]> {
	if (!storage) throw new Error('Firebase Storage not initialized');

	const storageRef = ref(storage, `id-documents/${userId}`);
	try {
		const result = await listAll(storageRef);
		const urlPromises = result.items.map(itemRef => getDownloadURL(itemRef));
		return Promise.all(urlPromises);
	} catch (error) {
		console.error('Error listing ID document photos:', error);
		return [];
	}
}

/**
 * Delete ID document photos for a user
 * @param userId - User ID
 */
export async function deleteIdDocumentPhotos(userId: string): Promise<void> {
	if (!storage) throw new Error('Firebase Storage not initialized');

	const storageRef = ref(storage, `id-documents/${userId}`);
	try {
		const result = await listAll(storageRef);
		const deletePromises = result.items.map(itemRef => deleteObject(itemRef));
		await Promise.all(deletePromises);
	} catch (error) {
		console.error('Error deleting ID document photos:', error);
		throw error;
	}
}
