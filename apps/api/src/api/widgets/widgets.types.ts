import type { InferSelectModel } from "drizzle-orm";

import type { widgets } from "../../clients/postgres/schema";

export type IWidget = InferSelectModel<typeof widgets>;

export interface ICreateWidgetInput {
  readonly name: string;
}

export interface IUpdateWidgetInput {
  readonly name: string;
}
