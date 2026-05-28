import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHotkeys } from '@/lib/hotkeys';
import type { Hotkey } from '@/lib/hotkeys';

function fireKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, ...opts });
  window.dispatchEvent(event);
  return event;
}

describe('useHotkeys', () => {
  beforeEach(() => {
    // ensure clean state
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls handler on matching key', () => {
    const handler = vi.fn();
    const keys: Hotkey[] = [{ key: 'ArrowRight', handler }];
    renderHook(() => useHotkeys(keys));
    fireKey('ArrowRight');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('calls handler on cmd+k', () => {
    const handler = vi.fn();
    const keys: Hotkey[] = [{ key: 'k', cmd: true, handler }];
    renderHook(() => useHotkeys(keys));
    fireKey('k', { metaKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does NOT call handler when cmd required but not pressed', () => {
    const handler = vi.fn();
    const keys: Hotkey[] = [{ key: 'k', cmd: true, handler }];
    renderHook(() => useHotkeys(keys));
    fireKey('k');
    expect(handler).not.toHaveBeenCalled();
  });

  it('does NOT call preventInInput handler when target is input', () => {
    const handler = vi.fn();
    const keys: Hotkey[] = [{ key: 'ArrowRight', preventInInput: true, handler }];
    renderHook(() => useHotkeys(keys));
    const input = document.createElement('input');
    document.body.appendChild(input);
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
    Object.defineProperty(event, 'target', { value: input, writable: false });
    input.dispatchEvent(event);
    document.body.removeChild(input);
    expect(handler).not.toHaveBeenCalled();
  });
});
