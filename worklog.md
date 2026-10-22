# Teka Worklog

---
Task ID: 1
Agent: Z.ai Code (main)
Task: Level-up Teka app — glassmorphism UI, pro animations, new features (image gen, voice input, TTS, quick tools, XP system)

Work Log:
- Fixed `teka-gradient-text` broken by Lightning CSS: `background:` shorthand + oklch → @supports fallback reset `background-clip`. Solved by using `background-image` longhand + `color-mix(in oklab, var(--primary) …)` (unprecomputable, no fallback emitted).
- Confirmed `sanitizeReply` already integrated via `callLlm()` in `src/lib/llm.ts` (applies to chat + regenerate paths).
- Upgraded brain in `src/lib/teka.ts`: HISTORY_LIMIT 40→60, MEMORY_LIMIT 60→120, MEMORY_SNIPPET 260→320; warmer slang persona (آتیشی، فازت چیه، بزن بریم), empathy-first + personality instructions.
- New API `src/app/api/asr/route.ts`: audio data-URL (base64) → `zai.audio.asr.create` → { text }, with size cap and Persian errors.
- New API `src/app/api/image/route.ts`: prompt → `zai.images.generations.create` (1024x1024) → stored as `TEKA_IMG::<dataURL>` assistant message; user request stored as `🎨 درخواست تصویر: …`. Content-filter fallback: if generation fails, prompt is auto-translated to an English art prompt via `callLlm` and retried.
- New client util `src/lib/audio-recorder.ts`: `TekaRecorder` (Web Audio ScriptProcessor → 16-bit PCM WAV blob) + `blobToDataUrl`.
- `globals.css`: added `.teka-glass` / `.teka-glass-strong` (backdrop blur + saturate), `.teka-shine` hover sweep, `.teka-think` glow, `.teka-rec` red pulse, `.teka-img-frame`, `.teka-xp-bar`, `.teka-star` twinkle, 4th aurora blob (teka-blob-4), prefers-reduced-motion block; blob blur 90→100px.
- `chat-input.tsx` rewritten: mic button (record → /api/asr → text into input, 60s max, live timer), image-mode toggle (🎨 placeholder, 600 char cap, submit routes to onSendImage), quick-tool chips row (7 one-tap prompts), glass-strong bar, shine send button.
- `message-list.tsx`: spring transitions (stiffness 340 / damping 28), glass bubbles, `ImageMessage` renderer (glass frame + دانلود link), painting-aware TypingIndicator («🎨 داره نقاشی می‌کشه…»), EmptyState feature chips updated (تصویرساز، با صدا بگو، سطح‌بندی…).
- `sidebar.tsx`: glass aside, XP/level system in footer (level = floor(totalMsgs/10)+1, ranks: تازه‌کار خفن→رفیق باحال→حرفه‌ای→استار→افسانه‌ای, animated progress bar, «N پیام تا سطح بعد»).
- `page.tsx`: `sendImage()` flow (optimistic bubble, toast), `imageBusy` state, autoSpeak toggle (Volume2/VolumeX, persisted `teka-autospeak`, speaks replies via speakRef, skips image messages), 10 twinkle stars in aurora, moved TTS block above send() to fix TDZ `stopSpeaking` crash.
- Verified: `bun run lint` clean; TTS→ASR round-trip via curl OK; chat, image gen (fallback path exercised), quick tools, light/dark themes, mobile 390x844, drawer, XP level-up all verified via agent-browser screenshots.

Stage Summary:
- Shipped: glassmorphism overhaul + animated aurora/stars background, voice input (ASR), auto-speak + per-message TTS, image generator with auto-English-retry, quick tools, XP levels, spring animations.
- Key artifacts: src/app/api/asr/route.ts, src/app/api/image/route.ts, src/lib/audio-recorder.ts, updated page.tsx / chat-input.tsx / message-list.tsx / sidebar.tsx / globals.css / teka.ts.
- Known notes: image model content-filters some Persian prompts (handled by translate-retry); dev.log has one legacy Prisma "hex escape" error from an old malformed user message (handled by 500 catch).
