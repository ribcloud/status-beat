import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Download, Video, Palette, Clock, Activity } from 'lucide-react';
import { SongData, VisualData, VisualizerMode } from '../types';

interface EditorProps {
  songData: SongData;
  visualData: VisualData;
  onBack: () => void;
}

const CANVAS_WIDTH = 540; // 9:16 ratio
const CANVAS_HEIGHT = 960;

const Editor: React.FC<EditorProps> = ({ songData, visualData, onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Audio Context Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const animationFrameRef = useRef<number>(0);
  
  // Recording Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  
  // New Customization State
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>('bars');
  const [startTime, setStartTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  // Initialize Audio
  useEffect(() => {
    if (!songData.url) return;

    const audio = new Audio(songData.url);
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      setDuration(audio.duration);
    };

    audio.onended = () => {
      setIsPlaying(false);
      if (isRecording) stopRecording();
    };

    audio.ontimeupdate = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    return () => {
      audio.pause();
      audio.src = '';
      cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songData.url]);

  // Handle Recording Timer separately to be precise
  useEffect(() => {
    let interval: number;
    if (isRecording) {
      const start = Date.now();
      interval = window.setInterval(() => {
        const elapsed = (Date.now() - start) / 1000;
        if (elapsed >= 30) {
          stopRecording();
        }
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Initialize Canvas & Audio Context
  useEffect(() => {
    if (!audioRef.current || !canvasRef.current) return;

    drawVisualizer();

    const initAudioContext = () => {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        
        const source = ctx.createMediaElementSource(audioRef.current!);
        const destination = ctx.createMediaStreamDestination();
        
        source.connect(analyser);
        analyser.connect(ctx.destination); // Connect to speakers
        analyser.connect(destination); // Connect to recorder stream
        
        audioContextRef.current = ctx;
        analyserRef.current = analyser;
        sourceRef.current = source;
        destRef.current = destination;
      }
    };

    const handleUserGesture = () => {
      initAudioContext();
      document.removeEventListener('click', handleUserGesture);
    };
    document.addEventListener('click', handleUserGesture);

    return () => {
      document.removeEventListener('click', handleUserGesture);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visualData.backgroundImage, visualizerMode]);

  const drawVisualizer = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Background
    drawBackground(ctx);

    // 2. Song Info
    drawText(ctx);

    // 3. Visualizer
    if (analyserRef.current) {
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteFrequencyData(dataArray);

      if (visualizerMode === 'bars') {
        drawBars(ctx, dataArray, bufferLength);
      } else {
        drawCircle(ctx, dataArray, bufferLength);
      }
    }

    // 4. Progress Bar (Visual only)
    if (audioRef.current && audioRef.current.duration) {
       const pct = audioRef.current.currentTime / audioRef.current.duration;
       ctx.fillStyle = '#22c55e';
       ctx.fillRect(0, CANVAS_HEIGHT - 6, CANVAS_WIDTH * pct, 6);
    }
  };

  const drawBackground = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (visualData.backgroundImage) {
      const img = new Image();
      img.src = visualData.backgroundImage;
      if (img.complete) {
        drawImageCover(ctx, img, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      grad.addColorStop(0, '#1e293b');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // Overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  const drawText = (ctx: CanvasRenderingContext2D) => {
    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Inter';
    ctx.textAlign = 'center';
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 10;
    ctx.fillText(songData.name, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 80);

    // Caption
    ctx.font = '22px Inter';
    ctx.fillStyle = '#e2e8f0';
    if (visualData.caption) {
      const maxWidth = CANVAS_WIDTH - 60;
      wrapText(ctx, visualData.caption, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 100, maxWidth, 30);
    }
    ctx.shadowBlur = 0;
  }

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for(let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
  }

  const drawBars = (ctx: CanvasRenderingContext2D, dataArray: Uint8Array, bufferLength: number) => {
    const barWidth = (CANVAS_WIDTH / bufferLength) * 2.5;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = dataArray[i] * 1.5;
      const r = barHeight + (25 * (i / bufferLength));
      const g = 250 * (i / bufferLength);
      const b = 50;

      ctx.fillStyle = `rgba(${r},${g},${b}, 0.9)`;
      ctx.fillRect(x, CANVAS_HEIGHT - barHeight - 120, barWidth, barHeight);
      x += barWidth + 1;
    }
  }

  const drawCircle = (ctx: CanvasRenderingContext2D, dataArray: Uint8Array, bufferLength: number) => {
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;
    const radius = 150;

    ctx.save();
    ctx.translate(cx, cy);

    // Only use lower frequencies for better circular look
    const segments = 120;
    const step = 360 / segments;
    
    for (let i = 0; i < segments; i++) {
       // Map segment to frequency data (focus on bass/mids)
       const dataIndex = Math.floor(i * (bufferLength / 2) / segments);
       const value = dataArray[dataIndex];
       const barHeight = value * 0.8;

       ctx.rotate((step * Math.PI) / 180);
       
       const hue = i * 3;
       ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
       
       // Draw symmetrical bars
       ctx.fillRect(0, radius, 4, barHeight); 
    }
    
    ctx.restore();
    
    // Draw Center Circle (Album art placeholder effect)
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 5, 0, 2 * Math.PI);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  const drawImageCover = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) => {
    const ratio = Math.max(w / img.width, h / img.height);
    const centerShift_x = (w - img.width * ratio) / 2;
    const centerShift_y = (h - img.height * ratio) / 2;
    ctx.drawImage(img, 0, 0, img.width, img.height, centerShift_x, centerShift_y, img.width * ratio, img.height * ratio);
  }

  const loop = () => {
    drawVisualizer();
    if (isPlaying || isRecording) {
      animationFrameRef.current = requestAnimationFrame(loop);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(loop);
    } else {
      requestAnimationFrame(loop); // Draw one frame
      cancelAnimationFrame(animationFrameRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, visualizerMode]);

  const togglePlay = () => {
    if (!audioRef.current || !audioContextRef.current) return;
    
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const newTime = parseFloat(e.target.value);
     setStartTime(newTime);
     if (audioRef.current) {
       audioRef.current.currentTime = newTime;
       // Redraw to update progress bar visually
       requestAnimationFrame(drawVisualizer);
     }
  };

  const startRecording = () => {
    if (!canvasRef.current || !destRef.current || !audioRef.current) return;
    
    // Jump to selected start time
    audioRef.current.currentTime = startTime;
    audioRef.current.play();
    setIsPlaying(true);
    setIsRecording(true);
    setRecordedVideoUrl(null);

    const canvasStream = canvasRef.current.captureStream(30); 
    const audioTrack = destRef.current.stream.getAudioTracks()[0];
    const combinedStream = new MediaStream([...canvasStream.getVideoTracks(), audioTrack]);

    // Check supported mime types for Android/Browser compatibility
    const mimeTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4' // Some browsers might support this via MediaRecorder now
    ];
    
    const selectedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));

    if (!selectedMimeType) {
      alert("Seu navegador não suporta gravação de vídeo.");
      setIsPlaying(false);
      setIsRecording(false);
      return;
    }

    const options = { mimeType: selectedMimeType };
    
    try {
      const recorder = new MediaRecorder(combinedStream, options);
      
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: selectedMimeType });
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl(url);
        setIsPlaying(false);
        setIsRecording(false);
        audioRef.current?.pause();
        // Reset to start time for convenience
        if (audioRef.current) audioRef.current.currentTime = startTime;
      };

      recorder.start();
    } catch (e) {
      console.error("Recording error:", e);
      alert("Erro ao iniciar gravação.");
      setIsPlaying(false);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const downloadVideo = () => {
    if (!recordedVideoUrl) return;
    const a = document.createElement('a');
    a.href = recordedVideoUrl;
    // Android treats webm well, but mp4 is safer if user shares directly.
    // However, we are generating webm. WhatsApp supports webm uploads.
    a.download = `StatusBeat-${songData.name.replace(/\s+/g, '-')}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatTime = (time: number) => {
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center w-full max-w-5xl mx-auto p-4 gap-6">
      <div className="flex justify-between w-full items-center mb-4">
        <button onClick={onBack} className="text-gray-400 hover:text-white transition">
          &larr; Voltar
        </button>
        <h2 className="text-xl font-bold text-green-400">Estúdio de Criação</h2>
        <div className="w-10"></div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start w-full justify-center">
        {/* Canvas Area */}
        <div className="flex flex-col gap-4 items-center">
            <div className="relative group shadow-2xl shadow-green-900/20">
            <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className="w-[300px] h-[533px] bg-black rounded-lg border border-gray-700 object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 rounded-lg pointer-events-none">
                <div className="bg-green-500 text-black p-4 rounded-full shadow-lg">
                    {isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" className="ml-1" />}
                </div>
            </div>
            </div>
            
            {/* Play/Pause Control below canvas for mobile touch */}
            <button 
                onClick={togglePlay}
                disabled={isRecording}
                className="lg:hidden w-full py-3 bg-slate-800 rounded-lg font-semibold text-white border border-slate-700 active:bg-slate-700"
            >
                {isPlaying ? "Pausar Preview" : "Reproduzir Preview"}
            </button>
        </div>

        {/* Controls Panel */}
        <div className="flex flex-col gap-6 w-full lg:w-96">
            
            {/* 1. Visualizer Settings */}
            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-4">
                <h3 className="text-sm uppercase tracking-wider text-slate-500 font-bold flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Visualizador
                </h3>
                <div className="grid grid-cols-2 gap-2">
                    <button 
                        onClick={() => setVisualizerMode('bars')}
                        className={`p-3 rounded-lg border text-sm font-medium transition ${visualizerMode === 'bars' ? 'bg-green-500/10 border-green-500 text-green-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                    >
                        Barras Clássicas
                    </button>
                    <button 
                        onClick={() => setVisualizerMode('circle')}
                        className={`p-3 rounded-lg border text-sm font-medium transition ${visualizerMode === 'circle' ? 'bg-green-500/10 border-green-500 text-green-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                    >
                        Círculo Radial
                    </button>
                </div>
            </div>

            {/* 2. Audio Trimming */}
            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-4">
                 <h3 className="text-sm uppercase tracking-wider text-slate-500 font-bold flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Recorte da Música
                </h3>
                
                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-400">
                        <span>Início: <span className="text-white font-mono">{formatTime(startTime)}</span></span>
                        <span>Fim: <span className="text-white font-mono">{formatTime(Math.min(startTime + 30, duration))}</span></span>
                    </div>
                    <input 
                        type="range" 
                        min="0" 
                        max={duration > 30 ? duration - 30 : 0} 
                        step="1"
                        value={startTime}
                        onChange={handleStartTimeChange}
                        disabled={isRecording}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                    <p className="text-xs text-slate-500">Selecione o ponto de início. A gravação terá duração máxima de 30s (limite WhatsApp).</p>
                </div>
            </div>

            {/* 3. Recording Actions */}
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex flex-col gap-4">
                <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Video className="w-5 h-5 text-purple-400" />
                        Gravar Status
                    </h3>
                </div>

                {!isRecording && !recordedVideoUrl && (
                <button
                    onClick={startRecording}
                    className="flex items-center justify-center gap-2 w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg font-bold shadow-lg transition transform active:scale-95"
                >
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_red]"></div>
                    REC (30s)
                </button>
                )}

                {isRecording && (
                <button
                    onClick={stopRecording}
                    className="flex items-center justify-center gap-2 w-full py-4 bg-red-600 hover:bg-red-500 rounded-lg font-bold shadow-lg transition animate-pulse border border-red-400"
                >
                    <div className="w-3 h-3 bg-white rounded-sm"></div>
                    Parar Gravação
                </button>
                )}

                {recordedVideoUrl && (
                <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="bg-green-500/10 border border-green-500/30 p-3 rounded text-center text-green-400 text-sm font-medium">
                        ✨ Status renderizado!
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={downloadVideo}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-500 hover:bg-green-400 text-black rounded-lg font-bold shadow-lg transition"
                        >
                            <Download className="w-5 h-5" />
                            Baixar
                        </button>
                        <button
                            onClick={() => setRecordedVideoUrl(null)}
                            className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
                        >
                            Novo
                        </button>
                    </div>
                </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default Editor;