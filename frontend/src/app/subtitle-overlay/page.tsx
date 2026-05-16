'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface SubtitleSegment {
  id: string;
  text: string;
  translation: string;
}

interface OverlaySettings {
  fontSize: number;
  bgOpacity: number;
  textColor: string;
  translationColor: string;
  maxLines: number;
  showTranslation: boolean;
}

const DEFAULT_SETTINGS: OverlaySettings = {
  fontSize: 20,
  bgOpacity: 0.75,
  textColor: '#ffffff',
  translationColor: '#ffd700',
  maxLines: 3,
  showTranslation: true,
};

const SETTINGS_KEY = 'subtitle_overlay_settings';

function loadSettings(): OverlaySettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_SETTINGS;
}

export default function SubtitleOverlayPage() {
  const [segments, setSegments] = useState<SubtitleSegment[]>([]);
  const [settings, setSettings] = useState<OverlaySettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const translateQueueRef = useRef<Set<string>>(new Set());

  // Load settings from localStorage on mount
  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  // Persist settings whenever they change
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  // Translate a segment via backend
  const translateSegment = useCallback(async (id: string, text: string) => {
    if (!text.trim() || translateQueueRef.current.has(id)) return;
    translateQueueRef.current.add(id);
    try {
      const res = await fetch('http://localhost:5167/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const { translation } = await res.json();
        setSegments(prev =>
          prev.map(s => s.id === id ? { ...s, translation } : s)
        );
      }
    } catch {
      // silent fail
    } finally {
      translateQueueRef.current.delete(id);
    }
  }, []);

  // Listen for transcript-update events from Tauri
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      const { listen } = await import('@tauri-apps/api/event');
      unlisten = await listen<{
        text: string;
        sequence_id: number;
        audio_start_time?: number;
      }>('transcript-update', (event) => {
        const { text, sequence_id } = event.payload;
        if (!text.trim()) return;

        const id = `seg-${sequence_id}`;
        const newSeg: SubtitleSegment = { id, text, translation: '' };

        setSegments(prev => {
          const exists = prev.some(s => s.id === id);
          if (exists) return prev;
          const updated = [...prev, newSeg];
          // Keep only last maxLines segments
          return updated.slice(-settings.maxLines);
        });

        // Fire translation
        if (settings.showTranslation) {
          translateSegment(id, text);
        }
      });
    };

    setup();
    return () => { unlisten?.(); };
  }, [settings.maxLines, settings.showTranslation, translateSegment]);

  // Resize handle: bottom-right corner drag
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = window.innerWidth;
    const startH = window.innerHeight;
    resizeStartRef.current = { x: startX, y: startY, w: startW, h: startH };
    setIsResizing(true);

    const onMove = async (me: MouseEvent) => {
      if (!resizeStartRef.current) return;
      const dw = me.clientX - resizeStartRef.current.x;
      const dh = me.clientY - resizeStartRef.current.y;
      const newW = Math.max(300, resizeStartRef.current.w + dw);
      const newH = Math.max(80, resizeStartRef.current.h + dh);
      try {
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        await getCurrentWebviewWindow().setSize({ type: 'Physical', width: Math.round(newW), height: Math.round(newH) });
      } catch {}
    };

    const onUp = () => {
      setIsResizing(false);
      resizeStartRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleClose = async () => {
    try {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      await getCurrentWebviewWindow().hide();
    } catch {}
  };

  const updateSetting = <K extends keyof OverlaySettings>(key: K, value: OverlaySettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const bgRgba = `rgba(0,0,0,${settings.bgOpacity})`;

  return (
    <div
      className="flex flex-col w-full h-full select-none overflow-hidden"
      style={{ background: 'transparent' }}
    >
      {/* Main subtitle area — draggable */}
      <div
        data-tauri-drag-region
        className="flex-1 flex flex-col justify-end px-3 pb-1 pt-1 rounded-xl relative"
        style={{
          background: bgRgba,
          cursor: isResizing ? 'nwse-resize' : 'move',
        }}
      >
        {/* Top bar: settings gear + close */}
        <div
          data-tauri-drag-region
          className="absolute top-1 right-1 flex gap-1 opacity-30 hover:opacity-100 transition-opacity z-10"
          style={{ pointerEvents: 'auto' }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => setShowSettings(p => !p)}
            className="w-5 h-5 flex items-center justify-center rounded text-white text-xs hover:bg-white/20"
            title="Settings"
          >
            ⚙
          </button>
          <button
            onClick={handleClose}
            className="w-5 h-5 flex items-center justify-center rounded text-white text-xs hover:bg-red-500/60"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Subtitle lines */}
        <div className="space-y-0.5">
          {segments.length === 0 ? (
            <p
              className="text-center opacity-30"
              style={{ fontSize: settings.fontSize, color: settings.textColor }}
            >
              — 等待字幕 / Waiting for speech —
            </p>
          ) : (
            segments.map((seg, i) => {
              const isLatest = i === segments.length - 1;
              return (
                <div key={seg.id} style={{ opacity: isLatest ? 1 : 0.55 }}>
                  <p
                    className="leading-tight font-medium drop-shadow"
                    style={{
                      fontSize: settings.fontSize,
                      color: settings.textColor,
                      textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                    }}
                  >
                    {seg.text}
                  </p>
                  {settings.showTranslation && (
                    <p
                      className="leading-tight drop-shadow"
                      style={{
                        fontSize: Math.round(settings.fontSize * 0.85),
                        color: seg.translation ? settings.translationColor : 'rgba(255,215,0,0.4)',
                        textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                      }}
                    >
                      {seg.translation || '翻譯中…'}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleResizeMouseDown}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize opacity-30 hover:opacity-70"
          style={{ pointerEvents: 'auto' }}
        >
          <svg viewBox="0 0 10 10" className="w-full h-full">
            <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div
          className="rounded-xl mt-1 p-3 space-y-2"
          style={{ background: 'rgba(20,20,20,0.92)' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <span className="text-white text-xs font-semibold">字幕設定 / Subtitle Settings</span>
            <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white text-xs">✕</button>
          </div>

          <SettingRow label={`字體大小 / Font size: ${settings.fontSize}px`}>
            <input
              type="range" min={12} max={48} value={settings.fontSize}
              onChange={e => updateSetting('fontSize', Number(e.target.value))}
              className="w-full accent-yellow-400"
            />
          </SettingRow>

          <SettingRow label={`背景透明度 / BG opacity: ${Math.round(settings.bgOpacity * 100)}%`}>
            <input
              type="range" min={0} max={100} value={Math.round(settings.bgOpacity * 100)}
              onChange={e => updateSetting('bgOpacity', Number(e.target.value) / 100)}
              className="w-full accent-yellow-400"
            />
          </SettingRow>

          <SettingRow label={`顯示行數 / Max lines: ${settings.maxLines}`}>
            <input
              type="range" min={1} max={5} value={settings.maxLines}
              onChange={e => updateSetting('maxLines', Number(e.target.value))}
              className="w-full accent-yellow-400"
            />
          </SettingRow>

          <div className="flex items-center gap-3">
            <span className="text-gray-300 text-xs">字色 / Text</span>
            <input
              type="color" value={settings.textColor}
              onChange={e => updateSetting('textColor', e.target.value)}
              className="w-7 h-6 rounded cursor-pointer border-0"
            />
            <span className="text-gray-300 text-xs">譯色 / Trans</span>
            <input
              type="color" value={settings.translationColor}
              onChange={e => updateSetting('translationColor', e.target.value)}
              className="w-7 h-6 rounded cursor-pointer border-0"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox" checked={settings.showTranslation}
              onChange={e => updateSetting('showTranslation', e.target.checked)}
              className="accent-yellow-400"
            />
            <span className="text-gray-300 text-xs">顯示中文翻譯 / Show Chinese translation</span>
          </label>
        </div>
      )}
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-gray-400 text-xs mb-0.5">{label}</p>
      {children}
    </div>
  );
}
