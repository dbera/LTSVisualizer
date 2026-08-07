export const MIN_SIDE_PANEL_WIDTH = 380;
export const DEFAULT_SIDE_PANEL_WIDTH = 480;
export const MAX_SIDE_PANEL_WIDTH = 760;
export const SIDE_PANEL_WIDTH_STORAGE_KEY = "ltsvisualizer.sidePanelWidth";
export const SIDE_PANEL_COLLAPSED_STORAGE_KEY = "ltsvisualizer.sidePanelCollapsed";

export function getSidePanelMaximumWidth(viewportWidth: number): number {
  const safeViewportWidth = Number.isFinite(viewportWidth)
    ? Math.max(0, viewportWidth)
    : 0;
  return Math.max(
    MIN_SIDE_PANEL_WIDTH,
    Math.min(MAX_SIDE_PANEL_WIDTH, safeViewportWidth * 0.55),
  );
}

export function clampSidePanelWidth(
  width: number,
  viewportWidth: number,
): number {
  const maximum = getSidePanelMaximumWidth(viewportWidth);
  const safeWidth = Number.isFinite(width) ? width : DEFAULT_SIDE_PANEL_WIDTH;
  return Math.min(maximum, Math.max(MIN_SIDE_PANEL_WIDTH, safeWidth));
}

export function parseStoredSidePanelWidth(
  stored: string | null,
  viewportWidth: number,
): number {
  if (stored === null || stored.trim() === "") {
    return clampSidePanelWidth(DEFAULT_SIDE_PANEL_WIDTH, viewportWidth);
  }
  const parsed = Number(stored);
  return Number.isFinite(parsed)
    ? clampSidePanelWidth(parsed, viewportWidth)
    : clampSidePanelWidth(DEFAULT_SIDE_PANEL_WIDTH, viewportWidth);
}

export function parseStoredSidePanelCollapsed(stored: string | null): boolean {
  return stored === "true";
}

export function getKeyboardResizedSidePanelWidth(
  currentWidth: number,
  key: string,
  shiftKey: boolean,
  viewportWidth: number,
): number | null {
  const increment = shiftKey ? 50 : 16;
  let requestedWidth: number;

  switch (key) {
    case "ArrowLeft":
      requestedWidth = currentWidth + increment;
      break;
    case "ArrowRight":
      requestedWidth = currentWidth - increment;
      break;
    case "Home":
      requestedWidth = MIN_SIDE_PANEL_WIDTH;
      break;
    case "End":
      requestedWidth = getSidePanelMaximumWidth(viewportWidth);
      break;
    default:
      return null;
  }

  return clampSidePanelWidth(requestedWidth, viewportWidth);
}
