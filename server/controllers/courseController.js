
import CourseModel, { ALLOWED_CATEGORIES } from '../models/courseModel.js';
import ModuleModel from '../models/moduleModel.js';
import EnrollmentModel from '../models/enrollmentModel.js';
import ReviewModel from '../models/reviewModel.js';
import { createResponse } from '../utils/helper.js';
import NotificationModel from '../models/notificationModel.js';

const courseController = {
  // Get all approved courses (for student enrollment)
  async getApprovedCourses(req, res) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        category_id,
        level, 
        search,
        sort_by = 'created_at',
        sort_order = 'DESC'
      } = req.query;

      const offset = (page - 1) * limit;

      // Get approved courses
      const courses = await CourseModel.findAll({
        limit: parseInt(limit),
        offset: parseInt(offset),
        category_id: category_id ? parseInt(category_id) : undefined,
        level,
        search,
        status: 'approved',
        sortBy: sort_by,
        sortOrder: sort_order
      });

      // Get total count
      const countFilters = {
        category_id: category_id ? parseInt(category_id) : undefined,
        level,
        is_approved: true,
        is_published: true
      };
      const totalCount = await CourseModel.count(countFilters, search);
      const totalPages = Math.ceil(totalCount / limit);

      return res.status(200).json(
        createResponse(true, 'Approved courses retrieved successfully', {
          courses,
          pagination: {
            total: totalCount,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages
          }
        })
      );
    } catch (error) {
      console.error('Get approved courses error:', error);
      return res.status(500).json(
        createResponse(false, 'Failed to retrieve approved courses', null)
      );
    }
  },

  // Get all courses with advanced filtering
  async getAllCourses(req, res) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        category,
        level, 
        search,
        instructor_id,
     
        sort_by = 'created_at',
        sort_order = 'DESC',
        published_only = 'true',
        status
      } = req.query;
  
      // Validate category filter
      if (category && !ALLOWED_CATEGORIES.includes(category)) {
        return res.status(400).json(
          createResponse(false, 'Invalid category filter', null)
        );
      }
  
      const offset = (page - 1) * limit;
      const filters = {};
  
      // Build filters
      if (category) filters.category = category;
      if (level) filters.level = level;
      if (instructor_id) filters.instructor_id = instructor_id;
      
      
      // Handle status filter for pending courses
      if (status === 'pending') {
        // Only admins can view pending courses
        if (req.user?.role !== 'admin') {
          return res.status(403).json(
            createResponse(false, 'Only admins can view pending courses', null)
          );
        }
        filters.is_approved = false;
      } else {
        // Handle published only filter
        const isAdminOrInstructor = req.user?.role === 'admin' || req.user?.role === 'instructor';
        if (published_only === 'true' || !isAdminOrInstructor) {
          filters.is_published = true;
          filters.is_approved = true;
        }
      }

      // Get courses
      const courses = await CourseModel.findAll({
        limit: parseInt(limit),
        offset: parseInt(offset),
        filters,
        search,
        sortBy: sort_by,
        sortOrder: sort_order
      });

      // Get total count
      const totalCount = await CourseModel.count(filters, search);
      const totalPages = Math.ceil(totalCount / limit);

      return res.status(200).json(
        createResponse(true, 'Courses retrieved successfully', {
          courses,
          pagination: {
            total: totalCount,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages
          }
        })
      );
    } catch (error) {
      console.error('Get courses error:', error);
      return res.status(500).json(
        createResponse(false, 'Failed to retrieve courses', null)
      );
    }
  },

  // Get pending courses (admin only)
  async getPendingCourses(req, res) {
    try {
      // Only admins can view pending courses
      if (req.user?.role !== 'admin') {
        return res.status(403).json(
          createResponse(false, 'Only admins can view pending courses', null)
        );
      }

      const { 
        page = 1, 
        limit = 10, 
        category,
        level, 
        search,
        instructor_id,
        sort_by = 'created_at',
        sort_order = 'DESC'
      } = req.query;

      // Validate category filter
      if (category && !ALLOWED_CATEGORIES.includes(category)) {
        return res.status(400).json(
          createResponse(false, 'Invalid category filter', null)
        );
      }

      const offset = (page - 1) * limit;
      const filters = { status: 'pending' };

      // Build additional filters
      if (category) filters.category = category;
      if (level) filters.level = level;
      if (instructor_id) filters.instructor_id = instructor_id;

      // Get pending courses
      const courses = await CourseModel.findAll({
        limit: parseInt(limit),
        offset: parseInt(offset),
        ...filters,
        search,
        sortBy: sort_by,
        sortOrder: sort_order
      });

      // Get total count
      const totalCount = await CourseModel.count(filters, search);
      const totalPages = Math.ceil(totalCount / limit);

      return res.status(200).json(
        createResponse(true, 'Pending courses retrieved successfully', {
          courses,
          pagination: {
            total: totalCount,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages
          }
        })
      );
    } catch (error) {
      console.error('Get pending courses error:', error);
      return res.status(500).json(
        createResponse(false, 'Failed to retrieve pending courses', null)
      );
    }
  },

  // Get single course with full details
  async getCourseById(req, res) {
    try {

      const { id } = req.params;
      const userId = req.user?.id;
      
      // Get course with instructor details
      const course = await CourseModel.findById(id);
      if (!course) {
        return res.status(404).json(
          createResponse(false, 'Course not found', null)
        );
      }

      return res.status(200).json(
        createResponse(true, 'Course retrieved successfully', course)
      );
    } catch (error) {
      console.error('Get course error:', error);
      return res.status(500).json(
        createResponse(false, 'Failed to retrieve course', null)
      );
    }
  },

  // Create a new course
  async createCourse(req, res) {
    try {
      const { 
        title, 
        description, 
        short_description,
        category, 
        level,
        duration,
        language,
        requirements,
        learning_outcomes,
        tags,
        status
      } = req.body;
      const instructor_id = req.user.id;
  
      // Validate required fields with trimming
      if (!title?.trim() || !description?.trim() || !category?.trim() || !level?.trim()) {
        return res.status(400).json(
          createResponse(false, 'Title, description, category and level are required', null)
        );
      }
  
      // Validate category
      if (category && !ALLOWED_CATEGORIES.includes(category)) {
        return res.status(400).json(
          createResponse(false, 'Invalid category', null)
        );
      }
  
      // Parse JSON strings if they exist
      let parsedRequirements = [];
      let parsedOutcomes = [];
      let parsedTags = [];
      
      try {
        if (requirements) {
          parsedRequirements = typeof requirements === 'string' ? JSON.parse(requirements) : requirements;
        }
        if (learning_outcomes) {
          parsedOutcomes = typeof learning_outcomes === 'string' ? JSON.parse(learning_outcomes) : learning_outcomes;
        }
        if (tags) {
          parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
        }
      } catch (parseError) {
        return res.status(400).json(
          createResponse(false, 'Invalid JSON format in requirements, learning_outcomes, or tags', null)
        );
      }
  
      const courseData = {
        title: title.trim(),
        description: description.trim(),
        short_description: short_description?.trim() || '',
        instructor_id,
        category: category.trim(),
        level: level.trim(),
        duration: duration || '',
        language: language || 'English',
        requirements: parsedRequirements,
        learning_outcomes: parsedOutcomes,
        tags: parsedTags,
        status: status || 'draft'
      };
  
      const course = await CourseModel.create(courseData);
  
      // In createCourse method (lines 150-160)
      // Send notification to all admins about new course pending approval
      try {
        await NotificationModel.createSystemNotification({
          title: 'New Course Pending Approval',
          message: `A new course "${course.title}" by ${req.user.name} is waiting for approval.`,
          role: 'admin'
        });
      } catch (notificationError) {
        console.error('Failed to send admin notification:', notificationError);
        // Don't fail the course creation if notification fails
      }
  
      return res.status(201).json(
        createResponse(true, 'Course created successfully', course)
      );
    } catch (error) {
      console.error('Course creation error:', error.message);
      return res.status(500).json(
        createResponse(false, error.message || 'Failed to create course', null)
      );
    }
  },

  // Update course
  async updateCourse(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;
      const userId = req.user.id;
      const userRole = req.user.role;
  
      // Check if course exists and user has permission
      const course = await CourseModel.findById(id);
      if (!course) {
        return res.status(404).json(
          createResponse(false, 'Course not found', null)
        );
      }
  
      // Only instructor who owns the course or admin can update
      if (userRole !== 'admin' && course.instructor_id !== userId) {
        return res.status(403).json(
          createResponse(false, 'You can only update your own courses', null)
        );
      }
  
      // Validate category if provided
      if (updates.category && !ALLOWED_CATEGORIES.includes(updates.category)) {
        return res.status(400).json(
          createResponse(false, 'Invalid category', null)
        );
      }
  
      // Trim string fields if they exist
      const sanitizedUpdates = { ...updates };
      if (sanitizedUpdates.title) sanitizedUpdates.title = sanitizedUpdates.title.trim();
      if (sanitizedUpdates.description) sanitizedUpdates.description = sanitizedUpdates.description.trim();
      if (sanitizedUpdates.category) sanitizedUpdates.category = sanitizedUpdates.category.trim();
      if (sanitizedUpdates.level) sanitizedUpdates.level = sanitizedUpdates.level.trim();
  
      const updatedCourse = await CourseModel.update(id, sanitizedUpdates);
  
      return res.status(200).json(
        createResponse(true, 'Course updated successfully', updatedCourse)
      );
    } catch (error) {
      console.error('Course update error:', error);
      return res.status(500).json(
        createResponse(false, 'Failed to update course', null)
      );
    }
  },

  // Delete course
  async deleteCourse(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;

      // Check if course exists
      const course = await CourseModel.findById(id);
      if (!course) {
        return res.status(404).json(
          createResponse(false, 'Course not found', null)
        );
      }

      // Only instructor who owns the course or admin can delete
      if (userRole !== 'admin' && course.instructor_id !== userId) {
        return res.status(403).json(
          createResponse(false, 'You can only delete your own courses', null)
        );
      }

      await CourseModel.delete(id);

      return res.status(200).json(
        createResponse(true, 'Course deleted successfully', null)
      );
    } catch (error) {
      console.error('Course deletion error:', error);
      return res.status(500).json(
        createResponse(false, 'Failed to delete course', null)
      );
    }
  },

  // Get featured courses
  async getFeaturedCourses(req, res) {
    try {
      const courses = await CourseModel.findFeatured();
      return res.status(200).json(
        createResponse(true, 'Featured courses retrieved successfully', courses)
      );
    } catch (error) {
      console.error('Get featured courses error:', error);
      return res.status(500).json(
        createResponse(false, 'Failed to retrieve featured courses', null)
      );
    }
  },

  // Publish course
  async publishCourse(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;

      const course = await CourseModel.findById(id);
      if (!course) {
        return res.status(404).json(
          createResponse(false, 'Course not found', null)
        );
      }

      // Only instructor who owns the course can publish
      if (userRole !== 'admin' && course.instructor_id !== userId) {
        return res.status(403).json(
          createResponse(false, 'You can only publish your own courses', null)
        );
      }

      const updatedCourse = await CourseModel.update(id, { is_published: true });

      return res.status(200).json(
        createResponse(true, 'Course published successfully', updatedCourse)
      );
    } catch (error) {
      console.error('Course publish error:', error);
      return res.status(500).json(
        createResponse(false, 'Failed to publish course', null)
      );
    }
  },

  // Unpublish course
  async unpublishCourse(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;

      const course = await CourseModel.findById(id);
      if (!course) {
        return res.status(404).json(
          createResponse(false, 'Course not found', null)
        );
      }

      // Only instructor who owns the course or admin can unpublish
      if (userRole !== 'admin' && course.instructor_id !== userId) {
        return res.status(403).json(
          createResponse(false, 'You can only unpublish your own courses', null)
        );
      }

      const updatedCourse = await CourseModel.update(id, { is_published: false });

      return res.status(200).json(
        createResponse(true, 'Course unpublished successfully', updatedCourse)
      );
    } catch (error) {
      console.error('Course unpublish error:', error);
      return res.status(500).json(
        createResponse(false, 'Failed to unpublish course', null)
      );
    }
  },

  // Approve course (admin only)
  async approveCourse(req, res) {
    try {
      const { id } = req.params;
      const { action, rejection_reason } = req.body; // 'approve' or 'reject'

      const course = await CourseModel.findById(id);
      if (!course) {
        return res.status(404).json(
          createResponse(false, 'Course not found', null)
        );
      }

      // Check if course is in pending status
      if (course.status !== 'pending') {
        return res.status(400).json(
          createResponse(false, 'Course is not in pending status', null)
        );
      }

      let updatedCourse;
      let notificationTitle;
      let notificationMessage;

      if (action === 'approve') {
        updatedCourse = await CourseModel.update(id, { 
          status: 'approved',
          is_approved: true,
          is_published: true
        });
        notificationTitle = 'Course Approved!';
        notificationMessage = `Your course "${course.title}" has been approved and is now live.`;
      } else if (action === 'reject') {
        const updateData = { 
          status: 'rejected',
          is_approved: false,
          is_published: false
        };
        
        if (rejection_reason) {
          updateData.rejection_reason = rejection_reason;
        }
        
        updatedCourse = await CourseModel.update(id, updateData);
        notificationTitle = 'Course Rejected';
        notificationMessage = rejection_reason 
          ? `Your course "${course.title}" has been rejected. Reason: ${rejection_reason}`
          : `Your course "${course.title}" has been rejected. Please review and resubmit.`;
      } else {
        return res.status(400).json(
          createResponse(false, 'Invalid action. Use "approve" or "reject"', null)
        );
      }

      // Send notification to the course instructor
      try {
        await NotificationModel.create({
          user_id: course.instructor_id,
          title: notificationTitle,
          message: notificationMessage,
          type: 'course_approval',
          related_id: id,
          is_read: false
        });
      } catch (notificationError) {
        console.error('Failed to send instructor notification:', notificationError);
        // Don't fail the approval if notification fails
      }

      return res.status(200).json(
        createResponse(true, `Course ${action}d successfully`, updatedCourse)
      );
    } catch (error) {
      console.error('Course approval error:', error);
      return res.status(500).json(
        createResponse(false, 'Failed to process course approval', null)
      );
    }
  },

 // Get instructor courses
async getInstructorCourses(req, res) {
  try {
    const instructorId = req.params.id || req.user?.id;

    if (!instructorId) {
      return res
        .status(400)
        .json(createResponse(false, 'Instructor id is required', null));
    }

    const courses = await CourseModel.findByInstructor(instructorId);
    return res
      .status(200)
      .json(createResponse(true, 'Instructor courses retrieved successfully', courses));
  } catch (error) {
    console.error('Get instructor courses error:', error);   // keep this
    return res
      .status(500)
      .json(createResponse(false, 'Failed to retrieve instructor courses', null));
  }
  },

  // Get enrolled courses for current user
  async getEnrolledCourses(req, res) {
    try {
      const userId = req.user.id;
      const enrolledCourses = await EnrollmentModel.findByUser(userId);
      
      return res.status(200).json(
        createResponse(true, 'Enrolled courses retrieved successfully', enrolledCourses)
      );
    } catch (error) {
      console.error('Get enrolled courses error:', error);
      console.error('Error stack:', error.stack);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        detail: error.detail
      });
      return res.status(500).json(
        createResponse(false, 'Failed to retrieve enrolled courses', null)
      );
    }
  },

  // Get course analytics
  async getCourseAnalytics(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;

      const course = await CourseModel.findById(id);
      if (!course) {
        return res.status(404).json(
          createResponse(false, 'Course not found', null)
        );
      }

      // Only instructor who owns the course or admin can view analytics
      if (userRole !== 'admin' && course.instructor_id !== userId) {
        return res.status(403).json(
          createResponse(false, 'You can only view analytics for your own courses', null)
        );
      }

      const analytics = await CourseModel.getAnalytics(id);

      return res.status(200).json(
        createResponse(true, 'Course analytics retrieved successfully', analytics)
      );
    } catch (error) {
      console.error('Get course analytics error:', error);
      return res.status(500).json(
        createResponse(false, 'Failed to retrieve course analytics', null)
      );
    }
  },

  // Create announcement
  async createAnnouncement(req, res) {
    try {
      const { id } = req.params;
      const { title, content } = req.body;
      const userId = req.user.id;
      const userRole = req.user.role;

      const course = await CourseModel.findById(id);
      if (!course) {
        return res.status(404).json(
          createResponse(false, 'Course not found', null)
        );
      }

      // Only instructor who owns the course can create announcements
      if (userRole !== 'admin' && course.instructor_id !== userId) {
        return res.status(403).json(
          createResponse(false, 'You can only create announcements for your own courses', null)
        );
      }

      const announcement = await CourseModel.createAnnouncement(id, { title, content });

      return res.status(201).json(
        createResponse(true, 'Announcement created successfully', announcement)
      );
    } catch (error) {
      console.error('Create announcement error:', error);
      return res.status(500).json(
        createResponse(false, 'Failed to create announcement', null)
      );
    }
  },

  // Get rejected courses (for admin)
  async getRejectedCourses(req, res) {
    try {
      const courses = await CourseModel.findAll({ status: 'rejected' });
      res.json(createResponse(true, 'Rejected courses retrieved successfully', courses));
    } catch (error) {
      console.error('Error fetching rejected courses:', error);
      res.status(500).json(createResponse(false, 'Failed to fetch rejected courses', null));
    }
  },

  // Resubmit course for approval (for instructors)
  async resubmitCourse(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const course = await CourseModel.findById(id);
      if (!course) {
        return res.status(404).json(
          createResponse(false, 'Course not found', null)
        );
      }

      // Check if user is the instructor of this course
      if (course.instructor_id !== userId) {
        return res.status(403).json(
          createResponse(false, 'You can only resubmit your own courses', null)
        );
      }

      // Check if course is in rejected status
      if (course.status !== 'rejected') {
        return res.status(400).json(
          createResponse(false, 'Only rejected courses can be resubmitted', null)
        );
      }

      // Update course status to pending and clear rejection reason
      const updatedCourse = await CourseModel.update(id, {
        status: 'pending',
        rejection_reason: null
      });

      res.json(createResponse(true, 'Course resubmitted for approval', updatedCourse));
    } catch (error) {
      console.error('Error resubmitting course:', error);
      res.status(500).json(createResponse(false, 'Failed to resubmit course', null));
    }
  }




};

export default courseController;
