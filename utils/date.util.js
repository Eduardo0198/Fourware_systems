function toDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
    ? `${value}T00:00:00`
    : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(dateValue, days) {
  const date = toDate(dateValue);
  if (!date) {
    return null;
  }

  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatIsoDate(dateValue) {
  const date = toDate(dateValue);
  return date ? date.toISOString().slice(0, 10) : '';
}

function formatDate(dateValue) {
  const date = toDate(dateValue);
  if (!date) {
    return '';
  }

  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatDateTime(dateValue) {
  const date = toDate(dateValue);
  if (!date) {
    return '';
  }

  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function isDateWithinRange(referenceDate, startDate, endDate) {
  const reference = toDate(referenceDate);
  const start = toDate(startDate);
  const end = toDate(endDate);

  if (!reference || !start || !end) {
    return false;
  }

  return reference >= start && reference <= end;
}

function differenceInDays(startDate, endDate) {
  const start = toDate(startDate);
  const end = toDate(endDate);

  if (!start || !end) {
    return 0;
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end - start) / msPerDay) + 1;
}

function getCountdown(endDate, referenceDate = new Date()) {
  const end = toDate(endDate);
  const reference = toDate(referenceDate);

  if (!end || !reference) {
    return {
      expired: true,
      totalMs: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      label: 'Sin campana activa',
    };
  }

  const totalMs = Math.max(end.getTime() - reference.getTime(), 0);
  const totalSeconds = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSeconds / (24 * 60 * 60));
  const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    expired: totalMs === 0,
    totalMs,
    days,
    hours,
    minutes,
    seconds,
    label: `${String(days).padStart(2, '0')}d : ${String(hours).padStart(2, '0')}h : ${String(minutes).padStart(2, '0')}m : ${String(seconds).padStart(2, '0')}s`,
  };
}

module.exports = {
  addDays,
  differenceInDays,
  formatDate,
  formatDateTime,
  formatIsoDate,
  getCountdown,
  isDateWithinRange,
  toDate,
};
