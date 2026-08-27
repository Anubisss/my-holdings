import { eq } from 'drizzle-orm';

import { db } from '../db/client.js';
import { portfolioValueHistory } from '../db/schema.js';
import { logger } from './logger.js';
import { sendDailyNotification } from './notification.js';
import { saveSnapshot } from './snapshot.js';

const TZ = 'America/New_York';
const MARKET_CLOSE_HOUR = 16;
const SAVE_DELAY_MINUTES = 20;
const TARGET_HOUR = MARKET_CLOSE_HOUR;
const TARGET_MINUTE = SAVE_DELAY_MINUTES;

const etFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

type EtParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dayOfWeek: number;
};

/** Returns the current wall-clock time in America/New_York. */
const nowET = (): EtParts => {
  const parts = Object.fromEntries(
    etFormatter.formatToParts(new Date()).map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const second = Number(parts.second);

  const dateInET = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
  const dayOfWeek = dateInET.getDay();

  return { year, month, day, hour, minute, second, dayOfWeek };
};

/** Formats an ET date as YYYY-MM-DD. */
const etDateStr = (et: EtParts): string => {
  const m = String(et.month).padStart(2, '0');
  const d = String(et.day).padStart(2, '0');
  return `${et.year}-${m}-${d}`;
};

const isWeekday = (dayOfWeek: number): boolean => dayOfWeek >= 1 && dayOfWeek <= 5;

const isPastTarget = (et: EtParts): boolean =>
  et.hour > TARGET_HOUR || (et.hour === TARGET_HOUR && et.minute >= TARGET_MINUTE);

/**
 * Computes milliseconds from now until the next weekday at 4:20 PM ET.
 * If it's before 4:20 PM ET on a weekday, the target is today.
 * Otherwise, advance to the next weekday.
 */
const msUntilNextTarget = (): { ms: number; dateStr: string } => {
  const now = new Date();
  const et = nowET();

  const targetToday = isWeekday(et.dayOfWeek) && !isPastTarget(et);

  let daysToAdd = 0;
  if (!targetToday) {
    daysToAdd = 1;
    let nextDow = (et.dayOfWeek + 1) % 7;
    while (!isWeekday(nextDow)) {
      daysToAdd++;
      nextDow = (nextDow + 1) % 7;
    }
  }

  const targetDate = new Date(now.getTime() + daysToAdd * 86_400_000);
  const targetET = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(targetDate)
    .reduce(
      (acc, p) => {
        if (p.type === 'year') acc.year = Number(p.value);
        if (p.type === 'month') acc.month = Number(p.value);
        if (p.type === 'day') acc.day = Number(p.value);
        return acc;
      },
      { year: 0, month: 0, day: 0 },
    );

  const dateStr = `${targetET.year}-${String(targetET.month).padStart(2, '0')}-${String(targetET.day).padStart(2, '0')}`;

  // Build the target instant by computing the difference between the current
  // ET wall-clock time and the target 16:20:00, then adding that difference
  // to the real clock.
  const currentSecondsInDay = et.hour * 3600 + et.minute * 60 + et.second;
  const targetSecondsInDay = TARGET_HOUR * 3600 + TARGET_MINUTE * 60;

  let diffSeconds = targetSecondsInDay - currentSecondsInDay + daysToAdd * 86_400;
  if (diffSeconds <= 0) diffSeconds += 86_400;

  return { ms: diffSeconds * 1000, dateStr };
};

const snapshotExists = (dateStr: string): boolean => {
  const row = db
    .select({ id: portfolioValueHistory.id })
    .from(portfolioValueHistory)
    .where(eq(portfolioValueHistory.date, dateStr))
    .get();
  return row !== undefined;
};

const scheduleNext = (): void => {
  const { ms, dateStr } = msUntilNextTarget();
  const minutes = Math.floor(ms / 60_000);
  logger.info({ date: dateStr, inMinutes: minutes }, 'Next snapshot scheduled');

  setTimeout(async () => {
    await sendDailyNotification(dateStr);
    try {
      await saveSnapshot(dateStr);
    } catch (error) {
      logger.error({ err: error, date: dateStr }, 'Unexpected error during scheduled snapshot');
    }
    scheduleNext();
  }, ms);
};

/**
 * Starts the daily snapshot scheduler. On startup, checks if today's snapshot
 * is missing and attempts an immediate save if the market should have already
 * closed. Then schedules the next future save.
 */
export const startScheduler = async (): Promise<void> => {
  const et = nowET();
  const today = etDateStr(et);

  if (isWeekday(et.dayOfWeek) && isPastTarget(et) && !snapshotExists(today)) {
    logger.info({ date: today }, 'Missed snapshot detected, attempting saving snapshot');
    await sendDailyNotification(today);
    try {
      await saveSnapshot(today);
    } catch (error) {
      logger.error({ err: error, date: today }, 'Unexpected error during startup saving snapshot');
    }
  }

  scheduleNext();
};
