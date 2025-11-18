const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID || 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const authToken = process.env.TWILIO_AUTH_TOKEN || 'your_auth_token_here';
const fromNumber = process.env.TWILIO_PHONE_NUMBER || '+1234567890';

let client = null;

function initTwilio() {
  if (accountSid && authToken && accountSid !== 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
    client = twilio(accountSid, authToken);
    console.log('Twilio SMS client initialized.');
  } else {
    console.log('Twilio not configured. SMS will be logged but not sent.');
  }
}

async function sendOrderConfirmation(phone, orderId, total) {
  const message = `Order Confirmed!\nOrder ID: ${orderId}\nTotal: ₹${total}\nThank you for your order!`;
  return sendSMS(phone, message);
}

async function sendReservationConfirmation(phone, reservationId, date, time, partySize) {
  const message = `Reservation Confirmed!\nReservation ID: ${reservationId}\nDate: ${date}\nTime: ${time}\nParty Size: ${partySize}\nAdvance ₹100 paid.\nThank you!`;
  return sendSMS(phone, message);
}

async function sendSMS(toNumber, message) {
  if (!client) {
    console.log(`[SMS LOG] To: ${toNumber} | Message: ${message}`);
    return { success: false, reason: 'Twilio not configured' };
  }

  try {
    const msg = await client.messages.create({
      body: message,
      from: fromNumber,
      to: toNumber
    });
    console.log(`[SMS SENT] SID: ${msg.sid} | To: ${toNumber}`);
    return { success: true, messageSid: msg.sid };
  } catch (err) {
    console.error(`[SMS ERROR] To: ${toNumber} | Error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

module.exports = { initTwilio, sendOrderConfirmation, sendReservationConfirmation };
