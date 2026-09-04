import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, FastForward, Sparkles, Volume2, Info } from 'lucide-react';
import { audioEngine } from '../services/audioEngine';
import { hapticService } from '../services/hapticService';

interface SignAvatarProps {
  currentText: string;
  aslGloss?: string;
  gestureSequence?: Array<{
    id: string;
    type: string;
    label: string;
    letters?: string[];
    durationMs: number;
    nonManualMarker?: string;
    description?: string;
  }>;
  onSignComplete?: () => void;
  compact?: boolean;
}

export const SignAvatar: React.FC<SignAvatarProps> = ({
  currentText,
  aslGloss,
  gestureSequence,
  onSignComplete,
  compact = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [currentLetter, setCurrentLetter] = useState<string>('');
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // Default fallback sequence if none provided
  const activeSequence = gestureSequence && gestureSequence.length > 0
    ? gestureSequence
    : [
        {
          id: 'seq-1',
          type: 'sign',
          label: 'HELLO',
          durationMs: 1200,
          nonManualMarker: 'smile',
          description: 'Open hand wave from temple'
        },
        {
          id: 'seq-2',
          type: 'sign',
          label: 'NICE-TO-MEET-YOU',
          durationMs: 1600,
          nonManualMarker: 'neutral',
          description: 'Hands meet in greeting'
        },
        {
          id: 'seq-3',
          type: 'sign',
          label: 'THANK-YOU',
          durationMs: 1300,
          nonManualMarker: 'head_nod',
          description: 'Hand from chin forward'
        }
      ];

  const currentGesture = activeSequence[currentIndex] || activeSequence[0];

  useEffect(() => {
    setCurrentIndex(0);
    startTimeRef.current = Date.now();
    setIsPlaying(true);
  }, [currentText, gestureSequence]);

  // Main canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let progress = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Background subtle gradient
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#090d16');
      bgGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Render Avatar Head & Torso outline
      const centerX = width / 2;
      const centerY = height * 0.42;

      // Facial / Head expression based on nonManualMarker
      const marker = currentGesture?.nonManualMarker || 'neutral';
      let eyebrowOffset = 0;
      let mouthSmile = 0;
      let headTilt = 0;

      if (marker.includes('question') || marker.includes('eyebrows_raised')) {
        eyebrowOffset = -6;
      } else if (marker.includes('smile')) {
        mouthSmile = 6;
      } else if (marker.includes('head_nod')) {
        headTilt = Math.sin(Date.now() / 150) * 3;
      }

      // Torso shoulders
      ctx.beginPath();
      ctx.fillStyle = '#1e293b';
      ctx.ellipse(centerX, centerY + 110, 85, 45, 0, 0, Math.PI * 2);
      ctx.fill();

      // Head
      ctx.save();
      ctx.translate(centerX, centerY - 25 + headTilt);

      // Head circle
      ctx.beginPath();
      ctx.arc(0, 0, 36, 0, Math.PI * 2);
      ctx.fillStyle = '#334155';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#64748b';
      ctx.stroke();

      // Eyes
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(-12, -4, 3.5, 0, Math.PI * 2);
      ctx.arc(12, -4, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Eyebrows
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-18, -12 + eyebrowOffset);
      ctx.lineTo(-6, -11 + eyebrowOffset);
      ctx.moveTo(6, -11 + eyebrowOffset);
      ctx.lineTo(18, -12 + eyebrowOffset);
      ctx.stroke();

      // Mouth
      ctx.beginPath();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      if (mouthSmile > 0) {
        ctx.arc(0, 8, 10, 0.2, Math.PI - 0.2);
      } else {
        ctx.moveTo(-8, 12);
        ctx.lineTo(8, 12);
      }
      ctx.stroke();

      ctx.restore();

      // Animated Arm & Hand pose
      const time = (Date.now() - startTimeRef.current) * playbackSpeed;
      const duration = currentGesture?.durationMs || 1000;
      progress = (time % duration) / duration;

      // Calculate hand position based on gesture label
      let handX = centerX + 45;
      let handY = centerY + 30;
      let handAngle = 0;
      const signLabel = currentGesture?.label?.toUpperCase() || 'HELLO';

      if (signLabel.includes('HELLO') || signLabel.includes('WAVE')) {
        handX = centerX + 60 + Math.sin(progress * Math.PI * 4) * 20;
        handY = centerY - 20;
        handAngle = Math.sin(progress * Math.PI * 4) * 0.35;
      } else if (signLabel.includes('THANK') || signLabel.includes('THANKS')) {
        handX = centerX + progress * 40;
        handY = centerY - 5 + progress * 35;
        handAngle = -0.2 + progress * 0.4;
      } else if (signLabel.includes('PLEASE')) {
        handX = centerX + Math.cos(progress * Math.PI * 2) * 22;
        handY = centerY + 40 + Math.sin(progress * Math.PI * 2) * 22;
        handAngle = 0;
      } else if (signLabel.includes('LOVE') || signLabel.includes('ILY')) {
        handX = centerX + 30;
        handY = centerY + 10;
        handAngle = Math.sin(progress * Math.PI * 2) * 0.1;
      } else if (signLabel.includes('HELP')) {
        handX = centerX + 15;
        handY = centerY + 35 - Math.sin(progress * Math.PI) * 20;
      } else if (signLabel.includes('YES') || signLabel.includes('AGREE')) {
        handX = centerX + 40;
        handY = centerY + 20 + Math.sin(progress * Math.PI * 6) * 14;
      } else if (signLabel.includes('NO')) {
        handX = centerX + 35;
        handY = centerY + 20;
        handAngle = Math.sin(progress * Math.PI * 4) * 0.2;
      } else {
        // Default animated pose
        handX = centerX + 40 + Math.sin(progress * Math.PI * 2) * 15;
        handY = centerY + 20 + Math.cos(progress * Math.PI * 2) * 10;
      }

      // Draw Upper Arm & Forearm
      const shoulderX = centerX + 50;
      const shoulderY = centerY + 80;
      const elbowX = (shoulderX + handX) / 2 + 25;
      const elbowY = (shoulderY + handY) / 2 + 15;

      // Arm lines
      ctx.beginPath();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(shoulderX, shoulderY);
      ctx.lineTo(elbowX, elbowY);
      ctx.lineTo(handX, handY);
      ctx.stroke();

      // Arm glow highlight
      ctx.beginPath();
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2;
      ctx.moveTo(shoulderX, shoulderY);
      ctx.lineTo(elbowX, elbowY);
      ctx.lineTo(handX, handY);
      ctx.stroke();

      // Draw Hand & 5 Articulated Fingers
      ctx.save();
      ctx.translate(handX, handY);
      ctx.rotate(handAngle);

      // Palm
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fillStyle = '#6366f1';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#818cf8';
      ctx.stroke();

      // Draw 5 fingers
      const fingerAngles = [-0.65, -0.3, 0, 0.3, 0.65]; // Thumb, Index, Middle, Ring, Pinky
      const fingerLengths = [18, 26, 28, 25, 20];

      fingerAngles.forEach((angle, idx) => {
        let fLen = fingerLengths[idx];
        let curlFactor = 1;

        // Custom finger extension logic based on sign
        if (signLabel.includes('LOVE') || signLabel.includes('ILY')) {
          if (idx === 2 || idx === 3) curlFactor = 0.35; // Fold middle & ring
        } else if (signLabel.includes('PEACE') || signLabel.includes('2')) {
          if (idx === 0 || idx === 3 || idx === 4) curlFactor = 0.35; // Only index & middle
        } else if (signLabel.includes('THUMBS') || signLabel.includes('YES')) {
          if (idx > 0) curlFactor = 0.35; // Only thumb up
        } else if (signLabel.includes('OK') || signLabel.includes('LETTER F')) {
          if (idx === 0 || idx === 1) curlFactor = 0.45; // Pinch circle
        }

        const tipX = Math.sin(angle) * fLen * curlFactor;
        const tipY = -Math.cos(angle) * fLen * curlFactor;

        // Finger bone
        ctx.beginPath();
        ctx.strokeStyle = curlFactor > 0.6 ? '#a5b4fc' : '#4338ca';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.moveTo(Math.sin(angle) * 8, -Math.cos(angle) * 8);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();

        // Fingertip joint glow
        ctx.beginPath();
        ctx.arc(tipX, tipY, 3, 0, Math.PI * 2);
        ctx.fillStyle = curlFactor > 0.6 ? '#38bdf8' : '#6366f1';
        ctx.fill();
      });

      ctx.restore();

      // Step to next gesture in sequence when current gesture duration completes
      if (time >= duration && isPlaying) {
        if (currentIndex < activeSequence.length - 1) {
          setCurrentIndex((prev) => prev + 1);
          startTimeRef.current = Date.now();
          hapticService.trigger('light');
        } else {
          // Finished full sequence
          if (onSignComplete) onSignComplete();
          // Loop or pause
          setCurrentIndex(0);
          startTimeRef.current = Date.now();
        }
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentIndex, isPlaying, playbackSpeed, activeSequence, currentGesture]);

  const handleSpeakCurrent = () => {
    if (currentText) {
      audioEngine.speak(currentText);
      hapticService.trigger('speech_in');
    }
  };

  return (
    <div className={`relative flex flex-col bg-white/[0.05] rounded-3xl border border-white/10 backdrop-blur-xl shadow-2xl shadow-black/30 overflow-hidden ${compact ? 'p-4' : 'p-6'}`}>
      {/* Top Banner with ASL Gloss & Marker */}
      <div className="flex items-center justify-between gap-2 mb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/25 backdrop-blur-md">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Sign Language Avatar (Speech → Sign)
            </div>
            <div className="text-sm font-bold text-white truncate max-w-[240px] font-mono">
              {aslGloss || currentGesture?.label || 'Signing...'}
            </div>
          </div>
        </div>

        {/* Speed and Voice controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPlaybackSpeed((s) => (s === 0.5 ? 1.0 : s === 1.0 ? 1.5 : 0.5))}
            className="px-2.5 py-1 text-xs font-medium rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white transition-all border border-white/10 backdrop-blur-md"
            title="Adjust Signing Speed"
          >
            {playbackSpeed}x
          </button>
          <button
            onClick={handleSpeakCurrent}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-blue-300 transition-all border border-white/10 backdrop-blur-md"
            title="Speak Natural English"
          >
            <Volume2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Vector Avatar Canvas */}
      <div className="relative w-full aspect-4/3 max-h-[260px] rounded-2xl overflow-hidden bg-black/40 border border-white/10 backdrop-blur-md flex items-center justify-center shadow-inner">
        <canvas
          ref={canvasRef}
          width={380}
          height={260}
          className="w-full h-full object-contain"
        />

        {/* Non-manual marker badge overlay */}
        {currentGesture?.nonManualMarker && currentGesture.nonManualMarker !== 'neutral' && (
          <div className="absolute top-2.5 left-2.5 px-3 py-1 rounded-full bg-blue-950/80 border border-blue-400/30 text-[11px] font-medium text-blue-200 flex items-center gap-1.5 backdrop-blur-md shadow-md">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
            Facial Cue: {currentGesture.nonManualMarker.replace('_', ' ')}
          </div>
        )}

        {/* Current Gesture Title & Description Chip */}
        <div className="absolute bottom-2.5 inset-x-2.5 flex items-center justify-between px-3.5 py-2 rounded-xl bg-[#0F172A]/85 border border-white/10 backdrop-blur-md shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-blue-300 font-mono">
              {currentGesture?.label}
            </span>
            <span className="text-[11px] text-slate-300 truncate max-w-[180px]">
              {currentGesture?.description || 'Active sign motion'}
            </span>
          </div>

          <div className="text-[10px] text-slate-400 font-mono">
            {currentIndex + 1}/{activeSequence.length}
          </div>
        </div>
      </div>

      {/* Sequence Timeline scrubber chips */}
      {activeSequence.length > 1 && (
        <div className="flex items-center gap-1.5 mt-3.5 overflow-x-auto pb-1 scrollbar-none">
          {activeSequence.map((item, idx) => (
            <button
              key={item.id || idx}
              onClick={() => {
                setCurrentIndex(idx);
                startTimeRef.current = Date.now();
                hapticService.trigger('light');
              }}
              className={`px-3 py-1 rounded-xl text-xs font-medium whitespace-nowrap backdrop-blur-md transition-all ${
                idx === currentIndex
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 border border-blue-400/40'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/10'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Playback Controls */}
      <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-white/10">
        <div className="text-xs text-slate-300 truncate max-w-[220px]">
          {currentText ? `"${currentText}"` : 'Listening for spoken words...'}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setCurrentIndex(0);
              startTimeRef.current = Date.now();
              hapticService.trigger('light');
            }}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 backdrop-blur-md transition-colors"
            title="Replay sequence"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setIsPlaying(!isPlaying);
              hapticService.trigger('light');
            }}
            className="p-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition-all shadow-md shadow-blue-500/25 border border-blue-400/30"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
