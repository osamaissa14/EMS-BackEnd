// Email service for sending various types of emails
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import handlebars from 'handlebars';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure email transport
let transporter;

// Initialize email transport based on environment
if (process.env.NODE_ENV === 'production') {
  // Production email configuration
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
} else {
  // Development email configuration - use ethereal.email for testing
  // For development, you can create a test account at https://ethereal.email
  // or configure a local email testing service
  transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: process.env.TEST_EMAIL_USER || 'test@example.com',
      pass: process.env.TEST_EMAIL_PASSWORD || 'testpassword'
    }
  });
}

// Template directory path
const templatesDir = path.join(__dirname, '../templates/emails');

// Helper function to read email templates
const getEmailTemplate = (templateName) => {
  try {
    // For development without actual templates, return a simple template
    if (!fs.existsSync(templatesDir)) {
      return `<h1>{{subject}}</h1><p>Hello {{name}},</p><p>This is a placeholder email.</p>`;
    }
    
    const filePath = path.join(templatesDir, `${templateName}.html`);
    const template = fs.readFileSync(filePath, 'utf-8');
    return template;
  } catch (error) {
    console.error(`Error reading email template: ${error.message}`);
    // Return a fallback template
    return `<h1>{{subject}}</h1><p>Hello {{name}},</p><p>This is a fallback email.</p>`;
  }
};

/**
 * Send an email using a template
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.template - Template name (without extension)
 * @param {Object} options.context - Template variables
 * @returns {Promise} - Nodemailer send result
 */
export const sendEmail = async ({ to, subject, template, context }) => {
  try {
    // For development/testing, skip sending actual emails
    if (process.env.NODE_ENV !== 'production') {
      return { success: true, info: 'Email sending skipped in development' };
    }

    // Get template content
    const templateContent = getEmailTemplate(template);
    
    // Compile template with Handlebars
    const compiledTemplate = handlebars.compile(templateContent);
    const html = compiledTemplate(context);

    // Send email
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"LMS System" <noreply@lms.example.com>',
      to,
      subject,
      html
    });

    return { success: true, info };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

// Export other email-related functions as needed
export default {
  sendEmail
};