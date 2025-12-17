// src/config/db.js
const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI;

async function connectDB() {
  try {
    if (!MONGODB_URI) {
      throw new Error("MONGODB_URI no está definida en .env");
    }

    await mongoose.connect(MONGODB_URI, {
      // estos options ya no son tan necesarios en versiones nuevas,
      // pero los dejo comentados por si algún warning:
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
    });

    console.log("✅ MongoDB conectado (Atlas)");
  } catch (err) {
    console.error("❌ Error conectando a MongoDB:", err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
