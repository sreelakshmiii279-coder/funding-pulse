// Starts `next dev` from this project's folder regardless of the caller's working directory.
// --use-system-ca: trust the Windows certificate store (needed when a local proxy/antivirus re-signs TLS).
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const port = process.argv[2] ?? '3000';
const child = spawn(process.execPath, ['--use-system-ca', path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '-p', port], { stdio: 'inherit', env: process.env });
child.on('exit', (code) => process.exit(code ?? 0));
