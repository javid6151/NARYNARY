// Starts one Vite dev server per portal, in sequence: platform 1000 → owner 2000 → manager 3000
// → kitchen 4000 → resident 5000. Each server waits for the previous one to be ready.
// Ctrl+C stops them all. Ports are defined in src/lib/portals.ts (keep both in sync).
import { spawn, spawnSync } from 'node:child_process';

/** Stops a server and its child processes (on Windows, killing the shell alone leaves Vite running). */
const killTree = (c) => {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(c.pid), '/T', '/F'], { stdio: 'ignore' });
  else c.kill();
};

const PORTALS = [
  ['platform', 1000, '/platform'],
  ['owner', 2000, '/app'],
  ['manager', 3000, '/app'],
  ['kitchen', 4000, '/kitchen'],
  ['resident', 5000, '/resident'],
];

const children = [];
const failed = [];
const stopAll = () => { for (const c of children) killTree(c); process.exit(0); };
process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);

/** True once a Vite server answers on the port (checks a Vite-only URL so another program on the port doesn't count). */
async function waitUntilUp(port, child) {
  for (let i = 0; i < 60; i++) {
    if (child.exitCode !== null) return false;
    try {
      const r = await fetch(`http://localhost:${port}/@vite/client`);
      if (r.ok) return true;
    } catch { /* not listening yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

for (const [id, port, path] of PORTALS) {
  const child = spawn(`npx vite --port ${port} --strictPort`, {
    env: { ...process.env, VITE_PORTAL: id },
    stdio: ['ignore', 'ignore', 'inherit'],
    shell: true,
  });
  children.push(child);
  if (!(await waitUntilUp(port, child))) {
    console.error(`${id} portal did not start on port ${port} — another program is probably using that port.`);
    failed.push(port);
    continue;
  }
  console.log(`${id.padEnd(9)} http://localhost:${port}${path}`);
}
console.log(failed.length ? `Running, except port(s) ${failed.join(', ')}. Press Ctrl+C to stop.` : 'All portals running. Press Ctrl+C to stop.');
