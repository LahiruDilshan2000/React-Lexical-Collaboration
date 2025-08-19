/**
 * Plugin to extract plain text from Lexical editor and store it globally
 * This enables consistent text logging across the application
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect } from 'react';
import { $getRoot } from 'lexical';

export default function TextExtractionPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const updateGlobalText = () => {
      const currentText = editor.getEditorState().read(() => {
        const root = $getRoot();
        return root.getTextContent();
      });
      
      // Store the current text globally for logging
      (window as any).__CURRENT_EDITOR_TEXT__ = currentText;
      
      console.log('[TextExtractionPlugin] Updated global text:', currentText);
    };

    // Register update listener to track text changes
    const removeUpdateListener = editor.registerUpdateListener(updateGlobalText);

    // Initial text extraction
    updateGlobalText();

    return removeUpdateListener;
  }, [editor]);

  return null;
}


