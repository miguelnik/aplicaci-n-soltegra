import "server-only";
import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "no-reply@soltegra.es";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";

export const ADMIN_EMAILS = (process.env.ADMIN_NOTIFICATION_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);
