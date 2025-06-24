import express from 'express';
import courseController from '../controllers/courseController.js';
import { authenticateToken, authorizeAdmin } from '../middleware/auth.js';

const router = express.Router();

/* ---------- Public ---------- */
router.get('/',                    courseController.getAllCourses);
router.get('/approved',            courseController.getApprovedCourses);
router.get('/featured',            courseController.getFeaturedCourses);

/* ---------- Admin-only routes ---------- */
router.get('/pending',             authenticateToken, authorizeAdmin, courseController.getPendingCourses);
router.get('/rejected',            authenticateToken, authorizeAdmin, courseController.getRejectedCourses);

/* ---------- Auth‑protected but   *specific* paths ---------- */
router.get('/instructor/me',       authenticateToken, courseController.getInstructorCourses);
router.get('/instructor',          authenticateToken, courseController.getInstructorCourses);
router.get('/instructor/:id',      authenticateToken, courseController.getInstructorCourses);

router.get('/enrolled',            authenticateToken, courseController.getEnrolledCourses);

router.put('/:id/publish',         authenticateToken, courseController.publishCourse);
router.put('/:id/unpublish',       authenticateToken, courseController.unpublishCourse);
router.put('/:id/approve',         authenticateToken, authorizeAdmin, courseController.approveCourse);
router.put('/:id/resubmit',        authenticateToken, courseController.resubmitCourse);

router.get('/:id/analytics',       authenticateToken, courseController.getCourseAnalytics);
router.post('/:id/announcements',  authenticateToken, courseController.createAnnouncement);

/* ---------- CRUD (auth‑protected) ---------- */
router.post('/',                   authenticateToken, courseController.createCourse);
router.put('/:id',                 authenticateToken, courseController.updateCourse);
router.delete('/:id',              authenticateToken, courseController.deleteCourse);

/* ---------- Catch‑all param route LAST ---------- */
router.get('/:id',                 courseController.getCourseById);

export default router;
