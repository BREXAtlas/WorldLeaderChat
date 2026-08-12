#!/usr/bin/env bash
set -euo pipefail

cache_dir="${RUNNER_TOOL_CACHE:-${HOME}/.cache}/world-leader-chat-writer"
llama_dir="${cache_dir}/llama"
model_path="${cache_dir}/qwen2.5-3b-instruct-q4_k_m.gguf"
mkdir -p "${llama_dir}"

if [[ ! -x "${llama_dir}/llama-server" ]]; then
  archive_url="https://github.com/ggml-org/llama.cpp/releases/download/b10375/llama-b10375-bin-ubuntu-x64.tar.gz"
  curl --fail --show-error --location --retry 5 --retry-delay 2 --retry-all-errors \
    "${archive_url}" --output "${cache_dir}/llama.tar.gz"
  echo "b6a7ed005240eccd61e1af42debd75b876c639c1416bfa90985fd02618919a88  ${cache_dir}/llama.tar.gz" | sha256sum --check
  tar -xzf "${cache_dir}/llama.tar.gz" --strip-components=1 -C "${llama_dir}"
  rm -f "${cache_dir}/llama.tar.gz"
fi

if [[ ! -s "${model_path}" ]]; then
  curl --fail --show-error --location --retry 5 --retry-delay 2 --retry-all-errors \
    "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf" \
    --output "${model_path}"
  echo "626b4a6678b86442240e33df819e00132d3ba7dddfe1cdc4fbb18e0a9615c62d  ${model_path}" | sha256sum --check
fi

nohup "${llama_dir}/llama-server" \
  --model "${model_path}" \
  --host 127.0.0.1 \
  --port 8080 \
  --ctx-size 8192 \
  --parallel 1 \
  --threads "$(nproc)" \
  --jinja \
  --no-webui \
  > "${RUNNER_TEMP:-/tmp}/wlc-llama-server.log" 2>&1 &

for _ in $(seq 1 120); do
  if curl --fail --silent http://127.0.0.1:8080/health >/dev/null; then
    echo "WLC_WRITER_ENDPOINT=http://127.0.0.1:8080/v1/chat/completions" >> "${GITHUB_ENV}"
    echo "Local newsroom writer is ready."
    exit 0
  fi
  sleep 1
done

tail -n 100 "${RUNNER_TEMP:-/tmp}/wlc-llama-server.log" || true
echo "Local newsroom writer did not become healthy." >&2
exit 1
