import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Handlebars from "handlebars/runtime";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { ApiErrors, getErrorMessage } from "../errors";
import type {
  IPrecompiledTemplate,
  TemplateDelegate,
  TemplateSpec,
} from "./email.types";

export class EmailTemplateService {
  private static readonly moduleDir = path.dirname(
    fileURLToPath(import.meta.url)
  );

  private readonly baseCache = new Map<string, TemplateDelegate>();
  private readonly contentCache = new Map<string, TemplateDelegate | null>();
  private readonly templatesDir: string;
  private partialsLoaded = false;

  constructor(
    templatesDir: string = EmailTemplateService.resolveTemplatesDir()
  ) {
    this.templatesDir = templatesDir;
    this.loadPartials();
  }

  /**
   * `Handlebars.template()` returns `HandlebarsTemplateDelegate<any>`. Wrap
   * it to match our stricter `TemplateDelegate` signature without using
   * `as`.
   */
  private static wrapDelegate(spec: TemplateSpec): TemplateDelegate {
    const fn = Handlebars.template(spec);

    return (vars) => {
      const result: unknown = fn(vars);

      return typeof result === "string" ? result : String(result);
    };
  }

  /**
   * Resolves the directory containing the precompiled JSON templates.
   *
   * Order:
   *   1. EMAIL_TEMPLATES_DIR env var (if set)
   *   2. <dist of this module>/../../templates/email/dist (compiled)
   *   3. <repo>/src/templates/email/dist                  (dev / from src)
   */
  private static resolveTemplatesDir(): string {
    if (env.EMAIL_TEMPLATES_DIR !== "") {
      return env.EMAIL_TEMPLATES_DIR;
    }

    const candidates = [
      path.join(
        EmailTemplateService.moduleDir,
        "..",
        "templates",
        "email",
        "dist"
      ),
      path.join(EmailTemplateService.moduleDir, "templates", "email", "dist"),
      path.join(process.cwd(), "src", "templates", "email", "dist"),
      path.join(process.cwd(), "templates", "email", "dist"),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return candidates[0] ?? "";
  }

  /**
   * Revives a Handlebars-precompiled template string into a runtime spec.
   * `new Function("return " + code)()` is the documented Handlebars
   * pattern.
   */
  private static evaluatePrecompiledTemplate(
    precompiledCode: string
  ): TemplateSpec {
    /*
     * `precompiledCode` is the JSON output of Handlebars.precompile() over
     * template files we own (src/templates/email/). Never user input;
     * never reaches this function from the network. nosemgrep directive
     * must sit end-of-line on the offending statement; preceding-line is
     * not honored.
     */
    const spec: unknown = new Function("return " + precompiledCode)(); // nosemgrep: semgrep.no-eval

    if (typeof spec === "object" && spec !== null && "main" in spec) {
      return spec;
    }

    throw ApiErrors.internal("Invalid precompiled template specification");
  }

  private loadPartials(): void {
    if (this.partialsLoaded) {
      return;
    }

    const partialsPath = path.join(this.templatesDir, "partials.json");

    if (!fs.existsSync(partialsPath)) {
      logger.warn("Email partials manifest not found", {
        event: "email.templates.partials_missing",
        path: partialsPath,
        hint: "Run `bun run build:templates` to generate it",
      });

      return;
    }

    try {
      const raw = fs.readFileSync(partialsPath, "utf8");
      const parsed: unknown = JSON.parse(raw);

      if (typeof parsed !== "object" || parsed === null) {
        throw ApiErrors.internal("partials.json is not an object");
      }

      const manifest = parsed;

      Handlebars.registerHelper("concat", (...args: unknown[]) => {
        args.pop();

        return args.join("");
      });
      Handlebars.registerHelper(
        "eq",
        (left: unknown, right: unknown) => left === right
      );

      for (const [partialName, code] of Object.entries(manifest)) {
        if (typeof code !== "string") {
          continue;
        }

        const spec = EmailTemplateService.evaluatePrecompiledTemplate(code);

        Handlebars.registerPartial(
          partialName,
          EmailTemplateService.wrapDelegate(spec)
        );
      }

      this.partialsLoaded = true;
    } catch (error: unknown) {
      logger.error("Failed to load email partials manifest", {
        event: "email.templates.partials_load_failed",
        error: getErrorMessage(error),
      });
    }
  }

  private loadTemplate(templatePath: string): {
    base: TemplateDelegate;
    content: TemplateDelegate | null;
  } {
    if (templatePath === "") {
      throw ApiErrors.validation(
        "Template path must be a non-empty string",
        "templatePath"
      );
    }

    const cachedBase = this.baseCache.get(templatePath);
    const cachedContent = this.contentCache.get(templatePath);

    if (cachedBase && cachedContent !== undefined) {
      return { base: cachedBase, content: cachedContent };
    }

    const basename = path.basename(templatePath);
    const fullPath = path.join(
      this.templatesDir,
      templatePath,
      `${basename}.json`
    );

    if (!fs.existsSync(fullPath)) {
      throw ApiErrors.notFound(`Email template '${templatePath}'`);
    }

    const raw = fs.readFileSync(fullPath, "utf8");
    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("baseTemplate" in parsed)
    ) {
      throw ApiErrors.internal(`Invalid template JSON: ${templatePath}`);
    }

    if (typeof parsed.baseTemplate !== "string") {
      throw ApiErrors.internal(`Invalid baseTemplate in ${templatePath}`);
    }

    const data: IPrecompiledTemplate = {
      baseTemplate: parsed.baseTemplate,
      contentTemplate:
        "contentTemplate" in parsed &&
        typeof parsed.contentTemplate === "string"
          ? parsed.contentTemplate
          : null,
    };

    const baseSpec = EmailTemplateService.evaluatePrecompiledTemplate(
      data.baseTemplate
    );
    const base = EmailTemplateService.wrapDelegate(baseSpec);

    let content: TemplateDelegate | null = null;

    if (data.contentTemplate !== null) {
      content = EmailTemplateService.wrapDelegate(
        EmailTemplateService.evaluatePrecompiledTemplate(data.contentTemplate)
      );
    }

    this.baseCache.set(templatePath, base);
    this.contentCache.set(templatePath, content);

    return { base, content };
  }

  /**
   * Render a precompiled email template.
   *
   * @example
   *   const html = templates.render("auth/confirm-your-email", {
   *     subject: "Confirm your email",
   *     appName: "Acme",
   *     token,
   *     confirmationUrl: `${env.FRONTEND_URL}/verify-email`,
   *   });
   */
  render(templatePath: string, variables: Record<string, unknown>): string {
    try {
      const { base, content } = this.loadTemplate(templatePath);
      const rendered = content !== null ? content(variables) : "";

      return base({ ...variables, content: rendered });
    } catch (error: unknown) {
      logger.error("Failed to render email template", {
        event: "email.templates.render_failed",
        templatePath,
        error: getErrorMessage(error),
      });

      throw error;
    }
  }
}

export const emailTemplateService = new EmailTemplateService();
