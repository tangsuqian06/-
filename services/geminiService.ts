import { GoogleGenAI } from "@google/genai";

const STORAGE_KEY = 'user_gemini_api_key';

export const hasValidKey = (): boolean => {
  const envKey = (import.meta as any).env?.VITE_API_KEY || (typeof process !== 'undefined' ? process.env.API_KEY : '');
  const localKey = localStorage.getItem(STORAGE_KEY);
  return !!(envKey || localKey);
};

export const saveApiKey = (key: string) => {
  localStorage.setItem(STORAGE_KEY, key.trim());
};

// Helper to get AI instance safely at runtime
const getAI = () => {
  // Priority: 1. Vite Env  2. Process Env  3. LocalStorage
  const envKey = (import.meta as any).env?.VITE_API_KEY || (typeof process !== 'undefined' ? process.env.API_KEY : '');
  const apiKey = envKey || localStorage.getItem(STORAGE_KEY) || '';
  
  if (!apiKey) {
    throw new Error("MISSING_API_KEY");
  }
  
  return new GoogleGenAI({ apiKey: apiKey });
};

const MODEL_FAST = 'gemini-2.5-flash';
const MODEL_SMART = 'gemini-2.5-flash'; 

// Helper to base64 encode files
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

// 1. Extract text
export const extractTextContent = async (
  fileBase64: string, 
  mimeType: string
): Promise<string> => {
  try {
    const ai = getAI();
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
  } catch (error: any) {
    console.error("Error extracting text:", error);
    if (error.message === "MISSING_API_KEY") throw error;
    throw new Error("文件解析失败，请检查文件格式或网络");
  }
};

// 2. Translate text
export const translateText = async (text: string, context: string = ""): Promise<string> => {
  try {
    const prompt = `Translate the following English text into natural, fluent Chinese. 
    Context: ${context.substring(0, 100)}...
    Text to translate: "${text}"
    Only return the Chinese translation.`;
    
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt
    });
    return response.text || "";
  } catch (error: any) {
    console.error("Translation error:", error);
    if (error.message === "MISSING_API_KEY") return "请先设置 API Key";
    return "翻译失败";
  }
};

// 3. Translate single word
export const translateWord = async (word: string, sentenceContext: string): Promise<string> => {
  try {
    const prompt = `Translate the English word "${word}" into Chinese based on this context: "${sentenceContext}". 
    Return ONLY the most appropriate Chinese word or short phrase (max 4 chars). No pinyin, no explanations.`;

    const ai = getAI();
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

    const ai = getAI();
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

    const ai = getAI();
    const response = await ai.models.generateContent({
      model: MODEL_SMART,
      contents: prompt
    });
    return response.text || "";
  } catch (error) {
    return "分析失败";
  }
};