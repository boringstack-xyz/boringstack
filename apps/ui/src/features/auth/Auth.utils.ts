import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { ApiError } from "@/lib/api/ApiError";

export function applyServerErrors<TForm extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TForm>
): boolean {
  if (!(error instanceof ApiError) || !error.fieldErrors) {
    return false;
  }

  for (const [field, message] of Object.entries(error.fieldErrors)) {
    setError(field as Path<TForm>, { type: "server", message });
  }

  return true;
}
