import express from 'express';
import { upload } from '../middleware/upload';
import { uploadFile, uploadFiles } from '../controllers/upload.controller';

const router = express.Router();

// POST /api/v1/upload
router.post('/', upload.single('file'), uploadFile);

// POST /api/v1/upload/multiple
// Can handle fields: id_card, license, vehicle_photo
router.post('/multiple', upload.array('files', 5), uploadFiles);

export default router;
