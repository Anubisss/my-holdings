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
const CHECK_INTERVAL_MS = 60_000;

const etFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

type EtParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
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

  const dateInET = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
  const dayOfWeek = dateInET.getDay();

  return { year, month, day, hour, minute, dayOfWeek };
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

const snapshotExists = (dateStr: string): boolean => {
  const row = db
    .select({ id: portfolioValueHistory.id })
    .from(portfolioValueHistory)
    .where(eq(portfolioValueHistory.date, dateStr))
    .get();
  return row !== undefined;
};

let lastHandledDate: string | null = null;

/**
 * Sends the daily notification and saves the snapshot once per weekday, as soon
 * as the ET wall clock is past 4:20 PM. On startup, today is only caught up if
 * its snapshot is still missing.
 */
const tick = async (isStartup: boolean): Promise<void> => {
  const et = nowET();
  const today = etDateStr(et);
  if (!isWeekday(et.dayOfWeek) || !isPastTarget(et) || lastHandledDate === today) return;
  lastHandledDate = today;

  try {
    if (isStartup) {
      if (snapshotExists(today)) return;
      logger.info({ date: today }, 'Missed snapshot detected, attempting saving snapshot');
    }
    await sendDailyNotification(today);
    await saveSnapshot(today);
  } catch (error) {
    const message = isStartup
      ? 'Unexpected error during startup saving snapshot'
      : 'Unexpected error during scheduled snapshot';
    logger.error({ err: error, date: today }, message);
  }
};

/**
 * Starts the daily snapshot scheduler. The ET wall clock is polled instead of
 * sleeping until a precomputed instant, so DST transitions, system clock
 * changes and machine sleep cannot shift the run time.
 */
export const startScheduler = async (): Promise<void> => {
  logger.info(
    `Daily snapshot scheduled for weekdays at ${TARGET_HOUR}:${String(TARGET_MINUTE).padStart(2, '0')} ${TZ}`,
  );
  setInterval(() => void tick(false), CHECK_INTERVAL_MS);
  await tick(true);
};
