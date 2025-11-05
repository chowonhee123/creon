import React from 'react';
import { useServerConnection } from '../hooks/useServerConnection';

/**
 * 서버 연결 상태를 표시하는 컴포넌트
 */
export const ServerStatus: React.FC = () => {
  const { isConnected, isChecking, error, checkConnection } = useServerConnection(true);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100">
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            isChecking
              ? 'bg-yellow-500 animate-pulse'
              : isConnected
              ? 'bg-green-500'
              : 'bg-red-500'
          }`}
        />
        <span className="text-sm text-gray-700">
          {isChecking
            ? '연결 확인 중...'
            : isConnected
            ? '서버 연결됨'
            : '서버 연결 안 됨'}
        </span>
      </div>
      
      {error && (
        <button
          onClick={checkConnection}
          className="text-xs text-blue-600 hover:text-blue-800 underline"
        >
          재시도
        </button>
      )}
    </div>
  );
};



