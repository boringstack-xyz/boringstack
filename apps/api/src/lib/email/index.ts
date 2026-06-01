export { sendTemplate, sendTemplateNow } from "./email.dispatch";
export { emailService } from "./email.service";
export { buildEmailService } from "./email.service.utils";
export type {
  EmailProviderName,
  IEmailMessage,
  IEmailResult,
  IEmailService,
  ISendTemplateInput,
} from "./email.types";
export {
  baseTemplateVariables,
  isRetryableError,
  isValidEmail,
  maskEmailForLogging,
  normalizeEmail,
  retryWithBackoff,
  validateEmailMessage,
} from "./email.utils";
export {
  EMAIL_SUPPRESSION_PROVIDERS,
  EMAIL_SUPPRESSION_REASONS,
} from "./suppression.constants";
export type {
  EmailSuppressionProvider,
  EmailSuppressionReason,
} from "./suppression.constants";
export {
  EmailSuppressionService,
  emailSuppressionService,
} from "./suppression.service";
export type {
  IEmailSuppressionEntry,
  IRecordSuppressionInput,
  IRecordSuppressionResult,
} from "./suppression.types";
export { emailTemplateService, EmailTemplateService } from "./template.service";
