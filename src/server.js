// // src/server.js
// require("dotenv").config();
// const express = require("express");
// const cors = require("cors");
// const morgan = require("morgan");
// const connectDB = require("./config/db");

// // Rutas
// const authRoutes = require("./routes/authRoutes");
// const offerRoutes = require("./routes/offerRoutes");
// const requestRoutes = require("./routes/requestRoutes");

// const app = express();
// const PORT = process.env.PORT || 4000;

// // Middlewares globales
// app.set("trust proxy", 1);

// app.use(
//   cors({
//     origin: process.env.FRONTEND_URL || "http://localhost:5173",
//     credentials: true,
//   })
// );
// app.use(express.json());
// app.use(morgan("dev"));

// // Rutas de la API
// app.use("/api/auth", authRoutes);
// app.use("/api/offers", offerRoutes);
// app.use("/api/requests", requestRoutes);

// // Healthcheck simple
// app.get("/", (req, res) => {
//   res.json({ message: "API Recircular OK" });
// });

// // 404 genérico
// app.use((req, res) => {
//   res.status(404).json({ error: "Ruta no encontrada" });
// });

// app.get("/health", (req, res) => res.json({ ok: true }));

// // Conexión a MongoDB Atlas y arranque del servidor
// connectDB().then(() => {
//   app.listen(PORT, () => {
//     console.log(`🚀 Backend Recircular escuchando en puerto ${PORT}`);
//   });
// });
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

app.set("trust proxy", 1);

const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL, // Vercel
].filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // Permite llamadas sin Origin (Postman, health checks, etc.)
      if (!origin) return cb(null, true);

      if (allowedOrigins.includes(origin)) return cb(null, true);

      return cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  })
);


app.use(express.json());
app.use(morgan("dev"));

// Healthcheck (DEBE ir antes del 404)
app.get("/health", (req, res) => res.json({ ok: true }));

// Root
app.get("/", (req, res) => {
  res.json({ message: "API Recircular OK" });
});

// API
app.use("/api/auth", authRoutes);
app.use("/api/offers", offerRoutes);
app.use("/api/requests", requestRoutes);

// 404 genérico al final
app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// Conexión a MongoDB Atlas y arranque del servidor
connectDB().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Backend Recircular escuchando en puerto ${PORT}`);
  });
});
