import { Router } from 'express';

const router = Router();

// TODO: Implement payment routes
router.post('/process', (req, res) => {
    res.json({ message: 'Payment processing endpoint - Coming soon' });
});

export default router;
