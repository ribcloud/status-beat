import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

/**
 * Generates a creative image based on a prompt (e.g., song mood).
 * Uses gemini-2.5-flash-image for better availability.
 */
export const generateCoverImage = async (prompt: string): Promise<string> => {
  if (!apiKey) throw new Error("API Key is missing");

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `A creative, artistic album cover or background for a song. Mood/Theme: ${prompt}. High quality, 9:16 vertical ratio suitable for mobile screen.` }],
      },
      config: {
        imageConfig: {
          aspectRatio: "9:16"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData && part.inlineData.data) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data received from Gemini.");
  } catch (error) {
    console.error("Gemini Image Generation Error:", error);
    throw error;
  }
};

/**
 * Generates a WhatsApp Status caption based on the song vibe.
 * Uses gemini-2.5-flash for speed.
 */
export const generateCaption = async (songName: string, mood: string): Promise<string> => {
  if (!apiKey) throw new Error("API Key is missing");

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Write a short, engaging caption (maximum 15 words) for a WhatsApp Status sharing a song. 
      Song Name: "${songName}". 
      Vibe/Mood: "${mood}". 
      Language: Portuguese (Brazil). 
      Include 1-2 emojis. Do not use quotes.`,
    });

    return response.text || "";
  } catch (error) {
    console.error("Gemini Caption Generation Error:", error);
    throw error;
  }
};