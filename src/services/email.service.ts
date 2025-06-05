import { renderAsync } from '@react-email/render';
import { resend } from '../config/resend';
import { VerificationEmail } from '../emails/VerificationEmail';
import { ResetPasswordEmail } from '../emails/ResetPasswordEmail';

const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

export const sendVerificationEmail = async (
    email: string,
    firstName: string,
    token: string
) => {
    const verificationUrl = `${APP_URL}/verify-email/${token}`;
    const html = await renderAsync(
        VerificationEmail({ firstName, verificationUrl })
    );

    return resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: 'Verify your email address',
        html,
    });
};

export const sendPasswordResetEmail = async (
    email: string,
    firstName: string,
    token: string
) => {
    const resetUrl = `${APP_URL}/reset-password/${token}`;
    const html = await renderAsync(
        ResetPasswordEmail({ firstName, resetUrl })
    );

    return resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: 'Reset your password',
        html,
    });
}; 