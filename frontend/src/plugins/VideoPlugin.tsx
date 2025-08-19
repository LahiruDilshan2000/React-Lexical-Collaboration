import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect } from 'react';
import { registerVideoPlugin } from './VideoPlugin';

export default function VideoPluginComponent() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    registerVideoPlugin(editor);
  }, [editor]);

  return null;
} 
