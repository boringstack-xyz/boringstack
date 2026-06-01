import type { FC } from "react";

import { Switch } from "@/components/ui/switch";

import { usePreferenceCell } from "./PreferenceCell.hooks";
import type { IPreferenceCellProps } from "./PreferenceCell.types";

const PreferenceCell: FC<IPreferenceCellProps> = (props) => {
  const { eventType, channel, enabled } = props;
  const { handleChange } = usePreferenceCell(props);

  return (
    <td className='px-4 py-2 text-center'>
      <Switch
        checked={enabled}
        aria-label={`${eventType} ${channel}`}
        onCheckedChange={handleChange}
      />
    </td>
  );
};

PreferenceCell.displayName = "PreferenceCell";

export default PreferenceCell;
export { PreferenceCell };
