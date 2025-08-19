/**
 * EditingGatePlugin
 * Keeps the editor non-editable until Yjs provider reports initial sync.
 * Avoids initial race where remote state overwrites boundary edits.
 */

import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {useEffect, useRef} from 'react';

export default function EditingGatePlugin(): null {
  const [editor] = useLexicalComposerContext();
  const lastEditable = useRef<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      // Require initial sync to be completed before enabling edits
      const globalAny = (window as any);
      const ready: boolean = globalAny.__Y_SYNCED__ === true;
      if (lastEditable.current !== ready) {
        lastEditable.current = ready;
        editor.setEditable(ready);
      }
    };

    // Poll a few times per second; robust across provider lifecycles
    const interval = window.setInterval(tick, 150);
    // Run immediately once
    tick();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [editor]);

  return null;
}



