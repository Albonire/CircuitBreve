interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical';
  onMouseDown: (e: React.MouseEvent) => void;
}

export default function ResizeHandle({ direction, onMouseDown }: ResizeHandleProps) {
  if (direction === 'horizontal') {
    return (
      <div
        className="resize-handle-h flex-shrink-0 w-0 relative cursor-col-resize z-20"
        onMouseDown={onMouseDown}
      >
        {/* Invisible hit area */}
        <div className="absolute inset-y-0 -left-[5px] -right-[5px]" />
      </div>
    );
  }

  return (
    <div
      className="resize-handle-v flex-shrink-0 h-0 relative cursor-row-resize z-20"
      onMouseDown={onMouseDown}
    >
      {/* Invisible hit area */}
      <div className="absolute inset-x-0 -top-[5px] -bottom-[5px]" />
    </div>
  );
}
