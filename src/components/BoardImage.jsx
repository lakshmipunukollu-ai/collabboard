import { useState, useEffect, useRef } from 'react';
import { Image as KImage, Rect, Transformer } from 'react-konva';
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

  const imageRef = useRef(null);
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

  // Attach transformer to the image node when selected
  useEffect(() => {
    if (isSelected && transformerRef.current && imageRef.current) {
      transformerRef.current.nodes([imageRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  // Delete key handler
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
    const node = imageRef.current;
    if (!node) return;
    // Read live values from the node — avoids stale closure on width/height
    const newW = Math.max(20, node.width() * node.scaleX());
    const newH = Math.max(20, node.height() * node.scaleY());
    const newX = node.x();
    const newY = node.y();
    // Bake scale back into dimensions
    node.scaleX(1);
    node.scaleY(1);
    node.width(newW);
    node.height(newH);
    resizeObject(id, newW, newH);
    moveObject(id, newX, newY);
  };

  return (
    <>
      {img ? (
        <KImage
          ref={imageRef}
          image={img}
          x={x} y={y}
          width={width} height={height}
          rotation={rotation}
          draggable
          opacity={isDragging ? 0.8 : 1}
          onClick={(e) => { e.cancelBubble = true; toggleSelection(id, e.evt.shiftKey); }}
          onTap={(e) => { e.cancelBubble = true; toggleSelection(id, false); }}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onTransformEnd={handleTransformEnd}
        />
      ) : (
        /* Placeholder while image loads */
        <Rect
          x={x} y={y}
          width={width} height={height}
          fill="#1e293b"
          stroke="#334155" strokeWidth={1}
          onClick={(e) => { e.cancelBubble = true; toggleSelection(id, e.evt.shiftKey); }}
          onTap={(e) => { e.cancelBubble = true; toggleSelection(id, false); }}
        />
      )}

      {/* Selection highlight */}
      {isSelected && (
        <Rect
          x={x} y={y}
          width={width} height={height}
          stroke="#667eea" strokeWidth={1.5}
          dash={[5, 3]} fill="transparent"
          listening={false}
        />
      )}

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
