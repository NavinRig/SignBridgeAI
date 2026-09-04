import React, { useState } from 'react';
import {
  BookOpen,
  Search,
  Sparkles,
  Award,
  CheckCircle2,
  Volume2,
  Eye,
  Layers,
  ArrowRight,
  Filter,
  Lightbulb,
  Hand,
  Trophy,
  Target,
  Play,
  Zap
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SIGN_DICTIONARY, SignDefinition } from '../data/signDictionary';
import { audioEngine } from '../services/audioEngine';
import { hapticService } from '../services/hapticService';
import { DetectedGesture, HandLandmark, HandednessMode } from '../types';
import { InteractiveSignTrainer } from './InteractiveSignTrainer';

interface SignDictionaryViewProps {
  currentDetectedGesture: DetectedGesture | null;
  userLandmarks?: HandLandmark[];
  videoStream?: MediaStream | null;
  isCameraActive?: boolean;
  onToggleCamera?: () => void;
  onSelectForAvatar: (text: string, gloss?: string) => void;
  onAnalyzeDeep: (signName: string) => void;
}

export const SignDictionaryView: React.FC<SignDictionaryViewProps> = ({
  currentDetectedGesture,
  userLandmarks = [],
  videoStream = null,
  isCameraActive = false,
  onToggleCamera = () => {},
  onSelectForAvatar,
  onAnalyzeDeep,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTrainerSign, setActiveTrainerSign] = useState<SignDefinition | null>(null);
  const [practiceCompleted, setPracticeCompleted] = useState<Record<string, boolean>>({});
  const [selectedHandedness, setSelectedHandedness] = useState<HandednessMode>('Right');

  const filteredSigns = SIGN_DICTIONARY.filter((sign) => {
    const matchesSearch =
      sign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sign.englishMeaning.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sign.aslGloss.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sign.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (selectedCategory === 'all') return true;
    return sign.category === selectedCategory;
  });

  // If in interactive landmark training mode, render full InteractiveSignTrainer studio
  if (activeTrainerSign) {
    return (
      <InteractiveSignTrainer
        currentSign={activeTrainerSign}
        userLandmarks={userLandmarks}
        detectedGesture={currentDetectedGesture}
        videoStream={videoStream}
        isCameraActive={isCameraActive}
        onToggleCamera={onToggleCamera}
        onSelectSign={(newSign) => setActiveTrainerSign(newSign)}
        onClose={() => setActiveTrainerSign(null)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-white/[0.05] rounded-3xl border border-white/10 backdrop-blur-xl shadow-2xl shadow-black/30 overflow-hidden">
      {/* Top Header & Search */}
      <div className="p-5 border-b border-white/10 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/15 text-blue-400 border border-blue-500/25 backdrop-blur-md">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                ASL Gesture Lexicon & Landmark Mimic Trainer
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-blue-300 border border-white/15 backdrop-blur-md">
                  {SIGN_DICTIONARY.length} Signs
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Interactive real-time 3D landmark guidance with full Right & Left hand support
              </p>
            </div>
          </div>

          {/* Quick Launch Interactive Trainer & Mastery Badges */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md text-xs text-emerald-300">
              <Award className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold">
                {Object.keys(practiceCompleted).length} / {SIGN_DICTIONARY.length} Mastered
              </span>
            </div>

            <button
              onClick={() => {
                setActiveTrainerSign(SIGN_DICTIONARY[0]);
                hapticService.trigger('medium');
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-500/25 border border-blue-400/30 transition-all"
            >
              <Target className="w-4 h-4 text-cyan-300" />
              <span>Launch Mimic Studio</span>
            </button>
          </div>
        </div>

        {/* Feature Highlights Bar: Left/Right Hand Support */}
        <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/40 border border-blue-400/25 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-200">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-white">Dual-Hand AI Precision Engine:</span>
            <span className="text-slate-300 hidden sm:inline">
              Real-time 21-landmark evaluation with automatic anatomical mirroring for both Right and Left hand signers.
            </span>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center gap-1">
              <Hand className="w-3 h-3" /> Right Hand
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center gap-1">
              <Hand className="w-3 h-3 scale-x-[-1]" /> Left Hand
            </span>
          </div>
        </div>

        {/* Search & Category Pills */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search sign lexicon by keyword, ASL gloss, or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2 bg-white/[0.05] border border-white/10 backdrop-blur-md rounded-xl text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-400/60 focus:bg-white/[0.08]"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: 'all', label: 'All Signs' },
              { id: 'common_phrase', label: 'Phrases & Greetings' },
              { id: 'work_meeting', label: 'Video Meetings' },
              { id: 'alphabet', label: 'A-Z Alphabet' },
              { id: 'emergency', label: 'Assistance' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  hapticService.trigger('light');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap backdrop-blur-md transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 border border-blue-400/30'
                    : 'bg-white/[0.04] text-slate-300 hover:text-white hover:bg-white/[0.08] border border-white/10'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid of Signs */}
      <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredSigns.map((sign) => {
          const isCompleted = practiceCompleted[sign.id];

          return (
            <div
              key={sign.id}
              className="p-4.5 rounded-2xl border backdrop-blur-xl transition-all flex flex-col justify-between space-y-3.5 bg-white/[0.04] hover:bg-white/[0.07] border-white/10 hover:border-white/15 shadow-md"
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white font-mono">{sign.name}</span>
                    {isCompleted && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-300 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 backdrop-blur-md">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Mastered
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10 capitalize backdrop-blur-md font-medium">
                    {sign.difficulty}
                  </span>
                </div>

                {/* English meaning */}
                <div className="text-xs text-blue-300 font-semibold mb-1">
                  "{sign.englishMeaning}"
                </div>

                {/* Description */}
                <p className="text-xs text-slate-300 leading-relaxed mb-2.5">
                  {sign.description}
                </p>

                {/* Key finger states badges */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-lg bg-white/[0.04] text-slate-300 border border-white/10 font-mono">
                    Thumb: {sign.keyPose.thumb}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-lg bg-white/[0.04] text-slate-300 border border-white/10 font-mono">
                    Index: {sign.keyPose.index}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-lg bg-white/[0.04] text-slate-300 border border-white/10 font-mono">
                    Pinky: {sign.keyPose.pinky}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-white/10 gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      audioEngine.speak(sign.englishMeaning);
                      hapticService.trigger('light');
                    }}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
                    title="Pronounce English meaning"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onAnalyzeDeep(sign.name)}
                    className="p-2 rounded-xl bg-blue-500/15 hover:bg-blue-500/30 text-blue-300 border border-blue-400/30 transition-colors"
                    title="Deep 5-Parameter & Cultural Analysis"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onSelectForAvatar(sign.englishMeaning, sign.aslGloss)}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white text-xs font-semibold transition-all border border-white/10 backdrop-blur-md"
                  >
                    Avatar Demo
                  </button>

                  <button
                    onClick={() => {
                      setActiveTrainerSign(sign);
                      hapticService.trigger('medium');
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-blue-500/25 border border-blue-400/30"
                  >
                    <Target className="w-3.5 h-3.5 text-cyan-300" />
                    <span>Train Mimic</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
