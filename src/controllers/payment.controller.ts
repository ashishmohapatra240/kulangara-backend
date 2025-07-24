import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/db';
import { PaymentStatus } from '@prisma/client';
import { razorpay } from '../config/razorpay';

// Create Razorpay order
export const createRazorpayOrder = async (req: Request, res: Response): Promise<void> => {
    try {
        const { orderId } = req.body;

        // Get order details from database
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: {
                id: true,
                orderNumber: true,
                totalAmount: true,
                user: {
                    select: {
                        email: true,
                        firstName: true,
                        lastName: true,
                        phone: true
                    }
                }
            }
        });

        if (!order) {
            res.status(404).json({
                status: 'error',
                message: 'Order not found'
            });
            return;
        }

        // Create Razorpay order
        const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(order.totalAmount), // Convert to smallest currency unit (paise)
            currency: 'INR',
            receipt: order.orderNumber,
            notes: {
                orderId: order.id
            }
        });

        // Return order details
        res.json({
            status: 'success',
            data: {
                orderId: razorpayOrder.id,
                currency: razorpayOrder.currency,
                amount: razorpayOrder.amount,
                key: process.env.RAZORPAY_KEY_ID,
                name: process.env.BUSINESS_NAME || 'Kulangara',
                description: `Order #${order.orderNumber}`,
                prefill: {
                    name: `${order.user.firstName} ${order.user.lastName}`,
                    email: order.user.email,
                    contact: order.user.phone
                }
            }
        });
    } catch (error) {
        console.error('Error in createRazorpayOrder:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to create payment order'
        });
    }
};

// Verify payment
export const verifyPayment = async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        // Verify signature
        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
            .update(body)
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            res.status(400).json({
                status: 'error',
                message: 'Invalid payment signature'
            });
            return;
        }

        // Get payment details
        const payment = await razorpay.payments.fetch(razorpay_payment_id);
        const orderId = payment.notes?.orderId;

        if (!orderId) {
            res.status(400).json({
                status: 'error',
                message: 'Order ID not found in payment'
            });
            return;
        }

        // Update order status
        await prisma.order.update({
            where: { id: orderId },
            data: {
                paymentStatus: PaymentStatus.PAID,
                paymentId: razorpay_payment_id,
                status: 'CONFIRMED',
                statusHistory: {
                    create: {
                        status: 'CONFIRMED',
                        note: 'Payment received and verified'
                    }
                }
            }
        });

        res.json({
            status: 'success',
            message: 'Payment verified successfully'
        });
    } catch (error) {
        console.error('Error in verifyPayment:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to verify payment'
        });
    }
};

// Handle Razorpay webhook
export const handleWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const signature = req.headers['x-razorpay-signature'];

        if (!webhookSecret || !signature) {
            res.status(400).json({
                status: 'error',
                message: 'Missing webhook secret or signature'
            });
            return;
        }

        // Verify webhook signature
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(req.body)
            .digest('hex');

        if (expectedSignature !== signature) {
            res.status(400).json({
                status: 'error',
                message: 'Invalid webhook signature'
            });
            return;
        }

        const event = req.body;

        switch (event.event) {
            case 'payment.captured':
                await handlePaymentCaptured(event.payload.payment.entity);
                break;
            case 'payment.failed':
                await handlePaymentFailed(event.payload.payment.entity);
                break;
            case 'refund.processed':
                await handleRefundProcessed(event.payload.refund.entity);
                break;
        }

        res.json({ status: 'success' });
    } catch (error) {
        console.error('Error in handleWebhook:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to process webhook'
        });
    }
};

// Helper functions for webhook handling
async function handlePaymentCaptured(payment: any) {
    const orderId = payment.notes?.orderId;
    if (!orderId) return;

    await prisma.order.update({
        where: { id: orderId },
        data: {
            paymentStatus: PaymentStatus.PAID,
            paymentId: payment.id,
            status: 'CONFIRMED',
            statusHistory: {
                create: {
                    status: 'CONFIRMED',
                    note: 'Payment captured successfully'
                }
            }
        }
    });
}

async function handlePaymentFailed(payment: any) {
    const orderId = payment.notes?.orderId;
    if (!orderId) return;

    await prisma.order.update({
        where: { id: orderId },
        data: {
            paymentStatus: PaymentStatus.FAILED,
            paymentId: payment.id,
            status: 'CANCELLED',
            statusHistory: {
                create: {
                    status: 'CANCELLED',
                    note: 'Payment failed'
                }
            }
        }
    });
}

async function handleRefundProcessed(refund: any) {
    const orderId = refund.notes?.orderId;
    if (!orderId) return;

    await prisma.order.update({
        where: { id: orderId },
        data: {
            paymentStatus: PaymentStatus.REFUNDED,
            status: 'REFUNDED',
            statusHistory: {
                create: {
                    status: 'REFUNDED',
                    note: `Refund processed: ${refund.id}`
                }
            }
        }
    });
}