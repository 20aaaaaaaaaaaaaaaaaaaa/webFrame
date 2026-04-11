# webFrame

**webFrame: A Professional Browser-Based Multi-Track Video Editor.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

![webFrame Timeline Editor](./public/assets/landing/timeline.png)

**webFrame** is a powerful, browser-based multi-track video editing application. It requires no installation and no server-side uploads—all processing, rendering, and storage happen locally in your browser using modern web technologies like WebGPU, WebCodecs, and the File System Access API.

Originally based on the FreeCut engine, **webFrame** has been extensively customized and enhanced to provide a more global and user-friendly experience.

## 📺 Video Introduction
![webFrame Introduction Video](.system_generated/recordings/webframe_intro_demo_1775919543651.webp)
*(Watch our latest 30-second introduction showcasing the fluid language and theme transitions!)*

## 🚀 Our Innovations & Enhancements

webFrame has been evolved from its original open-source engine into a highly customized, production-ready tool. Our development focus has been on accessibility and professional ergonomics:

### 🌍 Intelligent Localization Layer (i18n)
We didn't just translate strings; we built a comprehensive localization infrastructure:
- **Zero-Latency Switching**: Using `i18next` and a reactive `Zustand` store, the interface transforms between English and Turkish instantly, with no state loss.
- **Turkish Post-Production Jargon**: Every term (e.g., *Zaman Çizelgesi* for Timeline, *Klipleri Böl* for Split Clips) has been localized to match the industry standards of Turkish video editors.
- **Deep Component Localization**: Every corner of the app, from complex GPU effect sliders to the WebCodecs export settings, has been audited for 100% bilingual coverage.

### 🎨 Professional Design System & Themes
We've implemented a state-of-the-art theme system specifically for long editing sessions:
- **OKLCH Color Precision**: By using the OKLCH color model, we ensure that every UI element maintains perfect contrast and visibility regardless of the chosen theme.
- **Custom-Crafted Themes**: 
  - **Classic Dark**: High-focus, deep-black environment.
  - **Studio Gray**: An ergonomic mid-tone for balanced room lighting.
  - **Light Gray**: A modern, vibrant look for creative day-work.
- **Unified Visual State**: Changes propagate through all dockable panels (Media Library, Properties, Timeline) to maintain a cohesive professional environment.

### 🛠️ Production-Ready Workflow Tweaks
- **Enhanced Export Dialog**: A completely redesigned export interface that guides users through complex codec and quality settings in their native language.
- **Intuitive Media Management**: Localized search, filter, and sorting workflows that simplify the management of hundreds of local assets.

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
