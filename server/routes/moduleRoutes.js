
import express from 'express';
import moduleController from '../controllers/moduleController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get modules for a course (public for published courses, protected for unpublished)
router.get('/course/:course_id', moduleController.getModulesByCourse);

// Get a single module with its lessons
router.get('/:id', moduleController.getModuleById);

// Protected routes (require authentication)
router.post('/', authenticateToken, moduleController.createModule); // Includes authorization check inside controller
router.put('/:id', authenticateToken, moduleController.updateModule); // Includes authorization check inside controller
router.delete('/:id', authenticateToken, moduleController.deleteModule); // Includes authorization check inside controller
router.put('/course/:course_id/reorder', authenticateToken, moduleController.reorderModules); // Includes authorization check inside controller

export default router;