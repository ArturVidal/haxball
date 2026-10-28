import React, { useState, useEffect } from 'react';
import { Database, X, Trophy, History, Layers, RefreshCw, CheckCircle2 } from 'lucide-react';
import {
  CloudMatchRecord,
  CloudPlayerStats,
  getRecentMatchesFromDatabase,
  getLeaderboardFromDatabase,
} from '../lib/firestoreService';
import { Stadium } from '../types/game';

interface DatabaseModalProps {
  onClose: () => void;
  customStadiums: Stadium[];
}

export const DatabaseModal: React.FC<DatabaseModalProps> = ({ onClose, customStadiums }) => {
  const [activeTab, setActiveTab] = useState<'matches' | 'leaderboard' | 'stadiums'>('matches');
  const [matches, setMatches] = useState<CloudMatchRecord[]>([]);
  const [leaderboard, setLeaderboard] = useState<CloudPlayerStats[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [m, l] = await Promise.all([
        getRecentMatchesFromDatabase(15),
        getLeaderboardFromDatabase(15),
      ]);
      setMatches(m);
      setLeaderboard(l);
    } catch (e) {
      console.warn(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Database size={18} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <span>Base de Dados Cloud (Firestore)</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 size={11} /> Conectado
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Histórico de partidas, líderes e estádios sincronizados em tempo real.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('matches')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              activeTab === 'matches'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History size={14} />
            Partidas Recentes ({matches.length})
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              activeTab === 'leaderboard'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Trophy size={14} />
            Classificação ({leaderboard.length})
          </button>
          <button
            onClick={() => setActiveTab('stadiums')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              activeTab === 'stadiums'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers size={14} />
            Estádios na Nuvem ({customStadiums.length})
          </button>

          <button
            onClick={loadData}
            title="Atualizar dados"
            className="ml-auto p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto pr-1">
          {activeTab === 'matches' && (
            <div className="flex flex-col gap-2">
              {matches.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-800 text-xs hover:bg-slate-800/60 transition-colors"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-slate-200">{m.roomName}</span>
                    <span className="text-[11px] text-slate-400">
                      {m.stadiumName} · Posse: {m.redPossessionPercent}% Red / {m.bluePossessionPercent}% Blue
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 font-mono font-black text-sm">
                      <span className="text-red-400">{m.redScore}</span>
                      <span className="text-slate-600">-</span>
                      <span className="text-blue-400">{m.blueScore}</span>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        m.winnerTeam === 'red'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : m.winnerTeam === 'blue'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {m.winnerTeam === 'draw' ? 'Empate' : `Vitória ${m.winnerTeam.toUpperCase()}`}
                    </span>
                  </div>
                </div>
              ))}

              {matches.length === 0 && !isLoading && (
                <div className="text-center py-10 text-slate-500 text-xs">
                  Ainda não existem partidas gravadas na base de dados. Joga uma partida para registar!
                </div>
              )}
            </div>
          )}

          {activeTab === 'leaderboard' && (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-12 px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <span className="col-span-5">Jogador</span>
                <span className="col-span-2 text-center">Jogos</span>
                <span className="col-span-2 text-center">Vitórias</span>
                <span className="col-span-3 text-right">Golos</span>
              </div>
              {leaderboard.map((player, idx) => (
                <div
                  key={player.id || idx}
                  className="grid grid-cols-12 items-center p-3 rounded-xl bg-slate-800/40 border border-slate-800 text-xs"
                >
                  <div className="col-span-5 flex items-center gap-2 font-semibold text-slate-200">
                    <span className="w-5 text-slate-500 font-mono text-[11px]">#{idx + 1}</span>
                    <span>{player.playerName}</span>
                  </div>
                  <span className="col-span-2 text-center font-mono text-slate-400">
                    {player.matchesPlayed}
                  </span>
                  <span className="col-span-2 text-center font-mono font-bold text-emerald-400">
                    {player.wins}
                  </span>
                  <span className="col-span-3 text-right font-mono font-bold text-amber-400">
                    ⚽ {player.goalsScored}
                  </span>
                </div>
              ))}

              {leaderboard.length === 0 && !isLoading && (
                <div className="text-center py-10 text-slate-500 text-xs">
                  Sem jogadores registados no ranking.
                </div>
              )}
            </div>
          )}

          {activeTab === 'stadiums' && (
            <div className="flex flex-col gap-2">
              {customStadiums.map((stadium) => (
                <div
                  key={stadium.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-800 text-xs"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-slate-200">{stadium.name}</span>
                    <span className="text-[11px] text-slate-400">
                      {stadium.width}x{stadium.height} px · Baliza: {stadium.goalWidth}px · {stadium.obstacles?.length || 0} paredes
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20 font-bold">
                    Na Nuvem
                  </span>
                </div>
              ))}

              {customStadiums.length === 0 && (
                <div className="text-center py-10 text-slate-500 text-xs">
                  Nenhum estádio personalizado criado ainda. Usa o Editor de Estádios para criar!
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
