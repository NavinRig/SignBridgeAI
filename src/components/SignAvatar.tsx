import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Volume2,
  Shuffle,
  Smile,
  Search,
  ChevronDown,
  ChevronUp,
  Heart,
  HelpCircle,
  Shield,
  Zap,
  Flame,
  Check,
  Camera,
  UserCheck
} from 'lucide-react';
import { audioEngine } from '../services/audioEngine';
import { hapticService } from '../services/hapticService';
import { AVATAR_EMOTIONS } from '../data/avatarEmotions';
import { AvatarEmotion, EmotionCategory } from '../types';

interface SignAvatarProps {
  currentText?: string;
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
  isCameraActive?: boolean;
  currentGesture?: { name: string; confidence: number; isStable?: boolean } | null;
  detectedEmotion?: { emotion: string; confidence: number; nonManualMarker: string } | null;
  landmarks?: Array<{ x: number; y: number; z: number }>;
  faceLandmarks?: Array<{ x: number; y: number }>;
}

export const SignAvatar: React.FC<SignAvatarProps> = ({
  currentText = '',
  aslGloss,
  gestureSequence,
  onSignComplete,
  compact = false,
  isCameraActive = false,
  currentGesture,
  detectedEmotion,
  landmarks = [],
  faceLandmarks = [],
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [avatarMode, setAvatarMode] = useState<'camera_responsive' | 'manual_explorer'>('camera_responsive');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [activeEmotionIndex, setActiveEmotionIndex] = useState<number>(0);
  const [showLibraryDrawer, setShowLibraryDrawer] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<EmotionCategory | 'all'>('all');
  const [emotionSearch, setEmotionSearch] = useState<string>('');

  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const lastActiveActionTimeRef = useRef<number>(0);

  // If a custom external gesture sequence is passed (e.g. from speech-to-sign input), use that,
  // otherwise default to our 50-emotion library
  const isUsingCustomSequence = Boolean(gestureSequence && gestureSequence.length > 0);

  // Responsive state detection from camera feed
  const isHandGestureActive = Boolean(
    isCameraActive &&
      currentGesture &&
      currentGesture.name &&
      currentGesture.name !== 'UNKNOWN' &&
      currentGesture.name !== 'None' &&
      (currentGesture.confidence ?? 1) >= 0.35
  );

  const isFaceEmotionActive = Boolean(
    isCameraActive &&
      detectedEmotion &&
      detectedEmotion.emotion &&
      detectedEmotion.emotion !== 'Neutral' &&
      detectedEmotion.emotion !== 'Calm' &&
      (detectedEmotion.confidence ?? 1) >= 0.45
  );

  // Map camera hand gesture to 50-emotion library sign
  const mapGestureToSignIndex = (gestureName: string): number => {
    const g = gestureName.toLowerCase();
    if (g.includes('hello') || g.includes('wave')) {
      const idx = AVATAR_EMOTIONS.findIndex((e) => e.aslSign === 'HELLO');
      return idx >= 0 ? idx : 0;
    }
    if (g.includes('thank')) {
      const idx = AVATAR_EMOTIONS.findIndex((e) => e.aslSign === 'THANK YOU');
      return idx >= 0 ? idx : 2;
    }
    if (g.includes('yes') || g.includes('agree')) {
      const idx = AVATAR_EMOTIONS.findIndex((e) => e.aslSign === 'YES');
      return idx >= 0 ? idx : 10;
    }
    if (g.includes('no') || g.includes('disagree')) {
      const idx = AVATAR_EMOTIONS.findIndex((e) => e.aslSign === 'NO');
      return idx >= 0 ? idx : 11;
    }
    if (g.includes('help')) {
      const idx = AVATAR_EMOTIONS.findIndex((e) => e.aslSign === 'HELP');
      return idx >= 0 ? idx : 12;
    }
    if (g.includes('love') || g.includes('ily')) {
      const idx = AVATAR_EMOTIONS.findIndex((e) => e.aslSign === 'I LOVE YOU');
      return idx >= 0 ? idx : 3;
    }
    if (g.includes('peace')) {
      const idx = AVATAR_EMOTIONS.findIndex((e) => e.aslSign === 'PEACE');
      return idx >= 0 ? idx : 21;
    }
    if (g.includes('thumb') || g.includes('ok') || g.includes('good')) {
      const idx = AVATAR_EMOTIONS.findIndex((e) => e.aslSign === 'GOOD');
      return idx >= 0 ? idx : 4;
    }
    if (g.includes('stop') || g.includes('wait')) {
      const idx = AVATAR_EMOTIONS.findIndex((e) => e.aslSign === 'WAIT');
      return idx >= 0 ? idx : 22;
    }
    return 0;
  };

  // Map camera facial emotion to 50-emotion library
  const mapFaceEmotionToIndex = (emotionName: string): number => {
    const e = emotionName.toLowerCase();
    if (e.includes('happy') || e.includes('joy')) {
      const idx = AVATAR_EMOTIONS.findIndex((x) => x.id === 'joy-happy');
      return idx >= 0 ? idx : 0;
    }
    if (e.includes('surpris')) {
      const idx = AVATAR_EMOTIONS.findIndex((x) => x.id === 'inquiry-surprised');
      return idx >= 0 ? idx : 13;
    }
    if (e.includes('inquisitive') || e.includes('curious') || e.includes('wonder')) {
      const idx = AVATAR_EMOTIONS.findIndex((x) => x.id === 'inquiry-curious');
      return idx >= 0 ? idx : 15;
    }
    if (e.includes('focused') || e.includes('attentive')) {
      const idx = AVATAR_EMOTIONS.findIndex((x) => x.id === 'calm-focused');
      return idx >= 0 ? idx : 23;
    }
    if (e.includes('sad') || e.includes('sympathy')) {
      const idx = AVATAR_EMOTIONS.findIndex((x) => x.id === 'empathy-sympathy');
      return idx >= 0 ? idx : 9;
    }
    if (e.includes('excited')) {
      const idx = AVATAR_EMOTIONS.findIndex((x) => x.id === 'joy-excited');
      return idx >= 0 ? idx : 1;
    }
    if (e.includes('grateful')) {
      const idx = AVATAR_EMOTIONS.findIndex((x) => x.id === 'joy-grateful');
      return idx >= 0 ? idx : 2;
    }
    return 0;
  };

  // React to camera hand gesture & facial emotion in camera_responsive mode
  useEffect(() => {
    if (avatarMode !== 'camera_responsive') return;

    if (isHandGestureActive && currentGesture?.name) {
      const mappedIdx = mapGestureToSignIndex(currentGesture.name);
      setActiveEmotionIndex(mappedIdx);
      startTimeRef.current = Date.now();
      lastActiveActionTimeRef.current = Date.now();
    } else if (isFaceEmotionActive && detectedEmotion?.emotion) {
      const mappedIdx = mapFaceEmotionToIndex(detectedEmotion.emotion);
      setActiveEmotionIndex(mappedIdx);
      startTimeRef.current = Date.now();
      lastActiveActionTimeRef.current = Date.now();
    }
  }, [avatarMode, isHandGestureActive, currentGesture?.name, isFaceEmotionActive, detectedEmotion?.emotion]);

  // Is the avatar currently actively responding to camera feed (or in grace hold window)?
  const isRespondingToLiveInput = useMemo(() => {
    if (avatarMode !== 'camera_responsive') return true;
    if (isUsingCustomSequence && isPlaying) return true;
    const now = Date.now();
    const isWithinGracePeriod = now - lastActiveActionTimeRef.current < 2200;
    return (isHandGestureActive || isFaceEmotionActive || isWithinGracePeriod) && isCameraActive;
  }, [avatarMode, isUsingCustomSequence, isPlaying, isHandGestureActive, isFaceEmotionActive, isCameraActive]);

  const currentEmotion: AvatarEmotion = AVATAR_EMOTIONS[activeEmotionIndex] || AVATAR_EMOTIONS[0];

  const currentLabel = isUsingCustomSequence && gestureSequence
    ? gestureSequence[activeEmotionIndex % gestureSequence.length]?.label
    : `${currentEmotion.aslSign} (${currentEmotion.name})`;

  const currentMarker = isUsingCustomSequence && gestureSequence
    ? gestureSequence[activeEmotionIndex % gestureSequence.length]?.nonManualMarker || 'neutral'
    : currentEmotion.nonManualMarker;

  const currentDesc = isUsingCustomSequence && gestureSequence
    ? gestureSequence[activeEmotionIndex % gestureSequence.length]?.description || ''
    : currentEmotion.description;

  // Filter 50 emotions by category and search term
  const filteredEmotions = AVATAR_EMOTIONS.filter((emo) => {
    const matchesCat = selectedCategory === 'all' || emo.category === selectedCategory;
    const matchesSearch =
      emo.name.toLowerCase().includes(emotionSearch.toLowerCase()) ||
      emo.aslSign.toLowerCase().includes(emotionSearch.toLowerCase()) ||
      emo.description.toLowerCase().includes(emotionSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleSelectEmotion = (index: number) => {
    setActiveEmotionIndex(index);
    startTimeRef.current = Date.now();
    setIsPlaying(true);
    hapticService.trigger('light');
    if (!compact) {
      setShowLibraryDrawer(false);
    }
  };

  const handleShuffleEmotion = () => {
    const randomIndex = Math.floor(Math.random() * AVATAR_EMOTIONS.length);
    setActiveEmotionIndex(randomIndex);
    startTimeRef.current = Date.now();
    setIsPlaying(true);
    hapticService.trigger('light');
  };

  useEffect(() => {
    startTimeRef.current = Date.now();
    setIsPlaying(true);
  }, [currentText, gestureSequence]);

  // Main Canvas Rendering Loop with 50-Emotion Facial Geometry & Dual-Hand Skeletal Rig
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

      const centerX = width / 2;
      const centerY = height * 0.44;

      const time = (Date.now() - startTimeRef.current) * playbackSpeed;
      const now = Date.now();

      // Check if avatar is in Attentive ASL Ready Pose (no camera gesture/emotion and not in explorer mode)
      const isResting = !isRespondingToLiveInput && avatarMode === 'camera_responsive';

      // Emotion parameters
      const expression = isResting
        ? {
            eyebrowOffset: 0,
            eyebrowShape: 'neutral' as const,
            eyeAperture: 1.0,
            mouthSmile: 1.0,
            mouthOpen: 0,
            headTilt: Math.sin(now * 0.001) * 0.02,
            headNod: 0,
            cheekBlush: false,
          }
        : currentEmotion.facialExpression;

      const duration = currentEmotion.durationMs || 1200;
      progress = isResting ? 0 : (time % duration) / duration;

      // Dynamic breathing and head posture
      const breathingBob = Math.sin(now * 0.0018) * 1.8;
      const headTilt = isResting
        ? Math.sin(now * 0.0012) * 0.02
        : expression.headTilt + Math.sin(progress * Math.PI * 2) * 0.03;
      const headNod = isResting ? 0 : Math.sin(progress * Math.PI * 4 * expression.headNod) * 4;

      // Ambient emotion aura glow behind avatar head
      const auraColors: Record<EmotionCategory, string> = {
        joy: 'rgba(234, 179, 8, 0.12)',
        empathy: 'rgba(244, 63, 94, 0.12)',
        inquiry: 'rgba(56, 189, 248, 0.12)',
        calm: 'rgba(16, 185, 129, 0.12)',
        drive: 'rgba(249, 115, 22, 0.12)',
        expressive: 'rgba(168, 85, 247, 0.12)',
      };
      const auraColor = isResting
        ? 'rgba(56, 189, 248, 0.06)'
        : auraColors[currentEmotion.category] || 'rgba(99, 102, 241, 0.12)';

      const auraGrad = ctx.createRadialGradient(centerX, centerY - 20, 10, centerX, centerY - 20, 120);
      auraGrad.addColorStop(0, auraColor);
      auraGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY - 20, 120, 0, Math.PI * 2);
      ctx.fill();

      // Torso & Shoulders
      ctx.beginPath();
      ctx.fillStyle = '#1e293b';
      ctx.ellipse(centerX, centerY + 115 + breathingBob, 90, 48, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.stroke();

      // HEAD TRANSFORM
      ctx.save();
      ctx.translate(centerX, centerY - 25 + headNod + breathingBob * 0.5);
      ctx.rotate(headTilt);

      // Head Base Oval
      ctx.beginPath();
      ctx.arc(0, 0, 38, 0, Math.PI * 2);
      ctx.fillStyle = '#243044';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#475569';
      ctx.stroke();

      // Cheek Blush (if emotion has cheekBlush flag)
      if (expression.cheekBlush && !isResting) {
        ctx.fillStyle = 'rgba(244, 63, 94, 0.35)';
        ctx.beginPath();
        ctx.ellipse(-20, 8, 8, 5, 0, 0, Math.PI * 2);
        ctx.ellipse(20, 8, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Eyes geometry with blink
      const isBlink = isResting ? now % 3600 < 150 : (now % 3200 < 150);
      const eyeAperture = isBlink ? 0.2 : expression.eyeAperture;
      const eyeH = 3.8 * eyeAperture;

      // Left Eye & Pupil
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.ellipse(-13, -4, 4.2, eyeH, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-13, -4, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Right Eye & Pupil
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.ellipse(13, -4, 4.2, eyeH, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(13, -4, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Eyebrows
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';

      const browOffset = expression.eyebrowOffset; // negative is raised, positive is furrowed
      let leftBrowSlope = 0;
      let rightBrowSlope = 0;

      if (expression.eyebrowShape === 'furrowed') {
        leftBrowSlope = 4;
        rightBrowSlope = -4;
      } else if (expression.eyebrowShape === 'slanted') {
        leftBrowSlope = -3;
        rightBrowSlope = 3;
      } else if (expression.eyebrowShape === 'arched') {
        leftBrowSlope = -1;
        rightBrowSlope = 1;
      }

      // Left Eyebrow
      ctx.beginPath();
      ctx.moveTo(-20, -14 + browOffset - leftBrowSlope);
      ctx.lineTo(-7, -13 + browOffset + leftBrowSlope);
      ctx.stroke();

      // Right Eyebrow
      ctx.beginPath();
      ctx.moveTo(7, -13 + browOffset + rightBrowSlope);
      ctx.lineTo(20, -14 + browOffset - rightBrowSlope);
      ctx.stroke();

      // Nose
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(2, 2);
      ctx.lineTo(-2, 4);
      ctx.stroke();

      // Mouth
      ctx.beginPath();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2.5;

      const smile = expression.mouthSmile;
      const mouthGap = expression.mouthOpen;

      if (mouthGap > 3) {
        // Open mouth (gasp, laughing, excited)
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.ellipse(0, 14, 8, mouthGap * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (smile > 2) {
        // Smile arc
        ctx.beginPath();
        ctx.arc(0, 10 - smile * 0.4, 11, 0.2, Math.PI - 0.2);
        ctx.stroke();
      } else if (smile < -2) {
        // Frown arc
        ctx.beginPath();
        ctx.arc(0, 20 - smile * 0.4, 10, Math.PI + 0.3, Math.PI * 2 - 0.3);
        ctx.stroke();
      } else {
        // Neutral line
        ctx.beginPath();
        ctx.moveTo(-8, 14);
        ctx.lineTo(8, 14);
        ctx.stroke();
      }

      ctx.restore();

      // SKELETAL ARMS & ARTICULATED HAND POSES
      const drawArmAndHand = (
        isRight: boolean,
        trajectory: string,
        curls: [number, number, number, number, number]
      ) => {
        const sideSign = isRight ? 1 : -1;
        let handX = centerX + sideSign * 45;
        let handY = centerY + 30;
        let handAngle = 0;

        if (isResting) {
          // Attentive ASL Ready Pose: hands resting gracefully poised in front of lower torso
          handX = centerX + sideSign * 34;
          handY = centerY + 70 + breathingBob;
          handAngle = sideSign * 0.22;
          curls = [0.75, 0.7, 0.65, 0.65, 0.7];
        } else {
          // Trajectory calculation based on emotion handPose
          if (trajectory === 'wave') {
            handX = centerX + sideSign * (65 + Math.sin(progress * Math.PI * 4) * 20);
            handY = centerY - 15;
            handAngle = sideSign * (Math.sin(progress * Math.PI * 4) * 0.35);
          } else if (trajectory === 'chin_forward') {
            handX = centerX + sideSign * (progress * 35);
            handY = centerY - 5 + progress * 35;
            handAngle = -0.15 + progress * 0.3;
          } else if (trajectory === 'chest_sweep') {
            handX = centerX + sideSign * (35 + Math.cos(progress * Math.PI * 2) * 20);
            handY = centerY + 45 - Math.sin(progress * Math.PI * 2) * 18;
            handAngle = sideSign * 0.15;
          } else if (trajectory === 'heart_cross') {
            handX = centerX - sideSign * 15;
            handY = centerY + 35;
            handAngle = -sideSign * 0.35;
          } else if (trajectory === 'temple_touch') {
            handX = centerX + sideSign * 38;
            handY = centerY - 25;
            handAngle = sideSign * 0.2;
          } else if (trajectory === 'circular_rub') {
            handX = centerX + sideSign * 25 + Math.cos(progress * Math.PI * 4) * 15;
            handY = centerY + 40 + Math.sin(progress * Math.PI * 4) * 12;
          } else if (trajectory === 'flicker') {
            handX = centerX + sideSign * 40;
            handY = centerY + 25 + Math.sin(progress * Math.PI * 8) * 12;
            handAngle = Math.sin(progress * Math.PI * 8) * 0.25;
          } else if (trajectory === 'downward_float') {
            handX = centerX + sideSign * 45;
            handY = centerY + 20 + progress * 40;
            handAngle = 0;
          } else if (trajectory === 'forward_push') {
            handX = centerX + sideSign * 40;
            handY = centerY + 30 + Math.sin(progress * Math.PI * 4) * 15;
            handAngle = 0;
          } else if (trajectory === 'upward_burst') {
            handX = centerX + sideSign * (30 + progress * 35);
            handY = centerY + 50 - progress * 65;
            handAngle = sideSign * (0.2 + progress * 0.3);
          } else if (trajectory === 'claw_freeze') {
            handX = centerX + sideSign * 55;
            handY = centerY - 15;
            handAngle = sideSign * 0.4;
          } else if (trajectory === 'side_wiggle') {
            handX = centerX + sideSign * 55 + Math.sin(progress * Math.PI * 6) * 10;
            handY = centerY + 20;
            handAngle = Math.sin(progress * Math.PI * 6) * 0.3;
          }
        }

        // Arm bones
        const shoulderX = centerX + sideSign * 55;
        const shoulderY = centerY + 85 + breathingBob;
        const elbowX = (shoulderX + handX) / 2 + sideSign * 20;
        const elbowY = (shoulderY + handY) / 2 + 10;

        // Draw Arm
        ctx.beginPath();
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.moveTo(shoulderX, shoulderY);
        ctx.lineTo(elbowX, elbowY);
        ctx.lineTo(handX, handY);
        ctx.stroke();

        // Arm neon inner core
        ctx.beginPath();
        ctx.strokeStyle = isResting ? '#38bdf8' : '#6366f1';
        ctx.lineWidth = 2.5;
        ctx.moveTo(shoulderX, shoulderY);
        ctx.lineTo(elbowX, elbowY);
        ctx.lineTo(handX, handY);
        ctx.stroke();

        // Draw Hand Palm
        ctx.save();
        ctx.translate(handX, handY);
        ctx.rotate(handAngle);

        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fillStyle = isResting ? '#0284c7' : '#6366f1';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = isResting ? '#38bdf8' : '#818cf8';
        ctx.stroke();

        // 5 Articulated Fingers
        const fingerAngles = [-0.65, -0.3, 0, 0.3, 0.65];
        const fingerLengths = [18, 25, 27, 24, 19];

        fingerAngles.forEach((angle, idx) => {
          const fLen = fingerLengths[idx];
          const curl = curls[idx] ?? 1.0;
          const tipX = Math.sin(angle) * fLen * curl;
          const tipY = -Math.cos(angle) * fLen * curl;

          ctx.beginPath();
          ctx.strokeStyle = curl > 0.6 ? '#a5b4fc' : '#4338ca';
          ctx.lineWidth = 3.8;
          ctx.lineCap = 'round';
          ctx.moveTo(Math.sin(angle) * 7, -Math.cos(angle) * 7);
          ctx.lineTo(tipX, tipY);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(tipX, tipY, 2.8, 0, Math.PI * 2);
          ctx.fillStyle = curl > 0.6 ? '#38bdf8' : '#6366f1';
          ctx.fill();
        });

        ctx.restore();
      };

      // Draw Right Hand (Primary)
      drawArmAndHand(
        true,
        currentEmotion.handPose.primaryTrajectory,
        currentEmotion.handPose.fingerCurls
      );

      // Draw Left Hand if twoHands flag is true or when in attentive resting pose
      if (currentEmotion.handPose.twoHands || isResting) {
        drawArmAndHand(
          false,
          currentEmotion.handPose.primaryTrajectory,
          currentEmotion.handPose.secondaryFingerCurls || currentEmotion.handPose.fingerCurls
        );
      }

      // Step to next item if completed
      if (time >= duration && isPlaying) {
        if (isUsingCustomSequence && gestureSequence) {
          if (activeEmotionIndex < gestureSequence.length - 1) {
            setActiveEmotionIndex((prev) => prev + 1);
            startTimeRef.current = Date.now();
          } else {
            if (onSignComplete) onSignComplete();
            setActiveEmotionIndex(0);
            startTimeRef.current = Date.now();
          }
        } else {
          // In responsive mode, loop only if still receiving live gesture/emotion or in explorer mode
          if (avatarMode === 'manual_explorer' || isRespondingToLiveInput) {
            startTimeRef.current = Date.now();
          }
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
  }, [
    activeEmotionIndex,
    isPlaying,
    playbackSpeed,
    currentEmotion,
    isUsingCustomSequence,
    gestureSequence,
    avatarMode,
    isRespondingToLiveInput,
  ]);

  const handleSpeakDialogue = () => {
    const textToSpeak = currentText || currentEmotion.dialogueExample;
    if (textToSpeak) {
      audioEngine.speak(textToSpeak);
      hapticService.trigger('speech_in');
    }
  };

  const getCategoryIcon = (cat: EmotionCategory) => {
    switch (cat) {
      case 'joy':
        return <Smile className="w-3.5 h-3.5 text-amber-400" />;
      case 'empathy':
        return <Heart className="w-3.5 h-3.5 text-rose-400" />;
      case 'inquiry':
        return <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />;
      case 'calm':
        return <Shield className="w-3.5 h-3.5 text-emerald-400" />;
      case 'drive':
        return <Flame className="w-3.5 h-3.5 text-orange-400" />;
      case 'expressive':
        return <Zap className="w-3.5 h-3.5 text-purple-400" />;
    }
  };

  return (
    <div
      className={`relative flex flex-col bg-white/[0.05] rounded-3xl border border-white/10 backdrop-blur-xl shadow-2xl shadow-black/30 overflow-hidden ${
        compact ? 'p-4' : 'p-6'
      }`}
    >
      {/* Top Banner with ASL Gloss & Mode Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/25 backdrop-blur-md">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Sign Language Avatar
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600/30 text-blue-300 border border-blue-400/30">
                50 Library
              </span>
            </div>
            <div className="text-sm font-bold text-white truncate max-w-[260px] font-mono flex items-center gap-1.5">
              <span>{aslGloss || currentLabel}</span>
            </div>
          </div>
        </div>

        {/* Mode Toggle: Camera-Responsive vs 50-Explorer */}
        <div className="flex items-center p-1 rounded-xl bg-black/40 border border-white/10">
          <button
            onClick={() => {
              setAvatarMode('camera_responsive');
              hapticService.trigger('light');
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all ${
              avatarMode === 'camera_responsive'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md border border-cyan-400/40'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Responsive only when person in camera feed makes hand gestures and facial emotions"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Camera Responsive</span>
          </button>

          <button
            onClick={() => {
              setAvatarMode('manual_explorer');
              hapticService.trigger('light');
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all ${
              avatarMode === 'manual_explorer'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md border border-blue-400/40'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Explore all 50 emotions manually with search and playback controls"
          >
            <span>50-Explorer</span>
          </button>
        </div>

        {/* Speed, Voice, Shuffle & Library toggles */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleShuffleEmotion}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-amber-300 hover:text-amber-200 transition-all border border-white/10 backdrop-blur-md"
            title="Randomly Pick Emotion from 50 Library"
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setPlaybackSpeed((s) => (s === 0.5 ? 1.0 : s === 1.5 ? 2.0 : s === 2.0 ? 0.5 : 1.5))}
            className="px-2 py-1 text-xs font-medium rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white transition-all border border-white/10 backdrop-blur-md"
            title="Adjust Signing Speed"
          >
            {playbackSpeed}x
          </button>
          <button
            onClick={handleSpeakDialogue}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-blue-300 transition-all border border-white/10 backdrop-blur-md"
            title="Speak Natural English Example"
          >
            <Volume2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowLibraryDrawer(!showLibraryDrawer)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold backdrop-blur-md border transition-all ${
              showLibraryDrawer
                ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/30'
                : 'bg-white/5 hover:bg-white/10 text-slate-200 border-white/10'
            }`}
            title="Browse All 50 ASL Emotions"
          >
            <span>Library</span>
            {showLibraryDrawer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Main Vector Avatar Canvas */}
      <div className="relative w-full aspect-4/3 max-h-[280px] rounded-2xl overflow-hidden bg-black/40 border border-white/10 backdrop-blur-md flex items-center justify-center shadow-inner">
        <canvas
          ref={canvasRef}
          width={380}
          height={280}
          className="w-full h-full object-contain"
        />

        {/* Live Responsiveness or NMM Status Overlay */}
        {avatarMode === 'camera_responsive' ? (
          <div className="absolute top-2.5 left-2.5">
            {isRespondingToLiveInput ? (
              <div className="px-3 py-1 rounded-full bg-emerald-950/85 border border-emerald-400/40 text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5 backdrop-blur-md shadow-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  Live: {isHandGestureActive ? `Gesture (${currentGesture?.name})` : isFaceEmotionActive ? `Emotion (${detectedEmotion?.emotion})` : 'Active Feed'}
                </span>
              </div>
            ) : (
              <div className="px-3 py-1 rounded-full bg-slate-900/85 border border-amber-400/30 text-[11px] font-semibold text-amber-300 flex items-center gap-1.5 backdrop-blur-md shadow-md">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>Attentive Ready • Awaiting Gesture/Emotion</span>
              </div>
            )}
          </div>
        ) : (
          currentMarker && currentMarker !== 'neutral' && (
            <div className="absolute top-2.5 left-2.5 px-3 py-1 rounded-full bg-blue-950/80 border border-blue-400/30 text-[11px] font-medium text-blue-200 flex items-center gap-1.5 backdrop-blur-md shadow-md">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
              NMM: {currentMarker.replace('_', ' ')}
            </div>
          )
        )}

        {/* Emotion Category Pill Overlay */}
        <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-slate-900/85 border border-white/15 text-[11px] font-semibold text-slate-200 flex items-center gap-1.5 backdrop-blur-md shadow-md">
          {getCategoryIcon(currentEmotion.category)}
          <span>{currentEmotion.categoryLabel}</span>
        </div>

        {/* Current Gesture Title & Description Chip */}
        <div className="absolute bottom-2.5 inset-x-2.5 flex items-center justify-between px-3.5 py-2 rounded-xl bg-[#0F172A]/85 border border-white/10 backdrop-blur-md shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-blue-300 font-mono">
              {currentEmotion.aslSign}
            </span>
            <span className="text-[11px] text-slate-300 truncate max-w-[200px]">
              {currentDesc}
            </span>
          </div>

          <div className="text-[10px] text-slate-400 font-mono">
            {activeEmotionIndex + 1}/{AVATAR_EMOTIONS.length}
          </div>
        </div>
      </div>

      {/* 50-Emotion Library Explorer Drawer */}
      {showLibraryDrawer && (
        <div className="mt-3.5 p-3.5 rounded-2xl bg-slate-950/90 border border-blue-500/30 backdrop-blur-2xl shadow-2xl space-y-3 z-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smile className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Explore 50 ASL Emotions & Non-Manual Markers
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              {filteredEmotions.length} available
            </span>
          </div>

          {/* Search bar inside library */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={emotionSearch}
              onChange={(e) => setEmotionSearch(e.target.value)}
              placeholder="Search by emotion name (e.g. Excited, Grateful, Relieved, Proud)..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-400"
            />
          </div>

          {/* Category Filter Chips */}
          <div className="flex flex-wrap gap-1">
            {[
              { id: 'all', label: 'All 50' },
              { id: 'joy', label: 'Joy & Positivity' },
              { id: 'empathy', label: 'Warmth & Empathy' },
              { id: 'inquiry', label: 'Wonder & Surprise' },
              { id: 'calm', label: 'Calm & Peace' },
              { id: 'drive', label: 'Drive & Energy' },
              { id: 'expressive', label: 'Expressive' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id as any)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Scrollable Emotion Grid */}
          <div className="max-h-56 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-white/10">
            {filteredEmotions.map((emo) => {
              const actualIdx = AVATAR_EMOTIONS.findIndex((e) => e.id === emo.id);
              const isSelected = actualIdx === activeEmotionIndex;

              return (
                <button
                  key={emo.id}
                  onClick={() => handleSelectEmotion(actualIdx)}
                  className={`w-full text-left p-2 rounded-xl flex items-center justify-between border transition-all ${
                    isSelected
                      ? 'bg-blue-600/30 border-blue-400/60 text-white shadow-md'
                      : 'bg-white/[0.03] hover:bg-white/[0.08] border-white/5 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-white/5">
                      {getCategoryIcon(emo.category)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{emo.name}</span>
                        <span className="text-[10px] font-mono text-cyan-300">[{emo.aslSign}]</span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[280px]">
                        {emo.description}
                      </div>
                    </div>
                  </div>

                  {isSelected && <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Scrubber pills for quick emotion switching */}
      <div className="flex items-center gap-1.5 mt-3.5 overflow-x-auto pb-1 scrollbar-none">
        {AVATAR_EMOTIONS.slice(0, 16).map((item, idx) => (
          <button
            key={item.id}
            onClick={() => handleSelectEmotion(idx)}
            className={`px-3 py-1 rounded-xl text-xs font-medium whitespace-nowrap backdrop-blur-md transition-all ${
              idx === activeEmotionIndex
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 border border-blue-400/40'
                : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/10'
            }`}
          >
            {item.name}
          </button>
        ))}
        <button
          onClick={() => setShowLibraryDrawer(true)}
          className="px-3 py-1 rounded-xl text-xs font-medium whitespace-nowrap bg-blue-500/20 text-blue-300 border border-blue-400/30 hover:bg-blue-500/30 transition-all"
        >
          +34 More Emotions...
        </button>
      </div>

      {/* Playback Controls & Dialogue Line */}
      <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-white/10">
        <div className="text-xs text-slate-300 truncate max-w-[240px]" title={currentEmotion.dialogueExample}>
          {currentText ? `"${currentText}"` : `Example: "${currentEmotion.dialogueExample}"`}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              startTimeRef.current = Date.now();
              hapticService.trigger('light');
            }}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 backdrop-blur-md transition-colors"
            title="Replay emotion animation"
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
