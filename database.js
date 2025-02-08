require("dotenv").config();
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI;

function connectMongoose() {
  mongoose
    .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("✅ MongoDB Connected!"))
    .catch((err) => console.error("❌ MongoDB Connection Error:", err));
}

module.exports = connectMongoose;
