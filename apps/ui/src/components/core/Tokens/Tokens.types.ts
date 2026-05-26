export interface ITokenSwatch {
  readonly name: string;
  readonly var: string;
  readonly style: string;
}

export interface ITokenGroup {
  readonly id: string;
  readonly title: string;
  readonly swatches: readonly ITokenSwatch[];
}

export interface ITokensProps {
  readonly className?: string;
}

export interface ITokensView {
  readonly groups: readonly ITokenGroup[];
}
