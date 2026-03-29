# webFrame

**Browser-based multi-track video editor.**

Based on [FreeCut](https://github.com/walterlow/freecut) (MIT License). See [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) for attribution.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in Chrome.

## Features

- Multi-track timeline (video, audio, text, image, shapes)
- Trim, split, join, ripple delete, rate stretch
- CSS filter effects, glitch effects, halftone, vignette
- Keyframe animation with Bezier curve editor
- Transitions (fade, wipe, slide, 3D flip, clock, iris)
- WebCodecs-based export (MP4, MOV, WebM, MKV + MP3, AAC, WAV)
- Real-time canvas preview with transform gizmo
- Undo/redo, auto-save, project bundles

## Tech Stack

- React 19 + TypeScript
- Vite + Tailwind CSS 4 + shadcn/ui
- Zustand + Zundo (state + undo)
- WebCodecs + Canvas (render & export)
- OPFS + IndexedDB (local persistence)

## License

[MIT](LICENSE)
