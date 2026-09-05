import React, { useState, useRef, useEffect } from 'react';
import {
  Move,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Sparkles,
  Layers,
  Settings2,
  Activity,
  Vibrate,
  X,
  CheckCircle2,
  RefreshCw,
  Video,
  Monitor,
  VideoOff
} from 'lucide-react';
import { DetectedGesture, HandLandmark, OverlaySettings } from '../types';
import { hapticService } from '../services/hapticService';
import { audioEngine } from '../services/audioEngine';

interface FloatingOverlayProps {
  currentGesture: DetectedGesture | null;
  landmarks: HandLandmark[];
  naturalTranslation: string;
  accumulatedSigns: string[];
  onCommitSentence: () => void;
  onClearBuffer: () => void;
  onAnalyzeDeep: (signName: string) => void;
  settings: OverlaySettings;
  onUpdateSettings: (newSettings: Partial<OverlaySettings>) => void;
  isTranslatingAI: boolean;
  videoStream: MediaStream | null;
}

export const FloatingOverlay: React.FC<FloatingOverlayProps> = ({
  currentGesture,
  landmarks,
  naturalTranslation,
  accumulatedSigns,
  onCommitSentence,
  onClearBuffer,
  onAnalyzeDeep,
  settings,
  onUpdateSettings,
  isTranslatingAI,
  videoStream,
}) => {
  const [position, setPosition] = useState<{ x: number; y: number }>(settings.position || { x: 24, y: 24 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [hapticPulseActive, setHapticPulseActive] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const skeletonCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Subscribe to haptic trigger for tactile visual ring
  useEffect(() => {
    const unsub = hapticService.subscribe(() => {
      setHapticPulseActive(true);
      setTimeout(() => setHapticPulseActive(false), 220);
    });
    return unsub;
  }, []);

  // Handle Dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) {
      return;
    }
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newX = Math.max(10, Math.min(window.innerWidth - 320, e.clientX - dragOffset.x));
      const newY = Math.max(10, Math.min(window.innerHeight - 200, e.clientY - dragOffset.y));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        onUpdateSettings({ position });
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, position, onUpdateSettings]);

  // Render 21 Landmark Hand Skeleton HUD
  useEffect(() => {
    const canvas = skeletonCanvasRef.current;
    if (!canvas || !settings.showSkeleton) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (!landmarks || landmarks.length < 21) {
      // Draw scanline idle animation
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)';
      ctx.lineWidth = 1;
      const scanY = (Date.now() / 15) % height;
      ctx.beginPath();
      ctx.moveTo(0, scanY);
      ctx.lineTo(width, scanY);
      ctx.stroke();
      return;
    }

    // MediaPipe Hand Connection Graph pairs
    const connections: [number, number][] = [
      // Thumb
      [0, 1], [1, 2], [2, 3], [3, 4],
      // Index
      [0, 5], [5, 6], [6, 7], [7, 8],
      // Middle
      [9, 10], [10, 11], [11, 12],
      // Ring
      [13, 14], [14, 15], [15, 16],
      // Pinky
      [0, 17], [17, 18], [18, 19], [19, 20],
      // Palm base
      [5, 9], [9, 13], [13, 17],
    ];

    // Scale coordinates (mirror for front camera)
    const points = landmarks.map((pt) => ({
      x: (1 - pt.x) * width,
      y: pt.y * height,
    }));

    // Draw Skeleton Lines
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    connections.forEach(([i, j]) => {
      const p1 = points[i];
      const p2 = points[j];
      if (p1 && p2) {
        ctx.strokeStyle = currentGesture?.isStable
          ? 'rgba(56, 189, 248, 0.85)'
          : 'rgba(99, 102, 241, 0.75)';
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    });

    // Draw Joint Nodes
    points.forEach((pt, idx) => {
      const isFingertip = [4, 8, 12, 16, 20].includes(idx);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isFingertip ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = isFingertip
        ? currentGesture?.isStable
          ? '#38bdf8'
          : '#818cf8'
        : '#e2e8f0';
      ctx.fill();

      if (isFingertip) {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
    });
  }, [landmarks, settings.showSkeleton, currentGesture]);

  const signConfidencePercent = Math.round((currentGesture?.confidence || 0) * 100);

  return (
    <div
      ref={containerRef}
      id="floating-sign-overlay"
      onMouseDown={handleMouseDown}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        opacity: settings.opacity,
        scale: `${settings.scale}`,
      }}
      className={`fixed top-0 left-0 z-50 transition-shadow duration-200 select-none ${
        isDragging ? 'cursor-grabbing ring-2 ring-indigo-400/80 shadow-2xl' : 'cursor-grab'
      }`}
    >
      {/* Visual Haptic Pulse Ring feedback */}
      <div
        className={`absolute -inset-1 rounded-2xl pointer-events-none transition-all duration-200 ${
          hapticPulseActive ? 'ring-4 ring-cyan-400/60 scale-102 opacity-100' : 'opacity-0 ring-0'
        }`}
      />

      {/* Main Overlay Card */}
      <div
        className={`relative overflow-hidden rounded-3xl border backdrop-blur-2xl transition-all duration-200 ${
          settings.highContrastMode
            ? 'bg-black/95 border-yellow-400 text-white shadow-2xl'
            : 'bg-[#0F172A]/80 border-white/15 shadow-2xl shadow-black/60 text-slate-100'
        } ${isMinimized ? 'w-72 p-3.5' : 'w-[360px] md:w-[390px] p-4.5'}`}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-400/30 backdrop-blur-md">
              <Move className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold tracking-tight text-white font-mono">
                  SignBridge Overlay
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  LIVE HUD
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Non-intrusive Video Call HUD
              </p>
            </div>
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onUpdateSettings({ autoSpeak: !settings.autoSpeak })}
              className={`p-1.5 rounded-xl backdrop-blur-md transition-all ${
                settings.autoSpeak
                  ? 'bg-blue-600/40 text-blue-200 border border-blue-400/50 shadow-sm shadow-blue-500/20'
                  : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'
              }`}
              title={settings.autoSpeak ? 'Auto-Speak Active' : 'Auto-Speak Muted'}
            >
              {settings.autoSpeak ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => onUpdateSettings({ hapticsEnabled: !settings.hapticsEnabled })}
              className={`p-1.5 rounded-xl backdrop-blur-md transition-all ${
                settings.hapticsEnabled
                  ? 'bg-cyan-600/40 text-cyan-200 border border-cyan-400/50 shadow-sm shadow-cyan-500/20'
                  : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'
              }`}
              title="Toggle Haptic Feedback"
            >
              <Vibrate className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 backdrop-blur-md transition-all"
              title="Overlay Settings"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 backdrop-blur-md transition-all"
              title={isMinimized ? 'Expand HUD' : 'Minimize HUD'}
            >
              {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Minimized Compact View */}
        {isMinimized ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <div className="text-xs font-semibold text-blue-300 font-mono truncate max-w-[140px]">
                {currentGesture?.name || 'Waiting for sign...'}
              </div>
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              {signConfidencePercent}%
            </div>
          </div>
        ) : (
          <>
            {/* Live Skeleton Wireframe & Gesture Detector Screen */}
            {settings.showSkeleton && (
              <div className="relative w-full h-32 mb-3 rounded-2xl overflow-hidden bg-black/40 border border-white/10 backdrop-blur-md flex items-center justify-center">
                <canvas
                  ref={skeletonCanvasRef}
                  width={340}
                  height={128}
                  className="w-full h-full object-contain"
                />

                {/* Stability indicator pill */}
                <div className="absolute top-2 right-2 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-black/50 backdrop-blur-md border border-white/15 flex items-center gap-1.5 text-slate-200">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      currentGesture?.isStable
                        ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                        : 'bg-amber-400 animate-pulse'
                    }`}
                  />
                  {currentGesture?.isStable ? 'LOCKED' : 'TRACKING'}
                </div>

                {/* Handedness tag */}
                <div className="absolute bottom-2 left-2 text-[10px] font-mono text-slate-300 bg-black/50 px-2.5 py-0.5 rounded-lg border border-white/10 backdrop-blur-md">
                  {currentGesture?.handedness || 'Right'} Hand
                </div>
              </div>
            )}

            {/* Current Realtime Recognized Gesture */}
            <div className="p-3.5 rounded-2xl bg-white/[0.05] border border-white/10 backdrop-blur-xl mb-3 shadow-md shadow-black/20">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">
                  Real-time Sign Detected
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-mono font-semibold text-cyan-300">
                    {signConfidencePercent}% Match
                  </span>
                  <div className="w-12 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-400 to-cyan-400 transition-all duration-300"
                      style={{ width: `${signConfidencePercent}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="text-lg font-bold tracking-tight text-white font-mono flex items-center gap-2">
                  <span>{currentGesture?.name || '—'}</span>
                  {currentGesture?.name && currentGesture.name !== 'UNKNOWN' && (
                    <button
                      onClick={() => onAnalyzeDeep(currentGesture.name)}
                      className="p-1 text-xs rounded-lg bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 border border-blue-400/30 transition-colors"
                      title="AI Deep Linguistic Analysis (High Thinking)"
                    >
                      <Sparkles className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {currentGesture?.category && (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10 capitalize backdrop-blur-md">
                    {currentGesture.category}
                  </span>
                )}
              </div>

              {currentGesture?.description && (
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  {currentGesture.description}
                </p>
              )}
            </div>

            {/* Accumulated Sign Buffer / Breadcrumbs */}
            {settings.showGlossBreadcrumbs && accumulatedSigns.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
                  <span>Accumulated Gloss Buffer</span>
                  <button
                    onClick={onClearBuffer}
                    className="text-slate-400 hover:text-rose-300 text-[10px] underline"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-md max-h-20 overflow-y-auto">
                  {accumulatedSigns.map((s, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-medium bg-blue-500/20 text-blue-200 border border-blue-400/30"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Natural Spoken Translation Bar */}
            <div className="p-3.5 rounded-2xl bg-white/[0.05] border border-white/10 backdrop-blur-xl mb-3 shadow-md shadow-black/20">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  <Sparkles className="w-3 h-3 text-blue-400" />
                  Fluent English Translation
                </div>
                {isTranslatingAI && (
                  <span className="text-[10px] text-blue-400 animate-pulse flex items-center gap-1">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Translating...
                  </span>
                )}
              </div>
              <div className="text-sm font-medium text-slate-100 leading-snug">
                {naturalTranslation || (
                  <span className="text-slate-500 italic">
                    Start signing with your camera to translate in real-time...
                  </span>
                )}
              </div>
            </div>

            {/* Action Bar: Speak & Commit to Meeting Transcript */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (naturalTranslation) {
                    audioEngine.speak(naturalTranslation);
                    hapticService.trigger('speech_in');
                  }
                }}
                disabled={!naturalTranslation}
                className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-blue-500/25 border border-blue-400/30"
              >
                <Volume2 className="w-3.5 h-3.5" />
                Speak Out Loud
              </button>

              <button
                onClick={onCommitSentence}
                disabled={!naturalTranslation && accumulatedSigns.length === 0}
                className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border border-white/10 backdrop-blur-md"
                title="Save Translation into Searchable Transcript"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Commit to Transcript
              </button>
            </div>
          </>
        )}

        {/* Quick Settings Drawer */}
        {showSettingsDrawer && (
          <div className="mt-3 pt-3 border-t border-white/10 text-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">HUD Transparency</span>
              <input
                type="range"
                min="0.3"
                max="1.0"
                step="0.05"
                value={settings.opacity}
                onChange={(e) => onUpdateSettings({ opacity: parseFloat(e.target.value) })}
                className="w-24 accent-blue-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Show Hand Skeleton Wireframe</span>
              <button
                onClick={() => onUpdateSettings({ showSkeleton: !settings.showSkeleton })}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium backdrop-blur-md transition-all ${
                  settings.showSkeleton
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                    : 'bg-white/5 text-slate-400 border border-white/10'
                }`}
              >
                {settings.showSkeleton ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">High Contrast Mode</span>
              <button
                onClick={() => onUpdateSettings({ highContrastMode: !settings.highContrastMode })}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium backdrop-blur-md transition-all ${
                  settings.highContrastMode
                    ? 'bg-yellow-500 text-black font-bold'
                    : 'bg-white/5 text-slate-400 border border-white/10'
                }`}
              >
                {settings.highContrastMode ? 'ACTIVE' : 'DEFAULT'}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Background Simulator</span>
              <select
                value={settings.simulatedMeetingBg}
                onChange={(e) => onUpdateSettings({ simulatedMeetingBg: e.target.value as any })}
                className="bg-white/10 border border-white/15 text-slate-200 rounded-xl px-2.5 py-1 text-[11px] backdrop-blur-md focus:outline-none"
              >
                <option value="none" className="bg-slate-900 text-slate-200">Camera Feed Only</option>
                <option value="google_meet" className="bg-slate-900 text-slate-200">Google Meet Layout</option>
                <option value="zoom_grid" className="bg-slate-900 text-slate-200">Zoom Gallery Grid</option>
                <option value="teams_gallery" className="bg-slate-900 text-slate-200">MS Teams Grid</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Camera Background Blur</span>
              <div className="flex items-center gap-1">
                {(['off', 'subtle', 'medium', 'deep'] as const).map((bMode) => (
                  <button
                    key={bMode}
                    onClick={() => {
                      const radiusMap = { off: 0, subtle: 6, medium: 14, deep: 24 };
                      onUpdateSettings({
                        backgroundBlur: bMode,
                        backgroundBlurRadius: radiusMap[bMode],
                      });
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold capitalize transition-all ${
                      settings.backgroundBlur === bMode
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                        : 'bg-white/5 text-slate-400 border border-white/10 hover:text-white'
                    }`}
                  >
                    {bMode}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
