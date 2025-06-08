import bg from "pg";
import dotenv from "dotenv"
dotenv.config();

const {Pool} = bg;
// Create a connection pool to the database
const pool=new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: 
        process.env.NODE_ENV ==="production"
         ? { rejectUnauthorized: false } 
         : false
});
pool.connect().then(()=>{
    console.log("Connected to the database successfully");
})

export const query = (text, params) => pool.query(text, params);

// Export the pool for use in other modules
export default pool;