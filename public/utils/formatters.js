/**
 * NoChat v4 - Data Formatters
 */

export function formatTimeAgo(isoString) {
  if (!isoString) return '';
  const now = Date.now();
  const past = new Date(isoString).getTime();
  const diffSec = Math.floor((now - past) / 1000);

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d`;
  const diffWeek = Math.floor(diffDay / 7);
  return `${diffWeek}w`;
}

export function formatMemberNumber(number) {
  const n = Number(number) || 1;
  return `Human #${n}`;
}

export function formatVerifiedCountdown(isoExpiry) {
  if (!isoExpiry) return 'Permanent';
  const ms = new Date(isoExpiry).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const days = Math.floor(ms / (24 * 3600 * 1000));
  const hours = Math.floor((ms % (24 * 3600 * 1000)) / (3600 * 1000));
  if (days > 0) return `${days}d ${hours}h left`;
  const mins = Math.floor((ms % (3600 * 1000)) / (60 * 1000));
  return `${hours}h ${mins}m left`;
}

export function formatCount(count) {
  const n = Number(count) || 0;
  if (n < 1000) return String(n);
  if (n < 1000000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${(n / 1000000).toFixed(1).replace(/\.0$/, '')}m`;
}
