// backend/src/utils/sendEmail.js
const { Resend } = require("resend");

function getResendClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("⚠️ RESEND_API_KEY no está definida. No se enviarán correos.");
    return null;
  }
  return new Resend(key);
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

    const resend = getResendClient();
    if (!resend) {
      console.log("📧 Email NO enviado (sin Resend).");
      console.log("HTML:\n", html);
      return;
    }

    const from = process.env.EMAIL_FROM || "Recircular <onboarding@resend.dev>";

    const result = await resend.emails.send({
      from,
      to,
      subject,
      html,
      ...(text ? { text } : {}),
    });

    if (result?.error) {
      console.error("⚠️ Resend error:", result.error);
      console.log("📄 HTML que SE HABRÍA ENVIADO:\n", html);
      return;
    }

    console.log("✉️ Email enviado (Resend):", result?.data?.id || result);
  } catch (error) {
    console.error("⚠️ Error enviando email (Resend):", error.message);
    console.log("📄 HTML que SE HABRÍA ENVIADO:\n", html);
  }
};

module.exports = sendEmail;
