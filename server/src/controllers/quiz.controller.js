const Quiz = require('../models/Quiz');
const AuditLog = require('../models/AuditLog');

// Create new quiz
exports.createQuiz = async (req, res) => {
  try {
    const { 
      title, 
      description, 
      instructions,
      courseId, 
      questions, 
      duration,
      passingScore,
      settings,
      dueDate,
      availableFrom,
      availableUntil,
      tags 
    } = req.body;

    const quiz = await Quiz.create({
      teacherId: req.user._id,
      title,
      description,
      instructions,
      courseId,
      questions: questions || [],
      duration,
      passingScore,
      settings: settings || {},
      dueDate,
      availableFrom,
      availableUntil,
      tags: tags || [],
      status: 'draft'
    });

    await AuditLog.log({
      userId: req.user._id,
      action: 'CREATE_QUIZ',
      metadata: { quizId: quiz._id, title }
    });

    res.status(201).json({
      success: true,
      data: quiz
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all quizzes by teacher
exports.getQuizzes = async (req, res) => {
  try {
    const { status, courseId, page = 1, limit = 20 } = req.query;
    
    const query = { teacherId: req.user._id };
    if (status) query.status = status;
    if (courseId) query.courseId = courseId;

    const quizzes = await Quiz.find(query)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('courseId', 'title')
      .select('-questions.sampleAnswer -questions.correctAnswer -questions.blanks.acceptedAnswers');

    const total = await Quiz.countDocuments(query);

    res.json({
      success: true,
      data: quizzes,
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

// Get single quiz by ID (with answers for teacher)
exports.getQuizById = async (req, res) => {
  try {
    const quiz = await Quiz.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    }).populate('courseId', 'title');

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    res.json({
      success: true,
      data: quiz
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update quiz
exports.updateQuiz = async (req, res) => {
  try {
    const updateFields = [
      'title', 'description', 'instructions', 'questions', 
      'duration', 'passingScore', 'settings', 'status',
      'dueDate', 'availableFrom', 'availableUntil', 'tags'
    ];

    const quiz = await Quiz.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        quiz[field] = req.body[field];
      }
    });

    await quiz.save();

    await AuditLog.log({
      userId: req.user._id,
      action: 'UPDATE_QUIZ',
      metadata: { quizId: quiz._id, title: quiz.title }
    });

    res.json({
      success: true,
      data: quiz
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete quiz
exports.deleteQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findOneAndDelete({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    await AuditLog.log({
      userId: req.user._id,
      action: 'DELETE_QUIZ',
      metadata: { quizId: quiz._id, title: quiz.title }
    });

    res.json({
      success: true,
      message: 'Quiz deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Publish quiz
exports.publishQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    if (!quiz.questions || quiz.questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot publish quiz without questions'
      });
    }

    quiz.status = 'published';
    await quiz.save();

    await AuditLog.log({
      userId: req.user._id,
      action: 'PUBLISH_QUIZ',
      metadata: { quizId: quiz._id, title: quiz.title }
    });

    res.json({
      success: true,
      data: quiz
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Duplicate quiz
exports.duplicateQuiz = async (req, res) => {
  try {
    const originalQuiz = await Quiz.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!originalQuiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    const duplicatedQuiz = await Quiz.create({
      teacherId: req.user._id,
      title: `${originalQuiz.title} (Copy)`,
      description: originalQuiz.description,
      instructions: originalQuiz.instructions,
      courseId: originalQuiz.courseId,
      questions: originalQuiz.questions,
      duration: originalQuiz.duration,
      passingScore: originalQuiz.passingScore,
      settings: originalQuiz.settings,
      tags: originalQuiz.tags,
      status: 'draft'
    });

    res.status(201).json({
      success: true,
      data: duplicatedQuiz
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
