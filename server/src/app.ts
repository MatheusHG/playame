import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { apiRouter, stripeWebhookRouter } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Security
app.use(helmet());

// CORS
app.use(cors({
  origin: env.CORS_ORIGINS.split(',').map(s => s.trim()),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Stripe webhook needs raw body BEFORE json parsing
app.use('/api/stripe/webhook', stripeWebhookRouter);

// JSON parsing for all other routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('dev'));

// API routes
app.use('/api', apiRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

export { app };
