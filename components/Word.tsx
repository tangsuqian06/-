
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { WordData } from '../types';
import { translateWord, getWordDefinition } from '../services/geminiService';

interface WordProps {
  word: WordData;
  context: string;
  onUpdate: (id: string, updates: Partial<WordData>) => void;
}

export const Word: React.FC<WordProps> = ({ word, context, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const wordRef = useRef<HTMLSpanElement>(null);

  const isInteractable = word.cleanText.length > 0;

  // Effect to calculate position and handle scroll
  useEffect(() => {
    if (showDetail && wordRef.current) {
      const updatePosition = () => {
        if (!wordRef.current) return;
        const rect = wordRef.current.getBoundingClientRect();
        const screenH = window.innerHeight;
        const screenW = window.innerWidth;
        const POPUP_WIDTH = 320; // Width of the popup
        const POPUP_HEIGHT_EST = 300; // Estimated max height
        const GAP = 8;

        let style: React.CSSProperties = {
          position: 'fixed',
          zIndex: 9999,
          width: `${POPUP_WIDTH}px`,
          maxHeight: '300px',
          overflowY: 'auto',
        };

        // Horizontal Positioning
        let left = rect.left;
        if (left + POPUP_WIDTH > screenW - 20) {
          // If it goes off right edge, align to right edge with padding
          left = screenW - POPUP_WIDTH - 20;
        }
        if (left < 10) left = 10; // Minimum left margin
        style.left = `${left}px`;

        // Vertical Positioning (Smart Flip)
        const spaceBelow = screenH - rect.bottom;
        
        if (spaceBelow < POPUP_HEIGHT_EST && rect.top > POPUP_HEIGHT_EST) {
           // Not enough space below, but enough above -> Show Above
           style.bottom = `${screenH - rect.top + GAP}px`;
           style.top = 'auto';
           // Add a class for animation origin if needed
        } else {
           // Default: Show Below
           style.top = `${rect.bottom + GAP}px`;
           style.bottom = 'auto';
        }

        setPopupStyle(style);
      };

      updatePosition();

      // Close on scroll to prevent floating popup becoming detached from word
      const handleScroll = () => setShowDetail(false);
      
      // Listen to both window and all scrollable parents (capture phase)
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', updatePosition);
      
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [showDetail]);

  const handleWordClick = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isInteractable) return;

      if (word.translation) {
          // Toggle off
          onUpdate(word.id, { translation: undefined, definition: undefined });
          setShowDetail(false);
      } else {
          setLoading(true);
          try {
              const trans = await translateWord(word.cleanText, context);
              onUpdate(word.id, { translation: trans });
          } finally {
              setLoading(false);
          }
      }
  };

  const handleTransClick = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!word.translation) return;
      
      if (!word.definition) {
          setLoading(true);
          try {
              const def = await getWordDefinition(word.cleanText, context);
              onUpdate(word.id, { definition: def });
              setShowDetail(true);
          } finally {
              setLoading(false);
          }
      } else {
          setShowDetail(!showDetail);
      }
  };

  return (
    <>
      <span className="relative inline-block leading-relaxed group">
        {/* The English Word */}
        <span 
          ref={wordRef}
          onClick={handleWordClick}
          className={`cursor-pointer rounded px-0.5 transition-colors duration-200 ${
            isInteractable ? 'hover:bg-gray-700 text-gray-200' : 'text-gray-300'
          }`}
        >
          {word.text}
        </span>

        {/* The Inline Translation */}
        {word.translation && (
          <span 
              onClick={handleTransClick}
              className="ml-1 cursor-pointer bg-accent-500 text-white px-1.5 py-0.5 rounded text-sm font-bold hover:bg-accent-600 align-middle select-none shadow-md transform transition-transform hover:scale-105"
              title="点击查看详解"
          >
              {loading && !word.definition ? '...' : word.translation}
          </span>
        )}
      </span>

      {/* Detailed Definition Popup (Rendered via Portal to avoid overflow issues) */}
      {showDetail && word.definition && createPortal(
        <div 
          style={popupStyle}
          className="bg-gray-800 border border-gray-600 rounded-lg shadow-2xl text-xs text-gray-100 text-left pointer-events-auto flex flex-col animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
           <div className="flex justify-between items-start p-3 border-b border-gray-700 bg-gray-900/50 rounded-t-lg sticky top-0 backdrop-blur-sm">
               <span className="font-bold text-lg text-accent-400 select-text">{word.cleanText}</span>
               <button 
                 onClick={() => setShowDetail(false)}
                 className="text-gray-400 hover:text-white p-1 hover:bg-gray-700 rounded transition-colors"
               >
                 ✕
               </button>
           </div>
           <div className="p-4 whitespace-pre-wrap leading-relaxed opacity-90 overflow-y-auto custom-scrollbar select-text">
               {word.definition}
           </div>
        </div>,
        document.body
      )}
    </>
  );
};
