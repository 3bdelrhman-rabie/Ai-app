import React, { useState, useRef, useEffect } from 'react';
import { ActiveModelSelection, AIKeyConfig, AIProviderType } from '../types';
import { PROVIDER_METAS, maskApiKey, getAllKeysForModel, getModelInstanceInfo } from '../services/aiService';

interface ActiveApiKeySwitcherProps {
  activeModel: ActiveModelSelection;
  keys: AIKeyConfig[];
  onSelectKey: (keyId: string) => void;
  onOpenSettings: (tab?: 'models' | 'search_engine') => void;
}

export const ActiveApiKeySwitcher: React.FC<ActiveApiKeySwitcherProps> = ({
  activeModel,
  keys,
  onSelectKey,
  onOpenSettings
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeKeyConfig = keys.find(k => k.id === activeModel.keyId && k.isEnabled) || keys.find(k => k.isEnabled);
  const modelKeys = getAllKeysForModel(activeModel.modelId, keys);
  const activeKeyIndex = modelKeys.findIndex(k => k.id === activeKeyConfig?.id);
  const currentKeyNumber = activeKeyIndex >= 0 ? activeKeyIndex + 1 : 1;

  const providerMeta = activeKeyConfig ? (PROVIDER_METAS[activeKeyConfig.provider] || PROVIDER_METAS.custom) : PROVIDER_METAS.gemini;
  const isBuiltIn = activeKeyConfig?.id === 'built-in-gemini';
  const masked = isBuiltIn ? 'Default System Key' : maskApiKey(activeKeyConfig?.apiKey);
  const keyLabel = activeKeyConfig?.label || `API ${currentKeyNumber}`;

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      {/* Trigger Button in Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700/90 hover:border-eng-accent/60 text-white transition-all shadow-sm group select-none"
        title="تغيير مفتاح الـ API المستخدم حالياً أو إضافة مفتاح جديد"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse shrink-0" />
        
        <div className="flex items-center gap-1.5 text-xs text-left">
          <span className="text-slate-400 font-mono text-[11px] hidden md:inline">Active API:</span>
          <span className="font-bold text-eng-accent font-mono text-xs max-w-[110px] sm:max-w-[150px] truncate">
            {keyLabel}
          </span>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-700/80 hidden xs:inline">
            {masked}
          </span>
        </div>

        {modelKeys.length > 1 && (
          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/30">
            {currentKeyNumber}/{modelKeys.length}
          </span>
        )}

        <i className={`fas fa-chevron-down text-[10px] text-slate-400 transition-transform group-hover:text-white ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 sm:w-84 bg-eng-dark border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          
          {/* Header */}
          <div className="p-3 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] ${providerMeta.badgeBg} ${providerMeta.badgeText} border ${providerMeta.badgeBorder}`}>
                <i className={`fas ${providerMeta.icon}`}></i>
              </span>
              <div>
                <span className="font-bold text-white text-xs block">
                  تبديل الـ API السريع (API Switcher)
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Model: {activeModel.modelId}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenSettings('models');
              }}
              className="text-[11px] text-eng-accent hover:underline flex items-center gap-1 font-semibold"
            >
              <i className="fas fa-gear text-[10px]"></i>
              <span>الإعدادات</span>
            </button>
          </div>

          {/* Keys for the active model */}
          <div className="p-2 space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center justify-between">
              <span>المفاتيح المتوفرة لهذا الموديل</span>
              <span className="font-mono text-cyan-400">{modelKeys.length} مفاتيح</span>
            </div>

            {modelKeys.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400">
                لا توجد مفاتيح مخصصة أخرى لهذا الموديل.
              </div>
            ) : (
              modelKeys.map((k, idx) => {
                const isCurrent = k.id === activeKeyConfig?.id;
                const keyMasked = k.id === 'built-in-gemini' ? 'Default Environment Key' : maskApiKey(k.apiKey);
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => {
                      onSelectKey(k.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-all ${
                      isCurrent
                        ? 'bg-eng-accent/15 border border-eng-accent/50 text-white'
                        : 'hover:bg-slate-800 text-slate-300 hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono font-bold shrink-0 ${
                        isCurrent ? 'bg-eng-accent text-slate-950' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                          <span>{k.label || `API Key ${idx + 1}`}</span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-mono font-bold border border-emerald-500/40">
                              Active Now
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                          {keyMasked}
                        </div>
                      </div>
                    </div>

                    {isCurrent ? (
                      <i className="fas fa-check text-eng-accent text-xs shrink-0 ml-2" />
                    ) : (
                      <span className="text-[10px] text-slate-400 hover:text-eng-accent shrink-0 ml-2 font-semibold">
                        تشغيل
                      </span>
                    )}
                  </button>
                );
              })
            )}

            {/* Other active model keys option */}
            {keys.filter(k => k.isEnabled && (k.selectedModel || '').trim().toLowerCase() !== (activeModel.modelId || '').trim().toLowerCase()).length > 0 && (
              <>
                <div className="border-t border-slate-700/60 my-1 pt-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-0.5">
                  مفاتيح موديلات أخرى
                </div>
                <div className="space-y-1">
                  {keys
                    .filter(k => k.isEnabled && (k.selectedModel || '').trim().toLowerCase() !== (activeModel.modelId || '').trim().toLowerCase())
                    .slice(0, 4)
                    .map(altKey => {
                      const altMeta = PROVIDER_METAS[altKey.provider] || PROVIDER_METAS.custom;
                      return (
                        <button
                          key={altKey.id}
                          type="button"
                          onClick={() => {
                            onSelectKey(altKey.id);
                            setIsOpen(false);
                          }}
                          className="w-full flex items-center justify-between p-1.5 rounded-lg text-left hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs transition-colors"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <i className={`fas ${altMeta.icon} text-[10px] text-slate-400`}></i>
                            <span className="truncate">{altKey.selectedModel}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500 shrink-0">
                            {maskApiKey(altKey.apiKey)}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </>
            )}
          </div>

          {/* Quick Actions Footer */}
          <div className="p-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenSettings('models');
              }}
              className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
            >
              <i className="fas fa-plus text-eng-accent text-[10px]"></i>
              <span>+ إضافة مفتاح API لهذا الموديل</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenSettings('search_engine');
              }}
              className="px-2.5 py-1.5 rounded-lg bg-sky-950/80 hover:bg-sky-900 text-sky-300 border border-sky-800/60 text-xs font-bold transition-colors flex items-center gap-1"
              title="تعديل مفاتيح محرك البحث المخصص"
            >
              <i className="fas fa-globe text-[10px]"></i>
              <span className="hidden xs:inline">Search API</span>
            </button>
          </div>

        </div>
      )}
    </div>
  );
};

export default ActiveApiKeySwitcher;
