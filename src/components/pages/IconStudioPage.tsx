import React, { useState, useMemo } from 'react';
import { TextField, Button, Text, View, Stack, Card } from 'reshaped';
import { useApp } from '../../context/AppContext';
import { ICON_DATA, ICON_STUDIO_3D_PROMPT_TEMPLATE } from '../../utils/constants';
import { generateImage, ReferenceImage } from '../../utils/imageGeneration';
import { showToast } from '../Toast';
import type { GeneratedImageData } from '../../context/AppContext';

export const IconStudioPage: React.FC = () => {
  const { selectedIcon, setSelectedIcon, currentGeneratedImage, setCurrentGeneratedImage, imageHistory, setImageHistory, historyIndex, setHistoryIndex } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [userPrompt, setUserPrompt] = useState('');

  const filteredIcons = useMemo(() => {
    if (!searchQuery.trim()) return ICON_DATA;
    const query = searchQuery.toLowerCase();
    return ICON_DATA.filter(icon => 
      icon.name.toLowerCase().includes(query) ||
      icon.tags.some(tag => tag.toLowerCase().includes(query))
    );
  }, [searchQuery]);

  const handleIconClick = (icon: typeof ICON_DATA[0]) => {
    setSelectedIcon(icon);
    setUserPrompt(icon.name);
  };

  const handleConvertTo3D = async () => {
    if (!selectedIcon && !userPrompt.trim()) {
      showToast({ type: 'error', title: 'Input Required', body: 'Please select an icon or enter a prompt.' });
      return;
    }

    setIsGenerating(true);
    try {
      const subject = selectedIcon?.name || userPrompt;
      const prompt = ICON_STUDIO_3D_PROMPT_TEMPLATE.replace('{ICON_SUBJECT}', subject);

      const result = await generateImage(prompt, []);
      
      if (result) {
        const newImage: GeneratedImageData = {
          id: `icon_${Date.now()}`,
          data: result.data,
          mimeType: result.mimeType,
          subject: subject,
          styleConstraints: prompt,
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
      console.error('Error generating icon:', error);
      showToast({ type: 'error', title: 'Error', body: 'An error occurred while generating the icon.' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div id="page-icons" className="page-container" style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto' }}>
      <Stack gap={6}>
        <div>
          <Text variant="featured-1" weight="bold">Icon Studio</Text>
          <Text variant="body-2" color="neutral-faded">Select an icon or create a custom 3D icon</Text>
        </div>

        <Card>
          <Stack gap={4}>
            <TextField
              placeholder="Search icons..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="large"
            />
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: '16px',
              maxHeight: '400px',
              overflowY: 'auto',
              padding: '16px',
              border: '1px solid var(--border-color, #e0e0e0)',
              borderRadius: '8px'
            }}>
              {filteredIcons.map((icon) => (
                <button
                  key={icon.name}
                  onClick={() => handleIconClick(icon)}
                  style={{
                    padding: '16px',
                    border: selectedIcon?.name === icon.name ? '2px solid var(--accent-color, #2962FF)' : '1px solid var(--border-color, #e0e0e0)',
                    borderRadius: '8px',
                    backgroundColor: selectedIcon?.name === icon.name ? 'var(--accent-color-faded, rgba(41, 98, 255, 0.1))' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>
                    {icon.name}
                  </span>
                  <div style={{ fontSize: '12px', marginTop: '8px', textAlign: 'center' }}>
                    {icon.name}
                  </div>
                </button>
              ))}
            </div>
          </Stack>
        </Card>

        <Card>
          <Stack gap={4}>
            <Text variant="featured-3" weight="semibold">Custom Prompt</Text>
            <TextField
              placeholder="Enter icon subject (e.g., 'heart', 'home', 'star')"
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              size="large"
            />
            <Button
              onClick={handleConvertTo3D}
              disabled={isGenerating || (!selectedIcon && !userPrompt.trim())}
              color="primary"
              fullWidth
              size="large"
            >
              {isGenerating ? 'Generating...' : 'Generate 3D Icon'}
            </Button>
          </Stack>
        </Card>

        {currentGeneratedImage && (
          <Card>
            <Stack gap={4}>
              <Text variant="featured-3" weight="semibold">Generated Icon</Text>
              <img
                src={`data:${currentGeneratedImage.mimeType};base64,${currentGeneratedImage.data}`}
                alt={currentGeneratedImage.subject}
                style={{
                  width: '100%',
                  maxWidth: '512px',
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
        )}
      </Stack>
    </div>
  );
};
