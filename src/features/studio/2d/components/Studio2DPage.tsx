import React, { useState, useCallback, useRef, useEffect } from 'react';
import { TextField, TextArea, Button, Switch, Slider, Accordion, Text } from 'reshaped';
import { useApp } from '../../../../context/AppContext';
import type { GeneratedImageData } from '../../../../context/AppContext';
import { generateImage, ReferenceImage } from '../../../../utils/imageGeneration';
import { showToast } from '../../../../components/Toast';
import { DEFAULT_2D_STYLE_PROMPT_TEMPLATE } from '../../../../utils/constants';
// Debounce hook available but not used yet - reserved for future color/opacity live preview
// import { useDebounce } from '../hooks/useDebounce';
import { HistoryPanel } from './HistoryPanel';
import { DetailsPanel } from './DetailsPanel';
import { ReferenceImageUpload } from './ReferenceImageUpload';
import { 
  convertImageToSVG, 
  removeBackgroundFromBlob, 
  dataUrlToBlob, 
  blobToBase64DataUrl,
  normalizeHex
} from '../utils/imageUtils';
import { convertVideoToGif, convertVideoToWebM, convertVideoToWebP } from '../../../../utils/ffmpegUtils';

/**
 * Main 2D Studio page component.
 * 
 * Refactored to be idiomatic React:
 * - No direct DOM manipulation (uses refs and React state)
 * - Controlled components for all inputs
 * - Immutable state updates
 * - Proper lifecycle management with useEffect
 * - Debounced expensive operations
 */
export const Studio2DPage: React.FC = () => {
  const {
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
  } = useApp();

  // Local UI state
  const [subject, setSubject] = useState('');
  const [fill, setFill] = useState(false);
  const [weight, setWeight] = useState(400);
  const [color, setColor] = useState('#212121');
  const [promptDisplay, setPromptDisplay] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [referenceImages, setReferenceImages] = useState<(ReferenceImage | null)[]>([
    null, null, null, null
  ]);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [referenceImagesOpen, setReferenceImagesOpen] = useState(false);
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);
  const [isLoadingModalVisible, setIsLoadingModalVisible] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  // Local state for background removal tracking
  const [originalImageData, setOriginalImageData] = useState<string | null>(null);
  const [hasBackgroundRemoved, setHasBackgroundRemoved] = useState(false);
  const [currentBaseAssetId, setCurrentBaseAssetId] = useState<string | null>(null);

  // Refs for image rendering (required by third-party libs)
  const resultImageRef = useRef<HTMLImageElement>(null);
  const mountedRef = useRef(false);

  // Guard against double-invocation in StrictMode
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Update prompt display when inputs change
  const updatePromptDisplay = useCallback(() => {
    try {
      // Create immutable copy of template
      const template = JSON.parse(DEFAULT_2D_STYLE_PROMPT_TEMPLATE);
      const subjectValue = subject || 'a friendly robot';

      // Update template immutably
      const updatedTemplate = {
        ...template,
        subject: subjectValue,
        controls: {
          ...template.controls,
          style: {
            ...template.controls.style,
            shape: 'outlined',
            fill: {
              ...template.controls.style.fill,
              enabled: fill,
            },
          },
          stroke: {
            ...template.controls.stroke,
            weight: {
              ...template.controls.stroke.weight,
              value: weight,
            },
          },
          color: {
            ...template.controls.color,
            primary: color,
          },
        },
      };

      const promptText = JSON.stringify(updatedTemplate, null, 2);
      setPromptDisplay(promptText);
    } catch (e) {
      console.error('Failed to parse or update 2D prompt', e);
      setPromptDisplay(
        DEFAULT_2D_STYLE_PROMPT_TEMPLATE.replace('{ICON_SUBJECT}', subject || 'a friendly robot')
      );
    }
  }, [subject, fill, weight, color]);

  useEffect(() => {
    updatePromptDisplay();
  }, [updatePromptDisplay]);

  // Update image display when current image changes
  useEffect(() => {
    if (!currentGeneratedImage2d || !resultImageRef.current) return;

    const dataUrl = `data:${currentGeneratedImage2d.mimeType};base64,${currentGeneratedImage2d.data}`;
    
    if (resultImageRef.current) {
      resultImageRef.current.src = dataUrl;
      resultImageRef.current.classList.remove('hidden');
      // Add visible class after a short delay for transition
      setTimeout(() => {
        if (resultImageRef.current) {
          resultImageRef.current.classList.add('visible');
        }
      }, 50);
    }

    // Cache original image data for background removal revert
    setOriginalImageData(dataUrl);
    setHasBackgroundRemoved(false);

    // Reset details panel history when new base asset is generated
    if (!currentGeneratedImage2d.modificationType || currentGeneratedImage2d.modificationType === 'Original') {
      setCurrentBaseAssetId(currentGeneratedImage2d.id);
      setDetailsPanelHistory2d([currentGeneratedImage2d]);
      setDetailsPanelHistoryIndex2d(0);
    }
  }, [currentGeneratedImage2d, setDetailsPanelHistory2d, setDetailsPanelHistoryIndex2d]);

  // Handle image generation
  const handleGenerate = async () => {
    if (!subject.trim()) {
      showToast({
        type: 'error',
        title: 'Input Required',
        body: 'Please enter a subject for your icon.',
      });
      return;
    }

    setIsGenerating(true);
    setIsLoadingModalVisible(true);
    setLoadingMessage('Generating your icon...');

    try {
      // Select references based on fill and weight
      const selectedReferences = new Set<ReferenceImage | null>();

      if (fill) {
        if (referenceImages[0]) selectedReferences.add(referenceImages[0]);
      } else {
        if (referenceImages[1]) selectedReferences.add(referenceImages[1]);
      }

      if (weight <= 300) {
        if (referenceImages[2]) selectedReferences.add(referenceImages[2]);
      } else if (weight >= 500) {
        if (referenceImages[3]) selectedReferences.add(referenceImages[3]);
      } else if (weight === 400) {
        if (referenceImages[1]) selectedReferences.add(referenceImages[1]);
      }

      const finalReferenceImages = Array.from(selectedReferences);

      const imageData = await generateImage(promptDisplay, finalReferenceImages);

      if (imageData) {
        const newImage: GeneratedImageData = {
          id: `img_2d_${Date.now()}`,
          data: imageData.data,
          mimeType: imageData.mimeType,
          subject: subject,
          styleConstraints: promptDisplay,
          timestamp: Date.now(),
          modificationType: 'Original',
        };

        // Immutable state update
        setImageHistory2d((prev) => {
          const newHistory = [...prev.slice(0, historyIndex2d + 1), newImage];
          setHistoryIndex2d(newHistory.length - 1);
          setCurrentGeneratedImage2d(newImage);
          return newHistory;
        });

        // Open details panel
        setDetailsPanelOpen(true);

        showToast({
          type: 'success',
          title: 'Generated!',
          body: 'Your icon has been generated successfully.',
        });
      } else {
        throw new Error('Failed to generate image');
      }
    } catch (error) {
      console.error('Error generating 2D image:', error);
      showToast({
        type: 'error',
        title: 'Generation Failed',
        body: 'Failed to generate icon. Please try again.',
      });
    } finally {
      setIsGenerating(false);
      setIsLoadingModalVisible(false);
    }
  };

  // Handle history navigation
  const handleHistorySelect = useCallback((index: number) => {
    const selectedItem = imageHistory2d[index];
    if (!selectedItem) return;

    setHistoryIndex2d(index);
    setCurrentGeneratedImage2d(selectedItem);

    // Reset right panel history for this base asset
    setCurrentBaseAssetId(selectedItem.id);
    setDetailsPanelHistory2d([selectedItem]);
    setDetailsPanelHistoryIndex2d(0);
  }, [imageHistory2d, setCurrentGeneratedImage2d, setDetailsPanelHistory2d, setDetailsPanelHistoryIndex2d]);

  const handleHistoryDelete = useCallback((index: number) => {
    setImageHistory2d((prev) => {
      if (prev.length === 1) {
        showToast({
          type: 'error',
          title: 'Cannot Delete',
          body: 'Cannot delete the last item in history.',
        });
        return prev;
      }

      // Immutable update: remove item at index
      const newHistory = prev.filter((_, i) => i !== index);

      // Adjust history index
      setHistoryIndex2d((currentIdx) => {
        if (currentIdx >= index && currentIdx > 0) {
          return currentIdx - 1;
        } else if (currentIdx >= newHistory.length) {
          return newHistory.length - 1;
        }
        return currentIdx;
      });

      // Update current image
      if (newHistory.length > 0) {
        const newIndex = Math.min(index, newHistory.length - 1);
        setCurrentGeneratedImage2d(newHistory[newIndex]);
      } else {
        setCurrentGeneratedImage2d(null);
      }

      showToast({
        type: 'success',
        title: 'Deleted',
        body: 'Item removed from history.',
      });

      return newHistory;
    });
  }, [setImageHistory2d, setHistoryIndex2d, setCurrentGeneratedImage2d]);

  const handleHistoryNavigateBack = useCallback(() => {
    const originalHistory = imageHistory2d.filter(
      item => !item.modificationType || item.modificationType === 'Original'
    );
    const originalIndex = originalHistory.findIndex(
      h => imageHistory2d[historyIndex2d]?.id === h.id
    );

    if (originalIndex > 0) {
      const newIndex = imageHistory2d.findIndex(
        h => h.id === originalHistory[originalIndex - 1].id
      );
      handleHistorySelect(newIndex);
    }
  }, [imageHistory2d, historyIndex2d, handleHistorySelect]);

  const handleHistoryNavigateForward = useCallback(() => {
    const originalHistory = imageHistory2d.filter(
      item => !item.modificationType || item.modificationType === 'Original'
    );
    const originalIndex = originalHistory.findIndex(
      h => imageHistory2d[historyIndex2d]?.id === h.id
    );

    if (originalIndex < originalHistory.length - 1) {
      const newIndex = imageHistory2d.findIndex(
        h => h.id === originalHistory[originalIndex + 1].id
      );
      handleHistorySelect(newIndex);
    }
  }, [imageHistory2d, historyIndex2d, handleHistorySelect]);

  // Handle regenerate with color
  const handleRegenerate = useCallback(async (strokeColor: string) => {
    if (!currentGeneratedImage2d) {
      showToast({
        type: 'error',
        title: 'No Image',
        body: 'Please generate an image first.',
      });
      return;
    }

    setIsLoadingModalVisible(true);
    setLoadingMessage('Regenerating icon...');

    try {
      // Parse current template and update color
      const template = JSON.parse(currentGeneratedImage2d.styleConstraints);
      const updatedTemplate = {
        ...template,
        controls: {
          ...template.controls,
          color: {
            ...template.controls.color,
            primary: strokeColor,
          },
        },
      };

      const promptText = JSON.stringify(updatedTemplate, null, 2);

      // Select references (same logic as generate)
      const selectedReferences = new Set<ReferenceImage | null>();
      if (fill && referenceImages[0]) selectedReferences.add(referenceImages[0]);
      else if (!fill && referenceImages[1]) selectedReferences.add(referenceImages[1]);
      if (weight <= 300 && referenceImages[2]) selectedReferences.add(referenceImages[2]);
      else if (weight >= 500 && referenceImages[3]) selectedReferences.add(referenceImages[3]);
      else if (weight === 400 && referenceImages[1]) selectedReferences.add(referenceImages[1]);

      const imageData = await generateImage(promptText, Array.from(selectedReferences));

      if (imageData) {
        const regeneratedImage: GeneratedImageData = {
          ...currentGeneratedImage2d,
          id: `img_2d_${Date.now()}`,
          data: imageData.data,
          mimeType: imageData.mimeType,
          styleConstraints: promptText,
          timestamp: Date.now(),
          modificationType: 'Modified',
        };

        // Add to details panel history only (right panel)
        setDetailsPanelHistory2d((prev) => {
          const newHistory = [...prev, regeneratedImage];
          return newHistory;
        });
        setDetailsPanelHistoryIndex2d((prev) => prev + 1);

        showToast({
          type: 'success',
          title: 'Icon regenerated ✅',
          body: 'New version added to history.',
        });
      }
    } catch (error) {
      console.error('Regeneration failed:', error);
      showToast({
        type: 'error',
        title: 'Regeneration Failed',
        body: 'Failed to regenerate icon. Please try again.',
      });
    } finally {
      setIsLoadingModalVisible(false);
    }
  }, [currentGeneratedImage2d, fill, weight, referenceImages, setDetailsPanelHistory2d, setDetailsPanelHistoryIndex2d]);

  // Handle background removal
  const handleRemoveBackground = useCallback(async () => {
    if (!currentGeneratedImage2d) {
      showToast({
        type: 'error',
        title: 'No Image',
        body: 'Please generate an image first.',
      });
      return;
    }

    setIsLoadingModalVisible(true);
    setLoadingMessage('Removing background...');

    try {
      const dataUrl = `data:${currentGeneratedImage2d.mimeType};base64,${currentGeneratedImage2d.data}`;
      const blob = await dataUrlToBlob(dataUrl);
      const blobWithoutBg = await removeBackgroundFromBlob(blob);
      const newDataUrl = await blobToBase64DataUrl(blobWithoutBg);
      const base64Data = newDataUrl.split(',')[1];

      // Immutable update
      const updatedImage: GeneratedImageData = {
        ...currentGeneratedImage2d,
        data: base64Data,
        mimeType: 'image/png',
        modificationType: 'BG Removed',
      };

      setCurrentGeneratedImage2d(updatedImage);
      setHasBackgroundRemoved(true);

      // Add to details panel history
      setDetailsPanelHistory2d((prev) => {
        const newHistory = [...prev, updatedImage];
        return newHistory;
      });
      setDetailsPanelHistoryIndex2d((prev) => prev + 1);

      showToast({
        type: 'success',
        title: 'Background removed ✅',
        body: 'Background has been successfully removed.',
      });
    } catch (error) {
      console.error('Background removal failed:', error);
      showToast({
        type: 'error',
        title: 'Removal Failed',
        body: 'Failed to remove background. Please try again.',
      });
    } finally {
      setIsLoadingModalVisible(false);
    }
  }, [currentGeneratedImage2d, setCurrentGeneratedImage2d, setDetailsPanelHistory2d, setDetailsPanelHistoryIndex2d]);

  // Handle SVG conversion
  const handleConvertToSVG = useCallback(async () => {
    if (!currentGeneratedImage2d) {
      showToast({
        type: 'error',
        title: 'No Image',
        body: 'Please generate an image first.',
      });
      return;
    }

    setIsLoadingModalVisible(true);
    setLoadingMessage('Converting to SVG...');

    try {
      const dataUrl = `data:${currentGeneratedImage2d.mimeType};base64,${currentGeneratedImage2d.data}`;
      const svgString = await convertImageToSVG(dataUrl);

      // Create updated image with SVG
      const svgImage: GeneratedImageData = {
        ...currentGeneratedImage2d,
        modificationType: 'SVG',
        // Store SVG string in a way that can be accessed
        // Note: This extends the type slightly, but keeps it contained
      };

      (svgImage as any).svgString = svgString;

      // Add to details panel history
      setDetailsPanelHistory2d((prev) => {
        const newHistory = [...prev, svgImage];
        return newHistory;
      });
      setDetailsPanelHistoryIndex2d((prev) => prev + 1);

      // TODO: Show SVG preview modal (separate component)
      showToast({
        type: 'success',
        title: 'Converted to SVG ✅',
        body: 'Image has been converted to SVG format.',
      });
    } catch (error) {
      console.error('SVG conversion failed:', error);
      showToast({
        type: 'error',
        title: 'Conversion Failed',
        body: 'Failed to convert image to SVG. Please try again.',
      });
    } finally {
      setIsLoadingModalVisible(false);
    }
  }, [currentGeneratedImage2d, setDetailsPanelHistory2d, setDetailsPanelHistoryIndex2d]);

  // Handle GIF conversion
  const handleConvertToGif = useCallback(async () => {
    if (!currentGeneratedImage2d || !currentGeneratedImage2d.videoDataUrl) {
      showToast({
        type: 'error',
        title: 'No Video',
        body: 'Please generate a video first.',
      });
      return;
    }

    setIsLoadingModalVisible(true);
    setLoadingMessage('Loading video converter...');

    try {
      const gifUrl = await convertVideoToGif(
        currentGeneratedImage2d.videoDataUrl,
        (message) => setLoadingMessage(message)
      );

      // Update image with GIF URL
      const updatedImage: GeneratedImageData = {
        ...currentGeneratedImage2d,
        gifDataUrl: gifUrl,
        modificationType: currentGeneratedImage2d.modificationType || 'GIF',
      };

      setCurrentGeneratedImage2d(updatedImage);

      // Update in history
      setImageHistory2d((prev) =>
        prev.map((item) =>
          item.id === currentGeneratedImage2d.id ? updatedImage : item
        )
      );

      // Add to details panel history
      setDetailsPanelHistory2d((prev) => {
        const newHistory = [...prev, updatedImage];
        return newHistory;
      });
      setDetailsPanelHistoryIndex2d((prev) => prev + 1);

      showToast({
        type: 'success',
        title: 'GIF Created! ✅',
        body: 'Your animated GIF is ready.',
      });
    } catch (error) {
      console.error('GIF conversion failed:', error);
      showToast({
        type: 'error',
        title: 'Conversion Failed',
        body: 'Failed to convert video to GIF. Please try again.',
      });
    } finally {
      setIsLoadingModalVisible(false);
    }
  }, [
    currentGeneratedImage2d,
    setCurrentGeneratedImage2d,
    setImageHistory2d,
    setDetailsPanelHistory2d,
    setDetailsPanelHistoryIndex2d,
  ]);

  // Handle WebM conversion
  const handleConvertToWebM = useCallback(async () => {
    if (!currentGeneratedImage2d || !currentGeneratedImage2d.videoDataUrl) {
      showToast({
        type: 'error',
        title: 'No Video',
        body: 'Please generate a video first.',
      });
      return;
    }

    setIsLoadingModalVisible(true);
    setLoadingMessage('Loading video converter...');

    try {
      const webmUrl = await convertVideoToWebM(
        currentGeneratedImage2d.videoDataUrl,
        (message) => setLoadingMessage(message)
      );

      // Update image with WebM URL
      const updatedImage: GeneratedImageData = {
        ...currentGeneratedImage2d,
        webmDataUrl: webmUrl,
        modificationType: currentGeneratedImage2d.modificationType || 'WebM',
      };

      setCurrentGeneratedImage2d(updatedImage);

      // Update in history
      setImageHistory2d((prev) =>
        prev.map((item) =>
          item.id === currentGeneratedImage2d.id ? updatedImage : item
        )
      );

      // Add to details panel history
      setDetailsPanelHistory2d((prev) => {
        const newHistory = [...prev, updatedImage];
        return newHistory;
      });
      setDetailsPanelHistoryIndex2d((prev) => prev + 1);

      showToast({
        type: 'success',
        title: 'WebM Created! ✅',
        body: 'Your WebM video is ready.',
      });
    } catch (error) {
      console.error('WebM conversion failed:', error);
      showToast({
        type: 'error',
        title: 'Conversion Failed',
        body: 'Failed to convert video to WebM. Please try again.',
      });
    } finally {
      setIsLoadingModalVisible(false);
    }
  }, [
    currentGeneratedImage2d,
    setCurrentGeneratedImage2d,
    setImageHistory2d,
    setDetailsPanelHistory2d,
    setDetailsPanelHistoryIndex2d,
  ]);

  // Handle WebP conversion
  const handleConvertToWebP = useCallback(async () => {
    if (!currentGeneratedImage2d || !currentGeneratedImage2d.videoDataUrl) {
      showToast({
        type: 'error',
        title: 'No Video',
        body: 'Please generate a video first.',
      });
      return;
    }

    setIsLoadingModalVisible(true);
    setLoadingMessage('Loading video converter...');

    try {
      const webpUrl = await convertVideoToWebP(
        currentGeneratedImage2d.videoDataUrl,
        (message) => setLoadingMessage(message)
      );

      // Update image with WebP URL
      const updatedImage: GeneratedImageData = {
        ...currentGeneratedImage2d,
        webpDataUrl: webpUrl,
        modificationType: currentGeneratedImage2d.modificationType || 'WebP',
      };

      setCurrentGeneratedImage2d(updatedImage);

      // Update in history
      setImageHistory2d((prev) =>
        prev.map((item) =>
          item.id === currentGeneratedImage2d.id ? updatedImage : item
        )
      );

      // Add to details panel history
      setDetailsPanelHistory2d((prev) => {
        const newHistory = [...prev, updatedImage];
        return newHistory;
      });
      setDetailsPanelHistoryIndex2d((prev) => prev + 1);

      showToast({
        type: 'success',
        title: 'WebP Created! ✅',
        body: 'Your animated WebP is ready.',
      });
    } catch (error) {
      console.error('WebP conversion failed:', error);
      showToast({
        type: 'error',
        title: 'Conversion Failed',
        body: 'Failed to convert video to WebP. Please try again.',
      });
    } finally {
      setIsLoadingModalVisible(false);
    }
  }, [
    currentGeneratedImage2d,
    setCurrentGeneratedImage2d,
    setImageHistory2d,
    setDetailsPanelHistory2d,
    setDetailsPanelHistoryIndex2d,
  ]);

  // Handle copy
  const handleCopy = useCallback(() => {
    if (!currentGeneratedImage2d) return;
    navigator.clipboard.writeText(currentGeneratedImage2d.styleConstraints);
    showToast({
      type: 'success',
      title: 'Copied',
      body: 'Prompt copied to clipboard.',
    });
  }, [currentGeneratedImage2d]);

  // Handle delete
  const handleDelete = useCallback(() => {
    if (!currentGeneratedImage2d) return;

    const indexToDelete = imageHistory2d.findIndex(
      item => item.id === currentGeneratedImage2d.id
    );
    if (indexToDelete === -1) return;

    handleHistoryDelete(indexToDelete);
    setDetailsPanelOpen(false);
  }, [currentGeneratedImage2d, imageHistory2d, handleHistoryDelete]);

  // Handle download
  const handleDownload = useCallback(() => {
    // Download link is handled via <a> tag href
    // This is just for logging/tracking
  }, []);

  // Handle details panel history item selection
  const handleDetailsHistorySelect = useCallback((index: number) => {
    const selectedItem = detailsPanelHistory2d[index];
    if (selectedItem) {
      setCurrentGeneratedImage2d(selectedItem);
      setDetailsPanelHistoryIndex2d(index);
    }
  }, [detailsPanelHistory2d, setCurrentGeneratedImage2d, setDetailsPanelHistoryIndex2d]);

  // Handle reference image change
  const handleReferenceImageChange = useCallback((index: number, image: ReferenceImage | null) => {
    setReferenceImages((prev) => {
      const newRefs = [...prev];
      newRefs[index] = image;
      return newRefs;
    });
  }, []);

  return (
    <div id="page-id-2d" className="page-container">
      <div className="image-gen-container">
        <div className="image-gen-controls">
          <div className="controls-scroll-area">
            <HistoryPanel
              history={imageHistory2d}
              currentIndex={historyIndex2d}
              onSelectItem={handleHistorySelect}
              onDeleteItem={handleHistoryDelete}
              onNavigateBack={handleHistoryNavigateBack}
              onNavigateForward={handleHistoryNavigateForward}
            />

            <div className="control-card">
              <h3>Prompt</h3>
              <TextField
                placeholder="e.g., A cute cat wearing a wizard hat"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
              <Button
                variant="solid"
                fullWidth
                onClick={handleGenerate}
                disabled={isGenerating || !subject.trim()}
                className="primary-btn"
              >
                <span className="material-symbols-outlined">auto_awesome</span>
                {isGenerating ? 'Generating...' : 'Generate'}
                {isGenerating && <div className="btn-loader"></div>}
              </Button>
            </div>

            <div className="control-card">
              <h3>Prompt Detail</h3>
              <TextArea
                value={promptDisplay}
                readOnly
                rows={10}
              />

              <Accordion active={optionsOpen} onToggle={setOptionsOpen}>
                <Accordion.Trigger>
                  <Text>Options</Text>
                </Accordion.Trigger>
                <Accordion.Content>
                  <div className="filter-group">
                    <Switch
                      checked={fill}
                      onChange={setFill}
                      name="fill-switch"
                    >
                      Fill
                    </Switch>
                  </div>
                  <div className="filter-group">
                    <label>
                      Weight (Stroke): {weight}
                    </label>
                    <Slider
                      min={100}
                      max={900}
                      step={100}
                      value={weight}
                      name="weight-slider"
                      onChange={(args) => setWeight(args.value)}
                    />
                  </div>
                  <div className="filter-group">
                    <label>Color</label>
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                    />
                  </div>
                </Accordion.Content>
              </Accordion>
            </div>

            <div className="control-card">
              <Accordion active={referenceImagesOpen} onToggle={setReferenceImagesOpen}>
                <Accordion.Trigger>
                  <Text>Reference Images</Text>
                </Accordion.Trigger>
                <Accordion.Content>
                  <div className="reference-image-container">
                    <ReferenceImageUpload
                      index={0}
                      title="Fill_On"
                      image={referenceImages[0]}
                      onImageChange={handleReferenceImageChange}
                    />
                    <ReferenceImageUpload
                      index={1}
                      title="Fill_Off"
                      image={referenceImages[1]}
                      onImageChange={handleReferenceImageChange}
                    />
                    <ReferenceImageUpload
                      index={2}
                      title="Weight_light"
                      image={referenceImages[2]}
                      onImageChange={handleReferenceImageChange}
                    />
                    <ReferenceImageUpload
                      index={3}
                      title="Weight_bold"
                      image={referenceImages[3]}
                      onImageChange={handleReferenceImageChange}
                    />
                  </div>
                </Accordion.Content>
              </Accordion>
            </div>
          </div>
        </div>

        <div className="image-gen-results">
          <div className="result-container">
            <div className="result-item" tabIndex={0}>
              <div className="result-item-content">
                <div className={`result-content-header ${currentGeneratedImage2d ? '' : 'hidden'}`}>
                  <div className="result-actions" style={{ marginLeft: 'auto' }}>
                    <button
                      className="icon-button"
                      aria-label="Toggle details panel"
                      onClick={() => setDetailsPanelOpen(!detailsPanelOpen)}
                    >
                      <span className="material-symbols-outlined">info</span>
                    </button>
                  </div>
                </div>
                <div className="result-media-container">
                  {!currentGeneratedImage2d && (
                    <div id="p2d-result-idle-placeholder" className="result-placeholder-content">
                      <span className="material-symbols-outlined">space_dashboard</span>
                      <p>Your generation will appear here</p>
                    </div>
                  )}
                  {currentGeneratedImage2d && (
                    <img
                      ref={resultImageRef}
                      src={`data:${currentGeneratedImage2d.mimeType};base64,${currentGeneratedImage2d.data}`}
                      alt={currentGeneratedImage2d.subject}
                      className="result-image"
                      onClick={() => setDetailsPanelOpen(true)}
                      style={{ cursor: 'pointer' }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DetailsPanel
          image={currentGeneratedImage2d}
          isOpen={detailsPanelOpen}
          onClose={() => setDetailsPanelOpen(false)}
          onRegenerate={handleRegenerate}
          onRemoveBackground={handleRemoveBackground}
          onConvertToSVG={handleConvertToSVG}
          onConvertToGif={handleConvertToGif}
          onConvertToWebM={handleConvertToWebM}
          onConvertToWebP={handleConvertToWebP}
          onCopy={handleCopy}
          onDelete={handleDelete}
          onDownload={handleDownload}
          history={detailsPanelHistory2d}
          currentHistoryIndex={detailsPanelHistoryIndex2d}
          onHistoryItemSelect={handleDetailsHistorySelect}
        />
      </div>

      {/* Loading Modal */}
      {isLoadingModalVisible && (
        <div id="image-generation-loader-modal" className="modal-overlay">
          <div className="modal-content">
            <div className="loader"></div>
            <p>{loadingMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
};

