const Slide = require('../models/Slide');
const AuditLog = require('../models/AuditLog');

// Create new slide presentation
exports.createSlide = async (req, res) => {
  try {
    const { title, description, courseId, slides, tags } = req.body;

    const slide = await Slide.create({
      teacherId: req.user._id,
      title,
      description,
      courseId,
      slides: slides || [],
      tags: tags || [],
      status: 'draft'
    });

    await AuditLog.log({
      userId: req.user._id,
      action: 'CREATE_SLIDE',
      metadata: { slideId: slide._id, title }
    });

    res.status(201).json({
      success: true,
      data: slide
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all slides by teacher
exports.getSlides = async (req, res) => {
  try {
    const { status, courseId, page = 1, limit = 20 } = req.query;
    
    const query = { teacherId: req.user._id };
    if (status) query.status = status;
    if (courseId) query.courseId = courseId;

    const slides = await Slide.find(query)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('courseId', 'title');

    const total = await Slide.countDocuments(query);

    res.json({
      success: true,
      data: slides,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get single slide by ID
exports.getSlideById = async (req, res) => {
  try {
    const slide = await Slide.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    }).populate('courseId', 'title');

    if (!slide) {
      return res.status(404).json({
        success: false,
        message: 'Slide not found'
      });
    }

    res.json({
      success: true,
      data: slide
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update slide
exports.updateSlide = async (req, res) => {
  try {
    const { title, description, slides, status, tags, thumbnail } = req.body;

    const slide = await Slide.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!slide) {
      return res.status(404).json({
        success: false,
        message: 'Slide not found'
      });
    }

    if (title) slide.title = title;
    if (description !== undefined) slide.description = description;
    if (slides) slide.slides = slides;
    if (status) slide.status = status;
    if (tags) slide.tags = tags;
    if (thumbnail) slide.thumbnail = thumbnail;

    await slide.save();

    await AuditLog.log({
      userId: req.user._id,
      action: 'UPDATE_SLIDE',
      metadata: { slideId: slide._id, title: slide.title }
    });

    res.json({
      success: true,
      data: slide
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete slide
exports.deleteSlide = async (req, res) => {
  try {
    const slide = await Slide.findOneAndDelete({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!slide) {
      return res.status(404).json({
        success: false,
        message: 'Slide not found'
      });
    }

    await AuditLog.log({
      userId: req.user._id,
      action: 'DELETE_SLIDE',
      metadata: { slideId: slide._id, title: slide.title }
    });

    res.json({
      success: true,
      message: 'Slide deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Publish slide
exports.publishSlide = async (req, res) => {
  try {
    const slide = await Slide.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!slide) {
      return res.status(404).json({
        success: false,
        message: 'Slide not found'
      });
    }

    slide.status = 'published';
    await slide.save();

    await AuditLog.log({
      userId: req.user._id,
      action: 'PUBLISH_SLIDE',
      metadata: { slideId: slide._id, title: slide.title }
    });

    res.json({
      success: true,
      data: slide
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Duplicate slide
exports.duplicateSlide = async (req, res) => {
  try {
    const originalSlide = await Slide.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!originalSlide) {
      return res.status(404).json({
        success: false,
        message: 'Slide not found'
      });
    }

    const duplicatedSlide = await Slide.create({
      teacherId: req.user._id,
      title: `${originalSlide.title} (Copy)`,
      description: originalSlide.description,
      courseId: originalSlide.courseId,
      slides: originalSlide.slides,
      tags: originalSlide.tags,
      status: 'draft'
    });

    res.status(201).json({
      success: true,
      data: duplicatedSlide
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
