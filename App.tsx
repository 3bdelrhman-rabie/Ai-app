import React, { useState, useRef, useEffect } from 'react';
import { 
  AppMode, 
  Language, 
  ChatMessage, 
  ImageGenConfig, 
  VeoConfig, 
  Attachment,
  AIKeyConfig,
  ActiveModelSelection,
  AIProviderType,
  ReasoningEffortLevel,
  REASONING_TIERS,
  ResponseLengthLevel,
  RESPONSE_LENGTH_TIERS
} from './types';
import * as GeminiService from './services/geminiService';
import * as AiService from './services/aiService';
import LiveSession from './components/LiveSession';
import ApiSettingsModal from './components/ApiSettingsModal';
import ModelSelectorBar from './components/ModelSelectorBar';
import ReasoningControl from './components/ReasoningControl';

// -- Icons Map --
const MODE_ICONS = {
  [AppMode.SOLVE]: 'fa-wrench',
  [AppMode.MEDIA]: 'fa-photo-film',
  [AppMode.MAP]: 'fa-map-location-dot',
  [AppMode.PROMPT]: 'fa-wand-magic-sparkles',
  [AppMode.OFFLINE]: 'fa-ban'
};

const ORDERED_MODES = [
  { mode: AppMode.SOLVE, labelEn: 'Solve', icon: 'fa-brain' },
  { mode: AppMode.MEDIA, labelEn: 'Media', icon: 'fa-photo-film' },
  { mode: AppMode.MAP, labelEn: 'Maps', icon: 'fa-map-location-dot' },
  { mode: AppMode.PROMPT, labelEn: 'Prompts', icon: 'fa-wand-magic-sparkles' },
];

const App: React.FC = () => {
  // Global State
  const [mode, setMode] = useState<AppMode>(AppMode.SOLVE);
  const [language] = useState<Language>(Language.ENGLISH);
  const [reasoningLevel, setReasoningLevel] = useState<ReasoningEffortLevel>(() => {
    try {
      const saved = localStorage.getItem('mechengb_reasoning_level_v1');
      if (saved && (saved in REASONING_TIERS)) return saved as ReasoningEffortLevel;
    } catch {}
    return 'off';
  });

  const handleReasoningLevelChange = (lvl: ReasoningEffortLevel) => {
    setReasoningLevel(lvl);
    try {
      localStorage.setItem('mechengb_reasoning_level_v1', lvl);
    } catch (e) {
      console.error(e);
    }
  };

  const [responseLength, setResponseLength] = useState<ResponseLengthLevel>(() => {
    try {
      const saved = localStorage.getItem('mechengb_response_length_v1');
      if (saved && (saved in RESPONSE_LENGTH_TIERS)) return saved as ResponseLengthLevel;
    } catch {}
    return 'standard';
  });

  const handleResponseLengthChange = (len: ResponseLengthLevel) => {
    setResponseLength(len);
    try {
      localStorage.setItem('mechengb_response_length_v1', len);
    } catch (e) {
      console.error(e);
    }
  };

  const shortMode = responseLength === 'short';

  const deepThink = reasoningLevel !== 'off';
  const [isLiveActive, setIsLiveActive] = useState<boolean>(false);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);

  // Speech Recognition state
  const [isListening, setIsListening] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);

  // Touch Swipe state
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [swipeNotice, setSwipeNotice] = useState<string | null>(null);

  // Mode Specific State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Inputs
  const [textInput, setTextInput] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  
  // Media Configs
  const [mediaTab, setMediaTab] = useState<'gen' | 'edit' | 'video' | 'gif'>('gen');
  const [imgConfig, setImgConfig] = useState<ImageGenConfig>({ aspectRatio: '1:1', imageSize: '1K' });
  const [veoConfig, setVeoConfig] = useState<VeoConfig>({ aspectRatio: '16:9', resolution: '720p' });
  
  // Prompt Mode Inputs
  const [promptTopic, setPromptTopic] = useState('');
  const [promptModel, setPromptModel] = useState('');
  const [promptResult, setPromptResult] = useState('');

  // Multi-AI API Keys & Model Management State
  const [apiKeys, setApiKeys] = useState<AIKeyConfig[]>(() => AiService.getStoredKeys());
  const [activeModel, setActiveModel] = useState<ActiveModelSelection>(() => AiService.getStoredActiveModel());
  const [isApiSettingsOpen, setIsApiSettingsOpen] = useState<boolean>(false);

  // Dedicated Active Image Model State for Media Generation
  const [activeImageModel, setActiveImageModel] = useState<{
    keyId: string;
    provider: AIProviderType;
    modelId: string;
    displayName: string;
  }>(() => {
    try {
      const raw = localStorage.getItem('mechengb_active_img_model_v1');
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      keyId: 'free-banana',
      provider: 'gemini',
      modelId: 'nano-banana-free',
      displayName: 'Nano Banana (Free · No API Key)'
    };
  });

  const handleSelectImageModel = (option: { keyId: string; provider: AIProviderType; modelId: string; displayName: string }) => {
    setActiveImageModel(option);
    try {
      localStorage.setItem('mechengb_active_img_model_v1', JSON.stringify(option));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectModel = (keyId: string, modelId: string, currentKeys = apiKeys) => {
    const keyConfig = currentKeys.find(k => k.id === keyId);
    if (!keyConfig) {
      if (currentKeys.length > 0) {
        const fallback = currentKeys.find(k => k.isEnabled) || currentKeys[0];
        const fallbackMeta = AiService.PROVIDER_METAS[fallback.provider] || AiService.PROVIDER_METAS.custom;
        const newSelection: ActiveModelSelection = {
          keyId: fallback.id,
          provider: fallback.provider,
          modelId: fallback.selectedModel || fallbackMeta.defaultModels[0],
          displayName: `${fallback.label || fallbackMeta.name} (${fallback.selectedModel || fallbackMeta.defaultModels[0]})`
        };
        setActiveModel(newSelection);
        AiService.saveStoredActiveModel(newSelection);
      } else {
        const emptySelection: ActiveModelSelection = {
          keyId: '',
          provider: 'gemini',
          modelId: 'No Model (Add API)',
          displayName: 'No Model (Add API)'
        };
        setActiveModel(emptySelection);
        AiService.saveStoredActiveModel(emptySelection);
      }
      return;
    }

    const meta = AiService.PROVIDER_METAS[keyConfig.provider] || AiService.PROVIDER_METAS.custom;
    const newSelection: ActiveModelSelection = {
      keyId,
      provider: keyConfig.provider,
      modelId,
      displayName: `${keyConfig.label || meta.name} (${modelId})`
    };
    setActiveModel(newSelection);
    AiService.saveStoredActiveModel(newSelection);

    // Also update selectedModel in the key
    const updatedKeys = currentKeys.map(k => k.id === keyId ? { ...k, selectedModel: modelId } : k);
    setApiKeys(updatedKeys);
    AiService.saveStoredKeys(updatedKeys);
  };

  const handleSaveKeys = (updatedKeys: AIKeyConfig[]) => {
    setApiKeys(updatedKeys);
    AiService.saveStoredKeys(updatedKeys);

    // Verify activeModel points to an enabled key with an active API key (or built-in-gemini)
    const currentActiveKey = updatedKeys.find(k => k.id === activeModel.keyId && k.isEnabled);
    const hasValidKey = currentActiveKey && (
      currentActiveKey.id === 'built-in-gemini' || 
      Boolean(currentActiveKey.apiKey?.trim()) || 
      (currentActiveKey.provider === 'custom' && Boolean(currentActiveKey.baseUrl?.trim()))
    );

    if (!hasValidKey) {
      const firstValid = updatedKeys.find(k => 
        k.isEnabled && (k.id === 'built-in-gemini' || Boolean(k.apiKey?.trim()) || (k.provider === 'custom' && Boolean(k.baseUrl?.trim())))
      );
      if (firstValid) {
        const meta = AiService.PROVIDER_METAS[firstValid.provider] || AiService.PROVIDER_METAS.custom;
        const newSelection: ActiveModelSelection = {
          keyId: firstValid.id,
          provider: firstValid.provider,
          modelId: firstValid.selectedModel || 'gemini-3.8-flash',
          displayName: `${firstValid.label || meta.name} (${firstValid.selectedModel || 'gemini-3.8-flash'})`
        };
        setActiveModel(newSelection);
        AiService.saveStoredActiveModel(newSelection);
      } else {
        const defaultBuiltIn: ActiveModelSelection = {
          keyId: 'built-in-gemini',
          provider: 'gemini',
          modelId: 'gemini-3.8-flash',
          displayName: 'Google Gemini (gemini-3.8-flash)'
        };
        setActiveModel(defaultBuiltIn);
        AiService.saveStoredActiveModel(defaultBuiltIn);
      }
    }

    // Also verify activeImageModel points to an existing key with an active API key (or fallback to free banana)
    const isImageKeyValid = updatedKeys.some(k => 
      k.id === activeImageModel.keyId && 
      k.isEnabled && 
      (k.id === 'built-in-gemini' || Boolean(k.apiKey?.trim()) || (k.provider === 'custom' && Boolean(k.baseUrl?.trim())))
    );
    if (!isImageKeyValid && activeImageModel.keyId !== 'free-banana') {
      handleSelectImageModel({
        keyId: 'free-banana',
        provider: 'gemini',
        modelId: 'nano-banana-free',
        displayName: 'Nano Banana (Free · No API Key)'
      });
    }
  };

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Network listener
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => {
        setIsOffline(true);
        setMode(AppMode.OFFLINE);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, mode, isLoading, promptResult]);

  // --- Handlers ---

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Extract base64 data (remove data:mime/type;base64, prefix)
        const base64Data = result.split(',')[1];
        // Determine mime type from file or data URL header
        const mimeType = file.type || result.split(':')[1].split(';')[0];
        
        let type: Attachment['type'] = 'file';
        if (mimeType.startsWith('image/')) type = 'image';
        else if (mimeType.startsWith('video/')) type = 'video';
        else if (mimeType.startsWith('audio/')) type = 'audio';
        else if (mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType.includes('pdf')) type = 'text';

        setAttachment({
            type,
            mimeType,
            data: base64Data,
            name: file.name
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStartLive = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setActiveStream(stream);
        setIsLiveActive(true);
    } catch (err) {
        console.error("Permission denied or error", err);
        addBotMessage("Error: Could not access microphone. Please allow permissions.", undefined, undefined, undefined, true);
    }
  };

  const handleStopLive = () => {
    setIsLiveActive(false);
    if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
        setActiveStream(null);
    }
  };

  // Touch Swipe Handlers for Mode Switching
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Must be predominantly horizontal gesture exceeding 50px
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
      const currentIndex = ORDERED_MODES.findIndex(m => m.mode === mode);
      if (currentIndex !== -1) {
        if (deltaX < 0) {
          // Swipe Left: move to next mode
          if (currentIndex < ORDERED_MODES.length - 1) {
            const nextMode = ORDERED_MODES[currentIndex + 1];
            setMode(nextMode.mode);
            setSwipeNotice(nextMode.labelEn);
            setTimeout(() => setSwipeNotice(null), 1000);
          }
        } else {
          // Swipe Right: move to previous mode
          if (currentIndex > 0) {
            const prevMode = ORDERED_MODES[currentIndex - 1];
            setMode(prevMode.mode);
            setSwipeNotice(prevMode.labelEn);
            setTimeout(() => setSwipeNotice(null), 1000);
          }
        }
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Embedded Mic Speech Recognition Toggle
  const handleToggleMic = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      handleStartLive();
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = language === Language.ARABIC ? 'ar-SA' : language === Language.GERMAN ? 'de-DE' : 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setTextInput(prev => (prev ? prev + ' ' : '') + transcript);
        }
      };

      recognition.onerror = (err: any) => {
        console.warn("Speech recognition error:", err);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (e) {
      console.error("Speech recognition start failed:", e);
      setIsListening(false);
      handleStartLive();
    }
  };

  const handleSend = async () => {
    if (!textInput.trim() && !attachment && mode !== AppMode.PROMPT) return;

    setIsLoading(true);
    const currentMode = mode;
    const currentText = textInput;
    const currentAtt = attachment;
    setTextInput('');
    setAttachment(null);

    // Add user message to UI with mode tagging
    if (currentMode !== AppMode.PROMPT) {
        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            text: currentText,
            mode: currentMode,
            attachment: currentAtt || undefined
        };
        setChatHistory(prev => [...prev, userMsg]);
    }

    try {
        if (currentMode === AppMode.SOLVE) {
            let currentConfig = apiKeys.find(k => k.id === activeModel.keyId && k.isEnabled);
            if (!currentConfig) {
                currentConfig = apiKeys.find(k => k.isEnabled) || apiKeys[0];
            }

            if (!currentConfig || (!currentConfig.apiKey && currentConfig.provider !== 'custom')) {
                setIsApiSettingsOpen(true);
                addBotMessage(
                  "Please configure and save your API key in the settings modal first.",
                  undefined, 
                  undefined, 
                  undefined, 
                  true,
                  false,
                  undefined,
                  undefined,
                  currentMode
                );
                setIsLoading(false);
                return;
            }

            const result = await AiService.generateUniversalResponse(
                currentText, 
                currentAtt, 
                activeModel,
                currentConfig,
                language, 
                responseLength,
                reasoningLevel,
                AppMode.SOLVE
            );
            addBotMessage(
              result.text, 
              undefined, 
              undefined, 
              undefined, 
              false, 
              false, 
              result.modelName, 
              result.provider,
              currentMode
            );
        } 
        else if (currentMode === AppMode.MAP) {
            // Get location first with robust error containment
            navigator.geolocation.getCurrentPosition(
              async (pos) => {
                try {
                  const result = await GeminiService.generateMapResponse(
                      currentText, 
                      pos.coords, 
                      language,
                      reasoningLevel,
                      responseLength,
                      currentAtt
                  );
                  addBotMessage(result.text, undefined, undefined, result.mapLinks, false, false, 'Gemini Maps Engine', 'gemini', currentMode);
                } catch (mapErr: any) {
                  const errMsg = mapErr?.message || String(mapErr);
                  addBotMessage(`Map Engine Notice: ${errMsg}`, undefined, undefined, undefined, true, false, undefined, undefined, currentMode);
                } finally {
                  setIsLoading(false);
                }
              }, 
              async (_geoErr) => {
                try {
                  const result = await GeminiService.generateMapResponse(
                      currentText, 
                      null, 
                      language,
                      reasoningLevel,
                      responseLength,
                      currentAtt
                  );
                  addBotMessage(result.text + "\n*(Location unavailable)*", undefined, undefined, result.mapLinks, false, false, 'Gemini Maps Engine', 'gemini', currentMode);
                } catch (mapErr: any) {
                  const errMsg = mapErr?.message || String(mapErr);
                  addBotMessage(`Map Engine Notice: ${errMsg}`, undefined, undefined, undefined, true, false, undefined, undefined, currentMode);
                } finally {
                  setIsLoading(false);
                }
              },
              { timeout: 8000, maximumAge: 60000 }
            );
        }
        else if (currentMode === AppMode.MEDIA) {
            if (mediaTab === 'gen') {
                const result = await AiService.generateImageUniversal(
                  currentText, 
                  imgConfig, 
                  activeImageModel, 
                  apiKeys
                );
                addBotMessage(
                  `Generated Image for: "${currentText}"`, 
                  result.url || undefined, 
                  undefined, 
                  undefined, 
                  false, 
                  false, 
                  result.providerName, 
                  result.provider,
                  currentMode
                );
            } else if (mediaTab === 'edit') {
                if (!currentAtt || currentAtt.type !== 'image') throw new Error("Image required for editing");
                const imgUrl = await GeminiService.editImage(currentText, currentAtt);
                addBotMessage(`Edited Image: "${currentText}"`, imgUrl || undefined, undefined, undefined, false, false, 'Gemini Image Studio', 'gemini', currentMode);
            } else if (mediaTab === 'video' || mediaTab === 'gif') {
                if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
                    const videoUrl = await GeminiService.generateVideo(currentText, veoConfig);
                    const isGif = mediaTab === 'gif';
                    addBotMessage(`Generated ${isGif ? 'GIF' : 'Video'} for: "${currentText}"`, undefined, videoUrl, undefined, false, isGif, 'Veo Generator', 'gemini', currentMode);
                } else if (window.aistudio) {
                    await window.aistudio.openSelectKey();
                    addBotMessage("API Key selected. Please retry your request.", undefined, undefined, undefined, false, false, undefined, undefined, currentMode);
                } else {
                     addBotMessage("Veo requires a paid API key mechanism not present in this environment.", undefined, undefined, undefined, true, false, undefined, undefined, currentMode);
                }
            }
        }
    } catch (err: any) {
        const errorMsg = err?.message || "An error occurred while processing your request.";
        addBotMessage(`Processing Notice: ${errorMsg}`, undefined, undefined, undefined, true, false, undefined, undefined, currentMode);
        console.warn("Handled processing error:", errorMsg);
    } finally {
        if (currentMode !== AppMode.MAP) setIsLoading(false);
        if (currentMode === AppMode.MAP) setTimeout(() => setIsLoading(false), 2000);
    }
  };

  const addBotMessage = (
    text: string, 
    imageUrl?: string, 
    videoUrl?: string, 
    mapLinks?: any[], 
    isError?: boolean, 
    isGif?: boolean,
    modelName?: string,
    provider?: AIProviderType,
    msgMode?: AppMode
  ) => {
    setChatHistory(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text,
        mode: msgMode || mode,
        imageUrl,
        videoUrl,
        mapLinks,
        isError,
        isGif,
        modelName,
        provider
    }]);
  };


  const handlePromptGen = async () => {
      if(!promptTopic || !promptModel) return;
      setIsLoading(true);
      try {
        const res = await GeminiService.generatePromptHelp(promptTopic, promptModel);
        setPromptResult(res);
      } catch (e) {
          console.error(e);
      } finally {
          setIsLoading(false);
      }
  };


  // --- Renderers ---

  const renderFloatingModeDock = () => (
    <div className="flex items-center justify-center px-3 py-1.5 z-20 shrink-0">
      <div className="inline-flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-2xl border border-slate-700/80 shadow-2xl max-w-full overflow-x-auto no-scrollbar">
        {ORDERED_MODES.map((item) => {
          const isActive = mode === item.mode;
          return (
            <button
              key={item.mode}
              type="button"
              onClick={() => setMode(item.mode)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 select-none whitespace-nowrap ${
                isActive
                  ? 'bg-eng-accent text-eng-dark shadow-md shadow-eng-accent/30 scale-102'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
              }`}
              title={`Mode: ${item.labelEn}`}
            >
              <i className={`fas ${item.icon} text-xs`}></i>
              <span className="font-sans">{item.labelEn}</span>
            </button>
          );
        })}

        {/* Separator */}
        <div className="w-[1px] h-4 bg-slate-700/80 mx-0.5 shrink-0" />

        {/* Live Voice Quick Mode */}
        <button
          type="button"
          onClick={handleStartLive}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-200 hover:bg-rose-950/60 transition-all border border-rose-500/30 whitespace-nowrap shrink-0"
          title="Live Interactive Voice Session"
        >
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          <i className="fas fa-tower-broadcast text-xs"></i>
          <span className="hidden sm:inline">Live Voice</span>
        </button>
      </div>
    </div>
  );

  const renderHeader = () => (
    <div className="h-16 border-b border-slate-700 bg-eng-dark/95 backdrop-blur flex items-center pl-3 pr-3 md:pl-4 md:pr-6 sticky top-0 z-30 gap-2 md:gap-4 overflow-x-auto no-scrollbar">
      <h1 className="text-xl font-extrabold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-eng-accent to-purple-500 drop-shadow-sm whitespace-nowrap shrink-0">
        MECHENG
      </h1>
      
      <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
        {/* Unified Dual-Slider Reasoning & Response Length Control */}
        <ReasoningControl
          currentLevel={reasoningLevel}
          onChangeLevel={handleReasoningLevelChange}
          responseLength={responseLength}
          onChangeResponseLength={handleResponseLengthChange}
          activeProvider={activeModel.provider}
          activeModelId={activeModel.modelId}
        />

        {/* Add API / Keys Header Trigger */}
        <button
          onClick={() => setIsApiSettingsOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-eng-accent/50 text-slate-300 hover:text-white rounded-lg text-xs font-semibold shrink-0 transition-colors ml-auto"
          title="Configure API keys and models"
        >
          <i className="fas fa-key text-eng-accent text-[11px]"></i>
          <span className="hidden sm:inline">API Keys</span>
          <span className="text-[10px] bg-slate-900 border border-slate-700 px-1.5 py-0.2 rounded-full text-eng-accent tabular-nums font-mono">
            {apiKeys.length}
          </span>
        </button>
      </div>
    </div>
  );

  const renderChatBubble = (msg: ChatMessage) => (
    <div key={msg.id} className={`flex w-full mb-6 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[80%] rounded-2xl p-4 border ${
            msg.role === 'user' 
                ? 'bg-eng-accent/10 border-eng-accent/30 text-white rounded-br-none' 
                : 'bg-eng-panel border-slate-700 text-slate-200 rounded-bl-none'
        } ${msg.isError ? 'border-eng-danger/50 bg-eng-danger/10' : ''}`}>
            
            {/* Model Badge Header on Bot Messages */}
            {msg.role === 'model' && (msg.modelName || msg.provider) && (
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-700/60 text-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span className="font-bold text-slate-300">
                        {msg.provider ? (AiService.PROVIDER_METAS[msg.provider]?.name || msg.provider) : 'AI'}
                    </span>
                    <span className="text-slate-500">·</span>
                    <span className="font-mono text-eng-accent text-[11px] bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                        {msg.modelName}
                    </span>
                </div>
            )}

            {/* User uploaded attachment */}
            {msg.attachment && msg.role === 'user' && (
                <div className="mb-2">
                    {msg.attachment.type === 'image' ? (
                        <img src={`data:${msg.attachment.mimeType};base64,${msg.attachment.data}`} alt="User Upload" className="max-w-xs rounded-lg border border-white/10" />
                    ) : (
                        <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg border border-white/10">
                            <i className={`fas text-xl ${
                                msg.attachment.type === 'video' ? 'fa-file-video text-pink-400' :
                                msg.attachment.type === 'audio' ? 'fa-file-audio text-purple-400' :
                                'fa-file-lines text-blue-400'
                            }`}></i>
                            <div className="overflow-hidden">
                                <div className="text-xs font-bold truncate">{msg.attachment.name}</div>
                                <div className="text-[10px] text-slate-400 uppercase">{msg.attachment.type}</div>
                            </div>
                        </div>
                    )}
                </div>
            )}
            {/* Legacy image support */}
            {msg.imageUrl && msg.role === 'user' && !msg.attachment && (
                <img src={msg.imageUrl} alt="User Upload" className="max-w-xs rounded-lg mb-2 border border-white/10" />
            )}

            {/* Text Content */}
            <div className="prose prose-invert prose-sm whitespace-pre-wrap leading-relaxed">
                {msg.text}
            </div>

            {/* Generated Image */}
            {(msg.imageUrl || (msg.attachment?.type === 'image' && msg.role === 'model')) && msg.role === 'model' && (
                 <div className="mt-3">
                    <img src={msg.imageUrl || `data:${msg.attachment?.mimeType};base64,${msg.attachment?.data}`} alt="Generated" className="rounded-lg border border-slate-600 shadow-lg" />
                    <a href={msg.imageUrl} download="generated.png" className="text-xs text-eng-accent mt-1 inline-block hover:underline">Download Image</a>
                </div>
            )}

            {/* Generated Video / GIF */}
            {msg.videoUrl && msg.role === 'model' && (
                <div className="mt-3">
                    <video 
                        src={msg.videoUrl} 
                        controls={!msg.isGif} 
                        autoPlay={msg.isGif} 
                        loop={msg.isGif} 
                        muted={msg.isGif}
                        playsInline={msg.isGif}
                        className="rounded-lg border border-slate-600 w-full max-w-sm" 
                    />
                </div>
            )}

             {/* Map Links */}
             {msg.mapLinks && msg.mapLinks.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                    {msg.mapLinks.map((link, idx) => (
                        <a key={idx} href={link.uri} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-1 bg-green-900/30 text-green-400 text-xs rounded border border-green-800 hover:bg-green-900/50">
                            <i className="fas fa-location-dot"></i> {link.title}
                        </a>
                    ))}
                </div>
            )}
        </div>
    </div>
  );

  const renderInputArea = () => (
    <div className="p-3 sm:p-4 bg-eng-dark/95 backdrop-blur border-t border-slate-700/80 w-full shrink-0">
        {/* Attachments Preview */}
        {attachment && (
            <div className="relative inline-block mb-2 group">
                {attachment.type === 'image' ? (
                    <img src={`data:${attachment.mimeType};base64,${attachment.data}`} alt="preview" className="h-16 rounded-xl border border-slate-600 shadow-md" />
                ) : (
                    <div className="h-16 w-52 bg-slate-800 rounded-xl border border-slate-600 flex items-center p-3 gap-3 shadow-md">
                        <i className={`fas text-xl ${
                             attachment.type === 'video' ? 'fa-file-video text-pink-400' :
                             attachment.type === 'audio' ? 'fa-file-audio text-purple-400' :
                             'fa-file-alt text-blue-400'
                        }`}></i>
                        <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">{attachment.name}</div>
                            <div className="text-[10px] text-slate-400">{attachment.mimeType}</div>
                        </div>
                    </div>
                )}
                <button 
                  type="button" 
                  onClick={() => setAttachment(null)} 
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md hover:bg-red-600 transition-colors"
                  title="Remove attachment"
                >
                    <i className="fas fa-times"></i>
                </button>
            </div>
        )}

        {/* Full-width unified input box with embedded mic & paperclip */}
        <div className="w-full relative flex items-center bg-slate-900 border border-slate-700/90 rounded-2xl px-2.5 py-1.5 shadow-lg focus-within:border-eng-accent focus-within:ring-1 focus-within:ring-eng-accent/40 transition-all">
            {/* Paperclip attachment icon inside input box */}
            <label 
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors shrink-0" 
              title="Attach image, document or file"
            >
                <input type="file" accept="image/*,video/*,audio/*,text/*,application/pdf,.json,.csv" className="hidden" onChange={handleFileUpload} />
                <i className="fas fa-paperclip text-sm"></i>
            </label>

            {/* Input textarea expanding across available width */}
            <textarea 
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                    }
                }}
                placeholder={
                    mode === AppMode.SOLVE ? "Type your prompt or question here, or tap the mic..." :
                    mode === AppMode.MEDIA ? "Describe the image or media you want to generate..." :
                    mode === AppMode.MAP ? "Search locations, routes, and maps..." :
                    "Enter details to engineer your prompt..."
                }
                className="flex-1 bg-transparent border-0 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none resize-none leading-relaxed min-h-[40px] max-h-32"
                rows={1}
            />

            {/* Embedded Action buttons inside the right corner */}
            <div className="flex items-center gap-1 shrink-0">
                {/* Embedded Microphone Icon Button */}
                <button
                  type="button"
                  onClick={handleToggleMic}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                    isListening 
                      ? 'bg-red-500 text-white animate-pulse shadow-md shadow-red-500/50' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title={isListening ? "Stop voice recording" : "Voice input (Speech to text)"}
                >
                  <i className={`fas ${isListening ? 'fa-microphone-slash' : 'fa-microphone'} text-sm`}></i>
                </button>

                {/* Send Button */}
                <button 
                    type="button"
                    onClick={handleSend}
                    disabled={isLoading || (!textInput.trim() && !attachment && mode !== AppMode.PROMPT)}
                    className="w-9 h-9 rounded-xl bg-eng-accent text-eng-dark font-bold hover:bg-sky-400 transition-all disabled:opacity-40 disabled:hover:bg-eng-accent flex items-center justify-center shadow-md shadow-eng-accent/20 shrink-0"
                    title="Send"
                >
                    {isLoading ? <i className="fas fa-spinner fa-spin text-sm"></i> : <i className="fas fa-paper-plane text-sm"></i>}
                </button>
            </div>
        </div>
    </div>
  );

  const renderMediaControls = () => {
      return (
      <div className="p-4 border-b border-slate-700 bg-eng-panel/50">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex gap-4">
                  <button onClick={() => setMediaTab('gen')} className={`pb-2 text-sm font-bold border-b-2 ${mediaTab === 'gen' ? 'border-eng-accent text-white' : 'border-transparent text-slate-500'}`}>GENERATE IMG</button>
                  <button onClick={() => setMediaTab('edit')} className={`pb-2 text-sm font-bold border-b-2 ${mediaTab === 'edit' ? 'border-eng-accent text-white' : 'border-transparent text-slate-500'}`}>EDIT IMG</button>
                  <button onClick={() => setMediaTab('video')} className={`pb-2 text-sm font-bold border-b-2 ${mediaTab === 'video' ? 'border-eng-accent text-white' : 'border-transparent text-slate-500'}`}>GENERATE VIDEO</button>
                  <button onClick={() => setMediaTab('gif')} className={`pb-2 text-sm font-bold border-b-2 ${mediaTab === 'gif' ? 'border-eng-accent text-white' : 'border-transparent text-slate-500'}`}>GENERATE GIF</button>
              </div>
          </div>
          
          <div className="flex gap-4 items-center">
             {mediaTab === 'gen' || mediaTab === 'edit' ? (
                 <>
                    <select 
                        value={imgConfig.aspectRatio} 
                        onChange={(e) => setImgConfig({...imgConfig, aspectRatio: e.target.value as any})}
                        className="bg-slate-800 text-xs text-white p-2 rounded border border-slate-700"
                    >
                        <option value="1:1">1:1 (Square)</option>
                        <option value="16:9">16:9 (Landscape)</option>
                        <option value="9:16">9:16 (Portrait)</option>
                        <option value="3:4">3:4</option>
                        <option value="4:3">4:3</option>
                    </select>
                    <select 
                        value={imgConfig.imageSize} 
                        onChange={(e) => setImgConfig({...imgConfig, imageSize: e.target.value as any})}
                        className="bg-slate-800 text-xs text-white p-2 rounded border border-slate-700"
                    >
                        <option value="1K">1K</option>
                        <option value="2K">2K (Pro)</option>
                        <option value="4K">4K (Pro)</option>
                    </select>
                 </>
             ) : (
                <>
                    <select 
                        value={veoConfig.aspectRatio} 
                        onChange={(e) => setVeoConfig({...veoConfig, aspectRatio: e.target.value as any})}
                        className="bg-slate-800 text-xs text-white p-2 rounded border border-slate-700"
                    >
                        <option value="16:9">16:9 (Landscape)</option>
                        <option value="9:16">9:16 (Portrait)</option>
                    </select>
                    <select 
                        value={veoConfig.resolution} 
                        onChange={(e) => setVeoConfig({...veoConfig, resolution: e.target.value as any})}
                        className="bg-slate-800 text-xs text-white p-2 rounded border border-slate-700"
                    >
                        <option value="720p">720p</option>
                        <option value="1080p">1080p</option>
                    </select>
                </>
             )}
          </div>
          {mediaTab === 'edit' && !attachment && (
              <div className="mt-2 text-xs text-eng-warning animate-pulse">
                  <i className="fas fa-exclamation-triangle"></i> Please upload a photo to edit below.
              </div>
          )}
      </div>
    );
  };

  const renderPromptMode = () => (
      <div className="p-8 flex flex-col gap-6 max-w-3xl mx-auto w-full">
          <div className="bg-eng-panel p-6 rounded-2xl border border-slate-700">
              <h2 className="text-xl font-bold mb-4 text-eng-accent"><i className="fas fa-wand-magic-sparkles mr-2"></i>Prompt Engineer</h2>
              <div className="grid gap-4">
                  <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">TOPIC / KEYWORD</label>
                      <input 
                        type="text" 
                        value={promptTopic} 
                        onChange={e => setPromptTopic(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-600 rounded p-3 text-white focus:border-eng-accent focus:outline-none"
                        placeholder="e.g., Thermodynamic Cycle of a Steam Engine"
                      />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">TARGET MODEL</label>
                      <input 
                        type="text" 
                        value={promptModel} 
                        onChange={e => setPromptModel(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-600 rounded p-3 text-white focus:border-eng-accent focus:outline-none"
                        placeholder="e.g., Gemini 1.5 Pro, GPT-4, Stable Diffusion"
                      />
                  </div>
                  <button 
                    onClick={handlePromptGen}
                    disabled={isLoading || !promptTopic || !promptModel}
                    className="bg-eng-accent text-eng-dark font-bold py-3 rounded hover:bg-sky-400 transition-colors disabled:opacity-50"
                  >
                      {isLoading ? 'Generating Strategy...' : 'Optimize Prompt'}
                  </button>
              </div>
          </div>

          {promptResult && (
              <div className="bg-slate-800 p-6 rounded-2xl border border-eng-accent/20">
                  <h3 className="text-white font-bold mb-4 border-b border-slate-700 pb-2">Optimization Result</h3>
                  <div className="prose prose-invert max-w-none">
                      {promptResult.split('\n').map((line, i) => (
                          <p key={i} className="mb-2">{line}</p>
                      ))}
                  </div>
              </div>
          )}
      </div>
  );

  const renderOfflineMode = () => (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
          <i className="fas fa-wifi text-6xl mb-4 text-slate-700"></i>
          <h2 className="text-2xl font-bold text-white mb-2">Offline Mode</h2>
          <p className="max-w-md">The Omni-Bot requires an active internet connection to access Gemini Intelligence. Falling back to internal logic modules (Physics definitions only).</p>
      </div>
  );

  // Isolate conversation history per mode so text outputs and image/media outputs are cleanly separated
  const displayedChatHistory = chatHistory.filter(msg => {
    if (msg.mode) {
      return msg.mode === mode;
    }
    // Backward-compatibility fallback for existing or untagged messages
    if (mode === AppMode.MEDIA) {
      return Boolean(msg.imageUrl || msg.videoUrl);
    }
    if (mode === AppMode.MAP) {
      return Boolean(msg.mapLinks && msg.mapLinks.length > 0);
    }
    return !msg.imageUrl && !msg.videoUrl && (!msg.mapLinks || msg.mapLinks.length === 0);
  });

  return (
    <div 
      className="flex flex-col h-screen w-full bg-eng-dark font-sans overflow-hidden select-text relative"
    >
      <LiveSession isActive={isLiveActive} stream={activeStream} onClose={handleStopLive} />
      
      {/* Swipe notification badge when switching modes via touch gestures */}
      {swipeNotice && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-slate-900/95 border border-eng-accent/50 text-eng-accent text-xs font-bold rounded-full shadow-2xl animate-fade-in flex items-center gap-2 pointer-events-none">
          <i className="fas fa-arrows-left-right text-xs"></i>
          <span>Switched to: {swipeNotice}</span>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {renderHeader()}
        
        {mode === AppMode.OFFLINE ? renderOfflineMode() : 
         mode === AppMode.PROMPT ? (
             <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                 <div 
                   className="flex-1 overflow-y-auto custom-scrollbar touch-pan-y"
                   onTouchStart={handleTouchStart}
                   onTouchEnd={handleTouchEnd}
                 >
                     {renderPromptMode()}
                 </div>
                 {/* Floating dock & model selector */}
                 {renderFloatingModeDock()}
                 <ModelSelectorBar
                   keys={apiKeys}
                   currentMode={mode}
                   activeSelection={activeModel}
                   activeImageModel={activeImageModel}
                   onSelectModel={handleSelectModel}
                   onSelectImageModel={handleSelectImageModel}
                   onOpenSettings={() => setIsApiSettingsOpen(true)}
                 />
                 {renderInputArea()}
             </div>
         ) : (
             <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                 {mode === AppMode.MEDIA && renderMediaControls()}
                 <div 
                   className="flex-1 overflow-y-auto p-4 custom-scrollbar touch-pan-y"
                   onTouchStart={handleTouchStart}
                   onTouchEnd={handleTouchEnd}
                 >
                    {displayedChatHistory.length === 0 && (
                        <div className="h-full flex items-center justify-center text-slate-600 italic">
                            {mode === AppMode.SOLVE && "Ready to assist with questions, problem solving, and analysis..."}
                            {mode === AppMode.MEDIA && "Ready to generate and edit images and media..."}
                            {mode === AppMode.MAP && "Ready to search maps, routes, and geographic locations..."}
                        </div>
                    )}
                    {displayedChatHistory.map(renderChatBubble)}
                    {isLoading && (
                        <div className="flex justify-start mb-6">
                            <div className="bg-eng-panel px-4 py-2 rounded-2xl rounded-bl-none text-slate-400 text-sm flex items-center gap-2">
                                <i className="fas fa-circle-notch fa-spin text-eng-accent"></i> 
                                {mode === AppMode.SOLVE ? (reasoningLevel !== 'off' ? `Deep reasoning in progress (${REASONING_TIERS[reasoningLevel].shortLabel})...` : 'Analyzing and responding...') : 'Processing...'}
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                 </div>

                 {/* Compact Floating Mode Dock positioned above bottom input */}
                 {renderFloatingModeDock()}

                 {/* Bottom Model Selector Bar docked immediately above input area */}
                 <ModelSelectorBar
                   keys={apiKeys}
                   currentMode={mode}
                   activeSelection={activeModel}
                   activeImageModel={activeImageModel}
                   onSelectModel={handleSelectModel}
                   onSelectImageModel={handleSelectImageModel}
                   onOpenSettings={() => setIsApiSettingsOpen(true)}
                 />
                 {renderInputArea()}
             </div>
         )
        }
      </div>

      {/* Universal Multi-AI Provider Settings Modal */}
      <ApiSettingsModal
        isOpen={isApiSettingsOpen}
        onClose={() => setIsApiSettingsOpen(false)}
        keys={apiKeys}
        onSaveKeys={handleSaveKeys}
        onSelectModel={handleSelectModel}
        currentKeyId={activeModel.keyId}
      />
    </div>
  );
};


export default App;