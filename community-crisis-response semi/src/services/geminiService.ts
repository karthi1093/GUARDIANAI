import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

export const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export async function classifyCrisis(description: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Classify this emergency description: "${description}". 
      Provide a JSON response with:
      - crisis_type (e.g., medical, fire, flood, accident)
      - required_skills (array of skills like first_aid, doctor, fire_rescue)
      - priority (low, medium, high, critical)
      - immediate_actions (array of 3 short instructions for the user)`,
      config: {
        responseMimeType: "application/json",
      },
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("AI Classification Error:", error);
    return null;
  }
}

export async function getEmergencyGuidance(crisisType: string, description: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `The user is in a ${crisisType} emergency: "${description}". 
      Provide clear, calm, step-by-step safety instructions for them to follow while waiting for volunteers. 
      Keep it concise and actionable.`,
    });
    return response.text;
  } catch (error) {
    console.error("AI Guidance Error:", error);
    return "Stay calm and move to a safe location if possible. Help is on the way.";
  }
}
