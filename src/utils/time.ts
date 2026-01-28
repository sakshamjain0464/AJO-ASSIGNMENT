/**
 * Returns the current server time in epoch milliseconds.
 * This is the single source of truth for all time-related operations.
 */
export function getServerTime(): number {
  return Date.now();
}

/**
 * Creates a future timestamp from the current server time.
 */
export function createFutureTimestamp(offsetSeconds: number): number {
  return getServerTime() + offsetSeconds * 1000;
}

/**
 * Checks if a timestamp has expired based on current server time.
 */
export function isExpired(timestamp: number): boolean {
  return getServerTime() > timestamp;
}

