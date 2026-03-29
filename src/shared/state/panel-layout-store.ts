/**
 * Panel Layout Store
 *
 * Manages editor panel positions with support for:
 * - Standard 3+1 layout (3 top panels + 1 bottom)
 * - Full-height edge docking (any panel can dock left/right spanning full height)
 * - Drag-to-swap between panels
 * - localStorage persistence
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PanelId = 'media' | 'preview' | 'properties' | 'timeline';

export const PANEL_LABELS: Record<PanelId, string> = {
  media: 'Media',
  preview: 'Preview',
  properties: 'Properties',
  timeline: 'Timeline',
};

interface PanelLayoutState {
  dockedLeft: PanelId | null;
  dockedRight: PanelId | null;
  dockedBottom: PanelId | null;
  /** Order of panels in the main area */
  mainOrder: PanelId[];

  draggingPanel: PanelId | null;
  dropTarget: string | null;

  startDrag: (panel: PanelId) => void;
  setDropTarget: (target: string | null) => void;
  endDrag: () => void;
  resetLayout: () => void;
}

const DEFAULT_MAIN_ORDER: PanelId[] = ['media', 'preview', 'properties'];

export const usePanelLayoutStore = create<PanelLayoutState>()(
  persist(
    (set, get) => ({
      dockedLeft: null,
      dockedRight: null,
      dockedBottom: 'timeline',
      mainOrder: [...DEFAULT_MAIN_ORDER],
      draggingPanel: null,
      dropTarget: null,

      startDrag: (panel) => {
        set({ draggingPanel: panel });
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
      },

      setDropTarget: (target) => set({ dropTarget: target }),

      endDrag: () => {
        const { draggingPanel, dropTarget, dockedLeft, dockedRight, dockedBottom, mainOrder } = get();
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        if (!draggingPanel || !dropTarget) {
          set({ draggingPanel: null, dropTarget: null });
          return;
        }

        const stateArgs = { dockedLeft, dockedRight, dockedBottom, mainOrder: [...mainOrder] };

        // ── Edge docking ──
        if (dropTarget.startsWith('edge-')) {
          const side = dropTarget.replace('edge-', '') as 'left' | 'right' | 'bottom';
          
          // Remove draggingPanel from its current location
          if (stateArgs.dockedLeft === draggingPanel) stateArgs.dockedLeft = null;
          if (stateArgs.dockedRight === draggingPanel) stateArgs.dockedRight = null;
          if (stateArgs.dockedBottom === draggingPanel) stateArgs.dockedBottom = null;
          stateArgs.mainOrder = stateArgs.mainOrder.filter((p) => p !== draggingPanel);

          // Get the panel currently docked at the target edge
          let existingDocked: PanelId | null = null;
          if (side === 'left') existingDocked = stateArgs.dockedLeft;
          if (side === 'right') existingDocked = stateArgs.dockedRight;
          if (side === 'bottom') existingDocked = stateArgs.dockedBottom;

          // Push existing panel into mainOrder side-by-side array
          if (existingDocked) {
             stateArgs.mainOrder.push(existingDocked);
          }

          // Dock the new panel
          if (side === 'left') stateArgs.dockedLeft = draggingPanel;
          if (side === 'right') stateArgs.dockedRight = draggingPanel;
          if (side === 'bottom') stateArgs.dockedBottom = draggingPanel;

          set({ ...stateArgs, draggingPanel: null, dropTarget: null });
          return;
        }

        // ── Panel swap ──
        const targetPanel = dropTarget as PanelId;
        if (targetPanel === draggingPanel) {
          set({ draggingPanel: null, dropTarget: null });
          return;
        }

        // Helper to locate panel
        type PanelLocation = { type: 'docked'; side: 'left' | 'right' | 'bottom' } | { type: 'main'; index: number };
        const locate = (state: PanelLayoutState, p: PanelId): PanelLocation | null => {
           if (state.dockedLeft === p) return { type: 'docked', side: 'left' };
           if (state.dockedRight === p) return { type: 'docked', side: 'right' };
           if (state.dockedBottom === p) return { type: 'docked', side: 'bottom' };
           const idx = state.mainOrder.indexOf(p);
           if (idx !== -1) return { type: 'main', index: idx };
           return null;
        };

        const locSrc = locate(get(), draggingPanel);
        const locDest = locate(get(), targetPanel);

        if (locSrc && locDest) {
           const nextState = { dockedLeft, dockedRight, dockedBottom, mainOrder: [...mainOrder] };
           
           const setAtLoc = (loc: PanelLocation, panel: PanelId) => {
              if (loc.type === 'docked' && loc.side === 'left') nextState.dockedLeft = panel;
              if (loc.type === 'docked' && loc.side === 'right') nextState.dockedRight = panel;
              if (loc.type === 'docked' && loc.side === 'bottom') nextState.dockedBottom = panel;
              if (loc.type === 'main') nextState.mainOrder[loc.index] = panel;
           };

           setAtLoc(locSrc, targetPanel);
           setAtLoc(locDest, draggingPanel);

           set({ ...nextState, draggingPanel: null, dropTarget: null });
           return;
        }

        set({ draggingPanel: null, dropTarget: null });
      },

      resetLayout: () =>
        set({
          dockedLeft: null,
          dockedRight: null,
          dockedBottom: 'timeline',
          mainOrder: [...DEFAULT_MAIN_ORDER],
        }),
    }),
    {
      name: 'webframe-panel-layout-v2', // v2 to override old v1 schema automatically
      partialize: (s) => ({
        dockedLeft: s.dockedLeft,
        dockedRight: s.dockedRight,
        dockedBottom: s.dockedBottom,
        mainOrder: s.mainOrder,
      }),
    }
  )
);

export const selectIsDefault = (s: PanelLayoutState): boolean =>
  s.dockedLeft === null &&
  s.dockedRight === null &&
  s.dockedBottom === 'timeline' &&
  s.mainOrder.length === 3 &&
  s.mainOrder[0] === 'media' &&
  s.mainOrder[1] === 'preview' &&
  s.mainOrder[2] === 'properties';
