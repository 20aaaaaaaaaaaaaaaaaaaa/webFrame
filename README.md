# webFrame

**webFrame: A Professional Browser-Based Multi-Track Video Editor.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

![webFrame Timeline Editor](./public/assets/landing/timeline.png)

**webFrame** is a powerful, browser-based multi-track video editing application. It requires no installation and no server-side uploads—all processing, rendering, and storage happen locally in your browser using modern web technologies like WebGPU, WebCodecs, and the File System Access API.

Originally based on the FreeCut engine, **webFrame** has been extensively customized and enhanced to provide a more global and user-friendly experience.

## Key Enhancements

### 🌍 Full Bilingual Support
webFrame now features comprehensive **English and Turkish** localization. From basic tooltips to complex export settings, the entire interface is fully translatable, making it accessible to a wider range of creators.
- Seamless, instant language switching.
- Specialized video editing terminology translations.
- Robust localization infrastructure powered by `i18next`.

### 🎨 Advanced Theme System
Personalize your workspace with our modern theme system. We've moved beyond a single look to offer curated environments designed for different lighting conditions and aesthetic preferences:
- **Classic Dark**: The high-contrast, professional look for focused editing sessions.
- **Studio Gray**: A smooth, lower-contrast gray balanced for long-term comfort.
- **Light Gray**: A bright, modern interface for well-lit environments.
- All themes are built on a consistent OKLCH design system for optimal color harmony.

---

## Core Features

### Timeline & Editing
- Multi-track timeline with video, audio, text, image, and shape tracks.
- Track groups with mute/visible/locked propagation.
- Trim, split, join, ripple delete, and rate stretch tools.
- Rolling edit, ripple edit, slip, and slide tools.
- Per-track "Close Gaps" to remove empty space between clips.
- Filmstrip thumbnails and audio waveform visualization.
- Undo/redo with configurable history depth.

### GPU Effects & Transitions
- **WebGPU-accelerated Effects**: Gaussian Blur, Color Correction (Curves, Wheels, LUTs), Distortion, Keying (Chroma Key/Green Screen), and Stylization (Film Grain, Glitch).
- **GPU-accelerated Blends**: 25 modes including Screen, Overlay, Color Dodge, etc.
- **Dynamic Transitions**: CPU and GPU-driven transitions like Fade, Wipe, Glitch, and Chromatic Aberration.

### Preview & Scopes
- Real-time WebGPU-composited preview with interactive transform gizmos.
- Frame-accurate playback using a custom Clock engine.
- GPU-powered Scopes: Waveform, Vectorscope, and Histogram.

### Export Pipeline
- In-browser rendering via WebCodecs API.
- **Containers**: MP4, WebM, MOV, MKV.
- **Codecs**: H.264, H.265 (HEVC), VP8, VP9, AV1.
- **Audio**: MP3, AAC, WAV.

### Local-First Persistence
- **File System Access API**: Reference your local files without copying them.
- **Origin Private File System (OPFS)**: High-performance storage for proxies and project data.
- **Auto-save**: Never lose your progress with redundant local saves.

---

## Quick Start

**Prerequisites:** Node.js 18+

```bash
# Clone the repository
git clone https://github.com/20aaaaaaaaaaaaaaaaaaaa/webFrame.git
cd webFrame

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in a modern Chromium-based browser (Chrome or Edge 113+ recommended).

---

## Tech Stack

- **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Processing**: [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) & [WebCodecs](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)
- **State**: [Zustand](https://github.com/pmndrs/zustand)
- **Localization**: [i18next](https://www.i18next.com/)
- **Routing**: [TanStack Router](https://tanstack.com/router)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **Storage**: OPFS & IndexedDB

## License
webFrame is a fork of the original FreeCut project by Walter Low. It is licensed under the [MIT License](LICENSE).
