import { useEffect } from 'react';

export type Hotkey = {
  key: string;        // e.g. 'ArrowRight', 'k', 'Enter', 'o'
  cmd?: boolean;      // require Cmd/Ctrl
  shift?: boolean;
  preventInInput?: boolean; // skip when focus is inside input/textarea
  handler: (e: KeyboardEvent) => void;
};

export function useHotkeys(keys: Hotkey[]): void {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      for (const h of keys) {
        if (e.key.toLowerCase() !== h.key.toLowerCase()) continue;
        if (h.cmd && !(e.metaKey || e.ctrlKey)) continue;
        if (!h.cmd && (e.metaKey || e.ctrlKey)) continue;
        if (h.shift && !e.shiftKey) continue;
        if (h.preventInInput) {
          const t = e.target as HTMLElement | null;
          if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) continue;
        }
        e.preventDefault();
        h.handler(e);
        return;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keys]);
}
