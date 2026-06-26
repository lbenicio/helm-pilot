type LogLevel = 'error' | 'warn' | 'info' | 'debug';
const LEVELS: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 };
const level: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
const lv = LEVELS[level] ?? LEVELS.info;
const C = { reset: '\x1b[0m', dim: '\x1b[2m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m' };
const ts = () => `${C.dim}${new Date().toISOString()}${C.reset}`;

export const logger = {
  error: (...args: any[]) => {
    if (lv >= 0) console.error(`${ts()} ${C.bold}${C.red}[ERROR]${C.reset}`, ...args);
  },
  warn: (...args: any[]) => {
    if (lv >= 1) console.warn(`${ts()} ${C.yellow}[WARN]${C.reset}`, ...args);
  },
  info: (...args: any[]) => {
    if (lv >= 2) console.info(`${ts()} ${C.cyan}[INFO]${C.reset}`, ...args);
  },
  debug: (...args: any[]) => {
    if (lv >= 3) console.log(`${ts()} ${C.dim}[DEBUG]${C.reset}`, ...args);
  },
};
