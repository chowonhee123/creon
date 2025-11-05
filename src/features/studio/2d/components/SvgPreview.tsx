import React, { useEffect, useRef } from 'react';
// @ts-ignore - DOMPurify types may not be available in all environments
import DOMPurify from 'dompurify';

interface SvgPreviewProps {
  /** SVG string to render. Will be sanitized before injection. */
  svgString: string;
  /** Additional className */
  className?: string;
  /** Alt text for accessibility */
  alt?: string;
}

/**
 * Component for safely rendering SVG strings.
 * 
 * Uses dangerouslySetInnerHTML with DOMPurify sanitization.
 * This is required because ImageTracer outputs raw SVG strings
 * that need to be injected into the DOM.
 * 
 * Third-party library constraint: ImageTracer (imagetracerjs) 
 * returns SVG as strings, requiring DOM injection.
 */
export const SvgPreview: React.FC<SvgPreviewProps> = ({ 
  svgString, 
  className = '',
  alt = 'SVG preview'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || !svgString) return;
    
    // Guard against double-invocation in StrictMode
    if (mountedRef.current) return;
    mountedRef.current = true;

    // Sanitize SVG string before injection
    const sanitized = DOMPurify.sanitize(svgString, {
      USE_PROFILES: { svg: true, svgFilters: true }
    });

    containerRef.current.innerHTML = sanitized;

    // Cleanup: prevent memory leaks
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      mountedRef.current = false;
    };
  }, [svgString]);

  return (
    <div 
      ref={containerRef}
      className={className}
      role="img"
      aria-label={alt}
      style={{ 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%'
      }}
    />
  );
};

