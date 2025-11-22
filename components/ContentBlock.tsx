import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ContentBlock as ContentBlockType, ViewMode, WordData } from '../types';
import { Word } from './Word';
import { GrammarBox } from './GrammarBox';

interface Props {
  block: ContentBlockType;
  mode: ViewMode;
  onUpdateBlock: (id: string, updates: Partial<ContentBlockType>) => void;
  onDeleteBlock: (id: string) => void;
  onUpdateWord: (blockId: string, wordId: string, updates: Partial<WordData>) => void;
}

export const ContentBlock: React.FC<Props> = ({ block, mode, onUpdateBlock, onDeleteBlock, onUpdateWord }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(block.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset edit text when block text changes externally
  useEffect(() => {
    setEditText(block.text);
  }, [block.text]);

  // Auto-focus and resize textarea when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [isEditing]);

  const handleSaveEdit = () => {
    if (editText.trim() !== block.text) {
      onUpdateBlock(block.id, { text: editText });
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(block.text);
    setIsEditing(false);
  };

  const handleDeleteBlock = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onDeleteBlock(block.id);
  };
  
  const handleDeleteGrammar = (grammarId: string) => {
    const newAnalyses = block.grammarAnalyses.filter(g => g.id !== grammarId);
    onUpdateBlock(block.id, { grammarAnalyses: newAnalyses });
  };

  const handleWordUpdate = (wordId: string, updates: Partial<WordData>) => {
    onUpdateWord(block.id, wordId, updates);
  };

  // Group words by sentence index for SENTENCE view
  const sentences = useMemo(() => {
    const grouped: { index: number; words: WordData[]; translation?: string }[] = [];
    
    block.words.forEach(word => {
        const idx = word.sentenceIndex;
        if (!grouped[idx]) {
            grouped[idx] = { 
                index: idx, 
                words: [], 
                translation: block.sentenceTranslations?.[idx] 
            };
        }
        grouped[idx].words.push(word);
    });
    
    return grouped;
  }, [block.words, block.sentenceTranslations]);

  // Helper to render a list of words/tokens correctly
  const renderTokens = (words: WordData[]) => (
      <>
        {words.map((word) => {
            // If it's not an interactable word (just punctuation or whitespace), 
            // render as plain text to prevent spacing/selection issues.
            if (!word.cleanText) {
                return (
                    <span key={word.id} className="text-gray-300 select-text">
                        {word.text}
                    </span>
                );
            }
            return (
                <Word 
                    key={word.id} 
                    word={word} 
                    context={block.text}
                    onUpdate={handleWordUpdate} 
                />
            );
        })}
      </>
  );

  return (
    <div className="mb-10 group relative pl-6 border-l-4 border-gray-800 hover:border-accent-500/50 transition-colors duration-300" data-block-id={block.id}>
        
        {/* Edit Button (Visible on Hover) */}
        {!isEditing && (
            <div className="absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 z-10">
                <button 
                    onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                    className="p-1.5 text-gray-500 hover:text-accent-400 bg-gray-900/80 rounded backdrop-blur shadow-sm border border-gray-800"
                    title="编辑内容"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
                 <button 
                    onClick={handleDeleteBlock}
                    className="p-1.5 text-gray-500 hover:text-red-400 bg-gray-900/80 rounded backdrop-blur shadow-sm border border-gray-800"
                    title="删除此段"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </div>
        )}

        {/* --- EDIT MODE --- */}
        {isEditing ? (
            <div className="bg-gray-900 p-4 rounded-lg border border-accent-500/30 shadow-lg">
                <textarea
                    ref={textareaRef}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full bg-transparent text-gray-200 font-serif text-lg leading-loose resize-none focus:outline-none custom-scrollbar"
                    placeholder="输入英语内容..."
                    rows={3}
                />
                <div className="flex justify-end gap-3 mt-3 border-t border-gray-800 pt-3">
                    <button 
                        onClick={handleCancelEdit}
                        className="px-4 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                        取消
                    </button>
                    <button 
                        onClick={handleSaveEdit}
                        className="px-4 py-1.5 text-sm bg-accent-600 hover:bg-accent-500 text-white rounded font-medium shadow-lg shadow-accent-500/20"
                    >
                        保存修改
                    </button>
                </div>
            </div>
        ) : (
            /* --- VIEW MODE --- */
            <>
                {/* Paragraph View */}
                {mode === ViewMode.PARAGRAPH && (
                    <>
                        <div className="text-xl leading-loose text-gray-200 font-serif tracking-wide text-justify break-words">
                            {renderTokens(block.words)}
                        </div>
                        
                        {/* Paragraph Translation */}
                        {block.translation && (
                            <div className="mt-4 p-4 bg-gray-900/50 rounded-lg border border-gray-800 text-gray-400 text-base leading-relaxed font-sans">
                                <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-gray-600">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
                                段落翻译
                                </div>
                                {block.translation}
                            </div>
                        )}
                    </>
                )}

                {/* Sentence View */}
                {mode === ViewMode.SENTENCE && (
                    <div className="space-y-6">
                        {sentences.map((sent) => (
                            <div key={sent.index} className="bg-gray-900/30 rounded-xl p-4 hover:bg-gray-900/60 transition-colors border border-transparent hover:border-gray-800">
                                {/* English Sentence */}
                                <div className="text-xl leading-loose text-gray-200 font-serif mb-3 break-words">
                                    {renderTokens(sent.words)}
                                </div>
                                
                                {/* Sentence Translation */}
                                {sent.translation ? (
                                    <div className="text-accent-100/80 text-base border-t border-gray-800 pt-2 font-sans">
                                        {sent.translation}
                                    </div>
                                ) : (
                                    <div className="text-gray-600 text-sm italic pt-1">
                                        (暂无翻译 - 请点击“全文翻译”获取)
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </>
        )}

        {/* Pinned Grammar Analyses (Always visible at bottom of block) */}
        {!isEditing && block.grammarAnalyses.length > 0 && (
            <div className="mt-6 space-y-4 pl-4 border-l border-dashed border-gray-700">
                {block.grammarAnalyses.map(analysis => (
                    <GrammarBox 
                        key={analysis.id} 
                        analysis={analysis} 
                        onDelete={() => handleDeleteGrammar(analysis.id)} 
                    />
                ))}
            </div>
        )}
    </div>
  );
};