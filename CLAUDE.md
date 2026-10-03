# mn-chenfeng — ghi nhớ cho Claude

Tiện ích "Một Nhà · Vẽ tủ vào Chenfeng" (plugin cho Chenfeng WebCAD cfcad.cn) của Một Nhà Design & Build. Trả lời anh Thanh (Jason) bằng tiếng Việt, ngắn, làm trước nói sau, giao file dùng được ngay.

## Kho này là KÊNH PHÁT HÀNH
- Mọi máy đã cài tiện ích tự tải `dist/mn-chenfeng.js` trên nhánh `main` mỗi lần mở Chenfeng (xem README → Tự cập nhật). **Đẩy lên `main` = phát hành cho xưởng.**
- Chỉ đẩy khi: `node build.js` đã chạy, mọi bộ thử đạt (core, dich, phong, chuanhoa, ui, phong-ui, ext, nap), và `dist/phien-ban.json` khớp `dist/mn-chenfeng.js` (build tự làm). Dùng `./phat-hanh.sh "ghi chú"`.
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
- Cả tủ lệnh gốc được gom thành MỘT module (`ganModuleGoc`): thùng là mẫu con, biểu thức L / W / H lấy từ `Core.heSo`. Tủ luôn vẽ thẳng trục ở chỗ trống rồi đưa về chỗ đặt bằng một ma trận (`D.apMaTran`) — lệnh ROTATE của Chenfeng không xoay được cây mẫu gốc.
- Lệnh gốc dò khoảng trống trên HÌNH đang dựng, mà Chenfeng đưa hình tấm mới vào Scene trễ một nhịp `setTimeout` (tab bị che: trễ cả giây). Mọi lần dò phải đi qua `doKhoang`: `hienHinh` → `veNgay` → rê chuột cho Chenfeng dò thử → so hộp xem trước với `Core.khoangMong`. Đừng gọi thẳng `D.input` cho lệnh hỏi khoảng trống.
- Bộ thử nào nạp tiện ích thật thì phải `require('./kho-gia')` để chặn kênh cập nhật về `dist/` trong máy; không thì phép thử chạy bản đã phát hành trên mạng.

## Khi thử trên Chenfeng thật (trình duyệt của anh)
- Chỉ làm trong tab riêng do mình mở, tắt tự lưu trong tab đó, không đụng bản vẽ anh đang mở, không lưu bản vẽ / mẫu / cấu hình vào tài khoản anh khi chưa được bảo.
- Khoá `mncf.*` trong localStorage của cfcad.cn là dữ liệu của anh — không xoá, không ghi đè.
- Không để lỗi JS lọt ra trang, không gọi alert / confirm, thử xong thì hoàn tác và đóng tab.
- Mua mẫu trả tiền, lệnh gửi bản vẽ ra ngoài: hỏi anh trước từng lần.
