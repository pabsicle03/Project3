// server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV == "production"
    ? { rejectUnauthorized: false } : false,
});


app.use(express.json());

app.get("/healthz", (req, res) => res.json({ ok: true, message: "server up" }));

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

app.use("/Images", express.static(path.join(__dirname, "public", "Images")));

app.get("/api/drinks", async (req, res) => {
  const { series } = req.query;
  try {
    const params = [];
    let q = `
      SELECT drink_name, series_name, drink_price, file_name
      FROM drinks
    `;
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

// Add Orders to Database
app.post("/api/orders", async (req, res) => {
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
          o.toppings.join(", "),
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
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "startpage.html"));
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`API running on http://localhost:${PORT}/startpage.html`)
);

