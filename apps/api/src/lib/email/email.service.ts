import type { IEmailService } from "./email.types";
import { buildEmailService } from "./email.service.utils";

export const emailService: IEmailService = buildEmailService();
