#!/bin/bash
# deploy portfolio — GitHub Pages: push แล้วรอประมาณ 40 วิ + hard refresh
#   ./deploy.sh "ข้อความ commit"
set -e
cd "$(dirname "$0")"
# ตัวเลือกที่ขึ้นต้นด้วย - ไม่มีในสคริปต์นี้ — กันไม่ให้อาร์กิวเมนต์หลุดกลายเป็นข้อความ commit
# แล้ว deploy จริงโดยไม่ตั้งใจ (เคยพลาดมาแล้ว 2026-09-01)
case "${1:-}" in -*) echo "deploy: ไม่รู้จักตัวเลือก '$1' — รับได้แค่ข้อความ commit"; exit 2 ;; esac

MSG="${1:-update $(date +%Y-%m-%d_%H:%M)}"

git fetch -q origin && git status -sb | head -1     # กันกรณี local ตามหลัง origin โดยไม่รู้ตัว

~/dev/tools/buildstamp/stamp.sh portfolio

if [ -n "$(git status --porcelain)" ]; then git add -A; git commit -q -m "$MSG"; fi
git push
echo "✅ https://legendarytemplar9-boop.github.io/$(basename $(git remote get-url origin) .git)/  $(~/dev/tools/buildstamp/stamp.sh portfolio --show)"
