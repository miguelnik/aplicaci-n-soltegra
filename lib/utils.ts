import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Detecta los errores especiales que lanza Next.js cuando se invoca redirect()
 * o notFound() desde Server Components / Server Actions. Estos errores DEBEN
 * propagarse hacia arriba; si los capturamos en un try/catch silencioso, la
 * redirección no ocurre y el usuario se queda en la página actual.
 */
export function isNextControlFlowError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const digest = (err as { digest?: unknown }).digest;
  if (typeof digest !== "string") return false;
  return digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND";
}
