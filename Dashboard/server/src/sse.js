/**
 * Server-Sent Events fan-out.
 *
 * SSE rather than WebSocket because the dashboard only needs one-way push and
 * SSE reconnects on its own, survives proxies, and needs no extra dependency
 * beyond the built-in http module.
 */
export class SseHub {
  #clients = new Set();

  addClient(req, res, hello) {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'access-control-allow-origin': '*',
      'x-accel-buffering': 'no',
    });

    // Tell the browser how long to wait before reconnecting.
    res.write('retry: 2000\n\n');
    res.write(`event: hello\ndata: ${JSON.stringify(hello)}\n\n`);

    this.#clients.add(res);
    this.#write(res, 'peers', { clients: this.#clients.size });

    const drop = () => {
      if (this.#clients.delete(res)) this.#write(res, 'peers', { clients: this.#clients.size });
    };

    req.on('close', drop);
    req.on('error', drop);
    res.on('error', drop);

    return res;
  }

  #write(res, event, data) {
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      this.#clients.delete(res);
    }
  }

  broadcast(event, data) {
    for (const res of this.#clients) this.#write(res, event, data);
  }

  /** Comment-only frame; keeps proxies and browsers from closing an idle stream. */
  heartbeat() {
    for (const res of this.#clients) {
      try {
        res.write(': ping\n\n');
      } catch {
        this.#clients.delete(res);
      }
    }
  }

  get size() {
    return this.#clients.size;
  }

  closeAll() {
    for (const res of this.#clients) {
      try {
        res.end();
      } catch {
        /* client already gone */
      }
    }
    this.#clients.clear();
  }
}