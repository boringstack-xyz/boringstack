import { create } from "zustand";

/**
 * App-level UI state. Anything that's visual + cross-page lives here:
 * sidebar open/closed, modal stack, command-palette visibility, etc.
 *
 * Server state and form state do NOT belong here — they live in
 * `*.queries.ts` (TanStack Query) and `useForm` respectively.
 */
export interface IUiState {
  readonly sidebarOpen: boolean;
  readonly commandPaletteOpen: boolean;
  toggleSidebar(): void;
  setSidebarOpen(open: boolean): void;
  toggleCommandPalette(): void;
  closeAllOverlays(): void;
}

export const useUiStore = create<IUiState>((set) => ({
  sidebarOpen: false,
  commandPaletteOpen: false,
  toggleSidebar: () => {
    set((s) => ({ sidebarOpen: !s.sidebarOpen }));
  },
  setSidebarOpen: (open) => {
    set({ sidebarOpen: open });
  },
  toggleCommandPalette: () => {
    set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen }));
  },
  closeAllOverlays: () => {
    set({ sidebarOpen: false, commandPaletteOpen: false });
  }
}));
