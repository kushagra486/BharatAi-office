// Minimal Electron shell: starts the daemon + frontend as plain `npm start`
// child processes (same commands you'd run by hand — see README.md), waits
// for the frontend to answer, then shows it in a native window. No
// installer/auto-update tooling here on purpose — this is Phase 7's "wrap
// it in Electron", kept as simple as the job needs.
const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FRONTEND_URL = 'http://localhost:3000';

// Chromium refuses to sandbox when running as root (common in containers/CI,
// not on a real user's desktop) — only drop the sandbox in that specific
// case, so normal installs keep it.
if (process.platform === 'linux' && process.getuid?.() === 0) {
  app.commandLine.appendSwitch('no-sandbox');
}

let daemonProcess;
let frontendProcess;

function startWorkspace(workspace) {
  return spawn('npm', ['run', 'start', '--workspace', workspace], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true, // `shell: true` so this also works on Windows, where npm is npm.cmd
  });
}

function waitForFrontend(onReady) {
  http
    .get(FRONTEND_URL, () => onReady())
    .on('error', () => setTimeout(() => waitForFrontend(onReady), 500));
}

app.whenReady().then(() => {
  daemonProcess = startWorkspace('daemon');
  frontendProcess = startWorkspace('frontend');

  const win = new BrowserWindow({ width: 1440, height: 900, title: 'Bharat AI Office' });
  win.loadURL('data:text/html,<body style="font-family:sans-serif;padding:40px;background:#0e141c;color:#e6e9ef">Starting Bharat AI Office…</body>');
  waitForFrontend(() => win.loadURL(FRONTEND_URL));
});

app.on('window-all-closed', () => {
  daemonProcess?.kill();
  frontendProcess?.kill();
  app.quit();
});
