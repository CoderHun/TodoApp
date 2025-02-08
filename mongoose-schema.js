const mongoose = require("mongoose");

// 1️⃣ User 스키마 정의
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

// 2️⃣ User 모델 생성
const User = mongoose.model("User", userSchema);

module.exports = { User };
