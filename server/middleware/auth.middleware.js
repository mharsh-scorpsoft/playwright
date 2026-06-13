// server/middleware/auth.middleware.js
export function authMiddleware(req, res, next) {
  const expected = process.env.CLOUD_AUTH_TOKEN;

  if (!expected) {
    return res.status(500).json({
      success: false,
      error: "Server auth token not configured"
    });
  }

  const authHeader = req.get("authorization");
  const bearer =
    authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

  const token =
    bearer ||
    req.get("x-api-token") ||
    req.get("token");

  if (!token || token !== expected) {
    return res.status(401).json({
      success: false,
      error: "Invalid token"
    });
  }

  next();
}
