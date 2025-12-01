/**
 * Unified Logger Service
 * Browser-safe logging that works in both frontend and backend
 */

// Browser-safe logger (no winston, no Node.js dependencies)
const isBrowser = typeof window !== 'undefined';

// Log levels
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
} as const;

// Get log level from environment (browser-safe)
const getLogLevel = (): number => {
  if (isBrowser) {
    // In browser, use Vite env vars
    try {
      const env = (import.meta as any).env?.MODE || 'development';
      return env === 'production' ? LOG_LEVELS.warn : LOG_LEVELS.debug;
    } catch {
      // Fallback to debug if env is not available
      return LOG_LEVELS.debug;
    }
  } else {
    // In Node.js, use process.env (only if process is available)
    try {
      const env = (typeof process !== 'undefined' && process.env?.NODE_ENV) || 'development';
      return env === 'production' ? LOG_LEVELS.warn : LOG_LEVELS.debug;
    } catch {
      // Fallback to debug if process is not available
      return LOG_LEVELS.debug;
    }
  }
};

const currentLogLevel = getLogLevel();

// Simple browser-safe logger
const log = (level: keyof typeof LOG_LEVELS, message: string, data?: any) => {
  if (LOG_LEVELS[level] > currentLogLevel) {
    return; // Skip if level is too low
  }

  const timestamp = new Date().toISOString();
  const logData = data ? { ...data, timestamp } : { timestamp };

  switch (level) {
    case 'error':
      console.error(`[${timestamp}] ❌ ${message}`, logData);
      break;
    case 'warn':
      console.warn(`[${timestamp}] ⚠️ ${message}`, logData);
      break;
    case 'info':
      console.log(`[${timestamp}] ℹ️ ${message}`, logData);
      break;
    case 'http':
      console.log(`[${timestamp}] 🌐 ${message}`, logData);
      break;
    case 'debug':
      console.debug(`[${timestamp}] 🔍 ${message}`, logData);
      break;
  }
};

/**
 * Logger helper class for application use
 * Browser-safe implementation
 */
export class AppLogger {
  /**
   * Log database query
   */
  static dbQuery(query: string, params?: any[], duration?: number) {
    log('info', '📊 Database Query', {
      type: 'database',
      query: query.substring(0, 200),
      params: params?.length || 0,
      duration: duration ? `${duration.toFixed(2)}ms` : 'N/A',
    });
  }

  /**
   * Log database error
   */
  static dbError(error: Error, query?: string, params?: any[]) {
    log('error', '❌ Database Error', {
      type: 'database',
      error: error.message,
      code: (error as any).code,
      detail: (error as any).detail,
      hint: (error as any).hint,
      query: query?.substring(0, 200),
      params: params?.length || 0,
    });
  }

  /**
   * Log database connection event
   */
  static dbConnect(processId?: number) {
    log('info', '🔌 Database Client Connected', {
      type: 'database',
      processId,
    });
  }

  /**
   * Log database disconnect event
   */
  static dbDisconnect(processId?: number) {
    log('info', '🔌 Database Client Disconnected', {
      type: 'database',
      processId,
    });
  }

  /**
   * Log database transaction
   */
  static dbTransaction(event: 'start' | 'finish' | 'rollback', duration?: number) {
    log('info', `📝 Database Transaction ${event}`, {
      type: 'database',
      event,
      duration: duration ? `${duration.toFixed(2)}ms` : undefined,
    });
  }

  /**
   * Log application info
   */
  static info(message: string, data?: any) {
    log('info', message, {
      type: 'application',
      ...data,
    });
  }

  /**
   * Log application warning
   */
  static warn(message: string, data?: any) {
    log('warn', message, {
      type: 'application',
      ...data,
    });
  }

  /**
   * Log application error
   */
  static error(message: string, error?: Error | any, data?: any) {
    log('error', message, {
      type: 'application',
      error: error?.message || error,
      stack: error?.stack,
      ...data,
    });
  }

  /**
   * Log HTTP request
   */
  static http(method: string, path: string, statusCode?: number, duration?: number) {
    log('http', `${method} ${path}`, {
      type: 'http',
      method,
      path,
      statusCode,
      duration: duration ? `${duration.toFixed(2)}ms` : undefined,
    });
  }

  /**
   * Log debug information
   */
  static debug(message: string, data?: any) {
    log('debug', message, {
      type: 'debug',
      ...data,
    });
  }

  /**
   * Log authentication event
   */
  static auth(event: 'signin' | 'signup' | 'signout' | 'password-reset', userId?: string, email?: string) {
    log('info', `🔐 Auth: ${event}`, {
      type: 'auth',
      event,
      userId,
      email: email ? email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : undefined, // Mask email
    });
  }

  /**
   * Log API call
   */
  static api(endpoint: string, method: string, statusCode?: number, duration?: number) {
    log('http', `API: ${method} ${endpoint}`, {
      type: 'api',
      endpoint,
      method,
      statusCode,
      duration: duration ? `${duration.toFixed(2)}ms` : undefined,
    });
  }

  /**
   * Log external service call
   */
  static external(service: string, action: string, status?: 'success' | 'error', data?: any) {
    const level = status === 'error' ? 'error' : 'info';
    log(level, `🌐 External Service: ${service} - ${action}`, {
      type: 'external',
      service,
      action,
      status,
      ...data,
    });
  }
}

// Export Logger as alias for convenience
export { AppLogger as Logger };

// Export default logger instance (for compatibility)
export default AppLogger;
