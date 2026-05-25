import type * as React from "react";

import type { UseFormReturn } from "react-hook-form";

import type { IWidget, IWidgetFormInput } from "../../Widgets.types";

export interface IWidgetsPageView {
  readonly widgets: readonly IWidget[];
  readonly form: UseFormReturn<IWidgetFormInput>;
  readonly isLoading: boolean;
  readonly isCreating: boolean;
  readonly editingId: string | null;
  readonly editName: string;
  readonly isUpdating: boolean;
  readonly isDeleting: boolean;
  readonly onCreateSubmit: (event: React.BaseSyntheticEvent) => void;
  readonly onEditNameChange: (value: string) => void;
  readonly onStartEdit: (widget: IWidget) => void;
  readonly onCancelEdit: () => void;
  readonly onSaveEdit: () => void;
  readonly onDelete: (widget: IWidget) => void;
}

export interface IWidgetRowProps {
  readonly widget: IWidget;
  readonly isEditing: boolean;
  readonly editName: string;
  readonly isUpdating: boolean;
  readonly isDeleting: boolean;
  readonly onEditNameChange: (value: string) => void;
  readonly onStartEdit: (widget: IWidget) => void;
  readonly onCancelEdit: () => void;
  readonly onSaveEdit: () => void;
  readonly onDelete: (widget: IWidget) => void;
}

export interface IWidgetRowView {
  readonly onEditNameInputChange: (
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;
  readonly onStartEditClick: () => void;
  readonly onDeleteClick: () => void;
}
