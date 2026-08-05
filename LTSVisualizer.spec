# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path

from PyInstaller.utils.hooks import collect_submodules


PROJECT_ROOT = Path(SPECPATH)
BACKEND_DIR = PROJECT_ROOT / "backend"
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"
SAMPLE_DATA = PROJECT_ROOT / "sample-data"


if not FRONTEND_DIST.exists():
    raise FileNotFoundError(
        "The frontend production build was not found. "
        "Run 'npm run build' in the frontend directory first."
    )


datas = [
    (
        str(FRONTEND_DIST),
        "frontend/dist",
    ),
]

example_file = SAMPLE_DATA / "example.puml"

if example_file.exists():
    datas.append(
        (
            str(example_file),
            "sample-data",
        )
    )


hidden_imports = (
    collect_submodules("uvicorn")
    + collect_submodules("multipart")
)


analysis = Analysis(
    [str(BACKEND_DIR / "launcher.py")],
    pathex=[str(BACKEND_DIR)],
    binaries=[],
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)


python_archive = PYZ(analysis.pure)


executable = EXE(
    python_archive,
    analysis.scripts,
    [],
    exclude_binaries=True,
    name="LTSVisualizer",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)


application = COLLECT(
    executable,
    analysis.binaries,
    analysis.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="LTSVisualizer",
)
