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
// Bản 1.36.4 (anh Thanh 16/10/2026, ảnh tủ 3000 × 2800): tủ mặc định đổi ruột (K1 / K3 hai tầng treo, K2 2 ngăn kéo + treo dài) và thân dưới 2150. Số đo cũ của bộ thử
// này là tủ mặc định 1.3 – 1.36.3 (treo dài · ngăn kéo + treo · 6 đợt đều, thân dưới 2200) → GHIM lại; tủ mặc định mới thử ở khối "Tủ mặc định 1.36.4" (lõi nạp mới).
const KHOANG_MAC_DINH_CU = [
  { rong: 'auto', canh: 2, dot: [1800], o: [{ tu: 0, kieu: 'suot' }] },
  { rong: 'auto', canh: 2, dot: [520, 1800], o: [{ tu: 0, kieu: 'nk_am', so: 2 }, { tu: 520, kieu: 'suot' }] },
  { rong: 'auto', canh: 2, dot: [400, 750, 1100, 1450, 1800], o: [] },
];
const ghimTuCu = C => { C.DEFAULT_SPEC.khoang = JSON.parse(JSON.stringify(KHOANG_MAC_DINH_CU)); C.DEFAULT_SPEC.than.cao_duoi = 2200; return C; };
ghimTuCu(C0);
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
// (1.36.2) hậu mỏng ăn vào rãnh của tấm bên cạnh là đúng cấu tạo — bỏ cặp đó như phép dò va chạm của build (táp nay hậu soi rãnh; khối táp 1.36.2 kiểm riêng sâu ăn rãnh)
const coRanhT = q => q.holes && q.holes.some(h => h.kieu === 'ranh');
const overlapAny = (M) => { const out = []; for (let i = 0; i < M.parts.length; i++) for (let j = i + 1; j < M.parts.length; j++) { const a = M.parts[i], b = M.parts[j]; if ((a.mong && coRanhT(b)) || (b.mong && coRanhT(a))) continue; if (C.overlap(a, b) > 0) out.push(a.ten + '×' + b.ten); } return out; };
// hộp của một mẫu ngăn kéo (toạ độ thế giới): mặt + hộp
// Bản 1.33.1: anh Thanh chốt chuẩn bếp (mặt đá 860, tủ dưới thường cũng 2 giằng, tay nắm vát). Các khối bếp 1.33 đo với chuẩn 1.33.0 → GHIM số cũ cho từng bản lõi nạp mới;
// chuẩn mới có khối thử riêng ở cuối tệp.
const ghimBep133 = C => Object.assign(C.DEFAULT_BEP, { cao_mat: 850, noc: 'lien', tay_nam: 'noi' });
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
  ghimTuCu(C);      // (1.36.4) số đo khối này với thân dưới 2200 cũ (thân trên 200 của tủ 2400)
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
  eq(C0.THU_VIEN.map(x => x.loai), ['tu', 'tap', 'giuong', 'vach', 'bep'], 'thư viện: tủ áo, táp, giường, vách, bếp (1.34.1: một nhóm bếp 3 mục)');
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
  // vân: tấm giường / vách rộng hơn khổ 1220 (bề rộng Chenfeng) mà cao lọt khổ → Lines 1 (như hậu rộng của tủ); mọi tấm cắt được theo vân
  for (const [ma, sua] of [['G16-NK', s => s], ['G18-B', s => s], ['G12-T', s => s], ['V2800-1200 2 ô', s => { s.vach.so_o = 2; return s; }]]) {
    const s = sua(C0.apMau(D0, ma.split(' ')[0])), K = s.van.kho_rong, bs = C0.toChenfeng(C0.build(s)).json.ModelSpace.filter(o => o.Type === 'Board');
    const w = o => Math.max(...o.ContourCurve.map(q => q.pt[0])) - Math.min(...o.ContourCurve.map(q => q.pt[0])), h = o => Math.max(...o.ContourCurve.map(q => q.pt[1])) - Math.min(...o.ContourCurve.map(q => q.pt[1]));
    ok(bs.length && bs.every(o => !(o.Lines === 0 && w(o) > K + 0.01) && !(o.Lines === 1 && h(o) > K + 0.01)), `${ma}: vân đúng chiều khổ ván (không tấm nào phải xoay ngang vân mới cắt được)`, bs.filter(o => (o.Lines === 0 && w(o) > K) || (o.Lines === 1 && h(o) > K)).map(o => [o.Name, o.Lines, w(o), h(o)]));
  }
  { const s = C0.apMau(D0, 'G12-T'); s.giuong.kieu = 'bay'; s.rong = C0.phuBiGiuong(s, 900, 2000).rong; const W = s.rong;
    ok(!C0.build(s).warnings.length, `giường bay hẹp ${W}, lùi 150: không cảnh báo`); s.giuong.lui_de = 260; const w = C0.build(s).warnings.find(x => /dễ lật/.test(x));
    ok(w && new RegExp(`nên lùi ≤ ${Math.floor(W / 20) * 5}`).test(w), 'giường bay hẹp lùi 260: cảnh báo nêu mức lùi tối đa theo bề rộng (W / 4)', w); }
  { const s = C0.apMau(D0, 'V2800-1200'); s.rong = 2000; s.vach.so_o = 20; Object.assign(s.vach, C0.vachTuDong(s)); const e = C0.build(s).errors; ok(e.length === 1 && /hẹp quá so với bản xương .* giảm số ô \(≤ \d+\)/.test(e[0]), 'vách 2000 chia 20 ô (ô 95): lỗi ô hẹp quá, gợi ý số ô tối đa', e);
    const n = +e[0].match(/≤ (\d+)/)[1];
    for (const k of [n, n + 1]) { s.vach.so_o = k; Object.assign(s.vach, C0.vachTuDong(s)); const M = C0.build(s); ok(k === n ? !M.errors.length && !overlapAny(M).length && P(M, 'XU').every(p => Math.min(p.x1 - p.x0, p.z1 - p.z0) >= 50 - 0.01) : M.errors.some(x => /hẹp quá/.test(x)), `vách 2000 chia ${k} ô: ${k === n ? 'dựng được (mức gợi ý là đúng mức tối đa), không xương vụn' : 'hơn mức gợi ý một ô thì lỗi'}`, [M.errors, overlapAny(M).slice(0, 2)]); } }
  for (const [W, so] of [[1200, 8], [1200, 9], [2600, 16], [320, 2]]) { const s = C0.apMau(D0, 'V2600-1200'); s.rong = W; s.vach.so_o = so; Object.assign(s.vach, C0.vachTuDong(s)); const M = C0.build(s);
    ok(!M.errors.length && !overlapAny(M).length, `vách ${W} chia ${so} ô (kiểu lam): dựng được, không chồng xương`, M.errors); }
  { const s = C0.apMau(D0, 'V2800-1200'); s.vach.so_o = 12; const M = C0.build(s); ok(!overlapAny(M).length, 'số xương ghi sẵn cũ (của 4 ô) với 12 ô: không chồng xương', overlapAny(M).slice(0, 3)); }
  // vân: giường theo cạnh dài, không đổi khi module kéo qua mốc khổ 1220 (heSo khoá kích thước làm đổi vân)
  { const s = C0.apMau(D0, 'G12-T'), M = C0.build(s), h = C0.heSo(s), dg = X => X.parts.find(p => p.ten === 'Đầu giường').lines;
    ok(M.spec.rong < 1220 + 100 && [-120, 0, 120].every(d => { const s2 = JSON.parse(JSON.stringify(s)); s2.rong += d; return dg(C0.build(s2)) === 1; }) && h.bien.L, `giường ${M.spec.rong} kéo ±120 qua mốc khổ 1220: đầu giường vân ngang mọi cỡ, Rộng co giãn được`, [dg(M), h.ly_do]); }
  { const s = C0.apMau(D0, 'G12-T'); s.rong = C0.phuBiGiuong(s, 1100, 2000).rong; ok(!C0.heSo(s).bien.L, 'giường nệm 1100 (lòng 1120, sát ngưỡng đà giữa 1000): kéo hẹp 240 là mất đà → module khoá Rộng'); }
  { const s = C0.apMau(D0, 'V2800-1200'); s.rong = 2380; s.vach.so_o = 2; Object.assign(s.vach, C0.vachTuDong(s)); const h = C0.heSo(s), M = C0.build(s); ok(P(M, 'OP').every(p => p.lines === 0) && !h.bien.L && h.ly_do.L === 'khong_deu', 'vách 2 ô 1187,5 (sát khổ 1220): tấm ốp vân đứng; kéo Rộng là ô vượt khổ phải đổi vân → module khoá Rộng', h.ly_do); }
  { const s = C0.apMau(D0, 'V2800-1200'); s.rong = 780; s.vach.so_o = 0; Object.assign(s.vach, C0.vachTuDong(s)); const M = C0.build(s); ok(!M.errors.length && M.info.vach.so_o === 1 && !M.phu_kien.some(x => /Nẹp U/.test(x.ten)), 'vách 780 một ô: không có dòng nẹp U (0 cái)', M.phu_kien); }
  // kho mẫu: chữ "tab" chỉ khi đứng riêng
  eq(['Tableware', 'Portable', 'Stable', 'Tab', 'Tab đầu giường', 'Táp đầu giường'].map(C0.nhomThuMuc), ['khac', 'khac', 'khac', 'tu', 'tu', 'tu'], 'nhomThuMuc: "tab" là chữ riêng');
  eq(['Giường 1m6', 'Giường bay', '床', '双人床', 'Vách đầu giường', '背景墙', 'Táp đầu giường', 'Tab đầu giường', 'Tủ đầu giường', '床头柜', '床边柜', '背景墙柜', 'Kệ đầu giường', 'Tủ áo'].map(C0.khoKhongHau),
    [true, true, true, true, true, true, false, false, false, false, false, false, false, false], 'kho mẫu: giường / vách không phủ hậu; táp / tủ / 柜 đầu giường vẫn phủ hậu');
  eq(['Giường hộc kéo', 'Giường có kệ đầu giường', 'Hộc đầu giường', 'Bàn đầu giường', 'Đôn đầu giường', '床头几', '床边桌', 'Ngăn kéo gầm giường', '抽屉床', '儿童抽屉床', 'GH01 - Giường ngăn kéo 1m8', 'MN Giường hộc kéo', '床底抽屉', '床带抽屉', '子母床带抽屉', '床头柜带抽屉'].map(C0.khoKhongHau),
    [true, true, false, false, false, false, false, false, true, true, true, true, false, true, true, false], 'kho mẫu: danh từ chính — tiếng Việt đứng trước ("Giường hộc kéo"), tiếng Trung đứng sau ("抽屉床" giường, "床头柜" tủ)');
});

// Bản 1.33 — TỦ BẾP (anh Thanh: "tủ bếp chuẩn VN, lấy phụ kiện làm chuẩn", "chậu / bếp nấu 800 / 900, hút mùi 700 / 900", "phụ kiện chỉ Higold và Eurogold").
// Tủ bếp là một loại sản phẩm (`loai_sp: 'bep'`) đi bộ dựng tủ, rẽ nhánh theo `spec.bep`. Tủ áo / táp / giường / vách phải ra GIỐNG HỆT bản 1.32 (băm trong mau-cu-1.32.json,
// dựng bằng lõi e182fd7). Khối này nạp một bản lõi MỚI (không đụng bản đã ghim ở đầu tệp); số đo bếp dùng mặc định thật (hậu 6,5, chân 100), riêng kết cấu tủ áo đã ghim như các khối cũ.
T('Tủ áo / táp / giường / vách giữ nguyên từng byte so với bản 1.32 (bản 1.33)', () => {
  const k = require.resolve('../src/mncf-core.js'), cu = require.cache[k]; delete require.cache[k]; const C = require(k); require.cache[k] = cu;
  const H = require('./mau-cu.js'), F = require('./mau-cu-1.32.json');
  // (1.36.4 — "lỗ cam chốt hở ra ngoài rất xấu") tấm đứng lộ mặt trước nay giấu lỗ vào mặt trong (fd false / bd true, dấu giau_lo). Tệp băm là bản ghi 1.32 →
  // phép so trả các tấm mang dấu về fd / bd cũ (cả hai bật — bản ≤ 1.36.3 không tấm nào trong số đó khai khác) và bỏ dấu: ngoài cờ khoan mặt, không đổi gì khác.
  { const b0 = C.build; C.build = (...a) => { const M = b0(...a); for (const p of M.parts) if (p.giau_lo) { ok(p.fd === false && p.bd === true, 'giau_lo: fd false / bd true', p); delete p.giau_lo; p.fd = p.bd = true; } return M; }; }
  // (1.36.4) giường / vách mang theo khoang + thân của tủ đang mở (không dùng tới khi dựng): với tủ mặc định MỚI, phần dựng ra (tấm, bảng kê, dữ liệu Chenfeng, hình) vẫn y 1.32
  { const ds1 = H.dsMau(C), HINH = ['cut', 'csv', 'cf', 'goc', 'heso', 'phieu', 'tom', 'svg', 'h3d'];
    for (const [ma, s] of ds1.filter(x => /^(G|V)\d/.test(x[0]))) { const b = H.banGhi(C, s), f = F.mau[ma] || {}; const lech = HINH.filter(x => f[x] !== b[x]); ok(!lech.length, `${ma}: tủ mặc định mới không đổi gì phần dựng ra`, lech); } }
  ghimTuCu(C);      // tệp băm dựng với tủ mặc định 1.32 (= 1.36.3)
  // (1.36.4 — anh Thanh 16/10/2026: "thêm khoang thì khoang trống thôi nhiều đợt quá khó xử lý") mẫu tủ áo bỏ kiểu 'đợt đều': khoang đó nay TRỐNG. Tệp băm giữ nguyên
  // (là bản ghi của 1.32); phép so đặt lại đúng 5 đợt cũ vào đúng khoang đó → phải ra giống hệt 1.32 — tức là ngoài khoang trống, mẫu không đổi gì khác.
  const DOT_DEU_CU = { 'TA3-1500': [1], 'TA5-2500': [2], 'TA6-3000': [2], 'TA3-1500+khau': [1] };
  const ds = H.dsMau(C);
  eq(ds.map(x => x[0]), Object.keys(F.mau), 'cùng danh sách tủ đem so với tệp băm 1.32');
  for (const [ma, s0] of ds) {
    const s = JSON.parse(JSON.stringify(s0));
    for (const i of DOT_DEU_CU[ma] || []) { ok(!s.khoang[i].dot.length && !s.khoang[i].o.length, `${ma}: khoang ${i + 1} (đợt đều cũ) nay trống`, s.khoang[i]); s.khoang[i].dot = [450, 790, 1130, 1470, 1810]; s.khoang[i].o = []; }
    const b = H.banGhi(C, s), f = F.mau[ma] || {}; const lech = Object.keys(f).filter(x => f[x] !== b[x]); ok(!lech.length, `${ma}: giống hệt 1.32`, lech);
  }
});

T('Tủ bếp (bản 1.33)', () => {
  const k = require.resolve('../src/mncf-core.js'), cu = require.cache[k]; delete require.cache[k]; const C = require(k); require.cache[k] = cu;
  C.DEFAULT_SPEC.thung.noc_day = 'lot'; C.DEFAULT_SPEC.ngan_keo.khung_mat = 0;      // ghim như các khối cũ (tủ bếp tự ép 'lot'; khung mặt chỉ dùng cho hộc kéo âm của tủ áo)
  ghimBep133(C);      // (1.33.1) số đo của khối này là chuẩn bếp 1.33.0 (mặt đá 850, tủ dưới nóc liền, tay nắm nổi) — chuẩn anh chốt có khối riêng ở cuối
  const D = C.DEFAULT_SPEC, B0 = C.DEFAULT_BEP, ap = ma => JSON.parse(JSON.stringify(C.apMau(D, ma)));
  const loiBep = M => M.kq.filter(x => x.ma === 'bep' && x.muc === 'loi').map(x => x.t), canhBep = M => M.kq.filter(x => x.ma === 'bep' && x.muc === 'luu_y').map(x => x.t);
  const P2 = (M, l) => M.parts.filter(p => p.loai === l);
  // chuẩn bếp mặc định (thiết kế G1)
  eq([B0.ket_cau_chan, B0.noc, B0.cao_mat, B0.day_da, B0.chan, B0.sau_duoi, B0.sau_tren, B0.cao_tren, B0.cach_tren], ['hoi_san', 'lien', 850, 20, 100, 560, 350, 800, 700], 'DEFAULT_BEP: hồi xuống sàn, nóc liền, mặt đá 850, đá 20, chân 100, sâu 560 / 350, tủ trên cao 800 cách mặt đá 700');
  ok(!('bep' in D), 'DEFAULT_SPEC không có khoá bếp (tủ áo không mang thêm gì)');
  // phụ kiện bếp: chỉ Higold / Eurogold
  ok(C.LOAI_PK_BEP.length >= 8 && C.LOAI_PK_BEP.every(p => /Eurogold|Higold/.test(p.nguon) && !/Garis|H[aä]fele|Cariny|Blum/i.test(p.nguon)), 'LOAI_PK_BEP: nguồn chỉ Eurogold / Higold', C.LOAI_PK_BEP.map(p => [p.ma, p.nguon]));
  ok(C.LOAI_PK_BEP.every(p => p.co.length && p.co.every(c => { const [a, b] = p.lot(c); return a <= b && b < c; })), 'LOAI_PK_BEP: mỗi cỡ có dải lọt lòng hợp lệ');
  ok(['chau', 'bep', 'hm'].every(l => C.LOAI_TB_BEP[l] && C.LOAI_TB_BEP[l].length), 'LOAI_TB_BEP: chậu, bếp, hút mùi');
  // normalize
  ok(!('bep' in C.normalize(D)) && !('bep' in C.normalize({ bep: { tang: 'tren' } })), 'tủ áo không có khối bep (kể cả khi thông số lạ mang theo)');
  ok(!C.normalize({ loai_sp: 'bep_la' }).loai_sp, 'loai_sp lạ → tủ áo');
  { const s = ap('BD-NK3-600'), t = C.apMau(s, 'TA2-1000'), v = C.veTuAo(s); ok(!t.loai_sp && !t.bep && !v.loai_sp && !v.bep && !C.build(t).errors.length, 'bếp → tủ áo (mẫu tủ / veTuAo): bỏ khối bếp, dựng được', [t.loai_sp, C.build(t).errors]); }
  { const s = ap('BD-CHAU-800'); s.bep.noc = 'lien'; ok(C.normalize(s).bep.noc === 'giang', 'tủ chậu luôn giằng (lỗ khoét chậu cắt qua nóc)'); const b = ap('BD-BEP-900'); b.bep.noc = 'lien'; ok(C.normalize(b).bep.noc === 'giang', 'tủ bếp nấu luôn giằng'); }
  { const s = ap('TA2-1000'); s.khoang[0].o = [{ tu: 0, kieu: 'keo_pk', pk: ['xoong'] }, { tu: 0, kieu: 'nk_trum', so: 2, cao: [180] }]; const n = C.normalize(s); ok(n.khoang[0].o.length === 1 && !('cao' in n.khoang[0].o[0]), 'tủ áo: bỏ ô mặt kéo rổ và cao mặt riêng (chỉ của tủ bếp)', n.khoang[0].o); }
  // thư viện
  const MAU = [...C.MAU_BEP_DUOI, ...C.MAU_BEP_TREN, ...C.MAU_BEP_CAO];
  eq(C.THU_VIEN.filter(x => x.loai === 'bep').map(x => x.ds), [C.MAU_BEP_TV], 'thư viện (1.34.1): một nhóm bếp — Tủ bếp dưới / trên / cao; MAU_BEP_* chỉ còn cho Bộ bếp');
  for (const ma of ['BD-CHAU-800', 'BD-CHAU-900', 'BD-BEP-800', 'BD-BEP-900', 'BD-NK3-400', 'BD-NK3-600', 'BD-NK3-900', 'BD-XN-800', 'BD-GV-200', 'BD-GV-400', 'BD-GAO-300', 'BD-RAC-300', 'BD-RAC-400', 'BD-CANH-300', 'BD-CANH-900', 'BT-CANH-300', 'BT-CANH-800', 'BT-BAT-600', 'BT-BAT-900', 'BT-HM-800', 'BT-HM-950', 'BC-KHO-400', 'BC-KHO-450', 'BC-KHO-600'])
    ok(MAU.some(m => m.ma === ma), `có mẫu ${ma}`);
  for (const m of MAU) {
    const s = C.apMau(D, m.ma), M = C.build(s), B = s.bep, W = s.rong, hop = M.info.hop;
    const caoHop = { duoi: 830, tren: B.cao_rieng || B.cao_tren, cao: 2350 }[B.tang];      // mẫu H700 / H900: chiều cao riêng (cao_rieng), chuẩn Cao tủ trên giữ 800
    ok(s.loai_sp === 'bep' && B.tang === m.tang && !M.errors.length && !M.warnings.length, `${m.ma}: dựng được, không lỗi / cảnh báo`, [M.errors, M.warnings]);
    eq(overlapAny(M), [], `${m.ma}: không tấm nào đè nhau`);
    ok(!M.kq.some(x => x.ma === 'lien_ket'), `${m.ma}: tấm nào cũng có chỗ tì`);
    ok(C.phieu(M).dat && C.phieu(M).muc.some(x => x.ma === 'bep' && x.ket === 'dat'), `${m.ma}: phiếu kiểm đạt, có mục phụ kiện bếp`, C.phieu(M).muc.filter(x => x.ket !== 'dat' && x.ket !== 'khong').map(x => x.ma));
    ok(near(hop.x0, 0) && near(hop.x1, W) && near(hop.z0, 0) && near(hop.z1, caoHop) && near(hop.y1, s.sau_thung), `${m.ma}: hộp bao x 0…${W}, z 0…${caoHop}, sâu ${s.sau_thung}`, hop);
    const giang = P2(M, 'GIANG'), noc = P2(M, 'NOC');
    if (B.chuc_nang === 'chau' || B.chuc_nang === 'bep') ok(!noc.length && giang.length === 2 && giang.every(p => p.type === 2 && near(p.z1, caoHop) && near(p.z1 - p.z0, B0.giang_rong)), `${m.ma}: không nóc, đúng 2 giằng đứng cao ${B0.giang_rong} sát đỉnh thùng`, giang.map(box));
    else ok(noc.length && !giang.length, `${m.ma}: nóc liền`);
    if (B.chuc_nang === 'chau') ok(!P2(M, 'DOT').length && !P2(M, 'HAU').length, `${m.ma}: tủ chậu không đợt, không hậu`);
    if (B.chuc_nang === 'tl') ok(B.tb.tl.kieu === 'am' ? P2(M, 'CHAN').length > 0 : !P2(M, 'CHAN').length, `${m.ma}: ${B.tb.tl.kieu === 'am' ? 'tủ cao tủ lạnh âm có chân + đáy (bản 1.35)' : 'khoang tủ lạnh không xà chân (máy đứng sàn — bản 1.34)'}`);
    else if (B.tang !== 'tren') { const xc = P2(M, 'CHAN'); ok(xc.length && xc.every(p => near(p.y0, 50 - s.van.t_canh) && near(p.y1, 50) && near(p.z0, 0) && near(p.z1, 100) && p.ten === 'Xà chân'), `${m.ma}: xà chân lùi 50, cao 100`, xc.map(box)); }
    else ok(!P2(M, 'CHAN').length && P2(M, 'TREO').length === s.khoang.length && P2(M, 'TREO').every(p => near(p.z1, caoHop - s.van.t) && near(p.z1 - p.z0, 80)), `${m.ma}: tủ trên không chân, có thanh treo 80 sát nóc`, P2(M, 'TREO').map(box));
    if (B.tang === 'duoi') ok(M.da && near(M.da.z + M.da.day, B.cao_mat) && near(B.chan + (hop.z1 - B.chan) + B.van_lot + B.day_da, B.cao_mat) && near(M.da.day, 20), `${m.ma}: chân + thùng + đá = mặt đá ${B.cao_mat}`, M.da);
    else ok(!M.da, `${m.ma}: không có đá`);
    const cheOng = B.tb.hm && B.tb.hm.kieu === 'kinh';      // (1.33.1) tủ che ống hút mùi kính: thẳng đỉnh dãy tủ trên
    ok(M.info.bep && M.info.bep.tang === B.tang && M.info.bep.z_dat === (B.tang === 'tren' ? B.cao_mat + B.cach_tren + (cheOng ? B.cao_tren - s.cao : 0) : 0), `${m.ma}: info.bep (z đặt ${B.tang === 'tren' ? 1550 : 0})`, M.info.bep);
    if (B.tang === 'tren' && !cheOng) eq(M.info.bep.z_dat, 1550, `${m.ma}: tủ trên đặt ở z 1550`);
    // mô-đun Chenfeng co giãn được theo L / W / H; số tấm + số mặt giữ ở ±d, ±2d
    const h = C.heSo(s); ok(['L', 'W', 'H'].every(x => h.bien[x]), `${m.ma}: module co giãn L / W / H`, h.ly_do);
    for (const [kh, d] of [['rong', 60], ['rong', -60], ['rong', 120], ['sau_thung', 60], ['sau_thung', -60], ['cao', 60], ['cao', -60], ['cao', B.tang === 'cao' ? 60 : 120], ['cao', -120]]) {      // tủ cao 2350: +120 là hồi quá khổ 2440
      const s1 = JSON.parse(JSON.stringify(s)); s1[kh] += d; const M1 = C.build(s1);
      ok(M1.parts.length === M.parts.length && M1.mat_ngan_keo.length === M.mat_ngan_keo.length && M1.kq.every(x => x.muc !== 'loi' || x.ma === 'bep'), `${m.ma}: ${kh} ${d > 0 ? '+' : ''}${d} giữ số tấm + số mặt`, [M1.parts.length, M.parts.length, M1.errors]);
    }
    eq(C.vuaKhoVan(s).doi, [], `${m.ma}: vừa khổ ván không đụng tủ bếp`);
    ok(M.phu_kien && C.cutList(M).phu_kien.filter(x => x.bep).every(x => !/Garis|H[aä]fele|Cariny|Blum/i.test(x.ten + ' ' + (x.ghi_chu || ''))), `${m.ma}: phụ kiện bếp không ghi hãng ngoài Higold / Eurogold`);
  }
  // NK3: mặt trên cùng 180, đổi H mặt 180 giữ nguyên
  { const s = ap('BD-NK3-600'), M = C.build(s), mt = M.mat_ngan_keo.slice().sort((a, b) => b.z - a.z);
    ok(mt.length === 3 && near(mt[0].h, 180) && near(mt[1].h, mt[2].h, 0.6), 'BD-NK3-600: 3 mặt, mặt trên cùng 180, hai mặt dưới chia đều', mt.map(q => q.h));
    for (const d of [-120, 120]) { const s1 = JSON.parse(JSON.stringify(s)); s1.cao += d; const m1 = C.build(s1).mat_ngan_keo.slice().sort((a, b) => b.z - a.z); ok(near(m1[0].h, 180), `BD-NK3-600 cao ${d > 0 ? '+' : ''}${d}: mặt trên cùng vẫn 180`, m1.map(q => q.h)); }
    const kh = C.keHoachGoc(s); ok(!kh.loi.length && kh.nk.length === 1 && kh.nk[0].cao && kh.nk[0].cao.length === 3 && near(kh.nk[0].cao[2], 180), 'BD-NK3-600 lệnh gốc: một bước DRAWER, cao từng ô (khoá cao mặt 180)', kh.nk.map(b => b.cao)); }
  // tủ chậu: mọi tấm thùng dán cạnh 4 mép; ván chống ẩm
  { const s = ap('BD-CHAU-800'); s.bep.van_chau = 'MDF chống ẩm'; const M = C.build(s), bs = C.toChenfeng(M).json.ModelSpace.filter(o => o.Type === 'Board');
    ok(bs.length && bs.every(o => ['UpSealed', 'DownSealed', 'LeftSealed', 'RightSealed'].every(e => o[e] === s.van.dan_canh)), 'tủ chậu: mọi tấm dán cạnh đủ 4 mép (cả mép khuất — ẩm ngấm cạnh ván)', bs.map(o => [o.Name, o.UpSealed]));
    ok(bs.every(o => (/^(Cánh|Xà chân)/.test(o.Name) ? o.BrMatName === '' : o.BrMatName === 'MDF chống ẩm')), 'tủ chậu: thùng ván chống ẩm, mặt cánh / xà chân giữ ván mặt', bs.map(o => [o.Name, o.BrMatName]));
    const pk = C.cutList(M).phu_kien; ok(pk.some(x => /Ke góc/.test(x.ten) && x.sl === 2) && pk.some(x => /nhôm lót đáy/i.test(x.ten)), 'tủ chậu: 2 ke góc + nhôm lót đáy', pk.map(x => x.ten)); }
  // CHẬU theo kiểu lắp
  const chau = (ma, rong, opt) => { const s = ap(ma); s.rong = rong; s.bep.tb.chau = Object.assign({ ma: opt.ma }, opt.them || {}); return C.build(s); };
  ok(loiBep(chau('BD-CHAU-800', 800, { ma: 'duong_820' })).some(t => /tủ 900/.test(t)), 'chậu dương 820 (khoét 795) trong tủ 800: LỖI, gợi ý tủ 900', loiBep(chau('BD-CHAU-800', 800, { ma: 'duong_820' })));
  { const M = chau('BD-CHAU-900', 900, { ma: 'duong_820' }); ok(!M.errors.length && !canhBep(M).length, 'chậu dương 820 trong tủ 900: sạch', [M.errors, M.warnings]); }
  ok(loiBep(chau('BD-CHAU-800', 800, { ma: 'am_780' })).length > 0, 'chậu âm 780 trong tủ 800 (cần lọt 800 > 765): LỖI');
  ok(loiBep(chau('BD-CHAU-900', 900, { ma: 'am_870' })).some(t => /tủ 1000/.test(t)), 'chậu âm 870 trong tủ 900: LỖI, gợi ý tủ 1000');
  eq([['chau', 'duong_820'], ['chau', 'am_780'], ['chau', 'am_870'], ['chau', 'don_600'], ['bep', 'doi_730'], ['hm', 'am_700'], ['hm', 'am_900']].map(([l, ma]) => C.coTuChoTB(Object.assign({ loai: l }, C.LOAI_TB_BEP[l].find(x => x.ma === ma)))),
    [900, 900, 1000, 700, 800, 800, 950], 'coTuChoTB: tủ theo thiết bị (bảng B6) — (1.35) có cỡ 700: chậu dương đơn 600 vào tủ 700');
  eq(C.coTuChoTB({ loai: 'bep', khoet: [800, 480] }), 900, 'coTuChoTB: bếp khoét 800 → tủ 900');
  { const s = ap('BD-CHAU-900'); s.bep.tb.chau = { ma: 'duong_820', cach_mep_truoc: 40 }; ok(loiBep(C.build(s)).some(t => /giằng trước/.test(t)), 'khoét chậu cách mép trước đá 40: chạm giằng trước → LỖI', loiBep(C.build(s))); }
  { const s = ap('BD-BEP-800'); s.bep.tb.bep = { ma: 'doi_730', cach_mep_truoc: 40 }; ok(loiBep(C.build(s)).some(t => /giằng trước/.test(t)), 'khoét bếp sát mép trước: chạm giằng → LỖI'); s.bep.tb.bep = { ma: 'doi_730' }; ok(!C.build(s).errors.length, 'khoét bếp đặt giữa đá: sạch'); }
  // RỔ: lọt lòng phải nằm trong dải của phụ kiện
  // dải Higold / Eurogold nhận lọt lòng cỡ − 38 … cỡ − 32 (EA300 W262–268): ván 16 / 17 / 17,5 / 18 đều lọt, ván 15 / 25 thì không
  for (const t of [16, 17, 17.5, 18]) { const s = ap('BD-XN-800'); s.van.t = t; const M = C.build(s); ok(!M.errors.length && !canhBep(M).length, `rổ 764 trong tủ 800, ván ${t}: sạch`, [M.errors, M.warnings]); }
  { const s = ap('BD-XN-800'); s.rong = 650; const M = C.build(s); ok(canhBep(M).some(t => /cỡ/.test(t)) && loiBep(M).length, 'tủ rổ 650 (không có cỡ rổ này): cảnh báo cỡ + LỖI dải lọt lòng', [loiBep(M), canhBep(M)]); }
  for (const t of [15, 25]) { const s = ap('BD-XN-800'); s.van.t = t; ok(loiBep(C.build(s)).length > 0, `rổ trong tủ 800 ván ${t}: LỖI lọt lòng`); }
  { const s = ap('BD-RAC-300'); s.van.t = 15; ok(loiBep(C.build(s)).some(t => /270/.test(t)), 'thùng rác 300 lọt 270 (> 268): LỖI cận trên', loiBep(C.build(s))); }
  // HÚT MÙI
  { const M = C.build(ap('BT-HM-800')); ok(!M.errors.length && !M.warnings.length && !P2(M, 'HAU').length, 'hút mùi âm 700 (loại hộp) trong tủ trên 800: sạch, không hậu', [M.errors, M.warnings]); }
  { const s = ap('BT-HM-800'); s.rong = 900; s.bep.tb.hm = { ma: 'am_900' }; ok(loiBep(C.build(s)).some(t => /950/.test(t)), 'hút mùi âm 900 trong tủ 900: LỖI, gợi ý tủ 950', loiBep(C.build(s))); }
  for (const [sau, loi] of [[330, false], [345, true]]) { const s = ap('BT-HM-800'); s.bep.tb.hm = { ma: 'tu_chon', sau }; ok(!!loiBep(C.build(s)).length === loi, `máy hút mùi sâu ${sau} trong tủ trên sâu 350 (không hậu): ${loi ? 'LỖI' : 'sạch'}`, loiBep(C.build(s))); }
  { const s = ap('BT-HM-800'); s.bep.tb.bep = { ma: 'doi_730' }; ok(!canhBep(C.build(s)).some(t => /hẹp/.test(t)), 'bếp 730 + hút mùi 700: không cảnh báo hẹp'); }
  { const s = ap('BT-HM-800'); s.bep.bep_loai = 'gas'; s.bep.cach_tren = 700; ok(canhBep(C.build(s)).some(t => /750/.test(t)), 'bếp gas + tủ trên cách mặt đá 700: cảnh báo khoảng cách, gợi ý 750', canhBep(C.build(s))); }
  // GIÁ BÁT NÂNG HẠ
  for (const [cao, loi] of [[650, true], [700, false]]) { const s = ap('BT-BAT-800'); s.bep.pk = 'bat_tren_nh'; s.cao = cao; const M = C.build(s); ok(!!loiBep(M).length === loi && (loi || !M.errors.length), `giá bát nâng hạ trong tủ trên cao ${cao}: ${loi ? 'LỖI' : 'sạch'}`, [loiBep(M), M.errors]); }
  // datBep: chuẩn bếp → kích thước module
  { const s = C.datBep(ap('BD-NK3-600'), { cao_mat: 860 }); ok(s.cao === 840 && s.bep.cao_mat === 860 && !C.build(s).errors.length, 'datBep: mặt đá 860 → tủ dưới cao 840', [s.cao, s.bep.cao_mat]); }
  { const s = C.datBep(ap('BT-CANH-800'), { cao_tren: 900, cach_tren: 750 }); ok(s.cao === 900 && C.build(s).info.bep.z_dat === 1600, 'datBep: tủ trên cao 900, cách mặt đá 750 → đặt ở z 1600', [s.cao, C.build(s).info.bep]); }
  { const s = ap('BD-NK3-600'); s.cao = 840; ok(C.normalize(s).bep.cao_mat === 860, 'module đổi Cao (ô Thông số của Chenfeng) → mặt đá tính lại theo Cao'); }
  // LỆNH GỐC: tủ trên / cao / ngăn kéo / cánh nóc liền vẽ được; chậu / bếp nấu / hút mùi rơi về nhập tấm
  for (const ma of ['BT-CANH-800', 'BC-KHO-600', 'BD-NK3-600', 'BD-CANH-600', 'BD-XN-800']) {
    const kh = C.keHoachGoc(ap(ma)), lenh = new Set(kh.buoc.map(b => b.lenh)), con = new Set((kh.con_lai || []).map(p => p.loai)), M = kh.M;
    ok(!kh.loi.length && ['LR', 'TB', 'BE'].every(l => lenh.has(l)) && (!P2(M, 'CANH').length || lenh.has('DO')), `${ma}: lệnh gốc được (LR / TB / BE${P2(M, 'CANH').length ? ' / DO' : ''})`, [kh.loi, [...lenh]]);
    for (const l of ['CHAN', 'TREO', 'MKP']) if (P2(M, l).length) ok(con.has(l), `${ma}: ${l} nằm trong phần nhập thêm vào module mẹ`);
  }
  { const kh = C.keHoachGoc(ap('BC-KHO-400')), d = kh.buoc.find(b => b.lenh === 'DO'); ok(d && kh.M.parts[d.kep[2]].loai === 'DOT' && d.ext.duoi > 0 && d.ext.duoi < 20, 'BC-KHO-400 (kéo): cánh trên kẹp vào đợt ngay dưới nó (không kẹp đáy rồi hở vào 1800)', d && [kh.M.parts[d.kep[2]].ten, d.ext]); }
  for (const ma of ['BD-CHAU-800', 'BD-BEP-900', 'BT-HM-800']) ok(C.keHoachGoc(ap(ma)).loi.length > 0, `${ma}: chưa có lệnh gốc (giằng / không hậu / hút mùi) → nhập tấm`);
  // BẢNG KÊ: đá là việc gia công riêng, không phải tấm ván
  { const M = C.build(ap('BD-CHAU-900')), cl = C.cutList(M), da = cl.gia_cong_da || [];
    ok(da.length === 1 && /khoét chậu/.test(da[0].ghi_chu) && /tâm cách mép trái 450/.test(da[0].ghi_chu), 'gia công đá: mặt đá + khoét chậu đúng tâm module', da);
    ok(!cl.rows.some(r => /Mặt đá|^Đá( |$)/.test(r.ten)) && cl.rows.every(r => r.nhom !== 'Đá'), 'bảng ván không có dòng đá');
    ok(/Gia công đá/.test(C.cutListCSV(M)) && /Phụ kiện bếp/.test(C.cutListCSV(M)), 'CSV: mục Gia công đá + Phụ kiện bếp'); }
  { const pk = C.cutList(C.build(ap('BD-XN-800'))).phu_kien.filter(x => x.bep); ok(pk.some(x => /bát đĩa/i.test(x.ten) && /Eurogold/.test(x.ten)) && pk.some(x => /xoong/i.test(x.ten)), 'tủ xoong: kê giá bát + giá xoong (Eurogold)', pk); }
  for (const [ma, so] of [['BT-CANH-800', 2], ['BT-HM-950', 3]]) { const v = C.cutList(C.build(ap(ma))).phu_kien.find(x => /[Vv]ít nở/.test(x.ten)); ok(v && v.sl === so, `${ma}: ${so} vít nở treo tủ`, v); }
  { const M = C.build(ap('BD-XN-800')); ok(C.cutList(M).rows.some(r => /Mặt ngăn kéo \(rổ/.test(r.ten) && /bắt vít vào rổ/.test(r.ghi_chu)), 'mặt kéo rổ: ghi cách bắt vít vào rổ'); }
  // nhóm màu
  eq(C.nhomMau([{ ten: 'Xà chân' }, { ten: 'Giằng trước' }, { ten: 'Thanh treo' }, { ten: 'Mặt ngăn kéo (rổ giá xoong nồi)' }]), ['mat', 'thung', 'thung', 'mat'], 'nhóm màu: xà chân + mặt kéo rổ là mặt, giằng + thanh treo là thùng');
  ok(!C.vuaKhoVan(ap('BD-CANH-900')).doi.length, 'vừa khổ ván trả sớm cho tủ bếp');
  ok(/<svg/.test(C.hinh3D(C.build(ap('BD-CHAU-900')))) && (C.build(ap('BD-CHAU-900')).khoi_phu || []).length === 1, 'hình 3D: đá là khối phụ (không phải tấm)');
});

// Vòng soát đối kháng 1.33 (lõi): mỗi phép thử ứng với một lỗi đã xác nhận.
T('Tủ bếp — sửa theo vòng soát 1.33', () => {
  const k = require.resolve('../src/mncf-core.js'), cu = require.cache[k]; delete require.cache[k]; const C = require(k); require.cache[k] = cu;
  C.DEFAULT_SPEC.thung.noc_day = 'lot'; C.DEFAULT_SPEC.ngan_keo.khung_mat = 0;
  ghimBep133(C);      // (1.33.1) số đo của khối này là chuẩn bếp 1.33.0 (mặt đá 850, tủ dưới nóc liền, tay nắm nổi) — chuẩn anh chốt có khối riêng ở cuối
  const D = C.DEFAULT_SPEC, ap = (ma, tu) => JSON.parse(JSON.stringify(C.apMau(tu || D, ma)));
  const loiBep = M => M.kq.filter(x => x.ma === 'bep' && x.muc === 'loi').map(x => x.t);
  // #0 / #9 / #14: ghé tủ bếp không đổi chuẩn nóc / đáy của xưởng (tủ bếp tự dựng 'lot' ngay trong bộ dựng)
  { const s = C.normalize({ thung: { noc_day: 'phu_hoi' } });
    for (const ma of ['BD-CANH-600', 'BD-CHAU-800', 'BT-CANH-600', 'BC-KHO-600']) {
      const b = C.apMau(s, ma), t = C.apMau(b, 'TA2-1000'), t2 = C.apMau(b, 'TA4-2000');
      ok(b.thung.noc_day === 'phu_hoi' && t.thung.noc_day === 'phu_hoi' && t2.thung.noc_day === 'phu_hoi', `${ma}: phủ hồi → tủ bếp → tủ áo vẫn phủ hồi`, [b.thung.noc_day, t.thung.noc_day]);
      ok(JSON.stringify(C.build(b).parts) === JSON.stringify(C.build(C.apMau(C.normalize({ thung: { noc_day: 'lot' } }), ma)).parts), `${ma}: tủ bếp vẫn dựng nóc / đáy lọt khi chuẩn xưởng là phủ hồi`);
      ok(!C.keHoachGoc(b).loi.some(l => /phủ hồi/.test(l)), `${ma}: lệnh gốc không chặn tủ bếp vì chuẩn phủ hồi`);
    }
    ok(JSON.stringify(C.build(C.apMau(C.apMau(s, 'BD-CANH-600'), 'TA2-1000')).parts) === JSON.stringify(C.build(C.apMau(s, 'TA2-1000')).parts), 'tủ áo sau khi ghé tủ bếp dựng y như không ghé'); }
  // #2: giá bát cố định trong tủ trên sâu 320 (sâu chuẩn VN) lọt; tủ quá nông vẫn báo
  { const s = ap('BT-BATCD-600'); s.sau_thung = 320; const M = C.build(s); ok(!M.errors.length, 'giá bát cố định trong tủ trên sâu 320: không lỗi', M.errors); }
  { const s = ap('BT-BATCD-600'); s.sau_thung = 280; ok(loiBep(C.build(s)).some(t => /Giá bát đĩa cố định/.test(t)), 'giá bát cố định trong tủ trên sâu 280: LỖI', loiBep(C.build(s))); }
  { const s = ap('BT-BAT-800'); s.bep.pk = 'bat_tren_nh'; s.cao = 700; s.sau_thung = 320; ok(loiBep(C.build(s)).some(t => /nâng hạ/.test(t)), 'giá bát nâng hạ vẫn cần sâu lọt lòng ≥ 300'); }
  // #3 / #7 / #17: Cao gõ cho tủ cao không mất khi sửa ô khác của Tủ bếp; đổi chuẩn chiều cao thì tính lại
  { let s = ap('BC-KHO-600'); s.cao = 2400; s = C.normalize(s); eq(s.cao, 2400, 'tủ cao gõ Cao 2400');
    for (const doi of [{ len_lui: 60 }, { chan: 120 }, { day_da: 30 }, { tb: {} }, { nk_nong: 200 }]) eq(C.datBep(s, doi).cao, 2400, `tủ cao 2400 → datBep(${JSON.stringify(doi)}) giữ Cao 2400`);
    eq(C.datBep(C.datBep(s, { chan: 120 }), { len_lui: 40 }).cao, 2400, 'sửa hai lần liền vẫn giữ');
    eq(C.datBep(s, { cao_tren: 700 }).cao, 2250, 'đổi Cao tủ trên (chuẩn) → tủ cao tính lại theo chuẩn');
    eq(C.datBep(s, { cach_tren: 650 }).cao, 2300, 'đổi Cách mặt đá → tủ cao tính lại');
    ok(C.datBep(s, { len_lui: 60 }).bep.cao_tren === 800, 'Cao gõ của tủ cao không ghi đè chuẩn Cao tủ trên'); }
  { const M = C.build(C.datBep(ap('BC-KHO-600'), { cao_tren: 900 })); ok(M.errors.some(e => /khổ ván/.test(e)) && !M.errors.some(e => /cao thân dưới/.test(e)), 'tủ cao vượt khổ: lời khuyên theo ô của tủ bếp (không bảo giảm "cao thân dưới" đã bị khoá)', M.errors); }
  // #18: số ngoài khoảng bị kẹp TRƯỚC khi tính kích thước — ô và module khớp nhau
  { const s = C.datBep(ap('BD-CANH-600'), { day_da: 300 }); ok(s.bep.day_da === 80 && s.bep.cao_mat === 850 && s.cao === 770, 'đá dày 300 → kẹp 80, mặt đá giữ 850, tủ 770', [s.bep.day_da, s.bep.cao_mat, s.cao]); }
  { const s = C.datBep(ap('BD-NK3-600'), { cao_mat: 1500 }); ok(s.bep.cao_mat === 1100 && s.cao === 1080, 'mặt đá 1500 → kẹp 1100, tủ 1080', [s.bep.cao_mat, s.cao]); }
  { const s = C.datBep(ap('BT-CANH-600'), { cao_tren: 5000 }); ok(s.bep.cao_tren === 1200 && s.cao === 1200, 'tủ trên cao 5000 → kẹp 1200', [s.bep.cao_tren, s.cao]); }
  { const s = C.datBep(ap('BD-CANH-600'), { chan: 120, cao_mat: 860, day_da: 30 }); const t = C.datBep(s, {}); ok(t.cao === s.cao && t.bep.cao_mat === 860 && t.bep.day_da === 30 && t.bep.chan === 120, 'số gõ trong khoảng đi một vòng không đổi', [t.cao, t.bep]); }
  // #4: dòng bản lề của tủ bếp không ghi hãng ngoài Higold / Eurogold; tủ áo giữ Kolity K53 mặc định
  for (const ma of ['BD-CHAU-900', 'BT-CANH-600', 'BC-KHO-600']) {
    const pk = C.cutList(C.build(ap(ma))).phu_kien, bl = pk.find(x => /Bản lề/.test(x.ten));
    ok(bl && /Higold|Eurogold/.test(bl.ten) && !/Kolity|Imundex/i.test(bl.ten + ' ' + bl.ghi_chu), `${ma}: dòng bản lề là Higold / Eurogold`, bl);
  }
  { const pk = C.cutList(C.build(ap('TA2-1000'))).phu_kien.find(x => /Bản lề/.test(x.ten)); ok(D.canh.loai_ban_le === 'k53' && pk && /Kolity K53/.test(pk.ten), 'tủ áo: bản lề mặc định vẫn Kolity K53', pk); }
  ok(C.LOAI_BAN_LE.some(l => /Higold/.test(l.ten) && /Eurogold/.test(l.ten) && /CĐ/.test(l.ten + l.nguon)), 'LOAI_BAN_LE có loại Higold / Eurogold ghi [CĐ]');
  // #5 / #11: ván lót đá là tấm thật
  { const s = C.datBep(ap('BD-BEP-800'), { van_lot: 15 }), M = C.build(s), L = M.parts.filter(p => /Ván lót đá/.test(p.ten));
    ok(L.length === 1 && L[0].type === 0 && near(L[0].z0, s.cao) && near(L[0].z1, s.cao + 15) && near(L[0].t, 15) && near(L[0].x0, 0) && near(L[0].x1, s.rong), 'van_lot 15 → một tấm "Ván lót đá" dày 15 nằm trên thùng, ngay dưới đá', L.map(box));
    ok(near(M.da.z, L[0].z1), 'đá nằm trên ván lót');
    ok(!M.errors.length && !M.warnings.length && C.phieu(M).dat, 'tủ bếp nấu có ván lót: không lỗi / cảnh báo', [M.errors, M.warnings]);
    ok(['L', 'W', 'H'].every(x => C.heSo(s).bien[x]), 'tủ có ván lót: module vẫn co giãn L / W / H');
    ok(C.cutList(M).rows.some(r => /Ván lót đá/.test(r.ten)), 'bảng cắt có ván lót đá');
    ok(C.toChenfeng(M).json.ModelSpace.some(o => o.Type === 'Board' && /Ván lót đá/.test(JSON.stringify(o))), 'ván lót đá vào lệnh nhập Chenfeng'); }
  { const M = C.build(C.datBep(ap('BD-CANH-600'), { van_lot: 17.5 })); ok(M.parts.some(p => p.ten === 'Ván lót đá' && near(p.z0, 812.5) && near(p.z1, 830)) && !M.errors.length, 'van_lot 17,5: tấm ở z 812,5 – 830', M.errors); }
  ok(!C.build(ap('BD-BEP-800')).parts.some(p => /lót/i.test(p.ten)), 'van_lot 0: không có ván lót');
  // #6: chiều cao riêng của mẫu H700 / H900 không thành chuẩn cho mẫu sau
  { const a = C.apMau(D, 'BT-CANH-600-H700'); eq(a.cao, 700, 'mẫu H700 cao 700');
    eq(C.apMau(a, 'BT-CANH-600').cao, 800, 'H700 → BT-CANH-600: cao 800 theo danh mục');
    eq(C.apMau(a, 'BT-HM-800').cao, 800, 'H700 → BT-HM-800: cao 800');
    const c = C.apMau(C.apMau(D, 'BT-CANH-600-H900'), 'BC-KHO-600'); ok(c.cao === 2350 && !C.build(c).errors.length, 'H900 → tủ cao: 2350, không lỗi', [c.cao, C.build(c).errors]);
    eq(C.normalize(a).cao, 700, 'mẫu H700 normalize giữ 700');
    eq(C.datBep(a, { chan: 0, len_lui: 30 }).cao, 700, 'mẫu H700: sửa ô khác giữ 700');
    eq(C.apMau(C.datBep(C.apMau(D, 'BT-CANH-600'), { cao_tren: 750 }), 'BT-CANH-800').cao, 750, 'chuẩn Cao tủ trên người dùng đặt vẫn đi theo mẫu sau'); }
  // #10: rổ tính theo khoang chứa nó
  { const s = ap('BD-XN-900'); s.khoang = [{ rong: 'auto', canh: 1, dot: [], o: [] }, { rong: 600, canh: 0, dot: [], o: [{ tu: 0, kieu: 'keo_pk', pk: ['xoong'] }] }];
    const M = C.build(C.normalize(s)), pk = C.cutList(M).phu_kien.filter(x => x.bep);
    ok(!loiBep(M).some(t => /cỡ 900/.test(t)), 'rổ trong khoang 600 của tủ 900: không đòi rổ cỡ 900', loiBep(M));
    ok(pk.some(x => /Giá xoong nồi cỡ 600/.test(x.ten)) && !pk.some(x => /cỡ 900/.test(x.ten)), 'bảng kê: giá xoong cỡ 600', pk.map(x => x.ten)); }
  { const s = ap('BC-KHO-600'); s.khoang = [{ rong: 'auto', canh: 1, dot: [], o: [] }, s.khoang[0]]; const M = C.build(C.normalize(s)); ok(loiBep(M).some(t => /đồ khô/.test(t)) && !loiBep(M).some(t => /cỡ 600/.test(t)), 'tủ cao chia 2 khoang: báo rổ theo cỡ của khoang, không theo cỡ tủ 600', loiBep(M)); }
});

// Vòng soát đối kháng 1.33 lần 2 (lõi): mỗi khối ứng với một lỗi đã xác nhận (#số = chỉ số trong danh sách soát).
T('Tủ bếp — sửa theo vòng soát 1.33 lần 2', () => {
  const k = require.resolve('../src/mncf-core.js'), cu = require.cache[k]; delete require.cache[k]; const C = require(k); require.cache[k] = cu;
  C.DEFAULT_SPEC.thung.noc_day = 'lot'; C.DEFAULT_SPEC.ngan_keo.khung_mat = 0;
  ghimBep133(C);      // (1.33.1) số đo của khối này là chuẩn bếp 1.33.0 (mặt đá 850, tủ dưới nóc liền, tay nắm nổi) — chuẩn anh chốt có khối riêng ở cuối
  const D = C.DEFAULT_SPEC, ap = ma => JSON.parse(JSON.stringify(C.apMau(D, ma)));
  const loiBep = M => M.kq.filter(x => x.ma === 'bep' && x.muc === 'loi').map(x => x.t), canhBep = M => M.kq.filter(x => x.ma === 'bep' && x.muc === 'luu_y').map(x => x.t);
  const PK = ma => C.LOAI_PK_BEP.find(p => p.ma === ma), P2 = (M, l) => M.parts.filter(p => p.loai === l);
  // #0: tủ đồ khô — 400 kéo (Eurogold M030640, mặt kéo bắt vào rổ); 450 / 600 là rổ CÁNH MỞ (Higold 202273, Eurogold EPL80645 / EP80660): ô dưới có cánh + bản lề
  { const keo = PK('kho'), canh = PK('kho_canh');
    ok(keo && keo.lap === 'keo' && JSON.stringify(keo.co) === '[400]' && /M030640/.test(keo.nguon) && keo.hang === 'Eurogold', 'kho (kéo): chỉ cỡ 400, Eurogold M030640', keo);
    ok(canh && canh.lap === 'canh' && JSON.stringify(canh.co) === '[450,600]' && /202273/.test(canh.nguon) && /EPL80645/.test(canh.nguon) && /EP80660/.test(canh.nguon) && canh.cao_ro >= 1825 && canh.cao_min >= 1825, 'kho_canh: cỡ 450 / 600, Higold 202273 + Eurogold EPL80645 / EP80660, cao theo rổ cao nhất (Higold 1825)', canh);
    ok(!/201106|201149|201146/.test(canh.nguon) && !/202273|EP80660|EPL80645/.test(keo.nguon.replace(/[^;]*không lọt[^;]*/g, '')), 'mỗi kiểu chỉ nêu hàng lắp được kiểu đó', [keo.nguon, canh.nguon]); }
  { const M = C.build(ap('BC-KHO-400')), r = M.info.bep.ro[0], pk = C.cutList(M).phu_kien.filter(x => x.bep);
    ok(r.pk === 'kho' && P2(M, 'MKP').length === 1 && !M.errors.length, 'BC-KHO-400: rổ kéo, một mặt kéo bắt vào rổ', [r, M.errors]);
    ok(pk.some(x => /đồ khô kéo cỡ 400/.test(x.ten) && /Eurogold/.test(x.ten) && /mặt kéo bắt vít/.test(x.ghi_chu)), 'BC-KHO-400: dòng phụ kiện tủ đồ khô kéo Eurogold', pk.map(x => x.ten + ' | ' + x.ghi_chu)); }
  for (const w of [450, 600]) {
    const ma = `BC-KHO-${w}`, s = ap(ma), M = C.build(s), r = M.info.bep.ro[0], canh = P2(M, 'CANH').sort((a, b) => a.z0 - b.z0), pk = C.cutList(M).phu_kien.filter(x => x.bep);
    ok(/cánh mở/.test(C.apMau(D, ma).ten) && !/kéo/.test(C.apMau(D, ma).ten), `${ma}: tên mẫu "cánh mở"`, C.apMau(D, ma).ten);
    ok(r.pk === 'kho_canh' && r.z1 - r.z0 >= 1835 - 0.01 && !M.errors.length && !M.warnings.length, `${ma}: ô rổ cao ≥ 1835 (Higold 1825 lọt), không lỗi`, [r, M.errors, M.warnings]);
    ok(!P2(M, 'MKP').length && canh.length === 2, `${ma}: không mặt kéo; 2 cánh (dưới che rổ, trên che ô đợt)`, canh.map(box));
    ok(canh[0].z0 < r.z0 + 20 && canh[0].z1 > r.z1 - 20 && canh[0].ban_le && canh[0].ban_le.so >= 4 && canh[1].z0 > r.z1, `${ma}: cánh dưới phủ hết ô rổ, ≥ 4 bản lề`, [box(canh[0]), canh[0].ban_le]);
    ok(pk.some(x => /đồ khô cánh mở cỡ/.test(x.ten) && /cánh mở/.test(x.ghi_chu) && !/mặt kéo bắt vít/.test(x.ghi_chu)), `${ma}: dòng phụ kiện tủ đồ khô cánh mở (không "mặt kéo bắt vít")`, pk.map(x => x.ten + ' | ' + x.ghi_chu));
    ok(!C.cutList(M).rows.some(r2 => /Mặt ngăn kéo \(rổ/.test(r2.ten)), `${ma}: bảng cắt không có mặt kéo rổ`);
    const kh = C.keHoachGoc(s), dO = kh.buoc.filter(b => b.lenh === 'DO');
    ok(!kh.loi.length && dO.length === 2 && dO.every(d => Math.abs(d.ext.duoi) < 20 && Math.abs(d.ext.tren) < 20), `${ma}: lệnh gốc — mỗi cánh một lệnh DOOR kẹp vào tấm nằm sát nó`, [kh.loi, dO.map(d => d.ext)]);
    // ô rổ thấp hơn rổ Higold → LỖI
    const s2 = ap(ma); s2.khoang[0].dot = [1900]; ok(loiBep(C.build(C.normalize(s2))).some(t => /đồ khô cánh mở/.test(t) && /1835/.test(t)), `${ma}: đợt hạ xuống 1900 (ô 1782,5) → LỖI rổ không lọt`, loiBep(C.build(C.normalize(s2))));
  }
  { const s = ap('BC-KHO-400'); s.khoang[0].dot = []; ok(canhBep(C.build(C.normalize(s))).some(t => /2200/.test(t)), 'BC-KHO-400 bỏ đợt (ô 2215 > 2200): cảnh báo khung rổ kéo không với tới', canhBep(C.build(C.normalize(s)))); }
  // #1 / #8: giá bát dưới cao 210 (Higold) — tủ bếp nấu mặc định rổ lọt dưới giằng; nâng mặt lên thì báo
  { const p = PK('bat_duoi'); ok(p.cao_ro === 210 && p.cao_min === 220, 'bat_duoi: rổ cao 210, chỗ ≥ 220', p); }
  for (const ma of ['BD-BEP-800', 'BD-BEP-900']) {
    const M = C.build(ap(ma)), r = M.info.bep.ro.find(x => x.pk === 'bat_duoi');
    ok(!M.errors.length && r.z0 + 210 <= M.info.bep.giang.z0 + 0.01, `${ma}: giá bát (cao 210) lọt dưới giằng`, [r, M.info.bep.giang, M.errors]);
    const s = ap(ma); s.khoang[0].o[0].cao = [250]; ok(loiBep(C.build(C.normalize(s))).some(t => /bát đĩa.*vướng giằng/.test(t)), `${ma}: mặt trên 250 → rổ bát đĩa vướng giằng → LỖI`, loiBep(C.build(C.normalize(s))));
  }
  // #2: cỡ 750 cho giá bát dưới, 450 cho gia vị
  ok(PK('bat_duoi').co.includes(750) && PK('gia_vi').co.includes(450), 'bat_duoi có cỡ 750, gia_vi có cỡ 450');
  for (const [ma, w] of [['BD-XN-800', 750], ['BD-GV-400', 450]]) { const s = ap(ma); s.rong = w; const M = C.build(C.normalize(s)); ok(!M.errors.length && !canhBep(M).length, `${ma} rộng ${w}: sạch`, [M.errors, M.warnings]); }
  ok(C.MAU_BEP_DUOI.some(m => m.ma === 'BD-XN-750') && C.MAU_BEP_DUOI.some(m => m.ma === 'BD-GV-450'), 'thư viện có BD-XN-750, BD-GV-450');
  // #3: lùi xà chân < dày ván → xà chân phẳng mặt hồi (kẹp giữa hai hồi), không lơ lửng trước hồi
  for (const lui of [0, 10]) {
    const s = C.datBep(ap('BD-CANH-600'), { len_lui: lui }), M = C.build(s), x = P2(M, 'CHAN'), tc = s.van.t_canh;
    ok(x.length === 1 && near(x[0].y0, 0) && near(x[0].y1, tc) && !M.kq.some(q => q.ma === 'lien_ket'), `lùi xà chân ${lui}: xà chân y 0 … ${tc} giữa hai hồi, có chỗ tì`, [box(x[0]), M.warnings]);
    ok(M.kq.some(q => q.ma === 'bep' && /phẳng mặt hồi/.test(q.t)), `lùi ${lui}: ghi chú xà chân phẳng mặt hồi`);
  }
  { const M = C.build(ap('BD-CANH-600')), x = P2(M, 'CHAN')[0]; ok(near(x.y1, 50) && !M.kq.some(q => /phẳng mặt hồi/.test(q.t)), 'lùi 50 như cũ'); }
  // #4: chậu / bếp / hút mùi kiểm theo KHOANG dưới lỗ khoét (giữa module)
  const haiKhoang = (ma, w) => { const s = ap(ma); s.rong = w; s.khoang = [{ rong: 'auto', canh: 1 }, { rong: 'auto', canh: 1 }]; return C.build(C.normalize(s)); };
  for (const [ma, re] of [['BD-CHAU-800', /[Cc]hậu/], ['BD-BEP-800', /[Bb]ếp/], ['BT-HM-800', /hút mùi/]]) {
    const M = haiKhoang(ma, 1600), l = loiBep(M);
    ok(l.some(t => re.test(t) && /vách/.test(t)), `${ma} rộng 1600 hai khoang: LỖI thiết bị đè lên vách giữa`, l);
    const M2 = haiKhoang(ma, 1200); ok(!loiBep(M2).some(t => /tủ 800\b/.test(t)), `${ma} rộng 1200 hai khoang: không gợi ý "chuyển sang tủ 800" (nhỏ hơn tủ đang có)`, loiBep(M2));
  }
  { const s = ap('BT-HM-800'); s.rong = 1400; s.khoang = [{ rong: 300, canh: 1 }, { rong: 'auto', canh: 2 }]; const M = C.build(C.normalize(s)), d = P2(M, 'DAY'), mid = 700;
    const coLo = d.filter(p => /hút mùi/.test(p.ghi_bep || ''));
    ok(!loiBep(M).length && coLo.length === 1 && coLo[0].x0 < mid && coLo[0].x1 > mid, 'hút mùi tủ hai khoang: ghi khoét trên đáy của khoang nằm dưới máy (giữa module)', [loiBep(M), d.map(p => [p.x0, p.x1, p.ghi_bep || ''])]); }
  // #5: tủ có giằng — ô trên cùng dừng ở mặt dưới giằng; nk_trum 2 ngăn sâu (bảng B3) hợp lệ
  for (const so of [1, 2, 3]) {
    const s = ap('BD-BEP-800'); s.khoang[0].o = [{ tu: 0, kieu: 'nk_trum', so }]; const M = C.build(C.normalize(s)), gz = M.info.bep.giang.z0, lo = s.ngan_keo.loai.find(x => x.ma === s.ngan_keo.mac_dinh);
    const top = Math.max(...M.templates.filter(t => t.loai === 'NGAN_KEO').map(t => t.pos[2] + t.box[2]));
    ok(!M.errors.length && top <= gz + (lo.ts.SLK || 0) + 0.01, `BD-BEP-800 nk_trum ${so} ngăn: không lỗi, hộp trên cùng dừng dưới giằng`, [M.errors, top, gz]);
  }
  { const M = C.build(ap('BD-CHAU-800')); ok(M.info.o.every(o => o.z1 <= M.info.bep.giang.z0 + 0.01), 'tủ chậu: ô trên cùng dừng ở mặt dưới giằng', M.info.o); }
  // #6: mặt cố định (nk_trum.cao) qua cùng phép kiểm như mặt chia đều
  { const s = ap('BD-NK3-600'); s.khoang[0].o[0].cao = [60]; const M = C.build(C.normalize(s)); ok(M.errors.some(t => /hộp ngăn kéo chỉ còn/.test(t)), 'mặt trên cố định 60: LỖI hộp ngăn kéo quá thấp', M.errors); }
  { const s = ap('BD-NK3-600'); s.khoang[0].o[0] = { tu: 0, kieu: 'nk_trum', so: 2, cao: [500] }; const M = C.build(C.normalize(s)); ok(M.warnings.some(t => /500 \(> 450\)/.test(t)), 'mặt trên cố định 500: cảnh báo > 450', M.warnings); }
  // #8: khe chỗ rổ theo nghiên cứu phụ kiện
  ok(PK('rac').cao_min === 530 && PK('rac').sau_min === 510 && PK('gao').sau_min === 500, 'thùng rác cao ≥ 530, sâu ≥ 510; thùng gạo sâu ≥ 500', [PK('rac'), PK('gao')]);
  { const s = ap('BD-RAC-300'); s.cao = 655; ok(loiBep(C.build(C.normalize(s))).some(t => /Thùng rác/.test(t) && /530/.test(t)), 'thùng rác trong ô 520 (rổ 520, không khe): LỖI', loiBep(C.build(C.normalize(s)))); }
  // #9: lỗ ống khói — kiểm lỗ lọt giữa mép trước nóc và thanh treo
  { const s = ap('BT-HM-800'); s.sau_thung = 300; s.bep.tb.hm = { ma: 'tu_chon', ong: 300, sau: 250 }; ok(loiBep(C.build(C.normalize(s))).some(t => /ống khói/.test(t)), 'tủ trên sâu 300, ống Ø310: lỗ không lọt trước thanh treo → LỖI', loiBep(C.build(C.normalize(s)))); }
  { const M = C.build(ap('BT-HM-800')); ok(!loiBep(M).some(t => /ống khói/.test(t)), 'BT-HM-800 mặc định: lỗ ống lọt'); }
});

T('Tủ bếp — sửa theo vòng soát 1.33 lần 3', () => {
  const k = require.resolve('../src/mncf-core.js'), cu = require.cache[k]; delete require.cache[k]; const C = require(k); require.cache[k] = cu;
  C.DEFAULT_SPEC.thung.noc_day = 'lot'; C.DEFAULT_SPEC.ngan_keo.khung_mat = 0;
  ghimBep133(C);      // (1.33.1) số đo của khối này là chuẩn bếp 1.33.0 (mặt đá 850, tủ dưới nóc liền, tay nắm nổi) — chuẩn anh chốt có khối riêng ở cuối
  const D = C.DEFAULT_SPEC, ap = ma => JSON.parse(JSON.stringify(C.apMau(D, ma)));
  const loiBep = M => M.kq.filter(x => x.ma === 'bep' && x.muc === 'loi').map(x => x.t);
  const PK = ma => C.LOAI_PK_BEP.find(p => p.ma === ma);
  // hộp ngăn kéo THẬT (mô hình của lõi: mặt ở z −XYS … H + SYS của mẫu, hộp thấp hơn mép trên mặt SLK, cao hơn mép dưới mặt XLK)
  const hopNK = (M, tp) => { const p = tp.params, top = tp.pos[2] + tp.box[2] + p.SYS - (p.SLK || 0), day = tp.pos[2] - p.XYS + (p.XLK || 0); return { top, day, cao: top - day }; };
  const bepNau = (ma, sua) => { const s = ap(ma); s.bep.chuc_nang = 'bep'; s.bep.tb = { bep: { ma: 'doi_730' } }; if (sua) sua(s); return C.build(C.normalize(s)); };
  // #0: tủ có giằng + ngăn kéo trùm: mặt trên cùng phủ tới mép trên thùng (che giằng), HỘP chỉ cao tới mặt dưới giằng trừ khe
  { const M = bepNau('BD-NK3-800'), gz = M.info.bep.giang.z0, tps = M.templates.filter(t => t.loai === 'NGAN_KEO').sort((a, b) => a.pos[2] - b.pos[2]), h = hopNK(M, tps[tps.length - 1]);
    const mat = M.mat_ngan_keo[tps[tps.length - 1].mat];
    ok(M.info.bep.giang && !M.errors.length, 'BD-NK3-800 chuyển bếp nấu (có giằng): không lỗi', [M.errors, M.warnings]);
    ok(h.top <= gz - 4.99 && h.cao >= 40, 'BD-NK3-800 bếp nấu: hộp ngăn kéo trên cùng ≥ 40 và đỉnh hộp dưới mặt dưới giằng (trừ khe)', [h, gz]);
    ok(mat.z + mat.h > gz, '… mặt trên cùng vẫn phủ lên tới mép trên thùng (che giằng)', [mat, gz]);
    ok(tps.every(tp => hopNK(M, tp).top <= gz + 0.01), '… mọi hộp ngăn kéo dưới giằng', tps.map(tp => hopNK(M, tp))); }
  // ép hộp quá thấp: mặt trên 100, giằng 200 → hộp không còn chỗ dưới giằng → LỖI
  { const M = bepNau('BD-NK3-800', s => { s.khoang[0].o[0].cao = [100]; s.bep.giang_rong = 200; });
    ok(M.errors.some(t => /hộp ngăn kéo/.test(t) && /giằng/.test(t)), 'mặt trên 100 + giằng 200: LỖI hộp ngăn kéo dưới giằng quá thấp', [M.errors, M.warnings]); }
  // loại không khai SLK (hộp Blum cố định) mà hộp vướng giằng → LỖI (không tự hạ được)
  { const M = bepNau('BD-NK3-800', s => { s.khoang[0].o[0].loai = 'blum16'; });
    ok(M.errors.some(t => /giằng/.test(t)), 'hộp ray Blum (không SLK) dưới mặt che giằng: LỖI vướng giằng', [M.errors, M.warnings]); }
  // kiemBep tính đỉnh hộp theo mô hình mặt / hộp (pos + box + SYS − SLK): tủ không giằng mà hộp cao quá dưới bếp âm → cảnh báo vẫn đúng chỗ
  { const s = ap('BD-NK3-800'); const M = C.build(C.normalize(s)); ok(!M.errors.length, 'BD-NK3-800 (không giằng) như cũ: sạch', M.errors); }
  // #1: giá xoong — chỗ ≥ rổ cao + 10 như giá bát; rổ cao hơn ô → LỖI
  ok(PK('xoong').cao_min >= PK('xoong').cao_ro + 10, 'xoong: cao_min ≥ cao_ro + 10', PK('xoong'));
  for (const p of C.LOAI_PK_BEP) if (p.lap === 'keo') ok(p.cao_min >= p.cao_ro + 10 || p.cao_max, `${p.ma}: chỗ đặt ≥ rổ cao + 10`, p);
  { const s = ap('BD-XN-800'); s.khoang[0].o = [{ tu: 0, kieu: 'keo_pk', pk: ['xoong', 'xoong', 'xoong'], cao: [253, 253] }]; const M = C.build(C.normalize(s));
    ok(loiBep(M).some(t => /xoong/.test(t)), 'ô xoong ~202 (rổ 210): LỖI', [loiBep(M), M.info.bep.ro]); }
  { const s = ap('BD-XN-800'); s.khoang[0].o = [{ tu: 0, kieu: 'keo_pk', pk: ['gia_vi'] }]; s.cao = 600; s.rong = 400; const M = C.build(C.normalize(s)), r = M.info.bep.ro[0];
    ok(r.z1 - r.z0 < PK('gia_vi').cao_min && loiBep(M).some(t => /gia vị/i.test(t)), 'ô gia vị thấp: LỖI', [loiBep(M), r]); }
  // phép kiểm đỉnh rổ (z0 + cao_ro ≤ z1): rổ có cao_min hạ dưới cao_ro (dữ liệu sửa tay) vẫn bị bắt
  { const p = PK('gia_vi'), cu0 = p.cao_min; p.cao_min = 300; try { const s = ap('BD-GV-400'); s.cao = 560; const M = C.build(C.normalize(s)), r = M.info.bep.ro[0];
    ok(r.z0 + p.cao_ro > r.z1 && loiBep(M).some(t => /cao tới/.test(t) && /gia vị/i.test(t)), 'rổ cao hơn ô (cao_min nới tay): LỖI đỉnh rổ vượt ô', [loiBep(M), r]); } finally { p.cao_min = cu0; } }
  // mẫu thư viện bếp sạch lỗi
  for (const m of C.MAU_BEP_DUOI.concat(C.MAU_BEP_TREN, C.MAU_BEP_CAO)) { const M = C.build(ap(m.ma)); ok(!M.errors.length, `${m.ma}: sạch lỗi`, M.errors); }
  // #2: tủ đồ khô — đợt tính theo chân hiện tại
  for (const ma of ['BC-KHO-450', 'BC-KHO-600', 'BC-KHO-400']) for (const chan of [80, 100, 120, 150]) {
    const s = C.datBep(ap(ma), { chan }), M = C.build(s), r = M.info.bep.ro[0], p = PK(r.pk);
    ok(!M.errors.length && r.z1 - r.z0 >= p.cao_min - 0.01, `${ma} chân ${chan}: đợt theo chân, ô rổ ≥ ${p.cao_min}`, [M.errors, s.khoang[0].dot, r]);
    const s2 = ap(ma); s2.bep.chan = chan; const s3 = C.datBep(C.apMau(C.datBep(ap(ma), { chan }), ma), {});
    ok(JSON.stringify(s.khoang[0].dot) === JSON.stringify(s3.khoang[0].dot), `${ma} chân ${chan}: đợt giống như áp mẫu sau khi đổi chân`, [s.khoang[0].dot, s3.khoang[0].dot]);
  }
  { const s = ap('BC-KHO-600'); s.khoang[0].dot = [2100]; const s2 = C.datBep(s, { chan: 120 }); ok(s2.khoang[0].dot[0] === 2100, 'đợt người dùng đã nâng (đủ chỗ) thì giữ khi đổi chân', s2.khoang[0].dot); }
  // (vòng soát 4) đợt người dùng dời mà ô vẫn ≥ cao_min (dù dưới số làm tròn của mẫu): đổi ô khác hay đổi chân vẫn giữ
  for (const [ma, d] of [['BC-KHO-400', 1870], ['BC-KHO-450', 1955]]) {
    const s = ap(ma); s.khoang[0].dot = [d];
    eq(C.datBep(s, { cach_tren: 650 }).khoang[0].dot, [d], `${ma} đợt ${d}: đổi Cách mặt đá không dời đợt`);
    eq(C.datBep(s, { chan: 90 }).khoang[0].dot, [d], `${ma} đợt ${d}: hạ chân (ô vẫn đủ) giữ đợt`);
    ok(C.datBep(s, { chan: 150 }).khoang[0].dot[0] > d, `${ma} đợt ${d}: nâng chân 150 (ô thiếu) thì đợt lên`);
  }
  // #3: cỡ chỉ một hãng có → dòng mua ghi đúng hãng
  const dongPK = ma => C.cutList(C.build(ap(ma))).phu_kien.filter(p => p.bep);
  { const l = dongPK('BD-XN-750').find(p => /bát đĩa/.test(p.ten)); ok(l && /cỡ 750 — Higold$/.test(l.ten) && !/EU133600/.test(l.ghi_chu), 'giá bát đĩa cỡ 750: chỉ Higold', l); }
  { const l = dongPK('BD-GV-450').find(p => /gia vị/.test(p.ten)); ok(l && /cỡ 450 — Higold$/.test(l.ten) && !/Eurogold EP20/.test(l.ghi_chu), 'giá gia vị cỡ 450: chỉ Higold', l); }
  { const l = dongPK('BD-XN-800').find(p => /bát đĩa/.test(p.ten)); ok(l && /Higold \/ Eurogold$/.test(l.ten), 'cỡ 800: vẫn Higold / Eurogold', l); }
  // #8: gợi ý "chuyển sang tủ N" chỉ khi N lớn hơn tủ đang có — coTuChoTB(…, { tren: W }) chỉ xét cỡ > W
  { const c = { loai: 'chau', lap: 'duong', khoet: [795, 455] };
    eq([C.coTuChoTB(c, { t: 17.5 }), C.coTuChoTB(c, { t: 17.5, tren: 900 }), C.coTuChoTB(c, { t: 17.5, tren: 1200 })], [900, 1000, null], 'coTuChoTB: tren = W bỏ các cỡ ≤ W'); }
  { const s = ap('BD-CHAU-800'); s.rong = 1200; s.khoang = [{ rong: 300, canh: 1 }, { rong: 'auto', canh: 2 }]; s.bep.tb.chau = { ma: 'tu_chon', lap: 'duong', phu_bi: [1200, 480], khoet: [1170, 455] };
    const l = loiBep(C.build(C.normalize(s))); ok(l.some(t => /Chậu/.test(t) && /tủ 1200 chỉ lọt/.test(t)) && !l.some(t => /chuyển sang tủ/.test(t)), 'rộng 1200 hai khoang, chậu không lọt cả tủ: không gợi ý tủ ≤ 1200', l); }
  { const s = ap('BD-CHAU-800'); s.bep.tb.chau = { ma: 'tu_chon', lap: 'duong', phu_bi: [820, 480], khoet: [795, 455] };
    const l = loiBep(C.build(C.normalize(s))); ok(l.some(t => /chuyển sang tủ 900/.test(t)), 'tủ 800 một khoang, chậu khoét 795: gợi ý tủ 900', l); }
});

// Bản 1.33.1 — anh Thanh CHỐT chuẩn bếp (12/10/2026, hộp tích chọn): mặt đá 860 (đá 20 → thân tủ dưới 840, đáy tủ trên 1560); tủ dưới thường cũng 2 giằng;
// chậu âm là chính; hút mùi cả âm tủ lẫn kính vát (tủ che ống phía trên); giá bát tủ trên nâng hạ là chính; tay nắm vát cạnh / ấn mở (không tay nắm nổi).
// Khối này nạp lõi MỚI, KHÔNG ghim chuẩn bếp (chỉ ghim kết cấu tủ áo như các khối khác).
T('Tủ bếp — chuẩn anh chốt (bản 1.33.1)', () => {
  const k = require.resolve('../src/mncf-core.js'), cu = require.cache[k]; delete require.cache[k]; const C = require(k); require.cache[k] = cu;
  C.DEFAULT_SPEC.thung.noc_day = 'lot'; C.DEFAULT_SPEC.ngan_keo.khung_mat = 0;
  const D = C.DEFAULT_SPEC, B0 = C.DEFAULT_BEP, ap = ma => JSON.parse(JSON.stringify(C.apMau(D, ma)));
  const loiBep = M => M.kq.filter(x => x.ma === 'bep' && x.muc === 'loi').map(x => x.t), canhBep = M => M.kq.filter(x => x.ma === 'bep' && x.muc === 'luu_y').map(x => x.t), ghiBep = M => M.kq.filter(x => x.ma === 'bep' && x.muc === 'ghi').map(x => x.t);
  const P2 = (M, l) => M.parts.filter(p => p.loai === l), pkBep = M => C.cutList(M).phu_kien.filter(x => x.bep);
  ok(/^1\.(33\.1|34\.|35\.|36\.)/.test(C.VERSION), 'phiên bản từ 1.33.1', C.VERSION);
  // #1 mặt đá 860
  eq([B0.cao_mat, B0.day_da, B0.van_lot, B0.cach_tren, B0.cao_tren, B0.noc, B0.tay_nam], [860, 20, 0, 700, 800, 'giang', 'vat'], 'DEFAULT_BEP: mặt đá 860, đá 20, tủ trên cách 700 cao 800, giằng, tay nắm vát');
  const MAU = [...C.MAU_BEP_DUOI, ...C.MAU_BEP_TREN, ...C.MAU_BEP_CAO];
  for (const ma of ['BT-HMK-700', 'BT-HMK-900', 'BT-BATCD-600', 'BT-BATCD-900', 'BT-HM-800', 'BT-HM-950', 'BT-BAT-800']) ok(MAU.some(m => m.ma === ma), `có mẫu ${ma}`);
  for (const m of MAU) {
    const s = C.apMau(D, m.ma), M = C.build(s), B = s.bep, hop = M.info.hop;
    ok(!M.errors.length && !M.warnings.length && C.phieu(M).dat, `${m.ma}: chuẩn mới — không lỗi / cảnh báo, phiếu đạt`, [M.errors, M.warnings]);
    ok(B.tay_nam === 'vat', `${m.ma}: tay nắm vát`);
    { const h = C.heSo(s); ok(['L', 'W', 'H'].every(x => h.bien[x]), `${m.ma}: chuẩn mới — module co giãn L / W / H`, h.ly_do); }
    if (B.tang === 'duoi') {
      ok(near(hop.z1, 840) && M.da && near(M.da.z + M.da.day, 860), `${m.ma}: thân 840 + đá 20 = mặt đá 860`, [hop.z1, M.da]);
      ok(!P2(M, 'NOC').length && P2(M, 'GIANG').length === 2, `${m.ma}: tủ dưới 2 giằng, không nóc`);
      ok(C.keHoachGoc(s).loi.some(l => /giằng/.test(l)), `${m.ma}: giằng → lệnh gốc chưa vẽ được, nhập tấm`);
    }
    if (B.tang === 'tren' && !(B.tb.hm && B.tb.hm.kieu === 'kinh')) eq(M.info.bep.z_dat, 1560, `${m.ma}: tủ trên đặt ở z 1560`);
    if (B.tang === 'tren' && B.tb.hm && B.tb.hm.kieu === 'kinh') ok(near(M.info.bep.z_dat + s.cao, 860 + 700 + 800), `${m.ma}: tủ che ống thẳng đỉnh dãy tủ trên (+2360)`, [M.info.bep.z_dat, s.cao]);
    if (B.tang === 'cao') ok(near(hop.z1, 2360), `${m.ma}: tủ cao tới đỉnh tủ trên 2360`, hop.z1);
    // vát cạnh: mọi cánh + mặt kéo có gia công vát; không dòng tay nắm
    const mat = M.parts.filter(p => p.loai === 'CANH' || p.loai === 'MKP');
    ok(mat.every(p => /vát cạnh 45°/.test(p.gia_cong || '')), `${m.ma}: cánh / mặt kéo ghi gia công vát`, mat.map(p => p.gia_cong));
    ok(!C.cutList(M).phu_kien.some(x => /^Tay nắm/i.test(x.ten)), `${m.ma}: không dòng tay nắm`);
  }
  // #2 tủ dưới thường: giằng mặc định, nóc liền vẫn chọn được (lệnh gốc vẽ được)
  { const s = ap('BD-NK3-600'); s.bep.noc = 'lien'; const n = C.normalize(s), M = C.build(n);
    ok(n.bep.noc === 'lien' && P2(M, 'NOC').length === 1 && !P2(M, 'GIANG').length && !M.errors.length && !C.keHoachGoc(n).loi.length, 'tủ dưới nóc liền: vẫn chọn được, lệnh gốc vẽ được', [n.bep.noc, C.keHoachGoc(n).loi]); }
  { const s = ap('BD-CANH-600'); s.bep.noc = 'la'; ok(C.normalize(s).bep.noc === 'giang', 'noc lạ → giằng (mặc định)'); const t = ap('BT-CANH-600'); t.bep.noc = 'giang'; ok(C.normalize(t).bep.noc === 'lien', 'tủ trên luôn nóc liền'); }
  { const M = C.build(ap('BD-NK3-600')), gz = M.info.bep.giang.z0, tps = M.templates.filter(t => t.loai === 'NGAN_KEO');
    ok(tps.length === 3 && !M.errors.length, 'BD-NK3-600 có giằng: 3 ngăn kéo, sạch'); }
  // #3 chậu âm là chính; dương vẫn chọn
  for (const [ma, tb] of [['BD-CHAU-800', 'am_don_600'], ['BD-CHAU-900', 'am_780']]) {
    const s = ap(ma), M = C.build(s), da = C.cutList(M).gia_cong_da[0];
    ok(s.bep.tb.chau.ma === tb && s.bep.tb.chau.lap === 'am' && !loiBep(M).length && /lắp âm/.test(da.ghi_chu), `${ma}: chậu âm ${tb} lọt tủ, gia công đá ghi lắp âm`, [s.bep.tb.chau, loiBep(M)]);
  }
  { const s = ap('BD-CHAU-900'); s.bep.tb.chau = { ma: 'duong_820' }; const M = C.build(C.normalize(s)); ok(!M.errors.length && !M.warnings.length && C.normalize(s).bep.tb.chau.lap === 'duong', 'tủ chậu 900: chậu dương 820 vẫn chọn được, sạch', [M.errors, M.warnings]); }
  ok(loiBep(C.build(Object.assign(ap('BD-CHAU-800'), {}))).length === 0 && C.LOAI_TB_BEP.chau.some(x => x.ma === 'am_don_600' && x.lap === 'am'), 'LOAI_TB_BEP có chậu âm đơn 600 (ví dụ)');
  // #4 hút mùi kính vát / áp tường
  for (const w of [700, 900]) {
    const h = C.LOAI_TB_BEP.hm.find(x => x.ma === `kinh_${w}`);
    ok(h && h.kieu === 'kinh' && h.rong === w && h.ong === 150 && h.sau > 0 && h.cao > 0, `LOAI_TB_BEP: hút mùi kính ${w} (rộng, sâu, cao thân, ống Ø150)`, h);
    const s = ap(`BT-HMK-${w}`), M = C.build(s);
    ok(s.bep.chuc_nang === 'hm' && s.bep.tb.hm.kieu === 'kinh' && s.rong === w && !P2(M, 'DOT').length, `BT-HMK-${w}: tủ che ống ${w}, máy kính, không đợt`);
    const day = P2(M, 'DAY')[0], noc = P2(M, 'NOC')[0];
    ok(/lỗ ống/.test(day.ghi_bep || '') && /lỗ ống/.test(noc.ghi_bep || '') && !/khoét \d+ ×/.test(day.ghi_bep), `BT-HMK-${w}: khoét lỗ ống ở đáy + nóc (không khoét thân máy)`, [day.ghi_bep, noc.ghi_bep]);
    const I = M.info.bep.hm; ok(I && I.cach >= 650 - 0.01 && I.cach <= 750 + 0.01 && I.dinh <= M.info.bep.z_dat + 0.01, `BT-HMK-${w}: máy cách mặt bếp trong khoảng 650 – 750, đỉnh máy dưới đáy tủ che ống`, I);
    ok(pkBep(M).some(x => /Máy hút mùi/.test(x.ten) && /kính/.test(x.ten)), `BT-HMK-${w}: kê máy hút mùi kính`);
    ok(C.keHoachGoc(s).loi.length > 0, `BT-HMK-${w}: lệnh gốc chưa vẽ (lỗ ống) → nhập tấm`);
  }
  { const s = C.datBep(ap('BT-HMK-900'), {}); s.cao = 450; const M = C.build(C.normalize(s)); ok(loiBep(M).some(t => /thân máy|đỉnh máy/.test(t)), 'tủ che ống cao 450 (đáy 1910): khoảng trống dưới tủ không đủ thân máy → LỖI', loiBep(M)); }
  { const s = ap('BT-HMK-900'); s.bep.bep_loai = 'gas'; const M = C.build(C.normalize(s)); ok(!loiBep(M).length || loiBep(M).some(t => /gas/.test(t)), 'bếp gas: tính theo khoảng cách gas', loiBep(M)); }
  { const s = ap('BT-HMK-900'); s.cao = 200; const M = C.build(C.normalize(s)); ok(!loiBep(M).length && ghiBep(M).some(t => /ống khói lộ/.test(t)), 'tủ che ống thấp (đáy cao): máy treo ở 750, ghi ống khói lộ', [loiBep(M), ghiBep(M)]); }
  { const s = ap('BT-HM-800'); s.bep.tb.hm = { ma: 'kinh_700' }; const M = C.build(C.normalize(s)); ok(loiBep(M).some(t => /thân máy|đỉnh máy/.test(t)), 'máy kính dưới tủ trên cao 800 (đáy 1560): LỖI — tủ thấp hơn đỉnh máy', loiBep(M)); }
  { const M = C.build(ap('BT-HM-800')); ok(!M.errors.length && M.parts.some(p => /khoét 700 ×/.test(p.ghi_bep || '')), 'mẫu hút mùi âm tủ vẫn còn, khoét thân máy ở đáy'); }
  // #5 giá bát nâng hạ là chính
  for (const w of [600, 700, 800, 900]) {
    const a = ap(`BT-BAT-${w}`), b = ap(`BT-BATCD-${w}`);
    ok(a.bep.pk === 'bat_tren_nh' && b.bep.pk === 'bat_tren_cd', `BT-BAT-${w}: nâng hạ; BT-BATCD-${w}: cố định`, [a.bep.pk, b.bep.pk]);
    ok(pkBep(C.build(a)).some(x => /nâng hạ/.test(x.ten)) && pkBep(C.build(b)).some(x => /cố định/.test(x.ten)), `BT-BAT-${w} / BT-BATCD-${w}: kê đúng loại giá bát`);
  }
  { const s = ap('BT-BAT-800'); s.cao = 650; ok(loiBep(C.build(C.normalize(s))).some(t => /nâng hạ/.test(t)), 'giá bát nâng hạ trong thùng 650: LỖI (cần ≥ 700)'); }
  // #6 tay nắm
  { const n = t => { const s = ap('BD-CANH-600'); s.bep.tay_nam = t; return C.normalize(s).bep.tay_nam; }; eq(['vat', 'an_mo', 'noi', 'gola', 'j', 'la'].map(n), ['vat', 'an_mo', 'noi', 'gola', 'j', 'vat'], 'tay nắm: vát / ấn mở / nổi / Gola / J; lạ → vát'); }
  { const M = C.build(ap('BD-CANH-600')), cl = C.cutList(M), r = cl.rows.find(x => /^Cánh/.test(x.ten));
    ok(P2(M, 'CANH').every(p => /mép trên/.test(p.gia_cong)) && /vát cạnh 45°/.test(r.ghi_chu) && /bản lề \/ cánh/.test(r.ghi_chu), 'tủ dưới: cánh vát mép trên, bảng kê ghi vát + số bản lề', r); }
  ok(P2(C.build(ap('BT-CANH-800')), 'CANH').every(p => /mép dưới/.test(p.gia_cong)), 'tủ trên: cánh vát mép dưới');
  { const M = C.build(ap('BD-NK3-600')), v = pkBep(M).find(x => /vát/.test(x.ten)); ok(v && v.sl === 3 && /mặt ngăn kéo/.test(v.ghi_chu), 'tủ 3 ngăn kéo (mẫu Chenfeng): dòng gia công vát 3 mặt ngăn kéo', v); }
  { const s = ap('BD-CANH-600'); s.bep.dua_da = 10; ok(canhBep(C.build(C.normalize(s))).some(t => /vát/.test(t)), 'tay nắm vát + đá đua 10: cảnh báo đá đua (chỗ ngón tay)'); }
  const anMo = ma => { const s = ap(ma); s.bep.tay_nam = 'an_mo'; return C.build(C.normalize(s)); };
  { const M = anMo('BD-CANH-600'), pk = C.cutList(M).phu_kien, nm = pk.find(x => /nhấn mở/i.test(x.ten) && /cánh/i.test(x.ten)), bl = pk.find(x => /^Bản lề/.test(x.ten));
    ok(nm && nm.sl === P2(M, 'CANH').length && /Higold|Eurogold/.test(nm.ten), 'ấn mở: mỗi cánh một bộ nhấn mở (Higold / Eurogold)', nm);
    ok(bl && /không giảm chấn/.test(bl.ten), 'ấn mở: bản lề loại không giảm chấn', bl);
    ok(!M.parts.some(p => p.gia_cong) && !M.warnings.length, 'ấn mở: không gia công vát, không cảnh báo', M.warnings); }
  { const M = anMo('BD-NK3-600'), r = pkBep(M).find(x => /[Rr]ay nhấn mở/.test(x.ten)); ok(r && r.sl === 3, 'ấn mở: ngăn kéo ray nhấn mở (3 ngăn)', r); }
  { const M = anMo('BD-XN-800'); ok(canhBep(M).some(t => /giảm chấn/.test(t) && /(ấn|nhấn) mở/.test(t)), 'ấn mở + rổ kéo (ray giảm chấn theo rổ): cảnh báo không ấn mở được', canhBep(M)); }
  { const s = ap('BD-NK3-600'); s.bep.tay_nam = 'an_mo'; s.khoang[0].o[0].loai = 'blum16'; const M = C.build(C.normalize(s)); ok(canhBep(M).some(t => /giảm chấn/.test(t)), 'ấn mở + hộp ray Blum (giảm chấn): cảnh báo', canhBep(M)); }
  { const s = ap('BD-CANH-600'); s.bep.tay_nam = 'noi'; const M = C.build(C.normalize(s)); ok(!M.parts.some(p => p.gia_cong) && !C.cutList(M).phu_kien.some(x => /nhấn mở|vát/.test(x.ten)), 'tay nắm nổi: không vát, không nhấn mở'); }
  // #1 chuẩn đã lưu (localStorage mncf.bep.v1) trước 1.33.1: số đúng bằng mặc định cũ coi như chưa chọn
  { const r = C.nangChuanBep({ cao_mat: 850, tay_nam: 'noi', chan: 120 });
    ok(!('cao_mat' in r.chuan) && !('tay_nam' in r.chuan) && r.chuan.chan === 120 && r.luu.ban === C.VERSION && r.doi.length === 2, 'chuẩn lưu trước 1.33.1, số = mặc định cũ → nhận mặc định mới', r); }
  { const r = C.nangChuanBep({ cao_mat: 870, tay_nam: 'j' }); ok(r.chuan.cao_mat === 870 && r.chuan.tay_nam === 'j' && !r.doi.length, 'chuẩn người dùng tự đổi khác mặc định cũ: giữ', r); }
  { const r = C.nangChuanBep({ cao_mat: 850, tay_nam: 'noi', ban: '1.33.1' }); ok(r.chuan.cao_mat === 850 && r.chuan.tay_nam === 'noi' && !r.doi.length && !('ban' in r.chuan), 'chuẩn lưu từ 1.33.1 trở đi: giữ cả số bằng mặc định cũ', r); }
  { const r = C.nangChuanBep(null); ok(r.chuan && !Object.keys(r.chuan).length && r.luu.ban === C.VERSION, 'không có chuẩn lưu: rỗng', r); }
  { const r = C.nangChuanBep({ cao_mat: 850, la: 1 }); ok(!('la' in r.chuan), 'bỏ khoá lạ (chỉ khoá chuẩn bếp)', r); }
});

// Bản vá 1.33.1 (soát đối kháng 1.33.0 → 1.33.1): mỗi lỗi đã xác nhận một phép thử. Lõi MỚI, chuẩn bếp anh chốt (không ghim chuẩn bếp).
T('Tủ bếp — bản vá soát 1.33.1', () => {
  const k = require.resolve('../src/mncf-core.js'), cu = require.cache[k]; delete require.cache[k]; const C = require(k); require.cache[k] = cu;
  C.DEFAULT_SPEC.thung.noc_day = 'lot'; C.DEFAULT_SPEC.ngan_keo.khung_mat = 0;
  const D = C.DEFAULT_SPEC, ap = (ma, t) => JSON.parse(JSON.stringify(C.apMau(t || D, ma)));
  const loiBep = M => M.kq.filter(x => x.ma === 'bep' && x.muc === 'loi').map(x => x.t), ghiBep = M => M.kq.filter(x => x.ma === 'bep' && x.muc === 'ghi').map(x => x.t);
  const pkBep = M => C.cutList(M).phu_kien.filter(x => x.bep), P2 = (M, l) => M.parts.filter(p => p.loai === l);
  // (a) tủ bếp lưu / vẽ ở 1.33.0 (mặt đá 850, tay nắm nổi = mặc định cũ) đang mở: mẫu bếp chọn sau đó nhận chuẩn MỚI (860, vát); tủ cũ giữ nguyên số của nó
  const s0 = C.datBep(ap('BD-CANH-600'), { cao_mat: 850, tay_nam: 'noi' });      // = thông số một tủ bếp làm ở 1.33.0 (mặc định lúc đó)
  for (const [ten, f] of [['nangCap (mncf.spec.v2 / file)', x => C.nangCap(x, '1.33.0').spec], ['specDaVe (Sửa tủ đã vẽ)', x => C.specDaVe(x, '1.33.0')]]) {
    const cu2 = C.normalize(f(s0));
    eq([cu2.cao, cu2.bep.cao_mat, cu2.bep.tay_nam], [830, 850, 'noi'], `${ten}: tủ 1.33.0 mở lại giữ mặt đá 850, tay nắm nổi`);
    eq(JSON.stringify(C.build(cu2).parts), JSON.stringify(C.build(s0).parts), `${ten}: tấm của tủ cũ không đổi`);
    const m = C.normalize(C.apMau(cu2, 'BD-NK3-600'));
    eq([m.cao, m.bep.cao_mat, m.bep.tay_nam], [840, 860, 'vat'], `${ten}: đổi sang mẫu bếp khác → chuẩn mới 860 / vát (không mang mặc định cũ)`);
    ok(!('chuan_cu' in m.bep), `${ten}: mẫu mới không mang dấu chuẩn cũ`, m.bep.chuan_cu);
    eq(C.normalize(C.datBep(m, { chan: 120 })).bep.cao_mat, 860, `${ten}: gõ chân sau đó vẫn 860`);
  }
  { const cu2 = C.normalize(C.nangCap(s0, '1.33.1').spec), m = C.apMau(cu2, 'BD-NK3-600'); eq([m.bep.cao_mat, m.bep.tay_nam], [850, 'noi'], 'lưu từ 1.33.1 (người dùng chọn 850 / nổi): mẫu sau giữ'); }
  { const cu2 = C.datBep(C.normalize(C.nangCap(s0, '1.33.0').spec), { cao_mat: 850 }), m = C.apMau(cu2, 'BD-NK3-600');
    eq([m.bep.cao_mat, m.bep.tay_nam], [850, 'vat'], 'tủ cũ: gõ lại mặt đá 850 = người dùng chọn → mẫu sau giữ 850, tay nắm vẫn theo chuẩn mới'); }
  { const cu2 = C.normalize(C.nangCap(C.datBep(ap('BD-CANH-600'), { cao_mat: 870, tay_nam: 'j' }), '1.33.0').spec), m = C.apMau(cu2, 'BD-NK3-600');
    eq([m.bep.cao_mat, m.bep.tay_nam], [870, 'j'], 'tủ 1.33.0 có số tự đổi (870, J): mẫu sau giữ'); }
  { const t = C.baoChuanBepMoi(['cao_mat', 'tay_nam']); ok(/860/.test(t) && /850/.test(t) && /vát/.test(t), 'câu báo chuẩn bếp mới nêu 850 → 860 và tay nắm vát', t); eq(C.baoChuanBepMoi([]), '', 'không đổi gì: không báo'); }
  // (b) hộc kéo âm sau cánh: không vát mặt, không ray nhấn mở
  const nkAm = tay => { const s = ap('BC-KHO-600'); s.khoang[0].o = [{ tu: 0, kieu: 'nk_am', so: 2 }]; s.khoang[0].dot = [1200]; s.bep.tay_nam = tay; return C.build(C.normalize(s)); };
  { const M = nkAm('vat'); ok(!M.errors.length && M.templates.filter(t => t.kieu === 'nk_am').length === 2, 'BC-KHO-600 + 2 hộc âm sau cánh: dựng được', M.errors);
    ok(!pkBep(M).some(x => /vát/.test(x.ten) && /ngăn kéo/.test(x.ten)), 'vát cạnh: không kê vát mặt hộc âm (nằm sau cánh)', pkBep(M)); }
  ok(!pkBep(nkAm('an_mo')).some(x => /[Rr]ay nhấn mở/.test(x.ten)), 'ấn mở: không kê ray nhấn mở cho hộc âm sau cánh', pkBep(nkAm('an_mo')));
  { const s = ap('BC-KHO-600'); s.khoang[0].o = [{ tu: 0, kieu: 'nk_am', so: 2, loai: 'blum16' }]; s.khoang[0].dot = [1200]; s.bep.tay_nam = 'an_mo'; const M = C.build(C.normalize(s));
    ok(!M.warnings.some(t => /Ấn mở: hộp ray Blum/.test(t)), 'ấn mở: hộc âm Blum sau cánh không bị báo "Blum không ấn mở được"', M.warnings); }
  // (c) mặt kéo rổ cao của tủ cao: chỗ cầm vát mép đứng (mép trên ở ~1,9 m không với tới), có dòng ghi; mặt kéo tủ dưới vẫn mép trên
  { const M = C.build(ap('BC-KHO-400')), mk = P2(M, 'MKP')[0];
    ok(mk && mk.z1 > 1800 && /mép đứng/.test(mk.gia_cong) && !/mép trên/.test(mk.gia_cong), 'BC-KHO-400: mặt kéo cao vát mép đứng', mk && mk.gia_cong);
    ok(ghiBep(M).some(t => /mặt kéo/i.test(t) && /mép đứng/.test(t)), 'BC-KHO-400: có dòng ghi về chỗ cầm mặt kéo cao', ghiBep(M)); }
  ok(P2(C.build(ap('BD-XN-800')), 'MKP').every(p => /mép trên/.test(p.gia_cong)), 'tủ dưới: mặt kéo rổ vẫn vát mép trên');
  // (d) tủ hút mùi âm đổi sang máy kính: thành tủ che ống (cao riêng 350, thẳng đỉnh dãy), không lỗi; gõ Cao không đổi chuẩn Cao tủ trên
  { let s = ap('BT-HM-800'); s = C.datBep(s, { tb: { hm: { ma: 'kinh_700' }, bep: s.bep.tb.bep } }); const M = C.build(s);
    eq([s.cao, s.bep.cao_tren, M.info.bep.z_dat], [350, 800, 2010], 'BT-HM-800 chọn máy kính 700: tủ che ống cao 350, đáy +2010 (đỉnh 2360 = đỉnh dãy)');
    ok(!loiBep(M).length, 'BT-HM-800 + máy kính: không lỗi', loiBep(M));
    s.cao = 400; const s2 = C.normalize(s); eq([s2.bep.cao_tren, s2.bep.cao_rieng, C.build(s2).info.bep.z_dat], [800, 400, 1960], 'gõ Cao 400: chỉ tủ này cao 400 (chuẩn Cao tủ trên vẫn 800), đáy nâng theo'); }
  { const s = ap('BT-HM-800'); s.bep.tb.hm = { ma: 'kinh_700' }; const n = C.normalize(s), M = C.build(n), l = loiBep(M).find(t => /Giảm Cao của tủ này .*≤ (\d+)/.test(t));
    ok(l && !/BT-HMK|chọn mẫu/.test(l) && /chuẩn Cao tủ trên giữ nguyên/.test(l), 'thông số ghi thẳng máy kính vào tủ cao 800: lỗi khuyên giảm ô Cao của tủ này (chuẩn giữ) — tủ đã là tủ che ống, không khuyên chọn mẫu', loiBep(M));
    const x = +/≤ (\d+)/.exec(l)[1], s2 = JSON.parse(JSON.stringify(n)); s2.cao = x; const n2 = C.normalize(s2);
    ok(!loiBep(C.build(n2)).length && n2.bep.cao_tren === 800, `làm theo lời khuyên (cao ${x}): hết lỗi, chuẩn Cao tủ trên giữ 800`, [loiBep(C.build(n2)), n2.bep]); }
  // (e) Chuẩn xưởng ngăn kéo Blum: mẫu tủ ngăn kéo bếp lấy nóc liền (hộp Blum không hạ dưới giằng được); đặt giằng thì lời báo nêu ô Nóc
  { const t = C.normalize({ ngan_keo: Object.assign({}, D.ngan_keo, { mac_dinh: 'blum16' }) });
    for (const ma of ['BD-NK3-600', 'BD-NK3-400']) { const s = C.apMau(t, ma), M = C.build(s); ok(s.bep.noc === 'lien' && !M.errors.length, `${ma} + Chuẩn xưởng Blum: nóc liền, không lỗi`, [s.bep.noc, M.errors]); }
    ok(C.apMau(D, 'BD-NK3-600').bep.noc === 'giang', 'Chuẩn xưởng ray bi: tủ ngăn kéo vẫn giằng (chuẩn anh chốt)'); }
  // (e2) theo KHẢ NĂNG hạ hộp (không theo tên Blum): mọi loại ngăn kéo của Chuẩn xưởng × mọi mẫu bếp trong Thư viện → không lỗi
  { const tatCa = [].concat(C.MAU_BEP_DUOI, C.MAU_BEP_TREN, C.MAU_BEP_CAO), hong = [];
    for (const lo of D.ngan_keo.loai) {
      const t = C.normalize({ ngan_keo: Object.assign({}, D.ngan_keo, { mac_dinh: lo.ma }) });
      for (const m of tatCa) { const s = C.normalize(C.apMau(t, m.ma)), e = C.build(s).errors; if (e.length) hong.push([lo.ma, m.ma, e[0]]); }
    }
    ok(!hong.length, `mọi loại ngăn kéo (${D.ngan_keo.loai.length}) × mọi mẫu bếp (${tatCa.length}): không lỗi`, hong.slice(0, 5)); }
  for (const ma of ['blum16', 'blum18', 'chia_o', 'ban_phim']) {
    const t = C.normalize({ ngan_keo: Object.assign({}, D.ngan_keo, { mac_dinh: ma }) }), s = C.normalize(C.apMau(t, 'BD-NK3-600')), M = C.build(s);
    ok(s.bep.noc === 'lien' && s.bep.noc_tu && !M.errors.length && M.notes.some(x => /Nóc liền thay 2 thanh giằng/.test(x) && x.indexOf(s.bep.noc_tu) >= 0), `${ma}: tủ ngăn kéo bếp tự nóc liền, ghi lý do, không lỗi`, [s.bep, M.errors, M.notes]);
    const g2 = C.normalize(C.datBep(s, { noc: 'giang' }));
    ok(g2.bep.noc === 'lien' && !C.build(g2).errors.length, `${ma}: chọn giằng mà loại không hạ được → vẫn tự liền, không lỗi`, g2.bep);
  }
  { const t = C.normalize({ ngan_keo: Object.assign({}, D.ngan_keo, { mac_dinh: 'blum16' }) }), s = C.normalize(C.apMau(t, 'BD-NK3-600'));
    const ve = JSON.parse(JSON.stringify(s)); ve.ngan_keo.mac_dinh = 'bi_mong'; const n = C.normalize(ve);
    ok(n.bep.noc === 'giang' && !n.bep.noc_tu && !C.build(n).errors.length, 'đổi sang ray bi: nóc tự liền trở về 2 thanh giằng', n.bep);
    const l = C.normalize(C.datBep(s, { noc: 'lien' })), l2 = JSON.parse(JSON.stringify(l)); l2.ngan_keo.mac_dinh = 'bi_mong';
    ok(C.normalize(l2).bep.noc === 'lien', 'người dùng tự chọn Nóc liền: đổi ray bi vẫn giữ liền', C.normalize(l2).bep);
    const d = JSON.parse(JSON.stringify(C.apMau(D, 'BD-NK3-600'))); d.khoang[0].dot = [600]; d.khoang[0].o = [{ tu: 0, kieu: 'nk_trum', so: 2, loai: 'blum16' }];
    ok(C.normalize(d).bep.noc === 'giang', 'ô Blum có đợt phía trên (không sát giằng): giữ giằng', C.normalize(d).bep); }
  // (soát 1.33.1 vòng 2) tủ che ống BT-HMK gõ Cao 800: lỗi chỉ khuyên giảm Cao của chính tủ này — không khuyên "chọn mẫu BT-HMK" (đang là nó)
  { const s = C.apMau(C.normalize({}), 'BT-HMK-700'); s.cao = 800; const e = loiBep(C.build(C.normalize(s)));
    ok(e.length === 1 && /Giảm Cao của tủ này/.test(e[0]) && !/BT-HMK|chọn mẫu/.test(e[0]), 'BT-HMK-700 cao 800: lỗi khuyên giảm Cao, không khuyên chọn lại mẫu BT-HMK', e); }
  // (soát 1.33.1 vòng 2) lý do nóc liền đúng theo loại: chia ô CÓ SLK nhưng hộp = mặt ngăn kéo; Blum / bàn phím: không có SLK
  for (const [ma, coSLK] of [['chia_o', true], ['blum16', false], ['ban_phim', false]]) {
    const t = C.normalize({ ngan_keo: Object.assign({}, D.ngan_keo, { mac_dinh: ma }) }), M = C.build(C.normalize(C.apMau(t, 'BD-NK3-600'))), n = M.notes.find(x => /Nóc liền thay/.test(x)) || '';
    ok(coSLK ? !/không có tham số SLK/.test(n) && /mặt ngăn kéo/.test(n) : /không có tham số SLK/.test(n), `${ma}: ghi chú nóc liền nêu đúng lý do (${coSLK ? 'hộp là mặt ngăn kéo' : 'không có SLK'})`, n);
  }
  { const r = C.nangChuanBep({ cao_mat: 850, chan: 120 }); ok(r.doi.indexOf('cao_mat') >= 0 && r.doi.indexOf('tay_nam') >= 0, 'bản lưu cũ không ghi tay nắm (lúc đó theo mặc định nổi): cũng báo tay nắm đổi', r.doi);
    const t = C.baoChuanBepMoi(['cao_mat', 'tay_nam']); ok(/Cao mặt đá 850/.test(t) && /Tay nắm nổi/i.test(t), 'câu báo nói cách đặt lại 850 / tay nắm nổi', t); }
});

// Bản 1.34 — DÃY BẾP, bước 1: ô & module (thiết kế "dãy bếp chữ I / chữ L", anh Thanh 12/10/2026; chốt: ke L + vít nở cho khoang tủ lạnh, hốc vi sóng 380,
// góc mặc định Higold liên hoàn 900 / 400, đầu dãy hở ốp hông + đá nhô 20). Mỗi tủ vẫn là MỘT spec = MỘT module; dãy là việc của bước sau.
// Khối này nạp lõi MỚI theo chuẩn bếp anh chốt (mặt đá 860), chỉ ghim kết cấu tủ áo như các khối khác.
T('Dãy bếp (bản 1.34) — ô hốc, khoang tủ lạnh, tủ lò, kệ, góc mù, nẹp, ốp', () => {
  const k = require.resolve('../src/mncf-core.js'), cu = require.cache[k]; delete require.cache[k]; const C = require(k); require.cache[k] = cu;
  C.DEFAULT_SPEC.thung.noc_day = 'lot'; C.DEFAULT_SPEC.ngan_keo.khung_mat = 0;
  const D = C.DEFAULT_SPEC, ap = ma => JSON.parse(JSON.stringify(C.apMau(D, ma))), t = D.van.t, tc = D.van.t_canh;
  const loiBep = M => M.kq.filter(x => x.ma === 'bep' && x.muc === 'loi').map(x => x.t), canhBep = M => M.kq.filter(x => x.ma === 'bep' && x.muc === 'luu_y').map(x => x.t), ghiBep = M => M.kq.filter(x => x.ma === 'bep' && x.muc === 'ghi').map(x => x.t);
  const P2 = (M, l) => M.parts.filter(p => p.loai === l), pkBep = M => C.cutList(M).phu_kien.filter(x => x.bep);
  eq(C.VERSION, '1.36.5', 'phiên bản 1.36.5');
  const MAU = [...C.MAU_BEP_DUOI, ...C.MAU_BEP_TREN, ...C.MAU_BEP_CAO], co = ma => MAU.some(m => m.ma === ma);
  for (const ma of ['BC-TL-700', 'BC-TL-830', 'BC-TL-910', 'BC-LO-600', 'BD-KE-150', 'BD-KE-200', 'BD-KE-300', 'BT-KE-150', 'BT-KE-200', 'BT-KE-300',
    'BD-GOC-900-T', 'BD-GOC-900-P', 'BD-GOC-990-T', 'BD-GOC-990-P', 'BD-GOCLA-900-T', 'BD-GOCLA-900-P', 'BT-GOC-900-T', 'BT-GOC-900-P', 'BT-GOC-990-T', 'BT-GOC-990-P', 'BT-GOCLA-900-T', 'BT-GOCLA-900-P']) ok(co(ma), `có mẫu ${ma}`);

  // 1. Ô hốc thiết bị: chỉ của tủ bếp; normalize giữ tb / hau / san (san chỉ cho ô sát đáy)
  { const s = C.normalize({ loai_sp: 'bep', bep: { tang: 'cao', chuc_nang: 'canh' }, khoang: [{ dot: [900, 1500], o: [{ tu: 0, kieu: 'hoc', tb: 'tl', san: true }, { tu: 900, kieu: 'hoc', tb: 'lo', san: true, hau: true }] }] });
    eq(s.khoang[0].o.map(c => [c.kieu, c.tb, c.hau, c.san]), [['hoc', 'tl', false, true], ['hoc', 'lo', true, false]], 'ô hốc: giữ tb / hậu; san chỉ ô sát đáy');
    const a = C.normalize({ khoang: [{ dot: [900], o: [{ tu: 0, kieu: 'hoc', tb: 'tl' }], mu: { ben: 'trai', rong: 300 } }] });
    ok(!a.khoang[0].o.length && !('mu' in a.khoang[0]), 'tủ áo: bỏ ô hốc và tấm che mù (chỉ của tủ bếp)', a.khoang[0]); }

  // 2. KHOANG TỦ LẠNH BC-TL: rộng = máy + 2 × hở hông 20 + 2 hồi; không đáy / xà chân (máy đứng sàn); đợt = cao máy + hở trên 50; ô trên lọt 425 có cánh
  ok(['hai_canh_700', 'bon_canh_830', 'sbs_910'].every(ma => C.LOAI_TB_BEP.tl.some(x => x.ma === ma)), 'LOAI_TB_BEP.tl: 700 / 830 / 910 (ví dụ)');
  for (const [ma, rong, may] of [['BC-TL-700', 775, 1750], ['BC-TL-830', 905, 1850], ['BC-TL-910', 985, 1890]]) {
    const s = ap(ma), M = C.build(s), dot = P2(M, 'DOT');
    ok(s.rong === rong && s.bep.chuc_nang === 'tl' && s.bep.tang === 'cao', `${ma}: rộng ${rong}`, [s.rong, s.bep.chuc_nang]);
    ok(!M.errors.length && !M.warnings.length && C.phieu(M).dat, `${ma}: sạch`, [M.errors, M.warnings]);
    ok(!P2(M, 'DAY').length && !P2(M, 'CHAN').length && P2(M, 'HOI').every(p => p.z0 === 0), `${ma}: không đáy, không xà chân, hồi xuống sàn`);
    ok(dot.length === 1 && near(dot[0].z0, may + 50) && near(dot[0].y1, 560 - 6.5), `${ma}: đợt +${may + 50} (máy + hở trên 50), sâu tới hậu`, dot.map(box));
    const tren = Math.round((2360 - t - (may + 50 + t)) * 100) / 100, canh = P2(M, 'CANH');
    ok(canh.length === 2 && canh.every(p => p.z0 > may + 50) && P2(M, 'HAU').length && P2(M, 'HAU').every(p => p.z0 > may + 50), `${ma}: ô trên lọt ${tren} — 2 cánh, hậu chỉ ở ô trên`, [canh.map(box), P2(M, 'HAU').map(box)]);
    ok(P2(M, 'TREO').length === 1 && near(P2(M, 'TREO')[0].z1, 2360 - t), `${ma}: thanh treo ô trên (vít nở vào tường)`);
    const hoc = M.info.bep.hoc.find(h => h.tb === 'tl'); ok(hoc && hoc.z0 === 0 && near(hoc.z1, may + 50), `${ma}: info.bep.hoc tủ lạnh 0 … ${may + 50}`, M.info.bep.hoc);
  }
  { const M = C.build(ap('BC-TL-830'));
    ok(near(P2(M, 'DOT')[0].z0, 1900) && near(2360 - t - 1917.5, 425), 'BC-TL-830: đợt 1900, ô trên 1917,5 … 2342,5 = 425');
    ok(M.notes.some(x => /nhô 222,5/.test(x)), 'BC-TL-830: ghi tủ lạnh nhô 222,5 trước mặt cánh (750 + 50 − 577,5)', M.notes);
    const pk = pkBep(M); ok(pk.some(x => /Ke L/.test(x.ten) && x.sl === 2) && pk.some(x => /[Vv]ít nở/.test(x.ten) && x.sl === 2), 'BC-TL: 2 ke L chân hồi + 2 vít nở (chốt: ke L + vít nở, không giằng chân)', pk.map(x => [x.ten, x.sl]));
    ok(C.keHoachGoc(ap('BC-TL-830')).loi.some(l => /hốc/.test(l)), 'BC-TL: lệnh gốc chưa vẽ được (hốc thiết bị) → nhập tấm'); }
  { const s = ap('BC-TL-830'); s.cao = 2360 - 200; const n = C.normalize(s), M = C.build(n);
    ok(n.khoang[0].canh === 0 && !P2(M, 'CANH').length && canhBep(M).some(x => /kệ hở/.test(x)), 'ô trên < 250 (cao 2160 → 225): không cánh, kệ hở + cảnh báo', [n.khoang[0].canh, canhBep(M)]);
    const n2 = JSON.parse(JSON.stringify(n)); n2.cao = 2360; ok(C.normalize(n2).khoang[0].canh === 2, 'cao trở lại 2360: tự có lại 2 cánh'); }
  { const s = ap('BC-TL-830'); s.bep.tb.tl = { ma: 'tu_chon', rong: 830, sau: 750, cao: 2300 }; ok(loiBep(C.build(C.normalize(s))).some(x => /[Tt]ủ lạnh/.test(x) && /2350/.test(x)), 'máy cao 2300: ô dưới thiếu (cần 2350) → LỖI', loiBep(C.build(C.normalize(s)))); }
  { const s = ap('BC-TL-830'); s.bep.tb.tl = { ma: 'tu_chon', rong: 900, sau: 700, cao: 1800 }; ok(loiBep(C.build(C.normalize(s))).some(x => /lọt/.test(x)), 'máy 900 trong khoang 905 (lọt 870 < 920): LỖI', loiBep(C.build(C.normalize(s)))); }
  { const s = ap('BC-TL-830'); s.bep.tb.tl = { ma: 'bon_canh_830', tan_nhiet: '' }; ok(canhBep(C.build(C.normalize(s))).some(x => /toả nhiệt|tỏa nhiệt/.test(x)), 'hở hông 20 < 50 mà chưa khai cách toả nhiệt: cảnh báo', canhBep(C.build(C.normalize(s))));
    s.bep.tb.tl.tan_nhiet = 'truoc'; ok(!canhBep(C.build(C.normalize(s))).length, 'máy toả nhiệt mặt trước: hở 20 là đủ'); }

  // 3. TỦ LÒ + VI SÓNG BC-LO-600 (hốc vi sóng 380 — anh chốt)
  { const s = ap('BC-LO-600'), M = C.build(s), dz = P2(M, 'DOT').map(p => p.z0).sort((a, b) => a - b);
    ok(!M.errors.length && !M.warnings.length && C.phieu(M).dat, 'BC-LO-600: sạch', [M.errors, M.warnings]);
    eq(dz, [842.5, 1450, 1847.5], 'BC-LO-600: đợt đỡ lò 842,5 (mặt trên = mặt đá 860), đợt 1450 (hốc lò 590), đợt 1847,5 (hốc vi sóng 380)');
    const doLo = P2(M, 'DOT').find(p => p.z0 === 842.5); ok(near(doLo.y1, 560 - 6.5 - 50) && P2(M, 'DOT').filter(p => p !== doLo).every(p => near(p.y1, 553.5)), 'đợt đỡ lò sâu = lọt − 50 (thoát nhiệt sau)', P2(M, 'DOT').map(box));
    const hoc = M.info.bep.hoc; eq(hoc.map(h => [h.tb, h.z0, h.z1, h.lot, h.sau]), [['lo', 860, 1450, 565, 553.5], ['vs', 1467.5, 1847.5, 565, 553.5]], 'hốc lò 860 … 1450 (590), vi sóng 1467,5 … 1847,5 (380); lọt 565 × 553,5');
    const hau = P2(M, 'HAU').sort((a, b) => a.z0 - b.z0); ok(hau.length === 2 && hau[0].z1 < 860 && hau[1].z0 > 1847.5, 'hậu hai đoạn: dưới đợt đỡ lò + trên hốc vi sóng', hau.map(box));
    const tp = M.templates.filter(x => x.loai === 'NGAN_KEO'); ok(tp.length === 2 && tp.every(x => x.pos[2] < 842.5), '2 ngăn kéo dưới lò', tp.map(x => x.pos));
    const canh = P2(M, 'CANH'); ok(canh.length === 1 && canh[0].z0 > 1847.5, 'ô trên cùng: 1 cánh', canh.map(box));
    ok(C.keHoachGoc(s).loi.some(l => /hốc/.test(l)), 'BC-LO: nhập tấm (hốc)');
    ok(pkBep(M).some(x => /[Ll]ò nướng/.test(x.ten)) && pkBep(M).some(x => /vi sóng/.test(x.ten)), 'phụ kiện: lò nướng + vi sóng (khách mua)', pkBep(M).map(x => x.ten)); }
  { const s = ap('BC-LO-600'); s.bep.vs = 460; const dz = P2(C.build(C.normalize(s)), 'DOT').map(p => p.z0).sort((a, b) => a - b); eq(dz, [842.5, 1450, 1927.5], 'vi sóng 460: đợt 1927,5'); }
  { const s = ap('BC-LO-600'); s.bep.vs = 0; const M = C.build(C.normalize(s)); eq(P2(M, 'DOT').map(p => p.z0).sort((a, b) => a - b), [842.5, 1450], 'không hốc vi sóng: trên lò là ô cánh'); ok(!M.errors.length && M.info.bep.hoc.length === 1, 'không vi sóng: sạch, một hốc'); }
  for (const [vt, loi] of [[17.5, false], [20, false], [15, true], [21, true]]) { const s = ap('BC-LO-600'); s.van.t = vt; ok(!!loiBep(C.build(C.normalize(s))).some(x => /560 – 568/.test(x)) === loi, `tủ lò ván ${vt} (lọt ${600 - 2 * vt}): ${loi ? 'LỖI ngoài 560 – 568' : 'vừa hốc'}`, loiBep(C.build(C.normalize(s)))); }

  // 4. KỆ HỞ + TỦ GÓC MÙ
  for (const ma of ['BD-KE-150', 'BD-KE-300', 'BT-KE-200']) { const M = C.build(ap(ma)); ok(!P2(M, 'CANH').length && P2(M, 'DOT').length === 1 && !M.errors.length && !M.warnings.length, `${ma}: không cánh, 1 đợt, sạch`, [M.errors, M.warnings]); }
  eq(C.GOC_MAC_DINH, 'hg_lh', 'góc mặc định: Higold liên hoàn 900 / 400 (anh chốt)');
  eq(['eu_lh', 'hg_lh', 'eu_la'].map(pk => { const q = C.gocBep(pk); return [q.Wg, q.c, q.mu, q.X]; }), [[990, 450, 538, 89.5], [900, 400, 498, 129.5], [900, 450, 448, 179.5]], 'gocBep: Wg / c / che mù / X (cách tường B) = 89,5 / 129,5 / 179,5');
  eq(['eu_lh', 'hg_lh'].map(pk => { const q = C.gocBep(pk); return [q.Wg_t, q.c_t]; }), [[1059.5, 660], [1009.5, 610]], 'gocBep: tủ trên góc Wg_t / c_t (mối nối trùng tủ dưới)');
  ok(C.gocBep('hg_lh', { nep: 50, chuan: { sau_duoi: 400 } }).loi.length > 0, 'gocBep: tủ góc quá rộng so với cánh (X < 0) → lỗi');
  for (const [ma, Wg, c, pk] of [['BD-GOC-900-T', 900, 400, 'goc_lh_hg'], ['BD-GOC-990-T', 990, 450, 'goc_lh_eu'], ['BD-GOCLA-900-P', 900, 450, 'goc_la']]) {
    const s = ap(ma), M = C.build(s), mu = P2(M, 'MU'), canh = P2(M, 'CANH'), trai = /-T$/.test(ma);
    ok(s.rong === Wg && !M.errors.length && !M.warnings.length && C.phieu(M).dat, `${ma}: rộng ${Wg}, sạch`, [M.errors, M.warnings]);
    ok(!P2(M, 'VACH').length && s.khoang.length === 1, `${ma}: một khoang, không vách giữa (rổ góc cần cả lọt lòng)`);
    ok(mu.length === 1 && near(mu[0].y0, -tc) && near(mu[0].y1, 0) && (trai ? near(mu[0].x1, Wg - c - 2) : near(mu[0].x0, c + 2)), `${ma}: tấm che mù phẳng mặt cánh, rộng tới Wg − c − khe`, mu.map(box));
    ok(canh.length === 1 && (trai ? near(canh[0].x0, Wg - c) && canh[0].open === 2 : near(canh[0].x1, c) && canh[0].open === 1), `${ma}: một cánh ${c} phía hở, bản lề phía ngoài`, canh.map(p => [p.x0, p.x1, p.open]));
    ok(M.info.bep.ro.some(r => r.pk === pk), `${ma}: rổ góc ${pk}`, M.info.bep.ro);
    ok(C.nhomMau([{ ten: mu[0].ten }])[0] === 'mat' && C.NHOM.MU === 'Cánh', `${ma}: tấm che mù nhóm màu mặt, kê nhóm Cánh`);
    ok(C.keHoachGoc(s).loi.length > 0, `${ma}: nhập tấm`);
  }
  { const s = ap('BD-GOC-900-T'); s.rong = 860; ok(loiBep(C.build(C.normalize(s))).length > 0, 'tủ góc Higold 860 (lọt 825 < rổ 860): LỖI'); }
  { const s = ap('BD-GOC-900-T'); s.bep.goc_pk = 'eu_lh'; const n = C.normalize(s), M = C.build(n);
    ok(!M.errors.length && n.khoang[0].mu.rong === 448 && near(P2(M, 'CANH')[0].x0, 450), 'đổi phụ kiện góc sang Eurogold trong tủ 900 (hãng nhận góc 900 – 1000): cánh theo hãng 450, phần mù 448', [M.errors, n.khoang[0].mu]); }
  { const s = ap('BD-GOC-900-T'); s.rong = 420; ok(C.build(C.normalize(s)).errors.length > 0, 'tủ góc hẹp hơn cánh + khe: LỖI'); }
  for (const [ma, W, ct] of [['BT-GOC-900-T', 1009.5, 610], ['BT-GOC-990-P', 1059.5, 660]]) {
    const s = ap(ma), M = C.build(s), mu = P2(M, 'MU'), canh = P2(M, 'CANH');
    ok(near(s.rong, W) && !M.errors.length && !M.warnings.length, `${ma}: rộng ${W}, sạch`, [s.rong, M.errors, M.warnings]);
    const x0 = Math.min(...canh.map(p => p.x0)), x1 = Math.max(...canh.map(p => p.x1));
    ok(canh.length === 2 && mu.length === 1 && near(x1 - x0 + 2, ct, 0.6), `${ma}: 2 cánh trong vùng ${ct}, phần mù che bằng tấm`, [canh.map(box), mu.map(box)]);
  }

  // 5. NẸP BÙ = PHÀO (thùng giữ cỡ chuẩn) · ỐP HÔNG ĐẦU HỞ · đá nhô 20
  { const s = ap('BD-NK3-600'); s.rong = 650; s.bep.nep = { trai: 50 }; const n = C.normalize(s), M = C.build(n);
    ok(n.phao.trai === 50 && n.phao.phai === 0 && n.bep.nep.thung === 600 && !M.errors.length && !M.warnings.length, 'nẹp trái 50: phào trái 50, thùng 600, sạch', [n.phao, n.bep.nep, M.errors, M.warnings]);
    const ph = P2(M, 'PHAO')[0], phu = P2(M, 'PHU')[0], hoi = P2(M, 'HOI').sort((a, b) => a.x0 - b.x0)[0];
    ok(near(ph.x0, 0) && near(ph.x1, 50) && near(ph.z0, 100) && near(ph.z1, 840) && near(hoi.x0, 50), 'phào nẹp: z chân … đỉnh thân, hồi trái ở x 50', [box(ph), box(hoi)]);
    ok(phu && near(phu.z0, 100) && near(phu.x1, 50), 'phụ trợ phào (thanh lùi chống vênh) từ chân lên', phu && box(phu));
    const xc = P2(M, 'CHAN').find(p => near(p.x0, 0)); ok(xc && near(xc.x1, 50) && near(xc.y1, 50) && near(xc.z1, 100), 'xà chân chạy dưới phào tới tường (lùi 50)', P2(M, 'CHAN').map(box));
    eq(overlapAny(M), [], 'nẹp: không tấm nào đè nhau'); ok(!M.kq.some(x => x.ma === 'lien_ket'), 'nẹp: tấm nào cũng có chỗ tì');
    ok(M.templates.filter(x => x.loai === 'NGAN_KEO').every(x => near(x.box[0], 565)), 'hộp ngăn kéo vẫn theo thùng 600 (lọt 565)');
    ok(M.da && near(M.da.dai, 650), 'đá phủ cả nẹp (650)'); }
  { const s = ap('BD-NK3-600'); s.rong = 670; s.bep.nep = { phai: 70 }; const n = C.normalize(s), h = C.heSo(n);
    // (vòng soát 2 — 1.34) thu Rộng quá bề nẹp là gãy khúc (thùng hẹp lại, phào mất) → Rộng của module chỉ để xem; Sâu / Cao vẫn co giãn
    ok(!h.bien.L && h.ly_do.L === 'khong_deu' && h.bien.W && h.bien.H, 'tủ có nẹp: module co giãn W / H, Rộng chỉ để xem', h.ly_do);
    const n2 = JSON.parse(JSON.stringify(n)); n2.rong = 700; const m2 = C.normalize(n2); ok(m2.bep.nep.phai === 100 && m2.bep.nep.thung === 600, 'Rộng 700: nẹp phải 100, thùng giữ 600', m2.bep.nep); }
  { const s = ap('BD-NK3-600'); s.rong = 650; s.bep.nep = { trai: 50, goc: 'trai' }; const M = C.build(C.normalize(s)), d = P2(M, 'PHU').filter(p => p.y1 > 100);
    ok(d.length >= 1 && d.every(p => near(p.y1, 560)) && d.some(p => near(p.z1, 840) && p.x0 <= 20 + 0.01 && p.x1 >= 20 - 0.01) && !overlapAny(M).length, 'nẹp góc: phụ trợ đỡ đá chạy suốt chiều sâu ở đỉnh thân, dưới đầu đá cạnh kia (vòng soát 3)', d.map(box)); }
  { const s = ap('BT-CANH-600'); s.rong = 650; s.bep.nep = { trai: 50 }; const M = C.build(C.normalize(s)), ph = P2(M, 'PHAO')[0];
    ok(ph && near(ph.z0, 0) && near(ph.z1, 800) && !M.errors.length && !M.warnings.length, 'tủ trên: phào nẹp cả cao 800', ph && box(ph)); }
  { const s = ap('BD-GV-400'); s.rong = 417.5; s.bep.op = 'phai'; const n = C.normalize(s), M = C.build(n), op = P2(M, 'OP');
    ok(n.phao.phai === tc && !M.errors.length && !M.warnings.length, 'ốp hông phải: thùng 400 + ốp 17,5, sạch', [n.phao, M.errors, M.warnings]);
    ok(op.length === 1 && near(op[0].x0, 400) && near(op[0].x1, 417.5) && near(op[0].y0, -tc) && near(op[0].y1, 560) && near(op[0].z0, 0) && near(op[0].z1, 840), 'tấm ốp hông: dày cánh, phẳng mặt cánh, xuống sàn', op.map(box));
    ok(op[0].khoan === C.KHONG_KHOAN && /ốp/i.test(op[0].ten) && C.nhomMau([{ ten: op[0].ten }])[0] === 'mat', 'ốp hông: keo + vít (không khoan), nhóm màu mặt');
    ok(!P2(M, 'PHAO').length && M.da && near(M.da.dai, 437.5) && M.da.x0 === 0, 'không phào ở đầu ốp; đá nhô 20 qua ốp (437,5)', M.da);
    ok(M.info.bep.ro.every(r => near(r.lot, 365)) && !loiBep(M).length, 'rổ gia vị vẫn lọt 365 (thùng 400)'); eq(overlapAny(M), [], 'ốp: không đè nhau'); }
  { const s = ap('BT-CANH-400'); s.rong = 417.5; s.bep.op = 'trai'; const M = C.build(C.normalize(s)), op = P2(M, 'OP');
    ok(op.length === 1 && near(op[0].x0, 0) && near(op[0].z1, 800) && !M.errors.length && !M.warnings.length, 'tủ trên ốp hông trái', [op.map(box), M.errors, M.warnings]); }

  // 6. normBep giữ khoá dãy; tủ áo không mang
  { const s = ap('BD-CANH-600'); s.bep.day = { ma: 'B1', vt: 'A3', rac: 1 }; s.bep.op = 'la'; const n = C.normalize(s);
    eq([n.bep.day, 'op' in n.bep, 'nep' in n.bep, 'vs' in n.bep, 'goc_pk' in n.bep], [{ ma: 'B1', vt: 'A3' }, false, false, false, false], 'normBep: giữ day {ma, vt}; op lạ / nẹp rỗng / vs / goc_pk không thêm vào tủ khác');
    const a = C.normalize(Object.assign(JSON.parse(JSON.stringify(n)), { loai_sp: '' })); ok(!('bep' in a), 'tủ áo: bỏ cả khối bếp'); }
  { const s0 = ap('BD-NK3-600'), M0 = C.build(s0); const s1 = C.normalize(s0); ok(JSON.stringify(s1) === JSON.stringify(C.normalize(s1)) && !('nep' in s1.bep) && s1.phao.trai === 0, 'mẫu bếp cũ: normalize ổn định, không thêm khoá'); }

  // 7. Rộng lẻ: chỉ tủ cánh / kệ / tủ che ống kính
  eq(['BD-CANH-450', 'BT-CANH-600', 'BD-KE-200', 'BT-HMK-700', 'BD-NK3-600', 'BD-XN-800', 'BD-CHAU-900', 'BT-HM-800', 'BD-GOC-900-T', 'BC-TL-830', 'BC-LO-600'].map(ma => C.leDuocBep(ap(ma))),
    [true, true, true, true, false, false, false, false, false, false, false], 'leDuocBep: chỉ cánh, kệ, che ống kính được cỡ lẻ');

  // 8. Mọi mẫu mới: dựng sạch, không đè nhau, có chỗ tì, module co giãn L / W / H, ±60 giữ số tấm
  for (const m of MAU.filter(m => /^B[DTC]-(TL|LO|KE|GOC)/.test(m.ma))) {
    const s = C.apMau(D, m.ma), M = C.build(s);
    ok(!M.errors.length && !M.warnings.length && C.phieu(M).dat, `${m.ma}: sạch, phiếu đạt`, [M.errors, M.warnings]);
    eq(overlapAny(M), [], `${m.ma}: không tấm nào đè nhau`);
    ok(!M.kq.some(x => x.ma === 'lien_ket'), `${m.ma}: tấm nào cũng có chỗ tì`, M.kq.filter(x => x.ma === 'lien_ket'));
    const h = C.heSo(s); ok(['L', 'W', 'H'].every(x => h.bien[x]), `${m.ma}: module co giãn L / W / H`, h.ly_do);
    for (const [kh, d] of [['rong', 60], ['rong', -60], ['sau_thung', 60], ['cao', -60]]) { const s1 = JSON.parse(JSON.stringify(s)); s1[kh] += d; const M1 = C.build(s1); ok(M1.parts.length === M.parts.length && M1.kq.every(x => x.muc !== 'loi' || x.ma === 'bep'), `${m.ma}: ${kh} ${d > 0 ? '+' : ''}${d} giữ số tấm`, [M1.parts.length, M.parts.length, M1.errors]); }
    ok(/<svg/.test(C.elevationSVG(M)) && /<svg/.test(C.hinh3D(M)), `${m.ma}: vẽ được hình đứng + 3D`);
  }
});

// Bản 1.34 — DÃY BẾP, bước 2: bảng tự chia chữ I / chữ L (thiết kế §2, §4 – §7, §10). Hàm thuần: chuanBo → xepBep → { pa: [phương án] }, tuBo (spec từng tủ),
// daDay (đá theo dãy), kiemDay (LỖI / CẢNH BÁO / LƯU Ý cả dãy), keoBo (kéo chậu / bếp / tủ lạnh). Mỗi tủ vẫn là MỘT spec = MỘT module.
// Toạ độ: s = dọc cạnh theo trục x của tủ (trái → phải khi nhìn mặt tủ); u = khoảng cách tính từ GÓC TRONG (chữ L) hoặc từ đầu trái (chữ I).
// Dãy mẫu: E1 đúng số thiết kế; E2 tính lại với góc mặc định Higold liên hoàn 900 / 400 (anh chốt); E3 theo đúng hàm chi phí của thiết kế (sơ chế 800 tốt hơn 600 — xem ghi chú).
T('Dãy bếp (bản 1.34) — tự chia chữ I / chữ L', () => {
  const k = require.resolve('../src/mncf-core.js'), cu = require.cache[k]; delete require.cache[k]; const C = require(k); require.cache[k] = cu;
  C.DEFAULT_SPEC.thung.noc_day = 'lot'; C.DEFAULT_SPEC.ngan_keo.khung_mat = 0;
  const t = C.DEFAULT_SPEC.van.t;
  const tang = (pa, tg, canh) => pa.ds.filter(m => m.tang === tg && (canh === undefined || m.canh === canh)).sort((a, b) => a.u0 - b.u0);
  const duoi = (pa, canh) => pa.ds.filter(m => (m.tang === 'duoi' || m.tang === 'cao') && (canh === undefined || m.canh === canh)).sort((a, b) => a.u0 - b.u0);
  const tom = ds => ds.map(m => [m.ma, m.u0, m.u1]);
  const nepCua = m => [m.nep ? m.nep.trai || 0 : 0, m.nep ? m.nep.phai || 0 : 0], eqJ = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // ---- chuanBo: mặc định + lọc rác ----
  { const b = C.chuanBo();
    eq([b.v, b.kieu, b.canh.length, b.canh[0].dau, b.canh[0].cuoi, b.tl && b.tl.may, b.tl && b.tl.dau, b.cao, b.hm, b.vs, b.goc], [2, 'I', 1, 'tuong', 'tuong', 'hai_canh_700', 'dau', [], 'am', 380, null], 'chuanBo mặc định: chữ I hai đầu tường, tủ lạnh 700 đầu trái, hút mùi âm, vi sóng 380 (1.35: bộ v 2)');
    eq([b.co, b.chau.co, b.bep.co, b.ro, b.tran, b.kinh, b.led, b.tl.kieu, b.tl2], [null, null, null, ['gv', 'rac'], 2700, 'bat', true, 'duong', null], '(1.35) mặc định: cỡ chậu = bếp tự chọn, rổ gia vị + thùng rác, trần 2700 (tầng trên kịch trần), kính ở tủ giá bát, LED, tủ lạnh dương, một tủ lạnh');
    const L = C.chuanBo({ kieu: 'L' });
    eq([L.canh.map(c => [c.dau, c.cuoi]), L.canh[1].re, L.goc.pk, L.goc.nep, L.goc.nep_tren], [[['tuong', 'goc'], ['goc', 'tuong']], 'phai', 'hg_lh', 50, 50], 'chữ L: A vào góc, B ra khỏi góc, góc mặc định Higold liên hoàn 900 / 400 (anh chốt)');
    const r = C.chuanBo({ kieu: 'X', canh: [{ dai: 'abc', dau: 'cua' }], tl: { may: 'la', ho_hong: -5 }, cao: [{ loai: 'lo' }, { loai: 'kho', rong: 999 }, 7], hm: 'z', vs: 12, khoa: { A1: { ma: 'XX' }, A2: { ma: 'BD-NK3-600', s0: 100 } }, chuan: { cao_mat: 870, la: 1 }, da_ve: [1], tu_id: 'x' });
    ok(r.kieu === 'I' && r.canh[0].dai > 0 && r.canh[0].dau === 'tuong' && r.tl.may === 'hai_canh_700' && r.tl.ho_hong === 20, 'chuanBo: rác → mặc định', r);
    eq(r.cao, [{ loai: 'lo', rong: 600 }, { loai: 'kho', rong: 400 }], 'chuanBo: tủ cao lò 600, kho cỡ lạ → 400, mục rác bỏ');
    ok(r.hm === 'am' && r.vs === 380 && !('A1' in r.khoa) && r.khoa.A2.ma === 'BD-NK3-600' && r.chuan.cao_mat === 870 && !('la' in r.chuan) && !('da_ve' in r) && !('tu_id' in r), 'chuanBo: bỏ khoá lạ, ghim mẫu lạ, KHÔNG nhận da_ve / tu_id', r);
    ok(C.chuanBo({ tl: null }).tl === null, 'tl: null = không tủ lạnh'); }

  // ---- E1: chữ I 4500, hai đầu tường, tủ lạnh 830 đầu trái (bản lề phía tường), ống ở 3700 ----
  // (1.35 — luật chia mới, ghim lại số) phần dãy dưới 3465 ≥ 3400 → chậu = bếp 900; ống 3700 giữ chậu ở 3230 … 4130 (tâm 3680) + thùng rác 300 sát tường phải;
  // bên trái: gia vị 300 kề bếp phía xa chậu; còn 1065 chia đều 3 khoang 355 (2 khoang 530 thì bếp cách tủ lạnh 300 < 500 / sơ chế 530 — đắt hơn).
  // Nẹp: hai đầu tường chia đều phần dư (tủ lạnh bản lề phía tường: nẹp ≥ 50) → 60 / 70. Tủ trên trùng mối nối; tầng trên kịch trần 330 (2700 − 2360 − 10) cả trên tủ lạnh.
  const bo1 = { kieu: 'I', canh: [{ dai: 4500 }], tl: { may: 'bon_canh_830', dau: 'dau', ban_le: 'tuong' }, ong: { canh: 0, s: 3700 } };
  const r1 = C.xepBep(bo1), p1 = r1.pa[0];
  ok(r1.pa.length >= 1 && r1.pa.length <= 3 && !r1.loi_chung.length && r1.pa.every(p => !p.loi.length), 'E1: có 1 – 3 phương án, không LỖI', [r1.loi_chung, r1.pa.map(p => p.loi)]);
  eq(tom(duoi(p1)), [['BC-TL-830', 0, 965], ['BD-CANH-355', 965, 1320], ['BD-GV-300', 1320, 1620], ['BD-BEP-900', 1620, 2520], ['BD-CANH-355', 2520, 2875], ['BD-CANH-355', 2875, 3230], ['BD-CHAU-900', 3230, 4130], ['BD-RAC-300', 4130, 4500]], 'E1 (1.35): TL | cánh 355 | gia vị | bếp 900 | cánh 355 × 2 | chậu 900 | thùng rác');
  { const d = duoi(p1); eq([nepCua(d[0]), d[0].rong, nepCua(d[7]), d[7].rong], [[60, 0], 905, [0, 70], 300], 'E1: nẹp 60 (phào trái khoang tủ lạnh 905), nẹp 70 (phào phải tủ rác) — dư chia hai tường'); }
  eq(tom(tang(p1, 'tren').filter(m => !m.t2)), [['BT-CANH-355', 965, 1320], ['BT-CANH-300', 1320, 1620], ['BT-HM-900', 1620, 2520], ['BT-CANH-355', 2520, 2875], ['BT-CANH-355', 2875, 3230], ['BT-BAT-900', 3230, 4130], ['BT-CANH-300', 4130, 4500]], 'E1: tầng dưới tủ trên — mối nối trùng dãy dưới, hút mùi rộng đúng tủ bếp 900, không tủ trên trên khoang tủ lạnh');
  eq(tom(tang(p1, 'tren').filter(m => m.t2)).map(x => [x[1], x[2]]), [[0, 965]].concat(duoi(p1).slice(1).map(m => [m.u0, m.u1])), 'E1: tầng trên kịch trần — thẳng mối nối, cả trên khoang tủ lạnh');
  ok(tang(p1, 'tren').every(m => m.z === (m.t2 ? 2360 : 1560) && (!m.t2 || m.cao === 330)) && duoi(p1).every(m => m.z === 0) && nepCua(tang(p1, 'tren').filter(m => !m.t2)[6])[1] === 70 && eqJ(p1.tang2, { z: 2360, cao: 330 }), 'E1: tủ trên z 1560, tầng trên z 2360 cao 330, nẹp trên = nẹp dưới cùng đầu');
  ok(p1.ds.every(m => !m.le) && duoi(p1).filter(m => /CANH|NK3/.test(m.ma)).every(m => m.rong === 355), 'E1: không tủ cỡ lẻ, các khoang chia đều cùng 355');
  eq(p1.so_che, 710, 'E1: sơ chế 710 (2 khoang 355)');
  ok(p1.canh_bao.some(x => /tam giác/i.test(x) && /3167,5/.test(x)), 'E1: cảnh báo tam giác — cạnh tủ lạnh ↔ chậu 3167,5 > 2700', p1.canh_bao);
  ok(p1.luu_y.some(x => /nhô/.test(x) && /222,5/.test(x)) && p1.luu_y.some(x => /sơ chế 710/.test(x)), 'E1: lưu ý tủ lạnh nhô 222,5, sơ chế nên 800', p1.luu_y);
  ok(!p1.canh_bao.some(x => /sơ chế|mặt đặt đồ|500/.test(x)), 'E1: sơ chế ≥ 600, mặt đặt đồ cạnh tủ lạnh, bếp cách tủ lạnh ≥ 500 đều đạt', p1.canh_bao);
  eq(p1.da.map(d => [d.canh, d.s0, d.s1, d.sau, d.tam.map(x => x.dai), d.noi]), [[0, 965, 4500, 597.5, [1910, 1625], [2875]]], 'E1: đá 965 → 4500 (3535 > 3200) nối ở 2875 (mối nối tủ cách khoét ≥ 150): 1910 + 1625 × 597,5');
  ok(p1.luu_y.some(x => /đá/i.test(x) && /2 tấm/.test(x)), 'E1: lưu ý đá ghép 2 tấm', p1.luu_y);
  eq(C.kiemDay(bo1, p1).loi, [], 'E1: kiemDay không LỖI');

  // tuBo: spec từng tủ — dựng sạch, rộng / nẹp / chỗ đúng
  { const tu = C.tuBo(bo1, p1);
    eq(tu.length, p1.ds.length, 'tuBo: một spec mỗi tủ');
    for (const x of tu) { const M = C.build(x.spec), bb = C.bbox(M.parts), m = p1.ds.find(q => q.vt === x.vt);
      ok(!M.errors.length && M.kq.every(q => q.muc !== 'loi'), `tuBo ${x.vt} ${m.ma}: dựng không lỗi`, [M.errors, M.kq.filter(q => q.muc === 'loi')]);
      ok(near(x.spec.rong, m.u1 - m.u0) && near(bb.x1 - bb.x0, m.u1 - m.u0) && x.spec.bep.day.ma === 'B1' && x.spec.bep.day.vt === x.vt, `tuBo ${x.vt}: rộng module ${m.u1 - m.u0}, mang mã dãy`, [x.spec.rong, bb.x1 - bb.x0, x.spec.bep.day]);
      ok(x.z === m.z && x.s0 === m.s0 && near(x.P, m.tang === 'tren' && !m.sau_cao ? 367.5 : 577.5), `tuBo ${x.vt}: z ${m.z}, sâu phủ bì ${x.P}`, [x.z, x.s0, x.P]); }
    const tl = tu.find(x => x.spec.bep.chuc_nang === 'tl'); ok(tl.spec.phao.trai === 60 && tl.spec.bep.nep.thung === 905 && tl.spec.bep.tb.tl.ma === 'bon_canh_830', 'tuBo: khoang tủ lạnh 905 + phào trái 60', [tl.spec.phao, tl.spec.bep.nep]);
    ok(tu.every(x => !/undefined|NaN/.test(JSON.stringify(x.spec))), 'tuBo: spec sạch');
    // (1.35) tầng trên: tang2, cao riêng 330, đặt ở 2360; trên khoang tủ lạnh sâu theo tủ cao; kính ở tủ giá bát; LED mọi tủ trên tầng dưới trừ hút mùi, nguồn ở tủ đầu
    const t2 = tu.filter(x => p1.ds.find(m => m.vt === x.vt).t2);
    ok(t2.length === 8 && t2.every(x => x.spec.bep.tang2 === 1 && x.spec.cao === 330 && x.z === 2360) && t2.find(x => x.vt === 'AU1').spec.sau_thung === 560 && t2.filter(x => x.vt !== 'AU1').every(x => x.spec.sau_thung === 350), 'tuBo: tầng trên 8 tủ cao 330 ở +2360, tủ trên khoang tủ lạnh sâu 560', t2.map(x => [x.vt, x.spec.cao, x.spec.sau_thung, x.z]));
    const tr = tu.filter(x => x.tang === 'tren' && !p1.ds.find(m => m.vt === x.vt).t2);
    eq(tr.filter(x => x.spec.bep.kinh).map(x => p1.ds.find(m => m.vt === x.vt).ma), ['BT-BAT-900'], 'tuBo: cánh khung kính ở tủ giá bát (mặc định)');
    ok(tr.filter(x => x.spec.bep.led).length === 6 && !tr.find(x => x.spec.bep.chuc_nang === 'hm').spec.bep.led && tr.filter(x => x.spec.bep.led_nguon).length === 1, 'tuBo: LED 6 tủ trên (trừ hút mùi), một tủ mang nguồn', tr.map(x => [x.vt, x.spec.bep.led, x.spec.bep.led_nguon])); }

  // ---- E2: chữ L — A 3050 (đầu xa tường), B 2450 (đầu xa hở), góc Higold liên hoàn 900 / 400, ống ở u_A 2130, bếp trên B ----
  // (1.35 — ghim lại số) X = 577,5 + 50 − 498 = 129,5 → tủ góc 129,5 … 1029,5 (góc không phình: dư vào nẹp tường trước). Hai cạnh 1950,5 + 1805 ≥ 3400 → chậu = bếp 900.
  // Cạnh A: chậu theo ống (tâm 2229,5, lệch 99,5 ≤ 150), thùng rác kề chậu phía xa bếp, còn 750 = 1 khoang cánh, nẹp tường 70,5.
  // Cạnh B: tủ đầu mang nẹp góc 50 (chia đều phần còn lại = 1 khoang 605, kề bếp → ngăn kéo), bếp 900, gia vị kề bếp phía xa chậu + ốp đầu hở.
  const bo2 = { kieu: 'L', canh: [{ dai: 3050, dau: 'tuong' }, { dai: 2450, cuoi: 'ho' }], tl: null, ong: { canh: 0, s: 3050 - 2130 }, bep: { canh: 1 } };
  const r2 = C.xepBep(bo2), p2 = r2.pa[0];
  ok(p2 && !p2.loi.length, 'E2: có phương án không LỖI', [r2.loi_chung, p2 && p2.loi]);
  eq(tom(duoi(p2, 0)), [['BD-GOC-900-P', 129.5, 1029.5], ['BD-CANH-750', 1029.5, 1779.5], ['BD-CHAU-900', 1779.5, 2679.5], ['BD-RAC-300', 2679.5, 3050]], 'E2 (1.35): dưới A (u từ góc) — tủ góc mù Higold 900 mù phải, cánh 750, chậu 900 tâm 2229,5, thùng rác');
  eq(tom(duoi(p2, 1)), [['BD-NK3-605', 577.5, 1232.5], ['BD-BEP-900', 1232.5, 2132.5], ['BD-GV-300', 2132.5, 2450]], 'E2 (1.35): dưới B — ngăn kéo 605 mang nẹp góc 50, bếp 900, gia vị + ốp đầu hở');
  { const a = duoi(p2, 0), b = duoi(p2, 1);
    eq([a[3].nep && a[3].nep.trai, a[3].s0, b[0].nep, b[0].rong, b[2].op, b[2].rong], [70.5, 0, { trai: 50, goc: 'trai' }, 605, 'phai', 300], 'E2: nẹp tường A 70,5 (trái theo trục tủ), nẹp góc B 50 (phụ trợ suốt sâu), ốp hông phải');
    eq([a[0].s0, a[0].ben], [3050 - 1029.5, 'phai'], 'E2: cạnh A — tủ góc ở bên phải theo trục tủ (s0 = 2020,5)'); }
  eq(tom(tang(p2, 'tren', 0).filter(m => !m.t2)), [['BT-GOC-900-P', 20, 1029.5], ['BT-CANH-750', 1029.5, 1779.5], ['BT-BAT-900', 1779.5, 2679.5], ['BT-CANH-300', 2679.5, 3050]], 'E2: trên A — tủ trên góc 1009,5 (cách tường 20), mối nối trùng dưới');
  eq(tom(tang(p2, 'tren', 1).filter(m => !m.t2)), [['BT-CANH-815', 367.5, 1232.5], ['BT-HM-900', 1232.5, 2132.5], ['BT-CANH-300', 2132.5, 2450]], 'E2: trên B — tủ đầu 815 + nẹp góc 50 (mối nối từ tủ thứ hai trùng dưới), hút mùi 900');
  { const b1 = tang(p2, 'tren', 1)[0]; ok(!b1.le && b1.rong === 815 && b1.nep.trai === 50, 'E2: tủ trên đầu cạnh B 815 (không còn tính là cỡ lẻ — 1.35), phào trái 50', b1); }
  eq(tom(tang(p2, 'tren', 0).filter(m => m.t2)).map(x => x[0]), ['BT-GOC-900-P', 'BT-CANH-750', 'BT-CANH-900', 'BT-CANH-300'], 'E2: tầng trên kịch trần cạnh A — trên góc cũng là tủ góc mù (tủ đầu cạnh B che phần mù)');
  eq([p2.goc.pk, p2.goc.X, p2.goc.Wg, p2.goc.c, p2.goc.Wg_t, p2.goc.c_t, p2.goc.d], ['hg_lh', 129.5, 900, 400, 1009.5, 610, 0], 'E2: góc — X 129,5, tủ trên góc 1009,5, cánh trên 610');
  eq(p2.so_che, 1857, 'E2: sơ chế qua góc (1779,5 − 577,5) + (1232,5 − 577,5) = 1857');
  ok(r2.pa.every(p => p.goc.d === 0), 'E2 (1.35): dư dồn vào nẹp tường — tủ góc không phình ở phương án nào', r2.pa.map(p => p.goc.d));
  eq(p2.da.map(d => [d.canh, d.u0, d.u1, d.tam.length]), [[0, 0, 3050, 1], [1, 597.5, 2470, 1]], 'E2: đá A 0 → 3050 chạy suốt vào góc, B 597,5 → 2470 (nhô 20 qua ốp)');
  ok(p2.canh_bao.some(x => /bản lề/.test(x) && /góc/.test(x)) && !p2.canh_bao.some(x => /cỡ lẻ/.test(x)), 'E2: cảnh báo bản lề tủ góc [CĐ], không còn cảnh báo tủ cỡ lẻ', p2.canh_bao);
  { const tu = C.tuBo(bo2, p2);
    for (const x of tu) { const M = C.build(x.spec), m = p2.ds.find(q => q.vt === x.vt); ok(!M.errors.length && M.kq.every(q => q.muc !== 'loi') && near(x.spec.rong, m.u1 - m.u0), `E2 tuBo ${x.vt} ${m.ma}: dựng không lỗi, rộng ${m.u1 - m.u0}`, [M.errors, M.kq.filter(q => q.muc === 'loi'), x.spec.rong]); }
    const gt = tu.find(x => x.vt === tang(p2, 'tren', 0).filter(m => !m.t2)[0].vt), M = C.build(gt.spec), cs = M.parts.filter(p => p.loai === 'CANH');
    // cạnh A: trục tủ ngược u (s = 3050 − u) → vùng cánh trên u 419,5 … 1029,5 = x 0 … 610 của tủ trên góc (gốc x ở u 1029,5)
    ok(cs.length === 2 && near(Math.min(...cs.map(p => p.x0)), 0, 1.1) && near(Math.max(...cs.map(p => p.x1)), 610, 1.1), 'E2: tủ trên góc — 2 cánh trong vùng 610 sát mép tủ kề (mối nối trùng)', cs.map(box));
    const b1 = tu.find(x => x.vt === duoi(p2, 1)[0].vt); ok(b1.spec.bep.nep.goc === 'trai' && b1.spec.phao.trai === 50, 'E2: tủ B1 dưới — nẹp góc có phụ trợ suốt sâu đỡ đầu đá B'); }
  { const r = C.xepBep(Object.assign({}, bo2, { bep: {} })); ok(r.pa[0] && JSON.stringify(tom(r.pa[0].ds)) === JSON.stringify(tom(p2.ds)), 'E2: bếp để tự (cạnh A / B) → cùng phương án'); }

  // ---- E3: chữ I 3170, hai đầu tường, không tủ cao, ống ở 2300 ----
  // (1.35 — ghim lại số) dãy dưới 3030: 2600 ≤ 3030 < 3400 → chậu = bếp 800; ống 2300 → chậu 2000 … 2800 (tâm 2400); thùng rác kề chậu, gia vị kề bếp,
  // còn 830 = MỘT khoang giữa chậu và bếp (kề bếp → ngăn kéo), sơ chế 830; nẹp hai tường 70 / 70. Phương án sau: cùng chỗ, khoang giữa chia 2 × 415.
  const bo3 = { kieu: 'I', canh: [{ dai: 3170 }], tl: null, ong: { canh: 0, s: 2300 } };
  const r3 = C.xepBep(bo3), p3 = r3.pa[0];
  eq(tom(duoi(p3)), [['BD-GV-300', 0, 370], ['BD-BEP-800', 370, 1170], ['BD-NK3-830', 1170, 2000], ['BD-CHAU-800', 2000, 2800], ['BD-RAC-300', 2800, 3170]], 'E3 (1.35): nẹp 70 | gia vị 300 | bếp 800 | ngăn kéo 830 | chậu 800 (tâm 2400) | thùng rác 300 | nẹp 70');
  eq([nepCua(duoi(p3)[0]), nepCua(duoi(p3)[4])], [[70, 0], [0, 70]], 'E3: hai nẹp 70 / 70');
  eq(tom(tang(p3, 'tren').filter(m => !m.t2)).map(x => x[0]), ['BT-CANH-300', 'BT-HM-800', 'BT-CANH-830', 'BT-BAT-800', 'BT-CANH-300'], 'E3: dãy trên trùng mối nối dưới');
  ok(p3.ds.every(m => !m.le) && p3.so_che === 830 && !p3.loi.length, 'E3: không tủ lẻ, sơ chế 830', [p3.so_che]);
  ok(r3.pa.some(p => JSON.stringify(tom(duoi(p)).map(x => x[0])) === JSON.stringify(['BD-GV-300', 'BD-BEP-800', 'BD-NK3-415', 'BD-CANH-415', 'BD-CHAU-800', 'BD-RAC-300'])), 'E3: phương án hai khoang 415 chia đều (kề bếp ngăn kéo) có trong danh sách', r3.pa.map(p => tom(duoi(p)).map(x => x[0])));

  // ---- kiemDay: từng LỖI / CẢNH BÁO / LƯU Ý một ca ----
  const sua = (pa, f) => { const q = JSON.parse(JSON.stringify(pa)); f(q); return q; };
  { const q = sua(p1, q => { duoi(q)[3].u1 += 10; duoi(q)[3].rong += 10; }); ok(C.kiemDay(bo1, q).loi.some(x => /tổng|dài/i.test(x)), 'kiemDay: tổng ≠ dài → LỖI'); }
  { const q = sua(p1, q => { const d = duoi(q), m = d[d.length - 1]; m.nep.phai = 40; m.u1 -= 30; }); ok(C.kiemDay(bo1, q).loi.some(x => /nẹp/.test(x) && /40/.test(x)), 'kiemDay: nẹp 40 < 50 → LỖI'); }
  { const q = sua(p1, q => { const d = duoi(q), b = d.find(m => m.chuc === 'bep'); b.u0 = d[0].u1; b.u1 = b.u0 + 900; b.s0 = b.u0; });
    ok(C.kiemDay(bo1, q).loi.some(x => /bếp/i.test(x) && /tủ lạnh/.test(x)), 'kiemDay: bếp sát khoang tủ lạnh (< 300) → LỖI'); }
  ok(C.kiemDay(Object.assign({}, bo1, { ong: { canh: 0, s: 2700 } }), p1).loi.some(x => /ống/.test(x)), 'kiemDay: ống thoát ngoài lọt tủ chậu → LỖI');
  { const r = C.xepBep(Object.assign({}, bo1, { tl: { may: 'bon_canh_830', dau: 'dau', ban_le: 'trong' } })); ok(r.pa[0] && r.pa[0].canh_bao.some(x => /tay nắm/.test(x)), 'tủ lạnh bản lề phía trong (tay nắm phía tường): cảnh báo mặt đặt đồ cạnh tay nắm', r.pa[0] && r.pa[0].canh_bao); }
  { const r = C.xepBep({ kieu: 'I', canh: [{ dai: 2400 }], tl: null }); ok(r.pa[0] && r.pa[0].canh_bao.some(x => /sơ chế/.test(x)), 'dãy 2400: sơ chế < 600 → cảnh báo', r.pa[0] && [tom(duoi(r.pa[0])), r.pa[0].canh_bao]); }
  { const r = C.xepBep({ kieu: 'I', canh: [{ dai: 1500 }] }); ok(!r.pa.length && r.loi_chung.some(x => /ngắn hơn tối thiểu/.test(x)), 'dãy 1500 có tủ lạnh: LỖI chung "ngắn hơn tối thiểu"', r.loi_chung); }
  { const r = C.xepBep({ kieu: 'L', canh: [{ dai: 3000 }, { dai: 800 }], tl: null }); ok(!r.pa.length && r.loi_chung.some(x => /[Cc]ạnh B/.test(x)), 'chữ L: cạnh B < F + N + 300 → LỖI chung', r.loi_chung); }
  { const r = C.xepBep({ kieu: 'L', canh: [{ dai: 3000 }, { dai: 2500 }], tl: null, chuan: { sau_duoi: 400 } }); ok(!r.pa.length && r.loi_chung.some(x => /góc/.test(x)), 'chữ L: tủ góc quá rộng so với cánh (X < 0) → LỖI chung', r.loi_chung); }

  // ---- Phương án, ghim, kéo ----
  { const sig = p => JSON.stringify(tom(p.ds)); ok(new Set(r1.pa.map(sig)).size === r1.pa.length && r1.pa.every((p, i) => !i || p.cost >= r1.pa[i - 1].cost), 'phương án khác nhau, xếp theo chi phí tăng dần'); }
  { const m = duoi(p1)[4]; const r = C.xepBep(Object.assign({}, bo1, { khoa: { [m.vt]: { ma: 'BD-NK3-450', s0: m.s0 } } }));
    ok(m.ma === 'BD-CANH-355' && r.pa.length && r.pa.every(p => p.ds.some(x => x.ma === 'BD-NK3-450' && x.s0 === m.s0 && x.ghim)), 'ghim / đổi một tủ (cánh 355 → ngăn kéo 450): mọi phương án giữ đúng tủ đó ở đúng chỗ', r.pa.map(p => tom(duoi(p))));
    const r2 = C.xepBep(Object.assign({}, bo1, { khoa: { [m.vt]: { ma: m.ma, s0: m.s0 } } }));
    ok(r2.pa.length && r2.pa[0].ds.some(x => x.ma === 'BD-CANH-355' && x.s0 === m.s0 && x.ghim), '(1.35) ghim khoang chia đều cỡ không có trong thư viện (BD-CANH-355): nhận', r2.loi_chung); }
  { const b = C.keoBo(Object.assign({}, bo1, { ong: null }), 'chau', { canh: 0, s: 2010 }); eq([b.chau.canh, b.chau.s], [0, 2000], 'keoBo chậu: làm tròn lưới 50');
    const r = C.xepBep(b), c = duoi(r.pa[0]).find(m => /CHAU/.test(m.ma)); ok(Math.abs((c.u0 + c.u1) / 2 - 2000) <= 150, 'kéo chậu về 2000: tâm chậu mới cách 2000 ≤ 150', tom(duoi(r.pa[0])));
    eq(C.keoBo(bo1, 'tl', 4000).tl.dau, 'cuoi', 'keoBo tủ lạnh sang nửa phải → đầu phải');
    const r2b = C.xepBep(C.keoBo(Object.assign({}, bo1, { ong: null }), 'tl', 4000));      // (ống 3700 nằm trong khoang tủ lạnh khi tủ lạnh sang phải — bỏ ống) ok(duoi(r2b.pa[0]).slice(-1)[0].ma === 'BC-TL-830', 'tủ lạnh đầu phải: khoang tủ lạnh ở cuối dãy', tom(duoi(r2b.pa[0])));
    const kb = C.keoBo(bo1, 'bep', 3120); eq([kb.bep.s, bo1.bep], [3100, undefined], 'keoBo bếp: ghi bếp.s, không sửa bộ gốc'); }
  { const r = C.xepBep(Object.assign({}, bo1, { hm: 'kinh' })), h = tang(r.pa[0], 'tren').find(m => /HMK/.test(m.ma)), bp = duoi(r.pa[0]).find(m => /BEP/.test(m.ma));
    ok(h && h.u0 === bp.u0 && h.u1 === bp.u1 && h.z === 2010, 'hút mùi kính: tủ che ống rộng = tủ bếp, z 2010', h); }
  { const r = C.xepBep(Object.assign({}, bo1, { canh: [{ dai: 5200 }], cao: [{ loai: 'lo' }, { loai: 'kho', rong: 450 }] })), d = duoi(r.pa[0]);
    eq(d.slice(0, 3).map(m => m.ma), ['BC-TL-830', 'BC-LO-600', 'BC-KHO-450'], 'khối cao từ ngoài vào: tủ lạnh → lò → kho');
    ok(!tang(r.pa[0], 'tren').some(m => !m.t2 && m.u0 < d[2].u1 - 0.01), 'không tủ trên (tầng dưới) trên khối cao');
    ok(tang(r.pa[0], 'tren').filter(m => m.t2 && m.u0 < d[2].u1 - 0.01).map(m => [m.u0, m.u1, !!m.sau_cao]).every((x, j) => x[0] === d[j].u0 && x[1] === d[j].u1 && x[2]), '(1.35) tầng trên kịch trần trên từng tủ cao — cùng bề rộng, sâu theo tủ cao', tom(tang(r.pa[0], 'tren').filter(m => m.t2))); }

  // ---- Phép thử tính chất: quét dài, I và L, có / không tủ lạnh, lò, kho ----
  const CAU_HINH = [
    ['I tường–tường, tủ lạnh 700', L => ({ kieu: 'I', canh: [{ dai: L }] })],
    ['I tường–hở, không tủ lạnh', L => ({ kieu: 'I', canh: [{ dai: L, cuoi: 'ho' }], tl: null })],
    ['I hở–tường, tủ lạnh 910 đầu phải + lò + kho', L => ({ kieu: 'I', canh: [{ dai: L, dau: 'ho' }], tl: { may: 'sbs_910', dau: 'cuoi' }, cao: [{ loai: 'lo' }, { loai: 'kho' }], hm: 'kinh' })],
    ['L tường / tường, tủ lạnh trên A', L => ({ kieu: 'L', canh: [{ dai: L }, { dai: 2600 }] })],
    ['L hở / tường, Eurogold, rẽ trái', L => ({ kieu: 'L', canh: [{ dai: 3200, dau: 'ho' }, { dai: L, re: 'trai' }], tl: null, goc: { pk: 'eu_lh' }, bep: { co: 900 } })],
  ];
  let soPA = 0, soRong = 0;
  for (const [ten, f] of CAU_HINH) for (let L = 1200; L <= 6000; L += 70) {
    const bo = C.chuanBo(f(L)), r = C.xepBep(bo);
    if (!r.pa.length) {
      soRong++; ok(r.loi_chung.length > 0, `${ten} ${L}: không phương án → có LỖI chung`);
      // chữ I: không xếp được chỉ khi dãy ngắn hơn tối thiểu bảng tự nói (chữ L: chậu ghim cạnh A có thể không lọt — LỖI chung là đủ)
      if (bo.kieu === 'I') { const m = /tối thiểu ([\d,]+)/.exec(r.loi_chung.join(' ')); ok(m && L < Number(m[1].replace(',', '.')), `${ten} ${L}: chỉ hỏng khi ngắn hơn tối thiểu`, r.loi_chung); }
      continue;
    }
    for (const p of r.pa) {
      soPA++;
      const nhan = `${ten} ${L}`;
      ok(!p.loi.length && !C.kiemDay(bo, p).loi.length, `${nhan}: phương án trả về không LỖI (kiemDay sạch)`, p.loi);
      bo.canh.forEach((c, i) => {
        const d = duoi(p, i), x0 = bo.kieu === 'L' ? (i === 0 ? p.goc.X : p.goc.F) : 0;
        ok(near(d[0].u0, x0, 0.01) && near(d[d.length - 1].u1, c.dai, 0.01) && d.every((m, j) => !j || near(m.u0, d[j - 1].u1, 0.01)), `${nhan} cạnh ${i}: tủ liền nhau, tổng = dài`, tom(d));
        for (const m of d) for (const v of nepCua(m)) ok(v === 0 || (v >= 50 - 0.01 && (v <= 100 + 0.01 || p.canh_bao.some(x => /nẹp/.test(x)))), `${nhan}: nẹp ${v} trong [50, 100] hoặc có cảnh báo`);
        const tren = tang(p, 'tren', i);
        for (const m of tren) if (!/BT-GOC/.test(m.ma) && !(bo.kieu === 'L' && i === 1 && near(m.u0, p.goc.P_t, 0.01))) ok(d.some(q => near(q.u0, m.u0, 0.01)) && d.some(q => near(q.u1, m.u1, 0.01)), `${nhan}: mối nối trên (cả tầng trên kịch trần) trùng dưới (${m.ma})`, [tom(tren), tom(d)]);
        // (1.35) luật chia: khoang cánh / ngăn kéo / kệ chia đều trên MỘT cạnh (lệch nhau ≤ 5 — dư vượt sức nẹp dồn +5), mỗi khoang 150 … 900; rổ đúng 300
        const deu = d.filter(m => /^BD-(CANH|NK3|KE)-/.test(m.ma) && !m.ghim).map(m => m.rong);
        ok(!deu.length || (Math.max(...deu) - Math.min(...deu) <= 5 + 0.01 && deu.every(w => w >= 150 - 0.01 && w <= 905 + 0.01)), `${nhan} cạnh ${i}: khoang chia đều (${deu.join(' / ')})`);
        ok(d.filter(m => /^BD-(GV|RAC|GAO)-/.test(m.ma)).every(m => m.rong === 300), `${nhan}: khoang rổ đúng cỡ 300`);
      });
      for (const m of p.ds) if (m.le) ok(/^(BD|BT)-(CANH|KE|NK3)-/.test(m.ma), `${nhan}: chỉ khoang chia đều mới có thể lẻ (${m.ma})`);
      const bp = p.ds.find(m => /^BD-BEP/.test(m.ma)), hm = p.ds.find(m => /^BT-HM/.test(m.ma)), cp = p.ds.find(m => /^BD-CHAU/.test(m.ma));
      ok(bp && hm && hm.canh === bp.canh && near(hm.u0, bp.u0, 0.01) && near(hm.u1, bp.u1, 0.01), `${nhan}: tủ hút mùi rộng đúng tủ bếp (mối nối trùng)`, [hm, bp]);
      ok(cp && bp && cp.rong === bp.rong && [700, 800, 900].indexOf(cp.rong) >= 0, `${nhan}: chậu = bếp cùng cỡ 700 / 800 / 900`, [cp && cp.rong, bp && bp.rong]);
    }
  }
  ok(soPA > 500 && soRong < 130, 'quét: đủ phương án', [soPA, soRong]);

  // ---- (bước 3) "+ Kệ": kệ hở 300 sát đầu HỞ (ốp hông bắt vào kệ), tủ trên kệ hở trên; tắt = không có khoá ----
  ok(!('ke' in C.chuanBo({})) && C.chuanBo({ ke: true }).ke === true && !('ke' in C.chuanBo({ ke: 'x' })), 'chuanBo: ke chỉ khi bật (không đổi bộ cũ)');
  { const r = C.xepBep({ kieu: 'I', canh: [{ dai: 3600, dau: 'ho' }], tl: null, ke: true }), p = r.pa[0], d = p && duoi(p);
    ok(p && d[0].ma === 'BD-KE-300' && d[0].op === 'trai' && d[0].u0 === 0 && d[0].rong === 300 && d[0].dai === 300 + C.DEFAULT_SPEC.van.t_canh && r.pa.every(q => !q.loi.length), 'I đầu trái hở + Kệ: kệ hở 300 sát đầu, ốp hông vào kệ', p && tom(d));
    ok(p && tang(p, 'tren')[0].ma === 'BT-KE-300', 'I + Kệ: tủ trên trên kệ là kệ hở trên', p && tom(tang(p, 'tren')));
    const r0 = C.xepBep({ kieu: 'I', canh: [{ dai: 3600, dau: 'ho' }], tl: null });
    ok(r0.pa[0] && duoi(r0.pa[0])[0].ma !== 'BD-KE-300', 'không bật Kệ: đầu hở không tự thêm kệ', r0.pa[0] && tom(duoi(r0.pa[0]))); }
  { const r = C.xepBep({ kieu: 'I', canh: [{ dai: 3600 }], tl: null, ke: true });
    ok(r.pa[0] && !r.pa[0].ds.some(m => m.ma === 'BD-KE-300' && m.op), 'hai đầu tường: Kệ không có chỗ (chỉ ở đầu hở)'); }
  { const r = C.xepBep({ kieu: 'L', canh: [{ dai: 3050 }, { dai: 2750, cuoi: 'ho' }], tl: null, ke: true }), p = r.pa[0], b = p && duoi(p, 1);
    ok(p && b[b.length - 1].ma === 'BD-KE-300' && b[b.length - 1].op === 'phai' && b[b.length - 1].u1 === 2750, 'chữ L, cạnh B đầu hở + Kệ: kệ cuối cạnh B', p && tom(b)); }

});

// Bản 1.34 — DÃY BẾP, bước 4 (thiết kế §9): chỗ đặt cả dãy trên bản vẽ — hàm thuần, driver chỉ việc vẽ từng tủ ở `at` + `xoay`.
//   choDiem(kieu, điểm bấm) → { goc, xoay, re, dai }: chữ I = lưng đầu trái + một điểm theo hướng dãy (trái → phải khi nhìn vào tường; lòng phòng ở bên phải hướng đó);
//     chữ L = góc trong + một điểm trên cạnh A + một điểm trên cạnh B (re suy từ hai hướng).
//   datDay(bo, pa, cho) → [{ vt, canh, tang, spec, at (gốc thiết kế của tủ = mép trái, mặt trước thùng, sàn), xoay, sig }] theo thứ tự vẽ dưới A → dưới B → cao → trên;
//     lưng tủ sát tường (tủ dưới / cao cách tường đúng `cach_tuong`), tủ trên treo z = mặt đá + cách mặt đá; cạnh B chữ L xoay −90 (rẽ phải) / +90 (rẽ trái).
//   doiDay(da_ve, ds) → { giu, sua (cùng chỗ, spec khác → Cập nhật tủ), doi (dời chỗ → xoá + vẽ lại), bo, them } theo mã vị trí + dấu (sig).
T('Dãy bếp (bản 1.34) — chỗ đặt cả dãy, so dãy đã vẽ', () => {
  const k = require.resolve('../src/mncf-core.js'), cu = require.cache[k]; delete require.cache[k]; const C = require(k); require.cache[k] = cu;
  C.DEFAULT_SPEC.thung.noc_day = 'lot'; C.DEFAULT_SPEC.ngan_keo.khung_mat = 0;
  // hộp bao THẾ GIỚI của một tủ đặt ở at + xoay (quay quanh trục đứng qua at)
  const hopTG = x => { const M = C.build(x.spec), r = x.xoay * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), q = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity];
    for (const p of M.parts) for (const X of [p.x0, p.x1]) for (const Y of [p.y0, p.y1]) { const wx = x.at[0] + X * c - Y * s, wy = x.at[1] + X * s + Y * c; q[0] = Math.min(q[0], wx); q[1] = Math.max(q[1], wx); q[2] = Math.min(q[2], wy); q[3] = Math.max(q[3], wy); }
    for (const p of M.parts) { q[4] = Math.min(q[4], x.at[2] + p.z0); q[5] = Math.max(q[5], x.at[2] + p.z1); }
    return q.map(v => Math.round(v * 100) / 100); };
  const chong = (a, b) => a[0] < b[1] - 0.5 && b[0] < a[1] - 0.5 && a[2] < b[3] - 0.5 && b[2] < a[3] - 0.5 && a[4] < b[5] - 0.5 && b[4] < a[5] - 0.5;
  const sach = ds => { const hop = ds.map(hopTG), xx = []; for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) if (chong(hop[i], hop[j])) xx.push([ds[i].vt, ds[j].vt]); return xx; };

  // ---- choDiem ----
  eq(C.choDiem('I', [[100, 200, 0], [100, 1200, 0]]), { goc: [100, 200, 0], xoay: 90, re: null, dai: [1000] }, 'choDiem I: lưng đầu trái + điểm theo hướng dãy → xoay 90');
  eq(C.choDiem('I', [[0, 0, 0], [-500, 0, 0]]).xoay, 180, 'choDiem I: hướng −x → xoay 180 (trong (−180, 180])');
  eq(C.choDiem('L', [[0, 0, 0], [-3050, 0, 0], [0, -2450, 0]]), { goc: [0, 0, 0], xoay: 0, re: 'phai', dai: [3050, 2450] }, 'choDiem L: góc ở đầu phải cạnh A (nhìn vào tường A), cạnh B đi ra phía phòng → rẽ phải, xoay 0');
  eq(C.choDiem('L', [[0, 0, 0], [3050, 0, 0], [0, -2450, 0]]), { goc: [0, 0, 0], xoay: 0, re: 'trai', dai: [3050, 2450] }, 'choDiem L: góc ở đầu trái cạnh A → rẽ trái');
  eq(C.choDiem('L', [[0, 0, 0], [0, 3000, 0], [2000, 0, 0]]), { goc: [0, 0, 0], xoay: 90, re: 'trai', dai: [3000, 2000] }, 'choDiem L: tường A dọc trục y, lòng phòng ở góc phần tư x > 0, y > 0 → góc ở đầu trái cạnh A, xoay 90');
  ok(C.choDiem('I', [[0, 0, 0], [3, 4, 0]]) === null && C.choDiem('I', [[0, 0, 0]]) === null && C.choDiem('L', [[0, 0, 0], [1000, 0, 0], [1000, 600, 0]]) === null && C.choDiem('L', [[0, 0, 0], [1000, 0, 0], [5, -3, 0]]) === null, 'choDiem: hai điểm quá gần / thiếu điểm / hai cạnh chữ L không vuông góc → null');

  // ---- datDay E1: chữ I 4500, lưng dãy ở y 5000 (lòng phòng phía y nhỏ), đầu trái x 10000 ----
  const bo1 = { kieu: 'I', canh: [{ dai: 4500 }], tl: { may: 'bon_canh_830', dau: 'dau', ban_le: 'tuong' }, ong: { canh: 0, s: 3700 } };
  const p1 = C.xepBep(bo1).pa[0], cho1 = { goc: [10000, 5000, 0], xoay: 0 };
  const d1 = C.datDay(bo1, p1, cho1);
  eq(d1.length, p1.ds.length, 'datDay E1: một mục mỗi tủ');
  eq(d1.map(x => x.tang), d1.map(x => x.tang).slice().sort((a, b) => ['duoi', 'cao', 'tren'].indexOf(a) - ['duoi', 'cao', 'tren'].indexOf(b)), 'datDay: thứ tự vẽ dưới → cao → trên');
  for (const x of d1) {
    const m = p1.ds.find(q => q.vt === x.vt), h = hopTG(x), sauTu = x.spec.sau_thung + (x.tang === 'tren' ? 0 : x.spec.bep.cach_tuong);
    ok(x.xoay === 0 && Math.abs(h[0] - (10000 + m.s0)) < 0.02 && Math.abs(h[1] - (10000 + m.s0 + m.dai)) < 0.02, `datDay E1 ${x.vt}: chạy x ${10000 + m.s0} → ${10000 + m.s0 + m.dai}`, [h, m.s0, m.dai]);
    ok(Math.abs(h[3] - (5000 - (x.tang === 'tren' ? 0 : x.spec.bep.cach_tuong))) < 0.02, `datDay E1 ${x.vt}: lưng sát tường (y 5000)`, h);
    ok(Math.abs(x.at[1] - (5000 - sauTu)) < 0.02 && x.at[2] === (x.tang === 'tren' ? (m.t2 ? 2360 : 1560) : 0) && h[4] === x.at[2], `datDay E1 ${x.vt}: gốc thiết kế = mặt trước thùng; ${x.tang === 'tren' ? `treo z ${m.t2 ? 2360 : 1560}` : 'đứng sàn'}`, [x.at, h]);
    ok(typeof x.sig === 'string' && x.sig.length >= 8 && x.spec.bep.day.vt === x.vt, `datDay E1 ${x.vt}: có dấu + mã vị trí`);
  }
  eq(sach(d1), [], 'datDay E1: các tủ không chồng nhau');
  { const d = C.datDay(bo1, p1, { goc: [0, 0, 0], xoay: 90 }), x = d.find(q => q.tang === 'duoi'), h = hopTG(x), m = p1.ds.find(q => q.vt === x.vt);
    ok(x.xoay === 90 && Math.abs(h[0] - x.spec.bep.cach_tuong) < 0.02 && h[1] > 500 && Math.abs(h[2] - m.s0) < 0.02 && Math.abs(h[3] - (m.s0 + m.dai)) < 0.02, 'datDay xoay 90: dãy chạy theo +y, lưng ở x 0 (lòng phòng ở bên phải hướng dãy: x dương)', h);
    eq(sach(d), [], 'datDay xoay 90: không chồng'); }
  ok(JSON.stringify(C.datDay(bo1, p1, cho1).map(x => x.sig)) === JSON.stringify(d1.map(x => x.sig)), 'datDay: cùng bộ, cùng chỗ → cùng dấu');
  ok(C.datDay(bo1, p1, { goc: [0, 0, 0] }).length === d1.length && C.datDay(bo1, p1, null) === null && C.datDay(bo1, null, cho1) === null, 'datDay: thiếu xoay = 0; thiếu chỗ / phương án → null');

  // ---- datDay E2: chữ L rẽ phải, góc trong ở (0, 0), tường A dọc trục x (A ở bên trái góc), tường B đi xuống −y ----
  const bo2 = { kieu: 'L', canh: [{ dai: 3050, dau: 'tuong' }, { dai: 2450, cuoi: 'ho' }], tl: null, ong: { canh: 0, s: 3050 - 2130 }, bep: { canh: 1 } };
  const p2 = C.xepBep(bo2).pa[0], cho2 = C.choDiem('L', [[0, 0, 0], [-3050, 0, 0], [0, -2450, 0]]);
  const d2 = C.datDay(bo2, p2, cho2);
  eq(d2.length, p2.ds.length, 'datDay E2: một mục mỗi tủ');
  { const tt = d2.map(x => `${x.tang}${x.canh}`), rank = v => ['duoi0', 'duoi1', 'cao0', 'cao1', 'tren0', 'tren1'].indexOf(v); ok(tt.every((v, i) => !i || rank(tt[i - 1]) <= rank(v)), 'datDay E2: thứ tự dưới A → dưới B → cao → trên', tt); }
  for (const x of d2) {
    const m = p2.ds.find(q => q.vt === x.vt), h = hopTG(x), lung = x.tang === 'tren' ? 0 : x.spec.bep.cach_tuong;
    if (x.canh === 0) ok(x.xoay === 0 && Math.abs(h[3] - (0 - lung)) < 0.02 && Math.abs(h[0] - (-3050 + m.s0)) < 0.02 && Math.abs(h[1] - (-3050 + m.s0 + m.dai)) < 0.02, `datDay E2 A ${x.vt}: x ${-3050 + m.s0} → ${-3050 + m.s0 + m.dai}, lưng ở tường A`, h);
    else ok(x.xoay === -90 && Math.abs(h[1] - (0 - lung)) < 0.02 && Math.abs(h[2] - (-m.u1)) < 0.02 && Math.abs(h[3] - (-m.u0)) < 0.02, `datDay E2 B ${x.vt}: xoay −90, lưng ở tường B (x 0), y ${-m.u1} → ${-m.u0}`, [x.xoay, h, m.u0, m.u1]);
  }
  eq(sach(d2), [], 'datDay E2: tủ góc mù cạnh A và tủ cạnh B không chồng nhau (dưới lẫn trên)');
  { const b2 = Object.assign({}, bo2, { canh: [bo2.canh[0], Object.assign({}, bo2.canh[1], { re: 'trai' })], ong: { canh: 0, s: 2130 } }),      /* rẽ trái: góc ở đầu trái cạnh A, s của ống tính từ đầu trái */ pt = C.xepBep(b2).pa[0], ch = C.choDiem('L', [[0, 0, 0], [3050, 0, 0], [0, -2450, 0]]), d = C.datDay(b2, pt, ch);
    ok(ch.re === 'trai' && d.filter(x => x.canh === 1).every(x => x.xoay === 90) && d.filter(x => x.canh === 0).every(x => hopTG(x)[0] >= -0.02), 'datDay chữ L rẽ trái: cạnh B xoay +90, cạnh A nằm bên phải góc', d.map(x => [x.vt, x.xoay]));
    eq(sach(d), [], 'datDay chữ L rẽ trái: không chồng'); }

  // ---- doiDay: so dãy đã vẽ với dãy mới ----
  const daVe = d1.map((x, i) => ({ vt: x.vt, id: 'T' + i, sig: x.sig, at: x.at, xoay: x.xoay, tang: x.tang }));
  { const r = C.doiDay(daVe, d1); ok(r.giu.length === d1.length && !r.sua.length && !r.doi.length && !r.bo.length && !r.them.length, 'doiDay: không đổi gì → giữ hết', r); }
  { const a4 = p1.ds.find(m => m.ma === 'BD-CANH-355' && m.tang === 'duoi' && m.vt === 'A4'), s0 = a4.s0;
    const b = Object.assign({}, bo1, { khoa: { [a4.vt]: { ma: 'BD-NK3-355', s0, canh: 0 } } }), pb = C.xepBep(b).pa[0];
    ok(pb && pb.ds.some(m => m.vt === a4.vt && m.ma === 'BD-NK3-355'), 'ghim A4 thành BD-NK3-355 (1.35: khoang chia đều đổi thành ngăn kéo cùng cỡ)', pb && pb.ds.map(m => m.ma));
    const r = C.doiDay(daVe, C.datDay(b, pb, cho1));
    eq([r.sua.map(x => x.vt), r.doi.length, r.bo.length, r.them.length, r.giu.length], [[a4.vt], 0, 0, 0, d1.length - 1], 'doiDay: đổi đúng một tủ tại chỗ → một tủ "sửa" (Cập nhật), còn lại giữ');
    ok(r.sua[0].id === daVe.find(x => x.vt === a4.vt).id && r.sua[0].x.spec.bep.chuc_nang === 'nk', 'doiDay: mục sửa mang mã tủ đã vẽ + spec mới'); }
  { const r = C.doiDay(daVe, C.datDay(bo1, p1, { goc: [10000, 5100, 0], xoay: 0 })); eq([r.doi.length, r.sua.length, r.giu.length], [d1.length, 0, 0], 'doiDay: dời cả dãy → mọi tủ "dời" (xoá + vẽ lại)'); }
  { const r = C.doiDay(daVe.concat([{ vt: 'A9', id: 'TX', sig: 'x', at: [0, 0, 0], xoay: 0, tang: 'duoi' }]), d1.filter(x => x.vt !== 'AT6'));
    eq([r.bo.map(x => x.vt).sort(), r.them.length], [['A9', 'AT6'], 0], 'doiDay: tủ không còn trong dãy mới → bỏ'); }
  { const r = C.doiDay(daVe.filter(x => x.vt !== 'A1'), d1); eq(r.them.map(x => x.vt), ['A1'], 'doiDay: tủ chưa vẽ → vẽ thêm'); }
});

// Bản 1.34 — vòng soát dãy bếp: mỗi lỗi đã xác nhận một phép thử (viết trước khi sửa)
T('Dãy bếp (bản 1.34) — vòng soát', () => {
  const k = require.resolve('../src/mncf-core.js'), cu = require.cache[k]; delete require.cache[k]; const C = require(k); require.cache[k] = cu;
  C.DEFAULT_SPEC.thung.noc_day = 'lot'; C.DEFAULT_SPEC.ngan_keo.khung_mat = 0;
  const t = C.DEFAULT_SPEC.van.t;
  const duoi = (pa, canh) => pa.ds.filter(m => (m.tang === 'duoi' || m.tang === 'cao') && (canh === undefined || m.canh === canh)).sort((a, b) => a.u0 - b.u0);
  const thung = m => { const n = m.nep || {}; return [m.u0 + (n.trai || 0), m.u1 - (n.phai || 0)]; };      // chữ I, không ốp
  // (1) tủ thuộc dãy không in dòng đá riêng (đá kê theo dãy — daDay); tủ lẻ vẫn in
  { const r = C.xepBep({ kieu: 'I', canh: [{ dai: 3000, dau: 'tuong', cuoi: 'tuong' }], tl: null, chau: { s: 480, co: 800 } }), pa = r.pa[0], m = pa.ds.find(q => q.chuc === 'chau'), x = C.tuBo(r.bo, pa).find(q => q.vt === m.vt);
    ok(m.nep && m.nep.trai === 70 && m.u0 === 0, 'tủ chậu sát tường mang nẹp trái 70 (1.35: dư chia hai tường)', m);
    ok(!C.cutList(C.build(x.spec)).gia_cong_da, 'tủ trong dãy: không dòng "Mặt đá" riêng (đá đã kê theo dãy)', C.cutList(C.build(x.spec)).gia_cong_da);
    const le = C.apMau(C.normalize({}), 'BD-CHAU-800'); ok(C.cutList(C.build(C.datBep(le, {}))).gia_cong_da.length === 1, 'tủ chậu lẻ: vẫn có dòng "Mặt đá"'); }
  // (4) tủ chậu mang nẹp (phào): khoét đá + kiemBep theo TÂM THÙNG, không theo W/2 của module
  for (const nep of [{ phai: 75 }, { trai: 75 }]) {
    const s = C.apMau(C.normalize({}), 'BD-CHAU-900'); s.rong = 975; s.bep.nep = nep;
    const M = C.build(C.datBep(s, {})), hoi = M.parts.filter(p => p.loai === 'HOI'), x0 = Math.min(...hoi.map(p => p.x0)), x1 = Math.max(...hoi.map(p => p.x1));
    ok(near(M.da.khoet[0].x, (x0 + x1) / 2, 0.01), `nẹp ${JSON.stringify(nep)}: khoét chậu ở tâm thùng ${(x0 + x1) / 2}`, [M.da.khoet[0].x, x0, x1]);
    ok(!M.errors.some(e => /lọt/.test(e)), `nẹp ${JSON.stringify(nep)}: chậu 900 lọt thùng 900 (không báo "chỉ lọt")`, M.errors); }
  { const r = C.xepBep({ kieu: 'I', canh: [{ dai: 3600 }], tl: null, ong: { canh: 0, s: 3200 } }); ok(r.pa.length > 0, 'ống thoát gần tường (3200 / 3600): có phương án (chậu sát tường mang nẹp)', r.loi_chung);
    const pa = r.pa[0], c = pa && pa.ds.find(q => q.chuc === 'chau'), th = c && thung(c), kh = pa && pa.da[0].khoet.find(q => q.loai === 'chau');
    ok(pa && near((kh.u0 + kh.u1) / 2, (th[0] + th[1]) / 2, 0.01), 'khoét chậu của dãy ở tâm thùng', [kh, th]); }
  ok(C.xepBep({ kieu: 'L', canh: [{ dai: 2400 }, { dai: 2600 }], tl: null }).pa.length > 0, 'chữ L A 2400 / B 2600: có phương án');
  // (2) tủ trên góc theo nẹp góc trên của bộ: cánh = c_t của phương án
  for (const nt of [50, 80]) {
    const bo = { kieu: 'L', canh: [{ dai: 3050, dau: 'tuong' }, { dai: 2450, cuoi: 'ho', re: 'phai' }], tl: null, bep: { canh: 1 }, goc: { pk: 'hg_lh', nep: 80, nep_tren: nt } }, pa = C.xepBep(bo).pa[0];
    if (!pa) { ok(false, `nẹp góc trên ${nt}: có phương án`); continue; }
    const gt = pa.ds.find(m => m.tang === 'tren' && m.chuc === 'goc'), x = C.tuBo(bo, pa).find(q => q.vt === gt.vt), cs = C.build(x.spec).parts.filter(p => p.loai === 'CANH');
    const rong = Math.max(...cs.map(p => p.x1)) - Math.min(...cs.map(p => p.x0));
    ok(near(rong, pa.goc.c_t, 2.1), `nẹp góc trên ${nt}: cánh tủ trên góc ${rong} = c_t ${pa.goc.c_t}`, cs.map(box)); }
  // (3) chữ L: cạnh A ngắn (đầu hở + tủ lạnh) không chứa nổi chậu 900 → chậu 800, cạnh B dài ra không làm mất phương án
  for (const B of [2700, 2800, 4000, 6000]) { const r = C.xepBep({ kieu: 'L', canh: [{ dai: 3000, dau: 'ho' }, { dai: B }], tl: { may: 'hai_canh_700', canh: 0 } }); ok(r.pa.length > 0, `chữ L A 3000 hở + tủ lạnh, B ${B}: có phương án`, r.loi_chung); }
  // (5) đá: phương án đầu ghép được trong khổ 3200 khi có phương án ghép được
  for (const L of [3300, 3500, 3800, 4000]) { const r = C.xepBep({ kieu: 'I', canh: [{ dai: L }], tl: null }); ok(r.pa[0] && r.pa[0].da.every(d => d.hop_le), `I ${L} không tủ lạnh: phương án 1 có đá ghép được`, r.pa.map(p => p.da.map(d => d.tam.map(q => q.dai)))); 
    ok(r.pa.every((p, i) => !i || p.cost >= r.pa[i - 1].cost), `I ${L}: phương án xếp theo chi phí tăng dần`); }
  // (6) ghim tủ góc: góc do bảng tự đặt — khoá của tủ góc bị bỏ, dãy vẫn ra phương án
  { const bo = { kieu: 'L', canh: [{ dai: 3050 }, { dai: 2450, cuoi: 'ho' }], tl: null, bep: { canh: 1 } }, p = C.xepBep(bo).pa[0], g = p.ds.find(m => m.chuc === 'goc' && m.tang === 'duoi');
    ok(!('A5' in C.chuanBo(Object.assign({}, bo, { khoa: { A5: { ma: g.ma, s0: g.s0, canh: 0 } } })).khoa), 'chuanBo: không nhận khoá tủ góc');
    ok(C.xepBep(Object.assign({}, bo, { khoa: { A5: { ma: g.ma, s0: g.s0, canh: 0 } } })).pa.length > 0, 'ghim tủ góc: vẫn có phương án'); }
  // (7) tâm chậu / bếp gõ mà không đặt được quanh đó: vẫn xếp, cảnh báo dời bao nhiêu; lời báo không đổ cho "ngắn"
  { const r = C.xepBep({ kieu: 'I', canh: [{ dai: 4500 }], tl: null, chau: { s: 4200 } }); ok(r.pa[0] && r.pa[0].canh_bao.some(x => /[Cc]hậu/.test(x) && /4200/.test(x)), 'tâm chậu 4200 không đặt được: cảnh báo chậu dời khỏi tâm đã gõ', r.pa[0] && r.pa[0].canh_bao); }
  { const r = C.xepBep({ kieu: 'I', canh: [{ dai: 3600 }], tl: null, bep: { s: 200 } }); ok(r.pa[0] && r.pa[0].canh_bao.some(x => /[Bb]ếp/.test(x) && /200/.test(x)), 'tâm bếp 200 (sát tường): vẫn xếp, cảnh báo bếp dời', [r.loi_chung, r.pa[0] && r.pa[0].canh_bao]); }
  { const r = C.xepBep({ kieu: 'I', canh: [{ dai: 3600 }], tl: null, chau: { s: 1800 } }); ok(r.pa[0] && !r.pa[0].canh_bao.some(x => /dời/.test(x) && /[Cc]hậu/.test(x)), 'tâm chậu đặt được: không cảnh báo dời'); }
  // (8) dài ở giữa dải không mất phương án; lời báo không nói "ngắn hơn tối thiểu N" khi dài ≥ N
  for (const [A, tl] of [[2000, null], [2800, { canh: 0 }]]) { const r = C.xepBep({ kieu: 'L', canh: [{ dai: A }, { dai: 2600 }], tl }); ok(r.pa.length > 0, `chữ L A ${A} / B 2600${tl ? ' + tủ lạnh' : ''}: có phương án`, r.loi_chung); }
  for (const L of [2200, 2300]) { const r = C.xepBep({ kieu: 'I', canh: [{ dai: L, dau: 'ho', cuoi: 'ho' }], tl: null }), m = /tối thiểu ([\d,]+)/.exec(r.loi_chung.join(' '));
    ok(r.pa.length || !m || L < Number(m[1].replace(',', '.')), `I hai đầu hở ${L}: không nói "ngắn hơn tối thiểu" khi dài đã đủ`, r.loi_chung); }
});

// Bản 1.34 — vòng soát 2 dãy bếp: mỗi lỗi đã xác nhận một phép thử (viết trước khi sửa)
T('Dãy bếp (bản 1.34) — vòng soát 2', () => {
  const k = require.resolve('../src/mncf-core.js'), cu = require.cache[k]; delete require.cache[k]; const C = require(k); require.cache[k] = cu;
  C.DEFAULT_SPEC.thung.noc_day = 'lot'; C.DEFAULT_SPEC.ngan_keo.khung_mat = 0;
  const tamU = (m, e) => { const n = m.nep || {}, a = (e.lat ? n.phai : n.trai) || 0, b = (e.lat ? n.trai : n.phai) || 0, op = m.u1 - m.u0 - m.rong - a - b, oa = m.op === (e.lat ? 'phai' : 'trai') ? op : 0; return m.u0 + a + oa + m.rong / 2; };
  // (1) chậu đã ghim rồi kéo sang cạnh kia: ghim của chậu bỏ, chậu theo tâm vừa kéo trên ĐÚNG cạnh mới (không mang u0 của cạnh cũ)
  { const bo = { kieu: 'L', canh: [{ dai: 3400 }, { dai: 4600, cuoi: 'ho' }], tl: null }, p = C.xepBep(bo).pa[0], c = p.ds.find(m => m.chuc === 'chau' && m.tang === 'duoi');
    const s0 = c.s0 + ((c.nep && c.nep.trai) || 0) + (c.op === 'trai' ? C.DEFAULT_SPEC.van.t_canh : 0);
    const b2 = Object.assign({}, bo, { khoa: { [c.vt]: { ma: c.ma, s0, canh: c.canh } } });
    ok(C.xepBep(b2).pa[0].ds.some(m => m.chuc === 'chau' && m.ghim && m.canh === c.canh), 'ghim chậu: giữ đúng chỗ');
    const b3 = C.keoBo(b2, 'chau', { canh: 1 - c.canh, s: 1900 });
    ok(!Object.values(b3.khoa).some(q => /CHAU/.test(q.ma)), 'kéo chậu đã ghim: ghim của chậu bỏ (kéo = chọn chỗ mới)', b3.khoa);
    const p3 = C.xepBep(b3).pa[0], c3 = p3 && p3.ds.find(m => m.chuc === 'chau' && m.tang === 'duoi');
    const e3 = c3 && p3.canh[c3.canh], sT = e3 && (e3.lat ? e3.dai - tamU(c3, e3) : tamU(c3, e3));
    ok(c3 && c3.canh === 1 - c.canh && !c3.ghim && Math.abs(sT - 1900) <= 150 + 1, 'chậu sang cạnh mới, quanh tâm vừa kéo', c3);
    const b4 = C.keoBo(b2, 'chau', { canh: c.canh, s: 800 }); ok(!Object.values(b4.khoa).some(q => /CHAU/.test(q.ma)), 'kéo chậu đã ghim trên cùng cạnh: ghim bỏ (lần kéo có tác dụng)', b4.khoa);
    // ghim chậu + chậu khai cạnh khác (bộ cũ): ghim thắng — chậu nằm trên cạnh của ghim
    const b5 = Object.assign({}, b2, { chau: { canh: 1 - c.canh, s: null } }), p5 = C.xepBep(b5).pa[0], c5 = p5 && p5.ds.find(m => m.chuc === 'chau' && m.tang === 'duoi');
    ok(c5 && c5.canh === c.canh && c5.ghim && Math.abs(c5.s0 - c.s0) < 0.5, 'chậu ghim mà chau.canh khác: chậu ở cạnh + chỗ của ghim', [c5 && [c5.canh, c5.s0], c.s0]); }
  // (1b) chữ L → chữ I: ghim ở cạnh B bỏ (không dời lặng lẽ sang dãy I)
  { const bo = { kieu: 'L', canh: [{ dai: 3400 }, { dai: 3000 }], tl: null }, p = C.xepBep(bo).pa[0], m = p.ds.find(q => q.canh === 1 && q.tang === 'duoi' && /^BD-(NK3|CANH)/.test(q.ma) && !q.goc && !q.op && !(q.nep && q.nep.trai));
    const s0 = m.s0, bL = Object.assign({}, bo, { khoa: { [m.vt]: { ma: m.ma, s0, canh: 1 } } });
    ok(C.xepBep(bL).pa.length > 0, 'ghim tủ cạnh B: có phương án');
    const bI = C.chuanBo(Object.assign({}, bL, { kieu: 'I' }));
    eq(bI.khoa, {}, 'đổi sang chữ I: ghim cạnh B bỏ');
    ok(C.xepBep(Object.assign({}, bL, { kieu: 'I' })).pa.length > 0, 'đổi sang chữ I: vẫn có phương án'); }
  // (2) ghim / "Đổi thành" cái kệ tự thêm của "+ Kệ": tủ ghim thay chỗ kệ, không chồng → còn phương án
  { const bo = { kieu: 'I', canh: [{ dai: 3600, dau: 'ho' }], tl: null, ke: true }, p = C.xepBep(bo).pa[0], ke = p.ds.find(m => m.ma === 'BD-KE-300' && m.tang === 'duoi');
    ok(ke && ke.op === 'trai', '+ Kệ: kệ hở sát đầu hở trái', ke);
    const s0 = ke.s0 + C.DEFAULT_SPEC.van.t_canh;
    for (const ma of ['BD-KE-300', 'BD-CANH-300', 'BD-GV-300']) {
      const r = C.xepBep(Object.assign({}, bo, { khoa: { [ke.vt]: { ma, s0, canh: 0 } } }));
      ok(r.pa.length > 0 && r.pa[0].ds.some(m => m.ma === ma && m.ghim && Math.abs(m.s0 + C.DEFAULT_SPEC.van.t_canh - s0) < 0.5) && r.pa[0].ds.filter(m => m.tang === 'duoi' && m.u0 < 300).length === 1, `ghim ${ma} ở chỗ kệ tự thêm: có phương án, một tủ ở chỗ đó`, [r.loi_chung, r.pa[0] && r.pa[0].ds.filter(m => m.tang === 'duoi').map(m => [m.ma, m.u0, m.ghim])]);
    } }
  // (3) ống thoát ở cạnh khác cạnh chậu: chậu theo cạnh có ống (kéo chậu sang cạnh kia không bỏ ràng buộc ống); kiemDay báo LỖI khi không chậu nào trên cạnh có ống
  { const bo = { kieu: 'L', canh: [{ dai: 3400 }, { dai: 3000 }], tl: null, ong: { canh: 0, s: 900 } }, b2 = C.keoBo(bo, 'chau', { canh: 1, s: 2000 });
    ok(b2.chau.canh === 0, 'kéo chậu sang cạnh không có ống: chậu vẫn ở cạnh có ống', b2.chau);
    const p = C.xepBep(b2).pa[0], c = p && p.ds.find(m => m.chuc === 'chau' && m.tang === 'duoi');
    ok(c && c.canh === 0 && Math.abs(p.canh[0].dai - 900 - tamU(c, p.canh[0])) <= (c.rong - 2 * C.DEFAULT_SPEC.van.t) / 2 - 50 + 0.5, 'chậu trùm ống thoát', c);
    const b3 = C.chuanBo(Object.assign({}, bo, { chau: { canh: 1 } })); ok(b3.chau.canh === 0, 'chuanBo: ống thoát quyết định cạnh chậu', b3.chau);
    const pa = C.xepBep({ kieu: 'L', canh: [{ dai: 3400 }, { dai: 3000 }], tl: null, chau: { canh: 1 } }).pa[0];
    const k = C.kiemDay(Object.assign({}, bo, { chau: { canh: 1 } }), pa);
    ok(pa && pa.ds.find(m => m.chuc === 'chau').canh === 1 && k.loi.some(x => /ống thoát/.test(x)), 'kiemDay: ống ở cạnh A mà chậu ở cạnh B → LỖI', k.loi); }
  // (4) mọi phương án hỏng ở kiemDay: lỗi thật của phương án tốt nhất hiện ra (không chỉ "xem lỗi từng tủ")
  { const r = C.xepBep({ kieu: 'I', canh: [{ dai: 4200 }], tl: { may: { rong: 700, cao: 2300, sau: 700 } } });
    ok(r.pa.length === 0 && r.loi_chung.some(x => /[Hh]ốc tủ lạnh/.test(x)), 'máy 2300 không lọt hốc: lời báo nói đúng lỗi hốc tủ lạnh', r.loi_chung);
    const r2 = C.xepBep({ kieu: 'I', canh: [{ dai: 4200 }], tl: { may: { rong: 700, cao: 2200, sau: 700 } } });
    ok(r2.pa.length > 0, 'máy 2200 (hốc 2250 ≤ 2295): có phương án — thanh treo không đè đợt trên hốc', r2.loi_chung);
    const x = r2.pa[0] && C.tuBo(r2.bo, r2.pa[0]).find(q => q.spec.bep.chuc_nang === 'tl'), M = x && C.build(x.spec);
    ok(M && !M.errors.length && overlapAny(M).length === 0, 'khoang tủ lạnh máy 2200: không tấm nào đè nhau', M && [M.errors, overlapAny(M)]); }
  // (7) tủ bếp mang nẹp: thu Rộng trong Chenfeng quá bề nẹp thì gãy khúc (thùng hẹp lại, phào mất) → Rộng chỉ để xem
  { const s = C.apMau(C.normalize({}), 'BD-RAC-300'); s.rong = 370; s.bep.nep = { phai: 70 }; const h = C.heSo(C.normalize(s));
    ok(!h.bien.L && h.ly_do.L === 'khong_deu' && h.bien.W && h.bien.H, 'tủ có nẹp: Rộng khoá (không co giãn đều), Sâu / Cao vẫn co giãn', h.ly_do); }
});

T('Dãy bếp (bản 1.34) — vòng soát 3', () => {
  const k = require.resolve('../src/mncf-core.js'), cu = require.cache[k]; delete require.cache[k]; const C = require(k); require.cache[k] = cu;
  const clone = o => JSON.parse(JSON.stringify(o));
  C.DEFAULT_SPEC.thung.noc_day = 'lot'; C.DEFAULT_SPEC.ngan_keo.khung_mat = 0;
  const tc = C.DEFAULT_SPEC.van.t_canh, t = C.DEFAULT_SPEC.van.t;
  const s0T = m => m.s0 + ((m.nep && m.nep.trai) || 0) + (m.op === 'trai' ? tc : 0);
  // (1) chữ L: cạnh A ngắn (tủ lạnh + tủ góc) — chậu tự sang cạnh B thay vì 0 phương án; tâm chậu gõ / ống thoát thì không tự đổi cạnh
  { const bo = { kieu: 'L', canh: [{ dai: 2400 }, { dai: 2800 }] }, r = C.xepBep(bo), c = r.pa[0] && r.pa[0].ds.find(m => m.chuc === 'chau' && m.tang === 'duoi');
    ok(r.pa.length > 0 && c && c.canh === 1 && r.chau_tu === 1 && r.bo.chau.canh === 1, 'L A 2400 / B 2800 (tủ lạnh mặc định): chậu tự sang cạnh B', [r.loi_chung, r.chau_tu]);
    ok(r.pa.length && r.pa[0].luu_y.some(x => /chậu/i.test(x) && /cạnh B/.test(x)), 'lưu ý nói chậu đã tự sang cạnh B', r.pa[0] && r.pa[0].luu_y);
    for (const [a, b, lo] of [[2100, 2800, false], [2600, 2800, false], [2700, 2800, true], [2800, 3400, true]]) {
      const r2 = C.xepBep({ kieu: 'L', canh: [{ dai: a }, { dai: b }], cao: lo ? [{ loai: 'lo' }] : [] });
      ok(r2.pa.length > 0, `L A ${a} / B ${b}${lo ? ' + lò' : ''}: có phương án (chậu sang B)`, r2.loi_chung);
    }
    const r3 = C.xepBep(Object.assign({}, bo, { ong: { canh: 0, s: 1500 } }));
    ok(!r3.pa.some(p => p.ds.some(m => m.chuc === 'chau' && m.canh === 1)), 'có ống thoát ở cạnh A: chậu không tự sang cạnh B', r3.pa.length);
    const r4 = C.xepBep({ kieu: 'L', canh: [{ dai: 3400 }, { dai: 3000 }], tl: null });
    ok(!r4.chau_tu && r4.pa[0].ds.find(m => m.chuc === 'chau').canh === 0, 'cạnh A đủ chỗ: chậu vẫn ở cạnh A (không đổi phương án cũ)'); }
  // (2) ghim tủ sát tường / sát góc rồi đổi dài vài mm: vẫn có phương án, tủ ghim đúng chỗ (nẹp phía tủ ghim giữ, phần dư sang nẹp / góc bên kia)
  { const pin = (bo, vt, ma, s0, canh) => Object.assign({}, bo, { khoa: { [vt]: { ma, s0, canh } } });
    const coGhim = (r, ma, s0, canh) => r.pa.length > 0 && r.pa.every(p => p.ds.some(m => m.ma === ma && m.ghim && m.canh === canh && Math.abs(s0T(m) - s0) < 0.5));
    for (const d of [4500, 4505, 4510, 4530]) { const r = C.xepBep(pin({ kieu: 'I', canh: [{ dai: d }], tl: null }, 'A1', 'BD-GV-450', 75, 0)); ok(coGhim(r, 'BD-GV-450', 75, 0), `I ${d}, ghim GV-450 sát tường trái: có phương án, tủ ghim đúng chỗ`, r.loi_chung); }
    const p0 = C.xepBep({ kieu: 'I', canh: [{ dai: 4500 }], tl: null }).pa, bep = p0.map(p => p.ds.find(m => m.chuc === 'bep')).find(m => m && s0T(m) < 1000);
    if (bep) for (const d of [4510, 4540]) { const r = C.xepBep(pin({ kieu: 'I', canh: [{ dai: d }], tl: null }, bep.vt, bep.ma, s0T(bep), 0)); ok(coGhim(r, bep.ma, s0T(bep), 0), `I ${d}, ghim bếp gần tường trái (s0 ${s0T(bep)}): có phương án`, r.loi_chung); }
    const L0 = { kieu: 'L', canh: [{ dai: 3050 }, { dai: 3050, re: 'trai' }], tl: null }, pL = C.xepBep(L0).pa[0];
    const dsC = c => pL.ds.filter(q => q.tang === 'duoi' && q.canh === c).sort((a, b) => a.u0 - b.u0);
    for (const [ten, f] of [['B kề tủ đầu tường', () => dsC(1)[dsC(1).length - 2]], ['A kề tủ góc', () => dsC(0)[1]], ['B tủ mang nẹp góc', () => dsC(1).find(q => q.nep && q.nep.goc)]]) {
      const m = f(); if (!m) { ok(false, 'không thấy tủ ' + ten); continue; }
      for (const dd of [10, 40]) {
        const bo = clone(L0); bo.canh[m.canh].dai += dd;
        const r = C.xepBep(pin(bo, m.vt, m.ma, s0T(m), m.canh));
        ok(coGhim(r, m.ma, s0T(m), m.canh), `L ghim ${ten} (${m.ma}), cạnh ${'AB'[m.canh]} +${dd}: có phương án, tủ ghim đúng chỗ`, r.loi_chung);
      }
    }
    const r5 = C.xepBep(pin({ kieu: 'I', canh: [{ dai: 4510 }], tl: null }, 'A1', 'BD-GV-450', 40, 0));
    ok(r5.pa.length === 0 && r5.loi_chung.some(x => /ghim/.test(x)), 'ghim không thể giữ được (s0 40 < nẹp tối thiểu): lời báo nhắc tủ đã ghim', r5.loi_chung); }
  // (3) dãy hai đầu hở: tủ cỡ lẻ bội 5; phần dư < 20 không tủ nào nhận → LƯU Ý nẹp chỉ / silicon, kiemDay không báo "khác dài"
  for (const d of [3007, 3333, 3020, 3049]) {
    const r = C.xepBep({ kieu: 'I', canh: [{ dai: d, dau: 'ho', cuoi: 'ho' }], tl: null }), p = r.pa[0];
    ok(p && p.ds.filter(m => m.le).every(m => Math.abs(m.rong / 5 - Math.round(m.rong / 5)) < 1e-6), `I ${d} hai đầu hở: tủ lẻ bội 5`, p && p.ds.filter(m => m.le).map(m => m.rong));
    const du = p && (p.canh[0].du || 0);
    ok(p && du >= 0 && du < 20 && (du > 0.01 ? p.luu_y.some(x => /nẹp chỉ|silicon/.test(x)) : true), `I ${d}: phần dư ${du} có LƯU Ý nẹp chỉ / silicon`, p && [du, p.luu_y]);
    const dd = p && p.ds.filter(m => m.tang !== 'tren'); ok(p && Math.abs(Math.max(...dd.map(m => m.u1)) - (d - du)) < 0.5 && p.da[0].u1 === d - du + 20, `I ${d}: dãy dừng ở dài − dư, đá nhô 20`, p && [Math.max(...dd.map(m => m.u1)), p.da[0].u1]);
  }
  // (4) đá theo dãy ra bảng kê (keDaDay / daDayCSV): mỗi tấm một dòng, có mối nối, khoét chậu / bếp kèm vị trí, đầu nhô
  { const bo = { kieu: 'I', canh: [{ dai: 4500 }], tl: { may: 'bon_canh_830', dau: 'dau' }, ong: { canh: 0, s: 3700 } }, r = C.xepBep(bo), pa = r.pa[0];
    ok(typeof C.keDaDay === 'function' && typeof C.daDayCSV === 'function', 'có keDaDay + daDayCSV');
    const ke = C.keDaDay(r.bo, pa), csv = C.daDayCSV(r.bo, pa);
    ok(ke.length === pa.da.reduce((n, d) => n + d.tam.length, 0), 'mỗi tấm đá một dòng', ke);
    ok(ke.some(x => /khoét chậu/.test(x.ghi_chu) && /tâm cách mép trái/.test(x.ghi_chu)) && ke.some(x => /khoét bếp/.test(x.ghi_chu)), 'dòng đá có khoét chậu + bếp kèm vị trí', ke.map(x => x.ghi_chu));
    ok(pa.da[0].noi.length ? ke.some(x => /mối nối/.test(x.ghi_chu)) : true, 'có mối nối thì ghi mối nối', ke.map(x => x.ghi_chu));
    ok(/Gia công đá/.test(csv) && csv.split('\n').length >= ke.length + 1, 'CSV đá có dòng Gia công đá', csv);
    const pL = C.xepBep({ kieu: 'I', canh: [{ dai: 3600, dau: 'ho' }], tl: null }), keL = C.keDaDay(pL.bo, pL.pa[0]);
    ok(keL.some(x => /nhô 20/.test(x.ghi_chu)), 'đầu hở: ghi đá nhô 20', keL.map(x => x.ghi_chu));
    // (4b — vòng soát 4) đầu hở mà khối cao (tủ lạnh) đứng ở đầu đó: đá dừng ở mép khối cao → KHÔNG ghi "nhô 20"
    for (const [b2, ten] of [[{ kieu: 'I', canh: [{ dai: 4200, dau: 'ho' }] }, 'I đầu trái hở + tủ lạnh đầu trái'], [{ kieu: 'L', canh: [{ dai: 3000 }, { dai: 3200, cuoi: 'ho' }], tl: { canh: 1 } }, 'L cuối B hở + tủ lạnh cạnh B']]) {
      const r2 = C.xepBep(b2), p2 = r2.pa[0], k2 = p2 && C.keDaDay(r2.bo, p2);
      ok(p2 && p2.ds.some(m => m.tang === 'cao') && !k2.some(x => /nhô 20/.test(x.ghi_chu)), `${ten}: đá tì khối cao, không ghi "nhô 20"`, k2 && k2.map(x => x.ghi_chu));
    } }
  // (6) phụ trợ đỡ đá của tủ mang nẹp góc: nằm dưới đầu đá cạnh B (mép trước đá A) — nẹp góc rộng cũng không hẫng
  for (const [bo, ten] of [[{ kieu: 'L', canh: [{ dai: 3000 }, { dai: 1825, cuoi: 'ho' }], tl: null }, 'rẽ phải'], [{ kieu: 'L', canh: [{ dai: 3000 }, { dai: 1825, cuoi: 'ho', re: 'trai' }], tl: null }, 'rẽ trái'], [{ kieu: 'L', canh: [{ dai: 3000 }, { dai: 2400 }], tl: null }, 'mặc định']]) {
    const r = C.xepBep(bo), pa = r.pa[0], b1 = pa.ds.find(m => m.canh === 1 && m.tang === 'duoi' && m.nep && m.nep.goc);
    const x = C.tuBo(r.bo, pa).find(q => q.vt === b1.vt), M = C.build(x.spec), W = x.spec.rong, dua = x.spec.bep.dua_da;
    const dd = M.parts.filter(p => p.ten === 'Phụ trợ đỡ đá'), j = b1.nep.goc === 'trai' ? dua : W - dua;      // mối nối đá A – đá B trong toạ độ module
    const top = Math.max(...dd.map(p => p.z1));
    ok(dd.length && dd.some(p => p.x0 <= j + 0.01 && p.x1 >= j - 0.01 && p.z1 === top) && dd.every(p => p.y1 - p.y0 > 300), `${ten}: phụ trợ đỡ đá nằm dưới mối nối đá A – B (nẹp góc ${b1.nep[b1.nep.goc]})`, dd.map(p => [p.x0, p.x1, p.y0, p.y1, p.z0, p.z1, j]));
    ok(!M.errors.length && overlapAny(M).length === 0, `${ten}: tủ nẹp góc không lỗi, không tấm chồng`, [M.errors, overlapAny(M)]);
  }
  // (7) tủ trên đầu cạnh B rộng > 1000 lọt lòng: hai khoang (không còn cảnh báo "thêm vách chia khoang" mà trong bộ không làm theo được)
  { const r = C.xepBep({ kieu: 'L', canh: [{ dai: 2600 }, { dai: 2680, cuoi: 'ho' }], tl: null }), pa = r.pa[0], bt = pa.ds.find(m => m.vt === 'BT1' && m.canh === 1) || pa.ds.find(m => m.canh === 1 && m.tang === 'tren' && m.rong > 1000);      // (1.35) B 2680: tủ đầu cạnh B → tủ trên 1045 (lọt 1010 > 1000)
    ok(bt && bt.rong > 1000, 'có tủ trên đầu cạnh B rộng > 1000', bt);
    ok(!pa.canh_bao.some(x => /lọt lòng/.test(x)), 'không còn cảnh báo lọt lòng > 1000', pa.canh_bao);
    const x = C.tuBo(r.bo, pa).find(q => q.vt === bt.vt), M = C.build(x.spec);
    ok(x.spec.khoang.length === 2 && !M.errors.length && M.info.khoang.every(w => w <= x.spec.kiem.dot_max + 0.01), 'tủ trên đó chia 2 khoang, mỗi khoang ≤ dot_max', [x.spec.khoang, M.info.khoang]); }
  // (5) tủ thuộc dãy rời khỏi dãy (Thôi sửa → Vẽ mới, Lưu / Mở mẫu): roiDay bỏ bep.day → bảng kê có lại dòng Mặt đá
  { const r = C.xepBep({ kieu: 'I', canh: [{ dai: 3600 }], tl: null }), x = C.tuBo(r.bo, r.pa[0]).find(q => q.spec.bep.chuc_nang === 'chau');
    ok(!C.cutList(C.build(x.spec)).gia_cong_da, 'tủ trong dãy: không dòng Mặt đá riêng');
    ok(typeof C.roiDay === 'function', 'có roiDay');
    const s2 = C.roiDay(clone(x.spec)); ok(!s2.bep.day && C.cutList(C.build(C.normalize(s2))).gia_cong_da, 'roiDay: bỏ bep.day, có lại dòng Mặt đá');
    const s3 = C.roiDay(C.normalize({})); ok(s3 && !s3.bep, 'roiDay tủ áo: không đụng'); }
});

// Bản 1.35 — LUẬT CHIA DÃY BẾP MỚI (anh Thanh 14/10/2026, hộp tích — thay hàm chấm điểm 1.34) + tủ lạnh dương / âm từ máy gõ, "+ Tủ lạnh" ở mỗi đầu,
// tủ trên 2 tầng kịch trần, cánh khung kính + LED âm đáy tủ trên (theo ảnh bếp mẫu). Viết trước khi sửa lõi; số chưa đo ở xưởng [CĐ]: ngưỡng cỡ 3400 / 2600,
// trần 2700, khe trần 10, tầng trên tối thiểu 250, hở tủ lạnh âm 5 / 10 / 0, khung kính 60, rãnh LED 12 × 8 cách mép trước 40, 10 W/m.
T('Dãy bếp — luật chia 1.35, tủ lạnh dương / âm, tầng trên kịch trần, kính + LED', () => {
  const k = require.resolve('../src/mncf-core.js'), cu = require.cache[k]; delete require.cache[k]; const C = require(k); require.cache[k] = cu;
  C.DEFAULT_SPEC.thung.noc_day = 'lot'; C.DEFAULT_SPEC.ngan_keo.khung_mat = 0;
  const t = C.DEFAULT_SPEC.van.t;
  const duoi = (pa, canh) => pa.ds.filter(m => (m.tang === 'duoi' || m.tang === 'cao') && (canh === undefined || m.canh === canh)).sort((a, b) => a.u0 - b.u0);
  const tren = (pa, t2) => pa.ds.filter(m => m.tang === 'tren' && !!m.t2 === !!t2).sort((a, b) => a.u0 - b.u0);
  const ma = ds => ds.map(m => m.ma), nep = m => [m.nep ? m.nep.trai || 0 : 0, m.nep ? m.nep.phai || 0 : 0];
  // (bước giao diện 1.35) GHIM KHÔNG XÔ LỆCH: "Đổi thành" một khoang chia đều (E1: A1 cánh 355 → 3 ngăn kéo 355) — phương án 1 giữ đúng mối nối cũ
  // (trước khi sửa: ghim cắt cạnh, đoạn sau gộp hai khoang 355 thành một 710 → Cập nhật bộ vẽ lại 14 tủ thay vì 1)
  { const b = { kieu: 'I', canh: [{ dai: 4500 }], tl: { may: 'bon_canh_830', dau: 'dau', ban_le: 'tuong' }, ong: { canh: 0, s: 3700 } }, r0 = C.xepBep(b), p0 = r0.pa[0];
    const moc = pa => JSON.stringify(pa.ds.filter(m => m.tang !== 'tren').map(m => [m.canh, m.s0, m.dai])), tu = pa => JSON.stringify(pa.ds.map(m => [m.vt, m.s0, m.dai]));
    for (const a of p0.ds.filter(m => m.tang === 'duoi' && /^BD-(CANH|NK3)-/.test(m.ma) && !m.nep && !m.op)) {
      const ma2 = a.ma.replace(/^BD-(CANH|NK3)-/, (x, k) => (k === 'CANH' ? 'BD-NK3-' : 'BD-CANH-')), r = C.xepBep(Object.assign({}, b, { khoa: { [a.vt]: { ma: ma2, s0: a.s0, canh: 0 } } })), p = r.pa[0];
      ok(p && moc(p) === moc(p0) && tu(p) === tu(p0) && p.ds.filter(m => m.ma !== (p0.ds.find(q => q.vt === m.vt) || {}).ma).map(m => m.vt).join() === a.vt, `ghim không xô lệch: ${a.vt} ${a.ma} → ${ma2}, mọi tủ khác giữ chỗ + mã vị trí`, [ma(p0.ds), p && ma(p.ds)]);
    }
    const b2 = { kieu: 'L', canh: [{ dai: 3050, dau: 'tuong' }, { dai: 2450, cuoi: 'ho' }], tl: null, ong: { canh: 0, s: 920 }, bep: { canh: 1 } }, q0 = C.xepBep(b2).pa[0], g = q0.ds.find(m => m.canh === 1 && m.tang === 'duoi' && m.chuc === 'gv');
    const q = C.xepBep(Object.assign({}, b2, { khoa: { [g.vt]: { ma: 'BD-GAO-300', s0: g.s0 + ((g.nep && g.nep.trai) || 0), canh: 1 } } })).pa[0];
    ok(q && moc(q) === moc(q0) && q.ds.find(m => m.vt === g.vt).ma === 'BD-GAO-300', 'chữ L: đổi tủ gia vị cạnh B thành tủ gạo cùng rộng — các tủ khác giữ chỗ', [ma(q0.ds), q && ma(q.ds)]); }
  const xep = (b, o) => C.xepBep(b, o).pa[0];

  // 1. CHẬU = BẾP CÙNG CỠ 700 / 800 / 900 theo dài phần dãy dưới (≥ 3400 → 900, ≥ 2600 → 800, còn lại 700 [CĐ]); gõ cỡ thì theo cỡ gõ
  for (const [L, co] of [[2600, 700], [3000, 800], [3600, 900]]) {
    const p = xep({ kieu: 'I', canh: [{ dai: L }], tl: null }), c = p.ds.find(m => m.chuc === 'chau'), b = p.ds.find(m => m.chuc === 'bep'), h = p.ds.find(m => m.chuc === 'hm'), bt = p.ds.find(m => m.chuc === 'bat');
    eq([c.rong, b.rong, h.ma, h.rong, bt.ma], [co, co, `BT-HM-${co}`, co, `BT-BAT-${co}`], `I ${L} (dãy dưới ${L - 140}): chậu = bếp ${co}, tủ hút mùi + giá bát đúng cỡ tủ dưới`);
  }
  { const p = xep({ kieu: 'I', canh: [{ dai: 4200 }], tl: null, co: 700 }); eq(ma(p.ds.filter(m => /CHAU|BEP|HM-|BAT/.test(m.ma))).sort(), ['BD-BEP-700', 'BD-CHAU-700', 'BT-BAT-700', 'BT-HM-700'], 'gõ cỡ 700 ở dãy 4200: chậu / bếp / hút mùi / giá bát đều 700'); }
  { const b = C.chuanBo({ chau: { co: 900 } }); eq([b.co, b.chau.co, b.bep.co], [900, 900, 900], 'bảng cũ ghi chau.co → cỡ chung cho cả bếp'); }
  for (const ma7 of ['BD-CHAU-700', 'BD-BEP-700', 'BT-HM-700', 'BT-HM-900']) { const M = C.build(C.apMau(C.DEFAULT_SPEC, ma7)); ok(!M.errors.length && !M.warnings.length, `${ma7}: thiết bị lọt tủ, không cảnh báo (kiemBep)`, [M.errors, M.warnings]); }

  // 2. KHOANG RỔ đúng cỡ rổ + vị trí: gia vị kề bếp phía xa chậu, thùng rác kề chậu phía xa bếp; tắt rổ thì không có
  { const p = xep({ kieu: 'I', canh: [{ dai: 3600 }], tl: null }), d = duoi(p), j = q => d.findIndex(m => m.chuc === q);
    ok(Math.abs(j('gv') - j('bep')) === 1 && Math.abs(j('rac') - j('chau')) === 1 && (j('gv') - j('bep')) * (j('chau') - j('bep')) < 0 && (j('rac') - j('chau')) * (j('bep') - j('chau')) < 0, 'I 3600: gia vị kề bếp phía xa chậu, thùng rác kề chậu phía xa bếp', ma(d));
    ok(d.filter(m => /GV|RAC/.test(m.ma)).every(m => m.rong === 300), 'rổ đúng cỡ 300');
    const p0 = xep({ kieu: 'I', canh: [{ dai: 3600 }], tl: null, ro: [] }); ok(!p0.ds.some(m => /GV|RAC|GAO/.test(m.ma)), 'ro: [] — không khoang rổ', ma(duoi(p0))); }

  // 3. CHIA ĐỀU: khoang cánh / ngăn kéo cùng bề rộng (tròn 5, ≤ 900), kề bếp là ngăn kéo; dư dồn vào nẹp đầu sát tường (hai tường: chia đôi)
  { const p = xep({ kieu: 'I', canh: [{ dai: 3600 }], tl: null }), d = duoi(p);
    eq(ma(d), ['BD-GV-300', 'BD-BEP-900', 'BD-NK3-530', 'BD-CANH-530', 'BD-CHAU-900', 'BD-RAC-300'], 'I 3600: gia vị | bếp 900 | ngăn kéo 530 | cánh 530 | chậu 900 | thùng rác');
    eq([nep(d[0]), nep(d[5])], [[70, 0], [0, 70]], 'I 3600: nẹp 70 / 70');
    const q = xep({ kieu: 'I', canh: [{ dai: 3605 }], tl: null }), e = duoi(q);
    eq([ma(e), nep(e[0]), nep(e[5])], [ma(d), [75, 0], [0, 70]], 'I 3605: khoang giữ 530 (tròn 5 xuống), dư 5 vào nẹp (hai tường chia đôi, tròn 5) → 75 / 70');
    const h = xep({ kieu: 'I', canh: [{ dai: 3605, cuoi: 'ho' }], tl: null }), f = duoi(h);
    ok(f.filter(m => /CANH|NK3/.test(m.ma)).every(m => m.rong % 5 === 0) && nep(f[0])[0] >= 70 && !f[f.length - 1].nep && f[f.length - 1].op === 'phai', 'tường – hở: khoang tròn 5, dư vào nẹp đầu tường, đầu hở là ốp', [ma(f), nep(f[0]), f[f.length - 1]]);
    for (const m of tren(p)) ok(d.some(x => x.u0 === m.u0) && d.some(x => x.u1 === m.u1), `tủ trên ${m.vt} trùng mối nối tủ dưới`); }
  { const b = { kieu: 'I', canh: [{ dai: 6000 }], tl: null }, p = xep(b), w = duoi(p).filter(m => /CANH|NK3/.test(m.ma)).map(m => m.rong);
    ok(w.length && w.every(x => x === w[0] && x <= 900), 'I 6000: mọi khoang chia đều cùng cỡ ≤ 900', w); }

  // 4. TỦ LẠNH DƯƠNG / ÂM từ kích thước máy gõ: dương hở 20 hông / 50 trên, khoang không đáy không cánh ô hốc; âm hở 5 mỗi hông, tủ cao bao có đáy + hậu + cánh ốp
  const may = { rong: 600, sau: 545, cao: 1780 };
  { const bD = C.chuanBo({ tl: { may } }), bA = C.chuanBo({ tl: { may, kieu: 'am' } });
    eq([bD.tl.kieu, bD.tl.ho_hong, bD.tl.ho_tren, bA.tl.kieu, bA.tl.ho_hong, bA.tl.ho_tren, bA.tl.ho_sau], ['duong', 20, 50, 'am', 5, 10, 0], 'chuanBo: hở mặc định theo kiểu — dương 20 / 50, âm 5 / 10 / 0');
    eq(C.chuanBo({ tl: { may: 'am_560' } }).tl.kieu, 'am', 'máy âm của danh mục → kiểu âm');
    const pD = xep({ kieu: 'I', canh: [{ dai: 4200 }], tl: { may } }), pA = xep({ kieu: 'I', canh: [{ dai: 4200 }], tl: { may, kieu: 'am' } });
    const tD = pD.ds.find(m => m.chuc === 'tl'), tA = pA.ds.find(m => m.chuc === 'tl');
    eq([tD.ma, tD.rong, tA.ma, tA.rong], ['BC-TL-tu_chon', 600 + 40 + 2 * t, 'BC-TLA-tu_chon', 600 + 10 + 2 * t], 'khoang dương = máy + 2 × 20 + 2 hồi; tủ cao âm = máy + 2 × 5 + 2 hồi');
    const xA = C.tuBo(pA.bo || C.chuanBo({ kieu: 'I', canh: [{ dai: 4200 }], tl: { may, kieu: 'am' } }), pA).find(x => x.vt === tA.vt), MA = C.build(xA.spec), P = l => MA.parts.filter(q => q.loai === l);
    const hoc = MA.info.bep.hoc.find(h => h.tb === 'tl');
    ok(!MA.errors.length && P('DAY').length && P('CHAN').length && P('HAU').some(q => q.z0 < hoc.z1 && q.z1 > hoc.z0), 'tủ lạnh âm: tủ cao có đáy + chân + hậu sau hốc', MA.errors);
    ok(P('CANH').some(q => q.op_tl && !q.ban_le && q.z0 <= hoc.z0 + 5 && q.z1 >= hoc.z1 - 5) && P('CANH').some(q => !q.op_tl && q.z0 > hoc.z1), 'tủ lạnh âm: cánh ốp phủ hốc (không bản lề tủ — ray dẫn cánh) + cánh ô trên riêng', P('CANH').map(q => [q.z0, q.z1, !!q.op_tl]));
    ok(near(hoc.z1 - hoc.z0, may.cao + 10) && C.cutList(MA).phu_kien.some(x => /ray dẫn cánh/.test(x.ten)), 'tủ lạnh âm: hốc = cao máy + hở trên 10; phụ kiện bộ ray dẫn cánh', [hoc, C.cutList(MA).phu_kien.map(x => x.ten)]);
    ok(pA.luu_y.some(x => /âm/.test(x) && /catalogue/.test(x)), 'tủ lạnh âm: LƯU Ý kiểm catalogue máy', pA.luu_y);
    const xD = C.tuBo(C.chuanBo({ kieu: 'I', canh: [{ dai: 4200 }], tl: { may } }), pD).find(x => x.vt === tD.vt), MD = C.build(xD.spec), hD = MD.info.bep.hoc.find(h => h.tb === 'tl');
    ok(!MD.parts.some(q => q.loai === 'CANH' && q.z0 < hD.z1) && !MD.parts.some(q => q.loai === 'DAY'), 'tủ lạnh dương: không đáy, không cánh ở ô hốc', MD.parts.filter(q => q.loai === 'CANH').map(q => [q.z0, q.z1]));
    const big = C.build(C.normalize(Object.assign(JSON.parse(JSON.stringify(xA.spec)), { bep: Object.assign({}, xA.spec.bep, { tb: { tl: Object.assign({}, xA.spec.bep.tb.tl, { sau: 600 }) } }) })));
    ok(big.errors.some(x => /âm/.test(x) && /lọt sâu/.test(x)), 'tủ lạnh âm sâu hơn lọt sâu tủ cao: LỖI (cánh ốp không đóng)', big.errors); }

  // 5. "+ Tủ lạnh" ở mỗi đầu (bấm lần nữa = bỏ): chữ I hai đầu, chữ L đầu xa góc của hai cạnh
  { let b = C.chuanBo({ kieu: 'I', canh: [{ dai: 5200 }] });
    b = C.tlBo(b, { dau: 'cuoi' }); ok(b.tl.dau === 'dau' && b.tl2 && b.tl2.dau === 'cuoi', 'tlBo I: thêm tủ lạnh đầu phải (tủ lạnh thứ hai)', [b.tl, b.tl2]);
    const p = xep(b), tl = p.ds.filter(m => m.chuc === 'tl').sort((a, c) => a.u0 - c.u0);
    ok(tl.length === 2 && tl[0].u0 === 0 && tl[1].u1 === 5200 && tl.map(m => m.tl_i).join() === '0,1', 'xepBep: hai khoang tủ lạnh ở hai đầu', duoi(p).map(m => [m.ma, m.u0, m.u1]));
    ok(!p.loi.length && C.kiemDay(b, p).loi.length === 0, 'hai tủ lạnh: không LỖI');
    const b2 = C.tlBo(b, { dau: 'dau' }); ok(b2.tl && b2.tl.dau === 'cuoi' && !b2.tl2, 'tlBo I: bỏ tủ lạnh đầu trái → tủ lạnh còn lại (đầu phải) thành tủ lạnh chính', [b2.tl, b2.tl2]);
    const b3 = C.tlBo(b2, { dau: 'cuoi' }); ok(b3.tl === null && !b3.tl2, 'tlBo I: bỏ nốt → không tủ lạnh', b3.tl);
    const b4 = C.tlBo(b, { dau: 'cuoi', kieu: 'am' }); ok(b4.tl2.kieu === 'am' && b4.tl2.ho_hong === 5 && b4.tl.kieu === 'duong', 'tlBo: đổi kiểu tủ lạnh một đầu (hở về mặc định của kiểu mới)', b4.tl2);
    let L = C.chuanBo({ kieu: 'L', canh: [{ dai: 3600 }, { dai: 3400 }], tl: null });
    L = C.tlBo(L, { canh: 0 }); L = C.tlBo(L, { canh: 1 });
    ok(L.tl.canh === 0 && L.tl2.canh === 1, 'tlBo L: tủ lạnh đầu xa góc cả hai cạnh', [L.tl, L.tl2]);
    const pL = xep(L); ok(pL && [0, 1].every(c => duoi(pL, c).slice(-1)[0].chuc === 'tl'), 'chữ L hai tủ lạnh: mỗi cạnh tủ lạnh ở đầu xa góc', pL && [0, 1].map(c => ma(duoi(pL, c)))); }

  // 6. TỦ TRÊN 2 TẦNG KỊCH TRẦN: tầng trên = trần − đỉnh tầng dưới − khe 10; < 250 thì không làm (LƯU Ý nẹp trần); trên khối cao cũng có
  { const p = xep({ kieu: 'I', canh: [{ dai: 4200 }] }), t1 = tren(p), t2 = tren(p, true), cao = duoi(p).filter(m => m.tang === 'cao');
    ok(t2.length === t1.length + cao.length && t2.every(m => m.z === 2360 && m.cao === 330) && cao.every(c => t2.some(m => m.u0 === c.u0 && m.u1 === c.u1 && m.sau_cao)), 'trần 2700: tầng trên 330 ở +2360 trên mọi tủ trên + khối cao (sâu theo tủ cao)', t2.map(m => [m.ma, m.u0, m.u1, m.cao]));
    for (const m of t1) ok(t2.some(q => q.u0 === m.u0 && q.u1 === m.u1), `tầng trên thẳng mối nối ${m.vt}`);
    const x = C.tuBo(C.chuanBo({ kieu: 'I', canh: [{ dai: 4200 }] }), p).filter(q => p.ds.find(m => m.vt === q.vt).t2);
    ok(x.every(q => { const M = C.build(q.spec); return !M.errors.length && near(M.info.bep.z_dat, 2360) && q.spec.cao === 330 && !q.spec.khoang.some(k => (k.dot || []).length); }), 'tầng trên: dựng sạch, đặt +2360, cao 330, không đợt', x.map(q => [q.vt, C.build(q.spec).errors]));
    const thap = C.xepBep({ kieu: 'I', canh: [{ dai: 4200 }], tran: 2550 }).pa[0];
    ok(!thap.ds.some(m => m.t2) && thap.tang2 === null && thap.luu_y.some(m => /nẹp trần/.test(m) && /\b190\b/.test(m)), 'trần 2550 (tầng trên 180 < 250): không làm, LƯU Ý bịt nẹp trần khe 190 (vòng soát 1.35: lời báo nói khe thật)', thap.luu_y);
    ok(!xep({ kieu: 'I', canh: [{ dai: 4200 }], tran: 0 }).ds.some(m => m.t2), 'tran 0: không tầng trên');
    const cao3 = xep({ kieu: 'I', canh: [{ dai: 4200 }], tran: 3100 }), x3 = C.tuBo(C.chuanBo({ kieu: 'I', canh: [{ dai: 4200 }], tran: 3100 }), cao3).filter(q => cao3.ds.find(m => m.vt === q.vt).t2);
    ok(cao3.tang2.cao === 730 && x3.every(q => q.spec.khoang.every(k => k.dot.length === (q.spec.bep.ong_hm ? 0 : 1)) && !C.build(q.spec).errors.length), 'trần 3100: tầng trên 730 có một đợt giữa (trừ tủ trên hút mùi — ống khói đi qua, vòng soát 1.35)', cao3.tang2); }

  // 7. CÁNH KHUNG KÍNH (mặc định tủ giá bát; chọn được theo vị trí; tắt) + LED âm đáy tủ trên (rãnh + dải LED + một nguồn cho cả dãy)
  { const b = C.chuanBo({ kieu: 'I', canh: [{ dai: 3600 }], tl: null }), p = xep(b), tu = C.tuBo(b, p), t1 = tren(p);
    const kinh = tu.filter(x => x.spec.bep.kinh);
    eq(kinh.map(x => p.ds.find(m => m.vt === x.vt).chuc), ['bat'], 'kính mặc định: tủ giá bát (trên chậu)');
    const M = C.build(kinh[0].spec), cs = M.parts.filter(q => q.loai === 'CANH');
    ok(cs.length && cs.every(q => q.kinh && q.kinh.thanh === 60 && /khung kính/.test(q.gia_cong)) && C.cutList(M).phu_kien.some(x => /Kính cánh khung/.test(x.ten) && x.sl === cs.length), 'cánh khung kính: khung 4 thanh 60 ghi ở dòng cánh, kính ở phụ kiện', [cs.map(q => q.gia_cong), C.cutList(M).phu_kien.map(x => x.ten)]);
    ok((C.elevationSVG(M).match(/data-kinh/g) || []).length === cs.length, 'hình đứng vẽ lòng kính từng cánh');
    const canh = t1.find(m => m.chuc === 'canh'), b2 = Object.assign({}, b, { kinh: [{ canh: canh.canh, s: canh.s0 + canh.dai / 2 }] }), k2 = C.tuBo(b2, p).filter(x => x.spec.bep.kinh);
    eq(k2.map(x => x.vt), [canh.vt], 'kính chọn theo chỗ tủ trên (vòng soát 1.35: { canh, s }, không theo mã vị trí)');
    ok(!C.tuBo(Object.assign({}, b, { kinh: 'khong' }), p).some(x => x.spec.bep.kinh), 'kinh: khong — không tủ nào cánh kính');
    const led = tu.filter(x => x.spec.bep.led), nguon = led.filter(x => x.spec.bep.led_nguon);
    ok(led.length === t1.filter(m => m.chuc !== 'hm').length && nguon.length === 1, 'LED: mọi tủ trên tầng dưới trừ hút mùi; một tủ mang nguồn', led.map(x => x.vt));
    const ML = C.build(nguon[0].spec), pk = C.cutList(ML).phu_kien;
    ok(ML.parts.filter(q => q.loai === 'DAY').every(q => /rãnh LED/.test(q.gia_cong)) && pk.some(x => /Dải LED/.test(x.ten)) && pk.some(x => /Nguồn LED/.test(x.ten)), 'LED: soi rãnh dưới đáy + dải LED + nguồn', pk.map(x => x.ten));
    const tong = led.reduce((n, x) => n + x.spec.rong - x.spec.phao.trai - x.spec.phao.phai - 2 * t - 20, 0); ok(near(nguon[0].spec.bep.led_nguon, tong, 0.2), 'nguồn LED theo tổng chiều dài dải', [nguon[0].spec.bep.led_nguon, tong]);
    ok(!C.tuBo(Object.assign({}, b, { led: false }), p).some(x => x.spec.bep.led), 'led: false — không LED');
    const tuAo = C.normalize(Object.assign({}, C.DEFAULT_SPEC, { bep: { kinh: 1, led: 1 } })); ok(!tuAo.bep, 'tủ áo: không nhận khoá kính / LED'); }

  // 8. BỘ LƯU Ở 1.34 (v 1) mở lại: chuanBo nâng — vẫn chia được theo luật mới; tầng trên / kính / LED tắt (mở lại không mọc thêm tủ); cỡ theo chau.co, bep.co 900
  { const v1 = { v: 1, ma: 'B3', kieu: 'I', canh: [{ dai: 4200, dau: 'tuong', cuoi: 'tuong' }], tl: { canh: 0, dau: 'dau', may: 'hai_canh_700', ban_le: 'tuong', tan_nhiet: null, ho_hong: 20, ho_tren: 50, ho_sau: 50 }, cao: [], chau: { canh: 0, s: null, co: null }, bep: { canh: 0, s: null, co: 800 }, hm: 'am', vs: 380, goc: null, khoa: {}, ong: null, cua_so: null, chuan: {} };
    const b = C.chuanBo(v1);
    eq([b.v, b.ma, b.tran, b.kinh, b.led, b.co, b.tl.kieu], [2, 'B3', 0, 'khong', false, null, 'duong'], 'bộ 1.34: v 2, tầng trên / kính / LED tắt, cỡ tự chọn (bep.co 800 là mặc định cũ)');
    eq(C.chuanBo(Object.assign({}, v1, { bep: { co: 900 } })).co, 900, 'bộ 1.34 chọn bếp 900 → cỡ chung 900');
    eq(JSON.stringify(C.chuanBo(b)), JSON.stringify(b), 'chuanBo ổn định (nâng một lần)');
    const p = xep(v1); ok(p && !p.loi.length && !p.ds.some(m => m.t2) && !C.tuBo(b, p).some(x => x.spec.bep.kinh || x.spec.bep.led), 'bộ 1.34 chia lại theo luật mới, không tầng trên / kính / LED', p && ma(duoi(p))); }
});

// Bản 1.35 — VÒNG SOÁT luật chia mới (soát đối kháng 14/10/2026): mỗi lỗi đã xác nhận một phép thử, viết TRƯỚC khi sửa lõi.
T('Dãy bếp — vòng soát 1.35', () => {
  const k = require.resolve('../src/mncf-core.js'), cu = require.cache[k]; delete require.cache[k]; const C = require(k); require.cache[k] = cu;
  C.DEFAULT_SPEC.thung.noc_day = 'lot'; C.DEFAULT_SPEC.ngan_keo.khung_mat = 0;
  const t = C.DEFAULT_SPEC.van.t, tc = C.DEFAULT_SPEC.van.t_canh;
  const moc = pa => JSON.stringify(pa.ds.filter(m => m.tang !== 'tren').map(m => [m.canh, m.s0, m.dai, m.chuc]).sort());
  const s0T = m => m.s0 + ((m.nep && m.nep.trai) || 0) + (m.op === 'trai' ? tc : 0);
  const ma = pa => pa.ds.filter(m => m.tang !== 'tren').sort((a, b) => a.canh - b.canh || a.u0 - b.u0).map(m => `${m.ma}@${m.u0}`);
  // 1. GHIM một khoang RỔ đúng chỗ của nó: rổ đã ghim là rổ của cụm chậu / bếp — không sinh rổ thứ hai, chậu / bếp / khoang chia đều đứng yên
  for (const dai of [4200, 4870, 5500]) {
    const b = { kieu: 'I', canh: [{ dai }] }, p0 = C.xepBep(b).pa[0];
    for (const m of p0.ds.filter(q => q.tang === 'duoi' && /^BD-(RAC|GV|GAO)-/.test(q.ma))) {
      const p = C.xepBep(Object.assign({}, b, { khoa: { [m.vt]: { ma: m.ma, s0: s0T(m), canh: 0 } } })).pa[0], dem = pa => pa.ds.filter(q => q.chuc === m.chuc).length;
      ok(p && dem(p) === dem(p0) && moc(p) === moc(p0), `I ${dai}: ghim ${m.vt} ${m.ma} tại chỗ — không thêm rổ, dãy giữ nguyên`, [ma(p0), p && ma(p)]);
    }
  }
  { const b = { kieu: 'I', canh: [{ dai: 4200 }] }, p0 = C.xepBep(b).pa[0], g = p0.ds.find(m => m.chuc === 'gv'), b2 = Object.assign({}, b, { khoa: { [g.vt]: { ma: 'BD-GAO-300', s0: s0T(g), canh: 0 } } }), p = C.xepBep(b2).pa[0];
    ok(p && p.ds.filter(m => m.chuc === 'gv').length === 0 && p.ds.filter(m => m.chuc === 'gao').length === 1 && moc(p).replace(/"gao"/g, '"gv"') === moc(p0), 'đổi gia vị thành thùng gạo cùng chỗ: không mọc thêm gia vị, dãy giữ nguyên', [ma(p0), p && ma(p)]); }

  // 2. TẦNG TRÊN trên tủ hút mùi: ống khói đi qua → lỗ ống khói ở đáy + nóc, không đợt (cả hút mùi kính, cả trần cao có đợt)
  for (const [hm, tran] of [['am', 2700], ['kinh', 2700], ['am', 3100]]) {
    const b = C.chuanBo({ kieu: 'I', canh: [{ dai: 4200 }], hm, tran }), p = C.xepBep(b).pa[0], h = p.ds.find(m => m.chuc === 'hm'), u = p.ds.find(m => m.t2 && m.canh === h.canh && m.u0 < h.u1 - 1 && m.u1 > h.u0 + 1);
    const x = C.tuBo(b, p).find(q => q.vt === u.vt), M = C.build(x.spec), lo = l => M.parts.filter(q => q.loai === l && /ống khói/.test(q.ghi_bep || '')).length;
    ok(lo('DAY') >= 1 && lo('NOC') >= 1 && !x.spec.khoang.some(kk => (kk.dot || []).length) && !M.errors.length, `hút mùi ${hm}, trần ${tran}: tủ tầng trên ${u.vt} trên hút mùi có lỗ ống khói đáy + nóc, không đợt`, [M.parts.filter(q => /DAY|NOC/.test(q.loai)).map(q => q.ghi_bep), x.spec.khoang.map(kk => kk.dot)]);
    ok(/ống khói/.test(C.cutListCSV(M)), `hút mùi ${hm}: bảng kê tủ tầng trên ghi lỗ ống khói`);
    ok(p.luu_y.some(s => /ống khói/.test(s) && s.indexOf(u.vt) >= 0), `hút mùi ${hm}: LƯU Ý ống khói qua tủ tầng trên ${u.vt}`, p.luu_y);
  }
  { const b = C.chuanBo({ kieu: 'I', canh: [{ dai: 4200 }] }), p = C.xepBep(b).pa[0], h = p.ds.find(m => m.chuc === 'hm');
    for (const x of C.tuBo(b, p).filter(q => { const m = p.ds.find(z => z.vt === q.vt); return m.t2 && !(m.u0 < h.u1 - 1 && m.u1 > h.u0 + 1); })) ok(!x.spec.bep.ong_hm, `tủ tầng trên ${x.vt} không trên hút mùi: không lỗ ống`); }
  ok(!C.normalize(Object.assign({}, C.DEFAULT_SPEC, { bep: { ong_hm: 160 } })).bep, 'tủ áo: không nhận khoá ong_hm');

  // 3 + 6. TỦ LẠNH ÂM: tủ cao sâu theo máy (máy + hở sau + hậu) — máy sâu 560 / mặc định gõ 700 / 'hai_canh_700' vẫn có phương án, không LỖI
  for (const [ten, tl] of [['600 × 560 × 2000', { may: { rong: 600, sau: 560, cao: 2000 }, kieu: 'am' }], ['600 × (sâu mặc định) × 1800', { may: { rong: 600, cao: 1800 }, kieu: 'am' }], ['hai_canh_700 âm', { may: 'hai_canh_700', kieu: 'am' }]]) {
    const b = C.chuanBo({ kieu: 'I', canh: [{ dai: 4200 }], tl }), r = C.xepBep(b), p = r.pa[0];
    ok(p && !p.loi.length, `tủ lạnh âm ${ten}: có phương án`, r.loi_chung);
    if (!p) continue;
    const m = p.ds.find(q => q.chuc === 'tl'), T = C.tuBo(b, p), x = T.find(q => q.vt === m.vt), M = C.build(x.spec), hoc = M.info.bep.hoc.find(q => q.tb === 'tl'), may = x.spec.bep.tb.tl;
    ok(!M.errors.length && hoc.sau >= may.sau + may.ho_sau - 0.01 && x.spec.sau_thung > 560, `tủ lạnh âm ${ten}: tủ cao sâu ${x.spec.sau_thung} theo máy, hốc lọt sâu ${hoc.sau}`, M.errors);
    const u = p.ds.find(q => q.t2 && q.sau_cao && q.u0 === m.u0), xu = u && T.find(q => q.vt === u.vt);
    ok(!u || xu.spec.sau_thung === x.spec.sau_thung, `tủ lạnh âm ${ten}: tầng trên trên khối cao sâu đúng tủ cao`, xu && [xu.spec.sau_thung, x.spec.sau_thung]);
    ok(p.luu_y.some(s => /sâu/.test(s) && /theo máy/.test(s)), `tủ lạnh âm ${ten}: LƯU Ý tủ cao sâu theo máy`, p.luu_y);
  }
  { let b = C.chuanBo({ kieu: 'I', canh: [{ dai: 4200 }], tl: null }); b = C.tlBo(b, { dau: 'dau' }); b = C.tlBo(b, { dau: 'cuoi' }); b = C.tlBo(b, { dau: 'cuoi', kieu: 'am' });
    const b2 = C.tlBo(b, { dau: 'cuoi', may: { ma: 'tu_chon', rong: 560, sau: 560, cao: 1770 } }); ok(C.xepBep(b2).pa.length > 0, 'tủ lạnh thứ hai âm, gõ máy 560 × 560 × 1770: còn phương án', C.xepBep(b2).loi_chung);
    const b3 = C.tlBo(C.tlBo(C.chuanBo({ kieu: 'I', canh: [{ dai: 4200 }], tl: { may: { ma: 'tu_chon', rong: 700, sau: 700, cao: 1800 } } }), { dau: 'dau', kieu: 'am', may: { ma: 'tu_chon', rong: 700, sau: 700, cao: 1800 } }), {});
    ok(C.xepBep(b3).pa.length > 0, 'máy gõ 700 × 700 × 1800 chuyển sang Âm: còn phương án', C.xepBep(b3).loi_chung); }

  // 4. TRẦN thấp hơn đỉnh tủ trên / tủ cao: LỖI (không phương án), không chỉ LƯU Ý; trần vừa đủ (khe < 250): LƯU Ý nẹp trần với số đúng
  { const r = C.xepBep({ kieu: 'I', canh: [{ dai: 4200 }], tran: 2300 });
    ok(!r.pa.length && r.loi_chung.some(s => /Trần 2300/.test(s) && /2360/.test(s)), 'trần 2300 < đỉnh tủ trên 2360: không phương án, lời báo nói trần', r.loi_chung);
    ok(C.kiemDay({ kieu: 'I', canh: [{ dai: 4200 }], tran: 2300 }, C.xepBep({ kieu: 'I', canh: [{ dai: 4200 }], tran: 0 }).pa[0]).loi.some(s => /Trần 2300/.test(s)), 'kiemDay: trần thấp là LỖI');
    const p = C.xepBep({ kieu: 'I', canh: [{ dai: 4200 }], tran: 2400 }).pa[0];
    ok(p && !p.ds.some(m => m.t2) && p.luu_y.some(s => /Trần 2400/.test(s) && /nẹp trần/.test(s) && /\b40\b/.test(s)) && !p.loi.length, 'trần 2400: khe 40 trên tủ trên — LƯU Ý nẹp trần (không LỖI)', p && p.luu_y); }

  // 5. CÁCH TƯỜNG > 0: tầng trên trên khối cao thẳng mặt với tủ cao (cùng lưng)
  { const b = C.chuanBo({ kieu: 'I', canh: [{ dai: 4200 }], chuan: { cach_tuong: 30 } }), p = C.xepBep(b).pa[0], D = C.datDay(b, p, { goc: [0, 0, 0], xoay: 0 });
    const c = p.ds.find(m => m.tang === 'cao'), u = p.ds.find(m => m.t2 && m.sau_cao && m.u0 === c.u0), at = vt => D.find(x => x.vt === vt).at;
    ok(Math.abs(at(c.vt)[1] - at(u.vt)[1]) < 0.01, 'cách tường 30: tầng trên trên tủ cao cùng mặt trước với tủ cao', [at(c.vt), at(u.vt)]);
    const x = C.tuBo(b, p).find(q => q.vt === u.vt), xc = C.tuBo(b, p).find(q => q.vt === c.vt); ok(Math.abs(x.P - xc.P) < 0.01, 'sâu phủ bì tầng trên = tủ cao (cùng cách tường)', [x.P, xc.P]);
    const t1 = p.ds.find(m => m.tang === 'tren' && !m.t2), u1 = p.ds.find(m => m.t2 && !m.sau_cao && m.u0 === t1.u0); ok(Math.abs(at(t1.vt)[1] - at(u1.vt)[1]) < 0.01, 'tầng trên trên tủ trên: áp tường như tủ trên'); }

  // 7. KÉO TỦ LẠNH THỨ HAI: dời đúng tủ đó; thả trong nửa của nó = không đổi; thả sang nửa kia = hai tủ lạnh đổi đầu
  { const b = C.chuanBo({ kieu: 'I', canh: [{ dai: 4800 }], tl: { dau: 'dau', kieu: 'am', may: 'am_560' }, tl2: { kieu: 'duong', may: 'sbs_910' } });
    const b1 = C.keoBo(b, 'tl', { canh: 0, s: 4300, tl_i: 1 }); ok(b1.tl.dau === 'dau' && b1.tl.may === 'am_560' && b1.tl2.dau === 'cuoi' && b1.tl2.may === 'sbs_910', 'kéo tủ lạnh thứ hai (910 bên phải), thả vẫn bên phải: không đổi chỗ', [b1.tl, b1.tl2]);
    const b2 = C.keoBo(b, 'tl', { canh: 0, s: 500, tl_i: 1 }); ok(b2.tl.dau === 'cuoi' && b2.tl.may === 'am_560' && b2.tl2.dau === 'dau' && b2.tl2.may === 'sbs_910', 'kéo tủ lạnh thứ hai sang đầu trái: hai tủ lạnh đổi đầu (máy giữ của nó)', [b2.tl, b2.tl2]);
    const b3 = C.keoBo(b, 'tl', { canh: 0, s: 600 }); ok(b3.tl.dau === 'dau' && b3.tl2.dau === 'cuoi', 'kéo tủ lạnh chính trong nửa của nó: không đổi', [b3.tl, b3.tl2]);
    let L = C.tlBo(C.tlBo(C.chuanBo({ kieu: 'L', canh: [{ dai: 3600 }, { dai: 3400 }], tl: null }), { canh: 0 }), { canh: 1, kieu: 'am' });
    const L1 = C.keoBo(L, 'tl', { canh: 1, s: 3000, tl_i: 1 }); ok(L1.tl.canh === 0 && L1.tl2.canh === 1 && L1.tl2.kieu === 'am', 'chữ L: kéo tủ lạnh cạnh B trên cạnh B — không đổi', [L1.tl, L1.tl2]); }

  // 8. BỘ 1.34 chọn chậu 900 (v 1): 1.35 thử 900 trước, không đủ chỗ thì lùi 800 / 700 + LƯU Ý (không mất phương án)
  { const v1 = { v: 1, kieu: 'I', canh: [{ dai: 3050, dau: 'tuong', cuoi: 'tuong' }], tl: { canh: 0, dau: 'dau', may: 'hai_canh_700', ban_le: 'tuong', tan_nhiet: null, ho_hong: 20, ho_tren: 50, ho_sau: 50 }, cao: [], chau: { canh: 0, s: null, co: 900 }, bep: { canh: 0, s: null, co: 800 }, hm: 'am', vs: 380, goc: null, khoa: {}, ong: null, cua_so: null, chuan: {} };
    for (const dai of [3050, 3100]) {
      const r = C.xepBep(Object.assign({}, v1, { canh: [{ dai, dau: 'tuong', cuoi: 'tuong' }] })), p = r.pa[0];
      ok(p && p.ds.find(m => m.chuc === 'chau').rong < 900 && p.luu_y.some(s => /1\.34/.test(s) && /900/.test(s)), `bộ 1.34 chậu 900, dài ${dai}: lùi cỡ + LƯU Ý`, [r.loi_chung, p && p.luu_y]);
    }
    const p = C.xepBep(Object.assign({}, v1, { canh: [{ dai: 4500, dau: 'tuong', cuoi: 'tuong' }] })).pa[0]; ok(p && p.ds.find(m => m.chuc === 'chau').rong === 900, 'bộ 1.34 chậu 900, dài 4500: vẫn 900');
    const b = C.chuanBo(v1); eq(JSON.stringify(C.chuanBo(b)), JSON.stringify(b), 'chuanBo bộ 1.34 chậu 900: ổn định');
    ok(b.co === 900 && b.co_lui === 900, 'bộ 1.34 chậu 900: cỡ 900 + dấu lùi cỡ (co_lui)', b);
    const b3 = C.chuanBo(Object.assign({}, b, { co: 800, chau: Object.assign({}, b.chau, { co: 800 }), bep: Object.assign({}, b.bep, { co: 800 }) })); ok(!b3.co_lui && b3.co === 800, 'chọn cỡ khác ở bảng: bỏ dấu lùi cỡ của bộ 1.34', b3);
    const b4 = C.chuanBo(Object.assign({}, b, { co: null, chau: Object.assign({}, b.chau, { co: null }), bep: Object.assign({}, b.bep, { co: null }) })); ok(!b4.co_lui && b4.co === null, 'chọn "tự" ở bảng: bỏ dấu lùi cỡ', b4); }

  // 9. CÁNH KÍNH theo CHỖ (cạnh + điểm dọc cạnh), không theo mã vị trí: chia lại thì kính ở tủ đang đứng ở chỗ đó (hoặc không tủ nào), không trôi sang tủ khác
  { const b = C.chuanBo({ kieu: 'I', canh: [{ dai: 4200 }], tl: null, kinh: 'khong' }), p = C.xepBep(b).pa[0], a1 = p.ds.filter(m => m.tang === 'tren' && !m.t2 && m.chuc === 'canh').sort((x, y) => x.s0 - y.s0)[0];
    const kp = { canh: a1.canh, s: a1.s0 + a1.dai / 2 }, bk = C.chuanBo(Object.assign({}, b, { kinh: [kp] }));
    eq(C.tuBo(bk, C.xepBep(bk).pa[0]).filter(x => x.spec.bep.kinh).map(x => x.vt), [a1.vt], 'kính chọn theo chỗ: đúng tủ ở chỗ đó');
    eq(C.chuanBo(bk).kinh, [kp], 'chuanBo giữ chỗ kính');
    const b2 = C.tlBo(bk, { dau: 'dau' }), p2 = C.xepBep(b2).pa[0], T2 = C.tuBo(b2, p2).filter(x => x.spec.bep.kinh);
    ok(T2.every(x => { const m = p2.ds.find(q => q.vt === x.vt); return m.s0 <= kp.s && kp.s <= m.s0 + m.dai; }), '+ Tủ lạnh đầu trái: kính không trôi sang tủ khác (chỉ tủ đang ở chỗ đã chọn)', T2.map(x => [x.vt, x.s0]));
    ok(!C.chuanBo({ kinh: ['AT1'] }).kinh.length, 'kính dạng mã vị trí (bản thử 1.35): bỏ'); }
});

// Bản 1.34.1 — TÁP ĐẦU GIƯỜNG làm lại (anh Thanh 14/10/2026: "các mẫu tab đầu giường như này mà, mẫu của em xấu quá, cập nhật lại" + 5 ảnh mẫu):
// A gờ chắn (hồi + gờ sau nhô trên nóc thụt, bo góc) + hộc mở + 1 ngăn kéo lọt lòng · B gờ + 2 ngăn kéo lọt lòng có thanh ngang giữa · C nóc chồm (đua) + hộc mở + 1 ngăn kéo
// D hộp 2 ngăn kéo trùm, nóc + đáy phủ, khe tay nắm · E nóc phủ, 2 ngăn kéo tay nắm khoét, chân gỗ rời 4 cái. Khoá mới nằm trong s.tap (chỉ táp có); táp cũ (không s.tap) dựng như 1.32.
T('Táp đầu giường (bản 1.34.1)', () => {
  const D0 = C0.DEFAULT_SPEC, ap = ma => C0.apMau(D0, ma), PK = (M, re) => (C0.cutList(M).phu_kien || []).find(x => re.test(x.ten));
  const CU = ['TAP2-450', 'TAP2-500', 'TAP2-500-C', 'TAP1H-500', 'TAP3-600'];
  ok(C0.MAU_TAP.length === 5 && C0.MAU_TAP.map(m => m.kieu).join('') === 'ABCDE', 'thư viện táp: 5 mục theo KIỂU A – E (không liệt kê cỡ)', C0.MAU_TAP.map(m => [m.ma, m.kieu]));
  ok(C0.MAU_TAP.every(m => CU.indexOf(m.ma) < 0 && /^TAP/.test(m.ma) && m.loai_sp === 'tap'), 'mẫu táp mới: mã mới (TAP…), không lẫn mã cũ');
  // (1.36.2 — anh Thanh: "chỉ làm 1 hạng mục là táp thôi, trong đó hiện nhiều mẫu có hình ảnh") ô Thư viện chỉ còn MỘT mục táp; 5 kiểu chọn bằng thẻ hình
  // trong khối Kiểu táp. MAU_TAP (mã TAP-GO1…) vẫn apMau được — file / phép thử cũ không gãy.
  { const ds = C0.THU_VIEN.find(x => x.loai === 'tap').ds;
    ok(ds.length === 1 && ds[0].ma === '@TAP' && ds[0].loai_sp === 'tap' && !/\d{3}/.test(ds[0].ten), 'Thư viện táp: một mục "@TAP" (chọn kiểu bằng thẻ hình)', ds.map(m => m.ma));
    eq(ap('@TAP'), C0.tapTheoKieu('A', null, D0), '@TAP: táp kiểu A cỡ mặc định (kiểu chọn sau bằng thẻ hình)'); }
  ok(Array.isArray(C0.MAU_TAP_CU) && CU.every(ma => C0.MAU_TAP_CU.some(m => m.ma === ma)), 'mã cũ còn trong MAU_TAP_CU');
  for (const ma of CU) { const s = ap(ma), M = C0.build(s); ok(s && s.loai_sp === 'tap' && !('tap' in s) && !M.errors.length && M.templates.some(t => t.kieu === 'nk_trum'), `${ma} (cũ): apMau vẫn dựng như 1.32 — ngăn kéo trùm, không khoá tap`, s && [s.tap, M.errors]); }
  for (const ma of CU) ok(!/gờ|nóc|chân gỗ|táp/i.test((C0.keHoachGoc(ap(ma)).loi || []).join(' ')), `${ma} (cũ): lệnh gốc như cũ`, C0.keHoachGoc(ap(ma)).loi);
  const ten = {}; for (const m of C0.MAU_TAP) ten[m.ma] = m.ten;
  // mỗi kiểu ảnh có ít nhất một mẫu, tên nói rõ kiểu
  const kieu = { A: s => s.tap.go > 0 && s.khoang[0].dot.length === 1 && s.khoang[0].o.some(o => o.kieu === 'nk_am' && o.so === 1),
    B: s => s.tap.go > 0 && s.khoang[0].o.some(o => o.kieu === 'nk_am' && o.so === 2), C: s => s.tap.noc === 'phu' && s.tap.dua > 0 && s.khoang[0].dot.length === 1,
    D: s => s.tap.noc === 'phu' && s.tap.tay_nam === 'khe' && s.khoang[0].o.some(o => o.kieu === 'nk_trum' && o.so === 2),      // (1.36.2) đáy lọt trên xà đế, không còn đáy phủ
    E: s => s.tap.noc === 'phu' && s.tap.chan_go > 0 && s.tap.tay_nam === 'khoet' };
  const theoKieu = {}; for (const m of C0.MAU_TAP) { const s = ap(m.ma); for (const k of Object.keys(kieu)) if (kieu[k](s)) (theoKieu[k] = theoKieu[k] || []).push(m.ma); }
  ok(Object.keys(kieu).every(k => (theoKieu[k] || []).length === 1 && C0.MAU_TAP.find(m => m.ma === theoKieu[k][0]).kieu === k), 'mỗi kiểu ảnh A – E đúng một mục, khớp m.kieu', theoKieu);
  ok(C0.MAU_TAP.every(m => /gờ|nóc|hộp|chân/i.test(m.ten) && /ngăn kéo|hộc/i.test(m.ten)), 'tên mẫu nói rõ kiểu (gờ / nóc / hộp / chân + ngăn kéo / hộc)', C0.MAU_TAP.map(m => m.ten));
  ok(C0.MAU_TAP.every(m => !/\d{3}/.test(m.ten) && !/\d{3}$/.test(m.ma)), 'tên / mã mẫu táp không mang cỡ', C0.MAU_TAP.map(m => [m.ma, m.ten]));
  for (const m of C0.MAU_TAP) eq(ap(m.ma), C0.tapTheoKieu(m.kieu, null, D0), `${m.ma}: apMau = tapTheoKieu(${m.kieu}, cỡ mặc định)`);
  for (const m of C0.MAU_TAP) {
    const s = ap(m.ma), M = C0.build(s);
    ok(s.loai_sp === 'tap' && s.tap && !M.errors.length && !M.warnings.length, `${m.ma}: dựng được, không lỗi / cảnh báo`, [M.errors, M.warnings]);
    eq(overlapAny(M), [], `${m.ma}: không tấm nào đè nhau`);
    eq(C0.kiemLienKet(M.parts), [], `${m.ma}: tấm nào cũng có chỗ tì`);
    ok(C0.phieu(M).xong && C0.phieu(M).dat, `${m.ma}: phiếu kiểm đạt`, C0.phieu(M).muc.filter(x => x.ket !== 'dat' && x.ket !== 'khong').map(x => x.ma));
    const b = C0.bbox(M.parts); ok(near(b.x0, 0) && near(b.x1, s.rong) && near(b.z0, s.tap.chan_go) && near(b.z1, s.cao), `${m.ma}: hộp bao = rộng × cao (chân gỗ: tấm thấp nhất ở cao chân)`, b);
    ok(M.mat_ngan_keo.length >= 1 && M.templates.filter(t => t.loai === 'NGAN_KEO').length === M.mat_ngan_keo.length, `${m.ma}: có ngăn kéo (mẫu Chenfeng)`);
    const h = C0.heSo(s); ok(['L', 'W', 'H'].every(k => h.bien[k] && h.bien[k].sai_so < 0.02), `${m.ma}: module co giãn L / W / H`, [h.ly_do, ['L', 'W', 'H'].map(k => h.bien[k] && h.bien[k].sai_so)]);
    for (const [k, d] of [['rong', 50], ['rong', -50], ['sau_thung', 50], ['sau_thung', -50], ['cao', 50], ['cao', -50]]) {
      const s2 = JSON.parse(JSON.stringify(s)); s2[k] += d; const M2 = C0.build(s2);
      ok(!M2.errors.length && M2.parts.length === M.parts.length && M2.templates.length === M.templates.length && !overlapAny(M2).length, `${m.ma}: ${k} ${d > 0 ? '+' : ''}${d} vẫn dựng được, cùng số tấm`, [M2.errors, M2.parts.length, M.parts.length]);
    }
    ok(/táp/i.test((C0.keHoachGoc(s).loi || []).join(' ')), `${m.ma}: kết cấu táp mới chưa có lệnh gốc → nhập tấm + gom module (báo lý do)`, C0.keHoachGoc(s).loi);
    eq(C0.toChenfeng(M).so_tam, M.parts.length, `${m.ma}: nhập đủ tấm`);
    ok(M.parts.every(p => { const c = C0.cutSize(p); return c.dai <= s.van.kho_dai + 0.01 && c.rong <= s.van.kho_rong + 0.01; }), `${m.ma}: mọi tấm vừa khổ ván`);
  }
  // A — gờ chắn: hồi + gờ sau nhô trên nóc thụt, bo góc trên trước hồi (ghi gia công), ngăn kéo lọt lòng phẳng mặt hồi, núm tròn, xà đế lùi giữa 2 hồi
  { const ma = theoKieu.A[0], s = ap(ma), M = C0.build(s), q = s.tap, t = s.van.t, H = s.cao, hoi = P(M, 'HOI'), noc = P(M, 'NOC')[0], go = P(M, 'GO');
    ok(hoi.length === 2 && hoi.every(p => near(p.z1, H)) && near(noc.z1, H - q.go) && noc.x0 >= hoi[0].x1 - 0.01, `${ma}: hồi cao suốt, nóc thụt ${q.go} giữa 2 hồi`, [hoi.map(box), box(noc)]);
    ok(go.length === 1 && near(go[0].z0, noc.z1) && near(go[0].z1, H) && near(go[0].x0, hoi[0].x1) && near(go[0].x1, hoi[1].x0) && go[0].y0 > noc.y0 + 100, `${ma}: gờ sau ván thùng đứng trên nóc, giữa 2 hồi, sát lưng`, go.map(box));
    // (1.36.2 — anh Thanh: "tấm hậu này lòi lên hơi xấu") trước: hậu phủ lên tới đỉnh gờ; nay hậu soi rãnh lọt lòng, dừng ở rãnh nóc — gờ sau che phần trên nóc
    ok(P(M, 'HAU').every(p => p.mong && p.z1 < noc.z1 && p.z1 > noc.z0), `${ma}: hậu soi rãnh dừng trong rãnh nóc (không lên tới gờ)`, P(M, 'HAU').map(box));
    ok(q.bo > 0 && hoi.every(p => /bo tròn/.test(p.gia_cong || '')) && C0.cutList(M).rows.filter(r => /Hồi/.test(r.ten)).every(r => /bo tròn/.test(r.ghi_chu)), `${ma}: bo góc trên trước hồi — ghi gia công ở bảng kê`, hoi.map(p => p.gia_cong));
    const mt = M.mat_ngan_keo[0], k0 = M.info.x_khoang[0], w0 = M.info.khoang[0];
    ok(M.mat_ngan_keo.length === 1 && !mt.trum && near(mt.y, 0) && near(mt.x, k0 + s.ngan_keo.khe_ben) && near(mt.w, w0 - 2 * s.ngan_keo.khe_ben), `${ma}: 1 ngăn kéo LỌT LÒNG giữa 2 hồi, mặt phẳng mặt hồi`, mt);
    ok(!P(M, 'XA').length && !P(M, 'NEP').length && !P(M, 'DEM').length, `${ma}: không xà ẩn / nẹp / vách đệm`);
    const ch = P(M, 'CHAN'); ok(ch.length === 1 && near(ch[0].x0, hoi[0].x1) && near(ch[0].x1, hoi[1].x0) && ch[0].y0 >= 0 && near(ch[0].z1, s.chan.cao) && /Xà đế/.test(ch[0].ten), `${ma}: xà đế lùi giữa 2 hồi`, ch.map(box));
    ok(PK(M, /Núm tròn/) && PK(M, /Núm tròn/).sl === 1 && !PK(M, /Chân gỗ/), `${ma}: 1 núm tròn, không chân gỗ`);
    ok(C0.summary(M).some(l => /gờ chắn/i.test(l)), `${ma}: tóm tắt nói gờ chắn`, C0.summary(M)); }
  // B — 2 ngăn kéo lọt lòng, thanh ngang giữa (ván thùng nằm, phẳng mặt), đáy sát sàn
  { const ma = theoKieu.B[0], s = ap(ma), M = C0.build(s), t = s.van.t, mt = M.mat_ngan_keo.slice().sort((a, b) => a.z - b.z), th = M.parts.filter(p => p.thanh_nk);
    ok(mt.length === 2 && th.length === 1 && near(th[0].y0, 0) && th[0].type === 0 && near(th[0].z1 - th[0].z0, t) && th[0].z0 >= mt[0].z + mt[0].h - 0.01 && th[0].z1 <= mt[1].z + 0.01, `${ma}: thanh ngang giữa 2 mặt ngăn kéo`, [th.map(box), mt]);
    // (1.36.2 — anh Thanh: "tủ nào cũng phải có cái xà như này") B trước đáy sát sàn, không xà; nay xà đế như A
    ok(near(P(M, 'DAY')[0].z0, s.chan.cao) && s.chan.cao === C0.KIEU_TAP.A.chan && P(M, 'CHAN').length === 1, `${ma}: đáy trên xà đế (như A)`, P(M, 'CHAN').map(box));
    ok(PK(M, /Núm tròn/).sl === 2, `${ma}: 2 núm tròn`); }
  // C — nóc chồm: phủ hồi, đua 2 bên + trước; hồi đứng dưới nóc
  { const ma = theoKieu.C[0], s = ap(ma), M = C0.build(s), q = s.tap, noc = P(M, 'NOC'), hoi = P(M, 'HOI');
    ok(noc.length === 1 && near(noc[0].x0, 0) && near(noc[0].x1, s.rong) && near(noc[0].y0, -q.dua_truoc) && near(noc[0].z1, s.cao), `${ma}: nóc chồm phủ hồi, đua ${q.dua} hai bên + ${q.dua_truoc} trước`, noc.map(box));
    ok(hoi.every(p => near(p.z1, noc[0].z0)) && near(hoi[0].x0, q.dua) && near(hoi[1].x1, s.rong - q.dua), `${ma}: hồi đứng dưới nóc, lùi vào ${q.dua}`, hoi.map(box)); }
  // D — hộp: nóc + đáy phủ, 2 mặt trùm, khe tay nắm giữa 2 mặt, không núm
  { const ma = theoKieu.D[0], s = ap(ma), M = C0.build(s), q = s.tap, mt = M.mat_ngan_keo.slice().sort((a, b) => a.z - b.z), hoi = P(M, 'HOI'), noc = P(M, 'NOC')[0], day = P(M, 'DAY')[0];
    ok(mt.length === 2 && mt.every(x => x.trum) && near(mt[1].z - mt[0].z - mt[0].h, q.khe_tn), `${ma}: 2 mặt trùm, khe tay nắm ${q.khe_tn}`, mt);
    // (1.36.2) D có xà đế như A: đáy LỌT giữa hai hồi xuống sàn (trước: nóc + đáy phủ, đáy sát sàn — đáy phủ không có hồi kẹp xà đế)
    ok(near(noc.x0, 0) && near(noc.x1, s.rong) && hoi.every(p => near(p.z0, 0) && near(p.z1, noc.z0)) && near(day.x0, hoi[0].x1) && near(day.x1, hoi[1].x0) && near(day.z0, s.chan.cao), `${ma}: nóc phủ hồi, đáy lọt trên xà đế, hồi xuống sàn`, [box(noc), box(day), hoi.map(box)]);
    ok(mt[1].z + mt[1].h <= noc.z0 + 0.01 && near(noc.y0, -s.van.t_canh), `${ma}: mặt trên cùng nằm dưới nóc, nóc phẳng mặt ngăn kéo`, [mt[1], box(noc)]);
    ok(!PK(M, /Núm|Tay nắm/i), `${ma}: khe tay nắm — không kê tay nắm`); }
  // E — nóc phủ, chân gỗ rời 4 cái (phụ kiện), đáy nâng đúng cao chân, tay nắm khoét (gia công), không núm
  { const ma = theoKieu.E[0], s = ap(ma), M = C0.build(s), q = s.tap;
    ok(near(Math.min(...M.parts.map(p => p.z0)), q.chan_go) && !P(M, 'CHAN').length && near(P(M, 'DAY')[0].z0, q.chan_go), `${ma}: đáy nâng ${q.chan_go} (chân gỗ), không xà đế`, P(M, 'DAY').map(box));
    ok(PK(M, /Chân gỗ/) && PK(M, /Chân gỗ/).sl === 4, `${ma}: 4 chân gỗ rời (phụ kiện)`);
    ok(PK(M, /khoét/i) && PK(M, /khoét/i).sl === M.mat_ngan_keo.length && !PK(M, /Núm/), `${ma}: tay nắm khoét — gia công từng mặt, không núm`);
    ok((M.khoi_phu || []).filter(k => k.ten === 'Chân gỗ').length === 4 && M.khoi_phu.every(k => near(k.b[5], q.chan_go)), `${ma}: hình 3D có 4 chân gỗ (khối phụ, không phải tấm)`, M.khoi_phu); }
  // khoá táp: chỉ táp mang s.tap; tủ áo / giường không nhận
  ok(!('tap' in C0.normalize(Object.assign({}, D0, { tap: { go: 80 } }))), 'tủ áo mang khoá tap → bỏ');
  ok(!('tap' in C0.apMau(ap(C0.MAU_TAP[0].ma), 'TA2-1000')) && !('tap' in C0.apMau(ap(C0.MAU_TAP[0].ma), 'G16-T')), 'táp mới → tủ áo / giường: bỏ khoá tap');
  { const s = C0.normalize(Object.assign({}, ap(theoKieu.A[0]), {})); s.tap.noc = 'phu'; const n = C0.normalize(s); ok(n.tap.go === 0, 'nóc phủ thì không gờ (gờ cần nóc thụt)', n.tap); }
  { const s = ap(theoKieu.E[0]); ok(s.chan.cao === 0, 'chân gỗ: không xà đế'); }
  { const s = ap(theoKieu.D[0]); s.tap.day = 'phu'; ok(C0.normalize(s).chan.cao === 0, 'đáy phủ (người dùng đặt): không xà đế (không có hồi kẹp xà)'); }
  // (soát hình theo ảnh mẫu) D: khe tay nắm thấy THANH NGANG (ván thùng) lùi sau khe, không thấy xuyên vào lòng tủ; E: 2 mặt sát nhau (khe nhỏ, không thanh lộ — ảnh 10)
  { const ma = theoKieu.D[0], s = ap(ma), M = C0.build(s), t = s.van.t, mt = M.mat_ngan_keo.slice().sort((a, b) => a.z - b.z), th = M.parts.filter(p => p.xa_tap);
    // (1.36.2) lùi lui_thanh sau lưng mặt (trước: y 0 — cạnh thanh lòi ra ngay sau khe). (1.36.3 — anh Thanh 16/10/2026: "ke này hở xấu quá phải có xà 5cm bên trong
    // chứ ai làm xà nằm ngang phải làm xà dọc") thanh NẰM thay bằng XÀ ĐỨNG cao TAP_XA, mặt ván quay ra khe, che kín cả khe (nhìn qua khe chỉ thấy mặt xà)
    ok(!M.parts.some(p => p.thanh_nk) && th.length === 1 && th[0].type === 2 && th[0].loai === 'XA' && near(th[0].y0, s.tap.lui_thanh) && near(th[0].y1 - th[0].y0, t) && near(th[0].z1 - th[0].z0, C0.TAP_XA) && th[0].z0 <= mt[0].z + mt[0].h + 0.01 && th[0].z1 >= mt[1].z - 0.01 && near((th[0].z0 + th[0].z1) / 2, (mt[0].z + mt[0].h + mt[1].z) / 2, 0.6), `${ma}: xà đứng giữa khe tay nắm, lùi ${s.tap.lui_thanh} sau lưng mặt, che kín khe`, [th.map(box), mt]);
    // (1.36.2) đáy lọt trên xà đế: mặt dưới cùng (trùm) phủ cạnh đáy như cánh, mép dưới cách xà đế một khe
    { const day = M.parts.find(p => p.loai === 'DAY'); ok(mt[0].z < day.z1 - 0.01 && mt[0].z >= s.chan.cao && near(day.y0, 0), `${ma}: mặt dưới cùng phủ cạnh đáy, trên xà đế`, [mt[0], box(day)]); }
    ok(!M.errors.length, `${ma}: không lỗi`, M.errors); }
  { const ma = theoKieu.E[0], s = ap(ma), M = C0.build(s), mt = M.mat_ngan_keo.slice().sort((a, b) => a.z - b.z);
    ok(!M.parts.some(p => p.thanh_nk) && mt.length === 2 && mt[1].z - mt[0].z - mt[0].h <= 6, `${ma}: 2 mặt sát nhau, không thanh ngang lộ`, mt); }
  // mặt ngăn kéo táp mang kiểu tay nắm — hình đứng + 3D vẽ được núm / chỗ khoét
  for (const m of C0.MAU_TAP) { const s = ap(m.ma), M = C0.build(s); ok(M.mat_ngan_keo.every(q => q.tay_nam === s.tap.tay_nam), `${m.ma}: mặt ngăn kéo mang tay_nam`, M.mat_ngan_keo); }
  { const M = C0.build(ap(theoKieu.A[0])), sv = C0.elevationSVG(M, {}), d = C0.hinh3D(M, { du_lieu: true });
    ok((sv.match(/data-num=/g) || []).length === M.mat_ngan_keo.length, 'A: hình đứng vẽ núm tròn trên mỗi mặt', sv.length);
    ok(d.hop.filter(h => h.ten === 'Núm').length === M.mat_ngan_keo.length, 'A: 3D có núm trên mỗi mặt', d.hop.map(h => h.ten).filter(Boolean));
    const hoiBo = d.hop.filter(h => h.ten === 'Hồi bo');
    ok(hoiBo.length === 2 && hoiBo.every(h => h.mat && h.mat.length > 6), 'A: 3D hồi bo góc trên phía trước (khối nhiều mặt)', hoiBo.map(h => h.mat && h.mat.length));
    ok(/<polygon[^>]*points="([^"]*\s){8,}/.test(C0.hinh3D(M, {})), 'A: 3D vẽ được mặt cong (đa giác nhiều đỉnh)'); }
  { const M = C0.build(ap(theoKieu.E[0])), sv = C0.elevationSVG(M, {}), d = C0.hinh3D(M, { du_lieu: true });
    ok((sv.match(/data-khoet=/g) || []).length === M.mat_ngan_keo.length && !/data-num=/.test(sv), 'E: hình đứng vẽ chỗ khoét chữ U trên mỗi mặt, không núm', sv.length);
    ok(d.hop.filter(h => h.ten === 'Mặt khoét').length === M.mat_ngan_keo.length, 'E: 3D mặt ngăn kéo có chỗ khoét', d.hop.map(h => h.ten).filter(Boolean));
    const ch = d.hop.filter(h => h.ten === 'Chân gỗ');
    ok(ch.length === 4 && ch.every(h => h.mat && h.mat.length === 6), 'E: chân gỗ vát (khối thon, 6 mặt)', ch.length); }
  { const M = C0.build(ap(theoKieu.D[0])), sv = C0.elevationSVG(M, {});
    ok(!/data-num=|data-khoet=/.test(sv), 'D: khe tay nắm — hình đứng không vẽ tay nắm'); }
  // (soát 1.34.1) Chuẩn xưởng "nóc, đáy phủ hồi": táp kiểu mới giữ nóc / đáy của MẪU (gờ chắn cần nóc lọt; xà đế riêng không kèm khung đế) — dựng y như Chuẩn xưởng 'lot'
  for (const m of C0.MAU_TAP) {
    const keep = JSON.parse(JSON.stringify(D0)); keep.thung.noc_day = 'phu_hoi';
    const s = C0.apMau(keep, m.ma), M = C0.build(s), M0 = C0.build(ap(m.ma));
    ok(!M.errors.length && !overlapAny(M).length && !C0.kiemLienKet(M.parts).length, `${m.ma} + Chuẩn xưởng phủ hồi: không lỗi, không đè, đủ chỗ tì`, [M.errors, overlapAny(M)]);
    eq(M.parts.map(p => p.loai + ':' + box(p).join(',')), M0.parts.map(p => p.loai + ':' + box(p).join(',')), `${m.ma} + Chuẩn xưởng phủ hồi: tấm như với Chuẩn xưởng 'lot' (nóc / đáy theo mẫu táp)`);
  }
  // (soát 1.34.1) khoang táp có CÁNH: ngăn kéo lọt lòng nằm sau cánh như tủ áo (lùi nk.lui, vách đệm / nẹp), không núm (núm đâm vào lưng cánh), không thanh ngang của táp
  for (const ma of ['TAP-GO1', 'TAP-CHOM', 'TAP-GO2']) {
    const s = ap(ma); s.khoang[0].canh = 1; const n = C0.normalize(s), M = C0.build(n), d3 = C0.hinh3D(M, { du_lieu: true });
    ok(!M.errors.length && !overlapAny(M).length, `${ma} + 1 cánh: không lỗi, không tấm đè (thanh ngang × vách đệm / nẹp)`, [M.errors, overlapAny(M)]);
    ok(M.mat_ngan_keo.every(q => q.y >= n.ngan_keo.lui - n.van.t - 0.01 && q.y > 0.5 && !q.tay_nam), `${ma} + 1 cánh: mặt ngăn kéo lùi sau cánh (y ≥ lùi − dày), không tay nắm`, M.mat_ngan_keo.map(q => [q.y, q.tay_nam]));
    ok(!PK(M, /Núm/) && !d3.hop.some(h => h.ten === 'Núm'), `${ma} + 1 cánh: không kê / vẽ núm sau cánh`);
    ok(!M.parts.some(p => p.thanh_nk), `${ma} + 1 cánh: không thanh ngang táp`);
  }
  // (soát 1.34.1) táp "khe tay nắm" mà ô đổi sang ngăn kéo lọt lòng: khe J chỉ có ở mặt trùm → mặt lọt lòng dùng núm (kê phụ kiện), ghi chú không nói khe 25
  { const s = ap('TAP-HOP2'); s.khoang[0].o[0].kieu = 'nk_am'; const M = C0.build(C0.normalize(s));
    ok(!M.errors.length && M.mat_ngan_keo.length === 2 && M.mat_ngan_keo.every(q => !q.trum && q.tay_nam === 'num'), 'HOP2 đổi sang lọt lòng: mặt lọt lòng mang núm', M.mat_ngan_keo.map(q => [q.trum, q.tay_nam]));
    ok(PK(M, /Núm/) && PK(M, /Núm/).sl === 2, 'HOP2 đổi sang lọt lòng: kê 2 núm', C0.cutList(M).phu_kien);
    ok(!M.notes.some(x => /khe tay nắm 25/.test(x)) && M.notes.some(x => /núm/i.test(x)), 'HOP2 đổi sang lọt lòng: ghi chú không nói khe tay nắm, nói dùng núm', M.notes); }
  // (soát 1.34.1) táp nóc chồm + phào hai bên: phào thay phần đua bên đó — hồi áp phụ trợ phào, nóc chạy tới phào
  { const s = ap('TAP-CHOM'); s.phao.trai = s.phao.phai = 20; const n = C0.normalize(s), M = C0.build(n), hoi = P(M, 'HOI').sort((a, b) => a.x0 - b.x0), phu = P(M, 'PHU').sort((a, b) => a.x0 - b.x0), noc = P(M, 'NOC')[0];
    ok(!M.errors.length && hoi.length === 2 && phu.length === 2 && near(phu[0].x1, hoi[0].x0) && near(phu[1].x0, hoi[1].x1), 'nóc chồm + phào: phụ trợ phào áp vào hồi (không hở)', [phu.map(box), hoi.map(box)]);
    ok(near(noc.x0, 20) && near(noc.x1, n.rong - 20) && !overlapAny(M).length, 'nóc chồm + phào: nóc chạy giữa hai phào', box(noc)); }
  // tủ áo: hình 3D không đổi (không có khối nhiều mặt)
  { const d = C0.hinh3D(C0.build(D0), { du_lieu: true }); ok(d.hop.every(h => !h.mat), 'tủ áo: 3D toàn khối hộp như cũ'); }
});

T('Táp theo kiểu: gõ cỡ, ruột tự chia (bản 1.34.1)', () => {
  const D0 = C0.DEFAULT_SPEC, K = C0.KIEU_TAP, KS = Object.keys(K);
  eq(KS, ['A', 'B', 'C', 'D', 'E'], 'KIEU_TAP: A … E');
  ok(KS.every(k => K[k].nut && K[k].nut.length <= 10 && K[k].co.length === 3), 'mỗi kiểu có nhãn nút ngắn + cỡ mặc định', KS.map(k => K[k].nut));
  const long = M => { const d = M.parts.filter(p => p.loai === 'DAY'), n = M.parts.filter(p => p.loai === 'NOC'); return [Math.max(...d.map(p => p.z1)), Math.min(...n.map(p => p.z0))]; };
  // quét cỡ táp VN (rộng 400 – 550, sâu 350 – 420, cao 450 – 700): dựng được, đúng cỡ gõ, không đè, đủ chỗ tì, ruột theo luật
  for (const k of KS) {
    let truoc = null;
    for (const cao of [450, 500, 550, 600, 650, 700]) for (const [rong, sau] of [[400, 350], [450, 400], [550, 420]]) {
      const s = C0.tapTheoKieu(k, { rong, sau, cao }, D0), M = C0.build(s), b = C0.bbox(M.parts), ten = `${k} ${rong} × ${sau} × ${cao}`;
      ok(s.loai_sp === 'tap' && s.tap.kieu === k && s.rong === rong && s.sau_thung === sau && s.cao === cao && typeof s.tap.tu_dong === 'string', `${ten}: táp kiểu ${k} đúng cỡ gõ, có dấu tự chia`, [s.tap.kieu, s.rong, s.sau_thung, s.cao]);
      ok(!M.errors.length && !M.warnings.length && !overlapAny(M).length && !C0.kiemLienKet(M.parts).length, `${ten}: không lỗi / cảnh báo / đè / thiếu chỗ tì`, [M.errors, M.warnings, overlapAny(M)]);
      ok(near(b.x1 - b.x0, rong) && near(b.z1, cao), `${ten}: hộp bao rộng × cao`, b);
      const [z0, z1] = long(M), L = z1 - z0, mt = M.mat_ngan_keo, k0 = s.khoang[0];
      if (K[k].hoc) {
        ok(k0.dot.length <= 1 && mt.length === 1, `${ten}: hộc mở + 1 ngăn kéo`, [k0.dot, mt.length]);
        if (k0.dot.length) { const zone = k0.dot[0] - z0, hoc = z1 - k0.dot[0] - s.van.t;
          ok(zone >= C0.TAP_RUOT.nk_min - 5 && zone <= C0.TAP_RUOT.nk_max + 5 && hoc >= C0.TAP_RUOT.hoc_min, `${ten}: vùng ngăn kéo ${zone} trong ${C0.TAP_RUOT.nk_min} … ${C0.TAP_RUOT.nk_max}, hộc ${hoc} ≥ ${C0.TAP_RUOT.hoc_min}`);
          if (truoc && truoc.rong === rong) ok(k0.dot[0] >= truoc.dot - 0.01, `${ten}: cao hơn → đợt không hạ (ngăn kéo / hộc lớn theo)`, [truoc.dot, k0.dot[0]]);
          truoc = { rong, dot: k0.dot[0] }; }
      } else {
        const so = k0.o[0].so;
        ok(k0.dot.length === 0 && mt.length === so && so >= 1 && so <= 3, `${ten}: ${so} ngăn kéo`, [k0.dot, mt.length]);
        ok(so === 1 || L / so >= C0.TAP_RUOT.ngan_min, `${ten}: lòng mỗi ngăn ≥ ${C0.TAP_RUOT.ngan_min}`, L / so);
        ok(so === 3 || L / so <= C0.TAP_RUOT.ngan_max, `${ten}: lòng mỗi ngăn ≤ ${C0.TAP_RUOT.ngan_max} (cao quá thì thêm ngăn)`, L / so);
      }
    }
  }
  // (1.36.2) hồi táp gờ chắn bo góc trên–trước: tấm xuất sang Chenfeng mang đường bao cong thật (anh Thanh: "vẽ ra lại là vuông góc"), không chỉ ghi gia công
  { const s = C0.tapTheoKieu('A', null, D0), M = C0.build(s), ms = C0.toChenfeng(M).json.ModelSpace;
    const hoi = M.parts.filter(p => p.loai === 'HOI'), R = s.tap.bo;
    ok(R > 0 && hoi.length === 2 && hoi.every(p => p.bo_r === R && /bo tròn góc trên phía trước R/.test(p.gia_cong)), 'A: hai hồi mang bo_r + ghi gia công', hoi.map(p => [p.bo_r, p.gia_cong]));
    const bds = ms.filter(o => o.Type === 'Board' && o.BrType === 1 && hoi.some(p => p.ten === o.Name && p.x0 === o.Pos[0]));
    ok(bds.length === 2, 'A: tìm thấy 2 hồi trong lệnh nhập', bds.length);
    for (const o of bds) {
      const p = hoi.find(q => q.x0 === o.Pos[0]), w = p.y1 - p.y0, h = p.z1 - p.z0, cc = o.ContourCurve;
      eq(cc.map(c => c.pt), [[0, 0], [w, 0], [w, h], [R, h], [0, h - R]], `hồi x=${p.x0}: 5 đỉnh, cung ở góc trên–trước (u = sâu từ mép trước, v = cao từ mép dưới)`);
      ok(Math.abs(cc[3].bul - Math.tan(Math.PI / 8)) < 1e-6 && cc.filter(c => c.bul).length === 1, 'cung 90° ngược chiều kim đồng hồ (bul = tan 22,5°) ở đỉnh đầu cung', cc.map(c => c.bul));
    }
    // vách giữa / tủ áo / táp không gờ: vẫn chữ nhật
    const ve = ms.filter(o => o.Type === 'Board' && o.BrType === 1 && !bds.includes(o));
    ok(ve.every(o => o.ContourCurve.length === 4), 'tấm đứng khác vẫn chữ nhật');
    const tu = C0.toChenfeng(C0.build(D0)).json.ModelSpace.filter(o => o.Type === 'Board');
    ok(tu.every(o => o.ContourCurve.every(c => !c.bul)), 'tủ áo mặc định: không tấm nào có cung'); }
  // cỡ mặc định của kiểu = số chọn hiện tại của thư viện; mã / tên không mang cỡ
  for (const k of KS) { const s = C0.tapTheoKieu(k, null, D0); eq([s.rong, s.sau_thung, s.cao], K[k].co, `${k}: không gõ cỡ → cỡ mặc định`); }
  // A cao 700: hộc + ngăn kéo cùng lớn; B cao 700: 3 ngăn; E thấp 450: vẫn 2 ngăn ≥ 130
  ok(C0.tapTheoKieu('A', { cao: 700 }).khoang[0].dot[0] > C0.tapTheoKieu('A', { cao: 600 }).khoang[0].dot[0], 'A cao 700: đợt cao hơn A 600 (ngăn kéo lớn theo)');
  ok(C0.tapTheoKieu('B', { cao: 700 }).khoang[0].o[0].so === 3, 'B cao 700: 3 ngăn kéo');
  // đổi kiểu GIỮ cỡ đang gõ; Chuẩn xưởng giữ nguyên
  { const keep = JSON.parse(JSON.stringify(D0)); keep.van.t = 17; const a = C0.tapTheoKieu('A', { rong: 520, sau: 410, cao: 640 }, keep), d = C0.doiKieuTap(a, 'D');
    ok(d.tap.kieu === 'D' && d.rong === 520 && d.sau_thung === 410 && d.cao === 640 && d.van.t === 17 && d.tap.noc === 'phu' && d.tap.day === 'lot' && d.chan.cao === C0.KIEU_TAP.A.chan && !d.tap.go, 'đổi A → D: giữ 520 × 410 × 640 + Chuẩn xưởng, kết cấu theo D (1.36.2: đáy lọt trên xà đế như A)', [d.rong, d.sau_thung, d.cao, d.tap]);
    eq(C0.doiKieuTap(d, 'A'), a, 'đổi lại D → A: y như táp A cỡ đó'); }
  // gõ cỡ: ruột chia lại khi người dùng chưa sửa ruột; sửa ruột rồi thì giữ
  { const s = C0.tapTheoKieu('A', null, D0); eq(C0.tapTuDong(s).doi, false, 'cỡ không đổi: không chia lại');
    const s2 = JSON.parse(JSON.stringify(s)); s2.cao = 700; const r = C0.tapTuDong(C0.normalize(s2));
    ok(r.doi && JSON.stringify(r.spec.khoang) === JSON.stringify(C0.tapTheoKieu('A', { rong: s.rong, sau: s.sau_thung, cao: 700 }, D0).khoang), 'gõ cao 700: ruột = tapTheoKieu cỡ mới', [r.spec.khoang, s.khoang]);
    ok(C0.tapTuDong(r.spec).doi === false, 'chia lại rồi: lần sau không đổi nữa (dấu mới)');
    { const sn = JSON.parse(JSON.stringify(s)); sn.khoang[0].o[0].tu = 50; sn.cao = 700; ok(C0.tapTuDong(C0.normalize(sn)).doi, 'ô sát đáy bị bảng dời mốc về mặt dưới đáy (50): vẫn coi là ruột tự chia'); }
    const s3 = JSON.parse(JSON.stringify(r.spec)); s3.khoang[0].dot = [200]; s3.cao = 560; const r3 = C0.tapTuDong(C0.normalize(s3));
    ok(!r3.doi && r3.spec.khoang[0].dot[0] === 200, 'người dùng kéo đợt: thôi tự chia, giữ ruột của người dùng', r3.spec.khoang);
    const s4 = JSON.parse(JSON.stringify(r.spec)); s4.khoang[0].canh = 1; s4.cao = 600; const r4 = C0.tapTuDong(C0.normalize(s4));
    ok(r4.doi && r4.spec.khoang[0].canh === 1, 'thêm cánh: vẫn tự chia, giữ cánh', r4.spec.khoang);
    const B = JSON.parse(JSON.stringify(C0.tapTheoKieu('B', null, D0))); B.cao = 720; const rb = C0.tapTuDong(C0.normalize(B));
    ok(rb.doi && rb.spec.khoang[0].o[0].so === 3 && !C0.build(rb.spec).errors.length, 'B gõ cao 720: thành 3 ngăn kéo', rb.spec.khoang); }
  // không kiểu (táp cũ, tủ) → không đụng
  { const cu = C0.apMau(D0, 'TAP2-500'); ok(!C0.tapTuDong(Object.assign({}, cu, { cao: 700 })).doi, 'táp cũ (không khoá tap): không tự chia');
    ok(!C0.tapTuDong(D0).doi, 'tủ áo: không tự chia');
    const x = C0.normalize(Object.assign(JSON.parse(JSON.stringify(C0.tapTheoKieu('A', null, D0))), {})); x.tap.kieu = 'Z'; ok(!('kieu' in C0.normalize(x).tap) && !('tu_dong' in C0.normalize(x).tap), 'kiểu lạ: bỏ kiểu + dấu'); }
  // module co giãn (heSo) với cỡ đã gõ
  for (const k of KS) { const h = C0.heSo(C0.tapTheoKieu(k, { rong: 520, sau: 390, cao: 640 }, D0)); ok(['L', 'W', 'H'].every(x => h.bien[x] && h.bien[x].sai_so < 0.02), `${k} 520 × 390 × 640: module co giãn L / W / H`, h.ly_do); }
});

// Bản 1.36.2 — anh Thanh 15/10/2026 (đã chốt bằng hộp tích):
//  (2) "tủ nào cũng phải có cái xà như này" (ảnh táp A): kiểu A … D cùng xà đế của A (cao + lùi), kẹp giữa hai hồi xuống sàn; E giữ chân gỗ rời.
//  (1) táp D khe tay nắm: "chỗ này phải có khe móc như trong tủ áo chứ ai để lòi ra vậy" → thanh ngang giữa hai mặt trùm LÙI `lui_thanh` (30) thành rãnh móc tay.
T('Táp: xà đế mọi kiểu, rãnh móc tay kiểu D (bản 1.36.2)', () => {
  const D0 = C0.DEFAULT_SPEC, K = C0.KIEU_TAP, P = (M, l) => M.parts.filter(p => p.loai === l), box = p => [p.x0, p.x1, p.y0, p.y1, p.z0, p.z1];
  ok(C0.DEFAULT_TAP.lui_thanh === 30, 'DEFAULT_TAP.lui_thanh = 30', C0.DEFAULT_TAP);
  for (const k of ['A', 'B', 'C', 'D']) {
    eq(K[k].chan, K.A.chan, `${k}: cao xà đế = của A`);
    for (const co of [null, { rong: 400, sau: 350, cao: 450 }, { rong: 550, sau: 420, cao: 700 }]) {
      const s = C0.tapTheoKieu(k, co, D0), M = C0.build(s), ch = P(M, 'CHAN'), hoi = P(M, 'HOI').sort((a, b) => a.x0 - b.x0), t = s.van.t, tc = s.van.t_canh, ten = `${k} ${co ? `${co.rong} × ${co.sau} × ${co.cao}` : 'mặc định'}`;
      ok(s.chan.cao === K.A.chan && s.tap.lui_chan === C0.DEFAULT_TAP.lui_chan && ch.length === 1 && /Xà đế/.test(ch[0].ten), `${ten}: có một xà đế, cao ${K.A.chan}`, [s.chan, ch.map(box)]);
      if (!ch.length) continue;
      ok(near(ch[0].x0, hoi[0].x1) && near(ch[0].x1, hoi[1].x0) && near(ch[0].z0, 0) && near(ch[0].z1, s.chan.cao) && near(ch[0].y1, Math.max(s.tap.lui_chan, tc)), `${ten}: xà đế kẹp giữa hai hồi, lùi ${s.tap.lui_chan}`, [box(ch[0]), hoi.map(box)]);
      ok(hoi.every(p => near(p.z0, 0)) && P(M, 'DAY').every(p => near(p.z0, s.chan.cao)), `${ten}: hồi xuống sàn, đáy đứng trên xà đế`, [hoi.map(box), P(M, 'DAY').map(box)]);
      ok(!M.errors.length && !M.warnings.length && !overlapAny(M).length && !C0.kiemLienKet(M.parts).length && C0.phieu(M).dat, `${ten}: không lỗi / cảnh báo / đè / thiếu chỗ tì, phiếu đạt`, [M.errors, M.warnings, overlapAny(M), C0.kiemLienKet(M.parts)]);
      ok(M.mat_ngan_keo.every(q => q.z >= s.chan.cao), `${ten}: mặt ngăn kéo nằm trên xà đế`, M.mat_ngan_keo.map(q => q.z));
    }
  }
  { const s = C0.tapTheoKieu('E', null, D0), M = C0.build(s); ok(s.chan.cao === 0 && !P(M, 'CHAN').length && s.tap.chan_go > 0, 'E: giữ chân gỗ rời, không xà đế'); }
  // ruột tự chia theo thân mới (lòng thân tính từ mặt trên đáy — nay đáy trên xà đế)
  for (const k of ['B', 'C', 'D']) { const s = C0.tapTheoKieu(k, null, D0); eq(C0.tapTuDong(s).doi, false, `${k}: ruột mẫu đã là ruột tự chia của thân có xà đế`); }
  // D — rãnh móc tay: thanh lùi sau lưng mặt, sâu đủ thanh_sau, nằm giữa HỘP THẬT của hai ngăn kéo (hộp thấp hơn mép trên mặt SLK, cao hơn mép dưới XLK)
  const hopThat = (M, s) => M.templates.filter(x => x.loai === 'NGAN_KEO').map(x => { const q = M.mat_ngan_keo[x.mat], lo = s.ngan_keo.loai.find(l => l.ma === x.ma_loai), chia = 'CMG' in lo.ts;
    return { z0: q.z + (chia ? 0 : lo.ts.XLK || 0), z1: q.z + q.h - (chia ? 0 : lo.ts.SLK || 0), y0: x.pos[1], y1: x.pos[1] + x.box[1] }; });
  for (const co of [null, { rong: 400, sau: 350, cao: 450 }, { cao: 700 }]) {
    // (1.36.3 — anh Thanh 16/10/2026, ảnh 3D: "ke này hở xấu quá phải có xà 5cm bên trong chứ ai làm xà nằm ngang phải làm xà dọc") thanh NẰM (thấy mặt trên
    // thanh + khe sáng ở đầu thanh qua khe) thay bằng XÀ ĐỨNG cao TAP_XA kẹp giữa hai tấm đứng, mặt ván quay ra khe: kín suốt bề ngang lòng, rãnh móc vẫn sâu 30
    const s = C0.tapTheoKieu('D', co, D0), M = C0.build(s), th = M.parts.filter(p => p.xa_tap), hop = hopThat(M, s), mt = M.mat_ngan_keo.slice().sort((a, b) => a.z - b.z), t = s.van.t;
    const dung = M.parts.filter(p => p.type === 1 && (p.loai === 'HOI' || p.loai === 'VACH'));
    ok(th.length === mt.length - 1 && th.length >= 1 && !M.parts.some(p => p.thanh_nk), `D ${JSON.stringify(co)}: một xà đứng giữa mỗi hai mặt, không còn thanh nằm`, [th.length, mt.length]);
    th.forEach((p, q) => {
      ok(p.loai === 'XA' && p.type === 2 && /Xà ngăn kéo/.test(p.ten) && near(p.y0, 30) && near(p.y1 - p.y0, t) && mt.every(m => m.y + m.t <= p.y0 - 29.99), 'xà đứng (ván type 2) lùi 30 sau lưng mặt ngăn kéo — rãnh móc tay 30', [box(p), mt.map(m => [m.y, m.t])]);
      ok(near(p.z1 - p.z0, C0.TAP_XA) && p.z0 <= mt[q].z + mt[q].h + 0.01 && p.z1 >= mt[q + 1].z - 0.01, `xà cao ${C0.TAP_XA}, che kín khe tay nắm (nhìn qua khe chỉ thấy mặt xà)`, [box(p), mt[q], mt[q + 1]]);
      ok(dung.some(d => near(d.x1, p.x0)) && dung.some(d => near(d.x0, p.x1)), 'xà kẹp giữa hai tấm đứng của khoang (kín suốt bề ngang lòng)', [box(p), dung.map(box)]);
      ok(hop.every(h => p.z1 <= h.z0 - 4.99 || p.z0 >= h.z1 + 4.99), 'xà cách hộp ngăn kéo thật ≥ 5 (như xà ẩn tủ áo)', [box(p), hop]);
      ok(/rãnh móc/.test(p.ghi_bep || '') && C0.cutList(M).rows.some(r => /Xà ngăn kéo/.test(r.ten) && /rãnh móc/.test(r.ghi_chu)), 'bảng kê ghi Xà ngăn kéo — rãnh móc tay');
    });
    ok(C0.summary(M).some(l => /xà/.test(l) && /rãnh móc/.test(l)) && !C0.summary(M).some(l => /Hộc ngăn kéo âm/.test(l)), 'tóm tắt: xà sau khe tay nắm của táp (không gọi là hộc kéo âm)', C0.summary(M));
    ok(!M.errors.length && !M.warnings.length && !overlapAny(M).length && !C0.kiemLienKet(M.parts).length && C0.phieu(M).dat, `D ${JSON.stringify(co)}: không lỗi / cảnh báo / đè, đủ chỗ tì, phiếu đạt`, [M.errors, M.warnings, C0.kiemLienKet(M.parts)]);
    const h = C0.heSo(s); ok(['L', 'W', 'H'].every(x => h.bien[x] && h.bien[x].sai_so < 0.02), `D ${JSON.stringify(co)}: module co giãn L / W / H`, h.ly_do);
  }
  // lui_thanh chuẩn hoá: âm → 0 (thanh phẳng như 1.34.1); quá sâu → thanh vẫn sâu đủ thanh_sau trong lòng thùng
  { const s = C0.tapTheoKieu('D', null, D0); s.tap.lui_thanh = -5; const n = C0.normalize(s), th = C0.build(n).parts.filter(p => p.xa_tap);
    ok(n.tap.lui_thanh === 0 && th.length && th.every(p => near(p.y0, 0)), 'lui_thanh âm → 0: xà sát lưng mặt', [n.tap.lui_thanh, th.map(box)]);
    // (1.36.2: thanh nằm vẫn sâu đủ thanh_sau; 1.36.3: xà đứng) lùi quá sâu bị kẹp LUI_THANH_MAX: xà vẫn nằm trong lòng thùng, không đè
    const s2 = C0.tapTheoKieu('D', null, D0); s2.tap.lui_thanh = 1000; const M2 = C0.build(C0.normalize(s2)), sd = Math.max(...M2.parts.filter(p => p.loai === 'DAY').map(p => p.y1));
    ok(M2.parts.filter(p => p.xa_tap).length && M2.parts.filter(p => p.xa_tap).every(p => p.y1 <= sd + 0.01) && !overlapAny(M2).length, 'lui_thanh quá sâu: xà vẫn trong lòng thùng', M2.parts.filter(p => p.xa_tap).map(box));
    // (soát 1.36.2) số lạ (file / thông số hỏng: 1e9) không được đẩy thanh ra sát hậu thành "rãnh móc" sâu 300 mà không ai báo → kẹp trần LUI_THANH_MAX
    for (const [vao, ra] of [[1e9, C0.LUI_THANH_MAX], [1000, C0.LUI_THANH_MAX], ['15', 15], [-10, 0], ['abc', 30], [null, 30]]) {
      const s3 = C0.tapTheoKieu('D', null, D0); s3.tap.lui_thanh = vao; const n3 = C0.normalize(s3), th3 = C0.build(n3).parts.filter(p => p.xa_tap);
      ok(n3.tap.lui_thanh === ra && th3.length && th3.every(p => near(p.y0, ra)), `lui_thanh ${JSON.stringify(vao)} → ${ra}`, [n3.tap.lui_thanh, th3.map(box)]);
    }
    ok(C0.LUI_THANH_MAX >= 30 && C0.LUI_THANH_MAX <= 80, 'trần lui_thanh hợp lý (rãnh móc tay, không phải hộc)', C0.LUI_THANH_MAX); }
  // (soát 1.36.2) táp D VẼ ở 1.34.1 … 1.36.1 (thông số chưa có lui_thanh — thanh phẳng y 0): dựng lại tủ đã vẽ phải ra ĐÚNG như lúc vẽ, không thì
  // bấm Sửa báo oan "thiếu 1 tấm" (chọn đúng thanh thì không dò lại được tủ) và Cập nhật dời thanh lặng lẽ. Mở file mẫu cũ (nangCap) = theo chuẩn mới, báo một dòng.
  { const cu = C0.tapTheoKieu('D', null, D0); delete cu.tap.lui_thanh; delete cu.tap.xa_dung;      // (1.36.3) lúc vẽ 1.36.1 cũng chưa có xa_dung
    const dv = C0.normalize(C0.specDaVe(cu, '1.36.1')), th = C0.build(dv).parts.filter(p => p.thanh_nk);
    ok(dv.tap.lui_thanh === 0 && th.length && th.every(p => near(p.y0, 0)), 'specDaVe < 1.36.2: táp D giữ thanh phẳng như lúc vẽ', [dv.tap.lui_thanh, th.map(box)]);
    ok(C0.normalize(C0.specDaVe(cu, C0.VERSION)).tap.lui_thanh === 30, 'specDaVe bản hiện hành: không đụng (mặc định 30)');
    const giu = C0.tapTheoKieu('D', null, D0); giu.tap.lui_thanh = 20; ok(C0.specDaVe(giu, '1.36.1').tap.lui_thanh === 20, 'specDaVe: số đã có thì giữ');
    const tuAo = JSON.parse(JSON.stringify(D0)); ok(!('tap' in C0.specDaVe(tuAo, '1.36.1')), 'specDaVe: tủ không phải táp không sinh khoá tap');
    const nc = C0.nangCap(cu, '1.36.1');
    ok(nc.doi.some(d => /rãnh móc/.test(d)) && C0.normalize(nc.spec).tap.lui_thanh === 30, 'nangCap < 1.36.2: theo chuẩn mới (lùi 30), báo một dòng', nc.doi);
    const kA = C0.tapTheoKieu('A', null, D0); delete kA.tap.lui_thanh; ok(!C0.nangCap(kA, '1.36.1').doi.some(d => /rãnh móc/.test(d)), 'nangCap: táp không khe tay nắm thì không báo'); }
  // loại ngăn kéo hộp gần bằng mặt (SLK / XLK âm — khai tay ở Chuẩn xưởng): giữa hai hộp không đủ chỗ cho xà ≥ 30 → không làm xà, cảnh báo (không im lặng)
  { const s = C0.tapTheoKieu('D', null, D0); s.ngan_keo.loai.forEach(l => { if (l.ma === s.ngan_keo.mac_dinh) { l.ts.SLK = -5; l.ts.XLK = -5; } }); const M = C0.build(C0.normalize(s));
    // (soát 1.36.3) xà không phủ được khe → rơi về thanh nằm như 1.36.2, mà thanh cũng chồng hộp → cảnh báo như 1.36.2 (không im lặng)
    ok(!M.parts.some(p => p.xa_tap) && M.warnings.some(w => /thanh ngang giữa khe tay nắm chồng lên hộp ngăn kéo/.test(w)), 'hộp ngăn kéo lấn vào khe: không xà, cảnh báo thanh chồng hộp', M.warnings);
    // chỗ trống vừa 30 … 50: xà rút cao cho vừa (như xà ẩn tủ áo)
    const s2 = C0.tapTheoKieu('D', null, D0); s2.ngan_keo.loai.forEach(l => { if (l.ma === s2.ngan_keo.mac_dinh) { l.ts.SLK = 15; l.ts.XLK = 15; } }); const M2 = C0.build(C0.normalize(s2)), x2 = M2.parts.filter(p => p.xa_tap);
    ok(x2.length === 1 && near(x2[0].z1 - x2[0].z0, 25 + 15 + 15 - 10) && !M2.warnings.length && !overlapAny(M2).length, 'chỗ trống giữa hai hộp 45: xà rút còn 45', [x2.map(box), M2.warnings]); }
  // (soát 1.36.3) mỗi khe tay nắm phải KÍN: hoặc xà đứng phủ trọn khe (mép dưới xà ≤ mép dưới khe, mép trên ≥ mép trên khe), hoặc (loại hộp sát mép mặt) rơi về
  // thanh nằm lọt trong khe như 1.36.2 — trước: loại không khai SLK (Blum, khay bàn phím) xà bị đẩy lên hở 5 ở mép dưới khe mà không báo; chia ô thì mất hẳn thanh.
  const kheKin = (M, s) => { const mt = M.mat_ngan_keo.slice().sort((a, b) => a.z - b.z), hop = hopThat(M, s), out = [];
    for (let q = 0; q + 1 < mt.length; q++) { const k0 = mt[q].z + mt[q].h, k1 = mt[q + 1].z;
      const xa = M.parts.find(p => p.xa_tap && p.z0 <= k0 + 0.01 && p.z1 >= k1 - 0.01), th = M.parts.find(p => p.thanh_nk && p.z0 >= k0 - 0.01 && p.z1 <= k1 + 0.01);
      const tam = xa || th; if (!tam) { out.push(`khe ${k0}…${k1} hở`); continue; }
      if (hop.some(h => tam.z0 < h.z1 - 0.01 && tam.z1 > h.z0 + 0.01)) out.push(`${tam.ten} ${tam.z0}…${tam.z1} chồng hộp`); }
    return out; };
  for (const ma of ['bi_mong', 'blum16', 'blum18', 'ban_phim', 'chia_o'])
    for (const co of [null, { rong: 350, sau: 300, cao: 400 }, { rong: 600, sau: 500, cao: 800 }])
      for (const khe of [25, 40, 55]) {
        const s = C0.tapTheoKieu('D', co, D0); s.ngan_keo.mac_dinh = ma; s.tap.khe_tn = khe; const n = C0.normalize(s), M = C0.build(n), ten = `D ${ma} ${JSON.stringify(co)} khe ${khe}`;
        eq(kheKin(M, n), [], `${ten}: mọi khe tay nắm kín (xà phủ trọn khe hoặc thanh nằm trong khe), không chồng hộp`);
        ok(!M.warnings.some(w => /khe tay nắm/.test(w)) && !overlapAny(M).length, `${ten}: không cảnh báo khe tay nắm, không đè`, [M.warnings, overlapAny(M)]);
        const lo = n.ngan_keo.loai.find(l => l.ma === ma), sat = 'CMG' in lo.ts || !(lo.ts.SLK >= 5) || !(lo.ts.XLK >= 5);
        if (sat) ok(M.parts.some(p => p.thanh_nk) && M.notes.some(x => /thanh nằm/.test(x) && /khe tay nắm/.test(x)), `${ten}: hộp sát mép mặt → thanh nằm trong khe, ghi chú một dòng`, M.notes);
        else ok(M.parts.some(p => p.xa_tap) && !M.parts.some(p => p.thanh_nk), `${ten}: xà đứng`);
        // khe rộng hơn TAP_XA (55): xà cao theo khe + phần chồng, không bao giờ "chỗ trống 105, cần ≥ 55"
        if (ma === 'bi_mong') ok(M.parts.filter(p => p.xa_tap).every(p => near(p.z1 - p.z0, Math.max(C0.TAP_XA, khe + 20))), `${ten}: xà cao max(TAP_XA, khe + 20)`, M.parts.filter(p => p.xa_tap).map(box));
      }
  // khe hẹp hơn dày ván mà hộp sát mép mặt (không xà, không thanh nằm được): cảnh báo nói đúng nguyên nhân
  { const s = C0.tapTheoKieu('D', null, D0); s.ngan_keo.mac_dinh = 'blum18'; s.tap.khe_tn = 12; const M = C0.build(C0.normalize(s));
    ok(!M.parts.some(p => p.xa_tap || p.thanh_nk) && M.warnings.some(w => /khe tay nắm/.test(w) && /hở/.test(w) && !/chỗ trống \d+(,\d+)?, cần/.test(w)), 'khe 12 + Blum: không xà / thanh, cảnh báo đúng nguyên nhân', M.warnings); }
  // xà táp là ván thùng, khoan liên kết như xà ẩn tủ áo / xà đế cùng tủ (anh Thanh: "xà là ván thùng") — trước: < 60 → không khoan, bắt vít
  { const M = C0.build(C0.tapTheoKieu('D', null, D0)), xa = M.parts.filter(p => p.xa_tap);
    ok(xa.length && xa.every(p => p.khoan !== C0.KHONG_KHOAN && !p.vit_ray) && !C0.cutList(M).rows.some(r => /Xà ngăn kéo/.test(r.ten) && /không khoan/.test(r.ghi_chu)), 'xà táp khoan liên kết như ván thùng', xa.map(p => [p.khoan, p.vit_ray])); }
  // táp D VẼ ở 1.36.2 (thanh nằm lùi 30, thông số chưa có xa_dung): specDaVe ghi xa_dung = 0 → dựng lại thanh nằm như lúc vẽ (Sửa không báo oan thiếu tấm)
  { const cu = C0.tapTheoKieu('D', null, D0); delete cu.tap.xa_dung;
    const dv = C0.normalize(C0.specDaVe(cu, '1.36.2')), M = C0.build(dv), th = M.parts.filter(p => p.thanh_nk);
    ok(dv.tap.xa_dung === 0 && th.length === 1 && th[0].type === 0 && near(th[0].y0, 30) && near(th[0].y1 - th[0].y0, dv.tap.thanh_sau) && !M.parts.some(p => p.xa_tap) && !M.warnings.length, 'specDaVe 1.36.2: táp D giữ thanh nằm lùi 30 như lúc vẽ', [dv.tap, th.map(box)]);
    ok(C0.normalize(C0.specDaVe(cu, C0.VERSION)).tap.xa_dung === 1, 'specDaVe bản hiện hành: xà đứng (mặc định)');
    eq(C0.tapKhoaCu(cu, '1.36.2'), ['xa_dung'], 'tapKhoaCu 1.36.2: chỉ xa_dung');
    // (soát 1.36.3) câu báo của Sửa / Thôi sửa chỉ nêu khoá ĐỔI HÌNH của chính táp đó: táp không khe tay nắm (A / B / C / E) vẽ ở 1.36.2 không có thanh nằm nào
    // → không báo "thanh nằm sau khe tay nắm" / "xà đứng"; khoá vẫn trả về chuẩn mới (bảng chỉ có MỘT thông số — số 0 không được dính sang táp D vẽ sau)
    eq(C0.tapKhoaAnh(cu, ['xa_dung']), ['xa_dung'], 'tapKhoaAnh: táp D — xa_dung đổi hình');
    for (const k of ['A', 'B', 'C', 'E']) { const x = C0.tapTheoKieu(k, null, D0); delete x.tap.xa_dung;
      eq(C0.tapKhoaCu(x, '1.36.2'), ['xa_dung'], `${k} 1.36.2: tapKhoaCu vẫn có xa_dung (để trả về chuẩn mới)`);
      eq(C0.tapKhoaAnh(x, C0.tapKhoaCu(x, '1.36.2')), [], `${k} 1.36.2: không khoá nào đổi hình → không báo`);
      const y = C0.tapTheoKieu(k, null, D0); delete y.tap.xa_dung; delete y.tap.lui_thanh; delete y.tap.hau_ranh;
      eq(C0.tapKhoaAnh(y, C0.tapKhoaCu(y, '1.36.1')), ['hau_ranh'], `${k} 1.36.1: chỉ báo hậu`); }
    { const y = C0.tapTheoKieu('D', null, D0); delete y.tap.xa_dung; delete y.tap.lui_thanh; delete y.tap.hau_ranh; eq(C0.tapKhoaAnh(y, C0.tapKhoaCu(y, '1.36.1')), ['hau_ranh', 'lui_thanh', 'xa_dung'], 'D 1.36.1: báo cả ba'); }
    const sc = C0.normalize(C0.specDaVe(cu, '1.36.2')); eq(C0.tapVeChuan(sc, ['xa_dung']), ['xa_dung'], 'tapVeChuan: về xà đứng'); ok(sc.tap.xa_dung === 1, 'tapVeChuan: xa_dung 1');
    const mo = C0.normalize(C0.nangCap(JSON.parse(JSON.stringify(cu)), '1.36.2').spec), luc = C0.build(dv).parts.map(p => [p.loai, p.y0, p.z0].join()).sort().join('|');
    ok(mo.tap.xa_dung === 1 && C0.tapBienTheCu(mo).some(b => b.khoa.join() === 'xa_dung' && C0.build(b.spec).parts.map(p => [p.loai, p.y0, p.z0].join()).sort().join('|') === luc), 'tapBienTheCu: có thông số thử thanh nằm như lúc vẽ', C0.tapBienTheCu(mo).map(b => b.khoa));
    const nc = C0.nangCap(JSON.parse(JSON.stringify(cu)), '1.36.2');
    ok(nc.doi.filter(d => /xà/.test(d) && /khe tay nắm/.test(d)).length === 1, 'nangCap < 1.36.3: báo một dòng (thanh nằm → xà đứng)', nc.doi);
    const c1 = C0.tapTheoKieu('D', null, D0); delete c1.tap.xa_dung; delete c1.tap.lui_thanh;
    ok(C0.nangCap(c1, '1.36.1').doi.filter(d => /khe tay nắm/.test(d)).length === 1, 'nangCap < 1.36.2: một dòng cho cả lùi + xà đứng', C0.nangCap(c1, '1.36.1').doi);
    const kA = C0.tapTheoKieu('A', null, D0); delete kA.tap.xa_dung; ok(!C0.nangCap(kA, '1.36.2').doi.some(d => /xà/.test(d)), 'nangCap: táp không khe tay nắm thì không báo');
    for (const [vao, ra] of [[1, 1], [0, 0], ['abc', 1], [null, 1], [false, 0]]) { const x = C0.tapTheoKieu('D', null, D0); x.tap.xa_dung = vao; eq(C0.normalize(x).tap.xa_dung, ra, `xa_dung ${JSON.stringify(vao)} → ${ra}`); } }
  // B (lọt lòng): thanh ngang vẫn phẳng mặt (thấy cạnh như đợt — kiểu ảnh B), không lùi
  { const M = C0.build(C0.tapTheoKieu('B', null, D0)); ok(M.parts.filter(p => p.thanh_nk).every(p => near(p.y0, 0)), 'B: thanh ngang lọt lòng giữ phẳng mặt'); }
  // hình: 3D có khối thanh lùi; hình đứng vẽ được (không số hỏng)
  { const M = C0.build(C0.tapTheoKieu('D', null, D0)), d = C0.hinh3D(M, { du_lieu: true }), sv = C0.elevationSVG(M, {}), h3 = C0.hinh3D(M, {});
    // (1.36.3) khối xà đứng y 30 … 30 + dày ván (trước: thanh nằm y 30 … 110); hình đứng vẽ xà nét đứt như xà ẩn tủ áo
    const xa = M.parts.find(p => p.xa_tap);
    ok(d.hop.some(h => h.b && near(h.b[1], 30) && near(h.b[4], 30 + M.spec.van.t) && near(h.b[5] - h.b[2], C0.TAP_XA)), '3D: khối xà đứng ở y 30 … 30 + dày ván', d.hop.filter(h => h.b && near(h.b[1], 30)).map(h => h.b));
    ok(xa && /stroke-dasharray/.test(sv), 'hình đứng: có xà (nét đứt)');
    ok(!/NaN|Infinity/.test(sv + h3), 'hình đứng + 3D: không số hỏng'); }
});

// Bản 1.36.2 — anh Thanh 15/10/2026 (ảnh Chenfeng: hậu táp PHỦ lên tới đỉnh gờ — thấy cạnh hậu lòi lên trên nóc và ở hông, "tấm hậu này lòi lên hơi xấu"),
// chốt bằng hộp tích "Hậu soi rãnh lọt lòng": hậu 6,5 lồng rãnh vào hồi + nóc + đáy (và vách giữa), nằm GỌN trong thùng — từ ngoài không thấy cạnh hậu ở đâu;
// phần gờ trên nóc do tấm Gờ sau che. Áp cho MỌI táp có s.tap (A – E) bất kể Chuẩn xưởng hậu đang là phủ / dày lọt lòng / soi rãnh (Chuẩn xưởng là của
// tủ áo — như cách táp bỏ phủ hồi). Táp cũ (không khoá tap, MAU_TAP_CU) và tủ áo không đổi. Táp ĐÃ VẼ ở bản < 1.36.2 (hậu phủ) dựng lại y như lúc vẽ.
T('Táp: hậu soi rãnh lọt lòng (bản 1.36.2)', () => {
  const D0 = C0.DEFAULT_SPEC, P = (M, l) => M.parts.filter(p => p.loai === l), box = p => [p.x0, p.x1, p.y0, p.y1, p.z0, p.z1], J = x => JSON.parse(JSON.stringify(x));
  ok(C0.DEFAULT_TAP.hau_ranh === 1, 'DEFAULT_TAP.hau_ranh = 1 (táp mới: hậu soi rãnh)', C0.DEFAULT_TAP);
  const CHUAN = { phu: D0, day: Object.assign(J(D0), { hau: Object.assign(J(D0.hau), { kieu: 'day', t: D0.van.t }) }), mong: Object.assign(J(D0), { hau: Object.assign(J(D0.hau), { kieu: 'mong' }) }) };
  const ranh = q => (q.holes || []).filter(h => h.kieu === 'ranh');
  for (const ck of Object.keys(CHUAN)) for (const k of ['A', 'B', 'C', 'D', 'E']) for (const co of [null, { rong: 400, sau: 350, cao: 450 }, { rong: 600, sau: 450, cao: 700 }]) {
    const s = C0.tapTheoKieu(k, co, CHUAN[ck]), M = C0.build(s), ten = `${k} ${co ? `${co.rong} × ${co.sau} × ${co.cao}` : 'mặc định'} (Chuẩn xưởng hậu ${ck})`;
    const t = s.van.t, gS = s.hau.ranh_sau, hau = P(M, 'HAU'), th = ck === 'day' ? C0.DEFAULT_SPEC.hau.t : s.hau.t;
    ok(hau.length >= 1 && hau.every(p => p.mong && !p.phu && near(p.y1 - p.y0, th)), `${ten}: hậu mỏng soi rãnh dày ${th} (Chuẩn xưởng ${ck} không áp cho táp)`, hau.map(p => [p.mong, p.phu, p.t]));
    // gọn trong thùng: cạnh hậu không chạm mặt ngoài nào — hông (hồi), trên (mặt trên nóc), dưới (mặt dưới đáy); lưng lùi `lui` sau mép sau thùng
    const hoi = P(M, 'HOI').sort((a, b) => a.x0 - b.x0), noc = P(M, 'NOC'), day = P(M, 'DAY'), go = P(M, 'GO');
    const sau = Math.max(...hoi.map(p => p.y1)), nTop = Math.max(...noc.map(p => p.z1)), dBot = Math.min(...day.map(p => p.z0));
    ok(hau.every(p => p.x0 > hoi[0].x0 + 1 && p.x1 < hoi[hoi.length - 1].x1 - 1 && p.z1 < nTop - 1 && p.z0 > dBot + 1 && near(p.y1, sau - s.hau.lui)), `${ten}: hậu nằm gọn trong thùng (không lòi lên nóc / ra hông / xuống đáy)`, [hau.map(box), hoi.map(box), nTop, dBot]);
    // mỗi cạnh hậu ăn vào rãnh trên ĐÚNG tấm có thật (tấm đứng trái / phải, đáy, nóc — kể cả nóc / đáy phủ liền thùng của C / D / E)
    for (const h of hau) {
      const trong = (q, ax, v) => q[ax + '0'] < v - 0.01 && q[ax + '1'] > v + 0.01;
      const dung = M.parts.filter(q => q.type === 1 && q.y0 < h.y0 && q.y1 > h.y1), nam = M.parts.filter(q => q.type === 0 && q.y0 < h.y0 && q.y1 > h.y1);
      const L = dung.find(q => trong(q, 'x', h.x0)), R = dung.find(q => trong(q, 'x', h.x1)), Dy = nam.find(q => trong(q, 'z', h.z0)), N = nam.find(q => trong(q, 'z', h.z1));
      ok(L && R && Dy && N && Dy.loai === 'DAY' && N.loai === 'NOC', `${ten}: bốn cạnh hậu nằm trong tấm đứng trái / phải, đáy, nóc`, [box(h), L && L.ten, R && R.ten, Dy && Dy.ten, N && N.ten]);
      if (!(L && R && Dy && N)) continue;
      // tấm đứng: u = sâu từ mép trước, v = cao từ mép dưới; tấm nằm: u từ mép trước, v từ mép PHẢI (v = x1 − x, đã đo — dinhKhoet). Rãnh phủ đoạn cạnh hậu NẰM TRONG tấm đó
      // (đáy / nóc lọt: chỉ bề ngang lọt lòng — hai góc hậu ăn vào rãnh hồi; hồi đứng trên đáy phủ / dưới nóc phủ: chỉ đoạn hồi có)
      const dRanh = (q, mat) => ranh(q).some(r => near(r.u, h.y0 - q.y0) && r.w >= th - 0.01 && near(r.sau, gS) && near(r.z, mat === 'lon' ? q.t - gS : 0) && q.z0 + r.v <= Math.max(h.z0, q.z0) + 0.01 && q.z0 + r.v + r.h >= Math.min(h.z1, q.z1) - 0.01);
      const nRanh = (q, mat) => ranh(q).some(r => near(r.u, h.y0 - q.y0) && r.w >= th - 0.01 && near(r.sau, gS) && near(r.z, mat === 'tren' ? q.t - gS : 0) && q.x1 - r.v - r.h <= Math.max(h.x0, q.x0) + 0.01 && q.x1 - r.v >= Math.min(h.x1, q.x1) - 0.01);
      ok(dRanh(L, 'lon') && dRanh(R, 'nho'), `${ten}: rãnh trên mặt trong của tấm đứng trái (mặt x lớn) / phải (mặt x nhỏ), phủ suốt cạnh hậu`, [box(h), ranh(L), ranh(R)]);
      ok(nRanh(Dy, 'tren') && nRanh(N, 'duoi'), `${ten}: rãnh mặt trên đáy + mặt dưới nóc, phủ suốt bề ngang hậu (v từ mép phải)`, [box(h), box(Dy), ranh(Dy), box(N), ranh(N)]);
      // hậu chỉ chồng lên tấm có rãnh, ăn vào đúng sâu rãnh
      const chong = M.parts.filter(q => q !== h && C0.overlap(q, h) > 0);
      ok(chong.every(q => ranh(q).length && Math.min(Math.min(q.x1, h.x1) - Math.max(q.x0, h.x0), Math.min(q.z1, h.z1) - Math.max(q.z0, h.z0)) <= gS + 0.01), `${ten}: hậu chỉ ăn vào rãnh (sâu ${gS}), không đè tấm khác`, chong.map(q => q.ten));
    }
    // gờ chắn (A, B): Gờ sau đứng trên nóc, kín giữa hai hồi nhô lên, sát lưng — hậu dừng ở rãnh nóc, không chạm gờ
    if (s.tap.go > 0) ok(go.length === 1 && near(go[0].z0, nTop) && near(go[0].x0, hoi[0].x1) && near(go[0].x1, hoi[hoi.length - 1].x0) && near(go[0].y1, sau) && hau.every(p => p.z1 < go[0].z0 - 1 && !C0.overlap(p, go[0])), `${ten}: gờ sau che phần trên nóc, hậu không lên tới gờ`, [go.map(box), hau.map(box)]);
    ok(!M.errors.length && !M.warnings.length && !overlapAny(M).length && !C0.kiemLienKet(M.parts).length && C0.phieu(M).dat, `${ten}: không lỗi / cảnh báo / đè / thiếu chỗ tì, phiếu đạt`, [M.errors, M.warnings, overlapAny(M), C0.kiemLienKet(M.parts)]);
    ok(ck === 'mong' || M.notes.some(n => /Táp: hậu soi rãnh/.test(n)), `${ten}: ghi chú một dòng vì sao không theo Chuẩn xưởng hậu`, M.notes);
    // lệnh nhập: hậu không khoan, rãnh xuất đúng mặt (Holes.Pos z = mặt trên / dưới của tấm)
    const cf = C0.toChenfeng(M), bd = cf.json.ModelSpace.filter(o => o.Type === 'Board');
    eq(cf.so_tam, M.parts.length, `${ten}: nhập đủ tấm`);
    const coL = bd.filter(o => o.Holes && o.Holes.length);
    ok(coL.length === M.parts.filter(q => q.holes.length).length && coL.every(o => o.Holes.every(x => near(x.Pos[2], 0) || near(x.Pos[2] + x.Thickness, t))), `${ten}: lỗ / rãnh xuất sang Chenfeng nằm trên mặt tấm`, coL.map(o => [o.Name, o.Holes.map(x => [x.Pos[2], x.Thickness])]));
    const dongHau = C0.cutList(M).rows.filter(r => /Hậu/.test(r.ten));
    ok(dongHau.length && dongHau.every(r => !/bắn đinh/.test(r.ghi_chu || '')), `${ten}: bảng kê không ghi hậu "ốp sau lưng, bắn đinh"`, dongHau.map(r => r.ghi_chu));
    if (!co && ck === 'phu') {
      const h = C0.heSo(s); ok(['L', 'W', 'H'].every(x => h.bien[x] && h.bien[x].sai_so < 0.02), `${ten}: module co giãn L / W / H`, h.ly_do);
      ok(C0.summary(M).some(l => /soi rãnh/.test(l)) && !C0.summary(M).some(l => /phủ sau lưng/.test(l)), `${ten}: tóm tắt nói hậu soi rãnh`, C0.summary(M));
      const sv = C0.elevationSVG(M, {}), h3 = C0.hinh3D(M, {}); ok(!/NaN|Infinity/.test(sv + h3), `${ten}: hình đứng + 3D vẽ được`);
    }
  }
  // tắt được: hau_ranh 0 → theo Chuẩn xưởng như trước (A: hậu phủ lên tới đỉnh gờ)
  { const s = C0.tapTheoKieu('A', null, D0); s.tap.hau_ranh = 0; const n = C0.normalize(s), M = C0.build(n);
    ok(n.tap.hau_ranh === 0 && P(M, 'HAU').every(p => p.phu && near(p.z1, n.cao - n.hau.mep)), 'hau_ranh 0: theo Chuẩn xưởng (hậu phủ, như 1.36.1)', P(M, 'HAU').map(box));
    for (const [vao, ra] of [[1, 1], [0, 0], ['abc', 1], [null, 1], [false, 0]]) { const x = C0.tapTheoKieu('A', null, D0); x.tap.hau_ranh = vao; eq(C0.normalize(x).tap.hau_ranh, ra, `hau_ranh ${JSON.stringify(vao)} → ${ra}`); } }
  // táp cũ (không khoá tap) + tủ áo: hậu phủ y như trước
  { const cu = C0.build(C0.apMau(D0, 'TAP2-500')), tu = C0.build(D0);
    ok(P(cu, 'HAU').length && P(cu, 'HAU').every(p => p.phu) && P(tu, 'HAU').every(p => p.phu) && !cu.notes.concat(tu.notes).some(n => /Táp: hậu soi rãnh/.test(n)), 'táp cũ / tủ áo: hậu phủ như cũ, không ghi chú'); }
  // táp VẼ ở 1.34.1 … 1.36.1 (hậu phủ, thông số chưa có hau_ranh): dựng lại đúng như lúc vẽ — không thì Sửa báo oan thiếu / thừa tấm, Cập nhật đổi hậu lặng lẽ
  { const cu = C0.tapTheoKieu('A', null, D0); delete cu.tap.hau_ranh; delete cu.tap.lui_thanh;
    const dv = C0.normalize(C0.specDaVe(cu, '1.36.1')), M = C0.build(dv);
    ok(dv.tap.hau_ranh === 0 && P(M, 'HAU').every(p => p.phu && near(p.z1, dv.cao - dv.hau.mep)), 'specDaVe < 1.36.2: táp giữ hậu phủ như lúc vẽ', P(M, 'HAU').map(box));
    ok(C0.normalize(C0.specDaVe(cu, C0.VERSION)).tap.hau_ranh === 1, 'specDaVe bản hiện hành: không đụng (soi rãnh)');
    const giu = C0.tapTheoKieu('A', null, D0); ok(C0.specDaVe(giu, '1.36.1').tap.hau_ranh === 1, 'specDaVe: số đã có thì giữ');
    ok(!('tap' in C0.specDaVe(J(D0), '1.36.1')), 'specDaVe: tủ không phải táp không sinh khoá tap');
    const nc = C0.nangCap(cu, '1.36.1');
    ok(nc.doi.some(d => /hậu/.test(d) && /soi rãnh/.test(d)) && C0.normalize(nc.spec).tap.hau_ranh === 1, 'nangCap < 1.36.2 (mở file / mẫu): theo chuẩn mới, báo một dòng', nc.doi);
    const m = C0.tapTheoKieu('A', null, CHUAN.mong); delete m.tap.hau_ranh; ok(!C0.nangCap(m, '1.36.1').doi.some(d => /hậu/.test(d) && /soi rãnh/.test(d)), 'nangCap: Chuẩn xưởng đã soi rãnh thì không báo');
    ok(!C0.nangCap(C0.apMau(D0, 'TAP2-500'), '1.36.1').doi.some(d => /soi rãnh/.test(d)), 'nangCap: táp cũ không khoá tap thì không báo'); }
});

T('Táp hậu soi rãnh — vòng soát (bản 1.36.2)', () => {
  const D0 = C0.DEFAULT_SPEC, P = (M, l) => M.parts.filter(p => p.loai === l), J = x => JSON.parse(JSON.stringify(x)), sz = M => M.parts.map(p => [p.loai, p.x1 - p.x0, p.y1 - p.y0, p.z1 - p.z0].join(':')).sort().join('|');
  const PH = require('../src/mncf-phong.js');
  // (1) táp có khấu cột: khấu cột hiện chỉ dựng với hậu PHỦ (hậu khấu là ván thùng đứng trước cột, hậu phủ chạy tới mép vùng cột). Hậu soi rãnh mà ép cho táp
  // thì mọi táp có cột báo "chỉ làm với kiểu hậu phủ (Chuẩn xưởng → Hậu)" — mà táp lại bỏ qua Chuẩn xưởng hậu → không lối ra. Táp có cột KHAI thì hậu theo Chuẩn xưởng.
  for (const k of ['A', 'B', 'C', 'D', 'E']) for (const [tk, kh] of [['trái', { trai: { rong: 100, sau: 100 } }], ['phải', { phai: { rong: 120, sau: 90 } }], ['giữa', { giua: [{ cach: 200, rong: 80, sau: 80 }] }]]) {
    const x = J(C0.tapTheoKieu(k, { rong: 600, sau: 450, cao: 600 }, D0)); Object.assign(x.khau, kh);
    const s = C0.normalize(x), M = C0.build(s), ten = `táp ${k} + cột ${tk}`;
    ok(!M.errors.length, `${ten}: dựng được (không báo "chỉ làm với hậu phủ")`, M.errors);
    ok(C0.hauCua(s).kieu === 'phu' && P(M, 'HAU').some(p => p.phu) && !P(M, 'HAU').some(p => p.mong), `${ten}: hậu theo Chuẩn xưởng (phủ; hậu khấu trước cột là ván thùng) để khấu được`, P(M, 'HAU').map(p => [p.phu, p.mong]));
    ok(M.notes.some(n => /Táp có khấu cột/.test(n) && /Chuẩn xưởng/.test(n)) && !M.notes.some(n => /Táp: hậu soi rãnh lọt lòng/.test(n)), `${ten}: ghi chú một dòng vì sao hậu không soi rãnh`, M.notes);
    ok(!overlapAny(M).length && !C0.kiemLienKet(M.parts).length, `${ten}: không đè, không thiếu chỗ tì`, [overlapAny(M), C0.kiemLienKet(M.parts)]);
  }
  { const x = J(C0.tapTheoKieu('A', null, D0)); x.khau.trai = { rong: 0, sau: 0 }; ok(C0.hauCua(C0.normalize(x)).kieu === 'mong', 'cột rộng / sâu 0 = không cột: vẫn soi rãnh'); }
  // Chuẩn xưởng soi rãnh + cột: lỗi như tủ áo, lời báo "Chuẩn xưởng → Hậu" là đúng (táp có cột theo Chuẩn xưởng)
  { const m = Object.assign(J(D0), { hau: Object.assign(J(D0.hau), { kieu: 'mong' }) }), x = J(C0.tapTheoKieu('A', null, m)); x.khau.trai = { rong: 100, sau: 100 };
    ok(C0.build(x).errors.some(e => /Chuẩn xưởng → Hậu/.test(e)), 'táp + cột, Chuẩn xưởng soi rãnh: báo đổi Chuẩn xưởng → Hậu (đổi thì được)'); }
  // đường thẻ Phòng: táp cỡ táp đứng vào khung có cột
  { const r = PH.tuChoKhung(C0, C0.tapTheoKieu('A', null, D0), { rong: 600, cao: 600, sau: 450, khau: { trai: { rong: 100, sau: 100 }, phai: { rong: 0, sau: 0 }, giua_cot: [], giua: [] } });
    const M = C0.build(r.spec); ok(r.spec.loai_sp === 'tap' && r.spec.khau.trai.rong === 100 && !M.errors.length && P(M, 'HAU').some(p => p.phu) && !P(M, 'HAU').some(p => p.mong), 'Ph.tuChoKhung: táp vào khung có cột → khấu được', [r.spec.khau, M.errors]);
    const r2 = PH.tuChoKhung(C0, C0.tapTheoKieu('B', null, D0), { rong: 900, cao: 600, sau: 450, khau: { trai: { rong: 0, sau: 0 }, phai: { rong: 0, sau: 0 }, giua_cot: [{ cach: 300, rong: 80, sau: 80 }], giua: [] } });
    ok(!C0.build(r2.spec).errors.length, 'Ph.tuChoKhung: táp + cột giữa → khấu được', C0.build(r2.spec).errors); }
  // (3) Sửa một táp vẽ trước 1.36.2: specDaVe ghi hau_ranh / lui_thanh = 0 để dò lại đúng tủ. Bảng chỉ có MỘT thông số → số 0 dính sang tủ vẽ MỚI.
  // tapKhoaCu = các khoá specDaVe vừa ghi 0 (để bảng báo + trả về chuẩn mới khi thôi nối); tapVeChuan trả các khoá đó về mặc định (chỉ khi còn là 0).
  { const f = J(C0.MAU_TAP[3].ap(J(D0))); delete f.tap.hau_ranh; delete f.tap.lui_thanh; delete f.tap.xa_dung;      // (1.36.3) thông số lúc vẽ 1.36.1 cũng chưa có xa_dung
    eq(C0.tapKhoaCu(f, '1.36.1'), ['hau_ranh', 'lui_thanh', 'xa_dung'], 'tapKhoaCu < 1.36.2: hau_ranh + lui_thanh + xa_dung');
    eq(C0.tapKhoaCu(f, C0.VERSION), [], 'tapKhoaCu bản hiện hành: không khoá nào');
    eq(C0.tapKhoaCu(C0.tapTheoKieu('A', null, D0), '1.36.1'), [], 'tapKhoaCu: khoá đã có thì không tính');
    eq(C0.tapKhoaCu(J(D0), '1.36.1'), [], 'tapKhoaCu: tủ áo không có khoá tap');
    const sc = C0.normalize(C0.specDaVe(f, '1.36.1')), doi = C0.tapVeChuan(sc, C0.tapKhoaCu(f, '1.36.1'));
    ok(J(doi).length === 3 && sc.tap.hau_ranh === 1 && sc.tap.lui_thanh === C0.DEFAULT_TAP.lui_thanh && sc.tap.xa_dung === 1 && P(C0.build(sc), 'HAU').every(p => p.mong), 'tapVeChuan: về hậu soi rãnh + rãnh móc + xà đứng chuẩn', [doi, sc.tap]);
    const s2 = C0.tapTheoKieu('A', null, D0); s2.tap.lui_thanh = 12; eq(C0.tapVeChuan(s2, ['hau_ranh', 'lui_thanh']), [], 'tapVeChuan: số khác 0 (người dùng / file) thì giữ'); }
  // (4) đường "bang" của Sửa (máy không có thông số đã lưu): bảng đang mở file táp cũ (qua nangCap → chuẩn mới), tấm trên bản vẽ dựng theo kiểu cũ.
  // tapBienTheCu = các thông số thử (khoá mới đặt về 0) — một trong số đó phải dựng ra ĐÚNG các tấm như lúc vẽ (specDaVe).
  for (const m of C0.MAU_TAP) {
    const f = J(m.ap(J(D0))); delete f.tap.hau_ranh; delete f.tap.lui_thanh; delete f.tap.xa_dung;
    const mo = C0.normalize(C0.nangCap(J(f), '1.36.1').spec), luc = sz(C0.build(C0.normalize(C0.specDaVe(J(f), '1.36.1'))));
    const bt = C0.tapBienTheCu(mo);
    ok(bt.length >= 1 && bt.some(b => sz(C0.build(b.spec)) === luc && b.khoa.length), `${m.ma}: có thông số thử dựng ra đúng tấm như lúc vẽ`, bt.map(b => b.khoa));
    ok(bt.every(b => b.khoa.every(k => b.spec.tap[k] === 0) && mo.tap.hau_ranh === 1), `${m.ma}: thông số thử là bản sao (bảng giữ chuẩn mới)`);
  }
  eq(C0.tapBienTheCu(J(D0)), [], 'tapBienTheCu: tủ áo không có thông số thử');
  // (2) ghi lại: hậu lùi vào rãnh → mặt trước hậu lùi `hau.lui` + dày hậu (D − 26,5 so với D − 6,5) — hộp ngăn kéo tính theo bước 50 nên khoang có cánh ngắn đi một bước
  { const s = C0.tapTheoKieu('A', null, D0), M = C0.build(s), h = P(M, 'HAU')[0]; ok(near(h.y0, s.sau_thung - s.hau.lui - h.t), 'mặt trước hậu táp = sâu − lùi − dày hậu', [h.y0, s.sau_thung, s.hau.lui]); }
});

T('Thư viện bếp gọn: chip chức năng, giữ rộng (bản 1.34.1)', () => {
  const D = C0.DEFAULT_SPEC, J = x => JSON.stringify(x), K = C0.KIEU_BEP, MAU = [...C0.MAU_BEP_DUOI, ...C0.MAU_BEP_TREN, ...C0.MAU_BEP_CAO];
  // ô Thư viện: đúng 3 mục bếp, không mục nào mang cỡ
  eq(C0.MAU_BEP_TV.map(m => [m.ma, m.ten]), [['@BEP-duoi', 'Tủ bếp dưới'], ['@BEP-tren', 'Tủ bếp trên'], ['@BEP-cao', 'Tủ bếp cao']], 'Thư viện bếp: Tủ bếp dưới / trên / cao');
  const tv = [].concat(...C0.THU_VIEN.filter(n => n.loai === 'bep').map(n => n.ds));
  ok(tv.length === 3 && !tv.some(m => MAU.indexOf(m) >= 0), 'ô Thư viện không còn mẫu bếp theo cỡ', tv.map(m => m.ma));
  ok(J(C0.apMau(D, '@BEP-duoi')) === J(C0.apMau(D, 'BD-CANH-600')) && J(C0.apMau(D, '@BEP-tren')) === J(C0.apMau(D, 'BT-CANH-600')) && J(C0.apMau(D, '@BEP-cao')) === J(C0.apMau(D, 'BC-KHO-600')), 'mục Thư viện = tủ mặc định của tầng (cánh 600 / tủ trên cánh 600 / đồ khô cánh 600)');
  // chip theo tầng
  eq(K.duoi.map(x => x.ma), ['canh', 'nk', 'chau', 'bep', 'xn', 'gv', 'rac', 'gao', 'ke', 'goc'], 'chip tủ dưới');
  eq(K.tren.map(x => x.ma), ['canh', 'bat', 'hm', 'hmk', 'ke', 'goc'], 'chip tủ trên');
  eq(K.cao.map(x => x.ma), ['kho', 'kho_canh', 'tl', 'lo'], 'chip tủ cao');
  ok(['duoi', 'tren', 'cao'].every(t => K[t].every(x => x.nut && x.nut.length <= 12)), 'nhãn chip ngắn (bảng ít chữ)');
  // dùng chung với MAU_BEP_*: cùng kiểu + cùng cỡ = y hệt mẫu; chip nhận ra kiểu của mẫu
  for (const m of MAU) {
    if (!m.kieu) continue;
    const a = C0.apMau(D, m.ma), b = C0.bepTheoKieu(D, m.kieu, { tang: m.tang, rong: a.rong, goc_pk: m.goc_pk, ben: m.goc_ben, may: m.may });
    ok(J(a) === J(b), `${m.ma}: bepTheoKieu(${m.kieu}, ${a.rong}) = mẫu`);
    ok(C0.kieuBep(a) === m.kieu, `${m.ma}: chip đang bấm = ${m.kieu}`, C0.kieuBep(a));
  }
  ok(MAU.filter(m => !m.kieu).every(m => /-H\d+$|BATCD/.test(m.ma)), 'chỉ biến thể (H700 / H900, giá bát cố định) không thuộc chip', MAU.filter(m => !m.kieu).map(m => m.ma));
  ok(C0.bepTheoKieu(D, 'tl', { tang: 'duoi' }) === null && C0.bepTheoKieu(D, 'zz', { tang: 'cao' }) === null, 'kiểu không có ở tầng đó → null');
  ok(C0.kieuBep(D) === '' && C0.kieuBep(C0.apMau(D, 'TA2-1000')) === '', 'tủ áo: không chip nào');
  // GIỮ rộng: đổi chức năng ở rộng 550 (không có trong thư viện) → vẫn 550, ruột của chức năng mới
  { let s = C0.bepTheoKieu(D, 'canh', { tang: 'duoi', rong: 550 });
    ok(s.rong === 550 && s.ten === 'Tủ cánh 550' && !C0.build(s).errors.length, 'tủ cánh 550: dựng được', C0.build(s).errors);
    s = C0.bepTheoKieu(s, 'nk', { rong: s.rong });
    ok(s.rong === 550 && s.bep.chuc_nang === 'nk' && s.khoang[0].o.some(o => o.kieu === 'nk_trum') && !C0.build(s).errors.length, 'đổi sang ngăn kéo: giữ 550, ruột 3 ngăn kéo', [s.rong, s.khoang]);
    const g = C0.bepTheoKieu(s, 'gv', { rong: s.rong }), Mg = C0.build(g);
    ok(g.rong === 550 && Mg.errors.some(t => /Đặt tủ rộng 450/.test(t)), 'gia vị 550: rổ lệch cỡ hãng → báo kèm "Đặt tủ rộng 450" (nút Chuyển tủ của bảng)', Mg.errors);
    const k = C0.bepTheoKieu(D, 'kho', { tang: 'cao', rong: 600 });
    ok(k.rong === 600 && C0.build(k).errors.some(t => /Đặt tủ rộng 400/.test(t)), 'đồ khô kéo 600 (rổ chỉ 400): báo + "Đặt tủ rộng 400"'); }
  // thiết bị: cỡ lạ lấy máy của mẫu lớn nhất ≤ rộng (lọt), đúng cỡ thì máy của mẫu
  { const h = C0.bepTheoKieu(D, 'hm', { tang: 'tren', rong: 900 }), c = C0.bepTheoKieu(D, 'chau', { tang: 'duoi', rong: 1000 }), c7 = C0.bepTheoKieu(D, 'chau', { tang: 'duoi', rong: 700 });
    ok(h.rong === 900 && h.bep.tb.hm.ma === 'am_800' && !C0.build(h).errors.length, 'hút mùi 900: (1.35) mẫu BT-HM-900, máy âm 800, lọt', h.bep.tb.hm.ma);
    ok(c.rong === 1000 && c.bep.tb.chau.ma === 'am_780' && !C0.build(c).errors.length, 'chậu 1000: chậu của mẫu 900, lọt', c.bep.tb.chau.ma);
    ok(c7.rong === 700 && c7.bep.tb.chau.ma === 'am_don_600', 'chậu 700 (nhỏ hơn mọi mẫu): chậu của mẫu nhỏ nhất', c7.bep.tb.chau.ma); }
  // tủ góc: rộng theo phụ kiện góc; giữ phụ kiện / phía mù của tủ góc đang mở
  { const g0 = C0.bepTheoKieu(D, 'goc', { tang: 'duoi', rong: 600 });
    ok(g0.rong === 900 && g0.bep.goc_pk === 'hg_lh', 'góc mù: rộng theo phụ kiện góc (Higold liên hoàn 900), không giữ 600');
    const p = C0.bepTheoKieu(D, 'goc', { tang: 'duoi', goc_pk: 'eu_lh', ben: 'phai' });
    ok(J(p) === J(C0.apMau(D, 'BD-GOC-990-P')), 'góc mù Eurogold liên hoàn, mù phải = BD-GOC-990-P');
    ok(J(C0.bepTheoKieu(p, 'goc', {})) === J(p), 'chọn lại góc mù: giữ phụ kiện + phía mù của tủ đang mở'); }
  // khoang tủ lạnh: rộng theo máy; gõ rộng → máy có khoang gần nhất
  { const t = C0.bepTheoKieu(D, 'tl', { tang: 'cao' }), t2 = C0.bepTheoKieu(D, 'tl', { tang: 'cao', rong: 1000 });
    ok(t.bep.tb.tl.ma === 'hai_canh_700' && J(C0.bepTheoKieu(D, 'tl', { tang: 'cao', may: 'sbs_910' })) === J(C0.apMau(D, 'BC-TL-910')), 'tủ lạnh: mặc định máy 2 cánh 700; chọn máy = mẫu khoang của máy đó');
    ok(t2.bep.tb.tl.ma === 'sbs_910', 'tủ lạnh gõ rộng 1000 → máy side-by-side 910', t2.bep.tb.tl.ma); }
  // chuẩn bếp + Chuẩn xưởng giữ nguyên khi đổi chức năng
  { const s = C0.datBep(C0.apMau(D, 'BD-CANH-600'), { cao_mat: 870 }); s.van = Object.assign({}, s.van, { t: 17 });
    const n = C0.bepTheoKieu(C0.normalize(s), 'xn', { rong: 650 });
    ok(n.rong === 650 && n.bep.cao_mat === 870 && n.cao === 850 && n.van.t === 17, 'đổi sang giá bát + xoong 650: giữ mặt đá 870 + ván 17', [n.rong, n.bep.cao_mat, n.cao, n.van.t]); }
  // quét: mọi chip × rộng 300 … 1000 dựng được, đúng rộng (trừ góc / tủ lạnh), chip nhận lại đúng kiểu, không tấm đè nhau
  for (const t of ['duoi', 'tren', 'cao']) for (const x of K[t]) for (let w = 300; w <= 1000; w += 50) {
    const s = C0.bepTheoKieu(D, x.ma, { tang: t, rong: w }); let M = null;
    try { M = C0.build(s); } catch (e) { ok(false, `${t}/${x.ma} ${w}: ném lỗi`, e.message); continue; }
    if (x.ma !== 'goc' && x.ma !== 'tl') ok(s.rong === w, `${t}/${x.ma} ${w}: giữ rộng`, s.rong);
    ok(s.bep.tang === t && C0.kieuBep(s) === x.ma, `${t}/${x.ma} ${w}: tầng + chip`, [s.bep.tang, C0.kieuBep(s)]);
    eq(overlapAny(M), [], `${t}/${x.ma} ${w}: không tấm nào đè nhau`);
  }
});

T('Soát táp / thư viện bếp (bản 1.34.1)', () => {
  const D = C0.DEFAULT_SPEC, J = x => JSON.stringify(x);
  // bấm lại nút kiểu táp: giữ phào + cánh của khoang (chỉ ruột + kết cấu theo kiểu), xà đế theo kiểu
  { const s = C0.tapTheoKieu('C', null, D); s.phao.trai = s.phao.phai = 40; s.chan.cao = 80; s.khoang[0].canh = 1;
    const n = C0.normalize(s), d = C0.doiKieuTap(n, 'C');
    ok(d.phao.trai === 40 && d.phao.phai === 40 && d.khoang[0].canh === 1 && d.rong === n.rong, 'bấm lại kiểu C: giữ phào trái / phải 40 và cánh của khoang', [d.phao, d.khoang[0].canh]);
    ok(d.chan.cao === C0.KIEU_TAP.C.chan, 'bấm lại kiểu: xà đế về cao của kiểu', d.chan.cao);
    ok(d.tap.tu_dong && C0.tapTuDong(d).doi === false, 'bấm lại kiểu: ruột là ruột tự chia (dấu khớp)');
    const a = C0.doiKieuTap(C0.tapTheoKieu('A', null, D), 'B');
    ok(J(a) === J(C0.tapTheoKieu('B', { rong: 450, sau: 400, cao: 600 }, D)), 'táp không phào / cánh: đổi kiểu y như trước'); }
  // táp hẹp: lời báo đúng cho táp + rộng tối thiểu của kiểu; đặt đúng số đó thì hết lỗi
  for (const k of ['A', 'B', 'C', 'E']) {
    const M = C0.build(C0.tapTheoKieu(k, { rong: 300 }, D)), e = M.errors.find(t => /ngăn kéo/.test(t)) || '', m = /táp rộng ≥ (\d+)/.exec(e);
    ok(m && !/vách đệm|bản lề/.test(e), `táp ${k} rộng 300: lời báo nói rộng tối thiểu của táp, không nhắc vách đệm / bản lề`, e);
    if (m) { const M2 = C0.build(C0.tapTheoKieu(k, { rong: +m[1] }, D)), M3 = C0.build(C0.tapTheoKieu(k, { rong: +m[1] - 5 }, D));
      ok(!M2.errors.length && M3.errors.length > 0, `táp ${k}: rộng ${m[1]} hết lỗi, ${+m[1] - 5} còn lỗi`, [M2.errors, M3.errors]); }
  }
  { const s = C0.normalize(Object.assign(C0.clone ? C0.clone(D) : JSON.parse(J(D)), { rong: 320, khoang: [{ rong: 'auto', canh: 0, dot: [], o: [{ tu: 0, kieu: 'nk_am', so: 2 }] }], phao: { trai: 0, phai: 0, tren: 0 } }));
    ok(C0.build(s).errors.some(t => /quá hẹp cho ngăn kéo âm/.test(t)), 'tủ áo hẹp: lời báo cũ giữ nguyên'); }
  // tủ bếp gõ Rộng: số cánh theo luật của chức năng (như chip), chỉ khi số cánh đang là số tự chia ở rộng cũ
  { const tc = (s, w) => C0.bepTheoKieu(s, C0.kieuBep(s), { rong: w }).khoang[0].canh;
    const ca = [['tren', 'canh', 600, 300], ['duoi', 'canh', 600, 1200], ['tren', 'bat', 800, 300], ['cao', 'kho_canh', 600, 1200], ['tren', 'canh', 300, 800]];
    for (const [tang, kieu, w0, w1] of ca) {
      const s0 = C0.bepTheoKieu(D, kieu, { tang, rong: w0 }), s = C0.normalize(Object.assign(JSON.parse(J(s0)), { rong: w1 })), r = C0.canhBepTheoRong(s, w0);
      ok(r.doi && r.spec.khoang[0].canh === tc(s0, w1) && r.spec.rong === w1, `${tang}/${kieu} ${w0} → gõ ${w1}: ${tc(s0, w1)} cánh như chip`, [r.doi, r.spec.khoang[0].canh]);
      ok(!C0.build(r.spec).warnings.some(t => /Cánh chỉ rộng|dễ xệ/.test(t)), `${tang}/${kieu} ${w1}: không cảnh báo cánh hẹp / xệ`, C0.build(r.spec).warnings);
    }
    const s0 = C0.bepTheoKieu(D, 'canh', { tang: 'duoi', rong: 600 }); s0.khoang[0].canh = 2;      // người dùng chọn 2 cánh ở 600 (luật: 1)
    ok(!C0.canhBepTheoRong(C0.normalize(Object.assign(JSON.parse(J(s0)), { rong: 700 })), 600).doi, 'số cánh người dùng đã sửa: gõ rộng không đổi');
    ok(!C0.canhBepTheoRong(C0.normalize(Object.assign(JSON.parse(J(s0)), { rong: 700 })), 30).doi, 'rộng cũ không hợp lệ: không đổi');
    ok(!C0.canhBepTheoRong(C0.tapTheoKieu('A', null, D), 400).doi && !C0.canhBepTheoRong(D, 400).doi, 'táp / tủ áo: không đụng'); }
});

// Bản 1.36.4 (anh Thanh 16/10/2026, chốt bằng hộp tích): ảnh tủ 3000 × 2800 "layout tủ ntn nhé" → tủ mặc định mới; "thêm khoang thì khoang trống thôi nhiều đợt quá
// khó xử lý" → mẫu tủ áo bỏ kiểu đợt đều (khoang đó trống). Bộ thử ở trên ghim tủ mặc định cũ (ghimTuCu) — khối này nạp một bản lõi mới.
T('Tủ mặc định mới, mẫu tủ áo khoang trống (bản 1.36.4)', () => {
  const k = require.resolve('../src/mncf-core.js'), cu = require.cache[k]; delete require.cache[k]; const C = require(k); require.cache[k] = cu;
  const D = C.DEFAULT_SPEC, MT = m => C.MAU_TU.find(x => x.ma === m).khoang();
  // (1.36.4, ảnh 2 — số THẬT anh dùng) đợt +1130 / +595 / +1130, KHÔNG phải ruột thư viện (1150 / 570 — các mẫu tủ khác giữ nguyên)
  const hai = { dot: [1130], o: [{ tu: 0, kieu: 'suot' }, { tu: 1130, kieu: 'suot' }] }, nkt = { dot: [595], o: [{ tu: 0, kieu: 'nk_am', so: 2 }, { tu: 595, kieu: 'suot' }] }, ruot = x => ({ dot: x.dot, o: x.o });
  eq(D.khoang.map(ruot), [hai, nkt, hai], 'K1 hai tầng treo · K2 2 ngăn kéo âm (loại mặc định ray bi 3 tầng đáy mỏng) + treo dài · K3 hai tầng treo');
  eq(D.khoang.map(x => x.dot), [[1130], [595], [1130]], 'đợt +1130 / +595 / +1130');
  eq([MT('TA4-2000-2T')[0].dot, MT('TA2-1100-T')[0].dot], [[1150], [570]], 'ruột thư viện các mẫu khác giữ nguyên 1150 / 570');
  eq(D.ngan_keo.mac_dinh, 'bi_mong', 'ngăn kéo loại mặc định = ray bi 3 tầng đáy mỏng');
  eq([D.rong, D.cao, D.than.cao_duoi], [3000, 2800, 2150], 'tủ 3000 × 2800, thân dưới 2150');
  const s = C.normalize(D), M = C.build(s);
  eq([M.errors, M.warnings], [[], []], 'tủ mặc định: không lỗi, không cảnh báo');
  const hoi = M.parts.filter(p => /^Hồi/.test(p.ten)), thD = hoi.filter(p => p.than === 'D'), thT = hoi.filter(p => p.than === 'T');
  ok(thD.length && thD.every(p => near(p.z1, 2150)) && thT.length && thT.every(p => near(p.z0, 2150) && near(p.z1 - p.z0, 600)), 'thân dưới tới +2150, thân trên cao 600 (+ phào 50 = 2800)', hoi.map(p => [p.than, p.z0, p.z1]));
  eq(P(M, 'DOT').map(p => [p.khoang, p.z0]), [[0, 1130], [1, 595], [2, 1130]], 'mỗi khoang một đợt');
  eq((M.templates || []).filter(t => t.ten === '衣杆').length, 5, '5 suốt treo (2 + 1 + 2)');
  ok(C.phieu(M).dat, 'phiếu kiểm đạt');
  eq(C.keHoachGoc(s).loi, [], 'vẽ được bằng lệnh gốc như tủ mặc định cũ');
  // mẫu tủ áo: không còn khoang đợt đều — khoang đó trống, mô tả nói "khoang trống"
  ok(C.MAU_TU.every(m => m.khoang().every(x => x.o.length || x.dot.length < 5)) && !C.MAU_TU.some(m => /đợt đều/.test(m.mo_ta)), 'không mẫu nào còn khoang toàn đợt đều (2 ngăn kéo + đợt thì giữ)', C.MAU_TU.map(m => m.mo_ta));
  for (const ma of ['TA3-1500', 'TA5-2500', 'TA6-3000']) {
    const kh = MT(ma), tr = kh.filter(x => !x.dot.length && !x.o.length);
    ok(tr.length === 1 && /khoang trống/.test(C.MAU_TU.find(x => x.ma === ma).mo_ta), `${ma}: một khoang trống, mô tả ghi "khoang trống"`, kh);
    const Mm = C.build(C.apMau(D, ma)); eq(Mm.errors, [], `${ma}: dựng không lỗi`);
  }
  // tách khoang cho vừa khổ ván: khoang trống tách ra vẫn trống (không sinh đợt)
  { const v = C.vuaKhoVan(Object.assign(C.apMau(D, 'TA3-1500'), { rong: 3000 })), dot0 = C.apMau(D, 'TA3-1500').khoang.reduce((a, x) => a + x.dot.length, 0);
    ok(v.spec.khoang.length > 2 && v.spec.khoang.filter(x => !x.dot.length && !x.o.length).length >= 1, 'vừa khổ ván: khoang trống vẫn trống', v.spec.khoang);
    ok(v.spec.khoang.every(x => x.dot.length <= 1), 'vừa khổ ván: không khoang nào có thêm đợt (chỉ chép đợt của chính khoang bị tách)', [dot0, v.spec.khoang.map(x => x.dot)]); }
  // thẻ Phòng: khung hẹp 1 cánh lấy khoang trống
  { const Ph = require('../src/mncf-phong.js'), r = Ph.tuChoKhung(C, D, { rong: 450, cao: 2700, sau: 600 });
    eq([r.mau, r.spec.khoang.map(x => [x.dot.length, x.o.length])], [['1 cánh, khoang trống'], [[0, 0]]], 'khung hẹp 450: 1 cánh, khoang trống'); }
  // (soát 1.36.4) thông số bản cũ THIẾU khoá than (tệp viết tay): normalize gộp mặc định mới 2150 → tủ 2250 thêm cảnh báo gộp thân, tủ 2400 thân trên 200
  // thay vì 150 — đổi lặng lẽ. nangCap < 1.36.4 ghi lại thân dưới cũ 2200 (giữ đúng tủ như ở bản đã lưu); thông số có khoá thì không đụng.
  { const tho = { rong: 1600, cao: 2250, khoang: [{ rong: 'auto', canh: 2, dot: [1100], o: [] }] };
    const n = C.nangCap(tho, '1.36.3'); eq(n.spec.than && n.spec.than.cao_duoi, 2200, 'nangCap < 1.36.4, thiếu than: thân dưới 2200 như bản cũ');
    const Mn = C.build(C.normalize(n.spec)); eq(Mn.warnings.filter(w => /Thân trên/.test(w)), [], 'tủ 2250 cũ: không thêm cảnh báo gộp thân');
    eq(C.nangCap(Object.assign({}, tho, { than: { cao_duoi: 2000 } }), '1.36.3').spec.than.cao_duoi, 2000, 'có khoá than: giữ số đã lưu');
    eq(C.nangCap(Object.assign({}, tho, { than: { cao_duoi: 0 } }), '1.36.3').spec.than.cao_duoi, 0, 'một thân (0): giữ');
    ok(!('than' in C.nangCap(tho, '1.36.4').spec) && !('than' in C.nangCap(tho).spec), 'bản 1.36.4 / không rõ bản: không đụng');
    eq(C.nangCap(Object.assign({}, tho, { loai_sp: 'tap' }), '1.36.3').spec.than, undefined, 'táp / giường / vách / bếp (thân do mẫu tự đặt): không đụng'); }
  // (soát 1.36.4, lần 2) thiếu cả khoá khoang: normalize gộp ruột mặc định MỚI (1130 / 595 / 1130) lên thân dưới 2200 cũ → tủ lai, đổi lặng lẽ.
  // nangCap ghi lại ruột tủ mặc định cũ (treo dài · ngăn kéo + treo · 5 đợt đều) — tủ mở ra y như ở bản đã lưu.
  { const n = C.nangCap({ rong: 3000, cao: 2800 }, '1.36.3'), sn = C.normalize(n.spec);
    eq(sn.khoang.map(k => k.dot), KHOANG_MAC_DINH_CU.map(k => k.dot), 'nangCap < 1.36.4, thiếu khoang: ruột tủ mặc định cũ');
    eq(sn.khoang.map(k => k.o), KHOANG_MAC_DINH_CU.map(k => k.o), 'nangCap < 1.36.4, thiếu khoang: nội dung ô tủ mặc định cũ');
    eq(sn.than.cao_duoi, 2200, '… trên thân dưới cũ 2200');
    const co = { rong: 3000, cao: 2800, khoang: [{ rong: 'auto', canh: 2, dot: [900], o: [] }] };
    eq(C.nangCap(co, '1.36.3').spec.khoang, co.khoang, 'có khoá khoang: giữ ruột đã lưu');
    ok(!('khoang' in C.nangCap({ rong: 3000 }, '1.36.4').spec), 'bản 1.36.4: không đụng khoang');
    ok(!('khoang' in C.nangCap({ rong: 3000, loai_sp: 'bep' }, '1.36.3').spec), 'tủ bếp / táp…: không đụng khoang'); }
});

// Bản 1.36.4 (anh Thanh 16/10/2026, ảnh Chenfeng: thanh ngang trên khung mặt hộc kéo âm có lỗ cam / chốt ở mặt trước — "lỗ cam chốt hở ra ngoài rất xấu"):
// tấm ĐỨNG lộ mặt trước giấu lỗ vào mặt trong — FrontDrill false, BackDrill true (như hậu dày lọt lòng). Nghĩa FrontDrill của tấm type 2 trên Chenfeng thật CHƯA ĐO.
T('Lỗ cam không lộ mặt trước (bản 1.36.4)', () => {
  const k = require.resolve('../src/mncf-core.js'), cu = require.cache[k]; delete require.cache[k]; const C = require(k); require.cache[k] = cu;
  const D = C.DEFAULT_SPEC;
  // tấm lộ mặt trước: thanh khung mặt / xà ẩn / xà đứng táp (XA), xà chân / xà đế / chân trước (CHAN), giằng trước, gờ sau táp, đế trước giường bay
  const lo = p => p.type === 2 && (['XA', 'CHAN', 'GO'].includes(p.loai) || p.ten === 'Giằng trước' || p.ten === 'Đế giường trước');
  const kiem = (ten, s, can) => {
    const M = C.build(s), ds = M.parts.filter(lo), cf = C.toChenfeng(M, { id: 'X1' }), j = typeof cf.json === 'string' ? JSON.parse(cf.json) : cf.json;
    const boards = j.ModelSpace.filter(e => e.Type === 'Board');
    ok(can.every(l => ds.some(p => p.loai === l || p.ten === l)), `${ten}: có tấm ${can.join(' / ')}`, ds.map(p => p.ten));
    const sai = ds.filter(p => !(p.fd === false && (p.bd === true || (p.khoan === C.KHONG_KHOAN && p.keo_nep))));
    eq(sai.map(p => [p.ten, p.fd, p.bd]), [], `${ten}: tấm lộ mặt trước không khoan mặt trước (fd false, bd true; thanh giữa 2 nẹp: không khoan mặt nào)`);
    ok(ds.filter(p => !p.keo_nep).every(p => p.giau_lo), `${ten}: tấm lộ mặt trước mang dấu giau_lo`);
    // dữ liệu nhập Chenfeng mang đúng cờ
    { const ten_ = new Set(ds.map(p => p.ten)), bt = boards.filter(b => ten_.has(b.Name) && b.FrontDrill === false && b.BackDrill === true);
      eq(bt.length, M.parts.filter(p => p.giau_lo).length, `${ten}: lệnh nhập mang FrontDrill false / BackDrill true cho đúng các tấm giấu lỗ`); }
    // tấm khác không đổi: hồi / vách / đáy / đợt vẫn khoan cả hai mặt
    ok(M.parts.filter(p => ['HOI', 'VACH', 'DAY', 'DOT'].includes(p.loai) && p.khoan !== C.KHONG_KHOAN).every(p => p.fd && p.bd && !p.giau_lo), `${ten}: tấm thùng khác giữ fd / bd`);
    return M;
  };
  const M0 = kiem('tủ mặc định (khung mặt hộc kéo âm)', C.normalize(D), ['XA', 'CHAN']);
  ok(M0.parts.some(p => p.loai === 'XA' && p.tren && p.khung_mat && p.giau_lo), 'thanh TRÊN khung mặt (ảnh của anh) giấu lỗ');
  { const s = C.apMau(D, 'TA2-1000'); s.ngan_keo.khung_mat = 0; kiem('khung mặt cũ (xà ẩn sau khe)', C.normalize(s), ['XA']); }
  for (const kieu of ['A', 'B', 'C', 'D']) kiem(`táp ${kieu}`, C.tapTheoKieu(kieu, null, D), kieu === 'A' || kieu === 'B' ? ['CHAN', 'GO'] : ['CHAN']);
  { const Md = C.build(C.tapTheoKieu('D', null, D)); ok(Md.parts.some(p => p.xa_tap) && Md.parts.filter(p => p.xa_tap).every(p => p.giau_lo && p.fd === false), 'táp D: xà đứng che khe tay nắm giấu lỗ'); }
  kiem('tủ chậu (giằng trước + xà chân lùi)', C.apMau(D, 'BD-CHAU-800'), ['Giằng trước', 'CHAN']);
  kiem('giường bay (đế trước)', C.apMau(D, 'G16-B'), ['Đế giường trước']);
  // (soát 1.36.4) tủ KHÔNG cánh (kệ hở) nhìn thẳng thấy mặt trước của giằng sau / thanh treo; cánh khung kính thì thấy qua kính → cũng giấu lỗ.
  // Tủ có cánh đặc: hai tấm này khuất sau cánh — giữ fd / bd như cũ (không đổi tủ đang chạy tốt).
  const sauLo = (M, ten) => M.parts.filter(p => p.ten === ten);
  for (const [ma, ten] of [['BD-KE-300', 'Giằng sau'], ['BT-KE-300', 'Thanh treo']]) {
    const M = C.build(C.apMau(D, ma)), ds = sauLo(M, ten);
    ok(ds.length > 0 && M.parts.every(p => p.loai !== 'CANH'), `${ma}: có ${ten.toLowerCase()}, không cánh`);
    eq(ds.map(p => [p.fd, p.bd, !!p.giau_lo]), ds.map(() => [false, true, true]), `${ma}: ${ten.toLowerCase()} lộ mặt trước → giấu lỗ`);
  }
  { const s = C.apMau(D, 'BT-CANH-600'), M1 = C.build(s); ok(sauLo(M1, 'Thanh treo').length && sauLo(M1, 'Thanh treo').every(p => p.fd && p.bd && !p.giau_lo), 'tủ trên cánh đặc: thanh treo khuất sau cánh, giữ fd / bd');
    s.bep.kinh = 1; const M2 = C.build(C.normalize(s));
    ok(M2.parts.some(p => p.kinh) && sauLo(M2, 'Thanh treo').length && sauLo(M2, 'Thanh treo').every(p => p.fd === false && p.bd && p.giau_lo), 'tủ trên cánh khung kính: thanh treo thấy qua kính → giấu lỗ'); }
  { const M3 = C.build(C.apMau(D, 'BD-CANH-600')); ok(sauLo(M3, 'Giằng sau').length && sauLo(M3, 'Giằng sau').every(p => p.fd && p.bd && !p.giau_lo), 'tủ dưới cánh: giằng sau khuất, giữ fd / bd'); }
});

// Bản 1.36.5 (anh Thanh 16/10/2026: "cải phần tủ cho thêm bản lề hay đảo vị trí bản lề bắt lật cho các tủ trên được k", chốt bằng hộp tích):
// (1) cánh LẬT LÊN + tay nâng cho tủ trên bếp (tủ lẻ: nút Cánh lật trong khối Tủ bếp; Bộ bếp: ô chọn tủ trên, theo CHỖ { canh, s } như cánh kính);
// (2) số bản lề MỖI CÁNH chỉnh được ở từng khoang (khoang[i].so_ban_le; thiếu = tự tính như 1.30), vị trí vẫn chia đều + tránh đợt.
T('Bản lề + cánh lật (bản 1.36.5)', () => {
  const k = require.resolve('../src/mncf-core.js'), cu = require.cache[k]; delete require.cache[k]; const C = require(k); require.cache[k] = cu;
  const D = C.DEFAULT_SPEC, GAP = 2 * 17.5 + 10;
  // ---- (2) banLeCanh nhận số ép ----
  const a = C.banLeCanh(2000, 450, {});
  ok(a.so === 4 && !('kep' in a) && !('ep' in a), 'không ép: như 1.30 (cánh 2000 → 4), kết quả không thêm khoá', a);
  const a6 = C.banLeCanh(2000, 450, { so: 6 });
  ok(a6.so === 6 && !a6.ket && !a6.kep && near(a6.z[0], 100) && near(a6.z[5], 1900) && a6.z.every((z, i) => !i || near(z - a6.z[i - 1], 360)), 'ép 6: chia đều 100 … 1900', a6);
  const a1 = C.banLeCanh(700, 450, { so: 1 });
  ok(a1.so === 2 && a1.kep && a1.ep === 1, 'ép 1: kẹp lên 2 (tối thiểu kỹ thuật), có dấu kẹp', a1);
  const a9 = C.banLeCanh(300, 450, { so: 5 });
  ok(a9.so === 4 && a9.kep && a9.z.every((z, i) => !i || z - a9.z[i - 1] >= GAP - 0.01), 'ép 5 trên cánh 300: quá dày (hai chén < 2r + 10) → kẹp còn 4', a9);
  const at = C.banLeCanh(2000, 450, { so: 5, tranh: [[980, 1060]] });
  ok(at.so === 5 && !at.ket && at.z.every(z => z + 17.5 <= 980 + 0.01 || z - 17.5 >= 1060 - 0.01), 'ép 5 vẫn tránh đợt', at);
  // ---- normalize: khoá chỉ có khi người dùng đặt ----
  ok(C.normalize(D).khoang.every(q => !('so_ban_le' in q)), 'tủ mặc định: không có khoá so_ban_le');
  const ns = v => { const s = JSON.parse(JSON.stringify(D)); s.khoang[0].so_ban_le = v; return C.normalize(s).khoang[0].so_ban_le; };
  eq([ns(0), ns('abc'), ns(3.4), ns('5'), ns(99)], [undefined, undefined, 3, 5, 12], 'so_ban_le: 0 / chữ = tự; làm tròn; trần 12');
  // ---- build: khoang ép số, khoang khác giữ ----
  const s0 = C.normalize(D), M0 = C.build(s0), s1 = JSON.parse(JSON.stringify(s0)); s1.khoang[0].so_ban_le = 6;
  const M1 = C.build(C.normalize(s1)), canh = (M, i) => M.parts.filter(p => p.loai === 'CANH' && p.khoang === i && p.ban_le);
  // (vòng soát 1.36.5) số ép chỉ áp cho cánh CHÍNH của khoang (cánh có số tự tính lớn nhất); cánh thấp hơn (thân trên) giữ số tự tính, không vượt số ép —
  // trước đây ép 6 làm cánh thân trên 597 cũng lên 6 (và bấm − ở 5 / 2 làm cánh 597 TĂNG lên 4)
  ok(canh(M1, 0).length && canh(M1, 0).every(p => p.ban_le.so === (p.z1 - p.z0 > 1000 ? 6 : 2)), 'khoang 1 ép 6: cánh chính 6, cánh thân trên giữ số tự tính 2', canh(M1, 0).map(p => [p.z1 - p.z0, p.ban_le.so]));
  eq(canh(M1, 1).map(p => p.ban_le), canh(M0, 1).map(p => p.ban_le), 'khoang 2 không ép: giữ nguyên');
  const tong = M => M.parts.filter(p => p.ban_le).reduce((n, p) => n + p.ban_le.so, 0);
  ok(M1.info.canh.ban_le === tong(M1) && C.cutList(M1).phu_kien.some(x => /^Bản lề/.test(x.ten) && x.sl === tong(M1)), 'bảng kê đếm đúng tổng bản lề', [M1.info.canh.ban_le, tong(M1)]);
  ok(C.cutList(M1).rows.some(r => r.nhom === 'Cánh' && /6 bản lề \/ cánh/.test(r.ghi_chu)), 'dòng cánh ghi "6 bản lề / cánh"');
  ok((C.elevationSVG(M1, { canh: true }).match(/data-ban-le/g) || []).length === tong(M1), 'hình đứng: số chấm bản lề = tổng');
  ok(!M1.warnings.some(w => /bản lề/i.test(w)), 'ép hợp lệ: không báo', M1.warnings);
  { const s2 = JSON.parse(JSON.stringify(s0)); s2.khoang[0].so_ban_le = 1; const M2 = C.build(C.normalize(s2));
    ok(M2.warnings.some(w => /Khoang 1/.test(w) && /tối thiểu 2/.test(w)), 'ép 1: báo kẹp lên 2', M2.warnings); }
  // ---- (1) CÁNH LẬT tủ trên bếp ----
  const t = C.apMau(D, 'BT-CANH-600'), L = C.datLat(t, true);
  ok(t.khoang[0].canh === 2 && L.bep.lat === 1 && L.khoang.every(q => q.canh <= 1), 'bật cánh lật: mỗi khoang MỘT cánh', L.khoang.map(q => q.canh));
  const ML = C.build(L), cl = ML.parts.filter(p => p.loai === 'CANH');
  ok(cl.length === 1 && cl[0].lat && cl[0].ban_le.ben === 'tren' && /lật/i.test(cl[0].ten), 'cánh lật: một tấm phủ cả khoang, bản lề cạnh TRÊN', cl.map(p => [p.ten, p.ban_le]));
  { const p = cl[0], w = p.x1 - p.x0; ok(p.ban_le.so === C.banLeCanh(w, 0, {}).so && p.ban_le.z.every(z => z >= 17.5 && z <= w - 17.5), 'số bản lề theo bề RỘNG cánh, vị trí dọc bề ngang', p.ban_le); }
  ok(cl[0].tay_nang && cl[0].tay_nang.so === 2 && cl[0].tay_nang.nang > 0 && cl[0].tay_nang.lf > 0, 'cánh lật mang tay nâng: 2 cái, nặng + hệ số LF', cl[0].tay_nang);
  { const nang = (cl[0].x1 - cl[0].x0) * (cl[0].z1 - cl[0].z0) * L.van.t_canh / 1e9 * C.KL_VAN; ok(near(cl[0].tay_nang.nang, Math.round(nang * 100) / 100, 0.02) && near(cl[0].tay_nang.lf, Math.round((cl[0].z1 - cl[0].z0) * cl[0].tay_nang.nang), 2), 'nặng = diện tích × dày × 750; LF = cao × nặng', cl[0].tay_nang); }
  const pk = C.cutList(ML).phu_kien;
  ok(pk.some(x => /Tay nâng/.test(x.ten) && x.sl === 2 && /\[CĐ\]/.test(x.ten + x.ghi_chu)), 'bảng kê: dòng tay nâng (2 / cánh, ghi [CĐ])', pk.map(x => x.ten));
  ok(C.cutList(ML).rows.some(r => r.nhom === 'Cánh' && /lật lên/.test(r.ghi_chu) && /tay nâng/.test(r.ghi_chu)), 'dòng cánh ghi "lật lên, … tay nâng"', C.cutList(ML).rows.filter(r => r.nhom === 'Cánh'));
  ok(ML.warnings.some(w => /lật/.test(w) && /cao/.test(w)) && !ML.errors.length, 'tủ trên cao 800 lật: cảnh báo cánh lật cao quá giới hạn tay nâng (chưa lỗi)', ML.warnings);
  ok(!ML.warnings.some(w => /dễ xệ/.test(w)), 'cánh lật không nhận lời "cánh rộng > 600 dễ xệ" của cánh mở ngang');
  { const svg = C.elevationSVG(ML, { canh: true }); ok(/data-lat="1"/.test(svg) && (svg.match(/data-ban-le/g) || []).length === cl[0].ban_le.so, 'hình đứng: ký hiệu cánh lật + chấm bản lề cạnh trên', svg.length); }
  ok(C.keHoachGoc(L).loi.some(x => /lật/.test(x)), 'lệnh gốc: cánh lật → nhập tấm (DOOR mở lên chưa đo)');
  // thấp vừa tay nâng: không cảnh báo cao; rộng quá → cảnh báo / lỗi; nặng quá → lỗi
  const thap = C.datBep(Object.assign(JSON.parse(JSON.stringify(L)), { khoang: L.khoang.map(q => Object.assign({}, q, { dot: [] })) }), { cao_tren: 400 }), MT = C.build(thap);
  ok(thap.bep.lat === 1 && !MT.errors.length && !MT.warnings.some(w => /lật/.test(w)), 'tủ trên cao 400 lật: sạch', [MT.errors, MT.warnings]);
  const rong = w => { const s = JSON.parse(JSON.stringify(thap)); s.rong = w; return C.build(C.normalize(s)); };
  { const M = rong(1000); ok(M.warnings.some(w => /lật/.test(w) && /rộng/.test(w)) && !M.errors.some(e => /lật/.test(e)), 'cánh lật rộng ~1000: cảnh báo', M.warnings); }
  { const M = rong(1300); ok(M.errors.some(e => /lật/.test(e) && /rộng/.test(e)), 'cánh lật rộng ~1300: lỗi', M.errors); }
  { const s = C.datBep(L, { cao_tren: 950 }); s.rong = 1150; const M = C.build(C.normalize(s)); ok(M.errors.some(e => /lật/.test(e)), 'cánh lật 1150 × 950: lỗi (quá cao / quá nặng)', M.errors); }
  // tắt: về số cánh của kiểu ở rộng đó
  { const T0 = C.datLat(L, false); ok(!('lat' in T0.bep) && T0.khoang[0].canh === t.khoang[0].canh, 'tắt cánh lật: bỏ khoá, số cánh về như mẫu', T0.khoang); }
  // chỉ tủ trên có cánh (cánh / giá bát / hút mùi âm)
  for (const ma of ['BD-CANH-600', 'BC-KHO-600', 'BT-KE-300']) ok(!('lat' in C.datLat(C.apMau(D, ma), true).bep), `${ma}: không nhận cánh lật`);
  ok(C.datLat(C.apMau(D, 'BT-BAT-800'), true).bep.lat === 1, 'tủ trên giá bát: nhận cánh lật');
  ok(!('lat' in C.normalize(t).bep), 'tủ trên thường: không có khoá lat');
  // khoang ép số bản lề cho cánh lật
  { const s = JSON.parse(JSON.stringify(thap)); s.khoang[0].so_ban_le = 3; const p = C.build(C.normalize(s)).parts.find(q => q.loai === 'CANH'); ok(p.ban_le.so === 3 && p.ban_le.ben === 'tren', 'cánh lật nhận số bản lề ép', p.ban_le); }
  // ---- Bộ bếp: cánh lật theo CHỖ ----
  { const b = C.chuanBo({ kieu: 'I', canh: [{ dai: 4200 }], tl: null, kinh: 'khong' }), p = C.xepBep(b).pa[0], a1 = p.ds.filter(m => m.tang === 'tren' && !m.t2 && m.chuc === 'canh').sort((x, y) => x.s0 - y.s0)[0];
    ok(!('lat' in b), 'bộ không chọn cánh lật: không có khoá lat');
    const kp = { canh: a1.canh, s: a1.s0 + a1.dai / 2 }, bl = C.chuanBo(Object.assign({}, b, { lat: [kp] }));
    eq(bl.lat, [kp], 'chuanBo giữ chỗ cánh lật');
    const tu = C.tuBo(bl, C.xepBep(bl).pa[0]).filter(x => x.spec.bep.lat);
    eq(tu.map(x => x.vt), [a1.vt], 'cánh lật đúng tủ ở chỗ đó');
    ok(tu.every(x => C.build(x.spec).parts.filter(q => q.loai === 'CANH').every(q => q.lat)), 'tủ đó dựng cánh lật');
    ok(!C.chuanBo({ lat: ['AT1', null, { canh: 0 }] }).lat, 'chỗ lật sai dạng: bỏ');
    // tầng trên kịch trần đứng CÙNG chỗ với tủ trên tầng dưới: chỗ lật mang t2 để không lật cả hai
    const p2 = C.xepBep(bl).pa[0], u = p2.ds.find(m => m.t2 && m.canh === a1.canh && m.s0 <= kp.s && kp.s <= m.s0 + m.dai);
    if (u) { const b2 = C.chuanBo(Object.assign({}, b, { lat: [Object.assign({}, kp, { t2: 1 })] })); eq(C.tuBo(b2, C.xepBep(b2).pa[0]).filter(x => x.spec.bep.lat).map(x => x.vt), [u.vt], 'chỗ lật t2: chỉ tủ tầng trên');
      const M = C.build(C.tuBo(b2, C.xepBep(b2).pa[0]).find(x => x.spec.bep.lat).spec); ok(!M.errors.length && !M.warnings.some(w => /lật/.test(w)), 'tủ tầng trên (thấp) cánh lật: sạch', [M.errors, M.warnings]); }
    else ok(false, 'có tủ tầng trên ở chỗ đó'); }
});

// Vòng soát 1.36.5 (soát đối kháng 16/10/2026): mỗi lỗi một phép thử
T('Bản lề + cánh lật — vòng soát (bản 1.36.5)', () => {
  const k = require.resolve('../src/mncf-core.js'), cu = require.cache[k]; delete require.cache[k]; const C = require(k); require.cache[k] = cu;
  const D = C.DEFAULT_SPEC, J = x => JSON.parse(JSON.stringify(x));
  // (1) bớt / thêm số bản lề trên tủ 2 thân: cánh thân trên (597, tự 2) KHÔNG tăng theo số ép của cánh thân dưới (2047, tự 5)
  const s0 = C.normalize(D), M0 = C.build(s0), so = (M, i) => M.parts.filter(p => p.loai === 'CANH' && p.khoang === i && p.ban_le).map(p => [Math.round(p.z1 - p.z0), p.ban_le.so]);
  eq(so(M0, 0), [[2047, 5], [2047, 5], [597, 2], [597, 2]], 'tủ mặc định khoang 1: 5 / 2 tự tính');
  for (const [v, chinh, phu] of [[4, 4, 2], [3, 3, 2], [2, 2, 2], [6, 6, 2]]) {
    const s = J(s0); s.khoang[0].so_ban_le = v; const M = C.build(C.normalize(s));
    eq(so(M, 0), [[2047, chinh], [2047, chinh], [597, phu], [597, phu]], `ép ${v}: cánh chính ${chinh}, cánh thân trên ${phu}`);
    if (v < 5) ok(M.info.canh.ban_le < M0.info.canh.ban_le, `bớt (ép ${v}) thì tổng bản lề GIẢM`, [M.info.canh.ban_le, M0.info.canh.ban_le]);
  }
  // cánh thấp có số tự tính LỚN hơn số ép (ép 2 khi cánh thấp tự 3): không vượt số ép
  { const s = J(s0); s.than.cao_duoi = 1500; s.khoang[0].so_ban_le = 2; const M = C.build(C.normalize(s)), x = so(M, 0);
    ok(x.every(([, n]) => n <= 2), 'cánh nào cũng không vượt số ép', x); }
  // (2) Bộ bếp: bật cánh lật ở một chỗ KHÔNG chia lại dãy (như cánh kính) — tủ ở chỗ đó lật, lỗi tay nâng (nếu có) nằm ở phương án, không loại phương án
  const b = C.chuanBo({ kieu: 'I', canh: [{ dai: 4200 }], tl: null, kinh: 'khong' }), r0 = C.xepBep(b);
  const moc = pa => JSON.stringify(pa.ds.map(m => [m.vt, m.ma, m.canh, m.s0, m.tang]));
  for (const vt of ['AT1', 'AT2', 'AT3', 'AT5']) {
    const m = r0.pa[0].ds.find(q => q.vt === vt), bl = C.chuanBo(Object.assign({}, b, { lat: [{ canh: m.canh, s: m.s0 + m.dai / 2 }] })), r = C.xepBep(bl);
    eq(r.pa.map(moc), r0.pa.map(moc), `${vt} (${m.ma}) cánh lật: dãy giữ nguyên mọi phương án`);
    const lat = C.tuBo(bl, r.pa[0]).filter(t => t.spec.bep.lat).map(t => t.vt);
    const nhan = C.latNhanBo(m);
    eq(lat, nhan ? [vt] : [], `${vt}: cánh lật đúng tủ ở chỗ đó (hoặc không tủ nào khi tủ đó không nhận lật)`);
    const ll = C.latLoi(b, r0.pa[0], m);
    ok(Array.isArray(ll), 'latLoi trả danh sách', ll);
    if (ll.length) ok(r.pa[0].loi.some(x => /lật/.test(x)), `${vt} lật lỗi: phương án mang lỗi cánh lật (dòng đỏ)`, r.pa[0].loi);
    else ok(!r.pa[0].loi.length, `${vt} lật được: phương án sạch`, r.pa[0].loi);
  }
  { const m1 = r0.pa[0].ds.find(q => q.vt === 'AT1'), m5 = r0.pa[0].ds.find(q => q.vt === 'AT5');
    ok(!C.latLoi(b, r0.pa[0], m1).length, 'AT1 (300) lật được: không lỗi');
    ok(C.latLoi(b, r0.pa[0], m5).some(x => /tay nâng/.test(x)), 'AT5 giá bát 900 lật: lỗi tay nâng', C.latLoi(b, r0.pa[0], m5)); }
  // (3) tủ hút mùi kính (BT-HMK) / kệ / góc: không nhận lật — mặt đứng / ô chọn dựa vào latNhanBo
  { const bk = C.chuanBo(Object.assign({}, b, { hm: 'kinh' })), p = C.xepBep(bk).pa[0], hmk = p.ds.find(q => /^BT-HMK/.test(q.ma));
    ok(hmk && !C.latNhanBo(hmk), 'BT-HMK: không nhận cánh lật', hmk && hmk.ma);
    ok(C.latNhanBo(r0.pa[0].ds.find(q => q.vt === 'AT2')), 'BT-HM (hút mùi âm): nhận cánh lật'); }
  // (4) chip chức năng (bepTheoKieu) giữ cánh lật khi tủ mới vẫn lật được
  { const L = C.datLat(C.apMau(D, 'BT-CANH-600'), true);
    ok(C.bepTheoKieu(L, 'bat').bep.lat === 1, 'cánh → giá bát: giữ cánh lật');
    ok(C.bepTheoKieu(L, 'canh').bep.lat === 1 && C.bepTheoKieu(L, 'canh').khoang.every(q => q.canh <= 1), 'bấm lại chip cánh: vẫn lật, một cánh');
    ok(!('lat' in C.bepTheoKieu(L, 'ke').bep), 'sang kệ hở: bỏ cánh lật (kệ không cánh)');
    // tủ không lật: bepTheoKieu y như trước (không thêm khoá)
    ok(!('lat' in C.bepTheoKieu(C.apMau(D, 'BT-CANH-600'), 'bat').bep), 'tủ không lật: không thêm khoá'); }
});

console.log(`\n${pass} đạt, ${fail} hỏng`);
process.exit(fail ? 1 : 0);
