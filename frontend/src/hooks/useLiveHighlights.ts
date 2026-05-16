import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Transcript } from '@/types';
import { generateLiveHighlights, LiveHighlightsResponse } from '@/services/liveHighlightsService';

type LiveHighlightsStatus = 'idle' | 'generating' | 'ready' | 'error';

export interface LiveHighlightsState extends LiveHighlightsResponse {
  status: LiveHighlightsStatus;
  error: string | null;
  updatedAt: number | null;
}

export interface StoredLiveHighlightsDraft extends LiveHighlightsResponse {
  updatedAt?: number | null;
}

interface UseLiveHighlightsOptions {
  transcripts: Transcript[];
  isRecording: boolean;
  modelName?: string;
}

const TRANSCRIPT_WINDOW_SIZE = 24;
const MIN_SEGMENTS = 6;
const MIN_CHARS = 120;
export const LIVE_HIGHLIGHTS_STORAGE_KEY = 'meetily_live_highlights_draft';

function formatTranscriptWindow(transcripts: Transcript[]): string {
  return transcripts
    .map((transcript) => {
      const seconds = transcript.audio_start_time ?? 0;
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      const timestamp = `[${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}]`;
      return `${timestamp} ${transcript.text}`;
    })
    .join('\n');
}

function getAdaptiveSegmentDelta(segmentCount: number, transcriptLength: number): number {
  if (segmentCount < 10 || transcriptLength < 240) return 4;
  if (segmentCount < 18 || transcriptLength < 520) return 6;
  return 9;
}

function getAdaptiveIntervalMs(segmentCount: number, transcriptLength: number): number {
  if (segmentCount < 10 || transcriptLength < 240) return 15_000;
  if (segmentCount < 18 || transcriptLength < 520) return 22_000;
  return 35_000;
}

export function useLiveHighlights({
  transcripts,
  isRecording,
  modelName = 'gemma3:1b',
}: UseLiveHighlightsOptions) {
  const [state, setState] = useState<LiveHighlightsState>({
    key_points: [],
    action_items: [],
    decisions: [],
    status: 'idle',
    error: null,
    updatedAt: null,
  });

  const inFlightRef = useRef(false);
  const lastGeneratedCountRef = useRef(0);
  const lastGeneratedAtRef = useRef(0);
  const lastTranscriptPayloadRef = useRef('');
  const lastGeneratedLengthRef = useRef(0);
  const wasRecordingRef = useRef(isRecording);

  const recentTranscripts = useMemo(
    () => transcripts.filter((transcript) => transcript.text.trim()).slice(-TRANSCRIPT_WINDOW_SIZE),
    [transcripts]
  );

  const transcriptPayload = useMemo(
    () => formatTranscriptWindow(recentTranscripts),
    [recentTranscripts]
  );

  const generate = useCallback(async (force = false) => {
    if (inFlightRef.current) return;
    if (!isRecording && !force) return;
    if (recentTranscripts.length < MIN_SEGMENTS) return;
    if (transcriptPayload.length < MIN_CHARS) return;

    const now = Date.now();
    const newSegments = recentTranscripts.length - lastGeneratedCountRef.current;
    const newChars = transcriptPayload.length - lastGeneratedLengthRef.current;
    const elapsed = now - lastGeneratedAtRef.current;
    const transcriptUnchanged = transcriptPayload === lastTranscriptPayloadRef.current;
    const adaptiveSegmentDelta = getAdaptiveSegmentDelta(recentTranscripts.length, transcriptPayload.length);
    const adaptiveIntervalMs = getAdaptiveIntervalMs(recentTranscripts.length, transcriptPayload.length);

    if (!force) {
      if (transcriptUnchanged) return;
      if (
        lastGeneratedCountRef.current > 0 &&
        newSegments < adaptiveSegmentDelta &&
        newChars < 220 &&
        elapsed < adaptiveIntervalMs
      ) {
        return;
      }
    }

    inFlightRef.current = true;
    setState((prev) => ({
      ...prev,
      status: 'generating',
      error: null,
    }));

    try {
      const result = await generateLiveHighlights(transcriptPayload, modelName, 5);
      lastGeneratedCountRef.current = recentTranscripts.length;
      lastGeneratedAtRef.current = now;
      lastGeneratedLengthRef.current = transcriptPayload.length;
      lastTranscriptPayloadRef.current = transcriptPayload;
      setState({
        ...result,
        status: 'ready',
        error: null,
        updatedAt: now,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        status: prev.updatedAt ? 'ready' : 'error',
        error: error instanceof Error ? error.message : 'Failed to generate live highlights',
      }));
    } finally {
      inFlightRef.current = false;
    }
  }, [isRecording, modelName, recentTranscripts, transcriptPayload]);

  useEffect(() => {
    if (!isRecording) return;
    void generate(false);
  }, [isRecording, generate, transcripts.length]);

  useEffect(() => {
    if (wasRecordingRef.current && !isRecording && transcripts.length > 0) {
      void generate(true);
    }
    wasRecordingRef.current = isRecording;
  }, [generate, isRecording, transcripts.length]);

  useEffect(() => {
    if (!isRecording) return;

    const interval = window.setInterval(() => {
      void generate(false);
    }, 15_000);

    return () => window.clearInterval(interval);
  }, [isRecording, generate]);

  useEffect(() => {
    if (transcripts.length === 0) {
      lastGeneratedCountRef.current = 0;
      lastGeneratedAtRef.current = 0;
      lastGeneratedLengthRef.current = 0;
      lastTranscriptPayloadRef.current = '';
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(LIVE_HIGHLIGHTS_STORAGE_KEY);
      }
      setState({
        key_points: [],
        action_items: [],
        decisions: [],
        status: 'idle',
        error: null,
        updatedAt: null,
      });
    }
  }, [transcripts.length]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (state.updatedAt && (state.key_points.length || state.action_items.length || state.decisions.length)) {
      sessionStorage.setItem(LIVE_HIGHLIGHTS_STORAGE_KEY, JSON.stringify({
        key_points: state.key_points,
        action_items: state.action_items,
        decisions: state.decisions,
        updatedAt: state.updatedAt,
      }));
    }
  }, [state]);

  return {
    ...state,
    refresh: () => generate(true),
  };
}
