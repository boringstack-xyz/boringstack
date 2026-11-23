import type { FC } from "react";

import { useIconBadge } from "./IconBadge.hooks";
import type { IIconBadgeProps } from "./IconBadge.types";

/* The small icon tile that leads a card, a banner or a dialog. Decorative. */
const IconBadge: FC<IIconBadgeProps> = (props) => {
  const view = useIconBadge(props);
  const Icon = props.icon;

  return (
    <span data-slot='icon-badge' className={view.className}>
      <Icon className='size-5' aria-hidden='true' />
    </span>
  );
};

IconBadge.displayName = "IconBadge";

export default IconBadge;
export { IconBadge };
