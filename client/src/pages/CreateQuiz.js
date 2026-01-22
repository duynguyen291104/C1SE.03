import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './CreateQuiz.css';

const CreateQuiz = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    instructions: '',
    duration: 30,
    passingScore: 60,
    tags: ''
  });
  
  const [questions, setQuestions] = useState([]);
  const [savedQuizzes, setSavedQuizzes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [editMode, setEditMode] = useState(false);
  const [editingQuizId, setEditingQuizId] = useState(null);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        setMessage({ text: 'Vui lòng đăng nhập để tạo quiz', type: 'error' });
        setTimeout(() => navigate('/login'), 2000);
        return;
      }
      
      const response = await axios.get(`${API_URL}/quizzes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSavedQuizzes(response.data.data);
    } catch (error) {
      console.error('Error fetching quizzes:', error);
      if (error.response?.status === 401) {
        setMessage({ text: 'Phiên đăng nhập đã hết hạn', type: 'error' });
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        setTimeout(() => navigate('/login'), 2000);
      }
    }
  };

  const loadQuizForEdit = async (quizId) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(`${API_URL}/quizzes/${quizId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const quiz = response.data.data;
      
      // Populate form data
      setFormData({
        title: quiz.title || '',
        description: quiz.description || '',
        instructions: quiz.instructions || '',
        duration: quiz.duration || 30,
        passingScore: quiz.passingScore || 60,
        tags: quiz.tags?.join(', ') || ''
      });
      
      // Populate questions
      setQuestions(quiz.questions || []);
      
      // Set edit mode
      setEditMode(true);
      setEditingQuizId(quizId);
      
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      setMessage({ text: 'Đang chỉnh sửa quiz', type: 'success' });
    } catch (error) {
      setMessage({ text: 'Lỗi khi tải quiz để chỉnh sửa', type: 'error' });
    }
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditingQuizId(null);
    setFormData({
      title: '',
      description: '',
      instructions: '',
      duration: 30,
      passingScore: 60,
      tags: ''
    });
    setQuestions([]);
    setMessage({ text: '', type: '' });
  };

  const addQuestion = () => {
    setQuestions([...questions, {
      order: questions.length + 1,
      type: 'multiple-choice',
      question: '',
      points: 1,
      options: [
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false }
      ],
      explanation: ''
    }]);
  };

  const updateQuestion = (index, field, value) => {
    const updated = [...questions];
    updated[index][field] = value;
    setQuestions(updated);
  };

  const updateOption = (qIndex, oIndex, field, value) => {
    const updated = [...questions];
    if (field === 'isCorrect' && value) {
      // Uncheck other options for multiple choice
      updated[qIndex].options.forEach((opt, idx) => {
        opt.isCorrect = idx === oIndex;
      });
    } else {
      updated[qIndex].options[oIndex][field] = value;
    }
    setQuestions(updated);
  };

  const removeQuestion = (index) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim() || questions.length === 0) {
      setMessage({ text: 'Vui lòng nhập tiêu đề và thêm câu hỏi', type: 'error' });
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('accessToken');
      const payload = {
        ...formData,
        questions,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        settings: {
          shuffleQuestions: false,
          shuffleOptions: false,
          showCorrectAnswers: true,
          allowReview: true,
          maxAttempts: 3,
          showResultsImmediately: true
        }
      };

      if (editMode && editingQuizId) {
        // Update existing quiz
        await axios.put(`${API_URL}/quizzes/${editingQuizId}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessage({ text: 'Cập nhật quiz thành công!', type: 'success' });
      } else {
        // Create new quiz
        await axios.post(`${API_URL}/quizzes`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessage({ text: 'Tạo quiz thành công!', type: 'success' });
      }
      
      // Reset
      setEditMode(false);
      setEditingQuizId(null);
      setFormData({
        title: '',
        description: '',
        instructions: '',
        duration: 30,
        passingScore: 60,
        tags: ''
      });
      setQuestions([]);
      fetchQuizzes();
    } catch (error) {
      setMessage({ text: error.response?.data?.message || `Lỗi khi ${editMode ? 'cập nhật' : 'tạo'} quiz`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const deleteQuiz = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa quiz này?')) return;

    try {
      const token = localStorage.getItem('accessToken');
      await axios.delete(`${API_URL}/quizzes/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ text: 'Xóa quiz thành công!', type: 'success' });
      fetchQuizzes();
    } catch (error) {
      setMessage({ text: 'Lỗi khi xóa quiz', type: 'error' });
    }
  };

  const publishQuiz = async (id) => {
    try {
      const token = localStorage.getItem('accessToken');
      await axios.post(`${API_URL}/quizzes/${id}/publish`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ text: 'Xuất bản quiz thành công!', type: 'success' });
      fetchQuizzes();
    } catch (error) {
      setMessage({ text: 'Lỗi khi xuất bản quiz', type: 'error' });
    }
  };

  return (
    <div className="create-quiz-container">
      <div className="create-quiz-header">
        <h1>{editMode ? '✏️ Chỉnh Sửa Bài Kiểm Tra / Quiz' : '📝 Tạo Bài Kiểm Tra / Quiz'}</h1>
        <p>{editMode ? 'Chỉnh sửa và cập nhật bài kiểm tra' : 'Tạo bài kiểm tra và đánh giá kiến thức học sinh'}</p>
      </div>

      {message.text && (
        <div className={`message ${message.type}`}>{message.text}</div>
      )}

      <div className="quiz-editor">
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h2>Thông Tin Quiz</h2>
            
            <div className="form-group">
              <label>Tiêu đề <span className="required">*</span></label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="Nhập tiêu đề bài kiểm tra"
                required
              />
            </div>

            <div className="form-group">
              <label>Mô tả</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Mô tả về bài kiểm tra"
                rows="3"
              />
            </div>

            <div className="form-group">
              <label>Hướng dẫn làm bài</label>
              <textarea
                value={formData.instructions}
                onChange={(e) => setFormData({...formData, instructions: e.target.value})}
                placeholder="Các hướng dẫn cho học sinh"
                rows="2"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Thời gian (phút)</label>
                <input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({...formData, duration: parseInt(e.target.value)})}
                  min="1"
                />
              </div>

              <div className="form-group">
                <label>Điểm đạt (%)</label>
                <input
                  type="number"
                  value={formData.passingScore}
                  onChange={(e) => setFormData({...formData, passingScore: parseInt(e.target.value)})}
                  min="0"
                  max="100"
                />
              </div>

              <div className="form-group">
                <label>Tags</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({...formData, tags: e.target.value})}
                  placeholder="toán, lý, hóa"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="section-header">
              <h2>Câu Hỏi ({questions.length})</h2>
              <button type="button" onClick={addQuestion} className="btn-add">
                ➕ Thêm Câu Hỏi
              </button>
            </div>

            {questions.length === 0 ? (
              <p className="empty-state">Chưa có câu hỏi. Nhấn "Thêm Câu Hỏi" để bắt đầu.</p>
            ) : (
              <div className="questions-list">
                {questions.map((q, qIdx) => (
                  <div key={qIdx} className="question-item">
                    <div className="question-header">
                      <h3>Câu {qIdx + 1}</h3>
                      <button
                        type="button"
                        onClick={() => removeQuestion(qIdx)}
                        className="btn-remove"
                      >
                        🗑️
                      </button>
                    </div>

                    <div className="form-group">
                      <label>Câu hỏi</label>
                      <textarea
                        value={q.question}
                        onChange={(e) => updateQuestion(qIdx, 'question', e.target.value)}
                        placeholder="Nhập nội dung câu hỏi"
                        rows="2"
                        required
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Loại câu hỏi</label>
                        <select
                          value={q.type}
                          onChange={(e) => updateQuestion(qIdx, 'type', e.target.value)}
                        >
                          <option value="multiple-choice">Trắc nghiệm</option>
                          <option value="true-false">Đúng/Sai</option>
                          <option value="short-answer">Tự luận ngắn</option>
                          <option value="essay">Tự luận dài</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Điểm</label>
                        <input
                          type="number"
                          value={q.points}
                          onChange={(e) => updateQuestion(qIdx, 'points', parseInt(e.target.value))}
                          min="1"
                        />
                      </div>
                    </div>

                    {q.type === 'multiple-choice' && (
                      <div className="options-section">
                        <label>Các lựa chọn</label>
                        {q.options.map((opt, oIdx) => (
                          <div key={oIdx} className="option-item">
                            <input
                              type="radio"
                              name={`correct-${qIdx}`}
                              checked={opt.isCorrect}
                              onChange={(e) => updateOption(qIdx, oIdx, 'isCorrect', e.target.checked)}
                            />
                            <input
                              type="text"
                              value={opt.text}
                              onChange={(e) => updateOption(qIdx, oIdx, 'text', e.target.value)}
                              placeholder={`Lựa chọn ${String.fromCharCode(65 + oIdx)}`}
                              className="option-input"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="form-group">
                      <label>Giải thích đáp án</label>
                      <textarea
                        value={q.explanation}
                        onChange={(e) => updateQuestion(qIdx, 'explanation', e.target.value)}
                        placeholder="Giải thích đáp án đúng"
                        rows="2"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-actions">
            {editMode && (
              <button type="button" onClick={cancelEdit} className="btn-secondary" disabled={loading}>
                ❌ Hủy Chỉnh Sửa
              </button>
            )}
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Đang lưu...' : (editMode ? '💾 Cập Nhật Quiz' : '💾 Lưu Quiz')}
            </button>
          </div>
        </form>
      </div>

      <div className="saved-quizzes-section">
        <h2>Quiz Đã Tạo ({savedQuizzes.length})</h2>
        
        {savedQuizzes.length === 0 ? (
          <p className="empty-state">Chưa có quiz nào.</p>
        ) : (
          <div className="quizzes-grid">
            {savedQuizzes.map((quiz) => (
              <div key={quiz._id} className="quiz-card">
                <div className="quiz-card-header">
                  <h3>{quiz.title}</h3>
                  <span className={`status-badge ${quiz.status}`}>
                    {quiz.status === 'draft' ? '📝 Nháp' : '✅ Đã xuất bản'}
                  </span>
                </div>
                
                <p>{quiz.description || 'Không có mô tả'}</p>
                
                <div className="quiz-meta">
                  <span>❓ {quiz.questions?.length || 0} câu hỏi</span>
                  <span>⏱️ {quiz.duration} phút</span>
                  <span>🎯 {quiz.passingScore}% đạt</span>
                </div>

                <div className="quiz-card-actions">
                  <button onClick={() => loadQuizForEdit(quiz._id)} className="btn-edit">✏️ Sửa</button>
                  {quiz.status === 'draft' && (
                    <button onClick={() => publishQuiz(quiz._id)} className="btn-publish">
                      📢 Xuất bản
                    </button>
                  )}
                  <button onClick={() => deleteQuiz(quiz._id)} className="btn-delete">
                    🗑️ Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateQuiz;
