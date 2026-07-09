export interface ITemplateMetadata {
  name: string;
  category: string;
  pathRel: string;
}

export type ProcessedValue =
  string | ProcessedValue[] | { [key: string]: ProcessedValue };
