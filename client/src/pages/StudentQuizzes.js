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
      const response = await axios.get(`${API_URL}/quizzes`, {
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

  const startQuiz = (quiz) => {
    setSelectedQuiz(quiz);
    setCurrentQuestionIndex(0);
    setAnswers({});
  };

  const handleAnswerSelect = (questionId, answerId) => {
    setAnswers({
      ...answers,
      [questionId]: answerId
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
    const unanswered = selectedQuiz.questions.filter(
      (q) => !answers[q._id]
    );

    if (unanswered.length > 0) {
      const confirm = window.confirm(
        `Bạn chưa trả lời ${unanswered.length} câu hỏi. Bạn có chắc muốn nộp bài?`
      );
      if (!confirm) return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.post(
        `${API_URL}/quizzes/${selectedQuiz._id}/submit`,
        { answers },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessage({ 
        text: `Nộp bài thành công! Điểm: ${response.data.score}/${selectedQuiz.questions.length}`, 
        type: 'success' 
      });
      
      setSelectedQuiz(null);
      setAnswers({});
      setCurrentQuestionIndex(0);
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
    }
  };

  if (selectedQuiz) {
    const currentQuestion = selectedQuiz.questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / selectedQuiz.questions.length) * 100;

    return (
      <div className="student-quizzes-container">
        <div className="quiz-taking">
          <div className="quiz-header">
            <h2>{selectedQuiz.title}</h2>
            <button onClick={exitQuiz} className="btn btn-secondary">Thoát</button>
          </div>

          <div className="quiz-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
            <p>Câu {currentQuestionIndex + 1} / {selectedQuiz.questions.length}</p>
          </div>

          <div className="question-card">
            <h3>{currentQuestion.question}</h3>
            <div className="answers-list">
              {currentQuestion.answers.map((answer) => (
                <div
                  key={answer._id}
                  className={`answer-option ${answers[currentQuestion._id] === answer._id ? 'selected' : ''}`}
                  onClick={() => handleAnswerSelect(currentQuestion._id, answer._id)}
                >
                  <input
                    type="radio"
                    name={`question-${currentQuestion._id}`}
                    checked={answers[currentQuestion._id] === answer._id}
                    readOnly
                  />
                  <label>{answer.text}</label>
                </div>
              ))}
            </div>
          </div>

          <div className="quiz-navigation">
            <button 
              onClick={previousQuestion} 
              disabled={currentQuestionIndex === 0}
              className="btn btn-secondary"
            >
              Câu trước
            </button>
            
            {currentQuestionIndex === selectedQuiz.questions.length - 1 ? (
              <button 
                onClick={submitQuiz} 
                disabled={isSubmitting}
                className="btn btn-primary"
              >
                {isSubmitting ? 'Đang nộp bài...' : 'Nộp bài'}
              </button>
            ) : (
              <button onClick={nextQuestion} className="btn btn-primary">
                Câu tiếp
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

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
        <div className="loading">Đang tải...</div>
      ) : (
        <div className="quizzes-grid">
          {quizzes.length === 0 ? (
            <p className="no-data">Chưa có bài kiểm tra nào</p>
          ) : (
            quizzes.map((quiz) => (
              <div key={quiz._id} className="quiz-card">
                <h3>{quiz.title}</h3>
                <p className="quiz-description">{quiz.description}</p>
                <div className="quiz-info">
                  <span>📊 {quiz.questions.length} câu hỏi</span>
                  <span>⏱️ {quiz.timeLimit || 'Không giới hạn'}</span>
                </div>
                <button 
                  onClick={() => startQuiz(quiz)} 
                  className="btn btn-primary"
                >
                  Bắt đầu làm bài
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default StudentQuizzes;
