import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { Request, Response } from 'express';
import { prisma } from './config/db';
import redis from './config/redis';
import indexRoutes from './routes';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler, notFoundHandler } from './middleware/error';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(morgan('dev'));
app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
    res.send('Hello kulangara');
});

app.use('/api/v1', indexRoutes);

// Handle 404
app.use(notFoundHandler);

// Error handling middleware
app.use(errorHandler);

app.listen(port, async () => {
    try {
        await prisma.$connect();
        console.log('Connected to database');

        // Test Redis connection
        await redis.ping();
    } catch (error) {
        console.error('Failed to connect to services:', error);
        process.exit(1);
    }
    console.log(`Server running on port ${port}`);
});

