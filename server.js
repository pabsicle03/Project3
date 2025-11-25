// server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import pkg from "pg";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();
const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Serve static files from public/
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

// Serve images separately (optional if Images is inside public)
app.use("/Images", express.static(path.join(__dirname, "public", "Images")));

app.use(express.json());

// Database setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// Health check
app.get("/healthz", (req, res) => res.json({ ok: true, message: "server up" }));

// Menu endpoints
app.get("/api/menu", async (req, res) => {
  try {
    const sql = `
      SELECT drink_name, series_name, qty_remaining, drink_price, file_name
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
    let q = `SELECT drink_name, series_name, drink_price, file_name FROM drinks`;
    if (series) {
      q += ` WHERE series_name = $1`;
      params.push(series);
    }
    q += ` ORDER BY series_name NULLS LAST, drink_name`;

    const { rows } = await pool.query(q, params);

    const data = rows.map(r => ({
      name: r.drink_name,
      series: r.series_name,
      price: Number(r.drink_price ?? 0),
      imageUrl: r.file_name ? `/Images/${r.file_name}` : `/Images/placeholder.png`,
    }));

    res.json({ drinks: data });
  } catch (err) {
    console.error("Failed to fetch drinks:", err);
    res.status(500).json({ error: "Failed to fetch drinks" });
  }
});

// ---------------------- ORDERS ----------------------

// shared handler so you can support both /orders and /api/orders
async function handleOrdersPost(req, res) {
  const { orders } = req.body;

  if (!Array.isArray(orders) || orders.length === 0) {
    return res.status(400).json({ error: "No orders provided" });
  }

  try {
    for (const o of orders) {
      await pool.query(
        `INSERT INTO orders 
          (drink_name, ice_level, sweetness_level, topping_used, drink_price, topping_price, employeeid_managerid, allergies, order_timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          o.name,
          o.iceLevel,
          o.sweetness,
          Array.isArray(o.toppings) ? o.toppings.join(", ") : "",
          o.basePrice,
          o.toppingsCost,
          "00001",
          "N/A"
        ]
      );
    }

    res.status(200).json({ ok: true, message: "Orders inserted successfully" });
  } catch (err) {
    console.error("Error inserting orders:", err);
    res.status(500).json({ ok: false, error: "Database insert failed" });
  }
}

app.post("/api/orders", handleOrdersPost);
app.post("/orders", handleOrdersPost); // alias for older front-end code

// ---------------------- BASIC PAGES ----------------------

// Serve startpage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "startpage.html"));
});

// Serve cashier pages
app.get("/cashier/:page", (req, res) => {
  const page = req.params.page;
  res.sendFile(path.join(__dirname, "public", "cashier", page));
});

// Serve manager pages
app.get("/manager/:page", (req, res) => {
  const page = req.params.page;
  const allowedPages = [
    "employee", "inventory", "itemedits",
    "orderingtrends", "productusage", "xreport", "zreport"
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
    const city = "College Station,US"; // hardcoded for now
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=imperial&appid=${apiKey}`;

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

// ---------------------- ORDERING TRENDS ----------------------
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
      revenue: revenue.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to fetch ordering trends" });
  }
});

// ---------------------- INVENTORY ----------------------

// GET inventory
app.get("/api/manager/inventory/:type", async (req, res) => {
  const type = req.params.type.toLowerCase();
  let table = "", columns = "";

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
    const { rows } = await pool.query(`SELECT ${columns} FROM ${table} ORDER BY 1`);
    res.json({ ok: true, items: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to fetch inventory" });
  }
});

// POST: add new item
app.post("/api/manager/inventory/:type", async (req, res) => {
  const type = req.params.type.toLowerCase();
  const item = req.body;
  let sql = "", params = [];

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

// PUT: update item (quantity/price only, no renaming)
app.put("/api/manager/inventory/:type/:name", async (req, res) => {
  const type = req.params.type.toLowerCase();
  const name = req.params.name;
  const item = req.body;

  try {
    let sql = "", params = [];

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

// DELETE item (cascade safe)
app.delete("/api/manager/inventory/:type", async (req, res) => {
  const type = req.params.type.toLowerCase();
  const { name } = req.body;

  try {
    switch (type) {
      case "supplies":
        await pool.query(`DELETE FROM supplies WHERE name=$1`, [name]);
        break;
      case "ingredients":
        await pool.query(`DELETE FROM menu_item_ingredients WHERE ingredient_name=$1`, [name]);
        await pool.query(`DELETE FROM ingredients WHERE name=$1`, [name]);
        break;
      case "menuitems":
        await pool.query(`DELETE FROM menu_item_ingredients WHERE menu_item_name=$1`, [name]);
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

// ---------------------- EMPLOYEES ----------------------
app.get("/api/manager/employees", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT employee_id, employee_name FROM employeeid ORDER BY employee_id"
    );
    res.json({ ok: true, employees: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to fetch employees" });
  }
});

// POST: add or update employee
app.post("/api/manager/employees", async (req, res) => {
  const { employee_id, employee_name } = req.body;
  if (!employee_id || !employee_name) {
    return res.status(400).json({ ok: false, error: "Missing fields" });
  }

  try {
    const sql = `
      INSERT INTO employeeid (employee_id, employee_name)
      VALUES ($1, $2)
      ON CONFLICT (employee_id)
      DO UPDATE SET employee_name = EXCLUDED.employee_name
    `;
    await pool.query(sql, [employee_id, employee_name]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to add/update employee" });
  }
});

// DELETE: remove employee
app.delete("/api/manager/employees/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query("DELETE FROM employeeid WHERE employee_id=$1", [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to delete employee" });
  }
});

// ---------------------- PRODUCT USAGE (MANAGER) ----------------------
// NOTE: path updated to /api/productusage to match frontend JS
app.get("/api/productusage", async (req, res) => {
  const { start, end } = req.query;

  if (!start || !end) {
    return res.status(400).json({ error: "Start and end dates required" });
  }

  try {
    const query = `
      SELECT drink_name AS product_name, COUNT(*) AS quantity_used
      FROM orders
      WHERE order_timestamp::date BETWEEN $1 AND $2
      GROUP BY drink_name
      ORDER BY quantity_used DESC;
    `;
    const result = await pool.query(query, [start, end]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database query failed" });
  }
});

// ---------------------- X-REPORT API ----------------------
app.get("/api/xreport", async (req, res) => {
  const { date, metric } = req.query;
  if (!date || !metric) return res.status(400).json({ error: "Missing parameters" });

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
               employeeid_managerid,
               SUM(drink_price + topping_price) AS total_sales
        FROM orders
        WHERE DATE(order_timestamp) = $1
        GROUP BY hour, employeeid_managerid
        ORDER BY hour, employeeid_managerid;
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
      rows.forEach(r => {
        labels.push(`${String(r.hour).padStart(2, "0")}:00 (${r.employeeid_managerid})`);
        values.push(Number(r.total_sales));
      });
    } else if (metric === "totalSales") {
      rows.forEach(r => {
        labels.push(`${String(r.hour).padStart(2, "0")}:00`);
        values.push(Number(r.total_sales));
      });
    } else {
      // numOrders
      rows.forEach(r => {
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

// ---------------------- Z-REPORT ROUTES ----------------------
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
      `SELECT DISTINCT employeeid_managerid
       FROM orders
       WHERE DATE(order_timestamp) = $1
       ORDER BY employeeid_managerid`,
      [date]
    );

    let totalSales = Number(totalsResult.rows[0].total_sales || 0);
    let totalOrders = Number(totalsResult.rows[0].total_orders || 0);
    let tax = totalSales * 0.10;
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
      employeesResult.rows.forEach(emp => {
        report += `• Employee ID: ${emp.employeeid_managerid}\n`;
      });
    }

    report += "\n===========================\n";

    // Only log non-test runs
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
