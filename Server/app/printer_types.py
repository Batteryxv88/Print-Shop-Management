"""Тип принтера по цветности (задаётся вручную при добавлении)."""

COLOR_MODE_MONO = "mono"
COLOR_MODE_COLOR = "color"
COLOR_MODE_COLOR_EXTRA = "color_extra"

COLOR_MODE_CHOICES: list[tuple[str, str]] = [
    (COLOR_MODE_MONO, "Ч/Б"),
    (COLOR_MODE_COLOR, "Цвет"),
    (COLOR_MODE_COLOR_EXTRA, "Цвет + доп. станция"),
]

COLOR_MODE_LABELS = dict(COLOR_MODE_CHOICES)


def normalize_color_mode(value: str | None) -> str:
    if value in COLOR_MODE_LABELS:
        return value
    return COLOR_MODE_MONO
