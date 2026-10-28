import React, { useState } from 'react';
import { Search, Plus, Lock, Globe, Users, Trophy, Play, RefreshCw, Zap, Share2, Check } from 'lucide-react';
import { Room, Stadium } from '../types/game';
import { STADIUMS } from '../physics/stadiums';

interface RoomBrowserProps {
  rooms: Room[];
  stadiumsList?: Stadium[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onJoinRoom: (room: Room) => void;
  onCreateRoom: (roomData: {
    name: string;
    stadiumId: string;
    scoreLimit: number;
    timeLimitMinutes: number;
    maxPlayers: number;
    password?: string;
  }) => void;
  onQuickPlay: () => void;
  onOpenStadiumEditor?: () => void;
}

export const RoomBrowser: React.FC<RoomBrowserProps> = ({
  rooms,
  stadiumsList = Object.values(STADIUMS),
  isLoading = false,
  onRefresh,
  onJoinRoom,
  onCreateRoom,
  onQuickPlay,
  onOpenStadiumEditor,
}) => {
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roomName, setRoomName] = useState('Minha Arena');
  const [stadiumId, setStadiumId] = useState('classic');
  const [scoreLimit, setScoreLimit] = useState(3);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(3);
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [password, setPassword] = useState('');
  const [copiedRoomId, setCopiedRoomId] = useState<string | null>(null);

  const filteredRooms = rooms.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.hostName.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;
    onCreateRoom({
      name: roomName.trim(),
      stadiumId,
      scoreLimit,
      timeLimitMinutes,
      maxPlayers,
      password: password.trim() ? password.trim() : undefined,
    });
    setShowCreateModal(false);
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6 p-4 md:p-6">
      {/* Hero Quick Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-950/60 to-slate-900 border border-slate-800 p-6 md:p-8 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col gap-2 max-w-xl">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 tracking-wider uppercase">
            <Trophy size={15} />
            <span>HaxBall 2D Soccer Arena</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
            Entra em campo e mostra quem manda!
          </h1>
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
            Física realista de bola e discos, jogadas tabeladas, defesas acrobáticas e golos incríveis. Joga agora contra bots avançados ou chama amigos para partidas no mesmo teclado.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <button
            onClick={onQuickPlay}
            className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3.5 text-xs font-black uppercase tracking-wider text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl shadow-lg transition-transform active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <Zap size={16} fill="currentColor" />
            Jogo Rápido (1v1)
          </button>
          {onOpenStadiumEditor && (
            <button
              onClick={onOpenStadiumEditor}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3.5 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus size={16} />
              Editor de Estádio
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus size={16} />
            Criar Sala
          </button>
        </div>
      </div>

      {/* Room Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-md">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar salas ou anfitriões..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800/80 text-white placeholder-slate-400 text-xs rounded-lg pl-10 pr-4 py-2.5 border border-slate-700 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400 px-2 font-medium">
          {onRefresh && (
            <button
              onClick={onRefresh}
              title="Atualizar Salas da Base de Dados"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin text-emerald-400' : ''} />
            </button>
          )}
          <div className="flex items-center gap-1.5">
            <Globe size={14} className="text-emerald-400" />
            <span>{rooms.length} {rooms.length === 1 ? 'sala ativa' : 'salas ativas'}</span>
          </div>
        </div>
      </div>

      {/* Room Table List */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl shadow-xl overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-3 bg-slate-800/60 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          <div className="col-span-5 sm:col-span-4">Nome da Sala</div>
          <div className="col-span-3 sm:col-span-3">Estádio</div>
          <div className="col-span-2 sm:col-span-2 text-center">Jogadores</div>
          <div className="hidden sm:block sm:col-span-2">Anfitrião</div>
          <div className="col-span-2 sm:col-span-1 text-right">Ação</div>
        </div>

        <div className="divide-y divide-slate-800/60 max-h-[460px] overflow-y-auto">
          {isLoading && rooms.length === 0 ? (
            <div className="flex items-center justify-center gap-3 py-16 text-slate-400 text-xs">
              <RefreshCw size={16} className="animate-spin text-emerald-400" />
              <span>A carregar salas da base de dados...</span>
            </div>
          ) : filteredRooms.map((room) => {
            const stadium =
              stadiumsList.find((s) => s.id === room.stadiumId) ||
              STADIUMS[room.stadiumId] ||
              STADIUMS.classic;
            return (
              <div
                key={room.id}
                className="grid grid-cols-12 items-center px-4 py-3.5 hover:bg-slate-800/40 transition-colors text-xs"
              >
                <div className="col-span-5 sm:col-span-4 flex items-center gap-2.5 font-semibold text-slate-200">
                  {room.isPrivate ? (
                    <Lock size={14} className="text-amber-400 shrink-0" />
                  ) : (
                    <Globe size={14} className="text-emerald-400 shrink-0" />
                  )}
                  <span className="truncate">{room.name}</span>
                </div>

                <div className="col-span-3 sm:col-span-3 text-slate-400 font-medium truncate">
                  {stadium.name}
                </div>

                <div className="col-span-2 sm:col-span-2 text-center font-mono font-semibold text-slate-300">
                  {room.playerCount} / {room.maxPlayers}
                </div>

                <div className="hidden sm:block sm:col-span-2 text-slate-400 truncate">
                  {room.hostName}
                </div>

                <div className="col-span-2 sm:col-span-1 flex items-center justify-end gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(room.id)}`;
                      if (navigator.clipboard?.writeText) {
                        navigator.clipboard.writeText(url);
                      }
                      setCopiedRoomId(room.id);
                      setTimeout(() => setCopiedRoomId(null), 2500);
                    }}
                    title="Copiar link direto para esta sala"
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    {copiedRoomId === room.id ? (
                      <Check size={14} className="text-emerald-400" />
                    ) : (
                      <Share2 size={14} />
                    )}
                  </button>
                  <button
                    onClick={() => onJoinRoom(room)}
                    className="px-3 py-1.5 text-xs font-bold text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-600 border border-emerald-500/20 hover:border-emerald-600 rounded-lg transition-colors cursor-pointer"
                  >
                    Entrar
                  </button>
                </div>
              </div>
            );
          })}

          {!isLoading && filteredRooms.length === 0 && (
            search.trim() ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                Nenhuma sala encontrada com o termo "{search}".
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700/80 flex items-center justify-center text-emerald-400 mb-3 shadow-inner">
                  <Globe size={24} />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">Nenhuma sala criada de momento</h3>
                <p className="text-xs text-slate-400 max-w-sm mb-5 leading-relaxed">
                  As salas vêm diretamente da base de dados em tempo real. Cria a tua primeira sala para começar uma partida ou joga já no modo rápido!
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-transform active:scale-95 cursor-pointer"
                  >
                    <Plus size={14} />
                    Criar Sala Agora
                  </button>
                  <button
                    onClick={onQuickPlay}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                  >
                    <Zap size={14} className="text-amber-400" />
                    Jogo Rápido (1v1)
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Modal: Create Room */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col gap-4">
            <h2 className="text-lg font-black text-white">Criar Nova Sala</h2>

            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">Nome da Sala</label>
                <input
                  type="text"
                  required
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="bg-slate-800 text-white text-xs rounded-lg p-2.5 border border-slate-700 focus:outline-none focus:border-emerald-500"
                  placeholder="Ex: Arena dos Campeões 2v2"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">Estádio</label>
                <select
                  value={stadiumId}
                  onChange={(e) => setStadiumId(e.target.value)}
                  className="bg-slate-800 text-white text-xs rounded-lg p-2.5 border border-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {stadiumsList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.isCustom ? '★ (Personalizado)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300">Golos Limite</label>
                  <select
                    value={scoreLimit}
                    onChange={(e) => setScoreLimit(Number(e.target.value))}
                    className="bg-slate-800 text-white text-xs rounded-lg p-2.5 border border-slate-700 cursor-pointer"
                  >
                    <option value={0}>Sem limite</option>
                    <option value={1}>1 golo</option>
                    <option value={3}>3 golos</option>
                    <option value={5}>5 golos</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300">Tempo Limite</label>
                  <select
                    value={timeLimitMinutes}
                    onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
                    className="bg-slate-800 text-white text-xs rounded-lg p-2.5 border border-slate-700 cursor-pointer"
                  >
                    <option value={0}>Sem limite</option>
                    <option value={3}>3 minutos</option>
                    <option value={5}>5 minutos</option>
                    <option value={10}>10 minutos</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Palavra-passe (Opcional)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Deixa vazio para sala pública"
                  className="bg-slate-800 text-white text-xs rounded-lg p-2.5 border border-slate-700 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer"
                >
                  Criar e Entrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
