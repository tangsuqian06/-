
import React from 'react';
import { GrammarAnalysis } from '../types';

interface Props {
  analysis: GrammarAnalysis;
  onDelete: () => void;
}

export const GrammarBox: React.FC<Props> = ({ analysis, onDelete }) => {
  // Simple cleaner to remove markdown bold/italic markers for a flatter UI
  const cleanExplanation = analysis.explanation
    .replace(/\*\*/g, '') // Remove bold **
    .replace(/#/g, '')    // Remove headers #
    .replace(/`/g, '');   // Remove code ticks `

  return (
    <div className="mt-4 p-5 bg-gray-800/80 border-l-4 border-indigo-500 rounded-r-lg relative group shadow-lg backdrop-blur-sm transition-all hover:bg-gray-800">
      <button 
        onClick={onDelete}
        className="absolute top-3 right-3 text-gray-600 hover:text-red-400 transition-colors p-1"
        title="删除解析"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
      
      <div className="mb-3">
         <span className="text-xs font-bold text-indigo-300 bg-indigo-900/30 px-2 py-1 rounded uppercase tracking-wider">
            语法解析
         </span>
         <div className="mt-2 font-serif italic text-gray-400 border-l-2 border-gray-600 pl-3">
             "{analysis.sourceText}"
         </div>
      </div>
      
      <div className="text-gray-200 text-sm leading-7 whitespace-pre-wrap font-medium">
        {cleanExplanation}
      </div>
    </div>
  );
};
