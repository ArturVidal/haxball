import React from 'react';

interface TouchControlsProps {
  onDirectionChange: (dx: number, dy: number) => void;
  onKickChange: (isKicking: boolean) => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  onDirectionChange,
  onKickChange,
}) => {
  const handleTouchStart = (dx: number, dy: number) => {
    onDirectionChange(dx, dy);
  };

  const handleTouchEnd = () => {
    onDirectionChange(0, 0);
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex items-center justify-between px-4 py-2 select-none md:hidden touch-none">
      {/* 4-way D-Pad */}
      <div className="relative w-32 h-32 flex items-center justify-center">
        {/* Up */}
        <button
          type="button"
          onTouchStart={() => handleTouchStart(0, -1)}
          onTouchEnd={handleTouchEnd}
          onMouseDown={() => handleTouchStart(0, -1)}
          onMouseUp={handleTouchEnd}
          className="absolute top-0 w-11 h-11 bg-slate-800/80 active:bg-slate-700 text-white font-bold rounded-lg flex items-center justify-center border border-slate-700 shadow-md"
        >
          ▲
        </button>
        {/* Down */}
        <button
          type="button"
          onTouchStart={() => handleTouchStart(0, 1)}
          onTouchEnd={handleTouchEnd}
          onMouseDown={() => handleTouchStart(0, 1)}
          onMouseUp={handleTouchEnd}
          className="absolute bottom-0 w-11 h-11 bg-slate-800/80 active:bg-slate-700 text-white font-bold rounded-lg flex items-center justify-center border border-slate-700 shadow-md"
        >
          ▼
        </button>
        {/* Left */}
        <button
          type="button"
          onTouchStart={() => handleTouchStart(-1, 0)}
          onTouchEnd={handleTouchEnd}
          onMouseDown={() => handleTouchStart(-1, 0)}
          onMouseUp={handleTouchEnd}
          className="absolute left-0 w-11 h-11 bg-slate-800/80 active:bg-slate-700 text-white font-bold rounded-lg flex items-center justify-center border border-slate-700 shadow-md"
        >
          ◀
        </button>
        {/* Right */}
        <button
          type="button"
          onTouchStart={() => handleTouchStart(1, 0)}
          onTouchEnd={handleTouchEnd}
          onMouseDown={() => handleTouchStart(1, 0)}
          onMouseUp={handleTouchEnd}
          className="absolute right-0 w-11 h-11 bg-slate-800/80 active:bg-slate-700 text-white font-bold rounded-lg flex items-center justify-center border border-slate-700 shadow-md"
        >
          ▶
        </button>
      </div>

      {/* Large Kick Button */}
      <button
        type="button"
        onTouchStart={() => onKickChange(true)}
        onTouchEnd={() => onKickChange(false)}
        onMouseDown={() => onKickChange(true)}
        onMouseUp={() => onKickChange(false)}
        className="w-24 h-24 rounded-full bg-emerald-600 active:bg-emerald-500 text-white font-black text-sm uppercase tracking-wider flex items-center justify-center shadow-lg border-2 border-emerald-400/40 transform active:scale-95 transition-transform"
      >
        CHUTE
      </button>
    </div>
  );
};
