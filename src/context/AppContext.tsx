import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface GeneratedImageData {
  id: string;
  data: string; // base64
  mimeType: string;
  subject: string;
  styleConstraints: string;
  timestamp: number;
  videoDataUrl?: string;
  motionPrompt?: { json: any; korean: string; english: string } | null;
  originalData?: string;
  originalMimeType?: string;
  modificationType?: string;
}

interface IconData {
  name: string;
  tags: string[];
}

interface AppState {
  // Navigation
  currentPage: string;
  setCurrentPage: (page: string) => void;
  
  // Theme
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  
  // Icon Studio
  selectedIcon: IconData | null;
  setSelectedIcon: (icon: IconData | null) => void;
  
  // 3D Studio
  currentGeneratedImage: GeneratedImageData | null;
  setCurrentGeneratedImage: (image: GeneratedImageData | null) => void;
  imageHistory: GeneratedImageData[];
  setImageHistory: (history: GeneratedImageData[]) => void;
  historyIndex: number;
  setHistoryIndex: (index: number) => void;
  
  // 2D Studio
  currentGeneratedImage2d: GeneratedImageData | null;
  setCurrentGeneratedImage2d: (image: GeneratedImageData | null) => void;
  imageHistory2d: GeneratedImageData[];
  setImageHistory2d: (history: GeneratedImageData[]) => void;
  historyIndex2d: number;
  setHistoryIndex2d: (index: number) => void;
  detailsPanelHistory2d: GeneratedImageData[];
  setDetailsPanelHistory2d: (history: GeneratedImageData[]) => void;
  detailsPanelHistoryIndex2d: number;
  setDetailsPanelHistoryIndex2d: (index: number) => void;
  
  // Image Studio
  currentGeneratedImageStudio: GeneratedImageData | null;
  setCurrentGeneratedImageStudio: (image: GeneratedImageData | null) => void;
  imageStudioHistory: GeneratedImageData[];
  setImageStudioHistory: (history: GeneratedImageData[]) => void;
  imageStudioHistoryIndex: number;
  setImageStudioHistoryIndex: (index: number) => void;
  
  // Explore
  exploreMedia: any[];
  setExploreMedia: (media: any[]) => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [currentPage, setCurrentPage] = useState(() => {
    // Initialize from localStorage if available, otherwise default to page-usages
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('currentPage');
      return saved || 'page-usages';
    }
    return 'page-usages';
  });
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  // Icon Studio
  const [selectedIcon, setSelectedIcon] = useState<IconData | null>(null);
  
  // 3D Studio
  const [currentGeneratedImage, setCurrentGeneratedImage] = useState<GeneratedImageData | null>(null);
  const [imageHistory, setImageHistory] = useState<GeneratedImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // 2D Studio
  const [currentGeneratedImage2d, setCurrentGeneratedImage2d] = useState<GeneratedImageData | null>(null);
  const [imageHistory2d, setImageHistory2d] = useState<GeneratedImageData[]>([]);
  const [historyIndex2d, setHistoryIndex2d] = useState(-1);
  const [detailsPanelHistory2d, setDetailsPanelHistory2d] = useState<GeneratedImageData[]>([]);
  const [detailsPanelHistoryIndex2d, setDetailsPanelHistoryIndex2d] = useState(-1);
  
  // Image Studio
  const [currentGeneratedImageStudio, setCurrentGeneratedImageStudio] = useState<GeneratedImageData | null>(null);
  const [imageStudioHistory, setImageStudioHistory] = useState<GeneratedImageData[]>([]);
  const [imageStudioHistoryIndex, setImageStudioHistoryIndex] = useState(-1);
  
  // Explore
  const [exploreMedia, setExploreMedia] = useState<any[]>([]);
  
  // Save currentPage to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('currentPage', currentPage);
    }
  }, [currentPage]);

  const value: AppState = {
    currentPage,
    setCurrentPage,
    theme,
    setTheme,
    selectedIcon,
    setSelectedIcon,
    currentGeneratedImage,
    setCurrentGeneratedImage,
    imageHistory,
    setImageHistory,
    historyIndex,
    setHistoryIndex,
    currentGeneratedImage2d,
    setCurrentGeneratedImage2d,
    imageHistory2d,
    setImageHistory2d,
    historyIndex2d,
    setHistoryIndex2d,
    detailsPanelHistory2d,
    setDetailsPanelHistory2d,
    detailsPanelHistoryIndex2d,
    setDetailsPanelHistoryIndex2d,
    currentGeneratedImageStudio,
    setCurrentGeneratedImageStudio,
    imageStudioHistory,
    setImageStudioHistory,
    imageStudioHistoryIndex,
    setImageStudioHistoryIndex,
    exploreMedia,
    setExploreMedia,
  };
  
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

