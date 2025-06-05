import express from 'express';
import { Request, Response } from 'express';
import userRoutes from './routes/user.route';
import { prisma } from './config/db';
import redis from './config/redis';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.route';

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;


app.use(express.json());


app.get('/', (req: Request, res: Response) => {
    res.send('Hello kulangara');
});


app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);



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

