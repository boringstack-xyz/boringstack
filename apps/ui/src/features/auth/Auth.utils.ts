import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { ApiError } from "@/lib/api/ApiError";

export function applyServerErrors<TForm extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TForm>,
  fields: readonly Path<TForm>[]
): boolean {
  if (!(error instanceof ApiError) || !error.fieldErrors) {
    return false;
  }

  for (const [field, message] of Object.entries(error.fieldErrors)) {
    /*
     * Match the server key against the form's own path list. `find` yields a
     * real `Path<TForm>` element (or nothing), so setError stays type-sound
     * with no assertion — Path<TForm> has no runtime witness to cast to.
     * Server keys that aren't form fields are ignored.
     */
    const path = fields.find((candidate) => candidate === field);

    if (path !== undefined) {
      setError(path, { type: "server", message });
    }
  }

  return true;
}
