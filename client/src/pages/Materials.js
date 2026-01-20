import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Materials.css';

const Materials = () => {
  const navigate = useNavigate();
  const [materials, setMaterials] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'document',
    category: 'lecture',
    access: 'course-only',
    downloadable: true,
    externalUrl: '',
    tags: ''
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [filter, setFilter] = useState({ type: '', category: '', status: '' });

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

  useEffect(() => {
    fetchMaterials();
  }, [filter]);

  const fetchMaterials = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        setMessage({ text: 'Vui lòng đăng nhập để xem tài liệu', type: 'error' });
        setTimeout(() => navigate('/login'), 2000);
        return;
      }
      
      const params = new URLSearchParams();
      if (filter.type) params.append('type', filter.type);
      if (filter.category) params.append('category', filter.category);
      if (filter.status) params.append('status', filter.status);

      const response = await axios.get(`${API_URL}/materials?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMaterials(response.data.data);
    } catch (error) {
      console.error('Error fetching materials:', error);
      if (error.response?.status === 401) {
        setMessage({ text: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại', type: 'error' });
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        setTimeout(() => navigate('/login'), 2000);
      }
    }
  };

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title) {
      setMessage({ text: 'Vui lòng nhập tiêu đề', type: 'error' });
      return;
    }

    setUploading(true);
    setMessage({ text: '', type: '' });

    try {
      const token = localStorage.getItem('accessToken');
      const submitData = new FormData();
      
      Object.keys(formData).forEach(key => {
        if (formData[key]) submitData.append(key, formData[key]);
      });

      if (selectedFile) {
        submitData.append('file', selectedFile);
      }

      await axios.post(`${API_URL}/materials`, submitData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setMessage({ text: 'Upload tài liệu thành công!', type: 'success' });
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        type: 'document',
        category: 'lecture',
        access: 'course-only',
        downloadable: true,
        externalUrl: '',
        tags: ''
      });
      setSelectedFile(null);
      fetchMaterials();
    } catch (error) {
      setMessage({ text: error.response?.data?.message || 'Lỗi khi upload', type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const publishMaterial = async (id) => {
    try {
      const token = localStorage.getItem('accessToken');
      await axios.post(`${API_URL}/materials/${id}/publish`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ text: 'Xuất bản tài liệu thành công!', type: 'success' });
      fetchMaterials();
    } catch (error) {
      setMessage({ text: 'Lỗi khi xuất bản', type: 'error' });
    }
  };

  const deleteMaterial = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa tài liệu này?')) return;

    try {
      const token = localStorage.getItem('accessToken');
      await axios.delete(`${API_URL}/materials/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ text: 'Xóa tài liệu thành công!', type: 'success' });
      fetchMaterials();
    } catch (error) {
      setMessage({ text: 'Lỗi khi xóa', type: 'error' });
    }
  };

  const getTypeIcon = (type) => {
    const icons = {
      document: '📄',
      video: '🎥',
      audio: '🎵',
      image: '🖼️',
      link: '🔗',
      slide: '📊',
      quiz: '📝',
      assignment: '✍️'
    };
    return icons[type] || '📦';
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    const mb = (bytes / (1024 * 1024)).toFixed(2);
    return `${mb} MB`;
  };

  return (
    <div className="materials-container">
      <div className="materials-header">
        <h1>📚 Quản Lý Tài Liệu Học Tập</h1>
        <p>Upload và quản lý tài liệu, video, bài giảng</p>
      </div>

      {message.text && (
        <div className={`message ${message.type}`}>{message.text}</div>
      )}

      <div className="materials-upload">
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h2>Upload Tài Liệu Mới</h2>
            
            <div className="form-row">
              <div className="form-group">
                <label>Loại tài liệu</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                >
                  <option value="document">Tài liệu</option>
                  <option value="video">Video</option>
                  <option value="audio">Audio</option>
                  <option value="image">Hình ảnh</option>
                  <option value="link">Liên kết</option>
                </select>
              </div>

              <div className="form-group">
                <label>Phân loại</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                >
                  <option value="lecture">Bài giảng</option>
                  <option value="reading">Tài liệu đọc</option>
                  <option value="exercise">Bài tập</option>
                  <option value="reference">Tham khảo</option>
                  <option value="supplementary">Bổ sung</option>
                  <option value="other">Khác</option>
                </select>
              </div>

              <div className="form-group">
                <label>Quyền truy cập</label>
                <select
                  value={formData.access}
                  onChange={(e) => setFormData({...formData, access: e.target.value})}
                >
                  <option value="public">Công khai</option>
                  <option value="course-only">Chỉ khóa học</option>
                  <option value="private">Riêng tư</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Tiêu đề <span className="required">*</span></label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="Nhập tiêu đề tài liệu"
                required
              />
            </div>

            <div className="form-group">
              <label>Mô tả</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Mô tả ngắn về tài liệu"
                rows="3"
              />
            </div>

            {formData.type === 'link' ? (
              <div className="form-group">
                <label>URL</label>
                <input
                  type="url"
                  value={formData.externalUrl}
                  onChange={(e) => setFormData({...formData, externalUrl: e.target.value})}
                  placeholder="https://example.com/document"
                />
              </div>
            ) : (
              <div className="form-group">
                <label>Chọn file</label>
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept={formData.type === 'video' ? 'video/*' : formData.type === 'audio' ? 'audio/*' : formData.type === 'image' ? 'image/*' : '*'}
                />
                {selectedFile && (
                  <small className="file-info">
                    📎 {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </small>
                )}
              </div>
            )}

            <div className="form-group">
              <label>Tags</label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({...formData, tags: e.target.value})}
                placeholder="toán, lý, hóa"
              />
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.downloadable}
                  onChange={(e) => setFormData({...formData, downloadable: e.target.checked})}
                />
                📥 Cho phép tải xuống
              </label>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" disabled={uploading} className="btn-primary">
              {uploading ? '📤 Đang upload...' : '📤 Upload Tài Liệu'}
            </button>
          </div>
        </form>
      </div>

      <div className="materials-list-section">
        <div className="list-header">
          <h2>Tài Liệu Đã Upload ({materials.length})</h2>
          
          <div className="filters">
            <select
              value={filter.type}
              onChange={(e) => setFilter({...filter, type: e.target.value})}
              className="filter-select"
            >
              <option value="">Tất cả loại</option>
              <option value="document">Tài liệu</option>
              <option value="video">Video</option>
              <option value="audio">Audio</option>
              <option value="image">Hình ảnh</option>
              <option value="link">Liên kết</option>
            </select>

            <select
              value={filter.category}
              onChange={(e) => setFilter({...filter, category: e.target.value})}
              className="filter-select"
            >
              <option value="">Tất cả phân loại</option>
              <option value="lecture">Bài giảng</option>
              <option value="reading">Tài liệu đọc</option>
              <option value="exercise">Bài tập</option>
              <option value="reference">Tham khảo</option>
            </select>

            <select
              value={filter.status}
              onChange={(e) => setFilter({...filter, status: e.target.value})}
              className="filter-select"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="draft">Bản nháp</option>
              <option value="published">Đã xuất bản</option>
            </select>
          </div>
        </div>

        {materials.length === 0 ? (
          <p className="empty-state">Chưa có tài liệu nào.</p>
        ) : (
          <div className="materials-grid">
            {materials.map((material) => (
              <div key={material._id} className="material-card">
                <div className="material-icon">
                  {getTypeIcon(material.type)}
                </div>
                
                <div className="material-content">
                  <div className="material-header">
                    <h3>{material.title}</h3>
                    <span className={`status-badge ${material.status}`}>
                      {material.status === 'draft' ? '📝 Nháp' : '✅ Đã xuất bản'}
                    </span>
                  </div>

                  <p className="material-description">
                    {material.description || 'Không có mô tả'}
                  </p>

                  <div className="material-meta">
                    <span className="badge">{material.type}</span>
                    <span className="badge">{material.category}</span>
                    <span className="badge">{material.access}</span>
                  </div>

                  <div className="material-stats">
                    <span>👁️ {material.views || 0} lượt xem</span>
                    <span>📥 {material.downloads || 0} lượt tải</span>
                    {material.file && (
                      <span>📦 {formatFileSize(material.file.size)}</span>
                    )}
                  </div>

                  <div className="material-actions">
                    <button className="btn-edit">✏️ Sửa</button>
                    {material.status === 'draft' && (
                      <button 
                        onClick={() => publishMaterial(material._id)}
                        className="btn-publish"
                      >
                        📢 Xuất bản
                      </button>
                    )}
                    {material.file && (
                      <button className="btn-download">⬇️ Tải</button>
                    )}
                    <button 
                      onClick={() => deleteMaterial(material._id)}
                      className="btn-delete"
                    >
                      🗑️ Xóa
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Materials;
