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
  ResponseLengthLevel,
  SearchEngineConfig,
  SearchEngineKey,
  DEFAULT_SEARCH_ENGINE_CONFIG,
  SEARCH_ENGINE_MODELS
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
    'gemini-flash-latest': ['text', 'vision', 'audio', 'code', 'reasoning'],
    'gemini-3.8-flash': ['text', 'vision', 'audio', 'code', 'reasoning'],
    'gemini-pro-latest': ['text', 'vision', 'audio', 'code', 'reasoning'],
    'gemini-4-argon': ['text', 'vision', 'code', 'reasoning'],
    'gemini-2.5-flash': ['text', 'vision', 'audio', 'code'],
    'gemini-2.5-pro': ['text', 'vision', 'audio', 'code', 'reasoning'],
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
    defaultModels: ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-pro-latest'],
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

/**
 * Computes the instance number and display tag for a model instance when duplicate model IDs exist across keys.
 * If multiple keys share the same modelId, attaches `#1`, `#2`, etc.
 */
export function getModelInstanceInfo(
  keyId: string,
  modelId: string,
  keys: AIKeyConfig[]
): { instanceNumber: number; totalInstances: number; tag: string; numberedTitle: string } {
  const cleanModel = (modelId || '').trim().toLowerCase();
  const matching = (keys || []).filter(k => 
    (k.selectedModel || '').trim().toLowerCase() === cleanModel
  );
  if (matching.length <= 1) {
    return { 
      instanceNumber: 1, 
      totalInstances: matching.length, 
      tag: '', 
      numberedTitle: modelId 
    };
  }
  const index = matching.findIndex(k => k.id === keyId);
  const num = index >= 0 ? index + 1 : matching.length;
  return {
    instanceNumber: num,
    totalInstances: matching.length,
    tag: `#${num}`,
    numberedTitle: `${modelId} #${num}`
  };
}

/**
 * Returns the total number of API keys configured for a specific model ID across the pool.
 */
export function getModelTotalApiCount(
  modelId: string,
  keys: AIKeyConfig[]
): number {
  const cleanModel = (modelId || '').trim().toLowerCase();
  return (keys || []).filter(k => 
    (k.selectedModel || '').trim().toLowerCase() === cleanModel
  ).length;
}

/**
 * Returns the count and list of active/connected API keys for a specific model ID.
 */
export function getModelConnectedApiCount(
  modelId: string,
  keys: AIKeyConfig[]
): { count: number; activeKeys: AIKeyConfig[] } {
  const cleanModel = (modelId || '').trim().toLowerCase();
  const matching = (keys || []).filter(k => 
    (k.selectedModel || '').trim().toLowerCase() === cleanModel &&
    Boolean(
      (k.apiKey && k.apiKey.trim().length > 0) || 
      k.id === 'built-in-gemini' || 
      (k.provider === 'custom' && k.baseUrl && k.baseUrl.trim().length > 0)
    )
  );
  return {
    count: matching.length,
    activeKeys: matching
  };
}

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
        selectedModel: 'gemini-flash-latest',
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
            selectedModel: isDeprecated ? 'gemini-flash-latest' : k.selectedModel,
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
        parsed.modelId = 'gemini-flash-latest';
        parsed.displayName = 'Google Gemini (gemini-flash-latest)';
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
      ? 'gemini-flash-latest'
      : (firstAuth.selectedModel || 'gemini-flash-latest');
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
    modelId: 'gemini-flash-latest',
    displayName: 'Google Gemini (gemini-flash-latest)'
  };
};

export const saveStoredActiveModel = (selection: ActiveModelSelection) => {
  try {
    localStorage.setItem(ACTIVE_MODEL_STORAGE_KEY, JSON.stringify(selection));
  } catch (e) {
    console.error("Failed to save active model:", e);
  }
};

const SEARCH_ENGINE_STORAGE_KEY = 'mechengb_search_engine_v1';

export const getStoredSearchEngineConfig = (): SearchEngineConfig => {
  try {
    const raw = localStorage.getItem(SEARCH_ENGINE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      let targetModel = parsed.modelId || 'gemini-flash-latest';
      if (targetModel.includes('2.5') || targetModel.includes('2.0') || targetModel.includes('1.5')) {
        targetModel = 'gemini-flash-latest';
      }
      return {
        enabled: parsed.enabled ?? true,
        modelId: targetModel,
        apiKeys: Array.isArray(parsed.apiKeys) ? parsed.apiKeys : [],
        activeKeyIndex: typeof parsed.activeKeyIndex === 'number' ? parsed.activeKeyIndex : 0
      };
    }
  } catch (e) {
    console.error("Failed to read search engine config:", e);
  }
  return DEFAULT_SEARCH_ENGINE_CONFIG;
};


export const saveStoredSearchEngineConfig = (config: SearchEngineConfig) => {
  try {
    localStorage.setItem(SEARCH_ENGINE_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error("Failed to save search engine config:", e);
  }
};

export function maskApiKey(key?: string): string {
  if (!key) return 'None';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return trimmed;
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}

export function getAllKeysForModel(modelId: string, keys: AIKeyConfig[]): AIKeyConfig[] {
  const clean = (modelId || '').trim().toLowerCase();
  return (keys || []).filter(k => (k.selectedModel || '').trim().toLowerCase() === clean && k.isEnabled);
}


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

export interface UniversalAIResponse {
  text: string;
  modelName: string;
  provider: AIProviderType;
  searchSources?: Array<{ title: string; uri: string }>;
  searchQueries?: string[];
  isQuotaExceeded?: boolean;
  failedKeyId?: string;
  failedProvider?: AIProviderType;
}

/**
 * Strips any leaked model self-introductions, first-person declarations, time announcements,
 * or conversational greetings from background search results.
 * Guarantees that only objective 3rd-person factual intelligence reaches the selected model.
 */
export function sanitizeSearchDossier(rawText: string): string {
  if (!rawText) return "";

  let cleaned = rawText;

  // 1. Remove Arabic self-identifications & developer declarations
  // e.g. "أنا نموذج الذكاء الاصطناعي Gemini 2.5 Flash من تطوير Google DeepMind..."
  // e.g. "بصفتي نموذج ذكاء اصطناعي تم تطويري بواسطة Google..."
  cleaned = cleaned.replace(/(?:^|\n)\s*(?:أنا\s+(?:نموذج|موديل|ذكاء\s+اصطناعي|Gemini|جيميناي)[^\n.]+?(?:من\s+تطوير|بواسطة|Google|DeepMind)?[^\n.]*?[.!\n])/gi, '\n');
  cleaned = cleaned.replace(/(?:^|\n)\s*(?:بصفتي\s+(?:نموذج|ذكاء\s+اصطناعي)[^\n.]*?[.!\n])/gi, '\n');
  cleaned = cleaned.replace(/(?:^|\n)\s*(?:تم\s+تطويري\s+بواسطة\s+(?:Google|جوجل|DeepMind)[^\n.]*?[.!\n])/gi, '\n');

  // 2. Remove Arabic local time / clock readings
  // e.g. "الساعة الآن في مصر هي 10:01 مساءً."
  cleaned = cleaned.replace(/(?:^|\n)\s*(?:الساعة\s+الآن\s+(?:في\s+)?[^\n.]*?[.!\n])/gi, '\n');
  cleaned = cleaned.replace(/(?:^|\n)\s*(?:التوقيت\s+الحالي\s+(?:هو\s+|في\s+)?[^\n.]*?[.!\n])/gi, '\n');
  cleaned = cleaned.replace(/(?:^|\n)\s*(?:الوقت\s+الحالي\s+(?:هو\s+|في\s+)?[^\n.]*?[.!\n])/gi, '\n');

  // 3. Remove English self-identifications & developer declarations
  // e.g. "I am Gemini, an AI model developed by Google..."
  // e.g. "As an AI language model trained by Google..."
  cleaned = cleaned.replace(/(?:^|\n)\s*(?:I\s+am\s+(?:Gemini|a\s+large\s+language\s+model|an\s+AI\s+model)[^\n.]*?(?:developed\s+by\s+Google|Google\s+DeepMind)?[^\n.]*?[.!\n])/gi, '\n');
  cleaned = cleaned.replace(/(?:^|\n)\s*(?:As\s+(?:an?\s+AI(?:\s+model)?|Gemini|a\s+language\s+model)[^,\n]*?[,.]\s*)/gi, '\n');

  // 4. Remove English local time / clock announcements
  cleaned = cleaned.replace(/(?:^|\n)\s*(?:(?:The\s+)?current\s+time\s+(?:is|in)[^\n.]*?[.!\n])/gi, '\n');
  cleaned = cleaned.replace(/(?:^|\n)\s*(?:(?:The\s+)?local\s+time\s+(?:is|in)[^\n.]*?[.!\n])/gi, '\n');

  // 5. Remove conversational preambles/pleasantries at beginning
  cleaned = cleaned.replace(/^\s*(?:مرحباً|أهلاً\s+بك|أهلاً\s+وسهلاً|بالتأكيد|إليك\s+المعلومات|Hello!|Hi there!|Sure!|Certainly!)[!،.,:\s]+/i, '');

  return cleaned.trim();
}

/**
 * Ensures the final output from non-Gemini models does not retain any rogue Gemini self-declarations
 * that may have leaked past model generation.
 */
export function sanitizeModelOutput(text: string, provider: AIProviderType, modelId: string): string {
  if (!text) return "";
  if (provider === 'gemini') return text; // If user deliberately asked Gemini, keep original output

  let sanitized = text;

  // If a non-Gemini model (e.g. GPT-4o, Claude) begins its response claiming to be Gemini or Google:
  // Strip the hallucinated self-introduction line
  sanitized = sanitized.replace(/^\s*(?:أنا\s+نموذج\s+(?:الذكاء\s+الاصطناعي\s+)?(?:\*\*)?(?:Gemini|جيميناي)[^\n.]*?(?:Google|DeepMind)?[^\n.]*?[.!\n]+\s*)/i, '');
  sanitized = sanitized.replace(/^\s*(?:I\s+am\s+(?:the\s+)?(?:\*\*)?Gemini[^\n.]*?(?:Google|DeepMind)?[^\n.]*?[.!\n]+\s*)/i, '');
  // Strip leading clock readings if present at the very beginning of the response:
  sanitized = sanitized.replace(/^\s*(?:الساعة\s+الآن\s+في\s+[^\n.]*?[.!\n]+\s*)/i, '');
  sanitized = sanitized.replace(/^\s*(?:The\s+current\s+time\s+in\s+[^\n.]*?[.!\n]+\s*)/i, '');

  return sanitized.trim();
}

/**
 * Exhaustive Deep Web Research Agent powered by Google Search Grounding.
 * Conducts real-time factual reconnaissance for non-Gemini models (Claude, OpenAI, Groq, DeepSeek, OpenRouter),
 * ensuring the selected model has complete, verified online intelligence, statistics, and citations.
 */
export async function executeDeepWebResearch(
  prompt: string,
  searchUrls?: string[],
  fallbackKey?: string,
  searchConfig?: SearchEngineConfig,
  additionalCandidateKeys?: string[]
): Promise<{
  researchDossier: string;
  sources: Array<{ title: string; uri: string }>;
  queries: string[];
}> {
  const sources: Array<{ title: string; uri: string }> = [];
  let queries: string[] = [];
  let researchDossier = "";

  // 1. Gather all candidate API keys in prioritized order:
  // - First: Keys from dedicated SearchEngineConfig (starting from activeKeyIndex)
  // - Second: fallbackKey (from user's Gemini key in model keys)
  // - Third: additionalCandidateKeys
  // - Fourth: process.env.API_KEY or process.env.GEMINI_API_KEY
  const candidateKeys: string[] = [];

  if (searchConfig && Array.isArray(searchConfig.apiKeys) && searchConfig.apiKeys.length > 0) {
    const activeIdx = Math.max(0, Math.min(searchConfig.activeKeyIndex || 0, searchConfig.apiKeys.length - 1));
    const activeKey = searchConfig.apiKeys[activeIdx]?.key?.trim();
    if (activeKey) candidateKeys.push(activeKey);

    // Add remaining search keys
    searchConfig.apiKeys.forEach((k, idx) => {
      if (idx !== activeIdx && k.key?.trim()) {
        candidateKeys.push(k.key.trim());
      }
    });
  }

  if (fallbackKey && fallbackKey.trim()) {
    candidateKeys.push(fallbackKey.trim());
  }

  if (additionalCandidateKeys && Array.isArray(additionalCandidateKeys)) {
    additionalCandidateKeys.forEach(k => {
      if (k && k.trim() && !candidateKeys.includes(k.trim())) {
        candidateKeys.push(k.trim());
      }
    });
  }

  const envKey = (typeof process !== 'undefined' ? (process.env.API_KEY || process.env.GEMINI_API_KEY) : '') || '';
  if (envKey && !candidateKeys.includes(envKey)) {
    candidateKeys.push(envKey);
  }

  // De-duplicate candidate keys while preserving order
  const uniqueCandidateKeys = Array.from(new Set(candidateKeys)).filter(Boolean);

  if (uniqueCandidateKeys.length === 0) {
    console.warn("Deep Web Research agent: No Gemini API key available for Google grounding reconnaissance.");
    return { 
      researchDossier: "\n\n[NOTICE: Real-time web search requires an API key in API Settings > Search Engine. Proceeding with internal knowledge base.]\n", 
      sources: [], 
      queries: [] 
    };
  }

  // Determine model to use for search reconnaissance
  const preferredSearchModel = (searchConfig?.modelId?.trim() && !searchConfig.modelId.includes('2.5') && !searchConfig.modelId.includes('2.0') && !searchConfig.modelId.includes('1.5'))
    ? searchConfig.modelId.trim()
    : 'gemini-flash-latest';
  const modelsToTry = [
    preferredSearchModel,
    'gemini-flash-latest',
    'gemini-3.8-flash',
    'gemini-pro-latest'
  ];
  const uniqueModelsToTry = Array.from(new Set(modelsToTry));

  const targetFocus = searchUrls && searchUrls.length > 0
    ? `\nPrioritize factual extraction from these specific sources: ${searchUrls.join(', ')}`
    : '';

  const now = new Date();
  const temporalContext = `Current Real-World System Time: ${now.toUTCString()} (Local: ${now.toLocaleString()})`;

  const researchPrompt = `<search_reconnaissance_directive>
<objective>
Execute an exhaustive, uncompressed Google Search reconnaissance to harvest 3rd-person factual intelligence, complete article content, official documentation, verified technical specs, benchmarks, and real-time data to answer:
"${prompt}"
</objective>

<temporal_grounding>
${temporalContext}
Ensure that any questions regarding current events, release status, temporal milestones, or version availability are strictly anchored to this timeline.
</temporal_grounding>
${targetFocus ? `<priority_sources>\n${targetFocus}\n</priority_sources>` : ''}

<exhaustive_harvesting_rules>
1. FULL-CONTENT EXTRACTION: Do NOT summarize, compress, or shorten data. If relevant articles, documentation, benchmark tables, or news reports exist, synthesize and embed their full technical substance directly into this single dossier.
2. ZERO INFORMATION LOSS: The receiving reasoning model will NOT have internet access; it relies 100% on this message as its total ground truth. Include all versions, metrics, changelogs, equations, and dates.
3. STRICT 3RD-PERSON OBJECTIVITY: Do NOT speak in the first person ("I", "we", "أنا", "نحن"). Do NOT introduce yourself or announce what AI model you are.
4. EXTERNAL COVERAGE OF AI MODELS: If the inquiry concerns AI models (such as Gemini, GPT-4o, Claude, DeepSeek), report on them strictly as third-party software products developed by their respective companies.
5. NO FLUFF: Skip conversational hellos, small talk, or polite preambles. Start immediately with exhaustive factual intelligence, structured headers, detailed data points, and direct source URLs.
</exhaustive_harvesting_rules>
</search_reconnaissance_directive>`;

  let lastError: any = null;

  // Try candidate keys and models in order until one succeeds
  for (const apiKey of uniqueCandidateKeys) {
    for (const searchModel of uniqueModelsToTry) {
      try {
        const searchAi = new GoogleGenAI({ apiKey });

        const searchGenConfig: any = {
          tools: [{ googleSearch: {} }],
          maxOutputTokens: 64000,
          temperature: 0.2
        };

        // Enable deep thinking / reasoning tokens on models that support it
        if (searchModel.includes('3.8') || searchModel.includes('pro') || searchModel.includes('thinking')) {
          searchGenConfig.thinkingConfig = { thinkingBudget: 8192 };
        }

        let searchRes: any;
        try {
          searchRes = await searchAi.models.generateContent({
            model: searchModel,
            contents: researchPrompt,
            config: searchGenConfig
          });
        } catch (configErr: any) {
          // If thinkingConfig is rejected by this model version, retry without thinkingConfig
          if (searchGenConfig.thinkingConfig) {
            delete searchGenConfig.thinkingConfig;
            searchRes = await searchAi.models.generateContent({
              model: searchModel,
              contents: researchPrompt,
              config: searchGenConfig
            });
          } else {
            throw configErr;
          }
        }

        const chunks = searchRes.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const seenUris = new Set<string>();

        for (const chunk of chunks) {
          if (chunk?.web?.uri && !seenUris.has(chunk.web.uri)) {
            seenUris.add(chunk.web.uri);
            sources.push({
              title: chunk.web.title || chunk.web.uri,
              uri: chunk.web.uri
            });
          }
        }

        queries = searchRes.candidates?.[0]?.groundingMetadata?.webSearchQueries || [];

        // Also extract markdown links [title](url) and raw URLs if present in the text
        if (searchRes.text) {
          const urlRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
          let match;
          while ((match = urlRegex.exec(searchRes.text)) !== null) {
            const title = match[1].trim();
            const uri = match[2].trim();
            if (!seenUris.has(uri)) {
              seenUris.add(uri);
              sources.push({ title: title || uri, uri });
            }
          }

          const sanitizedText = sanitizeSearchDossier(searchRes.text);

          researchDossier = `\n\n[BACKGROUND VERIFIED WEB INTELLIGENCE - LIVE SEARCH DOSSIER]\n${sanitizedText}\n[END OF BACKGROUND INTELLIGENCE - Use the above objective live web facts to inform your response. Do not cite internal dossier tags. Speak with your own authentic voice and model persona.]\n`;
          
          // Successfully completed full reconnaissance with this model & key!
          return { researchDossier, sources, queries };
        }

      } catch (searchErr: any) {
        lastError = searchErr;
        const msg = searchErr?.message || String(searchErr);
        console.warn(`Search reconnaissance attempt with model ${searchModel} failed:`, msg);
        // If 404, try next model with same key. If 429/quota/auth, try next key.
        if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('key') || msg.includes('403') || msg.includes('unregistered')) {
          break; // move to next key
        }
      }
    }
  }

  console.warn("Deep web research reconnaissance could not complete with available keys:", lastError);
  // Graceful degradation: never crash user query with "failed to call gemini api"
  return { 
    researchDossier: "\n\n[NOTICE: Real-time search engine was temporarily unreachable. Proceeding with full internal knowledge base.]\n", 
    sources: [], 
    queries: [] 
  };
}

export const generateUniversalResponse = async (
  prompt: string,
  attachment: Attachment | null,
  activeSelection: ActiveModelSelection,
  config: AIKeyConfig,
  language: Language,
  responseLength: ResponseLengthLevel | boolean,
  deepThink: boolean | ReasoningEffortLevel,
  mode: AppMode,
  options?: {
    enableWebSearch?: boolean;
    searchUrls?: string[];
    geminiFallbackKey?: string;
    searchConfig?: SearchEngineConfig;
    fallbackKeys?: string[];
  }
): Promise<UniversalAIResponse> => {

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

  // 1. Google Gemini Provider (Native Grounding with Google Search)
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

    if (options?.enableWebSearch && options.searchUrls && options.searchUrls.length > 0) {
      effectivePrompt += `\n\n[GOOGLE SEARCH DIRECTIVE: Search Google and ground your answer using real-time verified web information. Focus particularly on research or citations from: ${options.searchUrls.join(', ')}]`;
    }
    parts.push({ text: effectivePrompt });

    const genConfig: any = {
      maxOutputTokens: engineParams.maxOutputTokens,
      temperature: engineParams.temperature,
    };

    if (engineParams.ceilings.supportsNativeThinking) {
      genConfig.thinkingConfig = { thinkingBudget: engineParams.thinkingBudget };
    }

    // Pass real Google Search Grounding tool when enabled
    if (options?.enableWebSearch) {
      genConfig.tools = [{ googleSearch: {} }];
    }

    // Use user's selected Gemini model faithfully, migrating any legacy 2.x/1.5 models to gemini-flash-latest
    const cleanRequested = (modelId && modelId.trim()) ? modelId.trim() : 'gemini-flash-latest';
    const modelToUse = (cleanRequested.includes('2.5') || cleanRequested.includes('2.0') || cleanRequested.includes('1.5'))
      ? 'gemini-flash-latest'
      : cleanRequested;

    let response: any;
    try {
      response = await ai.models.generateContent({
        model: modelToUse,
        contents: { parts },
        config: genConfig
      });
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if ((errMsg.includes('404') || errMsg.includes('NOT_FOUND') || err?.status === 404) && modelToUse !== 'gemini-flash-latest') {
        console.warn(`Gemini model ${modelToUse} returned 404, falling back to gemini-flash-latest...`, err);
        response = await ai.models.generateContent({
          model: 'gemini-flash-latest',
          contents: { parts },
          config: genConfig
        });
      } else if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota') || errMsg.includes('rate limit')) {

        return {
          text: `⚠️ **Rate Limit Notice (429: Quota Exceeded)**\n\nThe API key for [${config.label || 'Google Gemini'}] has reached its usage or rate limit. Click "Switch API & Retry" to instantly switch to another configured API key and continue without interruption.`,
          modelName: modelToUse,
          provider: 'gemini',
          isQuotaExceeded: true,
          failedKeyId: config.id,
          failedProvider: 'gemini'
        };
      } else {
        throw err;
      }
    }

    // Extract search grounding metadata if present
    const searchSources: Array<{ title: string; uri: string }> = [];
    const seenUris = new Set<string>();
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    for (const chunk of chunks) {
      if (chunk?.web?.uri && !seenUris.has(chunk.web.uri)) {
        seenUris.add(chunk.web.uri);
        searchSources.push({
          title: chunk.web.title || chunk.web.uri,
          uri: chunk.web.uri
        });
      }
    }
    const searchQueries: string[] = response.candidates?.[0]?.groundingMetadata?.webSearchQueries || [];

    // Scan response text for markdown citation links [title](url) to capture direct links
    if (response.text) {
      const urlRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
      let match;
      while ((match = urlRegex.exec(response.text)) !== null) {
        const linkTitle = match[1].trim();
        const linkUrl = match[2].trim();
        if (!seenUris.has(linkUrl)) {
          seenUris.add(linkUrl);
          searchSources.push({
            title: linkTitle || linkUrl,
            uri: linkUrl
          });
        }
      }
    }

    return {
      text: response.text || "No response received.",
      modelName: modelToUse,
      provider: 'gemini',
      searchSources: searchSources.length > 0 ? searchSources : undefined,
      searchQueries: searchQueries.length > 0 ? searchQueries : undefined
    };
  }

  // Common Deep Search Grounding for non-Gemini providers (Claude, OpenAI, Groq, DeepSeek, OpenRouter, Custom)
  let searchContext = "";
  let externalSources: Array<{ title: string; uri: string }> = [];
  let externalQueries: string[] = [];

  if (options?.enableWebSearch) {
    const research = await executeDeepWebResearch(
      prompt,
      options.searchUrls,
      options.geminiFallbackKey,
      options.searchConfig,
      options.fallbackKeys
    );
    searchContext = research.researchDossier;
    externalSources = research.sources;
    externalQueries = research.queries;
  }

  // Stage 2: Construct AI-optimized prompt delivering the uncompressed web intelligence dossier to the target model
  let synthesizedPrompt = effectivePrompt;
  if (searchContext && searchContext.trim()) {
    synthesizedPrompt = `<user_inquiry>
${effectivePrompt}
</user_inquiry>

<real_time_web_intelligence_dossier>
${searchContext}
</real_time_web_intelligence_dossier>

<reasoning_and_synthesis_mandate>
You are provided with the comprehensive, uncompressed real-time web intelligence dossier above, harvested live from the web to answer the user inquiry.
Your mission is to:
1. Thoroughly parse and reason through all live facts, specifications, articles, chronological timelines, and data points in the dossier.
2. Produce the definitive, exhaustive, and highly structured answer that the user will rely on.
3. Keep deep analytical reasoning active throughout your synthesis.
4. Deliver your response in your own authentic model identity, incorporating all factual substance seamlessly without ever echoing internal system tags or dossier markers.
</reasoning_and_synthesis_mandate>`;
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
    contentParts.push({ type: 'text', text: synthesizedPrompt });

    const claudeSystemPrompt = `You are ${modelId}, an advanced artificial intelligence assistant developed by Anthropic.
You have access to verified real-time web intelligence in the user prompt context to ensure your information is up to date.
CRITICAL IDENTITY & PERSONA DIRECTIVES:
1. Always maintain your authentic persona as ${modelId}. You are strictly an Anthropic AI model. You are NOT Gemini, Google AI, or an automated web search bot.
2. If the user prompt asks about Gemini, Google DeepMind, or other AI models, speak about them strictly in the third person as external technologies and products. Under NO circumstances say or imply that you are Gemini.
3. Ignore and never adopt any first-person self-introductions, greetings, or local time readings that may appear in background web search dossiers.
4. Seamlessly incorporate the verified factual details, specs, release dates, and citations into your answer in your own authentic voice.`;

    const claudePayload: any = {
      model: modelId,
      max_tokens: engineParams.maxOutputTokens,
      temperature: engineParams.temperature,
      system: claudeSystemPrompt,
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

    try {
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
        const errMsg = err.error?.message || `Claude returned status ${response.status}: ${response.statusText}`;
        if (response.status === 429 || errMsg.includes('rate_limit') || errMsg.includes('quota') || errMsg.includes('overloaded')) {
          return {
            text: `⚠️ **Rate Limit Notice (429: Claude Quota Exceeded)**\n\nThe Anthropic Claude API key has reached its rate limit or usage quota. Click "Switch API & Retry" to switch to another configured API key and continue.`,
            modelName: modelId,
            provider: 'claude',
            isQuotaExceeded: true,
            failedKeyId: config.id,
            failedProvider: 'claude'
          };
        }
        throw new Error(errMsg);
      }

      const data = await response.json();
      const rawTextOut = data.content?.map((c: any) => c.text || '').join('\n') || '';
      const textOut = sanitizeModelOutput(rawTextOut, 'claude', modelId);
      return {
        text: textOut,
        modelName: modelId,
        provider: 'claude',
        searchSources: externalSources.length > 0 ? externalSources : undefined,
        searchQueries: externalQueries.length > 0 ? externalQueries : undefined
      };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (errMsg.includes('429') || errMsg.includes('rate_limit') || errMsg.includes('quota')) {
        return {
          text: `⚠️ **Rate Limit Notice (429: Claude Quota Exceeded)**\n\n${errMsg}`,
          modelName: modelId,
          provider: 'claude',
          isQuotaExceeded: true,
          failedKeyId: config.id,
          failedProvider: 'claude'
        };
      }
      throw err;
    }
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
        text: synthesizedPrompt
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
    userContent = `${attachedText}\n\n${synthesizedPrompt}`;
  } else {
    userContent = synthesizedPrompt;
  }

  const providerMeta = PROVIDER_METAS[provider];
  const providerName = providerMeta?.name || provider;
  const openAISystemPrompt = `You are ${modelId}, an advanced artificial intelligence developed by ${providerName}.
You have access to live real-time web intelligence provided in the prompt context to ground your answer with up-to-date facts.
CRITICAL IDENTITY & PERSONA DIRECTIVES:
1. Always maintain your authentic persona as ${modelId}. You are strictly an AI model developed by ${providerName}. You are NOT Gemini, Google AI, or an automated search bot.
2. If the user prompt asks about Gemini, Google DeepMind, or other AI models, speak about them strictly in the third person as external technologies and products. Under NO circumstances claim that you are Gemini or developed by Google.
3. Ignore and never adopt any first-person self-introductions, greetings, or local time announcements that might appear in background search dossiers.
4. Seamlessly synthesize the verified facts, release dates, and technical details from the search intelligence into your response in your own authentic voice.`;

  const messages: any[] = [];
  if (modelId.startsWith('o1-mini') || modelId.startsWith('o1-preview')) {
    userContent = `[SYSTEM PERSONA & RECONNAISSANCE DIRECTIVE: ${openAISystemPrompt}]\n\n${userContent}`;
  } else if (modelId.startsWith('o1') || modelId.startsWith('o3')) {
    messages.push({ role: 'developer', content: openAISystemPrompt });
  } else {
    messages.push({ role: 'system', content: openAISystemPrompt });
  }

  messages.push({ role: 'user', content: userContent });

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
    bodyPayload.max_completion_tokens = engineParams.maxOutputTokens;
  } else {
    bodyPayload.temperature = engineParams.temperature;
    bodyPayload.top_p = engineParams.topP;
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyPayload)
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      const message = errorJson.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      if (response.status === 429 || message.toLowerCase().includes('quota') || message.toLowerCase().includes('rate limit') || message.toLowerCase().includes('resource_exhausted')) {
        return {
          text: `⚠️ **Rate Limit Notice (${PROVIDER_METAS[provider]?.name || provider}: Quota Exceeded)**\n\n${message}\n\nClick "Switch API & Retry" to instantly switch to another configured API key and continue.`,
          modelName: modelId,
          provider,
          isQuotaExceeded: true,
          failedKeyId: config.id,
          failedProvider: provider
        };
      }
      throw new Error(`${PROVIDER_METAS[provider]?.name || provider} Error: ${message}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const rawOutputText = choice?.message?.content || choice?.text || "No response generated.";
    const outputText = sanitizeModelOutput(rawOutputText, provider, modelId);

    return {
      text: outputText,
      modelName: modelId,
      provider,
      searchSources: externalSources.length > 0 ? externalSources : undefined,
      searchQueries: externalQueries.length > 0 ? externalQueries : undefined
    };
  } catch (fetchErr: any) {
    const errText = fetchErr?.message || String(fetchErr);
    if (errText.includes('429') || errText.toLowerCase().includes('quota') || errText.toLowerCase().includes('rate limit')) {
      return {
        text: `⚠️ **Rate Limit Notice (${PROVIDER_METAS[provider]?.name || provider}: Quota Exceeded)**\n\n${errText}`,
        modelName: modelId,
        provider,
        isQuotaExceeded: true,
        failedKeyId: config.id,
        failedProvider: provider
      };
    }
    throw fetchErr;
  }
};

/**
 * Finds the next available API key in the configured keys pool to failover when rate limits are hit.
 */
export function findNextAvailableKey(
  failedKeyId: string, 
  failedProvider: AIProviderType, 
  keys: AIKeyConfig[]
): AIKeyConfig | null {
  const candidateKeys = (keys || []).filter(k => 
    k.isEnabled && 
    k.id !== failedKeyId && 
    ((k.apiKey && k.apiKey.trim().length > 0) || k.provider === 'custom' || k.id === 'built-in-gemini')
  );

  if (candidateKeys.length === 0) return null;

  // 1. Try finding another key for the EXACT SAME model
  const failedKey = (keys || []).find(k => k.id === failedKeyId);
  if (failedKey) {
    const sameModelKeys = candidateKeys.filter(k => 
      (k.selectedModel || '').trim().toLowerCase() === (failedKey.selectedModel || '').trim().toLowerCase()
    );
    if (sameModelKeys.length > 0) {
      return sameModelKeys[0];
    }
  }

  // 2. Try finding another key for the SAME PROVIDER
  const sameProviderKeys = candidateKeys.filter(k => k.provider === failedProvider);
  if (sameProviderKeys.length > 0) {
    return sameProviderKeys[0];
  }

  // 3. Fallback to any enabled alternative key
  return candidateKeys[0];
}

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
    const sameProviderKeys = authenticatedKeys.filter(x => x.provider === k.provider);
    const providerTag = sameProviderKeys.length > 1 
      ? ` #${sameProviderKeys.findIndex(x => x.id === k.id) + 1}` 
      : '';
    const labelPrefix = `${k.label || PROVIDER_METAS[k.provider]?.name || k.provider}${providerTag}`;

    // If user provided a custom Gemini API Key:
    if (k.provider === 'gemini') {
      options.push({
        keyId: k.id,
        provider: 'gemini',
        modelId: 'gemini-3.1-flash-lite-image',
        displayName: `${labelPrefix} · Flash Lite Image (Fast)`,
        badge: 'Gemini Lite',
        supportsImages: true
      });
      options.push({
        keyId: k.id,
        provider: 'gemini',
        modelId: 'gemini-nano-banana-2.1',
        displayName: `${labelPrefix} · Nano Banana 2.1 (2K/4K Pro)`,
        badge: 'Nano Banana 2.1',
        supportsImages: true
      });
      options.push({
        keyId: k.id,
        provider: 'gemini',
        modelId: 'gemini-3-pro-image',
        displayName: `${labelPrefix} · Pro Image Studio (Ultra HD)`,
        badge: 'Gemini Pro',
        supportsImages: true
      });
    } else if (k.provider === 'openai') {
      options.push({
        keyId: k.id,
        provider: 'openai',
        modelId: 'dall-e-3',
        displayName: `${labelPrefix} · DALL-E 3 (HD Quality)`,
        badge: 'DALL-E 3',
        supportsImages: true
      });
      options.push({
        keyId: k.id,
        provider: 'openai',
        modelId: 'dall-e-2',
        displayName: `${labelPrefix} · DALL-E 2`,
        badge: 'DALL-E 2',
        supportsImages: true
      });
    } else if (k.provider === 'openrouter') {
      options.push({
        keyId: k.id,
        provider: 'openrouter',
        modelId: 'black-forest-labs/flux-1-schnell',
        displayName: `${labelPrefix} · Flux.1 Schnell`,
        badge: 'Flux.1',
        supportsImages: true
      });
      options.push({
        keyId: k.id,
        provider: 'openrouter',
        modelId: 'stabilityai/stable-diffusion-xl-base-1.0',
        displayName: `${labelPrefix} · SDXL Base 1.0`,
        badge: 'SDXL',
        supportsImages: true
      });
    } else {
      // For any custom or other provider: check if the model supports image generation
      const models = Array.from(new Set([k.selectedModel, ...(k.availableModels || [])])).filter(Boolean);
      models.forEach(m => {
        const caps = detectModelCapabilities(k.provider, m);
        if (caps.includes('image')) {
          options.push({
            keyId: k.id,
            provider: k.provider,
            modelId: m,
            displayName: `${labelPrefix} · ${m}`,
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


