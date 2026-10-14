import { GoogleGenAI, Type, Modality, LiveServerMessage } from "@google/genai";
import { 
  AppMode, 
  Language, 
  ImageGenConfig, 
  VeoConfig, 
  Attachment,
  ReasoningEffortLevel,
  REASONING_TIERS,
  ResponseLengthLevel
} from '../types';
import { createPcmBlob } from './audioService';

const getApiKey = () => {
  try {
    const raw = localStorage.getItem('mechengb_api_keys_v1');
    if (raw) {
      const keys = JSON.parse(raw);
      const geminiKey = keys.find((k: any) => k.provider === 'gemini' && k.apiKey)?.apiKey;
      if (geminiKey) return geminiKey;
    }
  } catch {}
  return process.env.API_KEY || process.env.GEMINI_API_KEY || '';
};

// --- Helper: Construct System Instructions based on Language & Mode ---
const getSystemInstruction = (mode: AppMode, language: Language, shortMode: boolean): string => {
  let baseRole = "You are the 'MechEng Omni-Bot', a highly advanced AI for a Mechanical Engineering student.";
  
  let langInstruction = "";
  switch (language) {
    case Language.ARABIC:
      langInstruction = "Respond in fluent, professional Arabic.";
      break;
    case Language.ENGLISH:
      langInstruction = "Respond in fluent, clear English.";
      break;
    case Language.GERMAN:
      langInstruction = "Respond in German. Act as a Strict Language Tutor. You must correct the user's mistake immediately before answering the question.";
      break;
  }

  let modeInstruction = "";
  switch (mode) {
    case AppMode.SOLVE:
      modeInstruction = shortMode 
        ? "Task: Solve mechanical engineering problems. Provide ONLY the final answer/solution. No explanations."
        : "Task: Solve mechanical engineering problems. Show Given, Find, Formulas, and Solution. Provide detailed reasoning.";
      break;
    case AppMode.MAP:
      modeInstruction = "Task: Analyze locations using Google Maps data. Analyze the physics of the route (fuel consumption, velocity, terrain).";
      break;
    case AppMode.PROMPT:
      modeInstruction = "Task: Act as an expert Prompt Engineer. The user will provide a TOPIC and TARGET MODEL. Output a revised prompt, suggestions, and questions.";
      break;
    default:
      modeInstruction = "";
  }

  const formatting = shortMode ? " [Short_Mode: True]" : " [Short_Mode: False]";

  return `${baseRole} ${langInstruction} ${modeInstruction} ${formatting}`;
};

// --- Service Methods ---

// 1. Core Text/Vision Solver (Thinking Mode included)
export const generateSolveResponse = async (
  prompt: string,
  attachment: Attachment | null,
  language: Language,
  responseLength: ResponseLengthLevel | boolean,
  useDeepThink: boolean | ReasoningEffortLevel
) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  
  // Resolve reasoning tier
  const level: ReasoningEffortLevel = typeof useDeepThink === 'string' 
    ? useDeepThink 
    : (useDeepThink ? 'high' : 'off');
  const tier = REASONING_TIERS[level] || REASONING_TIERS.off;

  const lengthLevel: ResponseLengthLevel = typeof responseLength === 'string'
    ? responseLength
    : (responseLength ? 'short' : 'standard');

  const modelId = (level === 'max' || level === 'high') ? 'gemini-4-argon' : 'gemini-3.8-flash';
  
  const parts: any[] = [];
  if (attachment) {
    if (attachment.mimeType === 'application/pdf' || attachment.type === 'image' || attachment.type === 'video' || attachment.type === 'audio') {
        parts.push({
          inlineData: {
            mimeType: attachment.mimeType,
            data: attachment.data
          }
        });
    } else if (attachment.type === 'text') {
        try {
            const textContent = atob(attachment.data);
            parts.push({ text: `[Attached File: ${attachment.name}]\n${textContent}` });
        } catch (e) {
             console.warn("Failed to decode text attachment", e);
        }
    }
  }

  let effectivePrompt = prompt;
  if (lengthLevel === 'short') {
    effectivePrompt += "\n\n[INSTRUCTION: Provide only a very brief and concise final answer without unnecessary preamble.]";
  } else if (lengthLevel === 'max') {
    effectivePrompt += "\n\n[INSTRUCTION: Provide an exhaustive, detailed and comprehensive derivation with full depth.]";
  }
  parts.push({ text: effectivePrompt });

  const maxTokens = lengthLevel === 'short' ? 1024 : lengthLevel === 'compact' ? 4096 : lengthLevel === 'standard' ? 16384 : 65536;

  const config: any = {
    maxOutputTokens: maxTokens,
    temperature: tier.temperature
  };

  if (tier.thinkingBudget > 0) {
      config.thinkingConfig = { thinkingBudget: tier.thinkingBudget };
  } else {
      config.thinkingConfig = { thinkingBudget: 0 };
  }

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts },
      config: config
    });
    return { text: response.text || "No response generated." };
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota')) {
      return {
        text: "⚠️ **Rate Limit Notice (429: Quota Exceeded)**\n\nThe free Gemini API request quota has temporarily been reached. Please wait a moment before trying again, or configure your personal Gemini API key in **API Settings** (⚙️ top right) for dedicated limits."
      };
    }
    return { text: `⚠️ Request Error: ${errMsg}` };
  }
};

// 2. Maps Grounding
export const generateMapResponse = async (
  prompt: string,
  location: GeolocationCoordinates | null,
  language: Language,
  useDeepThink: boolean | ReasoningEffortLevel,
  responseLength: ResponseLengthLevel | boolean,
  attachment: Attachment | null
) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      text: `### 🗺️ Google Maps Navigation\n\nNo Gemini API Key is configured for live grounding. You can explore this location directly on Google Maps:\n\n👉 [Open "${prompt}" on Google Maps](https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prompt)})`,
      mapLinks: [
        {
          title: `Google Maps: ${prompt.slice(0, 35)}`,
          uri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prompt)}`
        }
      ]
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelId = 'gemini-3.8-flash';

  const level: ReasoningEffortLevel = typeof useDeepThink === 'string' 
    ? useDeepThink 
    : (useDeepThink ? 'high' : 'off');
  const tier = REASONING_TIERS[level] || REASONING_TIERS.off;

  const toolConfig = location ? {
    retrievalConfig: {
      latLng: {
        latitude: location.latitude,
        longitude: location.longitude
      }
    }
  } : undefined;

  let parts: any[] = [];
  if (attachment) {
       if (attachment.type === 'image') {
           parts.push({ inlineData: { mimeType: attachment.mimeType, data: attachment.data } });
       }
  }
  parts.push({ text: prompt });

  // 1. Try with Google Maps grounding
  try {
    const config: any = {
      tools: [{ googleMaps: {} }],
      toolConfig: toolConfig
    };
    if (tier.thinkingBudget > 0) {
      config.thinkingConfig = { thinkingBudget: Math.min(tier.thinkingBudget, 8192) };
    }

    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts },
      config
    });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const mapLinks = chunks?.map((c: any) => ({
        title: c.maps?.title || "Map Location",
        uri: c.maps?.uri || "#"
    })).filter((l: any) => l.uri !== "#") || [];

    return { text: response.text || "", mapLinks };
  } catch (error: any) {
    console.warn("Google Maps grounding tool error or 429 quota reached. Handling gracefully...", error);
    const errMsg = error?.message || String(error);
    const isQuotaOrToolError = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota') || errMsg.includes('tools');

    if (isQuotaOrToolError) {
      try {
        // Fallback: Generate route & navigation analysis using standard model without the rate-limited maps tool
        const fallbackParts = [
          ...parts,
          { text: "\n[Provide a comprehensive route, geography, distance and physical analysis with navigation details.]" }
        ];
        const fallbackRes = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: { parts: fallbackParts }
        });

        return {
          text: (fallbackRes.text || "Route analysis generated.") + "\n\n*(Note: Live Google Maps grounding quota was reached; generated using geographic reasoning. You can also add a dedicated Gemini key in API Settings for higher quota).* ",
          mapLinks: [
            {
              title: `Search on Google Maps: ${prompt.slice(0, 30)}`,
              uri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prompt)}`
            }
          ]
        };
      } catch (_fallbackError: any) {
        // Return a clean, user-friendly markdown notice with direct Google Maps link instead of an uncaught error
        return {
          text: `### 🗺️ Google Maps Navigation Notice\n\n` +
                `**Quota Exceeded (HTTP 429):** The Gemini API rate limit for live Maps grounding has temporarily been reached.\n\n` +
                `**Quick Actions:**\n` +
                `- Add your personal Gemini API key in **API Keys Settings** (⚙️ top right) for dedicated unlimited quota.\n` +
                `- Or wait a few moments and try again.\n\n` +
                `👉 [Open "${prompt}" directly on Google Maps](https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prompt)})`,
          mapLinks: [
            {
              title: `Google Maps: ${prompt.length > 35 ? prompt.slice(0, 32) + '...' : prompt}`,
              uri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prompt)}`
            }
          ]
        };
      }
    }

    return {
      text: `### 🗺️ Google Maps Inquiry\n\nCould not fetch live map data: ${errMsg}\n\n👉 [Open on Google Maps](https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prompt)})`,
      mapLinks: [
        {
          title: `Search Google Maps for "${prompt.slice(0, 30)}"`,
          uri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prompt)}`
        }
      ]
    };
  }
};

// 3. Image Generation (Using supported gemini-3.1-flash-lite-image and gemini-nano-banana-2.1)
export const generateImage = async (prompt: string, config: ImageGenConfig) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("No API key available for image generation. Please add an API key in API Settings.");
  }
  const ai = new GoogleGenAI({ apiKey });

  // Use gemini-3.1-flash-lite-image as reliable default, or gemini-nano-banana-2.1 for high-res
  const isHighRes = config.imageSize === '2K' || config.imageSize === '4K';
  const targetModel = isHighRes ? 'gemini-nano-banana-2.1' : 'gemini-3.1-flash-lite-image';

  try {
    const genConfig: any = {
      imageConfig: {
        aspectRatio: config.aspectRatio || '1:1'
      }
    };
    if (isHighRes) {
      genConfig.imageConfig.imageSize = config.imageSize;
    }

    const response = await ai.models.generateContent({
      model: targetModel,
      contents: { parts: [{ text: prompt }] },
      config: genConfig
    });
    
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  } catch (error: any) {
    console.warn(`Primary image model ${targetModel} encountered an issue, trying gemini-3.1-flash-lite-image fallback...`, error);
    
    // Fallback: standard gemini-3.1-flash-lite-image with aspectRatio
    try {
      const fallbackResponse = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: { parts: [{ text: prompt }] },
        config: {
          imageConfig: {
            aspectRatio: config.aspectRatio || '1:1'
          }
        }
      });
      
      for (const part of fallbackResponse.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    } catch (fallbackError: any) {
      console.warn("Image Gen Fallback Error:", fallbackError);
      const msg = fallbackError?.message || String(fallbackError);
      if (msg.includes('404') || msg.includes('NOT_FOUND') || msg.includes('Requested entity was not found')) {
        throw new Error('This model requires an active billing account in Google AI Studio. You can switch to the "Nano Banana (Free · No API Key)" model from the selector bar for instant generation without any key.');
      }
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
        throw new Error('Gemini Image API rate limit (429) reached. Please switch to "Nano Banana (Free · No API Key)" or wait a moment before trying again.');
      }
      throw fallbackError;
    }
  }
  return null;
};

// 4. Image Editing (Using supported gemini-3.1-flash-lite-image)
export const editImage = async (prompt: string, attachment: Attachment) => {
    if (attachment.type !== 'image') throw new Error("Image required for editing.");
    
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error("No API key available for image editing.");
    }
    const ai = new GoogleGenAI({ apiKey });
    const modelId = 'gemini-3.1-flash-lite-image';
  
    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: {
          parts: [
            {
              inlineData: {
                data: attachment.data,
                mimeType: attachment.mimeType,
              },
            },
            { text: prompt },
          ],
        },
      });
      
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      return null;
    } catch (error: any) {
      console.warn("Image Edit Warning:", error);
      const msg = error?.message || String(error);
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
        throw new Error('Image editing quota limit (429) reached. Please wait a moment or configure your personal Gemini key in API Settings.');
      }
      throw error;
    }
};

// 5. Video Generation (Veo)
export const generateVideo = async (prompt: string, config: VeoConfig) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() }); 
  const modelId = 'veo-3.1-lite-generate-preview';

  try {
    let operation = await ai.models.generateVideos({
      model: modelId,
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: config.resolution,
        aspectRatio: config.aspectRatio
      }
    });

    // Polling
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (videoUri) {
        return `${videoUri}&key=${getApiKey()}`;
    }
    throw new Error("No video URI returned");

  } catch (error) {
    console.error("Veo Error:", error);
    throw error;
  }
};

// 6. Prompt Engineering Mode
export const generatePromptHelp = async (topic: string, targetModel: string) => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const modelId = 'gemini-3.8-flash';
    
    const metaPrompt = `
      Act as an expert Prompt Engineer.
      The user wants to generate a prompt for the TOPIC: "${topic}".
      The TARGET MODEL is: "${targetModel}".
      
      Output the standard "Iterative Process" response:
      1. Revised Prompt: (A highly optimized prompt for that model)
      2. Suggestions: (How to improve it further)
      3. Questions: (Clarifying questions to narrow down intent)
    `;
  
    const response = await ai.models.generateContent({
      model: modelId,
      contents: metaPrompt,
    });
    return response.text;
  };

// 7. Live API Connection (Setup)
export const connectLiveSession = async (
    onAudioData: (base64: string) => void,
    onClose: () => void,
    onError: (err: any) => void
) => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const modelId = 'gemini-3.8-live';

    const sessionPromise = ai.live.connect({
        model: modelId,
        callbacks: {
            onopen: () => console.log("Live Session Opened"),
            onmessage: (msg: LiveServerMessage) => {
                const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (audioData) {
                    onAudioData(audioData);
                }
                const turnComplete = msg.serverContent?.turnComplete;
                if (turnComplete) {
                    // Turn complete logic if needed
                }
            },
            onclose: (e) => {
                console.log("Live Session Closed", e);
                onClose();
            },
            onerror: (e) => {
                console.error("Live Session Error", e);
                onError(e);
            }
        },
        config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: "You are the MechEng Omni-Bot. You are helpful, professional, and knowledgeable about engineering. Use the user's spoken language context.",
        }
    });

    return sessionPromise;
};

// 8. Audio Transcription
export const transcribeAudio = async (base64Audio: string) => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const modelId = 'gemini-3.5-transcribe';
    
    const response = await ai.models.generateContent({
        model: modelId,
        contents: {
            parts: [
                {
                    inlineData: {
                        mimeType: 'audio/wav',
                        data: base64Audio
                    }
                },
                { text: "Transcribe this audio exactly." }
            ]
        }
    });
    return response.text;
}