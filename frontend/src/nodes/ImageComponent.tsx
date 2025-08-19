import type { LexicalEditor, NodeKey } from "lexical";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import { mergeRegister } from "@lexical/utils";
import {
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
  $getRoot,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import * as React from "react";
import { Suspense, useRef, useCallback, useEffect } from "react";

import { $isImageNode } from "./ImageNode";

const imageCache = new Set();

function useSuspenseImage(src: string) {
  if (!imageCache.has(src)) {
    throw new Promise((resolve) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        imageCache.add(src);
        resolve(null);
      };
    });
  }
}

function LazyImage({
  altText,
  className,
  imageRef,
  src,
  width,
  height,
  maxWidth,
  onClick
}: {
  altText: string;
  className: string | null;
  height: "inherit" | number;
  imageRef: { current: null | HTMLImageElement };
  maxWidth: number;
  src: string;
  width: "inherit" | number;
  onClick?: (event: React.MouseEvent<HTMLImageElement>) => void;
}): React.JSX.Element {
  useSuspenseImage(src);
  return (
    <img
      className={className || undefined}
      src={src}
      alt={altText}
      ref={imageRef}
      onClick={onClick}
      style={{
        height,
        maxWidth,
        width,
        display: 'block'
      }}
    />
  );
}

export default function ImageComponent({
  src,
  altText,
  width,
  height,
  maxWidth,
  nodeKey
}: {
  altText: string;
  caption: LexicalEditor;
  height: "inherit" | number;
  maxWidth: number;
  nodeKey: NodeKey;
  resizable: boolean;
  showCaption: boolean;
  src: string;
  width: "inherit" | number;
  captionsEnabled: boolean;
}): React.JSX.Element {
  const imageRef = useRef<null | HTMLImageElement>(null);
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected] = useLexicalNodeSelection(nodeKey);

  const onDelete = useCallback(
    (event: KeyboardEvent) => {
      event.preventDefault();
      if (isSelected && $isNodeSelection($getSelection())) {
        const node = $getNodeByKey(nodeKey);
        if ($isImageNode(node)) {
          node.remove();
        }
        setSelected(false);
      }
      return false;
    },
    [isSelected, nodeKey, setSelected]
  );



  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        CLICK_COMMAND,
        (event) => {
          // Only handle clicks on the select icon specifically
          const target = event.target as HTMLElement;
          if (target && target.getAttribute('data-select-icon') === 'true') {
            event.preventDefault();
            event.stopPropagation();
            setSelected(true);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        KEY_DELETE_COMMAND,
        onDelete,
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        onDelete,
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          if (isSelected) {
            setSelected(false);
          }
          return false;
        },
        COMMAND_PRIORITY_LOW
      )
    );
  }, [editor, isSelected, onDelete, setSelected]);

  // Listen for global selection changes to update image selection state
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = $getSelection();
      if (selection) {
        // Check for both node selection and range selection
        if ($isNodeSelection(selection)) {
          const selectedNodes = selection.getNodes();
          const isImageSelected = selectedNodes.some(node => 
            node.getKey() === nodeKey
          );
          if (isImageSelected !== isSelected) {
            setSelected(isImageSelected);
          }
        } else if ($isRangeSelection(selection)) {
          // For range selection (like Select All), check if this node is within the selection
          const anchor = selection.anchor;
          const focus = selection.focus;
          
          // If the selection spans the entire document, select all nodes including images
          const root = $getRoot();
          const children = root.getChildren();
          if (children.length > 0) {
            const firstChild = children[0];
            const lastChild = children[children.length - 1];
            
            // If selection starts at the beginning and ends at the end, it's a "select all"
            if (anchor.key === firstChild.getKey() && 
                anchor.offset === 0 && 
                focus.key === lastChild.getKey() && 
                focus.offset === lastChild.getTextContentSize()) {
              setSelected(true);
            }
          }
        }
      }
    };

    // Register a listener for selection changes
    const unregister = editor.registerUpdateListener(({editorState}) => {
      editorState.read(() => {
        handleSelectionChange();
      });
    });

    return unregister;
  }, [editor, isSelected, nodeKey, setSelected]);

  return (
    <Suspense fallback={null}>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <LazyImage
          className={isSelected ? "selected" : ""}
          src={src}
          altText={altText}
          imageRef={imageRef}
          width={width}
          height={height}
          maxWidth={maxWidth}
        />
        {/* Select icon overlay */}
        <div
          data-select-icon="true"
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            borderRadius: '50%',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            cursor: 'pointer',
            fontSize: '14px',
          }}
          onClick={(e) => {
            e.stopPropagation();
            setSelected(true);
          }}
          title="Select image"
        >
          ↕️
        </div>
      </div>
    </Suspense>
  );
}

