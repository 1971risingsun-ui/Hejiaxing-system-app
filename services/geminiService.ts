
import { GoogleGenAI } from "@google/genai";

// Guideline: Always use new GoogleGenAI({apiKey: process.env.API_KEY});
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeConstructionPhoto = async (base64Image: string): Promise<string> => {
  // Guideline: Assume process.env.API_KEY is pre-configured and valid.
  
  try {
    const response = await ai.models.generateContent({
      // Guideline: Use 'gemini-3-flash-preview' for general text/multimodal tasks.
      model: 'gemini-3-flash-preview', 
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg', // Assuming jpeg for simplicity, or detect from usage
              data: base64Image
            }
          },
          {
            text: "Analyze this construction site photo. Identify the current stage of construction, list any visible materials, and highlight potential safety hazards if any. Be concise."
          }
        ]
      }
    });

    // Guideline: Access the .text property directly (do not call as a function).
    return response.text || "無法分析圖片";
  } catch (error) {
    console.error("Error analyzing photo:", error);
    return "分析失敗，請稍後再試。";
  }
};
