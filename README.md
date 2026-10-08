# Một Nhà · Vẽ tủ vào Chenfeng

Tiện ích Chrome cho [Chenfeng WebCAD](https://cfcad.cn): nhập thông số tủ, kéo chia đợt trên hình, đặt ngăn kéo / suốt treo → bảng tự dựng tủ vào bản vẽ Chenfeng theo chuẩn kết cấu xưởng Một Nhà, Chenfeng tự khoan lỗ. Cần có tài khoản Chenfeng; tiện ích chỉ chạy trên trang `cfcad.cn` và trang sản xuất của Chenfeng (`sc.leye.site` — tab mở ra khi tách đơn), không gửi dữ liệu đi đâu. Riêng khi xưởng tự nối bảng với trang đo hiện trạng của mình (bản 1.24, xem dưới) thì bảng **đọc** danh sách phòng đã đo từ địa chỉ máy chủ mà chính người dùng dán vào — chỉ đọc, không gửi gì lên.

## Cài (mỗi máy một lần)

1. Tải **[mn-chenfeng-tien-ich.zip](https://github.com/thanhmotnha/mn-chenfeng/raw/main/tai-ve/mn-chenfeng-tien-ich.zip)**, giải nén ra một thư mục cố định (vd `D:\MOTNHA\mn-chenfeng`).
2. Chrome → `chrome://extensions` → bật **Developer mode** → **Load unpacked** → chọn thư mục vừa giải nén.
3. Mở https://cfcad.cn, đăng nhập, mở bản vẽ → nút **Một Nhà · Vẽ tủ** ở góc dưới bên phải.

**Máy đã cài bản trước 1.22** — cài lại một lần để có trợ lý ở trang sản xuất: tải zip mới ở trên, giải nén **đè** lên thư mục cũ → `chrome://extensions` → bấm nút tải lại (⟳) trên thẻ tiện ích → F5 trang Chenfeng. Thẻ **Hướng dẫn → Cập nhật tự động** của bảng ghi rõ máy đang có trợ lý hay chưa.

Dùng Tampermonkey thay cho tiện ích: cài [mn-chenfeng.user.js](https://raw.githubusercontent.com/thanhmotnha/mn-chenfeng/main/dist/mn-chenfeng.user.js) (Tampermonkey tự cập nhật theo lịch của nó). Bản này chỉ có bảng vẽ tủ, không có trợ lý ở trang sản xuất.

## Nóc, đáy phủ hồi (bản 1.31)

- **Kết cấu thùng mới (chuẩn xưởng):** nóc và đáy liền cả thùng, phủ lên đầu hồi; hồi và vách kẹp giữa nóc và đáy. Không còn cắt nóc, đáy tại từng vách. Tủ 2 thân thì đáy thân trên đặt lên nóc thân dưới, hai tấm liền chồng nhau. Tủ tách thùng thì mỗi thùng một nóc, một đáy.
- **Khung đế:** thân có chân thì đáy nằm trên khung đế của từng thùng: đế trước (ngay sau chân trước), đế sau, 2 đế hông, cao bằng chân, ván thùng. Cạnh cột (khấu cột) đế lùi ra trước mặt cột. Chân trước vẫn là tấm mặt như cũ.
- **Lệnh gốc:** lệnh nóc / đáy của Chenfeng có ô bọc hồi nhưng chưa đo nó làm gì với hồi, nên tủ phủ hồi được vẽ bằng cách nhập tấm (vẫn là một module đổi Rộng / Sâu / Cao) và bảng báo một dòng. Muốn vẽ bằng lệnh gốc như cũ: *Chuẩn xưởng → Thùng → Kết cấu nóc, đáy → Hồi phủ nóc, đáy*.
- **Khung mặt hộc kéo âm** (theo ảnh mẫu của anh): hai nẹp đứng hai bên, thanh ngang cao 50 phẳng mặt ngăn kéo: thanh trên sát dưới đợt chạy suốt bề ngang khoang, thanh giữa nằm giữa các mặt. Mặt ngăn kéo lọt trong ô, khe 2 quanh mặt. Không còn xà ẩn sau khe. Muốn kiểu cũ: *Chuẩn xưởng → Ngăn kéo âm → Khung mặt = 0*.
- Thông số lưu từ bản cũ tự sang kết cấu mới và báo một dòng.

## Nút "Thêm vách cho vừa khổ ván" (bản 1.30.1)

- Chọn tủ có sẵn rồi kéo rộng ra (vd tủ 4 cánh 2000 đặt rộng 2600) làm khoang rộng 1280, tấm hậu rộng hơn khổ 1220 nên bảng báo đỏ và khoá nút Vẽ. Nay dưới các dòng đỏ đó có nút **Thêm vách cho vừa khổ ván**: bảng tách đôi khoang rộng nhất đang có tấm vượt khổ, lặp tới khi hết. Mỗi khoang mới giữ số cánh, đợt, ngăn kéo / suốt treo của khoang cũ. Không ưng thì bấm ↶ Lùi.
- Khoang gõ số rộng cố định thì bảng không đụng. Tấm vượt khổ theo chiều cao (thân cao hơn 2440) không sửa bằng nút này.

## Bản lề Kolity K53 / Imundex thép, số bản lề theo tiêu chuẩn (bản 1.30, 1.30.1)

- **Chuẩn xưởng → Cánh → Loại bản lề:** Kolity K53 (mặc định) hoặc Imundex thép 105° của An Cường, hoặc "Tự gõ số". Chọn loại thì chén Ø35, sâu chén và tâm chén cách mép cánh lấy theo loại (K53: sâu 12, cánh dày 15–25; Imundex thép: sâu 11,5, cánh dày 14–22; tâm chén cách mép 21,5 cho cả hai). Cánh dày ngoài khoảng của loại đang chọn thì bảng cảnh báo.
- **Số bản lề mỗi cánh** theo chiều cao cánh: đến 900 là 2, đến 1600 là 3, đến 2000 là 4, cao hơn là 5; cánh rộng hơn 600 thêm 1. Bản lề trên / dưới cách đầu cánh 100 (đổi ở Chuẩn xưởng), các bản lề giữa chia đều. Bản lề tự tránh đợt cố định (đế bản lề trên hồi sẽ cấn đợt, tâm bản lề cách mặt đợt ít nhất 25) rồi chia đều lại. Vùng hộc kéo âm có vách đệm 5 cm không cấn bản lề nên bản lề không dời vì hộc kéo.
- Vị trí bản lề hiện thành vòng tròn trên cánh ở hình đứng; bảng kê ghi số bản lề mỗi cánh, phần phụ kiện có tổng số bản lề theo loại. Khoét chén vào cánh khi vẽ vẫn là lựa chọn thử nghiệm (tắt sẵn). Chọn "hậu soi rãnh" ở Chuẩn xưởng nay ra dày 6,5 (trước đó vẫn còn đặt 5).
- **Chưa đo:** khoảng cách mép cánh tới mép chén (K) của cả hai hãng chưa có tài liệu chính hãng, bảng đang lấy 4. Xưởng khoan thử một cánh rồi báo lại số đúng.

## Hậu 6,5; mã tủ không còn dính vào tên tấm (bản 1.29.2)

- **Hậu dày 6,5** là mặc định cho cả hậu phủ sau lẫn hậu soi rãnh (xưởng chỉ có ván mỏng 6,5, không có 6 hay 5). Thông số đang lưu để đúng mặc định cũ (6 hoặc 5) thì bảng tự đổi sang 6,5 và báo một dòng; số gõ tay thì giữ. Đáy hộp ngăn kéo là tham số của mẫu Chenfeng — bấm *Chuẩn xưởng → Ngăn kéo → Dò kho mẫu*, dòng báo nay kể tên + giá trị từng tham số của mỗi mẫu; gửi dòng đó để chốt tham số dày đáy rồi bảng ghi đè 6,5 cho mọi loại.
- **Trang sản xuất của Chenfeng nối nội dung ghi chú vào tên tấm** ("K1-TĐáy29A99WHS", khó chọn). Mã tủ mà bảng gắn vào tấm (để chọn 1 tấm là tìm lại cả tủ) nay nằm ở *tên* ghi chú ("MNCF 29A99WHS"), nội dung để trống — tên tấm trên trang sản xuất và tem sạch trở lại với tủ vẽ từ bản này; tủ vẽ bản cũ vẫn tìm lại được (bảng đọc cả hai dạng), bấm *Cập nhật tủ* là chuyển sang dạng mới.

## Kho mẫu gọn hơn; thăm dò lõi Chenfeng (bản 1.29.1)

- **Thẻ Kho mẫu:** ô *Thư mục* chia ba nhóm **Tủ / Phụ kiện / Khác** theo tên thư mục (bản lề, tay nắm, ray, chân, đèn, khoá… là phụ kiện). Thư mục **không có mẫu** (kể cả thư mục con) tự ẩn: sau khi đọc cây thư mục, bảng đếm ngầm số mẫu từng thư mục (chỉ đọc, mỗi thư mục một lần hỏi) rồi dọn danh sách một lần. Thư mục đang mở luôn hiện.
- **⚙ → Hướng dẫn → Thăm dò lõi:** gom mã nguồn các lệnh vẽ tấm của Chenfeng (chỉ đọc — không có bản vẽ, không có tài khoản) thành tệp `chenfeng-loi-<ngày>.txt` tải về máy. Gửi tệp đó cho Claude để bước sau bảng gọi thẳng vào lõi Chenfeng thay vì giả bấm hộp và rê chuột (máy của Claude không vào được cfcad.cn).

## Chenfeng giao diện tiếng Việt; giữ sẵn kết nối tới máy chủ Chenfeng (bản 1.29)

- **Sửa lỗi: bấm Vẽ rồi bấm điểm, Chenfeng mở hộp "Hông tủ trái/phải" rồi đứng đó, bảng biến mất.** Bảng tìm nút xác nhận của hộp theo chữ "OK / 确定", nên với giao diện Chenfeng tiếng Việt ("Xác nhận") bảng không thấy hộp. Nay bảng nhận cả chữ Trung, Anh, Việt và nhận theo màu nút.
- Lúc chờ bấm điểm, dòng nhắc trên cùng có nút **Thôi** — bấm là bỏ lời nhắc, bảng mở lại (như phím Esc).

- Máy chủ dữ liệu của Chenfeng ở Trung Quốc; đường từ Việt Nam sang **rớt gói từng đợt** (nặng nhất khoảng 19 – 22 giờ). Để im vài giây là máy chủ đóng kết nối, lần gọi sau phải mở lại — trên đường đang rớt gói, mở lại có khi mất thêm 1 – 3 giây, đúng lúc Chenfeng tải hộp ngăn kéo / suốt treo.
- Nay trong lúc bảng đang vẽ tủ, cập nhật tủ, vẽ phòng hay dựng mẫu kho, hễ đường tới máy chủ im quá 2 giây thì bảng hỏi máy chủ một câu chỉ đọc cho kết nối còn mở. Chenfeng đang tự gọi máy chủ thì bảng không hỏi chen. Vẽ xong thì thôi.
- **⚙ → Đo mạng** nay kèm một dòng về các lần *chính Chenfeng* gọi máy chủ từ lúc mở trang (gọi bằng gì, giao thức, mẫu tải thường mất bao lâu, lâu nhất bao lâu). Vẽ vài tủ có ngăn kéo rồi bấm Đo mạng, chụp dòng đó gửi lại: đó là số đo để làm bước sau — *bảng tự gửi lại khi rớt gói* (chưa có).
- Đổi đường mạng (nhà mạng khác, 4G, VPN) rồi bấm Đo mạng để so — vẫn là cách rẻ nhất.

## Sửa ngay trên hình, hình 3D; nẹp che kín hộc ngăn kéo; tủ mới không mang khấu cột cũ (bản 1.28)

- **Bấm phào trên hình** để sửa bề rộng, *Bỏ phào*, hoặc *Cả 3 phào* cùng một số. Mép chưa có phào có dải **+ phào** nét đứt ngay ngoài mép, bấm vào để thêm. Rộng / cao phủ bì giữ nguyên, thùng tự hẹp lại hoặc rộng ra theo phào.
- **Bấm cột** trên hình *nhìn từ trên xuống* → **Bỏ cột này** (tủ thôi khoét quanh cột), hoặc *Bỏ hết* khi có nhiều cột. Phím Delete cũng bỏ được phào / cột đang chọn; **↶ Lùi** lấy lại.
- **Hình 3D**: nút **3D** trên hình. Kéo trên hình (hoặc phím mũi tên) để xoay; bấm phào / cột trên hình 3D vẫn sửa được. Bấm lại nút để về hình đứng.
- **Ngăn kéo âm sau cánh: nẹp che kín.** Nẹp hai bên hộc kéo rộng ra bằng khoảng đệm (50) và che luôn cạnh trước của vách đệm; vách đệm lùi ra sau nẹp. Mặt trước chỉ còn: cạnh hồi · nẹp · khe · mặt ngăn kéo — không còn lộ cạnh ván. Tắt nẹp ở Chuẩn xưởng → Ngăn kéo thì vách đệm ra lại ngang mặt ngăn kéo như cũ.
- **Khấu cột là của chỗ đặt.** Đặt tủ bằng chuột ở chỗ không có cột thì bỏ khấu cột của lần đặt trước; *Tủ có sẵn → Dùng* (khi không giữ chỗ đặt nào) cho tủ không khấu; vẽ xong đúng chỗ đặt hoặc *Bỏ hình* thì ô *Đặt tại toạ độ* do bảng tự điền cũng bỏ chọn — lần Vẽ sau không dựng chồng lên chỗ cũ.
- **Bảng gọn hơn.** Thẻ Tủ: hình tủ to hơn; bấm một ô trên hình hiện hàng nút *Trống · NK âm · NK trùm · Suốt*; ô chọn *Tủ có sẵn* + nút *Dùng* thay cho khung mẫu tủ và nút *Về tủ mẫu* (↶ Lùi lấy lại tủ đang làm). Ghi chú kiểm tra gom vào nút **✓ Tự kiểm** trên hình (đỏ khi có chỗ cần xem). Đang nối với tủ trên bản vẽ thì nút xanh là **Cập nhật tủ**, *Thôi sửa* nằm cạnh.
- **Thẻ Kết quả:** chân bảng là việc làm tiếp — *Hoàn tác · Dò lỗi · Vừa màn · 3D · Xuất ván*. Phiếu dò lỗi gom theo mục (mục đạt gom một dòng), bỏ chữ Trung / chữ kỹ thuật, *Số liệu* thu gọn.
- **Thẻ Phòng:** nút *Vẽ phòng vào Chenfeng* + *Hoàn tác* ở chân bảng; *Phòng đã đo trên điện thoại* thu gọn khi chưa nối; lưu / mở / dán mã / phòng mẫu nằm sau nút *Khác*.

## Bảng ít chữ, ít nút; Đo mạng; Xem 3D (bản 1.27)

- **Ít chữ.** Chữ hướng dẫn, chú giải màu, dòng mô tả tủ ẩn sẵn; dòng báo dài thu còn 2 dòng — **bấm vào dòng báo** để xem hết. Nút **?** ở đầu bảng hiện lại đủ chữ (máy nhớ lựa chọn).
- **Ít thẻ.** Hàng thẻ chỉ còn *Tủ · Phòng · Kho mẫu · Kết quả*; *Màu, Chuẩn xưởng, Hướng dẫn, Đo mạng* nằm sau nút **⚙**.
- **Ít nút.** Chân thẻ Tủ: *Vẽ vào Chenfeng · Tường · Chuột · Hình · Sửa tủ* · **⋯**. Chuẩn hoá, JSON, CSV, Lưu, Mở và ô toạ độ nằm sau nút ⋯; nút *Cập nhật* chỉ hiện khi bảng đang nối với một tủ trên bản vẽ.
- **Đo mạng** (⚙ → Đo mạng): bảng hỏi máy chủ Chenfeng 20 lần (chỉ đọc, khoảng 15 giây) rồi báo **tốt / tạm được / kém** và *mấy lần bị chậm hoặc rớt*. Bảng không làm mạng nhanh lên được — nút này để so các đường mạng / VPN: đổi đường rồi bấm đo lại, dòng báo ghi luôn kết quả lần trước. Mất liền 3 lần thì báo *đứt* và dừng.
- **Xem 3D / Nhìn từ trên.** Vẽ phòng hoặc vẽ tủ xong, cạnh nút *Xem toàn bộ* có nút xoay góc nhìn của Chenfeng sang 3D (ở thẻ Phòng có thêm nút nhìn lại từ trên). Chenfeng đang bận một lệnh thì bảng báo bận và không gửi gì.

## Vẽ phòng khi mạng tới Chenfeng chậm; tủ có cột giữa (bản 1.26.1)

- **Vẽ phòng không còn báo oan "Chenfeng không nhận lệnh vẽ tường"** khi mạng tới Chenfeng chậm. Đã đo trên Chenfeng: bản vẽ chưa có *vật liệu sàn mặc định* thì lệnh vẽ tường / mở lỗ cửa / dầm của Chenfeng phải **tải vật liệu đó từ máy chủ của nó** rồi mới hỏi điểm. Máy đã từng vẽ phòng thì Chrome nhớ sẵn (0,2 giây); máy mới, hồ sơ Chrome mới hoặc vừa xoá dữ liệu duyệt web thì phải tải — mạng chậm là 4 giây, có lúc hơn 20 giây. Bản trước chỉ chờ 5 giây, quá là bỏ cuộc rồi vẫn gửi tiếp lệnh cửa, cột (ra một chuỗi "chưa mở được… / chưa vẽ được…") trong khi lệnh tường còn chạy ngầm. Giờ bảng **chờ tới 60 giây**, dòng trạng thái ghi rõ đang chờ Chenfeng làm gì; quá hạn thì **dừng hẳn** và nói lý do, lệnh tới trễ được tự huỷ. Bấm **Vẽ phòng vào Chenfeng** lại là vẽ nốt phần còn thiếu — phần đã vẽ được giữ nguyên.
- Chenfeng **đang chạy dở một lệnh khác**, **đang mở một hộp thoại**, **đang ở khung nhìn bố cục**, hoặc tự từ chối lệnh: bảng nói ngay đúng chuyện đó (tên lệnh đang chạy dở / tên hộp đang mở / lời Chenfeng báo) và không gửi gì thêm — lệnh gửi vào lúc đó Chenfeng bỏ lặng lẽ. Bảng không tự đóng hộp thoại đang mở của anh.
- Mọi lệnh bảng gửi cho Chenfeng giờ cách nhau ít nhất 0,12 giây: Chenfeng bỏ (không báo gì) lệnh gõ cách lệnh trước chưa tới 0,09 giây — trước đây thỉnh thoảng một lệnh "biến mất" là vì thế.
- **Tủ có cột giữa: ô Rộng (L) của module chỉ để xem.** Cột đứng yên còn các khoang thì chia lại theo bề rộng mới, nên vách khấu / hậu khấu không chạy đều theo L được (thử trên Chenfeng: tủ 3000 có cột giữa, gõ L 2900 ở ô Thông số thì vách khấu chỉ còn cách vách khoang 2 mm thay vì 30). Giờ gõ số mới vào ô đó tủ không chạy, ô ghi chú của tham số ghi rõ lý do. Đổi rộng tủ có cột giữa: sửa **Rộng** ở bảng rồi bấm **Cập nhật** (tủ vẽ lại đúng chỗ cũ, phần khấu tính lại đúng). Lỡ gõ số vào ô L rồi cũng không sao — tủ không đổi, *Sửa tủ* / *Cập nhật* vẫn tìm ra tủ.
- **Sâu (W) / Cao (H)** của tủ có cột giữa vẫn đổi được ở ô Thông số; tủ **khấu cột góc** (trái / phải) đổi được cả ba như trước. Kích thước nào đổi là kết cấu phải đổi theo (vd tủ mà mọi khoang đều gõ bề rộng cố định → Rộng) cũng được khoá như vậy, thay cho kiểu kéo thô của Chenfeng.
- Tủ có cột giữa vẽ từ bản trước: module vẫn co giãn theo L kiểu cũ — đổi rộng thì dùng *Sửa tủ → Cập nhật*, đừng gõ L ở ô Thông số.

## Ngăn kéo vẽ bằng lệnh ngăn kéo của Chenfeng (bản 1.26)

- Tủ vẽ bằng lệnh gốc thì **ô ngăn kéo** (âm sau cánh hoặc trùm ngoài) cũng được dựng bằng chính lệnh ngăn kéo của Chenfeng (`DRAWER`, hộp *Drawer Design*) với mẫu ngăn kéo trong kho của tài khoản: bảng tự chọn 4 tấm kẹp của ô (vách đệm / hồi / vách, đáy, đợt), ghi số ngăn, lọt lòng hay trùm ngoài, khe hở, trùm ra, sâu hộp (ô có mặt cao khác nhau thì khoá cao từng ngăn) rồi bấm OK hộ. Ngăn kéo nằm trong cây mẫu của thùng như cánh và đợt — không còn là mẫu chèn rời: đổi rộng / sâu / cao của tủ trong Chenfeng thì mặt và hộp ngăn kéo tự chạy theo (sâu hộp tự nhảy bậc 50).
- Mỗi ô một lệnh; Chenfeng chỉ hỏi máy chủ **một lần cho cả ô** (trước đây mỗi hộp ngăn kéo một lần). Vẽ xong bảng đối chiếu từng mặt ngăn kéo và sâu hộp với thiết kế; lệch thì bỏ lệnh đó.
- Dùng được với các loại ngăn kéo của thẻ *Chuẩn xưởng*: ray bi (đáy mỏng / dày), ray âm đỡ đáy (kể cả hông soi rãnh), khung kéo treo quần, hộp ray Blum, khay bàn phím. Tham số riêng của từng loại (khe ray, hở trên / dưới…) và dày mặt của thiết kế được ghi vào mẫu khi vẽ.
- Mã mẫu ghi ở *Chuẩn xưởng* không có trong kho của tài khoản đang đăng nhập → bảng lấy mẫu **cùng tên** của tài khoản (chỉ đọc kho) và nhắc sửa mã.
- Ô nào chưa vẽ được bằng lệnh đó — ngăn kéo chia ô, *hở sau* khác 5 hoặc *bước sâu* khác 50, kho không có mẫu, Chenfeng dựng khác thiết kế… — thì bảng **chèn mẫu như bản trước** và ghi rõ ô nào, vì sao ở thẻ Kết quả. Suốt treo vẫn chèn mẫu.
- Sửa: loại ngăn kéo chưa khai mã mẫu (không vẽ ngăn kéo) không còn bị báo oan "Mẫu ngăn kéo đặt mặt khác thiết kế".

## Bảng gọn hơn; dời / đổi cỡ khung ngay trên mặt đứng (bản 1.25)

- **Chân thẻ Tủ là hàng nút biểu tượng** — chỉ còn một nút chữ lớn **Vẽ vào Chenfeng**; bên cạnh là **Tường** (đặt tủ theo tường) · **Chuột** (đặt tủ bằng chuột) · **Hình** (tủ theo hình đang chọn trên mặt bằng); hàng dưới: **Cập nhật** · **Sửa tủ** · **Chuẩn hoá** · JSON · CSV · Lưu · Mở. Rê chuột vào nút nào thì dòng ngay trên hàng nút ghi tên đầy đủ và cách dùng. Bảng rộng hơn (560) cho hình to, dễ nắm.
- **Khung trên mặt đứng kéo được** (thẻ Phòng): *nắm khung kéo* là dời, *nắm mép / góc kéo* là đổi cỡ — con trỏ đổi hình báo trước. Số của khung chỉ đổi khi nhả chuột; Esc lúc đang kéo là thôi.
- **Bắt điểm** — mép khung tới gần mép tường, sàn, trần, mép cửa, cột, dầm hay mép khung khác thì tự bám vào đó, có vạch báo chỗ bám; không gần gì thì số bắt chẵn 10. Giữ **Alt** = kéo tự do. Kéo mép chung của hai ô đã chia thì ô kề co giãn theo (không hở, không chồng).
- **↶ Lùi** (Ctrl + Z khi đang ở thẻ Phòng) — trả lại từng bước sửa của thẻ Phòng: dời, đổi cỡ, thêm, xoá khung, sửa số đo, lấy phòng khác. Gõ liền tay trong một ô là một bước. Không lùi qua lần đã vẽ vào Chenfeng — cái đó dùng nút *Hoàn tác* của lần vẽ.
- **Ô chọn của khung** (bản 1.25.1) — vẽ xong một khung, hoặc bấm vào một khung trên mặt bằng / mặt đứng, thì ngay dưới mặt đứng hiện ô chọn của khung đó: *Tủ tự chia khoang* (kèm ruột tủ) hoặc *Mẫu kho Chenfeng* (*Chọn mẫu kho…*), rồi **Vẽ vào Chenfeng** — không phải cuộn xuống tìm thẻ của khung. ✕ hoặc Esc để đóng; vẽ xong thì ô tự đóng.
- **＋ Vẽ khung trên mặt đứng** vẽ xong một khung là tự tắt (trước đây còn bật, nắm khung định dời lại thành vẽ thêm một khung chồng lên); lúc rê chuột đã thấy vạch báo góc khung sẽ bám vào đâu.

## Phòng đã đo trên điện thoại (bản 1.24)

Xưởng có trang **Đo hiện trạng** riêng (chạy trên máy chủ của xưởng) thì nối bảng với trang đó một lần: thẻ **Phòng** → khối **Phòng đã đo trên điện thoại** → dán *chuỗi kết nối* (địa chỉ kho `#` mã đọc — người có tài khoản đăng nhập trong trang đo rồi bấm *Mã kết nối máy vẽ → Cấp mã → Chép mã*) → **Nối máy chủ**.

- Phòng đo xong **tự hiện** trong khối đó — bảng tự hỏi lại mỗi phút khi thẻ Phòng đang mở; không ai phải gửi file hay chép mã phòng.
- **Lấy phòng** đưa số đo vào thẻ Phòng kèm ảnh hiện trạng đã kẻ sẵn kích thước để soát lại; **Lấy & vẽ** lấy rồi vẽ luôn phòng vào bản vẽ. Bảng không tự vẽ gì khi chưa bấm. Lấy lại cùng phòng (máy đo sửa tiếp) thì khung tủ đã đánh dấu, chỗ đặt và bản ghi lần vẽ trước vẫn giữ.
- Phòng chưa đủ số (chưa khép kín, thiếu cạnh…) thì bảng nêu thiếu gì và khoá nút vẽ; ảnh điện thoại chưa gửi xong thì bảng nói còn mấy ảnh chưa lên máy chủ.
- Bảng chỉ **đọc** hai địa chỉ của máy chủ đó (danh sách phòng, ảnh) bằng mã trong chuỗi kết nối: không gửi gì lên, không kèm cookie. Mã bị thu hồi thì bảng bỏ danh sách đang bày và thôi tự hỏi. Chuỗi kết nối cất trong máy vẽ này (localStorage `mncf.do.v1`), bấm **Ngắt** là xoá. Mã nguồn không ghi sẵn địa chỉ máy chủ nào.
- Mọi phép tính số đo (cạnh tự suy, chỗ đặt số trên ảnh) do máy đo làm sẵn trong gói gửi kèm từng phòng; bảng chỉ đọc gói đó. Phòng gửi từ trang đo bản cũ hơn / mới hơn bảng thì bảng nói rõ phải làm gì chứ không đoán.

## Đặt tủ theo tường, hộp chỉnh tủ, vẽ lại phòng (bản 1.23)

- **Đặt tủ theo tường** — thẻ Tủ → nút **Tường** (Đặt tủ theo tường): chọn tường → trên mặt đứng của tường đó *chạm* vào đoạn tường trống (lấy cả đoạn, sàn → trần hoặc tới đáy dầm) hoặc *kéo* một ô → **Tiếp**. Chỗ đặt tính từ phòng khai ở thẻ Phòng nên không phải bấm điểm nào trong bản vẽ. Khung đã có, cửa đi, cửa sổ thì chắn; cột / hộp kỹ thuật không chắn — tủ phủ qua và được khấu cột. Bấm *Hoàn tác lần vẽ này* thì chỗ vừa đặt cũng được trả lại (tường trống như trước).
- **Hộp chỉnh tủ** — đặt xong (bằng chuột hay theo tường) bảng hiện hộp chỉnh tủ: xem lại khoang, đợt, ngăn kéo; bấm **Vẽ vào Chenfeng** thì tủ mới được vẽ. *Chọn lại chỗ* quay về bước đặt; *Đóng* giữ tủ và chỗ đặt ở thẻ Tủ, chưa vẽ gì.
- **Khấu cột giữa** — cột nằm trong khoang: khoang giữ cân đối như tủ không có cột, đáy / nóc / đợt khoét quanh cột; bảng không tự thêm hay dời vách, đợt. Muốn vách đứng theo mép cột thì bấm *Đặt vách theo mép cột giữa (tuỳ chọn)*. Suốt treo của khoang có cột vẫn nằm giữa chiều sâu khoang (thanh suốt đi trước hộp che cột) — bảng chỉ nhắc đoạn suốt bị cột che; cột quá sâu, thanh suốt không lọt thì suốt mới lùi ra phần nông trước cột và có cảnh báo. Đổi khung không còn làm mất ngăn kéo / suốt treo ở ô sát đáy.
- **Vẽ lại phòng không vẽ chồng** — bấm *Vẽ phòng vào Chenfeng* lần nữa: bảng đối chiếu với phòng đang có trên bản vẽ, cái đã có đúng chỗ thì giữ, chỉ vẽ phần thay đổi; lỗ cửa / cột / dầm vẽ trùng từ bản trước được dọn; dấu điện – nước không đánh chồng. Tường lạ nằm trong lòng phòng sắp vẽ thì bảng dừng lại hỏi, không tự xoá.
- **Tấm trước, mẫu sau** — phần tấm của tủ không cần máy chủ Chenfeng nên được vẽ trước; hộp ngăn kéo / suốt treo (mẫu Chenfeng tải từ máy chủ) thêm sau. Máy chủ chậm hay rớt thì tủ vẫn đủ tấm, thẻ Kết quả nói rõ còn thiếu gì và có nút *Vẽ lại tủ này kèm ngăn kéo / suốt treo*. Mã mẫu ở thẻ Chuẩn xưởng không thuộc tài khoản đang đăng nhập → bảng dùng mẫu cùng tên trong kho của tài khoản đó và nhắc sửa mã.

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
# các bộ cần Playwright + Chromium: chuanhoa, ui, phong-ui, ext, nap, kho, doloi, mau-ui, xuatvan, sx, nk, goc
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
- `test/` — phép thử + trang giả lập Chenfeng (`mock-chenfeng.html`; bật `window.__MOCK_GOC__` thì có cả các lệnh vẽ tấm gốc — `goc.test.js` chạy trọn `D.veGoc` trên đó, `nk.test.js` thử lệnh ngăn kéo gốc) và trang sản xuất (`mock-sanxuat.html` + `mock-cutblock.html`); `kho-gia.js` chặn kênh cập nhật về `dist/` trong máy để phép thử chạy đúng bản vừa dựng.
- `dist/` — chỉ lưu 4 tệp của kênh cập nhật (`mn-chenfeng.js`, `mn-chenfeng-sx.js`, `phien-ban.json`, `mn-chenfeng.user.js`); phần còn lại sinh bằng `node build.js`.
- `tai-ve/` — zip tiện ích để cài (chỉ dựng lại khi sửa bộ nạp / manifest; mỗi lần dựng lại thì các máy phải cài lại một lần).
