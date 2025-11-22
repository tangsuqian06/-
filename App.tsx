import React, { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { LearningDocument, ContentBlock, TranslationMode, WordData, SelectionState, GrammarAnalysis } from './types';
import { parseTextToBlocks, generateId } from './utils/textUtils';
import { extractTextContent, fileToBase64, analyzeGrammar } from './services/geminiService';
import { ContentBlock as ContentBlockComp } from './components/ContentBlock';
import { FloatingMenu } from './components/FloatingMenu';

// Initial empty state
const initialDoc: LearningDocument = {
  id: 'init-1',
  title: '欢迎使用英语大师',
  createdAt: Date.now(),
  blocks: parseTextToBlocks("Welcome to AI English Master.\nStart by uploading a file or pasting text here.\n\nSelect any text to see grammar analysis."),
  translationMode: TranslationMode.PARAGRAPH
};

const App: React.FC = () => {
  // State
  const [documents, setDocuments] = useState<LearningDocument[]>([initialDoc]);
  const [activeDocId, setActiveDocId] = useState<string>(initialDoc.id);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectionState, setSelectionState] = useState<SelectionState | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  const activeDoc = documents.find(d => d.id === activeDocId) || documents[0];

  // Save to localStorage
  useEffect(() => {
    const saved = localStorage.getItem('eng_master_docs');
    if (saved) {
      try {
        setDocuments(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load docs", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('eng_master_docs', JSON.stringify(documents));
  }, [documents]);

  // -- Document Management --

  const createNewDoc = () => {
    const newDoc: LearningDocument = {
      id: uuidv4(),
      title: `新文档 ${new Date().toLocaleDateString()}`,
      createdAt: Date.now(),
      blocks: [],
      translationMode: TranslationMode.PARAGRAPH
    };
    setDocuments([...documents, newDoc]);
    setActiveDocId(newDoc.id);
  };

  const deleteDoc = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (documents.length <= 1) {
        alert("至少保留一个文档");
        return;
    }
    const newDocs = documents.filter(d => d.id !== id);
    setDocuments(newDocs);
    if (activeDocId === id) {
        setActiveDocId(newDocs[0].id);
    }
  };

  const updateDocTitle = (title: string) => {
      setDocuments(docs => docs.map(d => d.id === activeDocId ? { ...d, title } : d));
  };

  const updateDocMode = (mode: TranslationMode) => {
      setDocuments(docs => docs.map(d => d.id === activeDocId ? { ...d, translationMode: mode } : d));
  };

  // -- Content Updates --

  const updateBlock = (blockId: string, updates: Partial<ContentBlock>) => {
    setDocuments(prevDocs => prevDocs.map(doc => {
      if (doc.id !== activeDocId) return doc;
      
      // Check if we are updating 'text', if so, re-parse words
      let newBlocks = doc.blocks.map(b => {
        if (b.id !== blockId) return b;
        if (updates.text && updates.text !== b.text) {
            // Re-parse logic
            const reParsed = parseTextToBlocks(updates.text)[0]; // Assuming single block edit
            // Preserve ID and existing grammar if possible? 
            // For simplicity, grammar linked to old text indices might be invalid, so we clear it or keep it attached to the block ID.
            // We keep the Block ID but replace content.
            return {
                ...b,
                text: updates.text!,
                words: reParsed.words,
                translation: undefined // Reset translation on edit
            };
        }
        return { ...b, ...updates };
      });
      
      return { ...doc, blocks: newBlocks };
    }));
  };

  const updateWord = (blockId: string, wordId: string, updates: Partial<WordData>) => {
    setDocuments(prevDocs => prevDocs.map(doc => {
      if (doc.id !== activeDocId) return doc;
      return {
        ...doc,
        blocks: doc.blocks.map(b => {
          if (b.id !== blockId) return b;
          return {
            ...b,
            words: b.words.map(w => w.id === wordId ? { ...w, ...updates } : w)
          };
        })
      };
    }));
  };

  const addNewBlock = () => {
      const newBlock: ContentBlock = {
          id: generateId(),
          text: "New paragraph...",
          words: parseTextToBlocks("New paragraph...")[0].words,
          grammarAnalyses: []
      };
      setDocuments(docs => docs.map(d => d.id === activeDocId ? {...d, blocks: [...d.blocks, newBlock]} : d));
  };

  // -- File Upload --

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoadingFile(true);
    try {
      const base64 = await fileToBase64(file);
      const extractedText = await extractTextContent(base64, file.type);
      
      const newBlocks = parseTextToBlocks(extractedText);
      
      setDocuments(docs => docs.map(d => {
        if (d.id === activeDocId) {
          return {
            ...d,
            // Append or replace? Let's append.
            blocks: [...d.blocks, ...newBlocks]
          };
        }
        return d;
      }));
    } catch (err) {
      alert("解析文件失败");
      console.error(err);
    } finally {
      setIsLoadingFile(false);
      // Reset input
      e.target.value = '';
    }
  };

  // -- Selection & Grammar Analysis --

  // Handle text selection
  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.toString().trim().length === 0) {
        // Don't clear immediately if clicking inside the menu
        // But for simplicity, we usually rely on mousedown checks or timeout.
        // We will clear on click outside logic via specific UI elements.
        return;
      }

      // Find which block contains the selection
      let node = selection.anchorNode;
      let blockElement: HTMLElement | null = null;
      
      // Traverse up to find the block container
      while (node && node !== document.body) {
        if (node instanceof HTMLElement && node.dataset.blockId) {
          blockElement = node;
          break;
        }
        node = node.parentNode;
      }

      if (blockElement) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelectionState({
          text: selection.toString(),
          blockId: blockElement.dataset.blockId!,
          range: range.cloneRange(),
          top: rect.top,
          left: rect.left + (rect.width / 2)
        });
      } else {
        setSelectionState(null);
      }
    };

    document.addEventListener('mouseup', handleSelection);
    return () => document.removeEventListener('mouseup', handleSelection);
  }, []);

  const performGrammarAnalysis = async () => {
    if (!selectionState) return;
    setAnalyzing(true);
    try {
      const result = await analyzeGrammar(selectionState.text);
      
      // Create analysis object
      const newAnalysis: GrammarAnalysis = {
        id: uuidv4(),
        sourceText: selectionState.text,
        explanation: result
      };

      // Add to the specific block
      setDocuments(docs => docs.map(doc => {
        if (doc.id !== activeDocId) return doc;
        return {
          ...doc,
          blocks: doc.blocks.map(b => {
            if (b.id !== selectionState.blockId) return b;
            return {
              ...b,
              grammarAnalyses: [...b.grammarAnalyses, newAnalysis]
            };
          })
        };
      }));
      
      setSelectionState(null); // Close menu
      window.getSelection()?.removeAllRanges(); // Clear selection
    } catch (err) {
      console.error(err);
      alert("分析失败，请重试");
    } finally {
      setAnalyzing(false);
    }
  };


  return (
    <div className="flex h-screen overflow-hidden bg-gray-950 text-gray-100 font-sans">
      
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} flex-shrink-0 bg-gray-900 border-r border-gray-800 transition-all duration-300 flex flex-col`}>
         <div className="p-4 flex items-center justify-between border-b border-gray-800">
             <h1 className="text-xl font-bold text-accent-500">英语大师 AI</h1>
             <button onClick={createNewDoc} className="text-gray-400 hover:text-white" title="新建文档">+</button>
         </div>
         <div className="flex-1 overflow-y-auto p-2 space-y-1">
             {documents.map(doc => (
                 <div 
                    key={doc.id}
                    onClick={() => setActiveDocId(doc.id)}
                    className={`p-3 rounded cursor-pointer flex justify-between items-center group ${activeDocId === doc.id ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50'}`}
                 >
                    <span className="truncate text-sm">{doc.title}</span>
                    <button onClick={(e) => deleteDoc(doc.id, e)} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 text-xs">删除</button>
                 </div>
             ))}
         </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative">
        
        {/* Header / Toolbar */}
        <div className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 shadow-lg z-20">
            <div className="flex items-center gap-4">
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-gray-400 hover:text-white">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                <input 
                    className="bg-transparent border-none text-lg font-bold text-white focus:ring-0 w-64"
                    value={activeDoc.title}
                    onChange={(e) => updateDocTitle(e.target.value)}
                />
            </div>

            <div className="flex items-center gap-4">
                {/* Translation Mode Toggle */}
                <div className="flex bg-gray-800 rounded-lg p-1">
                    {[
                        { m: TranslationMode.SENTENCE, l: '逐句' }, // Simulated via paragraph blocks usually
                        { m: TranslationMode.PARAGRAPH, l: '逐段' },
                        { m: TranslationMode.FULL, l: '全文' }
                    ].map(opt => (
                        <button
                            key={opt.m}
                            onClick={() => updateDocMode(opt.m)}
                            className={`px-3 py-1 text-xs rounded-md transition-colors ${activeDoc.translationMode === opt.m ? 'bg-gray-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            {opt.l}
                        </button>
                    ))}
                </div>

                {/* File Upload */}
                <label className={`flex items-center gap-2 px-4 py-2 bg-accent-600 hover:bg-accent-500 text-white rounded-lg cursor-pointer transition-colors ${isLoadingFile ? 'opacity-50 cursor-wait' : ''}`}>
                    {isLoadingFile ? (
                         <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    )}
                    <span className="text-sm font-medium">导入内容</span>
                    <input type="file" className="hidden" accept=".txt,.pdf,.doc,.docx,image/*" onChange={handleFileUpload} disabled={isLoadingFile} />
                </label>
            </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 overflow-y-auto p-8 bg-gray-950 selection-highlight" onClick={() => setSelectionState(null)}>
            <div className="max-w-4xl mx-auto min-h-[800px] pb-32">
                {activeDoc.blocks.length === 0 && (
                    <div className="text-center text-gray-600 mt-20">
                        <p className="text-xl mb-4">暂无内容</p>
                        <p>请点击右上角导入文件，或点击下方添加段落</p>
                    </div>
                )}

                {activeDoc.blocks.map(block => (
                    <ContentBlockComp 
                        key={block.id} 
                        block={block} 
                        mode={activeDoc.translationMode}
                        onUpdateBlock={updateBlock}
                        onUpdateWord={updateWord}
                    />
                ))}

                {/* Add Content Button */}
                <div className="mt-12 flex justify-center border-t border-gray-800 pt-8">
                    <button 
                        onClick={addNewBlock}
                        className="flex items-center gap-2 px-6 py-3 text-gray-500 hover:text-accent-500 border border-gray-800 hover:border-accent-500/50 rounded-full transition-all hover:bg-gray-900"
                    >
                        <span>+ 添加新段落</span>
                    </button>
                </div>
            </div>
        </div>

        {/* Floating Action Menu */}
        {selectionState && (
          <FloatingMenu 
            selection={selectionState}
            onAnalyze={performGrammarAnalysis}
            onClose={() => setSelectionState(null)}
            loading={analyzing}
          />
        )}

      </div>
    </div>
  );
};

export default App;
