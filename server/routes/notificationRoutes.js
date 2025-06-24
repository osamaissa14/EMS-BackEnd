import express from 'express';
import notificationController from '../controllers/notificationController.js';
import { authenticateToken, authorizeAdmin } from '../middleware/auth.js';

const router = express.Router();

// Protected routes (require authentication)
router.get('/', authenticateToken, notificationController.getUserNotifications);
router.get('/count', authenticateToken, notificationController.getUnreadCount);
router.get('/:id', authenticateToken, notificationController.getNotificationById);
router.put('/:id/read', authenticateToken, notificationController.markAsRead);
router.put('/read-all', authenticateToken, notificationController.markAllAsRead);
router.delete('/:id', authenticateToken, notificationController.deleteNotification);
router.delete('/all', authenticateToken, notificationController.deleteAllNotifications);

// Admin routes
router.post('/system', authenticateToken, authorizeAdmin, notificationController.createSystemNotification);

// Instructor routes (authorization check inside controller)
router.post('/course/:course_id/announcement', authenticateToken, notificationController.createCourseAnnouncement);

export default router;