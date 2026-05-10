// ============================================================================
// Form schema types — pieza central del producto.
// El JSONB de `form_schemas.schema` se ajusta a `FormSchema`.
// ============================================================================

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "select"
  | "checkbox";

export interface BaseField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  helpText?: string;
}

export interface TextField extends BaseField {
  type: "text";
  placeholder?: string;
  maxLength?: number;
}

export interface TextareaField extends BaseField {
  type: "textarea";
  placeholder?: string;
  maxLength?: number;
  rows?: number;
}

export interface NumberField extends BaseField {
  type: "number";
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export interface DateField extends BaseField {
  type: "date";
}

export interface SelectField extends BaseField {
  type: "select";
  options: string[];
  multiple?: boolean;
}

export interface CheckboxField extends BaseField {
  type: "checkbox";
}

export type Field =
  | TextField
  | TextareaField
  | NumberField
  | DateField
  | SelectField
  | CheckboxField;

export interface FileBlock {
  key: string;
  label: string;
  helpText?: string;
  accept: string[];                  // ej. ["image/*"] o ["application/pdf"]
  multiple?: boolean;
  required?: boolean;
  minCount?: number;
  maxCount?: number;
  maxSizeMb?: number;
}

export interface Section {
  id: string;
  title: string;
  description?: string;
  fields?: Field[];
  files?: FileBlock[];
}

export interface FormSchema {
  sections: Section[];
  /**
   * Key del campo cuyo valor se usa como nombre/título del proyecto en las
   * listas (admin y cliente). Solo un campo por schema. Si no se indica,
   * el proyecto se muestra solo con la referencia.
   */
  titleFieldKey?: string;
}

// ============================================================================
// Tipos del lado de la solicitud / respuestas
// ============================================================================

// `form_data` es un objeto plano keyed por `field.key`.
export type FormData = Record<string, FormFieldValue>;

export type FormFieldValue =
  | string
  | number
  | boolean
  | string[]
  | null
  | undefined;
