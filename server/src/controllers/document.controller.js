const Document = require('../models/Document');
const DocumentPage = require('../models/DocumentPage');
const AuditLog = require('../models/AuditLog');
const minioService = require('../services/minio');
const { addExtractionJob, getJobProgress, removeJob } = require('../queues/documentExtract.queue');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// File type validation
const ALLOWED_MIME_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx'
};

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

/**
 * Upload document
 */
exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { originalname, mimetype, size, path: tempPath } = req.file;

    // Validate file size
    if (size > MAX_FILE_SIZE) {
      fs.unlinkSync(tempPath); // Clean up
      return res.status(413).json({ error: 'File too large. Maximum size is 20MB' });
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES[mimetype]) {
      fs.unlinkSync(tempPath);
      return res.status(400).json({ 
        error: 'Invalid file type. Only PDF, DOCX, and PPTX are allowed' 
      });
    }

    const fileExtension = ALLOWED_MIME_TYPES[mimetype];

    // Create document in database
    const document = await Document.create({
      ownerId: req.user._id,
      originalName: originalname,
      mimeType: mimetype,
      sizeBytes: size,
      storage: {
        bucket: 'edu-docs',
        objectKey: '' // Will be set after upload
      },
      status: 'uploaded'
    });

    // Generate object key
    const objectKey = `users/${req.user._id}/documents/${document._id}/original.${fileExtension}`;
    
    // Upload to MinIO
    await minioService.uploadObject(tempPath, objectKey, mimetype);
    
    // Update document with object key
    document.storage.objectKey = objectKey;
    await document.save();

    // Clean up temp file
    fs.unlinkSync(tempPath);

    // Enqueue extraction job
    await addExtractionJob({
      documentId: document._id.toString(),
      ownerId: req.user._id.toString(),
      bucket: document.storage.bucket,
      objectKey: document.storage.objectKey,
      mimeType: mimetype
    });

    // Audit log
    await AuditLog.log({
      userId: req.user._id,
      action: 'DOCUMENT_UPLOADED',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        documentId: document._id,
        fileName: originalname,
        size: size
      }
    });

    res.status(201).json({
      message: 'Document uploaded successfully',
      documentId: document._id,
      status: document.status,
      enqueued: true
    });
  } catch (error) {
    console.error('Upload error:', error);
    
    // Clean up temp file if exists
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: error.message });
  }
};

/**
 * List documents (my documents or all for admin)
 */
exports.listDocuments = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const isAdmin = req.user.roles.includes('admin');

    const filter = {};
    
    // Teachers see only their documents, admins see all
    if (!isAdmin) {
      filter.ownerId = req.user._id;
    }
    
    if (status) {
      filter.status = status;
    }

    const documents = await Document.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('ownerId', 'email profile.fullName');

    const count = await Document.countDocuments(filter);

    res.json({
      documents,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get document detail with progress
 */
exports.getDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.roles.includes('admin');

    const document = await Document.findById(id)
      .populate('ownerId', 'email profile.fullName');

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Authorization check
    if (!isAdmin && document.ownerId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get job progress if extracting
    let progress = null;
    if (document.status === 'extracting') {
      progress = await getJobProgress(id);
    }

    res.json({
      document: document.toSafeObject(),
      progress
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get document pages
 */
exports.getDocumentPages = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const isAdmin = req.user.roles.includes('admin');

    const document = await Document.findById(id);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Authorization check
    if (!isAdmin && document.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if ready
    if (document.status !== 'ready') {
      return res.status(409).json({ 
        error: 'Document not ready',
        status: document.status 
      });
    }

    const pages = await DocumentPage.getByDocument(id, { page, limit });
    const count = await DocumentPage.countDocuments({ documentId: id });

    res.json({
      pages,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get download URL
 */
exports.getDownloadUrl = async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.roles.includes('admin');

    const document = await Document.findById(id);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Authorization check
    if (!isAdmin && document.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Generate presigned URL (expires in 10 minutes)
    const url = await minioService.getPresignedUrl(document.storage.objectKey, 600);

    // Audit log
    await AuditLog.log({
      userId: req.user._id,
      action: 'DOCUMENT_DOWNLOADED',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        documentId: document._id,
        fileName: document.originalName
      }
    });

    res.json({
      url,
      expiresIn: 600,
      fileName: document.originalName
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Retry extraction
 */
exports.retryExtraction = async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.roles.includes('admin');

    const document = await Document.findById(id);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Authorization check
    if (!isAdmin && document.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete existing pages
    await DocumentPage.deleteByDocument(id);

    // Remove old job if exists
    await removeJob(id);

    // Reset document status
    document.status = 'uploaded';
    document.extract = {
      pageCount: 0,
      textPreview: '',
      error: undefined,
      startedAt: undefined,
      finishedAt: undefined
    };
    await document.save();

    // Enqueue new job
    await addExtractionJob({
      documentId: id,
      ownerId: document.ownerId.toString(),
      bucket: document.storage.bucket,
      objectKey: document.storage.objectKey,
      mimeType: document.mimeType
    });

    // Audit log
    await AuditLog.log({
      userId: req.user._id,
      action: 'DOCUMENT_RETRY_EXTRACT',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        documentId: id
      }
    });

    res.json({
      message: 'Extraction retry initiated',
      status: document.status
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete document
 */
exports.deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.roles.includes('admin');

    const document = await Document.findById(id);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Authorization check
    if (!isAdmin && document.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete from MinIO
    try {
      await minioService.deleteObject(document.storage.objectKey);
    } catch (error) {
      console.error('MinIO delete error:', error);
      // Continue with DB deletion even if MinIO fails
    }

    // Delete pages
    await DocumentPage.deleteByDocument(id);

    // Remove job if exists
    await removeJob(id);

    // Delete document
    await document.deleteOne();

    // Audit log
    await AuditLog.log({
      userId: req.user._id,
      action: 'DOCUMENT_DELETED',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        documentId: id,
        fileName: document.originalName
      }
    });

    res.json({
      message: 'Document deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
