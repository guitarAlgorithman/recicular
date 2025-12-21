// backend/src/utils/sendEmail.js
const sgMail = require("@sendgrid/mail");

function sanitizeFrom(raw) {
  if (!raw) return null;

  let from = String(raw).trim();
  from = from.replace(/^"+|"+$/g, ""); // quita " al inicio/fin
  from = from.replace(/^'+|'+$/g, ""); // quita ' al inicio/fin
  from = from.replace(/\s+/g, " "); // colapsa espacios

  // Formatos válidos: email@x.com  OR  Name <email@x.com>
  const emailOnly = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const nameEmail = /^.+\s<[^>\s@]+@[^>\s@]+\.[^>\s@]+>$/;

  if (emailOnly.test(from) || nameEmail.test(from)) return from;
  return null;
}

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    if (process.env.EMAIL_DISABLED === "true") {
      console.log("📧 EMAIL_DISABLED=true. No se envía email.");
      console.log("To:", to);
      console.log("Subject:", subject);
      console.log("HTML:\n", html);
      return;
    }

    const key = process.env.SENDGRID_API_KEY;
    if (!key) {
      console.warn("⚠️ SENDGRID_API_KEY no está definida. No se enviarán correos.");
      console.log("📄 HTML que SE HABRÍA ENVIADO:\n", html);
      return;
    }

    sgMail.setApiKey(key);

    const from = sanitizeFrom(process.env.EMAIL_FROM);
    if (!from) {
      console.warn(
        '⚠️ EMAIL_FROM inválido. Debe ser "email@dominio.com" o "Nombre <email@dominio.com>".'
      );
      console.log("EMAIL_FROM recibido:", process.env.EMAIL_FROM);
      console.log("📄 HTML que SE HABRÍA ENVIADO:\n", html);
      return;
    }

    // Normaliza "to" a array si viene como string
    const msg = {
      to,
      from,
      subject,
      ...(html ? { html } : {}),
      ...(text ? { text } : {}),
    };

    const [resp] = await sgMail.send(msg);

    // SendGrid responde con statusCode y headers
    console.log("✉️ Email enviado (SendGrid):", resp?.statusCode || "OK");
  } catch (error) {
    // error.response.body suele tener el detalle más útil
    const details = error?.response?.body || null;
    console.error("⚠️ Error enviando email (SendGrid):", error.message);
    if (details) console.error("📩 SendGrid details:", JSON.stringify(details, null, 2));
  }
};

module.exports = sendEmail;
