const { spawn } = require('child_process');
const path = require('path');

const isWin = process.platform === 'win32';
const frontendDir = path.resolve(__dirname, '..', 'frontend');

// Check if cargo is available for Tauri desktop window
function isCargoAvailable() {
  try {
    const res = require('child_process').spawnSync(isWin ? 'cargo.exe' : 'cargo', ['--version'], { stdio: 'ignore', shell: isWin });
    return res.status === 0;
  } catch (e) {
    return false;
  }
}

const hasCargo = isCargoAvailable();
const npmCmd = isWin ? 'npm.cmd' : 'npm';

if (hasCargo) {
  console.log('[Frontend] Cargo/Rust detected. Starting Tauri desktop application...');
  const proc = spawn(npmCmd, ['run', 'tauri', 'dev'], {
    cwd: frontendDir,
    stdio: 'inherit',
    shell: isWin,
  });
  proc.on('close', (code) => process.exit(code || 0));
} else {
  console.log('================================================================');
  console.log('[Frontend] Rust/Cargo not found in PATH.');
  console.log('[Frontend] Falling back to Web Browser Mode (Next.js dev server)');
  console.log('[Frontend] You can view the app at: http://localhost:3000');
  console.log('================================================================');
  const proc = spawn(npmCmd, ['run', 'dev'], {
    cwd: frontendDir,
    stdio: 'inherit',
    shell: isWin,
  });
  proc.on('close', (code) => process.exit(code || 0));
}
