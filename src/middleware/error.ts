import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { HttpError } from 'http-errors';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

interface ErrorResponse {
    status: 'error';
    message: string;
    errors?: any[];
    code?: string;
}

export const errorHandler: ErrorRequestHandler = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    console.error('Error:', err);

    const errorResponse: ErrorResponse = {
        status: 'error',
        message: 'Internal server error'
    };

    // Handle HTTP Errors (e.g., from http-errors package)
    if (err instanceof HttpError) {
        errorResponse.message = err.message;
        res.status(err.status).json(errorResponse);
        return;
    }

    // Handle Prisma Errors
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        switch (err.code) {
            case 'P2002':
                errorResponse.message = 'Duplicate entry found';
                errorResponse.code = err.code;
                res.status(409).json(errorResponse);
                return;
            case 'P2025':
                errorResponse.message = 'Record not found';
                errorResponse.code = err.code;
                res.status(404).json(errorResponse);
                return;
            case 'P2023':
                errorResponse.message = 'Invalid ID format';
                errorResponse.code = err.code;
                res.status(400).json(errorResponse);
                return;
            default:
                errorResponse.code = err.code;
                res.status(500).json(errorResponse);
                return;
        }
    }

    if (err instanceof Prisma.PrismaClientValidationError) {
        errorResponse.message = 'Validation error';
        res.status(400).json(errorResponse);
        return;
    }

    // Handle Zod Validation Errors
    if (err instanceof ZodError) {
        errorResponse.message = 'Validation failed';
        errorResponse.errors = err.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
        }));
        res.status(400).json(errorResponse);
        return;
    }

    // Handle JWT Errors
    if (err.name === 'JsonWebTokenError') {
        errorResponse.message = 'Invalid token';
        res.status(401).json(errorResponse);
        return;
    }

    if (err.name === 'TokenExpiredError') {
        errorResponse.message = 'Token expired';
        res.status(401).json(errorResponse);
        return;
    }

    // Default error
    res.status(500).json(errorResponse);
};

export const notFoundHandler = (req: Request, res: Response) => {
    res.status(404).json({
        status: 'error',
        message: 'Route not found'
    });
}; 