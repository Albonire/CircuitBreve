import { useState, useCallback, useRef, useEffect } from 'react';

export type ResizeDirection = 'horizontal' | 'vertical';

interface UseResizableOptions {
  direction: ResizeDirection;
  initialSize: number;
  minSize: number;
  maxSize: number;
  onResize?: (size: number) => void;
}

export function useResizable({ direction, initialSize, minSize, maxSize, onResize }: UseResizableOptions) {
  const [size, setSize] = useState(initialSize);
  const isResizing = useRef(false);
  const startPos = useRef(0);
  const startSize = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    startPos.current = direction === 'horizontal' ? e.clientX : e.clientY;
    startSize.current = size;
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [direction, size]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
      const delta = currentPos - startPos.current;
      const newSize = Math.max(minSize, Math.min(maxSize, startSize.current + delta));
      setSize(newSize);
      onResize?.(newSize);
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [direction, minSize, maxSize, onResize]);

  return { size, setSize, handleMouseDown, isResizing: isResizing.current };
}

// For the bottom panel that resizes upward (inverted)
export function useResizableInverted({ direction, initialSize, minSize, maxSize, onResize }: UseResizableOptions) {
  const [size, setSize] = useState(initialSize);
  const isResizing = useRef(false);
  const startPos = useRef(0);
  const startSize = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    startPos.current = direction === 'horizontal' ? e.clientX : e.clientY;
    startSize.current = size;
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [direction, size]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
      const delta = startPos.current - currentPos; // inverted
      const newSize = Math.max(minSize, Math.min(maxSize, startSize.current + delta));
      setSize(newSize);
      onResize?.(newSize);
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [direction, minSize, maxSize, onResize]);

  return { size, setSize, handleMouseDown, isResizing: isResizing.current };
}
