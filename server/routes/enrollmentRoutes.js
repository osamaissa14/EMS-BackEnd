import express from 'express';
import enrollmentController from '../controllers/enrollmentController.js';
import { authenticateToken, authorizeAdmin, authorizeInstructor } from '../middleware/auth.js';

const router = express.Router();

// Protected routes (require authentication)
router.post('/', authenticateToken, enrollmentController.enrollInCourse);
router.get('/user', authenticateToken, enrollmentController.getMyEnrollments);
router.get('/:id', authenticateToken, enrollmentController.getEnrollmentById); // Includes authorization check inside controller
router.delete('/:id', authenticateToken, enrollmentController.unenrollFromCourse); // Includes authorization check inside controller

// Instructor routes
router.get('/course/:course_id', authenticateToken, enrollmentController.getEnrollmentsByCourse); // Includes authorization check inside controller

// Admin routes
router.get('/recent', authenticateToken, authorizeAdmin, enrollmentController.getRecentEnrollments);
router.get('/stats', authenticateToken, authorizeAdmin, enrollmentController.getEnrollmentStatistics);

export default router;