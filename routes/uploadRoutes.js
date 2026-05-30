import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { protect } from '../middleware/authMiddleware.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Configure Cloudinary
console.log('Cloudinary Config Check:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY ? 'present' : 'missing',
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer Storage with Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'codesync_avatars',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 250, height: 250, crop: 'limit' }], // Automatically compress/resize
  },
});

const upload = multer({ storage: storage });


router.post('/avatar', protect, (req, res) => {
  upload.single('image')(req, res, function (err) {
    if (err) {
      console.error('Multer Upload Error:', err);
      return res.status(500).json({ message: 'Multer error', error: err.message });
    }
    
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an image file' });
    }
    
    // The secure_url is returned by Cloudinary
    res.status(200).json({
      message: 'Image uploaded successfully',
      url: req.file.path, // Cloudinary uses .path to store the secure url
    });
  });
});

export default router;
