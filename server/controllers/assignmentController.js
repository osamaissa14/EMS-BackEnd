
import AssignmentModel from '../models/assignmentModel.js';
import LessonModel from '../models/lessonModel.js';
import CourseModel from '../models/courseModel.js';
import NotificationModel from '../models/notificationModel.js';
import { createResponse } from '../utils/helper.js';
import ModuleModel from '../models/moduleModel.js';
import { query } from '../config/db.js';  

const assignmentController = {
  // Create a new assignment
  async createAssignment(req, res) {
    try {
      const { 
        title, 
        description, 
        instructions = null,
        lesson_id, 
        due_date = null, 
        max_score = 100, 
        is_published = false,
        submission_type = 'text',
        file_types_allowed = null,
        max_file_size = null
      } = req.body;

      // Validate required fields
      if (!title || !lesson_id) {
        return res.status(400).json(createResponse(false, 'Title and lesson ID are required', null));
      }

      // Check if lesson exists
      const lesson = await LessonModel.findById(lesson_id);
      if (!lesson) {
        return res.status(404).json(createResponse(false, 'Lesson not found', null));
      }

      // Get module and course to check authorization
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      // Check if user is authorized to add assignments to this lesson
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to add assignments to this lesson', null));
      }

      // Create assignment
      const assignment = await AssignmentModel.create({
        title,
        description,
        instructions,
        lesson_id: parseInt(lesson_id),
        course_id: module.course_id,
        due_date,
        max_score: parseInt(max_score),
        is_published,
        file_requirements: JSON.stringify({
          submission_type,
          file_types_allowed,
          max_file_size: max_file_size ? parseInt(max_file_size) : null
        })
      });

      return res.status(201).json(createResponse(true, 'Assignment created successfully', assignment));
    } catch (error) {
      console.error('Error creating assignment:', error);
      return res.status(500).json(createResponse(false, 'Failed to create assignment', null));
    }
  },

  // Get an assignment by ID
  async getAssignmentById(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user ? req.user.id : null;
      
      // Validate id
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json(createResponse(false, 'Invalid assignment ID', null));
      }
      
      // Get assignment
      const assignment = await AssignmentModel.findById(parseInt(id));
      
      if (!assignment) {
        return res.status(404).json(createResponse(false, 'Assignment not found', null));
      }

      // Get lesson, module and course to check authorization
      const lesson = await LessonModel.findById(assignment.lesson_id);
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);
      
      // Check if assignment is published or if user is admin/instructor
      const isAdminOrInstructor = req.user && (req.user.role === 'admin' || req.user.role === 'instructor');
      const isInstructor = req.user && course.instructor_id === req.user.id;
      const isEnrolled = user_id ? await LessonModel.isUserEnrolledInCourse(user_id, module.course_id) : false;
      
      if (!assignment.is_published && !isAdminOrInstructor && !isInstructor) {
        return res.status(403).json(createResponse(false, 'This assignment is not available', null));
      }

      // If user is logged in and enrolled, get their submission for this assignment
      let userSubmission = null;
      if (user_id && isEnrolled) {
        userSubmission = await AssignmentModel.getSubmissionByAssignmentAndUser(id, user_id);
      }

      return res.status(200).json(createResponse(true, 'Assignment retrieved successfully', {
        assignment,
        userSubmission
      }));
    } catch (error) {
      console.error('Error getting assignment:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve assignment', null));
    }
  },

  // Get assignments by lesson
  async getAssignmentsByLesson(req, res) {
    try {
      const { lesson_id } = req.params;
      const user_id = req.user ? req.user.id : null;

      // Check if lesson exists
      const lesson = await LessonModel.findById(lesson_id);
      if (!lesson) {
        return res.status(404).json(createResponse(false, 'Lesson not found', null));
      }

      // Get module and course
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      // Check authorization
      const isAdminOrInstructor = req.user && (req.user.role === 'admin' || req.user.role === 'instructor');
      const isInstructor = req.user && course.instructor_id === req.user.id;
      const isEnrolled = user_id ? await LessonModel.isUserEnrolledInCourse(user_id, module.course_id) : false;

      // Get assignments for this lesson
      let assignments;
      if (isAdminOrInstructor || isInstructor) {
        // Admins and instructors can see all assignments
        assignments = await AssignmentModel.findByLesson(lesson_id);
      } else {
        // Students can only see published assignments
        assignments = await AssignmentModel.findByLesson(lesson_id, true);
      }

      // If user is logged in and enrolled, get their submissions for these assignments
      if (user_id && isEnrolled) {
        for (const assignment of assignments) {
          assignment.userSubmission = await AssignmentModel.getSubmissionByAssignmentAndUser(assignment.id, user_id);
        }
      }

      return res.status(200).json(createResponse(true, 'Assignments retrieved successfully', assignments));
    } catch (error) {
      console.error('Error getting assignments:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve assignments', null));
    }
  },

  // Update an assignment
  async updateAssignment(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Get the current assignment
      const assignment = await AssignmentModel.findById(id);
      
      if (!assignment) {
        return res.status(404).json(createResponse(false, 'Assignment not found', null));
      }

      // Get lesson, module and course to check authorization
      const lesson = await LessonModel.findById(assignment.lesson_id);
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      // Check if user is authorized to update this assignment
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to update this assignment', null));
      }

      // Update the assignment
      const updatedAssignment = await AssignmentModel.update(id, updates);

      // If due date was updated and assignment is published, notify enrolled students
      if (updates.due_date && assignment.is_published) {
        await NotificationModel.createCourseContentUpdateNotification({
          course_id: module.course_id,
          assignment_id: id,
          update_type: 'assignment_updated',
          content_title: assignment.title
        });
      }

      return res.status(200).json(createResponse(true, 'Assignment updated successfully', updatedAssignment));
    } catch (error) {
      console.error('Error updating assignment:', error);
      return res.status(500).json(createResponse(false, 'Failed to update assignment', null));
    }
  },

  // Delete an assignment
  async deleteAssignment(req, res) {
    try {
      const { id } = req.params;
      
      // Get the current assignment
      const assignment = await AssignmentModel.findById(id);
      
      if (!assignment) {
        return res.status(404).json(createResponse(false, 'Assignment not found', null));
      }

      // Get lesson, module and course to check authorization
      const lesson = await LessonModel.findById(assignment.lesson_id);
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      // Check if user is authorized to delete this assignment
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to delete this assignment', null));
      }

      // Delete the assignment
      await AssignmentModel.delete(id);

      return res.status(200).json(createResponse(true, 'Assignment deleted successfully', null));
    } catch (error) {
      console.error('Error deleting assignment:', error);
      return res.status(500).json(createResponse(false, 'Failed to delete assignment', null));
    }
  },

  // Submit an assignment
  async submitAssignment(req, res) {
    try {
      const { id } = req.params;
      const { content, file_url = null } = req.body;
      const user_id = req.user.id;

      // Get assignment
      const assignment = await AssignmentModel.findById(id);
      if (!assignment) {
        return res.status(404).json(createResponse(false, 'Assignment not found', null));
      }

      // Check if assignment is published
      if (!assignment.is_published) {
        return res.status(403).json(createResponse(false, 'This assignment is not available for submission', null));
      }

      // Get lesson, module and course to check enrollment
      const lesson = await LessonModel.findById(assignment.lesson_id);
      const module = await ModuleModel.findById(lesson.module_id);
      const isEnrolled = await LessonModel.isUserEnrolledInCourse(user_id, module.course_id);

      if (!isEnrolled) {
        return res.status(403).json(createResponse(false, 'You must be enrolled in this course to submit assignments', null));
      }

      // Validate submission based on submission type
      if (assignment.submission_type === 'text' && !content) {
        return res.status(400).json(createResponse(false, 'Content is required for text submissions', null));
      }

      if (assignment.submission_type === 'file' && !file_url) {
        return res.status(400).json(createResponse(false, 'File URL is required for file submissions', null));
      }

      // Check if due date has passed
      const now = new Date();
      const isDueDatePassed = assignment.due_date && new Date(assignment.due_date) < now;
      
      // Submit assignment with correct parameter names
      const submission = await AssignmentModel.submitAssignment({
        assignment_id: parseInt(id),
        user_id: parseInt(user_id),
        submission_text: content,  
        file_urls: file_url,       
        is_late: isDueDatePassed
      });

      // Check if this is a new submission using the isNew flag
      if (submission.isNew) {  
        // Notify instructor about new submission
        await NotificationModel.create({
          user_id: course.instructor_id,
          type: 'assignment_submitted',
          title: 'New Assignment Submission',
          message: `${req.user.name} has submitted the assignment: ${assignment.title}`,
          related_id: id,
          is_read: false
        });
      }

      return res.status(200).json(createResponse(true, 'Assignment submitted successfully', submission));
    } catch (error) {
      console.error('Error submitting assignment:', error);
      return res.status(500).json(createResponse(false, 'Failed to submit assignment', null));
    }
  },

  // Grade a submission
  async gradeSubmission(req, res) {
    try {
      const { submission_id } = req.params;
      const { grade, feedback } = req.body;

      // Validate required fields
      if (grade === undefined || grade === null) {
        return res.status(400).json(createResponse(false, 'Grade is required', null));
      }

      // Get submission
      const submission = await AssignmentModel.getSubmissionById(parseInt(submission_id));
      if (!submission) {
        return res.status(404).json(createResponse(false, 'Submission not found', null));
      }

      // Get assignment, lesson, module and course to check authorization
      const assignment = await AssignmentModel.findById(submission.assignment_id);
      const lesson = await LessonModel.findById(assignment.lesson_id);
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      // Check if user is authorized to grade this submission
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to grade this submission', null));
      }

      // Validate grade is within range
      const numericGrade = parseFloat(grade);
      if (numericGrade < 0 || numericGrade > assignment.max_score) {
        return res.status(400).json(createResponse(false, `Grade must be between 0 and ${assignment.max_score}`, null));
      }

      // Grade submission
      const gradedSubmission = await AssignmentModel.gradeSubmission(parseInt(submission_id), {
        score: numericGrade,
        feedback,
        graded_by: req.user.id
      });

      // Notify student about graded assignment
      await NotificationModel.createAssignmentGradedNotification({
        user_id: submission.user_id,
        assignment_id: submission.assignment_id,
        grade: numericGrade,
        assignment_title: assignment.title
      });

      return res.status(200).json(createResponse(true, 'Submission graded successfully', gradedSubmission));
    } catch (error) {
      console.error('Error grading submission:', error);
      return res.status(500).json(createResponse(false, 'Failed to grade submission', null));
    }
  },

  // Get submissions by assignment
  async getSubmissionsByAssignment(req, res) {
    try {
      const { assignment_id } = req.params;
      const { page = 1, limit = 10 } = req.query;

      // Validate assignment_id
      if (!assignment_id || isNaN(parseInt(assignment_id))) {
        return res.status(400).json(createResponse(false, 'Invalid assignment ID', null));
      }

      // Get assignment
      const assignment = await AssignmentModel.findById(parseInt(assignment_id));
      if (!assignment) {
        return res.status(404).json(createResponse(false, 'Assignment not found', null));
      }

      // Get lesson, module and course to check authorization
      const lesson = await LessonModel.findById(assignment.lesson_id);
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      // Check if user is authorized to view submissions for this assignment
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to view submissions for this assignment', null));
      }

      // Get submissions
      const submissions = await AssignmentModel.getSubmissionsByAssignment(assignment_id, page, limit);

      return res.status(200).json(createResponse(true, 'Submissions retrieved successfully', submissions));
    } catch (error) {
      console.error('Error getting submissions:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve submissions', null));
    }
  },

  // Get submissions by user
  async getSubmissionsByUser(req, res) {
    try {
      const { user_id } = req.params;
      const { page = 1, limit = 10 } = req.query;
      const requestingUserId = req.user.id;
      const isAdmin = req.user && req.user.role === 'admin';
      
      // Only allow users to view their own submissions unless they're an admin
      // Convert both to strings for comparison to handle type mismatches
      if (String(user_id) !== String(requestingUserId) && !isAdmin) {
        return res.status(403).json(createResponse(false, 'Not authorized to view these submissions', null));
      }

      // Get submissions
      const submissions = await AssignmentModel.getSubmissionsByUser(user_id, page, limit);

      return res.status(200).json(createResponse(true, 'Submissions retrieved successfully', submissions));
    } catch (error) {
      console.error('Error getting submissions:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve submissions', null));
    }
  },

  // Get pending submissions
  async getPendingSubmissions(req, res) {
    try {
      const { course_id } = req.params;
      const { page = 1, limit = 10 } = req.query;

      // Check if course exists
      const course = await CourseModel.findById(course_id);
      if (!course) {
        return res.status(404).json(createResponse(false, 'Course not found', null));
      }

      // Check if user is authorized to view pending submissions for this course
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to view pending submissions for this course', null));
      }

      // Get pending submissions
      const submissions = await AssignmentModel.getPendingSubmissions(course_id, page, limit);

      return res.status(200).json(createResponse(true, 'Pending submissions retrieved successfully', submissions));
    } catch (error) {
      console.error('Error getting pending submissions:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve pending submissions', null));
    }
  },

  // Get assignment statistics
  async getAssignmentStatistics(req, res) {
    try {
      const { assignment_id } = req.params;
      
      // Get assignment
      const assignment = await AssignmentModel.findById(assignment_id);
      if (!assignment) {
        return res.status(404).json(createResponse(false, 'Assignment not found', null));
      }

      // Get lesson, module and course to check authorization
      const lesson = await LessonModel.findById(assignment.lesson_id);
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      // Check if user is authorized to view statistics for this assignment
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to view statistics for this assignment', null));
      }

      // Get statistics
      const statistics = await AssignmentModel.getAssignmentStatistics(assignment_id);

      return res.status(200).json(createResponse(true, 'Assignment statistics retrieved successfully', statistics));
    } catch (error) {
      console.error('Error getting assignment statistics:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve assignment statistics', null));
    }
  },

  // Publish an assignment
  async publishAssignment(req, res) {
    try {
      const { id } = req.params;
      
      // Get assignment
      const assignment = await AssignmentModel.findById(id);
      if (!assignment) {
        return res.status(404).json(createResponse(false, 'Assignment not found', null));
      }

      // Get lesson, module and course to check authorization
      const lesson = await LessonModel.findById(assignment.lesson_id);
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      // Check if user is authorized to publish this assignment
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to publish this assignment', null));
      }

      // Publish assignment
      const publishedAssignment = await AssignmentModel.publish(id);

      // Create notification for enrolled students
      await NotificationModel.createCourseContentUpdateNotification({
        course_id: module.course_id,
        assignment_id: id,
        update_type: 'new_assignment',
        content_title: assignment.title
      });

      // If assignment has a due date, create due date notification
      if (assignment.due_date) {
        await NotificationModel.createAssignmentDueNotification({
          course_id: module.course_id,
          assignment_id: id,
          due_date: assignment.due_date,
          assignment_title: assignment.title
        });
      }

      return res.status(200).json(createResponse(true, 'Assignment published successfully', publishedAssignment));
    } catch (error) {
      console.error('Error publishing assignment:', error);
      return res.status(500).json(createResponse(false, 'Failed to publish assignment', null));
    }
  },

  // Unpublish an assignment
  async unpublishAssignment(req, res) {
    try {
      const { id } = req.params;
      
      // Get assignment
      const assignment = await AssignmentModel.findById(id);
      if (!assignment) {
        return res.status(404).json(createResponse(false, 'Assignment not found', null));
      }

      // Get lesson, module and course to check authorization
      const lesson = await LessonModel.findById(assignment.lesson_id);
      const module = await ModuleModel.findById(lesson.module_id);
      const course = await CourseModel.findById(module.course_id);

      // Check if user is authorized to unpublish this assignment
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to unpublish this assignment', null));
      }

      // Unpublish assignment
      const unpublishedAssignment = await AssignmentModel.unpublish(id);

      return res.status(200).json(createResponse(true, 'Assignment unpublished successfully', unpublishedAssignment));
    } catch (error) {
      console.error('Error unpublishing assignment:', error);
      return res.status(500).json(createResponse(false, 'Failed to unpublish assignment', null));
    }
  },

  // Get assignments due soon for a user
  async getAssignmentsDueSoon(req, res) {
    try {
      const user_id = req.user.id;
      const { days = 7 } = req.query;

      // Get assignments due soon
      const assignments = await AssignmentModel.getAssignmentsDueSoon(user_id, days);

      return res.status(200).json(createResponse(true, 'Assignments due soon retrieved successfully', assignments));
    } catch (error) {
      console.error('Error getting assignments due soon:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve assignments due soon', null));
    }
  },

  // Get overdue assignments for a user
  async getOverdueAssignments(req, res) {
    try {
      const user_id = req.user.id;

      // Get overdue assignments
      const assignments = await AssignmentModel.getOverdueAssignments(user_id);

      return res.status(200).json(createResponse(true, 'Overdue assignments retrieved successfully', assignments));
    } catch (error) {
      console.error('Error getting overdue assignments:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve overdue assignments', null));
    }
  },

  // Get all assignments for current user
  async getAllAssignments(req, res) {
    try {
      const { role, user_id } = req.user;
      const { courseId } = req.query;
      let queryText;  // ✅ Rename variable to queryText
      let params = [];

      if (role === 'admin') {
        if (courseId) {
          queryText = `
            SELECT 
              a.id, a.lesson_id, a.title, a.description, a.instructions, 
              a.due_date, a.max_score, a.created_at, a.updated_at, 
              a.is_published, a.file_requirements,
              c.title as course_title,
              m.title as module_title,
              l.title as lesson_title,
              sub.grade,
              sub.submitted_at,
              sub.graded_at
            FROM assignments a
            LEFT JOIN lessons l ON a.lesson_id = l.id
            LEFT JOIN modules m ON l.module_id = m.id
            LEFT JOIN courses c ON m.course_id = c.id
            LEFT JOIN submissions sub ON a.id = sub.assignment_id
            WHERE c.id = $1
            ORDER BY a.created_at DESC
          `;
          params = [courseId];
        } else {
          queryText = `
            SELECT 
              a.id, a.lesson_id, a.title, a.description, a.instructions, 
              a.due_date, a.max_score, a.created_at, a.updated_at, 
              a.is_published, a.file_requirements,
              c.title as course_title,
              m.title as module_title,
              l.title as lesson_title,
              sub.grade,
              sub.submitted_at,
              sub.graded_at
            FROM assignments a
            LEFT JOIN lessons l ON a.lesson_id = l.id
            LEFT JOIN modules m ON l.module_id = m.id
            LEFT JOIN courses c ON m.course_id = c.id
            LEFT JOIN submissions sub ON a.id = sub.assignment_id
            ORDER BY a.created_at DESC
          `;
        }
      } else if (role === 'instructor') {
        if (courseId) {
          queryText = `
            SELECT 
              a.id, a.lesson_id, a.title, a.description, a.instructions, 
              a.due_date, a.max_score, a.created_at, a.updated_at, 
              a.is_published, a.file_requirements,
              c.title as course_title,
              m.title as module_title,
              l.title as lesson_title,
              sub.grade,
              sub.submitted_at,
              sub.graded_at
            FROM assignments a
            LEFT JOIN lessons l ON a.lesson_id = l.id
            LEFT JOIN modules m ON l.module_id = m.id
            LEFT JOIN courses c ON m.course_id = c.id
            LEFT JOIN submissions sub ON a.id = sub.assignment_id
            WHERE c.instructor_id = $1 AND c.id = $2
            ORDER BY a.created_at DESC
          `;
          params = [user_id, courseId];
        } else {
          queryText = `
            SELECT 
              a.id, a.lesson_id, a.title, a.description, a.instructions, 
              a.due_date, a.max_score, a.created_at, a.updated_at, 
              a.is_published, a.file_requirements,
              c.title as course_title,
              m.title as module_title,
              l.title as lesson_title,
              sub.grade,
              sub.submitted_at,
              sub.graded_at
            FROM assignments a
            LEFT JOIN lessons l ON a.lesson_id = l.id
            LEFT JOIN modules m ON l.module_id = m.id
            LEFT JOIN courses c ON m.course_id = c.id
            LEFT JOIN submissions sub ON a.id = sub.assignment_id
            WHERE c.instructor_id = $1
            ORDER BY a.created_at DESC
          `;
          params = [user_id];
        }
      } else {
        // Student view
        if (courseId) {
          queryText = `
            SELECT 
              a.id, a.lesson_id, a.title, a.description, a.instructions, 
              a.due_date, a.max_score, a.created_at, a.updated_at, 
              a.is_published, a.file_requirements,
              c.title as course_title,
              m.title as module_title,
              l.title as lesson_title,
              sub.grade,
              sub.submitted_at,
              sub.graded_at
            FROM assignments a
            LEFT JOIN lessons l ON a.lesson_id = l.id
            LEFT JOIN modules m ON l.module_id = m.id
            LEFT JOIN courses c ON m.course_id = c.id
            LEFT JOIN enrollments e ON c.id = e.course_id
            LEFT JOIN submissions sub ON a.id = sub.assignment_id AND sub.user_id = $1
            WHERE e.user_id = $1 AND a.is_published = true AND c.id = $2
            ORDER BY a.due_date ASC
          `;
          params = [user_id, courseId];
        } else {
          queryText = `
            SELECT 
              a.id, a.lesson_id, a.title, a.description, a.instructions, 
              a.due_date, a.max_score, a.created_at, a.updated_at, 
              a.is_published, a.file_requirements,
              c.title as course_title,
              m.title as module_title,
              l.title as lesson_title,
              sub.grade,
              sub.submitted_at,
              sub.graded_at
            FROM assignments a
            LEFT JOIN lessons l ON a.lesson_id = l.id
            LEFT JOIN modules m ON l.module_id = m.id
            LEFT JOIN courses c ON m.course_id = c.id
            LEFT JOIN enrollments e ON c.id = e.course_id
            LEFT JOIN submissions sub ON a.id = sub.assignment_id AND sub.user_id = $1
            WHERE e.user_id = $1 AND a.is_published = true
            ORDER BY a.due_date ASC
          `;
          params = [user_id];
        }
      }

      const result = await query(queryText, params);
      res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  // Get assignments by course ID
  async getAssignmentsByCourse(req, res) {
    try {
      const { course_id } = req.params;
      const userId = req.user?.id;

      // Check if course exists
      const course = await CourseModel.findById(course_id);
      if (!course) {
        return res.status(404).json(
          createResponse(false, 'Course not found', null)
        );
      }

      // Get assignments for the course
      const assignments = await AssignmentModel.findByCourseId(course_id);

      // Filter published assignments for students, show all for instructors/admins
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      let filteredAssignments = assignments;
      if (!isAdmin && !isInstructor) {
        filteredAssignments = assignments.filter(assignment => assignment.is_published);
      }

      return res.status(200).json(
        createResponse(true, 'Assignments retrieved successfully', filteredAssignments)
      );
    } catch (error) {
      console.error('Error getting assignments by course:', error);
      return res.status(500).json(
        createResponse(false, 'Failed to retrieve assignments', null)
      );
    }
  }
};

export default assignmentController;