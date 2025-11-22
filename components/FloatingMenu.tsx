import React from 'react';
import { SelectionState } from '../types';

interface Props {
  selection: SelectionState;
  onAnalyze: () => void;
  onClose: () => void;
  loading: boolean;
}

export const FloatingMenu: React.FC<Props> = ({ selection, onAnalyze, onClose, loading }) => {
  // Calculate position: centered above the selection
  const style: React.CSSProperties = {
    position: 'fixed',
    top: selection.top - 50, // Above
    left: selection.left,
    zIndex: 1000,
  };

  return (
    <div style={style} className="transform -translate-x-1/2 flex items-center gap-2">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-1 flex items-center overflow-hidden">
        <button
          onClick={onAnalyze}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors rounded"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          )}
          语法解析
        </button>
        <button 
            onClick={onClose}
            className="ml-1 p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded"
        >
            ✕
        </button>
      </div>
      {/* Arrow pointing down */}
      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 border-r border-b border-gray-700 rotate-45"></div>
    </div>
  );
};
