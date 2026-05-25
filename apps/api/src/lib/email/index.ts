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
  retryWithBackoff,
  validateEmailMessage,
} from "./email.utils";
export { emailTemplateService, EmailTemplateService } from "./template.service";
