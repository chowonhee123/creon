import React, { useRef, useState } from 'react';
import { Button, Text } from 'reshaped';
import { ReferenceImage } from '../../../../utils/imageGeneration';

interface ReferenceImageUploadProps {
  index: number;
  title: string;
  image: ReferenceImage | null;
  onImageChange: (index: number, image: ReferenceImage | null) => void;
}

/**
 * Reference image upload component for 2D Studio.
 * Handles drag-and-drop and click-to-upload for reference images.
 */
export const ReferenceImageUpload: React.FC<ReferenceImageUploadProps> = ({
  index,
  title,
  image,
  onImageChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      onImageChange(index, { file, dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onImageChange(index, null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  return (
    <div
      ref={dropZoneRef}
      className={`image-drop-zone reference-drop-zone ${isDragging ? 'dragging' : ''}`}
      data-index={index}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <span className="slot-title">{title}</span>
      {image && image.dataUrl ? (
        <>
          <img
            className="style-image-preview"
            src={image.dataUrl}
            alt={`Reference image ${index + 1}`}
          />
          <button
            className="remove-style-image-btn icon-button"
            aria-label={`Remove image ${index + 1}`}
            onClick={handleRemove}
          >
            <span className="material-symbols-outlined">delete</span>
          </button>
        </>
      ) : (
        <div className="drop-zone-prompt">
          <span className="material-symbols-outlined">add_photo_alternate</span>
          <p>Drop or click</p>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
      />
    </div>
  );
};


