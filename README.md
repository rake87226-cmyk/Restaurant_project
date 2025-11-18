# Food ordering backend

This is a minimal Node.js + SQLite backend for storing menu items, orders, reservations, and simulated payments.

Setup (PowerShell):

```powershell
cd "c:\Users\svcio\Desktop\nnew res\backend"
npm install
npm run init-db
npm start
```

Endpoints (JSON):
- `GET /api/menu` — returns menu items
- `POST /api/orders` — body: `{ items: [{id,quantity,price}], customer: {name,phone,email}, total }` → returns `{ orderId }`
- `GET /api/orders` — returns orders with items
- `POST /api/reservations` — body: `{ name, phone, email, date, time, party_size }` → returns `{ reservationId }`
- `GET /api/reservations` — returns reservations
- `POST /api/payments` — body: `{ orderId?, reservationId?, amount, method, details }` → returns `{ paymentId }` and marks order/reservation paid/confirmed

Notes:
- Payments are simulated (no external gateway). Replace `/api/payments` logic with Stripe/PayPal integration when ready.
- The server serves static files from the parent directory so your existing frontend can be served by the backend if you run it from the project root.
