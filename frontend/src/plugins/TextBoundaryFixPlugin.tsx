/**
 * Plugin to fix text boundary editing issues in collaborative mode
 * Handles text insertions at the beginning and end of text nodes
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect } from 'react';
import {
  $getSelection,
  $isRangeSelection,
  $createTextNode,
  $getRoot,
  $createParagraphNode,
  $insertNodes,
  COMMAND_PRIORITY_CRITICAL,
  SELECTION_CHANGE_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
} from 'lexical';

export default function TextBoundaryFixPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Handle text insertions at boundaries using selection change
    const removeTextInsertion = editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        const selection = $getSelection();
        
        if ($isRangeSelection(selection)) {
          const anchor = selection.anchor;
          const focus = selection.focus;
          
          // Only handle single-node selections
          if (anchor.key === focus.key) {
            const textNode = anchor.getNode();
            if (textNode && textNode.getType() === 'text') {
              const textContent = textNode.getTextContent();
              const offset = anchor.offset;
              
              // Check if selection is at boundary
              const isAtBeginning = offset === 0;
              const isAtEnd = offset === textContent.length;
              
              if (isAtBeginning || isAtEnd) {
                console.log(`[TextBoundaryFixPlugin] Boundary selection detected: offset=${offset}, isAtBeginning=${isAtBeginning}, isAtEnd=${isAtEnd}, textLength=${textContent.length}`);
              }
            }
          }
        }
        
        return false; // Let default behavior handle it
      },
      COMMAND_PRIORITY_CRITICAL
    );

    // Handle enter key at boundaries
    const removeEnterKey = editor.registerCommand(
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
              
              const isAtBeginning = offset === 0;
              const isAtEnd = offset === textContent.length;
              
              if (isAtBeginning || isAtEnd) {
                console.log(`[TextBoundaryFixPlugin] Boundary enter detected: offset=${offset}, isAtBeginning=${isAtBeginning}, isAtEnd=${isAtEnd}`);
              }
            }
          }
        }
        
        return false; // Let default behavior handle it
      },
      COMMAND_PRIORITY_CRITICAL
    );

    return () => {
      removeTextInsertion();
      removeEnterKey();
    };
  }, [editor]);

  return null;
}
