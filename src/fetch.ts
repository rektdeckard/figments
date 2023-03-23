import { prid, assertMainThread } from "./utils";

declare function fetch(
  url: string,
  init?: FetchOptions
): Promise<FetchResponse>;

const FETCH_INTERNAL = "__fetch_internal";

type FetchListener<T = unknown> = (
  event: MessageEvent<{
    pluginMessage: {
      type: typeof FETCH_INTERNAL;
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
  id: string;
  req: {
    url: string;
    init?: FetchOptions;
  };
};

export default class Fetch {
  static createClient(...args: ConstructorParameters<typeof FetchClient>) {
    return new FetchClient(...args);
  }
  static get controller() {
    return FetchController.self;
  }
}

export class FetchClient {
  #listener: FetchListener;
  #pending: Map<string, [FetchResolve<unknown>, FetchReject]> = new Map();
  #enabled: boolean = false;

  constructor() {
    this.#listener = (event) => {
      if (!event.data.pluginMessage) return;
      const { type, id, res } = event.data.pluginMessage;

      if (type !== FETCH_INTERNAL || !id) return;

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
          id,
          req: {
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
  static #self: FetchController;
  static #listener: MessageEventHandler;
  static #enabled: boolean = false;

  private constructor() {
    FetchController.#listener = async (pm: FetchRequest, _props) => {
      const { type, id, req } = pm;
      if (type !== FETCH_INTERNAL) return;

      try {
        FetchController.#assertEnabled();

        const { url, init } = req;

        const res = await fetch(url, init);
        let data = null;

        try {
          data = await res.json();
        } catch (_) {
          data = await res.text();
        }

        figma.ui.postMessage({
          type: FETCH_INTERNAL,
          id,
          res: {
            ...res,
            data,
          },
        });
      } catch (error) {
        figma.ui.postMessage({
          type: FETCH_INTERNAL,
          id,
          res: { error },
        });
      }
    };
  }

  static get self(): FetchController {
    return this.#self || (this.#self = new FetchController());
  }

  static #assertEnabled() {
    if (!FetchController.#enabled) {
      throw new Error("FetchController must be enabled");
    }
  }

  enable() {
    assertMainThread();

    if (!FetchController.#enabled) {
      figma.ui.on("message", FetchController.#listener);
      FetchController.#enabled = true;
    }
    return FetchController.#self;
  }

  disable() {
    assertMainThread();

    if (FetchController.#enabled) {
      figma.ui.off("message", FetchController.#listener);
      FetchController.#enabled = false;
    }
    return FetchController.#self;
  }
}
