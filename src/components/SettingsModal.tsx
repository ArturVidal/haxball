import React, { useState } from 'react';
import { X, User, Palette, Keyboard, Volume2 } from 'lucide-react';

interface SettingsModalProps {
  playerName: string;
  playerAvatar: string;
  isMuted: boolean;
  onSave: (name: string, avatar: string) => void;
  onToggleMute: () => void;
  onClose: () => void;
}

const PRESET_AVATARS = ['7', '10', '1', '9', '⚽', '🔥', '👑', 'CR', 'LM', 'HB', 'X', '★'];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  playerName,
  playerAvatar,
  isMuted,
  onSave,
  onToggleMute,
  onClose,
}) => {
  const [name, setName] = useState(playerName);
  const [avatar, setAvatar] = useState(playerAvatar);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(name.trim() || 'Jogador', avatar.trim() || '7');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col gap-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <User size={18} className="text-emerald-400" />
            <h2 className="text-lg font-black text-white">Perfil & Controlos</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Nickname */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">O Teu Nome / Nickname</label>
            <input
              type="text"
              maxLength={16}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-slate-800 text-white text-xs rounded-lg p-2.5 border border-slate-700 focus:outline-none focus:border-emerald-500"
              placeholder="Jogador"
            />
          </div>

          {/* Avatar tag */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Avatar do Disco (1 a 2 caracteres ou emoji)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="text"
                maxLength={2}
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                className="w-16 text-center font-bold text-sm bg-slate-800 text-white rounded-lg p-2 border border-slate-700 focus:outline-none focus:border-emerald-500"
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                {PRESET_AVATARS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAvatar(p)}
                    className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Disc Preview */}
          <div className="flex items-center justify-center p-3 bg-slate-950/50 rounded-xl border border-slate-800 gap-6">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-slate-400 font-semibold">Vermelho</span>
              <div className="w-10 h-10 rounded-full bg-red-600 border-2 border-black flex items-center justify-center text-white font-black text-sm shadow-md">
                {avatar || '7'}
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-slate-400 font-semibold">Azul</span>
              <div className="w-10 h-10 rounded-full bg-blue-600 border-2 border-black flex items-center justify-center text-white font-black text-sm shadow-md">
                {avatar || '7'}
              </div>
            </div>
          </div>

          {/* Controls Quick Reference */}
          <div className="flex flex-col gap-2 p-3 bg-slate-800/40 rounded-xl border border-slate-800 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-300">
              <Keyboard size={14} className="text-emerald-400" />
              <span>Controlos de Teclado</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
              <div className="p-2 bg-slate-900/60 rounded">
                <span className="font-bold text-red-400 block mb-1">Jogador 1:</span>
                <span>Mover: W, A, S, D</span>
                <br />
                <span>Chutar: Barra de Espaço ou X</span>
              </div>
              <div className="p-2 bg-slate-900/60 rounded">
                <span className="font-bold text-blue-400 block mb-1">Jogador 2 (Local):</span>
                <span>Mover: Setas Teclado</span>
                <br />
                <span>Chutar: Enter ou Shift / M</span>
              </div>
            </div>
          </div>

          {/* Sound Toggle */}
          <div className="flex items-center justify-between p-2.5 bg-slate-800/30 rounded-lg border border-slate-800 text-xs">
            <span className="text-slate-300 font-medium">Efeitos Sonoros do Jogo</span>
            <button
              type="button"
              onClick={onToggleMute}
              className={`px-3 py-1 font-semibold rounded text-xs transition-colors cursor-pointer ${
                isMuted ? 'bg-slate-700 text-slate-400' : 'bg-emerald-600 text-white'
              }`}
            >
              {isMuted ? 'Silenciado' : 'Ativado'}
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer"
            >
              Guardar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
