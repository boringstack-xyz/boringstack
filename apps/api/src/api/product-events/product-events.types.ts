import type { PRODUCT_EVENT_KINDS } from "./product-events.constants";

export type TProductEventKind = (typeof PRODUCT_EVENT_KINDS)[number];

export interface IProductEventInput {
  readonly accountId: string;
  readonly userId: string;
  readonly email: string;
  readonly kind: TProductEventKind;
  readonly context: string;
}
