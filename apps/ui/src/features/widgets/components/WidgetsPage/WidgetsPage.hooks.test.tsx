import type * as React from "react";

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useWidgetRow, useWidgetsPage } from "./WidgetsPage.hooks";

const widgetsQueryMock = vi.hoisted(() => vi.fn());
const createMutationMock = vi.hoisted(() => vi.fn());
const updateMutationMock = vi.hoisted(() => vi.fn());
const deleteMutationMock = vi.hoisted(() => vi.fn());

vi.mock("../../Widgets.queries", () => ({
  useWidgets: widgetsQueryMock
}));

vi.mock("../../Widgets.mutations", () => ({
  useCreateWidget: createMutationMock,
  useUpdateWidget: updateMutationMock,
  useDeleteWidget: deleteMutationMock
}));

const widget = {
  id: "widget-1",
  accountId: "account-1",
  name: "Launch checklist",
  createdAt: "2026-05-24T00:00:00.000Z",
  updatedAt: "2026-05-24T00:00:00.000Z"
};

const createMutateAsync = vi.fn();
const updateMutate = vi.fn();
const deleteMutate = vi.fn();

beforeEach(() => {
  widgetsQueryMock.mockReset();
  createMutationMock.mockReset();
  updateMutationMock.mockReset();
  deleteMutationMock.mockReset();
  createMutateAsync.mockReset();
  updateMutate.mockReset();
  deleteMutate.mockReset();

  widgetsQueryMock.mockReturnValue({
    data: [widget],
    isPending: false
  });
  createMutationMock.mockReturnValue({
    mutateAsync: createMutateAsync,
    isPending: false
  });
  updateMutationMock.mockReturnValue({
    mutate: updateMutate,
    isPending: false
  });
  deleteMutationMock.mockReturnValue({
    mutate: deleteMutate,
    isPending: false
  });
});

describe("useWidgetsPage", () => {
  it("exposes widgets and editing actions", () => {
    const { result } = renderHook(() => useWidgetsPage());

    expect(result.current.widgets).toEqual([widget]);

    act(() => {
      result.current.onStartEdit(widget);
    });

    expect(result.current.editingId).toBe("widget-1");
    expect(result.current.editName).toBe("Launch checklist");

    act(() => {
      result.current.onCancelEdit();
    });

    expect(result.current.editingId).toBeNull();
    expect(result.current.editName).toBe("");
  });

  it("saves valid edits and deletes by widget id", () => {
    const { result } = renderHook(() => useWidgetsPage());

    act(() => {
      result.current.onStartEdit(widget);
    });

    act(() => {
      result.current.onEditNameChange("Renamed");
    });

    act(() => {
      result.current.onSaveEdit();
      result.current.onDelete(widget);
    });

    expect(updateMutate).toHaveBeenCalledWith(
      { id: "widget-1", input: { name: "Renamed" } },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
    expect(deleteMutate).toHaveBeenCalledWith({ id: "widget-1" });
  });
});

describe("useWidgetRow", () => {
  it("adapts row events to widget callbacks", () => {
    const onEditNameChange = vi.fn();
    const onStartEdit = vi.fn();
    const onDelete = vi.fn();
    const input = document.createElement("input");
    const event: React.ChangeEvent<HTMLInputElement> = {
      bubbles: true,
      cancelable: true,
      currentTarget: input,
      defaultPrevented: false,
      eventPhase: 0,
      isDefaultPrevented: () => false,
      isPropagationStopped: () => false,
      isTrusted: false,
      nativeEvent: new Event("change"),
      persist: vi.fn(),
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      target: input,
      timeStamp: Date.now(),
      type: "change"
    };

    input.value = "Renamed";

    const { result } = renderHook(() =>
      useWidgetRow({
        widget,
        isEditing: false,
        editName: "",
        isUpdating: false,
        isDeleting: false,
        onEditNameChange,
        onStartEdit,
        onCancelEdit: vi.fn(),
        onSaveEdit: vi.fn(),
        onDelete
      })
    );

    act(() => {
      result.current.onEditNameInputChange(event);
      result.current.onStartEditClick();
      result.current.onDeleteClick();
    });

    expect(onEditNameChange).toHaveBeenCalledWith("Renamed");
    expect(onStartEdit).toHaveBeenCalledWith(widget);
    expect(onDelete).toHaveBeenCalledWith(widget);
  });
});
