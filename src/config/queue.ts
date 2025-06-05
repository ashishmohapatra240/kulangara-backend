import { Queue, Worker, Job } from 'bullmq';
import redis from './redis';

export const createQueue = (name: string) => {
    return new Queue(name, {
        connection: redis
    });
};