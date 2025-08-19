/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {mergeRegister} from '@lexical/utils';
import {
  $getSelection,
  $isRangeSelection,
  $getRoot,
  $createRangeSelection,
  $setSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_LOW,
  COMMAND_PRIORITY_HIGH,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  SELECT_ALL_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import {useCallback, useEffect, useRef, useState} from 'react';

import type { InsertImagePayload } from "./ImagePlugin";
import { INSERT_IMAGE_COMMAND } from "./ImagePlugin";
import type { InsertVideoPayload } from "./VideoPlugin";
import { INSERT_VIDEO_COMMAND } from "./VideoPlugin";

function Divider() {
  return <div className="divider" />;
}

function handleSelectAll(editor: any) {
  editor.update(() => {
    const root = $getRoot();
    const children = root.getChildren();

    if (children.length > 0) {
      const selection = $createRangeSelection();

      // Simplified selection logic to avoid conflicts with collaborative editing
      try {
        // Use simple element-based selection for collaborative mode
        selection.anchor.set(children[0].getKey(), 0, 'element');
        selection.focus.set(children[children.length - 1].getKey(), (children[children.length - 1] as any).getChildrenSize(), 'element');

        $setSelection(selection);
        console.log('Element selection created for collaborative mode');
      } catch (error) {
        console.warn('Selection creation failed:', error);
        // Fallback: don't set selection if it fails
      }
    }
  });
}
setTimeout(() => {
    const editorElement = document.querySelector('.editor-input') as HTMLElement;
    if (editorElement) {
        editorElement.style.backgroundColor = '#f0f8ff';
        setTimeout(() => {
            editorElement.style.backgroundColor = '';
        }, 300);
    }
}, 50);


// Selection is now properly set
console.log('Element selection created for collaborative mode');

function handleImageUpload(onClick: (payload: InsertImagePayload) => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      try {
        // Create FormData for multipart upload
        const formData = new FormData();
        formData.append('file', file);

        // Upload to backend
        const response = await fetch('http://localhost:8080/api/upload-image', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        const result = await response.json();
        const imageUrl = result.url; // Assuming the API returns { url: "..." }

        // Insert the image with the returned URL
        onClick({
          altText: file.name,
          src: imageUrl,
        });

      } catch (error) {
        console.error('Image upload failed:', error);
        alert('Failed to upload image. Please try again.');
      }
    }
  };
  input.click();
}

function VideoUrlModal({ isOpen, onClose, onInsert }: {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (payload: InsertVideoPayload) => void;
}) {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onInsert({
        src: url.trim(),
        altText: 'Video',
      });
      setUrl('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Insert Video URL</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label htmlFor="video-url">Video URL:</label>
            <input
              id="video-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/video.mp4"
              required
              autoFocus
            />
          </div>
        </form>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button
            className="btn-insert"
            onClick={handleSubmit}
            disabled={!url.trim()}
          >
            Insert Video
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const toolbarRef = useRef(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  const handleImageClick = useCallback((payload: InsertImagePayload) => {
    editor.dispatchCommand(INSERT_IMAGE_COMMAND, payload);
  }, [editor]);

  const handleVideoClick = useCallback((payload: InsertVideoPayload) => {
    (editor as any).dispatchCommand(INSERT_VIDEO_COMMAND, payload);
  }, [editor]);

  const $updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      // Update text format
      const hasBold = selection.hasFormat('bold');
      const hasItalic = selection.hasFormat('italic');
      const hasUnderline = selection.hasFormat('underline');
      const hasStrikethrough = selection.hasFormat('strikethrough');

      console.log('Toolbar update - formats detected:', {
        bold: hasBold,
        italic: hasItalic,
        underline: hasUnderline,
        strikethrough: hasStrikethrough,
        selectedText: selection.getTextContent()
      });

      setIsBold(hasBold);
      setIsItalic(hasItalic);
      setIsUnderline(hasUnderline);
      setIsStrikethrough(hasStrikethrough);
    }
  }, []);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({editorState}) => {
        editorState.read(() => {
          $updateToolbar();
        });
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        (_payload, _newEditor) => {
          $updateToolbar();
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        SELECT_ALL_COMMAND,
        () => {
          console.log('SELECT_ALL_COMMAND received in toolbar');
          handleSelectAll(editor);
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand(
        CAN_UNDO_COMMAND,
        (payload) => {
          setCanUndo(payload);
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        CAN_REDO_COMMAND,
        (payload) => {
          setCanRedo(payload);
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor, $updateToolbar]);

  return (
    <div className="toolbar" ref={toolbarRef}>
      <button
        disabled={!canUndo}
        onClick={() => {
          editor.dispatchCommand(UNDO_COMMAND, undefined);
        }}
        className="toolbar-item spaced"
        aria-label="Undo">
        <i className="format undo" />
      </button>
      <button
        disabled={!canRedo}
        onClick={() => {
          editor.dispatchCommand(REDO_COMMAND, undefined);
        }}
        className="toolbar-item"
        aria-label="Redo">
        <i className="format redo" />
      </button>

      <Divider />
      <button
        onClick={() => {
          console.log('Bold button clicked, current isBold:', isBold);
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
        }}
        className={'toolbar-item spaced ' + (isBold ? 'active' : '')}
        aria-label="Format Bold">
        <i className="format bold" />
      </button>
      <button
        onClick={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
        }}
        className={'toolbar-item spaced ' + (isItalic ? 'active' : '')}
        aria-label="Format Italics">
        <i className="format italic" />
      </button>
      <button
        onClick={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline');
        }}
        className={'toolbar-item spaced ' + (isUnderline ? 'active' : '')}
        aria-label="Format Underline">
        <i className="format underline" />
      </button>
      <button
        onClick={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough');
        }}
        className={'toolbar-item spaced ' + (isStrikethrough ? 'active' : '')}
        aria-label="Format Strikethrough">
        <i className="format strikethrough" />
      </button>
      <Divider />
      <button
                    onClick={() => handleImageUpload(handleImageClick)}
        className="toolbar-item spaced"
        aria-label="Insert Image">
        <i className="format image" />
      </button>
      <button
        onClick={() => setIsVideoModalOpen(true)}
        className="toolbar-item spaced"
        aria-label="Insert Video">
        <i className="format video" />
      </button>
      <Divider />
      <button
        onClick={() => {
          console.log('Left align clicked');
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left');
        }}
        className="toolbar-item spaced"
        aria-label="Left Align">
        <i className="format left-align" />
      </button>
      <button
        onClick={() => {
          console.log('Center align clicked');
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center');
        }}
        className="toolbar-item spaced"
        aria-label="Center Align">
        <i className="format center-align" />
      </button>
      <button
        onClick={() => {
          console.log('Right align clicked');
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'right');
        }}
        className="toolbar-item spaced"
        aria-label="Right Align">
        <i className="format right-align" />
      </button>
      <button
        onClick={() => {
          console.log('Justify align clicked');
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'justify');
        }}
        className="toolbar-item"
        aria-label="Justify Align">
        <i className="format justify-align" />
      </button>{' '}

      <VideoUrlModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        onInsert={handleVideoClick}
      />
    </div>
  );
}

