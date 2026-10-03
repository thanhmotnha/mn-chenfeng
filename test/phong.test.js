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
  ok(K && K.ben === 'giua' && K.co_a && K.co_b && K.xa === 985 && K.xb === 1315, 'hai vách trùng hai mép cột (cột + hở 15 mỗi bên — mặc định từ bản 1.17.1)', K);
  ok(!M.parts.some(x => x.khau && x.khau.length) && !M.parts.some(x => x.ten === 'Vách khấu cột'), 'khoang nông: không tấm nào phải khoét, không thêm vách khấu');
  ok(M.parts.filter(x => x.ten === 'Hậu khấu cột').every(x => x.x0 === 985 && x.x1 === 1315) && M.parts.some(x => x.ten === 'Hậu khấu cột'), 'hậu khấu trước mặt cột đúng bề rộng vùng cột');
  ok(co(r.ghi_chu, /Khấu cột giữa: cách đầu trái 1000, cột 300 ngang × 220 sâu \(hở 15\)/) && co(r.ghi_chu, /Cột giữa: .*khoang trước cột là khoang nông/), 'ghi chú', r.ghi_chu);
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
  const S = C.normalize({ ma: 'TDN', rong: 2400, cao: 2400, sau_thung: 560, than: { cao_duoi: 0 }, thung: { rong_max: 0 },
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

console.log(`\n${pass} đạt, ${fail} hỏng`);
process.exit(fail ? 1 : 0);
