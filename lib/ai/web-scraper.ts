import "server-only";

// ============================================================================
// Web scraper ligero para extraer contenido de webs de clientes.
// Usa fetch nativo — sin Puppeteer ni dependencias externas.
// ============================================================================

const MAX_CONTENT_LENGTH = 8000; // caracteres
const FETCH_TIMEOUT_MS = 10_000; // 10 segundos

/**
 * Descarga una web y extrae su contenido textual.
 * Devuelve un string limpio o un mensaje de fallback si falla.
 */
export async function fetchWebsiteContent(url: string): Promise<string> {
  try {
    // Normalizar URL
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(normalizedUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SoltegraBot/1.0)",
        Accept: "text/html",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return `(No se pudo acceder a la web: HTTP ${response.status})`;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return "(La URL no devolvió contenido HTML legible.)";
    }

    const html = await response.text();
    const text = extractTextFromHtml(html);

    if (!text || text.length < 50) {
      return "(La web no tiene contenido textual suficiente para analizar.)";
    }

    return text.slice(0, MAX_CONTENT_LENGTH);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return "(La web tardó demasiado en responder.)";
    }
    return "(No se pudo obtener el contenido de la web.)";
  }
}

/**
 * Extrae texto limpio de HTML eliminando scripts, estilos y tags.
 */
function extractTextFromHtml(html: string): string {
  let text = html;

  // Eliminar scripts y estilos completos
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

  // Eliminar tags HTML preservando el contenido
  text = text.replace(/<[^>]+>/g, " ");

  // Decodificar entidades HTML comunes
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&euro;/g, "€");

  // Limpiar espacios múltiples y saltos de línea
  text = text.replace(/\s+/g, " ").trim();

  return text;
}
