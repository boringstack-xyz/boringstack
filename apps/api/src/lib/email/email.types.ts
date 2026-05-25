import type Handlebars from "handlebars/runtime";

/*
 * ---------------------------------------------------------------------------
 * Provider contract
 * ---------------------------------------------------------------------------
 */

export type EmailProviderName =
  | "resend"
  | "sendgrid"
  | "cloudflare"
  | "smtp"
  | "noop";

export interface IEmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface IEmailResult {
  id: string;
  provider: EmailProviderName;
}

export interface IEmailService {
  send: (message: IEmailMessage) => Promise<IEmailResult>;
  /** Identifies which provider is active (for logging / health checks). */
  readonly providerName: EmailProviderName;
}

/*
 * ---------------------------------------------------------------------------
 * Template service
 * ---------------------------------------------------------------------------
 */

export interface ISendTemplateInput {
  to: string;
  subject: string;
  templatePath: string;
  variables?: Record<string, unknown>;
}

export interface IPrecompiledTemplate {
  baseTemplate: string;
  contentTemplate: string | null;
}

export type TemplateDelegate = (vars: Record<string, unknown>) => string;

export type TemplateSpec = Parameters<typeof Handlebars.template>[0];

/*
 * ---------------------------------------------------------------------------
 * Retry helper
 * ---------------------------------------------------------------------------
 */

export interface IRetryOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  retryableErrorTypes?: (new (...args: never[]) => Error)[];
}

export interface IResolvedRetryOptions {
  maxRetries: number;
  retryDelayMs: number;
  retryableErrorTypes: (new (...args: never[]) => Error)[];
}
