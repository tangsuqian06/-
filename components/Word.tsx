import React, { useState } from 'react';
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

  const isInteractable = word.cleanText.length > 0;

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering parent block selection
    if (!isInteractable) return;

    // Case 1: Already has detail shown -> toggle off
    if (showDetail) {
      setShowDetail(false);
      return;
    }

    // Case 2: Has translation but no detail shown -> show detail (fetch if needed)
    if (word.translation) {
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
            setShowDetail(true);
        }
        return;
    }

    // Case 3: No translation -> Fetch translation
    setLoading(true);
    try {
      const trans = await translateWord(word.cleanText, context);
      onUpdate(word.id, { translation: trans });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTranslationClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      // Click on the translation box itself to remove it? 
      // Spec says: "Click translation again -> show detailed explanation"
      // My logic above handles click on the Word component wrapper.
      // Let's separate: Click Word -> Toggle Translation. Click Translation -> Show Detail.
  };

  // Refined Interaction according to spec:
  // 1. Click Word -> Insert Translation to right.
  // 2. Click Translation -> Show Detail.
  // 3. Click Word again (if translation exists) -> Remove Translation? "Again click the English word disappears" -> spec says "Again click that English word disappears" (Wait, spec says "Insert translation... again click that English word disappears").
  
  // Let's try this exact spec flow:
  const handleWordClick = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isInteractable) return;

      if (word.translation) {
          // Spec: "Again click that English word disappears" (removes translation)
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
      
      // Spec: "Again click translated Chinese -> show detailed English explanation"
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
    <span className="relative inline-block leading-relaxed group">
      {/* The English Word */}
      <span 
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

      {/* Detailed Definition Popup */}
      {showDetail && word.definition && (
        <div className="absolute z-50 bottom-full left-0 mb-2 w-72 p-4 bg-gray-800 border border-gray-600 rounded-lg shadow-xl text-xs text-gray-100 text-left pointer-events-auto">
           <div className="flex justify-between items-start mb-2 border-b border-gray-600 pb-2">
               <span className="font-bold text-lg text-accent-400">{word.cleanText}</span>
               <button 
                 onClick={(e) => { e.stopPropagation(); setShowDetail(false); }}
                 className="text-gray-400 hover:text-white"
               >✕</button>
           </div>
           <div className="whitespace-pre-wrap leading-relaxed opacity-90">
               {word.definition}
           </div>
           {/* Pointer Arrow */}
           <div className="absolute top-full left-4 -mt-1 w-2 h-2 bg-gray-800 border-r border-b border-gray-600 transform rotate-45"></div>
        </div>
      )}
    </span>
  );
};
