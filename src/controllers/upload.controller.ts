import { Request, Response } from 'express';

// Upload Single File
export const uploadFile = (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const fileName = req.file.filename;
        // Build full public URL
        const baseUrl = process.env.BACKEND_URL
            || `${req.protocol}://${req.get('host')}`;
        const url = `${baseUrl}/uploads/${fileName}`;

        res.json({
            success: true,
            data: {
                fileName: fileName,
                url: url,    // Full absolute URL saved to DB
                size: req.file.size
            }
        });

    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ success: false, message: 'Server error during upload' });
    }
};

// Upload Multiple Files (e.g. ID, License, Car Photo)
export const uploadFiles = (req: Request, res: Response) => {
    try {
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
            return res.status(400).json({ success: false, message: 'No files uploaded' });
        }

        const urls = files.map(file => ({
            fieldName: file.fieldname,
            fileName: file.filename,
            url: `/uploads/${file.filename}`
        }));

        res.json({
            success: true,
            data: urls
        });

    } catch (error) {
        console.error('Multi Upload Error:', error);
        res.status(500).json({ success: false, message: 'Server error during upload' });
    }
};
