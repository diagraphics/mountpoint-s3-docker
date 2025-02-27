type RequestHead = Pick<Request, "headers" | "body" | "url" | "method">;
type RequestContent = Pick<Request, "body" | "arrayBuffer">;

interface SignableRequest extends RequestHead, RequestContent {
  clone(): SignableRequest;
}

export type { SignableRequest };
