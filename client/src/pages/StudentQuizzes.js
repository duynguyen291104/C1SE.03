import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './StudentQuizzes.css';

const StudentQuizzes = () => {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [quizResult, setQuizResult] = useState(null);
  const [previousAttempts, setPreviousAttempts] = useState([]);
  const [showReview, setShowReview] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [violations, setViolations] = useState([]);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

  useEffect(() => {
    fetchQuizzes();
  }, []);

  // Tab switching detection for exam mode
  useEffect(() => {
    if (!selectedQuiz || selectedQuiz.quizType !== 'exam' || showResult) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        const newCount = tabSwitchCount + 1;
        setTabSwitchCount(newCount);
        
        const violation = {
          type: 'tab_switch',
          timestamp: new Date(),
          details: `Tab switched ${newCount} time(s)`
        };
        setViolations(prev => [...prev, violation]);

        // Auto-submit if switched tabs
        alert('⚠️ Bạn đã chuyển tab! Bài thi sẽ tự động nộp do vi phạm quy định.');
        autoSubmitQuiz(true);
      }
    };

    const handleBlur = () => {
      if (selectedQuiz.quizType === 'exam') {
        const violation = {
          type: 'window_blur',
          timestamp: new Date(),
          details: 'Window lost focus'
        };
        setViolations(prev => [...prev, violation]);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [selectedQuiz, tabSwitchCount, showResult]);

  const fetchQuizzes = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        setMessage({ text: 'Vui lòng đăng nhập để xem bài kiểm tra', type: 'error' });
        setTimeout(() => navigate('/login'), 2000);
        return;
      }

      setLoading(true);
      const response = await axios.get(`${API_URL}/student/quizzes/published`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQuizzes(response.data.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching quizzes:', error);
      setLoading(false);
      
      if (error.response?.status === 401) {
        setMessage({ text: 'Phiên đăng nhập đã hết hạn', type: 'error' });
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setMessage({ text: 'Không thể tải danh sách bài kiểm tra', type: 'error' });
      }
    }
  };

  const startQuiz = async (quiz) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(`${API_URL}/student/quizzes/${quiz._id}/take`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSelectedQuiz(response.data.data.quiz);
      setPreviousAttempts(response.data.data.previousAttempts || []);
      setCurrentQuestionIndex(0);
      setAnswers({});
      setStartTime(new Date());
      setShowResult(false);
      setQuizResult(null);
      setTabSwitchCount(0);
      setViolations([]);
    } catch (error) {
      setMessage({ text: 'Không thể tải bài kiểm tra', type: 'error' });
    }
  };

  const handleAnswerSelect = (questionIndex, optionId) => {
    setAnswers({
      ...answers,
      [selectedQuiz.questions[questionIndex]._id]: optionId
    });
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < selectedQuiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const submitQuiz = async (isAutoSubmit = false) => {
    if (!isAutoSubmit) {
      const unansweredCount = selectedQuiz.questions.filter(
        (q) => !answers[q._id]
      ).length;

      if (unansweredCount > 0) {
        const confirm = window.confirm(
          `Bạn chưa trả lời ${unansweredCount} câu hỏi. Bạn có chắc muốn nộp bài?`
        );
        if (!confirm) return;
      }
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('accessToken');
      const timeSpent = startTime ? Math.floor((new Date() - startTime) / 1000) : 0;
      
      const response = await axios.post(
        `${API_URL}/student/quizzes/${selectedQuiz._id}/submit`,
        { 
          answers,
          startedAt: startTime,
          timeSpent,
          tabSwitchCount,
          violations,
          terminatedByViolation: isAutoSubmit
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setQuizResult(response.data.data);
      setShowResult(true);
      setMessage({ text: response.data.data.message, type: 'success' });
      
      // Refresh quiz list to update attempt status
      fetchQuizzes();
    } catch (error) {
      console.error('Error submitting quiz:', error);
      setMessage({ text: 'Lỗi khi nộp bài', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const autoSubmitQuiz = async (terminatedByViolation = false) => {
    await submitQuiz(terminatedByViolation);
  };

  const exitQuiz = () => {
    const confirm = window.confirm('Bạn có chắc muốn thoát? Dữ liệu sẽ không được lưu.');
    if (confirm) {
      setSelectedQuiz(null);
      setAnswers({});
      setCurrentQuestionIndex(0);
      setStartTime(null);
      setShowResult(false);
      setQuizResult(null);
    }
  };

  const backToQuizList = () => {
    setSelectedQuiz(null);
    setAnswers({});
    setCurrentQuestionIndex(0);
    setStartTime(null);
    setShowResult(false);
    setQuizResult(null);
    setShowReview(false);
    setReviewData(null);
  };

  const viewQuizReview = async (resultId) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(`${API_URL}/student/quizzes/results/${resultId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setReviewData(response.data.data);
      setShowReview(true);
      setShowResult(false);
      setSelectedQuiz(null);
    } catch (error) {
      setMessage({ text: 'Không thể tải chi tiết bài làm', type: 'error' });
    }
  };

  // Show review screen
  if (showReview && reviewData) {
    const quiz = reviewData.quizId;
    
    return (
      <div className="student-quizzes-container">
        <div className="review-screen">
          <div className="review-header">
            <h1>📋 Xem lại bài làm</h1>
            <button onClick={backToQuizList} className="btn-exit">❌ Đóng</button>
          </div>

          <div className="review-info">
            <h2>{quiz.title}</h2>
            <div className="review-stats">
              <div className="stat-box">
                <span className="stat-label">Điểm số</span>
                <span className="stat-value">{reviewData.score}%</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Đúng</span>
                <span className="stat-value correct">{reviewData.answers.filter(a => a.isCorrect).length}/{reviewData.answers.length}</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Sai</span>
                <span className="stat-value incorrect">{reviewData.answers.filter(a => !a.isCorrect).length}/{reviewData.answers.length}</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Điểm đạt</span>
                <span className="stat-value">{reviewData.earnedPoints}/{reviewData.totalPoints}</span>
              </div>
            </div>
          </div>

          <div className="review-questions">
            {quiz.questions.map((question, idx) => {
              const studentAnswer = reviewData.answers.find(a => a.questionId.toString() === question._id.toString());
              const isCorrect = studentAnswer?.isCorrect || false;
              
              return (
                <div key={question._id} className={`review-question-card ${isCorrect ? 'correct' : 'incorrect'}`}>
                  <div className="review-question-header">
                    <div>
                      <span className="question-number">Câu {idx + 1}</span>
                      <span className={`result-badge ${isCorrect ? 'correct' : 'incorrect'}`}>
                        {isCorrect ? '✓ Đúng' : '✗ Sai'}
                      </span>
                    </div>
                    <span className="question-points">
                      {studentAnswer?.pointsEarned || 0}/{question.points || 1} điểm
                    </span>
                  </div>

                  <h3 className="review-question-text">{question.question}</h3>

                  {question.type === 'multiple-choice' && (
                    <div className="review-options">
                      {question.options.map((option, oIdx) => {
                        const isStudentAnswer = studentAnswer?.selectedAnswer === option._id;
                        const isCorrectAnswer = option.isCorrect;
                        
                        // Chỉ hiển thị đáp án đúng nếu câu trả lời đúng
                        let optionClass = 'review-option';
                        
                        if (isCorrect && isCorrectAnswer) {
                          // Câu đúng: Hiển thị đáp án đúng
                          optionClass += ' correct-answer';
                        }
                        
                        if (isStudentAnswer) {
                          if (isCorrectAnswer) {
                            // Học sinh chọn đúng
                            optionClass += ' student-correct';
                          } else {
                            // Học sinh chọn sai - chỉ tô đỏ
                            optionClass += ' wrong-answer';
                          }
                        }
                        
                        return (
                          <div key={option._id} className={optionClass}>
                            <span className="option-letter">{String.fromCharCode(65 + oIdx)}</span>
                            <span className="option-text">{option.text}</span>
                            {isStudentAnswer && (
                              <span className={`option-badge ${isCorrectAnswer ? 'correct' : 'wrong'}`}>
                                Bạn chọn
                              </span>
                            )}
                            {/* Chỉ hiển thị đáp án đúng nếu học sinh trả lời đúng câu này */}
                            {isCorrect && isCorrectAnswer && (
                              <span className="option-badge correct">Đáp án đúng</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {question.type === 'true-false' && (
                    <div className="review-options">
                      {/* Option Đúng */}
                      <div className={`review-option 
                        ${isCorrect && question.correctAnswer === true ? 'correct-answer' : ''} 
                        ${studentAnswer?.selectedAnswer === true && question.correctAnswer !== true ? 'wrong-answer' : ''}
                        ${studentAnswer?.selectedAnswer === true && question.correctAnswer === true ? 'student-correct' : ''}`}>
                        <span className="option-text">✅ Đúng</span>
                        {studentAnswer?.selectedAnswer === true && (
                          <span className={`option-badge ${question.correctAnswer === true ? 'correct' : 'wrong'}`}>
                            Bạn chọn
                          </span>
                        )}
                        {/* Chỉ hiển thị đáp án đúng nếu học sinh trả lời đúng câu này */}
                        {isCorrect && question.correctAnswer === true && (
                          <span className="option-badge correct">Đáp án đúng</span>
                        )}
                      </div>
                      
                      {/* Option Sai */}
                      <div className={`review-option 
                        ${isCorrect && question.correctAnswer === false ? 'correct-answer' : ''} 
                        ${studentAnswer?.selectedAnswer === false && question.correctAnswer !== false ? 'wrong-answer' : ''}
                        ${studentAnswer?.selectedAnswer === false && question.correctAnswer === false ? 'student-correct' : ''}`}>
                        <span className="option-text">❌ Sai</span>
                        {studentAnswer?.selectedAnswer === false && (
                          <span className={`option-badge ${question.correctAnswer === false ? 'correct' : 'wrong'}`}>
                            Bạn chọn
                          </span>
                        )}
                        {/* Chỉ hiển thị đáp án đúng nếu học sinh trả lời đúng câu này */}
                        {isCorrect && question.correctAnswer === false && (
                          <span className="option-badge correct">Đáp án đúng</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Chỉ hiển thị giải thích nếu câu trả lời đúng */}
                  {isCorrect && question.explanation && (
                    <div className="explanation-box">
                      <strong>💡 Giải thích:</strong>
                      <p>{question.explanation}</p>
                    </div>
                  )}

                  {/* Thông báo cho câu sai */}
                  {!isCorrect && (
                    <div className="wrong-answer-hint">
                      <p>❌ Câu trả lời của bạn chưa chính xác. Hãy làm lại bài để tìm đáp án đúng!</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="review-notice">
            <p>💡 <strong>Lưu ý:</strong> Chỉ những câu trả lời đúng mới hiển thị đáp án chính xác. Nếu muốn biết đáp án của câu sai, hãy làm lại bài kiểm tra cho đến khi trả lời đúng.</p>
          </div>

          <div className="review-actions">
            <button onClick={() => {
              const quiz = reviewData.quizId;
              setShowReview(false);
              startQuiz(quiz);
            }} className="btn btn-warning">
              🔄 Làm lại để tìm đáp án
            </button>
            <button onClick={backToQuizList} className="btn btn-primary">
              📚 Quay lại danh sách
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show result screen
  if (showResult && quizResult) {
    const isPassed = quizResult.passed;
    const isFirstAttempt = quizResult.isFirstAttempt;
    
    return (
      <div className="student-quizzes-container">
        <div className="result-screen">
          <div className={`result-header ${isPassed ? 'passed' : 'failed'}`}>
            <h1>{isPassed ? '🎉 Chúc mừng!' : '📚 Cần cố gắng thêm'}</h1>
            <div className="score-display">
              <div className="score-circle">
                <span className="score-number">{quizResult.score}%</span>
              </div>
            </div>
          </div>

          <div className="result-details">
            <div className="result-stats">
              <div className="stat-item">
                <span className="stat-label">Điểm số:</span>
                <span className="stat-value">{quizResult.earnedPoints}/{quizResult.totalPoints}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Phần trăm:</span>
                <span className="stat-value">{quizResult.score}%</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Trạng thái:</span>
                <span className={`stat-value ${isPassed ? 'passed' : 'failed'}`}>
                  {isPassed ? '✅ Đạt' : '❌ Chưa đạt'}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Lần làm:</span>
                <span className="stat-value">Lần {quizResult.attemptNumber}</span>
              </div>
            </div>

            {isFirstAttempt ? (
              <div className="result-message success">
                <p>✅ Điểm này đã được lưu vào hồ sơ của bạn!</p>
              </div>
            ) : (
              <div className="result-message info">
                <p>ℹ️ Đây là lần luyện tập. Điểm chính thức vẫn giữ nguyên.</p>
              </div>
            )}

            {previousAttempts.length > 0 && (
              <div className="previous-attempts">
                <h3>Lịch sử làm bài</h3>
                <div className="attempts-list">
                  {previousAttempts.map((attempt, idx) => (
                    <div key={idx} className="attempt-item">
                      <span>Lần {attempt.attemptNumber}</span>
                      <span className={attempt.passed ? 'passed' : 'failed'}>
                        {attempt.score}%
                      </span>
                      <span className="attempt-date">
                        {new Date(attempt.submittedAt).toLocaleDateString('vi-VN')}
                      </span>
                      {attempt.isFirstAttempt && <span className="badge">Chính thức</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="result-actions">
            <button onClick={() => viewQuizReview(quizResult.resultId)} className="btn btn-info">
              📋 Xem chi tiết bài làm
            </button>
            {!isPassed && (
              <button onClick={() => startQuiz(selectedQuiz)} className="btn btn-warning">
                🔄 Làm lại để luyện tập
              </button>
            )}
            <button onClick={backToQuizList} className="btn btn-primary">
              📚 Quay lại danh sách
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show quiz taking screen
  if (selectedQuiz && !showResult) {
    const currentQuestion = selectedQuiz.questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / selectedQuiz.questions.length) * 100;
    const isAnswered = answers[currentQuestion._id];

    return (
      <div className="student-quizzes-container">
        <div className="quiz-taking">
          <div className="quiz-header">
            <div>
              <h2>{selectedQuiz.title}</h2>
              <p className="quiz-instruction">{selectedQuiz.instructions || 'Hãy đọc kỹ câu hỏi và chọn đáp án đúng nhất'}</p>
            </div>
            <button onClick={exitQuiz} className="btn-exit">❌ Thoát</button>
          </div>

          {previousAttempts.length > 0 && (
            <div className="attempts-notice">
              <p>ℹ️ Bạn đã làm bài này {previousAttempts.length} lần. Lần này chỉ để luyện tập.</p>
            </div>
          )}

          <div className="quiz-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
            <p>Câu {currentQuestionIndex + 1} / {selectedQuiz.questions.length}</p>
          </div>

          <div className="question-card">
            <div className="question-header">
              <span className="question-number">Câu {currentQuestionIndex + 1}</span>
              <span className="question-points">{currentQuestion.points || 1} điểm</span>
            </div>
            <h3 className="question-text">{currentQuestion.question}</h3>
            
            {currentQuestion.imageUrl && (
              <img src={currentQuestion.imageUrl} alt="Question" className="question-image" />
            )}

            <div className="answers-list">
              {currentQuestion.type === 'multiple-choice' && currentQuestion.options?.map((option, idx) => (
                <div
                  key={option._id || idx}
                  className={`answer-option ${isAnswered === option._id ? 'selected' : ''}`}
                  onClick={() => handleAnswerSelect(currentQuestionIndex, option._id)}
                >
                  <input
                    type="radio"
                    name={`question-${currentQuestion._id}`}
                    checked={isAnswered === option._id}
                    onChange={() => {}}
                  />
                  <label>{String.fromCharCode(65 + idx)}. {option.text}</label>
                </div>
              ))}

              {currentQuestion.type === 'true-false' && (
                <>
                  <div
                    className={`answer-option ${isAnswered === true ? 'selected' : ''}`}
                    onClick={() => handleAnswerSelect(currentQuestionIndex, true)}
                  >
                    <input
                      type="radio"
                      name={`question-${currentQuestion._id}`}
                      checked={isAnswered === true}
                      onChange={() => {}}
                    />
                    <label>✅ Đúng</label>
                  </div>
                  <div
                    className={`answer-option ${isAnswered === false ? 'selected' : ''}`}
                    onClick={() => handleAnswerSelect(currentQuestionIndex, false)}
                  >
                    <input
                      type="radio"
                      name={`question-${currentQuestion._id}`}
                      checked={isAnswered === false}
                      onChange={() => {}}
                    />
                    <label>❌ Sai</label>
                  </div>
                </>
              )}
            </div>

            {!isAnswered && (
              <p className="unanswered-warning">⚠️ Bạn chưa chọn đáp án cho câu này</p>
            )}
          </div>

          <div className="quiz-navigation">
            <button 
              onClick={previousQuestion} 
              disabled={currentQuestionIndex === 0}
              className="btn btn-secondary"
            >
              ⬅️ Câu trước
            </button>
            
            <div className="answer-status">
              Đã trả lời: {Object.keys(answers).length}/{selectedQuiz.questions.length}
            </div>

            {currentQuestionIndex === selectedQuiz.questions.length - 1 ? (
              <button 
                onClick={submitQuiz} 
                disabled={isSubmitting}
                className="btn btn-success"
              >
                {isSubmitting ? '⏳ Đang nộp bài...' : '✅ Nộp bài'}
              </button>
            ) : (
              <button onClick={nextQuestion} className="btn btn-primary">
                Câu tiếp ➡️
              </button>
            )}
          </div>

          <div className="question-overview">
            <p>Tổng quan câu hỏi:</p>
            <div className="question-dots">
              {selectedQuiz.questions.map((q, idx) => (
                <span 
                  key={idx}
                  className={`question-dot ${answers[q._id] ? 'answered' : ''} ${idx === currentQuestionIndex ? 'current' : ''}`}
                  onClick={() => setCurrentQuestionIndex(idx)}
                  title={`Câu ${idx + 1}`}
                >
                  {idx + 1}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show quiz list
  return (
    <div className="student-quizzes-container">
      <div className="page-header">
        <h1>📝 Bài Kiểm Tra</h1>
        <p>Danh sách các bài kiểm tra có sẵn</p>
      </div>

      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="loading">⏳ Đang tải...</div>
      ) : (
        <div className="quizzes-grid">
          {quizzes.length === 0 ? (
            <p className="no-data">Chưa có bài kiểm tra nào được xuất bản</p>
          ) : (
            quizzes.map((quiz) => (
              <div key={quiz._id} className="quiz-card">
                <div className="quiz-card-header">
                  <h3>{quiz.title}</h3>
                  {quiz.hasAttempted && (
                    <span className="attempted-badge">✅ Đã làm</span>
                  )}
                </div>
                <p className="quiz-description">{quiz.description || 'Không có mô tả'}</p>
                
                <div className="quiz-info">
                  <span>❓ {quiz.questions?.length || 0} câu hỏi</span>
                  <span>⏱️ {quiz.duration} phút</span>
                  <span>🎯 {quiz.passingScore}% để đạt</span>
                </div>

                {quiz.studentResult && (
                  <div className={`quiz-result ${quiz.studentResult.passed ? 'passed' : 'failed'}`}>
                    <p>Điểm của bạn: <strong>{quiz.studentResult.score}%</strong></p>
                    <p className={quiz.studentResult.passed ? 'passed-text' : 'failed-text'}>
                      {quiz.studentResult.passed ? '✅ Đã đạt' : '❌ Chưa đạt'}
                    </p>
                  </div>
                )}

                <div className="quiz-actions">
                  {quiz.hasAttempted ? (
                    <>
                      <button 
                        onClick={() => {
                          const resultId = quiz.studentResult?._id;
                          if (resultId) {
                            viewQuizReview(resultId);
                          }
                        }}
                        className="btn btn-info"
                        disabled={!quiz.studentResult?._id}
                      >
                        📋 Xem chi tiết
                      </button>
                      <button 
                        onClick={() => startQuiz(quiz)} 
                        className="btn btn-secondary"
                      >
                        🔄 Làm lại
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => startQuiz(quiz)} 
                      className="btn btn-primary"
                    >
                      ▶️ Bắt đầu làm bài
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default StudentQuizzes;
