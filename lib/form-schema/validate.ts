import { z, ZodTypeAny } from "zod";
import type { Field, FormSchema } from "./types";

// Convierte un Field del schema en una validación Zod.
function fieldToZod(field: Field): ZodTypeAny {
  switch (field.type) {
    case "text":
    case "textarea": {
      let s = z.string();
      if (field.maxLength) s = s.max(field.maxLength);
      return field.required ? s.min(1, "Campo obligatorio") : s.optional().or(z.literal(""));
    }
    case "number": {
      let s = z.coerce.number();
      if (field.min !== undefined) s = s.min(field.min);
      if (field.max !== undefined) s = s.max(field.max);
      return field.required ? s : s.optional().nullable();
    }
    case "date": {
      // ISO date YYYY-MM-DD
      const s = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");
      return field.required ? s : s.optional().or(z.literal(""));
    }
    case "select": {
      if (field.multiple) {
        const s = z.array(z.enum(field.options as [string, ...string[]]));
        return field.required ? s.min(1, "Selecciona al menos una opción") : s.optional();
      }
      const s = z.enum(field.options as [string, ...string[]]);
      return field.required ? s : s.optional().or(z.literal(""));
    }
    case "checkbox":
      return z.coerce.boolean().optional();
  }
}

/**
 * Genera un Zod schema completo (objeto plano keyed por field.key)
 * a partir de un FormSchema. Cubre solo los `fields`, no los archivos —
 * los archivos se validan aparte por el uploader (count + size + mime).
 */
export function buildZodFromSchema(schema: FormSchema) {
  const shape: Record<string, ZodTypeAny> = {};
  for (const section of schema.sections) {
    for (const field of section.fields ?? []) {
      shape[field.key] = fieldToZod(field);
    }
  }
  return z.object(shape);
}

/**
 * Validación del lado del archivo (cliente y servidor):
 * - mime type o extensión contra `accept`
 * - tamaño máximo
 *
 * Los patrones de accept pueden ser:
 *   "image/*"         - wildcard de categoria MIME
 *   "application/pdf" - MIME exacto
 *   ".dxf"            - extension (con punto)
 *   "*\/*" o "*"      - acepta cualquier tipo
 */
export function validateFile(
  file: { name: string; type: string; size: number },
  block: { accept: string[]; maxSizeMb?: number },
): string | null {
  // Comodín total: aceptar todo sin validar tipo
  if (block.accept.includes("*/*") || block.accept.includes("*")) {
    if (block.maxSizeMb && file.size > block.maxSizeMb * 1024 * 1024) {
      return `Archivo demasiado grande. Máximo ${block.maxSizeMb} MB`;
    }
    return null;
  }

  const fileExt = "." + (file.name.split(".").pop() ?? "").toLowerCase();

  const accepted = block.accept.some((pattern) => {
    // Extensión explícita: ".pdf", ".dxf", ".dwg" …
    if (pattern.startsWith(".")) {
      return fileExt === pattern.toLowerCase();
    }
    // Wildcard de categoría MIME: "image/*", "video/*" …
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -2);
      return file.type.startsWith(prefix + "/");
    }
    // MIME exacto: "application/pdf" …
    return file.type === pattern;
  });

  if (!accepted) {
    const humanList = block.accept.join(", ");
    return `Tipo de archivo no permitido. Formatos aceptados: ${humanList}`;
  }
  if (block.maxSizeMb && file.size > block.maxSizeMb * 1024 * 1024) {
    return `Archivo demasiado grande. Máximo ${block.maxSizeMb} MB`;
  }
  return null;
}

/**
 * Valida que un bloque de archivos cumpla con minCount/maxCount.
 */
export function validateFileCount(
  count: number,
  block: { required?: boolean; minCount?: number; maxCount?: number },
): string | null {
  if (block.required && count === 0) return "Debes subir al menos un archivo";
  if (block.minCount && count < block.minCount) return `Mínimo ${block.minCount} archivos`;
  if (block.maxCount && count > block.maxCount) return `Máximo ${block.maxCount} archivos`;
  return null;
}
