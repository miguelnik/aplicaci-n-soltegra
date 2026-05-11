"use client";

import { useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { buildZodFromSchema } from "@/lib/form-schema/validate";
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

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-8">
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
