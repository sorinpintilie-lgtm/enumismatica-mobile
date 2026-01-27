// Use global File type from browser environment

/**
 * Convert image to WebP format with size optimization
 * @param file - Image file to convert
 * @param maxSizeKB - Maximum file size in KB (default: 750KB)
 * @returns Promise with optimized WebP file
 */
export async function convertToWebP(file: File, maxSizeKB: number = 750): Promise<File> {
  return new Promise((resolve, reject) => {
    // This helper is intended for browser usage. If called in a non-browser runtime
    // (SSR / Node / React Native), just return the original file.
    if (typeof window === 'undefined') {
      resolve(file);
      return;
    }

    // Check if file is already WebP and within size limits
    if (file.type === 'image/webp' && file.size <= maxSizeKB * 1024) {
      console.log(`[ImageOptimization] File already optimized: ${file.name} (${Math.round(file.size/1024)}KB)`);
      resolve(file);
      return;
    }
 
    // Check if browser supports WebP conversion
    // NOTE: Historically we gated on OffscreenCanvas, but this helper uses a normal <canvas>.
    // Keep logging here so we can diagnose clients where conversion is skipped.
    const hasCreateImageBitmap = typeof (window as any).createImageBitmap !== 'undefined';
    const hasOffscreenCanvas = typeof (window as any).OffscreenCanvas !== 'undefined';
    const hasCanvasToBlob = typeof (document?.createElement('canvas') as any)?.toBlob !== 'undefined';

    if (!hasCanvasToBlob) {
      console.warn('[ImageOptimization] Canvas toBlob not supported; using original file', {
        name: file.name,
        type: file.type,
        size: file.size,
        hasCreateImageBitmap,
        hasOffscreenCanvas,
        hasCanvasToBlob,
      });
      resolve(file);
      return;
    }

    console.log('[ImageOptimization] Starting WebP conversion', {
      name: file.name,
      type: file.type,
      size: file.size,
      maxSizeKB,
      hasCreateImageBitmap,
      hasOffscreenCanvas,
      hasCanvasToBlob,
    });
 
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const img = new Image();
        img.src = event.target?.result as string;
 
        img.onload = async () => {
          try {
            // Calculate dimensions for resizing if needed
            let targetWidth = img.width;
            let targetHeight = img.height;
            
            // If original file is too large, calculate appropriate resize dimensions
            if (file.size > maxSizeKB * 1024) {
              // Calculate scaling factor based on file size
              const sizeRatio = Math.sqrt((maxSizeKB * 1024) / file.size);
              targetWidth = Math.round(img.width * sizeRatio);
              targetHeight = Math.round(img.height * sizeRatio);
              
              // Ensure minimum dimensions (avoid generating unusably tiny images)
              targetWidth = Math.max(targetWidth, 320);
              targetHeight = Math.max(targetHeight, 240);
              
               console.log(`[ImageOptimization] Resizing ${file.name}: ${img.width}x${img.height} -> ${targetWidth}x${targetHeight}`);
            }
 
            // Create canvas and convert to WebP
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              throw new Error('Could not get canvas context');
            }

            const maxBytes = maxSizeKB * 1024;
            let webpBlob: Blob | null = null;

            // Two-stage strategy:
            // 1) try lowering WebP quality a few times
            // 2) if still too large, scale down dimensions and retry
            let resizePass = 0;
            const maxResizePasses = 4;

            while (resizePass < maxResizePasses) {
              canvas.width = targetWidth;
              canvas.height = targetHeight;
              ctx.clearRect(0, 0, targetWidth, targetHeight);
              ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

              let quality = 0.75;
              let attempts = 0;
              const maxAttempts = 5;

              while (attempts < maxAttempts) {
                webpBlob = await new Promise<Blob | null>((resolveBlob) => {
                  canvas.toBlob(resolveBlob, 'image/webp', quality);
                });

                if (!webpBlob) {
                  throw new Error('WebP conversion failed');
                }

                if (webpBlob.size <= maxBytes) {
                  console.log(
                    `[ImageOptimization] Success: ${file.name} -> ${Math.round(webpBlob.size / 1024)}KB (quality: ${quality}, size: ${targetWidth}x${targetHeight})`
                  );
                  break;
                }

                quality -= 0.08;
                attempts++;
              }

              if (webpBlob && webpBlob.size <= maxBytes) {
                break;
              }

              if (!webpBlob) {
                throw new Error('WebP conversion failed');
              }

              // Still too large: scale down and try again.
              const scale = Math.sqrt(maxBytes / webpBlob.size);
              const nextWidth = Math.max(320, Math.floor(targetWidth * scale));
              const nextHeight = Math.max(240, Math.floor(targetHeight * scale));

              // If we can no longer shrink meaningfully, stop and return best-effort.
              if (nextWidth >= targetWidth && nextHeight >= targetHeight) {
                break;
              }

              targetWidth = nextWidth;
              targetHeight = nextHeight;
              resizePass++;
            }

            if (!webpBlob) {
              throw new Error('WebP conversion failed after multiple attempts');
            }
 
            // Create new WebP file
            const webpFile = new File(
              [webpBlob],
              file.name.replace(/\.[^/.]+$/, '.webp'),
              { type: 'image/webp' }
            );
 
            resolve(webpFile);
          } catch (error) {
            console.error('Error during WebP conversion:', error);
            resolve(file); // Fallback to original file
          }
        };
 
        img.onerror = () => {
          console.error('Error loading image for WebP conversion');
          resolve(file); // Fallback to original file
        };
      } catch (error) {
        console.error('Error in WebP conversion process:', error);
        resolve(file); // Fallback to original file
      }
    };
 
    reader.onerror = () => {
      console.error('Error reading file for WebP conversion');
      resolve(file); // Fallback to original file
    };
 
    reader.readAsDataURL(file);
  });
}

/**
 * Check if browser supports WebP format
 * @returns Promise resolving to boolean
 */
export function checkWebPSupport(): Promise<boolean> {
  return new Promise((resolve) => {
    const webPData = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';
    const img = new Image();

    img.onload = () => resolve(img.width === 1 && img.height === 1);
    img.onerror = () => resolve(false);

    img.src = webPData;
  });
}
