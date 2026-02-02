const Quiz = require('../models/Quiz');
const QuizResult = require('../models/QuizResult');
const AuditLog = require('../models/AuditLog');

// Get all published quizzes for students
exports.getPublishedQuizzes = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const query = { status: 'published' };

    const quizzes = await Quiz.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('teacherId', 'name email')
      .select('-questions.correctAnswer -questions.sampleAnswer -questions.blanks.acceptedAnswers');

    const total = await Quiz.countDocuments(query);

    // Get student's results for these quizzes
    const quizIds = quizzes.map(q => q._id);
    const results = await QuizResult.find({
      quizId: { $in: quizIds },
      studentId: req.user._id,
      isFirstAttempt: true
    }).select('quizId score passed attemptNumber _id');

    // Map results to quizzes
    const quizzesWithResults = quizzes.map(quiz => {
      const result = results.find(r => r.quizId.toString() === quiz._id.toString());
      return {
        ...quiz.toObject(),
        studentResult: result ? {
          _id: result._id,
          score: result.score,
          passed: result.passed,
          attemptNumber: result.attemptNumber
        } : null,
        hasAttempted: !!result
      };
    });

    res.json({
      success: true,
      data: quizzesWithResults,
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

// Get single quiz for taking (without answers)
exports.getQuizForTaking = async (req, res) => {
  try {
    const quiz = await Quiz.findOne({
      _id: req.params.id,
      status: 'published'
    })
      .populate('teacherId', 'name email')
      .select('-questions.correctAnswer -questions.sampleAnswer -questions.blanks.acceptedAnswers -questions.options.isCorrect');

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found or not available'
      });
    }

    // Get student's previous attempts
    const attempts = await QuizResult.find({
      quizId: quiz._id,
      studentId: req.user._id
    }).sort({ attemptNumber: -1 }).limit(5);

    res.json({
      success: true,
      data: {
        quiz,
        previousAttempts: attempts.map(a => ({
          attemptNumber: a.attemptNumber,
          score: a.score,
          passed: a.passed,
          submittedAt: a.submittedAt,
          isFirstAttempt: a.isFirstAttempt
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Submit quiz and get graded results
exports.submitQuiz = async (req, res) => {
  try {
    const { answers, timeSpent, tabSwitchCount = 0, violations = [], terminatedByViolation = false } = req.body;
    const startedAt = req.body.startedAt ? new Date(req.body.startedAt) : new Date();

    // Get the full quiz with correct answers
    const quiz = await Quiz.findOne({
      _id: req.params.id,
      status: 'published'
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found or not available'
      });
    }

    // Check if student already has attempts
    const existingAttempts = await QuizResult.find({
      quizId: quiz._id,
      studentId: req.user._id
    }).sort({ attemptNumber: -1 });

    const attemptNumber = existingAttempts.length + 1;
    const isFirstAttempt = attemptNumber === 1;
    
    // For exam type, check max attempts (only allow 1 attempt)
    if (quiz.quizType === 'exam' && existingAttempts.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã hoàn thành bài thi này. Không được làm lại.'
      });
    }
    
    // For practice type, allow retakes only if score < 30
    if (quiz.quizType === 'practice' && existingAttempts.length > 0) {
      const lastAttempt = existingAttempts[0];
      if (lastAttempt.score >= 30) {
        return res.status(400).json({
          success: false,
          message: 'Bạn đã đạt điểm cao hơn 3. Không cần làm lại.'
        });
      }
    }

    // Grade the quiz
    let totalPoints = 0;
    let earnedPoints = 0;
    const gradedAnswers = [];

    quiz.questions.forEach(question => {
      totalPoints += question.points || 1;
      
      const studentAnswer = answers[question._id.toString()];
      let isCorrect = false;
      let pointsEarned = 0;

      // Check answer based on question type
      if (question.type === 'multiple-choice') {
        const correctOption = question.options.find(opt => opt.isCorrect);
        if (correctOption && studentAnswer === correctOption._id.toString()) {
          isCorrect = true;
          pointsEarned = question.points || 1;
        }
      } else if (question.type === 'true-false') {
        if (studentAnswer === question.correctAnswer) {
          isCorrect = true;
          pointsEarned = question.points || 1;
        }
      }

      earnedPoints += pointsEarned;

      gradedAnswers.push({
        questionId: question._id,
        selectedAnswer: studentAnswer,
        isCorrect,
        pointsEarned
      });
    });

    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const passed = score >= (quiz.passingScore || 60);

    // Create quiz result
    const result = await QuizResult.create({
      quizId: quiz._id,
      studentId: req.user._id,
      answers: gradedAnswers,
      score,
      totalPoints,
      earnedPoints,
      passed,
      attemptNumber,
      isFirstAttempt,
      timeSpent: timeSpent || 0,
      startedAt,
      submittedAt: new Date(),
      tabSwitchCount,
      violations,
      terminatedByViolation
    });

    await AuditLog.log({
      userId: req.user._id,
      action: 'SUBMIT_QUIZ',
      metadata: { 
        quizId: quiz._id, 
        score,
        attemptNumber,
        isFirstAttempt,
        quizType: quiz.quizType,
        tabSwitchCount,
        terminatedByViolation
      }
    });
    
    // Determine message based on quiz type and score
    let message = '';
    let canRetake = false;
    
    if (quiz.quizType === 'exam') {
      if (terminatedByViolation) {
        message = '⚠️ Bài thi đã bị kết thúc do vi phạm quy định. Điểm số: ' + score + '%';
      } else {
        message = 'Bài thi của bạn đã được nộp. Điểm số: ' + score + '%';
      }
    } else { // practice
      if (score < 30) {
        message = `Điểm số: ${score}%. Bạn có thể làm lại để cải thiện kết quả.`;
        canRetake = true;
      } else {
        message = `Điểm số: ${score}%. Chúc mừng bạn đã hoàn thành tốt!`;
      }
    }

    res.json({
      success: true,
      data: {
        resultId: result._id,
        score,
        earnedPoints,
        totalPoints,
        passed,
        attemptNumber,
        isFirstAttempt,
        quizType: quiz.quizType,
        canRetake,
        terminatedByViolation,
        message
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get quiz result with detailed answers
exports.getQuizResult = async (req, res) => {
  try {
    const result = await QuizResult.findOne({
      _id: req.params.resultId,
      studentId: req.user._id
    }).populate({
      path: 'quizId',
      select: 'title description questions settings'
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Result not found'
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all student's quiz results
exports.getMyResults = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const results = await QuizResult.find({
      studentId: req.user._id,
      isFirstAttempt: true
    })
      .sort({ submittedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('quizId', 'title description teacherId')
      .populate({
        path: 'quizId',
        populate: {
          path: 'teacherId',
          select: 'name email'
        }
      });

    const total = await QuizResult.countDocuments({
      studentId: req.user._id,
      isFirstAttempt: true
    });

    res.json({
      success: true,
      data: results,
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

// Get all attempts for a specific quiz
exports.getQuizAttempts = async (req, res) => {
  try {
    const attempts = await QuizResult.find({
      quizId: req.params.id,
      studentId: req.user._id
    }).sort({ attemptNumber: 1 });

    res.json({
      success: true,
      data: attempts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = exports;
