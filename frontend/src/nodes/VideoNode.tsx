import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
} from 'lexical';

import {DecoratorNode} from 'lexical';
import * as React from 'react';
import {useCallback, useRef} from 'react';
import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {useLexicalNodeSelection} from '@lexical/react/useLexicalNodeSelection';
import {mergeRegister} from '@lexical/utils';
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
} from 'lexical';



export interface VideoPayload {
  altText: string;
  src: string;
  width?: number;
  height?: number;
}

export interface SerializedVideoNode extends SerializedLexicalNode {
  altText: string;
  src: string;
  width?: number;
  height?: number;
}

function VideoComponent({
  src,
  altText,
  width,
  height,
  nodeKey,
}: {
  altText: string;
  height?: number;
  nodeKey: NodeKey;
  src: string;
  width?: number;
}): React.JSX.Element {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Function to extract YouTube video ID from various YouTube URL formats
  const getYouTubeVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return null;
  };

  const isYouTubeUrl = getYouTubeVideoId(src);


  const onDelete = useCallback(
    (event: KeyboardEvent) => {
      if (isSelected && $isNodeSelection($getSelection())) {
        event.preventDefault();
        const node = $getNodeByKey(nodeKey);
        if ($isVideoNode(node)) {
          node.remove();
        }
        setSelected(false);
      }
      return false;
    },
    [isSelected, nodeKey, setSelected],
  );







     React.useEffect(() => {
     return mergeRegister(
       editor.registerCommand(
         SELECTION_CHANGE_COMMAND,
         () => {
           if (isSelected) {
             return true;
           }
           return false;
         },
         COMMAND_PRIORITY_LOW,
       ),
              editor.registerCommand(
          CLICK_COMMAND,
          (event: any) => {
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
          COMMAND_PRIORITY_LOW,
        ),
       editor.registerCommand(
         KEY_DELETE_COMMAND,
         onDelete,
         COMMAND_PRIORITY_LOW,
       ),
       editor.registerCommand(
         KEY_BACKSPACE_COMMAND,
         onDelete,
         COMMAND_PRIORITY_LOW,
       ),
     );
   }, [clearSelection, editor, isSelected, nodeKey, onDelete, setSelected]);

       // Listen for global selection changes to update video selection state
    React.useEffect(() => {
      const handleSelectionChange = () => {
        const selection = $getSelection();
        if (selection) {
          // Check for both node selection and range selection
          if ($isNodeSelection(selection)) {
            const selectedNodes = selection.getNodes();
            const isVideoSelected = selectedNodes.some(node => 
              node.getKey() === nodeKey
            );
            if (isVideoSelected !== isSelected) {
              setSelected(isVideoSelected);
            }
          } else if ($isRangeSelection(selection)) {
            // For range selection (like Select All), check if this node is within the selection
            const anchor = selection.anchor;
            const focus = selection.focus;
            
            // If the selection spans the entire document, select all nodes including videos
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

  console.log('VideoComponent rendering with src:', src);
  
  // Don't render if src is empty
  if (!src) {
    return <div>Invalid video URL</div>;
  }
  
     return (
     <div className="video-container" style={{ display: 'block', position: 'relative', margin: '10px 0' }}>
       <div 
         className="video-container"
         style={{ 
           position: 'relative', 
           display: 'inline-block',
           border: isSelected ? '2px solid #007bff' : '1px solid #ddd',
           borderRadius: '8px',
           boxShadow: isSelected ? '0 0 0 2px rgba(0, 123, 255, 0.25)' : '0 2px 8px rgba(0,0,0,0.1)',
           overflow: 'hidden',
         }}
       >
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
           title="Select video"
                   >
            ↕️
          </div>
                 {isYouTubeUrl ? (
           <iframe
             src={`https://www.youtube.com/embed/${isYouTubeUrl}`}
             width={width || 320}
             height={height || 180}
             title={altText}
             frameBorder="0"
             allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
             allowFullScreen
             style={{
               display: 'block',
               maxWidth: '100%',
               height: 'auto',
               cursor: 'pointer',
               outline: isSelected ? '2px solid #007bff' : 'none',
               outlineOffset: '2px',
               border: isSelected ? '2px solid #007bff' : 'none',
               borderRadius: '4px',
             }}
           />
         ) : (
           <video
             ref={videoRef}
             src={src}
             width={width || 320}
             height={height || 180}
             controls
             style={{
               display: 'block',
               maxWidth: '100%',
               height: 'auto',
               cursor: 'pointer',
               outline: isSelected ? '2px solid #007bff' : 'none',
               outlineOffset: '2px',
               border: isSelected ? '2px solid #007bff' : 'none',
               borderRadius: '4px',
             }}
           />
         )}
       </div>
     </div>
   );
}

export class VideoNode extends DecoratorNode<React.JSX.Element> {
  __src: string;
  __altText: string;
  __width?: number;
  __height?: number;

  static getType(): string {
    return 'video';
  }

  static clone(node: VideoNode): VideoNode {
    return new VideoNode({
      altText: node.__altText,
      src: node.__src,
      width: node.__width,
      height: node.__height,
    }, node.__key);
  }

  static importJSON(serializedNode: SerializedVideoNode): VideoNode {
    const node = $createVideoNode({
      altText: serializedNode.altText || '',
      src: serializedNode.src || '',
      width: serializedNode.width,
      height: serializedNode.height,
    });
    return node;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('video');
    element.setAttribute('src', this.__src);
    element.setAttribute('alt', this.__altText);
    if (this.__width) {
      element.setAttribute('width', this.__width.toString());
    }
    if (this.__height) {
      element.setAttribute('height', this.__height.toString());
    }
    return {element};
  }

  static importDOM(): DOMConversionMap | null {
    return {
      video: () => ({
        conversion: VideoNode.convertVideoElement,
        priority: 0,
      }),
    };
  }

  static convertVideoElement(domNode: Node): DOMConversionOutput {
    if (domNode instanceof HTMLVideoElement) {
      const {src, width, height} = domNode;
      const node = $createVideoNode({
        altText: '',
        src: src || '',
        width: width || undefined,
        height: height || undefined,
      });
      return {node};
    }
    return {node: null};
  }

  constructor(payload: VideoPayload, key?: NodeKey) {
    super(key);
    this.__src = payload?.src || '';
    this.__altText = payload?.altText || '';
    this.__width = payload?.width;
    this.__height = payload?.height;
  }

  exportJSON(): SerializedVideoNode {
    return {
      ...super.exportJSON(),
      altText: this.__altText,
      src: this.__src,
      width: this.__width,
      height: this.__height,
      type: 'video',
      version: 1,
    };
  }

  createDOM(): HTMLElement {
    const div = document.createElement('div');
    div.style.display = 'contents';
    return div;
  }

  updateDOM(): false {
    return false;
  }

  setWidthAndHeight(width: number | undefined, height: number | undefined): void {
    const writable = this.getWritable();
    writable.__width = width;
    writable.__height = height;
  }

  getSrc(): string {
    return this.__src;
  }

  getAltText(): string {
    return this.__altText;
  }

  decorate(): React.JSX.Element {
    console.log('VideoNode decorate called with src:', this.__src);
    return (
      <VideoComponent
        src={this.__src}
        altText={this.__altText}
        width={this.__width}
        height={this.__height}
        nodeKey={this.getKey()}
      />
    );
  }
}

export function $createVideoNode(payload: VideoPayload): VideoNode {
  return new VideoNode(payload);
}

export function $isVideoNode(
  node: LexicalNode | null | undefined,
): node is VideoNode {
  return node instanceof VideoNode;
} 
