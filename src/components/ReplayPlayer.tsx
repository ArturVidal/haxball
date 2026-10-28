import React from 'react';
import { Play, Pause, X } from 'lucide-react';

interface ReplayPlayerProps {
  isPlaying: boolean;
  playbackSpeed: number;
  currentFrame: number;
  totalFrames: number;
  onTogglePlay: () => void;
  onChangeSpeed: (speed: number) => void;
  onClose: () => void;
}

export const ReplayPlayer: React.FC<ReplayPlayerProps> = ({
  isPlaying,
  playbackSpeed,
  currentFrame,
  totalFrames,
  onTogglePlay,
  onChangeSpeed,
  onClose,
}) => {
  const progressPercent = totalFrames > 0 ? (currentFrame / totalFrames) * 100 : 0;

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-2 bg-slate-900/95 border border-red-900/40 rounded-xl p-3 shadow-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-bold text-red-400 tracking-wider">
            REPETIÇÃO DO GOLO
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Speed options */}
          <div className="flex items-center gap-1 bg-slate-800 rounded p-0.5 border border-slate-700">
            <button
              onClick={() => onChangeSpeed(0.5)}
              className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                playbackSpeed === 0.5 ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              0.5x
            </button>
            <button
              onClick={() => onChangeSpeed(1.0)}
              className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                playbackSpeed === 1.0 ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              1.0x
            </button>
          </div>

          {/* Play/Pause */}
          <button
            onClick={onTogglePlay}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Progress timeline bar */}
      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-red-500 transition-all duration-75"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};
