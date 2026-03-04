import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { env } from '../config/env.js';
import { BadRequestError } from '../utils/errors.js';
import crypto from 'crypto';

const s3Client = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT || undefined,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function uploadFile(
  file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
  companyId: string,
  folder: string = 'uploads',
): Promise<string> {
  if (!file || !file.buffer) {
    throw new BadRequestError('No file provided');
  }

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new BadRequestError(
      `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new BadRequestError('File too large. Maximum size is 5MB');
  }

  // Generate unique filename
  const ext = file.originalname.split('.').pop() || 'bin';
  const uniqueName = `${crypto.randomUUID()}.${ext}`;
  const key = `${companyId}/${folder}/${uniqueName}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      CacheControl: 'public, max-age=31536000',
    }),
  );

  // Construct the URL
  const baseUrl = env.S3_ENDPOINT
    ? `${env.S3_ENDPOINT}/${env.S3_BUCKET}`
    : `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com`;

  return `${baseUrl}/${key}`;
}

export async function deleteFile(fileUrl: string): Promise<void> {
  if (!fileUrl) {
    throw new BadRequestError('File URL is required');
  }

  // Extract key from URL
  let key: string;

  try {
    const url = new URL(fileUrl);
    // Handle both path-style and virtual-hosted-style URLs
    if (url.pathname.startsWith(`/${env.S3_BUCKET}/`)) {
      key = url.pathname.substring(`/${env.S3_BUCKET}/`.length);
    } else {
      key = url.pathname.substring(1); // Remove leading /
    }
  } catch {
    throw new BadRequestError('Invalid file URL');
  }

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
    }),
  );
}
