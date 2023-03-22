import * as React from "react";
import { Storage, StorageResponseMethod } from "../../../src";

type UseStorageOptions = {
  channel?: string;
  key: string;
  optimistic?: boolean;
};

const usePersistedState = <T>(
  options: UseStorageOptions,
  initial: T
): [T | null, (value: T) => void, () => void] => {
  const [data, setData] = React.useState<T | null>(initial ?? null);
  const client = React.useRef(Storage.createClient(options.channel).enable());

  React.useEffect(() => {
    const observerId = client.current.observe<T>([options.key], (event) => {
      const { method, value } = event.data.pluginMessage;
      switch (method) {
        case StorageResponseMethod.GET:
        case StorageResponseMethod.SET:
          setData(value);
          break;
        case StorageResponseMethod.DELETE:
          setData(null);
          break;
        default:
          return;
      }
    });

    client.current.requestGet(options.key);

    return () => client.current.unobserve(observerId);
  }, [options.key]);

  const set = React.useCallback(
    (value: T) => {
      if (options.optimistic) setData(value);
      client.current.requestSet(options.key, value);
    },
    [options.key, options.optimistic]
  );

  const reset = React.useCallback(() => {
    if (options.optimistic) setData(initial);
    client.current.requestDelete(options.key);
  }, [options.key]);

  return [data, set, reset];
};

export default usePersistedState;
