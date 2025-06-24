import { v2 as cloudinary } from 'cloudinary';

// Validate Cloudinary environment variables
const requiredEnvVars = {
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
};

const missingVars = Object.entries(requiredEnvVars)
  .filter(([key, value]) => !value || value.includes('your_') || value === 'root')
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error('❌ Cloudinary Configuration Error:');
  console.error(`Missing or invalid environment variables: ${missingVars.join(', ')}`);
  console.error('Please set up your Cloudinary account at https://cloudinary.com');
  console.error('and update your .env file with the correct values.');
  
  // Don't throw error in development to allow server to start
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Missing Cloudinary configuration: ${missingVars.join(', ')}`);
  }
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;
