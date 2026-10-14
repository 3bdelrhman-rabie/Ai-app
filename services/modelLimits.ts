import { AIProviderType, ReasoningEffortLevel, ResponseLengthLevel } from '../types';

export interface ModelCeilings {
  provider: AIProviderType | string;
  modelId: string;
  maxOutputTokens: number;
  maxThinkingBudget: number;
  supportsNativeThinking: boolean;
  thinkingEngine: 'gemini' | 'claude_37' | 'openai_reasoning' | 'deepseek_r1' | 'cot_instruction';
  defaultTemp: number;
}

/**
 * Returns accurate output token capacity, thinking budget, and engine type
 * for any AI model across Google Gemini, OpenAI, Claude, Groq, DeepSeek, OpenRouter, and Custom.
 */
export function getModelCeilings(provider: AIProviderType | string, modelId: string): ModelCeilings {
  const m = (modelId || '').toLowerCase().trim();

  // 1. Google Gemini Models
  if (provider === 'gemini') {
    if (m.includes('pro-latest') || m.includes('3-pro') || m.includes('4-argon') || m.includes('2.5-pro')) {
      return {
        provider,
        modelId,
        maxOutputTokens: 65536,
        maxThinkingBudget: 65536,
        supportsNativeThinking: true,
        thinkingEngine: 'gemini',
        defaultTemp: 0.7,
      };
    }
    // Gemini Flash Latest, 3.8 Flash & other modern Gemini models support full 65,536 tokens
    if (m.includes('flash') || m.includes('latest') || m.includes('3.8') || m.includes('2.5')) {
      return {
        provider,
        modelId,
        maxOutputTokens: 65536,
        maxThinkingBudget: 65536,
        supportsNativeThinking: true,
        thinkingEngine: 'gemini',
        defaultTemp: 0.7,
      };
    }

    return {
      provider,
      modelId,
      maxOutputTokens: 65536,
      maxThinkingBudget: 65536,
      supportsNativeThinking: true,
      thinkingEngine: 'gemini',
      defaultTemp: 0.7,
    };
  }

  // 2. Anthropic Claude Models
  if (provider === 'claude') {
    if (m.includes('3-7-sonnet') || m.includes('claude-3.7')) {
      return {
        provider,
        modelId,
        maxOutputTokens: 64000,
        maxThinkingBudget: 64000,
        supportsNativeThinking: true,
        thinkingEngine: 'claude_37',
        defaultTemp: 1.0, // Claude requires temp=1.0 when thinking is enabled
      };
    }
    // Claude 3.5 Sonnet & Haiku
    return {
      provider,
      modelId,
      maxOutputTokens: 8192,
      maxThinkingBudget: 8192,
      supportsNativeThinking: false,
      thinkingEngine: 'cot_instruction',
      defaultTemp: 0.7,
    };
  }

  // 3. OpenAI Models
  if (provider === 'openai') {
    if (m.startsWith('o1') || m.startsWith('o3') || m.includes('o1-') || m.includes('o3-')) {
      return {
        provider,
        modelId,
        maxOutputTokens: 100000,
        maxThinkingBudget: 100000,
        supportsNativeThinking: true,
        thinkingEngine: 'openai_reasoning',
        defaultTemp: 1.0,
      };
    }
    if (m.includes('gpt-4o')) {
      return {
        provider,
        modelId,
        maxOutputTokens: 16384,
        maxThinkingBudget: 16384,
        supportsNativeThinking: false,
        thinkingEngine: 'cot_instruction',
        defaultTemp: 0.7,
      };
    }
    return {
      provider,
      modelId,
      maxOutputTokens: 16384,
      maxThinkingBudget: 16384,
      supportsNativeThinking: false,
      thinkingEngine: 'cot_instruction',
      defaultTemp: 0.7,
    };
  }

  // 4. DeepSeek Models
  if (provider === 'deepseek') {
    if (m.includes('reasoner') || m.includes('r1')) {
      return {
        provider,
        modelId,
        maxOutputTokens: 65536,
        maxThinkingBudget: 65536,
        supportsNativeThinking: true,
        thinkingEngine: 'deepseek_r1',
        defaultTemp: 0.6,
      };
    }
    return {
      provider,
      modelId,
      maxOutputTokens: 8192,
      maxThinkingBudget: 8192,
      supportsNativeThinking: false,
      thinkingEngine: 'cot_instruction',
      defaultTemp: 0.7,
    };
  }

  // 5. Groq Models
  if (provider === 'groq') {
    if (m.includes('r1') || m.includes('deepseek')) {
      return {
        provider,
        modelId,
        maxOutputTokens: 65536,
        maxThinkingBudget: 65536,
        supportsNativeThinking: true,
        thinkingEngine: 'deepseek_r1',
        defaultTemp: 0.6,
      };
    }
    if (m.includes('70b')) {
      return {
        provider,
        modelId,
        maxOutputTokens: 32768,
        maxThinkingBudget: 32768,
        supportsNativeThinking: false,
        thinkingEngine: 'cot_instruction',
        defaultTemp: 0.7,
      };
    }
    return {
      provider,
      modelId,
      maxOutputTokens: 8192,
      maxThinkingBudget: 8192,
      supportsNativeThinking: false,
      thinkingEngine: 'cot_instruction',
      defaultTemp: 0.7,
    };
  }

  // 6. OpenRouter / Custom / Fallback
  if (m.includes('r1') || m.includes('reasoner') || m.includes('o1') || m.includes('o3') || m.includes('flash') || m.includes('pro')) {
    const isReasoning = m.includes('r1') || m.includes('reasoner') || m.includes('o1') || m.includes('o3');
    return {
      provider,
      modelId,
      maxOutputTokens: 65536,
      maxThinkingBudget: 65536,
      supportsNativeThinking: isReasoning || m.includes('flash') || m.includes('pro'),
      thinkingEngine: (m.includes('o1') || m.includes('o3')) ? 'openai_reasoning' : (m.includes('claude') ? 'claude_37' : (m.includes('r1') ? 'deepseek_r1' : 'gemini')),
      defaultTemp: 0.7,
    };
  }

  return {
    provider,
    modelId,
    maxOutputTokens: 16384,
    maxThinkingBudget: 16384,
    supportsNativeThinking: false,
    thinkingEngine: 'cot_instruction',
    defaultTemp: 0.7,
  };
}

/**
 * Calculates model parameters scaled proportionally:
 * Speed, thinking tokens, max output tokens, temperature, topP, and reasoning effort.
 */
export function calculateEngineParameters(
  provider: AIProviderType | string,
  modelId: string,
  reasoningLevel: ReasoningEffortLevel,
  responseLength: ResponseLengthLevel
) {
  const ceilings = getModelCeilings(provider, modelId);

  // 1. Calculate Thinking Budget based on reasoning tier
  let thinkingBudget = 0;
  let temperature = ceilings.defaultTemp;
  let topP = 0.95;
  let reasoningEffort: 'low' | 'medium' | 'high' | undefined = undefined;

  switch (reasoningLevel) {
    case 'off':
      thinkingBudget = 0;
      temperature = 0.7;
      topP = 0.95;
      break;
    case 'low':
      thinkingBudget = Math.max(1024, Math.round(ceilings.maxThinkingBudget * 0.15));
      temperature = 0.5;
      topP = 0.90;
      reasoningEffort = 'low';
      break;
    case 'medium':
      thinkingBudget = Math.max(4096, Math.round(ceilings.maxThinkingBudget * 0.40));
      temperature = 0.35;
      topP = 0.85;
      reasoningEffort = 'medium';
      break;
    case 'high':
      thinkingBudget = Math.max(8192, Math.round(ceilings.maxThinkingBudget * 0.75));
      temperature = 0.2;
      topP = 0.80;
      reasoningEffort = 'high';
      break;
    case 'max':
      thinkingBudget = ceilings.maxThinkingBudget;
      temperature = 0.1;
      topP = 0.70;
      reasoningEffort = 'high';
      break;
  }

  // Claude 3.7 requires temperature = 1.0 when thinking is active
  if (ceilings.thinkingEngine === 'claude_37' && reasoningLevel !== 'off') {
    temperature = 1.0;
  }

  // 2. Calculate Max Output Tokens based on Response Length tier
  let maxOutputTokens: number;
  let lengthInstruction: string;

  switch (responseLength) {
    case 'short':
      maxOutputTokens = Math.min(ceilings.maxOutputTokens, 768);
      lengthInstruction = "Be extremely concise and direct. Provide only the essential answer without superfluous explanation or preamble.";
      break;
    case 'compact':
      maxOutputTokens = Math.max(1024, Math.round(ceilings.maxOutputTokens * 0.25));
      lengthInstruction = "Provide a compact, focused response highlighting key points efficiently.";
      break;
    case 'standard':
      maxOutputTokens = Math.max(2048, Math.round(ceilings.maxOutputTokens * 0.50));
      lengthInstruction = "Provide a balanced, clear, and well-structured response.";
      break;
    case 'detailed':
      maxOutputTokens = Math.max(4096, Math.round(ceilings.maxOutputTokens * 0.80));
      lengthInstruction = "Provide a thorough, comprehensive response with step-by-step reasoning, context, and detailed explanations.";
      break;
    case 'max':
      maxOutputTokens = ceilings.maxOutputTokens;
      lengthInstruction = "Provide an exhaustive, in-depth analysis covering every nuance, edge case, and comprehensive solution without brevity constraints.";
      break;
  }

  // 3. Chain-of-Thought directive for models without a native thinking parameter
  let cotInstruction = "";
  if (!ceilings.supportsNativeThinking && reasoningLevel !== 'off') {
    if (reasoningLevel === 'max') {
      cotInstruction = "\n\n[REASONING DIRECTIVE: MAXIMAL DEPTH]\nYou must exercise rigorous, exhaustive multi-stage reasoning before concluding. Explicitly examine foundational principles, evaluate alternative hypotheses, systematically detect and refute counter-arguments, and verify every step of your solution.";
    } else if (reasoningLevel === 'high') {
      cotInstruction = "\n\n[REASONING DIRECTIVE: DEEP ANALYSIS]\nThoroughly analyze this problem step-by-step. Detail intermediate steps, examine critical edge cases, and verify your logic carefully.";
    } else if (reasoningLevel === 'medium') {
      cotInstruction = "\n\n[REASONING DIRECTIVE: STRUCTURED THINKING]\nProvide a step-by-step derivation, explaining key rationales and verifying conclusions.";
    } else if (reasoningLevel === 'low') {
      cotInstruction = "\n\n[REASONING DIRECTIVE: VERIFICATION]\nDouble check calculations and logical coherence before stating the answer.";
    }
  }

  return {
    ceilings,
    thinkingBudget,
    maxOutputTokens,
    temperature,
    topP,
    reasoningEffort,
    lengthInstruction,
    cotInstruction,
  };
}
