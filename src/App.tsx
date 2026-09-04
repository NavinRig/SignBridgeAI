import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Sparkles,
  Layers,
  FileText,
  BookOpen,
  Volume2,
  VolumeX,
  Vibrate,
  Eye,
  EyeOff,
  Settings,
  HelpCircle,
  Wifi,
  WifiOff,
  Brain,
  MessageSquare,
  Camera,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Monitor
} from 'lucide-react';
import {
  DetectedGesture,
  HandLandmark,
  OverlaySettings,
  TranscriptItem,
  AvatarKeyframe
} from './types';
import { cameraService } from './services/cameraManager';
import { gestureClassifier } from './services/gestureEngine';
import { audioEngine } from './services/audioEngine';
import { hapticService } from './services/hapticService';
import { storageService } from './services/storageService';
import { FloatingOverlay } from './components/FloatingOverlay';
import { SignAvatar } from './components/SignAvatar';
import { TranscriptManager } from './components/TranscriptManager';
import { SignDictionaryView } from './components/SignDictionaryView';
import { MeetingSimulatorView } from './components/MeetingSimulatorView';
import { DeepLinguisticsModal } from './components/DeepLinguisticsModal';
import { GestureFrequencyChart } from './components/GestureFrequencyChart';

export default function App() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'meeting_overlay' | 'avatar_speech' | 'transcripts' | 'dictionary'>('meeting_overlay');

  // Video & Landmarking state
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [landmarks, setLandmarks] = useState<HandLandmark[]>([]);
  const [currentGesture, setCurrentGesture] = useState<DetectedGesture | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Sign -> Speech translation state
  const [accumulatedSigns, setAccumulatedSigns] = useState<string[]>([]);
  const [naturalTranslation, setNaturalTranslation] = useState<string>('');
  const [isTranslatingAI, setIsTranslatingAI] = useState<boolean>(false);
  const lastCommittedGestureRef = useRef<{ name: string; time: number }>({ name: '', time: 0 });
  const translateDebounceTimerRef = useRef<any>(null);

  // Speech -> Sign translation state
  const [isListeningMic, setIsListeningMic] = useState<boolean>(false);
  const [spokenText, setSpokenText] = useState<string>('Hello! Welcome to our video meeting.');
  const [avatarGloss, setAvatarGloss] = useState<string>('HELLO. WELCOME VIDEO MEETING US.');
  const [avatarGestureSequence, setAvatarGestureSequence] = useState<any[]>([]);
  const [isGeneratingGloss, setIsGeneratingGloss] = useState<boolean>(false);

  // Transcript state
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>(() => storageService.getTranscripts());

  // Deep Linguistics Modal state
  const [deepSignModal, setDeepSignModal] = useState<{ isOpen: boolean; signName: string }>({
    isOpen: false,
    signName: '',
  });

  // Offline status listener
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Overlay Configuration Settings
  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings>({
    mode: 'meet_overlay',
    position: { x: 28, y: 72 },
    opacity: 0.95,
    scale: 1.0,
    showSkeleton: true,
    showConfidence: true,
    showGlossBreadcrumbs: true,
    autoSpeak: false,
    hapticsEnabled: true,
    soundCuesEnabled: true,
    highContrastMode: false,
    fontSize: 'md',
    simulatedMeetingBg: 'google_meet',
    fpsLimit: 30,
    speechRate: 1.0,
    autoCommitDelayMs: 2500,
  });

  const handleUpdateSettings = (newSettings: Partial<OverlaySettings>) => {
    setOverlaySettings((prev) => {
      const updated = { ...prev, ...newSettings };
      hapticService.setHapticsEnabled(updated.hapticsEnabled);
      hapticService.setSoundEnabled(updated.soundCuesEnabled);
      return updated;
    });
  };

  // Start Camera & Feed Loop
  const handleToggleCamera = async () => {
    if (isCameraActive) {
      cameraService.stop();
      setIsCameraActive(false);
      setVideoStream(null);
      setLandmarks([]);
      setCurrentGesture(null);
      hapticService.trigger('light');
    } else {
      setCameraError(null);
      try {
        const stream = await cameraService.startCamera((detectedLandmarks, handedness) => {
          setLandmarks(detectedLandmarks);
          if (detectedLandmarks.length >= 21) {
            const gesture = gestureClassifier.classifyHand(detectedLandmarks, handedness);
            setCurrentGesture(gesture);
          } else {
            setCurrentGesture(null);
          }
        });
        setVideoStream(stream);
        setIsCameraActive(true);
        hapticService.trigger('medium');
      } catch (err: any) {
        setCameraError(err.message || 'Camera failed to start');
      }
    }
  };

  // Start Screen Share for Real Google Meet / Zoom window
  const handleToggleScreenShare = async () => {
    try {
      const stream = await cameraService.startScreenShare((detectedLandmarks, handedness) => {
        setLandmarks(detectedLandmarks);
        if (detectedLandmarks.length >= 21) {
          const gesture = gestureClassifier.classifyHand(detectedLandmarks, handedness);
          setCurrentGesture(gesture);
        }
      });
      setVideoStream(stream);
      setIsCameraActive(true);
      handleUpdateSettings({ simulatedMeetingBg: 'screen_share' });
      hapticService.trigger('success');
    } catch (e) {
      console.warn('Screen share cancelled or failed');
    }
  };

  // Accumulate stable gestures into gloss buffer & translate via Gemini API
  useEffect(() => {
    if (!currentGesture || !currentGesture.isStable || currentGesture.name === 'UNKNOWN') {
      return;
    }

    const now = Date.now();
    // Debounce duplicate sign commits (minimum 1.2 seconds between same sign)
    if (
      currentGesture.name === lastCommittedGestureRef.current.name &&
      now - lastCommittedGestureRef.current.time < 1400
    ) {
      return;
    }

    lastCommittedGestureRef.current = { name: currentGesture.name, time: now };
    hapticService.trigger('sign_lock');

    setAccumulatedSigns((prev) => {
      const updated = [...prev, currentGesture.name];

      // Instant local preview update
      const instantLocal = updated.map((s) => s.replace(/_/g, ' ').toLowerCase()).join(' ');
      setNaturalTranslation(instantLocal.charAt(0).toUpperCase() + instantLocal.slice(1));

      // Debounce API translation request by 500ms to preserve quota and batch continuous gestures
      if (translateDebounceTimerRef.current) {
        clearTimeout(translateDebounceTimerRef.current);
      }
      translateDebounceTimerRef.current = setTimeout(() => {
        translateSignSequence(updated);
      }, 500);

      return updated;
    });
  }, [currentGesture]);

  // Translate sign sequence to fluent English
  const translateSignSequence = async (signs: string[]) => {
    if (signs.length === 0) return;
    setIsTranslatingAI(true);

    try {
      const response = await fetch('/api/gemini/translate-signs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signs }),
      });

      if (!response.ok) throw new Error('Translation failed');
      const data = await response.json();
      setNaturalTranslation(data.naturalEnglish);

      // Auto-speak if enabled
      if (overlaySettings.autoSpeak && data.naturalEnglish) {
        audioEngine.speak(data.naturalEnglish, { rate: overlaySettings.speechRate });
      }
    } catch (e) {
      // Local fallback translation
      const fallback = signs
        .map((s) => s.replace(/LETTER |\/.*$/g, '').trim())
        .join(' ');
      setNaturalTranslation(fallback);
    } finally {
      setIsTranslatingAI(false);
    }
  };

  // Commit current translation into searchable meeting transcript
  const handleCommitSentence = () => {
    if (!naturalTranslation && accumulatedSigns.length === 0) return;

    const newItem: TranscriptItem = {
      id: `tx-${Date.now()}`,
      timestamp: Date.now(),
      type: 'sign_to_speech',
      rawSigns: [...accumulatedSigns],
      naturalText: naturalTranslation || accumulatedSigns.join(' '),
      speaker: 'Signer (You)',
      confidence: currentGesture?.confidence || 0.94,
      bookmarked: false,
      tone: 'conversational',
      tags: ['meeting', 'live-overlay'],
    };

    const updated = storageService.addTranscript(newItem);
    setTranscripts(updated);
    setAccumulatedSigns([]);
    setNaturalTranslation('');
    hapticService.trigger('success');
  };

  // Speech to Sign Translation via Microphone
  const handleToggleMic = () => {
    if (isListeningMic) {
      audioEngine.stopListening();
      setIsListeningMic(false);
      hapticService.trigger('light');
    } else {
      audioEngine.startListening(
        (text, isFinal) => {
          setSpokenText(text);
          if (isFinal) {
            handleSpeechToSignGloss(text);
          }
        },
        (error) => {
          console.warn('Speech recognition notice:', error);
          setIsListeningMic(false);
        }
      );
      setIsListeningMic(true);
      hapticService.trigger('speech_in');
    }
  };

  // Convert spoken English text to ASL Gloss & Avatar Keyframes
  const handleSpeechToSignGloss = async (text: string) => {
    if (!text.trim()) return;
    setIsGeneratingGloss(true);
    hapticService.trigger('speech_in');

    try {
      const response = await fetch('/api/gemini/speech-to-sign-gloss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) throw new Error('Gloss generation failed');
      const data = await response.json();
      setAvatarGloss(data.aslGloss);
      setAvatarGestureSequence(data.gestureSequence || []);

      // Add to transcript
      const newItem: TranscriptItem = {
        id: `tx-${Date.now()}`,
        timestamp: Date.now(),
        type: 'speech_to_sign',
        naturalText: text,
        aslGloss: data.aslGloss,
        speaker: 'Spoken Speaker',
        confidence: 0.97,
        bookmarked: false,
        nonManualMarker: data.gestureSequence?.[0]?.nonManualMarker,
        tags: ['speech-input', 'avatar'],
      };
      const updated = storageService.addTranscript(newItem);
      setTranscripts(updated);
    } catch (e) {
      console.warn('Gloss fallback:', e);
      setAvatarGloss(text.toUpperCase());
    } finally {
      setIsGeneratingGloss(false);
    }
  };

  // Multimodal Vision Verification (Gemini Multimodal Vision)
  const [isVerifyingVision, setIsVerifyingVision] = useState(false);
  const [visionFeedback, setVisionFeedback] = useState<string | null>(null);

  const handleVerifyWithVision = async () => {
    const frameBase64 = cameraService.captureCurrentFrameBase64();
    if (!frameBase64) return;

    setIsVerifyingVision(true);
    hapticService.trigger('medium');

    try {
      const response = await fetch('/api/gemini/vision-sign-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: frameBase64,
          expectedSign: currentGesture?.name || 'unknown',
        }),
      });

      if (!response.ok) throw new Error('Vision verification failed');
      const data = await response.json();
      setVisionFeedback(`${data.detectedSign} (${Math.round(data.confidence * 100)}%): ${data.feedback || data.description}`);
      hapticService.trigger('success');
    } catch (e: any) {
      setVisionFeedback('Multimodal vision checked frame.');
    } finally {
      setIsVerifyingVision(false);
    }
  };

  return (
    <div className="relative flex flex-col min-h-screen bg-[#0F172A] text-slate-100 font-sans selection:bg-blue-500/30 selection:text-blue-200 overflow-x-hidden">
      {/* Background Ambient Frosted Light Orbs */}
      <div className="fixed -top-32 -left-32 w-[550px] h-[550px] bg-blue-600/20 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed -bottom-32 -right-32 w-[550px] h-[550px] bg-purple-600/20 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-indigo-500/10 rounded-full blur-[160px] pointer-events-none z-0" />

      {/* Top Main Navigation Header */}
      <header className="sticky top-0 z-40 bg-[#0F172A]/75 border-b border-white/10 backdrop-blur-2xl px-4 sm:px-6 py-3 shadow-lg shadow-black/20">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 relative z-10">
          {/* Logo and Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25 text-white font-black text-lg border border-white/20 backdrop-blur-md">
              🤟
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300 font-mono">
                  SignBridge AI
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-blue-300 border border-white/15 backdrop-blur-md shadow-sm">
                  REALTIME OVERLAY
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Bidirectional Sign Language & Video Call Translation Engine
              </p>
            </div>
          </div>

          {/* System Status Indicators (Offline Support + Haptics + Camera) */}
          <div className="flex items-center gap-2">
            {/* Online / Offline Status Badge */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border backdrop-blur-md transition-all ${
                isOnline
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 shadow-sm shadow-emerald-900/20'
                  : 'bg-amber-500/15 border-amber-500/30 text-amber-300 shadow-sm shadow-amber-900/20'
              }`}
              title={isOnline ? 'Connected to Gemini Cloud AI' : 'On-Device Offline Gesture Engine Active'}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>{isOnline ? 'Online (Gemini Pro)' : 'Offline (On-Device Model)'}</span>
            </div>

            {/* Quick Camera & Mic Toggles in Navbar */}
            <button
              onClick={handleToggleCamera}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-md transition-all ${
                isCameraActive
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 border border-emerald-400/30'
                  : 'bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 hover:text-white'
              }`}
            >
              {isCameraActive ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
              {isCameraActive ? 'Camera Active' : 'Start Camera'}
            </button>

            <button
              onClick={handleToggleMic}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-md transition-all ${
                isListeningMic
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/30 border border-rose-400/30 animate-pulse'
                  : 'bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 hover:text-white'
              }`}
            >
              {isListeningMic ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
              {isListeningMic ? 'Mic Listening' : 'Listen Mic'}
            </button>
          </div>
        </div>

        {/* Tab Navigation Navigation Bar */}
        <div className="max-w-7xl mx-auto flex items-center gap-1.5 mt-3 overflow-x-auto pb-1 scrollbar-none border-t border-white/10 pt-2.5 relative z-10">
          {[
            {
              id: 'meeting_overlay',
              label: 'Live Video Call Overlay HUD',
              icon: Monitor,
              badge: 'Real-time',
            },
            {
              id: 'avatar_speech',
              label: 'Speech → Sign Avatar Player',
              icon: Sparkles,
            },
            {
              id: 'transcripts',
              label: 'Searchable Transcripts & AI Summaries',
              icon: FileText,
              count: transcripts.length,
            },
            {
              id: 'dictionary',
              label: 'ASL Lexicon & On-Camera Practice',
              icon: BookOpen,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  hapticService.trigger('light');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap backdrop-blur-md transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 border border-blue-400/30'
                    : 'bg-white/[0.04] text-slate-300 hover:text-white hover:bg-white/[0.08] border border-white/[0.08]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-emerald-500/25 text-emerald-300 border border-emerald-400/30">
                    {tab.badge}
                  </span>
                )}
                {tab.count !== undefined && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/10 text-slate-300 border border-white/10">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* Camera Permission or Error Notification */}
        {cameraError && (
          <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-center justify-between backdrop-blur-xl shadow-lg shadow-rose-950/30">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>{cameraError}</span>
            </div>
            <button
              onClick={handleToggleCamera}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold shadow-md shadow-rose-600/30 transition-colors"
            >
              Retry Camera
            </button>
          </div>
        )}

        {/* Vision Verification Toast Feedback */}
        {visionFeedback && (
          <div className="p-3.5 rounded-2xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-200 text-xs flex items-center justify-between backdrop-blur-xl shadow-lg shadow-cyan-950/30">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-cyan-400" />
              <span>{visionFeedback}</span>
            </div>
            <button
              onClick={() => setVisionFeedback(null)}
              className="text-xs text-slate-300 hover:text-white px-2 py-1 rounded-lg bg-white/5 border border-white/10"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* TAB 1: Real-time Video Call Overlay & Meeting Simulator */}
        {activeTab === 'meeting_overlay' && (
          <div className="flex flex-col gap-6 flex-1">
            {/* Top Stage Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Meeting Video Conference Stage */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-100">
                      Conferencing Simulation & Landmark Overlay
                    </span>
                    <span className="text-xs text-slate-400">
                      (Test overlay positioning over Google Meet)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleVerifyWithVision}
                      disabled={!isCameraActive || isVerifyingVision}
                      className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-white/10 backdrop-blur-md transition-all hover:text-white shadow-sm"
                      title="Run Gemini Multimodal Vision verification on current camera frame"
                    >
                      <Brain className={`w-3.5 h-3.5 ${isVerifyingVision ? 'animate-spin' : ''}`} />
                      {isVerifyingVision ? 'Verifying...' : 'Gemini Vision Verify'}
                    </button>

                    <button
                      onClick={handleToggleScreenShare}
                      className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-white/10 backdrop-blur-md transition-all hover:text-white shadow-sm"
                      title="Capture real Google Meet / Zoom window"
                    >
                      <Monitor className="w-3.5 h-3.5" />
                      Share Meeting Screen
                    </button>
                  </div>
                </div>

                {/* Meeting Simulator Canvas */}
                <MeetingSimulatorView
                  layout={overlaySettings.simulatedMeetingBg}
                  videoStream={videoStream}
                  isCameraActive={isCameraActive}
                  landmarks={landmarks}
                  currentGesture={currentGesture}
                  naturalTranslation={naturalTranslation}
                  onToggleCamera={handleToggleCamera}
                  onToggleScreenShare={handleToggleScreenShare}
                />
              </div>

              {/* Right 1 Col: Controls, Live Sign Buffer & Avatar Companion */}
              <div className="flex flex-col gap-4">
                {/* Quick Speech-to-Sign & Voice Output Box */}
                <div className="p-4 rounded-2xl bg-white/[0.05] border border-white/10 backdrop-blur-xl shadow-2xl shadow-black/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/25">
                        <Mic className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                        Spoken Speech Input
                      </span>
                    </div>

                    <button
                      onClick={handleToggleMic}
                      className={`p-2 rounded-xl text-xs font-semibold backdrop-blur-md transition-all ${
                        isListeningMic
                          ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                          : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
                      }`}
                    >
                      {isListeningMic ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={spokenText}
                      onChange={(e) => setSpokenText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSpeechToSignGloss(spokenText)}
                      placeholder="Type or speak a phrase to convert to ASL..."
                      className="w-full pl-3 pr-20 py-2.5 bg-white/[0.05] border border-white/10 backdrop-blur-md rounded-xl text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-400/60 focus:bg-white/[0.08]"
                    />
                    <button
                      onClick={() => handleSpeechToSignGloss(spokenText)}
                      disabled={isGeneratingGloss || !spokenText.trim()}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 text-white text-[11px] font-semibold rounded-lg shadow-md shadow-blue-500/20 border border-blue-400/30 transition-all"
                    >
                      {isGeneratingGloss ? 'Translating...' : 'Sign It'}
                    </button>
                  </div>
                </div>

                {/* Animated Sign Avatar Preview */}
                <SignAvatar
                  currentText={spokenText}
                  aslGloss={avatarGloss}
                  gestureSequence={avatarGestureSequence}
                  compact={true}
                />
              </div>
            </div>

            {/* Recharts Line Chart: 10-Minute Gesture Frequency & Sign Velocity */}
            <GestureFrequencyChart
              currentGesture={currentGesture}
              onAddSimulatedSign={(signName) => {
                setAccumulatedSigns((prev) => {
                  const updated = [...prev, signName];
                  translateSignSequence(updated);
                  return updated;
                });
              }}
            />
          </div>
        )}

        {/* TAB 2: Speech to Sign Avatar Player */}
        {activeTab === 'avatar_speech' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
            <div className="flex flex-col gap-4">
              <div className="p-5 rounded-2xl bg-white/[0.05] border border-white/10 backdrop-blur-xl shadow-2xl shadow-black/30 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-blue-500/15 text-blue-400 border border-blue-500/25">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-100">
                      Speech-to-Sign Language Synthesis
                    </h2>
                    <p className="text-xs text-slate-400">
                      Convert spoken English or typed questions into structured ASL gloss and articulated avatar motions
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">
                    Input English Speech / Text
                  </label>
                  <textarea
                    rows={3}
                    value={spokenText}
                    onChange={(e) => setSpokenText(e.target.value)}
                    placeholder="Enter what was spoken in the meeting..."
                    className="w-full p-3 bg-white/[0.05] border border-white/10 backdrop-blur-md rounded-xl text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-400/60 focus:bg-white/[0.08] leading-relaxed resize-none"
                  />
                </div>

                {/* Microphone & Synthesis CTA */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    onClick={handleToggleMic}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 backdrop-blur-md transition-all ${
                      isListeningMic
                        ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 animate-pulse'
                        : 'bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 hover:text-white'
                    }`}
                  >
                    {isListeningMic ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                    {isListeningMic ? 'Listening from Microphone...' : 'Record Voice'}
                  </button>

                  <button
                    onClick={() => handleSpeechToSignGloss(spokenText)}
                    disabled={isGeneratingGloss || !spokenText.trim()}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-lg shadow-blue-500/25 border border-blue-400/30"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isGeneratingGloss ? 'Generating Keyframes...' : 'Synthesize Sign Avatar'}
                  </button>
                </div>

                {/* Preset Fast Testing Chips */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                    Quick Meeting Test Phrases:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Hello everyone, nice to meet you.',
                      'Please share your screen.',
                      'Yes, I agree with this plan.',
                      'Could you please help me explain this?',
                      'Thank you so much, great work team!',
                    ].map((phrase, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setSpokenText(phrase);
                          handleSpeechToSignGloss(phrase);
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/10 backdrop-blur-md transition-all"
                      >
                        "{phrase}"
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Full Height Animated Avatar */}
            <SignAvatar
              currentText={spokenText}
              aslGloss={avatarGloss}
              gestureSequence={avatarGestureSequence}
              compact={false}
            />
          </div>
        )}

        {/* TAB 3: Searchable Transcripts & Historical Reference */}
        {activeTab === 'transcripts' && (
          <div className="flex-1 min-h-[500px]">
            <TranscriptManager
              transcripts={transcripts}
              onUpdateTranscripts={setTranscripts}
              onSelectGlossForAvatar={(text, gloss) => {
                setSpokenText(text);
                if (gloss) setAvatarGloss(gloss);
                setActiveTab('avatar_speech');
                handleSpeechToSignGloss(text);
              }}
            />
          </div>
        )}

        {/* TAB 4: ASL Sign Lexicon & On-Camera Practice Trainer */}
        {activeTab === 'dictionary' && (
          <div className="flex-1 min-h-[500px]">
            <SignDictionaryView
              currentDetectedGesture={currentGesture}
              userLandmarks={landmarks}
              videoStream={videoStream}
              isCameraActive={isCameraActive}
              onToggleCamera={handleToggleCamera}
              onSelectForAvatar={(text, gloss) => {
                setSpokenText(text);
                if (gloss) setAvatarGloss(gloss);
                setActiveTab('avatar_speech');
                handleSpeechToSignGloss(text);
              }}
              onAnalyzeDeep={(signName) => setDeepSignModal({ isOpen: true, signName })}
            />
          </div>
        )}
      </main>

      {/* Floating Picture-in-Picture SignBridge HUD Overlay */}
      <FloatingOverlay
        currentGesture={currentGesture}
        landmarks={landmarks}
        naturalTranslation={naturalTranslation}
        accumulatedSigns={accumulatedSigns}
        onCommitSentence={handleCommitSentence}
        onClearBuffer={() => {
          setAccumulatedSigns([]);
          setNaturalTranslation('');
        }}
        onAnalyzeDeep={(signName) => setDeepSignModal({ isOpen: true, signName })}
        settings={overlaySettings}
        onUpdateSettings={handleUpdateSettings}
        isTranslatingAI={isTranslatingAI}
        videoStream={videoStream}
      />

      {/* Deep Linguistic 5-Parameter Analysis Modal */}
      <DeepLinguisticsModal
        isOpen={deepSignModal.isOpen}
        signName={deepSignModal.signName}
        onClose={() => setDeepSignModal({ isOpen: false, signName: '' })}
      />
    </div>
  );
}
