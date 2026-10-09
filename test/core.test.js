'use strict';
// Kiểm tra lõi tính kết cấu (Node thuần, không cần thư viện):  node test/core.test.js
const C0 = require('../src/mncf-core.js');
// Bản 1.29.2: mặc định dày hậu của xưởng là 6,5 (anh Thanh 08/10/2026). Toàn bộ số đo trong bộ thử này đo với hậu 6 (chuẩn 1.3 – 1.29.1) nên GHIM lại 6 cho cả bộ;
// chuẩn 6,5 có khối thử riêng ở cuối (nạp một bản lõi mới, không đụng bản đã ghim).
C0.DEFAULT_SPEC.hau.t = 6;
// Bản 1.31: có thêm kết cấu nóc, đáy phủ hồi (anh Thanh 08/10/2026), sẽ thành mặc định khi vẽ được bằng lệnh gốc. Số đo cũ của bộ thử này là kết cấu hồi phủ nóc đáy → GHIM 'lot'; kết cấu mới có khối thử riêng ở cuối (lõi nạp mới).
C0.DEFAULT_SPEC.thung.noc_day = 'lot';
// Bản 1.31: hộc kéo âm mặc định có KHUNG MẶT (thanh ngang phẳng mặt). Số đo cũ là khe + xà ẩn → ghim 0; khung mặt thử ở khối cuối.
C0.DEFAULT_SPEC.ngan_keo.khung_mat = 0;
// Toạ độ trong các phép thử cũ được nghiệm thu với chân 50. Từ bản 1.5 chân mặc định là 100 (anh Jason, 02/10/2026):
// thông số nào không khai chân thì ở đây vẫn dựng với chân 50; mặc định mới có phép thử riêng ở cuối file.
// Từ bản 1.10 tủ rộng tự tách thùng ≤ 2000 (anh Jason, 03/10/2026). Các phép thử cũ được nghiệm thu với MỘT thùng liền → ở đây thông số nào không khai `thung` thì dựng không tách;
// cách tách thùng có phép thử riêng ở cuối file.
const lienThung = s => (s && s.thung ? s : Object.assign({ thung: { rong_max: 0 } }, s || {}));
const C = Object.assign({}, C0, { build: s => C0.build(lienThung(s && s.chan ? s : Object.assign({ chan: { cao: 50 } }, s || {}))) });
let pass = 0, fail = 0;
const near = (a, b, tol = 0.011) => Math.abs(a - b) <= tol;
const ok = (c, name, extra) => { if (c) { pass++; } else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); } };
const eq = (a, b, name) => ok(JSON.stringify(a) === JSON.stringify(b), name, { got: a, want: b });
const T = (name, fn) => { const f0 = fail; try { fn(); } catch (e) { fail++; console.log('  ✗', name, '— ném lỗi:', e.message); } console.log((fail === f0 ? '✓ ' : '✗ ') + name); };
const P = (M, loai) => M.parts.filter(p => p.loai === loai);
const box = p => [p.x0, p.x1, p.y0, p.y1, p.z0, p.z1];
const overlapAny = (M) => { const out = []; for (let i = 0; i < M.parts.length; i++) for (let j = i + 1; j < M.parts.length; j++) if (C.overlap(M.parts[i], M.parts[j]) > 0) out.push(M.parts[i].ten + '×' + M.parts[j].ten); return out; };
// hộp của một mẫu ngăn kéo (toạ độ thế giới): mặt + hộp
const tplBox = tp => ({ x0: tp.pos[0], x1: tp.pos[0] + tp.box[0], y0: tp.pos[1], y1: tp.pos[1] + tp.box[1], z0: tp.pos[2], z1: tp.pos[2] + tp.box[2] });

/* Tủ của anh Jason trong hình báo lỗi: 2000 × 2800, 2 khoang, mỗi khoang 2 cánh + suốt treo, khoang phải có 2 ngăn kéo âm dưới đợt +520 */
const TU_2000 = { ma: 'TA2', rong: 2000, cao: 2800, hau: { t: 6 }, khoang: [
  { rong: 'auto', canh: 2, dot: [1800], o: [{ tu: 0, kieu: 'suot' }] },
  { rong: 'auto', canh: 2, dot: [520, 1800], o: [{ tu: 0, kieu: 'nk_am', so: 2 }, { tu: 520, kieu: 'suot' }] } ] };

T('Tủ mẫu 3000×2800: dựng không lỗi, đúng số tấm', () => {
  const M = C.build();
  eq(M.errors, [], 'không lỗi'); eq(M.warnings, [], 'không cảnh báo');
  eq(M.info.khoang, [941, 948, 941], 'lọt lòng khoang');
  ok(M.parts.length === 69, '69 tấm (63 tấm tủ + 2 vách đệm + 2 xà + 2 nẹp che khe)', M.parts.length);
  const dem = {}; for (const p of M.parts) dem[p.loai] = (dem[p.loai] || 0) + 1;
  eq(dem, { HOI: 4, VACH: 4, DAY: 6, NOC: 6, HAU: 6, DOT: 8, CHAN: 3, PHAO: 7, PHU: 7, DEM: 2, XA: 2, NEP: 2, CANH: 12 }, 'số tấm theo loại');
  eq(M.info.canh, { rong: [481], cao: [2147, 547], so: 12, ban_le: 42 }, 'cánh (bản 1.30: 6 cánh cao 2147 × 5 bản lề + 6 cánh 547 × 2)');
  eq([M.info.hop.x0, M.info.hop.x1, M.info.hop.y0, M.info.hop.y1, M.info.hop.z0, M.info.hop.z1], [0, 3000, -17.5, 580, 0, 2800], 'hộp bao = phủ bì');
  eq(overlapAny(M), [], 'không tấm nào đè nhau');
});

T('Thùng vách chung, chân trước che chân hồi, phào 50 — hậu dày lọt lòng (toạ độ đã nghiệm thu ở bản 1.0)', () => {
  const M = C.build({ hau: { kieu: 'day' } });
  const hoi = P(M, 'HOI').filter(p => p.than === 'D').map(box);
  eq(hoi, [[50, 67.5, 0, 580, 0, 2200], [2932.5, 2950, 0, 580, 0, 2200]], 'hồi thân dưới');
  eq(P(M, 'VACH').filter(p => p.than === 'D').map(p => [p.x0, p.x1]), [[1008.5, 1026], [1974, 1991.5]], 'vách chung');
  eq(P(M, 'CHAN').map(box), [[50, 1017, -17.5, 0, 0, 50], [1017, 1983, -17.5, 0, 0, 50], [1983, 2950, -17.5, 0, 0, 50]], 'xà chân trước nằm ở mặt phẳng cánh, nối tại tim khe cánh');
  const phaoT = P(M, 'PHAO').filter(p => p.ten === 'Phào trên').map(box);
  eq(phaoT, [[50, 1017, -17.5, 0, 2750, 2800], [1017, 1983, -17.5, 0, 2750, 2800], [1983, 2950, -17.5, 0, 2750, 2800]], 'phào trên');
  eq(P(M, 'PHAO').filter(p => p.ten === 'Phào trái').map(box), [[0, 50, -17.5, 0, 0, 2200], [0, 50, -17.5, 0, 2200, 2800]], 'phào trái chia theo thân');
  eq(P(M, 'DOT').filter(p => p.khoang === 1).map(box), [[1026, 1974, 0, 562.5, 520, 537.5], [1026, 1974, 0, 562.5, 1800, 1817.5]], 'đợt khoang giữa');
  eq(P(M, 'CANH').filter(p => p.than === 'D').map(p => [p.x0, p.x1, p.z0, p.z1, p.open]).slice(0, 2), [[52, 533, 52, 2199, 1], [535, 1016, 52, 2199, 2]], 'cánh thân dưới');
});

T('SỬA LỖI: ngăn kéo âm sau cánh mở phải tránh bản lề (tủ 2000×2800 trong hình báo lỗi)', () => {
  const M = C.build(TU_2000);
  eq(M.errors, [], 'không lỗi'); eq(M.warnings, [], 'không cảnh báo');
  eq(M.info.khoang, [924, 923.5], 'lọt lòng khoang như trong hình');
  const s = M.spec, dem = s.ngan_keo.dem, t = s.van.t;
  const bx = 50 + t + 924 + t, bw = 923.5;                 // khoang phải: mép trái lọt lòng, bề rộng
  const nks = M.templates.filter(x => x.loai === 'NGAN_KEO');
  ok(nks.length === 2, '2 ngăn kéo');
  for (const tp of nks) {
    const b = tplBox(tp);
    ok(b.x0 - bx >= dem - 0.011, 'hộp ngăn kéo cách hồi/vách bên trái ≥ ' + dem, b.x0 - bx);
    ok(bx + bw - b.x1 >= dem - 0.011, 'hộp ngăn kéo cách hồi/vách bên phải ≥ ' + dem, bx + bw - b.x1);
    eq(tp.box[0], bw - 2 * dem, 'bề rộng hộp mẫu = lọt lòng − 2 × đệm');
  }
  for (const q of M.mat_ngan_keo) {
    ok(q.x - bx >= dem + s.ngan_keo.khe_ben - 0.011 && bx + bw - (q.x + q.w) >= dem + s.ngan_keo.khe_ben - 0.011, 'mặt ngăn kéo lùi vào khỏi bản lề cả 2 bên', q);
    eq([q.w, q.h], [819.5, 203], 'mặt ngăn kéo 819,5 × 203 (trước khi sửa: 919,5 × 203)');
  }
  const D = P(M, 'DEM');
  eq(D.map(box), [[bx + dem - t, bx + dem, 30, 574, 67.5, 520], [bx + bw - dem, bx + bw - dem + t, 30, 574, 67.5, 520]], '2 vách đệm: đứng giữa đáy và đợt +520, mặt trong cách hồi/vách 50, chạy tới sát hậu; mép trước ngay sau lưng nẹp (bản 1.28)');
  ok(D.every(p => p.khoan === 'Cam3Tp' && p.type === 1), 'vách đệm là tấm đứng, khoan kiểu thùng');
  ok(near(D[0].x0 - bx, dem - t) && dem - t >= 25, 'khe cho bản lề giữa vách và vách đệm ≥ 25', dem - t);
  eq(overlapAny(M), [], 'vách đệm không đè tấm nào');
  // hộp + mặt ngăn kéo nằm gọn giữa 2 vách đệm, dưới đợt, trên đáy, không đụng hậu
  for (const tp of nks) { const b = tplBox(tp); ok(b.x0 >= D[0].x1 - 0.011 && b.x1 <= D[1].x0 + 0.011 && b.z0 >= 67.5 - 0.011 && b.z1 <= 520 + 0.011 && b.y1 <= 574 && b.y0 - t >= 12.5 - 0.011, 'ngăn kéo nằm gọn trong ô giữa 2 vách đệm', b); }
  ok(M.parts.length === 46, '46 tấm (kể cả 2 xà + 2 nẹp che khe của hộc ngăn kéo)', M.parts.length);
});

T('Đợt nằm trên vách đệm: cam của đợt phải ở MẶT TRÊN (mặt dưới bị đầu vách đệm che, không vặn được)', () => {
  const M = C.build(TU_2000);
  const dots = P(M, 'DOT').filter(p => p.khoang === 1);
  eq(dots.map(p => [p.z0, p.big]), [[520, 0], [1800, 1]], 'đợt +520 (trên vách đệm): cam mặt trên; đợt +1800: cam mặt dưới như thường');
  ok(P(M, 'DOT').filter(p => p.khoang === 0).every(p => p.big === 1), 'khoang không có ngăn kéo âm: giữ nguyên');
  const cf = C.toChenfeng(M).json.ModelSpace;
  const d520 = cf.find(x => x.Name === 'Đợt' && x.Pos[2] === 520); ok(d520 && d520.BigHole === 0, 'xuất sang Chenfeng: BigHole = 0 cho đợt +520', d520 && d520.BigHole);
  eq(M.warnings, [], 'không cảnh báo');
  // đợt kẹp giữa 2 ô ngăn kéo âm: vách đệm che cả 2 mặt → phải cảnh báo
  const M2 = C.build({ rong: 1000, cao: 2200, than: { cao_duoi: 0 }, khoang: [{ canh: 2, dot: [400, 800], o: [{ tu: 0, kieu: 'nk_am', so: 2 }, { tu: 400, kieu: 'nk_am', so: 2 }] }] });
  ok(M2.warnings.some(w => /che cả 2 mặt/.test(w)), 'đợt kẹp giữa 2 ô ngăn kéo âm → cảnh báo cam bị che cả 2 mặt', M2.warnings);
  // khoang không cánh: không có vách đệm → không đổi mặt cam
  const M3 = C.build({ rong: 1000, cao: 2200, than: { cao_duoi: 0 }, khoang: [{ canh: 0, dot: [520], o: [{ tu: 0, kieu: 'nk_am', so: 2 }] }] });
  ok(P(M3, 'DOT')[0].big === 1, 'không có vách đệm thì cam đợt vẫn ở mặt dưới');
});

T('Vách đệm chỉ đặt ở bên có bản lề', () => {
  const mk = (canh, ban_le) => C.build({ rong: 1000, cao: 2200, than: { cao_duoi: 0 }, khoang: [{ canh, ban_le, dot: [520], o: [{ tu: 0, kieu: 'nk_am', so: 2 }] }] });
  const bx = 67.5, bw = 1000 - 100 - 35;
  let M = mk(1, 'trai'); eq(M.errors, [], '1 cánh bản lề trái: không lỗi');
  eq(P(M, 'DEM').map(p => [p.x0, p.x1]), [[bx + 32.5, bx + 50]], 'chỉ có vách đệm bên trái');
  eq(M.templates.filter(x => x.loai === 'NGAN_KEO').map(x => [x.pos[0], x.box[0]]), [[bx + 50, bw - 50], [bx + 50, bw - 50]], 'hộp ngăn kéo sát hồi phải, cách hồi trái 50');
  M = mk(1, 'phai'); eq(P(M, 'DEM').map(p => [p.x0, p.x1]), [[bx + bw - 50, bx + bw - 32.5]], '1 cánh bản lề phải: chỉ có vách đệm bên phải');
  eq(M.templates.filter(x => x.loai === 'NGAN_KEO').map(x => [x.pos[0], x.box[0]]), [[bx, bw - 50], [bx, bw - 50]], 'hộp ngăn kéo sát hồi trái');
  M = mk(0); eq(P(M, 'DEM').length, 0, 'khoang không cánh: không cần vách đệm');
  eq(M.templates.filter(x => x.loai === 'NGAN_KEO').map(x => [x.pos[0], x.box[0]]), [[bx, bw], [bx, bw]], 'khoang không cánh: ngăn kéo chạy hết lọt lòng');
  eq(M.warnings, [], 'khoang không cánh: không cảnh báo');
});

T('Đệm = 0 hoặc quá hẹp thì phải cảnh báo; khoang quá hẹp thì chặn', () => {
  let M = C.build(Object.assign({}, TU_2000, { ngan_keo: { dem: 0 } }));
  ok(M.warnings.some(w => /vướng bản lề/.test(w)), 'đệm = 0 mà có cánh → cảnh báo vướng bản lề', M.warnings);
  eq(P(M, 'DEM').length, 0, 'đệm = 0 → không sinh vách đệm');
  M = C.build(Object.assign({}, TU_2000, { ngan_keo: { dem: 30 } }));
  ok(M.warnings.some(w => /khe cho bản lề/.test(w)), 'đệm 30 (khe 12,5) → cảnh báo khe hẹp', M.warnings);
  M = C.build(Object.assign({}, TU_2000, { ngan_keo: { dem: 10 } }));
  ok(M.errors.some(e => /vách đệm/.test(e)), 'đệm nhỏ hơn dày ván → lỗi', M.errors);
  M = C.build({ rong: 520, cao: 2200, than: { cao_duoi: 0 }, khoang: [{ canh: 2, dot: [520], o: [{ tu: 0, kieu: 'nk_am', so: 2 }] }] });
  ok(M.errors.some(e => /quá hẹp cho ngăn kéo âm/.test(e)), 'khoang 385 − 100 < 300 → lỗi quá hẹp', M.errors);
});

T('Chiều cao mặt ngăn kéo âm: chia đều, khe trên/giữa/dưới đúng chuẩn', () => {
  const M = C.build(TU_2000), nk = M.spec.ngan_keo;
  const f = M.mat_ngan_keo;
  eq(f.map(q => [q.z, q.h]), [[69.5, 203], [294.5, 203]], 'mặt: +69,5 và +294,5, cao 203');
  ok(near(f[0].z - 67.5, nk.khe_duoi) && near(f[1].z - (f[0].z + f[0].h), nk.khe_giua) && near(520 - (f[1].z + f[1].h), nk.khe_tren), 'khe dưới 2 / giữa 22 / trên 22,5');
  const tp = M.templates.filter(x => x.loai === 'NGAN_KEO');
  eq(tp.map(x => [x.pos, x.box]), [[[1059, 30, 67.5], [823.5, 500, 216]], [[1059, 30, 283.5], [823.5, 500, 236.5]]], 'mẫu: gốc = lưng mặt ngăn kéo (y = 30), hộp sâu 500');
  eq(tp[0].params, { BH: 17.5, GD: 13, LC: 0, SLK: 30, XLK: 30, SYS: -11, XYS: -2, ZYS: -2, YYS: -2 }, 'tham số mẫu ngăn dưới');
  ok(f.every(q => q.y === 12.5 && q.t === 17.5 && !q.trum), 'mặt ngăn kéo âm lùi sau mặt trước thùng 12,5');
  // 3 ngăn trong ô cao lẻ: mặt chẵn 0,5; phần dư dồn lên khe trên cùng
  const M3 = C.build({ rong: 1000, cao: 2200, than: { cao_duoi: 0 }, khoang: [{ canh: 0, dot: [700], o: [{ tu: 0, kieu: 'nk_am', so: 3 }] }] });
  eq(M3.errors, [], '3 ngăn: không lỗi');
  const h3 = M3.mat_ngan_keo.map(q => q.h); ok(h3.every(h => h === h3[0] && near(h * 2, Math.round(h * 2))), '3 mặt bằng nhau, chẵn 0,5', h3);
  const top = M3.mat_ngan_keo[2]; ok(700 - (top.z + top.h) >= nk.khe_tren - 0.011 && 700 - (top.z + top.h) < nk.khe_tren + 1.5, 'khe trên cùng ≥ chuẩn, dư < 1,5', 700 - (top.z + top.h));
});

T('Ngăn kéo trùm ngoài: mặt ở mặt phẳng cánh, cánh tự cắt ngắn, không cần vách đệm', () => {
  const spec = { rong: 2000, cao: 2800, khoang: [
    { canh: 2, dot: [1800], o: [{ tu: 0, kieu: 'suot' }] },
    { canh: 2, dot: [720, 1800], o: [{ tu: 0, kieu: 'nk_trum', so: 3 }, { tu: 720, kieu: 'suot' }] } ] };
  const M = C.build(spec);
  eq(M.errors, [], 'không lỗi'); eq(M.warnings, [], 'không cảnh báo');
  eq(P(M, 'DEM').length, 0, 'không có vách đệm');
  const f = M.mat_ngan_keo; ok(f.length === 3 && f.every(q => q.trum && q.y === -17.5 && q.t === 17.5), '3 mặt nằm ở mặt phẳng cánh (y −17,5…0)');
  const canhK1 = P(M, 'CANH').filter(p => p.khoang === 1 && p.than === 'D');
  ok(canhK1.length === 2, 'khoang 2 thân dưới còn 2 cánh (đã cắt ngắn)');
  const khe = M.spec.canh.khe;
  // mặt dưới cùng bắt đầu ở mép dưới cánh (chân 50 + khe 2); các mặt cách nhau đúng khe; cánh bắt đầu trên mặt trên cùng đúng 1 khe
  ok(near(f[0].z, 52), 'mép dưới mặt dưới cùng = +52', f[0].z);
  ok(near(f[1].z - (f[0].z + f[0].h), khe) && near(f[2].z - (f[1].z + f[1].h), khe), 'khe giữa các mặt = khe cánh');
  ok(near(canhK1[0].z0 - (f[2].z + f[2].h), khe), 'cánh cách mặt ngăn kéo trên cùng đúng 1 khe', [canhK1[0].z0, f[2].z + f[2].h]);
  ok(near((f[2].z + f[2].h + canhK1[0].z0) / 2, 720 + 17.5 / 2, 0.51), 'đường chia cánh / mặt ngăn kéo nằm ở tim đợt +720 (làm tròn 1 mm)');
  // bề ngang mặt = đúng vùng 2 cánh của khoang
  const c0 = canhK1[0], c1 = canhK1[1]; eq([f[0].x, f[0].x + f[0].w], [c0.x0, c1.x1], 'mặt ngăn kéo rộng bằng cả 2 cánh');
  ok(Math.max(...f.map(q => q.h)) - Math.min(...f.map(q => q.h)) <= 0.5 + 0.011, 'các mặt lệch nhau không quá 0,5', f.map(q => q.h));
  const tp = M.templates.filter(x => x.kieu === 'nk_trum');
  ok(tp.length === 3 && tp.every(x => x.pos[1] === 0 && x.box[0] === 923.5 && x.pos[0] === 50 + 17.5 + 924 + 17.5), 'hộp chạy hết lọt lòng khoang, gốc mẫu y = 0');
  ok(tp.every(x => x.params.ZYS > 0 && x.params.YYS > 0 && x.params.BH === 17.5), 'mặt trùm ra ngoài 2 bên (ZYS, YYS dương)');
  // các hộp xếp khít theo chiều cao trong ô
  ok(near(tp[0].pos[2], 67.5) && near(tp[2].pos[2] + tp[2].box[2], 720) && near(tp[0].pos[2] + tp[0].box[2], tp[1].pos[2]) && near(tp[1].pos[2] + tp[1].box[2], tp[2].pos[2]), 'các hộp xếp khít từ đáy tới đợt');
  // cánh và mặt ngăn kéo không chồng nhau
  for (const q of f) for (const p of P(M, 'CANH')) { const dx = Math.min(p.x1, q.x + q.w) - Math.max(p.x0, q.x), dz = Math.min(p.z1, q.z + q.h) - Math.max(p.z0, q.z); ok(!(dx > 0.011 && dz > 0.011), 'cánh không đè mặt ngăn kéo'); }
  // khoang 1 không bị ảnh hưởng
  ok(P(M, 'CANH').filter(p => p.khoang === 0 && p.than === 'D').every(p => p.z0 === 52 && p.z1 === 2199), 'cánh khoang 1 vẫn cao suốt');
});

T('Ngăn kéo trùm ngoài ở ô giữa: cánh chia thành đoạn trên và đoạn dưới', () => {
  const M = C.build({ rong: 1000, cao: 2200, than: { cao_duoi: 0 }, khoang: [{ canh: 2, dot: [800, 1200], o: [{ tu: 800, kieu: 'nk_trum', so: 2 }] }] });
  eq(M.errors, [], 'không lỗi');
  const canh = P(M, 'CANH'); ok(canh.length === 4, '4 tấm cánh (2 đoạn × 2 cột)', canh.length);
  const zs = [...new Set(canh.map(p => p.z0 + ':' + p.z1))].sort(); ok(zs.length === 2, '2 đoạn cao khác nhau', zs);
  const f = M.mat_ngan_keo; const lo = Math.min(...f.map(q => q.z)), hi = Math.max(...f.map(q => q.z + q.h));
  ok(canh.some(p => near(lo - p.z1, 2)) && canh.some(p => near(p.z0 - hi, 2)), 'đoạn cánh dưới và trên cách mặt ngăn kéo đúng 1 khe');
});

T('Ô và nội dung ô: đợt chia khoang thành ô; nội dung bám theo mốc `tu`', () => {
  const M = C.build(TU_2000);
  const o1 = M.info.o.filter(c => c.khoang === 1 && c.than === 'D').map(c => [c.tu, c.z0, c.z1, c.kieu, c.so]);
  eq(o1, [[50, 67.5, 520, 'nk_am', 2], [520, 537.5, 1800, 'suot', 0], [1800, 1817.5, 2182.5, '', 0]], 'khoang phải, thân dưới: 3 ô');
  ok(M.info.o.filter(c => c.than === 'T').length === 2, 'thân trên: mỗi khoang 1 ô');
  const M2 = C.build({ rong: 1000, cao: 2200, than: { cao_duoi: 0 }, khoang: [{ canh: 0, dot: [600], o: [{ tu: 0, kieu: 'suot' }, { tu: 10, kieu: 'nk_am', so: 2 }] }] });
  ok(M2.warnings.some(w => /cùng một ô/.test(w)), '2 nội dung vào cùng ô → cảnh báo, giữ cái đầu', M2.warnings);
});

T('Định dạng cũ (bản 1.0) vẫn mở được: ngan_keo {so, den} và suot', () => {
  const cu = { rong: 2000, cao: 2800, khoang: [{ rong: 'auto', canh: 2, dot: [1800], suot: 1800 }, { rong: 'auto', canh: 2, dot: [520, 1800], ngan_keo: { so: 2, den: 520 }, suot: 1800 }] };
  const s = C.normalize(cu);
  eq(s.khoang.map(k => k.o), [[{ tu: 0, kieu: 'suot' }], [{ tu: 0, kieu: 'nk_am', so: 2 }, { tu: 520, kieu: 'suot' }]], 'đổi sang nội dung ô');
  ok(s.khoang.every(k => !('ngan_keo' in k) && !('suot' in k)), 'bỏ khoá cũ');
  const A = C.build(cu), B = C.build(TU_2000);
  eq(A.parts.map(box), B.parts.map(box), 'dựng ra đúng như định dạng mới');
  eq(A.templates.map(t => [t.loai, t.pos, t.box]), B.templates.map(t => [t.loai, t.pos, t.box]), 'mẫu giống nhau');
  eq(C.normalize({ khoang: [{ dot: '400, 750 1100' }] }).khoang[0].dot, [400, 750, 1100], 'đợt gõ dạng chuỗi');
  const d4 = C.normalize({ khoang: [{ dot: 'deu:4' }] }).khoang[0].dot; ok(d4.length === 4 && d4.every((z, i) => i === 0 || near(z - d4[i - 1], d4[1] - d4[0], 0.11)), 'deu:4 → 4 đợt cách đều', d4);
});

T('Các loại ngăn kéo: mỗi ô chọn một loại = một mẫu trong kho Chenfeng', () => {
  const L = C.DEFAULT_SPEC.ngan_keo.loai;
  eq(L.map(x => [x.ma, x.mau_id]), [['bi_mong', 20216239], ['bi_day', 20216238], ['am_mong', 20216242], ['am_day', 20216240], ['am_mong_ranh', 20216243], ['am_day_ranh', 20216241], ['chia_o', 20216244], ['ke_quan', 20216245], ['blum16', 20216247], ['blum18', 20216248], ['ban_phim', 20216246]], '11 loại theo thư mục 抽屉 của tài khoản');
  ok(L.every(x => x.ten && x.ten_mau && typeof x.ts === 'object'), 'mỗi loại có tên, tên mẫu, tham số riêng');
  eq(C.DEFAULT_SPEC.ngan_keo.mac_dinh, 'bi_mong', 'loại mặc định');
  const mk = (o) => C.build({ rong: 1000, cao: 2200, than: { cao_duoi: 0 }, khoang: [{ canh: 0, dot: [520, 1000], o }] });
  // không chọn loại → loại mặc định, tham số y như bản 1.1
  let M = mk([{ tu: 0, kieu: 'nk_am', so: 2 }]);
  eq(M.templates.map(t => [t.id, t.ten, t.ma_loai]), [[20216239, '三节轨薄底抽', 'bi_mong'], [20216239, '三节轨薄底抽', 'bi_mong']], 'ô không chọn loại → loại mặc định');
  eq(Object.keys(M.templates[0].params), ['BH', 'GD', 'LC', 'SLK', 'XLK', 'SYS', 'XYS', 'ZYS', 'YYS'], 'thứ tự tham số giữ như cũ');
  // ray âm đáy dày: mẫu khác, tham số GDK thay cho GD
  M = mk([{ tu: 0, kieu: 'nk_am', so: 2, loai: 'am_day' }]);
  eq(M.errors, [], 'ray âm: không lỗi');
  eq(M.templates.map(t => [t.id, t.ten]), [[20216240, '托底轨厚底抽'], [20216240, '托底轨厚底抽']], 'ray âm đáy dày → mẫu 托底轨厚底抽');
  ok(M.templates[0].params.GDK === 24.5 && !('GD' in M.templates[0].params) && M.templates[0].params.BH === 17.5 && M.templates[0].params.XYS === -2, 'tham số riêng GDK, không có GD', M.templates[0].params);
  eq(M.info.o.filter(c => c.kieu).map(c => [c.kieu, c.so, c.loai]), [['nk_am', 2, 'am_day']], 'thông tin ô có loại');
  // 2 ô, 2 loại khác nhau trong cùng khoang
  M = mk([{ tu: 0, kieu: 'nk_am', so: 2, loai: 'blum18' }, { tu: 520, kieu: 'nk_trum', so: 2, loai: 'bi_day' }]);
  eq(M.errors, [], '2 loại trong 1 khoang: không lỗi');
  eq([...new Set(M.templates.map(t => t.kieu + ':' + t.id))], ['nk_am:20216248', 'nk_trum:20216238'], 'mỗi ô một mẫu riêng');
  ok(!('GD' in M.templates[0].params) && !('SLK' in M.templates[0].params) && M.templates[0].params.XLK === 30, 'hộp ray Blum: không có GD, SLK', M.templates[0].params);
  // ngăn kéo chia ô: mẫu nhận chiều cao mặt qua CMG
  M = mk([{ tu: 0, kieu: 'nk_am', so: 2, loai: 'chia_o' }]);
  eq(M.errors, [], 'chia ô: không lỗi');
  ok(M.templates[0].params.CMG === M.mat_ngan_keo[0].h && M.templates[0].params.CMG === 203, 'chia ô: CMG = cao mặt ngăn kéo', M.templates[0].params);
  // loại lạ → dùng mặc định
  M = mk([{ tu: 0, kieu: 'nk_am', so: 2, loai: 'khong_co' }]);
  ok(M.templates[0].id === 20216239 && !M.spec.khoang[0].o[0].loai, 'loại không có trong danh sách → về mặc định');
  // loại chưa có mã mẫu → cảnh báo, không xuất
  M = C.build({ rong: 1000, cao: 2200, than: { cao_duoi: 0 }, ngan_keo: { loai: [{ ma: 'x', ten: 'Loại thử', mau_id: 0, ten_mau: '', ts: 'GD=13; SLK=30, XLK = 30' }] }, khoang: [{ canh: 0, dot: [520], o: [{ tu: 0, kieu: 'nk_am', so: 2 }] }] });
  ok(M.warnings.some(w => /Chưa khai mã mẫu ngăn kéo/.test(w) && /Loại thử/.test(w)), 'loại chưa có mã mẫu → cảnh báo nêu tên loại', M.warnings);
  eq(M.spec.ngan_keo.loai[0].ts, { GD: 13, SLK: 30, XLK: 30 }, 'tham số riêng gõ dạng chữ "GD=13; SLK=30"');
  eq(M.spec.ngan_keo.mac_dinh, 'x', 'mặc định tự về loại đầu khi loại cũ không còn');
  eq([C.parseTS('GDK=24,5; SLK=30'), C.parseTS('GD=13, SLK = 30\nCMG=mat, BH=9'), C.tsText({ GDK: 24.5, CMG: 'mat' })], [{ GDK: 24.5, SLK: 30 }, { GD: 13, SLK: 30, CMG: 'mat' }, 'GDK=24.5; CMG=mat'], 'đọc tham số riêng: dấu phẩy thập phân, dấu phẩy ngăn cách, bỏ tham số do lõi tính');
  ok(C.toChenfeng(M).so_mau === 0, 'không xuất mẫu chưa có mã');
  // hộp quá thấp
  M = mk([{ tu: 0, kieu: 'nk_am', so: 5 }]);
  ok(M.errors.some(e => /hộp ngăn kéo chỉ còn/.test(e)), 'mặt 72,5 − (30 + 30) → hộp quá thấp → lỗi', M.errors);
  // bảng kê phụ kiện theo loại
  M = mk([{ tu: 0, kieu: 'nk_am', so: 2, loai: 'am_day' }, { tu: 520, kieu: 'nk_am', so: 2 }]);
  const pk = C.cutList(M).phu_kien.map(x => [x.ten, x.sl]);
  ok(pk.some(x => /Ray âm đỡ đáy · đáy dày/.test(x[0]) && x[1] === 2) && pk.some(x => /Ray bi 3 tầng · đáy mỏng/.test(x[0]) && x[1] === 2), 'bảng kê phụ kiện tách theo loại', pk);
  ok(C.summary(M).some(l => /Ray âm đỡ đáy · đáy dày ×2/.test(l)), 'tóm tắt nêu loại', C.summary(M));
});

T('Mẫu tủ lưu từ bản 1.0–1.1 (một mẫu ngăn kéo khai bằng mau_id / GD / SLK / XLK) vẫn mở đúng', () => {
  const cu = { rong: 2000, cao: 2800, ngan_keo: { mau_id: 20216239, ten_mau: '三节轨薄底抽', lui: 30, dem: 50, khe_tren: 22.5, khe_giua: 22, khe_duoi: 2, khe_ben: 2, GD: 12.5, SLK: 25, XLK: 30, LC: 0, buoc_sau: 50, ho_sau: 5 },
    khoang: TU_2000.khoang };
  const s = C.normalize(cu);
  ok(!('mau_id' in s.ngan_keo) && !('GD' in s.ngan_keo) && !('SLK' in s.ngan_keo) && !('ten_mau' in s.ngan_keo), 'bỏ khoá cũ');
  const d = s.ngan_keo.loai.find(x => x.ma === s.ngan_keo.mac_dinh);
  eq([d.ma, d.mau_id, d.ts], ['bi_mong', 20216239, { GD: 12.5, LC: 0, SLK: 25, XLK: 30 }], 'số cũ ghi vào loại mặc định');
  ok(s.ngan_keo.loai.length === 11, 'vẫn đủ các loại khác');
  const M = C.build(cu), nk0 = M.templates.find(t => t.loai === 'NGAN_KEO'); ok(nk0.params.GD === 12.5 && nk0.params.SLK === 25, 'dựng dùng số cũ', nk0.params);
  // mã mẫu cũ là mã riêng (không có trong danh sách) → ghi đè loại mặc định
  const s2 = C.normalize({ ngan_keo: { mau_id: 777, ten_mau: 'Mẫu riêng' } });
  const d2 = s2.ngan_keo.loai.find(x => x.ma === s2.ngan_keo.mac_dinh); eq([d2.mau_id, d2.ten_mau], [777, 'Mẫu riêng'], 'mã mẫu riêng của bản cũ được giữ');
  // mã mẫu cũ trùng một loại khác → loại đó thành mặc định
  const s3 = C.normalize({ ngan_keo: { mau_id: 20216240 } }); eq(s3.ngan_keo.mac_dinh, 'am_day', 'mã cũ trùng loại "ray âm đáy dày" → loại đó thành mặc định');
  // chuẩn hoá 2 lần không đổi
  eq(C.normalize(C.normalize(cu)), C.normalize(cu), 'chuẩn hoá lặp lại ra cùng kết quả');
});

T('Suốt treo: dùng mẫu, treo dưới tấm phía trên ô', () => {
  const M = C.build(TU_2000);
  const su = M.templates.filter(x => x.loai === 'SUOT');
  eq(su.map(x => [x.pos, x.box, x.params]), [[[67.5, 0, 67.5], [924, 574, 1732.5], { BH: 17.5, JS: 80, YGKC: 0 }], [[1009, 0, 537.5], [923.5, 574, 1262.5], { BH: 17.5, JS: 80, YGKC: 0 }]], 'hộp mẫu = đúng ô');
  const Mx = C.build({ rong: 1000, cao: 2200, than: { cao_duoi: 0 }, khoang: [{ canh: 0, dot: [200], o: [{ tu: 0, kieu: 'suot' }] }] });
  ok(Mx.errors.some(e => /không đủ chỗ treo suốt/.test(e)), 'ô quá thấp → lỗi', Mx.errors);
});

T('Chặn lỗi thiết kế', () => {
  ok(C.build({ khoang: [{ dot: [30] }] }).errors.some(e => /không nằm trong lọt lòng/.test(e)), 'đợt ngoài lọt lòng');
  ok(C.build({ khoang: [{ dot: [500, 520] }] }).errors.some(e => /quá sát nhau/.test(e)), '2 đợt quá sát');
  ok(C.build({ than: { cao_duoi: 2600 } }).errors.some(e => /khổ ván/.test(e)), 'thân cao hơn khổ ván');
  ok(C.build({ rong: 3000, khoang: [{ rong: 'auto', canh: 2 }] }).errors.some(e => /khổ ván/.test(e)), 'khoang rộng hơn khổ ván');
  ok(C.build({ khoang: [{ rong: 900 }, { rong: 900 }, { rong: 900 }] }).errors.some(e => /Tổng lọt lòng/.test(e)), 'tổng bề rộng khoang lệch');
  ok(C.build({ rong: 1000, cao: 2200, than: { cao_duoi: 0 }, khoang: [{ canh: 0, dot: [300], o: [{ tu: 0, kieu: 'nk_am', so: 5 }] }] }).errors.some(e => /mặt ngăn kéo chỉ cao/.test(e)), 'quá nhiều ngăn kéo cho ô');
  ok(C.build({ khoang: [] }).errors.length > 0, 'không có khoang');
  ok(C.build({ rong: 1000, cao: 2200, than: { cao_duoi: 0 }, khoang: [{ canh: 2, dot: [1990], o: [{ tu: 1990, kieu: 'nk_trum', so: 3 }] }] }).errors.some(e => /mặt ngăn kéo chỉ cao/.test(e)), 'ô trên cùng quá thấp cho 3 ngăn kéo trùm');
});

T('Hậu chuẩn xưởng (bản 1.3): 6 li, PHỦ sau lưng thùng, CHIA tấm tại vách, bắn đinh — không khoan', () => {
  const M = C.build(TU_2000);
  eq(M.errors, [], 'không lỗi'); eq(M.warnings, [], 'không cảnh báo');
  eq([M.spec.hau.kieu, M.spec.hau.t], ['phu', 6], 'mặc định: hậu phủ dày 6');
  const hau = P(M, 'HAU');
  // thùng x 50…1950; vách giữa x 991,5…1009 → mối nối tại 1000. Thân dưới: đáy z 50…67,5, nóc tới 2200; thân trên 2200…2750. Mép hậu lùi 1 mm so với mép ngoài thùng.
  eq(hau.map(box), [[51, 1000, 574, 580, 51, 2199], [1000, 1949, 574, 580, 51, 2199], [51, 1000, 574, 580, 2201, 2749], [1000, 1949, 574, 580, 2201, 2749]], 'mỗi thân 2 tấm hậu, nối trên vách giữa, nằm SAU thùng (y 574…580)');
  ok(hau.every(p => p.type === 2 && p.t === 6 && p.khoan === C.KHONG_KHOAN && p.fd === false && p.bd === false), 'hậu là tấm mặt dày 6, không khoan ở cạnh lẫn 2 mặt (bắn đinh)', hau.map(p => [p.type, p.t, p.khoan, p.fd, p.bd]));
  ok(['HOI', 'VACH', 'DAY', 'NOC'].every(l => P(M, l).every(p => p.y0 === 0 && p.y1 === 574)), 'hồi, vách, đáy, nóc sâu 574 (= sâu thùng 580 − hậu 6)');
  ok(P(M, 'DOT').every(p => p.y1 === 574) && P(M, 'DEM').every(p => p.y1 === 574), 'đợt và vách đệm chạy tới sát hậu');
  eq([M.info.hop.y0, M.info.hop.y1], [-17.5, 580], 'sâu phủ bì không đổi');
  eq(overlapAny(M), [], 'hậu không đè tấm nào');
  ok(M.parts.length === 46, 'vẫn 46 tấm', M.parts.length);
  const v = P(M, 'VACH').find(p => p.than === 'D');
  ok(hau[0].x1 - v.x0 >= 8 && v.x1 - hau[1].x0 >= 8, 'mỗi tấm hậu gối lên mép sau của vách ≥ 8 mm', [hau[0].x1 - v.x0, v.x1 - hau[1].x0]);
});

T('Hậu phủ xuất sang Chenfeng: tấm 6 li, 4 cạnh "不排", 2 mặt không khoan, không dán cạnh, tên ván riêng', () => {
  const ms = C.toChenfeng(C.build(TU_2000)).json.ModelSpace;
  const h = ms.filter(x => x.Name === 'Hậu');
  ok(h.length === 4, '4 tấm hậu', h.length);
  eq([h[0].BrType, h[0].Thickness, h[0].Pos, h[0].ContourCurve.map(c => c.pt), h[0].EachEdgeDrills, h[0].FrontDrill, h[0].BackDrill], [2, 6, [51, 574, 51], [[0, 0], [949, 0], [949, 2148], [0, 2148]], ['不排', '不排', '不排', '不排'], false, false], 'tấm hậu trái thân dưới: 949 × 2148 × 6 tại (51; 574; 51)');
  eq([h[0].UpSealed, h[0].DownSealed, h[0].LeftSealed, h[0].RightSealed], ['0', '0', '0', '0'], 'hậu mỏng không dán cạnh');
  const hoi = ms.find(x => x.Name === 'Hồi trái'); eq([hoi.UpSealed, hoi.ContourCurve[2].pt], ['1', [574, 2200]], 'tấm thùng vẫn dán cạnh 1; hồi sâu 574');
  const ms2 = C.toChenfeng(C.build(Object.assign({}, TU_2000, { van: { ten_van: 'MDF 17', vat_lieu: 'MDF', mau: 'Trắng' }, hau: { ten_van: 'MDF 6', mau: 'Trắng 1 mặt' } }))).json.ModelSpace;
  const h2 = ms2.find(x => x.Name === 'Hậu'), d2 = ms2.find(x => x.Name === 'Đáy');
  eq([h2.BrMatName, h2.Matrial, h2.Color, d2.BrMatName, d2.Color], ['MDF 6', 'MDF', 'Trắng 1 mặt', 'MDF 17', 'Trắng'], 'hậu ghi tên ván riêng; ô bỏ trống thì lấy theo ván thùng');
});

T('Hậu phủ: chia tấm theo khoang (mặc định) hoặc gộp khoang cho vừa khổ ván', () => {
  // tủ mẫu 3000: vách tại x 1008,5…1026 và 1974…1991,5 → mối nối 1017 và 1983
  const xz = M => P(M, 'HAU').map(p => [p.than, p.x0, p.x1, p.z0, p.z1]);
  eq(xz(C.build()), [['D', 51, 1017, 51, 2199], ['D', 1017, 1983, 51, 2199], ['D', 1983, 2949, 51, 2199], ['T', 51, 1017, 2201, 2749], ['T', 1017, 1983, 2201, 2749], ['T', 1983, 2949, 2201, 2749]], 'mỗi khoang 1 tấm hậu cho từng thân');
  const G = C.build({ hau: { chia: 'kho_van' } });
  eq(G.errors, [], 'gộp: không lỗi');
  eq(xz(G), [['D', 51, 1017, 51, 2199], ['D', 1017, 1983, 51, 2199], ['D', 1983, 2949, 51, 2199], ['T', 51, 1983, 2201, 2749], ['T', 1983, 2949, 2201, 2749]], 'thân dưới cao 2148 nên vẫn 3 tấm; thân trên thấp (548) gộp 2 khoang thành tấm 1932 × 548');
  eq(P(G, 'HAU').map(p => p.lines), [0, 0, 0, 1, 0], 'tấm gộp rộng hơn khổ 1220 → vân ngang (nằm dọc theo chiều dài khổ ván)');
  eq(overlapAny(G), [], 'gộp: không đè nhau');
  const E = C.build({ rong: 1500, cao: 2200, than: { cao_duoi: 0 }, khoang: [{ canh: 0 }] });
  ok(E.errors.some(e => /Hậu/.test(e) && /khổ ván/.test(e)), 'khoang 1365 không có vách để nối hậu → hậu 1398 > khổ 1220 → lỗi', E.errors);
});

T('Vẫn chọn được hậu dày lọt lòng (kiểu cũ) và hậu soi rãnh; dày hậu mặc định theo kiểu', () => {
  const M = C.build(Object.assign({}, TU_2000, { hau: { kieu: 'day' } }));
  eq(M.errors, [], 'không lỗi');
  eq(M.spec.hau.t, 17.5, 'hậu dày: mặc định dày bằng ván thùng');
  const h = P(M, 'HAU')[0];
  eq([box(h), h.khoan, h.bd], [[67.5, 991.5, 562.5, 580, 67.5, 2182.5], 'Cam3Tp', true], 'hậu dày lọt lòng khoang, nằm trong thùng, khoan cam');
  ok(P(M, 'HOI').every(p => p.y1 === 580) && P(M, 'DOT').every(p => p.y1 === 562.5), 'thùng sâu đủ 580, đợt dừng trước hậu');
  eq(C.toChenfeng(M).json.ModelSpace.find(x => x.Name === 'Hậu').UpSealed, '1', 'hậu dày vẫn dán cạnh như ván thùng');
  eq(C.normalize({ hau: { kieu: 'mong' } }).hau.t, 6, 'hậu soi rãnh: không gõ dày thì theo mặc định (bộ thử này ghim 6 — xem khối "Hậu 6,5")');
  eq(C.normalize({ hau: { kieu: 'phu' } }).hau.t, 6, 'hậu phủ: theo mặc định (ghim 6)');
  eq(C.normalize({ hau: { kieu: 'phu', t: 9 } }).hau.t, 9, 'dày hậu gõ tay thì giữ');
  eq(C.normalize({ hau: { kieu: 'gi_do' } }).hau.kieu, 'phu', 'kiểu lạ → về chuẩn xưởng');
  eq(C.normalize(C.normalize({ hau: { kieu: 'day' } })), C.normalize({ hau: { kieu: 'day' } }), 'chuẩn hoá lặp lại ra cùng kết quả');
});

T('Hậu phủ: số không hợp lệ thì chặn', () => {
  const E = C.build({ hau: { mep: 12 } });
  ok(E.errors.some(e => /hậu/i.test(e) && /5,5/.test(e)), 'mép lùi 12 → hậu chỉ gối 5,5 mm lên mép sau hồi → lỗi', E.errors);
  eq(C.normalize({ hau: { mep: -3 } }).hau.mep, 0, 'mép lùi âm → 0');
  ok(C.build({ sau_thung: 90, khoang: [{ canh: 2 }] }).errors.some(e => /quá nông/.test(e)), 'thùng sâu 90 → lỗi thùng quá nông');
});

T('Bảng kê + tóm tắt: hậu 6 li tách riêng khỏi ván thùng', () => {
  const M = C.build(TU_2000), cl = C.cutList(M);
  eq(cl.rows.filter(r => r.nhom === 'Hậu').map(r => [r.tu, r.dai, r.rong, r.day, r.sl, r.khoan, r.ghi_chu]),
    [['TA2-D', 2148, 949, 6, 2, 'không khoan', 'ốp sau lưng thùng, bắn đinh'], ['TA2-T', 949, 548, 6, 2, 'không khoan', 'ốp sau lưng thùng, bắn đinh']], 'hậu trong bảng kê: kích thước, không khoan, ghi cách lắp');
  // diện tích theo độ dày: 2 × (2148 × 949) + 2 × (949 × 548) = 5,117 m² ván 6
  const d6 = cl.theo_day.find(x => x.day === 6), d17 = cl.theo_day.find(x => x.day === 17.5);
  ok(d6 && d6.sl === 4 && near(d6.m2, 5.117008, 1e-6), 'ván 6: 4 tấm, 5,117 m²', d6);
  ok(d17 && d17.sl === 42 && near(d17.m2 + d6.m2, cl.tong_m2, 1e-6) && cl.theo_day.length === 2, 'ván 17,5: 42 tấm; hai độ dày cộng lại = tổng', cl.theo_day);
  ok(C.summary(M).some(l => /ván 6/.test(l) && /5,12 m²/.test(l)), 'tóm tắt ghi riêng diện tích ván 6', C.summary(M));
  ok(/Tổng ván dày 6,/.test(C.cutListCSV(M)), 'CSV có dòng tổng theo độ dày');
});

T('Thông số lưu từ bản trước 1.3 (hậu dày lọt lòng là mặc định cũ) → chuyển sang chuẩn hậu mới', () => {
  const cu = C.normalize(Object.assign({}, TU_2000, { hau: { kieu: 'day', t: 17.5, lui: 20, ranh_sau: 6, ranh_ho: 0.5 } }));      // như bản 1.2 đã lưu
  const r = C.nangCap(cu, '1.2.0');
  eq([r.spec.hau.kieu, r.spec.hau.t], ['phu', 6], 'hậu dày (mặc định cũ) → hậu phủ 6 li');
  ok(r.doi.length === 1 && /hậu/i.test(r.doi[0]), 'ghi lại thay đổi để báo người dùng', r.doi);
  eq(P(C.build(r.spec), 'HAU')[0].t, 6, 'dựng ra hậu 6 li');
  const m = C.nangCap({ rong: 1000, khoang: [{}], hau: { kieu: 'mong', t: 4 } }, '1.2.0'); eq([m.spec.hau.kieu, m.spec.hau.t, m.doi], ['mong', 4, []], 'hậu soi rãnh (dày gõ tay) là lựa chọn riêng của người dùng → giữ cả kiểu lẫn dày (dày 5 = mặc định cũ thì bản 1.29.2 nâng lên 6,5 — thử ở khối cuối)');
  const moi = C.nangCap({ rong: 1000, khoang: [{}], hau: { kieu: 'day', t: 17.5 } }, '1.3.0'); eq([moi.spec.hau.kieu, moi.doi], ['day', []], 'file lưu từ bản 1.3 mà chọn hậu dày → giữ hậu dày');
  eq(C.nangCap({ hau: { kieu: 'day', t: 17.5 } }, undefined).spec.hau.kieu, 'day', 'không rõ phiên bản → không tự đổi');
  eq(cu.hau.kieu, 'day', 'không sửa vào đối tượng đưa vào');
});

T('Hậu mỏng soi rãnh', () => {
  const M = C.build({ hau: { kieu: 'mong', t: 5 } });
  eq(M.errors, [], 'không lỗi');
  const h = P(M, 'HAU')[0]; eq([h.y0, h.y1, h.t, h.khoan], [555, 560, 5, C.KHONG_KHOAN], 'hậu 5 li lùi 20, không khoan');
  ok(P(M, 'HOI').every(p => p.holes.some(x => x.kieu === 'ranh')) && P(M, 'DAY').every(p => p.holes.length === 1), 'có rãnh trên hồi, đáy');
  ok(P(M, 'DOT').every(p => p.y1 === 555), 'đợt dừng trước hậu');
  ok(P(M, 'DEM').every(p => p.y1 === 555), 'vách đệm dừng trước hậu');
});

T('Xuất cho Chenfeng (晨丰导入)', () => {
  const M = C.build(TU_2000), cf = C.toChenfeng(M);
  const ms = cf.json.ModelSpace;
  ok(ms.length === 50 && cf.so_tam === 46 && cf.so_mau === 4, '46 tấm + 4 mẫu', [ms.length, cf.so_tam, cf.so_mau]);
  eq(cf.base, [0, -17.5, 0], 'điểm gốc = góc nhỏ nhất');
  const dem = ms.find(x => x.Name === 'Vách đệm ngăn kéo');
  eq([dem.Type, dem.BrType, dem.PositionType, dem.Thickness, dem.Pos, dem.ContourCurve.map(c => c.pt), dem.CabinetName, dem.EachEdgeDrills], ['Board', 1, 1, 17.5, [1041.5, 30, 67.5], [[0, 0], [544, 0], [544, 452.5], [0, 452.5]], 'TA2-D', ['Cam3Tp', 'Cam3Tp', 'Cam3Tp', 'Cam3Tp']], 'vách đệm: tấm đứng 544 × 452,5 (bản 1.28: lùi sau nẹp)');
  const nk = ms.filter(x => x.Type === 'Template' && x.TempalteId === 20216239);
  eq(nk[0], { Type: 'Template', TempalteId: 20216239, Name: '三节轨薄底抽', BoxSize: [823.5, 500, 216], Pos: [1059, 30, 67.5], RoomName: '', CabinetName: 'TA2-D',
    ParamMap: [['BH', '17.5'], ['GD', '13'], ['LC', '0'], ['SLK', '30'], ['XLK', '30'], ['SYS', '-11'], ['XYS', '-2'], ['ZYS', '-2'], ['YYS', '-2']].map(([name, value]) => ({ name, value })) }, 'mẫu ngăn kéo');
  ok(ms.filter(x => x.Type === 'Board' && x.OpenDir).length === 8, '8 cánh có hướng mở');
  ok(C.toChenfeng(M, { khong_mau: true }).json.ModelSpace.length === 46, 'tuỳ chọn không kèm mẫu');
  // bản 1.23 — tấm trước, mẫu sau: từng mẫu (ngăn kéo / suốt treo) tách riêng để nhập sau phần tấm; kèm chỗ mẫu phải nằm và mặt ngăn kéo của nó
  const dsMau = C.mauCF(M);
  eq(dsMau.map(x => [x.tp.loai, x.tp.khoang, x.json.TempalteId, x.json.Pos, x.json.BoxSize, x.mat ? [x.mat.x, x.mat.z, x.mat.w, x.mat.h] : null]),
    [['SUOT', 0, 20650931, [67.5, 0, 67.5], [924, 574, 1732.5], null], ['NGAN_KEO', 1, 20216239, [1059, 30, 67.5], [823.5, 500, 216], [1061, 69.5, 819.5, 203]], ['NGAN_KEO', 1, 20216239, [1059, 30, 283.5], [823.5, 500, 236.5], [1061, 294.5, 819.5, 203]], ['SUOT', 1, 20650931, [1009, 0, 537.5], [923.5, 574, 1262.5], null]],
    'mauCF: 4 mẫu theo đúng thứ tự thiết kế, mỗi mẫu một mục nhập riêng; ngăn kéo kèm mặt ngăn kéo của chính nó');
  eq(dsMau.map(x => x.json), ms.filter(x => x.Type === 'Template'), 'mục nhập của từng mẫu y hệt lúc xuất chung');
  const M0 = C.build(Object.assign({}, TU_2000, { ngan_keo: { mau_id: 0 } }));
  ok(M0.warnings.some(w => /Chưa khai mã mẫu ngăn kéo/.test(w)) && C.toChenfeng(M0).so_mau === 2, 'chưa khai mã mẫu → cảnh báo, không xuất mẫu ngăn kéo');
  eq(C.mauCF(M0).map(x => x.tp.loai), ['SUOT', 'SUOT'], 'mẫu chưa khai mã thì không có trong danh sách');
  // ngăn kéo âm ở khoang 1 + ngăn kéo TRÙM NGOÀI ở khoang 2: mỗi hộp đi với đúng mặt ngăn kéo của nó (cùng khoang, cùng cao độ), không lấy nhầm mặt của hộp khác
  const Mt = C.build({ ma: 'NT', rong: 1600, cao: 2200, khoang: [{ rong: 'auto', canh: 2, dot: [520], o: [{ tu: 0, kieu: 'nk_am', so: 2 }] }, { rong: 'auto', canh: 0, dot: [600], o: [{ tu: 0, kieu: 'nk_trum', so: 2 }] }] });
  const dsT = C.mauCF(Mt).filter(x => x.tp.loai === 'NGAN_KEO');
  eq([Mt.errors, dsT.map(x => [x.tp.kieu, x.tp.khoang, !!x.mat, x.mat && x.mat.khoang, x.mat && !!x.mat.trum, x.mat && Mt.mat_ngan_keo.indexOf(x.mat)])],
    [[], [['nk_am', 0, true, 0, false, 0], ['nk_am', 0, true, 0, false, 1], ['nk_trum', 1, true, 1, true, 2], ['nk_trum', 1, true, 1, true, 3]]], 'mauCF: 2 hộp ngăn kéo âm + 2 hộp trùm ngoài — hộp thứ k đi với mặt ngăn kéo thứ k');
  ok(dsT.every(x => x.mat.z >= x.tp.pos[2] - 40 && x.mat.z + x.mat.h <= x.tp.pos[2] + x.tp.box[2] + 40), '… mặt nằm ngang tầm với hộp của nó', dsT.map(x => [x.tp.pos[2], x.tp.box[2], x.mat.z, x.mat.h]));
});

T('Bảng kê, CSV, tóm tắt', () => {
  const M = C.build(TU_2000), cl = C.cutList(M);
  ok(cl.tong_sl === 46, 'tổng 46 tấm', cl.tong_sl);
  const d = cl.rows.find(r => r.ten === 'Vách đệm ngăn kéo'); eq([d.nhom, d.dai, d.rong, d.day, d.sl], ['Thùng', 544, 452.5, 17.5, 2], 'vách đệm trong bảng kê');
  ok(cl.phu_kien.some(p => /Ngăn kéo âm/.test(p.ten) && p.sl === 2) && cl.phu_kien.some(p => /Suốt treo/.test(p.ten) && p.sl === 2), 'phụ kiện');
  const csv = C.cutListCSV(M); ok(csv.charCodeAt(0) === 0xFEFF && /Vách đệm ngăn kéo/.test(csv) && /TỔNG VÁN/.test(csv), 'CSV có BOM, có vách đệm, có tổng');
  ok(C.summary(M).some(l => /Ngăn kéo: 2 âm \(mặt 819,5×203\)/.test(l)), 'tóm tắt nêu ngăn kéo', C.summary(M));
});

T('Hình đứng SVG + lớp tương tác (kéo đợt, bấm ô)', () => {
  const M = C.build(TU_2000);
  const tinh = C.elevationSVG(M);
  ok(/^<svg /.test(tinh) && /<\/svg>$/.test(tinh) && !/data-dot=/.test(tinh) && !/data-o=/.test(tinh), 'bản tĩnh không có lớp tương tác');
  const tt = C.elevationSVG(M, { tuong_tac: true, chon: { loai: 'dot', khoang: 1, idx: 0 } });
  eq((tt.match(/data-dot="/g) || []).length, 3, '3 vùng kéo cho 3 đợt');
  eq((tt.match(/data-o="/g) || []).length, M.info.o.length, 'mỗi ô một vùng bấm');
  ok(/data-dot="1:0"/.test(tt) && /data-o="1:50"/.test(tt) && />\+520</.test(tt), 'có vùng của đợt +520 và nhãn cao độ khi chọn');
  ok(/ngăn kéo 819,5×203/.test(tt) && /suốt treo/.test(tt), 'ghi kích thước mặt ngăn kéo');
  const sv = C.elevationSVG(M, { rong_px: 500, cao_px: 300 }); const w = +sv.match(/width="([\d.]+)"/)[1]; ok(w < 500 && w > 100, 'cao_px giới hạn cỡ hình', w);
});

T('Nhập liệu dạng chữ, số có dấu phẩy, giá trị thiếu', () => {
  const s = C.normalize({ rong: '2000', cao: '2.800'.replace('.', ''), van: { t: '17,5' }, khoang: [{ rong: '', canh: '2', dot: '520; 1800', o: [{ tu: '0', kieu: 'nk_am', so: '2' }, { kieu: 'khong_co' }] }] });
  eq([s.rong, s.cao, s.van.t, s.khoang[0].rong, s.khoang[0].canh, s.khoang[0].dot, s.khoang[0].o], [2000, 2800, 17.5, 'auto', 2, [520, 1800], [{ tu: 0, kieu: 'nk_am', so: 2 }]], 'chuẩn hoá');
  ok(C.build(undefined).errors.length === 0 && C.build({}).errors.length === 0 && C.build(null).errors.length === 0, 'thiếu thông số → dùng tủ mẫu');
  const M = C.build({ khoang: [{ o: [{ tu: 0, kieu: 'nk_am', so: 99 }] }] }); ok(M.spec.khoang[0].o[0].so === 12, 'số ngăn kéo chặn ở 12');
});

T('Một thân, không phào, không chân', () => {
  const M = C.build({ rong: 1200, cao: 2000, phao: { trai: 0, phai: 0, tren: 0 }, chan: { cao: 0 }, than: { cao_duoi: 0 }, khoang: [{ canh: 2, dot: [600, 1000], o: [{ tu: 0, kieu: 'nk_am', so: 2 }] }, { canh: 1, ban_le: 'phai', dot: [1000] }] });
  eq(M.errors, [], 'không lỗi');
  eq([M.info.hop.x0, M.info.hop.x1, M.info.hop.z0, M.info.hop.z1], [0, 1200, 0, 2000], 'hộp bao = phủ bì');
  ok(P(M, 'PHAO').length === 0 && P(M, 'CHAN').length === 0 && P(M, 'PHU').length === 0, 'không phào, không chân');
  ok(new Set(M.parts.map(p => p.tu)).size === 1 && M.parts[0].tu === 'TA1', 'một thân → tên tủ không có đuôi');
  eq(overlapAny(M), [], 'không đè nhau');
});

T('Bề rộng lọt lòng báo ra đúng tới 0,5 mm (lỗi cũ: khoang đầu bị làm tròn thành số nguyên)', () => {
  const M = C.build({ rong: 986, cao: 2200, phao: { trai: 0, phai: 0, tren: 0 }, than: { cao_duoi: 0 }, khoang: [{ rong: 'auto', canh: 2 }, { rong: 631, canh: 2 }] });
  eq(M.info.khoang, [302.5, 631], 'khoang đầu 302,5');
  ok(C.summary(M).some(l => /302,5 \/ 631/.test(l)), 'tóm tắt ghi 302,5');
});

T('Thử ngẫu nhiên 1500 tủ: không ném lỗi; tủ không báo lỗi thì không có tấm đè nhau, ngăn kéo âm luôn tránh bản lề, xuất được JSON', () => {
  let seed = 20261001; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const pick = a => a[Math.floor(rnd() * a.length)], ri = (a, b) => Math.round(a + rnd() * (b - a));
  const L = C.DEFAULT_SPEC.ngan_keo.loai.map(x => x.ma);
  let sach = 0, coNK = 0;
  for (let n = 0; n < 1500; n++) {
    const nb = ri(1, 4), khoang = [];
    for (let i = 0; i < nb; i++) {
      const dot = []; let z = ri(250, 700); while (z < 2050 && dot.length < 5) { dot.push(Math.round(z / 5) * 5); z += ri(120, 700); }
      const o = []; const moc = [0].concat(dot);
      for (const tu of moc) { const r = rnd(); if (r < 0.3) o.push({ tu, kieu: pick(['nk_am', 'nk_trum']), so: ri(1, 4), loai: rnd() < 0.5 ? pick(L) : undefined }); else if (r < 0.45) o.push({ tu, kieu: 'suot' }); }
      khoang.push({ rong: rnd() < 0.85 ? 'auto' : ri(400, 1000), canh: pick([0, 1, 2, 2]), ban_le: pick(['trai', 'phai']), dot, o });
    }
    const spec = { rong: ri(600, 3600), cao: ri(1800, 2900), sau_thung: pick([450, 550, 580, 600]), phao: rnd() < 0.3 ? { trai: 0, phai: 0, tren: 0 } : { trai: 50, phai: 50, tren: 50 }, chan: { cao: pick([0, 50, 80, 100]) },
      than: { cao_duoi: pick([0, 2000, 2200]) }, hau: pick([{}, {}, { chia: 'kho_van' }, { kieu: 'mong', t: 5 }, { kieu: 'day' }]), ngan_keo: { dem: pick([50, 50, 40, 60, 0]) }, khoang };
    let M;
    try { M = C.build(spec); } catch (e) { ok(false, 'build ném lỗi', { n, e: e.message, spec }); continue; }
    if (M.errors.length) continue;
    sach++;
    const ov = overlapAny(M).filter(x => !/Hậu/.test(x) || M.spec.hau.kieu !== 'mong');
    if (ov.length) ok(false, 'tủ không báo lỗi mà có tấm đè nhau', { n, ov: ov.slice(0, 3) });
    const cf = C.toChenfeng(M);
    if (cf.so_tam !== M.parts.length || !cf.json.ModelSpace.every(x => x.Type === 'Board' ? x.Thickness > 0 && x.ContourCurve.length === 4 : x.TempalteId > 0 && x.BoxSize.every(v => v > 0))) ok(false, 'JSON không hợp lệ', { n });
    // ngăn kéo âm trong khoang có cánh: hộp mẫu cách mỗi bên có bản lề đúng `dem`; mọi hộp mẫu nằm gọn trong lọt lòng khoang
    let x = M.spec.phao.trai + M.spec.van.t; const bay = M.info.khoang.map(w => { const r = [x, x + w]; x += w + M.spec.van.t; return r; });
    for (const tp of M.templates) if (tp.loai === 'NGAN_KEO') {
      coNK++;
      const k = M.spec.khoang[tp.khoang], [b0, b1] = bay[tp.khoang], x0 = tp.pos[0], x1 = tp.pos[0] + tp.box[0], dem = M.spec.ngan_keo.dem;
      if (x0 < b0 - 0.011 || x1 > b1 + 0.011) ok(false, 'hộp ngăn kéo lọt ra ngoài khoang', { n, x0, x1, b0, b1 });
      if (tp.kieu === 'nk_am' && dem > 0) {
        const trai = k.canh === 2 || (k.canh === 1 && k.ban_le !== 'phai'), phai = k.canh === 2 || (k.canh === 1 && k.ban_le === 'phai');
        if ((trai && x0 - b0 < dem - 0.011) || (phai && b1 - x1 < dem - 0.011)) ok(false, 'ngăn kéo âm không tránh bản lề', { n, x0, x1, b0, b1 });
      }
    }
    // mặt ngăn kéo không đè cánh
    for (const q of M.mat_ngan_keo) if (q.trum) for (const p of M.parts) if (p.loai === 'CANH') { const dx = Math.min(p.x1, q.x + q.w) - Math.max(p.x0, q.x), dz = Math.min(p.z1, q.z + q.h) - Math.max(p.z0, q.z); if (dx > 0.011 && dz > 0.011) ok(false, 'mặt ngăn kéo trùm đè cánh', { n }); }
    // hậu phủ nằm gọn trong sâu thùng, không lọt ra ngoài phủ bì
    if (M.spec.hau.kieu === 'phu' && (Math.abs(M.info.hop.y1 - M.spec.sau_thung) > 0.011 || M.parts.some(p => p.loai === 'HAU' && (p.x0 < M.spec.phao.trai - 0.011 || p.x1 > M.spec.rong - M.spec.phao.phai + 0.011)))) ok(false, 'hậu phủ lọt ra ngoài thùng', { n });
    // hình đứng vẽ được
    const svg = C.elevationSVG(M, { tuong_tac: true }); if (!/<\/svg>$/.test(svg)) ok(false, 'SVG hỏng', { n });
  }
  ok(sach >= 80 && coNK >= 300, 'đủ số tủ hợp lệ để phép thử có nghĩa', { sach, coNK });
});

/* ---- bản 1.5: hộc ngăn kéo âm là khung kín (xà sau khe mặt + nẹp che khe hai bên) ---- */
// hộp ngăn kéo (không kể mặt) theo chiều cao: mẫu để hộp thấp hơn mép trên mặt SLK, cao hơn mép dưới mặt XLK
const hopZ = (q, ts) => [q.z + (typeof ts.XLK === 'number' ? ts.XLK : 0), q.z + q.h - (typeof ts.SLK === 'number' ? ts.SLK : 0)];
T('Hộc ngăn kéo âm: xà sau khe phía trên mỗi mặt, nẹp che khe hai bên', () => {
  const M = C.build(TU_2000);
  eq(M.errors, [], 'không lỗi'); eq(M.warnings, [], 'không cảnh báo');
  const s = M.spec, t = s.van.t, nk = s.ngan_keo, bx = 50 + t + 924 + t, bw = 923.5;
  const X = P(M, 'XA'), N = P(M, 'NEP'), D = P(M, 'DEM'), F = M.mat_ngan_keo;
  eq(X.map(box), [[bx + 50, bx + bw - 50, 32, 49.5, 253.5, 313.5], [bx + 50, bx + bw - 50, 32, 49.5, 473, 520]], 'xà giữa cao 60 nằm giữa 2 hộp; xà trên sát mặt dưới đợt +520; cả hai lọt giữa 2 vách đệm, sau lưng mặt 2 mm');
  ok(X.every(p => p.type === 2 && p.t === t && p.khoan === 'Cam3Tp'), 'xà là ván đứng dày bằng ván thùng, khoan kiểu thùng');
  // bản 1.28 (anh Thanh 06/10/2026: "đang lộ hồi tấm rất xấu phải có xà che", chọn kiểu B): nẹp che LUÔN cạnh trước vách đệm — mặt trước chỉ còn cạnh hồi · nẹp · khe · mặt ngăn kéo
  eq(N.map(box), [[bx, bx + 50, 12.5, 30, 67.5, 520], [bx + bw - 50, bx + bw, 12.5, 30, 67.5, 520]], 'nẹp che: từ hồi/vách tới mép trong vách đệm (che cả cạnh trước vách đệm), ngang mặt ngăn kéo, cao bằng ô');
  ok(N.every(p => p.khoan === C.KHONG_KHOAN && near(p.x1 - p.x0, nk.dem)), 'nẹp rộng = khoảng đệm (50), bắn đinh — không khoan');
  ok(D.every(d => N.some(q => q.x0 <= d.x0 + 0.011 && q.x1 >= d.x1 - 0.011 && near(q.y1, d.y0))), 'mỗi vách đệm nằm ngay sau một nẹp phủ hết bề dày của nó — không lộ cạnh', [D.map(box), N.map(box)]);
  ok(F.every(q => near(q.y, N[0].y0) && near(q.y + q.t, N[0].y1)), 'mặt nẹp ngang mặt ngăn kéo');
  // xà che kín khe phía trên từng mặt và không đụng hộp ngăn kéo nào
  const ts = s.ngan_keo.loai.find(x => x.ma === s.ngan_keo.mac_dinh).ts;
  F.forEach((q, i) => { const khe0 = q.z + q.h, khe1 = i < F.length - 1 ? F[i + 1].z : 520, x = X[i];
    ok(x.z0 <= khe0 + 0.011 && x.z1 >= khe1 - 0.011, 'xà che kín khe trên mặt ' + (i + 1), [x.z0, x.z1, khe0, khe1]);
    ok(x.z0 >= hopZ(q, ts)[1] + 5 - 0.011, 'xà cao hơn đỉnh hộp ngăn dưới ≥ 5', [x.z0, hopZ(q, ts)[1]]);
    if (i < F.length - 1) ok(x.z1 <= hopZ(F[i + 1], ts)[0] - 5 + 0.011, 'xà thấp hơn đáy hộp ngăn trên ≥ 5', [x.z1, hopZ(F[i + 1], ts)[0]]); });
  ok(X.every(p => p.y0 >= F[0].y + F[0].t + nk.xa_ho - 0.011), 'xà nằm sau lưng mặt ngăn kéo');
  eq(overlapAny(M), [], 'xà, nẹp không đè tấm nào');
  ok(!M.notes.some(x => /bản lề của cánh KHÔNG đặt/.test(x)), 'bản 1.30.1: không còn ghi chú cấm bản lề trong vùng hộc kéo (anh Thanh: hộc thụt 5 cm, vách đệm 50 — không cấn)');
  const cl = C.cutList(M), rx = cl.rows.filter(r => r.ten === 'Xà ngăn kéo'), rn_ = cl.rows.filter(r => r.ten === 'Nẹp che khe ngăn kéo');
  eq(rx.map(r => [r.dai, r.rong, r.sl]), [[823.5, 60, 1], [823.5, 47, 1]], 'bảng kê: xà 823,5 × 60 và 823,5 × 47');
  eq(rn_.map(r => [r.dai, r.rong, r.sl, r.khoan]), [[452.5, 50, 2, 'không khoan']], 'bảng kê: 2 nẹp 452,5 × 50 không khoan');
  ok(/2 xà sau khe mặt, 2 nẹp che khe/.test(C.summary(M).join('\n')), 'tóm tắt có dòng hộc ngăn kéo');
  ok(/stroke-dasharray/.test(C.elevationSVG(M)) , 'hình đứng vẽ xà nét đứt');
  // Chenfeng nhận nẹp là tấm không khoan
  const cf = C.toChenfeng(M).json.ModelSpace.filter(o => o.Name === 'Nẹp che khe ngăn kéo');
  ok(cf.length === 2 && cf.every(o => o.BrType === 2 && o.EachEdgeDrills.every(k => k === C.KHONG_KHOAN) && !o.FrontDrill && !o.BackDrill), 'xuất Chenfeng: nẹp là tấm đứng mặt, không khoan');
});
T('Hộc ngăn kéo âm: tắt xà / tắt nẹp, 3 ngăn, 1 cánh, từng loại ngăn kéo', () => {
  let M = C.build(Object.assign({}, TU_2000, { ngan_keo: { xa_cao: 0 } }));
  eq([P(M, 'XA').length, P(M, 'NEP').length, M.parts.length], [0, 2, 44], 'xà cao 0 → không làm xà, vẫn có nẹp');
  M = C.build(Object.assign({}, TU_2000, { ngan_keo: { nep_khe: 0 } }));
  eq([P(M, 'XA').length, P(M, 'NEP').length, M.notes.length], [2, 0, 0], 'nẹp = 0 → để hở như bản 1.4, không còn ghi chú bản lề');
  M = C.build(Object.assign({}, TU_2000, { ngan_keo: { dem: 0 } }));
  eq([P(M, 'DEM').length, P(M, 'NEP').length, P(M, 'XA').length], [0, 0, 2], 'không vách đệm → không nẹp; xà chạy suốt lọt lòng khoang');
  ok(P(M, 'XA').every(p => near(p.x1 - p.x0, 923.5)), 'xà dài bằng lọt lòng khoang');
  // 1 cánh bản lề trái: chỉ có vách đệm + nẹp bên trái
  M = C.build({ rong: 700, cao: 2400, than: { cao_duoi: 0 }, khoang: [{ canh: 1, dot: [520], o: [{ tu: 0, kieu: 'nk_am', so: 2 }] }] });
  eq(M.errors, [], '1 cánh: không lỗi'); eq([P(M, 'DEM').length, P(M, 'NEP').length], [1, 1], '1 cánh bản lề trái: 1 vách đệm, 1 nẹp');
  ok(near(P(M, 'NEP')[0].x1, P(M, 'DEM')[0].x1) && near(P(M, 'NEP')[0].y1, P(M, 'DEM')[0].y0), 'nẹp che kín cạnh trước vách đệm, vách đệm ngay sau lưng nẹp');
  // 3 ngăn kéo: 2 xà giữa + 1 xà trên
  M = C.build({ rong: 1000, cao: 2800, khoang: [{ canh: 2, dot: [700], o: [{ tu: 0, kieu: 'nk_am', so: 3 }] }] });
  eq(M.errors, [], '3 ngăn: không lỗi'); eq(M.warnings, [], '3 ngăn: không cảnh báo');
  const X = P(M, 'XA'); ok(X.length === 3 && X.filter(p => p.tren).length === 1 && near(X[2].z1, 700), '3 xà, xà trên cùng sát đợt +700', X.map(box));
  eq(overlapAny(M), [], '3 ngăn: không tấm nào đè nhau');
  // từng loại ngăn kéo trong Chuẩn xưởng: xà không bao giờ chạm hộp
  for (const lo of C.DEFAULT_SPEC.ngan_keo.loai) {
    const Mx = C.build({ rong: 1000, cao: 2800, khoang: [{ canh: 2, dot: [520], o: [{ tu: 0, kieu: 'nk_am', so: 2, loai: lo.ma }] }] });
    eq(Mx.errors, [], lo.ma + ': không lỗi');
    const F = Mx.mat_ngan_keo, Xs = P(Mx, 'XA'), biet = !('CMG' in lo.ts), ts = biet ? lo.ts : {};
    for (const x of Xs) for (const q of F) { const [h0, h1] = hopZ(q, ts); ok(x.z1 <= h0 + 0.011 || x.z0 >= h1 - 0.011, lo.ma + ': xà không chạm hộp ngăn kéo', [x.z0, x.z1, h0, h1]); }
    ok(Xs.every(x => x.z1 - x.z0 >= 30 - 0.011 && x.z1 - x.z0 <= 60 + 0.011), lo.ma + ': xà cao 30–60', Xs.map(x => x.z1 - x.z0));
    eq(Mx.warnings, [], lo.ma + ': không cảnh báo');
    if (!biet) ok(Xs.length === 0 && Mx.notes.some(w => /không đủ chỗ đặt xà/.test(w)), lo.ma + ': hộp cao bằng mặt → không đặt xà, có ghi chú', Mx.notes);
    else ok(Xs.length === 2 || Mx.notes.some(w => /không đủ chỗ đặt xà/.test(w)), lo.ma + ': đủ 2 xà, hoặc có ghi chú khe nào để hở', [Xs.length, Mx.notes]);
    if (typeof lo.ts.SLK === 'number' && typeof lo.ts.XLK === 'number' && lo.ts.SLK >= 30 && lo.ts.XLK >= 30 && biet) ok(Xs.length === 2, lo.ma + ': loại ray thường (SLK, XLK ≥ 30) đủ 2 xà', Xs.length);
  }
});
T('Bộ mẫu tủ áo: mẫu nào cũng dựng sạch, giữ nguyên Chuẩn xưởng', () => {
  ok(C.MAU_TU.length >= 8 && new Set(C.MAU_TU.map(m => m.ma)).size === C.MAU_TU.length, 'có ít nhất 8 mẫu, mã không trùng', C.MAU_TU.length);
  for (const m of C.MAU_TU) {
    const s = C.apMau(null, m.ma), M = C.build(s);
    eq(M.errors, [], m.ma + ': không lỗi'); eq(M.warnings, [], m.ma + ': không cảnh báo');
    eq([M.spec.rong, M.spec.cao, M.spec.than.cao_duoi, M.spec.ten], [m.rong, m.cao, m.cao_duoi, m.ten], m.ma + ': đúng kích thước, tên');
    eq(overlapAny(M), [], m.ma + ': không tấm nào đè nhau');
    ok(M.info.canh.so === M.spec.khoang.reduce((a, k) => a + k.canh, 0) * (m.cao_duoi ? 2 : 1), m.ma + ': đủ số cánh', M.info.canh);
    ok(M.info.canh.rong.every(w => w >= 380 && w <= 600), m.ma + ': cánh rộng 380–600', M.info.canh.rong);
    ok(M.info.khoang.every(w => w <= 1000), m.ma + ': khoang không rộng quá 1000 (đợt không võng)', M.info.khoang);
    ok(M.templates.every(x => x.id), m.ma + ': ngăn kéo, suốt treo đều có mã mẫu');
    // khoảng treo: mỗi suốt treo có lọt lòng ≥ 950
    for (const tp of M.templates) if (tp.loai === 'SUOT') ok(tp.box[2] >= 950, m.ma + ': khoảng treo ≥ 950', tp.box[2]);
    ok(/<\/svg>$/.test(C.elevationSVG(M)) && C.toChenfeng(M).so_tam === M.parts.length, m.ma + ': vẽ hình đứng và xuất Chenfeng được');
  }
  // áp mẫu lên thông số đang dùng: Chuẩn xưởng giữ nguyên, khoang thay hết
  const dang = C.normalize({ sau_thung: 600, van: { t: 18, ten_van: 'MDF An Cường' }, hau: { t: 5 }, ngan_keo: { dem: 55, xa_cao: 70 }, khoang: [{ canh: 2, dot: [300] }] });
  const moi = C.apMau(dang, 'TA4-2000');
  eq([moi.sau_thung, moi.van.t, moi.van.ten_van, moi.hau.t, moi.ngan_keo.dem, moi.ngan_keo.xa_cao], [600, 18, 'MDF An Cường', 5, 55, 70], 'Chuẩn xưởng giữ nguyên');
  eq([moi.rong, moi.cao, moi.khoang.length, moi.khoang[0].dot], [2000, 2800, 2, [1900]], 'kích thước + khoang theo mẫu');
  eq(C.build(moi).errors, [], 'mẫu áp lên ván 18, sâu 600 vẫn dựng sạch');
  ok(C.apMau(dang, 'khong-co') === null, 'mã mẫu lạ → null');
  const a = C.apMau(null, 'TA6-3000'), b = C.apMau(null, 'TA6-3000'); a.khoang[0].dot.push(999);
  ok(b.khoang[0].dot.length === 1, 'mỗi lần áp mẫu là một bản riêng, sửa không lan sang lần sau');
});

T('Chân (xà chân trước) mặc định 100', () => {
  eq(C0.DEFAULT_SPEC.chan.cao, 100, 'mặc định 100');
  const M = C0.build();
  eq(M.errors, [], 'tủ mẫu với chân 100: không lỗi'); eq(M.warnings, [], 'không cảnh báo');
  const chan = P(M, 'CHAN'), day = P(M, 'DAY').filter(p => p.z0 < 200);
  ok(chan.length === 3 && chan.every(p => p.z0 === 0 && p.z1 === 100), 'xà chân trước cao 100', chan.map(p => [p.z0, p.z1]));
  ok(day.length === 3 && day.every(p => p.z0 === 100 && p.z1 === 117.5), 'đáy nằm trên chân: +100 … +117,5', day.map(p => [p.z0, p.z1]));
  eq(M.mat_ngan_keo.map(q => q.h), [178, 178], 'hộc 2 ngăn kéo dưới đợt +520: mặt cao 178');
  eq(overlapAny(M), [], 'không tấm nào đè nhau');
  const M80 = C0.build({ chan: { cao: 80 } });
  eq(M80.errors, [], 'chân 80: không lỗi'); ok(P(M80, 'CHAN').every(p => p.z1 === 80), 'chân 80');
  // thông số lưu từ bản trước 1.5.1 còn để chân 50 (mặc định cũ) → tự lên 100 và báo; số khác 50 là lựa chọn riêng → giữ
  const n1 = C0.nangCap({ rong: 1000, khoang: [{}], chan: { cao: 50 }, hau: { kieu: 'phu', t: 6 } }, '1.5.0');
  ok(n1.spec.chan.cao === 100 && n1.doi.length === 1 && /Xà chân trước/.test(n1.doi[0]), 'lưu từ 1.5.0, chân 50 → 100, có báo', n1);
  eq([C0.nangCap({ rong: 1000, khoang: [{}], chan: { cao: 80 } }, '1.5.0').spec.chan.cao, C0.nangCap({ rong: 1000, khoang: [{}], chan: { cao: 80 } }, '1.5.0').doi], [80, []], 'chân 80 tự đặt → giữ');
  eq([C0.nangCap({ rong: 1000, khoang: [{}], chan: { cao: 50 } }, '1.5.1').spec.chan.cao, C0.nangCap({ rong: 1000, khoang: [{}], chan: { cao: 50 } }, '1.5.1').doi], [50, []], 'lưu từ 1.5.1 mà chọn chân 50 → giữ');
  eq(C0.nangCap({ chan: { cao: 50 } }, undefined).spec.chan.cao, 50, 'không rõ phiên bản → không tự đổi');
  eq(C0.nangCap({ rong: 1000, khoang: [{}], chan: { cao: 50 }, hau: { kieu: 'day' } }, '1.2.0').doi.length, 2, 'lưu từ 1.2: đổi cả hậu lẫn chân, báo 2 dòng');
});

T('Mã tủ ghi trên từng tấm (để sửa tủ đã vẽ)', () => {
  const M = C0.build({});
  const co = C0.toChenfeng(M, { id: 'ABCD2345' }).json.ModelSpace, khong = C0.toChenfeng(M).json.ModelSpace;
  const tam = co.filter(o => o.Type === 'Board'), mau = co.filter(o => o.Type === 'Template');
  ok(tam.length === M.parts.length && tam.every(o => JSON.stringify(o.Remarks) === JSON.stringify([['MNCF ABCD2345', '']])), '(bản 1.29.2) có id → mọi tấm mang ghi chú TÊN "MNCF <id>", nội dung rỗng (trang sản xuất nối nội dung ghi chú vào tên tấm)');
  eq([C0.maTuCuaGhiChu([['MNCF ABCD2345', '']]), C0.maTuCuaGhiChu([['MNCF', 'ABCD2345']]), C0.maTuCuaGhiChu([['ghi chú khác', 'x'], ['MNCF Q2', '']]), C0.maTuCuaGhiChu([]), C0.maTuCuaGhiChu(null)], ['ABCD2345', 'ABCD2345', 'Q2', '', ''], 'đọc mã tủ: nhận cả dạng mới (tên) lẫn dạng cũ (nội dung), bỏ qua ghi chú khác');
  ok(mau.length > 0 && mau.every(o => !('Remarks' in o)), 'mẫu (ngăn kéo, suốt treo) không mang ghi chú — cổng nhập không nhận');
  ok(khong.every(o => !('Remarks' in o)), 'không có id (tải JSON) → không ghi chú');
  eq(C0.KHOA_TU, 'MNCF', 'tên ô ghi chú');
});

T('Hệ số tuyến tính để dựng module tham số gốc của Chenfeng (heSo)', () => {
  const hop = p => [p.x0, p.x1, p.y0, p.y1, p.z0, p.z1];
  for (const m of C0.MAU_TU) {
    const sp = C0.apMau({}, m.ma), h = C0.heSo(sp);
    ok(h.bien.L && h.bien.W && h.bien.H && h.bien.L.sai_so <= 0.5 && h.bien.W.sai_so <= 0.5 && h.bien.H.sai_so <= 0.5, `${m.ma}: cả 3 kích thước tuyến tính`, h.bien.L && [h.bien.L.sai_so, h.bien.W && h.bien.W.sai_so, h.bien.H && h.bien.H.sai_so]);
    eq(h.kich, [sp.rong, sp.sau_thung + sp.van.t, sp.cao], `${m.ma}: kích thước module = phủ bì (sâu tính cả cánh)`);
    // dự đoán theo hệ số = dựng lại thật ở kích thước khác (rộng +300, sâu +52,5, cao −150)
    const thu = [['L', 'rong', 300], ['W', 'sau_thung', 52.5], ['H', 'cao', -150]];
    for (const [ten, khoa, d] of thu) {
      const s2 = JSON.parse(JSON.stringify(sp)); s2[khoa] += d; s2.thung = Object.assign({}, s2.thung, { tach: h.M.info.tach });      // module co giãn thì giữ nguyên cách tách thùng của tủ gốc
      const M2 = C0.build(s2);
      if (M2.errors.length || M2.parts.length !== h.M.parts.length) continue;
      const b = h.bien[ten], bb = C0.bbox(M2.parts), g2 = [bb.x0, bb.y0, bb.z0][b.truc];
      let sai = 0; h.M.parts.forEach((p, i) => { for (const k of [0, 1]) sai = Math.max(sai, Math.abs((hop(M2.parts[i])[b.truc * 2 + k] - g2) - ((hop(p)[b.truc * 2 + k] - h.goc[b.truc]) + b.tam[i][k] * d))); });
      ok(sai <= 0.51, `${m.ma}: ${ten} ${d > 0 ? '+' : ''}${d} → tấm theo hệ số khớp bản dựng lại (lệch ${sai.toFixed(2)})`, sai);
      // mẫu: vị trí + bề rộng theo hệ số; sâu hộp ngăn kéo theo bậc ray
      h.M.templates.forEach((t, i) => {
        const u = M2.templates[i], mm = b.mau[i];
        const pos = (t.pos[b.truc] - h.goc[b.truc]) + mm.pos * d, box = mm.bac ? Math.floor((mm.bac.tu0 + mm.bac.k * d) / mm.bac.buoc + 1e-6) * mm.bac.buoc : t.box[b.truc] + mm.box * d;
        ok(Math.abs(pos - (u.pos[b.truc] - g2)) <= 0.51 && Math.abs(box - u.box[b.truc]) <= 0.51, `${m.ma}: ${ten} — mẫu ${t.ten} #${i} bám theo`, [pos, u.pos[b.truc] - g2, box, u.box[b.truc]]);
      });
    }
  }
  const h4 = C0.heSo(C0.apMau({}, 'TA4-2000'));
  ok(h4.bien.W.mau.filter(x => x.bac && x.bac.buoc === 50 && x.bac.k === 1).length === 2 && h4.bien.L.mau.every(x => x.box === 0.5), 'TA4-2000: 2 ngăn kéo có sâu nhảy bậc 50; bề rộng mẫu = nửa bề rộng tủ', h4.bien.W.mau);
  eq([...new Set(h4.bien.L.tam.flat())].sort(), [0, 0.25, 0.5, 0.75, 1], 'TA4-2000: mép tấm chạy theo 0 / ¼ / ½ / ¾ / 1 bề rộng');
  // đổi kích thước làm đổi số tấm (tủ cao hơn khổ ván → thêm thân trên) thì thử chiều ngược lại; không được thì trả null
  const thap = C0.heSo({ rong: 1000, cao: 2400, than: { cao_duoi: 0 }, khoang: [{ rong: 'auto', canh: 2, dot: [1200], o: [] }] });
  ok(thap.bien.H === null || thap.bien.H.sai_so <= 0.5, 'tủ sát ngưỡng khổ ván: H hoặc tuyến tính (thử Δ âm) hoặc bỏ', thap.bien.H && thap.bien.H.sai_so);
  // bản 1.26.1: kích thước nào module không co giãn đúng được thì heSo nói rõ VÌ SAO (driver khoá tham số đó: chỉ để xem, đổi ở bảng)
  eq(h4.ly_do, {}, 'tủ thường: cả 3 kích thước co giãn được → không có lý do nào');
  const cd = C0.heSo({ rong: 1000, cao: 2000, than: { cao_duoi: 0 }, khoang: [{ rong: 400, canh: 1, dot: [800], o: [] }, { rong: 447.5, canh: 1, dot: [800], o: [] }] });
  eq([cd.M.errors, cd.bien.L, cd.ly_do, !!cd.bien.W, !!cd.bien.H], [[], null, { L: 'khong_deu' }, true, true], 'mọi khoang rộng cố định: đổi Rộng là thiết kế hỏng → không co giãn theo L (lý do khong_deu); W / H vẫn được');
  eq(C0.normalize({}).module_cf, true, 'mặc định: vẽ xong gom thành module Chenfeng'); eq(C0.normalize({ module_cf: false }).module_cf, false, 'tắt được');
});

T('Tách thùng theo bề rộng (bản 1.10 — anh Jason 03/10/2026: "khổ ván 2 m thường sẽ tách thùng, thùng bé thì kẹp khung chung")', () => {
  const M = C0.build({ chan: { cao: 50 } });      // tủ mẫu 3000: khoang 1–2 chung một thùng ~1,93 m, khoang 3 là thùng riêng ~0,97 m
  eq(M.errors, [], 'không lỗi');
  eq([M.info.tach, M.info.khoang, M.info.thung.map(q => [q.khoang, q.x0, q.x1, q.rong])], [[2], [941, 940, 931.5], [[[0, 1], 50, 1983.5, 1933.5], [[2, 2], 1983.5, 2950, 966.5]]], 'tủ 3000: tách 2 thùng 1933,5 + 966,5');
  eq(P(M, 'HOI').filter(p => p.than === 'D').map(p => [p.ten, p.x0, p.x1, p.big, p.thung]), [['Hồi trái', 50, 67.5, 0, 0], ['Hồi phải', 1966, 1983.5, 1, 0], ['Hồi trái', 1983.5, 2001, 0, 1], ['Hồi phải', 2932.5, 2950, 1, 1]], 'chỗ tách: hồi phải thùng 1 + hồi trái thùng 2 áp lưng, mặt cam quay vào lòng thùng mình');
  eq(P(M, 'VACH').filter(p => p.than === 'D').map(p => [p.x0, p.x1]), [[1008.5, 1026]], 'trong thùng 1 vẫn vách chung');
  ok(M.parts.length === 71 && P(M, 'HOI').length === 8, '71 tấm: thêm 2 hồi (thân dưới + thân trên) so với thùng liền', M.parts.length);
  eq(overlapAny(M), [], 'không tấm nào đè nhau');
  eq(P(M, 'CANH').filter(p => p.than === 'D').map(p => [p.x0, p.x1]), [[52, 533], [535, 1016], [1018, 1499], [1501, 1982], [1984, 2465], [2467, 2948]], 'cánh vẫn bằng nhau; khe cánh nằm đúng mối áp lưng 2 hồi (1983,5)');
  eq(P(M, 'HAU').filter(p => p.than === 'D').map(p => [p.x0, p.x1]), [[51, 1017], [1017, 1982.5], [1984.5, 2949]], 'hậu phủ: mỗi thùng phủ hết hồi của mình (lùi mép 1), không bắc qua 2 thùng');
  eq(P(C0.build({ chan: { cao: 50 }, hau: { chia: 'kho_van' } }), 'HAU').filter(p => p.than === 'T').map(p => [p.x0, p.x1]), [[51, 1982.5], [1984.5, 2949]], 'gộp hậu cho vừa khổ ván cũng dừng ở chỗ tách thùng');
  eq(P(M, 'DAY').filter(p => p.than === 'D').map(p => [p.x0, p.x1]), [[67.5, 1008.5], [1026, 1966], [2001, 2932.5]], 'đáy lọt lòng từng khoang');
  eq([P(M, 'CHAN').map(p => [p.x0, p.x1]), P(M, 'PHAO').filter(p => p.z0 > 2700).map(p => [p.x0, p.x1])], [[[50, 1017], [1017, 1983.5], [1983.5, 2950]], [[50, 1017], [1017, 1983.5], [1983.5, 2950]]], 'mối nối xà chân / phào trên rơi đúng đường áp lưng 2 hồi (1983,5) → mỗi đầu thanh tì trọn hồi của thùng mình');
  ok(/thùng 1: 1933,5/.test(C0.elevationSVG(M)) && /thùng 2: 966,5/.test(C0.elevationSVG(M)) && !/thùng 1:/.test(C0.elevationSVG(C0.build({ chan: { cao: 50 }, thung: { rong_max: 0 } }))), 'hình đứng có hàng kích thước từng thùng (chỉ khi tủ tách)');
  ok(M.notes.some(t => /Tủ tách 2 thùng .*1933,5 \(khoang 1–2\) \+ 966,5 \(khoang 3\)/.test(t)) && C0.summary(M).some(t => /Thùng: 2 thùng rời — 1933,5 \(2 khoang\) \+ 966,5 \(1 khoang\)/.test(t)), 'có ghi chú + dòng tóm tắt', M.notes);
  // các cỡ khác
  const kh = n => Array.from({ length: n }, () => ({ rong: 'auto', canh: 2, dot: [1800], o: [] }));
  eq(C0.build({ rong: 2000, khoang: kh(2) }).info.thung.length, 1, 'tủ 2000 (thùng 1900): một thùng');
  eq(C0.build({ rong: 2400, khoang: kh(2) }).info.thung.map(q => q.rong), [1150, 1150], 'tủ 2400, 2 khoang: mỗi khoang một thùng');
  eq(C0.build({ rong: 4000, khoang: kh(4) }).info.thung.map(q => q.khoang), [[0, 1], [2, 3]], 'tủ 4000, 4 khoang: 2 thùng × 2 khoang');
  eq(C0.build({ rong: 6000, khoang: kh(6) }).info.tach, [2, 4], 'tủ 6000: 3 thùng');
  eq(C0.build({ rong: 3000, khoang: kh(3), thung: { rong_max: 0 } }).info.thung.length, 1, 'rong_max = 0: không tách (thùng liền như bản cũ)');
  eq(C0.build({ rong: 3000, khoang: kh(3), thung: { rong_max: 1200 } }).info.tach, [1, 2], 'rong_max 1200: mỗi khoang một thùng');
  eq(C0.build({ rong: 3000, khoang: kh(3), thung: { rong_max: 2000, tach: [1] } }).info.tach, [1], 'chỗ tách đã chốt (tach) được giữ nguyên');
  eq(C0.build({ rong: 3000, khoang: kh(1) }).info.thung.length, 1, 'một khoang rộng hơn rong_max thì không tách được — vẫn dựng');
  // khoang gõ bề rộng cố định + không cánh
  const co = C0.build({ rong: 3000, khoang: [{ rong: 900, canh: 0, dot: [] }, { rong: 'auto', canh: 0, dot: [] }, { rong: 900, canh: 0, dot: [] }] });
  eq([co.errors, co.info.khoang, co.info.tach], [[], [900, 1012.5, 900], [2]], 'khoang gõ bề rộng: phần còn lại trừ thêm tấm hồi kép');
  ok(/5 tấm đứng/.test(C0.build({ rong: 3000, khoang: [{ rong: 900 }, { rong: 900 }, { rong: 900 }] }).errors.join(' ')), 'báo lệch có tính cả hồi kép (5 tấm đứng)', C0.build({ rong: 3000, khoang: [{ rong: 900 }, { rong: 900 }, { rong: 900 }] }).errors);
  // hậu soi rãnh: rãnh nằm trên đúng 2 tấm đứng của khoang
  const r = C0.build({ hau: { kieu: 'mong' } });
  eq([r.errors, P(r, 'HOI').filter(p => p.than === 'D').map(p => p.holes.length)], [[], [1, 1, 1, 1]], 'hậu soi rãnh: mỗi hồi (kể cả 2 hồi áp lưng) có 1 rãnh; không lỗi');
  // 1500 tủ ngẫu nhiên có tách thùng: không lỗi lạ, không đè nhau, phủ bì đúng
  let seed = 20261003; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let hong = 0, tachDuoc = 0;
  for (let k = 0; k < 400; k++) {
    const n = 2 + Math.floor(rnd() * 6), rong = 1800 + Math.floor(rnd() * 44) * 100;
    const m = C0.build({ rong, cao: 2400 + Math.floor(rnd() * 5) * 100, khoang: Array.from({ length: n }, () => ({ rong: 'auto', canh: 1 + Math.floor(rnd() * 2), dot: [1200], o: rnd() < 0.3 ? [{ tu: 0, kieu: 'nk_am', so: 2 }] : [] })), thung: { rong_max: [1200, 2000, 2400][Math.floor(rnd() * 3)] } });
    if (m.errors.length) { if (!m.errors.every(e => /quá hẹp|Bề rộng lọt lòng|khổ ván|quá thấp|chỉ cao|chỉ còn/.test(e))) hong++; continue; }
    if (m.info.thung.length > 1) tachDuoc++;
    const bb = C0.bbox(m.parts);
    if (overlapAny(m).length || Math.abs(bb.x1 - bb.x0 - rong) > 0.011 || m.info.thung.some((q, i) => i > 0 && Math.abs(q.x0 - m.info.thung[i - 1].x1) > 0.011) || m.templates.some(tp => { const b0 = m.info.x_khoang[tp.khoang], b1 = b0 + m.info.khoang[tp.khoang]; return tp.pos[0] < b0 - 0.011 || tp.pos[0] + tp.box[0] > b1 + 0.011; })) hong++;
  }
  ok(hong === 0 && tachDuoc > 100, `400 tủ ngẫu nhiên có tách thùng: không đè nhau, phủ bì đúng, hộp ngăn kéo nằm trong khoang (${tachDuoc} tủ bị tách)`, [hong, tachDuoc]);
  // nâng cấp + tủ đã vẽ
  ok(C0.nangCap({ rong: 3000 }, '1.9.0').doi.some(t => /Từ bản 1\.10: tủ rộng tự tách/.test(t)), 'thông số lưu từ bản < 1.10 mà tủ bị tách → có báo');
  eq(C0.nangCap({ rong: 1000, khoang: [{}] }, '1.9.0').doi, [], 'tủ hẹp không bị tách → không báo');
  eq(C0.nangCap({ rong: 3000, thung: { rong_max: 0 } }, '1.9.0').doi, [], 'đã tự đặt rong_max → không báo');
  eq([C0.specDaVe({ rong: 3000 }, '1.9.0').thung, C0.specDaVe({ rong: 3000 }, undefined).thung, C0.specDaVe({ rong: 3000 }, '1.10.0').thung, C0.specDaVe({ thung: { rong_max: 1500 } }, '1.9.0').thung], [{ rong_max: 0 }, { rong_max: 0 }, undefined, { rong_max: 1500 }], 'tủ đã vẽ bằng bản < 1.10 = thùng liền (để dò lại được trên bản vẽ)');
  eq(C0.normalize({}).thung.rong_max, 2000, 'mặc định 2000'); eq(C0.normalize({ thung: { rong_max: '1,8' } }).thung.rong_max, 1.8, 'số kiểu Việt');
});

// Các khối khấu cột bên dưới đã đối chiếu từng số với bản vẽ thật ở khe hở 10 → ghim 10; mặc định mới (15, bản 1.17.1) thử riêng ở khối "Khe hở quanh cột".
const HO10 = k => Object.assign({ ho: 10 }, k);
T('Khấu cột (bản 1.13 — anh Jason 03/10/2026: "nhiều tủ phải khấu cột", "làm khấu theo đúng kết cấu của vn")', () => {
  const nen = { rong: 2000, cao: 2400, sau_thung: 580, than: { cao_duoi: 0 }, chan: { cao: 100 }, thung: { rong_max: 0 },
    khoang: [{ rong: 'auto', canh: 2, dot: [400, 1200], o: [{ tu: 0, kieu: 'nk_am', so: 2 }] }, { rong: 'auto', canh: 2, dot: [800], o: [{ tu: 800, kieu: 'suot' }] }] };
  const B = k => C0.build(Object.assign({}, nen, { khau: k && HO10(k) }));
  const b4 = p => [p.x0, p.x1, p.y0, p.y1];
  eq(C0.normalize({}).khau, { trai: { rong: 0, sau: 0 }, phai: { rong: 0, sau: 0 }, giua: [], ho: 15 }, 'mặc định: không khấu, hở 15 (bản 1.17.1)');
  const M0 = B(undefined);
  ok(M0.errors.length === 0 && !M0.parts.some(p => p.khau || p.khau_cot) && M0.info.khau.length === 0, 'không khai khấu: tủ như cũ');
  // cột trái 300 × 200, hở 10 → mặt bên cột x = 310, mặt trước cột y = 580 − 210 = 370, thùng trước cột sâu 352,5 (trừ HẬU KHẤU bằng ván thùng 17,5 — bản 1.16.1: "phần khấu phải là ván 17 hết")
  const M = B({ trai: { rong: 300, sau: 200 } });
  eq(M.errors, [], 'khấu trái: dựng không lỗi, không tấm nào đè nhau');
  eq(M.parts.length, M0.parts.length + 2, 'thêm đúng 2 tấm: vách khấu + hậu khấu');
  eq(b4(P(M, 'HOI')[0]), [50, 67.5, 0, 370], 'hồi trái nông lại, chạy tới mặt sau hậu khấu (cùng vách khấu kẹp hậu khấu)');
  eq(b4(P(M, 'HOI')[1]), [1932.5, 1950, 0, 574], 'hồi phải giữ nguyên');
  const vk = M.parts.find(p => p.khau_cot && p.loai === 'VACH'), hk = M.parts.find(p => p.khau_cot && p.loai === 'HAU');
  eq([vk.ten, b4(vk), vk.z0, vk.z1, vk.type], ['Vách khấu cột', [310, 327.5, 352.5, 574], 0, 2350, 1], 'vách khấu: đứng dọc mặt bên cột, từ mặt trước hậu khấu tới mép sau thùng, cao suốt thân');
  eq([hk.ten, b4(hk), hk.z0, hk.z1, hk.t, hk.khoan, !!hk.phu, hk.van_thung, hk.type], ['Hậu khấu cột', [67.5, 310, 352.5, 370], 100, 2350, 17.5, C0.normalize(nen).khoan.thung, false, true, 2], 'hậu khấu: VÁN THÙNG 17,5 trước mặt cột, lọt giữa hồi trái và vách khấu, cao từ mặt dưới đáy tới đỉnh thân, khoan như tấm thùng');
  ok(P(M, 'HAU').filter(p => !p.khau_cot).every(p => p.t === 6 && p.phu && p.khoan === C0.KHONG_KHOAN), 'hậu chính vẫn là hậu 6 li phủ sau, không khoan');
  eq(P(M, 'HAU').filter(p => !p.khau_cot).map(b4), [[311, 1000, 574, 580], [1000, 1949, 574, 580]], 'hậu chính bắt đầu từ mép vách khấu (lùi 1)');
  const kh = [{ ben: 'trai', x0: 67.5, x1: 327.5, y0: 352.5, y1: 574 }];
  eq(M.parts.filter(p => p.khau).map(p => [p.loai, p.khau]), [['DAY', kh], ['NOC', kh], ['DOT', kh], ['DOT', kh]], 'đáy, nóc, 2 đợt của khoang sát cột: khoét góc sau trái tới mặt trong vách khấu');
  ok(!M.parts.some(p => p.khoang === 1 && p.khau), 'khoang không dính cột: không khoét');
  // không tấm nào lấn vào vùng cột (x < 310, y > 370), có tính phần đã khoét
  const cot = { x0: -1, x1: 310, y0: 370, y1: 9999, z0: -1, z1: 9999 };
  eq(M.parts.filter(p => C0.overlap(p, cot) > 0).map(p => p.ten), [], 'không tấm nào lấn vào chỗ của cột');
  ok(C0.overlap(P(M, 'DAY')[0], vk) === 0 && C0.overlap(Object.assign({}, P(M, 'DAY')[0], { khau: undefined }), vk) > 0, 'dò va chạm hiểu phần đã khoét (tấm chữ nhật cùng hộp bao thì đè vách khấu)');
  // ngăn kéo của khoang sát cột chỉ sâu tới phần nông; suốt treo khoang kia giữ sâu đủ
  const nk = M.templates.filter(t => t.loai === 'NGAN_KEO'), nk0 = M0.templates.filter(t => t.loai === 'NGAN_KEO');
  ok(nk.length === 2 && nk.every(t => t.pos[1] + t.box[1] <= 352.5 + 0.011) && nk0[0].box[1] > nk[0].box[1], 'hộp ngăn kéo khoang sát cột ngắn lại cho vừa phần nông', [nk.map(t => t.box[1]), nk0.map(t => t.box[1])]);
  eq(M.templates.find(t => t.loai === 'SUOT').box[1], M0.templates.find(t => t.loai === 'SUOT').box[1], 'khoang không dính cột: suốt treo như cũ');
  // xuất cho Chenfeng: đường bao chữ L (u = sâu, v = ngang)
  const cf = C0.toChenfeng(M).json.ModelSpace, day = cf.find(b => b.Name === 'Đáy' && b.ContourCurve && b.ContourCurve.length > 4);
  eq(day.ContourCurve.map(q => q.pt), [[0, 0], [574, 0], [574, 664], [352.5, 664], [352.5, 924], [0, 924]], 'đáy khoét bên trái: đường bao 6 đỉnh, góc lõm ở phía v lớn (v của Chenfeng đo từ mép PHẢI: x = x1 − v)');
  eq([day.Pos, cf.filter(b => b.ContourCurve && b.ContourCurve.length > 4).length], [[67.5, 0, 100], 4], 'điểm đặt vẫn là góc nhỏ nhất; 4 tấm có đường bao chữ L');
  const hkCF = cf.find(b => b.Name === 'Hậu khấu cột'), hoiCF = cf.find(b => b.Name === 'Hồi trái'), hauCF = cf.find(b => b.Name === 'Hậu');
  eq([hkCF.BrType, hkCF.Thickness, hkCF.Pos, hkCF.EachEdgeDrills, hkCF.UpSealed, hkCF.BrMatName, hkCF.Matrial, hkCF.Color, hkCF.FrontDrill, hkCF.BackDrill], [2, 17.5, [67.5, 352.5, 100], hoiCF.EachEdgeDrills, hoiCF.UpSealed, hoiCF.BrMatName, hoiCF.Matrial, hoiCF.Color, true, true], 'xuất sang Chenfeng: hậu khấu là tấm hậu dày 17,5 với vật liệu, dán cạnh, kiểu khoan của ván thùng');
  ok(hauCF.Thickness === 6 && hauCF.UpSealed === '0' && hauCF.EachEdgeDrills.every(k => k === C0.KHONG_KHOAN), 'hậu chính xuất như cũ: 6 li, không dán cạnh, không khoan');
  // bảng kê
  const cl = C0.cutList(M).rows;
  ok(cl.some(r => r.ten === 'Đáy' && /khoét góc sau trái 260 × 221,5 \(khấu cột\)/.test(r.ghi_chu)) && cl.some(r => r.ten === 'Vách khấu cột' && r.dai === 2350 && r.rong === 221.5) && cl.some(r => r.ten === 'Hậu khấu cột' && r.day === 17.5 && r.nhom === 'Thùng' && r.dai === 2250 && r.rong === 242.5 && /ván thùng/.test(r.ghi_chu)) && C0.cutList(M).theo_day.find(e => e.day === 6).sl === 2, 'bảng kê: ghi chú khoét góc, vách khấu 2350 × 221,5, hậu khấu 2250 × 242,5 dày 17,5 kê trong nhóm Thùng; ván 6 li chỉ còn 2 tấm hậu chính', cl.filter(r => /hấu/.test(r.ten + r.ghi_chu)));
  ok(M.notes.some(t => /Khấu cột: trái 310 × 210 \(cột \+ hở 10\) — thùng trước cột sâu 352,5, thêm vách khấu\. Hậu khấu \(tấm trước mặt cột\) là ván thùng dày 17,5/.test(t)) && M.info.khau.length === 1, 'có dòng ghi chú khấu', M.notes);
  // bên phải: đối xứng
  const R = B({ phai: { rong: 300, sau: 200 } });
  eq([R.errors, b4(P(R, 'HOI')[1]), b4(R.parts.find(p => p.khau_cot && p.loai === 'VACH')), b4(R.parts.find(p => p.khau_cot && p.loai === 'HAU')), P(R, 'HAU').filter(p => !p.khau_cot).map(b4), P(R, 'DAY').find(p => p.khau).khau],
    [[], [1932.5, 1950, 0, 370], [1672.5, 1690, 352.5, 574], [1690, 1932.5, 352.5, 370], [[51, 1000, 574, 580], [1000, 1689, 574, 580]], [{ ben: 'phai', x0: 1672.5, x1: 1932.5, y0: 352.5, y1: 574 }]], 'khấu phải: đối xứng với bên trái');
  eq(C0.toChenfeng(R).json.ModelSpace.find(b => b.Name === 'Đáy' && b.ContourCurve && b.ContourCurve.length > 4).ContourCurve.map(q => q.pt), [[0, 0], [352.5, 0], [352.5, 260], [574, 260], [574, 923.5], [0, 923.5]], 'đáy khoét bên phải: góc lõm ở phía v nhỏ');
  // hai bên cùng lúc
  const H2 = B({ trai: { rong: 300, sau: 200 }, phai: { rong: 250, sau: 150 } });
  ok(H2.errors.length === 0 && H2.parts.filter(p => p.khau_cot).length === 4 && H2.info.khau.length === 2, 'khấu cả hai bên');
  // mặt cột trùng mặt vách → vách đó làm vách khấu, khoang trái nông trọn, không tấm nào phải khoét
  const V = B({ trai: { rong: 981.5, sau: 200 } });
  eq([V.errors, V.parts.filter(p => p.khau).length, V.parts.filter(p => p.khau_cot).map(p => [p.loai, b4(p)]), P(V, 'HAU').filter(p => !p.khau_cot).map(b4), b4(P(V, 'VACH')[0]), P(V, 'DAY').map(b4)],
    [[], 0, [['HAU', [67.5, 991.5, 352.5, 370]]], [[992.5, 1949, 574, 580]], [991.5, 1009, 0, 574], [[67.5, 991.5, 0, 352.5], [1009, 1932.5, 0, 574]]], 'mép cột trùng mặt vách: không thêm vách khấu, không khoét tấm; hậu khấu lọt giữa hồi trái và vách đó; hậu chính phủ mép sau vách');
  ok(V.info.khau[0].vach_co_san === true, 'ghi nhận vách sẵn có làm vách khấu');
  // cột nằm gọn sau phào → không khấu
  const S = B({ trai: { rong: 30, sau: 200 } });
  ok(S.errors.length === 0 && !S.parts.some(p => p.khau || p.khau_cot) && S.notes.some(t => /nằm gọn sau phào trái/.test(t)), 'cột hẹp hơn phào: không khấu, có ghi chú');
  // bản 1.23 (anh Jason 04/10/2026 23:02: "khấu cột … phải cân đối khoang tủ … không can thiệp bổ sung các đợt ngang hay dọc"):
  // mép cột rơi sát / trúng một vách thì KHÔNG báo lỗi bắt dời vách nữa — vùng khấu tự NỚI ra tới chỗ dựng được, khoang của tủ giữ nguyên
  const G = B({ trai: { rong: 990, sau: 200 } });      // mặt cột x = 1000 rơi giữa bề dày vách 991,5 … 1009 → vách nông lại (nằm trong vùng khấu), vách khấu đứng cách vách 30 trong khoang 2
  eq([G.errors, G.info.khoang, G.info.khau.map(k => [k.ben, k.x, k.vach_co_san])], [[], M0.info.khoang, [['trai', 1039, false]]], 'mặt cột rơi giữa bề dày vách: không lỗi, khoang giữ nguyên, vùng khấu nới tới 1039 (cách vách 30)');
  eq([b4(P(G, 'VACH').find(p => !p.khau_cot)), b4(G.parts.find(p => p.khau_cot && p.loai === 'VACH')), b4(G.parts.find(p => p.khau_cot && p.loai === 'HAU'))], [[991.5, 1009, 0, 352.5], [1039, 1056.5, 352.5, 574], [67.5, 1039, 352.5, 370]], 'vách của khoang nông lại tới mặt hậu khấu; vách khấu + hậu khấu theo vùng đã nới');
  ok(G.notes.some(t => /Khấu cột trái: vùng khấu nới thêm 39 /.test(t)), 'có ghi chú nới vùng khấu', G.notes);
  const G2 = B({ trai: { rong: 900, sau: 200 } });     // vách khấu sẽ chỉ cách vách khoang 64 (< 100) → lấy luôn vách đó làm vách khấu
  eq([G2.errors, G2.info.khoang, G2.info.khau.map(k => [k.x, k.vach_co_san]), G2.parts.filter(p => p.khau).length, G2.parts.filter(p => p.khau_cot && p.loai === 'VACH').length], [[], M0.info.khoang, [[991.5, true]], 0, 0], 'vách khấu quá sát vách khoang: vùng khấu nới tới mặt vách đó, vách làm vách khấu, khoang giữ nguyên');
  eq(overlapAny(G).concat(overlapAny(G2)), [], 'hai trường hợp nới: không tấm nào đè nhau');
  ok(/thùng trước cột chỉ còn sâu/.test(B({ trai: { rong: 300, sau: 450 } }).errors.join(' ')), 'cột quá sâu → báo');
  ok(/chỉ làm với kiểu hậu phủ sau/.test(C0.build(Object.assign({}, nen, { hau: { kieu: 'day' }, khau: HO10({ trai: { rong: 300, sau: 200 } }) })).errors.join(' ')), 'hậu dày lọt lòng: chưa hỗ trợ khấu → báo');
  // tủ 2 thân, tách thùng, hậu gộp theo khổ ván
  const T2 = C0.build({ rong: 3000, cao: 2800, khau: HO10({ trai: { rong: 320, sau: 180 }, phai: { rong: 400, sau: 250 } }), hau: { chia: 'kho_van' } });
  ok(T2.errors.length === 0 && T2.parts.filter(p => p.khau_cot && p.loai === 'VACH').length === 4 && T2.parts.filter(p => p.khau_cot && p.loai === 'HAU').length === 4, 'tủ 3000 hai thân, hậu gộp theo khổ ván: mỗi thân một vách khấu + hậu khấu mỗi bên, không lỗi', T2.errors);
  // module tham số: hệ số của mép khoét
  const hs = C0.heSo(Object.assign({}, nen, { khau: HO10({ trai: { rong: 300, sau: 200 }, phai: { rong: 300, sau: 200 } }) }));
  const iT = hs.M.parts.findIndex(p => p.loai === 'DAY' && p.khau && p.khau[0].ben === 'trai'), iP = hs.M.parts.findIndex(p => p.loai === 'DAY' && p.khau && p.khau[0].ben === 'phai');
  eq([hs.bien.W.khau[iT], hs.bien.L.khau[iT], hs.bien.L.khau[iP], hs.bien.W.sai_so, hs.bien.L.sai_so], [[[1, 1]], [[0, 0]], [[1, 1]], 0, 0], 'heSo: đổi Sâu thì mép khoét đi theo lưng tủ (bề sâu phần khoét giữ nguyên); đổi Rộng thì khấu trái đứng yên, khấu phải đi theo hồi phải');
  // ngẫu nhiên
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let hong = 0, dung = 0;
  for (let k = 0; k < 300; k++) {
    const n = 1 + Math.floor(rnd() * 5), rong = 900 + Math.floor(rnd() * 30) * 100, D = 450 + Math.floor(rnd() * 4) * 50, ben = rnd() < 0.5 ? 'trai' : 'phai';
    const q = { rong: 120 + Math.floor(rnd() * 40) * 10, sau: 80 + Math.floor(rnd() * 20) * 10 };
    const m = C0.build({ rong, cao: 2000 + Math.floor(rnd() * 8) * 100, sau_thung: D, khau: HO10({ [ben]: q }), khoang: Array.from({ length: n }, () => ({ rong: 'auto', canh: 1 + Math.floor(rnd() * 2), dot: [600, 1300], o: rnd() < 0.3 ? [{ tu: 0, kieu: 'nk_am', so: 2 }] : [] })) });
    if (m.errors.length) { if (!m.errors.every(e => /Khấu cột|quá hẹp|Bề rộng lọt lòng|khổ ván|quá thấp|chỉ cao|chỉ còn|quá nông|Cánh/.test(e))) { hong++; if (hong < 3) console.log('   ', m.errors.slice(0, 2)); } continue; }
    if (!m.info.khau.length) continue;
    dung++;
    const K = m.info.khau[0], cot2 = ben === 'trai' ? { x0: -1, x1: K.x, y0: K.y, y1: 9999, z0: -1, z1: 9999 } : { x0: K.x, x1: 99999, y0: K.y, y1: 9999, z0: -1, z1: 9999 };
    if (overlapAny(m).length || m.parts.some(p => C0.overlap(p, cot2) > 0) || m.templates.some(tp => { const b0 = tplBox(tp); return C0.overlap(b0, cot2) > 0; })) { hong++; if (hong < 3) console.log('    va chạm', k, overlapAny(m).slice(0, 2)); }
  }
  ok(hong === 0 && dung > 60, `300 tủ ngẫu nhiên có khấu cột: không tấm / hộp ngăn kéo nào lấn vào cột, không đè nhau (${dung} tủ dựng được)`, [hong, dung]);
});

T('Khấu cột GIỮA tủ (bản 1.14 — anh Jason 03/10/2026: "tính pa khấu cột giữa tủ")', () => {
  const nen = { rong: 2000, cao: 2400, sau_thung: 580, than: { cao_duoi: 0 }, chan: { cao: 100 }, thung: { rong_max: 0 },
    khoang: [{ rong: 'auto', canh: 2, dot: [400, 1200], o: [] }, { rong: 'auto', canh: 2, dot: [800], o: [{ tu: 800, kieu: 'suot' }] }] };
  const B = (giua, them) => C0.build(Object.assign({}, nen, them, { khau: HO10({ giua }) }));
  const co = (ds, re) => ds.some(t => re.test(t));
  const b4 = p => [p.x0, p.x1, p.y0, p.y1];
  const M0 = B([]);
  // (1) cột 300 × 200 lọt giữa khoang 1 (lọt lòng 67,5 … 991,25): vùng cột 290 … 610 (hở 10 mỗi bên), y > 370
  const M = B([{ cach: 300, rong: 300, sau: 200 }]);
  eq(M.errors, [], 'cột lọt giữa khoang: dựng không lỗi, không tấm nào đè nhau');
  eq(M.info.khau, [{ ben: 'giua', x: 290, y: 370, sau_thung: 352.5, vach_co_san: false, xa: 290, xb: 610, co_a: false, co_b: false, cot: { x0: 300, x1: 600, sau: 200 } }], 'thông tin vùng cột');
  eq(M.parts.length, M0.parts.length + 4, 'thêm đúng 4 tấm: 2 vách khấu + hậu khấu + hậu chính chia thêm 1 mảnh');
  eq(M.parts.filter(p => p.khau_cot && p.loai === 'VACH').map(b4), [[272.5, 290, 352.5, 574], [610, 627.5, 352.5, 574]], '2 vách khấu ôm hai mặt bên cột, từ mặt trước hậu khấu tới mép sau thùng');
  eq(M.parts.filter(p => p.khau_cot && p.loai === 'HAU').map(p => [b4(p), p.t, p.van_thung, p.z0, p.z1]), [[[290, 610, 352.5, 370], 17.5, true, 100, 2350]], 'hậu khấu trước mặt cột: ván thùng 17,5, lọt giữa 2 vách khấu');
  eq(P(M, 'HAU').filter(p => !p.khau_cot).map(b4), [[51, 289, 574, 580], [611, 1000, 574, 580], [1000, 1949, 574, 580]], 'hậu chính chia hai bên cột (lùi 1 khỏi mặt cột)');
  const kh = [{ ben: 'giua', x0: 272.5, x1: 627.5, y0: 352.5, y1: 574 }];
  eq(M.parts.filter(p => p.khau).map(p => [p.loai, p.khau]), [['DAY', kh], ['NOC', kh], ['DOT', kh], ['DOT', kh]], 'đáy, nóc, 2 đợt của khoang có cột: khoét chữ U tới mặt ngoài 2 vách khấu');
  eq(b4(P(M, 'HOI')[0]), [50, 67.5, 0, 574], 'hồi trái không đổi (cột không chạm hồi)');
  const cf = C0.toChenfeng(M).json.ModelSpace, day = cf.find(b => b.Name === 'Đáy' && b.ContourCurve.length > 4);
  eq(day.ContourCurve.map(q => q.pt), [[0, 0], [574, 0], [574, 364], [352.5, 364], [352.5, 719], [574, 719], [574, 924], [0, 924]], 'đáy khoét chữ U: đường bao 8 đỉnh (v đo từ mép phải)');
  eq(C0.dinhKhoet(M.parts.find(p => p.khau)).length, 8, 'dinhKhoet: 8 đỉnh');
  ok(C0.cutList(M).rows.some(r => /khoét chữ U mép sau, cách mép trái 205: 355 × 221,5 \(khấu cột\)/.test(r.ghi_chu)), 'bảng thống kê ghi khoét chữ U', C0.cutList(M).rows.map(r => r.ghi_chu).filter(Boolean));
  ok(M.notes.some(t => /Khấu cột: giữa 320 × 210 \(cột \+ hở 10\) — thùng trước cột sâu 352,5, thêm hai vách khấu\. Hậu khấu .* ván thùng dày 17,5.*chữ L hoặc chữ U/.test(t)), 'ghi chú khấu cột giữa', M.notes);
  ok(/Nhìn từ trên xuống — khấu cột/.test(C0.elevationSVG(M, { kich_thuoc: true })) && /2 vách khấu · sâu 352,5/.test(C0.elevationSVG(M, { kich_thuoc: true })) && !/NaN|undefined/.test(C0.elevationSVG(M, { kich_thuoc: true })), 'hình nhìn từ trên xuống có cột giữa');
  // (2) cột trùm lên vách giữa (vách 991,25 … 1008,75): vách nông lại, hai khoang hai bên khoét góc chữ L, MỘT tấm hậu khấu
  const V = B([{ cach: 850, rong: 300, sau: 200 }]);
  eq(V.errors, [], 'cột trùm vách giữa: dựng không lỗi');
  eq(b4(P(V, 'VACH').find(p => !p.khau_cot)), [991.3, 1008.8, 0, 352.5].map((v, i) => (i < 2 ? P(V, 'VACH').find(p => !p.khau_cot)['x' + i] : v)), 'vách khoang nằm trong vùng cột nông lại tới mặt phẳng hậu khấu');
  eq(V.parts.filter(p => p.khau).map(p => p.khau[0].ben).sort().join(','), 'phai,phai,phai,phai,trai,trai,trai', 'khoang trái khoét góc phải, khoang phải khoét góc trái');
  eq(V.parts.filter(p => p.khau_cot && p.loai === 'HAU').map(b4), [[840, 1160, 352.5, 370]], 'hậu khấu là MỘT tấm suốt bề rộng vùng cột (vách trong vùng cột đâm vào mặt trước của nó)');
  // (3) hai vách trùng hai mép cột → khoang nông, không tấm nào khoét, không thêm vách khấu
  const N = B([{ cach: 800, rong: 300, sau: 200 }], { khoang: [{ rong: 705, canh: 2, dot: [400], o: [] }, { rong: 320, canh: 1, dot: [400, 1200], o: [] }, { rong: 'auto', canh: 2, dot: [800], o: [] }] });
  eq(N.errors, [], 'khoang nông: dựng không lỗi');
  ok(N.info.khau[0].co_a && N.info.khau[0].co_b && !N.parts.some(p => p.khau) && !N.parts.some(p => p.khau_cot && p.loai === 'VACH'), 'hai vách sẵn có làm vách khấu, không khoét', N.info.khau);
  eq(N.parts.filter(p => p.khoang === 1 && /DAY|NOC|DOT/.test(p.loai)).map(p => p.y1), [352.5, 352.5, 352.5, 352.5], 'đáy, nóc, đợt của khoang trước cột nông 352,5');
  ok(N.notes.some(t => /hai vách sẵn có làm vách khấu \(khoang nông trước cột\)/.test(t)), 'ghi chú khoang nông', N.notes);
  // vachTheoCot: tự đưa vách về hai mép cột
  const r = C0.vachTheoCot(Object.assign({}, nen, { khau: HO10({ giua: [{ cach: 800, rong: 300, sau: 200 }] }) }));
  eq(r.loi, '', 'vachTheoCot: làm được'); ok(r.doi.length === 2 && /dời vách 1 về mép trái cột/.test(r.doi[0]) && /thêm vách ở mép phải cột/.test(r.doi[1]), 'dời vách gần + thêm vách bên kia', r.doi);
  const R = C0.build(r.spec);
  ok(R.errors.length === 0 && R.info.khau[0].co_a && R.info.khau[0].co_b && R.info.khoang[1] === 320 && !R.parts.some(p => p.khau), 'sau khi đặt vách: khoang trước cột lọt lòng 320 (cột + 2 hở), không tấm nào khoét', [R.errors, R.info.khoang]);
  eq(C0.vachTheoCot(nen).loi, 'Chưa khai cột giữa nào.', 'không có cột giữa thì báo');
  eq(C0.vachTheoCot(r.spec).doi, [], 'bấm lần nữa: vách đã trùng, không đổi gì');
  // bản 1.23: các trường hợp trước đây báo lỗi bắt người dùng khai lại / dời vách — giờ bảng tự xử, khoang giữ nguyên
  const kq = (giua, them) => { const m = B(giua, them); return [m.errors, m.info.khoang, m.info.khau.map(k => [k.ben, k.xa, k.xb, k.co_a, k.co_b])]; };
  eq(kq([{ cach: 40, rong: 300, sau: 200 }]), [[], M0.info.khoang, [['trai', null, 350, false, false]]], 'cột giữa dính hồi trái (cách mép 40): tự coi là cột góc trái lấn ngang 340 + hở 10, hồi trái nông lại');
  ok(co(B([{ cach: 40, rong: 300, sau: 200 }]).notes, /cột cách mép trái 40 là dính hồi trái — khấu như cột góc trái \(lấn ngang 340\)/), 'có ghi chú coi là cột góc trái', B([{ cach: 40, rong: 300, sau: 200 }]).notes);
  eq(kq([{ cach: 1700, rong: 280, sau: 200 }]), [[], M0.info.khoang, [['phai', 1690, null, false, false]]], 'cột giữa dính hồi phải: tự coi là cột góc phải (lấn ngang 300 + hở 10)');
  eq(kq([{ cach: 100, rong: 300, sau: 200 }]), [[], M0.info.khoang, [['giua', 67.5, 410, true, false]]], 'vách khấu trái sẽ quá sát hồi (còn 5): vùng khấu nới tới mặt trong hồi trái, hồi làm vách khấu');
  eq(kq([{ cach: 300, rong: 300, sau: 200 }, { cach: 620, rong: 200, sau: 200 }]), [[], M0.info.khoang, [['giua', 290, 830, false, false]]], 'hai cột sát nhau (cách nhau 20): gộp thành MỘT vùng khấu 290 … 830');
  eq(B([{ cach: 300, rong: 300, sau: 200 }, { cach: 620, rong: 200, sau: 260 }]).info.khau[0].y, 310, 'vùng gộp sâu theo cột sâu hơn (260 + hở 10)');
  ok(co(B([{ cach: 300, rong: 300, sau: 450 }]).errors, /Khấu cột giữa: cột sâu 450 thì thùng trước cột chỉ còn sâu/), 'cột sâu quá');
  // cột rộng hơn chỗ còn lại của khoang (khoang 400, cột 300 + 2 hở): vùng khấu nới hết khoang → khoang nông, hai vách sẵn có làm vách khấu, KHÔNG thêm vách, KHÔNG đổi khoang
  const hep = { khoang: [{ rong: 'auto', canh: 2, dot: [800], o: [] }, { rong: 400, canh: 1, dot: [800], o: [] }, { rong: 'auto', canh: 2, dot: [800], o: [] }] };
  const H0 = B([], hep), xk = H0.info.x_khoang[1], Hh = B([{ cach: Math.round(xk) + 40, rong: 300, sau: 200 }], hep);
  eq([Hh.errors, Hh.info.khoang, Hh.info.khau.map(k => [k.xa, k.xb, k.co_a, k.co_b]), Hh.parts.filter(p => p.khau).length, P(Hh, 'VACH').length], [[], H0.info.khoang, [[xk, xk + 400, true, true]], 0, P(H0, 'VACH').length], 'cột chiếm gần hết một khoang hẹp: khoang đó thành khoang nông, không thêm vách');
  eq(C0.normalize({ khau: HO10({ giua: [{ cach: '300', rong: '250,5', sau: 200 }, {}, null] }) }).khau.giua, [{ cach: 300, rong: 250.5, sau: 200 }], 'chuẩn hoá: số kiểu Việt, bỏ dòng trống ở cuối');
  // hệ số module tham số — bản 1.26.1: tủ có cột GIỮA KHÔNG co giãn theo Rộng bằng module. Cột đứng yên còn khoang thì chia lại: vách khấu / hậu khấu lúc bám vách khoang
  // (giữ cách vách ≥ 30), lúc bám mép cột → không có bộ hệ số tuyến tính nào đúng cả hai chiều. Đo trên Chenfeng thật 05/10/2026: tủ 3000 có cột cách 1000, đổi L 3000 → 2900
  // ở ô Thông số thì vách khấu chỉ còn cách vách khoang 2,09 (thiết kế cần 30). Sâu / Cao thì vẫn co giãn đúng: bề sâu vùng khoét giữ nguyên, mép khoét đi theo lưng tủ.
  const hs = C0.heSo(C0.normalize(Object.assign({}, nen, { khau: HO10({ giua: [{ cach: 300, rong: 300, sau: 200 }] }) })));
  const iDay = M.parts.findIndex(p => p.khau);
  eq([hs.bien.L, hs.ly_do], [null, { L: 'cot_giua' }], 'tủ có cột giữa: không co giãn theo Rộng (lý do cot_giua)');
  ok(hs.bien.W && JSON.stringify(hs.bien.W.khau[iDay]) === '[[1,1]]', 'đổi Sâu: mép khoét đi theo lưng tủ (bề sâu phần khoét giữ nguyên)', hs.bien.W && hs.bien.W.khau[iDay]);
  eq(C0.heSo(Object.assign({}, nen, { khau: HO10({ giua: [{ cach: 40, rong: 300, sau: 200 }] }) })).ly_do, { L: 'cot_giua' }, 'cột khai là cột giữa mà dính hồi (bảng khấu như cột góc): vẫn neo theo mép trái tủ → Rộng vẫn không co giãn');
  eq(C0.heSo(Object.assign({}, nen, { khau: HO10({ trai: { rong: 300, sau: 200 }, phai: { rong: 300, sau: 200 } }) })).ly_do, {}, 'cột GÓC (trái / phải): cả 3 kích thước vẫn co giãn được');
  // … còn Sâu / Cao của tủ có cột giữa: dự đoán theo hệ số = bản dựng lại, với cột ở nhiều chỗ (giữa khoang, sát vách, đè vách) trên tủ một thùng và tủ tách thùng
  const hop6 = p => [p.x0, p.x1, p.y0, p.y1, p.z0, p.z1];
  let soThu = 0;
  for (const [rong, cach] of [[2000, 300], [2000, 700], [2000, 850], [2000, 1000], [2000, 1500], [3000, 1000], [3000, 1700]]) {
    const sp = C0.normalize(Object.assign({}, nen, { rong, thung: { rong_max: 2000 }, khoang: nen.khoang.concat(rong > 2000 ? [{ rong: 'auto', canh: 2, dot: [800], o: [] }] : []), khau: HO10({ giua: [{ cach, rong: 300, sau: 200 }] }) })), h = C0.heSo(sp);
    eq([h.M.errors, h.bien.L, h.ly_do], [[], null, { L: 'cot_giua' }], `tủ ${rong}, cột giữa cách ${cach}: dựng được, Rộng không co giãn`);
    for (const [ten, khoa, d] of [['W', 'sau_thung', 50], ['W', 'sau_thung', -50], ['H', 'cao', 100], ['H', 'cao', -100]]) {
      const s2 = JSON.parse(JSON.stringify(sp)); s2[khoa] += d; s2.thung = Object.assign({}, s2.thung, { tach: h.M.info.tach });
      const M2 = C0.build(s2);
      if (M2.errors.length || M2.parts.length !== h.M.parts.length) continue;
      const b = h.bien[ten], bb = C0.bbox(M2.parts), g2 = [bb.x0, bb.y0, bb.z0][b.truc];
      let sai = 0; h.M.parts.forEach((p, i) => { for (const k of [0, 1]) sai = Math.max(sai, Math.abs((hop6(M2.parts[i])[b.truc * 2 + k] - g2) - ((hop6(p)[b.truc * 2 + k] - h.goc[b.truc]) + b.tam[i][k] * d))); });
      soThu++; ok(sai <= 0.51, `tủ ${rong}, cột giữa cách ${cach}: ${ten} ${d > 0 ? '+' : ''}${d} → tấm theo hệ số khớp bản dựng lại (lệch ${sai.toFixed(2)})`, sai);
    }
  }
  ok(soThu >= 20, 'đã thử Sâu / Cao trên đủ các tủ có cột giữa', soThu);
  // kết hợp cột góc + cột giữa, tủ tách thùng
  const T2 = C0.build({ rong: 3600, cao: 2400, sau_thung: 580, khau: HO10({ trai: { rong: 300, sau: 200 }, giua: [{ cach: 2000, rong: 250, sau: 150 }] }), khoang: [1, 2, 3, 4].map(() => ({ rong: 'auto', canh: 2, dot: [800], o: [] })) });
  ok(T2.errors.length === 0 && T2.info.khau.length === 2 && T2.info.khau.map(k => k.ben).join() === 'trai,giua', 'cột góc trái + cột giữa trên tủ 3600 tách thùng', [T2.errors, T2.info.khau]);
  // ngẫu nhiên: không tấm / hộp ngăn kéo nào lấn vào cột, không đè nhau
  let seed = 11; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let hong = 0, dung = 0, nong = 0;
  for (let k = 0; k < 400; k++) {
    const n = 1 + Math.floor(rnd() * 5), rong = 1200 + Math.floor(rnd() * 28) * 100, D = 450 + Math.floor(rnd() * 4) * 50;
    const q = { cach: 150 + Math.floor(rnd() * (rong - 500) / 10) * 10, rong: 150 + Math.floor(rnd() * 35) * 10, sau: 80 + Math.floor(rnd() * 20) * 10 };
    let sp = C0.normalize({ rong, cao: 2000 + Math.floor(rnd() * 8) * 100, sau_thung: D, khau: HO10({ giua: [q] }), khoang: Array.from({ length: n }, () => ({ rong: 'auto', canh: 1 + Math.floor(rnd() * 2), dot: [600, 1300], o: rnd() < 0.3 ? [{ tu: 0, kieu: 'nk_am', so: 2 }] : [] })) });
    if (rnd() < 0.5) { const v = C0.vachTheoCot(sp); if (!v.loi) { sp = v.spec; nong++; } }
    const m = C0.build(sp);
    if (m.errors.length) { if (!m.errors.every(e => /Khấu cột|quá hẹp|Bề rộng lọt lòng|khổ ván|quá thấp|chỉ cao|chỉ còn|quá nông|Cánh/.test(e))) { hong++; if (hong < 3) console.log('   ', m.errors.slice(0, 2)); } continue; }
    if (!m.info.khau.length) continue;
    dung++;
    const K = m.info.khau[0], cot2 = { x0: K.xa, x1: K.xb, y0: K.y, y1: 9999, z0: -1, z1: 9999 };
    if (overlapAny(m).length || m.parts.some(p => C0.overlap(p, cot2) > 0) || m.templates.some(tp => C0.overlap(tplBox(tp), cot2) > 0)) { hong++; if (hong < 4) console.log('    va chạm', k, JSON.stringify(q), overlapAny(m).slice(0, 2), m.parts.filter(p => C0.overlap(p, cot2) > 0).map(p => p.ten).slice(0, 3)); }
  }
  ok(hong === 0 && dung > 120 && nong > 40, `400 tủ ngẫu nhiên có cột giữa (nửa số đặt vách theo mép cột): không gì lấn vào cột, không đè nhau (${dung} tủ dựng được, ${nong} tủ khoang nông)`, [hong, dung, nong]);
});

T('Khe hở quanh cột (bản 1.17.1 — anh Jason 03/10/2026 23:58: "khe khấu cột để 1-2cm cho sau xử lý cho dễ"): mặc định 15, thông số cũ đang để 10 tự lên 15', () => {
  const nen = { rong: 2000, cao: 2400, sau_thung: 580, than: { cao_duoi: 0 }, chan: { cao: 100 }, thung: { rong_max: 0 },
    khoang: [{ rong: 'auto', canh: 2, dot: [400, 1200], o: [] }, { rong: 'auto', canh: 2, dot: [800], o: [] }] };
  const b4 = p => [p.x0, p.x1, p.y0, p.y1];
  eq(C0.DEFAULT_SPEC.khau.ho, 15, 'mặc định 15');
  // cột trái 300 × 200, hở 15 → mặt bên cột x = 315, mặt trước cột y = 580 − 215 = 365, thùng trước cột sâu 347,5 (trừ hậu khấu ván thùng 17,5)
  const M = C0.build(Object.assign({}, nen, { khau: { trai: { rong: 300, sau: 200 } } }));
  eq(M.errors, [], 'khấu trái với khe mặc định: dựng không lỗi');
  const vk = M.parts.find(p => p.khau_cot && p.loai === 'VACH'), hk = M.parts.find(p => p.khau_cot && p.loai === 'HAU');
  eq([b4(vk), b4(hk)], [[315, 332.5, 347.5, 574], [67.5, 315, 347.5, 365]], 'vách khấu cách mặt bên cột 15, hậu khấu cách mặt trước cột 15');
  ok(M.notes.some(t => /Khấu cột: trái 315 × 215 \(cột \+ hở 15\) — thùng trước cột sâu 347,5/.test(t)), 'ghi chú ghi khe hở 15', M.notes);
  // gõ 20 thì theo 20
  const M20 = C0.build(Object.assign({}, nen, { khau: { trai: { rong: 300, sau: 200 }, ho: 20 } }));
  eq(b4(M20.parts.find(p => p.khau_cot && p.loai === 'VACH')), [320, 337.5, 342.5, 574], 'khe 20: vách khấu cách cột 20');
  // thông số lưu từ bản cũ: đang để đúng mặc định cũ (10) → lên 15; số khác thì giữ
  const cu = C0.normalize(Object.assign({}, nen, { khau: { trai: { rong: 300, sau: 200 }, ho: 10 } }));
  const nc = C0.nangCap(cu, '1.17.0');
  ok(nc.spec.khau.ho === 15 && nc.doi.some(t => /Khe hở quanh cột.*15 \(bản cũ: 10\)/.test(t)), 'lưu từ 1.17.0, khe 10, đang có khấu: lên 15 và báo', nc.doi);
  const nc0 = C0.nangCap(C0.normalize(Object.assign({}, nen, { khau: { ho: 10 } })), '1.16.1');
  ok(nc0.spec.khau.ho === 15 && !nc0.doi.some(t => /Khe hở/.test(t)), 'tủ không khấu: lên 15 nhưng không cần báo', nc0.doi);
  eq(C0.nangCap(C0.normalize(Object.assign({}, nen, { khau: { ho: 12 } })), '1.17.0').spec.khau.ho, 12, 'người dùng đã gõ 12: giữ nguyên');
  eq(C0.nangCap(cu, '1.17.1').spec.khau.ho, 10, 'lưu từ 1.17.1 trở đi mà để 10: là lựa chọn của người dùng, giữ nguyên');
  eq(C0.nangCap(cu, undefined).spec.khau.ho, 10, 'không rõ phiên bản: không đổi');
  // tủ đã vẽ giữ nguyên thông số lúc vẽ (để còn dò lại được trên bản vẽ)
  eq(C0.specDaVe(cu, '1.17.0').khau.ho, 10, 'tủ ĐÃ VẼ bằng khe 10: giữ 10');
});

T('Điện – nước trên hình đứng của tủ (bản 1.18): opts.dien_nuoc vẽ ô khoét sau lưng, điểm dưới đáy, điểm sau hồi', () => {
  const M = C0.build({ rong: 2000, cao: 2400, sau_thung: 560, than: { cao_duoi: 0 }, thung: { rong_max: 0 }, khoang: [{ rong: 'auto', canh: 2, dot: [600], o: [] }, { rong: 'auto', canh: 2, dot: [900], o: [] }] });
  ok(!/data-dn=/.test(C0.elevationSVG(M, { tuong_tac: true })), 'không truyền điểm: hình như cũ');
  const dn = [{ j: 0, nhan: 'Ổ1', mat: 'lung', x: 400, z: 300, rong: 120, cao: 80, tron: false, mau: '#c26a00', trung: [] }, { j: 1, nhan: 'CN1', mat: 'lung', x: 990, z: 550, rong: 60, cao: 60, tron: true, mau: '#0a84c4', trung: ['vách'] },
    { j: 2, nhan: 'TS1', mat: 'day', x: 1500, z: 0, rong: 110, cao: 110, tron: true, mau: '#7a4a21', trung: [] }, { j: 3, nhan: 'Ổ2', mat: 'trai', x: 0, z: 300, rong: 120, cao: 80, tron: false, mau: '#c26a00', trung: [] }, { j: 4, nhan: 'CT1', mat: 'phai', x: 2000, z: 1250, rong: 120, cao: 80, mau: '#c26a00', trung: [] }];
  const svg = C0.elevationSVG(M, { tuong_tac: true, dien_nuoc: dn });
  eq((svg.match(/<text data-dn="\d"/g) || []).length, 5, 'mỗi điểm một ký hiệu');
  ok(/<rect x="340" y="2060" width="120" height="80" fill="#fff" fill-opacity="\.8" stroke="#c26a00"[^>]*stroke-dasharray="[^"]+" pointer-events="none"\/>/.test(svg), 'ổ sau lưng: ô nét đứt đúng cỡ 120 × 80, tâm (400, +300), màu của nhóm điện', svg.slice(svg.indexOf('data-dn') - 400, svg.indexOf('data-dn') + 100));
  ok(/<circle cx="990" cy="1850" r="30" fill="#fff" fill-opacity="\.8" stroke="#d9402b"/.test(svg) && /<text data-dn="1"[^>]*fill="#d9402b"[^>]*>CN1<\/text>/.test(svg), 'điểm TRÚNG tấm: tô đỏ (ống Ø60 tại 990, +550)');
  ok(/<circle cx="1500" cy="23\d\d(\.\d)?" r="[\d.]+" fill="#fff" fill-opacity="\.85" stroke="#7a4a21"/.test(svg) && />TS1<\/text>/.test(svg), 'điểm dưới đáy: vòng tròn gạch chéo ở chân tủ');
  ok(/<text data-dn="3" x="-[\d.]+"[^>]*text-anchor="end"[^>]*>Ổ2<\/text>/.test(svg) && /<text data-dn="4" x="20[\d.]+"[^>]*text-anchor="start"[^>]*>CT1<\/text>/.test(svg), 'điểm sau hồi: vạch ở mép trái / phải, ký hiệu ghi ra ngoài tủ');
  const sau = svg.slice(svg.indexOf('data-dn="0"')), truoc = svg.slice(0, svg.indexOf('data-dn="0"'));
  ok(/data-o="/.test(sau) && !/data-o="/.test(truoc) && (svg.match(/data-dn="\d"[^>]*pointer-events="none"/g) || []).length === 5, 'dấu nằm DƯỚI lớp bấm ô / kéo đợt và không bắt chuột: ô, đợt, vách vẫn bấm / kéo được');
});

T('Kế hoạch vẽ bằng LỆNH GỐC của Chenfeng (bản 1.15 — anh Jason 03/10/2026: "em phải vẽ chuẩn chenfeng"; chốt: vách chạy suốt, nóc đáy từng khoang)', () => {
  ok(C0.normalize({}).ve_goc === true && C0.normalize({ ve_goc: false }).ve_goc === false, 'mặc định vẽ bằng lệnh gốc; tắt được');
  const K = C0.keHoachGoc({ ma: 'TG', rong: 1600, cao: 2200, khoang: [{ rong: 'auto', canh: 2, dot: [1100], o: [] }, { rong: 'auto', canh: 2, dot: [600, 1400], o: [] }] });
  eq(K.loi, [], 'tủ 2 khoang: lập được kế hoạch');
  eq(K.buoc.map(b => b.lenh).join(' '), 'LR VE TB BE LY TB BE LY LY DO DO', 'thứ tự lệnh: hồi → vách → từng khoang (nóc đáy → hậu → đợt từ dưới lên) → cánh sau cùng');
  const [lr, ve, tb, be, ly] = K.buoc;
  eq([lr.goc, lr.rong, lr.sau, lr.cao, lr.day, lr.ten, lr.tu], [[50, 0, 0], 1500, 574, 2150, 17.5, ['Hồi trái', 'Hồi phải'], 'TG'], 'LR: điểm đặt = góc trái–trước–dưới của hồi trái, tổng rộng thùng, sâu thùng (đã trừ hậu phủ), cao thân');
  eq([ve.cach, ve.day, ve.ten, ve.diem], [724, 17.5, 'Vách', [800, 287, 1075]], 'VE: vách chạy suốt, cách mặt trong hồi trái đúng bằng lọt lòng khoang 1; điểm chọn nằm giữa 2 hồi');
  eq([tb.noc, tb.day_, tb.khoang], [{ ten: 'Nóc', day: 17.5, ha: 0 }, { ten: 'Đáy', day: 17.5, nang: 100 }, 0], 'TB: nóc sát đầu hồi, đáy nâng đúng cao chân, vẽ theo từng khoang');
  eq([be.day, be.lui, be.ext, be.khoan], [6, -6, { trai: 16.5, phai: 8.5, duoi: 16.5, tren: 16.5 }, C0.KHONG_KHOAN], 'BE: hậu 6 phủ sau (mặt sau cách mép sau thùng −6), trùm hồi 16,5 (lùi mép 1), nối ở tim vách, không khoan');
  eq([ly.cach, ly.day, ly.diem[2]], [982.5, 17.5, 1125], 'LY: đợt +1100 cách mặt trên đáy 982,5; điểm chọn nằm giữa đáy và nóc');
  eq(K.buoc[8].cach, 782.5, 'đợt thứ hai tính từ mặt trên đợt bên dưới');
  const d0 = K.buoc[9];
  eq([d0.so, d0.khe, d0.day, d0.ext, d0.mo, d0.ten, d0.kep.map(i => K.M.parts[i].ten)], [2, 2, 17.5, { trai: 15.5, phai: 7.5, duoi: 15.5, tren: 15.5 }, ['lf', 'rt'], ['Cánh trái', 'Cánh phải'], ['Hồi trái', 'Vách', 'Đáy', 'Nóc']], 'DO: 2 cánh, khe giữa 2, trùm ra tính từ lọt lòng khoang; kẹp = 2 tấm đứng + đáy + nóc của khoang');
  // mỗi tấm thùng / đợt / hậu / cánh thuộc đúng một bước; phần còn lại là phào, chân
  const tam = K.buoc.flatMap(b => b.tam);
  ok(new Set(tam).size === tam.length && tam.every(i => /HOI|VACH|DAY|NOC|DOT|HAU|CANH/.test(K.M.parts[i].loai)), 'không tấm nào bị vẽ 2 lần');
  eq([K.chua.map(c => c.ten + '×' + c.sl).join(', '), K.con_lai.length + tam.length], ['Chân trước×1, Phào trái×1, Phụ trợ phào×3, Phào phải×1, Phào trên×1', K.M.parts.length], 'phần chưa có lệnh gốc: xà chân, phào, phụ trợ phào (vẽ dạng tấm rời)');
  // tủ mặc định: 2 thân × tách thùng, có ngăn kéo, suốt treo
  const K2 = C0.keHoachGoc(C0.DEFAULT_SPEC);
  eq(K2.loi, [], 'tủ mặc định: lập được');
  eq(K2.buoc.filter(b => b.lenh === 'LR').map(b => b.than + b.thung + ':' + b.goc[2]), K2.M.info.than.flatMap(t => K2.M.info.thung.map((q, k) => t.ma + k + ':' + t.z0)), 'mỗi thân × mỗi thùng một mẫu gốc 左右侧板模板, thân trên đặt ở cao độ thân trên');
  ok(K2.chua.some(c => c.loai === 'DEM') && K2.chua.some(c => c.ten === 'Suốt treo') && K2.buoc.filter(b => b.lenh === 'DO').length === K2.M.info.khoang.length * K2.M.info.than.length, 'khung hộc kéo (vách đệm, xà, nẹp) + suốt treo chưa có lệnh gốc; mỗi khoang mỗi thân một lệnh cánh', K2.chua);
  ok(!K2.chua.some(c => c.ten === 'Ngăn kéo') && K2.nk.length === 1 && K2.nk[0].so === 2, 'ngăn kéo của tủ mặc định: có lệnh gốc (bản 1.26) — không còn nằm trong phần "chưa có lệnh gốc"', [K2.chua, K2.nk]);
  // hậu gộp khổ ván → kế hoạch tự chuyển về mỗi khoang một tấm
  ok(C0.keHoachGoc(Object.assign({}, C0.DEFAULT_SPEC, { hau: Object.assign({}, C0.DEFAULT_SPEC.hau, { chia: 'kho_van' }) })).buoc.filter(b => b.lenh === 'BE').length === K2.buoc.filter(b => b.lenh === 'BE').length, 'hậu chia theo khổ ván → vẫn vẽ mỗi khoang một tấm hậu');
  // chưa làm được: hậu kiểu khác, khấu cột → nêu lý do (bảng sẽ vẽ theo cách nhập tấm)
  eq(C0.keHoachGoc(Object.assign({}, C0.DEFAULT_SPEC, { hau: Object.assign({}, C0.DEFAULT_SPEC.hau, { kieu: 'day' }) })).loi, ['hậu không phải kiểu phủ sau'], 'hậu dày: chưa vẽ bằng lệnh gốc');
  eq(C0.keHoachGoc(Object.assign({}, C0.DEFAULT_SPEC, { khau: { trai: { rong: 300, sau: 200 } } })).loi, ['tủ có khấu cột'], 'khấu cột: chưa vẽ bằng lệnh gốc');
  ok(C0.keHoachGoc({ rong: 100 }).loi.length > 0 && C0.keHoachGoc({ rong: 100 }).buoc.length === 0, 'thiết kế lỗi → trả lỗi thiết kế, không có bước nào');
  eq(C0.keHoachGoc({ rong: 100 }).nk, [], 'thiết kế lỗi → danh sách bước ngăn kéo vẫn là mảng rỗng (nơi gọi khỏi phải kiểm)');
  // cánh trùm ngoài ngăn kéo (cánh ngắn lại): phần dưới là "hở vào" (âm)
  const K3 = C0.keHoachGoc({ rong: 1000, cao: 2200, khoang: [{ rong: 'auto', canh: 2, dot: [520], o: [{ tu: 0, kieu: 'nk_trum', so: 2 }] }] });
  const d3 = K3.buoc.find(b => b.lenh === 'DO');
  ok(K3.loi.length === 0 && d3 && d3.ext.duoi < -300, 'cánh phía trên ngăn kéo trùm ngoài: mép dưới cánh hở vào (ext.duoi âm)', d3 && d3.ext);
});

T('Ngăn kéo bằng LỆNH GỐC `DRAWER` của Chenfeng (bản 1.26 — anh Jason 05/10/2026: "phần ngăn kéo vẽ bằng công cụ của chenfeng như vẽ thùng hậu, cánh")', () => {
  // Đã đo trên Chenfeng thật 05/10/2026: chọn 4 tấm kẹp → DRAWER → S → hộp "Drawer Design": số ô, lọt lòng / trùm ngoài, `offset` = lưng mặt cách mép trước KHOẢNG TRỐNG,
  // trùm ra / khe hở 4 phía + khe giữa, mẫu ngăn kéo của kho tài khoản. Khoảng trống sâu tính từ mép trước của tấm kẹp LÙI NHẤT (vách đệm lùi `lùi − dày ván`).
  const ten = (K, i) => K.M.parts[i].ten + '@' + K.M.parts[i].x0;
  // 1) ngăn kéo âm sau 2 cánh: kẹp giữa HAI VÁCH ĐỆM, đáy và đợt
  const K = C0.keHoachGoc({ ma: 'NK', rong: 1000, cao: 2200, khoang: [{ rong: 'auto', canh: 2, dot: [520], o: [{ tu: 0, kieu: 'nk_am', so: 2 }] }] });
  eq([K.loi, K.nk.length], [[], 1], 'một ô ngăn kéo → một bước NK');
  const n = K.nk[0];
  eq([n.lenh, n.than, n.khoang, n.kieu, n.so, n.trong], ['NK', 'D', 0, 'nk_am', 2, true], 'bước NK: thân, khoang, kiểu, số ngăn; ngăn kéo âm = lọt lòng');
  eq(n.kep.map(i => ten(K, i)), ['Vách đệm ngăn kéo@100', 'Vách đệm ngăn kéo@882.5', 'Đáy@67.5', 'Đợt@67.5'], 'kẹp = vách đệm trái, vách đệm phải, đáy, đợt phía trên (đúng thứ tự trái – phải – dưới – trên)');
  eq([n.lui, n.ext, n.khe, n.day, n.cao, n.sau], [0, { trai: -2, phai: -2, duoi: -2, tren: -22.5 }, 22, 17.5, null, 500], 'lưng mặt ngang mép trước vách đệm (bản 1.28: vách đệm lùi sau nẹp — offset 0); khe bên 2, dưới 2, trên 22,5, giữa 22; các mặt bằng nhau → không khoá cao; hộp sâu 500');
  eq([n.mau, n.ts, n.tp, n.mat], [{ id: C0.DEFAULT_SPEC.ngan_keo.loai[0].mau_id, ten: C0.DEFAULT_SPEC.ngan_keo.loai[0].ten_mau }, { GD: 13, LC: 0, SLK: 30, XLK: 30, BH: 17.5 }, [0, 1], [0, 1]], 'mẫu của loại ngăn kéo + tham số riêng của loại + BH = dày mặt thiết kế; các mẫu / mặt của ô xếp từ dưới lên');
  ok(!K.chua.some(c => c.ten === 'Ngăn kéo') && K.chua.some(c => c.loai === 'DEM') && K.chua.some(c => c.loai === 'XA'), 'ngăn kéo có lệnh gốc; vách đệm, xà, nẹp vẫn là tấm rời', K.chua);
  // phần dư làm tròn 0,5 của mặt dồn vào khe trên → vẫn chia đều được, không phải khoá cao
  const Kd = C0.keHoachGoc({ ma: 'NK', rong: 1000, cao: 2200, khoang: [{ rong: 'auto', canh: 2, dot: [521], o: [{ tu: 0, kieu: 'nk_am', so: 3 }] }] }), nd = Kd.nk[0], md = Kd.M.mat_ngan_keo;
  ok(nd.cao === null && Math.abs(nd.ext.tren + (538.5 - 17.5 - (md[2].z + md[2].h))) < 1e-9 && nd.ext.tren < -22.5 && nd.ext.tren >= -23.5, 'mặt làm tròn 0,5: phần dư nằm ở khe TRÊN (trùm ra phía trên âm hơn 22,5 một chút)', [nd.ext, md.map(q => q.h)]);
  // 2) một cánh (bản lề bên trái): chỉ có vách đệm trái — bên phải kẹp bằng hồi; khoảng trống vẫn sâu từ mép vách đệm
  const K1 = C0.keHoachGoc({ ma: 'N1', rong: 700, cao: 2200, khoang: [{ rong: 'auto', canh: 1, dot: [520], o: [{ tu: 0, kieu: 'nk_am', so: 2 }] }] }), n1 = K1.nk[0];
  eq([n1.kep.map(i => ten(K1, i)), n1.lui, n1.ext.trai, n1.ext.phai], [['Vách đệm ngăn kéo@100', 'Hồi phải@632.5', 'Đáy@67.5', 'Đợt@67.5'], 0, -2, -2], 'một cánh: kẹp = vách đệm bên bản lề + hồi bên kia');
  // 3) khoang không cánh (không có vách đệm): kẹp bằng hai hồi, lưng mặt lùi đúng `lùi`
  const K0 = C0.keHoachGoc({ ma: 'N0', rong: 700, cao: 2200, khoang: [{ rong: 'auto', canh: 0, dot: [520], o: [{ tu: 0, kieu: 'nk_am', so: 2 }] }] }), n0 = K0.nk[0];
  eq([n0.kep.map(i => ten(K0, i)), n0.lui], [['Hồi trái@50', 'Hồi phải@632.5', 'Đáy@67.5', 'Đợt@67.5'], 30], 'không vách đệm: kẹp bằng hồi; lưng mặt cách mép trước thùng đúng "lùi" 30');
  // 4) ngăn kéo trùm ngoài: mặt ở mặt phẳng cánh, phủ ra ngoài khoảng kẹp như cánh
  const Kt = C0.keHoachGoc({ ma: 'NT', rong: 1000, cao: 2200, khoang: [{ rong: 'auto', canh: 2, dot: [520], o: [{ tu: 0, kieu: 'nk_trum', so: 2 }] }] }), nt = Kt.nk[0];
  eq([nt.kieu, nt.trong, nt.lui, nt.kep.map(i => ten(Kt, i)), nt.ext, nt.khe, nt.day, nt.cao, nt.sau], ['nk_trum', false, 0, ['Hồi trái@50', 'Hồi phải@932.5', 'Đáy@67.5', 'Đợt@67.5'], { trai: 15.5, phai: 15.5, duoi: 15.5, tren: 8 }, 2, 17.5, null, 550],
    'trùm ngoài: kẹp bằng 2 hồi + đáy + đợt; trùm hồi 15,5, trùm đáy 15,5, lên tới tim đợt (8); khe giữa 2; hộp sâu 550');
  // dày mặt đi theo THIẾT KẾ: ghi vào tham số BH của mẫu (đo 05/10/2026: hộp ray Blum có BH = 18 cố định → mặt ra 18 dù thùng 17,5; mẫu ray bi / ray âm có BH = $BH thì tự theo thùng)
  const Kt18 = C0.keHoachGoc({ ma: 'NT', rong: 1000, cao: 2200, van: Object.assign({}, C0.DEFAULT_SPEC.van, { t_canh: 18 }), khoang: [{ rong: 'auto', canh: 2, dot: [520], o: [{ tu: 0, kieu: 'nk_trum', so: 2 }] }] }).nk[0];
  eq([nt.ts.BH, Kt18.day, Kt18.ts.BH, Kt18.ts.GD], [17.5, 18, 18, 13], 'bước NK: BH của mẫu = dày mặt của thiết kế (trùm ngoài: dày ván cánh), tham số riêng của loại vẫn giữ');
  eq([C0.DEFAULT_SPEC.ngan_keo.loai[0].ts, Kt.spec.ngan_keo.loai[0].ts, Kt.M.spec.ngan_keo.loai[0].ts], [{ GD: 13, LC: 0, SLK: 30, XLK: 30 }, { GD: 13, LC: 0, SLK: 30, XLK: 30 }, { GD: 13, LC: 0, SLK: 30, XLK: 30 }],
    '… không ghi lẫn BH vào Chuẩn xưởng (thông số mặc định, thông số kèm kế hoạch, thông số của mô hình)');
  // mặt trùm ngoài không chia đều được ra số chẵn 0,5 → khoá cao từng mặt (từ dưới lên) để ra đúng số của bảng
  const Kl = C0.keHoachGoc({ ma: 'NL', rong: 1000, cao: 2200, khoang: [{ rong: 'auto', canh: 2, dot: [520], o: [{ tu: 0, kieu: 'nk_trum', so: 3 }] }] });
  eq(Kl.nk[0].cao, [141, 140.5, 140.5], 'mặt không bằng nhau: kèm chiều cao từng mặt, từ dưới lên');
  // 5) trường hợp CHƯA dùng lệnh gốc (vẫn nhập mẫu như bản 1.23): loại có tham số "mat", công thức sâu hộp khác của Chenfeng, loại chưa khai mã mẫu
  const spec = o => Object.assign({ ma: 'NX', rong: 1000, cao: 2200, khoang: [{ rong: 'auto', canh: 2, dot: [520], o: [Object.assign({ tu: 0, kieu: 'nk_am', so: 2 }, o && o.o)] }] }, o && o.s);
  const Kc = C0.keHoachGoc(spec({ o: { loai: 'chia_o' } }));
  ok(Kc.nk.length === 0 && Kc.chua.some(c => c.ten === 'Ngăn kéo' && c.sl === 2), 'ngăn kéo chia ô (tham số CMG = cao mặt): chưa dùng lệnh gốc, vẫn nhập mẫu', [Kc.nk, Kc.chua]);
  const nkS = o => ({ s: { ngan_keo: Object.assign({}, C0.DEFAULT_SPEC.ngan_keo, o) } });
  eq([C0.keHoachGoc(spec(nkS({ ho_sau: 10 }))).nk.length, C0.keHoachGoc(spec(nkS({ buoc_sau: 25 }))).nk.length, C0.keHoachGoc(spec(nkS({ ho_sau: 5, buoc_sau: 50 }))).nk.length], [0, 0, 1], 'hở sau ≠ 5 hoặc bước sâu ≠ 50: công thức sâu hộp của Chenfeng (trừ 5, bậc 50) không ra số của bảng → vẫn nhập mẫu');
  const k0 = C0.keHoachGoc(spec(nkS({ loai: C0.DEFAULT_SPEC.ngan_keo.loai.map(x => Object.assign({}, x, { mau_id: 0 })) })));
  ok(k0.nk.length === 0, 'loại ngăn kéo chưa khai mã mẫu: không có bước NK (ngăn kéo không được vẽ)', k0.nk);
  // 6) tủ mặc định (2 thân, tách thùng): mỗi mẫu ngăn kéo thuộc đúng một bước; suốt treo không thuộc bước nào
  const K2 = C0.keHoachGoc(C0.DEFAULT_SPEC), tp2 = K2.nk.flatMap(b => b.tp);
  ok(new Set(tp2).size === tp2.length && tp2.length === K2.M.templates.filter(t => t.loai === 'NGAN_KEO').length && tp2.every(j => K2.M.templates[j].loai === 'NGAN_KEO'), 'tủ mặc định: mọi hộp ngăn kéo thuộc đúng một bước NK', [tp2, K2.M.templates.map(t => t.loai)]);
  ok(K2.nk.every(b => b.kep.length === 4 && b.kep.every(i => K2.M.parts[i]) && b.mat.length === b.so && b.tp.length === b.so), 'bước nào cũng đủ 4 tấm kẹp, đủ số mặt và số mẫu');
  ok(K2.nk.every(b => b.kep.every(i => K2.M.parts[i].than === b.than)), 'tủ 2 thân: 4 tấm kẹp của một bước đều thuộc đúng thân của ô ngăn kéo', K2.nk.map(b => b.kep.map(i => K2.M.parts[i].than)));
  eq([K2.nk[0].tp, K2.nk[0].mat, K2.nk[0].mat.map(m => K2.M.mat_ngan_keo[m].khoang)], [[1, 2], [0, 1], [1, 1]], 'tủ còn mẫu khác (suốt treo): `tp` là chỉ số trong M.templates, `mat` là chỉ số trong M.mat_ngan_keo — hai dãy số khác nhau');
  // 7) một ô chỉ MỘT ngăn kéo: không có "khe giữa hai mặt" để đo → lấy khe của Chuẩn xưởng (âm: khe giữa 22; trùm ngoài: khe cánh 2)
  eq([C0.keHoachGoc(spec({ o: { so: 1 } })).nk[0].khe, C0.keHoachGoc(spec({ o: { so: 1, kieu: 'nk_trum' } })).nk[0].khe], [22, 2], 'ô một ngăn: khe giữa lấy theo Chuẩn xưởng');
  // … và số đó đúng là khe giữa hai mặt mà lõi dựng ra, kể cả khi Chuẩn xưởng để số khác mặc định
  const kheThat = K => { const b = K.nk[0], m = b.mat.map(j => K.M.mat_ngan_keo[j]); return [b.khe, m[1].z - (m[0].z + m[0].h)]; };
  eq([kheThat(C0.keHoachGoc(spec(nkS({ khe_giua: 30 })))), kheThat(C0.keHoachGoc(spec({ o: { kieu: 'nk_trum' }, s: { canh: Object.assign({}, C0.DEFAULT_SPEC.canh, { khe: 3 }) } })))], [[30, 30], [3, 3]],
    'khe giữa hai mặt của bước = khe thật giữa hai mặt trong mô hình (âm: "khe giữa" của ngăn kéo; trùm ngoài: khe cánh)');
  // 8) một khoang có HAI ô ngăn kéo âm chồng nhau: mỗi ô một bước, kẹp bằng vách đệm của CHÍNH ô đó (vách đệm của ô kia cùng vị trí ngang nhưng khác cao độ)
  const Kh = C0.keHoachGoc({ ma: 'NH', rong: 1000, cao: 2200, khoang: [{ rong: 'auto', canh: 2, dot: [520, 1000], o: [{ tu: 0, kieu: 'nk_am', so: 2 }, { tu: 520, kieu: 'nk_am', so: 2 }] }] });
  eq(Kh.nk.map(b => [b.so, b.kep.slice(0, 2).map(i => [Kh.M.parts[i].loai, Kh.M.parts[i].z0, Kh.M.parts[i].z1]), Kh.M.parts[b.kep[2]].ten, Kh.M.parts[b.kep[3]].z0]),
    [[2, [['DEM', 117.5, 520], ['DEM', 117.5, 520]], 'Đáy', 520], [2, [['DEM', 537.5, 1000], ['DEM', 537.5, 1000]], 'Đợt', 1000]],
    'hai ô ngăn kéo chồng nhau trong một khoang: ô dưới kẹp bằng vách đệm 117,5 … 520 (từ mặt trên đáy) + đáy + đợt 520; ô trên kẹp bằng vách đệm 537,5 … 1000 + đợt 520 + đợt 1000');
  ok(new Set(Kh.nk.flatMap(b => b.tp)).size === 4 && !Kh.chua.some(c => c.ten === 'Ngăn kéo'), '… đủ 4 hộp ngăn kéo, không cái nào còn nằm ở phần "chưa có lệnh gốc"');
  // 9) HAI KHOANG cùng có ô ngăn kéo ở cùng cao độ (khoang không cánh → kẹp bằng hồi / vách): mỗi khoang một bước, đáy và đợt là của CHÍNH khoang đó
  const Kb = C0.keHoachGoc({ ma: 'NB', rong: 1400, cao: 2200, thung: { rong_max: 0 }, khoang: [{ rong: 'auto', canh: 0, dot: [520], o: [{ tu: 0, kieu: 'nk_am', so: 2 }] }, { rong: 'auto', canh: 0, dot: [520], o: [{ tu: 0, kieu: 'nk_am', so: 3 }] }] });
  eq(Kb.nk.map(b => [b.khoang, b.so, b.kep.map(i => ten(Kb, i))]), [[0, 2, ['Hồi trái@50', 'Vách@691.5', 'Đáy@67.5', 'Đợt@67.5']], [1, 3, ['Vách@691.5', 'Hồi phải@1332.5', 'Đáy@709', 'Đợt@709']]],
    'hai khoang, ô ngăn kéo cùng cao độ: hai bước riêng; vách giữa là tấm kẹp của cả hai; đáy / đợt lấy đúng khoang');
  // 10) trùm ngoài ở khoang thứ hai của tủ 2 khoang: bên vách giữa chỉ trùm tới gần tim vách, bên hồi trùm gần hết hồi
  const nt2 = C0.keHoachGoc({ ma: 'NT2', rong: 1400, cao: 2200, thung: { rong_max: 0 }, khoang: [{ rong: 'auto', canh: 2, dot: [1100], o: [] }, { rong: 'auto', canh: 2, dot: [520], o: [{ tu: 0, kieu: 'nk_trum', so: 2 }] }] }).nk[0];
  eq([nt2.khoang, nt2.ext], [1, { trai: 8, phai: 15.5, duoi: 15.5, tren: 8 }], 'trùm ngoài cạnh vách giữa: trùm trái (vách) 8, trùm phải (hồi) 15,5 — không được lẫn hai bên');
  // 11) ô ngăn kéo sát nóc: tấm kẹp trên là NÓC
  const Kn = C0.keHoachGoc({ ma: 'NN', rong: 1000, cao: 2200, khoang: [{ rong: 'auto', canh: 2, dot: [1800], o: [{ tu: 1800, kieu: 'nk_am', so: 2 }] }] });
  eq(Kn.nk[0].kep.map(i => ten(Kn, i)), ['Vách đệm ngăn kéo@100', 'Vách đệm ngăn kéo@882.5', 'Đợt@67.5', 'Nóc@67.5'], 'ô ngăn kéo trên cùng: kẹp giữa đợt và nóc');
  // 12) một cánh bản lề bên PHẢI: vách đệm chỉ có ở bên phải — mép trước khoảng trống vẫn là mép vách đệm
  const Kp = C0.keHoachGoc({ ma: 'NP', rong: 700, cao: 2200, khoang: [{ rong: 'auto', canh: 1, ban_le: 'phai', dot: [520], o: [{ tu: 0, kieu: 'nk_am', so: 2 }] }] });
  eq([Kp.nk[0].kep.map(i => ten(Kp, i)), Kp.nk[0].lui], [['Hồi trái@50', 'Vách đệm ngăn kéo@582.5', 'Đáy@67.5', 'Đợt@67.5'], 0], 'một cánh bản lề phải: kẹp = hồi trái + vách đệm phải; lưng mặt ngang mép vách đệm (bản 1.28)');
  // tắt nẹp (Chuẩn xưởng): vách đệm ra ngang mặt ngăn kéo như trước bản 1.28 → lưng mặt cách mép vách đệm một dày ván
  const Kk = C0.keHoachGoc({ ma: 'NK', rong: 1000, cao: 2200, ngan_keo: { nep_khe: 0 }, khoang: [{ rong: 'auto', canh: 2, dot: [520], o: [{ tu: 0, kieu: 'nk_am', so: 2 }] }] });
  eq([Kk.nk[0].lui, Kk.M.parts.filter(p => p.loai === 'DEM').map(p => p.y0), Kk.M.parts.filter(p => p.loai === 'NEP').length], [17.5, [12.5, 12.5], 0], 'tắt nẹp: vách đệm từ 12,5 (ngang mặt ngăn kéo), offset 17,5, không nẹp');
  // tủ khấu cột / hậu khác kiểu phủ: cả tủ chưa vẽ bằng lệnh gốc → không có bước NK
  eq(C0.keHoachGoc(Object.assign({}, C0.DEFAULT_SPEC, { khau: { trai: { rong: 300, sau: 200 } } })).nk, [], 'tủ có khấu cột: không có bước NK');
});

T('Lệnh DRAWER (bản 1.26): lựa chọn của hộp "Drawer Design" theo một bước NK + mẫu ngăn kéo dựng từ bản ghi kho mẫu', () => {
  const buoc = o => C0.keHoachGoc({ ma: 'NK', rong: 1000, cao: 2200, khoang: [{ rong: 'auto', canh: 2, dot: [520], o: [Object.assign({ tu: 0, kieu: 'nk_am', so: 2 }, o)] }] }).nk[0];
  // Đã đo trên Chenfeng thật 05/10/2026: m_Option giữ trùm ra / khe hở / offset dạng CHUỖI; lọt lòng = doorPosType 1, bốn "trùm ra" về 0, khe hở 4 phía + khe giữa; isAuto + isFloor50 để Chenfeng tự tính sâu hộp
  eq(C0.lcNganKeo(buoc()), { lc: { row: 2, col: 1, isAllSelect: true, topOffset: 0, bottomOffset: 0, doorPosType: 1, offset: '0', leftExt: '0', leftSpace: '2', rightExt: '0', rightSpace: '2', topExt: '0', topSpace: '22.5', bottomExt: '0', bottomSpace: '2', midSpace: '22', isAuto: true, isFloor50: true }, cao: null },
    'ngăn kéo âm: Inner Cover, offset = lưng mặt cách mép trước khoảng trống, không trùm ra, khe hở trái / phải / dưới 2, trên 22,5, giữa 22');
  eq(C0.lcNganKeo(buoc({ kieu: 'nk_trum' })), { lc: { row: 2, col: 1, isAllSelect: true, topOffset: 0, bottomOffset: 0, doorPosType: 0, offset: '0', leftExt: '15.5', leftSpace: '0', rightExt: '15.5', rightSpace: '0', topExt: '8', topSpace: '0', bottomExt: '15.5', bottomSpace: '0', midSpace: '2', isAuto: true, isFloor50: true }, cao: null },
    'ngăn kéo trùm ngoài: Outer Cover, trùm ra 4 phía theo thiết kế, không khe hở, khe giữa 2');
  eq(C0.lcNganKeo(buoc({ kieu: 'nk_trum', so: 3 })).cao, [140.5, 140.5, 141], 'mặt không bằng nhau: cao từng ô xếp từ TRÊN xuống (hộp thoại đánh số ô 0 = trên cùng; bước NK xếp từ dưới lên)');
  eq(C0.lcNganKeo(buoc({ so: 3 })).lc.row, 3, 'số ô = số ngăn');
  // mẫu ngăn kéo: bản ghi của CAD-moduleList (mã, tên, hình) + các hàng tham số đã giải nén → đúng thứ hộp "Select Template" của Chenfeng gán vào từng ô
  const hang = [[3, 'L', '', 600, null, '', 1, null, null], [3, 'GD', '13', 13, null, '滑轨间隙', 1, null, null], [3, 'SLK', '', 30, null, '上留空', 1, 0, 100], [3, 'W', '_W-5', 450, null, '', 1]];
  const ts0 = { name: '', value: 0, description: '', expr: '', isLock: false, type: 1, option: [], isOptionOnly: false, minCompareType: '>=', maxCompareType: '<=', defaultDir: '', defaultDirId: '', min: null, max: null };
  const T0 = C0.tempNganKeo({ module_id: 123456, name: 'Ngăn kéo thử', logo: 'thu/a.png', diy_logo: '' }, hang);
  eq(T0, { id: '123456', name: 'Ngăn kéo thử', logo: 'thu/a.png', title: '选择抽屉', tagName: '', diy_logo: '', isHandle: false, isHinge: false, isKuGan: false, props: [
    Object.assign({}, ts0, { name: 'L', value: 600 }), Object.assign({}, ts0, { name: 'GD', value: 13, description: '滑轨间隙', expr: '13' }),
    Object.assign({}, ts0, { name: 'SLK', value: 30, description: '上留空', min: 0, max: 100 }), Object.assign({}, ts0, { name: 'W', value: 450, expr: '_W-5' })] },
    'mẫu: mã dạng chuỗi, tên, hình, danh sách tham số đủ các trường mặc định (thiếu `props` là Chenfeng ném lỗi lúc dựng)');
  eq(Object.keys(T0.props[0]), Object.keys(ts0), 'thứ tự trường của một tham số đúng như Chenfeng tự tạo');
  // tham số riêng của loại ngăn kéo (Chuẩn xưởng) ghi đè giá trị mặc định của mẫu; tham số là công thức thì giữ nguyên; tham số mẫu không có thì không thêm.
  // Đo trên Chenfeng thật 05/10/2026: lệnh DRAWER áp BIỂU THỨC (`expr`) của từng tham số, không áp `value` — ghi đè mà để biểu thức rỗng thì Chenfeng vẫn dùng số mặc định của mẫu
  // (hộp ray Blum: BH ghi value 17,5 / expr '' → mặt vẫn 18; ghi expr '17.5' → mặt 17,5).
  const T1 = C0.tempNganKeo({ module_id: 123456, name: 'Ngăn kéo thử' }, hang, { GD: 21, SLK: 20, W: 400, XLK: 10 });
  eq(T1.props.map(p => [p.name, p.value, p.expr]), [['L', 600, ''], ['GD', 21, '21'], ['SLK', 20, '20'], ['W', 450, '_W-5']], 'ghi đè GD, SLK: cả giá trị lẫn BIỂU THỨC (kể cả khi mẫu để biểu thức rỗng); W là công thức → giữ; XLK mẫu không có → bỏ qua; L không ghi đè → giữ nguyên biểu thức rỗng');
  eq([T1.logo, T1.diy_logo, hang[1][3]], ['', '', 13], 'bản ghi thiếu hình vẫn dựng được; không sửa vào dữ liệu gốc');
  // BH (dày mặt) — hai kiểu mẫu đã đo trên Chenfeng thật: hộp ray Blum BH = 18 cố định → ghi đè bằng dày mặt thiết kế; ray bi / ray âm BH = $BH (theo thùng) → giữ công thức
  eq([C0.tempNganKeo({ module_id: 9, name: 'Blum' }, [[3, 'BH', '', 18, null, null, 1, null, null]], { BH: 17.5 }).props.map(p => [p.value, p.expr]), C0.tempNganKeo({ module_id: 9, name: 'Ray bi' }, [[3, 'BH', '$BH', 18, null, null, 1, null, null]], { BH: 17.5 }).props.map(p => [p.value, p.expr])],
    [[[17.5, '17.5']], [[18, '$BH']]], 'BH cố định của mẫu nhận dày mặt thiết kế (ghi thành biểu thức); BH = $BH giữ nguyên (mặt tự theo dày ván thùng)');
  // đúng công thức đã đo: ghi chú lấy NGUYÊN trường [5] (kể cả null), biểu thức trống (null / '') thành ''
  eq(C0.tempNganKeo({ module_id: 7, name: 'x' }, [[3, 'LC', null, 0, null, null, 1, null, null]]).props.map(p => [p.description, p.expr]), [[null, '']], 'ghi chú null giữ null; biểu thức null thành chuỗi rỗng');
  // hàng tham số lạ (bản khác 3, kiểu khác 1, thiếu tên) → không dựng (bảng sẽ chèn ngăn kéo bằng mẫu như trước, không đưa dữ liệu lạ cho Chenfeng)
  eq([C0.tempNganKeo({ module_id: 1, name: 'x' }, [[2, 'L', '', 600, null, '', 1]]), C0.tempNganKeo({ module_id: 1, name: 'x' }, [[3, 'L', '', 600, null, '', 2]]), C0.tempNganKeo({ module_id: 1, name: 'x' }, [[3, 5, '', 600, null, '', 1]]),
    C0.tempNganKeo({ module_id: 1, name: 'x' }, []), C0.tempNganKeo({ module_id: 1, name: 'x' }, null), C0.tempNganKeo({ module_id: 0, name: 'x' }, hang), C0.tempNganKeo(null, hang)], [null, null, null, null, null, null, null],
    'hàng tham số không đúng dạng đã đo / không có tham số / không có mã mẫu → null');
});

T('Cả tủ là MỘT module (bản 1.16): biểu thức co giãn cho từng lệnh gốc lấy từ heSo', () => {
  eq([C0.bieuThucTT(-8.75, 0.5, 'L'), C0.bieuThucTT(50, 0, '_L'), C0.bieuThucTT(0, 1, '_W'), C0.bieuThucTT(-100, 1, '_L'), C0.bieuThucTT(12.5, -0.25, 'H'), C0.bieuThucTT(0, -1, 'H')], ['-8.75+L*0.5', '50', '_W', '-100+_L', '12.5-H*0.25', '-H'], 'cách viết biểu thức tuyến tính');
  // tủ 1 thùng 2 khoang: khoang 1 có 2 cánh, khoang 2 có 1 cánh → vách chia theo tỉ lệ 2 : 1
  const spec = { ma: 'T', rong: 1400, cao: 2200, khoang: [{ rong: 'auto', canh: 2, dot: [1150], o: [] }, { rong: 'auto', canh: 1, dot: [750, 1500], o: [] }] };
  const K = C0.keHoachGoc(spec), lr = K.buoc[0], ve = K.buoc[1];
  eq([K.gan.goc, K.gan.kich, K.gan.co], [[0, -17.5, 0], [1400, 597.5, 2200], { L: true, W: true, H: true }], 'module mẹ: gốc = góc nhỏ nhất của tủ (mặt cánh), L / W / H = phủ bì');
  eq(lr.gan, { px: '50', l: '-100+_L', py: '17.5', w: '-23.5+_W', pz: '0', h: '-50+_H' }, 'thùng: nằm sau phào trái 50, rộng = L − 2 phào, sâu = W − cánh − hậu, cao = H − phào trên');
  ok(/^-?[\d.]+\+L\*0\.6666/.test(ve.cach_bt) && ve.kep.map(i => K.M.parts[i].ten).join() === 'Hồi trái,Hồi phải', 'vách: khoảng cách tới hồi trái = biểu thức theo bề rộng khoảng trống (2/3), kẹp giữa hồi trái và hồi phải', ve.cach_bt);
  // biểu thức phải cho đúng vị trí khi dựng lại tủ ở kích thước khác
  const gt = (bt, bien) => Function(...Object.keys(bien), 'return ' + bt)(...Object.values(bien));
  for (const [dL, dW, dH] of [[200, 0, 0], [-150, 60, -100], [300, -40, -200]]) {      // cao không vượt chiều cao thân dưới 2200 (vượt là tủ tách 2 thân — đổi số tấm, không còn tuyến tính)
    const s2 = Object.assign({}, spec, { rong: spec.rong + dL, cao: spec.cao + dH, sau_thung: C0.normalize(spec).sau_thung + dW }), K2 = C0.keHoachGoc(s2);
    const bien = { _L: K2.gan.kich[0], _W: K2.gan.kich[1], _H: K2.gan.kich[2] };
    const lr2 = K2.buoc[0], ve2 = K2.buoc[1];
    ok(near(gt(lr.gan.l, bien), lr2.rong, 0.06) && near(gt(lr.gan.w, bien), lr2.sau, 0.06) && near(gt(lr.gan.h, bien), lr2.cao, 0.06) && near(gt(lr.gan.px, bien), lr2.goc[0] - K2.gan.goc[0], 0.06), `đổi L ${dL}, W ${dW}, H ${dH}: biểu thức của thùng ra đúng kích thước dựng lại`, [gt(lr.gan.l, bien), lr2.rong, gt(lr.gan.w, bien), lr2.sau, gt(lr.gan.h, bien), lr2.cao]);
    const Ls = K2.M.parts[ve2.kep[1]].x0 - K2.M.parts[ve2.kep[0]].x1;
    ok(near(gt(ve.cach_bt, { L: Ls }), ve2.cach, 0.6), `đổi L ${dL}: biểu thức của vách ra đúng chỗ vách dựng lại (lệch dưới 0,6 do cánh làm tròn 0,5)`, [gt(ve.cach_bt, { L: Ls }), ve2.cach]);
    // đợt đặt theo cao độ tuyệt đối → khoảng cách tới tấm dưới là hằng số
    K.buoc.filter(b => b.lenh === 'LY').forEach((b, i) => ok(!isNaN(Number(b.cach_bt)) && near(Number(b.cach_bt), K2.buoc.filter(x => x.lenh === 'LY')[i].cach, 0.06), `đổi H ${dH}: đợt ${i + 1} giữ cao độ`, b.cach_bt));
  }
  // tủ mặc định (2 thân, 2 thùng): mỗi thùng một bộ biểu thức; thân trên bám theo H
  const K3 = C0.keHoachGoc(C0.DEFAULT_SPEC), L3 = K3.buoc.filter(b => b.lenh === 'LR');
  ok(L3.length === 4 && L3.every(b => b.gan && b.gan.w === '-23.5+_W'), '4 thùng (2 thân × 2 thùng) đều có biểu thức', L3.map(b => b.gan));
  const s3 = Object.assign({}, C0.DEFAULT_SPEC, { rong: C0.DEFAULT_SPEC.rong + 300, cao: C0.DEFAULT_SPEC.cao + 100 }), K4 = C0.keHoachGoc(Object.assign({}, s3, { thung: Object.assign({}, C0.normalize(s3).thung, { tach: K3.M.info.tach }) })), L4 = K4.buoc.filter(b => b.lenh === 'LR');
  const bien3 = { _L: K4.gan.kich[0], _W: K4.gan.kich[1], _H: K4.gan.kich[2] };
  ok(L4.length === 4 && L3.every((b, i) => near(gt(b.gan.l, bien3), L4[i].rong, 0.3) && near(gt(b.gan.px, bien3), L4[i].goc[0] - K4.gan.goc[0], 0.3) && near(gt(b.gan.pz, bien3), L4[i].goc[2] - K4.gan.goc[2], 0.06) && near(gt(b.gan.h, bien3), L4[i].cao, 0.06)), 'tủ mặc định + 300 rộng + 100 cao: 4 thùng ra đúng chỗ, đúng cỡ', L3.map((b, i) => [gt(b.gan.l, bien3), L4[i].rong, gt(b.gan.px, bien3), L4[i].goc[0], gt(b.gan.pz, bien3), L4[i].goc[2]]));
  // vách không có biểu thức thừa khi khoang gõ số cứng: khoang 1 cố định → vách đứng yên
  const K5 = C0.keHoachGoc({ rong: 1400, cao: 2200, khoang: [{ rong: 500, canh: 1, dot: [], o: [] }, { rong: 'auto', canh: 2, dot: [], o: [] }] });
  ok(!isNaN(Number(K5.buoc[1].cach_bt)) && Number(K5.buoc[1].cach_bt) === 500, 'khoang gõ bề rộng cứng 500: vách cách hồi trái đúng 500, không co giãn', K5.buoc[1].cach_bt);
  ok(K.hs && K.hs.bien.L && K.con_lai.every(p => K.M.parts.includes(p)), 'trả kèm hệ số (hs) và danh sách tấm rời để driver gắn hành động');
});

T('Khoảng trống mỗi lệnh gốc phải dò ra (khoangMong) khớp với chính kế hoạch — máy vẽ dùng để kiểm hộp xem trước của Chenfeng', () => {
  // dựng lần lượt như máy vẽ: tới bước nào thì các tấm của những bước trước đã có trên bản vẽ
  const thu = (ten, spec) => {
    const K = C0.keHoachGoc(spec), P = K.M.parts, daVe = [];
    ok(K.loi.length === 0 && K.buoc.length > 3, `${ten}: có kế hoạch lệnh gốc`, K.loi);
    let soDo = 0;
    for (const b of K.buoc) {
      const tam = b.tam.map(i => P[i]);
      if (b.diem) {
        const m = C0.khoangMong(daVe, b.diem); soDo++;
        const nhan = `${ten} — ${b.lenh}${b.khoang !== undefined ? ' khoang ' + (b.khoang + 1) : ''} tại ${b.diem.join(' / ')}`;
        ok(m.x0 !== null && m.x1 !== null && m.x0 < b.diem[0] && m.x1 > b.diem[0], `${nhan}: hai bên điểm dò đã có tấm đứng`, m);
        if (b.lenh === 'VE') ok(near(tam[0].x0 - m.x0, b.cach, 0.01) && m.x0 === P[b.kep[0]].x1 && m.x1 === P[b.kep[1]].x0, `${nhan}: vách cách đúng tấm đứng bên trái \`cach\`, khoảng kẹp = 2 tấm \`kep\``, [m, b.cach]);
        if (b.lenh === 'TB') ok(tam.every(p => near(p.x0, m.x0, 0.01) && near(p.x1, m.x1, 0.01)), `${nhan}: nóc + đáy lọt đúng giữa 2 tấm đứng`, [m, tam.map(p => [p.x0, p.x1])]);
        if (b.lenh === 'BE') ok(m.z0 !== null && m.z1 !== null && near(m.x0 - tam[0].x0, b.ext.trai, 0.01) && near(tam[0].x1 - m.x1, b.ext.phai, 0.01) && near(m.z0 - tam[0].z0, b.ext.duoi, 0.01) && near(tam[0].z1 - m.z1, b.ext.tren, 0.01), `${nhan}: hậu trùm ra 4 phía đúng \`ext\` tính từ khoảng giữa hồi / vách / đáy / nóc`, [m, b.ext]);
        if (b.lenh === 'LY') ok(m.z0 === P[b.kep[0]].z1 && m.z1 === P[b.kep[1]].z0 && near(tam[0].z0 - m.z0, b.cach, 0.01), `${nhan}: đợt cách đúng tấm bên dưới \`cach\`, phía trên là nóc`, [m, b.cach]);
        // điểm dò nằm hẳn trong khoảng (không sát mép tấm nào — chuột sát mép dễ dính tấm bên cạnh)
        ok(b.diem[0] - m.x0 > 20 && m.x1 - b.diem[0] > 20 && (m.z0 === null || b.diem[2] - m.z0 > 5) && (m.z1 === null || m.z1 - b.diem[2] > 5), `${nhan}: điểm dò cách mép các tấm quanh nó`, [m, b.diem]);
      }
      daVe.push(...tam);
    }
    return soDo;
  };
  ok(thu('tủ 1 thùng 2 khoang', { ma: 'T', rong: 1400, cao: 2200, khoang: [{ rong: 'auto', canh: 2, dot: [1150], o: [] }, { rong: 'auto', canh: 1, dot: [450, 790, 1130, 1470, 1810], o: [] }] }) >= 10, 'tủ 1 thùng: đủ các bước dò');
  ok(thu('tủ mặc định (2 thân, 2 thùng)', C0.DEFAULT_SPEC) >= 12, 'tủ mặc định: đủ các bước dò');
  ok(thu('tủ cao 2700 (thân trên đặt trên thân dưới)', { ma: 'T', rong: 1600, cao: 2700, khoang: [{ rong: 'auto', canh: 2, dot: [1150], o: [] }, { rong: 'auto', canh: 2, dot: [450, 790, 1130, 1470, 1810], o: [] }] }) >= 14, 'tủ 2 thân: đủ các bước dò');
  // tấm trùm lên điểm trên hình chiếu (hậu) không tính là tấm chắn; chưa có tấm phía nào thì phía đó để trống
  eq(C0.khoangMong([{ x0: 0, x1: 18, z0: 0, z1: 2200 }, { x0: 982, x1: 1000, z0: 0, z1: 2200 }, { x0: 0, x1: 1000, z0: 100, z1: 2100 }], [500, 300, 1100]), { x0: 18, x1: 982, z0: null, z1: null }, 'chỉ có 2 hồi + hậu: trái / phải là 2 hồi, trên / dưới để trống');
  eq(C0.khoangMong([], [0, 0, 0]), { x0: null, x1: null, z0: null, z1: null }, 'chưa vẽ tấm nào: không có khoảng mong đợi');
});

// Bản 1.23 — anh Jason 04/10/2026 23:02: "khấu cột giữa thì phải cân đối khoang tủ … thường khấu sẽ nằm trong khoang tủ". Cột nằm trong khoang thì hộp che cột chỉ chiếm phần SAU của một đoạn khoang;
// trước bản này suốt treo của khoang đó bị dồn ra phần nông trước cột (tâm suốt cách mặt trước 175) → móc áo chạm cánh, bảng báo "khoang treo chỉ sâu 350" cho cả hai khoang cạnh cột.
T('Khấu cột: suốt treo của khoang dính cột vẫn nằm giữa chiều sâu thật của khoang khi thanh suốt đi lọt trước hộp che cột (bản 1.23)', () => {
  const C = require('../src/mncf-core.js');
  const TA4 = { ma: 'TA4', rong: 3000, cao: 2700, sau_thung: 582.5, than: { cao_duoi: 2200 }, chan: { cao: 100 }, phao: { trai: 50, phai: 50, tren: 50, phu_tro: 80, noi: 'moi_vach' },
    khoang: [{ rong: 'auto', canh: 2, dot: [1900], o: [{ tu: 100, kieu: 'suot' }] }, { rong: 'auto', canh: 2, dot: [570], o: [{ tu: 100, kieu: 'nk_am', so: 2 }, { tu: 570, kieu: 'suot' }] }, { rong: 'auto', canh: 2, dot: [450, 790, 1130, 1470, 1810], o: [] }] };
  const suot = M => M.templates.filter(t => t.loai === 'SUOT').map(t => [t.khoang, t.pos, t.box]);
  const M0 = C.build(TA4);
  eq([M0.errors, suot(M0)], [[], [[0, [67.5, 0, 117.5], [941, 576.5, 1782.5]], [1, [1026, 0, 587.5], [940, 576.5, 1595]]]], '(không cột) hai suốt treo sâu trọn khoang 576,5 — tâm suốt cách mặt trước 288');
  // cột giữa 300 × 200 đứng sau vách giữa khoang 1 và 2: mặt trước hộp che cột ở +350, thanh suốt ở +288 đi lọt phía trước
  const M1 = C.build(Object.assign({}, TA4, { khau: { giua: [{ cach: 1000, rong: 300, sau: 200 }], ho: 15 } }));
  eq([M1.errors, M1.info.khau.map(k => k.sau_thung), suot(M1)], [[], [350], suot(M0)], 'cột giữa 300 × 200: suốt treo hai khoang dính cột y như tủ không cột (không bị dồn ra phần nông trước cột)');
  ok(!M1.warnings.some(w => /khoang treo chỉ sâu/.test(w)), '… không còn cảnh báo "khoang treo chỉ sâu 350"', M1.warnings);
  const che = M1.warnings.filter(w => /hộp che cột/.test(w));
  ok(che.length === 1 && /^Khoang 2: hộp che cột chiếm 306,5 trong 940 bề ngang/.test(che[0]) && /còn 633,5/.test(che[0]), '… chỉ nhắc khoang bị hộp che cột chiếm đáng kể (khoang 2: 306,5 / 940, còn treo được 633,5); khoang 1 chỉ mất 47,5 thì không nhắc', che);
  eq(M1.templates.filter(t => t.loai === 'NGAN_KEO').map(t => t.box[1]), [300, 300], '… hộp ngăn kéo (chạy hết bề ngang khoang) thì vẫn nông theo phần trước cột');
  // cột sâu 260: mặt trước hộp che cột ở +290, thanh suốt ở +288 không còn lọt → suốt dồn ra phần nông như cũ, có cảnh báo
  const k2 = TA4.khoang.map((k, i) => (i === 1 ? Object.assign({}, k, { o: [{ tu: 570, kieu: 'suot' }] }) : k));
  const M2 = C.build(Object.assign({}, TA4, { khoang: k2, khau: { giua: [{ cach: 1000, rong: 300, sau: 260 }], ho: 15 } }));
  eq([M2.errors, M2.info.khau.map(k => k.sau_thung), suot(M2).map(x => x[2][1])], [[], [290], [290, 290]], 'cột sâu 260: thanh suốt không lọt trước hộp che cột → suốt treo nằm trong phần nông 290');
  eq(M2.warnings.filter(w => /khoang treo chỉ sâu 290/.test(w)).length, 2, '… và cảnh báo khoang treo nông cho cả hai khoang');
  // cột góc trái 300 × 200: như cột giữa — suốt khoang 1 sâu trọn khoang, nhắc phần bị che
  const M3 = C.build(Object.assign({}, TA4, { khau: { trai: { rong: 300, sau: 200 }, ho: 15 } }));
  eq([M3.errors, suot(M3)], [[], suot(M0)], 'cột góc trái 300 × 200: suốt treo khoang 1 vẫn sâu trọn khoang');
  ok(M3.warnings.some(w => /^Khoang 1: hộp che cột chiếm 265 trong 941 bề ngang/.test(w) && /còn 676/.test(w)) && !M3.warnings.some(w => /khoang treo chỉ sâu/.test(w)), '… nhắc khoang 1 mất 265 bề ngang treo, còn 676', M3.warnings);
});

// Bản 1.27 — ĐO MẠNG tới Chenfeng (anh Thanh 05/10/2026 20:14 "làm sao hết lag nhỉ", 21:56 "làm sao để máy chủ ổn định được"). Đã đo trên máy anh (22:05 – 22:15): mạng trong nước + Google 0,04 s đều;
// riêng đường tới Chenfeng mỗi lượt 0,29 s và RỚT GÓI từng đợt — lượt bị rớt một gói chậm thành 0,65 – 0,7 s, hai gói 1,1 – 1,5 s, ba gói 3 s (TCP gửi lại, giãn gấp đôi), có lúc đứt 10 – 20 giây.
// Vì thế "tốt / kém" tính theo SỐ LƯỢT chậm hoặc rớt trong cả loạt đo (con số để so các đường VPN), không theo thời gian trung bình.
T('Đo mạng: xếp loại theo số lượt chậm hoặc rớt (bản 1.27)', () => {
  const C = require('../src/mncf-core.js');
  const lap = (n, v) => Array.from({ length: n }, () => v);
  const dg = (ms, rot, them) => { const r = C.danhGiaMang(Object.assign({ ms, rot: rot || 0, n: ms.length + (rot || 0) }, them || {})); return [r.muc, r.x, r.n, r.nhanh, r.cham]; };
  eq(dg(lap(20, 300)), ['tot', 0, 20, 300, 300], '20 lượt đều 0,3 s: tốt, 0/20');
  eq(dg(lap(19, 300).concat([700])), ['tot', 1, 20, 300, 700], 'một lượt chậm trong 20 (không rớt): vẫn tốt');
  eq(dg(lap(18, 300).concat([700, 3100])), ['tam', 2, 20, 300, 3100], 'hai lượt chậm: tạm được');
  eq(dg(lap(16, 300).concat([700, 700, 1500, 3100])), ['tam', 4, 20, 300, 3100], 'bốn lượt chậm trong 20: còn tạm được');
  eq(dg(lap(15, 300).concat([700, 700, 700, 1500, 3100])), ['kem', 5, 20, 300, 3100], 'năm lượt chậm trong 20: kém');
  eq(dg(lap(19, 300), 1), ['tam', 1, 20, 300, 300], 'một lượt RỚT hẳn: không còn là tốt (tạm được)');
  eq(dg(lap(18, 300), 2), ['kem', 2, 20, 300, 300], 'hai lượt rớt hẳn: kém');
  // ngưỡng "chậm" = hơn gấp đôi lượt bình thường VÀ hơn nửa giây (lượt bình thường = mốc 1/4 dưới của các lượt có trả lời — rớt gói nhiều thì số giữa cũng đã là lượt chậm)
  eq([dg(lap(19, 300).concat([600]))[1], dg(lap(19, 300).concat([610]))[1]], [0, 1], 'đường 0,3 s: lượt 0,6 s chưa tính là chậm, 0,61 s thì tính');
  eq([dg(lap(19, 40).concat([500]))[1], dg(lap(19, 40).concat([510]))[1]], [0, 1], 'đường nhanh 0,04 s: dưới nửa giây không tính là chậm');
  eq([dg(lap(19, 1000).concat([2000]))[1], dg(lap(19, 1000).concat([2100]))[1]], [0, 1], 'đường 1 s: chậm là hơn 2 s');
  eq(dg(lap(8, 300).concat(lap(12, 700)))[3], 300, 'hơn nửa số lượt bị chậm: "bình thường" vẫn là 0,3 s (không lấy số giữa)');
  eq(dg(lap(8, 300).concat(lap(12, 700))).slice(0, 2), ['kem', 12], '… và xếp loại kém, 12/20');
  // đường quá xa: không lượt nào chậm bất thường nhưng lượt nào cũng lâu
  eq([dg(lap(20, 1400))[0], dg(lap(20, 1500))[0], dg(lap(20, 2900))[0], dg(lap(20, 3000))[0]], ['tot', 'tam', 'tam', 'kem'], 'lượt bình thường từ 1,5 s: cao nhất là tạm được; từ 3 s: kém');
  eq(dg(lap(10, 1600).concat(lap(10, 4000))).slice(0, 2), ['kem', 10], '… đường xa mà còn rớt gói nhiều: vẫn là kém (mốc 1,5 s chỉ hạ "tốt" xuống "tạm được", không nâng "kém" lên)');
  // đo ngắn hơn (bị dừng sớm) vẫn xếp theo TỈ LỆ: tốt ≤ 5 %, tạm được ≤ 20 %
  eq([dg(lap(9, 300).concat([700]))[0], dg(lap(8, 300).concat([700, 700]))[0], dg(lap(7, 300).concat([700, 700, 700]))[0]], ['tam', 'tam', 'kem'], '10 lượt: 1 – 2 lượt chậm là tạm được, 3 lượt là kém');
  eq([dg([], 3, { dut: true })[0], dg([], 20)[0], dg(lap(2, 300), 3, { dut: true })[0]], ['dut', 'dut', 'dut'], 'không lượt nào trả lời, hoặc 3 lượt liền không trả lời (đã dừng sớm): đứt');
  eq(C.danhGiaMang(null).muc, 'dut', 'không có số đo: coi như đứt, không ném lỗi');
  // loạt đo thật trên máy anh 05/10 22:12 (20 lượt đầu, 1 lượt rớt): kém
  eq(dg([533, 314, 314, 5572, 308, 310, 309, 883, 1462, 292, 290, 289, 902, 301, 301, 302, 304, 1336, 1607], 1), ['kem', 7, 20, 301, 5572], 'loạt đo thật tối 05/10: 7/20 lượt chậm hoặc rớt → kém');
});

// Bản 1.29.1 (anh Thanh 07/10/2026: "các thư mục này phân loại lại phần phụ kiện và phần tủ là khác nhau mà sao lẫn khó sắp xếp quá")
T('Nhóm thư mục kho mẫu: Tủ / Phụ kiện / Khác (bản 1.29.1)', () => {
  const n = t => C.nhomThuMuc(t);
  eq(['Tủ trên', 'Tủ dưới', 'Tủ hở', 'Tủ liền dãy', 'Cánh', 'Tủ thành phẩm', 'Ngăn kéo', '衣柜', '抽屉', 'Kệ tivi', 'Giường'].map(n), Array(11).fill('tu'), 'tủ và thành phần của tủ (cánh, ngăn kéo) → Tủ');
  eq(['Bản lề', 'Bản lề Blum', 'Tay nắm', 'Tay nắm 2 lỗ - kiểu Âu', 'Ray trượt', 'Chân tủ', 'Đèn LED', 'Khoá', 'Phụ kiện', '五金', '铰链', '拉手', 'Suốt treo', 'Pát đỡ', 'Rổ kéo'].map(n), Array(15).fill('pk'), 'phụ kiện (bản lề, tay nắm, ray, chân, đèn, khoá, suốt, pát, rổ…) → Phụ kiện');
  eq(['Mẫu thử', '', null].map(n), ['khac', 'khac', 'khac'], 'không đoán được → Khác');
  eq(n('Tủ phụ kiện'), 'pk', 'có chữ "phụ kiện" thì là phụ kiện dù có chữ "tủ"');
  eq(n('TAY NẮM'), 'pk', 'không phân biệt hoa thường');
});

// Bản 1.29: tóm tắt các lần CHENFENG gọi máy chủ (để biết nó gọi bằng gì, có dùng lại kết nối không, mẫu tải lâu bao nhiêu) — số đo để làm "tự gửi lại khi rớt gói"
T('Tóm tắt lời gọi máy chủ của Chenfeng (bản 1.29)', () => {
  const g = (ten, kieu, gt, ms) => ({ ten, kieu, gt, ms });
  const r = C.tomTatGoi([g('CAD-moduleDetail', 'xmlhttprequest', 'h2', 300), g('CAD-moduleDetail', 'xmlhttprequest', 'h2', 4200), g('CAD-moduleDetail', 'xmlhttprequest', 'h2', 350),
    g('CAD-dirQuery', 'fetch', 'http/1.1', 280), g('CAD-materialDetail', 'xmlhttprequest', '', 900)]);
  eq(r.n, 5, 'đếm mọi lần gọi');
  eq(r.kieu, [['xmlhttprequest', 4], ['fetch', 1]], 'gọi bằng gì: xếp nhiều trước');
  eq(r.gt, [['h2', 3], ['http/1.1', 1], ['?', 1]], 'giao thức: trình duyệt không cho biết thì ghi "?"');
  eq([r.mau.n, r.mau.giua, r.mau.cham], [3, 350, 4200], 'mẫu (CAD-moduleDetail): số lần, lần giữa, lần lâu nhất');
  eq(r.cham.map(x => [x.ten, x.ms]), [['CAD-moduleDetail', 4200], ['CAD-materialDetail', 900], ['CAD-moduleDetail', 350]], 'ba lần lâu nhất');
  const o = C.tomTatGoi([]); eq([o.n, o.mau.n, o.kieu.length, o.cham.length], [0, 0, 0, 0], 'chưa có lần gọi nào: không ném lỗi');
  eq(C.tomTatGoi(null).n, 0, 'không có dữ liệu: không ném lỗi');
  eq(C.tomTatGoi([g('CAD-moduleDetail', 'fetch', 'h2', -5), g('x', 'fetch', 'h2', NaN)]).n, 0, 'số đo hỏng (âm, NaN) thì bỏ');
});

// Bản 1.28 (anh Thanh 06/10/2026: "phải có nút trên hình cho nó nhanh, với hình minh họa có 3d hoặc chọn trên ảnh thêm phào sửa phào luôn")
T('Hình đứng: phào và cột bấm được; hình 3D (bản 1.28)', () => {
  const C = require('../src/mncf-core.js');
  const s = C.normalize(Object.assign({}, C.DEFAULT_SPEC, { khau: { trai: { rong: 200, sau: 150 }, phai: { rong: 0, sau: 0 }, giua: [{ cach: 1000, rong: 140, sau: 140 }], ho: 15 } }));
  const M = C.build(s), svg = o => C.elevationSVG(M, o), dem = (v, re) => (v.match(re) || []).length;
  eq(M.errors, [], '(chuẩn bị) tủ 3000 có cột trái + cột giữa: không lỗi');
  eq([dem(svg({ tuong_tac: true }), /data-phao="trai"/g), dem(svg({ tuong_tac: true }), /data-phao="phai"/g), dem(svg({ tuong_tac: true }), /data-phao="tren"/g)], [2, 2, 3], 'mỗi tấm phào một vùng bấm, đúng mép (phào trên 3000 chia 3 tấm)');
  eq((svg({ tuong_tac: true }).match(/data-cot="[^"]*"/g) || []), ['data-cot="0:200"', 'data-cot="1000:1140"'], 'hình nhìn từ trên xuống: mỗi cột một vùng bấm mang khoảng ngang của cây cột');
  ok(!/data-phao|data-cot/.test(svg({})), 'hình không tương tác (in, xuất): không có vùng bấm');
  ok(/data-cot="1000:1140"[^>]*fill-opacity="\.25"[^>]*stroke=/.test(svg({ tuong_tac: true, chon: { loai: 'cot', x0: 1000, x1: 1140 } })), 'cột đang chọn được tô');
  ok(dem(svg({ tuong_tac: true, chon: { loai: 'phao', ben: 'phai' } }), /data-phao="phai"[^>]*stroke=/g) === 2, 'phào đang chọn được tô viền (cả 2 tấm của mép đó)');
  const M0 = C.build(Object.assign({}, s, { phao: Object.assign({}, s.phao, { trai: 0, tren: 0 }) })), v0 = C.elevationSVG(M0, { tuong_tac: true });
  ok(dem(v0, /\+ phào/g) === 2 && dem(v0, /data-phao="trai"/g) === 1 && dem(v0, /data-phao="tren"/g) === 1 && dem(v0, /data-phao="phai"/g) === 2, 'mép chưa có phào: một dải "+ phào" nét đứt ngoài mép đó để bấm thêm');
  // HÌNH 3D
  const h = C.hinh3D(M, { tuong_tac: true }), soKhoi = M.parts.length + M.mat_ngan_keo.length + M.templates.filter(t => t.loai === 'SUOT').length + M.info.khau.length;
  ok(/^<svg[^>]*data-3d="1"/.test(h) && !/NaN|Infinity/.test(h), 'hình 3D: một thẻ svg, không có số hỏng');
  const nKhoi = dem(h, /<g[ >]/g);
  ok(nKhoi > soKhoi, 'mỗi tấm / mặt ngăn kéo / suốt treo / cột ít nhất một khối; tấm khoét quanh cột chia thành nhiều khối', [nKhoi, soKhoi]);
  ok(dem(h, /<polygon/g) >= nKhoi * 2 && dem(h, /<polygon/g) <= nKhoi * 3, 'mỗi khối vẽ 2 – 3 mặt hướng về người nhìn');
  eq([dem(h, /data-phao="trai"/g), dem(h, /data-cot=/g)], [2, 2], 'hình 3D: phào và cột bấm được như hình đứng');
  ok(!/data-phao|data-cot/.test(C.hinh3D(M, {})), 'không tương tác: không vùng bấm');
  ok(dem(C.hinh3D(M, { canh: false }), /<g[ >]/g) === nKhoi - M.parts.filter(p => p.loai === 'CANH').length, 'tắt "Hiện cánh": bỏ các khối cánh');
  // tấm khoét quanh cột: phần nằm trong dải khoét chỉ sâu tới chỗ khoét (không vẽ xuyên qua cột) — một đáy 1000 × 500, khoét 200 ngang × từ y 300 ra sau → 2 khối
  const Bk = { parts: [{ loai: 'DAY', x0: 0, x1: 1000, y0: 0, y1: 500, z0: 0, z1: 18, khau: [{ x0: 0, x1: 200, y0: 300, y1: 500 }] }], mat_ngan_keo: [], templates: [], info: {}, spec: Object.assign({}, s, { rong: 1000, cao: 18 }) };
  const hk = C.hinh3D(Bk, { az: 0, el: 89 }), hk0 = C.hinh3D(Object.assign({}, Bk, { parts: [Object.assign({}, Bk.parts[0], { khau: [] })] }), { az: 0, el: 89 });
  eq([dem(hk, /<g[ >]/g), dem(hk0, /<g[ >]/g)], [2, 1], 'đáy có một chỗ khoét: 2 khối (phần trước chỗ khoét sâu 300 + phần còn lại sâu 500); không khoét: 1 khối');
  // thứ tự vẽ không vòng lặp: các khối hậu (xa) luôn vẽ trước mọi khối cánh (gần) ở các góc nhìn hay dùng
  // thứ tự vẽ đúng — kiểm bằng cách BẮN TIA: ở chỗ hai khối chồng nhau trên hình, tia từ mắt người nhìn gặp khối nào trước thì khối đó phải được vẽ SAU
  const vaoHop = (b, o, v) => { let t0 = -Infinity, t1 = Infinity; for (let k = 0; k < 3; k++) { if (Math.abs(v[k]) < 1e-12) { if (o[k] < b[k] || o[k] > b[k + 3]) return null; continue; } let a = (b[k] - o[k]) / v[k], c = (b[k + 3] - o[k]) / v[k]; if (a > c) [a, c] = [c, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, c); } return t1 > t0 + 1e-6 ? t0 : null; };
  const saiThuTu = (Mx, az, el) => {
    const { hop, xep, d, r, u } = C.hinh3D(Mx, { az, el, du_lieu: true }), pos = []; xep.forEach((i, k) => { pos[i] = k; });
    const v = d.map(x => -x); let sai = 0;
    for (let i = 0; i < hop.length; i++) for (let j = i + 1; j < hop.length; j++) {
      const A = hop[i], B = hop[j], x0 = Math.max(A.k[0], B.k[0]), x1 = Math.min(A.k[2], B.k[2]), y0 = Math.max(A.k[1], B.k[1]), y1 = Math.min(A.k[3], B.k[3]);
      if (x1 <= x0 || y1 <= y0) continue;
      let gA = 0, gB = 0;
      for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) {
        const sx = x0 + (x1 - x0) * (a + 0.5) / 6, sy = y0 + (y1 - y0) * (b + 0.5) / 6, o = [0, 1, 2].map(k => sx * r[k] - sy * u[k] + 1e5 * d[k]);
        const ta = vaoHop(A.b, o, v), tb = vaoHop(B.b, o, v); if (ta === null || tb === null) continue;
        if (ta < tb - 0.6) gA++; else if (tb < ta - 0.6) gB++;
      }
      if ((gA && !gB && pos[i] < pos[j]) || (gB && !gA && pos[j] < pos[i])) sai++;
    }
    return sai;
  };
  const M2 = C.build(C.normalize(C.DEFAULT_SPEC));
  for (const [ten, Mx] of [['tủ mặc định', M2], ['tủ khấu cột', M]]) for (const [az, el] of [[30, 22], [-30, 22], [60, 10], [-85, 0], [85, 75], [0, 40]])
    eq(saiThuTu(Mx, az, el), 0, `${ten}, góc ${az}° / ${el}°: khối gần người nhìn luôn vẽ sau khối nó che (bắn tia)`);
  // thứ tự vẽ: khối gần người nhìn vẽ SAU khối xa mà hình chồng lên nhau — hậu (sau lưng) trước, cánh (trước mặt) sau
  const iHau = h.indexOf('fill="#eef3ec"'), iCanh = h.indexOf('fill-opacity="0.45"');      // mặt trước của hậu (màu hậu nguyên) · khối cánh đầu tiên
  ok(iHau >= 0 && iCanh > iHau, 'hậu (sau lưng) vẽ trước, cánh (trước mặt) vẽ sau', [iHau, iCanh]);
  // xoay sang bên phải: thấy mặt hồi PHẢI (x1), không thấy mặt hồi trái (x0); xoay sang trái thì ngược lại
  const B = { parts: [{ loai: 'HOI', x0: 0, x1: 100, y0: 0, y1: 100, z0: 0, z1: 100 }], mat_ngan_keo: [], templates: [], info: {}, spec: Object.assign({}, s, { rong: 100, cao: 100 }) };
  const hP = C.hinh3D(B, { az: 40, el: 20 }), hT = C.hinh3D(B, { az: -40, el: 20 }), hTr = C.hinh3D(B, { az: 0, el: 0 });
  eq([dem(hP, /<polygon/g), dem(hT, /<polygon/g), dem(hTr, /<polygon/g)], [3, 3, 1], 'một khối: nhìn chéo thấy 3 mặt, nhìn thẳng ngang thấy 1 mặt');
  ok(hP !== hT, 'xoay phải / trái ra hai hình khác nhau');
  ok(!/NaN/.test(C.hinh3D(M, { az: 'x', el: null })) && !/NaN/.test(C.hinh3D(M, { az: 400, el: -50 })), 'góc lạ / ngoài khoảng: kẹp lại, không ra số hỏng');
});


// Bản 1.29.2 (anh Thanh 08/10/2026: "các phần hậu chỉ có 6,5 mm thôi, không có 6 hay 5, chỉnh lại toàn bộ"): mặc định dày hậu của xưởng = 6,5 cho cả hậu phủ lẫn soi rãnh.
// Cả bộ thử ở trên ghim DEFAULT_SPEC.hau.t = 6 (số đo cũ) nên khối này nạp một bản lõi MỚI, không đụng bản đã ghim.
T('Hậu 6,5 — ván mỏng của xưởng (bản 1.29.2)', () => {
  const k = require.resolve('../src/mncf-core.js'), cu = require.cache[k]; delete require.cache[k]; const C = require(k); require.cache[k] = cu;
  eq(C.DEFAULT_SPEC.hau.t, 6.5, 'mặc định 6,5');
  eq([C.normalize({}).hau.t, C.normalize({ hau: { kieu: 'phu' } }).hau.t, C.normalize({ hau: { kieu: 'mong' } }).hau.t, C.normalize({ hau: { kieu: 'day' } }).hau.t, C.normalize({ hau: { kieu: 'phu', t: 9 } }).hau.t], [6.5, 6.5, 6.5, 17.5, 9],
    'không gõ dày: phủ 6,5, soi rãnh 6,5 (không còn 5), dày lọt lòng = ván thùng; gõ tay thì giữ');
  const M = C.build({}), hoi = M.parts.find(p => p.loai === 'HOI'), hau = M.parts.filter(p => p.loai === 'HAU');
  ok(hau.length && hau.every(h => near(h.y1 - h.y0, 6.5)) && near(hoi.y1, M.spec.sau_thung - 6.5), 'tủ mặc định: hậu dày 6,5, hồi sâu = sâu thùng − 6,5', [hoi.y1, hau.map(h => h.y1 - h.y0)]);
  const be = C.keHoachGoc(Object.assign({}, C.DEFAULT_SPEC, { thung: { rong_max: 2000, noc_day: 'lot' } })).buoc.find(b => b.lenh === 'BE');      // (bản 1.31) lệnh gốc chỉ vẽ kết cấu hồi phủ nóc đáy
  eq([be.day, be.lui], [6.5, -6.5], 'lệnh gốc BEHINDBOARD: hậu 6,5 phủ sau (mặt sau cách mép sau thùng −6,5)');
  // nâng cấp thông số đang lưu: đúng bằng mặc định cũ (phủ 6 / soi rãnh 5) thì đổi sang 6,5 và báo; số gõ tay, hậu dày lọt lòng, hoặc đã ở bản ≥ 1.29.2 thì giữ
  const nc = (h, ban) => { const r = C.nangCap({ rong: 1000, khoang: [{}], chan: { cao: 100 }, hau: h }, ban); return [r.spec.hau.t, r.doi.filter(d => /Dày hậu/.test(d)).length]; };
  eq([nc({ kieu: 'phu', t: 6 }, '1.29.1'), nc({ kieu: 'mong', t: 5 }, '1.28.0'), nc({ kieu: 'phu', t: 9 }, '1.29.1'), nc({ kieu: 'day', t: 17.5 }, '1.29.1'), nc({ kieu: 'phu', t: 6 }, '1.29.2')],
    [[6.5, 1], [6.5, 1], [9, 0], [17.5, 0], [6, 0]], 'nâng cấp: phủ 6 → 6,5 (báo), soi rãnh 5 → 6,5 (báo); 9 gõ tay giữ; hậu dày lọt lòng giữ; đã ở 1.29.2 thì không đổi');
  ok(/6,5/.test(C.summary(C.build({})).join ? C.summary(C.build({})).join(' ') : String(C.summary(C.build({})))), 'tóm tắt tủ ghi hậu 6,5');
});

T('Bản lề Kolity K53 / Imundex thép — số theo tiêu chuẩn, vị trí, tránh nẹp hộc kéo (bản 1.30)', () => {
  // số bản lề mỗi cánh: cao ≤ 900 → 2, ≤ 1600 → 3, ≤ 2000 → 4, còn lại 5; cánh rộng hơn 600 thêm 1 (mốc chung của Blum / Hettich / Häfele và các xưởng VN)
  const so = (h, w) => C.banLeCanh(h, w).so;
  eq([so(500, 400), so(900, 400), so(901, 400), so(1600, 400), so(1601, 400), so(2000, 400), so(2001, 400), so(2600, 400)], [2, 2, 3, 3, 4, 4, 5, 5], 'số bản lề theo chiều cao (mốc 900 / 1600 / 2000)');
  eq([so(1500, 600), so(1500, 601), so(2400, 650)], [3, 4, 6], 'cánh rộng hơn 600: thêm 1 bản lề');
  eq(C.banLeCanh(2000, 450), { so: 4, z: [100, 700, 1300, 1900], ket: false, vung: false }, 'đầu / cuối cách đầu cánh 100, giữa chia đều');
  eq(C.banLeCanh(300, 400).z, [75, 225], 'cánh thấp: đầu cánh cách cao / 4 (không dồn hai chén vào nhau)');
  eq(C.banLeCanh(1500, 450, { cach_dau: 80 }).z, [80, 750, 1420], 'cách đầu cánh theo Chuẩn xưởng');
  // nẹp hộc kéo âm ở chân cánh (0 … 520): bản lề dưới lên ngay trên vùng (+ nửa chén + 5), các bản lề giữa chia đều lại tới bản lề trên cùng
  eq(C.banLeCanh(2200, 450, { tranh: [[0, 520]] }), { so: 5, z: [542.5, 931.875, 1321.25, 1710.625, 2100], ket: false, vung: true }, 'tránh vùng ở chân: dời lên, chia đều lại');
  eq(C.banLeCanh(2000, 450, { tranh: [[900, 1300]] }).z, [100, 711.25, 1322.5, 1900], 'vùng giữa cánh: dời ra phía gần hơn (lên), bản lề không bị dời chia đều lại');
  eq(C.banLeCanh(2000, 450, { tranh: [[0, 1000]] }).z, [1022.5, 1315, 1607.5, 1900], 'hai bản lề cùng rơi vào vùng: không chồng lên nhau');
  ok(C.banLeCanh(600, 400, { tranh: [[0, 600]] }).ket === true, 'không còn chỗ ngoài vùng: báo (ket)');
  eq(C.banLeCanh(2200, 450, { tranh: [[512.5, 545], [0, 520]] }).z[0], 567.5, 'hai vùng sát nhau (nẹp hộc kéo + đợt nóc hộc kéo) gộp làm một: bản lề lên trên cả hai');
  // loại bản lề: số chén theo loại; "Tự gõ số" giữ số người dùng
  const LB = Object.fromEntries(C.LOAI_BAN_LE.map(l => [l.ma, l]));
  ok(LB.k53 && LB.imundex && LB.tu_chon && LB.k53.d === 35 && LB.k53.sau === 12 && LB.imundex.sau === 11.5 && LB.imundex.day[0] === 14 && LB.imundex.day[1] === 22 && LB.k53.day[0] === 15 && LB.k53.day[1] === 25, 'bảng loại: K53 Ø35 sâu 12 cánh 15–25; Imundex thép Ø35 sâu 11,5 cánh 14–22');
  eq(C0.DEFAULT_SPEC.canh.loai_ban_le, 'k53', 'mặc định: Kolity K53');
  eq(C.normalize({}).canh.chen, { d: 35, sau: 12, tam_mep: 21.5, cach_dau: 100 }, 'K53: chén Ø35 sâu 12, tâm chén cách mép 21,5 (K 4 + Ø/2)');
  eq(C.normalize({ canh: { loai_ban_le: 'imundex', chen: { sau: 13, tam_mep: 30 } } }).canh.chen, { d: 35, sau: 11.5, tam_mep: 21.5, cach_dau: 100 }, 'chọn Imundex: số chén theo loại, số gõ tay bị thay');
  eq(C.normalize({ canh: { loai_ban_le: 'tu_chon', chen: { sau: 13, tam_mep: 23, cach_dau: 90 } } }).canh.chen, { d: 35, sau: 13, tam_mep: 23, cach_dau: 90 }, 'Tự gõ số: giữ số người dùng');
  eq(C.normalize({ canh: { loai_ban_le: 'hang_la' } }).canh.loai_ban_le, 'k53', 'mã loại lạ → mặc định');
  ok(C.normalize({ khoang: [{ canh: 1, ban_le: 'phai' }] }).khoang[0].ban_le === 'phai', 'khoang[i].ban_le (bên trái / phải) không lẫn với loại bản lề');
  // dựng tủ: mọi cánh mang ban_le { so, z, ben, loai }; cánh mở phải = bản lề bên phải
  const M = C.build({ rong: 1000, cao: 2200, than: { cao_duoi: 0 }, khoang: [{ canh: 2, dot: [520], o: [{ tu: 0, kieu: 'nk_am', so: 2 }] }, { canh: 1, ban_le: 'phai' }] });
  eq(M.errors, [], 'không lỗi');
  const cs = P(M, 'CANH');
  ok(cs.length === 3 && cs.every(p => p.ban_le && p.ban_le.so === C.banLeCanh(p.z1 - p.z0, p.x1 - p.x0).so && p.ban_le.loai === 'k53'), 'mọi cánh có số bản lề theo cao + rộng của chính nó', cs.map(p => p.ban_le));
  eq(cs.map(p => p.ban_le.ben), ['trai', 'phai', 'phai'], 'khoang 2 cánh: trái / phải; khoang 1 cánh bản lề phải');
  eq(M.info.canh.ban_le, cs.reduce((n, p) => n + p.ban_le.so, 0), 'tổng bản lề ở info.canh');
  // (bản 1.30.1 — anh Thanh: "vùng hộc thụt vào 5 cm sẽ không bị ảnh hưởng gì cả") khoang có hộc kéo âm: bản lề KHÔNG dời vì hộc kéo, chỉ tránh đợt
  for (const p of cs.filter(p => p.khoang === 0)) ok(p.ban_le.z[0] === 100, 'khoang có hộc kéo âm: bản lề dưới vẫn cách đầu cánh 100', p.ban_le.z);
  ok(!M.notes.some(n => /bản lề/.test(n)) && M.info.tranh_bl === undefined, 'không còn ghi chú dời bản lề vì hộc kéo', M.notes);
  ok(cs.every(p => !p.holes.length), 'chưa bật khoét chén: cánh không có lỗ');
  // đợt cố định nằm ngay chỗ bản lề: đế bản lề trên hồi / vách cấn đợt → bản lề dời ra, tâm cách mặt đợt ít nhất 25
  { const S0 = { rong: 900, cao: 2200, than: { cao_duoi: 0 }, khoang: [{ canh: 2 }] };
    const c0 = P(C.build(S0), 'CANH')[0], zBL = c0.z0 + c0.ban_le.z[1];
    const Md = C.build(Object.assign({}, S0, { khoang: [{ canh: 2, dot: [Math.round(zBL - 5)] }] })), d = P(Md, 'DOT')[0];
    eq(Md.warnings, [], 'không cảnh báo');
    for (const c of P(Md, 'CANH')) ok(c.ban_le.so === c0.ban_le.so && c.ban_le.z.every(v => c.z0 + v <= d.z0 - 25 + 0.01 || c.z0 + v >= d.z1 + 25 - 0.01), 'bản lề tránh đợt cố định (tâm cách mặt đợt ≥ 25)', { bl: c.ban_le.z.map(v => c.z0 + v), dot: [d.z0, d.z1] }); }
  // tủ mẫu (nhiều đợt) vẫn xếp đủ bản lề, không cảnh báo
  { const Mm = C0.build({}); eq(Mm.warnings, [], 'tủ mẫu: không cảnh báo bản lề');
    for (const c of P(Mm, 'CANH')) for (const d of P(Mm, 'DOT').filter(d => d.khoang === c.khoang)) ok(c.ban_le.z.every(v => c.z0 + v <= d.z0 - 25 + 0.01 || c.z0 + v >= d.z1 + 25 - 0.01 || d.z1 < c.z0 || d.z0 > c.z1), 'tủ mẫu: bản lề không cấn đợt', [c.khoang, c.ban_le.z.map(v => c.z0 + v), d.z0]); }
  // khoét chén: lỗ tròn Ø35 sâu theo loại, tâm cách mép phía bản lề
  const Mk = C.build({ rong: 1000, cao: 2200, than: { cao_duoi: 0 }, canh: { chen_ban_le: true, loai_ban_le: 'imundex' }, khoang: [{ canh: 1 }, { canh: 1, ban_le: 'phai' }] });
  const [c1, c2] = P(Mk, 'CANH');
  ok(c1.holes.length === c1.ban_le.so && c1.holes.every(h => h.kieu === 'tron' && h.r === 17.5 && h.sau === 11.5 && h.u === 21.5) && JSON.stringify(c1.holes.map(h => h.v)) === JSON.stringify(c1.ban_le.z), 'cánh mở trái: chén cách mép trái 21,5, sâu 11,5 (Imundex), đúng vị trí bản lề', c1.holes);
  ok(c2.holes.every(h => near(h.u, (c2.x1 - c2.x0) - 21.5)), 'cánh mở phải: chén cách mép phải', c2.holes.map(h => h.u));
  // cánh dày ngoài khoảng của loại: cảnh báo
  ok(C.build({ van: { t_canh: 25 }, canh: { loai_ban_le: 'imundex' } }).warnings.some(w => /ngoài khoảng dày cánh của bản lề Imundex/.test(w)), 'cánh 25 với Imundex (14–22): cảnh báo');
  ok(!C.build({ van: { t_canh: 25 } }).warnings.some(w => /khoảng dày cánh/.test(w)), 'cánh 25 với K53 (15–25): không cảnh báo');
  // bảng kê + tóm tắt + hình
  const cl = C.cutList(M);
  ok(cl.rows.filter(r => r.nhom === 'Cánh').every(r => /^\d bản lề \/ cánh$/.test(r.ghi_chu)), 'bảng kê: mỗi dòng cánh ghi số bản lề / cánh', cl.rows.filter(r => r.nhom === 'Cánh').map(r => r.ghi_chu));
  const pk = cl.phu_kien.find(x => /^Bản lề Kolity K53/.test(x.ten));
  ok(pk && pk.sl === M.info.canh.ban_le && /sâu 12/.test(pk.ghi_chu) && /3 cánh/.test(pk.ghi_chu), 'phụ kiện: tổng bản lề theo loại', cl.phu_kien);
  ok(/Bản lề Kolity K53/.test(C.cutListCSV(M)), 'CSV có dòng bản lề');
  ok(C.summary(M).some(l => new RegExp(`^Cánh: 3 tấm.*, ${M.info.canh.ban_le} bản lề\\.$`).test(l)), 'tóm tắt: tổng bản lề');
  ok((C.elevationSVG(M).match(/data-ban-le="1"/g) || []).length === M.info.canh.ban_le, 'hình đứng: một vòng tròn cho mỗi bản lề');
  ok(!/data-ban-le/.test(C.elevationSVG(M, { canh: false })), 'tắt hiện cánh: không vẽ bản lề');
  ok(C.cutList(Mk).rows.filter(r => r.nhom === 'Cánh').every(r => /bản lề \/ cánh, khoét chén/.test(r.ghi_chu)), 'bật khoét chén: ghi chú nói cả số bản lề lẫn khoét chén');
  // nâng cấp dữ liệu cũ (< 1.30): số chén tự gõ thì giữ (loại "Tự gõ số"); số mặc định cũ thì theo K53
  const n1 = C.nangCap({ canh: { chen_ban_le: true, chen: { d: 35, sau: 13, tam_mep: 24, cach_dau: 100 } } }, '1.29.2');
  ok(n1.spec.canh.loai_ban_le === 'tu_chon' && C.normalize(n1.spec).canh.chen.sau === 13 && n1.doi.some(d => /Tự gõ số/.test(d)), 'bản cũ có số chén tự gõ: giữ', n1);
  const n2 = C.nangCap({ canh: { chen_ban_le: true, chen: { d: 35, sau: 12.5, tam_mep: 22.5, cach_dau: 100 } } }, '1.29.2');
  ok(n2.spec.canh.loai_ban_le === undefined && C.normalize(n2.spec).canh.chen.tam_mep === 21.5 && n2.doi.some(d => /Kolity K53/.test(d)), 'bản cũ số mặc định + đang khoét chén: theo K53, báo', n2);
  const n3 = C.nangCap({ canh: { chen_ban_le: false, chen: { d: 35, sau: 12.5, tam_mep: 22.5, cach_dau: 100 } } }, '1.29.2');
  ok(!n3.doi.length, 'bản cũ không khoét chén, số mặc định: không báo gì', n3.doi);
  ok(!C.nangCap({ canh: { loai_ban_le: 'imundex', chen: { sau: 11.5 } } }, '1.30.0').doi.length, 'bản 1.30: không đụng');
});

T('Thêm vách cho vừa khổ ván (bản 1.30.1)', () => {
  // anh Thanh 08/10/2026: "rất hay báo lỗi bị vượt khổ ván rất mệt" — thường gặp: chọn tủ có sẵn rồi kéo rộng ra
  const TA4 = C0.MAU_TU.find(m => m.ma === 'TA4-2000').khoang();
  const r = C0.vuaKhoVan({ rong: 2600, cao: 2400, khoang: TA4 });
  ok(r.truoc === 2 && r.con === 0 && r.spec.khoang.length === 3 && C0.build(r.spec).errors.length === 0, 'tủ 4 cánh 2000 kéo rộng 2600: 2 hậu vượt khổ → thêm 1 vách, hết lỗi', r);
  ok(r.spec.khoang.every(k => k.rong === 'auto' && k.canh === 2), 'mỗi khoang giữ 2 cánh (không ra cánh đơn rộng quá 600)');
  eq(r.spec.khoang[0].o, r.spec.khoang[1].o, 'khoang tách đôi: hai nửa giữ nội dung ô của khoang cũ');
  ok(/^Đã chia lại 2 → 3 khoang cho vừa khổ ván 2440 × 1220/.test(r.doi[0]), 'dòng báo', r.doi);
  const r1 = C0.vuaKhoVan({ rong: 1400, cao: 2400, khoang: [{ rong: 'auto', canh: 1, ban_le: 'phai', dot: [1000] }] });
  eq(r1.spec.khoang.map(k => [k.canh, k.ban_le, k.dot]), [[1, 'trai', [1000]], [1, 'phai', [1000]]], 'khoang 1 cánh tách đôi: bản lề quay ra hai bên, đợt chép sang');
  const r2 = C0.vuaKhoVan({ rong: 2600, cao: 800, khoang: [{ rong: 'auto', canh: 2, dot: [], o: [] }] });
  ok(r2.truoc > 0 && r2.con === 0 && C0.build(r2.spec).errors.length === 0, '1 khoang 2600 (đáy, nóc, chân, phào dài hơn khổ): chia tới khi hết', r2);
  const r3 = C0.vuaKhoVan({ rong: 2600, cao: 2400, khoang: [{ rong: 1300, canh: 2, dot: [], o: [] }, { rong: 'auto', canh: 2, dot: [], o: [] }] });
  ok(r3.con === 1 && !r3.doi.length && r3.spec.khoang.length === 2, 'khoang gõ số rộng cố định: không đụng, báo còn lỗi', r3);
  const r4 = C0.vuaKhoVan({});
  ok(r4.truoc === 0 && !r4.doi.length && JSON.stringify(r4.spec) === JSON.stringify(C0.normalize({})), 'tủ không vượt khổ: không đổi gì');
  const r5 = C0.vuaKhoVan({ rong: 2000, cao: 3000, than: { cao_duoi: 0 } });
  ok(!r5.doi.length, 'vượt khổ theo chiều cao (thân 3000): không thêm vách bừa', r5.doi);
});

// Bản 1.31 (anh Thanh 08/10/2026: "chuyển sang kết cấu nóc, đáy phủ hồi nhé, kết cấu này không chuẩn lắp đặt, rất yếu"): cả bộ thử ở trên ghim 'lot' nên khối này nạp một bản lõi MỚI.
T('Nóc, đáy phủ hồi + khung đế (bản 1.31)', () => {
  const k = require.resolve('../src/mncf-core.js'), cu = require.cache[k]; delete require.cache[k]; const C = require(k); require.cache[k] = cu;
  eq(C.DEFAULT_SPEC.thung.noc_day, 'lot', 'mặc định VẪN kết cấu cũ (vẽ bằng lệnh gốc) cho tới khi đo xong lệnh nóc / đáy bọc hồi của Chenfeng (anh Thanh: "phải vẽ đúng theo của Chenfeng")');
  C.DEFAULT_SPEC.thung.noc_day = 'phu_hoi';      // khối này thử kết cấu phủ hồi (bản lõi riêng, không đụng bản đã ghim)
  eq([C.normalize({ thung: { noc_day: 'lot' } }).thung.noc_day, C.normalize({ thung: { noc_day: 'la' } }).thung.noc_day], ['lot', 'phu_hoi'], 'chọn cách cũ được; giá trị lạ → mặc định');
  const chongNhau = M => { const o = []; for (let i = 0; i < M.parts.length; i++) for (let j = i + 1; j < M.parts.length; j++) if (C.overlap(M.parts[i], M.parts[j]) > 0) o.push(M.parts[i].ten + '×' + M.parts[j].ten); return o; };
  const M = C.build({}), T0 = M.info.thung, t = M.spec.van.t;
  eq([M.errors, M.warnings, chongNhau(M), C.kiemLienKet(M.parts)], [[], [], [], []], 'tủ mặc định 3000 × 2800: không lỗi, không cảnh báo, không tấm đè nhau, không tấm lơ lửng / thiếu chỗ tì');
  for (const th of M.info.than) {
    const day = P(M, 'DAY').filter(p => p.than === th.ma), noc = P(M, 'NOC').filter(p => p.than === th.ma), dung = M.parts.filter(p => (p.loai === 'HOI' || p.loai === 'VACH') && p.than === th.ma && !p.khau_cot);
    ok(day.length === T0.length && noc.length === T0.length, `thân ${th.ma}: mỗi thùng MỘT đáy + MỘT nóc (không cắt tại vách)`, [day.length, noc.length]);
    T0.forEach((q, i) => ok(near(day[i].x0, q.x0) && near(day[i].x1, q.x1) && near(noc[i].x0, q.x0) && near(noc[i].x1, q.x1) && day[i].khoang === q.khoang[0] && day[i].den_khoang === q.khoang[1], `thân ${th.ma}, thùng ${i + 1}: nóc / đáy chạy từ mặt ngoài hồi trái tới mặt ngoài hồi phải`, [day[i].x0, day[i].x1, q]));
    ok(dung.every(p => near(p.z0, day[0].z1) && near(p.z1, noc[0].z0)), `thân ${th.ma}: hồi + vách kẹp giữa đáy và nóc`, dung.map(p => [p.ten, p.z0, p.z1]));
  }
  // khung đế: thân có chân → mỗi thùng đế trước + đế sau + 2 đế hông, cao bằng chân, đáy nằm trên đế; chân trước (tấm mặt) vẫn ở mặt phẳng cánh
  const de = P(M, 'DE'), ch = M.spec.chan.cao;
  ok(de.length === 4 * T0.length && de.every(p => p.z0 === 0 && near(p.z1, ch) && (p.ten === 'Đế hông' ? near(p.x1 - p.x0, t) : near(p.y1 - p.y0, t))), 'mỗi thùng 4 tấm đế (trước, sau, 2 hông) cao bằng chân', de.map(p => [p.ten, p.x0, p.x1, p.y0, p.y1, p.z1]));
  ok(P(M, 'DAY').filter(p => p.than === 'D').every(p => near(p.z0, ch)) && P(M, 'CHAN').length > 0 && P(M, 'CHAN').every(p => p.y1 === 0), 'đáy thân dưới nằm trên khung đế; chân trước vẫn là tấm mặt');
  eq(C.cutList(M).rows.filter(r => /^Đế/.test(r.ten)).map(r => r.nhom), ['Thùng', 'Thùng', 'Thùng', 'Thùng', 'Thùng'], 'bảng kê: đế là ván thùng');
  ok(C.nhomMau(de.map(p => ({ ten: p.ten, hop: [p.x0, p.x1, p.y0, p.y1, p.z0, p.z1] }))).every(n => n === 'thung'), 'đổ màu: tấm đế cùng màu thùng (tên "Đế …" không lẫn với "Chân trước" là tấm mặt)');
  // không chân: không đế, đáy chạm sàn; 1 thân; thân trên đặt lên nóc thân dưới
  const M0 = C.build({ chan: { cao: 0 } });
  ok(!P(M0, 'DE').length && P(M0, 'DAY').filter(p => p.than === 'D').every(p => p.z0 === 0) && !M0.errors.length && !chongNhau(M0).length, 'tủ không chân: không có đế, đáy chạm sàn');
  const nocD = P(M, 'NOC').find(p => p.than === 'D'), dayT = P(M, 'DAY').find(p => p.than === 'T');
  ok(near(dayT.z0, nocD.z1), 'thân trên: đáy đặt lên nóc thân dưới (hai tấm liền chồng lên nhau)');
  // khấu cột: nóc / đáy liền vẫn khoét quanh cột, khung đế lùi ra trước mặt cột
  for (const sp of [{ khau: { trai: { rong: 300, sau: 200 } } }, { khau: { phai: { rong: 300, sau: 200 }, giua: [{ cach: 1200, rong: 250, sau: 150 }] } }]) {
    const Mk = C.build(sp), K = Mk.info.khau;
    ok(!Mk.errors.length && !chongNhau(Mk).length && !C.kiemLienKet(Mk.parts).length, 'khấu cột ' + JSON.stringify(sp.khau) + ': không lỗi, không đè nhau', [Mk.errors, chongNhau(Mk)]);
    for (const kk of K) {
      const xa = kk.xa === null ? -Infinity : kk.xa, xb = kk.xb === null ? Infinity : kk.xb;
      ok(P(Mk, 'DE').filter(p => p.x1 > xa + 1 && p.x0 < xb - 1).every(p => p.y1 <= kk.sau_thung + 0.011), 'đế trong vùng cột nằm trước mặt cột', [kk, P(Mk, 'DE').filter(p => p.x1 > xa && p.x0 < xb).map(p => [p.ten, p.x0, p.x1, p.y1])]);
      ok(P(Mk, 'NOC').some(p => (p.khau || []).length), 'nóc liền được khoét quanh cột');
    }
  }
  // hậu soi rãnh: rãnh trên đáy / nóc liền thùng đặt đúng đoạn của từng khoang
  const Mm = C.build({ hau: { kieu: 'mong' } }), d0 = P(Mm, 'DAY')[0];
  // (1.31.1) rãnh phủ cả 2 góc hậu ăn vào (bx − 6 … bx + c + 6); tấm nằm trong Chenfeng có trục v tính từ mép PHẢI (v = x1 − x, đã đo)
  const gS = Mm.spec.hau.ranh_sau;
  ok(!Mm.errors.length && d0.holes.length === Mm.info.thung[0].khoang[1] - Mm.info.thung[0].khoang[0] + 1 && d0.holes.every((h, i) => near(h.v, d0.x1 - (Mm.info.x_khoang[i] + Mm.info.khoang[i] + gS)) && near(h.h, Mm.info.khoang[i] + 2 * gS)), 'hậu soi rãnh: mỗi khoang một đoạn rãnh trên đáy liền, phủ cả góc hậu, v tính từ mép phải', d0.holes);
  ok(P(Mm, 'HAU').every(hh => P(Mm, 'DAY').filter(d => d.than === hh.than && hh.x1 > d.x0 && hh.x0 < d.x1).every(d => d.holes.some(r => near(d.x1 - r.v - r.h, Math.max(d.x0, hh.x0) - 0) || (d.x1 - r.v - r.h <= hh.x0 + 0.011 && d.x1 - r.v >= hh.x1 - 0.011)))), 'mỗi tấm hậu nằm gọn trong một đoạn rãnh của đáy (cả 2 góc)');
  ok(Mm.parts.filter(p => p.loai === 'HOI' || p.loai === 'VACH').every(p => p.holes.every(r => r.v >= -0.011 && r.v + r.h <= p.z1 - p.z0 + 0.011)), 'rãnh trên hồi / vách nằm gọn trong tấm (phủ hồi: hồi đứng trên đáy)', Mm.parts.filter(p => p.loai === 'HOI').map(p => p.holes));
  // lệnh gốc chưa vẽ được kiểu này → bảng vẽ bằng cách nhập tấm và báo; cách cũ vẫn có kế hoạch lệnh gốc
  ok(C.keHoachGoc({}).loi.some(l => /phủ hồi/.test(l)) && !C.keHoachGoc({ thung: { noc_day: 'lot' } }).loi.length, 'kế hoạch lệnh gốc: phủ hồi → chưa hỗ trợ (rơi về nhập tấm); cách cũ vẫn chạy');
  ok(Object.values(C.heSo(C.normalize({})).bien).every(Boolean), 'module co giãn được theo Rộng / Sâu / Cao');
  // kiểm khổ: hồi giờ ngắn hơn thân 2 tấm (và chân) — thân 2450 có chân 100 vẫn cắt được
  ok(!C.build({ cao: 2500, than: { cao_duoi: 0 }, phao: { tren: 50 } }).errors.some(e => /hồi dài/.test(e)), 'thân 2450 (chân 100): hồi 2315 < 2440 → không báo vượt khổ');
  // nâng cấp: thông số bản cũ → kết cấu mới, báo một dòng; đã chọn rồi thì thôi
  const n1 = C.nangCap({ rong: 1000, khoang: [{}] }, '1.30.1'), n2 = C.nangCap({ rong: 1000, khoang: [{}], thung: { noc_day: 'lot' } }, '1.30.1'), n3 = C.nangCap({ rong: 1000, khoang: [{}] }, '1.31.0');
  ok(n1.doi.some(d => /nóc, đáy phủ hồi/.test(d)) && !n2.doi.some(d => /phủ hồi/.test(d)) && !n3.doi.length && C.normalize(n1.spec).thung.noc_day === 'phu_hoi' && C.normalize(n2.spec).thung.noc_day === 'lot', 'nâng cấp: bản cũ → phủ hồi + báo; đã chọn cách cũ thì giữ', [n1.doi, n2.doi]);
});

// Bản 1.31 (anh Thanh 08/10/2026, ảnh mẫu: "ngăn kéo kết cấu như này mới đẹp"): hộc kéo âm có khung mặt — 2 nẹp đứng + thanh ngang trên / giữa phẳng mặt ngăn kéo.
T('Khung mặt hộc kéo âm (bản 1.31)', () => {
  const k = require.resolve('../src/mncf-core.js'), cu = require.cache[k]; delete require.cache[k]; const C = require(k); require.cache[k] = cu;
  eq([C.DEFAULT_SPEC.ngan_keo.khung_mat, C.DEFAULT_SPEC.ngan_keo.ray], [1, 50], 'mặc định: có khung mặt, thanh ngang cao 50');
  const chongNhau = M => { const o = []; for (let i = 0; i < M.parts.length; i++) for (let j = i + 1; j < M.parts.length; j++) if (C.overlap(M.parts[i], M.parts[j]) > 0) o.push(M.parts[i].ten + '×' + M.parts[j].ten); return o; };
  const sp = so => ({ rong: 1000, cao: 2200, than: { cao_duoi: 0 }, khoang: [{ canh: 2, dot: [750], o: [{ tu: 100, kieu: 'nk_am', so }] }] });
  for (const so of [2, 3]) {
    const M = C.build(sp(so)), nk = M.spec.ngan_keo, t = M.spec.van.t, g = nk.khe_ben, R = nk.ray;
    const mat = M.mat_ngan_keo, xa = P(M, 'XA').sort((a, b) => a.z0 - b.z0), nep = P(M, 'NEP'), dot = P(M, 'DOT')[0], day = P(M, 'DAY')[0];
    eq([M.errors, M.warnings, chongNhau(M), C.kiemLienKet(M.parts)], [[], [], [], []], `${so} ngăn: không lỗi, không đè nhau, không tấm lơ lửng`);
    ok(xa.length === so && xa.every(p => p.khung_mat && near(p.y0, nk.lui - t) && near(p.y1, nk.lui) && near(p.z1 - p.z0, R)), `${so} ngăn: ${so - 1} thanh giữa + 1 thanh trên, phẳng mặt ngăn kéo, cao ${R} (không còn xà ẩn sau khe)`, xa.map(p => [p.y0, p.z0, p.z1]));
    const tren = xa[xa.length - 1];
    ok(tren.tren && near(tren.z1, dot.z0) && near(tren.x0, M.info.x_khoang[0]) && near(tren.x1, M.info.x_khoang[0] + M.info.khoang[0]), 'thanh trên: sát mặt dưới đợt, chạy suốt bề ngang khoang (hồi → hồi)', tren);
    ok(nep.length === 2 && nep.every(p => near(p.z0, day.z1) && near(p.z1, tren.z0)), 'nẹp hai bên: từ đáy lên tới dưới thanh trên', nep.map(p => [p.z0, p.z1]));
    ok(xa.slice(0, -1).every(p => near(p.x0, nep[0].x1) && near(p.x1, nep[1].x0)), 'thanh giữa lọt giữa 2 nẹp');
    ok(mat.every(q => Math.abs(q.h - mat[0].h) < 0.51) && near(mat[0].z, day.z1 + nk.khe_duoi) && (d => d >= g - 0.011 && d < g + 0.5 * so)(tren.z0 - (mat[mat.length - 1].z + mat[mat.length - 1].h)) && mat.slice(1).every((q, i) => near(q.z - g, xa[i].z1) && near(mat[i].z + mat[i].h + g, xa[i].z0)), 'mặt ngăn kéo bằng nhau, lọt trong ô: khe dưới 2, khe 2 với mọi thanh ngang (phần dư làm tròn 0,5 dồn lên khe trên cùng)', mat.map(q => [q.z, q.h]));
    ok(mat.every(q => near(q.x, nep[0].x1 + g) && near(q.x + q.w + g, nep[1].x0) && near(q.y, nk.lui - t)), 'mặt ngăn kéo: khe 2 với nẹp, phẳng mặt khung');
  }
  { const Mt = C.build(sp(2)); ok(/2 thanh ngang khung mặt \(phẳng mặt ngăn kéo\), 2 nẹp che khe/.test(C.summary(Mt).join('\n')) && (C.elevationSVG(Mt).match(/stroke-dasharray/g) || []).length === (C.elevationSVG(C.build(Object.assign(sp(2), { ngan_keo: { khung_mat: 0 } }))).match(/stroke-dasharray/g) || []).length - 2, 'tóm tắt ghi thanh ngang khung mặt; hình đứng vẽ thanh khung mặt nét liền (không nét đứt như xà ẩn)', C.summary(Mt)); }
  // tắt khung mặt → như cũ (khe trên / giữa + xà ẩn sau khe)
  const M0 = C.build(Object.assign(sp(2), { ngan_keo: { khung_mat: 0 } }));
  ok(!M0.errors.length && P(M0, 'XA').every(p => !p.khung_mat && p.y0 > M0.spec.ngan_keo.lui) && P(M0, 'NEP').every(p => near(p.z1, P(M0, 'DOT')[0].z0)), 'khung_mat = 0: xà ẩn sau khe, nẹp lên tới đợt như bản 1.28');
  // không nẹp: thanh trên chỉ lọt giữa 2 vách đệm; không vách đệm (khoang không cánh): thanh lọt giữa 2 hồi
  const Mn = C.build(Object.assign(sp(2), { ngan_keo: { nep_khe: 0 } })), dem = P(Mn, 'DEM');
  ok(!Mn.errors.length && !chongNhau(Mn).length && P(Mn, 'XA').every(p => near(p.x0, dem[0].x1) && near(p.x1, dem[1].x0)), 'không nẹp: mọi thanh ngang lọt giữa 2 vách đệm', P(Mn, 'XA').map(p => [p.x0, p.x1]));
  const Mh = C.build({ rong: 1000, cao: 2200, than: { cao_duoi: 0 }, khoang: [{ canh: 0, dot: [750], o: [{ tu: 100, kieu: 'nk_am', so: 2 }] }] });
  ok(!Mh.errors.length && !chongNhau(Mh).length && P(Mh, 'XA').length === 2, 'khoang không cánh (không vách đệm): khung mặt vẫn dựng, không đè tấm nào', [Mh.errors, chongNhau(Mh)]);
  // lệnh ngăn kéo của Chenfeng (kết cấu cũ, lệnh gốc): khe giữa 2 mặt = thanh ngang + 2 khe
  const K = C.keHoachGoc(Object.assign(sp(2), { thung: { noc_day: 'lot' } }));
  ok(K.nk.length === 1 && K.nk[0].khe === 54, 'bước NK: khe giữa 2 mặt = 50 + 2 × 2', K.nk.map(b => b.khe));
  // nâng cấp: tủ bản cũ có ngăn kéo âm → báo đổi sang khung mặt; tủ không có ngăn kéo âm thì không nói
  const n1 = C.nangCap(sp(2), '1.30.1'), n2 = C.nangCap({ rong: 1000, khoang: [{ canh: 2 }] }, '1.30.1'), n3 = C.nangCap(Object.assign(sp(2), { ngan_keo: { khung_mat: 0 } }), '1.30.1');
  ok(n1.doi.some(d => /khung mặt/.test(d)) && !n2.doi.some(d => /khung mặt/.test(d)) && !n3.doi.some(d => /khung mặt/.test(d)), 'nâng cấp: chỉ báo khung mặt khi tủ có ngăn kéo âm và chưa chọn', [n1.doi, n2.doi, n3.doi]);
});

// Bản 1.31.1: các lỗi bắt được khi soát đối kháng mã 1.30 → 1.31
T('Bản vá 1.31.1 — bản lề, vừa khổ ván, khung mặt, phủ hồi', () => {
  const k = require.resolve('../src/mncf-core.js'), cu = require.cache[k]; delete require.cache[k]; const C = require(k); require.cache[k] = cu;
  const MT = m => C.MAU_TU.find(x => x.ma === m).khoang();
  const chongNhau = M => { const o = []; for (let i = 0; i < M.parts.length; i++) for (let j = i + 1; j < M.parts.length; j++) if (C.overlap(M.parts[i], M.parts[j]) > 0) o.push(M.parts[i].ten + '×' + M.parts[j].ten); return o; };
  // BẢN LỀ: cánh thấp (thân trên 200 của tủ 2400) — tránh cả nóc / đáy, không nhồi 3 chén
  { const M = C.build({ ma: 'T', rong: 1400, cao: 2400, khoang: MT('TA2-1000') }), ct = P(M, 'CANH').filter(p => p.than === 'T');
    const nam = P(M, 'DAY').concat(P(M, 'NOC')).filter(p => p.than === 'T');
    ok(!M.warnings.some(w => /bản lề/.test(w)) && ct.length && ct.every(c => c.ban_le.so === 2 && c.ban_le.z.every(v => nam.every(d => c.z0 + v <= d.z0 - 25 + 0.011 || c.z0 + v >= d.z1 + 25 - 0.011))), 'cánh thấp 147 rộng > 600: 2 bản lề, tâm cách mặt đáy / nóc ≥ 25, không cảnh báo bản lề', ct.map(c => [c.z0, c.ban_le])); }
  // hai đợt sát nhau ở chân cánh mà khe giữa vẫn lọt chén: bản lề giữ chỗ cũ, không dời xuống sát đáy
  { const M = C.build({ rong: 1000, cao: 900, than: { cao_duoi: 0 }, phao: { tren: 0 }, khoang: [{ canh: 2, dot: [156, 232] }] }), c = P(M, 'CANH')[0];
    eq([M.warnings, c.ban_le.z.map(v => c.z0 + v)], [[], [202, 799]], 'khe 43,5 giữa 2 đợt lọt chén Ø35: bản lề ở +202 (không bị dời xuống đè đáy)'); }
  ok([0, -50].every(cd => { const b = C.banLeCanh(2097, 450, { cach_dau: cd }); return b.z.every(v => v >= 17.5 - 0.011 && v <= 2097 - 17.5 + 0.011); }), '"cách đầu cánh" gõ 0 / âm: tâm chén vẫn nằm trong cánh');
  ok(C.banLeCanh(147, 647).so === 2, 'cánh 147 rộng 647: 2 bản lề (không nhồi 3 chén cách 36)');
  ok(C.keHoachGoc({ canh: { chen_ban_le: true } }).loi.some(l => /khoét chén/.test(l)) && !C.keHoachGoc({}).loi.length, 'bật khoét chén: lệnh gốc không làm được (cánh lệnh DOOR không mang lỗ) → vẽ bằng nhập tấm');
  // VỪA KHỔ VÁN
  const vk = sp => { const r = C.vuaKhoVan(sp), M = C.build(r.spec); return { r, M }; };
  { const { r, M } = vk({ rong: 4000, cao: 2400, khoang: MT('TA4-2000') }); ok(r.truoc === 2 && r.con === 0 && r.spec.khoang.length === 4 && !M.errors.length, 'tủ 4 cánh 2000 kéo 4000: một lần tách chưa đủ (cả dãy co đều) — đi tiếp tới 4 khoang, hết lỗi', [r.truoc, r.con, r.spec.khoang.length]); }
  { const r = C.vuaKhoVan({ rong: 1400, cao: 2600, than: { cao_duoi: 0 }, khoang: MT('TA2-1100-T') }); ok(!r.doi.length && r.con === r.truoc && r.truoc > 1, 'thân cao 2600 (vượt khổ theo chiều cao): không thêm vách, con = truoc (đếm cả tấm vượt theo chiều cao)', r); }
  { const r = C.vuaKhoVan({ rong: 2000, cao: 2400, khoang: MT('TA3-1500'), khau: { giua: [{ cach: 1375, rong: 300, sau: 300 }] } }); ok(!r.doi.length, 'có cột giữa: chia mà dời phần treo ra trước cột (cảnh báo mới) thì không nhận', r.doi); }
  { const r = C.vuaKhoVan({ rong: 2600, cao: 2400, thung: { noc_day: 'phu_hoi', rong_max: 0 }, khoang: MT('TA4-2000') }), M = C.build(r.spec);
    ok(r.spec.khoang.length === 3 && r.con < r.truoc && /đặt "Rộng tối đa một thùng" \(đang 0 = không tách\) không quá 2440/.test(r.goi_y) && !M.errors.some(e => /quá hẹp/.test(e)), 'phủ hồi thùng liền (Rộng tối đa = 0): chỉ chia tới khi hậu vừa (3 khoang); lời nhắc bảo ĐẶT số đó (đang 0), không bảo "giảm"', [r.spec.khoang.length, r.goi_y]); }
  { const r = C.vuaKhoVan({ rong: 3000, cao: 2400, than: { cao_duoi: 0 }, thung: { noc_day: 'phu_hoi', rong_max: 0 }, khoang: MT('TA6-3000') });
    ok(!r.doi.length && r.con === r.truoc && /đang 0 = không tách/.test(r.goi_y), 'chỉ còn tấm liền thùng vượt khổ: không chia, nhưng vẫn có lời nhắc (goi_y riêng, không gắn vào dòng chia)', r); }
  { const r = C.vuaKhoVan({ rong: 3000, cao: 2400, than: { cao_duoi: 0 }, thung: { noc_day: 'phu_hoi', rong_max: 2900 }, khoang: MT('TA6-3000') });
    ok(/giảm "Rộng tối đa một thùng" \(đang 2900\)/.test(r.goi_y), 'Rộng tối đa một thùng > khổ ván: nhắc giảm, kèm số đang đặt', r.goi_y); }
  // tủ sẵn có cảnh báo theo khoang (treo nông): chia đôi khoang thì cảnh báo cũ lặp ở hai nửa — không phải chỗ hỏng mới, vẫn chia
  for (const x of [{ sau_thung: 450 }, { kiem: { suot_sau_min: 580 } }]) {
    const sp = Object.assign({ rong: 2600, cao: 2400, than: { cao_duoi: 0 }, khoang: MT('TA4-2000') }, x), r = C.vuaKhoVan(sp), M = C.build(r.spec);
    ok(C.build(sp).warnings.some(w => /treo chỉ sâu/.test(w)) && r.spec.khoang.length === 3 && r.con === 0 && !M.errors.length, `cảnh báo "treo chỉ sâu" có sẵn (${JSON.stringify(x)}) không chặn việc chia: 3 khoang, hết lỗi khổ ván`, [r.truoc, r.con, r.spec.khoang.length]); }
  { const sp = { rong: 3500, cao: 2400, than: { cao_duoi: 0 }, khoang: MT('TA5-2500') }, r = C.vuaKhoVan(sp);
    ok(C.build(sp).info.thung.length === 3 && C.build(r.spec).info.thung.length === 2 && /tủ còn 2 thùng/.test(r.doi[0]), 'chia xong số thùng GIẢM (3 → 2): dòng báo nói "tủ còn 2 thùng"', r.doi); }
  { const r = C.vuaKhoVan({ rong: 4000, cao: 2400, khoang: MT('TA6-3000'), khau: { giua: [{ cach: 800, rong: 1250, sau: 250 }] } }), M = C.build(r.spec);
    ok(r.spec.khoang.length <= 4 && !M.errors.some(e => /quá hẹp/.test(e)), 'hậu khấu cột rộng (không gỡ được bằng vách): không chặt khoang tới 300', [r.spec.khoang.length, M.errors]); }
  { const r = C.vuaKhoVan({ rong: 2600, cao: 2400, khoang: MT('TA2-1100-T') }); ok(r.doi.length && /tủ thành 2 thùng/.test(r.doi[0]), 'dòng báo nói tủ thành 2 thùng khi chỗ chia trùng chỗ tách thùng', r.doi); }
  // KHUNG MẶT: thanh giữa không khoan chỉ khi CẢ HAI đầu tì vào nẹp
  const thanh = (canh, ban_le, ray) => { const M = C.build({ rong: canh === 2 ? 1000 : 600, cao: 2400, than: { cao_duoi: 0 }, ngan_keo: ray ? { ray } : {}, khoang: [{ rong: 'auto', canh, ban_le, dot: [600], o: [{ tu: 0, kieu: 'nk_am', so: 2 }] }] }), r = P(M, 'XA').filter(p => !p.tren);
    return r.map(p => [p.khoan, C.cutList(M).rows.find(x => x.ten === p.ten && x.dai === C.cutSize(p).dai).ghi_chu.replace(/ \(.*/, '')]); };
  eq([thanh(2), thanh(0), thanh(1, 'trai'), thanh(0, undefined, 60), thanh(1, 'trai', 60)],
    [[[C.KHONG_KHOAN, 'thanh ngang khung mặt giữa 2 nẹp, keo + đinh']], [[C.KHONG_KHOAN, 'thanh ngang khung mặt — bắt vít / chốt gỗ vào hồi, vách']], [[C.KHONG_KHOAN, 'thanh ngang khung mặt — bắt vít / chốt gỗ vào hồi, vách']], [['Cam3Tp', '']], [['Cam3Tp', '']]],
    'thanh giữa: 2 cánh (hai đầu tì nẹp) keo + đinh; khoang không cánh / 1 cánh mà thanh 50 (mối nối < 60) bắt vít / chốt gỗ — không ghi oan "giữa 2 nẹp"; thanh ≥ 60 thì khoan cam');
  { const nk = { rong: 1000, khoang: [{ rong: 'auto', canh: 2, dot: [600], o: [{ tu: 0, kieu: 'nk_am', so: 2 }] }] };
    eq([C.specDaVe(nk, '1.30.1').ngan_keo.khung_mat, C.specDaVe(Object.assign({ ngan_keo: { khung_mat: 1 } }, nk), '1.30.1').ngan_keo.khung_mat, C.specDaVe(nk, '1.31.0').ngan_keo, C.specDaVe({ rong: 1000 }, '1.30.1').ngan_keo], [0, 1, undefined, undefined], 'tủ có ngăn kéo âm vẽ ở bản < 1.31 dựng lại hộc kéo khe + xà ẩn như lúc vẽ (dò lại không báo oan "thiếu tấm"); tủ KHÔNG có ngăn kéo âm thì không ghi gì (thông số đó là của mọi tủ vẽ sau khi sửa nó)'); }
  // bảng kê: cùng cỡ mà cách bắt khác (keo + đinh giữa 2 nẹp / bắt vít) → hai dòng riêng
  { const M = C.build(C.normalize({ rong: 1292.5, cao: 2400, than: { cao_duoi: 0 }, khoang: [{ rong: 620, canh: 2, dot: [600], o: [{ tu: 0, kieu: 'nk_am', so: 2 }] }, { rong: 'auto', canh: 0, dot: [600], o: [{ tu: 0, kieu: 'nk_am', so: 2 }] }] }));
    const d = C.cutList(M).rows.filter(r => r.khoan === 'không khoan' && /khung mặt/.test(r.ghi_chu || '')).map(r => [r.dai, r.sl, /keo/.test(r.ghi_chu) ? 'keo' : /vít/.test(r.ghi_chu) ? 'vit' : '?']);
    eq(d.sort(), [[520, 1, 'keo'], [520, 1, 'vit']], 'thanh giữa 520 của khoang 2 cánh (keo + đinh) và khoang không cánh (bắt vít) là hai dòng bảng kê', d); }
  // BẢN LỀ: khe giữa hai vùng tránh chỉ vừa lọt chén (2r … 2r + 10) vẫn đặt được; cánh thấp có đợt: hai đế không chồng nhau
  { const M = C.build({ rong: 1000, cao: 900, than: { cao_duoi: 0 }, phao: { tren: 0 }, khoang: [{ canh: 2, dot: [160, 227.5] }] }), c = P(M, 'CANH')[0];
    const nam = M.parts.filter(p => p.loai === 'DOT' || p.loai === 'DAY' || p.loai === 'NOC');
    ok(!M.warnings.some(w => /bản lề/.test(w)) && c.ban_le.z.every(v => nam.every(d => c.z0 + v + 25 <= d.z0 + 0.011 || c.z0 + v - 25 >= d.z1 - 0.011)), 'đợt 160 + 227,5: bản lề tìm được chỗ, đế (± 25) không cấn đợt / đáy / nóc, không báo "không đủ chỗ"', c.ban_le.z.map(v => c.z0 + v)); }
  eq(C.banLeCanh(600, 500, { r: 17.5, tranh: [[-9.5, 23], [50.5, 83], [118, 150.5]] }).ket, false, 'vùng tránh cách nhau 35 (= 2r): khe lọt đúng một chén → dùng được, không "kẹt"');
  { const s = C.apMau(C.DEFAULT_SPEC, 'TA3-1500'); s.cao = 2000; s.than.cao_duoi = 1750; const M = C.build(C.normalize(s)), p = M.parts.find(q => q.loai === 'CANH' && q.khoang === 1 && q.z0 > 1700), z = p.ban_le.z;
    ok(!M.warnings.some(w => /bản lề/.test(w)) && z.length === 2 && z[1] - z[0] >= 45 - 0.011, 'cánh thấp 197 của thân trên: 2 bản lề cách nhau ≥ 2r + 10 (đế không chồng nhau), không cảnh báo', z.map(v => p.z0 + v)); }
  { let sai = 0;      // quét: kết quả hoặc hợp lệ (trong cánh, không chạm vùng, cách nhau ≥ 45), hoặc báo ket — không có "hợp lệ mà báo ket" hay "sai mà không báo"
    for (let cao = 150; cao <= 2400; cao += 37) for (const dots of [[], [0.3], [0.5], [0.2, 0.25], [0.4, 0.43], [0.1, 0.9], [0.33, 0.66]]) {
      const tr = dots.map(f => [f * cao - 16.5, f * cao + 16.5]), r = C.banLeCanh(cao, 500, { r: 17.5, tranh: tr }), cham = v => tr.some(([a, b]) => v + 17.5 > a && v - 17.5 < b);
      const hop = r.z.every(v => v >= 17.5 - 1e-6 && v <= cao - 17.5 + 1e-6 && !cham(v)) && r.z.every((v, i) => !i || v - r.z[i - 1] >= 45 - 1e-6);
      if (hop === !!r.ket) sai++; }
    eq(sai, 0, 'quét 427 cánh × vùng tránh: bản lề hợp lệ ⇔ không báo kẹt'); }
  { let sai = 0, x = 7;      // vùng tránh số lẻ thập phân (đợt gõ 2256,7…): số giả ngẫu nhiên cố định cho lần chạy nào cũng như nhau
    const ngau = () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; };
    for (let i = 0; i < 6000; i++) {
      const cao = 150 + ngau() * 700, tr = []; for (let j = Math.floor(ngau() * 4); j > 0; j--) { const c = ngau() * cao; tr.push([c - 16.5 - ngau() * 3, c + 16.5 + ngau() * 3]); }
      const r = C.banLeCanh(cao, ngau() < 0.5 ? 450 : 650, { r: 17.5, tranh: tr }), cham = v => tr.some(([a, b]) => v + 17.5 > a + 0.011 && v - 17.5 < b - 0.011);
      const hop = r.z.every(v => v >= 17.5 - 0.011 && v <= cao - 17.5 + 0.011 && !cham(v)) && r.z.every((v, i) => !i || v - r.z[i - 1] >= 45 - 0.011);
      if (hop === !!r.ket) sai++; }
    eq(sai, 0, 'quét 6000 cánh thấp × vùng tránh số lẻ: hợp lệ ⇔ không kẹt (so khoảng cách có dung sai; chỗ trống vừa đúng 2 chén thì bỏ lề 5)'); }
  eq(C.banLeCanh(200, 450, { r: 17.5, tranh: [[-25, 7.5], [192.5, 225], [26.8, 59.3], [64.7, 97.2]] }).ket, false, 'hai chén cách đúng 45 (trừ số lẻ ra 44,999…): không báo kẹt');
  for (const d of [2256.7, 2261]) { const M = C.build({ rong: 700, cao: 2450, than: { cao_duoi: 2200 }, khoang: [{ rong: 'auto', canh: 1, dot: [1200, d], o: [] }] }), p = M.parts.find(q => q.loai === 'CANH' && q.z0 > 2000);
    ok(!M.warnings.some(w => /bản lề/.test(w)) && p.ban_le.z[1] - p.ban_le.z[0] >= 45 - 0.011, `cánh trên 197, đợt ${d}: 2 bản lề xếp được, không báo "không đủ chỗ"`, p.ban_le.z); }
  // vừa khổ ván: cảnh báo sẵn có đổi SỐ sau khi chia (hộp che cột chiếm X trong Y) vẫn là của khoang gốc đó — không chặn; cảnh báo cùng loại mà ở khoang gốc khác — chặn
  for (const w of [1800, 2700]) { const s = C.apMau(C.DEFAULT_SPEC, 'TA2-1000'); s.rong = w; s.khau = Object.assign({}, s.khau, { trai: { rong: 300, sau: 200 } });
    const r = C.vuaKhoVan(s), M = C.build(r.spec);
    ok(C.build(s).warnings.some(t => /hộp che cột/.test(t)) && r.doi.length && r.con === 0 && !M.errors.length, `tủ 2 cánh kéo ${w} có cột góc (cảnh báo "hộp che cột" sẵn có): vẫn chia, hết lỗi`, [r.truoc, r.con, r.spec.khoang.length]); }
  { const s = C.apMau(C.DEFAULT_SPEC, 'TA4-2000-2T'); s.rong = 2600; s.khau = { trai: { rong: 0, sau: 0 }, phai: { rong: 0, sau: 0 }, giua: [{ cach: 600, rong: 300, sau: 250 }], ho: 15 };
    const r = C.vuaKhoVan(s), dem = M => M.warnings.filter(t => /treo chỉ sâu/.test(t)).length;
    ok(dem(C.build(r.spec)) <= dem(C.build(s)) && !r.doi.length, 'chia mà khoang treo vốn đủ sâu nay lấn vào vùng cột (cảnh báo cùng loại, KHOANG GỐC khác): không nhận', [r.doi, C.build(r.spec).warnings.filter(t => /treo chỉ sâu/.test(t))]); }
  // "hộp che cột" là của CÂY CỘT: cả dãy chia lại thì cùng cột đó nằm sau khoang khác — không phải hỏng mới; khoang có 2 cột góc tách đôi mỗi nửa một cột — cũng vậy
  { const s = C.apMau(C.DEFAULT_SPEC, 'TA5-2500'); s.rong = 3919; s.thung = { noc_day: 'lot', rong_max: 1600 }; s.chan = { cao: 100 }; s.than = { cao_duoi: 2200 };
    s.khau = { trai: { rong: 0, sau: 0 }, phai: { rong: 0, sau: 0 }, giua: [{ cach: 1063, rong: 206, sau: 83 }, { cach: 3471, rong: 178, sau: 143 }], ho: 15 };
    const r = C.vuaKhoVan(s); ok(r.doi.length && r.con === 0 && !C.build(r.spec).errors.length, 'cột giữa: cảnh báo che cột dời sang khoang khác (cùng cây cột) — vẫn chia, hết lỗi', [r.truoc, r.con, r.spec.khoang.length]); }
  { const s = C.apMau(C.DEFAULT_SPEC, 'TA2-1000'); Object.assign(s, { rong: 2005, khau: { trai: { rong: 267, sau: 122 }, phai: { rong: 442, sau: 223 }, giua: [], ho: 15 }, thung: Object.assign({}, s.thung, { rong_max: 1600 }), chan: Object.assign({}, s.chan, { cao: 100 }) });
    const r = C.vuaKhoVan(s); ok(r.doi.length && r.con === 0 && r.spec.khoang.length === 2, 'một khoang có 2 cột góc tách đôi (mỗi nửa một cột): vẫn chia', [r.truoc, r.con, r.spec.khoang.length]); }
  { const s = C.apMau(C.DEFAULT_SPEC, 'TA6-3000'); Object.assign(s, { rong: 5812, khau: { trai: { rong: 0, sau: 0 }, phai: { rong: 263, sau: 89 }, giua: [{ cach: 3359, rong: 177, sau: 323 }], ho: 15 }, thung: Object.assign({}, s.thung, { noc_day: 'phu_hoi', rong_max: 2000 }), chan: Object.assign({}, s.chan, { cao: 0 }), than: Object.assign({}, s.than, { cao_duoi: 2200 }) });
    const r = C.vuaKhoVan(s), dem = M => M.warnings.filter(t => /treo chỉ sâu/.test(t)).length;
    ok(dem(C.build(r.spec)) <= dem(C.build(s)), 'không nhận phương án làm thêm một khoang treo nông vì lấn vùng cột (dù gỡ hết lỗi khổ ván)', [r.truoc, r.con, r.spec.khoang.length]); }
  // khung đế: hai vùng cột dùng chung một vách → một đế dọc, chạy tới mép sau (đoạn đế sau dưới vách đã bỏ vì vụn)
  { const M = C.build({ rong: 2400, cao: 2200, than: { cao_duoi: 0 }, chan: { cao: 100 }, thung: { noc_day: 'phu_hoi', rong_max: 0 }, khoang: [0, 1, 2].map(() => ({ rong: 'auto', canh: 2, dot: [1100], o: [] })), khau: { giua: [{ cach: 543.5, rong: 200, sau: 200 }, { cach: 911, rong: 200, sau: 180 }] } });
    const doc = P(M, 'DE').filter(p => p.ten === 'Đế dọc'), Dc = Math.max(...P(M, 'DE').map(p => p.y1));
    ok(!M.errors.length && !chongNhau(M).length && doc.length === 1 && Math.abs(doc[0].y1 - Dc) < 0.011, 'hai cột hai bên một vách: một đế dọc (không hai tấm chồng nhau), chạy tới mép sau', [M.errors, doc.map(p => [p.x0, p.x1, p.y0, p.y1]), Dc]); }
  ok(C.nangCap({ khoang: [{ rong: 'auto', canh: 2, ngan_keo: { so: 2, den: 520 } }] }, '1.4.0').doi.some(d => /khung mặt/.test(d)), 'nâng cấp: ngăn kéo dạng cũ (khoang.ngan_keo) cũng được báo đổi sang khung mặt');
  // PHỦ HỒI: khung đế khép kín khi vách sẵn có làm vách khấu; không có đoạn đế vụn
  { const r = C.vachTheoCot({ rong: 2400, cao: 2200, than: { cao_duoi: 0 }, thung: { noc_day: 'phu_hoi' }, khoang: [0, 1, 2].map(() => ({ rong: 'auto', canh: 2, dot: [1100], o: [] })), khau: { giua: [{ cach: 900, rong: 250, sau: 200 }] } });
    const M = C.build(r.spec), K = M.info.khau[0];
    ok(!r.loi && K && K.co_a && K.co_b && !M.errors.length && !chongNhau(M).length && P(M, 'DE').filter(p => p.ten === 'Đế dọc').length === 2, 'vách sẵn có làm vách khấu: thêm 2 đế dọc nối đoạn đế trước cột với đoạn sát lưng, không đè tấm nào', [r.loi, K, M.errors, chongNhau(M), P(M, 'DE').map(p => p.ten)]);
    ok(P(M, 'DE').filter(p => p.ten === 'Đế sau' || p.ten === 'Đế dọc').every(p => M.parts.filter(q => q !== p && (q.loai === 'DE' || q.loai === 'HOI' || q.loai === 'VACH')).some(q => C.overlap(Object.assign({}, p, { x0: p.x0 - 0.1, x1: p.x1 + 0.1, y0: p.y0 - 0.1, y1: p.y1 + 0.1 }), q) > 0)), 'mọi đoạn đế sau / đế dọc chạm một tấm đứng khác (khung khép kín)'); }
  { const M = C.build({ rong: 922, cao: 800, than: { cao_duoi: 0 }, chan: { cao: 80 }, phao: { trai: 0, phai: 50, tren: 0 }, thung: { noc_day: 'phu_hoi' }, khau: { trai: { rong: 357, sau: 166 }, phai: { rong: 496, sau: 163 } }, khoang: [{ rong: 'auto', canh: 2, dot: [] }] });
    ok(!M.errors.length && P(M, 'DE').every(p => Math.min(p.x1 - p.x0, p.y1 - p.y0) >= 17.5 - 0.011), 'hai cột góc sát nhau: không sinh đoạn đế vụn 4 mm', [M.errors, P(M, 'DE').map(p => [p.ten, p.x0, p.x1])]); }
});

T('Giường, táp, vách đầu giường (bản 1.32)', () => {
  const D0 = C0.DEFAULT_SPEC;
  // mọi mẫu thư viện dựng được, không lỗi, không cảnh báo, không tấm đè nhau, mỗi tấm vừa khổ ván
  for (const ds of [C0.MAU_TAP, C0.MAU_GIUONG, C0.MAU_VACH]) for (const m of ds) {
    const s = C0.apMau(D0, m.ma), M = C0.build(s);
    ok(s.loai_sp === m.loai_sp && !M.errors.length && !M.warnings.length && M.parts.length >= 5, `mẫu ${m.ma}: dựng được, không lỗi / cảnh báo`, [s.loai_sp, M.errors, M.warnings]);
    eq(overlapAny(M), [], `mẫu ${m.ma}: không tấm nào đè nhau`);
    ok(M.parts.every(p => { const c = C0.cutSize(p); return c.dai <= s.van.kho_dai + 0.01 && c.rong <= s.van.kho_rong + 0.01; }), `mẫu ${m.ma}: mọi tấm vừa khổ ván`);
    ok(C0.phieu(M).xong && C0.phieu(M).dat, `mẫu ${m.ma}: phiếu kiểm đạt`, C0.phieu(M).muc.filter(x => x.ket !== 'dat').map(x => x.ma));
  }
  eq(C0.THU_VIEN.map(x => x.loai), ['tu', 'tap', 'giuong', 'vach'], 'thư viện: tủ áo, táp, giường, vách');
  ok(C0.THU_VIEN[0].ds === C0.MAU_TU, 'thư viện tủ áo = bộ mẫu tủ áo');
  // GIƯỜNG: phủ bì theo nệm, lòng giường đúng khe
  for (const [ma, nem] of [['G12-T', [1200, 2000]], ['G16-T', [1600, 2000]], ['G18-B', [1800, 2000]], ['G16-NK', [1600, 2000]]]) {
    const M = C0.build(C0.apMau(D0, ma)); eq(M.info.giuong.nem, nem, `${ma}: nệm ${nem.join(' × ')}`);
    const pb = C0.phuBiGiuong(M.spec, nem[0], nem[1]); ok(near(pb.rong, M.spec.rong) && near(pb.sau_thung, M.spec.sau_thung), `${ma}: phủ bì = phuBiGiuong(nệm)`, [pb, M.spec.rong, M.spec.sau_thung]);
    const b = C0.bbox(M.parts); ok(near(b.x1 - b.x0, M.spec.rong) && near(b.y1 - b.y0, M.spec.sau_thung) && near(b.z1 - b.z0, M.spec.cao), `${ma}: hộp bao = rộng × dài × cao đầu giường`, b);
    ok(P(M, 'PH').every(p => near(p.z1, M.info.giuong.mat_phan)) && P(M, 'HG').concat(P(M, 'THH')).every(p => near(p.z1, M.spec.giuong.cao_thanh)), `${ma}: mặt phản lún dưới mặt hông`);
    ok(M.parts.filter(p => /^(DG|DUG|HG|THH)$/.test(p.loai)).every(p => p.khoan === C0.KHONG_KHOAN && p.bat_giuong), `${ma}: đầu / đuôi / hông bắt bát giường, không khoan cam`);
    ok(M.phu_kien.some(x => /Bát giường/.test(x.ten) && x.sl === 4), `${ma}: 4 bộ bát giường`);
    const h = C0.heSo(M.spec); ok(['L', 'W', 'H'].every(k => h.bien[k] && h.bien[k].sai_so < 0.02), `${ma}: module co giãn đúng theo L / W / H`, [h.ly_do, ['L', 'W', 'H'].map(k => h.bien[k] && h.bien[k].sai_so)]);
    ok(/chưa có lệnh gốc/.test(C0.keHoachGoc(M.spec).loi || '') && M.spec.ve_goc === C0.normalize(D0).ve_goc, `${ma}: không lệnh gốc → nhập tấm + gom module; lựa chọn "vẽ bằng lệnh gốc" của người dùng giữ nguyên`);
    eq(C0.vuaKhoVan(M.spec).doi, [], `${ma}: vừa khổ ván không đụng giường`);
    eq(C0.toChenfeng(M).so_tam, M.parts.length, `${ma}: nhập đủ tấm`);
  }
  // giường thường: đà giữa 2 lớp ở giữa, phản chia đôi mối nối trên đà; vách ngăn gầm cách ≤ 650
  { const M = C0.build(C0.apMau(D0, 'G16-T')), xc = M.spec.rong / 2, da = P(M, 'DA');
    ok(da.length === 2 && near(da[0].x1, xc) && near(da[1].x0, xc) && P(M, 'PH').length === 2 && P(M, 'PH').some(p => near(p.x1, xc)), 'G16-T: đà giữa 2 lớp, phản 2 tấm nối trên đà', da.map(box));
    const ys = [...new Set(P(M, 'TH').map(p => p.y0))].sort((a, b) => a - b);
    ok(ys.length >= 3 && ys.slice(1).every((y, i) => y - ys[i] - M.spec.van.t <= 650), 'G16-T: vách ngăn gầm cách nhau ≤ 650', ys); }
  { const s = C0.apMau(D0, 'G12-T'); s.rong = C0.phuBiGiuong(s, 900, 2000).rong; const M = C0.build(s);
    ok(!M.errors.length && P(M, 'DA').length === 0 && P(M, 'PH').length === 1, 'giường nệm 900 (lòng ≤ 1000): không đà giữa, phản một tấm', P(M, 'PH').map(box)); }
  { const M = C0.build(C0.apMau(D0, 'G12-T')); ok(P(M, 'DA').length === 2 && P(M, 'PH').length === 2, 'G12-T (lòng 1220 > 1000): có đà giữa, phản 2 tấm', P(M, 'PH').map(box)); }
  // giường bay: đế lùi vào trong, thân trên đế, đầu giường xuống sàn, có LED
  { const M = C0.build(C0.apMau(D0, 'G16-B')), q = M.spec.giuong, de = P(M, 'DEB');
    ok(de.length >= 3 && de.every(p => p.z0 === 0 && near(p.z1, q.cao_de) && p.x0 >= q.lui_de - 0.01 && p.x1 <= M.spec.rong - q.lui_de + 0.01 && p.y0 >= q.lui_de - 0.01), 'G16-B: đế lùi vào trong lui_de, cao cao_de', de.map(box));
    ok(P(M, 'HG').every(p => near(p.z0, q.cao_de)) && P(M, 'DUG').every(p => near(p.z0, q.cao_de)) && P(M, 'DG').every(p => p.z0 === 0), 'G16-B: hông / đuôi đặt trên đế, đầu giường xuống sàn');
    ok(M.phu_kien.some(x => /LED/.test(x.ten)), 'G16-B: có LED hắt gầm'); }
  // giường ngăn kéo: mặt ngăn kéo phẳng mặt ngoài hông, hộp lọt giữa 2 vách ngăn gầm, nhịp phản ≤ 650 nhờ thanh đỡ phản
  { const M = C0.build(C0.apMau(D0, 'G16-NK')), t = M.spec.van.t, W = M.spec.rong, mat = P(M, 'MNK');
    ok(mat.length === 4 && mat.every(p => near(p.x0, 0) || near(p.x1, W)) && P(M, 'HG').length === 0 && P(M, 'THH').length === 4, 'G16-NK: 4 mặt ngăn kéo phẳng mặt ngoài, hông thành thanh hông trên', mat.map(box));
    ok(P(M, 'TNK').length === 8 && P(M, 'HNK').length === 4 && P(M, 'DNK').length === 4, 'G16-NK: mỗi ngăn kéo 2 thành + hậu + đáy');
    ok(P(M, 'DNK').every(p => near(p.z1 - p.z0, M.spec.hau.t)), 'G16-NK: đáy ngăn kéo dày bằng hậu');
    const moc = [...new Set(P(M, 'TH').map(p => p.y0))].sort((a, b) => a - b);
    ok(M.parts.some(p => p.ten === 'Thanh đỡ phản') && moc.slice(1).every((y, i) => y - moc[i] - t <= 650 + 0.01), 'G16-NK: thanh đỡ phản giữ nhịp phản ≤ 650', moc);
    const doPhan = M.parts.filter(p => p.ten === 'Thanh đỡ phản'), hop = P(M, 'TNK');
    ok(doPhan.every(d => hop.every(h => h.z1 <= d.z0 + 0.01)), 'G16-NK: hộp ngăn kéo nằm dưới thanh đỡ phản');
    ok(M.phu_kien.some(x => /Ray bi/.test(x.ten) && x.sl === 4) && M.info.giuong.nk.so === 4, 'G16-NK: 4 cặp ray bi');
    const s1 = C0.normalize(Object.assign(C0.apMau(D0, 'G16-NK'), {})); s1.giuong.nk_ben = 'trai'; const M1 = C0.build(s1);
    ok(!M1.errors.length && P(M1, 'MNK').length === 2 && P(M1, 'MNK').every(p => near(p.x0, 0)) && P(M1, 'HG').length === 2, 'ngăn kéo một bên trái: bên phải vẫn là hông giường', P(M1, 'MNK').map(box)); }
  // bảng kê: nhóm giường, ghi chú bát giường, phụ kiện của giường đi vào bảng kê
  { const M = C0.build(C0.apMau(D0, 'G16-NK')), cl = C0.cutList(M);
    ok(cl.rows.some(r => r.nhom === 'Giường') && cl.rows.some(r => r.nhom === 'Ngăn kéo giường') && cl.rows.some(r => r.nhom === 'Phản giường'), 'bảng kê: nhóm Giường / Phản / Ngăn kéo giường', [...new Set(cl.rows.map(r => r.nhom))]);
    ok(cl.rows.filter(r => /Đầu giường|Đuôi giường|Thanh hông/.test(r.ten) && !/lớp/.test(r.ten)).every(r => /bát giường/.test(r.ghi_chu)), 'bảng kê: đầu / đuôi / hông ghi "bắt bát giường"');
    ok(M.phu_kien.every(x => cl.phu_kien.some(y => y.ten === x.ten)), 'bảng kê: phụ kiện của giường có trong bảng');
    eq(C0.phieu(M).muc.filter(x => x.ket !== 'khong').map(x => x.ma), ['kich_thuoc', 'kho_van', 'va_cham', 'lien_ket', 'nhip', 'ngan_keo', 'phu_kien'], 'phiếu kiểm giường ngăn kéo: đúng mục của giường (đế giường bay: không xét)');
    ok(C0.summary(M).some(l => /ngăn kéo/.test(l)) && C0.summary(M).some(l => /^Tấm ván/.test(l)), 'tóm tắt giường');
    const nm = C0.nhomMau(M.parts); ok(M.parts.every((p, i) => (p.loai === 'MNK' || (/^(DG|DUG|HG|THH)$/.test(p.loai) && !p.lop_trong)) === (nm[i] === 'mat')), 'đổ màu: mặt ngăn kéo + lớp ngoài đầu / đuôi / hông là "mặt", còn lại thùng', M.parts.map((p, i) => p.ten + ':' + nm[i])); }
  // lỗi nhập: lòng giường quá nhỏ / giường bay đế quá lùi / thành quá thấp → lỗi, không tấm
  { const s = C0.apMau(D0, 'G16-T'); s.rong = 500; ok(C0.build(s).errors.length > 0, 'giường rộng 500: lỗi lòng giường quá nhỏ'); }
  { const s = C0.apMau(D0, 'G16-B'); s.giuong.lui_de = 20; ok(C0.build(s).errors.some(e => /Giường bay/.test(e)), 'giường bay lùi đế 20 (< dày hông + 30): lỗi'); }
  { const s = C0.apMau(D0, 'G16-T'); s.giuong.cao_thanh = 100; ok(C0.build(s).errors.some(e => /quá thấp/.test(e)), 'cao thành 100: lỗi phản quá sát sàn'); }
  // VÁCH ĐẦU GIƯỜNG: ô chia đều, mối nối nằm trên xương dọc, xương cách ≤ xuong_cach, dày = ốp + xương
  for (const ma of ['V2600-1200', 'V2800-2400']) {
    const M = C0.build(C0.apMau(D0, ma)), q = M.spec.vach, op = P(M, 'OP'), xd = M.parts.filter(p => p.ten === 'Xương dọc');
    ok(near(M.spec.sau_thung, (q.day_op || M.spec.van.t) + M.spec.van.t), `${ma}: dày = tấm ốp + xương`);
    ok(op.length === M.info.vach.so_o * M.info.vach.so_hang && op.every(p => near(p.x1 - p.x0, M.info.vach.o[0])), `${ma}: ô chia đều`);
    const cx = [...new Set(xd.map(p => (p.x0 + p.x1) / 2))].sort((a, b) => a - b);
    ok(cx.slice(1).every((x, i) => x - cx[i] <= q.xuong_cach + 0.01), `${ma}: xương dọc cách ≤ ${q.xuong_cach}`, cx);
    ok(op.every(o => xd.some(x => x.x0 <= o.x0 + 0.01 && x.x1 > o.x0) && xd.some(x => x.x1 >= o.x1 - 0.01 && x.x0 < o.x1)), `${ma}: mép mỗi tấm ốp nằm trên xương dọc`);
    const h = C0.heSo(M.spec); ok(h.bien.L && (h.bien.H || ma === 'V2800-2400') && !h.bien.W && h.ly_do.W === 'khong_deu', `${ma}: module co giãn L / H (kịch khổ ván: khoá H), khoá dày`, h.ly_do);
    eq(C0.phieu(M).muc.map(x => x.ma), ['kich_thuoc', 'kho_van', 'va_cham', 'lien_ket', 'xuong'], `${ma}: phiếu kiểm của vách`);
  }
  { const s = C0.apMau(D0, 'V2800-1200'); s.vach.so_o = 1; ok(C0.build(s).errors.some(e => /khổ ván/.test(e)), 'vách 1 ô rộng 2800: lỗi lớn hơn khổ ván'); }
  // TÁP: tủ thường (lệnh gốc được), không phào, không khấu cột
  for (const m of C0.MAU_TAP) { const s = C0.apMau(D0, m.ma); ok(s.loai_sp === 'tap' && s.khoang.length === 1 && s.khoang[0].canh === 0 && !s.phao.trai && !s.phao.phai && !s.phao.tren && !(s.khau.giua || []).length, `${m.ma}: một khoang không cánh, không phào, không khấu`); }
  // TỦ ÁO giữ nguyên: thông số tủ không mang khoá loai_sp; quay về tủ trả phào / sâu / cách vẽ về mặc định
  ok(!('loai_sp' in C0.normalize(D0)) && !('loai_sp' in C0.normalize({ loai_sp: 'tu' })) && !('loai_sp' in C0.normalize({ loai_sp: 'lạ' })), 'tủ: không có khoá loai_sp');
  for (const tu of ['G16-NK', 'V2800-1200', 'TAP2-500']) {
    const s = C0.apMau(C0.apMau(D0, tu), 'TA2-1000');
    ok(!('loai_sp' in s) && !s.giuong && !s.vach && JSON.stringify(s.phao) === JSON.stringify(C0.normalize(D0).phao) && s.sau_thung === C0.normalize(D0).sau_thung && s.ve_goc === C0.normalize(D0).ve_goc && !C0.build(s).errors.length, `${tu} → tủ áo: phào, sâu, cách vẽ về mặc định`, [s.loai_sp, s.phao, s.sau_thung, s.ve_goc]);
  }
  { const s = C0.apMau(C0.apMau(D0, 'G16-T'), 'TAP2-500'); ok(s.ve_goc === C0.normalize(D0).ve_goc && s.loai_sp === 'tap', 'giường → táp: bật lại lệnh gốc'); }
  { const s0 = C0.apMau(D0, 'G16-T'); s0.giuong.lop = 1; s0.giuong.ho_nem = 15; const s = C0.apMau(s0, 'G18-T');
    ok(s.giuong.lop === 1 && s.giuong.ho_nem === 15 && near(s.rong, 1800 + 2 * 15 + 2 * s.van.t), 'đổi mẫu giường: giữ số lớp ván + khe nệm của người dùng', [s.giuong, s.rong]); }
  ok(C0.nhomThuMuc('Táp đầu giường') === 'tu' || C0.nhomThuMuc('Táp đầu giường') === C0.nhomThuMuc('Tủ áo'), 'kho mẫu: thư mục "Táp đầu giường" vào nhóm Tủ', C0.nhomThuMuc('Táp đầu giường'));
});

T('Giường, táp, vách — bản vá sau soát (bản 1.32)', () => {
  const D0 = C0.DEFAULT_SPEC, PK = (M, re) => M.phu_kien.find(x => re.test(x.ten));
  { const s = C0.apMau(D0, 'G16-T'); s.giuong.so_thang = 1; const M = C0.build(s);
    ok(C0.normalize(s).giuong.so_thang === 2 && !M.errors.length && P(M, 'TH').every(p => isFinite(p.y0) && isFinite(p.y1)), 'vách ngăn gầm gõ 1: thành 2 (đầu + đuôi), không ra NaN', P(M, 'TH').map(box)); }
  { const s = C0.apMau(D0, 'G16-NK'); s.van.ten_van = 'MDF17'; s.hau.ten_van = 'HDF6'; const b = C0.toChenfeng(C0.build(s)).json.ModelSpace.filter(o => o.Name === 'Đáy ngăn kéo');
    ok(b.length === 4 && b.every(o => o.BrMatName === 'HDF6' && ['UpSealed', 'DownSealed', 'LeftSealed', 'RightSealed'].every(k => o[k] === '0')), 'đáy ngăn kéo giường: ván hậu, không dán cạnh', b[0]); }
  { const M = C0.build(C0.apMau(D0, 'G16-T'));
    ok(M.parts.every(p => p.khoan === C0.KHONG_KHOAN && !p.fd && !p.bd), 'giường thường: mọi tấm bắt vít / bát / ke — không khoan cam, mặt không nhận lỗ', M.parts.filter(p => p.fd || p.khoan !== C0.KHONG_KHOAN).map(p => p.ten));
    ok(C0.cutList(M).rows.filter(r => r.ten === 'Vách ngăn gầm').every(r => /bắt vít/.test(r.ghi_chu)), 'bảng kê: vách ngăn gầm "bắt vít / ke"'); }
  // giường bay: thân tì cả chiều dài đế trước (một vách ngăn gầm đứng ngay trên nó), khung đế khoan cam, thân bắt ke xuống đế
  for (const [ten, sua] of [['G16-B', s => s], ['bay nệm 900 (không đà)', s => { s.rong = C0.phuBiGiuong(s, 900, 2000).rong; return s; }]]) {
    const M = C0.build(sua(C0.apMau(D0, 'G16-B'))), q = M.spec.giuong, deT = M.parts.find(p => p.ten === 'Đế giường trước');
    const tren = P(M, 'TH').filter(p => near(p.y0, deT.y0) && near(p.z0, deT.z1));
    ok(!M.errors.length && !M.warnings.length && tren.length >= 1 && near(tren.reduce((a, p) => a + p.x1 - p.x0, 0) + (P(M, 'DA').length ? 0 : 0), M.spec.rong - 2 * q.lop * M.spec.van.t - (P(M, 'DA').length ? 2 * M.spec.van.t : 0)), `${ten}: vách ngăn gầm đứng trên đế trước`, [M.errors, M.warnings, tren.map(box), box(deT)]);
    ok(P(M, 'DEB').every(p => p.khoan !== C0.KHONG_KHOAN && p.vit_de_giuong) && PK(M, /Ke góc/), `${ten}: khung đế khoan cam, thân giường bắt ke góc xuống đế (phụ kiện)`);
    eq(overlapAny(M), [], `${ten}: không tấm nào đè nhau`);
  }
  { const s = C0.apMau(D0, 'G16-B'); s.giuong.lui_de = 800; ok(C0.build(s).errors.some(e => /lùi đế 800 quá lớn/.test(e)), 'giường bay lùi đế 800 (đế trái chạm đế giữa): lỗi', C0.build(s).errors); }
  // giường ngăn kéo: kiểm số nhập
  { const s = C0.apMau(D0, 'G16-NK'); s.giuong.nk_so = 1; ok(C0.build(s).warnings.some(w => /Ngăn kéo rộng .* tăng số ngăn/.test(w)), '1 ngăn mỗi bên (hộp ~2 m): cảnh báo ray và đáy dễ võng'); }
  { const s = C0.apMau(D0, 'G16-NK'); s.giuong.nk_sau = 200; const M = C0.build(s); ok(M.errors.some(e => /quá nông/.test(e)) && !M.phu_kien.some(x => /dài 0/.test(x.ten)), 'ngăn kéo sâu 200: lỗi, không ra "ray dài 0"'); }
  for (const [lun, vt] of [[55, 17.5], [40, 25]]) { const s = C0.apMau(D0, 'G16-NK'); s.giuong.lun = lun; s.van.t = vt; const M = C0.build(s), th = Math.max(80, lun + vt + 20), zTop = M.spec.giuong.cao_thanh;
    ok(!M.errors.length && P(M, 'THH').every(p => near(p.z0, zTop - th)) && P(M, 'TH').every(p => p.z1 > zTop - th + 19.9), `giường ngăn kéo phản lún ${lun}, ván ${vt}: thanh hông tự cao ${th}, vẫn dựng được`, [M.errors, P(M, 'THH').map(box)]); }
  { const s = C0.apMau(D0, 'G16-NK'); s.giuong.lun = 240; const e = C0.build(s).errors; ok(e.some(x => /giảm Phản lún/.test(x)), 'phản lún 150: hết chỗ cho mặt ngăn kéo — lỗi nói tăng Cao thành / giảm Phản lún', e); }
  { const s = C0.apMau(D0, 'G16-B'); s.giuong.lui_de = 500; ok(C0.build(s).warnings.some(w => /dễ lật/.test(w)) && !C0.build(C0.apMau(D0, 'G16-B')).warnings.length, 'giường bay lùi đế 500: cảnh báo dễ lật (mặc định 150 thì không)'); }
  { const s = C0.apMau(D0, 'G16-NK'); s.giuong.nk_sau = 700; const M = C0.build(s), h = C0.heSo(s);
    ok(M.info.giuong.nk.kep && !h.bien.L && h.ly_do.L === 'khong_deu' && h.bien.W && h.bien.H, 'sâu hộp ngăn kéo kẹp theo đà giữa: module khoá Rộng (đổi ở bảng)', [M.info.giuong.nk, h.ly_do]);
    ok(!C0.build(C0.apMau(D0, 'G16-NK')).info.giuong.nk.kep, 'mẫu G16-NK (sâu 500): không kẹp'); }
  // khấu cột của tủ trước không theo sang giường / vách (heSo không khoá Rộng oan); khe hở cột của người dùng giữ
  for (const ma of ['G16-T', 'V2800-1200']) {
    const s0 = C0.apMau(D0, 'TA2-1000'); s0.khau = { trai: { rong: 0, sau: 0 }, phai: { rong: 0, sau: 0 }, giua: [{ cach: 400, rong: 200, sau: 200 }], ho: 20 };
    const s = C0.apMau(s0, ma), h = C0.heSo(s);
    ok(!s.khau.giua.length && s.khau.ho === 20 && h.bien.L && h.ly_do.L !== 'cot_giua', `tủ khấu cột giữa → ${ma}: bỏ khấu, Rộng co giãn được`, [s.khau, h.ly_do]);
  }
  // quay về tủ: Chuẩn xưởng (phụ trợ phào, nối phào, cách vẽ, khe hở cột) giữ nguyên; phào / chân / sâu / khấu / mã về mặc định của tủ
  { const s0 = C0.normalize(Object.assign(C0.clone ? C0.clone(D0) : JSON.parse(JSON.stringify(D0)), { ve_goc: false }));
    s0.phao = Object.assign({}, s0.phao, { phu_tro: 60, noi: 'lien' }); s0.khau.ho = 25;
    for (const duong of [['TAP2-500'], ['G16-T'], ['V2800-1200'], ['TAP2-500-C', 'G16-NK']]) {
      let s = s0; for (const m of duong) s = C0.apMau(s, m);
      const t = C0.apMau(s, 'TA2-1000'), v = C0.veTuAo(s), N = C0.normalize(D0);
      for (const [x, ten] of [[t, 'mẫu TA2-1000'], [v, 'tủ mặc định']]) ok(!x.loai_sp && x.phao.phu_tro === 60 && x.phao.noi === 'lien' && x.phao.trai === N.phao.trai && x.phao.tren === N.phao.tren && x.ve_goc === false && x.khau.ho === 25 && x.chan.cao === N.chan.cao && x.sau_thung === N.sau_thung && !x.giuong && !x.vach, `${duong.join(' → ')} → ${ten}: giữ Chuẩn xưởng, trả phào / chân / sâu`, [x.phao, x.ve_goc, x.khau, x.chan, x.sau_thung]);
      ok(v.ma === N.ma && v.ten === N.ten, `${duong.join(' → ')} → tủ mặc định: mã / tên của tủ`, [v.ma, v.ten]);
    }
    ok(C0.apMau(C0.apMau(s0, 'G16-T'), 'TAP2-500').ve_goc === false, 'giường → táp: giữ lựa chọn cách vẽ của người dùng'); }
  // vách: chia ô hỏng → một dòng lỗi rõ; khe ≥ bản xương → lỗi; số hàng / tầng xương ghi sẵn → module co giãn Rộng + Cao (trừ khi chạm khổ ván)
  { const s = C0.apMau(D0, 'V2800-1200'); s.vach.so_o = 1; const M = C0.build(s); ok(M.errors.length === 1 && /tăng số ô/.test(M.errors[0]), 'vách 1 ô 2800: một dòng lỗi "tăng số ô"', M.errors); }
  { const s = C0.apMau(D0, 'V2800-1200'); s.vach.khe = 75; ok(C0.build(s).errors.some(e => /mép tấm ốp không nằm trên xương/.test(e)), 'khe 75 với xương 80: lỗi'); }
  for (const m of C0.MAU_VACH) { const s = C0.apMau(D0, m.ma), h = C0.heSo(s), a = C0.vachTuDong(s);
    ok(h.bien.L && (h.bien.H || m.ma === 'V2800-2400') && s.vach.so_hang === a.so_hang && s.vach.so_ngang === a.so_ngang && s.vach.so_doc === a.so_doc, `${m.ma}: ghi sẵn số hàng / tầng xương; module co giãn Rộng${m.ma === 'V2800-2400' ? ' (Cao kịch khổ ván: khoá)' : ' + Cao'}`, [h.ly_do, s.vach]); }
  { const s = C0.apMau(D0, 'V2800-1200'); for (const [k, d] of [['cao', 240], ['rong', 240], ['cao', -120]]) { const s1 = JSON.parse(JSON.stringify(s)); s1[k] += d; const M = C0.build(s1); ok(!M.errors.length && !M.warnings.length && M.parts.length === C0.build(s).parts.length, `vách ghi sẵn số xương: kéo ${k} ${d > 0 ? '+' : ''}${d} trong Chenfeng vẫn đủ xương (không cảnh báo, không đổi số tấm)`, M.warnings); } }
  for (const v of [{ xuong_cach: 200, xuong_rong: 150 }, { xuong_cach: 200, xuong_rong: 20, so_o: 1 }]) { const s = C0.apMau(D0, 'V2800-1200'); Object.assign(s.vach, v); if (v.so_o) s.rong = 1200; Object.assign(s.vach, C0.vachTuDong(s)); const M = C0.build(s);
    ok(!M.errors.length && M.warnings.every(w => /bản xương .* quá to/.test(w)) && (v.so_o ? !M.warnings.length : M.warnings.length === 1) && !overlapAny(M).length, `vách xương ${v.xuong_rong} cách ${v.xuong_cach}${v.so_o ? ', 1 ô' : ''}: không chồng xương, không bảo "đổi ở Chenfeng" oan`, [M.errors, M.warnings, overlapAny(M).slice(0, 3), s.vach]); }
  { const s = C0.apMau(D0, 'V2600-1200'); s.cao = 2000; const M = C0.build(s); ok(M.warnings.some(w => /Xương ngang cách nhau .* gõ lại/.test(w)), 'số tầng xương ghi sẵn mà cao đổi ở Chenfeng: cảnh báo, bảo gõ lại Cao', M.warnings);
    Object.assign(s.vach, C0.vachTuDong(s)); ok(!C0.build(s).warnings.length, 'chia lại theo cỡ mới: hết cảnh báo'); }
  ok(C0.normalize(Object.assign(C0.apMau(D0, 'V2800-1200'), { vach: { cach_san: 500 } })).vach.cach_san === 0, 'vách luôn đứng từ sàn (cách sàn = 0)');
  // khổ ván: lời khuyên theo sản phẩm (không bảo giường "chia khoang")
  { const s = C0.apMau(D0, 'G16-T'); s.cao = 1300; const e = C0.build(s).errors; ok(e.length && e.every(x => !/chia khoang/.test(x)) && e.some(x => /cao đầu giường/.test(x)), 'đầu giường cao 1300 > khổ: lỗi nói giảm cao đầu giường', e); }
  // kho mẫu: chữ "tab" chỉ khi đứng riêng
  eq(['Tableware', 'Portable', 'Stable', 'Tab', 'Tab đầu giường', 'Táp đầu giường'].map(C0.nhomThuMuc), ['khac', 'khac', 'khac', 'tu', 'tu', 'tu'], 'nhomThuMuc: "tab" là chữ riêng');
  eq(['Giường 1m6', 'Giường bay', '床', '双人床', 'Vách đầu giường', '背景墙', 'Táp đầu giường', 'Tab đầu giường', 'Tủ đầu giường', '床头柜', '床边柜', '背景墙柜', 'Kệ đầu giường', 'Tủ áo'].map(C0.khoKhongHau),
    [true, true, true, true, true, true, false, false, false, false, false, false, false, false], 'kho mẫu: giường / vách không phủ hậu; táp / tủ / 柜 đầu giường vẫn phủ hậu');
  eq(['Giường hộc kéo', 'Giường có kệ đầu giường', 'Hộc đầu giường', 'Bàn đầu giường', 'Đôn đầu giường', '床头几', '床边桌', 'Ngăn kéo gầm giường'].map(C0.khoKhongHau), [true, true, false, false, false, false, false, false], 'kho mẫu: tên mở đầu "Giường" là giường; bàn / đôn / hộc / 几 / 桌 đầu giường là tủ');
});

console.log(`\n${pass} đạt, ${fail} hỏng`);
process.exit(fail ? 1 : 0);
