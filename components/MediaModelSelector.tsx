import React, { useState, useRef, useEffect } from 'react';
import { AIKeyConfig, AIProviderType } from '../types';
import { getImageModelOptions, ImageModelOption, PROVIDER_METAS } from '../services/aiService';

interface MediaModelSelectorProps {
  keys: AIKeyConfig[];
  activeImageModel: {
    keyId: string;
    provider: AIProviderType;
    modelId: string;
    displayName: string;
  };
  onSelectImageModel: (option: {
    keyId: string;
    provider: AIProviderType;
    modelId: string;
    displayName: string;
  }) => void;
  onOpenSettings: () => void;
}

export const MediaModelSelector: React.FC<MediaModelSelectorProps> = ({
  keys,
  activeImageModel,
  onSelectImageModel,
  onOpenSettings
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tooltip, setTooltip] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setTooltip(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allOptions = getImageModelOptions(keys);
  const supportedOptions = allOptions.filter(o => o.supportsImages);
  const unsupportedOptions = allOptions.filter(o => !o.supportsImages);

  const activeOption = supportedOptions.find(
    o => o.keyId === activeImageModel.keyId && o.modelId === activeImageModel.modelId
  ) || supportedOptions[0];

  const activeMeta = activeOption
    ? (PROVIDER_METAS[activeOption.provider] || PROVIDER_METAS.gemini)
    : PROVIDER_METAS.gemini;

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Label and Trigger Button */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline flex items-center gap-1">
          <i className="fas fa-palette text-eng-accent"></i>
          <span>Image Engine:</span>
        </span>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-800/95 hover:bg-slate-800 text-white transition-all text-xs shadow-sm group"
          title="Select image generation engine"
        >
          {/* Provider Icon */}
          <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] ${activeMeta.badgeBg} ${activeMeta.badgeText} border ${activeMeta.badgeBorder}`}>
            <i className={`fas ${activeMeta.icon}`}></i>
          </span>

          {/* Model Display */}
          <span className="font-bold text-white max-w-[150px] sm:max-w-[210px] truncate">
            {activeImageModel.displayName || activeOption?.displayName || 'Select Image Model'}
          </span>

          {/* Capability Pill */}
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase">
            IMAGE
          </span>

          <i className={`fas fa-chevron-down text-[10px] text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
        </button>
      </div>

      {/* Tooltip / Notice Toast */}
      {tooltip && (
        <div className="absolute top-full left-0 mt-1.5 z-50 p-2.5 bg-rose-950 border border-rose-600 rounded-xl text-rose-200 text-xs shadow-xl max-w-xs animate-in fade-in slide-in-from-top-1">
          <div className="flex items-start gap-2">
            <i className="fas fa-circle-exclamation text-rose-400 mt-0.5"></i>
            <div className="flex-1 text-[11px] leading-tight">{tooltip}</div>
            <button type="button" onClick={() => setTooltip(null)} className="text-rose-400 hover:text-white">
              <i className="fas fa-times text-[10px]"></i>
            </button>
          </div>
        </div>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 sm:w-96 bg-eng-dark border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50 max-h-96 flex flex-col animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header */}
          <div className="p-3 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <i className="fas fa-wand-magic-sparkles text-eng-accent text-xs"></i>
              <span className="font-bold text-white text-xs">Image Generation Models</span>
            </div>
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

          <div className="overflow-y-auto p-2 space-y-3 custom-scrollbar text-xs">
            
            {/* Section 1: Image-Capable Models (Active / Selectable) */}
            <div>
              <div className="px-2 py-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <i className="fas fa-check-circle text-[9px]"></i>
                <span>Supported Image Engines</span>
              </div>
              <div className="space-y-1 mt-1">
                {supportedOptions.map((opt, idx) => {
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
                        setTooltip(null);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all ${
                        isCurrent
                          ? 'bg-eng-accent/15 border border-eng-accent/40 text-white shadow-sm'
                          : 'hover:bg-slate-800/80 text-slate-300 hover:text-white border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] ${meta.badgeBg} ${meta.badgeText} border ${meta.badgeBorder} shrink-0`}>
                          <i className={`fas ${meta.icon}`}></i>
                        </span>
                        <div className="truncate">
                          <div className="font-bold text-xs text-white truncate flex items-center gap-1.5">
                            <span>{opt.displayName}</span>
                            {opt.keyId === 'free-banana' && (
                              <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 rounded font-normal">
                                Free · No Key
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                            <span className="font-mono text-slate-300">{opt.modelId}</span>
                            <span>·</span>
                            <span>{meta.name}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          {opt.badge}
                        </span>
                        {isCurrent && (
                          <i className="fas fa-check text-eng-accent text-xs"></i>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Non-Image Models (Greyed Out / Disabled) */}
            {unsupportedOptions.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 border-t border-slate-800 pt-2">
                  <i className="fas fa-ban text-[9px] text-slate-500"></i>
                  <span>Text-Only Models (Unsupported for Images)</span>
                </div>
                <div className="space-y-1 mt-1">
                  {unsupportedOptions.map((opt, idx) => {
                    const meta = PROVIDER_METAS[opt.provider] || PROVIDER_METAS.custom;
                    return (
                      <div
                        key={`disabled_${opt.keyId}_${opt.modelId}_${idx}`}
                        onClick={() => {
                          setTooltip(opt.unsupportedReason || `${meta.name} is designed for text and does not support image generation.`);
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-xl text-left bg-slate-900/40 border border-slate-800/80 opacity-40 cursor-not-allowed hover:opacity-60 transition-opacity"
                        title={opt.unsupportedReason || "Does not support image generation"}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] bg-slate-800 text-slate-500 border border-slate-700 shrink-0`}>
                            <i className={`fas ${meta.icon}`}></i>
                          </span>
                          <div className="truncate">
                            <div className="font-semibold text-xs text-slate-400 truncate line-through">
                              {opt.displayName}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                              {opt.unsupportedReason || "Text only"}
                            </div>
                          </div>
                        </div>

                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 shrink-0 ml-2">
                          Text Only
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

          {/* Footer guidance */}
          <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span>
              <i className="fas fa-info-circle text-eng-accent mr-1"></i>
              Text-only models are disabled for image generation.
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-300 hover:text-white font-semibold text-xs"
            >
              Close
            </button>
          </div>

        </div>
      )}
    </div>
  );
};

export default MediaModelSelector;
