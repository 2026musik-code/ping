export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // 1. Intercept API routes
    if (url.pathname.startsWith("/api/")) {
      return this.handleApi(request, env, ctx);
    }

    // 2. Serve SPA fallback (index.html) for non-API routes
    // When using standard Workers with [assets], static files are served BEFORE the worker automatically.
    // If a request reaches here and it's not an API route, it's likely a SPA route (e.g. /dashboard).
    if (env.ASSETS) {
      return env.ASSETS.fetch(new Request(new URL("/", request.url), request));
    }
    
    return new Response("Not Found", { status: 404 });
  },

  async handleApi(request, env, ctx) {
    const url = new URL(request.url);
    
    // Safety check in case KV is not bound
    if (!env.vles_kv) {
      return new Response(JSON.stringify({ error: "KV Namespace 'vles_kv' is not bound. Please configure it in your Cloudflare dashboard." }), { 
        status: 500, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    try {
      if (url.pathname === "/api/targets") {
        if (request.method === "GET") {
          const targetsStr = await env.vles_kv.get("targets");
          const targets = targetsStr ? JSON.parse(targetsStr) : [];
          return new Response(JSON.stringify(targets), { 
            headers: { "Content-Type": "application/json" } 
          });
        }

        if (request.method === "POST") {
          const { url: targetUrl, interval = 3 } = await request.json();
          const targetsStr = await env.vles_kv.get("targets");
          const targets = targetsStr ? JSON.parse(targetsStr) : [];
          
          if (targets.some(t => t.url === targetUrl)) {
            return new Response(JSON.stringify({ error: "URL already exists" }), { 
              status: 400, headers: { "Content-Type": "application/json" } 
            });
          }
          
          
          const newTarget = {
            id: crypto.randomUUID(),
            url: targetUrl,
            interval: Number(interval),
            lastPing: null,
            status: 'pending',
            statusCode: null,
            history: []
          };
          
          targets.push(newTarget);
          await env.vles_kv.put("targets", JSON.stringify(targets));
          
          // Lakukan initial ping secara async
          if (ctx && ctx.waitUntil) {
            ctx.waitUntil((async () => {
              try {
                const res = await fetch(targetUrl, {
                  headers: { 'User-Agent': 'Nexus-Pinger-Cloudflare-Worker' }
                });
                const arrayBuffer = await res.arrayBuffer();
                const sizeBytes = arrayBuffer.byteLength;
                
                newTarget.lastPing = new Date().toISOString();
                newTarget.status = res.ok ? 'success' : 'error';
                newTarget.statusCode = res.status;
                newTarget.history.unshift({
                  timestamp: Date.now(),
                  sizeBytes,
                  status: res.status,
                  ok: res.ok
                });
              } catch (err) {
                newTarget.lastPing = new Date().toISOString();
                newTarget.status = 'error';
                newTarget.statusCode = null;
                newTarget.history.unshift({
                  timestamp: Date.now(),
                  sizeBytes: 0,
                  status: 0,
                  ok: false
                });
              }
              // save again
              const currentStr = await env.vles_kv.get("targets");
              if (currentStr) {
                const currentTargets = JSON.parse(currentStr);
                const idx = currentTargets.findIndex(t => t.id === newTarget.id);
                if (idx !== -1) {
                  currentTargets[idx] = newTarget;
                  await env.vles_kv.put("targets", JSON.stringify(currentTargets));
                }
              }
            })());
          }
          
          return new Response(JSON.stringify(newTarget), { 
            headers: { "Content-Type": "application/json" } 
          });

        }
      }

      if (url.pathname.startsWith("/api/targets/") && request.method === "DELETE") {
        const id = url.pathname.split("/").pop();
        const targetsStr = await env.vles_kv.get("targets");
        let targets = targetsStr ? JSON.parse(targetsStr) : [];
        targets = targets.filter(t => t.id !== id);
        await env.vles_kv.put("targets", JSON.stringify(targets));
        
        return new Response(JSON.stringify({ success: true }), { 
          headers: { "Content-Type": "application/json" } 
        });
      }

      return new Response("API route not found", { status: 404 });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { 
        status: 500, headers: { "Content-Type": "application/json" } 
      });
    }
  },

  async scheduled(event, env, ctx) {
    if (!env.vles_kv) {
      console.error("KV Namespace 'vles_kv' is not bound.");
      return;
    }

    const targetsStr = await env.vles_kv.get("targets");
    if (!targetsStr) return;
    
    const targets = JSON.parse(targetsStr);
    const now = Date.now();
    let updated = false;

    // Ping concurrently
    const pingPromises = targets.map(async (target) => {
      const lastPingTime = target.lastPing ? new Date(target.lastPing).getTime() : 0;
      const intervalMs = target.interval * 60000;
      
      if (!lastPingTime || (now - lastPingTime) >= intervalMs) {
        try {
          const res = await fetch(target.url, {
            headers: { 'User-Agent': 'Nexus-Pinger-Cloudflare-Worker' }
          });
          const arrayBuffer = await res.arrayBuffer();
          const sizeBytes = arrayBuffer.byteLength;
          
          target.lastPing = new Date().toISOString();
          target.status = res.ok ? 'success' : 'error';
          target.statusCode = res.status;
          
          target.history.unshift({
            timestamp: Date.now(),
            sizeBytes,
            status: res.status,
            ok: res.ok
          });
        } catch (err) {
          target.lastPing = new Date().toISOString();
          target.status = 'error';
          target.statusCode = null;
          target.history.unshift({
            timestamp: Date.now(),
            sizeBytes: 0,
            status: 0,
            ok: false
          });
        }
        
        if (target.history.length > 5000) {
          target.history = target.history.slice(0, 5000); // 5000 events limit per target to avoid hitting KV 25MB limit
        }
        updated = true;
      }
    });

    await Promise.allSettled(pingPromises);
    
    if (updated) {
      await env.vles_kv.put("targets", JSON.stringify(targets));
    }
  }
};
