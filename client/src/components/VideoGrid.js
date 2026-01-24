import React, { useRef, useEffect, useState } from 'react';
import './VideoGrid.css';

/**
 * Component hiển thị video cho 1 người - LUÔN render dù có stream hay không
 */
const VideoTile = ({ stream, userName, isMuted, isLocal, isScreenShare, cameraEnabled = true, isPinned, onPin, isInSidebar = false }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Luôn hiển thị khung, dù có stream hay không
  const hasVideo = stream && cameraEnabled;

  return (
    <div className={`video-tile ${isLocal ? 'local' : 'remote'} ${isScreenShare ? 'screenshare' : ''} ${isPinned ? 'pinned' : ''} ${isInSidebar ? 'sidebar-tile' : ''}`}>
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal || isMuted}
          className="video-element"
        />
      ) : (
        <div className="camera-off">
          <div className="camera-off-icon">👤</div>
          <div className="user-name-large">{userName}</div>
          <div className="camera-off-text">Camera OFF</div>
        </div>
      )}
      <div className="video-overlay">
        <span className="user-name">{userName} {isLocal && '(You)'}</span>
        <div className="video-controls">
          {isMuted && <span className="muted-icon">🔇</span>}
          {!cameraEnabled && <span className="camera-icon">📷❌</span>}
          {onPin && !isLocal && (
            <button 
              className="pin-button" 
              onClick={onPin}
              title={isPinned ? "Unpin video" : "Pin video"}
            >
              {isPinned ? '📌' : '📍'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Grid layout cho nhiều video
 * Auto layout dựa trên số lượng người
 * Tối đa 16 video trong grid, phần còn lại hiển thị trong sidebar
 * 
 * QUAN TRỌNG: Render dựa trên PARTICIPANTS, không phải streams
 * Mỗi participant sẽ có 1 khung, dù có stream hay không
 */
const VideoGrid = ({ 
  localStream, 
  remoteStreams, 
  participants = [], // Danh sách tất cả người tham gia
  currentUserId, // ID của user hiện tại
  localUserName, 
  isCameraOn = true, 
  isMicOn = true,
  pinnedUserId = null,
  onPinVideo 
}) => {
  const MAX_GRID_VIDEOS = 16; // Tối đa 16 video trong grid chính
  
  // Tính tổng số người dựa trên participants (KHÔNG phải streams)
  const totalVideos = participants.length;
  const hasOverflow = totalVideos > MAX_GRID_VIDEOS;
  const [showSidebar, setShowSidebar] = useState(hasOverflow);

  // Auto-open sidebar when overflow
  useEffect(() => {
    if (hasOverflow) {
      setShowSidebar(true);
    }
  }, [hasOverflow]);

  // Tạo danh sách videos dựa trên PARTICIPANTS (không phải streams)
  // Mỗi participant sẽ có 1 ô, tìm stream tương ứng nếu có
  const allVideos = participants.map(participant => {
    const isLocal = participant.userId === currentUserId;
    
    // Tìm stream tương ứng
    let stream = null;
    let cameraEnabled = true;
    let micEnabled = true;
    
    if (isLocal) {
      stream = localStream;
      cameraEnabled = isCameraOn;
      micEnabled = isMicOn;
    } else {
      // Tìm remote stream
      const remoteData = remoteStreams?.get(participant.userId);
      if (remoteData) {
        stream = remoteData.stream;
        cameraEnabled = remoteData.cameraEnabled !== false;
        micEnabled = remoteData.micEnabled !== false;
      } else {
        // Không có stream, nhưng vẫn render ô
        cameraEnabled = false;
      }
    }
    
    return {
      stream,
      userName: participant.fullName || participant.userName || 'Unknown',
      userId: participant.userId,
      isLocal,
      isMuted: !micEnabled,
      cameraEnabled,
      isPinned: participant.userId === pinnedUserId
    };
  });

  // Chia videos thành grid (tối đa 16) và sidebar
  const gridVideos = allVideos.slice(0, MAX_GRID_VIDEOS);
  const sidebarVideos = allVideos.slice(MAX_GRID_VIDEOS);

  // Calculate grid layout dựa trên số lượng video trong grid
  const getGridClass = () => {
    const count = gridVideos.length;
    
    if (count === 1) return 'grid-1';
    if (count === 2) return 'grid-2';
    if (count === 3) return 'grid-3';
    if (count === 4) return 'grid-4';
    if (count <= 6) return 'grid-6';
    if (count <= 9) return 'grid-9';
    if (count <= 12) return 'grid-12';
    return 'grid-16'; // 13-16 videos
  };

  const gridClass = getGridClass();

  // Debug logging - QUAN TRỌNG để kiểm tra
  console.log('🎬 VideoGrid Render:', {
    totalParticipants: participants.length,
    participantsList: participants.map(p => ({ name: p.fullName, id: p.userId })),
    currentUserId,
    gridVideosCount: gridVideos.length,
    sidebarVideosCount: sidebarVideos.length,
    hasOverflow,
    hasLocalStream: !!localStream,
    remoteStreamsCount: remoteStreams?.size || 0,
    gridClass
  });

  return (
    <div className={`video-grid-container ${hasOverflow ? 'has-sidebar' : ''}`}>
      {/* Main video grid */}
      <div className={`video-grid ${gridClass}`}>
        {gridVideos.map(({ stream, userName, userId, isLocal, isMuted, cameraEnabled, isPinned }) => (
          <VideoTile
            key={userId}
            stream={stream}
            userName={userName}
            isMuted={isMuted}
            cameraEnabled={cameraEnabled}
            isLocal={isLocal}
            isPinned={isPinned}
            onPin={!isLocal ? () => onPinVideo && onPinVideo(isPinned ? null : userId) : undefined}
          />
        ))}

        {/* Placeholder if no participants */}
        {gridVideos.length === 0 && (
          <div className="no-video-placeholder">
            <div className="placeholder-content">
              <span className="placeholder-icon">👥</span>
              <p>Đang chờ người tham gia...</p>
              <p style={{ fontSize: '14px', color: '#999' }}>
                Participants: {participants.length}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar for additional participants (> 16) */}
      {hasOverflow && (
        <div className={`participants-sidebar ${showSidebar ? 'expanded' : 'collapsed'}`}>
          <div className="sidebar-header">
            <h3>
              Participants ({sidebarVideos.length})
              <button 
                className="sidebar-toggle"
                onClick={() => setShowSidebar(!showSidebar)}
                title={showSidebar ? 'Collapse sidebar' : 'Expand sidebar'}
              >
                {showSidebar ? '▶' : '◀'}
              </button>
            </h3>
          </div>
          
          {showSidebar && (
            <div className="sidebar-content">
              <div className="sidebar-scroll">
                {sidebarVideos.map(({ stream, userName, userId, isLocal, isMuted, cameraEnabled, isPinned }) => (
                  <div key={userId} className="sidebar-participant">
                    <VideoTile
                      stream={stream}
                      userName={userName}
                      isMuted={isMuted}
                      cameraEnabled={cameraEnabled}
                      isLocal={isLocal}
                      isPinned={isPinned}
                      isInSidebar={true}
                      onPin={!isLocal ? () => onPinVideo && onPinVideo(isPinned ? null : userId) : undefined}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Collapsed state - show count badge */}
          {!showSidebar && (
            <div className="sidebar-badge">
              +{sidebarVideos.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoGrid;
