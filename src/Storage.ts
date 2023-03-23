import { prid, assertMainThread } from "./utils";

const STORAGE_INTERNAL = "__storage_internal";

export enum StorageMethod {
  GET = "__storage_get",
  SET = "__storage_set",
  DELETE = "__storage_del",
  KEYS = "__storage_keys",
}

type StorageMessageBase = {
  type: typeof STORAGE_INTERNAL;
  channel?: string;
  id?: string;
};

export type StorageRequest<T = unknown> = StorageMessageBase &
  (
    | { method: StorageMethod.GET; key: string; value?: never }
    | { method: StorageMethod.SET; key: string; value: T }
    | { method: StorageMethod.DELETE; key: string; value?: never }
    | { method: StorageMethod.KEYS; key?: never; value?: never }
  );

export type StorageResponse<T = unknown> = StorageMessageBase &
  (
    | { method: StorageMethod.GET; key: string; value: T | null }
    | { method: StorageMethod.SET; key: string; value: T | null }
    | { method: StorageMethod.DELETE; key: string; value?: never }
    | { method: StorageMethod.KEYS; key?: never; value?: string[] }
  );

export type StorageListener<T = unknown> = (
  event: MessageEvent<{
    pluginMessage: StorageResponse<T>;
  }>
) => void;

type StorageResolve<T> = (value: T | PromiseLike<T>) => void;
type StorageReject = (reason?: any) => void;

export type ObserverKeys = string[] | "*";

export default class Storage {
  static createClient(...args: ConstructorParameters<typeof StorageClient>) {
    return new StorageClient(...args);
  }
  static createController(
    ...args: ConstructorParameters<typeof StorageController>
  ) {
    return new StorageController(...args);
  }
}

export class StorageClient {
  #channel?: string;
  #receiver: StorageListener;
  #observers: Map<string, StorageListener<any>> = new Map();
  #pending: Map<string, [StorageResolve<any>, StorageReject]> = new Map();
  #enabled: boolean = false;

  constructor(channel?: string, observers?: [ObserverKeys, StorageListener][]) {
    this.#channel = channel;
    this.#receiver = (event) => {
      if (!event.data.pluginMessage) return;
      const { type, channel, id, value } = event.data.pluginMessage;

      if (
        type !== STORAGE_INTERNAL ||
        !id ||
        (!!this.#channel && channel !== this.#channel)
      )
        return;

      const [resolve] = this.#pending.get(id) ?? [];
      if (!resolve) return;

      resolve(value);

      this.#pending.delete(id);
    };

    if (observers) {
      observers.forEach(([keys, callback]) => {
        this.observe(keys, callback);
      });
    }
  }

  #assertEnabled() {
    if (!this.#enabled) {
      throw new Error("FetchController must be enabled");
    }
  }

  enable() {
    window.addEventListener("message", this.#receiver);
    for (const o of this.#observers.values()) {
      window.addEventListener("message", o);
    }
    this.#enabled = true;
    return this;
  }

  disable() {
    window.removeEventListener("message", this.#receiver);
    for (const o of this.#observers.values()) {
      window.removeEventListener("message", o);
    }
    this.#enabled = false;
    return this;
  }

  get channel() {
    return this.#channel;
  }

  async getAsync<T>(key: string): Promise<T | null> {
    this.#assertEnabled();

    const id = prid();
    const promise = new Promise<T | null>((resolve, reject) => {
      this.#pending.set(id, [resolve, reject]);
    });

    const pluginMessage: StorageRequest<T> = {
      type: STORAGE_INTERNAL,
      method: StorageMethod.GET,
      channel: this.#channel,
      id,
      key,
    };

    parent.postMessage({ pluginMessage }, "*");
    return promise;
  }

  async setAsync<T>(key: string, value: T): Promise<void> {
    this.#assertEnabled();

    const id = prid();
    const promise = new Promise<void>((resolve, reject) => {
      this.#pending.set(id, [resolve, reject]);
    });

    const pluginMessage: StorageRequest<T> = {
      type: STORAGE_INTERNAL,
      method: StorageMethod.SET,
      channel: this.#channel,
      id,
      key,
      value,
    };

    parent.postMessage({ pluginMessage }, "*");
    return promise;
  }

  async deleteAsync(key: string): Promise<void> {
    this.#assertEnabled();

    const id = prid();
    const promise = new Promise<void>((resolve, reject) => {
      this.#pending.set(id, [resolve, reject]);
    });

    const pluginMessage: StorageRequest = {
      type: STORAGE_INTERNAL,
      method: StorageMethod.DELETE,
      channel: this.#channel,
      id,
      key,
    };

    parent.postMessage({ pluginMessage }, "*");
    return promise;
  }

  async keysAsync(): Promise<string[]> {
    this.#assertEnabled();

    const id = prid();
    const promise = new Promise<string[]>((resolve, reject) => {
      this.#pending.set(id, [resolve, reject]);
    });

    const pluginMessage: StorageRequest = {
      type: STORAGE_INTERNAL,
      method: StorageMethod.KEYS,
      channel: this.#channel,
      id,
    };

    parent.postMessage({ pluginMessage }, "*");
    return promise;
  }

  observe<T>(keys: string[] | "*", listener: StorageListener<T>) {
    const observerId = prid();
    const proxyListener: StorageListener<T | null> = (event) => {
      if (!event.data.pluginMessage) return;

      const { type, channel, key } = event.data.pluginMessage;
      if (
        type !== STORAGE_INTERNAL ||
        (!!this.#channel && channel !== this.#channel) ||
        !(keys === "*" || keys.includes(key!))
      ) {
        return;
      }

      listener(event);
    };

    this.#observers.set(observerId, proxyListener);
    if (this.#enabled) {
      window.addEventListener("message", proxyListener);
    }

    return observerId;
  }

  unobserve(observerId: string) {
    const observer = this.#observers.get(observerId);
    if (observer) {
      window.removeEventListener("message", observer);
      this.#observers.delete(observerId);
    }
  }

  unobserveAll() {
    for (const o of this.#observers.values()) {
      window.removeEventListener("message", o);
    }
    this.#observers.clear();
  }

  requestGet(key: string) {
    const pluginMessage: StorageRequest = {
      type: STORAGE_INTERNAL,
      method: StorageMethod.GET,
      channel: this.#channel,
      key,
    };
    parent.postMessage({ pluginMessage }, "*");
  }

  requestSet<T>(key: string, value: T) {
    const pluginMessage: StorageRequest<T> = {
      type: STORAGE_INTERNAL,
      method: StorageMethod.SET,
      channel: this.#channel,
      key,
      value,
    };
    parent.postMessage({ pluginMessage }, "*");
  }

  requestDelete(key: string) {
    const pluginMessage: StorageRequest = {
      type: STORAGE_INTERNAL,
      method: StorageMethod.DELETE,
      channel: this.#channel,
      key,
    };
    parent.postMessage({ pluginMessage }, "*");
  }

  requestKeys() {
    const pluginMessage: StorageRequest = {
      type: STORAGE_INTERNAL,
      method: StorageMethod.KEYS,
      channel: this.#channel,
    };
    parent.postMessage({ pluginMessage }, "*");
  }
}

export class StorageController {
  #channel?: string;
  #listener: MessageEventHandler;
  #enabled: boolean = false;

  constructor(channel?: string) {
    this.#channel = channel;
    this.#listener = <T>(pm: StorageRequest<T>, _pp: OnMessageProperties) => {
      const { type, channel, method } = pm;
      if (
        type !== STORAGE_INTERNAL ||
        (!!this.channel && channel !== this.channel)
      )
        return;

      switch (method) {
        case StorageMethod.GET:
          this.handleGet(pm);
          break;

        case StorageMethod.SET:
          this.handleSet(pm);
          break;

        case StorageMethod.DELETE:
          this.handleDelete(pm);
          break;

        case StorageMethod.KEYS:
          this.handleKeys(pm);
          break;

        default:
          return;
      }
    };
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

  async handleGet<T>(req: StorageRequest<T>) {
    assertMainThread();
    this.#assertEnabled();

    const value = await figma.clientStorage.getAsync(req.key!);

    const message = {
      type: STORAGE_INTERNAL,
      method: StorageMethod.GET,
      channel: this.#channel,
      id: req.id,
      key: req.key,
      value,
    } as StorageResponse<T>;

    figma.ui.postMessage(message);
  }

  async handleSet<T>(req: StorageRequest<T>) {
    assertMainThread();
    this.#assertEnabled();

    await figma.clientStorage.setAsync(req.key!, req.value);

    const message = {
      type: STORAGE_INTERNAL,
      method: StorageMethod.SET,
      channel: this.#channel,
      id: req.id,
      key: req.key,
      value: req.value,
    } as StorageResponse<T>;

    figma.ui.postMessage(message);
  }

  async handleDelete(req: StorageRequest) {
    assertMainThread();
    this.#assertEnabled();

    await figma.clientStorage.deleteAsync(req.key!);

    const message = {
      type: STORAGE_INTERNAL,
      method: StorageMethod.DELETE,
      channel: this.#channel,
      id: req.id,
      key: req.key,
    } as StorageResponse;

    figma.ui.postMessage(message);
  }

  async handleKeys(req: StorageRequest) {
    assertMainThread();
    this.#assertEnabled();

    const allKeys = await figma.clientStorage.keysAsync();

    const message: StorageResponse = {
      type: STORAGE_INTERNAL,
      method: StorageMethod.KEYS,
      channel: this.#channel,
      id: req.id,
      value: allKeys,
    };

    figma.ui.postMessage(message);
  }
}
