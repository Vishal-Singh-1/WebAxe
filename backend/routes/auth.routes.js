import express from "express";
import User from "../models/user.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { signJwt } from "../utils/jwt.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

function sanitizeUser(user) {
  return {
    id: user._id?.toString?.() || user.id,
    name: user.name,
    username: user.username,
    email: user.email
  };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post("/auth/register", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const username = String(req.body?.username || "").trim().toLowerCase();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!name || !username || !email || !password) {
      return res.status(400).json({ error: "Name, username, email, and password are required" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Please enter a valid email address" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long" });
    }

    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    }).lean();

    if (existingUser) {
      const conflictField = existingUser.email === email ? "email" : "username";
      return res.status(409).json({ error: `That ${conflictField} is already in use` });
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({
      name,
      username,
      email,
      passwordHash
    });

    const publicUser = sanitizeUser(user);
    const token = signJwt({ userId: publicUser.id, username: publicUser.username });

    return res.status(201).json({
      message: "Registration successful",
      token,
      user: publicUser
    });
  } catch (error) {
    console.error("Registration failed:", error);
    return res.status(500).json({ error: "Unable to register right now" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const identifier = String(req.body?.identifier || req.body?.username || req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "");

    if (!identifier || !password) {
      return res.status(400).json({ error: "Username or email and password are required" });
    }

    const user = await User.findOne({
      $or: [{ username: identifier }, { email: identifier }]
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const publicUser = sanitizeUser(user);
    const token = signJwt({ userId: publicUser.id, username: publicUser.username });

    return res.json({
      message: "Login successful",
      token,
      user: publicUser
    });
  } catch (error) {
    console.error("Login failed:", error);
    return res.status(500).json({ error: "Unable to login right now" });
  }
});

router.get("/auth/me", requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

export default router;
