import type { FC, PropsWithChildren } from "react";

import { Toaster } from "@/components/ui/sonner";

export const ToastProvider: FC<PropsWithChildren> = ({ children }) => {
  return (
    <>
      {children}
      <Toaster position='top-right' />
    </>
  );
};
