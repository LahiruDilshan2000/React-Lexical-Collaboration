import {useLexicalNodeSelection} from '@lexical/react/useLexicalNodeSelection';
import {mergeRegister} from '@lexical/utils';
import {
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  CLICK_COMMAND,
  DRAGSTART_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  SELECTION_CHANGE_COMMAND,
  COMMAND_PRIORITY_LOW,
  NodeKey,
} from 'lexical';
import {useCallback, useEffect, useRef, useState} from 'react';
import {VideoNode} from './VideoNode';

type Direction = 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se';

type VideoResizerProps = {
  editor: any;
  buttonRef: React.RefObject<HTMLButtonElement>;
  videoRef: React.RefObject<HTMLVideoElement>;
  maxWidth?: number;
  onResizeStart: () => void;
  onResizeEnd: (width: 'inherit' | number, height: 'inherit' | number) => void;
  showCaption: boolean;
  setShowCaption: (show: boolean) => void;
  nodeKey: NodeKey;
};

export default function VideoResizer({
  editor,
  buttonRef,
  videoRef,
  maxWidth = 500,
  onResizeStart,
  onResizeEnd,
  showCaption,
  setShowCaption,
  nodeKey,
}: VideoResizerProps): React.JSX.Element {
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [resizeDirection, setResizeDirection] = useState<Direction>('se');
  const [startWidth, setStartWidth] = useState<number>(0);
  const [startHeight, setStartHeight] = useState<number>(0);
  const [startX, setStartX] = useState<number>(0);
  const [startY, setStartY] = useState<number>(0);
  const [currentWidth, setCurrentWidth] = useState<number>(0);
  const [currentHeight, setCurrentHeight] = useState<number>(0);

  const resizerRef = useRef<HTMLDivElement>(null);

  const onDelete = useCallback(
    (event: KeyboardEvent) => {
      if (isSelected && $isNodeSelection($getSelection())) {
        event.preventDefault();
        const node = $getNodeByKey(nodeKey);
        if (node instanceof VideoNode) {
          node.remove();
        }
        setSelected(false);
      }
      return false;
    },
    [isSelected, nodeKey, setSelected],
  );

  const onResizeMouseDown = useCallback(
    (direction: Direction, event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsResizing(true);
      setResizeDirection(direction);

      const videoElement = videoRef.current;
      if (videoElement) {
        const rect = videoElement.getBoundingClientRect();
        setStartWidth(rect.width);
        setStartHeight(rect.height);
        setStartX(event.clientX);
        setStartY(event.clientY);
        setCurrentWidth(rect.width);
        setCurrentHeight(rect.height);
      }

      onResizeStart();
    },
    [videoRef, onResizeStart],
  );

  const onMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!isResizing) return;

      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;

      let newWidth = startWidth;
      let newHeight = startHeight;

      switch (resizeDirection) {
        case 'se':
          newWidth = Math.min(Math.max(100, startWidth + deltaX), maxWidth);
          newHeight = Math.max(100, startHeight + deltaY);
          break;
        case 'sw':
          newWidth = Math.min(Math.max(100, startWidth - deltaX), maxWidth);
          newHeight = Math.max(100, startHeight + deltaY);
          break;
        case 'ne':
          newWidth = Math.min(Math.max(100, startWidth + deltaX), maxWidth);
          newHeight = Math.max(100, startHeight - deltaY);
          break;
        case 'nw':
          newWidth = Math.min(Math.max(100, startWidth - deltaX), maxWidth);
          newHeight = Math.max(100, startHeight - deltaY);
          break;
        case 'e':
          newWidth = Math.min(Math.max(100, startWidth + deltaX), maxWidth);
          break;
        case 'w':
          newWidth = Math.min(Math.max(100, startWidth - deltaX), maxWidth);
          break;
        case 's':
          newHeight = Math.max(100, startHeight + deltaY);
          break;
        case 'n':
          newHeight = Math.max(100, startHeight - deltaY);
          break;
      }

      setCurrentWidth(newWidth);
      setCurrentHeight(newHeight);

      if (videoRef.current) {
        videoRef.current.style.width = `${newWidth}px`;
        videoRef.current.style.height = `${newHeight}px`;
      }
    },
    [isResizing, resizeDirection, startX, startY, startWidth, startHeight, maxWidth, videoRef],
  );

  const onMouseUp = useCallback(() => {
    if (isResizing) {
      setIsResizing(false);
      onResizeEnd(currentWidth, currentHeight);
    }
  }, [isResizing, currentWidth, currentHeight, onResizeEnd]);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      return () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
    }
  }, [isResizing, onMouseMove, onMouseUp]);

  useEffect(() => {
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
          if (event.target === resizerRef.current) {
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
        DRAGSTART_COMMAND,
        (event: any) => {
          if (event.target === resizerRef.current) {
            event.preventDefault();
            event.stopPropagation();
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

  return (
    <div
      ref={resizerRef}
      className={`video-resizer ${isSelected ? 'selected' : ''}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        border: '2px solid #007bff',
        pointerEvents: 'none',
      }}>
      {isSelected && (
        <>
          {/* Resize handles */}
          <div
            className="video-resizer-point video-resizer-point-nw"
            style={{
              position: 'absolute',
              top: '-6px',
              left: '-6px',
              width: '12px',
              height: '12px',
              backgroundColor: '#007bff',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'nw-resize',
              pointerEvents: 'all',
            }}
            onMouseDown={(e) => onResizeMouseDown('nw', e)}
          />
          <div
            className="video-resizer-point video-resizer-point-n"
            style={{
              position: 'absolute',
              top: '-6px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '12px',
              height: '12px',
              backgroundColor: '#007bff',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'n-resize',
              pointerEvents: 'all',
            }}
            onMouseDown={(e) => onResizeMouseDown('n', e)}
          />
          <div
            className="video-resizer-point video-resizer-point-ne"
            style={{
              position: 'absolute',
              top: '-6px',
              right: '-6px',
              width: '12px',
              height: '12px',
              backgroundColor: '#007bff',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'ne-resize',
              pointerEvents: 'all',
            }}
            onMouseDown={(e) => onResizeMouseDown('ne', e)}
          />
          <div
            className="video-resizer-point video-resizer-point-w"
            style={{
              position: 'absolute',
              top: '50%',
              left: '-6px',
              transform: 'translateY(-50%)',
              width: '12px',
              height: '12px',
              backgroundColor: '#007bff',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'w-resize',
              pointerEvents: 'all',
            }}
            onMouseDown={(e) => onResizeMouseDown('w', e)}
          />
          <div
            className="video-resizer-point video-resizer-point-e"
            style={{
              position: 'absolute',
              top: '50%',
              right: '-6px',
              transform: 'translateY(-50%)',
              width: '12px',
              height: '12px',
              backgroundColor: '#007bff',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'e-resize',
              pointerEvents: 'all',
            }}
            onMouseDown={(e) => onResizeMouseDown('e', e)}
          />
          <div
            className="video-resizer-point video-resizer-point-sw"
            style={{
              position: 'absolute',
              bottom: '-6px',
              left: '-6px',
              width: '12px',
              height: '12px',
              backgroundColor: '#007bff',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'sw-resize',
              pointerEvents: 'all',
            }}
            onMouseDown={(e) => onResizeMouseDown('sw', e)}
          />
          <div
            className="video-resizer-point video-resizer-point-s"
            style={{
              position: 'absolute',
              bottom: '-6px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '12px',
              height: '12px',
              backgroundColor: '#007bff',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 's-resize',
              pointerEvents: 'all',
            }}
            onMouseDown={(e) => onResizeMouseDown('s', e)}
          />
          <div
            className="video-resizer-point video-resizer-point-se"
            style={{
              position: 'absolute',
              bottom: '-6px',
              right: '-6px',
              width: '12px',
              height: '12px',
              backgroundColor: '#007bff',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'se-resize',
              pointerEvents: 'all',
            }}
            onMouseDown={(e) => onResizeMouseDown('se', e)}
          />
          
          {/* Caption toggle button */}
          <button
            ref={buttonRef}
            className="video-caption-button"
            onClick={() => setShowCaption(!showCaption)}
            style={{
              position: 'absolute',
              top: '-40px',
              right: '0px',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '12px',
              cursor: 'pointer',
              pointerEvents: 'all',
            }}>
            {showCaption ? 'Hide Caption' : 'Add Caption'}
          </button>
        </>
      )}
    </div>
  );
} 