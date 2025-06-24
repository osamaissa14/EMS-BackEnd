import express from 'express';
import userController from '../controllers/userController.js';
import { authenticateToken, authorizeAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/register', userController.register);
router.post('/login', userController.login);

// Protected routes
router.get('/profile', authenticateToken, userController.getProfile);
router.put('/profile', authenticateToken, userController.updateProfile);
router.put('/change-password', authenticateToken, userController.changePassword);
router.delete('/account', authenticateToken, userController.deleteAccount);

// Admin routes
router.get('/', authenticateToken, authorizeAdmin, userController.getUsers);
router.put('/:userId/role', authenticateToken, authorizeAdmin, userController.updateUserRole);
router.delete('/:id', authenticateToken, authorizeAdmin, userController.deleteUser);

export default router;