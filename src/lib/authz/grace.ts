const DEFAULT_GRACE_DAYS = 10;

function parseCreationDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function withinGraceWindow(
  creationTime: string | Date | null | undefined,
  days = DEFAULT_GRACE_DAYS,
): boolean {
  const createdAt = parseCreationDate(creationTime);
  if (!createdAt) return false;
  const graceEnd = new Date(createdAt);
  graceEnd.setDate(graceEnd.getDate() + days);
  return Date.now() <= graceEnd.getTime();
}

