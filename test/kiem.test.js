'use strict';
// Dò lỗi sản xuất (Node thuần, không cần thư viện):  node test/kiem.test.js
// Phần 1: quy tắc lúc thiết kế (trước khi vẽ) + phiếu kiểm.  Phần 2: hình học lỗ khoan / mối nối của tấm thật (sau khi vẽ).
const C = require('../src/mncf-core.js');
let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) { pass++; } else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); } };
const eq = (a, b, name) => ok(JSON.stringify(a) === JSON.stringify(b), name, { got: a, want: b });
const T = (name, fn) => { const f0 = fail; try { fn(); } catch (e) { fail++; console.log('  ✗', name, '— ném lỗi:', e.message); } console.log((fail === f0 ? '✓ ' : '✗ ') + name); };
const kq = (M, ma, muc) => (M.kq || []).filter(k => k.ma === ma && (!muc || k.muc === muc));
const muc = (p, ma) => (p.muc || []).find(m => m.ma === ma) || {};

/* ---------- 1. Quy tắc lúc thiết kế ---------- */

T('Nhịp đợt: khoang lọt lòng quá ngưỡng thì cảnh báo võng (chuẩn kết cấu mục 1: không quá 1000)', () => {
  // 2400 − phào 50 × 2 − 2 hồi − chỗ tách thùng (2 hồi áp lưng) = 2230 → khoang 1 gõ 1100, khoang 2 còn 1130
  const spec = { ma: 'T', rong: 2400, cao: 2200, than: { cao_duoi: 0 }, khoang: [{ rong: 1100, canh: 0, dot: [1100] }, { rong: 'auto', canh: 0, dot: [1100] }] };
  const M = C.build(spec);
  eq(M.errors, [], 'tủ vẫn dựng được (nhịp dài là cảnh báo, không khoá nút vẽ)');
  eq(M.info.khoang, [1100, 1130], 'lọt lòng 2 khoang');
  const w = kq(M, 'nhip', 'luu_y');
  ok(w.length === 2, 'mỗi khoang quá ngưỡng một cảnh báo', w);
  ok(w.length === 2 && /Khoang 1\b/.test(w[0].t) && /1100/.test(w[0].t) && /1000/.test(w[0].t), 'cảnh báo ghi khoang, lọt lòng và ngưỡng', w[0]);
  ok(w.length === 2 && /Khoang 2\b/.test(w[1].t) && /1130/.test(w[1].t), 'khoang 2 ghi 1130', w[1]);
  ok(w.every(k => M.warnings.includes(k.t)), 'cảnh báo nằm trong M.warnings (bảng hiện màu vàng)');
  eq(kq(C.build(Object.assign({}, spec, { kiem: { dot_max: 1200 } })), 'nhip').length, 0, 'xưởng nâng ngưỡng lên 1200 thì hết cảnh báo');
  eq(kq(C.build(Object.assign({}, spec, { kiem: { dot_max: 0 } })), 'nhip').length, 0, 'ngưỡng 0 = không kiểm mục này');
  eq(kq(C.build(), 'nhip').length, 0, 'tủ mẫu 3000 (khoang ~945) không bị cảnh báo');
  const coSuot = kq(C.build({ ma: 'T', rong: 1235, cao: 2200, than: { cao_duoi: 0 }, khoang: [{ rong: 'auto', canh: 0, dot: [1900], o: [{ tu: 0, kieu: 'suot' }] }] }), 'nhip', 'luu_y');      // lọt lòng 1100
  ok(coSuot.length === 1 && /1100/.test(coSuot[0].t) && /suốt/.test(coSuot[0].t), 'khoang có suốt treo: lời cảnh báo nhắc cả suốt', coSuot);
  ok(!/suốt/.test(w[0] ? w[0].t : 'suốt'), 'khoang không có suốt: không nhắc suốt', w[0]);
});

T('Cánh quá cao thì cảnh báo cong vênh', () => {
  // một thân, không phào đứng: cánh từ chân 100 + khe 2 tới dưới phào trên 50 − khe 2 → 2490 − 52 − 102 = 2336
  const spec = { ma: 'T', rong: 1000, cao: 2490, than: { cao_duoi: 0 }, phao: { trai: 0, phai: 0, tren: 50 }, khoang: [{ rong: 'auto', canh: 2, dot: [1200] }] };
  const M = C.build(spec);
  eq(M.errors, [], 'dựng được');
  eq(M.info.canh.cao, [2336], 'cánh cao 2336');
  const w = kq(M, 'canh', 'luu_y').filter(k => /cao/.test(k.t));
  ok(w.length === 1 && /2336/.test(w[0].t) && /2300/.test(w[0].t), 'một cảnh báo ghi chiều cao cánh và ngưỡng', w);
  eq(kq(C.build(Object.assign({}, spec, { cao: 2400 })), 'canh', 'luu_y').filter(k => /cao/.test(k.t)).length, 0, 'cánh 2246 (tủ một thân 2400) không cảnh báo');
  eq(kq(C.build(Object.assign({}, spec, { kiem: { canh_cao_max: 2400 } })), 'canh', 'luu_y').filter(k => /cao/.test(k.t)).length, 0, 'ngưỡng 2400 thì 2336 không cảnh báo');
});

T('Ngăn kéo quá rộng thì cảnh báo (mỗi khoang một lần, không phải mỗi ngăn)', () => {
  // 1285 − phào 100 − 2 hồi 35 = 1150 lọt lòng; ngăn kéo âm trừ 2 vách đệm 50 → hộp rộng 1050
  const spec = { ma: 'T', rong: 1285, cao: 2200, than: { cao_duoi: 0 }, khoang: [{ rong: 'auto', canh: 2, dot: [570], o: [{ tu: 0, kieu: 'nk_am', so: 2 }] }] };
  const M = C.build(spec);
  eq(M.errors, [], 'dựng được');
  eq(M.templates.filter(t => t.loai === 'NGAN_KEO').map(t => t.box[0]), [1050, 1050], '2 hộp ngăn kéo rộng 1050');
  const w = kq(M, 'ngan_keo', 'luu_y').filter(k => /rộng/.test(k.t));
  ok(w.length === 1 && /1050/.test(w[0].t) && /1000/.test(w[0].t), 'một cảnh báo cho cả khoang', w);
  const M2 = C.build(Object.assign({}, spec, { rong: 1235 }));      // lọt lòng 1100 → hộp 1000: đúng ngưỡng, chưa vượt
  eq(M2.templates.filter(t => t.loai === 'NGAN_KEO').map(t => t.box[0]), [1000, 1000], 'hộp 1000');
  eq(kq(M2, 'ngan_keo', 'luu_y').filter(k => /rộng/.test(k.t)).length, 0, 'đúng bằng ngưỡng thì không cảnh báo');
});

T('Khoang treo quá nông thì cảnh báo móc áo chạm cánh', () => {
  const nong = { ma: 'T', rong: 1000, cao: 2200, sau_thung: 450, hau: { t: 6 }, than: { cao_duoi: 0 }, khoang: [{ rong: 'auto', canh: 2, dot: [1900], o: [{ tu: 0, kieu: 'suot' }] }] };      // 450 − hậu 6 = 444
  const M = C.build(nong);
  eq(M.errors, [], 'dựng được');
  const w = kq(M, 'suot', 'luu_y');
  ok(w.length === 1 && /444/.test(w[0].t) && /480/.test(w[0].t), 'khoang treo sâu 444 < 480', w);
  eq(kq(C.build(Object.assign({}, nong, { sau_thung: 486 })), 'suot', 'luu_y').length, 0, 'sâu 480 không cảnh báo');
  eq(kq(C.build(Object.assign({}, nong, { kiem: { suot_sau_min: 0 } })), 'suot', 'luu_y').length, 0, 'ngưỡng 0 = không kiểm');
  // khoang nông nhưng không treo đồ (chỉ có đợt) thì không liên quan
  eq(kq(C.build(Object.assign({}, nong, { khoang: [{ rong: 'auto', canh: 2, dot: [600, 1200] }] })), 'suot').length, 0, 'khoang chỉ có đợt: không cảnh báo');
});

T('Biết chiều cao trần: thân tủ lật đứng không lọt trần thì cảnh báo, tủ cao hơn trần là lỗi', () => {
  // thân 0 … 2350 (2400 − phào trên 50), sâu 580 → đường chéo √(2350² + 580²) = 2420,5 > trần 2400; thân cao nhất lật được = √(2400² − 580²) = 2328
  const spec = { ma: 'T', rong: 1000, cao: 2400, than: { cao_duoi: 0 }, kiem: { tran: 2400 }, khoang: [{ rong: 'auto', canh: 2, dot: [1200] }] };
  const M = C.build(spec);
  eq(M.errors, [], 'vẫn dựng được');
  const w = kq(M, 'than', 'luu_y');
  ok(w.length === 1 && /2421/.test(w[0].t) && /2400/.test(w[0].t) && /2328/.test(w[0].t), 'ghi đường chéo, trần và chiều cao thân lật được', w);
  eq(kq(C.build(Object.assign({}, spec, { than: { cao_duoi: 2200 } })), 'than', 'luu_y').length, 0, 'chia thân dưới 2200 (chéo 2275) thì lọt');
  eq(kq(C.build(Object.assign({}, spec, { kiem: { tran: 0 } })), 'than').length, 0, 'không khai trần thì không kiểm');
  const M3 = C.build(Object.assign({}, spec, { kiem: { tran: 2300 } }));
  ok(M3.errors.length === 1 && kq(M3, 'than', 'loi').length === 1 && /2400/.test(M3.errors[0]) && /2300/.test(M3.errors[0]), 'tủ 2400 dưới trần 2300 là lỗi', M3.errors);
});

T('Tấm lơ lửng / đợt thiếu chỗ tì (hàm thuần trên danh sách tấm)', () => {
  const dung = (x0, ten) => ({ ten, loai: 'HOI', type: 1, x0, x1: x0 + 18, y0: 0, y1: 500, z0: 0, z1: 1000 });
  const dot = (x0, x1, z0, ten) => ({ ten, loai: 'DOT', type: 0, x0, x1, y0: 0, y1: 500, z0, z1: z0 + 18 });
  const tot = [dung(0, 'Hồi trái'), dung(500, 'Hồi phải'), dot(18, 500, 400, 'Đợt')];
  eq(C.kiemLienKet(tot), [], 'đợt lọt giữa 2 hồi: không có gì để báo');
  const ngan = C.kiemLienKet([dung(0, 'Hồi trái'), dung(500, 'Hồi phải'), dot(18, 400, 400, 'Đợt ngắn')]);
  // đợt hụt 100: đầu phải của đợt không có chỗ tì, và hồi phải không còn tấm nào áp vào nên cũng lơ lửng
  eq(ngan, [{ tam: 1, ma: 'lo_lung' }, { tam: 2, ma: 'thieu_do', ben: 'phai' }], 'đợt hụt 100 không chạm hồi phải');
  const le = C.kiemLienKet(tot.concat([dung(1000, 'Tấm lạc')]));
  ok(le.length === 1 && le[0].tam === 3 && le[0].ma === 'lo_lung', 'tấm đứng riêng một chỗ là tấm lơ lửng', le);
  // hậu mỏng ăn vào rãnh 6 mm của 2 hồi: không áp mặt ngoài vào đâu nhưng nằm TRONG rãnh → không phải lơ lửng
  const hauRanh = { ten: 'Hậu', loai: 'HAU', type: 2, x0: 12, x1: 506, y0: 470, y1: 475, z0: 0, z1: 1000 };
  eq(C.kiemLienKet([dung(0, 'Hồi trái'), dung(500, 'Hồi phải'), hauRanh]), [], 'hậu soi rãnh nằm trong rãnh của 2 hồi: không lơ lửng');
  const cham = C.kiemLienKet([dung(0, 'A'), dot(18, 500, 400, 'Đợt một đầu')]);
  ok(cham.length === 1 && cham[0].ma === 'thieu_do' && cham[0].ben === 'phai', 'đợt chỉ có một đầu tì', cham);
});

T('Tủ dựng từ bảng không bao giờ có tấm lơ lửng (mọi mẫu tủ áo, tách thùng, khấu cột, ngăn kéo trùm ngoài, các kiểu hậu)', () => {
  const ds = [['mặc định', undefined]];
  for (const m of C.MAU_TU) ds.push([m.ma, C.apMau({}, m.ma)]);
  ds.push(['khấu cột trái + giữa', { ma: 'K', rong: 2400, cao: 2200, than: { cao_duoi: 0 }, khau: { trai: { rong: 300, sau: 250 }, giua: [{ cach: 1300, rong: 250, sau: 200 }] }, khoang: [{ rong: 'auto', canh: 2, dot: [800, 1500] }, { rong: 'auto', canh: 2, dot: [800, 1500] }, { rong: 'auto', canh: 2, dot: [800, 1500] }] }]);
  ds.push(['ngăn kéo trùm ngoài', { ma: 'N', rong: 900, cao: 2200, than: { cao_duoi: 0 }, khoang: [{ rong: 'auto', canh: 2, dot: [600, 1300], o: [{ tu: 0, kieu: 'nk_trum', so: 3 }] }] }]);
  ds.push(['hậu dày', { hau: { kieu: 'day' } }]);
  ds.push(['hậu soi rãnh', { hau: { kieu: 'mong' } }]);
  ds.push(['không phào, không chân', { ma: 'P', rong: 1200, cao: 800, than: { cao_duoi: 0 }, phao: { trai: 0, phai: 0, tren: 0 }, chan: { cao: 0 }, khoang: [{ rong: 'auto', canh: 0, dot: [400] }, { rong: 'auto', canh: 1, dot: [400] }] }]);
  for (const [ten, s] of ds) {
    const M = C.build(s);
    ok(M.info.so_tam > 0, `${ten}: dựng xong`, M.errors);
    eq(kq(M, 'lien_ket'), [], `${ten}: không tấm nào lơ lửng`);
    eq(muc(C.phieu(M), 'lien_ket').ket, 'dat', `${ten}: mục "không lơ lửng" đã được kiểm và đạt`);
  }
});

/* ---------- 2. Phiếu kiểm ---------- */

T('Phiếu kiểm: tủ mẫu đạt mọi mục áp dụng; mục không liên quan thì ghi "không áp dụng"', () => {
  const M = C.build(), p = C.phieu(M);
  ok(p.dat === true && p.xong === true, 'đạt, đã kiểm hết', [p.dat, p.xong]);
  for (const ma of ['kich_thuoc', 'than', 'kho_van', 'va_cham', 'lien_ket', 'nhip', 'dot', 'canh', 'ngan_keo', 'suot', 'hau', 'phao_chan', 'mau'])
    ok(muc(p, ma).ket === 'dat' && typeof muc(p, ma).ten === 'string' && muc(p, ma).ten.length > 0, `mục ${ma}: đạt, có tên`, muc(p, ma));
  eq(muc(p, 'khau').ket, 'khong', 'tủ không khấu cột → mục khấu cột không áp dụng');
  eq(p.dem, { dat: 13, luu_y: 0, loi: 0, chua: 0 }, 'đếm theo kết quả');
  const hoHet = C.phieu(C.build({ ma: 'H', rong: 1000, cao: 800, than: { cao_duoi: 0 }, khoang: [{ rong: 'auto', canh: 0, dot: [400] }] }));
  eq(['canh', 'ngan_keo', 'suot', 'mau'].map(ma => muc(hoHet, ma).ket), ['khong', 'khong', 'khong', 'khong'], 'tủ hở không cánh, không ngăn kéo, không suốt: 4 mục đó không áp dụng');
});

T('Phiếu kiểm: cảnh báo vào đúng mục, lỗi làm phiếu không đạt, dừng sớm thì các mục sau ghi "chưa kiểm"', () => {
  const pNhip = C.phieu(C.build({ ma: 'T', rong: 2400, cao: 2200, than: { cao_duoi: 0 }, khoang: [{ rong: 1100, canh: 0, dot: [1100] }, { rong: 'auto', canh: 0, dot: [1100] }] }));
  ok(pNhip.dat === true && muc(pNhip, 'nhip').ket === 'luu_y' && muc(pNhip, 'nhip').tin.length === 2 && muc(pNhip, 'kho_van').ket === 'dat', 'nhịp dài: mục nhịp lưu ý (2 dòng), phiếu vẫn đạt', muc(pNhip, 'nhip'));
  // khoang 1465 lọt lòng, không vách: tấm hậu rộng 1498 > khổ ván 1220
  const pKho = C.phieu(C.build({ ma: 'T', rong: 1500, cao: 2200, than: { cao_duoi: 0 }, phao: { trai: 0, phai: 0, tren: 0 }, chan: { cao: 0 }, khoang: [{ rong: 'auto', canh: 0 }] }));
  ok(pKho.dat === false && muc(pKho, 'kho_van').ket === 'loi' && muc(pKho, 'kho_van').tin.some(t => /1498/.test(t)), 'tấm hậu 1498 vượt khổ: mục khổ ván lỗi', muc(pKho, 'kho_van'));
  eq(muc(pKho, 'va_cham').ket, 'dat', 'các mục khác vẫn được kiểm');
  const pSom = C.phieu(C.build({ rong: 60 }));      // còn 60 − phào 100 < 0: lõi dừng ngay
  ok(pSom.dat === false && pSom.xong === false && muc(pSom, 'kich_thuoc').ket === 'loi', 'lỗi phủ bì', muc(pSom, 'kich_thuoc'));
  eq(['kho_van', 'va_cham', 'lien_ket', 'nhip'].map(ma => muc(pSom, ma).ket), ['chua', 'chua', 'chua', 'chua'], 'chưa dựng được tủ thì các mục sau là "chưa kiểm", không phải "đạt"');
});

/* ---------- 3. Tấm và lỗ khoan THẬT sau khi vẽ (hàm thuần; dữ liệu theo đúng quy ước đo trên Chenfeng 04/10/2026) ----------
 * Lỗ: p = miệng lỗ, d = hướng khoan vào ván (đơn vị), dai = sâu, r = bán kính, nhom = mã liên kết (3 lỗ của một cam chung nhóm).
 * Một cam: lỗ chén Ø12 sâu 13,5 ở MẶT tấm đực · lỗ thân Ø8 dài 34 từ tâm chén ra CẠNH tấm đực · lỗ mồi Ø5 sâu 13,5 ở MẶT tấm cái. */
const cam = (nhom, x, y, z) => [      // đợt (tấm đực) bên phải hồi trái: mép đợt tại x, mặt trên đợt tại z
  { p: [x + 34, y, z], d: [0, 0, -1], dai: 13.5, r: 6, nhom },
  { p: [x + 34, y, z - 8.75], d: [-1, 0, 0], dai: 34, r: 4, nhom },
  { p: [x, y, z - 8.75], d: [-1, 0, 0], dai: 13.5, r: 2.5, nhom }];

T('Lỗ khoan giao nhau: lỗ khác nhóm cắt vào nhau là lỗi; cùng nhóm hoặc đồng trục (lỗ xuyên khoan từ hai mặt) thì không', () => {
  eq(C.kiemLoGiao(cam(1, 67.5, 50, 517.5)), [], '3 lỗ của một cam cắt nhau là đúng cấu tạo');
  // vách dày 17,5 (x 500 … 517,5): lỗ mồi Ø5 sâu 13,5 từ hai mặt
  const trai = (z, nhom) => ({ p: [500, 50, z], d: [1, 0, 0], dai: 13.5, r: 2.5, nhom });
  const phai = (z, nhom, dai) => ({ p: [517.5, 50, z], d: [-1, 0, 0], dai: dai || 13.5, r: 2.5, nhom });
  eq(C.kiemLoGiao([trai(600, 1), phai(600, 2)]), [], 'hai lỗ mồi đối đầu cùng trục: lỗ xuyên, không báo');
  const g = C.kiemLoGiao([trai(600, 1), phai(604, 2)]);
  eq(g, [{ a: 0, b: 1, kieu: 'song_song', cach: 4 }], 'lệch trục 4 mm (< 2,5 + 2,5) và chồng nhau theo chiều sâu: giao nhau');
  eq(C.kiemLoGiao([trai(600, 1), phai(606, 2)]), [], 'lệch trục 6 mm: không chạm');
  eq(C.kiemLoGiao([trai(600, 1), phai(604, 2, 3)]), [], 'lệch 4 mm nhưng lỗ bên kia chỉ sâu 3 (không tới): không giao');
  eq(C.kiemLoGiao([trai(600, 7), phai(604, 7)]), [], 'cùng nhóm thì không xét');
  // vuông góc: lỗ thân Ø8 chạy dọc x (0 … 34) ở z = 100; lỗ chén Ø12 khoan từ trên xuống tại x = 20
  const than = { p: [0, 50, 100], d: [1, 0, 0], dai: 34, r: 4, nhom: 1 };
  const chen = (y, z, dai, nhom) => ({ p: [20, y, z], d: [0, 0, -1], dai, r: 6, nhom });
  const v = C.kiemLoGiao([than, chen(50, 120, 30, 2)]);
  ok(v.length === 1 && v[0].a === 0 && v[0].b === 1 && v[0].kieu === 'cat_nhau', 'lỗ khoan từ trên xuống xuyên qua lỗ thân của nhóm khác', v);
  eq(C.kiemLoGiao([than, chen(62, 120, 30, 2)]), [], 'lệch ngang 12 (> 4 + 6): không chạm');
  eq(C.kiemLoGiao([than, chen(50, 120, 10, 2)]), [], 'lỗ từ trên chỉ xuống tới z 110, lỗ thân lên tới 104: không chạm');
  eq(C.kiemLoGiao([than, chen(59.99, 120, 30, 2)]), [], 'hai mép lỗ chỉ vừa sát nhau (cách tim 9,99 ≈ 4 + 6): không tính');
  // nhiều lỗ: chỉ báo đúng cặp giao, chỉ số theo danh sách đưa vào
  const ds = cam(1, 67.5, 50, 517.5).concat(cam(2, 67.5, 524, 517.5), [trai(600, 3), phai(603, 4)]);
  eq(C.kiemLoGiao(ds).map(q => [q.a, q.b]), [[6, 7]], 'trong 8 lỗ chỉ một cặp giao');
});

T('Mối nối không có liên kết: cạnh tấm tì trọn bề dày lên mặt tấm khác, dài từ 100 trở lên, hai tấm đều có kiểu khoan mà không có cam nào nối', () => {
  const tam = [
    { hop: [0, 17.5, 0, 500, 0, 1000], khoan: true },        // 0 hồi trái
    { hop: [500, 517.5, 0, 500, 0, 1000], khoan: true },     // 1 hồi phải
    { hop: [17.5, 500, 0, 500, 400, 417.5], khoan: true }];  // 2 đợt
  eq(C.kiemMoiNoi(tam, [{ cai: 0, duc: 2 }, { cai: 1, duc: 2 }]), [], 'đợt có cam ở cả hai đầu');
  eq(C.kiemMoiNoi(tam, [{ cai: 0, duc: 2 }]), [{ duc: 2, cai: 1, dai: 500 }], 'đầu phải của đợt không có cam nào');
  eq(C.kiemMoiNoi(tam, []), [{ duc: 2, cai: 0, dai: 500 }, { duc: 2, cai: 1, dai: 500 }], 'đợt không bắt vào đâu: báo cả hai đầu');
  // hậu 6 li phủ sau (không khoan): mép sau của hồi, đợt tì lên mặt hậu nhưng hậu bắn đinh → không báo
  const coHau = tam.concat([{ hop: [0, 517.5, 500, 506, 0, 1000], khoan: false }]);
  eq(C.kiemMoiNoi(coHau, [{ cai: 0, duc: 2 }, { cai: 1, duc: 2 }]), [], 'tấm cái không có kiểu khoan (hậu bắn đinh): không báo');
  // hậu DÀY 18 có kiểu khoan, lọt giữa hai hồi (mẫu kho đo trên Chenfeng 04/10/2026 — 16 chỗ báo nhầm): đợt đã bắt cam ở HAI ĐẦU thì đã được giữ, mép sau tì lên mặt hậu không cần liên kết
  const tuHau = [
    { hop: [0, 17.5, 0, 500, 0, 1000], khoan: true },          // 0 hồi trái
    { hop: [500, 517.5, 0, 500, 0, 1000], khoan: true },       // 1 hồi phải
    { hop: [17.5, 500, 0, 482, 400, 417.5], khoan: true },     // 2 đợt sâu 482
    { hop: [17.5, 500, 482, 500, 0, 1000], khoan: true }];     // 3 hậu dày 18 lọt giữa hai hồi, bắt cam vào hai hồi
  const camHau = [{ cai: 0, duc: 3 }, { cai: 1, duc: 3 }];
  eq(C.kiemMoiNoi(tuHau, [{ cai: 0, duc: 2 }, { cai: 1, duc: 2 }].concat(camHau)), [], 'đợt đã bắt hai đầu: mép sau tì lên hậu dày không báo');
  // đợt chỉ bắt một đầu thì chưa được giữ: đầu còn lại và mép sau đều được nêu
  eq(C.kiemMoiNoi(tuHau, [{ cai: 0, duc: 2 }].concat(camHau)).map(q => [q.duc, q.cai]), [[2, 1], [2, 3]], 'đợt chỉ bắt một đầu: báo đầu kia và mép sau');
  // hai liên kết ở hai cạnh KỀ nhau (đầu trái + mép sau) chưa phải là giữ hai đầu: đầu phải vẫn bị báo
  eq(C.kiemMoiNoi(tuHau, [{ cai: 0, duc: 2 }, { cai: 3, duc: 2 }].concat(camHau)).map(q => [q.duc, q.cai]), [[2, 1]], 'bắt đầu trái và mép sau, hở đầu phải: báo đầu phải');
  // tấm cái KHOÉT GÓC (đáy thân trên của tủ khấu cột — đo trên Chenfeng 04/10/2026: 2 chỗ báo nhầm): đầu vách khấu của thân dưới nằm đúng dưới chỗ đã khoét của đáy thân trên → không có mặt ván nào để tì
  const dayKhoet = { hop: [0, 723.5, 0, 574, 1000, 1017.5], khoan: true, bao: [[0, 0], [723.5, 0], [723.5, 297.5], [458.5, 297.5], [458.5, 574], [0, 574]] };
  const vachDuoi = { hop: [458.5, 476, 297.5, 574, 0, 1000], khoan: true };      // đầu trên (z = 1000) nằm trong vùng khoét của đáy
  eq(C.kiemMoiNoi([dayKhoet, vachDuoi], []), [], 'cạnh tấm tì vào đúng chỗ đã khoét của tấm cái: không phải mối nối');
  eq(C.kiemMoiNoi([{ hop: dayKhoet.hop, khoan: true }, vachDuoi], []), [{ duc: 1, cai: 0, dai: 276.5 }], 'đối chứng — tấm cái không khoét: là mối nối dài 276,5 không có liên kết');
  // vách lấn một nửa chiều dài sang phần còn ván: chỉ tính đoạn tì thật (138 ≥ 100 thì báo, ghi đúng chiều dài thật)
  eq(C.kiemMoiNoi([dayKhoet, { hop: [300, 317.5, 160, 574, 0, 1000], khoan: true }], []), [{ duc: 1, cai: 0, dai: 414 }], 'vách nằm dưới phần còn ván: tính đủ chiều dài');
  eq(C.kiemMoiNoi([dayKhoet, { hop: [458.5, 476, 160, 574, 0, 1000], khoan: true }], []), [{ duc: 1, cai: 0, dai: 137.5 }], 'vách nửa dưới ván, nửa dưới chỗ khoét: chỉ tính đoạn tì thật 137,5');
  // xà ngăn kéo cao 47 tì đầu vào vách đệm: mối nối ngắn hơn 100 → bắn đinh / vít, không báo
  const xa = tam.concat([{ hop: [17.5, 500, 100, 117.5, 600, 647], khoan: true }]);
  eq(C.kiemMoiNoi(xa, [{ cai: 0, duc: 2 }, { cai: 1, duc: 2 }]), [], 'mối nối ngắn 47 (< 100): không báo');
  eq(C.kiemMoiNoi(xa, [{ cai: 0, duc: 2 }, { cai: 1, duc: 2 }], { dai_min: 40 }).map(q => [q.duc, q.cai, q.dai]), [[3, 0, 47], [3, 1, 47]], 'hạ ngưỡng còn 40 thì báo cả 2 đầu xà');
  // xà chân chỉ tì 8,75 lên chân vách (nửa bề dày): không phải mối nối trọn
  const chan = [{ hop: [0, 17.5, 0, 500, 0, 1000], khoan: true }, { hop: [8.75, 400, -17.5, 0, 0, 100], khoan: true }];
  eq(C.kiemMoiNoi(chan, []), [], 'cạnh hồi chỉ tì nửa bề dày lên xà chân: không tính');
  // 2 hồi áp lưng (chỗ tách thùng): mặt áp mặt, không phải mối nối cạnh – mặt
  eq(C.kiemMoiNoi([{ hop: [0, 17.5, 0, 500, 0, 1000], khoan: true }, { hop: [17.5, 35, 0, 500, 0, 1000], khoan: true }], []), [], 'hai tấm áp mặt vào nhau: không báo');
});

T('Va chạm giữa các tấm thật: tấm đè nhau là lỗi; tấm mỏng ăn rãnh và tấm cùng một mẫu thì không', () => {
  const A = { hop: [0, 17.5, 0, 500, 0, 1000], day: 17.5 }, B = { hop: [10, 400, 0, 500, 400, 417.5], day: 17.5 };      // đợt đâm 7,5 vào hồi
  eq(C.kiemVaCham([A, B]), [{ a: 0, b: 1, chong: [7.5, 500, 17.5] }], 'đợt đâm vào hồi 7,5');
  eq(C.kiemVaCham([A, { hop: [17.5, 400, 0, 500, 400, 417.5], day: 17.5 }]), [], 'áp sát mặt: không va chạm');
  eq(C.kiemVaCham([A, { hop: [11.5, 400, 480, 485, 0, 1000], day: 5 }]), [], 'hậu mỏng 5 li ăn rãnh 6 vào hồi: đúng cấu tạo');
  eq(C.kiemVaCham([A, { hop: [5, 400, 480, 485, 0, 1000], day: 5 }]).length, 1, 'tấm mỏng đâm sâu 12,5 (> 9): là va chạm');
  eq(C.kiemVaCham([Object.assign({ mau: 'M1' }, A), Object.assign({ mau: 'M1' }, B)]), [], 'hai tấm của cùng một mẫu (hộp ngăn kéo lồng mộng): mẫu tự chịu');
  eq(C.kiemVaCham([Object.assign({ mau: 'M1' }, A), Object.assign({ mau: 'M2' }, B)]).length, 1, 'khác mẫu thì vẫn báo');
  // hai tấm TRÙNG nhau (chép đè lên nhau): luôn báo, kể cả cùng một mẫu — xuất file cắt sẽ ra thừa một tấm
  eq(C.kiemVaCham([Object.assign({ mau: 'M1' }, A), Object.assign({ mau: 'M1' }, A, { hop: A.hop.slice() })]), [{ a: 0, b: 1, chong: [17.5, 500, 1000], trung: true }], 'hai tấm trùng khít: báo và đánh dấu là trùng');
  eq(C.kiemVaCham([A, { hop: [0, 17.5, 0, 500, 0, 999], day: 17.5 }])[0].trung, undefined, 'gần trùng nhưng lệch 1 mm: là đè nhau, không gọi là trùng');
});

T('Tấm khoét góc (khấu cột), tấm bo cong: va chạm xét theo ĐƯỜNG BAO thật của tấm, không theo hộp bao', () => {
  // số đo trên Chenfeng 04/10/2026 (tủ khấu cột bên phải): đáy 723,5 × 574 khoét góc sau – phải 265 × 276,5.
  // bao = đường bao trong mặt phẳng tấm, toạ độ theo hai trục còn lại của hộp (tấm nằm: [x, y])
  const bao = [[0, 0], [723.5, 0], [723.5, 297.5], [458.5, 297.5], [458.5, 574], [0, 574]];
  const day = { hop: [0, 723.5, 0, 574, 100, 117.5], day: 17.5, bao };
  const vachKhau = { hop: [458.5, 476, 297.5, 574, 0, 2200], day: 17.5 };      // vách đứng dọc mặt bên cột: nằm gọn trong góc đã khoét
  eq(C.kiemVaCham([day, vachKhau]), [], 'tấm đứng trong góc đã khoét: không va chạm');
  eq(C.kiemVaCham([{ hop: day.hop, day: 17.5 }, vachKhau]).length, 1, 'cùng hai hộp đó mà tấm KHÔNG khoét: va chạm (đối chứng)');
  eq(C.kiemVaCham([day, { hop: [200, 217.5, 100, 400, 0, 2200], day: 17.5 }]).map(q => q.chong), [[17.5, 300, 17.5]], 'tấm đứng xuyên qua phần còn ván: va chạm');
  eq(C.kiemVaCham([day, { hop: [440, 476, 297.5, 574, 0, 2200], day: 36 }]).length, 1, 'tấm lấn 18,5 từ góc khoét sang phần còn ván: va chạm');
  eq(C.kiemVaCham([vachKhau, day]), [], 'thứ tự hai tấm không ảnh hưởng');
  // tấm đứng khoét (hồi có góc cắt chân): bao theo [y, z] (trục mỏng là x)
  const hoi = { hop: [0, 17.5, 0, 500, 0, 1000], day: 17.5, bao: [[0, 100], [60, 100], [60, 0], [500, 0], [500, 1000], [0, 1000]] };      // cắt góc trước – dưới 60 × 100
  eq(C.kiemVaCham([hoi, { hop: [-100, 300, 0, 60, 0, 100], day: 60 }]), [], 'thanh chạy qua góc cắt chân của hồi: không va chạm');
  eq(C.kiemVaCham([hoi, { hop: [-100, 300, 0, 60, 50, 150], day: 60 }]).length, 1, 'thanh cao hơn góc cắt 50: va chạm');
  // đợt bo cong góc trước – phải bán kính 300 (cung đã được chia thành đa giác): tấm đứng ở đúng góc hộp nằm ngoài cung
  const cung = []; for (let i = 0; i <= 12; i++) { const a = -Math.PI / 2 + i * Math.PI / 24; cung.push([200 + 300 * Math.cos(a), 300 + 300 * Math.sin(a)]); }
  const bo = { hop: [0, 500, 0, 500, 400, 417.5], day: 17.5, bao: [[0, 0]].concat(cung, [[500, 500], [0, 500]]) };
  eq(C.kiemVaCham([bo, { hop: [460, 477.5, 0, 40, 0, 1000], day: 17.5 }]), [], 'tấm đứng ở góc đã bo: không va chạm');
  eq(C.kiemVaCham([bo, { hop: [300, 317.5, 100, 300, 0, 1000], day: 17.5 }]).length, 1, 'tấm đứng trong lòng đợt bo cong: va chạm');
});

T('Lỗ khoan lệch khỏi tấm (sửa tấm mà chưa khoan lại) và lỗ cam khoan thủng mặt tấm mỏng', () => {
  const tam = () => [{ hop: [0, 17.5, 0, 500, 0, 1000], day: 17.5 }, { hop: [17.5, 500, 0, 500, 400, 417.5], day: 17.5 }];      // 0 hồi trái (tấm cái), 1 đợt (tấm đực)
  const lo = () => cam(1, 17.5, 50, 417.5).map(h => Object.assign(h, { cai: 0, duc: 1 }));
  eq(C.kiemLoLech(tam(), lo()), [], 'cam đúng chỗ: chén + thân nằm trong đợt, mồi nằm trong hồi');
  // người dùng hạ đợt xuống 100 mm mà chưa khoan lại: chén và thân nằm ngoài đợt, mồi vẫn trong hồi
  const ha = tam(); ha[1].hop = [17.5, 500, 0, 500, 300, 317.5];
  eq(C.kiemLoLech(ha, lo()), [{ lo: 0, ma: 'ngoai' }, { lo: 1, ma: 'ngoai' }], 'đợt đã dời: 2 lỗ trên đợt nằm ngoài tấm');
  // hồi bị thu ngắn còn cao 300: lỗ mồi (z 408,75) rơi ra ngoài hồi
  const ngan = tam(); ngan[0].hop = [0, 17.5, 0, 500, 0, 300];
  eq(C.kiemLoLech(ngan, lo()), [{ lo: 2, ma: 'ngoai' }], 'hồi thu ngắn: lỗ mồi nằm ngoài hồi');
  // tấm nằm ngoài phạm vi kiểm (chỉ số −1) thì không phán được lỗ của nó
  eq(C.kiemLoLech(tam(), lo().map(h => Object.assign(h, { duc: -1 }))), [], 'tấm đực không nằm trong phạm vi kiểm: bỏ qua lỗ trên tấm đó');
  // đợt mỏng 12: lỗ chén sâu 13,5 khoan từ mặt trên sẽ thủng mặt dưới
  const mong = [{ hop: [0, 17.5, 0, 500, 0, 1000], day: 17.5 }, { hop: [17.5, 500, 0, 500, 400, 412], day: 12 }];
  const loM = [{ p: [51.5, 50, 412], d: [0, 0, -1], dai: 13.5, r: 6, nhom: 1, cai: 0, duc: 1 }, { p: [51.5, 50, 406], d: [-1, 0, 0], dai: 34, r: 4, nhom: 1, cai: 0, duc: 1 }, { p: [17.5, 50, 406], d: [-1, 0, 0], dai: 13.5, r: 2.5, nhom: 1, cai: 0, duc: 1 }];
  eq(C.kiemLoLech(mong, loM), [{ lo: 0, ma: 'thung', tam: 1 }], 'chén 13,5 trên tấm 12: thủng');
  // vách 17,5 có lỗ mồi 13,5 từ hai mặt đồng trục (lỗ xuyên): không phải thủng; lỗ đơn lẻ xuyên suốt tấm (lỗ bắt tay nắm) cũng không xét
  const vach = [{ hop: [500, 517.5, 0, 500, 0, 1000], day: 17.5 }, { hop: [17.5, 500, 0, 500, 400, 417.5], day: 17.5 }];
  const tayNam = [{ p: [500, 250, 700], d: [1, 0, 0], dai: 17.5, r: 2.5, nhom: 9, cai: 0, duc: 0 }];
  eq(C.kiemLoLech(vach, tayNam), [], 'lỗ đơn (không thuộc cam) xuyên suốt tấm: lỗ xuyên có chủ ý');
  // hồi mỏng 12 (x 0 … 12), đợt tì vào mặt trong: lỗ mồi sâu 13,5 khoan từ mặt trong sẽ thủng ra MẶT NGOÀI của hồi
  const hoi12 = [{ hop: [0, 12, 0, 500, 0, 1000], day: 12 }, { hop: [12, 500, 0, 500, 400, 417.5], day: 17.5 }];
  const cam12 = cam(1, 12, 50, 417.5).map(h => Object.assign(h, { cai: 0, duc: 1 }));
  eq(C.kiemLoLech(hoi12, cam12), [{ lo: 2, ma: 'thung', tam: 0 }], 'lỗ mồi 13,5 trên hồi 12: thủng mặt ngoài (lỗ thân đồng trục nằm phía miệng lỗ, không đón được)');
  // vách mỏng 12 (x 500 … 512) có đợt hai bên cùng cao độ: hai lỗ mồi đồng trục khoan từ hai mặt = một lỗ xuyên, mỗi mặt đều có cạnh đợt che
  const vach12 = [{ hop: [500, 512, 0, 500, 0, 1000], day: 12 }, { hop: [17.5, 500, 0, 500, 400, 417.5], day: 17.5 }, { hop: [512, 990, 0, 500, 400, 417.5], day: 17.5 }];
  const haiMat = [{ p: [466, 50, 408.75], d: [1, 0, 0], dai: 34, r: 4, nhom: 1, cai: 0, duc: 1 }, { p: [500, 50, 408.75], d: [1, 0, 0], dai: 13.5, r: 2.5, nhom: 1, cai: 0, duc: 1 },
    { p: [546, 50, 408.75], d: [-1, 0, 0], dai: 34, r: 4, nhom: 2, cai: 0, duc: 2 }, { p: [512, 50, 408.75], d: [-1, 0, 0], dai: 13.5, r: 2.5, nhom: 2, cai: 0, duc: 2 }];
  eq(C.kiemLoLech(vach12, haiMat), [], 'hai lỗ mồi đồng trục từ hai mặt vách mỏng: lỗ xuyên có chủ ý');
  eq(C.kiemLoLech(vach12, haiMat.slice(0, 2)), [{ lo: 1, ma: 'thung', tam: 0 }], 'chỉ có đợt một bên: lỗ mồi thủng sang mặt trống của vách');
  // ngưỡng: đáy lỗ còn cách mặt bên kia dưới 1 mm ván là coi như thủng (ván phồng / bục khi khoan)
  const sau = dai => cam(1, 17.5, 50, 417.5).map((h, i) => Object.assign(h, { cai: 0, duc: 1 }, i === 0 ? { dai } : {}));
  eq(C.kiemLoLech(tam(), sau(16.8)), [{ lo: 0, ma: 'thung', tam: 1 }], 'chén sâu 16,8 trên tấm 17,5 (còn 0,7): thủng');
  eq(C.kiemLoLech(tam(), sau(16)), [], 'chén sâu 16 trên tấm 17,5 (còn 1,5): được');
  // vít xuyên thành hộp 12 li rồi ăn vào cạnh tấm sau: lỗ xuyên thành có lỗ đồng trục đón tiếp ở tấm kia → có chủ ý; vít thứ hai không có lỗ đón → lỗ ra chỗ trống
  const hop12 = [{ hop: [0, 12, 0, 400, 0, 100], day: 12 }, { hop: [12, 300, 0, 12, 0, 100], day: 12 }];
  const vit = z => [{ p: [0, 6, z], d: [1, 0, 0], dai: 12, r: 2, nhom: 5, cai: 0, duc: 1 }, { p: [12, 6, z], d: [1, 0, 0], dai: 20, r: 1.5, nhom: 5, cai: 0, duc: 1 }];
  eq(C.kiemLoLech(hop12, vit(30).concat(vit(70))), [], 'lỗ vít xuyên thành có lỗ mồi đồng trục ở cạnh tấm sau: không báo');
  eq(C.kiemLoLech(hop12, vit(30).concat(vit(70).slice(0, 1))), [{ lo: 2, ma: 'thung', tam: 0 }], 'lỗ xuyên thành mà phía sau không có lỗ đón: báo');
});

T('Phiếu dò lỗi trên tấm thật: gom va chạm, lỗ giao nhau, kiểu khoan, tấm không lỗ, mối nối, khổ ván, tấm riêng lẻ thành từng mục', () => {
  // tủ 3 tấm: hồi trái (0), hồi phải (1), đợt (2); đợt bắt cam vào hai hồi (mỗi đầu 2 cam)
  const T3 = () => [
    { ten: 'Hồi trái', tu: 'T1', hop: [0, 17.5, 0, 500, 0, 1000], day: 17.5, khoan: true, kieu: ['Cam3Tp'], kich: [1000, 500], he: 0 },
    { ten: 'Hồi phải', tu: 'T1', hop: [500, 517.5, 0, 500, 0, 1000], day: 17.5, khoan: true, kieu: ['Cam3Tp'], kich: [1000, 500], he: 0 },
    { ten: 'Đợt', tu: 'T1', hop: [17.5, 500, 0, 500, 400, 417.5], day: 17.5, khoan: true, kieu: ['Cam3Tp'], kich: [500, 482.5], he: 0 }];
  const camTrai = (nhom, y) => cam(nhom, 17.5, y, 417.5).map(h => Object.assign(h, { cai: 0, duc: 2 }));
  const camPhai = (nhom, y) => [{ p: [466, y, 417.5], d: [0, 0, -1], dai: 13.5, r: 6, nhom }, { p: [466, y, 408.75], d: [1, 0, 0], dai: 34, r: 4, nhom }, { p: [500, y, 408.75], d: [1, 0, 0], dai: 13.5, r: 2.5, nhom }].map(h => Object.assign(h, { cai: 1, duc: 2 }));
  const LO = () => camTrai(1, 50).concat(camTrai(2, 450), camPhai(3, 50), camPhai(4, 450));
  const KHO = { dai: 2440, rong: 1220 }, CO = ['Cam12', 'Cam3Tp'];
  const ket = (p, ma) => (p.muc.find(m => m.ma === ma) || {}).ket;
  const tin = (p, ma) => (p.muc.find(m => m.ma === ma) || { tin: [] }).tin;

  const tot = C.doLoiThat({ tam: T3(), lo: LO(), kieu_co: CO, kho: KHO });
  ok(tot.ok === true && tot.so_tam === 3 && tot.so_lo === 12, 'tủ đúng: đạt, đếm 3 tấm 12 lỗ', [tot.ok, tot.so_tam, tot.so_lo]);
  eq(tot.muc.map(m => [m.ma, m.ket]), [['vc_that', 'dat'], ['lo_giao', 'dat'], ['lo_lech', 'dat'], ['kieu_khoan', 'dat'], ['khong_lo', 'dat'], ['moi_noi', 'dat'], ['kho_van_that', 'dat'], ['lo_lung_that', 'dat'], ['ten_tu', 'dat']], '9 mục đều đạt, đúng thứ tự phiếu');
  eq(tot.dem, { dat: 9, luu_y: 0, loi: 0, chua: 0 }, 'đếm');

  // đầu phải của đợt mất cam → mối nối lưu ý (không phải lỗi: xưởng có thể bắt vít), phiếu vẫn "ok"
  const mat = C.doLoiThat({ tam: T3(), lo: LO().filter(h => h.cai !== 1), kieu_co: CO, kho: KHO });
  ok(mat.ok === true && ket(mat, 'moi_noi') === 'luu_y' && tin(mat, 'moi_noi').length === 1 && /Đợt/.test(tin(mat, 'moi_noi')[0]) && /Hồi phải/.test(tin(mat, 'moi_noi')[0]) && /500/.test(tin(mat, 'moi_noi')[0]), 'đợt không có cam ở đầu phải: ghi tên hai tấm và chiều dài mối nối', tin(mat, 'moi_noi'));

  // đợt bị kéo dài đâm 7,5 vào hồi trái → va chạm là LỖI
  const vc = T3(); vc[2].hop = [10, 500, 0, 500, 400, 417.5];
  const pVC = C.doLoiThat({ tam: vc, lo: LO(), kieu_co: CO, kho: KHO });
  ok(pVC.ok === false && ket(pVC, 'vc_that') === 'loi' && /Đợt/.test(tin(pVC, 'vc_that')[0]) && /Hồi trái/.test(tin(pVC, 'vc_that')[0]) && /7,5/.test(tin(pVC, 'vc_that')[0]), 'tấm đè nhau: lỗi, ghi bề chồng', tin(pVC, 'vc_that'));

  // thêm một lỗ mồi của nhóm khác cắt lỗ mồi của cam 1 (lệch trục 3 mm) → lỗ giao nhau là LỖI, ghi mối nối của từng lỗ
  const them = { p: [17.5, 50, 411.75], d: [-1, 0, 0], dai: 13.5, r: 2.5, nhom: 9, cai: 0, duc: 2 };
  const pLo = C.doLoiThat({ tam: T3(), lo: LO().concat([them]), kieu_co: CO, kho: KHO });
  ok(pLo.ok === false && ket(pLo, 'lo_giao') === 'loi' && tin(pLo, 'lo_giao').length === 1 && /Ø5/.test(tin(pLo, 'lo_giao')[0]) && /Hồi trái/.test(tin(pLo, 'lo_giao')[0]), 'lỗ giao nhau: lỗi, ghi đường kính và tấm', tin(pLo, 'lo_giao'));

  // tấm mang kiểu khoan không có trong cấu hình của tài khoản → Chenfeng không khoan: LỖI
  const kk = T3(); kk[2].kieu = ['三合一'];
  const pKK = C.doLoiThat({ tam: kk, lo: LO(), kieu_co: CO, kho: KHO });
  ok(pKK.ok === false && ket(pKK, 'kieu_khoan') === 'loi' && /三合一/.test(tin(pKK, 'kieu_khoan')[0]) && /Cam12, Cam3Tp/.test(tin(pKK, 'kieu_khoan')[0]), 'kiểu khoan lạ: lỗi, ghi kiểu đang có', tin(pKK, 'kieu_khoan'));
  eq(ket(C.doLoiThat({ tam: kk, lo: LO(), kieu_co: null, kho: KHO }), 'kieu_khoan'), 'chua', 'không đọc được cấu hình khoan: mục này chưa kiểm, không coi là đạt');

  // tấm có kiểu khoan mà không có lỗ nào (đứng riêng → cũng là tấm riêng lẻ); tấm mỏng 6 li không lỗ là bình thường
  const le = T3().concat([{ ten: 'Tấm lạc', tu: 'T1', hop: [900, 917.5, 0, 500, 0, 1000], day: 17.5, khoan: true, kieu: ['Cam3Tp'], kich: [1000, 500], he: 0 },
    { ten: 'Hậu', tu: 'T1', hop: [0, 517.5, 500, 506, 0, 1000], day: 6, khoan: true, kieu: ['Cam3Tp'], kich: [1000, 517.5], he: 0 }]);
  const pLe = C.doLoiThat({ tam: le, lo: LO(), kieu_co: CO, kho: KHO });
  ok(pLe.ok === true && ket(pLe, 'khong_lo') === 'luu_y' && /Tấm lạc/.test(tin(pLe, 'khong_lo')[0]) && !/Hậu/.test(tin(pLe, 'khong_lo')[0]), 'tấm dày không lỗ: lưu ý; hậu mỏng không tính', tin(pLe, 'khong_lo'));
  ok(ket(pLe, 'lo_lung_that') === 'luu_y' && /Tấm lạc/.test(tin(pLe, 'lo_lung_that')[0]), 'tấm đứng riêng: lưu ý', tin(pLe, 'lo_lung_that'));
  eq(ket(pLe, 'moi_noi'), 'dat', 'mép sau của hồi, đợt tì lên hậu mỏng không tính là mối nối thiếu cam');

  // cánh treo bằng bản lề, hở thùng 2 mm, không có kiểu khoan (đo trên mẫu kho thật: 5 cánh bị báo nhầm là "đứng riêng"): không tính là tấm riêng lẻ
  const coCanh = T3().concat([{ ten: 'Cánh mở trái', tu: 'T1', hop: [0, 517.5, -20, -2, 0, 1000], day: 18, khoan: false, kieu: [], kich: [1000, 517.5], he: 0 }]);
  eq(ket(C.doLoiThat({ tam: coCanh, lo: LO(), kieu_co: CO, kho: KHO }), 'lo_lung_that'), 'dat', 'cánh (không khoan) hở thùng: không báo đứng riêng');

  // tủ khấu cột hai thân (đo trên Chenfeng thật): đầu vách khấu của thân dưới nằm dưới chỗ ĐÃ KHOÉT của đáy thân trên → phiếu không được báo "mối nối không liên kết"
  const tamKC = bao => [
    Object.assign({ ten: 'Đáy', tu: 'T', hop: [0, 723.5, 0, 574, 1000, 1017.5], day: 17.5, khoan: true, kieu: ['Cam3Tp'], kich: [723.5, 574], he: 0 }, bao ? { bao: [[0, 0], [723.5, 0], [723.5, 297.5], [458.5, 297.5], [458.5, 574], [0, 574]] } : {}),
    { ten: 'Vách khấu cột', tu: 'D', hop: [458.5, 476, 297.5, 574, 0, 1000], day: 17.5, khoan: true, kieu: ['Cam3Tp'], kich: [1000, 276.5], he: 0 }];
  eq(ket(C.doLoiThat({ tam: tamKC(true), lo: [], kieu_co: CO, kho: KHO }), 'moi_noi'), 'dat', 'đầu vách nằm dưới chỗ đã khoét: mối nối đạt');
  eq(ket(C.doLoiThat({ tam: tamKC(false), lo: [], kieu_co: CO, kho: KHO }), 'moi_noi'), 'luu_y', 'đối chứng — đáy không khoét: báo mối nối');

  // tấm thật vượt khổ ván
  const to = T3(); to[0].kich = [2600, 500];
  const pTo = C.doLoiThat({ tam: to, lo: LO(), kieu_co: CO, kho: KHO });
  ok(pTo.ok === false && ket(pTo, 'kho_van_that') === 'loi' && /Hồi trái/.test(tin(pTo, 'kho_van_that')[0]) && /2600/.test(tin(pTo, 'kho_van_that')[0]), 'tấm 2600 vượt khổ 2440', tin(pTo, 'kho_van_that'));

  // hai tủ đặt lệch hướng nhau (khác hệ trục): không so hộp chéo hệ — mỗi hệ kiểm riêng, có ghi chú
  const haiHe = T3().concat(T3().map(t => Object.assign(t, { he: 1, tu: 'T2' })));
  const p2 = C.doLoiThat({ tam: haiHe, lo: LO(), kieu_co: CO, kho: KHO });
  ok(ket(p2, 'vc_that') === 'dat' && p2.ghi.some(t => /2 hướng/.test(t)), 'hai hệ trục: không báo va chạm chéo, có ghi chú', [ket(p2, 'vc_that'), p2.ghi]);
  // đợt bị hạ 100 mm mà chưa khoan lại: 8 lỗ chén + thân của 4 cam nằm ngoài đợt → LỖI
  const doi = T3(); doi[2].hop = [17.5, 500, 0, 500, 300, 317.5];
  const pDoi = C.doLoiThat({ tam: doi, lo: LO(), kieu_co: CO, kho: KHO });
  ok(pDoi.ok === false && ket(pDoi, 'lo_lech') === 'loi' && /8 lỗ/.test(tin(pDoi, 'lo_lech')[0]) && /Đợt/.test(tin(pDoi, 'lo_lech')[0]), 'lỗ lệch khỏi tấm: lỗi, gom theo tấm', tin(pDoi, 'lo_lech'));
  // hồi trái bị thu ngắn còn cao 300: 2 lỗ mồi của nó rơi ra ngoài; đợt vẫn giữ chén + thân → lỗ lệch là của HỒI
  const thu = T3(); thu[0].hop = [0, 17.5, 0, 500, 0, 300];
  const pThu = C.doLoiThat({ tam: thu, lo: LO(), kieu_co: CO, kho: KHO });
  ok(ket(pThu, 'lo_lech') === 'loi' && tin(pThu, 'lo_lech').length === 1 && /2 lỗ khoan của “Hồi trái”/.test(tin(pThu, 'lo_lech')[0]), 'hồi thu ngắn: lỗ lệch được gán cho hồi, không phải cho đợt', tin(pThu, 'lo_lech'));
  // đợt mỏng 12 mang chén cam sâu 13,5: 4 lỗ khoan thủng → LỖI, ghi độ sâu lỗ và bề dày tấm
  const d12 = T3(); d12[2].hop = [17.5, 500, 0, 500, 400, 412]; d12[2].day = 12;
  const cam12T = (nhom, y) => cam(nhom, 17.5, y, 412).map(h => Object.assign(h, { cai: 0, duc: 2 }));
  const cam12P = (nhom, y) => [{ p: [466, y, 412], d: [0, 0, -1], dai: 13.5, r: 6, nhom }, { p: [466, y, 403.25], d: [1, 0, 0], dai: 34, r: 4, nhom }, { p: [500, y, 403.25], d: [1, 0, 0], dai: 13.5, r: 2.5, nhom }].map(h => Object.assign(h, { cai: 1, duc: 2 }));
  const p12 = C.doLoiThat({ tam: d12, lo: cam12T(1, 50).concat(cam12T(2, 450), cam12P(3, 50), cam12P(4, 450)), kieu_co: CO, kho: KHO });
  ok(p12.ok === false && ket(p12, 'lo_lech') === 'loi' && tin(p12, 'lo_lech').length === 1 && /4 lỗ sâu 13,5 khoan thủng “Đợt” \(T1\) dày 12/.test(tin(p12, 'lo_lech')[0]), 'chén cam thủng đợt mỏng: lỗi, gom theo tấm', tin(p12, 'lo_lech'));
  // chép đè một tấm lên chính nó: va chạm kiểu "trùng khít"
  const chep = T3(); chep.push(Object.assign({}, chep[2], { hop: chep[2].hop.slice() }));
  const pChep = C.doLoiThat({ tam: chep, lo: LO(), kieu_co: CO, kho: KHO });
  ok(pChep.ok === false && ket(pChep, 'vc_that') === 'loi' && tin(pChep, 'vc_that').length === 1 && /trùng khít/.test(tin(pChep, 'vc_that')[0]) && /Đợt/.test(tin(pChep, 'vc_that')[0]), 'tấm chép đè: lỗi "trùng khít"', tin(pChep, 'vc_that'));
  // tấm chưa có tên tủ (vẽ tay): lưu ý — tem tấm sẽ không biết của tủ nào
  const khongTen = T3(); khongTen[2].tu = '';
  const pTen = C.doLoiThat({ tam: khongTen, lo: LO(), kieu_co: CO, kho: KHO });
  ok(pTen.ok === true && ket(pTen, 'ten_tu') === 'luu_y' && /1 tấm/.test(tin(pTen, 'ten_tu')[0]) && /Đợt/.test(tin(pTen, 'ten_tu')[0]), 'tấm không có tên tủ: lưu ý', tin(pTen, 'ten_tu'));
  // ghi chú (không tính là lưu ý): tấm hẹp dưới 50 phải gia công tay; tấm chưa khai vật liệu
  const hep = T3().map(t => Object.assign(t, { vl: 'MDF chống ẩm' })).concat([{ ten: 'Nẹp', tu: 'T1', hop: [17.5, 50, 0, 17.5, 0, 400], day: 17.5, khoan: false, kieu: [], kich: [400, 32.5], he: 0, vl: '' }]);
  const pHep = C.doLoiThat({ tam: hep, lo: LO(), kieu_co: CO, kho: KHO });
  ok(pHep.ghi.some(t => /1 tấm hẹp dưới 50/.test(t) && /Nẹp/.test(t)) && pHep.ghi.some(t => /1 tấm chưa khai vật liệu/.test(t)), 'ghi chú tấm hẹp và tấm chưa khai vật liệu', pHep.ghi);
  ok(!tot.ghi.some(t => /hẹp/.test(t)), 'tủ không có tấm hẹp thì không ghi', tot.ghi);
  // chỉ một tấm được chọn: không nói gì về "riêng lẻ"
  eq(ket(C.doLoiThat({ tam: T3().slice(0, 1), lo: [], kieu_co: CO, kho: KHO }), 'lo_lung_that'), 'khong', 'kiểm một tấm thì mục riêng lẻ không áp dụng');
});

/* ---------- 4. Driver đọc tấm và lỗ thật của Chenfeng (đối tượng giả dựng đúng cấu trúc đã đo trên Chenfeng 04/10/2026) ----------
 * Tấm: Name, Thickness, Width, Height, BoardProcessOption { cabinetName, drillType, highDrill[4] }, OBB { ocs.elements (3 cột đầu = trục riêng, cột 3 = pháp tuyến), halfSizes, center }, Template.
 * Lỗ: lớp CylinderHole, _Matrix.elements (cột 3 = hướng khoan, cột 4 = miệng lỗ), Radius, Height, GroupId.Index, FId.Object = tấm cái, MId.Object = tấm đực. */
global.self = { MNCFCore: C };
require('../src/mncf-driver.js');
const D = global.self.MNCFDriver;
class CylinderHole { constructor(o) { Object.assign(this, o); } }
const quay = (v, do_) => { const a = do_ * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]]; };
// tấm giả từ hộp thẳng trục, rồi xoay cả tấm quanh trục Z một góc `do_` (tủ đặt theo tường xiên)
const tamGia = (ten, hop, o, do_) => {
  const [x0, x1, y0, y1, z0, z1] = hop, d = [x1 - x0, y1 - y0, z1 - z0], k = d.indexOf(Math.min(...d)), E = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const ax = [E[(k + 1) % 3], E[(k + 2) % 3], E[k]].map(v => quay(v, do_ || 0)), goc = quay([x0, y0, z0], do_ || 0), tam = quay([(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], do_ || 0);
  return { Name: ten, BoardType: 0, IsErase: false, Thickness: d[k], Width: d[(k + 1) % 3], Height: d[(k + 2) % 3],
    BoardProcessOption: Object.assign({ cabinetName: 'T1', roomName: '', drillType: 'Cam3Tp', highDrill: ['Cam3Tp', 'Cam3Tp', 'Cam3Tp', 'Cam3Tp'] }, (o && o.bpo) || {}),
    OBB: { ocs: { elements: [...ax[0], 0, ...ax[1], 0, ...ax[2], 0, ...goc, 1] }, halfSizes: { x: d[(k + 1) % 3] / 2, y: d[(k + 2) % 3] / 2, z: d[k] / 2 }, center: { x: tam[0], y: tam[1], z: tam[2] } },
    // đường bao trong hệ riêng của tấm (gốc = góc nhỏ nhất, trục = hai trục nằm trong mặt tấm) — như ContourCurve.LineData + OCS đo trên Chenfeng
    OCS: { elements: [...ax[0], 0, ...ax[1], 0, ...ax[2], 0, ...goc, 1] },
    ContourCurve: { LineData: ((o && o.ld) || [[0, 0], [d[(k + 1) % 3], 0], [d[(k + 1) % 3], d[(k + 2) % 3]], [0, d[(k + 2) % 3]]]).map(q => ({ pt: { x: q[0], y: q[1] }, bul: q[2] || 0 })) },
    Template: o && o.tpl ? { Object: o.tpl } : null };
};
const loGia = (h, F, M, do_) => { const p = quay(h.p, do_ || 0), d = quay(h.d, do_ || 0); return new CylinderHole({ IsErase: false, _Matrix: { elements: [1, 0, 0, 0, 0, 1, 0, 0, d[0], d[1], d[2], 0, p[0], p[1], p[2], 1] }, Radius: h.r, Height: h.dai, GroupId: { Index: h.nhom }, FId: { Object: F }, MId: { Object: M }, Type: 0 }); };
// tủ 3 tấm + 4 cam như ở phần 3, dựng thành đối tượng "thật"; boCam = bỏ cam ở đầu phải của đợt
const tuGia = (do_, boCam) => {
  const hoiT = tamGia('Hồi trái', [0, 17.5, 0, 500, 0, 1000], null, do_), hoiP = tamGia('Hồi phải', [500, 517.5, 0, 500, 0, 1000], null, do_), dot = tamGia('Đợt', [17.5, 500, 0, 500, 400, 417.5], null, do_);
  const los = [];
  for (const [nhom, y] of [[1, 50], [2, 450]]) for (const h of cam(nhom, 17.5, y, 417.5)) los.push(loGia(h, hoiT, dot, do_));
  if (!boCam) for (const [nhom, y] of [[3, 50], [4, 450]]) for (const h of [{ p: [466, y, 417.5], d: [0, 0, -1], dai: 13.5, r: 6, nhom }, { p: [466, y, 408.75], d: [1, 0, 0], dai: 34, r: 4, nhom }, { p: [500, y, 408.75], d: [1, 0, 0], dai: 13.5, r: 2.5, nhom }]) los.push(loGia(h, hoiP, dot, do_));
  return { tam: [hoiT, hoiP, dot], lo: los };
};
const ketD = (p, ma) => (p.muc.find(m => m.ma === ma) || {}).ket;
const gan = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 0.02);

T('Driver đọc tấm và lỗ thật thành dữ liệu cho phiếu dò lỗi', () => {
  const tu = tuGia(0), dl = D.docThat(tu.tam.concat(tu.lo));
  eq([dl.tam.length, dl.lo.length, dl.lech], [3, 12, 0], '3 tấm, 12 lỗ, không tấm nào nghiêng');
  ok(gan(dl.tam[0].hop, [0, 17.5, 0, 500, 0, 1000]) && gan(dl.tam[2].hop, [17.5, 500, 0, 500, 400, 417.5]), 'hộp tấm dựng lại từ OBB', [dl.tam[0].hop, dl.tam[2].hop]);
  eq(dl.tam.map(t => [t.ten, t.tu, t.day, t.khoan, t.kieu, t.kich, t.he]), [['Hồi trái', 'T1', 17.5, true, ['Cam3Tp'], [1000, 500], 0], ['Hồi phải', 'T1', 17.5, true, ['Cam3Tp'], [1000, 500], 0], ['Đợt', 'T1', 17.5, true, ['Cam3Tp'], [500, 482.5], 0]], 'tên, tủ, dày, có khoan, kiểu khoan, kích thước cắt, nhóm hướng');
  const l0 = dl.lo[0];      // lỗ chén của cam 1: miệng ở mặt trên đợt, khoan xuống 13,5
  ok(gan(l0.p, [51.5, 50, 417.5]) && gan(l0.d, [0, 0, -1]) && l0.dai === 13.5 && l0.r === 6 && l0.nhom === 1 && l0.cai === 0 && l0.duc === 2, 'lỗ: miệng, hướng, sâu, bán kính, nhóm, tấm cái = hồi trái, tấm đực = đợt', l0);
  // tấm không khoan (hậu bắn đinh) và tấm mang kiểu khoan cũ
  const hau = tamGia('Hậu', [0, 517.5, 500, 506, 0, 1000], { bpo: { drillType: '不排', highDrill: ['不排', '不排', '不排', '不排'] } });
  const cu = tamGia('Thành ngăn kéo', [100, 400, 100, 117.5, 100, 200], { bpo: { drillType: '三合一', highDrill: ['三合一', '', '三合一', ''] } });
  const dl2 = D.docThat([hau, cu]);
  eq([dl2.tam[0].khoan, dl2.tam[0].kieu, dl2.tam[1].khoan, dl2.tam[1].kieu], [false, [], true, ['三合一']], 'kiểu 不排 = không khoan; cạnh để trống thì bỏ qua');
  // hai tấm cùng một module gốc (đi ngược cây mẫu tới gốc) mang cùng mã `mau`; tấm rời thì không có
  const goc = { ten: 'gốc' }, con1 = { Parent: { Object: goc } }, con2 = { Parent: { Object: { Parent: { Object: goc } } } };
  const dl3 = D.docThat([tamGia('A', [0, 17.5, 0, 500, 0, 1000], { tpl: con1 }), tamGia('B', [10, 400, 0, 500, 400, 417.5], { tpl: con2 }), tamGia('C', [600, 617.5, 0, 500, 0, 1000])]);
  ok(dl3.tam[0].mau !== null && dl3.tam[0].mau === dl3.tam[1].mau && dl3.tam[2].mau === null, 'cùng module gốc thì cùng mã mẫu', dl3.tam.map(t => t.mau));
  // vật liệu đã khai: lấy tên vật liệu (材料), không có thì lấy tên ván (板材名); cả hai để trống = chưa khai (tủ do bảng vẽ ra đang như vậy)
  const coVL = tamGia('A', [0, 17.5, 0, 500, 0, 1000], { bpo: { material: '实木颗粒', boardName: '' } }), tenVan = tamGia('B', [100, 117.5, 0, 500, 0, 1000], { bpo: { material: '', boardName: 'MDF chống ẩm' } });
  eq(D.docThat([coVL, tenVan, tu.tam[0]]).tam.map(t => t.vl), ['实木颗粒', 'MDF chống ẩm', ''], 'vật liệu của tấm; để trống = chưa khai');
  // góc của từng nhóm hướng: phiếu dò lỗi cần để đưa lỗ khoan về cùng hệ trục với hộp tấm
  eq(D.docThat(tuGia(30).tam.concat(tuGia(0).tam)).goc_he.map(v => Math.round(v * 100) / 100), [30, 0], 'góc của từng nhóm hướng');
  // lỗ nối với tấm nằm ngoài phạm vi kiểm: vẫn đọc (để dò lỗ giao nhau) nhưng chỉ số tấm là −1
  const dl4 = D.docThat([tu.tam[0]].concat(tu.lo.slice(0, 3)));
  eq([dl4.lo.length, dl4.lo[0].cai, dl4.lo[0].duc], [3, 0, -1], 'tấm đực nằm ngoài phạm vi: duc = −1');
});

T('Driver dò lỗi: tủ đặt thẳng trục và tủ xoay theo tường xiên 30° cho cùng kết quả; hai tủ khác hướng là hai nhóm; tấm nghiêng bị bỏ ra', () => {
  for (const do_ of [0, 30, -90, 137.5]) {
    const tu = tuGia(do_), p = D.doLoi(tu.tam.concat(tu.lo));
    eq(p.muc.filter(m => m.ma !== 'kieu_khoan').map(m => m.ket), ['dat', 'dat', 'dat', 'dat', 'dat', 'dat', 'dat', 'dat'], `xoay ${do_}°: tủ đúng thì các mục đạt`);
    ok(p.so_tam === 3 && p.so_lo === 12 && !p.ghi.some(t => /hướng/.test(t)), `xoay ${do_}°: một nhóm hướng`, p.ghi);
    const thieu = tuGia(do_, true), p2 = D.doLoi(thieu.tam.concat(thieu.lo));
    ok(ketD(p2, 'moi_noi') === 'luu_y' && /Hồi phải/.test(p2.muc.find(m => m.ma === 'moi_noi').tin[0]), `xoay ${do_}°: đầu phải của đợt thiếu cam vẫn bị bắt`, p2.muc.find(m => m.ma === 'moi_noi'));
  }
  // Node không có cấu hình khoan của Chenfeng → mục kiểu khoan "chưa kiểm"
  eq(ketD(D.doLoi(tuGia(0).tam), 'kieu_khoan'), 'chua', 'không đọc được cấu hình khoan: chưa kiểm');
  const a = tuGia(0), b = tuGia(30), p = D.doLoi(a.tam.concat(a.lo, b.tam, b.lo));
  ok(p.so_tam === 6 && p.ghi.some(t => /2 hướng/.test(t)) && ketD(p, 'vc_that') === 'dat', 'hai tủ lệch nhau 30°: hai nhóm hướng, không so chéo', [p.ghi, ketD(p, 'vc_that')]);
  // tấm nằm nghiêng (vát mái 20° quanh trục X): không tấm trục nào thẳng đứng
  const ngh = tamGia('Tấm vát', [0, 500, 0, 300, 0, 17.5]); const c = Math.cos(20 * Math.PI / 180), s = Math.sin(20 * Math.PI / 180);
  ngh.OBB.ocs.elements = [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
  const p3 = D.doLoi(tuGia(0).tam.concat([ngh]));
  ok(p3.so_tam === 3 && p3.ghi.some(t => /1 tấm nằm nghiêng/.test(t)), 'tấm nghiêng bị bỏ ra và có ghi chú', [p3.so_tam, p3.ghi]);
});

T('Driver đọc đường bao thật của tấm khoét / bo cong; tấm uốn cong bị bỏ ra; tấm do bảng vẽ không được miễn va chạm dù chung module', () => {
  // đáy khoét góc sau – phải (đường bao 6 đỉnh trong hệ riêng của tấm, số đo trên Chenfeng), đặt tại x = 1000; vách khấu đứng trong góc khoét
  const ldKhoet = [[0, 0], [723.5, 0], [723.5, 297.5], [458.5, 297.5], [458.5, 574], [0, 574]];
  for (const do_ of [0, 30]) {
    const day = tamGia('Đáy', [1000, 1723.5, 0, 574, 100, 117.5], { ld: ldKhoet }, do_), vk = tamGia('Vách khấu cột', [1458.5, 1476, 297.5, 574, 0, 2200], null, do_);
    const dl = D.docThat([day, vk]);
    ok(dl.tam[0].bao && dl.tam[0].bao.length === 6 && gan(dl.tam[0].bao.flat(), [1000, 0, 1723.5, 0, 1723.5, 297.5, 1458.5, 297.5, 1458.5, 574, 1000, 574]) && dl.tam[1].bao === undefined, `xoay ${do_}°: tấm khoét có đường bao (toạ độ hệ trục của nhóm hướng), tấm chữ nhật thì không`, dl.tam.map(t => t.bao));
    const p = D.doLoi([day, vk]);
    ok(ketD(p, 'vc_that') === 'dat' && !p.ghi.some(t => /ăn vào nhau/.test(t)), `xoay ${do_}°: tấm đứng trong góc khoét không phải va chạm`, [ketD(p, 'vc_that'), p.ghi]);
    eq(ketD(D.doLoi([tamGia('Đáy', [1000, 1723.5, 0, 574, 100, 117.5], null, do_), vk]), 'vc_that'), 'loi', `xoay ${do_}°: đối chứng — đáy không khoét thì vách khấu đâm xuyên đáy`);
  }
  // đường bao có điểm đầu lặp lại ở cuối (Chenfeng hay ghi vậy): vẫn là chữ nhật → không cần đường bao
  eq(D.docThat([tamGia('Đợt', [0, 500, 0, 500, 400, 417.5], { ld: [[0, 0], [500, 0], [500, 500], [0, 500], [0, 0]] })]).tam[0].bao, undefined, 'chữ nhật có điểm khép lặp lại: không tạo đường bao');
  // đợt bo cong góc trước – phải, bán kính 300: cung (bul = tan(góc/4), ngược chiều kim đồng hồ) được chia thành đoạn thẳng
  const bo = tamGia('Đợt bo', [0, 500, 0, 500, 400, 417.5], { ld: [[0, 0], [200, 0, Math.tan(Math.PI / 8)], [500, 300], [500, 500], [0, 500]] });
  const b2 = D.docThat([bo]).tam[0].bao, tren = (b2 || []).filter(q => q[0] > 200.01 && q[1] < 299.99);
  ok(b2 && tren.length >= 5 && tren.every(q => Math.abs(Math.hypot(q[0] - 200, q[1] - 300) - 300) < 0.02), 'cung 90° chia thành ít nhất 6 đoạn, các điểm chia nằm trên cung', b2);
  eq(ketD(D.doLoi([bo, tamGia('Trụ góc', [460, 477.5, 0, 40, 0, 1000])]), 'vc_that'), 'dat', 'tấm đứng ở góc đã bo: không va chạm');
  eq(ketD(D.doLoi([bo, tamGia('Vách', [300, 317.5, 100, 300, 0, 1000])]), 'vc_that'), 'loi', 'tấm đứng trong lòng đợt bo cong: va chạm');
  // tấm UỐN cong theo đường dẫn (IsArcBoard): hộp bao không nói lên hình thật → bỏ ra khỏi phép dò, có đếm
  const uon = tamGia('Cánh cong', [100, 400, 100, 400, 0, 1000]); uon.IsArcBoard = true;
  const p4 = D.doLoi(tuGia(0).tam.concat([uon]));
  ok(p4.so_tam === 3 && ketD(p4, 'vc_that') === 'dat' && p4.ghi.some(t => /1 tấm uốn cong/.test(t)), 'tấm uốn cong bị bỏ ra và có ghi chú', [p4.so_tam, p4.ghi]);
  // tủ do bảng vẽ đã gom thành MỘT module: tấm mang mã tủ (ghi chú MNCF) không được miễn va chạm dù chung module — người dùng kéo lệch đợt là phải bắt được
  const modTu = { ten: 'module tủ' }, the = { remarks: [['MNCF', 'AB12CD34']] };
  const A = tamGia('Hồi trái', [0, 17.5, 0, 500, 0, 1000], { tpl: modTu, bpo: the }), B = tamGia('Đợt', [10, 400, 0, 500, 400, 417.5], { tpl: modTu, bpo: the });
  eq(D.docThat([A, B]).tam.map(t => t.mau), [null, null], 'tấm của bảng: không mang mã mẫu');
  eq(ketD(D.doLoi([A, B]), 'vc_that'), 'loi', 'đợt đâm vào hồi trong cùng module tủ: lỗi');
  // ngăn kéo (mẫu kho) nằm trong module tủ: MỖI ngăn kéo là một mẫu — tấm trong cùng một ngăn kéo được miễn (lồng mộng), hai ngăn kéo khác nhau thì không
  const nk1 = { Parent: { Object: modTu } }, nk2 = { Parent: { Object: modTu } }, con = { Parent: { Object: nk1 } };
  const dlN = D.docThat([A, tamGia('Thành trái', [100, 115, 0, 400, 100, 250], { tpl: nk1 }), tamGia('Vách chia', [100, 300, 200, 215, 100, 250], { tpl: con }), tamGia('Thành trái', [100, 115, 0, 400, 300, 450], { tpl: nk2 })]);
  ok(dlN.tam[1].mau !== null && dlN.tam[1].mau === dlN.tam[2].mau && dlN.tam[3].mau !== null && dlN.tam[3].mau !== dlN.tam[1].mau, 'ngăn kéo trong module tủ: mã mẫu theo từng ngăn kéo', dlN.tam.map(t => t.mau));
  // chỉ kiểm các tấm đang chọn (không có tấm nào của bảng trong đó): phải dựa vào mọi tấm của bản vẽ (opt.nen) mới nhận ra hai ngăn kéo nằm trong một module tủ
  const nkA = tamGia('Thành trái', [100, 115, 0, 400, 100, 250], { tpl: nk1 }), nkB = tamGia('Thành trái', [100, 115, 0, 400, 200, 350], { tpl: nk2 });
  const rieng = D.docThat([nkA, nkB]).tam.map(t => t.mau), coNen = D.docThat([nkA, nkB], { nen: [A, nkA, nkB] }).tam.map(t => t.mau);
  ok(rieng[0] === rieng[1] && coNen[0] !== coNen[1] && coNen[0] !== null && coNen[1] !== null, 'chọn riêng hai ngăn kéo: có danh sách tấm của bản vẽ thì vẫn tách được từng ngăn kéo', [rieng, coNen]);
});

console.log(`\nkiem.test: ${pass} đạt, ${fail} hỏng`);
process.exit(fail ? 1 : 0);
