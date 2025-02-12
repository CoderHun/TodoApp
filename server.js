require("dotenv").config();
const express = require("express");
const { ApolloServer, gql } = require("apollo-server-express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { typeDefs, resolvers } = require("./graphql-schema");
const connectMongoose = require("./database");
const multer = require("multer");
const path = require("path");
const { User, Profile } = require("./mongoose-schema");
const jwt = require("jsonwebtoken");

const app = express();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // 파일을 uploads 폴더에 저장
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // 파일명을 현재 시간으로 설정
  },
});
const upload = multer({ storage });

app.use(cors({ origin: "*" })); // 모든 요청 허용

app.use(express.json());

app.use("/uploads", express.static("uploads"));

app.use((req, res, next) => {
  console.log(`📢 Request received: ${req.method} ${req.url}`);
  next();
});

app.get("/dummydummy", (req, res) => {
  return res.json({ hello: "hello" });
});
app.post("/dummydummy", (req, res) => {
  return res.json({ hello2: "hello2" });
});
// 🔹 REST API 엔드포인트 추가 (파일 업로드 처리)
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    console.log("milestone1");
    const authToken = req?.headers?.authorization;
    if (!authToken) throw new Error("토큰이 없습니다.");
    const token = authToken.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("milestone2");
    if (!decoded) {
      console.log("토큰 인증 실패.");
      throw new Error("토큰 인증 실패.");
    }
    const user = await User.findOne({ email: decoded.email.trim() });
    console.log("milestone3");
    const imageUrl = `/uploads/${req.file.filename}`;

    // MongoDB에 이미지 URL 저장
    await Profile.findOneAndUpdate(
      { userId: user._id },
      { profileImage: imageUrl },
      { new: true }
    );

    return res.json({ success: true, imageUrl });
  } catch (error) {
    res.status(500).json({ success: false, message: "파일 업로드 실패" });
  }
});

connectMongoose();

const server = new ApolloServer({
  typeDefs,
  resolvers,
  csrfPrevention: false,
  context: ({ req }) => {
    return { req }; // req를 context에 추가
  },
});
server.start().then(() => {
  server.applyMiddleware({ app });

  app.listen({ port: process.env.PORT }, () => {
    console.log(
      `🚀 Server ready at http://localhost:4000${server.graphqlPath}`
    );
  });
});
