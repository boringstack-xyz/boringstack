import type { FC } from "react";

import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Can } from "@/lib/acl/Can";

import { AppPage } from "@/components/core/AppPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useWidgetRow, useWidgetsPage } from "./WidgetsPage.hooks";
import type { IWidgetRowProps } from "./WidgetsPage.types";

const WidgetRow: FC<IWidgetRowProps> = ({
  widget,
  isEditing,
  editName,
  isUpdating,
  isDeleting,
  onEditNameChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete
}) => {
  const { t } = useTranslation();
  const { onEditNameInputChange, onStartEditClick, onDeleteClick } =
    useWidgetRow({
      widget,
      isEditing,
      editName,
      isUpdating,
      isDeleting,
      onEditNameChange,
      onStartEdit,
      onCancelEdit,
      onSaveEdit,
      onDelete
    });

  return (
    <tr className='border-border border-b last:border-0'>
      <td className='px-4 py-3'>
        {isEditing ? (
          <Input
            value={editName}
            onChange={onEditNameInputChange}
            aria-label={t("widgets.form.name")}
          />
        ) : (
          <span className='text-foreground text-sm font-medium'>
            {widget.name}
          </span>
        )}
      </td>
      <td className='text-muted-foreground px-4 py-3 text-xs'>
        {new Date(widget.createdAt).toLocaleDateString()}
      </td>
      <td className='px-4 py-3'>
        <div className='flex justify-end gap-2'>
          {isEditing ? (
            <>
              <Button
                type='button'
                size='sm'
                onClick={onSaveEdit}
                disabled={isUpdating}
              >
                <Save className='size-4' aria-hidden='true' />
                <span>{t("widgets.actions.save")}</span>
              </Button>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={onCancelEdit}
              >
                <X className='size-4' aria-hidden='true' />
                <span>{t("widgets.actions.cancel")}</span>
              </Button>
            </>
          ) : (
            <>
              <Can I='update' a='Widget'>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={onStartEditClick}
                >
                  <Pencil className='size-4' aria-hidden='true' />
                  <span>{t("widgets.actions.edit")}</span>
                </Button>
              </Can>
              <Can I='delete' a='Widget'>
                <Button
                  type='button'
                  variant='destructive'
                  size='sm'
                  onClick={onDeleteClick}
                  disabled={isDeleting}
                >
                  <Trash2 className='size-4' aria-hidden='true' />
                  <span>{t("widgets.actions.delete")}</span>
                </Button>
              </Can>
            </>
          )}
        </div>
      </td>
    </tr>
  );
};

WidgetRow.displayName = "WidgetRow";

const WidgetsPage: FC = () => {
  const { t } = useTranslation();
  const {
    widgets,
    form,
    isLoading,
    isCreating,
    editingId,
    editName,
    isUpdating,
    isDeleting,
    onCreateSubmit,
    onEditNameChange,
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onDelete
  } = useWidgetsPage();

  const renderedRows = widgets.map((widget) => (
    <WidgetRow
      key={widget.id}
      widget={widget}
      isEditing={editingId === widget.id}
      editName={editName}
      isUpdating={isUpdating}
      isDeleting={isDeleting}
      onEditNameChange={onEditNameChange}
      onStartEdit={onStartEdit}
      onCancelEdit={onCancelEdit}
      onSaveEdit={onSaveEdit}
      onDelete={onDelete}
    />
  ));

  return (
    <AppPage
      pageTitle={t("widgets.title")}
      title={t("widgets.title")}
      subtitle={t("widgets.subtitle")}
    >
      <Can I='create' a='Widget'>
        <article className='border-border bg-background rounded-2xl border p-6'>
          <form
            onSubmit={onCreateSubmit}
            className='grid gap-4 md:grid-cols-[1fr_auto] md:items-end'
            noValidate
          >
            <div className='flex flex-col gap-2'>
              <Label htmlFor='widget-name'>{t("widgets.form.name")}</Label>
              <Input
                id='widget-name'
                aria-invalid={Boolean(form.formState.errors.name)}
                {...form.register("name")}
              />
              {form.formState.errors.name ? (
                <p className='text-destructive text-xs' role='alert'>
                  {form.formState.errors.name.message}
                </p>
              ) : null}
            </div>
            <Button type='submit' disabled={isCreating}>
              <Plus className='size-4' aria-hidden='true' />
              <span>
                {isCreating
                  ? t("widgets.form.submitting")
                  : t("widgets.form.submit")}
              </span>
            </Button>
          </form>
        </article>
      </Can>

      <article className='border-border bg-background overflow-hidden rounded-2xl border'>
        {isLoading ? (
          <p className='text-muted-foreground p-6 text-sm' role='status'>
            {t("common.loading")}
          </p>
        ) : null}

        {!isLoading && widgets.length === 0 ? (
          <p className='text-muted-foreground p-6 text-sm'>
            {t("widgets.empty")}
          </p>
        ) : null}

        {widgets.length > 0 ? (
          <div className='overflow-x-auto'>
            <table className='w-full text-left'>
              <thead className='text-muted-foreground border-border border-b text-xs tracking-[0.18em] uppercase'>
                <tr>
                  <th className='px-4 py-3 font-medium'>
                    {t("widgets.columns.name")}
                  </th>
                  <th className='px-4 py-3 font-medium'>
                    {t("widgets.columns.created")}
                  </th>
                  <th className='px-4 py-3 text-right font-medium'>
                    {t("widgets.columns.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>{renderedRows}</tbody>
            </table>
          </div>
        ) : null}
      </article>
    </AppPage>
  );
};

WidgetsPage.displayName = "WidgetsPage";

export default WidgetsPage;
export { WidgetsPage };
