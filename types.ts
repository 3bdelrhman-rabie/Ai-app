export enum AppMode {
  SOLVE = 'solve',
  MEDIA = 'media',
  MAP = 'map',
  PROMPT = 'prompt',
  OFFLINE = 'offline' // Virtual mode
}

export enum Language {
  ARABIC = 'ar',
  ENGLISH = 'en',
  GERMAN = 'de'
}

export type AIProviderType = 
  | 'gemini' 
  | 'openai' 
  | 'claude' 
  | 'groq' 
  | 'deepseek' 
  | 'openrouter' 
  | 'custom';

export interface AIKeyConfig {
  id: string;
  provider: AIProviderType;
  label: string;
  apiKey: string;
  baseUrl?: string;
  selectedModel: string;
  availableModels?: string[];
  isEnabled: boolean;
  status?: 'connected' | 'error' | 'untested';
  lastTested?: number;
  errorMessage?: string;
}

export interface ActiveModelSelection {
  keyId: string;
  provider: AIProviderType;
  modelId: string;
  displayName: string;
}

export interface Attachment {
  type: 'image' | 'video' | 'audio' | 'text' | 'file';
  mimeType: string;
  data: string; // Base64 encoded data
  name: string;
}

export interface SearchSource {
  title: string;
  uri: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  mode?: AppMode;
  modelName?: string;
  provider?: AIProviderType;
  attachment?: Attachment; // Replaces imageUrl for user uploads
  imageUrl?: string; // Legacy/Generated
  videoUrl?: string; // For Veo output
  mapLinks?: Array<{ title: string; uri: string }>;
  searchSources?: SearchSource[];
  searchQueries?: string[];
  isError?: boolean;
  canSwitchApi?: boolean;
  failedKeyId?: string;
  failedProvider?: AIProviderType;
  failedPrompt?: string;
  failedAttachment?: Attachment;
  failedMode?: AppMode;
  isGif?: boolean;
}

export interface VeoConfig {
  aspectRatio: '16:9' | '9:16';
  resolution: '720p' | '1080p';
}

export interface ImageGenConfig {
  aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  imageSize: '1K' | '2K' | '4K';
}

export interface AudioPart {
  inlineData: {
    mimeType: string;
    data: string;
  }
}

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export type ReasoningEffortLevel = 'off' | 'low' | 'medium' | 'high' | 'max';

export interface ReasoningTier {
  level: ReasoningEffortLevel;
  step: number;
  label: string;
  shortLabel: string;
  speedText: string;
  qualityText: string;
  thinkingBudget: number;
  temperature: number;
  colorClass: string;
  badgeBg: string;
  dotColor: string;
  description: string;
  // Backward compatibility
  labelAr: string;
  labelEn: string;
  shortLabelAr: string;
  speedTextAr: string;
  qualityTextAr: string;
  descriptionAr: string;
}

export const REASONING_TIERS: Record<ReasoningEffortLevel, ReasoningTier> = {
  off: {
    level: 'off',
    step: 0,
    label: 'Direct (Off)',
    shortLabel: 'Off',
    speedText: 'Instant ⚡⚡⚡',
    qualityText: 'Standard direct output',
    thinkingBudget: 0,
    temperature: 0.7,
    colorClass: 'text-slate-400',
    badgeBg: 'bg-slate-700/60 border-slate-600',
    dotColor: 'bg-slate-500',
    description: 'Instant response without thinking delay. Best for simple queries, quick chit-chat, and rapid interactions.',
    labelAr: 'مباشر (إيقاف)',
    labelEn: 'Direct (Off)',
    shortLabelAr: 'إيقاف',
    speedTextAr: 'فائق السرعة ⚡⚡⚡',
    qualityTextAr: 'إجابة فورية قياسية',
    descriptionAr: 'استجابة فورية فائقة السرعة بدون ميزانية تفكير إضافية، مناسبة للأسئلة المباشرة والمحادثات اليومية.'
  },
  low: {
    level: 'low',
    step: 1,
    label: 'Fast Review (Low)',
    shortLabel: 'Low',
    speedText: 'Fast ⚡⚡',
    qualityText: 'Quick logic verification',
    thinkingBudget: 2048,
    temperature: 0.5,
    colorClass: 'text-emerald-400',
    badgeBg: 'bg-emerald-950/60 border-emerald-500/50',
    dotColor: 'bg-emerald-400',
    description: 'Brief internal verification and fact-checking while maintaining rapid response speed.',
    labelAr: 'تفكير خفيف (سريع)',
    labelEn: 'Low (Fast)',
    shortLabelAr: 'خفيف',
    speedTextAr: 'سريع ⚡⚡',
    qualityTextAr: 'مراجعة وتدقيق الإجابة',
    descriptionAr: 'تفكير سريع ديناميكي (~15% من طاقة الموديل) لتدقيق الإجابات والتحقق من صحتها مع الحفاظ على سرعة الاستجابة.'
  },
  medium: {
    level: 'medium',
    step: 2,
    label: 'Balanced (Medium)',
    shortLabel: 'Medium',
    speedText: 'Balanced ⚖️',
    qualityText: 'High precision balance',
    thinkingBudget: 8192,
    temperature: 0.35,
    colorClass: 'text-cyan-400',
    badgeBg: 'bg-cyan-950/60 border-cyan-500/50',
    dotColor: 'bg-cyan-400',
    description: 'Optimal harmony between analytical depth and processing speed. Recommended for complex problem-solving.',
    labelAr: 'تفكير متوازن (دقيق)',
    labelEn: 'Medium (Balanced)',
    shortLabelAr: 'متوازن',
    speedTextAr: 'متوازن ⚖️',
    qualityTextAr: 'دقة عالية وتوازن مثالي',
    descriptionAr: 'توازن مثالي ديناميكي (~40% من طاقة الموديل حتى 26,000+ توكن) لمعالجة المهام المركبة وحل المسائل بتأنٍ ودقة.'
  },
  high: {
    level: 'high',
    step: 3,
    label: 'Deep Thinking (High)',
    shortLabel: 'High',
    speedText: 'Deliberate 🧠',
    qualityText: 'In-depth rigorous audit',
    thinkingBudget: 16384,
    temperature: 0.2,
    colorClass: 'text-purple-400',
    badgeBg: 'bg-purple-950/60 border-purple-500/50',
    dotColor: 'bg-purple-400',
    description: 'Thorough deductive reasoning with multi-step validation and meticulous breakdown of challenging tasks.',
    labelAr: 'تفكير عميق (مكثف)',
    labelEn: 'High (Deep)',
    shortLabelAr: 'عميق',
    speedTextAr: 'متأنٍ ومركّز 🧠',
    qualityTextAr: 'تحليل دقيق وحلول مفصلة',
    descriptionAr: 'تحليل تفصيلي بجهد استنتاجي مرتفع (~75% من طاقة الموديل حتى 49,000+ توكن) مع استنتاجات منطقية وخطوات تحقق معمقة.'
  },
  max: {
    level: 'max',
    step: 4,
    label: 'Maximum Rigor (Max)',
    shortLabel: 'Max',
    speedText: 'Deepest 🏆',
    qualityText: 'Exhaustive proof & audit',
    thinkingBudget: 65536,
    temperature: 0.1,
    colorClass: 'text-amber-400',
    badgeBg: 'bg-amber-950/60 border-amber-500/50',
    dotColor: 'bg-amber-400',
    description: 'Pushes the model to its absolute reasoning ceiling. Performs exhaustive derivations and multi-angle verification.',
    labelAr: 'أقصى تفكير (استثنائي)',
    labelEn: 'Maximum (Ultra)',
    shortLabelAr: 'أقصى',
    speedTextAr: 'دقيق ومتأنٍ جداً 🏆',
    qualityTextAr: 'أعلى دقة وتحليل شامل',
    descriptionAr: 'أقصى قدرة تفكير واستنتاج للموديل (100% من السقف الكامل حتى 65,536+ توكن) لحل أصعب المعضلات الرياضية والبرمجية.'
  }
};

export const REASONING_STEPS: ReasoningEffortLevel[] = ['off', 'low', 'medium', 'high', 'max'];

export type ResponseLengthLevel = 'short' | 'compact' | 'standard' | 'detailed' | 'max';

export interface ResponseLengthTier {
  level: ResponseLengthLevel;
  step: number;
  label: string;
  shortLabel: string;
  tokenPercent: number; // % of model max output tokens
  description: string;
}

export const RESPONSE_LENGTH_TIERS: Record<ResponseLengthLevel, ResponseLengthTier> = {
  short: {
    level: 'short',
    step: 0,
    label: 'Concise (Short)',
    shortLabel: 'Short',
    tokenPercent: 10,
    description: 'Direct answer without background elaboration or filler.'
  },
  compact: {
    level: 'compact',
    step: 1,
    label: 'Compact',
    shortLabel: 'Compact',
    tokenPercent: 25,
    description: 'Brief and focused explanation of key findings.'
  },
  standard: {
    level: 'standard',
    step: 2,
    label: 'Standard',
    shortLabel: 'Standard',
    tokenPercent: 50,
    description: 'Balanced response with explanations and context.'
  },
  detailed: {
    level: 'detailed',
    step: 3,
    label: 'Detailed',
    shortLabel: 'Detailed',
    tokenPercent: 80,
    description: 'Thorough coverage with derivations and examples.'
  },
  max: {
    level: 'max',
    step: 4,
    label: 'Comprehensive (Max)',
    shortLabel: 'Max',
    tokenPercent: 100,
    description: 'Exhaustive in-depth response utilizing full token capacity.'
  }
};

export const RESPONSE_LENGTH_STEPS: ResponseLengthLevel[] = ['short', 'compact', 'standard', 'detailed', 'max'];

// --- Dedicated Web Search Engine Configuration ---

export interface SearchEngineKey {
  id: string;
  key: string;
  label?: string;
  addedAt: number;
}

export interface SearchEngineModelOption {
  id: string;
  name: string;
  description: string;
  recommended?: boolean;
}

export const SEARCH_ENGINE_MODELS: SearchEngineModelOption[] = [
  { 
    id: 'gemini-flash-latest', 
    name: 'Gemini Flash (Latest)', 
    description: 'Fastest real-time web crawler & auto-updating Gemini Flash (Recommended)', 
    recommended: true 
  },
  { 
    id: 'gemini-3.8-flash', 
    name: 'Gemini 3.8 Flash', 
    description: 'Frontier multimodal model for deep research & factual grounding' 
  },
  { 
    id: 'gemini-pro-latest', 
    name: 'Gemini Pro (Latest)', 
    description: 'Deepest reasoning & exhaustive online factual synthesis' 
  }
];

export interface SearchEngineConfig {
  enabled: boolean;
  modelId: string;
  apiKeys: SearchEngineKey[];
  activeKeyIndex: number;
}

export const DEFAULT_SEARCH_ENGINE_CONFIG: SearchEngineConfig = {
  enabled: true,
  modelId: 'gemini-flash-latest',
  apiKeys: [],
  activeKeyIndex: 0
};