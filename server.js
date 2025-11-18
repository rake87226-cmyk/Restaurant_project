require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { run, all, get } = require('./db');
const { initTwilio, sendOrderConfirmation, sendReservationConfirmation } = require('./sms');
const { initEmail, sendOrderConfirmationEmail, sendReservationConfirmationEmail } = require('./email');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize Twilio SMS
initTwilio();

// Initialize Email
initEmail();

app.get('/api/menu', async (req, res) => {
  try {
    const items = await all('SELECT * FROM menu ORDER BY id');
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const { items = [], customer = {}, total = 0 } = req.body;
    const result = await run(
      'INSERT INTO orders (customer_name, customer_email, customer_phone, total, status, created_at) VALUES (?,?,?,?,?,datetime("now"))',
      [customer.name || '', customer.email || '', customer.phone || '', total, 'pending']
    );
    const orderId = result.lastID;

    // Get menu items to fetch names and prices
    const itemsList = [];
    for (const it of items) {
      const menuItem = await get('SELECT * FROM menu WHERE id = ?', [it.id]);
      if (menuItem) {
        itemsList.push({
          id: it.id,
          name: menuItem.name,
          quantity: it.qty,
          price: menuItem.price
        });
        await run('INSERT INTO order_items (order_id, menu_id, quantity, price) VALUES (?,?,?,?)', [orderId, it.id, it.qty, menuItem.price]);
      }
    }

    // Send SMS confirmation if phone is provided
    if (customer.phone) {
      sendOrderConfirmation(customer.phone, orderId, total).catch(err => console.error('SMS send error:', err));
    }

    // Send email confirmation if email is provided
    if (customer.email) {
      sendOrderConfirmationEmail(customer.email, orderId, customer.name || 'Customer', total, itemsList).catch(err => console.error('Email send error:', err));
    }

    res.json({ orderId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await all('SELECT * FROM orders ORDER BY created_at DESC');
    for (const ord of orders) {
      ord.items = await all('SELECT oi.*, m.name FROM order_items oi LEFT JOIN menu m ON oi.menu_id = m.id WHERE oi.order_id = ?', [ord.id]);
    }
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reservations', async (req, res) => {
  try {
    const { name, phone, email, date, time, party_size } = req.body;
    const result = await run(
      'INSERT INTO reservations (name, phone, email, date, time, party_size, status, created_at) VALUES (?,?,?,?,?,?,?,datetime("now"))',
      [name, phone, email, date, time, party_size, 'pending']
    );
    const reservationId = result.lastID;

    // Send SMS confirmation if phone is provided
    if (phone) {
      sendReservationConfirmation(phone, reservationId, date, time, party_size).catch(err => console.error('SMS send error:', err));
    }

    // Send email confirmation if email is provided
    if (email) {
      sendReservationConfirmationEmail(email, reservationId, name, date, time, party_size).catch(err => console.error('Email send error:', err));
    }

    res.json({ reservationId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reservations', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM reservations ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Feedback endpoints
app.post('/api/feedback', async (req, res) => {
  try {
    const { name, email, phone, rating = 5, comment = '' } = req.body;
    const result = await run('INSERT INTO feedback (name, email, phone, rating, comment, created_at) VALUES (?,?,?,?,?,datetime("now"))', [name, email, phone, rating, comment]);
    res.json({ feedbackId: result.lastID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/feedback', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM feedback ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/feedback', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM feedback ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin endpoints: enriched views with payment info
app.get('/api/admin/reservations', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM reservations ORDER BY created_at DESC');
    const out = [];
    for (const r of rows) {
      const pay = await get('SELECT id, status, details FROM payments WHERE reservation_id = ? ORDER BY created_at DESC LIMIT 1', [r.id]);
      let payment_ref = null;
      let paid = false;
      let payment_details = null;
      if (pay) {
        payment_ref = pay.id;
        paid = pay.status === 'completed' || pay.status === 'paid';
        try { payment_details = JSON.parse(pay.details || '{}'); } catch(e) { payment_details = pay.details; }
      }
      out.push({
        id: r.id,
        name: r.name,
        phone: r.phone,
        email: r.email,
        date: r.date,
        time: r.time,
        party_size: r.party_size,
        status: r.status,
        created_at: r.created_at,
        paid,
        payment_ref,
        payment_details
      });
    }
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/orders', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM orders ORDER BY created_at DESC');
    const out = [];
    for (const o of rows) {
      const items = await all('SELECT oi.*, m.name FROM order_items oi LEFT JOIN menu m ON oi.menu_id = m.id WHERE oi.order_id = ?', [o.id]);
      const pay = await get('SELECT id, status, details FROM payments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1', [o.id]);
      let payment_ref = null;
      let paid = false;
      let payment_details = null;
      if (pay) {
        payment_ref = pay.id;
        paid = pay.status === 'completed' || pay.status === 'paid';
        try { payment_details = JSON.parse(pay.details || '{}'); } catch(e) { payment_details = pay.details; }
      }
      out.push({
        id: o.id,
        name: o.customer_name,
        phone: o.customer_phone,
        email: o.customer_email,
        total: o.total,
        status: o.status,
        created_at: o.created_at,
        items,
        paid,
        payment_ref,
        payment_details
      });
    }
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payments', async (req, res) => {
  try {
    const { orderId = null, reservationId = null, amount = 0, method = 'card', details = {} } = req.body;
    const result = await run(
      'INSERT INTO payments (order_id, reservation_id, amount, method, status, details, created_at) VALUES (?,?,?,?,?,?,datetime("now"))',
      [orderId, reservationId, amount, method, 'completed', JSON.stringify(details || {})]
    );

    if (orderId) await run('UPDATE orders SET status = ? WHERE id = ?', ['paid', orderId]);
    if (reservationId) await run('UPDATE reservations SET status = ? WHERE id = ?', ['confirmed', reservationId]);

    res.json({ paymentId: result.lastID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Optionally serve frontend files from parent folder
app.use(express.static(path.join(__dirname, '..')));

// For any API route not matched above, return JSON 404 instead of HTML
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Global error handler that always returns JSON
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: err && err.message ? err.message : 'Internal server error' });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
