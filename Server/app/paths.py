"""Пути для режима разработки и сборки PyInstaller (frozen)."""
from __future__ import annotations

import sys
from pathlib import Path


def is_frozen() -> bool:
    return bool(getattr(sys, "frozen", False))


def app_root() -> Path:
    """Корень проекта в dev; каталог с .exe при frozen."""
    if is_frozen():
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent.parent


def bundle_dir() -> Path:
    """Распакованные ресурсы внутри exe (_MEIPASS) или корень проекта."""
    if is_frozen():
        return Path(getattr(sys, "_MEIPASS"))
    return app_root()


def resource_path(*parts: str) -> Path:
    return bundle_dir().joinpath(*parts)


APP_ROOT = app_root()
DATA_DIR = APP_ROOT / "data"
EXAMPLE_CONFIG = (
    resource_path("config.example.yaml")
    if is_frozen()
    else APP_ROOT / "config.example.yaml"
)

# Обратная совместимость с существующим кодом
ROOT_DIR = APP_ROOT
DEFAULT_DATA_DIR = DATA_DIR
