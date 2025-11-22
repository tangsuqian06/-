
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { WordData, WordDefinition } from '../types';
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

  // Helper to parse JSON safely
  const parseDefinition = (jsonString: string): WordDefinition | null => {
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      return null;
    }
  };

  // Effect to calculate position
  useEffect(() => {
    if (showDetail && wordRef.current) {
      const updatePosition = () => {
        if (!wordRef.current) return;
        const rect = wordRef.current.getBoundingClientRect();
        const screenH = window.innerHeight;
        const screenW = window.innerWidth;
        const POPUP_WIDTH = 340; 
        const POPUP_HEIGHT_MAX = 400; 
        const GAP = 8;

        let style: React.CSSProperties = {
          position: 'fixed',
          zIndex: 9999,
          width: `${POPUP_WIDTH}px`,
          maxHeight: `${POPUP_HEIGHT_MAX}px`,
        };

        // Horizontal
        let left = rect.left;
        if (left + POPUP_WIDTH > screenW - 20) {
          left = screenW - POPUP_WIDTH - 20;
        }
        if (left < 10) left = 10;
        style.left = `${left}px`;

        // Vertical
        const spaceBelow = screenH - rect.bottom;
        if (spaceBelow < 300 && rect.top > 300) {
           style.bottom = `${screenH - rect.top + GAP}px`;
           style.top = 'auto';
        } else {
           style.top = `${rect.bottom + GAP}px`;
           style.bottom = 'auto';
        }

        setPopupStyle(style);
      };

      updatePosition();
      const handleScroll = () => setShowDetail(false);
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

  const definitionData = word.definition ? parseDefinition(word.definition) : null;

  return (
    <>
      <span className="relative inline-block leading-relaxed group">
        <span 
          ref={wordRef}
          onClick={handleWordClick}
          className={`cursor-pointer rounded px-0.5 transition-colors duration-200 ${
            isInteractable ? 'hover:bg-gray-700 text-gray-200' : 'text-gray-300'
          }`}
        >
          {word.text}
        </span>

        {word.translation && (
          <span 
              onClick={handleTransClick}
              className="ml-1 cursor-pointer bg-accent-600 text-white px-1.5 py-0.5 rounded text-sm font-bold hover:bg-accent-500 align-middle select-none shadow-sm"
          >
              {loading && !word.definition ? '...' : word.translation}
          </span>
        )}
      </span>

      {showDetail && createPortal(
        <div 
          style={popupStyle}
          className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl text-sm text-gray-200 flex flex-col overflow-hidden animate-in"
          onClick={(e) => e.stopPropagation()}
        >
           {/* Header */}
           <div className="px-4 py-3 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
               <div>
                   <span className="text-xl font-bold text-accent-400 mr-2">{word.cleanText}</span>
                   {definitionData?.ipa && <span className="text-gray-400 font-mono text-xs">/{definitionData.ipa}/</span>}
               </div>
               <button onClick={() => setShowDetail(false)} className="text-gray-500 hover:text-white">✕</button>
           </div>

           {/* Content */}
           <div className="p-4 overflow-y-auto custom-scrollbar max-h-[300px] space-y-4">
               {definitionData ? (
                   <>
                       {/* Senses */}
                       <div className="space-y-2">
                           {definitionData.senses.map((sense, idx) => (
                               <div key={idx} className="flex gap-2">
                                   <span className={`px-1.5 py-0.5 rounded text-xs font-bold h-fit ${
                                       sense.pos.includes('v') ? 'bg-blue-900/50 text-blue-300 border border-blue-800' :
                                       sense.pos.includes('n') ? 'bg-red-900/50 text-red-300 border border-red-800' :
                                       sense.pos.includes('adj') ? 'bg-green-900/50 text-green-300 border border-green-800' :
                                       'bg-gray-700 text-gray-300'
                                   }`}>
                                       {sense.pos}
                                   </span>
                                   <span className="text-gray-100">{sense.def}</span>
                               </div>
                           ))}
                       </div>

                       {/* Examples */}
                       {definitionData.examples.length > 0 && (
                           <div className="pt-2 border-t border-gray-800">
                               <h4 className="text-xs uppercase tracking-wider text-gray-500 mb-2 font-bold">例句</h4>
                               <ul className="space-y-3">
                                   {definitionData.examples.map((ex, idx) => (
                                       <li key={idx} className="text-xs">
                                           <div className="text-gray-300 mb-0.5">{ex.en}</div>
                                           <div className="text-gray-500">{ex.zh}</div>
                                       </li>
                                   ))}
                               </ul>
                           </div>
                       )}
                        
                        {/* Phrases */}
                       {definitionData.phrases && definitionData.phrases.length > 0 && (
                           <div className="pt-2 border-t border-gray-800">
                               <h4 className="text-xs uppercase tracking-wider text-gray-500 mb-2 font-bold">常用搭配</h4>
                               <div className="flex flex-wrap gap-2">
                                   {definitionData.phrases.map((ph, idx) => (
                                       <span key={idx} className="px-2 py-1 bg-gray-800 rounded text-gray-400 text-xs">
                                           {ph}
                                       </span>
                                   ))}
                               </div>
                           </div>
                       )}
                   </>
               ) : (
                   // Fallback for legacy or error data
                   <div className="whitespace-pre-wrap text-gray-300">
                       {word.definition}
                   </div>
               )}
           </div>
        </div>,
        document.body
      )}
    </>
  );
};
