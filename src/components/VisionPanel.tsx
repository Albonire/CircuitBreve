import { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { Camera, Image as ImageIcon, Upload, Loader2, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

interface VisionPanelProps {
  onInsertCode: (code: string) => void;
}

const MOCK_CIRCUIT_HDL = `# Extracted from Image
MODULE Adder(A, B) -> (Sum, Carry) {
  Sum = XOR(A, B)
  Carry = AND(A, B)
}

INPUT In1, In2, CarryIn

S1, C1 = Adder(In1, In2)
Out, C2 = Adder(S1, CarryIn)
CarryOut = OR(C1, C2)

OUTPUT Out
OUTPUT CarryOut`;

export default function VisionPanel({ onInsertCode }: VisionPanelProps) {
  const { palette: p } = useTheme();
  const [image, setImage] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [extractedCode, setExtractedCode] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle Paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) handleFile(file);
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setImage(e.target?.result as string);
      setStatus('idle');
      setExtractedCode('');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const analyzeImage = () => {
    if (!image) return;
    setStatus('analyzing');

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setStatus('error');
        setErrorMsg('Canvas not supported');
        return;
      }
      
      // Resize for performance
      const MAX = 200;
      let w = img.width;
      let h = img.height;
      if (w > MAX || h > MAX) {
        const ratio = Math.min(MAX / w, MAX / h);
        w *= ratio;
        h *= ratio;
      }
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h).data;
      let colorfulPixels = 0;
      let totalPixels = 0;

      // Simple heuristic: count highly saturated pixels
      for (let i = 0; i < imageData.length; i += 4) {
        const r = imageData[i];
        const g = imageData[i+1];
        const b = imageData[i+2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const sat = max === 0 ? 0 : (max - min) / max;
        
        // If it's a bright-ish pixel and very colorful, it's probably not a schematic
        if (max > 50 && sat > 0.25) {
          colorfulPixels++;
        }
        totalPixels++;
      }

      const colorfulRatio = colorfulPixels / totalPixels;

      // Simulate network delay
      setTimeout(() => {
        if (colorfulRatio > 0.15) { // more than 15% colorful -> reject
          setStatus('error');
          setErrorMsg('Image is too colorful. Please upload a black & white circuit schematic.');
        } else {
          setStatus('success');
          setExtractedCode(MOCK_CIRCUIT_HDL);
        }
      }, 1500);
    };
    img.src = image;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: `1px solid ${p.borderSubtle}` }}>
        <Camera size={13} style={{ color: p.accent }} />
        <div>
          <p className="text-[11px] font-bold" style={{ color: p.textPrimary }}>Image to HDL</p>
          <p className="text-[9px]" style={{ color: p.textFaint }}>Upload a circuit schematic</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-3 py-3 space-y-3">
        {/* Upload Zone */}
        {!image && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center p-6 rounded-lg cursor-pointer transition-colors border-2 border-dashed"
            style={{ borderColor: p.border, background: p.bgInset }}
            onMouseEnter={e => e.currentTarget.style.borderColor = p.accent}
            onMouseLeave={e => e.currentTarget.style.borderColor = p.border}
          >
            <Upload size={20} style={{ color: p.textMuted, marginBottom: 8 }} />
            <p className="text-[11px] font-medium text-center" style={{ color: p.textSecondary }}>
              Click or drag image here
            </p>
            <p className="text-[9px] mt-1 text-center" style={{ color: p.textFaint }}>
              or paste from clipboard (Ctrl+V)
            </p>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/png, image/jpeg"
              onChange={e => e.target.files && handleFile(e.target.files[0])} />
          </div>
        )}

        {/* Image Preview */}
        {image && (
          <div className="rounded-lg overflow-hidden relative" style={{ border: `1px solid ${p.border}` }}>
            <img src={image} alt="Preview" className="w-full h-32 object-contain" style={{ background: '#000' }} />
            <button onClick={() => { setImage(null); setStatus('idle'); setExtractedCode(''); }}
              className="absolute top-1 right-1 p-1 bg-black/50 rounded-md text-white hover:bg-black/80">
              ✕
            </button>
          </div>
        )}

        {/* Action Button */}
        {image && status === 'idle' && (
          <button onClick={analyzeImage}
            className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: p.accent }}>
            <ImageIcon size={12} /> Scan Circuit
          </button>
        )}

        {/* Status */}
        {status === 'analyzing' && (
          <div className="flex flex-col items-center py-4" style={{ color: p.textMuted }}>
            <Loader2 size={16} className="animate-spin mb-2" />
            <p className="text-[10px]">Analyzing structure...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg" style={{ background: p.errorSoft, border: `1px solid ${p.error}30` }}>
            <AlertTriangle size={14} style={{ color: p.error, flexShrink: 0 }} />
            <p className="text-[10px] leading-relaxed" style={{ color: p.textSecondary }}>{errorMsg}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2 rounded-md" style={{ background: p.successSoft }}>
              <CheckCircle2 size={12} style={{ color: p.success }} />
              <p className="text-[10px]" style={{ color: p.success }}>Circuit extracted successfully!</p>
            </div>
            <pre className="p-2 rounded text-[9px] font-mono overflow-auto"
              style={{ background: p.bgInset, color: p.textSecondary, border: `1px solid ${p.borderSubtle}` }}>
              {extractedCode}
            </pre>
            <button onClick={() => onInsertCode(extractedCode)}
              className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: p.accent }}>
              <ArrowRight size={12} /> Insert to Editor
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
