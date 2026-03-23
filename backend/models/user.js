import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, trim: true, unique: true, lowercase: true },
    email: { type: String, required: true, trim: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  },
  {
    strict: true
  }
);

const User = mongoose.model("User", UserSchema);

export default User;
