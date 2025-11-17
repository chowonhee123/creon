import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { showToast } from '../components/Toast';

const FFMPEG_SOURCES = [
  {
    name: 'jsDelivr',
    coreURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
    wasmURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm',
  },
  {
    name: 'unpkg',
    coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
    wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm',
  },
] as const;

let ffmpegInstance: FFmpeg | null = null;
let isFFmpegLoaded = false;

/**
 * Load FFmpeg instance with fallback sources
 */
export const loadFFmpeg = async (): Promise<FFmpeg> => {
  if (isFFmpegLoaded && ffmpegInstance) {
    console.log('[FFmpeg] Using cached instance');
    return ffmpegInstance;
  }

  let lastError: unknown = null;

  for (const source of FFMPEG_SOURCES) {
    try {
      console.log(`[FFmpeg] Initializing FFmpeg via ${source.name}...`);
      showToast({
        type: 'success',
        title: 'Loading Video Converter…',
        body: `Preparing FFmpeg (${source.name}). This may take a moment.`,
      });

      const instance = new FFmpeg();
      instance.on('log', ({ message }) => {
        console.log('[FFmpeg]', message);
      });

      console.log(`[FFmpeg] Loading core from ${source.coreURL}`);
      await instance.load({
        coreURL: source.coreURL,
        wasmURL: source.wasmURL,
      });

      ffmpegInstance = instance;
      isFFmpegLoaded = true;
      console.log('[FFmpeg] Loaded successfully');
      return instance;
    } catch (error) {
      lastError = error;
      console.error(`[FFmpeg] Failed to load from ${source.name}:`, error);
      console.error('[FFmpeg] Error details:', {
        name: (error as Error)?.name,
        message: (error as Error)?.message,
        stack: (error as Error)?.stack,
      });
      ffmpegInstance = null;
      isFFmpegLoaded = false;
    }
  }

  showToast({
    type: 'error',
    title: 'FFmpeg Error',
    body: 'Unable to load the video converter. Please check your network connection and try again.',
  });

  throw lastError || new Error('Failed to load FFmpeg from all sources');
};

/**
 * Convert video URL to GIF
 * @param videoUrl - URL of the video to convert
 * @param onProgress - Optional callback for progress updates
 * @returns Promise resolving to GIF data URL
 */
export const convertVideoToGif = async (
  videoUrl: string,
  onProgress?: (message: string) => void
): Promise<string> => {
  let conversionTimeout: number | null = null;

  try {
    console.log('[GIF Conversion] Starting...', videoUrl);

    // Set timeout (3 minutes)
    conversionTimeout = window.setTimeout(() => {
      console.error('[GIF Conversion] Timeout after 3 minutes');
      showToast({
        type: 'error',
        title: 'Conversion Timeout',
        body: 'GIF conversion is taking too long. Please try again or use a shorter video.',
      });
      throw new Error('Conversion timeout');
    }, 3 * 60 * 1000);

    console.log('[GIF Conversion] Loading FFmpeg...');
    const ffmpeg = await loadFFmpeg();

    // Monitor FFmpeg progress
    let progressMessages: string[] = [];
    let lastProgressTime = Date.now();

    const progressHandler = ({ message }: { message: string }) => {
      console.log('[FFmpeg Progress]', message);
      progressMessages.push(message);
      lastProgressTime = Date.now();

      if (onProgress && progressMessages.length > 0) {
        const lastMessage = progressMessages[progressMessages.length - 1];
        if (lastMessage.includes('frame=') || lastMessage.includes('size=')) {
          onProgress(`Converting to GIF... ${lastMessage}`);
        } else {
          onProgress('Converting to GIF... This may take a minute.');
        }
      }
    };
    ffmpeg.on('log', progressHandler);

    console.log('[GIF Conversion] Fetching video file...');
    const videoData = await fetchFile(videoUrl);
    const videoDataSize =
      videoData instanceof Uint8Array
        ? videoData.length
        : (videoData as any).byteLength || 0;
    console.log('[GIF Conversion] Video data fetched, size:', videoDataSize);

    if (videoDataSize === 0) {
      throw new Error('Video file is empty');
    }

    console.log('[GIF Conversion] Writing input file...');
    await ffmpeg.writeFile('input.mp4', videoData);
    console.log('[GIF Conversion] Input file written successfully');

    console.log('[GIF Conversion] Converting to GIF...');
    if (onProgress) {
      onProgress('Converting to GIF... This may take a minute.');
    }

    // Add a progress check every 10 seconds to detect if conversion is stuck
    let progressCheckInterval: number | null = null;
    progressCheckInterval = window.setInterval(() => {
      const timeSinceLastProgress = Date.now() - lastProgressTime;
      if (timeSinceLastProgress > 30000) {
        // 30 seconds without progress
        console.warn(
          '[GIF Conversion] No progress for 30 seconds, conversion may be stuck'
        );
        if (onProgress) {
          onProgress('Conversion is taking longer than expected...');
        }
      }
    }, 10000); // Check every 10 seconds

    try {
      await ffmpeg.exec([
        '-i',
        'input.mp4',
        '-vf',
        'fps=8,scale=-1:720,crop=720:720',
        '-loop',
        '0',
        '-y',
        'output.gif',
      ]);
      console.log('[GIF Conversion] FFmpeg exec completed');
    } finally {
      // Clean up progress monitoring
      if (progressCheckInterval) {
        clearInterval(progressCheckInterval);
      }
      ffmpeg.off('log', progressHandler);
    }

    console.log('[GIF Conversion] Reading output...');
    const gifData = await ffmpeg.readFile('output.gif');
    const gifDataSize =
      gifData instanceof Uint8Array
        ? gifData.length
        : (gifData as any).byteLength || 0;
    console.log('[GIF Conversion] GIF data read, size:', gifDataSize);

    if (gifDataSize === 0) {
      throw new Error('Generated GIF file is empty');
    }

    // Convert FileData to Uint8Array if needed
    let gifArray: Uint8Array;
    if (gifData instanceof Uint8Array) {
      gifArray = gifData;
    } else {
      // Handle ArrayBuffer or other types
      const dataBuffer = (gifData as any).buffer || gifData;
      gifArray =
        dataBuffer instanceof ArrayBuffer
          ? new Uint8Array(dataBuffer)
          : new Uint8Array(dataBuffer as ArrayBufferLike);
    }
    // Use slice to ensure we have a proper ArrayBuffer
    const arrayBuffer = gifArray.buffer.slice(
      gifArray.byteOffset,
      gifArray.byteOffset + gifArray.byteLength
    );
    const gifBlob = new Blob([arrayBuffer], { type: 'image/gif' });
    const gifUrl = URL.createObjectURL(gifBlob);

    // Clear timeout
    if (conversionTimeout) {
      clearTimeout(conversionTimeout);
      conversionTimeout = null;
    }

    console.log('[GIF Conversion] Complete!', gifUrl);
    showToast({
      type: 'success',
      title: 'GIF Created!',
      body: 'Your animated GIF is ready.',
    });

    return gifUrl;
  } catch (error) {
    console.error('[GIF Conversion] Failed:', error);
    console.error('[GIF Conversion] Error details:', {
      name: (error as Error)?.name,
      message: (error as Error)?.message,
      stack: (error as Error)?.stack,
    });

    // Clear timeout if still active
    if (conversionTimeout) {
      clearTimeout(conversionTimeout);
    }

    showToast({
      type: 'error',
      title: 'GIF Conversion Failed',
      body:
        (error as Error)?.message ||
        'Failed to convert video to GIF. Please try again.',
    });

    throw error;
  }
};

