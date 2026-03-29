# webFrame

**Browser-based multi-track video editor.**

![webFrame Arayüzü](./screenshot.png)

*First of all, a huge thanks and "Merhaba!" (Hello!) to Walter! 👋 This project is an evolved branch of his amazing [FreeCut](https://github.com/walterlow/freecut) (MIT License). We built upon his powerful timeline and video rendering engine to create a more localized, flexible workspace.*

✨ **webFrame Exclusive Features**
We focused purely on professional workspace usability and Turkish localization:

- **Professional Dockable Panels:** You can now drag, drop, and dock panels anywhere. Want a vertical video workspace? Dock the preview to the right side seamlessly! No rigid layouts holding you back.
- **Responsive Workspace UI:** We removed fixed header bars to give you more screen space. Panels now have floating grip handles, and transport controls wrap dynamically on narrow screens so you never lose access to your play buttons.
- **Native Localization:** Currently fully translated to Turkish for local creators, with more languages rolling out very soon!
- **Minimalist Focus:** We sent the giant yellow developer debug bug-button on a permanent vacation. We stripped away the clunky debugging panels and simplified the UI for a clean, distraction-free editing environment.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in Chrome.

## Tech Stack

- React 19 + TypeScript
- Vite + Tailwind CSS 4 + shadcn/ui
- Zustand + Zundo (state + undo)
- WebCodecs + Canvas (render & export)
- OPFS + IndexedDB (local persistence)

## License

[MIT](LICENSE)
