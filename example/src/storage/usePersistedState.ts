import * as React from "react";
import { ResponseType, Storage } from "../../../src";

type UseStorageOptions = {
  channel: string;
  key: string;
  optimistic?: boolean;
};

const usePersistedState = <T = unknown>(
  initial: T | null,
  options: UseStorageOptions
): [T | null, (value: T) => void] => {
  const [data, setData] = React.useState<T | null>(
    options.optimistic ? initial ?? null : null
  );
  const client = React.useRef(
    Storage.createClient(options.channel).register<T | null>(
      "__internal",
      (event) => {
        const { type, payload } = event.data.pluginMessage;
        if (payload.key !== options.key) return;

        switch (type) {
          case ResponseType.GET:
            setData(payload.value);
            break;
          default:
            return;
        }
      }
    )
  );

  const init = React.useCallback(
    (channel: string, key: string, optimistic?: boolean) => {
      client.current.unregister("__internal");
      client.current = Storage.createClient(channel).register<T | null>(
        "__internal",
        (event) => {
          const { type, payload } = event.data.pluginMessage;
          if (payload.key !== key) return;

          switch (type) {
            case ResponseType.GET:
              setData(payload.value);
              break;
            default:
              return;
          }
        },
        !optimistic ? [key] : null
      );
    },
    []
  );

  const set = React.useCallback(
    (value: T) => {
      if (options.optimistic) {
        setData(value);
      }
      client.current.requestSet(options.key, value, !options.optimistic);
    },
    [options.key, options.optimistic]
  );

  React.useEffect(() => {
    client.current.requestGet(options.key);
    return () => {
      init(options.channel, options.key, options.optimistic);
    };
  }, [options.channel, options.key, options.optimistic]);

  return [data, set];
};

export default usePersistedState;
