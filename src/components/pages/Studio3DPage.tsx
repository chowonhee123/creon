import React, { useState } from 'react';
import { TextField, Button, Text, View, Stack, Card } from 'reshaped';
import { useApp } from '../../context/AppContext';
import { Studio3DPlaceholder } from '../Studio3DPlaceholder';
import { DEFAULT_3D_STYLE_PROMPT_TEMPLATE } from '../../utils/constants';
import { generateImage, ReferenceImage } from '../../utils/imageGeneration';
import { showToast } from '../Toast';
import type { GeneratedImageData } from '../../context/AppContext';

export const Studio3DPage: React.FC = () => {
  const {
    currentGeneratedImage,
    setCurrentGeneratedImage,
    imageHistory,
    setImageHistory,
    historyIndex,
    setHistoryIndex,
  } = useApp();

  const [subject, setSubject] = useState('');
  const [promptDisplay, setPromptDisplay] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [referenceImages, setReferenceImages] = useState<(ReferenceImage | null)[]>([]);

  const updatePromptDisplay = () => {
    const template = JSON.parse(DEFAULT_3D_STYLE_PROMPT_TEMPLATE);
    template.subject = subject || 'backpack';
    setPromptDisplay(JSON.stringify(template, null, 2));
  };

  React.useEffect(() => {
    updatePromptDisplay();
  }, [subject]);

  const handleGenerate = async () => {
    if (!subject.trim()) {
      showToast({ type: 'error', title: 'Input Required', body: 'Please enter a subject for your 3D icon.' });
      return;
    }

    setIsGenerating(true);
    try {
      updatePromptDisplay();
      const result = await generateImage(promptDisplay, referenceImages.filter(img => img !== null) as ReferenceImage[]);
      
      if (result) {
        const newImage: GeneratedImageData = {
          id: `3d_${Date.now()}`,
          data: result.data,
          mimeType: result.mimeType,
          subject: subject,
          styleConstraints: promptDisplay,
          timestamp: Date.now(),
          modificationType: 'Original'
        };

        const newHistory = [...imageHistory];
        newHistory.splice(historyIndex + 1);
        newHistory.push(newImage);
        
        setCurrentGeneratedImage(newImage);
        setImageHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        
        showToast({ type: 'success', title: 'Generated!', body: '3D icon has been generated successfully.' });
      } else {
        showToast({ type: 'error', title: 'Generation Failed', body: 'Failed to generate icon. Please try again.' });
      }
    } catch (error) {
      console.error('Error generating 3D image:', error);
      showToast({ type: 'error', title: 'Error', body: 'An error occurred while generating the icon.' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div id="page-id-3d" className="page-container" style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto' }}>
      {!currentGeneratedImage ? (
        <div style={{ position: 'relative', height: '600px' }}>
          <Studio3DPlaceholder sampleImageCount={4} />
          <Card style={{ position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '600px' }}>
            <Stack gap={4}>
              <Text variant="featured-3" weight="semibold">Generate 3D Icon</Text>
              <TextField
                placeholder="Enter subject (e.g., 'backpack', 'car', 'house')"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                size="large"
              />
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !subject.trim()}
                color="primary"
                fullWidth
                size="large"
              >
                {isGenerating ? 'Generating...' : 'Generate'}
              </Button>
            </Stack>
          </Card>
        </div>
      ) : (
        <Stack gap={6}>
          <Card>
            <Stack gap={4}>
              <Text variant="featured-3" weight="semibold">Generated 3D Icon</Text>
              <img
                src={`data:${currentGeneratedImage.mimeType};base64,${currentGeneratedImage.data}`}
                alt={currentGeneratedImage.subject}
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
                    link.href = `data:${currentGeneratedImage.mimeType};base64,${currentGeneratedImage.data}`;
                    link.download = `${currentGeneratedImage.subject}.png`;
                    link.click();
                  }}
                >
                  Download
                </Button>
                <Button
                  variant="outline"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                >
                  Regenerate
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const newHistory = [...imageHistory];
                    if (historyIndex > 0) {
                      setHistoryIndex(historyIndex - 1);
                      setCurrentGeneratedImage(newHistory[historyIndex - 1]);
                    }
                  }}
                  disabled={historyIndex <= 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const newHistory = [...imageHistory];
                    if (historyIndex < newHistory.length - 1) {
                      setHistoryIndex(historyIndex + 1);
                      setCurrentGeneratedImage(newHistory[historyIndex + 1]);
                    }
                  }}
                  disabled={historyIndex >= imageHistory.length - 1}
                >
                  Next
                </Button>
              </Stack>
            </Stack>
          </Card>

          <Card>
            <Stack gap={4}>
              <Text variant="featured-3" weight="semibold">Generate New</Text>
              <TextField
                placeholder="Enter subject (e.g., 'backpack', 'car', 'house')"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                size="large"
              />
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !subject.trim()}
                color="primary"
                fullWidth
              >
                {isGenerating ? 'Generating...' : 'Generate New 3D Icon'}
              </Button>
            </Stack>
          </Card>
        </Stack>
      )}
    </div>
  );
};
