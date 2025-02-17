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

const scheduleSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // ✅ 사용자 ID
  schedules: [
    {
      _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
      work: { type: String, required: true },
      place: { type: String, required: true },
      date: { type: Date, required: true },
      startTime: { type: Date, required: true }, // ✅ 필드명 소문자로 변경
      endTime: { type: Date, required: true },
      key: { type: String, required: true },
    },
  ],
});

const friendSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // ✅ 사용자 ID
  friendsId: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      _id: false,
    },
  ],
  requestsId: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      _id: false,
    },
  ],
});

// 2️⃣ User 모델 생성
const User = mongoose.model("User", userSchema);
const Profile = mongoose.model("Profile", profileSchema);
const Schedule = mongoose.model("Schedule", scheduleSchema);
const Friends = mongoose.model("Friend", friendSchema);
module.exports = { User, Profile, Schedule, Friends };
