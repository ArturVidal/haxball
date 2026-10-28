import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, RotateCcw, ArrowLeft, Play, BarChart2 } from 'lucide-react';
import { MatchStats, Team } from '../types/game';

interface MatchEndModalProps {
  redScore: number;
  blueScore: number;
  stats: MatchStats;
  onRestart: () => void;
  onBackToLobby: () => void;
  onWatchLastReplay: () => void;
  hasReplayFrames: boolean;
}

export const MatchEndModal: React.FC<MatchEndModalProps> = ({
  redScore,
  blueScore,
  stats,
  onRestart,
  onBackToLobby,
  onWatchLastReplay,
  hasReplayFrames,
}) => {
  const winner: Team | 'draw' =
    redScore > blueScore ? 'red' : blueScore > redScore ? 'blue' : 'draw';

  useEffect(() => {
    if (winner !== 'draw') {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: winner === 'red' ? ['#ef4444', '#f87171', '#ffffff'] : ['#3b82f6', '#60a5fa', '#ffffff'],
      });
    }
  }, [winner]);

  const totalTicks = stats.redPossessionTicks + stats.bluePossessionTicks;
  const redPoss = totalTicks > 0 ? Math.round((stats.redPossessionTicks / totalTicks) * 100) : 50;
  const bluePoss = 100 - redPoss;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col items-center gap-5">
        {/* Trophy / Header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
            <Trophy size={28} />
          </div>

          <h2 className="text-2xl font-black text-white tracking-tight">
            {winner === 'red' && 'Vitória da Equipa Vermelha!'}
            {winner === 'blue' && 'Vitória da Equipa Azul!'}
            {winner === 'draw' && 'Empate Eletrizante!'}
          </h2>
          <p className="text-xs text-slate-400">Fim de partida no HaxBall Arena</p>
        </div>

        {/* Score Card */}
        <div className="flex items-center justify-center gap-6 bg-slate-950/60 border border-slate-800 rounded-xl px-8 py-4 w-full">
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-red-400 tracking-wider">RED</span>
            <span className="text-4xl font-black font-mono text-white tabular-nums">
              {redScore}
            </span>
          </div>

          <span className="text-2xl font-black text-slate-600">:</span>

          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-blue-400 tracking-wider">BLUE</span>
            <span className="text-4xl font-black font-mono text-white tabular-nums">
              {blueScore}
            </span>
          </div>
        </div>

        {/* Stats Table */}
        <div className="w-full bg-slate-800/40 rounded-xl p-4 border border-slate-800 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <BarChart2 size={15} />
            <span>Estatísticas da Partida</span>
          </div>

          <div className="flex flex-col gap-2.5 text-xs">
            {/* Possession */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                <span className="text-red-400 font-semibold">{redPoss}%</span>
                <span>Posse de Bola</span>
                <span className="text-blue-400 font-semibold">{bluePoss}%</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                <div className="h-full bg-red-500" style={{ width: `${redPoss}%` }} />
                <div className="h-full bg-blue-500" style={{ width: `${bluePoss}%` }} />
              </div>
            </div>

            {/* Shots */}
            <div className="flex justify-between items-center py-1 border-t border-slate-800 text-[11px]">
              <span className="font-mono font-bold text-red-400">{stats.redShots}</span>
              <span className="text-slate-400 font-medium">Remates</span>
              <span className="font-mono font-bold text-blue-400">{stats.blueShots}</span>
            </div>

            {/* Goals Scored Breakdown */}
            {stats.goals.length > 0 && (
              <div className="flex flex-col gap-1 pt-1 border-t border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400">Golos</span>
                <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
                  {stats.goals.map((g, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-[11px] py-0.5"
                    >
                      <span
                        className={`font-semibold ${
                          g.team === 'red' ? 'text-red-400' : 'text-blue-400'
                        }`}
                      >
                        ⚽ {g.scorerName}
                      </span>
                      <span className="text-slate-400 font-mono text-[10px]">
                        {g.speedKmh} km/h
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
          {hasReplayFrames && (
            <button
              onClick={onWatchLastReplay}
              className="w-full sm:flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              <Play size={14} />
              Ver Replay
            </button>
          )}

          <button
            onClick={onRestart}
            className="w-full sm:flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow transition-colors cursor-pointer"
          >
            <RotateCcw size={14} />
            Jogar de Novo
          </button>

          <button
            onClick={onBackToLobby}
            className="w-full sm:flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            <ArrowLeft size={14} />
            Voltar à Sala
          </button>
        </div>
      </div>
    </div>
  );
};
