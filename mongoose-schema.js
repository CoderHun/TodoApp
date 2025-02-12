const mongoose = require("mongoose");

// 1️⃣ User 스키마 정의
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const profileSchema = new mongoose.Schema({
  nickname: { type: String },
  phoneNumber: { type: String },
  age: { type: Number },
  gender: { type: String, enum: ["Male", "Female", "Hide"] },
  address: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  profileImage: { type: String },
});

// 2️⃣ User 모델 생성
const User = mongoose.model("User", userSchema);
const Profile = mongoose.model("Profile", profileSchema);

module.exports = { User, Profile };
