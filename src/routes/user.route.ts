import { Router } from 'express';
import { createUser, getUsers } from '../controllers/user.controller';
import { createUserSchema } from '../types/user';
import { validate } from '../middlewares/validate';

const router = Router();

router.post('/', validate(createUserSchema), createUser);
router.get('/', getUsers);

export default router;
