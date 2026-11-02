// Minimal Chrome DevTools Protocol client (Node >= 22 has global WebSocket).

export async function listTargets(host, port) {
  const res = await fetch(`http://${host}:${port}/json/list`);
  if (!res.ok) throw new Error(`CDP /json/list: HTTP ${res.status}`);
  return (await res.json()).filter((t) => t.type === 'page');
}

export async function getVersion(host, port) {
  const res = await fetch(`http://${host}:${port}/json/version`);
  return res.ok ? res.json() : {};
}

export function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
    };
    ws.onerror = () => reject(new Error(`cannot open ${wsUrl}`));
    ws.onopen = () =>
      resolve({
        send(method, params = {}) {
          return new Promise((res, rej) => {
            pending.set(++id, { resolve: res, reject: rej });
            ws.send(JSON.stringify({ id, method, params }));
          });
        },
        async evaluate(expression) {
          const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
          if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'evaluate failed');
          return r.result.value;
        },
        close: () => ws.close(),
      });
  });
}
