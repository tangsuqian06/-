import React, { useState } from 'react';
import { ContentBlock as ContentBlockType, TranslationMode, WordData } from '../types';
import { Word } from './Word';
import { GrammarBox } from './GrammarBox';
import { translateText } from '../services/geminiService';

interface Props {
  block: ContentBlockType;
  mode: TranslationMode;
  onUpdateBlock: (id: string, updates: Partial<ContentBlockType>) => void;
  onUpdateWord: (blockId: string, wordId: string, updates: Partial<WordData>) => void;
}

export const ContentBlock: React.FC<Props> = ({ block, mode, onUpdateBlock, onUpdateWord }) => {
  const [translating, setTranslating] = useState(false);

  // Helper to update specific word
  const handleWordUpdate = (wordId: string, updates: Partial<WordData>) => {
    onUpdateWord(block.id, wordId, updates);
  };

  // Handle block translation
  const handleTranslateBlock = async () => {
    if (block.translation) return; // Already translated
    setTranslating(true);
    try {
      const translation = await translateText(block.text);
      onUpdateBlock(block.id, { translation });
    } finally {
      setTranslating(false);
    }
  };

  // Effect for modes
  React.useEffect(() => {
    if (mode === TranslationMode.FULL || mode === TranslationMode.PARAGRAPH) {
      // In full or paragraph mode, we might auto-translate, or provide UI to do so.
      // Let's auto-translate if FULL mode is active and translation is missing
      if (mode === TranslationMode.FULL && !block.translation && !translating) {
         handleTranslateBlock();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);


  const handleDeleteGrammar = (grammarId: string) => {
    const newAnalyses = block.grammarAnalyses.filter(g => g.id !== grammarId);
    onUpdateBlock(block.id, { grammarAnalyses: newAnalyses });
  };

  // Manual Edit of text content (Simplified: Just allow deleting the block or simple content update logic could go here)
  // For "User can freely add/delete content", we might need a text area mode.
  // But doing rich text editing with the word-span structure is very complex for a single file.
  // We will assume "Edit" means deleting the block or adding new blocks via the main UI.
  // Or we provide a "Raw Edit" mode.
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(block.text);

  const saveEdit = () => {
      // Naive re-parsing. Note: This loses existing annotations on this block!
      // A real app would try to diff and preserve IDs.
      onUpdateBlock(block.id, { text: editText }); // Parent needs to re-parse
      setIsEditing(false);
  };

  if (isEditing) {
      return (
          <div className="p-4 bg-gray-800 rounded mb-4 border border-gray-600">
              <textarea 
                className="w-full h-32 bg-gray-900 text-white p-2 rounded border border-gray-700 focus:border-accent-500 outline-none"
                value={editText}
                onChange={e => setEditText(e.target.value)}
              />
              <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => setIsEditing(false)} className="px-3 py-1 text-gray-400 hover:text-white">取消</button>
                  <button onClick={saveEdit} className="px-3 py-1 bg-accent-600 text-white rounded hover:bg-accent-500">保存</button>
              </div>
          </div>
      )
  }

  return (
    <div className="mb-8 group relative pl-4 border-l-2 border-transparent hover:border-gray-700 transition-colors" data-block-id={block.id}>
        
        {/* Tools for this block */}
        <div className="absolute -left-8 top-0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2">
             <button onClick={() => setIsEditing(true)} className="p-1 text-gray-500 hover:text-blue-400" title="编辑原文">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
             </button>
             {/* Sentence/Paragraph Translation Toggle for this block if mode is mixed? Let's stick to global mode + manual overrides */}
             <button onClick={handleTranslateBlock} className="p-1 text-gray-500 hover:text-green-400" title="翻译本段">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
             </button>
        </div>

        {/* Main English Content */}
        <div className="text-xl leading-loose text-gray-200 font-serif tracking-wide">
            {block.words.map((word) => (
            <Word 
                key={word.id} 
                word={word} 
                context={block.text}
                onUpdate={handleWordUpdate} 
            />
            ))}
        </div>

        {/* Block Translation Display */}
        {(block.translation || mode === TranslationMode.FULL) && (
            <div className="mt-3 text-base text-gray-400 leading-relaxed border-t border-gray-800 pt-2">
               {translating ? <span className="animate-pulse">正在翻译...</span> : block.translation}
            </div>
        )}

        {/* Pinned Grammar Analyses */}
        <div className="space-y-2">
            {block.grammarAnalyses.map(analysis => (
                <GrammarBox 
                    key={analysis.id} 
                    analysis={analysis} 
                    onDelete={() => handleDeleteGrammar(analysis.id)} 
                />
            ))}
        </div>
    </div>
  );
};
