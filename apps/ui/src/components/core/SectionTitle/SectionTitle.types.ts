export interface ISectionTitleProps {
  readonly title: string;
  /** One line under the title saying what the section is for. */
  readonly description?: string;
  /** h2 for a section of the page, h3 for a block inside one. */
  readonly level?: 2 | 3;
  /** Lets the section point `aria-labelledby` at the heading. */
  readonly id?: string;
  readonly className?: string;
}

export interface ISectionTitleView {
  readonly isSubsection: boolean;
  readonly className: string;
}
