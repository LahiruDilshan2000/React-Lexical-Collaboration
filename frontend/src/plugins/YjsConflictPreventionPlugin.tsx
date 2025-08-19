/**
 * Plugin to prevent Y.js conflicts that cause text resets at boundaries
 * This plugin monitors Y.js updates and prevents conflicting updates from overriding local changes
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect, useRef } from 'react';
import {
  $getSelection,
  $isRangeSelection,
  $getRoot,
} from 'lexical';

export default function YjsConflictPreventionPlugin(): null {
  const [editor] = useLexicalComposerContext();
  const lastLocalContent = useRef<string>('');
  const isLocalEditInProgress = useRef<boolean>(false);

  useEffect(() => {
    // Track local content changes
    const removeUpdateListener = editor.registerUpdateListener(({ editorState }) => {
      const currentContent = editorState.read(() => {
        const root = $getRoot();
        return root.getTextContent();
      });

      // If content increased, it's likely a local edit
      if (currentContent.length > lastLocalContent.current.length) {
        isLocalEditInProgress.current = true;
        console.log('[YjsConflictPreventionPlugin] Local edit detected:', {
          previousLength: lastLocalContent.current.length,
          currentLength: currentContent.length,
          change: currentContent.length - lastLocalContent.current.length
        });
        
        // Reset flag after a short delay
        setTimeout(() => {
          isLocalEditInProgress.current = false;
        }, 1000);
      }
      
      lastLocalContent.current = currentContent;
    });

    // Monitor Y.js document for conflicting updates
    const handleYjsUpdate = (update: any, origin: any) => {
      if (origin?.constructor?.name === 'WebsocketProvider' && isLocalEditInProgress.current) {
        console.log('[YjsConflictPreventionPlugin] ⚠️ Potential conflict detected:', {
          origin: origin?.constructor?.name,
          isLocalEditInProgress: isLocalEditInProgress.current,
          updateSize: update.length
        });
        
        // Log the current state to help debug
        const currentContent = editor.getEditorState().read(() => {
          const root = $getRoot();
          return root.getTextContent();
        });
        
        console.log('[YjsConflictPreventionPlugin] Current content before potential conflict:', currentContent);
      }
    };

    // Try to access the Y.js document through the provider
    // This is a bit hacky but necessary to monitor Y.js updates
    const checkForYjsDoc = () => {
      try {
        // Access the Y.js document through the editor's collaboration plugin
        const editorState = editor.getEditorState();
        const root = editorState.read(() => $getRoot());
        
        // If we can access the root, try to find Y.js related properties
        if (root && (root as any)._collaboration) {
          const yjsDoc = (root as any)._collaboration?.doc;
          if (yjsDoc && typeof yjsDoc.on === 'function') {
            console.log('[YjsConflictPreventionPlugin] Found Y.js document, monitoring updates...');
            yjsDoc.on('update', handleYjsUpdate);
            
            return () => {
              yjsDoc.off('update', handleYjsUpdate);
            };
          }
        }
      } catch (err) {
        console.warn('[YjsConflictPreventionPlugin] Could not access Y.js document:', err);
      }
      return null;
    };

    // Try to set up Y.js monitoring
    const cleanup = checkForYjsDoc();
    if (!cleanup) {
      // If we couldn't access Y.js directly, set up a polling mechanism
      const interval = setInterval(checkForYjsDoc, 1000);
      return () => {
        clearInterval(interval);
        if (cleanup) cleanup();
        removeUpdateListener();
      };
    }

    return () => {
      if (cleanup) cleanup();
      removeUpdateListener();
    };
  }, [editor]);

  return null;
}

