import { Router } from 'express';
import {
    register,
    login,
    refreshToken,
    logout,
    forgotPassword,
    resetPassword,
    verifyEmail,
    resendVerification
} from '../controllers/auth.controller';
import { validateRequest } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import {
    registerSchema,
    loginSchema,
    refreshTokenSchema,
    forgotPasswordSchema,
    resetPasswordSchema
} from '../validators/auth.validator';

const router = Router();

router.post('/register', validateRequest(registerSchema), register);
router.post('/login', validateRequest(loginSchema), login);
router.post('/refresh', validateRequest(refreshTokenSchema), refreshToken);
router.post('/logout', authenticate, logout);
router.post('/forgot-password', validateRequest(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validateRequest(resetPasswordSchema), resetPassword);
router.post('/verify-email/:token', verifyEmail);
router.post('/resend-verification', authenticate, resendVerification);

export default router;