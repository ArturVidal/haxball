import React, { useState, useRef, useEffect } from 'react';
import {
  Maximize2,
  Trash2,
  Plus,
  Play,
  RotateCcw,
  Sparkles,
  Layers,
  Save,
  ArrowLeft,
  Circle,
  Minus,
  Sliders,
  Check,
} from 'lucide-react';
import { ObstaclePillar, Segment, Stadium, Vector2D } from '../types/game';
import { buildStadiumGeometry } from '../physics/engine';

interface StadiumEditorProps {
  initialStadium?: Stadium;
  onSaveStadium: (stadium: Stadium) => void;
  onCancel: () => void;
}

type EditTool = 'select' | 'wall' | 'pillar';

export const StadiumEditor: React.FC<StadiumEditorProps> = ({
  initialStadium,
  onSaveStadium,
  onCancel,
}) => {
  // Stadium parameters
  const [name, setName] = useState<string>(
    initialStadium?.isCustom ? initialStadium.name : 'Meu Estádio Personalizado'
  );
  const [description, setDescription] = useState<string>(
    initialStadium?.description || 'Estádio personalizado com dimensões e obstáculos à medida.'
  );

  const [width, setWidth] = useState<number>(initialStadium?.width || 840);
  const [height, setHeight] = useState<number>(initialStadium?.height || 400);
  const [goalWidth, setGoalWidth] = useState<number>(initialStadium?.goalWidth || 140);
  const [goalDepth, setGoalDepth] = useState<number>(initialStadium?.goalDepth || 60);
  const [goalOffsetY, setGoalOffsetY] = useState<number>(initialStadium?.goalOffsetY || 0);

  // Pitch surface theme
  const [surfaceTheme, setSurfaceTheme] = useState<'classic' | 'futsal' | 'ice' | 'cyber'>('classic');

  // Obstacles state
  const [obstacles, setObstacles] = useState<Segment[]>(initialStadium?.obstacles || []);
  const [pillars, setPillars] = useState<ObstaclePillar[]>(initialStadium?.pillars || []);

  // Active Tool state
  const [activeTool, setActiveTool] = useState<EditTool>('wall');
  const [pillarRadius, setPillarRadius] = useState<number>(14);

  // Drawing state for walls
  const [wallStartPoint, setWallStartPoint] = useState<Vector2D | null>(null);
  const [cursorPos, setCursorPos] = useState<Vector2D | null>(null);

  // Canvas Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Determine colors based on surface theme
  const getThemeColors = () => {
    switch (surfaceTheme) {
      case 'futsal':
        return {
          pitchColor: '#1e293b',
          pitchBorderColor: '#0f172a',
          linesColor: 'rgba(245, 158, 11, 0.75)',
          ballFriction: 0.988,
          playerFriction: 0.958,
        };
      case 'ice':
        return {
          pitchColor: '#0f172a',
          pitchBorderColor: '#090d16',
          linesColor: 'rgba(56, 189, 248, 0.75)',
          ballFriction: 0.996,
          playerFriction: 0.978,
        };
      case 'cyber':
        return {
          pitchColor: '#1a0b1e',
          pitchBorderColor: '#0b040e',
          linesColor: 'rgba(236, 72, 153, 0.75)',
          ballFriction: 0.992,
          playerFriction: 0.965,
        };
      case 'classic':
      default:
        return {
          pitchColor: '#1d4324',
          pitchBorderColor: '#14311b',
          linesColor: 'rgba(255, 255, 255, 0.75)',
          ballFriction: 0.99,
          playerFriction: 0.96,
        };
    }
  };

  const themeColors = getThemeColors();

  // Create temporary Stadium object for preview & geometry calculation
  const currentStadium: Stadium = {
    id: initialStadium?.id?.startsWith('custom-') ? initialStadium.id : `custom-${Date.now()}`,
    name,
    description,
    width,
    height,
    goalWidth,
    goalDepth,
    goalOffsetY,
    centerRadius: Math.min(width * 0.1, 85),
    ...themeColors,
    spawnPoints: {
      red: [
        { x: width * 0.3, y: height * 0.5 },
        { x: width * 0.4, y: height * 0.32 },
        { x: width * 0.4, y: height * 0.68 },
      ],
      blue: [
        { x: width * 0.7, y: height * 0.5 },
        { x: width * 0.6, y: height * 0.32 },
        { x: width * 0.6, y: height * 0.68 },
      ],
    },
    obstacles,
    pillars,
    isCustom: true,
  };

  // Convert client click coordinates to Stadium canvas space
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>): Vector2D | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    };
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    if (!coords) return;

    if (activeTool === 'wall') {
      if (!wallStartPoint) {
        setWallStartPoint(coords);
      } else {
        // Finish wall segment
        const dist = Math.hypot(coords.x - wallStartPoint.x, coords.y - wallStartPoint.y);
        if (dist > 15) {
          const newSeg: Segment = {
            p0: { x: wallStartPoint.x, y: wallStartPoint.y },
            p1: { x: coords.x, y: coords.y },
            bounciness: 0.7,
            color: '#38bdf8',
          };
          setObstacles((prev) => [...prev, newSeg]);
        }
        setWallStartPoint(null);
      }
    } else if (activeTool === 'pillar') {
      const newPillar: ObstaclePillar = {
        id: `pillar-${Date.now()}`,
        x: coords.x,
        y: coords.y,
        radius: pillarRadius,
        bounciness: 0.8,
        color: '#f59e0b',
      };
      setPillars((prev) => [...prev, newPillar]);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    setCursorPos(coords);
  };

  // Preset templates
  const applyPreset = (type: 'center_wall' | 'pillars_mid' | 'defense_funnel' | 'clear') => {
    if (type === 'clear') {
      setObstacles([]);
      setPillars([]);
      return;
    }

    const midX = width / 2;
    const midY = height / 2;

    if (type === 'center_wall') {
      // Split wall with center gap
      const topWall: Segment = {
        p0: { x: midX, y: 70 },
        p1: { x: midX, y: midY - 60 },
        bounciness: 0.7,
        color: '#38bdf8',
      };
      const bottomWall: Segment = {
        p0: { x: midX, y: midY + 60 },
        p1: { x: midX, y: height - 70 },
        bounciness: 0.7,
        color: '#38bdf8',
      };
      setObstacles([topWall, bottomWall]);
    } else if (type === 'pillars_mid') {
      // 3 pillars along center circle
      const p1: ObstaclePillar = {
        id: 'p1',
        x: midX,
        y: midY - 70,
        radius: 16,
        bounciness: 0.85,
        color: '#f59e0b',
      };
      const p2: ObstaclePillar = {
        id: 'p2',
        x: midX,
        y: midY,
        radius: 18,
        bounciness: 0.85,
        color: '#f59e0b',
      };
      const p3: ObstaclePillar = {
        id: 'p3',
        x: midX,
        y: midY + 70,
        radius: 16,
        bounciness: 0.85,
        color: '#f59e0b',
      };
      setPillars([p1, p2, p3]);
    } else if (type === 'defense_funnel') {
      // Goal defense bumpers
      const leftTop: Segment = {
        p0: { x: 140, y: midY - 80 },
        p1: { x: 90, y: midY - 50 },
        bounciness: 0.65,
        color: '#ef4444',
      };
      const leftBot: Segment = {
        p0: { x: 140, y: midY + 80 },
        p1: { x: 90, y: midY + 50 },
        bounciness: 0.65,
        color: '#ef4444',
      };
      const rightTop: Segment = {
        p0: { x: width - 140, y: midY - 80 },
        p1: { x: width - 90, y: midY - 50 },
        bounciness: 0.65,
        color: '#3b82f6',
      };
      const rightBot: Segment = {
        p0: { x: width - 140, y: midY + 80 },
        p1: { x: width - 90, y: midY + 50 },
        bounciness: 0.65,
        color: '#3b82f6',
      };
      setObstacles([leftTop, leftBot, rightTop, rightBot]);
    }
  };

  // Render Preview on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    const geo = buildStadiumGeometry(currentStadium);

    // 1. Arena Border
    ctx.fillStyle = currentStadium.pitchBorderColor;
    ctx.fillRect(0, 0, width, height);

    // 2. Pitch Surface
    ctx.fillStyle = currentStadium.pitchColor;
    ctx.fillRect(geo.pitchLeft, geo.pitchTop, geo.pitchRight - geo.pitchLeft, geo.pitchBottom - geo.pitchTop);

    // Grid dots to assist placement
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (let x = geo.pitchLeft + 30; x < geo.pitchRight; x += 30) {
      for (let y = geo.pitchTop + 30; y < geo.pitchBottom; y += 30) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. Markings
    ctx.strokeStyle = currentStadium.linesColor;
    ctx.lineWidth = 2.5;

    // Outer Pitch
    ctx.strokeRect(geo.pitchLeft, geo.pitchTop, geo.pitchRight - geo.pitchLeft, geo.pitchBottom - geo.pitchTop);

    // Midfield Line & Center Circle
    const midX = width / 2;
    const midY = height / 2;
    ctx.beginPath();
    ctx.moveTo(midX, geo.pitchTop);
    ctx.lineTo(midX, geo.pitchBottom);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(midX, midY, currentStadium.centerRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = currentStadium.linesColor;
    ctx.beginPath();
    ctx.arc(midX, midY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Goal Boxes
    const boxHeight = goalWidth + 40;
    const boxDepth = 70;
    const boxCenterY = height / 2 + goalOffsetY;
    const boxTop = boxCenterY - boxHeight / 2;

    ctx.strokeRect(geo.pitchLeft, boxTop, boxDepth, boxHeight);
    ctx.strokeRect(geo.pitchRight - boxDepth, boxTop, boxDepth, boxHeight);

    // Goal Nets
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(geo.pitchLeft - goalDepth, geo.goalTop, goalDepth, goalWidth);
    ctx.fillRect(geo.pitchRight, geo.goalTop, goalDepth, goalWidth);

    // Goal Opening clear
    ctx.fillStyle = currentStadium.pitchColor;
    ctx.fillRect(geo.pitchLeft - 2, geo.goalTop + 1, 4, goalWidth - 2);
    ctx.fillRect(geo.pitchRight - 2, geo.goalTop + 1, 4, goalWidth - 2);

    // Goal Posts
    for (const post of geo.goalPosts) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(post.x + 2, post.y + 3, post.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = post.color;
      ctx.beginPath();
      ctx.arc(post.x, post.y, post.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 4. Custom Obstacle Walls
    if (obstacles.length > 0) {
      for (const obs of obstacles) {
        // Shadow
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(obs.p0.x + 2, obs.p0.y + 3);
        ctx.lineTo(obs.p1.x + 2, obs.p1.y + 3);
        ctx.stroke();

        // Wall Body
        ctx.strokeStyle = obs.color || '#38bdf8';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(obs.p0.x, obs.p0.y);
        ctx.lineTo(obs.p1.x, obs.p1.y);
        ctx.stroke();

        // Core line
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(obs.p0.x, obs.p0.y);
        ctx.lineTo(obs.p1.x, obs.p1.y);
        ctx.stroke();
      }
    }

    // 5. Active Wall in Progress
    if (wallStartPoint && cursorPos) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
      ctx.lineWidth = 4;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(wallStartPoint.x, wallStartPoint.y);
      ctx.lineTo(cursorPos.x, cursorPos.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(wallStartPoint.x, wallStartPoint.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Pillar placement preview
    if (activeTool === 'pillar' && cursorPos) {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
      ctx.beginPath();
      ctx.arc(cursorPos.x, cursorPos.y, pillarRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 7. Spawn Points Indicators
    currentStadium.spawnPoints.red.forEach((sp, i) => {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.5)';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`R${i + 1}`, sp.x, sp.y);
    });

    currentStadium.spawnPoints.blue.forEach((sp, i) => {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.5)';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`B${i + 1}`, sp.x, sp.y);
    });
  }, [
    width,
    height,
    goalWidth,
    goalDepth,
    goalOffsetY,
    surfaceTheme,
    obstacles,
    pillars,
    wallStartPoint,
    cursorPos,
    activeTool,
    pillarRadius,
  ]);

  const handleSave = () => {
    onSaveStadium(currentStadium);
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-5 p-4 md:p-6 text-slate-100">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Voltar"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex flex-col">
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Sliders size={20} className="text-emerald-400" />
              <span>Editor de Estádios</span>
            </h1>
            <p className="text-xs text-slate-400">
              Personaliza dimensões do campo, posição e tamanho das balizas e adiciona paredes internas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2 text-xs font-black text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-md transition-transform active:scale-95 cursor-pointer"
          >
            <Save size={15} />
            <span>Guardar & Usar</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Controls Sidebar + Live Canvas Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Controls Column (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Basic Info */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-300">Nome do Estádio</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-slate-800 text-white text-xs rounded-lg p-2.5 border border-slate-700 focus:outline-none focus:border-emerald-500"
                placeholder="Ex: Arena Labirinto 1v1"
              />
            </div>

            {/* Surface Theme */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Tema do Piso</label>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => setSurfaceTheme('classic')}
                  className={`py-1.5 px-2 text-[11px] font-semibold rounded-lg border transition-colors cursor-pointer ${
                    surfaceTheme === 'classic'
                      ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  Relva
                </button>
                <button
                  type="button"
                  onClick={() => setSurfaceTheme('futsal')}
                  className={`py-1.5 px-2 text-[11px] font-semibold rounded-lg border transition-colors cursor-pointer ${
                    surfaceTheme === 'futsal'
                      ? 'bg-slate-800 border-amber-500 text-amber-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  Futsal
                </button>
                <button
                  type="button"
                  onClick={() => setSurfaceTheme('ice')}
                  className={`py-1.5 px-2 text-[11px] font-semibold rounded-lg border transition-colors cursor-pointer ${
                    surfaceTheme === 'ice'
                      ? 'bg-sky-950 border-sky-500 text-sky-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  Gelo
                </button>
                <button
                  type="button"
                  onClick={() => setSurfaceTheme('cyber')}
                  className={`py-1.5 px-2 text-[11px] font-semibold rounded-lg border transition-colors cursor-pointer ${
                    surfaceTheme === 'cyber'
                      ? 'bg-pink-950 border-pink-500 text-pink-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  Cyber
                </button>
              </div>
            </div>
          </div>

          {/* Dimension Sliders */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col gap-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Tamanho do Campo & Balizas
            </h3>

            {/* Pitch Width */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">Largura do Campo</span>
                <span className="font-mono text-emerald-400 font-semibold">{width} px</span>
              </div>
              <input
                type="range"
                min={640}
                max={1100}
                step={20}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Pitch Height */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">Altura do Campo</span>
                <span className="font-mono text-emerald-400 font-semibold">{height} px</span>
              </div>
              <input
                type="range"
                min={340}
                max={520}
                step={10}
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Goal Opening Width */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">Abertura da Baliza</span>
                <span className="font-mono text-emerald-400 font-semibold">{goalWidth} px</span>
              </div>
              <input
                type="range"
                min={80}
                max={220}
                step={10}
                value={goalWidth}
                onChange={(e) => setGoalWidth(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Goal Depth */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">Profundidade da Baliza</span>
                <span className="font-mono text-emerald-400 font-semibold">{goalDepth} px</span>
              </div>
              <input
                type="range"
                min={40}
                max={90}
                step={5}
                value={goalDepth}
                onChange={(e) => setGoalDepth(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Goal Vertical Offset (Height position) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">Posição Vertical das Balizas</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  {goalOffsetY === 0 ? 'Centro' : `${goalOffsetY > 0 ? '+' : ''}${goalOffsetY} px`}
                </span>
              </div>
              <input
                type="range"
                min={-70}
                max={70}
                step={5}
                value={goalOffsetY}
                onChange={(e) => setGoalOffsetY(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Obstacle Tools & Presets */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col gap-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Obstáculos Internos
            </h3>

            {/* Tool Selection */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTool('wall');
                  setWallStartPoint(null);
                }}
                className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                  activeTool === 'wall'
                    ? 'bg-sky-500/20 border-sky-500 text-sky-300 shadow-sm'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <Minus size={15} />
                <span>Desenhar Parede</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTool('pillar');
                  setWallStartPoint(null);
                }}
                className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                  activeTool === 'pillar'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <Circle size={15} />
                <span>Colocar Pilar</span>
              </button>
            </div>

            {activeTool === 'wall' && (
              <p className="text-[11px] text-sky-400 bg-sky-950/40 p-2 rounded border border-sky-900/40">
                {wallStartPoint
                  ? 'Clica no segundo ponto para finalizar a parede.'
                  : 'Clica no campo para definir o início da parede interna.'}
              </p>
            )}

            {activeTool === 'pillar' && (
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-300">Raio do Pilar:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={10}
                    max={25}
                    value={pillarRadius}
                    onChange={(e) => setPillarRadius(Number(e.target.value))}
                    className="w-24 accent-amber-500 cursor-pointer"
                  />
                  <span className="font-mono text-amber-400 font-bold">{pillarRadius}px</span>
                </div>
              </div>
            )}

            {/* Quick Presets */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400">Modelos Rápidos:</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => applyPreset('center_wall')}
                  className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer text-left"
                >
                  Barreira Central
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('pillars_mid')}
                  className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer text-left"
                >
                  Pilares Centro
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('defense_funnel')}
                  className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer text-left"
                >
                  Afunilamento
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('clear')}
                  className="px-2.5 py-1.5 text-[11px] font-semibold text-rose-400 hover:text-rose-300 bg-rose-950/30 hover:bg-rose-950/60 rounded-lg transition-colors cursor-pointer text-left"
                >
                  Limpar Todos
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Live Canvas Preview Column (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Maximize2 size={16} className="text-emerald-400" />
                <span className="text-xs font-bold text-slate-200">
                  Pré-visualização do Estádio em Tempo Real
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                <span>{obstacles.length} paredes</span>
                <span>·</span>
                <span>{pillars.length} pilares</span>
              </div>
            </div>

            {/* Interactive Canvas */}
            <div className="relative w-full flex justify-center items-center overflow-hidden rounded-xl border border-slate-800 bg-slate-950 select-none">
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                onMouseMove={handleCanvasMouseMove}
                className="cursor-crosshair w-full block"
                style={{
                  aspectRatio: `${width} / ${height}`,
                  maxWidth: '100%',
                }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>Clica no campo para desenhar ou adicionar obstáculos.</span>
              {cursorPos && (
                <span className="font-mono">
                  X: {cursorPos.x} · Y: {cursorPos.y}
                </span>
              )}
            </div>
          </div>

          {/* Obstacles List Box */}
          {(obstacles.length > 0 || pillars.length > 0) && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300">Elementos no Campo</h4>
                <button
                  type="button"
                  onClick={() => {
                    setObstacles([]);
                    setPillars([]);
                  }}
                  className="text-xs font-semibold text-rose-400 hover:text-rose-300 cursor-pointer"
                >
                  Remover Todos
                </button>
              </div>

              <div className="max-h-40 overflow-y-auto flex flex-col gap-1.5">
                {obstacles.map((obs, idx) => (
                  <div
                    key={`wall-${idx}`}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-800/60 border border-slate-700/40 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                      <span className="font-medium text-slate-200">Parede {idx + 1}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({obs.p0.x}, {obs.p0.y}) → ({obs.p1.x}, {obs.p1.y})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setObstacles((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-rose-400 p-1 cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}

                {pillars.map((pil, idx) => (
                  <div
                    key={pil.id || `pil-${idx}`}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-800/60 border border-slate-700/40 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <span className="font-medium text-slate-200">Pilar {idx + 1}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({pil.x}, {pil.y}) · Raio: {pil.radius}px
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPillars((prev) => prev.filter((p) => p.id !== pil.id))}
                      className="text-slate-400 hover:text-rose-400 p-1 cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
