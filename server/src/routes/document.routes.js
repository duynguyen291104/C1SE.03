const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const documentController = require('../controllers/document.controller');
const authMiddleware = require('../middleware/auth');
const { requireRole, requireApprovedTeacher } = require('../middleware/rbac');
const { apiLimiter } = require('../middleware/rateLimiter');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, '/tmp/uploads/'); // Temp storage before MinIO
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, and PPTX are allowed'));
    }
  }
});

// Apply protection and role check to all routes
router.use(authMiddleware);
router.use(requireRole(['teacher', 'admin']));

// Routes
router.post(
  '/upload',
  apiLimiter,
  upload.single('document'),
  documentController.uploadDocument
);

router.get(
  '/',
  apiLimiter,
  documentController.listDocuments
);

router.get(
  '/:id',
  apiLimiter,
  documentController.getDocument
);

router.get(
  '/:id/pages',
  apiLimiter,
  documentController.getDocumentPages
);

router.get(
  '/:id/download-url',
  apiLimiter,
  documentController.getDownloadUrl
);

router.post(
  '/:id/retry',
  apiLimiter,
  documentController.retryExtraction
);

router.delete(
  '/:id',
  apiLimiter,
  documentController.deleteDocument
);

// Error handler for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Maximum size is 20MB' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Upload one file at a time' });
    }
    return res.status(400).json({ error: error.message });
  }
  
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  
  next();
});

module.exports = router;
