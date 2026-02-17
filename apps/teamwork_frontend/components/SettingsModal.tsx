import React, { useState, useEffect } from 'react';
import { X, Settings, DollarSign, Cpu } from 'lucide-react';

export type AIModel = 'haiku' | 'sonnet' | 'opus';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  hourlyRate: number;
  onHourlyRateChange: (rate: number) => void;
  model: AIModel;
  onModelChange: (model: AIModel) => void;
  theme?: 'light' | 'dark';
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  hourlyRate,
  onHourlyRateChange,
  model,
  onModelChange,
  theme = 'dark',
}) => {
  const [localRate, setLocalRate] = useState(hourlyRate);
  const [localModel, setLocalModel] = useState<AIModel>(model);
  const isLight = theme === 'light';

  // Sync local state when props change
  useEffect(() => {
    setLocalRate(hourlyRate);
  }, [hourlyRate]);

  useEffect(() => {
    setLocalModel(model);
  }, [model]);

  if (!isOpen) return null;

  const bgColor = isLight ? 'bg-white' : 'bg-zinc-900';
  const borderColor = isLight ? 'border-zinc-300' : 'border-zinc-700';
  const textPrimary = isLight ? 'text-zinc-900' : 'text-zinc-100';
  const textSecondary = isLight ? 'text-zinc-600' : 'text-zinc-400';
  const inputBg = isLight ? 'bg-zinc-100' : 'bg-zinc-800';

  const handleSave = () => {
    onHourlyRateChange(localRate);
    onModelChange(localModel);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`
          relative w-full max-w-md mx-4 rounded-xl border shadow-2xl
          ${bgColor} ${borderColor}
        `}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${borderColor}`}>
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-cyan-500" />
            <h2 className={`text-lg font-semibold ${textPrimary}`}>Settings</h2>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded-lg hover:bg-zinc-700/50 transition-colors ${textSecondary}`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Hourly Rate Setting */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${textSecondary}`}>
              Hourly Rate
            </label>
            <div className="flex items-center gap-2">
              <div className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border ${borderColor} ${inputBg}`}>
                <DollarSign size={16} className="text-cyan-500" />
                <input
                  type="number"
                  value={localRate}
                  onChange={(e) => setLocalRate(Math.max(0, parseInt(e.target.value) || 0))}
                  onKeyDown={handleKeyDown}
                  className={`flex-1 bg-transparent outline-none font-mono ${textPrimary}`}
                  min={0}
                  step={100}
                />
                <span className={`text-sm ${textSecondary}`}>DKK/hour</span>
              </div>
            </div>
            <p className={`mt-1 text-xs ${textSecondary}`}>
              Used for project cost estimates
            </p>
          </div>

          {/* Preset buttons */}
          <div className="flex gap-2">
            {[800, 1000, 1200, 1500, 2000].map((rate) => (
              <button
                key={rate}
                onClick={() => setLocalRate(rate)}
                className={`
                  px-3 py-1 text-xs rounded-md border transition-colors
                  ${localRate === rate
                    ? 'bg-cyan-500 border-cyan-500 text-white'
                    : `${borderColor} ${textSecondary} hover:border-cyan-500`
                  }
                `}
              >
                {rate.toLocaleString()}
              </button>
            ))}
          </div>

          {/* AI Model Setting */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${textSecondary}`}>
              <span className="flex items-center gap-2">
                <Cpu size={16} className="text-cyan-500" />
                AI Model
              </span>
            </label>
            <div className="flex gap-2">
              {([
                { value: 'haiku' as const, label: 'Haiku', desc: 'Fast & cheap' },
                { value: 'sonnet' as const, label: 'Sonnet', desc: 'Balanced' },
                { value: 'opus' as const, label: 'Opus', desc: 'Most capable' },
              ]).map((m) => (
                <button
                  key={m.value}
                  onClick={() => setLocalModel(m.value)}
                  className={`
                    flex-1 px-3 py-2 text-xs rounded-md border transition-colors text-center
                    ${localModel === m.value
                      ? 'bg-cyan-500 border-cyan-500 text-white'
                      : `${borderColor} ${textSecondary} hover:border-cyan-500`
                    }
                  `}
                >
                  <div className="font-medium">{m.label}</div>
                  <div className={`text-[10px] mt-0.5 ${localModel === m.value ? 'text-cyan-100' : 'opacity-60'}`}>{m.desc}</div>
                </button>
              ))}
            </div>
            <p className={`mt-1 text-xs ${textSecondary}`}>
              Used for all AI agent responses
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className={`flex justify-end gap-2 p-4 border-t ${borderColor}`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 text-sm rounded-lg border ${borderColor} ${textSecondary} hover:bg-zinc-700/30 transition-colors`}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm rounded-lg bg-cyan-500 text-white hover:bg-cyan-600 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
