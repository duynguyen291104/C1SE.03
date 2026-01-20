import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './CreateSlide.css';

const CreateSlide = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    courseId: '',
    tags: '',
    status: 'draft'
  });
  
  const [slides, setSlides] = useState([
    {
      order: 1,
      type: 'title',
      title: '',
      content: '',
      backgroundColor: '#ffffff',
      textColor: '#000000',
      layout: 'single'
    }
  ]);
  
  const [savedSlides, setSavedSlides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

  useEffect(() => {
    fetchSlides();
  }, []);

  const fetchSlides = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        setMessage({ text: 'Vui lòng đăng nhập để tạo slides', type: 'error' });
        setTimeout(() => navigate('/login'), 2000);
        return;
      }
      
      const response = await axios.get(`${API_URL}/slides`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSavedSlides(response.data.data);
    } catch (error) {
      console.error('Error fetching slides:', error);
      if (error.response?.status === 401) {
        setMessage({ text: 'Phiên đăng nhập đã hết hạn', type: 'error' });
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        setTimeout(() => navigate('/login'), 2000);
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSlideChange = (index, field, value) => {
    const updatedSlides = [...slides];
    updatedSlides[index][field] = value;
    setSlides(updatedSlides);
  };

  const addSlide = () => {
    setSlides([...slides, {
      order: slides.length + 1,
      type: 'content',
      title: '',
      content: '',
      backgroundColor: '#ffffff',
      textColor: '#000000',
      layout: 'single'
    }]);
  };

  const removeSlide = (index) => {
    const updatedSlides = slides.filter((_, i) => i !== index);
    // Update order
    updatedSlides.forEach((slide, i) => {
      slide.order = i + 1;
    });
    setSlides(updatedSlides);
  };

  const moveSlide = (index, direction) => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === slides.length - 1)
    ) {
      return;
    }

    const updatedSlides = [...slides];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    [updatedSlides[index], updatedSlides[targetIndex]] = 
    [updatedSlides[targetIndex], updatedSlides[index]];

    // Update order
    updatedSlides.forEach((slide, i) => {
      slide.order = i + 1;
    });

    setSlides(updatedSlides);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      setMessage({ text: 'Vui lòng nhập tiêu đề', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const token = localStorage.getItem('accessToken');
      const payload = {
        ...formData,
        slides,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean)
      };

      const response = await axios.post(`${API_URL}/slides`, payload, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      setMessage({ text: 'Tạo slide thành công!', type: 'success' });
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        courseId: '',
        tags: '',
        status: 'draft'
      });
      setSlides([{
        order: 1,
        type: 'title',
        title: '',
        content: '',
        backgroundColor: '#ffffff',
        textColor: '#000000',
        layout: 'single'
      }]);

      // Refresh list
      fetchSlides();
    } catch (error) {
      setMessage({ 
        text: error.response?.data?.message || 'Lỗi khi tạo slide', 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteSlidePresentation = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa slide này?')) return;

    try {
      const token = localStorage.getItem('accessToken');
      await axios.delete(`${API_URL}/slides/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ text: 'Xóa slide thành công!', type: 'success' });
      fetchSlides();
    } catch (error) {
      setMessage({ text: 'Lỗi khi xóa slide', type: 'error' });
    }
  };

  const publishSlide = async (id) => {
    try {
      const token = localStorage.getItem('accessToken');
      await axios.post(`${API_URL}/slides/${id}/publish`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ text: 'Xuất bản slide thành công!', type: 'success' });
      fetchSlides();
    } catch (error) {
      setMessage({ text: 'Lỗi khi xuất bản slide', type: 'error' });
    }
  };

  return (
    <div className="create-slide-container">
      <div className="create-slide-header">
        <h1>📊 Tạo Bài Giảng Slide</h1>
        <p>Tạo và quản lý bài giảng trình chiếu của bạn</p>
      </div>

      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="slide-editor">
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h2>Thông Tin Cơ Bản</h2>
            
            <div className="form-group">
              <label>Tiêu đề <span className="required">*</span></label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Nhập tiêu đề bài giảng"
                required
              />
            </div>

            <div className="form-group">
              <label>Mô tả</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Mô tả ngắn về bài giảng"
                rows="3"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Tags</label>
                <input
                  type="text"
                  name="tags"
                  value={formData.tags}
                  onChange={handleInputChange}
                  placeholder="Ví dụ: toán học, đại số, lớp 10"
                />
                <small>Phân cách bằng dấu phẩy</small>
              </div>

              <div className="form-group">
                <label>Trạng thái</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                >
                  <option value="draft">Bản nháp</option>
                  <option value="published">Xuất bản</option>
                </select>
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="section-header">
              <h2>Nội Dung Slides ({slides.length} slide)</h2>
              <button type="button" onClick={addSlide} className="btn-add-slide">
                ➕ Thêm Slide
              </button>
            </div>

            <div className="slides-list">
              {slides.map((slide, index) => (
                <div key={index} className="slide-item">
                  <div className="slide-item-header">
                    <h3>Slide {index + 1}</h3>
                    <div className="slide-controls">
                      <button
                        type="button"
                        onClick={() => moveSlide(index, 'up')}
                        disabled={index === 0}
                        title="Di chuyển lên"
                      >
                        ⬆️
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSlide(index, 'down')}
                        disabled={index === slides.length - 1}
                        title="Di chuyển xuống"
                      >
                        ⬇️
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSlide(index)}
                        disabled={slides.length === 1}
                        className="btn-remove"
                        title="Xóa slide"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Loại slide</label>
                      <select
                        value={slide.type}
                        onChange={(e) => handleSlideChange(index, 'type', e.target.value)}
                      >
                        <option value="title">Tiêu đề</option>
                        <option value="content">Nội dung</option>
                        <option value="image">Hình ảnh</option>
                        <option value="video">Video</option>
                        <option value="code">Code</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Layout</label>
                      <select
                        value={slide.layout}
                        onChange={(e) => handleSlideChange(index, 'layout', e.target.value)}
                      >
                        <option value="single">Một cột</option>
                        <option value="two-column">Hai cột</option>
                        <option value="three-column">Ba cột</option>
                        <option value="grid">Lưới</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Tiêu đề slide</label>
                    <input
                      type="text"
                      value={slide.title}
                      onChange={(e) => handleSlideChange(index, 'title', e.target.value)}
                      placeholder="Tiêu đề của slide này"
                    />
                  </div>

                  <div className="form-group">
                    <label>Nội dung</label>
                    <textarea
                      value={slide.content}
                      onChange={(e) => handleSlideChange(index, 'content', e.target.value)}
                      placeholder="Nội dung chi tiết của slide"
                      rows="4"
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Màu nền</label>
                      <input
                        type="color"
                        value={slide.backgroundColor}
                        onChange={(e) => handleSlideChange(index, 'backgroundColor', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label>Màu chữ</label>
                      <input
                        type="color"
                        value={slide.textColor}
                        onChange={(e) => handleSlideChange(index, 'textColor', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Đang lưu...' : '💾 Lưu Bài Giảng'}
            </button>
          </div>
        </form>
      </div>

      <div className="saved-slides-section">
        <h2>Bài Giảng Đã Tạo ({savedSlides.length})</h2>
        
        {savedSlides.length === 0 ? (
          <p className="empty-state">Chưa có bài giảng nào. Tạo bài giảng đầu tiên của bạn!</p>
        ) : (
          <div className="slides-grid">
            {savedSlides.map((slide) => (
              <div key={slide._id} className="slide-card">
                <div className="slide-card-header">
                  <h3>{slide.title}</h3>
                  <span className={`status-badge ${slide.status}`}>
                    {slide.status === 'draft' ? '📝 Nháp' : '✅ Đã xuất bản'}
                  </span>
                </div>
                
                <p className="slide-description">{slide.description || 'Không có mô tả'}</p>
                
                <div className="slide-meta">
                  <span>📄 {slide.slides?.length || 0} slides</span>
                  <span>👁️ {slide.views || 0} lượt xem</span>
                </div>

                {slide.tags && slide.tags.length > 0 && (
                  <div className="slide-tags">
                    {slide.tags.map((tag, idx) => (
                      <span key={idx} className="tag">{tag}</span>
                    ))}
                  </div>
                )}

                <div className="slide-card-actions">
                  <button className="btn-edit">✏️ Sửa</button>
                  {slide.status === 'draft' && (
                    <button 
                      onClick={() => publishSlide(slide._id)}
                      className="btn-publish"
                    >
                      📢 Xuất bản
                    </button>
                  )}
                  <button 
                    onClick={() => deleteSlidePresentation(slide._id)}
                    className="btn-delete"
                  >
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

export default CreateSlide;
