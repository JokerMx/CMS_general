const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
  }

  init() {
    if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
      this.initialized = true;
      console.log('✅ Servicio de email inicializado');
    } else {
      console.warn('⚠️ Email no configurado en .env');
    }
  }

  async sendContactNotification({ name, email, subject, message }) {
    if (!this.initialized) return false;
    try {
      await this.transporter.sendMail({
        from: `"DevFree Contacto" <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_TO || process.env.EMAIL_USER,
        replyTo: email,
        subject: `📩 ${subject || 'Nuevo mensaje'} - ${name}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head><meta charset="UTF-8"></head>
          <body style="margin:0;padding:0;background:#0b0f19;font-family:'Segoe UI',Arial,sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0b0f19;padding:40px 0;">
              <tr><td align="center">
                <table width="560" cellpadding="0" cellspacing="0" style="background:#131826;border-radius:16px;overflow:hidden;border:1px solid #1e2538;">
                  <!-- Header -->
                  <tr>
                    <td style="background:linear-gradient(135deg,#818cf8,#6366f1);padding:35px 30px;text-align:center;">
                      <h1 style="color:#ffffff;margin:0;font-size:22px;">📩 Nuevo mensaje de contacto</h1>
                      <p style="color:#c4b5fd;margin:8px 0 0;font-size:14px;">DevFree Studio</p>
                    </td>
                  </tr>
                  <!-- Datos -->
                  <tr>
                    <td style="padding:30px;">
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                        <tr>
                          <td style="padding:10px 14px;border-bottom:1px solid #1e2538;color:#9aa0b8;font-size:13px;font-weight:600;">NOMBRE</td>
                          <td style="padding:10px 14px;border-bottom:1px solid #1e2538;color:#e8ecf4;font-size:14px;">${name}</td>
                        </tr>
                        <tr>
                          <td style="padding:10px 14px;border-bottom:1px solid #1e2538;color:#9aa0b8;font-size:13px;font-weight:600;">EMAIL</td>
                          <td style="padding:10px 14px;border-bottom:1px solid #1e2538;color:#818cf8;font-size:14px;">${email}</td>
                        </tr>
                        <tr>
                          <td style="padding:10px 14px;border-bottom:1px solid #1e2538;color:#9aa0b8;font-size:13px;font-weight:600;">ASUNTO</td>
                          <td style="padding:10px 14px;border-bottom:1px solid #1e2538;color:#e8ecf4;font-size:14px;">${subject || 'Sin asunto'}</td>
                        </tr>
                      </table>
                      <!-- Mensaje -->
                      <div style="background:#191e2e;border-radius:12px;padding:20px;border:1px solid #1e2538;">
                        <p style="color:#bcc3d4;font-size:14px;line-height:1.6;margin:0;">${message.replace(/\n/g, '<br>')}</p>
                      </div>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="padding:20px 30px;border-top:1px solid #1e2538;text-align:center;">
                      <p style="color:#5a6072;font-size:12px;margin:0;">© ${new Date().getFullYear()} DevFree Studio</p>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>
          </body>
          </html>
        `
      });
      console.log('✅ Email enviado');
      return true;
    } catch (error) {
      console.error('❌ Error email:', error.message);
      return false;
    }
  }

  async sendAutoReply({ name, email }) {
    if (!this.initialized) return false;
    try {
      await this.transporter.sendMail({
        from: `"DevFree" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '✅ Hemos recibido tu mensaje | DevFree',
        html: `
          <!DOCTYPE html>
          <html>
          <head><meta charset="UTF-8"></head>
          <body style="margin:0;padding:0;background:#0b0f19;font-family:'Segoe UI',Arial,sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0b0f19;padding:40px 0;">
              <tr><td align="center">
                <table width="480" cellpadding="0" cellspacing="0" style="background:#131826;border-radius:16px;overflow:hidden;border:1px solid #1e2538;">
                  <tr>
                    <td style="background:linear-gradient(135deg,#22d3ee,#0891b2);padding:35px 30px;text-align:center;">
                      <h2 style="color:#ffffff;margin:0;">✅ Mensaje recibido</h2>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:30px;text-align:center;">
                      <p style="color:#e8ecf4;font-size:15px;">Hola <strong style="color:#c4b5fd;">${name}</strong>,</p>
                      <p style="color:#9aa0b8;font-size:14px;line-height:1.6;">Gracias por contactarnos. Te responderemos en menos de 24 horas.</p>
                      <a href="${process.env.SITE_URL || 'http://localhost:3000'}" style="display:inline-block;background:#6366f1;color:white;padding:14px 30px;border-radius:25px;text-decoration:none;font-weight:600;margin-top:15px;font-size:14px;">Visitar DevFree</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 30px;border-top:1px solid #1e2538;text-align:center;">
                      <p style="color:#5a6072;font-size:12px;margin:0;">© ${new Date().getFullYear()} DevFree Studio</p>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>
          </body>
          </html>
        `
      });
      console.log('✅ Auto-respuesta enviada a:', email);
      return true;
    } catch (error) {
      console.error('❌ Error auto-respuesta:', error.message);
      return false;
    }
  }
}

module.exports = new EmailService();