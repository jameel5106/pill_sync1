import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  X,
  FileText,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Plus,
  Shield,
  FileCheck,
  Video,
} from 'lucide-react';
import { fileImportService, FileProcessingResult } from '../services/fileImport';

interface PrescriptionCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileProcessed: (base64: string, sizeBytes: number) => void;
  onOpenManualEntry: () => void;
}

export const PrescriptionCaptureModal: React.FC<PrescriptionCaptureModalProps> = ({
  isOpen,
  onClose,
  onFileProcessed,
  onOpenManualEntry,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [overLimitFile, setOverLimitFile] = useState<File | null>(null);
  const [isInIframe, setIsInIframe] = useState(false);
  const [showLiveWebcam, setShowLiveWebcam] = useState(false);

  // Live webcam state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Detect iframe embedding
  useEffect(() => {
    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }
  }, []);

  // Manage webcam stream lifecycle
  useEffect(() => {
    let currentStream: MediaStream | null = null;
    if (showLiveWebcam && isOpen) {
      navigator.mediaDevices
        ?.getUserMedia({
          video: { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        })
        .then((stream) => {
          currentStream = stream;
          setWebcamStream(stream);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
        })
        .catch((err) => {
          console.warn('Webcam start failed:', err);
          setErrorMessage('Could not open camera stream. Please use the "Take Photo" or "Choose File" buttons below.');
          setShowLiveWebcam(false);
        });
    }

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [showLiveWebcam, facingMode, isOpen]);

  const closeWebcam = () => {
    if (webcamStream) {
      webcamStream.getTracks().forEach((t) => t.stop());
      setWebcamStream(null);
    }
    setShowLiveWebcam(false);
  };

  const handleModalClose = () => {
    closeWebcam();
    setErrorMessage(null);
    setOverLimitFile(null);
    onClose();
  };

  if (!isOpen) return null;

  // Common file handler
  const handleIncomingFile = async (file: File) => {
    setErrorMessage(null);
    setOverLimitFile(null);
    setIsProcessing(true);

    try {
      const result: FileProcessingResult = await fileImportService.processFile(file);

      if (result.success && result.base64) {
        setIsProcessing(false);
        closeWebcam();
        onClose();
        onFileProcessed(result.base64, result.fileSize);
        return;
      }

      if (result.isOverLimit) {
        setOverLimitFile(file);
      }
      setErrorMessage(result.errorMessage || 'Failed to process file.');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error importing file.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Gallery file change handler
  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleIncomingFile(file);
    }
    // Always reset input value so re-selecting same file triggers change event
    e.target.value = '';
  };

  // Camera file change handler
  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleIncomingFile(file);
    }
    // Always reset input value so taking another photo triggers change event
    e.target.value = '';
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleIncomingFile(file);
    }
  };

  // Auto-compress file > 10MB
  const handleCompressAndProceed = async () => {
    if (!overLimitFile) return;
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const result = await fileImportService.compressImage(overLimitFile, 1600, 0.82);
      if (result.success && result.base64) {
        setIsProcessing(false);
        closeWebcam();
        onClose();
        onFileProcessed(result.base64, result.fileSize);
      } else {
        setErrorMessage(result.errorMessage || 'Compression failed.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Compression error.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Snap from live webcam
  const handleSnapWebcam = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg', 0.92);
    const sizeBytes = Math.round((base64.length * 3) / 4);

    closeWebcam();
    onClose();
    onFileProcessed(base64, sizeBytes);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl text-slate-800 max-h-[92vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-100 text-[#2E9E6B] flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Import Prescription</h3>
              <p className="text-[11px] text-slate-500">Camera, Gallery, PDF, or HEIC photo</p>
            </div>
          </div>
          <button
            onClick={handleModalClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* IFRAME FALLBACK BANNER */}
        {isInIframe && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-2xl text-[11px] text-blue-900 flex items-center justify-between gap-2">
            <div>
              <span className="font-bold block">Preview Environment Detected</span>
              <span>For direct device camera & file access, open PillSync in a clean browser tab.</span>
            </div>
            <button
              onClick={() => window.open(window.location.href, '_blank')}
              className="px-2.5 py-1.5 bg-[#1E88E5] text-white font-bold rounded-xl text-[10px] shrink-0 flex items-center gap-1 shadow-xs hover:bg-blue-700"
            >
              <span>Open in new tab</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* ERROR BANNER */}
        {errorMessage && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block">Import Error</span>
              <span className="leading-relaxed">{errorMessage}</span>

              {overLimitFile && (
                <button
                  onClick={handleCompressAndProceed}
                  className="mt-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs shadow-xs flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Compress Automatically (Recommended)</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* PROCESSING INDICATOR */}
        {isProcessing && (
          <div className="my-6 flex flex-col items-center justify-center py-4">
            <RefreshCw className="w-8 h-8 text-[#1E88E5] animate-spin mb-2" />
            <span className="text-xs font-bold text-slate-800">Processing prescription...</span>
            <span className="text-[11px] text-slate-500">Decoding image format & quality checks</span>
          </div>
        )}

        {!isProcessing && (
          <div className="mt-4 space-y-3">
            {/* LIVE WEBCAM VIEWFINDER (IF ACTIVE) */}
            {showLiveWebcam ? (
              <div className="space-y-3">
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-3/4 flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-4 z-20">
                    <button
                      onClick={handleSnapWebcam}
                      className="w-16 h-16 rounded-full bg-white border-4 border-[#2E9E6B] shadow-xl flex items-center justify-center active:scale-95 transition-transform"
                    >
                      <div className="w-12 h-12 rounded-full bg-[#2E9E6B]" />
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <button
                    onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
                    className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold"
                  >
                    Switch Camera
                  </button>
                  <button
                    onClick={closeWebcam}
                    className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold"
                  >
                    Close Viewfinder
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* 1. PRIMARY ACCESSIBLE BUTTON CONTROLS (CAMERA + GALLERY) */}
                <div className="grid grid-cols-2 gap-2.5">
                  {/* REAL CAMERA INPUT (capture="environment") */}
                  <label
                    htmlFor="camera-capture-input"
                    className="relative h-20 bg-[#2E9E6B] hover:bg-emerald-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow-md flex flex-col items-center justify-center gap-1 cursor-pointer overflow-hidden transition-all text-center p-2"
                  >
                    <input
                      id="camera-capture-input"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      onChange={handleCameraChange}
                    />
                    <Camera className="w-6 h-6 text-white" />
                    <span className="text-xs">Take Photo</span>
                    <span className="text-[10px] text-emerald-100 font-normal">Rear camera</span>
                  </label>

                  {/* REAL GALLERY INPUT (image/*, .heic, .heif, .pdf) */}
                  <label
                    htmlFor="gallery-input"
                    className="relative h-20 bg-white border-2 border-slate-300 hover:border-[#1E88E5] active:scale-[0.98] text-slate-800 font-bold rounded-2xl shadow-xs flex flex-col items-center justify-center gap-1 cursor-pointer overflow-hidden transition-all text-center p-2"
                  >
                    <input
                      id="gallery-input"
                      type="file"
                      accept="image/*,.heic,.heif,.pdf"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      onChange={handleGalleryChange}
                    />
                    <Upload className="w-6 h-6 text-[#1E88E5]" />
                    <span className="text-xs">Choose File</span>
                    <span className="text-[10px] text-slate-500 font-normal">JPG, PNG, HEIC, PDF</span>
                  </label>
                </div>

                {/* 2. DESKTOP DRAG & DROP ZONE */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`p-6 rounded-2xl border-2 border-dashed transition-all text-center ${
                    isDragging
                      ? 'border-[#1E88E5] bg-blue-50/80 scale-[1.01]'
                      : 'border-slate-300 bg-slate-50 hover:bg-slate-100/70'
                  }`}
                >
                  <FileText className="w-8 h-8 text-slate-400 mx-auto mb-1.5" />
                  <span className="text-xs font-bold text-slate-800 block">
                    {isDragging ? 'Drop prescription file here' : 'Or drag & drop prescription file here'}
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Supports JPG, PNG, WEBP, Apple HEIC, and PDF (Page 1) • Max 10 MB
                  </span>
                </div>

                {/* 3. OPTIONAL LIVE WEBCAM TOGGLE */}
                <button
                  type="button"
                  onClick={() => setShowLiveWebcam(true)}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Video className="w-4 h-4 text-slate-600" />
                  <span>Open Live Webcam Viewfinder</span>
                </button>

                {/* 4. OFFLINE MANUAL ENTRY FALLBACK */}
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenManualEntry();
                    }}
                    className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100/80 text-[#2E9E6B] border border-emerald-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Medicine Manually (Offline Ready)</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
