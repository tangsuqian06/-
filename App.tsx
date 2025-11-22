import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { LearningDocument, ContentBlock, ViewMode, WordData, SelectionState, GrammarAnalysis } from './types';
import { parseTextToBlocks, generateId, getSentencesFromBlock } from './utils/textUtils';
import { extractTextContent, analyzeGrammar, translateBlockAdvanced } from './services/geminiService';
import { ContentBlock as ContentBlockComp } from './components/ContentBlock';
import { FloatingMenu } from './components/FloatingMenu';

// Initial empty state
const initialDoc: LearningDocument = {
  id: 'init-1',
  title: '欢迎使用英语大师',
  createdAt: Date.now(),
  blocks: parseTextToBlocks("Welcome to AI English Master.\nClick 'Full Translation' to translate the entire document.\nSwitch between Paragraph and Sentence views to suit your learning style."),
  viewMode: ViewMode.PARAGRAPH
};

const App: React.FC = () => {
  const [documents, setDocuments] = useState<LearningDocument[]>([initialDoc]);
  const [activeDocId, setActiveDocId] = useState<string>(initialDoc.id);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectionState, setSelectionState] = useState<SelectionState | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [translatingAll, setTranslatingAll] = useState(false); // New state for Full Translation
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
     window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); setDeferredPrompt(e); });
     const saved = localStorage.getItem('eng_master_docs');
     if (saved) try { setDocuments(JSON.parse(saved)); } catch (e) {}
  }, []);

  useEffect(() => {
    localStorage.setItem('eng_master_docs', JSON.stringify(documents));
  }, [documents]);

  const activeDoc = documents.find(d => d.id === activeDocId) || documents[0];

  // -- Actions --

  const createNewDoc = () => {
    const newDoc: LearningDocument = {
      id: uuidv4(),
      title: `新文档 ${new Date().toLocaleDateString()}`,
      createdAt: Date.now(),
      blocks: [],
      viewMode: ViewMode.PARAGRAPH
    };
    setDocuments([...documents, newDoc]);
    setActiveDocId(newDoc.id);
  };

  const updateDocMode = (mode: ViewMode) => {
      setDocuments(docs => docs.map(d => d.id === activeDocId ? { ...d, viewMode: mode } : d));
  };

  // FULL TRANSLATION LOGIC
  const handleFullTranslation = async () => {
      if (activeDoc.blocks.length === 0) return;

      setTranslatingAll(true);
      
      // Process blocks sequentially to avoid rate limits
      try {
          // Filter out empty blocks to save API calls
          const nonEmptyBlocks = activeDoc.blocks.filter(b => b.text.trim().length > 0);
          
          // We'll use a simple for loop to process sequentially to be robust
          for (const block of nonEmptyBlocks) {
             try {
                 const sentences = getSentencesFromBlock(block);
                 // Skip if very short or just symbols
                 if (sentences.length === 0) continue;

                 const result = await translateBlockAdvanced(block.text, sentences);
                 
                 setDocuments(docs => docs.map(d => {
                     if (d.id !== activeDocId) return d;
                     return {
                         ...d,
                         blocks: d.blocks.map(b => b.id === block.id ? {
                             ...b,
                             translation: result.paragraph,
                             sentenceTranslations: result.sentences
                         } : b)
                     };
                 }));
             } catch (err) {
                 console.error("Error translating block", block.id, err);
             }
          }
      } catch (e) {
          console.error(e);
          alert("翻译过程中出错，请重试");
      } finally {
          setTranslatingAll(false);
      }
  };

  const updateBlock = (blockId: string, updates: Partial<ContentBlock>) => {
    setDocuments(docs => docs.map(doc => {
      if (doc.id !== activeDocId) return doc;
      const newBlocks = doc.blocks.map(b => {
        if (b.id !== blockId) return b;
        if (updates.text && updates.text !== b.text) {
            const reParsed = parseTextToBlocks(updates.text)[0];
            return { ...b, text: updates.text!, words: reParsed.words, translation: undefined, sentenceTranslations: undefined };
        }
        return { ...b, ...updates };
      });
      return { ...doc, blocks: newBlocks };
    }));
  };

  const deleteBlock = (blockId: string) => {
      setDocuments(currentDocs => currentDocs.map(doc => {
          if (doc.blocks.some(b => b.id === blockId)) {
              return {
                  ...doc,
                  blocks: doc.blocks.filter(b => b.id !== blockId)
              };
          }
          return doc;
      }));
  };

  const updateWord = (blockId: string, wordId: string, updates: Partial<WordData>) => {
    setDocuments(docs => docs.map(doc => {
      if (doc.id !== activeDocId) return doc;
      return {
        ...doc,
        blocks: doc.blocks.map(b => {
           if (b.id !== blockId) return b;
           return { ...b, words: b.words.map(w => w.id === wordId ? { ...w, ...updates } : w) };
        })
      };
    }));
  };

  const addNewBlock = () => {
      const newBlock = parseTextToBlocks("点击此处编辑内容...")[0];
      setDocuments(docs => docs.map(d => d.id === activeDocId ? {...d, blocks: [...d.blocks, newBlock]} : d));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoadingFile(true);
    try {
      // Pass the raw file object to the service
      const extractedText = await extractTextContent(file);
      const newBlocks = parseTextToBlocks(extractedText);
      setDocuments(docs => docs.map(d => d.id === activeDocId ? { ...d, blocks: [...d.blocks, ...newBlocks] } : d));
    } catch (err: any) { 
        console.error(err);
        alert(err.message || "文件解析出错"); 
    } 
    finally { 
        setIsLoadingFile(false); 
        e.target.value = ''; 
    }
  };

  // Grammar Selection Logic
  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) return;
      
      let node = selection.anchorNode;
      let blockId: string | null = null;
      while (node && node !== document.body) {
        if (node instanceof HTMLElement && node.dataset.blockId) { blockId = node.dataset.blockId; break; }
        node = node.parentNode;
      }

      if (blockId) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelectionState({ text: selection.toString(), blockId, range: range.cloneRange(), top: rect.top, left: rect.left + (rect.width / 2) });
      } else { setSelectionState(null); }
    };
    document.addEventListener('mouseup', handleSelection);
    return () => document.removeEventListener('mouseup', handleSelection);
  }, []);

  const performGrammarAnalysis = async () => {
    if (!selectionState) return;
    setAnalyzing(true);
    try {
      const result = await analyzeGrammar(selectionState.text);
      const newAnalysis: GrammarAnalysis = { id: uuidv4(), sourceText: selectionState.text, explanation: result };
      setDocuments(docs => docs.map(doc => {
        if (doc.id !== activeDocId) return doc;
        return { ...doc, blocks: doc.blocks.map(b => b.id === selectionState.blockId ? { ...b, grammarAnalyses: [...b.grammarAnalyses, newAnalysis] } : b) };
      }));
      setSelectionState(null); window.getSelection()?.removeAllRanges();
    } catch (e) { alert("分析失败"); } finally { setAnalyzing(false); }
  };

  const handleSetKey = () => {
      const key = prompt("请输入您的 Google Gemini API Key (将保存在本地浏览器中):", localStorage.getItem('GEMINI_API_KEY') || '');
      if (key !== null) {
          localStorage.setItem('GEMINI_API_KEY', key);
          alert("API Key 已保存，页面将刷新");
          window.location.reload();
      }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950 text-gray-100 font-sans">
      
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} flex-shrink-0 bg-gray-900 border-r border-gray-800 transition-all duration-300 flex flex-col`}>
         <div className="p-4 border-b border-gray-800 flex justify-between items-center">
             <h1 className="text-lg font-bold text-accent-500">英语大师 AI</h1>
             <button onClick={createNewDoc} className="text-gray-400 hover:text-white text-2xl leading-none">+</button>
         </div>
         <div className="flex-1 overflow-y-auto p-2">
             {documents.map(doc => (
                 <div key={doc.id} onClick={() => setActiveDocId(doc.id)} className={`p-3 rounded cursor-pointer text-sm mb-1 flex justify-between group ${activeDocId === doc.id ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50'}`}>
                    <span className="truncate">{doc.title}</span>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            // One-click delete without confirmation
                            const remainingDocs = documents.filter(d => d.id !== doc.id);
                            
                            if (remainingDocs.length === 0) {
                                // If all deleted, create a new blank doc
                                const newDoc: LearningDocument = {
                                    id: uuidv4(),
                                    title: `新文档 ${new Date().toLocaleDateString()}`,
                                    createdAt: Date.now(),
                                    blocks: [],
                                    viewMode: ViewMode.PARAGRAPH
                                };
                                setDocuments([newDoc]);
                                setActiveDocId(newDoc.id);
                            } else {
                                setDocuments(remainingDocs);
                                // If deleting active doc, switch to the first available
                                if (activeDocId === doc.id) {
                                    setActiveDocId(remainingDocs[0].id);
                                }
                            }
                        }} 
                        className="opacity-0 group-hover:opacity-100 hover:text-red-400 px-2 font-bold text-lg leading-none"
                        title="一键删除"
                    >
                        ×
                    </button>
                 </div>
             ))}
         </div>
         <div className="p-4 border-t border-gray-800 space-y-3">
            <button 
                onClick={handleSetKey} 
                className="w-full text-left text-xs text-gray-500 hover:text-accent-400 flex items-center gap-2"
            >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                设置 API Key
            </button>
            {deferredPrompt && <button onClick={() => {deferredPrompt.prompt(); setDeferredPrompt(null)}} className="w-full text-left text-xs text-accent-400 hover:text-accent-300 flex items-center gap-2">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                安装到桌面
            </button>}
         </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col h-full relative bg-gray-950">
        <div className="h-16 bg-gray-900/80 backdrop-blur border-b border-gray-800 flex items-center justify-between px-6 z-20">
            <div className="flex items-center gap-4">
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-gray-400 hover:text-white"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></button>
                <input className="bg-transparent border-none font-bold text-white focus:ring-0 w-64" value={activeDoc.title} onChange={e => setDocuments(docs => docs.map(d => d.id === activeDocId ? { ...d, title: e.target.value } : d))} />
            </div>

            <div className="flex items-center gap-4">
                {/* Translate ALL Action Button */}
                <button 
                    onClick={handleFullTranslation}
                    disabled={translatingAll}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all shadow-lg ${translatingAll ? 'bg-gray-700 text-gray-400 cursor-wait' : 'bg-green-600 hover:bg-green-500 text-white hover:shadow-green-500/20'}`}
                >
                    {translatingAll ? (
                        <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> 正在翻译...</>
                    ) : (
                        <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg> 全文翻译</>
                    )}
                </button>

                <div className="w-px h-8 bg-gray-700 mx-2"></div>

                {/* View Mode Switcher */}
                <div className="flex bg-gray-800 rounded-lg p-1">
                    <button onClick={() => updateDocMode(ViewMode.PARAGRAPH)} className={`px-3 py-1.5 text-xs rounded-md transition-all ${activeDoc.viewMode === ViewMode.PARAGRAPH ? 'bg-gray-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>逐段视图</button>
                    <button onClick={() => updateDocMode(ViewMode.SENTENCE)} className={`px-3 py-1.5 text-xs rounded-md transition-all ${activeDoc.viewMode === ViewMode.SENTENCE ? 'bg-gray-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>逐句视图</button>
                </div>
                
                <label className={`ml-2 p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg cursor-pointer transition-colors ${isLoadingFile ? 'animate-pulse' : ''}`} title="上传文件 (支持 .txt, .pdf, .doc, .docx, 图片)">
                    <input type="file" className="hidden" accept=".txt,.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={handleFileUpload} disabled={isLoadingFile} />
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                </label>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 selection-highlight" onClick={() => setSelectionState(null)}>
            <div className="max-w-4xl mx-auto pb-32">
                {activeDoc.blocks.map(block => (
                    <ContentBlockComp 
                        key={block.id} 
                        block={block} 
                        mode={activeDoc.viewMode}
                        onUpdateBlock={updateBlock}
                        onDeleteBlock={deleteBlock}
                        onUpdateWord={updateWord}
                    />
                ))}
                <div className="mt-12 text-center">
                    <button onClick={addNewBlock} className="px-6 py-3 text-gray-500 hover:text-white border border-gray-800 hover:border-gray-600 rounded-full transition-all">添加新段落</button>
                </div>
            </div>
        </div>

        {selectionState && <FloatingMenu selection={selectionState} onAnalyze={performGrammarAnalysis} onClose={() => setSelectionState(null)} loading={analyzing} />}
      </div>
    </div>
  );
};

export default App;