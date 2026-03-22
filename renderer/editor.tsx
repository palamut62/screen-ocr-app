import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { Lang, TranslationKey } from './i18n';

interface Props {
  imageBase64: string;
  onClose: () => void;
  lang: Lang;
  T: (key: TranslationKey) => string;
}

// === TYPES ===
type Tool = 'draw' | 'highlighter' | 'fade' | 'laser' | 'arrow' | 'line' | 'rect' | 'oval' | 'text' | 'eraser' | 'select';

interface Point { x: number; y: number; }

interface Figure {
  id: string;
  tool: Tool;
  points: Point[];
  color: string;
  lineWidth: number;
  // Shape-specific
  startPoint?: Point;
  endPoint?: Point;
  // Text-specific
  text?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  textBg?: boolean;
  // Highlighter
  opacity?: number;
  // Fade pen
  fadeStart?: number;
  // Selection state
  selected?: boolean;
  // Bounding box (cached)
  bounds?: { x: number; y: number; w: number; h: number };
}

const COLORS = ['#1D76DC', '#E60000', '#00C853', '#FF6B00', '#9C27B0', '#020202', '#FFFFFF', '#FFD700'];
const WIDTH_PRESETS = [2, 4, 6, 10];

const TOOL_ICONS: Record<Tool, string> = {
  select: '⊹',
  draw: '✎',
  highlighter: '🖌',
  fade: '💨',
  laser: '🔴',
  arrow: '→',
  line: '╱',
  rect: '▢',
  oval: '○',
  text: 'A',
  eraser: '⌧',
};

const TOOL_KEYS: Record<string, Tool> = {
  '1': 'select', '2': 'draw', '3': 'highlighter', '4': 'fade',
  '5': 'laser', '6': 'arrow', '7': 'line', '8': 'rect',
  '9': 'oval', '0': 'text',
};

let figureIdCounter = 0;
function newId(): string { return `fig_${++figureIdCounter}_${Date.now()}`; }

// === SMOOTH FREEHAND ===
// Attempt to smooth points using Catmull-Rom spline interpolation
function smoothPoints(pts: Point[], tension = 0.5): Point[] {
  if (pts.length < 3) return pts;
  const result: Point[] = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[Math.min(pts.length - 1, i + 1)];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let t = 0; t <= 1; t += 0.2) {
      const t2 = t * t;
      const t3 = t2 * t;
      const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t * tension +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 * tension +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3 * tension);
      const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t * tension +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 * tension +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3 * tension);
      result.push({ x, y });
    }
  }
  result.push(pts[pts.length - 1]);
  return result;
}

// === VARIABLE WIDTH (pressure simulation) ===
function getVariableWidth(baseWidth: number, i: number, total: number): number {
  // Taper at start and end
  const pos = i / Math.max(total - 1, 1);
  const taper = Math.sin(pos * Math.PI); // 0 -> 1 -> 0
  return baseWidth * (0.3 + 0.7 * taper);
}

// === RAINBOW ===
function rainbowColor(index: number): string {
  const hue = (index * 3) % 360;
  return `hsl(${hue}, 85%, 55%)`;
}

// === FIGURE BOUNDING BOX ===
function computeBounds(fig: Figure): { x: number; y: number; w: number; h: number } {
  if (fig.startPoint && fig.endPoint) {
    const x = Math.min(fig.startPoint.x, fig.endPoint.x);
    const y = Math.min(fig.startPoint.y, fig.endPoint.y);
    const w = Math.abs(fig.endPoint.x - fig.startPoint.x);
    const h = Math.abs(fig.endPoint.y - fig.startPoint.y);
    return { x, y, w, h };
  }
  if (fig.points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of fig.points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const pad = fig.lineWidth || 4;
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
}

function pointInBounds(p: Point, b: { x: number; y: number; w: number; h: number }): boolean {
  return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
}

// === RENDER FIGURE ===
function renderFigure(ctx: CanvasRenderingContext2D, fig: Figure, rainbow = false) {
  ctx.save();
  const c = fig.color;
  const lw = fig.lineWidth;

  switch (fig.tool) {
    case 'draw': {
      const smooth = smoothPoints(fig.points);
      if (smooth.length < 2) { ctx.restore(); return; }
      // Variable width segments
      for (let i = 1; i < smooth.length; i++) {
        ctx.beginPath();
        ctx.moveTo(smooth[i - 1].x, smooth[i - 1].y);
        ctx.lineTo(smooth[i].x, smooth[i].y);
        ctx.strokeStyle = rainbow ? rainbowColor(i) : c;
        ctx.lineWidth = getVariableWidth(lw, i, smooth.length);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
      break;
    }
    case 'highlighter': {
      if (fig.points.length < 2) { ctx.restore(); return; }
      ctx.globalAlpha = fig.opacity ?? 0.35;
      ctx.beginPath();
      ctx.moveTo(fig.points[0].x, fig.points[0].y);
      for (let i = 1; i < fig.points.length; i++) ctx.lineTo(fig.points[i].x, fig.points[i].y);
      ctx.strokeStyle = c;
      ctx.lineWidth = lw * 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      break;
    }
    case 'fade': {
      // Fade pen: opacity decreases over time
      const elapsed = fig.fadeStart ? (Date.now() - fig.fadeStart) / 1000 : 0;
      const alpha = Math.max(0, 1 - elapsed / 3); // 3 second fade
      if (alpha <= 0) { ctx.restore(); return; }
      ctx.globalAlpha = alpha;
      const smooth = smoothPoints(fig.points);
      if (smooth.length < 2) { ctx.restore(); return; }
      ctx.beginPath();
      ctx.moveTo(smooth[0].x, smooth[0].y);
      for (let i = 1; i < smooth.length; i++) ctx.lineTo(smooth[i].x, smooth[i].y);
      ctx.strokeStyle = c;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      break;
    }
    case 'laser': {
      // Laser: glowing dot trail
      const pts = fig.points;
      if (pts.length < 2) { ctx.restore(); return; }
      // Glow
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 15;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.strokeStyle = '#ff3333';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();
      // Core
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.stroke();
      break;
    }
    case 'arrow': {
      if (!fig.startPoint || !fig.endPoint) { ctx.restore(); return; }
      const { x: fx, y: fy } = fig.startPoint;
      const { x: tx, y: ty } = fig.endPoint;
      const headLen = Math.max(16, lw * 3);
      const angle = Math.atan2(ty - fy, tx - fx);
      // Curved arrow (DrawPen style - slight arc)
      const dx = tx - fx, dy = ty - fy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const cpx = (fx + tx) / 2 - dy * 0.1;
      const cpy = (fy + ty) / 2 + dx * 0.1;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      if (dist > 50) {
        ctx.quadraticCurveTo(cpx, cpy, tx, ty);
      } else {
        ctx.lineTo(tx, ty);
      }
      ctx.strokeStyle = c;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.stroke();
      // Arrowhead
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - headLen * Math.cos(angle - Math.PI / 6), ty - headLen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(tx - headLen * Math.cos(angle + Math.PI / 6), ty - headLen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
      break;
    }
    case 'line': {
      if (!fig.startPoint || !fig.endPoint) { ctx.restore(); return; }
      ctx.beginPath();
      ctx.moveTo(fig.startPoint.x, fig.startPoint.y);
      ctx.lineTo(fig.endPoint.x, fig.endPoint.y);
      ctx.strokeStyle = c;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.stroke();
      break;
    }
    case 'rect': {
      if (!fig.startPoint || !fig.endPoint) { ctx.restore(); return; }
      const rx = fig.startPoint.x, ry = fig.startPoint.y;
      const rw = fig.endPoint.x - rx, rh = fig.endPoint.y - ry;
      ctx.strokeStyle = c;
      ctx.lineWidth = lw;
      ctx.strokeRect(rx, ry, rw, rh);
      break;
    }
    case 'oval': {
      if (!fig.startPoint || !fig.endPoint) { ctx.restore(); return; }
      const cx = (fig.startPoint.x + fig.endPoint.x) / 2;
      const cy = (fig.startPoint.y + fig.endPoint.y) / 2;
      const radx = Math.abs(fig.endPoint.x - fig.startPoint.x) / 2;
      const rady = Math.abs(fig.endPoint.y - fig.startPoint.y) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, radx, rady, 0, 0, Math.PI * 2);
      ctx.strokeStyle = c;
      ctx.lineWidth = lw;
      ctx.stroke();
      break;
    }
    case 'text': {
      if (!fig.text || !fig.startPoint) { ctx.restore(); return; }
      const fs = fig.fontSize || 20;
      const font = `${fig.italic ? 'italic' : 'normal'} ${fig.bold ? 'bold' : 'normal'} ${fs}px 'Inter', 'Segoe UI', sans-serif`;
      ctx.font = font;
      const lineH = fs * 1.3;
      const lines = fig.text.split('\n');
      if (fig.textBg) {
        let maxW = 0;
        for (const line of lines) { const w = ctx.measureText(line).width; if (w > maxW) maxW = w; }
        const pad = 4;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(fig.startPoint.x - pad, fig.startPoint.y - pad, maxW + pad * 2, lines.length * lineH + pad * 2);
      }
      ctx.fillStyle = c;
      ctx.font = font;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], fig.startPoint.x, fig.startPoint.y + fs + i * lineH);
      }
      break;
    }
    case 'eraser': {
      if (fig.points.length < 2) { ctx.restore(); return; }
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.moveTo(fig.points[0].x, fig.points[0].y);
      for (let i = 1; i < fig.points.length; i++) ctx.lineTo(fig.points[i].x, fig.points[i].y);
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = lw * 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      break;
    }
    default: break;
  }
  ctx.restore();

  // Selection handles
  if (fig.selected) {
    const b = fig.bounds || computeBounds(fig);
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#1D76DC';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.setLineDash([]);
    // Corner handles
    const hs = 6;
    const corners = [
      { x: b.x, y: b.y }, { x: b.x + b.w, y: b.y },
      { x: b.x, y: b.y + b.h }, { x: b.x + b.w, y: b.y + b.h },
    ];
    for (const cn of corners) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(cn.x - hs / 2, cn.y - hs / 2, hs, hs);
      ctx.strokeStyle = '#1D76DC';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cn.x - hs / 2, cn.y - hs / 2, hs, hs);
    }
    ctx.restore();
  }
}

// === MAIN COMPONENT ===
export default function Editor({ imageBase64, onClose, lang, T }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [tool, setTool] = useState<Tool>('draw');
  const [color, setColor] = useState('#E60000');
  const [lineWidth, setLineWidth] = useState(4);
  const [fontSize, setFontSize] = useState(20);
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [textBg, setTextBg] = useState(false);
  const [rainbow, setRainbow] = useState(false);

  const [imgLoaded, setImgLoaded] = useState(false);
  const [textInput, setTextInput] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState('');
  const [saved, setSaved] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showColors, setShowColors] = useState(false);

  // Figure-based undo/redo
  const [figures, setFigures] = useState<Figure[]>([]);
  const [undoStack, setUndoStack] = useState<Figure[][]>([]);
  const [redoStack, setRedoStack] = useState<Figure[][]>([]);

  // Drawing state
  const isDrawingRef = useRef(false);
  const currentFigureRef = useRef<Figure | null>(null);
  const lastPosRef = useRef<Point | null>(null);
  const startPosRef = useRef<Point | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const scaleRef = useRef(1);
  const drawRetryRef = useRef(0);
  const animFrameRef = useRef<number>(0);

  // Selection state
  const selectedIdRef = useRef<string | null>(null);
  const dragStartRef = useRef<Point | null>(null);
  const isDraggingRef = useRef(false);
  const resizeHandleRef = useRef<string | null>(null); // 'tl', 'tr', 'bl', 'br'

  const figuresRef = useRef(figures);
  figuresRef.current = figures;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  // === RENDER ALL ===
  const renderAll = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d')!;
    // Draw base image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // Draw all figures
    for (const fig of figuresRef.current) {
      renderFigure(ctx, fig, rainbow);
    }
    // Draw current in-progress figure
    if (currentFigureRef.current) {
      renderFigure(ctx, currentFigureRef.current, rainbow);
    }
  }, [rainbow]);

  // === FADE ANIMATION LOOP ===
  useEffect(() => {
    const hasFade = figures.some(f => f.tool === 'fade');
    if (!hasFade) return;

    let running = true;
    const animate = () => {
      if (!running) return;
      // Remove fully faded
      const now = Date.now();
      const alive = figures.filter(f => {
        if (f.tool !== 'fade') return true;
        const elapsed = f.fadeStart ? (now - f.fadeStart) / 1000 : 0;
        return elapsed < 3;
      });
      if (alive.length !== figures.length) {
        setFigures(alive);
      }
      renderAll();
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => { running = false; cancelAnimationFrame(animFrameRef.current); };
  }, [figures, renderAll]);

  // Re-render when figures change
  useEffect(() => { renderAll(); }, [figures, renderAll]);

  // === IMAGE LOAD ===
  useEffect(() => {
    return () => { window.electronAPI?.resizeWindow?.(400, 500); };
  }, []);

  useEffect(() => {
    if (!imageBase64) return;
    const img = new Image();
    img.onerror = () => console.error('[EDITOR] Image load FAILED');
    img.onload = async () => {
      imgRef.current = img;
      const chrome = 80;
      const screenInfo = await window.electronAPI?.getScreenSize?.();
      const maxScreenW = screenInfo?.width ?? 1920;
      const maxScreenH = screenInfo?.height ?? 1080;
      const maxW = Math.min(maxScreenW - 40, 1800);
      const maxH = Math.min(maxScreenH - 80, 1000);
      const scale = Math.min(maxW / img.width, (maxH - chrome) / img.height, 1);
      scaleRef.current = scale;
      const canvasW = Math.round(img.width * scale);
      const canvasH = Math.round(img.height * scale);
      const winW = Math.max(canvasW + 20, 500);
      const winH = canvasH + chrome;
      await window.electronAPI?.resizeWindow?.(winW, winH);
      drawRetryRef.current = 0;
      setTimeout(() => initCanvas(img, canvasW, canvasH), 150);
    };
    img.src = `data:image/png;base64,${imageBase64}`;
  }, [imageBase64]);

  function initCanvas(img: HTMLImageElement, w: number, h: number) {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) {
      drawRetryRef.current++;
      if (drawRetryRef.current < 60) requestAnimationFrame(() => initCanvas(img, w, h));
      return;
    }
    canvas.width = w; canvas.height = h;
    overlay.width = w; overlay.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, w, h);
    setImgLoaded(true);
  }

  // === UNDO / REDO ===
  function pushUndo() {
    setUndoStack(prev => [...prev, figuresRef.current]);
    setRedoStack([]);
  }

  function undo() {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack(r => [...r, figuresRef.current]);
    setUndoStack(u => u.slice(0, -1));
    setFigures(prev);
    selectedIdRef.current = null;
  }

  function redo() {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(u => [...u, figuresRef.current]);
    setRedoStack(r => r.slice(0, -1));
    setFigures(next);
    selectedIdRef.current = null;
  }

  function clearCanvas() {
    pushUndo();
    setFigures([]);
    selectedIdRef.current = null;
    showToast(T('editor.clear'));
  }

  // === MOUSE POSITION ===
  function getPos(e: React.MouseEvent): Point {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // === SNAP (shift key) ===
  function snapAngle(start: Point, end: Point, snap: boolean): Point {
    if (!snap) return end;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const angle = Math.atan2(dy, dx);
    const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
    const dist = Math.sqrt(dx * dx + dy * dy);
    return { x: start.x + dist * Math.cos(snapped), y: start.y + dist * Math.sin(snapped) };
  }

  // === ASPECT RATIO LOCK (shift for shapes) ===
  function lockAspect(start: Point, end: Point, lock: boolean): Point {
    if (!lock) return end;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    return { x: start.x + size * Math.sign(dx), y: start.y + size * Math.sign(dy) };
  }

  // === MOUSE HANDLERS ===
  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();

    // Commit pending text
    if (textInput && textValue.trim()) { commitText(); }
    else if (textInput) { setTextInput(null); }

    const pos = getPos(e);

    // Text tool
    if (tool === 'text') {
      setTextInput(pos);
      setTextValue('');
      return;
    }

    // Select tool - find figure under cursor
    if (tool === 'select') {
      let found: Figure | null = null;
      for (let i = figuresRef.current.length - 1; i >= 0; i--) {
        const fig = figuresRef.current[i];
        const b = fig.bounds || computeBounds(fig);
        if (pointInBounds(pos, b)) { found = fig; break; }
      }

      if (found) {
        selectedIdRef.current = found.id;
        dragStartRef.current = pos;
        isDraggingRef.current = true;
        // Update selection state
        setFigures(prev => prev.map(f => ({ ...f, selected: f.id === found!.id })));
      } else {
        selectedIdRef.current = null;
        isDraggingRef.current = false;
        setFigures(prev => prev.map(f => ({ ...f, selected: false })));
      }
      return;
    }

    // Start drawing
    isDrawingRef.current = true;
    lastPosRef.current = pos;
    startPosRef.current = pos;

    const newFig: Figure = {
      id: newId(),
      tool,
      points: [pos],
      color: rainbow ? rainbowColor(0) : color,
      lineWidth,
      ...(tool === 'fade' ? { fadeStart: Date.now() } : {}),
    };

    if (['arrow', 'line', 'rect', 'oval'].includes(tool)) {
      newFig.startPoint = pos;
      newFig.endPoint = pos;
    }

    currentFigureRef.current = newFig;
  }

  function handleMouseMove(e: React.MouseEvent) {
    const pos = getPos(e);

    // Dragging selected figure
    if (isDraggingRef.current && dragStartRef.current && selectedIdRef.current) {
      const dx = pos.x - dragStartRef.current.x;
      const dy = pos.y - dragStartRef.current.y;
      dragStartRef.current = pos;

      setFigures(prev => prev.map(f => {
        if (f.id !== selectedIdRef.current) return f;
        const moved = { ...f };
        moved.points = f.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
        if (moved.startPoint) moved.startPoint = { x: moved.startPoint.x + dx, y: moved.startPoint.y + dy };
        if (moved.endPoint) moved.endPoint = { x: moved.endPoint.x + dx, y: moved.endPoint.y + dy };
        moved.bounds = computeBounds(moved);
        return moved;
      }));
      return;
    }

    if (!isDrawingRef.current || !currentFigureRef.current) return;
    e.preventDefault(); e.stopPropagation();

    const fig = currentFigureRef.current;
    const isShape = ['arrow', 'line', 'rect', 'oval'].includes(fig.tool);

    if (isShape) {
      const start = startPosRef.current!;
      let end = pos;
      if (e.shiftKey) {
        if (fig.tool === 'rect' || fig.tool === 'oval') {
          end = lockAspect(start, end, true);
        } else {
          end = snapAngle(start, end, true);
        }
      }
      fig.endPoint = end;
      // Preview on overlay
      const overlay = overlayRef.current;
      if (overlay) {
        const ctx = overlay.getContext('2d')!;
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        renderFigure(ctx, fig, rainbow);
      }
    } else {
      fig.points.push(pos);
      lastPosRef.current = pos;
      renderAll();
    }
  }

  function handleMouseUp(e: React.MouseEvent) {
    // End drag
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      dragStartRef.current = null;
      return;
    }

    if (!isDrawingRef.current || !currentFigureRef.current) return;
    e.preventDefault(); e.stopPropagation();
    isDrawingRef.current = false;

    const fig = currentFigureRef.current;
    const isShape = ['arrow', 'line', 'rect', 'oval'].includes(fig.tool);

    if (isShape) {
      const pos = getPos(e);
      const start = startPosRef.current!;
      let end = pos;
      if (e.shiftKey) {
        if (fig.tool === 'rect' || fig.tool === 'oval') end = lockAspect(start, end, true);
        else end = snapAngle(start, end, true);
      }
      fig.endPoint = end;
      // Clear overlay
      const overlay = overlayRef.current;
      if (overlay) overlay.getContext('2d')!.clearRect(0, 0, overlay.width, overlay.height);
    }

    // Don't save laser strokes permanently
    if (fig.tool === 'laser') {
      currentFigureRef.current = null;
      renderAll();
      return;
    }

    // Compute bounds
    fig.bounds = computeBounds(fig);

    // Eraser: instead of adding figure, remove figures that intersect
    if (fig.tool === 'eraser') {
      pushUndo();
      // Simple eraser: just add it as a figure (composite operation handles it)
      setFigures(prev => [...prev, fig]);
      currentFigureRef.current = null;
      return;
    }

    pushUndo();
    setFigures(prev => [...prev, fig]);
    currentFigureRef.current = null;
  }

  // === TEXT COMMIT ===
  function commitText() {
    if (!textInput || !textValue.trim()) { setTextInput(null); return; }
    pushUndo();
    const fig: Figure = {
      id: newId(),
      tool: 'text',
      points: [],
      color,
      lineWidth,
      startPoint: textInput,
      text: textValue,
      fontSize,
      bold,
      italic,
      textBg,
    };
    fig.bounds = computeBounds(fig);
    setFigures(prev => [...prev, fig]);
    setTextInput(null);
    setTextValue('');
  }

  // === COPY / SAVE ===
  async function handleCopy() {
    renderAll(); // Ensure latest
    const canvas = canvasRef.current; if (!canvas) return;
    const base64 = canvas.toDataURL('image/png').split(',')[1];
    await window.electronAPI?.copyImage(base64);
    setSaved(true); showToast(T('editor.copied'));
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleSave() {
    renderAll();
    const canvas = canvasRef.current; if (!canvas) return;
    const base64 = canvas.toDataURL('image/png').split(',')[1];
    await window.electronAPI?.saveSnip(base64);
    showToast(T('editor.save'));
  }

  // === DELETE SELECTED ===
  function deleteSelected() {
    if (!selectedIdRef.current) return;
    pushUndo();
    setFigures(prev => prev.filter(f => f.id !== selectedIdRef.current));
    selectedIdRef.current = null;
  }

  // === DUPLICATE SELECTED ===
  function duplicateSelected() {
    const sel = figuresRef.current.find(f => f.id === selectedIdRef.current);
    if (!sel) return;
    pushUndo();
    const dup: Figure = {
      ...sel,
      id: newId(),
      selected: true,
      points: sel.points.map(p => ({ x: p.x + 20, y: p.y + 20 })),
      startPoint: sel.startPoint ? { x: sel.startPoint.x + 20, y: sel.startPoint.y + 20 } : undefined,
      endPoint: sel.endPoint ? { x: sel.endPoint.x + 20, y: sel.endPoint.y + 20 } : undefined,
    };
    dup.bounds = computeBounds(dup);
    selectedIdRef.current = dup.id;
    setFigures(prev => [...prev.map(f => ({ ...f, selected: false })), dup]);
  }

  // === KEYBOARD SHORTCUTS ===
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ignore when typing in textarea
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;

      // Undo/Redo
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }

      // Copy selected (Ctrl+C) / Duplicate (Ctrl+D)
      if (e.ctrlKey && e.key === 'd') { e.preventDefault(); duplicateSelected(); return; }

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') { deleteSelected(); return; }

      // Tool hotkeys (1-0)
      if (TOOL_KEYS[e.key]) { setTool(TOOL_KEYS[e.key]); return; }

      // Arrow keys to nudge selected
      if (selectedIdRef.current && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        setFigures(prev => prev.map(f => {
          if (f.id !== selectedIdRef.current) return f;
          const moved = { ...f };
          moved.points = f.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
          if (moved.startPoint) moved.startPoint = { x: moved.startPoint.x + dx, y: moved.startPoint.y + dy };
          if (moved.endPoint) moved.endPoint = { x: moved.endPoint.x + dx, y: moved.endPoint.y + dy };
          moved.bounds = computeBounds(moved);
          return moved;
        }));
        return;
      }

      // Escape to deselect
      if (e.key === 'Escape') {
        selectedIdRef.current = null;
        setFigures(prev => prev.map(f => ({ ...f, selected: false })));
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // === TOOL GROUPS ===
  const drawTools: Tool[] = ['select', 'draw', 'highlighter', 'fade', 'laser'];
  const shapeTools: Tool[] = ['arrow', 'line', 'rect', 'oval'];
  const otherTools: Tool[] = ['text', 'eraser'];

  // Cursor
  const getCursor = () => {
    if (tool === 'select') return 'default';
    if (tool === 'eraser') return 'cell';
    if (tool === 'text') return 'text';
    if (tool === 'laser') return 'crosshair';
    return 'crosshair';
  };

  return (
    <div className="editor-container">
      <div className="editor-titlebar">
        <span className="editor-titlebar-text">{T('editor.title')}</span>
        <div className="editor-titlebar-btns">
          <button className="titlebar-btn" onClick={() => window.electronAPI?.minimizeWindow()}>&#8722;</button>
          <button className="titlebar-btn close" onClick={onClose}>&#10005;</button>
        </div>
      </div>

      <div className="editor-canvas-wrapper dp-canvas-wrapper" ref={containerRef}>
        <div className="canvas-stack" style={{ width: canvasRef.current?.width, height: canvasRef.current?.height, display: imgLoaded ? 'block' : 'none' }}>
          <canvas
            ref={canvasRef}
            className="editor-canvas"
            style={{ cursor: getCursor() }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              if (isDrawingRef.current) {
                isDrawingRef.current = false;
                if (currentFigureRef.current && currentFigureRef.current.tool !== 'laser') {
                  currentFigureRef.current.bounds = computeBounds(currentFigureRef.current);
                  pushUndo();
                  setFigures(prev => [...prev, currentFigureRef.current!]);
                }
                currentFigureRef.current = null;
              }
              if (isDraggingRef.current) {
                isDraggingRef.current = false;
                dragStartRef.current = null;
              }
            }}
          />
          <canvas ref={overlayRef} className="editor-overlay-canvas" />

          {textInput && (
            <textarea
              ref={textareaRef}
              className="canvas-text-input"
              style={{
                left: textInput.x, top: textInput.y, fontSize, color,
                fontWeight: bold ? 'bold' : 'normal', fontStyle: italic ? 'italic' : 'normal',
                background: textBg ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)',
              }}
              autoFocus value={textValue}
              onChange={e => setTextValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') { setTextInput(null); setTextValue(''); }
                if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); commitText(); }
              }}
              placeholder={T('editor.textPlaceholder')}
            />
          )}
        </div>

        {toast && <div className="dp-toast">{toast}</div>}

        {/* Floating Toolbar */}
        <div className={`floating-toolbar ${collapsed ? 'floating-toolbar--mini' : ''}`}>
          <button className="ft-close" onClick={onClose} title={T('editor.close')}>✕</button>

          <button className="ft-active-tool" title={tool}>
            <span className="ft-active-tool__icon">{TOOL_ICONS[tool]}</span>
          </button>

          {!collapsed && (
            <>
              <div className="ft-divider" />

              {/* Draw tools */}
              {drawTools.map(t => (
                <button key={t} className={`ft-btn ${tool === t ? 'ft-btn--active' : ''}`}
                  onClick={() => setTool(t)} title={t}>
                  {TOOL_ICONS[t]}
                </button>
              ))}

              <div className="ft-divider" />

              {/* Shape tools */}
              {shapeTools.map(t => (
                <button key={t} className={`ft-btn ${tool === t ? 'ft-btn--active' : ''}`}
                  onClick={() => setTool(t)} title={t}>
                  {TOOL_ICONS[t]}
                </button>
              ))}

              <div className="ft-divider" />

              {/* Other tools */}
              {otherTools.map(t => (
                <button key={t} className={`ft-btn ${tool === t ? 'ft-btn--active' : ''}`}
                  onClick={() => setTool(t)} title={t}>
                  {TOOL_ICONS[t]}
                </button>
              ))}

              <div className="ft-divider" />

              {/* Color */}
              <button className="ft-color-current" style={{ background: rainbow ? 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' : color }}
                onClick={() => setShowColors(!showColors)} title="Color" />

              {/* Rainbow toggle */}
              <button className={`ft-btn ${rainbow ? 'ft-btn--active ft-btn--rainbow' : ''}`}
                onClick={() => setRainbow(!rainbow)} title="Rainbow">
                🌈
              </button>

              <div className="ft-divider" />

              {/* Width dots */}
              {WIDTH_PRESETS.map(w => (
                <button key={w} className={`ft-width ${lineWidth === w ? 'ft-width--active' : ''}`}
                  onClick={() => setLineWidth(w)}>
                  <span className="ft-width__dot" style={{ width: w + 2, height: w + 2 }} />
                </button>
              ))}

              <div className="ft-divider" />

              {/* Undo / Redo / Clear */}
              <button className="ft-btn" onClick={undo} disabled={undoStack.length === 0} title={T('editor.undo')}>↩</button>
              <button className="ft-btn" onClick={redo} disabled={redoStack.length === 0} title={T('editor.redo')}>↪</button>
              <button className="ft-btn ft-btn--danger" onClick={clearCanvas} title={T('editor.clear')}>🗑</button>

              <div className="ft-divider" />

              {/* Copy / Save */}
              <button className="ft-btn" onClick={handleCopy} title={T('editor.copy')}>{saved ? '✓' : '📋'}</button>
              <button className="ft-btn" onClick={handleSave} title={T('editor.save')}>💾</button>
            </>
          )}

          <button className="ft-btn ft-collapse" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        {/* Color picker popup */}
        {showColors && !collapsed && (
          <div className="ft-color-popup">
            {COLORS.map(c => (
              <button key={c}
                className={`ft-color-swatch ${color === c ? 'ft-color-swatch--active' : ''}`}
                style={{ background: c }}
                onClick={() => { setColor(c); setRainbow(false); setShowColors(false); }}
              />
            ))}
          </div>
        )}

        {/* Text formatting popup */}
        {tool === 'text' && !collapsed && (
          <div className="ft-text-popup">
            <label className="ft-text-size">
              <span>{fontSize}px</span>
              <input type="range" min="12" max="56" value={fontSize} onChange={e => setFontSize(+e.target.value)} />
            </label>
            <button className={`ft-fmt ${bold ? 'ft-fmt--active' : ''}`} onClick={() => setBold(!bold)}><b>B</b></button>
            <button className={`ft-fmt ${italic ? 'ft-fmt--active' : ''}`} onClick={() => setItalic(!italic)}><i>I</i></button>
            <button className={`ft-fmt ${textBg ? 'ft-fmt--active' : ''}`} onClick={() => setTextBg(!textBg)}>BG</button>
          </div>
        )}
      </div>
    </div>
  );
}
