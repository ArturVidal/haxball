import React from 'react';
import { Volume2, VolumeX, Pause, Play, LogOut, RotateCcw } from 'lucide-react';
import { MatchStats, MatchStatus } from '../types/game';

interface ScoreboardProps {
  redScore: number;
  blueScore: number;
  timeSeconds: number;
  scoreLimit: number;
  timeLimitMinutes: number;
  matchStatus: MatchStatus;
  isMuted: boolean;
  stats: MatchStats;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onRestartMatch: () => void;
  onExitToLobby: () => void;
}

export const Scoreboard: React.FC<ScoreboardProps> = ({
  redScore,
  blueScore,
  timeSeconds,
  scoreLimit,
  timeLimitMinutes,
  matchStatus,
  isMuted,
  stats,
  onToggleMute,
  onTogglePause,
  onRestartMatch,
  onExitToLobby,
}) => {
  const minutes = Math.floor(timeSeconds / 60);
  const seconds = timeSeconds % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const totalTicks = stats.redPossessionTicks + stats.bluePossessionTicks;
  const redPoss = totalTicks > 0 ? Math.round((stats.redPossessionTicks / totalTicks) * 100) : 50;
  const bluePoss = 100 - redPoss;

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-2">
      {/* Top Bar with Scores & Controls */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl px-5 py-3 shadow-lg flex items-center justify-between gap-4">
        {/* Red Team Score */}
        <div className="flex items-center gap-3">
          <div className="w-3.5 h-3.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-red-400 tracking-wider">RED</span>
            <span className="text-2xl font-black font-mono text-white tabular-nums leading-none">
              {redScore}
            </span>
          </div>
        </div>

        {/* Center: Match Clock & Limits */}
        <div className="flex flex-col items-center">
          <div className="text-2xl font-black font-mono text-slate-100 tracking-wider tabular-nums">
            {timeFormatted}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
            <span>
              {scoreLimit > 0 ? `Limite: ${scoreLimit} golos` : 'Sem limite de golos'}
            </span>
            <span>·</span>
            <span>
              {timeLimitMinutes > 0 ? `${timeLimitMinutes} min` : 'Sem tempo limite'}
            </span>
          </div>
        </div>

        {/* Blue Team Score */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-blue-400 tracking-wider">BLUE</span>
            <span className="text-2xl font-black font-mono text-white tabular-nums leading-none">
              {blueScore}
            </span>
          </div>
          <div className="w-3.5 h-3.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
        </div>

        {/* Actions / Buttons */}
        <div className="flex items-center gap-1.5 pl-3 border-l border-slate-800">
          <button
            onClick={onTogglePause}
            title={matchStatus === 'playing' ? 'Pausar Partida' : 'Continuar'}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            {matchStatus === 'playing' ? <Pause size={16} /> : <Play size={16} />}
          </button>

          <button
            onClick={onRestartMatch}
            title="Reiniciar Partida"
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw size={16} />
          </button>

          <button
            onClick={onToggleMute}
            title={isMuted ? 'Ativar Som' : 'Desativar Som'}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          <button
            onClick={onExitToLobby}
            title="Sair para o Menu da Sala"
            className="p-2 text-slate-300 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Possession & Stats Mini Bar */}
      <div className="w-full flex items-center gap-2 px-2 text-[11px] text-slate-400">
        <span className="font-semibold text-red-400 tabular-nums">{redPoss}%</span>
        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-red-500 transition-all duration-300"
            style={{ width: `${redPoss}%` }}
          />
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${bluePoss}%` }}
          />
        </div>
        <span className="font-semibold text-blue-400 tabular-nums">{bluePoss}%</span>
      </div>
    </div>
  );
};
