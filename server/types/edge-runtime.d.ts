declare global {
  interface EdgeRequest extends Request {
    readonly bodyUsed: boolean;
  }
  interface EdgeResponse extends Response {
    readonly ok: boolean;
  }
  type JsonBody<T> = { ok: true; data: T } | { ok: false; error: string };
}
export {};
