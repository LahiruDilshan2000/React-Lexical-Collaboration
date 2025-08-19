/**
 * Debug plugin to track Y.js updates and understand text reset issues
 * This will help identify why boundary edits are being overridden
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect } from 'react';
import {
  $getSelection,
  $isRangeSelection,
  $getRoot,
  COMMAND_PRIORITY_CRITICAL,
  SELECTION_CHANGE_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
} from 'lexical';

export default function YjsDebugPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    let lastTextContent = '';
    let updateCount = 0;

    // Track document content changes
    const removeUpdateListener = editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
      const currentTextContent = editorState.read(() => {
        const root = $getRoot();
        return root.getTextContent();
      });

      // Only log if content actually changed
      if (currentTextContent !== lastTextContent) {
        updateCount++;
        console.log(`[YjsDebugPlugin] Update #${updateCount}:`, {
          previousLength: lastTextContent.length,
          currentLength: currentTextContent.length,
          change: currentTextContent.length - lastTextContent.length,
          dirtyElements: dirtyElements.size,
          dirtyLeaves: dirtyLeaves.size,
          timestamp: new Date().toISOString()
        });
        
        lastTextContent = currentTextContent;
      }
    });

    // Track selection changes at boundaries
    const removeSelectionListener = editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const anchor = selection.anchor;
          const textNode = anchor.getNode();
          
          if (textNode && textNode.getType() === 'text') {
            const textContent = textNode.getTextContent();
            const offset = anchor.offset;
            const isAtBoundary = offset === 0 || offset === textContent.length;
            
            if (isAtBoundary) {
              console.log(`[YjsDebugPlugin] Boundary selection detected:`, {
                offset,
                textLength: textContent.length,
                isAtBeginning: offset === 0,
                isAtEnd: offset === textContent.length,
                textContent: textContent.substring(0, 20) + (textContent.length > 20 ? '...' : ''),
                timestamp: new Date().toISOString()
              });
            }
          }
        }
        return false;
      },
      COMMAND_PRIORITY_CRITICAL
    );

    // Track key presses at boundaries
    const removeKeyListener = editor.registerCommand(
      KEY_ENTER_COMMAND,
      () => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const anchor = selection.anchor;
          const textNode = anchor.getNode();
          
          if (textNode && textNode.getType() === 'text') {
            const textContent = textNode.getTextContent();
            const offset = anchor.offset;
            const isAtBoundary = offset === 0 || offset === textContent.length;
            
            if (isAtBoundary) {
              console.log(`[YjsDebugPlugin] Boundary key press (Enter):`, {
                offset,
                textLength: textContent.length,
                isAtBeginning: offset === 0,
                isAtEnd: offset === textContent.length,
                timestamp: new Date().toISOString()
              });
            }
          }
        }
        return false;
      },
      COMMAND_PRIORITY_CRITICAL
    );

    // Track backspace at boundaries
    const removeBackspaceListener = editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      () => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const anchor = selection.anchor;
          const textNode = anchor.getNode();
          
          if (textNode && textNode.getType() === 'text') {
            const textContent = textNode.getTextContent();
            const offset = anchor.offset;
            const isAtBoundary = offset === 0 || offset === textContent.length;
            
            if (isAtBoundary) {
              console.log(`[YjsDebugPlugin] Boundary key press (Backspace):`, {
                offset,
                textLength: textContent.length,
                isAtBeginning: offset === 0,
                isAtEnd: offset === textContent.length,
                timestamp: new Date().toISOString()
              });
            }
          }
        }
        return false;
      },
      COMMAND_PRIORITY_CRITICAL
    );

    // Track delete at boundaries
    const removeDeleteListener = editor.registerCommand(
      KEY_DELETE_COMMAND,
      () => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const anchor = selection.anchor;
          const textNode = anchor.getNode();
          
          if (textNode && textNode.getType() === 'text') {
            const textContent = textNode.getTextContent();
            const offset = anchor.offset;
            const isAtBoundary = offset === 0 || offset === textContent.length;
            
            if (isAtBoundary) {
              console.log(`[YjsDebugPlugin] Boundary key press (Delete):`, {
                offset,
                textLength: textContent.length,
                isAtBeginning: offset === 0,
                isAtEnd: offset === textContent.length,
                timestamp: new Date().toISOString()
              });
            }
          }
        }
        return false;
      },
      COMMAND_PRIORITY_CRITICAL
    );

    return () => {
      removeUpdateListener();
      removeSelectionListener();
      removeKeyListener();
      removeBackspaceListener();
      removeDeleteListener();
    };
  }, [editor]);

  return null;
}

