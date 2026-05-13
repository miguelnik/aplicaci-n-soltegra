"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { buildZodFromSchema, validateFileCount } from "@/lib/form-schema/validate";
import type { FormSchema, FormData } from "@/lib/form-schema/types";
import {
  FieldText,
  FieldTextarea,
  FieldNumber,
  FieldDate,
  FieldSelect,
  FieldCheckbox,
} from "./FieldComponents";
import type { Field } from "@/lib/form-schema/types";
import { Button } from "@/components/ui/button";
import { FileUploader } from "./FileUploader";

function renderField(field: Field) {
  switch (field.type) {
    case "text":
      return <FieldText key={field.key} field={field} />;
    case "textarea":
      return <FieldTextarea key={field.key} field={field} />;
    case "number":
      return <FieldNumber key={field.key} field={field} />;
    case "date":
      return <FieldDate key={field.key} field={field} />;
    case "select":
      return <FieldSelect key={field.key} field={field} />;
    case "checkbox":
      return <FieldCheckbox key={field.key} field={field} />;
  }
}

interface Props {
  schema: FormSchema;
  defaultValues?: FormData;
  requestId: string;
  organizationId: string;
  onSubmit?: (data: FormData) => Promise<void>;
  onSaveDraft?: (data: FormData) => Promise<void>;
  /** Called whenever a field value changes — receives current form values */
  onFieldChange?: (data: FormData) => void;
  /** Called before a file upload starts; return false to abort */
  onBeforeFileUpload?: () => Promise<boolean>;
  submitLabel?: string;
  disabled?: boolean;
}

export function FormRenderer({
  schema,
  defaultValues,
  requestId,
  organizationId,
  onSubmit = async () => {},
  onSaveDraft,
  onFieldChange,
  onBeforeFileUpload,
  submitLabel = "Enviar solicitud",
  disabled = false,
}: Props) {
  const zodSchema = buildZodFromSchema(schema);
  const fileBlocks = useMemo(
    () => schema.sections.flatMap((section) => section.files ?? []),
    [schema],
  );
  const [fileCounts, setFileCounts] = useState<Record<string, number>>({});
  const [fileErrors, setFileErrors] = useState<Record<string, string | null>>({});
  const methods = useForm({
    resolver: zodResolver(zodSchema),
    defaultValues: defaultValues ?? {},
  });

  // Notify parent whenever any field changes
  useEffect(() => {
    if (!onFieldChange) return;
    const subscription = methods.watch((values) => {
      onFieldChange(values as FormData);
    });
    return () => subscription.unsubscribe();
  }, [methods, onFieldChange]);

  const handleDraft = async () => {
    if (!onSaveDraft) return;
    const data = methods.getValues();
    await onSaveDraft(data);
  };

  const handleFileCountChange = (key: string, count: number) => {
    setFileCounts((prev) => ({ ...prev, [key]: count }));
    setFileErrors((prev) => ({ ...prev, [key]: null }));
  };

  const validateFilesBeforeSubmit = () => {
    const nextErrors: Record<string, string | null> = {};
    for (const fileBlock of fileBlocks) {
      const error = validateFileCount(fileCounts[fileBlock.key] ?? 0, fileBlock);
      if (error) nextErrors[fileBlock.key] = error;
    }

    setFileErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = methods.handleSubmit(async (data) => {
    if (!validateFilesBeforeSubmit()) return;
    await onSubmit(data as FormData);
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit} className="space-y-8">
        {schema.sections.map((section) => (
          <div key={section.id} className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{section.title}</h3>
              {section.description && (
                <p className="text-sm text-muted-foreground">{section.description}</p>
              )}
            </div>

            {section.fields && section.fields.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {section.fields.map((field) => (
                  <div
                    key={field.key}
                    className={
                      field.type === "textarea" || field.type === "checkbox"
                        ? "sm:col-span-2"
                        : ""
                    }
                  >
                    {renderField(field)}
                  </div>
                ))}
              </div>
            )}

            {section.files && section.files.length > 0 && (
              <div className="space-y-4">
                {section.files.map((fileBlock) => (
                  <FileUploader
                    key={fileBlock.key}
                    fileBlock={fileBlock}
                    requestId={requestId}
                    organizationId={organizationId}
                    disabled={disabled}
                    error={fileErrors[fileBlock.key]}
                    onFilesChange={handleFileCountChange}
                    onBeforeUpload={onBeforeFileUpload}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        {!disabled && (
          <div className="flex gap-3 border-t pt-4">
            {onSaveDraft && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDraft}
                disabled={methods.formState.isSubmitting}
              >
                Guardar borrador
              </Button>
            )}
            <Button type="submit" disabled={methods.formState.isSubmitting}>
              {methods.formState.isSubmitting ? "Enviando..." : submitLabel}
            </Button>
          </div>
        )}
      </form>
    </FormProvider>
  );
}
