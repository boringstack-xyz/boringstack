import type { PRODUCT_EVENT_KINDS } from "./product-events.constants";

export type TProductEventKind = (typeof PRODUCT_EVENT_KINDS)[number];
