const express = require('express');
const router = express.Router();
const multer = require('multer');
const materialController = require('../controllers/material.controller');
const authMiddleware = require('../middleware/auth');
const { requireApprovedTeacher } = require('../middleware/rbac');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  }
});

// All routes require authentication and approved teacher status
router.use(authMiddleware);
router.use(requireApprovedTeacher);

// Material routes
router.post('/', upload.single('file'), materialController.createMaterial);
router.get('/', materialController.getMaterials);
router.get('/:id', materialController.getMaterialById);
router.put('/:id', upload.single('file'), materialController.updateMaterial);
router.delete('/:id', materialController.deleteMaterial);
router.post('/:id/publish', materialController.publishMaterial);
router.get('/:id/download', materialController.getDownloadUrl);
router.post('/reorder', materialController.reorderMaterials);

module.exports = router;
