import { useCallback, useState } from "react";
import type * as React from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import {
  useCreateWidget,
  useDeleteWidget,
  useUpdateWidget
} from "../../Widgets.mutations";
import { useWidgets } from "../../Widgets.queries";
import { widgetFormSchema } from "../../Widgets.schemas";
import type { IWidget, IWidgetFormInput } from "../../Widgets.types";
import type {
  IWidgetRowProps,
  IWidgetRowView,
  IWidgetsPageView
} from "./WidgetsPage.types";

export function useWidgetsPage(): IWidgetsPageView {
  const query = useWidgets();
  const create = useCreateWidget();
  const update = useUpdateWidget();
  const remove = useDeleteWidget();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const form = useForm<IWidgetFormInput>({
    resolver: zodResolver(widgetFormSchema),
    defaultValues: { name: "" }
  });

  const onCreate = useCallback(
    async (input: IWidgetFormInput): Promise<void> => {
      await create.mutateAsync(input);
      form.reset({ name: "" });
    },
    [create, form]
  );

  const onCreateSubmit = useCallback(
    (event: React.BaseSyntheticEvent): void => {
      void form.handleSubmit(onCreate)(event);
    },
    [form, onCreate]
  );

  const onStartEdit = useCallback((widget: IWidget): void => {
    setEditingId(widget.id);
    setEditName(widget.name);
  }, []);

  const onCancelEdit = useCallback((): void => {
    setEditingId(null);
    setEditName("");
  }, []);

  const onSaveEdit = useCallback((): void => {
    if (editingId === null) {
      return;
    }

    const parsed = widgetFormSchema.safeParse({ name: editName });

    if (!parsed.success) {
      return;
    }

    update.mutate(
      { id: editingId, input: parsed.data },
      {
        onSuccess: () => {
          setEditingId(null);
          setEditName("");
        }
      }
    );
  }, [editName, editingId, update]);

  const onDelete = useCallback(
    (widget: IWidget): void => {
      remove.mutate({ id: widget.id });
    },
    [remove]
  );

  return {
    widgets: query.data ?? [],
    form,
    isLoading: query.isPending,
    isCreating: create.isPending,
    editingId,
    editName,
    isUpdating: update.isPending,
    isDeleting: remove.isPending,
    onCreateSubmit,
    onEditNameChange: setEditName,
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onDelete
  };
}

export function useWidgetRow({
  widget,
  onEditNameChange,
  onStartEdit,
  onDelete
}: IWidgetRowProps): IWidgetRowView {
  const onEditNameInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      onEditNameChange(event.target.value);
    },
    [onEditNameChange]
  );

  const onStartEditClick = useCallback((): void => {
    onStartEdit(widget);
  }, [onStartEdit, widget]);

  const onDeleteClick = useCallback((): void => {
    onDelete(widget);
  }, [onDelete, widget]);

  return {
    onEditNameInputChange,
    onStartEditClick,
    onDeleteClick
  };
}
