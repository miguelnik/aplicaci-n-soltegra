"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { FormSchema, Section, Field, FileBlock, FieldType } from "@/lib/form-schema/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface Props {
  currentSchema: FormSchema;
  currentVersion: number;
}

export function FormBuilderClient({ currentSchema, currentVersion }: Props) {
  const [schema, setSchema] = useState<FormSchema>(currentSchema);
  const [saving, setSaving] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(currentSchema.sections.map((s) => s.id)),
  );

  const toggleSection = (id: string) =>
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
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

  const removeField = (sectionIdx: number, fieldIdx: number) =>
    updateSection(sectionIdx, {
      fields: (schema.sections[sectionIdx].fields ?? []).filter((_, i) => i !== fieldIdx),
    });

  const addFileBlock = (sectionIdx: number) =>
    updateSection(sectionIdx, {
      files: [
        ...(schema.sections[sectionIdx].files ?? []),
        {
          key: `archivo_${Date.now()}`,
          label: "Nuevo archivo",
          accept: ["image/*"],
          required: false,
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
      await saveFormSchema(schema);
      toast.success(`Schema guardado como versión ${currentVersion + 1}`);
    } catch {
      toast.error("Error al guardar el schema");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="secondary">Versión actual: {currentVersion}</Badge>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? "Guardando..." : "Publicar nueva versión"}
        </Button>
      </div>

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
              {(section.files ?? []).map((fb, fbIdx) => (
                <div
                  key={fb.key}
                  className="grid gap-3 rounded-md border border-dashed bg-blue-50/30 p-3 sm:grid-cols-3"
                >
                  <div className="space-y-1">
                    <Label className="text-xs">Etiqueta archivo</Label>
                    <Input
                      value={fb.label}
                      onChange={(e) => updateFileBlock(sIdx, fbIdx, { label: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Clave (key)</Label>
                    <Input
                      value={fb.key}
                      onChange={(e) => updateFileBlock(sIdx, fbIdx, { key: e.target.value })}
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Máx. MB</Label>
                      <Input
                        type="number"
                        value={fb.maxSizeMb ?? 10}
                        onChange={(e) =>
                          updateFileBlock(sIdx, fbIdx, { maxSizeMb: Number(e.target.value) })
                        }
                        className="h-8 w-20 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2 pb-1">
                      <input
                        type="checkbox"
                        checked={fb.required ?? false}
                        onChange={(e) =>
                          updateFileBlock(sIdx, fbIdx, { required: e.target.checked })
                        }
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      <Label className="cursor-pointer text-xs">Obligatorio</Label>
                      <input
                        type="checkbox"
                        checked={fb.multiple ?? false}
                        onChange={(e) =>
                          updateFileBlock(sIdx, fbIdx, { multiple: e.target.checked })
                        }
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      <Label className="cursor-pointer text-xs">Múltiple</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeFileBlock(sIdx, fbIdx)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

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
