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
      
      // Process blocks sequentially to avoid rate limits, or parallel with limit
      // For simplicity and UX feedback, let's do parallel but simple
      try {
          const newBlocks = await Promise.all(activeDoc.blocks.map(async (block) => {
              // Skip if already translated? User requirement says "click to update", so we should re-translate.
              // Or maybe only if text changed. But "user confirms content... then clicks" implies explicit action.
              // Let's re-translate to be safe.
              const sentences = getSentencesFromBlock(block);
              const result = await translateBlockAdvanced(block.text, sentences);
              
              return {
                  ...block,
                  translation: result.paragraph,
                  sentenceTranslations: result.sentences
              };
          }));

          setDocuments(docs => docs.map(d => d.id === activeDocId ? { ...d, blocks: newBlocks } : d));
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
      // Use functional update to ensure we are looking at the latest state
      setDocuments(currentDocs => currentDocs.map(doc => {
          // Crucial: ensure we modify the document that contains this block
          // Since activeDocId might not have synced in edge cases, check block existence
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
                    <span onClick={(e) => {e.stopPropagation(); if(confirm('确认删除?')) {const n=documents.filter(d=>d.id!==doc.id); setDocuments(n); if(activeDocId===doc.id) setActiveDocId(n[0]?.id||'')}}} className="opacity-0 group-hover:opacity-100 hover:text-red-400">×</span>
                 </div>
             ))}
         </div>
         <div className="p-4 border-t border-gray-800 text-xs text-gray-500">
            {deferredPrompt && <button onClick={() => {deferredPrompt.prompt(); setDeferredPrompt(null)}} className="text-accent-400 hover:text-accent-300">安装到桌面</button>}
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