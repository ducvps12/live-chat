/**
 * Date utility functions
 */

/**
 * Format a date as relative time (e.g., "Just now", "2 mins ago", "Yesterday")
 */
export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return '';

  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'Just now';
  } else if (diffMin < 60) {
    return `${diffMin} min${diffMin > 1 ? 's' : ''} ago`;
  } else if (diffHour < 24) {
    return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  } else if (diffDay === 1) {
    return 'Yesterday';
  } else if (diffDay < 7) {
    return `${diffDay} days ago`;
  } else {
    return then.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
}

/**
 * Format a date as time (e.g., "10:30 AM")
 */
export function formatTime(date: string | Date | null | undefined): string {
  if (!date) return '';

  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format a date with day context (e.g., "Today, 10:30 AM")
 */
export function formatMessageTime(date: string | Date | null | undefined): string {
  if (!date) return '';

  const now = new Date();
  const then = new Date(date);
  const isToday = now.toDateString() === then.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = yesterday.toDateString() === then.toDateString();

  const time = formatTime(date);

  if (isToday) {
    return time;
  } else if (isYesterday) {
    return `Yesterday, ${time}`;
  } else {
    return then.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
}

/**
 * Format date for message separator (e.g., "Today, 10:23 AM")
 */
export function formatDateSeparator(date: string | Date | null | undefined): string {
  if (!date) return '';

  const now = new Date();
  const then = new Date(date);
  const isToday = now.toDateString() === then.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = yesterday.toDateString() === then.toDateString();

  const time = formatTime(date);

  if (isToday) {
    return `Today, ${time}`;
  } else if (isYesterday) {
    return `Yesterday, ${time}`;
  } else {
    return then.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
}
