import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

interface PingEvent {
  timestamp: number;
  sizeBytes: number;
  status: number;
  ok: boolean;
}

interface Target {
  id: string;
  url: string;
  interval: number; // in minutes
  lastPing: string | null;
  status: 'pending' | 'success' | 'error';
  statusCode: number | null;
  history: PingEvent[];
}

let targets: Target[] = [];

const DATA_FILE = path.join(process.cwd(), 'targets_data.json');

// Load initial data
if (fs.existsSync(DATA_FILE)) {
  try {
    targets = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch(e) {
    console.error("Could not load data", e);
  }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(targets, null, 2));
  } catch(e) {
    console.error("Could not save data", e);
  }
}

async function performPing(target: Target) {
  try {
    const res = await fetch(target.url);
    const buffer = await res.arrayBuffer();
    const sizeBytes = buffer.byteLength;
    
    target.lastPing = new Date().toISOString();
    target.status = res.ok ? 'success' : 'error';
    target.statusCode = res.status;
    
    target.history.unshift({
      timestamp: Date.now(),
      sizeBytes,
      status: res.status,
      ok: res.ok
    });
    
    // Keep max 10000 events to prevent memory leak
    if (target.history.length > 10000) {
      target.history = target.history.slice(0, 10000);
    }
    
    saveData();
    console.log(`Pinged ${target.url} - Status: ${res.status} - Size: ${sizeBytes} bytes`);
  } catch (error) {
    target.lastPing = new Date().toISOString();
    target.status = 'error';
    target.statusCode = null;
    
    target.history.unshift({
      timestamp: Date.now(),
      sizeBytes: 0,
      status: 0,
      ok: false
    });
    
    if (target.history.length > 10000) {
      target.history = target.history.slice(0, 10000);
    }
    
    saveData();
    console.error(`Failed to ping ${target.url}`);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // Background pinger - checks every 1 minute
  // For each target, if we haven't pinged in 3 minutes, ping it
  setInterval(async () => {
    const now = new Date();
    for (const target of targets) {
      const lastPingDate = target.lastPing ? new Date(target.lastPing) : null;
      // Ping if never pinged, or if the specified interval has passed
      if (!lastPingDate || (now.getTime() - lastPingDate.getTime()) >= (target.interval * 60000)) {
        await performPing(target);
      }
    }
  }, 60 * 1000); // Check every minute

  // API Routes
  app.get('/api/targets', (req, res) => {
    res.json(targets);
  });

  app.post('/api/targets', (req, res) => {
    const { url, interval = 3 } = req.body;
    if (!url) {
       res.status(400).json({ error: 'URL is required' });
       return;
    }
    
    // Check if exists
    if (targets.some(t => t.url === url)) {
       res.status(400).json({ error: 'URL already exists' });
       return;
    }
    
    const newTarget: Target = {
      id: Math.random().toString(36).substring(7),
      url,
      interval: Number(interval),
      lastPing: null,
      status: 'pending',
      statusCode: null,
      history: []
    };
    targets.push(newTarget);
    saveData();
    
    // Initial ping
    performPing(newTarget);

    res.json(newTarget);
  });

  app.delete('/api/targets/:id', (req, res) => {
    targets = targets.filter(t => t.id !== req.params.id);
    saveData();
    res.json({ success: true });
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
