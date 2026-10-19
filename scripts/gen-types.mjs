// Regenerates src/lib/database.types.ts from the local Supabase database.
// Run after every migration (`npm run db:types`). The file is only replaced when generation
// succeeds, so a stopped Docker/Supabase stack can't overwrite it with an error message.
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const OUT = 'src/lib/database.types.ts';

let types;
try {
  types = execSync('npx supabase gen types typescript --local', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch (e) {
  console.error('Type generation failed (is `npm run db:start` running?).\n' + (e.stderr || e.message));
  process.exit(1);
}
if (!types.includes('export type Database')) {
  console.error('Unexpected generator output; ' + OUT + ' was not changed.\n' + types.slice(0, 500));
  process.exit(1);
}
writeFileSync(OUT, types);
console.log('Wrote ' + OUT);
