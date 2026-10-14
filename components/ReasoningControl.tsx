import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  ReasoningEffortLevel, 
  REASONING_TIERS, 
  REASONING_STEPS,
  ResponseLengthLevel,
  RESPONSE_LENGTH_TIERS,
  RESPONSE_LENGTH_STEPS,
  AIProviderType
} from '../types';
import { getModelCeilings, calculateEngineParameters } from '../services/modelLimits';

interface ReasoningControlProps {
  currentLevel: ReasoningEffortLevel;
  onChangeLevel: (level: ReasoningEffortLevel) => void;
  responseLength: ResponseLengthLevel;
  onChangeResponseLength: (length: ResponseLengthLevel) => void;
  activeProvider?: AIProviderType;
  activeModelId?: string;
  className?: string;
}

const ReasoningControl: React.FC<ReasoningControlProps> = ({
  currentLevel,
  onChangeLevel,
  responseLength,
  onChangeResponseLength,
  activeProvider = 'gemini',
  activeModelId = 'gemini-flash-latest',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [popoverCoords, setPopoverCoords] = useState<{ top: number; left: number } | null>(null);

  const activeReasoningTier = REASONING_TIERS[currentLevel] || REASONING_TIERS.off;
  const activeLengthTier = RESPONSE_LENGTH_TIERS[responseLength] || RESPONSE_LENGTH_TIERS.standard;
  const isThinkingActive = currentLevel !== 'off';

  // Dynamic ceilings for the current active model
  const engineParams = calculateEngineParameters(
    activeProvider,
    activeModelId,
    currentLevel,
    responseLength
  );
  const ceilings = engineParams.ceilings;

  // Calculate and update fixed popover position anchored to trigger button
  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverWidth = typeof window !== 'undefined' && window.innerWidth < 640 
        ? Math.min(window.innerWidth - 24, 400) 
        : 420;
      
      let top = rect.bottom + 8;
      let left = rect.left;

      if (typeof window !== 'undefined') {
        if (window.innerWidth < 640) {
          // Center on small mobile screens
          left = Math.max(12, Math.floor((window.innerWidth - popoverWidth) / 2));
        } else {
          // Desktop / tablet: align with trigger button, clamp within screen margins
          if (left + popoverWidth > window.innerWidth - 16) {
            left = Math.max(16, window.innerWidth - popoverWidth - 16);
          }
          if (left < 16) left = 16;
        }

        // Check if popover exceeds viewport bottom, position above trigger if necessary
        const popoverHeight = 520;
        if (top + popoverHeight > window.innerHeight && rect.top > popoverHeight + 16) {
          top = Math.max(16, rect.top - popoverHeight - 8);
        }
      }

      setPopoverCoords({ top, left });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setIsOpen(false);
      };
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, updatePosition]);

  const handleReasoningSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const stepIndex = parseInt(e.target.value, 10);
    const selectedLevel = REASONING_STEPS[stepIndex] || 'off';
    onChangeLevel(selectedLevel);
  };

  const handleLengthSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const stepIndex = parseInt(e.target.value, 10);
    const selectedLength = RESPONSE_LENGTH_STEPS[stepIndex] || 'standard';
    onChangeResponseLength(selectedLength);
  };

  return (
    <div className={`relative shrink-0 ${className}`}>
      {/* Compact Status Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          updatePosition();
          setIsOpen(!isOpen);
        }}
        title="Reasoning effort and response length controls"
        className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border transition-all text-xs select-none shrink-0 ${
          isThinkingActive 
            ? `${activeReasoningTier.badgeBg} text-white shadow-sm ring-1 ring-white/10` 
            : 'bg-slate-800/90 hover:bg-slate-700/80 border-slate-700 text-slate-300'
        }`}
      >
        <span className="flex items-center gap-1.5">
          <i className={`fas fa-brain text-[11px] transition-transform ${
            isThinkingActive ? `${activeReasoningTier.colorClass} animate-pulse scale-110` : 'text-slate-400'
          }`} />
          <span className="font-bold tracking-wide">
            {isThinkingActive ? (
              <span className="flex items-center gap-1">
                <span className="hidden sm:inline text-slate-300 text-[10px]">Think:</span>
                <span className={activeReasoningTier.colorClass}>{activeReasoningTier.shortLabel}</span>
              </span>
            ) : (
              <span className="text-slate-400 text-[11px]">Direct</span>
            )}
          </span>
        </span>

        {/* 5-Step Micro Indicator Bars */}
        <div className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-black/30">
          {REASONING_STEPS.map((lvl, idx) => {
            const isFilled = idx <= activeReasoningTier.step && isThinkingActive;
            return (
              <span
                key={lvl}
                className={`w-1 h-2 rounded-xs transition-all ${
                  isFilled ? activeReasoningTier.dotColor : 'bg-slate-700'
                }`}
              />
            );
          })}
        </div>

        {/* Combined Length Pill */}
        <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-slate-900/80 text-cyan-300 border border-slate-700 hidden sm:inline flex items-center gap-1">
          <i className="fas fa-text-height text-[8px] text-cyan-400"></i>
          <span>{activeLengthTier.shortLabel}</span>
        </span>

        <i className={`fas fa-chevron-down text-[9px] text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Render popover via React Portal directly into document.body to guarantee topmost display over all layers */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <>
          {/* Backdrop overlay to dismiss on outside click */}
          <div 
            style={{ zIndex: 999990 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-[2px] animate-fade-in"
            onClick={() => setIsOpen(false)}
          />

          {/* Elevated Popover attached directly to document.body: guaranteed to display over all output boxes and chat areas */}
          <div 
            style={{
              position: 'fixed',
              top: popoverCoords ? `${popoverCoords.top}px` : '72px',
              left: popoverCoords ? `${popoverCoords.left}px` : '16px',
              maxWidth: 'calc(100vw - 24px)',
              maxHeight: 'calc(100vh - 90px)',
              zIndex: 999999,
            }}
            className="w-84 sm:w-96 p-4 rounded-2xl bg-slate-900/98 backdrop-blur-2xl border border-slate-700/90 shadow-2xl shadow-black/95 animate-fade-in text-left text-slate-100 overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${activeReasoningTier.badgeBg}`}>
                  <i className={`fas fa-brain text-sm ${activeReasoningTier.colorClass}`} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    Reasoning & Length Controls
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Adjust analytical depth and output verbosity
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 text-xs transition-colors"
                title="Close"
              >
                <i className="fas fa-times" />
              </button>
            </div>

            {/* Dynamic Active Model Ceiling Badge */}
            <div className="my-3 p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between text-[11px] gap-2">
              <div className="flex items-center gap-2 truncate">
                <i className="fas fa-microchip text-eng-accent"></i>
                <div className="truncate">
                  <div className="font-semibold text-white truncate max-w-[160px] sm:max-w-[200px]">{activeModelId}</div>
                  <div className="text-[9px] text-slate-400 flex items-center gap-1">
                    <span>{ceilings.supportsNativeThinking ? 'Native Thinking Engine' : 'Chain-of-Thought Reasoning'}</span>
                    <span>·</span>
                    <span className="text-emerald-400 font-medium">Dynamic Token Scaling Active</span>
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0 flex flex-col items-end gap-1">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                  <i className="fas fa-gauge-high text-[9px]"></i>
                  <span>{ceilings.maxOutputTokens.toLocaleString()} Max Tokens</span>
                </span>
              </div>
            </div>

            {/* Slider 1: Thinking & Reasoning Depth */}
            <div className="mb-4 p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
              <div className="flex items-center justify-between text-xs mb-1.5 font-semibold">
                <span className="flex items-center gap-1.5 text-slate-200">
                  <i className="fas fa-brain text-purple-400 text-xs"></i>
                  <span>Thinking Depth:</span>
                </span>
                <span className={`font-bold flex items-center gap-1 ${activeReasoningTier.colorClass}`}>
                  <span>{activeReasoningTier.label}</span>
                  <span className="text-[10px] text-slate-400">({activeReasoningTier.step}/4)</span>
                  {currentLevel === 'max' && (
                    <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                      {ceilings.maxThinkingBudget.toLocaleString()} Tokens
                    </span>
                  )}
                </span>
              </div>

              <div className="relative flex items-center py-1">
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="1"
                  value={activeReasoningTier.step}
                  onChange={handleReasoningSliderChange}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500 focus:outline-none"
                />
              </div>

              {/* Ticks for Slider 1 */}
              <div className="flex justify-between px-0.5 mt-1 text-[9px] text-slate-400 select-none">
                {REASONING_STEPS.map((lvl) => {
                  const tier = REASONING_TIERS[lvl];
                  const isSelected = lvl === currentLevel;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => onChangeLevel(lvl)}
                      className={`transition-colors py-0.5 ${
                        isSelected ? `font-bold ${tier.colorClass}` : 'hover:text-slate-200'
                      }`}
                    >
                      {tier.shortLabel}
                    </button>
                  );
                })}
              </div>

              {/* Active Thinking Specs */}
              <div className="mt-2 pt-2 border-t border-slate-700/50 flex items-center justify-between text-[10px] text-slate-300">
                <span className="text-slate-400">
                  Thinking Budget: <span className="text-white font-mono font-semibold">{engineParams.thinkingBudget > 0 ? `${engineParams.thinkingBudget.toLocaleString()} / ${ceilings.maxThinkingBudget.toLocaleString()} tokens` : '0 (Direct)'}</span>
                </span>
                <span className="text-slate-400">
                  Speed: <span className="font-semibold text-slate-200">{activeReasoningTier.speedText}</span>
                </span>
              </div>
            </div>

            {/* Slider 2: Response Length & Detail */}
            <div className="mb-4 p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
              <div className="flex items-center justify-between text-xs mb-1.5 font-semibold">
                <span className="flex items-center gap-1.5 text-slate-200">
                  <i className="fas fa-text-height text-cyan-400 text-xs"></i>
                  <span>Response Length:</span>
                </span>
                <span className="font-bold text-cyan-300 flex items-center gap-1">
                  <span>{activeLengthTier.label}</span>
                  <span className="text-[10px] text-slate-400">({activeLengthTier.step}/4)</span>
                  {responseLength === 'max' && (
                    <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                      Full Ceiling
                    </span>
                  )}
                </span>
              </div>

              <div className="relative flex items-center py-1">
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="1"
                  value={activeLengthTier.step}
                  onChange={handleLengthSliderChange}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
                />
              </div>

              {/* Ticks for Slider 2 */}
              <div className="flex justify-between px-0.5 mt-1 text-[9px] text-slate-400 select-none">
                {RESPONSE_LENGTH_STEPS.map((lvl) => {
                  const tier = RESPONSE_LENGTH_TIERS[lvl];
                  const isSelected = lvl === responseLength;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => onChangeResponseLength(lvl)}
                      className={`transition-colors py-0.5 ${
                        isSelected ? 'font-bold text-cyan-400' : 'hover:text-slate-200'
                      }`}
                    >
                      {tier.shortLabel}
                    </button>
                  );
                })}
              </div>

              {/* Active Length Specs */}
              <div className="mt-2 pt-2 border-t border-slate-700/50 flex items-center justify-between text-[10px] text-slate-300">
                <span className="text-slate-400 truncate max-w-[200px]">
                  {activeLengthTier.description}
                </span>
                <span className="text-cyan-400 font-mono text-[9px] shrink-0 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/30 font-semibold">
                  ~{engineParams.maxOutputTokens.toLocaleString()} / {ceilings.maxOutputTokens.toLocaleString()} Tokens
                </span>
              </div>
            </div>

            {/* Quick Preset Action Buttons */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={() => {
                  onChangeLevel('off');
                  onChangeResponseLength('short');
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition-all"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                  <i className="fas fa-bolt text-[10px]"></i>
                  <span>Ultra-Fast</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Direct + Short Answer</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  onChangeLevel('max');
                  onChangeResponseLength('max');
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition-all"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
                  <i className="fas fa-microchip text-[10px]"></i>
                  <span>Maximum Power</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Max Thinking ({ceilings.maxThinkingBudget.toLocaleString()}) + Full Output
                </div>
              </button>
            </div>

            {/* Footer with Reset button */}
            {isThinkingActive && (
              <div className="pt-2.5 border-t border-slate-800 flex justify-between items-center text-[11px]">
                <span className="text-slate-400 text-[10px]">Need quick instant response?</span>
                <button
                  type="button"
                  onClick={() => onChangeLevel('off')}
                  className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold text-xs transition-colors"
                >
                  <i className="fas fa-power-off text-[10px]" />
                  Turn Off Thinking
                </button>
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default ReasoningControl;
