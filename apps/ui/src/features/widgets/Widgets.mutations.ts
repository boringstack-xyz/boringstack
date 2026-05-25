import {
  type UseMutationResult,
  useMutation,
  useQueryClient
} from "@tanstack/react-query";

import { ApiError } from "@/lib/api/ApiError";
import { apiClient } from "@/lib/api/client";

import { WIDGETS_QUERY_KEYS } from "./Widgets.constants";
import type { IWidget, IWidgetFormInput } from "./Widgets.types";

export function useCreateWidget(): UseMutationResult<
  IWidget,
  unknown,
  IWidgetFormInput
> {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: IWidgetFormInput) => {
      const { data } = await apiClient.POST("/api/v1/widgets/", {
        body: input
      });

      if (!data) {
        throw new ApiError(0, { message: "Empty widget response" });
      }

      return data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: WIDGETS_QUERY_KEYS.list });
    }
  });
}

export function useUpdateWidget(): UseMutationResult<
  IWidget,
  unknown,
  { id: string; input: IWidgetFormInput }
> {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      input
    }: {
      id: string;
      input: IWidgetFormInput;
    }) => {
      const { data } = await apiClient.PATCH("/api/v1/widgets/{id}", {
        params: { path: { id } },
        body: input
      });

      if (!data) {
        throw new ApiError(0, { message: "Empty widget response" });
      }

      return data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: WIDGETS_QUERY_KEYS.list });
    }
  });
}

export function useDeleteWidget(): UseMutationResult<
  unknown,
  unknown,
  { id: string }
> {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { data } = await apiClient.DELETE("/api/v1/widgets/{id}", {
        params: { path: { id } }
      });

      return data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: WIDGETS_QUERY_KEYS.list });
    }
  });
}
