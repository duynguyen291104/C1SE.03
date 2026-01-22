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

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

  useEffect(() => {
    fetchQuizzes();
  }, []);

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

  const submitQuiz = async () => {
    const unansweredCount = selectedQuiz.questions.filter(
      (q) => !answers[q._id]
    ).length;

    if (unansweredCount > 0) {
      const confirm = window.confirm(
        `Bạn chưa trả lời ${unansweredCount} câu hỏi. Bạn có chắc muốn nộp bài?`
      );
      if (!confirm) return;
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
          timeSpent
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
  };

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
                        onClick={() => startQuiz(quiz)} 
                        className="btn btn-secondary"
                      >
                        🔄 Làm lại (Luyện tập)
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
