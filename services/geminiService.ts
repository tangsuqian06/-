
import { GoogleGenAI } from "@google/genai";

const getAI = () => {
  // The API key must be obtained exclusively from the environment variable process.env.API_KEY.
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const MODEL_FAST = 'gemini-2.5-flash';

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

export const extractTextContent = async (fileBase64: string, mimeType: string): Promise<string> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: fileBase64 } },
          { text: "Please extract all the English text content from this file. Maintain the original paragraph structure. Do not add any conversational filler." }
        ]
      }
    });
    return response.text || "";
  } catch (error: any) {
    console.error("Error extracting text:", error);
    throw new Error("文件解析失败");
  }
};

// Advanced Translation: Returns Paragraph + Sentence translations
export const translateBlockAdvanced = async (
    paragraphText: string, 
    sentences: string[]
): Promise<{ paragraph: string, sentences: string[] }> => {
  try {
    const ai = getAI();
    
    // Constructing a structured prompt
    const prompt = `
    我需要将一段英语翻译成中文。请分别提供：
    1. 整段话的流畅中文翻译。
    2. 针对我提供的句子列表，按顺序提供每一句的对应中文翻译。

    原文段落: "${paragraphText}"
    
    原文句子列表:
    ${JSON.stringify(sentences)}

    请务必返回严格的 JSON 格式（不要包含 Markdown 代码块），格式如下:
    {
        "paragraph": "整段的中文翻译...",
        "sentences": ["第一句翻译", "第二句翻译", ...]
    }
    `;

    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const text = response.text || "{}";
    const data = JSON.parse(text);
    
    return {
        paragraph: data.paragraph || "",
        sentences: Array.isArray(data.sentences) ? data.sentences : []
    };

  } catch (error: any) {
    console.error("Translation error:", error);
    return { paragraph: "翻译失败", sentences: [] };
  }
};

export const translateWord = async (word: string, sentenceContext: string): Promise<string> => {
  try {
    const prompt = `Translate "${word}" to Chinese (context: "${sentenceContext}"). Return ONLY the word (max 4 chars).`;
    const ai = getAI();
    const response = await ai.models.generateContent({ model: MODEL_FAST, contents: prompt });
    return (response.text || "").trim();
  } catch (error) { return "Error"; }
};

export const getWordDefinition = async (word: string, sentenceContext: string): Promise<string> => {
  try {
    // Updated prompt to enforce Chinese definitions
    const prompt = `
      As an expert English teacher for Chinese students, explain the word "${word}" based on the context: "${sentenceContext}".
      
      Requirements:
      1. "ipa": IPA pronunciation.
      2. "senses": List of meanings. "pos" (part of speech) must be standard (n., v., adj.). "def" must be the CHINESE definition.
      3. "examples": One or two sentences. "en" is English, "zh" is Chinese translation.
      4. "phrases": Common phrases involving this word.

      Return STRICT JSON:
      { 
        "ipa": "...", 
        "senses": [{"pos": "...", "def": "中文释义..."}], 
        "examples": [{"en": "...", "zh": "..."}], 
        "phrases": ["..."] 
      }
    `;
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return response.text || "";
  } catch (error) { return "{}"; }
};

export const analyzeGrammar = async (text: string): Promise<string> => {
  try {
    const prompt = `分析此句语法: "${text}". 返回 JSON: { "structure": ["主语:.."], "grammarPoints": [{"point": "..", "desc": ".."}], "translation": ".." }`;
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return response.text || "";
  } catch (error) { return "{}"; }
};
