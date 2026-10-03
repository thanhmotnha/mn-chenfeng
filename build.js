'use strict';
// Gộp mã nguồn thành các bản phát hành trong dist/.  Chạy: node build.js
const fs = require('fs'), path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const W = (f, s) => { const p = path.join(__dirname, 'dist', f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); console.log('  ' + f.padEnd(44), (Buffer.byteLength(s) / 1024).toFixed(1) + ' KB'); };
const Core = require('./src/mncf-core.js');
const V = Core.VERSION;
const MO_TA = 'Nhập thông số tủ, kéo chia đợt trên hình, đặt ngăn kéo / suốt treo → tự vẽ thùng, hậu, phào, chân, cánh, ngăn kéo, suốt treo vào Chenfeng WebCAD. Chenfeng tự khoan lỗ.';

const bundle = `/* Một Nhà · Vẽ tủ vào Chenfeng — v${V} — bản gộp (lõi + phòng + dịch ghi chú + điều khiển + giao diện) */\n;(function(){\n${R('src/mncf-core.js')}\n${R('src/mncf-phong.js')}\n${R('src/mncf-dich.js')}\n${R('src/mncf-driver.js')}\n${R('src/mncf-ui.js')}\n}).call(typeof self !== 'undefined' ? self : this);\n`;
W('mn-chenfeng.js', bundle);

/* ---- kênh tự cập nhật: tiện ích (bộ nạp) hỏi dist/phien-ban.json trên GitHub, khác mã kiểm thì tải dist/mn-chenfeng.js ---- */
const KHO_RAW = 'https://raw.githubusercontent.com/thanhmotnha/mn-chenfeng/main/dist/';
const sha256 = require('crypto').createHash('sha256').update(Buffer.from(bundle, 'utf8')).digest('hex');
W('phien-ban.json', JSON.stringify({ phien_ban: V, sha256, kich_thuoc: Buffer.byteLength(bundle) }, null, 1) + '\n');

W('mn-chenfeng.user.js', `// ==UserScript==
// @name         Một Nhà · Vẽ tủ vào Chenfeng
// @namespace    https://motnha.vn/
// @version      ${V}
// @description  ${MO_TA}
// @match        https://cfcad.cn/*
// @match        https://www.cfcad.cn/*
// @match        https://hk.cfcad.cn/*
// @exclude      https://cfcad.cn/help/*
// @exclude      https://www.cfcad.cn/help/*
// @run-at       document-idle
// @grant        none
// @updateURL    ${KHO_RAW}mn-chenfeng.user.js
// @downloadURL  ${KHO_RAW}mn-chenfeng.user.js
// ==/UserScript==
${bundle}`);

/* ---- tiện ích Chrome (MV3) ---- */
// Tiện ích = BỘ NẠP (src/mncf-nap.js) + bản kèm sẵn để dự phòng. Cài một lần; bản mới tự về từ GitHub mỗi lần mở Chenfeng.
W('extension/nap.js', R('src/mncf-nap.js'));
W('extension/du-phong.js', `/* Bản kèm tiện ích (v${V}) — chỉ chạy khi không vào được kho GitHub và máy chưa cất bản nào. */\nwindow.__MNCF_DU_PHONG__ = { phien_ban: ${JSON.stringify(V)}, sha256: ${JSON.stringify(sha256)}, chay: function () {\n${bundle}\n} };\n`);
{ const cu = path.join(__dirname, 'dist', 'extension', 'mn-chenfeng.js'); if (fs.existsSync(cu)) fs.unlinkSync(cu); }
W('extension/manifest.json', JSON.stringify({
  manifest_version: 3, name: 'Một Nhà · Vẽ tủ vào Chenfeng', version: V, minimum_chrome_version: '111',
  description: 'Nhập thông số tủ, kéo chia đợt, đặt ngăn kéo / suốt treo → tự vẽ vào Chenfeng WebCAD, Chenfeng tự khoan lỗ.',      // Chrome giới hạn 132 ký tự
  content_scripts: [{ matches: ['https://cfcad.cn/*', 'https://www.cfcad.cn/*', 'https://hk.cfcad.cn/*'], exclude_matches: ['https://cfcad.cn/help/*', 'https://www.cfcad.cn/help/*'], js: ['du-phong.js', 'nap.js'], run_at: 'document_idle', world: 'MAIN' }],
  icons: { 48: 'icon48.png', 128: 'icon128.png' },
}, null, 2) + '\n');
for (const n of ['icon48.png', 'icon128.png']) {
  const src = path.join(__dirname, 'assets', n);
  if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(__dirname, 'dist', 'extension', n)); console.log('  extension/' + n); }
  else console.log('  (thiếu assets/' + n + ' — chạy node tools/make_icons.js)');
}
W('extension/DOC_TRUOC.txt', `MỘT NHÀ · VẼ TỦ VÀO CHENFENG — v${V}
Tiện ích cho Chrome / Edge / Cốc Cốc (bản 111 trở lên).

TỪ BẢN NÀY TIỆN ÍCH TỰ CẬP NHẬT — CÀI MỘT LẦN LÀ XONG
 Tiện ích trong thư mục này là BỘ NẠP: mỗi lần mở / tải lại trang Chenfeng, nó tự lấy bản mới nhất của bảng Một Nhà từ kho
 https://github.com/thanhmotnha/mn-chenfeng (đối chiếu mã kiểm SHA-256 rồi mới chạy) và cất một bản trong máy.
 Có bản mới: KHÔNG phải tải zip, không phải vào chrome://extensions — chỉ cần F5 trang Chenfeng (bản mới lên kho khoảng 5 phút là tới máy).
 Không vào được GitHub: chạy bản đã cất trong máy; máy chưa cất lần nào thì chạy bản kèm sẵn trong thư mục này (v${V}).
 Xem đang chạy bản nào: bảng Một Nhà → thẻ Hướng dẫn → khung "Cập nhật tự động" (có nút "Kiểm tra bản mới").

CÀI LẦN ĐẦU (máy nào cũng làm một lần)
 1. Giải nén file zip ra một thư mục cố định (vd D:\\MOTNHA\\mn-chenfeng). Đừng xoá thư mục này sau khi cài.
 2. Mở Chrome, gõ vào thanh địa chỉ:  chrome://extensions
 3. Bật "Chế độ dành cho nhà phát triển" (Developer mode) ở góc trên bên phải.
 4. Bấm "Tải tiện ích đã giải nén" (Load unpacked) → chọn thư mục vừa giải nén.
 5. Mở https://cfcad.cn, đăng nhập, mở một bản vẽ. Nút "Một Nhà · Vẽ tủ" hiện ở góc dưới bên phải.

MÁY ĐANG CÀI BẢN CŨ (1.13 trở về trước) — CHUYỂN SANG BẢN TỰ CẬP NHẬT
 1. Giải nén bản này ĐÈ lên thư mục cũ (hoặc ra thư mục mới rồi gỡ bản cũ, Load unpacked lại).
 2. Vào chrome://extensions → bấm nút tải lại (mũi tên tròn) trên thẻ "Một Nhà · Vẽ tủ vào Chenfeng".
 3. Tải lại trang Chenfeng (F5). Từ đây về sau không phải làm lại các bước này nữa.
 Thông số tủ và "Chuẩn xưởng" đã nhập ở bản cũ vẫn được giữ.

MỚI Ở BẢN 1.16 — CẢ TỦ LÀ MỘT MODULE · TỦ XOAY THEO TƯỜNG VẼ BẰNG LỆNH GỐC · TỦ THEO HÌNH VẼ TRÊN MẶT BẰNG
 CẢ TỦ LÀ MỘT MODULE: tủ vẽ bằng lệnh gốc giờ được gom thành một module mang mã tủ. Chọn 1 tấm → thẻ Template (Thông số) của Chenfeng →
 bấm dòng TRÊN CÙNG của cây mẫu (mã tủ) → gõ L / W / H mới vào cột Expression → Apply data modifications: thùng, vách, đợt, hậu, cánh
 (tấm tự động của Chenfeng) CÙNG phào, xà chân, khung hộc kéo, ngăn kéo, suốt treo đều chạy theo đúng quy tắc của bảng (khoang chia lại đều,
 cánh bằng nhau), Chenfeng khoan lại. Các dòng "左右侧板模板" bên dưới là từng thùng — kích thước của chúng tự tính theo module mẹ, đừng gõ đè.
 Đổi số đợt, số ngăn kéo, kiểu ruột: sửa ở bảng Một Nhà rồi bấm "Cập nhật tủ này".
 TỦ XOAY THEO TƯỜNG: tủ được vẽ ở một chỗ trống bên phải bản vẽ rồi tự đưa về chỗ đặt, xoay theo tường nào cũng được (thẻ Phòng → "Vẽ tủ vào khung").
 Tủ đã xoay vẫn đổi L / W / H được, và nút "Cập nhật tủ này" của bảng giờ dùng được cho cả tủ đã xoay.
 TỦ THEO HÌNH VẼ TRÊN MẶT BẰNG: trên mặt bằng của Chenfeng (nhìn từ trên xuống) vẽ một hình chữ nhật hoặc đa tuyến kín đúng chỗ tủ đứng —
 bắt điểm vào tường, cột; hình là phủ bì của tủ (rộng × sâu, kể cả cánh). Chỗ vướng cột: vẽ khuyết góc / khuyết giữa ở mép sau, hoặc cứ vẽ chữ nhật
 trùm qua cột của phòng (bảng tự khấu theo cột). Chọn hình → bấm "Tủ theo hình đang chọn trên mặt bằng": bảng lấy rộng, sâu, vị trí, hướng xoay,
 khấu cột; cao lấy theo trần của phòng (sửa ở ô Cao nếu tủ thấp hơn). Mặt trước tự nhận theo tường / chỗ khuyết; không nhận được thì bảng hỏi bấm
 1 điểm phía trước tủ; nhận sai thì bấm "Chọn lại mặt trước". Chia khoang, đợt xong bấm "Vẽ vào Chenfeng" — tủ dựng đúng chỗ hình, đúng hướng.
 Chưa nhận: hình có cạnh xiên / cong, tủ góc chữ L, chỗ khuyết không nằm ở mép sau. Ô chia trên MẶT ĐỨNG (vách tivi, đầu giường) + chọn module kho: bản sau.
 Giới hạn: tủ có khấu cột vẫn vẽ theo cách nhập tấm (vẫn là một module, xoay được); tủ không có phào / chân / khung hộc kéo thì mỗi thùng là một mẫu riêng.
 VẼ CHẮC HƠN: trước mỗi lệnh, bảng cho Chenfeng dò thử khoảng trống rồi kiểm lại, đúng mới vẽ. Đang vẽ anh sang tab khác làm việc được (chậm hơn một chút
 vì trình duyệt hãm tab bị che); lỡ xoay / thu phóng bản vẽ giữa chừng bảng tự chỉnh lại hướng nhìn. Chỉ cần đừng vẽ thêm vào chính bản vẽ đó cho tới khi bảng báo xong.

MỚI Ở BẢN 1.15 — VẼ TỦ BẰNG CHÍNH LỆNH CỦA CHENFENG (SỬA KÍCH THƯỚC NGAY TRONG CHENFENG)
 Trước đây bảng đẩy từng tấm vào Chenfeng rồi mới gom thành module. Từ bản này thùng tủ được dựng bằng đúng các lệnh gốc của Chenfeng:
 hồi trái / phải (左右侧板) → vách đứng (立板) → nóc / đáy theo từng khoang (顶底板) → hậu 6 li phủ sau (背板) → đợt (层板) → cánh (门板).
 Kết cấu: VÁCH CHẠY SUỐT, nóc / đáy nằm giữa các vách theo từng khoang. Tấm nào cũng là tấm mẫu của Chenfeng bám theo khoang của nó:
 chọn tủ → bảng Thông số của Chenfeng → đổi L / W / H là thùng, đợt, hậu, cánh tự chạy theo, Chenfeng tự khoan lại.
 Vẽ lâu hơn cách cũ (tủ 2 thân có ngăn kéo khoảng 50 giây) vì chạy từng lệnh.
 Các hộp thoại của Chenfeng được trả lại đúng lựa chọn anh đang để sau mỗi lệnh; bảng không bấm "Lưu cấu hình" của anh.
 (Bản 1.16 đã gom phào, xà chân, khung hộc kéo, ngăn kéo, suốt treo vào chung một module với thùng — xem mục 1.16 ở trên.)
 Tủ có KHẤU CỘT, hậu không phải kiểu phủ sau: bảng tự vẽ theo cách cũ và báo ở thẻ Kết quả.
 Tắt / bật: Chuẩn xưởng → "Cách vẽ vào Chenfeng" → "Vẽ bằng lệnh gốc của Chenfeng".

MỚI Ở BẢN 1.14 — KHẤU CỘT NẰM GIỮA TỦ
 Thẻ Tủ → khung "Khấu cột": ngoài cột ở góc trái / phải, nhập được tới 2 cột sát tường sau nằm GIỮA tủ (cách mép trái, rộng, sâu).
 Bảng dựng hai vách khấu hai bên cột, nóc / đáy / đợt khoét chữ U mép sau, hậu chia ba (hậu khấu trước mặt cột + hai hậu chính).
 Nút "Dời vách theo cột": tự dời vách gần nhất (hoặc thêm vách) cho trùng mép cột để không phát sinh tấm thừa.
 Thẻ Phòng: cột nằm giữa khung đặt tủ → "Mở thành tủ" / "Vẽ tủ vào khung" tự khấu đúng cột đó.

MỚI Ở BẢN 1.13 — KHẤU CỘT (TỦ NÉ CỘT Ở GÓC SAU) + CHỌN LOẠI NGĂN KÉO BẰNG HÌNH
 KHẤU CỘT: thẻ Tủ → khung "Khấu cột (cột ở góc sau của tủ)": gõ cột TRÁI / PHẢI lấn vào tủ bao nhiêu theo chiều ngang (đo từ mép ngoài
 phủ bì, kể cả phào) và theo chiều sâu (đo từ lưng tủ), khe hở quanh cột (mặc định 10). 0 = không khấu. Bảng dựng theo kết cấu xưởng:
 hồi phía cột nông lại, đáy / nóc / đợt vướng cột khoét góc chữ L, thêm một VÁCH KHẤU dọc mặt bên cột (vách nào có mặt trùng mép cột thì
 chính vách đó làm vách khấu, không thêm tấm), hậu 6 li chia hai mặt: HẬU KHẤU trước mặt cột + hậu chính sau lưng. Ngăn kéo trong khoang
 vướng cột tự ngắn lại. Dưới hình đứng có thêm hình "Nhìn từ trên xuống — khấu cột" để soát. Hiện làm với kiểu hậu phủ sau.
 Vào Chenfeng tấm khoét là tấm chữ L thật (đường bao 6 đỉnh), Chenfeng tự khoan liên kết với vách khấu; tủ vẫn là module tham số —
 đổi L / W / H thì góc khoét giữ nguyên kích thước cột. Bảng thống kê ghi "khoét góc sau trái 260 × 210 (khấu cột)" ở cột ghi chú.
 Thẻ Phòng: cột / hộp kỹ thuật sát tường trùm lên ĐẦU khung đặt tủ → bấm "Mở thành tủ" / "Vẽ tủ vào khung" là tủ tự khấu đúng cột đó
 (kể cả cột khai ở tường bên cạnh, sát góc). Cột nằm GIỮA khung thì bảng chưa khấu được — chia khung né ra.
 NGĂN KÉO: bấm vào ô ngăn kéo trên hình → nút hình bên cạnh ô "Loại" → hiện bảng hình các loại (ray bi / ray âm, đáy mỏng / dày,
 Blum thành 16 / 18…), bấm hình là đổi. Thẻ Chuẩn xưởng → "Các loại ngăn kéo": mỗi loại có hình, bấm hình để đặt làm loại mặc định.

MỚI Ở BẢN 1.12 — THÊM / KÉO VÁCH NGAY TRÊN HÌNH, GÕ SỐ ĐO TRÊN HÌNH PHÒNG, TÊN PHÒNG, DÀY VÁN 17,5 CHO MODULE KHO
 Thẻ Tủ: nút "＋ Vách" phía trên hình đứng → bấm vào chỗ bất kỳ trong tủ là thêm một vách đứng (hồi giữa) tại đó; kéo vách sang
 trái / phải để chia lại khoang; bấm vào vách để gõ số lọt lòng hoặc bỏ vách (gộp 2 khoang). Không cần gõ bề rộng khoang nữa.
 Thẻ Phòng: bấm thẳng vào SỐ ĐO trên mặt bằng (chiều dài từng tường, rộng cửa, khoảng cách từ đầu tường tới cửa, rộng / nhô của cột)
 hoặc trên mặt đứng (dài tường, cao trần) → ô nhập hiện ngay chỗ đó, gõ số, Enter. Xoá trống số đo một tường = để tường đó tự tính.
 Đang gõ ở dòng tường / cửa / cột nào trong form thì tường đó sáng lên trên mặt bằng — không phải đoán A, B, C là cạnh nào.
 "Vẽ phòng vào Chenfeng": nhãn phòng của Chenfeng mang tên phòng của bảng thay cho "未命名" (ghi KHÔNG DẤU vì phông nhãn của Chenfeng
 thiếu chữ có dấu tiếng Việt — "Phòng ngủ" thành "Phong ngu").
 Nút "Chuẩn hoá mẫu kho đang chọn": trước khi chuyển hậu, bảng đổi dày ván của module từ 18 sang ván của xưởng (17,5) bằng chính
 tham số BH của mẫu; tấm nào mẫu không nối với BH (thường là cánh) thì thẻ Kết quả nêu tên. Hoàn tác trả lại cả hai.
 Sửa lỗi: sau khi gõ vào một ô ở bảng Thông số bên phải của Chenfeng rồi bấm vẽ, bảng báo nhầm "Chenfeng đang ở trang chủ / màn chào".
 Nhắc: tủ do bảng vẽ là module tham số — chọn tủ, mở thẻ Template (Thông số) ở bảng phải của Chenfeng, gõ số mới vào cột
 EXPRESSION (cột cuối) của L / W / H rồi bấm "Apply data modifications". Cột "Parameter Value" chỉ để xem, không gõ được.

MỚI Ở BẢN 1.11 — CHUẨN HOÁ MODULE LẤY TỪ KHO MẪU CHENFENG (HẬU DÀY / HẬU ÂM RÃNH → HẬU 6 LI PHỦ SAU)
 Thùng tủ trong kho Chenfeng làm kiểu Trung: hậu dày 18 lọt lòng, hoặc hậu mỏng âm rãnh lùi 17–20 li có thanh giằng.
 Cách dùng: chèn module từ Kho mẫu vào bản vẽ như thường (để thẳng, chưa xoay) → bấm chọn 1 tấm của module →
 trong bảng Một Nhà bấm "Chuẩn hoá mẫu kho đang chọn → hậu 6 phủ sau" (dưới nút "Sửa tủ đang chọn").
 Bảng sửa ngay trên bản vẽ: hậu thành 6 li phủ sau lưng thùng (lùi mép 1, không khoan), hồi / nóc / đáy / đợt lùi mép sau cho vừa,
 bỏ thanh giằng sau hậu, đổi kiểu khoan cũ của mẫu sang kiểu khoan của xưởng rồi cho Chenfeng khoan lại. Tổng rộng / sâu / cao không đổi.
 Module vẫn là module tham số: đổi Rộng / Sâu / Cao, chân, dày ván ở ô Thông số của Chenfeng thì hậu vẫn phủ kín.
 Mẫu trong kho KHÔNG bị sửa (lần sau chèn lại thì chuẩn hoá lại). Làm nhầm: thẻ Kết quả → "Hoàn tác lần chuẩn hoá này".
 Đã thử thật trên 187 module một thùng của kho (tủ bếp, khung tủ áo…): 132 chuẩn hoá được, đổi kích thước xong hậu vẫn không đè tấm nào.
 Chưa làm được (bảng báo lý do, không sửa gì): module đang xoay, tủ góc, tủ né dầm / cột có hậu khuyết hoặc hậu nằm sâu,
 bộ ghép nhiều thùng (tủ sách, tủ sảnh, tatami… — hồi và vách là tấm tự động của Chenfeng).

MỚI Ở BẢN 1.10 — TỦ RỘNG TỰ TÁCH THÀNH CÁC THÙNG RỜI (THEO KHỔ VÁN)
 Tủ rộng hơn 2000 (số chỉnh ở Chuẩn xưởng → Thùng) không còn là một thùng liền: bảng tự chia thành các thùng rời, mỗi thùng không quá 2000.
 Ví dụ tủ 3000 ba khoang → thùng 2 khoang (≈ 1934) + thùng 1 khoang (≈ 967). Chỗ tách là 2 hồi áp lưng nhau (không còn 1 vách chung),
 mỗi thùng có nóc, đáy, hậu riêng — không tấm nào dài quá khổ ván, chở và lắp từng thùng được.
 Khoang nhỏ còn nằm gọn trong 2000 thì vẫn chung thùng, vách chung như cũ. Phào 2 bên, phào trên và xà chân vẫn bao cả dãy thành một khung chung;
 mối nối phào / xà chân ở chỗ tách rơi đúng đường áp lưng 2 hồi nên đầu thanh nào cũng có lỗ cam vào hồi của thùng mình.
 Hình đứng trong bảng có thêm hàng kích thước "thùng 1 / thùng 2…" và nét đứt đỏ ở chỗ tách.
 Cánh vẫn chia đều, khe cánh rơi đúng giữa chỗ 2 hồi áp lưng. Bảng tóm tắt ghi "Thùng: N thùng rời — …" kèm bề rộng từng thùng.
 Muốn tủ liền một thùng như bản cũ: Chuẩn xưởng → Thùng → "Rộng tối đa một thùng" = 0.
 Tủ đã vẽ bằng bản cũ: bấm "Lấy tủ đang chọn" vẫn mở đúng kết cấu thùng liền của nó, không tự tách.

MỚI Ở BẢN 1.9 — THẺ "PHÒNG": DỰNG PHÒNG HIỆN TRẠNG, VẼ PHÒNG VÀO CHENFENG, VẼ TỦ VÀO KHUNG
 Thẻ Phòng (cạnh thẻ Tủ): anh tự điền số đo hiện trạng — cao trần, dày tường, từng tường (đi vòng theo chiều kim đồng hồ), cửa / cửa sổ, dầm, cột.
 Bảng vẽ ngay mặt bằng và mặt đứng từng tường, báo phòng có khép kín không (hở bao nhiêu, tường nào thiếu / thừa).
 Để trống chiều dài một tường thì bảng tự tính cho phòng khép kín.
 Ảnh hiện trạng: kéo ảnh vào ô ảnh (hoặc Ctrl+V, hoặc bấm chọn) → bấm ảnh để xem to bên cạnh bảng, vừa nhìn vừa điền. Ảnh chỉ lưu trong máy này.
 "Vẽ phòng vào Chenfeng": dựng tường, lỗ cửa, cột, dầm bằng chính lệnh phòng của Chenfeng (thẻ House Design) — ra đối tượng phòng thật,
 có sàn, trần, diện tích; sửa tiếp bằng lệnh của Chenfeng được. Bề dày tường nằm ngoài lòng phòng. "Hoàn tác phòng" bỏ phòng vừa vẽ.
 Khung không gian = chỗ đặt tủ trên một tường (cách trái, rộng, cao, sâu). Bảng báo khung che cửa, vướng dầm cột, hai khung đâm nhau ở góc.
 "Mở thành tủ": dựng tủ có phủ bì đúng bằng khung (tự chọn ruột theo bề rộng hoặc theo mẫu anh chọn), mở ở thẻ Tủ để chia đợt, đặt ngăn kéo.
 "Vẽ tủ vào khung": vẽ luôn vào Chenfeng tại đúng vị trí khung và TỰ XOAY tủ theo tường của khung (lệnh xoay của Chenfeng, hoàn tác được).
 Tủ đã xoay vẫn là module tham số: sửa Rộng / Sâu / Cao ở ô Thông số của Chenfeng. Nút "Cập nhật tủ này" của bảng không dùng cho tủ đã xoay.
 Lưu ý: cột / hộp kỹ thuật Chenfeng vẽ cao hết tường; dầm có thể bị Chenfeng ép cao độ theo trần của nó (bảng báo khi lệch).

MỚI Ở BẢN 1.7 — TỦ VẼ RA LÀ MODULE THAM SỐ CỦA CHENFENG
 Vẽ xong, cả tủ là MỘT module tham số gốc của Chenfeng (tên = mã tủ). Chọn 1 tấm của tủ → ô "Thông số" bên phải của Chenfeng
 (nếu chưa thấy: gõ lệnh mở bảng tham số mẫu) hiện L = Rộng, W = Sâu, H = Cao → sửa số → bấm "Áp dụng":
 tủ co giãn đúng kết cấu (hồi, vách, đợt, cánh, phào, hộp ngăn kéo, suốt treo chạy theo), Chenfeng tự khoan lại. Ctrl+Z hoàn tác được.
 Đổi số đợt, số ngăn kéo, kiểu ruột, số cánh: sửa ở bảng Một Nhà rồi bấm "Cập nhật tủ này trên bản vẽ" (bảng tự lấy kích thước anh đã sửa trong Chenfeng).
 Đổi kích thước lớn tới mức phải thêm / bớt tấm (vd tủ thấp nâng lên quá khổ ván 2440) thì cũng dùng nút Cập nhật của bảng.
 Không muốn gom module: Chuẩn xưởng → Module Chenfeng → bỏ chọn.
 Ô "BH / Dày ván" trong bảng tham số chỉ để xem (17,5); đổi độ dày ván thì đổi ở Chuẩn xưởng của bảng Một Nhà.

MỚI Ở BẢN 1.6 — SỬA TỦ ĐÃ VẼ, KHÔNG PHẢI VẼ LẠI
 Vẽ xong, bảng tự nối với tủ đó: sửa số (rộng, cao, đợt, ngăn kéo, chuẩn xưởng…) rồi bấm "Cập nhật tủ này trên bản vẽ"
 → tủ cũ được bỏ, tủ mới nằm đúng chỗ cũ, không bấm điểm đặt lại. Hoàn tác được.
 Tủ vẽ từ trước (bằng bản 1.6 trở lên): bấm chọn 1 tấm của tủ trên bản vẽ → bấm "Sửa tủ đang chọn" → bảng mở lại thông số tủ đó.
 Dùng được cả khi đã vẽ thêm thứ khác, đã di chuyển tủ, đã lưu rồi mở lại bản vẽ. Tủ bị xoay thì không.
 Bản lề, tay nắm tự gắn thêm không bị xoá khi cập nhật (kiểm tra lại vị trí của chúng).
 Mỗi tấm tiện ích vẽ mang một ghi chú ngắn "MNCF: mã tủ" (ô Ghi chú / 备注 của tấm) để tìm lại tủ.
 Thông số từng tủ lưu trong trình duyệt của máy đã vẽ; sang máy khác thì mở file "Lưu mẫu" của tủ rồi bấm "Sửa tủ đang chọn".
 LƯU Ý: tấm do tiện ích vẽ vẫn là tấm rời — bảng "Thông số" bên phải của Chenfeng không có tham số; sửa tủ thì sửa ở bảng Một Nhà.
 Xà chân trước mặc định cao 100 (trước là 50). Thông số đang lưu trong máy nếu còn để 50 sẽ tự đổi sang 100; muốn 80: Chuẩn xưởng → Chân.

MỚI Ở BẢN 1.5 — HỘC NGĂN KÉO KÍN + BỘ MẪU TỦ ÁO
 Hộc ngăn kéo âm có xà sau khe phía trên mỗi mặt ngăn kéo và nẹp che khe hai bên (đổi số / tắt ở Chuẩn xưởng → Ngăn kéo âm).
 Vì có nẹp che, bản lề cánh không đặt trong vùng cao độ của hộc kéo.
 Tab Tủ có thêm "Mẫu tủ áo dựng sẵn": 8 mẫu 2–6 cánh, chọn rồi bấm "Dùng mẫu".

MỚI Ở BẢN 1.4 — GHI CHÚ THAM SỐ BẰNG TIẾNG VIỆT
 Cột "Ghi chú" (Remarks / 备注) của bảng tham số mẫu — bảng bên phải và bảng trong Kho mẫu — hiện bằng tiếng Việt
 (板厚 → Dày ván, 左前缩 → Hồi trái lùi trước…). Rê chuột vào ô để xem chữ gốc. Chỉ đổi chữ hiển thị trên máy đã cài tiện ích,
 không sửa mẫu / bản vẽ / tài khoản. Tắt, bật lại: bảng Một Nhà → tab Hướng dẫn → nút "Tắt dịch ghi chú".

Tiện ích chỉ chạy trên trang cfcad.cn, không gửi dữ liệu đi đâu, không lưu bản vẽ, không đổi cấu hình tài khoản Chenfeng.
`);

/* ---- trang độc lập + bản artifact ---- */
const pageCss = R('src/page.css').replace(/\s+$/, '');
const fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">';
const inline = bundle.replace(/<\/script/gi, '<\\/script');
W('mn-chenfeng.html', `<!doctype html>
<html lang="vi" data-mncf-page>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Một Nhà · Vẽ tủ Chenfeng</title>
${fonts}
<style>
${pageCss}
</style>
</head>
<body>
<script>
${inline}
</script>
</body>
</html>
`);
// Bản artifact: không có html/head/body (nơi đăng tự bọc), tự gắn cờ data-mncf-page trước khi chạy bản gộp.
W('artifact/ve-tu-chenfeng.html', `<title>Vẽ tủ Chenfeng</title>
${fonts}
<style>
${pageCss}
</style>
<script>
document.documentElement.setAttribute('data-mncf-page', '');
${inline}
</script>
`);
W('artifact/mn-chenfeng.js', bundle);

/* ---- lõi + dòng lệnh ---- */
W('mncf-core.js', R('src/mncf-core.js'));
W('mncf.js', `#!/usr/bin/env node
'use strict';
// Dòng lệnh: node mncf.js [mau_tu.json] [--out thư_mục]
//   Không có file mẫu → dùng tủ mẫu (tủ áo 3000×2800). In kiểm tra, ghi <tên>_chenfeng.json (thả vào Chenfeng / lệnh CF), bảng kê CSV, hình đứng SVG.
const fs = require('fs'), path = require('path');
const C = require('./mncf-core.js');
const a = process.argv.slice(2); const opt = { out: '.' }; let file = null;
for (let i = 0; i < a.length; i++) { if (a[i] === '--out') opt.out = a[++i]; else if (a[i] === '--help' || a[i] === '-h') { console.log('node mncf.js [mau_tu.json] [--out thu_muc]'); process.exit(0); } else file = a[i]; }
let spec; if (file) { const o = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\\ufeff/, '')); spec = o.spec || o; }
const M = C.build(spec);
for (const e of M.errors) console.log('LỖI  :', e);
for (const e of M.warnings) console.log('LƯU Ý:', e);
for (const e of M.notes) console.log('ghi chú:', e);
if (M.errors.length) { console.log('\\nThiết kế còn lỗi — chưa ghi file.'); process.exit(1); }
for (const l of C.summary(M)) console.log(l);
const cf = C.toChenfeng(M);
const base = (M.spec.ma || 'tu').replace(/[^\\w\\-]+/g, '_') + '_' + Math.round(M.spec.rong) + 'x' + Math.round(M.spec.cao);
fs.mkdirSync(opt.out, { recursive: true });
const w = (n, s) => { fs.writeFileSync(path.join(opt.out, n), s); console.log('đã ghi', path.join(opt.out, n)); };
w(base + '_chenfeng.json', JSON.stringify(cf.json));
w(base + '_bang_ke.csv', C.cutListCSV(M));
w(base + '_hinh_dung.svg', C.elevationSVG(M, { rong_px: 1000 }));
w(base + '_mau_tu.json', JSON.stringify({ mncf: C.VERSION, spec: M.spec }, null, 1));
console.log(\`Điểm gốc của cụm (trả lời khi Chenfeng hỏi 点取位置 nếu muốn giữ đúng toạ độ): \${cf.base.join(',')} — \${cf.so_tam} tấm, \${cf.so_mau} mẫu.\`);
`);
console.log('Xong — phiên bản', V);
