import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this'

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const [, token] = authHeader.split(' ')

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authorization token missing'
    })
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.auth = payload
    return next()
  } catch {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    })
  }
}

export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const [, token] = authHeader.split(' ')

  if (!token) {
    return next()
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.auth = payload
  } catch {
    // Ignore invalid token for optional auth
  }
  return next()
}
