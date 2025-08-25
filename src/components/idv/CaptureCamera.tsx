"use client";

import * as React from 'react';

interface CaptureCameraProps {
  onCapture: (blob: Blob, canvas: HTMLCanvasElement) => void;
  overlay?: React.ReactNode;
  facingMode?: 'user' | 'environment';
}

export function CaptureCamera({ onCapture, overlay, facingMode = 'environment' }: CaptureCameraProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch {}
    })();
    return () => { stream?.getTracks().forEach(t => t.stop()); };
  }, [facingMode]);

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = canvasRef.current ?? (canvasRef.current = document.createElement('canvas'));
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) onCapture(blob, canvas);
    }, 'image/jpeg', 0.95);
  };

  return (
    <div className="relative w-full">
      <video ref={videoRef} playsInline muted className="w-full rounded-md border border-white/10" />
      {overlay && <div className="pointer-events-none absolute inset-0">{overlay}</div>}
      <div className="mt-3 flex justify-center">
        <button onClick={handleCapture} disabled={!ready} className="px-4 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50">
          {ready ? 'Capture' : 'Initializing camera...'}
        </button>
      </div>
    </div>
  );
}
