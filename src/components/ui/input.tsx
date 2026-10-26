import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const FIELD_CLASSES =
  "w-full min-h-10 border border-border-strong rounded-md px-3 py-2 text-sm bg-surface text-text-primary " +
  "placeholder:text-text-tertiary focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-1 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

interface FieldWrapperProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

function FieldWrapper({ label, htmlFor, hint, error, required, children }: FieldWrapperProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-text-primary">
        {label}
        {required ? (
          <span className="text-danger ml-0.5" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-text-tertiary">{hint}</p> : null}
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, hint, error, id, required, className, ...props }, ref) => {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    return (
      <FieldWrapper label={label} htmlFor={fieldId} hint={hint} error={error} required={required}>
        <input
          ref={ref}
          id={fieldId}
          required={required}
          aria-invalid={error ? true : undefined}
          className={cn(FIELD_CLASSES, error && "border-danger", className)}
          {...props}
        />
      </FieldWrapper>
    );
  }
);
TextField.displayName = "TextField";

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  error?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, hint, error, id, required, className, children, ...props }, ref) => {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    return (
      <FieldWrapper label={label} htmlFor={fieldId} hint={hint} error={error} required={required}>
        <select
          ref={ref}
          id={fieldId}
          required={required}
          className={cn(FIELD_CLASSES, "cursor-pointer", className)}
          {...props}
        >
          {children}
        </select>
      </FieldWrapper>
    );
  }
);
SelectField.displayName = "SelectField";

export interface CheckboxFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

export const CheckboxField = forwardRef<HTMLInputElement, CheckboxFieldProps>(
  ({ label, hint, id, className, ...props }, ref) => {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={fieldId} className="flex items-center gap-2.5 text-sm font-medium text-text-primary cursor-pointer">
          <input
            ref={ref}
            id={fieldId}
            type="checkbox"
            className={cn(
              "h-5 w-5 rounded border-border-strong text-accent cursor-pointer accent-[var(--accent)]",
              "focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2",
              className
            )}
            {...props}
          />
          {label}
        </label>
        {hint ? <p className="text-xs text-text-tertiary pl-7">{hint}</p> : null}
      </div>
    );
  }
);
CheckboxField.displayName = "CheckboxField";
