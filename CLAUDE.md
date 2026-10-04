# mn-chenfeng — ghi nhớ cho Claude

Tiện ích "Một Nhà · Vẽ tủ vào Chenfeng" (plugin cho Chenfeng WebCAD cfcad.cn) của Một Nhà Design & Build. Trả lời anh Thanh (Jason) bằng tiếng Việt, ngắn, làm trước nói sau, giao file dùng được ngay.

## Kho này là KÊNH PHÁT HÀNH
- Mọi máy đã cài tiện ích tự tải `dist/mn-chenfeng.js` trên nhánh `main` mỗi lần mở Chenfeng (xem README → Tự cập nhật). **Đẩy lên `main` = phát hành cho xưởng.**
- Chỉ đẩy khi: `node build.js` đã chạy, mọi bộ thử đạt (core, dich, phong, kiem, chuanhoa, ui, phong-ui, ext, nap, kho, doloi), và `dist/phien-ban.json` khớp `dist/mn-chenfeng.js` (build tự làm). Dùng `./phat-hanh.sh "ghi chú"`.
- Đổi hành vi → tăng `VERSION` trong `src/mncf-core.js` (sửa luôn chuỗi phiên bản trong `test/ui.test.js`).
- Việc đang làm dở, chưa thử xong: để ở nhánh khác, không để trên `main`.
- Sửa `src/mncf-nap.js` hoặc manifest → dựng lại `tai-ve/mn-chenfeng-tien-ich.zip` (nội dung = `dist/extension/`, thư mục gốc trong zip tên `mn-chenfeng/`) và báo anh cài lại; sửa phần khác thì KHÔNG cần đụng zip.
- Kho công khai: không đưa vào đây ghi chú nội bộ, ảnh chụp bản vẽ khách, mã số thư mục / tài khoản Chenfeng của xưởng.

## Lệnh
```bash
node build.js
NODE_PATH=/home/claude/.npm-global/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node test/<tên>.test.js
```

## Quy ước mã
- Tên biến / hàm / thông báo bằng tiếng Việt không dấu hoặc có dấu như mã hiện có; ghi chú giải thích *vì sao*.
- `mncf-core.js` chạy được cả trong Node (không đụng DOM). Mọi thứ đụng Chenfeng nằm trong `mncf-driver.js`.
- Tủ mặc định vẽ bằng lệnh gốc Chenfeng (`D.veGoc`, kế hoạch từ `Core.keHoachGoc`): vách chạy suốt, nóc / đáy theo từng khoang, hậu 6 li phủ sau. Trường hợp chưa hỗ trợ (khấu cột, hậu khác kiểu phủ, tủ xoay) rơi về cách nhập tấm (`drawImpl`) và phải báo cho người dùng.
- Không bấm "Lưu cấu hình" trong hộp thoại Chenfeng; trả lại lựa chọn của người dùng sau mỗi lệnh.
- Mẫu kho Chenfeng (`D.veKho`, thẻ Kho mẫu): chỉ ĐỌC kho của tài khoản đang đăng nhập (`CAD-dirQuery`, `CAD-moduleList`); mã nguồn không ghi sẵn mã thư mục / mã mẫu nào — nhóm nhanh dò theo TÊN thư mục. Mẫu dựng thẳng trục ở chỗ trống rồi mới đưa về chỗ đặt bằng một ma trận, neo theo lưng.
- Cả tủ lệnh gốc được gom thành MỘT module (`ganModuleGoc`): thùng là mẫu con, biểu thức L / W / H lấy từ `Core.heSo`. Tủ luôn vẽ thẳng trục ở chỗ trống rồi đưa về chỗ đặt bằng một ma trận (`D.apMaTran`) — lệnh ROTATE của Chenfeng không xoay được cây mẫu gốc.
- Lệnh gốc dò khoảng trống trên HÌNH đang dựng, mà Chenfeng đưa hình tấm mới vào Scene trễ một nhịp `setTimeout` (tab bị che: trễ cả giây). Mọi lần dò phải đi qua `doKhoang`: `hienHinh` → `veNgay` → rê chuột cho Chenfeng dò thử → so hộp xem trước với `Core.khoangMong`. Đừng gọi thẳng `D.input` cho lệnh hỏi khoảng trống.
- Bộ thử nào nạp tiện ích thật thì phải `require('./kho-gia')` để chặn kênh cập nhật về `dist/` trong máy; không thì phép thử chạy bản đã phát hành trên mạng.
- Dò lỗi sản xuất (bản 1.20): phép dò là HÀM THUẦN trong `mncf-core.js` — thiết kế: `kiemSX`, `kiemLienKet`, `phieu`; tấm + lỗ thật: `kiemVaCham`, `kiemLoGiao`, `kiemLoLech`, `kiemMoiNoi`, `doLoiThat`. `D.docThat` chỉ ĐỌC tấm / lỗ của Chenfeng thành dữ liệu thuần (hộp theo nhóm hướng, đường bao thật của tấm khoét / bo cong, mã mẫu), `D.doLoi` chạy sau mỗi lần vẽ (`doLoiSauVe`) và từ nút ở thẻ Kết quả. Thêm phép dò: viết phép thử trong `test/kiem.test.js` trước; dữ liệu giả phải đúng cấu trúc đã đo trên Chenfeng (OBB, ContourCurve + OCS, CylinderHole._Matrix). Mục LỖI làm lần vẽ không "ok"; mục LƯU Ý chỉ nằm trong phiếu — đừng biến chuyện thường của mẫu kho (mép sau đợt tì lên hậu dày, cánh hở thùng) thành dòng báo.

## Khi thử trên Chenfeng thật (trình duyệt của anh)
- Chỉ làm trong tab riêng do mình mở, tắt tự lưu trong tab đó, không đụng bản vẽ anh đang mở, không lưu bản vẽ / mẫu / cấu hình vào tài khoản anh khi chưa được bảo.
- Khoá `mncf.*` trong localStorage của cfcad.cn là dữ liệu của anh — không xoá, không ghi đè.
- Không để lỗi JS lọt ra trang, không gọi alert / confirm, thử xong thì hoàn tác và đóng tab.
- Mua mẫu trả tiền, lệnh gửi bản vẽ ra ngoài: hỏi anh trước từng lần.
