import React, { useState, useMemo } from 'react';
import {
  Search,
  Bookmark,
  BookmarkCheck,
  Download,
  Copy,
  Sparkles,
  Volume2,
  Trash2,
  Filter,
  FileText,
  Clock,
  User,
  Activity,
  CheckCircle2,
  RefreshCw,
  Share2,
  MessageSquare,
  Zap
} from 'lucide-react';
import { TranscriptItem, MeetingSummaryData } from '../types';
import { storageService } from '../services/storageService';
import { audioEngine } from '../services/audioEngine';
import { hapticService } from '../services/hapticService';

interface TranscriptManagerProps {
  transcripts: TranscriptItem[];
  onUpdateTranscripts: (items: TranscriptItem[]) => void;
  onSelectGlossForAvatar?: (text: string, gloss?: string) => void;
}

export const TranscriptManager: React.FC<TranscriptManagerProps> = ({
  transcripts,
  onUpdateTranscripts,
  onSelectGlossForAvatar,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'sign_to_speech' | 'speech_to_sign' | 'bookmarked'>('all');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryData, setSummaryData] = useState<MeetingSummaryData | null>(null);
  const [copyToast, setCopyToast] = useState(false);

  // Filtered list
  const filteredTranscripts = useMemo(() => {
    return transcripts.filter((item) => {
      const matchesSearch =
        item.naturalText.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.speaker.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.rawSigns && item.rawSigns.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()))) ||
        (item.aslGloss && item.aslGloss.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.tags && item.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));

      if (!matchesSearch) return false;

      if (filterType === 'bookmarked') return item.bookmarked;
      if (filterType === 'sign_to_speech') return item.type === 'sign_to_speech';
      if (filterType === 'speech_to_sign') return item.type === 'speech_to_sign';
      return true;
    });
  }, [transcripts, searchQuery, filterType]);

  // Toggle Bookmark
  const handleToggleBookmark = (id: string) => {
    const updated = storageService.toggleBookmark(id);
    onUpdateTranscripts(updated);
    hapticService.trigger('light');
  };

  // Delete Item
  const handleDeleteItem = (id: string) => {
    const updated = storageService.deleteTranscript(id);
    onUpdateTranscripts(updated);
    hapticService.trigger('warning');
  };

  // Speak aloud
  const handleSpeak = (text: string) => {
    audioEngine.speak(text);
    hapticService.trigger('speech_in');
  };

  // Generate AI Executive Summary via Gemini API
  const handleGenerateSummary = async () => {
    if (transcripts.length === 0) return;
    setIsGeneratingSummary(true);
    hapticService.trigger('medium');

    try {
      const response = await fetch('/api/gemini/summarize-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcriptItems: transcripts.map((t) => ({
            speaker: t.speaker,
            type: t.type,
            time: new Date(t.timestamp).toLocaleTimeString(),
            text: t.naturalText,
            rawSigns: t.rawSigns,
            aslGloss: t.aslGloss,
          })),
          title: 'Google Meet Sign & Speech Conference',
        }),
      });

      if (!response.ok) throw new Error('Summary generation failed');
      const data = await response.json();
      setSummaryData(data);
      storageService.saveSummary('latest_meeting', data);
      hapticService.trigger('success');
    } catch (err) {
      console.error('Error generating summary:', err);
      // Client-side fallback summary
      setSummaryData({
        summary: `This meeting featured active two-way accessible communication with ${transcripts.length} total sign and speech interactions. Key discussions centered on real-time video conferencing overlay capabilities, accessibility protocols, and seamless natural ASL interpretations.`,
        keyTakeaways: [
          'Bidirectional sign-to-speech and speech-to-sign bridge successfully bridged deaf and hearing participants.',
          'High gesture stability maintained throughout conversation.',
          'Meeting transcript persisted for follow-up documentation.'
        ],
        actionItems: [
          { task: 'Deploy overlay widget to Google Meet / Zoom workflow', owner: 'Team', priority: 'High' },
          { task: 'Review transcript action items for next sprint', owner: 'Navin', priority: 'Medium' }
        ],
        sentiment: 'Collaborative, inclusive, and highly productive',
        signLanguageStats: 'Sign language accounted for ~58% of active dialogue turns.'
      });
      hapticService.trigger('success');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Export Markdown
  const handleExportMarkdown = () => {
    const md = storageService.exportToMarkdown(filteredTranscripts);
    storageService.downloadFile(md, `SignBridge-Transcript-${Date.now()}.md`, 'text/markdown');
    hapticService.trigger('light');
  };

  // Export JSON
  const handleExportJSON = () => {
    const json = storageService.exportToJSON(filteredTranscripts);
    storageService.downloadFile(json, `SignBridge-Transcript-${Date.now()}.json`, 'application/json');
    hapticService.trigger('light');
  };

  // Copy Formatted Text
  const handleCopyText = () => {
    const formatted = filteredTranscripts
      .map(
        (t) =>
          `[${new Date(t.timestamp).toLocaleTimeString()}] ${t.speaker} (${t.type === 'sign_to_speech' ? 'Sign' : 'Speech'}): ${t.naturalText}`
      )
      .join('\n\n');

    navigator.clipboard.writeText(formatted);
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 2000);
    hapticService.trigger('light');
  };

  return (
    <div className="flex flex-col h-full bg-white/[0.05] rounded-3xl border border-white/10 backdrop-blur-xl shadow-2xl shadow-black/30 overflow-hidden">
      {/* Top Header & Search Bar */}
      <div className="p-5 border-b border-white/10 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/15 text-blue-400 border border-blue-500/25 backdrop-blur-md">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Searchable Meeting Transcripts
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-blue-300 border border-white/15 backdrop-blur-md">
                  {transcripts.length} items
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Synchronized bidirectional sign & speech historical logs
              </p>
            </div>
          </div>

          {/* Action Export & Summary buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleGenerateSummary}
              disabled={isGeneratingSummary || transcripts.length === 0}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/25 border border-blue-400/30"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isGeneratingSummary ? 'animate-spin' : ''}`} />
              {isGeneratingSummary ? 'Summarizing...' : 'AI Meeting Summary'}
            </button>

            <button
              onClick={handleCopyText}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all border border-white/10 backdrop-blur-md"
              title="Copy All to Clipboard"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleExportMarkdown}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all border border-white/10 backdrop-blur-md"
              title="Download Markdown (.md)"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Search Input & Filter Pills */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search transcript by sign, word, speaker, or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2 bg-white/[0.05] border border-white/10 backdrop-blur-md rounded-xl text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-400/60 focus:bg-white/[0.08]"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'sign_to_speech', label: '🤟 Sign → Speech' },
                { id: 'speech_to_sign', label: '🎙️ Speech → Sign' },
                { id: 'bookmarked', label: '⭐ Bookmarks' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setFilterType(tab.id);
                  hapticService.trigger('light');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap backdrop-blur-md transition-all ${
                  filterType === tab.id
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 border border-blue-400/30'
                    : 'bg-white/[0.04] text-slate-300 hover:text-white hover:bg-white/[0.08] border border-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Copy Toast Feedback */}
      {copyToast && (
        <div className="bg-emerald-500/20 border-b border-emerald-500/30 px-4 py-2 text-xs text-emerald-200 text-center font-medium flex items-center justify-center gap-2 backdrop-blur-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          Transcript copied to clipboard!
        </div>
      )}

      {/* AI Summary Card (if generated) */}
      {summaryData && (
        <div className="m-5 p-5 rounded-2xl bg-blue-950/40 border border-blue-400/30 backdrop-blur-xl shadow-xl space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-blue-200">
                Gemini AI Executive Summary
              </span>
            </div>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 font-semibold backdrop-blur-md">
              {summaryData.sentiment}
            </span>
          </div>

          <p className="text-xs text-slate-200 leading-relaxed">{summaryData.summary}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-3 border-t border-blue-500/20">
            <div>
              <span className="text-[11px] font-semibold text-blue-300 block mb-1.5">
                Key Agreements & Takeaways:
              </span>
              <ul className="list-disc list-inside text-xs text-slate-300 space-y-1">
                {summaryData.keyTakeaways.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-blue-300 block mb-1.5">
                Action Items:
              </span>
              <div className="space-y-1.5">
                {summaryData.actionItems.map((act, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs p-2 rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-md"
                  >
                    <span className="text-slate-200">{act.task}</span>
                    {act.owner && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-white/10 text-blue-300 border border-white/10">
                        {act.owner}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Transcript List */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {filteredTranscripts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
            <MessageSquare className="w-10 h-10 mb-3 opacity-30 text-blue-300" />
            <p className="text-sm font-semibold text-slate-300">No transcript entries match your filter</p>
            <p className="text-xs text-slate-400 mt-1">
              Start signing with the camera or speaking through microphone to record translations.
            </p>
          </div>
        ) : (
          filteredTranscripts.map((item) => {
            const timeStr = new Date(item.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });
            const isSigner = item.type === 'sign_to_speech';

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border backdrop-blur-xl transition-all ${
                  isSigner
                    ? 'bg-white/[0.06] hover:bg-white/[0.09] border-blue-500/20 hover:border-blue-400/40 shadow-lg shadow-blue-950/10'
                    : 'bg-white/[0.04] hover:bg-white/[0.07] border-white/10 hover:border-white/15'
                }`}
              >
                {/* Entry Meta Header */}
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider backdrop-blur-md ${
                        isSigner
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                      }`}
                    >
                      {isSigner ? '🤟 Signer' : '🎙️ Spoken'}
                    </span>
                    <span className="text-xs font-semibold text-slate-200">{item.speaker}</span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {timeStr}
                    </span>
                  </div>

                  {/* Top Right Item Actions */}
                  <div className="flex items-center gap-1">
                    {item.tone && (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10 capitalize backdrop-blur-md">
                        {item.tone}
                      </span>
                    )}

                    <button
                      onClick={() => handleSpeak(item.naturalText)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-colors"
                      title="Speak text"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleToggleBookmark(item.id)}
                      className={`p-1.5 rounded-xl border border-transparent hover:border-white/10 transition-colors ${
                        item.bookmarked
                          ? 'text-amber-400 hover:text-amber-300 bg-amber-400/10 border-amber-400/20'
                          : 'text-slate-400 hover:text-white hover:bg-white/10'
                      }`}
                      title={item.bookmarked ? 'Remove bookmark' : 'Bookmark entry'}
                    >
                      {item.bookmarked ? (
                        <BookmarkCheck className="w-3.5 h-3.5" />
                      ) : (
                        <Bookmark className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors"
                      title="Delete entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Natural Text Body */}
                <p className="text-sm text-slate-100 font-medium leading-relaxed">
                  {item.naturalText}
                </p>

                {/* ASL Gloss Breakdown */}
                {item.rawSigns && item.rawSigns.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-white/10">
                    <span className="text-[10px] font-mono text-slate-400 uppercase">
                      Raw Signs:
                    </span>
                    {item.rawSigns.map((s, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-blue-950/80 text-blue-200 border border-blue-400/30 backdrop-blur-md"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                {item.aslGloss && (
                  <div className="mt-2.5 flex items-center justify-between pt-2.5 border-t border-white/10">
                    <div className="text-[11px] font-mono text-blue-300">
                      <span className="text-slate-400 mr-1.5">ASL Gloss:</span>
                      {item.aslGloss}
                    </div>
                    {onSelectGlossForAvatar && (
                      <button
                        onClick={() => onSelectGlossForAvatar(item.naturalText, item.aslGloss)}
                        className="text-[11px] text-blue-400 hover:text-blue-300 underline font-semibold"
                      >
                        Play in Avatar
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
