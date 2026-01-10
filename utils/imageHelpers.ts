
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * Resizes a base64 image string to a specified width while maintaining aspect ratio.
 * Compresses to JPEG to save localStorage space.
 */
export const resizeThumbnail = (dataUrl: string, maxWidth: number = 128, quality: number = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = maxWidth / img.width;
      canvas.width = maxWidth;
      canvas.height = img.height * scale;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Draw standard background for transparent PNGs (optional, but looks better for thumbnails)
      ctx.fillStyle = '#f0f2f5'; // Match app background
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Export as JPEG to reduce size significantly compared to PNG
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = (e) => reject(e);
  });
};
