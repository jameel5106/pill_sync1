// File & Photo Import Engine for PillSync
// Supports JPG, PNG, WEBP, HEIC/HEIF, and PDF (Page 1 via pdf.js)
import heic2any from 'heic2any';
import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker
try {
  // Use official CDN worker matching installed pdfjs-dist version
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
} catch (e) {
  console.warn('[PDF.js] Worker setup fallback:', e);
}

export interface FileProcessingResult {
  success: boolean;
  base64?: string;
  blob?: Blob;
  fileName: string;
  fileSize: number;
  originalFormat: string;
  errorMessage?: string;
  isOverLimit?: boolean;
}

export class FileImportService {
  private readonly MAX_BYTES = 10 * 1024 * 1024; // 10 MB

  /**
   * Process any uploaded prescription file (Image, HEIC, or PDF)
   */
  async processFile(file: File | Blob, originalName?: string): Promise<FileProcessingResult> {
    const fileName = (file as File).name || originalName || 'prescription_upload';
    const fileSize = file.size;
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    const mimeType = file.type.toLowerCase();

    // 1. Check if file is empty
    if (!file || fileSize === 0) {
      return {
        success: false,
        fileName,
        fileSize: 0,
        originalFormat: 'unknown',
        errorMessage: 'No file was chosen. Please select an image or document.',
      };
    }

    // 2. Check 10 MB limit
    if (fileSize > this.MAX_BYTES) {
      return {
        success: false,
        fileName,
        fileSize,
        originalFormat: extension || mimeType,
        isOverLimit: true,
        errorMessage: `File size is ${(fileSize / (1024 * 1024)).toFixed(1)} MB, which exceeds the 10 MB limit. PillSync can automatically compress this for you.`,
      };
    }

    // 3. Handle PDF documents (render page 1)
    if (mimeType === 'application/pdf' || extension === 'pdf') {
      try {
        const base64 = await this.renderPdfPageOne(file);
        return {
          success: true,
          base64,
          fileName,
          fileSize,
          originalFormat: 'pdf',
        };
      } catch (err: any) {
        console.error('[PDF Render Error]', err);
        return {
          success: false,
          fileName,
          fileSize,
          originalFormat: 'pdf',
          errorMessage: 'Failed to read PDF document. Please make sure the PDF is not password-protected or upload a photo instead.',
        };
      }
    }

    // 4. Handle Apple HEIC/HEIF images
    if (
      mimeType.includes('heic') ||
      mimeType.includes('heif') ||
      extension === 'heic' ||
      extension === 'heif'
    ) {
      try {
        const conversionResult = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.92,
        });

        const jpegBlob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
        const base64 = await this.blobToBase64(jpegBlob);

        return {
          success: true,
          base64,
          blob: jpegBlob,
          fileName: fileName.replace(/\.heic|\.heif/i, '.jpg'),
          fileSize: jpegBlob.size,
          originalFormat: 'heic',
        };
      } catch (err) {
        console.error('[HEIC Conversion Error]', err);
        return {
          success: false,
          fileName,
          fileSize,
          originalFormat: 'heic',
          errorMessage: "This photo format isn't supported. Please share it as JPG or take a new photo.",
        };
      }
    }

    // 5. Standard images (JPEG, PNG, WEBP)
    if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(extension)) {
      try {
        const base64 = await this.blobToBase64(file);
        return {
          success: true,
          base64,
          blob: file,
          fileName,
          fileSize,
          originalFormat: extension || mimeType,
        };
      } catch (err: any) {
        return {
          success: false,
          fileName,
          fileSize,
          originalFormat: extension || mimeType,
          errorMessage: `Failed to load image: ${err?.message || 'Unsupported image data'}`,
        };
      }
    }

    // 6. Unsupported type
    return {
      success: false,
      fileName,
      fileSize,
      originalFormat: extension || mimeType,
      errorMessage: `Unsupported file type (.${extension || 'file'}). PillSync accepts JPG, PNG, WEBP, HEIC, and PDF prescriptions.`,
    };
  }

  /**
   * Automatic compression for files > 10MB
   */
  async compressImage(file: File | Blob, maxDimension = 1600, targetQuality = 0.8): Promise<FileProcessingResult> {
    try {
      // First convert to base64 or blob
      let workingBlob = file;
      const extension = (file as File).name?.split('.').pop()?.toLowerCase() || '';
      if (file.type.includes('heic') || extension === 'heic') {
        const conv = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
        workingBlob = Array.isArray(conv) ? conv[0] : conv;
      }

      const base64Url = await this.blobToBase64(workingBlob);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = base64Url;
      });

      let width = img.width;
      let height = img.height;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const compressedBase64 = canvas.toDataURL('image/jpeg', targetQuality);
      return {
        success: true,
        base64: compressedBase64,
        fileName: 'compressed_prescription.jpg',
        fileSize: Math.round((compressedBase64.length * 3) / 4),
        originalFormat: 'compressed_jpeg',
      };
    } catch (err: any) {
      return {
        success: false,
        fileName: 'upload',
        fileSize: 0,
        originalFormat: 'unknown',
        errorMessage: `Automatic compression failed: ${err?.message || 'Could not resize image'}. Please try taking a fresh photo.`,
      };
    }
  }

  /**
   * Render Page 1 of a PDF onto HTML5 canvas and return high-res image
   */
  private async renderPdfPageOne(file: File | Blob): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      useSystemFonts: true,
      stopAtErrors: false,
    });

    const pdfDocument = await loadingTask.promise;
    const page = await pdfDocument.getPage(1);

    // Render at scale 2.0 for crisp medical OCR
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const canvasContext = canvas.getContext('2d');
    if (!canvasContext) throw new Error('Canvas 2D context unavailable');

    canvasContext.fillStyle = '#FFFFFF';
    canvasContext.fillRect(0, 0, canvas.width, canvas.height);

    await (page.render as any)({
      canvasContext,
      viewport,
      canvas,
    }).promise;

    return canvas.toDataURL('image/jpeg', 0.92);
  }

  /**
   * Convert Blob or File to dataURL base64 string
   */
  blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Check for incoming file from Web Share Target (e.g. shared from WhatsApp / Gallery)
   */
  async checkSharedPrescription(): Promise<File | null> {
    if (!('caches' in window)) return null;
    try {
      const cache = await caches.open('pillsync-shared-files');
      const response = await cache.match('/shared-prescription');
      if (response) {
        const blob = await response.blob();
        const filename = response.headers.get('x-filename') || 'shared_prescription.jpg';
        // Remove from cache once retrieved
        await cache.delete('/shared-prescription');
        return new File([blob], filename, { type: blob.type || 'image/jpeg' });
      }
    } catch (e) {
      console.warn('[Web Share Target] Check failed:', e);
    }
    return null;
  }
}

export const fileImportService = new FileImportService();
