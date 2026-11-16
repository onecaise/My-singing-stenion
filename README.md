# My Singing Stewnion

A little music toy: your friends are the "monsters." Give each one a face
and a looped sound, then drag them onto a stage where all their loops play
together, perfectly in sync, to build a beat. No levels, no currency, no
progression — just a creative sandbox.

## Stack

- Vite + React + TypeScript
- Tailwind CSS v4
- Web Audio API for all playback (sample-accurate looping via
  `AudioBufferSourceNode`, no `<audio>` tags)
- MediaRecorder API for recording from the microphone
- IndexedDB (via `idb-keyval`) for local persistence — monsters, photos,
  audio blobs, backdrops, and saved songs all live in your browser
- `@dnd-kit/core` for drag and drop (mouse + touch)

## Getting started

```bash
npm install
npm run dev
```

Open the printed local URL (defaults to `http://localhost:5173`) in Chrome,
Edge, or Safari. Everything runs client-side — there's no backend and no
build step required beyond Vite's.

```bash
npm run build   # type-checks with tsc -b, then builds to dist/
npm run preview # serve the production build locally
```

## How it works

1. **Monsters tab** — click **+ Add Monster** to create a friend: name it,
   give it a photo (or a color + emoji), and give it a sound either by
   recording from your mic (with a 1-bar metronome count-in so the take
   lands on the beat) or by uploading an audio file. Every sound is
   trimmed/padded to exactly the current loop length (bars × BPM) so
   everything you add later lines up automatically.
2. **Song tab** — drag a monster from the tray onto the stage. It joins the
   mix on the *next* bar boundary, not immediately, so it locks into the
   groove instead of cutting in mid-beat. Click a monster to mute it, use
   its **solo** button to isolate it, drag it to reposition, or hit the ×
   to remove it. Each monster bounces in time with the beat while playing.
3. Use the transport bar to play/stop everything, adjust master volume,
   BPM, and loop length (bars). Changing BPM/length while monsters are
   mismatched with the new tempo nudges their pitch slightly to keep them
   locked to the grid instead of falling out of sync — a banner tells you
   when that's happening.
4. Pick a backdrop (five built-in scenes, or upload your own), then **Save**
   your song under a name. **Load** brings back any saved song's backdrop,
   monster placement, and mute/solo state. **Export** renders the current
   mix for N loops and downloads it as a `.webm` file.

## Project structure

```
src/
  audio/        Web Audio engine, buffer trimming/rotation, recorder,
                 exporter — framework-agnostic, no React imports
  components/    Presentational + interactive React components
  panels/        The two top-level screens (Monsters, Song)
  state/         React context providers bridging UI state to the engine
  storage/       IndexedDB persistence (idb-keyval)
  hooks/         Small reusable hooks (beat clock, etc.)
  types/         Shared TypeScript types
```

The audio engine (`src/audio/engine.ts`) owns a single `AudioContext` and a
bar-aligned transport clock. All monster loops are scheduled against that
one clock so they stay sample-accurate relative to each other no matter
when each one started playing.

## Browser notes

- The `AudioContext` is created/resumed lazily on first user interaction,
  per browser autoplay policy.
- Microphone access is requested only when you click **Record from mic**;
  if it's denied, the app shows an inline error instead of failing
  silently.
- Drag and drop works with mouse and touch (tested via `@dnd-kit`'s pointer
  + touch sensors), so placing monsters works on a tablet too.
