import { GoogleGenAI } from "@google/genai";

const getAI = () => {
  // Priority: 1. Environment Variable (Build/Server side) 2. LocalStorage (Client side BYOK)
  const apiKey = process.env.API_KEY || localStorage.getItem('GEMINI_API_KEY');
  
  if (!apiKey) {
    throw new Error("未检测到 API Key。请点击左下角“设置 API Key”按钮进行配置。");
  }
  
  return new GoogleGenAI({ apiKey });
};

const MODEL_FAST = 'gemini-2.5-flash';

// Helper to read file as Base64 (for PDF/Images)
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove Data URL prefix (e.g. "data:image/png;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

// Helper to read file as ArrayBuffer (for Docx)
const fileToArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

// Helper to read file as Text (for .txt)
const fileToText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
    });
};

export const extractTextContent = async (file: File): Promise<string> => {
  try {
    const ai = getAI();
    const mimeType = file.type;
    let textPrompt = "Please extract all the English text content (articles, stories, questions) from this file. Maintain the original paragraph structure. Do not add any conversational filler. If there are questions/exercises, preserve them.";

    // 1. Handle Word Documents (.docx) using Mammoth (Browser CDN version)
    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.name.endsWith(".docx")) {
        const arrayBuffer = await fileToArrayBuffer(file);
        // Access mammoth from window object (loaded via CDN in index.html)
        const mammoth = (window as any).mammoth;
        if (!mammoth) {
            throw new Error("Docx解析器加载失败，请刷新页面重试");
        }
        
        const result = await mammoth.extractRawText({ arrayBuffer });
        const rawText = result.value;
        // Send raw extracted text to Gemini for cleanup/formatting
        const response = await ai.models.generateContent({
            model: MODEL_FAST,
            contents: `${textPrompt}\n\nHere is the raw text content from the document:\n${rawText}`
        });
        return response.text || "";
    }

    // 2. Handle Legacy Word (.doc) - Not supported easily in browser
    if (mimeType === "application/msword" || file.name.endsWith(".doc")) {
        throw new Error("暂不支持旧版 .doc 格式，请将其另存为 .docx 或 PDF 后上传。");
    }

    // 3. Handle Text Files (.txt)
    if (mimeType === "text/plain" || file.name.endsWith(".txt")) {
        const rawText = await fileToText(file);
        const response = await ai.models.generateContent({
            model: MODEL_FAST,
            contents: `${textPrompt}\n\nContent:\n${rawText}`
        });
        return response.text || "";
    }

    // 4. Handle PDF and Images (Native Gemini Support)
    // PDF: application/pdf
    // Images: image/png, image/jpeg, image/webp, etc.
    if (mimeType === "application/pdf" || mimeType.startsWith("image/")) {
        const base64 = await fileToBase64(file);
        const response = await ai.models.generateContent({
            model: MODEL_FAST,
            contents: {
                parts: [
                    { inlineData: { mimeType: mimeType, data: base64 } },
                    { text: textPrompt }
                ]
            }
        });
        return response.text || "";
    }

    throw new Error(`不支持的文件格式: ${mimeType}`);

  } catch (error: any) {
    console.error("Error extracting text:", error);
    throw new Error(error.message || "文件解析失败，请检查 API Key 是否正确");
  }
};

// Advanced Translation: Returns Paragraph + Sentence translations
export const translateBlockAdvanced = async (
    paragraphText: string, 
    sentences: string[]
): Promise<{ paragraph: string, sentences: string[] }> => {
  try {
    const ai = getAI();
    
    // Use JSON.stringify on the paragraphText to ensure quotes inside the text don't break the prompt
    const prompt = `
    我需要将一段英语翻译成中文。请分别提供：
    1. 整段话的流畅中文翻译。
    2. 针对我提供的句子列表，按顺序提供每一句的对应中文翻译。

    原文段落: ${JSON.stringify(paragraphText)}
    
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
    return { paragraph: "翻译失败 (请检查 API Key)", sentences: [] };
  }
};

export const translateWord = async (word: string, sentenceContext: string): Promise<string> => {
  try {
    const prompt = `Translate "${word}" to Simplified Chinese (context: "${sentenceContext}"). Return ONLY the Chinese word (max 4 chars).`;
    const ai = getAI();
    const response = await ai.models.generateContent({ model: MODEL_FAST, contents: prompt });
    return (response.text || "").trim();
  } catch (error) { return "Error"; }
};

export const getWordDefinition = async (word: string, sentenceContext: string): Promise<string> => {
  try {
    // Updated prompt to enforce Chinese definitions strictly
    const prompt = `
      As an expert English teacher for Chinese students, explain the word "${word}" based on the context: "${sentenceContext}".
      
      CRITICAL: All definitions, explanations, and translations MUST be in Simplified Chinese.

      Requirements:
      1. "ipa": IPA pronunciation.
      2. "senses": List of meanings. "pos" (part of speech) must be standard (n., v., adj.). "def" must be the detailed CHINESE definition.
      3. "examples": One or two sentences. "en" is English, "zh" is Chinese translation.
      4. "phrases": Common phrases involving this word.

      Return STRICT JSON:
      { 
        "ipa": "...", 
        "senses": [{"pos": "...", "def": "中文释义..."}], 
        "examples": [{"en": "...", "zh": "中文翻译..."}], 
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
    const prompt = `分析此句语法: "${text}". 返回 JSON: { "structure": ["主语:.."], "grammarPoints": [{"point": "..", "desc": ".."}], "translation": ".." }. Keep descriptions in Chinese.`;
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return response.text || "";
  } catch (error) { return "{}"; }
};