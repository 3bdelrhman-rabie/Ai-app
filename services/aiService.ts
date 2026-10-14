import { GoogleGenAI } from "@google/genai";
import { 
  AppMode, 
  Language, 
  AIProviderType, 
  AIKeyConfig, 
  ActiveModelSelection, 
  Attachment,
  ImageGenConfig,
  ReasoningEffortLevel,
  REASONING_TIERS,
  ResponseLengthLevel
} from '../types';
import * as GeminiService from './geminiService';
import { calculateEngineParameters } from './modelLimits';


export type AICapability = 'text' | 'image' | 'vision' | 'audio' | 'transcribe' | 'live' | 'reasoning' | 'code';

export interface AICapabilityMeta {
  id: AICapability;
  labelEn: string;
  labelAr: string;
  icon: string;
}

export const CAPABILITY_METAS: Record<AICapability, AICapabilityMeta> = {
  text: { id: 'text', labelEn: 'text', labelAr: 'نصوص', icon: 'fa-align-left' },
  image: { id: 'image', labelEn: 'image', labelAr: 'توليد صور', icon: 'fa-image' },
  vision: { id: 'vision', labelEn: 'vision', labelAr: 'تحليل صور', icon: 'fa-eye' },
  audio: { id: 'audio', labelEn: 'audio', labelAr: 'صوت', icon: 'fa-volume-high' },
  transcribe: { id: 'transcribe', labelEn: 'transcribe', labelAr: 'تفريغ صوتي', icon: 'fa-microphone-lines' },
  live: { id: 'live', labelEn: 'live', labelAr: 'مباشر', icon: 'fa-tower-broadcast' },
  reasoning: { id: 'reasoning', labelEn: 'reasoning', labelAr: 'استنتاج عميق', icon: 'fa-brain' },
  code: { id: 'code', labelEn: 'code', labelAr: 'برمجة', icon: 'fa-code' },
};

/**
 * Intelligent capability detection for ANY AI model (built-in or custom user-provided).
 * Returns ONLY the capabilities that this exact model actually supports.
 */
export function detectModelCapabilities(provider: AIProviderType, modelId: string): AICapability[] {
  const m = (modelId || '').trim().toLowerCase();

  // Known dictionary with verified model capabilities
  const knownDict: Record<string, AICapability[]> = {
    // Google Gemini
    'gemini-2.5-flash': ['text', 'vision', 'audio', 'code'],
    'gemini-2.5-pro': ['text', 'vision', 'audio', 'code', 'reasoning'],
    'gemini-3.8-flash': ['text', 'vision', 'audio', 'code'],
    'gemini-4-argon': ['text', 'vision', 'code', 'reasoning'],
    'gemini-2.0-flash-exp': ['text', 'vision', 'audio', 'live', 'code'],
    'gemini-3.1-flash-lite-image': ['image'],
    'imagen-3.0-generate-002': ['image'],
    'imagen-3': ['image'],
    'nano-banana-free': ['image'],
    'nano-banana': ['image'],
    'gemini-nano-banana-2.1': ['image'],
    'gemini-3-pro-image': ['image'],

    // OpenAI
    'gpt-4o': ['text', 'vision', 'audio', 'code'],
    'gpt-4o-mini': ['text', 'vision', 'code'],
    'dall-e-3': ['image'],
    'dall-e-2': ['image'],
    'o1': ['text', 'reasoning', 'code'],
    'o3-mini': ['text', 'reasoning', 'code'],
    'whisper-1': ['transcribe', 'audio'],

    // Anthropic Claude
    'claude-3-7-sonnet-20250219': ['text', 'vision', 'code', 'reasoning'],
    'claude-3-5-sonnet-20241022': ['text', 'vision', 'code', 'reasoning'],
    'claude-3-5-haiku-20241022': ['text', 'vision', 'code'],

    // Groq
    'llama-3.3-70b-versatile': ['text', 'code'],
    'llama-3.1-8b-instant': ['text', 'code'],
    'deepseek-r1-distill-llama-70b': ['text', 'reasoning', 'code'],
    'mixtral-8x7b-32768': ['text', 'code'],

    // DeepSeek
    'deepseek-chat': ['text', 'code'],
    'deepseek-reasoner': ['text', 'reasoning', 'code'],

    // OpenRouter
    'deepseek/deepseek-r1': ['text', 'reasoning', 'code'],
    'anthropic/claude-3.5-sonnet': ['text', 'vision', 'code', 'reasoning'],
    'openai/gpt-4o': ['text', 'vision', 'audio', 'code'],
    'meta-llama/llama-3.3-70b-instruct': ['text', 'code'],
    'google/gemini-2.0-flash-001': ['text', 'vision', 'code'],
  };

  if (knownDict[m]) {
    return knownDict[m];
  }

  // Dynamic Heuristics for arbitrary or custom-entered models
  const caps: Set<AICapability> = new Set();

  const isImageGen = /(dall-?e|imagen|flux|stable-?diffusion|sdxl|midjourney|recraft|banana|image-?gen|image-?preview|art)/i.test(m);
  if (isImageGen) {
    caps.add('image');
  }

  const isTranscribe = /(whisper|transcribe|stt|speech-to-text)/i.test(m);
  if (isTranscribe) {
    caps.add('transcribe');
    caps.add('audio');
  }

  const isAudio = /(tts|speech|audio|voice|eleven)/i.test(m);
  if (isAudio) {
    caps.add('audio');
  }

  const isLive = /(live|realtime)/i.test(m);
  if (isLive) {
    caps.add('live');
  }

  const isReasoning = /(reason|r1|o1|o3|thought|thinking|qwq)/i.test(m);
  if (isReasoning) {
    caps.add('reasoning');
  }

  const isVision = /(vision|gpt-4o|claude-3|gemini|vl|omni|llava|internvl|qwen-?vl)/i.test(m) && !isImageGen;
  if (isVision) {
    caps.add('vision');
  }

  if (!isImageGen && !isTranscribe) {
    caps.add('text');
  }

  if (/(code|coder|codex|dev|deepseek|sonnet|gpt-4|claude|qwen)/i.test(m) || (!isImageGen && !isTranscribe)) {
    caps.add('code');
  }

  return Array.from(caps);
}

export interface ProviderMeta {
  type: AIProviderType;
  name: string;
  defaultBaseUrl: string;
  defaultModels: string[];
  keyPlaceholder: string;
  keyUrl: string;
  icon: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  description: string;
  descriptionAr: string;
  capabilities: AICapability[];
}

export const PROVIDER_METAS: Record<AIProviderType, ProviderMeta> = {
  gemini: {
    type: 'gemini',
    name: 'Google Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    defaultModels: ['gemini-3.8-flash', 'gemini-4-argon'],
    keyPlaceholder: 'AIzaSy...',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    icon: 'fa-brain',
    badgeBg: 'bg-sky-500/10',
    badgeBorder: 'border-sky-500/30',
    badgeText: 'text-sky-400',
    description: 'Fast multimodal reasoning by Google with thinking modes.',
    descriptionAr: 'ذكاء غوغل المتعدد الوسائط مع دعم أنماط التفكير وحل المسائل الهندسية.',
    capabilities: ['text', 'vision', 'audio', 'live', 'code']
  },
  openai: {
    type: 'openai',
    name: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModels: ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'o1'],
    keyPlaceholder: 'sk-proj-...',
    keyUrl: 'https://platform.openai.com/api-keys',
    icon: 'fa-circle-notch',
    badgeBg: 'bg-emerald-500/10',
    badgeBorder: 'border-emerald-500/30',
    badgeText: 'text-emerald-400',
    description: 'GPT-4o and o-series reasoning models by OpenAI.',
    descriptionAr: 'نماذج GPT-4o ونماذج التفكير o1 و o3-mini من أوبن إيه آي.',
    capabilities: ['text', 'vision', 'audio', 'code', 'reasoning']
  },
  claude: {
    type: 'claude',
    name: 'Anthropic Claude',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultModels: ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
    keyPlaceholder: 'sk-ant-api03-...',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    icon: 'fa-feather',
    badgeBg: 'bg-amber-500/10',
    badgeBorder: 'border-amber-500/30',
    badgeText: 'text-amber-400',
    description: 'Nuanced code, engineering mathematics and writing by Anthropic.',
    descriptionAr: 'نماذج كلود المتقدمة في البرمجة والتحليل والتفكير المنطقي وتحليل الرؤية.',
    capabilities: ['text', 'vision', 'code', 'reasoning']
  },
  groq: {
    type: 'groq',
    name: 'Groq (Ultra-Fast)',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    defaultModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'deepseek-r1-distill-llama-70b', 'mixtral-8x7b-32768'],
    keyPlaceholder: 'gsk_...',
    keyUrl: 'https://console.groq.com/keys',
    icon: 'fa-bolt',
    badgeBg: 'bg-orange-500/10',
    badgeBorder: 'border-orange-500/30',
    badgeText: 'text-orange-400',
    description: 'Lightning-speed LPU inference for open models (Llama 3.3, DeepSeek R1 Distill).',
    descriptionAr: 'سرعة استجابة فائقة لمعالجة النماذج المفتوحة مثل Llama 3.3 و DeepSeek Distill.',
    capabilities: ['text', 'code', 'reasoning']
  },
  deepseek: {
    type: 'deepseek',
    name: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com',
    defaultModels: ['deepseek-chat', 'deepseek-reasoner'],
    keyPlaceholder: 'sk-...',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    icon: 'fa-compass',
    badgeBg: 'bg-cyan-500/10',
    badgeBorder: 'border-cyan-500/30',
    badgeText: 'text-cyan-400',
    description: 'DeepSeek-V3 and DeepSeek-R1 math & STEM reasoning engine.',
    descriptionAr: 'محرك ديب سيك الشهير لحل المسائل الرياضية المعقدة والاستنتاج المنطقي.',
    capabilities: ['text', 'code', 'reasoning']
  },
  openrouter: {
    type: 'openrouter',
    name: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModels: [
      'deepseek/deepseek-r1',
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4o',
      'meta-llama/llama-3.3-70b-instruct',
      'google/gemini-2.0-flash-001'
    ],
    keyPlaceholder: 'sk-or-v1-...',
    keyUrl: 'https://openrouter.ai/keys',
    icon: 'fa-network-wired',
    badgeBg: 'bg-indigo-500/10',
    badgeBorder: 'border-indigo-500/30',
    badgeText: 'text-indigo-400',
    description: 'Universal gateway to 200+ AI models using a single unified key.',
    descriptionAr: 'بوابة موحدة للوصول لأكثر من 200 نموذج ذكاء اصطناعي بمفتاح واحد.',
    capabilities: ['text', 'vision', 'code', 'reasoning', 'image']
  },
  custom: {
    type: 'custom',
    name: 'Custom / Local (Ollama)',
    defaultBaseUrl: 'http://localhost:11434/v1',
    defaultModels: ['llama3.3', 'deepseek-r1', 'mistral', 'qwen2.5'],
    keyPlaceholder: 'ollama / custom_key',
    keyUrl: 'https://ollama.com',
    icon: 'fa-server',
    badgeBg: 'bg-purple-500/10',
    badgeBorder: 'border-purple-500/30',
    badgeText: 'text-purple-400',
    description: 'Any OpenAI-compatible server, vLLM, LM Studio, or local Ollama.',
    descriptionAr: 'أي خادم محلي أو خادم متوافق مع OpenAI مثل Ollama أو LM Studio أو vLLM.',
    capabilities: ['text', 'code']
  }
};

const STORAGE_KEY = 'mechengb_api_keys_v1';
const ACTIVE_MODEL_STORAGE_KEY = 'mechengb_active_model_v1';

// --- Storage Handlers ---

export const getStoredKeys = (): AIKeyConfig[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Default to built-in Gemini environment key if available
      const envKey = process.env.API_KEY || process.env.GEMINI_API_KEY || '';
      const defaultGemini: AIKeyConfig = {
        id: 'built-in-gemini',
        provider: 'gemini',
        label: 'Google AI Studio (Default)',
        apiKey: envKey,
        baseUrl: PROVIDER_METAS.gemini.defaultBaseUrl,
        selectedModel: 'gemini-3.8-flash',
        availableModels: PROVIDER_METAS.gemini.defaultModels,
        isEnabled: true,
        status: envKey ? 'connected' : 'untested'
      };
      return [defaultGemini];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Migrate any legacy/deprecated models
      return parsed.map(k => {
        if (k.provider === 'gemini') {
          const isDeprecated = !k.selectedModel || k.selectedModel.includes('2.5') || k.selectedModel.includes('2.0') || k.selectedModel.includes('1.5');
          return {
            ...k,
            selectedModel: isDeprecated ? 'gemini-3.8-flash' : k.selectedModel,
            availableModels: PROVIDER_METAS.gemini.defaultModels
          };
        }
        return k;
      });
    }
    return [];
  } catch (e) {
    console.error("Failed to read stored API keys:", e);
    return [];
  }
};

export const saveStoredKeys = (keys: AIKeyConfig[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch (e) {
    console.error("Failed to save API keys to localStorage:", e);
  }
};

export const getStoredActiveModel = (): ActiveModelSelection => {
  const keys = getStoredKeys();
  try {
    const raw = localStorage.getItem(ACTIVE_MODEL_STORAGE_KEY);
    if (raw) {
      const parsed: ActiveModelSelection = JSON.parse(raw);
      if (parsed.provider === 'gemini' && (parsed.modelId.includes('2.5') || parsed.modelId.includes('2.0') || parsed.modelId.includes('1.5'))) {
        parsed.modelId = 'gemini-3.8-flash';
        parsed.displayName = 'Google Gemini (gemini-3.8-flash)';
        saveStoredActiveModel(parsed);
      }

      // Check if the key still exists and has an active API key
      const keyConfig = keys.find(k => k.id === parsed.keyId && k.isEnabled);
      const isKeyAuthenticated = keyConfig && (
        keyConfig.id === 'built-in-gemini' || 
        Boolean(keyConfig.apiKey?.trim()) || 
        (keyConfig.provider === 'custom' && Boolean(keyConfig.baseUrl?.trim()))
      );

      if (isKeyAuthenticated) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to read active model:", e);
  }
  
  // Fallback to first authenticated key
  const firstAuth = keys.find(k => 
    k.isEnabled && (k.id === 'built-in-gemini' || Boolean(k.apiKey?.trim()) || (k.provider === 'custom' && Boolean(k.baseUrl?.trim())))
  );
  if (firstAuth) {
    const fallbackModel = (firstAuth.provider === 'gemini' && (!firstAuth.selectedModel || firstAuth.selectedModel.includes('2.5') || firstAuth.selectedModel.includes('2.0') || firstAuth.selectedModel.includes('1.5')))
      ? 'gemini-3.8-flash'
      : (firstAuth.selectedModel || 'gemini-3.8-flash');
    return {
      keyId: firstAuth.id,
      provider: firstAuth.provider,
      modelId: fallbackModel,
      displayName: `${PROVIDER_METAS[firstAuth.provider]?.name || firstAuth.provider} (${fallbackModel})`
    };
  }

  return {
    keyId: 'built-in-gemini',
    provider: 'gemini',
    modelId: 'gemini-3.8-flash',
    displayName: 'Google Gemini (gemini-3.8-flash)'
  };
};

export const saveStoredActiveModel = (selection: ActiveModelSelection) => {
  try {
    localStorage.setItem(ACTIVE_MODEL_STORAGE_KEY, JSON.stringify(selection));
  } catch (e) {
    console.error("Failed to save active model:", e);
  }
};

// --- Connection Diagnostics & Testing ---

export const testConnection = async (
  config: AIKeyConfig
): Promise<{ success: boolean; message: string; latencyMs: number }> => {
  const startTime = performance.now();
  const provider = config.provider;
  const key = config.apiKey?.trim();
  const baseUrl = config.baseUrl?.trim() || PROVIDER_METAS[provider].defaultBaseUrl;
  const model = config.selectedModel?.trim() || PROVIDER_METAS[provider].defaultModels[0];

  if (!key && provider !== 'custom') {
    return {
      success: false,
      message: 'API Key cannot be empty. Please enter your API key.',
      latencyMs: 0
    };
  }

  try {
    if (provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey: key });
      const testRes = await ai.models.generateContent({
        model: model || 'gemini-3.8-flash',
        contents: 'Test connection. Reply with: OK',
      });
      const latency = Math.round(performance.now() - startTime);
      if (testRes.text) {
        return {
          success: true,
          message: `Successfully connected to Gemini! Model ${model} responded in ${latency}ms.`,
          latencyMs: latency
        };
      }
      throw new Error("No response received from Gemini.");
    } 
    
    if (provider === 'claude') {
      const cleanBase = baseUrl.replace(/\/+$/, '');
      const endpoint = cleanBase.endsWith('/v1') ? `${cleanBase}/messages` : `${cleanBase}/v1/messages`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: model || 'claude-3-5-haiku-20241022',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Ping' }]
        })
      });

      const latency = Math.round(performance.now() - startTime);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
        return {
          success: false,
          message: `Claude connection failed: ${msg}`,
          latencyMs: latency
        };
      }

      return {
        success: true,
        message: `Successfully paired with Anthropic Claude (${model}) in ${latency}ms!`,
        latencyMs: latency
      };
    }

    // OpenAI and OpenAI-Compatible (Groq, DeepSeek, OpenRouter, Custom)
    let cleanBase = baseUrl.replace(/\/+$/, '');
    let endpoint = cleanBase;
    if (!endpoint.endsWith('/chat/completions')) {
      if (endpoint.endsWith('/v1')) {
        endpoint = `${endpoint}/chat/completions`;
      } else {
        endpoint = `${endpoint}/chat/completions`;
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (key) {
      headers['Authorization'] = `Bearer ${key}`;
    }
    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = window.location.origin;
      headers['X-Title'] = 'MechEng Omni-Bot';
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Ping test' }],
        max_tokens: 10
      })
    });

    const latency = Math.round(performance.now() - startTime);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      return {
        success: false,
        message: `${PROVIDER_METAS[provider].name} error: ${msg}`,
        latencyMs: latency
      };
    }

    return {
      success: true,
      message: `Successfully paired with ${PROVIDER_METAS[provider].name} (${model}) in ${latency}ms!`,
      latencyMs: latency
    };
  } catch (err: any) {
    const latency = Math.round(performance.now() - startTime);
    const errText = err?.message || String(err);
    let advice = "";
    if (errText.includes("Failed to fetch") || errText.includes("NetworkError") || errText.includes("CORS")) {
      advice = " (Note: Check CORS settings on custom endpoints, or confirm network connectivity.)";
    }
    return {
      success: false,
      message: `Connection failed: ${errText}${advice}`,
      latencyMs: latency
    };
  }
};

// --- Universal Model Query Dispatcher ---

export const generateUniversalResponse = async (
  prompt: string,
  attachment: Attachment | null,
  activeSelection: ActiveModelSelection,
  config: AIKeyConfig,
  language: Language,
  responseLength: ResponseLengthLevel | boolean,
  deepThink: boolean | ReasoningEffortLevel,
  mode: AppMode
): Promise<{ text: string; modelName: string; provider: AIProviderType }> => {
  const provider = config.provider;
  const key = config.apiKey?.trim();
  const baseUrl = config.baseUrl?.trim() || PROVIDER_METAS[provider].defaultBaseUrl;
  const modelId = activeSelection.modelId || config.selectedModel || PROVIDER_METAS[provider].defaultModels[0];

  const reasoningLevel: ReasoningEffortLevel = typeof deepThink === 'string'
    ? deepThink
    : (deepThink ? 'high' : 'off');

  const lengthLevel: ResponseLengthLevel = typeof responseLength === 'string'
    ? responseLength
    : (responseLength ? 'short' : 'standard');

  const engineParams = calculateEngineParameters(provider, modelId, reasoningLevel, lengthLevel);

  // Augment prompt with chain-of-thought and length directives if needed
  let effectivePrompt = prompt;
  if (engineParams.cotInstruction) {
    effectivePrompt += engineParams.cotInstruction;
  }
  if (engineParams.lengthInstruction) {
    effectivePrompt += `\n\n[RESPONSE REQUIREMENT: ${engineParams.lengthInstruction}]`;
  }

  // 1. Google Gemini Provider
  if (provider === 'gemini') {
    const geminiKey = key || process.env.API_KEY || process.env.GEMINI_API_KEY || '';
    if (!geminiKey) {
      throw new Error("No Gemini API Key provided. Please add your Gemini key in the API Settings.");
    }
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const parts: any[] = [];

    if (attachment) {
      if (attachment.type === 'image' || attachment.type === 'video' || attachment.type === 'audio' || attachment.mimeType === 'application/pdf') {
        parts.push({
          inlineData: {
            mimeType: attachment.mimeType,
            data: attachment.data
          }
        });
      } else if (attachment.type === 'text') {
        try {
          const textContent = atob(attachment.data);
          parts.push({ text: `[${attachment.name}]:\n${textContent}` });
        } catch {
          parts.push({ text: `[${attachment.name}]` });
        }
      }
    }
    parts.push({ text: effectivePrompt });

    const genConfig: any = {
      maxOutputTokens: engineParams.maxOutputTokens,
      temperature: engineParams.temperature,
    };

    if (engineParams.ceilings.supportsNativeThinking) {
      genConfig.thinkingConfig = { thinkingBudget: engineParams.thinkingBudget };
    }

    let modelToUse = modelId;
    if (!modelToUse || modelToUse.includes('2.5') || modelToUse.includes('2.0') || modelToUse.includes('1.5')) {
      modelToUse = 'gemini-3.8-flash';
    }

    let response: any;
    try {
      response = await ai.models.generateContent({
        model: modelToUse,
        contents: { parts },
        config: genConfig
      });
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if ((errMsg.includes('404') || errMsg.includes('NOT_FOUND') || err?.status === 404) && modelToUse !== 'gemini-3.8-flash') {
        console.warn(`Gemini model ${modelToUse} returned 404, falling back to gemini-3.8-flash...`, err);
        modelToUse = 'gemini-3.8-flash';
        response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: { parts },
          config: genConfig
        });
      } else if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota')) {
        return {
          text: `⚠️ **Rate Limit Notice (429: Quota Exceeded)**\n\nThe free Gemini API request quota has temporarily been reached. Please wait a short moment before trying again, or configure your own Gemini API key in **API Keys Settings** (⚙️ top right) for dedicated unlimited quota.`,
          modelName: modelToUse,
          provider: 'gemini'
        };
      } else {
        throw err;
      }
    }

    return {
      text: response.text || "No response received.",
      modelName: modelToUse,
      provider: 'gemini'
    };
  }

  // 2. Anthropic Claude Provider
  if (provider === 'claude') {
    if (!key) {
      throw new Error("Anthropic Claude API Key is required. Please set your API key in API Settings.");
    }

    const cleanBase = baseUrl.replace(/\/+$/, '');
    const endpoint = cleanBase.endsWith('/v1') ? `${cleanBase}/messages` : `${cleanBase}/v1/messages`;

    // Construct Claude message contents
    const contentParts: any[] = [];
    if (attachment) {
      if (attachment.type === 'image') {
        contentParts.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: attachment.mimeType,
            data: attachment.data
          }
        });
      } else if (attachment.type === 'text') {
        try {
          const textContent = atob(attachment.data);
          contentParts.push({
            type: 'text',
            text: `[${attachment.name}]:\n${textContent}`
          });
        } catch {
          contentParts.push({ type: 'text', text: `[${attachment.name}]` });
        }
      }
    }
    contentParts.push({ type: 'text', text: effectivePrompt });

    const claudePayload: any = {
      model: modelId,
      max_tokens: engineParams.maxOutputTokens,
      temperature: engineParams.temperature,
      messages: [
        { role: 'user', content: contentParts }
      ]
    };

    // Claude 3.7 native thinking mode
    if (engineParams.ceilings.thinkingEngine === 'claude_37' && engineParams.thinkingBudget > 0) {
      claudePayload.thinking = {
        type: 'enabled',
        budget_tokens: Math.min(engineParams.thinkingBudget, 64000)
      };
      claudePayload.temperature = 1.0;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(claudePayload)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Claude returned status ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const textOut = data.content?.map((c: any) => c.text || '').join('\n') || '';
    return {
      text: textOut,
      modelName: modelId,
      provider: 'claude'
    };
  }

  // 3. OpenAI & OpenAI-Compatible (Groq, DeepSeek, OpenRouter, Custom)
  let cleanBase = baseUrl.replace(/\/+$/, '');
  let endpoint = cleanBase;
  if (!endpoint.endsWith('/chat/completions')) {
    if (endpoint.endsWith('/v1')) {
      endpoint = `${endpoint}/chat/completions`;
    } else {
      endpoint = `${endpoint}/chat/completions`;
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (key) {
    headers['Authorization'] = `Bearer ${key}`;
  }
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = window.location.origin;
    headers['X-Title'] = 'MechEng Omni-Bot';
  }

  // Build OpenAI user message content (supports vision or text)
  let userContent: any;
  if (attachment && attachment.type === 'image') {
    userContent = [
      {
        type: 'text',
        text: effectivePrompt
      },
      {
        type: 'image_url',
        image_url: {
          url: `data:${attachment.mimeType};base64,${attachment.data}`
        }
      }
    ];
  } else if (attachment && attachment.type === 'text') {
    let attachedText = "";
    try {
      attachedText = atob(attachment.data);
    } catch {
      attachedText = `[${attachment.name}]`;
    }
    userContent = `${attachedText}\n\n${effectivePrompt}`;
  } else if (attachment) {
    userContent = `${effectivePrompt}`;
  } else {
    userContent = effectivePrompt;
  }

  const messages = [
    { role: 'user', content: userContent }
  ];

  const bodyPayload: any = {
    model: modelId,
    messages,
    max_tokens: engineParams.maxOutputTokens,
  };

  const isReasoningModel = modelId.startsWith('o1') || modelId.startsWith('o3') || modelId.includes('reasoner');
  if (isReasoningModel) {
    if (engineParams.reasoningEffort) {
      bodyPayload.reasoning_effort = engineParams.reasoningEffort;
    }
    // Some o1/o3 models require max_completion_tokens instead of max_tokens
    bodyPayload.max_completion_tokens = engineParams.maxOutputTokens;
  } else {
    bodyPayload.temperature = engineParams.temperature;
    bodyPayload.top_p = engineParams.topP;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(bodyPayload)
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    const message = errorJson.error?.message || `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(`${PROVIDER_METAS[provider]?.name || provider} Error: ${message}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  const outputText = choice?.message?.content || choice?.text || "No response generated.";

  return {
    text: outputText,
    modelName: modelId,
    provider
  };
};

// --- Image Model Options & Universal Dispatcher ---

export interface ImageModelOption {
  keyId: string;
  provider: AIProviderType;
  modelId: string;
  displayName: string;
  badge: string;
  supportsImages: boolean;
  unsupportedReason?: string;
  requiresKey?: boolean;
}

export const getImageModelOptions = (keys: AIKeyConfig[]): ImageModelOption[] => {
  const options: ImageModelOption[] = [];

  // 1. Free Engine (Works without any API key - Nano Banana / Pollinations Flux)
  options.push({
    keyId: 'free-banana',
    provider: 'gemini',
    modelId: 'nano-banana-free',
    displayName: 'Nano Banana (Free · No API Key)',
    badge: 'Nano Banana (Free)',
    supportsImages: true,
    requiresKey: false
  });

  // 2. User-configured keys: ONLY inspect enabled keys that actually have an API key (or custom endpoint)
  const authenticatedKeys = keys.filter(k => 
    k.isEnabled && (
      (k.apiKey && k.apiKey.trim().length > 0) || 
      (k.provider === 'custom' && k.baseUrl && k.baseUrl.trim().length > 0)
    )
  );

  authenticatedKeys.forEach(k => {
    // If user provided a custom Gemini API Key:
    if (k.provider === 'gemini') {
      options.push({
        keyId: k.id,
        provider: 'gemini',
        modelId: 'gemini-3.1-flash-lite-image',
        displayName: `${k.label || 'Google Gemini'} · Flash Lite Image (Fast)`,
        badge: 'Gemini Lite',
        supportsImages: true
      });
      options.push({
        keyId: k.id,
        provider: 'gemini',
        modelId: 'gemini-nano-banana-2.1',
        displayName: `${k.label || 'Google Gemini'} · Nano Banana 2.1 (2K/4K Pro)`,
        badge: 'Nano Banana 2.1',
        supportsImages: true
      });
      options.push({
        keyId: k.id,
        provider: 'gemini',
        modelId: 'gemini-3-pro-image',
        displayName: `${k.label || 'Google Gemini'} · Pro Image Studio (Ultra HD)`,
        badge: 'Gemini Pro',
        supportsImages: true
      });
    } else if (k.provider === 'openai') {
      options.push({
        keyId: k.id,
        provider: 'openai',
        modelId: 'dall-e-3',
        displayName: `${k.label || 'OpenAI'} · DALL-E 3 (HD Quality)`,
        badge: 'DALL-E 3',
        supportsImages: true
      });
      options.push({
        keyId: k.id,
        provider: 'openai',
        modelId: 'dall-e-2',
        displayName: `${k.label || 'OpenAI'} · DALL-E 2`,
        badge: 'DALL-E 2',
        supportsImages: true
      });
    } else if (k.provider === 'openrouter') {
      options.push({
        keyId: k.id,
        provider: 'openrouter',
        modelId: 'black-forest-labs/flux-1-schnell',
        displayName: `${k.label || 'OpenRouter'} · Flux.1 Schnell`,
        badge: 'Flux.1',
        supportsImages: true
      });
      options.push({
        keyId: k.id,
        provider: 'openrouter',
        modelId: 'stabilityai/stable-diffusion-xl-base-1.0',
        displayName: `${k.label || 'OpenRouter'} · SDXL Base 1.0`,
        badge: 'SDXL',
        supportsImages: true
      });
    } else {
      // For any custom or other provider: check if the model supports image generation
      const models = Array.from(new Set([k.selectedModel, ...(k.availableModels || [])])).filter(Boolean);
      models.forEach(m => {
        const caps = detectModelCapabilities(k.provider, m);
        if (caps.includes('image')) {
          const meta = PROVIDER_METAS[k.provider] || PROVIDER_METAS.custom;
          options.push({
            keyId: k.id,
            provider: k.provider,
            modelId: m,
            displayName: `${k.label || meta.name} · ${m}`,
            badge: 'Image Gen',
            supportsImages: true
          });
        }
      });
    }
  });

  return options;
};

export const generateImageUniversal = async (
  prompt: string,
  config: ImageGenConfig,
  targetImageModel: { keyId: string; provider: AIProviderType; modelId: string },
  keys: AIKeyConfig[]
): Promise<{ url: string | null; providerName: string; provider: AIProviderType }> => {
  // 0. Free Nano Banana Engine (Requires no API key at all)
  if (targetImageModel.modelId === 'nano-banana-free' || targetImageModel.keyId === 'free-banana') {
    const seed = Math.floor(Math.random() * 10000000);
    const sizeMap: Record<string, { w: number; h: number }> = {
      '1:1': { w: 1024, h: 1024 },
      '16:9': { w: 1280, h: 720 },
      '9:16': { w: 720, h: 1280 },
      '4:3': { w: 1024, h: 768 },
      '3:4': { w: 768, h: 1024 },
    };
    const dims = sizeMap[config.aspectRatio] || { w: 1024, h: 1024 };
    const encodedPrompt = encodeURIComponent(prompt);
    const freeUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${dims.w}&height=${dims.h}&nologo=true&seed=${seed}&model=flux`;
    
    return {
      url: freeUrl,
      providerName: 'Nano Banana (Free Engine · Flux)',
      provider: 'gemini'
    };
  }

  const keyConfig = keys.find(k => k.id === targetImageModel.keyId);

  // 1. OpenAI DALL-E
  if (targetImageModel.provider === 'openai') {
    const key = keyConfig?.apiKey?.trim();
    if (!key) {
      throw new Error("OpenAI API key missing. Please enter your key in API Settings first.");
    }
    const sizeMap: Record<string, string> = {
      '1:1': '1024x1024',
      '16:9': '1792x1024',
      '9:16': '1024x1792',
      '3:4': '1024x1024',
      '4:3': '1024x1024'
    };
    const size = sizeMap[config.aspectRatio] || '1024x1024';
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: targetImageModel.modelId || 'dall-e-3',
        prompt,
        n: 1,
        size
      })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to generate image with OpenAI DALL-E (${response.status})`);
    }
    const data = await response.json();
    return {
      url: data.data?.[0]?.url || null,
      providerName: `OpenAI ${targetImageModel.modelId || 'dall-e-3'}`,
      provider: 'openai'
    };
  }

  // 2. OpenRouter Image Models
  if (targetImageModel.provider === 'openrouter') {
    const key = keyConfig?.apiKey?.trim();
    if (!key) {
      throw new Error("OpenRouter API key missing. Please enter your key in API Settings first.");
    }
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'MechEng Omni-Bot'
      },
      body: JSON.stringify({
        model: targetImageModel.modelId,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to connect to OpenRouter (${response.status})`);
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const mdMatch = content.match(/!\[.*?\]\((https?:\/\/[^\s\)]+)\)/);
    const urlMatch = content.match(/https?:\/\/[^\s"')]+/);
    const dataUriMatch = content.match(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/);
    const imageUrl = mdMatch ? mdMatch[1] : (urlMatch ? urlMatch[0] : (dataUriMatch ? dataUriMatch[0] : null));
    return {
      url: imageUrl || (data.images?.[0]?.url ?? null),
      providerName: `OpenRouter (${targetImageModel.modelId})`,
      provider: 'openrouter'
    };
  }

  // 3. Gemini Image Models (Nano Banana 2.1, Flash Lite Image, Pro Image)
  const geminiKey = keyConfig?.apiKey?.trim() || process.env.API_KEY || process.env.GEMINI_API_KEY || '';
  if (!geminiKey) {
    throw new Error("Gemini API key missing. Please enter it in API Settings or select 'Nano Banana (Free)' to generate without a key.");
  }
  const ai = new GoogleGenAI({ apiKey: geminiKey });
  const modelToUse = targetImageModel.modelId || 'gemini-3.1-flash-lite-image';

  try {
    const isNanoBanana = modelToUse === 'gemini-nano-banana-2.1' || modelToUse === 'gemini-3-pro-image';
    const genConfig: any = {
      imageConfig: {
        aspectRatio: config.aspectRatio || '1:1'
      }
    };
    if (isNanoBanana && (config.imageSize === '2K' || config.imageSize === '4K')) {
      genConfig.imageConfig.imageSize = config.imageSize;
    }

    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: { parts: [{ text: prompt }] },
      config: genConfig
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return {
          url: `data:image/png;base64,${part.inlineData.data}`,
          providerName: `Google Gemini (${modelToUse})`,
          provider: 'gemini'
        };
      }
    }
  } catch (err: any) {
    console.warn(`Model ${modelToUse} failed, attempting resilient fallback...`, err);
    
    // If nano-banana-2.1 or pro fails, try flash lite image
    if (modelToUse !== 'gemini-3.1-flash-lite-image') {
      try {
        const fallbackRes = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-image',
          contents: { parts: [{ text: prompt }] },
          config: { imageConfig: { aspectRatio: config.aspectRatio || '1:1' } }
        });
        for (const part of fallbackRes.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            return {
              url: `data:image/png;base64,${part.inlineData.data}`,
              providerName: `Google Gemini (gemini-3.1-flash-lite-image)`,
              provider: 'gemini'
            };
          }
        }
      } catch (fbErr: any) {
        console.warn("Fallback to flash lite image also failed:", fbErr);
      }
    }

    const errMsg = err?.message || String(err);
    if (errMsg.includes('404') || errMsg.includes('NOT_FOUND') || errMsg.includes('Requested entity was not found')) {
      throw new Error(`Model ${modelToUse} requires a paid API key or billing project in Google AI Studio. Switch to "Nano Banana (Free)" to generate immediately with no key required.`);
    }
    throw err;
  }

  return {
    url: null,
    providerName: `Google Gemini (${modelToUse})`,
    provider: 'gemini'
  };
};


