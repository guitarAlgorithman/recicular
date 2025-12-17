// src/server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const connectDB = require("./config/db");

// Rutas
const authRoutes = require("./routes/authRoutes");
const offerRoutes = require("./routes/offerRoutes");
const requestRoutes = require("./routes/requestRoutes");

const app = express();
const PORT = process.env.PORT || 4000;

// Middlewares globales
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Rutas de la API
app.use("/api/auth", authRoutes);
app.use("/api/offers", offerRoutes);
app.use("/api/requests", requestRoutes);

// Healthcheck simple
app.get("/", (req, res) => {
  res.json({ message: "API Recircular OK" });
});

// 404 genérico
app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// Conexión a MongoDB Atlas y arranque del servidor
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Backend Recircular escuchando en puerto ${PORT}`);
  });
});
