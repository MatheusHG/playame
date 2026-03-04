import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { apiRouter, stripeWebhookRouter } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { tenantResolver } from './middleware/tenantResolver.js';
import { prisma } from './config/database.js';

const app = express();

// Security
app.use(helmet());

// Dynamic CORS — allow registered company domains + static origins
const staticOrigins = env.CORS_ORIGINS.split(',').map(s => s.trim());

// Cache of allowed domains, refreshed periodically
let allowedDomainsCache: Set<string> = new Set();
let domainsCacheExpiry = 0;
const DOMAINS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function refreshAllowedDomains(): Promise<Set<string>> {
  if (Date.now() < domainsCacheExpiry) return allowedDomainsCache;
  try {
    const companies = await prisma.companies.findMany({
      where: { deleted_at: null, custom_domain: { not: null } },
      select: { custom_domain: true },
    });
    const domains = new Set<string>();
    for (const c of companies) {
      if (c.custom_domain) {
        const d = c.custom_domain.toLowerCase();
        domains.add(`https://${d}`);
        domains.add(`http://${d}`);
        // Also allow www variant
        if (!d.startsWith('www.')) {
          domains.add(`https://www.${d}`);
          domains.add(`http://www.${d}`);
        }
      }
    }
    allowedDomainsCache = domains;
    domainsCacheExpiry = Date.now() + DOMAINS_CACHE_TTL;
    return domains;
  } catch {
    return allowedDomainsCache;
  }
}

app.use(cors({
  origin: async (origin, callback) => {
    // Allow requests with no origin (server-to-server, mobile apps, curl)
    if (!origin) return callback(null, true);

    // Check static origins
    if (staticOrigins.includes(origin)) return callback(null, true);

    // Check registered company domains
    const domains = await refreshAllowedDomains();
    if (domains.has(origin)) return callback(null, true);

    // In development, allow localhost
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
  credentials: true,
}));

// Stripe webhook needs raw body BEFORE json parsing
app.use('/api/stripe/webhook', stripeWebhookRouter);

// JSON parsing for all other routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('dev'));

// Tenant resolution — resolves company from Host header
app.use(tenantResolver());

// API routes
app.use('/api', apiRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

export { app };
