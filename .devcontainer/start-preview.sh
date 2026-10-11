#!/usr/bin/env bash
set -euo pipefail
if node -e 'const s=require("net").connect(3000,"127.0.0.1"); s.on("connect",()=>{s.end();process.exit(0)});s.on("error",()=>process.exit(1))'; then
  exit 0
fi
nohup bun run dev >/tmp/quran-vajeh-preview.log 2>&1 </dev/null &
