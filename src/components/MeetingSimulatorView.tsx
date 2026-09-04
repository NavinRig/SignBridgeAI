import React, { useRef, useEffect } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Monitor,
  MessageSquare,
  Users,
  Hand,
  Sparkles,
  MoreVertical,
  Maximize,
  ShieldAlert,
  Volume2
} from 'lucide-react';
import { DetectedGesture, HandLandmark } from '../types';

interface MeetingSimulatorViewProps {
  layout: 'none' | 'google_meet' | 'zoom_grid' | 'teams_gallery' | 'screen_share';
  videoStream: MediaStream | null;
  isCameraActive: boolean;
  landmarks: HandLandmark[];
  currentGesture: DetectedGesture | null;
  naturalTranslation: string;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
}

export const MeetingSimulatorView: React.FC<MeetingSimulatorViewProps> = ({
  layout,
  videoStream,
  isCameraActive,
  landmarks,
  currentGesture,
  naturalTranslation,
  onToggleCamera,
  onToggleScreenShare,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Attach live video stream
  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream, isCameraActive]);

  // Render on-video landmark tracker overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (!landmarks || landmarks.length < 21 || !isCameraActive) return;

    // Scale coordinates (mirror for front-facing selfie camera)
    const points = landmarks.map((pt) => ({
      x: (1 - pt.x) * width,
      y: pt.y * height,
    }));

    const connections: [number, number][] = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [9, 10], [10, 11], [11, 12],
      [13, 14], [14, 15], [15, 16],
      [0, 17], [17, 18], [18, 19], [19, 20],
      [5, 9], [9, 13], [13, 17],
    ];

    // Draw skeletal lines
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = currentGesture?.isStable ? '#38bdf8' : '#818cf8';
    ctx.lineCap = 'round';

    connections.forEach(([i, j]) => {
      const p1 = points[i];
      const p2 = points[j];
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    });

    // Draw joint nodes
    points.forEach((pt, idx) => {
      const isTip = [4, 8, 12, 16, 20].includes(idx);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isTip ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = isTip ? '#38bdf8' : '#ffffff';
      ctx.fill();
    });

    // Draw bounding box / hand label in video frame
    const minX = Math.min(...points.map((p) => p.x)) - 10;
    const maxX = Math.max(...points.map((p) => p.x)) + 10;
    const minY = Math.min(...points.map((p) => p.y)) - 25;
    const maxY = Math.max(...points.map((p) => p.y)) + 10;

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);

    if (currentGesture?.name && currentGesture.name !== 'UNKNOWN') {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(minX, minY - 18, (maxX - minX), 18);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 11px JetBrains Mono, monospace';
      ctx.fillText(`${currentGesture.name} (${Math.round(currentGesture.confidence * 100)}%)`, minX + 4, minY - 5);
    }
  }, [landmarks, currentGesture, isCameraActive]);

  // If "none", display standard full camera canvas
  if (layout === 'none') {
    return (
      <div className="relative w-full h-full min-h-[420px] rounded-3xl overflow-hidden bg-black/40 border border-white/10 backdrop-blur-xl flex items-center justify-center shadow-2xl shadow-black/40">
        {isCameraActive ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              className="absolute inset-0 w-full h-full pointer-events-none object-cover"
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center space-y-3.5">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-slate-400 backdrop-blur-md">
              <VideoOff className="w-8 h-8" />
            </div>
            <div className="text-base font-semibold text-white">
              Camera Feed Inactive
            </div>
            <p className="text-xs text-slate-400 max-w-sm">
              Enable your camera to start real-time 21-landmark hand gesture recognition and sign language translation.
            </p>
            <button
              onClick={onToggleCamera}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/25 border border-blue-400/30"
            >
              <Video className="w-4 h-4" />
              Turn On Camera
            </button>
          </div>
        )}

        {/* Live Subtitle Overlay Ribbon */}
        {isCameraActive && naturalTranslation && (
          <div className="absolute bottom-6 inset-x-6 z-20 flex justify-center pointer-events-none">
            <div className="px-6 py-3 rounded-2xl bg-[#0F172A]/85 backdrop-blur-2xl border border-white/15 shadow-2xl text-center max-w-xl">
              <div className="text-xs font-semibold text-blue-300 uppercase tracking-wider mb-0.5">
                🤟 Live Sign Interpretation
              </div>
              <div className="text-base font-bold text-white tracking-wide">
                "{naturalTranslation}"
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Google Meet Simulated Workspace Layout
  return (
    <div className="relative w-full h-full min-h-[460px] rounded-3xl overflow-hidden bg-black/40 border border-white/10 backdrop-blur-xl flex flex-col justify-between select-none shadow-2xl shadow-black/40">
      {/* Google Meet Top Bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-white/[0.04] border-b border-white/10 backdrop-blur-md z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
          <span className="text-xs font-bold text-white">
            Sprint Sync & Engineering Review | Google Meet
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-white/10 text-slate-300 border border-white/10">
            meet.google.com/abc-xyz-sgn
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-blue-300 font-semibold flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-500/15 border border-blue-400/30 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            SignBridge Extension Active
          </span>
        </div>
      </div>

      {/* Simulated Video Tiles Stage */}
      <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 gap-4 relative overflow-hidden bg-transparent">
        {/* Tile 1: User's Live Sign Camera Feed */}
        <div className="relative rounded-2xl overflow-hidden bg-white/[0.03] border-2 border-blue-400/60 shadow-xl flex items-center justify-center backdrop-blur-md">
          {isCameraActive ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
              <canvas
                ref={canvasRef}
                width={480}
                height={320}
                className="absolute inset-0 w-full h-full pointer-events-none object-cover"
              />
            </>
          ) : (
            <div className="flex flex-col items-center gap-2.5 text-slate-400">
              <VideoOff className="w-6 h-6" />
              <span className="text-xs font-medium">Your Camera (Signer)</span>
              <button
                onClick={onToggleCamera}
                className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/25 border border-blue-400/30"
              >
                Enable Camera
              </button>
            </div>
          )}

          {/* Speaker Badge */}
          <div className="absolute bottom-2.5 left-2.5 px-3 py-1 rounded-xl bg-[#0F172A]/85 backdrop-blur-md border border-white/15 text-xs font-semibold text-white flex items-center gap-1.5 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            You (Active ASL Signer)
          </div>

          {/* Gesture Confidence Tag */}
          {currentGesture?.name && currentGesture.name !== 'UNKNOWN' && (
            <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-blue-950/85 border border-blue-400/40 text-[11px] font-mono text-cyan-300 font-bold backdrop-blur-md shadow-md">
              HUD: {currentGesture.name}
            </div>
          )}
        </div>

        {/* Tile 2: Simulated Meeting Participant (Sarah - Product Lead) */}
        <div className="relative rounded-2xl overflow-hidden bg-white/[0.03] border border-white/10 backdrop-blur-md flex items-center justify-center shadow-lg">
          <div className="w-full h-full bg-gradient-to-br from-white/[0.04] to-transparent flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-xl font-bold text-blue-200 mb-2.5 shadow-md shadow-blue-500/20 backdrop-blur-md">
              SJ
            </div>
            <div className="text-sm font-bold text-white">Sarah Jenkins</div>
            <div className="text-xs text-slate-300">Product Lead (Listening & Speaking)</div>
          </div>

          <div className="absolute bottom-2.5 left-2.5 px-3 py-1 rounded-xl bg-[#0F172A]/85 backdrop-blur-md border border-white/15 text-xs font-semibold text-slate-200 shadow-lg">
            Sarah Jenkins
          </div>
        </div>
      </div>

      {/* Google Meet Bottom Controls Toolbar */}
      <div className="flex items-center justify-between px-6 py-3.5 bg-white/[0.04] border-t border-white/10 backdrop-blur-md z-20">
        <div className="text-xs font-mono text-slate-400">
          10:24 AM | Sprint Meeting
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onToggleCamera}
            className={`p-3 rounded-2xl backdrop-blur-md transition-all ${
              isCameraActive
                ? 'bg-white/10 text-slate-200 hover:bg-white/15 border border-white/10'
                : 'bg-rose-600 text-white hover:bg-rose-500 shadow-lg shadow-rose-500/25 border border-rose-400/30'
            }`}
            title="Toggle Camera"
          >
            {isCameraActive ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          </button>

          <button
            onClick={onToggleScreenShare}
            className="p-3 rounded-2xl bg-white/10 text-slate-200 hover:bg-white/15 border border-white/10 backdrop-blur-md transition-all"
            title="Present Screen"
          >
            <Monitor className="w-4 h-4" />
          </button>

          <button
            className="p-3 rounded-2xl bg-white/10 text-slate-200 hover:bg-white/15 border border-white/10 backdrop-blur-md transition-all"
            title="Raise Hand"
          >
            <Hand className="w-4 h-4" />
          </button>

          <button
            className="px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-lg shadow-rose-500/25 border border-rose-400/30"
            title="Leave Call"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button className="p-2.5 rounded-xl bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 border border-white/10 transition-colors">
            <Users className="w-4 h-4" />
          </button>
          <button className="p-2.5 rounded-xl bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 border border-white/10 transition-colors">
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
