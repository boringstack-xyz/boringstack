import type { BaseSyntheticEvent, ChangeEvent } from "react";
import { useCallback } from "react";

import type { IMfaChallengeFormProps } from "./MfaChallengeForm.types";

interface IMfaChallengeFormView {
  readonly handleSubmit: (event: BaseSyntheticEvent) => void;
  readonly handleChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function useMfaChallengeForm(
  props: Pick<IMfaChallengeFormProps, "onSubmit" | "onCodeChange">
): IMfaChallengeFormView {
  const { onSubmit, onCodeChange } = props;

  const handleSubmit = useCallback(
    (event: BaseSyntheticEvent): void => {
      event.preventDefault();
      onSubmit();
    },
    [onSubmit]
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      onCodeChange(event.target.value);
    },
    [onCodeChange]
  );

  return { handleSubmit, handleChange };
}
