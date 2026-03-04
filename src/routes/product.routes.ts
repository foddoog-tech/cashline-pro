import express from 'express';
import {
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    approveProduct,
    rejectProduct
} from '../controllers/product.controller';

const router = express.Router();

// Public routes
router.get('/', getAllProducts);
router.get('/:id', getProductById);

// Protected routes (يحتاج authentication في المستقبل)
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

// Admin routes
router.put('/:id/approve', approveProduct);
router.put('/:id/reject', rejectProduct);

export default router;
