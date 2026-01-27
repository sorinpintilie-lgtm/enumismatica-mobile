import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@shared/firebaseConfig';

const MAX_IMAGE_SIZE_KB = 750; // 750KB max per image
const MAX_IMAGE_DIMENSION = 1920; // Max width/height

export interface ImageAsset {
  uri: string;
  width: number;
  height: number;
  type?: string | null;
}

/**
 * Request camera permissions
 */
export async function requestCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === 'granted';
}

/**
 * Request media library permissions
 */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

/**
 * Pick images from gallery
 */
export async function pickImagesFromGallery(maxImages: number = 10): Promise<ImageAsset[]> {
  const hasPermission = await requestMediaLibraryPermission();
  if (!hasPermission) {
    throw new Error('Permisiunea de acces la galerie a fost refuzată');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images' as any,
    allowsMultipleSelection: true,
    quality: 1,
    selectionLimit: maxImages,
  });

  if (result.canceled) {
    return [];
  }

  return result.assets.map(asset => ({
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    type: asset.type,
  }));
}

/**
 * Take photo with camera
 */
export async function takePhoto(): Promise<ImageAsset | null> {
  const hasPermission = await requestCameraPermission();
  if (!hasPermission) {
    throw new Error('Permisiunea de acces la cameră a fost refuzată');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: 'images' as any,
    quality: 1,
    allowsEditing: true,
    aspect: [1, 1],
  });

  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    type: asset.type,
  };
}

/**
 * Compress and resize image for upload
 */
export async function compressImage(imageUri: string): Promise<string> {
  try {
    // First, resize if needed
    const manipResult = await ImageManipulator.manipulateAsync(
      imageUri,
      [
        {
          resize: {
            width: MAX_IMAGE_DIMENSION,
          },
        },
      ],
      {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    // Check if we need further compression
    const response = await fetch(manipResult.uri);
    const blob = await response.blob();
    
    if (blob.size <= MAX_IMAGE_SIZE_KB * 1024) {
      return manipResult.uri;
    }

    // If still too large, compress more aggressively
    const furtherCompressed = await ImageManipulator.manipulateAsync(
      manipResult.uri,
      [],
      {
        compress: 0.6,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    return furtherCompressed.uri;
  } catch (error) {
    console.error('Error compressing image:', error);
    return imageUri; // Return original if compression fails
  }
}

/**
 * Upload image to Firebase Storage from React Native
 */
export async function uploadImageFromUri(
  uri: string,
  path: string
): Promise<string> {
  if (!storage) throw new Error('Firebase Storage not initialized');

  try {
    // Compress the image first
    const compressedUri = await compressImage(uri);

    // Fetch the image as a blob
    const response = await fetch(compressedUri);
    const blob = await response.blob();

    // Upload to Firebase Storage
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(snapshot.ref);

    return downloadURL;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
}

/**
 * Upload multiple images from React Native
 */
export async function uploadMultipleImagesFromUris(
  imageAssets: ImageAsset[],
  basePath: string
): Promise<string[]> {
  const uploadPromises = imageAssets.map(async (asset, index) => {
    const timestamp = Date.now();
    const filename = `${timestamp}_${index}.jpg`;
    const path = `${basePath}/${filename}`;
    
    return uploadImageFromUri(asset.uri, path);
  });

  return Promise.all(uploadPromises);
}

/**
 * Validate image asset
 */
export function validateImageAsset(asset: ImageAsset): { valid: boolean; error?: string } {
  // Basic validation - expo-image-picker already handles most validation
  if (!asset.uri) {
    return { valid: false, error: 'URI imagine invalid' };
  }

  return { valid: true };
}
