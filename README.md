# Một Nhà · Vẽ tủ vào Chenfeng

Tiện ích Chrome cho [Chenfeng WebCAD](https://cfcad.cn): nhập thông số tủ, kéo chia đợt trên hình, đặt ngăn kéo / suốt treo → bảng tự dựng tủ vào bản vẽ Chenfeng theo chuẩn kết cấu xưởng Một Nhà, Chenfeng tự khoan lỗ. Cần có tài khoản Chenfeng; tiện ích chỉ chạy trên trang `cfcad.cn` và trang sản xuất của Chenfeng (`sc.leye.site` — tab mở ra khi tách đơn), không gửi dữ liệu đi đâu.

## Cài (mỗi máy một lần)

1. Tải **[mn-chenfeng-tien-ich.zip](https://github.com/thanhmotnha/mn-chenfeng/raw/main/tai-ve/mn-chenfeng-tien-ich.zip)**, giải nén ra một thư mục cố định (vd `D:\MOTNHA\mn-chenfeng`).
2. Chrome → `chrome://extensions` → bật **Developer mode** → **Load unpacked** → chọn thư mục vừa giải nén.
3. Mở https://cfcad.cn, đăng nhập, mở bản vẽ → nút **Một Nhà · Vẽ tủ** ở góc dưới bên phải.

**Máy đã cài bản trước 1.22** — cài lại một lần để có trợ lý ở trang sản xuất: tải zip mới ở trên, giải nén **đè** lên thư mục cũ → `chrome://extensions` → bấm nút tải lại (⟳) trên thẻ tiện ích → F5 trang Chenfeng. Thẻ **Hướng dẫn → Cập nhật tự động** của bảng ghi rõ máy đang có trợ lý hay chưa.

Dùng Tampermonkey thay cho tiện ích: cài [mn-chenfeng.user.js](https://raw.githubusercontent.com/thanhmotnha/mn-chenfeng/main/dist/mn-chenfeng.user.js) (Tampermonkey tự cập nhật theo lịch của nó). Bản này chỉ có bảng vẽ tủ, không có trợ lý ở trang sản xuất.

## Xuất ván (bản 1.22)

Thẻ **Kết quả** → nút **Xuất ván (tách đơn CD)**:

1. Bảng dò lỗi sản xuất trên đúng các tấm sắp xuất (đang chọn tấm nào thì lấy cả tủ chứa tấm đó; không chọn gì = cả bản vẽ). Còn mục LỖI thì dừng, nêu lỗi, có nút "Vẫn xuất".
2. Bảng tự chọn tấm + phụ kiện rồi chạy lệnh tách đơn `CD` của Chenfeng → khung nhỏ **Order Splitting** hiện. Tới đây chưa có gì rời máy.
3. Người dùng bấm **打开** trong khung nhỏ → Chenfeng mở trang sản xuất ở tab mới. Bảng không bấm hộ bước này.
4. Ở tab đó, **trợ lý Một Nhà** (góc dưới bên phải) báo máy chủ Chenfeng đang tính tới đâu, gọi lại khi trang kẹt trắng, rồi tự bấm 开始优化 → dừng khi số tờ ván đứng yên → 确认新优化 để mở sơ đồ cắt. Trợ lý **không** lưu, không xuất NC, không in tem — các nút 保存优化 / 一键NC / 打印标签 vẫn do người dùng bấm. Bỏ chọn "Tự tối ưu khi mở trang" nếu muốn tự làm; đụng vào hộp 优化进度 lúc trợ lý đang chạy thì trợ lý thôi ngay.

Đừng F5 tab trang sản xuất: dữ liệu tấm chỉ được trao một lần lúc bấm 打开, tải lại là mất — đóng tab, bấm Xuất ván lại.

## Tự cập nhật

Tiện ích là một **bộ nạp** (`src/mncf-nap.js`). Mỗi lần mở / tải lại trang Chenfeng nó:

1. hỏi `dist/phien-ban.json` trên kho này (phiên bản + mã kiểm SHA-256);
2. mã kiểm khác bản đang cất trong máy → tải `dist/mn-chenfeng.js`, **đối chiếu mã kiểm** rồi mới chạy và cất lại;
3. không vào được GitHub → thử jsDelivr → chạy bản đã cất → chạy bản kèm sẵn trong tiện ích.

Vì vậy có bản mới chỉ cần **F5** trang Chenfeng (GitHub giữ bản đệm khoảng 5 phút). Xem bản đang chạy: bảng Một Nhà → thẻ **Hướng dẫn** → **Cập nhật tự động**.

Ở trang sản xuất (`sc.leye.site`) bộ nạp (bản 2, có từ 1.22) nạp `dist/mn-chenfeng-sx.js` — trợ lý xuất ván, mã kiểm ở mục `sx` của `phien-ban.json`. Trợ lý phải có từ giây đầu nên bộ nạp **chạy ngay** bản đang có trong máy (bản đã cất hoặc bản kèm tiện ích, lấy bản mới hơn) rồi mới hỏi kho; kho có bản khác thì tải ngầm, đối chiếu mã kiểm, cất lại — lần mở trang sản xuất sau dùng bản đó.

> Ai ghi được vào nhánh `main` của kho này thì chạy được mã trong phiên Chenfeng của các máy đã cài. Chỉ cấp quyền ghi cho người tin cậy.

## Phát triển

```bash
node build.js                 # dựng dist/ (bản gộp, phien-ban.json, userscript, tiện ích, trang HTML)
node test/core.test.js        # lõi kết cấu — không cần thư viện
node test/dich.test.js        # bảng dịch ghi chú tham số
node test/phong.test.js       # thẻ Phòng
node test/kiem.test.js        # dò lỗi sản xuất: quy tắc thiết kế + tấm và lỗ khoan thật (hàm thuần)
node test/mau.test.js         # đổ màu: chia tấm của tủ thành nhóm thùng / cánh + phào / hậu, lọc màu (hàm thuần)
# các bộ cần Playwright + Chromium: chuanhoa, ui, phong-ui, ext, nap, kho, doloi, mau-ui, xuatvan, sx
NODE_PATH=<node_modules> PLAYWRIGHT_BROWSERS_PATH=<trình duyệt> node test/nap.test.js
./phat-hanh.sh "ghi chú"      # dựng + thử + commit + đẩy lên main → các máy tự nhận
```

- `src/mncf-core.js` — lõi: thông số tủ → danh sách tấm, kiểm tra, bảng kê, kế hoạch lệnh gốc Chenfeng, phiếu tự kiểm trước khi vẽ và các phép dò lỗi sản xuất trên tấm / lỗ khoan thật. Số phiên bản (`VERSION`) nằm ở đây.
- `src/mncf-driver.js` — điều khiển Chenfeng (lệnh gốc 左右侧板 / 立板 / 顶底板 / 背板 / 层板 / 门板, cổng nhập tấm, module tham số, đọc kho mẫu của tài khoản và vẽ mẫu kho theo kích thước, đọc tấm + lỗ khoan thật để dò lỗi sản xuất sau khi vẽ, đọc kho vật liệu của tài khoản và đổ màu cho tấm — vật liệu hiển thị + tên ván / vật liệu / màu).
- `src/mncf-phong.js` — thẻ Phòng (hiện trạng, khung đặt tủ / mẫu kho, chia ô trên mặt đứng, khấu cột, điểm điện – nước) và hình vẽ trên mặt bằng → khung tủ.
- `src/mncf-dich.js` — dịch ghi chú tham số mẫu sang tiếng Việt.
- `src/mncf-ui.js` — bảng nổi trong Chenfeng / trang độc lập.
- `src/mncf-sx.js` — trợ lý ở trang sản xuất của Chenfeng (bản gộp riêng `dist/mn-chenfeng-sx.js`): báo trạng thái, cứu trang trắng, tự tối ưu → mở sơ đồ cắt.
- `src/mncf-nap.js` — bộ nạp tự cập nhật của tiện ích (trang CAD nạp bảng vẽ tủ, trang sản xuất nạp trợ lý).
- `test/` — phép thử + trang giả lập Chenfeng (`mock-chenfeng.html`) và trang sản xuất (`mock-sanxuat.html` + `mock-cutblock.html`); `kho-gia.js` chặn kênh cập nhật về `dist/` trong máy để phép thử chạy đúng bản vừa dựng.
- `dist/` — chỉ lưu 4 tệp của kênh cập nhật (`mn-chenfeng.js`, `mn-chenfeng-sx.js`, `phien-ban.json`, `mn-chenfeng.user.js`); phần còn lại sinh bằng `node build.js`.
- `tai-ve/` — zip tiện ích để cài (chỉ dựng lại khi sửa bộ nạp / manifest; mỗi lần dựng lại thì các máy phải cài lại một lần).
