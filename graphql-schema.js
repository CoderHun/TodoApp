const { buildSchema } = require("graphql");

// 1️⃣ GraphQL 스키마 (Mutation 선언 포함)
const schema = buildSchema(`
  type Mutation {
    addUser(email: String!, password: String!): User
  }

  type User {
    email: String
    password: String
  }

  type Query {
    users: [User]
  }
`);

let nextId = 3;

// 3️⃣ Mutation 리졸버 구현
const root = {
  addUser: ({ id, password }) => {
    users.push(newUser);
    return newUser;
  },

  users: () => users, // Query 리졸버
};

module.exports = { schema, root };
