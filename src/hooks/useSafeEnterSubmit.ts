// hooks/useSafeEnterSubmit.ts
import { useCallback } from "react";
import type { UseFormHandleSubmit, FieldValues, SubmitHandler } from "react-hook-form";

export function useSafeEnterSubmit<TFieldValues extends FieldValues>(
  handleSubmit: UseFormHandleSubmit<TFieldValues>,
  onValid: SubmitHandler<TFieldValues>
) {
  return useCallback(
    (e: React.KeyboardEvent<HTMLFormElement>) => {
      if (e.key === "Enter") {
        e.preventDefault(); // Avoid premature native submission
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement && typeof activeElement.blur === 'function') {
          activeElement.blur(); // Force value sync
        }
        // Use requestAnimationFrame to ensure blur has processed and RHF state has updated
        requestAnimationFrame(() => {
          handleSubmit(onValid)(); // Trigger RHF's submit handler
        });
      }
    },
    [handleSubmit, onValid]
  );
}
