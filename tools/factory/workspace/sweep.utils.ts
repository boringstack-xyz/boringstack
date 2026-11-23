/**
 * What sweep knows about one slot: its claim (and whether that claim's
 * workspace folder still exists) and whether a compose stack exists for it,
 * with the folders its containers were started from (compose labels).
 */
export interface ISlotState {
  readonly slot: number;
  readonly claimed: boolean;
  readonly workspaceExists: boolean;
  readonly stackExists: boolean;
  /** Each container's working folder; true when that folder still exists. */
  readonly stackFoldersExist: readonly boolean[];
}

export type SweepAction =
  | { readonly kind: "remove"; readonly slot: number; readonly reason: string }
  | { readonly kind: "keep"; readonly slot: number; readonly reason: string };

/**
 * Removes a slot's stack and claim only when its checkout is certainly gone:
 * the claim's workspace folder no longer exists, or there is no claim and every
 * folder its stack was started from is gone. Everything else is kept.
 */
export const decideSweep = (slots: readonly ISlotState[]): SweepAction[] =>
  slots
    .filter((state) => state.claimed || state.stackExists)
    .map((state): SweepAction => {
      if (state.claimed && state.workspaceExists) {
        return {
          kind: "keep",
          slot: state.slot,
          reason: "its workspace still exists",
        };
      }

      if (state.claimed) {
        return {
          kind: "remove",
          slot: state.slot,
          reason: "its workspace folder is gone",
        };
      }

      const allGone =
        state.stackFoldersExist.length > 0 &&
        state.stackFoldersExist.every((exists) => !exists);

      return allGone
        ? { kind: "remove", slot: state.slot, reason: "its checkout is gone" }
        : {
            kind: "keep",
            slot: state.slot,
            reason: "no claim, but its folder still exists",
          };
    });
