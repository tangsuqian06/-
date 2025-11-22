export enum TranslationMode {
  SENTENCE = 'sentence',
  PARAGRAPH = 'paragraph',
  FULL = 'full'
}

export interface WordData {
  id: string;
  text: string;
  cleanText: string; // Text without punctuation for API calls
  translation?: string; // Short inline translation
  definition?: string; // Detailed definition
}

export interface GrammarAnalysis {
  id: string;
  sourceText: string;
  explanation: string;
}

export interface ContentBlock {
  id: string;
  text: string; // The full text of the paragraph
  words: WordData[]; // Parsed words for interaction
  translation?: string; // Block translation (used for Paragraph/Full mode)
  sentenceTranslations?: Record<string, string>; // Map of sentence index to translation
  grammarAnalyses: GrammarAnalysis[]; // Pinned grammar notes
}

export interface LearningDocument {
  id: string;
  title: string;
  createdAt: number;
  blocks: ContentBlock[];
  translationMode: TranslationMode;
}

export interface SelectionState {
  text: string;
  blockId: string;
  range: Range | null;
  top: number;
  left: number;
}