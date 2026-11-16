import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, AlertCircle, Upload } from 'lucide-react';

interface WorkingCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (base64Image: string, fileSizeBytes: number) => void;
}

export const WorkingCameraModal: React.FC<WorkingCameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Start live camera stream
  useEffect(() => {
    let currentStream: MediaStream | null = null;

    if (isOpen) {
      setCameraError(null);
      navigator.mediaDevices
        ?.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        })
        .then((s) => {
          currentStream = s;
          setStream(s);
          if (videoRef.current) {
            videoRef.current.srcObject = s;
            videoRef.current.play().catch(() => {});
          }
        })
        .catch((err) => {
          console.warn('Camera access error:', err);
          setCameraError(
            err.name === 'NotAllowedError'
              ? 'Camera permission was denied. Please allow camera access in your browser or use the file upload option below.'
              : 'Could not start camera stream on this device. You can capture or choose a photo using the file input.'
          );
        });
    }

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, facingMode]);

  // Stop camera when closing
  const handleClose = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    onClose();
  };

  // Toggle front/back camera
  const toggleFacingMode = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Snap photo from live video onto high-res canvas
  const handleSnap = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg', 0.92);
    const sizeBytes = Math.round((base64.length - base64.indexOf(',') - 1) * 0.75);

    handleClose();
    onCapture(base64, sizeBytes);
  };

  // Fallback file capture
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('File exceeds the 10 MB limit. Please select a smaller image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      handleClose();
      onCapture(base64, file.size);
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="p-3.5 bg-slate-900/90 flex items-center justify-between text-white border-b border-slate-800 z-10">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#2E9E6B]" />
            <span className="text-sm font-bold">Prescription Camera</span>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder area */}
        <div className="relative flex-1 bg-black min-h-[360px] flex items-center justify-center overflow-hidden">
          {cameraError ? (
            <div className="p-6 text-center text-slate-300 max-w-xs space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-xs leading-relaxed">{cameraError}</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-11 bg-[#1E88E5] hover:bg-blue-600 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all"
              >
                <Upload className="w-4 h-4" />
                <span>Use Device File / Camera Picker</span>
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className="w-full h-full object-cover"
              />

              {/* Viewfinder prescription alignment guidelines */}
              <div className="absolute inset-4 pointer-events-none border-2 border-dashed border-emerald-400/50 rounded-2xl flex flex-col justify-between p-3">
                <div className="text-[11px] font-semibold text-emerald-300 bg-black/60 px-2.5 py-1 rounded-full self-start backdrop-blur-xs">
                  Align prescription inside frame
                </div>
                <div className="text-[10px] text-slate-300 bg-black/60 px-2 py-0.5 rounded self-center backdrop-blur-xs">
                  Hold camera steady in good lighting
                </div>
              </div>
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Bottom Shutter Controls */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-8">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-400 hover:text-white rounded-xl flex flex-col items-center gap-1 text-[10px]"
            title="Upload from device"
          >
            <Upload className="w-5 h-5" />
            <span>Files</span>
          </button>

          {/* Shutter Button */}
          <button
            disabled={!!cameraError}
            onClick={handleSnap}
            className={`w-16 h-16 rounded-full border-4 border-white flex items-center justify-center transition-transform active:scale-95 ${
              cameraError ? 'opacity-30 cursor-not-allowed bg-slate-700' : 'bg-[#2E9E6B] hover:bg-emerald-600 shadow-lg shadow-emerald-600/40'
            }`}
            title="Take Photo"
          >
            <div className="w-12 h-12 rounded-full border-2 border-white/50" />
          </button>

          <button
            onClick={toggleFacingMode}
            className="p-2 text-slate-400 hover:text-white rounded-xl flex flex-col items-center gap-1 text-[10px]"
            title="Switch Camera"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Switch</span>
          </button>
        </div>
      </div>
    </div>
  );
};
