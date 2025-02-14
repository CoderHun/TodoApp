require("dotenv").config();
const express = require("express");
const { ApolloServer, gql } = require("apollo-server-express");
const cors = require("cors");
const { typeDefs, resolvers } = require("./graphql-schema");
const connectMongoose = require("./database");
const app = express();

app.use(express.json());
app.use("/uploads", express.static("uploads"));

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => {
    return { req }; // req를 context에 추가
  },
});
server.start().then(() => {
  server.applyMiddleware({ app });
  connectMongoose();
  app.listen({ port: process.env.PORT }, () => {
    console.log(
      `🚀 Server ready at http://localhost:${process.env.PORT}${server.graphqlPath}`
    );
  });
});
