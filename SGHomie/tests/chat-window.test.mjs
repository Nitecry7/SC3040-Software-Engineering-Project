import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampWindow, initialWindow, resizeWindow, WINDOW_MARGIN } from '../FrontEnd/src/lib/chatWindow.ts';

test('compact starts in the corner and expanded provides a larger centered window', () => {
  const viewport = { width: 1440, height: 900 };
  const compact = initialWindow('compact', viewport);
  const expanded = initialWindow('expanded', viewport);
  assert.equal(compact.x + compact.width, viewport.width - WINDOW_MARGIN);
  assert.equal(compact.y + compact.height, viewport.height - WINDOW_MARGIN);
  assert.ok(expanded.width > compact.width && expanded.height > compact.height);
  assert.equal(expanded.x, (viewport.width - expanded.width) / 2);
});

test('dragging cannot lose the window beyond any viewport edge', () => {
  const viewport = { width: 1000, height: 800 };
  assert.deepEqual(clampWindow({ x: -100, y: 9999, width: 420, height: 560 }, viewport), { x: 12, y: 228, width: 420, height: 560 });
});

test('resizing keeps the anchor and enforces usable minimums and viewport maximums', () => {
  const viewport = { width: 1000, height: 800 };
  const bounds = { x: 100, y: 100, width: 420, height: 560 };
  assert.deepEqual(resizeWindow(bounds, { x: 9999, y: 9999 }, viewport), { x: 100, y: 100, width: 888, height: 688 });
  assert.deepEqual(resizeWindow(bounds, { x: -9999, y: -9999 }, viewport), { x: 100, y: 100, width: 320, height: 360 });
});

test('small mobile viewports and orientation changes keep both modes inside the screen', () => {
  for (const viewport of [{ width: 375, height: 667 }, { width: 667, height: 375 }, { width: 280, height: 320 }]) {
    for (const mode of ['compact', 'expanded']) {
      const bounds = clampWindow(initialWindow(mode, { width: 1440, height: 900 }), viewport);
      assert.ok(bounds.x >= WINDOW_MARGIN && bounds.y >= WINDOW_MARGIN);
      assert.ok(bounds.x + bounds.width <= viewport.width - WINDOW_MARGIN);
      assert.ok(bounds.y + bounds.height <= viewport.height - WINDOW_MARGIN);
    }
  }
});
