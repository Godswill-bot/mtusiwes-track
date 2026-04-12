import { format, isToday, isYesterday } from "date-fns";

export type PresenceSource = {
  user_id?: string | null;
  last_active_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type ActivityRecord = {
  user_id: string | null;
  created_at: string;
};

export const buildLastSeenMap = (activities: ActivityRecord[] = []) => {
  const lastSeenMap = new Map<string, string>();

  activities.forEach((activity) => {
    if (!activity.user_id || lastSeenMap.has(activity.user_id)) return;
    lastSeenMap.set(activity.user_id, activity.created_at);
  });

  return lastSeenMap;
};

export const resolveLastSeenAt = (
  record: PresenceSource,
  lastSeenMap?: Map<string, string>,
) => {
  const candidates = [
    record.last_active_at,
    record.user_id ? lastSeenMap?.get(record.user_id) : null,
    record.updated_at,
    record.created_at,
  ].filter((value): value is string => Boolean(value));

  if (candidates.length === 0) return null;

  return candidates.reduce((latest, candidate) => (
    new Date(candidate).getTime() > new Date(latest).getTime() ? candidate : latest
  ));
};

export const formatLastSeen = (lastSeenAt: string | null | undefined) => {
  if (!lastSeenAt) return "No activity recorded";

  const date = new Date(lastSeenAt);
  if (Number.isNaN(date.getTime())) return "No activity recorded";

  if (isToday(date)) {
    return `Today, ${format(date, "h:mm a")}`;
  }

  if (isYesterday(date)) {
    return `Yesterday, ${format(date, "h:mm a")}`;
  }

  return format(date, "MMM d, yyyy 'at' h:mm a");
};

export const isCurrentlyOnline = (
  lastSeenAt: string | null | undefined,
  isActive: boolean,
  windowMs = 5 * 60 * 1000,
) => {
  if (!isActive || !lastSeenAt) return false;
  const lastSeen = new Date(lastSeenAt).getTime();
  return Date.now() - lastSeen < windowMs;
};