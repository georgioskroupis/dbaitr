// hooks/useFormEnterSubmit.ts
import { useCallback } from "react";
import type { UseFormHandleSubmit, FieldValues, SubmitHandler } from "react-hook-form";

export function useFormEnterSubmit<TFieldValues extends FieldValues>(
  handleSubmit: UseFormHandleSubmit<TFieldValues>,
  onValid: SubmitHandler<TFieldValues>
) {
  return useCallback(
    (e: React.KeyboardEvent<HTMLFormElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const activeElement = document.activeElement as HTMLElement | null;
        if (activeElement && typeof activeElement.blur === "function") {
          activeElement.blur();
        }
        requestAnimationFrame(() => {
          handleSubmit(onValid)();
        });
      }
    },
    [handleSubmit, onValid]
  );
}

export function focusById(id: string) {
  // Delay to ensure element is mounted
  setTimeout(() => {
    const el = document.getElementById(id) as HTMLElement | null;
    el?.focus?.();
  }, 0);
}

