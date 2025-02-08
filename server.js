const express = require("express");
const { graphqlHTTP } = require("express-graphql");
const { buildSchema } = require("graphql");
const { schema, root } = require("./graphql-schema");
const connectMongoose = require("./database");
const cors = require("cors");

// 4️⃣ Express 서버 설정
const app = express();
app.use(cors()); // CORS 정책 허용
app.use(
  "/graphql",
  graphqlHTTP({
    schema: schema,
    rootValue: root,
    graphiql: true, // GraphiQL UI 활성화
  })
);

// 5️⃣ 서버 실행
connectMongoose();
app.listen(PORT, () => {
  console.log(`🚀 GraphQL Server running at http://localhost:${process.env.PORT}/graphql`);
});
