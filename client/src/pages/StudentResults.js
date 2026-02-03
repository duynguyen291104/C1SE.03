import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './StudentResults.css';

const StudentResults = () => {
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [selectedResult, setSelectedResult] = useState(null);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        setMessage({ text: 'Vui lòng đăng nhập để xem kết quả', type: 'error' });
        setTimeout(() => navigate('/login'), 2000);
        return;
      }

      setLoading(true);
      const response = await axios.get(`${API_URL}/quizzes/my-results`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResults(response.data.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching results:', error);
      setLoading(false);
      
      if (error.response?.status === 401) {
        setMessage({ text: 'Phiên đăng nhập đã hết hạn', type: 'error' });
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setMessage({ text: 'Không thể tải kết quả', type: 'error' });
      }
    }
  };

  const viewResultDetail = (result) => {
    setSelectedResult(result);
  };

  const closeDetail = () => {
    setSelectedResult(null);
  };

  const getScoreColor = (percentage) => {
    if (percentage >= 80) return '#27ae60';
    if (percentage >= 60) return '#f39c12';
    return '#e74c3c';
  };

  const getGrade = (percentage) => {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour12: false
    });
  };

  const calculateStats = () => {
    if (results.length === 0) return { avg: 0, highest: 0, lowest: 0, total: 0 };
    
    const scores = results.map(r => (r.score / r.totalQuestions) * 100);
    return {
      avg: (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1),
      highest: Math.max(...scores).toFixed(1),
      lowest: Math.min(...scores).toFixed(1),
      total: results.length
    };
  };

  const stats = calculateStats();

  if (selectedResult) {
    const percentage = (selectedResult.score / selectedResult.totalQuestions) * 100;
    
    return (
      <div className="student-results-container">
        <div className="result-detail">
          <div className="detail-header">
            <h2>📊 Chi Tiết Kết Quả</h2>
            <button onClick={closeDetail} className="btn btn-secondary">Đóng</button>
          </div>

          <div className="detail-summary">
            <div className="summary-card">
              <h3>{selectedResult.quizTitle}</h3>
              <div className="score-display">
                <div 
                  className="score-circle"
                  style={{ borderColor: getScoreColor(percentage) }}
                >
                  <span className="score-text" style={{ color: getScoreColor(percentage) }}>
                    {selectedResult.score}/{selectedResult.totalQuestions}
                  </span>
                  <span className="score-percentage">
                    {percentage.toFixed(1)}%
                  </span>
                  <span className="score-grade" style={{ color: getScoreColor(percentage) }}>
                    {getGrade(percentage)}
                  </span>
                </div>
              </div>
              <p className="submitted-time">Nộp lúc: {formatDate(selectedResult.submittedAt)}</p>
            </div>
          </div>

          {selectedResult.answers && (
            <div className="answers-review">
              <h3>Đáp Án Chi Tiết</h3>
              {selectedResult.answers.map((answer, index) => (
                <div 
                  key={index} 
                  className={`answer-review-card ${answer.isCorrect ? 'correct' : 'incorrect'}`}
                >
                  <div className="question-number">
                    Câu {index + 1}
                    {answer.isCorrect ? ' ✓' : ' ✗'}
                  </div>
                  <div className="question-text">{answer.question}</div>
                  <div className="answer-info">
                    <div className="your-answer">
                      <strong>Câu trả lời của bạn:</strong> {answer.yourAnswer || 'Chưa trả lời'}
                    </div>
                    {!answer.isCorrect && (
                      <div className="correct-answer">
                        <strong>Đáp án đúng:</strong> {answer.correctAnswer}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="student-results-container">
      <div className="page-header">
        <h1>🏆 Kết Quả Học Tập</h1>
        <p>Xem lại các bài kiểm tra đã hoàn thành</p>
      </div>

      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="stats-overview">
        <div className="stat-card">
          <div className="stat-icon">📝</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Bài đã làm</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-value">{stats.avg}%</div>
          <div className="stat-label">Điểm trung bình</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⭐</div>
          <div className="stat-value">{stats.highest}%</div>
          <div className="stat-label">Điểm cao nhất</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📉</div>
          <div className="stat-value">{stats.lowest}%</div>
          <div className="stat-label">Điểm thấp nhất</div>
        </div>
      </div>

      {loading ? (
        <div className="loading">Đang tải...</div>
      ) : (
        <div className="results-list">
          <h2>Danh Sách Kết Quả</h2>
          {results.length === 0 ? (
            <p className="no-data">Bạn chưa hoàn thành bài kiểm tra nào</p>
          ) : (
            <div className="results-grid">
              {results.map((result) => {
                const percentage = (result.score / result.totalQuestions) * 100;
                return (
                  <div key={result._id} className="result-card">
                    <div className="result-header">
                      <h3>{result.quizTitle}</h3>
                      <span 
                        className="grade-badge"
                        style={{ backgroundColor: getScoreColor(percentage) }}
                      >
                        {getGrade(percentage)}
                      </span>
                    </div>
                    <div className="result-score">
                      <div className="score-bar">
                        <div 
                          className="score-fill"
                          style={{ 
                            width: `${percentage}%`,
                            backgroundColor: getScoreColor(percentage)
                          }}
                        ></div>
                      </div>
                      <div className="score-info">
                        <span className="score-points">
                          {result.score}/{result.totalQuestions} câu đúng
                        </span>
                        <span 
                          className="score-percent"
                          style={{ color: getScoreColor(percentage) }}
                        >
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="result-footer">
                      <span className="result-date">
                        📅 {formatDate(result.submittedAt)}
                      </span>
                      <button 
                        onClick={() => viewResultDetail(result)}
                        className="btn btn-primary btn-sm"
                      >
                        Xem chi tiết
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentResults;
