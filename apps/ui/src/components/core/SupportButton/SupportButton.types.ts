export interface ISupportButtonProps {
  /** Opens whatever support channel the app uses: a chat, a form or a mailto. */
  readonly onOpen: () => void;
  readonly className?: string;
}
