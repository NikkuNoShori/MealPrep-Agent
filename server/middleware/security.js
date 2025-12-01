import helmet from 'helmet';

/**
 * Security headers middleware
 * Configures Helmet with security best practices
 */
export const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for Tailwind
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"], // Allow images from any HTTPS source
      connectSrc: ["'self'", "https://api.openai.com", "https://openrouter.ai"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  // Cross-Origin Embedder Policy
  crossOriginEmbedderPolicy: false, // Disable for compatibility
  // Cross-Origin Opener Policy
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  // Cross-Origin Resource Policy
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // DNS Prefetch Control
  dnsPrefetchControl: true,
  // Expect-CT
  expectCt: false, // Deprecated, but keeping for compatibility
  // Frameguard
  frameguard: { action: 'deny' },
  // Hide Powered-By
  hidePoweredBy: true,
  // HSTS
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  // IE No Open
  ieNoOpen: true,
  // No Sniff
  noSniff: true,
  // Origin Agent Cluster
  originAgentCluster: true,
  // Permissions Policy
  permissionsPolicy: {
    features: {
      camera: ["'none'"],
      microphone: ["'none'"],
      geolocation: ["'none'"],
    },
  },
  // Referrer Policy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // XSS Filter
  xssFilter: true,
});

/**
 * Request size limits middleware
 * Prevents DoS attacks via large payloads
 */
export const requestSizeLimits = {
  // JSON body size limit (1MB)
  json: { limit: '1mb' },
  // URL-encoded body size limit (1MB)
  urlencoded: { limit: '1mb', extended: true },
  // Raw body size limit (1MB)
  raw: { limit: '1mb' },
  // Text body size limit (1MB)
  text: { limit: '1mb' },
};

/**
 * Secure error handler
 * Prevents leaking sensitive information in error responses
 */
export const secureErrorHandler = (err, req, res, next) => {
  // Log full error details server-side
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // Don't leak sensitive information to client
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Return sanitized error response
  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: isDevelopment ? err.message : 'An error occurred. Please try again later.',
    ...(isDevelopment && { stack: err.stack }),
  });
};

