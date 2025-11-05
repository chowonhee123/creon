/**
 * 서버 연결 관리 서비스
 * 백엔드 서버와의 통신을 위한 고수준 API
 */

import { 
  apiGet, 
  apiPost, 
  apiUpload, 
  API_ENDPOINTS, 
  checkServerConnection,
  ApiResponse,
  ApiError 
} from './apiService';

// 이미지 생성 요청 타입
export interface GenerateImageRequest {
  prompt: string;
  studioType: '2d' | '3d' | 'image' | 'icon';
  style?: string;
  options?: {
    width?: number;
    height?: number;
    quality?: number;
  };
}

// 이미지 생성 응답 타입
export interface GenerateImageResponse {
  id: string;
  url: string;
  dataUrl?: string; // base64
  prompt: string;
  timestamp: number;
}

// 비디오 생성 요청 타입
export interface GenerateVideoRequest {
  motionPrompt: string;
  imageUrl?: string;
  imageDataUrl?: string; // base64
}

// 비디오 생성 응답 타입
export interface GenerateVideoResponse {
  id: string;
  url: string;
  motionPrompt: string;
  timestamp: number;
}

/**
 * 서버 연결 상태 확인
 */
export async function pingServer(): Promise<boolean> {
  return await checkServerConnection();
}

/**
 * 서버 정보 가져오기
 */
export async function getServerInfo() {
  try {
    const response = await apiGet(API_ENDPOINTS.INFO);
    return response;
  } catch (error) {
    console.error('서버 정보 가져오기 실패:', error);
    throw error;
  }
}

/**
 * 이미지 생성 (서버)
 */
export async function generateImageOnServer(
  request: GenerateImageRequest
): Promise<GenerateImageResponse> {
  try {
    const endpoint = 
      request.studioType === '2d' ? API_ENDPOINTS.GENERATE_IMAGE_2D :
      request.studioType === '3d' ? API_ENDPOINTS.GENERATE_IMAGE_3D :
      request.studioType === 'icon' ? API_ENDPOINTS.GENERATE_ICON :
      API_ENDPOINTS.GENERATE_IMAGE;

    const response = await apiPost<GenerateImageResponse>(endpoint, {
      prompt: request.prompt,
      style: request.style,
      options: request.options,
    });

    if (!response.success || !response.data) {
      throw new ApiError(500, '이미지 생성에 실패했습니다.');
    }

    return response.data;
  } catch (error) {
    console.error('이미지 생성 오류:', error);
    throw error;
  }
}

/**
 * Motion 프롬프트 생성 (서버)
 */
export async function generateMotionPromptsOnServer(
  imagePrompt: string
): Promise<string[]> {
  try {
    const response = await apiPost<{ prompts: string[] }>(
      API_ENDPOINTS.GENERATE_MOTION_PROMPTS,
      { prompt: imagePrompt }
    );

    if (!response.success || !response.data) {
      throw new ApiError(500, 'Motion 프롬프트 생성에 실패했습니다.');
    }

    return response.data.prompts || [];
  } catch (error) {
    console.error('Motion 프롬프트 생성 오류:', error);
    throw error;
  }
}

/**
 * 비디오 생성 (서버)
 */
export async function generateVideoOnServer(
  request: GenerateVideoRequest
): Promise<GenerateVideoResponse> {
  try {
    const response = await apiPost<GenerateVideoResponse>(
      API_ENDPOINTS.GENERATE_VIDEO,
      {
        motionPrompt: request.motionPrompt,
        imageUrl: request.imageUrl,
        imageDataUrl: request.imageDataUrl,
      }
    );

    if (!response.success || !response.data) {
      throw new ApiError(500, '비디오 생성에 실패했습니다.');
    }

    return response.data;
  } catch (error) {
    console.error('비디오 생성 오류:', error);
    throw error;
  }
}

/**
 * 배경 제거 (서버)
 */
export async function removeBackgroundOnServer(
  imageDataUrl: string
): Promise<string> {
  try {
    const response = await apiPost<{ dataUrl: string }>(
      API_ENDPOINTS.REMOVE_BACKGROUND,
      { imageDataUrl }
    );

    if (!response.success || !response.data) {
      throw new ApiError(500, '배경 제거에 실패했습니다.');
    }

    return response.data.dataUrl;
  } catch (error) {
    console.error('배경 제거 오류:', error);
    throw error;
  }
}

/**
 * SVG 변환 (서버)
 */
export async function convertToSvgOnServer(
  imageDataUrl: string
): Promise<string> {
  try {
    const response = await apiPost<{ svg: string }>(
      API_ENDPOINTS.CONVERT_TO_SVG,
      { imageDataUrl }
    );

    if (!response.success || !response.data) {
      throw new ApiError(500, 'SVG 변환에 실패했습니다.');
    }

    return response.data.svg;
  } catch (error) {
    console.error('SVG 변환 오류:', error);
    throw error;
  }
}

/**
 * 이미지 수정 (Fix) (서버)
 */
export async function fixImageOnServer(
  imageDataUrl: string,
  prompt: string
): Promise<string> {
  try {
    const response = await apiPost<{ dataUrl: string }>(
      API_ENDPOINTS.FIX_IMAGE,
      { imageDataUrl, prompt }
    );

    if (!response.success || !response.data) {
      throw new ApiError(500, '이미지 수정에 실패했습니다.');
    }

    return response.data.dataUrl;
  } catch (error) {
    console.error('이미지 수정 오류:', error);
    throw error;
  }
}

/**
 * 히스토리 가져오기
 */
export async function getHistory(studioType?: string) {
  try {
    const response = await apiGet(API_ENDPOINTS.GET_HISTORY, {
      studioType,
    });
    return response;
  } catch (error) {
    console.error('히스토리 가져오기 오류:', error);
    throw error;
  }
}

/**
 * 히스토리 저장
 */
export async function saveHistory(data: any) {
  try {
    const response = await apiPost(API_ENDPOINTS.SAVE_HISTORY, data);
    return response;
  } catch (error) {
    console.error('히스토리 저장 오류:', error);
    throw error;
  }
}



