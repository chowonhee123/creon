/**
 * Image utility functions for 2D Studio
 * Handles image manipulation, background removal, and SVG conversion
 */

import ImageTracer from 'imagetracerjs';

/**
 * Converts a base64 image to SVG using ImageTracer
 * 
 * NOTE: ImageTracer requires direct canvas DOM manipulation.
 * This is encapsulated here but still uses canvas/ImageData APIs.
 * 
 * @param imageDataUrl - Base64 data URL of the image
 * @returns Promise resolving to SVG string
 */
export const convertImageToSVG = async (imageDataUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Create image element to get image data
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Convert to SVG using ImageTracer
        // NOTE: ImageTracer library requires direct DOM/canvas access
        const options = {
          ltres: 1,
          qtres: 1,
          pathomit: 8,
          colorsampling: 2,
          numberofcolors: 256,
          mincolorratio: 0.02,
          colorquantcycles: 5,
          scale: 1,
          roundcoords: 1,
          blurradius: 0,
          blurdelta: 20,
          strokewidth: 1,
          linefilter: true,
          layercontainer: 'g',
          layerbgcolor: '',
          viewbox: false,
          desc: false,
          lcpr: 0,
          qcpr: 0,
          minroundedstops: 0,
          minrectroundedstops: 0,
          blursvg: false,
          despeckle: false,
          despecklelevel: 0,
          simplifytolerance: 0,
          corsenabled: false
        };
        
        const svgString = ImageTracer.imagedataToSVG(imageData, options);
        resolve(svgString);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = imageDataUrl;
  });
};

/**
 * Removes background from an image using @imgly/background-removal
 * 
 * NOTE: This library loads WebAssembly and requires blob handling.
 * Dynamically imported to reduce initial bundle size.
 * 
 * @param blob - Image blob
 * @returns Promise resolving to blob without background
 */
export const removeBackgroundFromBlob = async (blob: Blob): Promise<Blob> => {
  // Dynamically import background removal (loads WebAssembly only when needed)
  const { removeBackground } = await import('@imgly/background-removal');
  return removeBackground(blob);
};

/**
 * Converts a blob to base64 data URL
 */
export const blobToBase64DataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Converts a data URL to blob
 */
export const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const response = await fetch(dataUrl);
  return response.blob();
};

/**
 * Normalizes and validates HEX color strings
 */
export const normalizeHex = (value: string): string | null => {
  const raw = (value || '').trim().replace(/^#/, '').toUpperCase();
  if (/^[0-9A-F]{3}$/.test(raw)) return `#${raw}`;
  if (/^[0-9A-F]{6}$/.test(raw)) return `#${raw}`;
  return null;
};


