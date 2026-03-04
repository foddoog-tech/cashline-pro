import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

/**
 * Middleware to check for validation errors from express-validator
 */
export const validate = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
        return next();
    }

    return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array(),
    });
};
