require("dotenv").config();
const { pipeline } = require("stream/promises");
const fs = require("fs");
const { gql } = require("apollo-server-express");
const { User, Profile, Schedule, Friends } = require("./mongoose-schema");
const validator = require("validator");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

// Node.js 환경에서 `globalThis.crypto` 설정
// if (!globalThis.crypto) {
//   globalThis.crypto = {
//     getRandomValues: (arr) => crypto.randomFillSync(arr),
//   };
// }

const SECRET_KEY = process.env.JWT_SECRET;
// 🔹 GraphQL 스키마 (typeDefs)
const typeDefs = gql`
  type User {
    email: String!
    token: String
    message: String
  }
  type Profile {
    nickname: String!
    email: String!
    phoneNumber: String
    age: Int
    gender: String
    address: String
    profileImage: String
  }

  type Success {
    success: Boolean!
    message: String
  }

  type Schedule {
    work: String!
    place: String!
    date: String!
    startTime: String!
    endTime: String!
    key: String!
  }
  type BasicFriendInfo {
    nickname: String!
    profileImage: String!
  }

  type Query {
    verifyToken: User
    getProfile: Profile
    signIn(email: String!, password: String!): User
    getSchedule: [Schedule!]!
    findUserFromEmail(email: String!): BasicFriendInfo
    getFriendRequest: [BasicFriendInfo!]!
    getFriendList: [BasicFriendInfo!]!
    getFriendSchedule(nickname: String!): [Schedule!]!
  }

  type Mutation {
    signUp(email: String!, password: String!, confirmPassword: String!): Success
    updateProfile(
      nickname: String!
      phoneNumber: String
      age: Int
      gender: String
      address: String
      key: String
    ): Profile
    createSchedule(
      work: String!
      place: String!
      date: String!
      startTime: String!
      endTime: String!
    ): Success
    updateSchedule(
      work: String!
      place: String!
      date: String!
      startTime: String!
      endTime: String!
      key: String!
    ): Success
    addFriend(email: String!): Success
    deleteSchedule(key: String!): Success
    acceptFriendRequest(nickname: String!): Success
    denyFriendRequest(nickname: String!): Success
  }
`;

function readToken(req) {
  const authToken = req?.headers?.authorization;
  if (!authToken) throw new Error("토큰이 없습니다.");
  const token = authToken.split(" ")[1];
  return token;
}

// 🔹 GraphQL 리졸버 (resolvers)
const resolvers = {
  Mutation: {
    // 회원가입 (signUp)
    signUp: async (_, { email, password, confirmPassword }) => {
      console.log(
        `request received. email : ${email} password : ${password} confirmPassword : ${confirmPassword}`
      );
      // 이메일 유효성 검사
      if (!validator.isEmail(email)) {
        return {
          success: false,
          message: "올바른 이메일 형식이 아니에요.",
        };
      }
      if (!validator.isLength(email, { min: 3, max: 128 })) {
        return {
          success: false,
          message: "이메일 주소는 최대 128자까지 입력 가능해요.",
        };
      }
      if (password !== confirmPassword) {
        return {
          success: false,
          message: "비밀번호 확인이 일치하지 않아요.",
        };
      }

      // 이미 존재하는 이메일인지 확인
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return {
          success: false,
          message: "이미 등록된 이메일 주소에요.",
        };
      }

      // 비밀번호 유효성 검사
      const isValid = validator.isStrongPassword(password, {
        minLength: 6,
        maxLength: 128,
        minLowercase: 1,
        minUppercase: 0,
        minNumbers: 1,
        minSymbols: 0,
      });
      if (!isValid) {
        return {
          success: false,
          message:
            "비밀번호는 최소 6자리 이상, 숫자와 문자가 포함되어야 합니다.",
        };
      }

      try {
        // 비밀번호 해싱
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ email, password: hashedPassword });
        // 프로필 생성
        const userProfile = new Profile({
          userId: newUser._id,
          nickname: "",
          phoneNumber: "",
          age: "",
          gender: "Hide",
          address: "",
          profileImage: "",
        });
        const schedule = new Schedule({
          userId: newUser._id,
          schedules: [],
        });
        const friend = new Friends({
          userId: newUser._id,
          friendsId: [],
        });
        await newUser.save();
        await userProfile.save();
        await schedule.save();
        await friend.save();
        return { success: true, message: "회원가입이 완료되었습니다." };
      } catch (error) {
        throw new Error(error.message);
      }
    },
    updateProfile: async (
      _,
      { nickname, phoneNumber, age, gender, address },
      { req }
    ) => {
      try {
        const token = readToken(req);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ email: decoded.email });
        if (!user) throw new Error("사용자를 찾을 수 없습니다.");

        let userProfile = await Profile.findOne({ userId: user._id });
        // 🔹 입력값 검증
        if (!nickname || !validator.isLength(nickname, { min: 2, max: 30 })) {
          throw new Error(
            "닉네임은 최소 2자 이상, 최대 30자 이하로 입력해야 합니다."
          );
        }

        if (phoneNumber && !validator.isMobilePhone(phoneNumber, "ko-KR")) {
          throw new Error("올바른 전화번호 형식이 아닙니다.");
        }

        if (age !== null && (typeof age !== "number" || age < 0 || age > 150)) {
          throw new Error("나이는 0~150 사이의 숫자로 입력해야 합니다.");
        }

        if (gender && !["Male", "Female"].includes(gender)) {
          throw new Error('성별은 "Male" 또는 "Female" 중 하나여야 합니다.');
        }

        if (address && !validator.isLength(address, { max: 100 })) {
          throw new Error("주소는 최대 100자까지 입력 가능합니다.");
        }
        userProfile.nickname = nickname;
        userProfile.phoneNumber = phoneNumber;
        userProfile.age = age;
        userProfile.gender = gender;
        userProfile.address = address;

        await userProfile.save();
        return userProfile;
      } catch (error) {
        throw new Error("프로필 업데이트 실패: " + error.message);
      }
    },
    createSchedule: async (
      _,
      { work, place, date, startTime, endTime },
      { req }
    ) => {
      try {
        const token = readToken(req);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ email: decoded.email });
        if (!user) throw new Error("사용자를 찾을 수 없습니다.");

        let schedule = await Schedule.findOne({ userId: user._id });
        if (!schedule) throw new Error("사용자를 찾을 수 없습니다.");
        schedule.schedules.push({
          work: work,
          place: place,
          date: new Date(date),
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          key: uuidv4(),
        });
        await schedule.save();
        console.log("new schedule saved");
        return { success: true, message: "일정이 저장되었습니다" };
      } catch (error) {
        console.log(error.message);
        throw new Error("❌ 일정 저장 실패: ");
      }
    },
    updateSchedule: async (
      _,
      { work, place, date, startTime, endTime, key },
      { req }
    ) => {
      try {
        const token = readToken(req);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ email: decoded.email });
        if (!user) throw new Error("사용자를 찾을 수 없습니다.");

        let schedule = await Schedule.findOne({ userId: user._id });

        if (!schedule) throw new Error("사용자를 찾을 수 없습니다.");
        const newSchedule = {
          work,
          place,
          date,
          startTime,
          endTime,
          key,
        };
        const results = await Schedule.updateOne(
          { userId: user._id, "schedules.key": key }, // 특정 key를 가진 객체 찾기
          { $set: { "schedules.$": newSchedule } } // 해당 객체를 newObject로 교체
        );
        console.log("일정 수정 성공");
        return { success: true, message: "일정이 수정되었습니다" };
      } catch (error) {
        console.log(error.message);
        throw new Error("❌ 일정 수정 실패: ");
      }
    },
    deleteSchedule: async (_, { key }, { req }) => {
      try {
        const token = readToken(req);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ email: decoded.email });
        if (!user) throw new Error("사용자를 찾을 수 없습니다.");

        let schedule = await Schedule.findOne({ userId: user._id });

        if (!schedule) throw new Error("사용자를 찾을 수 없습니다.");

        const results = await Schedule.updateOne(
          { userId: user._id }, // 사용자 ID 조건
          { $pull: { schedules: { key: key } } } // key가 일치하는 객체 삭제
        );
        return { success: true, message: "일정이 삭제되었습니다" };
      } catch (error) {
        console.log(error.message);
        throw new Error("❌ 일정 삭제 실패: ");
      }
    },
    addFriend: async (_, { email }, { req }) => {
      try {
        const token = readToken(req);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ email: decoded.email });
        if (!user) throw new Error("사용자를 찾을 수 없습니다.");
        if (email === decoded.email)
          return {
            success: true,
            message: "자기 자신과 친구를 맺을 수 없습니다",
          };
        const targetUser = await User.findOne({ email: email });
        if (!targetUser) throw new Error("사용자를 찾을 수 없습니다.");

        const isExist = await Friends.findOne({
          userId: targetUser._id,
          friendsId: { $elemMatch: { userId: user._id } },
        });
        if (isExist) {
          return { success: true, message: "해당 유저와 이미 친구입니다" };
        } else {
          const results = await Friends.updateOne(
            { userId: targetUser._id }, // 사용자 ID 조건
            { $addToSet: { requestsId: { userId: user._id } } }
          );
          if (results)
            return { success: true, message: "친구 신청이 완료되었습니다" };
          else return { success: true, message: "이미 신청한 상태입니다" };
        }
      } catch (error) {
        console.log(error.message);
        throw new Error("친구 추가 실패");
      }
    },
    acceptFriendRequest: async (_, { nickname }, { req }) => {
      try {
        const token = readToken(req);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ email: decoded.email });
        if (!user) throw new Error("사용자를 찾을 수 없습니다.");
        const targetUserProfile = await Profile.findOne({ nickname: nickname });
        if (!targetUserProfile) throw new Error("대상을 찾을 수 없습니다.");
        const targetUserId = targetUserProfile.userId;
        await Friends.updateOne(
          { userId: user._id }, // 해당 userId를 가진 문서를 찾음
          {
            $pull: { requestsId: { userId: targetUserId } }, // ✅ requestsId 배열에서 targetId 제거
            $addToSet: { friendsId: { userId: targetUserId } }, // ✅ friendsId 배열에 targetId 추가 (중복 방지)
          }
        );
        await Friends.updateOne(
          { userId: targetUserId }, // 해당 userId를 가진 문서를 찾음
          {
            $addToSet: { friendsId: { userId: user._id } }, // ✅ friendsId 배열에 targetId 추가 (중복 방지)
            $pull: { requestsId: { userId: user._id } }, // ✅ requestsId 배열에서 targetId 제거
          }
        );
        return { success: true, message: "친구 요청을 수락했습니다" };
      } catch (error) {
        console.log(error.message);
        throw new Error("친구 추가 실패");
      }
    },
    denyFriendRequest: async (_, { nickname }, { req }) => {
      try {
        const token = readToken(req);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ email: decoded.email });
        if (!user) throw new Error("사용자를 찾을 수 없습니다.");
        const targetUserProfile = await Profile.findOne({ nickname: nickname });
        if (!targetUserProfile) throw new Error("대상을 찾을 수 없습니다.");
        const targetUserId = targetUserProfile.userId;
        await Friends.updateOne(
          { userId: user._id }, // 해당 userId를 가진 문서를 찾음
          {
            $pull: { requestsId: { userId: targetUserId } }, // ✅ requestsId 배열에서 targetId 제거
          }
        );
        return { success: true, message: "친구 요청을 수락했습니다" };
      } catch (error) {
        console.log(error.message);
        throw new Error("친구 추가 실패");
      }
    },
  },
  Query: {
    // 로그인 (signIn)
    signIn: async (_, { email, password }) => {
      console.log(`sign in request - email : ${email}  password : ${password}`);
      try {
        const user = await User.findOne({ email });
        if (!user) {
          return {
            email: email,
            message: "이메일 또는 비밀번호가 일치하지 않아요.",
          };
        }

        // 비밀번호 검증
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return {
            email: email,
            message: "이메일 또는 비밀번호가 일치하지 않아요.",
          };
        }

        // JWT 생성
        const token = jwt.sign({ email: user.email }, SECRET_KEY, {
          expiresIn: "24h",
        });
        console.log("Login token created");
        let friend = await Friends.findOne({ userId: user._id });
        if (!friend) {
          const friend = new Friends({
            userId: user._id,
            friendsId: [],
          });
          await friend.save();
          return { email: user.email, token: token };
        }
        return { email: user.email, token: token };
      } catch (error) {
        console.log(error?.message);
        throw new Error("서버 오류가 발생했습니다.");
      }
    },
    verifyToken: async (_, __, { req }) => {
      try {
        const token = readToken(req);
        // 토큰 검증
        const decoded = jwt.verify(token, SECRET_KEY);
        if (!decoded) {
          console.log("토큰 인증 실패.");
          throw new Error("토큰 인증 실패.");
        }
        const user = await User.findOne({ email: decoded.email });
        if (!user) {
          console.log("사용자를 찾을 수 없습니다.");
          throw new Error("사용자를 찾을 수 없습니다.");
        }
        return { email: decoded.email };
      } catch (error) {
        console.log("서버 오류가 발생했습니다.");
        throw new Error("서버 오류가 발생했습니다.");
      }
    },
    getProfile: async (_, __, { req }) => {
      try {
        const token = readToken(req);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) {
          console.log("토큰 인증 실패.");
          throw new Error("토큰 인증 실패.");
        }
        console.log(`get profile : ${decoded.email}`);
        const user = await User.findOne({ email: decoded.email.trim() });
        if (!user) {
          console.log("사용자를 찾을 수 없습니다.", decoded.email);
          throw new Error("사용자를 찾을 수 없습니다.");
        }
        const userProfile = await Profile.findOne({ userId: user._id });
        if (!userProfile) {
          console.log("프로필을 찾을 수 없습니다.");
          throw new Error("프로필을 찾을 수 없습니다.");
        }
        return {
          nickname: userProfile.nickname,
          email: decoded.email,
          phoneNumber: userProfile.phoneNumber || "",
          age: userProfile.age || null,
          gender: userProfile.gender || "",
          address: userProfile.address || "",
          profileImage: userProfile.profileImage || null,
        };
      } catch (error) {
        console.log("프로필 정보 불러오기 실패: " + error.message);
        throw new Error("프로필 정보 불러오기 실패: " + error.message);
      }
    },
    getSchedule: async (_, __, { req }) => {
      try {
        const token = readToken(req);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) {
          console.log("토큰 인증 실패.");
          throw new Error("토큰 인증 실패.");
        }
        const user = await User.findOne({ email: decoded.email.trim() });
        if (!user) {
          console.log("사용자를 찾을 수 없습니다.", decoded.email);
          throw new Error("사용자를 찾을 수 없습니다.");
        }
        const userSchedule = await Schedule.findOne({
          userId: user._id,
        }).lean();
        const schedules = userSchedule.schedules.map(
          ({ _id, ...rest }) => rest
        );
        return schedules;
      } catch (error) {
        throw new Error("❌ 일정 조회 실패: " + error.message);
      }
    },
    getFriendSchedule: async (_, { nickname }, { req }) => {
      try {
        const token = readToken(req);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ email: decoded.email.trim() });
        if (!user) throw new Error("사용자를 찾을 수 없습니다.");
        const targetUserProfile = await Profile.findOne({ nickname: nickname });
        const targetUserId = targetUserProfile.userId;

        const isExist = await Friends.findOne({
          userId: user._id,
          friendsId: { $elemMatch: { userId: targetUserId } }, // ✅ 특정 userId가 friendsId 배열 내에 있는지 확인
        });
        if (isExist) {
          const userSchedule = await Schedule.findOne({
            userId: targetUserId,
          }).lean();
          const schedules = userSchedule.schedules.map(
            ({ _id, ...rest }) => rest
          );
          return schedules;
        } else {
          throw new Error("사용자를 찾을 수 없습니다.");
        }
      } catch (error) {
        throw new Error("❌ 친구 일정 조회 실패: " + error.message);
      }
    },
    findUserFromEmail: async (_, { email }) => {
      try {
        const user = await User.findOne({ email: email });
        if (!user) {
          throw new Error("사용자를 찾을 수 없습니다.");
        }
        const profile = await Profile.findOne({ userId: user._id });
        if (!profile) {
          throw new Error("사용자를 찾을 수 없습니다.");
        }
        return {
          nickname: profile.nickname,
          profileImage: profile.profileImage,
        };
      } catch (error) {
        throw new Error("❌ 조회 실패: " + error.message);
      }
    },
    getFriendRequest: async (_, __, { req }) => {
      try {
        const token = readToken(req);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ email: decoded.email.trim() });
        if (!user) throw new Error("사용자를 찾을 수 없습니다.");
        const friend = await Friends.findOne({ userId: user._id });

        const requests = [];
        for (const item of friend.requestsId) {
          const targetUser = await Profile.findOne({ userId: item.userId });
          requests.push({
            nickname: targetUser?.nickname,
            profileImage: targetUser?.profileImage,
          });
        }
        return requests;
      } catch (error) {
        console.log(error.message);
        throw new Error("친구 요청 불러오기 실패");
      }
    },
    getFriendList: async (_, __, { req }) => {
      try {
        const token = readToken(req);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ email: decoded.email.trim() });
        if (!user) throw new Error("사용자를 찾을 수 없습니다.");
        const friend = await Friends.findOne({ userId: user._id });

        const friendsList = [];
        for (const item of friend.friendsId) {
          const targetUser = await Profile.findOne({ userId: item.userId });
          friendsList.push({
            nickname: targetUser?.nickname,
            profileImage: targetUser?.profileImage,
          });
        }
        return friendsList;
      } catch (error) {
        console.log(error.message);
        throw new Error("친구 요청 불러오기 실패");
      }
    },
  },
};

module.exports = { typeDefs, resolvers };
