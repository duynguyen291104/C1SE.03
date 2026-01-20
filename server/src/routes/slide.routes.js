const express = require('express');
const router = express.Router();
const slideController = require('../controllers/slide.controller');
const authMiddleware = require('../middleware/auth');
const { requireApprovedTeacher } = require('../middleware/rbac');

// All routes require authentication and approved teacher status
router.use(authMiddleware);
router.use(requireApprovedTeacher);

// Slide routes
router.post('/', slideController.createSlide);
router.get('/', slideController.getSlides);
router.get('/:id', slideController.getSlideById);
router.put('/:id', slideController.updateSlide);
router.delete('/:id', slideController.deleteSlide);
router.post('/:id/publish', slideController.publishSlide);
router.post('/:id/duplicate', slideController.duplicateSlide);

module.exports = router;
