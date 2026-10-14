import React, { useState } from 'react';
import { AIKeyConfig, AIProviderType } from '../types';
import { 
  PROVIDER_METAS, 
  testConnection,
  detectModelCapabilities,
  CAPABILITY_METAS
} from '../services/aiService';

interface ApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  keys: AIKeyConfig[];
  onSaveKeys: (updatedKeys: AIKeyConfig[]) => void;
  onSelectModel: (keyId: string, modelId: string) => void;
  currentKeyId: string;
}

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({
  isOpen,
  onClose,
  keys,
  onSaveKeys,
  onSelectModel,
  currentKeyId
}) => {
  const [selectedProvider, setSelectedProvider] = useState<AIProviderType>('openai');
  const [labelInput, setLabelInput] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [baseUrlInput, setBaseUrlInput] = useState('');
  const [modelInput, setModelInput] = useState('');
  const [customModelMode, setCustomModelMode] = useState(false);
  const [showKeyPassword, setShowKeyPassword] = useState(false);

  // Diagnostic states
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);

  // When switching provider tab, update defaults
  const handleSelectProvider = (prov: AIProviderType) => {
    setSelectedProvider(prov);
    const meta = PROVIDER_METAS[prov];
    setBaseUrlInput(prov === 'custom' ? meta.defaultBaseUrl : '');
    setModelInput(meta.defaultModels[0]);
    setCustomModelMode(false);
    setLabelInput(meta.name);
    setTestResult(null);
  };

  if (!isOpen) return null;

  const currentMeta = PROVIDER_METAS[selectedProvider];

  const handleTestCandidate = async () => {
    setIsTesting(true);
    setTestResult(null);

    const candidateConfig: AIKeyConfig = {
      id: 'temp-test',
      provider: selectedProvider,
      label: labelInput.trim() || currentMeta.name,
      apiKey: apiKeyInput.trim(),
      baseUrl: baseUrlInput.trim() || currentMeta.defaultBaseUrl,
      selectedModel: modelInput.trim() || currentMeta.defaultModels[0],
      isEnabled: true
    };

    const result = await testConnection(candidateConfig);
    setIsTesting(false);
    setTestResult(result);
  };

  const handleAddOrUpdateKey = () => {
    if (!apiKeyInput.trim() && selectedProvider !== 'custom') {
      setTestResult({
        success: false,
        message: 'Please provide an API Key first.'
      });
      return;
    }

    const newKeyId = `key_${selectedProvider}_${Date.now()}`;
    const targetModel = modelInput.trim() || currentMeta.defaultModels[0];
    const newConfig: AIKeyConfig = {
      id: newKeyId,
      provider: selectedProvider,
      label: labelInput.trim() || currentMeta.name,
      apiKey: apiKeyInput.trim(),
      baseUrl: baseUrlInput.trim() ? baseUrlInput.trim() : undefined,
      selectedModel: targetModel,
      availableModels: [targetModel],
      isEnabled: true,
      status: testResult?.success ? 'connected' : 'untested',
      lastTested: testResult?.success ? Date.now() : undefined
    };

    const updated = [...keys, newConfig];
    onSaveKeys(updated);
    onSelectModel(newConfig.id, newConfig.selectedModel);

    // Reset inputs
    setApiKeyInput('');
    setTestResult(null);
  };

  const handleDeleteKey = (idToDelete: string) => {
    const updated = keys.filter(k => k.id !== idToDelete);
    onSaveKeys(updated);
  };

  const handleToggleKey = (idToToggle: string) => {
    const updated = keys.map(k => {
      if (k.id === idToToggle) {
        return { ...k, isEnabled: !k.isEnabled };
      }
      return k;
    });
    onSaveKeys(updated);
  };

  const handleRetestExistingKey = async (config: AIKeyConfig) => {
    setIsTesting(true);
    const result = await testConnection(config);
    setIsTesting(false);
    
    const updated = keys.map(k => {
      if (k.id === config.id) {
        return {
          ...k,
          status: (result.success ? 'connected' : 'error') as 'connected' | 'error',
          lastTested: Date.now(),
          errorMessage: result.success ? undefined : result.message
        };
      }
      return k;
    });
    onSaveKeys(updated);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div 
        className="bg-eng-dark border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-700 bg-eng-panel/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-eng-accent/10 border border-eng-accent/30 flex items-center justify-center text-eng-accent">
              <i className="fas fa-key text-lg"></i>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                AI Provider Settings
              </h2>
              <p className="text-xs text-slate-400">
                Connect and manage multiple AI models (Gemini, OpenAI, Claude, Groq, DeepSeek, OpenRouter, Custom)
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors"
            title="Close"
          >
            <i className="fas fa-xmark text-lg"></i>
          </button>
        </div>

        {/* Body Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* Section 1: Provider Picker Tabs */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Select Provider
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {(Object.keys(PROVIDER_METAS) as AIProviderType[]).map((prov) => {
                const meta = PROVIDER_METAS[prov];
                const isSelected = selectedProvider === prov;
                return (
                  <button
                    key={prov}
                    type="button"
                    onClick={() => handleSelectProvider(prov)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                      isSelected 
                        ? `${meta.badgeBg} ${meta.badgeBorder} ${meta.badgeText} shadow-md` 
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <i className={`fas ${meta.icon} text-base mb-1`}></i>
                    <span className="text-xs font-semibold whitespace-nowrap">{meta.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Form to Add/Configure API Key */}
          <div className="bg-eng-panel/40 border border-slate-700/80 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/60 pb-3">
              <div>
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-md ${currentMeta.badgeBg} ${currentMeta.badgeText} border ${currentMeta.badgeBorder}`}>
                  <i className={`fas ${currentMeta.icon}`}></i>
                  {currentMeta.name}
                </span>
                <p className="text-xs text-slate-300 mt-1">{currentMeta.description}</p>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="text-[11px] text-slate-400 font-semibold">Capabilities:</span>
                  {currentMeta.capabilities.map(cap => (
                    <span key={cap} className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] uppercase font-mono text-emerald-400 border border-slate-700">
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
              <a 
                href={currentMeta.keyUrl} 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-eng-accent hover:underline shrink-0"
              >
                <span>Get API Key</span>
                <i className="fas fa-arrow-up-right-from-square text-[10px]"></i>
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* API Key Input */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  API Key <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showKeyPassword ? "text" : "password"}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder={currentMeta.keyPlaceholder}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-eng-accent pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeyPassword(!showKeyPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                  >
                    <i className={`fas ${showKeyPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`}></i>
                  </button>
                </div>
              </div>

              {/* Model Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Default Model
                  </label>
                  <button
                    type="button"
                    onClick={() => setCustomModelMode(!customModelMode)}
                    className="text-[11px] text-eng-accent hover:underline"
                  >
                    {customModelMode ? "Select from list" : "+ Custom model name"}
                  </button>
                </div>

                {customModelMode ? (
                  <input
                    type="text"
                    value={modelInput}
                    onChange={(e) => setModelInput(e.target.value)}
                    placeholder="e.g. gpt-4o-2024-11-20, deepseek-r1"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-eng-accent font-mono"
                  />
                ) : (
                  <select
                    value={modelInput}
                    onChange={(e) => setModelInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-eng-accent"
                  >
                    {currentMeta.defaultModels.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                )}

                {/* Dynamic Precise Model Capabilities */}
                {(() => {
                  const modelForDetection = modelInput.trim() || currentMeta.defaultModels[0];
                  const detectedCaps = detectModelCapabilities(selectedProvider, modelForDetection);
                  return (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className="text-[11px] text-slate-400 font-semibold">Model Capabilities:</span>
                      {detectedCaps.map(cap => (
                        <span 
                          key={cap} 
                          className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shadow-xs"
                          title={CAPABILITY_METAS[cap]?.labelEn}
                        >
                          <i className={`fas ${CAPABILITY_METAS[cap]?.icon || 'fa-check'} text-[9px] text-emerald-400`}></i>
                          {cap}
                        </span>
                      ))}
                      {detectedCaps.includes('image') ? (
                        <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded flex items-center gap-1">
                          <i className="fas fa-circle-check text-emerald-400"></i> Image Generation Supported
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">
                          (Text only)
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Label Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Label / Account Name
                </label>
                <input
                  type="text"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  placeholder={`My ${currentMeta.name}`}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-eng-accent"
                />
              </div>

              {/* Base URL (Optional or for Custom) */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Base URL {selectedProvider === 'custom' ? '(Required for local server)' : '(Optional proxy URL)'}
                </label>
                <input
                  type="text"
                  value={baseUrlInput}
                  onChange={(e) => setBaseUrlInput(e.target.value)}
                  placeholder={currentMeta.defaultBaseUrl}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-eng-accent font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  {selectedProvider === 'custom' 
                    ? 'Example for Ollama: http://localhost:11434/v1 or LM Studio: http://localhost:1234/v1' 
                    : 'Leave blank to use the official provider endpoint directly.'}
                </p>
              </div>
            </div>

            {/* Test Connection & Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleTestCandidate}
                disabled={isTesting}
                className="px-4 py-2.5 rounded-xl border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white text-xs font-bold transition-colors flex items-center justify-center gap-2"
              >
                {isTesting ? (
                  <>
                    <i className="fas fa-spinner fa-spin text-eng-accent"></i>
                    <span>Testing connection...</span>
                  </>
                ) : (
                  <>
                    <i className="fas fa-plug text-eng-accent"></i>
                    <span>Test Connection</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleAddOrUpdateKey}
                className="px-5 py-2.5 rounded-xl bg-eng-accent text-eng-dark font-bold text-xs hover:bg-sky-400 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-eng-accent/20"
              >
                <i className="fas fa-plus"></i>
                <span>Save & Pair API</span>
              </button>
            </div>

            {/* Test Result Feedback Banner */}
            {testResult && (
              <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                testResult.success 
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}>
                <i className={`fas ${testResult.success ? 'fa-check-circle text-emerald-400' : 'fa-triangle-exclamation text-rose-400'} mt-0.5 text-sm`}></i>
                <div className="flex-1">
                  <div className="font-semibold">{testResult.success ? 'Connection Successful!' : 'Connection Failed'}</div>
                  <div className="text-[11px] opacity-90 mt-0.5">{testResult.message}</div>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Configured Keys List */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Saved API Keys ({keys.length})</span>
              <span className="text-[11px] text-slate-400 font-normal">Stored securely in your local browser</span>
            </h3>

            {keys.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-slate-700 rounded-xl text-slate-500 text-xs">
                No saved keys yet. Add your first API key above to start chatting!
              </div>
            ) : (
              <div className="space-y-2.5">
                {keys.map((k) => {
                  const meta = PROVIDER_METAS[k.provider] || PROVIDER_METAS.custom;
                  const isCurrent = k.id === currentKeyId;
                  return (
                    <div
                      key={k.id}
                      className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        isCurrent 
                          ? 'bg-slate-800/90 border-eng-accent/50 shadow-md' 
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm ${meta.badgeBg} ${meta.badgeBorder} ${meta.badgeText} border`}>
                          <i className={`fas ${meta.icon}`}></i>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{k.label || meta.name}</span>
                            {isCurrent && (
                              <span className="text-[10px] bg-eng-accent/20 text-eng-accent border border-eng-accent/40 font-bold px-1.5 py-0.5 rounded">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 flex-wrap">
                            <span className="font-mono text-slate-200 font-semibold">{k.selectedModel}</span>
                            <span>·</span>
                            <span className="text-[11px] font-medium text-slate-300">{meta.name}</span>
                            {k.lastTested && (
                              <>
                                <span>·</span>
                                <span className="text-[10px] text-emerald-400">
                                  <i className="fas fa-check text-[9px] mr-1"></i>Verified
                                </span>
                              </>
                            )}
                          </div>
                          {/* Capabilities badge row under model & provider */}
                          {(() => {
                            const keyModelCaps = detectModelCapabilities(k.provider, k.selectedModel);
                            return (
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                <span className="text-[10px] text-slate-400 font-semibold">Capabilities:</span>
                                {keyModelCaps.map(cap => (
                                  <span 
                                    key={cap} 
                                    className="px-1.5 py-0.5 rounded text-[9px] uppercase font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1"
                                    title={CAPABILITY_METAS[cap]?.labelEn}
                                  >
                                    <i className={`fas ${CAPABILITY_METAS[cap]?.icon || 'fa-check'} text-[8px] text-emerald-400`}></i>
                                    {cap}
                                  </span>
                                ))}
                                {keyModelCaps.includes('image') && (
                                  <span className="text-[9px] text-emerald-400 font-medium bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <i className="fas fa-image text-emerald-400"></i> Image Gen
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Key Row Controls */}
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => handleRetestExistingKey(k)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs border border-slate-700 hover:bg-slate-700 transition-colors"
                          title="Retest connection"
                        >
                          <i className="fas fa-rotate-right text-xs"></i>
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => onSelectModel(k.id, k.selectedModel)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            isCurrent
                              ? 'bg-eng-accent/20 text-eng-accent border border-eng-accent/40'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                          }`}
                        >
                          {isCurrent ? 'Selected' : 'Use'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleKey(k.id)}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors ${
                            k.isEnabled 
                              ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20' 
                              : 'text-slate-500 bg-slate-800 hover:bg-slate-700'
                          }`}
                          title={k.isEnabled ? 'Disable' : 'Enable'}
                        >
                          <i className={`fas ${k.isEnabled ? 'fa-toggle-on text-sm' : 'fa-toggle-off text-sm'}`}></i>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteKey(k.id)}
                          className="w-7 h-7 rounded-lg text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 flex items-center justify-center text-xs transition-colors"
                          title="Delete Key"
                        >
                          <i className="fas fa-trash-can"></i>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-eng-panel/70 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            <i className="fas fa-shield-halved text-emerald-400 mr-1.5"></i>
            Keys are private and stored only in your local browser.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors border border-slate-600"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiSettingsModal;
