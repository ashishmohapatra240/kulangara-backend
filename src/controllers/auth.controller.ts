import { Request, Response } from 'express';
import { prisma } from '../config/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { IUserCreate } from '../types/user.types';
import redis from '../config/redis';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email.service';

const isProd = process.env.NODE_ENV === 'production';

const generateTokens = (userId: string, role: string) => {
    const accessToken = jwt.sign(
        { userId, role },
        process.env.JWT_SECRET as string,
        { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
        { userId, role },
        process.env.JWT_REFRESH_SECRET as string,
        { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
};

export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const userData: IUserCreate = req.body;

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: userData.email },
        });

        if (existingUser) {
            res.status(400).json({
                status: 'error',
                message: 'Email already registered',
            });
            return;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(userData.password, 10);

        // Create verification token
        const verificationToken = uuidv4();
        const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Store verification token in Redis
        await redis.set(
            `email_verification:${verificationToken}`, //email_verification:ec2-2031fabv : user@example.com
            userData.email,
            'EX',
            24 * 60 * 60 // 24 hours in seconds
        );

        // Create user
        const user = await prisma.user.create({
            data: {
                ...userData,
                password: hashedPassword,
            },
        });

        // Generate tokens
        const tokens = generateTokens(user.id, user.role);

        // Store refresh token
        await prisma.refreshToken.create({
            data: {
                token: tokens.refreshToken,
                userId: user.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            },
        });

        // Send verification email
        await sendVerificationEmail(user.email, user.firstName, verificationToken);

        res.cookie("accessToken", tokens.accessToken, {

            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? 'strict' : 'lax',
            maxAge: 15 * 60 * 1000,
        });

        res.cookie("refreshToken", tokens.refreshToken, {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? 'strict' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.status(201).json({
            status: 'success',
            message: 'Registration successful',
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                },
            },
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
        });
    }
};

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user || !user.isActive) {
            res.status(401).json({
                status: 'error',
                message: 'Invalid credentials',
            });
            return;
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            res.status(401).json({
                status: 'error',
                message: 'Invalid credentials',
            });
            return;
        }

        // Generate tokens
        const tokens = generateTokens(user.id, user.role);

        // Store refresh token
        await prisma.refreshToken.create({
            data: {
                token: tokens.refreshToken,
                userId: user.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            },
        });

        // Update last login
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });

        res.cookie("accessToken", tokens.accessToken, {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? 'strict' : 'lax',
            maxAge: 15 * 60 * 1000,
        });

        res.cookie("refreshToken", tokens.refreshToken, {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? 'strict' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        })

        res.json({
            status: 'success',
            message: 'Login successful',
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    isVerified: user.isVerified,
                },
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
        });
    }
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            res.status(401).json({
                status: 'error',
                message: 'No refresh token provided',
            });
            return;
        }

        // Verify token exists and is valid
        const tokenRecord = await prisma.refreshToken.findUnique({
            where: { token: refreshToken },
            include: { user: true },
        });

        if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
            res.status(401).json({
                status: 'error',
                message: 'Invalid refresh token',
            });
            return;
        }

        // Generate new tokens
        const tokens = generateTokens(tokenRecord.user.id, tokenRecord.user.role);

        // Delete old refresh token
        await prisma.refreshToken.delete({
            where: { id: tokenRecord.id },
        });

        // Store new refresh token
        await prisma.refreshToken.create({
            data: {
                token: tokens.refreshToken,
                userId: tokenRecord.user.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            },
        });

        res.cookie("accessToken", tokens.accessToken, {

            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? 'strict' : 'lax',
            maxAge: 15 * 60 * 1000,
        });

        res.cookie("refreshToken", tokens.refreshToken, {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? 'strict' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        })

        res.json({
            status: 'success',
            message: 'Token refreshed successfully',
            data: {
                user: {
                    id: tokenRecord.user.id,
                    email: tokenRecord.user.email,
                    firstName: tokenRecord.user.firstName,
                    lastName: tokenRecord.user.lastName,
                    role: tokenRecord.user.role,
                    isVerified: tokenRecord.user.isVerified,
                }
            }
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
        });
    }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
    try {
        const token = req.cookies.accessToken;

        if (!token || !req.user?.id) {
            res.status(401).json({
                status: 'error',
                message: 'Unauthorized',
            });
            return;
        }

        // Delete refresh tokens for the user
        const result = await prisma.refreshToken.deleteMany({
            where: { userId: req.user.id },
        });

        if (result.count === 0) {
            res.status(400).json({
                status: 'error',
                message: 'No active session found',
            });
            return;
        }

        res.clearCookie('accessToken', { httpOnly: true, secure: isProd, sameSite: isProd ? 'strict' : 'lax' });
        res.clearCookie('refreshToken', { httpOnly: true, secure: isProd, sameSite: isProd ? 'strict' : 'lax' });

        res.json({
            status: 'success',
            message: 'Logged out successfully',
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
        });
    }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email } = req.body;

        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            res.status(404).json({
                status: 'error',
                message: 'User not found',
            });
            return;
        }

        // Generate reset token
        const resetToken = uuidv4();
        const resetExpiry = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

        // Store reset token in Redis
        await redis.set(
            `password_reset:${resetToken}`,    //password_reset:ec2-3f ashish
            user.id,
            'EX',
            60 * 60 // 1 hour in seconds
        );

        // Send password reset email
        await sendPasswordResetEmail(user.email, user.firstName, resetToken);

        res.json({
            status: 'success',
            message: 'Password reset instructions sent to email',
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
        });
    }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const { token, password } = req.body;

        // Verify token
        const userId = await redis.get(`password_reset:${token}`); //password_reset:ec2-3f ashish
        if (!userId) {
            res.status(400).json({
                status: 'error',
                message: 'Invalid or expired reset token',
            });
            return;
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update password
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });

        // Delete reset token
        await redis.del(`password_reset:${token}`);

        // Invalidate all refresh tokens
        await prisma.refreshToken.deleteMany({
            where: { userId },
        });

        res.json({
            status: 'success',
            message: 'Password reset successful',
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
        });
    }
};

export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
    try {
        const { token } = req.params;

        // Verify token
        const email = await redis.get(`email_verification:${token}`);
        if (!email) {
            res.status(400).json({
                status: 'error',
                message: 'Invalid or expired verification token',
            });
            return;
        }

        // Update user
        await prisma.user.update({
            where: { email },
            data: {
                isVerified: true,
                emailVerifiedAt: new Date(),
            },
        });

        // Delete verification token
        await redis.del(`email_verification:${token}`);

        res.json({
            status: 'success',
            message: 'Email verified successfully',
        });
    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
        });
    }
};

export const resendVerification = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user?.id },
        });

        if (!user) {
            res.status(404).json({
                status: 'error',
                message: 'User not found',
            });
            return;
        }

        if (user.isVerified) {
            res.status(400).json({
                status: 'error',
                message: 'Email already verified',
            });
            return;
        }

        // Generate new verification token
        const verificationToken = uuidv4();

        // Store verification token in Redis
        await redis.set(
            `email_verification:${verificationToken}`,
            user.email,
            'EX',
            24 * 60 * 60 // 24 hours in seconds
        );

        // Send verification email
        await sendVerificationEmail(user.email, user.firstName, verificationToken);

        res.json({
            status: 'success',
            message: 'Verification email sent',
        });
    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
        });
    }
};