const { run, all, get } = require('./db');

async function createTables() {
  await run(`CREATE TABLE IF NOT EXISTS menu (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    image TEXT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    total REAL,
    status TEXT,
    created_at TEXT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    menu_id INTEGER,
    quantity INTEGER,
    price REAL,
    FOREIGN KEY(order_id) REFERENCES orders(id),
    FOREIGN KEY(menu_id) REFERENCES menu(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT,
    email TEXT,
    date TEXT,
    time TEXT,
    party_size INTEGER,
    status TEXT,
    created_at TEXT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    reservation_id INTEGER,
    amount REAL,
    method TEXT,
    status TEXT,
    details TEXT,
    created_at TEXT,
    FOREIGN KEY(order_id) REFERENCES orders(id),
    FOREIGN KEY(reservation_id) REFERENCES reservations(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    phone TEXT,
    rating INTEGER,
    comment TEXT,
    created_at TEXT
  )`);
}

async function seedMenuIfEmpty() {
  const rows = await all('SELECT COUNT(*) as c FROM menu');
  const count = rows && rows[0] ? rows[0].c : 0;
  if (count > 0) {
    console.log('Menu already seeded');
    return;
  }

  const items = [
    { name: 'Margherita Pizza', description: 'Fresh tomato & mozzarella', price: 250 },
    { name: 'Paneer Butter Masala', description: 'Creamy & aromatic', price: 220 },
    { name: 'Veg Biryani', description: 'Fragrant basmati rice', price: 180 },
    { name: 'Garlic Bread', description: 'Crispy & buttery', price: 80 },
    { name: 'Chocolate Brownie', description: 'Rich & fudgy', price: 120 }
  ];

  for (const it of items) {
    await run('INSERT INTO menu (name, description, price) VALUES (?,?,?)', [it.name, it.description, it.price]);
  }
  console.log('Seeded menu with sample items');
}

async function main() {
  try {
    await createTables();
    await seedMenuIfEmpty();
    console.log('Database initialized.');
  } catch (err) {
    console.error('Failed to initialize DB:', err);
    process.exit(1);
  }
}

main();
