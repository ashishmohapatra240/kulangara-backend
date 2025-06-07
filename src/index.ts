import express from 'express';
import { Request, Response } from 'express';
import userRoutes from './routes/user.route';
import { prisma } from './config/db';
import redis from './config/redis';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.route';
import productRoutes from './routes/product.route';
import categoryRoutes from './routes/category.route';
import couponRoutes from './routes/coupon.route';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler, notFoundHandler } from './middleware/error';

dotenv.config();
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

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/coupons', couponRoutes);

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

