require("dotenv").config();
const { User } = require("./mongoose-schema");
const validator = require("validator");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const SECRET_KEY = process.env.JWT_SECRET;

// 🔹 GraphQL 스키마 (typeDefs)
const typeDefs = `
  type User {
    email: String!
    token: String
    message: String
  }

  type Success {
    success: Boolean!
    message: String
  }

  type Query {
    me: User
    signIn(email: String!, password: String!): User
  }

  type Mutation {
    signUp(email: String!, password: String! confirmPassword: String!): Success
    
  }
`;

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
        await newUser.save();
        return { success: true };
      } catch (error) {
        throw new Error("서버 오류가 발생했습니다.");
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
    me: async (_, __, { request }) => {
      try {
        // 요청 헤더에서 토큰 추출
        const token = request.headers.authorization;
        if (!token) {
          throw new Error("정상적으로 로그인되지 않았어요");
        }

        // 토큰 검증
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ email: decoded.email });
        if (!user) {
          throw new Error("사용자를 찾을 수 없습니다.");
        }
        return user;
      } catch (error) {
        throw new Error("서버 오류가 발생했습니다.");
      }
    },
  },
};

module.exports = { typeDefs, resolvers };
