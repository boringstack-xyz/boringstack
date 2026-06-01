import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useMfaChallengeForm } from "./MfaChallengeForm.hooks";

describe("useMfaChallengeForm", () => {
  it("calls onSubmit and prevents the default form behaviour", () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useMfaChallengeForm({ onSubmit, onCodeChange: vi.fn() })
    );

    const preventDefault = vi.fn();

    result.current.handleSubmit({
      preventDefault
    } as unknown as React.BaseSyntheticEvent);

    expect(preventDefault).toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("forwards the input value to onCodeChange", () => {
    const onCodeChange = vi.fn();
    const { result } = renderHook(() =>
      useMfaChallengeForm({ onSubmit: vi.fn(), onCodeChange })
    );

    result.current.handleChange({
      target: { value: "123456" }
    } as unknown as React.ChangeEvent<HTMLInputElement>);

    expect(onCodeChange).toHaveBeenCalledWith("123456");
  });
});
