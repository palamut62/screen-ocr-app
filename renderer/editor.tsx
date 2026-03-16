import React, { useRef, useState, useEffect } from 'react';
import type { Lang, TranslationKey } from './i18n';

interface Props {
  imageBase64: string;
  onClose: () => void;
  lang: Lang;
  T: (key: TranslationKey) => string;
}

type Tool = 'draw' | 'text' | 'arrow' | 'rect' | 'eraser' | 'line';

export default function Editor({ imageBase64, onClose, lang, T }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [tool, setTool] = useState<Tool>('draw');
  const [color, setColor] = useState('#ff0000');
  const [lineWidth, setLineWidth] = useState(3);
  const [fontSize, setFontSize] = useState(16);
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [textBg, setTextBg] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [textInput, setTextInput] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState('');
  const [history, setHistory] = useState<ImageData[]>([]);
  const [saved, setSaved] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const scaleRef = useRef(1);
  const drawRetryRef = useRef<number>(0);

  useEffect(() => {
    return () => { window.electronAPI?.resizeWindow?.(400, 500); };
  }, []);

  useEffect(() => {
    if (!imageBase64) return;
    const img = new Image();
    img.onerror = () => console.error('[EDITOR] Image load FAILED');
    img.onload = async () => {
      imgRef.current = img;
      const chrome = 120;
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
      setTimeout(() => drawImageToCanvas(img, canvasW, canvasH), 150);
    };
    img.src = `data:image/png;base64,${imageBase64}`;
  }, [imageBase64]);

  function drawImageToCanvas(img: HTMLImageElement, w: number, h: number) {
    const canvas = canvasRef.current;
    const overlay = overlayCanvasRef.current;
    if (!canvas || !overlay) {
      drawRetryRef.current++;
      if (drawRetryRef.current < 60) requestAnimationFrame(() => drawImageToCanvas(img, w, h));
      return;
    }
    canvas.width = w; canvas.height = h;
    overlay.width = w; overlay.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, w, h);
    setImgLoaded(true);
    setHistory([ctx.getImageData(0, 0, w, h)]);
  }

  function saveState() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    setHistory(prev => [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)]);
  }

  function undo() {
    if (history.length <= 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const newHist = history.slice(0, -1);
    ctx.putImageData(newHist[newHist.length - 1], 0, 0);
    setHistory(newHist);
  }

  function getPos(e: React.MouseEvent): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();

    // If there's an active text input, commit it first before doing anything
    if (textInput && textValue.trim()) {
      commitText();
    } else if (textInput) {
      setTextInput(null);
    }

    if (tool === 'text') {
      const pos = getPos(e);
      setTextInput(pos);
      setTextValue('');
      return;
    }
    setIsDrawing(true);
    const pos = getPos(e);
    lastPos.current = pos; startPos.current = pos;
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDrawing) return;
    e.preventDefault(); e.stopPropagation();
    const pos = getPos(e);
    if (tool === 'draw' || tool === 'eraser') {
      const ctx = canvasRef.current!.getContext('2d')!;
      ctx.beginPath();
      ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
      ctx.lineWidth = tool === 'eraser' ? lineWidth * 3 : lineWidth;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
      lastPos.current = pos;
    } else if (tool === 'arrow' || tool === 'rect' || tool === 'line') {
      const overlay = overlayCanvasRef.current!;
      const ctx = overlay.getContext('2d')!;
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.lineCap = 'round';
      if (tool === 'rect') ctx.strokeRect(startPos.current!.x, startPos.current!.y, pos.x - startPos.current!.x, pos.y - startPos.current!.y);
      else if (tool === 'arrow') drawArrow(ctx, startPos.current!.x, startPos.current!.y, pos.x, pos.y);
      else { ctx.beginPath(); ctx.moveTo(startPos.current!.x, startPos.current!.y); ctx.lineTo(pos.x, pos.y); ctx.stroke(); }
    }
  }

  function handleMouseUp(e: React.MouseEvent) {
    if (!isDrawing) return;
    e.preventDefault(); e.stopPropagation();
    setIsDrawing(false);
    const pos = getPos(e);
    if (tool === 'arrow' || tool === 'rect' || tool === 'line') {
      const ctx = canvasRef.current!.getContext('2d')!;
      const octx = overlayCanvasRef.current!.getContext('2d')!;
      ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.lineCap = 'round';
      if (tool === 'rect') ctx.strokeRect(startPos.current!.x, startPos.current!.y, pos.x - startPos.current!.x, pos.y - startPos.current!.y);
      else if (tool === 'arrow') drawArrow(ctx, startPos.current!.x, startPos.current!.y, pos.x, pos.y);
      else { ctx.beginPath(); ctx.moveTo(startPos.current!.x, startPos.current!.y); ctx.lineTo(pos.x, pos.y); ctx.stroke(); }
      octx.clearRect(0, 0, overlayCanvasRef.current!.width, overlayCanvasRef.current!.height);
    }
    saveState();
  }

  function drawArrow(ctx: CanvasRenderingContext2D, fx: number, fy: number, tx: number, ty: number) {
    const headLen = 14;
    const angle = Math.atan2(ty - fy, tx - fx);
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tx, ty);
    ctx.lineTo(tx - headLen * Math.cos(angle - Math.PI / 6), ty - headLen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - headLen * Math.cos(angle + Math.PI / 6), ty - headLen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
    const rAngle = angle + Math.PI;
    ctx.beginPath(); ctx.moveTo(fx, fy);
    ctx.lineTo(fx - headLen * Math.cos(rAngle - Math.PI / 6), fy - headLen * Math.sin(rAngle - Math.PI / 6));
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx - headLen * Math.cos(rAngle + Math.PI / 6), fy - headLen * Math.sin(rAngle + Math.PI / 6));
    ctx.stroke();
  }

  function getFont() {
    return `${italic ? 'italic' : 'normal'} ${bold ? 'bold' : 'normal'} ${fontSize}px 'Segoe UI', sans-serif`;
  }

  function commitText() {
    if (!textInput || !textValue.trim()) { setTextInput(null); return; }
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const font = getFont();
    ctx.font = font;
    const lineHeight = fontSize * 1.3;
    const lines = textValue.split('\n');

    if (textBg) {
      let maxWidth = 0;
      for (const line of lines) { const w = ctx.measureText(line).width; if (w > maxWidth) maxWidth = w; }
      const pad = 4;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(textInput.x - pad, textInput.y - pad, maxWidth + pad * 2, lines.length * lineHeight + pad * 2);
    }

    ctx.fillStyle = color; ctx.font = font;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], textInput.x, textInput.y + fontSize + i * lineHeight);
    }
    setTextInput(null);
    setTextValue('');
    saveState();
  }

  async function handleCopy() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const base64 = canvas.toDataURL('image/png').split(',')[1];
    await window.electronAPI?.copyImage(base64);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const base64 = canvas.toDataURL('image/png').split(',')[1];
    await window.electronAPI?.saveSnip(base64);
  }

  const colors = ['#ff0000', '#00ff00', '#3b82f6', '#ffff00', '#ff00ff', '#ffffff', '#000000'];

  return (
    <div className="editor-container">
      <div className="editor-titlebar">
        <span className="editor-titlebar-text">{T('editor.title')}</span>
        <div className="editor-titlebar-btns">
          <button className="titlebar-btn" onClick={() => window.electronAPI?.minimizeWindow()}>&#8722;</button>
          <button className="titlebar-btn close" onClick={onClose}>&#10005;</button>
        </div>
      </div>
      <div className="editor-toolbar">
        <button className={`tool-btn ${tool === 'draw' ? 'active' : ''}`} onClick={() => setTool('draw')} title="Draw">&#9998;</button>
        <button className={`tool-btn ${tool === 'arrow' ? 'active' : ''}`} onClick={() => setTool('arrow')} title="Arrow">&#8596;</button>
        <button className={`tool-btn ${tool === 'line' ? 'active' : ''}`} onClick={() => setTool('line')} title="Line">&#9585;</button>
        <button className={`tool-btn ${tool === 'rect' ? 'active' : ''}`} onClick={() => setTool('rect')} title="Rectangle">&#9633;</button>
        <button className={`tool-btn ${tool === 'text' ? 'active' : ''}`} onClick={() => setTool('text')} title="Text">T</button>
        <button className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`} onClick={() => setTool('eraser')} title="Eraser">&#9746;</button>

        <div className="toolbar-sep" />

        <div className="color-picker">
          {colors.map(c => (
            <button key={c} className={`color-swatch ${color === c ? 'active' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />
          ))}
        </div>

        <div className="toolbar-sep" />

        <label className="size-control">
          <span>{lineWidth}px</span>
          <input type="range" min="1" max="10" value={lineWidth} onChange={e => setLineWidth(+e.target.value)} />
        </label>

        {tool === 'text' && (
          <>
            <div className="toolbar-sep" />
            <label className="size-control">
              <span>{fontSize}px</span>
              <input type="range" min="10" max="48" value={fontSize} onChange={e => setFontSize(+e.target.value)} />
            </label>
            <button className={`tool-btn text-fmt ${bold ? 'active' : ''}`} onClick={() => setBold(!bold)} title="Bold"><b>B</b></button>
            <button className={`tool-btn text-fmt ${italic ? 'active' : ''}`} onClick={() => setItalic(!italic)} title="Italic"><i>I</i></button>
            <button className={`tool-btn text-fmt ${textBg ? 'active' : ''}`} onClick={() => setTextBg(!textBg)} title="Background">BG</button>
            <span className="text-apply-hint">Ctrl+Enter</span>
          </>
        )}

        <div className="toolbar-sep" />
        <button className="tool-btn" onClick={undo} title="Undo">&#8617;</button>
      </div>

      <div className="editor-canvas-wrapper" ref={containerRef}>
        <div className="canvas-stack" style={{ width: canvasRef.current?.width, height: canvasRef.current?.height, display: imgLoaded ? 'block' : 'none' }}>
          <canvas
            ref={canvasRef}
            className="editor-canvas"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => { if (isDrawing) { setIsDrawing(false); saveState(); } }}
          />
          <canvas ref={overlayCanvasRef} className="editor-overlay-canvas" />
          {textInput && (
            <textarea
              ref={textareaRef}
              className="canvas-text-input"
              style={{
                left: textInput.x,
                top: textInput.y,
                fontSize,
                color,
                fontWeight: bold ? 'bold' : 'normal',
                fontStyle: italic ? 'italic' : 'normal',
                background: textBg ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)',
              }}
              autoFocus
              value={textValue}
              onChange={e => setTextValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') { setTextInput(null); setTextValue(''); }
                if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); commitText(); }
              }}
              placeholder={T('editor.textPlaceholder')}
            />
          )}
        </div>
      </div>

      <div className="editor-actions">
        <button className="btn primary" onClick={handleCopy}>{saved ? T('editor.copied') : T('editor.copy')}</button>
        <button className="btn secondary" onClick={handleSave}>{T('editor.save')}</button>
        <button className="btn outline" onClick={onClose}>{T('editor.close')}</button>
      </div>
    </div>
  );
}
