import {
  Component,
  type ErrorInfo,
  type PropsWithChildren,
  type ReactNode
} from "react";

import * as Sentry from "@sentry/react";

import { i18n } from "@/lib/i18n/config";
import { logger } from "@/lib/logger/logger";

interface IErrorBoundaryState {
  readonly hasError: boolean;
}

export class ErrorBoundaryProvider extends Component<
  PropsWithChildren,
  IErrorBoundaryState
> {
  public override state: IErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): IErrorBoundaryState {
    return { hasError: true };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error({
      event: "ui.error_boundary",
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack
    });

    Sentry.captureException(error, {
      contexts: {
        react: { componentStack: info.componentStack ?? undefined }
      }
    });
  }

  private readonly handleReload = (): void => {
    window.location.reload();
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className='bg-background flex min-h-screen items-center justify-center px-6 py-12'>
          <div className='flex w-full max-w-md flex-col gap-6'>
            <span className='text-primary text-xs font-medium tracking-[0.18em] uppercase'>
              {i18n.t("app.name")}
            </span>
            <h1 className='text-foreground text-4xl leading-[1.05] font-bold tracking-tight md:text-5xl'>
              {i18n.t("errors.boundary.title")}
            </h1>
            <p className='text-muted-foreground text-base'>
              {i18n.t("errors.boundary.body")}
            </p>
            <button
              type='button'
              onClick={this.handleReload}
              className='bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold transition'
            >
              {i18n.t("errors.boundary.retry")}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
