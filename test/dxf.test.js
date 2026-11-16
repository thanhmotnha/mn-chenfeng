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
  eq(s.khoang.map(k => k.canh), [2, 2, 1], 'cánh đoán theo bề rộng');
  ok(m.doan.some(d => /Sâu thùng 580/.test(d)) && m.doan.some(d => /Cánh: K1 2 cánh, K2 2 cánh, K3 1 cánh bản lề trái/.test(d)), 'số đoán được kể tên', m.doan);
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
  ok(co(m.loi, /Chuỗi kích thước ngang cộng ra 1744 nhưng kích thước tổng ghi 1760/, 'loi'), 'chuỗi không cộng ra tổng', m.loi);
  ok(co(m.loi, /Chuỗi kích thước ngang hở 17/, 'canh_bao'), 'chuỗi hở');
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
  eq([a.bo.kieu, a.bo.canh[0].dai, a.bo.chau.s, a.bo.bep.s, a.bo.tl, a.bo.mrb], ['I', 3600, 1300, 2600, null, 600], 'chậu / bếp theo chữ, máy rửa bát');
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

console.log(`\n${pass} đạt, ${fail} hỏng`);
process.exit(fail ? 1 : 0);
