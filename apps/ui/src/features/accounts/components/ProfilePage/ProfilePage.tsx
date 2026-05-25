import type { FC } from "react";

import { cn } from "@/lib/classnames";

import { AppPage } from "@/components/core/AppPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useProfilePage } from "./ProfilePage.hooks";
import type { IProfilePageProps } from "./ProfilePage.types";

const ProfilePage: FC<IProfilePageProps> = () => {
  const view = useProfilePage();

  return (
    <AppPage
      pageTitle={view.pageTitle}
      title={view.pageTitle}
      subtitle={view.pageSubtitle}
    >
      <article className='border-border bg-background flex items-center gap-5 rounded-2xl border p-6'>
        <span
          aria-hidden='true'
          className='bg-primary text-primary-foreground flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold tracking-tight'
        >
          {view.initials}
        </span>
        <div className='flex flex-col gap-1'>
          <h2 className='text-foreground text-lg font-semibold tracking-tight'>
            {view.avatarLabel}
          </h2>
          <p className='text-muted-foreground text-sm'>
            {view.avatarPlaceholder}
          </p>
        </div>
      </article>

      <form
        onSubmit={view.submit}
        noValidate
        className='border-border bg-background flex flex-col gap-5 rounded-2xl border p-6'
        aria-labelledby='profile-form-title'
      >
        <h2 id='profile-form-title' className='sr-only'>
          {view.pageTitle}
        </h2>

        <div className='grid gap-4 md:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='profile-first-name'>{view.firstNameLabel}</Label>
            <Input
              id='profile-first-name'
              type='text'
              autoComplete='given-name'
              aria-invalid={view.errors.firstName ? "true" : "false"}
              aria-describedby={
                view.errors.firstName ? "profile-first-name-error" : undefined
              }
              className={cn(view.errors.firstName && "border-destructive")}
              {...view.register("firstName")}
            />
            {view.errors.firstName ? (
              <p
                id='profile-first-name-error'
                role='alert'
                className='text-destructive text-xs'
              >
                {view.errors.firstName.message}
              </p>
            ) : null}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='profile-last-name'>{view.lastNameLabel}</Label>
            <Input
              id='profile-last-name'
              type='text'
              autoComplete='family-name'
              aria-invalid={view.errors.lastName ? "true" : "false"}
              aria-describedby={
                view.errors.lastName ? "profile-last-name-error" : undefined
              }
              className={cn(view.errors.lastName && "border-destructive")}
              {...view.register("lastName")}
            />
            {view.errors.lastName ? (
              <p
                id='profile-last-name-error'
                role='alert'
                className='text-destructive text-xs'
              >
                {view.errors.lastName.message}
              </p>
            ) : null}
          </div>
        </div>

        <div className='space-y-2'>
          <Label htmlFor='profile-email'>{view.emailLabel}</Label>
          <Input
            id='profile-email'
            type='email'
            value={view.email}
            readOnly
            aria-readonly='true'
            className='bg-muted/30 font-mono'
          />
          <p className='text-muted-foreground text-xs'>{view.emailHint}</p>
        </div>

        <Button
          type='submit'
          size='lg'
          disabled={view.isSubmitting}
          className='w-fit'
        >
          {view.isSubmitting ? view.savingLabel : view.saveLabel}
        </Button>
      </form>
    </AppPage>
  );
};

ProfilePage.displayName = "ProfilePage";

export default ProfilePage;
export { ProfilePage };
