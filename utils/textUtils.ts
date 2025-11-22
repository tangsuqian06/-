
import { ContentBlock, WordData } from "../types";

export const generateId = () => Math.random().toString(36).substring(2, 9);

export const parseTextToBlocks = (fullText: string): ContentBlock[] => {
  // Normalize newlines and split by double newline for paragraphs
  const paragraphs = fullText.replace(/\r\n/g, '\n').split(/\n\s*\n/);
  
  return paragraphs
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(text => {
      // Use Intl.Segmenter for locale-aware sentence splitting
      // Cast Intl to any to avoid TS error "Property 'Segmenter' does not exist on type 'typeof Intl'"
      const segmenter = new (Intl as any).Segmenter('en', { granularity: 'sentence' });
      const sentencesIterator = segmenter.segment(text);
      
      const words: WordData[] = [];
      let sIndex = 0;

      for (const sentenceSegment of sentencesIterator) {
          const sText = sentenceSegment.segment;
          // Split sentence into tokens (words + punctuation)
          const tokens = sText.split(/([a-zA-Z0-9'-]+)/g);
          
          tokens.forEach((token: string) => {
             if (token.length === 0) return;
             const isWord = /^[a-zA-Z0-9'-]+$/.test(token);
             words.push({
                 id: generateId(),
                 text: token,
                 cleanText: isWord ? token : '',
                 translation: undefined,
                 sentenceIndex: sIndex
             });
          });
          sIndex++;
      }

      return {
        id: generateId(),
        text,
        words,
        grammarAnalyses: []
      };
    });
};

// Helper to reconstruct sentences list from block for API usage
export const getSentencesFromBlock = (block: ContentBlock): string[] => {
    const sentences: string[] = [];
    block.words.forEach(w => {
        if (!sentences[w.sentenceIndex]) sentences[w.sentenceIndex] = "";
        sentences[w.sentenceIndex] += w.text;
    });
    return sentences;
};