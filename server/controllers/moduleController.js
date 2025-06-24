
import ModuleModel from '../models/moduleModel.js';
import CourseModel from '../models/courseModel.js';
import NotificationModel from '../models/notificationModel.js';
import { createResponse } from '../utils/helper.js';

const moduleController = {
  // Create a new module
  async createModule(req, res) {
    try {
      // 1. Properly destructure all fields
      const { title, description, course_id, order_index } = req.body;
  
      // 2. Validate inputs
      if (!title?.trim()) {
        return res.status(400).json(createResponse(false, 'Module title is required', null));
      }
      
      if (!course_id) {
        return res.status(400).json(createResponse(false, 'Course ID is required', null));
      }
  
      // 3. Check course exists and is approved
      const course = await CourseModel.findById(course_id);
      if (!course) {
        return res.status(404).json(createResponse(false, 'Course not found', null));
      }
      
      if (course.status !== 'approved') {
        return res.status(400).json(createResponse(false, 'Cannot add modules to courses that are not approved', null));
      }
  
      // 4. Check authorization
      const isAdmin = req.user?.role === 'admin';
      const isInstructor = course.instructor_id === req.user?.id;
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized', null));
      }
  
      // 5. Create module
      const module = await ModuleModel.create({
        title: title.trim(),
        description,
        course_id,
        order_index
      });
  
      // 6. Create notification (with error handling)
      try {
        await NotificationModel.createCourseContentUpdateNotification({
          course_id,
          module_id: module.id,
          update_type: 'new_module',
          content_title: title.trim()
        });
      } catch (notifError) {
        console.error('Notification failed:', notifError);
      }
  
      return res.status(201).json(createResponse(true, 'Module created', module));
    } catch (error) {
      console.error('Error creating module:', error);
      return res.status(500).json(createResponse(false, 'Failed to create module', null));
    }
  },

  // Get all modules for a course
  async getModulesByCourse(req, res) {
    try {
      const { course_id } = req.params;
      const parsedCourseId = parseInt(course_id);

      // Check if course exists
      const course = await CourseModel.findById(parsedCourseId);
      if (!course) {
        return res.status(404).json(createResponse(false, 'Course not found', null));
      }

      // Get modules with lessons for this course
      const modules = await ModuleModel.findByCourseWithLessons(parsedCourseId);

      return res.status(200).json(createResponse(true, 'Modules retrieved successfully', modules));
    } catch (error) {
      console.error('Error getting modules:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve modules', null));
    }
  },

  // Get a single module by ID with its lessons
  async getModuleById(req, res) {
    try {
      const { id } = req.params;
      const parsedId = parseInt(id);
      
      // Get module with lessons
      const module = await ModuleModel.findByIdWithLessons(parsedId);
      
      if (!module) {
        return res.status(404).json(createResponse(false, 'Module not found', null));
      }

      // Get course to check authorization
      const course = await CourseModel.findById(module.course_id);
      
      // Check if course is published or if user is admin/instructor
      const isAdminOrInstructor = req.user && (req.user.role === 'admin' || req.user.role === 'instructor');
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      if (!course.is_published && !isAdminOrInstructor && !isInstructor) {
        return res.status(403).json(createResponse(false, 'This module is not available', null));
      }

      return res.status(200).json(createResponse(true, 'Module retrieved successfully', module));
    } catch (error) {
      console.error('Error getting module:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve module', null));
    }
  },

  // Update a module
  async updateModule(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Get the current module
      const module = await ModuleModel.findById(id);
      
      if (!module) {
        return res.status(404).json(createResponse(false, 'Module not found', null));
      }

      // Get course to check authorization
      const course = await CourseModel.findById(module.course_id);

      // Check if user is authorized to update this module
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to update this module', null));
      }

      // Update the module
      const updatedModule = await ModuleModel.update(id, updates);

      return res.status(200).json(createResponse(true, 'Module updated successfully', updatedModule));
    } catch (error) {
      console.error('Error updating module:', error);
      return res.status(500).json(createResponse(false, 'Failed to update module', null));
    }
  },

  // Delete a module
  async deleteModule(req, res) {
    try {
      const { id } = req.params;
      
      // Get the current module
      const module = await ModuleModel.findById(id);
      
      if (!module) {
        return res.status(404).json(createResponse(false, 'Module not found', null));
      }

      // Get course to check authorization
      const course = await CourseModel.findById(module.course_id);

      // Check if user is authorized to delete this module
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to delete this module', null));
      }

      // Delete the module
      await ModuleModel.delete(id);

      return res.status(200).json(createResponse(true, 'Module deleted successfully', null));
    } catch (error) {
      console.error('Error deleting module:', error);
      return res.status(500).json(createResponse(false, 'Failed to delete module', null));
    }
  },

  // Reorder modules
  async reorderModules(req, res) {
    try {
      const { course_id } = req.params;
      const { module_order } = req.body;

      // Validate required fields
      if (!module_order || !Array.isArray(module_order)) {
        return res.status(400).json(createResponse(false, 'Module order array is required', null));
      }

      // Check if course exists
      const course = await CourseModel.findById(course_id);
      if (!course) {
        return res.status(404).json(createResponse(false, 'Course not found', null));
      }

      // Check if user is authorized to reorder modules for this course
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to reorder modules for this course', null));
      }

      // Reorder modules
      await ModuleModel.reorderModules(course_id, module_order);

      // Get updated modules
      const updatedModules = await ModuleModel.findByCourse(course_id);

      return res.status(200).json(createResponse(true, 'Modules reordered successfully', updatedModules));
    } catch (error) {
      console.error('Error reordering modules:', error);
      return res.status(500).json(createResponse(false, 'Failed to reorder modules', null));
    }
  }
};

export default moduleController;