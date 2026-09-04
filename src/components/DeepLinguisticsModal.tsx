import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Brain,
  Layers,
  BookOpen,
  Compass,
  AlertCircle,
  CheckCircle,
  Lightbulb,
  Globe2,
  RefreshCw
} from 'lucide-react';
import { DeepSignAnalysisData } from '../types';
import { SIGN_DICTIONARY } from '../data/signDictionary';
import { hapticService } from '../services/hapticService';

interface DeepLinguisticsModalProps {
  signName: string;
  isOpen: boolean;
  onClose: () => void;
}

export const DeepLinguisticsModal: React.FC<DeepLinguisticsModalProps> = ({
  signName,
  isOpen,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DeepSignAnalysisData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !signName) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const fetchAnalysis = async () => {
      try {
        const response = await fetch('/api/gemini/analyze-gesture-deep', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            signName,
            context: 'realtime video call translation',
          }),
        });

        if (!response.ok) throw new Error('Analysis fetch failed');
        const json = await response.json();
        if (isMounted) {
          setData(json);
          hapticService.trigger('success');
        }
      } catch (err: any) {
        console.error('Deep analysis error:', err);
        // Fallback to local dictionary definition if available
        const localSign = SIGN_DICTIONARY.find(
          (s) => s.name.toLowerCase().includes(signName.toLowerCase()) || s.aslGloss.toLowerCase() === signName.toLowerCase()
        );

        if (localSign && isMounted) {
          setData({
            signName: localSign.name,
            fiveParameters: {
              handshape: `${localSign.name} hand pose with articulated thumb and fingers`,
              palmOrientation: 'Facing forward/inward depending on motion arc',
              location: 'Torso / Face neutral signing space',
              movement: localSign.description,
              nonManualMarkers: 'Relaxed pleasant expression, slight head tilt'
            },
            etymology: localSign.etymology,
            accuracyTips: [localSign.tip, 'Keep wrist steady in the center of the camera frame.'],
            commonMistakes: ['Dropping hand below camera frame line', 'Signing too fast without clear pauses.'],
            culturalNuance: 'Always maintain eye contact while signing in Deaf culture.',
            variations: ['American Sign Language (ASL)', 'British Sign Language (two-handed variant)']
          });
        } else if (isMounted) {
          setError(err.message || 'Unable to perform deep analysis at this time.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAnalysis();

    return () => {
      isMounted = false;
    };
  }, [isOpen, signName]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-[#0F172A]/90 border border-white/15 rounded-3xl shadow-2xl backdrop-blur-2xl overflow-hidden text-slate-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/15 text-blue-400 border border-blue-400/30 backdrop-blur-md">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  High-Thinking Linguistic Analysis
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 backdrop-blur-md">
                  Gemini 3.1 Pro
                </span>
              </div>
              <p className="text-xs text-slate-400">
                In-depth 5-Parameter ASL Anatomy, Etymology & Cultural Nuance for "{signName}"
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <div className="relative">
                <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
                <Sparkles className="w-4 h-4 text-cyan-400 absolute -top-1 -right-1 animate-pulse" />
              </div>
              <div className="text-sm font-semibold text-slate-200">
                Analyzing ASL Anatomy & Cultural Nuance...
              </div>
              <p className="text-xs text-slate-400 max-w-sm">
                Engaging Gemini 3.1 Pro High-Thinking mode to evaluate 5 parameters, historical etymology, and camera precision feedback.
              </p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs backdrop-blur-md">
              {error}
            </div>
          ) : data ? (
            <>
              {/* 5 Parameters Grid */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-300 mb-3 flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  The 5 Core Parameters of ASL
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                      1. Handshape:
                    </span>
                    <p className="text-xs text-slate-200">{data.fiveParameters.handshape}</p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                      2. Palm Orientation:
                    </span>
                    <p className="text-xs text-slate-200">{data.fiveParameters.palmOrientation}</p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                      3. Location in Signing Space:
                    </span>
                    <p className="text-xs text-slate-200">{data.fiveParameters.location}</p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                      4. Movement & Directionality:
                    </span>
                    <p className="text-xs text-slate-200">{data.fiveParameters.movement}</p>
                  </div>
                </div>

                {data.fiveParameters.nonManualMarkers && (
                  <div className="mt-3 p-3.5 rounded-2xl bg-blue-950/40 border border-blue-400/30 backdrop-blur-md">
                    <span className="text-[11px] font-semibold text-blue-300 block mb-1">
                      5. Non-Manual Markers (Facial Grammar):
                    </span>
                    <p className="text-xs text-blue-200">
                      {data.fiveParameters.nonManualMarkers}
                    </p>
                  </div>
                )}
              </div>

              {/* Etymology & Iconic Origin */}
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-cyan-400" />
                  Iconic Origin & Historical Etymology
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">{data.etymology}</p>
              </div>

              {/* Accuracy Tips & Beginner Pitfalls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-2xl bg-emerald-950/25 border border-emerald-500/30 backdrop-blur-md space-y-2">
                  <h5 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Accuracy & Camera Precision Tips
                  </h5>
                  <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                    {data.accuracyTips.map((tip, idx) => (
                      <li key={idx}>{tip}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-amber-950/25 border border-amber-500/30 backdrop-blur-md space-y-2">
                  <h5 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Common Beginner Pitfalls
                  </h5>
                  <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                    {(data.commonMistakes || ['Dropping hands outside camera view', 'Rushing movements']).map((m, idx) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Deaf Culture Etiquette */}
              <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-400/30 backdrop-blur-md space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-300 flex items-center gap-2">
                  <Globe2 className="w-4 h-4 text-blue-400" />
                  Deaf Community Etiquette & Pragmatics
                </h4>
                <p className="text-xs text-blue-100 leading-relaxed">{data.culturalNuance}</p>
              </div>
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-all border border-white/10 backdrop-blur-md"
          >
            Close Analysis
          </button>
        </div>
      </div>
    </div>
  );
};
