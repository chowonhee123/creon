import { useState, useEffect } from 'react';
import { pingServer, getServerInfo } from '../services/serverService';

export interface ServerConnectionStatus {
  isConnected: boolean;
  isChecking: boolean;
  error: string | null;
  serverInfo: any | null;
}

/**
 * 서버 연결 상태를 관리하는 훅
 */
export function useServerConnection(autoCheck: boolean = true) {
  const [status, setStatus] = useState<ServerConnectionStatus>({
    isConnected: false,
    isChecking: false,
    error: null,
    serverInfo: null,
  });

  const checkConnection = async () => {
    setStatus(prev => ({ ...prev, isChecking: true, error: null }));
    
    try {
      const isConnected = await pingServer();
      
      if (isConnected) {
        try {
          const infoResponse = await getServerInfo();
          setStatus({
            isConnected: true,
            isChecking: false,
            error: null,
            serverInfo: infoResponse.data || null,
          });
        } catch (error) {
          setStatus({
            isConnected: true,
            isChecking: false,
            error: null,
            serverInfo: null,
          });
        }
      } else {
        setStatus({
          isConnected: false,
          isChecking: false,
          error: '서버에 연결할 수 없습니다.',
          serverInfo: null,
        });
      }
    } catch (error: any) {
      setStatus({
        isConnected: false,
        isChecking: false,
        error: error.message || '서버 연결 확인 중 오류가 발생했습니다.',
        serverInfo: null,
      });
    }
  };

  useEffect(() => {
    if (autoCheck) {
      checkConnection();
      
      // 주기적으로 연결 상태 확인 (5분마다)
      const interval = setInterval(checkConnection, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [autoCheck]);

  return {
    ...status,
    checkConnection,
  };
}



