import { DEFAULT_LIMIT, MAX_LIMIT } from "./pagination.constants";
import type {
  IPaginatedResponse,
  IPaginationMeta,
  IPaginationParams,
} from "./pagination.types";

export const PaginationUtils = {
  parseParams: (
    params: IPaginationParams
  ): { page: number; limit: number; offset: number } => {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, params.limit ?? DEFAULT_LIMIT)
    );
    const offset = (page - 1) * limit;

    return { page, limit, offset };
  },

  createMeta: (page: number, limit: number, total: number): IPaginationMeta => {
    const totalPages = Math.ceil(total / limit);

    return {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  },

  createResponse: <T>(
    data: T[],
    meta: IPaginationMeta
  ): IPaginatedResponse<T> => ({ data, meta }),
};
