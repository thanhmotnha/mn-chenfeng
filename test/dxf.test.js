'use strict';
// Kiểm tra "Nạp bản vẽ CAD" (src/mncf-dxf.js, Node thuần):  node test/dxf.test.js
// File mẫu ở test/dxf-mau/ là file TỰ BỊA do test/dxf-mau/tao.py tạo (tên, số đo đều bịa) — không đưa bản vẽ thật của khách vào kho.
const fs = require('fs'), path = require('path');
const X = require('../src/mncf-dxf.js');
const C = require('../src/mncf-core.js');
let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) { pass++; } else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 1500)); } };
const eq = (a, b, name) => ok(JSON.stringify(a) === JSON.stringify(b), name, { got: a, want: b });
const T = (name, fn) => { const f0 = fail; try { fn(); } catch (e) { fail++; console.log('  ✗', name, '— ném lỗi:', e.stack); } console.log((fail === f0 ? '✓ ' : '✗ ') + name); };
const MAU = f => fs.readFileSync(path.join(__dirname, 'dxf-mau', f));
const co = (ds, re, muc) => ds.some(l => re.test(l.cau) && (!muc || l.muc === muc));
const dungDuoc = spec => { const M = C.build(spec); return { M, loi: M.errors }; };

T('Hàm phụ: MTEXT bỏ mã định dạng, bỏ dấu, hình chữ nhật', () => {
  eq(X.docMText('{\\fArial|b1|i0|c0|p34;TỦ ÁO}\\PPHÒNG {\\H1.5x;NGỦ}'), 'TỦ ÁO\nPHÒNG NGỦ', 'MTEXT');
  eq(X.docMText('A\\~B \\S1^2; \\\\x'), 'A B 1/2 \\x', 'dấu cách cứng, phân số, gạch chéo');
  eq(X.boDau('  KHOANG TREO\nĐỒ DÀI '), 'khoang treo do dai', 'bỏ dấu');
  eq(X.hcn([[0, 0], [10, 0], [10, 5], [0, 5]]), { x0: 0, x1: 10, y0: 0, y1: 5 }, 'chữ nhật 4 đỉnh không cờ kín');
  eq(X.hcn([[0, 0], [5, 0], [10, 0], [10, 5], [0, 5], [0, 0]]), { x0: 0, x1: 10, y0: 0, y1: 5 }, 'đỉnh thẳng hàng + đỉnh cuối trùng đầu');
  eq(X.hcn([[0, 0], [10, 1], [10, 5], [0, 5]]), null, 'hình xiên không nhận');
});

T('File hỏng / DWG: báo rõ, không ném lỗi', () => {
  const r = X.doc(MAU('gia.dwg'));
  eq(r.muc, [], 'không có mục');
  ok(r.loi_file.length === 1 && r.loi_file[0].muc === 'loi' && /DWG.*Save As/.test(r.loi_file[0].cau), 'DWG → Save As DXF', r.loi_file);
  const b = X.doc(Buffer.from('AutoCAD Binary DXF\r\n\x1a\x00rác'));
  ok(/nhị phân/.test(b.loi_file[0].cau), 'DXF nhị phân', b.loi_file);
  ok(/không phải DXF/.test(X.doc('xin chào\nđây không phải dxf').loi_file[0].cau), 'chữ thường', X.doc('xin chào').loi_file);
  ok(X.doc(new Uint8Array(0)).loi_file[0].muc === 'loi', 'file trống');
});

T('Tủ áo 3 khoang: khoang, đợt, ngăn kéo, suốt treo, thân dưới, chân, phào', () => {
  const buf = MAU('tu-ao.dxf');
  const r = X.doc(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));      // ArrayBuffer
  eq([r.ban, r.don_vi, r.muc.length], ['AC1032 (AutoCAD 2018)', 'mm', 1], 'một mục, mm');
  const m = r.muc[0];
  eq([m.ten, m.loai, m.rong, m.cao, m.t], ['TỦ ÁO PHÒNG NGỦ MẪU', 'tu', 2468, 2450, 17], 'tên (MTEXT 2 dòng, có mã định dạng), cỡ, ván 17');
  const s = m.spec;
  eq([s.phao, s.chan.cao, s.than.cao_duoi, s.thung.tach], [{ trai: 0, phai: 50, tren: 50 }, 100, 2150, []], 'phào phải 50 + phào trên 50, chân 100, hai thân');
  eq(s.khoang.map(k => [k.rong, k.dot]), [[800.5, [1600]], ['auto', [700]], [600, [500.3, 900.6, 1300.9]]], 'lọt lòng khoang (khoang rộng nhất tự chia) + đợt theo mặt dưới');
  eq(s.khoang.map(k => k.o), [[{ tu: 0, kieu: 'suot' }], [{ tu: 0, kieu: 'nk_am', so: 3 }, { tu: 700, kieu: 'suot' }], []], 'suốt treo (khối thường + khối *U lật gương), 3 ngăn kéo');
  eq(s.khoang.map(k => [k.canh, k.ban_le]), [[2, undefined], [2, undefined], [1, 'phai']], 'cánh đoán theo bề rộng; khoang 1 cánh ở mép phải mở về phía mép tủ (1.42.0)');
  ok(m.doan.some(d => /Sâu thùng 580/.test(d)) && m.doan.some(d => /Cánh: K1 2 cánh, K2 2 cánh, K3 1 cánh bản lề phải \(phía mép tủ\)/.test(d)), 'số đoán được kể tên', m.doan);
  ok(co(m.loi, /LED/, 'luu_y'), 'báo dải LED', m.loi);
  ok(co(m.loi, /kích thước ghi số làm tròn: 500 \(hình 500,3\)/, 'luu_y') && m.loi.find(l => /làm tròn: 500/.test(l.cau)).lam_tron, 'số ghi làm tròn = xám (lam_tron)', m.loi);
  ok(co(m.loi, /Chuỗi kích thước đứng cộng các số ghi ra 2449, tổng ghi 2450 — chỉ do làm tròn/, 'luu_y'), 'chuỗi lệch chỉ vì làm tròn', m.loi);
  ok(!m.loi.some(l => l.muc === 'loi'), 'không có dòng đỏ', m.loi.filter(l => l.muc === 'loi'));
  ok(m.tin_cay >= 0.9, 'tin cậy cao', m.tin_cay);
  const { M, loi } = dungDuoc(s);
  eq(loi, [], 'Core.build dựng được không lỗi');
  const o = M.info.o.filter(c => c.kieu).map(c => [c.khoang, c.than, c.kieu, c.so]);
  eq(o, [[0, 'D', 'suot', 0], [1, 'D', 'nk_am', 3], [1, 'D', 'suot', 0]], 'nội dung ô vào đúng chỗ trong lõi');
  ok(C.normalize(s).khoang.length === 3, 'normalize nhận');
  // cùng file đưa dạng chữ
  eq(X.doc(buf.toString('utf8')).muc[0].spec, s, 'đọc từ chuỗi chữ cũng ra như vậy');
});

T('Hai tủ trên một tờ (một tên): (1), (2); hai hồi áp lưng = tách thùng; mặt cắt cho sâu', () => {
  const r = X.doc(MAU('hai-tu.dxf'));
  eq(r.muc.map(m => [m.ten, m.loai, m.rong, m.cao]), [['TỦ GIÀY SẢNH MẪU (1)', 'tu', 1168, 2000], ['TỦ GIÀY SẢNH MẪU (2)', 'tu', 734, 1800]], 'hai mục, mặt cắt không thành mục');
  const [a, b] = r.muc;
  eq(a.spec.thung.tach, [1], 'tách thùng ở tấm đứng 1');
  ok(co(a.loi, /Hai tấm đứng áp lưng ở x 617 … 651 \(17 \+ 17\)/), 'báo hai hồi áp lưng', a.loi);
  eq([a.spec.chan.cao, a.spec.khoang[0].canh], [80, 0], 'chân theo xà chân cao 80; "KỆ HỞ" → không cánh');
  eq([b.sau, b.spec.sau_thung], [450, 450], 'sâu lấy từ mặt cắt');
  ok(!b.doan.some(d => /Sâu/.test(d)) && a.doan.every(d => !/Sâu thùng 580/.test(d)), 'không ghi sâu là số đoán', [a.doan, b.doan]);
  for (const m of r.muc) eq(dungDuoc(m.spec).loi, [], 'dựng được: ' + m.ten);
  const M = C.build(a.spec);
  ok(M.parts.filter(p => /Hồi/.test(p.ten)).length === 4, 'Core dựng 2 thùng (4 hồi)', M.parts.map(p => p.ten));
});

T('Bản vẽ có lỗi: chữ số gõ tay, chuỗi không cộng ra tổng, chuỗi hở, ván 30, đợt dài, thiếu nóc, điểm đo lệch mép', () => {
  const m = X.doc(MAU('loi.dxf')).muc[0];
  ok(co(m.loi, /Kích thước ghi 610 nhưng hình đo được 600 \(lệch 10 — chữ số bị gõ tay\)/, 'loi'), 'chữ số gõ tay', m.loi);
  ok(co(m.loi, /Kích thước ghi 1760 nhưng hình đo được 1751/, 'loi'), 'tổng gõ tay');
  // (1.42.0) phần hở đã báo riêng được cộng vào tổng (17 + 1100 + 610 + 17 + 17 hở = 1761)
  ok(co(m.loi, /Chuỗi kích thước ngang cộng ra 1761 \(kể cả 17 không ghi\) nhưng kích thước tổng ghi 1760/, 'loi'), 'chuỗi không cộng ra tổng', m.loi);
  ok(co(m.loi, /Chuỗi kích thước ngang thiếu đoạn 17 ở x 1117 … 1134 \(tấm đứng dày 17\)/, 'canh_bao'), 'chuỗi hở: nêu chỗ + tấm nằm trong khoảng hở', m.loi);
  ok(co(m.loi, /tấm dày 30 \(khác ván chính 17\)/, 'luu_y'), 'ván 30 chỉ liệt kê');
  ok(co(m.loi, /Khoang 1 lọt lòng 1100 > 1000/, 'canh_bao'), 'đợt dài > 1000');
  ok(co(m.loi, /Khoang 2: không có nóc/, 'canh_bao') && !co(m.loi, /Khoang 1: không có nóc/), 'khoang 2 thiếu nóc');
  ok(co(m.loi, /không trúng mép tấm \(cao 802 lệch 2\)/, 'canh_bao'), 'điểm đo lệch mép tấm 2', m.loi);
  const l = m.loi.find(q => /610/.test(q.cau)); ok(isFinite(l.x) && isFinite(l.y), 'dòng soát có toạ độ', l);
  ok(m.tin_cay < 0.7, 'tin cậy giảm', m.tin_cay);
  eq(dungDuoc(m.spec).loi, [], 'vẫn dựng được theo Chuẩn xưởng');
});

T('Vách lửng chia vùng ngăn kéo 2 cột: cảnh báo, dựng một cột; vách ốp = loại khác', () => {
  const r = X.doc(MAU('vach-lung.dxf'));
  const [m, v] = r.muc;
  const l = m.loi.find(q => /vách lửng.*2 cột/.test(q.cau));
  ok(l && l.muc === 'canh_bao' && l.chua_ho_tro, 'cảnh báo vách lửng chưa dựng được', m.loi);
  eq(m.spec.khoang.map(k => k.o), [[{ tu: 0, kieu: 'nk_am', so: 2 }]], '2 ngăn kéo (đếm một cột)');
  eq(dungDuoc(m.spec).loi, [], 'dựng được');
  eq([v.ten, v.loai, v.rong, v.cao, v.spec], ['VÁCH ỐP SẢNH MẪU', 'khac', 1618, 2400, undefined], 'vách: chỉ kích thước');
});

T('File cũ R2000 bảng mã ANSI_1258 (chữ tổ hợp dấu + \\U+): bếp chữ I, ghép chữ L', () => {
  const r = X.doc(MAU('bep-1258.dxf'));
  eq(r.ban, 'AC1015 (AutoCAD 2000)', 'bản');
  eq(r.muc.map(m => [m.ten, m.loai, m.rong]), [['TỦ BẾP MẪU (1)', 'bep', 3600], ['TỦ BẾP MẪU (2)', 'bep', 2400], ['Bếp chữ L (ghép TỦ BẾP MẪU (1) + TỦ BẾP MẪU (2))', 'bep', 3600]], 'tên giải đúng dấu (NFC), hai mặt đứng cùng tên được đánh số');
  const [a, b, L] = r.muc;
  // (1.42.0) chỗ chậu / bếp = TÂM chữ (TEXT căn trái cao 35: điểm chèn + nửa bề rộng chữ ước theo cỡ)
  eq([a.bo.kieu, a.bo.canh[0].dai, a.bo.chau.s, a.bo.bep.s, a.bo.tl, a.bo.mrb], ['I', 3600, 1386.8, 2665.1, null, 600], 'chậu / bếp theo tâm chữ, máy rửa bát');
  ok(b.bo.tl && b.bo.tl.dau === 'dau', 'tủ lạnh ở đầu trái', b.bo.tl);
  ok(a.doan.some(d => /chữ I dài 3600/.test(d)) && b.doan.some(d => /Chậu: bản vẽ không ghi/.test(d)), 'số đoán', [a.doan, b.doan]);
  eq([L.bo.kieu, L.bo.canh.map(c => c.dai), L.bo.chau.canh, L.bo.tl.canh], ['L', [3600, 2400], 0, 1], 'chữ L: cạnh A + B, tủ góc do Bộ bếp đặt');
  ok(C.xepBep(a.bo).pa.length > 0, 'Bộ bếp xếp được dãy 3600');
  ok(C.xepBep(L.bo).pa.length > 0, 'Bộ bếp xếp được chữ L');
  ok(r.muc.every(m => !m.loi.some(l => /không có (đáy|nóc)/.test(l.cau))), 'bếp không báo thiếu nóc (mặt đá thay nóc)');
});

T('Đơn vị: $INSUNITS cm → đổi ra mm', () => {
  const r = X.doc(MAU('tu-cm.dxf'));
  eq([r.don_vi, r.don_vi_goc, r.muc.length, r.muc[0].rong, r.muc[0].cao, r.muc[0].t], ['mm', 'cm', 1, 834, 1800, 17], 'nhân 10');
  eq(r.muc[0].spec.khoang.map(k => [k.rong, k.dot]), [['auto', [900]]], 'đợt theo mm');
});

T('Bảng mã: ANSI_1258 giải bằng TextDecoder, \\U+XXXX trong chuỗi', () => {
  const G = X.giaiMa(MAU('bep-1258.dxf'));
  eq([G.ban, G.trang_ma], ['AC1015', 'ANSI_1258'], 'đọc biến đầu file');
  ok(G.chu.indexOf('CHA\u0323') >= 0, 'byte 0xF2 của cp1258 = dấu nặng tổ hợp', null);
  const MH = X.docMoHinh(G.chu), F = X.lamPhang(MH);
  ok(F.chu.some(c => c.text === 'CHẬU RỬA') && F.chu.some(c => c.text === 'TỦ BẾP MẪU'), 'chữ sau khi giải \\U+ và gộp dấu (NFC)', F.chu.map(c => c.text));
});

/* ================= bản 1.42.0: vòng soát với bản vẽ thật — mọi file tự bịa (tao.py: mat_ben, ke_mo, vat, chuoi_kt, don_vi, day_la, tcvn3, long_nhau) ================= */
const DOC = (f, o) => X.doc(MAU(f), Object.assign({ t: 17.5 }, o || {}));

T('Mặt bên không ghi "mặt cắt" → chiều sâu (dòng vàng), không thành tủ riêng; tờ chỉ có tấm ốp → vẫn một mục; tên tờ ở thuộc tính khung tên', () => {
  const r = DOC('mat-ben.dxf');
  eq(r.muc.map(m => [m.ten, m.loai, m.rong, m.cao]), [['TỦ SÁCH PHÒNG MẪU', 'tu', 1600, 2400], ['TỦ GIÀY THUỘC TÍNH MẪU', 'tu', 934, 1500], ['VÁCH ỐP PHÒNG MẪU', 'khac', 2120, 2400]], 'ba tờ = ba mục (mặt bên không thành mục)');
  const [a, b, v] = r.muc;
  eq([a.sau, a.spec.sau_thung], [560, 560], 'sâu = bề rộng mặt bên');
  ok(a.doan.some(d => /Sâu 560 lấy theo bề rộng mặt bên.*100 \+ 443 \+ 17.*kiểm lại/.test(d)) && !a.doan.some(d => /Sâu thùng 580/.test(d)), 'sâu theo mặt bên là số đoán (kể các đoạn)', a.doan);
  ok(b.ten === 'TỦ GIÀY THUỘC TÍNH MẪU', 'tên lấy từ ATTRIB của khối khung tên');
  ok(v.loi.length === 1 && v.loi[0].muc === 'loi' && /Không thấy ≥ 3 tấm ván.*2 tấm ván, 3 hình vẽ dày hơn 60/.test(v.loi[0].cau), 'tờ chỉ có tấm ốp dày: một dòng đỏ nói lý do', v.loi);
  ok(v.hinh && v.hinh.r.length === 5, 'mục của tờ đó vẫn có hình gốc', v.hinh);
});

T('Khoang mép không hồi = kệ hở; nhãn căn trái đặt ngay mặt vách theo TÂM chữ; ngăn kéo không đáy có thanh dưới; bản lề mép phải; dải hộc sàn thấp', () => {
  const r = DOC('ke-mo.dxf');
  const [a, b, c] = r.muc;
  eq(a.spec.khoang.map(k => [k.rong, k.canh]), [[282.5, 0], ['auto', 2], [500, 0]], 'K1 đầu hở: không cánh, bớt một hồi Chuẩn xưởng (không bắt khoang auto co lại); K3 "KỆ HỞ" (tâm chữ) không cánh');
  ok(a.doan.some(d => /K1 đầu hở bên trái — kệ hở, không cánh; lọt lòng 300 trừ hồi 17,5 dựng thêm = 282,5/.test(d)), 'ghi số đoán đầu hở', a.doan);
  ok(co(a.loi, /Khoang 2: đáy không vẽ \(vùng ngăn kéo có thanh dưới 25 sát chân\)/, 'luu_y') && !co(a.loi, /Khoang 2: không có đáy/), 'không đáy + thanh dưới 25 = lưu ý, không cảnh báo', a.loi);
  eq(dungDuoc(a.spec).loi, [], 'dựng được');
  const Ma = C.build(C.normalize(a.spec)); eq(Ma.info.x_khoang.slice(0, 2), [17.5, 317.5], 'lõi dựng thêm hồi trái 17,5: vách đầu vẫn ở x 300 như bản vẽ (khoang sau không co)');
  eq(b.spec.khoang.map(k => [k.canh, k.ban_le]), [[2, undefined], [1, 'phai']], 'khoang 1 cánh ở mép phải: bản lề phải');
  eq([c.ten, c.rong, c.cao, c.spec.chan.cao, c.spec.khoang.map(k => [k.canh, k.o.map(o => o.kieu)])], ['KỆ SÀN MẪU', 1251, 200, 0, [[0, ['nk_am']], [0, ['nk_am']]]], 'dải 200 có vách chia: tủ thấp không chân, ngăn kéo hộc sàn không cánh');
  ok(co(c.loi, /chỉ cao 200 — dựng thành tủ thấp không chân/, 'canh_bao') && !c.loi.some(l => /không phải thân tủ/.test(l.cau)), 'báo tủ thấp, không báo "không phải thân tủ"', c.loi);
});

T('Tủ dưới cầu thang: hồi / vách đỉnh vát vẫn là hồi / vách, nóc dốc chỉ đếm', () => {
  const m = DOC('vat.dxf').muc[0];
  eq([m.rong, m.cao, m.spec.khoang.length, m.spec.khoang.map(k => k.dot)], [1568, 2000, 3, [[500], [500], [500]]], '3 khoang (hồi trái + 2 vách đỉnh vát nhận được)');
  ok(co(m.loi, /nóc \/ vách vát \(3 tấm đỉnh vát, 1 tấm nằm nghiêng bỏ qua\) — dựng chữ nhật theo phần thấp/, 'canh_bao'), 'cảnh báo tủ vát', m.loi);
  ok(!co(m.loi, /không có nóc/, 'canh_bao') && co(m.loi, /không có nóc.*nóc dốc/, 'luu_y'), 'khoang không nóc ngang của tủ vát = lưu ý');
  ok(!co(m.loi, /Khoang ngoài cùng/), 'không báo thiếu hồi');
  eq(X.hinhVat([[0, 0], [17, 0], [17, 1000], [0, 990]]), { x0: 0, x1: 17, y0: 0, y1: 990, vat: true }, 'hinhVat: chữ nhật theo phần thấp');
  eq(X.hinhVat([[0, 0], [900, 0], [900, 400], [0, 200]]), null, 'hình to (đường bao) không phải tấm vát');
});

T('Chuỗi kích thước: thiếu đoạn nêu chỗ, hai hồi áp lưng = lưu ý, tổng nằm cùng đường, khoảng tường giữa tủ dưới / trên, dòng trùng gộp', () => {
  const [a, b] = DOC('chuoi-kt.dxf').muc;
  ok(co(a.loi, /Chuỗi kích thước đứng thiếu đoạn 25 ở \+800 … \+825 \(tấm ngang dày 25/, 'canh_bao'), 'thiếu đoạn 25 ở đúng chỗ', a.loi);
  ok(co(a.loi, /không ghi hai tấm áp lưng 17 \+ 17 ở x 617 … 651/, 'luu_y') && !co(a.loi, /ngang (hở|chồng)/), 'hở 34 ở chỗ nối thân = lưu ý', a.loi);
  ok(!a.loi.some(l => l.muc === 'loi'), 'kích thước tổng nằm cùng đường: không "chồng", không lỗi tổng', a.loi.filter(l => l.muc !== 'luu_y'));
  ok(co(b.loi, /đứng để trống 630 ở \+870 … \+1500 — không có tấm/, 'luu_y'), 'khoảng tường = lưu ý', b.loi);
  ok(!b.loi.some(l => /cộng ra/.test(l.cau)), 'tổng cộng cả khoảng trống: không lỗi tổng', b.loi);
  eq(b.loi.filter(l => /Kích thước ghi 880/.test(l.cau)).length, 1, 'ba kích thước giống hệt cùng sai → một dòng');
});

T('Đơn vị / tỉ lệ: cm không nhân hai lần, header inch mà hình mm, hình tỉ lệ 1:2 (DIMLFAC 2)', () => {
  const a = DOC('cm-khong-khoi.dxf').muc[0];
  ok(!a.loi.some(l => l.muc === 'loi'), 'cm + kích thước không có khối *D: không lỗi oan', a.loi);
  ok(co(a.loi, /145 \(= 1450 mm\) \(hình 1451\)/, 'luu_y'), 'số ghi kèm mm', a.loi);
  const r = DOC('inch-hinh-mm.dxf');
  ok(r.muc.length === 1 && r.muc[0].rong === 1451 && co(r.loi_file, /\$INSUNITS = 1, inch\) không khớp hình .* theo mm/, 'canh_bao'), 'header inch, hình mm: đọc theo mm + cảnh báo', r.loi_file);
  const t = DOC('ti-le-12.dxf').muc[0];
  eq([t.rong, t.cao, t.t], [1451, 1800, 17], 'hình 1:2 nhân lại theo DIMLFAC');
  ok(co(t.loi, /tỉ lệ \(DIMLFAC 2/, 'canh_bao') && !t.loi.some(l => /tấm dày 8,5/.test(l.cau)), 'báo tỉ lệ, không báo ván 8,5', t.loi);
});

T('Nóc dày 30 lọt giữa hồi không phải phào; đáy 25 sát sàn không phải chân; tên trong khối chèn lật gương', () => {
  const n = DOC('noc-30.dxf').muc[0], d = DOC('day-25.dxf').muc[0];
  eq([n.spec.phao.tren, n.spec.chan.cao, d.spec.phao.tren, d.spec.chan.cao], [0, 0, 0, 0], 'không phào trên / không chân');
  ok(co(n.loi, /1 tấm dày 30 .*ngang 1417/, 'luu_y') && !co(n.loi, /không có nóc/), 'nóc 30: liệt kê ván dày khác, không báo thiếu nóc', n.loi);
  ok(co(d.loi, /2 tấm dày 25/, 'luu_y') && !co(d.loi, /không có đáy/), 'đáy 25: liệt kê, không báo thiếu đáy', d.loi);
  const k = DOC('khoi-ten.dxf').muc[0];
  eq([k.ten, k.rong, k.spec.khoang.length], ['TỦ TRONG KHỐI MẪU', 1451, 2], 'chữ trong khối có tấm nội thất được đọc');
});

T('Font Việt cũ TCVN3, file cắt cụt, khối lồng nhau bung quá trần: báo ở mức file', () => {
  const r = DOC('tcvn3.dxf');
  ok(co(r.loi_file, /font Việt cũ TCVN3 \/ VNI \(\.VnTime/, 'canh_bao'), 'TCVN3 → cảnh báo đổi font', r.loi_file);
  const buf = MAU('tu-ao.dxf'), cut = buf.subarray(0, Math.floor(buf.length * 0.8));
  const c = X.doc(cut);
  ok(co(c.loi_file, /File bị cắt cụt/, 'loi'), 'file thiếu EOF / ENDSEC → dòng đỏ mức file', c.loi_file);
  ok(!co(X.doc(buf).loi_file, /cắt cụt/), 'file đủ không báo');
  const t0 = Date.now(), L = DOC('long-nhau.dxf');
  ok(co(L.loi_file, /hơn 400 nghìn nét sau khi bung/, 'canh_bao') && Date.now() - t0 < 8000, 'khối lồng nhau: dừng bung, báo, không treo', [Date.now() - t0, L.loi_file]);
});

T('Dày ván Chuẩn xưởng của bảng (opt.t): lời "ván chính … chênh" so với đúng số đó', () => {
  const a = X.doc(MAU('tu-ao.dxf'), { t: 17 }).muc[0], b = X.doc(MAU('tu-ao.dxf'), { t: 18 }).muc[0];
  ok(!co(a.loi, /Ván chính trên bản vẽ dày/) && co(b.loi, /Ván chính trên bản vẽ dày 17/), 'Chuẩn xưởng 17 = bản vẽ: không báo; 18: báo', [a.loi.length, b.loi.length]);
});

T('Số ghi kích thước theo đơn vị bản vẽ (không nhân hai lần), MTEXT ^J', () => {
  eq(X.docMText('DONG 1^JDONG 2'), 'DONG 1\nDONG 2', '^J = xuống dòng');
  ok(!X.TRANG_MA.DOS437, 'cp437 không ánh xạ nhầm sang bảng Cyrillic');
});

console.log(`\n${pass} đạt, ${fail} hỏng`);
process.exit(fail ? 1 : 0);
