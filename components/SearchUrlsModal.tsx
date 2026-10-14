import React, { useState } from 'react';

interface SearchUrlsModalProps {
  isOpen: boolean;
  onClose: () => void;
  urls: string[];
  onSaveUrls: (urls: string[]) => void;
}

export const SearchUrlsModal: React.FC<SearchUrlsModalProps> = ({
  isOpen,
  onClose,
  urls,
  onSaveUrls
}) => {
  const [urlList, setUrlList] = useState<string[]>(urls);
  const [inputVal, setInputVal] = useState('');
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Sync when opened
  React.useEffect(() => {
    setUrlList(urls);
    setErrorNotice(null);
  }, [isOpen, urls]);

  if (!isOpen) return null;

  const handleAddUrl = () => {
    let raw = inputVal.trim();
    if (!raw) return;

    // Clean URL or domain
    try {
      if (!raw.startsWith('http://') && !raw.startsWith('https://') && raw.includes('.')) {
        raw = `https://${raw}`;
      }
      const parsed = new URL(raw);
      const cleanUrl = parsed.href;

      if (urlList.includes(cleanUrl) || urlList.includes(parsed.hostname)) {
        setErrorNotice("تم إضافة هذا الرابط مسبقاً.");
        return;
      }

      setUrlList([...urlList, cleanUrl]);
      setInputVal('');
      setErrorNotice(null);
    } catch {
      // If it's a domain or keyword pattern like "nature.com"
      if (raw.length > 3) {
        setUrlList([...urlList, raw]);
        setInputVal('');
        setErrorNotice(null);
      } else {
        setErrorNotice("يرجى إدخال رابط أو نطاق صحيح (مثل: wikipedia.org أو https://...)");
      }
    }
  };

  const handleRemoveUrl = (index: number) => {
    setUrlList(urlList.filter((_, idx) => idx !== index));
  };

  const handleApplyPreset = (presetUrl: string) => {
    if (!urlList.includes(presetUrl)) {
      setUrlList([...urlList, presetUrl]);
    }
  };

  const handleSave = () => {
    onSaveUrls(urlList);
    onClose();
  };

  const handleClearAll = () => {
    setUrlList([]);
    onSaveUrls([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div 
        className="bg-eng-dark border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-700 bg-eng-panel/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <i className="fas fa-link text-sm"></i>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                توجيه البحث نحو روابط محددة (Focus URLs)
              </h3>
              <p className="text-[11px] text-slate-400">
                وجه بحث Google والذكاء الاصطناعي للاعتماد على مواقع وروابط ومراجع بعينها
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors"
          >
            <i className="fas fa-xmark"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Quick Presets */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              اقتراحات سريعة لمصادر موثوقة:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { name: 'Wikipedia', url: 'https://en.wikipedia.org' },
                { name: 'ArXiv (الأبحاث)', url: 'https://arxiv.org' },
                { name: 'GitHub', url: 'https://github.com' },
                { name: 'Nature', url: 'https://www.nature.com' },
                { name: 'ScienceDirect', url: 'https://www.sciencedirect.com' }
              ].map(preset => (
                <button
                  key={preset.url}
                  type="button"
                  onClick={() => handleApplyPreset(preset.url)}
                  className="px-2 py-1 rounded-md text-[11px] bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                >
                  + {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Input field */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              إضافة رابط أو دومين جديد
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddUrl();
                  }
                }}
                placeholder="مثال: https://arxiv.org/abs/... أو wikipedia.org"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400 font-mono"
              />
              <button
                type="button"
                onClick={handleAddUrl}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-xl text-xs transition-colors shrink-0 flex items-center gap-1"
              >
                <i className="fas fa-plus text-[10px]"></i>
                <span>إضافة</span>
              </button>
            </div>
            {errorNotice && (
              <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                <i className="fas fa-circle-exclamation text-[10px]"></i>
                <span>{errorNotice}</span>
              </p>
            )}
          </div>

          {/* Active URLs List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300">
                الروابط المحددة حالياً ({urlList.length})
              </span>
              {urlList.length > 0 && (
                <button
                  type="button"
                  onClick={() => setUrlList([])}
                  className="text-[11px] text-rose-400 hover:underline"
                >
                  مسح القائمة
                </button>
              )}
            </div>

            {urlList.length === 0 ? (
              <div className="p-4 border border-dashed border-slate-700 rounded-xl text-center text-xs text-slate-500">
                لم يتم تحديد روابط مخصصة. سيقوم الموديل بالبحث الشامل في كامل شبكة الإنترنت عبر Google.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {urlList.map((url, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <i className="fas fa-globe text-[11px] text-sky-400 shrink-0"></i>
                      <span className="truncate font-mono text-[11px]">{url}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveUrl(idx)}
                      className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                      title="إزالة الرابط"
                    >
                      <i className="fas fa-times text-xs"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-700 bg-eng-panel/70 flex items-center justify-between">
          <button
            type="button"
            onClick={handleClearAll}
            className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-rose-300 hover:bg-slate-800 transition-colors"
          >
            إلغاء التحديد والبحث المفتوح
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-1.5 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 transition-colors shadow-sm"
            >
              تطبيق الروابط ({urlList.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchUrlsModal;
