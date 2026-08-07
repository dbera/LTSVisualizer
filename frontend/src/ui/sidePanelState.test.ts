import { describe, expect, it } from "vitest";
import {
  DEFAULT_SIDE_PANEL_WIDTH,
  MAX_SIDE_PANEL_WIDTH,
  MIN_SIDE_PANEL_WIDTH,
  clampSidePanelWidth,
  getKeyboardResizedSidePanelWidth,
  getSidePanelMaximumWidth,
  parseStoredSidePanelCollapsed,
  parseStoredSidePanelWidth,
} from "./sidePanelState";

describe("side panel state", () => {
  it("uses the configured maximum on a wide viewport", () => {
    expect(getSidePanelMaximumWidth(1920)).toBe(MAX_SIDE_PANEL_WIDTH);
  });

  it("uses a viewport-aware maximum", () => {
    expect(getSidePanelMaximumWidth(1000)).toBe(550);
  });

  it("never allows the viewport maximum below the minimum", () => {
    expect(getSidePanelMaximumWidth(500)).toBe(MIN_SIDE_PANEL_WIDTH);
  });

  it("clamps widths to both boundaries", () => {
    expect(clampSidePanelWidth(100, 1920)).toBe(MIN_SIDE_PANEL_WIDTH);
    expect(clampSidePanelWidth(900, 1920)).toBe(MAX_SIDE_PANEL_WIDTH);
    expect(clampSidePanelWidth(520, 1920)).toBe(520);
  });

  it("restores and clamps a stored width", () => {
    expect(parseStoredSidePanelWidth("640", 1920)).toBe(640);
    expect(parseStoredSidePanelWidth("900", 1000)).toBe(550);
  });

  it("falls back safely for missing or invalid stored widths", () => {
    expect(parseStoredSidePanelWidth(null, 1920)).toBe(DEFAULT_SIDE_PANEL_WIDTH);
    expect(parseStoredSidePanelWidth("", 1920)).toBe(DEFAULT_SIDE_PANEL_WIDTH);
    expect(parseStoredSidePanelWidth("not-a-number", 1920)).toBe(
      DEFAULT_SIDE_PANEL_WIDTH,
    );
  });

  it("only restores the explicit collapsed value", () => {
    expect(parseStoredSidePanelCollapsed("true")).toBe(true);
    expect(parseStoredSidePanelCollapsed("false")).toBe(false);
    expect(parseStoredSidePanelCollapsed(null)).toBe(false);
    expect(parseStoredSidePanelCollapsed("TRUE")).toBe(false);
  });

  it("supports normal and accelerated keyboard resizing", () => {
    expect(getKeyboardResizedSidePanelWidth(480, "ArrowLeft", false, 1920)).toBe(496);
    expect(getKeyboardResizedSidePanelWidth(480, "ArrowRight", false, 1920)).toBe(464);
    expect(getKeyboardResizedSidePanelWidth(480, "ArrowLeft", true, 1920)).toBe(530);
    expect(getKeyboardResizedSidePanelWidth(480, "ArrowRight", true, 1920)).toBe(430);
  });

  it("supports Home and viewport-aware End", () => {
    expect(getKeyboardResizedSidePanelWidth(480, "Home", false, 1000)).toBe(380);
    expect(getKeyboardResizedSidePanelWidth(480, "End", false, 1000)).toBe(550);
  });

  it("ignores unrelated keys", () => {
    expect(getKeyboardResizedSidePanelWidth(480, "Enter", false, 1920)).toBeNull();
  });
});
