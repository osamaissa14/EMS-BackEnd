import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';
import path from 'path';

// Allowed file extensions and their corresponding MIME types
const allowedFileTypes = {
  // Images
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  '.svg': ['image/svg+xml'],
  
  // Videos
  '.mp4': ['video/mp4'],
  '.avi': ['video/x-msvideo'],
  '.mov': ['video/quicktime'],
  '.wmv': ['video/x-ms-wmv'],
  '.webm': ['video/webm'],
  
  // Documents
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.ppt': ['application/vnd.ms-powerpoint'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  '.txt': ['text/plain'],
  
  // Audio
  '.mp3': ['audio/mpeg'],
  '.wav': ['audio/wav'],
  '.ogg': ['audio/ogg'],
  
  // Archives
  '.zip': ['application/zip'],
  '.rar': ['application/vnd.rar'],
  '.7z': ['application/x-7z-compressed'],
};

// File filter function to validate file types
const fileFilter = (req, file, cb) => {
  try {
    // Get file extension from original filename
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype.toLowerCase();
    
    // Check if extension is allowed
    if (!allowedFileTypes[fileExtension]) {
      return cb(new Error(`File extension ${fileExtension} is not allowed`), false);
    }
    
    // Check if MIME type matches the extension
    const allowedMimeTypes = allowedFileTypes[fileExtension];
    if (!allowedMimeTypes.includes(mimeType)) {
      return cb(new Error(`File MIME type ${mimeType} does not match extension ${fileExtension}`), false);
    }
    
    // Add extension to request for backend validation
    req.fileExtension = fileExtension;
    req.fileMimeType = mimeType;
    
    cb(null, true);
  } catch (error) {
    cb(new Error('Error validating file type'), false);
  }
};

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'lms_uploads',
    resource_type: 'auto', // supports video, image, raw files
    public_id: (req, file) => {
      // Generate unique filename with original extension
      const extension = path.extname(file.originalname);
      const name = path.basename(file.originalname, extension);
      return `${name}_${Date.now()}`;
    },
  },
});

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit to match Cloudinary video limit
  },
});

// Export both upload middleware and allowed file types for validation
export default upload;
export { allowedFileTypes };
