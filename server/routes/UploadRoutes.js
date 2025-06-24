
import express from 'express';
import upload, { allowedFileTypes } from '../middleware/upload.js';
import cloudinary from '../config/cloudinary.js';
import path from 'path';

const router = express.Router();

// Get allowed file types endpoint
router.get('/allowed-types', (req, res) => {
  res.json({
    success: true,
    data: {
      allowedExtensions: Object.keys(allowedFileTypes),
      allowedFileTypes,
    },
  });
});

// Single file upload with validation
router.post('/upload', (req, res) => {
  console.log('📁 Upload request received');
  
  // Check if Cloudinary is properly configured
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  console.log('🔧 Cloudinary cloud name:', cloudName ? 'configured' : 'missing');
  
  if (!cloudName || cloudName.includes('your_') || cloudName === 'root') {
    console.log('❌ Cloudinary not configured properly');
    return res.status(500).json({
      success: false,
      message: 'File upload service is not configured. Please contact administrator.',
      error: 'CLOUDINARY_NOT_CONFIGURED',
    });
  }

  upload.single('file')(req, res, (err) => {
    if (err) {
      console.log('❌ Upload middleware error:', err.message);
      console.log('❌ Full error:', err);
      
      // Check if it's a Cloudinary-specific error
      if (err.message && err.message.includes('cloud_name')) {
        return res.status(500).json({
          success: false,
          message: 'File upload service configuration error. Please contact administrator.',
          error: 'CLOUDINARY_CONFIG_ERROR',
        });
      }
      
      return res.status(400).json({
        success: false,
        message: err.message,
        error: 'FILE_UPLOAD_ERROR',
      });
    }

    if (!req.file) {
      console.log('❌ No file in request');
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
        error: 'NO_FILE_ERROR',
      });
    }

    console.log('✅ File received:', {
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      path: req.file.path
    });

    // Validate file extension matches between frontend and backend
    const backendExtension = req.fileExtension;
    const frontendExtension = path.extname(req.file.originalname).toLowerCase();
    
    console.log('🔍 Extension validation:', { backendExtension, frontendExtension });
    
    if (backendExtension !== frontendExtension) {
      console.log('❌ Extension mismatch');
      return res.status(400).json({
        success: false,
        message: `File extension mismatch: frontend sent ${frontendExtension}, backend detected ${backendExtension}`,
        error: 'EXTENSION_MISMATCH_ERROR',
      });
    }

    console.log('✅ Upload successful, sending response');
    res.json({
      success: true,
      data: {
        fileUrl: req.file.path,
        fileType: req.file.mimetype,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileExtension: backendExtension,
        cloudinaryPublicId: req.file.public_id,
      },
    });
  });
});

// Multiple files upload with validation
router.post('/upload-multiple', (req, res) => {
  // Check if Cloudinary is properly configured
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName || cloudName.includes('your_') || cloudName === 'root') {
    return res.status(500).json({
      success: false,
      message: 'File upload service is not configured. Please contact administrator.',
      error: 'CLOUDINARY_NOT_CONFIGURED',
    });
  }

  upload.array('files', 10)(req, res, (err) => {
    if (err) {
      // Check if it's a Cloudinary-specific error
      if (err.message && err.message.includes('cloud_name')) {
        return res.status(500).json({
          success: false,
          message: 'File upload service configuration error. Please contact administrator.',
          error: 'CLOUDINARY_CONFIG_ERROR',
        });
      }
      
      return res.status(400).json({
        success: false,
        message: err.message,
        error: 'FILE_UPLOAD_ERROR',
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded',
        error: 'NO_FILES_ERROR',
      });
    }

    // Validate each file
    const uploadedFiles = req.files.map((file, index) => {
      const backendExtension = path.extname(file.originalname).toLowerCase();
      const frontendExtension = path.extname(file.originalname).toLowerCase();
      
      return {
        fileUrl: file.path,
        fileType: file.mimetype,
        fileName: file.originalname,
        fileSize: file.size,
        fileExtension: backendExtension,
        cloudinaryPublicId: file.public_id,
        index,
      };
    });

    res.json({
      success: true,
      data: {
        files: uploadedFiles,
        totalFiles: uploadedFiles.length,
      },
    });
  });
});

// Delete file from Cloudinary
router.delete('/delete', async (req, res) => {
  try {
    const { fileUrl, publicId } = req.body;
    
    if (!fileUrl && !publicId) {
      return res.status(400).json({
        success: false,
        message: 'File URL or public ID is required',
        error: 'MISSING_IDENTIFIER_ERROR',
      });
    }

    // Extract public ID from URL if not provided
    let cloudinaryPublicId = publicId;
    if (!cloudinaryPublicId && fileUrl) {
      const urlParts = fileUrl.split('/');
      const fileNameWithExt = urlParts[urlParts.length - 1];
      cloudinaryPublicId = `lms_uploads/${fileNameWithExt.split('.')[0]}`;
    }

    // Delete from Cloudinary
    const result = await cloudinary.uploader.destroy(cloudinaryPublicId);
    
    if (result.result === 'ok') {
      res.json({
        success: true,
        message: 'File deleted successfully',
        data: { publicId: cloudinaryPublicId },
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to delete file',
        error: 'DELETE_FAILED_ERROR',
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting file',
      error: 'DELETE_ERROR',
      details: error.message,
    });
  }
});

export default router;
