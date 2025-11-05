import React from 'react';
import { Button, Text } from 'reshaped';
import type { GeneratedImageData } from '../../../../context/AppContext';

interface HistoryPanelProps {
  history: GeneratedImageData[];
  currentIndex: number;
  onSelectItem: (index: number) => void;
  onDeleteItem: (index: number) => void;
  onNavigateBack: () => void;
  onNavigateForward: () => void;
}

/**
 * History panel component for 2D Studio.
 * Displays generation history in chronological order.
 * Only shows "Original" generations, not Fix modifications.
 */
export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  history,
  currentIndex,
  onSelectItem,
  onDeleteItem,
  onNavigateBack,
  onNavigateForward,
}) => {
  // Filter to only show Original (prompt-based generations), not Fix modifications
  const originalHistory = history.filter(
    item => !item.modificationType || item.modificationType === 'Original'
  );

  const currentOriginalIndex = originalHistory.findIndex(
    h => history[currentIndex]?.id === h.id
  );

  const canNavigateBack = currentOriginalIndex > 0;
  const canNavigateForward = currentOriginalIndex < originalHistory.length - 1;

  if (originalHistory.length === 0) {
    return (
      <div className="control-card history-panel hidden">
        <div className="history-header">
          <h3>History</h3>
        </div>
        <div className="history-list-container">
          <div className="history-placeholder">
            <p>Your generated images will appear here.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="control-card history-panel">
      <div className="history-header">
        <h3>History</h3>
        <div className="history-actions">
          <div className="history-nav-controls">
            <Button
              variant="ghost"
              size="small"
              onClick={onNavigateBack}
              disabled={!canNavigateBack}
              aria-label="Previous"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </Button>
            <Text>
              {currentOriginalIndex >= 0 ? `${currentOriginalIndex + 1} / ${originalHistory.length}` : '0 / 0'}
            </Text>
            <Button
              variant="ghost"
              size="small"
              onClick={onNavigateForward}
              disabled={!canNavigateForward}
              aria-label="Next"
            >
              <span className="material-symbols-outlined">arrow_forward</span>
            </Button>
          </div>
        </div>
      </div>
      <div className="history-list-container">
        <ul className="history-list">
          {originalHistory.map((item) => {
            const actualIndex = history.findIndex(h => h.id === item.id);
            const isSelected = actualIndex === currentIndex;
            const date = new Date(item.timestamp);
            const timeString = date.toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            });

            return (
              <li
                key={item.id}
                className={`history-item ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectItem(actualIndex)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectItem(actualIndex);
                  }
                }}
              >
                <div className="history-item-main">
                  <div style={{ position: 'relative' }}>
                    <img
                      src={`data:${item.mimeType};base64,${item.data}`}
                      className="history-thumbnail"
                      alt="History item thumbnail"
                      loading="lazy"
                    />
                  </div>
                  <div className="history-item-info">
                    <span className="history-item-label">{item.subject}</span>
                    <span className="history-item-timestamp">{timeString}</span>
                  </div>
                  <button
                    className="history-item-delete-btn"
                    aria-label="Delete history item"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteItem(actualIndex);
                    }}
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

