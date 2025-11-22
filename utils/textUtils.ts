import { ContentBlock, WordData } from "../types";

export const generateId = () => Math.random().toString(36).substring(2, 9);

export const parseTextToBlocks = (fullText: string): ContentBlock[] => {
  // Normalize newlines and split by double newline for paragraphs
  const paragraphs = fullText.replace(/\r\n/g, '\n').split(/\n\s*\n/);
  
  return paragraphs
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(text => ({
      id: generateId(),
      text,
      words: parseWords(text),
      grammarAnalyses: []
    }));
};

const parseWords = (text: string): WordData[] => {
  // Split by space but keep punctuation attached to words visually if possible, 
  // or split punctuation as separate tokens.
  // Strategy: Split by regex that captures words and non-word characters separately
  const tokens = text.split(/([a-zA-Z0-9'-]+)/g);
  
  return tokens.map(token => {
    const isWord = /^[a-zA-Z0-9'-]+$/.test(token);
    return {
      id: generateId(),
      text: token,
      cleanText: isWord ? token : '',
      translation: undefined
    };
  });
};
