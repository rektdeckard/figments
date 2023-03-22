import { prid, assertMainThread } from "./utils";

declare function fetch(
  url: string,
  init?: FetchOptions
): Promise<FetchResponse>;

const FETCH_INTERNAL = "__fetch_internal";
const FETCH_DEFAULT_CHANNEL = "__fetch_default";

type FetchListener<T = unknown> = (
  event: MessageEvent<{
    pluginMessage: {
      type: typeof FETCH_INTERNAL;
      channel: string;
      id: string;
      res: { data: T; error?: never } | { data?: never; error?: any };
    };
  }>
) => void;

export type FetchResponseUnwrapped<T = unknown> = {
  headersObject: { [name: string]: string };
  ok: boolean;
  redirected: boolean;
  status: number;
  statusText: string;
  type: string;
  url: string;
  data: T;
};

type FetchResolve<T> = (
  value: FetchResponseUnwrapped<T> | PromiseLike<FetchResponseUnwrapped<T>>
) => void;
type FetchReject = (reason?: any) => void;

type FetchRequest = {
  type: typeof FETCH_INTERNAL;
  channel: string;
  id: string;
  payload: {
    url: string;
    init?: FetchOptions;
  };
};

export default class Fetch {
  static createClient(channel: string) {
    return new FetchClient(channel);
  }
  static createController(channel: string) {
    return new FetchController(channel);
  }
}

export class FetchClient {
  #channel: string;
  #listener: FetchListener;
  #pending: Map<string, [FetchResolve<unknown>, FetchReject]> = new Map();
  #enabled: boolean = false;

  constructor(channel: string = FETCH_DEFAULT_CHANNEL) {
    this.#channel = channel;
    this.#listener = (event) => {
      if (!event.data.pluginMessage) return;
      const { type, channel, id, res } = event.data.pluginMessage;

      if (type !== FETCH_INTERNAL || !id || channel !== this.#channel) return;

      const [resolve, reject] = this.#pending.get(id) ?? [];
      if (!resolve || !reject) return;

      if (res.error) {
        reject(res);
      } else {
        resolve(res as FetchResponseUnwrapped<unknown>);
      }

      this.#pending.delete(id);
    };
  }

  #assertEnabled() {
    if (!this.#enabled) {
      throw new Error("FetchController must be enabled");
    }
  }

  enable() {
    window.addEventListener("message", this.#listener);
    this.#enabled = true;
    return this;
  }

  disable() {
    window.removeEventListener("message", this.#listener);
    this.#enabled = false;
    return this;
  }

  get channel() {
    return this.#channel;
  }

  async fetch<T = unknown>(
    url: string,
    init?: FetchOptions
  ): Promise<FetchResponseUnwrapped<T>> {
    this.#assertEnabled();

    const id = prid();
    const promise = new Promise<FetchResponseUnwrapped<T>>(
      (resolve, reject) => {
        this.#pending.set(id, [resolve, reject]);
      }
    );

    parent.postMessage(
      {
        pluginMessage: {
          type: FETCH_INTERNAL,
          channel: this.#channel,
          id,
          payload: {
            url,
            init,
          },
        },
      },
      "*"
    );

    return promise;
  }
}

export class FetchController {
  #channel: string;
  #listener: MessageEventHandler;
  #enabled: boolean = false;

  constructor(channel: string = FETCH_DEFAULT_CHANNEL) {
    this.#channel = channel;
    this.#listener = async (pm: FetchRequest, _props) => {
      const { type, channel, id, payload } = pm;
      if (type !== FETCH_INTERNAL || channel !== this.#channel) return;

      try {
        this.#assertEnabled();

        const { url, init } = payload;

        const res = await fetch(url, init);
        let data = null;

        try {
          data = await res.json();
        } catch (_) {
          data = await res.text();
        }

        figma.ui.postMessage({
          type: FETCH_INTERNAL,
          channel,
          id,
          res: {
            ...res,
            data,
          },
        });
      } catch (error) {
        figma.ui.postMessage({
          type: FETCH_INTERNAL,
          channel,
          id,
          res: { error },
        });
      }
    };
  }

  #assertEnabled() {
    if (!this.#enabled) {
      throw new Error("FetchController must be enabled");
    }
  }

  enable() {
    assertMainThread();

    if (!this.#enabled) {
      figma.ui.on("message", this.#listener);
      this.#enabled = true;
    }
    return this;
  }

  disable() {
    assertMainThread();

    if (this.#enabled) {
      figma.ui.off("message", this.#listener);
      this.#enabled = false;
    }
    return this;
  }
}
