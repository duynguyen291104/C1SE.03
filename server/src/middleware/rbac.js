/**
 * Middleware to check if user has required role(s)
 * @param {string[]} allowedRoles - Array of allowed roles
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRoles = req.user.roles || [];
    const hasRole = allowedRoles.some(role => userRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: userRoles
      });
    }

    next();
  };
};

/**
 * Middleware to check if teacher is approved
 */
const requireApprovedTeacher = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      error: 'Authentication required',
      message: 'Vui lòng đăng nhập để tiếp tục'
    });
  }

  if (!req.user.isApprovedTeacher()) {
    return res.status(403).json({ 
      success: false,
      error: 'Teacher approval required',
      message: 'Bạn cần được phê duyệt làm giáo viên để thực hiện chức năng này',
      teacherStatus: req.user.teacherStatus,
      roles: req.user.roles
    });
  }

  next();
};

module.exports = {
  requireRole,
  requireApprovedTeacher
};
