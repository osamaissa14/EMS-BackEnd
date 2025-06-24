import { query } from "../config/db.js";

// Define allowed levels
const ALLOWED_LEVELS = ['beginner', 'intermediate', 'advanced', 'all'];

// Define allowed categories
const ALLOWED_CATEGORIES = ['programming', 'design', 'business', 'marketing', 'data-science', 'other'];

const CourseModel = {
  // CREATE
  async create({ title, description, short_description, category, level, instructor_id, duration, language, requirements, learning_outcomes, tags, status }) {
    try {
      // Validate required fields
      if (!title || !instructor_id || !level) {
        throw new Error("Title, instructor ID and level are required");
      }

      // Validate instructor exists and is actually an instructor
      const instructorCheck = await query(
        `SELECT id FROM users 
         WHERE id = $1 AND role = 'instructor'`,
        [instructor_id]
      );

      if (instructorCheck.rowCount === 0) {
        throw new Error("Instructor not found or not authorized");
      }

      // Validate level is allowed
      if (!ALLOWED_LEVELS.includes(level)) {
        throw new Error(`Invalid level. Allowed values: ${ALLOWED_LEVELS.join(', ')}`);
      }

      // Map category name to category_id if needed
      let category_id = null;
      if (category) {
        const categoryResult = await query(
          `SELECT id FROM categories WHERE LOWER(name) = LOWER($1)`,
          [category]
        );
        if (categoryResult.rowCount > 0) {
          category_id = categoryResult.rows[0].id;
        }
      }

      // Set course status - new courses are always pending approval
      const courseStatus = 'pending';
      const is_approved = false;
      const is_published = false;

      // Insert course (only fields that exist in the database schema)
      const { rows } = await query(
        `INSERT INTO courses 
         (title, description, category_id, level, instructor_id, status, is_approved, is_published) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING *`,
        [
          title,
          description || null,
          category_id,
          level,
          instructor_id,
          courseStatus,
          is_approved,
          is_published
        ]
      );

      const courseId = rows[0].id;

      // Handle tags if provided
      if (tags && Array.isArray(tags) && tags.length > 0) {
        for (const tagName of tags) {
          if (tagName && tagName.trim()) {
            // Insert or get tag
            const tagResult = await query(
              `INSERT INTO tags (name) VALUES ($1) 
               ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name 
               RETURNING id`,
              [tagName.trim()]
            );
            const tagId = tagResult.rows[0].id;
            
            // Link tag to course
            await query(
              `INSERT INTO course_tags (course_id, tag_id) VALUES ($1, $2) 
               ON CONFLICT DO NOTHING`,
              [courseId, tagId]
            );
          }
        }
      }

      return rows[0];
    } catch (error) {
      console.error("Course creation error:", error.message);
      
      // Handle specific PostgreSQL errors
      if (error.code === '23505') { // Unique violation
        throw new Error("Course with this title already exists");
      }
      if (error.code === '23503') { // Foreign key violation
        throw new Error("Invalid reference data provided");
      }
      
      throw error;
    }
  },

  // READ (Multiple)
  async findAll({
    category_id,
    instructor_id,
    is_published,
    is_approved,
    status,
    level,
    search,
    limit = 20,
    offset = 0,
    sortBy = 'created_at',
    sortOrder = 'DESC'
  } = {}) {
    try {
      let conditions = [];
      let values = [];
      let paramIndex = 1;

      // Build conditions dynamically
      if (category_id) {
        conditions.push(`c.category_id = $${paramIndex}`);
        values.push(category_id);
        paramIndex++;
      }

      if (instructor_id) {
        conditions.push(`c.instructor_id = $${paramIndex}`);
        values.push(instructor_id);
        paramIndex++;
      }

      if (is_published !== undefined) {
        conditions.push(`c.is_published = $${paramIndex}`);
        values.push(is_published);
        paramIndex++;
      }

      if (is_approved !== undefined) {
        conditions.push(`c.is_approved = $${paramIndex}`);
        values.push(is_approved);
        paramIndex++;
      }

      if (status !== undefined) {
        conditions.push(`c.status = $${paramIndex}`);
        values.push(status);
        paramIndex++;
      }

      if (level) {
        conditions.push(`c.level = $${paramIndex}`);
        values.push(level);
        paramIndex++;
      }



      let whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}` 
        : '';

      // Handle search
      if (search) {
        const searchCondition = `TO_TSVECTOR('english', c.title || ' ' || c.description) 
                               @@ PLAINTO_TSQUERY('english', $${paramIndex})`;
        whereClause += whereClause ? ` AND ${searchCondition}` : `WHERE ${searchCondition}`;
        values.push(search);
        paramIndex++;
      }

      // Add pagination and sorting parameters
      values.push(limit);
      values.push(offset);

      const { rows } = await query(
        `SELECT 
           c.*, 
           u.name as instructor_name,
           cat.name as category_name
         FROM courses c
         JOIN users u ON c.instructor_id = u.id
         LEFT JOIN categories cat ON c.category_id = cat.id
         ${whereClause}
         ORDER BY c.${sortBy} ${sortOrder}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        values
      );

      return rows;
    } catch (error) {
      console.error("Error finding courses:", error.message);
      throw error;
    }
  },

  // READ (Single)
  async findById(id) {
    try {
      const { rows } = await query(
        `SELECT c.*, u.name as instructor_name, cat.name as category_name
         FROM courses c
         JOIN users u ON c.instructor_id = u.id
         LEFT JOIN categories cat ON c.category_id = cat.id
         WHERE c.id = $1`,
        [id]
      );
      return rows[0] || null;
    } catch (error) {
      console.error("Error finding course by ID:", error.message);
      throw error;
    }
  },

  // READ (By Instructor) - ADD THIS NEW METHOD
  async findByInstructor(instructorId) {
    try {
      const { rows } = await query(
        `SELECT c.*, u.name as instructor_name, cat.name as category_name,
                COUNT(e.id) as enrollment_count
         FROM courses c
         JOIN users u ON c.instructor_id = u.id
         LEFT JOIN categories cat ON c.category_id = cat.id
         LEFT JOIN enrollments e ON c.id = e.course_id
         WHERE c.instructor_id = $1
         GROUP BY c.id, u.name, cat.name
         ORDER BY c.created_at DESC`,
        [instructorId]
      );
      return rows;
    } catch (error) {
      console.error("Error finding courses by instructor:", error.message);
      throw error;
    }
  },

  // COUNT
  async count(filters = {}, search = '') {
    try {
      const { category_id, instructor_id, status, is_approved, level } = filters;
      
      let conditions = [];
      let values = [];
      let paramIndex = 1;

      // Apply filters
      if (category_id) {
        conditions.push(`c.category_id = $${paramIndex}`);
        values.push(category_id);
        paramIndex++;
      }

      if (instructor_id) {
        conditions.push(`c.instructor_id = $${paramIndex}`);
        values.push(instructor_id);
        paramIndex++;
      }

      if (status) {
        conditions.push(`c.status = $${paramIndex}`);
        values.push(status);
        paramIndex++;
      }

      if (is_approved !== undefined) {
        conditions.push(`c.is_approved = $${paramIndex}`);
        values.push(is_approved);
        paramIndex++;
      }

      if (level) {
        conditions.push(`c.level = $${paramIndex}`);
        values.push(level);
        paramIndex++;
      }



      let whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}` 
        : '';

      // Handle search
      if (search) {
        const searchCondition = `TO_TSVECTOR('english', c.title || ' ' || c.description) 
                               @@ PLAINTO_TSQUERY('english', $${paramIndex})`;
        whereClause += whereClause ? ` AND ${searchCondition}` : `WHERE ${searchCondition}`;
        values.push(search);
        paramIndex++;
      }

      const { rows } = await query(
        `SELECT COUNT(*) as count
         FROM courses c
         JOIN users u ON c.instructor_id = u.id
         ${whereClause}`,
        values
      );

      return parseInt(rows[0].count);
    } catch (error) {
      console.error("Error counting courses:", error.message);
      throw error;
    }
  },

  // UPDATE
  async update(id, updates) {
    try {
      // Get existing course first
      const existingCourse = await this.findById(id);
      if (!existingCourse) {
        throw new Error("Course not found");
      }

      // Validate category if provided
      if (updates.category && !ALLOWED_CATEGORIES.includes(updates.category)) {
        throw new Error(`Invalid category. Allowed values: ${ALLOWED_CATEGORIES.join(', ')}`);
      }

      // Build dynamic update query
      const fields = Object.entries(updates)
        .filter(([_, value]) => value !== undefined);
      
      if (fields.length === 0) {
        return existingCourse;
      }

      const setClause = fields
        .map(([field], index) => `${field} = $${index + 2}`)
        .join(', ');

      const values = fields.map(([_, value]) => value);

      // Always update the updated_at timestamp
      const { rows } = await query(
        `UPDATE courses 
         SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1 
         RETURNING *`,
        [id, ...values]
      );

      return rows[0];
    } catch (error) {
      console.error("Error updating course:", error.message);
      throw error;
    }
  },

  // [Keep all other methods exactly as they were]
  // ... no other changes needed to other methods
};

export default CourseModel;
export { ALLOWED_CATEGORIES };