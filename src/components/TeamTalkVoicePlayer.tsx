/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TeamTalkVoicePlayer.tsx — Audio playback component for voice messages
 */

import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';

interface VoicePlayerProps {
  url: string;
  durationSec?: number;
  transcript?: string;
  isMine?: boolean;
}

export default function TeamTalkVoicePlayer({ url, durationSec = 0, transcript, isMine }: VoicePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSec);
  const [showTranscript, setShowTranscript] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
    };
    const onEnded = () => { setIsPlaying(false); setCurrentTime(0); setProgress(0); };
    const onLoaded = () => { if (audio.duration && isFinite(audio.duration)) setDuration(audio.duration); };
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('loadedmetadata', onLoaded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('loadedmetadata', onLoaded);
    };
  }, []);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      await audio.play();
      setIsPlaying(true);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const barHeights = [4, 8, 14, 10, 16, 12, 8, 18, 10, 14, 6, 12, 16, 8, 14, 10, 18, 12, 8, 14];

  const navyBase = isMine ? 'bg-white/20 hover:bg-white/30' : 'bg-[#162D4E]/10 hover:bg-[#162D4E]/20';
  const playColor = isMine ? 'text-white' : 'text-[#162D4E]';
  const barActive = isMine ? 'bg-white' : 'bg-[#162D4E]';
  const barInactive = isMine ? 'bg-white/30' : 'bg-slate-300';
  const timeColor = isMine ? 'text-white/70' : 'text-slate-500';
  const transcriptColor = isMine ? 'text-white/60 hover:text-white/90' : 'text-slate-400 hover:text-slate-700';

  return (
    <div className="space-y-1">
      <audio ref={audioRef} src={url} preload="metadata" />
      <div className="flex items-center gap-2.5 min-w-[200px]">
        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${navyBase} ${playColor}`}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying
            ? <Pause className="w-4 h-4 fill-current" />
            : <Play className="w-4 h-4 fill-current ml-0.5" />
          }
        </button>

        {/* Waveform bars */}
        <div className="flex-1 flex items-center gap-[2px] h-6 relative">
          {barHeights.map((h, i) => {
            const pct = (i / barHeights.length) * 100;
            const isActive = pct <= progress;
            return (
              <div
                key={i}
                className={`rounded-full transition-colors duration-100 ${isActive ? barActive : barInactive}`}
                style={{ height: `${h}px`, width: '3px', minWidth: '3px' }}
              />
            );
          })}
        </div>

        {/* Timer */}
        <span className={`text-[12px] font-mono tabular-nums shrink-0 ${timeColor}`}>
          {isPlaying ? formatTime(currentTime) : formatTime(duration)}
        </span>

        <Volume2 className={`w-3.5 h-3.5 shrink-0 ${timeColor}`} />
      </div>

      {/* Transcript toggle */}
      {transcript && (
        <div>
          <button
            onClick={() => setShowTranscript(v => !v)}
            className={`text-[12px] font-medium transition-colors ${transcriptColor}`}
          >
            {showTranscript ? '▲ Hide transcript' : '▼ Show transcript'}
          </button>
          {showTranscript && (
            <p className={`text-[13px] mt-1 leading-relaxed italic ${isMine ? 'text-white/80' : 'text-slate-600'}`}>
              "{transcript}"
            </p>
          )}
        </div>
      )}
    </div>
  );
}
