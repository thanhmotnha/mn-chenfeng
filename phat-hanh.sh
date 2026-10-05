#!/usr/bin/env bash
# Phát hành bản mới lên kênh tự cập nhật:  ./phat-hanh.sh "ghi chú ngắn"
# Dựng dist/ → chạy phép thử → commit → đẩy lên nhánh main. Sau ~5 phút các máy F5 trang Chenfeng là có bản mới.
set -euo pipefail
cd "$(dirname "$0")"
node build.js
node test/core.test.js | tail -1
node test/dich.test.js | tail -1
node test/phong.test.js | tail -1
node test/kiem.test.js | tail -1
node test/mau.test.js | tail -1
if node -e "require('playwright')" 2>/dev/null; then
  for t in chuanhoa ui phong-ui ext nap kho doloi mau-ui xuatvan sx nk; do node test/$t.test.js | tail -1; done
else
  echo "(bỏ qua phép thử cần trình duyệt: chưa có playwright — đặt NODE_PATH / PLAYWRIGHT_BROWSERS_PATH rồi chạy lại nếu sửa giao diện / bộ nạp)"
fi
V=$(node -p "require('./src/mncf-core.js').VERSION")
git add -A
git commit -m "v$V${1:+ — $1}"
git push origin HEAD:main
echo "Đã đẩy v$V. Kiểm: https://raw.githubusercontent.com/thanhmotnha/mn-chenfeng/main/dist/phien-ban.json"
