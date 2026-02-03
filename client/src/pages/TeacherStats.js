import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './TeacherStats.css';

const TeacherStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(`${API_URL}/teacher/stats/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setError('Không thể tải thống kê');
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Đang tải thống kê...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="teacher-stats-container">
      <div className="stats-header">
        <h1>📊 Thống kê Dashboard Giáo viên</h1>
        <Link to="/teacher/dashboard" className="btn-back">← Quay lại</Link>
      </div>

      {stats && (
        <>
          {/* Overview Statistics */}
          <div className="stats-overview">
            <h2>Tổng quan</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-info">
                  <div className="stat-value">{stats.overview.totalStudents}</div>
                  <div className="stat-label">Học sinh</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">📝</div>
                <div className="stat-info">
                  <div className="stat-value">{stats.overview.totalQuizzes}</div>
                  <div className="stat-label">Bài kiểm tra</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">✍️</div>
                <div className="stat-info">
                  <div className="stat-value">{stats.overview.totalAttempts}</div>
                  <div className="stat-label">Lượt làm bài</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">📈</div>
                <div className="stat-info">
                  <div className="stat-value">{stats.overview.averageScore}%</div>
                  <div className="stat-label">Điểm trung bình</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">✅</div>
                <div className="stat-info">
                  <div className="stat-value">{stats.overview.passRate}%</div>
                  <div className="stat-label">Tỷ lệ đậu</div>
                </div>
              </div>
            </div>
          </div>

          {/* Frequently Wrong Questions */}
          <div className="stats-section">
            <h2>❌ Câu hỏi học sinh hay sai nhất</h2>
            {stats.frequentlyWrongQuestions.length > 0 ? (
              <div className="table-container">
                <table className="stats-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Câu hỏi</th>
                      <th>Bài kiểm tra</th>
                      <th>Tổng lượt làm</th>
                      <th>Số lượt sai</th>
                      <th>Tỷ lệ sai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.frequentlyWrongQuestions.map((question, index) => (
                      <tr key={question.questionId}>
                        <td>{index + 1}</td>
                        <td className="question-text">{question.questionText}</td>
                        <td>{question.quizTitle}</td>
                        <td>{question.totalAttempts}</td>
                        <td className="wrong-count">{question.wrongAttempts}</td>
                        <td>
                          <div className="progress-bar">
                            <div 
                              className="progress-fill wrong"
                              style={{ width: `${question.wrongRate}%` }}
                            >
                              {question.wrongRate}%
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="no-data">Chưa có dữ liệu</p>
            )}
          </div>

          {/* Low Performance Topics */}
          <div className="stats-section">
            <h2>📉 Chủ đề có tỷ lệ thấp</h2>
            {stats.lowPerformanceTopics.length > 0 ? (
              <div className="topics-grid">
                {stats.lowPerformanceTopics.map((topic, index) => (
                  <div key={topic.topic} className="topic-card">
                    <div className="topic-rank">#{index + 1}</div>
                    <div className="topic-name">{topic.topic}</div>
                    <div className="topic-stats">
                      <div className="topic-stat">
                        <span className="label">Tổng lượt:</span>
                        <span className="value">{topic.totalAttempts}</span>
                      </div>
                      <div className="topic-stat">
                        <span className="label">Số lượt sai:</span>
                        <span className="value wrong">{topic.wrongAttempts}</span>
                      </div>
                    </div>
                    <div className="topic-progress">
                      <div 
                        className="topic-progress-bar"
                        style={{ 
                          width: `${topic.wrongRate}%`,
                          backgroundColor: topic.wrongRate > 50 ? '#ff4444' : '#ff9800'
                        }}
                      >
                        {topic.wrongRate}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-data">Chưa có dữ liệu</p>
            )}
          </div>

          {/* Recommendations */}
          <div className="stats-section recommendations">
            <h2>💡 Đề xuất cải thiện</h2>
            <ul className="recommendation-list">
              {stats.frequentlyWrongQuestions.length > 0 && (
                <li>
                  Xem xét lại các câu hỏi có tỷ lệ sai cao để điều chỉnh độ khó hoặc làm rõ đề bài.
                </li>
              )}
              {stats.lowPerformanceTopics.length > 0 && (
                <li>
                  Tập trung giảng dạy thêm về các chủ đề: {stats.lowPerformanceTopics.slice(0, 3).map(t => t.topic).join(', ')}.
                </li>
              )}
              {stats.overview.passRate < 60 && (
                <li>
                  Tỷ lệ đậu thấp ({stats.overview.passRate}%). Cân nhắc điều chỉnh độ khó hoặc thêm tài liệu học tập.
                </li>
              )}
              {stats.overview.averageScore < 50 && (
                <li>
                  Điểm trung bình thấp ({stats.overview.averageScore}%). Nên xem xét lại nội dung bài giảng và phương pháp đánh giá.
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default TeacherStats;
