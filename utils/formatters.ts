/**
 * Format total playtime minutes as hours string, e.g. "2,083h".
 */
export function formatHours(minutes: number): string {
  const h = Math.round(minutes / 60);
  return `${h.toLocaleString()}h`;
}

/**
 * Return a human-readable relative time string, e.g. "3 hours ago".
 */
export function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

/**
 * Format minutes as a decimal hours string, e.g. "12.3h".
 */
export function toHours(minutes: number): string {
  return `${Math.round((minutes / 60) * 10) / 10}h`;
}

/**
 * Format a Steam playtime stat for display, e.g. "2.5h played".
 */
export function formatSteamPlaytime(minutes: number): string {
  if (minutes < 60) return `${minutes}m played`;
  const h = (minutes / 60).toFixed(1);
  return `${h}h played`;
}
