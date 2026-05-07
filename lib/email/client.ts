import "server-only";
import { Resend } from "resend";

// Lazy init: evita que el build falle si RESEND_API_KEY no existe aún
let _resend: Resend | null = null;
export function getResend() {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "no-reply@soltegra.es";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";

export const ADMIN_EMAILS = (process.env.ADMIN_NOTIFICATION_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);
