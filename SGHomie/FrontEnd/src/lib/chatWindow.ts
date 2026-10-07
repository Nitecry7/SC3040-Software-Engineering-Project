export type ChatMode = 'compact' | 'expanded';
export interface Point { x: number; y: number }
export interface WindowBounds extends Point { width: number; height: number }
export interface Viewport { width: number; height: number }

export const WINDOW_MARGIN = 12;
export const LAUNCHER_SIZE = 56;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function clampWindow(bounds: WindowBounds, viewport: Viewport): WindowBounds {
  const availableWidth = Math.max(1, viewport.width - WINDOW_MARGIN * 2);
  const availableHeight = Math.max(1, viewport.height - WINDOW_MARGIN * 2);
  const width = clamp(bounds.width, Math.min(320, availableWidth), availableWidth);
  const height = clamp(bounds.height, Math.min(360, availableHeight), availableHeight);
  return {
    width, height,
    x: clamp(bounds.x, WINDOW_MARGIN, Math.max(WINDOW_MARGIN, viewport.width - width - WINDOW_MARGIN)),
    y: clamp(bounds.y, WINDOW_MARGIN, Math.max(WINDOW_MARGIN, viewport.height - height - WINDOW_MARGIN)),
  };
}

export function initialWindow(mode: ChatMode, viewport: Viewport): WindowBounds {
  const width = mode === 'compact' ? 420 : 820;
  const height = mode === 'compact' ? 560 : 700;
  return clampWindow({
    width, height,
    x: mode === 'compact' ? viewport.width - width - WINDOW_MARGIN : (viewport.width - width) / 2,
    y: mode === 'compact' ? viewport.height - height - WINDOW_MARGIN : (viewport.height - height) / 2,
  }, viewport);
}

export function resizeWindow(bounds: WindowBounds, delta: Point, viewport: Viewport): WindowBounds {
  // Preserve the top-left anchor while resizing; stop at the viewport edge.
  return clampWindow({ ...bounds,
    width: Math.min(bounds.width + delta.x, viewport.width - bounds.x - WINDOW_MARGIN),
    height: Math.min(bounds.height + delta.y, viewport.height - bounds.y - WINDOW_MARGIN),
  }, viewport);
}
