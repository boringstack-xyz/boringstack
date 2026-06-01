import clsx from "clsx";
import type { PropsWithChildren } from "react";

interface FaqGroupProps {
  className?: string;
}

export default function FaqGroup({ children, className }: PropsWithChildren<FaqGroupProps>) {
  return <div className={clsx("not-content my-6 grid gap-3", className)}>{children}</div>;
}
