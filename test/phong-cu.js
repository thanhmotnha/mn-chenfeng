'use strict';
// (bản 1.41.0) BĂM KẾT QUẢ LÕI PHÒNG cho các phòng KHÔNG có phòng con — phòng cũ phải ra y từng byte như 1.40.2.
// Số băm chuẩn lấy bằng lõi 1.40.2 trước khi thêm phòng con (git show c821790:src/mncf-phong.js) — không được dựng lại bằng lõi đang sửa.
// Dữ liệu: phòng mẫu, vài phòng viết tay, 200 phòng ngẫu nhiên (bộ sinh số cố định): tường (có góc lồi, tường tự tính, tường thấp), cửa, cột, dầm, hộp, điện – nước, khung
// (tủ / mẫu kho, treo), điểm đặt + hướng; mỗi phòng: chuanHoa, hinhHoc, phanPhong, banGhiPhong, tuongGhi, doiChieuPhong (bản vẽ giả + bản ghi), chuanDaVe, lechDaVe,
// datKhung, ba hình SVG, choTrong 20 điểm mỗi tường, mocKhung, keoKhung, tomTat, duongNet; thêm vài công trình hai phòng ghép (datNha, hinhNha, kiemNha, mặt bằng cả nhà).
const crypto = require('crypto');
function sinh(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function phongNgauNhien(r, k) {
  const n = 4 + Math.floor(r() * 3), tuong = [];
  if (n === 4) { const a = 2400 + Math.round(r() * 30) * 100, b = 2000 + Math.round(r() * 25) * 100; tuong.push({ dai: a }, { dai: b }, { dai: a }, { dai: r() < 0.5 ? 'auto' : b }); }
  else if (n === 6) { const a = 4000 + Math.round(r() * 10) * 100, b = 3000 + Math.round(r() * 10) * 100, x = 800 + Math.round(r() * 5) * 100, y = 600 + Math.round(r() * 5) * 100;
    tuong.push({ dai: a }, { dai: b - y }, { dai: x, re: -90 }, { dai: y }, { dai: a - x }, { dai: 'auto' }); }
  else for (let i = 0; i < n; i++) tuong.push({ dai: 1500 + Math.round(r() * 30) * 100, re: i === 2 && r() < 0.3 ? 80 : 90 });
  if (r() < 0.2) tuong[1].cao = 2400;
  const W = tuong.length, mo = [], can = [], dn = [], khung = [];
  for (let i = 0, m = Math.floor(r() * 3); i < m; i++) mo.push({ tuong: Math.floor(r() * W), loai: ['cua', 'cua_so', 'o_trong'][Math.floor(r() * 3)], cach: Math.round(r() * 20) * 100, rong: 600 + Math.round(r() * 6) * 100, cao: 1200 + Math.round(r() * 10) * 100, be: r() < 0.5 ? 0 : 900 });
  for (let i = 0, m = Math.floor(r() * 3); i < m; i++) { const loai = ['cot', 'dam', 'hop'][Math.floor(r() * 3)]; can.push({ tuong: Math.floor(r() * W), loai, cach: Math.round(r() * 20) * 100, rong: 200 + Math.round(r() * 6) * 50, nho: 150 + Math.round(r() * 4) * 50 }); }
  const LD = ['o_dien', 'cong_tac', 'cap_nuoc', 'thoat_nuoc', 'khac', 'thoat_san', 'ong_san'];
  for (let i = 0, m = Math.floor(r() * 4); i < m; i++) dn.push({ tuong: Math.floor(r() * W), loai: LD[Math.floor(r() * LD.length)], cach: Math.round(r() * 30) * 100, cao: 200 + Math.round(r() * 12) * 100, ra: 100 + Math.round(r() * 5) * 100 });
  for (let i = 0, m = Math.floor(r() * 4); i < m; i++) { const q = { ten: 'K' + (i + 1), tuong: Math.floor(r() * W), cach: Math.round(r() * 20) * 100, rong: 600 + Math.round(r() * 20) * 100, cao: 2000 + Math.round(r() * 7) * 100, sau: 400 + Math.round(r() * 4) * 50, z: r() < 0.2 ? 1500 : 0 }; if (r() < 0.2) { q.kieu = 'kho'; q.kho = { id: 11 + i, ten: 'Mẫu ' + i, kt: [800, 500, 2000] }; } if (r() < 0.2) q.tu_id = 'MNCF-' + k + '-' + i; khung.push(q); }
  const p = { ten: 'P' + k, cao: 2600 + Math.round(r() * 3) * 100, day: r() < 0.5 ? 110 : 220, tuong, mo, can, dn, khung };
  if (r() < 0.5) p.goc = [Math.round(r() * 1e5), Math.round(r() * 1e5), 0];
  if (r() < 0.3) p.huong = [90, -90, 180, 30][Math.floor(r() * 4)];
  return p;
}
const tuongVe = (a, b, day, cao) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, u = [dx / L * day, dy / L * day], n = [-dy / L * day, dx / L * day];
  return { mat: [[a, b], [[a[0] + n[0] - u[0], a[1] + n[1] - u[1]], [b[0] + n[0] + u[0], b[1] + n[1] + u[1]]]], day, cao, z: 0 }; };
function ketQua(P, p) {
  const out = [], H = P.hinhHoc(p), moi = P.phanPhong(H, H.p.day), cu = P.banGhiPhong(moi, {});
  out.push(P.chuanHoa(p), H, moi, cu, P.tuongGhi(moi, null, null), P.tomTat(H), P.duongNet(H));
  // bản vẽ giả: đủ tường trừ tường đầu + hộp lỗ / cột / dầm như phòng muốn
  const co = { tuong: moi.tuong.slice(1).map(w => tuongVe(w.a, w.b, w.day, w.cao)), lo: moi.mo.map(m => ({ hop: m.hop })), cot: moi.cot.map(m => ({ hop: m.hop })), dam: [] };
  const k1 = P.doiChieuPhong(moi, co, null), k2 = P.doiChieuPhong(moi, co, cu), k3 = P.doiChieuPhong(moi, { tuong: [], lo: [], cot: [], dam: [] }, null);
  out.push(k1, k2, k3, P.tuongGhi(moi, k2, moi.tuong.map((w, i) => i > 0)));
  const p2 = Object.assign({}, p, { da_ve: cu }); out.push(P.chuanHoa(p2), P.lechDaVe(H, P.chuanHoa(p2)));
  out.push(P.matBangSVG(H, { sua: true, chon_tuong: 0, chon_khung: 0 }), P.matBangSVG(H, {}));
  H.tuong.forEach((w, i) => { out.push(P.matDungSVG(H, i, { sua: true, chon_khung: 0 }), P.mocKhung(H, i, -1)); for (let s = 0; s < 20; s++) out.push(P.choTrong(H, i, (w.dai || 0) * s / 19, { sau: 600 })); });
  (H.khung || []).forEach((q, j) => { out.push(P.datKhung(H, j), P.keoKhung(H, j, { ds: 137, dz: 0 }), P.keoKhung(H, j, { phai: true, ds: -233 }), P.khauChoKhung(H, j)); });
  return out;
}
function bam(P) {
  const r = sinh(20261104), h = crypto.createHash('sha256'), them = x => h.update(JSON.stringify(x === undefined ? null : x) + '\n');
  const ds = [P.macDinh(),
    { ten: 'L', cao: 2800, tuong: [{ dai: 4000 }, { dai: 2000 }, { dai: 1500, re: -90 }, { dai: 1500 }, { dai: 2500 }, { dai: 'auto' }], mo: [{ tuong: 0, loai: 'cua', cach: 300, rong: 900, cao: 2100 }], khung: [{ ten: 'K1', tuong: 0, cach: 1500, rong: 2000, cao: 2700, sau: 600 }] },
    { ten: 'Hở', cao: 2700, tuong: [{ dai: 3600 }, { dai: 3000 }, { dai: 3580 }, { dai: 3000 }] }];
  for (let k = 0; k < 200; k++) ds.push(phongNgauNhien(r, k));
  for (const p of ds) for (const x of ketQua(P, p)) them(x);
  // công trình hai phòng ghép
  for (let k = 0; k < 6; k++) {
    const Y = Object.assign(phongNgauNhien(r, 900 + k), { id: 'P1' }), B = Object.assign(phongNgauNhien(r, 950 + k), { id: 'P2' });
    Y.tuong = [{ dai: 3600 }, { dai: 3000 }, { dai: 3600 }, { dai: 'auto' }]; B.tuong = [{ dai: 3000 }, { dai: 3000 }, { dai: 3000 }, { dai: 'auto' }];
    for (const q of [Y, B]) for (const x of ['mo', 'can', 'dn', 'khung']) q[x] = (q[x] || []).filter(m => m.tuong < 4);
    B.ghep = { phong: 'P1', tuong: 1, tuong_minh: 3, cach: k * 100 };
    const N = P.datNha({ id: 'C1', ten: 'n', chon: 'P1', phong: [Y, B] }).ct;
    them(N); them(P.kiemNha(N)); them(P.matBangNhaSVG(N, { chon: 'P2' })); them(P.khacDaVe(N, 'P1'));
    for (const id of ['P1', 'P2']) { const H = P.hinhNha(N, id); them(H); them(P.phanPhong(H, 110)); them(P.matBangSVG(H, { sua: true })); }
  }
  return h.digest('hex');
}
module.exports = { bam, sinh, phongNgauNhien };
