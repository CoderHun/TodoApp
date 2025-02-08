require("dotenv").config();
const { createYoga, createSchema } = require("graphql-yoga");
const connectMongoose = require("./database");
const http = require("http");
const { typeDefs, resolvers } = require("./graphql-schema");

// MongoDB 연결
connectMongoose();

// GraphQL 서버 생성
const yoga = createYoga({
  schema: createSchema({
    typeDefs,
    resolvers,
  }),
});

const server = http.createServer(yoga);

// 서버 실행
const PORT = process.env.PORT || 4000;
server.listen({ port: PORT }, () => {
  console.log(`🚀 GraphQL Server running at http://localhost:${PORT}`);
});
