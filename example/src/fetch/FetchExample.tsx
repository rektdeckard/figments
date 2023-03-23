import * as React from "react";

import { Fetch, FetchResponseUnwrapped } from "../../../src";

const client = Fetch.createClient().enable();

const FetchExample = () => {
  const [url, setUrl] = React.useState<string>("https://httpbin.org/get");
  const [res, setRes] = React.useState<FetchResponseUnwrapped<unknown> | null>(
    null
  );

  return (
    <div>
      <h3>Fetch</h3>
      <div className="row">
        <div className="row-part">
          <label htmlFor="url">
            URL
            <input
              name="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
        </div>
        <div className="row-part">
          <button
            onClick={async () => {
              const res = await client.fetch(url);
              setRes(res);
            }}
          >
            GET
          </button>
          <button
            onClick={async () => {
              const res = await client.fetch(url, {
                method: "PUT",
              });
              setRes(res);
            }}
          >
            PUT
          </button>
          <button
            onClick={async () => {
              const res = await client.fetch(url, {
                method: "POST",
                headers: {
                  Accept: "application/json",
                  Cookie: "baz=0; qux=1",
                },
                body: JSON.stringify({ foo: 42, bar: false }),
              });
              setRes(res);
            }}
          >
            POST
          </button>
          <button
            onClick={async () => {
              const res = await client.fetch(url, {
                method: "DELETE",
              });
              setRes(res);
            }}
          >
            DELETE
          </button>
        </div>
      </div>
      <pre>
        {JSON.stringify(
          res
            ? {
                type: res.type,
                ok: res.ok,
                status: res.status,
                statusText: res.statusText,
                data: res.data,
              }
            : null,
          null,
          2
        )}
      </pre>
    </div>
  );
};

export default FetchExample;
