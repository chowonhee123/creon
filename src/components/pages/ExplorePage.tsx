import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TextField, Button, Text } from 'reshaped';
import { useApp } from '../../context/AppContext';

interface ExploreMediaItem {
  id: string;
  name: string;
  type: string;
  dataUrl: string;
  timestamp: number;
}

/**
 * Explore page component.
 * Displays uploaded media (images and videos) in a grid layout.
 * Supports file upload via drag-and-drop or click.
 */
export const ExplorePage: React.FC = () => {
  const { exploreMedia, setExploreMedia } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exploreMainRef = useRef<HTMLDivElement>(null);
  const videoObserverRef = useRef<IntersectionObserver | null>(null);

  // Load initial media from public/home_images.json
  useEffect(() => {
    const loadInitialMedia = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/home_images.json');
        if (!response.ok) {
          throw new Error('Failed to load home images');
        }
        const homeImages: ExploreMediaItem[] = await response.json();
        
        // Set initial media (will only run once on mount)
        setExploreMedia(homeImages);
      } catch (error) {
        console.error('Failed to load home images:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Load initial media on mount
    loadInitialMedia();
  }, [setExploreMedia]); // Only run once on mount

  // Initialize video observer for autoplay on scroll
  useEffect(() => {
    if (!exploreMainRef.current) return;

    // Cleanup previous observer
    if (videoObserverRef.current) {
      videoObserverRef.current.disconnect();
    }

    const options = {
      root: exploreMainRef.current,
      rootMargin: '0px',
      threshold: 0.5,
    };

    const handlePlay = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        const video = entry.target as HTMLVideoElement;
        if (entry.isIntersecting) {
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.catch((error) => {
              console.log('Autoplay prevented for video:', video.src, error);
            });
          }
        } else {
          video.pause();
        }
      });
    };

    videoObserverRef.current = new IntersectionObserver(handlePlay, options);

    // Observe all videos
    const videos = exploreMainRef.current.querySelectorAll('video');
    videos.forEach((video) => {
      videoObserverRef.current?.observe(video);
    });

    return () => {
      if (videoObserverRef.current) {
        videoObserverRef.current.disconnect();
      }
    };
  }, [exploreMedia]); // Re-observe when media changes

  // Handle file upload
  const handleFileUpload = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const newItems: ExploreMediaItem[] = [];

      Array.from(files).forEach((file) => {
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
          return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          const newItem: ExploreMediaItem = {
            id: `local_${Date.now()}_${Math.random()}`,
            name: file.name,
            type: file.type,
            dataUrl: dataUrl,
            timestamp: Date.now(),
          };

          newItems.push(newItem);

          // Update state with all new items
          if (newItems.length === Array.from(files).filter(f => 
            f.type.startsWith('image/') || f.type.startsWith('video/')
          ).length) {
            setExploreMedia((prev) => [...newItems, ...prev]);
          }
        };
        reader.readAsDataURL(file);
      });
    },
    [setExploreMedia]
  );

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    handleFileUpload(files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileUpload(e.target.files);
    // Reset input value to allow re-uploading same file
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClickUpload = () => {
    fileInputRef.current?.click();
  };

  // Filter media based on search query
  const filteredMedia = exploreMedia.filter((item) => {
    if (!searchQuery.trim()) return true;
    return item.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div
      id="page-usages"
      className="page-container explore-container"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        padding: isDragging ? '38px' : '40px',
        maxWidth: '1400px',
        margin: '0 auto',
        width: '100%',
        transition: 'padding 0.2s ease',
        border: isDragging ? '2px dashed var(--accent-color, #2962FF)' : '2px dashed transparent',
        borderRadius: isDragging ? 'var(--border-radius-lg)' : '0',
        backgroundColor: isDragging ? 'var(--input-bg, #f5f5f5)' : 'transparent',
      }}
    >
      <main className="explore-main" ref={exploreMainRef}>
        <div className="hero-content-wrapper">
          <div className="hero-section" style={{ textAlign: 'center', marginBottom: '60px' }}>
            <h1 className="hero-title">
              Build what you imagine.<br />Create beyond boundaries.
            </h1>
            <p className="hero-description" style={{ fontSize: '18px', marginBottom: '32px' }}>
              From icons to 3D motion, all in one creative pipeline.
            </p>

            <div className="generate-box" style={{
              display: 'flex',
              gap: '12px',
              maxWidth: '600px',
              margin: '0 auto 24px'
            }}>
              <TextField
                placeholder="Ask Contents Builder to create..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="large"
                style={{ flex: 1 }}
              />
              <Button variant="solid" size="large">
                Generate
              </Button>
            </div>

            {/* Upload hint */}
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '16px' }}>
              또는 이미지/비디오를 드래그하여 업로드하세요
            </p>
          </div>
        </div>

        <div
          id="explore-feed-container"
          style={{
            minHeight: '200px',
          }}
        >
          {isLoading ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                textAlign: 'center',
              }}
            >
              <div className="loader" style={{ marginBottom: '16px' }}></div>
              <p style={{ color: 'var(--text-secondary, #666)' }}>Loading media...</p>
            </div>
          ) : filteredMedia.length === 0 ? (
            <div
              id="explore-empty-state"
              className="explore-feed-empty"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                textAlign: 'center',
                color: 'var(--text-secondary, #666)',
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: '64px', marginBottom: '16px', opacity: 0.5 }}
              >
                add_photo_alternate
              </span>
              <p style={{ fontSize: '18px', fontWeight: 500, marginBottom: '8px' }}>
                Your library is empty
              </p>
              <span style={{ fontSize: '14px' }}>
                Upload images and videos to get started.
              </span>
            </div>
          ) : (
            <div
              id="explore-feed"
              className="explore-feed"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '16px',
                width: '100%',
              }}
            >
              {filteredMedia.map((item) => (
                <div
                  key={item.id}
                  className="feed-card"
                  data-id={item.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`View details for ${item.name}`}
                  style={{
                    position: 'relative',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    backgroundColor: 'var(--surface-color, #ffffff)',
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: '300px',
                    maxWidth: '420px',
                    border: 'none',
                    opacity: 0,
                    animation: 'card-fade-in 0.5s ease-out forwards',
                    transition: 'transform 0.2s ease-out, box-shadow 0.2s ease-out',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      // TODO: Open details panel
                    }
                  }}
                  onClick={() => {
                    // TODO: Open details panel
                  }}
                >
                  {item.type.startsWith('image/') ? (
                    <img
                      src={item.dataUrl}
                      className="feed-card-media"
                      alt={item.name}
                      loading="lazy"
                      style={{
                        flexGrow: 1,
                        width: '100%',
                        height: 'auto',
                        minHeight: 0,
                        objectFit: 'contain',
                        backgroundColor: 'var(--surface-color, #ffffff)',
                        aspectRatio: '4 / 3',
                      }}
                    />
                  ) : item.type.startsWith('video/') ? (
                    <video
                      src={item.dataUrl}
                      className="feed-card-media"
                      autoPlay
                      muted
                      loop
                      playsInline
                      style={{
                        flexGrow: 1,
                        width: '100%',
                        height: 'auto',
                        minHeight: 0,
                        objectFit: 'contain',
                        backgroundColor: 'var(--surface-color, #ffffff)',
                        aspectRatio: '4 / 3',
                      }}
                    />
                  ) : null}
                  <div
                    className="feed-card-info"
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'none',
                      padding: 'var(--spacing-3)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      zIndex: 2,
                    }}
                  >
                    <div className="feed-card-text-content">
                      <span
                        className="feed-card-title"
                        style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          color: 'var(--text-primary, #212121)',
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.name}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          id="explore-upload-input"
          multiple
          accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
          onClick={(e) => {
            // Allow multiple file selection
            (e.target as HTMLInputElement).value = '';
          }}
        />
      </main>
    </div>
  );
};
