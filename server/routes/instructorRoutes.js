import express from 'express';
import { authenticateToken, authorizeInstructor } from '../middleware/auth.js';
import * as instructorController from '../controllers/instructorController.js';

const router = express.Router();

// All instructor routes require authentication and instructor role
router.use(authenticateToken);
router.use(authorizeInstructor);

// Instructor analytics
router.get('/analytics', instructorController.getAnalytics);

// Instructor activity feed
router.get('/activity', instructorController.getActivity);

// Instructor tasks/pending items
router.get('/tasks', instructorController.getTasks);

export default router;