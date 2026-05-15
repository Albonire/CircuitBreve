import { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';
import {
  Camera,
  Image as ImageIcon,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';

interface VisionPanelProps {
  onInsertCode: (code: string) => void;
}

export default function VisionPanel({ onInsertCode }: VisionPanelProps) {

  const { palette: p } = useTheme();

  const [image, setImage] = useState<string | null>(null);

  const [status, setStatus] =
    useState<'idle' | 'analyzing' | 'success' | 'error'>('idle');

  const [errorMsg, setErrorMsg] = useState('');

  const [extractedCode, setExtractedCode] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─────────────────────────────────────
  // Handle Paste
  // ─────────────────────────────────────

  useEffect(() => {

    const handlePaste = (e: ClipboardEvent) => {

      const items = e.clipboardData?.items;

      if (!items) return;

      for (const item of items) {

        if (item.type.startsWith('image/')) {

          const file = item.getAsFile();

          if (file) {
            handleFile(file);
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);

    return () => {
      window.removeEventListener('paste', handlePaste);
    };

  }, []);

  // ─────────────────────────────────────
  // Load Image
  // ─────────────────────────────────────

  const handleFile = (file: File) => {

    if (!file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {

      setImage(e.target?.result as string);

      setStatus('idle');

      setExtractedCode('');

      setErrorMsg('');
    };

    reader.readAsDataURL(file);
  };

  // ─────────────────────────────────────
  // Drag & Drop
  // ─────────────────────────────────────

  const handleDrop = (e: React.DragEvent) => {

    e.preventDefault();

    const file = e.dataTransfer.files[0];

    if (file) {
      handleFile(file);
    }
  };

  // ─────────────────────────────────────
  // REAL AI ANALYSIS
  // ─────────────────────────────────────

  const analyzeImage = async () => {

    if (!image) return;

    try {

      setStatus('analyzing');

      setErrorMsg('');

      // Convert base64 image to blob
      const response = await fetch(image);

      const blob = await response.blob();

      // Send to backend
      const formData = new FormData();

      formData.append(
        'file',
        blob,
        'circuit.png'
      );

      const res = await fetch(
        'http://127.0.0.1:8000/scan-circuit',
        {
          method: 'POST',
          body: formData
        }
      );

      if (!res.ok) {

        throw new Error(
          `Server Error ${res.status}`
        );
      }

      const data = await res.json();

      if (!data.hdl) {

        throw new Error(
          'No HDL returned'
        );
      }

      setExtractedCode(data.hdl);

      setStatus('success');

    } catch (err) {

      console.error(err);

      setStatus('error');

      setErrorMsg(
        'Could not analyze image. Check backend connection or API key.'
      );
    }
  };

  // ─────────────────────────────────────
  // UI
  // ─────────────────────────────────────

  return (

    <div className="h-full flex flex-col">

      {/* Header */}

      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{
          borderBottom: `1px solid ${p.borderSubtle}`
        }}
      >

        <Camera
          size={13}
          style={{ color: p.accent }}
        />

        <div>

          <p
            className="text-[11px] font-bold"
            style={{ color: p.textPrimary }}
          >
            AI Circuit Scanner
          </p>

          <p
            className="text-[9px]"
            style={{ color: p.textFaint }}
          >
            Upload a circuit schematic
          </p>

        </div>

      </div>

      {/* Content */}

      <div className="flex-1 overflow-auto px-3 py-3 space-y-3">

        {/* Upload Zone */}

        {!image && (

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center p-6 rounded-lg cursor-pointer transition-colors border-2 border-dashed"
            style={{
              borderColor: p.border,
              background: p.bgInset
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = p.accent;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = p.border;
            }}
          >

            <Upload
              size={20}
              style={{
                color: p.textMuted,
                marginBottom: 8
              }}
            />

            <p
              className="text-[11px] font-medium text-center"
              style={{ color: p.textSecondary }}
            >
              Click or drag image here
            </p>

            <p
              className="text-[9px] mt-1 text-center"
              style={{ color: p.textFaint }}
            >
              or paste from clipboard (Ctrl+V)
            </p>

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/png, image/jpeg"
              onChange={e => {

                if (e.target.files) {

                  handleFile(
                    e.target.files[0]
                  );
                }
              }}
            />

          </div>
        )}

        {/* Image Preview */}

        {image && (

          <div
            className="rounded-lg overflow-hidden relative"
            style={{
              border: `1px solid ${p.border}`
            }}
          >

            <img
              src={image}
              alt="Preview"
              className="w-full h-40 object-contain"
              style={{ background: '#000' }}
            />

            <button
              onClick={() => {

                setImage(null);

                setStatus('idle');

                setExtractedCode('');

                setErrorMsg('');
              }}
              className="absolute top-1 right-1 p-1 bg-black/50 rounded-md text-white hover:bg-black/80"
            >
              ✕
            </button>

          </div>
        )}

        {/* Analyze Button */}

        {image && status === 'idle' && (

          <button
            onClick={analyzeImage}
            className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{
              background: p.accent
            }}
          >

            <ImageIcon size={12} />

            Scan Circuit

          </button>
        )}

        {/* Loading */}

        {status === 'analyzing' && (

          <div
            className="flex flex-col items-center py-4"
            style={{
              color: p.textMuted
            }}
          >

            <Loader2
              size={16}
              className="animate-spin mb-2"
            />

            <p className="text-[10px]">
              AI analyzing circuit...
            </p>

          </div>
        )}

        {/* Error */}

        {status === 'error' && (

          <div
            className="flex items-start gap-2 p-2.5 rounded-lg"
            style={{
              background: p.errorSoft,
              border: `1px solid ${p.error}30`
            }}
          >

            <AlertTriangle
              size={14}
              style={{
                color: p.error,
                flexShrink: 0
              }}
            />

            <p
              className="text-[10px] leading-relaxed"
              style={{
                color: p.textSecondary
              }}
            >
              {errorMsg}
            </p>

          </div>
        )}

        {/* Success */}

        {status === 'success' && (

          <div className="space-y-2">

            <div
              className="flex items-center gap-2 p-2 rounded-md"
              style={{
                background: p.successSoft
              }}
            >

              <CheckCircle2
                size={12}
                style={{
                  color: p.success
                }}
              />

              <p
                className="text-[10px]"
                style={{
                  color: p.success
                }}
              >
                Circuit extracted successfully!
              </p>

            </div>

            <pre
              className="p-2 rounded text-[9px] font-mono overflow-auto"
              style={{
                background: p.bgInset,
                color: p.textSecondary,
                border: `1px solid ${p.borderSubtle}`
              }}
            >
              {extractedCode}
            </pre>

            <button
              onClick={() => onInsertCode(extractedCode)}
              className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{
                background: p.accent
              }}
            >

              <ArrowRight size={12} />

              Insert to Editor

            </button>

          </div>
        )}

      </div>

    </div>
  );
}