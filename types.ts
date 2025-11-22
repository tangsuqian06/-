
export enum ViewMode {
  PARAGRAPH = 'paragraph',
  SENTENCE = 'sentence'
}

export interface WordDefinition {
  ipa: string;
  senses: { pos: string; def: string }[];
  examples: { en: string; zh: string }[];
  phrases?: string[];
}

export interface GrammarParsedData {
  structure: string[];
  grammarPoints: { point: string; desc: string }[];
  translation: string;
}

export interface WordData {
  id: string;
  text: string;
  cleanText: string; 
  translation?: string; 
  definition?: string; 
  sentenceIndex: number; // Index of the sentence this word belongs to
}

export interface GrammarAnalysis {
  id: string;
  sourceText: string;
  explanation: string; 
}

export interface ContentBlock {
  id: string;
  text: string; 
  words: WordData[]; 
  translation?: string; // Full paragraph translation
  sentenceTranslations?: string[]; // Array of translations corresponding to sentence indices
  grammarAnalyses: GrammarAnalysis[]; 
}

export interface LearningDocument {
  id: string;
  title: string;
  createdAt: number;
  blocks: ContentBlock[];
  viewMode: ViewMode;
}

export interface SelectionState {
  text: string;
  blockId: string;
  range: Range | null;
  top: number;
  left: number;
}
