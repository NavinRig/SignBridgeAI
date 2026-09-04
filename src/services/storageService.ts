import { TranscriptItem, MeetingSummaryData } from '../types';

const TRANSCRIPTS_KEY = 'signbridge_transcripts_v1';
const SUMMARIES_KEY = 'signbridge_summaries_v1';
const SETTINGS_KEY = 'signbridge_settings_v1';

const SAMPLE_TRANSCRIPTS: TranscriptItem[] = [
  {
    id: 'tx-sample-1',
    timestamp: Date.now() - 1000 * 60 * 45,
    type: 'sign_to_speech',
    rawSigns: ['HELLO', 'EVERYONE', 'NICE', 'MEET', 'YOU'],
    naturalText: 'Hello everyone, it is wonderful to meet all of you in this meeting.',
    speaker: 'Signer (Navin)',
    confidence: 0.96,
    bookmarked: true,
    tone: 'welcoming',
    glossBreakdown: [
      { token: 'HELLO', role: 'Greeting' },
      { token: 'EVERYONE', role: 'Audience Subject' },
      { token: 'NICE MEET YOU', role: 'Topic-Comment predicate' }
    ],
    tags: ['meeting', 'introduction', 'sprint-standup']
  },
  {
    id: 'tx-sample-2',
    timestamp: Date.now() - 1000 * 60 * 42,
    type: 'speech_to_sign',
    naturalText: 'Good morning! Can everyone see the shared slide deck on the screen?',
    aslGloss: 'GOOD MORNING. ALL SEE SLIDE SCREEN CAN?',
    speaker: 'Meeting Host (Sarah)',
    confidence: 0.98,
    bookmarked: false,
    nonManualMarker: 'eyebrows_raised_question',
    tags: ['meeting', 'question']
  },
  {
    id: 'tx-sample-3',
    timestamp: Date.now() - 1000 * 60 * 38,
    type: 'sign_to_speech',
    rawSigns: ['YES', 'SCREEN', 'CLEAR', 'THUMBS_UP'],
    naturalText: 'Yes, the screen is crystal clear on my side.',
    speaker: 'Signer (Navin)',
    confidence: 0.94,
    bookmarked: false,
    tone: 'affirmative',
    tags: ['confirmation']
  },
  {
    id: 'tx-sample-4',
    timestamp: Date.now() - 1000 * 60 * 20,
    type: 'sign_to_speech',
    rawSigns: ['PLEASE', 'HELP', 'EXPLAIN', 'API', 'ARCHITECTURE'],
    naturalText: 'Could you please explain the new real-time API architecture in more detail?',
    speaker: 'Signer (Navin)',
    confidence: 0.92,
    bookmarked: true,
    tone: 'inquisitive',
    tags: ['technical', 'question']
  },
  {
    id: 'tx-sample-5',
    timestamp: Date.now() - 1000 * 60 * 15,
    type: 'speech_to_sign',
    naturalText: 'Certainly. We are using low-latency WebSockets with on-device MediaPipe landmark acceleration and Gemini 3.7 Flash for translation.',
    aslGloss: 'SURE. WE USE LOW-LATENCY REALTIME WEBSOCKET PLUS COMPUTER-VISION LANDMARK AND GEMINI AI TRANSLATE FAST.',
    speaker: 'Engineer (David)',
    confidence: 0.97,
    bookmarked: true,
    tags: ['technical', 'architecture']
  },
  {
    id: 'tx-sample-6',
    timestamp: Date.now() - 1000 * 60 * 5,
    type: 'sign_to_speech',
    rawSigns: ['THANK YOU', 'GREAT', 'WORK', 'I LOVE YOU'],
    naturalText: 'Thank you so much, that sounds fantastic. Great work team!',
    speaker: 'Signer (Navin)',
    confidence: 0.95,
    bookmarked: true,
    tone: 'appreciative',
    tags: ['closing', 'gratitude']
  }
];

export class StorageService {
  public getTranscripts(): TranscriptItem[] {
    if (typeof window === 'undefined') return SAMPLE_TRANSCRIPTS;
    try {
      const stored = localStorage.getItem(TRANSCRIPTS_KEY);
      if (!stored) {
        localStorage.setItem(TRANSCRIPTS_KEY, JSON.stringify(SAMPLE_TRANSCRIPTS));
        return SAMPLE_TRANSCRIPTS;
      }
      return JSON.parse(stored);
    } catch (e) {
      console.warn('Storage read error, using sample transcripts:', e);
      return SAMPLE_TRANSCRIPTS;
    }
  }

  public saveTranscripts(items: TranscriptItem[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(TRANSCRIPTS_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Storage write error:', e);
    }
  }

  public addTranscript(item: TranscriptItem): TranscriptItem[] {
    const list = this.getTranscripts();
    const updated = [item, ...list];
    this.saveTranscripts(updated);
    return updated;
  }

  public toggleBookmark(id: string): TranscriptItem[] {
    const list = this.getTranscripts();
    const updated = list.map((t) => (t.id === id ? { ...t, bookmarked: !t.bookmarked } : t));
    this.saveTranscripts(updated);
    return updated;
  }

  public deleteTranscript(id: string): TranscriptItem[] {
    const list = this.getTranscripts();
    const updated = list.filter((t) => t.id !== id);
    this.saveTranscripts(updated);
    return updated;
  }

  public clearAllTranscripts(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TRANSCRIPTS_KEY);
  }

  public getSummaries(): Record<string, MeetingSummaryData> {
    if (typeof window === 'undefined') return {};
    try {
      const stored = localStorage.getItem(SUMMARIES_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  }

  public saveSummary(key: string, summary: MeetingSummaryData): void {
    if (typeof window === 'undefined') return;
    try {
      const existing = this.getSummaries();
      existing[key] = summary;
      localStorage.setItem(SUMMARIES_KEY, JSON.stringify(existing));
    } catch (e) {
      console.error('Save summary error:', e);
    }
  }

  // Export functions
  public exportToMarkdown(transcripts: TranscriptItem[]): string {
    const header = `# SignBridge AI - Meeting & Sign Translation Transcript\n*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`;
    const body = transcripts
      .map((t) => {
        const time = new Date(t.timestamp).toLocaleTimeString();
        const typeBadge = t.type === 'sign_to_speech' ? '🤟 [Sign → Speech]' : '🎙️ [Speech → Sign]';
        const speaker = `**${t.speaker}** (${time}) ${typeBadge}`;
        const content = t.naturalText;
        const gloss = t.rawSigns?.length ? `\n> *Raw Signs:* \`${t.rawSigns.join(' ')}\`` : t.aslGloss ? `\n> *ASL Gloss:* \`${t.aslGloss}\`` : '';
        const tone = t.tone ? ` *[Tone: ${t.tone}]*` : '';
        return `${speaker}${tone}\n\n${content}${gloss}\n\n---`;
      })
      .join('\n\n');
    return header + body;
  }

  public exportToJSON(transcripts: TranscriptItem[]): string {
    return JSON.stringify(transcripts, null, 2);
  }

  public downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const storageService = new StorageService();
