require("dotenv").config();
const { gql } = require("apollo-server-express");
const { User, Profile } = require("./mongoose-schema");
const validator = require("validator");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

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

  type Query {
    verifyToken: User
    getProfile: Profile
    signIn(email: String!, password: String!): User
  }

  type Mutation {
    signUp(email: String!, password: String!, confirmPassword: String!): Success
    updateProfile(
      nickname: String!
      phoneNumber: String
      age: Int
      gender: String
      address: String
    ): Profile
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
        userProfile = new Profile({
          userId: newUser._id,
          nickname: "",
          phoneNumber: "",
          age: "",
          gender: "Hide",
          address: "",
          profileImage: "",
        });
        await newUser.save();
        await userProfile.save();
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

        return { email: user.email, token: token };
      } catch (error) {
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
  },
};

module.exports = { typeDefs, resolvers };
