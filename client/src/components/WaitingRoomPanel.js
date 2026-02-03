import React from 'react';
import './WaitingRoomPanel.css';

const WaitingRoomPanel = ({ 
  waitingStudents, 
  onApprove, 
  onReject,
  approvingStudents,
  rejectingStudents 
}) => {
  if (!waitingStudents || waitingStudents.length === 0) {
    return (
      <div className="waiting-room-empty">
        <p>📭 Không có học sinh nào đang chờ duyệt</p>
      </div>
    );
  }

  return (
    <div className="waiting-room-list">
      {waitingStudents.map((student) => {
        const isApproving = approvingStudents?.has(student.userId);
        const isRejecting = rejectingStudents?.has(student.userId);
        const isProcessing = isApproving || isRejecting;

        return (
          <div key={student.userId} className="waiting-student-card">
            <div className="student-avatar">
              {student.avatar ? (
                <img src={student.avatar} alt={student.fullName} />
              ) : (
                <div className="avatar-placeholder">
                  {student.fullName?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            
            <div className="student-info">
              <h4>{student.fullName}</h4>
              <p className="student-email">{student.email}</p>
              <span className="waiting-time">
                ⏰ Yêu cầu lúc {new Date(student.requestedAt).toLocaleTimeString('vi-VN')}
              </span>
            </div>

            <div className="approval-actions">
              <button
                className="btn-approve"
                onClick={() => onApprove(student.userId)}
                disabled={isProcessing}
              >
                {isApproving ? '⏳ Đang duyệt...' : '✓ Duyệt'}
              </button>
              <button
                className="btn-reject"
                onClick={() => onReject(student.userId)}
                disabled={isProcessing}
              >
                {isRejecting ? '⏳ Từ chối...' : '✕ Từ chối'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default WaitingRoomPanel;
