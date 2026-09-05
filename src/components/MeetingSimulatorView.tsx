import React, { useRef, useEffect, useState } from 'react';
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
  Volume2,
  Sliders,
  Check,
  Layers,
  X,
  Aperture,
  Shield,
  Smile,
  Eye,
  EyeOff,
  Activity,
  HelpCircle
} from 'lucide-react';
import { BackgroundBlurMode, DetectedGesture, HandLandmark, FaceLandmark, DetectedEmotion } from '../types';
import { hapticService } from '../services/hapticService';

interface MeetingSimulatorViewProps {
  layout: 'none' | 'google_meet' | 'zoom_grid' | 'teams_gallery' | 'screen_share';
  videoStream: MediaStream | null;
  isCameraActive: boolean;
  landmarks: HandLandmark[];
  faceLandmarks?: FaceLandmark[];
  detectedEmotion?: DetectedEmotion | null;
  currentGesture: DetectedGesture | null;
  naturalTranslation: string;
  backgroundBlur?: BackgroundBlurMode;
  backgroundBlurRadius?: number;
  onUpdateBackgroundBlur?: (mode: BackgroundBlurMode, radius: number) => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  isTrackingDisplayOn?: boolean;
  onToggleTrackingDisplay?: (on: boolean) => void;
}

export const MeetingSimulatorView: React.FC<MeetingSimulatorViewProps> = ({
  layout,
  videoStream,
  isCameraActive,
  landmarks,
  faceLandmarks,
  detectedEmotion,
  currentGesture,
  naturalTranslation,
  backgroundBlur = 'medium',
  backgroundBlurRadius = 14,
  onUpdateBackgroundBlur,
  onToggleCamera,
  onToggleScreenShare,
  isTrackingDisplayOn: propIsTrackingDisplayOn,
  onToggleTrackingDisplay,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sharpVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [showBlurMenu, setShowBlurMenu] = useState(false);
  const [smartSignerFocus, setSmartSignerFocus] = useState(true);
  const [showFaceMesh, setShowFaceMesh] = useState(true);

  // Dedicated 2-Button Tracking Display state (Turn On Tracking Display vs Turn Off Tracking Display)
  const [internalTrackingDisplay, setInternalTrackingDisplay] = useState(true);
  const isTrackingDisplayOn = propIsTrackingDisplayOn !== undefined ? propIsTrackingDisplayOn : internalTrackingDisplay;

  const handleSetTrackingDisplay = (enabled: boolean) => {
    setInternalTrackingDisplay(enabled);
    if (onToggleTrackingDisplay) {
      onToggleTrackingDisplay(enabled);
    }
    hapticService.trigger('light');
  };

  // Attach live video stream to primary & sharp video elements
  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    }
    if (sharpVideoRef.current && videoStream) {
      sharpVideoRef.current.srcObject = videoStream;
    }
  }, [videoStream, isCameraActive]);

  // Render on-video landmark tracker overlay (DECOUPLED: Face and Hand tracking render independently!)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // If camera is inactive or user turned off tracking display, keep canvas clear
    if (!isCameraActive || !isTrackingDisplayOn) return;

    // 1. Render Hand Landmarks & 21-point Skeleton (if hands in camera feed)
    if (landmarks && landmarks.length >= 21) {
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
    }

    // 2. Render Face Landmarks & Emotion Mesh (Runs as soon as ANY face is in camera feed, NO hand needed!)
    if (showFaceMesh && faceLandmarks && faceLandmarks.length >= 15) {
      // Scale normalized [0..1] coordinates directly to canvas size
      // Mirror x for front-facing selfie camera (matches video transform -scale-x-100)
      const facePts = faceLandmarks.map((pt) => ({
        x: (1 - pt.x) * width,
        y: pt.y * height,
      }));

      // Facial wireframe connections
      const faceConnections: [number, number][] = [
        // Eyebrows
        [0, 1], [1, 2], [3, 4], [4, 5],
        // Eyes
        [6, 7], [7, 8], [8, 9], [9, 6],
        [11, 12], [12, 13], [13, 14], [14, 11],
        // Nose
        [16, 17], [17, 18], [17, 19],
        // Lips & Mouth
        [20, 21], [21, 22], [22, 23], [23, 20],
        // Jawline & Chin
        [26, 27], [27, 28], [28, 29], [29, 30], [30, 31], [31, 32], [32, 33], [33, 34],
        [35, 26], [35, 34],
      ];

      ctx.lineWidth = 1.4;
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)'; // Soft emerald
      ctx.lineCap = 'round';

      faceConnections.forEach(([i, j]) => {
        const p1 = facePts[i];
        const p2 = facePts[j];
        if (p1 && p2) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      });

      // Draw subtle facial keypoint nodes
      facePts.forEach((pt, idx) => {
        const isKeyNode = [0, 2, 3, 5, 10, 15, 17, 20, 22, 30].includes(idx);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, isKeyNode ? 2.8 : 1.8, 0, Math.PI * 2);
        ctx.fillStyle = isKeyNode ? '#10b981' : 'rgba(52, 211, 153, 0.6)';
        ctx.fill();
      });

      // Forehead Emotion HUD
      if (detectedEmotion) {
        const forehead = facePts[35] || { x: width * 0.5, y: height * 0.2 };
        const hudText = `${detectedEmotion.emotion} (${Math.round(detectedEmotion.confidence * 100)}%) • ${detectedEmotion.nonManualMarker.replace('_', ' ')}`;
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        const textWidth = ctx.measureText(hudText).width;

        ctx.fillStyle = 'rgba(6, 78, 59, 0.85)'; // Dark emerald
        ctx.fillRect(forehead.x - textWidth / 2 - 8, forehead.y - 24, textWidth + 16, 20);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1;
        ctx.strokeRect(forehead.x - textWidth / 2 - 8, forehead.y - 24, textWidth + 16, 20);

        ctx.fillStyle = '#6ee7b7';
        ctx.fillText(hudText, forehead.x - textWidth / 2, forehead.y - 10);
      }
    }
  }, [landmarks, faceLandmarks, detectedEmotion, showFaceMesh, isTrackingDisplayOn, currentGesture, isCameraActive]);

  const currentBlurPercentage =
    backgroundBlur === 'off' ? 0 : Math.min(80, Math.max(5, Math.round((backgroundBlurRadius / 35) * 100)));

  const blurPresets: { mode: BackgroundBlurMode; label: string; percent: number; desc: string }[] = [
    { mode: 'off', label: 'No Blur', percent: 0, desc: 'Turn off visual effects (0%)' },
    { mode: 'subtle', label: 'Slight Blur', percent: 25, desc: 'Slightly blur background (25%)' },
    { mode: 'medium', label: 'Standard Blur', percent: 50, desc: 'Google Meet standard blur (50%)' },
    { mode: 'bokeh', label: 'Heavy Blur', percent: 80, desc: 'Maximum room privacy (80%)' },
  ];

  const handleSelectBlurPercent = (percent: number) => {
    const clamped = Math.max(0, Math.min(80, percent));
    if (clamped === 0) {
      if (onUpdateBackgroundBlur) onUpdateBackgroundBlur('off', 0);
      return;
    }
    const radius = Math.round((clamped / 100) * 35);
    let mode: BackgroundBlurMode = 'subtle';
    if (clamped > 75) mode = 'bokeh';
    else if (clamped > 50) mode = 'deep';
    else if (clamped > 25) mode = 'medium';

    if (onUpdateBackgroundBlur) {
      onUpdateBackgroundBlur(mode, radius);
    }
  };

  const handleSelectBlur = (mode: BackgroundBlurMode, radius: number) => {
    if (onUpdateBackgroundBlur) {
      onUpdateBackgroundBlur(mode, radius);
    }
  };

  // Video renderer component with blur filter layers
  const renderVideoFeed = (canvasWidth: number, canvasHeight: number) => {
    const isBlurred = backgroundBlur !== 'off';

    return (
      <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
        {/* Layer 1: Background Video (Blurred when filter active) */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transform -scale-x-100 transition-all duration-300 ${
            isBlurred ? 'scale-105' : ''
          }`}
          style={
            isBlurred
              ? {
                  filter: `blur(${backgroundBlurRadius}px) contrast(105%) brightness(0.96)`,
                }
              : undefined
          }
        />

        {/* Layer 2: Smart Signer Focus Mask (Keeps center signer and hands crisp while blurring surrounding room) */}
        {isBlurred && smartSignerFocus && (
          <div
            className="absolute inset-0 pointer-events-none overflow-hidden"
            style={{
              maskImage: 'radial-gradient(ellipse 65% 72% at 50% 52%, black 42%, transparent 85%)',
              WebkitMaskImage: 'radial-gradient(ellipse 65% 72% at 50% 52%, black 42%, transparent 85%)',
            }}
          >
            <video
              ref={sharpVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />
          </div>
        )}

        {/* Layer 3: 21-Landmark ASL Skeleton Tracker */}
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className="absolute inset-0 w-full h-full pointer-events-none object-cover"
        />
      </div>
    );
  };

  // Render Background Blur Filter Popover (Google Meet Visual Effects style with 0-80% slider)
  const renderBlurFilterPopover = () => {
    if (!showBlurMenu) return null;

    return (
      <div className="absolute bottom-16 right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 w-88 p-4 rounded-3xl bg-slate-900/95 border border-cyan-400/30 backdrop-blur-2xl shadow-2xl z-50 text-slate-100 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <div>
              <span className="text-xs font-bold text-white block">Google Meet Visual Effects</span>
              <span className="text-[10px] text-slate-400">Background Blur & Signer Privacy</span>
            </div>
          </div>
          <button
            onClick={() => setShowBlurMenu(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Google Meet Presets */}
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
            <span>Meet Presets</span>
            <span className="text-[10px] font-mono text-cyan-300 font-bold">
              {backgroundBlur === 'off' ? 'Off' : `${currentBlurPercentage}% Blur`}
            </span>
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {blurPresets.map((preset) => {
              const isActive =
                (preset.percent === 0 && backgroundBlur === 'off') ||
                (preset.percent > 0 && Math.abs(currentBlurPercentage - preset.percent) <= 12 && backgroundBlur !== 'off');
              return (
                <button
                  key={preset.mode}
                  onClick={() => handleSelectBlurPercent(preset.percent)}
                  className={`py-2 px-1.5 rounded-xl text-[10px] font-bold text-center transition-all flex flex-col items-center gap-0.5 ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-blue-500/30 border border-cyan-400/40'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-white/10'
                  }`}
                  title={preset.desc}
                >
                  <span>{preset.label}</span>
                  <span className="text-[9px] opacity-75 font-mono">{preset.percent}%</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Blur Slider (0% to 80%) */}
        <div className="space-y-2 p-3 rounded-2xl bg-white/[0.04] border border-white/10">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-200 font-semibold flex items-center gap-1.5">
              <Aperture className="w-3.5 h-3.5 text-cyan-400" />
              Blur Level (0% - 80%)
            </span>
            <span className="font-mono text-cyan-300 font-bold px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-400/30">
              {currentBlurPercentage}%
            </span>
          </div>

          <input
            type="range"
            min="0"
            max="80"
            step="1"
            value={currentBlurPercentage}
            onChange={(e) => handleSelectBlurPercent(parseInt(e.target.value, 10))}
            className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
          />

          <div className="flex justify-between text-[9px] font-mono text-slate-400">
            <span>0% (Off)</span>
            <span>25% (Slight)</span>
            <span>50% (Standard)</span>
            <span className="text-cyan-400 font-bold">80% (Max)</span>
          </div>
        </div>

        {/* Smart Signer Bokeh Toggle */}
        <div className="pt-2 border-t border-white/10 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-[11px] font-semibold text-white flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Smart Signer Bokeh</span>
            </div>
            <p className="text-[9px] text-slate-400">
              Keeps hands and face crisp for ASL recognition while blurring background
            </p>
          </div>
          <button
            onClick={() => setSmartSignerFocus(!smartSignerFocus)}
            className={`px-3 py-1 rounded-xl text-[10px] font-bold transition-all ${
              smartSignerFocus
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30'
                : 'bg-white/10 text-slate-400 border border-white/10'
            }`}
          >
            {smartSignerFocus ? 'ACTIVE' : 'OFF'}
          </button>
        </div>
      </div>
    );
  };

  // If "none", display standard full camera canvas
  if (layout === 'none') {
    return (
      <div className="relative w-full h-full min-h-[420px] rounded-3xl overflow-hidden bg-black/40 border border-white/10 backdrop-blur-xl flex items-center justify-center shadow-2xl shadow-black/40">
        {isCameraActive ? (
          <>
            {renderVideoFeed(640, 480)}

            {/* Quick Blur & Tracking Controls (Top Right) */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
              {/* 2 Buttons to Turn Off and On Tracking Display */}
              <div className="flex items-center p-0.5 rounded-xl bg-slate-900/90 border border-white/15 backdrop-blur-md shadow-xl">
                <button
                  id="btn-turn-on-tracking-fullscreen"
                  onClick={() => handleSetTrackingDisplay(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    isTrackingDisplayOn
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md border border-emerald-400/50'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Turn On Tracking Display (Hands & Face Mesh)"
                >
                  <Eye className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Turn On Tracking Display</span>
                </button>

                <button
                  id="btn-turn-off-tracking-fullscreen"
                  onClick={() => handleSetTrackingDisplay(false)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    !isTrackingDisplayOn
                      ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-md border border-rose-400/50'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Turn Off Tracking Display (Clean View)"
                >
                  <EyeOff className="w-3.5 h-3.5 text-rose-300" />
                  <span>Turn Off Tracking Display</span>
                </button>
              </div>

              <button
                onClick={() => setShowBlurMenu(!showBlurMenu)}
                className={`px-3 py-1.5 rounded-xl backdrop-blur-md text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md ${
                  backgroundBlur !== 'off'
                    ? 'bg-blue-600/85 text-white border border-blue-400/40 shadow-blue-500/20'
                    : 'bg-black/60 text-slate-300 hover:text-white border border-white/15'
                }`}
              >
                <Aperture className="w-3.5 h-3.5 text-cyan-300" />
                <span>Blur: {backgroundBlur !== 'off' ? `${backgroundBlurRadius}px` : 'Off'}</span>
              </button>

              {/* Blur Popover */}
              {renderBlurFilterPopover()}
            </div>
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
              Enable your camera to start real-time 21-landmark hand gesture recognition with background blur and sign translation.
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
          {backgroundBlur !== 'off' && (
            <span className="text-xs text-cyan-300 font-semibold flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-500/15 border border-blue-400/30 backdrop-blur-md">
              <Aperture className="w-3.5 h-3.5 text-cyan-400" />
              Blur Filter Active ({backgroundBlurRadius}px)
            </span>
          )}

          <span className="text-xs text-blue-300 font-semibold flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-500/15 border border-blue-400/30 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            SignBridge Active
          </span>
        </div>
      </div>

      {/* Simulated Video Tiles Stage */}
      <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 gap-4 relative overflow-hidden bg-transparent">
        {/* Tile 1: User's Live Sign Camera Feed */}
        <div className="relative rounded-2xl overflow-hidden bg-white/[0.03] border-2 border-blue-400/60 shadow-xl flex items-center justify-center backdrop-blur-md">
          {isCameraActive ? (
            <>
              {renderVideoFeed(480, 320)}

              {/* 2 Buttons to Turn Off and On the Tracking Display in the Camera */}
              <div className="absolute top-2.5 right-2.5 z-30 flex items-center p-0.5 rounded-xl bg-slate-900/90 border border-white/15 backdrop-blur-md shadow-xl">
                <button
                  id="btn-turn-on-tracking-tile"
                  onClick={() => handleSetTrackingDisplay(true)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    isTrackingDisplayOn
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md border border-emerald-400/50'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Turn On Tracking Display (Hands & Face Landmarks Overlay)"
                >
                  <Eye className="w-3 h-3 text-emerald-300" />
                  <span>Turn On Tracking Display</span>
                </button>

                <button
                  id="btn-turn-off-tracking-tile"
                  onClick={() => handleSetTrackingDisplay(false)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    !isTrackingDisplayOn
                      ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-md border border-rose-400/50'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Turn Off Tracking Display (Clean Camera View)"
                >
                  <EyeOff className="w-3 h-3 text-rose-300" />
                  <span>Turn Off Tracking Display</span>
                </button>
              </div>

              {/* Background Blur Status Pill */}
              {backgroundBlur !== 'off' && (
                <div className="absolute top-12 right-2.5 z-20 px-2.5 py-1 rounded-lg bg-blue-950/85 border border-blue-400/40 text-[10px] font-mono text-cyan-300 font-bold backdrop-blur-md shadow-md flex items-center gap-1">
                  <Aperture className="w-3 h-3 text-cyan-400" />
                  <span>Blur: {backgroundBlurRadius}px</span>
                </div>
              )}
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
          <div className="absolute bottom-2.5 left-2.5 px-3 py-1 rounded-xl bg-[#0F172A]/85 backdrop-blur-md border border-white/15 text-xs font-semibold text-white flex items-center gap-1.5 shadow-lg z-20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            You (Active ASL Signer)
          </div>

          {/* Gesture Confidence Tag */}
          {currentGesture?.name && currentGesture.name !== 'UNKNOWN' && (
            <div className="absolute top-2.5 left-2.5 z-20 px-2.5 py-1 rounded-lg bg-blue-950/85 border border-blue-400/40 text-[11px] font-mono text-cyan-300 font-bold backdrop-blur-md shadow-md">
              HUD: {currentGesture.name}
            </div>
          )}

          {/* Face Tracking & Emotion Tag */}
          {showFaceMesh && isCameraActive && (
            <div
              className={`absolute top-10 left-2.5 z-20 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold backdrop-blur-md shadow-md flex items-center gap-1.5 ${
                faceLandmarks && faceLandmarks.length >= 10
                  ? 'bg-emerald-950/90 border border-emerald-400/40 text-emerald-300'
                  : 'bg-amber-950/90 border border-amber-400/40 text-amber-300'
              }`}
            >
              {faceLandmarks && faceLandmarks.length >= 10 ? (
                <>
                  <Smile className="w-3 h-3 text-emerald-400" />
                  <span>
                    Face Tracked: {detectedEmotion?.emotion || 'Attentive'} (
                    {Math.round((detectedEmotion?.confidence || 0.88) * 100)}%)
                  </span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>Scanning for face in feed...</span>
                </>
              )}
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
      <div className="relative flex items-center justify-between px-6 py-3.5 bg-white/[0.04] border-t border-white/10 backdrop-blur-md z-20">
        <div className="text-xs font-mono text-slate-400">
          10:24 AM | Sprint Meeting
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-center">
          {/* 2 Buttons to Turn Off and On Tracking Display */}
          <div className="flex items-center p-0.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
            <button
              id="btn-turn-on-tracking-toolbar"
              onClick={() => handleSetTrackingDisplay(true)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isTrackingDisplayOn
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/25 border border-emerald-400/40'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Turn On Tracking Display (Show Hand Skeleton & Face Mesh)"
            >
              <Eye className="w-4 h-4 text-emerald-300" />
              <span className="hidden md:inline">Turn On Tracking</span>
            </button>

            <button
              id="btn-turn-off-tracking-toolbar"
              onClick={() => handleSetTrackingDisplay(false)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                !isTrackingDisplayOn
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-500/25 border border-rose-400/40'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Turn Off Tracking Display (Clean Camera Feed)"
            >
              <EyeOff className="w-4 h-4 text-rose-300" />
              <span className="hidden md:inline">Turn Off Tracking</span>
            </button>
          </div>

          {/* Camera Button */}
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

          {/* Background Blur Filter Toggle Button */}
          <div className="relative">
            <button
              onClick={() => setShowBlurMenu(!showBlurMenu)}
              className={`p-3 rounded-2xl backdrop-blur-md transition-all flex items-center gap-1.5 ${
                backgroundBlur !== 'off'
                  ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/25 border border-cyan-400/40'
                  : 'bg-white/10 text-slate-200 hover:bg-white/15 border border-white/10'
              }`}
              title="Apply Visual Effects (Google Meet Background Blur up to 80%)"
            >
              <Sparkles className="w-4 h-4" />
              {backgroundBlur !== 'off' && (
                <span className="text-[10px] font-bold font-mono px-1 py-0.2 bg-black/40 rounded">
                  {currentBlurPercentage}%
                </span>
              )}
            </button>

            {/* Popover Menu */}
            {renderBlurFilterPopover()}
          </div>

          {/* Screen Share Button */}
          <button
            onClick={onToggleScreenShare}
            className="p-3 rounded-2xl bg-white/10 text-slate-200 hover:bg-white/15 border border-white/10 backdrop-blur-md transition-all"
            title="Present Screen"
          >
            <Monitor className="w-4 h-4" />
          </button>

          {/* Raise Hand Button */}
          <button
            className="p-3 rounded-2xl bg-white/10 text-slate-200 hover:bg-white/15 border border-white/10 backdrop-blur-md transition-all"
            title="Raise Hand"
          >
            <Hand className="w-4 h-4" />
          </button>

          {/* Leave Call Button */}
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
