import { Router } from 'express';
import {
    createRazorpayOrder,
    verifyPayment,
    handleWebhook
} from '../controllers/payment.controller';
import { validateRequest } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { createRazorpayOrderSchema, verifyPaymentSchema } from '../validators/payment.validator';

const router = Router();

// Webhook (public route)
router.post('/webhook', handleWebhook);

// Protected routes
router.use(authenticate);

// Create Razorpay order
router.post('/create-order', validateRequest(createRazorpayOrderSchema), createRazorpayOrder);

// Verify payment
router.post('/verify', validateRequest(verifyPaymentSchema), verifyPayment);

export default router;