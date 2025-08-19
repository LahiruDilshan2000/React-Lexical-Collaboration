import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $wrapNodeInElement, mergeRegister } from "@lexical/utils";
import {
  $createParagraphNode,
  $getSelection,
  $insertNodes,
  $isNodeSelection,
  $isRootOrShadowRoot,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_HIGH,
  createCommand,
  FORMAT_ELEMENT_COMMAND,
  LexicalCommand
} from "lexical";
import { useEffect } from "react";

import { $createImageNode, $isImageNode, ImageNode, ImagePayload } from "../nodes/ImageNode";

export type InsertImagePayload = Readonly<ImagePayload>;

export const INSERT_IMAGE_COMMAND: LexicalCommand<InsertImagePayload> = createCommand(
  "INSERT_IMAGE_COMMAND"
);

export default function ImagesPlugin({
  captionsEnabled
}: {
  captionsEnabled?: boolean;
}): React.JSX.Element | null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([ImageNode])) {
      throw new Error("ImagesPlugin: ImageNode not registered on editor");
    }

    return mergeRegister(
      editor.registerCommand<InsertImagePayload>(
        INSERT_IMAGE_COMMAND,
        (payload) => {
          try {
            const imageNode = $createImageNode(payload);
            
            // Get current selection
            const selection = $getSelection();
            if (selection) {
              // Insert the image node at the current selection
              selection.insertNodes([imageNode]);
              
              // Wrap the image in a paragraph if it's not already in a block
              if ($isRootOrShadowRoot(imageNode.getParentOrThrow())) {
                $wrapNodeInElement(imageNode, $createParagraphNode).selectEnd();
              }
            } else {
              // If no selection, use $insertNodes to insert at the end
              const paragraphNode = $createParagraphNode();
              paragraphNode.append(imageNode);
              $insertNodes([paragraphNode]);
              paragraphNode.selectEnd();
            }

            return true;
          } catch (error) {
            console.error('Error inserting image:', error);
            return false;
          }
        },
        COMMAND_PRIORITY_EDITOR
      ),
      editor.registerCommand(
        FORMAT_ELEMENT_COMMAND,
        (format) => {
          console.log('FORMAT_ELEMENT_COMMAND received:', format);
          const selection = $getSelection();
          console.log('Selection type:', selection ? selection.constructor.name : 'null');
          
          if ($isNodeSelection(selection)) {
            const nodes = selection.getNodes();
            console.log('Selected nodes:', nodes.length);
            let hasImageNode = false;
            
            nodes.forEach((node) => {
              console.log('Node type:', node.getType());
              if ($isImageNode(node)) {
                hasImageNode = true;
                console.log('Found image node, setting format:', format);
                
                // Get the parent paragraph and ensure it only contains this image
                const parent = node.getParent();
                if (parent && parent.getType() === 'paragraph') {
                  // Check if this paragraph only contains the image (no other content)
                  const children = parent.getChildren();
                  if (children.length === 1 && children[0] === node) {
                    // This paragraph only contains the image, safe to align
                    parent.setFormat(format);
                    console.log('Setting format on image-only paragraph:', format);
                    
                    // Debug: Check the actual DOM element
                    setTimeout(() => {
                      const domElement = editor.getElementByKey(parent.getKey());
                      if (domElement) {
                        console.log('Paragraph DOM element:', domElement);
                        console.log('Paragraph attributes:', domElement.attributes);
                        console.log('Paragraph style:', domElement.style.textAlign);
                        console.log('Paragraph data attributes:', domElement.dataset);
                        
                        // Force a re-render to ensure alignment is applied
                        editor.update(() => {
                          // This triggers a re-render
                        });
                      }
                    }, 100);
                    
                    return true; // Stop processing other nodes
                  } else {
                    // Move the image to its own paragraph
                    console.log('Moving image to its own paragraph for alignment');
                    const newParagraph = $createParagraphNode();
                    newParagraph.setFormat(format);
                    node.insertBefore(newParagraph);
                    newParagraph.append(node);
                    console.log('Image moved to new paragraph with format:', format);
                    return true;
                  }
                } else {
                  console.log('No paragraph parent found for image node');
                }
              }
            });
            
            if (hasImageNode) {
              console.log('Returning true - handled image format');
              return true;
            }
          }
          console.log('Returning false - no image nodes found');
          return false;
        },
        COMMAND_PRIORITY_HIGH
      )
    );
  }, [captionsEnabled, editor]);

  return null;
}

