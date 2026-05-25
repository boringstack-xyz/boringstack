export interface ISendGridMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface ISendGridResponse {
  readonly headers: unknown;
}

export interface ISendGridMailClient {
  setApiKey: (apiKey: string) => void;
  send: (
    message: ISendGridMessage
  ) => Promise<readonly [ISendGridResponse, unknown]>;
}
