# webFrame

**Browser-based multi-track video editor.**

This project is an evolved version of [FreeCut](https://github.com/walterlow/freecut) by Walter (MIT License). While keeping the powerful core, **webFrame** focuses on stability, localization, and a professional workspace experience. See [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) for attribution.

✨ **What's New in webFrame?**
We have significantly improved the original codebase with several key features and architectural changes:

- **Dockable Panel System:** Fully resizable, drag-and-drop panel interface with edge docking capabilities (similar to Premiere Pro).
- **Responsive Workspace UI:** Floating grip handles instead of fixed header bars to maximize video real estate, plus dynamically wrapping transport controls for narrow screens.
- **Native Turkish Support:** Full localization to ensure a seamless editing experience.
- **Minimalist Interface:** Removed development debug panels and refined the landing page for a clean, distraction-free environment.
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
