import * as React from "react";

import { Fetch, TypedFetchResponse } from "../../../src";

const client = Fetch.createClient("c1").enable();

type Data = {
  name: string;
  bool: boolean;
};

const FetchExample = () => {
  const [url, setUrl] = React.useState<string>("https://httpbin.org/get");
  const [res, setRes] = React.useState<TypedFetchResponse<unknown> | null>(
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
