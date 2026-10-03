/*!
 * mncf-phong.js — Một Nhà · phòng hiện trạng.
 * Mô hình phòng do người dùng TỰ ĐIỀN số đo (tường, cửa, dầm cột) + các "khung không gian" (chỗ đặt tủ) → mặt bằng, mặt đứng từng tường (SVG),
 * kiểm tra (phòng có khép kín không, khung có che cửa / vướng dầm cột / chồng nhau không), vị trí đặt tủ, thông số tủ vừa khung.
 *
 * Quy ước: đi vòng quanh phòng THEO CHIỀU KIM ĐỒNG HỒ (nhìn từ trên xuống). Đứng trong phòng nhìn vào một tường thì đầu tường nằm bên TRÁI,
 * tường kế tiếp nằm bên PHẢI. `re` = góc rẽ phải ở CUỐI tường (90 = góc phòng bình thường, −90 = góc lồi như chỗ cột / hộp kỹ thuật nhô ra).
 * Mọi khoảng `cach` đo từ đầu trái của tường. Toạ độ: tường đầu tiên chạy theo +x tại y = 0, lòng phòng ở phía y âm, z = cao (sàn = 0). Đơn vị mm.
 * Chạy được trong Node (require) lẫn trình duyệt (MNCFPhong). Không phụ thuộc thư viện nào.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MNCFPhong = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const BAN = 1;
  const rn = (v, d = 1) => { const k = Math.pow(10, d); return Math.round((v + Number.EPSILON) * k) / k; };
  const g = v => String(rn(v, 1)).replace('.', ',');
  const num = (v, dflt) => { if (typeof v === 'string') v = v.trim().replace(',', '.'); const x = Number(v); return (v === '' || v === null || v === undefined || !isFinite(x)) ? dflt : x; };
  const clone = o => JSON.parse(JSON.stringify(o));
  const esc = v => String(v === undefined || v === null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tenTuong = i => { let s = ''; i++; while (i > 0) { s = String.fromCharCode(65 + (i - 1) % 26) + s; i = Math.floor((i - 1) / 26); } return s; };
  const LOAI_MO = { cua: 'Cửa đi', cua_so: 'Cửa sổ', o_trong: 'Ô trống' };
  const LOAI_CAN = { cot: 'Cột', dam: 'Dầm', hop: 'Hộp kỹ thuật' };

  /** Phòng mẫu: 3600 × 3000, trần 2700, cửa đi ở tường C. Tường cuối để 'auto' = tự tính cho phòng khép kín. */
  const macDinh = () => ({
    ban: BAN, ten: 'Phòng ngủ', cao: 2700, day: 110,
    tuong: [{ ten: 'A', dai: 3600, re: 90 }, { ten: 'B', dai: 3000, re: 90 }, { ten: 'C', dai: 3600, re: 90 }, { ten: 'D', dai: 'auto', re: 90 }],
    mo: [{ tuong: 2, loai: 'cua', cach: 200, rong: 900, cao: 2200, be: 0 }],
    can: [],
    khung: [],
  });

  function chuanHoa(pIn) {
    const p = pIn && typeof pIn === 'object' ? clone(pIn) : macDinh();
    const o = { ban: BAN, ten: String(p.ten || 'Phòng').slice(0, 60), cao: Math.max(0, num(p.cao, 2700)), day: Math.max(10, num(p.day, 110)) };      // day = bề dày tường khi vẽ vào Chenfeng (nằm ngoài lòng phòng)
    o.tuong = (Array.isArray(p.tuong) ? p.tuong : []).map((t, i) => {
      t = t || {};
      const auto = t.dai === 'auto' || t.dai === '' || t.dai === null || t.dai === undefined;
      const w = { ten: String(t.ten || tenTuong(i)).slice(0, 12), dai: auto ? 'auto' : Math.max(0, num(t.dai, 0)), re: num(t.re, 90) };
      if (num(t.cao, 0) > 0) w.cao = num(t.cao, 0);      // tường thấp hơn trần chung (vd lan can, vách lửng)
      return w;
    });
    let daCo = false;      // chỉ một tường được 'auto' (tường 'auto' cuối cùng); các tường 'auto' khác tính là 0
    for (let i = o.tuong.length - 1; i >= 0; i--) if (o.tuong[i].dai === 'auto') { if (daCo) o.tuong[i].dai = 0; daCo = true; }
    const n = o.tuong.length, iT = v => Math.min(Math.max(0, Math.round(num(v, 0))), Math.max(0, n - 1));
    o.mo = (Array.isArray(p.mo) ? p.mo : []).map(m => ({ tuong: iT(m.tuong), loai: LOAI_MO[m.loai] ? m.loai : 'cua', cach: num(m.cach, 0), rong: Math.max(0, num(m.rong, 900)), cao: Math.max(0, num(m.cao, 2200)), be: Math.max(0, num(m.be, 0)) }));
    o.can = (Array.isArray(p.can) ? p.can : []).map(c => {
      const loai = LOAI_CAN[c.loai] ? c.loai : 'cot';
      return { tuong: iT(c.tuong), loai, cach: num(c.cach, 0), rong: Math.max(0, num(c.rong, 300)), nho: Math.max(0, num(c.nho, 200)), z0: Math.max(0, num(c.z0, loai === 'dam' ? Math.max(0, o.cao - 300) : 0)), z1: Math.max(0, num(c.z1, o.cao)) };
    });
    o.khung = (Array.isArray(p.khung) ? p.khung : []).map((k, i) => {
      const q = { ten: String(k.ten || 'K' + (i + 1)).slice(0, 24), tuong: iT(k.tuong), cach: num(k.cach, 0), z: Math.max(0, num(k.z, 0)), rong: Math.max(0, num(k.rong, 1000)), cao: Math.max(0, num(k.cao, o.cao)), sau: Math.max(0, num(k.sau, 600)), mau: String(k.mau || ''), ghi_chu: String(k.ghi_chu || '').slice(0, 200) };
      if (k.tu_id) q.tu_id = String(k.tu_id);      // mã của tủ đã vẽ vào khung này (để biết khung nào đã vẽ)
      return q;
    });
    if (Array.isArray(p.goc) && p.goc.length === 3) o.goc = p.goc.map(v => num(v, 0));      // điểm đặt đầu tường A trong bản vẽ Chenfeng
    return o;
  }

  /* ---------------- hình học ---------------- */
  const cong = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const nhan = (a, k) => [a[0] * k, a[1] * k];
  const cham = (a, b) => a[0] * b[0] + a[1] * b[1];
  const sach = v => (Math.abs(v) < 1e-9 ? 0 : v);

  /** Hai đa giác lồi có chồng lên nhau không (chạm mép không tính; lấn dưới `eps` mm không tính). */
  function giao(A, B, eps) {
    eps = eps === undefined ? 0.5 : eps;
    for (const P of [A, B]) for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], ax = [-(b[1] - a[1]), b[0] - a[0]], L = Math.hypot(ax[0], ax[1]);
      if (L < 1e-9) continue;
      const u = [ax[0] / L, ax[1] / L];
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (const q of A) { const t = cham(q, u); a0 = Math.min(a0, t); a1 = Math.max(a1, t); }
      for (const q of B) { const t = cham(q, u); b0 = Math.min(b0, t); b1 = Math.max(b1, t); }
      if (a1 - b0 <= eps || b1 - a0 <= eps) return false;
    }
    return true;
  }

  /**
   * @returns {{p, tuong:[{i,ten,dai,cao,a,d,n,p0,p1,tu_tinh}], khep:{kin,ho,dx,dy,tong_re}, dien_tich, chu_vi, hop, loi:[], luu_y:[], ghi_chu:[]}}
   *   d = hướng chạy của tường, n = hướng vào lòng phòng. Điểm trên tường: p0 + d·s + n·t (s = cách đầu trái, t = nhô vào phòng).
   */
  function hinhHoc(pIn) {
    const p = chuanHoa(pIn), loi = [], luu_y = [], ghi_chu = [];
    const W = []; let a = 0;
    p.tuong.forEach((t, i) => {
      const r = a * Math.PI / 180, d = [sach(Math.cos(r)), sach(Math.sin(r))];
      W.push({ i, ten: t.ten, dai: t.dai, cao: t.cao > 0 ? Math.min(t.cao, p.cao || t.cao) : p.cao, a, d, n: [d[1], sach(-d[0])], tu_tinh: false });
      a -= t.re;
    });
    const tongRe = p.tuong.reduce((s, t) => s + t.re, 0);
    // tường 'auto': dài sao cho điểm cuối về sát điểm đầu nhất
    const k = W.findIndex(w => w.dai === 'auto');
    if (k >= 0) {
      let S = [0, 0]; for (const w of W) if (w.i !== k) S = cong(S, nhan(w.d, w.dai));
      const L = -cham(S, W[k].d);
      W[k].tu_tinh = true;
      if (W.length < 3) { W[k].dai = 0; loi.push(`Tường ${W[k].ten} để tự tính nhưng phòng mới có ${W.length} tường — gõ chiều dài cho tường này.`); }
      else if (L > 0.5) W[k].dai = rn(L, 1);
      else { W[k].dai = 0; loi.push(`Không tự tính được chiều dài tường ${W[k].ten}: các tường còn lại không để chừa chỗ cho nó (kiểm tra chiều dài và hướng rẽ).`); }
    }
    let P = [0, 0];
    for (const w of W) { w.p0 = [rn(P[0], 3), rn(P[1], 3)]; P = cong(P, nhan(w.d, w.dai)); w.p1 = [rn(P[0], 3), rn(P[1], 3)]; if (!(w.dai > 0) && !w.tu_tinh) loi.push(`Tường ${w.ten} chưa có chiều dài.`); }
    const ho = Math.hypot(P[0], P[1]);
    const khep = { kin: W.length >= 3 && ho < 1 && Math.abs(tongRe - 360) < 0.01, ho: rn(ho, 1), dx: rn(-P[0], 1), dy: rn(-P[1], 1), tong_re: rn(tongRe, 2) };
    if (W.length >= 3 && !khep.kin) {
      if (Math.abs(tongRe - 360) >= 0.01) luu_y.push(`Phòng chưa khép kín: tổng các góc rẽ là ${g(tongRe)}° (phòng kín phải đủ 360°). Kiểm tra cột "Rẽ" của từng tường.`);
      else {
        // chỉ rõ lệch theo cặp tường nào: chiếu khe hở lên hướng từng tường
        const goi = W.filter(w => Math.abs(cham([khep.dx, khep.dy], w.d)) > 0.5).map(w => { const v = cham([khep.dx, khep.dy], w.d); return `${w.ten} ${v > 0 ? 'thiếu' : 'thừa'} ${g(Math.abs(v))}`; });
        luu_y.push(`Phòng chưa khép kín: điểm cuối cách điểm đầu ${g(ho)} mm${goi.length ? ` (để khép: tường ${goi.slice(0, 4).join(', hoặc tường ')})` : ''}. Đo lại, hoặc để trống chiều dài một tường để tự tính.`);
      }
    }
    let dt = 0, cv = 0; const hop = { x0: 0, x1: 0, y0: 0, y1: 0 };
    W.forEach(w => { dt += w.p0[0] * w.p1[1] - w.p1[0] * w.p0[1]; cv += w.dai; for (const q of [w.p0, w.p1]) { hop.x0 = Math.min(hop.x0, q[0]); hop.x1 = Math.max(hop.x1, q[0]); hop.y0 = Math.min(hop.y0, q[1]); hop.y1 = Math.max(hop.y1, q[1]); } });
    const H = { p, tuong: W, khep, dien_tich: khep.kin ? rn(Math.abs(dt) / 2, 0) : 0, chu_vi: rn(cv, 1), hop, loi, luu_y, ghi_chu };
    if (!W.length) { loi.push('Chưa có tường nào.'); return H; }
    if (!(p.cao > 0)) loi.push('Chưa có chiều cao trần.');

    // vùng chiếm chỗ: [s0, s1] dọc tường, [0, t] vào phòng, [z0, z1] theo cao
    const vung = (w, s0, s1, t) => [cong(cong(w.p0, nhan(w.d, s0)), nhan(w.n, 0)), cong(w.p0, nhan(w.d, s1)), cong(cong(w.p0, nhan(w.d, s1)), nhan(w.n, t)), cong(cong(w.p0, nhan(w.d, s0)), nhan(w.n, t))];
    const zGiao = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0) > 0.5;
    const trong = (ten, w, cach, rong) => { if (cach < -0.05 || cach + rong > w.dai + 0.05) { loi.push(`${ten} vượt ra ngoài tường ${w.ten} (tường dài ${g(w.dai)}, ${ten.toLowerCase().indexOf('khung') === 0 ? 'khung' : 'nó'} chiếm ${g(cach)} → ${g(cach + rong)}).`); return false; } return true; };
    const mo = p.mo.map((m, j) => { const w = W[m.tuong]; return Object.assign({ j, w, ten: `${LOAI_MO[m.loai]} ${j + 1}`, poly: vung(w, m.cach, m.cach + m.rong, 60), z0: m.be, z1: m.be + m.cao }, m); });
    const can = p.can.map((c, j) => { const w = W[c.tuong]; return Object.assign({ j, w, ten: `${LOAI_CAN[c.loai]} ${j + 1}`, poly: vung(w, c.cach, c.cach + c.rong, c.nho) }, c); });
    const kh = p.khung.map((q, j) => { const w = W[q.tuong]; return Object.assign({ j, w, poly: vung(w, q.cach, q.cach + q.rong, q.sau), z0: q.z, z1: q.z + q.cao }, q); });
    for (const m of mo) {
      if (!(m.rong > 0) || !(m.cao > 0)) loi.push(`${m.ten} (tường ${m.w.ten}) chưa có rộng / cao.`);
      trong(m.ten, m.w, m.cach, m.rong);
      if (m.z1 > m.w.cao + 0.05) loi.push(`${m.ten} (tường ${m.w.ten}) cao tới +${g(m.z1)}, vượt trần ${g(m.w.cao)}.`);
    }
    for (let i = 0; i < mo.length; i++) for (let j = i + 1; j < mo.length; j++) if (mo[i].tuong === mo[j].tuong && giao(mo[i].poly, mo[j].poly) && zGiao(mo[i].z0, mo[i].z1, mo[j].z0, mo[j].z1)) luu_y.push(`${mo[i].ten} và ${mo[j].ten} trên tường ${mo[i].w.ten} chồng lên nhau.`);
    for (const c of can) {
      if (!(c.rong > 0) || !(c.nho > 0)) loi.push(`${c.ten} (tường ${c.w.ten}) chưa có rộng / độ nhô.`);
      trong(c.ten, c.w, c.cach, c.rong);
      if (c.z1 <= c.z0) loi.push(`${c.ten} (tường ${c.w.ten}): cao độ trên phải lớn hơn cao độ dưới.`);
    }
    for (const q of kh) {
      const ten = `Khung ${q.ten}`;
      if (!(q.rong > 0) || !(q.cao > 0) || !(q.sau > 0)) { loi.push(`${ten} chưa đủ rộng / cao / sâu.`); continue; }
      trong(ten, q.w, q.cach, q.rong);
      if (q.z1 > q.w.cao + 0.05) loi.push(`${ten} cao tới +${g(q.z1)}, vượt trần ${g(q.w.cao)} của tường ${q.w.ten}.`);
      for (const m of mo) if (giao(q.poly, m.poly) && zGiao(q.z0, q.z1, m.z0, m.z1)) luu_y.push(m.tuong === q.tuong ? `${ten} che ${m.ten.toLowerCase()} trên tường ${m.w.ten}.` : `${ten} (sâu ${g(q.sau)}) chắn ${m.ten.toLowerCase()} ở tường ${m.w.ten} sát góc.`);
      for (const c of can) if (giao(q.poly, c.poly) && zGiao(q.z0, q.z1, c.z0, c.z1)) {
        const vc = viTriCot(q, c);
        if (vc && vc.vi_tri !== 'giua') { ghi_chu.push(`${ten}: ${c.ten.toLowerCase()} trùm đầu ${vc.vi_tri === 'trai' ? 'trái' : 'phải'} khung (${g(vc.rong)} × sâu ${g(vc.sau)}) — tủ vẽ vào khung này sẽ được KHẤU CỘT.`); continue; }
        if (vc && vc.sat_tuong) { ghi_chu.push(`${ten}: ${c.ten.toLowerCase()} nằm giữa khung (cách đầu trái ${g(vc.cach)}, ${g(vc.rong)} × sâu ${g(vc.sau)}) — tủ vẽ vào khung này sẽ được KHẤU CỘT GIỮA (vách đặt theo hai mép cột).`); continue; }
        const goi = c.loai === 'dam' && c.z0 > q.z0 + 300 ? ` Hạ khung xuống còn cao ${g(c.z0 - q.z0)} hoặc làm tủ né dầm.` : '';
        luu_y.push(`${ten} vướng ${c.ten.toLowerCase()} ở tường ${c.w.ten} (${g(c.rong)} × nhô ${g(c.nho)}, +${g(c.z0)} → +${g(c.z1)}).${goi}`);
      }
    }
    for (let i = 0; i < kh.length; i++) for (let j = i + 1; j < kh.length; j++) if (kh[i].rong > 0 && kh[j].rong > 0 && giao(kh[i].poly, kh[j].poly) && zGiao(kh[i].z0, kh[i].z1, kh[j].z0, kh[j].z1))
      loi.push(kh[i].tuong === kh[j].tuong ? `Khung ${kh[i].ten} và khung ${kh[j].ten} trên tường ${kh[i].w.ten} chồng lên nhau.` : `Khung ${kh[i].ten} (tường ${kh[i].w.ten}) và khung ${kh[j].ten} (tường ${kh[j].w.ten}) đâm vào nhau ở góc phòng — lùi một khung ra khỏi góc đúng bằng chiều sâu khung kia.`);
    H.mo = mo; H.can = can; H.khung = kh;
    return H;
  }

  /**
   * Cột / hộp kỹ thuật `c` nằm thế nào so với khung `q` (cả hai là phần tử của H.khung / H.can): tính trong hệ toạ độ của tường khung
   * (s dọc tường từ đầu trái, t vào phòng). Trả về null nếu không chạm khung; không thì { vi_tri: 'trai' | 'phai' | 'giua', rong, sau, sat_tuong }:
   * 'trai' / 'phai' = cột trùm đầu trái / phải của khung → tủ KHẤU CỘT được (rong = cột lấn vào khung theo chiều ngang, sau = lấn theo chiều sâu).
   */
  function viTriCot(q, c) {
    if (!q || !c || c.loai === 'dam' || !q.w || !c.poly) return null;
    if (!(c.z1 > q.z0 + 0.5 && c.z0 < q.z1 - 0.5)) return null;
    const w = q.w, ss = c.poly.map(pt => cham([pt[0] - w.p0[0], pt[1] - w.p0[1]], w.d)), ts = c.poly.map(pt => cham([pt[0] - w.p0[0], pt[1] - w.p0[1]], w.n));
    const s0 = Math.min(...ss), s1 = Math.max(...ss), t0 = Math.min(...ts), t1 = Math.max(...ts);
    const a = Math.max(s0, q.cach), b = Math.min(s1, q.cach + q.rong), sau = Math.min(t1, q.sau) - Math.max(t0, 0);
    if (b - a < 0.5 || sau < 0.5) return null;
    const sat = t0 <= 1;
    const vi_tri = !sat ? 'giua' : s0 <= q.cach + 1 ? 'trai' : s1 >= q.cach + q.rong - 1 ? 'phai' : 'giua';
    return { vi_tri, rong: rn(b - a, 1), sau: rn(Math.min(t1, q.sau), 1), sat_tuong: sat, cach: rn(a - q.cach, 1) };      // cach = từ đầu trái khung tới mặt trái cột
  }
  /** Khấu cột cho tủ đặt vào khung j: { trai: {rong, sau}, phai: {rong, sau}, giua_cot: [{cach, rong, sau}] (cột sát tường nằm giữa khung), giua: [tên cột không khấu được — cột không sát tường] }. */
  function khauChoKhung(H, j) {
    const q = H && H.khung && H.khung[j], out = { trai: { rong: 0, sau: 0 }, phai: { rong: 0, sau: 0 }, giua_cot: [], giua: [] };
    if (!q) return out;
    for (const c of H.can || []) {
      const v = viTriCot(q, c); if (!v) continue;
      if (v.vi_tri === 'giua') { if (v.sat_tuong) out.giua_cot.push({ cach: v.cach, rong: v.rong, sau: v.sau }); else out.giua.push(c.ten); continue; }
      out[v.vi_tri].rong = Math.max(out[v.vi_tri].rong, v.rong); out[v.vi_tri].sau = Math.max(out[v.vi_tri].sau, v.sau);
    }
    return out;
  }

  /** Vị trí đặt tủ của một khung: góc trái – trước – dưới (mặt cánh) trong toạ độ phòng, và góc xoay quanh trục đứng (độ, ngược chiều kim đồng hồ). */
  function datKhung(H, j) {
    const q = H.khung && H.khung[j]; if (!q) return null;
    const P = cong(cong(q.w.p0, nhan(q.w.d, q.cach)), nhan(q.w.n, q.sau)), o = H.p.goc || [0, 0, 0];
    let a = q.w.a % 360; if (a > 180) a -= 360; if (a <= -180) a += 360;
    return { goc: [rn(P[0] + o[0], 2), rn(P[1] + o[1], 2), rn(q.z + o[2], 2)], xoay: sach(a), tuong: q.w.ten };
  }

  /**
   * Thông số tủ vừa khít một khung. Core = MNCFCore, specNen = thông số đang dùng (giữ Chuẩn xưởng), q = khung {rong, cao, sau, mau, ten}.
   * @returns {{spec, mau:string[], ghi_chu:string[]}}
   */
  function tuChoKhung(Core, specNen, q, tenPhong, H, j) {
    const ghi = [], dsMau = [];
    let s = Core.normalize(specNen);
    const coMau = q.mau && Core.MAU_TU.find(m => m.ma === q.mau);
    if (coMau) { s = Core.apMau(s, q.mau); dsMau.push(q.mau); }
    else if (q.giu_ruot) dsMau.push('ruột đang mở');      // bản 1.16 (tủ theo hình): giữ cách chia khoang đang có trong bảng
    else {
      // tự chọn theo bề rộng: mỗi cánh ~500; ghép các mẫu 2–6 cánh cho đủ số cánh
      const theo = { 2: 'TA2-1000', 3: 'TA3-1500', 4: 'TA4-2000', 5: 'TA5-2500', 6: 'TA6-3000' };
      let n = Math.max(2, Math.round(q.rong / 500)); const khoang = [];
      if (q.rong < 600) { n = 0; khoang.push(Core.MAU_TU.find(x => x.ma === 'TA3-1500').khoang()[1]); dsMau.push('1 cánh, đợt đều'); }      // khung hẹp: 1 cánh, không ngăn kéo
      while (n > 0) { let c = n > 6 ? (n - 6 === 1 ? 5 : 6) : n; if (c === 1) c = 2; const m = Core.MAU_TU.find(x => x.ma === theo[c]); khoang.push(...m.khoang()); dsMau.push(m.ma); n -= c; }
      s = Core.normalize(Object.assign(clone(s), { khoang }));
      ghi.push(`Tự chọn ruột tủ theo bề rộng: ${dsMau.join(' + ')}.`);
    }
    const khoVan = (s.van && s.van.kho_dai) || 2440;
    s.rong = q.rong; s.cao = q.cao;
    // cao hơn khổ ván thì chia thân dưới + thân kịch trần; thân trên không thấp hơn 400
    s.than = Object.assign({}, s.than, { cao_duoi: q.cao > khoVan ? Math.min((coMau && coMau.cao_duoi) || (s.than && s.than.cao_duoi) || 2200, q.cao - 400) : 0 });
    // đợt của mẫu cao hơn thân tủ thì bỏ (khung thấp); nội dung ô mất đợt đỡ thì bỏ theo
    const tranThan = (s.than.cao_duoi || q.cao) - 250;
    let bo = 0;
    s.khoang = s.khoang.map(k => {
      const dot = (Array.isArray(k.dot) ? k.dot : []).filter(z => z < tranThan), o = (k.o || []).filter(c => c.tu === 0 || dot.some(z => Math.abs(z - c.tu) < 0.6));
      bo += (Array.isArray(k.dot) ? k.dot.length : 0) - dot.length;
      return Object.assign({}, k, { rong: 'auto', dot, o });
    });
    if (bo) ghi.push(`Khung thấp: đã bỏ ${bo} đợt của mẫu nằm quá cao.`);
    s.ten = q.ten || s.ten; s.ma = String(q.ten || s.ma || 'TA').replace(/\s+/g, '').slice(0, 16); if (tenPhong) s.phong = tenPhong;
    s = Core.normalize(s);
    // sâu khung = sâu phủ bì kể cả cánh → trừ phần cánh nhô ra trước thùng
    const bb = Core.bbox(Core.build(s).parts);
    if (bb) { const sauPB = bb.y1 - bb.y0; s.sau_thung = rn(s.sau_thung + (q.sau - sauPB), 1); }
    // khấu cột (bản 1.13): cột / hộp kỹ thuật trùm đầu khung → tủ khoét theo cột. Khung mới thì luôn đặt lại (không giữ khấu của tủ trước).
    s.khau = { trai: { rong: 0, sau: 0 }, phai: { rong: 0, sau: 0 }, giua: [], ho: (s.khau && s.khau.ho >= 0) ? s.khau.ho : 10 };
    const kh0 = q.khau || (H && j >= 0 ? khauChoKhung(H, j) : null);      // q.khau: khấu đọc từ hình vẽ trên mặt bằng (bản 1.16)
    if (kh0) {
      const kh = { trai: kh0.trai || { rong: 0, sau: 0 }, phai: kh0.phai || { rong: 0, sau: 0 }, giua_cot: (kh0.giua_cot || []).slice(), giua: kh0.giua || [] };
      for (const b of ['trai', 'phai']) if (kh[b].rong > 0 && kh[b].sau > 0) { s.khau[b] = { rong: kh[b].rong, sau: kh[b].sau }; ghi.push(`Khấu cột ${b === 'trai' ? 'trái' : 'phải'}: cột lấn ${g(kh[b].rong)} ngang × ${g(kh[b].sau)} sâu (hở ${g(s.khau.ho)}).`); }
      kh.giua_cot.sort((a, b) => a.cach - b.cach).slice(0, 4).forEach(c => { s.khau.giua.push({ cach: c.cach, rong: c.rong, sau: c.sau }); ghi.push(`Khấu cột giữa: cách đầu trái ${g(c.cach)}, cột ${g(c.rong)} ngang × ${g(c.sau)} sâu (hở ${g(s.khau.ho)}).`); });
      if (kh.giua.length) ghi.push(`${kh.giua.join(', ')} không sát tường — bảng chưa khấu được, phải chia khung né ra.`);
      // mép cột rơi không hợp với cách chia khoang đều → cho vách đầu tiên trùng mép cột (vách đó làm vách khấu)
      s = Core.normalize(s);
      let M = Core.build(s);
      if (M.errors.some(t => /Khấu cột/.test(t))) {
        const s2 = clone(s), t = s2.van.t, n = s2.khoang.length;
        if (n >= 2) {
          if (s2.khau.trai.rong > 0) { const w = rn(s2.khau.trai.rong + s2.khau.ho - s2.phao.trai - t, 1); if (w >= 150) s2.khoang[0].rong = w; }
          if (s2.khau.phai.rong > 0) { const w = rn(s2.khau.phai.rong + s2.khau.ho - s2.phao.phai - t, 1); if (w >= 150) s2.khoang[n - 1].rong = w; }
          const M2 = Core.build(Core.normalize(s2));
          if (!M2.errors.some(t2 => /Khấu cột/.test(t2))) { s = s2; ghi.push('Đã chỉnh bề rộng khoang sát cột cho vách trùng mép cột (vách đó làm vách khấu).'); }
        }
      }
      // cột giữa khung: cho hai vách trùng hai mép cột (khoang trước cột thành khoang nông, tấm cắt thẳng); không đặt được thì để khoét chữ U
      if (s.khau.giua.length && Core.vachTheoCot) {
        const r = Core.vachTheoCot(s);
        if (!r.loi) { s = r.spec; ghi.push(`Cột giữa: ${r.doi.length ? r.doi.join('; ') : 'hai vách đã trùng mép cột'} — khoang trước cột là khoang nông.`); }
        else ghi.push(`Cột giữa: chưa đặt được vách theo mép cột (${r.loi}) — đáy / nóc / đợt sẽ khoét chữ U quanh cột.`);
      }
    }
    return { spec: Core.normalize(s), mau: dsMau, ghi_chu: ghi };
  }

  /**
   * HÌNH VẼ TRÊN MẶT BẰNG → KHUNG ĐẶT TỦ (bản 1.16 — anh Jason 03/10/2026 20:44: "anh vẽ hình lên không gian mặt bằng rồi chọn vẽ tủ").
   * dinh = [[x, y], …]: đỉnh đa giác kín theo toạ độ bản vẽ (mm), các cạnh vuông góc nhau, quay hướng nào cũng được.
   * Hình = phủ bì của tủ nhìn từ trên xuống. Chỗ khuyết so với hình chữ nhật bao là chỗ CỘT, phải chạm mép SAU của tủ (góc → chữ L, giữa → chữ U).
   * opt: { truoc: [x, y]  một điểm nằm về phía TRƯỚC tủ (phía người đứng mở cánh);
   *        tuong: [{ a: [x, y], b: [x, y] }]  các mặt tường trong bản vẽ — cạnh nào áp tường thì không phải mặt trước;
   *        cot: [{ x0, x1, y0, y1 }]  hộp bao các cột của phòng — cột lấn vào hình thì tủ tự khấu, không cần vẽ khuyết }
   * Quy ước tủ: đứng trước tủ nhìn vào, x chạy từ trái sang phải, y từ mặt cánh vào lưng; `goc` = góc trái – trước, `xoay` = góc quay của trục x (độ, ngược chiều kim đồng hồ).
   * @returns {{ ok, loi, can_diem, rong, sau, goc, xoay, khau: {trai, phai, giua_cot, giua}, chu_nhat, sat_tuong: {truoc, sau, trai, phai}, ghi_chu: string[] }}
   *   can_diem = true: hình không tự cho biết phía nào là mặt trước → gọi lại với opt.truoc.
   */
  function hinhThanhKhung(dinh, opt) {
    opt = opt || {};
    const kq = { ok: false, loi: '', can_diem: false, ghi_chu: [] };
    const hong = t => { kq.loi = t; return kq; };
    // 1. dọn đỉnh: bỏ đỉnh trùng, đỉnh thẳng hàng
    let P = (Array.isArray(dinh) ? dinh : []).map(q => [Number(q[0]), Number(q[1])]).filter(q => isFinite(q[0]) && isFinite(q[1]));
    P = P.filter((q, i) => { const r = P[(i + 1) % P.length]; return Math.hypot(q[0] - r[0], q[1] - r[1]) > 0.5; });
    for (let doi = true; doi && P.length > 3;) {
      doi = false;
      for (let i = 0; i < P.length; i++) {
        const a = P[(i + P.length - 1) % P.length], b = P[i], c = P[(i + 1) % P.length], u = [b[0] - a[0], b[1] - a[1]], v = [c[0] - b[0], c[1] - b[1]];
        if (Math.abs(u[0] * v[1] - u[1] * v[0]) <= 0.002 * Math.hypot(u[0], u[1]) * Math.hypot(v[0], v[1]) && cham(u, v) > 0) { P.splice(i, 1); doi = true; break; }
      }
    }
    if (P.length < 4) return hong('Hình phải là hình chữ nhật hoặc đa tuyến KHÉP KÍN có ít nhất 4 đỉnh.');
    // 2. quay cho cạnh dài nhất nằm ngang; mọi cạnh phải ngang hoặc dọc
    let dai = 0, th = 0;
    P.forEach((a, i) => { const b = P[(i + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L > dai) { dai = L; th = Math.atan2(b[1] - a[1], b[0] - a[0]); } });
    const c0 = Math.cos(th), s0 = Math.sin(th);
    const vao = q => [q[0] * c0 + q[1] * s0, -q[0] * s0 + q[1] * c0], ra = q => [q[0] * c0 - q[1] * s0, q[0] * s0 + q[1] * c0];
    const Q = P.map(vao);
    for (let i = 0; i < Q.length; i++) {
      const a = Q[i], b = Q[(i + 1) % Q.length], dx = Math.abs(b[0] - a[0]), dy = Math.abs(b[1] - a[1]), L = Math.hypot(dx, dy);
      if (Math.min(dx, dy) > Math.max(1, 0.004 * L)) return hong('Hình có cạnh xiên — bảng chỉ nhận hình có các cạnh vuông góc nhau (hình chữ nhật, có thể khuyết góc / khuyết giữa ở mép sau).');
    }
    // 3. lưới theo các toạ độ đỉnh (gộp các số lệch nhau dưới 0,5 mm)
    const gop = arr => { const o = []; for (const v of arr.slice().sort((x, y) => x - y)) if (!o.length || v - o[o.length - 1] > 0.5) o.push(v); return o; };
    const xs = gop(Q.map(q => q[0])), ys = gop(Q.map(q => q[1]));
    if (xs.length < 2 || ys.length < 2) return hong('Hình bị dẹt (không có bề rộng hoặc bề sâu).');
    const bat = (v, arr) => arr.reduce((m, x) => (Math.abs(x - v) < Math.abs(m - v) ? x : m), arr[0]);
    const R = Q.map(q => [bat(q[0], xs), bat(q[1], ys)]);
    const trong = (x, y) => { let c = false; for (let i = 0, j = R.length - 1; i < R.length; j = i++) { const a = R[i], b = R[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
    const bx0 = xs[0], bx1 = xs[xs.length - 1], by0 = ys[0], by1 = ys[ys.length - 1];
    // 4. phần khuyết: các ô lưới nằm ngoài đa giác, gom thành cụm liền nhau
    const nx = xs.length - 1, ny = ys.length - 1, ngoai = [];
    for (let i = 0; i < nx; i++) { ngoai.push([]); for (let j = 0; j < ny; j++) ngoai[i].push(!trong((xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2)); }
    const cum = [], da = ngoai.map(c => c.map(() => false));
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      if (!ngoai[i][j] || da[i][j]) continue;
      const o = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, dt: 0 }, st = [[i, j]]; da[i][j] = true;
      while (st.length) {
        const [a, b] = st.pop();
        o.x0 = Math.min(o.x0, xs[a]); o.x1 = Math.max(o.x1, xs[a + 1]); o.y0 = Math.min(o.y0, ys[b]); o.y1 = Math.max(o.y1, ys[b + 1]); o.dt += (xs[a + 1] - xs[a]) * (ys[b + 1] - ys[b]);
        for (const [u, v] of [[a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]]) if (u >= 0 && u < nx && v >= 0 && v < ny && ngoai[u][v] && !da[u][v]) { da[u][v] = true; st.push([u, v]); }
      }
      if (o.x1 - o.x0 < 2 || o.y1 - o.y0 < 2) continue;      // sai số vẽ
      o.cn = Math.abs(o.dt - (o.x1 - o.x0) * (o.y1 - o.y0)) < 1;
      o.cham = { D: Math.abs(o.y0 - by0) < 0.6, T: Math.abs(o.y1 - by1) < 0.6, L: Math.abs(o.x0 - bx0) < 0.6, P: Math.abs(o.x1 - bx1) < 0.6 };
      cum.push(o);
    }
    // cột của phòng (bản vẽ) lấn vào hình mà anh chưa vẽ khuyết → coi như một chỗ khuyết (tủ tự khấu theo mặt bằng)
    let soCot = 0;
    for (const c of opt.cot || []) {
      if (!c) continue;
      const g4 = [[c.x0, c.y0], [c.x1, c.y0], [c.x1, c.y1], [c.x0, c.y1]].map(vao);
      const x0 = Math.max(bx0, Math.min(...g4.map(q => q[0]))), x1 = Math.min(bx1, Math.max(...g4.map(q => q[0]))), y0 = Math.max(by0, Math.min(...g4.map(q => q[1]))), y1 = Math.min(by1, Math.max(...g4.map(q => q[1])));
      if (x1 - x0 < 2 || y1 - y0 < 2) continue;                                                                   // cột không lấn vào hình
      if (cum.some(o => x0 >= o.x0 - 1 && x1 <= o.x1 + 1 && y0 >= o.y0 - 1 && y1 <= o.y1 + 1)) continue;          // đã nằm gọn trong chỗ khuyết vẽ sẵn
      if (!trong((x0 + x1) / 2, (y0 + y1) / 2) && !trong(x0 + 1, y0 + 1) && !trong(x1 - 1, y1 - 1)) continue;     // phần lấn nằm ngoài đa giác
      cum.push({ x0, x1, y0, y1, dt: (x1 - x0) * (y1 - y0), cn: true, cot: true, cham: { D: Math.abs(y0 - by0) < 0.6, T: Math.abs(y1 - by1) < 0.6, L: Math.abs(x0 - bx0) < 0.6, P: Math.abs(x1 - bx1) < 0.6 } });
      soCot++;
    }
    if (cum.some(o => !o.cn)) return hong('Chỗ khuyết của hình không phải hình chữ nhật — bảng chỉ khấu được cột vuông (khuyết góc chữ L hoặc khuyết giữa chữ U).');
    // 5. bốn mép của hình chữ nhật bao: D (y nhỏ), T (y lớn), L (x nhỏ), P (x lớn). Mép TRƯỚC hợp lệ = không chạm chỗ khuyết nào, và mọi chỗ khuyết đều chạm mép đối diện (mép sau).
    const DOI = { D: 'T', T: 'D', L: 'P', P: 'L' }, MEP = ['D', 'T', 'L', 'P'];
    const hopLe = MEP.filter(m => cum.every(o => !o.cham[m] && o.cham[DOI[m]]));
    if (!hopLe.length) return hong(cum.length > 1 ? 'Các chỗ khuyết của hình không cùng nằm về một mép — bảng chỉ khấu cột ở mép SAU của tủ (chia hình thành nhiều tủ).' : 'Chỗ khuyết của hình không chạm mép nào của tủ (cột nằm lọt giữa tủ) — bảng chưa khấu được.');
    const dauMep = m => (m === 'D' ? [[bx0, by0], [bx1, by0]] : m === 'T' ? [[bx0, by1], [bx1, by1]] : m === 'L' ? [[bx0, by0], [bx0, by1]] : [[bx1, by0], [bx1, by1]]);
    const daiMep = m => (m === 'D' || m === 'T' ? bx1 - bx0 : by1 - by0);
    // phần của mỗi mép áp vào tường (0…1)
    const satTuong = {};
    for (const m of MEP) {
      const [a, b] = dauMep(m), L = daiMep(m), ngang = m === 'D' || m === 'T'; let phu = 0;
      for (const w of opt.tuong || []) {
        if (!w || !w.a || !w.b) continue;
        const wa = vao(w.a), wb = vao(w.b);
        if (ngang) { if (Math.abs(wa[1] - a[1]) > 8 || Math.abs(wb[1] - a[1]) > 8) continue; phu = Math.max(phu, Math.min(b[0], Math.max(wa[0], wb[0])) - Math.max(a[0], Math.min(wa[0], wb[0]))); }
        else { if (Math.abs(wa[0] - a[0]) > 8 || Math.abs(wb[0] - a[0]) > 8) continue; phu = Math.max(phu, Math.min(b[1], Math.max(wa[1], wb[1])) - Math.max(a[1], Math.min(wa[1], wb[1]))); }
      }
      satTuong[m] = L > 0 ? Math.max(0, Math.min(1, phu / L)) : 0;
    }
    let truoc = null, cach = '';
    if (Array.isArray(opt.truoc) && opt.truoc.length >= 2) {
      const t = vao(opt.truoc), cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2, hx = (bx1 - bx0) / 2, hy = (by1 - by0) / 2;
      const diem = { D: (cy - t[1]) / hy, T: (t[1] - cy) / hy, L: (cx - t[0]) / hx, P: (t[0] - cx) / hx };
      const m = MEP.slice().sort((p, q) => diem[q] - diem[p])[0];
      if (!hopLe.includes(m)) return hong('Phía anh bấm làm mặt TRƯỚC lại là phía có chỗ khuyết (hoặc chỗ khuyết không nằm ở mép sau so với phía đó) — cột phải nằm ở lưng tủ. Bấm lại điểm phía trước, hoặc vẽ lại hình.');
      truoc = m; cach = 'điểm anh bấm';
    } else {
      let ung = hopLe.filter(m => satTuong[m] < 0.5);                       // mặt trước không áp tường
      if (!ung.length) return hong('Mép nào của hình cũng áp tường — không biết mặt trước tủ ở đâu. Bấm 1 điểm phía trước tủ.');
      const coTuong = ung.filter(m => satTuong[DOI[m]] >= 0.5);             // lưng áp tường
      if (coTuong.length) { ung = coTuong; cach = 'lưng áp tường'; }
      if (ung.length > 1) { const mx = Math.max(...ung.map(daiMep)); const dai2 = ung.filter(m => daiMep(m) > mx - 1); if (dai2.length < ung.length) { ung = dai2; cach = cach || 'chỗ khuyết ở mép sau, mặt trước là cạnh dài'; } }
      if (ung.length > 1) { kq.can_diem = true; return hong('Hình không cho biết phía nào là mặt trước tủ — bấm 1 điểm ở phía TRƯỚC tủ (phía đứng mở cánh).'); }
      truoc = ung[0]; cach = cach || 'chỗ khuyết ở mép sau';
    }
    // 6. hệ toạ độ tủ: b = hướng từ mặt trước vào lưng, ex = trục x của tủ (trái → phải khi đứng trước tủ)
    const b = truoc === 'D' ? [0, 1] : truoc === 'T' ? [0, -1] : truoc === 'L' ? [1, 0] : [-1, 0], ex = [b[1], -b[0]];
    const goc4 = [[bx0, by0], [bx1, by0], [bx1, by1], [bx0, by1]];
    const O = goc4.slice().sort((p, q) => (cham(p, ex) + cham(p, b)) - (cham(q, ex) + cham(q, b)))[0];
    const tu = q => [cham([q[0] - O[0], q[1] - O[1]], ex), cham([q[0] - O[0], q[1] - O[1]], b)];
    const rong = rn(Math.abs(cham([bx1 - bx0, by1 - by0], ex)), 1), sau = rn(Math.abs(cham([bx1 - bx0, by1 - by0], b)), 1);
    const khau = { trai: { rong: 0, sau: 0 }, phai: { rong: 0, sau: 0 }, giua_cot: [], giua: [] };
    for (const o of cum) {
      const p = tu([o.x0, o.y0]), q = tu([o.x1, o.y1]), x0 = Math.min(p[0], q[0]), x1 = Math.max(p[0], q[0]), y0 = Math.min(p[1], q[1]);
      const r = rn(x1 - x0, 1), s2 = rn(sau - y0, 1);
      const lon = (cu, moi2) => ({ rong: Math.max(cu.rong, moi2.rong), sau: Math.max(cu.sau, moi2.sau) });      // chỗ khuyết vẽ sẵn + cột của phòng cùng một góc: lấy phần lớn hơn
      if (x0 < 0.6) khau.trai = lon(khau.trai, { rong: r, sau: s2 });
      else if (x1 > rong - 0.6) khau.phai = lon(khau.phai, { rong: r, sau: s2 });
      else khau.giua_cot.push({ cach: rn(x0, 1), rong: r, sau: s2 });
    }
    khau.giua_cot.sort((p, q) => p.cach - q.cach);
    const G = ra(O); let a = (th + Math.atan2(ex[1], ex[0])) * 180 / Math.PI; a = ((a % 360) + 360) % 360; if (a > 180) a -= 360;
    const mepTrai = truoc === 'D' ? 'L' : truoc === 'T' ? 'P' : truoc === 'L' ? 'T' : 'D', mepPhai = DOI[mepTrai];
    kq.ok = true; kq.rong = rong; kq.sau = sau; kq.goc = [rn(G[0], 2), rn(G[1], 2)]; kq.xoay = sach(rn(a, 3)); kq.khau = khau; kq.chu_nhat = cum.length === 0;
    kq.sat_tuong = { truoc: rn(satTuong[truoc], 2), sau: rn(satTuong[DOI[truoc]], 2), trai: rn(satTuong[mepTrai], 2), phai: rn(satTuong[mepPhai], 2) };
    kq.mat_truoc = cach;
    kq.so_cot = soCot;
    kq.ghi_chu.push(`Hình ${g(rong)} × ${g(sau)}${cum.length ? `, ${cum.length} chỗ khấu cột${soCot ? ` (${soCot} chỗ lấy theo cột của phòng trên bản vẽ)` : ''}` : ''}; mặt trước xác định theo ${cach}.`);
    if (rong < sau) kq.ghi_chu.push(`Tủ này SÂU (${g(sau)}) hơn RỘNG (${g(rong)}) — nếu mặt trước bị nhận sai, bấm "Chọn lại mặt trước".`);
    return kq;
  }

  /** Nét khung dây của phòng (để vẽ vào bản vẽ): mỗi nét = [[x,y,z],[x,y,z]], kèm `lop` = 'tuong' | 'mo' | 'can'. */
  function duongNet(H) {
    const N = [], o = H.p.goc || [0, 0, 0], P3 = (q, z) => [rn(q[0] + o[0], 2), rn(q[1] + o[1], 2), rn(z + o[2], 2)];
    const them = (a, b, lop) => N.push({ lop, a, b });
    for (const w of H.tuong) {
      if (!(w.dai > 0)) continue;
      them(P3(w.p0, 0), P3(w.p1, 0), 'tuong'); them(P3(w.p0, w.cao), P3(w.p1, w.cao), 'tuong'); them(P3(w.p0, 0), P3(w.p0, w.cao), 'tuong');
      if (!H.khep.kin && w.i === H.tuong.length - 1) them(P3(w.p1, 0), P3(w.p1, w.cao), 'tuong');
    }
    const hopNet = (w, s0, s1, t, z0, z1, lop) => {
      const q = [cong(w.p0, nhan(w.d, s0)), cong(w.p0, nhan(w.d, s1))], sau = t > 0 ? q.map(x => cong(x, nhan(w.n, t))) : null;
      const vong = (r) => { them(P3(r[0], z0), P3(r[1], z0), lop); them(P3(r[1], z0), P3(r[1], z1), lop); them(P3(r[1], z1), P3(r[0], z1), lop); them(P3(r[0], z1), P3(r[0], z0), lop); };
      vong(q);
      if (sau) { vong(sau); for (const i of [0, 1]) for (const z of [z0, z1]) them(P3(q[i], z), P3(sau[i], z), lop); }
    };
    for (const m of H.mo || []) hopNet(m.w, m.cach, m.cach + m.rong, 0, m.z0, m.z1, 'mo');
    for (const c of H.can || []) hopNet(c.w, c.cach, c.cach + c.rong, c.nho, c.z0, c.z1, 'can');
    return N;
  }

  function tomTat(H) {
    const p = H.p, L = [];
    L.push(`${H.tuong.length} tường · chu vi ${g(H.chu_vi / 1000)} m${H.khep.kin ? ` · diện tích ${String(rn(H.dien_tich / 1e6, 2)).replace('.', ',')} m²` : ''} · trần ${g(p.cao)}`);
    const tu = H.tuong.find(w => w.tu_tinh); if (tu && tu.dai > 0) L.push(`Tường ${tu.ten} tự tính: ${g(tu.dai)}`);
    if (p.mo.length) L.push(`${p.mo.length} cửa / ô trống` + (p.can.length ? ` · ${p.can.length} dầm, cột` : ''));
    else if (p.can.length) L.push(`${p.can.length} dầm, cột`);
    if (p.khung.length) L.push(`${p.khung.length} khung không gian: ` + p.khung.map(k => `${k.ten} ${g(k.rong)}×${g(k.cao)}×${g(k.sau)}`).join(' · '));
    return L;
  }

  /* ---------------- hình vẽ ---------------- */
  // Hình vẽ luôn là "tờ giấy sáng" (như hình đứng của tủ), kể cả khi giao diện ở chế độ tối → dùng màu cố định
  const M_NEN = '#fbfaf7', M_TUONG = '#1b2420', M_MO = '#5d6861', M_NHAN = '#1c5fb8', M_LOI = '#d9402b', M_CAN = '#8a9099', M_TRANG = '#ffffff';

  /** Mặt bằng. opts: { rong_px, cao_px, chon_tuong, chon_khung } — phần tử có data-tuong / data-khung để giao diện bắt bấm. */
  function matBangSVG(H, opts) {
    opts = Object.assign({ rong_px: 420 }, opts || {});
    const W = H.tuong, hop = H.hop, bx = hop.x1 - hop.x0, by = hop.y1 - hop.y0, lon = Math.max(bx, by, 1000);
    const m = lon * 0.13 + 160, fs = lon / 30, day = Math.max(60, lon / 40), f = v => rn(v, 1);
    const X = q => f(q[0]), Y = q => f(-q[1]);      // lật y: tường A nằm trên, lòng phòng ở dưới
    const vb = [hop.x0 - m, -hop.y1 - m, bx + 2 * m, by + 2 * m];
    const rongPx = rn(opts.cao_px > 0 ? Math.min(opts.rong_px, opts.cao_px * vb[2] / vb[3]) : opts.rong_px, 1);
    const pt = q => `${X(q)},${Y(q)}`, poly = P => P.map(pt).join(' ');
    let o = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(f).join(' ')}" width="${rongPx}" style="max-width:100%;height:auto;font-family:inherit" role="img" aria-label="Mặt bằng ${esc(H.p.ten)}">`;
    o += `<rect x="${f(vb[0])}" y="${f(vb[1])}" width="${f(vb[2])}" height="${f(vb[3])}" fill="${M_NEN}"/>`;
    if (!W.length) return o + '</svg>';
    const dinh = W.map(w => w.p0);
    // tường: nét dày nằm NGOÀI lòng phòng (vẽ nét dày gấp đôi rồi phủ lòng phòng lên)
    if (H.khep.kin) { o += `<polygon points="${poly(dinh)}" fill="none" stroke="${M_TUONG}" stroke-width="${f(day * 2)}" stroke-linejoin="miter"/><polygon points="${poly(dinh)}" fill="${M_NEN}"/>`; }
    else for (const w of W) o += `<line x1="${X(w.p0)}" y1="${Y(w.p0)}" x2="${X(w.p1)}" y2="${Y(w.p1)}" stroke="${M_TUONG}" stroke-width="${f(day)}" stroke-linecap="square"/>`;
    const tren = (w, s, t) => cong(cong(w.p0, nhan(w.d, s)), nhan(w.n, t));
    const xuoi = w => { let q = ((-w.a % 360) + 360) % 360; if (q > 90 && q < 270) q -= 180; return q; };      // góc xoay chữ chạy dọc tường mà vẫn đọc xuôi
    const ngoai = H.khep.kin ? day : day / 2;
    // opts.sua (bản 1.12): số đo trên hình bấm vào để gõ lại — chữ mang data-sua="đường dẫn trong phòng", có khung nét đứt để biết là bấm được
    const sua = !!opts.sua;
    const oSua = (path, chu, q, goc, co, mau) => {
      const rong = chu.length * co * 0.58 + co * 0.9, cao = co * 1.5;
      return `<g transform="rotate(${f(goc)} ${X(q)} ${Y(q)})" data-sua="${path}" style="cursor:text"><rect x="${f(q[0] - rong / 2)}" y="${f(-q[1] - cao / 2)}" width="${f(rong)}" height="${f(cao)}" rx="${f(co * 0.3)}" fill="${M_NEN}" fill-opacity=".85" stroke="${mau}" stroke-opacity=".55" stroke-width="${f(co / 14)}" stroke-dasharray="${f(co * 0.28)} ${f(co * 0.22)}"/><text x="${X(q)}" y="${Y(q)}" font-size="${f(co)}" text-anchor="middle" dominant-baseline="central" fill="${mau}">${chu}</text><title>Bấm để sửa số đo này</title></g>`;
    };
    let lopSua = '';      // vẽ SAU CÙNG để không bị vùng bấm của tường che
    // cửa / ô trống: xoá đoạn tường, vẽ 2 má; cửa sổ thêm nét giữa; cửa đi thêm cánh mở
    for (const mm of H.mo || []) {
      const w = mm.w, a = tren(w, mm.cach, 0), b = tren(w, mm.cach + mm.rong, 0), a2 = tren(w, mm.cach, -ngoai), b2 = tren(w, mm.cach + mm.rong, -ngoai);
      o += `<polygon points="${poly([tren(w, mm.cach, ngoai * 0.5), tren(w, mm.cach + mm.rong, ngoai * 0.5), b2, a2])}" fill="${M_NEN}"/>`;
      o += `<line x1="${X(a)}" y1="${Y(a)}" x2="${X(a2)}" y2="${Y(a2)}" stroke="${M_MO}" stroke-width="${f(fs / 7)}"/><line x1="${X(b)}" y1="${Y(b)}" x2="${X(b2)}" y2="${Y(b2)}" stroke="${M_MO}" stroke-width="${f(fs / 7)}"/>`;
      if (mm.loai === 'cua_so') { const c1 = tren(w, mm.cach, -ngoai / 2), c2 = tren(w, mm.cach + mm.rong, -ngoai / 2); o += `<line x1="${X(c1)}" y1="${Y(c1)}" x2="${X(c2)}" y2="${Y(c2)}" stroke="${M_MO}" stroke-width="${f(fs / 5)}"/><line x1="${X(a)}" y1="${Y(a)}" x2="${X(b)}" y2="${Y(b)}" stroke="${M_MO}" stroke-width="${f(fs / 9)}"/>`; }
      else if (mm.loai === 'cua') { const c = tren(w, mm.cach, mm.rong); o += `<path d="M ${X(a)} ${Y(a)} L ${X(c)} ${Y(c)} A ${f(mm.rong)} ${f(mm.rong)} 0 0 1 ${X(b)} ${Y(b)}" fill="none" stroke="${M_MO}" stroke-width="${f(fs / 9)}" stroke-dasharray="${f(fs * 0.6)} ${f(fs * 0.4)}"/>`; }
      else o += `<line x1="${X(a)}" y1="${Y(a)}" x2="${X(b)}" y2="${Y(b)}" stroke="${M_MO}" stroke-width="${f(fs / 9)}" stroke-dasharray="${f(fs * 0.5)} ${f(fs * 0.5)}"/>`;
      const tm = tren(w, mm.cach + mm.rong / 2, -ngoai - fs * 0.9);
      const tenMo = mm.loai === 'cua' ? 'cửa' : mm.loai === 'cua_so' ? 'cửa sổ' : 'ô';
      if (!sua) o += `<text x="${X(tm)}" y="${Y(tm)}" font-size="${f(fs * 0.78)}" text-anchor="middle" dominant-baseline="middle" fill="${M_MO}" transform="rotate(${f(xuoi(w))} ${X(tm)} ${Y(tm)})">${esc(tenMo)} ${g(mm.rong)}</text>`;
      else {
        // rộng cửa (ngoài tường) và khoảng cách từ đầu trái tường tới má cửa (trong phòng, có nét gióng)
        lopSua += oSua(`mo.${mm.j}.rong`, `${esc(tenMo)} ${g(mm.rong)}`, tm, xuoi(w), fs * 0.78, M_MO);
        const t0 = fs * 1.5, c0 = tren(w, 0, t0), c1 = tren(w, mm.cach, t0), cm = tren(w, mm.cach / 2, t0);
        if (mm.cach > 0.5) o += `<line x1="${X(c0)}" y1="${Y(c0)}" x2="${X(c1)}" y2="${Y(c1)}" stroke="${M_MO}" stroke-width="${f(fs / 12)}"/><line x1="${X(tren(w, mm.cach, t0 - fs * 0.5))}" y1="${Y(tren(w, mm.cach, t0 - fs * 0.5))}" x2="${X(tren(w, mm.cach, t0 + fs * 0.5))}" y2="${Y(tren(w, mm.cach, t0 + fs * 0.5))}" stroke="${M_MO}" stroke-width="${f(fs / 12)}"/>`;
        lopSua += oSua(`mo.${mm.j}.cach`, g(mm.cach), mm.cach > fs * 5 ? cm : tren(w, Math.max(mm.cach, 0) + fs * 1.6, t0 + fs * 1.4), xuoi(w), fs * 0.72, M_MO);
      }
    }
    for (const c of H.can || []) o += `<polygon points="${poly(c.poly)}" fill="${M_CAN}" fill-opacity="${c.loai === 'dam' ? '.28' : '.75'}" stroke="${M_TUONG}" stroke-width="${f(fs / 9)}"${c.loai === 'dam' ? ` stroke-dasharray="${f(fs * 0.5)} ${f(fs * 0.4)}"` : ''}><title>${esc(c.ten)}: ${g(c.rong)} × nhô ${g(c.nho)}, +${g(c.z0)} → +${g(c.z1)}</title></polygon>`;
    (H.khung || []).forEach((q, j) => {
      if (!(q.rong > 0) || !(q.sau > 0)) return;
      const on = opts.chon_khung === j, tam = tren(q.w, q.cach + q.rong / 2, q.sau / 2);
      o += `<polygon data-khung="${j}" points="${poly(q.poly)}" fill="${M_NHAN}" fill-opacity="${on ? '.38' : '.16'}" stroke="${M_NHAN}" stroke-width="${f(fs / (on ? 4 : 7))}" style="cursor:pointer"><title>Khung ${esc(q.ten)}: rộng ${g(q.rong)} × cao ${g(q.cao)} × sâu ${g(q.sau)}</title></polygon>`;
      o += `<text x="${X(tam)}" y="${f(-tam[1] + fs * 0.35)}" font-size="${f(fs)}" font-weight="700" text-anchor="middle" fill="${M_NHAN}" pointer-events="none" paint-order="stroke" stroke="${M_NEN}" stroke-width="${f(fs / 4)}">${esc(q.ten)}</text>`;
    });
    // tên tường (trong lòng phòng) + chiều dài (ngoài tường)
    for (const w of W) {
      if (!(w.dai > 0)) continue;
      // tên tường (chữ trong vòng tròn) đứng NGOÀI tường, ngay cạnh số chiều dài — lòng phòng để trống cho khung
      const on = opts.chon_tuong === w.i, chu = g(w.dai) + (w.tu_tinh ? ' (tự tính)' : ''), lech = chu.length * fs * 0.3 + fs * 1.5;
      const tn = tren(w, w.dai / 2 - lech, -ngoai - fs * 2.5), td = tren(w, w.dai / 2 + fs * 0.6, -ngoai - fs * 2.5);
      if (on) o += `<line x1="${X(w.p0)}" y1="${Y(w.p0)}" x2="${X(w.p1)}" y2="${Y(w.p1)}" stroke="${M_NHAN}" stroke-width="${f(fs / 2.2)}" pointer-events="none"/>`;
      o += `<circle cx="${X(tn)}" cy="${Y(tn)}" r="${f(fs * 0.95)}" fill="${on ? M_NHAN : M_NEN}" stroke="${on ? M_NHAN : M_TUONG}" stroke-width="${f(fs / 9)}" pointer-events="none"/><text x="${X(tn)}" y="${f(-tn[1] + fs * 0.36)}" font-size="${f(fs)}" font-weight="700" text-anchor="middle" fill="${on ? M_NEN : M_TUONG}" pointer-events="none">${esc(w.ten)}</text>`;
      if (!sua) o += `<text x="${X(td)}" y="${Y(td)}" font-size="${f(fs)}" text-anchor="middle" dominant-baseline="middle" fill="${w.tu_tinh ? M_NHAN : M_TUONG}" transform="rotate(${f(xuoi(w))} ${X(td)} ${Y(td)})" pointer-events="none">${chu}</text>`;
      else lopSua += oSua(`tuong.${w.i}.dai`, chu, td, xuoi(w), fs, w.tu_tinh ? M_NHAN : M_TUONG);
      o += `<line data-tuong="${w.i}" x1="${X(w.p0)}" y1="${Y(w.p0)}" x2="${X(w.p1)}" y2="${Y(w.p1)}" stroke="${M_NHAN}" stroke-opacity="0" stroke-width="${f(Math.max(day * 2.4, fs * 2.5))}" style="cursor:pointer"><title>Tường ${esc(w.ten)}: dài ${g(w.dai)}, cao ${g(w.cao)}</title></line>`;
    }
    // cột / hộp / dầm: rộng dọc tường × nhô — bấm sửa từng số
    if (sua) for (const c of H.can || []) {
      if (!(c.rong > 0) || !(c.nho > 0)) continue;
      const w = c.w, co = fs * 0.68;
      lopSua += oSua(`can.${c.j}.rong`, g(c.rong), tren(w, c.cach + c.rong / 2, c.nho + co * 1.1), xuoi(w), co, M_TUONG);
      lopSua += oSua(`can.${c.j}.nho`, g(c.nho), tren(w, c.cach + c.rong + co * 1.9, c.nho / 2), xuoi(w), co, M_TUONG);
    }
    o += lopSua;
    // đầu tường A: mốc bắt đầu, và khe hở khi phòng chưa khép
    o += `<circle cx="${X(W[0].p0)}" cy="${Y(W[0].p0)}" r="${f(fs * 0.3)}" fill="${M_NHAN}" pointer-events="none"/>`;
    if (W.length >= 3 && !H.khep.kin && H.khep.ho >= 1) { const e = W[W.length - 1].p1; o += `<line x1="${X(e)}" y1="${Y(e)}" x2="${X(W[0].p0)}" y2="${Y(W[0].p0)}" stroke="${M_LOI}" stroke-width="${f(fs / 4)}" stroke-dasharray="${f(fs * 0.7)} ${f(fs * 0.5)}"/><circle cx="${X(e)}" cy="${Y(e)}" r="${f(fs * 0.4)}" fill="${M_LOI}"/><text x="${f((e[0] + W[0].p0[0]) / 2)}" y="${f(-(e[1] + W[0].p0[1]) / 2 - fs * 0.6)}" font-size="${f(fs)}" text-anchor="middle" fill="${M_LOI}" font-weight="700">hở ${g(H.khep.ho)}</text>`; }
    return o + '</svg>';
  }

  /** Mặt đứng một tường (đứng trong phòng nhìn vào). opts: { rong_px, cao_px, chon_khung } */
  function matDungSVG(H, i, opts) {
    opts = Object.assign({ rong_px: 420 }, opts || {});
    const w = H.tuong[i];
    if (!w || !(w.dai > 0)) return '';
    const L = w.dai, C = w.cao || H.p.cao || 2700, lon = Math.max(L, C), m = lon * 0.1 + 120, fs = lon / 34, f = v => rn(v, 1), Y = z => f(C - z);
    const vb = [-m, -m * 0.8, L + 2 * m, C + m * 1.9];
    const rongPx = rn(opts.cao_px > 0 ? Math.min(opts.rong_px, opts.cao_px * vb[2] / vb[3]) : opts.rong_px, 1);
    let o = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(f).join(' ')}" width="${rongPx}" style="max-width:100%;height:auto;font-family:inherit" role="img" aria-label="Mặt đứng tường ${esc(w.ten)}">`;
    o += `<rect x="${f(vb[0])}" y="${f(vb[1])}" width="${f(vb[2])}" height="${f(vb[3])}" fill="${M_NEN}"/>`;
    o += `<rect x="0" y="0" width="${f(L)}" height="${f(C)}" fill="${M_TRANG}" stroke="${M_TUONG}" stroke-width="${f(fs / 5)}"/>`;
    o += `<line x1="${f(-m * 0.6)}" y1="${f(C)}" x2="${f(L + m * 0.6)}" y2="${f(C)}" stroke="${M_TUONG}" stroke-width="${f(fs / 3)}"/>`;
    const R = (s0, z0, rong, cao, extra) => `<rect x="${f(s0)}" y="${Y(z0 + cao)}" width="${f(rong)}" height="${f(cao)}" ${extra}/>`;
    for (const mm of (H.mo || []).filter(x => x.tuong === i)) {
      o += R(mm.cach, mm.be, mm.rong, mm.cao, `fill="${M_NEN}" stroke="${M_MO}" stroke-width="${f(fs / 7)}"`);
      if (mm.loai === 'cua_so') o += `<line x1="${f(mm.cach + mm.rong / 2)}" y1="${Y(mm.be + mm.cao)}" x2="${f(mm.cach + mm.rong / 2)}" y2="${Y(mm.be)}" stroke="${M_MO}" stroke-width="${f(fs / 10)}"/>`;
      o += `<text x="${f(mm.cach + mm.rong / 2)}" y="${f(C - mm.be - mm.cao / 2)}" font-size="${f(fs * 0.85)}" text-anchor="middle" fill="${M_MO}"><tspan x="${f(mm.cach + mm.rong / 2)}">${esc(LOAI_MO[mm.loai])}</tspan><tspan x="${f(mm.cach + mm.rong / 2)}" dy="${f(fs * 1.1)}">${g(mm.rong)} × ${g(mm.cao)}${mm.be > 0 ? ` · bệ ${g(mm.be)}` : ''}</tspan></text>`;
    }
    for (const c of (H.can || []).filter(x => x.tuong === i)) {
      o += R(c.cach, c.z0, c.rong, c.z1 - c.z0, `fill="${M_CAN}" fill-opacity=".55" stroke="${M_TUONG}" stroke-width="${f(fs / 9)}"`);
      const ngang = c.rong > (c.z1 - c.z0), cx = c.cach + c.rong / 2, cy = C - (c.z0 + c.z1) / 2;
      o += `<text x="${f(cx)}" y="${f(cy + fs * 0.3)}" font-size="${f(fs * 0.8)}" text-anchor="middle" fill="${M_TUONG}"${ngang ? '' : ` transform="rotate(-90 ${f(cx)} ${f(cy)})"`}>${esc(LOAI_CAN[c.loai])} nhô ${g(c.nho)}</text>`;
    }
    (H.khung || []).forEach((q, j) => {
      if (q.tuong !== i || !(q.rong > 0) || !(q.cao > 0)) return;
      const on = opts.chon_khung === j;
      o += R(q.cach, q.z, q.rong, q.cao, `data-khung="${j}" fill="${M_NHAN}" fill-opacity="${on ? '.3' : '.13'}" stroke="${M_NHAN}" stroke-width="${f(fs / (on ? 4 : 7))}" style="cursor:pointer"`);
      o += `<text x="${f(q.cach + q.rong / 2)}" y="${f(C - q.z - q.cao / 2)}" font-size="${f(fs * 1.05)}" text-anchor="middle" fill="${M_NHAN}" font-weight="700" pointer-events="none"><tspan x="${f(q.cach + q.rong / 2)}">${esc(q.ten)}</tspan><tspan x="${f(q.cach + q.rong / 2)}" dy="${f(fs * 1.25)}" font-weight="400">${g(q.rong)} × ${g(q.cao)} · sâu ${g(q.sau)}</tspan></text>`;
      if (q.cach > 0.5) o += `<text x="${f(q.cach / 2)}" y="${f(C - q.z - fs * 0.5)}" font-size="${f(fs * 0.8)}" text-anchor="middle" fill="${M_NHAN}">${g(q.cach)}</text>`;
      const con = L - q.cach - q.rong; if (con > 0.5) o += `<text x="${f(q.cach + q.rong + con / 2)}" y="${f(C - q.z - fs * 0.5)}" font-size="${f(fs * 0.8)}" text-anchor="middle" fill="${M_NHAN}">${g(con)}</text>`;
    });
    const sw = f(fs / 9), tick = fs * 0.45;
    o += `<line x1="0" y1="${f(C + m * 0.45)}" x2="${f(L)}" y2="${f(C + m * 0.45)}" stroke="${M_TUONG}" stroke-width="${sw}"/><line x1="0" y1="${f(C + m * 0.45 - tick)}" x2="0" y2="${f(C + m * 0.45 + tick)}" stroke="${M_TUONG}" stroke-width="${sw}"/><line x1="${f(L)}" y1="${f(C + m * 0.45 - tick)}" x2="${f(L)}" y2="${f(C + m * 0.45 + tick)}" stroke="${M_TUONG}" stroke-width="${sw}"/><text x="${f(L / 2)}" y="${f(C + m * 0.45 + fs * 1.3)}" font-size="${f(fs)}" text-anchor="middle" fill="${M_TUONG}"${opts.sua ? ` data-sua="tuong.${i}.dai" style="cursor:text" text-decoration="underline"` : ''}>${g(L)}${opts.sua ? '<title>Bấm để sửa chiều dài tường</title>' : ''}</text>`;
    const xr = L + m * 0.45;
    o += `<line x1="${f(xr)}" y1="0" x2="${f(xr)}" y2="${f(C)}" stroke="${M_TUONG}" stroke-width="${sw}"/><line x1="${f(xr - tick)}" y1="0" x2="${f(xr + tick)}" y2="0" stroke="${M_TUONG}" stroke-width="${sw}"/><line x1="${f(xr - tick)}" y1="${f(C)}" x2="${f(xr + tick)}" y2="${f(C)}" stroke="${M_TUONG}" stroke-width="${sw}"/><text x="${f(xr + fs * 1.2)}" y="${f(C / 2)}" font-size="${f(fs)}" text-anchor="middle" fill="${M_TUONG}" transform="rotate(-90 ${f(xr + fs * 1.2)} ${f(C / 2)})"${opts.sua ? ` data-sua="${H.p.tuong[i] && H.p.tuong[i].cao > 0 ? `tuong.${i}.cao` : 'cao'}" style="cursor:text" text-decoration="underline"` : ''}>${g(C)}${opts.sua ? '<title>Bấm để sửa chiều cao</title>' : ''}</text>`;
    const truoc = H.tuong[(i - 1 + H.tuong.length) % H.tuong.length], sau = H.tuong[(i + 1) % H.tuong.length];
    o += `<text x="0" y="${f(-m * 0.3)}" font-size="${f(fs * 1.15)}" font-weight="700" fill="${M_TUONG}">Tường ${esc(w.ten)}</text>`;
    if (H.tuong.length > 1) o += `<text x="${f(-m * 0.15)}" y="${f(C + m * 0.98)}" font-size="${f(fs * 0.8)}" fill="${M_MO}">◂ tường ${esc(truoc.ten)}</text><text x="${f(L + m * 0.15)}" y="${f(C + m * 0.98)}" font-size="${f(fs * 0.8)}" text-anchor="end" fill="${M_MO}">tường ${esc(sau.ten)} ▸</text>`;
    return o + '</svg>';
  }

  /** Đọc "mã phòng" (JSON, có thể lẫn chữ quanh) → phòng đã chuẩn hoá, hoặc null. */
  function docMa(text) {
    if (text && typeof text === 'object') return chuanHoa(text);
    const t = String(text || ''), a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    try { const o = JSON.parse(t.slice(a, b + 1)); return o && Array.isArray(o.tuong) ? chuanHoa(o) : null; } catch (e) { return null; }
  }

  return { BAN, LOAI_MO, LOAI_CAN, macDinh, chuanHoa, hinhHoc, datKhung, tuChoKhung, hinhThanhKhung, viTriCot, khauChoKhung, duongNet, tomTat, matBangSVG, matDungSVG, docMa, giao, tenTuong };
});
