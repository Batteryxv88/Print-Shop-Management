#!/usr/bin/env bash
# Поднять тот же Appwrite 1.7.4, что на ноутбуке с Print Shop.
# Compose уже с Traefik 3.6: так стек работает на Docker 29.
#
#   ./scripts/install-ubuntu.sh --domain localhost
#   ./scripts/install-ubuntu.sh --domain appwrite.example.com --dir "$HOME/appwrite"
#
# Если TLS обрывается на туннеле или прокси до Traefik, оставьте
# _APP_OPTIONS_FORCE_HTTPS=disabled. Иначе Appwrite 1.7.4 отвечает 301 на самого себя.
set -euo pipefail

DOMAIN=""
TARGET_DIR="${HOME}/appwrite-install/runtime"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)
      DOMAIN="${2:-}"
      shift 2
      ;;
    --dir)
      TARGET_DIR="${2:-}"
      shift 2
      ;;
    *)
      echo "Неизвестный аргумент: $1" >&2
      echo "Использование: $0 --domain HOST [--dir DIR]" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$DOMAIN" || -z "$TARGET_DIR" ]]; then
  echo "Использование: $0 --domain HOST [--dir DIR]" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Нужен Docker. На Ubuntu: https://docs.docker.com/engine/install/ubuntu/" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$TARGET_DIR"
cp "$ROOT/docker/docker-compose.yml" "$TARGET_DIR/docker-compose.yml"

python3 - "$ROOT/docker/.env.example" "$TARGET_DIR/.env" "$DOMAIN" <<'PY'
import secrets
import sys
from pathlib import Path

example, target, domain = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
generated = {
    "CHANGE_ME_OPENSSL": secrets.token_hex(32),
    "CHANGE_ME_EXECUTOR": secrets.token_hex(32),
    "CHANGE_ME_DB_PASS": secrets.token_hex(16),
    "CHANGE_ME_DB_ROOT": secrets.token_hex(16),
}

if target.exists():
    lines = target.read_text().splitlines()
    out = []
    for line in lines:
        if line.startswith("_APP_DOMAIN=") or line.startswith("_APP_DOMAIN_TARGET="):
            key = line.split("=", 1)[0]
            out.append(f"{key}={domain}")
        else:
            out.append(line)
    target.write_text("\n".join(out) + "\n")
    print(f".env уже был, обновлён только домен: {domain}")
else:
    text = example.read_text()
    for placeholder, value in generated.items():
        text = text.replace(placeholder, value)
    text = text.replace("_APP_DOMAIN=localhost", f"_APP_DOMAIN={domain}", 1)
    text = text.replace("_APP_DOMAIN_TARGET=localhost", f"_APP_DOMAIN_TARGET={domain}", 1)
    target.write_text(text)
    target.chmod(0o600)
    print(f"Создан {target}")
PY

docker compose -p appwrite --project-directory "$TARGET_DIR" up -d
echo "Консоль: http://${DOMAIN}/console"
echo "Проверка: curl -H \"Host: ${DOMAIN}\" http://127.0.0.1/v1/health/version"
