// server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import pkg from "pg";
import dotenv from "dotenv";
import fetch from "node-fetch";
import nodemailer from "nodemailer";

dotenv.config();
const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Serve static files from public/
app.use(
  express.static(path.join(__dirname, "public"), { extensions: ["html"] })
);

// Serve images
app.use("/Images", express.static(path.join(__dirname, "public", "Images")));

app.use(express.json());

// ---------------------- DATABASE SETUP ----------------------
const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl:
    process.env.PGSSL === "true"
      ? { rejectUnauthorized: false }
      : false,
});

// ---------------------- EMAIL (NODEMAILER) ----------------------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// quantity-aware receipt
async function sendReceiptEmail(to, name, paymentMethod, orders) {
  if (!to) return;

  const lines = orders.map((o, idx) => {
    const qty =
      o.quantity != null
        ? o.quantity
        : o.qty != null
        ? o.qty
        : 1;

    const toppings =
      Array.isArray(o.toppings) && o.toppings.length
        ? ` (Toppings: ${o.toppings.join(", ")})`
        : "";

    const unitPrice = (o.basePrice || 0) + (o.toppingsCost || 0);
    const lineTotal =
      o.lineTotal != null ? o.lineTotal : unitPrice * qty;

    return `${idx + 1}. ${o.name} x${qty}${toppings} - $${lineTotal.toFixed(
      2
    )}`;
  });

  const subtotal = orders.reduce((sum, o) => {
    const qty =
      o.quantity != null
        ? o.quantity
        : o.qty != null
        ? o.qty
        : 1;

    const unitPrice = (o.basePrice || 0) + (o.toppingsCost || 0);
    const lineTotal =
      o.lineTotal != null ? o.lineTotal : unitPrice * qty;

    return sum + lineTotal;
  }, 0);

  const TAX_RATE = 0.0825;
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;

  const textBody = [
    `Hi ${name || "Customer"},`,
    "",
    "Thank you for your order from Sharetea!",
    "",
    "Order details:",
    ...lines,
    "",
    `Payment method: ${paymentMethod || "N/A"}`,
    "",
    `Subtotal: $${subtotal.toFixed(2)}`,
    `Tax: $${tax.toFixed(2)}`,
    `Total: $${total.toFixed(2)}`,
    "",
    "Have a great day!",
  ].join("\n");

  await transporter.sendMail({
    from:
      process.env.EMAIL_FROM ||
      `"Sharetea Kiosk" <${process.env.SMTP_USER}>`,
    to,
    subject: "Your Sharetea order receipt",
    text: textBody,
  });
}

// ---------------------- HEALTH CHECK ----------------------
app.get("/healthz", (req, res) =>
  res.json({ ok: true, message: "server up" })
);

// ---------------------- MENU ENDPOINTS ----------------------
app.get("/api/menu", async (req, res) => {
  try {
    const sql = `
      SELECT drink_name, series_name, qty_remaining, drink_price, file_name, hot_option, tea_options
      FROM drinks
      ORDER BY series_name, drink_name;
    `;
    const { rows } = await pool.query(sql);

    const series = {};
    for (const r of rows) {
      const key = r.series_name || "Other";
      if (!series[key]) series[key] = [];
      series[key].push(r);
    }
    res.json({ ok: true, series });
  } catch (err) {
    console.error("/api/menu DB error:", err.message);
    res.status(500).json({ ok: false, error: "Database query failed" });
  }
});

app.get("/api/drinks", async (req, res) => {
  const { series } = req.query;
  try {
    const params = [];
    let q = `SELECT drink_name, series_name, drink_price, file_name, hot_option, tea_options FROM drinks`;
    if (series) {
      q += ` WHERE series_name = $1`;
      params.push(series);
    }
    q += ` ORDER BY series_name NULLS LAST, drink_name`;

    const { rows } = await pool.query(q, params);

    const data = rows.map((r) => ({
      name: r.drink_name,
      series: r.series_name,
      price: Number(r.drink_price ?? 0),
      imageUrl: r.file_name
        ? `/Images/${r.file_name}`
        : `/Images/placeholder.png`,
      hotOption: r.hot_option,
      teaOptions: r.tea_options
    }));

    res.json({ drinks: data });
  } catch (err) {
    console.error("Failed to fetch drinks:", err);
    res.status(500).json({ error: "Failed to fetch drinks" });
  }
});

// ---------------------- EMPLOYEE LOOKUP (for cashier) ----------------------
app.get("/api/employee/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT employee_name FROM employeeid WHERE employee_id = $1",
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.json({ ok: false, error: "Employee not found" });
    }

    res.json({ ok: true, name: rows[0].employee_name });
  } catch (err) {
    console.error("Error fetching employee:", err);
    res.status(500).json({ ok: false, error: "Failed to fetch employee" });
  }
});

// ---------------------- ORDERS (CASHIER + CUSTOMER) ----------------------
async function handleOrdersPost(req, res) {
  const {
    orders,
    employee_name,
    customer_name,
    payment_method,
    want_receipt,
    receipt_email,
    receipt_name,
  } = req.body;

  if (!Array.isArray(orders) || orders.length === 0) {
    return res.status(400).json({ error: "No orders provided" });
  }

  try {
    for (const o of orders) {
        await pool.query(
        `INSERT INTO orders 
          (drink_name, ice_level, sweetness_level, temperature, tea_type, topping_used, 
          drink_price, topping_price, employee_name, customer_name, payment_method, order_timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
        [
          o.name,
          o.iceLevel,
          o.sweetness,
          o.temperature || 'iced',
          o.teaType || null,
          Array.isArray(o.toppings) ? o.toppings.join(", ") : "",
          o.basePrice,
          o.toppingsCost,
          employee_name || null,
          customer_name || null,
          payment_method || null,
        ]
      );
    }

    // Try sending receipt email if requested
    if (want_receipt && receipt_email) {
      try {
        await sendReceiptEmail(
          receipt_email,
          receipt_name || customer_name,
          payment_method,
          orders
        );
      } catch (emailErr) {
        console.error("Failed to send receipt email:", emailErr);
      }
    }

    res.status(200).json({ ok: true, message: "Orders inserted successfully" });
  } catch (err) {
    console.error("Error inserting orders:", err);
    res.status(500).json({ ok: false, error: "Database insert failed" });
  }
}

app.post("/api/orders", handleOrdersPost);
app.post("/orders", handleOrdersPost); // alias for older front-end code

// ---------------------- CUSTOMER FAVORITES ----------------------
app.post("/api/favorites", async (req, res) => {
  const {
    customer_name,
    drink_name,
    ice_level,
    sweetness_level,
    temperature,
    tea_type,
    topping_used,
    drink_price,
    topping_price,
    label
  } = req.body;

  try {
    // Prevent duplicates - now including temperature and tea_type
    const dup = await pool.query(
      `SELECT id FROM favorites
       WHERE customer_name = $1
       AND drink_name = $2
       AND ice_level = $3
       AND sweetness_level = $4
       AND temperature = $5
       AND COALESCE(tea_type, '') = COALESCE($6, '')
       AND topping_used = $7`,
      [customer_name, drink_name, ice_level, sweetness_level, temperature || 'iced', tea_type || '', topping_used]
    );

    if (dup.rows.length > 0) {
      return res.json({
        ok: false,
        error: "DUPLICATE"
      });
    }

    await pool.query(
      `INSERT INTO favorites
       (customer_name, drink_name, ice_level, sweetness_level, temperature, tea_type, topping_used, drink_price, topping_price, label)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        customer_name,
        drink_name,
        ice_level,
        sweetness_level,
        temperature || 'iced',
        tea_type || null,
        topping_used,
        drink_price,
        topping_price,
        label
      ]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "DB error" });
  }
});

app.get("/api/favorites/:customerName", async (req, res) => {
  const customerName = req.params.customerName;

  try {
    const result = await pool.query(
      `SELECT id, customer_name, drink_name, ice_level, sweetness_level, temperature, tea_type,
              topping_used, drink_price, topping_price, created_at, label
       FROM favorites
       WHERE customer_name = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [customerName]
    );

    res.json({ ok: true, favorites: result.rows });
  } catch (err) {
    console.error("Error fetching favorites", err);
    res
      .status(500)
      .json({ ok: false, error: "Database error fetching favorites" });
  }
});

app.delete("/api/favorites/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ ok: false, error: "Invalid id" });
  }

  try {
    await pool.query("DELETE FROM favorites WHERE id = $1", [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error deleting favorite", err);
    res
      .status(500)
      .json({ ok: false, error: "Database error deleting favorite" });
  }
});

// ---------------------- ORDER HISTORY ----------------------
app.get("/api/history/:customerName", async (req, res) => {
  const { customerName } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT order_id, drink_name, ice_level, sweetness_level, temperature, tea_type, topping_used, 
              drink_price, topping_price, payment_method, order_timestamp
       FROM orders
       WHERE customer_name = $1
       ORDER BY order_timestamp DESC
       LIMIT 50`,
      [customerName]
    );

    res.json({ ok: true, history: rows });
  } catch (err) {
    console.error("/api/history error:", err.message);
    res.status(500).json({ ok: false, error: "Database error" });
  }
});

// ---------------------- BASIC PAGES ----------------------

// start page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "startpage.html"));
});

// cashier pages
app.get("/cashier/:page", (req, res) => {
  const page = req.params.page;
  res.sendFile(path.join(__dirname, "public", "cashier", page));
});

// manager pages
app.get("/manager/:page", (req, res) => {
  const page = req.params.page;
  const allowedPages = [
    "employee",
    "inventory",
    "itemedits",
    "orderingtrends",
    "productusage",
    "xreport",
    "zreport",
  ];

  if (!allowedPages.includes(page)) {
    return res.status(404).send("Page not found");
  }

  res.sendFile(path.join(__dirname, "public", "manager", `${page}.html`));
});

// ---------------------- WEATHER API ----------------------
app.get("/api/weather", async (req, res) => {
  try {
    const apiKey = process.env.OPENWEATHER_KEY;
    const city = "College Station,US";
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
      city
    )}&units=imperial&appid=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Weather API request failed: ${errorText}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Weather API error:", err);
    res.status(500).json({ error: "Unable to fetch weather" });
  }
});

// ---------------------- CUSTOMER REGISTER ----------------------
app.post("/api/register", async (req, res) => {
  const { name, username, password, email } = req.body;

  if (!name || !username || !password || !email) {
    return res
      .status(400)
      .json({ ok: false, error: "Missing name, username, password, or email" });
  }

  try {
    // Check if username already exists
    const existing = await pool.query(
      "SELECT customer_id FROM customers WHERE customer_user = $1",
      [username]
    );
    if (existing.rows.length > 0) {
      return res
        .status(400)
        .json({ ok: false, error: "Username already taken" });
    }

    const insert = await pool.query(
      `INSERT INTO customers (customer_user, customer_pass, customer_name, customer_email)
       VALUES ($1, $2, $3, $4)
       RETURNING customer_id, customer_email`,
      [username, password, name, email]
    );

    const newId = insert.rows[0].customer_id;
    const newEmail = insert.rows[0].customer_email;

    res.json({ ok: true, customerId: newId, customerEmail: newEmail });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ ok: false, error: "Server error during register" });
  }
});

// ---------------------- LOGIN (MANAGER + EMPLOYEE + CUSTOMER) ----------------------
app.post("/api/login", async (req, res) => {
  const { id, password } = req.body;

  if (!id || !password) {
    return res.status(400).json({ ok: false, message: "Missing credentials" });
  }

  try {
    // 1️⃣ MANAGER LOGIN
    const mgr = await pool.query(
      "SELECT m_user, m_pass FROM managerid WHERE m_user = $1",
      [id]
    );

    if (mgr.rows.length > 0) {
      if (mgr.rows[0].m_pass === password) {
        return res.json({ ok: true, role: "manager" });
      } else {
        return res.json({ ok: false, message: "Invalid password" });
      }
    }

    // 2️⃣ EMPLOYEE LOGIN
    const emp = await pool.query(
      "SELECT employee_id, e_user, e_pass FROM employeeid WHERE e_user = $1",
      [id]
    );

    if (emp.rows.length > 0) {
      if (emp.rows[0].e_pass === password) {
        return res.json({
          ok: true,
          role: "cashier",
          employeeId: emp.rows[0].employee_id,
        });
      } else {
        return res.json({ ok: false, message: "Invalid password" });
      }
    }

    // 3️⃣ CUSTOMER LOGIN
    const cust = await pool.query(
      "SELECT customer_id, customer_pass, customer_name, customer_email FROM customers WHERE customer_user = $1",
      [id]
    );

    if (cust.rows.length > 0) {
      if (cust.rows[0].customer_pass === password) {
        return res.json({
          ok: true,
          role: "customer",
          customerId: cust.rows[0].customer_id,
          customerName: cust.rows[0].customer_name,
          customerEmail: cust.rows[0].customer_email,
        });
      } else {
        return res.json({ ok: false, message: "Invalid password" });
      }
    }

    // Nobody matched
    return res.json({ ok: false, message: "User not found" });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
});

// ---------------------- ORDERING TRENDS (MANAGER) ----------------------
app.get("/api/manager/orderingtrends", async (req, res) => {
  try {
    const mostOrdered = await pool.query(`
      SELECT drink_name, COUNT(*) as count
      FROM orders
      GROUP BY drink_name
      ORDER BY count DESC
      LIMIT 1
    `);

    const leastOrdered = await pool.query(`
      SELECT drink_name, COUNT(*) as count
      FROM orders
      GROUP BY drink_name
      ORDER BY count ASC
      LIMIT 1
    `);

    const revenue = await pool.query(`
      SELECT drink_name, SUM(drink_price + topping_price) AS revenue
      FROM orders
      GROUP BY drink_name
      ORDER BY revenue DESC
      LIMIT 10
    `);

    res.json({
      ok: true,
      mostOrdered: mostOrdered.rows[0],
      leastOrdered: leastOrdered.rows[0],
      revenue: revenue.rows,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ ok: false, error: "Failed to fetch ordering trends" });
  }
});

// ---------------------- INVENTORY (MANAGER) ----------------------

// GET inventory
app.get("/api/manager/inventory/:type", async (req, res) => {
  const type = req.params.type.toLowerCase();
  let table = "",
    columns = "";

  switch (type) {
    case "supplies":
      table = "supplies";
      columns = "name, quantity";
      break;
    case "ingredients":
      table = "ingredients";
      columns = "name, quantity";
      break;
    case "menuitems":
      table = "menu_items";
      columns = "name, price";
      break;
    case "toppings":
      table = "toppings";
      columns = "topping_name AS name, topping_price AS price";
      break;
    default:
      return res.status(400).json({ ok: false, error: "Invalid type" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT ${columns} FROM ${table} ORDER BY 1`
    );
    res.json({ ok: true, items: rows });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ ok: false, error: "Failed to fetch inventory" });
  }
});

// POST inventory item
app.post("/api/manager/inventory/:type", async (req, res) => {
  const type = req.params.type.toLowerCase();
  const item = req.body;
  let sql = "",
    params = [];

  try {
    switch (type) {
      case "supplies":
      case "ingredients":
        sql = `INSERT INTO ${type} (name, quantity) VALUES ($1, $2)`;
        params = [item.name, item.quantity];
        break;
      case "menuitems":
        sql = `INSERT INTO menu_items (name, price) VALUES ($1, $2)`;
        params = [item.name, item.price];
        break;
      case "toppings":
        sql = `INSERT INTO toppings (topping_name, topping_price) VALUES ($1, $2)`;
        params = [item.name, item.price];
        break;
      default:
        return res.status(400).json({ ok: false, error: "Invalid type" });
    }

    await pool.query(sql, params);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PUT inventory item
app.put("/api/manager/inventory/:type/:name", async (req, res) => {
  const type = req.params.type.toLowerCase();
  const name = req.params.name;
  const item = req.body;

  try {
    let sql = "",
      params = [];

    switch (type) {
      case "supplies":
      case "ingredients":
        sql = `UPDATE ${type} SET quantity=$1 WHERE name=$2`;
        params = [item.quantity, name];
        break;
      case "menuitems":
        sql = `UPDATE menu_items SET price=$1 WHERE name=$2`;
        params = [item.price, name];
        break;
      case "toppings":
        sql = `UPDATE toppings SET topping_price=$1 WHERE topping_name=$2`;
        params = [item.price, name];
        break;
      default:
        return res.status(400).json({ ok: false, error: "Invalid type" });
    }

    await pool.query(sql, params);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE inventory item
app.delete("/api/manager/inventory/:type", async (req, res) => {
  const type = req.params.type.toLowerCase();
  const { name } = req.body;

  try {
    switch (type) {
      case "supplies":
        await pool.query(`DELETE FROM supplies WHERE name=$1`, [name]);
        break;
      case "ingredients":
        await pool.query(
          `DELETE FROM menu_item_ingredients WHERE ingredient_name=$1`,
          [name]
        );
        await pool.query(`DELETE FROM ingredients WHERE name=$1`, [name]);
        break;
      case "menuitems":
        await pool.query(
          `DELETE FROM menu_item_ingredients WHERE menu_item_name=$1`,
          [name]
        );
        await pool.query(`DELETE FROM menu_items WHERE name=$1`, [name]);
        break;
      case "toppings":
        await pool.query(`DELETE FROM toppings WHERE topping_name=$1`, [name]);
        break;
      default:
        return res.status(400).json({ ok: false, error: "Invalid type" });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------- EMPLOYEES (MANAGER) ----------------------
app.get("/api/manager/employees", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT employee_id, employee_name, e_user, e_pass FROM employeeid ORDER BY employee_id"
    );
    res.json({ ok: true, employees: rows });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ ok: false, error: "Failed to fetch employees" });
  }
});

app.post("/api/manager/employees", async (req, res) => {
  const { employee_id, employee_name, e_user, e_pass } = req.body;

  if (!employee_id || !employee_name || !e_user || !e_pass) {
    return res.status(400).json({ ok: false, error: "Missing fields" });
  }

  try {
    const sql = `
      INSERT INTO employeeid (employee_id, employee_name, e_user, e_pass)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (employee_id)
      DO UPDATE SET
        employee_name = EXCLUDED.employee_name,
        e_user        = EXCLUDED.e_user,
        e_pass        = EXCLUDED.e_pass
    `;
    await pool.query(sql, [employee_id, employee_name, e_user, e_pass]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ ok: false, error: "Failed to add/update employee" });
  }
});

app.delete("/api/manager/employees/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query("DELETE FROM employeeid WHERE employee_id = $1", [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ ok: false, error: "Failed to delete employee" });
  }
});

// ---------------------- PRODUCT USAGE (MANAGER) ----------------------
app.get("/api/productusage", async (req, res) => {
    const { start, end } = req.query;

    if (!start || !end) {
        return res.status(400).json({ error: "Start and end dates required" });
    }

    try {
        const sql = `
            SELECT 
                mi.ingredient_name AS ingredient,
                COUNT(*) AS times_used
            FROM orders o
            JOIN menu_item_ingredients mi
                ON mi.menu_item_name = o.drink_name
            WHERE o.order_timestamp::date BETWEEN $1 AND $2
            GROUP BY mi.ingredient_name
            ORDER BY times_used DESC;
        `;
        
        const result = await pool.query(sql, [start, end]);

        res.json(result.rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database query failed" });
    }
});


// ---------------------- X-REPORT (MANAGER) ----------------------
app.get("/api/xreport", async (req, res) => {
  const { date, metric } = req.query;
  if (!date || !metric)
    return res.status(400).json({ error: "Missing parameters" });

  let sql = "";
  switch (metric) {
    case "totalSales":
      sql = `
        SELECT EXTRACT(HOUR FROM order_timestamp) AS hour,
               SUM(drink_price + topping_price) AS total_sales
        FROM orders
        WHERE DATE(order_timestamp) = $1
        GROUP BY hour
        ORDER BY hour;
      `;
      break;
    case "numOrders":
      sql = `
        SELECT EXTRACT(HOUR FROM order_timestamp) AS hour,
               COUNT(*) AS num_orders
        FROM orders
        WHERE DATE(order_timestamp) = $1
        GROUP BY hour
        ORDER BY hour;
      `;
      break;
    case "salesByEmployee":
      sql = `
        SELECT EXTRACT(HOUR FROM order_timestamp) AS hour,
               employee_name,
               SUM(drink_price + topping_price) AS total_sales
        FROM orders
        WHERE DATE(order_timestamp) = $1
        GROUP BY hour, employee_name
        ORDER BY hour, employee_name;
      `;
      break;
    default:
      return res.status(400).json({ error: "Invalid metric" });
  }

  try {
    const { rows } = await pool.query(sql, [date]);
    const labels = [];
    const values = [];

    if (metric === "salesByEmployee") {
      rows.forEach((r) => {
        const hourLabel = `${String(r.hour).padStart(2, "0")}:00`;
        const empLabel = r.employee_name || "Unknown";
        labels.push(`${hourLabel} (${empLabel})`);
        values.push(Number(r.total_sales));
      });
    } else if (metric === "totalSales") {
      rows.forEach((r) => {
        labels.push(`${String(r.hour).padStart(2, "0")}:00`);
        values.push(Number(r.total_sales));
      });
    } else {
      rows.forEach((r) => {
        labels.push(`${String(r.hour).padStart(2, "0")}:00`);
        values.push(Number(r.num_orders));
      });
    }

    res.json({ labels, values });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// ---------------------- Z-REPORT (MANAGER) ----------------------
app.get("/api/zreport", async (req, res) => {
  const { date, test } = req.query;
  if (!date) return res.status(400).json({ error: "Date required" });

  const isTest = test === "true";

  try {
    const totalsResult = await pool.query(
      `SELECT SUM(drink_price + topping_price) AS total_sales,
              COUNT(*) AS total_orders
       FROM orders
       WHERE DATE(order_timestamp) = $1`,
      [date]
    );

    const employeesResult = await pool.query(
      `SELECT DISTINCT employee_name
       FROM orders
       WHERE DATE(order_timestamp) = $1
       ORDER BY employee_name`,
      [date]
    );

    let totalSales = Number(totalsResult.rows[0].total_sales || 0);
    let totalOrders = Number(totalsResult.rows[0].total_orders || 0);
    let tax = totalSales * 0.1;
    let totalCash = totalSales + tax;

    let report = `===== DAILY Z-REPORT =====\n`;
    report += `Date: ${date}\n\n`;
    report += `Total Orders: ${totalOrders}\n`;
    report += `Total Sales: $${totalSales.toFixed(2)}\n`;
    report += `Tax (10%): $${tax.toFixed(2)}\n`;
    report += `Total Cash: $${totalCash.toFixed(2)}\n\n`;
    report += `--- Employee Signatures ---\n`;

    if (employeesResult.rows.length === 0) {
      report += "(No employees recorded today.)\n";
    } else {
      employeesResult.rows.forEach((emp) => {
        const name = emp.employee_name || "Unknown";
        report += `• Employee: ${name}\n`;
      });
    }

    report += `\n===========================\n`;

    if (!isTest) {
      await pool.query(
        `INSERT INTO zreport_log(report_date) VALUES($1) ON CONFLICT DO NOTHING`,
        [date]
      );
    }

    res.json({ report, message: isTest ? "Test mode: not recorded." : null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error generating Z-Report" });
  }
});

app.post("/api/zreport/reset", async (req, res) => {
  // Simulate reset without deleting orders
  res.json({ message: "Daily totals reset (orders retained)." });
});

// ---------------------- SERVER START ----------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/startpage.html`);
});
