import { $getSelection, $isRangeSelection, $createParagraphNode, $insertNodes, $getRoot, $isNodeSelection, FORMAT_ELEMENT_COMMAND } from 'lexical';
import { COMMAND_PRIORITY_EDITOR, COMMAND_PRIORITY_HIGH } from 'lexical';
import { VideoNode } from '../nodes/VideoNode';

export const INSERT_VIDEO_COMMAND = 'INSERT_VIDEO_COMMAND';

export interface InsertVideoPayload {
  src: string;
  altText?: string;
  width?: number;
  height?: number;
}

export default function VideoPlugin(): null {
  return null;
}

export function registerVideoPlugin(editor: any) {
  // Register INSERT_VIDEO_COMMAND
  editor.registerCommand(
    INSERT_VIDEO_COMMAND,
    (payload: InsertVideoPayload) => {
      console.log('INSERT_VIDEO_COMMAND received:', payload);
      const videoNode = $createVideoNode(payload);
      const selection = $getSelection();
      
      if ($isRangeSelection(selection)) {
        // Insert video and wrap in paragraph if at root
        const paragraphNode = $createParagraphNode();
        paragraphNode.append(videoNode);
        $insertNodes([paragraphNode]);
        console.log('Video node inserted with paragraph');
      } else {
        // Fallback: insert at the end
        const root = $getRoot();
        const paragraphNode = $createParagraphNode();
        paragraphNode.append(videoNode);
        root.append(paragraphNode);
        console.log('Video node inserted at end');
      }
      
      return true;
    },
    COMMAND_PRIORITY_EDITOR,
  );

  // Register FORMAT_ELEMENT_COMMAND for video alignment (similar to images)
  editor.registerCommand(
    FORMAT_ELEMENT_COMMAND,
    (format: any) => {
      const selection = $getSelection();
      
      if ($isNodeSelection(selection)) {
        const selectedNodes = selection.getNodes();
        let hasVideoNodes = false;
        
        for (const node of selectedNodes) {
          if (node instanceof VideoNode) {
            hasVideoNodes = true;
            const parent = node.getParent();
            if (parent && parent.getType() === 'paragraph') {
              // Check if parent paragraph only contains this video
              const parentChildren = parent.getChildren();
              if (parentChildren.length === 1 && parentChildren[0] === node) {
                // Isolated video paragraph - apply format directly
                parent.setFormat(format);
              } else {
                // Video is mixed with other content - create new paragraph
                const newParagraph = $createParagraphNode();
                newParagraph.setFormat(format);
                parent.insertAfter(newParagraph);
                newParagraph.append(node);
              }
            }
          }
        }
        
        if (hasVideoNodes) {
          return true;
        }
      }
      
      return false;
    },
    COMMAND_PRIORITY_HIGH,
  );
}

export function $createVideoNode(payload: InsertVideoPayload): VideoNode {
  return new VideoNode({
    src: payload.src,
    altText: payload.altText || '',
    width: payload.width,
    height: payload.height,
  });
}

export function $isVideoNode(node: any): node is VideoNode {
  return node instanceof VideoNode;
}

export function convertVideoElement(element: HTMLVideoElement): VideoNode {
  const src = element.src;
  const altText = '';
  const width = element.width || 400;
  const height = element.height || 300;
  
  return new VideoNode({
    src,
    altText: altText,
    width,
    height,
  });
} 
