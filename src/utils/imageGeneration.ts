import { GoogleGenAI, Modality } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: import.meta.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.API_KEY || '' });

export interface ReferenceImage {
  file?: File;
  dataUrl?: string;
}

export interface GenerateImageResult {
  data: string; // base64
  mimeType: string;
}

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      } else {
        reject(new Error("Failed to convert blob to base64"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const generateImage = async (
  prompt: string,
  referenceImages: ReferenceImage[] = []
): Promise<GenerateImageResult | null> => {
  try {
    const parts: any[] = [{ text: prompt }];
    
    const imageParts = await Promise.all(
      referenceImages
        .filter(img => img)
        .map(async refImg => {
          if (!refImg) return null;
          
          // If file exists, use it
          if (refImg.file) {
            return {
              inlineData: {
                data: await blobToBase64(refImg.file),
                mimeType: refImg.file.type,
              }
            };
          }
          
          // Otherwise, extract from dataUrl
          if (refImg.dataUrl) {
            const match = refImg.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              const mimeType = match[1];
              const base64Data = match[2];
              return {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType,
                }
              };
            }
          }
          
          return null;
        })
    );
    
    // Filter out null values
    const validImageParts = imageParts.filter(part => part !== null) as any[];
    parts.push(...validImageParts);

    console.log('Calling AI API with parts:', parts);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    console.log('API response received:', response);
    
    const candidate = response.candidates?.[0];
    const content = candidate?.content;
    const responseParts = content?.parts;
    const firstPart = responseParts?.[0];
    const inlineData = firstPart?.inlineData;

    if (inlineData && inlineData.data && inlineData.mimeType) {
      console.log('Image data extracted successfully, mimeType:', inlineData.mimeType);
      return { data: inlineData.data, mimeType: inlineData.mimeType };
    } else {
      console.error('Invalid API response structure');
      throw new Error('No image data received from API.');
    }
  } catch (error) {
    console.error('Image generation failed:', error);
    return null;
  }
};

