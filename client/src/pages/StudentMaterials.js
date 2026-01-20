import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './StudentMaterials.css';

const StudentMaterials = () => {
  const navigate = useNavigate();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [selectedCategory, setSelectedCategory] = useState('all');

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        setMessage({ text: 'Vui lòng đăng nhập để xem tài liệu', type: 'error' });
        setTimeout(() => navigate('/login'), 2000);
        return;
      }

      setLoading(true);
      const response = await axios.get(`${API_URL}/materials`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMaterials(response.data.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching materials:', error);
      setLoading(false);
      
      if (error.response?.status === 401) {
        setMessage({ text: 'Phiên đăng nhập đã hết hạn', type: 'error' });
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setMessage({ text: 'Không thể tải danh sách tài liệu', type: 'error' });
      }
    }
  };

  const downloadMaterial = async (materialId, filename) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(
        `${API_URL}/materials/${materialId}/download`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setMessage({ text: 'Tải xuống thành công', type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (error) {
      console.error('Error downloading material:', error);
      setMessage({ text: 'Lỗi khi tải xuống tài liệu', type: 'error' });
    }
  };

  const viewMaterial = (fileUrl) => {
    window.open(fileUrl, '_blank');
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
      pdf: '📄',
      doc: '📝',
      docx: '📝',
      ppt: '📊',
      pptx: '📊',
      xls: '📈',
      xlsx: '📈',
      jpg: '🖼️',
      jpeg: '🖼️',
      png: '🖼️',
      mp4: '🎥',
      mp3: '🎵',
      zip: '📦',
      rar: '📦'
    };
    return icons[ext] || '📎';
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN');
  };

  const categories = ['all', 'lecture', 'assignment', 'reference', 'other'];
  const categoryNames = {
    all: 'Tất cả',
    lecture: 'Bài giảng',
    assignment: 'Bài tập',
    reference: 'Tài liệu tham khảo',
    other: 'Khác'
  };

  const filteredMaterials = selectedCategory === 'all'
    ? materials
    : materials.filter(m => m.category === selectedCategory);

  return (
    <div className="student-materials-container">
      <div className="page-header">
        <h1>📚 Tài Liệu Học Tập</h1>
        <p>Danh sách tài liệu từ giảng viên</p>
      </div>

      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="category-filter">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`filter-btn ${selectedCategory === cat ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {categoryNames[cat]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading">Đang tải...</div>
      ) : (
        <div className="materials-grid">
          {filteredMaterials.length === 0 ? (
            <p className="no-data">Chưa có tài liệu nào</p>
          ) : (
            filteredMaterials.map((material) => (
              <div key={material._id} className="material-card">
                <div className="material-icon">
                  {getFileIcon(material.filename)}
                </div>
                <div className="material-info">
                  <h3>{material.title}</h3>
                  <p className="material-description">{material.description}</p>
                  <div className="material-meta">
                    <span>📁 {material.filename}</span>
                    <span>📊 {formatFileSize(material.fileSize)}</span>
                    <span>📅 {formatDate(material.createdAt)}</span>
                  </div>
                  <div className="material-category">
                    <span className={`badge badge-${material.category}`}>
                      {categoryNames[material.category]}
                    </span>
                  </div>
                </div>
                <div className="material-actions">
                  <button
                    onClick={() => viewMaterial(material.fileUrl)}
                    className="btn btn-secondary"
                  >
                    👁️ Xem
                  </button>
                  <button
                    onClick={() => downloadMaterial(material._id, material.filename)}
                    className="btn btn-primary"
                  >
                    ⬇️ Tải xuống
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default StudentMaterials;
