const Material = require('../models/Material');
const { uploadFile, deleteFile, getPresignedDownloadUrl } = require('../services/minio');
const AuditLog = require('../models/AuditLog');

// Create new material
exports.createMaterial = async (req, res) => {
  try {
    const { 
      title, 
      description, 
      type,
      courseId,
      category,
      externalUrl,
      slideId,
      quizId,
      access,
      downloadable,
      availableFrom,
      availableUntil,
      tags
    } = req.body;

    const materialData = {
      teacherId: req.user._id,
      title,
      description,
      type,
      courseId,
      category: category || 'lecture',
      externalUrl,
      slideId,
      quizId,
      access: access || 'course-only',
      downloadable: downloadable !== undefined ? downloadable : true,
      availableFrom,
      availableUntil,
      tags: tags || [],
      status: 'draft'
    };

    // Handle file upload
    if (req.file) {
      const uploadResult = await uploadFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      materialData.file = {
        originalName: req.file.originalname,
        fileName: uploadResult.fileName,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: uploadResult.url
      };

      // For videos, set processing status
      if (type === 'video') {
        materialData.video = {
          processingStatus: 'ready'
        };
      }
    }

    const material = await Material.create(materialData);

    await AuditLog.log({
      userId: req.user._id,
      action: 'CREATE_MATERIAL',
      metadata: { 
        materialId: material._id, 
        title,
        type 
      }
    });

    res.status(201).json({
      success: true,
      data: material
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all materials by teacher
exports.getMaterials = async (req, res) => {
  try {
    const { type, status, courseId, category, page = 1, limit = 20 } = req.query;
    
    const query = { teacherId: req.user._id };
    if (type) query.type = type;
    if (status) query.status = status;
    if (courseId) query.courseId = courseId;
    if (category) query.category = category;

    const materials = await Material.find(query)
      .sort({ order: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('courseId', 'title')
      .populate('slideId', 'title')
      .populate('quizId', 'title');

    const total = await Material.countDocuments(query);

    res.json({
      success: true,
      data: materials,
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

// Get single material by ID
exports.getMaterialById = async (req, res) => {
  try {
    const material = await Material.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    })
    .populate('courseId', 'title')
    .populate('slideId', 'title slides')
    .populate('quizId', 'title questions');

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    res.json({
      success: true,
      data: material
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update material
exports.updateMaterial = async (req, res) => {
  try {
    const material = await Material.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    const updateFields = [
      'title', 'description', 'category', 'externalUrl',
      'access', 'downloadable', 'order', 'status',
      'availableFrom', 'availableUntil', 'tags', 'publishedAt'
    ];

    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        material[field] = req.body[field];
      }
    });

    // Handle new file upload
    if (req.file) {
      // Delete old file if exists
      if (material.file && material.file.fileName) {
        await deleteFile(material.file.fileName);
      }

      const uploadResult = await uploadFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      material.file = {
        originalName: req.file.originalname,
        fileName: uploadResult.fileName,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: uploadResult.url
      };
    }

    await material.save();

    await AuditLog.log({
      userId: req.user._id,
      action: 'UPDATE_MATERIAL',
      metadata: { 
        materialId: material._id, 
        title: material.title 
      }
    });

    res.json({
      success: true,
      data: material
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete material
exports.deleteMaterial = async (req, res) => {
  try {
    const material = await Material.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    // Delete file from MinIO if exists
    if (material.file && material.file.fileName) {
      await deleteFile(material.file.fileName);
    }

    await material.deleteOne();

    await AuditLog.log({
      userId: req.user._id,
      action: 'DELETE_MATERIAL',
      metadata: { 
        materialId: material._id, 
        title: material.title 
      }
    });

    res.json({
      success: true,
      message: 'Material deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Publish material
exports.publishMaterial = async (req, res) => {
  try {
    const material = await Material.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    material.status = 'published';
    material.publishedAt = new Date();
    await material.save();

    await AuditLog.log({
      userId: req.user._id,
      action: 'PUBLISH_MATERIAL',
      metadata: { 
        materialId: material._id, 
        title: material.title 
      }
    });

    res.json({
      success: true,
      data: material
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get download URL
exports.getDownloadUrl = async (req, res) => {
  try {
    const material = await Material.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    if (!material.file || !material.file.fileName) {
      return res.status(400).json({
        success: false,
        message: 'No file associated with this material'
      });
    }

    const downloadUrl = await getPresignedDownloadUrl(
      material.file.fileName,
      material.file.originalName
    );

    // Increment downloads counter
    material.downloads += 1;
    await material.save();

    res.json({
      success: true,
      data: {
        downloadUrl,
        fileName: material.file.originalName,
        expiresIn: 3600 // 1 hour
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Reorder materials
exports.reorderMaterials = async (req, res) => {
  try {
    const { materials } = req.body; // Array of { id, order }

    if (!Array.isArray(materials)) {
      return res.status(400).json({
        success: false,
        message: 'Materials must be an array'
      });
    }

    const updatePromises = materials.map(item =>
      Material.updateOne(
        { _id: item.id, teacherId: req.user._id },
        { order: item.order }
      )
    );

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: 'Materials reordered successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
