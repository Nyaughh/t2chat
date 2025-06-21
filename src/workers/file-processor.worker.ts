// Web Worker for file processing, image optimization, and document parsing
// Handles heavy file operations without blocking the UI

// Types for file processing
interface ProcessImageRequest {
  type: 'PROCESS_IMAGE';
  payload: {
    id: string;
    file: File;
    options: {
      maxWidth?: number;
      maxHeight?: number;
      quality?: number;
      format?: 'jpeg' | 'png' | 'webp';
    };
  };
}

interface ExtractTextRequest {
  type: 'EXTRACT_TEXT';
  payload: {
    id: string;
    file: File;
    type: 'pdf' | 'txt' | 'md';
  };
}

interface GeneratePreviewRequest {
  type: 'GENERATE_PREVIEW';
  payload: {
    id: string;
    file: File;
  };
}

interface CompressFileRequest {
  type: 'COMPRESS_FILE';
  payload: {
    id: string;
    file: File;
    compressionLevel?: number;
  };
}

interface ValidateFileRequest {
  type: 'VALIDATE_FILE';
  payload: {
    id: string;
    file: File;
    constraints: {
      maxSize?: number;
      allowedTypes?: string[];
      maxDimensions?: { width: number; height: number };
    };
  };
}

type FileWorkerRequest = 
  | ProcessImageRequest 
  | ExtractTextRequest 
  | GeneratePreviewRequest
  | CompressFileRequest
  | ValidateFileRequest;

// File processing utilities
const MAX_CANVAS_SIZE = 4096;
const DEFAULT_IMAGE_QUALITY = 0.8;

// Listen for messages from main thread
self.addEventListener('message', async (event: MessageEvent<FileWorkerRequest>) => {
  const { type, payload } = event.data;

  try {
    switch (type) {
      case 'PROCESS_IMAGE':
        await handleProcessImage(payload);
        break;
        
      case 'EXTRACT_TEXT':
        await handleExtractText(payload);
        break;
        
      case 'GENERATE_PREVIEW':
        await handleGeneratePreview(payload);
        break;
        
      case 'COMPRESS_FILE':
        await handleCompressFile(payload);
        break;
        
      case 'VALIDATE_FILE':
        await handleValidateFile(payload);
        break;
        
      default:
        console.warn('[FileWorker] Unknown message type:', type);
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      payload: {
        id: (payload as any).id,
        error: error instanceof Error ? error.message : 'Unknown error',
        originalType: type
      }
    });
  }
});

// Process and optimize images
async function handleProcessImage(payload: ProcessImageRequest['payload']) {
  const { id, file, options } = payload;
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = DEFAULT_IMAGE_QUALITY,
    format = 'jpeg'
  } = options;

  try {
    // Create image bitmap for processing
    const imageBitmap = await createImageBitmap(file);
    const { width: originalWidth, height: originalHeight } = imageBitmap;

    // Calculate new dimensions while maintaining aspect ratio
    const { width: newWidth, height: newHeight } = calculateDimensions(
      originalWidth,
      originalHeight,
      maxWidth,
      maxHeight
    );

    // Create canvas for image processing
    const canvas = new OffscreenCanvas(newWidth, newHeight);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Draw and resize image
    ctx.drawImage(imageBitmap, 0, 0, newWidth, newHeight);

    // Convert to blob with specified format and quality
    const mimeType = `image/${format}`;
    const blob = await canvas.convertToBlob({
      type: mimeType,
      quality: format === 'jpeg' ? quality : undefined
    });

    // Calculate compression ratio
    const compressionRatio = ((file.size - blob.size) / file.size) * 100;

    // Create optimized file
    const optimizedFile = new File([blob], file.name, {
      type: mimeType,
      lastModified: Date.now()
    });

    self.postMessage({
      type: 'IMAGE_PROCESSED',
      payload: {
        id,
        originalFile: {
          name: file.name,
          size: file.size,
          dimensions: { width: originalWidth, height: originalHeight }
        },
        optimizedFile: {
          name: optimizedFile.name,
          size: optimizedFile.size,
          dimensions: { width: newWidth, height: newHeight },
          blob: optimizedFile
        },
        compressionRatio,
        format
      }
    });

    // Clean up
    imageBitmap.close();
  } catch (error) {
    throw new Error(`Image processing failed: ${error instanceof Error ? error.message : error}`);
  }
}

// Extract text from various file types
async function handleExtractText(payload: ExtractTextRequest['payload']) {
  const { id, file, type } = payload;

  try {
    let extractedText = '';
    
    switch (type) {
      case 'txt':
      case 'md':
        extractedText = await file.text();
        break;
        
      case 'pdf':
        extractedText = await extractPdfText(file);
        break;
        
      default:
        throw new Error(`Unsupported file type: ${type}`);
    }

    // Process extracted text
    const metadata = {
      wordCount: extractedText.split(/\s+/).filter(word => word.length > 0).length,
      charCount: extractedText.length,
      lineCount: extractedText.split('\n').length,
      language: detectLanguage(extractedText),
      hasCodeBlocks: /```[\s\S]*?```/.test(extractedText)
    };

    self.postMessage({
      type: 'TEXT_EXTRACTED',
      payload: {
        id,
        text: extractedText,
        metadata,
        fileName: file.name,
        fileSize: file.size
      }
    });
  } catch (error) {
    throw new Error(`Text extraction failed: ${error instanceof Error ? error.message : error}`);
  }
}

// Generate file previews
async function handleGeneratePreview(payload: GeneratePreviewRequest['payload']) {
  const { id, file } = payload;

  try {
    let preview: any = null;
    
    if (file.type.startsWith('image/')) {
      preview = await generateImagePreview(file);
    } else if (file.type === 'application/pdf') {
      preview = await generatePdfPreview(file);
    } else if (file.type.startsWith('text/')) {
      preview = await generateTextPreview(file);
    }

    self.postMessage({
      type: 'PREVIEW_GENERATED',
      payload: {
        id,
        preview,
        fileType: file.type,
        fileName: file.name
      }
    });
  } catch (error) {
    throw new Error(`Preview generation failed: ${error instanceof Error ? error.message : error}`);
  }
}

// Compress files
async function handleCompressFile(payload: CompressFileRequest['payload']) {
  const { id, file, compressionLevel = 6 } = payload;

  try {
    // For now, we'll focus on image compression
    // Other file types could use different compression algorithms
    
    if (file.type.startsWith('image/')) {
      // Use image processing with lower quality for compression
      await handleProcessImage({
        id,
        file,
        options: {
          quality: Math.max(0.1, 1 - (compressionLevel / 10)),
          format: 'jpeg'
        }
      });
      return;
    }

    // For non-image files, return original (could implement zip compression here)
    self.postMessage({
      type: 'FILE_COMPRESSED',
      payload: {
        id,
        originalSize: file.size,
        compressedSize: file.size,
        compressionRatio: 0,
        compressedFile: file
      }
    });
  } catch (error) {
    throw new Error(`File compression failed: ${error instanceof Error ? error.message : error}`);
  }
}

// Validate files against constraints
async function handleValidateFile(payload: ValidateFileRequest['payload']) {
  const { id, file, constraints } = payload;
  const { maxSize, allowedTypes, maxDimensions } = constraints;

  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Check file size
    if (maxSize && file.size > maxSize) {
      errors.push(`File size (${formatBytes(file.size)}) exceeds maximum allowed size (${formatBytes(maxSize)})`);
    }

    // Check file type
    if (allowedTypes && !allowedTypes.some(type => file.type.startsWith(type))) {
      errors.push(`File type (${file.type}) is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }

    // Check image dimensions if applicable
    if (file.type.startsWith('image/') && maxDimensions) {
      const imageBitmap = await createImageBitmap(file);
      const { width, height } = imageBitmap;
      
      if (width > maxDimensions.width || height > maxDimensions.height) {
        warnings.push(`Image dimensions (${width}x${height}) exceed recommended size (${maxDimensions.width}x${maxDimensions.height})`);
      }
      
      imageBitmap.close();
    }

    // Check for potential security issues
    if (file.name.includes('..') || file.name.includes('/')) {
      errors.push('File name contains invalid characters');
    }

    self.postMessage({
      type: 'FILE_VALIDATED',
      payload: {
        id,
        isValid: errors.length === 0,
        errors,
        warnings,
        fileInfo: {
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified
        }
      }
    });
  } catch (error) {
    throw new Error(`File validation failed: ${error instanceof Error ? error.message : error}`);
  }
}

// Helper functions

function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  const aspectRatio = originalWidth / originalHeight;
  
  let newWidth = originalWidth;
  let newHeight = originalHeight;
  
  // Scale down if necessary
  if (newWidth > maxWidth) {
    newWidth = maxWidth;
    newHeight = newWidth / aspectRatio;
  }
  
  if (newHeight > maxHeight) {
    newHeight = maxHeight;
    newWidth = newHeight * aspectRatio;
  }
  
  // Ensure dimensions don't exceed canvas limits
  newWidth = Math.min(newWidth, MAX_CANVAS_SIZE);
  newHeight = Math.min(newHeight, MAX_CANVAS_SIZE);
  
  return {
    width: Math.floor(newWidth),
    height: Math.floor(newHeight)
  };
}

async function extractPdfText(file: File): Promise<string> {
  // This is a placeholder - in a real implementation, you'd use a PDF parsing library
  // like PDF.js or similar that works in a worker context
  
  try {
    // For now, return basic info about the PDF
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Basic PDF header check
    const header = new TextDecoder().decode(uint8Array.slice(0, 8));
    if (!header.startsWith('%PDF-')) {
      throw new Error('Invalid PDF file');
    }
    
    // Extract any plaintext content (very basic approach)
    const fullText = new TextDecoder('latin1').decode(uint8Array);
    const textMatches = fullText.match(/\(([^)]+)\)/g) || [];
    const extractedText = textMatches
      .map(match => match.slice(1, -1))
      .filter(text => text.length > 3)
      .join(' ');
    
    return extractedText || 'PDF content could not be extracted (binary file)';
  } catch (error) {
    throw new Error(`PDF parsing error: ${error instanceof Error ? error.message : error}`);
  }
}

async function generateImagePreview(file: File): Promise<{ dataUrl: string; dimensions: { width: number; height: number } }> {
  const imageBitmap = await createImageBitmap(file);
  const { width, height } = imageBitmap;
  
  // Generate thumbnail
  const thumbnailSize = 200;
  const { width: thumbWidth, height: thumbHeight } = calculateDimensions(
    width, height, thumbnailSize, thumbnailSize
  );
  
  const canvas = new OffscreenCanvas(thumbWidth, thumbHeight);
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Could not get canvas context for preview');
  }
  
  ctx.drawImage(imageBitmap, 0, 0, thumbWidth, thumbHeight);
  
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
  const dataUrl = await blobToDataUrl(blob);
  
  imageBitmap.close();
  
  return {
    dataUrl,
    dimensions: { width, height }
  };
}

async function generatePdfPreview(file: File): Promise<{ info: string; size: string }> {
  return {
    info: 'PDF Document',
    size: formatBytes(file.size)
  };
}

async function generateTextPreview(file: File): Promise<{ preview: string; wordCount: number }> {
  const text = await file.text();
  const preview = text.slice(0, 500) + (text.length > 500 ? '...' : '');
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
  
  return { preview, wordCount };
}

function detectLanguage(text: string): string {
  // Basic language detection - could be enhanced with proper language detection
  const sample = text.slice(0, 1000).toLowerCase();
  
  if (/function|const|let|var|class|import|export/.test(sample)) {
    return 'javascript';
  }
  if (/def |import |from |class |if __name__/.test(sample)) {
    return 'python';
  }
  if (/public|private|class|interface|extends/.test(sample)) {
    return 'java';
  }
  if (/#include|int main|std::|namespace/.test(sample)) {
    return 'cpp';
  }
  
  return 'unknown';
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Worker initialization
self.postMessage({
  type: 'WORKER_READY',
  payload: {
    message: 'File processor worker initialized'
  }
});

// Export types for TypeScript support
export type {
  ProcessImageRequest,
  ExtractTextRequest,
  GeneratePreviewRequest,
  CompressFileRequest,
  ValidateFileRequest,
  FileWorkerRequest
}; 