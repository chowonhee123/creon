import React, { useState, useRef, useEffect } from 'react';
import { Button, Text, Accordion, TextArea } from 'reshaped';
import type { GeneratedImageData } from '../../../../context/AppContext';
import { SvgPreview } from './SvgPreview';
import { normalizeHex } from '../utils/imageUtils';

interface DetailsPanelProps {
  image: GeneratedImageData | null;
  isOpen: boolean;
  onClose: () => void;
  onRegenerate: (color: string) => Promise<void>;
  onRemoveBackground: () => Promise<void>;
  onConvertToSVG: () => Promise<void>;
  onCopy: () => void;
  onDelete: () => void;
  onDownload: () => void;
  history: GeneratedImageData[];
  currentHistoryIndex: number;
  onHistoryItemSelect: (index: number) => void;
  onHistoryItemCompare?: (index: number) => void;
}

/**
 * Details panel for 2D Studio.
 * Contains preview, Fix the icon controls, and history tab.
 */
export const DetailsPanel: React.FC<DetailsPanelProps> = ({
  image,
  isOpen,
  onClose,
  onRegenerate,
  onRemoveBackground,
  onConvertToSVG,
  onCopy,
  onDelete,
  onDownload,
  history,
  currentHistoryIndex,
  onHistoryItemSelect,
  onHistoryItemCompare,
}) => {
  const [activeTab, setActiveTab] = useState<'detail' | 'history'>('detail');
  const [fixIconOpen, setFixIconOpen] = useState(false);
  const [strokeHex, setStrokeHex] = useState('#000000');
  const [strokeHexValid, setStrokeHexValid] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [isConvertingSvg, setIsConvertingSvg] = useState(false);
  const [svgString, setSvgString] = useState<string | null>(null);
  const [showSvgPreview, setShowSvgPreview] = useState(false);
  const [svgBgTransparent, setSvgBgTransparent] = useState(true);
  const hiddenColorPickerRef = useRef<HTMLInputElement>(null);
  const lastValidHexRef = useRef('#000000');
  const mountedRef = useRef(false);

  // Guard against double-invocation in StrictMode
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Normalize HEX validation - using utility function
  const validateHex = (value: string): string | null => {
    return normalizeHex(value);
  };

  // Sync HEX input with color picker
  const handleHexChange = (value: string) => {
    const normalized = validateHex(value);
    const valid = !!normalized;
    setStrokeHexValid(valid);
    
    if (valid && normalized) {
      lastValidHexRef.current = normalized;
      setStrokeHex(normalized);
      if (hiddenColorPickerRef.current) {
        hiddenColorPickerRef.current.value = normalized;
      }
    }
  };

  const handleHexKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const normalized = validateHex(e.currentTarget.value) || lastValidHexRef.current;
      setStrokeHex(normalized);
      lastValidHexRef.current = normalized;
      if (hiddenColorPickerRef.current) {
        hiddenColorPickerRef.current.value = normalized;
      }
    } else if (e.key === 'Escape') {
      e.currentTarget.value = lastValidHexRef.current;
      setStrokeHex(lastValidHexRef.current);
    }
  };

  const handleColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = (e.target.value || '#000000').toUpperCase();
    lastValidHexRef.current = hex;
    setStrokeHex(hex);
    setStrokeHexValid(true);
  };

  const handleRegenerate = async () => {
    if (!strokeHexValid || !image) return;
    
    setIsRegenerating(true);
    try {
      await onRegenerate(strokeHex);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleRemoveBackground = async () => {
    setIsRemovingBg(true);
    try {
      await onRemoveBackground();
    } finally {
      setIsRemovingBg(false);
    }
  };

  const handleConvertToSVG = async () => {
    setIsConvertingSvg(true);
    try {
      await onConvertToSVG();
      // SVG conversion will set svgString via callback
    } finally {
      setIsConvertingSvg(false);
    }
  };

  if (!isOpen || !image) return null;

  const imageDataUrl = `data:${image.mimeType};base64,${image.data}`;
  const isTransparent = image.modificationType === 'BG Removed' || image.modificationType === 'SVG';

  return (
    <aside 
      id="p2d-image-details-panel" 
      className={`details-panel ${isOpen ? 'is-open' : 'hidden'}`}
    >
      <div className="details-panel-content">
        <header className="details-panel-header">
          <h2>Details</h2>
          <button 
            className="icon-button" 
            aria-label="Close details"
            onClick={onClose}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        
        <div className="details-panel-tabs">
          <button
            className={`tab-item ${activeTab === 'detail' ? 'active' : ''}`}
            onClick={() => setActiveTab('detail')}
          >
            Detail
          </button>
          <button
            className={`tab-item ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            History
          </button>
        </div>

        <div className="details-panel-body">
          {activeTab === 'detail' && (
            <div className="details-tab-content" data-tab-content="detail">
              <div className="details-preview">
                <img
                  id="p2d-details-preview-image"
                  src={imageDataUrl}
                  alt="Details preview"
                  style={{
                    backgroundColor: isTransparent ? '' : '#ffffff',
                    backgroundImage: isTransparent
                      ? 'repeating-linear-gradient(45deg, #f0f0f0 25%, transparent 25%, transparent 75%, #f0f0f0 75%, #f0f0f0), repeating-linear-gradient(45deg, #f0f0f0 25%, #ffffff 25%, #ffffff 75%, #f0f0f0 75%, #f0f0f0)'
                      : '',
                    backgroundPosition: isTransparent ? '0 0, 8px 8px' : '',
                    backgroundSize: isTransparent ? '16px 16px' : '',
                  }}
                />
              </div>

              {/* Fix the icon accordion */}
              <Accordion 
                active={fixIconOpen} 
                onToggle={setFixIconOpen}
                style={{ marginTop: 'var(--spacing-4)' }}
              >
                <Accordion.Trigger>
                  <Text>Fix the icon</Text>
                </Accordion.Trigger>
                <Accordion.Content>
                  <div className="filter-group" style={{ gap: 'var(--spacing-3)' }}>
                    {/* Stroke HEX input */}
                    <div className="filter-group">
                      <label 
                        htmlFor="p2d-stroke-hex" 
                        style={{ 
                          fontSize: '13px', 
                          marginBottom: 'var(--spacing-1)' 
                        }}
                      >
                        Stroke
                      </label>
                      <input
                        id="p2d-stroke-hex"
                        aria-label="Stroke HEX color"
                        placeholder="#000000"
                        value={strokeHex}
                        onChange={(e) => handleHexChange(e.target.value)}
                        onKeyDown={handleHexKeyDown}
                        style={{
                          width: '100%',
                          padding: 'var(--spacing-2)',
                          border: `1px solid ${strokeHexValid ? 'var(--border-color)' : 'var(--danger-color)'}`,
                          borderRadius: 'var(--border-radius-md)',
                          background: 'var(--input-bg)',
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                          textTransform: 'uppercase',
                        }}
                      />
                      <input
                        ref={hiddenColorPickerRef}
                        type="color"
                        id="p2d-object-color-picker"
                        value={strokeHex}
                        onChange={handleColorPickerChange}
                        style={{ display: 'none' }}
                      />
                    </div>

                    {/* Regenerate Button */}
                    <Button
                      variant="solid"
                      fullWidth
                      onClick={handleRegenerate}
                      disabled={!strokeHexValid || isRegenerating}
                      className="primary-btn"
                    >
                      <span className="material-symbols-outlined">auto_awesome</span>
                      <span className="btn-text">
                        {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                      </span>
                      {isRegenerating && <div className="btn-loader"></div>}
                    </Button>

                    {/* Transform Row */}
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 1fr', 
                      gap: 'var(--spacing-2)' 
                    }}>
                      <Button
                        variant="ghost"
                        onClick={handleRemoveBackground}
                        disabled={isRemovingBg}
                        className="secondary-btn"
                      >
                        <span className="material-symbols-outlined">content_cut</span>
                        Remove Background
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={handleConvertToSVG}
                        disabled={isConvertingSvg}
                        className="secondary-btn"
                      >
                        <span className="material-symbols-outlined">code</span>
                        Convert to SVG
                      </Button>
                    </div>
                  </div>
                </Accordion.Content>
              </Accordion>

              {/* Bottom Actions */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-2)',
                marginTop: 'auto',
                paddingTop: 'var(--spacing-4)',
                position: 'relative',
              }}>
                {/* More menu button and dropdown would go here */}
                <Button
                  variant="ghost"
                  fullWidth
                  onClick={onDownload}
                  className="secondary-btn"
                  as="a"
                  download
                  href={imageDataUrl}
                >
                  <span className="material-symbols-outlined">download</span>
                  <span className="btn-text">Download</span>
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="details-tab-content" data-tab-content="history">
              <div 
                id="p2d-details-history-list" 
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-3)',
                  padding: 'var(--spacing-2)',
                  overflowY: 'auto',
                }}
              >
                {history.length === 0 ? (
                  <p style={{
                    padding: 'var(--spacing-4)',
                    textAlign: 'center',
                    color: 'var(--text-secondary)',
                  }}>
                    No Fix history available
                  </p>
                ) : (
                  history.map((item, index) => {
                    const isActive = index === currentHistoryIndex;
                    const modificationType = item.modificationType || 'Original';
                    const isTransparentItem = modificationType === 'BG Removed' || modificationType === 'SVG';
                    const itemDataUrl = `data:${item.mimeType};base64,${item.data}`;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="details-history-thumbnail-btn"
                        onClick={() => onHistoryItemSelect(index)}
                        style={{
                          position: 'relative',
                          width: '100%',
                          height: '270px',
                          padding: 0,
                          border: isActive
                            ? '3px solid var(--primary-color, #0070F3)'
                            : '1px solid var(--border-color)',
                          borderRadius: 'var(--border-radius-md)',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          transition: 'all 0.2s ease',
                          backgroundColor: isTransparentItem ? '' : '#ffffff',
                          backgroundImage: isTransparentItem
                            ? 'repeating-linear-gradient(45deg, #f0f0f0 25%, transparent 25%, transparent 75%, #f0f0f0 75%, #f0f0f0), repeating-linear-gradient(45deg, #f0f0f0 25%, #ffffff 25%, #ffffff 75%, #f0f0f0 75%, #f0f0f0)'
                            : '',
                          backgroundPosition: isTransparentItem ? '0 0, 8px 8px' : '',
                          backgroundSize: isTransparentItem ? '16px 16px' : '',
                        }}
                        aria-label={`Load history item ${index + 1}`}
                      >
                        <div style={{
                          position: 'absolute',
                          top: '8px',
                          left: '8px',
                          background: 'rgba(0, 0, 0, 0.7)',
                          color: 'white',
                          padding: '4px 8px',
                          borderRadius: 'var(--border-radius-sm)',
                          fontSize: '11px',
                          fontWeight: 500,
                          zIndex: 1,
                        }}>
                          {modificationType}
                        </div>
                        <img
                          src={itemDataUrl}
                          alt={`History item ${index + 1}`}
                          loading="lazy"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            pointerEvents: 'none',
                          }}
                        />
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

