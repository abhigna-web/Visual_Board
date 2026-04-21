
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  useFirestore, 
  useUser, 
  useDoc, 
  useCollection,
  useMemoFirebase,
  updateDocumentNonBlocking,
  addDocumentNonBlocking
} from "@/firebase";
import { doc, collection, query, orderBy, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, 
  Eraser, 
  Pencil, 
  Download, 
  Loader2,
  Highlighter,
  Square,
  Circle as CircleIcon,
  Diamond,
  Type,
  StickyNote,
  MessageSquare,
  Save,
  Plus,
  Minus as MinusIcon,
  Moon,
  Sun,
  Send,
  Triangle,
  MoveRight,
  UserPlus,
  MousePointer2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Point {
  x: number;
  y: number;
}

type ToolType = "select" | "pencil" | "highlighter" | "eraser" | "rect" | "circle" | "diamond" | "triangle" | "arrow" | "text" | "note";

interface Stroke {
  type: ToolType;
  points: Point[];
  color: string;
  fillColor?: string;
  width: number;
  opacity: number;
  text?: string;
  id: string;
  fontFamily?: string;
  fontSize?: number;
}

interface BoardData {
  id: string;
  name: string;
  strokes?: Stroke[];
  ownerId: string;
}

interface ChatMessage {
  id: string;
  text: string;
  userId: string;
  userName: string;
  createdAt: any;
}

export default function CanvasPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Tool State
  const [tool, setTool] = useState<ToolType>("pencil");
  const [color, setColor] = useState("#8b5cf6");
  const [fillColor, setFillColor] = useState("transparent");
  const [width, setWidth] = useState(4);
  const [opacity, setOpacity] = useState(100);
  const [zoom, setZoom] = useState(100);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [fontFamily, setFontFamily] = useState("Inter");
  const [fontSize, setFontSize] = useState(20);
  
  // Inline Text/Note State
  const [textInput, setTextInput] = useState<{ x: number, y: number, w?: number, h?: number, value: string, isNote: boolean } | null>(null);

  // Local drawing state
  const isDrawing = useRef(false);
  const currentStroke = useRef<Stroke | null>(null);
  const localStrokes = useRef<Stroke[]>([]);

  const boardRef = useMemoFirebase(() => {
    if (!db || !id) return null;
    return doc(db, "boards", id as string);
  }, [db, id]);

  const { data: board, isLoading: boardLoading } = useDoc<BoardData>(boardRef);

  const messagesQuery = useMemoFirebase(() => {
    if (!db || !id) return null;
    return query(collection(db, "boards", id as string, "messages"), orderBy("createdAt", "asc"));
  }, [db, id]);

  const { data: messages } = useCollection<ChatMessage>(messagesQuery);

  const handleResize = useCallback(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    redraw();
  }, [zoom, isDarkMode]);

  useEffect(() => {
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, [handleResize]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scale = zoom / 100;

    localStrokes.current.forEach((stroke) => {
      drawStroke(ctx, stroke, scale);
    });
  }, [isDarkMode, zoom]);

  useEffect(() => {
    if (board?.strokes) {
      localStrokes.current = board.strokes;
      redraw();
    }
  }, [board?.strokes, redraw]);

  const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke, scale: number) => {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    let strokeColor = stroke.color;
    if (isDarkMode && (strokeColor === "#000000" || strokeColor === "#000")) {
      strokeColor = "#ffffff";
    } else if (!isDarkMode && strokeColor === "#ffffff") {
      strokeColor = "#000000";
    }

    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = stroke.fillColor || "transparent";
    ctx.lineWidth = stroke.width * scale;
    
    const finalOpacity = stroke.type === "highlighter" ? (stroke.opacity / 100) * 0.4 : (stroke.opacity / 100);
    ctx.globalAlpha = finalOpacity;

    if (stroke.type === "pencil" || stroke.type === "highlighter") {
      if (!stroke.points || stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x * scale, stroke.points[0].y * scale);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x * scale, stroke.points[i].y * scale);
      }
      ctx.stroke();
    } else if (stroke.type === "rect") {
      const p1 = stroke.points[0];
      const p2 = stroke.points[1];
      if (!p1 || !p2) return;
      const x = Math.min(p1.x, p2.x) * scale;
      const y = Math.min(p1.y, p2.y) * scale;
      const w = Math.abs(p1.x - p2.x) * scale;
      const h = Math.abs(p1.y - p2.y) * scale;
      
      if (stroke.fillColor !== "transparent") {
        ctx.fillStyle = stroke.fillColor!;
        ctx.fillRect(x, y, w, h);
      }
      ctx.strokeRect(x, y, w, h);
    } else if (stroke.type === "note") {
      const p1 = stroke.points[0];
      const p2 = stroke.points[1];
      if (!p1 || !p2) return;
      const x = Math.min(p1.x, p2.x) * scale;
      const y = Math.min(p1.y, p2.y) * scale;
      const w = Math.abs(p1.x - p2.x) * scale;
      const h = Math.abs(p1.y - p2.y) * scale;
      
      const radius = 8 * scale;
      
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      ctx.lineTo(x + radius, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      
      ctx.fillStyle = stroke.fillColor && stroke.fillColor !== "transparent" ? stroke.fillColor : "#bbf7d0";
      ctx.shadowColor = 'rgba(0,0,0,0.1)';
      ctx.shadowBlur = 10 * scale;
      ctx.fill();
      ctx.shadowBlur = 0;
      
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      ctx.lineTo(x + w, y + 25 * scale);
      ctx.lineTo(x, y + 25 * scale);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.clip();
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(x, y, w, 25 * scale);
      ctx.restore();

      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1 * scale;
      ctx.stroke();
      
      if (stroke.text) {
        ctx.font = `${(stroke.fontSize || 16) * scale}px ${stroke.fontFamily || 'Inter'}`;
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.globalAlpha = 1.0;
        const textX = x + 15 * scale;
        const textY = y + 45 * scale;
        const maxWidth = w - 30 * scale;
        
        const words = stroke.text.split(' ');
        let line = '';
        let currentY = textY;
        const lineHeight = (stroke.fontSize || 16) * 1.2 * scale;
        
        for(let i = 0; i < words.length; i++) {
          const testLine = line + words[i] + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && i > 0) {
            ctx.fillText(line, textX, currentY);
            line = words[i] + ' ';
            currentY += lineHeight;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, textX, currentY);
      }
    } else if (stroke.type === "circle") {
      const p1 = stroke.points[0];
      const p2 = stroke.points[1];
      if (!p1 || !p2) return;
      const rx = Math.abs(p1.x - p2.x) * scale;
      const ry = Math.abs(p1.y - p2.y) * scale;
      ctx.beginPath();
      ctx.ellipse(p1.x * scale, p1.y * scale, rx, ry, 0, 0, Math.PI * 2);
      if (stroke.fillColor !== "transparent") ctx.fill();
      ctx.stroke();
    } else if (stroke.type === "diamond") {
      const p1 = stroke.points[0];
      const p2 = stroke.points[1];
      if (!p1 || !p2) return;
      const x = p1.x * scale;
      const y = p1.y * scale;
      const w = (p2.x - p1.x) * scale;
      const h = (p2.y - p1.y) * scale;
      ctx.beginPath();
      ctx.moveTo(x, y - h);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x - w, y);
      ctx.closePath();
      if (stroke.fillColor !== "transparent") ctx.fill();
      ctx.stroke();
    } else if (stroke.type === "triangle") {
      const p1 = stroke.points[0];
      const p2 = stroke.points[1];
      if (!p1 || !p2) return;
      const x = p1.x * scale;
      const y = p1.y * scale;
      const w = (p2.x - p1.x) * scale;
      const h = (p2.y - p1.y) * scale;
      ctx.beginPath();
      ctx.moveTo(x, y - h);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x - w, y + h);
      ctx.closePath();
      if (stroke.fillColor !== "transparent") ctx.fill();
      ctx.stroke();
    } else if (stroke.type === "arrow") {
      const p1 = stroke.points[0];
      const p2 = stroke.points[1];
      if (!p1 || !p2) return;
      const x1 = p1.x * scale;
      const y1 = p1.y * scale;
      const x2 = p2.x * scale;
      const y2 = p2.y * scale;
      
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const headLen = 15 * scale;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    } else if (stroke.type === "text") {
      const p = stroke.points[0];
      if (!p) return;
      ctx.font = `${(stroke.fontSize || 20) * scale}px ${stroke.fontFamily || 'Inter'}`;
      ctx.fillStyle = strokeColor;
      ctx.fillText(stroke.text || "", p.x * scale, p.y * scale);
    }

    ctx.globalAlpha = 1.0;
  };

  const getCoordinates = (e: any): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const scale = zoom / 100;
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale
    };
  };

  const isPointInStroke = (stroke: Stroke, p: Point, threshold: number): boolean => {
    if (stroke.type === 'pencil' || stroke.type === 'highlighter' || stroke.type === 'arrow') {
      return stroke.points.some(point => {
        const dx = point.x - p.x;
        const dy = point.y - p.y;
        return Math.sqrt(dx * dx + dy * dy) < threshold;
      });
    }
    
    if (['rect', 'note', 'text'].includes(stroke.type)) {
      const p1 = stroke.points[0];
      const p2 = stroke.points[1] || p1;
      const xMin = Math.min(p1.x, p2.x) - threshold;
      const xMax = Math.max(p1.x, p2.x) + threshold;
      const yMin = Math.min(p1.y, p2.y) - threshold;
      const yMax = Math.max(p1.y, p2.y) + threshold;
      
      if (stroke.type === 'text') {
        return p.x >= p1.x - threshold && p.x <= p1.x + 150 && p.y >= p1.y - 30 && p.y <= p1.y + 10;
      }
      
      return p.x >= xMin && p.x <= xMax && p.y >= yMin && p.y <= yMax;
    }
    
    if (stroke.type === 'circle') {
      const p1 = stroke.points[0];
      const p2 = stroke.points[1];
      if (!p1 || !p2) return false;
      const rx = Math.abs(p1.x - p2.x);
      const ry = Math.abs(p1.y - p2.y);
      const dx = p.x - p1.x;
      const dy = p.y - p1.y;
      return (dx * dx) / ((rx + threshold) * (rx + threshold) || 1) + 
             (dy * dy) / ((ry + threshold) * (ry + threshold) || 1) <= 1;
    }

    if (stroke.type === 'diamond' || stroke.type === 'triangle') {
      const p1 = stroke.points[0];
      const p2 = stroke.points[1];
      if (!p1 || !p2) return false;
      const dx = Math.abs(p1.x - p2.x);
      const dy = Math.abs(p1.y - p2.y);
      return p.x >= p1.x - dx - threshold && p.x <= p1.x + dx + threshold && 
             p.y >= p1.y - dy - threshold && p.y <= p1.y + dy + threshold;
    }
    
    return false;
  };

  const handleErase = (coords: Point) => {
    const scale = zoom / 100;
    const threshold = 15 / scale;
    
    const initialCount = localStrokes.current.length;
    const newStrokes = localStrokes.current.filter(stroke => !isPointInStroke(stroke, coords, threshold));

    if (newStrokes.length !== initialCount) {
      localStrokes.current = newStrokes;
      if (boardRef) updateDocumentNonBlocking(boardRef, { strokes: newStrokes });
      redraw();
    }
  };

  const startDrawing = (e: any) => {
    const coords = getCoordinates(e);
    if (!coords) return;

    if (tool === "eraser") {
      isDrawing.current = true;
      handleErase(coords);
      return;
    }

    if (tool === "text") {
      setTextInput({ ...coords, value: "", isNote: false });
      return;
    }

    isDrawing.current = true;
    currentStroke.current = {
      id: Math.random().toString(36).substr(2, 9),
      type: tool,
      points: [coords, coords],
      color,
      fillColor: tool === "note" ? (fillColor === "transparent" ? "#bbf7d0" : fillColor) : fillColor,
      width,
      opacity,
      fontFamily,
      fontSize: tool === "note" ? 14 : fontSize
    };
  };

  const draw = (e: any) => {
    const coords = getCoordinates(e);
    if (!coords) return;

    if (isDrawing.current && tool === "eraser") {
      handleErase(coords);
      return;
    }

    if (!isDrawing.current || !currentStroke.current || !canvasRef.current) return;

    if (["pencil", "highlighter"].includes(tool)) {
      currentStroke.current.points.push(coords);
    } else {
      currentStroke.current.points[1] = coords;
    }
    
    redraw();
    const ctx = canvasRef.current.getContext("2d");
    if (ctx) drawStroke(ctx, currentStroke.current, zoom / 100);
  };

  const stopDrawing = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (currentStroke.current) {
      if (currentStroke.current.type === "note") {
        const p1 = currentStroke.current.points[0];
        const p2 = currentStroke.current.points[1];
        const x = Math.min(p1.x, p2.x);
        const y = Math.min(p1.y, p2.y);
        const w = Math.abs(p1.x - p2.x);
        const h = Math.abs(p1.y - p2.y);
        
        setTextInput({ x, y, w, h, value: "", isNote: true });
      } else {
        localStrokes.current.push(currentStroke.current);
        if (boardRef) updateDocumentNonBlocking(boardRef, { strokes: localStrokes.current });
      }
      currentStroke.current = null;
    }
    redraw();
  };

  const commitText = () => {
    if (!textInput || (!textInput.value.trim() && !textInput.isNote) || !boardRef) {
      setTextInput(null);
      return;
    }

    let newStroke: Stroke;
    if (textInput.isNote) {
      newStroke = {
        id: Math.random().toString(36).substr(2, 9),
        type: "note",
        points: [
          { x: textInput.x, y: textInput.y },
          { x: textInput.x + (textInput.w || 150), y: textInput.y + (textInput.h || 150) }
        ],
        color,
        fillColor: fillColor === "transparent" ? "#bbf7d0" : fillColor,
        width,
        opacity,
        text: textInput.value,
        fontFamily,
        fontSize: 14
      };
    } else {
      newStroke = {
        id: Math.random().toString(36).substr(2, 9),
        type: "text",
        points: [{ x: textInput.x, y: textInput.y }],
        color,
        width,
        opacity,
        text: textInput.value,
        fontFamily,
        fontSize
      };
    }

    localStrokes.current.push(newStroke);
    updateDocumentNonBlocking(boardRef, { strokes: localStrokes.current });
    setTextInput(null);
    redraw();
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !user || !id) return;
    addDocumentNonBlocking(collection(db, "boards", id as string, "messages"), {
      text: chatMessage,
      userId: user.uid,
      userName: user.displayName || user.email?.split('@')[0] || "User",
      createdAt: serverTimestamp()
    });
    setChatMessage("");
  };

  const handleClearBoard = () => {
    if (!confirm("Clear entire board?")) return;
    localStrokes.current = [];
    if (boardRef) updateDocumentNonBlocking(boardRef, { strokes: [] });
    redraw();
  };

  if (isUserLoading || boardLoading) {
    return <div className="h-screen w-screen flex items-center justify-center bg-zinc-950"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  }

  return (
    <div className={cn("h-screen w-screen flex flex-col overflow-hidden select-none transition-colors", isDarkMode ? "bg-[#09090b] text-white" : "bg-white text-zinc-900")}>
      <header className={cn("h-14 border-b flex items-center justify-between px-4 z-40 transition-colors shadow-sm", isDarkMode ? "bg-[#09090b]/80 border-white/5 backdrop-blur-md" : "bg-white border-zinc-200")}>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="text-zinc-500 gap-2 h-9 hover:bg-zinc-800 rounded-lg">
            <ChevronLeft className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Back</span>
          </Button>
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs uppercase tracking-widest text-zinc-500">{board?.name || "Untitled"}</span>
            <Badge variant="outline" className="text-[9px] h-5 border-primary/30 text-primary">T Text</Badge>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" className="h-9 w-9 text-zinc-400 rounded-lg" onClick={() => setIsDarkMode(!isDarkMode)}>
            {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setIsChatOpen(!isChatOpen)} className={cn("h-9 gap-2 text-[11px] font-bold uppercase tracking-wider rounded-lg px-3", isChatOpen ? "bg-primary/10 text-primary" : "text-zinc-400")}>
              <MessageSquare className="h-4 w-4" />
              Chat
            </Button>
            <Button size="sm" variant="ghost" className="h-9 gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400 rounded-lg px-3">
              <UserPlus className="h-4 w-4" />
              Invite
            </Button>
            <Button size="sm" variant="ghost" className="h-9 gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400 rounded-lg px-3">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
          <Button size="sm" className="h-9 bg-primary hover:bg-primary/90 text-white gap-2 px-5 text-[11px] font-bold uppercase tracking-widest rounded-lg shadow-lg shadow-primary/20"><Save className="h-4 w-4" />Save</Button>
          <div className="flex items-center gap-2 px-3 h-8 bg-emerald-500/10 text-emerald-500 rounded-lg text-[10px] font-bold uppercase tracking-wider ml-1 border border-emerald-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Live
          </div>
        </div>
      </header>

      <div className="flex-1 relative overflow-hidden" ref={containerRef}>
        <div className={cn("absolute inset-0 pointer-events-none transition-opacity", isDarkMode ? "opacity-[0.03]" : "opacity-[0.08]")} 
             style={{ backgroundImage: `radial-gradient(${isDarkMode ? '#fff' : '#000'} 1px, transparent 1px)`, backgroundSize: '32px 32px' }} />
        
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className={cn("block touch-none", tool === "eraser" ? "cursor-cell" : "cursor-crosshair")}
        />

        {textInput && (
          <div 
            className="absolute z-50 pointer-events-auto"
            style={{ 
              left: textInput.x * (zoom / 100), 
              top: (textInput.isNote ? textInput.y + 40 : textInput.y - fontSize) * (zoom / 100),
              width: textInput.isNote ? (textInput.w || 150) * (zoom / 100) : 'auto',
              minWidth: textInput.isNote ? '100px' : 'auto'
            }}
          >
            {textInput.isNote ? (
              <textarea
                autoFocus
                className="bg-transparent border-none outline-none text-zinc-900 focus:ring-0 p-2 w-full resize-none"
                style={{ 
                  fontFamily, 
                  fontSize: 14 * (zoom / 100),
                  height: (textInput.h || 150) * (zoom / 100) - 45 * (zoom / 100)
                }}
                value={textInput.value}
                onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
                onBlur={commitText}
              />
            ) : (
              <div className="relative">
                <input
                  autoFocus
                  className="bg-transparent border-dashed border-2 border-primary/50 outline-none text-white focus:ring-0 p-2 px-4 rounded-sm"
                  style={{ 
                    fontFamily, 
                    fontSize: fontSize * (zoom / 100),
                    color: isDarkMode ? (color === "#000000" ? "#ffffff" : color) : color,
                    minWidth: '100px'
                  }}
                  value={textInput.value}
                  onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
                  onBlur={commitText}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitText();
                    if (e.key === 'Escape') setTextInput(null);
                  }}
                />
              </div>
            )}
          </div>
        )}

        <div className={cn("absolute left-6 top-6 bottom-6 z-30 w-[240px] flex flex-col p-5 rounded-2xl shadow-2xl border transition-all overflow-y-auto scrollbar-hide backdrop-blur-xl", isDarkMode ? "bg-zinc-900/90 border-white/5" : "bg-white/90 border-zinc-200")}>
          <div className="space-y-6">
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-3">Select & Pan</span>
              <div className="flex gap-2">
                <Button size="icon" variant={tool === "select" ? "default" : "ghost"} onClick={() => setTool("select")} className={cn("h-10 w-10 rounded-xl transition-all", tool === "select" ? "bg-primary shadow-lg shadow-primary/30" : "text-zinc-500 hover:bg-white/5")}><MousePointer2 className="h-5 w-5" /></Button>
                <Button size="icon" variant={tool === "eraser" ? "default" : "ghost"} onClick={() => setTool("eraser")} className={cn("h-10 w-10 rounded-xl transition-all", tool === "eraser" ? "bg-primary shadow-lg shadow-primary/30" : "text-zinc-500 hover:bg-white/5")}><Eraser className="h-5 w-5" /></Button>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-3">Draw</span>
              <div className="flex gap-2">
                <Button size="icon" variant={tool === "pencil" ? "default" : "ghost"} onClick={() => setTool("pencil")} className={cn("h-10 w-10 rounded-xl transition-all", tool === "pencil" ? "bg-primary shadow-lg shadow-primary/30" : "text-zinc-500 hover:bg-white/5")}><Pencil className="h-5 w-5" /></Button>
                <Button size="icon" variant={tool === "highlighter" ? "default" : "ghost"} onClick={() => setTool("highlighter")} className={cn("h-10 w-10 rounded-xl transition-all", tool === "highlighter" ? "bg-primary shadow-lg shadow-primary/30" : "text-zinc-500 hover:bg-white/5")}><Highlighter className="h-5 w-5" /></Button>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-3">Shapes</span>
              <div className="grid grid-cols-4 gap-2">
                {[
                  ["rect", Square], ["circle", CircleIcon], ["diamond", Diamond], ["triangle", Triangle]
                ].map(([t, Icon]: any) => (
                  <Button key={t} size="icon" variant={tool === t ? "default" : "ghost"} onClick={() => setTool(t)} className={cn("h-10 w-10 rounded-xl transition-all", tool === t ? "bg-primary shadow-lg shadow-primary/30" : "text-zinc-500 hover:bg-white/5")}><Icon className="h-5 w-5" /></Button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-3">Connectors</span>
              <div className="flex gap-2">
                <Button size="icon" variant={tool === "arrow" ? "default" : "ghost"} onClick={() => setTool("arrow")} className={cn("h-10 w-10 rounded-xl transition-all", tool === "arrow" ? "bg-primary shadow-lg shadow-primary/30" : "text-zinc-500 hover:bg-white/5")}><MoveRight className="h-5 w-5" /></Button>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-3">Annotate</span>
              <div className="flex gap-2">
                <Button size="icon" variant={tool === "text" ? "default" : "ghost"} onClick={() => setTool("text")} className={cn("h-10 w-10 rounded-xl transition-all", tool === "text" ? "bg-primary shadow-lg shadow-primary/30" : "text-zinc-500 hover:bg-white/5")}><Type className="h-5 w-5" /></Button>
                <Button size="icon" variant={tool === "note" ? "default" : "ghost"} onClick={() => setTool("note")} className={cn("h-10 w-10 rounded-xl transition-all", tool === "note" ? "bg-primary shadow-lg shadow-primary/30" : "text-zinc-500 hover:bg-white/5")}><StickyNote className="h-5 w-5" /></Button>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-3">Stroke Color</span>
                <div className="grid grid-cols-5 gap-2.5">
                  {(isDarkMode ? ["#ffffff", "#ef4444", "#22c55e", "#3b82f6", "#eab308", "#8b5cf6", "#ec4899", "#f97316", "#06b6d4", "#27272a"] : ["#000000", "#ef4444", "#22c55e", "#3b82f6", "#eab308", "#8b5cf6", "#ec4899", "#f97316", "#06b6d4", "#f8fafc"]).map((c) => (
                    <button key={c} onClick={() => setColor(c)} className={cn("w-7 h-7 rounded-full border border-white/10 transition-transform active:scale-90", color === c ? 'ring-2 ring-primary ring-offset-2 ring-offset-[#09090b] scale-110' : 'hover:scale-110')} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-3">Fill Color</span>
                <div className="grid grid-cols-5 gap-2.5">
                  {["transparent", "#ef4444", "#22c55e", "#3b82f6", "#eab308", "#8b5cf6", "#ec4899", "#f97316", "#06b6d4", "#f8fafc"].map((c) => (
                    <button key={c} onClick={() => setFillColor(c === "transparent" ? "transparent" : c + "55")} className={cn("w-7 h-8 rounded border border-white/10", (fillColor === c + "55" || (c === "transparent" && fillColor === "transparent")) ? 'ring-2 ring-primary scale-110' : '')} style={{ backgroundColor: c === "transparent" ? "transparent" : c + "55" }} />
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Min / Size</span><span className="text-[10px] font-bold text-zinc-400">{width}px</span></div>
                <input type="range" min="1" max="50" value={width} onChange={(e) => setWidth(parseInt(e.target.value))} className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-primary" />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Opacity</span><span className="text-[10px] font-bold text-zinc-400">{opacity}%</span></div>
                <input type="range" min="1" max="100" value={opacity} onChange={(e) => setOpacity(parseInt(e.target.value))} className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-primary" />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-3">Font Family</span>
                <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className="w-full h-10 bg-white/5 border border-white/10 rounded-lg text-xs px-3 focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="Inter">Inter</option>
                  <option value="serif">Serif</option>
                  <option value="monospace">Monospace</option>
                  <option value="cursive">Cursive</option>
                </select>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-3">Font Size</span>
                <div className="grid grid-cols-5 gap-2">
                  {[12, 16, 20, 24, 48].map((s) => (
                    <button key={s} onClick={() => setFontSize(s)} className={cn("h-8 rounded-lg border text-[10px] font-bold transition-all", fontSize === s ? "bg-primary border-primary text-white" : "bg-white/5 border-white/10 text-zinc-400 hover:text-white")}>{s}</button>
                  ))}
                </div>
              </div>
            </div>

            <Button variant="outline" onClick={handleClearBoard} className="w-full h-11 border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all">
              <Plus className="h-4 w-4 rotate-45 mr-2" />
              Clear Board
            </Button>
          </div>
        </div>

        <div className={cn("absolute right-0 top-0 bottom-0 z-50 w-80 shadow-2xl transition-transform duration-300 transform border-l backdrop-blur-2xl", isDarkMode ? "bg-[#09090b]/95 border-white/5" : "bg-white/95 border-zinc-200", isChatOpen ? "translate-x-0" : "translate-x-full")}>
          <div className="h-full flex flex-col">
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-bold text-sm tracking-tight">Board Chat</h3>
              <Button size="icon" variant="ghost" onClick={() => setIsChatOpen(false)} className="h-8 w-8 rounded-lg"><Plus className="h-4 w-4 rotate-45" /></Button>
            </div>
            <ScrollArea className="flex-1 p-5">
              <div className="space-y-5">
                {messages?.map((msg) => (
                  <div key={msg.id} className={cn("flex flex-col gap-1.5 max-w-[85%]", msg.userId === user?.uid ? "ml-auto items-end" : "")}>
                    <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest px-1">{msg.userName}</div>
                    <div className={cn("px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-sm", msg.userId === user?.uid ? "bg-primary text-white rounded-tr-none" : "bg-white/5 border border-white/5 rounded-tl-none")}>{msg.text}</div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="p-5 border-t border-white/5 bg-white/5">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input placeholder="Type a message..." value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} className="h-11 text-xs bg-[#09090b] border-white/5 focus-visible:ring-primary rounded-xl" />
                <Button type="submit" size="icon" className="h-11 w-11 shrink-0 bg-primary hover:bg-primary/90 rounded-xl shadow-lg shadow-primary/20"><Send className="h-4 w-4" /></Button>
              </form>
            </div>
          </div>
        </div>

        <div className={cn("absolute left-1/2 -translate-x-1/2 bottom-8 z-30 flex items-center gap-2 p-1.5 rounded-xl shadow-2xl border backdrop-blur-md", isDarkMode ? "bg-zinc-900/90 border-white/5" : "bg-white/90 border-zinc-200")}>
          <Button size="icon" variant="ghost" className="h-9 w-9 rounded-lg" onClick={() => setZoom(Math.max(10, zoom - 10))}><MinusIcon className="h-4 w-4" /></Button>
          <div className="px-3 text-xs font-bold text-zinc-400 min-w-[50px] text-center">{zoom}%</div>
          <Button size="icon" variant="ghost" className="h-9 w-9 rounded-lg" onClick={() => setZoom(Math.min(500, zoom + 10))}><Plus className="h-4 w-4" /></Button>
        </div>

        <div className="absolute right-6 bottom-6 z-30 bg-[#09090b]/80 backdrop-blur-md border border-white/5 px-3 py-1.5 rounded-lg shadow-xl text-[10px] font-bold text-zinc-500 tracking-widest uppercase">
          {zoom}%
        </div>
      </div>
    </div>
  );
}
