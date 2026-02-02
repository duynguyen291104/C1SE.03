const Quiz = require('../models/Quiz');
const QuizResult = require('../models/QuizResult');
const mongoose = require('mongoose');

/**
 * Get teacher dashboard statistics
 * - Questions students frequently get wrong
 * - Chapters/topics with low performance rates
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const teacherId = req.user._id;

    // Get all teacher's published quizzes
    const teacherQuizzes = await Quiz.find({
      teacherId,
      status: 'published'
    }).select('_id title tags');

    const quizIds = teacherQuizzes.map(q => q._id);

    // Get all results for these quizzes
    const results = await QuizResult.find({
      quizId: { $in: quizIds },
      isFirstAttempt: true
    }).populate({
      path: 'quizId',
      select: 'title questions tags'
    });

    // Analyze frequently wrong questions
    const questionStats = {};
    const topicStats = {};

    results.forEach(result => {
      if (!result.quizId) return;

      // Analyze each answer
      result.answers.forEach(answer => {
        const questionId = answer.questionId.toString();
        
        if (!questionStats[questionId]) {
          questionStats[questionId] = {
            questionId,
            totalAttempts: 0,
            wrongAttempts: 0,
            wrongRate: 0,
            questionText: '',
            quizTitle: result.quizId.title
          };
        }

        questionStats[questionId].totalAttempts++;
        if (!answer.isCorrect) {
          questionStats[questionId].wrongAttempts++;
        }

        // Find question details
        const question = result.quizId.questions.find(
          q => q._id.toString() === questionId
        );
        if (question) {
          questionStats[questionId].questionText = question.question;
          
          // Track by tags (topics/chapters)
          if (question.tags && question.tags.length > 0) {
            question.tags.forEach(tag => {
              if (!topicStats[tag]) {
                topicStats[tag] = {
                  topic: tag,
                  totalAttempts: 0,
                  wrongAttempts: 0,
                  wrongRate: 0
                };
              }
              topicStats[tag].totalAttempts++;
              if (!answer.isCorrect) {
                topicStats[tag].wrongAttempts++;
              }
            });
          }
        }
      });

      // Also track by quiz tags if no question tags
      if (result.quizId.tags && result.quizId.tags.length > 0) {
        result.quizId.tags.forEach(tag => {
          if (!topicStats[tag]) {
            topicStats[tag] = {
              topic: tag,
              totalAttempts: 0,
              wrongAttempts: 0,
              wrongRate: 0
            };
          }
          // Count based on quiz score
          topicStats[tag].totalAttempts++;
          if (!result.passed) {
            topicStats[tag].wrongAttempts++;
          }
        });
      }
    });

    // Calculate wrong rates
    Object.values(questionStats).forEach(stat => {
      stat.wrongRate = stat.totalAttempts > 0 
        ? Math.round((stat.wrongAttempts / stat.totalAttempts) * 100) 
        : 0;
    });

    Object.values(topicStats).forEach(stat => {
      stat.wrongRate = stat.totalAttempts > 0 
        ? Math.round((stat.wrongAttempts / stat.totalAttempts) * 100) 
        : 0;
    });

    // Sort by wrong rate
    const frequentlyWrongQuestions = Object.values(questionStats)
      .filter(q => q.totalAttempts >= 3) // At least 3 attempts
      .sort((a, b) => b.wrongRate - a.wrongRate)
      .slice(0, 10); // Top 10

    const lowPerformanceTopics = Object.values(topicStats)
      .filter(t => t.totalAttempts >= 5) // At least 5 attempts
      .sort((a, b) => b.wrongRate - a.wrongRate)
      .slice(0, 10); // Top 10

    // Overall statistics
    const totalStudents = new Set(results.map(r => r.studentId.toString())).size;
    const totalQuizzes = teacherQuizzes.length;
    const totalAttempts = results.length;
    const averageScore = results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
      : 0;
    const passRate = results.length > 0
      ? Math.round((results.filter(r => r.passed).length / results.length) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        overview: {
          totalStudents,
          totalQuizzes,
          totalAttempts,
          averageScore,
          passRate
        },
        frequentlyWrongQuestions,
        lowPerformanceTopics
      }
    });
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get detailed statistics for a specific quiz
 */
exports.getQuizDetailedStats = async (req, res) => {
  try {
    const { quizId } = req.params;
    const teacherId = req.user._id;

    // Verify quiz ownership
    const quiz = await Quiz.findOne({
      _id: quizId,
      teacherId
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found or unauthorized'
      });
    }

    // Get all results for this quiz
    const results = await QuizResult.find({
      quizId,
      isFirstAttempt: true
    }).populate('studentId', 'email profile');

    // Analyze per-question statistics
    const questionAnalysis = quiz.questions.map(question => {
      const questionId = question._id.toString();
      let correct = 0;
      let wrong = 0;
      let unanswered = 0;

      results.forEach(result => {
        const answer = result.answers.find(
          a => a.questionId.toString() === questionId
        );
        
        if (!answer || answer.selectedAnswer === null || answer.selectedAnswer === undefined) {
          unanswered++;
        } else if (answer.isCorrect) {
          correct++;
        } else {
          wrong++;
        }
      });

      const total = correct + wrong + unanswered;
      const correctRate = total > 0 ? Math.round((correct / total) * 100) : 0;

      return {
        questionId,
        questionText: question.question.substring(0, 100),
        difficulty: question.difficulty || 'medium',
        type: question.type,
        points: question.points || 1,
        correct,
        wrong,
        unanswered,
        total,
        correctRate
      };
    });

    // Difficulty distribution analysis
    const difficultyStats = {
      easy: { correct: 0, wrong: 0, total: 0 },
      medium: { correct: 0, wrong: 0, total: 0 },
      hard: { correct: 0, wrong: 0, total: 0 }
    };

    questionAnalysis.forEach(q => {
      const diff = q.difficulty || 'medium';
      if (difficultyStats[diff]) {
        difficultyStats[diff].correct += q.correct;
        difficultyStats[diff].wrong += q.wrong;
        difficultyStats[diff].total += q.total;
      }
    });

    // Calculate rates for difficulty
    Object.keys(difficultyStats).forEach(diff => {
      const stat = difficultyStats[diff];
      stat.correctRate = stat.total > 0 
        ? Math.round((stat.correct / stat.total) * 100) 
        : 0;
    });

    // Student performance distribution
    const scoreDistribution = {
      '0-30': 0,
      '30-50': 0,
      '50-70': 0,
      '70-90': 0,
      '90-100': 0
    };

    results.forEach(result => {
      const score = result.score;
      if (score < 30) scoreDistribution['0-30']++;
      else if (score < 50) scoreDistribution['30-50']++;
      else if (score < 70) scoreDistribution['50-70']++;
      else if (score < 90) scoreDistribution['70-90']++;
      else scoreDistribution['90-100']++;
    });

    res.json({
      success: true,
      data: {
        quiz: {
          _id: quiz._id,
          title: quiz.title,
          totalQuestions: quiz.questions.length,
          passingScore: quiz.passingScore,
          quizType: quiz.quizType
        },
        questionAnalysis,
        difficultyStats,
        scoreDistribution,
        totalAttempts: results.length,
        averageScore: results.length > 0
          ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
          : 0
      }
    });
  } catch (error) {
    console.error('Error getting quiz detailed stats:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = exports;
