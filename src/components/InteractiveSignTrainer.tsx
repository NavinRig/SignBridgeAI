import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Volume2,
  VolumeX,
  Layers,
  Camera,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Trophy,
  Award,
  Zap,
  Eye,
  Sliders,
  Check,
  ChevronRight,
  Hand,
  HelpCircle,
  Maximize2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { HandLandmark, HandednessMode, LandmarkMatchResult, DetectedGesture } from '../types';
import { SIGN_DICTIONARY, SignDefinition } from '../data/signDictionary';
import {
  evaluateLandmarkMatch,
  getReferencePose,
  ReferencePose,
  CANONICAL_REFERENCE_POSES,
} from '../services/landmarkMatcher';
import { audioEngine } from '../services/audioEngine';
import { hapticService } from '../services/hapticService';

interface InteractiveSignTrainerProps {
  currentSign: SignDefinition;
  userLandmarks: HandLandmark[];
  detectedGesture: DetectedGesture | null;
  videoStream: MediaStream | null;
  isCameraActive: boolean;
  initialMasteredSigns?: Record<string, boolean>;
  onSignMastered?: (signId: string, signName: string, score: number) => void;
  onToggleCamera: () => void;
  onSelectSign: (sign: SignDefinition) => void;
  onClose: () => void;
}

// Landmark bone connections for standard 21-point hand skeleton
const HAND_CONNECTIONS: [number, number][] = [
  // Palm base
  [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // Index
  [0, 9], [9, 10], [10, 11], [11, 12], // Middle
  [0, 13], [13, 14], [14, 15], [15, 16], // Ring
  [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
  // Palm knuckle connectors
  [5, 9], [9, 13], [13, 17],
];

export const InteractiveSignTrainer: React.FC<InteractiveSignTrainerProps> = ({
  currentSign,
  userLandmarks,
  detectedGesture,
  videoStream,
  isCameraActive,
  initialMasteredSigns,
  onSignMastered,
  onToggleCamera,
  onSelectSign,
  onClose,
}) => {
  // Handedness support (Right, Left, Auto)
  const [handednessMode, setHandednessMode] = useState<HandednessMode>('Right');
  const [viewMode, setViewMode] = useState<'split' | 'ghost_overlay'>('split');
  const [voiceGuidance, setVoiceGuidance] = useState<boolean>(true);
  const [showGhostOnCamera, setShowGhostOnCamera] = useState<boolean>(true);
  const [masteredSigns, setMasteredSigns] = useState<Record<string, boolean>>(initialMasteredSigns || {});
  const [streakCount, setStreakCount] = useState<number>(0);
  const [holdProgress, setHoldProgress] = useState<number>(0); // 0 to 100%
  const [isSignMastered, setIsSignMastered] = useState<boolean>(false);
  const [selectedJointIdx, setSelectedJointIdx] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const holdStartTimeRef = useRef<number | null>(null);
  const lastSpokenFeedbackRef = useRef<{ text: string; time: number }>({ text: '', time: 0 });

  // Attach video stream to local preview element
  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
      videoRef.current.play().catch(() => {});
    }
  }, [videoStream, isCameraActive]);

  // Detected handedness from camera or fallback
  const effectiveDetectedHandedness = detectedGesture?.handedness || 'Right';

  // Evaluate real-time landmark matching
  const matchResult: LandmarkMatchResult = useMemo(() => {
    return evaluateLandmarkMatch(
      userLandmarks,
      effectiveDetectedHandedness,
      currentSign.id,
      handednessMode
    );
  }, [userLandmarks, effectiveDetectedHandedness, currentSign.id, handednessMode]);

  const targetPose: ReferencePose = useMemo(() => {
    return getReferencePose(currentSign.id);
  }, [currentSign.id]);

  // Active handedness for rendering reference models (Left hand mirrors X coords)
  const effectiveHand: 'Left' | 'Right' =
    handednessMode === 'Auto' ? effectiveDetectedHandedness : handednessMode;

  // Hold-to-Master Progression Logic (hold for 1.5 seconds with >= 78% accuracy)
  useEffect(() => {
    if (isSignMastered) return;

    if (matchResult.isMatched && isCameraActive && userLandmarks.length >= 21) {
      const now = Date.now();
      if (!holdStartTimeRef.current) {
        holdStartTimeRef.current = now;
      }

      const elapsed = now - holdStartTimeRef.current;
      const targetHoldMs = 1500;
      const progress = Math.min(100, Math.round((elapsed / targetHoldMs) * 100));
      setHoldProgress(progress);

      // Subtle haptic tick as hold progresses
      if (progress === 25 || progress === 50 || progress === 75) {
        hapticService.trigger('light');
      }

      // Mastery reached!
      if (elapsed >= targetHoldMs) {
        setIsSignMastered(true);
        setMasteredSigns((prev) => ({ ...prev, [currentSign.id]: true }));
        setStreakCount((prev) => prev + 1);
        if (onSignMastered) {
          onSignMastered(currentSign.id, currentSign.name, matchResult.overallScore);
        }
        hapticService.trigger('success');
        audioEngine.playChime();

        if (voiceGuidance) {
          audioEngine.speak(`Excellent! ${currentSign.name} mastered.`);
        }

        try {
          confetti({
            particleCount: 60,
            spread: 70,
            origin: { y: 0.6 },
          });
        } catch (e) {}
      }
    } else {
      holdStartTimeRef.current = null;
      setHoldProgress(0);
    }
  }, [matchResult.isMatched, isCameraActive, userLandmarks, currentSign.id, isSignMastered, voiceGuidance]);

  // Reset mastery state when switching signs
  useEffect(() => {
    setIsSignMastered(false);
    setHoldProgress(0);
    holdStartTimeRef.current = null;
  }, [currentSign.id]);

  // Voice Guidance (coaching tips spoken periodically if enabled)
  useEffect(() => {
    if (!voiceGuidance || !isCameraActive || userLandmarks.length < 21) return;

    const now = Date.now();
    if (now - lastSpokenFeedbackRef.current.time > 5000) {
      if (matchResult.correctiveFeedback.length > 0) {
        const topFeedback = matchResult.correctiveFeedback[0];
        if (topFeedback !== lastSpokenFeedbackRef.current.text && !topFeedback.includes('🌟')) {
          lastSpokenFeedbackRef.current = { text: topFeedback, time: now };
          audioEngine.speak(topFeedback);
        }
      }
    }
  }, [matchResult.correctiveFeedback, voiceGuidance, isCameraActive, userLandmarks]);

  // Sign Navigation helpers
  const currentIndex = SIGN_DICTIONARY.findIndex((s) => s.id === currentSign.id);
  const prevSign = currentIndex > 0 ? SIGN_DICTIONARY[currentIndex - 1] : null;
  const nextSign = currentIndex < SIGN_DICTIONARY.length - 1 ? SIGN_DICTIONARY[currentIndex + 1] : null;

  // Helper to get mirrored X for Left hand in SVG rendering
  const getRenderX = (normX: number, isMirrored: boolean, width = 360) => {
    const finalX = isMirrored ? 1 - normX : normX;
    return finalX * width;
  };

  const getRenderY = (normY: number, height = 360) => {
    return normY * height;
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/90 text-white rounded-3xl border border-white/10 backdrop-blur-2xl shadow-2xl overflow-hidden animate-in fade-in duration-300">
      {/* Top Studio Control Bar */}
      <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 bg-white/[0.03]">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Dictionary</span>
          </button>

          <div className="h-4 w-px bg-white/15" />

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white font-mono flex items-center gap-2">
                {currentSign.name}
              </h2>
              {masteredSigns[currentSign.id] && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Mastered
                </span>
              )}
            </div>
            <p className="text-xs text-blue-300">"{currentSign.englishMeaning}"</p>
          </div>
        </div>

        {/* Handedness Switcher & Studio Tools */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Hand Selector: Right / Left / Auto */}
          <div className="flex items-center p-1 rounded-xl bg-white/[0.06] border border-white/10 backdrop-blur-md">
            <button
              onClick={() => {
                setHandednessMode('Right');
                hapticService.trigger('light');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                handednessMode === 'Right'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 border border-blue-400/30'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Train with dominant Right Hand"
            >
              <Hand className="w-3.5 h-3.5" />
              <span>Right Hand</span>
            </button>

            <button
              onClick={() => {
                setHandednessMode('Left');
                hapticService.trigger('light');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                handednessMode === 'Left'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30 border border-indigo-400/30'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Train with Left Hand (Mirrored canonical model)"
            >
              <Hand className="w-3.5 h-3.5 scale-x-[-1]" />
              <span>Left Hand</span>
            </button>

            <button
              onClick={() => {
                setHandednessMode('Auto');
                hapticService.trigger('light');
              }}
              className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                handednessMode === 'Auto'
                  ? 'bg-white/20 text-white border border-white/20'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Auto-detect active signing hand from camera"
            >
              <Zap className="w-3 h-3 text-amber-400" />
              <span>Auto</span>
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center p-1 rounded-xl bg-white/[0.06] border border-white/10">
            <button
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'split' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Side-by-Side
            </button>
            <button
              onClick={() => setViewMode('ghost_overlay')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'ghost_overlay' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Ghost Match
            </button>
          </div>

          {/* Voice Coach Toggle */}
          <button
            onClick={() => {
              setVoiceGuidance(!voiceGuidance);
              hapticService.trigger('light');
            }}
            className={`p-2 rounded-xl border transition-all ${
              voiceGuidance
                ? 'bg-blue-500/20 text-blue-300 border-blue-400/30'
                : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
            }`}
            title={voiceGuidance ? 'Voice guidance on' : 'Voice guidance muted'}
          >
            {voiceGuidance ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Streak Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-300 text-xs font-bold">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>{streakCount} Streak</span>
          </div>
        </div>
      </div>

      {/* Main Training Workspace */}
      <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-y-auto min-h-0">
        {/* Left Column: Visual Hand Landmark Studio (7 Cols on desktop) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          {viewMode === 'split' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 min-h-[340px]">
              {/* Reference 3D Target Skeleton */}
              <div className="relative rounded-2xl bg-slate-900/80 border border-blue-500/30 overflow-hidden flex flex-col items-center justify-between p-3.5 shadow-lg">
                <div className="w-full flex items-center justify-between text-xs">
                  <span className="font-bold text-blue-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    Target Model ({effectiveHand} Hand)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-[10px] font-mono text-blue-200 border border-blue-400/20">
                    21 Landmark Reference
                  </span>
                </div>

                {/* SVG 3D-styled Skeleton */}
                <div className="relative w-full aspect-square max-w-[280px] my-auto flex items-center justify-center">
                  <svg viewBox="0 0 360 360" className="w-full h-full drop-shadow-2xl">
                    <defs>
                      <linearGradient id="boneGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#38bdf8" />
                        <stop offset="100%" stopColor="#6366f1" />
                      </linearGradient>
                      <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity="1" />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                      </radialGradient>
                    </defs>

                    {/* Target Palm Center Disc */}
                    <circle
                      cx={getRenderX(0.5, effectiveHand === 'Left', 360)}
                      cy={getRenderY(0.66, 360)}
                      r="40"
                      fill="rgba(56, 189, 248, 0.06)"
                      stroke="rgba(56, 189, 248, 0.2)"
                      strokeDasharray="4 4"
                    />

                    {/* Bones */}
                    {HAND_CONNECTIONS.map(([p1, p2], idx) => {
                      const pt1 = targetPose.landmarks[p1];
                      const pt2 = targetPose.landmarks[p2];
                      if (!pt1 || !pt2) return null;
                      const x1 = getRenderX(pt1.x, effectiveHand === 'Left', 360);
                      const y1 = getRenderY(pt1.y, 360);
                      const x2 = getRenderX(pt2.x, effectiveHand === 'Left', 360);
                      const y2 = getRenderY(pt2.y, 360);

                      return (
                        <line
                          key={`target-bone-${idx}`}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke="url(#boneGrad)"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                        />
                      );
                    })}

                    {/* Landmark Nodes */}
                    {targetPose.landmarks.map((pt, idx) => {
                      const cx = getRenderX(pt.x, effectiveHand === 'Left', 360);
                      const cy = getRenderY(pt.y, 360);
                      const isTip = [4, 8, 12, 16, 20].includes(idx);
                      const isWrist = idx === 0;
                      const isSelected = selectedJointIdx === idx;

                      return (
                        <g key={`target-node-${idx}`} className="cursor-pointer" onClick={() => setSelectedJointIdx(idx)}>
                          {isTip && (
                            <circle cx={cx} cy={cy} r="14" fill="url(#nodeGlow)" opacity="0.4" />
                          )}
                          <circle
                            cx={cx}
                            cy={cy}
                            r={isSelected ? '7' : isTip ? '5.5' : isWrist ? '6' : '4'}
                            fill={isSelected ? '#f43f5e' : isTip ? '#22d3ee' : isWrist ? '#a855f7' : '#818cf8'}
                            stroke="#ffffff"
                            strokeWidth={isSelected ? '2.5' : '1.5'}
                            className="transition-all hover:scale-125"
                          />
                        </g>
                      );
                    })}
                  </svg>

                  {/* Mirrored Hand Indicator Tag */}
                  {effectiveHand === 'Left' && (
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-400/30 text-[10px] font-mono text-indigo-300">
                      Left Hand Mirrored Model
                    </div>
                  )}
                </div>

                <div className="w-full text-center text-[11px] text-slate-400 bg-white/[0.04] p-2 rounded-xl border border-white/5">
                  {currentSign.description}
                </div>
              </div>

              {/* Real-time User Camera Feed with Skeleton Overlay */}
              <div className="relative rounded-2xl bg-black border border-white/15 overflow-hidden flex flex-col justify-between shadow-lg">
                {/* Live Video */}
                {isCameraActive ? (
                  <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                    <video
                      ref={videoRef}
                      className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                      autoPlay
                      playsInline
                      muted
                    />

                    {/* User Hand Landmark Skeleton Canvas */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none scale-x-[-1]" viewBox="0 0 640 480">
                      {/* If user landmarks exist, render bones with dynamic color-coding */}
                      {userLandmarks.length >= 21 && (
                        <>
                          {HAND_CONNECTIONS.map(([p1, p2], idx) => {
                            const pt1 = userLandmarks[p1];
                            const pt2 = userLandmarks[p2];
                            const err1 = matchResult.keypointErrors[p1] || 0;
                            const err2 = matchResult.keypointErrors[p2] || 0;
                            const avgErr = (err1 + err2) / 2;

                            // Color: Green if aligned (<0.28), Yellow if fair (<0.45), Red if high error
                            const strokeColor =
                              avgErr < 0.28 ? '#10b981' : avgErr < 0.45 ? '#f59e0b' : '#ef4444';

                            return (
                              <line
                                key={`user-bone-${idx}`}
                                x1={pt1.x * 640}
                                y1={pt1.y * 480}
                                x2={pt2.x * 640}
                                y2={pt2.y * 480}
                                stroke={strokeColor}
                                strokeWidth="4"
                                strokeLinecap="round"
                                opacity="0.85"
                              />
                            );
                          })}

                          {/* Nodes */}
                          {userLandmarks.map((pt, idx) => {
                            const err = matchResult.keypointErrors[idx] || 0;
                            const nodeColor =
                              err < 0.28 ? '#34d399' : err < 0.45 ? '#fbbf24' : '#f87171';
                            const isTip = [4, 8, 12, 16, 20].includes(idx);

                            return (
                              <circle
                                key={`user-node-${idx}`}
                                cx={pt.x * 640}
                                cy={pt.y * 480}
                                r={isTip ? '6' : '4'}
                                fill={nodeColor}
                                stroke="#ffffff"
                                strokeWidth="1.5"
                              />
                            );
                          })}
                        </>
                      )}
                    </svg>

                    {/* Top Live Badge */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-mono text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      LIVE CAMERA ({effectiveDetectedHandedness} Hand)
                    </div>

                    {/* Accuracy Float Tag */}
                    <div className="absolute top-3 right-3 px-3 py-1 rounded-xl bg-black/70 backdrop-blur-md border border-white/15 text-xs font-bold">
                      <span
                        className={
                          matchResult.overallScore >= 78
                            ? 'text-emerald-400'
                            : matchResult.overallScore >= 50
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }
                      >
                        {matchResult.overallScore}% MATCH
                      </span>
                    </div>

                    {/* No Hand Warning if camera is active but no hand in frame */}
                    {userLandmarks.length < 21 && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] text-center">
                        <Hand className="w-10 h-10 text-cyan-400 animate-pulse mb-2" />
                        <div className="text-xs font-bold text-white">Position hand in camera frame</div>
                        <p className="text-[11px] text-slate-300 max-w-xs mt-0.5">
                          Hold your hand steady facing the webcam to begin real-time landmark matching.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-900/60">
                    <Camera className="w-12 h-12 text-slate-500 mb-3" />
                    <div className="text-sm font-bold text-white">Camera is currently inactive</div>
                    <p className="text-xs text-slate-400 max-w-xs mt-1 mb-4">
                      Enable your camera to test your hand sign accuracy against the AI reference model.
                    </p>
                    <button
                      onClick={onToggleCamera}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/25 border border-blue-400/30 transition-all"
                    >
                      <Camera className="w-4 h-4" />
                      Start Camera Practice
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Ghost Overlay Mode: User camera with target skeleton overlayed directly */
            <div className="relative rounded-2xl bg-black border border-blue-500/40 overflow-hidden flex-1 min-h-[380px] shadow-2xl flex items-center justify-center">
              {isCameraActive ? (
                <div className="relative w-full h-full">
                  <video
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                    autoPlay
                    playsInline
                    muted
                  />

                  {/* SVG Layer: Ghost Target Skeleton + User Live Skeleton */}
                  <svg className="absolute inset-0 w-full h-full scale-x-[-1]" viewBox="0 0 640 480">
                    {/* Ghost Target Alignment Guide (Cyan Dash) */}
                    {showGhostOnCamera && (
                      <g opacity="0.5">
                        {HAND_CONNECTIONS.map(([p1, p2], idx) => {
                          const pt1 = targetPose.landmarks[p1];
                          const pt2 = targetPose.landmarks[p2];
                          if (!pt1 || !pt2) return null;
                          const x1 = getRenderX(pt1.x, effectiveHand === 'Left', 640);
                          const y1 = getRenderY(pt1.y, 480);
                          const x2 = getRenderX(pt2.x, effectiveHand === 'Left', 640);
                          const y2 = getRenderY(pt2.y, 480);

                          return (
                            <line
                              key={`ghost-bone-${idx}`}
                              x1={x1}
                              y1={y1}
                              x2={x2}
                              y2={y2}
                              stroke="#00f2fe"
                              strokeWidth="5"
                              strokeDasharray="6 4"
                              strokeLinecap="round"
                            />
                          );
                        })}
                      </g>
                    )}

                    {/* User live skeleton */}
                    {userLandmarks.length >= 21 &&
                      HAND_CONNECTIONS.map(([p1, p2], idx) => {
                        const pt1 = userLandmarks[p1];
                        const pt2 = userLandmarks[p2];
                        const avgErr = ((matchResult.keypointErrors[p1] || 0) + (matchResult.keypointErrors[p2] || 0)) / 2;
                        const strokeColor = avgErr < 0.28 ? '#10b981' : avgErr < 0.45 ? '#f59e0b' : '#ef4444';

                        return (
                          <line
                            key={`ghost-user-bone-${idx}`}
                            x1={pt1.x * 640}
                            y1={pt1.y * 480}
                            x2={pt2.x * 640}
                            y2={pt2.y * 480}
                            stroke={strokeColor}
                            strokeWidth="4"
                            strokeLinecap="round"
                          />
                        );
                      })}
                  </svg>

                  {/* Overlay Controls */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <button
                      onClick={() => setShowGhostOnCamera(!showGhostOnCamera)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-md border flex items-center gap-1.5 transition-all ${
                        showGhostOnCamera
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40'
                          : 'bg-black/60 text-slate-400 border-white/10'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      {showGhostOnCamera ? 'Ghost Silhouette ON' : 'Ghost Silhouette OFF'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center p-6">
                  <Camera className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                  <button
                    onClick={onToggleCamera}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                  >
                    Start Camera for Ghost Fit
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Real-time Dynamic Diagnostic Feedback Banner */}
          <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  matchResult.overallScore >= 78
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                    : matchResult.overallScore >= 50
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                    : 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                }`}
              >
                <Zap className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider font-mono text-slate-400">
                  AI Real-Time Coach Guidance
                </div>
                <div className="text-xs font-semibold text-white truncate">
                  {matchResult.correctiveFeedback[0] || 'Align your hand with the reference pose.'}
                </div>
              </div>
            </div>

            {/* Quick Audio Repeat */}
            <button
              onClick={() => {
                if (matchResult.correctiveFeedback.length > 0) {
                  audioEngine.speak(matchResult.correctiveFeedback[0]);
                }
              }}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 shrink-0"
              title="Repeat verbal coaching tip"
            >
              <Volume2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Column: Precision Analytics & Hold-to-Master HUD (5 Cols on desktop) */}
        <div className="lg:col-span-5 flex flex-col gap-3.5">
          {/* Overall Match Circle Gauge & Hold Timer */}
          <div className="p-5 rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/10 backdrop-blur-xl flex flex-col items-center justify-center text-center relative overflow-hidden shadow-xl">
            {/* Background Glow */}
            <div
              className={`absolute -top-10 -right-10 w-36 h-36 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
                matchResult.overallScore >= 78
                  ? 'bg-emerald-500/30'
                  : matchResult.overallScore >= 50
                  ? 'bg-amber-500/20'
                  : 'bg-blue-500/20'
              }`}
            />

            {/* Circular Progress Gauge */}
            <div className="relative w-32 h-32 flex items-center justify-center mb-3">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                {/* Background Ring */}
                <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />

                {/* Score Ring */}
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke={
                    matchResult.overallScore >= 78
                      ? '#10b981'
                      : matchResult.overallScore >= 50
                      ? '#f59e0b'
                      : '#3b82f6'
                  }
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={314}
                  strokeDashoffset={314 - (314 * matchResult.overallScore) / 100}
                  className="transition-all duration-300"
                />

                {/* Hold to Master Ring (Glowing Outer Arc) */}
                {holdProgress > 0 && !isSignMastered && (
                  <circle
                    cx="60"
                    cy="60"
                    r="56"
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={351}
                    strokeDashoffset={351 - (351 * holdProgress) / 100}
                    className="transition-all duration-100"
                  />
                )}
              </svg>

              {/* Central Score Text */}
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold text-white font-mono tracking-tight">
                  {matchResult.overallScore}%
                </span>
                <span className="text-[10px] uppercase font-bold text-slate-400">Precision</span>
              </div>
            </div>

            {/* Hold-to-Master Status Banner */}
            {isSignMastered ? (
              <div className="w-full py-2 px-3 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 animate-bounce">
                <Trophy className="w-4 h-4 text-emerald-400" />
                SIGN MASTERED! (+100 PTS)
              </div>
            ) : holdProgress > 0 ? (
              <div className="w-full py-2 px-3 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-bold text-xs flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                HOLDING STEADY: {holdProgress}%
              </div>
            ) : (
              <div className="text-xs text-slate-300 font-medium">
                {matchResult.overallScore >= 78
                  ? 'Keep holding position for 1.5s...'
                  : 'Adjust fingers to reach 78%+ match'}
              </div>
            )}
          </div>

          {/* Per-Finger Precision Metric Breakdown */}
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xl space-y-2.5 shadow-lg">
            <div className="flex items-center justify-between text-xs font-bold text-slate-200">
              <span>Anatomical Digit Breakdown</span>
              <span className="text-[10px] font-mono text-slate-400">Target Requirements</span>
            </div>

            {(['thumb', 'index', 'middle', 'ring', 'pinky'] as const).map((finger) => {
              const acc = matchResult.fingerAccuracies[finger];
              const req = targetPose.fingerRequirements[finger];

              return (
                <div key={finger} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="capitalize text-slate-300 font-medium flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          acc.status === 'perfect'
                            ? 'bg-emerald-400'
                            : acc.status === 'good'
                            ? 'bg-amber-400'
                            : 'bg-rose-400'
                        }`}
                      />
                      {finger} ({req})
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        acc.status === 'perfect'
                          ? 'text-emerald-300'
                          : acc.status === 'good'
                          ? 'text-amber-300'
                          : 'text-rose-300'
                      }`}
                    >
                      {acc.score}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        acc.status === 'perfect'
                          ? 'bg-emerald-500'
                          : acc.status === 'good'
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${acc.score}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Palm Orientation */}
            <div className="pt-1.5 border-t border-white/10 flex items-center justify-between text-[11px]">
              <span className="text-slate-300 font-medium">Palm Facing Angle</span>
              <span className="text-cyan-300 font-mono font-bold">{matchResult.palmOrientationScore}%</span>
            </div>
          </div>

          {/* Stepper Navigation: Next & Previous Sign */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              disabled={!prevSign}
              onClick={() => {
                if (prevSign) {
                  onSelectSign(prevSign);
                  hapticService.trigger('light');
                }
              }}
              className="flex-1 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/10 transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Previous Sign
            </button>

            <button
              onClick={() => {
                if (nextSign) {
                  onSelectSign(nextSign);
                  hapticService.trigger('medium');
                }
              }}
              disabled={!nextSign}
              className="flex-1 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-30 disabled:pointer-events-none text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/25 border border-blue-400/30 transition-all"
            >
              <span>{isSignMastered ? 'Next Sign 🏆' : 'Next Sign'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Sign Carousel Drawer for Fast Switching */}
      <div className="p-3 border-t border-white/10 bg-black/40 flex items-center gap-2 overflow-x-auto scrollbar-none">
        <span className="text-[11px] font-mono uppercase text-slate-400 shrink-0 px-2">
          Curriculum Signs:
        </span>
        {SIGN_DICTIONARY.map((sign) => {
          const isSelected = sign.id === currentSign.id;
          const isDone = masteredSigns[sign.id];

          return (
            <button
              key={sign.id}
              onClick={() => {
                onSelectSign(sign);
                hapticService.trigger('light');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all shrink-0 ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 border border-blue-400/40 ring-1 ring-blue-400'
                  : isDone
                  ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-400/30 hover:bg-emerald-900/40'
                  : 'bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] border border-white/10'
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              )}
              <span>{sign.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
