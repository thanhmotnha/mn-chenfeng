# Một Nhà · Vẽ tủ vào Chenfeng

Tiện ích Chrome cho [Chenfeng WebCAD](https://cfcad.cn): nhập thông số tủ, kéo chia đợt trên hình, đặt ngăn kéo / suốt treo → bảng tự dựng tủ vào bản vẽ Chenfeng theo chuẩn kết cấu xưởng Một Nhà, Chenfeng tự khoan lỗ. Cần có tài khoản Chenfeng; tiện ích chỉ chạy trên trang `cfcad.cn`, không gửi dữ liệu đi đâu.

## Cài (mỗi máy một lần)

1. Tải **[mn-chenfeng-tien-ich.zip](https://github.com/thanhmotnha/mn-chenfeng/raw/main/tai-ve/mn-chenfeng-tien-ich.zip)**, giải nén ra một thư mục cố định (vd `D:\MOTNHA\mn-chenfeng`).
2. Chrome → `chrome://extensions` → bật **Developer mode** → **Load unpacked** → chọn thư mục vừa giải nén.
3. Mở https://cfcad.cn, đăng nhập, mở bản vẽ → nút **Một Nhà · Vẽ tủ** ở góc dưới bên phải.

Dùng Tampermonkey thay cho tiện ích: cài [mn-chenfeng.user.js](https://raw.githubusercontent.com/thanhmotnha/mn-chenfeng/main/dist/mn-chenfeng.user.js) (Tampermonkey tự cập nhật theo lịch của nó).

## Tự cập nhật

Tiện ích là một **bộ nạp** (`src/mncf-nap.js`). Mỗi lần mở / tải lại trang Chenfeng nó:

1. hỏi `dist/phien-ban.json` trên kho này (phiên bản + mã kiểm SHA-256);
2. mã kiểm khác bản đang cất trong máy → tải `dist/mn-chenfeng.js`, **đối chiếu mã kiểm** rồi mới chạy và cất lại;
3. không vào được GitHub → thử jsDelivr → chạy bản đã cất → chạy bản kèm sẵn trong tiện ích.

Vì vậy có bản mới chỉ cần **F5** trang Chenfeng (GitHub giữ bản đệm khoảng 5 phút). Xem bản đang chạy: bảng Một Nhà → thẻ **Hướng dẫn** → **Cập nhật tự động**.

> Ai ghi được vào nhánh `main` của kho này thì chạy được mã trong phiên Chenfeng của các máy đã cài. Chỉ cấp quyền ghi cho người tin cậy.

## Phát triển

```bash
node build.js                 # dựng dist/ (bản gộp, phien-ban.json, userscript, tiện ích, trang HTML)
node test/core.test.js        # lõi kết cấu — không cần thư viện
node test/dich.test.js        # bảng dịch ghi chú tham số
node test/phong.test.js       # thẻ Phòng
node test/kiem.test.js        # dò lỗi sản xuất: quy tắc thiết kế + tấm và lỗ khoan thật (hàm thuần)
node test/mau.test.js         # đổ màu: chia tấm của tủ thành nhóm thùng / cánh + phào / hậu, lọc màu (hàm thuần)
# các bộ cần Playwright + Chromium: chuanhoa, ui, phong-ui, ext, nap, kho, doloi, mau-ui
NODE_PATH=<node_modules> PLAYWRIGHT_BROWSERS_PATH=<trình duyệt> node test/nap.test.js
./phat-hanh.sh "ghi chú"      # dựng + thử + commit + đẩy lên main → các máy tự nhận
```

- `src/mncf-core.js` — lõi: thông số tủ → danh sách tấm, kiểm tra, bảng kê, kế hoạch lệnh gốc Chenfeng, phiếu tự kiểm trước khi vẽ và các phép dò lỗi sản xuất trên tấm / lỗ khoan thật. Số phiên bản (`VERSION`) nằm ở đây.
- `src/mncf-driver.js` — điều khiển Chenfeng (lệnh gốc 左右侧板 / 立板 / 顶底板 / 背板 / 层板 / 门板, cổng nhập tấm, module tham số, đọc kho mẫu của tài khoản và vẽ mẫu kho theo kích thước, đọc tấm + lỗ khoan thật để dò lỗi sản xuất sau khi vẽ, đọc kho vật liệu của tài khoản và đổ màu cho tấm — vật liệu hiển thị + tên ván / vật liệu / màu).
- `src/mncf-phong.js` — thẻ Phòng (hiện trạng, khung đặt tủ / mẫu kho, chia ô trên mặt đứng, khấu cột, điểm điện – nước) và hình vẽ trên mặt bằng → khung tủ.
- `src/mncf-dich.js` — dịch ghi chú tham số mẫu sang tiếng Việt.
- `src/mncf-ui.js` — bảng nổi trong Chenfeng / trang độc lập.
- `src/mncf-nap.js` — bộ nạp tự cập nhật của tiện ích.
- `test/` — phép thử + trang giả lập Chenfeng (`mock-chenfeng.html`); `kho-gia.js` chặn kênh cập nhật về `dist/` trong máy để phép thử chạy đúng bản vừa dựng.
- `dist/` — chỉ lưu 3 tệp của kênh cập nhật; phần còn lại sinh bằng `node build.js`.
- `tai-ve/` — zip tiện ích để cài lần đầu (chỉ dựng lại khi sửa bộ nạp / manifest).
