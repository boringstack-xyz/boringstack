import { beforeEach, describe, expect, it } from "vitest";

import { useUiStore } from "./ui.store";

describe("useUiStore", () => {
  beforeEach(() => {
    useUiStore.setState({ sidebarOpen: false, commandPaletteOpen: false });
  });

  it("toggleSidebar flips sidebarOpen", () => {
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarOpen).toBe(true);
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarOpen).toBe(false);
  });

  it("setSidebarOpen sets the explicit value", () => {
    useUiStore.getState().setSidebarOpen(true);
    expect(useUiStore.getState().sidebarOpen).toBe(true);
    useUiStore.getState().setSidebarOpen(false);
    expect(useUiStore.getState().sidebarOpen).toBe(false);
  });

  it("toggleCommandPalette flips commandPaletteOpen", () => {
    useUiStore.getState().toggleCommandPalette();
    expect(useUiStore.getState().commandPaletteOpen).toBe(true);
    useUiStore.getState().toggleCommandPalette();
    expect(useUiStore.getState().commandPaletteOpen).toBe(false);
  });

  it("closeAllOverlays resets all overlays", () => {
    useUiStore.setState({ sidebarOpen: true, commandPaletteOpen: true });
    useUiStore.getState().closeAllOverlays();
    expect(useUiStore.getState().sidebarOpen).toBe(false);
    expect(useUiStore.getState().commandPaletteOpen).toBe(false);
  });
});
