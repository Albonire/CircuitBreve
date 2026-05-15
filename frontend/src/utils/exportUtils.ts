// ============================================================
// LogicSVG Pro — Export Utilities
// ============================================================

export function exportSVG(svgElement: SVGSVGElement): void {
  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  const bbox = svgElement.getBBox();
  clone.setAttribute('viewBox', `${bbox.x - 20} ${bbox.y - 20} ${bbox.width + 40} ${bbox.height + 40}`);
  clone.setAttribute('width', String(bbox.width + 40));
  clone.setAttribute('height', String(bbox.height + 40));

  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(clone);
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, 'circuit.svg');
}

export function exportPNG(svgElement: SVGSVGElement, scale: number = 3): void {
  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const bbox = svgElement.getBBox();
  const width = (bbox.width + 40) * scale;
  const height = (bbox.height + 40) * scale;

  clone.setAttribute('viewBox', `${bbox.x - 20} ${bbox.y - 20} ${bbox.width + 40} ${bbox.height + 40}`);
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));

  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(clone);
  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0d0d0d';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        if (blob) downloadBlob(blob, 'circuit.png');
      }, 'image/png');
    }
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

export function exportPDF(svgElement: SVGSVGElement): void {
  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const bbox = svgElement.getBBox();
  clone.setAttribute('viewBox', `${bbox.x - 20} ${bbox.y - 20} ${bbox.width + 40} ${bbox.height + 40}`);

  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(clone);

  const html = `<!DOCTYPE html><html><head><title>LogicSVG Pro - Circuit Export</title>
    <style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#fff;}
    @media print{body{background:white;}}</style></head>
    <body>${svgStr}<script>window.print();</script></body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
