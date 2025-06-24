import { createResponse } from '../utils/helper.js';
import NotificationModel from '../models/notificationModel.js';
import CourseModel from '../models/courseModel.js';

const notificationController = {
  // Get notifications for the current user
  async getUserNotifications(req, res) {
    try {
      const user_id = req.user.id;
      const { page = 1, limit = 10, type = null, is_read = null } = req.query;

      // Get notifications
      const notifications = await NotificationModel.findByUser(user_id, {
        page: parseInt(page),
        limit: parseInt(limit),
        type,
        is_read: is_read !== null ? is_read === 'true' : null
      });

      return res.status(200).json(createResponse(true, 'Notifications retrieved successfully', notifications));
    } catch (error) {
      console.error('Error getting notifications:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve notifications', null));
    }
  },

  // Get a notification by ID
  async getNotificationById(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user.id;

      // Get notification
      const notification = await NotificationModel.findById(id);
      
      if (!notification) {
        return res.status(404).json(createResponse(false, 'Notification not found', null));
      }

      // Check if notification belongs to the user
      if (notification.user_id !== user_id) {
        return res.status(403).json(createResponse(false, 'Not authorized to view this notification', null));
      }

      return res.status(200).json(createResponse(true, 'Notification retrieved successfully', notification));
    } catch (error) {
      console.error('Error getting notification:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve notification', null));
    }
  },

  // Mark a notification as read
  async markAsRead(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user.id;

      // Get notification
      const notification = await NotificationModel.findById(id);
      
      if (!notification) {
        return res.status(404).json(createResponse(false, 'Notification not found', null));
      }

      // Check if notification belongs to the user
      if (notification.user_id !== user_id) {
        return res.status(403).json(createResponse(false, 'Not authorized to update this notification', null));
      }

      // Mark as read
      const updatedNotification = await NotificationModel.markAsRead(id);

      return res.status(200).json(createResponse(true, 'Notification marked as read', updatedNotification));
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return res.status(500).json(createResponse(false, 'Failed to mark notification as read', null));
    }
  },

  // Mark all notifications as read for the current user
  async markAllAsRead(req, res) {
    try {
      const user_id = req.user.id;

      // Mark all as read
      await NotificationModel.markAllAsRead(user_id);

      return res.status(200).json(createResponse(true, 'All notifications marked as read', null));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return res.status(500).json(createResponse(false, 'Failed to mark all notifications as read', null));
    }
  },

  // Delete a notification
  async deleteNotification(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user.id;

      // Get notification
      const notification = await NotificationModel.findById(id);
      
      if (!notification) {
        return res.status(404).json(createResponse(false, 'Notification not found', null));
      }

      // Check if notification belongs to the user
      if (notification.user_id !== user_id) {
        return res.status(403).json(createResponse(false, 'Not authorized to delete this notification', null));
      }

      // Delete notification
      await NotificationModel.delete(id);

      return res.status(200).json(createResponse(true, 'Notification deleted successfully', null));
    } catch (error) {
      console.error('Error deleting notification:', error);
      return res.status(500).json(createResponse(false, 'Failed to delete notification', null));
    }
  },

  // Delete all notifications for the current user
  async deleteAllNotifications(req, res) {
    try {
      const user_id = req.user.id;

      // Delete all notifications
      await NotificationModel.deleteAllForUser(user_id);

      return res.status(200).json(createResponse(true, 'All notifications deleted successfully', null));
    } catch (error) {
      console.error('Error deleting all notifications:', error);
      return res.status(500).json(createResponse(false, 'Failed to delete all notifications', null));
    }
  },

  // Get unread notification count for the current user
  async getUnreadCount(req, res) {
    try {
      const user_id = req.user.id;

      // Get unread count
      const count = await NotificationModel.countUnread(user_id);

      return res.status(200).json(createResponse(true, 'Unread notification count retrieved successfully', { count }));
    } catch (error) {
      console.error('Error getting unread notification count:', error);
      return res.status(500).json(createResponse(false, 'Failed to retrieve unread notification count', null));
    }
  },

  // Create a system notification for all users or specific roles
  async createSystemNotification(req, res) {
    try {
      const { title, message, roles = null } = req.body;

      // Validate required fields
      if (!title || !message) {
        return res.status(400).json(createResponse(false, 'Title and message are required', null));
      }

      // Check if user is an admin
      const isAdmin = req.user && req.user.role === 'admin';
      if (!isAdmin) {
        return res.status(403).json(createResponse(false, 'Only administrators can create system notifications', null));
      }

      // Create system notification
      await NotificationModel.createSystemNotification({
        title,
        message,
        roles
      });

      return res.status(201).json(createResponse(true, 'System notification created successfully', null));
    } catch (error) {
      console.error('Error creating system notification:', error);
      return res.status(500).json(createResponse(false, 'Failed to create system notification', null));
    }
  },

  // Create a course announcement notification
  async createCourseAnnouncement(req, res) {
    try {
      const { course_id } = req.params;
      const { title, message } = req.body;

      // Validate required fields
      if (!title || !message) {
        return res.status(400).json(createResponse(false, 'Title and message are required', null));
      }

      // Get course to check authorization
      const course = await CourseModel.findById(course_id);
      if (!course) {
        return res.status(404).json(createResponse(false, 'Course not found', null));
      }

      // Check if user is authorized to create announcements for this course
      const isAdmin = req.user && req.user.role === 'admin';
      const isInstructor = req.user && course.instructor_id === req.user.id;
      
      if (!isAdmin && !isInstructor) {
        return res.status(403).json(createResponse(false, 'Not authorized to create announcements for this course', null));
      }

      // Create course announcement notification
      await NotificationModel.createCourseAnnouncement({
        course_id,
        title,
        message,
        instructor_id: req.user.id
      });

      return res.status(201).json(createResponse(true, 'Course announcement created successfully', null));
    } catch (error) {
      console.error('Error creating course announcement:', error);
      return res.status(500).json(createResponse(false, 'Failed to create course announcement', null));
    }
  }
};

export default notificationController;