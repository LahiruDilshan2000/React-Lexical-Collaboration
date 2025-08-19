/**
 * Custom plugin to fix collaborative text editing issues
 * Specifically addresses problems with editing at text boundaries
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect } from 'react';
import {
  $getSelection,
  $isRangeSelection,
  $createRangeSelection,
  $setSelection,
  COMMAND_PRIORITY_CRITICAL,
  SELECTION_CHANGE_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
} from 'lexical';

export default function CollaborativeTextPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Track collaborative state
    let boundaryEditInProgress = false;

    // Handle text boundary editing specifically
    const removeKeyListener = editor.registerCommand(
      KEY_ENTER_COMMAND,
      () => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const anchor = selection.anchor;
          const focus = selection.focus;
          
          if (anchor.key === focus.key) {
            const textNode = anchor.getNode();
            if (textNode && textNode.getType() === 'text') {
              const textContent = textNode.getTextContent();
              const offset = anchor.offset;
              
              // If at boundary, ensure proper handling
              if (offset === 0 || offset === textContent.length) {
                console.log(`[CollaborativeTextPlugin] Boundary enter detected at offset ${offset}`);
                boundaryEditInProgress = true;
                setTimeout(() => {
                  boundaryEditInProgress = false;
                }, 200);
              }
            }
          }
        }
        return false; // Let default behavior handle it
      },
      COMMAND_PRIORITY_CRITICAL
    );

    // Fix text boundary editing issues
    const removeSelectionListener = editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        // Don't interfere with boundary edits in progress
        if (boundaryEditInProgress) {
          return false;
        }

        const selection = $getSelection();
        
        if ($isRangeSelection(selection)) {
          const anchor = selection.anchor;
          const focus = selection.focus;
          
          // Only handle single-node selections
          if (anchor.key === focus.key) {
            const textNode = anchor.getNode();
            if (textNode && textNode.getType() === 'text') {
              const textContent = textNode.getTextContent();
              const anchorOffset = anchor.offset;
              const focusOffset = focus.offset;
              
              // Ensure offsets are within valid range
              if (anchorOffset > textContent.length) {
                anchor.offset = textContent.length;
              }
              if (focusOffset > textContent.length) {
                focus.offset = textContent.length;
              }
              
              // Log boundary selections for debugging
              const isAtBoundary = anchorOffset === 0 || anchorOffset === textContent.length ||
                                  focusOffset === 0 || focusOffset === textContent.length;
              
              if (isAtBoundary) {
                console.log(`[CollaborativeTextPlugin] Boundary selection: anchor=${anchorOffset}, focus=${focusOffset}, textLength=${textContent.length}`);
              }
            }
          }
        }
        
        return false; // Don't prevent default behavior
      },
      COMMAND_PRIORITY_CRITICAL
    );

    return () => {
      removeKeyListener();
      removeSelectionListener();
    };
  }, [editor]);

  return null;
}

