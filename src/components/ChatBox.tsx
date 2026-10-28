import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { ChatMessage } from '../types/game';

interface ChatBoxProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
}

const QUICK_CHATS = [
  'Belo golo! ⚽',
  'Boa jogada! 🔥',
  'Defesa incrível! 🧤',
  'Passa a bola! 🎯',
  'GG! 🤝',
  'Desculpa! 😅',
];

export const ChatBox: React.FC<ChatBoxProps> = ({ messages, onSendMessage }) => {
  const [inputText, setInputText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      {/* Header bar / Toggle */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-slate-800/60 border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <MessageSquare size={14} className="text-emerald-400" />
          <span>Chat da Partida</span>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto py-0.5">
          {QUICK_CHATS.map((q) => (
            <button
              key={q}
              onClick={() => onSendMessage(q)}
              className="text-[11px] font-medium px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors whitespace-nowrap cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Messages stream */}
      <div className="p-3 h-28 overflow-y-auto flex flex-col gap-1.5 text-xs font-sans">
        {messages.map((msg) => {
          if (msg.team === 'system') {
            return (
              <div key={msg.id} className="text-emerald-400 font-semibold italic text-[11px]">
                [Sistema] {msg.text}
              </div>
            );
          }

          const isRed = msg.team === 'red';
          const nameColor = isRed ? 'text-red-400' : 'text-blue-400';

          return (
            <div key={msg.id} className="flex items-baseline gap-1.5 leading-snug">
              <span className="text-[10px] text-slate-500 font-mono">{msg.timestamp}</span>
              <span className={`font-bold ${nameColor}`}>{msg.sender}:</span>
              <span className="text-slate-200">{msg.text}</span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 p-2 bg-slate-950/60 border-t border-slate-800">
        <input
          type="text"
          placeholder="Escreve uma mensagem e pressiona Enter..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="flex-1 bg-slate-800/80 text-white placeholder-slate-400 text-xs rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          className="p-2 text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
};
