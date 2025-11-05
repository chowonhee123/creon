import React, { useState } from 'react';
import { TextField, Button, Text, View, Stack, Card, Textarea } from 'reshaped';
import { useApp } from '../../context/AppContext';
import { generateImage, ReferenceImage } from '../../utils/imageGeneration';
import { showToast } from '../Toast';
import type { GeneratedImageData } from '../../context/AppContext';

export const ImageStudioPage: React.FC = () => {
  const {
    currentGeneratedImageStudio,
    setCurrentGeneratedImageStudio,
    imageStudioHistory,
    setImageStudioHistory,
    imageStudioHistoryIndex,
    setImageStudioHistoryIndex,
  } = useApp();

  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [referenceImages, setReferenceImages] = useState<(ReferenceImage | null)[]>([]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      showToast({ type: 'error', title: 'Input Required', body: 'Please enter a prompt for your image.' });
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateImage(prompt, referenceImages.filter(img => img !== null) as ReferenceImage[]);
      
      if (result) {
        const newImage: GeneratedImageData = {
          id: `image_${Date.now()}`,
          data: result.data,
          mimeType: result.mimeType,
          subject: prompt,
          styleConstraints: prompt,
          timestamp: Date.now(),
          modificationType: 'Original'
        };

        const newHistory = [...imageStudioHistory];
        newHistory.splice(imageStudioHistoryIndex + 1);
        newHistory.push(newImage);
        
        setCurrentGeneratedImageStudio(newImage);
        setImageStudioHistory(newHistory);
        setImageStudioHistoryIndex(newHistory.length - 1);
        
        showToast({ type: 'success', title: 'Generated!', body: 'Image has been generated successfully.' });
      } else {
        showToast({ type: 'error', title: 'Generation Failed', body: 'Failed to generate image. Please try again.' });
      }
    } catch (error) {
      console.error('Error generating image:', error);
      showToast({ type: 'error', title: 'Error', body: 'An error occurred while generating the image.' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div id="page-image" className="page-container" style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto' }}>
      <Stack gap={6}>
        <div>
          <Text variant="featured-1" weight="bold">Image Studio</Text>
          <Text variant="body-2" color="neutral-faded">Create high-quality images with AI</Text>
        </div>

        <Card>
          <Stack gap={4}>
            <Text variant="featured-3" weight="semibold">Generate Image</Text>
            <Textarea
              placeholder="Describe the image you want to create..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              resize="vertical"
            />
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              color="primary"
              fullWidth
              size="large"
            >
              {isGenerating ? 'Generating...' : 'Generate Image'}
            </Button>
          </Stack>
        </Card>

        {currentGeneratedImageStudio && (
          <Card>
            <Stack gap={4}>
              <Text variant="featured-3" weight="semibold">Generated Image</Text>
              <img
                src={`data:${currentGeneratedImageStudio.mimeType};base64,${currentGeneratedImageStudio.data}`}
                alt={currentGeneratedImageStudio.subject}
                style={{
                  width: '100%',
                  maxWidth: '800px',
                  height: 'auto',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #e0e0e0)'
                }}
              />
              <Stack direction="row" gap={2}>
                <Button
                  variant="outline"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = `data:${currentGeneratedImageStudio.mimeType};base64,${currentGeneratedImageStudio.data}`;
                    link.download = `${currentGeneratedImageStudio.subject.replace(/\s+/g, '_')}.png`;
                    link.click();
                  }}
                >
                  Download
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const newHistory = [...imageStudioHistory];
                    if (imageStudioHistoryIndex > 0) {
                      setImageStudioHistoryIndex(imageStudioHistoryIndex - 1);
                      setCurrentGeneratedImageStudio(newHistory[imageStudioHistoryIndex - 1]);
                    }
                  }}
                  disabled={imageStudioHistoryIndex <= 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const newHistory = [...imageStudioHistory];
                    if (imageStudioHistoryIndex < newHistory.length - 1) {
                      setImageStudioHistoryIndex(imageStudioHistoryIndex + 1);
                      setCurrentGeneratedImageStudio(newHistory[imageStudioHistoryIndex + 1]);
                    }
                  }}
                  disabled={imageStudioHistoryIndex >= imageStudioHistory.length - 1}
                >
                  Next
                </Button>
              </Stack>
            </Stack>
          </Card>
        )}
      </Stack>
    </div>
  );
};
