import React, { useState, useRef, useEffect } from 'react';
import { AIKeyConfig, ActiveModelSelection, AIProviderType, AppMode } from '../types';
import { 
  PROVIDER_METAS, 
  detectModelCapabilities, 
  CAPABILITY_METAS,
  getImageModelOptions,
  ImageModelOption
} from '../services/aiService';

interface ModelSelectorBarProps {
  keys: AIKeyConfig[];
  currentMode: AppMode;
  activeSelection: ActiveModelSelection;
  activeImageModel: {
    keyId: string;
    provider: AIProviderType;
    modelId: string;
    displayName: string;
  };
  onSelectModel: (keyId: string, modelId: string) => void;
  onSelectImageModel: (option: {
    keyId: string;
    provider: AIProviderType;
    modelId: string;
    displayName: string;
  }) => void;
  onOpenSettings: () => void;
}

export const ModelSelectorBar: React.FC<ModelSelectorBarProps> = ({
  keys,
  currentMode,
  activeSelection,
  activeImageModel,
  onSelectModel,
  onSelectImageModel,
  onOpenSettings
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isImageMode = currentMode === AppMode.MEDIA;

  // 1. Image Mode Options: Only models that support image generation
  const imageOptions = isImageMode 
    ? getImageModelOptions(keys).filter(o => o.supportsImages)
    : [];

  const activeImageOption = isImageMode 
    ? (imageOptions.find(o => o.keyId === activeImageModel.keyId && o.modelId === activeImageModel.modelId) || imageOptions[0])
    : null;

  // 2. Text / General Mode Options:
  // ONLY models from keys that are enabled AND have an entered API key (or built-in zero-key gemini)
  const textOptions: Array<{
    keyId: string;
    keyLabel: string;
    provider: AIProviderType;
    modelId: string;
    isCurrent: boolean;
  }> = [];

  if (!isImageMode) {
    keys.filter(k => k.isEnabled).forEach(k => {
      // Must be built-in default or have an entered API key (or custom endpoint)
      const isBuiltIn = k.id === 'built-in-gemini';
      const hasKey = Boolean(k.apiKey && k.apiKey.trim().length > 0);
      const isCustomEndpoint = k.provider === 'custom' && Boolean(k.baseUrl && k.baseUrl.trim().length > 0);

      if (!isBuiltIn && !hasKey && !isCustomEndpoint) {
        return; // Exclude models that require an unprovided API key!
      }

      const meta = PROVIDER_METAS[k.provider] || PROVIDER_METAS.custom;
      const models = Array.from(new Set([
        k.selectedModel,
        ...(k.availableModels || [])
      ])).filter(Boolean);

      models.forEach(m => {
        const caps = detectModelCapabilities(k.provider, m);
        const supportsText = caps.some(c => c === 'text' || c === 'code' || c === 'reasoning');
        // Exclude image-only models (like DALL-E, Nano Banana, Flux, SDXL, Imagen, etc. that do not support text)
        const isPureImageGen = caps.length === 1 && caps[0] === 'image';
        const isKnownImageOnly = /(dall-?e|flux|stable-?diffusion|sdxl|imagen|recraft|banana)/i.test(m);
        
        if (supportsText && !isPureImageGen && !isKnownImageOnly) {
          textOptions.push({
            keyId: k.id,
            keyLabel: k.label || meta.name,
            provider: k.provider,
            modelId: m,
            isCurrent: k.id === activeSelection.keyId && m === activeSelection.modelId
          });
        }
      });
    });
  }

  // Active Meta & Display details based on mode
  const currentTextOpt = textOptions.find(o => o.keyId === activeSelection.keyId && o.modelId === activeSelection.modelId) || textOptions[0];
  const activeKey = keys.find(k => k.id === (currentTextOpt?.keyId || activeSelection.keyId) && k.isEnabled);

  const textActiveMeta = activeKey 
    ? (PROVIDER_METAS[activeKey.provider] || PROVIDER_METAS.custom) 
    : (PROVIDER_METAS[activeSelection.provider] || PROVIDER_METAS.gemini);

  const imageActiveMeta = activeImageModel.provider 
    ? (PROVIDER_METAS[activeImageModel.provider] || PROVIDER_METAS.gemini)
    : PROVIDER_METAS.gemini;

  const currentMeta = isImageMode ? imageActiveMeta : textActiveMeta;

  const displayedLabel = isImageMode ? 'Image Engine:' : 'Active Model:';
  const displayedTitle = isImageMode
    ? (activeImageOption?.displayName || activeImageModel.displayName || 'Nano Banana (Free · No API Key)')
    : (currentTextOpt ? currentTextOpt.modelId : (activeKey ? activeSelection.modelId : 'gemini-3.8-flash'));

  const displayedSubLabel = isImageMode
    ? (currentMeta.name)
    : (currentTextOpt ? currentTextOpt.keyLabel : (activeKey?.label || textActiveMeta.name));

  return (
    <div className="px-3 sm:px-4 py-2 bg-slate-900/95 border-t border-slate-800 flex items-center justify-between gap-3 text-xs z-10 shrink-0">
      
      {/* Left: Active Model Selector Dropdown */}
      <div className="relative flex-1 max-w-lg min-w-0" ref={dropdownRef}>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider hidden sm:inline flex items-center gap-1.5 shrink-0">
            <i className={`fas ${isImageMode ? 'fa-palette text-eng-accent' : 'fa-brain text-eng-accent'}`}></i>
            <span>{displayedLabel}</span>
          </span>
          
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-left bg-slate-800/90 hover:bg-slate-800 border-slate-700 hover:border-slate-600 text-white shadow-sm max-w-full truncate"
          >
            {/* Provider Icon Badge */}
            <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] shrink-0 ${currentMeta.badgeBg} ${currentMeta.badgeText} border ${currentMeta.badgeBorder}`}>
              <i className={`fas ${currentMeta.icon}`}></i>
            </span>

            {/* Model Name & Provider */}
            <span className="font-bold text-slate-100 truncate max-w-[150px] sm:max-w-[220px]">
              {displayedTitle}
            </span>

            <span className="text-[10px] text-slate-400 border-l border-slate-700 pl-1.5 hidden xs:inline truncate">
              {displayedSubLabel}
            </span>

            {/* Capability Pill */}
            {isImageMode ? (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                IMAGE GEN
              </span>
            ) : (
              (() => {
                const activeCaps = detectModelCapabilities(activeSelection.provider || 'gemini', activeSelection.modelId);
                return (
                  <div className="hidden sm:flex items-center gap-1 border-l border-slate-700 pl-1.5 shrink-0">
                    {activeCaps.slice(0, 3).map(cap => (
                      <span key={cap} className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        {cap}
                      </span>
                    ))}
                  </div>
                );
              })()
            )}

            {/* Status dot */}
            <span 
              className={`w-2 h-2 rounded-full shrink-0 ${
                isImageMode
                  ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                  : (activeKey?.status === 'connected' ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 
                     activeKey?.status === 'error' ? 'bg-rose-400' : 'bg-eng-accent')
              }`} 
              title={isImageMode ? 'Image engine ready' : (activeKey?.status === 'connected' ? 'Connected & Verified' : 'Ready')}
            />

            <i className={`fas fa-chevron-down text-[10px] text-slate-400 transition-transform ml-auto shrink-0 ${isOpen ? 'rotate-180' : ''}`}></i>
          </button>
        </div>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute bottom-full left-0 mb-2 w-72 sm:w-88 bg-eng-dark border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 max-h-80 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="p-2.5 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between shrink-0">
              <span className="font-bold text-white text-xs flex items-center gap-1.5">
                <i className={`fas ${isImageMode ? 'fa-palette text-eng-accent' : 'fa-microchip text-eng-accent'}`}></i>
                <span>{isImageMode ? 'Select Image Generation Engine' : 'Select AI Model'}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenSettings();
                }}
                className="text-[11px] text-eng-accent hover:underline flex items-center gap-1 font-semibold"
              >
                <i className="fas fa-gear text-[10px]"></i>
                <span>Manage Keys</span>
              </button>
            </div>

            <div className="overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
              {isImageMode ? (
                // Image Generation Engines List
                imageOptions.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-xs">
                    No image engines found.
                  </div>
                ) : (
                  imageOptions.map((opt, idx) => {
                    const meta = PROVIDER_METAS[opt.provider] || PROVIDER_METAS.gemini;
                    const isCurrent = opt.keyId === activeImageModel.keyId && opt.modelId === activeImageModel.modelId;
                    return (
                      <button
                        key={`${opt.keyId}_${opt.modelId}_${idx}`}
                        type="button"
                        onClick={() => {
                          onSelectImageModel({
                            keyId: opt.keyId,
                            provider: opt.provider,
                            modelId: opt.modelId,
                            displayName: opt.displayName
                          });
                          setIsOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors ${
                          isCurrent
                            ? 'bg-eng-accent/15 border border-eng-accent/40 text-white'
                            : 'hover:bg-slate-800/70 text-slate-300 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] shrink-0 ${meta.badgeBg} ${meta.badgeText} border ${meta.badgeBorder}`}>
                            <i className={`fas ${meta.icon}`}></i>
                          </span>
                          <div className="truncate">
                            <div className="font-semibold text-xs text-white truncate flex items-center gap-1.5">
                              <span>{opt.displayName}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                              <span className="truncate">{meta.name}</span>
                              <span>·</span>
                              <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-[9px] uppercase font-mono font-bold text-emerald-300 border border-emerald-500/30">
                                {opt.badge}
                              </span>
                            </div>
                          </div>
                        </div>

                        {isCurrent && (
                          <i className="fas fa-check text-eng-accent text-xs ml-2 shrink-0"></i>
                        )}
                      </button>
                    );
                  })
                )
              ) : (
                // Text / Reasoning Models List (Image-only models filtered out)
                textOptions.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-xs">
                    No paired models. Click "+ Add API" to enter an API key.
                  </div>
                ) : (
                  textOptions.map((opt, idx) => {
                    const meta = PROVIDER_METAS[opt.provider] || PROVIDER_METAS.custom;
                    return (
                      <button
                        key={`${opt.keyId}_${opt.modelId}_${idx}`}
                        type="button"
                        onClick={() => {
                          onSelectModel(opt.keyId, opt.modelId);
                          setIsOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors ${
                          opt.isCurrent
                            ? 'bg-eng-accent/15 border border-eng-accent/40 text-white'
                            : 'hover:bg-slate-800/70 text-slate-300 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] shrink-0 ${meta.badgeBg} ${meta.badgeText} border ${meta.badgeBorder}`}>
                            <i className={`fas ${meta.icon}`}></i>
                          </span>
                          <div className="truncate">
                            <div className="font-semibold text-xs text-white truncate">{opt.modelId}</div>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                              <span className="truncate">{opt.keyLabel}</span>
                              <span>·</span>
                              <div className="flex items-center gap-1 flex-wrap">
                                {(() => {
                                  const optCaps = detectModelCapabilities(opt.provider, opt.modelId);
                                  return (
                                    <>
                                      {optCaps.slice(0, 3).map(cap => (
                                        <span key={cap} className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-[9px] uppercase font-mono font-bold text-emerald-300 border border-emerald-500/30 flex items-center gap-0.5">
                                          <i className={`fas ${CAPABILITY_METAS[cap]?.icon || 'fa-check'} text-[7px] text-emerald-400`}></i>
                                          {cap}
                                        </span>
                                      ))}
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>

                        {opt.isCurrent && (
                          <i className="fas fa-check text-eng-accent text-xs ml-2 shrink-0"></i>
                        )}
                      </button>
                    );
                  })
                )
              )}
            </div>

            <div className="p-2 bg-slate-900 border-t border-slate-800 text-center shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenSettings();
                }}
                className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <i className="fas fa-plus text-eng-accent"></i>
                <span>Add New API Key (+ Add API)</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right: Add API Button and Settings Trigger */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenSettings}
          className="px-3 py-1.5 rounded-xl bg-eng-accent/15 hover:bg-eng-accent/25 text-eng-accent border border-eng-accent/30 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
          title="Add API Key or Configure Providers"
        >
          <i className="fas fa-key text-[11px]"></i>
          <span>+ Add API</span>
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 flex items-center justify-center transition-colors"
          title="Settings & Provider Management"
        >
          <i className="fas fa-sliders text-xs"></i>
        </button>
      </div>

    </div>
  );
};

export default ModelSelectorBar;
