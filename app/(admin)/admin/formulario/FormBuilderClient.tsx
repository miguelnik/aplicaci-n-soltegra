"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { FormSchema, Section, Field, FileBlock, FieldType } from "@/lib/form-schema/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, GripVertical, ChevronDown, ChevronUp, Save } from "lucide-react";
import { saveFormSchema } from "./actions";

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Texto" },
  { value: "textarea", label: "Texto largo" },
  { value: "number", label: "Número" },
  { value: "date", label: "Fecha" },
  { value: "select", label: "Desplegable" },
  { value: "checkbox", label: "Casilla" },
];

/**
 * Presets de tipo de archivo para los bloques de upload.
 * El admin elige uno y el sistema configura el array `accept` automáticamente.
 */
const FILE_PRESETS: {
  value: string;
  label: string;
  accept: string[];
  hint: string;
}[] = [
  {
    value: "images",
    label: "Imágenes",
    accept: ["image/*"],
    hint: "JPG, PNG, WEBP, GIF…",
  },
  {
    value: "pdf",
    label: "PDF",
    accept: ["application/pdf"],
    hint: "Solo archivos PDF",
  },
  {
    value: "generic",
    label: "Archivo genérico",
    accept: [
      "image/*",
      "application/pdf",
      ".dwg",
      ".dxf",
      ".doc",
      ".docx",
      ".xls",
      ".xlsx",
      ".zip",
      ".rar",
    ],
    hint: "PDF, imágenes, DWG, DXF, Office, ZIP…",
  },
  {
    value: "office",
    label: "Documentos Office",
    accept: [
      "application/pdf",
      ".doc",
      ".docx",
      ".xls",
      ".xlsx",
      ".ppt",
      ".pptx",
    ],
    hint: "PDF, Word, Excel, PowerPoint",
  },
  {
    value: "cad",
    label: "Planos CAD",
    accept: ["application/pdf", ".dwg", ".dxf"],
    hint: "PDF, DWG, DXF",
  },
  {
    value: "any",
    label: "Cualquier tipo",
    accept: ["*/*"],
    hint: "Acepta cualquier archivo",
  },
];

/** Dado un array accept, devuelve el preset que coincide (o "custom") */
function detectPreset(accept: string[]): string {
  const sorted = [...accept].sort().join(",");
  for (const p of FILE_PRESETS) {
    if ([...p.accept].sort().join(",") === sorted) return p.value;
  }
  return "custom";
}

interface Props {
  currentSchema: FormSchema;
  currentVersion: number;
  serviceTypeId: string;
}

export function FormBuilderClient({ currentSchema, currentVersion, serviceTypeId }: Props) {
  const [schema, setSchema] = useState<FormSchema>(currentSchema);
  const [saving, setSaving] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(currentSchema.sections.map((s) => s.id)),
  );

  const toggleSection = (id: string) =>
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const updateSection = (idx: number, patch: Partial<Section>) =>
    setSchema((s) => ({
      sections: s.sections.map((sec, i) => (i === idx ? { ...sec, ...patch } : sec)),
    }));

  const addSection = () =>
    setSchema((s) => ({
      sections: [
        ...s.sections,
        { id: `seccion_${Date.now()}`, title: "Nueva sección", fields: [] },
      ],
    }));

  const removeSection = (idx: number) =>
    setSchema((s) => ({ sections: s.sections.filter((_, i) => i !== idx) }));

  const addField = (sectionIdx: number) =>
    updateSection(sectionIdx, {
      fields: [
        ...(schema.sections[sectionIdx].fields ?? []),
        { key: `campo_${Date.now()}`, label: "Nuevo campo", type: "text" },
      ],
    });

  const updateField = (sectionIdx: number, fieldIdx: number, patch: Partial<Field>) =>
    updateSection(sectionIdx, {
      fields: (schema.sections[sectionIdx].fields ?? []).map((f, i) =>
        i === fieldIdx ? ({ ...f, ...patch } as Field) : f,
      ),
    });

  const removeField = (sectionIdx: number, fieldIdx: number) => {
    const removedKey = schema.sections[sectionIdx].fields?.[fieldIdx]?.key;
    updateSection(sectionIdx, {
      fields: (schema.sections[sectionIdx].fields ?? []).filter((_, i) => i !== fieldIdx),
    });
    // Si el campo borrado era el título, limpiarlo
    if (removedKey && schema.titleFieldKey === removedKey) {
      setSchema((prev) => ({ ...prev, titleFieldKey: undefined }));
    }
  };

  const addFileBlock = (sectionIdx: number) =>
    updateSection(sectionIdx, {
      files: [
        ...(schema.sections[sectionIdx].files ?? []),
        {
          key: `archivo_${Date.now()}`,
          label: "Nuevo archivo",
          // Preset por defecto: "Archivo genérico" (PDF, imágenes, CAD, Office…)
          accept: FILE_PRESETS.find((p) => p.value === "generic")!.accept,
          required: false,
          multiple: false,
          maxSizeMb: 20,
        },
      ],
    });

  const updateFileBlock = (sectionIdx: number, fileIdx: number, patch: Partial<FileBlock>) =>
    updateSection(sectionIdx, {
      files: (schema.sections[sectionIdx].files ?? []).map((f, i) =>
        i === fileIdx ? { ...f, ...patch } : f,
      ),
    });

  const removeFileBlock = (sectionIdx: number, fileIdx: number) =>
    updateSection(sectionIdx, {
      files: (schema.sections[sectionIdx].files ?? []).filter((_, i) => i !== fileIdx),
    });

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await saveFormSchema(schema, serviceTypeId);
      if (!result.ok) {
        toast.error(`Error: ${result.error}`);
        return;
      }
      toast.success(`Formulario guardado como versión ${currentVersion + 1}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  // Campos disponibles para usar como título del proyecto.
  // Excluimos checkbox y select (no aportan un nombre legible).
  const titleCandidates = schema.sections.flatMap((s) =>
    (s.fields ?? [])
      .filter((f) => f.type === "text" || f.type === "textarea" || f.type === "number" || f.type === "date")
      .map((f) => ({ key: f.key, label: f.label, sectionTitle: s.title })),
  );

  const setTitleFieldKey = (key: string) =>
    setSchema((prev) => ({ ...prev, titleFieldKey: key || undefined }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="secondary">Versión actual: {currentVersion}</Badge>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? "Guardando..." : "Publicar nueva versión"}
        </Button>
      </div>

      {/* Selector del campo que da nombre al proyecto */}
      <Card>
        <CardContent className="space-y-2 pt-4">
          <Label className="text-sm font-medium">Campo que da nombre al proyecto</Label>
          <p className="text-xs text-muted-foreground">
            Cuando el cliente cree una solicitud, el valor de este campo se mostrará como
            título del proyecto en las listas (admin y cliente). Solo se puede elegir uno.
          </p>
          <select
            value={schema.titleFieldKey ?? ""}
            onChange={(e) => setTitleFieldKey(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            disabled={titleCandidates.length === 0}
          >
            <option value="">— Sin campo título —</option>
            {titleCandidates.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label} ({c.sectionTitle})
              </option>
            ))}
          </select>
          {titleCandidates.length === 0 && (
            <p className="text-xs text-amber-600">
              Añade al menos un campo de texto, número o fecha para poder elegir uno como título.
            </p>
          )}
        </CardContent>
      </Card>

      {schema.sections.map((section, sIdx) => (
        <Card key={section.id}>
          <CardHeader className="cursor-pointer pb-3" onClick={() => toggleSection(section.id)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={section.title}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateSection(sIdx, { title: e.target.value })}
                  className="h-7 border-0 p-0 text-base font-semibold shadow-none focus-visible:ring-0"
                />
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSection(sIdx);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                {openSections.has(section.id) ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </div>
          </CardHeader>

          {openSections.has(section.id) && (
            <CardContent className="space-y-4">
              {/* Campos */}
              {(section.fields ?? []).map((field, fIdx) => (
                <div
                  key={field.key}
                  className="grid gap-3 rounded-md border bg-muted/20 p-3 sm:grid-cols-3"
                >
                  <div className="space-y-1">
                    <Label className="text-xs">Etiqueta</Label>
                    <Input
                      value={field.label}
                      onChange={(e) => updateField(sIdx, fIdx, { label: e.target.value })}
                      placeholder="Nombre del campo"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Clave (key)</Label>
                    <Input
                      value={field.key}
                      onChange={(e) => updateField(sIdx, fIdx, { key: e.target.value })}
                      placeholder="clave_unica"
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Tipo</Label>
                      <select
                        value={field.type}
                        onChange={(e) =>
                          updateField(sIdx, fIdx, { type: e.target.value as FieldType })
                        }
                        className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                      >
                        {FIELD_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2 pb-1">
                      <input
                        type="checkbox"
                        id={`req_${field.key}`}
                        checked={field.required ?? false}
                        onChange={(e) => updateField(sIdx, fIdx, { required: e.target.checked })}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      <Label htmlFor={`req_${field.key}`} className="cursor-pointer text-xs">
                        Obligatorio
                      </Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeField(sIdx, fIdx)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                  {field.type === "select" && (
                    <div className="space-y-1 sm:col-span-3">
                      <Label className="text-xs">Opciones (una por línea)</Label>
                      <textarea
                        value={(field.options ?? []).join("\n")}
                        onChange={(e) =>
                          updateField(sIdx, fIdx, {
                            options: e.target.value.split("\n").filter(Boolean),
                          })
                        }
                        rows={3}
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        placeholder={"Opción 1\nOpción 2\nOpción 3"}
                      />
                    </div>
                  )}
                </div>
              ))}

              {/* Bloques de archivos */}
              {(section.files ?? []).map((fb, fbIdx) => {
                const currentPreset = detectPreset(fb.accept ?? []);
                const presetHint =
                  FILE_PRESETS.find((p) => p.value === currentPreset)?.hint ?? "";

                return (
                  <div
                    key={fb.key}
                    className="space-y-3 rounded-md border border-dashed bg-blue-50/30 p-3"
                  >
                    {/* Fila 1: etiqueta + clave + eliminar */}
                    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                      <div className="space-y-1">
                        <Label className="text-xs">Etiqueta del campo</Label>
                        <Input
                          value={fb.label}
                          onChange={(e) =>
                            updateFileBlock(sIdx, fbIdx, { label: e.target.value })
                          }
                          className="h-8 text-sm"
                          placeholder="Ej: Planos de planta"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Clave (key)</Label>
                        <Input
                          value={fb.key}
                          onChange={(e) =>
                            updateFileBlock(sIdx, fbIdx, { key: e.target.value })
                          }
                          className="h-8 font-mono text-xs"
                        />
                      </div>
                      <div className="flex items-end pb-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeFileBlock(sIdx, fbIdx)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>

                    {/* Fila 2: tipo de archivo + opciones */}
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
                      {/* Selector de tipo de archivo */}
                      <div className="space-y-1">
                        <Label className="text-xs">Tipo de archivo</Label>
                        <select
                          value={currentPreset}
                          onChange={(e) => {
                            const preset = FILE_PRESETS.find(
                              (p) => p.value === e.target.value,
                            );
                            if (preset) {
                              updateFileBlock(sIdx, fbIdx, { accept: preset.accept });
                            }
                          }}
                          className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {FILE_PRESETS.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                          {currentPreset === "custom" && (
                            <option value="custom">Personalizado</option>
                          )}
                        </select>
                        {presetHint && (
                          <p className="text-[10px] text-muted-foreground">{presetHint}</p>
                        )}
                      </div>

                      {/* Máx. MB */}
                      <div className="space-y-1">
                        <Label className="text-xs">Máx. MB</Label>
                        <Input
                          type="number"
                          value={fb.maxSizeMb ?? 10}
                          onChange={(e) =>
                            updateFileBlock(sIdx, fbIdx, {
                              maxSizeMb: Number(e.target.value),
                            })
                          }
                          className="h-8 w-20 text-sm"
                          min={1}
                          max={500}
                        />
                      </div>

                      {/* Obligatorio */}
                      <div className="flex flex-col items-center justify-end gap-1 pb-1">
                        <Label className="text-[10px] text-muted-foreground">Obligatorio</Label>
                        <input
                          type="checkbox"
                          checked={fb.required ?? false}
                          onChange={(e) =>
                            updateFileBlock(sIdx, fbIdx, { required: e.target.checked })
                          }
                          className="h-4 w-4 accent-primary"
                        />
                      </div>

                      {/* Múltiple */}
                      <div className="flex flex-col items-center justify-end gap-1 pb-1">
                        <Label className="text-[10px] text-muted-foreground">Múltiple</Label>
                        <input
                          type="checkbox"
                          checked={fb.multiple ?? false}
                          onChange={(e) =>
                            updateFileBlock(sIdx, fbIdx, { multiple: e.target.checked })
                          }
                          className="h-4 w-4 accent-primary"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addField(sIdx)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Añadir campo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addFileBlock(sIdx)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Añadir archivo
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      ))}

      <Button type="button" variant="outline" onClick={addSection}>
        <Plus className="h-4 w-4" />
        Añadir sección
      </Button>
    </div>
  );
}
