import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { query } from "../config/db.js";
// Function to generate a JWT token
function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.JWT_EXPIRES_IN || "1d",
  });
}

async function verifyPassword(password, hashPassword) {
  return await bcrypt.compare(password, hashPassword);
}

async function updatePassword(userId, newPassword){
    const hashNewPassword=await bcrypt.hash(
        newPassword,
        parseInt(process.env.BCRYPT_SALT_ROUNDS)
    );
    await query(
        `UPDATE users SET password = $1 WHERE id = $2`,
        [hashNewPassword, userId]
    );

}

export { generateToken, verifyPassword, updatePassword };