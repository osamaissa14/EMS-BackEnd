import UserModel from "../models/usermodel.js";
import {
  generateToken,
  generateRefreshToken,
  verifyPassword,
  hashPassword,
  generateVerificationToken,
  verifyVerificationToken
} from "../utils/helper.js";
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  updateProfileSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  adminRegisterSchema
} from "../utils/validations.js";
import { sendEmail } from "../services/emailService.js";
import rateLimit from "express-rate-limit";

// Constants
const USER_RESPONSE_FIELDS = ['id', 'email', 'name', 'role', 'isVerified', 'avatar'];
const AUTH_RATE_LIMITER = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many login attempts, please try again later"
});

// Helper function to format user responses
const formatUserResponse = (user) => {
  return USER_RESPONSE_FIELDS.reduce((obj, field) => {
    if (user[field] !== undefined) obj[field] = user[field];
    return obj;
  }, {});
};

const UserController = {
  /**
   * Register a new student or constructor
   */
  async register(req, res, next) {
    try {
      const { error, value } = registerSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          details: error.details
        });
      }

      const { email, password, name, role = 'student' } = value;

      // Prevent admin registration through this endpoint
      if (role === 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Cannot register as admin'
        });
      }

      const existingUser = await UserModel.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      const newUser = await UserModel.create({ 
        email, 
        password, 
        name,
        role 
      });

      // Generate verification token and send email
      const verificationToken = generateVerificationToken(newUser.id);
      try {
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        await sendEmail({
          to: email,
          subject: 'Verify Your Email',
          template: 'verify-email',
          context: {
            name,
            verificationLink: `${baseUrl}/verify-email?token=${verificationToken}`
          }
        });
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
      }

      // Generate auth tokens
      const accessToken = generateToken(newUser.id);
      const refreshToken = generateRefreshToken(newUser.id);

      return res.status(201).json({
        success: true,
        data: {
          user: formatUserResponse(newUser),
          tokens: {
            access: accessToken,
            refresh: refreshToken
          },
          message: 'Registration successful. Please check your email for verification instructions.'
        }
      });

    } catch (error) {
      next(error);
    }
  },

  /**
   * Create the initial admin account (one-time use)
   */
  async createAdminAccount(req, res, next) {
    try {
      const { error, value } = adminRegisterSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          details: error.details
        });
      }

      const { email, password, name } = value;

      // Check if admin already exists
      const adminExists = await UserModel.adminExists();
      if (adminExists) {
        return res.status(403).json({
          success: false,
          message: 'Admin account already exists'
        });
      }

      // Create admin with stronger password requirements
      const adminUser = await UserModel.createAdmin({ 
        email, 
        password, 
        name 
      });

      // Generate tokens (admin gets immediate access)
      const accessToken = generateToken(adminUser.id);
      const refreshToken = generateRefreshToken(adminUser.id);

      return res.status(201).json({
        success: true,
        data: {
          user: formatUserResponse(adminUser),
          tokens: {
            access: accessToken,
            refresh: refreshToken
          },
          message: 'Admin account created successfully'
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Login for all user types WITHOUT isVerified check
   */
  login: [async (req, res, next) => {
    try {
      const { error, value } = loginSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          details: error.details
        });
      }
      
      const { email, password } = value;
      const user = await UserModel.findByEmail(email);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
      
      // Removed the isVerified check here
      
      const isPasswordValid = await UserModel.validatePassword(email, password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      await UserModel.update(user.id, { last_login: new Date() });

      const accessToken = generateToken(user.id);
      const refreshToken = generateRefreshToken(user.id);

      res.json({
        success: true,
        data: {
          user: formatUserResponse(user),
          tokens: {
            access: accessToken,
            refresh: refreshToken
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }],

  /**
   * Change password for any user
   */
  async changePassword(req, res, next) {
    try {
      const { error, value } = changePasswordSchema.validate(req.body);
      if (error) throw new Error(error.details[0].message);
      
      const { currentPassword, newPassword } = value;
      const user = await UserModel.findById(req.user.id);
      
      if (!user) throw new Error('User not found');
      
      const isMatch = await UserModel.validatePassword(user.email, currentPassword);
      if (!isMatch) throw new Error('Current password is incorrect');

      await UserModel.updatePassword(user.id, newPassword);

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get current user profile
   */
  async getProfile(req, res, next) {
    try {
      const user = await UserModel.findById(req.user.id);
      if (!user) throw new Error('User not found');
      
      res.json({
        success: true,
        data: {
          user: formatUserResponse(user)
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update user profile
   */
  async updateProfile(req, res, next) {
    try {
      const { error, value } = updateProfileSchema.validate(req.body);
      if (error) throw new Error(error.details[0].message);
      
      const { name, email, avatar } = value;
      const userId = req.user.id;

      // Prevent role changes through this endpoint
      if (value.role && value.role !== req.user.role) {
        throw new Error('Cannot change role through this endpoint');
      }

      const updatedUser = await UserModel.update(userId, { 
        name,
        email,
        avatar
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: formatUserResponse(updatedUser)
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Admin-only: Get all users
   */
  async getUsers(req, res, next) {
    try {
      if (req.user.role !== 'admin') {
        throw new Error('Unauthorized');
      }
      
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;
      
      const { users, total } = await UserModel.findAllWithPagination({
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      
      res.json({
        success: true,
        data: {
          users: users.map(user => formatUserResponse(user)),
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Admin-only: Update user roles
   */
  async updateUserRole(req, res, next) {
    try {
      if (req.user.role !== 'admin') {
        throw new Error('Unauthorized');
      }
      
      const { userId } = req.params;
      const { role } = req.body;
      
      if (!['student', 'instructor'].includes(role)) {
        throw new Error('Invalid role specified');
      }
      
      // Prevent admin from modifying their own role
      if (userId === req.user.id) {
        throw new Error('Cannot modify your own role');
      }
      
      const updatedUser = await UserModel.update(userId, { role });
      
      res.json({
        success: true,
        message: 'User role updated successfully',
        data: {
          user: formatUserResponse(updatedUser)
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete user's own account
   */
  async deleteAccount(req, res, next) {
    try {
      const userId = req.user.id;
      
      // Soft delete the user account
      const deletedUser = await UserModel.softDelete(userId);
      
      if (!deletedUser) {
        throw new Error('Failed to delete account');
      }
      
      res.json({
        success: true,
        message: 'Account deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Admin-only: Delete a user by ID
   */
  async deleteUser(req, res, next) {
    try {
      if (req.user.role !== 'admin') {
        throw new Error('Unauthorized');
      }
      
      const { id } = req.params;
      
      // Prevent admin from deleting their own account through this endpoint
      if (id === req.user.id) {
        throw new Error('Cannot delete your own account through this endpoint');
      }
      
      const deletedUser = await UserModel.softDelete(id);
      
      if (!deletedUser) {
        throw new Error('User not found or could not be deleted');
      }
      
      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  },

  async findByGoogleId(googleId) {
    const { rows } = await query(
      `SELECT id, email, name, role, avatar, provider, google_id, created_at
       FROM users WHERE google_id = $1 AND provider = 'google'`,
      [googleId]
    );
    return rows[0] || null;
  },

  async createGoogleUser({ google_id, email, name, avatar, provider }) {
    try {
      const { rows } = await query(
        `INSERT INTO users (google_id, email, name, avatar, provider, role)
         VALUES ($1, $2, $3, $4, $5, 'student')
         RETURNING id, email, name, role, avatar, provider, google_id, created_at`,
        [google_id, email, name, avatar, provider]
      );
      return rows[0];
    } catch (error) {
      if (error.code === "23505") {
        throw new Error("Email already exists");
      }
      throw error;
    }
  },
};

export default UserController;
