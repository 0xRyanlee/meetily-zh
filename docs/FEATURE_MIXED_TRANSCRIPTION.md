# 混合转写模式 (Mixed Transcription Mode)

## 概述

在会议进行时使用 Whisper 进行实时逐字显示，会议结束后使用 Parakeet 进行高质量批量转写。

## 背景

- **Parakeet**: 快速、精准，但不支持 partial transcript，无法实时显示
- **Whisper**: 支持 partial transcript，可以逐字出现，但批次处理速度不如 Parakeet

## 设计目标

1. 会议中: Whisper (streaming) → 实时逐字出现、实时翻译、说话时段标记
2. 会议结束: Parakeet → 高质量完整转写，合并/替换实时结果

## 现状分析

### 已实现功能

| 功能 | 状态 | 位置 |
|------|------|------|
| Whisper partial transcript | ✅ 已实现 | `TranscriptUpdate.is_partial` |
| 实时翻译 (中↔英) | ✅ 已实现 | `translationService.ts`, `/translate` API |
| TranscriptContext 处理 partial | ✅ 已实现 | `contexts/TranscriptContext.tsx` |
| 预设模型选择 | ✅ 已实现 | `TranscriptSettings.tsx` |
| post_processor | ✅ 已实现 | `audio/post_processor.rs` |

### 缺失功能

| 功能 | 状态 | 说明 |
|------|------|------|
| 实时说话时段区分 | ❌ | 仅靠 VAD 分段，无说话者区分 |
| 实时总结要点 | ❌ | 需要 LLM 实时处理 |
| 会后 Parakeet 重转写 | ❌ | 会议结束后没有触发二次转写 |
| 预设改 Whisper | ⚠️ | 默认仍偏 Parakeet |

## 实现方案

### Phase 1: 实时模式 (Whisper)

#### 1.1 预设切换
- 将默认 provider 从 `parakeet` 改为 `localWhisper`
- 或在 TranscriptSettings 中添加选项让用户选择

```typescript
// frontend/src/constants/modelDefaults.ts
export const DEFAULT_TRANSCRIPT_PROVIDER = 'localWhisper'; // 改为 Whisper
```

#### 1.2 前端渲染优化
- 确保 `is_partial: true` 时使用不同样式（如灰色/半透明）
- 更新时保留 partial 内容，正式结果再替换

#### 1.3 实时翻译
- 当前已有 `translationEnabled` 开关
- 需确保 partial transcript 也触发翻译

### Phase 2: 说话时段标记

#### 2.1 VAD 分段 → 简单说话标记
- 当前 VAD 已经分段
- 每个分段可标记为 "Segment N"
- 不做完整的 speaker diarization（超出此功能范围）

```rust
// audio/transcription/worker.rs
// 为每个 segment 添加简单标记
pub struct TranscriptUpdate {
    pub segment_id: u32,  // 新增：VAD 段落编号
    // ...
}
```

### Phase 3: 实时总结要点 (可选)

#### 3.1 增量 LLM 处理
- 每 N 个 segment 调用一次 LLM
- 提取关键点并累积
- 需要后端 / Ollama 支持

### Phase 4: 会后 Parakeet 重转写

#### 4.1 会议结束触发
```rust
// audio/recording_manager.rs
// 会议结束后
pub fn on_recording_stopped(&self) {
    // 触发 Parakeet 重转写
    spawn(async {
        let audio_path = self.get_final_audio_path();
        let result = parakeet_engine::transcribe_full(audio_path).await;
        // 合并到 transcripts
    });
}
```

#### 4.2 结果合并
- Parakeet 结果作为 "final" 版本
- 可选择保留或替换实时结果

## 配置建议

```typescript
// transcript-config.json
{
  "live": {
    "provider": "localWhisper",
    "model": "large-v3-turbo",
    "enablePartial": true,
    "enableTranslation": true,
    "summaryInterval": 5  // 每 5 个 segment 做一次总结
  },
  "postProcess": {
    "provider": "parakeet",
    "model": "parakeet-tdt-0.6b-v3-int8",
    "enabled": true
  }
}
```

## 工作量估算

| 任务 | 预估工时 | 优先级 |
|------|----------|--------|
| 预设改为 Whisper | 0.5h | P0 |
| partial transcript 样式优化 | 1h | P0 |
| 会后 Parakeet 重转写 | 3-4h | P1 |
| 说话时段简单标记 | 2h | P1 |
| 实时翻译优化 | 1h | P2 |
| 实时总结要点 | 4-6h | P3 |

## 相关文件

- `frontend/src-tauri/src/audio/transcription/engine.rs` - Engine 选择逻辑
- `frontend/src-tauri/src/audio/transcription/worker.rs` - 转写 worker
- `frontend/src/contexts/TranscriptContext.tsx` - 前端 transcript 状态
- `frontend/src/components/TranscriptSettings.tsx` - 模型选择 UI
- `backend/app/main.py` - 翻译 API (`/translate`)

---

# UI 紧凑化设计 (Space-Efficient UI)

## 背景

主要使用场景：
1. **Google Meet / Zoom / Teams 视频会议** - 需要在屏幕角落显示，不遮挡会议画面
2. **面对面会议** - 手机/平板放置桌面，需要最小化占用
3. **多任务处理** - 用户可能同时看其他应用

## 当前 UI 分析

### 主页面 (page.tsx)
```
┌─────────────────────────────────────────────────────────┐
│ Sidebar (16rem / 4rem)  │  TranscriptPanel  │ LiveHighlights │
│    meetings list        │    转写内容          │   实时要点      │
│                        │                    │               │
│                        │                    │               │
└─────────────────────────────────────────────────────────┘
                              ↓
              RecordingControls (fixed bottom)
```

**问题**：
- Sidebar 占用 16rem (256px)，即使折叠也有 4rem
- TranscriptPanel 和 LiveHighlightsPanel 并排占用大量空间
- RecordingControls 在底部占用约 80px 高度

### 字幕浮窗 (subtitle-overlay/page.tsx)
```
┌────────────────────────────────────────┐
│  🌍 ⚙️                                │
│ ──────────────────────────────────────│
│  [Transcript text here...]            │
│  [Translation if enabled...]          │
│                                        │
│  ▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ← resize handle
└────────────────────────────────────────┘
```

**问题**：
- 字幕区域高度不自动适应内容
- 设置按钮和语言切换占用额外高度
- resize handle 高度固定

## 紧凑化方案

### 1. 字幕浮窗优化 (高优先级)

#### 1.1 自动高度
```tsx
// subtitle-overlay/page.tsx
// 内容自适应高度，不再固定高度
const [overlayHeight, setOverlayHeight] = useState<number>(120); // 默认最小高度

// 内容区域根据实际文字行数调整
const contentHeight = Math.min(
  Math.max(segments.length * 24 + 40, 80),  // 每行约 24px，最少 80px
  300  // 最多 300px
);
```

#### 1.2 最小化模式
- 隐藏翻译，只显示原文
- 隐藏设置按钮（悬停时显示）
- 只保留核心功能：文字显示

#### 1.3 紧凑布局
```tsx
// 减少 padding 和 margin
const COMPACT_PADDING = 8;  // 从 16px 减到 8px
const COMPACT_FONT_SIZE = 16;  // 从 20px 减到 16px
const COMPACT_LINE_HEIGHT = 1.4;
```

#### 1.4 快捷键支持
- `Ctrl+Shift+H` 切换字幕显示
- `Ctrl+Shift+T` 切换翻译
- `Ctrl+Shift+,` 调整位置（角落）

#### 1.5 主界面字幕按钮
在 RecordingControls 或 TranscriptPanel 添加字幕开关按钮：
```tsx
<Button
  variant={subtitleEnabled ? 'blue' : 'outline'}
  size="sm"
  onClick={() => setSubtitleEnabled(!subtitleEnabled)}
  title={subtitleEnabled ? '关闭字幕' : '显示字幕'}
>
  <Captions />
  <span className="hidden md:inline">{subtitleEnabled ? '隐藏字幕' : '显示字幕'}</span>
</Button>
```

打开时跳转到 `/subtitle-overlay` 页面或打开浮窗模式

### 2. 主页面优化

#### 2.1 Sidebar 更加紧凑
```tsx
// Sidebar/index.tsx
// 折叠时宽度从 4rem 减到 2.5rem (40px)
const COLLAPSED_WIDTH = '2.5rem';

// 会议列表项高度从 48px 减到 36px
const ITEM_HEIGHT = 36;
```

#### 2.2 响应式布局
- **拖拽调整宽度**：用户手动调整宽度
- **窄屏 (< 400px)**：自动隐藏 LiveHighlightsPanel，只保留 TranscriptPanel
- **宽屏 (>= 400px)**：保留两个面板
- **非录制时**：恢复正常布局

#### 2.3 RecordingControls 紧凑化
```tsx
// 当前：圆形按钮 + 文字标签 + 时间显示
// 优化后：
// - 录制时：只保留录音指示器和停止按钮
// - 非录制时：简洁的开始按钮
```

### 3. 移动端适配（竖屏场景）

#### 3.1 竖屏布局
- Sidebar 隐藏（或作为底部滑出面板）
- TranscriptPanel 全屏，但可收缩
- 字幕浮窗固定在顶部/底部边缘

#### 3.2 触控优化
- 更大的触摸区域
- 手势支持（上滑隐藏、下滑显示）

### 4. 具体参数调整

| 组件 | 当前值 | 建议值 | 效果 |
|------|--------|--------|------|
| Sidebar 折叠宽度 | 4rem (64px) | 2.5rem (40px) | +24px 空间 |
| Sidebar 展开宽度 | 16rem (256px) | 14rem (224px) | +32px 空间 |
| 会议项高度 | 48px | 36px | +12px/项 |
| 字幕区域默认高度 | 150px | 自适应 (80-200px) | 节省 30-70px |
| 字幕字体 | 20px | 16px | 减少视觉干扰 |
| TranscriptPanel padding | 16px | 8px | 更紧凑 |
| RecordingControls 高度 | 80px | 56px | +24px 底部空间 |

## 实现计划

### Phase 1: 字幕浮窗紧凑化 ✅ 已完成
1. ✅ 自动高度调整 (已有)
2. ✅ 减少 fontSize 20px → 16px
3. ✅ 添加快捷键 (Ctrl+Shift+H 切换翻译, Ctrl+Shift+Q 关闭)
4. ✅ 主界面已有 Captions 按钮

### Phase 2: 主页面响应式布局 ✅ 已完成
1. ✅ 面板之间添加可拖拽分隔条
2. ✅ 窄屏 (< 400px) 自动隐藏 LiveHighlightsPanel
3. ✅ 宽屏 (>= 400px) 保留两个面板
4. ✅ 主页面添加快捷键 Ctrl+Shift+H 切换字幕显示

### Phase 3: Sidebar 紧凑化 ✅ 已完成
1. ✅ 折叠宽度 4rem → 2.5rem (w-16 → w-10)
2. ✅ 展开宽度 16rem → 14rem (w-64 → w-56)
3. ✅ 同步更新 page.tsx 和 StatusOverlays 的 margin

### Phase 4: 交互优化 (待做)
1. 手势操作
2. 触控优化

### Phase 5: 混合转写模式 (Whisper 实时 + Parakeet 事后)

#### 5.1 预设改为 Whisper ✅ 已完成
- ✅ `api/api.rs`: 默认 provider 改为 `localWhisper`
- ✅ `audio/transcription/engine.rs`: fallback 默认改为 Whisper
- 用户首次启动时将使用 Whisper，支持 partial transcript 实时显示

#### 5.2 会后 Parakeet 重转写 ✅ 已实现
- ✅ `useRecordingStop.ts`: 会议结束后检查是否启用 Parakeet 后处理
- ✅ 如果 Whisper 实时转写 + 启用了后处理，会自动触发 Parakeet 重转写
- ✅ 使用 `start_retranscription_command` 调用 Parakeet 引擎

**启用方式**：
- 在设置页面 (Settings → Recordings) 中开启 "High-Quality Transcription (Parakeet)" 开关
- 或手动在控制台: `localStorage.setItem('parakeet_post_process_enabled', 'true')`

#### 5.3 相关文件
- `frontend/src-tauri/src/api/api.rs` - ✅ 已改默认
- `frontend/src-tauri/src/audio/transcription/engine.rs` - ✅ 已改默认
- `frontend/src/hooks/useRecordingStop.ts` - ✅ 已添加后处理触发

## 相关文件

- `frontend/src/app/subtitle-overlay/page.tsx` - 字幕浮窗
- `frontend/src/components/Sidebar/index.tsx` - 侧边栏
- `frontend/src/app/page.tsx` - 主页面布局
- `frontend/src/components/RecordingControls.tsx` - 录音控制