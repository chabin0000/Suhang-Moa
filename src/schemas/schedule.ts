import { z } from "zod";
import { SCHEDULE_TYPES } from "../types";

export const scheduleTypeSchema = z.enum(SCHEDULE_TYPES);

export function isRealIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);

  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const scheduleDraftSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력해 주세요.").max(80),
  subject: z.string().trim().max(40),
  description: z.string().trim().max(1000),
  type: scheduleTypeSchema,
  dueDate: z.string().refine(isRealIsoDate, "유효한 날짜를 입력해 주세요."),
});
