import User from "../models/user.js";
import { verifyJwt } from "../utils/jwt.js";

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const token = authHeader.slice("Bearer ".length).trim();
    const payload = verifyJwt(token);

    const user = await User.findById(payload.userId).lean();
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    req.user = {
      id: user._id.toString(),
      name: user.name,
      username: user.username,
      email: user.email
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}
