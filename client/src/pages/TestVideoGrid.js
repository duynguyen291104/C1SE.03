import React, { useState, useEffect, useRef } from 'react';
import VideoGrid from '../components/VideoGrid';
import './TestVideoGrid.css';

/**
 * Trang test để xem layout VideoGrid với số lượng video khác nhau
 */
const TestVideoGrid = () => {
  const [participantCount, setParticipantCount] = useState(4);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const videoRefs = useRef([]);

  // Tạo fake streams
  useEffect(() => {
    // Tạo local stream (video giả)
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    
    // Draw local video
    ctx.fillStyle = '#3498db';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('YOU', canvas.width / 2, canvas.height / 2);
    
    const stream = canvas.captureStream(30);
    setLocalStream(stream);
    
    // Cleanup
    return () => {
      stream.getTracks().forEach(track => track.stop());
    };
  }, []);

  // Tạo remote streams dựa trên số lượng
  useEffect(() => {
    const newRemoteStreams = new Map();
    
    for (let i = 0; i < participantCount - 1; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      
      // Random colors
      const colors = ['#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#34495e'];
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'white';
      ctx.font = '48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`Student ${i + 1}`, canvas.width / 2, canvas.height / 2);
      
      const stream = canvas.captureStream(30);
      newRemoteStreams.set(`user-${i}`, {
        stream,
        userName: `Student ${i + 1}`,
        userId: `user-${i}`,
        cameraEnabled: i % 5 !== 0, // Mỗi người thứ 5 tắt camera
        micEnabled: i % 3 !== 0 // Mỗi người thứ 3 tắt mic
      });
    }
    
    setRemoteStreams(newRemoteStreams);
    
    // Cleanup
    return () => {
      newRemoteStreams.forEach(({ stream }) => {
        stream.getTracks().forEach(track => track.stop());
      });
    };
  }, [participantCount]);

  return (
    <div className="test-video-grid-page">
      <div className="test-header">
        <h1>🧪 Test Video Grid Layout</h1>
        <div className="test-controls">
          <label>
            Số người tham gia: <strong>{participantCount}</strong>
          </label>
          <input
            type="range"
            min="1"
            max="30"
            value={participantCount}
            onChange={(e) => setParticipantCount(parseInt(e.target.value))}
            className="participant-slider"
          />
          <div className="quick-actions">
            <button onClick={() => setParticipantCount(1)}>1 người</button>
            <button onClick={() => setParticipantCount(2)}>2 người</button>
            <button onClick={() => setParticipantCount(3)}>3 người</button>
            <button onClick={() => setParticipantCount(4)}>4 người</button>
            <button onClick={() => setParticipantCount(6)}>6 người</button>
            <button onClick={() => setParticipantCount(9)}>9 người</button>
            <button onClick={() => setParticipantCount(12)}>12 người</button>
            <button onClick={() => setParticipantCount(16)}>16 người</button>
            <button onClick={() => setParticipantCount(20)}>20 người</button>
            <button onClick={() => setParticipantCount(25)}>25 người</button>
          </div>
        </div>
        <div className="test-info">
          <p>
            ℹ️ Chức năng: Tự động chia màn hình dựa trên số lượng người.
            Tối đa 16 video trong grid chính. Người còn lại hiển thị trong sidebar bên phải.
          </p>
        </div>
      </div>

      <div className="test-video-container">
        <VideoGrid
          localStream={localStream}
          remoteStreams={remoteStreams}
          localUserName="Bạn (Teacher)"
          isCameraOn={true}
          isMicOn={true}
          onPinVideo={(userId) => console.log('Pinned user:', userId)}
        />
      </div>
    </div>
  );
};

export default TestVideoGrid;
