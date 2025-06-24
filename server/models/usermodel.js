
import { query } from "../config/db.js";
import bcrypt from "bcryptjs";

const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || "12");

const UserModel = {
  async create({ email, password, name, role = 'student' }) {
    try {
      if (!['student', 'instructor'].includes(role)) {
        throw new Error('Invalid role specified. Must be student or instructor');
      }

      const hashPassword = await bcrypt.hash(password, saltRounds);
      const { rows } = await query(
        `INSERT INTO users (email, password_hash, name, role) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id, email, name, role, created_at`,
        [email, hashPassword, name, role]
      );

      return rows[0];
    } catch (error) {
      if (error.code === "23505") {
        throw new Error("Email already exists");
      }
      throw error;
    }
  },

  async createAdmin({ email, password, name }) {
    try {
      const adminExists = await this.adminExists();
      if (adminExists) {
        throw new Error('Admin account already exists');
      }

      const hashPassword = await bcrypt.hash(password, saltRounds);
      const { rows } = await query(
        `INSERT INTO users (email, password_hash, name, role) 
         VALUES ($1, $2, $3, 'admin') 
         RETURNING id, email, name, role, created_at`,
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

  async adminExists() {
    const { rows } = await query(
      `SELECT 1 FROM users WHERE role = 'admin' LIMIT 1`
    );
    return rows.length > 0;
  },

  async findByEmail(email) {
    const { rows } = await query(
      `SELECT id, email, name, role, password_hash, oauth_provider 
       FROM users WHERE email = $1`,
      [email]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const { rows } = await query(
      `SELECT id, email, name, role, oauth_provider, created_at 
       FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async validatePassword(email, plainPassword) {
    const user = await this.findByEmail(email);
    if (!user || !user.password_hash) return false;
    return await bcrypt.compare(plainPassword, user.password_hash);
  },

  async updatePassword(id, newPassword) {
    const hashPassword = await bcrypt.hash(newPassword, saltRounds);
    const { rows } = await query(
      `UPDATE users 
       SET password_hash = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING id, email, name, role`,
      [id, hashPassword]
    );
    return rows[0];
  },

  async update(id, userData) {
    const fields = Object.keys(userData).filter(key => userData[key] !== undefined);
    if (fields.length === 0) return await this.findById(id);
    
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = fields.map(field => userData[field]);
    
    const { rows } = await query(
      `UPDATE users 
       SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING id, email, name, role`,
      [id, ...values]
    );
    return rows[0];
  },

  async findAllWithPagination({ limit = 20, offset = 0 }) {
    const usersQuery = query(
      `SELECT id, email, name, role, created_at, updated_at 
       FROM users 
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    const countQuery = query(`SELECT COUNT(*) FROM users`);
    
    const [usersResult, countResult] = await Promise.all([usersQuery, countQuery]);
    
    return {
      users: usersResult.rows,
      total: parseInt(countResult.rows[0].count)
    };
  },

  async softDelete(id) {
    // Since you don't have is_active anymore, use DELETE
    const { rows } = await query(
      `DELETE FROM users 
       WHERE id = $1 
       RETURNING id, email, name, role`,
      [id]
    );
    return rows[0];
  },

  async createOAuthUser({ email, name, oauth_provider }) {
    try {
      const { rows } = await query(
        `INSERT INTO users (email, name, oauth_provider, role)
         VALUES ($1, $2, $3, 'student')
         RETURNING id, email, name, role, oauth_provider, created_at`,
        [email, name, oauth_provider]
      );
      return rows[0];
    } catch (error) {
      if (error.code === "23505") {
        throw new Error("Email already exists");
      }
      throw error;
    }
  },

  async findByGoogleId(googleId) {
    try {
      const { rows } = await query(
        'SELECT * FROM users WHERE oauth_id = $1 AND oauth_provider = $2',
        [googleId, 'google']
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  async createGoogleUser({ oauth_id, email, name, oauth_provider }) {
    try {
      // We're removing the duplicate email check here since it's now handled in the passport strategy
      const { rows } = await query(
        `INSERT INTO users (oauth_id, oauth_provider, email, name, role)
         VALUES ($1, $2, $3, $4, 'student')
         RETURNING id, email, name, role, oauth_id, oauth_provider, created_at`,
        [oauth_id, oauth_provider, email, name]
      );
      return rows[0];
    } catch (error) {
      // This will only happen if there's a database constraint violation
      // that isn't handled by the strategy (like a unique constraint on oauth_id)
      throw error;
    }
  }
};

export default UserModel;
