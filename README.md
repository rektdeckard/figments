# figments

Helper utilities for the Figma Plugin API.

## Install

```sh
yarn add figments
```

## Fetch

A UI-thread "hole punch" that allows you to make network requests directly from your plugin UI code, without having to deal with passing messages across plugin/UI boundary. Exposes the same `async` API as `fetch`.

### Usage

To use Fetch, first enable the `FetchController` in your main plugin thread:

```ts
/* main.ts */
import { Fetch } from "figments";

(function main() {
  // Enable the controller, that's it!
  Fetch.controller.enable();

  figma.ui.on("message", (msg, props) => {
    // All your other message handlers
  });

  figma.showUI(__html__);
})();
```

Then in your client code, construct a `FetchClient` and enable it too. You can now make network requests from your UI thread:

```ts
/* ui.ts */
import { Fetch } from "figments";

// Create (and enable) a FetchClient.
const client = Fetch.createClient().enable();

// The UI-side API works exactly like the native `fetch` API:
const res = await client.fetch("https://httpbin.org/post", {
  method: "POST",
  headers: {
    Accept: "application/json",
    Cookie: "baz=0; qux=1",
  },
  body: JSON.stringify({ foo: 42, bar: false }),
});

// res ->
// {
//   "type": "cors",
//   "ok": true,
//   "status": 200,
//   "statusText": "",
//   "data": {
//     "args": {},
//     "headers": {
//       "Accept": "application/json",
//       ...
//     },
//     "json": {
//       "bar": false,
//       "foo": 42
//     },
//     ...
//     "url": "https://httpbin.org/post"
//   }
// }
```

> **NOTE:** `Fetch.createClient()` is just syntax sugar for `new FetchClient()`. The `enable()` and `.disable()` methods return `this`, so it's often simpler to just create and enable a client in one line.

### FetchController

The singleton main-thread controller that actually calls the `fetch` API and handles messaging with the client. Same as `Fetch.controller`.

**Methods**

- `static enable(): void`: Enable the controller, allowing it to listen for and perform fetch requests from the client, and return them to the client.
- `static disable(): void`: Disable the controller, causing it to stop listening for requests.

### FetchClient

The UI-thread client that allows you to interact with the `fetch` API. You can create as many clients as you like.

**Methods**

- `constructor(): FetchClient`: Create a client.
- `enable(): void`: Enable the client, allowing it to make network requests.
- `disable(): void`: Disable the client, causing it to ignore any pending requests.
- `async fetch<T>(url: string, init?: FetchOptions): Promise<FetchResponseUnwrapped<T>>`: Make a network requests as you are used to with the `fetch` API.

> **NOTE:** Since methods cannot be serialized over the plugin/UI boundary, the controller attempts `res.json()`, followed by `res.text()`, setting the result to the `data` property of the response, before returning it to the client.

### Types

```ts
// The response object returned by `client.fetch()`is more or less
// a serialized form of the normal FetchResponse

export type FetchResponseUnwrapped<T = unknown> = {
  headersObject?: { [name: string]: string };
  ok: boolean;
  redirected?: boolean;
  status: number;
  statusText: string;
  type: string;
  url: string;
  data: T;
};
```

## Storage

A UI-thread "hole punch" that allows you to call methods on `clientStorage` just as you would from the main thread, in addition to some other cool features for dealing with persisted data.

Using Figma's `clientStorage` API from UIs can be cumbersome – the UI thread can't talk directly to the storage, and we have to rely on event handlers and emitters on to do anything across the plugin/UI boundary. This usually involves a fair bit of boilerplate, and forces you to use synchronous code.

This module uses "channels" to handle all of the messaging between UI and plugin threads, allowing you to write `async` functions that set and return values to and from storage. Messages are scoped to their channel, meaning you will only subscribe to the data you want, and can even observe specific values in storage to watch them for changes.

### Basic usage

To set up a storage channel, first construct a `StorageController` in your main plugin thread, give it a name, and enable it:

```ts
/* main.ts */
import { Storage } from "figments";

(function main() {
  // Create a StorageController, providing an optional channel name.
  // Omitting the name will create a channel that listens for all StorageMessages.
  const controller = Storage.createController("channel_name");

  // Controllers will only listen for messages when enabled.
  controller.enable();

  figma.ui.on("message", (msg, props) => {
    // All your other message handlers
  });

  figma.showUI(__html__);
})();
```

Then in your client code, construct a `StorageClient` with the same channel name, and enable it too. You can now read and write values to storage directly from your UI thread:

```ts
/* ui.ts */
import { Storage } from "figments";

// Create (and enable) a StorageClient with the same channel name as the controller.
// The channel name determines what events from plugin code this client will respond to.
const client = Storage.createClient("channel_name").enable();

// The UI-side API works exactly like the native Figma `clientStorage` API:
const data = await client.getAsync("some_key");
await client.setAsync("other_key", { foo: 42, bar: false });
```

> **NOTE:** `Storage.createClient("channel_name")` is just syntax sugar for `new StorageClient("channel_name")`, and the same applies to `createController`. The `enable()` and `.disable()` methods return `this`, so it's often simpler to just create and enable a client or controller in one line.

### Observing

In addition to reading and writing values directly, you can also observe whenever certain values (or any value) is updated _by anyone_ on the channel, useful for adding reactivity when they are read and written from different places, or if you need your code to be synchronous or fire-and-forget.

```ts
import { Storage, StorageMethod } from "figments";

const clientA = Storage.createClient("my_channel").enable();

// Observe all changes on "my_channel", and log to the console
// whenever "power_level" is updated or removed.
clientA.observe(["power_level"], (event) => {
  const { method, key, value } = event.data.pluginMessage;

  switch (method) {
    case StorageMethod.SET:
    case StorageMethod.DELETE:
      console.log({ [key]: value });
      break;
    default:
      return;
  }
});

// When any client writes to this key, on "my_channel", the first client is notified.
const clientB = Storage.createClient("my_channel").enable();
clientB.setAsync("power_level", 9000);

// LOG: { power_level: 9000 }
```

> **NOTE:** You can observe all keys on this channel by passing `"*"` as the first argument instead of an array of keys.

### StorageController

The main thread controller that actually talks to the storage device. You should only ever register **one controller per channel name**, or use a single controller with no channel name specified.

**Methods**

- `constructor(channel?: string): StorageController`: Create a new controller.
- `enable(): void`: Enable the channel, allowing it to listen for and service requests from the client.
- `disable(): void`: Disable the channel, causing it to stop listening for requests.

**Fields**

- `channel: string | undefined`: The controller's channel name, if present.

### StorageClient

The UI thread client that allows you to interact with storage. You can have as many clients per channel as you like. Omitting the channel name will allow it to observe changes to all values in storage.

**Methods**

- `constructor(channel?: string, observers?: [ObserverKeys, StorageListener][]): StorageClient`: Create a new client. Observers may be added for convenience during initialization to watch for changes to specific keys on this channel. Observers added this way cannot be removed except by calling `unobserveAll()`.
- `enable(): void`: Enable the client, allowing it to send and receive storage requests to the controller.
- `disable(): void`: Disable the client, causing it to stop listening for responses.
- `getAsync<T>(key: string): Promise<T | null>`: Get the value for `key` from storage.
- `setAsync<T>(key: string, value: T): Promise<void>`: Set `key` to `value` in storage.
- `deleteAsync<T>(key: string): Promise<void>`: Delete the entry for `key` from storage.
- `keysAsync(): Promise<string[]>`: Get all stored keys for this plugin.
- `observe<T>(keys: ObserverKeys, listener: StorageListener<T>): string`: Listen for changes to one or more keys on this channel. Returns the `observerId` of the observer.
- `unobserve(observerId: string): Remove an observer registered with `observe()`.
- `unobserveAll(): Remove all active observers.
- `requestGet(key: string): void`: Emit a message for the controller to get a value from storage, but don't wait for the response. Useful in synchronous code, or when registered observers will handle the response.
- `requestSet<T>(key: string, value: T): void`: Emit a message for the controller to set a value from storage, but don't wait for the response. Useful in synchronous code, or when registered observers will handle the response.
- `requestDelete(key: string): void`: Emit a message for the controller to delete a value from storage, but don't wat for the response. Useful in synchronous code, or when registered observers will handle the response.
- `requestKeys(): void`: Emit a message for the controller to get all keys from storage, but don't wat for the response. Useful in synchronous code, or when registered observers will handle the response.

**Fields**

- `channel: string | undefined`: The client's channel name, if present.

### Types

```ts
enum StorageMethod {
  GET = "__storage_get",
  SET = "__storage_set",
  DELETE = "__storage_del",
  KEYS = "__storage_keys",
}

type StorageMessageBase = {
  type: "__storage_internal";
  channel?: string;
  id?: string;
};

type StorageRequest<T = unknown> = StorageMessageBase &
  (
    | { method: StorageMethod.GET; key: string; value?: never }
    | { method: StorageMethod.SET; key: string; value: T }
    | { method: StorageMethod.DELETE; key: string; value?: never }
    | { method: StorageMethod.KEYS; key?: never; value?: never }
  );

type StorageResponse<T = unknown> = StorageMessageBase &
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

export type ObserverKeys = string[] | "*";
```

MIT © [Tobias Fried](https://github.com/rektdeckard)
