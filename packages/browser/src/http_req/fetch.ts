//import fetch from 'cross-fetch';
import Promise from 'promise-polyfill';
import { errors, IHttpRequest, IHttpResponse } from './api';

let rateLimitReset = 0;

export function request(req: IHttpRequest): Promise<IHttpResponse> {
  let utime = Date.now() / 1000;
  if (utime < rateLimitReset) {
    return Promise.reject(errors.ipRateLimited);
  }

  let opt = {
    method: req.method,
    body: req.body,
  };
  return fetch(req.url, {method: opt.method, body: opt.body}).then((resp: Response) => {
    if (resp.status === 401) {
      throw errors.unauthorized;
    }

    if (resp.status === 429) {
      let s = resp.headers.get('X-RateLimit-Delay');
      if (!s) {
        throw errors.ipRateLimited;
      }

      let n = parseInt(s, 10);
      if (n > 0) {
        rateLimitReset = Date.now() / 1000 + n;
      }

      throw errors.ipRateLimited;
    }

    if (resp.status === 204) {
      return { json: null };
    }
    if (resp.status === 404) {
      throw new Error('404 Not Found');
    }

    if (resp.status >= 200 && resp.status < 300) {
      return resp.json().then((json) => {
        return { json };
      });
    }

    if (resp.status >= 400 && resp.status < 500) {
      return resp.json().then((json) => {
        let err = new Error(json.message);
        throw err;
      });
    }

    return resp.text().then((body) => {
      let err = new Error(
        `airbrake: fetch: unexpected response: code=${resp.status} body='${body}'`
      );
      throw err;
    });
  });
}
