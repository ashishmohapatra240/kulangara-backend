import { z } from 'zod';

export const createRazorpayOrderSchema = z.object({
    body: z.object({
        orderId: z.string()
    })
});

export const verifyPaymentSchema = z.object({
    body: z.object({
        razorpay_order_id: z.string(),
        razorpay_payment_id: z.string(),
        razorpay_signature: z.string()
    })
});