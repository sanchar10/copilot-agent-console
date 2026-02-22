import { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';

interface Props {
  onScan: (data: string) => void;
  onClose: () => void;
}

export function QRScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let animationId: number;
    let stopped = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          scanFrame();
        }
      } catch {
        setError('Camera access denied. Please allow camera permissions.');
      }
    }

    function scanFrame() {
      if (stopped) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        animationId = requestAnimationFrame(scanFrame);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code?.data) {
        onScan(code.data);
        return;
      }
      animationId = requestAnimationFrame(scanFrame);
    }

    startCamera();

    return () => {
      stopped = true;
      cancelAnimationFrame(animationId);
      stopCamera();
    };
  }, [onScan, stopCamera]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between p-4">
        <h2 className="text-white font-semibold">Scan QR Code</h2>
        <button onClick={() => { stopCamera(); onClose(); }} className="text-white text-2xl">✕</button>
      </div>

      {error ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-red-400 text-center">{error}</p>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center relative">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          {/* Scan overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 border-2 border-white/50 rounded-2xl" />
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
      <p className="text-gray-400 text-xs text-center p-4">
        Point your camera at the QR code in desktop Settings
      </p>
    </div>
  );
}
