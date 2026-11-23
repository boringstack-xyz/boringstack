import { t } from "elysia";

import {
  PRODUCT_EVENT_CONTEXT_PATTERN,
  PRODUCT_EVENT_KINDS,
} from "./product-events.constants";

export const ProductEventBodySchema = t.Object({
  kind: t.UnionEnum([...PRODUCT_EVENT_KINDS]),
  context: t.Optional(
    t.String({ maxLength: 40, pattern: PRODUCT_EVENT_CONTEXT_PATTERN })
  ),
});
