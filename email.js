const nodemailer = require('nodemailer');

let transporter = null;

function initEmail() {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const fromEmail = process.env.FROM_EMAIL || smtpUser;

  console.log('[EMAIL DEBUG] Checking config:');
  console.log('  SMTP_HOST:', smtpHost ? '✓ set' : '✗ missing');
  console.log('  SMTP_PORT:', smtpPort ? '✓ set' : '✗ missing');
  console.log('  SMTP_USER:', smtpUser ? '✓ set' : '✗ missing');
  console.log('  SMTP_PASS:', smtpPass ? '✓ set' : '✗ missing');
  console.log('  FROM_EMAIL:', fromEmail ? '✓ set' : '✗ missing');

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.log('[EMAIL] Email not fully configured. Emails will be logged but not sent.');
    return;
  }

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort || 587,
    secure: smtpPort == 465, // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });

  console.log('[EMAIL] ✓ Client initialized with SMTP:', smtpHost, 'PORT:', smtpPort, 'USER:', smtpUser);
}

async function sendOrderConfirmationEmail(toEmail, orderId, customerName, total, items) {
  const subject = `Order Confirmation #${orderId}`;
  let itemsHtml = '';
  if (items && items.length > 0) {
    itemsHtml = items.map(it => {
      const itemTotal = (it.price * it.quantity).toFixed(2);
      return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee">${it.name}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">×${it.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">₹${it.price.toFixed(2)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold">₹${itemTotal}</td>
        </tr>
      `;
    }).join('');
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; color: #333; }
        .container { max-width: 500px; margin: 0 auto; padding: 20px; background: #f9f9f9; border-radius: 8px; }
        .header { background: #c0392b; color: #fff; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
        .header h2 { margin: 0; }
        .content { background: #fff; padding: 20px; border-radius: 0 0 8px 8px; }
        .info-row { margin: 12px 0; }
        .info-label { font-weight: bold; color: #555; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        .total-row { background: #f0f0f0; font-size: 1.1em; font-weight: bold; }
        .total-row td { padding: 12px; border: none; }
        .footer { margin-top: 20px; color: #999; font-size: 0.9em; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>🍽️ Order Confirmed!</h2>
        </div>
        <div class="content">
          <p>Hi ${customerName},</p>
          <p>Thank you for your order! Your delicious meal is being prepared.</p>
          
          <div class="info-row">
            <span class="info-label">Order ID:</span> #${orderId}
          </div>
          
          <h3 style="margin-top:20px;margin-bottom:10px">Order Details:</h3>
          <table>
            <thead>
              <tr style="background:#f0f0f0;font-weight:bold">
                <td style="padding:8px;text-align:left">Item</td>
                <td style="padding:8px;text-align:center">Qty</td>
                <td style="padding:8px;text-align:right">Price</td>
                <td style="padding:8px;text-align:right">Total</td>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <tr class="total-row">
                <td colspan="3" style="text-align:right">Grand Total:</td>
                <td style="text-align:right">₹${total.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          
          <!-- SMS confirmation removed: emails are sent only to the customer's email address -->
          
          <p style="margin-top:20px;color:#666">
            Your order will be ready shortly. If you have any questions, please contact us at <strong>+91 99866 45103</strong>.
          </p>
          
          <div class="footer">
            <p>Thank you for choosing La Bella! 🙏</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
  return sendEmail(toEmail, subject, html);
}

async function sendReservationConfirmationEmail(toEmail, reservationId, customerName, date, time, partySize) {
  const subject = `Reservation Confirmation #${reservationId}`;
  const html = `
    <h2>Reservation Confirmed!</h2>
    <p>Hi ${customerName},</p>
    <p>Your table reservation has been confirmed.</p>
    <p><strong>Reservation ID:</strong> ${reservationId}</p>
    <p><strong>Date:</strong> ${date}</p>
    <p><strong>Time:</strong> ${time}</p>
    <p><strong>Party Size:</strong> ${partySize} people</p>
    <p><strong>Advance Payment:</strong> ₹100 (confirmed)</p>
    <p>We look forward to welcoming you! If you have any questions, please contact us at <strong>+91 99866 45103</strong>.</p>
  `;
  return sendEmail(toEmail, subject, html);
}

async function sendEmail(toEmail, subject, html) {
  if (!transporter) {
    console.log(`[EMAIL LOG] To: ${toEmail} | Subject: ${subject}`);
    return { success: false, reason: 'Email not configured' };
  }

  try {
    console.log(`[EMAIL SENDING] To: ${toEmail} | From: ${process.env.FROM_EMAIL || process.env.SMTP_USER}`);
    const info = await transporter.sendMail({
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to: toEmail,
      subject,
      html
    });
    console.log(`[EMAIL SENT] ✓ To: ${toEmail} | MessageID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[EMAIL ERROR] ✗ To: ${toEmail}`);
    console.error(`  Code: ${err.code}`);
    console.error(`  Message: ${err.message}`);
    if (err.response) console.error(`  Response: ${err.response}`);
    return { success: false, error: err.message };
  }
}

module.exports = { initEmail, sendOrderConfirmationEmail, sendReservationConfirmationEmail };
