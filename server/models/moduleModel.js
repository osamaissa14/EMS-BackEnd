import { query } from "../config/db.js";

const ModuleModel = {
  // Create a new module
  async create({ title, description, course_id, order_index }) {
    try {
      // If order_index is not provided, get the next available index
      if (order_index === undefined) {
        const { rows } = await query(
          `SELECT COALESCE(MAX(order_index), -1) + 1 as next_index FROM modules WHERE course_id = $1`,
          [course_id]
        );
        order_index = rows[0].next_index;
      }

      const { rows } = await query(
        `INSERT INTO modules (title, description, course_id, order_index) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [title, description, course_id, order_index]
      );

      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Get all modules for a course
  async findByCourse(courseId) {
    try {
      const { rows } = await query(
        `SELECT * FROM modules WHERE course_id = $1 ORDER BY order_index ASC`,
        [courseId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  },

  // Get module by ID
  async findById(id) {
    try {
      const { rows } = await query(
        `SELECT * FROM modules WHERE id = $1`,
        [id]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  // Update module
  async update(id, { title, description, order_index }) {
    try {
      // Build the query dynamically based on provided fields
      const fields = Object.entries({ 
        title, 
        description, 
        order_index,
        updated_at: 'CURRENT_TIMESTAMP'
      }).filter(([_, value]) => value !== undefined);

      if (fields.length === 0) return await this.findById(id); // No fields to update
      
      const setClause = fields.map(([field, _], index) => 
        field === 'updated_at' ? `${field} = ${_}` : `${field} = $${index + 2}`
      ).join(', ');
      
      const values = fields
        .filter(([field, _]) => field !== 'updated_at')
        .map(([_, value]) => value);
      
      const { rows } = await query(
        `UPDATE modules SET ${setClause} WHERE id = $1 RETURNING *`,
        [id, ...values]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Delete module
  async delete(id) {
    try {
      // First, get the module to know its course_id and order_index
      const module = await this.findById(id);
      if (!module) return null;

      // Delete the module
      const { rows } = await query(
        `DELETE FROM modules WHERE id = $1 RETURNING *`,
        [id]
      );

      // Reorder remaining modules
      await query(
        `UPDATE modules 
         SET order_index = order_index - 1, updated_at = CURRENT_TIMESTAMP 
         WHERE course_id = $1 AND order_index > $2`,
        [module.course_id, module.order_index]
      );

      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  // Reorder modules
  async reorder(moduleId, newOrderIndex) {
    try {
      // Get the module to be reordered
      const module = await this.findById(moduleId);
      if (!module) throw new Error('Module not found');

      const oldOrderIndex = module.order_index;
      
      // If the order hasn't changed, do nothing
      if (oldOrderIndex === newOrderIndex) {
        return module;
      }

      // Begin transaction
      await query('BEGIN');

      // Update other modules' order
      if (newOrderIndex > oldOrderIndex) {
        // Moving down: decrement modules in between
        await query(
          `UPDATE modules 
           SET order_index = order_index - 1, updated_at = CURRENT_TIMESTAMP 
           WHERE course_id = $1 AND order_index > $2 AND order_index <= $3`,
          [module.course_id, oldOrderIndex, newOrderIndex]
        );
      } else {
        // Moving up: increment modules in between
        await query(
          `UPDATE modules 
           SET order_index = order_index + 1, updated_at = CURRENT_TIMESTAMP 
           WHERE course_id = $1 AND order_index >= $2 AND order_index < $3`,
          [module.course_id, newOrderIndex, oldOrderIndex]
        );
      }

      // Update the module's order
      const { rows } = await query(
        `UPDATE modules SET order_index = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [moduleId, newOrderIndex]
      );

      // Commit transaction
      await query('COMMIT');

      return rows[0];
    } catch (error) {
      // Rollback transaction on error
      await query('ROLLBACK');
      throw error;
    }
  },

  // Get module with lessons
  async findByIdWithLessons(moduleId) {
    try {
      // Get the module
      const module = await this.findById(moduleId);
      if (!module) return null;

      // Get the lessons for this module
      const { rows: lessons } = await query(
        `SELECT * FROM lessons WHERE module_id = $1 ORDER BY order_index ASC`,
        [moduleId]
      );

      // Combine module with lessons
      return {
        ...module,
        lessons
      };
    } catch (error) {
      throw error;
    }
  },

  // Get all modules with lessons for a course
  async findByCourseWithLessons(courseId) {
    try {
      // Get all modules for the course
      const modules = await this.findByCourse(courseId);

      // For each module, get its lessons
      const modulesWithLessons = await Promise.all(
        modules.map(async (module) => {
          const { rows: lessons } = await query(
            `SELECT * FROM lessons WHERE module_id = $1 ORDER BY order_index ASC`,
            [module.id]
          );
          return {
            ...module,
            lessons
          };
        })
      );

      return modulesWithLessons;
    } catch (error) {
      throw error;
    }
  }
};

export default ModuleModel;