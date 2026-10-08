'use strict';
// Kiểm tra lõi "Phòng" (Node thuần):  node test/phong.test.js
const P = require('../src/mncf-phong.js');
const C = require('../src/mncf-core.js');
// Bản 1.31: chuẩn xưởng đổi sang nóc, đáy phủ hồi. Số đo điện – nước / khấu cột trong bộ này là kết cấu cũ (hồi chạy xuống sàn) → ghim 'lot'; kết cấu mới thử ở core.test.
C.DEFAULT_SPEC.thung.noc_day = 'lot';
let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) { pass++; } else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); } };
const eq = (a, b, name) => ok(JSON.stringify(a) === JSON.stringify(b), name, { got: a, want: b });
const T = (name, fn) => { const f0 = fail; try { fn(); } catch (e) { fail++; console.log('  ✗', name, '— ném lỗi:', e.stack); } console.log((fail === f0 ? '✓ ' : '✗ ') + name); };
const co = (ds, re) => ds.some(t => re.test(t));

T('Phòng mẫu: chữ nhật 3600 × 3000, tường D tự tính, khép kín', () => {
  const H = P.hinhHoc(P.macDinh());
  eq(H.loi, [], 'không lỗi'); eq(H.luu_y, [], 'không lưu ý');
  eq(H.tuong.map(w => [w.ten, w.dai, w.a]), [['A', 3600, 0], ['B', 3000, -90], ['C', 3600, -180], ['D', 3000, -270]], 'tên, dài, hướng');
  eq(H.tuong.map(w => w.p0), [[0, 0], [3600, 0], [3600, -3000], [0, -3000]], 'đỉnh: A chạy +x tại y = 0, lòng phòng phía y âm');
  eq(H.tuong.map(w => w.n), [[0, -1], [-1, 0], [0, 1], [1, 0]], 'hướng vào lòng phòng');
  ok(H.tuong[3].tu_tinh === true && H.tuong[0].tu_tinh === false, 'chỉ tường D là tự tính');
  eq([H.khep.kin, H.khep.ho], [true, 0], 'khép kín');
  eq([H.dien_tich, H.chu_vi], [10800000, 13200], 'diện tích 10,8 m², chu vi 13,2 m');
  ok(co(P.tomTat(H), /4 tường · chu vi 13,2 m · diện tích 10,8 m² · trần 2700/), 'tóm tắt', P.tomTat(H));
});

T('Phòng chưa khép: báo hở bao nhiêu và tường nào thiếu / thừa', () => {
  const H = P.hinhHoc({ cao: 2700, tuong: [{ dai: 3600 }, { dai: 3000 }, { dai: 3580 }, { dai: 3000 }] });
  eq([H.khep.kin, H.khep.ho, H.khep.dx, H.khep.dy], [false, 20, -20, 0], 'hở 20 theo phương x');
  ok(co(H.luu_y, /chưa khép kín: điểm cuối cách điểm đầu 20 mm/), 'có lưu ý', H.luu_y);
  ok(co(H.luu_y, /A thừa 20/) && co(H.luu_y, /C thiếu 20/), 'chỉ đúng cặp tường lệch', H.luu_y);
  eq(H.dien_tich, 0, 'chưa khép thì không tính diện tích');
  const H2 = P.hinhHoc({ cao: 2700, tuong: [{ dai: 3600 }, { dai: 3000 }, { dai: 3600, re: 80 }, { dai: 3000 }] });
  ok(co(H2.luu_y, /tổng các góc rẽ là 350°/), 'sai góc rẽ thì báo tổng góc', H2.luu_y);
});

T('Phòng chữ L (góc lồi rẽ trái −90): 6 tường, tự tính tường cuối', () => {
  // A 4000 → B 2000 → C 1500 → D rẽ trái... : phòng 4000 × 3500 khuyết góc 1500 × 1500 ở góc dưới-phải
  const H = P.hinhHoc({ cao: 2800, tuong: [{ dai: 4000 }, { dai: 2000 }, { dai: 1500, re: -90 }, { dai: 1500 }, { dai: 2500 }, { dai: 'auto' }] });
  eq(H.loi, [], 'không lỗi'); ok(H.khep.kin, 'khép kín', H.khep);
  eq(H.tuong[5].dai, 3500, 'tường F tự tính = 3500');
  eq(H.dien_tich, 4000 * 3500 - 1500 * 1500, 'diện tích chữ L');
  eq(H.tuong.map(w => w.ten), ['A', 'B', 'C', 'D', 'E', 'F'], 'tên tường tự đặt');
});

T('Tự tính tường: báo lỗi khi không thể', () => {
  const H = P.hinhHoc({ tuong: [{ dai: 3000 }, { dai: 'auto' }] });
  ok(co(H.loi, /mới có 2 tường/), 'ít hơn 3 tường', H.loi);
  const H2 = P.hinhHoc({ tuong: [{ dai: 3000 }, { dai: 2000 }, { dai: 3000 }, { dai: 2000 }, { dai: 'auto' }] });
  ok(co(H2.loi, /Không tự tính được chiều dài tường E/), 'các tường khác đã khép → không còn chỗ', H2.loi);
  const H3 = P.chuanHoa({ tuong: [{ dai: 'auto' }, { dai: 3000 }, { dai: '' }, { dai: 3000 }] });
  eq(H3.tuong.map(t => t.dai), [0, 3000, 'auto', 3000], 'chỉ một tường được tự tính');
  eq(P.hinhHoc({ tuong: [] }).loi, ['Chưa có tường nào.'], 'phòng rỗng');
});

T('Chuẩn hoá: số gõ kiểu Việt, loại lạ, chỉ số tường ngoài phạm vi', () => {
  const p = P.chuanHoa({ ten: 'P1', cao: '2,75', tuong: [{ dai: '3600,5' }, { dai: '3000' }], mo: [{ tuong: 9, loai: 'xyz', rong: '0,9' }], can: [{ tuong: -3, loai: 'dam' }], khung: [{ tuong: 1 }] });
  eq([p.cao, p.tuong[0].dai], [2.75, 3600.5], 'dấu phẩy thập phân');
  eq([p.mo[0].tuong, p.mo[0].loai, p.mo[0].rong], [1, 'cua', 0.9], 'cửa: tường kẹp về tường cuối, loại lạ → cửa đi');
  eq([p.can[0].tuong, p.can[0].loai], [0, 'dam'], 'dầm: tường âm → 0');
  eq([p.khung[0].ten, p.khung[0].rong, p.khung[0].cao, p.khung[0].sau], ['K1', 1000, 2.75, 600], 'khung: tên tự đặt, cao mặc định = trần');
  eq(P.chuanHoa({ cao: 2700, tuong: [{ dai: 1 }], can: [{ loai: 'dam' }] }).can[0].z0, 2400, 'dầm mặc định: đáy dầm = trần − 300');
});

T('Kiểm tra: cửa, dầm cột, khung', () => {
  const nen = { cao: 2700, tuong: [{ dai: 3600 }, { dai: 3000 }, { dai: 3600 }, { dai: 'auto' }] };
  const H = P.hinhHoc(Object.assign({}, nen, { mo: [{ tuong: 0, cach: 3000, rong: 900, cao: 2200 }, { tuong: 1, cach: 100, rong: 800, cao: 2800 }] }));
  ok(co(H.loi, /Cửa đi 1 vượt ra ngoài tường A/), 'cửa vượt tường', H.loi);
  ok(co(H.loi, /Cửa đi 2 \(tường B\) cao tới \+2800, vượt trần 2700/), 'cửa vượt trần', H.loi);
  const K = P.hinhHoc(Object.assign({}, nen, {
    mo: [{ tuong: 0, loai: 'cua_so', cach: 2400, rong: 1000, cao: 1200, be: 900 }, { tuong: 1, cach: 100, rong: 900, cao: 2200 }],
    can: [{ tuong: 0, loai: 'dam', cach: 0, rong: 3600, nho: 250, z0: 2350, z1: 2700 }, { tuong: 0, loai: 'cot', cach: 0, rong: 220, nho: 220, z0: 0, z1: 2700 }],
    khung: [{ ten: 'K1', tuong: 0, cach: 220, rong: 2000, cao: 2700, sau: 600 }, { ten: 'K2', tuong: 0, cach: 2000, rong: 1600, cao: 2000, sau: 600 }],
  }));
  ok(co(K.luu_y, /Khung K1 vướng dầm 1 ở tường A .*Hạ khung xuống còn cao 2350/), 'khung vướng dầm + gợi ý cao tối đa', K.luu_y);
  ok(!co(K.luu_y, /Khung K1 vướng cột/), 'khung sát cột (chạm mép) không tính là vướng', K.luu_y);
  ok(co(K.luu_y, /Khung K2 che cửa sổ 1 trên tường A/), 'khung che cửa sổ', K.luu_y);
  ok(co(K.luu_y, /Khung K2 \(sâu 600\) chắn cửa đi 2 ở tường B sát góc/), 'khung sâu chắn cửa ở tường kề', K.luu_y);
  ok(co(K.loi, /Khung K1 và khung K2 trên tường A chồng lên nhau/), 'hai khung chồng nhau', K.loi);
  const G = P.hinhHoc(Object.assign({}, nen, { khung: [{ ten: 'K1', tuong: 0, cach: 1600, rong: 2000, cao: 2700, sau: 600 }, { ten: 'K2', tuong: 1, cach: 0, rong: 1500, cao: 2700, sau: 600 }] }));
  ok(co(G.loi, /Khung K1 \(tường A\) và khung K2 \(tường B\) đâm vào nhau ở góc phòng/), 'hai khung đâm nhau ở góc', G.loi);
  const G2 = P.hinhHoc(Object.assign({}, nen, { khung: [{ ten: 'K1', tuong: 0, cach: 1600, rong: 2000, cao: 2700, sau: 600 }, { ten: 'K2', tuong: 1, cach: 600, rong: 1500, cao: 2700, sau: 600 }] }));
  eq(G2.loi, [], 'lùi K2 ra đúng bằng sâu K1 thì hết đâm');
  const T2 = P.hinhHoc(Object.assign({}, nen, { khung: [{ ten: 'Treo', tuong: 0, cach: 0, z: 1500, rong: 1000, cao: 700, sau: 350 }, { ten: 'Dưới', tuong: 0, cach: 0, z: 0, rong: 1000, cao: 850, sau: 600 }, { ten: 'Cao', tuong: 2, cach: 0, z: 100, rong: 800, cao: 2700, sau: 600 }] }));
  ok(!co(T2.loi, /chồng/), 'tủ treo phía trên tủ dưới (khác cao độ) không tính chồng', T2.loi);
  ok(co(T2.loi, /Khung Cao cao tới \+2800, vượt trần 2700/), 'khung vượt trần', T2.loi);
});

T('Vị trí đặt tủ theo từng tường', () => {
  const H = P.hinhHoc({ cao: 2700, tuong: [{ dai: 3600 }, { dai: 3000 }, { dai: 3600 }, { dai: 'auto' }],
    khung: [{ tuong: 0, cach: 500, rong: 2000, cao: 2700, sau: 600 }, { tuong: 1, cach: 300, rong: 1000, cao: 2700, sau: 600 }, { tuong: 2, cach: 100, rong: 1000, cao: 2000, sau: 450, z: 200 }, { tuong: 3, cach: 0, rong: 1000, cao: 2700, sau: 600 }] });
  eq(P.datKhung(H, 0), { goc: [500, -600, 0], xoay: 0, tuong: 'A' }, 'tường A: không xoay, mặt cánh lùi vào phòng 600');
  eq(P.datKhung(H, 1), { goc: [3000, -300, 0], xoay: -90, tuong: 'B' }, 'tường B: xoay −90');
  eq(P.datKhung(H, 2), { goc: [3500, -2550, 200], xoay: 180, tuong: 'C' }, 'tường C: xoay 180, cao độ đáy 200');
  eq(P.datKhung(H, 3), { goc: [600, -3000, 0], xoay: 90, tuong: 'D' }, 'tường D: xoay 90');
  const H2 = P.hinhHoc({ cao: 2700, goc: [10000, 5000, 0], tuong: [{ dai: 3600 }], khung: [{ tuong: 0, cach: 500, rong: 2000, cao: 2700, sau: 600 }] });
  eq(P.datKhung(H2, 0).goc, [10500, 4400, 0], 'cộng điểm đặt phòng trong bản vẽ');
  eq(P.datKhung(H, 9), null, 'khung không có');
});

T('Tủ vừa khung: phủ bì đúng bằng khung', () => {
  for (const q of [{ ten: 'K1', rong: 2000, cao: 2700, sau: 600 }, { ten: 'K2', rong: 1180, cao: 2400, sau: 550 }, { ten: 'K3', rong: 3350, cao: 2650, sau: 620 }, { ten: 'K4', rong: 4200, cao: 2800, sau: 600 }, { ten: 'K5', rong: 900, cao: 2000, sau: 450 }]) {
    const r = P.tuChoKhung(C, C.DEFAULT_SPEC, q, 'Phòng ngủ 1'), M = C.build(r.spec), bb = C.bbox(M.parts);
    eq(M.errors, [], `${q.ten}: dựng không lỗi`);
    eq([bb.x1 - bb.x0, Math.round((bb.y1 - bb.y0) * 10) / 10, bb.z1 - bb.z0], [q.rong, q.sau, q.cao], `${q.ten}: phủ bì = khung ${q.rong} × ${q.sau} × ${q.cao}`);
    eq([r.spec.ma, r.spec.phong], [q.ten, 'Phòng ngủ 1'], `${q.ten}: mã tủ = tên khung, tên phòng`);
    ok(q.cao > 2440 ? r.spec.than.cao_duoi > 0 : r.spec.than.cao_duoi === 0, `${q.ten}: chia thân theo khổ ván`, r.spec.than);
  }
  eq(P.tuChoKhung(C, C.DEFAULT_SPEC, { rong: 2000, cao: 2700, sau: 600 }).mau, ['TA4-2000'], '2000 → mẫu 4 cánh');
  eq(P.tuChoKhung(C, C.DEFAULT_SPEC, { rong: 4200, cao: 2700, sau: 600 }).mau, ['TA6-3000', 'TA2-1000'], '4200 → 8 cánh = 6 + 2');
  eq(P.tuChoKhung(C, C.DEFAULT_SPEC, { rong: 3500, cao: 2700, sau: 600 }).mau, ['TA5-2500', 'TA2-1000'], '3500 → 7 cánh = 5 + 2 (không để lẻ 1 cánh)');
  eq(P.tuChoKhung(C, C.DEFAULT_SPEC, { rong: 450, cao: 2700, sau: 600 }).mau, ['1 cánh, đợt đều'], 'khung hẹp 450 → 1 cánh, không ngăn kéo');
  for (const cao of [700, 1000, 2000, 2440, 2441, 2500, 2600, 2800, 3000]) for (const rong of [400, 450, 600, 1000, 2000, 5000]) {
    const r = P.tuChoKhung(C, C.DEFAULT_SPEC, { rong, cao, sau: 600 }), M = C.build(r.spec), bb = C.bbox(M.parts);
    ok(M.errors.length === 0 && bb.x1 - bb.x0 === rong && bb.z1 - bb.z0 === cao, `khung ${rong} × ${cao}: dựng được, đúng phủ bì`, M.errors);
  }
  eq(P.tuChoKhung(C, C.DEFAULT_SPEC, { rong: 1000, cao: 2441, sau: 600 }).spec.than.cao_duoi, 2041, 'vừa quá khổ ván: thân trên giữ 400');
  const m = P.tuChoKhung(C, C.DEFAULT_SPEC, { rong: 2000, cao: 2700, sau: 600, mau: 'TA4-2000-2T' });
  eq([m.mau, m.ghi_chu], [['TA4-2000-2T'], []], 'chọn mẫu thì dùng đúng mẫu');
  const thap = P.tuChoKhung(C, C.DEFAULT_SPEC, { rong: 1000, cao: 1200, sau: 500 });
  ok(co(thap.ghi_chu, /Khung thấp: đã bỏ \d+ đợt/), 'khung thấp: bỏ đợt quá cao', thap.ghi_chu);
  eq(C.build(thap.spec).errors, [], 'khung thấp vẫn dựng được');
  ok(P.tuChoKhung(C, Object.assign({}, C.DEFAULT_SPEC, { chan: { cao: 80 } }), { rong: 2000, cao: 2700, sau: 600 }).spec.chan.cao === 80, 'giữ Chuẩn xưởng đang dùng (chân 80)');
});

T('Nét khung dây của phòng', () => {
  const H = P.hinhHoc(P.macDinh()), N = P.duongNet(H);
  eq(N.filter(n => n.lop === 'tuong').length, 12, '4 tường × (chân, đỉnh, cạnh đứng)');
  eq(N.filter(n => n.lop === 'mo').length, 4, 'cửa: 1 khung chữ nhật');
  ok(N.every(n => n.a.length === 3 && n.b.length === 3 && n.a.concat(n.b).every(Number.isFinite)), 'mọi nét có 2 điểm 3 chiều');
  const H2 = P.hinhHoc({ cao: 2700, goc: [100, 200, 0], tuong: [{ dai: 2000 }], can: [{ tuong: 0, loai: 'cot', cach: 0, rong: 300, nho: 200, z0: 0, z1: 2700 }] }), N2 = P.duongNet(H2);
  eq(N2.filter(n => n.lop === 'can').length, 12, 'cột: hộp 12 cạnh');
  eq(N2[0].a, [100, 200, 0], 'cộng điểm đặt phòng');
  eq(N2.filter(n => n.lop === 'tuong').length, 4, 'phòng hở: thêm cạnh đứng ở cuối tường cuối');
});

T('Hình vẽ: mặt bằng, mặt đứng', () => {
  const p = P.macDinh(); p.khung = [{ ten: 'K1', tuong: 0, cach: 0, rong: 2000, cao: 2700, sau: 600 }]; p.can = [{ tuong: 0, loai: 'dam', cach: 0, rong: 3600, nho: 200 }];
  const H = P.hinhHoc(p), s = P.matBangSVG(H, { rong_px: 400, chon_tuong: 0, chon_khung: 0 });
  ok(/^<svg[^>]+viewBox="[-\d. ]+"[^>]*>/.test(s) && /<\/svg>$/.test(s), 'là SVG');
  ok(!/NaN|undefined|Infinity/.test(s), 'không có số hỏng');
  eq((s.match(/data-tuong="/g) || []).length, 4, '4 vùng bấm tường'); eq((s.match(/data-khung="/g) || []).length, 1, '1 vùng bấm khung');
  ok(/>3600</.test(s) && />3000 \(tự tính\)</.test(s), 'ghi chiều dài, đánh dấu tường tự tính');
  const d = P.matDungSVG(H, 0, { rong_px: 400, chon_khung: 0 });
  ok(/Tường A/.test(d) && /2000 × 2700 · sâu 600/.test(d) && /Dầm nhô 200/.test(d) && !/NaN|undefined/.test(d), 'mặt đứng tường A có khung + dầm');
  ok(/1600/.test(d), 'ghi khoảng còn lại bên phải khung');
  ok(/Cửa đi/.test(P.matDungSVG(H, 2)), 'mặt đứng tường C có cửa');
  eq(P.matDungSVG(H, 7), '', 'tường không có → rỗng');
  const ho = P.matBangSVG(P.hinhHoc({ cao: 2700, tuong: [{ dai: 3600 }, { dai: 3000 }, { dai: 3500 }, { dai: 3000 }] }));
  ok(/hở 100/.test(ho) && !/NaN/.test(ho), 'phòng hở: vẽ khe hở');
  ok(!/NaN/.test(P.matBangSVG(P.hinhHoc({ tuong: [] }))), 'phòng rỗng không hỏng');
  // bản 1.12: số đo bấm sửa được ngay trên hình
  ok(!/data-sua/.test(s) && !/data-sua/.test(d), 'mặc định (hình tĩnh): không có vùng sửa số đo');
  const p2 = P.macDinh(); p2.can = [{ tuong: 1, loai: 'cot', cach: 500, rong: 300, nho: 200 }];
  const H2 = P.hinhHoc(p2), s2 = P.matBangSVG(H2, { sua: true }), d2 = P.matDungSVG(H2, 0, { sua: true });
  eq((s2.match(/data-sua="[^"]+"/g) || []).map(x => x.slice(10, -1)).sort(), ['can.0.nho', 'can.0.rong', 'mo.0.cach', 'mo.0.rong', 'tuong.0.dai', 'tuong.1.dai', 'tuong.2.dai', 'tuong.3.dai'], 'mặt bằng sua: dài từng tường, rộng + cách trái của cửa, rộng + nhô của cột');
  ok(/data-sua="tuong.3.dai"[\s\S]*?>3000 \(tự tính\)</.test(s2) && />cửa 900</.test(s2) && />200</.test(s2) && !/NaN|undefined/.test(s2), 'số đo vẫn ghi đúng (tường tự tính, cửa 900, cách 200)');
  eq((d2.match(/data-sua="[^"]+"/g) || []).map(x => x.slice(10, -1)), ['tuong.0.dai', 'cao'], 'mặt đứng sua: dài tường + cao trần');
  const p3 = P.macDinh(); p3.tuong[0].cao = 2400;
  ok(/data-sua="tuong.0.cao"/.test(P.matDungSVG(P.hinhHoc(p3), 0, { sua: true })), 'tường có chiều cao riêng: sửa chiều cao của tường đó');
});

T('Khấu cột (bản 1.13): cột trùm đầu khung → tủ vào khung tự khấu', () => {
  const p = P.macDinh();
  p.can = [{ tuong: 0, loai: 'cot', cach: 0, rong: 300, nho: 220 }, { tuong: 0, loai: 'cot', cach: 1500, rong: 200, nho: 200 }, { tuong: 0, loai: 'dam', cach: 0, rong: 3600, nho: 200, z0: 2400, z1: 2700 }];
  p.khung = [{ tuong: 0, ten: 'TA-K', cach: 0, rong: 1400, cao: 2300, sau: 600 }, { tuong: 0, ten: 'TA-G', cach: 1450, rong: 1500, cao: 2300, sau: 600 }, { tuong: 1, ten: 'TA-B', cach: 0, rong: 1200, cao: 2300, sau: 600 }];
  const H = P.hinhHoc(p);
  eq(P.viTriCot(H.khung[0], H.can[0]), { vi_tri: 'trai', rong: 300, sau: 220, sat_tuong: true, cach: 0 }, 'cột sát góc trái khung → khấu trái 300 × 220');
  eq(P.viTriCot(H.khung[1], H.can[1]), { vi_tri: 'giua', rong: 200, sau: 200, sat_tuong: true, cach: 50 }, 'cột giữa khung, sát tường → khấu cột giữa (bản 1.14), cách đầu trái khung 50');
  eq(P.viTriCot(H.khung[0], H.can[1]), null, 'cột ngoài khung → không liên quan');
  eq(P.viTriCot(H.khung[0], H.can[2]), null, 'dầm không phải cột');
  eq(P.khauChoKhung(H, 0), { trai: { rong: 300, sau: 220 }, phai: { rong: 0, sau: 0 }, giua_cot: [], giua: [] }, 'khấu của khung 1');
  eq([P.khauChoKhung(H, 1).giua_cot, P.khauChoKhung(H, 1).giua], [[{ cach: 50, rong: 200, sau: 200 }], []], 'khung 2 có 1 cột giữa sát tường');
  ok(co(H.ghi_chu, /Khung TA-K: cột 1 trùm đầu trái khung \(300 × sâu 220\) — tủ vẽ vào khung này sẽ được KHẤU CỘT/), 'ghi chú báo sẽ khấu (không còn là lưu ý vướng)', H.ghi_chu);
  ok(!co(H.luu_y, /TA-K vướng cột/) && !co(H.luu_y, /TA-G vướng cột 2/) && co(H.ghi_chu, /Khung TA-G: cột 2 nằm giữa khung \(cách đầu trái 50, 200 × sâu 200\) — tủ vẽ vào khung này sẽ được KHẤU CỘT GIỮA/), 'cột giữa khung sát tường: ghi chú sẽ khấu cột giữa (không còn là lưu ý vướng)', [H.luu_y, H.ghi_chu]);
  const r = P.tuChoKhung(C, C.DEFAULT_SPEC, H.khung[0], 'Phòng ngủ', H, 0), M = C.build(r.spec), bb = C.bbox(M.parts);
  eq([r.spec.khau.trai, r.spec.khau.phai], [{ rong: 300, sau: 220 }, { rong: 0, sau: 0 }], 'thông số tủ mang khấu trái');
  eq(M.errors, [], 'tủ khấu cột dựng không lỗi'); eq([bb.x1 - bb.x0, bb.z1 - bb.z0], [1400, 2300], 'vẫn phủ bì đúng khung');
  ok(M.parts.some(x => x.ten === 'Vách khấu cột') || /vách trùng mép cột/.test(r.ghi_chu.join(' ')), 'có vách khấu (hoặc vách khoang trùng mép cột)', r.ghi_chu);
  ok(co(r.ghi_chu, /Khấu cột trái: cột lấn 300 ngang × 220 sâu \(hở 15\)/), 'ghi chú khấu (khe hở mặc định 15 từ bản 1.17.1)', r.ghi_chu);
  ok(M.parts.filter(x => x.khau && x.khau.length).length >= 2, 'đáy + nóc có góc khoét');
  const r20 = P.tuChoKhung(C, Object.assign({}, C.DEFAULT_SPEC, { khau: { ho: 20 } }), H.khung[0], 'Phòng ngủ', H, 0);
  ok(r20.spec.khau.ho === 20 && co(r20.ghi_chu, /\(hở 20\)/) && C.build(r20.spec).info.khau[0].x === 320, 'khe hở người dùng đã gõ (20) được giữ khi mở khung thành tủ: mặt bên cột + 20', [r20.spec.khau, r20.ghi_chu]);
  // cột khai ở tường bên cạnh (tường D, sát góc A–D) cũng trùm đầu trái khung tường A
  const p2 = P.macDinh(); p2.can = [{ tuong: 3, loai: 'cot', cach: 2750, rong: 250, nho: 300 }]; p2.khung = [{ tuong: 0, ten: 'TA-K', cach: 0, rong: 1400, cao: 2300, sau: 600 }];
  const H2 = P.hinhHoc(p2);
  eq(P.khauChoKhung(H2, 0).trai, { rong: 300, sau: 250 }, 'cột khai ở tường D sát góc → khấu trái của khung tường A (rộng = độ nhô, sâu = bề rộng cột)');
  // cột đầu phải + đổi khung khác thì khấu được đặt lại
  const p3 = P.macDinh(); p3.can = [{ tuong: 0, loai: 'cot', cach: 1200, rong: 200, nho: 150 }]; p3.khung = [{ tuong: 0, ten: 'K1', cach: 0, rong: 1400, cao: 2300, sau: 600 }, { tuong: 0, ten: 'K2', cach: 1600, rong: 1000, cao: 2300, sau: 600 }];
  const H3 = P.hinhHoc(p3), r3 = P.tuChoKhung(C, C.DEFAULT_SPEC, H3.khung[0], '', H3, 0);
  eq(r3.spec.khau.phai, { rong: 200, sau: 150 }, 'cột đầu phải → khấu phải'); eq(C.build(r3.spec).errors, [], 'dựng không lỗi');
  eq(P.tuChoKhung(C, r3.spec, H3.khung[1], '', H3, 1).spec.khau.phai, { rong: 0, sau: 0 }, 'sang khung không có cột: bỏ khấu của tủ trước');
});

T('Khấu cột GIỮA: cột sát tường nằm giữa khung → cột nằm TRONG khoang, khoang giữ cân đối (bản 1.23 — anh Jason 04/10/2026 23:02)', () => {
  // khung 2400 → ruột TA5-2500: khoang lọt lòng 67,5…961,5 | 979…1872 | 1907…2332,5. Cột 300 × 220 cách đầu trái khung 1300 → vùng khấu 1285…1615 nằm lọt trong khoang 2
  const p = P.macDinh();
  p.can = [{ tuong: 0, loai: 'cot', cach: 1700, rong: 300, nho: 220 }];
  p.khung = [{ tuong: 0, ten: 'TA-G', cach: 400, rong: 2400, cao: 2300, sau: 600 }];
  const H = P.hinhHoc(p);
  eq(P.khauChoKhung(H, 0).giua_cot, [{ cach: 1300, rong: 300, sau: 220 }], 'cột cách đầu trái khung 1300');
  ok(co(H.ghi_chu, /Khung TA-G: cột 1 nằm giữa khung \(cách đầu trái 1300, 300 × sâu 220\) — tủ vẽ vào khung này sẽ được KHẤU CỘT GIỮA \(cột nằm trong khoang, khoang giữ nguyên\)/), 'ghi chú của phòng: cột nằm trong khoang', H.ghi_chu);
  const r = P.tuChoKhung(C, C.DEFAULT_SPEC, H.khung[0], 'Phòng ngủ', H, 0), M = C.build(r.spec), bb = C.bbox(M.parts);
  eq(r.spec.khau.giua, [{ cach: 1300, rong: 300, sau: 220 }], 'thông số tủ mang cột giữa');
  eq(M.errors, [], 'dựng không lỗi'); eq([bb.x1 - bb.x0, bb.z1 - bb.z0], [2400, 2300], 'vẫn phủ bì đúng khung');
  // cùng khung đó mà phòng không có cột: tủ phải chia khoang, đặt đợt Y HỆT
  const p0 = P.macDinh(); p0.khung = p.khung; const H0 = P.hinhHoc(p0), r0 = P.tuChoKhung(C, C.DEFAULT_SPEC, H0.khung[0], 'Phòng ngủ', H0, 0), M0 = C.build(r0.spec);
  eq(r.spec.khoang, r0.spec.khoang, 'khoang, cánh, đợt, ngăn kéo y hệt tủ không có cột: không thêm vách, không thêm đợt, không ghim bề rộng khoang');
  eq([M.info.khoang, M.info.x_khoang], [[894, 893, 425.5], [67.5, 979, 1907]], 'bề rộng lọt lòng từng khoang giữ nguyên (cân đối như tủ không có cột)');
  eq([M0.info.khoang, M0.info.x_khoang], [M.info.khoang, M.info.x_khoang], '… đúng bằng tủ không cột');
  ok(r.spec.khoang.every(k => k.rong === 'auto'), 'mọi khoang vẫn để tự chia', r.spec.khoang.map(k => k.rong));
  const dem = (Mx, loai) => Mx.parts.filter(x => x.loai === loai && !x.khau_cot).length;
  eq([dem(M, 'VACH'), dem(M, 'DOT'), dem(M, 'HOI')], [dem(M0, 'VACH'), dem(M0, 'DOT'), dem(M0, 'HOI')], 'số vách, số đợt, số hồi không đổi');
  const K = M.info.khau[0];
  eq([K.ben, K.xa, K.xb, K.co_a, K.co_b], ['giua', 1285, 1615, false, false], 'vùng khấu = cột + hở 15 mỗi bên, nằm lọt trong khoang 2');
  const khoet = M.parts.filter(x => x.khau && x.khau.length);
  ok(khoet.length >= 3 && khoet.every(x => x.khoang === 1 && x.khau[0].ben === 'giua' && x.khau[0].x0 === 1267.5 && x.khau[0].x1 === 1632.5), 'đáy / nóc / đợt của khoang 2 khoét chữ U quanh hộp che cột', khoet.map(x => [x.loai, x.khoang, x.khau]));
  eq(M.parts.filter(x => x.ten === 'Vách khấu cột').map(x => [x.x0, x.x1]).slice(0, 2), [[1267.5, 1285], [1615, 1632.5]], '2 vách khấu ôm hai mặt bên cột (hộp che cột) — không phải vách của khoang');
  ok(M.parts.filter(x => x.ten === 'Hậu khấu cột').every(x => x.x0 === 1285 && x.x1 === 1615) && M.parts.some(x => x.ten === 'Hậu khấu cột'), 'hậu khấu trước mặt cột đúng bề rộng vùng cột');
  ok(co(r.ghi_chu, /Khấu cột giữa: cách đầu trái 1300, cột 300 ngang × 220 sâu \(hở 15\)/) && co(r.ghi_chu, /Cột giữa nằm trong khoang — khoang giữ nguyên, đáy \/ nóc \/ đợt khoét quanh cột/) && !co(r.ghi_chu, /khoang nông|dời|thêm vách/), 'ghi chú: cột nằm trong khoang, không dời / thêm vách', r.ghi_chu);
  // mép cột rơi sát vách (cột cách đầu trái khung 1000 → mép vùng khấu 985, vách 961,5…979): vùng khấu nới 6 tới mặt vách, vách đó làm vách khấu — khoang vẫn giữ nguyên
  const ps = P.macDinh(); ps.can = [{ tuong: 0, loai: 'cot', cach: 1400, rong: 300, nho: 220 }]; ps.khung = p.khung;
  const Hs = P.hinhHoc(ps), rs = P.tuChoKhung(C, C.DEFAULT_SPEC, Hs.khung[0], 'Phòng ngủ', Hs, 0), Ms = C.build(rs.spec), Ks = Ms.info.khau[0];
  eq([Ms.errors, rs.spec.khoang, Ms.info.khoang, [Ks.xa, Ks.xb, Ks.co_a, Ks.co_b]], [[], r0.spec.khoang, [894, 893, 425.5], [979, 1315, true, false]], 'mép cột sát vách: không dời vách, không lỗi — vùng khấu nới tới mặt vách');
  // cột góc: cũng không còn ghim bề rộng khoang sát cột
  const pg = P.macDinh(); pg.can = [{ tuong: 0, loai: 'cot', cach: 400, rong: 900, nho: 220 }]; pg.khung = p.khung;
  const Hg = P.hinhHoc(pg), rg = P.tuChoKhung(C, C.DEFAULT_SPEC, Hg.khung[0], 'Phòng ngủ', Hg, 0), Mg = C.build(rg.spec);
  eq([Mg.errors, rg.spec.khoang, Mg.info.khoang, rg.spec.khau.trai], [[], r0.spec.khoang, [894, 893, 425.5], { rong: 900, sau: 220 }], 'cột góc rộng 900 (mép cột + hở = 915, sát vách 961,5): tủ vẫn dựng được, khoang y hệt tủ không cột');
  eq([Mg.info.khau[0].x, Mg.info.khau[0].vach_co_san], [961.5, true], '… vùng khấu nới tới mặt vách, vách làm vách khấu');
  ok(!co(rg.ghi_chu, /Đã chỉnh bề rộng khoang/), 'không còn tự chỉnh bề rộng khoang sát cột', rg.ghi_chu);
  // cột KHÔNG sát tường (đứng rời) thì chưa khấu được
  const p2 = P.macDinh(); p2.can = [{ tuong: 1, loai: 'cot', cach: 1000, rong: 300, nho: 2400 }]; p2.khung = [{ tuong: 0, ten: 'K', cach: 0, rong: 2000, cao: 2300, sau: 600 }];
  ok(P.khauChoKhung(P.hinhHoc(p2), 0).giua_cot.length === 0, 'cột không sát tường của khung: không coi là cột giữa');
});

T('Cột nằm sau khoang có ngăn kéo: đổi chỗ khoang cho ngăn kéo tránh cột, không cứu được thì bỏ ngăn kéo khoang đó (bản 1.23)', () => {
  // khung 2000 → ruột TA4-2000: khoang 1 suốt treo, khoang 2 có 2 ngăn kéo âm + 5 đợt. Cột 300 × 350 nằm sau khoang 2 → thùng trước cột chỉ còn sâu ~200, hộp ngăn kéo 150 không làm được
  const kh = (cach, sau) => ({ trai: { rong: 0, sau: 0 }, phai: { rong: 0, sau: 0 }, giua_cot: [{ cach, rong: 300, sau: sau || 350 }], giua: [] });
  const q = khau => ({ ten: 'T', rong: 2000, cao: 2700, sau: 600, mau: '', khau });
  const noi = r => r.spec.khoang.map(k => (k.o || []).map(c => c.kieu).join('+'));
  const r0 = P.tuChoKhung(C, C.DEFAULT_SPEC, q(null), '', null, -1), M0 = C.build(r0.spec);
  eq([noi(r0), M0.errors], [['suot', 'nk_am'], []], 'tủ 2000 không cột: khoang 1 suốt treo, khoang 2 ngăn kéo');
  const r = P.tuChoKhung(C, C.DEFAULT_SPEC, q(kh(1300)), '', null, -1), M = C.build(r.spec);
  eq(M.errors, [], 'cột sau khoang ngăn kéo: tủ vẫn dựng được');
  eq(noi(r), ['nk_am', 'suot'], 'hai khoang đổi chỗ cho nhau: ngăn kéo sang khoang không có cột');
  eq([r.spec.khoang.length, r.spec.khoang.map(k => k.dot), r.spec.khoang.map(k => k.rong)], [2, r0.spec.khoang.map(k => k.dot).reverse(), ['auto', 'auto']], 'không thêm / bớt khoang, đợt nào vẫn nguyên đợt ấy, khoang vẫn tự chia');
  eq(M.info.khoang, M0.info.khoang, 'bề rộng khoang vẫn cân đối như tủ không cột');
  ok(co(r.ghi_chu, /đổi chỗ các khoang .*ngăn kéo tránh cột/), 'ghi chú đổi chỗ', r.ghi_chu);
  // cột trùm cả hai khoang (đè lên vách giữa): đổi chỗ không cứu được → bỏ ngăn kéo ở khoang dính cột, có ghi chú; đợt giữ nguyên, khoang không đổi chỗ
  const r2 = P.tuChoKhung(C, C.DEFAULT_SPEC, q(kh(850)), '', null, -1), M2 = C.build(r2.spec);
  eq(M2.errors, [], 'cột trùm vách giữa: tủ vẫn dựng được');
  eq([noi(r2), r2.spec.khoang.map(k => k.dot)], [['suot', ''], r0.spec.khoang.map(k => k.dot)], 'bỏ ngăn kéo ở khoang dính cột; đợt giữ nguyên, khoang không đổi chỗ');
  ok(co(r2.ghi_chu, /Khoang 2: .*không đủ sâu cho hộp ngăn kéo.*đã bỏ ngăn kéo/), 'ghi chú bỏ ngăn kéo', r2.ghi_chu);
  // tủ 3 khoang (khung 2500 → TA5-2500: suốt | ngăn kéo + suốt | 1 cánh 5 đợt), cột sau khoang GIỮA: lật trái ↔ phải không cứu được → đổi chỗ khoang ngăn kéo với khoang kề cùng số cánh
  const q25 = khau => ({ ten: 'T', rong: 2500, cao: 2700, sau: 600, mau: '', khau });
  const r5 = P.tuChoKhung(C, C.DEFAULT_SPEC, q25(null), '', null, -1), M5 = C.build(r5.spec);
  eq(noi(r5), ['suot', 'nk_am+suot', ''], 'tủ 2500 không cột');
  const xg = Math.round(M5.info.x_khoang[1] + M5.info.khoang[1] / 2 - 150);      // cột 300 nằm giữa khoang 2
  const r6 = P.tuChoKhung(C, C.DEFAULT_SPEC, q25(kh(xg)), '', null, -1), M6 = C.build(r6.spec);
  eq([M6.errors, noi(r6), r6.spec.khoang.map(k => k.canh), M6.info.khoang], [[], ['nk_am+suot', 'suot', ''], [2, 2, 1], M5.info.khoang], 'cột sau khoang giữa: khoang ngăn kéo đổi chỗ với khoang 1 (cùng 2 cánh), khoang cuối đứng yên, bề rộng giữ nguyên');
  ok(co(r6.ghi_chu, /Đã đổi chỗ khoang 2 ↔ khoang 1 cho ngăn kéo tránh cột/), 'ghi chú đổi chỗ 2 khoang', r6.ghi_chu);
  // cột nông (200): ngăn kéo ngắn lại là đủ → không đổi gì
  const r3 = P.tuChoKhung(C, C.DEFAULT_SPEC, q(kh(1300, 200)), '', null, -1);
  eq([C.build(r3.spec).errors, r3.spec.khoang], [[], r0.spec.khoang], 'cột nông: ngăn kéo ngắn lại là đủ, không đổi chỗ, không bỏ gì');
  // tủ nông sẵn (không do cột): không tự ý đổi chỗ / bỏ ngăn kéo — để lỗi cho người dùng thấy
  const r4 = P.tuChoKhung(C, C.DEFAULT_SPEC, { ten: 'T', rong: 2000, cao: 2700, sau: 240, mau: '', khau: null }, '', null, -1);
  eq([noi(r4), C.build(r4.spec).errors.some(e => /quá nông cho ngăn kéo/.test(e))], [['suot', 'nk_am'], true], 'tủ nông sẵn: giữ nguyên, lỗi vẫn báo');
  // lõi ghi lại khoang nào ngăn kéo vướng cột
  const sc = C.normalize(Object.assign({}, r0.spec, { khau: { giua: [{ cach: 1300, rong: 300, sau: 350 }] } }));
  eq([C.build(sc).info.nk_vuong_cot, C.build(r0.spec).info.nk_vuong_cot], [[1], []], 'Core.build: info.nk_vuong_cot = khoang có ngăn kéo không đủ sâu vì cột');
});

T('Vẽ lại phòng không vẽ chồng (bản 1.23 — anh Jason 04/10/2026 23:06 "vẽ phòng hay bị … chỉ vẽ được 0/4 tường"): đối chiếu phòng sắp vẽ với phòng đang có trên bản vẽ', () => {
  // phòng 3000 × 2400 như đã đo trên Chenfeng thật 04/10/2026: tường dày 110 nằm NGOÀI lòng phòng; mặt trong của từng tường = đúng cạnh lòng phòng; cột cao hết tường; hộp lỗ cửa = bề rộng × bề dày tường × cao
  const p = { ten: 'P', cao: 2700, day: 110, tuong: [{ dai: 3000 }, { dai: 2400 }, { dai: 3000 }, { dai: 'auto' }],
    mo: [{ tuong: 2, loai: 'cua', cach: 200, rong: 900, cao: 2200, be: 0 }, { tuong: 1, loai: 'cua_so', cach: 600, rong: 1200, cao: 1200, be: 900 }],
    can: [{ tuong: 0, loai: 'cot', cach: 1200, rong: 300, nho: 200 }, { tuong: 0, loai: 'dam', cach: 0, rong: 3000, nho: 250, z0: 2350, z1: 2700 }], goc: [0, 0, 0] };
  const moi = P.phanPhong(P.hinhHoc(p), 110);
  eq(moi.tuong.map(w => [w.i, w.a, w.b, w.z, w.cao, w.day]), [[0, [0, 0], [3000, 0], 0, 2700, 110], [1, [3000, 0], [3000, -2400], 0, 2700, 110], [2, [3000, -2400], [0, -2400], 0, 2700, 110], [3, [0, -2400], [0, 0], 0, 2700, 110]], 'tường: mặt trong từng tường trong toạ độ bản vẽ');
  eq([moi.mo.map(m => m.hop), moi.cot.map(m => m.hop), moi.dam.map(m => m.hop)], [[[1900, 2800, -2510, -2400, 0, 2200], [3000, 3110, -1800, -600, 900, 2100]], [[1200, 1500, -200, 0, 0, 2700]], [[0, 3000, -250, 0, 2350, 2700]]], 'hộp của cửa, cửa sổ, cột, dầm — đúng số đo trên Chenfeng thật');
  eq(P.phanPhong(P.hinhHoc(Object.assign({}, p, { goc: [1000, 500, 50] })), 110).cot[0].hop, [2200, 2500, 300, 500, 50, 2750], 'điểm đặt phòng dời thì mọi thứ dời theo');
  // đối tượng phòng đang có trên bản vẽ (như bộ điều khiển đọc ra): mỗi tường 2 mặt (trong + ngoài), hộp bao
  const tuongThat = (a, b, day, cao) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), u = [dx / L * day, dy / L * day], n = [-dy / L * day, dx / L * day];      // n: sang TRÁI hướng đi = ra ngoài phòng (đi theo chiều kim đồng hồ); mặt ngoài dài thêm một bề dày ở mỗi đầu (góc ngoài) như Chenfeng thật
    return { mat: [[a, b], [[a[0] + n[0] - u[0], a[1] + n[1] - u[1]], [b[0] + n[0] + u[0], b[1] + n[1] + u[1]]]], day, cao: cao || 2700, z: 0 }; };
  eq(tuongThat([0, 0], [3000, 0], 110).mat[1], [[-110, 110], [3110, 110]], '(dữ liệu thử) mặt ngoài tường A như đo trên Chenfeng thật');
  const ghi = (m, c) => P.banGhiPhong(m, { mo: c.lo.map(x => x.hop), cot: c.cot.map(x => x.hop), dam: c.dam.map(x => x.hop) });
  const banVe = m => ({ tuong: m.tuong.map(w => tuongThat(w.a, w.b, w.day, w.cao)), lo: m.mo.map(x => ({ hop: x.hop })), cot: m.cot.map(x => ({ hop: x.hop })), dam: m.dam.map(x => ({ hop: x.hop })) });
  const trong = { tuong: [], lo: [], cot: [], dam: [] };
  // 1. bản vẽ trống: vẽ tất, tường là MỘT chuỗi khép kín
  let k = P.doiChieuPhong(moi, trong, null);
  eq([k.tuong.map(t => t.co), k.ve_tuong, k.mo.map(t => t.co), k.cot.map(t => t.co), k.dam.map(t => t.co), k.bo], [[-1, -1, -1, -1], [{ diem: [[0, 0, 0], [3000, 0, 0], [3000, -2400, 0], [0, -2400, 0]], khep: true, tuong: [0, 1, 2, 3] }], [-1, -1], [-1], [-1], { tuong: [], lo: [], cot: [], dam: [] }], 'bản vẽ trống: vẽ cả phòng, tường một chuỗi khép kín, không bỏ gì');
  // 2. phòng y hệt đã có (trường hợp anh gặp): không vẽ lại gì, không bỏ gì
  const co1 = banVe(moi);
  k = P.doiChieuPhong(moi, co1, null);
  eq([k.tuong.map(t => t.co), k.ve_tuong, k.mo.map(t => t.co), k.cot.map(t => t.co), k.dam.map(t => t.co), k.bo, k.chong], [[0, 1, 2, 3], [], [0, 1], [0], [0], { tuong: [], lo: [], cot: [], dam: [] }, []], 'phòng y hệt đã có trên bản vẽ: giữ tất, không vẽ chồng');
  // 3. thêm một cột + một cửa rồi vẽ lại: chỉ vẽ cái mới
  const p3 = JSON.parse(JSON.stringify(p)); p3.can.push({ tuong: 2, loai: 'cot', cach: 100, rong: 250, nho: 250 }); p3.mo.push({ tuong: 3, loai: 'cua', cach: 500, rong: 800, cao: 2100, be: 0 });
  const moi3 = P.phanPhong(P.hinhHoc(p3), 110);
  k = P.doiChieuPhong(moi3, co1, ghi(moi, co1));
  eq([k.ve_tuong, k.mo.map(t => t.co), k.cot.map(t => t.co), k.bo], [[], [0, 1, -1], [0, -1], { tuong: [], lo: [], cot: [], dam: [] }], 'thêm cột + cửa: tường giữ nguyên, chỉ vẽ cột mới và cửa mới');
  // 4. có bản ghi lần vẽ trước + đổi tường B 2400 → 3000: tường A giữ, B / C / D cũ bỏ đi rồi vẽ lại bằng MỘT chuỗi hở B → C → D; cửa cũ trên tường cũ, cột, dầm cũ không còn khớp thì bỏ
  const p4 = JSON.parse(JSON.stringify(p)); p4.tuong[1].dai = 3000;
  const moi4 = P.phanPhong(P.hinhHoc(p4), 110), cu = ghi(moi, co1);
  k = P.doiChieuPhong(moi4, co1, cu);
  eq([k.tuong.map(t => t.co), k.bo.tuong, k.ve_tuong], [[0, -1, -1, -1], [1, 2, 3], [{ diem: [[3000, 0, 0], [3000, -3000, 0], [0, -3000, 0], [0, 0, 0]], khep: false, tuong: [1, 2, 3] }]], 'đổi dài tường B: bỏ B, C, D cũ (của lần vẽ trước), vẽ lại bằng một chuỗi hở nối vào tường A còn giữ');
  eq([k.mo.map(t => t.co), k.bo.lo, k.cot.map(t => t.co), k.dam.map(t => t.co), k.bo.cot, k.bo.dam], [[-1, 1], [0], [0], [0], [], []], 'cửa trên tường C dời theo tường → bỏ cửa cũ, vẽ cửa mới; cột, dầm trên tường A giữ nguyên. (Cửa sổ tường B khớp hộp cũ, nhưng nó mất theo tường B bị bỏ — máy vẽ đối chiếu lại sau khi vẽ tường rồi mới mở lỗ.)');
  // 5. KHÔNG có bản ghi (phòng vẽ từ bản trước / vẽ tay) + đổi tường B: bảng không tự xoá tường không chắc là của nó — vẽ phần thiếu và báo tường cũ nằm chồng
  k = P.doiChieuPhong(moi4, co1, null);
  eq([k.tuong.map(t => t.co), k.bo, k.chong, k.trong], [[0, -1, -1, -1], { tuong: [], lo: [], cot: [], dam: [] }, [1, 2, 3], [2]], 'không có bản ghi: không bỏ gì; báo tường cũ B, D nằm chồng một phần lên tường mới và tường cũ C nằm TRONG lòng phòng mới (cái này máy vẽ phải hỏi trước khi vẽ)');
  // … cột / dầm cũ không khớp mục nào của phòng mới mà nằm trong lòng phòng mới: ghi vào `thua` (bảng chỉ bỏ khi người dùng đồng ý bỏ phòng cũ)
  const co5 = banVe(moi); co5.cot.push({ hop: [500, 800, -2400, -2200, 0, 2700] }); co5.dam.push({ hop: [9000, 9500, -300, 0, 2300, 2700] });
  k = P.doiChieuPhong(moi4, co5, null);
  eq([k.thua, k.bo.cot, k.cot.map(t => t.co)], [{ cot: [1], dam: [] }, [], [0]], 'cột cũ lạc trong lòng phòng mới → thua.cot; dầm ở tận đâu ngoài phòng thì không tính');
  eq(P.doiChieuPhong(moi, co1, null).thua, { cot: [], dam: [] }, 'phòng y hệt: không có gì thừa');
  // 6. phòng bên cạnh dùng chung tường: tường D của phòng 2 nằm trên mặt NGOÀI tường B của phòng 1 → coi như đã có, không vẽ, không bỏ
  const p6 = { ten: 'P2', cao: 2700, day: 110, tuong: [{ dai: 2000 }, { dai: 2400 }, { dai: 2000 }, { dai: 'auto' }], goc: [3110, 0, 0] };
  const moi6 = P.phanPhong(P.hinhHoc(p6), 110);
  k = P.doiChieuPhong(moi6, co1, null);
  eq([k.tuong.map(t => [t.co, t.nam_tren]), k.ve_tuong.map(c => [c.tuong, c.khep, c.diem.length]), k.bo.tuong], [[[-1, false], [-1, false], [-1, false], [1, true]], [[[0, 1, 2], false, 4]], []], 'phòng kề chung tường: tường chung coi như đã có (nằm trên mặt tường sẵn có), 3 tường còn lại vẽ một chuỗi');
  // 7. chuỗi vắt qua đầu danh sách: thiếu tường D và A (liền nhau qua góc đầu phòng) → một chuỗi D → A
  const co7 = banVe(moi); co7.tuong = [co7.tuong[1], co7.tuong[2]];
  k = P.doiChieuPhong(moi, co7, null);
  eq(k.ve_tuong, [{ diem: [[0, -2400, 0], [0, 0, 0], [3000, 0, 0]], khep: false, tuong: [3, 0] }], 'thiếu D và A: một chuỗi D → A (nối qua góc đầu phòng), không tách làm hai lệnh');
  // 8. đổi bề dày tường (có bản ghi): tường cũ không còn đúng → bỏ hết, vẽ lại cả vòng
  const moi8 = P.phanPhong(P.hinhHoc(p), 200);
  k = P.doiChieuPhong(moi8, co1, cu);
  eq([k.bo.tuong, k.ve_tuong.length, k.ve_tuong[0].khep, k.mo.map(t => t.co)], [[0, 1, 2, 3], 1, true, [-1, -1]], 'đổi dày tường 110 → 200: bỏ 4 tường cũ, vẽ lại cả vòng; lỗ cửa cũ (theo tường dày 110) cũng vẽ lại');
  // 9. bản ghi của phòng mà trên bản vẽ không còn đối tượng nào khớp (người dùng đã xoá / mở bản vẽ khác): không bỏ gì, vẽ như bản vẽ trống
  k = P.doiChieuPhong(moi, trong, cu);
  eq([k.bo, k.ve_tuong.length], [{ tuong: [], lo: [], cot: [], dam: [] }, 1], 'bản ghi không còn khớp gì trên bản vẽ: vẽ như mới');
  // 10. dầm bị Chenfeng đặt lệch cao độ so với số muốn (đỉnh dầm không vượt trần): bản ghi nhớ cả hộp MUỐN lẫn hộp THẬT → lần sau vẫn nhận ra là đã có
  const co10 = banVe(moi); co10.dam[0].hop = [0, 3000, -250, 0, 2300, 2650];
  const cu10 = ghi(moi, co10);
  eq([cu10.dam, P.doiChieuPhong(moi, co10, cu10).dam.map(t => t.co), P.doiChieuPhong(moi, co10, null).dam.map(t => t.co)], [[{ m: [0, 3000, -250, 0, 2350, 2700], t: [0, 3000, -250, 0, 2300, 2650] }], [0], [-1]], 'dầm lệch cao độ: có bản ghi thì nhận ra dầm cũ, không vẽ chồng');
  // 11. bản ghi của một lần vẽ ở CHỖ KHÁC (cùng phòng đó nhưng điểm đặt đã đổi — đặt thêm một phòng giống hệt bên cạnh): không coi là phòng cũ phải bỏ
  const moiXa = P.phanPhong(P.hinhHoc(Object.assign({}, p, { goc: [8000, 0, 0] })), 110);
  k = P.doiChieuPhong(moiXa, co1, cu);
  eq([k.bo, k.ve_tuong.length, k.tuong.map(t => t.co), k.co_ban_ghi, P.doiChieuPhong(moi, co1, cu).co_ban_ghi], [{ tuong: [], lo: [], cot: [], dam: [] }, 1, [-1, -1, -1, -1], false, true], 'điểm đặt dời sang chỗ khác (không chồng lên phòng đã vẽ): phòng cũ giữ nguyên, vẽ thêm phòng mới; bản ghi không được dùng');
  // 12. kiểm sau khi vẽ: tường mới được coi là ĐÃ CÓ khi các mặt tường trên bản vẽ phủ kín đoạn đó — kể cả khi Chenfeng ghép nó với tường cũ thành nhiều mảnh
  const w12 = { a: [0, 0], b: [3000, 0], z: 0, cao: 2700, day: 110 };
  eq([P.tuongPhuKin(w12, { tuong: [tuongThat([0, 0], [3000, 0], 110)] }), P.tuongPhuKin(w12, { tuong: [tuongThat([0, 0], [1800, 0], 110), tuongThat([1910, 0], [3000, 0], 110)] }), P.tuongPhuKin(w12, { tuong: [tuongThat([0, 0], [1800, 0], 110)] }), P.tuongPhuKin(w12, { tuong: [] }), P.tuongPhuKin(w12, { tuong: [tuongThat([0, 0], [3000, 0], 110), tuongThat([0, -500], [3000, -500], 110)].slice(1) })],
    [true, true, false, false, false], 'tuongPhuKin: một mặt trùm kín → có; hai mảnh cách nhau một bề dày tường (tường khác cắt ngang) → có; thiếu một đoạn / không có tường / tường nằm đường khác → chưa có');
  // 13. lỗ cửa / cột / dầm vẽ TRÙNG (bản trước bấm "Vẽ phòng" hai lần: tường không chồng nhưng lỗ cửa, cột, dầm thành hai cái chồng khít nhau): cái thừa ghi vào `trung` để máy vẽ dọn — kể cả khi không có bản ghi
  const co13 = banVe(moi); co13.lo.push({ hop: co13.lo[0].hop.slice() }); co13.cot.push({ hop: co13.cot[0].hop.slice() }, { hop: co13.cot[0].hop.slice() }); co13.dam.push({ hop: co13.dam[0].hop.slice() });
  k = P.doiChieuPhong(moi, co13, null);
  eq([k.mo.map(t => t.co), k.cot.map(t => t.co), k.dam.map(t => t.co), k.trung, k.thua, k.bo], [[0, 1], [0], [0], { lo: [2], cot: [1, 2], dam: [1] }, { cot: [], dam: [] }, { tuong: [], lo: [], cot: [], dam: [] }],
    'lỗ cửa / cột / dầm chồng khít lên cái đang giữ: ghi vào `trung` (không phải cột "lạc trong phòng", không phải "của lần vẽ trước")');
  k = P.doiChieuPhong(moi, co13, ghi(moi, co1));
  eq([k.trung, k.bo], [{ lo: [2], cot: [1, 2], dam: [1] }, { tuong: [], lo: [], cot: [], dam: [] }], 'có bản ghi: cái chồng khít vẫn là "vẽ trùng" — không báo thành "bỏ … của lần vẽ trước"');
  eq(P.doiChieuPhong(moi, co1, null).trung, { lo: [], cot: [], dam: [] }, 'không có cái nào trùng: rỗng');
  const co13b = banVe(moi); co13b.cot.push({ hop: [1250, 1550, -200, 0, 0, 2700] });
  eq([P.doiChieuPhong(moi, co13b, null).trung.cot, P.doiChieuPhong(moi, co13b, null).thua.cot], [[], [1]], 'cột lệch 50 so với cột đang giữ: không phải vẽ trùng (vẫn là cột lạc trong phòng — chỉ bỏ khi người dùng đồng ý)');
  // … CỘT vẽ trùng trên Chenfeng thật không chồng khít: gặp cột đã có đúng chỗ, Chenfeng ĐẨY cột mới sang bên theo cạnh NGẮN của đáy cột (bằng nhau thì theo x), về phía dương, đúng một bề cột
  //   (đo 04/10/2026 — bản 1.22 bấm "Vẽ phòng" 2, 3 lần): cột tường A 300 × 200 [1200,1500,−200,0] → cột thừa [1200,1500,0,200] cao 1000 (ra sau lưng tường, ngoài phòng nên cao mặc định 1000),
  //   bấm lần nữa → [1200,1500,200,400]; cột tường B 250 × 400 → đẩy +x; cột tường C 350 × 150 → đẩy +y VÀO phòng (cao bằng tường); cột vuông tường D → đẩy +x vào phòng.
  const p4c = { ten: 'Bốn cột', cao: 2700, day: 110, tuong: [{ dai: 3000 }, { dai: 2400 }, { dai: 3000 }, { dai: 'auto' }], goc: [0, 0, 0],
    can: [{ tuong: 0, loai: 'cot', cach: 1200, rong: 300, nho: 200 }, { tuong: 1, loai: 'cot', cach: 800, rong: 400, nho: 250 }, { tuong: 2, loai: 'cot', cach: 500, rong: 350, nho: 150 }, { tuong: 3, loai: 'cot', cach: 1000, rong: 300, nho: 300 }] };
  const moi4c = P.phanPhong(P.hinhHoc(p4c), 110), co4c = banVe(moi4c);
  eq(moi4c.cot.map(c => c.hop), [[1200, 1500, -200, 0, 0, 2700], [2750, 3000, -1200, -800, 0, 2700], [2150, 2500, -2400, -2250, 0, 2700], [0, 300, -1400, -1100, 0, 2700]], '(dữ liệu thử) 4 cột trên 4 tường — đúng hộp đo trên Chenfeng thật');
  co4c.cot.push({ hop: [1200, 1500, 0, 200, 0, 1000] }, { hop: [3000, 3250, -1200, -800, 0, 1000] }, { hop: [2150, 2500, -2250, -2100, 0, 2700] }, { hop: [300, 600, -1400, -1100, 0, 2700] }, { hop: [1200, 1500, 200, 400, 0, 1000] });
  k = P.doiChieuPhong(moi4c, co4c, null);
  eq([k.cot.map(t => t.co), k.trung.cot, k.thua.cot], [[0, 1, 2, 3], [4, 5, 6, 7, 8], []], 'cột bị Chenfeng đẩy sang bên (1 hoặc nhiều bậc liền nhau, cùng cỡ đáy): nhận là cột vẽ trùng — kể cả cột bị đẩy vào trong phòng (không báo thành cột lạc)');
  const lech = hop => { const c = banVe(moi4c); c.cot.push({ hop }); const r = P.doiChieuPhong(moi4c, c, null); return [r.trung.cot, r.thua.cot]; };
  eq([lech([1200, 1500, 200, 400, 0, 1000]), lech([1200, 1500, 0, 150, 0, 1000]), lech([1200, 1500, -400, -200, 0, 2700]), lech([1500, 1800, -200, 0, 0, 2700])], [[[], []], [[], []], [[], [4]], [[], [4]]],
    'không phải cột vẽ trùng: cách một bậc trống (cột của phòng bên kia tường), khác cỡ đáy, nằm phía −y (Chenfeng chỉ đẩy về phía +), nằm sát bên theo cạnh DÀI (Chenfeng đẩy theo cạnh ngắn) — cột lạc trong phòng thì vẫn ghi vào `thua`');
  // cột sâu hơn rộng (200 × 300 trên tường A; 300 × 200 trên tường B) và cột vuông 250: đo trên Chenfeng thật → đẩy +x / +y / +x
  const p5 = JSON.parse(JSON.stringify(p4c)); p5.can = [{ tuong: 0, loai: 'cot', cach: 1200, rong: 200, nho: 300 }, { tuong: 1, loai: 'cot', cach: 800, rong: 200, nho: 300 }, { tuong: 0, loai: 'cot', cach: 2000, rong: 250, nho: 250 }];
  const moi5 = P.phanPhong(P.hinhHoc(p5), 110), co5c = banVe(moi5);
  eq(moi5.cot.map(c => c.hop), [[1200, 1400, -300, 0, 0, 2700], [2700, 3000, -1000, -800, 0, 2700], [2000, 2250, -250, 0, 0, 2700]], '(dữ liệu thử) hộp 3 cột như đo trên Chenfeng thật');
  co5c.cot.push({ hop: [1400, 1600, -300, 0, 0, 2700] }, { hop: [2700, 3000, -800, -600, 0, 2700] }, { hop: [2250, 2500, -250, 0, 0, 2700] });
  k = P.doiChieuPhong(moi5, co5c, null);
  eq([k.trung.cot, k.thua.cot], [[3, 4, 5], []], 'cột sâu hơn rộng: Chenfeng đẩy dọc tường (theo cạnh ngắn) — vẫn nhận ra là cột vẽ trùng');
  const c2 = banVe(moi4c); c2.cot.push({ hop: [1200, 1500, 0, 200, 0, 1000] }, { hop: [1200, 1500, 200, 400, 0, 2700] });
  eq(P.doiChieuPhong(moi4c, c2, null).trung.cot, [4], 'bậc thứ hai cao khác bậc thứ nhất (cột thật của phòng bên, cao bằng tường bên đó): không đụng');
  const p2k = JSON.parse(JSON.stringify(p4c)); p2k.can = [{ tuong: 0, loai: 'cot', cach: 1200, rong: 300, nho: 200 }, { tuong: 0, loai: 'cot', cach: 1500, rong: 300, nho: 200 }];
  const moi2k = P.phanPhong(P.hinhHoc(p2k), 110);
  eq(P.doiChieuPhong(moi2k, banVe(moi2k), null).trung.cot, [], 'hai cột cùng cỡ của chính phòng đứng sát nhau: đều là cột đang giữ, không cột nào là vẽ trùng');
  // … kể cả khi cột thứ hai đứng ĐÚNG chỗ Chenfeng sẽ đẩy cột vẽ trùng tới (sát bên theo cạnh ngắn: 2 cột 200 × 300 liền nhau dọc tường A)
  const p2n = JSON.parse(JSON.stringify(p4c)); p2n.can = [{ tuong: 0, loai: 'cot', cach: 1200, rong: 200, nho: 300 }, { tuong: 0, loai: 'cot', cach: 1400, rong: 200, nho: 300 }];
  const moi2n = P.phanPhong(P.hinhHoc(p2n), 110);
  eq([moi2n.cot.map(c => c.hop), P.doiChieuPhong(moi2n, banVe(moi2n), null).trung.cot], [[[1200, 1400, -300, 0, 0, 2700], [1400, 1600, -300, 0, 0, 2700]], []], 'hai cột của chính phòng liền nhau theo cạnh ngắn (cột sau đứng đúng "bậc đẩy" của cột trước): vẫn là hai cột đang giữ');
  // … và cột của LẦN VẼ TRƯỚC nay đã bỏ khỏi phòng, nằm đúng bậc đẩy đó: là "bỏ … của lần vẽ trước", không ghi thêm vào `trung` (không đếm hai lần)
  const p1n = JSON.parse(JSON.stringify(p2n)); p1n.can = [p2n.can[0]];
  const moi1n = P.phanPhong(P.hinhHoc(p1n), 110), kn = P.doiChieuPhong(moi1n, banVe(moi2n), ghi(moi2n, banVe(moi2n)));
  eq([kn.cot.map(t => t.co), kn.bo.cot, kn.trung.cot, kn.thua.cot], [[0], [1], [], []], 'bỏ bớt một cột khỏi phòng: cột đó nằm trong `bo`, không lẫn sang `trung`');
  // 14. dấu điện – nước cũ khi KHÔNG có bản ghi: nhận ra theo chỗ — tâm hộp của nét / chữ nằm trong lòng phòng sắp vẽ (dấu trên mặt tường nhô vào phòng 2 mm), cao độ từ sàn tới trần
  const tl = (h, m) => P.trongLongPhong(m || moi, h);
  eq([tl([890, 1010, -2, -2, 260, 340]), tl([1400, 1510, -310, -200, 1, 1]), tl([890, 1010, 0, 0, 260, 340]), tl([890, 1010, 110, 112, 260, 340]), tl([3112, 3112, -900, -700, 260, 340]), tl([890, 1010, -2, -2, 2800, 2900])], [true, true, true, false, false, false],
    'trongLongPhong: dấu trên mặt tường A (nhô 2 mm) / trên sàn / nằm đúng mép tường → trong; dấu sau lưng tường, dấu của phòng bên kia tường chung (cách 112), dấu cao hơn trần → ngoài');
  const pL = { ten: 'L', cao: 2700, day: 110, tuong: [{ dai: 4000, re: 90 }, { dai: 2000, re: 90 }, { dai: 1500, re: -90 }, { dai: 1500, re: 90 }, { dai: 2500, re: 90 }, { dai: 'auto', re: 90 }], goc: [0, 0, 0] }, moiL = P.phanPhong(P.hinhHoc(pL), 110);
  eq([moiL.kin, tl([3000, 3100, -3002, -3002, 300, 380], moiL), tl([1000, 1100, -3498, -3498, 300, 380], moiL), tl([2498, 2498, -2500, -2400, 300, 380], moiL)], [true, false, true, true], 'phòng chữ L: dấu nằm ở phần khuyết (trong hộp bao nhưng ngoài lòng phòng) không tính; dấu trên tường đáy và trên tường của phần khuyết thì tính');
  const moiHo = P.phanPhong(P.hinhHoc({ ten: 'Ho', cao: 2700, tuong: [{ dai: 3000, re: 90 }, { dai: 2400, re: 90 }], goc: [0, 0, 0] }), 110);
  eq([moiHo.kin, tl([890, 1010, -2, -2, 260, 340], moiHo), tl([2998, 2998, -1300, -1200, 260, 340], moiHo), tl([5000, 5100, -2, -2, 260, 340], moiHo)], [false, true, true, false], 'phòng chưa khép kín: tính theo hộp bao các tường');
  eq(P.trongLongPhong(P.phanPhong(P.hinhHoc(Object.assign({}, p, { goc: [1000, 500, 50] })), 110), [1890, 2010, 498, 498, 310, 390]), true, 'điểm đặt phòng dời thì vùng dời theo');
  // 15. vùng của LẦN VẼ TRƯỚC dựng lại từ bản ghi (để tìm dấu điện – nước cũ khi phòng đã đổi cỡ / dời chỗ): đủ vòng tường thì là đa giác kín, thiếu tường (tường chung không ghi) thì tính theo hộp bao
  const vung = P.vungBanGhi(cu);
  eq([vung.kin, vung.tuong.length, vung.tuong[1], P.trongLongPhong(vung, [890, 1010, -2, -2, 260, 340]), P.trongLongPhong(vung, [890, 1010, 110, 112, 260, 340])], [true, 4, { a: [3000, 0], b: [3000, -2400], z: 0, cao: 2700, day: 110 }, true, false], 'vungBanGhi: bản ghi đủ 4 tường → đa giác kín đúng lòng phòng cũ');
  const vung3 = P.vungBanGhi(Object.assign({}, cu, { tuong: cu.tuong.slice(0, 3) }));
  eq([vung3.kin, P.trongLongPhong(vung3, [1400, 1510, -310, -200, 1, 1]), P.vungBanGhi(null), P.vungBanGhi({ tuong: [] })], [false, true, null, null], 'bản ghi thiếu tường: vùng = hộp bao các tường đã ghi; không có bản ghi / không có tường → null');
  // số nét dấu điện – nước đã dựng đi theo bản ghi (dn_so) → lần sau thấy trên bản vẽ đúng ngần ấy nét, nội dung không đổi thì giữ; khác số (bị vẽ chồng / bị xoá bớt) thì đánh lại
  const cuDn = P.banGhiPhong(moi, { mo: co1.lo.map(x => x.hop), cot: co1.cot.map(x => x.hop), dam: co1.dam.map(x => x.hop), dn: [2, 2998, -2398, -2, 1, 1600], dn_ma: 'abc.1f', dn_so: 20 });
  eq([cuDn.dn, cuDn.dn_ma, cuDn.dn_so, P.chuanHoa(Object.assign({}, p, { da_ve: cuDn })).da_ve.dn_so], [[2, 2998, -2398, -2, 1, 1600], 'abc.1f', 20, 20], 'bản ghi nhớ hộp bao, mã nội dung và SỐ NÉT của dấu điện – nước; chuanHoa giữ');
  ok(P.chuanHoa(Object.assign({}, p, { da_ve: Object.assign({}, cuDn, { dn_so: -3 }) })).da_ve.dn_so === undefined && P.banGhiPhong(moi, { dn: [0, 1, 0, 1, 0, 1], dn_so: 'x' }).dn_so === undefined && P.banGhiPhong(moi, { dn_so: 5 }).dn_so === undefined, 'số nét hỏng / không có hộp dấu: không ghi');
  // bản ghi đi theo phòng qua chuẩn hoá (lưu trong máy cùng phòng), số liệu hỏng thì bỏ
  const pg = P.chuanHoa(Object.assign({}, p, { da_ve: cu }));
  eq(pg.da_ve, cu, 'chuanHoa giữ bản ghi lần vẽ');
  ok(P.chuanHoa(Object.assign({}, p, { da_ve: { tuong: 'x' } })).da_ve === undefined && P.chuanHoa(p).da_ve === undefined, 'bản ghi hỏng / không có: bỏ');
  eq(P.docMa(JSON.stringify(pg)).da_ve, cu, 'đọc lại mã phòng: bản ghi còn nguyên');
});

T('Chỗ trống trên tường để đặt tủ (bản 1.23 — anh Jason 04/10/2026 23:08: "chọn tường rồi chọn không gian tủ thì hợp lý hơn", "chọn mặt cắt đứng rồi chọn luôn trên đó")', () => {
  const p = { ten: 'P', cao: 2700, tuong: [{ dai: 3600 }, { dai: 3000 }, { dai: 3600 }, { dai: 'auto' }],
    mo: [{ tuong: 2, loai: 'cua', cach: 200, rong: 900, cao: 2200, be: 0 }, { tuong: 1, loai: 'cua_so', cach: 1800, rong: 1000, cao: 1200, be: 900 }],
    can: [{ tuong: 0, loai: 'cot', cach: 1200, rong: 300, nho: 200 }, { tuong: 0, loai: 'dam', cach: 0, rong: 3600, nho: 250, z0: 2350, z1: 2700 }],
    khung: [{ ten: 'K1', tuong: 0, cach: 0, rong: 1000, cao: 2350, sau: 600 }] };
  const H = P.hinhHoc(p);
  eq(P.choTrong(H, 0, 2000), { ok: true, cach: 1000, rong: 2600, z: 0, cao: 2350, chan: '', dam: 'Dầm 2' }, 'tường A, chạm ở 2000: từ mép khung K1 (1000) tới cuối tường; cột 1200…1500 KHÔNG chắn (tủ phủ qua, khấu cột); cao tới đáy dầm 2350');
  eq(P.choTrong(H, 0, 500), { ok: false, chan: 'khung K1' }, 'chạm vào chỗ khung K1 đang chiếm: không có chỗ trống, nói rõ cái gì chiếm');
  eq(P.choTrong(H, 1, 500), { ok: true, cach: 0, rong: 1800, z: 0, cao: 2350, chan: '', dam: 'Dầm 2' }, 'tường B, chạm ở 500: từ góc tới mép cửa sổ (cửa sổ chắn — tủ đứng không che cửa sổ); đầu dầm của tường A lấn vào góc này nên cao tới đáy dầm');
  eq(P.choTrong(H, 1, 2900), { ok: true, cach: 2800, rong: 200, z: 0, cao: 2700, chan: '', dam: '' }, 'tường B, sau cửa sổ: 2800 … 3000, cao tới trần');
  eq(P.choTrong(H, 1, 2000), { ok: false, chan: 'cửa sổ 2' }, 'chạm vào cửa sổ: báo cửa sổ');
  eq(P.choTrong(H, 2, 2000), { ok: true, cach: 1100, rong: 2500, z: 0, cao: 2700, chan: '', dam: '' }, 'tường C: từ mép cửa đi (1100) tới cuối tường');
  eq(P.choTrong(H, 3, 1000), { ok: true, cach: 0, rong: 2400, z: 0, cao: 2700, chan: '', dam: '' }, 'tường D (kề đầu tường A): khung K1 sâu 600 lấn vào góc → tường D chỉ trống tới cách cuối tường 600');
  eq(P.choTrong(H, 3, 1000, { sau: 350 }), { ok: true, cach: 0, rong: 2400, z: 0, cao: 2700, chan: '', dam: '' }, 'tủ nông 350 vẫn bị khung K1 (lấn 600 vào góc) chắn như vậy');
  eq([P.choTrong(H, 9, 100), P.choTrong(H, 0, -50).ok, P.choTrong(H, 0, 3700).ok], [{ ok: false, chan: '' }, false, false], 'tường không có / điểm chạm ngoài tường: không có chỗ');
  const H0 = P.hinhHoc(Object.assign({}, p, { khung: [], mo: [], can: [] }));
  eq(P.choTrong(H0, 0, 100), { ok: true, cach: 0, rong: 3600, z: 0, cao: 2700, chan: '', dam: '' }, 'tường trống: cả chiều dài tường, sàn → trần');
  // nhiều vật chắn cùng một phía: lấy cái GẦN điểm chạm nhất, không phụ thuộc thứ tự khai khung
  const K = (ten, cach, rong) => ({ ten, tuong: 0, cach, rong, cao: 2700, sau: 600 });
  const H2 = P.hinhHoc(Object.assign({}, p, { mo: [], can: [], khung: [K('X1', 800, 400), K('X2', 0, 400), K('X3', 2400, 300), K('X4', 3200, 400)] }));
  eq([H2.loi, P.choTrong(H2, 0, 1800)], [[], { ok: true, cach: 1200, rong: 1200, z: 0, cao: 2700, chan: '', dam: '' }], 'hai khung bên trái (X1 gần, X2 xa — khai X1 trước) và hai khung bên phải (X3 gần, X4 xa): chỗ trống là giữa X1 và X3');
  eq(P.choTrong(H2, 0, 600), { ok: true, cach: 400, rong: 400, z: 0, cao: 2700, chan: '', dam: '' }, '… chạm giữa X2 và X1: 400 → 800');
  // chạm đúng mối nối của hai khung liền nhau: không khung nào "đang chiếm" điểm đó nhưng cũng không có chỗ
  const H3 = P.hinhHoc(Object.assign({}, p, { mo: [], can: [], khung: [K('Y1', 800, 400), K('Y2', 1200, 400)] }));
  eq([H3.loi, P.choTrong(H3, 0, 1200)], [[], { ok: false, chan: '' }], 'chạm đúng mối nối hai khung liền nhau: không có chỗ trống');
  // hai dầm lấn vào đoạn: chiều cao tới đáy dầm THẤP nhất (dầm thấp khai trước)
  const H4 = P.hinhHoc(Object.assign({}, p, { mo: [], khung: [], can: [{ tuong: 0, loai: 'dam', cach: 0, rong: 3600, nho: 250, z0: 2300, z1: 2700 }, { tuong: 0, loai: 'dam', cach: 0, rong: 3600, nho: 400, z0: 2500, z1: 2700 }] }));
  eq(P.choTrong(H4, 0, 1000), { ok: true, cach: 0, rong: 3600, z: 0, cao: 2300, chan: '', dam: 'Dầm 1' }, 'hai dầm: cao tới đáy dầm thấp nhất (+2300), dù dầm cao hơn khai sau');
  // phòng có hốc lõm (∩): khung đứng ở nhánh phòng BÊN KIA hốc nằm sau lưng tường đang chọn — không chắn
  const pU = { ten: 'U', cao: 2700, tuong: [{ dai: 6000 }, { dai: 3000 }, { dai: 2000 }, { dai: 1500, re: -90 }, { dai: 2000, re: -90 }, { dai: 1500 }, { dai: 2000 }, { dai: 'auto' }], khung: [{ ten: 'Z', tuong: 3, cach: 200, rong: 1000, cao: 2700, sau: 600 }] };
  const HU = P.hinhHoc(pU);
  eq([HU.loi, HU.tuong[5].p0, HU.tuong[5].p1, HU.khung[0].poly.map(q => q[0]).sort((a, b) => a - b).filter((v, i, a) => !i || v !== a[i - 1])], [[], [2000, -1500], [2000, -3000], [4000, 4600]], '(dữ liệu thử) tường F = vách trái của hốc (x = 2000), khung Z đứng ở vách phải của hốc (x 4000 … 4600)');
  eq(P.choTrong(HU, 5, 700), { ok: true, cach: 0, rong: 1500, z: 0, cao: 2700, chan: '', dam: '' }, 'khung ở nhánh phòng bên kia hốc (sau lưng tường F): không chắn tường F');
});

T('Mã phòng: đọc lại được, bỏ chữ thừa quanh', () => {
  const p = P.chuanHoa(P.macDinh());
  eq(P.docMa('Đây là mã phòng:\n```json\n' + JSON.stringify(p) + '\n```\nhết'), p, 'JSON lẫn trong chữ');
  eq(P.docMa('không có gì'), null, 'không phải mã'); eq(P.docMa('{"a":1}'), null, 'JSON không có tường'); eq(P.docMa('{hỏng'), null, 'JSON hỏng');
  eq(P.tenTuong(0) + P.tenTuong(25) + P.tenTuong(26), 'AZAA', 'tên tường A…Z, AA');
});

T('Hình vẽ trên mặt bằng → khung đặt tủ (bản 1.16)', () => {
  const cn = [[0, 0], [2000, 0], [2000, 600], [0, 600]];
  let r = P.hinhThanhKhung(cn);
  ok(!r.ok && r.can_diem, 'hình chữ nhật trơn, không có tường: phải hỏi bấm điểm phía trước');
  r = P.hinhThanhKhung(cn, { truoc: [1000, -500] });
  eq([r.ok, r.rong, r.sau, r.goc, r.xoay, r.chu_nhat], [true, 2000, 600, [0, 0], 0, true], 'bấm điểm phía dưới: mặt trước ở y nhỏ, không xoay, gốc = góc trái–trước');
  r = P.hinhThanhKhung(cn, { truoc: [1000, 1500] });
  eq([r.rong, r.sau, r.goc, r.xoay], [2000, 600, [2000, 600], 180], 'bấm điểm phía trên: tủ quay 180°, góc trái–trước là góc trên–phải của hình');
  r = P.hinhThanhKhung(cn, { tuong: [{ a: [-500, 600], b: [3000, 600] }] });
  eq([r.ok, r.xoay, r.goc, r.sat_tuong.sau, r.mat_truoc], [true, 0, [0, 0], 1, 'lưng áp tường'], 'có tường áp cạnh trên: tự nhận lưng áp tường, không phải hỏi');
  r = P.hinhThanhKhung(cn, { tuong: [{ a: [-500, 600], b: [3000, 600] }, { a: [0, -500], b: [0, 3000] }] });
  eq([r.ok, r.xoay, r.sat_tuong], [true, 0, { truoc: 0, sau: 1, trai: 1, phai: 0 }], 'hốc tường (lưng + hồi trái áp tường): mặt trước là cạnh dài còn trống');
  // khuyết góc sau trái 300 × 200 → khấu cột trái
  r = P.hinhThanhKhung([[0, 0], [2000, 0], [2000, 600], [300, 600], [300, 400], [0, 400]]);
  eq([r.ok, r.rong, r.sau, r.khau.trai, r.khau.phai, r.khau.giua_cot, r.xoay], [true, 2000, 600, { rong: 300, sau: 200 }, { rong: 0, sau: 0 }, [], 0], 'khuyết góc → khấu cột trái 300 × 200, mặt trước là cạnh dài đối diện chỗ khuyết');
  // khuyết giữa → cột giữa
  r = P.hinhThanhKhung([[0, 0], [2000, 0], [2000, 600], [1200, 600], [1200, 380], [900, 380], [900, 600], [0, 600]]);
  eq([r.ok, r.khau.giua_cot, r.khau.trai.rong], [true, [{ cach: 900, rong: 300, sau: 220 }], 0], 'khuyết giữa mép sau → khấu cột giữa (cách trái 900, 300 × 220)');
  // tủ ở tường bên phải (lưng x = 3600), khuyết ở góc gần y = 2500
  r = P.hinhThanhKhung([[3000, 500], [3600, 500], [3600, 2200], [3350, 2200], [3350, 2500], [3000, 2500]]);
  eq([r.ok, r.rong, r.sau, r.goc, r.xoay, r.khau.trai, r.khau.phai.rong], [true, 2000, 600, [3000, 2500], -90, { rong: 250, sau: 300 }, 0].map((v, i) => (i === 5 ? { rong: 300, sau: 250 } : v)), 'tủ áp tường phải: xoay −90°, góc trái–trước ở đầu y lớn, chỗ khuyết thành khấu TRÁI 300 × 250');
  // đỉnh thừa trên cạnh thẳng, vẽ ngược chiều, đỉnh cuối trùng đỉnh đầu
  r = P.hinhThanhKhung([[0, 600], [2000, 600], [2000, 0], [1000, 0], [0, 0], [0, 600]], { truoc: [1000, -100] });
  eq([r.ok, r.rong, r.sau, r.xoay], [true, 2000, 600, 0], 'đỉnh thừa, vẽ ngược chiều kim đồng hồ hay xuôi đều ra cùng kết quả');
  // hình quay 30°
  const q30 = ([x, y]) => [x * Math.cos(Math.PI / 6) - y * Math.sin(Math.PI / 6) + 100, x * Math.sin(Math.PI / 6) + y * Math.cos(Math.PI / 6) + 50];
  r = P.hinhThanhKhung(cn.map(q30), { truoc: q30([1000, -300]) });
  eq([r.ok, r.rong, r.sau, r.goc, r.xoay], [true, 2000, 600, [100, 50], 30], 'hình quay 30°: vẫn đọc đúng rộng, sâu, góc đặt, góc xoay');
  // cột của phòng lấn vào hình chữ nhật trơn → tự khấu, và chỉ ra luôn mặt trước
  r = P.hinhThanhKhung(cn, { cot: [{ x0: -100, x1: 300, y0: 380, y1: 700 }, { x0: 900, x1: 1200, y0: 400, y1: 650 }] });
  eq([r.ok, r.khau.trai, r.khau.giua_cot, r.xoay, r.so_cot], [true, { rong: 300, sau: 220 }, [{ cach: 900, rong: 300, sau: 200 }], 0, 2], 'chữ nhật trùm qua 2 cột của phòng: tự khấu cột trái + cột giữa, mặt trước là phía không có cột');
  r = P.hinhThanhKhung([[0, 0], [2000, 0], [2000, 600], [300, 600], [300, 400], [0, 400]], { cot: [{ x0: 0, x1: 300, y0: 400, y1: 600 }] });
  eq([r.ok, r.khau.trai, r.so_cot], [true, { rong: 300, sau: 200 }, 0], 'đã vẽ khuyết đúng chỗ cột: không khấu hai lần');
  // các trường hợp từ chối
  ok(/xiên/.test(P.hinhThanhKhung([[0, 0], [2000, 0], [2100, 600], [0, 600]]).loi), 'hình có cạnh xiên: từ chối, nói rõ');
  ok(/ít nhất 4 đỉnh/.test(P.hinhThanhKhung([[0, 0], [2000, 0], [1000, 600]]).loi), 'tam giác: từ chối');
  ok(/mép SAU|mép sau/.test(P.hinhThanhKhung([[0, 0], [800, 0], [800, 200], [1200, 200], [1200, 0], [2000, 0], [2000, 600], [1200, 600], [1200, 400], [800, 400], [800, 600], [0, 600]]).loi), 'khuyết ở cả mép trước lẫn mép sau: từ chối');
  ok(/có chỗ khuyết/.test(P.hinhThanhKhung([[0, 0], [2000, 0], [2000, 600], [300, 600], [300, 400], [0, 400]], { truoc: [1000, 1500] }).loi), 'bấm điểm trước về phía có chỗ khuyết: từ chối, bảo bấm lại');
  ok(/dẹt|4 đỉnh/.test(P.hinhThanhKhung([[0, 0], [2000, 0], [2000, 0.2], [0, 0.2]]).loi), 'hình dẹt: từ chối');
});

T('Tủ theo hình: khấu lấy từ hình, giữ ruột đang mở (bản 1.16)', () => {
  const C = require('../src/mncf-core.js');
  const k = P.hinhThanhKhung([[0, 0], [2000, 0], [2000, 600], [300, 600], [300, 400], [0, 400]]);
  const t = P.tuChoKhung(C, C.DEFAULT_SPEC, { ten: 'TH', rong: k.rong, cao: 2700, sau: k.sau, mau: '', khau: k.khau }, 'Phòng', null, -1);
  const M = C.build(t.spec), bb = C.bbox(M.parts);
  eq([M.errors, t.spec.khau.trai, Math.round(bb.x1 - bb.x0), Math.round((bb.y1 - bb.y0) * 10) / 10, bb.z1 - bb.z0], [[], { rong: 300, sau: 200 }, 2000, 600, 2700], 'tủ dựng được, phủ bì đúng bằng hình (2000 × 600 × 2700), mang khấu cột trái của hình');
  ok(M.info.khau.length === 1 && M.info.khau[0].ben === 'trai', 'mô hình có đúng 1 chỗ khấu cột bên trái');
  const ruot = { ma: 'R', rong: 1800, cao: 2400, khoang: [{ rong: 'auto', canh: 2, dot: [900, 1700], o: [] }, { rong: 'auto', canh: 2, dot: [400], o: [] }] };
  const t2 = P.tuChoKhung(C, ruot, { ten: 'R', rong: 2000, cao: 2400, sau: 600, mau: '', giu_ruot: true }, '', null, -1);
  eq([t2.spec.khoang.length, t2.spec.khoang[0].dot, t2.spec.khoang[1].dot, t2.spec.rong, t2.mau], [2, [900, 1700], [400], 2000, ['ruột đang mở']], 'giu_ruot: giữ nguyên 2 khoang và các đợt đang có, chỉ đổi phủ bì');
  const t3 = P.tuChoKhung(C, ruot, { ten: 'R', rong: 3000, cao: 2400, sau: 600, mau: '' }, '', null, -1);
  ok(t3.spec.khoang.length !== 2 || JSON.stringify(t3.spec.khoang[0].dot) !== '[900,1700]', 'không giữ ruột: bảng tự chọn ruột theo bề rộng');
});

// Bản 1.23 — thấy khi thử trên Chenfeng thật 05/10/2026: tủ TA4 (chân 100) đang có suốt treo + 2 ngăn kéo ở ô sát đáy, đặt lại bằng chuột (rộng 3000 → 2000) thì mất cả hai mà không báo.
// Bảng ghi nội dung ô theo cao độ của Ô (setCell lấy `tu` của ô trong mô hình): ô sát đáy của tủ có chân mang tu = mặt dưới tấm đáy (= chân cao), không phải 0.
T('Giữ ruột: nội dung ô sát đáy của tủ có chân không bị bỏ khi đổi khung (bản 1.23)', () => {
  const C = require('../src/mncf-core.js');
  const ruot = { ma: 'R', rong: 3000, cao: 2700, chan: { cao: 100 }, khoang: [
    { rong: 'auto', canh: 2, dot: [1900], o: [{ tu: 100, kieu: 'suot' }] },
    { rong: 'auto', canh: 2, dot: [570], o: [{ tu: 100, kieu: 'nk_am', so: 2 }, { tu: 570, kieu: 'suot' }] },
    { rong: 'auto', canh: 2, dot: [450, 790, 1130], o: [] }] };
  const noiDung = M => M.info.o.filter(c => c.kieu).map(c => [c.khoang, c.tu, c.kieu, c.so]);
  eq(noiDung(C.build(ruot)), [[0, 100, 'suot', 0], [1, 100, 'nk_am', 2], [1, 570, 'suot', 0]], 'điều kiện: lõi hiểu tu = 100 là ô sát đáy của tủ chân 100');
  const t = P.tuChoKhung(C, ruot, { ten: 'R', rong: 2000, cao: 2700, sau: 600, mau: '', giu_ruot: true }, '', null, -1);
  eq(noiDung(C.build(t.spec)), [[0, 100, 'suot', 0], [1, 100, 'nk_am', 2], [1, 570, 'suot', 0]], 'đổi khung 3000 → 2000: suốt treo và 2 ngăn kéo ở ô sát đáy vẫn còn');
  // khung thấp: đợt nằm quá cao bị bỏ thì nội dung tựa trên đợt đó bỏ theo — nội dung ô sát đáy vẫn giữ
  const cao = Object.assign({}, ruot, { khoang: [{ rong: 'auto', canh: 2, dot: [570, 1900], o: [{ tu: 100, kieu: 'nk_am', so: 2 }, { tu: 1900, kieu: 'suot' }] }, ruot.khoang[2]] });
  const thap = P.tuChoKhung(C, cao, { ten: 'R', rong: 1000, cao: 1500, sau: 600, mau: '', giu_ruot: true }, '', null, -1);
  eq([thap.spec.khoang[0].dot, thap.spec.khoang[0].o.map(c => [c.kieu, c.tu])], [[570], [['nk_am', 100]]], 'khung thấp 1500: bỏ đợt +1900 và suốt treo tựa trên nó; 2 ngăn kéo ô sát đáy giữ');
  ok(thap.ghi_chu.some(g => /bỏ 1 đợt/.test(g)), 'có ghi chú đã bỏ đợt nằm quá cao', thap.ghi_chu);
});

T('Hai điểm bấm dọc chân tường → hình phủ bì của tủ (bản 1.17 — "vẽ hình chữ nhật chọn rất khó")', () => {
  // phòng 3600 × 3000: mặt trong các tường, `ra` = hướng từ thân tường vào phòng
  const tuong = [
    { a: [0, 3000], b: [3600, 3000], ra: [0, -1] },      // tường trên (A): phòng ở phía y nhỏ
    { a: [3600, 3000], b: [3600, 0], ra: [-1, 0] },      // tường phải (B)
    { a: [3600, 0], b: [0, 0], ra: [0, 1] },             // tường dưới (C)
    { a: [0, 0], b: [0, 3000], ra: [1, 0] },             // tường trái (D)
    { a: [-110, 3110], b: [3710, 3110], ra: [0, 1] },    // mặt ngoài tường trên
  ];
  let r = P.haiDiemThanhHinh([400, 3000], [2400, 3000], 600, { tuong });
  eq([r.ok, r.rong, r.bam_tuong, r.mat_truoc, r.dinh, r.truoc], [true, 2000, true, 'tường phía sau', [[400, 3000], [2400, 3000], [2400, 2400], [400, 2400]], [1400, 2100]], 'hai điểm trên tường A: lưng áp tường, tủ quay vào phòng');
  let k = P.hinhThanhKhung(r.dinh, { tuong, truoc: r.truoc });
  eq([k.ok, k.rong, k.sau, k.goc, k.xoay], [true, 2000, 600, [400, 2400], 0], '→ khung: rộng 2000, sâu 600, không xoay (đứng trong phòng nhìn lên tường A: trái → phải là chiều +x), góc trái–trước ở (400, 2400)');
  r = P.haiDiemThanhHinh([2400, 3000], [400, 3000], 600, { tuong });
  eq(P.hinhThanhKhung(r.dinh, { tuong, truoc: r.truoc }).goc, [400, 2400], 'bấm ngược thứ tự (phải trước, trái sau): kết quả như nhau');
  // bấm trượt khỏi mặt tường vài mm, hai điểm lệch nhau → kéo về đúng mặt tường
  r = P.haiDiemThanhHinh([3590, 500], [3605, 2200], 550, { tuong });
  eq([r.ok, r.rong, r.dinh], [true, 1700, [[3600, 500], [3600, 2200], [3050, 2200], [3050, 500]]], 'bấm trượt 5–10 mm quanh tường B: hai điểm được kéo về mặt tường, tủ không lệch góc');
  k = P.hinhThanhKhung(r.dinh, { tuong, truoc: r.truoc });
  eq([k.rong, k.sau, k.xoay, k.goc], [1700, 550, -90, [3050, 2200]], '→ khung tường B: xoay −90°');
  r = P.haiDiemThanhHinh([3600, 500], [3300, 2200], 550, { tuong });
  eq([r.ok, r.rong, r.dinh[1]], [true, 1700, [3600, 2200]], 'điểm cuối bấm vào mép cột cách tường 300: chiếu về mặt tường, tủ dài tới ngang mép cột');
  r = P.haiDiemThanhHinh([0, 3000], [1500, 2980], 600, { tuong });
  eq([r.ok, r.dinh], [true, [[0, 3000], [1500, 3000], [1500, 2400], [0, 2400]]], 'điểm đầu ở góc phòng (trên cả tường A lẫn tường D), điểm cuối chạy dọc tường A: tủ theo tường A');
  r = P.haiDiemThanhHinh([0, 3000], [15, 1200], 600, { tuong });
  eq([r.ok, r.dinh], [true, [[0, 3000], [0, 1200], [600, 1200], [600, 3000]]], 'cũng điểm đầu đó, điểm cuối chạy dọc tường D: tủ theo tường D');
  r = P.haiDiemThanhHinh([1000, 3000], [1050, 1500], 600, { tuong });
  ok(!r.ok && r.can_diem, 'điểm đầu trên tường nhưng điểm cuối chạy thẳng ra giữa phòng (tủ vuông góc tường): không đoán, hỏi phía trước');
  // cột của phòng nằm trong đoạn 2 điểm → tự khấu
  k = P.hinhThanhKhung(P.haiDiemThanhHinh([0, 0], [2000, 0], 600, { tuong }).dinh, { tuong, truoc: [1000, 900], cot: [{ x0: 900, x1: 1200, y0: -110, y1: 220 }] });
  eq([k.ok, k.xoay, k.goc, k.khau.giua_cot, k.so_cot], [true, 180, [2000, 600], [{ cach: 800, rong: 300, sau: 220 }], 1], 'đoạn 2 điểm trên tường C trùm qua cột của phòng: tủ xoay 180°, tự khấu cột giữa (cách mép trái của tủ 800)');
  // không có tường: phải hỏi phía trước; có điểm phía trước thì theo điểm đó
  r = P.haiDiemThanhHinh([10000, 5000], [12000, 5000], 600, { tuong });
  ok(!r.ok && r.can_diem && /phía TRƯỚC/.test(r.loi), 'hai điểm không trên mặt tường nào: hỏi bấm điểm phía trước');
  r = P.haiDiemThanhHinh([10000, 5000], [12000, 5020], 600, { truoc: [11000, 4000] });
  eq([r.ok, r.dinh, r.mat_truoc, r.bam_tuong], [true, [[10000, 5000], [12000, 5000], [12000, 4400], [10000, 4400]], 'điểm anh bấm', false], 'không tường + điểm phía trước ở dưới: tủ quay xuống; lệch trục 0,6° được nắn thẳng');
  r = P.haiDiemThanhHinh([10000, 5000], [12000, 5000], 600, { truoc: [11000, 9000] });
  eq(r.dinh, [[10000, 5000], [12000, 5000], [12000, 5600], [10000, 5600]], 'điểm phía trước ở trên: tủ quay lên');
  r = P.haiDiemThanhHinh([0, 0], [1000, 1000], 600, { truoc: [1000, 0] });
  ok(r.ok && Math.abs(r.rong - 1414.2) < 0.1 && P.hinhThanhKhung(r.dinh, { truoc: r.truoc }).ok, 'đoạn xiên 45° (tường xiên): vẫn ra hình chữ nhật quay 45°');
  // điểm phía trước do người dùng bấm thắng hướng của tường (tủ áp mặt NGOÀI tường)
  r = P.haiDiemThanhHinh([400, 3000], [2400, 3000], 600, { tuong, truoc: [1000, 4000] });
  eq([r.ok, r.dinh[2], r.mat_truoc], [true, [2400, 3600], 'điểm anh bấm'], 'bấm điểm phía trước ngược với hướng tường: theo điểm bấm');
  // từ chối
  ok(/quá gần/.test(P.haiDiemThanhHinh([0, 0], [100, 0], 600, { tuong }).loi), 'hai điểm cách nhau dưới 200: từ chối');
  ok(/sâu/.test(P.haiDiemThanhHinh([0, 0], [1000, 0], 0, { tuong }).loi), 'chưa có chiều sâu: từ chối');
  ok(/ngay trên lưng tủ/.test(P.haiDiemThanhHinh([10000, 0], [12000, 0], 600, { truoc: [11000, 0] }).loi), 'điểm phía trước nằm trên chính đoạn 2 điểm: bảo bấm lại');
  ok(/Chưa đủ 2 điểm/.test(P.haiDiemThanhHinh(null, [1, 2], 600).loi), 'thiếu điểm');
  // bề rộng đã biết (đang gõ trong bảng / gõ số): điểm thứ hai chỉ cho hướng
  r = P.haiDiemThanhHinh([400, 3000], [900, 2950], 600, { tuong, rong: 2400 });
  eq([r.ok, r.rong, r.dinh], [true, 2400, [[400, 3000], [2800, 3000], [2800, 2400], [400, 2400]]], 'biết rộng 2400, chuột rê sang phải dọc tường A: tủ chạy sang phải đúng 2400, lưng áp tường');
  r = P.haiDiemThanhHinh([3000, 3000], [2700, 2990], 600, { tuong, rong: 1800 });
  eq([r.ok, r.dinh[1], r.dinh[2]], [true, [1200, 3000], [1200, 2400]], 'chuột rê sang trái: tủ chạy sang trái');
  ok(/phía nào/.test(P.haiDiemThanhHinh([400, 3000], [402, 3000], 600, { tuong, rong: 2400 }).loi), 'biết rộng nhưng chuột chưa rê đi đâu: chưa rõ hướng');
  ok(/từ 200/.test(P.haiDiemThanhHinh([400, 3000], [900, 3000], 600, { tuong, rong: 120 }).loi), 'bề rộng gõ vào dưới 200: từ chối');
});

T('Điện – nước hiện trạng (bản 1.18 — anh Jason 03/10/2026 23:46: "nhiều phòng có ổ điện rồi thoát sàn, rồi cấp thoát nước cho điền vào hiện trạng")', () => {
  eq(P.macDinh().dn, [], 'phòng mẫu: chưa có điểm nào');
  eq(P.chuanHoa({ tuong: [{ dai: 3000 }] }).dn, [], 'phòng lưu từ bản cũ (không có dn): mảng rỗng');
  eq(Object.keys(P.LOAI_DN), ['o_dien', 'cong_tac', 'cap_nuoc', 'thoat_nuoc', 'khac', 'thoat_san', 'ong_san'], '7 loại: 5 trên tường, 2 dưới sàn');
  // chuẩn hoá: loại lạ → ổ điện; tường kẹp vào phạm vi; điểm sàn không có cao, điểm tường không có "ra"; cỡ ô chỉ giữ khi khác mặc định; số kiểu Việt; bỏ phần tử hỏng
  eq(P.chuanHoa({ tuong: [{ dai: 3000 }, { dai: 2000 }], dn: [{ tuong: 5, loai: 'la', cach: '1,5' }, { loai: 'thoat_san', tuong: 0, cach: 500, cao: 999 }, { loai: 'cap_nuoc', cach: 100, cao: '600', rong: 60, cao_o: 77 },
    { loai: 'khac', cach: 10, rong: 300, cao_o: 200, ghi: 'x'.repeat(60) }, { loai: 'o_dien', cach: 5, rong: 150, cao_o: 80, ra: 44 }, null, 'abc'] }).dn,
    [{ tuong: 1, loai: 'o_dien', cach: 1.5, cao: 300 }, { tuong: 0, loai: 'thoat_san', cach: 500, ra: 300 }, { tuong: 0, loai: 'cap_nuoc', cach: 100, cao: 600 },
      { tuong: 0, loai: 'khac', cach: 10, cao: 300, rong: 300, cao_o: 200, ghi: 'x'.repeat(40) }, { tuong: 0, loai: 'o_dien', cach: 5, cao: 300, rong: 150 }], 'chuẩn hoá điểm điện – nước');
  // hình học: tên đánh số theo từng loại, vị trí trên mặt bằng (P) theo từng tường, cao độ, cỡ ô
  const p = P.macDinh();
  p.dn = [{ tuong: 0, loai: 'o_dien', cach: 950, cao: 300 }, { tuong: 1, loai: 'o_dien', cach: 600, cao: 400 }, { tuong: 2, loai: 'cong_tac', cach: 1300, cao: 1250 }, { tuong: 3, loai: 'cap_nuoc', cach: 2700, cao: 550 },
    { tuong: 0, loai: 'thoat_san', cach: 1500, ra: 300 }, { tuong: 1, loai: 'khac', cach: 400, cao: 1500, ghi: 'Tủ điện', rong: 300, cao_o: 200 }, { tuong: 0, loai: 'o_dien', cach: 2000, cao: 300, ghi: 'tủ lạnh' }];
  const H = P.hinhHoc(p);
  eq([H.loi, H.luu_y, H.ghi_chu], [[], [], []], 'phòng có điểm điện – nước, chưa có khung: không báo gì');
  eq(H.dn.map(d => [d.ten, d.nhan, d.P, d.z, d.rong, d.cao_o, d.san, d.tron, d.nhom]), [['Ổ điện 1', 'Ổ1', [950, 0], 300, 120, 80, false, false, 'dien'], ['Ổ điện 2', 'Ổ2', [3600, -600], 400, 120, 80, false, false, 'dien'],
    ['Công tắc 1', 'CT1', [2300, -3000], 1250, 120, 80, false, false, 'dien'], ['Cấp nước 1', 'CN1', [0, -300], 550, 60, 60, false, true, 'cap'], ['Thoát sàn 1', 'TS1', [1500, -300], 0, 110, 110, true, true, 'thoat'],
    ['Tủ điện 1', 'Đ1', [3600, -400], 1500, 300, 200, false, false, 'khac'], ['Ổ điện 3 (tủ lạnh)', 'Ổ3', [2000, 0], 300, 120, 80, false, false, 'dien']], 'tên, ký hiệu, vị trí trên mặt bằng, cao độ, cỡ ô, nhóm');
  ok(co(P.tomTat(H), /^Điện – nước: 3 ổ điện · 1 công tắc · 1 cấp nước · 1 điểm khác · 1 thoát sàn$/), 'tóm tắt đếm theo loại', P.tomTat(H));
  // số đo sai: ngoài tường, vượt trần = lỗi; nằm trong ô cửa, điểm sàn ngoài phòng = lưu ý
  const p2 = P.macDinh();
  p2.dn = [{ tuong: 0, loai: 'o_dien', cach: 3700, cao: 300 }, { tuong: 1, loai: 'o_dien', cach: 100, cao: 2800 }, { tuong: 2, loai: 'cong_tac', cach: 600, cao: 1250 }, { tuong: 0, loai: 'thoat_san', cach: 500, ra: 3200 }, { tuong: 0, loai: 'thoat_san', cach: 500, ra: 0 }];
  const H2 = P.hinhHoc(p2);
  eq(H2.loi, ['Ổ điện 1 nằm ngoài tường A: cách đầu trái 3700 mà tường chỉ dài 3600.', 'Ổ điện 2 (tường B) cao +2800, vượt trần 2700.'], 'điểm ngoài tường / vượt trần: lỗi');
  eq(H2.luu_y, ['Công tắc 1 đang nằm giữa cửa đi 1 của tường C — kiểm tra lại “cách trái” / “cao”.', 'Thoát sàn 1 nằm ngoài lòng phòng (cách tường A tới 3200) — kiểm tra lại số đo.'], 'điểm giữa ô cửa / ngoài phòng: lưu ý');
  // khung ở từng tường: điểm nào bị che, toạ độ trong hệ của tủ (x từ mép trái, y từ mặt trước, z từ mép dưới) — phòng đặt lệch gốc + khung quay theo tường vẫn đúng
  const che = (tuong, cach) => { const q = P.macDinh(); q.goc = [10000, 5000, 100]; q.dn = p.dn; q.khung = [{ ten: 'K', tuong, cach, rong: 1200, cao: 2400, sau: 600 }]; const Hq = P.hinhHoc(q), dk = P.datKhung(Hq, 0);
    return [dk.xoay, P.diemTrongKhung(Hq, { goc: dk.goc, xoay: dk.xoay, rong: 1200, sau: 600, cao: 2400 }).map(c => [c.d.nhan, c.mat, c.x, c.y, c.z, c.cat])]; };
  eq(che(0, 500), [0, [['Ổ1', 'lung', 450, 600, 300, false], ['TS1', 'day', 1000, 300, 0, false]]], 'khung tường A: ổ sau lưng + thoát sàn dưới đáy');
  eq(che(1, 300), [-90, [['Ổ2', 'lung', 300, 600, 400, false], ['Đ1', 'lung', 100, 600, 1500, true]]], 'khung tường B (xoay −90°): tủ điện 300 rộng bị mép trái khung cắt ngang');
  eq(che(2, 1000), [180, [['CT1', 'lung', 300, 600, 1250, false]]], 'khung tường C (xoay 180°)');
  eq(che(3, 2000), [90, [['CN1', 'lung', 700, 600, 550, false]]], 'khung tường D (xoay 90°)');
  // khung sát góc: điểm trên tường BÊN nằm sau hồi; tủ treo không che điểm dưới sàn; khung thấp không che điểm ở trên cao
  const pg = P.macDinh(); pg.dn = [{ tuong: 3, loai: 'o_dien', cach: 2700, cao: 300 }, { tuong: 1, loai: 'cong_tac', cach: 250, cao: 1250 }, { tuong: 0, loai: 'thoat_san', cach: 500, ra: 300 }, { tuong: 0, loai: 'o_dien', cach: 1000, cao: 2000 }];
  pg.khung = [{ ten: 'G', tuong: 0, cach: 0, rong: 3600, cao: 1500, sau: 600 }, { ten: 'T', tuong: 0, cach: 0, rong: 3600, cao: 700, sau: 350, z: 1600 }];
  const Hg = P.hinhHoc(pg), cg = j => { const dk = P.datKhung(Hg, j), q = Hg.khung[j]; return P.diemTrongKhung(Hg, { goc: dk.goc, xoay: dk.xoay, rong: q.rong, sau: q.sau, cao: q.cao }).map(c => [c.d.nhan, c.mat, c.x, c.y, c.z]); };
  eq(cg(0), [['Ổ1', 'trai', 0, 300, 300], ['CT1', 'phai', 3600, 350, 1250], ['TS1', 'day', 500, 300, 0]], 'khung kín tường A cao 1500: ổ tường D sau hồi trái, công tắc tường B sau hồi phải, thoát sàn dưới đáy; ổ +2000 ở trên không dính');
  eq(cg(1), [['Ổ2', 'lung', 1000, 350, 400]], 'tủ treo +1600 → +2300: chỉ che ổ +2000 (z tính từ mép dưới tủ = 400), không che điểm dưới sàn');
  ok(co(Hg.luu_y, /^Khung G che công tắc 1 — công tắc sẽ không bấm được/) && co(Hg.luu_y, /^Khung G trùm lên thoát sàn 1 — tủ che mất thoát sàn/), 'khung che công tắc / thoát sàn: lưu ý', Hg.luu_y);
  ok(co(Hg.ghi_chu, /^Khung G che 3 điểm điện – nước: ổ điện 1 \(tường D\) sau hồi trái — cách tường lưng 300, cao \+300; công tắc 1 \(tường B\) sau hồi phải — cách tường lưng 250, cao \+1250; thoát sàn 1 dưới đáy tủ — cách mép trái khung 500, cách tường lưng 300\. Mở khung thành tủ/), 'ghi chú liệt kê điểm bị khung che', Hg.ghi_chu);
  ok(co(Hg.ghi_chu, /^Khung T che 1 điểm điện – nước: ổ điện 2 sau lưng tủ — cách mép trái khung 1000, cao \+2000 \(trên đáy khung 400\)\./), 'tủ treo: ghi cả cao độ từ sàn lẫn từ đáy khung', Hg.ghi_chu);
  const pc = P.macDinh(); pc.dn = [{ tuong: 0, loai: 'o_dien', cach: 1010, cao: 300 }]; pc.khung = [{ ten: 'C', tuong: 0, cach: 0, rong: 1000, cao: 2400, sau: 600 }];
  ok(co(P.hinhHoc(pc).luu_y, /^Khung C: mép khung cắt ngang ổ điện 1 — hồi \/ nóc tủ sẽ đè lên điểm này/), 'mép khung cắt ngang ô của điểm: lưu ý');

  // SO VỚI TỪNG TẤM của tủ đã dựng: trúng vách / đợt / hồi, sau ngăn kéo, khoét hậu / đáy ở đâu
  const S = C.normalize({ hau: { t: 6 },  ma: 'TDN', rong: 2400, cao: 2400, sau_thung: 560, than: { cao_duoi: 0 }, thung: { rong_max: 0 },
    khoang: [{ rong: 'auto', canh: 2, dot: [600, 1200], o: [] }, { rong: 'auto', canh: 2, dot: [500], o: [{ tu: 0, kieu: 'nk_am', so: 2 }] }, { rong: 'auto', canh: 2, dot: [900], o: [] }] });
  const M = C.build(S), bb = M.info.hop;
  eq([M.errors, M.info.x_khoang, M.info.khoang, bb.y0, bb.y1], [[], [67.5, 826, 1591.5], [741, 748, 741], -17.5, 560], 'tủ thử: 3 khoang (vách ở 808,5 → 826 và 1574 → 1591,5), ngăn kéo ở khoang 2');
  const pt = P.macDinh(); pt.goc = [1000, 2000, 0];
  pt.dn = [{ tuong: 0, loai: 'o_dien', cach: 900, cao: 300 }, { tuong: 0, loai: 'o_dien', cach: 1320, cao: 300 }, { tuong: 0, loai: 'o_dien', cach: 1800, cao: 300 }, { tuong: 0, loai: 'cong_tac', cach: 2500, cao: 1250 }, { tuong: 0, loai: 'cap_nuoc', cach: 700, cao: 608 },
    { tuong: 0, loai: 'ong_san', cach: 800, ra: 200 }, { tuong: 0, loai: 'thoat_san', cach: 2600, ra: 300 }, { tuong: 0, loai: 'ong_san', cach: 1300, ra: 150 }, { tuong: 0, loai: 'o_dien', cach: 3300, cao: 300 }, { tuong: 0, loai: 'o_dien', cach: 520, cao: 300 }, { tuong: 0, loai: 'o_dien', cach: 2000, cao: 60 }];
  pt.khung = [{ ten: 'TDN', tuong: 0, cach: 500, rong: 2400, cao: 2400, sau: bb.y1 - bb.y0 }];
  const Ht = P.hinhHoc(pt), dk = P.datKhung(Ht, 0), kq = P.dienNuocChoTu(M, Ht, dk);
  eq(dk, { goc: [1500, 1422.5, 0], xoay: 0, tuong: 'A' }, 'chỗ đặt tủ = góc trái – trước – dưới của khung trong bản vẽ');
  eq(kq.diem.map(d => [d.nhan, d.mat, d.x, d.y, d.z, d.khoang, d.trung]), [['Ổ1', 'lung', 400, 560, 300, 0, []], ['Ổ2', 'lung', 820, 560, 300, -1, ['vách', 'vách đệm ngăn kéo']], ['Ổ3', 'lung', 1300, 560, 300, 1, []], ['CT1', 'lung', 2000, 560, 1250, 2, []],
    ['CN1', 'lung', 200, 560, 608, 0, ['đợt khoang 1']], ['ÔS1', 'day', 300, 360, 0, 0, []], ['TS1', 'day', 2100, 260, 0, 2, []], ['ÔS2', 'day', 800, 410, 0, 0, ['vách']], ['Ổ5', 'lung', 20, 560, 300, -1, ['hồi trái']], ['Ổ6', 'lung', 1500, 560, 60, 1, []]],
    'từng điểm trong toạ độ thiết kế của tủ, khoang chứa nó, tấm bị trúng (ổ +3300 nằm ngoài tủ: không kể)');
  eq(kq.ghi_chu, ['Ổ điện 1: sau lưng tủ, khoang 1, ô +117,5 → +600 — tâm cách mép trái tủ 400, cao +300. Khoét hậu khoang 1 120 × 80: tâm cách mép trái tấm 349, cách mép dưới tấm 199 (nhìn từ trong tủ).',
    'Ống chờ sàn 1: dưới đáy tủ, khoang 1 — tâm cách mép trái tủ 300, cách lưng tủ 200. Khoét đáy khoang 1 Ø90: tâm cách mép trái tấm 232,5, cách mép sau tấm 194.'], 'điểm nằm gọn: ghi chỗ khoét trên tấm hậu / tấm đáy');
  ok(co(kq.luu_y, /^Ổ điện 2 sau lưng tủ \(tâm cách mép trái tủ 820, cao \+300\) TRÚNG vách \(đang ở 808,5 → 826\), vách đệm ngăn kéo \(đang ở 858,5 → 876\): ô 120 × 80 chiếm 760 → 880 tính từ mép trái tủ, cao 260 → 340\./), 'ổ trúng vách: báo vách đang ở đâu, ô chiếm tới đâu', kq.luu_y);
  ok(co(kq.luu_y, /^Ổ điện 3 nằm sau hộc ngăn kéo \(khoang 2, ô \+117,5 → \+500; tâm cách mép trái tủ 1300, cao \+300\)/), 'ổ sau ngăn kéo');
  ok(co(kq.luu_y, /^Công tắc 1: sau lưng tủ, khoang 3, ô \+917,5 → \+2332,5 — .*Khoét hậu khoang 3 120 × 80: tâm cách mép trái tấm 417, cách mép dưới tấm 1149 .*Tủ che công tắc — không bấm được nữa/), 'công tắc sau lưng tủ: vẫn ghi chỗ khoét nhưng là LƯU Ý');
  ok(co(kq.luu_y, /^Cấp nước 1 sau lưng tủ \(tâm cách mép trái tủ 200, cao \+608\) TRÚNG đợt khoang 1 \(cao 600 → 617,5\): ô Ø60/), 'ống cấp nước trúng đợt');
  ok(co(kq.luu_y, /^Thoát sàn 1 nằm dưới tủ \(khoang 3; tâm cách mép trái tủ 2100, cách lưng tủ 300\) — tủ che mất thoát sàn/), 'thoát sàn dưới tủ');
  ok(co(kq.luu_y, /^Ống chờ sàn 2 dưới tủ \(tâm cách mép trái tủ 800, cách lưng tủ 150\) TRÚNG vách \(đang ở 808,5 → 826\) — ống Ø90 chiếm 755 → 845/), 'ống chờ sàn trúng vách chạm sàn');
  ok(co(kq.luu_y, /^Ổ điện 5 sau lưng tủ .* TRÚNG hồi trái \(đang ở 50 → 67,5\)/) && co(kq.luu_y, /^Ổ điện 6 sau lưng tủ \(tâm cách mép trái tủ 1500, cao \+60\) không nằm trong lòng khoang nào \(sau chân tủ \/ phào\)/), 'ổ ở mép tủ trúng hồi; ổ thấp hơn đáy: sau chân tủ');
  eq(kq.luu_y.length + kq.ghi_chu.length, kq.diem.length, 'mỗi điểm đúng một dòng báo');
  // tủ treo (đáy cách sàn 800): chỉ còn công tắc, cao độ ghi từ mép dưới tủ; không biết chỗ đặt / phòng không có điểm: rỗng
  const kq2 = P.dienNuocChoTu(M, Ht, { goc: [dk.goc[0], dk.goc[1], 800], xoay: 0 });
  ok(kq2.diem.length === 1 && kq2.diem[0].nhan === 'CT1' && kq2.diem[0].z === 450 && /cao 450 từ mép dưới tủ/.test(kq2.luu_y[0]), 'tủ treo: chỉ che công tắc, cao độ tính từ mép dưới tủ', kq2);
  eq([P.dienNuocChoTu(M, Ht, null).diem, P.dienNuocChoTu(M, P.hinhHoc(P.macDinh()), dk).diem, P.dienNuocChoTu(null, Ht, dk).diem], [[], [], []], 'thiếu chỗ đặt / phòng không có điểm / chưa có tủ: không có gì');
  // tủ quay 180° áp tường C: vẫn tính đúng trong hệ của tủ
  const p180 = P.macDinh(); p180.dn = [{ tuong: 2, loai: 'o_dien', cach: 1000, cao: 300 }]; p180.khung = [{ ten: 'X', tuong: 2, cach: 600, rong: 2400, cao: 2400, sau: bb.y1 - bb.y0 }];
  const H180 = P.hinhHoc(p180), k180 = P.dienNuocChoTu(M, H180, P.datKhung(H180, 0));
  eq(k180.diem.map(d => [d.nhan, d.mat, d.x, d.z, d.khoang]), [['Ổ1', 'lung', 400, 300, 0]], 'tủ áp tường C (xoay 180°): ổ cách đầu trái khung 400 → khoang 1');

  // hình: mặt bằng có dấu từng điểm (data-dn), mặt đứng có ô + nhãn bấm sửa được; điểm dưới sàn chỉ sửa ở mặt đứng của tường nó đo theo
  const mb = P.matBangSVG(H, { sua: true }), md = P.matDungSVG(H, 0, { sua: true }), mdB = P.matDungSVG(H, 1, { sua: true }), mdD = P.matDungSVG(H, 3, { sua: true });
  eq((mb.match(/data-dn="\d+"/g) || []).length, 7, 'mặt bằng: 7 dấu');
  ok(/<title>Ổ điện 1: tường A, cách đầu trái 950, cao \+300<\/title>/.test(mb) && /<title>Thoát sàn 1: tường A, cách đầu trái 1500, cách tường 300<\/title>/.test(mb) && />Ổ1<\/text>/.test(mb) && />TS1<\/text>/.test(mb), 'mặt bằng: ký hiệu + chú giải khi rê chuột');
  ok(/data-sua="dn\.0\.cao"[^>]*>Ổ1 \+300</.test(md) && /data-sua="dn\.0\.cach"[^>]*>950</.test(md) && /data-sua="dn\.6\.cao"[^>]*>Ổ3 \+300</.test(md) && !/dn\.1\./.test(md), 'mặt đứng tường A: ổ của tường A, bấm sửa được cao + cách trái; không có điểm của tường khác');
  ok(/data-sua="dn\.4\.cach"[^>]*>1500</.test(md) && /data-sua="dn\.4\.ra"[^>]*>300</.test(md) && />TS1 · </.test(md), 'mặt đứng tường A: thoát sàn ghi dưới vạch sàn, sửa được cách trái + cách tường');
  ok(/data-dnd="3"/.test(mdD) && />TS1 · </.test(mdD) === false && /data-dnd="5"/.test(mdB) && /Đ1 \+1500/.test(mdB), 'mặt đứng tường B / D: điểm của tường đó');
  const pS = P.macDinh(); pS.dn = [{ tuong: 3, loai: 'thoat_san', cach: 2500, ra: 3000 }];
  const mdS = P.matDungSVG(P.hinhHoc(pS), 0, { sua: true });
  ok(/data-dnd="0"/.test(mdS) && />TS1 · </.test(mdS) && !/data-sua="dn\.0/.test(mdS) && />3000<\/tspan>/.test(mdS) && />500<\/tspan>/.test(mdS), 'thoát sàn khai theo tường D nhưng nằm sát tường A (cách 500): mặt đứng tường A vẫn hiện, không cho sửa ở đây');
  ok(!/data-sua="dn\./.test(P.matDungSVG(H, 0, {})) && /Ổ1 \+300/.test(P.matDungSVG(H, 0, {})), 'không bật chế độ sửa: nhãn vẫn có nhưng không bấm được');
  ok(P.matDungSVG(H, 2, {}).length > 500 && P.matBangSVG(P.hinhHoc(P.macDinh()), {}).indexOf('data-dn') < 0, 'phòng không có điểm: hình như cũ');

  // dấu để vẽ vào Chenfeng: file DXF nhỏ
  const pd = P.macDinh(); pd.goc = [50000, 3000, 0];
  pd.dn = [{ tuong: 0, loai: 'o_dien', cach: 950, cao: 300 }, { tuong: 0, loai: 'cong_tac', cach: 3500, cao: 1250 }, { tuong: 1, loai: 'cap_nuoc', cach: 1340, cao: 650 }, { tuong: 2, loai: 'thoat_nuoc', cach: 500, cao: 400 },
    { tuong: 3, loai: 'khac', cach: 400, cao: 1500, ghi: 'Tủ điện', rong: 300, cao_o: 200 }, { tuong: 0, loai: 'thoat_san', cach: 1500, ra: 300 }, { tuong: 0, loai: 'ong_san', cach: 600, ra: 200 }];
  const X = P.dienNuocDXF(P.hinhHoc(pd)), L = X.dxf.split('\n'), dem = t => L.filter((v, i) => v === t && L[i - 1] === '0').length;
  eq([X.so, dem('LWPOLYLINE'), dem('CIRCLE'), dem('TEXT'), dem('LINE'), L.slice(0, 4), L.slice(-5)], [7, 3, 8, 12, 22, ['0', 'SECTION', '2', 'ENTITIES'], ['0', 'ENDSEC', '0', 'EOF', '']], 'DXF: 7 điểm → 3 ô chữ nhật, 8 vòng tròn, 12 chữ (5 nhãn tường + 5 ký hiệu chân tường + 2 nhãn sàn), 22 đoạn thẳng');
  eq(X.hop, { x0: 50002, x1: 53598, y0: 2, y1: 2998, z0: 1, z1: 1600 }, 'hộp bao các nét: nằm trong lòng phòng, nhô khỏi mặt tường / mặt sàn 1–2 mm');
  const iP = L.indexOf('LWPOLYLINE');
  eq(L.slice(iP + 1, iP + 33).join(' '), '8 0 62 30 90 4 70 1 38 -2998 10 50890 20 260 10 51010 20 260 10 51010 20 340 10 50890 20 340 210 0 220 -1 230 0', 'ổ điện 1 trên tường A: ô 120 × 80 tâm (50950, +300), mặt phẳng y = 2998 (hướng đùn = pháp tuyến tường, cao trình −2998), màu 30');
  ok(/\n0\nTEXT\n8\n0\n62\n30\n10\n51030\n20\n280\n30\n-2998\n40\n40\n1\nO1 \+300\n210\n0\n220\n-1\n230\n0\n/.test(X.dxf), 'nhãn "O1 +300" (không dấu) bên phải ô, cùng mặt phẳng tường', L.slice(iP + 60, iP + 100));
  ok(/\n1\nCT1 \+1250\n/.test(X.dxf) && /\n10\n53124\.8\n20\n1230\n30\n-2998\n40\n40\n1\nCT1 \+1250\n/.test(X.dxf), 'công tắc sát cuối tường: nhãn chuyển sang bên TRÁI ô');
  ok(/\n0\nCIRCLE\n8\n0\n62\n140\n10\n-1660\n20\n650\n30\n-53598\n40\n30\n210\n-1\n220\n0\n230\n0\n/.test(X.dxf), 'cấp nước trên tường B: vòng tròn Ø60 trong mặt tường B (trục x của mặt = hướng chạy của tường = −y; cao trình = −53598), màu 140');
  ok(/\n0\nCIRCLE\n8\n0\n62\n34\n10\n51500\n20\n2700\n30\n1\n40\n55\n0\nLINE/.test(X.dxf) && /\n1\nTS1\n/.test(X.dxf) && /\n1\nOS1\n/.test(X.dxf), 'thoát sàn: vòng tròn Ø110 trên sàn (z = 1) + gạch chéo; nhãn không dấu');
  ok(/\n62\n200\n/.test(X.dxf) && /\n1\nD1 \+1500\n/.test(X.dxf) && !/[^\x00-\x7f]/.test(X.dxf), 'điểm khác: màu 200, nhãn "D1"; cả file chỉ có ký tự ASCII');
  ok(/\n1\nCN1\n50\n90\n/.test(X.dxf) && /\n1\nO1\n50\n0\n/.test(X.dxf), 'ký hiệu ở chân tường: chữ chạy dọc tường và đọc xuôi (tường B quay 90°)');
  eq(P.dienNuocDXF(P.hinhHoc(P.macDinh())), { dxf: '', so: 0, hop: null }, 'phòng không có điểm: không có file');
});

T('Khung đặt mẫu kho, chia ô, sửa ô trên mặt đứng (bản 1.19 — anh Jason 03/10/2026 20:49: "vách tivi … chia ô ra rồi chọn vào từng khu vực")', () => {
  const p = P.macDinh();
  p.khung = [{ ten: 'K1', tuong: 0, cach: 0, rong: 3600, cao: 2700, sau: 400 },
    { ten: 'TV', tuong: 1, cach: 500, rong: 2000, cao: 600, sau: 400, z: 300, kieu: 'kho', nhom: 'tivi', kho: { id: '9621', ten: 'Tủ tivi 1', hinh: 'https://api.cfcad.cn/CAD/logos/a.jpg', kt: [2800, '350', 2400], rac: 1 } },
    { ten: 'X', tuong: 2, cach: 1500, rong: 500, cao: 500, sau: 300, kieu: 'kho', kho: { id: 0, ten: 'hỏng' } }, { ten: 'Y', tuong: 2, cach: 2100, rong: 500, cao: 500, sau: 300, kieu: 'la', kho: { id: 5 } }];
  const q = P.chuanHoa(p).khung;
  ok(q[0].kieu === undefined && q[0].kho === undefined, 'khung thường: không có kieu / kho');
  eq([q[1].kieu, q[1].kho, q[1].nhom], ['kho', { id: 9621, ten: 'Tủ tivi 1', hinh: 'https://api.cfcad.cn/CAD/logos/a.jpg', kt: [2800, 350, 2400] }, 'tivi'], 'khung mẫu kho: giữ mã, tên, ảnh, kích thước mặc định (đã ép số), nhóm; bỏ trường lạ');
  ok(q[2].kieu === 'kho' && q[2].kho === undefined, 'mã mẫu không hợp lệ → khung mẫu kho chưa chọn mẫu');
  ok(q[3].kieu === undefined && q[3].kho === undefined, 'kieu lạ → khung thường, bỏ mẫu');
  eq(P.chuanHoa(P.chuanHoa(p)), P.chuanHoa(p), 'chuẩn hoá hai lần ra như nhau');
  const H = P.hinhHoc(p);
  eq(H.loi, [], 'không lỗi');
  ok(co(P.tomTat(H), /TV 2000×600×400 \(mẫu kho: Tủ tivi 1\) · X 500×500×300 \(mẫu kho\)/), 'tóm tắt ghi khung nào đặt mẫu kho', P.tomTat(H));
  eq(P.datKhung(H, 1), { goc: [3200, -500, 300], xoay: -90, tuong: 'B' }, 'chỗ đặt của khung treo trên tường B: đáy +300, xoay −90°');
  // cột chạm khung mẫu kho: không khấu được → lưu ý (khung thường thì ghi chú "sẽ được khấu cột")
  const pc = P.macDinh(); pc.can = [{ tuong: 0, loai: 'cot', cach: 0, rong: 300, nho: 200 }];
  pc.khung = [{ ten: 'A1', tuong: 0, cach: 0, rong: 1500, cao: 2700, sau: 400, kieu: 'kho' }];
  let Hc = P.hinhHoc(pc);
  ok(co(Hc.luu_y, /Khung A1 \(mẫu kho\) vướng cột 1.*mẫu kho không khấu cột được/) && !co(Hc.ghi_chu, /KHẤU CỘT/), 'cột lấn vào khung mẫu kho: báo vướng, không hứa khấu cột', [Hc.luu_y, Hc.ghi_chu]);
  delete pc.khung[0].kieu; Hc = P.hinhHoc(pc);
  ok(co(Hc.ghi_chu, /Khung A1: cột 1 trùm đầu trái khung.*KHẤU CỘT/), 'cùng khung đó để tủ tự chia: vẫn khấu cột như trước');
  // điện – nước sau khung mẫu kho: lời nhắc riêng
  const pd = P.macDinh(); pd.dn = [{ tuong: 0, loai: 'o_dien', cach: 500, cao: 300 }]; pd.khung = [{ ten: 'A1', tuong: 0, cach: 0, rong: 1500, cao: 2700, sau: 400, kieu: 'kho' }];
  ok(co(P.hinhHoc(pd).ghi_chu, /Khung A1 che 1 điểm điện – nước.*Khung đặt mẫu kho: vẽ xong tự khoét/), 'điểm điện sau khung mẫu kho: nhắc tự khoét sau khi vẽ');

  // CHIA Ô
  let r = P.chiaKhung(p, 0, 3, 'doc');
  eq([r.tu, r.den, r.p.khung.length], [0, 2, 6], 'chia 3: thay khung K1 bằng 3 ô, các khung khác giữ nguyên thứ tự');
  eq(r.p.khung.slice(0, 3).map(k => [k.ten, k.cach, k.z, k.rong, k.cao, k.sau]), [['K1.1', 0, 0, 1200, 2700, 400], ['K1.2', 1200, 0, 1200, 2700, 400], ['K1.3', 2400, 0, 1200, 2700, 400]], '3 ô cạnh nhau, giữ cao + sâu');
  eq(P.hinhHoc(r.p).loi, [], 'các ô chạm mép nhau: không báo chồng');
  const le = P.chiaKhung(Object.assign(P.macDinh(), { khung: [{ ten: 'L', tuong: 0, cach: 100, rong: 1000, cao: 2700, sau: 400, z: 0 }] }), 0, 3, 'doc').p.khung;
  eq(le.map(k => [k.cach, k.rong]), [[100, 333], [433, 333], [766, 334]], 'số lẻ dồn vào ô cuối: tổng vẫn đúng 1000');
  r = P.chiaKhung(r.p, 1, 2, 'ngang');
  eq(r.p.khung.slice(1, 3).map(k => [k.ten, k.cach, k.z, k.rong, k.cao]), [['K1.2.1', 1200, 0, 1200, 1350], ['K1.2.2', 1200, 1350, 1200, 1350]], 'chia ngang: 2 ô chồng nhau từ dưới lên');
  const rk = P.chiaKhung(p, 1, 2, 'doc').p.khung.slice(1, 3);
  ok(rk.every(k => k.kieu === 'kho' && k.kho === undefined && k.nhom === 'tivi' && k.z === 300), 'chia khung mẫu kho: ô con giữ loại + nhóm + đáy, bỏ mẫu đã chọn (mỗi ô chọn lại)', rk);
  ok(P.chiaKhung(p, 0, 1, 'doc') === null && P.chiaKhung(p, 0, 13, 'doc') === null && P.chiaKhung(p, 9, 2, 'doc') === null && P.chiaKhung(p, 2, 12, 'doc') === null, 'số ô ngoài 2…12, khung không có, ô nhỏ hơn 50 → không chia');
  const trung = P.chiaKhung(Object.assign(P.macDinh(), { khung: [{ ten: 'K', tuong: 0, cach: 0, rong: 1000, cao: 2700, sau: 400 }, { ten: 'K.1', tuong: 1, cach: 0, rong: 500, cao: 500, sau: 300 }] }), 0, 2, 'doc').p.khung.map(k => k.ten);
  ok(new Set(trung).size === 3, 'tên ô con không trùng tên khung đã có', trung);

  // SỬA Ô: ô kề nhận phần bù
  let s = P.chiaKhung(Object.assign(P.macDinh(), { khung: [{ ten: 'K1', tuong: 0, cach: 0, rong: 3600, cao: 2700, sau: 400 }] }), 0, 3, 'doc').p;
  let d = P.doiCoKhung(s, 0, 'rong', 600);
  eq([d.ke, d.p.khung.map(k => [k.cach, k.rong])], ['K1.2', [[0, 600], [600, 1800], [2400, 1200]]], 'thu ô trái còn 600: ô kề phải giãn ra bù');
  d = P.doiCoKhung(d.p, 2, 'rong', 600);
  eq([d.ke, d.p.khung.map(k => [k.cach, k.rong])], ['K1.2', [[0, 600], [600, 2400], [3000, 600]]], 'thu ô phải (không có ô kề phải): mép phải đứng yên, ô kề trái nhận bù');
  d = P.doiCoKhung(P.chiaKhung(d.p, 1, 2, 'ngang').p, 1, 'cao', 450);
  eq([d.ke, d.p.khung.slice(1, 3).map(k => [k.z, k.cao])], ['K1.2.2', [[0, 450], [450, 2250]]], 'sửa cao ô dưới: ô trên nhận bù');
  ok(/Ô kề K1\.2\.2 chỉ còn 20/.test(P.doiCoKhung(d.p, 1, 'cao', 2680).loi), 'ô kề còn dưới 50 → báo, không sửa');
  eq(P.doiCoKhung(d.p, 0, 'cao', 2000).ke, '', 'ô không có ô kề trùng khít (ô trái cao khác) → chỉ đổi ô đó');
  eq(P.doiCoKhung(d.p, 0, 'cao', 2000).p.khung[0].cao, 2000, '… cao mới được ghi');
  ok(P.doiCoKhung(d.p, 0, 'rong', 20) === null && P.doiCoKhung(d.p, 99, 'rong', 500) === null, 'số dưới 50 / khung không có → null');
  eq(P.hinhHoc(d.p).loi, [], 'sau các lần sửa: không hở, không chồng');

  // MẶT ĐỨNG
  d.p.khung[2].kieu = 'kho'; d.p.khung[2].kho = { id: 9, ten: 'Tủ tivi 13' };
  const Hd = P.hinhHoc(d.p), md = P.matDungSVG(Hd, 0, { rong_px: 420, chon_khung: 2, sua: true }), md0 = P.matDungSVG(Hd, 0, { rong_px: 420 });
  ok(!/NaN|undefined|Infinity/.test(md), 'mặt đứng không có số hỏng');
  for (const k of ['khung.0.rong', 'khung.1.cao', 'khung.2.sau', 'khung.2.z']) ok(md.includes(`data-sua="${k}"`), 'mặt đứng (chế độ sửa): bấm được ' + k);
  ok(md.includes('data-sua="khung.0.cach"') === false && (md.match(/data-sua="khung\.\d\.cach"/g) || []).length === 0, 'ô sát đầu tường / ô có ô kề trái: không có số “cách trái” để sửa (khoảng hở = 0 hoặc tính theo ô kề)');
  ok(/mẫu: Tủ tivi 13/.test(md) && /stroke-dasharray/.test(md.split('data-khung="2"')[1].split('/>')[0]) && md.includes('#0b7a5e'), 'ô mẫu kho: màu + nét riêng, ghi tên mẫu');
  ok(/\+450/.test(md) && !md0.includes('data-sua="khung'), 'ô treo ghi +450; không ở chế độ sửa thì không có số bấm được');
  ok(/2400 × 2250 · sâu 400/.test(md0), 'không ở chế độ sửa: dòng kích thước là chữ liền (như bản trước)');
  const hoP = Object.assign(P.macDinh(), { khung: [{ ten: 'A', tuong: 0, cach: 300, rong: 1000, cao: 2700, sau: 400 }, { ten: 'B', tuong: 0, cach: 1800, rong: 1000, cao: 2700, sau: 400 }] }), mdH = P.matDungSVG(P.hinhHoc(hoP), 0, { rong_px: 420, sua: true });
  ok(mdH.includes('data-sua="khung.0.cach"') && !mdH.includes('data-sua="khung.1.cach"') && />500</.test(mdH) && />800</.test(mdH), 'khung cách đầu tường 300: số bấm sửa được; khe 500 giữa 2 khung và 800 còn lại bên phải chỉ ghi', mdH.match(/>\d+</g));

  // khung treo mở thành tủ: không có chân
  const tu = P.tuChoKhung(C, C.DEFAULT_SPEC, { ten: 'TR', rong: 1200, cao: 900, sau: 350, z: 1500, mau: '' }, 'P', null, -1), tuSan = P.tuChoKhung(C, C.DEFAULT_SPEC, { ten: 'S', rong: 1200, cao: 2400, sau: 600, z: 0, mau: '' }, 'P', null, -1);
  ok(tu.spec.chan.cao === 0 && co(tu.ghi_chu, /Khung treo \(đáy \+1500\): bỏ chân tủ/) && tuSan.spec.chan.cao === C.DEFAULT_SPEC.chan.cao, 'khung treo → tủ không chân (có ghi chú); khung đứng sàn giữ chân', [tu.spec.chan, tu.ghi_chu]);
});

T('Khung → tủ: bảng tự điền chiều cao trần để kiểm "thân lật đứng có lọt trần không" (bản 1.20)', () => {
  const H = P.hinhHoc({ cao: 2400, tuong: [{ dai: 3600 }, { dai: 3000 }, { dai: 3600 }, { dai: 'auto' }],
    khung: [{ ten: 'K', tuong: 0, cach: 500, rong: 1000, cao: 2400, sau: 600 }, { ten: 'Treo', tuong: 0, cach: 2000, z: 1400, rong: 1000, cao: 900, sau: 350 }] });
  eq(H.loi, [], 'phòng hợp lệ');
  const r = P.tuChoKhung(C, C.DEFAULT_SPEC, H.khung[0], 'P', H, 0);
  eq(r.spec.kiem.tran, 2400, 'khung đứng trên sàn: trần = cao trần của tường đặt khung');
  // khung cao bằng trần 2400, một thân 2350 sâu 582,5 → đường chéo 2421 > 2400
  const w = C.build(r.spec).kq.filter(k => k.ma === 'than' && k.muc === 'luu_y');
  ok(w.length === 1 && /2421/.test(w[0].t) && /2400/.test(w[0].t), 'tủ kịch trần một thân: cảnh báo không lật đứng được', w);
  eq(P.tuChoKhung(C, C.DEFAULT_SPEC, H.khung[1], 'P', H, 1).spec.kiem.tran, 0, 'khung treo: không lật từ sàn lên nên không kiểm');
  eq(P.tuChoKhung(C, C.DEFAULT_SPEC, { rong: 1000, cao: 2400, sau: 600 }).spec.kiem.tran, 0, 'không có phòng: không biết trần, không kiểm');
  const coTran = C.normalize(Object.assign({}, C.DEFAULT_SPEC, { kiem: { tran: 2600 } }));
  eq(P.tuChoKhung(C, coTran, H.khung[0], 'P', H, 0).spec.kiem.tran, 2400, 'trần của phòng thay cho số đang lưu trong thông số');
  eq(P.tuChoKhung(C, coTran, H.khung[1], 'P', H, 1).spec.kiem.tran, 0, 'khung treo trong phòng: bỏ số trần đang lưu (không lật từ sàn)');
});

T('Mặt đứng cho màn hình hẹp (module Đo trên điện thoại): phóng chữ bằng opts.chu', () => {
  const H = P.hinhHoc({ cao: 2700, tuong: [{ dai: 3600 }, { dai: 3000 }, { dai: 3600 }, { dai: 'auto' }], mo: [{ tuong: 2, loai: 'cua', cach: 200, rong: 900, cao: 2200 }], dn: [{ tuong: 0, loai: 'o_dien', cach: 800, cao: 300 }] });
  const co = (s, re) => { const m = re.exec(s); return m ? Number(m[1]) : NaN; }, vb = s => /viewBox="([^"]+)"/.exec(s)[1].split(' ').map(Number);
  const d1 = P.matDungSVG(H, 0, { rong_px: 330 }), d2 = P.matDungSVG(H, 0, { rong_px: 330, chu: 2 }), tenT = /font-size="([\d.]+)" font-weight="700" fill="[^"]+">Tường A</;
  eq(P.matDungSVG(H, 0, { rong_px: 330, chu: 1 }), d1, 'chu = 1 y như không truyền (tiện ích không đổi gì)');
  ok(Math.abs(co(d2, tenT) / co(d1, tenT) - 2) < 0.01 && vb(d2)[2] > vb(d1)[2] + 400, 'chu = 2 → chữ gấp đôi so với hình, lề rộng thêm cho chữ', [co(d1, tenT), co(d2, tenT), vb(d1), vb(d2)]);
});

/* ---------------- phòng đã đo trên điện thoại (bản 1.24): đọc từ kho đo hiện trạng trên máy chủ của xưởng ---------------- */
const MA_THU = 'mn-' + 'Ab3_-xY9'.repeat(4);      // mã giả đúng dạng (mã thật do máy chủ sinh ngẫu nhiên)
T('Chuỗi kết nối của máy vẽ: "địa chỉ kho # mã" — dán một lần là biết hỏi ở đâu', () => {
  eq(P.docKetNoi(`https://sx.thu/api/do#${MA_THU}`), { goc: 'https://sx.thu/api/do', ma: MA_THU }, 'chuỗi đúng: tách ra địa chỉ kho và mã');
  eq(P.docKetNoi(`  https://sx.thu/api/do/#${MA_THU}\n`), { goc: 'https://sx.thu/api/do', ma: MA_THU }, 'dấu cách, xuống dòng quanh chuỗi và dấu / thừa cuối địa chỉ: bỏ qua');
  eq(P.docKetNoi(`https://sx.thu:8443/kho/do?x=1#${MA_THU}`), { goc: 'https://sx.thu:8443/kho/do', ma: MA_THU }, 'địa chỉ có cổng, đường dẫn khác: giữ; phần ?… thì bỏ');
  eq(P.docKetNoi(`http://localhost:8765/api/do#${MA_THU}`), { goc: 'http://localhost:8765/api/do', ma: MA_THU }, 'http chỉ nhận cho máy đang ngồi (localhost) — để thử');
  const loi = t => (P.docKetNoi(t) || {}).loi || '';
  ok(/dán chuỗi kết nối/i.test(loi('')) && /dán chuỗi kết nối/i.test(loi('   ')) && /dán chuỗi kết nối/i.test(loi(null)), 'để trống: nhắc dán chuỗi', loi(''));
  ok(/thiếu địa chỉ máy chủ/i.test(loi(MA_THU)), 'chỉ có mã, thiếu địa chỉ: nói rõ phải chép cả chuỗi', loi(MA_THU));
  ok(/không đúng dạng/i.test(loi('https://sx.thu/api/do#abc')) && /không đúng dạng/i.test(loi('https://sx.thu/api/do')) && /không đúng dạng/i.test(loi(`https://sx.thu/api/do#${MA_THU}!`)), 'mã sai dạng / không có mã: từ chối', loi('https://sx.thu/api/do#abc'));
  ok(/https/i.test(loi(`http://sx.thu/api/do#${MA_THU}`)) && /https/i.test(loi(`ftp://sx.thu/api/do#${MA_THU}`)), 'máy chủ ngoài mà không phải https: từ chối (mã không được đi trên đường không mã hoá)', loi(`http://sx.thu/api/do#${MA_THU}`));
  ok(/không đọc được/i.test(loi(`sx.thu/api/do#${MA_THU}`)), 'địa chỉ không ra địa chỉ: từ chối', loi(`sx.thu/api/do#${MA_THU}`));
  ok(/không đọc được|https/i.test(loi(`https://ai:matkhau@sx.thu/api/do#${MA_THU}`)) && !('goc' in P.docKetNoi(`https://ai:matkhau@sx.thu/api/do#${MA_THU}`)), 'địa chỉ có kèm tên / mật khẩu: không nhận');
  eq(Object.keys(P.docKetNoi('x')), ['loi'], 'hỏng thì chỉ trả lời báo, không kèm địa chỉ hay mã dở dang');
});

// Đúng thứ cửa /phong của kho trả về cho một phòng do trang đo 0.5.0 gửi lên: số đo nguyên văn (`muc.phong`, cạnh chưa đo ghi 0) + gói `muc.gui`
// do MÁY ĐO tính sẵn cho máy vẽ (cạnh suy ra đã điền, chỉ gồm chi tiết đủ số, nét + chữ chú thích của từng ảnh theo điểm ảnh).
const PHONG_DO = () => ({ ct: { id: 'ct0000000001', ten: 'Nhà anh Hùng', dia_chi: 'Chiềng Sinh', ngay: '2026-10-04', nguoi_do: 'Thanh' }, nguoi_gui: 'Thanh', sua_luc: 1791100000000,
  muc: { id: 'muc000000001', loai: 'phong', ten: 'Phòng ngủ master', xong: true, ghi_chu: '',
    phong: { ban: 1, ten: 'Phòng ngủ master', cao: 2700, day: 110, tuong: [{ ten: 'A', dai: 3600, re: 90 }, { ten: 'B', dai: 3000, re: 90 }, { ten: 'C', dai: 0, re: 90 }, { ten: 'D', dai: 0, re: 90 }], mo: [], can: [], dn: [], khung: [] },
    gui: { ban: 1,
      phong: { ban: 1, ten: 'Phòng ngủ master', cao: 2700, day: 110, tuong: [{ ten: 'A', dai: 3600, re: 90 }, { ten: 'B', dai: 3000, re: 90 }, { ten: 'C', dai: 3600, re: 90 }, { ten: 'D', dai: 3000, re: 90 }],
        mo: [{ tuong: 2, loai: 'cua', cach: 200, rong: 900, cao: 2200, be: 0 }], can: [{ tuong: 1, loai: 'cot', cach: 1000, rong: 300, nho: 200, z0: 0, z1: 2700 }], dn: [], khung: [] },
      bo: ['Ổ điện 1 (mặt A)'], loi: [],
      anh: [{ id: 'anh000000001', tuong: 0, w: 800, h: 600, ghi: 'mặt có cửa sổ', co: 30.8, net: [[80, 300, 720, 300], [80, 286.1, 80, 313.9], [720, 286.1, 720, 313.9], [400, 120, 480, 240], [480, 240, 476.2, 212.5], [480, 240, 456.1, 225.9]],
        chu: [{ text: '3600', x: 400, y: 275.4, co: 30.8, goc: 0 }, { text: 'ổ điện cũ', x: 160, y: 120, co: 30.8, goc: 0 }] },
      { id: 'anh000000002', tuong: null, w: 600, h: 800, ghi: 'toàn cảnh', co: 30.8, net: [], chu: [] }] } },
  anh_co: ['anh000000001'] });

T('Phòng đã đo: đọc gói máy đo tính sẵn thành dòng cho thẻ Phòng — không tính lại số đo', () => {
  const ds = P.phongDaDo([PHONG_DO()], {});
  eq(ds.length, 1, 'một phòng');
  const r = ds[0];
  eq([r.khoa, r.ten, r.ct, r.dia_chi, r.ngay, r.nguoi, r.sua_luc, r.xong, r.moi, r.goi], ['ct0000000001/muc000000001', 'Phòng ngủ master', 'Nhà anh Hùng', 'Chiềng Sinh', '2026-10-04', 'Thanh', 1791100000000, true, true, 'co'], 'tên phòng, công trình, người gửi, mốc sửa; chưa lấy lần nào thì là "mới"');
  eq([r.phong.ten, r.phong.cao, r.phong.tuong.map(t => t.dai), r.phong.mo.length, r.phong.can.length, r.phong.dn.length], ['Phòng ngủ master', 2700, [3600, 3000, 3600, 3000], 1, 1, 0], 'phòng lấy từ GÓI cho máy vẽ (4 cạnh là số thật), không lấy từ số đo thô (cạnh chưa đo ghi 0)');
  eq(JSON.stringify(P.chuanHoa(r.phong)), JSON.stringify(r.phong), 'phòng đã ở đúng dạng của thẻ Phòng');
  eq([r.ve_duoc, r.loi, r.bo], [true, [], ['Ổ điện 1 (mặt A)']], 'đủ số: vẽ được; chi tiết mới phác thì nêu tên là chưa đưa sang');
  ok(/4 tường/.test(r.tom) && /10,8 m²/.test(r.tom) && /trần 2700/.test(r.tom), 'dòng tóm tắt để nhận ra phòng', r.tom);
  eq(r.anh.map(a => [a.id, a.mat, a.w, a.h, a.ghi, a.co, a.net.length, a.chu.map(c => c.text), a.tren_may_chu]), [['anh000000001', 'A', 800, 600, 'mặt có cửa sổ', 30.8, 6, ['3600', 'ổ điện cũ'], true], ['anh000000002', '', 600, 800, 'toàn cảnh', 30.8, 0, [], false]],
    'ảnh: thuộc mặt nào (ảnh chung thì để trống), nét + chữ chú thích nguyên như máy đo tính, ảnh nào máy chủ đã có');
  eq([r.anh_thieu, r.anh[0].net[0], r.anh[0].chu[0]], [1, [80, 300, 720, 300], { text: '3600', x: 400, y: 275.4, co: 30.8, goc: 0 }], 'một ảnh điện thoại chưa gửi lên; nét và chữ giữ đúng số');
  // đã lấy bản này rồi thì hết "mới"; máy đo sửa tiếp (mốc lớn hơn) thì "mới" lại
  eq([P.phongDaDo([PHONG_DO()], { 'ct0000000001/muc000000001': 1791100000000 })[0].moi, P.phongDaDo([PHONG_DO()], { 'ct0000000001/muc000000001': 1791099999999 })[0].moi, P.phongDaDo([PHONG_DO()], null)[0].moi], [false, true, true], 'đánh dấu "mới" theo mốc sửa của bản đã lấy');
  // xếp: sửa gần nhất lên đầu
  const cu = PHONG_DO(); cu.sua_luc = 1791000000000; cu.muc.id = 'muc000000009'; cu.muc.ten = 'Bếp';
  eq(P.phongDaDo([cu, PHONG_DO()], {}).map(x => x.ten), ['Phòng ngủ master', 'Bếp'], 'phòng sửa gần nhất đứng đầu');
});

T('Phòng đã đo: chưa đủ số, gói lạ, dữ liệu hỏng — không vẽ bừa, không vỡ', () => {
  // hình còn thiếu cạnh: máy đo ghi rõ thiếu gì → không cho vẽ, nêu lý do
  const thieu = PHONG_DO(); thieu.muc.gui.phong.tuong[1].dai = 0; thieu.muc.gui.phong.tuong[3].dai = 0; thieu.muc.gui.loi = ['Tường B chưa có chiều dài.', 'Tường D chưa có chiều dài.'];
  let r = P.phongDaDo([thieu], {})[0];
  eq([r.ve_duoc, r.loi.slice(0, 2), r.goi, !!r.phong], [false, ['Tường B chưa có chiều dài.', 'Tường D chưa có chiều dài.'], 'co', true], 'thiếu cạnh: chưa vẽ ngay được, giữ lời máy đo nói thiếu gì (phòng vẫn lấy về xem được)');
  ok(!r.loi.some(t => /khép kín/.test(t)), 'đã nói thiếu cạnh thì không nói thêm "chưa khép kín" (hệ quả của chính việc thiếu cạnh)', r.loi);
  const thieu1 = PHONG_DO(); thieu1.muc.gui.phong.tuong[1].dai = 0; thieu1.muc.gui.phong.can = []; thieu1.muc.gui.loi = ['Tường B chưa có chiều dài.'];      // thiếu MỘT cạnh: hình hở hẳn 3000
  r = P.phongDaDo([thieu1], {})[0];
  eq([P.hinhHoc(r.phong).khep.kin, r.loi, r.ve_duoc], [false, ['Tường B chưa có chiều dài.'], false], 'thiếu một cạnh (hình hở): vẫn chỉ nêu cạnh thiếu, không thay bằng / chồng thêm lời "chưa khép kín"');
  // máy đo không báo gì mà hình có lỗi (cửa rộng hơn tường): máy vẽ tự soát lại hình, không vẽ bừa
  const loiHinh = PHONG_DO(); loiHinh.muc.gui.phong.mo[0].rong = 5000;
  r = P.phongDaDo([loiHinh], {})[0];
  ok(r.ve_duoc === false && r.loi.length >= 1 && r.loi.some(t => /vượt ra ngoài tường C/.test(t)), 'gói không ghi lỗi nhưng cửa rộng hơn tường: máy vẽ tự soát thấy, không cho "lấy & vẽ"', r.loi);
  // máy đo bảo đủ nhưng hình không khép kín (số đo lệch): máy vẽ tự soát lại hình trước khi cho vẽ
  const ho = PHONG_DO(); ho.muc.gui.phong.tuong[2].dai = 3000;
  r = P.phongDaDo([ho], {})[0];
  ok(r.ve_duoc === false && r.loi.length === 1 && /chưa khép kín: điểm cuối cách điểm đầu 600 mm/.test(r.loi[0]) && !!r.phong, 'gói nói không lỗi mà hình không khép kín (hở 600): không cho "lấy & vẽ" một chạm, nêu rõ hở bao nhiêu; vẫn lấy về xem được', r.loi);
  // trang đo bản cũ (chưa có gói): không đoán từ số đo thô
  const cuKy = PHONG_DO(); delete cuKy.muc.gui;
  r = P.phongDaDo([cuKy], {})[0];
  eq([r.goi, r.phong, r.ve_duoc, r.anh, r.ten], ['khong', null, false, [], 'Phòng ngủ master'], 'không có gói cho máy vẽ (trang đo bản cũ): vẫn hiện tên phòng, không dựng phòng từ số đo thô');
  // gói bản mới hơn tiện ích hiểu được
  const moiHon = PHONG_DO(); moiHon.muc.gui.ban = 2;
  r = P.phongDaDo([moiHon], {})[0];
  eq([r.goi, r.phong, r.ve_duoc], ['la', null, false], 'gói của trang đo bản mới hơn: không đọc bừa (nhắc cập nhật tiện ích)');
  // dữ liệu hỏng / lạ từ mạng
  eq([P.phongDaDo(null, {}), P.phongDaDo('abc', {}), P.phongDaDo([null, 5, 'x', {}, { ct: {}, muc: {} }, { ct: { id: '../x' }, muc: { id: 'muc000000001' } }, { ct: { id: 'ct0000000001' }, muc: { id: 'a b' } }], {})], [[], [], []], 'không phải danh sách / phần tử hỏng / mã lạ: bỏ qua');
  const ban = PHONG_DO();
  ban.ct.ten = '<img src=x onerror=alert(1)>' + 'x'.repeat(500); ban.nguoi_gui = 7; ban.sua_luc = 'abc'; ban.muc.ten = ''; ban.muc.xong = 'true';
  ban.muc.gui.bo = 'không phải mảng'; ban.muc.gui.loi = [5, null, 'x'.repeat(900)];
  ban.muc.gui.phong.goc = [99999, 1, 2]; ban.muc.gui.phong.da_ve = { n: 1 }; ban.muc.gui.phong.khung = [{ ten: 'K', tuong: 0, cach: 0, rong: 1000, cao: 2000, sau: 600, tu_id: 'ABC' }];
  ban.muc.gui.anh = [
    { id: 'anh000000001', tuong: 9, w: 800, h: 600, ghi: 12, co: NaN, net: [[1, 2, 3], [1, 2, 3, 'x'], [1, 2, 3, Infinity], [5, 6, 7, 8]], chu: [{ text: 5, x: 1, y: 2, co: 3, goc: 4 }, { text: 'ok', x: NaN, y: 1, co: 3, goc: 0 }, null, { text: 'được', x: 10, y: 20, co: 0, goc: 'x' }] },
    { id: '../../etc', tuong: 0, w: 10, h: 10 }, null, 'x',
    { id: 'anh000000003', tuong: 0, w: 'x', h: -5, ghi: 'cỡ ảnh hỏng', co: 30, net: [[5, 6, 7, 8]], chu: [{ text: 'a', x: 1, y: 2, co: 3, goc: 0 }] }];
  ban.anh_co = 'anh000000001';
  r = P.phongDaDo([ban], {})[0];
  eq([r.ct.length <= 80, r.nguoi, r.sua_luc, r.ten, r.xong, r.bo, r.loi.map(t => t.length <= 200)], [true, '', 0, 'Phòng', false, [], [true]], 'chữ dài bị cắt, kiểu sai về mặc định, lời báo không phải chữ thì bỏ');
  eq([r.phong.goc, r.phong.da_ve, r.phong.khung], [undefined, undefined, []], 'chỗ đặt, bản ghi đã vẽ, khung tủ KHÔNG nhận từ mạng (đó là việc của máy vẽ này)');
  eq(r.anh.map(a => [a.id, a.mat, a.w, a.h, a.ghi, a.co, a.net, a.chu, a.tren_may_chu]), [
    ['anh000000001', '', 800, 600, '', 30.8, [[5, 6, 7, 8]], [{ text: 'được', x: 10, y: 20, co: 30.8, goc: 0 }], false],
    ['anh000000003', 'A', 0, 0, 'cỡ ảnh hỏng', 0, [], [], false]],
    'ảnh: mã lạ thì bỏ; mặt không có thì coi là ảnh chung; nét / chữ hỏng thì bỏ từng cái, cái lành vẫn giữ (cỡ chữ hỏng thì theo cỡ của ảnh); không biết cỡ ảnh thì bỏ hết chú thích của ảnh đó (không biết đặt vào đâu); danh sách "máy chủ đã có" hỏng thì coi như chưa có');
  // quá nhiều thứ: có trần
  const nhieu = PHONG_DO(); nhieu.muc.gui.anh = Array.from({ length: 500 }, (x, i) => ({ id: 'anh' + String(100000000 + i), tuong: 0, w: 10, h: 10, net: Array.from({ length: 5000 }, () => [1, 2, 3, 4]), chu: [] }));
  r = P.phongDaDo([nhieu], {})[0];
  ok(r.anh.length <= 120 && r.anh.every(a => a.net.length <= 800), 'số ảnh và số nét có trần (trang không treo vì một gói khổng lồ)', [r.anh.length, r.anh[0].net.length]);
  ok(P.phongDaDo(Array.from({ length: 2000 }, (x, i) => { const q = PHONG_DO(); q.muc.id = 'muc' + String(100000000 + i); return q; }), {}).length <= 400, 'số phòng cũng có trần');
});

/* ---- bản 1.25 — KÉO KHUNG trên mặt đứng: dời, đổi cỡ, bắt điểm (anh Thanh 05/10/2026 08:19 "vẽ khung nhưng không move được", 08:20 "với có bắt điểm") ---- */
const PH_KEO = () => ({ cao: 2700, tuong: [{ dai: 3600 }, { dai: 3000 }, { dai: 3600 }, { dai: 'auto' }],
  mo: [{ tuong: 0, loai: 'cua', cach: 200, rong: 900, cao: 2200, be: 0 }],
  can: [{ tuong: 0, loai: 'cot', cach: 3300, rong: 300, nho: 200 }, { tuong: 1, loai: 'dam', cach: 0, rong: 3000, nho: 300, z0: 2400, z1: 2700 }],
  khung: [{ ten: 'K1', tuong: 0, cach: 1100, z: 0, rong: 1510, cao: 1190, sau: 400 }, { ten: 'K2', tuong: 0, cach: 1303, z: 1500, rong: 600, cao: 600, sau: 300 }, { ten: 'B1', tuong: 1, cach: 500, z: 0, rong: 1000, cao: 2000, sau: 600 }] });
const kq4 = r => r && [r.cach, r.z, r.rong, r.cao];

T('Mốc bắt điểm của một tường: mép tường, sàn, trần, mép cửa / cột / dầm / khung trên tường đó', () => {
  const H = P.hinhHoc(PH_KEO());
  eq(P.mocKhung(H, 0), { s: [0, 200, 1100, 1303, 1903, 2610, 3300, 3600], z: [0, 1190, 1500, 2100, 2200, 2700] }, 'tường A: đủ mốc, không trùng, xếp tăng dần (không lẫn mốc của tường B)');
  eq(P.mocKhung(H, 0, 0), { s: [0, 200, 1100, 1303, 1903, 3300, 3600], z: [0, 1500, 2100, 2200, 2700] }, 'bỏ khung đang kéo (K1): mép riêng của nó (2610, 1190) không còn là mốc; 1100 vẫn còn vì là mép cửa');
  eq(P.mocKhung(H, 1), { s: [0, 500, 1500, 3000], z: [0, 2000, 2400, 2700] }, 'tường B: mép khung B1 + đáy dầm 2400');
  eq(P.mocKhung(H, 9), { s: [], z: [] }, 'tường không có: không mốc nào');
});

T('Kéo khung — DỜI: số bắt chẵn 10; mép nào tới gần mốc thì bám mốc; không ra khỏi tường, không vượt trần', () => {
  const H = P.hinhHoc(PH_KEO());
  let r = P.keoKhung(H, 0, { ds: 406, dz: 297, tam: 10 });
  eq([kq4(r), r.bat_s, r.bat_z, r.ke], [[1510, 300, 1510, 1190], null, null, []], 'không gần mốc nào: dời đúng quãng kéo, làm tròn chẵn 10 (1506 → 1510, 297 → 300); cỡ giữ nguyên');
  r = P.keoKhung(H, 0, { ds: 406, dz: 297, tam: 85 });
  eq([kq4(r), r.bat_s, r.bat_z], [[1510, 310, 1510, 1190], null, 1500], 'tầm bắt 85: ĐỈNH khung (1487) bám đáy khung K2 (1500) → đáy = 310');
  r = P.keoKhung(H, 0, { ds: 20, dz: 15, tam: 85 });
  eq([kq4(r), r.bat_s, r.bat_z], [[1100, 0, 1510, 1190], 1100, 0], 'nhích nhẹ quanh mép cửa + sàn: mép trái bám mép cửa (1100), đáy bám sàn (0)');
  r = P.keoKhung(H, 0, { ds: 730, dz: 0, tam: 85, giu_z: true });
  eq([kq4(r), r.bat_s, r.bat_z], [[1790, 0, 1510, 1190], 3300, null], 'cả hai mép đều có mốc trong tầm (trái cách 1903: 73, phải cách mép cột 3300: 40): mép GẦN hơn thắng → mép phải bám mép cột');
  r = P.keoKhung(H, 0, { ds: 763, dz: 0, tam: 85, giu_z: true });
  eq([kq4(r), r.bat_s], [[1903, 0, 1510, 1190], 1903], '… mép trái gần hơn (cách 1903: 40, mép phải cách 3300: 73) → mép trái bám');
  r = P.keoKhung(H, 0, { ds: 5000, dz: 5000, tam: 85 });
  eq([kq4(r), r.bat_s, r.bat_z], [[2090, 1510, 1510, 1190], 3600, 2700], 'kéo quá cuối tường + quá trần: dừng sát cuối tường (3600 − 1510) và sát trần (2700 − 1190); vạch báo ở cuối tường, trần');
  r = P.keoKhung(H, 0, { ds: -5000, dz: -5000, tam: 85 });
  eq([kq4(r), r.bat_s, r.bat_z], [[0, 0, 1510, 1190], 0, 0], 'kéo quá đầu tường + xuống dưới sàn: dừng ở đầu tường, sàn');
  r = P.keoKhung(H, 0, { ds: 24, dz: 24, tam: 85, tu_do: true });
  eq([kq4(r), r.bat_s, r.bat_z], [[1120, 20, 1510, 1190], null, null], 'giữ Alt (tu_do): không bắt điểm, chỉ làm tròn chẵn 10');
  r = P.keoKhung(H, 0, { ds: 5000, dz: 0, tam: 85, tu_do: true });
  eq([kq4(r), r.bat_s], [[2090, 0, 1510, 1190], null], 'giữ Alt vẫn không ra khỏi tường (nhưng không có vạch báo)');
  r = P.keoKhung(H, 1, { ds: 2, dz: 104, tam: 0, giu_s: true });
  eq(kq4(r), [1303, 1600, 600, 600], 'kéo DỌC (giu_s): cách trái giữ nguyên số lẻ 1303 — không bị làm tròn thành 1300');
  r = P.keoKhung(H, 1, { ds: 104, dz: 26, tam: 85, giu_z: true });
  eq([kq4(r), r.bat_z], [[1410, 1500, 600, 600], null], 'kéo NGANG (giu_z): cao độ đáy giữ nguyên dù chuột có lệch lên 26, không bắt điểm theo chiều đứng');
  eq([P.keoKhung(H, 99, { ds: 10 }), P.keoKhung(null, 0, {}), P.keoKhung(P.hinhHoc({ cao: 2700, tuong: [{ dai: 0 }], khung: [{ tuong: 0, rong: 500, cao: 500, sau: 300 }] }), 0, { ds: 10 })], [null, null, null], 'khung không có / tường chưa có chiều dài → null');
  const to = P.hinhHoc({ cao: 2700, tuong: [{ dai: 3600 }, { dai: 3000 }, { dai: 3600 }, { dai: 'auto' }], khung: [{ ten: 'TO', tuong: 0, cach: 0, z: 0, rong: 4000, cao: 3000, sau: 600 }] });
  eq(kq4(P.keoKhung(to, 0, { ds: 700, dz: 700, tam: 30 })), [0, 0, 4000, 3000], 'khung to hơn cả tường: giữ ở đầu tường + sàn (không âm)');
});

T('Kéo khung — ĐỔI CỠ: nắm mép / góc; mép đối diện đứng yên; bắt điểm; không nhỏ hơn 100; không ra khỏi tường', () => {
  const H = P.hinhHoc(PH_KEO());
  let r = P.keoKhung(H, 0, { phai: true, ds: -400, dz: 55, tam: 30 });
  eq([kq4(r), r.bat_s, r.bat_z], [[1100, 0, 1110, 1190], null, null], 'mép PHẢI kéo vào 400: rộng 1510 → 1110; mép trái, đáy, cao đứng yên (kéo lệch lên 55 không ảnh hưởng)');
  r = P.keoKhung(H, 0, { phai: true, ds: 670, tam: 30 });
  eq([kq4(r), r.bat_s], [[1100, 0, 2200, 1190], 3300], 'mép phải tới cách mép cột 20: bám mép cột (3300)');
  r = P.keoKhung(H, 0, { phai: true, ds: 3000, tam: 30 });
  eq([kq4(r), r.bat_s], [[1100, 0, 2500, 1190], 3600], 'mép phải kéo quá cuối tường: dừng ở cuối tường');
  r = P.keoKhung(H, 0, { phai: true, ds: -3000, tam: 30 });
  eq([kq4(r), r.bat_s], [[1100, 0, 100, 1190], null], 'mép phải kéo lấn qua mép trái: rộng dừng ở 100');
  r = P.keoKhung(H, 0, { trai: true, ds: -200, tam: 30 });
  eq(kq4(r), [900, 0, 1710, 1190], 'mép TRÁI kéo ra 200: cách trái 900, rộng 1710 (mép phải đứng yên ở 2610)');
  r = P.keoKhung(H, 0, { trai: true, ds: -880, tam: 30 });
  eq([kq4(r), r.bat_s], [[200, 0, 2410, 1190], 200], 'mép trái tới gần mép trái cửa (200): bám');
  r = P.keoKhung(H, 0, { trai: true, ds: 90, tam: 120 });
  eq([kq4(r), r.bat_s], [[1100, 0, 1510, 1190], 1100], 'hai mốc cùng trong tầm (1100 cách 90, 1303 cách 113): bám mốc GẦN nhất, không phải mốc xét sau cùng');
  r = P.keoKhung(H, 0, { trai: true, ds: 3000, tam: 30 });
  eq(kq4(r), [2510, 0, 100, 1190], 'mép trái kéo lấn qua mép phải: rộng dừng ở 100, mép phải vẫn ở 2610');
  r = P.keoKhung(H, 0, { trai: true, ds: -3000, tam: 30 });
  eq([kq4(r), r.bat_s], [[0, 0, 2610, 1190], 0], 'mép trái kéo quá đầu tường: dừng ở đầu tường');
  r = P.keoKhung(H, 0, { tren: true, dz: 300, tam: 30 });
  eq([kq4(r), r.bat_z], [[1100, 0, 1510, 1500], 1500], 'mép TRÊN lên 300 (1490): bám đáy khung K2 (1500)');
  r = P.keoKhung(H, 0, { tren: true, dz: 500, tam: 30 });
  eq([kq4(r), r.bat_z], [[1100, 0, 1510, 1690], null], 'mép trên lên 500: không gần mốc nào → cao 1690');
  r = P.keoKhung(H, 0, { tren: true, dz: 5000, tam: 30 });
  eq([kq4(r), r.bat_z], [[1100, 0, 1510, 2700], 2700], 'mép trên kéo quá trần: dừng ở trần');
  r = P.keoKhung(H, 1, { duoi: true, dz: -200, tam: 30 });
  eq([kq4(r), r.bat_z], [[1303, 1300, 600, 800], null], 'mép DƯỚI của K2 xuống 200: đáy 1300, cao 800 (đỉnh đứng yên ở 2100)');
  r = P.keoKhung(H, 1, { duoi: true, dz: -290, tam: 30 });
  eq([kq4(r), r.bat_z], [[1303, 1190, 600, 910], 1190], 'mép dưới của K2 xuống gần đỉnh K1 (1190): bám');
  r = P.keoKhung(H, 1, { duoi: true, dz: 5000, tam: 30 });
  eq(kq4(r), [1303, 2000, 600, 100], 'mép dưới kéo lấn qua đỉnh: cao dừng ở 100');
  r = P.keoKhung(H, 0, { phai: true, tren: true, ds: 200, dz: 200, tam: 10 });
  eq(kq4(r), [1100, 0, 1710, 1390], 'nắm GÓC trên – phải: rộng và cao cùng đổi');
  r = P.keoKhung(H, 0, { trai: true, duoi: true, ds: 233, dz: 104, tam: 10 });
  eq(kq4(r), [1330, 100, 1280, 1090], 'nắm góc dưới – trái: hai mép kia đứng yên (mép phải vẫn 2610, đỉnh vẫn 1190)');
  r = P.keoKhung(H, 0, { trai: true, duoi: true, ds: 205, dz: 104, tam: 10 });
  eq([kq4(r), r.bat_s], [[1303, 100, 1307, 1090], 1303], '… mép trái tới cách mép khung K2 (1303) có 2: bám đúng số lẻ đó, không làm tròn');
  r = P.keoKhung(H, 0, { phai: true, tren: true, ds: 200, dz: 26, tam: 10, giu_z: true });
  eq(kq4(r), [1100, 0, 1710, 1190], 'nắm góc mà chỉ kéo ngang (giu_z): cao giữ nguyên');
  r = P.keoKhung(H, 0, { phai: true, tren: true, ds: 26, dz: 200, tam: 10, giu_s: true });
  eq(kq4(r), [1100, 0, 1510, 1390], 'nắm góc mà chỉ kéo đứng (giu_s): rộng giữ nguyên');
  r = P.keoKhung(H, 0, { phai: true, ds: 26, tam: 85, tu_do: true });
  eq([kq4(r), r.bat_s], [[1100, 0, 1540, 1190], null], 'giữ Alt khi đổi cỡ: không bắt điểm, làm tròn chẵn 10');
  const nho = P.hinhHoc({ cao: 2700, tuong: [{ dai: 3600 }, { dai: 3000 }, { dai: 3600 }, { dai: 'auto' }], khung: [{ ten: 'N', tuong: 0, cach: 1000, z: 0, rong: 60, cao: 70, sau: 300 }] });
  eq(kq4(P.keoKhung(nho, 0, { phai: true, tren: true, ds: -500, dz: -500, tam: 10 })), [1000, 0, 60, 70], 'khung vốn nhỏ hơn 100: không co nhỏ hơn cỡ đang có');
  eq(kq4(P.keoKhung(nho, 0, { phai: true, ds: 440, tam: 10 })), [1000, 0, 500, 70], '… nhưng vẫn nới rộng ra được');
});

T('Kéo khung — Ô KỀ khít (vách chia ô): kéo mép chung thì ô kề co / giãn theo, không hở không chồng', () => {
  const p0 = { cao: 2700, tuong: [{ dai: 3600 }, { dai: 3000 }, { dai: 3600 }, { dai: 'auto' }], khung: [{ ten: 'V', tuong: 0, cach: 0, z: 0, rong: 3000, cao: 2400, sau: 350 }] };
  const doc = P.chiaKhung(p0, 0, 3, 'doc').p, H = P.hinhHoc(doc);      // 3 ô cạnh nhau: 0…1000, 1000…2000, 2000…3000
  let r = P.keoKhung(H, 0, { phai: true, ds: 200, tam: 30 });
  eq([kq4(r), r.ke], [[0, 0, 1200, 2400], [{ j: 1, cach: 1200, z: 0, rong: 800, cao: 2400 }]], 'mép phải ô 1 ra 200: ô 2 lùi mép trái 200, hẹp lại còn 800');
  r = P.keoKhung(H, 0, { phai: true, ds: 980, tam: 30 });
  eq([kq4(r), r.ke], [[0, 0, 1950, 2400], [{ j: 1, cach: 1950, z: 0, rong: 50, cao: 2400 }]], 'kéo quá: ô kề không nhỏ hơn 50 → mép chung dừng ở 1950');
  r = P.keoKhung(H, 1, { trai: true, ds: -300, tam: 30 });
  eq([kq4(r), r.ke], [[700, 0, 1300, 2400], [{ j: 0, cach: 0, z: 0, rong: 700, cao: 2400 }]], 'mép trái ô 2 sang trái 300: ô 1 hẹp lại còn 700');
  r = P.keoKhung(H, 1, { trai: true, ds: -990, tam: 30 });
  eq([kq4(r), r.ke], [[50, 0, 1950, 2400], [{ j: 0, cach: 0, z: 0, rong: 50, cao: 2400 }]], '… kéo quá: ô 1 còn đúng 50');
  r = P.keoKhung(H, 0, { phai: true, ds: 20, tam: 85 });
  eq([kq4(r), r.bat_s, r.ke.map(k => k.cach)], [[0, 0, 1020, 2400], null, [1020]], 'nhích mép chung 20 trong tầm bắt 85: KHÔNG bị hút về chỗ cũ (mép của ô kề đang chạy theo không phải mốc)');
  r = P.keoKhung(H, 0, { phai: true, ds: 200, tam: 30, tu_do: true });
  eq([kq4(r), r.ke], [[0, 0, 1200, 2400], []], 'giữ Alt: kéo tự do — ô kề đứng yên');
  r = P.keoKhung(H, 2, { phai: true, ds: 300, tam: 30 });
  eq([kq4(r), r.ke], [[2000, 0, 1300, 2400], []], 'mép phải ô cuối (không có ô kề bên phải): chỉ ô đó đổi');
  r = P.keoKhung(H, 0, { phai: true, tren: true, ds: 200, dz: -400, tam: 30 });
  eq([kq4(r), r.ke], [[0, 0, 1200, 2000], []], 'nắm GÓC: hai chiều cùng đổi thì ô kề không còn khít → không kéo ô kề theo');
  r = P.keoKhung(H, 0, { ds: 300, dz: 0, tam: 0, giu_z: true });
  eq([kq4(r), r.ke], [[300, 0, 1000, 2400], []], 'DỜI cả ô: ô kề không chạy theo');
  const ngang = P.chiaKhung(p0, 0, 2, 'ngang').p, H2 = P.hinhHoc(ngang);      // 2 ô chồng nhau: 0…1200, 1200…2400
  r = P.keoKhung(H2, 0, { tren: true, dz: 100, tam: 30 });
  eq([kq4(r), r.ke], [[0, 0, 3000, 1300], [{ j: 1, cach: 0, z: 1300, rong: 3000, cao: 1100 }]], 'mép trên ô dưới lên 100: ô trên nâng đáy, thấp lại');
  r = P.keoKhung(H2, 1, { duoi: true, dz: -150, tam: 30 });
  eq([kq4(r), r.ke], [[0, 1050, 3000, 1350], [{ j: 0, cach: 0, z: 0, rong: 3000, cao: 1050 }]], 'mép dưới ô trên xuống 150: ô dưới thấp lại');
  r = P.keoKhung(H2, 1, { duoi: true, dz: -5000, tam: 30 });
  eq([kq4(r), r.ke], [[0, 50, 3000, 2350], [{ j: 0, cach: 0, z: 0, rong: 3000, cao: 50 }]], '… kéo quá: ô dưới còn đúng 50');
  // ô kề KHÔNG khít (cao khác nhau) thì không chạy theo
  const lech = JSON.parse(JSON.stringify(doc)); lech.khung[1].cao = 2000;
  r = P.keoKhung(P.hinhHoc(lech), 0, { phai: true, ds: 200, tam: 0 });
  eq([kq4(r), r.ke], [[0, 0, 1200, 2400], []], 'ô bên cạnh cao khác (không khít): không kéo theo');
});

console.log(`\n${pass} đạt, ${fail} hỏng`);
process.exit(fail ? 1 : 0);
