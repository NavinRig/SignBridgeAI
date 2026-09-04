export interface HandLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface HandPoseData {
  landmarks: HandLandmark[];
  handedness: 'Left' | 'Right';
  score: number;
  bbox?: { x: number; y: number; width: number; height: number };
}

export interface FingerStates {
  thumb: 'extended' | 'folded' | 'touching';
  index: 'extended' | 'folded' | 'curled' | 'touching';
  middle: 'extended' | 'folded' | 'curled' | 'touching';
  ring: 'extended' | 'folded' | 'curled' | 'touching';
  pinky: 'extended' | 'folded' | 'curled' | 'touching';
}

export interface DetectedGesture {
  name: string;
  category: 'alphabet' | 'number' | 'word' | 'phrase' | 'punctuation';
  confidence: number;
  timestamp: number;
  isStable: boolean;
  fingerStates?: FingerStates;
  description?: string;
  handedness?: 'Left' | 'Right';
}

export interface TranscriptItem {
  id: string;
  timestamp: number;
  type: 'sign_to_speech' | 'speech_to_sign' | 'system' | 'gesture_stream';
  rawSigns?: string[];
  naturalText: string;
  speaker: string;
  confidence: number;
  bookmarked: boolean;
  tone?: string;
  glossBreakdown?: { token: string; role: string; explanation?: string }[];
  aslGloss?: string;
  nonManualMarker?: string;
  durationMs?: number;
  tags?: string[];
}

export interface AvatarKeyframe {
  signLabel: string;
  type: 'sign' | 'fingerspell';
  letters?: string[];
  durationMs: number;
  nonManualMarker?: string;
  description: string;
  fingerAngles?: {
    thumb: number[];
    index: number[];
    middle: number[];
    ring: number[];
    pinky: number[];
    wrist: { x: number; y: number; rot: number };
  };
}

export interface OverlaySettings {
  mode: 'full' | 'floating_pip' | 'meet_overlay' | 'compact_badge' | 'hud_transparent';
  position: { x: number; y: number };
  opacity: number;
  scale: number;
  showSkeleton: boolean;
  showConfidence: boolean;
  showGlossBreadcrumbs: boolean;
  autoSpeak: boolean;
  hapticsEnabled: boolean;
  soundCuesEnabled: boolean;
  highContrastMode: boolean;
  fontSize: 'sm' | 'md' | 'lg' | 'xl';
  simulatedMeetingBg: 'none' | 'google_meet' | 'zoom_grid' | 'teams_gallery' | 'screen_share';
  activeCameraId?: string;
  fpsLimit: number;
  speechVoice?: string;
  speechRate: number;
  autoCommitDelayMs: number;
}

export interface MeetingSummaryData {
  summary: string;
  keyTakeaways: string[];
  actionItems: { task: string; owner?: string; priority?: string }[];
  sentiment: string;
  signLanguageStats: string;
}

export interface DeepSignAnalysisData {
  signName: string;
  fiveParameters: {
    handshape: string;
    palmOrientation: string;
    location: string;
    movement: string;
    nonManualMarkers?: string;
  };
  etymology: string;
  accuracyTips: string[];
  commonMistakes?: string[];
  culturalNuance: string;
  variations?: string[];
}

export type HandednessMode = 'Right' | 'Left' | 'Auto';

export interface FingerAccuracy {
  name: 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';
  score: number;
  status: 'perfect' | 'good' | 'adjust';
  tip?: string;
}

export interface LandmarkMatchResult {
  signId: string;
  signName: string;
  overallScore: number;
  isMatched: boolean;
  fingerAccuracies: Record<'thumb' | 'index' | 'middle' | 'ring' | 'pinky', FingerAccuracy>;
  palmOrientationScore: number;
  detectedHandedness: 'Left' | 'Right';
  targetHandedness: 'Left' | 'Right';
  correctiveFeedback: string[];
  normalizedUserLandmarks: { x: number; y: number; z: number }[];
  normalizedRefLandmarks: { x: number; y: number; z: number }[];
  keypointErrors: number[];
}
