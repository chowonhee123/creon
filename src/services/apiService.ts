/**
 * API 서버 연결 서비스
 * 백엔드 서버와의 통신을 담당합니다.
 */

// API 서버 기본 URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const API_TIMEOUT = 30000; // 30초

// API 응답 타입
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// API 에러 타입
export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * API 요청 기본 함수
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // 토큰이 있으면 Authorization 헤더 추가
  const token = localStorage.getItem('auth_token');
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    const response = await fetch(url, {
      ...config,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 응답이 JSON인지 확인
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');

    let data: any;
    if (isJson) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      throw new ApiError(
        response.status,
        data?.message || data?.error || `HTTP error! status: ${response.status}`,
        data
      );
    }

    return {
      success: true,
      data: data,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new ApiError(408, '요청 시간이 초과되었습니다.');
      }
      throw new ApiError(500, error.message || '서버 연결에 실패했습니다.');
    }
    
    throw new ApiError(500, '알 수 없는 오류가 발생했습니다.');
  }
}

/**
 * GET 요청
 */
export async function apiGet<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
  let url = endpoint;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }
  
  return apiRequest<T>(url, {
    method: 'GET',
  });
}

/**
 * POST 요청
 */
export async function apiPost<T>(
  endpoint: string,
  data?: any,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
    ...options,
  });
}

/**
 * PUT 요청
 */
export async function apiPut<T>(
  endpoint: string,
  data?: any,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
    ...options,
  });
}

/**
 * PATCH 요청
 */
export async function apiPatch<T>(
  endpoint: string,
  data?: any,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
    ...options,
  });
}

/**
 * DELETE 요청
 */
export async function apiDelete<T>(endpoint: string): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    method: 'DELETE',
  });
}

/**
 * 파일 업로드 (FormData)
 */
export async function apiUpload<T>(
  endpoint: string,
  formData: FormData,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('auth_token');
  const headers: HeadersInit = {};
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return apiRequest<T>(endpoint, {
    method: 'POST',
    body: formData,
    headers,
    ...options,
  });
}

/**
 * 서버 연결 상태 확인
 */
export async function checkServerConnection(): Promise<boolean> {
  try {
    const response = await apiGet('/health');
    return response.success;
  } catch (error) {
    console.error('서버 연결 확인 실패:', error);
    return false;
  }
}

/**
 * 서버 정보 가져오기
 */
export async function getServerInfo(): Promise<ApiResponse<{ version: string; status: string }>> {
  return apiGet('/api/info');
}

// API 엔드포인트 상수
export const API_ENDPOINTS = {
  // Health check
  HEALTH: '/health',
  INFO: '/api/info',
  
  // 이미지 생성
  GENERATE_IMAGE: '/api/generate/image',
  GENERATE_IMAGE_2D: '/api/generate/image/2d',
  GENERATE_IMAGE_3D: '/api/generate/image/3d',
  GENERATE_ICON: '/api/generate/icon',
  
  // 비디오 생성
  GENERATE_VIDEO: '/api/generate/video',
  GENERATE_MOTION_PROMPTS: '/api/generate/motion-prompts',
  
  // 이미지 수정
  REMOVE_BACKGROUND: '/api/image/remove-background',
  CONVERT_TO_SVG: '/api/image/convert-svg',
  FIX_IMAGE: '/api/image/fix',
  
  // 히스토리
  GET_HISTORY: '/api/history',
  SAVE_HISTORY: '/api/history',
  DELETE_HISTORY: '/api/history',
} as const;




