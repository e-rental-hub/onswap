type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const isDev = process.env.NODE_ENV === 'development';

const formatMessage = (level: LogLevel, message: string, ...args: unknown[]) => {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
};

export const logger = {
  info: (message: string, ...args: unknown[]) => {
    if (isDev) console.info(formatMessage('info', message), ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    console.warn(formatMessage('warn', message), ...args);
  },
  error: (message: string, ...args: unknown[]) => {
    console.error(formatMessage('error', message), ...args);
  },
  debug: (message: string, ...args: unknown[]) => {
    if (isDev) console.debug(formatMessage('debug', message), ...args);
  },
};
