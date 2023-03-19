export enum RequestType {
  GET = "req_get",
  SET = "req_set",
  DELETE = "req_del",
  KEYS = "req_keys",
}

export enum ResponseType {
  GET = "res_get",
  SET = "res_set",
  DELETE = "res_del",
  KEYS = "res_keys",
}

export type Request<T = unknown> =
  | { type: RequestType.GET; payload: GetAsyncPayload }
  | { type: RequestType.SET; payload: SetAsyncPayload<T> }
  | { type: RequestType.DELETE; payload: GetAsyncPayload }
  | { type: RequestType.KEYS; payload?: never };

export type Response<T = unknown> =
  | { type: ResponseType.GET; payload: SetAsyncPayload<T> }
  | { type: ResponseType.SET; payload: SetAsyncPayload<T> }
  | { type: ResponseType.DELETE; payload?: DeleteAsyncPayload }
  | { type: ResponseType.KEYS; payload: KeysAsyncPayload };

export interface WithChannel {
  channel: string;
}

export interface WithUpdate {
  update?: boolean;
}

export interface GetAsyncPayload extends WithChannel {
  key: string;
}

export interface SetAsyncPayload<T = unknown>
  extends GetAsyncPayload,
    WithUpdate {
  value: T;
}

export interface DeleteAsyncPayload extends GetAsyncPayload, WithUpdate {}

export interface KeysAsyncPayload extends WithChannel {
  key?: never;
  keys: string[];
}

export type StorageListener<T = unknown> = (
  event: MessageEvent<{ pluginMessage: Response<T> }>
) => void;

export default class Storage {
  #channel: string;
  #client: StorageClient;
  #controller: StorageController;

  constructor(channel: string = "") {
    this.#channel = channel;
    this.#client = new StorageClient(channel);
    this.#controller = new StorageController(channel);
  }

  get channel() {
    return this.#channel;
  }

  get client() {
    return this.#client;
  }

  get controller() {
    return this.#controller;
  }

  static createClient(channel: string) {
    return new StorageClient(channel);
  }

  static createController(channel: string) {
    return new StorageController(channel);
  }
}

export class StorageController {
  #channel: string;
  #listener: MessageEventHandler;
  #enabled: boolean = false;

  constructor(channel: string) {
    this.#channel = channel;
    this.#listener = <T>(pm: Request<T>, pr) => {
      if (!pm?.type || !pm?.payload) return;

      const { type, payload } = pm;
      if (
        payload?.channel !== this.#channel ||
        ![
          RequestType.GET,
          RequestType.SET,
          RequestType.DELETE,
          RequestType.KEYS,
        ].includes(type)
      ) {
        return;
      }

      switch (type) {
        case RequestType.GET:
          this.getRequest(pm.payload);
          break;
        case RequestType.SET:
          this.setRequest(pm.payload as SetAsyncPayload<T>);
          break;
        case RequestType.DELETE:
          this.deleteRequest(pm.payload);
          break;
        case RequestType.KEYS:
          this.keysRequest();
          break;
        default:
          return;
      }
    };
  }

  #assertMainThread() {
    if (!figma) {
      throw new Error(
        "StorageContoller cannot be initialized from UI thread. Set this up in your main thread."
      );
    }
  }

  #assertEnabled() {
    if (!this.#enabled) {
      throw new Error("StorageController must be enabled");
    }
  }

  get channel() {
    return this.#channel;
  }

  enable() {
    this.#assertMainThread();

    if (!this.#enabled) {
      figma.ui.on("message", this.#listener);
      this.#enabled = true;
    }
    return this;
  }

  disable() {
    this.#assertMainThread();

    if (this.#enabled) {
      figma.ui.off("message", this.#listener);
      this.#enabled = false;
    }
    return this;
  }

  async getRequest(payload: GetAsyncPayload) {
    this.#assertMainThread();
    this.#assertEnabled();

    const value = await figma.clientStorage.getAsync(
      `${this.channel}_${payload.key}`
    );
    if (typeof value !== "undefined") {
      figma.ui.postMessage({
        type: ResponseType.GET,
        payload: { ...payload, value },
      });
    }
  }

  async setRequest(payload: SetAsyncPayload) {
    this.#assertMainThread();
    this.#assertEnabled();

    await figma.clientStorage.setAsync(
      `${this.channel}_${payload.key}`,
      payload.value
    );
    if (payload.update) {
      figma.ui.postMessage({
        type: ResponseType.SET,
        payload,
      });
    }
  }

  async deleteRequest(payload: DeleteAsyncPayload) {
    this.#assertMainThread();
    this.#assertEnabled();

    await figma.clientStorage.deleteAsync(payload.key);
    if (payload.update) {
      figma.ui.postMessage({
        type: ResponseType.DELETE,
        payload: { ...payload, value: undefined },
      });
    }
  }

  async keysRequest() {
    this.#assertMainThread();
    this.#assertEnabled();

    const keys = await figma.clientStorage.keysAsync();
    const keyRegex = new RegExp(`/^${this.channel}_`);

    figma.ui.postMessage({
      type: ResponseType.KEYS,
      payload: {
        channel: this.#channel,
        keys: keys.map((key) => key.replace(keyRegex, "")),
      },
    });
  }
}

export class StorageClient {
  #channel: string;
  #listeners: Map<string, StorageListener> = new Map();

  constructor(channel: string) {
    this.#channel = channel;
  }

  get channel() {
    return this.#channel;
  }

  register<T>(
    stream: string,
    listener?: StorageListener<T> | null,
    initKeys?: string[]
  ) {
    if (listener) {
      const proxyListener: StorageListener<T> = (event) => {
        if (!event.data.pluginMessage) return;

        const { type, payload } = event.data.pluginMessage;
        if (
          !payload ||
          payload?.channel !== this.#channel ||
          ![
            ResponseType.GET,
            ResponseType.SET,
            ResponseType.DELETE,
            ResponseType.KEYS,
          ].includes(type)
        ) {
          return;
        } else {
          listener(event);
        }
      };

      window.addEventListener("message", proxyListener);
      this.#listeners.set(stream, listener);
    }

    initKeys?.forEach(this.requestGet);

    return this;
  }

  unregister(stream: string) {
    window.removeEventListener("message", this.#listeners.get(stream));
    this.#listeners.delete(stream);
  }

  requestGet(key: string) {
    parent.postMessage(
      {
        pluginMessage: {
          type: RequestType.GET,
          payload: { key, channel: this.#channel },
        },
      },
      "*"
    );
  }

  requestSet<T>(key: string, value: T, update?: boolean) {
    parent.postMessage(
      {
        pluginMessage: {
          type: RequestType.SET,
          payload: { key, channel: this.#channel, update, value },
        },
      },
      "*"
    );
  }

  requestReset(key: string, update?: boolean) {
    parent.postMessage(
      {
        pluginMessage: {
          type: RequestType.DELETE,
          payload: { key, channel: this.#channel, update },
        },
      },
      "*"
    );
  }

  requestKeys() {
    parent.postMessage({ pluginMessage: { type: RequestType.KEYS } }, "*");
  }
}
