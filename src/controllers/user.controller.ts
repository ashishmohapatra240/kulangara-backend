import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { createUserSchema } from '../types/user';


export const createUser = async (req: Request, res: Response): Promise<void> => {
    const result = createUserSchema.safeParse(req.body);


    if (!result.success) {
        res.status(400).json({ error: 'Invalid request body' });
        return;
    }
    const { email, password } = result.data;

    if (await prisma.user.findUnique({ where: { email } })) {
        res.status(400).json({ error: 'User already exists' });
        return;
    }

    const user = await prisma.user.create({
        data: {
            email,
            password,
        },
    });

    res.status(201).json(user);
}


export const getUsers = async (req: Request, res: Response) => {
    const users = await prisma.user.findMany();
    res.status(200).json(users);
}
