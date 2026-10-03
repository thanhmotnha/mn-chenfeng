'use strict';
// Kiểm tra lõi "Phòng" (Node thuần):  node test/phong.test.js
const P = require('../src/mncf-phong.js');
const C = require('../src/mncf-core.js');
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
  ok(co(r.ghi_chu, /Khấu cột trái: cột lấn 300 ngang × 220 sâu \(hở 10\)/), 'ghi chú khấu', r.ghi_chu);
  ok(M.parts.filter(x => x.khau && x.khau.length).length >= 2, 'đáy + nóc có góc khoét');
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

T('Khấu cột GIỮA (bản 1.14): cột sát tường nằm giữa khung → tủ tự đặt vách theo hai mép cột', () => {
  const p = P.macDinh();
  p.can = [{ tuong: 0, loai: 'cot', cach: 1400, rong: 300, nho: 220 }];
  p.khung = [{ tuong: 0, ten: 'TA-G', cach: 400, rong: 2400, cao: 2300, sau: 600 }];
  const H = P.hinhHoc(p);
  eq(P.khauChoKhung(H, 0).giua_cot, [{ cach: 1000, rong: 300, sau: 220 }], 'cột cách đầu trái khung 1000');
  const r = P.tuChoKhung(C, C.DEFAULT_SPEC, H.khung[0], 'Phòng ngủ', H, 0), M = C.build(r.spec), bb = C.bbox(M.parts);
  eq(r.spec.khau.giua, [{ cach: 1000, rong: 300, sau: 220 }], 'thông số tủ mang cột giữa');
  eq(M.errors, [], 'dựng không lỗi'); eq([bb.x1 - bb.x0, bb.z1 - bb.z0], [2400, 2300], 'vẫn phủ bì đúng khung');
  const K = M.info.khau[0];
  ok(K && K.ben === 'giua' && K.co_a && K.co_b && K.xa === 990 && K.xb === 1310, 'hai vách trùng hai mép cột (cột + hở 10 mỗi bên)', K);
  ok(!M.parts.some(x => x.khau && x.khau.length) && !M.parts.some(x => x.ten === 'Vách khấu cột'), 'khoang nông: không tấm nào phải khoét, không thêm vách khấu');
  ok(M.parts.filter(x => x.ten === 'Hậu khấu cột').every(x => x.x0 === 990 && x.x1 === 1310) && M.parts.some(x => x.ten === 'Hậu khấu cột'), 'hậu khấu trước mặt cột đúng bề rộng vùng cột');
  ok(co(r.ghi_chu, /Khấu cột giữa: cách đầu trái 1000, cột 300 ngang × 220 sâu \(hở 10\)/) && co(r.ghi_chu, /Cột giữa: .*khoang trước cột là khoang nông/), 'ghi chú', r.ghi_chu);
  // cột KHÔNG sát tường (đứng rời) thì chưa khấu được
  const p2 = P.macDinh(); p2.can = [{ tuong: 1, loai: 'cot', cach: 1000, rong: 300, nho: 2400 }]; p2.khung = [{ tuong: 0, ten: 'K', cach: 0, rong: 2000, cao: 2300, sau: 600 }];
  ok(P.khauChoKhung(P.hinhHoc(p2), 0).giua_cot.length === 0, 'cột không sát tường của khung: không coi là cột giữa');
});

T('Mã phòng: đọc lại được, bỏ chữ thừa quanh', () => {
  const p = P.chuanHoa(P.macDinh());
  eq(P.docMa('Đây là mã phòng:\n```json\n' + JSON.stringify(p) + '\n```\nhết'), p, 'JSON lẫn trong chữ');
  eq(P.docMa('không có gì'), null, 'không phải mã'); eq(P.docMa('{"a":1}'), null, 'JSON không có tường'); eq(P.docMa('{hỏng'), null, 'JSON hỏng');
  eq(P.tenTuong(0) + P.tenTuong(25) + P.tenTuong(26), 'AZAA', 'tên tường A…Z, AA');
});

console.log(`\n${pass} đạt, ${fail} hỏng`);
process.exit(fail ? 1 : 0);
