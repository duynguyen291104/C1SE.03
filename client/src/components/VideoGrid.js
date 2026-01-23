import React, { useRef, useEffect } from 'react';
import './VideoGrid.css';

/**
 * Component hiển thị video cho 1 người
 */
const VideoTile = ({ stream, userName, isMuted, isLocal, isScreenShare }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={`video-tile ${isLocal ? 'local' : 'remote'} ${isScreenShare ? 'screenshare' : ''}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal || isMuted}
        className="video-element"
      />
      <div className="video-overlay">
        <span className="user-name">{userName} {isLocal && '(You)'}</span>
        {isMuted && <span className="muted-icon">🔇</span>}
      </div>
    </div>
  );
};

/**
 * Grid layout cho nhiều video
 * Auto layout dựa trên số lượng người
 */
const VideoGrid = ({ localStream, remoteStreams, localUserName }) => {
  const totalVideos = 1 + (remoteStreams?.size || 0); // local + remotes

  // Calculate grid layout
  const getGridClass = () => {
    if (totalVideos === 1) return 'grid-1';
    if (totalVideos === 2) return 'grid-2';
    if (totalVideos <= 4) return 'grid-4';
    if (totalVideos <= 6) return 'grid-6';
    if (totalVideos <= 9) return 'grid-9';
    return 'grid-many';
  };

  return (
    <div className={`video-grid ${getGridClass()}`}>
      {/* Local video */}
      {localStream && (
        <VideoTile
          stream={localStream}
          userName={localUserName || 'You'}
          isMuted={true}
          isLocal={true}
        />
      )}

      {/* Remote videos */}
      {remoteStreams && Array.from(remoteStreams.values()).map(({ stream, userName, userId }) => (
        <VideoTile
          key={userId}
          stream={stream}
          userName={userName}
          isMuted={false}
          isLocal={false}
        />
      ))}

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
