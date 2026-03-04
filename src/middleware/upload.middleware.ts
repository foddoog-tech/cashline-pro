import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

// Check if uploads directory exists
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage Strategy
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Basic folder structure based on type if needed, for now just root uploads
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename: uuid + extension
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
    }
});

// File Filter
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Accept images and pdfs
    if (
        file.mimetype.startsWith('image/') ||
        file.mimetype === 'application/pdf'
    ) {
        cb(null, true);
    } else {
        cb(new Error('Format not supported! Only images and PDFs are allowed.'));
    }
};

// Limits
const limits = {
    fileSize: 5 * 1024 * 1024, // 5MB limit
};

export const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: limits,
});

export const handleUploadError = (err: any, req: Request, res: any, next: any) => {
    if (err instanceof multer.MulterError) {
        // Multer error
        return res.status(400).json({
            status: 'error',
            message: `Upload error: ${err.message}`
        });
    } else if (err) {
        // Other error
        return res.status(400).json({
            status: 'error',
            message: err.message
        });
    }
    next();
};
