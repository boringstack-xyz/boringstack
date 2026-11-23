import type { FC } from "react";

import { useSectionTitle } from "./SectionTitle.hooks";
import type { ISectionTitleProps } from "./SectionTitle.types";

const HEADING_CLASS_NAME =
  "text-foreground text-base font-semibold tracking-tight";

/*
 * The one heading a card or panel section wears inside an app page, so
 * Settings, Team, Billing and the rest read as one product.
 */
const SectionTitle: FC<ISectionTitleProps> = (props) => {
  const { title, description, id } = props;
  const view = useSectionTitle(props);

  return (
    <header className={view.className}>
      {view.isSubsection ? (
        <h3 id={id} className={HEADING_CLASS_NAME}>
          {title}
        </h3>
      ) : (
        <h2 id={id} className={HEADING_CLASS_NAME}>
          {title}
        </h2>
      )}
      {description === undefined ? null : (
        <p className='text-muted-foreground text-sm leading-relaxed'>
          {description}
        </p>
      )}
    </header>
  );
};

SectionTitle.displayName = "SectionTitle";

export default SectionTitle;
export { SectionTitle };
