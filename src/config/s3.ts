import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import createError from 'http-errors';

if (!process.env.AWS_ACCESS_KEY_ID) throw new Error('AWS_ACCESS_KEY_ID is not defined');
if (!process.env.AWS_SECRET_ACCESS_KEY) throw new Error('AWS_SECRET_ACCESS_KEY is not defined');
if (!process.env.AWS_REGION) throw new Error('AWS_REGION is not defined');
if (!process.env.AWS_BUCKET_NAME) throw new Error('AWS_BUCKET_NAME is not defined');

export const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

export const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

export const generateUploadURL = async (key: string, contentType: string) => {
    try {
        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            ContentType: contentType,
        });

        const uploadURL = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        return uploadURL;
    } catch (error) {
        console.error('Error generating upload URL:', error);
        throw createError(500, 'Failed to generate upload URL');
    }
};

export const deleteFile = async (key: string) => {
    try {
        const command = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
        });

        await s3Client.send(command);
    } catch (error) {
        console.error('Error deleting file from S3:', error);
        throw createError(500, 'Failed to delete file from S3');
    }
};