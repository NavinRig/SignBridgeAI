import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import {
  TrendingUp,
  Activity,
  Award,
  Sparkles,
  RefreshCw,
  PlusCircle,
  Trash2,
  Filter,
  BarChart3,
  Clock,
  Zap
} from 'lucide-react';
import { DetectedGesture } from '../types';
import { hapticService } from '../services/hapticService';

export interface GestureEventRecord {
  id: string;
  name: string;
  category?: string;
  confidence: number;
  timestamp: number; // epoch ms
}

interface GestureFrequencyChartProps {
  currentGesture: DetectedGesture | null;
  historyEvents?: GestureEventRecord[];
  onAddSimulatedSign?: (signName: string) => void;
}

// Preset color palette for distinct gesture lines
const SIGN_COLORS = [
  { stroke: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.4)', text: 'text-sky-300' },     // Sky Blue
  { stroke: '#34d399', bg: 'rgba(52, 211, 153, 0.15)', border: 'rgba(52, 211, 153, 0.4)', text: 'text-emerald-300' }, // Emerald
  { stroke: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.4)', text: 'text-purple-300' },  // Purple
  { stroke: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)', border: 'rgba(251, 191, 36, 0.4)', text: 'text-amber-300' },   // Amber
  { stroke: '#f43f5e', bg: 'rgba(244, 63, 94, 0.15)', border: 'rgba(244, 63, 94, 0.4)', text: 'text-rose-300' },      // Rose
  { stroke: '#818cf8', bg: 'rgba(129, 140, 248, 0.15)', border: 'rgba(129, 140, 248, 0.4)', text: 'text-indigo-300' }, // Indigo
];

// Default meeting signs to seed past 10 minutes
const SEED_SIGNS_POOL = [
  'HELLO', 'HELLO', 'HELLO', 'HELLO',
  'YES', 'YES', 'YES',
  'THANK YOU', 'THANK YOU', 'THANK YOU',
  'PLEASE', 'PLEASE',
  'HELP',
  'I LOVE YOU',
  'GOOD',
  'AGREE'
];

export const GestureFrequencyChart: React.FC<GestureFrequencyChartProps> = ({
  currentGesture,
  onAddSimulatedSign,
}) => {
  // 1. Gesture event log state
  const [events, setEvents] = useState<GestureEventRecord[]>(() => {
    // Generate initial 10-minute historical sample data so chart is immediately rich and informative
    const now = Date.now();
    const initialEvents: GestureEventRecord[] = [];

    // Distribution across 10 minutes (0 to 9 minutes ago)
    const distribution = [
      { minsAgo: 9.2, sign: 'HELLO', conf: 0.96 },
      { minsAgo: 8.8, sign: 'HELLO', conf: 0.94 },
      { minsAgo: 8.1, sign: 'YES', conf: 0.92 },
      { minsAgo: 7.4, sign: 'THANK YOU', conf: 0.97 },
      { minsAgo: 6.9, sign: 'HELLO', conf: 0.95 },
      { minsAgo: 6.2, sign: 'PLEASE', conf: 0.91 },
      { minsAgo: 5.6, sign: 'YES', conf: 0.94 },
      { minsAgo: 5.1, sign: 'HELP', conf: 0.89 },
      { minsAgo: 4.5, sign: 'THANK YOU', conf: 0.98 },
      { minsAgo: 4.0, sign: 'HELLO', conf: 0.96 },
      { minsAgo: 3.4, sign: 'I LOVE YOU', conf: 0.95 },
      { minsAgo: 2.8, sign: 'YES', conf: 0.93 },
      { minsAgo: 2.1, sign: 'PLEASE', conf: 0.92 },
      { minsAgo: 1.5, sign: 'THANK YOU', conf: 0.96 },
      { minsAgo: 0.8, sign: 'HELLO', conf: 0.98 },
      { minsAgo: 0.3, sign: 'YES', conf: 0.95 },
    ];

    distribution.forEach((item, index) => {
      initialEvents.push({
        id: `seed-${index}-${now}`,
        name: item.sign,
        confidence: item.conf,
        timestamp: now - item.minsAgo * 60 * 1000,
      });
    });

    return initialEvents;
  });

  // Track the last recorded gesture timestamp to avoid duplicate recordings
  const lastRecordedRef = React.useRef<{ name: string; time: number }>({ name: '', time: 0 });

  // 2. Real-time capture when live gesture is detected
  useEffect(() => {
    if (!currentGesture || !currentGesture.isStable || currentGesture.name === 'UNKNOWN' || currentGesture.name === 'NO_HAND') {
      return;
    }

    const now = Date.now();
    if (
      currentGesture.name === lastRecordedRef.current.name &&
      now - lastRecordedRef.current.time < 1200
    ) {
      return;
    }

    lastRecordedRef.current = { name: currentGesture.name, time: now };

    const newRecord: GestureEventRecord = {
      id: `live-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: currentGesture.name,
      category: currentGesture.category,
      confidence: currentGesture.confidence || 0.92,
      timestamp: now,
    };

    setEvents((prev) => [...prev, newRecord]);
  }, [currentGesture]);

  // Periodic re-render ticker every 15s to keep the 10-minute sliding window up to date
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // 3. Filter events within the 10-minute window
  const tenMinutesAgo = currentTime - 10 * 60 * 1000;
  const recentEvents = useMemo(() => {
    return events.filter((e) => e.timestamp >= tenMinutesAgo);
  }, [events, tenMinutesAgo]);

  // 4. Calculate frequencies for all signs in the 10-minute window
  const signFrequencies = useMemo(() => {
    const counts: Record<string, number> = {};
    recentEvents.forEach((e) => {
      counts[e.name] = (counts[e.name] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [recentEvents]);

  // Determine top 4 most common signs (plus remaining grouped if needed)
  const topSigns = useMemo(() => {
    return signFrequencies.slice(0, 4).map((s) => s.name);
  }, [signFrequencies]);

  // Active filter state: which signs are visible on chart
  const [hiddenSigns, setHiddenSigns] = useState<Record<string, boolean>>({});
  const [showTotalLine, setShowTotalLine] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'individual' | 'total'>('individual');

  const toggleSignVisibility = (sign: string) => {
    setHiddenSigns((prev) => ({
      ...prev,
      [sign]: !prev[sign],
    }));
    hapticService.trigger('light');
  };

  // 5. Construct 10 discrete 1-minute time bucket data points
  const chartData = useMemo(() => {
    // 10 buckets: 9m ago, 8m ago, ... 1m ago, Current
    const buckets: Array<{
      minuteIndex: number;
      timeLabel: string;
      rawTime: number;
      total: number;
      [signName: string]: any;
    }> = [];

    for (let i = 9; i >= 0; i--) {
      const bucketStartTime = currentTime - (i + 1) * 60 * 1000;
      const bucketEndTime = currentTime - i * 60 * 1000;

      const dateObj = new Date(bucketEndTime);
      const hours = dateObj.getHours().toString().padStart(2, '0');
      const mins = dateObj.getMinutes().toString().padStart(2, '0');
      const timeLabel = i === 0 ? 'Now' : `${hours}:${mins}`;

      const bucketEvents = recentEvents.filter(
        (e) => e.timestamp >= bucketStartTime && e.timestamp < bucketEndTime
      );

      const bucketItem: any = {
        minuteIndex: 9 - i,
        timeLabel: i === 0 ? 'Now' : `${i}m ago (${timeLabel})`,
        shortLabel: i === 0 ? 'Now' : `-${i}m`,
        rawTime: bucketEndTime,
        total: bucketEvents.length,
      };

      // Populate top signs counts
      topSigns.forEach((sign) => {
        bucketItem[sign] = bucketEvents.filter((e) => e.name === sign).length;
      });

      buckets.push(bucketItem);
    }

    return buckets;
  }, [recentEvents, currentTime, topSigns]);

  // Stats Calculations
  const totalDetectedSigns = recentEvents.length;
  const mostCommonSign = signFrequencies[0] || null;
  const mostCommonPercent = totalDetectedSigns > 0 && mostCommonSign
    ? Math.round((mostCommonSign.count / totalDetectedSigns) * 100)
    : 0;
  const averageVelocity = (totalDetectedSigns / 10).toFixed(1); // signs per minute
  const uniqueSignsCount = signFrequencies.length;

  // Handler to simulate/add a sign into the stream
  const handleAddSample = (signName: string) => {
    const newRecord: GestureEventRecord = {
      id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: signName,
      confidence: 0.95,
      timestamp: Date.now(),
    };
    setEvents((prev) => [...prev, newRecord]);
    hapticService.trigger('medium');
    if (onAddSimulatedSign) {
      onAddSimulatedSign(signName);
    }
  };

  // Handler to clear history
  const handleClearHistory = () => {
    setEvents([]);
    hapticService.trigger('light');
  };

  // Reset to default seeds
  const handleResetSeeds = () => {
    const now = Date.now();
    const seeded: GestureEventRecord[] = [];
    const samplePool = ['HELLO', 'YES', 'THANK YOU', 'PLEASE', 'HELP', 'I LOVE YOU'];
    
    for (let i = 0; i < 20; i++) {
      const randomMins = Math.random() * 9.5;
      const randomSign = samplePool[Math.floor(Math.random() * samplePool.length)];
      seeded.push({
        id: `seeded-${i}-${now}`,
        name: randomSign,
        confidence: 0.9 + Math.random() * 0.08,
        timestamp: now - randomMins * 60 * 1000,
      });
    }
    setEvents(seeded);
    hapticService.trigger('success');
  };

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-3 bg-[#0F172A]/95 border border-white/15 rounded-2xl shadow-2xl backdrop-blur-xl text-xs space-y-1.5 min-w-[170px]">
          <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              {label}
            </span>
            <span className="text-[10px] font-mono text-slate-400">10m Window</span>
          </div>

          <div className="space-y-1 pt-1">
            {payload.map((entry: any, index: number) => {
              const signName = entry.name;
              const value = entry.value;
              return (
                <div key={index} className="flex items-center justify-between gap-3 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="font-medium text-slate-200">{signName}:</span>
                  </div>
                  <span className="font-bold font-mono text-white">
                    {value} {value === 1 ? 'sign' : 'signs'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-5 rounded-3xl bg-white/[0.05] border border-white/10 backdrop-blur-2xl shadow-2xl shadow-black/30 space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-blue-400 border border-blue-500/30 backdrop-blur-md shadow-sm">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                10-Minute Gesture Frequency & Sign Velocity
              </h3>
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 backdrop-blur-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Tracker
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Identifies your most frequently signed ASL gestures and usage patterns during active video calls
            </p>
          </div>
        </div>

        {/* View Mode & Quick Actions */}
        <div className="flex items-center gap-2">
          {/* Mode switch */}
          <div className="flex items-center p-0.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
            <button
              onClick={() => setViewMode('individual')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'individual'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Top Signs
            </button>
            <button
              onClick={() => setViewMode('total')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'total'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign Velocity
            </button>
          </div>

          <button
            onClick={handleResetSeeds}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 backdrop-blur-md transition-colors"
            title="Seed sample 10-minute meeting data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleClearHistory}
            className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-white/10 backdrop-blur-md transition-colors"
            title="Reset history"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Cards Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Metric 1: Total Signs */}
        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold">10-Min Total</span>
            <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white">
            {totalDetectedSigns}
            <span className="text-xs font-normal text-slate-400 ml-1">signs</span>
          </div>
          <div className="text-[10px] text-slate-400">In rolling 10m window</div>
        </div>

        {/* Metric 2: Top Sign */}
        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold">Most Common</span>
            <Award className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-base font-bold font-mono text-amber-300 truncate">
            {mostCommonSign ? mostCommonSign.name : 'None yet'}
          </div>
          <div className="text-[10px] text-slate-400">
            {mostCommonSign ? `${mostCommonSign.count} times (${mostCommonPercent}%)` : 'Awaiting signs'}
          </div>
        </div>

        {/* Metric 3: Signing Rate */}
        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold">Signing Rate</span>
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-300">
            {averageVelocity}
            <span className="text-xs font-normal text-slate-400 ml-1">/min</span>
          </div>
          <div className="text-[10px] text-slate-400">Active communication pace</div>
        </div>

        {/* Metric 4: Vocabulary Diversity */}
        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold">Vocabulary Range</span>
            <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl font-bold font-mono text-purple-300">
            {uniqueSignsCount}
            <span className="text-xs font-normal text-slate-400 ml-1">unique</span>
          </div>
          <div className="text-[10px] text-slate-400">Distinct ASL signs logged</div>
        </div>
      </div>

      {/* Main Recharts Line Chart Visualization */}
      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-md">
        <div className="h-[230px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255, 255, 255, 0.08)"
                vertical={false}
              />
              <XAxis
                dataKey="shortLabel"
                stroke="#94a3b8"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
              />
              <YAxis
                stroke="#94a3b8"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                allowDecimals={false}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
              />
              <Tooltip content={<CustomTooltip />} />

              {viewMode === 'individual' ? (
                <>
                  {topSigns.map((sign, index) => {
                    const color = SIGN_COLORS[index % SIGN_COLORS.length];
                    if (hiddenSigns[sign]) return null;

                    return (
                      <Line
                        key={sign}
                        type="monotone"
                        dataKey={sign}
                        name={sign}
                        stroke={color.stroke}
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: color.stroke, strokeWidth: 1, stroke: '#0F172A' }}
                        activeDot={{ r: 5, stroke: '#ffffff', strokeWidth: 2 }}
                        isAnimationActive={true}
                        animationDuration={400}
                      />
                    );
                  })}

                  {showTotalLine && (
                    <Line
                      type="monotone"
                      dataKey="total"
                      name="Total Signs"
                      stroke="#94a3b8"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={false}
                      isAnimationActive={true}
                    />
                  )}
                </>
              ) : (
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Sign Frequency Rate (signs/min)"
                  stroke="#38bdf8"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#38bdf8', strokeWidth: 2, stroke: '#0F172A' }}
                  activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2 }}
                  isAnimationActive={true}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Interactive Legend & Filter Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-2 border-t border-white/10">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-blue-400" /> Filter Signs:
            </span>

            {topSigns.map((sign, idx) => {
              const color = SIGN_COLORS[idx % SIGN_COLORS.length];
              const isHidden = hiddenSigns[sign];
              const count = signFrequencies.find((s) => s.name === sign)?.count || 0;

              return (
                <button
                  key={sign}
                  onClick={() => toggleSignVisibility(sign)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all border ${
                    isHidden
                      ? 'bg-white/5 border-white/10 text-slate-500 line-through opacity-60'
                      : 'bg-white/[0.06] border-white/15 text-slate-200 hover:text-white shadow-sm'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: isHidden ? '#64748b' : color.stroke }}
                  />
                  <span>{sign}</span>
                  <span className="text-[10px] font-mono opacity-80">({count})</span>
                </button>
              );
            })}

            {topSigns.length > 0 && (
              <button
                onClick={() => setShowTotalLine(!showTotalLine)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all border ${
                  !showTotalLine
                    ? 'bg-white/5 border-white/10 text-slate-500 line-through opacity-60'
                    : 'bg-white/[0.06] border-white/15 text-slate-300'
                }`}
              >
                <span className="w-2 h-0.5 bg-slate-400" />
                <span>Total Line</span>
              </button>
            )}
          </div>

          {/* Quick Sign Simulator Buttons */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <PlusCircle className="w-3 h-3 text-emerald-400" /> Quick Add Sign:
            </span>
            {['HELLO', 'YES', 'THANK YOU', 'PLEASE'].map((sign) => (
              <button
                key={sign}
                onClick={() => handleAddSample(sign)}
                className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-blue-500/20 text-slate-300 hover:text-blue-300 hover:border-blue-400/40 border border-white/10 text-[11px] font-mono font-medium transition-all"
              >
                +{sign}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top 4 Most Common Signs Breakdown Progress Bars */}
      {signFrequencies.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              Most Frequent Signs Breakdown (Last 10 Minutes)
            </span>
            <span className="text-[11px] text-slate-400">
              Total {totalDetectedSigns} occurrences
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {signFrequencies.slice(0, 4).map((item, idx) => {
              const color = SIGN_COLORS[idx % SIGN_COLORS.length];
              const percent = totalDetectedSigns > 0
                ? Math.round((item.count / totalDetectedSigns) * 100)
                : 0;

              return (
                <div
                  key={item.name}
                  className="p-3 rounded-xl bg-white/[0.03] border border-white/10 backdrop-blur-md space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white font-mono flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: color.stroke }}
                      />
                      {item.name}
                    </span>
                    <span className="font-mono text-slate-300 font-semibold">
                      {item.count}x ({percent}%)
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(percent, 100)}%`,
                        backgroundColor: color.stroke,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
