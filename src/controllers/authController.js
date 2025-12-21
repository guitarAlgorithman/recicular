// backend/src/controllers/authController.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");

// Helper: generar JWT
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Faltan campos" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: "El email ya está registrado" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const confirmationToken = crypto.randomBytes(32).toString("hex");
    const confirmationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const user = await User.create({
      name,
      email,
      password: hashed,
      confirmationToken,
      confirmationTokenExpiresAt,
      // isActive queda false por defecto si tu schema lo define así
    });

    // BACKEND_URL debe existir en Railway (https://tu-app.up.railway.app)
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 4000}`;
    const confirmUrl = `${backendUrl}/api/auth/confirm/${confirmationToken}`;

    // ✅ Responder inmediatamente (no bloquea por SMTP)
    res.status(201).json({
      message: "Usuario creado. Revisa tu correo para activar la cuenta.",
      // útil en desarrollo si el SMTP falla (puedes quitarlo en prod)
      confirmUrl: process.env.NODE_ENV === "production" ? undefined : confirmUrl,
    });

    // ✅ Enviar email en segundo plano (sin await)
    sendEmail({
      to: user.email,
      subject: "Activa tu cuenta en Recircular",
      html: `
        <p>Hola ${user.name},</p>
        <p>Gracias por registrarte en Recircular. Haz clic en el siguiente enlace para activar tu cuenta:</p>
        <p><a href="${confirmUrl}">${confirmUrl}</a></p>
        <p>Si no fuiste tú, ignora este correo.</p>
      `,
    }).catch(() => {
      // sendEmail ya loguea; esto es por si sendEmail lanzara fuera (no debería)
    });

    return; // importante: ya respondimos arriba
  } catch (error) {
    console.error("Error en register:", error);
    return res.status(500).json({ error: "Error en el servidor" });
  }
};

// GET /api/auth/confirm/:token
const confirmAccount = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      confirmationToken: token,
      confirmationTokenExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        error: "Token inválido o expirado. Solicita otro registro.",
      });
    }

    user.isActive = true;
    user.confirmationToken = undefined;
    user.confirmationTokenExpiresAt = undefined;
    await user.save();

    return res.json({ message: "Cuenta activada. Ya puedes iniciar sesión." });
  } catch (error) {
    console.error("Error en confirmAccount:", error);
    return res.status(500).json({ error: "Error en el servidor" });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ✅ valida inputs (evita 400 “raros”)
    if (!email || !password) {
      return res.status(400).json({ error: "Faltan campos" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Credenciales inválidas" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Credenciales inválidas" });
    }

    if (!user.isActive) {
      return res.status(403).json({
        error: "Cuenta no activada. Revisa tu correo.",
      });
    }

    const token = generateToken(user._id);

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Error en login:", error);
    return res.status(500).json({ error: "Error en el servidor" });
  }
};

module.exports = {
  register,
  confirmAccount,
  login,
};
