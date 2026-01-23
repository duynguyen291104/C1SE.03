import React, { useRef, useEffect } from 'react';
import './VideoGrid.css';

/**
 * Component hiển thị video cho 1 người
 */
const VideoTile = ({ stream, userName, isMuted, isLocal, isScreenShare, cameraEnabled = true, isPinned, onPin }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={`video-tile ${isLocal ? 'local' : 'remote'} ${isScreenShare ? 'screenshare' : ''} ${isPinned ? 'pinned' : ''}`}>
      {cameraEnabled && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal || isMuted}
          className="video-element"
        />
      ) : (
        <div className="camera-off">
          <div className="camera-off-icon">📷</div>
          <div className="camera-off-text">Camera Off</div>
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
 */
const VideoGrid = ({ 
  localStream, 
  remoteStreams, 
  localUserName, 
  isCameraOn = true, 
  isMicOn = true,
  pinnedUserId = null,
  onPinVideo 
}) => {
  const totalVideos = 1 + (remoteStreams?.size || 0); // local + remotes

  // Calculate grid layout
  const getGridClass = () => {
    if (pinnedUserId) return 'grid-pinned'; // Special layout when pinned
    if (totalVideos === 1) return 'grid-1';
    if (totalVideos === 2) return 'grid-2';
    if (totalVideos <= 4) return 'grid-4';
    if (totalVideos <= 6) return 'grid-6';
    if (totalVideos <= 9) return 'grid-9';
    return 'grid-many';
  };

  return (
    <div className={`video-grid ${getGridClass()}`}>
      {/* Pinned video (if any) */}
      {pinnedUserId && remoteStreams?.has(pinnedUserId) && (
        <div className="pinned-container">
          <VideoTile
            stream={remoteStreams.get(pinnedUserId).stream}
            userName={remoteStreams.get(pinnedUserId).userName}
            isMuted={!remoteStreams.get(pinnedUserId).micEnabled}
            cameraEnabled={remoteStreams.get(pinnedUserId).cameraEnabled}
            isLocal={false}
            isPinned={true}
            onPin={() => onPinVideo && onPinVideo(null)}
          />
        </div>
      )}
      
      {/* Thumbnails container when video is pinned */}
      <div className={pinnedUserId ? 'thumbnails-container' : ''}>
        {/* Local video */}
        {localStream && (
          <VideoTile
            stream={localStream}
            userName={localUserName || 'You'}
            isMuted={true}
            cameraEnabled={isCameraOn}
            isLocal={true}
            isPinned={false}
          />
        )}

        {/* Remote videos */}
        {remoteStreams && Array.from(remoteStreams.values())
          .filter(({ userId }) => userId !== pinnedUserId) // Don't show pinned video in grid
          .map(({ stream, userName, userId, cameraEnabled = true, micEnabled = true }) => (
            <VideoTile
              key={userId}
              stream={stream}
              userName={userName}
              isMuted={!micEnabled}
              cameraEnabled={cameraEnabled}
              isLocal={false}
              isPinned={false}
              onPin={() => onPinVideo && onPinVideo(userId)}
            />
          ))
        }
      </div>

      {/* Placeholder if no video */}
      {!localStream && totalVideos === 0 && (
        <div className="no-video-placeholder">
          <div className="placeholder-content">
            <span className="placeholder-icon">📹</span>
            <p>No video streams</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoGrid;
