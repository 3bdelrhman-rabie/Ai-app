import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  AIKeyConfig, 
  AIProviderType, 
  SearchEngineConfig, 
  SearchEngineKey, 
  SEARCH_ENGINE_MODELS, 
  DEFAULT_SEARCH_ENGINE_CONFIG 
} from '../types';
import { 
  PROVIDER_METAS, 
  testConnection,
  detectModelCapabilities,
  CAPABILITY_METAS,
  getModelInstanceInfo,
  getModelTotalApiCount,
  getModelConnectedApiCount,
  maskApiKey
} from '../services/aiService';

interface ApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  keys: AIKeyConfig[];
  onSaveKeys: (updatedKeys: AIKeyConfig[]) => void;
  onSelectModel: (keyId: string, modelId: string) => void;
  currentKeyId: string;
  searchEngineConfig?: SearchEngineConfig;
  onSaveSearchEngineConfig?: (config: SearchEngineConfig) => void;
  initialTab?: 'models' | 'search_engine';
}

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({
  isOpen,
  onClose,
  keys,
  onSaveKeys,
  onSelectModel,
  currentKeyId,
  searchEngineConfig,
  onSaveSearchEngineConfig,
  initialTab = 'models'
}) => {
  const [activeMainTab, setActiveMainTab] = useState<'models' | 'search_engine'>(initialTab);

  // Sync activeMainTab if initialTab changes
  useEffect(() => {
    if (initialTab) {
      setActiveMainTab(initialTab);
    }
  }, [initialTab]);

  // Search Engine state
  const getCleanSearchModel = (id?: string) => {
    if (!id || id.includes('2.5') || id.includes('2.0') || id.includes('1.5')) {
      return 'gemini-flash-latest';
    }
    return id;
  };

  const [searchModel, setSearchModel] = useState<string>(() => getCleanSearchModel(searchEngineConfig?.modelId));
  const [searchKeysList, setSearchKeysList] = useState<string[]>(() => {
    if (searchEngineConfig?.apiKeys && searchEngineConfig.apiKeys.length > 0) {
      return searchEngineConfig.apiKeys.map(k => k.key);
    }
    return [''];
  });
  const [activeSearchKeyIndex, setActiveSearchKeyIndex] = useState<number>(searchEngineConfig?.activeKeyIndex || 0);
  const [searchEngineEnabled, setSearchEngineEnabled] = useState<boolean>(searchEngineConfig?.enabled ?? true);
  const [showSearchKeyPasswords, setShowSearchKeyPasswords] = useState<Record<number, boolean>>({});
  const [searchTestResult, setSearchTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);
  const [isTestingSearch, setIsTestingSearch] = useState<boolean>(false);

  // Sync Search Engine state when prop updates
  useEffect(() => {
    if (searchEngineConfig) {
      setSearchModel(getCleanSearchModel(searchEngineConfig.modelId));
      if (searchEngineConfig.apiKeys && searchEngineConfig.apiKeys.length > 0) {
        setSearchKeysList(searchEngineConfig.apiKeys.map(k => k.key));
      } else {
        setSearchKeysList(['']);
      }
      setActiveSearchKeyIndex(searchEngineConfig.activeKeyIndex || 0);
      setSearchEngineEnabled(searchEngineConfig.enabled ?? true);
    }
  }, [searchEngineConfig, isOpen]);


  const [selectedProvider, setSelectedProvider] = useState<AIProviderType>('openai');
  const [labelInput, setLabelInput] = useState('');
  const [apiKeysList, setApiKeysList] = useState<string[]>(['']);
  const [showKeyPasswords, setShowKeyPasswords] = useState<Record<number, boolean>>({});
  const [baseUrlInput, setBaseUrlInput] = useState('');
  const [modelInput, setModelInput] = useState('');
  const [customModelMode, setCustomModelMode] = useState(false);
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);

  // Diagnostic states
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);

  const handleAddApiKeyRow = () => {
    setApiKeysList(prev => [...prev, '']);
  };

  const handleRemoveApiKeyRow = (index: number) => {
    if (apiKeysList.length <= 1) return;
    setApiKeysList(prev => prev.filter((_, idx) => idx !== index));
    setShowKeyPasswords(prev => {
      const copy = { ...prev };
      delete copy[index];
      return copy;
    });
  };

  const handleUpdateApiKey = (index: number, val: string) => {
    setApiKeysList(prev => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  const handleAddSearchKeyRow = () => {
    setSearchKeysList(prev => [...prev, '']);
  };

  const handleRemoveSearchKeyRow = (index: number) => {
    if (searchKeysList.length <= 1) return;
    setSearchKeysList(prev => prev.filter((_, idx) => idx !== index));
    setShowSearchKeyPasswords(prev => {
      const copy = { ...prev };
      delete copy[index];
      return copy;
    });
    if (activeSearchKeyIndex >= index && activeSearchKeyIndex > 0) {
      setActiveSearchKeyIndex(prev => prev - 1);
    }
  };

  const handleUpdateSearchKey = (index: number, val: string) => {
    setSearchKeysList(prev => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  const handleSaveSearchEngine = () => {
    const trimmed = searchKeysList.map(k => k.trim()).filter(Boolean);

    // Check for internal duplicates in input rows
    const seen = new Set<string>();
    for (const keyCand of trimmed) {
      if (seen.has(keyCand)) {
        const masked = keyCand.length > 10 ? `${keyCand.slice(0, 6)}...${keyCand.slice(-4)}` : keyCand;
        setSearchTestResult({
          success: false,
          message: `❌ تنبيه: مفتاح الـ API (${masked}) مكرر في حقول إدخال محرك البحث. يرجى التأكد من أن كل مفتاح مختلف تماماً.`
        });
        return;
      }
      seen.add(keyCand);
    }

    const newKeys: SearchEngineKey[] = trimmed.map((keyVal, idx) => ({
      id: `search_key_${Date.now()}_${idx}`,
      key: keyVal,
      label: `Search API ${idx + 1}`,
      addedAt: Date.now()
    }));

    const newConfig: SearchEngineConfig = {
      enabled: searchEngineEnabled,
      modelId: searchModel,
      apiKeys: newKeys,
      activeKeyIndex: Math.min(activeSearchKeyIndex, Math.max(0, newKeys.length - 1))
    };

    onSaveSearchEngineConfig?.(newConfig);
    setSearchTestResult({
      success: true,
      message: `✅ تم حفظ إعدادات محرك البحث بنجاح! الموديل المعتمد: "${searchModel}" مع ${newKeys.length} مفتاح API مسجل.`
    });
  };

  const handleTestSearchEngine = async () => {
    setIsTestingSearch(true);
    setSearchTestResult(null);

    const trimmed = searchKeysList.map(k => k.trim()).filter(Boolean);
    const activeKey = trimmed[activeSearchKeyIndex] || trimmed[0] 
      || keys.find(k => k.provider === 'gemini' && k.isEnabled && k.apiKey?.trim())?.apiKey
      || (typeof process !== 'undefined' ? (process.env.API_KEY || process.env.GEMINI_API_KEY) : '')
      || '';

    if (!activeKey) {
      setIsTestingSearch(false);
      setSearchTestResult({
        success: false,
        message: '❌ يرجى إدخال مفتاح API واحد على الأقل لمحرك البحث لاختبار الاتصال.'
      });
      return;
    }

    const startTime = performance.now();
    try {
      const testAi = new GoogleGenAI({ apiKey: activeKey });
      const testRes = await testAi.models.generateContent({
        model: searchModel,
        contents: 'Confirm search readiness status. Respond with only: ONLINE',
        config: {
          maxOutputTokens: 20
        }
      });
      const latency = Math.round(performance.now() - startTime);
      setSearchTestResult({
        success: true,
        latencyMs: latency,
        message: `✅ الاتصال بمحرك البحث وموديل "${searchModel}" ناجح تماماً! زمن الاستجابة: ${latency}ms. الرد: ${testRes.text?.trim() || 'ONLINE'}`
      });
    } catch (err: any) {
      const latency = Math.round(performance.now() - startTime);
      const errMsg = err?.message || String(err);
      setSearchTestResult({
        success: false,
        latencyMs: latency,
        message: `❌ فشل فحص محرك البحث: ${errMsg}. تأكد من صلاحية المفتاح أو اختر موديل آخر.`
      });
    } finally {
      setIsTestingSearch(false);
    }
  };


  const toggleShowPassword = (index: number) => {
    setShowKeyPasswords(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // When switching provider tab, update defaults (if not currently editing)
  const handleSelectProvider = (prov: AIProviderType) => {
    setSelectedProvider(prov);
    const meta = PROVIDER_METAS[prov];
    setBaseUrlInput(prov === 'custom' ? meta.defaultBaseUrl : '');
    setModelInput(meta.defaultModels[0]);
    setCustomModelMode(false);
    setLabelInput(meta.name);
    setTestResult(null);
  };

  const handleStartEdit = (config: AIKeyConfig) => {
    setEditingKeyId(config.id);
    setSelectedProvider(config.provider);
    setLabelInput(config.label || '');
    setApiKeysList([config.apiKey || '']);
    setBaseUrlInput(config.baseUrl || '');
    setModelInput(config.selectedModel);
    const meta = PROVIDER_METAS[config.provider] || PROVIDER_METAS.custom;
    const isDefault = meta.defaultModels.includes(config.selectedModel);
    setCustomModelMode(!isDefault);
    setTestResult(null);
  };

  const handleCancelEdit = () => {
    setEditingKeyId(null);
    const meta = PROVIDER_METAS[selectedProvider];
    setApiKeysList(['']);
    setLabelInput(meta.name);
    setModelInput(meta.defaultModels[0]);
    setBaseUrlInput(selectedProvider === 'custom' ? meta.defaultBaseUrl : '');
    setCustomModelMode(false);
    setTestResult(null);
  };

  if (!isOpen) return null;

  const currentMeta = PROVIDER_METAS[selectedProvider];

  const handleTestCandidate = async () => {
    setIsTesting(true);
    setTestResult(null);

    const primaryKey = (apiKeysList[0] || '').trim();
    const candidateConfig: AIKeyConfig = {
      id: 'temp-test',
      provider: selectedProvider,
      label: labelInput.trim() || currentMeta.name,
      apiKey: primaryKey,
      baseUrl: baseUrlInput.trim() || currentMeta.defaultBaseUrl,
      selectedModel: modelInput.trim() || currentMeta.defaultModels[0],
      isEnabled: true
    };

    const result = await testConnection(candidateConfig);
    setIsTesting(false);
    setTestResult(result);
  };

  const handleAddOrUpdateKey = () => {
    const targetModel = modelInput.trim() || currentMeta.defaultModels[0];
    const trimmedKeys = apiKeysList.map(k => k.trim()).filter(Boolean);

    if (trimmedKeys.length === 0 && selectedProvider !== 'custom') {
      setTestResult({
        success: false,
        message: 'يرجى إدخال مفتاح API واحد على الأقل للمتابعة.'
      });
      return;
    }

    // 1. Check for duplicate keys WITHIN the entered keys in the form
    const duplicatesInForm = trimmedKeys.filter((item, index) => trimmedKeys.indexOf(item) !== index);
    if (duplicatesInForm.length > 0) {
      const dup = duplicatesInForm[0];
      const masked = dup.length > 10 ? `${dup.slice(0, 6)}...${dup.slice(-4)}` : dup;
      setTestResult({
        success: false,
        message: `❌ تنبيه: مفتاح الـ API (${masked}) مكرر في حقول الإدخال. يرجى التأكد من أن كل مفتاح مختلف تماماً.`
      });
      return;
    }

    // 2. Check for duplicate keys against existing saved keys for this same model
    for (const keyCand of trimmedKeys) {
      const duplicateKeyExists = keys.some(k => 
        k.id !== editingKeyId &&
        (k.selectedModel || '').trim().toLowerCase() === targetModel.trim().toLowerCase() &&
        (k.apiKey || '').trim() === keyCand
      );

      if (duplicateKeyExists) {
        const masked = keyCand.length > 10 ? `${keyCand.slice(0, 6)}...${keyCand.slice(-4)}` : keyCand;
        setTestResult({
          success: false,
          message: `❌ تنبيه: مفتاح الـ API (${masked}) مضاف بالفعل لموديل "${targetModel}". الموديلات المتطابقة يجب أن تعمل بمفاتيح API مختلفة لمنع تكرار نفس الحساب.`
        });
        return;
      }
    }

    if (editingKeyId) {
      // Update existing key in place
      const updated = keys.map(k => {
        if (k.id === editingKeyId) {
          return {
            ...k,
            provider: selectedProvider,
            label: labelInput.trim() || currentMeta.name,
            apiKey: trimmedKeys[0] || '',
            baseUrl: baseUrlInput.trim() ? baseUrlInput.trim() : undefined,
            selectedModel: targetModel,
            availableModels: Array.from(new Set([targetModel, ...(k.availableModels || [])])),
            status: testResult?.success ? 'connected' : (trimmedKeys[0] ? 'connected' : k.status),
            lastTested: testResult?.success ? Date.now() : k.lastTested
          };
        }
        return k;
      });

      // If user provided additional backup keys in the same edit session, append them as new backup keys for this model
      const additionalConfigs: AIKeyConfig[] = trimmedKeys.slice(1).map((extraKey, extraIdx) => ({
        id: `key_${selectedProvider}_${Date.now()}_${extraIdx}`,
        provider: selectedProvider,
        label: `${labelInput.trim() || currentMeta.name} (Backup #${extraIdx + 2})`,
        apiKey: extraKey,
        baseUrl: baseUrlInput.trim() ? baseUrlInput.trim() : undefined,
        selectedModel: targetModel,
        availableModels: [targetModel],
        isEnabled: true,
        status: 'connected',
        lastTested: Date.now()
      }));

      const finalUpdated = [...updated, ...additionalConfigs];
      onSaveKeys(finalUpdated);
      if (currentKeyId === editingKeyId) {
        onSelectModel(editingKeyId, targetModel);
      }
      setEditingKeyId(null);
      setApiKeysList(['']);
      setTestResult({
        success: true,
        message: `تم تحديث الموديل "${targetModel}" وحفظ ${trimmedKeys.length} مفتاح API بنجاح!`
      });
      return;
    }

    // Adding new model with one or more keys
    const newConfigs: AIKeyConfig[] = trimmedKeys.map((keyVal, idx) => ({
      id: `key_${selectedProvider}_${Date.now()}_${idx}`,
      provider: selectedProvider,
      label: idx === 0 
        ? (labelInput.trim() || currentMeta.name) 
        : `${labelInput.trim() || currentMeta.name} (Backup #${idx + 1})`,
      apiKey: keyVal,
      baseUrl: baseUrlInput.trim() ? baseUrlInput.trim() : undefined,
      selectedModel: targetModel,
      availableModels: [targetModel],
      isEnabled: true,
      status: 'connected',
      lastTested: testResult?.success ? Date.now() : undefined
    }));

    // If custom provider without API key
    if (newConfigs.length === 0 && selectedProvider === 'custom') {
      newConfigs.push({
        id: `key_${selectedProvider}_${Date.now()}`,
        provider: selectedProvider,
        label: labelInput.trim() || currentMeta.name,
        apiKey: '',
        baseUrl: baseUrlInput.trim() ? baseUrlInput.trim() : undefined,
        selectedModel: targetModel,
        availableModels: [targetModel],
        isEnabled: true,
        status: 'connected'
      });
    }

    const updated = [...keys, ...newConfigs];
    onSaveKeys(updated);
    if (newConfigs.length > 0) {
      onSelectModel(newConfigs[0].id, newConfigs[0].selectedModel);
    }

    // Reset inputs
    setApiKeysList(['']);
    setTestResult({
      success: true,
      message: `تمت إضافة موديل "${targetModel}" بنجاح مع ربطه بـ ${newConfigs.length} ${newConfigs.length === 1 ? 'مفتاح API' : 'مفاتيح API'}!`
    });
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

  const handleAddBackupKeyForModel = (config: AIKeyConfig) => {
    setEditingKeyId(null);
    setSelectedProvider(config.provider);
    setLabelInput(`${config.label || PROVIDER_METAS[config.provider]?.name || ''} (Backup)`);
    setApiKeysList(['']);
    setBaseUrlInput(config.baseUrl || '');
    setModelInput(config.selectedModel);
    const meta = PROVIDER_METAS[config.provider] || PROVIDER_METAS.custom;
    const isDefault = meta.defaultModels.includes(config.selectedModel);
    setCustomModelMode(!isDefault);
    setTestResult({
      success: true,
      message: `جاهز لإضافة مفاتيح API إضافية لـ "${config.selectedModel}". الصق مفتاح الـ API الجديد أدناه، أو انقر على "+ إضافة المزيد" لإدراج عدة مفاتيح في وقت واحد.`
    });
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
              <i className="fas fa-sliders text-lg"></i>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Settings & Model Management
              </h2>
              <p className="text-xs text-slate-400">
                Configure AI models, multiple API keys, and dedicated web search engine
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

        {/* Main Section Navigation Tabs */}
        <div className="px-4 sm:px-6 pt-3 pb-0 bg-slate-900/90 border-b border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveMainTab('models')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeMainTab === 'models'
                ? 'border-eng-accent text-eng-accent bg-eng-accent/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 rounded-t-lg'
            }`}
          >
            <i className="fas fa-microchip text-xs"></i>
            <span>AI Models & Providers (موديلات الذكاء الاصطناعي)</span>
            <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] font-mono text-slate-300">
              {keys.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('search_engine')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeMainTab === 'search_engine'
                ? 'border-sky-400 text-sky-400 bg-sky-500/10 rounded-t-lg shadow-xs'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 rounded-t-lg'
            }`}
          >
            <i className="fas fa-globe text-xs text-sky-400"></i>
            <span>Dedicated Web Search Engine (محرك البحث المخصص)</span>
            <span className="px-1.5 py-0.2 rounded bg-sky-950 text-[10px] font-mono font-bold text-sky-300 border border-sky-800/50">
              {searchKeysList.filter(k => k.trim()).length} Keys
            </span>
          </button>
        </div>

        {/* Body Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {activeMainTab === 'search_engine' ? (
            /* Dedicated Web Search Engine Tab */
            <div className="space-y-6">
              
              {/* Info & Concept Card */}
              <div className="bg-gradient-to-r from-sky-950/40 to-slate-900 border border-sky-500/30 rounded-2xl p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
                    <i className="fas fa-satellite-dish text-lg"></i>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-white">
                        محرك البحث الذكي المخصص (Dedicated Search Engine)
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                        Universal Online Grounding
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      عند تفعيل البحث على الويب مع أي موديل آخر (مثل Claude أو OpenAI أو DeepSeek أو Groq)، يقوم هذا المحرك المخصص بإجراء بحث فوري وعميق عبر Google واستخراج كافة الحقائق والأرقام والتواريخ والروابط بدقة متناهية، ثم ينقلها للموديل الذي اخترته ليجيبك وكأنه متصل مباشرة بالإنترنت.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 1: Select Search Model */}
              <div className="bg-eng-panel/40 border border-slate-700/80 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                  <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <i className="fas fa-microchip text-sky-400"></i>
                    <span>1. تحديد موديول البحث المناسب (Search Reconnaissance Model)</span>
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Active: <strong className="text-sky-300">{searchModel}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {SEARCH_ENGINE_MODELS.map((item) => {
                    const isSelected = searchModel === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSearchModel(item.id)}
                        className={`p-3.5 rounded-xl border text-left transition-all relative ${
                          isSelected
                            ? 'bg-sky-500/15 border-sky-400 text-white shadow-md'
                            : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-bold text-xs flex items-center gap-1.5">
                            <i className={`fas fa-circle-check text-xs ${isSelected ? 'text-sky-400' : 'text-slate-600'}`}></i>
                            <span>{item.name}</span>
                          </span>
                          {item.recommended && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              RECOMMENDED
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-normal">
                          {item.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Multi-API Keys for Search Engine */}
              <div className="bg-eng-panel/40 border border-slate-700/80 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                  <div>
                    <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <i className="fas fa-key text-sky-400"></i>
                      <span>2. مفاتيح الـ API المخصصة لمحرك البحث (Search Engine API Keys)</span>
                    </label>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      يمكنك إضافة مفتاح واحد أو عدة مفاتيح. في حال واجه مفتاح ضغطاً أو نفاد رصيد، سينتقل النظام تلقائياً للمفتاح التالي دون مقاطعتك.
                    </p>
                  </div>
                  <span className="text-[11px] text-sky-300 font-mono font-bold shrink-0">
                    {searchKeysList.filter(k => k.trim()).length} مفتاح
                  </span>
                </div>

                {/* Dynamic Key Input Rows */}
                <div className="space-y-2.5">
                  {searchKeysList.map((keyVal, idx) => {
                    const isVisible = showSearchKeyPasswords[idx] || false;
                    const isPrimary = idx === activeSearchKeyIndex;
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] px-1">
                          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-sky-500/20 text-sky-400 text-[10px] font-mono font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span>{idx === 0 ? 'مفتاح الـ API الأساسي (API 1)' : `مفتاح بديل (API ${idx + 1})`}</span>
                            {isPrimary && (
                              <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 text-[9px] font-bold border border-sky-500/30">
                                Primary Key
                              </span>
                            )}
                          </span>

                          <div className="flex items-center gap-2">
                            {searchKeysList.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setActiveSearchKeyIndex(idx)}
                                className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                                  isPrimary ? 'text-sky-300 font-bold' : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                {isPrimary ? '● المفتاح النشط' : '○ جعله أساسي'}
                              </button>
                            )}

                            {searchKeysList.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveSearchKeyRow(idx)}
                                className="text-slate-400 hover:text-rose-400 text-xs px-1"
                                title="حذف هذا المربع"
                              >
                                <i className="fas fa-trash-can text-[10px]"></i>
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="relative flex items-center">
                          <div className="absolute left-3 text-slate-500 pointer-events-none text-xs">
                            <i className="fas fa-key"></i>
                          </div>
                          <input
                            type={isVisible ? 'text' : 'password'}
                            value={keyVal}
                            onChange={(e) => handleUpdateSearchKey(idx, e.target.value)}
                            placeholder={idx === 0 ? "AIzaSy..." : `أدخل مفتاح API ${idx + 1} إضافي هنا...`}
                            className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-9 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400 font-mono tracking-wider transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSearchKeyPasswords(prev => ({ ...prev, [idx]: !prev[idx] }))}
                            className="absolute right-3 text-slate-400 hover:text-slate-200 transition-colors text-xs"
                            title={isVisible ? "إخفاء المفتاح" : "إظهار المفتاح"}
                          >
                            <i className={`fas ${isVisible ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add More Button */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleAddSearchKeyRow}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-400 hover:text-sky-300 hover:underline py-1 px-1 transition-all"
                  >
                    <i className="fas fa-plus text-[10px] bg-sky-500/20 p-1 rounded-md"></i>
                    <span>+ إضافة المزيد من مفاتيح البحث (+ Add More API)</span>
                  </button>
                </div>

                {/* Test Result Message Box */}
                {searchTestResult && (
                  <div className={`p-3 rounded-xl text-xs border animate-in fade-in duration-150 ${
                    searchTestResult.success 
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200' 
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                  }`}>
                    <div className="flex items-start gap-2">
                      <i className={`fas ${searchTestResult.success ? 'fa-circle-check text-emerald-400' : 'fa-circle-exclamation text-rose-400'} mt-0.5`}></i>
                      <div className="space-y-0.5">
                        <span className="font-semibold">{searchTestResult.message}</span>
                        {searchTestResult.latencyMs && (
                          <span className="text-[10px] opacity-80 block font-mono">
                            Latency: {searchTestResult.latencyMs}ms
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions: Test Connection & Save */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-700/60">
                  <button
                    type="button"
                    onClick={handleTestSearchEngine}
                    disabled={isTestingSearch}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/30 hover:border-sky-500/60 text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <i className={`fas ${isTestingSearch ? 'fa-spinner fa-spin' : 'fa-vial'}`}></i>
                    <span>{isTestingSearch ? 'جاري الفحص...' : 'فحص الاتصال بمحرك البحث (Test Engine)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveSearchEngine}
                    className="w-full sm:w-auto px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-sky-500/20"
                  >
                    <i className="fas fa-floppy-disk"></i>
                    <span>حفظ إعدادات محرك البحث (Save Search Config)</span>
                  </button>
                </div>

              </div>

            </div>
          ) : (
            /* AI Models & Providers Tab (Existing) */
            <>
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
            
            {/* Active Edit Mode Banner */}
            {editingKeyId && (
              <div className="bg-amber-500/15 border border-amber-500/40 rounded-xl p-3 flex items-center justify-between gap-3 text-xs text-amber-200 animate-in fade-in duration-150">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    <i className="fas fa-pen-to-square text-xs"></i>
                  </span>
                  <span className="truncate">
                    Editing Model: <strong className="text-white font-mono">{keys.find(k => k.id === editingKeyId)?.selectedModel}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600 transition-colors shrink-0 font-medium"
                >
                  Cancel Edit
                </button>
              </div>
            )}

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
              {/* Multi-API Key Inputs with "+ إضافة المزيد" */}
              <div className="md:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-300">
                    مفاتيح الـ API (API Keys) <span className="text-rose-400">*</span>
                    {apiKeysList.length > 1 && (
                      <span className="text-[11px] text-amber-300 ml-2 font-mono font-bold">
                        ({apiKeysList.length} مفاتيح مدخلة)
                      </span>
                    )}
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {apiKeysList.length > 1 ? 'مجموعة مفاتيح احتياطية للتجاوز التلقائي' : 'أدخل مفتاح الـ API الأساسي'}
                  </span>
                </div>

                {apiKeysList.map((keyVal, idx) => {
                  const isPrimary = idx === 0;
                  const isVisible = Boolean(showKeyPasswords[idx]);
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                        <span className="flex items-center gap-1.5 font-bold text-slate-300">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${
                            isPrimary ? 'bg-eng-accent/20 text-eng-accent border border-eng-accent/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}>
                            {idx + 1}
                          </span>
                          <span>{isPrimary ? 'API Key 1 (الأساسي · Primary)' : `API Key ${idx + 1} (احتياطي · Backup)`}</span>
                        </span>
                        {!isPrimary && (
                          <button
                            type="button"
                            onClick={() => handleRemoveApiKeyRow(idx)}
                            className="text-rose-400 hover:text-rose-300 flex items-center gap-1 text-[10px] transition-colors cursor-pointer"
                            title="حذف هذا المفتاح"
                          >
                            <i className="fas fa-trash-can text-[9px]"></i>
                            <span>إزالة الحقل</span>
                          </button>
                        )}
                      </div>

                      <div className="relative flex items-center">
                        <input
                          type={isVisible ? "text" : "password"}
                          value={keyVal}
                          onChange={(e) => handleUpdateApiKey(idx, e.target.value)}
                          placeholder={isPrimary ? currentMeta.keyPlaceholder : `أدخل مفتاح API إضافي #${idx + 1}...`}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-eng-accent pr-10 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => toggleShowPassword(idx)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                          title={isVisible ? 'Hide' : 'Show'}
                        >
                          <i className={`fas ${isVisible ? 'fa-eye-slash' : 'fa-eye'} text-sm`}></i>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* "+ إضافة المزيد" button as requested */}
                <div className="pt-1 flex items-center justify-between flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleAddApiKeyRow}
                    className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-semibold px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all cursor-pointer shadow-xs"
                  >
                    <i className="fas fa-plus text-[10px]"></i>
                    <span>+ إضافة المزيد (إضافة حقل API {apiKeysList.length + 1})</span>
                  </button>
                  <span className="text-[10px] text-slate-400">
                    يمكنك إضافة أي عدد من المفاتيح لنفس الموديل بدون قيود
                  </span>
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

              <div className="flex items-center gap-2">
                {editingKeyId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAddOrUpdateKey}
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-lg ${
                    editingKeyId
                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-amber-500/20'
                      : 'bg-eng-accent hover:bg-sky-400 text-eng-dark shadow-eng-accent/20'
                  }`}
                >
                  <i className={`fas ${editingKeyId ? 'fa-check' : 'fa-plus'}`}></i>
                  <span>{editingKeyId ? 'Update Model' : 'Save & Pair API'}</span>
                </button>
              </div>
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
            {/* Multi-Key Pool Explainer Banner */}
            <div className="mb-4 p-3 bg-gradient-to-r from-amber-500/10 via-sky-500/10 to-indigo-500/10 border border-amber-500/25 rounded-xl flex items-start gap-3 text-xs">
              <i className="fas fa-layer-group text-amber-400 mt-0.5 text-base shrink-0"></i>
              <div className="text-slate-300 leading-relaxed">
                <div className="font-bold text-white flex items-center gap-2">
                  <span>إمكانية إضافة عدد غير محدود من مفاتيح الـ API (Unlimited API Keys)</span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-mono">
                    Auto-Failover
                  </span>
                </div>
                <p className="mt-1 text-slate-400">
                  يمكنك إضافة أي عدد من مفاتيح الـ API لنفس الموديل لتجاوز حدود الاستخدام والحصص المحدودة (Rate Limits). عند ظهور خطأ "Limit Exceeded / Quota Exceeded"، سيظهر لك زر <strong>"تبديل الـ API وإعادة المحاولة (Switch API & Retry)"</strong> للتبديل الفوري دون انقطاع.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Saved API Keys & Models ({keys.length})
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingKeyId(null);
                    setApiKeysList(['']);
                    setLabelInput(currentMeta.name);
                    setTestResult(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold transition-colors"
                >
                  <i className="fas fa-plus text-[10px]"></i>
                  <span>+ إضافة مفتاح احتياطي / جديد</span>
                </button>
              </div>
            </div>

            {keys.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-slate-700 rounded-xl text-slate-500 text-xs">
                No saved keys yet. Add your first API key above to start chatting!
              </div>
            ) : (
              <div className="space-y-2.5">
                {keys.map((k) => {
                  const meta = PROVIDER_METAS[k.provider] || PROVIDER_METAS.custom;
                  const isCurrent = k.id === currentKeyId;
                  const isBeingEdited = k.id === editingKeyId;
                  const instanceInfo = getModelInstanceInfo(k.id, k.selectedModel, keys);

                  return (
                    <div
                      key={k.id}
                      className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        isBeingEdited
                          ? 'bg-amber-950/20 border-amber-500/60 shadow-lg ring-1 ring-amber-500/50'
                          : isCurrent 
                            ? 'bg-slate-800/90 border-eng-accent/50 shadow-md' 
                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm ${meta.badgeBg} ${meta.badgeBorder} ${meta.badgeText} border shrink-0`}>
                          <i className={`fas ${meta.icon}`}></i>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-white">{k.label || meta.name}</span>
                            {instanceInfo.tag && (
                              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold px-1.5 py-0.5 rounded">
                                {instanceInfo.tag}
                              </span>
                            )}
                            {isCurrent && (
                              <span className="text-[10px] bg-eng-accent/20 text-eng-accent border border-eng-accent/40 font-bold px-1.5 py-0.5 rounded">
                                Active
                              </span>
                            )}
                            {isBeingEdited && (
                              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                                <i className="fas fa-pencil text-[9px]"></i> Editing
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 flex-wrap">
                            <span className="font-mono text-slate-200 font-semibold">{k.selectedModel}</span>

                            {/* Connected API count badge beside model name */}
                            {(() => {
                              const modelApisCount = getModelTotalApiCount(k.selectedModel, keys);
                              const connectedInfo = getModelConnectedApiCount(k.selectedModel, keys);
                              return (
                                <span 
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-xs shrink-0"
                                  title={`هذا الموديل مربوط بـ ${modelApisCount} مفاتيح API في النظام (${connectedInfo.count} مفتاح نشط)`}
                                >
                                  <i className="fas fa-key text-[8px] text-cyan-400"></i>
                                  <span>مربوط بـ {modelApisCount} {modelApisCount === 1 ? 'مفتاح API' : 'مفاتيح API'}</span>
                                  <span className="text-[9px] opacity-80 font-mono">({modelApisCount} {modelApisCount === 1 ? 'API' : 'APIs'})</span>
                                </span>
                              );
                            })()}
                            
                            {/* Inline Edit Model Button */}
                            <button
                              type="button"
                              onClick={() => handleStartEdit(k)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-[11px] font-semibold transition-colors"
                              title="Edit model configuration and API key"
                            >
                              <i className="fas fa-pen-to-square text-[9px]"></i>
                              <span>Edit</span>
                            </button>

                            {/* Inline Add Backup Key for this exact model */}
                            <button
                              type="button"
                              onClick={() => handleAddBackupKeyForModel(k)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-semibold transition-colors"
                              title="إضافة مفتاح API احتياطي إضافي لهذا الموديل للتجاوز التلقائي عند نفاد الليمت"
                            >
                              <i className="fas fa-plus text-[9px]"></i>
                              <span>+ مفتاح احتياطي</span>
                            </button>

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
                          onClick={() => handleStartEdit(k)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs border transition-colors flex items-center gap-1 ${
                            isBeingEdited
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700 hover:bg-slate-700'
                          }`}
                          title="Edit this model"
                        >
                          <i className="fas fa-pen-to-square text-xs"></i>
                          <span className="hidden sm:inline text-[11px]">Edit</span>
                        </button>

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
            </>
          )}
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
