const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const isWin = process.platform === 'win32';
const backendDir = path.resolve(__dirname, '..', 'backend');

// Find virtualenv python binary
function getPythonCommand() {
  const venvWin = path.join(backendDir, '.venv', 'Scripts', 'python.exe');
  const venvNix = path.join(backendDir, '.venv', 'bin', 'python');

  if (fs.existsSync(venvWin)) return venvWin;
  if (fs.existsSync(venvNix)) return venvNix;

  // Fallback to system python launcher or python
  return isWin ? 'python' : 'python3';
}

const pythonBin = getPythonCommand();
console.log(`[Backend] Using Python binary: ${pythonBin}`);

// Ensure default admin credentials exist
try {
  const ensureAdmin = require('child_process').spawnSync(pythonBin, ['ensure_admin.py'], {
    cwd: backendDir,
    stdio: 'inherit',
    shell: isWin,
  });
} catch (e) {
  // Continue even if error
}

const args = ['manage.py', 'runserver', '0.0.0.0:8000'];
const proc = spawn(pythonBin, args, {
  cwd: backendDir,
  stdio: 'inherit',
  shell: isWin,
});

proc.on('error', (err) => {
  console.error('[Backend] Failed to start server:', err);
  process.exit(1);
});

proc.on('close', (code) => {
  process.exit(code || 0);
});
