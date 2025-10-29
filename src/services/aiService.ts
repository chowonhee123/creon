import { GoogleGenerativeAI } from '@google/generative-ai';

// Gemini AI 설정
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || 'your-api-key-here');

// 이미지 생성 함수
export async function generateImage(prompt: string, studioType: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // 스튜디오별 프롬프트 템플릿
    const templates = {
      '2d': `Create a beautiful 2D illustration: ${prompt}. Style: flat design, clean lines, vibrant colors.`,
      '3d': `Create a 3D rendered image: ${prompt}. Style: realistic 3D rendering, proper lighting, depth.`,
      'image': `Create a high-quality photograph: ${prompt}. Style: professional photography, sharp focus, good composition.`,
      'icon': `Create a simple icon: ${prompt}. Style: minimalist, clean lines, single color or simple gradient.`
    };

    const enhancedPrompt = templates[studioType as keyof typeof templates] || prompt;
    
    const result = await model.generateContent(enhancedPrompt);
    const response = await result.response;
    const text = response.text();
    
    // 실제 이미지 생성 API 호출 (예시)
    // 여기서는 더미 이미지 URL을 반환
    return `https://picsum.photos/512/512?random=${Date.now()}`;
  } catch (error) {
    console.error('이미지 생성 오류:', error);
    throw new Error('이미지 생성에 실패했습니다.');
  }
}

// Motion 프롬프트 생성 함수
export async function generateMotionPrompts(imagePrompt: string): Promise<string[]> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `Generate 5 creative motion prompts for this image description: "${imagePrompt}". 
    Each prompt should describe a different type of movement or animation. 
    Return only the prompts, one per line, without numbering.`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // 텍스트를 배열로 분할
    return text.split('\n').filter(line => line.trim().length > 0).slice(0, 5);
  } catch (error) {
    console.error('Motion 프롬프트 생성 오류:', error);
    return [
      'Gentle swaying motion',
      'Slow zoom in effect',
      'Subtle rotation',
      'Fade transition',
      'Scale animation'
    ];
  }
}

// 비디오 생성 함수 (시뮬레이션)
export async function generateVideo(motionPrompt: string): Promise<string> {
  try {
    // 실제 비디오 생성 API 호출
    // 여기서는 더미 비디오 URL을 반환
    await new Promise(resolve => setTimeout(resolve, 3000)); // 3초 대기
    return `https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4`;
  } catch (error) {
    console.error('비디오 생성 오류:', error);
    throw new Error('비디오 생성에 실패했습니다.');
  }
}