/**
 * Generate responsive image sources for different breakpoints
 * @param baseUrl - Base image URL
 * @param widths - Array of widths to generate
 * @returns srcSet string for responsive images
 */
export function generateSrcSet(baseUrl: string, widths: number[] = [400, 800, 1200, 1600]): string {
  return widths
    .map(width => {
      // For Firebase Storage URLs, we can't modify the URL directly
      // So we'll use the same URL but let the browser handle resizing
      // In a production environment, you'd want to use a CDN that can resize images
      return `${baseUrl} ${width}w`;
    })
    .join(', ');
}

/**
 * Generate sizes attribute for responsive images
 * @param defaultSize - Default size descriptor
 * @returns sizes string for responsive images
 */
export function generateSizes(defaultSize: string = '100vw'): string {
  return `(max-width: 640px) 100vw, (max-width: 768px) 90vw, (max-width: 1024px) 80vw, ${defaultSize}`;
}

/**
 * Create responsive image props
 * @param imageUrl - Image URL
 * @param options - Options for responsive image
 * @returns Object with srcSet and sizes
 */
export function createResponsiveImageProps(
  imageUrl: string,
  options: {
    widths?: number[];
    defaultSize?: string;
  } = {}
): {
  srcSet: string;
  sizes: string;
} {
  const { widths = [400, 800, 1200, 1600], defaultSize = '100vw' } = options;

  return {
    srcSet: generateSrcSet(imageUrl, widths),
    sizes: generateSizes(defaultSize),
  };
}