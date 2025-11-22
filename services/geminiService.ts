import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const MODEL_FAST = 'gemini-2.5-flash';
const MODEL_SMART = 'gemini-2.5-flash'; // Flash is capable enough for these tasks and faster

// Helper to base64 encode files
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

// 1. Extract text from user uploaded files (Text, PDF, Docx, Image)
export const extractTextContent = async (
  fileBase64: string, 
  mimeType: string
): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: fileBase64
            }
          },
          {
            text: "Please extract all the English text content from this file. Maintain the original paragraph structure. Do not add any conversational filler, just return the text."
          }
        ]
      }
    });
    return response.text || "";
  } catch (error) {
    console.error("Error extracting text:", error);
    throw error;
  }
};

// 2. Translate text (Paragraph or Sentence)
export const translateText = async (text: string, context: string = ""): Promise<string> => {
  try {
    const prompt = `Translate the following English text into natural, fluent Chinese. 
    Context: ${context.substring(0, 100)}...
    Text to translate: "${text}"
    Only return the Chinese translation.`;
    
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt
    });
    return response.text || "";
  } catch (error) {
    console.error("Translation error:", error);
    return "翻译失败";
  }
};

// 3. Translate a single word (Concise)
export const translateWord = async (word: string, sentenceContext: string): Promise<string> => {
  try {
    const prompt = `Translate the English word "${word}" into Chinese based on this context: "${sentenceContext}". 
    Return ONLY the most appropriate Chinese word or short phrase (max 4 chars). No pinyin, no explanations.`;

    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt
    });
    return (response.text || "").trim();
  } catch (error) {
    return "Error";
  }
};

// 4. Detailed Word Definition
export const getWordDefinition = async (word: string, sentenceContext: string): Promise<string> => {
  try {
    const prompt = `Provide a detailed explanation for the English word "${word}" for a Chinese learner.
    Context: "${sentenceContext}"
    Output format:
    1. Pronunciation (IPA)
    2. Definition in Chinese
    3. Two example sentences (English + Chinese translation)
    4. Common collocations
    Keep it structured and easy to read.`;

    const response = await ai.models.generateContent({
      model: MODEL_SMART,
      contents: prompt
    });
    return response.text || "";
  } catch (error) {
    return "无法获取详情";
  }
};

// 5. Grammar Analysis
export const analyzeGrammar = async (text: string): Promise<string> => {
  try {
    const prompt = `Analyze the grammar of the following English sentence(s) for a Chinese student:
    "${text}"
    
    Please provide:
    1. Sentence structure breakdown (Subject, Verb, Object, etc.)
    2. Key grammatical points or tenses used.
    3. Explanation of any difficult idioms or phrases.
    
    Output in Chinese. Use Markdown for formatting.`;

    const response = await ai.models.generateContent({
      model: MODEL_SMART,
      contents: prompt
    });
    return response.text || "";
  } catch (error) {
    return "分析失败";
  }
};

// 6. Full Document Translation (Batched approach simulation for this demo)
// For the "Full Translation" mode, we usually iterate over blocks in the UI, 
// but we can also have a helper here if needed.
export const translateFullDoc = async (text: string): Promise<string> => {
    // For very long texts, we would need to chunk. 
    // For this demo, we assume reasonable length or UI loop.
    return translateText(text);
}
