#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "=================================================="
echo "    Starting Smart-Weigh Management System       "
echo "=================================================="

# 0. Check root orchestrator dependencies
if [ ! -d "node_modules" ]; then
    echo "[Root] Installing root dependencies..."
    npm install
fi

# 1. Locate Python command
PYTHON_BIN=""
if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON_BIN="python"
elif command -v py >/dev/null 2>&1; then
    PYTHON_BIN="py -3"
else
    echo "[Error] Neither python3, python, nor py was found in PATH."
    echo "Please install Python 3.10+ and add it to your system PATH."
    exit 1
fi

# 2. Check/Setup Python backend virtual environment
VENV_DIR="backend/.venv"
if [ ! -d "$VENV_DIR" ]; then
    echo "[Backend] Creating Python virtual environment in $VENV_DIR..."
    if command -v uv >/dev/null 2>&1; then
        uv venv "$VENV_DIR"
    else
        $PYTHON_BIN -m venv "$VENV_DIR"
    fi
fi

# Determine virtualenv python executable (Windows vs Linux/macOS)
VENV_PYTHON=""
if [ -f "$VENV_DIR/Scripts/python.exe" ]; then
    VENV_PYTHON="$VENV_DIR/Scripts/python.exe"
elif [ -f "$VENV_DIR/Scripts/python" ]; then
    VENV_PYTHON="$VENV_DIR/Scripts/python"
elif [ -f "$VENV_DIR/bin/python" ]; then
    VENV_PYTHON="$VENV_DIR/bin/python"
elif [ -f "$VENV_DIR/bin/python3" ]; then
    VENV_PYTHON="$VENV_DIR/bin/python3"
else
    echo "[Backend] Virtual environment python not found in $VENV_DIR. Recreating..."
    rm -rf "$VENV_DIR"
    $PYTHON_BIN -m venv "$VENV_DIR"
    if [ -f "$VENV_DIR/Scripts/python.exe" ]; then
        VENV_PYTHON="$VENV_DIR/Scripts/python.exe"
    else
        VENV_PYTHON="$VENV_DIR/bin/python"
    fi
fi

# 3. Ensure backend Python dependencies are installed
echo "[Backend] Installing/Verifying Python requirements..."
if command -v uv >/dev/null 2>&1; then
    uv pip install -q -r backend/requirements.txt --python "$VENV_PYTHON" || "$VENV_PYTHON" -m pip install -q -r backend/requirements.txt
else
    "$VENV_PYTHON" -m pip install -q -r backend/requirements.txt
fi

# 4. Apply database migrations
echo "[Backend] Running database migrations..."
"$VENV_PYTHON" backend/manage.py migrate --noinput

# 5. Check frontend dependencies
if [ ! -d "frontend/node_modules" ]; then
    echo "[Frontend] Installing npm packages..."
    (cd frontend && npm install)
fi

# 6. Check and build Windows MSI setup if on Windows and not present
IS_WINDOWS=false
case "$(uname -s)" in
    CYGWIN*|MINGW*|MSYS*)
        IS_WINDOWS=true
        ;;
    Linux)
        # Check if running under WSL
        if grep -qi microsoft /proc/version 2>/dev/null; then
            IS_WINDOWS=true
        fi
        ;;
esac

if [ "$IS_WINDOWS" = true ]; then
    echo "[Windows] Checking for MSI installer package..."
    MSI_COUNT=$(find frontend/src-tauri/target/release/bundle/msi -maxdepth 1 -name "*.msi" 2>/dev/null | wc -l || echo "0")
    if [ "$MSI_COUNT" -eq 0 ]; then
        echo "[Windows] No MSI installer found in frontend/src-tauri/target/release/bundle/msi."
        if command -v cargo >/dev/null 2>&1; then
            echo "[Windows] Building MSI installer package with Tauri CLI..."
            (cd frontend && npm run tauri build -- --bundles msi) || {
                echo "[Windows] Note: MSI build failed or WiX tools not installed. Continuing to launch application..."
            }
        else
            echo "[Windows] Warning: Rust/Cargo is not installed in PATH. Cannot build MSI setup."
            echo "[Windows] Install Rust and WiX Toolset to compile the desktop installer."
        fi
    else
        echo "[Windows] Existing MSI installer found:"
        find frontend/src-tauri/target/release/bundle/msi -maxdepth 1 -name "*.msi" 2>/dev/null
    fi
fi

echo ""
echo "Starting Django API backend on :8000 and desktop/frontend app..."
echo "=================================================="

npm run dev
