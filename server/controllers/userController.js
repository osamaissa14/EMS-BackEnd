import UserModel from "../models/usermodel.js";
import { generateToken, verifyPassword } from "../utils/helper.js";
import { registerSchema ,loginSchema,changePasswordSchema} from "../utils/validations.js";
const UserController = {
  // Register a new user
  async register(req, res, next) {
    try {
      const { error, value } = registerSchema.validate(req.body);
      if (error) throw new Error(error.details[0].message);
      // Validate the request body against the schema
      const { email, password, name } = value;

      // Check if the user already exists
      const existingUser = await UserModel.findByEmail(email);
      // If the user already exists, throw an error
      if (existingUser) throw new Error("Email already exists");
      // Use the UserModel to create a user
      const newUser = await UserModel.create({ email, password, name });

      // Use the helper function to generate a token
      const token = generateToken(newUser.id);

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
          },
          token: token,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // Login user
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Use the UserModel to find a user by email
      const user = await UserModel.findByEmail(email);

      // Use the helper function to verify password
      const isPasswordValid = await verifyPassword(password, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      // Use the helper function to generate a token
      const token = generateToken(user.id);

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          token,
        },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  },

  async login(req, res, next) {
    try {

     const { error, value } = loginSchema.validate(req.body);
      if (error) throw new Error(error.details[0].message);
      const { email, password } = value;
      const user = await UserModel.findByEmail(email);
      if (!user) throw new Error("Invalid credentials");
      const isPasswordValid = await verifyPassword(password, user.password);
      if (!isMatch) throw new Error("Invalid password");
      const token = generateToken(user.id);
      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          token,
        },
      });
          } catch (error) {
      next(error);
          }

  },
  async changePassword(req, res, next) {
    try{
       const { error, value } = changePasswordSchema.validate(req.body);
      if (error) throw new Error(error.details[0].message);
      const { currentPassword, newPassword } = value;
       const user = await UserModel.findByEmail(req.user.email);
      if (!user) throw new Error("Invalid credentials");
      const isMatch = await verifyPassword(currentPassword, user.password);
      if (!isMatch) throw new Error("Current password is incorrect");
      
      await UserModel.updatePassword(user.id, newPassword);
      res.json({
        success: true,
        message: "Password changed successfully",
      });
   
   
    }catch (error) {
      next(error);
    }
  }


};
export default UserController;
