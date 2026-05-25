import type { z } from "zod";

import type { operations } from "@/lib/api/client";

import type { widgetFormSchema } from "./Widgets.schemas";

type WidgetListResponse =
  operations["getApiV1Widgets"]["responses"][200]["content"]["application/json"];

export type IWidget = WidgetListResponse["items"][number];
export type IWidgetFormInput = z.infer<typeof widgetFormSchema>;
