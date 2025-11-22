
import React from 'react';
import { GrammarAnalysis, GrammarParsedData } from '../types';

interface Props {
  analysis: GrammarAnalysis;
  onDelete: () => void;
}

export const GrammarBox: React.FC<Props> = ({ analysis, onDelete }) => {
  let data: GrammarParsedData | null = null;

  try {
    // Try parsing JSON, fallback to object if it's already object (legacy), or null
    if (typeof analysis.explanation === 'string') {
       // Clean markdown code blocks if present
       const cleanJson = analysis.explanation.replace(/```json/g, '').replace(/```/g, '').trim();
       data = JSON.parse(cleanJson);
    } else {
       data = analysis.explanation as unknown as GrammarParsedData;
    }
  } catch (e) {
    // Fallback for legacy plain text data
    console.error("Failed to parse grammar JSON", e);
  }

  return (
    <div className="mt-6 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-xl transition-all hover:border-gray-600 group relative">
      {/* Header with Delete */}
      <div className="bg-gray-800/50 px-5 py-4 flex justify-between items-start border-b border-gray-800">
          <div className="w-full pr-8">
            <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-xs font-bold rounded uppercase tracking-wider border border-indigo-500/30">
                    语法解析
                </span>
            </div>
            {/* Source Text with Highlight Underline */}
            <div className="inline-block relative">
                <div className="absolute inset-x-0 bottom-0 h-2 bg-accent-500/10 -skew-x-6"></div>
                <div className="font-serif text-gray-200 text-lg leading-relaxed border-b-2 border-accent-500/40 pb-1 relative z-10">
                    {analysis.sourceText}
                </div>
            </div>
          </div>
          <button 
            onClick={onDelete}
            className="text-gray-600 hover:text-red-400 transition-colors p-1 -mr-2 flex-shrink-0"
            title="删除此解析"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
      </div>
      
      <div className="p-5 space-y-6">
         
         {/* Fallback for error */}
         {(!data || !data.grammarPoints) && (
            <div className="text-gray-300 whitespace-pre-wrap text-sm">
                {typeof analysis.explanation === 'string' ? analysis.explanation : "解析数据格式错误"}
            </div>
         )}

         {data && data.grammarPoints && (
             <>
                {/* 1. Sentence Structure (Visual Tags) */}
                {data.structure && data.structure.length > 0 && (
                    <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-wider flex items-center gap-2">
                            <span className="w-1 h-4 bg-indigo-500 rounded-full"></span>
                            句子结构
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {data.structure.map((part, idx) => (
                                <span key={idx} className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800/80 text-indigo-200 border border-gray-700/50 shadow-sm">
                                    {part}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* 2. Grammar Points */}
                {data.grammarPoints && data.grammarPoints.length > 0 && (
                    <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-wider flex items-center gap-2">
                            <span className="w-1 h-4 bg-emerald-500 rounded-full"></span>
                            核心考点
                        </h4>
                        <div className="grid gap-3">
                            {data.grammarPoints.map((gp, idx) => (
                                <div key={idx} className="bg-gray-800/30 p-3 rounded-lg border border-gray-800/50">
                                    <div className="text-emerald-400 font-bold text-sm mb-1">{gp.point}</div>
                                    <div className="text-gray-400 text-sm leading-relaxed">{gp.desc}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 3. Translation */}
                {data.translation && (
                    <div className="pt-4 border-t border-gray-800/80">
                        <div className="flex gap-2 items-center text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
                            <svg className="w-4 h-4 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
                            中文释义
                        </div>
                        <p className="text-gray-200 text-base leading-loose bg-gray-800/20 p-3 rounded-lg italic">
                            {data.translation}
                        </p>
                    </div>
                )}
             </>
         )}
      </div>
    </div>
  );
};
