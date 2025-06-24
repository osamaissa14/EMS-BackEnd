import pg from "pg";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pg;

// Log the database URL (safe in development only)
if (process.env.NODE_ENV !== "production") {
  
}

// Database pool configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 20,                    // Maximum number of clients in the pool
});

// Handle idle client errors
pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

// Function to test the connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log("✅ Database connected successfully");
    client.release();
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);
  }
};

// Helper for executing queries (clean and reusable)
const query = (text, params) => pool.query(text, params);

export { pool, query, testConnection };