"use client";

import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type {
  TextField,
  TextareaField,
  NumberField,
  DateField,
  SelectField,
  CheckboxField,
} from "@/lib/form-schema/types";

function FieldWrapper({
  fieldKey,
  label,
  required,
  helpText,
  children,
}: {
  fieldKey: string;
  label: string;
  required?: boolean;
  helpText?: string;
  children: React.ReactNode;
}) {
  const { formState } = useFormContext();
  const error = formState.errors[fieldKey];

  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldKey}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
      {error && <p className="text-xs text-destructive">{String(error.message)}</p>}
    </div>
  );
}

export function FieldText({ field }: { field: TextField }) {
  const { register } = useFormContext();
  return (
    <FieldWrapper fieldKey={field.key} label={field.label} required={field.required} helpText={field.helpText}>
      <Input
        id={field.key}
        placeholder={field.placeholder}
        maxLength={field.maxLength}
        {...register(field.key)}
      />
    </FieldWrapper>
  );
}

export function FieldTextarea({ field }: { field: TextareaField }) {
  const { register } = useFormContext();
  return (
    <FieldWrapper fieldKey={field.key} label={field.label} required={field.required} helpText={field.helpText}>
      <Textarea
        id={field.key}
        placeholder={field.placeholder}
        maxLength={field.maxLength}
        rows={field.rows ?? 3}
        {...register(field.key)}
      />
    </FieldWrapper>
  );
}

export function FieldNumber({ field }: { field: NumberField }) {
  const { register } = useFormContext();
  return (
    <FieldWrapper fieldKey={field.key} label={field.label} required={field.required} helpText={field.helpText}>
      <div className="relative">
        <Input
          id={field.key}
          type="number"
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          className={field.unit ? "pr-12" : ""}
          {...register(field.key)}
        />
        {field.unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {field.unit}
          </span>
        )}
      </div>
    </FieldWrapper>
  );
}

export function FieldDate({ field }: { field: DateField }) {
  const { register } = useFormContext();
  return (
    <FieldWrapper fieldKey={field.key} label={field.label} required={field.required} helpText={field.helpText}>
      <Input id={field.key} type="date" {...register(field.key)} />
    </FieldWrapper>
  );
}

export function FieldSelect({ field }: { field: SelectField }) {
  const { register, formState } = useFormContext();
  const error = formState.errors[field.key];
  return (
    <FieldWrapper fieldKey={field.key} label={field.label} required={field.required} helpText={field.helpText}>
      <select
        id={field.key}
        multiple={field.multiple}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          field.multiple && "h-auto min-h-[80px]",
          error && "border-destructive",
        )}
        {...register(field.key)}
      >
        {!field.required && !field.multiple && <option value="">Selecciona...</option>}
        {field.options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
}

export function FieldCheckbox({ field }: { field: CheckboxField }) {
  const { register } = useFormContext();
  return (
    <div className="flex items-center gap-2">
      <input
        id={field.key}
        type="checkbox"
        className="h-4 w-4 rounded border-input accent-primary"
        {...register(field.key)}
      />
      <Label htmlFor={field.key} className="cursor-pointer font-normal">
        {field.label}
      </Label>
    </div>
  );
}
