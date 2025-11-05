import React from 'react';
import { motion } from 'framer-motion';

interface Studio3DPlaceholderProps {
  sampleImageCount?: number;
}

export const Studio3DPlaceholder: React.FC<Studio3DPlaceholderProps> = ({ 
  sampleImageCount = 4 
}) => {
  const placeholderStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    background: 'linear-gradient(to bottom, #f9fafb, #e5e7eb)',
    position: 'relative',
    overflow: 'hidden',
  };

  const animatedContainerStyle: React.CSSProperties = {
    position: 'absolute',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    opacity: 0.7,
  };

  const imageStyle: React.CSSProperties = {
    width: '192px',
    height: '192px',
    objectFit: 'cover',
    borderRadius: '16px',
    filter: 'grayscale(100%)',
    transition: 'all 0.3s ease',
  };

  const textStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '40px',
    color: '#9ca3af',
    fontSize: '14px',
    zIndex: 10,
  };

  return (
    <motion.div
      style={placeholderStyle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        animate={{ y: ['0%', '-100%'] }}
        transition={{ repeat: Infinity, duration: 20, ease: 'linear' }}
        style={animatedContainerStyle}
      >
        {[
          '/assets/눈사람.png',
          '/assets/도시락.png',
          '/assets/루돌프.png',
        ].slice(0, sampleImageCount).map((src, i) => (
          <motion.img
            key={i}
            src={src}
            alt="preview"
            style={imageStyle}
            whileHover={{ 
              filter: 'grayscale(0%)',
              scale: 1.05 
            }}
            onError={(e) => {
              // Fallback if image doesn't exist - use placeholder
              const target = e.target as HTMLImageElement;
              target.src = `data:image/svg+xml;base64,${btoa(
                `<svg width="192" height="192" xmlns="http://www.w3.org/2000/svg">
                  <rect width="192" height="192" fill="#e5e7eb"/>
                  <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="sans-serif" font-size="14" fill="#9ca3af">Sample ${i + 1}</text>
                </svg>`
              )}`;
            }}
          />
        ))}
      </motion.div>
      <div style={textStyle}>
        ✨ Ready when you are — Let's create something 3D!
      </div>
    </motion.div>
  );
};

