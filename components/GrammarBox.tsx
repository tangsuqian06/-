import React from 'react';
import { GrammarAnalysis } from '../types';

interface Props {
  analysis: GrammarAnalysis;
  onDelete: () => void;
}

export const GrammarBox: React.FC<Props> = ({ analysis, onDelete }) => {
  return (
    <div className="mt-4 p-4 bg-gray-800/50 border-l-4 border-purple-500 rounded relative group">
      <button 
        onClick={onDelete}
        className="absolute top-2 right-2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
        title="删除解析"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
      
      <div className="mb-2 text-xs font-mono text-purple-300 bg-purple-900/30 inline-block px-2 py-1 rounded">
        语法解析: "{analysis.sourceText.length > 30 ? analysis.sourceText.substring(0,30) + '...' : analysis.sourceText}"
      </div>
      
      <div className="prose prose-invert prose-sm max-w-none text-gray-300 whitespace-pre-wrap">
        {analysis.explanation}
      </div>
    </div>
  );
};
