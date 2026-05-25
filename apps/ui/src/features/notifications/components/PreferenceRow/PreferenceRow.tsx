import type { FC } from "react";

import { PreferenceCell } from "../PreferenceCell";
import { usePreferenceRow } from "./PreferenceRow.hooks";
import type { IPreferenceRowProps } from "./PreferenceRow.types";

const PreferenceRow: FC<IPreferenceRowProps> = (props) => {
  const { eventType, cells, onToggle } = usePreferenceRow(props);

  const renderedCells = cells.map((cell) => (
    <PreferenceCell
      key={cell.channel}
      eventType={eventType}
      channel={cell.channel}
      enabled={cell.enabled}
      onToggle={onToggle}
    />
  ));

  return (
    <tr className='border-border border-b last:border-b-0'>
      <td className='text-foreground px-4 py-3 font-mono text-xs'>
        {eventType}
      </td>
      {renderedCells}
    </tr>
  );
};

PreferenceRow.displayName = "PreferenceRow";

export default PreferenceRow;
export { PreferenceRow };
