import React, { useState, useEffect } from 'react';
import { generateImage, generateMotionPrompts, generateVideo } from './services/aiService';

// 타입 정의
interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
  studioType: string;
}

interface GeneratedVideo {
  id: string;
  url: string;
  motionPrompt: string;
  timestamp: number;
}

// 메인 앱 컴포넌트
function App() {
  const [currentPage, setCurrentPage] = useState<'home' | '2d' | '3d' | 'image' | 'icon'>('home');
  const [currentImage, setCurrentImage] = useState<GeneratedImage | null>(null);
  const [currentVideo, setCurrentVideo] = useState<GeneratedVideo | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [motionPrompts, setMotionPrompts] = useState<string[]>([]);
  const [selectedMotionPrompt, setSelectedMotionPrompt] = useState<string>('');
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [history, setHistory] = useState<GeneratedImage[]>([]);

  // 이미지 생성 핸들러
  const handleGenerateImage = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    try {
      const imageUrl = await generateImage(prompt, currentPage);
      const newImage: GeneratedImage = {
        id: Date.now().toString(),
        url: imageUrl,
        prompt: prompt,
        timestamp: Date.now(),
        studioType: currentPage
      };
      
      setCurrentImage(newImage);
      setHistory(prev => [newImage, ...prev]);
      
      // Motion 프롬프트 생성 (Image Studio만)
      if (currentPage === 'image') {
        const motions = await generateMotionPrompts(prompt);
        setMotionPrompts(motions);
      }
      
      setPrompt('');
    } catch (error) {
      alert('이미지 생성에 실패했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  // 비디오 생성 핸들러
  const handleGenerateVideo = async () => {
    if (!selectedMotionPrompt) return;
    
    setIsGeneratingVideo(true);
    try {
      const videoUrl = await generateVideo(selectedMotionPrompt);
      const newVideo: GeneratedVideo = {
        id: Date.now().toString(),
        url: videoUrl,
        motionPrompt: selectedMotionPrompt,
        timestamp: Date.now()
      };
      
      setCurrentVideo(newVideo);
    } catch (error) {
      alert('비디오 생성에 실패했습니다.');
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  // 홈 페이지 컴포넌트
  const HomePage = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-gray-800 mb-4">
            Contents Builder
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            AI로 창작하는 새로운 경험
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {[
            { id: '2d', title: '2D Studio', desc: '평면 이미지 생성', icon: '🎨', color: 'from-pink-500 to-rose-500' },
            { id: '3d', title: '3D Studio', desc: '3D 모델 생성', icon: '🎯', color: 'from-blue-500 to-cyan-500' },
            { id: 'image', title: 'Image Studio', desc: '고품질 이미지 + Motion', icon: '🖼️', color: 'from-green-500 to-emerald-500' },
            { id: 'icon', title: 'Icon Studio', desc: '아이콘 디자인', icon: '⭐', color: 'from-yellow-500 to-orange-500' }
          ].map((studio) => (
            <div
              key={studio.id}
              onClick={() => setCurrentPage(studio.id as any)}
              className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:scale-105 p-6"
            >
              <div className={`w-16 h-16 rounded-full bg-gradient-to-r ${studio.color} flex items-center justify-center text-2xl mb-4 mx-auto`}>
                {studio.icon}
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">{studio.title}</h3>
              <p className="text-gray-600">{studio.desc}</p>
            </div>
          ))}
        </div>

        {/* 최근 생성된 이미지들 */}
        {history.length > 0 && (
          <div className="mt-16">
            <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">최근 생성된 이미지</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {history.slice(0, 12).map((image) => (
                <div
                  key={image.id}
                  className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => {
                    setCurrentImage(image);
                    setCurrentPage(image.studioType as any);
                  }}
                >
                  <img
                    src={image.url}
                    alt={image.prompt}
                    className="w-full h-32 object-cover"
                  />
                  <div className="p-2">
                    <p className="text-xs text-gray-600 truncate">{image.prompt}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // 스튜디오 페이지 컴포넌트
  const StudioPage = ({ studioType }: { studioType: string }) => {
    const studioInfo = {
      '2d': { title: '2D Studio', desc: '평면 이미지를 생성합니다', placeholder: '예: 아름다운 풍경화' },
      '3d': { title: '3D Studio', desc: '3D 모델을 생성합니다', placeholder: '예: 현대적인 건물' },
      'image': { title: 'Image Studio', desc: '고품질 이미지와 Motion을 생성합니다', placeholder: '예: 전문적인 사진' },
      'icon': { title: 'Icon Studio', desc: '아이콘을 생성합니다', placeholder: '예: 홈 아이콘' }
    };

    const info = studioInfo[studioType as keyof typeof studioInfo];

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-gray-800">{info.title}</h1>
              <p className="text-gray-600 mt-2">{info.desc}</p>
            </div>
            <button
              onClick={() => setCurrentPage('home')}
              className="px-6 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
            >
              ← 홈으로
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 입력 패널 */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-semibold mb-4">프롬프트 입력</h2>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={info.placeholder}
                className="w-full h-32 p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleGenerateImage}
                disabled={!prompt.trim() || isGenerating}
                className="w-full mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
              >
                {isGenerating ? '생성 중...' : '이미지 생성'}
              </button>
            </div>

            {/* 결과 패널 */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-semibold mb-4">생성 결과</h2>
              
              {/* 이미지/비디오 탭 */}
              {currentImage && (
                <div className="mb-4">
                  <div className="flex space-x-2">
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg">이미지</button>
                    {currentPage === 'image' && (
                      <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg">Motion</button>
                    )}
                  </div>
                </div>
              )}

              {currentImage ? (
                <div className="space-y-4">
                  <img
                    src={currentImage.url}
                    alt="Generated"
                    className="w-full h-64 object-cover rounded-lg"
                  />
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-2">프롬프트:</p>
                    <p className="text-gray-800">{currentImage.prompt}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
                      다운로드
                    </button>
                    <button className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                      공유
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                  생성된 이미지가 여기에 표시됩니다
                </div>
              )}

              {/* Motion 프롬프트 섹션 (Image Studio만) */}
              {currentPage === 'image' && motionPrompts.length > 0 && (
                <div className="mt-6 p-4 bg-purple-50 rounded-lg">
                  <h3 className="text-lg font-semibold mb-3">Motion 프롬프트 선택</h3>
                  <div className="space-y-2">
                    {motionPrompts.map((motionPrompt, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedMotionPrompt(motionPrompt)}
                        className={`w-full p-3 text-left rounded-lg border transition-colors ${
                          selectedMotionPrompt === motionPrompt
                            ? 'border-purple-500 bg-purple-100'
                            : 'border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        {motionPrompt}
                      </button>
                    ))}
                  </div>
                  
                  {selectedMotionPrompt && (
                    <button
                      onClick={handleGenerateVideo}
                      disabled={isGeneratingVideo}
                      className="w-full mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
                    >
                      {isGeneratingVideo ? '비디오 생성 중...' : '비디오 생성'}
                    </button>
                  )}
                </div>
              )}

              {/* 생성된 비디오 */}
              {currentVideo && (
                <div className="mt-6 p-4 bg-green-50 rounded-lg">
                  <h3 className="text-lg font-semibold mb-3">생성된 비디오</h3>
                  <video
                    src={currentVideo.url}
                    controls
                    className="w-full rounded-lg"
                  />
                  <p className="text-sm text-gray-600 mt-2">{currentVideo.motionPrompt}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="App">
      {currentPage === 'home' && <HomePage />}
      {(currentPage === '2d' || currentPage === '3d' || currentPage === 'image' || currentPage === 'icon') && (
        <StudioPage studioType={currentPage} />
      )}
    </div>
  );
}

export default App;