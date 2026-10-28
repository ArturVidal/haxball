import React, { useState } from 'react';
import {
  Users,
  Play,
  Plus,
  Trash2,
  Settings,
  Shield,
  Award,
  Sparkles,
  UserCheck,
  Copy,
  Check,
  Share2,
  Link as LinkIcon,
  Crown,
  GripVertical,
  ArrowRightLeft,
} from 'lucide-react';
import { Disc, Room, Stadium, Team } from '../types/game';
import { STADIUMS } from '../physics/stadiums';

interface RoomLobbyProps {
  room: Room;
  currentUserId: string;
  playerName: string;
  isAdmin?: boolean;
  discs: Disc[];
  selectedStadiumId: string;
  timeLimit: number;
  scoreLimit: number;
  isLocalTwoPlayer: boolean;
  botDifficulty: 'easy' | 'medium' | 'hard';
  stadiumsList: Stadium[];
  onSelectStadium: (stadiumId: string) => void;
  onSelectTimeLimit: (minutes: number) => void;
  onSelectScoreLimit: (goals: number) => void;
  onToggleLocalTwoPlayer: (enabled: boolean) => void;
  onSelectBotDifficulty: (diff: 'easy' | 'medium' | 'hard') => void;
  onJoinTeam: (team: Team) => void;
  onMovePlayer?: (playerId: string, targetTeam: Team) => void;
  onAddBot: (team: 'red' | 'blue') => void;
  onRemoveBot: (discId: string) => void;
  onStartMatch: () => void;
  onLeaveRoom: () => void;
  onOpenSettings: () => void;
  onOpenStadiumEditor: () => void;
}

export const RoomLobby: React.FC<RoomLobbyProps> = ({
  room,
  currentUserId,
  playerName,
  isAdmin: propIsAdmin,
  discs,
  selectedStadiumId,
  timeLimit,
  scoreLimit,
  isLocalTwoPlayer,
  botDifficulty,
  onSelectStadium,
  onSelectTimeLimit,
  onSelectScoreLimit,
  onToggleLocalTwoPlayer,
  onSelectBotDifficulty,
  onJoinTeam,
  onMovePlayer,
  onAddBot,
  onRemoveBot,
  onStartMatch,
  onLeaveRoom,
  onOpenSettings,
  stadiumsList,
  onOpenStadiumEditor,
}) => {
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
  const [dragOverTeam, setDragOverTeam] = useState<Team | null>(null);

  const isAdmin = propIsAdmin ?? (room.hostName === playerName);

  const redPlayers = discs.filter((d) => d.team === 'red');
  const bluePlayers = discs.filter((d) => d.team === 'blue');
  const spectators = discs.filter((d) => d.team === 'spectator');

  const canStart = redPlayers.length > 0 && bluePlayers.length > 0;

  // Build the shareable direct URL for this room
  const getRoomShareUrl = () => {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    return `${origin}${pathname}?room=${encodeURIComponent(room.id)}`;
  };

  const handleCopyLink = async () => {
    const url = getRoomShareUrl();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for non-secure contexts
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    } catch (err) {
      console.warn('Falha ao copiar para o clipboard:', err);
    }
  };

  // Drag and Drop Handlers for Admin
  const handleDragStart = (e: React.DragEvent, playerId: string) => {
    if (!isAdmin) return;
    e.dataTransfer.setData('text/plain', playerId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedPlayerId(playerId);
  };

  const handleDragEnd = () => {
    setDraggedPlayerId(null);
    setDragOverTeam(null);
  };

  const handleDragOver = (e: React.DragEvent, team: Team) => {
    if (!isAdmin) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverTeam !== team) {
      setDragOverTeam(team);
    }
  };

  const handleDrop = (e: React.DragEvent, targetTeam: Team) => {
    if (!isAdmin) return;
    e.preventDefault();
    setDragOverTeam(null);
    const playerId = e.dataTransfer.getData('text/plain') || draggedPlayerId;
    if (playerId && onMovePlayer) {
      onMovePlayer(playerId, targetTeam);
    }
    setDraggedPlayerId(null);
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6 p-4 md:p-6">
      {/* Room Header with Info, Admin Badge and Copy Link */}
      <div className="flex flex-col gap-4 bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-white tracking-tight">{room.name}</h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Sala Aberta
              </span>
              {isAdmin && (
                <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <Crown size={12} className="text-amber-400" />
                  Admin / Anfitrião
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Anfitrião: <strong className="text-slate-200">{room.hostName}</strong> · Estádio: {STADIUMS[selectedStadiumId]?.name || selectedStadiumId}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Copy Room Link Button */}
            <button
              onClick={handleCopyLink}
              title="Copiar link direto para convidar amigos para a sala"
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all shadow-sm cursor-pointer ${
                copiedLink
                  ? 'bg-emerald-600 text-white border border-emerald-400 scale-105'
                  : 'bg-indigo-600/90 hover:bg-indigo-600 text-white border border-indigo-500/40 hover:shadow-indigo-500/20'
              }`}
            >
              {copiedLink ? <Check size={15} /> : <Share2 size={15} />}
              <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link da Sala'}</span>
            </button>

            <button
              onClick={onOpenSettings}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              <Settings size={15} />
              Avatar
            </button>
            <button
              onClick={onLeaveRoom}
              className="px-3.5 py-2 text-xs font-semibold text-rose-300 hover:text-white hover:bg-rose-950/50 rounded-lg border border-rose-900/40 transition-colors cursor-pointer"
            >
              Sair da Sala
            </button>
          </div>
        </div>

        {/* Share Link Banner & Admin Instruction Banner */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs text-slate-300">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <LinkIcon size={14} className="text-indigo-400 shrink-0" />
            <span className="text-slate-400 shrink-0">Link de Convite:</span>
            <div className="flex-1 sm:max-w-md flex items-center bg-slate-950/80 border border-slate-800 rounded px-2.5 py-1 font-mono text-[11px] text-slate-300 overflow-hidden select-all">
              <span className="truncate">{getRoomShareUrl()}</span>
            </div>
          </div>

          {isAdmin ? (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-400 bg-amber-950/30 border border-amber-900/40 px-2.5 py-1 rounded-md shrink-0">
              <Crown size={13} />
              <span>
                <strong>Modo Admin:</strong> Podes arrastar jogadores entre as equipas!
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-slate-400">
              Clica nos botões abaixo para escolheres a tua equipa.
            </span>
          )}
        </div>
      </div>

      {/* Main Pitch Teams Board (Red, Spectators, Blue) with Drag & Drop */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* RED TEAM BOX */}
        <div
          onDragOver={(e) => handleDragOver(e, 'red')}
          onDrop={(e) => handleDrop(e, 'red')}
          onDragLeave={() => {
            if (dragOverTeam === 'red') setDragOverTeam(null);
          }}
          className={`flex flex-col rounded-xl p-4 shadow-lg transition-all ${
            dragOverTeam === 'red'
              ? 'bg-red-950/60 border-2 border-red-500 shadow-red-900/30 scale-[1.01]'
              : 'bg-slate-900/90 border border-red-900/40'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-red-900/30 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full bg-red-500 ring-2 ring-red-400/40" />
              <h2 className="text-sm font-bold text-red-400 tracking-wider">EQUIPA VERMELHA</h2>
            </div>
            <span className="text-xs font-semibold text-slate-400 font-mono">
              {redPlayers.length} jogadores
            </span>
          </div>

          {/* Droppable Players Container */}
          <div
            className={`flex flex-col gap-2 min-h-[160px] max-h-[240px] overflow-y-auto mb-3 p-1 rounded-lg transition-colors ${
              dragOverTeam === 'red' ? 'bg-red-900/20' : ''
            }`}
          >
            {redPlayers.map((player) => (
              <div
                key={player.id}
                draggable={isAdmin}
                onDragStart={(e) => handleDragStart(e, player.id)}
                onDragEnd={handleDragEnd}
                title={isAdmin ? 'Arrasta este jogador para outra equipa ou usa os botões' : undefined}
                className={`flex items-center justify-between p-2.5 rounded-lg bg-red-950/30 border border-red-900/25 transition-all ${
                  isAdmin ? 'cursor-grab active:cursor-grabbing hover:border-red-500/50 hover:bg-red-950/50' : ''
                } ${draggedPlayerId === player.id ? 'opacity-40 scale-95' : ''}`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  {isAdmin && (
                    <GripVertical size={14} className="text-slate-500 hover:text-slate-300 shrink-0" />
                  )}
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shadow-inner shrink-0"
                    style={{ backgroundColor: player.color, color: player.avatarColor }}
                  >
                    {player.avatar}
                  </div>
                  <span className="text-xs font-semibold text-slate-200 truncate">
                    {player.name}
                    {player.id === currentUserId && ' (Tu)'}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Admin Fast Team Switch Arrows */}
                  {isAdmin && onMovePlayer && (
                    <div className="flex items-center gap-1 mr-1">
                      <button
                        type="button"
                        onClick={() => onMovePlayer(player.id, 'spectator')}
                        title="Mover para Espectadores"
                        className="px-1.5 py-0.5 text-[10px] font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors cursor-pointer"
                      >
                        Esp
                      </button>
                      <button
                        type="button"
                        onClick={() => onMovePlayer(player.id, 'blue')}
                        title="Mover para Azul"
                        className="px-1.5 py-0.5 text-[10px] font-bold text-blue-300 hover:text-blue-100 bg-blue-950 hover:bg-blue-900 border border-blue-800/40 rounded transition-colors cursor-pointer"
                      >
                        → Azul
                      </button>
                    </div>
                  )}

                  {player.isBot && (
                    <button
                      onClick={() => onRemoveBot(player.id)}
                      title="Remover Bot"
                      className="text-slate-400 hover:text-red-400 p-1 cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {redPlayers.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-xs text-slate-500 italic py-8 border border-dashed border-red-900/30 rounded-lg">
                <span>Nenhum jogador na equipa</span>
                {isAdmin && <span className="text-[11px] text-red-400/80 mt-1">Arrasta jogadores para aqui</span>}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mt-auto pt-2">
            <button
              onClick={() => onJoinTeam('red')}
              className="flex-1 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              Entrar Red
            </button>
            <button
              onClick={() => onAddBot('red')}
              disabled={redPlayers.length >= 3}
              className="p-2 text-red-200 bg-red-950/60 hover:bg-red-900/70 border border-red-800/40 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
              title="Adicionar Bot Vermelho"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* SPECTATORS BOX */}
        <div
          onDragOver={(e) => handleDragOver(e, 'spectator')}
          onDrop={(e) => handleDrop(e, 'spectator')}
          onDragLeave={() => {
            if (dragOverTeam === 'spectator') setDragOverTeam(null);
          }}
          className={`flex flex-col rounded-xl p-4 shadow-lg transition-all ${
            dragOverTeam === 'spectator'
              ? 'bg-slate-800/80 border-2 border-emerald-400 shadow-slate-800/50 scale-[1.01]'
              : 'bg-slate-900/80 border border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-slate-400" />
              <h2 className="text-sm font-bold text-slate-300 tracking-wider">ESPECTADORES</h2>
            </div>
            <span className="text-xs font-semibold text-slate-400 font-mono">
              {spectators.length}
            </span>
          </div>

          {/* Droppable Spectators Container */}
          <div
            className={`flex flex-col gap-2 min-h-[160px] max-h-[240px] overflow-y-auto mb-3 p-1 rounded-lg transition-colors ${
              dragOverTeam === 'spectator' ? 'bg-slate-800/30' : ''
            }`}
          >
            {spectators.map((player) => (
              <div
                key={player.id}
                draggable={isAdmin}
                onDragStart={(e) => handleDragStart(e, player.id)}
                onDragEnd={handleDragEnd}
                title={isAdmin ? 'Arrasta este jogador para outra equipa ou usa os botões' : undefined}
                className={`flex items-center justify-between p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/30 transition-all ${
                  isAdmin ? 'cursor-grab active:cursor-grabbing hover:border-slate-500 hover:bg-slate-800/70' : ''
                } ${draggedPlayerId === player.id ? 'opacity-40 scale-95' : ''}`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  {isAdmin && (
                    <GripVertical size={14} className="text-slate-500 hover:text-slate-300 shrink-0" />
                  )}
                  <div className="w-7 h-7 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {player.avatar}
                  </div>
                  <span className="text-xs font-medium text-slate-300 truncate">
                    {player.name}
                    {player.id === currentUserId && ' (Tu)'}
                  </span>
                </div>

                {/* Admin Quick Buttons */}
                {isAdmin && onMovePlayer && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onMovePlayer(player.id, 'red')}
                      title="Mover para Red"
                      className="px-1.5 py-0.5 text-[10px] font-bold text-red-300 hover:text-red-100 bg-red-950 hover:bg-red-900 border border-red-800/40 rounded transition-colors cursor-pointer"
                    >
                      ← Red
                    </button>
                    <button
                      type="button"
                      onClick={() => onMovePlayer(player.id, 'blue')}
                      title="Mover para Blue"
                      className="px-1.5 py-0.5 text-[10px] font-bold text-blue-300 hover:text-blue-100 bg-blue-950 hover:bg-blue-900 border border-blue-800/40 rounded transition-colors cursor-pointer"
                    >
                      Blue →
                    </button>
                  </div>
                )}
              </div>
            ))}
            {spectators.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-xs text-slate-500 italic py-8 border border-dashed border-slate-800/60 rounded-lg">
                <span>Sem espectadores</span>
                {isAdmin && <span className="text-[11px] text-slate-400 mt-1">Arrasta jogadores para aqui</span>}
              </div>
            )}
          </div>

          <div className="mt-auto pt-2">
            <button
              onClick={() => onJoinTeam('spectator')}
              className="w-full py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              Ficar Espectador
            </button>
          </div>
        </div>

        {/* BLUE TEAM BOX */}
        <div
          onDragOver={(e) => handleDragOver(e, 'blue')}
          onDrop={(e) => handleDrop(e, 'blue')}
          onDragLeave={() => {
            if (dragOverTeam === 'blue') setDragOverTeam(null);
          }}
          className={`flex flex-col rounded-xl p-4 shadow-lg transition-all ${
            dragOverTeam === 'blue'
              ? 'bg-blue-950/60 border-2 border-blue-500 shadow-blue-900/30 scale-[1.01]'
              : 'bg-slate-900/90 border border-blue-900/40'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-blue-900/30 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full bg-blue-500 ring-2 ring-blue-400/40" />
              <h2 className="text-sm font-bold text-blue-400 tracking-wider">EQUIPA AZUL</h2>
            </div>
            <span className="text-xs font-semibold text-slate-400 font-mono">
              {bluePlayers.length} jogadores
            </span>
          </div>

          {/* Droppable Players Container */}
          <div
            className={`flex flex-col gap-2 min-h-[160px] max-h-[240px] overflow-y-auto mb-3 p-1 rounded-lg transition-colors ${
              dragOverTeam === 'blue' ? 'bg-blue-900/20' : ''
            }`}
          >
            {bluePlayers.map((player) => (
              <div
                key={player.id}
                draggable={isAdmin}
                onDragStart={(e) => handleDragStart(e, player.id)}
                onDragEnd={handleDragEnd}
                title={isAdmin ? 'Arrasta este jogador para outra equipa ou usa os botões' : undefined}
                className={`flex items-center justify-between p-2.5 rounded-lg bg-blue-950/30 border border-blue-900/25 transition-all ${
                  isAdmin ? 'cursor-grab active:cursor-grabbing hover:border-blue-500/50 hover:bg-blue-950/50' : ''
                } ${draggedPlayerId === player.id ? 'opacity-40 scale-95' : ''}`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  {isAdmin && (
                    <GripVertical size={14} className="text-slate-500 hover:text-slate-300 shrink-0" />
                  )}
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shadow-inner shrink-0"
                    style={{ backgroundColor: player.color, color: player.avatarColor }}
                  >
                    {player.avatar}
                  </div>
                  <span className="text-xs font-semibold text-slate-200 truncate">
                    {player.name}
                    {player.id === currentUserId && ' (Tu)'}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Admin Fast Team Switch Arrows */}
                  {isAdmin && onMovePlayer && (
                    <div className="flex items-center gap-1 mr-1">
                      <button
                        type="button"
                        onClick={() => onMovePlayer(player.id, 'red')}
                        title="Mover para Vermelha"
                        className="px-1.5 py-0.5 text-[10px] font-bold text-red-300 hover:text-red-100 bg-red-950 hover:bg-red-900 border border-red-800/40 rounded transition-colors cursor-pointer"
                      >
                        ← Red
                      </button>
                      <button
                        type="button"
                        onClick={() => onMovePlayer(player.id, 'spectator')}
                        title="Mover para Espectadores"
                        className="px-1.5 py-0.5 text-[10px] font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors cursor-pointer"
                      >
                        Esp
                      </button>
                    </div>
                  )}

                  {player.isBot && (
                    <button
                      onClick={() => onRemoveBot(player.id)}
                      title="Remover Bot"
                      className="text-slate-400 hover:text-blue-400 p-1 cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {bluePlayers.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-xs text-slate-500 italic py-8 border border-dashed border-blue-900/30 rounded-lg">
                <span>Nenhum jogador na equipa</span>
                {isAdmin && <span className="text-[11px] text-blue-400/80 mt-1">Arrasta jogadores para aqui</span>}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mt-auto pt-2">
            <button
              onClick={() => onJoinTeam('blue')}
              className="flex-1 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              Entrar Blue
            </button>
            <button
              onClick={() => onAddBot('blue')}
              disabled={bluePlayers.length >= 3}
              className="p-2 text-blue-200 bg-blue-950/60 hover:bg-blue-900/70 border border-blue-800/40 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
              title="Adicionar Bot Azul"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Match Configuration Settings */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col gap-5">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Configuração da Partida
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Stadium Select & Editor Trigger */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">Estádio</label>
              <button
                type="button"
                onClick={onOpenStadiumEditor}
                className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer"
              >
                + Editor de Estádio
              </button>
            </div>
            <select
              value={selectedStadiumId}
              onChange={(e) => onSelectStadium(e.target.value)}
              className="bg-slate-800 text-slate-100 text-xs font-medium rounded-lg p-2.5 border border-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {stadiumsList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.isCustom ? '★ (Personalizado)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Time Limit */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">Tempo Limite</label>
            <select
              value={timeLimit}
              onChange={(e) => onSelectTimeLimit(Number(e.target.value))}
              className="bg-slate-800 text-slate-100 text-xs font-medium rounded-lg p-2.5 border border-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value={0}>Sem Limite de Tempo</option>
              <option value={1}>1 Minuto (Rápido)</option>
              <option value={3}>3 Minutos (Padrão)</option>
              <option value={5}>5 Minutos (Competitivo)</option>
              <option value={10}>10 Minutos (Longo)</option>
            </select>
          </div>

          {/* Score Limit */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">Limite de Golos</label>
            <select
              value={scoreLimit}
              onChange={(e) => onSelectScoreLimit(Number(e.target.value))}
              className="bg-slate-800 text-slate-100 text-xs font-medium rounded-lg p-2.5 border border-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value={0}>Sem Limite de Golos</option>
              <option value={1}>1 Golo (Morte Súbita)</option>
              <option value={3}>3 Golos (Padrão)</option>
              <option value={5}>5 Golos</option>
              <option value={7}>7 Golos</option>
            </select>
          </div>

          {/* Bot Difficulty */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">Dificuldade dos Bots</label>
            <div className="flex items-center gap-1 p-1 bg-slate-800 rounded-lg border border-slate-700">
              <button
                type="button"
                onClick={() => onSelectBotDifficulty('easy')}
                className={`flex-1 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                  botDifficulty === 'easy'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Fácil
              </button>
              <button
                type="button"
                onClick={() => onSelectBotDifficulty('medium')}
                className={`flex-1 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                  botDifficulty === 'medium'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Médio
              </button>
              <button
                type="button"
                onClick={() => onSelectBotDifficulty('hard')}
                className={`flex-1 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                  botDifficulty === 'hard'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Craque
              </button>
            </div>
          </div>
        </div>

        {/* Local 2-Player Toggle Bar */}
        <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-200">
              Modo 2 Jogadores no Mesmo Teclado (Local)
            </span>
            <span className="text-[11px] text-slate-400">
              Jogador 1 (Vermelho): W, A, S, D + Espaço · Jogador 2 (Azul): Setas + Enter/X
            </span>
          </div>
          <button
            onClick={() => onToggleLocalTwoPlayer(!isLocalTwoPlayer)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              isLocalTwoPlayer
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {isLocalTwoPlayer ? 'Ativado' : 'Desativado'}
          </button>
        </div>
      </div>

      {/* Start Button Area */}
      <div className="flex items-center justify-center pt-2">
        <button
          onClick={onStartMatch}
          disabled={!canStart}
          className="flex items-center gap-3 px-8 py-3.5 text-sm font-extrabold uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 rounded-xl shadow-lg hover:shadow-emerald-500/25 transition-all transform active:scale-95 cursor-pointer"
        >
          <Play size={18} fill="currentColor" />
          Começar Partida
        </button>
      </div>
      {!canStart && (
        <p className="text-center text-xs text-amber-400 font-medium -mt-2">
          Adiciona pelo menos um jogador ou bot a cada equipa para começar!
        </p>
      )}
    </div>
  );
};
