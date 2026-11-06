# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all, collect_submodules

block_cipher = None

_ctk_datas, _ctk_binaries, _ctk_hiddenimports = collect_all("customtkinter")
_pysnmp_hidden = collect_submodules("pysnmp")

a = Analysis(
    ["run.py"],
    pathex=[],
    binaries=_ctk_binaries,
    datas=[
        ("app/snmp/profiles", "app/snmp/profiles"),
        ("app/snmp/formulas", "app/snmp/formulas"),
        ("config.example.yaml", "."),
    ]
    + _ctk_datas,
    hiddenimports=[
        "app",
        "app.gui",
        "app.gui.app",
        "app.gui.views.printers_view",
        "app.gui.views.schedule_view",
        "app.gui.views.history_view",
        "app.gui.views.settings_view",
        "app.gui.views.sync_view",
        "pysnmp.hlapi.asyncio",
        "firebase_admin",
        "google.cloud.firestore",
        "google.cloud.firestore_v1",
        "grpc",
    ]
    + _pysnmp_hidden
    + _ctk_hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="PrinterCounterCollector",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="PrinterCounterCollector",
)
