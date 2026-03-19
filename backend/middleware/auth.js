const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'poker-secret-key-change-in-production';

// 生成 JWT Token
function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

// 验证 JWT Token 中间件
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: '令牌无效或已过期' });
  }
}

// 可选认证（用于获取用户信息但不强制登录）
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.userId = decoded.userId;
    } catch (error) {
      // 忽略错误，继续作为未登录用户
    }
  }
  
  next();
}

module.exports = {
  JWT_SECRET,
  generateToken,
  authMiddleware,
  optionalAuth
};
