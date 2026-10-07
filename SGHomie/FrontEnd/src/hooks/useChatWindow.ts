import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  clampWindow, initialWindow, resizeWindow,
  type ChatMode, type Point, type WindowBounds,
} from '../lib/chatWindow';

const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });
type Gesture = { pointerId: number; origin: Point; bounds: WindowBounds; mode: ChatMode; kind: 'window' | 'resize' };

export default function useChatWindow() {
  const [mode, setMode] = useState<ChatMode>('compact');
  const [windows, setWindows] = useState(() => ({ compact: initialWindow('compact', viewport()), expanded: initialWindow('expanded', viewport()) }));
  const gesture = useRef<Gesture>();
  const [interacting, setInteracting] = useState(false);

  useEffect(() => {
    const fit = () => {
      setWindows(previous => ({ compact: clampWindow(previous.compact, viewport()), expanded: clampWindow(previous.expanded, viewport()) }));
    };
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const start = (event: PointerEvent<HTMLElement>, kind: Gesture['kind']) => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { pointerId: event.pointerId, origin: { x: event.clientX, y: event.clientY }, bounds: windows[mode], mode, kind };
    setInteracting(true);
  };
  const move = (event: PointerEvent<HTMLElement>) => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const delta = { x: event.clientX - active.origin.x, y: event.clientY - active.origin.y };
    const bounds = active.kind === 'resize'
      ? resizeWindow(active.bounds, delta, viewport())
      : clampWindow({ ...active.bounds, x: active.bounds.x + delta.x, y: active.bounds.y + delta.y }, viewport());
    setWindows(previous => ({ ...previous, [active.mode]: bounds }));
  };
  const end = (event: PointerEvent<HTMLElement>) => {
    if (gesture.current?.pointerId !== event.pointerId) return;
    gesture.current = undefined;
    setInteracting(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const keyboard = (event: KeyboardEvent<HTMLElement>, kind: Gesture['kind']) => {
    const step = event.shiftKey ? 40 : 10;
    const offsets: Record<string, Point> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } };
    const delta = offsets[event.key];
    if (!delta) return;
    event.preventDefault();
    setWindows(previous => ({ ...previous, [mode]: kind === 'resize'
      ? resizeWindow(previous[mode], delta, viewport())
      : clampWindow({ ...previous[mode], x: previous[mode].x + delta.x, y: previous[mode].y + delta.y }, viewport()) }));
  };
  return {
    mode, bounds: windows[mode], interacting, setMode,
    gestureProps: (kind: Gesture['kind']) => ({
      onPointerDown: (event: PointerEvent<HTMLElement>) => start(event, kind), onPointerMove: move,
      onPointerUp: end, onPointerCancel: end, onLostPointerCapture: end,
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => keyboard(event, kind),
    }),
  };
}
