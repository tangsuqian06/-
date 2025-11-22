
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
      <span className={`group inline-block align-baseline whitespace-nowrap ${isInteractable ? '' : ''}`}>
        <span 
          ref={wordRef}
          onClick={handleWordClick}
          className={`cursor-pointer rounded px-0.5 transition-all duration-200 border-b-2 border-transparent ${
            isInteractable 
            ? 'hover:bg-gray-800 hover:border-accent-500/50 text-gray-200' 
            : 'text-gray-400'
          }`}
        >
          {word.text}
        </span>

        {word.translation && (
          <span 
              onClick={handleTransClick}
              className="ml-1.5 inline-flex items-center justify-center bg-accent-600 hover:bg-accent-500 text-white text-xs px-2 py-0.5 rounded-full font-bold shadow-lg cursor-pointer select-none transform transition-all hover:scale-105 active:scale-95 border border-accent-400/20 align-middle"
              style={{ verticalAlign: '2px' }} 
              title="点击查看单词详解"
          >
              {loading && !word.definition ? (
                 <span className="w-3 h-1 bg-white/50 rounded animate-pulse"></span> 
              ) : (
                 word.translation
              )}
          </span>
        )}
      </span>

      {showDetail && createPortal(
        <div 
          style={popupStyle}
          className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl text-sm text-gray-200 flex flex-col overflow-hidden animate-in ring-1 ring-white/10 font-sans"
          onClick={(e) => e.stopPropagation()}
        >
           {/* Header */}
           <div className="px-4 py-3 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
               <div className="flex flex-col">
                   <span className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-0.5">单词详解</span>
                   <div className="flex items-baseline gap-2">
                       <span className="text-xl font-bold text-accent-400">{word.cleanText}</span>
                       {definitionData?.ipa && <span className="text-gray-400 font-mono text-xs">/{definitionData.ipa}/</span>}
                   </div>
               </div>
               <button onClick={() => setShowDetail(false)} className="text-gray-500 hover:text-white transition-colors">
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
               </button>
           </div>

           {/* Content */}
           <div className="p-4 overflow-y-auto custom-scrollbar max-h-[300px] space-y-4 bg-gray-900/95">
               {definitionData ? (
                   <>
                       {/* Senses */}
                       <div className="space-y-2">
                           {definitionData.senses.map((sense, idx) => (
                               <div key={idx} className="flex gap-3">
                                   <span className={`px-2 py-0.5 rounded text-[10px] font-bold h-fit uppercase tracking-wide border shrink-0 ${
                                       sense.pos.includes('v') ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                       sense.pos.includes('n') ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                       sense.pos.includes('adj') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                       'bg-gray-700/30 text-gray-400 border-gray-600/30'
                                   }`}>
                                       {sense.pos}
                                   </span>
                                   <span className="text-gray-200 leading-relaxed">{sense.def}</span>
                               </div>
                           ))}
                       </div>

                       {/* Examples */}
                       {definitionData.examples.length > 0 && (
                           <div className="pt-3 border-t border-gray-800">
                               <h4 className="text-[10px] uppercase tracking-widest text-gray-500 mb-3 font-bold flex items-center gap-2">
                                 <span className="w-1 h-1 bg-gray-500 rounded-full"></span> 例句
                               </h4>
                               <ul className="space-y-3">
                                   {definitionData.examples.map((ex, idx) => (
                                       <li key={idx} className="text-xs group/ex">
                                           <div className="text-gray-300 mb-1 border-l-2 border-gray-700 pl-2 group-hover/ex:border-accent-500 transition-colors">{ex.en}</div>
                                           <div className="text-gray-500 pl-2">{ex.zh}</div>
                                       </li>
                                   ))}
                               </ul>
                           </div>
                       )}
                        
                        {/* Phrases */}
                       {definitionData.phrases && definitionData.phrases.length > 0 && (
                           <div className="pt-3 border-t border-gray-800">
                               <h4 className="text-[10px] uppercase tracking-widest text-gray-500 mb-3 font-bold flex items-center gap-2">
                                  <span className="w-1 h-1 bg-gray-500 rounded-full"></span> 常用搭配
                               </h4>
                               <div className="flex flex-wrap gap-2">
                                   {definitionData.phrases.map((ph, idx) => (
                                       <span key={idx} className="px-2 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-gray-300 text-xs transition-colors cursor-default">
                                           {ph}
                                       </span>
                                   ))}
                               </div>
                           </div>
                       )}
                   </>
               ) : (
                   <div className="whitespace-pre-wrap text-gray-300 animate-pulse">
                       {word.definition || "正在获取单词详解..."}
                   </div>
               )}
           </div>
        </div>,
        document.body
      )}
    </>
  );
};
