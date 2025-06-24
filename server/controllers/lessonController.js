

import LessonModel from '../models/lessonModel.js';
import ModuleModel from '../models/moduleModel.js';
import CourseModel from '../models/courseModel.js';
import NotificationModel from '../models/notificationModel.js';
import { createResponse } from '../utils/helper.js';

const lessonController = {
  // Create a new lesson
  async createLesson(req, res) {
    try {
      const { title, content, module_id, video_url = null, duration = null, is_free = false, content_type = null } = req.body;

      // Convert duration to integer if provided
      const parsedDuration = duration ? parseInt(duration) : null;
      const parsedModuleId = parseInt(module_id);

      // Validate required fields
      if (!title || !parsedModuleId) {
        return res.status(400).json(createResponse(false, 'Title and module ID are required', null));
      }

      // Check if module exists
      const module = await ModuleModel.findById(parsedModuleId);
      if (!module) {
        return res.status(404).json(createResponse(false, 'Module not found', null));
      }

      // Determine content type if not provided
      let finalContentType = content_type;
      if (!finalContentType) {
        if (video_url) {
          finalContentType = 'video';
        } else if (content) {
          finalContentType = 'text';
        }
      }

      // Create lesson
      const lesson = await LessonModel.create({
        title,
        content,
        content_type: finalContentType,
        module_id: parsedModuleId,
        video_url,
        duration: parsedDuration,
        is_free
      });

      // Notify enrolled students about new lesson
      await NotificationModel.createCourseContentUpdateNotification({
        course_id: module.course_id,
        lesson_id: lesson.id,
        update_type: 'new_lesson',
        content_title: title
      });

      return res.status(201).json(createResponse(true, 'Lesson created successfully', lesson));
    } catch (error) {
      console.error('Error creating lesson:', error);
      return res.status(500).json(createResponse(false, 'Failed to create lesson', null));
    }
  },

  // Get all lessons for a module
  async getLessonsByModule(req, res) {
    try {
      const { module_id } = req.params;
      const parsedModuleId = parseInt(module_id);

      // Check if module exists
      const module = await ModuleModel.findById(parsedModuleId);
      if (!module) {
        return res.status(404).json(createResponse(false, 'Module not found', null));
      }

      // Get lessons for this module
      const lessons = await LessonModel.findByModule(parsedModuleId);

      return res.status(200).json(createResponse(true, 'Lessons retrieved successfully', lessons));
    } catch (error) {
      console.error('Error getting lessons:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve lessons', null));
    }
  },

  // Get a single lesson by ID
  async getLessonById(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user ? req.user.id : null;
      const parsedId = parseInt(id);
      
      // Get lesson
      const lesson = await LessonModel.findById(parsedId);
      
      if (!lesson) {
        return res.status(404).json(createResponse(false, 'Lesson not found', null));
      }

      // Get module and course to check authorization
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      // Check if user has access to this lesson
      if (!course.is_published && (!user_id || (user_id !== course.instructor_id && req.user?.role !== 'admin'))) {
        return res.status(403).json(createResponse(false, 'Access denied to unpublished course content', null));
      }

      // For published courses, check if lesson is free or user is enrolled
      if (course.is_published && !lesson.is_free) {
        if (!user_id) {
          return res.status(401).json(createResponse(false, 'Authentication required', null));
        }
        
        // Check if user is enrolled, instructor, or admin
        const isEnrolled = await LessonModel.isUserEnrolledInCourse(user_id, course.id);
        const hasAccess = isEnrolled || user_id === course.instructor_id || req.user?.role === 'admin';
        
        if (!hasAccess) {
          return res.status(403).json(createResponse(false, 'Enrollment required to access this lesson', null));
        }
      }

      return res.status(200).json(createResponse(true, 'Lesson retrieved successfully', lesson));
    } catch (error) {
      console.error('Error getting lesson:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve lesson', null));
    }
  },

  // Update a lesson
  async updateLesson(req, res) {
    try {
      const { id } = req.params;
      const { title, content, order_index, duration } = req.body;
      const user_id = req.user.id;
      const user_role = req.user.role;
      const parsedId = parseInt(id);

      // Get lesson
      const lesson = await LessonModel.findById(parsedId);
      if (!lesson) {
        return res.status(404).json(createResponse(false, 'Lesson not found', null));
      }

      // Get module and course to check authorization
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      // Check authorization (only instructor of the course or admin can update)
      if (user_role !== 'admin' && user_id !== course.instructor_id) {
        return res.status(403).json(createResponse(false, 'Not authorized to update this lesson', null));
      }

      // Update lesson
      const updatedLesson = await LessonModel.update(parsedId, {
        title,
        content,
        order_index: order_index ? parseInt(order_index) : undefined,
        duration: duration ? parseInt(duration) : undefined
      });

      return res.status(200).json(createResponse(true, 'Lesson updated successfully', updatedLesson));
    } catch (error) {
      console.error('Error updating lesson:', error);
      return res.status(500).json(createResponse(false, 'Failed to update lesson', null));
    }
  },

  // Delete a lesson
  async deleteLesson(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user.id;
      const user_role = req.user.role;
      const parsedId = parseInt(id);

      // Get lesson
      const lesson = await LessonModel.findById(parsedId);
      if (!lesson) {
        return res.status(404).json(createResponse(false, 'Lesson not found', null));
      }

      // Get module and course to check authorization
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      // Check authorization (only instructor of the course or admin can delete)
      if (user_role !== 'admin' && user_id !== course.instructor_id) {
        return res.status(403).json(createResponse(false, 'Not authorized to delete this lesson', null));
      }

      // Delete lesson
      await LessonModel.delete(parsedId);

      return res.status(200).json(createResponse(true, 'Lesson deleted successfully', null));
    } catch (error) {
      console.error('Error deleting lesson:', error);
      return res.status(500).json(createResponse(false, 'Failed to delete lesson', null));
    }
  },

  // Reorder lessons within a module
  async reorderLessons(req, res) {
    try {
      const { module_id } = req.params;
      const { lesson_orders } = req.body; // Array of { lesson_id, order_index }
      const user_id = req.user.id;
      const user_role = req.user.role;
      const parsedModuleId = parseInt(module_id);

      // Check if module exists
      const module = await ModuleModel.findById(parsedModuleId);
      if (!module) {
        return res.status(404).json(createResponse(false, 'Module not found', null));
      }

      // Get course to check authorization
      const course = await CourseModel.findById(module.course_id);

      // Check authorization (only instructor of the course or admin can reorder)
      if (user_role !== 'admin' && user_id !== course.instructor_id) {
        return res.status(403).json(createResponse(false, 'Not authorized to reorder lessons', null));
      }

      // Validate lesson_orders format
      if (!Array.isArray(lesson_orders)) {
        return res.status(400).json(createResponse(false, 'lesson_orders must be an array', null));
      }

      // Update lesson orders
      await LessonModel.reorderLessons(parsedModuleId, lesson_orders);

      return res.status(200).json(createResponse(true, 'Lessons reordered successfully', null));
    } catch (error) {
      console.error('Error reordering lessons:', error);
      return res.status(500).json(createResponse(false, 'Failed to reorder lessons', null));
    }
  },

  // Mark lesson as completed
  async markLessonCompleted(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user.id;

      // Get lesson
      const lesson = await LessonModel.findById(id);
      if (!lesson) {
        return res.status(404).json(createResponse(false, 'Lesson not found', null));
      }

      // Get module and course to check enrollment
      const module = await ModuleModel.findById(lesson.module_id);
      const isEnrolled = await LessonModel.isUserEnrolledInCourse(user_id, module.course_id);

      if (!isEnrolled) {
        return res.status(403).json(createResponse(false, 'You must be enrolled in this course to mark lessons as completed', null));
      }

      // Mark lesson as completed
      const result = await LessonModel.markLessonCompleted(id, user_id);

      // Get updated course progress
      const courseProgress = await LessonModel.getCourseProgress(module.course_id, user_id);

      return res.status(200).json(createResponse(true, 'Lesson marked as completed', {
        lessonProgress: result,
        courseProgress
      }));
    } catch (error) {
      console.error('Error marking lesson as completed:', error);
      return res.status(500).json(createResponse(false, 'Failed to mark lesson as completed', null));
    }
  },

  // Get all lessons for a course
  async getLessonsByCourse(req, res) {
    try {
      const { course_id } = req.params;

      // Check if course exists
      const course = await CourseModel.findById(course_id);
      if (!course) {
        return res.status(404).json(createResponse(false, 'Course not found', null));
      }

      // Get lessons for this course
      const lessons = await LessonModel.findByCourse(course_id);

      return res.status(200).json(createResponse(true, 'Lessons retrieved successfully', lessons));
    } catch (error) {
      console.error('Error getting lessons:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve lessons', null));
    }
  },

  // Get course progress for a user
  async getCourseProgress(req, res) {
    try {
      const { course_id } = req.params;
      const user_id = req.user.id;

      // Check if course exists
      const course = await CourseModel.findById(course_id);
      if (!course) {
        return res.status(404).json(createResponse(false, 'Course not found', null));
      }

      // Check if user is enrolled in the course
      const isEnrolled = await LessonModel.isUserEnrolledInCourse(user_id, course_id);
      if (!isEnrolled) {
        return res.status(403).json(createResponse(false, 'You must be enrolled in this course to view progress', null));
      }

      // Get course progress with lesson details
      const progress = await LessonModel.getCourseProgress(course_id, user_id);

      return res.status(200).json(createResponse(true, 'Course progress retrieved successfully', progress));
    } catch (error) {
      console.error('Error getting course progress:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve course progress', null));
    }
  }
};

export default lessonController;