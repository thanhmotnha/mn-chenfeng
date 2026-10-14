'use strict';
// Bản 1.33 (tủ bếp): tủ áo / táp / giường / vách phải ra GIỐNG HỆT bản 1.32 — từng byte của thông số, tấm, bảng kê, dữ liệu nhập Chenfeng, kế hoạch lệnh gốc, hình.
// Tệp mau-cu-1.32.json là dấu băm của các thứ đó, dựng bằng lõi ở commit e182fd7 (1.32.0) qua chính hàm dưới đây. Đổi hàm này thì phải dựng lại tệp từ lõi 1.32
// (git show e182fd7:src/mncf-core.js) — không được dựng lại bằng lõi đang sửa.
const crypto = require('crypto');
const bam = v => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

/** Các tủ đem so: tủ mặc định, mọi mẫu thư viện của 1.32, vài biến thể đi qua các nhánh build hay đụng tới (phủ hồi, khấu cột, khung mặt cũ, hậu soi rãnh). */
function dsMau(C) {
  const D = C.DEFAULT_SPEC, ds = [['mac_dinh', C.normalize(D)]];
  for (const m of C.MAU_TU) ds.push([m.ma, C.apMau(D, m.ma)]);
  // (1.34.1) táp: bộ mẫu 1.32 nay là MAU_TAP_CU (mã cũ vẫn dựng được); lõi 1.32 chưa có khoá đó → MAU_TAP — cùng danh sách
  for (const nhom of [C.MAU_TAP_CU || C.MAU_TAP, C.MAU_GIUONG, C.MAU_VACH]) for (const m of nhom) ds.push([m.ma, C.apMau(D, m.ma)]);
  const bien = (ma, f) => { const s = JSON.parse(JSON.stringify(C.apMau(D, ma))); f(s); return s; };
  ds.push(['TA4-2000+phu_hoi', bien('TA4-2000', s => { s.thung.noc_day = 'phu_hoi'; })]);
  ds.push(['TA3-1500+khau', bien('TA3-1500', s => { s.khau = { trai: { rong: 300, sau: 200 }, phai: { rong: 0, sau: 0 }, giua: [{ cach: 900, rong: 200, sau: 150 }], ho: 15 }; })]);
  ds.push(['TA2-1000+khung0', bien('TA2-1000', s => { s.ngan_keo.khung_mat = 0; })]);
  ds.push(['TA2-1000+mong', bien('TA2-1000', s => { s.hau = { kieu: 'mong' }; s.canh.chen_ban_le = true; })]);
  ds.push(['TAP1H-500+trum', bien('TAP1H-500', s => { s.khoang[0].canh = 0; })]);
  return ds;
}

/** Dấu băm từng phần của một tủ (bỏ M.version — số phiên bản đổi theo bản phát hành). */
function banGhi(C, spec) {
  const M = C.build(spec), bo = o => { const c = Object.assign({}, o); delete c.version; return c; };
  const kh = C.keHoachGoc(spec), hs = C.heSo(spec);
  return {
    spec: bam(C.normalize(spec)),
    M: bam(bo(M)),
    cut: bam(C.cutList(M)),
    csv: bam(C.cutListCSV(M)),
    cf: bam(C.toChenfeng(M, { id: 'X1' })),
    goc: bam({ buoc: kh.buoc, loi: kh.loi, chua: kh.chua, nk: kh.nk, gan: kh.gan, con: (kh.con_lai || []).length }),
    heso: bam({ goc: hs.goc, kich: hs.kich, bien: hs.bien, ly_do: hs.ly_do }),
    phieu: bam(C.phieu(M)),
    tom: bam(C.summary(M)),
    svg: bam(C.elevationSVG(M, { tuong_tac: true })),
    h3d: bam(C.hinh3D(M, { tuong_tac: true })),
    vua: bam(C.vuaKhoVan(spec)),
  };
}

module.exports = { dsMau, banGhi, bam };
