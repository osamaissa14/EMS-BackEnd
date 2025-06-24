import EnrollmentModel from '../models/enrollmentModel.js';
import CourseModel from '../models/courseModel.js';
import LessonModel from '../models/lessonModel.js';
import NotificationModel from '../models/notificationModel.js';
import { createResponse } from '../utils/helper.js';

const enrollmentController = {
  // Enroll a user in a course
  async enrollInCourse(req, res) {
    try {
      const { course_id } = req.body;
      const user_id = req.user.id;

      // Validate required fields
      if (!course_id) {
        return res.status(400).json(createResponse(false, 'Course ID is required', null));
      }

      // Check if course exists, is published and approved
      const course = await CourseModel.findById(course_id);
      if (!course) {
        return res.status(404).json(createResponse(false, 'Course not found', null));
      }

      if (!course.is_published) {
        return res.status(400).json(createResponse(false, 'Cannot enroll in unpublished course', null));
      }

      if (course.status !== 'approved') {
        return res.status(400).json(createResponse(false, 'Cannot enroll in course that is not approved', null));
      }

      // Check if user is already enrolled
      const existingEnrollment = await EnrollmentModel.findByUserAndCourse(user_id, course_id);
      if (existingEnrollment) {
        return res.status(400).json(createResponse(false, 'Already enrolled in this course', existingEnrollment));
      }

      // Create enrollment
      const enrollment = await EnrollmentModel.create({
        user_id,
        course_id
      });

      // Create enrollment notification
      await NotificationModel.createEnrollmentNotification({
        user_id,
        course_id
      });

      return res.status(201).json(createResponse(true, 'Successfully enrolled in course', enrollment));
    } catch (error) {
      console.error('Error enrolling in course:', error);
      return res.status(500).json(createResponse(false, 'Failed to enroll in course', null));
    }
  },

  // Get all enrollments for the current user
  async getMyEnrollments(req, res) {
    try {
      const user_id = req.user.id;
      const { page = 1, limit = 10 } = req.query;
      const offset = (page - 1) * limit;

      // Get enrollments with course details
      const enrollments = await EnrollmentModel.findByUser(user_id, {
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      // Get total count for pagination
      const totalCount = await EnrollmentModel.countByUser(user_id);
      const totalPages = Math.ceil(totalCount / limit);

      return res.status(200).json(createResponse(true, 'Enrollments retrieved successfully', {
        enrollments,
        pagination: {
          total: totalCount,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages
        }
      }));
    } catch (error) {
      console.error('Error getting enrollments:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve enrollments', null));
    }
  },

  // Get enrollment details by ID
  async getEnrollmentById(req, res) {
    try {
      const { id } = req.params;
      
      // Get enrollment with course details
      const enrollment = await EnrollmentModel.findWithCourseDetails(id);
      
      if (!enrollment) {
        return res.status(404).json(createResponse(false, 'Enrollment not found', null));
      }

      // Check if user is authorized to view this enrollment
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && enrollment.instructor_id === req.user.id;
      const isEnrolledUser = req.user && enrollment.user_id === req.user.id;
      
      if (!isAdmin && !isInstructor && !isEnrolledUser) {
        return res.status(403).json(createResponse(false, 'Not authorized to view this enrollment', null));
      }

      return res.status(200).json(createResponse(true, 'Enrollment retrieved successfully', enrollment));
    } catch (error) {
      console.error('Error getting enrollment:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve enrollment', null));
    }
  },

  // Get all enrollments for a course (instructor/admin only)
  async getEnrollmentsByCourse(req, res) {
    try {
      const { course_id } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      // Check if course exists
      const course = await CourseModel.findById(course_id);
      if (!course) {
        return res.status(404).json(createResponse(false, 'Course not found', null));
      }

      // Check if user is authorized to view enrollments for this course
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to view enrollments for this course', null));
      }

      // Get enrollments with user details
      const enrollments = await EnrollmentModel.findByCourse(course_id, {
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      // Get total count for pagination
      const totalCount = await EnrollmentModel.countByCourse(course_id);
      const totalPages = Math.ceil(totalCount / limit);

      return res.status(200).json(createResponse(true, 'Enrollments retrieved successfully', {
        enrollments,
        pagination: {
          total: totalCount,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages
        }
      }));
    } catch (error) {
      console.error('Error getting course enrollments:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve course enrollments', null));
    }
  },

  // Update enrollment progress
  async updateProgress(req, res) {
    try {
      const { id } = req.params;
      const { progress } = req.body;
      const user_id = req.user.id;

      // Validate required fields
      if (progress === undefined || progress === null) {
        return res.status(400).json(createResponse(false, 'Progress value is required', null));
      }

      // Get enrollment
      const enrollment = await EnrollmentModel.findById(id);
      
      if (!enrollment) {
        return res.status(404).json(createResponse(false, 'Enrollment not found', null));
      }

      // Check if user is authorized to update this enrollment
      if (enrollment.user_id !== user_id) {
        return res.status(403).json(createResponse(false, 'Not authorized to update this enrollment', null));
      }

      // Update progress
      const updatedEnrollment = await EnrollmentModel.updateProgress(id, progress);

      return res.status(200).json(createResponse(true, 'Progress updated successfully', updatedEnrollment));
    } catch (error) {
      console.error('Error updating progress:', error);
      return res.status(500).json(createResponse(false, 'Failed to update progress', null));
    }
  },

  // Mark a lesson as completed
  async markLessonCompleted(req, res) {
    try {
      const { lesson_id } = req.params;
      const user_id = req.user.id;

      // Mark lesson as completed
      const result = await LessonModel.markLessonCompleted(lesson_id, user_id);
      
      if (!result) {
        return res.status(404).json(createResponse(false, 'Lesson not found or not enrolled in the course', null));
      }

      // Get updated course progress
      const courseProgress = await LessonModel.getCourseProgress(result.course_id, user_id);

      // Update enrollment progress if course progress is available
      if (courseProgress && courseProgress.enrollment_id) {
        await EnrollmentModel.updateProgress(courseProgress.enrollment_id, courseProgress.progress);

        // If course is completed (100%), mark enrollment as completed
        if (courseProgress.progress === 100) {
          await EnrollmentModel.markCompleted(courseProgress.enrollment_id);
        }
      }

      return res.status(200).json(createResponse(true, 'Lesson marked as completed', {
        lessonProgress: result,
        courseProgress
      }));
    } catch (error) {
      console.error('Error marking lesson as completed:', error);
      return res.status(500).json(createResponse(false, 'Failed to mark lesson as completed', null));
    }
  },

  // Get course progress for a user
  async getCourseProgress(req, res) {
    try {
      const { course_id } = req.params;
      const user_id = req.user.id;

      // Check if user is enrolled in the course
      const enrollment = await EnrollmentModel.findByUserAndCourse(user_id, course_id);
      
      if (!enrollment) {
        return res.status(404).json(createResponse(false, 'Not enrolled in this course', null));
      }

      // Get course progress with lesson details
      const progress = await LessonModel.getCourseProgress(course_id, user_id);

      return res.status(200).json(createResponse(true, 'Course progress retrieved successfully', progress));
    } catch (error) {
      console.error('Error getting course progress:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve course progress', null));
    }
  },

  // Unenroll from a course
  async unenrollFromCourse(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user.id;

      // Get enrollment
      const enrollment = await EnrollmentModel.findById(id);
      
      if (!enrollment) {
        return res.status(404).json(createResponse(false, 'Enrollment not found', null));
      }

      // Check if user is authorized to delete this enrollment
      const isAdmin = req.user && req.user.role === 'admin';
      
      if (enrollment.user_id !== user_id && !isAdmin) {
        return res.status(403).json(createResponse(false, 'Not authorized to unenroll from this course', null));
      }

      // Delete enrollment
      await EnrollmentModel.delete(id);

      return res.status(200).json(createResponse(true, 'Successfully unenrolled from course', null));
    } catch (error) {
      console.error('Error unenrolling from course:', error);
      return res.status(500).json(createResponse(false, 'Failed to unenroll from course', null));
    }
  },

  // Get recent enrollments (for dashboard)
  async getRecentEnrollments(req, res) {
    try {
      const { limit = 5 } = req.query;

      // Check if user is admin
      const isAdmin = req.user && req.user.role === 'admin';
      
      if (!isAdmin) {
        return res.status(403).json(createResponse(false, 'Not authorized to view recent enrollments', null));
      }

      // Get recent enrollments
      const enrollments = await EnrollmentModel.getRecentEnrollments(parseInt(limit));

      return res.status(200).json(createResponse(true, 'Recent enrollments retrieved successfully', enrollments));
    } catch (error) {
      console.error('Error getting recent enrollments:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve recent enrollments', null));
    }
  },

  // Get enrollment statistics
  async getEnrollmentStatistics(req, res) {
    try {
      // Check if user is admin
      const isAdmin = req.user && req.user.role === 'admin';
      
      if (!isAdmin) {
        return res.status(403).json(createResponse(false, 'Not authorized to view enrollment statistics', null));
      }

      // Get enrollment statistics
      const statistics = await EnrollmentModel.getStatistics();

      return res.status(200).json(createResponse(true, 'Enrollment statistics retrieved successfully', statistics));
    } catch (error) {
      console.error('Error getting enrollment statistics:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve enrollment statistics', null));
    }
  },

  // Get all enrollments for instructor's courses
  async getEnrollmentsForInstructor(req, res) {
    try {
      const instructor_id = req.user.id;
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      // Check if user is instructor or admin
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && req.user.role === 'instructor';
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to view instructor enrollments', null));
      }

      // Get enrollments for instructor's courses
      const enrollments = await EnrollmentModel.findEnrollmentsByInstructor(instructor_id, {
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      // Get total count for pagination
      const totalCount = await EnrollmentModel.countEnrollmentsByInstructor(instructor_id);
      const totalPages = Math.ceil(totalCount / limit);

      return res.status(200).json(createResponse(true, 'Instructor enrollments retrieved successfully', {
        enrollments,
        pagination: {
          total: totalCount,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages
        }
      }));
    } catch (error) {
      console.error('Error fetching instructor enrollments:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve instructor enrollments', null));
    }
  },

  // Get instructor-specific stats
  async getInstructorStats(req, res) {
    try {
      const instructor_id = req.user.id;
      
      // Check if user is instructor or admin
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && req.user.role === 'instructor';
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to view instructor stats', null));
      }

      const stats = await EnrollmentModel.getStatsForInstructor(instructor_id);

      return res.status(200).json(createResponse(true, 'Instructor stats retrieved successfully', stats));
    } catch (error) {
      console.error('Error getting instructor stats:', error);
      return res.status(500).json(createResponse(false, 'Failed to get instructor stats', null));
    }
  }
};

export default enrollmentController;