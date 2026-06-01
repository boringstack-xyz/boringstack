import type { IJoinRequest } from "../../Accounts.types";

export interface IJoinRequestsPageView {
  isLoading: boolean;
  isError: boolean;
  requests: IJoinRequest[];
  onApprove: (requestId: string) => void;
  onDeny: (requestId: string) => void;
  pendingActionId: string | null;
}
