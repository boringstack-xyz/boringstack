export interface IPubSubSubscriber {
  disconnect: () => Promise<void>;
}
