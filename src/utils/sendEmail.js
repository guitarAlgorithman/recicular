const nodemailer = require('nodemailer');

const sendEmail = async ({ to, subject, html }) => {
  try {
    // Transport usando variables de entorno
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: false, // STARTTLS
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const info = await transporter.sendMail({
      from: `"Recircular" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });

    console.log('✉️ Email enviado:', info.messageId);
  } catch (error) {
    // Si falla el correo, NO rompemos el flujo: solo logueamos
    console.error('⚠️ Error enviando email:', error.message);
    console.log('📄 HTML que SE HABRÍA ENVIADO:\n', html);
  }
};

module.exports = sendEmail;
