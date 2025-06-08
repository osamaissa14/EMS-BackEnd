import { query } from "../config/db.js"
import bcrypt from "bcryptjs";
const UserModel = {
  async create({ email, password, name }) {
    try {
      const hashPassword = await bcrypt.hash(
        password,
        parseInt(process.env.BCRYPT_SALT_ROUNDS) 
     );

      const { rows } = await query(
        `INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING *`,
        [email, hashPassword, name]
      );
      return rows[0];
    } catch (error) {
      if (error.code === "23505") {
        throw new Error("Email already exists");
      }
      throw error;
    }
  },

  async findByEmail(email) {
    try {
    const { rows } = await query(`SELECT * FROM users WHERE email = $1`, [
      email,
    ]);
    if (rows.length > 0) {
        return rows[0];
    }
  } catch (error) {
    throw error;
}
},
 async findById(id) {

    const { rows } = await query(`SELECT * FROM users WHERE id = $1`, [
      id,
    ]);
    
return rows[0];
},

}

export default UserModel;