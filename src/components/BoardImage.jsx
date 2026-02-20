import { useState, useEffect, useRef } from 'react';
import { Group, Image as KImage, Rect, Transformer } from 'react-konva';
import { useBoard } from '../context/BoardContext';

export default function BoardImage({ id, data }) {
  const {
    moveObject, deleteObject, resizeObject,
    selectedIds, toggleSelection, startEditing, stopEditing,
  } = useBoard();

  const {
    x = 0, y = 0, width = 240, height = 160,
    dataUrl = '', rotation = 0,
  } = data;

  const groupRef = useRef(null);
  const transformerRef = useRef(null);
  const dragThrottleRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [img, setImg] = useState(null);
  const isSelected = selectedIds.has(id);

  // Load image from dataUrl
  useEffect(() => {
    if (!dataUrl) return;
    const image = new window.Image();
    image.src = dataUrl;
    image.onload = () => setImg(image);
  }, [dataUrl]);

  useEffect(() => {
    if (isSelected && transformerRef.current && groupRef.current) {
      transformerRef.current.nodes([groupRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, width, height]);

  useEffect(() => {
    const handleKey = (e) => {
      if (isSelected && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        deleteObject(id);
      }
    };
    if (isSelected) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isSelected, id, deleteObject]);

  const handleDragStart = () => { setIsDragging(true); startEditing(id); };
  const handleDragMove = (e) => {
    if (!dragThrottleRef.current) {
      dragThrottleRef.current = setTimeout(() => {
        moveObject(id, e.target.x(), e.target.y());
        dragThrottleRef.current = null;
      }, 50);
    }
  };
  const handleDragEnd = (e) => {
    clearTimeout(dragThrottleRef.current);
    dragThrottleRef.current = null;
    moveObject(id, e.target.x(), e.target.y());
    setIsDragging(false);
    stopEditing(id);
  };
  const handleTransformEnd = () => {
    const node = groupRef.current;
    if (!node) return;
    const scaleX = node.scaleX(); const scaleY = node.scaleY();
    node.scaleX(1); node.scaleY(1);
    resizeObject(id, Math.max(20, width * scaleX), Math.max(20, height * scaleY));
  };

  return (
    <>
      <Group
        ref={groupRef} x={x} y={y} rotation={rotation}
        draggable opacity={isDragging ? 0.8 : 1}
        onClick={(e) => { e.cancelBubble = true; toggleSelection(id, e.evt.shiftKey); }}
        onTap={(e) => { e.cancelBubble = true; toggleSelection(id, false); }}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      >
        {img ? (
          <KImage image={img} width={width} height={height} />
        ) : (
          <Rect
            width={width} height={height}
            fill="#1e293b"
            stroke="#334155" strokeWidth={1}
          />
        )}
        {isSelected && (
          <Rect
            width={width} height={height}
            stroke="#667eea" strokeWidth={1.5}
            dash={[5, 3]} fill="transparent"
            listening={false}
          />
        )}
      </Group>
      {isSelected && (
        <Transformer
          ref={transformerRef}
          keepRatio
          rotateEnabled
          boundBoxFunc={(_, nb) => ({
            ...nb,
            width: Math.max(20, nb.width),
            height: Math.max(20, nb.height),
          })}
        />
      )}
    </>
  );
}
