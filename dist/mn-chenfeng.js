/* Một Nhà · Vẽ tủ vào Chenfeng — v1.22.0 — bản gộp (lõi + phòng + dịch ghi chú + điều khiển + giao diện) */
;(function(){
/*!
 * mncf-core.js — Một Nhà · Vẽ tủ vào Chenfeng
 * Tính kết cấu tủ (thùng vách chung, hậu phủ sau lưng thùng, thân dưới + thân kịch trần, phào, chân, cánh, ngăn kéo, suốt treo)
 * → danh sách tấm ván → dữ liệu cho cổng nhập chính thức của Chenfeng WebCAD ("晨丰导入", lệnh CF / thả file .json).
 *
 * Trục: x = bề ngang tủ, y = chiều sâu (mặt trước thùng y = 0, cánh/phào nằm ở y âm), z = chiều cao (sàn z = 0). Đơn vị mm.
 * Chạy được cả trong Node (require) lẫn trong trình duyệt (window.MNCFCore). Không phụ thuộc thư viện nào.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MNCFCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSION = '1.22.0';
  const TOL = 0.011;
  const rn = (v, d = 3) => { const k = Math.pow(10, d); return Math.round((v + Number.EPSILON) * k) / k; };
  const g = v => String(rn(v, 2)).replace('.', ',');
  const roundTo = (v, step) => Math.round(v / step) * step;
  const sum = a => a.reduce((x, y) => x + y, 0);
  const num = (v, dflt) => { if (typeof v === 'string') v = v.trim().replace(',', '.'); const x = Number(v); return (v === '' || v === null || v === undefined || !isFinite(x)) ? dflt : x; };
  const clone = o => JSON.parse(JSON.stringify(o));

  /* ------------------------------------------------------------------ *
   * THÔNG SỐ MẶC ĐỊNH — số "chuẩn xưởng" để một chỗ, xưởng chốt lại.
   * ------------------------------------------------------------------ */
  const DEFAULT_SPEC = {
    ten: 'Tủ áo',              // tên gọi (không gắn kích thước: kích thước đã ghi ở phủ bì)
    ma: 'TA1',                 // mã tủ → tên tủ trong Chenfeng: TA1-D (thân dưới), TA1-T (thân trên)
    phong: '',                 // tên phòng (RoomName)
    rong: 3000,                // phủ bì, kể cả phào 2 bên
    cao: 2800,                 // phủ bì, kể cả phào trên
    sau_thung: 580,            // sâu thùng (chưa kể cánh)
    van: {
      t: 17.5,                 // dày ván thùng
      t_canh: 17.5,            // dày cánh, phào mặt, xà chân trước
      kho_dai: 2440, kho_rong: 1220,   // khổ ván: tấm dài hơn phải chia
      ten_van: '', vat_lieu: '', mau: '',
      dan_canh: '1',           // dày nẹp dán cạnh ghi vào 4 cạnh của mỗi tấm
    },
    hau: {
      // 'phu'  = CHUẨN XƯỞNG (từ bản 1.3): hậu mỏng ốp (phủ) lên mép sau của thùng, chia tấm, bắn đinh từ đằng sau — không khoan.
      //          Thùng lùi lại đúng bằng dày hậu, nên "sâu thùng" vẫn là sâu phủ bì (hồi sâu = sâu thùng − dày hậu).
      // 'day'  = hậu dày lọt lòng từng khoang, khoan cam (mặc định của bản 1.0–1.2) | 'mong' = hậu mỏng soi rãnh
      kieu: 'phu',
      t: 6,                    // dày hậu (bỏ trống thì theo kiểu: phủ 6, soi rãnh 5, dày lọt lòng = dày ván thùng)
      mep: 1,                  // (hậu phủ) mép hậu lùi vào so với mép ngoài của thùng, để hậu không lòi ra khỏi hồi / nóc
      chia: 'khoang',          // (hậu phủ) chia tấm: 'khoang' = mỗi khoang 1 tấm | 'kho_van' = gộp các khoang liền nhau cho tới khi vừa khổ ván (ít tấm nhất). Mối nối luôn nằm trên mép sau của vách.
      lui: 20,                 // (hậu soi rãnh) mặt sau tấm hậu cách mép sau thùng
      ranh_sau: 6,             // (hậu soi rãnh) hậu ăn vào rãnh mỗi phía
      ranh_ho: 0.5,            // (hậu soi rãnh) rãnh rộng hơn dày hậu
      ten_van: '', vat_lieu: '', mau: '',      // tên ván / vật liệu / màu của tấm hậu ghi vào Chenfeng (bỏ trống = như ván thùng)
    },
    phao: { trai: 50, phai: 50, tren: 50, phu_tro: 80, noi: 'moi_vach' },   // 0 = không có phào phía đó; phu_tro = bề rộng thanh phụ trợ sau phào
    chan: { cao: 100 },        // cao chân = cao xà chân trước (phào dưới); 0 = không chân. Anh Jason 02/10/2026: mặc định 100 (hoặc 80), không phải 50
    than: { cao_duoi: 2200 },  // cao thân dưới tính từ sàn; 0 = một thân
    // Tách thùng theo bề ngang (anh Jason 03/10/2026: "khổ ván 2 m thường sẽ tách thùng, thùng bé thì kẹp khung chung"):
    //   thùng nào rộng quá rong_max thì tách thành các thùng riêng, mỗi thùng có 2 hồi của nó (chỗ tách = 2 hồi áp lưng);
    //   các khoang nhỏ liền nhau còn nằm trong rong_max thì vẫn chung một thùng (vách chung). Phào, chân trước là khung chung cho cả dãy. 0 = không tách.
    thung: { rong_max: 2000 },
    // Dò lỗi sản xuất (bản 1.20 — anh Jason 04/10/2026: "vẽ phải chuẩn kết cấu, tự động dò lỗi để anh còn sản xuất được"): ngưỡng CẢNH BÁO, xưởng chốt lại; 0 = không kiểm mục đó.
    //   dot_max       = khoang lọt lòng (nhịp đợt / đáy / nóc / suốt treo) tối đa — chuẩn kết cấu mục 1: ván 17,5 không quá 1000
    //   canh_cao_max  = cánh cao hơn thế này dễ cong vênh (cần thanh chống cong hoặc chia thân)
    //   nk_rong_max   = hộp ngăn kéo rộng hơn thế này thì ray và đáy dễ võng
    //   suot_sau_min  = khoang treo đồ phải sâu lọt lòng ít nhất bằng này (móc áo ngang ≈ 450)
    //   tran          = chiều cao trần chỗ đặt tủ (thẻ Phòng tự điền khi mở khung thành tủ): thân tủ ráp nằm rồi lật đứng lên phải lọt dưới trần
    kiem: { dot_max: 1000, canh_cao_max: 2300, nk_rong_max: 1000, suot_sau_min: 480, tran: 0 },
    // Khấu cột (bản 1.13 — anh Jason 03/10/2026: "nhiều tủ phải khấu cột", "làm khấu theo đúng kết cấu của vn"): cột ở góc SAU của tủ.
    //   rong = cột lấn vào tủ bao nhiêu theo chiều NGANG, đo từ mép ngoài phủ bì bên đó; sau = cột lấn bao nhiêu theo chiều SÂU, đo từ lưng tủ; 0 = không khấu.
    //   ho = khe hở giữa cột và tủ (mỗi phía). Kết cấu: hồi phía cột nông lại; nóc / đáy / đợt khoét góc chữ L; một VÁCH KHẤU đứng dọc mặt bên cột;
    //   hậu chia hai mặt phẳng — hậu khấu (trước mặt cột) + hậu chính. Chỉ làm với hậu phủ sau.
    //   Bản 1.16.1 (anh Jason 03/10/2026 22:54: "phần khấu … phải là ván 17 hết"): HẬU KHẤU là VÁN THÙNG dày như vách khấu (không phải hậu 6 li), khoan liên kết như tấm thùng.
    //   Bản 1.17.1 (anh Jason 03/10/2026 23:58: "khe khấu cột để 1-2cm cho sau xử lý cho dễ"): khe hở mặc định 15 (trước là 10).
    khau: { trai: { rong: 0, sau: 0 }, phai: { rong: 0, sau: 0 }, giua: [], ho: 15 },      // giua: [{ cach, rong, sau }] — cột GIỮA tủ: cách mép ngoài bên trái của tủ, rộng, sâu (bản 1.14)
    canh: { khe: 2, khe_bien: 1, chen_ban_le: false, chen: { d: 35, sau: 12.5, tam_mep: 22.5, cach_dau: 100 } },
    // Mỗi khoang: dot = cao độ MẶT DƯỚI từng đợt (tính từ sàn). Các đợt chia khoang thành các ô; o = nội dung ô:
    //   { tu: cao độ mặt dưới của đợt nằm ngay dưới ô (0 = ô sát đáy), kieu: 'nk_am' | 'nk_trum' | 'suot', so: số ngăn kéo, loai: mã loại ngăn kéo (bỏ trống = loại mặc định) }
    // (định dạng cũ ngan_keo: {so, den} và suot: z vẫn nhận, normalize tự đổi)
    khoang: [
      { rong: 'auto', canh: 2, dot: [1800], o: [{ tu: 0, kieu: 'suot' }] },
      { rong: 'auto', canh: 2, dot: [520, 1800], o: [{ tu: 0, kieu: 'nk_am', so: 2 }, { tu: 520, kieu: 'suot' }] },
      { rong: 'auto', canh: 2, dot: [400, 750, 1100, 1450, 1800], o: [] },
    ],
    // dem: ngăn kéo âm nằm sau cánh mở phải tránh bản lề — ở mỗi bên có bản lề đặt 1 vách đệm, mặt trong vách đệm cách hồi/vách `dem` (khe còn lại dem − dày ván là chỗ cho bản lề); 0 = không đệm
    // Từ bản 1.5 (anh Jason, 02/10/2026: "hở thế này không đúng kết cấu gỗ công nghiệp, ngăn kéo vát phải có xà đỡ"): hộc ngăn kéo âm là một KHUNG kín —
    //   xa_cao  = cao xà ngang (ván đứng) đặt SAU khe trên mỗi mặt ngăn kéo: xà trên sát mặt dưới đợt + xà giữa 2 ngăn; 0 = không làm xà
    //   xa_ho   = mặt trước xà cách lưng mặt ngăn kéo (chỗ luồn tay vào cạnh vát)
    //   nep_khe = 1: có nẹp đứng che khe giữa hồi/vách và vách đệm, ngang mặt ngăn kéo (bắn đinh); 0 = để hở
    ngan_keo: {
      lui: 30, dem: 50, khe_tren: 22.5, khe_giua: 22, khe_duoi: 2, khe_ben: 2, buoc_sau: 50, ho_sau: 5, xa_cao: 60, xa_ho: 2, nep_khe: 1,
      mac_dinh: 'bi_mong',       // loại dùng cho ô không chọn loại
      // Các loại ngăn kéo = các mẫu trong thư mục "抽屉" của kho mẫu Chenfeng (mau_id = mã mẫu trong tài khoản; bảng trong Chenfeng có nút dò lại).
      // ts = tham số riêng của mẫu ('mat' = lấy chiều cao mặt ngăn kéo). Lõi tự tính thêm BH (dày mặt) và SYS/XYS/ZYS/YYS (mặt nhô ra ngoài hộp mẫu: dương = trùm, âm = khe hở).
      // Đã thử cả 11 mẫu trên Chenfeng 2026-09-29: mặt ngăn kéo của mọi mẫu đều nằm ở x: −ZYS … L+YYS, y: −BH … 0, z: −XYS … H+SYS (mẫu chia ô: cao mặt = CMG).
      loai: [
        { ma: 'bi_mong', ten: 'Ray bi 3 tầng · đáy mỏng', mau_id: 20216239, ten_mau: '三节轨薄底抽', ts: { GD: 13, LC: 0, SLK: 30, XLK: 30 } },
        { ma: 'bi_day', ten: 'Ray bi 3 tầng · đáy dày', mau_id: 20216238, ten_mau: '三节轨厚底抽', ts: { GD: 13, LC: 0, SLK: 30, XLK: 30 } },
        { ma: 'am_mong', ten: 'Ray âm đỡ đáy · đáy mỏng', mau_id: 20216242, ten_mau: '托底轨薄底抽', ts: { GDK: 24.5, LC: 0, SLK: 30, XLK: 30 } },
        { ma: 'am_day', ten: 'Ray âm đỡ đáy · đáy dày', mau_id: 20216240, ten_mau: '托底轨厚底抽', ts: { GDK: 24.5, LC: 0, SLK: 30, XLK: 30 } },
        { ma: 'am_mong_ranh', ten: 'Ray âm · đáy mỏng, hông soi rãnh', mau_id: 20216243, ten_mau: '托底轨薄底抽-侧开槽', ts: { GD: 21, LC: 0, SLK: 30, XLK: 30 } },
        { ma: 'am_day_ranh', ten: 'Ray âm · đáy dày, hông soi rãnh', mau_id: 20216241, ten_mau: '托底轨厚底抽-侧开槽', ts: { GDK: 21, LC: 0, SLK: 30, XLK: 30 } },
        { ma: 'chia_o', ten: 'Ngăn kéo chia ô (ray bi)', mau_id: 20216244, ten_mau: '三节轨格抽', ts: { GD: 13, LC: 0, SLK: 2, CMG: 'mat' } },
        { ma: 'ke_quan', ten: 'Khung kéo treo quần (ray bi)', mau_id: 20216245, ten_mau: '三节轨裤抽', ts: { GD: 13, LC: 0, SLK: 10, XLK: 10 } },
        { ma: 'blum16', ten: 'Hộp ray Blum · thành 16', mau_id: 20216247, ten_mau: '百隆骑马抽中帮16MM', ts: { LC: 0, XLK: 30 } },
        { ma: 'blum18', ten: 'Hộp ray Blum · thành 18', mau_id: 20216248, ten_mau: '百隆骑马抽中帮18MM', ts: { LC: 0, XLK: 30 } },
        { ma: 'ban_phim', ten: 'Khay bàn phím (ray bi)', mau_id: 20216246, ten_mau: '三节轨键盘抽', ts: { GD: 13, LC: 0, XLK: 20 } },
      ],
    },
    suot: { mau_id: 20650931, ten_mau: '衣杆', cach_dot: 80 },
    khoan: { thung: 'Cam3Tp', phao: 'Cam12' },     // tên kiểu khoan trong "Khoan hàng lỗ" của tài khoản Chenfeng
    ten_tam: {
      hoi_trai: 'Hồi trái', hoi_phai: 'Hồi phải', vach: 'Vách', day: 'Đáy', noc: 'Nóc', dot: 'Đợt', hau: 'Hậu',
      chan: 'Chân trước', phao_trai: 'Phào trái', phao_phai: 'Phào phải', phao_tren: 'Phào trên', phu_tro: 'Phụ trợ phào',
      canh_trai: 'Cánh trái', canh_phai: 'Cánh phải', dem: 'Vách đệm ngăn kéo', xa: 'Xà ngăn kéo', nep: 'Nẹp che khe ngăn kéo',
      vach_khau: 'Vách khấu cột', hau_khau: 'Hậu khấu cột',
    },
    ve_goc: true,              // (bản 1.15) vẽ bằng LỆNH GỐC của Chenfeng: hồi / vách / nóc đáy / hậu / đợt / cánh là tấm tự động trong cây mẫu gốc, sửa được như tủ vẽ tay; false = cách cũ (nhập tấm rồi gom module L / W / H)
    module_cf: true,           // vẽ xong gom tủ thành module tham số gốc của Chenfeng (sửa Rộng / Sâu / Cao ngay ở ô Thông số của Chenfeng)
    lam_tron: 1,               // làm tròn bề rộng lọt lòng khoang khi tự chia (mm)
  };

  const KHONG_KHOAN = '不排';
  /** Tên ô ghi chú (备注) mà tiện ích gắn vào từng tấm nó vẽ: giá trị = mã của lần vẽ tủ đó → sau này chọn 1 tấm là tìm lại được cả tủ để sửa. */
  const KHOA_TU = 'MNCF';
  const KIEU_HAU = ['phu', 'day', 'mong'];
  const KHOA_NK_CU = ['mau_id', 'ten_mau', 'GD', 'SLK', 'XLK', 'LC'];      // bản 1.0–1.1 khai một mẫu ngăn kéo duy nhất bằng các khoá này
  const TS_LOI_TINH = ['BH', 'SYS', 'XYS', 'ZYS', 'YYS'];                   // tham số do lõi tính, không nhận từ "tham số riêng"

  /** Tham số riêng của một mẫu: nhận {GD: 13} hoặc chuỗi "GD=13; SLK=30" → {GD: 13, SLK: 30}; giá trị 'mat' = chiều cao mặt ngăn kéo. */
  function parseTS(v) {
    const out = {};
    const put = (k, x) => {
      k = String(k).trim(); if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k) || TS_LOI_TINH.indexOf(k) >= 0) return;
      if (typeof x === 'string' && x.trim().toLowerCase() === 'mat') { out[k] = 'mat'; return; }
      const n = num(x, NaN); if (isFinite(n)) out[k] = n;
    };
    // dấu phẩy chỉ là dấu ngăn cách khi theo sau là một tên tham số ("24,5" là số thập phân)
    if (typeof v === 'string') { for (const part of v.split(/[;\n]+|,(?=\s*[A-Za-z_][A-Za-z0-9_]*\s*[=:])/)) { const m = part.split(/[=:]/); if (m.length >= 2) put(m[0], m.slice(1).join('=').trim()); } }
    else if (v && typeof v === 'object') for (const k of Object.keys(v)) put(k, v[k]);
    return out;
  }
  /** Tham số riêng → chuỗi để hiện trong ô nhập. */
  function tsText(ts) { return Object.keys(ts || {}).map(k => k + '=' + (ts[k] === 'mat' ? 'mat' : String(rn(ts[k], 2)))).join('; '); }
  const TEN_KIEU = { nk_am: 'ngăn kéo âm', nk_trum: 'ngăn kéo trùm ngoài', suot: 'suốt treo' };

  /** Các thân theo chiều cao (thân dưới + thân kịch trần khi tủ cao hơn khổ ván). Hàm thuần, dùng chung cho normalize và build. */
  function tinhThan(s) {
    const t = s.van.t, Ztop = s.cao - s.phao.tren, zd = s.than.cao_duoi, chan = s.chan.cao;
    const bodies = [];
    if (zd > 0 && Ztop - zd >= 150) { bodies.push({ code: 'D', z0: 0, z1: zd, chan }); bodies.push({ code: 'T', z0: zd, z1: Ztop, chan: 0 }); }
    else bodies.push({ code: 'D', z0: 0, z1: Ztop, chan });
    for (const b of bodies) { b.tu = bodies.length === 2 ? `${s.ma}-${b.code}` : s.ma; b.zb = b.z0 + b.chan + t; b.zt = b.z1 - t; }
    return bodies;
  }
  const NHOM = { HOI: 'Thùng', VACH: 'Thùng', DAY: 'Thùng', NOC: 'Thùng', DOT: 'Thùng', DEM: 'Thùng', XA: 'Thùng', NEP: 'Thùng', HAU: 'Hậu', CHAN: 'Chân trước', PHAO: 'Phào mặt', PHU: 'Phụ trợ phào', CANH: 'Cánh' };

  function merge(base, over) {
    if (over === undefined || over === null) return clone(base);
    if (Array.isArray(base) || Array.isArray(over) || typeof base !== 'object' || typeof over !== 'object' || base === null) return clone(over);
    const out = {};
    for (const k of new Set([...Object.keys(base), ...Object.keys(over)])) out[k] = k in over ? (k in base ? merge(base[k], over[k]) : clone(over[k])) : clone(base[k]);
    return out;
  }

  /** "400, 750 1100" | [400,750] | "deu:4" → mảng số hoặc {deu:n} */
  function parseDot(v) {
    if (Array.isArray(v)) return v.map(x => num(x, NaN)).filter(x => isFinite(x));
    if (typeof v === 'number') return [v];
    if (typeof v !== 'string') return [];
    const s = v.trim().toLowerCase();
    const m = s.match(/^(?:deu|đều|x)\s*[:=]?\s*(\d+)$/);
    if (m) return { deu: parseInt(m[1], 10) };
    return s.split(/[\s;,]+/).map(x => num(x, NaN)).filter(x => isFinite(x));
  }

  function normalize(specIn) {
    const s = merge(DEFAULT_SPEC, specIn || {});
    if (specIn && Array.isArray(specIn.khoang)) s.khoang = clone(specIn.khoang);
    for (const k of ['rong', 'cao', 'sau_thung']) s[k] = num(s[k], DEFAULT_SPEC[k]);
    for (const k of ['t', 't_canh', 'kho_dai', 'kho_rong']) s.van[k] = num(s.van[k], DEFAULT_SPEC.van[k]);
    s.van.dan_canh = String(s.van.dan_canh === undefined || s.van.dan_canh === null ? '' : s.van.dan_canh);
    s.hau.kieu = KIEU_HAU.indexOf(s.hau.kieu) >= 0 ? s.hau.kieu : DEFAULT_SPEC.hau.kieu;
    {
      // dày hậu: người dùng gõ thì giữ; bỏ trống thì theo kiểu hậu
      const hIn = specIn && specIn.hau && typeof specIn.hau === 'object' ? specIn.hau : {};
      s.hau.t = num(hIn.t, s.hau.kieu === 'day' ? s.van.t : s.hau.kieu === 'mong' ? 5 : DEFAULT_SPEC.hau.t);
    }
    for (const k of ['mep', 'lui', 'ranh_sau', 'ranh_ho']) s.hau[k] = num(s.hau[k], DEFAULT_SPEC.hau[k]);
    s.hau.mep = Math.max(0, s.hau.mep);
    s.hau.chia = s.hau.chia === 'kho_van' ? 'kho_van' : 'khoang';
    for (const k of ['ten_van', 'vat_lieu', 'mau']) s.hau[k] = String(s.hau[k] === undefined || s.hau[k] === null ? '' : s.hau[k]);
    for (const k of ['trai', 'phai', 'tren', 'phu_tro']) s.phao[k] = Math.max(0, num(s.phao[k], 0));
    s.chan.cao = Math.max(0, num(s.chan.cao, 0));
    s.than.cao_duoi = Math.max(0, num(s.than.cao_duoi, 0));
    s.thung = s.thung && typeof s.thung === 'object' ? s.thung : {};
    s.thung.rong_max = Math.max(0, num(s.thung.rong_max, DEFAULT_SPEC.thung.rong_max));
    if (Array.isArray(s.thung.tach)) s.thung.tach = [...new Set(s.thung.tach.map(v => Math.round(num(v, NaN))).filter(v => isFinite(v) && v >= 1))].sort((a, b) => a - b); else delete s.thung.tach;      // tach = chỗ tách đã chốt (vị trí tấm đứng), bỏ trống = tự tính theo rong_max
    s.kiem = s.kiem && typeof s.kiem === 'object' ? s.kiem : {};
    for (const k of Object.keys(DEFAULT_SPEC.kiem)) s.kiem[k] = Math.max(0, num(s.kiem[k], DEFAULT_SPEC.kiem[k]));
    s.khau = s.khau && typeof s.khau === 'object' ? s.khau : {};
    for (const b of ['trai', 'phai']) { const q = s.khau[b] && typeof s.khau[b] === 'object' ? s.khau[b] : {}; s.khau[b] = { rong: Math.max(0, num(q.rong, 0)), sau: Math.max(0, num(q.sau, 0)) }; }
    s.khau.ho = Math.max(0, num(s.khau.ho, DEFAULT_SPEC.khau.ho));
    s.khau.giua = Array.from((Array.isArray(s.khau.giua) ? s.khau.giua : []).slice(0, 4), q => { q = q && typeof q === 'object' ? q : {}; return { cach: Math.max(0, num(q.cach, 0)), rong: Math.max(0, num(q.rong, 0)), sau: Math.max(0, num(q.sau, 0)) }; });
    while (s.khau.giua.length && !(s.khau.giua[s.khau.giua.length - 1].rong > 0 || s.khau.giua[s.khau.giua.length - 1].sau > 0 || s.khau.giua[s.khau.giua.length - 1].cach > 0)) s.khau.giua.pop();
    s.canh.khe = num(s.canh.khe, 2); s.canh.khe_bien = num(s.canh.khe_bien, 1);
    s.canh.chen_ban_le = s.canh.chen_ban_le === true || s.canh.chen_ban_le === 'true';
    for (const k of Object.keys(DEFAULT_SPEC.canh.chen)) s.canh.chen[k] = num(s.canh.chen[k], DEFAULT_SPEC.canh.chen[k]);
    for (const k of ['lui', 'dem', 'khe_tren', 'khe_giua', 'khe_duoi', 'khe_ben', 'buoc_sau', 'ho_sau', 'xa_cao', 'xa_ho']) s.ngan_keo[k] = num(s.ngan_keo[k], DEFAULT_SPEC.ngan_keo[k]);
    s.ngan_keo.xa_cao = Math.max(0, s.ngan_keo.xa_cao); s.ngan_keo.xa_ho = Math.max(0, s.ngan_keo.xa_ho);
    s.ngan_keo.nep_khe = (s.ngan_keo.nep_khe === 0 || s.ngan_keo.nep_khe === '0' || s.ngan_keo.nep_khe === false || s.ngan_keo.nep_khe === 'false') ? 0 : 1;
    {
      // các loại ngăn kéo: mã không trùng, tham số riêng về dạng {tên: số}
      const nk = s.ngan_keo, seen = new Set(), loai = [];
      (Array.isArray(nk.loai) ? nk.loai : []).forEach((x, i) => {
        if (!x || typeof x !== 'object') return;
        let ma = String(x.ma === undefined || x.ma === null ? '' : x.ma).trim().replace(/\s+/g, '_') || 'loai' + (i + 1);
        while (seen.has(ma)) ma += '_';
        seen.add(ma);
        const tenMau = String(x.ten_mau || '').trim();
        loai.push({ ma, ten: String(x.ten || '').trim() || tenMau || ma, mau_id: Math.max(0, Math.round(num(x.mau_id, 0))), ten_mau: tenMau, ts: parseTS(x.ts) });
      });
      nk.loai = loai;
      nk.mac_dinh = String(nk.mac_dinh || '');
      if (!loai.some(x => x.ma === nk.mac_dinh)) nk.mac_dinh = loai.length ? loai[0].ma : '';
      // định dạng cũ: mau_id / ten_mau / GD / SLK / XLK / LC nằm ngay trong ngan_keo → ghi vào loại trùng mã mẫu (loại đó thành mặc định), không trùng thì ghi đè loại mặc định
      const cu = (specIn && specIn.ngan_keo && typeof specIn.ngan_keo === 'object') ? specIn.ngan_keo : {};
      if (KHOA_NK_CU.some(k => k in cu) && loai.length) {
        const id = 'mau_id' in cu ? Math.max(0, Math.round(num(cu.mau_id, 0))) : null;
        let d = id ? loai.find(x => x.mau_id === id) : null;
        if (d) nk.mac_dinh = d.ma;
        else { d = loai.find(x => x.ma === nk.mac_dinh); if (id !== null) d.mau_id = id; if ('ten_mau' in cu) d.ten_mau = String(cu.ten_mau || '').trim(); }
        for (const k of ['GD', 'LC', 'SLK', 'XLK']) if (k in cu && k in d.ts) { const v = num(cu[k], NaN); if (isFinite(v)) d.ts[k] = v; }
      }
      for (const k of KHOA_NK_CU) delete nk[k];
    }
    for (const k of ['mau_id', 'cach_dot']) s.suot[k] = num(s.suot[k], k === 'mau_id' ? 0 : DEFAULT_SPEC.suot[k]);
    if (!(s.ngan_keo.buoc_sau > 0)) s.ngan_keo.buoc_sau = 50;
    for (const k of Object.keys(s.khoan)) s.khoan[k] = String(s.khoan[k] || '').trim() || DEFAULT_SPEC.khoan[k];
    for (const k of Object.keys(DEFAULT_SPEC.ten_tam)) s.ten_tam[k] = String(s.ten_tam[k] || '').trim() || DEFAULT_SPEC.ten_tam[k];
    for (const k of ['ten', 'ten_van', 'vat_lieu', 'mau']) { if (k === 'ten') s.ten = String(s.ten || ''); else s.van[k] = String(s.van[k] || ''); }
    s.lam_tron = num(s.lam_tron, 1) || 1;
    s.module_cf = s.module_cf !== false;
    s.ve_goc = s.ve_goc !== false && s.ve_goc !== 'false';
    s.ma = String(s.ma || 'TU').trim() || 'TU';
    s.phong = String(s.phong || '');
    const lower = tinhThan(s)[0];
    s.khoang = (s.khoang || []).map(k => {
      const o = Object.assign({}, k);
      const r = num(o.rong, NaN);
      o.rong = (isFinite(r) && r > 0) ? r : 'auto';
      o.canh = Math.max(0, Math.min(2, Math.round(num(o.canh, 0))));
      o.ban_le = o.ban_le === 'phai' ? 'phai' : 'trai';
      // đợt: luôn đưa về mảng số tăng dần ("deu:n" → n đợt chia đều lọt lòng thân dưới)
      let dots = parseDot(o.dot);
      if (dots && !Array.isArray(dots)) {
        const m = Math.max(0, Math.min(20, dots.deu | 0)), gap = (lower.zt - lower.zb - m * s.van.t) / (m + 1);
        dots = []; for (let j = 1; j <= m; j++) dots.push(rn(lower.zb + j * gap + (j - 1) * s.van.t, 1));
      }
      dots = dots.filter(z => isFinite(z) && z > 0);
      // nội dung ô
      const noi = [];
      for (const c of (Array.isArray(o.o) ? o.o : [])) {
        if (!c || !TEN_KIEU[c.kieu]) continue;
        const e = { tu: Math.max(0, num(c.tu, 0)), kieu: c.kieu };
        if (c.kieu !== 'suot') {
          e.so = Math.max(1, Math.min(12, Math.round(num(c.so, 1))));
          if (c.loai !== undefined && c.loai !== null && s.ngan_keo.loai.some(x => x.ma === String(c.loai))) e.loai = String(c.loai);      // loại lạ / bỏ trống = loại mặc định
        }
        noi.push(e);
      }
      // định dạng cũ: ngan_keo {so, den} = ngăn kéo âm ở ô sát đáy, có đợt tại `den`; suot = suốt treo dưới đợt z
      if (o.ngan_keo && num(o.ngan_keo.so, 0) > 0) {
        const den = num(o.ngan_keo.den, 0);
        if (den > 0 && !dots.some(z => Math.abs(z - den) < TOL)) dots.push(den);
        noi.push({ tu: 0, kieu: 'nk_am', so: Math.max(1, Math.min(12, Math.round(num(o.ngan_keo.so, 1)))) });
      }
      const sv = o.suot;
      if (sv !== undefined && sv !== null && sv !== '' && sv !== false) {
        const inLower = dots.filter(z => z < lower.zt).sort((a, b) => a - b);
        let tu = null;
        if (sv === 'noc') tu = inLower.length ? inLower[inLower.length - 1] : 0;
        else if (sv === true) tu = inLower.length > 1 ? inLower[inLower.length - 2] : 0;
        else { const z = num(sv, NaN); if (isFinite(z) && z > 0) { if (!dots.some(q => Math.abs(q - z) < TOL)) dots.push(z); const below = dots.filter(q => q < z - TOL).sort((a, b) => a - b); tu = below.length ? below[below.length - 1] : 0; } }
        if (tu !== null) noi.push({ tu, kieu: 'suot' });
      }
      delete o.ngan_keo; delete o.suot;
      o.dot = [...new Set(dots.map(z => rn(z, 1)))].sort((a, b) => a - b);
      o.o = noi;
      return o;
    });
    return s;
  }

  /* ------------------------------------------------------------------ *
   * PHIẾU KIỂM (bản 1.20): mỗi dòng báo của lần dựng mang mã của một MỤC KIỂM.
   * Thứ tự dưới đây là thứ tự hiện trên phiếu. `khi(M)` = mục có áp dụng cho tủ này không (tủ không ngăn kéo thì không nói "ngăn kéo đạt").
   * ------------------------------------------------------------------ */
  const coO = (M, kieu) => ((M.info && M.info.o) || []).some(c => kieu.indexOf(c.kieu) >= 0);
  const MUC_KIEM = [
    { ma: 'kich_thuoc', ten: 'Phủ bì và chia khoang' },
    { ma: 'than', ten: 'Chia thân, tách thùng theo khổ ván' },
    { ma: 'kho_van', ten: 'Từng tấm vừa khổ ván' },
    { ma: 'va_cham', ten: 'Các tấm không đè lên nhau' },
    { ma: 'lien_ket', ten: 'Tấm nào cũng có chỗ tì (không lơ lửng)' },
    { ma: 'nhip', ten: 'Nhịp đợt, đáy, nóc' },
    { ma: 'dot', ten: 'Đợt và nội dung từng ô' },
    { ma: 'canh', ten: 'Cánh', khi: M => M.spec.khoang.some(k => k.canh > 0) },
    { ma: 'ngan_keo', ten: 'Ngăn kéo', khi: M => coO(M, ['nk_am', 'nk_trum']) },
    { ma: 'suot', ten: 'Suốt treo', khi: M => coO(M, ['suot']) },
    { ma: 'hau', ten: 'Hậu' },
    { ma: 'phao_chan', ten: 'Phào, chân, thanh ngang mặt trước' },
    { ma: 'khau', ten: 'Khấu cột', khi: M => { const k = M.spec.khau || {}; return ['trai', 'phai'].some(b => k[b] && k[b].rong > 0 && k[b].sau > 0) || (k.giua || []).some(q => q.rong > 0 && q.sau > 0); } },
    { ma: 'mau', ten: 'Mã mẫu ngăn kéo, suốt treo của Chenfeng', khi: M => coO(M, ['nk_am', 'nk_trum', 'suot']) },
  ];

  /** Ba hàm báo của một lần dựng: ghi chuỗi vào errors / warnings / notes như cũ, đồng thời ghi kèm mã mục kiểm vào M.kq. `muc(ma)` đặt mã cho các dòng báo tiếp theo (dòng nào cần mã khác thì truyền tham số thứ 2). */
  function baoCua(M) {
    let ma0 = 'khac';
    const ghi = (ds, muc) => (m, ma) => { ds.push(m); M.kq.push({ muc, ma: ma || ma0, t: m }); };
    return { err: ghi(M.errors, 'loi'), warn: ghi(M.warnings, 'luu_y'), note: ghi(M.notes, 'ghi'), muc(ma) { ma0 = ma; } };
  }

  /**
   * Phiếu kiểm của một lần dựng: từng mục đạt / lưu ý / lỗi / chưa kiểm / không áp dụng.
   * "chưa kiểm" = lõi dừng sớm vì lỗi phủ bì nên chưa dựng tới đó — không được coi là đạt.
   * @returns {{dat:boolean, xong:boolean, muc:{ma,ten,ket,tin:string[]}[], dem:{dat,luu_y,loi,chua}}}
   */
  function phieu(M) {
    const xong = !!(M.info && M.info.kiem_xong), ds = (M.kq || []);
    const muc = MUC_KIEM.concat(ds.some(k => k.ma === 'khac') ? [{ ma: 'khac', ten: 'Khác' }] : []).map(c => {
      const cua = ds.filter(k => k.ma === c.ma);
      const ket = cua.some(k => k.muc === 'loi') ? 'loi' : cua.some(k => k.muc === 'luu_y') ? 'luu_y' : !xong ? 'chua' : (c.khi && !c.khi(M)) ? 'khong' : 'dat';
      return { ma: c.ma, ten: c.ten, ket, tin: cua.filter(k => k.muc !== 'ghi').map(k => k.t), ghi: cua.filter(k => k.muc === 'ghi').map(k => k.t) };
    });
    const dem = { dat: 0, luu_y: 0, loi: 0, chua: 0 };
    for (const m of muc) if (m.ket in dem) dem[m.ket]++;
    return { dat: M.errors.length === 0 && xong, xong, muc, dem };
  }

  /* ------------------------------------------------------------------ *
   * DỰNG TỦ
   * ------------------------------------------------------------------ */
  function build(specIn) {
    const s = normalize(specIn);
    // kq = mọi dòng báo kèm MÃ MỤC kiểm (xem MUC_KIEM) — để lập phiếu kiểm: mục nào đạt, mục nào lưu ý, mục nào lỗi. errors / warnings / notes vẫn là chuỗi như cũ.
    const M = { version: VERSION, spec: s, parts: [], templates: [], mat_ngan_keo: [], errors: [], warnings: [], notes: [], kq: [], info: {} };
    const bao = baoCua(M), err = bao.err, warn = bao.warn, note = bao.note;

    const W = s.rong, H = s.cao, D = s.sau_thung, t = s.van.t, tc = s.van.t_canh;
    const pL = s.phao.trai, pR = s.phao.phai, pT = s.phao.tren, aux = s.phao.phu_tro, chan = s.chan.cao;
    const phu = s.hau.kieu === 'phu', thin = s.hau.kieu === 'mong', th = s.hau.t;
    const khe = s.canh.khe, kb = s.canh.khe_bien;
    const n = s.khoang.length;
    const NM = s.ten_tam, KT = s.khoan.thung, KP = s.khoan.phao;

    bao.muc('kich_thuoc');
    if (!(W > 0 && H > 0 && D > 0)) { err('Rộng, cao, sâu thùng phải lớn hơn 0.'); return M; }
    if (!(t > 0 && tc > 0 && th > 0)) { err('Độ dày ván phải lớn hơn 0.'); return M; }
    if (n < 1) { err('Tủ phải có ít nhất 1 khoang.'); return M; }

    const X0 = pL, X1 = W - pR, Ztop = H - pT;
    if (X1 - X0 < 2 * t + 50) { err('Bề rộng còn lại sau khi trừ phào quá nhỏ.'); return M; }

    /* ---- chia thân theo chiều cao ---- */
    bao.muc('than');
    const zd = s.than.cao_duoi;
    const bodies = tinhThan(s);
    if (bodies.length === 1 && zd > 0 && zd < Ztop - TOL) warn(`Thân trên chỉ cao ${g(Ztop - zd)} (< 150) nên gộp thành một thân cao ${g(Ztop)}.`);
    const twoBody = bodies.length === 2;
    for (const b of bodies) {
      if (b.z1 - b.z0 > s.van.kho_dai + TOL) err(`Thân ${b.code === 'D' ? 'dưới' : 'trên'} cao ${g(b.z1 - b.z0)} > khổ ván ${g(s.van.kho_dai)}: hồi không cắt được. Giảm "cao thân dưới" hoặc chia thêm thân.`);
      if (b.zt - b.zb < 100) err(`Thân ${b.code === 'D' ? 'dưới' : 'trên'} quá thấp (lọt lòng ${g(b.zt - b.zb)}).`);
    }
    const lower = bodies[0];
    if (chan > 0 && chan < 30) warn(`Chân tủ chỉ cao ${g(chan)}.`, 'phao_chan');
    // Biết trần (bản 1.20): tủ không được cao hơn trần; thân ráp nằm rồi lật đứng lên thì đường chéo mặt hông (cao × sâu) phải lọt dưới trần — thân trên đặt lên sau nên không phải lật.
    const tran = s.kiem.tran;
    if (tran > 0) {
      if (H > tran + TOL) err(`Tủ cao ${g(H)} mà trần chỉ ${g(tran)} — hạ chiều cao tủ.`);
      else {
        const cheo = Math.sqrt(Math.pow(lower.z1 - lower.z0, 2) + D * D);
        if (cheo > tran - TOL) warn(`Thân ${bodies.length === 2 ? 'dưới ' : ''}cao ${g(lower.z1 - lower.z0)}, sâu ${g(D)}: ráp nằm rồi lật đứng lên thì đường chéo ${g(Math.round(cheo))} > trần ${g(tran)} — không lật lên được. Đặt "cao thân dưới" không quá ${g(Math.floor(Math.sqrt(Math.max(0, tran * tran - D * D))))} (chia thân), hoặc ráp đứng tại chỗ.`);
      }
    }
    bao.muc('kich_thuoc');

    /* ---- mặt phẳng cánh: giới hạn ngang ---- */
    const DL = pL > 0 ? pL + khe : kb;
    const DR = pR > 0 ? W - pR - khe : W - kb;

    /* ---- bề rộng lọt lòng từng khoang + tách thùng ---- */
    // tv[j] = tổng bề dày tấm đứng tại vị trí j (0…n): t (hồi ngoài, vách chung) hoặc 2t (chỗ tách thùng: hồi phải của thùng trước + hồi trái của thùng sau, áp lưng nhau)
    const allAuto = s.khoang.every(k => typeof k.rong !== 'number');
    const allDoors = s.khoang.every(k => k.canh >= 1);
    const chiaRong = tv => {
      const w = s.khoang.map(k => (typeof k.rong === 'number' ? k.rong : null)), inner = X1 - X0 - sum(tv);
      let plan = null, ghi = '', loi = '';
      if (allAuto && allDoors) {
        // Cánh bằng nhau trên toàn bộ mặt tủ; tim vách (hoặc mối áp lưng 2 hồi) trùng tim khe giữa 2 cánh kề nhau.
        const N = sum(s.khoang.map(k => k.canh));
        const wr = Math.floor((DR - DL - (N - 1) * khe) / N * 2 + 1e-9) / 2;      // làm tròn xuống 0,5
        const du = (DR - DL) - (N * wr + (N - 1) * khe);                          // phần dư dồn đều ra 2 mép
        plan = { w: wr, x0: DL + du / 2, du };
        let x = X0 + tv[0], kdoor = 0;
        for (let i = 0; i < n - 1; i++) {
          kdoor += s.khoang[i].canh;
          const xc = plan.x0 + kdoor * (wr + khe) - khe / 2;                      // tim khe sau cánh cuối của khoang i
          const c = roundTo(xc - tv[i + 1] / 2 - x, s.lam_tron);
          w[i] = c; x += c + tv[i + 1];
        }
        w[n - 1] = rn(X1 - tv[n] - x);
        if (du > 0.01) ghi = `Cánh làm tròn ${g(wr)}; khe sát mép ngoài thành ${g((pL > 0 ? khe : kb) + du / 2)}.`;
      } else {
        const fixed = sum(w.filter(v => v !== null)), nAuto = w.filter(v => v === null).length, rest = inner - fixed;
        if (nAuto > 0) {
          const each = roundTo(rest / nAuto, s.lam_tron);
          let used = 0, seen = 0;
          for (let i = 0; i < n; i++) if (w[i] === null) { seen++; w[i] = seen === nAuto ? rn(rest - used) : each; used += each; }
        } else if (Math.abs(rest) > TOL) {
          loi = `Tổng lọt lòng các khoang = ${g(fixed)} nhưng chỗ trống là ${g(inner)} (rộng ${g(W)} − phào ${g(pL)}/${g(pR)} − ${Math.round(sum(tv) / t)} tấm đứng dày ${g(t)}). Lệch ${g(rest)}: sửa bề rộng khoang hoặc để 1 khoang "auto".`;
        }
      }
      return { w, plan, ghi, loi };
    };
    const tv = new Array(n + 1).fill(t);
    let chia = chiaRong(tv), tach = [];
    if (Array.isArray(s.thung.tach)) tach = s.thung.tach.filter(j => j <= n - 1);
    else if (s.thung.rong_max > 0 && n > 1 && chia.w.every(v => v > 30)) {
      // gom các khoang từ trái sang vào một thùng cho tới khi thùng (kể cả 2 hồi) vượt rong_max thì tách
      let rong = t;
      for (let i = 0; i < n; i++) { const them = chia.w[i] + t; if (rong + them > s.thung.rong_max + TOL && rong > t + TOL) { tach.push(i); rong = t; } rong += them; }
    }
    if (tach.length) { for (const j of tach) tv[j] = 2 * t; chia = chiaRong(tv); }
    const widths = chia.w, doorPlan = chia.plan;
    if (chia.loi) err(chia.loi);
    if (chia.ghi) note(chia.ghi, 'canh');
    if (widths.some(w => !(w > 30))) { err(`Bề rộng lọt lòng khoang không hợp lệ: ${widths.map(w => g(w)).join(' / ')}.`); return M; }
    const kep = j => tv[j] > t + TOL;                 // vị trí j là chỗ tách thùng (2 hồi áp lưng)
    const xs = [X0];                                  // mép trái (cụm) tấm đứng tại từng vị trí
    for (let i = 0; i < n; i++) xs.push(rn(xs[i] + tv[i] + widths[i]));
    const bayX = i => rn(xs[i] + tv[i]);              // mép trái lọt lòng khoang i
    if (Math.abs(xs[n] + tv[n] - X1) > TOL) err(`Thùng kết thúc tại x = ${g(xs[n] + tv[n])}, lẽ ra ${g(X1)}.`);
    const thungCua = []; { let k = 0; for (let i = 0; i < n; i++) { if (i > 0 && kep(i)) k++; thungCua.push(k); } }      // khoang i thuộc thùng nào
    M.info.khoang = widths.map(w => rn(w));      // (không viết .map(rn): map đưa thêm chỉ số làm tham số thứ 2 → rn làm tròn theo chỉ số)
    M.info.x_khoang = widths.map((w, i) => bayX(i));
    M.info.tach = tach.slice();
    M.info.thung = [];
    for (let i = 0; i < n; i++) { const k = thungCua[i]; let q = M.info.thung[k]; if (!q) q = M.info.thung[k] = { khoang: [i, i], x0: rn(bayX(i) - t), x1: 0, rong: 0 }; q.khoang[1] = i; q.x1 = rn(bayX(i) + widths[i] + t); q.rong = rn(q.x1 - q.x0); }
    if (M.info.thung.length > 1) note(`Tủ tách ${M.info.thung.length} thùng (mỗi thùng rộng không quá ${g(s.thung.rong_max)}): ${M.info.thung.map(q => `${g(q.rong)} (khoang ${q.khoang[0] === q.khoang[1] ? q.khoang[0] + 1 : (q.khoang[0] + 1) + '–' + (q.khoang[1] + 1)})`).join(' + ')}. Chỗ tách là 2 hồi áp lưng; phào và chân trước là khung chung.`, 'than');
    M.info.than = bodies.map(b => ({ ma: b.code, tu: b.tu, z0: b.z0, z1: b.z1, zb: rn(b.zb), zt: rn(b.zt) }));      // zb…zt = lọt lòng của thân (trên đáy … dưới nóc)

    /* ---- tiện ích thêm tấm ---- */
    const P = (o) => {
      const p = Object.assign({ khoan: KT, big: 1, lines: 0, fd: true, bd: true, open: 0, holes: [] }, o);
      for (const k of ['x0', 'x1', 'y0', 'y1', 'z0', 'z1']) p[k] = rn(p[k]);
      p.t = rn(p.type === 1 ? p.x1 - p.x0 : p.type === 0 ? p.z1 - p.z0 : p.y1 - p.y0);
      M.parts.push(p);
      return p;
    };

    /* ---- hậu ---- */
    // Hậu phủ: tấm hậu nằm SAU thùng (y = sâu thùng − dày hậu … sâu thùng), ốp lên mép sau của hồi, vách, đáy, nóc; thùng lùi lại đúng bằng dày hậu.
    // Hậu dày: lọt lòng từng khoang, nằm trong thùng ở sát mép sau.  Hậu soi rãnh: lùi vào `lui`, ăn rãnh vào hồi / vách / đáy / nóc.
    const Dc = phu ? rn(D - th) : D;                            // chiều sâu các tấm thùng (hồi, vách, đáy, nóc)
    const gS = thin ? s.hau.ranh_sau : 0;
    const yb1 = thin ? D - s.hau.lui : D, yb0 = rn(yb1 - th);  // mặt trước / sau tấm hậu
    const shelfDepth = yb0;                                     // đợt chạy tới mặt trước tấm hậu
    if (shelfDepth < 100) err(`Thùng quá nông: sâu thùng ${g(D)} trừ hậu chỉ còn ${g(shelfDepth)}.`);
    const grooveW = th + s.hau.ranh_ho;
    if (phu && t - s.hau.mep < 8) err(`Hậu phủ: mép hậu lùi vào ${g(s.hau.mep)} thì hậu chỉ còn gối ${g(t - s.hau.mep)} mm lên mép sau của hồi (cần ≥ 8) — giảm số "mép lùi" ở Chuẩn xưởng → Hậu.`, 'hau');

    /* ---- khấu cột (bản 1.13: cột ở góc sau; bản 1.14: thêm cột GIỮA tủ) ----
     * K = { ben, xa, xb, yCot, Dn, mat }: vùng cột (đã cộng khe hở) chiếm xa < x < xb, y > yCot. Cột góc trái: xa = −∞; cột góc phải: xb = +∞; cột giữa: cả hai hữu hạn.
     * Mỗi mặt bên hữu hạn của vùng cột có một VÁCH KHẤU (dày t) đứng ngay NGOÀI vùng cột: mặt xa → xa−t … xa; mặt xb → xb … xb+t; y từ Dn tới Dc (mép sau thùng chính), cao suốt thân như hồi.
     * Vách / hồi nào có mặt trùng mặt cột thì chính nó là vách khấu (không thêm tấm): K.coA / K.coB.
     * HẬU KHẤU (tấm trước mặt cột) là ván thùng dày t, đứng lọt giữa 2 tấm đứng hai bên vùng cột (vách khấu / vách sẵn có; cột góc: hồi ngoài và vách khấu), y từ Dn = yCot − t tới yCot,
     * cao từ mặt dưới đáy tới đỉnh thân. Nóc / đáy / đợt / vách nằm trong vùng cột kết thúc ở Dn (đâm vào mặt trước hậu khấu); riêng hồi ngoài ở cột góc chạy tới yCot để kẹp hậu khấu. */
    bao.muc('khau');
    const KH = [];
    const dsCot = [];
    for (const ben of ['trai', 'phai']) { const q = s.khau[ben]; if (q.rong > 0 && q.sau > 0) dsCot.push({ ben, ten: ben === 'trai' ? 'trái' : 'phải', rong: q.rong, sau: q.sau }); }
    (s.khau.giua || []).forEach((q, i) => { if (q.rong > 0 && q.sau > 0) dsCot.push({ ben: 'giua', so: i, ten: (s.khau.giua.filter(x => x.rong > 0 && x.sau > 0).length > 1 ? `giữa ${i + 1}` : 'giữa'), cach: q.cach, rong: q.rong, sau: q.sau }); });
    // một mặt bên của vùng cột tại x; phia = +1: thùng nằm bên PHẢI mặt này (mặt xb), −1: thùng nằm bên TRÁI (mặt xa)
    const xetMat = (ten, x, phia) => {
      for (let j = 0; j <= n; j++) {
        const a = xs[j], b2 = rn(xs[j] + tv[j]), mat = phia > 0 ? a : b2;      // mặt của cụm tấm đứng quay về phía cột
        if (Math.abs(mat - x) <= 1) return { x: mat, co: true, khoang: -1 };
        if (x > a + TOL && x < b2 - TOL) { err(`Khấu cột ${ten}: mặt bên cột (x = ${g(x)}) rơi vào giữa bề dày ${j === 0 || j === n ? 'hồi' : 'vách'} — nới khe hở hoặc dời vách cho mặt vách trùng mép cột.`); return null; }
      }
      const i = widths.findIndex((w, k) => x > bayX(k) - TOL && x < bayX(k) + w + TOL);
      if (i < 0) { err(`Khấu cột ${ten}: mặt bên cột (x = ${g(x)}) nằm ngoài các khoang của tủ.`); return null; }
      const con = phia > 0 ? bayX(i) + widths[i] - (x + t) : (x - t) - bayX(i), trong = phia > 0 ? x - bayX(i) : bayX(i) + widths[i] - x;
      if (con < 100) { err(`Khấu cột ${ten}: sau vách khấu khoang ${i + 1} chỉ còn rộng ${g(con)} (cần ≥ 100) — dời vách của khoang cho trùng mép cột${/giữa/.test(ten) ? ' (nút "Đặt vách theo mép cột giữa")' : ''}, hoặc nới khoang.`); return null; }
      if (trong < 30) { err(/giữa/.test(ten) ? `Khấu cột ${ten}: mép cột chỉ cách vách của khoang ${i + 1} có ${g(trong)} — dời vách cho trùng mép cột (nút "Đặt vách theo mép cột giữa").` : `Khấu cột ${ten}: cột chỉ lấn vào khoang ${i + 1} có ${g(trong)} — chỉnh khe hở cho mặt cột trùng mặt ${phia > 0 ? 'trong hồi trái' : 'trong hồi phải'}, hoặc nới phào.`); return null; }
      return { x, co: false, khoang: i };
    };
    for (const c of dsCot) {
      const ten = c.ten, ho = s.khau.ho, NX = c.rong + ho, NY = c.sau + ho;
      if (!phu) { err(`Khấu cột ${ten}: hiện chỉ làm với kiểu hậu phủ sau (Chuẩn xưởng → Hậu).`); continue; }
      const K = { ben: c.ben, trai: c.ben === 'trai', ten, NX, NY, xa: -Infinity, xb: Infinity, yCot: rn(D - NY), Dn: rn(D - NY - t), coA: false, coB: false, kA: -1, kB: -1 };
      if (c.ben === 'trai') { if (NX <= pL + TOL) { note(`Cột ${ten} (${g(c.rong)} + hở ${g(ho)}) nằm gọn sau phào ${ten} rộng ${g(pL)} — thùng không phải khấu.`); continue; } K.xb = rn(NX); K.cot = { x0: 0, x1: c.rong, sau: c.sau }; }
      else if (c.ben === 'phai') { if (NX <= pR + TOL) { note(`Cột ${ten} (${g(c.rong)} + hở ${g(ho)}) nằm gọn sau phào ${ten} rộng ${g(pR)} — thùng không phải khấu.`); continue; } K.xa = rn(W - NX); K.cot = { x0: rn(W - c.rong), x1: W, sau: c.sau }; }
      else {
        K.xa = rn(c.cach - ho); K.xb = rn(c.cach + c.rong + ho); K.NX = rn(c.rong + 2 * ho); K.cot = { x0: c.cach, x1: rn(c.cach + c.rong), sau: c.sau };
        if (K.xa <= X0 + t + TOL) { err(`Khấu cột ${ten}: cột cách mép trái ${g(c.cach)} là dính hồi trái — khai cột này ở ô "Cột TRÁI" (lấn ngang ${g(c.cach + c.rong)}).`); continue; }
        if (K.xb >= X1 - t - TOL) { err(`Khấu cột ${ten}: cột tới ${g(c.cach + c.rong)} là dính hồi phải (tủ rộng ${g(W)}) — khai cột này ở ô "Cột PHẢI" (lấn ngang ${g(W - c.cach)}).`); continue; }
      }
      if (K.Dn < 150) { err(`Khấu cột ${ten}: cột sâu ${g(c.sau)} thì thùng trước cột chỉ còn sâu ${g(K.Dn)} (cần ≥ 150).`); continue; }
      if (KH.some(o => Math.min(o.xb, K.xb) - Math.max(o.xa, K.xa) > -2 * t)) { err(`Khấu cột ${ten}: nằm chồng hoặc quá sát một cột khác đã khai — gộp hai cột thành một.`); continue; }
      // vị trí từng mặt bên cột so với các tấm đứng
      let hong = false;
      if (isFinite(K.xa)) { const F = xetMat(ten, K.xa, -1); if (!F) hong = true; else { K.xa = F.x; K.coA = F.co; K.kA = F.khoang; } }
      if (!hong && isFinite(K.xb)) { const F = xetMat(ten, K.xb, 1); if (!F) hong = true; else { K.xb = F.x; K.coB = F.co; K.kB = F.khoang; } }
      if (hong) continue;
      K.eA = isFinite(K.xa) && !K.coA ? t : 0; K.eB = isFinite(K.xb) && !K.coB ? t : 0;      // bề dày vách khấu thêm ở từng mặt
      K.x = K.trai ? K.xb : K.xa; K.co_vach = K.trai ? K.coB : K.coA; K.khoang = K.trai ? K.kB : K.kA;      // (tên cũ của bản 1.13, cột góc chỉ có một mặt)
      KH.push(K);
    }
    const kTrong = (K, a, b2) => a >= K.xa - TOL && b2 <= K.xb + TOL;                                 // đoạn [a, b2] nằm trọn trong vùng cột (theo chiều ngang)
    const kNgoai = (K, a, b2) => b2 <= K.xa - K.eA + TOL || a >= K.xb + K.eB - TOL;                   // nằm hẳn ngoài vùng cột và vách khấu
    const hoiGoc = (K, a) => (K.ben === 'trai' && Math.abs(a - xs[0]) < TOL) || (K.ben === 'phai' && Math.abs(a - xs[n]) < TOL);      // hồi ngoài ở phía cột góc: kẹp hậu khấu
    const sauDung = (a, b2) => { let y = Dc; for (const K of KH) if (kTrong(K, a, b2)) y = Math.min(y, hoiGoc(K, a) ? K.yCot : K.Dn); return y; };      // mép sau của một tấm đứng
    // tấm nằm ngang (đáy, nóc, đợt): nằm trọn trong vùng khấu thì nông lại; vắt qua mép cột thì khoét — góc chữ L (cột trùm tới mép tấm) hoặc chữ U (cột lọt giữa tấm).
    // p.khau = các hình chữ nhật bị khoét (toạ độ tủ), ben = 'trai' / 'phai' (khoét chạm mép trái / phải của tấm) hoặc 'giua' (chữ U)
    const khauNgang = p => {
      for (const K of KH) {
        if (kTrong(K, p.x0, p.x1)) { if (p.y1 > K.Dn) p.y1 = K.Dn; continue; }
        if (kNgoai(K, p.x0, p.x1) || p.y1 <= K.Dn + TOL) continue;
        const x0 = rn(Math.max(p.x0, K.xa - K.eA)), x1 = rn(Math.min(p.x1, K.xb + K.eB));
        (p.khau = p.khau || []).push({ ben: Math.abs(x0 - p.x0) < TOL ? 'trai' : Math.abs(x1 - p.x1) < TOL ? 'phai' : 'giua', x0, x1, y0: K.Dn, y1: p.y1 });
      }
      if (p.khau) p.khau.sort((a, b) => a.x0 - b.x0);
      return p;
    };
    // chiều sâu dùng được của từng khoang (ngăn kéo, vách đệm, suốt treo): khoang dính vùng khấu thì chỉ tính tới mép sau của phần nông
    const sauKhoang = widths.map((w, i) => { let y = shelfDepth; for (const K of KH) if (!kNgoai(K, bayX(i), bayX(i) + w)) y = Math.min(y, K.Dn); return y; });
    M.info.khau = KH.map(K => ({ ben: K.ben, x: K.x, y: K.yCot, sau_thung: K.Dn, vach_co_san: K.co_vach, xa: isFinite(K.xa) ? K.xa : null, xb: isFinite(K.xb) ? K.xb : null, co_a: K.coA, co_b: K.coB, cot: K.cot }));
    const tenVachK = K => { const m = []; if (isFinite(K.xa)) m.push(K.coA); if (isFinite(K.xb)) m.push(K.coB); return m.every(Boolean) ? (m.length > 1 ? 'hai vách sẵn có làm vách khấu (khoang nông trước cột)' : 'vách sẵn có làm vách khấu') : m.some(Boolean) ? 'một vách sẵn có + thêm một vách khấu' : (m.length > 1 ? 'thêm hai vách khấu' : 'thêm vách khấu'); };
    if (KH.length) note(`Khấu cột: ${KH.map(K => `${K.ten} ${g(K.NX)} × ${g(K.NY)} (cột + hở ${g(s.khau.ho)}) — thùng trước cột sâu ${g(K.Dn)}, ${tenVachK(K)}`).join('; ')}. Hậu khấu (tấm trước mặt cột) là ván thùng dày ${g(t)}, lọt giữa 2 tấm đứng hai bên cột. Nóc / đáy / đợt vắt qua mép cột được khoét góc chữ L${KH.some(K => K.ben === 'giua') ? ' hoặc chữ U' : ''}.`);

    /* ---- thùng từng thân ---- */
    for (const b of bodies) {
      const vL = [], vR = [];      // tấm đứng bên trái / bên phải của từng khoang
      for (let j = 0; j <= n; j++) {
        if (j > 0 && j < n && kep(j)) {      // chỗ tách thùng: hồi phải của thùng bên trái + hồi trái của thùng bên phải, áp lưng nhau
          vR[j - 1] = P({ loai: 'HOI', ten: NM.hoi_phai, than: b.code, tu: b.tu, type: 1, x0: xs[j], x1: xs[j] + t, y0: 0, y1: sauDung(xs[j], xs[j] + t), z0: b.z0, z1: b.z1, big: 1, vi_tri: j, thung: thungCua[j - 1] });
          vL[j] = P({ loai: 'HOI', ten: NM.hoi_trai, than: b.code, tu: b.tu, type: 1, x0: xs[j] + t, x1: xs[j] + 2 * t, y0: 0, y1: sauDung(xs[j] + t, xs[j] + 2 * t), z0: b.z0, z1: b.z1, big: 0, vi_tri: j, thung: thungCua[j] });
          continue;
        }
        const ngoai = j === 0 || j === n;
        const p = P({ loai: ngoai ? 'HOI' : 'VACH', ten: j === 0 ? NM.hoi_trai : j === n ? NM.hoi_phai : NM.vach, than: b.code, tu: b.tu, type: 1,
          x0: xs[j], x1: xs[j] + t, y0: 0, y1: sauDung(xs[j], xs[j] + t), z0: b.z0, z1: b.z1, big: j === n ? 1 : 0, vi_tri: j, thung: thungCua[Math.min(j, n - 1)] });
        if (j > 0) vR[j - 1] = p;
        if (j < n) vL[j] = p;
      }
      for (let i = 0; i < n; i++) {
        const bx = bayX(i), c = widths[i];
        const day = khauNgang(P({ loai: 'DAY', ten: NM.day, than: b.code, tu: b.tu, type: 0, x0: bx, x1: bx + c, y0: 0, y1: Dc, z0: b.zb - t, z1: b.zb, big: 1, khoang: i }));
        const noc = khauNgang(P({ loai: 'NOC', ten: NM.noc, than: b.code, tu: b.tu, type: 0, x0: bx, x1: bx + c, y0: 0, y1: Dc, z0: b.zt, z1: b.z1, big: 0, khoang: i }));
        if (phu) continue;
        // hậu dày lọt lòng / hậu soi rãnh: mỗi khoang 1 tấm
        const hau = P({ loai: 'HAU', ten: NM.hau, than: b.code, tu: b.tu, type: 2, x0: bx - gS, x1: bx + c + gS, y0: yb0, y1: yb1, z0: b.zb - gS, z1: b.zt + gS,
          big: 1, fd: false, bd: thin ? false : true, khoan: thin ? KHONG_KHOAN : KT, khoang: i, mong: thin });
        if (thin) {
          // rãnh trên 2 tấm đứng hai bên, đáy (mặt trên), nóc (mặt dưới) — toạ độ riêng của từng tấm
          const zg0 = hau.z0, zg1 = hau.z1;
          const L = vL[i], R = vR[i];
          L.holes.push({ kieu: 'ranh', u: yb0, v: zg0 - L.z0, w: grooveW, h: zg1 - zg0, z: t - gS, sau: gS });      // mặt x lớn của tấm trái
          R.holes.push({ kieu: 'ranh', u: yb0, v: zg0 - R.z0, w: grooveW, h: zg1 - zg0, z: 0, sau: gS });          // mặt x nhỏ của tấm phải
          day.holes.push({ kieu: 'ranh', u: yb0, v: 0, w: grooveW, h: c, z: t - gS, sau: gS });                    // mặt trên đáy
          noc.holes.push({ kieu: 'ranh', u: yb0, v: 0, w: grooveW, h: c, z: 0, sau: gS });                         // mặt dưới nóc
        }
      }
      if (phu) {
        // Hậu phủ: phủ từ mặt dưới đáy tới mặt trên nóc, từ mép ngoài hồi trái tới mép ngoài hồi phải (lùi vào `mep`); không khoan — bắn đinh từ sau vào mép sau của hồi, vách, đáy, nóc, đợt.
        // Chia tấm: mối nối nằm trên mép sau của vách (tim vách, làm tròn 1 mm để tấm ra số chẵn) → mỗi tấm gối lên vách khoảng nửa bề dày ván.
        const mep = s.hau.mep, zA = rn(b.zb - t + mep), zB = rn(b.z1 - mep);
        // mép tấm hậu: ở hồi (hồi ngoài, hoặc hồi tại chỗ tách thùng) hậu phủ hết hồi của thùng mình, lùi `mep`; ở vách chung thì nối tại tim vách
        const trai = i => (i === 0 || kep(i) ? rn(xs[i] + tv[i] - t + mep) : Math.round(xs[i] + t / 2));
        const phai = i => (i === n - 1 || kep(i + 1) ? rn(xs[i + 1] + t - mep) : Math.round(xs[i + 1] + t / 2));
        const vua = (w, h) => Math.max(w, h) <= s.van.kho_dai + TOL && Math.min(w, h) <= s.van.kho_rong + TOL;
        const manh = [];
        for (let i = 0; i < n;) {
          let j = i;
          if (s.hau.chia === 'kho_van') while (j + 1 < n && thungCua[j + 1] === thungCua[i] && vua(phai(j + 1) - trai(i), zB - zA)) j++;      // tấm hậu không bắc qua 2 thùng
          manh.push({ x0: trai(i), x1: phai(j), i, j, K: null });
          i = j + 1;
        }
        // khấu cột: phần hậu nằm trong vùng cột lùi ra mặt phẳng hậu khấu; mảnh vắt qua mặt cột cắt tại mặt đó (hậu chính phủ mép sau vách khấu, lùi `mep` khỏi mặt cột)
        for (const K of KH) {
          const ra = [];
          for (const m of manh) {
            if (m.K) { ra.push(m); continue; }
            const a = Math.max(m.x0, K.xa), b2 = Math.min(m.x1, K.xb);
            if (b2 - a <= TOL) {      // không dính vùng cột — chỉ lùi mép nếu mảnh áp sát mặt cột
              let x0 = m.x0, x1 = m.x1;
              if (isFinite(K.xb) && x0 >= K.xb - TOL && x0 < K.xb + mep - TOL) x0 = rn(K.xb + mep);
              if (isFinite(K.xa) && x1 <= K.xa + TOL && x1 > K.xa - mep + TOL) x1 = rn(K.xa - mep);
              ra.push({ x0, x1, i: m.i, j: m.j, K: null }); continue;
            }
            if (m.x0 < K.xa - TOL) ra.push({ x0: m.x0, x1: Math.min(m.x1, rn(K.xa - mep)), i: m.i, j: m.j, K: null });
            ra.push({ x0: a, x1: b2, i: m.i, j: m.j, K });
            if (m.x1 > K.xb + TOL) ra.push({ x0: Math.max(m.x0, rn(K.xb + mep)), x1: m.x1, i: m.i, j: m.j, K: null });
          }
          manh.length = 0; manh.push(...ra);
        }
        // các mảnh hậu khấu của cùng một cột nằm liền nhau (mối nối hậu rơi vào vùng cột) → nhập thành một tấm trước mặt cột
        for (let q = manh.length - 1; q > 0; q--) { const m = manh[q], tr = manh[q - 1]; if (m.K && tr.K === m.K && Math.abs(tr.x1 - m.x0) < 1.01) { tr.x1 = m.x1; tr.j = m.j; manh.splice(q, 1); } }
        // mảnh vụn sinh ra khi mối nối hậu rơi đúng vách làm vách khấu (rộng chưa tới nửa bề dày ván): nhập vào mảnh hậu chính kề nó
        for (let q = manh.length - 1; q >= 0; q--) {
          const m = manh[q]; if (m.K || m.x1 - m.x0 >= 40) continue;
          const ke = manh.find(o => o !== m && !o.K && (Math.abs(o.x0 - m.x1) < 1.01 || Math.abs(o.x1 - m.x0) < 1.01));
          if (ke) { ke.x0 = Math.min(ke.x0, m.x0); ke.x1 = Math.max(ke.x1, m.x1); }
          manh.splice(q, 1);
        }
        for (const m of manh) {
          if (m.K) continue;      // phần trước mặt cột: hậu khấu bằng ván thùng (bên dưới)
          const w = m.x1 - m.x0;
          P({ loai: 'HAU', ten: NM.hau, than: b.code, tu: b.tu, type: 2, x0: m.x0, x1: m.x1, y0: Dc, y1: D, z0: zA, z1: zB, big: 1, fd: false, bd: false, khoan: KHONG_KHOAN, khoang: m.i, den_khoang: m.j, phu: true,
            lines: (w > s.van.kho_rong + TOL && zB - zA <= s.van.kho_rong + TOL) ? 1 : 0 });      // tấm rộng hơn khổ ván: vân ngang, nằm dọc theo chiều dài khổ
        }
        // HẬU KHẤU: ván thùng dày t, lọt giữa 2 tấm đứng hai bên vùng cột, cao từ mặt dưới đáy tới đỉnh thân; khoan liên kết như tấm thùng (mép đứng ↔ vách khấu, mép sau nóc / đáy / đợt ↔ mặt trước).
        for (const K of KH) {
          const x0 = isFinite(K.xa) ? K.xa : rn(xs[0] + t), x1 = isFinite(K.xb) ? K.xb : xs[n];
          if (x1 - x0 < 30) continue;
          const i0 = widths.findIndex((w, k) => bayX(k) + w > x0 + TOL);
          P({ loai: 'HAU', ten: NM.hau_khau, than: b.code, tu: b.tu, type: 2, x0, x1, y0: K.Dn, y1: K.yCot, z0: rn(b.zb - t), z1: b.z1, big: 1, khoang: Math.max(0, i0), khau_cot: K.ben, van_thung: true });
        }
        // vách khấu: đứng dọc mặt bên cột, từ mặt phẳng hậu khấu tới mép sau thùng chính, cao suốt thân (nóc / đáy / đợt khoét tới mặt trong của nó)
        for (const K of KH) {
          if (K.eA) P({ loai: 'VACH', ten: NM.vach_khau, than: b.code, tu: b.tu, type: 1, x0: K.xa - t, x1: K.xa, y0: K.Dn, y1: Dc, z0: b.z0, z1: b.z1, big: 1, khoang: K.kA, khau_cot: K.ben });
          if (K.eB) P({ loai: 'VACH', ten: NM.vach_khau, than: b.code, tu: b.tu, type: 1, x0: K.xb, x1: K.xb + t, y0: K.Dn, y1: Dc, z0: b.z0, z1: b.z1, big: 0, khoang: K.kB, khau_cot: K.ben });
        }
      }
    }

    /* ---- đợt ---- */
    bao.muc('dot');
    const dotsOf = s.khoang.map(() => ({}));      // khoang → { mã thân: [z…] }
    s.khoang.forEach((k, i) => {
      const dots = k.dot || [];
      for (let j = 0; j < dots.length; j++) {
        const z = dots[j];
        const b = bodies.find(bd => z >= bd.zb + 30 - TOL && z + t <= bd.zt - 30 + TOL);
        if (!b) { err(`Khoang ${i + 1}: đợt +${g(z)} không nằm trong lọt lòng thân nào (${bodies.map(bd => `${g(bd.zb + 30)}…${g(bd.zt - 30 - t)}`).join(' | ')}).`); continue; }
        if (j > 0 && z - dots[j - 1] < t + 20) { err(`Khoang ${i + 1}: hai đợt +${g(dots[j - 1])} và +${g(z)} quá sát nhau.`); continue; }
        khauNgang(P({ loai: 'DOT', ten: NM.dot, than: b.code, tu: b.tu, type: 0, x0: bayX(i), x1: bayX(i) + widths[i], y0: 0, y1: shelfDepth, z0: z, z1: z + t, big: 1, khoang: i, idx: j }));
        (dotsOf[i][b.code] = dotsOf[i][b.code] || []).push(z);
      }
    });

    /* ---- ô: các đợt chia mỗi khoang (từng thân) thành các ô; gán nội dung ô ---- */
    const cells = [];
    s.khoang.forEach((k, i) => bodies.forEach(b => {
      let lo = { top: b.zb, tu: rn(b.zb - t), dot: null };
      for (const z of (dotsOf[i][b.code] || []).concat([null])) {
        cells.push({ khoang: i, b, than: b.code, tu: lo.tu, z0: rn(lo.top), z1: rn(z === null ? b.zt : z), zDuoi: lo.dot, zTren: z, x0: bayX(i), x1: rn(bayX(i) + widths[i]) });
        if (z !== null) lo = { top: z + t, tu: z, dot: z };
      }
    }));
    s.khoang.forEach((k, i) => {
      const cs = cells.filter(c => c.khoang === i).sort((a, b) => a.tu - b.tu);
      for (const c0 of (k.o || [])) {
        let c = null; for (const x of cs) if (x.tu <= c0.tu + TOL) c = x;
        c = c || cs[0]; if (!c) continue;
        if (c.kieu) { warn(`Khoang ${i + 1}: có 2 nội dung đặt vào cùng một ô (+${g(c.z0)} … +${g(c.z1)}) — giữ "${TEN_KIEU[c.kieu]}", bỏ "${TEN_KIEU[c0.kieu]}".`); continue; }
        c.kieu = c0.kieu; c.so = c0.kieu === 'suot' ? 0 : c0.so; c.loai = c0.kieu === 'suot' ? '' : (c0.loai || '');
      }
    });
    M.info.o = cells.map(c => ({ khoang: c.khoang, than: c.than, tu: c.tu, z0: c.z0, z1: c.z1, kieu: c.kieu || '', so: c.so || 0, loai: c.loai || '', x0: c.x0, x1: c.x1 }));

    /* ---- xà chân trước (phào dưới): che hết chân hồi + chân vách ---- */
    bao.muc('phao_chan');
    const FL = pL > 0 ? pL : 0, FR = pR > 0 ? W - pR : W;       // giới hạn các thanh ngang ở mặt phẳng cánh
    const joints = () => {
      const len = FR - FL;
      if (len <= s.van.kho_dai + TOL) return [FL, FR];
      const mids = [];
      if (doorPlan) { let kd = 0; for (let j = 0; j < n - 1; j++) { kd += s.khoang[j].canh; mids.push(rn(doorPlan.x0 + kd * (doorPlan.w + khe) - khe / 2)); } }   // tim khe giữa 2 cặp cánh
      else for (let j = 1; j < n; j++) mids.push(rn(xs[j] + tv[j] / 2));                                                                                          // tim vách
      // chỗ tách thùng: mối nối xà chân / phào rơi ĐÚNG đường áp lưng 2 hồi (không lệch nửa li theo khe cánh) → mỗi đầu thanh tì trọn bề dày hồi của thùng mình, Chenfeng khoan được cam
      for (let j = 1; j < n; j++) if (kep(j)) { const sx = rn(xs[j] + tv[j] / 2), k = mids.findIndex(m => Math.abs(m - sx) <= 3); if (k >= 0) mids[k] = sx; }
      if (s.phao.noi === 'it_nhat') {
        const out = [FL]; let cur = FL;
        while (FR - cur > s.van.kho_dai + TOL) { const c = mids.filter(m => m > cur + TOL && m - cur <= s.van.kho_dai + TOL).pop(); if (c === undefined) break; out.push(c); cur = c; }
        out.push(FR); return out;
      }
      return [FL, ...mids, FR];
    };
    const J = joints();
    for (let k = 0; k < J.length - 1; k++) if (J[k + 1] - J[k] > s.van.kho_dai + TOL) err(`Thanh ngang mặt trước dài ${g(J[k + 1] - J[k])} > khổ ván ${g(s.van.kho_dai)}: thêm vách để có chỗ nối.`);
    if (chan > 0) {
      for (let k = 0; k < J.length - 1; k++)
        P({ loai: 'CHAN', ten: NM.chan, than: lower.code, tu: lower.tu, type: 2, x0: J[k], x1: J[k + 1], y0: -tc, y1: 0, z0: 0, z1: chan, big: 1, lines: 1 });
    }

    /* ---- phào mặt + thanh phụ trợ ---- */
    const topBody = bodies[bodies.length - 1];
    const sideSeg = twoBody ? [{ b: bodies[0], z0: 0, z1: zd }, { b: bodies[1], z0: zd, z1: H }] : [{ b: bodies[0], z0: 0, z1: H }];
    for (const sg of sideSeg) if (sg.z1 - sg.z0 > s.van.kho_dai + TOL && (pL > 0 || pR > 0)) err(`Phào đứng dài ${g(sg.z1 - sg.z0)} > khổ ván ${g(s.van.kho_dai)}.`);
    const phaoDung = (trai) => {
      const p = trai ? pL : pR; if (!(p > 0)) return;
      const xa = trai ? 0 : W - p, xb = trai ? p : W;
      for (const sg of sideSeg) {
        P({ loai: 'PHAO', ten: trai ? NM.phao_trai : NM.phao_phai, than: sg.b.code, tu: sg.b.tu, type: 2, x0: xa, x1: xb, y0: -tc, y1: 0, z0: sg.z0, z1: sg.z1, khoan: KP, big: 0 });
        if (aux > 0) {
          if (p < t) { warn(`Phào ${trai ? 'trái' : 'phải'} rộng ${g(p)} < dày ván ${g(t)}: không đặt được thanh phụ trợ.`); continue; }
          P({ loai: 'PHU', ten: NM.phu_tro, than: sg.b.code, tu: sg.b.tu, type: 1, x0: trai ? p - t : W - p, x1: trai ? p : W - p + t, y0: 0, y1: aux, z0: sg.z0, z1: Math.min(sg.z1, Ztop), khoan: KP, big: 0 });
        }
      }
    };
    phaoDung(true); phaoDung(false);
    if (pT > 0) {
      for (let k = 0; k < J.length - 1; k++) {
        P({ loai: 'PHAO', ten: NM.phao_tren, than: topBody.code, tu: topBody.tu, type: 2, x0: J[k], x1: J[k + 1], y0: -tc, y1: 0, z0: H - pT, z1: H, khoan: KP, big: 0, lines: 1 });
        if (aux > 0) {
          if (pT < t) { if (k === 0) warn(`Phào trên cao ${g(pT)} < dày ván ${g(t)}: không đặt được thanh phụ trợ.`); continue; }
          P({ loai: 'PHU', ten: NM.phu_tro, than: topBody.code, tu: topBody.tu, type: 0, x0: J[k], x1: J[k + 1], y0: 0, y1: aux, z0: Ztop, z1: Ztop + t, khoan: KP, big: 0 });
        }
      }
    }

    /* ---- cánh: cột cánh theo bề ngang ---- */
    const doorZ = (b) => {
      const isLow = b === bodies[0], isTop = b === topBody;
      const za = isLow ? (chan > 0 ? chan + khe : kb) : b.z0 + khe / 2;
      const zb = isTop ? (pT > 0 ? H - pT - khe : H - kb) : b.z1 - khe / 2;
      return [za, zb];
    };
    const doorCols = [];      // {khoang, x, w, open}
    {
      let kdoor = 0;
      for (let i = 0; i < n; i++) {
        const nd = s.khoang[i].canh; if (!nd) continue;
        if (doorPlan) {
          for (let d = 0; d < nd; d++) doorCols.push({ khoang: i, x: rn(doorPlan.x0 + (kdoor + d) * (doorPlan.w + khe)), w: doorPlan.w, open: nd === 2 ? (d === 0 ? 1 : 2) : (s.khoang[i].ban_le === 'phai' ? 2 : 1) });
          kdoor += nd;
        } else {
          const L = i === 0 ? DL : xs[i] + tv[i] / 2 + khe / 2;
          const R = i === n - 1 ? DR : xs[i + 1] + tv[i + 1] / 2 - khe / 2;
          const wraw = (R - L - (nd - 1) * khe) / nd;
          const w = Math.floor(wraw * 2 + 1e-9) / 2, du = (R - L) - (nd * w + (nd - 1) * khe);
          for (let d = 0; d < nd; d++) doorCols.push({ khoang: i, x: rn(L + du / 2 + d * (w + khe)), w, open: nd === 2 ? (d === 0 ? 1 : 2) : (s.khoang[i].ban_le === 'phai' ? 2 : 1) });
        }
      }
    }
    // vùng mặt trước của một khoang (mép trái cánh đầu … mép phải cánh cuối); khoang không cánh thì tính như vùng cánh sẽ phủ
    const vungMat = i => {
      const cols = doorCols.filter(d => d.khoang === i);
      if (cols.length) return [cols[0].x, rn(cols[cols.length - 1].x + cols[cols.length - 1].w)];
      return [rn(i === 0 ? DL : xs[i] + tv[i] / 2 + khe / 2), rn(i === n - 1 ? DR : xs[i + 1] + tv[i + 1] / 2 - khe / 2)];
    };

    /* ---- nội dung ô: ngăn kéo âm / ngăn kéo trùm ngoài / suốt treo (đều dùng mẫu Chenfeng) ---- */
    bao.muc('ngan_keo');
    const nk = s.ngan_keo, nkRongDaBao = new Set();      // khoang đã có cảnh báo "mặt ngăn kéo rộng" (quy tắc cũ)
    const vungTrum = [];      // vùng mặt ngăn kéo trùm ngoài: cánh phải tránh ra {khoang, b, f0, f1}
    // loại ngăn kéo của một ô: loại ô chọn → loại mặc định → loại đầu danh sách
    const loaiNK = ma => nk.loai.find(x => x.ma === ma) || nk.loai.find(x => x.ma === nk.mac_dinh) || nk.loai[0] || null;
    const daBao = new Set();
    // tham số gửi cho mẫu: BH + tham số riêng của loại ('mat' → cao mặt) + phần mặt nhô ra do lõi tính
    const thamSo = (lo, bh, mat, nho) => { const o = { BH: bh }; for (const k of Object.keys(lo.ts)) o[k] = lo.ts[k] === 'mat' ? mat : lo.ts[k]; return Object.assign(o, nho); };
    // hộp ngăn kéo (không kể mặt) cao bao nhiêu với mặt cao `mat`: mẫu để hộp thấp hơn mép trên mặt SLK, cao hơn mép dưới mặt XLK
    const hopCao = (lo, mat) => ('CMG' in lo.ts ? Infinity : mat - (typeof lo.ts.SLK === 'number' ? lo.ts.SLK : 0) - (typeof lo.ts.XLK === 'number' ? lo.ts.XLK : 0));
    if (cells.some(c => c.kieu === 'suot') && !s.suot.mau_id) warn('Chưa khai mã mẫu suốt treo (Chuẩn xưởng → Suốt treo): suốt treo sẽ không được vẽ.', 'mau');
    for (const c of cells) {
      if (!c.kieu) continue;
      const i = c.khoang, k = s.khoang[i], za = c.z0, zb = c.z1, cao = zb - za, m = c.so;
      const shelfDepth = sauKhoang[i];      // khoang dính vùng khấu cột: ngăn kéo / vách đệm / suốt treo chỉ sâu tới phần nông
      const viTri = `Khoang ${i + 1}, ô +${g(za)} … +${g(zb)}`;
      const lo = c.kieu === 'suot' ? null : loaiNK(c.loai);
      if (c.kieu !== 'suot') {
        if (!lo) { if (!daBao.has('')) { daBao.add(''); err('Chưa có loại ngăn kéo nào (Chuẩn xưởng → Các loại ngăn kéo).', 'mau'); } continue; }
        if (!lo.mau_id && !daBao.has(lo.ma)) { daBao.add(lo.ma); warn(`Chưa khai mã mẫu ngăn kéo cho loại "${lo.ten}" (Chuẩn xưởng → Các loại ngăn kéo): ngăn kéo loại này sẽ không được vẽ.`, 'mau'); }
      }
      if (c.kieu === 'suot') {
        if (cao < s.suot.cach_dot + 60) { err(`${viTri}: khoảng treo chỉ cao ${g(cao)} — không đủ chỗ treo suốt.`, 'suot'); continue; }
        M.templates.push({ loai: 'SUOT', id: s.suot.mau_id, ten: s.suot.ten_mau, tu: c.b.tu, khoang: i,
          box: [rn(widths[i]), rn(shelfDepth), rn(cao)], pos: [bayX(i), 0, rn(za)], params: { BH: t, JS: s.suot.cach_dot, YGKC: 0 } });
        continue;
      }
      if (c.kieu === 'nk_am') {
        const tongMat = cao - nk.khe_tren - nk.khe_duoi - nk.khe_giua * (m - 1);
        const mat = Math.floor(tongMat / m * 2 + 1e-9) / 2, duMat = rn(tongMat - mat * m);      // mặt chẵn 0,5 mm; phần dư dồn vào khe trên cùng
        if (mat < 60) { err(`${viTri}: mặt ngăn kéo chỉ cao ${g(mat)} — giảm số ngăn hoặc nới ô.`); continue; }
        if (hopCao(lo, mat) < 40) { err(`${viTri}: mặt ngăn kéo cao ${g(mat)} thì hộp ngăn kéo chỉ còn ${g(hopCao(lo, mat))} (loại "${lo.ten}") — giảm số ngăn hoặc nới ô.`); continue; }
        if (mat > 450) warn(`${viTri}: mặt ngăn kéo cao ${g(mat)} (> 450) — nên thêm ngăn hoặc hạ đợt phía trên.`);
        const sauNK = Math.floor((shelfDepth - nk.lui - nk.ho_sau) / nk.buoc_sau + 1e-9) * nk.buoc_sau;
        if (sauNK < 200) { err(`${viTri}: thùng quá nông cho ngăn kéo (sâu hộp ${g(sauNK)}).`); continue; }
        if (nk.lui < t) { err(`Ngăn kéo: "lùi" (${g(nk.lui)}) phải ≥ dày mặt ngăn kéo (${g(t)}).`); continue; }
        // Ngăn kéo âm nằm sau cánh mở: bản lề bắt trên chính hồi/vách của khoang, nên mặt + hộp ngăn kéo phải lùi vào `dem` ở mỗi bên có bản lề.
        // Bên đó đặt 1 vách đệm (đứng giữa 2 tấm nằm trên dưới ô) để bắt ray; khe giữa hồi/vách và vách đệm là chỗ cho bản lề.
        const banLeTrai = k.canh === 2 || (k.canh === 1 && k.ban_le !== 'phai'), banLePhai = k.canh === 2 || (k.canh === 1 && k.ban_le === 'phai');
        const dem = nk.dem > 0 ? nk.dem : 0;
        if (dem > 0 && dem < t) { err(`Ngăn kéo: khoảng đặt vách đệm (${g(dem)}) phải ≥ dày ván ${g(t)} (Chuẩn xưởng → Ngăn kéo).`); continue; }
        const demL = banLeTrai ? dem : 0, demR = banLePhai ? dem : 0;
        const x0 = rn(bayX(i) + demL), L = rn(widths[i] - demL - demR);
        if (L < 300) { err(`Khoang ${i + 1}: quá hẹp cho ngăn kéo âm — sau khi trừ vách đệm tránh bản lề chỉ còn ${g(L)} (cần ≥ 300).`); continue; }
        if (k.canh > 0 && !dem) warn(`Khoang ${i + 1}: ngăn kéo âm chạy sát hồi/vách có bản lề (vách đệm = 0) — ngăn kéo sẽ vướng bản lề khi kéo ra.`);
        else if (k.canh > 0 && dem - t < 25) warn(`Khoang ${i + 1}: khe cho bản lề giữa hồi/vách và vách đệm chỉ ${g(dem - t)} (< 25) — dễ cấn tay bản lề.`);
        if (dem > 0) {
          if (demL) P({ loai: 'DEM', ten: NM.dem, than: c.than, tu: c.b.tu, type: 1, x0: x0 - t, x1: x0, y0: nk.lui - t, y1: shelfDepth, z0: za, z1: zb, big: 1, khoang: i });
          if (demR) P({ loai: 'DEM', ten: NM.dem, than: c.than, tu: c.b.tu, type: 1, x0: x0 + L, x1: x0 + L + t, y0: nk.lui - t, y1: shelfDepth, z0: za, z1: zb, big: 0, khoang: i });
          if (demL || demR) {
            // Đầu vách đệm tì lên mặt dưới của đợt phía trên, đè đúng chỗ lỗ cam của đợt (cam cách đầu đợt 34, vách đệm cách hồi/vách `dem − dày ván`):
            // cam ở mặt dưới sẽ không vặn được → đưa cam của đợt đó lên mặt trên. (Đáy thì cam ở mặt dưới, vách đệm đứng ở mặt trên nên không vướng.)
            const dotTai = z => (z === null ? null : M.parts.find(p => p.loai === 'DOT' && p.khoang === i && Math.abs(p.z0 - z) < TOL));
            const tren = dotTai(c.zTren), duoi = dotTai(c.zDuoi);
            if (tren) { tren.big = 0; tren.dem_duoi = true; }
            if (duoi) duoi.dem_tren = true;
          }
        }
        let z = za; const matZ = [];      // [mép dưới, mép trên] của từng mặt ngăn kéo, từ dưới lên
        for (let q = 0; q < m; q++) {
          const duoi = q === 0 ? nk.khe_duoi : nk.khe_giua / 2, tren = q === m - 1 ? nk.khe_tren + duMat : nk.khe_giua / 2;
          const h = duoi + mat + tren;
          matZ.push([rn(z + duoi), rn(z + duoi + mat)]);
          M.mat_ngan_keo.push({ khoang: i, x: rn(x0 + nk.khe_ben), z: rn(z + duoi), w: rn(L - 2 * nk.khe_ben), h: rn(mat), y: rn(nk.lui - t), t, trum: false });
          M.templates.push({ loai: 'NGAN_KEO', kieu: 'nk_am', id: lo.mau_id, ten: lo.ten_mau, ma_loai: lo.ma, ten_loai: lo.ten, tu: c.b.tu, khoang: i,
            bac_sau: { tu: rn(shelfDepth - nk.lui - nk.ho_sau), buoc: nk.buoc_sau },      // sâu hộp = floor(tu / buoc) × buoc — nhảy bậc theo cỡ ray
            box: [L, sauNK, rn(h)], pos: [x0, nk.lui, rn(z)],     // gốc mẫu = lưng mặt ngăn kéo; mặt NK dày BH nằm phía trước gốc (y = lùi − BH … lùi), hộp từ y = lùi
            params: thamSo(lo, t, mat, { SYS: -tren, XYS: -duoi, ZYS: -nk.khe_ben, YYS: -nk.khe_ben }) });
          z += h;
        }
        // Xà ngăn kéo: ván đứng nằm ngay SAU lưng mặt ngăn kéo, che khe phía trên mỗi mặt (khe luồn tay của mặt vát) và giằng 2 vách đệm lại.
        // Xà phải nằm lọt trong khoảng trống giữa 2 hộp ngăn kéo: hộp thấp hơn mép trên mặt SLK, cao hơn mép dưới mặt XLK (mẫu không khai thì coi như 0).
        if (nk.xa_cao > 0) {
          const HO = 5, biet = !('CMG' in lo.ts);
          const slk = biet && typeof lo.ts.SLK === 'number' ? lo.ts.SLK : 0, xlk = biet && typeof lo.ts.XLK === 'number' ? lo.ts.XLK : 0;
          const ya = rn(nk.lui + nk.xa_ho);
          let thieu = 0;
          for (let q = 0; q < m; q++) {
            const khe0 = matZ[q][1], khe1 = q === m - 1 ? zb : matZ[q + 1][0];                      // khe cần che
            const lo_ = rn(khe0 - slk + HO), hi_ = q === m - 1 ? zb : rn(khe1 + xlk - HO);         // khoảng trống cho xà
            const hx = Math.min(nk.xa_cao, Math.floor(hi_ - lo_ + 1e-9));
            if (hx < 30 || hx < khe1 - khe0 - TOL) { thieu++; continue; }
            const z0 = q === m - 1 ? zb - hx : Math.max(lo_, Math.min(hi_ - hx, (khe0 + khe1) / 2 - hx / 2));
            P({ loai: 'XA', ten: NM.xa, than: c.than, tu: c.b.tu, type: 2, x0, x1: x0 + L, y0: ya, y1: ya + t, z0, z1: z0 + hx, big: 0, khoang: i, tren: q === m - 1 });
          }
          if (ya + t > shelfDepth) err(`${viTri}: thùng quá nông, không đủ chỗ đặt xà ngăn kéo.`);
          if (thieu) note(`${viTri}: ${thieu} khe mặt ngăn kéo không đủ chỗ đặt xà (loại "${lo.ten}": theo tham số mẫu, hộp ngăn kéo cao gần bằng mặt) — khe đó để hở. Muốn có xà: tăng khe hoặc khai SLK / XLK của loại này ở Chuẩn xưởng.`);
        }
        // Nẹp che khe: ván đứng ngang mặt ngăn kéo, bịt khe giữa hồi/vách và vách đệm (hẹp nên bắn đinh, không khoan cam).
        if (nk.nep_khe && dem - t >= 10) {
          const nep = (xa, xb) => P({ loai: 'NEP', ten: NM.nep, than: c.than, tu: c.b.tu, type: 2, x0: xa, x1: xb, y0: nk.lui - t, y1: nk.lui, z0: za, z1: zb, big: 0, fd: false, bd: false, khoan: KHONG_KHOAN, khoang: i });
          if (demL) nep(bayX(i), x0 - t);
          if (demR) nep(x0 + L + t, bayX(i) + widths[i]);
          if ((demL || demR) && k.canh > 0) note(`${viTri}: có nẹp che khe hai bên hộc ngăn kéo — bản lề của cánh KHÔNG đặt trong khoảng cao độ +${g(za)} … +${g(zb)} (đặt ngay trên đợt nóc hộc kéo), nếu không tay bản lề sẽ cấn vào nẹp.`);
        }
        continue;
      }
      // nk_trum — ngăn kéo trùm ngoài: mặt nằm ở mặt phẳng cánh, phủ lên mép đợt/đáy như cánh; khoang không có cánh ở vùng này nên không vướng bản lề
      const [dza, dzb] = doorZ(c.b);
      // đường chia giữa mặt ngăn kéo và cánh (hoặc mặt ngăn kéo ô kề) tại một đợt = tim đợt, làm tròn 1 mm để cánh và mặt ngăn kéo ra số chẵn
      const tim = z => Math.round(z + t / 2);
      const f0 = c.zDuoi === null ? dza : rn(tim(c.zDuoi) + khe / 2);       // mép dưới mặt dưới cùng
      const f1 = c.zTren === null ? dzb : rn(tim(c.zTren) - khe / 2);       // mép trên mặt trên cùng
      const hf = Math.floor((f1 - f0 - (m - 1) * khe) / m * 2 + 1e-9) / 2;       // mặt chẵn 0,5 mm
      const duF = rn(f1 - f0 - (m * hf + (m - 1) * khe));                        // phần dư: chia 0,5 mm cho các mặt dưới cùng (các mặt lệch nhau không quá 0,5)
      const n05 = Math.floor(duF / 0.5 + 1e-9), le = rn(duF - n05 * 0.5);
      const caoMat = q => rn(hf + (q < n05 ? 0.5 : 0) + (q === 0 ? le : 0));
      if (hf < 60) { err(`${viTri}: mặt ngăn kéo chỉ cao ${g(hf)} — giảm số ngăn hoặc nới ô.`); continue; }
      if (hopCao(lo, hf) < 40) { err(`${viTri}: mặt ngăn kéo cao ${g(hf)} thì hộp ngăn kéo chỉ còn ${g(hopCao(lo, hf))} (loại "${lo.ten}") — giảm số ngăn hoặc nới ô.`); continue; }
      if (hf > 450) warn(`${viTri}: mặt ngăn kéo cao ${g(hf)} (> 450) — nên thêm ngăn hoặc hạ đợt phía trên.`);
      const sauNK = Math.floor((shelfDepth - nk.ho_sau) / nk.buoc_sau + 1e-9) * nk.buoc_sau;
      if (sauNK < 200) { err(`${viTri}: thùng quá nông cho ngăn kéo (sâu hộp ${g(sauNK)}).`); continue; }
      const [fx0, fx1] = vungMat(i);
      if (fx1 - fx0 > 1200) { warn(`${viTri}: mặt ngăn kéo rộng ${g(fx1 - fx0)} (> 1200) — nên chia khoang nhỏ hơn.`); nkRongDaBao.add(i); }
      vungTrum.push({ khoang: i, b: c.b, f0, f1 });
      for (let q = 0, zq = f0; q < m; q++) {
        const fz0 = zq, fz1 = rn(fz0 + caoMat(q)); zq = rn(fz1 + khe);
        const bz0 = q === 0 ? za : rn(fz0 - khe / 2), bz1 = q === m - 1 ? zb : rn(fz1 + khe / 2);     // khe hộp: chia ô theo tim khe giữa 2 mặt
        M.mat_ngan_keo.push({ khoang: i, x: fx0, z: fz0, w: rn(fx1 - fx0), h: rn(fz1 - fz0), y: -tc, t: tc, trum: true });
        M.templates.push({ loai: 'NGAN_KEO', kieu: 'nk_trum', id: lo.mau_id, ten: lo.ten_mau, ma_loai: lo.ma, ten_loai: lo.ten, tu: c.b.tu, khoang: i,
          bac_sau: { tu: rn(shelfDepth - nk.ho_sau), buoc: nk.buoc_sau },
          box: [rn(widths[i]), sauNK, rn(bz1 - bz0)], pos: [bayX(i), 0, rn(bz0)],                      // gốc mẫu y = 0 → mặt nằm ở y = −dày cánh … 0 (mặt phẳng cánh)
          params: thamSo(lo, tc, rn(fz1 - fz0), { SYS: rn(fz1 - bz1), XYS: rn(bz0 - fz0), ZYS: rn(bayX(i) - fx0), YYS: rn(fx1 - bayX(i) - widths[i]) }) });
      }
    }

    for (const p of M.parts) if (p.loai === 'DOT' && p.dem_duoi && p.dem_tren)
      warn(`Khoang ${p.khoang + 1}: đợt +${g(p.z0)} nằm giữa 2 ô ngăn kéo âm — vách đệm che cả 2 mặt của đợt nên không vặn được cam của đợt này. Gộp 2 ô thành một (xoá đợt) hoặc đổi một ô sang ngăn kéo trùm ngoài.`);

    /* ---- cánh: mỗi cột cánh chia theo chiều cao, tránh vùng mặt ngăn kéo trùm ngoài ---- */
    bao.muc('canh');
    const caoCanh = new Set();
    for (const b of bodies) {
      const [za, zb] = doorZ(b);
      for (let i = 0; i < n; i++) {
        const cols = doorCols.filter(d => d.khoang === i); if (!cols.length) continue;
        const cam = vungTrum.filter(v => v.khoang === i && v.b === b).sort((u, v) => u.f0 - v.f0);
        const doan = []; let cur = za;
        for (const v of cam) { if (v.f0 - khe - cur > TOL) doan.push([cur, rn(v.f0 - khe)]); cur = rn(v.f1 + khe); }
        if (zb - cur > TOL) doan.push([cur, zb]);
        for (const [z0, z1] of doan) {
          if (z1 - z0 < 100) { err(`Khoang ${i + 1}: đoạn cánh +${g(z0)} … +${g(z1)} chỉ cao ${g(z1 - z0)} (< 100) — dời đợt hoặc đổi ô ngăn kéo trùm ngoài.`); continue; }
          if (z1 - z0 > s.van.kho_dai + TOL) { err(`Cánh cao ${g(z1 - z0)} > khổ ván ${g(s.van.kho_dai)}.`); continue; }
          caoCanh.add(rn(z1 - z0));
          for (const dc of cols) {
            const p = P({ loai: 'CANH', ten: dc.open === 2 ? NM.canh_phai : NM.canh_trai, than: b.code, tu: b.tu, type: 2, x0: dc.x, x1: dc.x + dc.w, y0: -tc, y1: 0, z0, z1,
              khoan: KHONG_KHOAN, big: 0, fd: false, bd: false, open: dc.open, khoang: dc.khoang });
            if (s.canh.chen_ban_le) {
              const ch = s.canh.chen, hh = z1 - z0, r = ch.d / 2;
              const soBL = hh <= 900 ? 2 : hh <= 1600 ? 3 : hh <= 2000 ? 4 : 5;
              const u = dc.open === 2 ? dc.w - ch.tam_mep : ch.tam_mep;
              const dau = Math.min(ch.cach_dau, hh / 4);
              for (let q = 0; q < soBL; q++) p.holes.push({ kieu: 'tron', u, v: rn(dau + q * (hh - 2 * dau) / (soBL - 1)), r, z: 0, sau: ch.sau });
            }
          }
        }
      }
    }
    for (const dc of doorCols) {
      if (dc.w > 600 && !dc._w) { dc._w = 1; warn(`Cánh rộng ${g(dc.w)} (> 600) ở khoang ${dc.khoang + 1}: dễ xệ, nên chia 2 cánh.`); }
      if (dc.w < 150 && !dc._n) { dc._n = 1; warn(`Cánh chỉ rộng ${g(dc.w)} ở khoang ${dc.khoang + 1}.`); }
    }
    M.info.canh = { rong: [...new Set(doorCols.map(d => rn(d.w)))], cao: [...caoCanh].sort((a, b) => b - a), so: M.parts.filter(p => p.loai === 'CANH').length };

    kiemSX(M, bao, nkRongDaBao);
    for (const f of kiemLienKet(M.parts)) {
      const p = M.parts[f.tam], o = `${p.ten} (${p.tu}${p.khoang >= 0 ? ', khoang ' + (p.khoang + 1) : ''})`;
      if (f.ma === 'thieu_do') bao.err(`${o} không tì vào tấm đứng nào ở đầu ${f.ben === 'trai' ? 'trái' : 'phải'} — tấm nằm thiếu chỗ đỡ.`, 'lien_ket');
      else if (THUNG.indexOf(p.loai) >= 0) bao.err(`${o} không áp vào tấm nào — tấm lơ lửng.`, 'lien_ket');
      else bao.warn(`${o} không áp vào tấm nào${p.loai === 'PHAO' ? ' (không có thanh phụ trợ đỡ phào)' : ''} — xưởng tự xử lý cách bắt tấm này.`, 'lien_ket');
    }
    checks(M, bao);
    M.info.hop = bbox(M.parts);
    M.info.so_tam = M.parts.length;
    M.info.kiem_xong = true;      // đã chạy hết các mục kiểm (phiếu: mục không có dòng báo nào là ĐẠT; dừng sớm thì là CHƯA KIỂM)
    return M;
  }

  /* ------------------------------------------------------------------ *
   * KIỂM TRA
   * ------------------------------------------------------------------ */
  function bbox(parts) {
    if (!parts.length) return null;
    const b = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
    for (const p of parts) { b.x0 = Math.min(b.x0, p.x0); b.y0 = Math.min(b.y0, p.y0); b.z0 = Math.min(b.z0, p.z0); b.x1 = Math.max(b.x1, p.x1); b.y1 = Math.max(b.y1, p.y1); b.z1 = Math.max(b.z1, p.z1); }
    for (const k in b) b[k] = rn(b[k]);
    return b;
  }

  function cutSize(p) {
    const d = [p.x1 - p.x0, p.y1 - p.y0, p.z1 - p.z0].map(v => rn(v, 2));
    const i = d.indexOf(Math.min(...d)); const rest = d.filter((_, j) => j !== i).sort((a, b) => b - a);
    return { dai: rest[0], rong: rest[1], day: d[i] };
  }

  function overlap(a, b) {
    const hop = (p, q) => { const dx = Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0), dy = Math.min(p.y1, q.y1) - Math.max(p.y0, q.y0), dz = Math.min(p.z1, q.z1) - Math.max(p.z0, q.z0); return (dx > TOL && dy > TOL && dz > TOL) ? dx * dy * dz : 0; };
    let v = hop(a, b);
    if (!v || !(a.khau || b.khau)) return v;
    // tấm khoét góc (khấu cột): phần đã khoét không còn ván → trừ khỏi thể tích chồng
    for (const [p, q] of [[a, b], [b, a]]) for (const k of (p.khau || [])) v -= hop({ x0: k.x0, x1: k.x1, y0: k.y0, y1: k.y1, z0: p.z0, z1: p.z1 }, q);
    return v > 1 ? v : 0;
  }

  const THUNG = ['HOI', 'VACH', 'DAY', 'NOC', 'DOT', 'DEM', 'XA', 'HAU'];      // tấm của thùng: lơ lửng là lỗi dựng, không phải chuyện xưởng tự xử lý

  /**
   * Tấm lơ lửng / tấm nằm thiếu chỗ tì (bản 1.20). Hàm thuần trên danh sách tấm { x0…z1, type, loai }.
   *  'lo_lung'  : tấm không áp MẶT vào tấm nào khác (mặt chung ≥ 100 mm²; chỉ chạm nhau theo một đường thì không tính) và cũng không ăn vào rãnh của tấm nào;
   *  'thieu_do' : tấm NẰM của thùng (đáy, nóc, đợt) mà đầu trái / phải không tì vào tấm nào.
   * @returns {{tam:number, ma:string, ben?:string}[]} tam = chỉ số trong `parts`
   */
  function kiemLienKet(parts) {
    const ra = [], truc = [['x0', 'x1'], ['y0', 'y1'], ['z0', 'z1']];
    const chong = (a, b, k) => Math.min(a[truc[k][1]], b[truc[k][1]]) - Math.max(a[truc[k][0]], b[truc[k][0]]);
    // diện tích mặt chung khi mặt LỚN theo trục k của a áp vào mặt NHỎ theo trục k của b
    const ap = (a, b, k) => { if (Math.abs(a[truc[k][1]] - b[truc[k][0]]) > TOL) return 0; const u = chong(a, b, (k + 1) % 3), v = chong(a, b, (k + 2) % 3); return u > TOL && v > TOL ? u * v : 0; };
    parts.forEach((p, i) => {
      let coMat = false, trai = false, phai = false;
      for (let j = 0; j < parts.length; j++) {
        if (j === i) continue; const q = parts[j];
        for (let k = 0; k < 3 && !coMat; k++) if (ap(p, q, k) >= 100 || ap(q, p, k) >= 100) coMat = true;
        if (!coMat && chong(p, q, 0) > TOL && chong(p, q, 1) > TOL && chong(p, q, 2) > TOL) coMat = true;      // ăn vào nhau (hậu mỏng nằm trong rãnh): có chỗ giữ — đè nhau sai thì mục "va chạm" báo
        if (ap(q, p, 0) > 0) trai = true;
        if (ap(p, q, 0) > 0) phai = true;
      }
      if (!coMat) { ra.push({ tam: i, ma: 'lo_lung' }); return; }
      if (p.type === 0 && (p.loai === 'DAY' || p.loai === 'NOC' || p.loai === 'DOT')) {
        if (!trai) ra.push({ tam: i, ma: 'thieu_do', ben: 'trai' });
        if (!phai) ra.push({ tam: i, ma: 'thieu_do', ben: 'phai' });
      }
    });
    return ra;
  }

  /** Quy tắc sản xuất theo ngưỡng s.kiem (bản 1.20) — đều là CẢNH BÁO: tủ vẫn vẽ được, xưởng quyết. */
  function kiemSX(M, bao, nkRongDaBao) {
    const s = M.spec, k = s.kiem;
    if (k.dot_max > 0) (M.info.khoang || []).forEach((w, i) => {
      if (w <= k.dot_max + TOL) return;
      const suot = (M.info.o || []).some(c => c.khoang === i && c.kieu === 'suot');
      bao.warn(`Khoang ${i + 1} lọt lòng ${g(w)} (> ${g(k.dot_max)}): đợt, đáy, nóc${suot ? ', suốt treo' : ''} dài dễ võng — thêm vách chia khoang.`, 'nhip');
    });
    if (k.canh_cao_max > 0) for (const h of [...new Set(M.parts.filter(p => p.loai === 'CANH').map(p => rn(p.z1 - p.z0)))].filter(h => h > k.canh_cao_max + TOL).sort((a, b) => b - a))
      bao.warn(`Cánh cao ${g(h)} (> ${g(k.canh_cao_max)}): dễ cong vênh — gắn thanh chống cong, hoặc đặt "cao thân dưới" để chia thân cho cánh ngắn lại.`, 'canh');
    if (k.nk_rong_max > 0) { const da = new Set(nkRongDaBao || []); for (const tp of M.templates) if (tp.loai === 'NGAN_KEO' && tp.box[0] > k.nk_rong_max + TOL && !da.has(tp.khoang)) { da.add(tp.khoang); bao.warn(`Khoang ${tp.khoang + 1}: hộp ngăn kéo rộng ${g(tp.box[0])} (> ${g(k.nk_rong_max)}) — ray và đáy ngăn kéo dễ võng; chia khoang nhỏ hơn.`, 'ngan_keo'); } }
    if (k.suot_sau_min > 0) { const da = new Set(); for (const tp of M.templates) if (tp.loai === 'SUOT' && tp.box[1] < k.suot_sau_min - TOL && !da.has(tp.khoang)) { da.add(tp.khoang); bao.warn(`Khoang ${tp.khoang + 1}: khoang treo chỉ sâu ${g(tp.box[1])} (< ${g(k.suot_sau_min)}) — móc áo treo ngang (≈ 450) sẽ chạm cánh hoặc hậu; tăng sâu thùng, hoặc treo dọc (suốt chạy trước – sau).`, 'suot'); } }
  }

  function checks(M, bao) {
    bao = bao || baoCua(M);
    const s = M.spec, parts = M.parts;
    // khổ ván
    for (const p of parts) {
      const c = cutSize(p);
      if (c.dai > s.van.kho_dai + TOL) bao.err(`${p.ten} (${p.tu}) dài ${g(c.dai)} > khổ ván ${g(s.van.kho_dai)}.`, 'kho_van');
      if (c.rong > s.van.kho_rong + TOL) bao.err(p.phu
        ? `${p.ten} (${p.tu}) rộng ${g(c.rong)} > khổ ván ${g(s.van.kho_rong)} — khoang quá rộng, không có vách để nối hậu: thêm vách (chia khoang nhỏ hơn).`
        : `${p.ten} (${p.tu}) rộng ${g(c.rong)} > khổ ván ${g(s.van.kho_rong)} — phải chia khoang nhỏ hơn.`, 'kho_van');
      if (Math.abs(c.day - p.t) > TOL) bao.err(`${p.ten}: cạnh nhỏ nhất ${g(c.day)} khác độ dày ${g(p.t)} (tấm quá hẹp).`, 'kho_van');
    }
    // va chạm (hậu mỏng ăn rãnh vào tấm bên cạnh là đúng cấu tạo)
    let n = 0;
    for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
      const a = parts[i], b = parts[j];
      const coRanh = q => q.holes && q.holes.some(h => h.kieu === 'ranh');
      if ((a.mong && coRanh(b)) || (b.mong && coRanh(a))) continue;
      const v = overlap(a, b);
      if (v > 0) { n++; if (n <= 8) bao.err(`Va chạm: ${a.ten} (${a.tu}) × ${b.ten} (${b.tu}) — ${Math.round(v)} mm³.`, 'va_cham'); }
    }
    if (n > 8) bao.err(`… và ${n - 8} va chạm khác.`, 'va_cham');
    // phủ bì
    const bb = bbox(parts);
    if (bb) {
      if (Math.abs(bb.x0) > TOL || Math.abs(bb.x1 - s.rong) > TOL) bao.warn(`Bề ngang thực tế ${g(bb.x0)}…${g(bb.x1)} khác phủ bì ${g(s.rong)}.`, 'kich_thuoc');
      if (Math.abs(bb.z1 - s.cao) > TOL) bao.warn(`Chiều cao thực tế ${g(bb.z1)} khác phủ bì ${g(s.cao)}.`, 'kich_thuoc');
    }
  }

  /* ------------------------------------------------------------------ *
   * DÒ LỖI TRÊN TẤM VÀ LỖ KHOAN THẬT (bản 1.20) — hàm thuần; driver đọc tấm / lỗ từ Chenfeng rồi đưa vào.
   * Hộp tấm = [x0, x1, y0, y1, z0, z1] trong một hệ trục mà các tấm nằm thẳng trục.
   * Quy ước lỗ đo trên Chenfeng 04/10/2026: p = miệng lỗ, d = hướng khoan vào ván (véc-tơ đơn vị), dai = chiều sâu, r = bán kính,
   * nhom = mã liên kết (một cam = 3 lỗ chung nhóm: chén Ø12 ở mặt tấm đực, thân Ø8 từ chén ra cạnh tấm đực, mồi Ø5 ở mặt tấm cái).
   * ------------------------------------------------------------------ */
  const chongHop = (p, q, k) => Math.min(p[2 * k + 1], q[2 * k + 1]) - Math.max(p[2 * k], q[2 * k]);
  const trucMong = hop => { const d = [hop[1] - hop[0], hop[3] - hop[2], hop[5] - hop[4]]; let k = 0; if (d[1] < d[k]) k = 1; if (d[2] < d[k]) k = 2; return k; };

  /** Diện tích phần chung giữa đa giác `bao` (lồi hoặc lõm, [[u, v]…]) và hình chữ nhật [u0, u1] × [v0, v1]: cắt đa giác lần lượt theo 4 cạnh chữ nhật (Sutherland–Hodgman) rồi tính diện tích. */
  function dienTichGiao(bao, u0, u1, v0, v1) {
    let P = bao;
    const cat = (trong, giao) => { const R = []; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], ta = trong(a), tb = trong(b); if (ta) R.push(a); if (ta !== tb) R.push(giao(a, b)); } P = R; };
    const gx = x => (a, b) => [x, a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])], gy = y => (a, b) => [a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]), y];
    cat(q => q[0] >= u0, gx(u0)); if (P.length) cat(q => q[0] <= u1, gx(u1)); if (P.length) cat(q => q[1] >= v0, gy(v0)); if (P.length) cat(q => q[1] <= v1, gy(v1));
    let dt = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; dt += a[0] * b[1] - b[0] * a[1]; }
    return Math.abs(dt) / 2;
  }

  /**
   * Va chạm giữa các tấm thật. tam = [{ hop, day, mau?, bao? }] — `mau` = mẫu (module) chứa tấm: hai tấm cùng mẫu không xét (mẫu tự chịu rãnh mộng bên trong nó).
   * `bao` = đường bao thật của tấm KHÔNG chữ nhật (khoét góc khấu cột, cắt góc, bo cong — cung đã chia thành đoạn thẳng), toạ độ theo hai trục nằm trong mặt tấm
   * (trục mỏng k → [trục (k+1)%3, trục (k+2)%3]): phần hộp chồng nhau mà rơi vào chỗ đã khoét thì không phải va chạm.
   * Tấm mỏng (≤ 9,5) ăn vào tấm khác không sâu quá 9 là rãnh hậu / rãnh đáy ngăn kéo — đúng cấu tạo.
   * Hai tấm TRÙNG KHÍT (chép đè lên nhau, lệch không quá `trung`) thì luôn báo, kể cả cùng mẫu: bảng cắt sẽ ra thừa một tấm.
   * @returns {{a:number, b:number, chong:number[], trung?:true}[]} chong = bề chồng theo x, y, z
   */
  function kiemVaCham(tam, opt) {
    opt = Object.assign({ mong: 9.5, ranh: 9, trung: 0.1, dt_min: 0.5 }, opt || {});
    const ra = [];
    for (let i = 0; i < tam.length; i++) for (let j = i + 1; j < tam.length; j++) {
      const a = tam[i], b = tam[j];
      const d = [chongHop(a.hop, b.hop, 0), chongHop(a.hop, b.hop, 1), chongHop(a.hop, b.hop, 2)];
      if (d[0] <= TOL || d[1] <= TOL || d[2] <= TOL) continue;
      const trung = a.hop.every((v, k) => Math.abs(v - b.hop[k]) <= opt.trung);
      if (!trung) {
        if (a.mau !== undefined && a.mau !== null && a.mau === b.mau) continue;
        const m = a.day <= b.day ? a : b;
        if (m.day <= opt.mong) { const k = trucMong(m.hop); if (Math.min(d[(k + 1) % 3], d[(k + 2) % 3]) <= opt.ranh + TOL) continue; }      // độ sâu ăn vào = bề chồng nhỏ nhất trong mặt phẳng của tấm mỏng
      }
      if (!trung && [a, b].some(t => {      // phần chồng nằm trọn ngoài đường bao thật của một trong hai tấm (góc đã khoét, góc đã bo)
        if (!t.bao || t.bao.length < 3) return false;
        const k = trucMong(t.hop), u = (k + 1) % 3, v = (k + 2) % 3;
        return dienTichGiao(t.bao, Math.max(a.hop[2 * u], b.hop[2 * u]), Math.min(a.hop[2 * u + 1], b.hop[2 * u + 1]), Math.max(a.hop[2 * v], b.hop[2 * v]), Math.min(a.hop[2 * v + 1], b.hop[2 * v + 1])) <= opt.dt_min;
      })) continue;
      const q = { a: i, b: j, chong: d.map(v => rn(v, 2)) };
      if (trung) q.trung = true;
      ra.push(q);
    }
    return ra;
  }

  /** Điểm gần nhất của một hình trụ đặc (trục p → p + d·dai, bán kính r) tới điểm x. */
  function chieuTru(x, h) {
    const w = [x[0] - h.p[0], x[1] - h.p[1], x[2] - h.p[2]], t0 = w[0] * h.d[0] + w[1] * h.d[1] + w[2] * h.d[2], t = Math.max(0, Math.min(h.dai, t0));
    const v = [w[0] - t0 * h.d[0], w[1] - t0 * h.d[1], w[2] - t0 * h.d[2]], lv = Math.hypot(v[0], v[1], v[2]), s = lv > h.r ? h.r / lv : 1;
    return [h.p[0] + t * h.d[0] + v[0] * s, h.p[1] + t * h.d[1] + v[1] * s, h.p[2] + t * h.d[2] + v[2] * s];
  }

  /**
   * Lỗ khoan giao nhau: hai lỗ KHÁC nhóm cắt vào nhau. Không tính: lỗ cùng nhóm (chén – thân – mồi của một cam), hai lỗ ĐỒNG TRỤC
   * (hai nửa của một lỗ xuyên — Chenfeng khoan từ hai mặt của vách), hai mép lỗ chỉ vừa sát nhau (hở dưới 0,05).
   * @returns {{a:number, b:number, kieu:'song_song'|'cat_nhau', cach:number}[]} a < b = chỉ số trong `lo`; cach = khoảng cách giữa hai trục lỗ
   */
  function kiemLoGiao(lo, opt) {
    opt = Object.assign({ ho: 0.05 }, opt || {});
    const ho = opt.ho, ra = [];
    const H = lo.map((h, i) => {
      const q = [h.p[0] + h.d[0] * h.dai, h.p[1] + h.d[1] * h.dai, h.p[2] + h.d[2] * h.dai], bb = [];
      for (let k = 0; k < 3; k++) { const e = h.r * Math.sqrt(Math.max(0, 1 - h.d[k] * h.d[k])); bb.push(Math.min(h.p[k], q[k]) - e, Math.max(h.p[k], q[k]) + e); }
      return { i, h, bb };
    }).sort((a, b) => a.bb[0] - b.bb[0]);
    for (let u = 0; u < H.length; u++) for (let v = u + 1; v < H.length && H[v].bb[0] < H[u].bb[1] - ho; v++) {      // quét theo trục x: chỉ xét cặp có hộp bao chồng nhau
      const A = H[u].h, B = H[v].h;
      if (A.nhom !== undefined && A.nhom !== null && A.nhom === B.nhom) continue;
      if (chongHop(H[u].bb, H[v].bb, 1) <= ho || chongHop(H[u].bb, H[v].bb, 2) <= ho) continue;
      const w = [B.p[0] - A.p[0], B.p[1] - A.p[1], B.p[2] - A.p[2]], dot = A.d[0] * B.d[0] + A.d[1] * B.d[1] + A.d[2] * B.d[2];
      let kq = null;
      if (Math.abs(Math.abs(dot) - 1) < 1e-6) {
        const t = w[0] * A.d[0] + w[1] * A.d[1] + w[2] * A.d[2], cach = Math.hypot(w[0] - t * A.d[0], w[1] - t * A.d[1], w[2] - t * A.d[2]);
        if (cach < ho) continue;                                                  // đồng trục: lỗ xuyên khoan từ hai mặt
        const b0 = t, b1 = t + (dot > 0 ? B.dai : -B.dai);                         // lỗ B chiếu lên trục A
        if (cach < A.r + B.r - ho && Math.min(A.dai, Math.max(b0, b1)) - Math.max(0, Math.min(b0, b1)) > ho) kq = { kieu: 'song_song', cach: rn(cach, 2) };
      } else {
        // hai hình trụ lồi: chiếu luân phiên giữa hai trụ (đã thu nhỏ nửa khe hở) — có điểm chung thì hai hình chiếu hội tụ về một điểm
        const a = { p: A.p, d: A.d, dai: A.dai, r: Math.max(0, A.r - ho / 2) }, b = { p: B.p, d: B.d, dai: B.dai, r: Math.max(0, B.r - ho / 2) };
        let x = [(A.p[0] + B.p[0]) / 2, (A.p[1] + B.p[1]) / 2, (A.p[2] + B.p[2]) / 2], kc = Infinity;
        for (let n = 0; n < 120 && kc > 1e-4; n++) { const xa = chieuTru(x, a), xb = chieuTru(xa, b); kc = Math.hypot(xa[0] - xb[0], xa[1] - xb[1], xa[2] - xb[2]); x = xb; }
        if (kc < 0.01) {
          const c = [A.d[1] * B.d[2] - A.d[2] * B.d[1], A.d[2] * B.d[0] - A.d[0] * B.d[2], A.d[0] * B.d[1] - A.d[1] * B.d[0]], lc = Math.hypot(c[0], c[1], c[2]);
          kq = { kieu: 'cat_nhau', cach: rn(Math.abs(w[0] * c[0] + w[1] * c[1] + w[2] * c[2]) / lc, 2) };
        }
      }
      if (kq) ra.push({ a: Math.min(H[u].i, H[v].i), b: Math.max(H[u].i, H[v].i), kieu: kq.kieu, cach: kq.cach });
    }
    return ra.sort((p, q) => p.a - q.a || p.b - q.b);
  }

  /**
   * Mối nối không có liên kết: CẠNH tấm đực tì trọn bề dày lên MẶT tấm cái trên một đoạn dài từ `dai_min` trở lên, cả hai tấm đều có kiểu khoan,
   * mà không có nhóm lỗ nào nối hai tấm. Mối nối ngắn hơn (xà, nẹp) coi là bắn đinh / bắt vít; cạnh chỉ tì một phần bề dày (xà chân tì nửa chân vách) không tính;
   * hai tấm áp mặt vào nhau (2 hồi áp lưng) không phải mối nối cạnh – mặt.
   * Tấm đực đã có liên kết ở HAI CẠNH ĐỐI NHAU (đợt bắt cam hai đầu, vách bắt nóc và đáy) là đã được giữ: các cạnh còn lại của nó tì lên tấm khác
   * (mép sau đợt tì lên hậu dày) không cần liên kết — đo trên mẫu kho thật 04/10/2026.
   * tam = [{ hop, khoan, bao? }], lo = [{ cai, duc }] (chỉ số tấm cái / tấm đực của từng lỗ); bao = đường bao thật của tấm không chữ nhật (xem kiemVaCham).
   * @returns {{duc:number, cai:number, dai:number}[]}
   */
  function kiemMoiNoi(tam, lo, opt) {
    opt = Object.assign({ dai_min: 100, thieu: 0.6 }, opt || {});
    const noi = new Set((lo || []).map(h => h.cai + '>' + h.duc));
    const B = tam.map(t => { const k = trucMong(t.hop); return { hop: t.hop, k, day: t.hop[2 * k + 1] - t.hop[2 * k], khoan: t.khoan !== false, bao: t.bao && t.bao.length >= 3 ? t.bao : null }; });
    // tấm đực nào đã được giữ ở hai cạnh đối nhau: mỗi liên kết nằm ở đầu nào của tấm đực (theo trục mỏng của tấm cái)
    const dau = new Map();
    for (const kx of noi) {
      const c = +kx.split('>')[0], d = +kx.split('>')[1], b = B[c], a = B[d];
      if (!a || !b || c === d || a.k === b.k) continue;
      const k = b.k, ben = Math.abs(a.hop[2 * k] - b.hop[2 * k + 1]) <= 1 ? 0 : Math.abs(a.hop[2 * k + 1] - b.hop[2 * k]) <= 1 ? 1 : -1;
      if (ben >= 0) { if (!dau.has(d)) dau.set(d, new Set()); dau.get(d).add(k * 2 + ben); }
    }
    const daGiu = i => { const s = dau.get(i); return !!s && [0, 1, 2].some(k => s.has(k * 2) && s.has(k * 2 + 1)); };
    const ra = [];
    for (let i = 0; i < B.length; i++) for (let j = 0; j < B.length; j++) {      // i = tấm đực (cạnh), j = tấm cái (mặt)
      const a = B[i], b = B[j];
      if (i === j || !a.khoan || !b.khoan || a.k === b.k || daGiu(i)) continue;
      const k = b.k;
      if (Math.abs(a.hop[2 * k + 1] - b.hop[2 * k]) > TOL && Math.abs(a.hop[2 * k] - b.hop[2 * k + 1]) > TOL) continue;
      const u = (k + 1) % 3, v = (k + 2) % 3, ou = chongHop(a.hop, b.hop, u), ov = chongHop(a.hop, b.hop, v);
      if (ou <= TOL || ov <= TOL) continue;
      const day = a.k === u ? ou : ov;
      let dai = a.k === u ? ov : ou;
      if (day < a.day - opt.thieu) continue;
      // tấm cái khoét góc / bo cong: chỉ tính đoạn cạnh tì lên chỗ CÒN VÁN (diện tích tì thật ÷ bề dày tấm đực)
      if (b.bao) dai = dienTichGiao(b.bao, Math.max(a.hop[2 * u], b.hop[2 * u]), Math.min(a.hop[2 * u + 1], b.hop[2 * u + 1]), Math.max(a.hop[2 * v], b.hop[2 * v]), Math.min(a.hop[2 * v + 1], b.hop[2 * v + 1])) / day;
      if (dai < opt.dai_min - TOL) continue;
      if (!noi.has(j + '>' + i)) ra.push({ duc: i, cai: j, dai: rn(dai, 1) });
    }
    return ra;
  }

  /** Đoạn trục lỗ (miệng p → đáy p + d·dai) nằm trong hộp tấm đã nới `tol`: trả [t0, t1] ⊂ [0, dai], hoặc null nếu trục lỗ không đi qua hộp. */
  function doanTrong(hop, h, tol) {
    let t0 = 0, t1 = h.dai;
    for (let k = 0; k < 3; k++) {
      const a0 = hop[2 * k] - tol, a1 = hop[2 * k + 1] + tol, p = h.p[k], d = h.d[k];
      if (Math.abs(d) < 1e-9) { if (p < a0 || p > a1) return null; continue; }
      let u = (a0 - p) / d, v = (a1 - p) / d; if (u > v) { const x = u; u = v; v = x; }
      if (u > t0) t0 = u; if (v < t1) t1 = v;
      if (t0 > t1) return null;
    }
    return [t0, t1];
  }
  const tronTrong = (hop, h, tol) => { const q = doanTrong(hop, h, tol); return !!q && q[0] <= 1e-6 && q[1] >= h.dai - 1e-6; };

  /**
   * Lỗ khoan lệch khỏi tấm và lỗ khoan thủng tấm. tam = [{ hop }], lo = [{ p, d, dai, r, nhom, cai, duc }] (cùng một hệ trục).
   *  'ngoai' — lỗ không nằm gọn trong tấm cái lẫn tấm đực của nó: tấm đã bị dời / đổi kích thước mà chưa khoan lại. Chỉ phán khi cả hai tấm đều nằm trong phạm vi kiểm.
   *  'thung' — lỗ của một liên kết nhiều lỗ (cam) khoan theo bề dày tấm mà sâu tới mức chỉ còn dưới `con` mm ván (hoặc xuyên hẳn) — vd chén cam sâu 13,5 trên ván 12.
   *            Không tính lỗ xuyên CÓ CHỦ Ý: lỗ đơn lẻ (tay nắm, lỗ luồn dây) và lỗ mà ở mặt bên kia có lỗ đồng trục đón tiếp (lỗ mồi khoan từ hai mặt vách; lỗ vít xuyên thành rồi ăn vào cạnh tấm kia).
   * @returns {{lo:number, ma:'ngoai'|'thung', tam?:number}[]} lo = chỉ số lỗ; tam = tấm bị thủng
   */
  function kiemLoLech(tam, lo, opt) {
    opt = Object.assign({ tol: 0.6, con: 1 }, opt || {});
    const dem = new Map(); for (const h of lo) dem.set(h.nhom, (dem.get(h.nhom) || 0) + 1);
    // có lỗ khác đồng trục phủ qua điểm x (điểm lỗ h chui ra ở mặt bên kia của tấm) không
    const coDon = (h, x) => lo.some(o => {
      if (o === h || Math.abs(Math.abs(o.d[0] * h.d[0] + o.d[1] * h.d[1] + o.d[2] * h.d[2]) - 1) > 1e-6) return false;
      const w = [x[0] - o.p[0], x[1] - o.p[1], x[2] - o.p[2]], t = w[0] * o.d[0] + w[1] * o.d[1] + w[2] * o.d[2];
      return Math.hypot(w[0] - t * o.d[0], w[1] - t * o.d[1], w[2] - t * o.d[2]) < 0.1 && t >= -opt.tol && t <= o.dai + opt.tol;
    });
    const ra = [];
    lo.forEach((h, i) => {
      const ung = []; for (const j of [h.cai, h.duc]) if (j >= 0 && tam[j] && ung.indexOf(j) < 0) ung.push(j);
      let trong = false, thung = -1;
      for (const j of ung) {
        const hop = tam[j].hop, q = doanTrong(hop, h, opt.tol);
        if (!q || q[0] > 1e-6) continue;                                         // miệng lỗ không nằm trên tấm này
        const k = trucMong(hop), day = hop[2 * k + 1] - hop[2 * k], het = q[1] >= h.dai - 1e-6;
        if (Math.abs(h.d[k]) > 0.99 && (!het || h.dai > day - opt.con)) {         // khoan theo bề dày, sâu gần hết hoặc quá bề dày tấm
          const ra_ = h.d[k] > 0 ? hop[2 * k + 1] : hop[2 * k], x = h.p.slice(); x[k] = ra_;
          if ((dem.get(h.nhom) || 0) > 1 && !coDon(h, x)) thung = j;
          trong = true; break;
        }
        if (het) { trong = true; break; }
      }
      if (thung >= 0) ra.push({ lo: i, ma: 'thung', tam: thung });
      else if (!trong && h.cai >= 0 && h.duc >= 0 && tam[h.cai] && tam[h.duc]) ra.push({ lo: i, ma: 'ngoai' });
    });
    return ra;
  }

  /** Các mục của phiếu dò lỗi trên tấm thật (sau khi vẽ, hoặc dò các tấm đang chọn). */
  const MUC_VE = [
    { ma: 'vc_that', ten: 'Tấm thật không đè, không trùng lên nhau' },
    { ma: 'lo_giao', ten: 'Lỗ khoan không giao nhau' },
    { ma: 'lo_lech', ten: 'Lỗ khoan nằm gọn trong tấm (không lệch, không thủng)' },
    { ma: 'kieu_khoan', ten: 'Kiểu khoan có trong cấu hình của tài khoản' },
    { ma: 'khong_lo', ten: 'Tấm cần khoan đều có lỗ' },
    { ma: 'moi_noi', ten: 'Mối nối dài đều có liên kết' },
    { ma: 'kho_van_that', ten: 'Tấm thật vừa khổ ván' },
    { ma: 'lo_lung_that', ten: 'Không tấm có kiểu khoan nào đứng riêng lẻ' },
    { ma: 'ten_tu', ten: 'Tấm nào cũng có tên tủ' },
  ];

  /**
   * Phiếu dò lỗi sản xuất trên tấm và lỗ khoan THẬT (bản 1.20). Hàm thuần — driver đọc bản vẽ rồi đưa vào:
   *   dl.tam     = [{ ten, tu, hop, day, khoan, kieu:[tên kiểu khoan của các cạnh], mau, kich:[dài, rộng], he, vl }]   (he = nhóm hướng: chỉ so hộp các tấm cùng nhóm; vl = vật liệu đã khai, '' = chưa khai)
   *   dl.lo      = [{ p, d, dai, r, nhom, cai, duc }]   (toạ độ bản vẽ; cai / duc = chỉ số tấm cái / tấm đực trong dl.tam, −1 nếu tấm đó nằm ngoài phạm vi kiểm)
   *   dl.goc_he  = góc (độ, quanh trục Z) của từng nhóm hướng so với trục bản vẽ — hộp tấm của nhóm nằm trong hệ trục đã xoay ngược góc này, nên lỗ cũng phải xoay theo trước khi so với hộp
   *   dl.tam[i].bao = đường bao thật của tấm không chữ nhật (xem kiemVaCham) · dl.cong = số tấm uốn cong đã bỏ ra
   *   dl.kieu_co = tên các kiểu khoan trong cấu hình tài khoản (null = không đọc được) · dl.kho = { dai, rong } · dl.lech = số tấm nằm nghiêng đã bỏ ra
   * LỖI (không sản xuất được): tấm đè / trùng nhau, lỗ giao nhau, lỗ lệch khỏi tấm hoặc khoan thủng tấm, kiểu khoan lạ, tấm vượt khổ.
   * LƯU Ý (xưởng xem lại): tấm không lỗ, mối nối dài không liên kết, tấm đứng riêng, tấm chưa có tên tủ. GHI CHÚ: tấm hẹp dưới `hep`, tấm chưa khai vật liệu.
   * Tấm mỏng hơn `day_min` (hậu, đáy ngăn kéo) không bắt cam nên không xét ở hai mục lỗ / mối nối.
   */
  function doLoiThat(dl, opt) {
    opt = Object.assign({ day_min: 12, toi_da: 8, hep: 50 }, opt || {});
    const tam = dl.tam || [], lo = dl.lo || [], kq = {}, ghi = [];
    MUC_VE.forEach(m => { kq[m.ma] = { loi: [], luu_y: [], ket: '' }; });
    const ten = i => `“${tam[i].ten}”${tam[i].tu ? ' (' + tam[i].tu + ')' : ''}`;
    const du = t => t.day >= opt.day_min;
    const cat = ds => (ds.length > opt.toi_da ? ds.slice(0, opt.toi_da).concat([`… và ${ds.length - opt.toi_da} chỗ khác.`]) : ds);
    const he = [...new Set(tam.map(t => t.he || 0))];
    if (he.length > 1) ghi.push(`Các tấm nằm theo ${he.length} hướng khác nhau: mỗi hướng được kiểm riêng, bảng không so tấm của hướng này với tấm của hướng kia.`);
    if (dl.lech > 0) ghi.push(`${dl.lech} tấm nằm nghiêng (không thẳng trục với tủ) — bảng không kiểm được va chạm và mối nối của các tấm này.`);
    if (dl.cong > 0) ghi.push(`${dl.cong} tấm uốn cong (bo cong theo đường dẫn) — bảng không kiểm được va chạm và mối nối của các tấm này.`);
    let cungMau = 0, khacHe = 0;
    const lechTam = new Map(), thungTam = new Map(), them = (M, k, v) => { if (!M.has(k)) M.set(k, []); M.get(k).push(v); };
    const heCua = i => (i >= 0 && tam[i] ? (tam[i].he || 0) : null);
    for (const x of lo) { const a = heCua(x.cai), b = heCua(x.duc); if (a !== null && b !== null && a !== b) khacHe++; }
    for (const h of he) {
      const ix = [], vt = new Map(); tam.forEach((t, i) => { if ((t.he || 0) === h) { vt.set(i, ix.length); ix.push(i); } });
      const sub = ix.map(i => tam[i]);
      const vc = kiemVaCham(sub);
      for (const c of vc) kq.vc_that.loi.push(c.trung
        ? `${ten(ix[c.a])} và ${ten(ix[c.b])} trùng khít lên nhau (chép đè) — xoá bớt một tấm, không thì bảng cắt thừa một tấm.`
        : `${ten(ix[c.a])} × ${ten(ix[c.b])}: chồng nhau ${c.chong.map(g).join(' × ')}.`);
      // lỗ lệch khỏi tấm / khoan thủng tấm: đưa lỗ về hệ trục của nhóm hướng rồi so với hộp tấm
      const a = -((dl.goc_he && dl.goc_he[h]) || 0) * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a), q = v => (a ? [v[0] * cs - v[1] * sn, v[0] * sn + v[1] * cs, v[2]] : v);
      const loH = [];
      for (const x of lo) {
        const hc = heCua(x.cai), hd = heCua(x.duc);
        if ((hc !== null && hc !== h) || (hd !== null && hd !== h) || (hc === null && hd === null)) continue;
        loH.push({ p: q(x.p), d: q(x.d), dai: x.dai, r: x.r, nhom: x.nhom, cai: hc === null ? -1 : vt.get(x.cai), duc: hd === null ? -1 : vt.get(x.duc) });
      }
      const theoNhom = new Map(); loH.forEach(x => them(theoNhom, x.nhom, x));
      for (const f of kiemLoLech(sub, loH)) {
        const x = loH[f.lo];
        if (f.ma === 'thung') { them(thungTam, ix[f.tam] + '|' + g(x.dai), x); continue; }
        // lỗ lệch là của tấm nào: trong cùng một liên kết, tấm còn giữ được lỗ của nó là tấm đứng yên → lỗ lệch thuộc tấm kia
        const ban = (theoNhom.get(x.nhom) || []).filter(o => o !== x && o.cai === x.cai && o.duc === x.duc);
        const giuC = ban.some(o => tronTrong(sub[x.cai].hop, o, 0.6)), giuD = ban.some(o => tronTrong(sub[x.duc].hop, o, 0.6));
        them(lechTam, giuC && !giuD ? String(ix[x.duc]) : giuD && !giuC ? String(ix[x.cai]) : ix[x.cai] + '+' + ix[x.duc], x);
      }
      cungMau += kiemVaCham(sub.map(t => ({ hop: t.hop, day: t.day, bao: t.bao }))).length - vc.length;
      const noi = []; for (const x of lo) { const c = vt.get(x.cai), d = vt.get(x.duc); if (c !== undefined && d !== undefined) noi.push({ cai: c, duc: d }); }
      for (const m of kiemMoiNoi(sub.map(t => ({ hop: t.hop, khoan: !!t.khoan && du(t), bao: t.bao })), noi)) kq.moi_noi.luu_y.push(`${ten(ix[m.duc])} tì cạnh lên ${ten(ix[m.cai])} dài ${g(m.dai)} mà không có liên kết nào — bổ sung cam hoặc vít.`);
      if (tam.length > 1) for (const f of kiemLienKet(sub.map(t => ({ x0: t.hop[0], x1: t.hop[1], y0: t.hop[2], y1: t.hop[3], z0: t.hop[4], z1: t.hop[5] })))) if (f.ma === 'lo_lung' && sub[f.tam].khoan) kq.lo_lung_that.luu_y.push(`${ten(ix[f.tam])} có kiểu khoan mà không áp vào tấm nào trong các tấm đang kiểm — tấm bị bỏ quên hoặc đặt lệch.`);      // tấm không khoan (cánh treo bản lề, nẹp bắn đinh) hở các tấm khác là chuyện thường
    }
    if (cungMau > 0) ghi.push(`${cungMau} chỗ tấm ăn vào nhau trong cùng một module (rãnh, mộng của mẫu) — bảng không coi là va chạm.`);
    if (khacHe > 0) ghi.push(`${khacHe} lỗ nối hai tấm nằm khác hướng nhau — bảng không kiểm được vị trí các lỗ này.`);
    for (const [k, ds] of lechTam) {
      const i = k.split('+').map(Number);
      kq.lo_lech.loi.push(i.length === 1
        ? `${ds.length} lỗ khoan của ${ten(i[0])} nằm ngoài tấm — tấm đã bị dời hoặc đổi kích thước mà chưa khoan lại: khoan lại tấm này (và tấm bắt với nó).`
        : `${ds.length} lỗ của mối nối ${ten(i[0])} ← ${ten(i[1])} không nằm gọn trong tấm nào — khoan lại hai tấm này.`);
    }
    for (const [k, ds] of thungTam) { const i = +k.split('|')[0]; kq.lo_lech.loi.push(`${ds.length} lỗ sâu ${g(ds[0].dai)} khoan thủng ${ten(i)} dày ${g(tam[i].day)} — ván quá mỏng cho kiểu liên kết này.`); }
    // lỗ giao nhau
    const duong = h => 'Ø' + g(rn(h.r * 2, 1)), tenT = i => (i >= 0 && tam[i] ? tam[i].ten : '?'), cua = h => `${tenT(h.cai)} ← ${tenT(h.duc)}`;
    for (const c of kiemLoGiao(lo)) { const a = lo[c.a], b = lo[c.b]; kq.lo_giao.loi.push(`Lỗ ${duong(a)} (${cua(a)}) cắt lỗ ${duong(b)} (${cua(b)}) — hai trục cách nhau ${g(c.cach)}, tại x ${g(rn(a.p[0], 1))} · y ${g(rn(a.p[1], 1))} · z ${g(rn(a.p[2], 1))}.`); }
    // kiểu khoan lạ
    if (!Array.isArray(dl.kieu_co)) kq.kieu_khoan.ket = 'chua';
    else {
      const la = {}; tam.forEach((t, i) => { for (const k of new Set(t.kieu || [])) if (k && k !== KHONG_KHOAN && dl.kieu_co.indexOf(k) < 0) (la[k] = la[k] || []).push(i); });
      for (const k of Object.keys(la)) kq.kieu_khoan.loi.push(`${la[k].length} tấm mang kiểu khoan “${k}” không có trong cấu hình khoan của tài khoản (đang có: ${dl.kieu_co.join(', ') || 'chưa có kiểu nào'}) — Chenfeng sẽ không khoan các tấm này: ${la[k].slice(0, 4).map(ten).join(', ')}${la[k].length > 4 ? '…' : ''}.`);
    }
    // tấm cần khoan mà không có lỗ
    const coLo = new Set(); for (const h of lo) { if (h.cai >= 0) coLo.add(h.cai); if (h.duc >= 0) coLo.add(h.duc); }
    const kl = []; tam.forEach((t, i) => { if (t.khoan && du(t) && !coLo.has(i)) kl.push(i); });
    if (kl.length) kq.khong_lo.luu_y.push(`${kl.length} tấm có kiểu khoan mà không có lỗ nào: ${kl.slice(0, 6).map(ten).join(', ')}${kl.length > 6 ? '…' : ''}.`);
    // khổ ván
    if (dl.kho && dl.kho.dai > 0 && dl.kho.rong > 0) tam.forEach((t, i) => { if (!t.kich) return; const a = Math.max(t.kich[0], t.kich[1]), b = Math.min(t.kich[0], t.kich[1]); if (a > dl.kho.dai + TOL || b > dl.kho.rong + TOL) kq.kho_van_that.loi.push(`${ten(i)} ${g(a)} × ${g(b)} vượt khổ ván ${g(dl.kho.dai)} × ${g(dl.kho.rong)}.`); });
    else kq.kho_van_that.ket = 'chua';
    if (tam.length <= 1) kq.lo_lung_that.ket = 'khong';
    // tên tủ, tấm hẹp, vật liệu
    const ke = (ds, n) => ds.slice(0, n).map(ten).join(', ') + (ds.length > n ? '…' : '');
    const kt = []; tam.forEach((t, i) => { if (!String(t.tu || '').trim()) kt.push(i); });
    if (kt.length) kq.ten_tu.luu_y.push(`${kt.length} tấm chưa có tên tủ: ${ke(kt, 6)} — tem tấm và bảng cắt sẽ không biết tấm của tủ nào.`);
    const hp = []; tam.forEach((t, i) => { if (t.kich && Math.min(t.kich[0], t.kich[1]) < opt.hep - TOL) hp.push(i); });
    if (hp.length) ghi.push(`${hp.length} tấm hẹp dưới ${g(opt.hep)}: ${ke(hp, 4)} — máy CNC khó giữ tấm nhỏ, thường phải cắt tay.`);
    const kv = []; tam.forEach((t, i) => { if (t.vl !== undefined && t.vl !== null && !String(t.vl).trim()) kv.push(i); });
    if (kv.length) ghi.push(`${kv.length} tấm chưa khai vật liệu — chọn vật liệu cho tấm trong Chenfeng trước khi xuất bảng cắt.`);
    const muc = MUC_VE.map(m => { const q = kq[m.ma]; return { ma: m.ma, ten: m.ten, ket: q.ket || (q.loi.length ? 'loi' : q.luu_y.length ? 'luu_y' : 'dat'), tin: cat(q.loi.concat(q.luu_y)) }; });
    const dem = { dat: 0, luu_y: 0, loi: 0, chua: 0 };
    for (const m of muc) if (m.ket in dem) dem[m.ket]++;
    return { ok: dem.loi === 0, so_tam: tam.length, so_lo: lo.length, muc, dem, ghi };
  }

  /* ------------------------------------------------------------------ *
   * ĐỔ MÀU (bản 1.21 — anh Jason 04/10/2026 09:08: "chọn một tủ: phần thùng một màu riêng, cánh tủ và phào tủ một màu … liệt kê các màu của mình, cho tìm kiếm và thay thế").
   * Hàm thuần: chia tấm thành nhóm màu, lọc danh sách màu. Việc đọc kho vật liệu của tài khoản và gán màu cho tấm thật nằm ở driver (D.khoVatLieu, D.doMauTu…).
   * ------------------------------------------------------------------ */
  // Nhận nhóm theo TÊN tấm: tên bảng đặt (ten_tam), tên tiếng Việt đã dịch của mẫu kho (driver TEN_TAM) và tên gốc tiếng Trung.
  const RE_MAU_HAU = /^Hậu(?! ngăn kéo| khấu)|背板/, RE_MAU_HOP_NK = /抽|ngăn kéo/i;
  const RE_MAU_MAT = /^(Cánh|Phào|Diềm|Cột La Mã|Chân trước|Xà chân(?! sau)|Mặt ngăn kéo|Mặt bàn|Tấm ốp|Tấm bịt|Tấm trang trí|Nẹp bù|Nẹp$|Nẹp \(|Lam$|Lam \()|门板|假门|抽面|顶线|楣板|罗马柱|前地脚|地脚线|踢脚板|见光板|收口|封板|格栅|装饰板|护墙板|墙板|台面|桌面/;
  const RE_MAU_CANH = /^Cánh|门板|假门/, RE_MAU_MAT_NK = /^Mặt ngăn kéo|抽面/;
  /**
   * Chia tấm của tủ thành nhóm màu. ds = [{ ten, hop?, he? }] (hop = [x0, x1, y0, y1, z0, z1] trong hệ trục của nhóm hướng `he`, như D.docThat).
   *   'mat'   = phần nhìn thấy ở mặt tủ: cánh, phào, xà chân trước, mặt ngăn kéo lộ ngoài, tấm ốp / nẹp bù / tấm bịt, lam, tấm trang trí, mặt bàn;
   *   'hau'   = hậu (mặc định đổ cùng màu thùng);
   *   'thung' = còn lại: hồi, vách, nóc, đáy, đợt, xà, vách đệm, phụ trợ phào, hộp ngăn kéo… và mọi tấm tên lạ.
   * Mặt ngăn kéo nằm SAU một cánh (ngăn kéo âm: cánh cùng hướng che từ nửa diện tích trở lên) là thùng — đóng cánh thì không ai thấy.
   * @returns {('thung'|'mat'|'hau')[]} cùng thứ tự với ds
   */
  function nhomMau(ds) {
    const ra = (ds || []).map(t => { const ten = String((t && t.ten) || ''); return RE_MAU_HAU.test(ten) && !RE_MAU_HOP_NK.test(ten) ? 'hau' : RE_MAU_MAT.test(ten) ? 'mat' : 'thung'; });
    const canh = []; (ds || []).forEach(t => { if (t && Array.isArray(t.hop) && RE_MAU_CANH.test(String(t.ten || ''))) canh.push(t); });
    if (canh.length) (ds || []).forEach((t, i) => {
      if (ra[i] !== 'mat' || !t || !Array.isArray(t.hop) || !RE_MAU_MAT_NK.test(String(t.ten || ''))) return;
      const k = trucMong(t.hop), u = (k + 1) % 3, v = (k + 2) % 3, dt = (t.hop[2 * u + 1] - t.hop[2 * u]) * (t.hop[2 * v + 1] - t.hop[2 * v]);
      if (!(dt > 0)) return;
      for (const c of canh) {
        if ((c.he || 0) !== (t.he || 0) || trucMong(c.hop) !== k) continue;
        const cu = chongHop(c.hop, t.hop, u), cv = chongHop(c.hop, t.hop, v);
        if (cu > 0 && cv > 0 && cu * cv >= dt / 2 && chongHop(c.hop, t.hop, k) <= TOL) { ra[i] = 'thung'; break; }      // cánh che ≥ nửa mặt ngăn kéo và hai tấm không cùng lớp
      }
    });
    return ra;
  }
  const maGon = t => String(t === undefined || t === null ? '' : t).toUpperCase().replace(/[\s\-_.·/]+/g, '');
  /** Lọc danh sách màu khi tìm: ds = [{ ten, nhom }], tim = chữ gõ (bỏ qua hoa thường, dấu cách, gạch), nhom = tên nhóm ('' = mọi nhóm). Mã BẮT ĐẦU bằng chữ gõ xếp trước, mã chỉ chứa xếp sau. */
  function locMau(ds, tim, nhom) {
    const q = maGon(tim), dau = [], giua = [];
    for (const m of ds || []) {
      if (nhom && m.nhom !== nhom) continue;
      if (!q) { dau.push(m); continue; }
      const i = maGon(m.ten).indexOf(q);
      if (i === 0) dau.push(m); else if (i > 0) giua.push(m);
    }
    return dau.concat(giua);
  }

  /* ------------------------------------------------------------------ *
   * XUẤT CHO CHENFENG (晨丰导入)
   * ------------------------------------------------------------------ */
  const rect = (w, h) => [{ pt: [0, 0], bul: 0 }, { pt: [rn(w), 0], bul: 0 }, { pt: [rn(w), rn(h)], bul: 0 }, { pt: [0, rn(h)], bul: 0 }];
  const rectAt = (u, v, w, h) => [{ pt: [rn(u), rn(v)], bul: 0 }, { pt: [rn(u + w), rn(v)], bul: 0 }, { pt: [rn(u + w), rn(v + h)], bul: 0 }, { pt: [rn(u), rn(v + h)], bul: 0 }];
  const circle = (cx, cy, r) => [{ pt: [rn(cx - r), rn(cy)], bul: 1 }, { pt: [rn(cx + r), rn(cy)], bul: 1 }];

  /**
   * Đường bao của tấm NẰM NGANG bị khoét góc sau (khấu cột). Toạ độ riêng của tấm nằm trong Chenfeng (đo trên bản thật 03/10/2026):
   * u = y − y0 (chiều sâu, 0 = mép trước), v = x1 − x (chiều ngang ĐẢO: v = 0 là mép PHẢI của tấm). Vẽ theo v = x − x0 thì góc khoét nhảy sang bên kia.
   * Đi một vòng: mép trước → mép phải (v = 0) → mép sau (lõm vào ở chỗ khoét) → mép trái (v = h).
   */
  /** Các đỉnh [x, y] (toạ độ tủ) của tấm nằm ngang bị khoét mép sau, đi từ góc trước–phải: mép phải → mép sau (từ phải sang trái, lõm vào ở chỗ khoét) → góc trước–trái. */
  function dinhKhoet(p) {
    const ks = (p.khau || []).slice().sort((a, b) => b.x1 - a.x1), pts = [[p.x1, p.y0]];
    let o = true;      // đang đứng ở mép sau (y1) hay không
    ks.forEach((k, q) => {
      if (q === 0 && Math.abs(k.x1 - p.x1) < TOL) pts.push([p.x1, k.y0]);
      else { if (q === 0) pts.push([p.x1, p.y1]); pts.push([k.x1, p.y1], [k.x1, k.y0]); }
      if (Math.abs(k.x0 - p.x0) < TOL) { pts.push([p.x0, k.y0]); o = false; }
      else { pts.push([k.x0, k.y0], [k.x0, p.y1]); o = true; }
    });
    if (!ks.length) pts.push([p.x1, p.y1]);
    if (o) pts.push([p.x0, p.y1]);
    pts.push([p.x0, p.y0]);
    // bỏ đỉnh trùng liên tiếp
    return pts.filter((q, i) => i === 0 || Math.abs(q[0] - pts[i - 1][0]) > TOL || Math.abs(q[1] - pts[i - 1][1]) > TOL).map(q => [rn(q[0]), rn(q[1])]);
  }
  function duongBaoKhau(p) { return dinhKhoet(p).map(q => ({ pt: [rn(q[1] - p.y0), rn(p.x1 - q[0])], bul: 0 })); }

  /**
   * "Đặt vách theo mép cột" (bản 1.14): với từng cột GIỮA tủ, cho hai vách đứng trùng hai mặt bên cột (đã cộng khe hở) → khoang trước cột thành khoang nông,
   * mọi tấm cắt thẳng, không phải khoét chữ U. Vách gần mép cột (≤ `gan`, mặc định 300) thì DỜI tới; không có thì THÊM vách (chia khoang, đợt chép sang).
   * Bề rộng các khoang được ghim bằng số; khoang rộng nhất ngoài vùng cột để "auto" hứng phần lẻ.
   * @returns {{spec, doi:string[], loi:string}}  spec mới (đã normalize); loi ≠ '' thì spec trả về là spec cũ.
   */
  function vachTheoCot(specIn, opt) {
    opt = opt || {};
    const gan = opt.gan > 0 ? opt.gan : 300, RMIN = opt.rong_min > 0 ? opt.rong_min : 150;
    const s = normalize(specIn);
    const cots = (s.khau.giua || []).filter(q => q.rong > 0 && q.sau > 0).slice().sort((a, b) => a.cach - b.cach);
    if (!cots.length) return { spec: s, doi: [], loi: 'Chưa khai cột giữa nào.' };
    const M0 = build(s), t = s.van.t, ho = s.khau.ho;
    if (!M0.info || !M0.info.khoang || !M0.info.x_khoang) return { spec: s, doi: [], loi: 'Thông số tủ đang lỗi — sửa lỗi trước đã.' };
    // khoang = [{ k (mô tả khoang), a, b, kep }] với a, b = mép trái / phải lọt lòng; kep = tấm đứng bên TRÁI khoang là chỗ tách thùng (2 hồi áp lưng, dày 2t)
    const tach0 = M0.info.tach || [];
    const bays = s.khoang.map((k, i) => ({ k: clone(k), a: M0.info.x_khoang[i], b: rn(M0.info.x_khoang[i] + M0.info.khoang[i]), kep: tach0.includes(i) }));
    const doi = [], daDung = new Set();
    // đưa một tấm đứng về sát mặt cột: phia = −1 → mặt PHẢI của tấm đứng = x (tấm đứng bên trái cột); phia = +1 → mặt TRÁI của tấm đứng = x (bên phải cột)
    const datVach = (x, phia, tenMat) => {
      let best = -1, d = Infinity;
      for (let j = 1; j < bays.length; j++) { if (daDung.has(bays[j])) continue; const dj = Math.abs((phia < 0 ? bays[j].a : bays[j - 1].b) - x); if (dj < d) { d = dj; best = j; } }
      if (best > 0 && d <= 1) { daDung.add(bays[best]); return ''; }
      if (best > 0 && d <= gan) {
        const day = rn(bays[best].a - bays[best - 1].b), L = phia < 0 ? rn(x - day) : x, R = rn(L + day);
        if (L - bays[best - 1].a >= RMIN && bays[best].b - R >= RMIN) {
          bays[best - 1].b = L; bays[best].a = R; daDung.add(bays[best]);
          doi.push(`dời ${bays[best].kep ? 'chỗ tách thùng' : 'vách'} ${best} về ${tenMat} (${g(d)} mm)`); return '';
        }
      }
      const L = phia < 0 ? rn(x - t) : x, R = rn(L + t);
      const i = bays.findIndex(q => L > q.a + TOL && R < q.b - TOL);
      if (i < 0) return `Mặt ${tenMat} (x = ${g(x)}) không nằm lọt trong khoang nào.`;
      const q = bays[i];
      if (L - q.a < RMIN || q.b - R < RMIN) return `Thêm vách ở ${tenMat} thì một bên khoang ${i + 1} chỉ còn ${g(Math.min(L - q.a, q.b - R))} (cần ≥ ${RMIN}) — dời cột hoặc chia lại khoang.`;
      const canh = q.k.canh === 2 ? 1 : q.k.canh;
      const phai = { k: { rong: 'auto', canh, ban_le: q.k.canh === 2 ? 'phai' : q.k.ban_le, dot: (Array.isArray(q.k.dot) ? q.k.dot.slice() : q.k.dot), o: [] }, a: R, b: q.b, kep: false };
      if (q.k.canh === 2) q.k.ban_le = 'trai';
      q.b = L; q.k.canh = canh;
      bays.splice(i + 1, 0, phai); daDung.add(phai);
      doi.push(`thêm vách ở ${tenMat} (chia khoang ${i + 1})`); return '';
    };
    for (const c of cots) {
      const l1 = datVach(rn(c.cach - ho), -1, `mép trái cột ${g(c.rong)}×${g(c.sau)}`); if (l1) return { spec: s, doi: [], loi: l1 };
      const l2 = datVach(rn(c.cach + c.rong + ho), 1, `mép phải cột ${g(c.rong)}×${g(c.sau)}`); if (l2) return { spec: s, doi: [], loi: l2 };
    }
    const truocCot = q => cots.some(c => Math.abs(q.a - (c.cach - ho)) <= 1 && Math.abs(q.b - (c.cach + c.rong + ho)) <= 1);
    let auto = -1, wMax = -1;
    bays.forEach((q, i) => { const w = q.b - q.a; if (!truocCot(q) && w > wMax) { wMax = w; auto = i; } });
    const s2 = clone(s);
    s2.khoang = bays.map((q, i) => { const k = q.k; k.rong = i === auto ? 'auto' : rn(q.b - q.a); if (truocCot(q) && q.b - q.a <= 650 && k.canh === 2) { k.canh = 1; if (!k.ban_le) k.ban_le = 'trai'; } return k; });
    const dat = M => !M.errors.length && (M.info.khau || []).filter(k => k.ben === 'giua').length === cots.length && (M.info.khau || []).every(k => k.ben !== 'giua' || (k.co_a && k.co_b));
    // 1) để bảng tự tính chỗ tách thùng như thường; 2) không khớp (chỗ tách nhảy sang vách khác làm lệch mép cột) thì ghim chỗ tách như đang có
    s2.thung = Object.assign({}, s2.thung); delete s2.thung.tach;
    let S2 = normalize(s2), M2 = build(S2);
    if (M2.errors.length && bays.some(q => truocCot(q) && (q.k.o || []).some(c => c.kieu !== 'suot'))) {      // khoang trước cột hẹp + nông: ngăn kéo cũ không còn vừa → bỏ, báo lại
      bays.forEach(q => { if (truocCot(q) && (q.k.o || []).some(c => c.kieu !== 'suot')) { q.k.o = q.k.o.filter(c => c.kieu === 'suot'); doi.push(`bỏ ngăn kéo ở khoang trước cột (lọt lòng ${g(q.b - q.a)}, không còn vừa)`); } });
      S2 = normalize(s2); M2 = build(S2);
    }
    if (!dat(M2)) {
      const tach = []; bays.forEach((q, i) => { if (q.kep) tach.push(i); });
      s2.thung.tach = tach; S2 = normalize(s2); M2 = build(S2);
      if (!dat(M2)) return { spec: s, doi: [], loi: M2.errors[0] || 'Không đặt được vách trùng hai mép cột với cách chia khoang này — chia lại khoang rồi thử lại.' };
      const qua = (M2.info.thung || []).filter(q => S2.thung.rong_max > 0 && q.rong > S2.thung.rong_max + TOL);
      if (qua.length) doi.push(`chỗ tách thùng giữ nguyên — có thùng rộng ${qua.map(q => g(q.rong)).join(', ')} (quá ${g(S2.thung.rong_max)})`);
    }
    return { spec: S2, doi, loi: '' };
  }

  /**
   * KẾ HOẠCH DỰNG TỦ BẰNG LỆNH GỐC CỦA CHENFENG (bản 1.15 — anh Jason 03/10/2026: "em phải vẽ chuẩn chenfeng … thì anh mới chỉnh sửa tiện lợi được").
   * Tủ dựng bằng chính các lệnh vẽ tấm của Chenfeng nên mỗi tấm là "tấm tự động" trong cây mẫu gốc (左右侧板模板 → 立板 / 顶底板 / 背板 / 层板), bấm vào sửa được như tủ vẽ tay.
   * Kết cấu đã chốt (19:34): VÁCH CHẠY SUỐT như hồi, nóc / đáy cắt theo từng khoang.
   * Mỗi bước = một lệnh: { lenh, … lựa chọn …, diem: điểm nằm TRONG khoảng trống cần vẽ (toạ độ tủ), tam: [chỉ số M.parts mà bước này phải sinh ra] }
   *   LR  LEFTRIGHTBOARD  hồi trái + phải của một thùng (mỗi thùng / mỗi thân là một mẫu gốc riêng)       { goc, rong, sau, cao, day, ten:[trái, phải], tu, phong }
   *   VE  VERTIALBOARD    một vách chạy suốt, cách mặt tấm đứng bên trái `cach`                           { cach, day, ten }
   *   TB  TOPBOTTOMBOARD  nóc + đáy lọt lòng một khoang (đáy nâng `nang` = cao chân, không vẽ xà chân gốc) { noc:{ten, day, ha}, day_:{ten, day, nang} }
   *   BE  BEHINDBOARD     hậu của một khoang: dày `day`, mặt sau cách mép sau thùng `lui` (âm = phủ sau), trùm ra 4 phía `ext` { day, lui, ext:{trai, phai, tren, duoi}, ten }
   *   LY  LAYERBOARD      một đợt, mặt dưới cách mặt trên tấm bên dưới `cach`                              { cach, day, ten, lui_truoc }
   *   DO  DOOR            cánh của một khoang (1–4 cánh bằng nhau): chọn 4 tấm kẹp `kep`, số cánh `so`, trùm ra `ext` (âm = hở vào), khe giữa `khe`   { kep, so, day, khe, ext, mo, ten }
   * @returns {{ M, spec, buoc: object[], loi: string[], chua: {loai, ten, sl}[] }}  chua = phần của tủ chưa có lệnh gốc (cánh, phào, chân, ngăn kéo…)
   */
  function keHoachGoc(specIn) {
    let s = normalize(specIn);
    if (s.hau.chia !== 'khoang') { const c = clone(s); c.hau.chia = 'khoang'; s = normalize(c); }      // mỗi khoang một tấm hậu (lệnh 背板 vẽ theo từng khoảng trống)
    const M = build(s), buoc = [], loi = [];
    if (M.errors.length) return { M, spec: s, buoc, loi: M.errors.slice(), chua: [] };
    if (s.hau.kieu !== 'phu') loi.push('hậu không phải kiểu phủ sau');
    if ((M.info.khau || []).length) loi.push('tủ có khấu cột');
    if (loi.length) return { M, spec: s, buoc, loi, chua: [] };
    const I = new Map(M.parts.map((p, i) => [p, i])), da = new Set();
    const cuaSau = [];      // cánh vẽ sau cùng (cánh che mặt trước, vẽ sớm thì các lệnh dò khoảng trống theo chuột phía sau sẽ vướng)
    const lay = (...ps) => ps.map(p => { da.add(p); return I.get(p); });
    for (const b of M.info.than) {
      M.info.thung.forEach((q, k) => {
        const dung = M.parts.filter(p => p.than === b.ma && (p.loai === 'HOI' || p.loai === 'VACH') && !p.khau_cot && p.x0 >= q.x0 - TOL && p.x1 <= q.x1 + TOL).sort((a, c) => a.x0 - c.x0);
        if (dung.length < 2) { loi.push(`Thân ${b.ma}, thùng ${k + 1}: không đủ 2 hồi.`); return; }
        const hT = dung[0], hP = dung[dung.length - 1], ym = rn((hT.y0 + hT.y1) / 2), zm = rn((hT.z0 + hT.z1) / 2), Dc = hT.y1;
        buoc.push({ lenh: 'LR', than: b.ma, thung: k, tu: hT.tu, phong: s.phong, goc: [hT.x0, hT.y0, hT.z0], rong: rn(hP.x1 - hT.x0), sau: rn(hT.y1 - hT.y0), cao: rn(hT.z1 - hT.z0), day: rn(hT.x1 - hT.x0), ten: [hT.ten, hP.ten], khoan: hT.khoan, tam: lay(hT, hP) });
        let xTrai = hT.x1;
        let tTrai = hT;
        for (const v of dung.slice(1, -1)) { buoc.push({ lenh: 'VE', than: b.ma, thung: k, diem: [rn((xTrai + hP.x0) / 2), ym, zm], cach: rn(v.x0 - xTrai), day: rn(v.x1 - v.x0), ten: v.ten, khoan: v.khoan, tam: lay(v), kep: [I.get(tTrai), I.get(hP)] }); xTrai = v.x1; tTrai = v; }
        for (let i = q.khoang[0]; i <= q.khoang[1]; i++) {
          const x0 = M.info.x_khoang[i], w = M.info.khoang[i], xm = rn(x0 + w / 2), cua = p => p.than === b.ma && p.khoang === i;
          const day = M.parts.find(p => p.loai === 'DAY' && cua(p)), noc = M.parts.find(p => p.loai === 'NOC' && cua(p));
          if (!day || !noc) { loi.push(`Thân ${b.ma}, khoang ${i + 1}: thiếu nóc / đáy.`); continue; }
          buoc.push({ lenh: 'TB', than: b.ma, khoang: i, diem: [xm, ym, zm], noc: { ten: noc.ten, day: rn(noc.z1 - noc.z0), ha: rn(hT.z1 - noc.z1) }, day_: { ten: day.ten, day: rn(day.z1 - day.z0), nang: rn(day.z0 - hT.z0) }, khoan: day.khoan, tam: lay(noc, day) });
          const zc = rn((day.z1 + noc.z0) / 2);
          for (const h of M.parts.filter(p => p.loai === 'HAU' && cua(p))) {
            if (h.den_khoang !== undefined && h.den_khoang !== i) { loi.push(`Hậu khoang ${i + 1} bắc qua nhiều khoang — chưa vẽ được bằng lệnh gốc.`); continue; }
            buoc.push({ lenh: 'BE', than: b.ma, khoang: i, diem: [xm, ym, zc], day: rn(h.y1 - h.y0), lui: rn(Dc - h.y1), ext: { trai: rn(x0 - h.x0), phai: rn(h.x1 - (x0 + w)), duoi: rn(day.z1 - h.z0), tren: rn(h.z1 - noc.z0) }, ten: h.ten, khoan: h.khoan, tam: lay(h) });
          }
          let zDuoi = day.z1, tDuoi = day;
          for (const d of M.parts.filter(p => p.loai === 'DOT' && cua(p)).sort((a, c) => a.z0 - c.z0)) {
            buoc.push({ lenh: 'LY', than: b.ma, khoang: i, diem: [xm, ym, rn((zDuoi + noc.z0) / 2)], cach: rn(d.z0 - zDuoi), day: rn(d.z1 - d.z0), lui_truoc: rn(d.y0 - hT.y0), ten: d.ten, khoan: d.khoan, tam: lay(d), kep: [I.get(tDuoi), I.get(noc)] });
            zDuoi = d.z1; tDuoi = d;
          }
          // cánh của khoang: lệnh DOOR vẽ vào khoảng kẹp giữa 2 tấm đứng + đáy + nóc của khoang (chọn 4 tấm đó), trùm ra / hở vào tính từ khoảng lọt lòng
          const canh = M.parts.filter(p => p.loai === 'CANH' && cua(p)).sort((a, c) => a.x0 - c.x0);
          if (canh.length) {
            const vT = dung.find(p => Math.abs(p.x1 - x0) < TOL), vP = dung.find(p => Math.abs(p.x0 - (x0 + w)) < TOL), c0 = canh[0], cN = canh[canh.length - 1];
            const deu = canh.every(c => Math.abs(c.z0 - c0.z0) < TOL && Math.abs(c.z1 - c0.z1) < TOL && Math.abs((c.x1 - c.x0) - (c0.x1 - c0.x0)) < 0.11 && Math.abs((c.y1 - c.y0) - (c0.y1 - c0.y0)) < TOL);
            const khe = canh.length > 1 ? rn(canh[1].x0 - c0.x1) : 0;
            if (vT && vP && deu && canh.length <= 4 && Math.abs(c0.y1 - hT.y0) < TOL && canh.every((c, q) => q === 0 || Math.abs((c.x0 - canh[q - 1].x1) - khe) < 0.11))
              cuaSau.push({ lenh: 'DO', than: b.ma, khoang: i, kep: [I.get(vT), I.get(vP), I.get(day), I.get(noc)], so: canh.length, day: rn(c0.y1 - c0.y0), khe,
                ext: { trai: rn(x0 - c0.x0), phai: rn(cN.x1 - (x0 + w)), duoi: rn(day.z1 - c0.z0), tren: rn(c0.z1 - noc.z0) }, mo: canh.map(c => (c.open === 2 ? 'rt' : 'lf')), ten: canh.map(c => c.ten), tam: lay(...canh) });
          }
        }
      });
    }
    buoc.push(...cuaSau);
    /* Bản 1.16 — CẢ TỦ LÀ MỘT MODULE: các thùng lệnh gốc là mẫu con của một module mẹ mang L / W / H của cả tủ; phào, chân, khung hộc kéo là tấm của module mẹ.
     * Để đổi L / W / H ở module mẹ mà thùng lệnh gốc chạy đúng quy tắc kết cấu của bảng (khoang chia lại đều, cánh bằng nhau…), mỗi lệnh mang BIỂU THỨC lấy từ hệ số `heSo`:
     *   LR  gan = { px, py, pz, l, w, h }: vị trí + kích thước mẫu gốc của thùng theo _L / _W / _H của module mẹ (gốc module mẹ = góc nhỏ nhất của cả tủ);
     *   VE  cach_bt: khoảng cách tới tấm đứng bên trái theo L của khoảng trống (từ tấm đó tới hồi phải của thùng);
     *   LY  cach_bt: khoảng cách tới tấm nằm bên dưới theo H của khoảng trống (từ tấm đó tới nóc).
     * Nóc / đáy, hậu, cánh bám theo khoảng kẹp của chúng nên không cần biểu thức. Tham số nào đổi kích thước làm đổi số tấm (heSo trả null) thì để hằng số. */
    const hs = heSo(s), gan = { goc: hs.goc.slice(), kich: hs.kich.slice(), co: { L: !!hs.bien.L, W: !!hs.bien.W, H: !!hs.bien.H } };
    if (hs.M.parts.length === M.parts.length) {
      const k6 = v => { const r = Math.round(v * 1e6) / 1e6; return Math.abs(r) < 1e-9 ? 0 : r; };
      const he = (ten, i, mep) => (hs.bien[ten] && hs.bien[ten].tam[i] ? hs.bien[ten].tam[i][mep] : 0);
      const TRUC = { L: 0, W: 1, H: 2 };
      // v = v0 + k·(X − X0) viết theo biến `bien`, X0 = giá trị hiện tại của biến
      const tt = (v0, k, X0, bien) => bieuThucTT(k6(v0 - k6(k) * X0), k6(k), bien);
      for (const b of buoc) {
        if (b.lenh === 'LR') {
          const [iT, iP] = b.tam, hT = M.parts[iT], hP = M.parts[iP];
          const mot = (ten, v0, k) => tt(v0, k, hs.kich[TRUC[ten]], '_' + ten);
          b.gan = {
            px: mot('L', hT.x0 - hs.goc[0], he('L', iT, 0)), l: mot('L', hP.x1 - hT.x0, he('L', iP, 1) - he('L', iT, 0)),
            py: mot('W', hT.y0 - hs.goc[1], he('W', iT, 0)), w: mot('W', hT.y1 - hT.y0, he('W', iT, 1) - he('W', iT, 0)),
            pz: mot('H', hT.z0 - hs.goc[2], he('H', iT, 0)), h: mot('H', hT.z1 - hT.z0, he('H', iT, 1) - he('H', iT, 0)) };
        } else if (b.lenh === 'VE') {
          const tr = M.parts[b.kep[0]], ph = M.parts[b.kep[1]], aT = he('L', b.kep[0], 1), aP = he('L', b.kep[1], 0), aV = he('L', b.tam[0], 0);
          const r = Math.abs(aP - aT) > 1e-9 ? (aV - aT) / (aP - aT) : 0;
          b.cach_bt = tt(b.cach, r, ph.x0 - tr.x1, 'L');
        } else if (b.lenh === 'LY') {
          const du = M.parts[b.kep[0]], no = M.parts[b.kep[1]], aD = he('H', b.kep[0], 1), aN = he('H', b.kep[1], 0), aO = he('H', b.tam[0], 0);
          const r = Math.abs(aN - aD) > 1e-9 ? (aO - aD) / (aN - aD) : 0;
          b.cach_bt = tt(b.cach, r, no.z0 - du.z1, 'H');
        }
      }
    }
    // phần chưa có lệnh gốc: gom theo tên tấm
    const g = new Map();
    for (const p of M.parts) if (!da.has(p)) { const k = p.loai + '|' + p.ten; const r = g.get(k) || { loai: p.loai, ten: p.ten, sl: 0 }; r.sl++; g.set(k, r); }
    for (const tp of M.templates || []) { const k = 'MAU|' + (tp.loai || ''); const r = g.get(k) || { loai: 'MAU', ten: tp.loai === 'NGAN_KEO' ? 'Ngăn kéo' : tp.loai === 'SUOT' ? 'Suốt treo' : (tp.loai || 'Mẫu kho'), sl: 0 }; r.sl++; g.set(k, r); }
    return { M, spec: s, buoc, loi, chua: [...g.values()], con_lai: M.parts.filter(p => !da.has(p)), gan, hs };
  }

  /**
   * Khoảng trống mà một lệnh gốc dò theo chuột PHẢI thấy tại `diem` (toạ độ tủ), nhìn thẳng mặt trước: mặt của các tấm `ds` (những tấm đã vẽ) gần điểm nhất về 4 phía.
   * Chenfeng dò đúng như vậy (4 đường từ chuột ra 4 mép màn hình, lấy tấm gần nhất mỗi phía) nên hộp nó dò ra không được vượt qua các mặt này;
   * máy vẽ dùng để kiểm hộp xem trước của Chenfeng trước khi trả lời lệnh (tab bị che thì tấm vừa vẽ có thể chưa có hình → dò lọt qua).
   * Tấm trùm lên điểm trên hình chiếu (hậu) không tính. @returns {{x0, x1, z0, z1}}  null = phía đó chưa có tấm
   */
  function khoangMong(ds, diem) {
    const px = diem[0], pz = diem[2], m = { x0: null, x1: null, z0: null, z1: null };
    for (const p of ds) {
      if (p.z0 < pz && p.z1 > pz) { if (p.x1 <= px && (m.x0 === null || p.x1 > m.x0)) m.x0 = p.x1; if (p.x0 >= px && (m.x1 === null || p.x0 < m.x1)) m.x1 = p.x0; }
      if (p.x0 < px && p.x1 > px) { if (p.z1 <= pz && (m.z0 === null || p.z1 > m.z0)) m.z0 = p.z1; if (p.z0 >= pz && (m.z1 === null || p.z0 < m.z1)) m.z1 = p.z0; }
    }
    return m;
  }

  /** Biểu thức tuyến tính `c + k·biến` viết theo kiểu Chenfeng đọc được (vd "-8.75+L*0.5"); k = 0 thì chỉ còn số. */
  function bieuThucTT(c, k, bien) {
    const so = v => String(Math.round(v * 1e6) / 1e6);
    if (!k) return so(c);
    const kb = Math.abs(k) === 1 ? bien : `${bien}*${so(Math.abs(k))}`;
    return c ? `${so(c)}${k < 0 ? '-' : '+'}${kb}` : (k < 0 ? '-' : '') + kb;
  }

  /** Kích thước riêng (rộng, cao, dày) của tấm theo quy ước Chenfeng. */
  function localSize(p) {
    const dx = p.x1 - p.x0, dy = p.y1 - p.y0, dz = p.z1 - p.z0;
    return p.type === 1 ? [dy, dz, dx] : p.type === 0 ? [dy, dx, dz] : [dx, dz, dy];
  }

  function partToCF(p, s) {
    const [w, h, t] = localSize(p);
    const hau = p.loai === 'HAU' && !p.van_thung;      // hậu khấu cột là ván thùng: vật liệu, dán cạnh, khoan như tấm thùng
    const dc = hau && (p.phu || p.mong) ? '0' : s.van.dan_canh;      // hậu mỏng (phủ / soi rãnh) không dán cạnh
    const o = {
      Type: 'Board', Name: p.ten, BrType: p.type, PositionType: 1,      // PositionType 1: Pos = góc nhỏ nhất (x, y, z) cho cả 3 loại tấm
      ContourCurve: p.khau && p.khau.length && p.type === 0 ? duongBaoKhau(p) : rect(w, h), Thickness: rn(t), Pos: [p.x0, p.y0, p.z0],
      RoomName: s.phong, CabinetName: p.tu, BrMatName: (hau && s.hau.ten_van) || s.van.ten_van || '', Matrial: (hau && s.hau.vat_lieu) || s.van.vat_lieu || '', Color: (hau && s.hau.mau) || s.van.mau || '',
      Lines: p.lines, BigHole: p.big, ComposingFace: 2,
      UpSealed: dc, DownSealed: dc, LeftSealed: dc, RightSealed: dc,
      FrontDrill: !!p.fd, BackDrill: !!p.bd, EachEdgeDrills: [p.khoan, p.khoan, p.khoan, p.khoan],
    };
    if (p.open) o.OpenDir = p.open;
    if (p.holes && p.holes.length) o.Holes = p.holes.map(hh => hh.kieu === 'tron'
      ? { ContourCurve: circle(hh.u, hh.v, hh.r), Thickness: rn(hh.sau), Pos: [0, 0, rn(hh.z)] }
      : { ContourCurve: rectAt(hh.u, hh.v, hh.w, hh.h), Thickness: rn(hh.sau), Pos: [0, 0, rn(hh.z)] });
    return o;
  }

  function templateToCF(tp, s) {
    return { Type: 'Template', TempalteId: tp.id, Name: tp.ten, BoxSize: tp.box.map(v => rn(v)), Pos: tp.pos.map(v => rn(v)), RoomName: s.phong, CabinetName: tp.tu,
      ParamMap: Object.keys(tp.params).map(k => ({ name: k, value: String(rn(tp.params[k])) })) };
  }

  /**
   * @returns {{json: {ModelSpace: object[]}, base: number[], so_tam: number, so_mau: number}}
   * base = góc nhỏ nhất của cả cụm: khi Chenfeng hỏi "点取位置", trả lời đúng điểm này (cộng độ dời mong muốn) thì toạ độ giữ nguyên như thiết kế.
   */
  function toChenfeng(M, opts) {
    opts = opts || {};
    const s = M.spec;
    const boards = M.parts.map(p => partToCF(p, s));
    if (opts.id) for (const b of boards) b.Remarks = [[KHOA_TU, String(opts.id)]];
    const tpls = opts.khong_mau ? [] : M.templates.filter(tp => tp.id).map(tp => templateToCF(tp, s));
    const bb = bbox(M.parts);
    return { json: { ModelSpace: boards.concat(tpls) }, base: bb ? [bb.x0, bb.y0, bb.z0] : [0, 0, 0], so_tam: boards.length, so_mau: tpls.length };
  }

  /* ------------------------------------------------------------------ *
   * BẢNG KÊ
   * ------------------------------------------------------------------ */
  function cutList(M) {
    const rows = new Map();
    for (const p of M.parts) {
      const c = cutSize(p);
      const kh = (p.khau || []).map(k => (k.ben === 'giua' ? `khoét chữ U mép sau, cách mép trái ${g(k.x0 - p.x0)}: ${g(k.x1 - k.x0)} × ${g(k.y1 - k.y0)} (khấu cột)` : `khoét góc sau ${k.ben === 'phai' ? 'phải' : 'trái'} ${g(k.x1 - k.x0)} × ${g(k.y1 - k.y0)} (khấu cột)`)).join('; ');
      const nhom = p.van_thung ? NHOM.HOI : (NHOM[p.loai] || p.loai);      // hậu khấu cột bằng ván thùng → kê cùng nhóm thùng
      const key = [nhom, p.tu, p.ten, c.dai, c.rong, c.day, p.khoan, p.holes && p.holes.length ? 'x' : '', kh].join('|');
      const r = rows.get(key) || { nhom, tu: p.tu, ten: p.ten, dai: c.dai, rong: c.rong, day: c.day, sl: 0, m2: 0, khoan: p.khoan === KHONG_KHOAN ? 'không khoan' : p.khoan,
        ghi_chu: kh || (p.phu ? 'ốp sau lưng thùng, bắn đinh' : p.van_thung ? 'tấm trước mặt cột — ván thùng, lọt giữa 2 tấm đứng hai bên cột' : p.khau_cot ? 'vách đứng dọc mặt bên cột' : p.holes && p.holes.length ? (p.holes[0].kieu === 'tron' ? 'khoét chén bản lề' : 'soi rãnh hậu') : '') };
      r.sl++; r.m2 += c.dai * c.rong / 1e6; rows.set(key, r);
    }
    const order = ['Thùng', 'Hậu', 'Chân trước', 'Phào mặt', 'Phụ trợ phào', 'Cánh'];
    const list = [...rows.values()].sort((a, b) => (order.indexOf(a.nhom) - order.indexOf(b.nhom)) || a.tu.localeCompare(b.tu) || a.ten.localeCompare(b.ten) || (b.dai - a.dai) || (b.rong - a.rong));
    const tong = {};
    for (const r of list) { tong[r.nhom] = tong[r.nhom] || { sl: 0, m2: 0 }; tong[r.nhom].sl += r.sl; tong[r.nhom].m2 += r.m2; }
    // tổng theo độ dày: ván thùng và ván hậu là 2 loại ván khác nhau, phải tách khi tính vật tư
    const theo = new Map();
    for (const r of list) { const e = theo.get(r.day) || { day: r.day, sl: 0, m2: 0 }; e.sl += r.sl; e.m2 += r.m2; theo.set(r.day, e); }
    const theo_day = [...theo.values()].sort((a, b) => b.day - a.day);
    const phu_kien = [];
    const kich = x => `${g(x.box[0])}×${g(x.box[1])}×${g(x.box[2])}`;
    for (const [kieu, ten] of [['nk_am', 'Ngăn kéo âm'], ['nk_trum', 'Ngăn kéo trùm ngoài']]) {
      const ds = M.templates.filter(x => x.loai === 'NGAN_KEO' && x.kieu === kieu && x.id);
      for (const ma of [...new Set(ds.map(x => x.ma_loai))]) {
        const a = ds.filter(x => x.ma_loai === ma);
        phu_kien.push({ ten: `${ten} — ${a[0].ten_loai} (mẫu Chenfeng ${a[0].ten}: hộp + ray)`, sl: a.length, ghi_chu: a.map(kich).join('; ') });
      }
    }
    const nS = M.templates.filter(x => x.loai === 'SUOT' && x.id).length;
    if (nS) phu_kien.push({ ten: 'Suốt treo + bas (mẫu Chenfeng)', sl: nS, ghi_chu: M.templates.filter(x => x.loai === 'SUOT').map(x => `dài ${g(x.box[0])}`).join('; ') });
    return { rows: list, tong, theo_day, tong_sl: sum(list.map(r => r.sl)), tong_m2: sum(list.map(r => r.m2)), phu_kien };
  }

  function cutListCSV(M) {
    const cl = cutList(M), q = v => { v = String(v === undefined || v === null ? '' : v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const lines = [['Nhóm', 'Tên tủ', 'Tên tấm', 'Dài (mm)', 'Rộng (mm)', 'Dày (mm)', 'Số lượng', 'Diện tích (m2)', 'Kiểu khoan', 'Ghi chú'].join(',')];
    for (const r of cl.rows) lines.push([r.nhom, r.tu, r.ten, r.dai, r.rong, r.day, r.sl, r.m2.toFixed(3), r.khoan, r.ghi_chu].map(q).join(','));
    lines.push('');
    for (const k of Object.keys(cl.tong)) lines.push([`Tổng ${k}`, '', '', '', '', '', cl.tong[k].sl, cl.tong[k].m2.toFixed(3), '', ''].map(q).join(','));
    for (const d of cl.theo_day) lines.push([`Tổng ván dày ${g(d.day)}`, '', '', '', '', '', d.sl, d.m2.toFixed(3), '', ''].map(q).join(','));
    lines.push(['TỔNG VÁN (chưa kể hộp ngăn kéo)', '', '', '', '', '', cl.tong_sl, cl.tong_m2.toFixed(3), '', ''].map(q).join(','));
    if (cl.phu_kien.length) { lines.push(''); for (const p of cl.phu_kien) lines.push(['Phụ kiện', '', p.ten, '', '', '', p.sl, '', '', p.ghi_chu].map(q).join(',')); }
    return '﻿' + lines.join('\r\n') + '\r\n';
  }

  /* ------------------------------------------------------------------ *
   * HÌNH ĐỨNG (SVG) để xem trước
   * ------------------------------------------------------------------ */
  // Màu theo loại tấm như khung nhìn của Chenfeng (tấm đứng đỏ gạch, tấm nằm vàng, tấm mặt/hậu xanh lá) nhưng dịu hơn để đọc được chữ.
  const MAU = { HOI: '#dd9a90', VACH: '#e6b0a7', DEM: '#e6b0a7', XA: '#8fbf86', NEP: '#8fbf86', DAY: '#e6d25e', NOC: '#e6d25e', DOT: '#f0e390', HAU: '#eef3ec', CHAN: '#7fb87a', PHAO: '#93c78d', PHU: '#f0e390', CANH: '#4d9a57' };
  const MAU_CHU_GIAI = [['tấm đứng', '#dd9a90'], ['tấm nằm', '#e6d25e'], ['tấm mặt (cánh, phào, chân)', '#7fb87a'], ['hậu', '#eef3ec']];

  function elevationSVG(M, opts) {
    opts = Object.assign({ canh: true, kich_thuoc: true, rong_px: 640 }, opts || {});
    const s = M.spec, W = s.rong, H = s.cao, m = Math.max(W, H) * 0.09 + 60;
    const fs = Math.max(W, H) / 46;
    const nhieuThung = opts.kich_thuoc && ((M.info && M.info.thung) || []).length > 1;      // tủ tách thùng: thêm 1 hàng kích thước "thùng" dưới hàng khoang
    const dsKhau = (opts.kich_thuoc && M.info && M.info.khau) || [], Dk = s.sau_thung;      // tủ có khấu cột: thêm hình nhìn từ trên xuống ở dưới hình đứng
    const vb = [-m, -m * 0.75, W + 2 * m, H + m * 1.5 + (nhieuThung ? fs * 2.4 : 0) + (dsKhau.length ? Dk + fs * 6 : 0)];
    const Y = z => H - z, f = v => rn(v, 1);
    // bề rộng hình (px): không vượt rong_px, và nếu có cao_px thì hình không cao quá cao_px (tủ hẹp mà cao)
    const rongPx = rn(opts.cao_px > 0 ? Math.min(opts.rong_px, opts.cao_px * vb[2] / vb[3]) : opts.rong_px, 1), tiLe = rongPx / vb[2];      // tiLe = px trên 1 mm
    let o = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(f).join(' ')}" width="${rongPx}" style="max-width:100%;height:auto;font-family:system-ui,Segoe UI,Arial,sans-serif" role="img" aria-label="Hình đứng ${esc(s.ten)}">`;
    o += `<rect x="${f(vb[0])}" y="${f(vb[1])}" width="${f(vb[2])}" height="${f(vb[3])}" fill="#fbfaf7"/>`;
    const R = (p, extra) => `<rect x="${f(p.x0)}" y="${f(Y(p.z1))}" width="${f(p.x1 - p.x0)}" height="${f(p.z1 - p.z0)}" ${extra}/>`;
    const order = ['HAU', 'PHU', 'DOT', 'DAY', 'NOC', 'DEM', 'NEP', 'HOI', 'VACH', 'CHAN', 'PHAO'];
    for (const loai of order) for (const p of M.parts) if (p.loai === loai) {
      if (loai === 'PHU' && p.type !== 0) continue;
      o += R(p, `fill="${MAU[loai]}" stroke="#39424a" stroke-width="${f(fs / 9)}"${loai === 'HAU' ? ' stroke-opacity=".25"' : ''}`);
    }
    for (const q of M.mat_ngan_keo) if (!q.trum) {
      o += `<rect x="${f(q.x)}" y="${f(Y(q.z + q.h))}" width="${f(q.w)}" height="${f(q.h)}" fill="#d9eed5" stroke="#2d6b38" stroke-width="${f(fs / 7)}"/>`;
      o += `<text x="${f(q.x + q.w / 2)}" y="${f(Y(q.z + q.h / 2) + fs * 0.35)}" font-size="${f(fs)}" text-anchor="middle" fill="#1f4d29">ngăn kéo ${g(q.w)}×${g(q.h)}</text>`;
    }
    // xà ngăn kéo nằm sau mặt ngăn kéo: vẽ nét đứt đè lên để thấy vị trí
    for (const p of M.parts) if (p.loai === 'XA') o += R(p, `fill="${MAU.XA}" fill-opacity=".3" stroke="#2d6b38" stroke-width="${f(fs / 9)}" stroke-dasharray="${f(fs * 0.7)} ${f(fs * 0.5)}"`);
    for (const tp of M.templates) if (tp.loai === 'SUOT') {
      const z = tp.pos[2] + tp.box[2] - s.suot.cach_dot - 15;
      o += `<line x1="${f(tp.pos[0] + 8)}" y1="${f(Y(z))}" x2="${f(tp.pos[0] + tp.box[0] - 8)}" y2="${f(Y(z))}" stroke="#59616b" stroke-width="${f(fs / 2.2)}" stroke-linecap="round"/>`;
      o += `<text x="${f(tp.pos[0] + tp.box[0] / 2)}" y="${f(Y(z) + fs * 1.5)}" font-size="${f(fs * 0.9)}" text-anchor="middle" fill="#414850">suốt treo</text>`;
    }
    if (opts.canh) for (const p of M.parts) if (p.loai === 'CANH') {
      o += R(p, `fill="${MAU.CANH}" fill-opacity=".14" stroke="#245c2f" stroke-width="${f(fs / 7)}"`);
      const xm = p.open === 2 ? p.x1 : p.x0, xo = p.open === 2 ? p.x0 : p.x1, zc = (p.z0 + p.z1) / 2;
      o += `<polyline points="${f(xm)},${f(Y(p.z1))} ${f(xo)},${f(Y(zc))} ${f(xm)},${f(Y(p.z0))}" fill="none" stroke="#245c2f" stroke-width="${f(fs / 10)}" stroke-dasharray="${f(fs)} ${f(fs * 0.7)}"/>`;
    }
    // mặt ngăn kéo trùm ngoài: nằm ở mặt phẳng cánh nên luôn vẽ (kể cả khi tắt "hiện cánh")
    for (const q of M.mat_ngan_keo) if (q.trum) {
      o += `<rect x="${f(q.x)}" y="${f(Y(q.z + q.h))}" width="${f(q.w)}" height="${f(q.h)}" fill="${MAU.CHAN}" fill-opacity=".8" stroke="#245c2f" stroke-width="${f(fs / 6)}"/>`;
      o += `<line x1="${f(q.x + q.w * 0.42)}" y1="${f(Y(q.z + q.h) + Math.min(q.h * 0.28, fs * 1.6))}" x2="${f(q.x + q.w * 0.58)}" y2="${f(Y(q.z + q.h) + Math.min(q.h * 0.28, fs * 1.6))}" stroke="#245c2f" stroke-width="${f(fs / 4)}" stroke-linecap="round"/>`;
      o += `<text x="${f(q.x + q.w / 2)}" y="${f(Y(q.z + q.h / 2) + fs * 0.7)}" font-size="${f(fs)}" text-anchor="middle" fill="#143b1d">ngăn kéo trùm ${g(q.w)}×${g(q.h)}</text>`;
    }
    // ĐIỆN – NƯỚC sau tủ (bản 1.18): opts.dien_nuoc = MNCFPhong.dienNuocChoTu(...).diem (toạ độ thiết kế của tủ).
    //   sau lưng: ô nét đứt đúng cỡ + ký hiệu · dưới đáy: vòng tròn gạch chéo ở chân tủ · sau hồi: vạch ở mép tủ. Điểm trúng tấm tô ĐỎ. Không bắt chuột (ô, đợt, vách vẫn bấm / kéo được).
    for (const q of opts.dien_nuoc || []) {
      const mau = q.trung && q.trung.length ? '#d9402b' : (q.mau || '#c26a00'), sw = f(fs / 5);
      const chu = (x, y, neo) => `<text data-dn="${q.j}" x="${f(x)}" y="${f(y)}" font-size="${f(fs * 0.9)}" font-weight="700" text-anchor="${neo}" fill="${mau}" pointer-events="none" paint-order="stroke" stroke="#fff" stroke-width="${f(fs / 4)}">${esc(q.nhan)}</text>`;
      if (q.mat === 'lung') {
        const bw = Math.max(q.rong, fs * 1.1), bh = Math.max(q.cao, fs * 1.1), dut = `stroke-dasharray="${f(fs * 0.45)} ${f(fs * 0.3)}"`;
        o += q.tron ? `<circle cx="${f(q.x)}" cy="${f(Y(q.z))}" r="${f(bw / 2)}" fill="#fff" fill-opacity=".8" stroke="${mau}" stroke-width="${sw}" ${dut} pointer-events="none"/>`
          : `<rect x="${f(q.x - bw / 2)}" y="${f(Y(q.z) - bh / 2)}" width="${f(bw)}" height="${f(bh)}" fill="#fff" fill-opacity=".8" stroke="${mau}" stroke-width="${sw}" ${dut} pointer-events="none"/>`;
        o += chu(q.x, Y(q.z) - bh / 2 - fs * 0.3, 'middle');
      } else if (q.mat === 'day') {
        const r = fs * 0.6, cy = H - r - fs * 0.15, k = r * 0.7;
        o += `<circle cx="${f(q.x)}" cy="${f(cy)}" r="${f(r)}" fill="#fff" fill-opacity=".85" stroke="${mau}" stroke-width="${sw}" pointer-events="none"/><path d="M ${f(q.x - k)} ${f(cy - k)} L ${f(q.x + k)} ${f(cy + k)} M ${f(q.x - k)} ${f(cy + k)} L ${f(q.x + k)} ${f(cy - k)}" stroke="${mau}" stroke-width="${f(fs / 8)}" fill="none" pointer-events="none"/>`;
        o += chu(q.x + r + fs * 0.3, cy + fs * 0.32, 'start');
      } else {
        const trai = q.mat === 'trai', x = trai ? 0 : W, bh = Math.max(q.cao, fs * 1.1);
        o += `<rect x="${f(x - fs * 0.3)}" y="${f(Y(q.z) - bh / 2)}" width="${f(fs * 0.6)}" height="${f(bh)}" fill="${mau}" stroke="#fff" stroke-width="${f(fs / 10)}" pointer-events="none"/>`;
        o += chu(trai ? -fs * 0.6 : W + fs * 0.6, Y(q.z) + fs * 0.32, trai ? 'end' : 'start');
      }
    }
    // lớp tương tác: vùng bấm của từng ô và vùng kéo của từng đợt (giao diện dùng data-o / data-dot để biết đang trỏ vào đâu)
    if (opts.tuong_tac) {
      const ch = opts.chon || null, pad = Math.max(W, H) / 110, acc = '#1c5fb8';
      // số "cao lọt lòng" của ô: ô thường ghi giữa ô; ô ngăn kéo ghi vào khe dưới mặt trên cùng (1 ngăn: sát mép trên) để khỏi đè lên chữ của mặt ngăn kéo
      const caoO = c => {
        const cao = c.z1 - c.z0, nk = c.kieu === 'nk_am' || c.kieu === 'nk_trum';
        const zc = nk ? (c.so >= 2 ? c.z1 - cao / c.so : c.z1 - cao * 0.14) : (c.z0 + c.z1) / 2;
        return `<text x="${f(c.x1 - fs * 0.6)}" y="${f(Y(zc) + fs * 0.4)}" font-size="${f(fs * 1.05)}" text-anchor="end" fill="${acc}" font-weight="700" pointer-events="none" paint-order="stroke" stroke="#fff" stroke-width="${f(fs / 4)}">${g(cao)}</text>`;
      };
      const cs = M.info.o || [];
      for (const c of cs) {
        const on = !!(ch && ch.loai === 'o' && ch.khoang === c.khoang && Math.abs(ch.tu - c.tu) < 0.6);
        o += `<rect data-o="${c.khoang}:${c.tu}" x="${f(c.x0)}" y="${f(Y(c.z1))}" width="${f(c.x1 - c.x0)}" height="${f(c.z1 - c.z0)}" fill="${acc}" fill-opacity="${on ? '.16' : '0'}"${on ? ` stroke="${acc}" stroke-width="${f(fs / 5)}"` : ''} style="cursor:pointer"/>`;
        if (on) o += caoO(c);
      }
      // vùng kéo của đợt: cao ít nhất `vung_keo_px` trên màn hình (dễ bắt bằng chuột / ngón tay), nhưng không lấn quá 1/3 ô kề bên để ô vẫn bấm được
      // (touch-action:none trên rect chỉ có tác dụng ở trình duyệt hỗ trợ; Chromium bỏ qua với phần tử con của SVG nên giao diện còn tự chặn cuộn ở touchstart)
      const canPad = Math.max(pad, ((opts.vung_keo_px || 14) / tiLe - s.van.t) / 2);
      const caoO2 = (p, tren) => { const c = cs.find(x => x.khoang === p.khoang && Math.abs((tren ? x.tu : x.z1) - p.z0) < 0.6); return c ? c.z1 - c.z0 : Infinity; };
      for (const p of M.parts) if (p.loai === 'DOT') {
        const on = !!(ch && ch.loai === 'dot' && ch.khoang === p.khoang && ch.idx === p.idx);
        const padT = Math.min(canPad, caoO2(p, true) / 3), padD = Math.min(canPad, caoO2(p, false) / 3);
        if (on) {
          o += `<rect x="${f(p.x0)}" y="${f(Y(p.z1) - fs / 6)}" width="${f(p.x1 - p.x0)}" height="${f(p.z1 - p.z0 + fs / 3)}" fill="${acc}" pointer-events="none"/>`;
          for (const c of cs) if (c.khoang === p.khoang && (Math.abs(c.tu - p.z0) < 0.6 || Math.abs(c.z1 - p.z0) < 0.6)) o += caoO(c);       // cao lọt lòng 2 ô kề đợt đang chọn
          o += `<text x="${f(p.x0 + fs * 0.6)}" y="${f(Y(p.z1) - fs * 0.5)}" font-size="${f(fs * 1.05)}" fill="${acc}" font-weight="700" pointer-events="none" paint-order="stroke" stroke="#fff" stroke-width="${f(fs / 4)}">+${g(p.z0)}</text>`;
        }
        o += `<rect data-dot="${p.khoang}:${p.idx}" x="${f(p.x0)}" y="${f(Y(p.z1) - padT)}" width="${f(p.x1 - p.x0)}" height="${f(p.z1 - p.z0 + padT + padD)}" fill="${acc}" fill-opacity="0" style="cursor:ns-resize;touch-action:none"/>`;
      }
      // vách đứng giữa 2 khoang (bản 1.12): vùng kéo ngang để chia lại bề rộng khoang; data-vach = chỉ số khoang BÊN PHẢI vách. Vẽ sau cùng để mép ô / đầu đợt không che.
      const xk = M.info.x_khoang || [], wk = M.info.khoang || [], zb = s.chan.cao, zt = H - s.phao.tren;
      for (let i = 1; i < wk.length && i < xk.length; i++) {
        const a = xk[i - 1] + wk[i - 1], b = xk[i], on = !!(ch && ch.loai === 'vach' && ch.idx === i);
        const px = Math.max(0, Math.min(canPad, wk[i - 1] / 8, wk[i] / 8));
        if (on) {
          o += `<rect x="${f(a - fs / 6)}" y="${f(Y(zt))}" width="${f(b - a + fs / 3)}" height="${f(zt - zb)}" fill="${acc}" pointer-events="none"/>`;
          const yT = Y(zt) + fs * 1.6, chu = (x, t, neo) => `<text x="${f(x)}" y="${f(yT)}" font-size="${f(fs * 1.05)}" text-anchor="${neo}" fill="${acc}" font-weight="700" pointer-events="none" paint-order="stroke" stroke="#fff" stroke-width="${f(fs / 4)}">${t}</text>`;
          o += chu(a - fs * 0.6, '◂ ' + g(wk[i - 1]), 'end') + chu(b + fs * 0.6, g(wk[i]) + ' ▸', 'start');
        }
        o += `<rect data-vach="${i}" x="${f(a - px)}" y="${f(Y(zt))}" width="${f(b - a + 2 * px)}" height="${f(zt - zb)}" fill="${acc}" fill-opacity="0" style="cursor:ew-resize;touch-action:none"><title>Vách giữa khoang ${i} và ${i + 1} — kéo sang trái / phải để chia lại khoang</title></rect>`;
      }
    }
    if (opts.kich_thuoc) {
      const dim = (x1, y1, x2, y2, txt, side) => {
        let q = `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="#2b3138" stroke-width="${f(fs / 9)}"/>`;
        const tick = fs * 0.45;
        if (Math.abs(y1 - y2) < 1e-6) { q += `<line x1="${f(x1)}" y1="${f(y1 - tick)}" x2="${f(x1)}" y2="${f(y1 + tick)}" stroke="#2b3138" stroke-width="${f(fs / 9)}"/><line x1="${f(x2)}" y1="${f(y1 - tick)}" x2="${f(x2)}" y2="${f(y1 + tick)}" stroke="#2b3138" stroke-width="${f(fs / 9)}"/>`;
          q += `<text x="${f((x1 + x2) / 2)}" y="${f(y1 + (side < 0 ? -fs * 0.45 : fs * 1.25))}" font-size="${f(fs)}" text-anchor="middle" fill="#2b3138">${txt}</text>`; }
        else { q += `<line x1="${f(x1 - tick)}" y1="${f(y1)}" x2="${f(x1 + tick)}" y2="${f(y1)}" stroke="#2b3138" stroke-width="${f(fs / 9)}"/><line x1="${f(x1 - tick)}" y1="${f(y2)}" x2="${f(x1 + tick)}" y2="${f(y2)}" stroke="#2b3138" stroke-width="${f(fs / 9)}"/>`;
          const xm = x1 + (side < 0 ? -fs * 0.85 : fs * 1.2), ym = (y1 + y2) / 2;
          q += `<text x="${f(xm)}" y="${f(ym)}" font-size="${f(fs)}" text-anchor="middle" fill="#2b3138" transform="rotate(-90 ${f(xm)} ${f(ym)})">${txt}</text>`; }
        return q;
      };
      o += dim(0, -m * 0.42, W, -m * 0.42, g(W), -1);
      o += dim(W + m * 0.5, Y(H), W + m * 0.5, Y(0), g(H), 1);
      let x = s.phao.trai + s.van.t;
      (M.info.khoang || []).forEach((c, i) => { if (M.info.x_khoang) x = M.info.x_khoang[i]; o += dim(x, H + m * 0.28, x + c, H + m * 0.28, g(c), 1); x += c + s.van.t; });
      if (nhieuThung) {
        const yT = H + m * 0.28 + fs * 2.4, mauT = '#a8431f';
        M.info.thung.forEach((th, i) => {
          o += dim(th.x0, yT, th.x1, yT, 'thùng ' + (i + 1) + ': ' + g(th.rong), 1).replace(/#2b3138/g, mauT);
          if (i) o += `<line x1="${f(th.x0)}" y1="${f(Y(H) - fs * 0.5)}" x2="${f(th.x0)}" y2="${f(yT)}" stroke="${mauT}" stroke-width="${f(fs / 7)}" stroke-dasharray="${f(fs * 0.8)} ${f(fs * 0.5)}"/>`;
        });
      }
      (M.info.than || []).forEach(b => { if ((M.info.than || []).length > 1) o += dim(-m * 0.45, Y(b.z1), -m * 0.45, Y(b.z0), (b.ma === 'D' ? 'thân dưới ' : 'thân trên ') + g(b.z1 - b.z0), -1); });
      if (dsKhau.length) {
        // NHÌN TỪ TRÊN XUỐNG (lưng tủ ở trên, mặt cánh ở dưới): thấy cột, vách khấu, hậu khấu và góc khoét của đáy
        const y0p = H + m * 0.28 + fs * 2.6 + (nhieuThung ? fs * 2.4 : 0) + fs * 2.2, Yp = y => y0p + (Dk - y), than0 = (M.info.than || [])[0] || {}, mauK = '#a8431f';
        o += `<text x="0" y="${f(y0p - fs * 0.6)}" font-size="${f(fs)}" font-weight="700" fill="#2b3138">Nhìn từ trên xuống — khấu cột</text>`;
        const Rp = (p, extra) => `<rect x="${f(p.x0)}" y="${f(Yp(p.y1))}" width="${f(p.x1 - p.x0)}" height="${f(p.y1 - p.y0)}" ${extra}/>`;
        for (const p of M.parts) {
          if (p.than !== than0.ma) continue;
          if (p.loai === 'DAY') {
            const pts = p.khau && p.khau.length ? dinhKhoet(p) : [[p.x1, p.y0], [p.x1, p.y1], [p.x0, p.y1], [p.x0, p.y0]];
            o += `<polygon points="${pts.map(q => f(q[0]) + ',' + f(Yp(q[1]))).join(' ')}" fill="${MAU.DAY}" fill-opacity=".55" stroke="#39424a" stroke-width="${f(fs / 9)}"/>`;
          } else if (p.loai === 'HOI' || p.loai === 'VACH') o += Rp(p, `fill="${p.khau_cot ? mauK : MAU[p.loai]}" stroke="#39424a" stroke-width="${f(fs / 9)}"`);
          else if (p.loai === 'HAU') o += Rp(p, `fill="${p.khau_cot ? mauK : '#59616b'}" stroke="none"`);
        }
        dsKhau.forEach((k, q) => {
          const c = k.cot, rong = c.x1 - c.x0, cy0 = Dk - c.sau, giua = k.ben === 'giua';
          o += `<rect x="${f(c.x0)}" y="${f(Yp(Dk))}" width="${f(rong)}" height="${f(c.sau)}" fill="#8d949c" fill-opacity=".55" stroke="#2b3138" stroke-width="${f(fs / 8)}" stroke-dasharray="${f(fs * 0.5)} ${f(fs * 0.35)}"/>`;
          o += `<text x="${f(c.x0 + rong / 2)}" y="${f(Yp(cy0 + c.sau / 2) + fs * 0.35)}" font-size="${f(fs * 0.95)}" text-anchor="middle" fill="#1b2420" font-weight="700">cột ${g(rong)}×${g(c.sau)}</text>`;
          const chu = giua ? (k.co_a && k.co_b ? 'khoang nông trước cột' : k.co_a || k.co_b ? '1 vách sẵn + 1 vách khấu' : '2 vách khấu') : (k.vach_co_san ? 'vách làm vách khấu' : 'vách khấu');
          if (giua) o += `<text x="${f((k.xa + k.xb) / 2)}" y="${f(Yp(k.sau_thung) + fs * 1.25)}" font-size="${f(fs * 0.85)}" text-anchor="middle" fill="${mauK}">${chu} · sâu ${g(k.sau_thung)}</text>`;
          else { const trai = k.ben !== 'phai'; o += `<text x="${f(trai ? k.x + s.van.t + fs * 0.5 : k.x - s.van.t - fs * 0.5)}" y="${f(Yp((k.sau_thung + Dk) / 2) + fs * 0.35)}" font-size="${f(fs * 0.85)}" text-anchor="${trai ? 'start' : 'end'}" fill="${mauK}">${chu} · thùng trước cột sâu ${g(k.sau_thung)}</text>`; }
        });
      }
    }
    return o + '</svg>';
  }
  function esc(v) { return String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  /* ------------------------------------------------------------------ *
   * TÓM TẮT (chữ)
   * ------------------------------------------------------------------ */
  function summary(M) {
    const s = M.spec, cl = cutList(M), L = [];
    const m2 = v => v.toFixed(2).replace('.', ',');
    const hau = s.hau.kieu === 'phu' ? `hậu ${g(s.hau.t)} phủ sau lưng thùng, bắn đinh (hồi sâu ${g(s.sau_thung - s.hau.t)} + hậu ${g(s.hau.t)})` : s.hau.kieu === 'mong' ? `hậu mỏng soi rãnh ${g(s.hau.t)}` : `hậu dày lọt lòng ${g(s.hau.t)}`;
    L.push(`${s.ten} — phủ bì ${g(s.rong)} × ${g(s.cao)}, thùng sâu ${g(s.sau_thung)}, ván ${g(s.van.t)}, ${hau}.`);
    if (M.info.than) L.push(`Thân: ${M.info.than.map(b => `${b.tu} cao ${g(b.z1 - b.z0)}`).join(' + ')}${s.phao.tren ? ` + phào trên ${g(s.phao.tren)}` : ''}.`);
    if (M.info.khoang) L.push(`Khoang lọt lòng: ${M.info.khoang.map(g).join(' / ')}.`);
    if (M.info.thung && M.info.thung.length > 1) L.push(`Thùng: ${M.info.thung.length} thùng rời — ${M.info.thung.map(q => `${g(q.rong)} (${q.khoang[1] - q.khoang[0] + 1} khoang)`).join(' + ')}, ghép cạnh nhau trong khung phào chung.`);
    if (M.info.canh && M.info.canh.so) L.push(`Cánh: ${M.info.canh.so} tấm, rộng ${M.info.canh.rong.map(g).join(' / ')}, cao ${M.info.canh.cao.map(g).join(' / ')}.`);
    const matNK = a => [...new Set(a.map(q => `${g(q.w)}×${g(q.h)}`))].join(', ');
    const am = M.mat_ngan_keo.filter(q => !q.trum), tr = M.mat_ngan_keo.filter(q => q.trum);
    if (am.length || tr.length) {
      const dem = {}; for (const x of M.templates) if (x.loai === 'NGAN_KEO') dem[x.ten_loai] = (dem[x.ten_loai] || 0) + 1;
      L.push(`Ngăn kéo: ${[am.length ? `${am.length} âm (mặt ${matNK(am)})` : '', tr.length ? `${tr.length} trùm ngoài (mặt ${matNK(tr)})` : ''].filter(Boolean).join(', ')} — ${Object.keys(dem).map(k => `${k} ×${dem[k]}`).join(', ')}.`);
      const nXa = M.parts.filter(p => p.loai === 'XA').length, nNep = M.parts.filter(p => p.loai === 'NEP').length;
      if (nXa || nNep) L.push(`Hộc ngăn kéo âm: ${[nXa ? `${nXa} xà sau khe mặt` : '', nNep ? `${nNep} nẹp che khe hai bên` : ''].filter(Boolean).join(', ')}.`);
    }
    L.push(`Tấm ván: ${cl.tong_sl} tấm — ${cl.theo_day.map(d => `ván ${g(d.day)}: ${d.sl} tấm, ${m2(d.m2)} m²`).join('; ')} (${Object.keys(cl.tong).map(k => `${k} ${cl.tong[k].sl}`).join(', ')}).`);
    return L;
  }

  /**
   * Thông số / mẫu tủ lưu từ bản cũ → chuẩn xưởng hiện tại. `ban` = phiên bản đã lưu ra dữ liệu đó (vd '1.2.0'); không rõ phiên bản thì không đổi gì.
   * @returns {{spec: object, doi: string[]}} doi = các thay đổi đã làm, để báo cho người dùng
   */
  function nangCap(specCu, ban) {
    const soBan = v => { const m = /^(\d+)\.(\d+)(?:\.(\d+))?/.exec(String(v === undefined || v === null ? '' : v)); return m ? (+m[1]) * 1e6 + (+m[2]) * 1e3 + (+(m[3] || 0)) : NaN; };
    const spec = clone(specCu || {}), doi = [], v = soBan(ban);
    if (isFinite(v) && v < soBan('1.3.0')) {
      // Trước 1.3 hậu mặc định là "dày, lọt lòng". Chuẩn xưởng từ 1.3: hậu 6 li phủ sau, bắn đinh. Hậu soi rãnh là lựa chọn riêng của người dùng nên giữ.
      const h = spec.hau && typeof spec.hau === 'object' ? spec.hau : null;
      if (!h || h.kieu === undefined || h.kieu === 'day') {
        spec.hau = Object.assign({}, h || {}, { kieu: 'phu', t: DEFAULT_SPEC.hau.t });
        doi.push('Hậu đã đổi sang chuẩn xưởng mới: 6 li, phủ sau lưng thùng, chia tấm tại vách, bắn đinh (bản cũ: hậu dày lọt lòng). Muốn đổi lại: Chuẩn xưởng → Hậu.');
      }
    }
    if (isFinite(v) && v < soBan('1.5.1')) {
      // Trước 1.5.1 xà chân trước mặc định cao 50. Anh Jason chốt 02/10/2026: mặc định 100 (hoặc 80). Chỉ đổi khi số đang lưu đúng bằng mặc định cũ.
      const c = spec.chan && typeof spec.chan === 'object' ? spec.chan : null;
      if (c && Number(c.cao) === 50) {
        spec.chan = Object.assign({}, c, { cao: DEFAULT_SPEC.chan.cao });
        doi.push(`Xà chân trước đã đổi sang mặc định mới: cao ${DEFAULT_SPEC.chan.cao} (bản cũ: 50) — đáy tủ nâng lên theo, cao độ đợt giữ nguyên. Muốn 80 hay số khác: Chuẩn xưởng → Chân.`);
      }
    }
    if (isFinite(v) && v < soBan('1.17.1')) {
      // Trước 1.17.1 khe hở quanh cột (khấu cột) mặc định 10. Anh Jason 03/10/2026 23:58: "khe khấu cột để 1-2cm cho sau xử lý cho dễ" → 15. Chỉ đổi khi số đang lưu đúng bằng mặc định cũ.
      const k = spec.khau && typeof spec.khau === 'object' ? spec.khau : null;
      if (k && Number(k.ho) === 10) {
        spec.khau = Object.assign({}, k, { ho: DEFAULT_SPEC.khau.ho });
        if ((k.trai && k.trai.rong > 0) || (k.phai && k.phai.rong > 0) || (Array.isArray(k.giua) && k.giua.some(q => q && q.rong > 0))) doi.push(`Khe hở quanh cột (khấu cột) đã đổi sang mặc định mới: ${DEFAULT_SPEC.khau.ho} (bản cũ: 10) — để lúc lắp còn chỗ xử lý. Muốn số khác (10–20): thẻ Tủ → Khấu cột → Khe hở quanh cột.`);
      }
    }
    // Từ 1.10 tủ rộng tự tách thùng: chỉ báo khi tủ đang lưu thật sự bị tách (tủ hẹp thì không có gì đổi)
    let biTach = false;
    if (isFinite(v) && v < soBan('1.10.0') && !(spec.thung && typeof spec.thung === 'object' && 'rong_max' in spec.thung)) { try { const m = build(spec); biTach = !!(m.info.thung && m.info.thung.length > 1); } catch (e) { biTach = false; } }
    if (biTach) {
      doi.push(`Từ bản 1.10: tủ rộng tự tách thành các thùng rời, mỗi thùng không quá ${DEFAULT_SPEC.thung.rong_max} (chỗ tách là 2 hồi áp lưng, phào và chân là khung chung). Đổi số hoặc tắt (0): Chuẩn xưởng → Thùng.`);
    }
    return { spec, doi };
  }
  /** Thông số của một tủ ĐÃ VẼ (lưu lúc vẽ): tủ vẽ bằng bản trước 1.10 là một thùng liền → giữ nguyên như lúc vẽ để còn dò lại được trên bản vẽ. */
  function specDaVe(spec, ban) {
    const soBan = v => { const m = /^(\d+)\.(\d+)(?:\.(\d+))?/.exec(String(v === undefined || v === null ? '' : v)); return m ? (+m[1]) * 1e6 + (+m[2]) * 1e3 + (+(m[3] || 0)) : NaN; };
    const o = clone(spec || {}), v = soBan(ban);
    if (!(isFinite(v) && v >= soBan('1.10.0')) && !(o.thung && typeof o.thung === 'object' && 'rong_max' in o.thung)) o.thung = { rong_max: 0 };
    return o;
  }

  /* ------------------------------------------------------------------ *
   * BỘ MẪU TỦ ÁO — chọn là ra tủ; chỉ thay kích thước + khoang, giữ nguyên Chuẩn xưởng của người dùng.
   * Cao độ đợt = MẶT DƯỚI đợt tính từ sàn. Quy ước ruột khoang (thân dưới 2200, chân 100 → mặt trên đáy ở +117,5):
   *   treo dài      : suốt treo dưới đợt +1900 (lọt lòng ~1780 — áo dài, đầm, măng tô), ô trên để chăn / hộp
   *   treo ngắn+đợt : 3 ô xếp đồ cao ~320 (đợt +450 / +785 / +1120) + treo ngắn phía trên (lọt lòng ~1045)
   *   hai tầng treo : đợt +1150 → 2 tầng treo ngắn ~1015–1030 (sơ mi, vest, quần vắt)
   *   ngăn kéo+treo : 2 ngăn kéo âm dưới đợt +570 + treo dài phía trên (lọt lòng ~1595)
   *   ngăn kéo+đợt  : 2 ngăn kéo âm + 4 ô xếp đồ
   *   3 ngăn kéo    : 3 ngăn kéo âm dưới đợt +750, 1 ô xếp đồ, treo ngắn phía trên
   *   đợt đều       : 6 ô xếp đồ cao ~320–350
   * ------------------------------------------------------------------ */
  const RUOT = {
    treo_dai: () => ({ dot: [1900], o: [{ tu: 0, kieu: 'suot' }] }),
    treo_ngan_dot: () => ({ dot: [450, 785, 1120], o: [{ tu: 1120, kieu: 'suot' }] }),
    hai_tang_treo: () => ({ dot: [1150], o: [{ tu: 0, kieu: 'suot' }, { tu: 1150, kieu: 'suot' }] }),
    nk_treo: () => ({ dot: [570], o: [{ tu: 0, kieu: 'nk_am', so: 2 }, { tu: 570, kieu: 'suot' }] }),
    nk_dot: () => ({ dot: [570, 900, 1230, 1560, 1890], o: [{ tu: 0, kieu: 'nk_am', so: 2 }] }),
    nk3_treo_ngan: () => ({ dot: [750, 1130], o: [{ tu: 0, kieu: 'nk_am', so: 3 }, { tu: 1130, kieu: 'suot' }] }),
    dot_deu: () => ({ dot: [450, 790, 1130, 1470, 1810], o: [] }),
  };
  const TEN_RUOT = { treo_dai: 'treo dài', treo_ngan_dot: 'đợt + treo ngắn', hai_tang_treo: 'hai tầng treo', nk_treo: '2 ngăn kéo + treo dài', nk_dot: '2 ngăn kéo + đợt', nk3_treo_ngan: '3 ngăn kéo + treo ngắn', dot_deu: 'đợt đều' };
  // [mã, tên, rộng, cao, cao thân dưới, [[số cánh, ruột, bản lề?], …]]
  const MAU_TU = [
    ['TA2-1000', 'Tủ áo 2 cánh 1000', 1000, 2800, 2200, [[2, 'nk3_treo_ngan']]],
    ['TA2-1100-T', 'Tủ áo 2 cánh 1100, một thân cao 2400', 1100, 2400, 0, [[2, 'nk_treo']]],
    ['TA3-1500', 'Tủ áo 3 cánh 1500', 1500, 2800, 2200, [[2, 'nk_treo'], [1, 'dot_deu', 'phai']]],
    ['TA4-2000', 'Tủ áo 4 cánh 2000', 2000, 2800, 2200, [[2, 'treo_dai'], [2, 'nk_dot']]],
    ['TA4-2000-2T', 'Tủ áo 4 cánh 2000 — hai tầng treo', 2000, 2800, 2200, [[2, 'hai_tang_treo'], [2, 'nk3_treo_ngan']]],
    ['TA5-2500', 'Tủ áo 5 cánh 2500', 2500, 2800, 2200, [[2, 'treo_dai'], [2, 'nk_treo'], [1, 'dot_deu', 'phai']]],
    ['TA6-3000', 'Tủ áo 6 cánh 3000', 3000, 2800, 2200, [[2, 'treo_dai'], [2, 'nk_treo'], [2, 'dot_deu']]],
    ['TA6-3000-VC', 'Tủ áo 6 cánh 3000 — hai người', 3000, 2800, 2200, [[2, 'hai_tang_treo'], [2, 'nk3_treo_ngan'], [2, 'treo_dai']]],
  ].map(([ma, ten, rong, cao, cao_duoi, kh]) => ({ ma, ten, rong, cao, cao_duoi, mo_ta: kh.map(k => `${k[0]} cánh: ${TEN_RUOT[k[1]]}`).join(' · '),
    khoang: () => kh.map(k => Object.assign({ rong: 'auto', canh: k[0] }, k[2] ? { ban_le: k[2] } : {}, RUOT[k[1]]())) }));

  /** Áp một mẫu tủ áo lên thông số hiện tại: thay mã, tên, rộng, cao, cao thân dưới, khoang; mọi số Chuẩn xưởng khác giữ nguyên. */
  function apMau(specHienTai, ma) {
    const m = MAU_TU.find(x => x.ma === ma);
    if (!m) return null;
    const keep = clone(specHienTai || {});
    return normalize(Object.assign(keep, { ma: m.ma.replace(/-.*$/, ''), ten: m.ten, rong: m.rong, cao: m.cao, khoang: m.khoang(), than: Object.assign({}, keep.than, { cao_duoi: m.cao_duoi }) }));
  }

  /**
   * Hệ số tuyến tính của từng tấm / từng mẫu theo 3 kích thước phủ bì của tủ — để dựng tủ thành MODULE THAM SỐ GỐC của Chenfeng
   * (tham số L = rộng, W = sâu, H = cao của hộp bao; người dùng sửa ngay ở ô "Thông số" của Chenfeng, tủ co giãn đúng quy tắc kết cấu của bảng này).
   * Toạ độ tính SO VỚI GÓC NHỎ NHẤT của tủ (gốc không gian của module). Với mỗi biến: mép nhỏ / mép lớn của tấm dời a·Δ / b·Δ.
   * @returns {{M, goc:number[], kich:number[], bien:{L,W,H}}} bien[x] = null nếu đổi kích thước đó làm đổi số tấm (không tuyến tính)
   *   bien[x] = { tam:[[a,b]…] theo thứ tự M.parts, mau:[{pos, box, params:{k: hệ số}}…] theo thứ tự M.templates có id, sai_so: lệch lớn nhất (mm) khi thử Δ gấp đôi }
   */
  function heSo(spec) {
    const s0 = normalize(spec), M0 = build(s0);
    const hop = p => [p.x0, p.x1, p.y0, p.y1, p.z0, p.z1];
    const r6 = v => Math.round(v * 1e6) / 1e6;
    const bb0 = bbox(M0.parts);
    const out = { M: M0, goc: bb0 ? [bb0.x0, bb0.y0, bb0.z0] : [0, 0, 0], kich: bb0 ? [rn(bb0.x1 - bb0.x0), rn(bb0.y1 - bb0.y0), rn(bb0.z1 - bb0.z0)] : [0, 0, 0], bien: { L: null, W: null, H: null } };
    if (M0.errors.length || !bb0) return out;
    const giong = m => !m.errors.length && m.parts.length === M0.parts.length && m.templates.length === M0.templates.length && m.parts.every((p, i) => p.loai === M0.parts[i].loai && p.type === M0.parts[i].type && (p.khau || []).length === (M0.parts[i].khau || []).length) && m.templates.every((t, i) => t.id === M0.templates[i].id);
    // đổi kích thước không được làm đổi cách tách thùng → giữ nguyên chỗ tách của tủ gốc
    const dung = (khoa, d) => { const s1 = clone(s0); s1[khoa] = s0[khoa] + d; s1.thung = Object.assign({}, s1.thung, { tach: M0.info.tach || [] }); const m = build(s1); return giong(m) ? m : null; };
    [['L', 'rong', 0], ['W', 'sau_thung', 1], ['H', 'cao', 2]].forEach(([ten, khoa, truc]) => {
      let M1 = null, d = 0;
      for (const thu of [120, -120, 60, -60]) { M1 = dung(khoa, thu); if (M1) { d = thu; break; } }
      if (!M1) return;
      const bb1 = bbox(M1.parts), g0 = out.goc[truc], g1 = [bb1.x0, bb1.y0, bb1.z0][truc];
      const dP = [bb1.x1 - bb1.x0, bb1.y1 - bb1.y0, bb1.z1 - bb1.z0][truc] - out.kich[truc];      // thay đổi thật của tham số module
      if (Math.abs(dP) < 1) return;
      const tam = M0.parts.map((p, i) => { const a0 = hop(p), a1 = hop(M1.parts[i]); return [r6(((a1[truc * 2] - g1) - (a0[truc * 2] - g0)) / dP), r6(((a1[truc * 2 + 1] - g1) - (a0[truc * 2 + 1] - g0)) / dP)]; });
      const mau = M0.templates.map((t, i) => {
        const u = M1.templates[i], ps = {};
        for (const k of Object.keys(t.params || {})) if (typeof t.params[k] === 'number' && typeof u.params[k] === 'number' && Math.abs(u.params[k] - t.params[k]) > 1e-6) ps[k] = r6((u.params[k] - t.params[k]) / dP);
        const o = { pos: r6(((u.pos[truc] - g1) - (t.pos[truc] - g0)) / dP), box: r6((u.box[truc] - t.box[truc]) / dP), params: ps };
        // chiều sâu hộp ngăn kéo nhảy bậc theo cỡ ray (không tuyến tính) → mô tả riêng: sâu = floor((tu0 + k·ΔW) / buoc) × buoc
        if (truc === 1 && t.bac_sau && u.bac_sau) { o.box = 0; o.bac = { tu0: t.bac_sau.tu, k: r6((u.bac_sau.tu - t.bac_sau.tu) / dP), buoc: t.bac_sau.buoc }; }
        return o;
      });
      // kiểm tra tuyến tính: dựng với Δ gấp đôi, so với dự đoán
      let sai = 0; const M2 = dung(khoa, d * 2);
      if (M2) {
        const bb2 = bbox(M2.parts), g2 = [bb2.x0, bb2.y0, bb2.z0][truc], dP2 = [bb2.x1 - bb2.x0, bb2.y1 - bb2.y0, bb2.z1 - bb2.z0][truc] - out.kich[truc];
        M0.parts.forEach((p, i) => { const a0 = hop(p), a2 = hop(M2.parts[i]); for (const k of [0, 1]) sai = Math.max(sai, Math.abs((a2[truc * 2 + k] - g2) - ((a0[truc * 2 + k] - g0) + tam[i][k] * dP2))); });
      }
      // tấm khoét góc (khấu cột): hệ số của 2 mép vùng khoét theo trục này (trục cao thì không có) — module tham số phải kéo cả các đỉnh ở mép khoét
      const kk = truc === 0 ? ['x0', 'x1'] : truc === 1 ? ['y0', 'y1'] : null;
      const khau = M0.parts.map((p, i) => (kk && p.khau && M1.parts[i].khau && M1.parts[i].khau.length === p.khau.length ? p.khau.map((k, q) => kk.map(c => r6(((M1.parts[i].khau[q][c] - g1) - (k[c] - g0)) / dP))) : null));
      out.bien[ten] = { khoa, truc, tam, mau, khau, sai_so: rn(sai) };
    });
    return out;
  }

  /** Các hộp bao mong đợi trong Chenfeng (để đối chiếu sau khi vẽ). */
  function expectedBoxes(M) { return M.parts.map(p => ({ ten: p.ten, tu: p.tu, loai: p.loai, khoan: p.khoan, box: [p.x0, p.x1, p.y0, p.y1, p.z0, p.z1] })); }

  return { VERSION, DEFAULT_SPEC, KHONG_KHOAN, KHOA_TU, NHOM, MAU_CHU_GIAI, MAU_TU, apMau, heSo, specDaVe, normalize, build, toChenfeng, cutList, cutListCSV, elevationSVG, summary, expectedBoxes, bbox, cutSize, overlap, parseDot, parseTS, tsText, merge, nangCap, KIEU_HAU, vachTheoCot, dinhKhoet, keHoachGoc, bieuThucTT, khoangMong, MUC_KIEM, phieu, kiemLienKet, kiemVaCham, kiemLoGiao, kiemLoLech, kiemMoiNoi, MUC_VE, doLoiThat, nhomMau, locMau };
});

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
  // ĐIỆN – NƯỚC hiện trạng (bản 1.18 — anh Jason 03/10/2026 23:46: "nhiều phòng có ổ điện rồi thoát sàn, rồi cấp thoát nước cho điền vào hiện trạng").
  //   Điểm TRÊN TƯỜNG: `cach` = từ đầu trái tường tới TÂM điểm, `cao` = từ sàn tới tâm. Điểm DƯỚI SÀN (san): `cach` như trên, `ra` = từ mặt tường ra tâm.
  //   rong × cao_o = cỡ ô phải khoét trên tấm che nó (tron: đường kính); cao / ra ở đây là số điền sẵn khi thêm điểm mới — thợ đo lại rồi gõ đè.
  const LOAI_DN = {
    o_dien: { ten: 'Ổ điện', ky: 'Ổ', nhom: 'dien', cao: 300, rong: 120, cao_o: 80 },
    cong_tac: { ten: 'Công tắc', ky: 'CT', nhom: 'dien', cao: 1250, rong: 120, cao_o: 80 },
    cap_nuoc: { ten: 'Cấp nước', ky: 'CN', nhom: 'cap', cao: 550, rong: 60, tron: true },
    thoat_nuoc: { ten: 'Thoát nước', ky: 'TN', nhom: 'thoat', cao: 400, rong: 90, tron: true },
    khac: { ten: 'Điểm khác', ky: 'Đ', nhom: 'khac', cao: 300, rong: 120, cao_o: 120 },
    thoat_san: { ten: 'Thoát sàn', ky: 'TS', nhom: 'thoat', san: true, ra: 300, rong: 110, tron: true },
    ong_san: { ten: 'Ống chờ sàn', ky: 'ÔS', nhom: 'thoat', san: true, ra: 150, rong: 90, tron: true },
  };
  const MAU_DN = { dien: '#c26a00', cap: '#0a84c4', thoat: '#7a4a21', khac: '#6b46a8' };

  /** Phòng mẫu: 3600 × 3000, trần 2700, cửa đi ở tường C. Tường cuối để 'auto' = tự tính cho phòng khép kín. */
  const macDinh = () => ({
    ban: BAN, ten: 'Phòng ngủ', cao: 2700, day: 110,
    tuong: [{ ten: 'A', dai: 3600, re: 90 }, { ten: 'B', dai: 3000, re: 90 }, { ten: 'C', dai: 3600, re: 90 }, { ten: 'D', dai: 'auto', re: 90 }],
    mo: [{ tuong: 2, loai: 'cua', cach: 200, rong: 900, cao: 2200, be: 0 }],
    can: [],
    dn: [],
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
    o.dn = (Array.isArray(p.dn) ? p.dn : []).filter(d => d && typeof d === 'object').map(d => {
      const loai = LOAI_DN[d.loai] ? d.loai : 'o_dien', L = LOAI_DN[loai], q = { tuong: iT(d.tuong), loai, cach: num(d.cach, 0) };
      if (L.san) q.ra = Math.max(0, num(d.ra, L.ra)); else q.cao = Math.max(0, num(d.cao, L.cao));
      // cỡ ô chỉ giữ khi khác cỡ mặc định của loại (đổi loại thì cỡ đi theo loại mới)
      const r = num(d.rong, 0), c = num(d.cao_o, 0);
      if (r > 0 && r !== L.rong) q.rong = r;
      if (!L.tron && c > 0 && c !== L.cao_o) q.cao_o = c;
      if (d.ghi) q.ghi = String(d.ghi).slice(0, 40);
      return q;
    });
    o.khung = (Array.isArray(p.khung) ? p.khung : []).map((k, i) => {
      const q = { ten: String(k.ten || 'K' + (i + 1)).slice(0, 24), tuong: iT(k.tuong), cach: num(k.cach, 0), z: Math.max(0, num(k.z, 0)), rong: Math.max(0, num(k.rong, 1000)), cao: Math.max(0, num(k.cao, o.cao)), sau: Math.max(0, num(k.sau, 600)), mau: String(k.mau || ''), ghi_chu: String(k.ghi_chu || '').slice(0, 200) };
      if (k.tu_id) q.tu_id = String(k.tu_id);      // mã của tủ đã vẽ vào khung này (để biết khung nào đã vẽ)
      // bản 1.19 — khung đặt MẪU KHO Chenfeng thay cho tủ tự chia khoang: kieu = 'kho', kho = mẫu đã chọn (mã mẫu trong kho của tài khoản, tên, ảnh nhỏ, kích thước mặc định)
      if (k.kieu === 'kho') {
        q.kieu = 'kho';
        const m = k.kho, id = m && Math.round(num(m.id, 0));
        if (id > 0) { q.kho = { id, ten: String(m.ten || '').slice(0, 60), hinh: String(m.hinh || '').slice(0, 300) }; if (Array.isArray(m.kt) && m.kt.length === 3 && m.kt.every(v => num(v, 0) > 0)) q.kho.kt = m.kt.map(v => num(v, 0)); }
        if (k.nhom) q.nhom = String(k.nhom).slice(0, 24);      // nhóm mẫu đang xem cho khung này (tủ áo, tủ tivi…) — chỉ để bảng mở lại đúng nhóm
      }
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
        if (q.kieu === 'kho') { luu_y.push(`${ten} (mẫu kho) vướng ${c.ten.toLowerCase()} ở tường ${c.w.ten} (${g(c.rong)} × nhô ${g(c.nho)}) — mẫu kho không khấu cột được: thu / dời khung cho né ra, hoặc đổi khung sang tủ tự chia khoang.`); continue; }
        const vc = viTriCot(q, c);
        if (vc && vc.vi_tri !== 'giua') { ghi_chu.push(`${ten}: ${c.ten.toLowerCase()} trùm đầu ${vc.vi_tri === 'trai' ? 'trái' : 'phải'} khung (${g(vc.rong)} × sâu ${g(vc.sau)}) — tủ vẽ vào khung này sẽ được KHẤU CỘT.`); continue; }
        if (vc && vc.sat_tuong) { ghi_chu.push(`${ten}: ${c.ten.toLowerCase()} nằm giữa khung (cách đầu trái ${g(vc.cach)}, ${g(vc.rong)} × sâu ${g(vc.sau)}) — tủ vẽ vào khung này sẽ được KHẤU CỘT GIỮA (vách đặt theo hai mép cột).`); continue; }
        const goi = c.loai === 'dam' && c.z0 > q.z0 + 300 ? ` Hạ khung xuống còn cao ${g(c.z0 - q.z0)} hoặc làm tủ né dầm.` : '';
        luu_y.push(`${ten} vướng ${c.ten.toLowerCase()} ở tường ${c.w.ten} (${g(c.rong)} × nhô ${g(c.nho)}, +${g(c.z0)} → +${g(c.z1)}).${goi}`);
      }
    }
    for (let i = 0; i < kh.length; i++) for (let j = i + 1; j < kh.length; j++) if (kh[i].rong > 0 && kh[j].rong > 0 && giao(kh[i].poly, kh[j].poly) && zGiao(kh[i].z0, kh[i].z1, kh[j].z0, kh[j].z1))
      loi.push(kh[i].tuong === kh[j].tuong ? `Khung ${kh[i].ten} và khung ${kh[j].ten} trên tường ${kh[i].w.ten} chồng lên nhau.` : `Khung ${kh[i].ten} (tường ${kh[i].w.ten}) và khung ${kh[j].ten} (tường ${kh[j].w.ten}) đâm vào nhau ở góc phòng — lùi một khung ra khỏi góc đúng bằng chiều sâu khung kia.`);
    // ĐIỆN – NƯỚC (bản 1.18): vị trí trên mặt bằng (P) + cao độ (z), tên đánh số theo từng loại ("Ổ điện 2"), cỡ ô phải khoét
    const dem = {};
    const dn = p.dn.map((d, j) => {
      const w = W[d.tuong], L = LOAI_DN[d.loai], so = dem[d.loai] = (dem[d.loai] || 0) + 1, rong = d.rong > 0 ? d.rong : L.rong;
      const P0 = cong(cong(w.p0, nhan(w.d, d.cach)), nhan(w.n, L.san ? d.ra : 0));
      const ten = d.loai === 'khac' && d.ghi ? `${d.ghi} ${so}` : `${L.ten} ${so}${d.ghi ? ` (${d.ghi})` : ''}`;
      return Object.assign({}, d, { j, w, so, ten, nhan: L.ky + so, nhom: L.nhom, san: !!L.san, tron: !!L.tron, rong, cao_o: L.tron ? rong : (d.cao_o > 0 ? d.cao_o : L.cao_o), P: [rn(P0[0], 2), rn(P0[1], 2)], z: L.san ? 0 : d.cao });
    });
    const trongPhong = q => { let c = false; for (let i = 0, k = W.length - 1; i < W.length; k = i++) { const a1 = W[i].p0, b1 = W[k].p0; if ((a1[1] > q[1]) !== (b1[1] > q[1]) && q[0] < (b1[0] - a1[0]) * (q[1] - a1[1]) / (b1[1] - a1[1]) + a1[0]) c = !c; } return c; };
    for (const d of dn) {
      if (d.cach < -0.05 || d.cach > d.w.dai + 0.05) { loi.push(`${d.ten} nằm ngoài tường ${d.w.ten}: cách đầu trái ${g(d.cach)} mà tường chỉ dài ${g(d.w.dai)}.`); continue; }
      if (d.san) { if (khep.kin && d.ra > 0.5 && !trongPhong(d.P)) luu_y.push(`${d.ten} nằm ngoài lòng phòng (cách tường ${d.w.ten} tới ${g(d.ra)}) — kiểm tra lại số đo.`); continue; }
      if (d.z > d.w.cao + 0.05) loi.push(`${d.ten} (tường ${d.w.ten}) cao +${g(d.z)}, vượt trần ${g(d.w.cao)}.`);
      for (const m of mo) if (m.tuong === d.tuong && d.cach > m.cach + 0.5 && d.cach < m.cach + m.rong - 0.5 && d.z > m.z0 + 0.5 && d.z < m.z1 - 0.5) luu_y.push(`${d.ten} đang nằm giữa ${m.ten.toLowerCase()} của tường ${d.w.ten} — kiểm tra lại “cách trái” / “cao”.`);
    }
    H.mo = mo; H.can = can; H.khung = kh; H.dn = dn;
    // khung nào che điểm nào (tính theo hộp của khung; mở khung thành tủ thì `dienNuocChoTu` xét tới từng tấm)
    if (dn.length) kh.forEach((q, j) => {
      if (!(q.rong > 0 && q.cao > 0 && q.sau > 0)) return;
      const dk = datKhung(H, j), che = diemTrongKhung(H, { goc: dk.goc, xoay: dk.xoay, rong: q.rong, sau: q.sau, cao: q.cao });
      if (!che.length) return;
      const ten = `Khung ${q.ten}`, ds = [];
      for (const c of che) {
        const d = c.d, t = d.ten.toLowerCase(), cao = `cao +${g(d.z)}${q.z > 0.5 ? ` (trên đáy khung ${g(c.z)})` : ''}`;
        if (c.mat === 'lung') ds.push(`${t} sau lưng tủ — cách mép trái khung ${g(c.x)}, ${cao}`);
        else if (c.mat === 'day') ds.push(`${t} dưới đáy tủ — cách mép trái khung ${g(c.x)}, cách tường lưng ${g(q.sau - c.y)}`);
        else ds.push(`${t} (tường ${d.w.ten}) sau hồi ${c.mat === 'trai' ? 'trái' : 'phải'} — cách tường lưng ${g(q.sau - c.y)}, ${cao}`);
        if (d.loai === 'cong_tac') luu_y.push(`${ten} che ${t} — công tắc sẽ không bấm được; dời khung hoặc chuyển công tắc.`);
        else if (d.loai === 'thoat_san') luu_y.push(`${ten} trùm lên ${t} — tủ che mất thoát sàn (nước không thoát, không thông ống được); dời khung hoặc để hở chân tủ chỗ đó.`);
        else if (c.cat) luu_y.push(`${ten}: mép khung cắt ngang ${t} — hồi / nóc tủ sẽ đè lên điểm này; dời khung hoặc dời điểm.`);
      }
      ghi_chu.push(`${ten} che ${che.length} điểm điện – nước: ${ds.join('; ')}. ${q.kieu === 'kho' ? 'Khung đặt mẫu kho: vẽ xong tự khoét tấm che điểm đó trong Chenfeng.' : 'Mở khung thành tủ để xem điểm rơi vào khoang nào, khoét tấm nào.'}`);
    });
    return H;
  }

  /**
   * Điểm điện – nước nào bị một tủ / một khung che (bản 1.18).
   * k = { goc: [x, y, z] góc trái – trước – dưới trong TOẠ ĐỘ BẢN VẼ (như `datKhung` trả về), xoay (độ), rong, sau, cao }.
   * @returns [{ d (phần tử của H.dn), mat: 'lung' | 'trai' | 'phai' | 'day', x, y, z, cat }]
   *   x, y, z = TÂM điểm trong hệ của tủ: x từ mép trái, y từ mặt trước vào lưng, z từ mép dưới. cat = mép tủ cắt ngang ô của điểm (điểm không nằm gọn sau một mặt).
   */
  function diemTrongKhung(H, k, opt) {
    const out = [], o = (H.p && H.p.goc) || [0, 0, 0], a = (k.xoay || 0) * Math.PI / 180, ex = [Math.cos(a), Math.sin(a)], ey = [-Math.sin(a), Math.cos(a)];
    const HO = opt && opt.ho >= 0 ? opt.ho : 60;      // tủ cách mặt tường tới 60 vẫn coi là áp tường đó (phào bên 50, lưng hở kỹ thuật)
    for (const d of H.dn || []) {
      const v = [d.P[0] + o[0] - k.goc[0], d.P[1] + o[1] - k.goc[1]], x = cham(v, ex), y = cham(v, ey), z = d.z + o[2] - k.goc[2], r = d.rong / 2, h = d.cao_o / 2;
      if (d.san) {
        if (Math.abs(z) > 50) continue;      // tủ treo: không che điểm dưới sàn
        if (x + r <= 0.5 || x - r >= k.rong - 0.5 || y + r <= 0.5 || y - r >= k.sau - 0.5) continue;
        out.push({ d, mat: 'day', x: rn(x), y: rn(y), z: 0, cat: x - r < -0.5 || x + r > k.rong + 0.5 || y - r < -0.5 || y + r > k.sau + 0.5 });
        continue;
      }
      if (z + h <= 0.5 || z - h >= k.cao - 0.5) continue;
      const nx = cham(d.w.n, ex), ny = cham(d.w.n, ey), catZ = z - h < -0.5 || z + h > k.cao + 0.5;
      if (ny < -0.99 && Math.abs(y - k.sau) <= HO) {      // tường sau lưng tủ
        if (x + r <= 0.5 || x - r >= k.rong - 0.5) continue;
        out.push({ d, mat: 'lung', x: rn(x), y: rn(k.sau), z: rn(z), cat: catZ || x - r < -0.5 || x + r > k.rong + 0.5 });
      } else if (Math.abs(nx) > 0.99 && Math.abs(x - (nx > 0 ? 0 : k.rong)) <= HO) {      // tường bên: sau hồi trái / phải
        if (y + r <= 0.5 || y - r >= k.sau - 0.5) continue;
        out.push({ d, mat: nx > 0 ? 'trai' : 'phai', x: nx > 0 ? 0 : rn(k.rong), y: rn(y), z: rn(z), cat: catZ || y - r < -0.5 || y + r > k.sau + 0.5 });
      }
    }
    return out;
  }

  /**
   * ĐIỆN – NƯỚC so với TỪNG TẤM của tủ đã dựng (bản 1.18). M = MNCFCore.build(spec); khung = { goc: [x, y, z], xoay } = chỗ đặt tủ trong bản vẽ
   * (góc trái – trước – dưới của cả tủ, đúng như lúc vẽ). Không cần MNCFCore: chỉ đọc M.parts / M.info.
   * @returns {{ diem: [{ j, ten, nhan, nhom, loai, mat, x, y, z (toạ độ thiết kế của tủ), rong, cao, tron, mau, khoang, trung: [tên tấm], hau }], luu_y: string[], ghi_chu: string[] }}
   *   luu_y = điểm trúng vách / đợt / hồi, nằm sau ngăn kéo, công tắc – thoát sàn bị tủ che; ghi_chu = điểm nằm gọn sau hậu / dưới đáy: khoét ở đâu.
   */
  function dienNuocChoTu(M, H, khung) {
    const kq = { diem: [], luu_y: [], ghi_chu: [] }, bb = M && M.info && M.info.hop;
    if (!bb || !H || !(H.dn || []).length || !khung || !Array.isArray(khung.goc)) return kq;
    const k = { goc: khung.goc, xoay: khung.xoay || 0, rong: bb.x1 - bb.x0, sau: bb.y1 - bb.y0, cao: bb.z1 - bb.z0 };
    const o = (H.p && H.p.goc) || [0, 0, 0], chamSan = Math.abs(k.goc[2] - o[2]) < 1;
    const xk = M.info.x_khoang || [], wk = M.info.khoang || [], cells = M.info.o || [];
    const chong = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0) > 0.5;
    const tenTam = q => String(q.ten || q.loai).toLowerCase() + (q.khoang >= 0 && /^(DOT|DAY|NOC|HAU)$/.test(q.loai) ? ` khoang ${q.khoang + 1}` : '');
    const khoangCua = x => xk.findIndex((x0, i) => x >= x0 - 0.5 && x <= x0 + wk[i] + 0.5);
    // tấm bị trúng kèm chỗ nó đang đứng (để biết phải kéo đi bao nhiêu): tấm đứng ghi theo chiều ngang, tấm nằm ghi theo cao độ — đều tính từ mép trái / mép dưới tủ
    const choTam = q => `${tenTam(q)} (${/^(HOI|VACH|DEM)$/.test(q.loai) ? `đang ở ${g(q.x0 - bb.x0)} → ${g(q.x1 - bb.x0)}` : `cao ${g(q.z0 - bb.z0)} → ${g(q.z1 - bb.z0)}`})`;
    for (const c of diemTrongKhung(H, k)) {
      const d = c.d, r = d.rong / 2, h = d.cao_o / 2, x = c.x + bb.x0, y = c.y + bb.y0, z = c.z + bb.z0, T = d.ten;
      const it = { j: d.j, ten: T, nhan: d.nhan, nhom: d.nhom, loai: d.loai, mat: c.mat, x: rn(x), y: rn(y), z: rn(z), rong: d.rong, cao: d.cao_o, tron: d.tron, mau: MAU_DN[d.nhom], khoang: -1, trung: [], hau: '' };
      const co = d.tron ? `Ø${g(d.rong)}` : `${g(d.rong)} × ${g(d.cao_o)}`, caoTxt = chamSan ? `cao +${g(d.z)}` : `cao ${g(c.z)} từ mép dưới tủ`;
      if (c.mat === 'lung') {
        it.khoang = khoangCua(x);
        const o2 = cells.find(q => x >= q.x0 - 0.5 && x <= q.x1 + 0.5 && z >= q.z0 - 0.5 && z <= q.z1 + 0.5);
        let hau = null; const cho2 = [];
        for (const q of M.parts) {
          if (q.loai === 'CANH' || !chong(q.x0, q.x1, x - r, x + r) || !chong(q.z0, q.z1, z - h, z + h)) continue;
          if (q.loai === 'HAU' && !q.van_thung) { if (!hau || (x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1)) hau = q; continue; }
          if (q.y1 < bb.y1 - 40) continue;      // tấm không ra tới lưng tủ (chân trước, phào, xà / nẹp hộc kéo…)
          it.trung.push(tenTam(q)); cho2.push(choTam(q));
        }
        const cho = it.khoang >= 0 ? `khoang ${it.khoang + 1}${o2 ? `, ô +${g(o2.z0)} → +${g(o2.z1)}` : ''}` : '', vt = `tâm cách mép trái tủ ${g(c.x)}, ${caoTxt}`;
        if (hau) it.hau = `khoét ${tenTam(hau)} ${co}: tâm cách mép trái tấm ${g(x - hau.x0)}, cách mép dưới tấm ${g(z - hau.z0)} (nhìn từ trong tủ)`;
        const che = d.loai === 'cong_tac' ? ' Tủ che công tắc — không bấm được nữa: dời tủ hoặc chuyển công tắc.' : '';
        if (it.trung.length) kq.luu_y.push(`${T} sau lưng tủ (${vt}) TRÚNG ${cho2.join(', ')}: ô ${co} chiếm ${g(c.x - r)} → ${g(c.x + r)} tính từ mép trái tủ, cao ${g(c.z - h)} → ${g(c.z + h)}. Kéo vách / đợt tránh ra, hoặc khoét tấm đó.${che}`);
        else if (o2 && (o2.kieu === 'nk_am' || o2.kieu === 'nk_trum')) kq.luu_y.push(`${T} nằm sau hộc ngăn kéo (${cho}; ${vt}) — ngăn kéo che mất, hộp kéo có thể vướng phích cắm / đầu ống. Đổi ô đó thành ô trống hoặc dời ngăn kéo.${che}`);
        else if (!hau) kq.luu_y.push(`${T} sau lưng tủ (${vt}) không nằm trong lòng khoang nào (sau chân tủ / phào) — tủ che kín, không với tới từ trong tủ.${che}`);
        else (che ? kq.luu_y : kq.ghi_chu).push(`${T}: sau lưng tủ, ${cho || 'ngoài các khoang'} — ${vt}. ${it.hau.charAt(0).toUpperCase() + it.hau.slice(1)}.${che}`);
      } else if (c.mat === 'day') {
        it.khoang = khoangCua(x);
        let day = null; const cho2 = [];
        for (const q of M.parts) {
          if (q.loai === 'CANH' || !chong(q.x0, q.x1, x - r, x + r) || !chong(q.y0, q.y1, y - r, y + r)) continue;
          if (q.z0 > bb.z0 + 0.5) { if (q.loai === 'DAY' && (!day || q.z0 < day.z0)) day = q; continue; }      // tấm không chạm sàn; đáy thấp nhất = tấm phải khoét
          it.trung.push(tenTam(q)); cho2.push(/^(HOI|VACH|DEM)$/.test(q.loai) ? choTam(q) : tenTam(q));
        }
        const vt = `tâm cách mép trái tủ ${g(c.x)}, cách lưng tủ ${g(k.sau - c.y)}`;
        if (d.loai === 'thoat_san') kq.luu_y.push(`${T} nằm dưới tủ (${it.khoang >= 0 ? `khoang ${it.khoang + 1}; ` : ''}${vt}) — tủ che mất thoát sàn: nước không thoát, không thông ống được. Dời tủ hoặc để hở chân tủ chỗ đó.`);
        else if (it.trung.length) kq.luu_y.push(`${T} dưới tủ (${vt}) TRÚNG ${cho2.join(', ')} — ống ${co} chiếm ${g(c.x - r)} → ${g(c.x + r)} tính từ mép trái tủ, đâm vào tấm chạm sàn. Kéo vách tránh ra hoặc dời tủ.`);
        else { if (day) it.hau = `khoét ${tenTam(day)} ${co}: tâm cách mép trái tấm ${g(x - day.x0)}, cách mép sau tấm ${g(day.y1 - y)}`; kq.ghi_chu.push(`${T}: dưới đáy tủ${it.khoang >= 0 ? `, khoang ${it.khoang + 1}` : ''} — ${vt}. ${it.hau ? it.hau.charAt(0).toUpperCase() + it.hau.slice(1) : `Khoét đáy ${co}`}.`); }
      } else {
        const ben = c.mat === 'trai' ? 'trái' : 'phải';
        kq.luu_y.push(`${T} (tường ${d.w.ten}) nằm sau hồi ${ben} của tủ — cách lưng tủ ${g(k.sau - c.y)}, ${caoTxt}: bị tủ che kín${d.loai === 'cong_tac' ? ', công tắc không bấm được nữa' : ''}. Dời tủ ra, dời điểm này, hoặc khoét hồi ${co}.`);
      }
      kq.diem.push(it);
    }
    return kq;
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
   * CHIA Ô (bản 1.19 — anh Jason 03/10/2026 20:49: "chia ô ra rồi chọn vào từng khu vực"): thay khung j bằng n khung con bằng nhau.
   * chieu = 'doc' (mặc định): n ô đứng cạnh nhau dọc theo tường, từ trái sang phải; 'ngang': n ô chồng lên nhau, từ dưới lên.
   * Ô con giữ sâu, loại (tủ tự chia / mẫu kho) và ruột tủ của khung mẹ; mẫu kho đã chọn và dấu "đã vẽ" thì bỏ (mỗi ô chọn lại). Số lẻ dồn vào ô cuối.
   * @returns {{ p, tu, den }} phòng mới + chỉ số ô đầu / ô cuối trong p.khung, hoặc null nếu không chia được.
   */
  function chiaKhung(pIn, j, n, chieu) {
    const p = chuanHoa(pIn), q = p.khung[j];
    n = Math.round(num(n, 0));
    if (!q || !(n >= 2 && n <= 12)) return null;
    const doc = chieu !== 'ngang', tong = doc ? q.rong : q.cao, moi_o = Math.floor(tong / n);
    if (!(moi_o >= 50)) return null;
    const ds = [], da = new Set(p.khung.filter((x, i) => i !== j).map(x => x.ten));
    for (let i = 0, tu = 0; i < n; i++) {
      const kt = i === n - 1 ? rn(tong - tu, 1) : moi_o;
      let ten = `${q.ten}.${i + 1}`.slice(0, 24); while (da.has(ten)) ten = (ten.slice(0, 23) + "'"); da.add(ten);
      const o = { ten, tuong: q.tuong, cach: doc ? rn(q.cach + tu, 1) : q.cach, z: doc ? q.z : rn(q.z + tu, 1), rong: doc ? kt : q.rong, cao: doc ? q.cao : kt, sau: q.sau, mau: q.mau, ghi_chu: '' };
      if (q.kieu === 'kho') { o.kieu = 'kho'; if (q.nhom) o.nhom = q.nhom; }
      ds.push(o); tu += kt;
    }
    p.khung.splice(j, 1, ...ds);
    return { p: chuanHoa(p), tu: j, den: j + n - 1 };
  }

  /**
   * Đổi RỘNG / CAO của một ô (khung j) mà không làm hở, không làm chồng (bản 1.19 — sửa số ngay trên mặt đứng):
   * ô KỀ = khung cùng tường, chạm mép với ô đang sửa và trùng khít phạm vi theo chiều kia (cùng hàng khi sửa rộng, cùng cột khi sửa cao).
   * Có ô kề phía sau (bên phải / phía trên) → mép đầu của ô đang sửa đứng yên, ô kề co / giãn bù. Không có mà có ô kề phía trước (trái / dưới)
   * → mép cuối đứng yên, ô kề trước nhận bù. Không có ô kề nào → chỉ đổi kích thước ô đó (mép trái / mép dưới đứng yên).
   * @returns {{ p, ke: tên ô nhận bù | '' }} | {{ loi }} | null
   */
  function doiCoKhung(pIn, j, chieu, v) {
    const p = chuanHoa(pIn), q = p.khung[j];
    v = num(v, NaN);
    if (!q || !(v >= 50)) return null;
    const doc = chieu !== 'cao', kt = doc ? 'rong' : 'cao', vt = doc ? 'cach' : 'z', d = rn(v - q[kt], 2);
    if (Math.abs(d) < 0.05) return { p, ke: '' };
    const khit = k => (doc ? Math.abs(k.z - q.z) < 0.5 && Math.abs(k.cao - q.cao) < 0.5 : Math.abs(k.cach - q.cach) < 0.5 && Math.abs(k.rong - q.rong) < 0.5);
    const ung = p.khung.filter((k, i) => i !== j && k.tuong === q.tuong && khit(k));
    const sau = ung.find(k => Math.abs(k[vt] - (q[vt] + q[kt])) < 0.5), truoc = ung.find(k => Math.abs(k[vt] + k[kt] - q[vt]) < 0.5);
    const ke = sau || truoc;
    if (ke && ke[kt] - d < 50) return { loi: `Ô kề ${ke.ten} chỉ còn ${g(ke[kt] - d)} — không đủ chỗ (mỗi ô phải từ 50 trở lên). Sửa ô kề trước, hoặc gõ số nhỏ hơn.` };
    q[kt] = v;
    if (sau) { sau[vt] = rn(sau[vt] + d, 1); sau[kt] = rn(sau[kt] - d, 1); }
    else if (truoc) { q[vt] = rn(q[vt] - d, 1); truoc[kt] = rn(truoc[kt] - d, 1); }
    return { p: chuanHoa(p), ke: ke ? ke.ten : '' };
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
    // khung treo (đáy cao hơn sàn — ô trên của vách tivi, tủ treo đầu giường): tủ không có chân
    if (q.z > 0.5 && s.chan && s.chan.cao > 0) { s.chan = Object.assign({}, s.chan, { cao: 0 }); ghi.push(`Khung treo (đáy +${g(q.z)}): bỏ chân tủ.`); }
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
    // trần chỗ đặt khung (bản 1.20) → lõi kiểm thân tủ ráp nằm rồi lật đứng có lọt trần không. Khung treo không lật từ sàn lên nên không kiểm.
    { const qH = H && j >= 0 && H.khung && H.khung[j]; if (qH) s.kiem = Object.assign({}, s.kiem, { tran: (qH.z0 > 0.5 || !(qH.w && qH.w.cao > 0)) ? 0 : qH.w.cao }); }
    s = Core.normalize(s);
    // sâu khung = sâu phủ bì kể cả cánh → trừ phần cánh nhô ra trước thùng
    const bb = Core.bbox(Core.build(s).parts);
    if (bb) { const sauPB = bb.y1 - bb.y0; s.sau_thung = rn(s.sau_thung + (q.sau - sauPB), 1); }
    // khấu cột (bản 1.13): cột / hộp kỹ thuật trùm đầu khung → tủ khoét theo cột. Khung mới thì luôn đặt lại (không giữ khấu của tủ trước).
    s.khau = { trai: { rong: 0, sau: 0 }, phai: { rong: 0, sau: 0 }, giua: [], ho: (s.khau && s.khau.ho >= 0) ? s.khau.ho : Core.DEFAULT_SPEC.khau.ho };
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

  /**
   * HAI ĐIỂM BẤM DỌC CHÂN TƯỜNG → HÌNH PHỦ BÌ CỦA TỦ (bản 1.17 — anh Jason 03/10/2026 23:13: "vẽ hình chữ nhật chọn rất khó, làm sao … nhanh").
   * p1, p2 = hai đầu LƯNG tủ trên mặt bằng (bấm theo thứ tự nào cũng được); sau = chiều sâu phủ bì của tủ. Trả về 4 đỉnh hình chữ nhật để đưa tiếp vào `hinhThanhKhung`.
   * Phía TRƯỚC tủ:
   *   opt.truoc = [x, y]  điểm người dùng bấm thêm → phía đó;
   *   không có thì dò tường: điểm ĐẦU nằm trên một MẶT tường (opt.tuong[i] = { a, b, ra: [nx, ny] hướng từ thân tường ra ngoài mặt đó }, lệch tối đa 30 mm) và điểm thứ hai
   *     chạy dọc mặt đó → tủ quay ra phía `ra`; hai điểm được chiếu về đúng mặt tường (lưng tủ áp sát tường, không lệch góc vì bấm trượt, bấm vào mép cột cũng được);
   *   vẫn không rõ → can_diem = true (gọi lại với opt.truoc).
   * Không bám tường nào mà đoạn p1–p2 lệch trục x / y dưới 1,5° thì nắn thẳng theo trục.
   * opt.rong > 0: bề rộng tủ đã biết (đang gõ trong bảng, hoặc người dùng gõ số) — p2 khi đó chỉ cho biết tủ chạy về PHÍA nào kể từ p1.
   * @returns {{ ok, loi, can_diem, dinh: number[][], truoc: number[], rong, bam_tuong, mat_truoc }}
   */
  function haiDiemThanhHinh(p1, p2, sau, opt) {
    opt = opt || {};
    const kq = { ok: false, loi: '', can_diem: false };
    const hong = t => { kq.loi = t; return kq; };
    const so2 = q => (Array.isArray(q) ? [Number(q[0]), Number(q[1])] : [NaN, NaN]);
    let a = so2(p1), b = so2(p2);
    if (![a[0], a[1], b[0], b[1]].every(isFinite)) return hong('Chưa đủ 2 điểm.');
    sau = Number(sau);
    if (!(sau >= 100)) return hong('Chiều sâu tủ chưa hợp lệ (ô Sâu ở thẻ Tủ).');
    const rongBiet = Number(opt.rong) > 0 ? Number(opt.rong) : 0;
    if (rongBiet && rongBiet < 200) return hong('Bề rộng tủ phải từ 200 trở lên.');
    if (!(Math.hypot(b[0] - a[0], b[1] - a[1]) >= (rongBiet ? 20 : 200))) return hong(rongBiet ? 'Chưa rõ tủ chạy về phía nào — rê chuột dọc tường về phía tủ chạy tới rồi mới Enter.' : 'Hai điểm quá gần nhau (tủ rộng dưới 200) — bấm lại điểm đầu và điểm cuối của tủ.');
    // Mặt tường đi qua điểm ĐẦU (lệch ≤ 30, hình chiếu nằm trong đoạn mặt tường nới 30). Điểm thứ hai chỉ cần cho biết chạy DỌC mặt đó tới đâu (được chiếu lên đường mặt tường),
    // nên bấm vào mép cột, hay rê chuột lệch khỏi tường rồi Enter đều được. Điểm đầu ở góc phòng (nằm trên 2 mặt tường): lấy mặt mà điểm thứ hai chạy dọc theo nhiều nhất.
    let bam = null;
    for (const w of opt.tuong || []) {
      if (!w || !w.a || !w.b) continue;
      const dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1], Lw = Math.hypot(dx, dy);
      if (Lw < 50) continue;
      const ux = dx / Lw, uy = dy / Lw, kc = q => Math.abs(-(q[0] - w.a[0]) * uy + (q[1] - w.a[1]) * ux), doc = q => (q[0] - w.a[0]) * ux + (q[1] - w.a[1]) * uy;
      const d1 = kc(a), t1 = doc(a);
      if (d1 > 30 || t1 < -30 || t1 > Lw + 30) continue;
      const t2 = doc(b), diem = Math.abs(t2 - t1) - kc(b);      // chạy dọc nhiều hơn lệch ngang thì mới coi là đi theo mặt này
      if (diem <= 0) continue;
      if (!bam || diem > bam.diem + 1 || (Math.abs(diem - bam.diem) <= 1 && d1 < bam.d1)) bam = { w, diem, d1, t1, t2, ux, uy };
    }
    if (bam) { const w = bam.w; a = [w.a[0] + bam.ux * bam.t1, w.a[1] + bam.uy * bam.t1]; b = [w.a[0] + bam.ux * bam.t2, w.a[1] + bam.uy * bam.t2]; }
    else {
      const dx = b[0] - a[0], dy = b[1] - a[1], GOC = Math.tan(1.5 * Math.PI / 180);
      if (Math.abs(dy) <= Math.abs(dx) * GOC) b = [b[0], a[1]]; else if (Math.abs(dx) <= Math.abs(dy) * GOC) b = [a[0], b[1]];
    }
    let L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!(L >= (rongBiet ? 5 : 200))) return hong(rongBiet ? 'Chưa rõ tủ chạy về phía nào — rê chuột dọc tường về phía tủ chạy tới rồi mới Enter.' : 'Hai điểm quá gần nhau (tủ rộng dưới 200) — bấm lại điểm đầu và điểm cuối của tủ.');
    const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], n1 = [-u[1], u[0]];
    if (rongBiet) { b = [a[0] + u[0] * rongBiet, a[1] + u[1] * rongBiet]; L = rongBiet; }
    let n = null, cach = '';
    if (Array.isArray(opt.truoc) && opt.truoc.length >= 2) {
      const d = cham([Number(opt.truoc[0]) - a[0], Number(opt.truoc[1]) - a[1]], n1);
      if (!(Math.abs(d) >= 1)) return hong('Điểm phía trước nằm ngay trên lưng tủ — bấm lại 1 điểm ở phía TRƯỚC tủ (phía đứng mở cánh).');
      n = d > 0 ? n1 : [-n1[0], -n1[1]]; cach = 'điểm anh bấm';
    } else if (bam && Array.isArray(bam.w.ra) && Math.abs(cham(bam.w.ra, n1)) > 0.5) {
      n = cham(bam.w.ra, n1) > 0 ? n1 : [-n1[0], -n1[1]]; cach = 'tường phía sau';
    } else { kq.can_diem = true; return hong('Hai điểm không nằm trên mặt tường nào của phòng — bấm thêm 1 điểm ở phía TRƯỚC tủ (phía đứng mở cánh).'); }
    const r2 = q => [rn(q[0], 2), rn(q[1], 2)];
    kq.ok = true;
    kq.dinh = [a, b, [b[0] + n[0] * sau, b[1] + n[1] * sau], [a[0] + n[0] * sau, a[1] + n[1] * sau]].map(r2);
    kq.truoc = r2([(a[0] + b[0]) / 2 + n[0] * (sau + 300), (a[1] + b[1]) / 2 + n[1] * (sau + 300)]);
    kq.rong = rn(L, 1); kq.bam_tuong = !!bam; kq.mat_truoc = cach;
    return kq;
  }

  /**
   * Dấu ĐIỆN – NƯỚC để vẽ vào bản vẽ (bản 1.18): một bản vẽ DXF nhỏ (chuỗi). Chenfeng nhận file .dxf thả vào vùng vẽ và dựng Line / Circle / Polyline / Text
   * đúng toạ độ trong file (lệnh "CAD图纸导入" — 1 bước hoàn tác).
   *   Điểm trên tường: ô đúng cỡ nằm trên mặt tường (nhô 2 mm vào phòng cho khỏi chìm vào mặt tường) + dấu riêng từng loại + nhãn "ký hiệu +cao".
   *   Điểm dưới sàn: vòng tròn trên sàn (thoát sàn gạch chéo, ống chờ có vòng trong) + nhãn.
   * Mặt tường trong DXF: hướng đùn (mã 210 / 220 / 230) = pháp tuyến n của tường; Chenfeng lấy trục x của mặt = ẑ × n (đúng bằng hướng chạy d của tường), trục y = ẑ
   * — đã đo trên Chenfeng thật 04/10/2026. Nhãn KHÔNG DẤU (phông của Chenfeng thiếu chữ Việt). Màu theo bảng màu CAD (đã xem trên nền tường xám lẫn sàn tối của Chenfeng): điện 30 (cam), cấp nước 140 (xanh), thoát 34 (nâu), khác 200 (tím).
   * @returns {{ dxf: string, so: number, hop: {x0, x1, y0, y1, z0, z1} | null }}  so = số điểm có dấu; hop = hộp bao các nét (không kể chữ) để máy vẽ đối chiếu sau khi thả
   */
  function dienNuocDXF(H, opt) {
    opt = Object.assign({ nho: 2, cao_chu: 40 }, opt || {});
    const o = (H && H.p && H.p.goc) || [0, 0, 0], E = [], hop = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
    const MAU = { dien: 30, cap: 140, thoat: 34, khac: 200 }, f = v => String(rn(v, 3)), ct = opt.cao_chu;
    const khongDau = t => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
    const ghi = (...kv) => { for (let i = 0; i < kv.length; i += 2) E.push(String(kv[i]), String(kv[i + 1])); };
    const bao = q => { hop.x0 = Math.min(hop.x0, q[0]); hop.x1 = Math.max(hop.x1, q[0]); hop.y0 = Math.min(hop.y0, q[1]); hop.y1 = Math.max(hop.y1, q[1]); hop.z0 = Math.min(hop.z0, q[2]); hop.z1 = Math.max(hop.z1, q[2]); };
    const doan = (a, b, mau) => { ghi(0, 'LINE', 8, '0', 62, mau, 10, f(a[0]), 20, f(a[1]), 30, f(a[2]), 11, f(b[0]), 21, f(b[1]), 31, f(b[2])); bao(a); bao(b); };
    let so = 0;
    ghi(0, 'SECTION', 2, 'ENTITIES');
    for (const d of (H && H.dn) || []) {
      const w = d.w, mau = MAU[d.nhom] || 7, r = d.rong / 2, h = d.cao_o / 2, nhan = khongDau(d.nhan);
      if (d.cach < -0.05 || d.cach > w.dai + 0.05) continue;
      so++;
      if (d.san) {
        // trên sàn: mặt phẳng XY, nhô 1 mm khỏi mặt sàn
        const c = [d.P[0] + o[0], d.P[1] + o[1], o[2] + 1], k = r * 0.7071;
        ghi(0, 'CIRCLE', 8, '0', 62, mau, 10, f(c[0]), 20, f(c[1]), 30, f(c[2]), 40, f(r));
        bao([c[0] - r, c[1] - r, c[2]]); bao([c[0] + r, c[1] + r, c[2]]);
        if (d.loai === 'thoat_san') { doan([c[0] - k, c[1] - k, c[2]], [c[0] + k, c[1] + k, c[2]], mau); doan([c[0] - k, c[1] + k, c[2]], [c[0] + k, c[1] - k, c[2]], mau); }
        else ghi(0, 'CIRCLE', 8, '0', 62, mau, 10, f(c[0]), 20, f(c[1]), 30, f(c[2]), 40, f(r * 0.45));
        ghi(0, 'TEXT', 8, '0', 62, mau, 10, f(c[0] + r + 20), 20, f(c[1] - ct / 2), 30, f(c[2]), 40, f(ct), 1, nhan);
        continue;
      }
      // trên tường: toạ độ trong mặt tường (u dọc tường = P·d, v = cao độ), cao trình của mặt = P·n + nhô
      const C = [d.P[0] + o[0], d.P[1] + o[1], d.z + o[2]], n = w.n, dd = w.d, u0 = C[0] * dd[0] + C[1] * dd[1], v0 = C[2], e = C[0] * n[0] + C[1] * n[1] + opt.nho;
      const W3 = (u, v) => [C[0] + dd[0] * (u - u0) + n[0] * opt.nho, C[1] + dd[1] * (u - u0) + n[1] * opt.nho, v];      // điểm (u, v) của mặt tường → toạ độ bản vẽ
      const dun = [210, f(n[0]), 220, f(n[1]), 230, 0], tron = (u, v, bk) => ghi(0, 'CIRCLE', 8, '0', 62, mau, 10, f(u), 20, f(v), 30, f(e), 40, f(bk), ...dun);
      if (d.tron) {
        tron(u0, v0, r);
        if (d.loai === 'thoat_nuoc') tron(u0, v0, r * 0.45);
        else { doan(W3(u0 - r * 0.6, v0), W3(u0 + r * 0.6, v0), mau); doan(W3(u0, v0 - r * 0.6), W3(u0, v0 + r * 0.6), mau); }
      } else {
        ghi(0, 'LWPOLYLINE', 8, '0', 62, mau, 90, 4, 70, 1, 38, f(e), 10, f(u0 - r), 20, f(v0 - h), 10, f(u0 + r), 20, f(v0 - h), 10, f(u0 + r), 20, f(v0 + h), 10, f(u0 - r), 20, f(v0 + h), ...dun);
        if (d.loai === 'o_dien') { const a = Math.min(19, r * 0.4), bk = Math.min(7, h * 0.35); tron(u0 - a, v0, bk); tron(u0 + a, v0, bk); }
        else if (d.loai === 'cong_tac') doan(W3(u0, v0 - h * 0.6), W3(u0, v0 + h * 0.6), mau);
        else { doan(W3(u0 - r, v0 - h), W3(u0 + r, v0 + h), mau); doan(W3(u0 - r, v0 + h), W3(u0 + r, v0 - h), mau); }
      }
      bao(W3(u0 - r, v0 - h)); bao(W3(u0 + r, v0 + h));
      // nhãn bên phải ô; sát cuối tường thì ghi sang bên trái (bề rộng chữ ≈ 0,82 × cao chữ mỗi ký tự — đo trên Chenfeng)
      const chu = `${nhan} +${g(d.z).replace(',', '.')}`, rongChu = chu.length * ct * 0.82, uc = d.cach + r + 20 + rongChu > w.dai && d.cach - r - 20 - rongChu > 0 ? u0 - r - 20 - rongChu : u0 + r + 20;
      ghi(0, 'TEXT', 8, '0', 62, mau, 10, f(uc), 20, f(v0 - ct / 2), 30, f(e), 40, f(ct), 1, chu, ...dun);
      // dấu trên SÀN ở chân tường (để nhìn từ trên xuống — lúc đặt tủ trên mặt bằng — vẫn thấy điểm nằm đâu): tam giác chỉ vào tường + ký hiệu, chữ chạy dọc tường và đọc xuôi
      const zs = o[2] + 1, F = (s2, t2) => [C[0] + dd[0] * s2 + n[0] * t2, C[1] + dd[1] * s2 + n[1] * t2, zs], ctn = ct * 0.75;
      doan(F(-30, opt.nho), F(30, opt.nho), mau); doan(F(30, opt.nho), F(0, 55), mau); doan(F(0, 55), F(-30, opt.nho), mau);
      let goc = ((w.a % 360) + 360) % 360, lat = false; if (goc > 90 && goc <= 270) { goc -= 180; lat = true; }      // chữ chạy theo d hoặc ngược d cho khỏi lộn đầu
      const tx = lat ? [-dd[0], -dd[1]] : dd, len = [-tx[1], tx[0]], rc = nhan.length * ctn * 0.82, tam = F(0, 70 + ctn / 2);      // len = hướng "lên" của chữ; tam = tâm chữ
      ghi(0, 'TEXT', 8, '0', 62, mau, 10, f(tam[0] - tx[0] * rc / 2 - len[0] * ctn / 2), 20, f(tam[1] - tx[1] * rc / 2 - len[1] * ctn / 2), 30, f(zs), 40, f(ctn), 1, nhan, 50, f(goc));
    }
    ghi(0, 'ENDSEC', 0, 'EOF');
    if (!so) return { dxf: '', so: 0, hop: null };
    for (const k in hop) hop[k] = rn(hop[k], 2);
    return { dxf: E.join('\n') + '\n', so, hop };
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
    if ((p.dn || []).length) { const dem = {}; for (const d of p.dn) dem[d.loai] = (dem[d.loai] || 0) + 1; L.push('Điện – nước: ' + Object.keys(LOAI_DN).filter(k => dem[k]).map(k => `${dem[k]} ${LOAI_DN[k].ten.toLowerCase()}`).join(' · ')); }
    if (p.khung.length) L.push(`${p.khung.length} khung không gian: ` + p.khung.map(k => `${k.ten} ${g(k.rong)}×${g(k.cao)}×${g(k.sau)}${k.kieu === 'kho' ? (k.kho ? ` (mẫu kho: ${k.kho.ten})` : ' (mẫu kho)') : ''}`).join(' · '));
    return L;
  }

  /* ---------------- hình vẽ ---------------- */
  // Hình vẽ luôn là "tờ giấy sáng" (như hình đứng của tủ), kể cả khi giao diện ở chế độ tối → dùng màu cố định
  const M_NEN = '#fbfaf7', M_TUONG = '#1b2420', M_MO = '#5d6861', M_NHAN = '#1c5fb8', M_LOI = '#d9402b', M_CAN = '#8a9099', M_TRANG = '#ffffff', M_KHO = '#0b7a5e';      // M_KHO: khung đặt mẫu kho

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
      const on = opts.chon_khung === j, tam = tren(q.w, q.cach + q.rong / 2, q.sau / 2), kho = q.kieu === 'kho', mau = kho ? M_KHO : M_NHAN;
      // nhiều ô chồng nhau trên cùng một đoạn tường (chia ngang) thì trên mặt bằng trùng nhau: ô đang chọn vẽ đậm, các ô còn lại vẫn bấm được ở mặt đứng
      o += `<polygon data-khung="${j}" points="${poly(q.poly)}" fill="${mau}" fill-opacity="${on ? '.38' : '.16'}" stroke="${mau}" stroke-width="${f(fs / (on ? 4 : 7))}" style="cursor:pointer"><title>Khung ${esc(q.ten)}: rộng ${g(q.rong)} × cao ${g(q.cao)} × sâu ${g(q.sau)}${q.z > 0.5 ? `, đáy +${g(q.z)}` : ''}${kho ? ` — mẫu kho${q.kho ? ': ' + esc(q.kho.ten) : ' (chưa chọn)'}` : ''}</title></polygon>`;
      const trung = (H.khung || []).map((x, i) => ({ x, i })).filter(t => t.i !== j && t.x.tuong === q.tuong && t.x.rong > 0 && Math.min(t.x.cach + t.x.rong, q.cach + q.rong) - Math.max(t.x.cach, q.cach) > 0.5);
      if (!on && (trung.some(t => t.i === opts.chon_khung) || trung.some(t => t.i < j))) return;
      const coT = Math.max(fs * 0.55, Math.min(fs, q.rong / (String(q.ten).length * 0.62 + 0.8)));
      o += `<text x="${X(tam)}" y="${f(-tam[1] + coT * 0.35)}" font-size="${f(coT)}" font-weight="700" text-anchor="middle" fill="${mau}" pointer-events="none" paint-order="stroke" stroke="${M_NEN}" stroke-width="${f(coT / 4)}">${esc(q.ten)}</text>`;
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
    // ĐIỆN – NƯỚC (bản 1.18): điểm trên tường = dấu nhỏ nhô vào phòng, sát mặt tường (điện: vuông · nước: tròn · khác: thoi); điểm dưới sàn = vòng tròn gạch chéo đúng chỗ.
    // Dấu mang data-dn = chỉ số điểm để giao diện đưa tới dòng của điểm đó.
    for (const d of H.dn || []) {
      const w = d.w, mau = MAU_DN[d.nhom], r0 = fs * 0.5;
      if (d.cach < -0.05 || d.cach > w.dai + 0.05) continue;
      const tip = `<title>${esc(d.ten)}: tường ${esc(w.ten)}, cách đầu trái ${g(d.cach)}, ${d.san ? `cách tường ${g(d.ra)}` : `cao +${g(d.z)}`}</title>`;
      let hd, nh;
      if (d.san) {
        const r = Math.max(d.rong / 2, r0), c = d.P, k = r * 0.7;
        hd = `<circle cx="${X(c)}" cy="${Y(c)}" r="${f(r)}" fill="${M_NEN}" stroke="${mau}" stroke-width="${f(fs / 6)}"/><path d="M ${f(c[0] - k)} ${f(-c[1] - k)} L ${f(c[0] + k)} ${f(-c[1] + k)} M ${f(c[0] - k)} ${f(-c[1] + k)} L ${f(c[0] + k)} ${f(-c[1] - k)}" stroke="${mau}" stroke-width="${f(fs / 9)}" fill="none"/>`;
        nh = [c[0], c[1] - r - fs * 0.65];
      } else {
        if (d.nhom === 'cap' || d.nhom === 'thoat') { const c = tren(w, d.cach, r0); hd = `<circle cx="${X(c)}" cy="${Y(c)}" r="${f(r0)}" fill="${mau}" stroke="${M_NEN}" stroke-width="${f(fs / 12)}"/>`; }
        else hd = `<polygon points="${poly(d.nhom === 'dien' ? [tren(w, d.cach - r0, 0), tren(w, d.cach + r0, 0), tren(w, d.cach + r0, r0 * 2), tren(w, d.cach - r0, r0 * 2)] : [tren(w, d.cach, 0), tren(w, d.cach + r0, r0), tren(w, d.cach, r0 * 2), tren(w, d.cach - r0, r0)])}" fill="${mau}" stroke="${M_NEN}" stroke-width="${f(fs / 12)}"/>`;
        nh = tren(w, d.cach, r0 * 2 + fs * 0.62);
      }
      o += `<g data-dn="${d.j}" style="cursor:pointer">${tip}${hd}<text x="${X(nh)}" y="${Y(nh)}" font-size="${f(fs * 0.82)}" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="${mau}" paint-order="stroke" stroke="${M_NEN}" stroke-width="${f(fs / 4)}">${esc(d.nhan)}</text></g>`;
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
    // điện – nước (bản 1.18): điểm trên tường này + điểm dưới sàn nằm gần tường này (cách mặt tường ≤ 800) → chừa thêm 1–2 hàng chữ dưới vạch sàn
    const dnT = (H.dn || []).filter(d => !d.san && d.tuong === i && d.cach >= -0.05 && d.cach <= L + 0.05);
    const dnS = (H.dn || []).filter(d => d.san).map(d => { const v = [d.P[0] - w.p0[0], d.P[1] - w.p0[1]]; return { d, s: cham(v, w.d), t: cham(v, w.n) }; }).filter(q => q.s >= -0.5 && q.s <= L + 0.5 && q.t >= -0.5 && q.t <= 800);
    // chữ dưới vạch sàn: hàng "cách trái" của điểm trên tường (điểm sát nhau thì so le 2 hàng), rồi hàng nhãn của điểm dưới sàn (cũng so le)
    const soLe = (ds, lay, gan) => { const h = new Map(); let tr = null; ds.slice().sort((a1, b1) => lay(a1) - lay(b1)).forEach(q => { h.set(q, tr && lay(q) - lay(tr) < gan && h.get(tr) === 0 ? 1 : 0); tr = q; }); return h; };
    const hgT = soLe(dnT, d => d.cach, fs * 3.9), hgS = soLe(dnS, q => q.s, fs * 12.5), hgN = soLe(dnT, d => d.cach, fs * 6.2), buoc = fs;      // hgN: nhãn "ký hiệu +cao" — điểm sát nhau thì nhãn điểm sau ghi DƯỚI ô
    const nT = dnT.length ? 1 + Math.max(0, ...hgT.values()) : 0, nS = dnS.length ? 1 + Math.max(0, ...hgS.values()) : 0;
    const them = nT + nS ? (nT + nS) * buoc + fs * 0.35 : 0, yd = C + m * 0.45 + them;
    const vb = [-m, -m * 0.8, L + 2 * m, C + m * 1.9 + them];
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
    // KHUNG trên tường này. Bản 1.19: ô chia nhỏ (vách tivi, đầu giường) → chữ co theo ô; khung đặt mẫu kho có màu + nét riêng và ghi tên mẫu;
    // opts.sua: rộng / cao / sâu / cách trái / đáy của khung bấm vào để gõ lại ngay trên hình (data-sua = "khung.j.…").
    const dsK = (H.khung || []).map((q, j) => ({ q, j })).filter(x => x.q.tuong === i && x.q.rong > 0 && x.q.cao > 0);
    const cungHang = (a, b) => Math.min(a.z + a.cao, b.z + b.cao) - Math.max(a.z, b.z) > 0.5;
    const suaK = (path, chu, tip) => (opts.sua ? `<tspan data-sua="${path}" style="cursor:text" text-decoration="underline">${chu}<title>${tip} — bấm để sửa</title></tspan>` : chu);
    for (const { q, j } of dsK) {
      const on = opts.chon_khung === j, kho = q.kieu === 'kho', mau = kho ? M_KHO : M_NHAN, cx = q.cach + q.rong / 2;
      o += R(q.cach, q.z, q.rong, q.cao, `data-khung="${j}" fill="${mau}" fill-opacity="${on ? '.3' : '.13'}" stroke="${mau}" stroke-width="${f(fs / (on ? 4 : 7))}"${kho ? ` stroke-dasharray="${f(fs * 0.9)} ${f(fs * 0.35)}"` : ''} style="cursor:pointer"`);
      // chữ co theo ô; ô HẸP MÀ CAO (cột bên của vách tivi) thì chữ xoay dọc theo chiều cao cho đủ chỗ
      const chuKT = `${g(q.rong)} × ${g(q.cao)} · sâu ${g(q.sau)}`, tenMau = kho ? (q.kho ? 'mẫu: ' + q.kho.ten : 'mẫu kho — chưa chọn') : '';
      const dungChu = q.cao > q.rong * 1.5 && q.rong / (chuKT.length * 0.58) < fs * 0.8, dai = dungChu ? q.cao : q.rong, ngan = dungChu ? q.rong : q.cao;
      const co = Math.max(fs * 0.5, Math.min(fs * 1.05, dai / 7.5, ngan / 4));
      const soDong = kho ? 3 : 2, cy = C - q.z - q.cao / 2, y0 = cy - (soDong - 2) * co * 0.6;
      const cat = (t, n) => (t.length > n ? t.slice(0, Math.max(1, n - 1)) + '…' : t), vua = Math.max(6, Math.floor(dai / (co * 0.42)));
      const coKT = Math.max(fs * 0.42, Math.min(co, dai / (chuKT.length * 0.58)));      // dòng kích thước không tràn khỏi ô
      o += `<text x="${f(cx)}" y="${f(y0)}" font-size="${f(co)}" text-anchor="middle" fill="${mau}" font-weight="700"${dungChu ? ` transform="rotate(-90 ${f(cx)} ${f(cy)})"` : ''}${opts.sua ? '' : ' pointer-events="none"'}><tspan x="${f(cx)}" pointer-events="none">${esc(cat(q.ten, vua))}</tspan>`
        + `<tspan x="${f(cx)}" dy="${f(co * 1.25)}" font-weight="400" font-size="${f(coKT)}">${suaK(`khung.${j}.rong`, g(q.rong), 'Rộng khung')}${opts.sua ? '<tspan pointer-events="none"> × </tspan>' : ' × '}${suaK(`khung.${j}.cao`, g(q.cao), 'Cao khung')}${opts.sua ? '<tspan pointer-events="none"> · sâu </tspan>' : ' · sâu '}${suaK(`khung.${j}.sau`, g(q.sau), 'Sâu khung (cả cánh)')}</tspan>`
        + (kho ? `<tspan x="${f(cx)}" dy="${f(co * 1.2)}" font-weight="400" font-size="${f(co * 0.85)}" pointer-events="none">${esc(cat(tenMau, Math.floor(vua * 1.15)))}</tspan>` : '') + '</text>';
      // khoảng hở bên trái: tới khung liền trái cùng hàng, không có thì tới đầu tường (số "cách trái" — bấm sửa được); bên phải chỉ ghi khi không còn khung nào ở phải
      const trai = dsK.filter(x => x.j !== j && cungHang(x.q, q) && x.q.cach + x.q.rong <= q.cach + 0.5).sort((a, b) => (b.q.cach + b.q.rong) - (a.q.cach + a.q.rong))[0];
      const tu = trai ? trai.q.cach + trai.q.rong : 0, ho = q.cach - tu, yk = C - q.z - fs * 0.5;
      if (ho > 0.5) o += `<text x="${f(tu + ho / 2)}" y="${f(yk)}" font-size="${f(fs * 0.8)}" text-anchor="middle" fill="${mau}"${opts.sua && !trai ? ` data-sua="khung.${j}.cach" style="cursor:text" text-decoration="underline"` : ''}>${g(ho)}${opts.sua && !trai ? '<title>Khung cách đầu trái tường — bấm để sửa</title>' : ''}</text>`;
      const coPhai = dsK.some(x => x.j !== j && cungHang(x.q, q) && x.q.cach >= q.cach + q.rong - 0.5), con = L - q.cach - q.rong;
      if (!coPhai && con > 0.5) o += `<text x="${f(q.cach + q.rong + con / 2)}" y="${f(yk)}" font-size="${f(fs * 0.8)}" text-anchor="middle" fill="${mau}">${g(con)}</text>`;
      // khung treo: cao độ đáy ghi ở góc dưới trái ô
      if (q.z > 0.5) o += `<text x="${f(q.cach + co * 0.35)}" y="${f(C - q.z - co * 0.4)}" font-size="${f(co * 0.78)}" fill="${mau}"${opts.sua ? ` data-sua="khung.${j}.z" style="cursor:text" text-decoration="underline"` : ' pointer-events="none"'}>+${g(q.z)}${opts.sua ? '<title>Đáy khung cao hơn sàn — bấm để sửa</title>' : ''}</text>`;
    }
    // ĐIỆN – NƯỚC: ô đúng cỡ tại (cách trái, cao tâm), nét gióng xuống sàn; nhãn "ký hiệu +cao" và số "cách trái" bấm sửa được như các số đo khác
    const suaA = path => (opts.sua ? ` data-sua="${path}" style="cursor:text" text-decoration="underline"` : ' pointer-events="none"');
    for (const d of dnT) {
      const mau = MAU_DN[d.nhom], bw = Math.max(d.rong, fs * 0.75), bh = Math.max(d.cao_o, fs * 0.75), cy = C - d.z;
      o += `<line x1="${f(d.cach)}" y1="${f(cy + bh / 2)}" x2="${f(d.cach)}" y2="${f(C)}" stroke="${mau}" stroke-width="${f(fs / 14)}" stroke-dasharray="${f(fs * 0.3)} ${f(fs * 0.3)}" pointer-events="none"/>`;
      o += d.tron ? `<circle data-dnd="${d.j}" cx="${f(d.cach)}" cy="${f(cy)}" r="${f(bw / 2)}" fill="${mau}" stroke="${M_TRANG}" stroke-width="${f(fs / 12)}" pointer-events="none"/>`
        : `<rect data-dnd="${d.j}" x="${f(d.cach - bw / 2)}" y="${f(cy - bh / 2)}" width="${f(bw)}" height="${f(bh)}" rx="${f(fs / 8)}" fill="${mau}" stroke="${M_TRANG}" stroke-width="${f(fs / 12)}" pointer-events="none"/>`;
      o += `<text x="${f(d.cach)}" y="${f(hgN.get(d) ? cy + bh / 2 + fs * 0.95 : cy - bh / 2 - fs * 0.35)}" font-size="${f(fs * 0.85)}" font-weight="700" text-anchor="middle" fill="${mau}" paint-order="stroke" stroke="${M_TRANG}" stroke-width="${f(fs / 5)}"${suaA(`dn.${d.j}.cao`)}>${esc(d.nhan)} +${g(d.z)}<title>${esc(d.ten)}${opts.sua ? ' — bấm để sửa cao độ tâm' : ''}</title></text>`;
      o += `<text x="${f(d.cach)}" y="${f(C + fs * 1.05 + hgT.get(d) * buoc)}" font-size="${f(fs * 0.8)}" text-anchor="middle" fill="${mau}"${suaA(`dn.${d.j}.cach`)}>${g(d.cach)}<title>${esc(d.ten)}: cách đầu trái tường${opts.sua ? ' — bấm để sửa' : ''}</title></text>`;
    }
    for (const q of dnS) {
      // điểm dưới sàn: tam giác trên vạch sàn + nhãn "ký hiệu · cách trái · cách tường"; hai số chỉ bấm sửa được ở mặt đứng của chính tường mà điểm đó đo theo
      const d = q.d, mau = MAU_DN[d.nhom], a = fs * 0.42, cua = d.tuong === i, yS = C + fs * 1.05 + (nT + hgS.get(q)) * buoc + fs * 0.15;
      o += `<path data-dnd="${d.j}" d="M ${f(q.s - a)} ${f(C)} L ${f(q.s + a)} ${f(C)} L ${f(q.s)} ${f(C + a * 1.2)} Z" fill="${mau}" pointer-events="none"/>`;
      o += `<text x="${f(q.s)}" y="${f(yS)}" font-size="${f(fs * 0.8)}" text-anchor="middle" fill="${mau}"><title>${esc(d.ten)}: dưới sàn, cách đầu trái tường ${g(q.s)}, cách mặt tường ${g(q.t)}</title><tspan font-weight="700" pointer-events="none">${esc(d.nhan)} · </tspan><tspan${cua ? suaA(`dn.${d.j}.cach`) : ' pointer-events="none"'}>${g(q.s)}</tspan><tspan pointer-events="none"> · cách tường </tspan><tspan${cua ? suaA(`dn.${d.j}.ra`) : ' pointer-events="none"'}>${g(q.t)}</tspan></text>`;
    }
    const sw = f(fs / 9), tick = fs * 0.45;
    o += `<line x1="0" y1="${f(yd)}" x2="${f(L)}" y2="${f(yd)}" stroke="${M_TUONG}" stroke-width="${sw}"/><line x1="0" y1="${f(yd - tick)}" x2="0" y2="${f(yd + tick)}" stroke="${M_TUONG}" stroke-width="${sw}"/><line x1="${f(L)}" y1="${f(yd - tick)}" x2="${f(L)}" y2="${f(yd + tick)}" stroke="${M_TUONG}" stroke-width="${sw}"/><text x="${f(L / 2)}" y="${f(yd + fs * 1.3)}" font-size="${f(fs)}" text-anchor="middle" fill="${M_TUONG}"${opts.sua ? ` data-sua="tuong.${i}.dai" style="cursor:text" text-decoration="underline"` : ''}>${g(L)}${opts.sua ? '<title>Bấm để sửa chiều dài tường</title>' : ''}</text>`;
    const xr = L + m * 0.45;
    o += `<line x1="${f(xr)}" y1="0" x2="${f(xr)}" y2="${f(C)}" stroke="${M_TUONG}" stroke-width="${sw}"/><line x1="${f(xr - tick)}" y1="0" x2="${f(xr + tick)}" y2="0" stroke="${M_TUONG}" stroke-width="${sw}"/><line x1="${f(xr - tick)}" y1="${f(C)}" x2="${f(xr + tick)}" y2="${f(C)}" stroke="${M_TUONG}" stroke-width="${sw}"/><text x="${f(xr + fs * 1.2)}" y="${f(C / 2)}" font-size="${f(fs)}" text-anchor="middle" fill="${M_TUONG}" transform="rotate(-90 ${f(xr + fs * 1.2)} ${f(C / 2)})"${opts.sua ? ` data-sua="${H.p.tuong[i] && H.p.tuong[i].cao > 0 ? `tuong.${i}.cao` : 'cao'}" style="cursor:text" text-decoration="underline"` : ''}>${g(C)}${opts.sua ? '<title>Bấm để sửa chiều cao</title>' : ''}</text>`;
    const truoc = H.tuong[(i - 1 + H.tuong.length) % H.tuong.length], sau = H.tuong[(i + 1) % H.tuong.length];
    o += `<text x="0" y="${f(-m * 0.3)}" font-size="${f(fs * 1.15)}" font-weight="700" fill="${M_TUONG}">Tường ${esc(w.ten)}</text>`;
    if (H.tuong.length > 1) o += `<text x="${f(-m * 0.15)}" y="${f(C + m * 0.98 + them)}" font-size="${f(fs * 0.8)}" fill="${M_MO}">◂ tường ${esc(truoc.ten)}</text><text x="${f(L + m * 0.15)}" y="${f(C + m * 0.98 + them)}" font-size="${f(fs * 0.8)}" text-anchor="end" fill="${M_MO}">tường ${esc(sau.ten)} ▸</text>`;
    return o + '</svg>';
  }

  /** Đọc "mã phòng" (JSON, có thể lẫn chữ quanh) → phòng đã chuẩn hoá, hoặc null. */
  function docMa(text) {
    if (text && typeof text === 'object') return chuanHoa(text);
    const t = String(text || ''), a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    try { const o = JSON.parse(t.slice(a, b + 1)); return o && Array.isArray(o.tuong) ? chuanHoa(o) : null; } catch (e) { return null; }
  }

  return { BAN, LOAI_MO, LOAI_CAN, LOAI_DN, MAU_DN, macDinh, chuanHoa, hinhHoc, datKhung, chiaKhung, doiCoKhung, tuChoKhung, hinhThanhKhung, haiDiemThanhHinh, viTriCot, khauChoKhung, diemTrongKhung, dienNuocChoTu, dienNuocDXF, duongNet, tomTat, matBangSVG, matDungSVG, docMa, giao, tenTuong };
});

/*!
 * mncf-dich.js — hiện GHI CHÚ tham số của mẫu / module Chenfeng bằng tiếng Việt.
 * Chỉ đổi chữ HIỂN THỊ ở cột "Ghi chú" (Remarks / 备注) của bảng tham số: bảng bên phải (模块参数) và bảng trong Kho mẫu (模块管理).
 * Không sửa bản vẽ, không sửa mẫu, không gửi gì lên máy chủ. Rê chuột vào ô để xem chữ gốc tiếng Trung.
 * Tắt: MNCF.dich.tat()  ·  bật lại: MNCF.dich.bat()   (ghi nhớ trong localStorage 'mncf.dich')
 */
(function (root) {
  'use strict';
  const LS = 'mncf.dich';
  const CJK = /[㐀-鿿]/;

  /* ---- 1. Câu dịch sẵn: ghi chú lấy từ 749 mẫu trong kho của xưởng + các mẫu Chenfeng tự sinh (bản 2026-09-29) + mẫu của cửa hàng Chenfeng (10/2026) ---- */
  const CAU = {
    '宽': 'Rộng', '高': 'Cao', '深': 'Sâu', '长': 'Dài', '板厚': 'Dày ván', '深度': 'Sâu', '半径': 'Bán kính', '圆弧': 'Cung tròn',
    // thùng
    '背板厚': 'Dày hậu', '底板厚': 'Dày đáy', '底板厚度': 'Dày đáy', '门厚': 'Dày cánh', '门板厚': 'Dày cánh', '芯板厚': 'Dày pa-nô', '补板厚': 'Dày tấm bù',
    '板厚参数': 'Tham số dày ván', '板最参数': 'Tham số dày ván', '手动板厚': 'Dày ván (nhập tay)', '手动厚度': 'Dày (nhập tay)', '板厚调整': 'Chỉnh dày ván',
    '调整背板': 'Chỉnh hậu', '板厚调整背板': 'Chỉnh hậu theo dày ván', '板厚调背板': 'Chỉnh hậu theo dày ván', '板最调整背板': 'Chỉnh hậu theo dày ván', '板最调背板': 'Chỉnh hậu theo dày ván',
    '脚线': 'Xà chân', '脚线高': 'Cao xà chân', '地脚线': 'Xà chân', '地脚高': 'Cao chân tủ', '底板高度': 'Cao đáy', '底板上升': 'Đáy nâng lên',
    '顶底包背': 'Nóc đáy bọc hậu', '顶包背': 'Nóc bọc hậu', '顶包左侧': 'Nóc phủ hồi trái', '顶包右侧': 'Nóc phủ hồi phải',
    '顶底内缩': 'Nóc đáy lùi vào', '顶底板内缩': 'Nóc đáy lùi vào', '顶底板内退': 'Nóc đáy lùi vào', '顶板内缩': 'Nóc lùi vào', '底板内缩': 'Đáy lùi vào',
    '顶板后缩': 'Nóc lùi sau', '顶板后延': 'Nóc kéo dài ra sau', '底板后延': 'Đáy kéo dài ra sau', '底后延': 'Đáy kéo dài ra sau', '背板上延伸': 'Hậu kéo dài lên',
    '左侧': 'Bên trái', '右侧': 'Bên phải', '左侧深': 'Sâu bên trái', '右侧深': 'Sâu bên phải', '侧宽': 'Rộng hông', '侧板深': 'Sâu hồi', '立板高': 'Cao vách',
    '左侧内缩': 'Hồi trái lùi vào', '右侧内缩': 'Hồi phải lùi vào', '左侧板内缩': 'Hồi trái lùi vào', '右侧板内缩': 'Hồi phải lùi vào', '左侧后缩': 'Hồi trái lùi sau', '右侧后缩': 'Hồi phải lùi sau',
    '左前缩': 'Hồi trái lùi trước', '右前缩': 'Hồi phải lùi trước', '左后缩': 'Hồi trái lùi sau', '右后缩': 'Hồi phải lùi sau',
    '左上延伸': 'Hồi trái kéo dài lên', '左下延伸': 'Hồi trái kéo dài xuống', '右上延伸': 'Hồi phải kéo dài lên', '右下延伸': 'Hồi phải kéo dài xuống',
    '上柜高': 'Cao tủ trên', '右柜宽': 'Rộng tủ phải', '右柜后缩': 'Tủ phải lùi sau', '左柜后缩': 'Tủ trái lùi sau', '下台面高': 'Cao mặt bàn dưới',
    '开放柜宽': 'Rộng tủ hở', '开放格宽': 'Rộng ô hở', '开格放宽': 'Rộng ô hở', '上层高': 'Cao tầng trên', '上1高': 'Cao tầng trên 1',
    '层板前缩': 'Đợt lùi trước', '层板居下': 'Đợt nằm dưới', '辅助板深': 'Sâu tấm phụ', '垫板宽': 'Rộng tấm đệm', '虚拟板件': 'Tấm ảo',
    // dịch chuyển, kéo dài, lùi
    '左右平移': 'Dịch trái–phải', '左右移动': 'Dịch trái–phải', '左上右下移': 'Dịch trái-lên / phải-xuống', '上移': 'Dịch lên', '后移': 'Dịch ra sau', '右移': 'Dịch phải', '左移': 'Dịch trái', '外移': 'Dịch ra ngoài',
    '左延伸': 'Kéo dài trái', '右延伸': 'Kéo dài phải', '上延伸': 'Kéo dài trên', '下延伸': 'Kéo dài dưới',
    '左缩': 'Lùi trái', '右缩': 'Lùi phải', '上缩': 'Lùi trên', '下缩': 'Lùi dưới', '前缩': 'Lùi trước', '后缩': 'Lùi sau', '内缩': 'Lùi vào trong', '左右缩': 'Lùi trái–phải', '退后': 'Lùi sau', '拉出': 'Kéo ra',
    '板左缩': 'Ván lùi trái', '板右缩': 'Ván lùi phải', '内缩值': 'Giá trị lùi vào', '前缩参数': 'Tham số lùi trước', '后缩参数': 'Tham số lùi sau',
    // hở, lọt lòng, khe
    '上留空': 'Hở trên', '下留空': 'Hở dưới', '底留空': 'Hở đáy', '前留空': 'Hở trước', '左右留空': 'Hở trái–phải', '底板下留空': 'Hở dưới đáy', '下层空': 'Trống tầng dưới',
    '左内空': 'Lọt lòng trái', '前内空': 'Lọt lòng trước', '上内空': 'Lọt lòng trên', '下内空': 'Lọt lòng dưới', '上层内空': 'Lọt lòng tầng trên', '下层内空': 'Lọt lòng tầng dưới', '上1内空': 'Lọt lòng trên 1',
    '后门内空': 'Lọt lòng sau cánh', '下门内空深': 'Sâu lọt lòng cánh dưới',
    '左间隙': 'Khe trái', '右间隙': 'Khe phải', '左右间隙': 'Khe trái–phải', '门缝': 'Khe cánh', '缝隙值': 'Giá trị khe', '减缝隙': 'Trừ khe',
    '上预留间隙': 'Khe chừa trên', '下预留间隙': 'Khe chừa dưới', '左预留间隙': 'Khe chừa trái', '右预留间隙': 'Khe chừa phải', '中预留间隙': 'Khe chừa giữa',
    '距上': 'Cách trên', '距下': 'Cách dưới', '距前': 'Cách trước', '距后': 'Cách sau', '距边': 'Cách mép', '边距': 'Cách mép', '下距': 'Cách dưới', '距顶板': 'Cách nóc', '距底板': 'Cách đáy',
    '靠左': 'Sát trái', '靠前': 'Sát trước', '靠顶': 'Sát nóc', '靠底': 'Sát đáy', '靠左参数': 'Tham số sát trái', '靠底参数': 'Tham số sát đáy', '靠下参数': 'Tham số sát dưới', '靠上参数': 'Tham số sát trên',
    '距离参数': 'Tham số khoảng cách', '减尺': 'Trừ kích thước', '下扣': 'Trừ dưới',
    // cánh, cửa lùa, tấm bịt
    '上盖': 'Phủ trên', '下盖': 'Phủ dưới', '左盖': 'Phủ trái', '右盖': 'Phủ phải', '左盖修正': 'Hiệu chỉnh phủ trái', '右盖修正': 'Hiệu chỉnh phủ phải',
    '盖板上延伸': 'Tấm phủ kéo dài trên', '盖板下延伸': 'Tấm phủ kéo dài dưới', '盖板左延伸': 'Tấm phủ kéo dài trái', '盖板右延伸': 'Tấm phủ kéo dài phải',
    '左门右移': 'Cánh trái dịch phải', '右门左移': 'Cánh phải dịch trái', '门板深': 'Sâu cánh', '下门高': 'Cao cánh dưới',
    '移门内缩': 'Cửa lùa lùi vào', '移门外移': 'Cửa lùa dịch ra ngoài', '滑轮高': 'Cao bánh xe', '镜子厚度': 'Dày gương',
    '边框': 'Khung viền', '边框宽': 'Rộng khung viền', '边高': 'Cao viền', '腰线高': 'Cao đai giữa', '腰线宽': 'Rộng đai giữa', '腰线上移': 'Đai giữa dịch lên',
    '封板宽': 'Rộng tấm bịt', '封板内退': 'Tấm bịt lùi vào', '左封板': 'Tấm bịt trái', '右封板': 'Tấm bịt phải', '顶封板': 'Tấm bịt trên',
    // lỗ khoan, bản lề
    '孔半径': 'Bán kính lỗ', '孔深': 'Sâu lỗ', '孔距': 'Khoảng cách lỗ', '孔距边': 'Lỗ cách mép', '打孔深度': 'Sâu khoan', '开孔深': 'Sâu lỗ khoét', '开孔边距': 'Lỗ khoét cách mép',
    '挖孔深度': 'Sâu lỗ khoét', '挖孔参数': 'Tham số lỗ khoét', '孔位前后缩': 'Lỗ lùi trước–sau', '孔上下距离': 'Khoảng cách lỗ trên–dưới', '孔靠下': 'Lỗ sát dưới', '孔靠上': 'Lỗ sát trên',
    '引孔深': 'Sâu lỗ mồi', '左引孔': 'Lỗ mồi trái', '右引孔': 'Lỗ mồi phải', '第一引孔': 'Lỗ mồi 1', '第二引孔': 'Lỗ mồi 2', '引孔前': 'Lỗ mồi trước', '引孔后': 'Lỗ mồi sau',
    '引孔1位置': 'Vị trí lỗ mồi 1', '引孔2位置': 'Vị trí lỗ mồi 2', '侧引孔前': 'Lỗ mồi hông phía trước', '侧引孔靠下': 'Lỗ mồi hông sát dưới',
    '侧板孔距边': 'Lỗ hồi cách mép', '侧板孔间距': 'Khoảng cách lỗ hồi', '侧板孔左右移': 'Lỗ hồi dịch trái–phải', '侧板孔深': 'Sâu lỗ hồi', '侧板孔深度': 'Sâu lỗ hồi', '侧板孔距下': 'Lỗ hồi cách dưới',
    '门板孔间距': 'Khoảng cách lỗ cánh', '门板孔距圆心': 'Lỗ cánh cách tâm chén', '门板孔深': 'Sâu lỗ cánh', '孔杯深度': 'Sâu chén bản lề', '铰链长': 'Dài bản lề',
    '预埋件半径': 'Bán kính ốc cấy', '预埋孔深度': 'Sâu lỗ ốc cấy',
    '前孔距前': 'Lỗ trước cách mép trước', '后孔距前': 'Lỗ sau cách mép trước', '前孔深度': 'Sâu lỗ trước', '后孔距下': 'Lỗ sau cách dưới',
    '侧孔后前孔距离': 'Khoảng cách lỗ hông trước–sau', '后板孔靠边': 'Lỗ tấm sau sát mép', '后板孔距下': 'Lỗ tấm sau cách dưới',
    // rãnh, cắt góc, khuyết, bo
    '槽深': 'Sâu rãnh', '槽宽': 'Rộng rãnh', '槽长': 'Dài rãnh', '槽深度': 'Sâu rãnh', '槽高度': 'Cao rãnh', '上槽宽': 'Rộng rãnh trên', '上槽深': 'Sâu rãnh trên', '槽总深': 'Tổng sâu rãnh',
    '切角深': 'Sâu cắt góc', '切角宽': 'Rộng cắt góc', '切角高': 'Cao cắt góc', '切口宽': 'Rộng vết cắt', '切口距左': 'Vết cắt cách trái', '左切': 'Cắt trái', '右切': 'Cắt phải', '深多切': 'Cắt thêm chiều sâu', '高多切': 'Cắt thêm chiều cao',
    '缺口加大': 'Nới rộng khuyết', '缺口深': 'Sâu khuyết', '缺宽': 'Rộng khuyết', '缺高': 'Cao khuyết', '缺左': 'Khuyết trái', '缺前右': 'Khuyết trước phải',
    '圆弧半径': 'Bán kính cung', '弧形半径': 'Bán kính cung', '圆半径': 'Bán kính tròn', '前外圆': 'Bo ngoài phía trước', '后内圆': 'Bo trong phía sau', '前宽': 'Rộng phía trước',
    // tay nắm
    '拉手长': 'Dài tay nắm', '拉手长度': 'Dài tay nắm', '拉手高': 'Cao tay nắm', '拉手宽': 'Rộng tay nắm', '拉手深': 'Sâu tay nắm', '把手参数': 'Tham số tay nắm',
    '拉手长参数': 'Tham số dài tay nắm', '拉手长度参数': 'Tham số dài tay nắm', '拉手靠上': 'Tay nắm sát trên', '拉手靠下': 'Tay nắm sát dưới',
    '左装拉手': 'Lắp tay nắm bên trái', '左装参数': 'Tham số lắp trái', '下装': 'Lắp dưới', '下装参数': 'Tham số lắp dưới',
    '拉位高': 'Cao hốc tay nắm', '拉位下留空': 'Hở dưới hốc tay nắm',
    // ngăn kéo, ray
    '轨道': 'Ray', '轨道宽': 'Rộng ray', '轨道宽度': 'Rộng ray', '轨道长': 'Dài ray', '轨道延后': 'Ray lùi sau', '轨道上延': 'Ray kéo dài lên', '导轨宽': 'Rộng ray', '导轨厚度': 'Dày ray',
    '抽盒高': 'Cao hộp ngăn kéo', '抽屉高': 'Cao ngăn kéo', '抽面高': 'Cao mặt ngăn kéo', '抽面厚': 'Dày mặt ngăn kéo', '抽底厚': 'Dày đáy ngăn kéo', '抽锁': 'Khoá ngăn kéo',
    '抽盒后退': 'Hộp ngăn kéo lùi sau', '抽屉底上提': 'Đáy ngăn kéo nâng lên', '抽侧下掉': 'Thành ngăn kéo hạ xuống', '抽屉深扣尺': 'Trừ sâu ngăn kéo', '抽帮上减尺': 'Trừ trên thành ngăn kéo',
    '前后抽堵缩减': 'Trừ tấm trước–sau ngăn kéo', '前后抽堵上缩减': 'Trừ trên tấm trước–sau ngăn kéo', '减高抽前后板': 'Giảm cao tấm trước–sau ngăn kéo',
    '抽侧板前孔距边': 'Lỗ trước thành ngăn kéo cách mép', '抽侧板前孔': 'Lỗ trước thành ngăn kéo', '抽侧板后孔': 'Lỗ sau thành ngăn kéo',
    '拉条高': 'Cao thanh giằng', '背条高': 'Cao thanh lưng', '衣杆扣长': 'Trừ dài suốt treo',
    // khác
    '判断': 'Điều kiện', '判断1': 'Điều kiện 1', '判断2': 'Điều kiện 2', '必须': 'Bắt buộc',
    '模板': 'Mẫu', '模板ID': 'Mã mẫu', '拉手模板': 'Mẫu tay nắm', '拉手模板ID': 'Mã mẫu tay nắm', '铰链模板': 'Mẫu bản lề', '铰链模板ID': 'Mã mẫu bản lề',
    // gặp trong mẫu con (mẫu lồng trong mẫu) của kho xưởng
    '宽度': 'Rộng', '立板深度': 'Sâu vách', '门板厚度': 'Dày cánh', '抽屉深度': 'Sâu ngăn kéo', '抽屉内缩': 'Ngăn kéo lùi vào', '槽加宽': 'Nới rộng rãnh', '上下移动': 'Dịch lên–xuống',
    '拉手上下居中': 'Tay nắm canh giữa trên–dưới', '拉手左右居中': 'Tay nắm canh giữa trái–phải', '拉手上距': 'Tay nắm cách trên', '拉手下距': 'Tay nắm cách dưới', '拉手左距': 'Tay nắm cách trái', '拉手右距': 'Tay nắm cách phải',
    '左开门': 'Cánh mở trái', '右开门': 'Cánh mở phải', '铰链上距': 'Bản lề cách trên', '铰链下距': 'Bản lề cách dưới', 'X轴个数': 'Số lượng theo X', 'Y轴个数': 'Số lượng theo Y', 'Z轴个数': 'Số lượng theo Z',
    '左留空': 'Hở trái', '右留空': 'Hở phải', '后留空': 'Hở sau',
    // gặp trong các mẫu mua (已购买)
    '板宽': 'Rộng ván', '立板厚': 'Dày vách', '门板高': 'Cao cánh', '倒角': 'Vát góc', '前移': 'Dịch ra trước', '距左': 'Cách trái',
    '左侧上伸': 'Hồi trái kéo dài lên', '右侧上伸': 'Hồi phải kéo dài lên', '左侧前延': 'Hồi trái kéo dài ra trước', '左侧后延': 'Hồi trái kéo dài ra sau', '左侧上延': 'Hồi trái kéo dài lên', '左侧下延': 'Hồi trái kéo dài xuống',
    '右侧前延': 'Hồi phải kéo dài ra trước', '右侧后延': 'Hồi phải kéo dài ra sau', '右侧上延': 'Hồi phải kéo dài lên', '右侧下延': 'Hồi phải kéo dài xuống',
    '顶板前延': 'Nóc kéo dài ra trước', '顶板左延': 'Nóc kéo dài trái', '顶板右延': 'Nóc kéo dài phải', '底板前延': 'Đáy kéo dài ra trước', '底板左延': 'Đáy kéo dài trái', '底板右延': 'Đáy kéo dài phải',
    '底板左延动作': 'Đáy kéo dài trái (động tác)', '底板右延动作': 'Đáy kéo dài phải (động tác)', '顶板左延动作': 'Nóc kéo dài trái (động tác)', '顶板右延动作': 'Nóc kéo dài phải (động tác)',
    '顶板左盖动作': 'Nóc phủ trái (động tác)', '顶板右盖动作': 'Nóc phủ phải (động tác)', '底板左盖动作': 'Đáy phủ trái (động tác)', '底板右盖动作': 'Đáy phủ phải (động tác)',
    '地脚内缩': 'Chân tủ lùi vào', '后地脚内缩': 'Chân sau lùi vào', '地脚前缩': 'Chân tủ lùi trước', '地脚后缩': 'Chân tủ lùi sau', '顶底前缩': 'Nóc đáy lùi trước', '顶底后缩': 'Nóc đáy lùi sau', '底板前缩': 'Đáy lùi trước',
    '垫板上缩': 'Tấm đệm lùi trên', '垫板下缩': 'Tấm đệm lùi dưới', '垫条宽': 'Rộng thanh đệm', '垫条左缩': 'Thanh đệm lùi trái', '垫条右缩': 'Thanh đệm lùi phải',
    // tên các mẫu Chenfeng tự sinh (cây bên phải)
    '左右侧板模板': 'Mẫu hai hồi', '顶底板模板': 'Mẫu nóc đáy', '背板模板': 'Mẫu hậu', '立板模板': 'Mẫu vách', '层板模板': 'Mẫu đợt', '门板模板': 'Mẫu cánh', '抽屉模板': 'Mẫu ngăn kéo',
    '左右侧板(自动)': 'Hai hồi (tự động)', '背板(自动)': 'Hậu (tự động)', '层板(自动)': 'Đợt (tự động)', '立板(自动)': 'Vách (tự động)', '格子抽(自动)': 'Ngăn kéo ô (tự động)', '酒格(自动)': 'Ô rượu (tự động)', '弧形窗(自动)': 'Cửa sổ vòm (tự động)',
    // ---- ghi chú của mẫu lấy từ cửa hàng Chenfeng (kho store, 03/10/2026) ----
    '侧板内缩': 'Hồi lùi vào', '背板左缩': 'Hậu lùi trái', '背板右缩': 'Hậu lùi phải', '顶板下移': 'Nóc dịch xuống', '底板上移': 'Đáy dịch lên', '左侧前缩': 'Hồi trái lùi trước',
    '左侧左缩': 'Hồi trái lùi trái', '右侧前缩': 'Hồi phải lùi trước', '右侧右缩': 'Hồi phải lùi phải', '左侧板上延': 'Hồi trái kéo dài lên', '左侧板下延': 'Hồi trái kéo dài xuống',
    '左侧板前延': 'Hồi trái kéo dài ra trước', '左侧板后延': 'Hồi trái kéo dài ra sau', '右侧板上延': 'Hồi phải kéo dài lên', '右侧板下延': 'Hồi phải kéo dài xuống',
    '右侧板前延': 'Hồi phải kéo dài ra trước', '右侧板后延': 'Hồi phải kéo dài ra sau', '中板厚': 'Dày ván giữa', '中板前缩': 'Ván giữa lùi trước', '高度': 'Cao',
    '拉手距上': 'Tay nắm cách trên', '拉手距下': 'Tay nắm cách dưới', '圆弧距下': 'Cung cách dưới', '圆弧距上': 'Cung cách trên', '层板距下': 'Đợt cách dưới', '立板靠右': 'Vách sát phải',
    '板高': 'Cao ván', '抽封板下延伸': 'Tấm bịt ngăn kéo kéo dài dưới', '背板距后': 'Hậu cách lưng', '后延伸': 'Kéo dài sau', '顶板前延伸': 'Nóc kéo dài ra trước',
    '顶板左延伸': 'Nóc kéo dài trái', '顶板右延伸': 'Nóc kéo dài phải', '前延伸': 'Kéo dài trước', '底板距下': 'Đáy cách dưới', '距右': 'Cách phải', '前距': 'Cách trước', '后距': 'Cách sau',
    '上距': 'Cách trên', '左延': 'Kéo dài trái', '右延': 'Kéo dài phải', '顶板前缩': 'Nóc lùi trước', '底板后缩': 'Đáy lùi sau', '上下板厚': 'Dày ván trên–dưới',
    '中板后缩': 'Ván giữa lùi sau', '中板左缩': 'Ván giữa lùi trái', '中板右缩': 'Ván giữa lùi phải', '拉手上移': 'Tay nắm dịch lên', '柜深': 'Sâu tủ', '层板深': 'Sâu đợt',
    '层板右缩': 'Đợt lùi phải', '层板左缩': 'Đợt lùi trái', '左右边框': 'Khung viền trái–phải', '上边框': 'Khung viền trên', '缝隙': 'Khe hở', '右侧高': 'Cao bên phải',
    '左侧高': 'Cao bên trái', '上延': 'Kéo dài lên', '侧板前延': 'Hồi kéo dài ra trước', '侧板上延': 'Hồi kéo dài lên', '背板右延': 'Hậu kéo dài phải', '背板上延': 'Hậu kéo dài lên',
    '底板上缩': 'Đáy lùi trên', '地脚下缩': 'Chân tủ lùi dưới', '左上缩': 'Lùi trên bên trái', '右上缩': 'Lùi trên bên phải', '左宽': 'Rộng bên trái', '顶左宽': 'Rộng nóc bên trái',
    '侧板左缩': 'Hồi lùi trái', '底板下缩': 'Đáy lùi dưới', '侧板右缩': 'Hồi lùi phải', '上下边框': 'Khung viền trên–dưới', '左柜深': 'Sâu tủ trái', '右柜深': 'Sâu tủ phải',
    '引孔间距': 'Khoảng cách lỗ mồi', '抽屉深': 'Sâu ngăn kéo', '抽底上移': 'Đáy ngăn kéo dịch lên', '轨道高': 'Cao ray', '抽屉后缩': 'Ngăn kéo lùi sau', '轨道厚': 'Dày ray',
    '轨道深': 'Sâu ray', '高留空': 'Hở chiều cao', '中门左移': 'Cánh giữa dịch trái', '中左门左移': 'Cánh giữa-trái dịch trái', '中右门右移': 'Cánh giữa-phải dịch phải', '中宽': 'Rộng giữa',
    '下移': 'Dịch xuống', '下延': 'Kéo dài xuống', '下高': 'Cao phần dưới', '内距边': 'Cách mép trong', '上芯板高': 'Cao pa-nô trên', '下芯板高': 'Cao pa-nô dưới',
    '左右宽': 'Rộng trái–phải', '前板左缩': 'Tấm trước lùi trái', '侧板后缩': 'Hồi lùi sau', '板上缩': 'Ván lùi trên', '板下缩': 'Ván lùi dưới', '侧板上缩': 'Hồi lùi trên',
    '板后缩': 'Ván lùi sau', '后板左缩': 'Tấm sau lùi trái', '后板右缩': 'Tấm sau lùi phải', '前板下缩': 'Tấm trước lùi dưới', '后板下缩': 'Tấm sau lùi dưới', '前板上缩': 'Tấm trước lùi trên',
    '后板上缩': 'Tấm sau lùi trên', '前板右缩': 'Tấm trước lùi phải', '侧板下缩': 'Hồi lùi dưới', '拉条距背': 'Thanh giằng cách hậu', '拉条宽': 'Rộng thanh giằng', '面板厚': 'Dày tấm mặt',
    '弧高': 'Cao cung', '边宽': 'Rộng viền', '框架下缩': 'Khung lùi dưới', '框架左右延': 'Khung kéo dài trái–phải', '框架上缩': 'Khung lùi trên', '型号(6,7,8)': 'Kiểu (6, 7, 8)',
    '固定板圆弧': 'Cung tấm cố định', '门框': 'Khung cánh', '圆角': 'Bo góc', '脚条高': 'Cao thanh chân', '后圆半径': 'Bán kính bo sau', '前圆半径': 'Bán kính bo trước',
    '下空间高': 'Cao khoang dưới', '顶线高': 'Cao phào đỉnh', '中立内缩': 'Vách giữa lùi vào', '中立右移': 'Vách giữa dịch phải', '左侧后伸': 'Hồi trái kéo dài ra sau',
    '右侧后伸': 'Hồi phải kéo dài ra sau', '左侧前伸': 'Hồi trái kéo dài ra trước', '右侧前伸': 'Hồi phải kéo dài ra trước', '左侧板抬高': 'Hồi trái nâng lên',
    '右侧板抬高': 'Hồi phải nâng lên', '背板抬高': 'Hậu nâng lên', '左延伸动作': 'Kéo dài trái (động tác)', '右延伸动作': 'Kéo dài phải (động tác)', '后延伸动作': 'Kéo dài sau (động tác)',
    '垫条上缩': 'Thanh đệm lùi trên', '垫条下缩': 'Thanh đệm lùi dưới', '上升': 'Nâng lên', '上开门': 'Cánh mở lên', '下开门': 'Cánh mở xuống', '背包侧': 'Hậu phủ hồi', '绘制方式': 'Cách vẽ',
    '插入个数': 'Số lượng chèn', '最小间距': 'Khoảng cách nhỏ nhất', '插入深度': 'Độ sâu chèn', '加深': 'Thêm sâu', '顶板左伸': 'Nóc kéo dài trái', '顶板右伸': 'Nóc kéo dài phải',
    '弧形高': 'Cao phần cong', '条子厚': 'Dày nẹp', '左留': 'Chừa trái', '右留': 'Chừa phải', '上留': 'Chừa trên', '下留': 'Chừa dưới', '凸出': 'Nhô ra', '前收': 'Thu trước',
    '后收': 'Thu sau', '左空': 'Hở trái', '右空': 'Hở phải', '收口下伸': 'Nẹp bịt kéo dài xuống', '柜体内缩': 'Thùng tủ lùi vào', '弧宽': 'Rộng cung', '盖侧板': 'Phủ hồi',
    '辅助条宽': 'Rộng thanh phụ', '左柱宽': 'Rộng cột trái', '左柱深': 'Sâu cột trái', '右柱宽': 'Rộng cột phải', '右柱深': 'Sâu cột phải', '左倒角': 'Vát góc trái', '右倒角': 'Vát góc phải',
    '中柱宽': 'Rộng cột giữa', '中柱深': 'Sâu cột giữa', '中柱距左': 'Cột giữa cách trái', '梁柱深': 'Sâu dầm cột', '后梁高': 'Cao dầm sau', '包柱动作': 'Bọc cột (động tác)',
    '后梁深': 'Sâu dầm sau', '前梁深': 'Sâu dầm trước', '前梁高': 'Cao dầm trước', '左梁宽': 'Rộng dầm trái', '左梁高': 'Cao dầm trái', '缺角包柱动作': 'Khuyết góc bọc cột (động tác)',
    '左包柱动作': 'Bọc cột trái (động tác)', '右包柱动作': 'Bọc cột phải (động tác)', '缺角深': 'Sâu khuyết góc', '缺角高': 'Cao khuyết góc', '缺角宽': 'Rộng khuyết góc',
    '左缺角宽': 'Rộng khuyết góc trái', '左缺角高': 'Cao khuyết góc trái', '右缺角宽': 'Rộng khuyết góc phải', '右缺角高': 'Cao khuyết góc phải', '左缺角深': 'Sâu khuyết góc trái',
    '右缺角深': 'Sâu khuyết góc phải', '下弧形深': 'Sâu phần cong dưới', '中背拉条下移': 'Thanh giằng hậu giữa dịch xuống', '中背拉下移动作': 'Giằng hậu giữa dịch xuống (động tác)',
    '左上缩动作': 'Lùi trên bên trái (động tác)', '右上缩动作': 'Lùi trên bên phải (động tác)', '收口宽': 'Rộng nẹp bịt', '键盘抽宽': 'Rộng khay bàn phím', '键盘抽深': 'Sâu khay bàn phím',
    '键盘抽高': 'Cao khay bàn phím', '侧抽高': 'Cao thành ngăn kéo', '侧抽后留': 'Thành ngăn kéo chừa sau', '侧板拉槽': 'Rãnh trên hồi', '后伸': 'Kéo dài ra sau',
    '抽屉加深': 'Ngăn kéo thêm sâu', '推门总深': 'Tổng sâu cửa lùa', '重叠位': 'Phần chồng mí', '轮高': 'Cao bánh xe', '轮深': 'Sâu bánh xe', '轮距边': 'Bánh xe cách mép',
    '侧板上伸': 'Hồi kéo dài lên', '背拉条高': 'Cao thanh giằng hậu', '背拉条宽': 'Rộng thanh giằng hậu', '距下空间': 'Cách khoang dưới', '玻璃厚': 'Dày kính', '装饰条宽': 'Rộng nẹp trang trí',
    '斜边延伸': 'Cạnh vát kéo dài', '上下留缝': 'Chừa khe trên–dưới', '左右上留': 'Chừa trái–phải–trên', '板四边加大': 'Ván nới rộng 4 cạnh', '波浪左移': 'Sóng dịch trái',
    '板加大': 'Ván nới rộng', '波浪总宽': 'Tổng rộng sóng', '波浪总实宽': 'Tổng rộng thực của sóng', '波浪总宽加大': 'Tổng rộng sóng nới thêm', '波浪右移': 'Sóng dịch phải', '柱深': 'Sâu cột',
    '柱宽': 'Rộng cột', '柱上延': 'Cột kéo dài lên', '柱下延': 'Cột kéo dài xuống', '梁宽': 'Rộng dầm', '梁高': 'Cao dầm', '梁后延': 'Dầm kéo dài ra sau', '梁深': 'Sâu dầm',
    '梁距下': 'Dầm cách dưới', '梁左延': 'Dầm kéo dài trái', '梁右延': 'Dầm kéo dài phải', '柱左移': 'Cột dịch trái', '柱距前': 'Cột cách trước', '梁右移': 'Dầm dịch phải',
    '梁左移': 'Dầm dịch trái', '柱右移': 'Cột dịch phải', '手拉位长': 'Dài hốc tay nắm', '手拉位左移': 'Hốc tay nắm dịch trái', '手拉位下移': 'Hốc tay nắm dịch xuống',
    '手拉位上移': 'Hốc tay nắm dịch lên', '手拉位右移': 'Hốc tay nắm dịch phải', '中角距下': 'Góc giữa cách dưới', '左上角上缩': 'Góc trên-trái lùi trên', '右上角上缩': 'Góc trên-phải lùi trên',
    '左下角下缩': 'Góc dưới-trái lùi dưới', '右下角下缩': 'Góc dưới-phải lùi dưới', '左上角左缩': 'Góc trên-trái lùi trái', '右上角右缩': 'Góc trên-phải lùi phải',
    '左下角左缩': 'Góc dưới-trái lùi trái', '右下角右缩': 'Góc dưới-phải lùi phải', '左右厚': 'Dày trái–phải', '总厚': 'Tổng dày', '层板厚': 'Dày đợt', '左右槽深': 'Sâu rãnh trái–phải',
    '上下槽深': 'Sâu rãnh trên–dưới', '拉条槽深': 'Sâu rãnh thanh giằng', '中板上缩': 'Ván giữa lùi trên', '中板下缩': 'Ván giữa lùi dưới', '层板内缩': 'Đợt lùi vào',
    '层板左右缩': 'Đợt lùi trái–phải', '下梁高': 'Cao dầm dưới', '下梁深': 'Sâu dầm dưới', '右柱宽1': 'Rộng cột phải 1', '右柱深1': 'Sâu cột phải 1', '左柱宽1': 'Rộng cột trái 1',
    '左柱深1': 'Sâu cột trái 1', '立条宽': 'Rộng nẹp đứng', '防尘板内缩': 'Tấm chắn bụi lùi vào', '电器高': 'Cao thiết bị', '底板宽': 'Rộng đáy', '左右孔深': 'Sâu lỗ trái–phải',
    '检修口长': 'Dài cửa thăm', '检修口宽': 'Rộng cửa thăm', '盒深': 'Sâu hộp', '盒高': 'Cao hộp', '盒宽': 'Rộng hộp', '左门数': 'Số cánh trái', '右门数': 'Số cánh phải',
    '判断3': 'Điều kiện 3', '判断4': 'Điều kiện 4', '左门': 'Cánh trái', '右门': 'Cánh phải', '左门缝': 'Khe cánh trái', '右门缝': 'Khe cánh phải', '左中门缝': 'Khe cánh giữa-trái',
    '右中门缝': 'Khe cánh giữa-phải', '右宽': 'Rộng bên phải', '左台面宽': 'Rộng mặt bàn trái', '右台面宽': 'Rộng mặt bàn phải', '水槽距右': 'Chậu rửa cách phải', '台面厚': 'Dày mặt bàn',
    '含下扣高': 'Cao kể cả gờ dưới', '后档高': 'Cao gờ chắn sau', '烟机宽': 'Rộng máy hút mùi', '层板左右缩进': 'Đợt lùi trái–phải', '背板内缩': 'Hậu lùi vào', '水槽距左': 'Chậu rửa cách trái',
    '冰箱柜宽': 'Rộng tủ tủ lạnh', '冰箱柜高': 'Cao tủ tủ lạnh', '下柜高': 'Cao tủ dưới', '拉篮柜宽': 'Rộng tủ giá kéo', '下柜上延伸': 'Tủ dưới kéo dài lên', '台面高': 'Cao mặt bàn',
    '上柜深': 'Sâu tủ trên', '开放柜高': 'Cao tủ hở', '中台面宽': 'Rộng mặt bàn giữa', '居前': 'Sát trước', '左右延伸': 'Kéo dài trái–phải', '地板预留': 'Chừa sàn', '冰箱高': 'Cao tủ lạnh',
    '高柜深': 'Sâu tủ cao', '左台面深': 'Sâu mặt bàn trái', '左下柜深': 'Sâu tủ dưới trái', '右台面深': 'Sâu mặt bàn phải', '右下柜深': 'Sâu tủ dưới phải', '烟机柜宽': 'Rộng tủ máy hút mùi',
    '柜体左延伸': 'Thùng tủ kéo dài trái', '前后留': 'Chừa trước–sau', '层距': 'Khoảng cách đợt', '变量1': 'Biến 1', '变量2': 'Biến 2', '层板后缩': 'Đợt lùi sau', '门板宽': 'Rộng cánh',
    '孔宽': 'Rộng lỗ', '孔高': 'Cao lỗ', '槽距边': 'Rãnh cách mép', '拉直器距左': 'Thanh chống cong cách trái', '拉直器距右': 'Thanh chống cong cách phải', '槽间距': 'Khoảng cách rãnh',
    '拉手位': 'Vị trí tay nắm', '拉手位宽': 'Rộng vị trí tay nắm', '拉手位距下': 'Vị trí tay nắm cách dưới', '拉手位距上': 'Vị trí tay nắm cách trên', '左中柜高': 'Cao tủ giữa trái',
    '左下柜高': 'Cao tủ dưới trái', '右上柜高': 'Cao tủ trên phải', '下空': 'Hở dưới', '顶板前伸': 'Nóc kéo dài ra trước', '左上柜高': 'Cao tủ trên trái', '右中柜高': 'Cao tủ giữa phải',
    '右下柜高': 'Cao tủ dưới phải', '上缺角高': 'Cao khuyết góc trên', '下缺角高': 'Cao khuyết góc dưới', '面板厚度': 'Dày tấm mặt', '内收': 'Thu vào trong', '离地': 'Cách sàn',
    '地板厚度': 'Dày sàn', '圆弧距后': 'Cung cách sau', '柜体右延伸': 'Thùng tủ kéo dài phải', '中缺口高': 'Cao khuyết giữa', '中缺口深': 'Sâu khuyết giữa', '底板缺口深': 'Sâu khuyết đáy',
    '横条深': 'Sâu thanh ngang', '弧形距下': 'Phần cong cách dưới', '左垫条下缩': 'Thanh đệm trái lùi dưới', '右垫条下缩': 'Thanh đệm phải lùi dưới', '内弧形上延伸': 'Cong trong kéo dài lên',
    '中柜高': 'Cao tủ giữa', '缺角距下': 'Khuyết góc cách dưới', '弧形距左': 'Phần cong cách trái', '弧形距后': 'Phần cong cách sau', '造型高': 'Cao phần tạo hình',
    '桌面左延伸': 'Mặt bàn kéo dài trái', '桌面右延伸': 'Mặt bàn kéo dài phải', '桌面前延伸': 'Mặt bàn kéo dài ra trước', '背板前移': 'Hậu dời ra trước', '左角弧度': 'Độ cong góc trái',
    '右角弧度': 'Độ cong góc phải', '门套': 'Khuôn bao cửa', '母门宽': 'Rộng cánh lớn (cửa mẹ con)', '逃跑距离': 'Khoảng lùi tránh', '中柜下留空': 'Tủ giữa hở dưới',
    '中柜倒角': 'Vát góc tủ giữa', '左上弧形高': 'Cao phần cong trên trái', '左下弧形高': 'Cao phần cong dưới trái', '缺角距上': 'Khuyết góc cách trên', '靠右': 'Sát phải',
    '右上弧形高': 'Cao phần cong trên phải', '右下弧形高': 'Cao phần cong dưới phải', '左半径': 'Bán kính trái', '右半径': 'Bán kính phải', '左侧板上延伸': 'Hồi trái kéo dài lên',
    '右侧板上延伸': 'Hồi phải kéo dài lên', '后留空判断': 'Kiểm tra hở sau', '背板判断': 'Kiểm tra hậu', '左延伸判断': 'Kiểm tra kéo dài trái', '右延伸判断': 'Kiểm tra kéo dài phải',
    '左延伸判断立板': 'Kiểm tra kéo dài trái (vách đứng)', '右延伸判断立板': 'Kiểm tra kéo dài phải (vách đứng)', '背板封边': 'Dán cạnh hậu', '左前延伸': 'Kéo dài trước bên trái',
    '右前延伸': 'Kéo dài trước bên phải', '电器宽': 'Rộng thiết bị', '左收口宽': 'Rộng nẹp trái', '右收口宽': 'Rộng nẹp phải', '台盆右移': 'Chậu dời sang phải', '洗手台高': 'Cao bàn lavabo',
    '银镜柜高': 'Cao tủ gương', '银镜柜深': 'Sâu tủ gương', '侧边柜宽': 'Rộng tủ bên', '侧边柜高': 'Cao tủ bên', '浴室柜高': 'Cao tủ lavabo', '抽屉柜1高': 'Cao tủ ngăn kéo 1',
    '抽屉柜2高': 'Cao tủ ngăn kéo 2', '抽屉柜2宽': 'Rộng tủ ngăn kéo 2', '洗手台宽': 'Rộng bàn lavabo', '吊柜高': 'Cao tủ treo', '吊柜宽': 'Rộng tủ treo', '吊柜深': 'Sâu tủ treo',
    '水槽左移': 'Chậu rửa dời sang trái', '下悬空高': 'Cao hở dưới (treo)', '抽屉柜高': 'Cao tủ ngăn kéo', '楣板高': 'Cao tấm mi', '楣板上移': 'Tấm mi dời lên',
    '楣板左延': 'Tấm mi kéo dài trái', '楣板右延': 'Tấm mi kéo dài phải', '楣板前缩': 'Tấm mi lùi trước', '门洞间隙': 'Khe hở ô cửa', '线条宽': 'Rộng phào chỉ',
    '子门宽': 'Rộng cánh nhỏ (cửa mẹ con)', '下窗高': 'Cao cửa sổ dưới', '左下窗高': 'Cao cửa sổ dưới trái', '中窗宽': 'Rộng cửa sổ giữa', '门高': 'Cao cửa', '门宽': 'Rộng cửa',
    '窗高': 'Cao cửa sổ', '窗宽': 'Rộng cửa sổ', '窗台高': 'Cao bệ cửa sổ', '墙厚': 'Dày tường', '窗到墙': 'Cửa sổ cách tường', '门垛宽': 'Rộng má cửa', '窗帘位': 'Vị trí rèm',
    '预留衣柜': 'Chừa chỗ tủ áo', '固定窗高': 'Cao cửa sổ cố định', '飘窗高': 'Cao cửa sổ lồi', '飘窗深': 'Sâu cửa sổ lồi', '垭口宽': 'Rộng ô thông', '垭口高': 'Cao ô thông',
    '垭口墙厚': 'Dày tường ô thông', '垭口到墙': 'Ô thông cách tường', '阳台宽': 'Rộng ban công', '卫生间宽': 'Rộng nhà vệ sinh', '过道宽': 'Rộng lối đi', '卫门宽': 'Rộng cửa vệ sinh',
    '卫门垛宽': 'Rộng má cửa vệ sinh', '飘窗墙厚': 'Dày tường cửa sổ lồi', '外前孔距边': 'Lỗ trước ngoài cách mép', '内前孔距边': 'Lỗ trước trong cách mép', '外引孔': 'Lỗ mồi ngoài',
    '内引孔': 'Lỗ mồi trong', '外引孔内移': 'Lỗ mồi ngoài dời vào trong', '引孔距下': 'Lỗ mồi cách dưới', '引孔内移': 'Lỗ mồi dời vào trong', '背孔深': 'Sâu lỗ sau',
    '背孔距边': 'Lỗ sau cách mép', '背孔距下': 'Lỗ sau cách dưới', '衣杆扣尺': 'Trừ dài suốt treo', '左距后': 'Trái cách sau', '右距后': 'Phải cách sau', '左侧右移': 'Bên trái dời sang phải',
    '右侧左移': 'Bên phải dời sang trái', '灯带深': 'Sâu rãnh đèn', '灯带高': 'Cao rãnh đèn', '左右移': 'Dời trái–phải', '调节高': 'Cao điều chỉnh', '调节脚高': 'Cao chân tăng chỉnh',
    '反弹器相距': 'Khoảng cách nhấn mở', '左前移': 'Trái dời ra trước', '右前移': 'Phải dời ra trước', '架深': 'Sâu giá', '托架深': 'Sâu giá đỡ', '镜高': 'Cao gương', '镜宽': 'Rộng gương',
    '孔间距': 'Khoảng cách giữa các lỗ',
    // bổ sung 04/10/2026: ghi chú của các bộ tủ mẫu lấy từ cửa hàng (tủ áo, tủ tivi, bếp, bàn học, giường tầng, tatami…)
    '灯槽宽': 'Rộng rãnh đèn', '灯槽深': 'Sâu rãnh đèn', '上1空间': 'Khoang trên 1', '上2空间': 'Khoang trên 2', '轨道孔': 'Lỗ ray', '抽侧高': 'Cao thành ngăn kéo', '槽下距': 'Rãnh cách mép dưới',
    '抽底判断1': 'Điều kiện đáy ngăn kéo 1', '抽底判断2': 'Điều kiện đáy ngăn kéo 2', '抽底封边判断': 'Điều kiện dán cạnh đáy ngăn kéo', '顶底判断': 'Điều kiện nóc đáy',
    '左右判断': 'Điều kiện trái phải', '上判断': 'Điều kiện trên', '下判断': 'Điều kiện dưới', '踢脚高': 'Cao xà chân', '上3空间': 'Khoang trên 3', '踢脚': 'Xà chân',
    '拉手下留空': 'Hở dưới tay nắm', '上4空间': 'Khoang trên 4', '收口': 'Nẹp bù', '柜体前伸': 'Thùng tủ kéo dài ra trước', '上5空间': 'Khoang trên 5', '扣尺': 'Trừ kích thước',
    '左柜宽': 'Rộng tủ trái', '居上': 'Cách trên', '收口高': 'Cao nẹp bù', '向右偏': 'Lệch sang phải', '上伸': 'Kéo dài lên', '背板下判断': 'Điều kiện hậu dưới', '判断底板': 'Điều kiện đáy',
    '柜体高': 'Cao thùng tủ', '书桌高': 'Cao bàn', '榻榻米高': 'Cao tatami', '榻榻米宽': 'Rộng tatami', '中心距左': 'Tâm cách trái', '衣柜深': 'Sâu tủ áo', '左侧板后缩': 'Hồi trái lùi sau',
    '左侧板前伸': 'Hồi trái kéo dài ra trước', '右侧板前伸': 'Hồi phải kéo dài ra trước', '造型长': 'Dài tạo hình', '造型宽': 'Rộng tạo hình', '柜体后缩': 'Thùng tủ lùi sau', '吊沿高': 'Cao diềm',
    '左侧前延伸': 'Hồi trái kéo dài ra trước', '检修口大小': 'Cỡ ô thăm', '检修口距右': 'Ô thăm cách phải', '右侧前延伸': 'Hồi phải kéo dài ra trước', '鞋凳高': 'Cao ghế thay giày',
    '左侧上延伸': 'Hồi trái kéo dài lên', '外飘': 'Nhô ra ngoài', '下床高': 'Cao giường dưới', '右侧上延伸': 'Hồi phải kéo dài lên', '电视柜高': 'Cao tủ tivi', '拉位上留空': 'Hở trên chỗ tay nắm',
    '右墙板宽': 'Rộng tấm ốp tường phải', '台面宽': 'Rộng mặt bàn', '龙头距后': 'Vòi cách sau', '要开孔请输240': 'Cần khoét lỗ thì nhập 240', '龙头孔距前': 'Lỗ vòi cách trước', '上空': 'Hở trên',
    '台面深': 'Sâu mặt bàn', '上墙板高': 'Cao tấm ốp tường trên', '地台高': 'Cao bục', '上1空': 'Khoảng trên 1', '上2空': 'Khoảng trên 2', '上3空': 'Khoảng trên 3', '上4空': 'Khoảng trên 4',
    '上5空': 'Khoảng trên 5', '上6空': 'Khoảng trên 6', '床宽': 'Rộng giường', '左柜1宽': 'Rộng tủ trái 1', '左柜2宽': 'Rộng tủ trái 2', '左墙板宽': 'Rộng tấm ốp tường trái',
    '检修口据后': 'Ô thăm cách sau', '检修口距后': 'Ô thăm cách sau', '左柜3宽': 'Rộng tủ trái 3', '开放格高': 'Cao ô hở', '门洞深': 'Sâu ô cửa', '桌面高': 'Cao mặt bàn',
    '前封板高': 'Cao tấm bịt trước', '背板下伸': 'Hậu kéo dài xuống', '书柜深': 'Sâu tủ sách', '炉台柜宽': 'Rộng tủ bếp nấu', '右柜1宽': 'Rộng tủ phải 1', '背条上缩': 'Thanh giằng sau lùi trên',
    '背条下缩': 'Thanh giằng sau lùi dưới', '柜子前缩': 'Tủ lùi trước', '顶前伸': 'Nóc kéo dài ra trước', '顶右延伸': 'Nóc kéo dài phải', '顶左延伸': 'Nóc kéo dài trái', '桌面宽': 'Rộng mặt bàn',
    '书桌深': 'Sâu bàn', '顶板后伸': 'Nóc kéo dài ra sau', '左弧角': 'Góc bo trái', '右弧角': 'Góc bo phải', '书桌宽': 'Rộng bàn', '顶板加深': 'Nóc sâu thêm', '电脑桌高': 'Cao bàn máy tính',
    '格栅宽': 'Rộng lam', '左柜4宽': 'Rộng tủ trái 4', '榻榻米收口': 'Nẹp bù tatami', '侧板前缩': 'Hồi lùi trước', '封边': 'Dán cạnh', '右开放格宽': 'Rộng ô hở phải', '中心距后': 'Tâm cách sau',
    '左格宽': 'Rộng ô trái', '右格宽': 'Rộng ô phải', '侧柜深': 'Sâu tủ bên', '侧开柜深': 'Sâu tủ mở bên', '梯高': 'Cao thang', '床深': 'Sâu giường', '右柜2宽': 'Rộng tủ phải 2',
    '顶柜高': 'Cao tủ nóc', '背板高': 'Cao hậu', '左格栅宽': 'Rộng lam trái', '电视格高': 'Cao ô tivi', '板深': 'Sâu tấm', '左开放柜宽': 'Rộng tủ hở trái', '右开放柜宽': 'Rộng tủ hở phải',
    '地柜高': 'Cao tủ dưới', '鞋凳宽': 'Rộng ghế thay giày', '中下柜高': 'Cao tủ giữa dưới', '顶底左延伸': 'Nóc đáy kéo dài trái', '顶底右延伸': 'Nóc đáy kéo dài phải',
    '背板后移判断': 'Điều kiện dời hậu ra sau', '距左内空': 'Cách lọt lòng trái', '前缺高': 'Cao khuyết trước', '前缺深': 'Sâu khuyết trước', '前内缩': 'Trước lùi vào', '后缺高': 'Cao khuyết sau',
    '下抽屉高': 'Cao ngăn kéo dưới', '烤箱格高': 'Cao ô lò nướng', '蒸箱格高': 'Cao ô lò hấp', '中间柜深': 'Sâu tủ giữa', '踢脚宽': 'Rộng xà chân', '上下框高': 'Cao khung trên dưới',
    '梳妆台高': 'Cao bàn trang điểm', '弧形柜宽': 'Rộng tủ cong', '左衣柜宽': 'Rộng tủ áo trái', '书柜宽': 'Rộng tủ sách', '底板左延伸': 'Đáy kéo dài trái', '底板右延伸': 'Đáy kéo dài phải',
    '1空间': 'Khoang 1', '2空间': 'Khoang 2', '中间留空高': 'Cao khoảng hở giữa', '下墙板高': 'Cao tấm ốp tường dưới', '电视柜宽': 'Rộng tủ tivi', '右门宽': 'Rộng cánh phải',
    '左柜5宽': 'Rộng tủ trái 5', '背板后留空': 'Hở sau hậu', '左深': 'Sâu trái', '右深': 'Sâu phải', '中上柜高': 'Cao tủ giữa trên', '悬空高': 'Cao treo cách sàn', '右柜3宽': 'Rộng tủ phải 3',
    '洗衣机宽': 'Rộng máy giặt', '左侧宽': 'Rộng bên trái', '右侧宽': 'Rộng bên phải', '中柜深': 'Sâu tủ giữa', '桌面前伸': 'Mặt bàn kéo dài ra trước', '柜体前缩': 'Thùng tủ lùi trước',
    '层板距上': 'Đợt cách trên', '左边宽': 'Rộng cạnh trái', '中间格宽': 'Rộng ô giữa', '背条左缩': 'Thanh giằng sau lùi trái', '背条右缩': 'Thanh giằng sau lùi phải', '下部份高': 'Cao phần dưới',
    '中间空': 'Hở giữa', '侧板前伸': 'Hồi kéo dài ra trước', '内嵌': 'Âm vào trong', '下降': 'Hạ xuống', '左边厚': 'Dày cạnh trái', '左背板厚/含槽': 'Dày hậu trái / gồm rãnh',
    '右边厚': 'Dày cạnh phải', '右背板厚/含槽': 'Dày hậu phải / gồm rãnh', '左转角宽': 'Rộng góc trái', '转角深': 'Sâu góc', '右转角宽': 'Rộng góc phải', '左侧下延伸': 'Hồi trái kéo dài xuống',
    '右侧下延伸': 'Hồi phải kéo dài xuống', '封板上延伸': 'Tấm bịt kéo dài trên', '收口条': 'Nẹp bù', '左侧柜深': 'Sâu tủ bên trái', '抽屉总高': 'Tổng cao ngăn kéo',
    '柜子前延伸': 'Tủ kéo dài ra trước', '右柜高': 'Cao tủ phải', '中间柜宽': 'Rộng tủ giữa', '台面前延伸': 'Mặt bàn kéo dài ra trước', '书桌厚': 'Dày bàn', '转角宽': 'Rộng góc', '1格高': 'Cao ô 1',
    '2格高': 'Cao ô 2', '4格高': 'Cao ô 4', '梯宽': 'Rộng thang', '梯深': 'Sâu thang', '勾距上': 'Móc cách trên', '左梯宽': 'Rộng thang trái', '上床高': 'Cao giường trên',
    '前板左伸': 'Tấm trước kéo dài trái', '前板右伸': 'Tấm trước kéo dài phải', '开放高': 'Cao phần hở', '左侧后延伸': 'Hồi trái kéo dài ra sau', '右侧后延伸': 'Hồi phải kéo dài ra sau',
    '顶板后延伸': 'Nóc kéo dài ra sau', '底板后延伸': 'Đáy kéo dài ra sau', '底左侧板判断': 'Điều kiện hồi trái dưới', '底左底板判断': 'Điều kiện đáy trái dưới',
    '底右侧板判断': 'Điều kiện hồi phải dưới', '底右底板判断': 'Điều kiện đáy phải dưới', '上左侧板判断': 'Điều kiện hồi trái trên', '上左顶板判断': 'Điều kiện nóc trái trên',
    '上右侧板判断': 'Điều kiện hồi phải trên', '上右顶板判断': 'Điều kiện nóc phải trên', '背板槽判断': 'Điều kiện rãnh hậu', '背板封边判断': 'Điều kiện dán cạnh hậu', '吊柜右留空': 'Tủ treo hở phải',
    '右格栅宽': 'Rộng lam phải', '3空间': 'Khoang 3', '弧度': 'Độ cong', '立板距右': 'Vách cách phải', '衣柜宽': 'Rộng tủ áo', '左衣柜深': 'Sâu tủ áo trái', '抽屉柜宽': 'Rộng tủ ngăn kéo',
    '下柜深': 'Sâu tủ dưới', '右板宽': 'Rộng tấm phải', '中留空': 'Hở giữa', '电视柜长': 'Dài tủ tivi', '中墙板宽': 'Rộng tấm ốp tường giữa', '下抽屉柜高': 'Cao tủ ngăn kéo dưới',
    '上抽屉柜高': 'Cao tủ ngăn kéo trên', '右上柜宽': 'Rộng tủ trên phải', '餐桌高': 'Cao bàn ăn', '右吊柜宽': 'Rộng tủ treo phải', '左开放格宽': 'Rộng ô hở trái', '左吊柜宽': 'Rộng tủ treo trái',
    '上柜宽': 'Rộng tủ trên', '抽屉柜延伸': 'Tủ ngăn kéo kéo dài', '弧形封板宽': 'Rộng tấm bịt cong', '右前延': 'Kéo dài trước phải', '凳子高': 'Cao ghế', '右上高': 'Cao trên phải',
    '左柜深度': 'Sâu tủ trái', '右柜深度': 'Sâu tủ phải', '左柜1': 'Tủ trái 1', '左柜2': 'Tủ trái 2', '下柜离地高': 'Tủ dưới cách sàn', '吊柜离台面高': 'Tủ treo cách mặt bàn', '转角柜深': 'Sâu tủ góc',
    '右上柜深': 'Sâu tủ trên phải', '床头柜高': 'Cao tab đầu giường', '床头柜延伸': 'Tab đầu giường kéo dài', '左上柜深': 'Sâu tủ trên trái', '烟机吊柜宽': 'Rộng tủ treo máy hút mùi',
    '拉篮地柜宽': 'Rộng tủ dưới có giá kéo', '收口宽度': 'Rộng nẹp bù', '书柜高': 'Cao tủ sách', '开放宽': 'Rộng phần hở', '洗衣机高': 'Cao máy giặt', '水槽柜高': 'Cao tủ chậu rửa',
    '洗衣机柜宽': 'Rộng tủ máy giặt', '左封板宽': 'Rộng tấm bịt trái', '拉手槽长度': 'Dài rãnh tay nắm', '桌背留空': 'Hở sau bàn', '后踢脚前移': 'Xà chân sau dời ra trước',
    '拉槽判断': 'Điều kiện rãnh tay nắm', '背板判断上': 'Điều kiện hậu trên', '背板判断下': 'Điều kiện hậu dưới', '封边判断': 'Điều kiện dán cạnh', '上开放格高': 'Cao ô hở trên', '延伸': 'Kéo dài',
    '左侧下留空': 'Hồi trái hở dưới', '右侧下留空': 'Hồi phải hở dưới', '背板左延伸': 'Hậu kéo dài trái', '背板右延伸': 'Hậu kéo dài phải', '整体前缩': 'Cả tủ lùi trước', '水槽开孔长': 'Dài lỗ chậu rửa',
    '水槽开孔宽': 'Rộng lỗ chậu rửa', '水槽距后': 'Chậu rửa cách sau', '灶上移': 'Bếp dời lên', '柜体前延伸': 'Thùng tủ kéo dài ra trước', '左抽屉宽': 'Rộng ngăn kéo trái',
    '中抽屉柜宽': 'Rộng tủ ngăn kéo giữa', '右柜柜门宽': 'Rộng cánh tủ phải', '罗马柱宽': 'Rộng cột La Mã', '梳妆台深': 'Sâu bàn trang điểm', '玻璃框宽': 'Rộng khung kính',
    '左右倒角': 'Vát góc trái phải', '桌侧左缩': 'Hông bàn lùi trái', '房门宽': 'Rộng cửa phòng', '靠背高': 'Cao tựa lưng', '衣柜下高': 'Cao phần dưới tủ áo', '衣柜深度': 'Sâu tủ áo',
    '书桌抽屉高含桌面': 'Cao ngăn kéo bàn (gồm mặt bàn)', '上格栅高': 'Cao lam trên', '错层深': 'Sâu lệch tầng', '立板距左': 'Vách cách trái', '左后留空': 'Hở sau trái', '右后留空': 'Hở sau phải',
    '衣柜总宽': 'Tổng rộng tủ áo', '背板后距': 'Hậu cách sau', '左柜高': 'Cao tủ trái', '抽屉柜下留空': 'Tủ ngăn kéo hở dưới', '左下高': 'Cao dưới trái', '左边开放格宽': 'Rộng ô hở bên trái',
    '下留空高': 'Cao khoảng hở dưới', '上收口': 'Nẹp bù trên', '右柜门宽': 'Rộng cánh tủ phải', '中间开放高': 'Cao phần hở giữa', '开放柜深': 'Sâu tủ hở', '右书柜宽': 'Rộng tủ sách phải',
    '右书柜深': 'Sâu tủ sách phải', '左1宽': 'Rộng trái 1', '左2宽': 'Rộng trái 2', '左3宽': 'Rộng trái 3', '左4宽': 'Rộng trái 4', '左5宽': 'Rộng trái 5', '左6宽': 'Rộng trái 6',
    '电视左柜宽': 'Rộng tủ bên trái tivi', '电视右柜宽': 'Rộng tủ bên phải tivi', '矮柜高': 'Cao tủ thấp', '左电视柜宽': 'Rộng tủ tivi trái', '下格栅高': 'Cao lam dưới', '腰线柜高': 'Cao tủ ngang eo',
    '有柜宽': 'Rộng tủ phải', '墙板高': 'Cao tấm ốp tường', '电视格宽': 'Rộng ô tivi', '吊柜总高': 'Tổng cao tủ treo', '中间条子宽': 'Rộng nẹp giữa', '左上柜宽': 'Rộng tủ trên trái',
    '开放格深度': 'Sâu ô hở', '加强条高': 'Cao thanh tăng cứng', '餐桌宽': 'Rộng bàn ăn', '餐桌长': 'Dài bàn ăn', '开放格宽度': 'Rộng ô hở', '开放上柜': 'Tủ trên hở', '抽屉宽': 'Rộng ngăn kéo',
    '餐柜深': 'Sâu tủ ăn', '加强条': 'Thanh tăng cứng', '双抽高': 'Cao 2 ngăn kéo', '柜1宽': 'Rộng tủ 1', '柜2宽': 'Rộng tủ 2', '柜3宽': 'Rộng tủ 3', '柜4宽': 'Rộng tủ 4', '柜5宽': 'Rộng tủ 5',
    '柜6宽': 'Rộng tủ 6', '柜1': 'Tủ 1', '柜2': 'Tủ 2', '柜3': 'Tủ 3', '柜4': 'Tủ 4', '右吊柜高': 'Cao tủ treo phải', '键盘深': 'Sâu khay bàn phím', '总宽': 'Tổng rộng', '总高': 'Tổng cao',
    '引孔': 'Lỗ mồi', '左柜6宽': 'Rộng tủ trái 6', '下弧形封板高': 'Cao tấm bịt cong dưới', '左前延': 'Kéo dài trước trái', '凳子深': 'Sâu ghế', '鞋柜深': 'Sâu tủ giày',
    '左上吊柜高': 'Cao tủ treo trên trái', '小上柜高': 'Cao tủ trên nhỏ', '左边柜宽': 'Rộng tủ bên trái', '中柜宽': 'Rộng tủ giữa', '左上高': 'Cao trên trái', '侧柜深度': 'Sâu tủ bên',
    '左柜3': 'Tủ trái 3', '台面上高': 'Cao trên mặt bàn', '造型空间宽': 'Rộng khoang tạo hình', '中间封板宽': 'Rộng tấm bịt giữa', '下柜抽屉宽': 'Rộng ngăn kéo tủ dưới', '银镜宽': 'Rộng gương',
    '右开门宽': 'Rộng cánh mở phải', '梳妆台宽': 'Rộng bàn trang điểm', '楣条高': 'Cao diềm trên', '拉条下降': 'Thanh giằng hạ xuống', '左书柜深': 'Sâu tủ sách trái',
    '桌上开放柜宽': 'Rộng tủ hở trên bàn', '衣柜下柜高': 'Cao tủ dưới của tủ áo', '衣柜开放柜高': 'Cao tủ hở của tủ áo', '书桌开放柜宽': 'Rộng tủ hở của bàn', '右柜4宽': 'Rộng tủ phải 4',
    '右柜5宽': 'Rộng tủ phải 5', '中下柜宽': 'Rộng tủ giữa dưới', '转角柜宽': 'Rộng tủ góc', '延伸衣柜宽': 'Rộng tủ áo nối dài', '桌面深': 'Sâu mặt bàn', '左开放柜高': 'Cao tủ hở trái',
    '右开放柜高': 'Cao tủ hở phải', '垫板前缩': 'Tấm đệm lùi trước', '垫板后缩': 'Tấm đệm lùi sau', '下切': 'Cắt dưới', '上切': 'Cắt trên', '吊柜左留空': 'Tủ treo hở trái',
    '灶下柜宽': 'Rộng tủ dưới bếp', '洗衣机位宽': 'Rộng chỗ máy giặt', '上柜深度': 'Sâu tủ trên', '左上收口宽': 'Rộng nẹp bù trên trái', '左柜宽度': 'Rộng tủ trái', '下柜高度': 'Cao tủ dưới',
    '吊柜深度': 'Sâu tủ treo', '开放柜高度': 'Cao tủ hở', '踢脚高度': 'Cao xà chân', '地柜深': 'Sâu tủ dưới', '封板上延': 'Tấm bịt kéo dài trên', '桌侧右缩': 'Hông bàn lùi phải',
    '桌面左伸': 'Mặt bàn kéo dài trái', '桌面右伸': 'Mặt bàn kéo dài phải', '背板后缩': 'Hậu lùi sau', '中倒角': 'Vát góc giữa', '前盖': 'Phủ trước', '后盖': 'Phủ sau', '封板高': 'Cao tấm bịt',
    '整体往前加深': 'Cả tủ sâu thêm ra trước', '下柜总高': 'Tổng cao tủ dưới', '上层空间': 'Khoang tầng trên', '4空间': 'Khoang 4', '左柜上延伸': 'Tủ trái kéo dài lên',
    '右柜上延伸': 'Tủ phải kéo dài lên', '电视位宽': 'Rộng chỗ tivi', '拉手条高': 'Cao thanh tay nắm', '抽屉离地高': 'Ngăn kéo cách sàn', '双抽高度': 'Cao 2 ngăn kéo', '门板宽度': 'Rộng cánh',
    '档条高': 'Cao thanh chắn', '下开放格高': 'Cao ô hở dưới', '立板': 'Vách', '左侧缩': 'Hồi trái lùi', '右侧缩': 'Hồi phải lùi', '左侧厚': 'Dày hồi trái', '右侧厚': 'Dày hồi phải',
    '挂钩距上': 'Móc treo cách trên', '柜子深': 'Sâu tủ', '台面厚度': 'Dày mặt bàn', '柜子后缩': 'Tủ lùi sau', '弧形': 'Cong', '抽上到底距离': 'Khoảng từ mép trên ngăn kéo tới đáy',
    '台面长': 'Dài mặt bàn', '靠墙距离': 'Khoảng cách tới tường', '右上升': 'Nâng lên bên phải', '顶包背动作': 'Động tác nóc phủ hậu', '后地脚后缩': 'Chân sau lùi sau',
    '前地脚内缩': 'Chân trước lùi vào', '前背板左延伸': 'Hậu trước kéo dài trái', '前背板右延伸': 'Hậu trước kéo dài phải',
  };

  /* ---- 2. Ghép từ: cho ghi chú lạ chưa có trong bảng trên (kết quả có dấu ~ phía trước để biết là dịch ghép) ---- */
  // loại: N = danh từ (bộ phận) · D = hướng · A = hành động / trạng thái · M = số đo (đứng đầu câu tiếng Việt) · S = hậu tố
  const TU = [
    ['左右侧板', 'hai hồi', 'N'], ['左侧板', 'hồi trái', 'N'], ['右侧板', 'hồi phải', 'N'], ['侧板', 'hồi', 'N'], ['顶底板', 'nóc đáy', 'N'], ['顶底', 'nóc đáy', 'N'], ['顶板', 'nóc', 'N'], ['底板', 'đáy', 'N'], ['背板', 'hậu', 'N'], ['立板', 'vách', 'N'], ['层板', 'đợt', 'N'],
    ['门板', 'cánh', 'N'], ['移门', 'cửa lùa', 'N'], ['门', 'cánh', 'N'], ['抽屉', 'ngăn kéo', 'N'], ['抽盒', 'hộp ngăn kéo', 'N'], ['抽面', 'mặt ngăn kéo', 'N'], ['抽底', 'đáy ngăn kéo', 'N'], ['抽侧板', 'thành ngăn kéo', 'N'], ['抽侧', 'thành ngăn kéo', 'N'], ['抽帮', 'thành ngăn kéo', 'N'], ['抽', 'ngăn kéo', 'N'],
    ['拉手', 'tay nắm', 'N'], ['把手', 'tay nắm', 'N'], ['铰链', 'bản lề', 'N'], ['轨道', 'ray', 'N'], ['导轨', 'ray', 'N'], ['封板', 'tấm bịt', 'N'], ['盖板', 'tấm phủ', 'N'], ['垫板', 'tấm đệm', 'N'], ['辅助板', 'tấm phụ', 'N'], ['芯板', 'pa-nô', 'N'],
    ['地脚线', 'xà chân', 'N'], ['脚线', 'xà chân', 'N'], ['地脚', 'chân tủ', 'N'], ['腰线', 'đai giữa', 'N'], ['边框', 'khung viền', 'N'], ['衣杆', 'suốt treo', 'N'], ['裤杆', 'thanh treo quần', 'N'], ['镜子', 'gương', 'N'], ['灯带', 'đèn LED', 'N'],
    ['开放柜', 'tủ hở', 'N'], ['开放格', 'ô hở', 'N'], ['上柜', 'tủ trên', 'N'], ['下柜', 'tủ dưới', 'N'], ['柜', 'tủ', 'N'], ['台面', 'mặt bàn', 'N'], ['引孔', 'lỗ mồi', 'N'], ['预埋件', 'ốc cấy', 'N'], ['孔', 'lỗ', 'N'], ['槽', 'rãnh', 'N'],
    ['切角', 'cắt góc', 'N'], ['切口', 'vết cắt', 'N'], ['缺口', 'khuyết', 'N'], ['圆弧', 'cung', 'N'], ['板', 'ván', 'N'], ['模板', 'mẫu', 'N'], ['上层', 'tầng trên', 'N'], ['下层', 'tầng dưới', 'N'],
    ['左右', 'trái–phải', 'D'], ['前后', 'trước–sau', 'D'], ['上下', 'trên–dưới', 'D'], ['左侧', 'bên trái', 'D'], ['右侧', 'bên phải', 'D'], ['左', 'trái', 'D'], ['右', 'phải', 'D'], ['上', 'trên', 'D'], ['下', 'dưới', 'D'], ['前', 'trước', 'D'], ['后', 'sau', 'D'], ['内', 'trong', 'D'], ['外', 'ngoài', 'D'], ['中', 'giữa', 'D'], ['顶', 'nóc', 'D'], ['底', 'đáy', 'D'],
    ['预留间隙', 'khe chừa', 'A'], ['间隙', 'khe', 'A'], ['缝隙', 'khe', 'A'], ['留空', 'hở', 'A'], ['内空', 'lọt lòng', 'A'], ['内缩', 'lùi vào', 'A'], ['内退', 'lùi vào', 'A'], ['延伸', 'kéo dài', 'A'], ['平移', 'dịch', 'A'], ['移动', 'dịch', 'A'], ['移', 'dịch', 'A'], ['缩', 'lùi', 'A'], ['延', 'kéo dài', 'A'],
    ['距边', 'cách mép', 'A'], ['边距', 'cách mép', 'A'], ['间距', 'khoảng cách', 'A'], ['距离', 'khoảng cách', 'A'], ['距', 'cách', 'A'], ['靠', 'sát', 'A'], ['调整', 'chỉnh', 'A'], ['修正', 'hiệu chỉnh', 'A'], ['减', 'trừ', 'A'], ['扣', 'trừ', 'A'], ['包', 'bọc', 'A'], ['装', 'lắp', 'A'], ['位置', 'vị trí', 'A'],
    ['厚度', 'dày', 'M'], ['宽度', 'rộng', 'M'], ['高度', 'cao', 'M'], ['深度', 'sâu', 'M'], ['长度', 'dài', 'M'], ['半径', 'bán kính', 'M'], ['厚', 'dày', 'M'], ['宽', 'rộng', 'M'], ['高', 'cao', 'M'], ['深', 'sâu', 'M'], ['长', 'dài', 'M'],
    ['参数', 'tham số', 'S'], ['值', 'giá trị', 'S'], ['自动', 'tự động', 'X'],
  ].sort((a, b) => b[0].length - a[0].length);

  function ghep(s) {
    const ds = [];
    for (let i = 0; i < s.length;) {
      if (/[0-9A-Za-z\s\-_.+*/()（）]/.test(s[i])) { let j = i; while (j < s.length && /[0-9A-Za-z\s\-_.+*/()（）]/.test(s[j])) j++; ds.push([s.slice(i, j).trim(), 'X']); i = j; continue; }
      const t = TU.find(x => s.startsWith(x[0], i));
      if (!t) return null;      // còn chữ không biết → để nguyên tiếng Trung, không đoán
      ds.push([t[1], t[2]]); i += t[0].length;
    }
    // trật tự tiếng Việt: [tham số / giá trị] [số đo cuối câu] đưa lên đầu; chuỗi danh từ đảo ngược; hướng đứng sau danh từ / hành động
    const dau = [];
    while (ds.length && ds[ds.length - 1][1] === 'S') dau.push(ds.pop()[0]);
    if (ds.length && ds[ds.length - 1][1] === 'M') dau.push(ds.pop()[0]);
    const than = []; let cho = [];
    for (let k = 0; k < ds.length; k++) {
      const [v, l] = ds[k];
      if (!v) continue;
      if (l === 'D') { cho.push(v); continue; }
      if (l === 'N') { let j = k; const ns = []; while (j < ds.length && ds[j][1] === 'N') ns.unshift(ds[j++][0]); k = j - 1; than.push(...ns, ...cho); cho = []; continue; }
      than.push(v, ...cho); cho = [];
    }
    than.push(...cho);
    const out = dau.concat(than).join(' ').replace(/\s+/g, ' ').trim();
    return out ? '~' + out.charAt(0).toUpperCase() + out.slice(1) : null;
  }

  /** Dịch một ghi chú. Trả về chuỗi tiếng Việt, hoặc chính chuỗi cũ nếu không dịch được / không phải tiếng Trung. */
  function dich(s) {
    if (typeof s !== 'string') return s;
    const t = s.trim();
    if (!t || !CJK.test(t)) return s;
    if (Object.prototype.hasOwnProperty.call(CAU, t)) return CAU[t];
    return ghep(t) || s;
  }

  /* ---- 3. Đổi chữ hiển thị trong trang Chenfeng ---- */
  // ô ghi chú: cột thứ 3 của bảng tham số (bảng phải .template-params, bảng kho mẫu .template-detail) + tên nút trong cây mẫu bên phải
  const KHONG_TD = 'li:not(.template-params-header):not(.template-detail-header) > span:nth-child(3)';
  const CHON = '.template-params ' + KHONG_TD + ', .template-detail ' + KHONG_TD;
  let bat = true, mo = null, hen = 0;
  const doc = () => root.document;

  function doiO(el) {
    const n = el.firstChild;
    if (!n || n.nodeType !== 3 || el.childNodes.length !== 1) return 0;      // chỉ đụng ô có đúng một đoạn chữ
    const goc = n.nodeValue;
    if (!CJK.test(goc)) return 0;
    const vi = dich(goc);
    if (vi === goc) return 0;
    n.nodeValue = vi;                         // đổi nội dung nút chữ sẵn có (không thay nút) để React vẫn giữ đúng tham chiếu
    el.setAttribute('data-mncf-goc', goc);
    el.title = goc + ' → ' + vi;
    return 1;
  }
  function quet() {
    hen = 0;
    if (!bat) return 0;
    let n = 0;
    try {
      for (const el of doc().querySelectorAll(CHON)) n += doiO(el);
      // ô đã dịch nhưng Chenfeng vừa ghi chữ khác vào (đổi sang mẫu khác) → bỏ chú thích cũ
      for (const el of doc().querySelectorAll('[data-mncf-goc]')) { const t = el.firstChild; if (!t || t.nodeType !== 3 || t.nodeValue !== dich(el.getAttribute('data-mncf-goc'))) { el.removeAttribute('data-mncf-goc'); el.removeAttribute('title'); } }
    } catch (e) { /* không để lỗi lọt ra trang */ }
    return n;
  }
  function traLai() {
    try {
      for (const el of doc().querySelectorAll('[data-mncf-goc]')) {
        const n = el.firstChild, goc = el.getAttribute('data-mncf-goc');
        if (n && n.nodeType === 3 && el.childNodes.length === 1 && n.nodeValue === dich(goc)) n.nodeValue = goc;
        el.removeAttribute('data-mncf-goc'); el.removeAttribute('title');
      }
    } catch (e) { /* bỏ qua */ }
  }
  function henQuet() { if (!hen && bat) hen = root.setTimeout(quet, 60); }
  function khoiDong() {
    if (mo || typeof root.MutationObserver !== 'function' || !doc() || !doc().documentElement) return;
    try { bat = root.localStorage.getItem(LS) !== '0'; } catch (e) { bat = true; }
    mo = new root.MutationObserver(() => { try { henQuet(); } catch (e) { /* bỏ qua */ } });
    mo.observe(doc().documentElement, { childList: true, subtree: true, characterData: true });
    henQuet();
  }

  const API = {
    dich, ghep, CAU,
    get dangBat() { return bat; },
    bat() { bat = true; try { root.localStorage.removeItem(LS); } catch (e) { /* bỏ qua */ } return quet(); },
    tat() { bat = false; try { root.localStorage.setItem(LS, '0'); } catch (e) { /* bỏ qua */ } traLai(); },
    quet, khoiDong,
  };
  root.MNCFDich = API;
  (root.MNCF = root.MNCF || {}).dich = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

  try {
    const d = doc();
    if (d && root.location && /(^|\.)cfcad\.(cn|com)$/.test(root.location.hostname) && !/^\/help/.test(root.location.pathname) && !d.documentElement.hasAttribute('data-mncf-page')) {
      if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', khoiDong); else khoiDong();
    }
  } catch (e) { /* bỏ qua */ }
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));

/*!
 * mncf-driver.js — điều khiển Chenfeng WebCAD ngay trong trang (https://cfcad.cn).
 * Chỉ dùng các đường đã kiểm chứng trên bản 2026-09-29:
 *   - thả file .json có khoá ModelSpace vào trang = lệnh "晨丰导入" (CF) của Chenfeng
 *   - app.Editor.InputEvent('x,y,z') trả lời lời nhắc chọn điểm; '' = Enter
 *   - app.Editor.CommandStore.HandleInput('TÊN LỆNH') chạy lệnh khi đang rảnh
 *   - app.Database.ModelSpace.Entitys để đọc lại mô hình
 * Không lưu bản vẽ, không đổi cấu hình tài khoản.
 */
(function (root) {
  'use strict';
  const Core = root.MNCFCore;
  // Hẹn giờ chạy trong Worker: tab Chenfeng nằm nền bị Chrome bóp setTimeout còn 1 lần/phút, Worker thì không.
  const sleep = (() => {
    let w = null, seq = 0; const pending = new Map();
    const make = () => {
      try {
        const wk = new Worker(URL.createObjectURL(new Blob(['onmessage=e=>setTimeout(()=>postMessage(e.data[0]),e.data[1])'], { type: 'text/javascript' })));
        wk.onmessage = e => { const r = pending.get(e.data); if (r) { pending.delete(e.data); r(); } };
        wk.onerror = () => { w = false; for (const r of pending.values()) r(); pending.clear(); };
        return wk;
      } catch (e) { return false; }
    };
    return ms => new Promise(res => { if (w === null) w = make(); if (!w) return setTimeout(res, ms); const id = ++seq; pending.set(id, res); w.postMessage([id, ms]); });
  })();
  // hàm báo tiến độ do người gọi đưa vào: lỗi của nó không được làm hỏng lần vẽ, cũng không được lọt ra trang
  const guard = f => (f && f.__mncfGuard ? f : Object.assign(t => { try { if (f) f(t); } catch (e) { /* bỏ qua */ } }, { __mncfGuard: true }));
  const TOL = 0.06;
  const FILE_NAME = 'mn-chenfeng-ve-tu.json';
  const D = {};

  D.available = () => { try { const a = root.app; return !!(a && a.Editor && a.Editor.CommandStore && a.Editor.InputEvent && a.Database && a.Database.ModelSpace); } catch (e) { return false; } };
  const ed = () => root.app.Editor;
  const services = () => ed().InteractiveServices || [];
  const gp = () => ed().GetPointServices || services().find(s => typeof s.ReturnPoint === 'function');
  const ge = () => ed().GetEntityServices || services().find(s => s.constructor && s.constructor.name === 'GetEntityServices');
  const kw = () => ed().KeywordsServices || services().find(s => 'keywordList' in s);
  const ready = s => { try { return !!s && s.IsReady === true; } catch (e) { return false; } };

  D.busy = () => ready(gp()) || ready(ge()) || ready(kw());

  /**
   * Chenfeng có đang ở màn hình vẽ không (không bị trang chủ / màn chào che kín)?
   * Ở trang chủ, thả file có thể bị hiểu là tải file lên kho của tài khoản — nên phải chặn.
   */
  D.editing = () => {
    try {
      const c = root.app.Viewer.Renderer.domElement, r = c.getBoundingClientRect();
      if (!(r.width > 50 && r.height > 50)) return false;
      // chỉ dò trong phần vùng vẽ đang nằm trong khung nhìn (cửa sổ thu nhỏ thì vùng vẽ có thể rộng hơn cửa sổ; điểm ngoài khung nhìn không dò được)
      const x0 = Math.max(r.left, 0), y0 = Math.max(r.top, 0), x1 = Math.min(r.right, root.innerWidth || r.right), y1 = Math.min(r.bottom, root.innerHeight || r.bottom);
      if (x1 - x0 < 40 || y1 - y0 < 40) return true;                    // không thấy vùng vẽ trong khung nhìn → không xác định, không chặn
      const host = document.getElementById('mncf-host');
      // "Màn che" của Chenfeng: sau khi gõ vào một ô của bảng bên phải (Thông số…), Chenfeng phủ một lớp trong suốt lên cả trang cho tới khi bấm ra vùng vẽ.
      // Lớp đó KHÔNG phải màn chào → bỏ qua khi dò (bản < 1.12 báo nhầm "đang ở trang chủ / màn chào").
      const manChe = e => { try { if (e.tagName !== 'DIV' || e.children.length) return false; const st = root.getComputedStyle(e); return st.position === 'fixed' && Number(st.opacity) === 0; } catch (err) { return false; } };
      const mine = e => (host && (e === host || host.contains(e))) || manChe(e);
      for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.3], [0.75, 0.3], [0.25, 0.7], [0.75, 0.7], [0.1, 0.5], [0.5, 0.12], [0.5, 0.9]]) {
        const top = document.elementsFromPoint(x0 + (x1 - x0) * fx, y0 + (y1 - y0) * fy).find(e => !mine(e));
        if (top === c) return true;
      }
      return false;
    } catch (e) { return true; }     // không xác định được thì không chặn
  };
  /** Gỡ "màn che" của Chenfeng (xem D.editing) trước khi chạy lệnh — chính Chenfeng cũng gọi MaskManage.Clear() trước lệnh chèn mẫu. */
  D.boManChe = () => { try { const m = ed().MaskManage; if (m && typeof m.Clear === 'function') m.Clear(); } catch (e) { /* bỏ qua */ } try { const a = document.activeElement; if (a && a !== document.body && typeof a.blur === 'function' && !(document.getElementById('mncf-host') || { contains() { return false; } }).contains(a) && a.id !== 'mncf-host') a.blur(); } catch (e) { /* bỏ qua */ } };
  D.cancel = async () => { try { ed().Cancel(); } catch (e) { /* bỏ qua */ } await sleep(300); };
  D.cmd = name => ed().CommandStore.HandleInput(name);
  D.input = text => ed().InputEvent(text);

  D.all = () => root.app.Database.ModelSpace.Entitys.filter(e => e && !e.IsErase);
  D.isBoard = e => !!(e && e.BoardProcessOption && 'BoardType' in e);
  D.isHardware = e => !!(e && e.HardwareOption);
  D.isHole = e => !!(e && !D.isBoard(e) && !D.isHardware(e) && e.constructor && /Hole/i.test(e.constructor.name));

  const r2 = v => Math.round(v * 100) / 100;
  D.boxOf = e => { const b = e.BoundingBox; return [r2(b.min.x), r2(b.max.x), r2(b.min.y), r2(b.max.y), r2(b.min.z), r2(b.max.z)]; };

  D.drillTypes = () => { try { return [...root.userconfig.DrillConfigs.keys()]; } catch (e) { return []; } };

  // lịch sử hoàn tác của Chenfeng: dùng để đếm đúng số bước của một lần vẽ và không hoàn tác nhầm thao tác khác
  const hm = () => { try { const h = root.app.Database.hm; return h && typeof h.curIndex === 'number' && Array.isArray(h.historyRecord) ? h : null; } catch (e) { return null; } };
  const hmMark = () => { const h = hm(); return h ? { i: h.curIndex, rec: h.historyRecord[h.curIndex] || null } : null; };

  /**
   * Nghe sự kiện "lệnh kết thúc" của Chenfeng (app.CommandReactor.OnCommandEnd): biết chắc lệnh nhập / lệnh khoan đã xong hay bị huỷ,
   * thay vì đoán qua trạng thái lời nhắc. Trả về { get ended, off() }; nếu bản Chenfeng không có API này thì ok = false và nơi gọi tự dò như cũ.
   */
  const watchEnd = () => {
    const w = { ok: false, ended: null, off() {} };
    try {
      const cr = root.app.CommandReactor;
      if (cr && typeof cr.OnCommandEnd === 'function') {
        const dispose = cr.OnCommandEnd((name, changed, created) => { try { w.ended = { name, created: (created && created.length) || 0, changed: (changed && changed.length) || 0 }; } catch (e) { /* bỏ qua */ } });
        w.ok = true; w.off = () => { try { if (typeof dispose === 'function') dispose(); } catch (e) { /* bỏ qua */ } w.off = () => {}; };
      }
    } catch (e) { /* bỏ qua */ }
    return w;
  };

  const logList = () => (ed().CommandStore.promptList || []);
  const logMark = () => { const l = logList(); return l.length ? l[l.length - 1].key : -1; };
  const logsSince = mark => logList().filter(p => p.key > mark).map(p => ({ type: p.type, msg: p.msg }));

  /** Chờ tới khi số đối tượng đứng yên `quiet` ms (khoan, cắt rãnh chạy sau khi đặt). */
  D.settle = async (quiet = 1500, max = 90000) => {
    const t0 = Date.now(); let last = -1, lastT = Date.now();
    while (Date.now() - t0 < max) {
      const n = root.app.Database.ModelSpace.Entitys.length;
      if (n !== last) { last = n; lastT = Date.now(); } else if (Date.now() - lastT >= quiet && !D.busy()) return true;
      await sleep(150);
    }
    return false;
  };

  D.dropJSON = (obj, name) => {
    const f = new File([typeof obj === 'string' ? obj : JSON.stringify(obj)], name || FILE_NAME, { type: 'application/json' });
    const dt = new DataTransfer(); dt.items.add(f);
    const ev = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt });
    document.dispatchEvent(ev);
    return ev.defaultPrevented;
  };

  const failToast = () => [...document.querySelectorAll('.bp3-toast, .bp3-toast-message')].some(t => (t.textContent || '').includes(FILE_NAME));

  /**
   * Nhập một khối dữ liệu {ModelSpace:[…]} bằng cổng 晨丰导入.
   * @param obj   dữ liệu
   * @param point [x,y,z] điểm đặt cho GÓC NHỎ NHẤT của cả cụm; bỏ trống = người dùng tự bấm điểm trên bản vẽ
   */
  D.importCF = async (obj, point, opt) => {
    opt = Object.assign({ timeout: 120000, timeout_khoan: 180000, onStatus() {} }, opt || {});
    opt.onStatus = guard(opt.onStatus);
    if (!D.available()) throw new Error('Không thấy Chenfeng trong trang này.');
    if (!D.editing()) throw new Error('Chenfeng chưa ở màn hình vẽ (đang ở trang chủ hoặc có cửa sổ che kín vùng vẽ) — mở bản vẽ rồi bấm lại.');
    if (D.busy()) await D.cancel();
    try { ed().SelectCtrl.Cancel(); } catch (e) { /* bỏ qua */ }
    const before = new Set(root.app.Database.ModelSpace.Entitys);
    const mark = logMark();
    const w = watchEnd();
    const toastCu = new Set(document.querySelectorAll('.bp3-toast'));
    let dropped = false, khongHuy = false;      // khongHuy: không được gửi Esc khi thoát lỗi (lệnh đang chạy không phải của mình, hoặc tủ đã đặt xong)
    try {
      opt.onStatus('Đang gửi dữ liệu cho Chenfeng…');
      const n0 = root.app.Database.ModelSpace.Entitys.length;
      if (!D.dropJSON(obj)) throw new Error('Chenfeng không nhận dữ liệu (trang này chưa mở bản vẽ?).');
      dropped = true;
      const t0 = Date.now(); let told = false;
      while (!ready(gp()) && !w.ended) {
        if (failToast()) throw new Error('Chenfeng báo dữ liệu không hợp lệ (导入失败).');
        // Chenfeng đang chạy dở một lệnh khác thì từ chối lệnh nhập: chỉ ghi 1 dòng CẢNH BÁO vào dòng lệnh, không tạo gì, không hỏi điểm.
        if (Date.now() - t0 > 1200 && root.app.Database.ModelSpace.Entitys.length === n0) {
          const lg = logsSince(mark);
          if (lg.length && lg.some(p => p.type === 'WARNING') && !lg.some(p => p.type === 'COMMAND')) {
            khongHuy = true;
            throw new Error('Chenfeng đang bận một lệnh khác (lệnh trước chưa chạy xong) — chờ lệnh đó xong, hoặc bấm Esc trong Chenfeng, rồi bấm vẽ lại.');
          }
        }
        if (Date.now() - t0 > opt.timeout) throw new Error('Chờ quá lâu mà Chenfeng chưa tạo xong tấm (mạng chậm khi tải mẫu ngăn kéo/suốt treo?).');
        if (!told && Date.now() - t0 > 4000) { told = true; opt.onStatus(opt.bao_tai || 'Chenfeng đang tải mẫu ngăn kéo / suốt treo từ máy chủ…'); }
        await sleep(120);
      }
      if (!w.ended) {
        if (point) {
          const txt = point.map(v => String(Math.round(v * 1000) / 1000)).join(',');
          for (let i = 0; i < 6 && ready(gp()) && !w.ended; i++) { await sleep(450); if (ready(gp()) && !w.ended) D.input(txt); await sleep(350); }
          if (ready(gp()) && !w.ended) { await D.cancel(); throw new Error('Chenfeng không nhận toạ độ điểm đặt.'); }
        } else {
          opt.onStatus('Bấm 1 điểm trên bản vẽ để đặt tủ (góc trái – trước – dưới). Esc = huỷ.');
        }
        // chờ lệnh nhập kết thúc hẳn (đã đặt xong + khoan xong, hoặc người dùng bấm Esc).
        // Tab Chenfeng bị che (nằm nền) thì Chrome bóp đồng hồ của trang → Chenfeng khoan rất chậm: chờ lâu hơn và nhắc người dùng mở tab lên.
        let tDat = 0, nhac = false;
        while (w.ok ? !w.ended : ready(gp())) {
          if (w.ok) {
            if (ready(gp())) tDat = 0;
            else {
              if (!tDat) { tDat = Date.now(); khongHuy = true; opt.onStatus('Chenfeng đang khoan lỗ, cắt rãnh…'); }
              const an = !!(root.document && root.document.hidden), cho = Date.now() - tDat;
              if (an && !nhac && cho > 8000) { nhac = true; opt.onStatus('Tab Chenfeng đang bị che nên Chenfeng chạy rất chậm — mở tab Chenfeng lên để khoan xong nhanh hơn.'); }
              if (cho > (an ? Math.max(opt.timeout_khoan, 900000) : opt.timeout_khoan))
                throw new Error(`Đã đặt tủ nhưng sau ${Math.round(cho / 60000)} phút Chenfeng vẫn chưa khoan xong${an ? ' (tab Chenfeng đang bị che)' : ''} — mở tab Chenfeng, chờ nó chạy xong rồi kiểm tra lại; muốn bỏ thì bấm Ctrl+Z trong Chenfeng.`);
            }
          }
          await sleep(150);
        }
      }
      opt.onStatus('Chenfeng đang khoan lỗ, cắt rãnh…');
      await D.settle(w.ok && w.ended ? 700 : 1500, 90000);
    } catch (e) {
      // đã thả file mà hỏng giữa chừng (quá giờ, không nhận điểm…): gửi Esc để lệnh nhập không treo lại ở lời nhắc chọn điểm
      if (dropped && !w.ended && !khongHuy) { try { ed().Cancel(); } catch (e2) { /* bỏ qua */ } await sleep(300); if (ready(gp())) { try { ed().Cancel(); } catch (e2) { /* bỏ qua */ } } }
      throw e;
    } finally { w.off(); }
    const added = root.app.Database.ModelSpace.Entitys.filter(e => e && !e.IsErase && !before.has(e));
    if (!added.length && failToast()) throw new Error('Chenfeng báo dữ liệu không hợp lệ (导入失败).');
    if (!added.length) {
      // Lệnh nhập kết thúc mà không còn gì: người dùng bấm Esc, hoặc Chenfeng gặp lỗi giữa chừng rồi tự huỷ lệnh (hay gặp khi mạng tới máy chủ Chenfeng chậm, tải mẫu không xong) — lúc đó Chenfeng hiện một thông báo.
      const bao = [...document.querySelectorAll('.bp3-toast')].filter(t => !toastCu.has(t)).map(t => (t.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
      if (bao.length) throw new Error(`Chenfeng gặp lỗi khi nhập và đã tự huỷ lệnh — thường do mạng tới máy chủ Chenfeng chậm nên tải mẫu ngăn kéo / suốt treo không xong. Chưa vẽ gì, bấm vẽ lại. (Chenfeng báo: "${bao[0].slice(0, 110)}")`);
    }
    return { added, cancelled: added.length === 0, logs: logsSince(mark) };
  };

  /** Chọn đối tượng bằng mã (giống người dùng quét chọn). Trên Chenfeng thật `AddSelect` CỘNG THÊM vào tập đang chọn — muốn chọn riêng các đối tượng này thì dùng D.chonRieng. */
  D.chonRieng = (ents) => { try { ed().SelectCtrl.Cancel(); } catch (e) { /* bỏ qua */ } return D.select(ents); };
  D.select = (ents) => {
    const list = ents.filter(e => e && e.DrawObject);
    const sel = { _SelectList: new Set(list.map(e => e.DrawObject)), SelectGroup() { return 0; }, get SelectEntityList() { return list.slice(); } };
    ed().SelectCtrl.AddSelect(sel, true);
    return list.length;
  };

  /**
   * Hoàn thiện sau khi nhập (1 bước hoàn tác, chạy trong lệnh khoan DRAWHOLE của Chenfeng):
   *  - tấm sinh từ mẫu có thể mang tên kiểu khoan không còn trong cấu hình (vd "三合一" sau khi tài khoản đổi tên thành Cam3Tp) → đổi sang `fallback`;
   *  - cổng nhập của Chenfeng ghi "kiểu khoan" của tấm = kiểu ĐẦU TIÊN trong cấu hình, dù 4 cạnh đã đúng kiểu → sửa cho khớp 4 cạnh;
   *  - cho khoan lại các tấm vừa vẽ để lỗ khớp thuộc tính cuối cùng.
   */
  D.finalize = async (boards, fallback, opt) => {
    opt = Object.assign({ onStatus() {} }, opt || {});
    opt.onStatus = guard(opt.onStatus);
    const valid = new Set(D.drillTypes());
    if (!valid.size) return { fixed: 0, normalized: 0, reason: 'Không đọc được cấu hình khoan của Chenfeng.' };
    const isBad = x => typeof x === 'string' && x && x !== Core.KHONG_KHOAN && !valid.has(x);
    const hd = b => (Array.isArray(b.BoardProcessOption.highDrill) ? b.BoardProcessOption.highDrill : []);
    const bad = boards.filter(b => hd(b).some(isBad));
    const canFix = valid.has(fallback);
    const norm = boards.filter(b => { const h = hd(b); return h.length && new Set(h).size === 1 && !isBad(h[0]) && b.BoardProcessOption.drillType !== h[0]; });
    if (!bad.length && !norm.length && !opt.ep) return { fixed: 0, normalized: 0 };      // opt.ep: vẫn chạy lệnh khoan lại dù kiểu khoan đã đúng (hình học tấm vừa đổi)
    if (bad.length && !canFix && !norm.length) return { fixed: 0, normalized: 0, reason: `Kiểu khoan "${fallback}" không có trong cấu hình Chenfeng (${[...valid].join(', ')}) nên chưa sửa được ${bad.length} tấm của mẫu.` };
    const old = [...new Set(bad.flatMap(b => hd(b).filter(isBad)))];
    opt.onStatus(bad.length && canFix ? `Đổi kiểu khoan cũ (${old.join(', ')}) → ${fallback} cho ${bad.length} tấm của mẫu, khoan lại…` : 'Ghi lại kiểu khoan của từng tấm…');
    if (D.busy()) await D.cancel();
    try { ed().SelectCtrl.Cancel(); } catch (e) { /* bỏ qua */ }
    const w = watchEnd();
    D.cmd('DRAWHOLE');
    const t0 = Date.now();
    while (!ready(ge()) && !w.ended && Date.now() - t0 < 8000) await sleep(100);
    if (!ready(ge())) { w.off(); await D.cancel(); return { fixed: 0, normalized: 0, reason: 'Không gọi được lệnh khoan lại (DRAWHOLE) — hãy tự chọn các tấm hộp ngăn kéo, đổi kiểu khoan rồi chạy lệnh khoan.' }; }
    let fixed = 0, normalized = 0;
    for (const b of boards) {
      const o = b.BoardProcessOption, h = hd(b); if (!h.length) continue;
      const nh = canFix ? h.map(x => isBad(x) ? fallback : x) : h;
      const same = new Set(nh).size === 1 && !isBad(nh[0]);
      const changeH = nh.some((x, k) => x !== h[k]), changeT = same && o.drillType !== nh[0];
      if (!changeH && !changeT) continue;
      try { b.WriteAllObjectRecord(); } catch (e) { /* bỏ qua */ }
      if (changeH) { o.highDrill = nh; fixed++; }
      if (same && o.drillType !== nh[0]) { o.drillType = nh[0]; if (!changeH) normalized++; }
    }
    const redrill = boards.filter(b => hd(b).some(x => x && x !== Core.KHONG_KHOAN) || (opt.kem && opt.kem.includes(b)));      // opt.kem: tấm không khoan nhưng vẫn đưa vào lệnh để Chenfeng dọn lỗ cũ dính với nó
    D.select(redrill);
    await sleep(200);
    D.input('');                       // Enter: xác nhận lựa chọn → Chenfeng khoan lại
    await sleep(400);
    if (w.ok) { const t1 = Date.now(); while (!w.ended && Date.now() - t1 < ((root.document && root.document.hidden) ? 900000 : 180000)) await sleep(150); }
    w.off();
    await D.settle(w.ok && w.ended ? 700 : 1500, 90000);
    if (D.busy()) await D.cancel();
    try { ed().SelectCtrl.Cancel(); } catch (e) { /* bỏ qua */ }
    return { fixed, normalized, old, to: fallback, reason: bad.length && !canFix ? `Kiểu khoan "${fallback}" không có trong cấu hình Chenfeng nên ${bad.length} tấm của mẫu chưa khoan được.` : undefined };
  };

  /** Đối chiếu mô hình thật với thiết kế. `offset` = độ dời của cả cụm so với toạ độ thiết kế. */
  D.verify = (M, added, offset) => {
    offset = offset || [0, 0, 0];
    const boards = added.filter(D.isBoard), holes = added.filter(D.isHole), hw = added.filter(D.isHardware);
    const used = new Set(), missing = [], wrong = [];
    const match = new Map();
    for (const p of M.parts) {
      const want = [p.x0 + offset[0], p.x1 + offset[0], p.y0 + offset[1], p.y1 + offset[1], p.z0 + offset[2], p.z1 + offset[2]];
      const hit = boards.find(b => !used.has(b) && D.boxOf(b).every((v, i) => Math.abs(v - want[i]) < TOL));
      if (!hit) { missing.push(`${p.ten} (${p.tu}) x ${want[0]}…${want[1]}, z ${want[4]}…${want[5]}`); continue; }
      used.add(hit); match.set(p, hit);
      const o = hit.BoardProcessOption;
      if (hit.Name !== p.ten || o.cabinetName !== p.tu) wrong.push(`${p.ten}: tên/tên tủ trong Chenfeng là "${hit.Name}" / "${o.cabinetName}"`);
      // tấm khoét góc (khấu cột): Chenfeng phải dựng đúng đường bao có góc lõm — tấm còn nguyên chữ nhật là sẽ đâm vào cột
      if (p.khau && p.khau.length) {
        let ok = false;
        try {
          const pts = hit.GetStretchPoints().map(q => [r2(q.x - offset[0]), r2(q.y - offset[1])]);
          ok = p.khau.every(k => { const cx = Math.abs(k.x0 - p.x0) < TOL ? k.x1 : k.x0; return pts.some(q => Math.abs(q[0] - cx) < TOL && Math.abs(q[1] - k.y0) < TOL); });      // có đỉnh ở góc lõm
        } catch (e) { ok = false; }
        if (!ok) wrong.push(`${p.ten}: chưa có góc khoét khấu cột (Chenfeng dựng tấm chữ nhật)`);
      }
    }
    // vùng đã khoét của từng tấm thật (toạ độ bản vẽ) — dò va chạm phải bỏ qua
    const khoet = new Map(); for (const [p, b] of match) if (p.khau && p.khau.length) khoet.set(b, p.khau.map(k => [k.x0 + offset[0], k.x1 + offset[0], k.y0 + offset[1], k.y1 + offset[1]]));
    const trongKhoet = (b, p, q) => { const ks = khoet.get(b); if (!ks) return false; const x0 = Math.max(p[0], q[0]), x1 = Math.min(p[1], q[1]), y0 = Math.max(p[2], q[2]), y1 = Math.min(p[3], q[3]); return ks.some(k => x0 >= k[0] - 0.02 && x1 <= k[1] + 0.02 && y0 >= k[2] - 0.02 && y1 <= k[3] + 0.02); };
    // lỗ khoan theo tấm
    const holeCount = new Map();
    const idOf = x => { try { return x && (x.Object || x); } catch (e) { return null; } };
    for (const h of holes) for (const k of ['FId', 'MId']) { const b = idOf(h[k]); if (b) holeCount.set(b, (holeCount.get(b) || 0) + 1); }
    const canKhoan = new Set(['HOI', 'VACH', 'DAY', 'NOC', 'DOT', 'DEM', 'XA', 'CHAN', 'PHAO', 'PHU']);
    const noHole = [];
    const chanNoHole = [];
    for (const [p, b] of match) if ((canKhoan.has(p.loai) || p.loai === 'HAU') && p.khoan !== Core.KHONG_KHOAN && !holeCount.get(b)) (p.loai === 'CHAN' ? chanNoHole : noHole).push(`${p.ten} (${p.tu})`);
    // hậu phủ bắn đinh: không được có lỗ khoan nào dính tới tấm hậu (lỗ cam nối mép sau thùng với mặt hậu là lỗ thừa)
    const hauPhu = new Set(); for (const [p, b] of match) if (p.loai === 'HAU' && p.phu) hauPhu.add(b);
    const hauCoLo = hauPhu.size ? holes.filter(h => hauPhu.has(idOf(h.FId)) || hauPhu.has(idOf(h.MId))).length : 0;
    const extra = boards.filter(b => !used.has(b));
    // va chạm giữa mọi tấm vừa vẽ (tấm mỏng ăn rãnh ≤ 9 mm vào tấm bên cạnh là đúng cấu tạo).
    // Hai tấm của CÙNG một mẫu không tính: mẫu tự chịu cấu tạo bên trong của nó (vd vách chia ô của ngăn kéo chia ô lồng mộng vào nhau).
    const mauCua = b => { try { let o = b.Template && b.Template.Object, n = 0; while (o && o.Parent && o.Parent.Object && n++ < 40) o = o.Parent.Object; return o || null; } catch (e) { return null; } };
    const bx = boards.map(b => ({ b, x: D.boxOf(b), t: b.Thickness, m: mauCua(b) }));
    const collide = [];
    let trongMau = 0;
    for (let i = 0; i < bx.length; i++) for (let j = i + 1; j < bx.length; j++) {
      const p = bx[i].x, q = bx[j].x;
      const d = [Math.min(p[1], q[1]) - Math.max(p[0], q[0]), Math.min(p[3], q[3]) - Math.max(p[2], q[2]), Math.min(p[5], q[5]) - Math.max(p[4], q[4])];
      if (d[0] <= 0.011 || d[1] <= 0.011 || d[2] <= 0.011) continue;
      if (Math.min(bx[i].t, bx[j].t) <= 9.5 && Math.min(...d) <= 9) continue;
      if (bx[i].m && bx[i].m === bx[j].m) { trongMau++; continue; }
      if (trongKhoet(bx[i].b, p, q) || trongKhoet(bx[j].b, p, q)) continue;      // phần chồng nằm gọn trong góc đã khoét của tấm khấu cột
      collide.push(`${bx[i].b.Name} × ${bx[j].b.Name} (chồng ${d.map(r2).join(' × ')})`);
    }
    // mặt ngăn kéo có nằm đúng chỗ thiết kế không (mẫu khác có thể đặt khác)
    const frontMiss = [], matNK = new Set();
    for (const q of M.mat_ngan_keo) {
      const tq = q.t > 0 ? q.t : M.spec.van.t;      // mặt ngăn kéo âm dày theo ván thùng, mặt trùm ngoài dày theo cánh
      const want = [q.x + offset[0], q.x + q.w + offset[0], q.y + offset[1], q.y + tq + offset[1], q.z + offset[2], q.z + q.h + offset[2]];
      const hit = extra.find(b => !matNK.has(b) && D.boxOf(b).every((v, i) => Math.abs(v - want[i]) < TOL));
      if (hit) matNK.add(hit); else frontMiss.push(`mặt ngăn kéo ${q.trum ? 'trùm ngoài ' : ''}khoang ${q.khoang + 1} (z ${q.z})`);
    }
    // tấm của mẫu có kiểu khoan mà không có lỗ nào. Không tính mặt ngăn kéo: mặt bắt vào hộp bằng vít / bas của ray (hộp ray kim loại không có tấm gỗ nào để khoan cam vào).
    const extraNoHole = extra.filter(b => { const o = b.BoardProcessOption; return !matNK.has(b) && b.Thickness >= 10 && (o.highDrill || []).some(x => x && x !== Core.KHONG_KHOAN) && !holeCount.get(b); });
    const names = {}; for (const h of hw) { const nm = h.HardwareOption.name || '?'; names[nm] = (names[nm] || 0) + 1; }
    const bb = boards.length ? boards.reduce((a, b) => { const x = D.boxOf(b); return [Math.min(a[0], x[0]), Math.max(a[1], x[1]), Math.min(a[2], x[2]), Math.max(a[3], x[3]), Math.min(a[4], x[4]), Math.max(a[5], x[5])]; }, [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity]) : null;
    return {
      ok: missing.length === 0 && wrong.length === 0 && collide.length === 0,
      so_tam_thiet_ke: M.parts.length, so_tam_khop: used.size, thieu: missing, sai_ten: wrong,
      so_tam_mau: extra.length, tam_mau: extra.reduce((a, b) => { a[b.Name] = (a[b.Name] || 0) + 1; return a; }, {}),
      so_lo: holes.length, tam_khong_lo: noHole, hau_co_lo: hauCoLo, chan_khong_lo: chanNoHole.length, tam_mau_khong_lo: extraNoHole.length, va_cham: collide, va_cham_trong_mau: trongMau, mat_ngan_keo_lech: frontMiss,
      phu_kien: names, hop: bb,
    };
  };

  /** Ảnh chụp mô hình (để xem/đối chiếu): mỗi tấm một dòng. */
  D.snapshot = (filter) => D.all().filter(e => D.isBoard(e) || D.isHardware(e)).filter(e => !filter || filter(e)).map(e => {
    const x = D.boxOf(e);
    if (D.isBoard(e)) { const o = e.BoardProcessOption; return ['B', e.Name, o.cabinetName, o.roomName, o.drillType, ...x, r2(e.Thickness)].join('|'); }
    const o = e.HardwareOption; return ['H', o.name, o.cabinetName, o.roomName, '', ...x].join('|');
  });

  D.counts = () => { const a = D.all(); return { tam: a.filter(D.isBoard).length, lo: a.filter(D.isHole).length, phu_kien: a.filter(D.isHardware).length, tong: a.length }; };

  /**
   * Vẽ một tủ vào bản vẽ đang mở.
   * @param spec  mô tả tủ (xem MNCFCore.DEFAULT_SPEC)
   * Trong lúc vẽ trang giữ một Web Lock ("mncf-ve-tu"): Chrome không đóng băng tab nền đang giữ khoá, nên lần vẽ không đứng im giữa chừng khi tab bị che.
   * @param opt   { at:[x,y,z]      vị trí GỐC THÙNG (mép trái tủ, mặt trước thùng y = 0, sàn) — toạ độ các tấm = thiết kế + at;
   *                corner:[x,y,z]  hoặc vị trí GÓC TRÁI – TRƯỚC – DƯỚI của cả tủ (mặt cánh) — đúng điểm người dùng bấm khi đặt tay;
   *                bỏ trống cả hai = người dùng bấm điểm trên bản vẽ; onStatus(text) }
   */
  D.draw = async (spec, opt) => {
    D.boManChe();
    let res, ran = false;
    // bản 1.15: mặc định vẽ bằng lệnh gốc của Chenfeng (spec.ve_goc); tủ nào lệnh gốc chưa làm được (khấu cột, hậu kiểu khác) thì vẽ theo cách nhập tấm và báo rõ
    let goc = false, ghiGoc = '';
    try {
      const s0 = Core.normalize(spec);
      if (s0.ve_goc && !(opt && opt.goc === false) && D.gocDuoc()) { const K = Core.keHoachGoc(s0); if (K.M.errors.length || !K.loi.length) goc = true; else ghiGoc = `Tủ này chưa vẽ được bằng lệnh gốc Chenfeng (${K.loi.join('; ')}) → đã vẽ theo cách nhập tấm: tủ là một module đổi được Rộng / Sâu / Cao ở ô Thông số, nhưng từng tấm không phải tấm tự động của Chenfeng.`; }
    } catch (e) { goc = false; }
    const run = async () => {
      ran = true;
      if (goc) res = await D.veGoc(spec, opt);
      else {
        res = await drawImpl(spec, opt);
        // opt.xoay (bản 1.16): tủ nhập tấm vẽ thẳng trục xong thì xoay bằng lệnh ROTATE của Chenfeng quanh điểm đặt (góc tủ, hoặc gốc thiết kế khi gọi bằng `at`)
        const xoay = Number(opt && opt.xoay) || 0;
        if (xoay && res && res.giai_doan === 'xong' && D.last) {
          const tam = opt.at ? opt.at.slice() : res.goc.slice();
          let r; try { r = await D.rotate(D.last.added, tam, xoay); } catch (e) { r = { ok: false, steps: 0, reason: String(e && e.message || e) }; }
          const bbL = Core.bbox(D.last.M.parts) || { x0: 0, y0: 0, z0: 0 };
          res.xoay_do = xoay; res.khung = { goc: opt.at ? quayZ([bbL.x0, bbL.y0, bbL.z0], xoay).map((v, i) => r2(v + tam[i])) : tam, xoay };
          res.xoay_kq = r;
          if (r.ok) { res.so_buoc_hoan_tac = (res.so_buoc_hoan_tac || 1) + (r.steps || 0); D.last.khung = res.khung; res.goc = res.khung.goc; }
          else res.warnings.push(`Chưa xoay được tủ ${r2(xoay)}° (${r.reason || 'lệnh xoay không chạy'}) — tủ đang nằm thẳng trục tại điểm đặt; dùng lệnh ROTATE của Chenfeng quanh điểm ${tam.map(r2).join(', ')}.`);
        }
      }
      if (ghiGoc && res && Array.isArray(res.warnings)) res.warnings.unshift(ghiGoc);
      return res;
    };
    try {
      const nav = root.navigator;
      if (nav && nav.locks && typeof nav.locks.request === 'function') { await nav.locks.request('mncf-ve-tu', { mode: 'shared' }, run); return res; }
    } catch (e) { if (ran) throw e; }
    return run();
  };

  /**
   * Dò lỗi sản xuất NGAY SAU KHI VẼ, trên chính các đối tượng vừa sinh ra (bản 1.20) — xem D.doLoi ở cuối tệp.
   * Mục LỖI của phiếu được đưa vào danh sách lỗi của lần vẽ: tủ vẽ ra mà không sản xuất được thì lần vẽ không "ok". Mục LƯU Ý chỉ nằm trong phiếu.
   * Không bao giờ ném lỗi: phép dò hỏng thì lần vẽ vẫn trả kết quả, chỉ không có phiếu.
   */
  const TEN_LOI_SX = { vc_that: 'tấm đè lên nhau', lo_giao: 'lỗ khoan giao nhau', lo_lech: 'lỗ khoan lệch khỏi tấm hoặc khoan thủng tấm', kieu_khoan: 'kiểu khoan không có trong cấu hình', kho_van_that: 'tấm vượt khổ ván' };
  const doLoiSauVe = (added, errors, kho) => {
    let p = null;
    try { p = D.doLoi((added || []).filter(e => e && !e.IsErase), { kho }); } catch (e) { return null; }
    try {
      for (const m of p.muc) {
        if (m.ket !== 'loi' || !m.tin.length) continue;
        if (m.ma === 'vc_that' && errors.some(t => /đè lên nhau/.test(t))) continue;      // D.verify đã nêu các chỗ đè nhau
        errors.push(`Dò lỗi sản xuất — ${TEN_LOI_SX[m.ma] || m.ten}: ${m.tin[0]}${m.tin.length > 1 ? ` (và ${m.tin.length - 1} chỗ khác — xem phiếu dò lỗi ở thẻ Kết quả)` : ''}`);
      }
    } catch (e) { /* bỏ qua */ }
    return p;
  };

  const drawImpl = async (spec, opt) => {
    opt = Object.assign({ onStatus() {} }, opt || {});
    opt.onStatus = guard(opt.onStatus);
    const M = Core.build(spec);
    if (M.errors.length) return { ok: false, giai_doan: 'thiet_ke', errors: M.errors, warnings: M.warnings };
    const id = opt.id ? String(opt.id) : D.newId();
    const cf = Core.toChenfeng(M, { id });
    const n3 = a => Array.isArray(a) && a.length === 3 && a.every(v => typeof v === 'number' && isFinite(v));
    if ((opt.corner && !n3(opt.corner)) || (opt.at && !n3(opt.at))) return { ok: false, giai_doan: 'nhap', errors: ['Toạ độ đặt tủ phải là 3 số [x, y, z].'], warnings: M.warnings };
    const point = opt.corner ? opt.corner.slice() : opt.at ? [opt.at[0] + cf.base[0], opt.at[1] + cf.base[1], opt.at[2] + cf.base[2]] : null;
    const h0 = hmMark();
    let res;
    try { res = await D.importCF(cf.json, point, opt); }
    catch (e) { return { ok: false, giai_doan: 'nhap', errors: [e.message], warnings: M.warnings }; }
    if (res.cancelled) return { ok: false, giai_doan: 'nhap', errors: ['Đã huỷ — chưa vẽ gì.'], warnings: M.warnings };
    let added = res.added;
    const boards = added.filter(D.isBoard);
    // độ dời thực tế: lấy từ hộp bao của các tấm khớp thiết kế (khi người dùng tự bấm điểm)
    let offset = point ? [r2(point[0] - cf.base[0]), r2(point[1] - cf.base[1]), r2(point[2] - cf.base[2])] : null;
    if (!offset) {
      const b0 = boards.reduce((a, b) => { const x = D.boxOf(b); return [Math.min(a[0], x[0]), Math.min(a[1], x[2]), Math.min(a[2], x[4])]; }, [Infinity, Infinity, Infinity]);
      offset = [r2(b0[0] - cf.base[0]), r2(b0[1] - cf.base[1]), r2(b0[2] - cf.base[2])];
    }
    const before = new Set(root.app.Database.ModelSpace.Entitys);
    let fix = { fixed: 0, normalized: 0 };
    try { fix = await D.finalize(boards, M.spec.khoan.thung, opt); } catch (e) { fix = { fixed: 0, normalized: 0, reason: e.message }; }
    added = added.concat(root.app.Database.ModelSpace.Entitys.filter(e => e && !before.has(e))).filter(e => e && !e.IsErase);
    const v = D.verify(M, added, offset);      // đối chiếu TRƯỚC khi gom module (gom rồi thì mọi tấm chung một mẫu, phép dò va chạm bỏ qua tấm cùng mẫu)
    let mod = null;
    if (M.spec.module_cf && opt.module !== false && v.thieu.length === 0) {
      try { mod = await D.modelize(M.spec, offset, added, opt); } catch (e) { mod = { ok: false, reason: String(e && e.message || e) }; }
      if (mod && mod.ok) { const v2 = D.verify(M, added.filter(e => e && !e.IsErase), offset); if (v2.thieu.length) { mod.ok = false; mod.reason = `gom module làm lệch ${v2.thieu.length} tấm (${v2.thieu.slice(0, 2).join('; ')}).`; } }
    }
    const errors = [];
    if (v.thieu.length) errors.push(`Thiếu ${v.thieu.length} tấm so với thiết kế: ${v.thieu.slice(0, 4).join('; ')}${v.thieu.length > 4 ? '…' : ''}`);
    if (v.sai_ten.length) errors.push(...v.sai_ten.slice(0, 4));
    if (v.va_cham.length) errors.push(`${v.va_cham.length} chỗ tấm đè lên nhau: ${v.va_cham.slice(0, 4).join('; ')}${v.va_cham.length > 4 ? '…' : ''}`);
    const warnings = M.warnings.slice();
    if (v.tam_khong_lo.length) warnings.push(`${v.tam_khong_lo.length} tấm chưa có lỗ khoan: ${v.tam_khong_lo.slice(0, 5).join(', ')}${v.tam_khong_lo.length > 5 ? '…' : ''} — xem lại kiểu khoan ở tab Chuẩn xưởng (Chenfeng đang có: ${D.drillTypes().join(', ') || '?'}).`);
    if (v.hau_co_lo) warnings.push(`Có ${v.hau_co_lo} lỗ khoan dính tới tấm hậu — hậu phủ bắn đinh không cần lỗ nào: xoá các lỗ đó trước khi xuất file cắt và báo lại để sửa bảng vẽ.`);
    if (v.chan_khong_lo) warnings.push(`${v.chan_khong_lo} đoạn xà chân trước không có lỗ cam (chỉ tì vào chân vách 8–9 mm mỗi đầu) — bắt vít / ke tại chỗ.`);
    if (v.tam_mau_khong_lo) warnings.push(`${v.tam_mau_khong_lo} tấm của mẫu (hộp ngăn kéo…) chưa có lỗ khoan.`);
    if (v.mat_ngan_keo_lech.length) warnings.push(`Mẫu ngăn kéo đặt mặt khác thiết kế: ${v.mat_ngan_keo_lech.join(', ')} — xem lại mã mẫu / thông số ngăn kéo.`);
    if (fix.reason) warnings.push(fix.reason);
    if (mod && !mod.ok) warnings.push(`Chưa gom được tủ thành module tham số của Chenfeng: ${mod.reason} Tủ vẫn vẽ đủ; sửa kích thước thì dùng nút "Cập nhật tủ này" của bảng.`);
    if (mod && mod.ok) for (const g of mod.ghi_chu) warnings.push(g);
    const want = M.templates.filter(tp => tp.id).length;
    const gotHW = Object.values(v.phu_kien).reduce((a, b) => a + b, 0);
    if (want && !gotHW) warnings.push('Không thấy phụ kiện nào của mẫu ngăn kéo / suốt treo — kiểm tra mã mẫu ở tab Chuẩn xưởng.');
    const dl = doLoiSauVe(added, errors, { dai: M.spec.van.kho_dai, rong: M.spec.van.kho_rong });
    opt.onStatus('Xong.');
    const h1 = hmMark();
    let steps = 1 + ((fix.fixed || fix.normalized) ? 1 : 0);
    if (h0 && h1 && h1.i > h0.i && h1.i - h0.i <= 6) steps = h1.i - h0.i;
    D.last = { M, added, offset, steps, mark: h1, id };
    return { ok: errors.length === 0, giai_doan: 'xong', id, errors, warnings, notes: M.notes, offset, goc: offset.map((x, i) => r2(x + cf.base[i])), kiem_tra: v, do_loi: dl, sua_khoan: fix, so_buoc_hoan_tac: steps, module: mod, kich: Core.heSo(M.spec).kich, tom_tat: Core.summary(M) };
  };

  /* ------------------------------------------------------------------ *
   * SỬA TỦ ĐÃ VẼ (bản 1.6): mỗi tấm tiện ích vẽ mang ghi chú [KHOA_TU, mã lần vẽ] → chọn 1 tấm là tìm lại cả tủ,
   * bỏ đúng các đối tượng của tủ đó bằng lệnh ERASE của Chenfeng rồi vẽ lại tại chỗ theo thông số mới.
   * ------------------------------------------------------------------ */
  D.TAG = Core.KHOA_TU;
  D.newId = () => { let t = ''; const A = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; for (let i = 0; i < 8; i++) t += A[Math.floor(Math.random() * A.length)]; return t; };
  /** Mã tủ ghi trên tấm ('' nếu tấm không do tiện ích vẽ / vẽ từ bản trước 1.6). */
  D.tagOf = e => { try { const r = e && e.BoardProcessOption && e.BoardProcessOption.remarks; if (!Array.isArray(r)) return ''; const x = r.find(a => a && a[0] === D.TAG); return x ? String(x[1] || '') : ''; } catch (err) { return ''; } };
  /** Các đối tượng người dùng đang chọn trên bản vẽ. */
  D.selected = () => {
    try {
      const ss = ed().SelectCtrl.SelectSet; if (!ss) return [];
      let l = ss.SelectEntityList;
      if (typeof l === 'function') l = l.call(ss);
      return (Array.isArray(l) ? l : []).filter(e => e && !e.IsErase);
    } catch (err) { return []; }
  };
  const idOf = x => { try { return x && (x.Object || x); } catch (e) { return null; } };
  const rootTpl = b => { try { let o = b.Template && b.Template.Object, n = 0; while (o && o.Parent && o.Parent.Object && n++ < 40) o = o.Parent.Object; return o || null; } catch (e) { return null; } };
  const near = (a, b, tol) => a.every((v, i) => Math.abs(v - b[i]) < tol);
  const TOL_TIM = 0.6;      // dung sai khi dò lại tủ đã vẽ (rộng hơn lúc nghiệm thu: người dùng có thể đã lưu / mở lại bản vẽ)

  /**
   * Tìm lại một tủ đã vẽ. M = mô hình dựng từ thông số LÚC VẼ. pick = tấm người dùng đang chọn (để phân biệt khi tủ đã bị sao chép).
   * @returns {{ok, offset, boards, thieu, tong}} offset = độ dời của tủ đó so với toạ độ thiết kế (tủ bị di chuyển vẫn tìm được; bị xoay thì không)
   */
  D.locate = (id, M, pick) => {
    const dsTam = D.all().filter(e => D.isBoard(e) && D.tagOf(e) === id);
    if (!dsTam.length) return { ok: false, reason: 'Không còn tấm nào của tủ này trên bản vẽ.' };
    // bản 1.16: tủ là module và đã bị XOAY (đặt theo tường / theo hình trên mặt bằng) → dò trong hệ toạ độ của chính module (gốc module = góc nhỏ nhất của tủ)
    let kh = null;
    try { const k = D.khungCua(pick && dsTam.includes(pick) ? pick : dsTam[0]); if (k && k.xoay) kh = k; } catch (e) { kh = null; }
    const tagged = dsTam.map(b => ({ b, x: D.hopTheo(b, kh) }));
    const parts = M.parts.map(p => [p.x0, p.x1, p.y0, p.y1, p.z0, p.z1]);
    const dim = x => [x[1] - x[0], x[3] - x[2], x[5] - x[4]];
    const cand = [], seen = new Set();
    const them = off => { const k = off.map(v => Math.round(v * 2)).join('|'); if (!seen.has(k)) { seen.add(k); cand.push(off); } };
    if (kh) { const bbM = Core.bbox(M.parts); them([r2(-bbM.x0), r2(-bbM.y0), r2(-bbM.z0)]); }
    else if (D.last && D.last.id === id && D.last.offset && !(D.last.khung && D.last.khung.xoay)) them(D.last.offset.slice());
    const moc = pick && tagged.find(t => t.b === pick) ? [tagged.find(t => t.b === pick)] : tagged.slice(0, 6);
    if (!kh) for (const t of moc) { const d = dim(t.x); for (const p of parts) if (near(dim(p), d, TOL_TIM)) them([r2(t.x[0] - p[0]), r2(t.x[2] - p[2]), r2(t.x[4] - p[4])]); }
    let best = null;
    for (const off of cand) {
      const used = new Set(), hit = [];
      for (const p of parts) {
        const want = [p[0] + off[0], p[1] + off[0], p[2] + off[1], p[3] + off[1], p[4] + off[2], p[5] + off[2]];
        const t = tagged.find(q => !used.has(q) && near(q.x, want, TOL_TIM));
        if (t) { used.add(t); hit.push(t.b); }
      }
      const coPick = !pick || hit.includes(pick);
      if (!best || (coPick && !best.coPick) || (coPick === best.coPick && hit.length > best.boards.length)) best = { offset: off, boards: hit, coPick };
    }
    if (!best || best.boards.length < Math.max(3, Math.ceil(parts.length * 0.5)))
      return { ok: false, reason: `Chỉ khớp được ${best ? best.boards.length : 0}/${parts.length} tấm với thông số lúc vẽ — tủ đã bị xoay hoặc sửa tay nhiều, không cập nhật tại chỗ được. Hãy xoá tủ cũ rồi vẽ lại.`, khop: best ? best.boards.length : 0, tong: parts.length };
    return { ok: true, offset: best.offset.map(r2), boards: best.boards, thieu: parts.length - best.boards.length, tong: parts.length, khung: kh };
  };

  /** Mọi đối tượng thuộc một tủ đã vẽ: tấm mang mã + hộp ngăn kéo / suốt treo sinh từ mẫu nằm trong các ô của tủ + lỗ khoan dính tới chúng. Đồ người dùng tự gắn thêm (bản lề, tay nắm…) KHÔNG nằm trong danh sách. */
  D.cabinetEntities = (id, M, loc) => {
    const off = loc.offset, set = new Set(loc.boards), hopE = e => D.hopTheo(e, loc.khung || null);      // tủ đã xoay: mọi phép so nằm trong hệ của tủ
    const bb = Core.bbox(M.parts);
    const hop = [bb.x0 + off[0], bb.x1 + off[0], bb.y0 + off[1], bb.y1 + off[1], bb.z0 + off[2], bb.z1 + off[2]];
    const trong = (x, R, du) => x[0] >= R[0] - du && x[1] <= R[1] + du && x[2] >= R[2] - du && x[3] <= R[3] + du && x[4] >= R[4] - du && x[5] <= R[5] + du;
    const all = D.all();
    for (const e of all) if (!set.has(e) && D.isBoard(e) && D.tagOf(e) === id && trong(hopE(e), hop, 1)) set.add(e);      // tấm của tủ bị kéo lệch tay nhưng vẫn nằm trong tủ
    const vung = M.templates.filter(t => t.id).map(t => [t.pos[0] + off[0], t.pos[0] + t.box[0] + off[0], t.pos[1] + off[1], t.pos[1] + t.box[1] + off[1], t.pos[2] + off[2], t.pos[2] + t.box[2] + off[2]]);
    const ten = new Set(M.templates.filter(t => t.id).map(t => t.ten));
    if (vung.length) {
      // mẫu ngăn kéo / suốt treo của tủ: mẫu (ở tầng nào trong cây cũng được — khi tủ đã thành module thì chúng là mẫu con) trùng tên mẫu của tủ
      const mauTen = e => { try { let o = e.Template && e.Template.Object, n = 0; while (o && n++ < 40) { let nm = ''; try { nm = String(o.Name || ''); } catch (er) { /* bỏ qua */ } if (ten.has(nm)) return o; o = o.Parent && o.Parent.Object; } } catch (er) { /* bỏ qua */ } return null; };
      const theoMau = new Map();
      for (const e of all) {
        if (!(D.isBoard(e) || D.isHardware(e)) || (D.isBoard(e) && D.tagOf(e))) continue;
        const r = mauTen(e); if (!r) continue;
        if (!theoMau.has(r)) theoMau.set(r, []); theoMau.get(r).push(e);
      }
      for (const [, list] of theoMau) {
        if (!list.every(e => trong(hopE(e), hop, 60))) continue;                      // mẫu vươn ra ngoài tủ → không phải của tủ này
        if (list.some(e => vung.some(R => trong(hopE(e), R, 2)))) for (const e of list) set.add(e);
      }
    }
    for (const h of all) if (D.isHole(h) && (set.has(idOf(h.FId)) || set.has(idOf(h.MId)))) set.add(h);
    return [...set];
  };

  /* ------------------------------------------------------------------ *
   * MODULE THAM SỐ GỐC CỦA CHENFENG (bản 1.7)
   * Lệnh MODELING ("建模") của Chenfeng gom các tấm của tủ thành một TemplateRecord có tham số L / W / H. Hành động co giãn mặc định
   * của Chenfeng thô (nửa bên kia dời nguyên, cánh không giãn) → thay bằng hành động tính từ chính quy tắc kết cấu của bảng (Core.heSo):
   * sửa Rộng / Sâu / Cao ngay ở ô "Thông số" của Chenfeng thì tủ co giãn đúng như khi bảng này dựng. Hộp ngăn kéo, suốt treo thành mẫu con bám theo.
   * ------------------------------------------------------------------ */
  const so = v => { const r = Math.round(v * 1e6) / 1e6; return String(r); };
  const bieuThuc = (bien, k) => (k === 1 ? bien : `${bien}*${so(k)}`);
  /** Kích thước module (tham số L, W, H đang có trong Chenfeng) của tủ chứa tấm b — null nếu tủ chưa là module. */
  D.moduleDims = b => {
    try {
      const T = rootTpl(b); if (!T || !T.LParam || !T.WParam || !T.HParam) return null;
      if (T.Name === '左右侧板模板' || /LeftRightBoard/.test((T.constructor && T.constructor.name) || '')) return null;      // tủ vẽ bằng lệnh gốc: mẫu gốc là MỘT thùng, không phải cả tủ
      const v = [T.LParam.value, T.WParam.value, T.HParam.value].map(Number);
      return v.every(x => isFinite(x) && x > 0) ? v.map(r2) : null;
    } catch (e) { return null; }
  };
  /** Tủ là module và đã bị đổi Rộng / Sâu / Cao ngay trong Chenfeng → trả về thông số đã chỉnh theo kích thước hiện tại của module (null nếu không đổi / không phải module). */
  D.specTheoModule = (spec, b) => {
    try {
      const kt = D.moduleDims(b); if (!kt) return null;
      const h0 = Core.heSo(spec), k0 = h0.kich;
      if (!k0.some((v, i) => Math.abs(v - kt[i]) > 0.6)) return null;
      const s = JSON.parse(JSON.stringify(spec)), r1 = v => Math.round(v * 10) / 10;
      s.thung = Object.assign({}, s.thung, { tach: (h0.M.info && h0.M.info.tach) || [] });      // module co giãn thì cách tách thùng giữ như lúc vẽ
      s.rong = r1(spec.rong + kt[0] - k0[0]); s.sau_thung = r1(spec.sau_thung + kt[1] - k0[1]); s.cao = r1(spec.cao + kt[2] - k0[2]);
      const n = Core.normalize(s);
      return Core.build(n).errors.length ? null : n;
    } catch (e) { return null; }
  };
  /** Chạy lệnh MODELING ("建模") của Chenfeng trên các tấm `boards`. phimF: bấm F = chia module theo cụm tấm chạm nhau (mặc định Chenfeng chia theo tên phòng / tên tủ). Trả về số bước lịch sử. */
  const coMauHet = boards => boards.every(b => { try { return !!(b.Template && b.Template.Object); } catch (e) { return false; } });
  const chayModeling = async (boards, phimF) => {
    const h0 = hmMark(), w = watchEnd();
    try {
      D.select(boards);
      await sleep(200);
      D.cmd('MODELING');
      let t0 = Date.now();
      while (!ready(ge()) && !coMauHet(boards) && !w.ended && Date.now() - t0 < 6000) await sleep(100);
      if (!coMauHet(boards)) {
        if (phimF && ready(ge())) { D.input('F'); await sleep(400); }
        D.input(''); t0 = Date.now(); while (!coMauHet(boards) && !w.ended && Date.now() - t0 < 15000) await sleep(100);
      }
      t0 = Date.now(); while (w.ok && !w.ended && Date.now() - t0 < 6000) await sleep(100);
    } catch (e) { /* xét ở dưới */ }
    w.off();
    if (D.busy()) await D.cancel();
    await D.settle(400, 20000);
    try { ed().SelectCtrl.Cancel(); } catch (e) { /* bỏ qua */ }
    const h1 = hmMark();
    return h0 && h1 && h1.i > h0.i ? h1.i - h0.i : 0;
  };

  /**
   * Gắn quy tắc co giãn của bảng (Core.heSo) vào module T:
   *  - mỗi tấm trong `cua` (Map tấm thiết kế → tấm thật, phải là tấm của T): hành động dời / kéo theo L, W, H;
   *  - hộp ngăn kéo / suốt treo (mẫu kho đã chèn, nằm trong `added`): thành mẫu con của T, vị trí và kích thước là biểu thức theo _L / _W / _H.
   * Gốc của T phải là góc nhỏ nhất của cả tủ (hs.goc). kq: nơi ghi { bien[], mau_con, ghi_chu[] }.
   */
  const ganHeSo = (T, hs, M, cua, offset, added, kq) => {
    const mauHD = [T.LParam, T.WParam, T.HParam].map(pr => pr && pr.actions && pr.actions[0]).find(Boolean);
    if (!mauHD) { kq.ghi_chu.push('Module dùng cách co giãn mặc định của Chenfeng (không đọc được kiểu hành động).'); return false; }
    const HD = mauHD.constructor, V3 = mauHD.StretchDirection.constructor;
    const TRUC = { L: [1, 0, 0], W: [0, 1, 0], H: [0, 0, 1] };
    for (const ten of ['L', 'W', 'H']) {
      const b = hs.bien[ten], pr = T.GetParam(ten);
      if (!b || !pr) { kq.ghi_chu.push(`Tham số ${ten}: giữ cách co giãn mặc định của Chenfeng (đổi kích thước này làm đổi số tấm).`); continue; }
      const nhom = new Map(), N = k => { if (!nhom.has(k)) nhom.set(k, { move: [], map: [] }); return nhom.get(k); };
      M.parts.forEach((p, i) => {
        const tam = cua.get(p); if (!tam) return;
        const [a, bb] = b.tam[i];
        if (a !== 0) N(a).move.push(tam.Id);
        if (Math.abs(bb - a) > 1e-9) {
          const pts = tam.GetStretchPoints(), toa = pts.map(q => [q.x, q.y, q.z][b.truc]), mx = Math.max.apply(null, toa), idx = [];
          toa.forEach((v, j) => { if (Math.abs(v - mx) < 0.01) idx.push(j); });
          if (idx.length) N(Math.round((bb - a) * 1e6) / 1e6).map.push({ entity: tam.Id, indexs: idx });
        }
        // tấm khoét góc (khấu cột): các đỉnh nằm trên mép vùng khoét co giãn theo hệ số riêng của mép đó (vd đổi Sâu: mép khoét đi theo lưng tủ, bề sâu phần khoét giữ nguyên)
        const hk = b.khau && b.khau[i];
        if (hk && p.khau) {
          const pts = tam.GetStretchPoints(), toa = pts.map(q => [q.x, q.y, q.z][b.truc]), mn = Math.min.apply(null, toa), mx = Math.max.apply(null, toa), ck = b.truc === 0 ? ['x0', 'x1'] : ['y0', 'y1'];
          p.khau.forEach((k, q) => ck.forEach((c, e) => {
            const v = k[c] + offset[b.truc], he = hk[q][e];
            if (Math.abs(v - mn) < 0.01 || Math.abs(v - mx) < 0.01 || Math.abs(he - a) < 1e-9) return;      // mép trùng mép tấm đã có hệ số của mép tấm; hệ số bằng hệ số dời cả tấm thì khỏi kéo
            const idx = []; toa.forEach((u, j) => { if (Math.abs(u - v) < 0.01) idx.push(j); });
            if (idx.length) N(Math.round((he - a) * 1e6) / 1e6).map.push({ entity: tam.Id, indexs: idx });
          }));
        }
      });
      pr.actions.length = 0;
      for (const [k, g] of nhom) {
        const hd = new HD(new V3(TRUC[ten][0], TRUC[ten][1], TRUC[ten][2]));
        hd.Name = `MN ${ten}×${so(k)}`; hd.Expr = bieuThuc(ten, k); hd.MoveEntitys = g.move; hd.EntityStretchPointMap = g.map;
        pr.actions.push(hd); if (!hd.parent) hd.parent = pr;
      }
      kq.bien.push(ten + (b.sai_so > 0.05 ? ` (lệch tới ${b.sai_so} mm do làm tròn)` : ''));
    }
    // Tham số "BH" Chenfeng tự thêm lấy theo biến chung $BH (18) và hành động của nó CỘNG chênh lệch vào độ dày MỌI tấm (kể cả hậu 6 li)
    // → sai với ván 17,5 của xưởng. Là tham số mặc định nên không xoá được (DeleteParam bỏ qua): gỡ hành động, ghi đúng độ dày, chỉ để xem.
    // (Tủ lệnh gốc: các tấm tự động lấy độ dày theo $BH của module GỐC → BH ở đây phải đúng bằng dày ván thùng.)
    try {
      const bh = T.GetParam('BH');
      if (bh) { bh.actions.length = 0; bh.expr = so(M.spec.van.t); try { bh.description = 'Dày ván (chỉ xem — đổi ở bảng Một Nhà)'; } catch (e) { /* bỏ qua */ } }
      const moTa = { L: 'Rộng phủ bì', W: 'Sâu phủ bì (cả cánh)', H: 'Cao phủ bì' };
      for (const k of Object.keys(moTa)) { try { const pr = T.GetParam(k); if (pr) pr.description = moTa[k]; } catch (e) { /* bỏ qua */ } }
    } catch (e) { /* bỏ qua */ }
    // hộp ngăn kéo / suốt treo → mẫu con, kích thước và vị trí bám theo L / W / H của tủ
    const dsMau = M.templates.map((t, i) => ({ t, i })).filter(x => x.t.id);
    if (dsMau.length) {
      const theo = new Map();
      for (const e of added) { if (!e || e.IsErase || !(D.isBoard(e) || D.isHardware(e)) || (D.isBoard(e) && D.tagOf(e))) continue; const r = rootTpl(e); if (r && r !== T) { if (!theo.has(r)) theo.set(r, []); theo.get(r).push(e); } }
      const trong = (x, R, du) => x[0] >= R[0] - du && x[1] <= R[1] + du && x[2] >= R[2] - du && x[3] <= R[3] + du && x[4] >= R[4] - du && x[5] <= R[5] + du;
      const daDung = new Set();
      for (const { t, i } of dsMau) {
        const R = [t.pos[0] + offset[0], t.pos[0] + t.box[0] + offset[0], t.pos[1] + offset[1], t.pos[1] + t.box[1] + offset[1], t.pos[2] + offset[2], t.pos[2] + t.box[2] + offset[2]];
        let con = null;
        for (const [r, list] of theo) if (!daDung.has(r) && list.some(e => trong(D.boxOf(e), R, 2))) { con = r; break; }
        if (!con) continue;
        daDung.add(con);
        const dat = (pr, goc, heSoTheo) => {      // goc = giá trị hiện tại; heSoTheo = {L, W, H} hệ số theo từng tham số của tủ
          if (!pr) return;
          let bt = '', k0 = goc;
          ['L', 'W', 'H'].forEach((ten, n) => { const k = heSoTheo[ten]; if (k) { bt += `${k < 0 ? '-' : '+'}_${ten}*${so(Math.abs(k))}`; k0 -= k * hs.kich[n]; } });
          if (!bt) return;
          k0 = Math.round(k0 * 1e4) / 1e4;
          pr.expr = (k0 ? so(k0) : '') + (k0 ? bt : bt.replace(/^\+/, ''));
        };
        const hk = key => ({ L: hs.bien.L ? hs.bien.L.mau[i][key] : 0, W: hs.bien.W ? hs.bien.W.mau[i][key] : 0, H: hs.bien.H ? hs.bien.H.mau[i][key] : 0 });
        const chi = (v, ten) => { const o = { L: 0, W: 0, H: 0 }; o[ten] = v[ten]; return o; };
        try {
          con.Parent = T.Id; if (!T.Children.includes(con.Id)) T.Children.push(con.Id);
          try { con.Positioning = undefined; if (con.Positioning) con._Positioning = undefined; } catch (e) { /* bỏ qua */ }
          const pos = hk('pos'), box = hk('box');
          // vị trí của mẫu con tính trong không gian của tủ (gốc = góc nhỏ nhất của tủ)
          dat(con.PXParam, t.pos[0] - hs.goc[0], chi(pos, 'L')); dat(con.PYParam, t.pos[1] - hs.goc[1], chi(pos, 'W')); dat(con.PZParam, t.pos[2] - hs.goc[2], chi(pos, 'H'));
          if (!con.PXParam.expr) con.PXParam.expr = so(r2(t.pos[0] - hs.goc[0]));
          if (!con.PYParam.expr) con.PYParam.expr = so(r2(t.pos[1] - hs.goc[1]));
          if (!con.PZParam.expr) con.PZParam.expr = so(r2(t.pos[2] - hs.goc[2]));
          dat(con.LParam, t.box[0], chi(box, 'L')); dat(con.WParam, t.box[1], chi(box, 'W')); dat(con.HParam, t.box[2], chi(box, 'H'));
          const bac = hs.bien.W && hs.bien.W.mau[i].bac;      // sâu hộp ngăn kéo nhảy bậc theo cỡ ray
          if (bac && bac.k && con.WParam) { const k0 = Math.round((bac.tu0 - bac.k * hs.kich[1]) * 1e4) / 1e4; con.WParam.expr = `floor((${so(k0)}+_W*${so(bac.k)})/${so(bac.buoc)}+0.000001)*${so(bac.buoc)}`; }
          for (const k of Object.keys(t.params || {})) {
            const hsK = { L: hs.bien.L && hs.bien.L.mau[i].params[k] || 0, W: hs.bien.W && hs.bien.W.mau[i].params[k] || 0, H: hs.bien.H && hs.bien.H.mau[i].params[k] || 0 };
            if (hsK.L || hsK.W || hsK.H) dat(con.GetParam(k), t.params[k], hsK);
          }
          kq.mau_con++;
        } catch (e) { kq.ghi_chu.push(`Mẫu "${t.ten}" chưa gắn được vào module: ${e && e.message || e}`); }
      }
    }
    return true;
  };

  D.modelize = async (spec, offset, added, opt) => {
    opt = Object.assign({ onStatus() {} }, opt || {});
    opt.onStatus = guard(opt.onStatus);
    const hs = Core.heSo(spec), M = hs.M;
    const boards = added.filter(e => D.isBoard(e) && !e.IsErase && D.tagOf(e));
    if (boards.length < 2) return { ok: false, reason: 'Không đủ tấm để gom thành module.' };
    opt.onStatus('Gom tủ thành module tham số của Chenfeng…');
    if (D.busy()) await D.cancel();
    try { ed().SelectCtrl.Cancel(); } catch (e) { /* bỏ qua */ }
    const motGoc = () => { const T0 = rootTpl(boards[0]); return T0 && boards.every(b => rootTpl(b) === T0) ? T0 : null; };
    // Lệnh MODELING mặc định chia module theo TÊN TỦ (thân dưới / thân trên thành 2 module). Phím F đổi sang "chia theo cụm tấm chạm nhau" → cả tủ là MỘT module.
    let steps = await chayModeling(boards, true);
    if (!motGoc() && coMauHet(boards) && steps) { await D.undo(steps); steps = await chayModeling(boards, false); }      // bản Chenfeng khác có thể đổi mặc định → thử lại không bấm F
    const T = motGoc();
    if (!T) { if (steps && coMauHet(boards)) { await D.undo(steps); steps = 0; } return { ok: false, steps, reason: 'Chenfeng không gom được các tấm của tủ thành một module (lệnh MODELING).' }; }
    const kq = { ok: true, steps, ten: '', bien: [], mau_con: 0, ghi_chu: [] };
    try {
      try { T.Name = M.spec.ma || M.spec.ten || T.Name; kq.ten = String(T.Name || ''); } catch (e) { /* bỏ qua */ }
      // khớp từng tấm thiết kế với tấm thật
      const used = new Set(), cua = new Map();
      for (const p of M.parts) {
        const want = [p.x0 + offset[0], p.x1 + offset[0], p.y0 + offset[1], p.y1 + offset[1], p.z0 + offset[2], p.z1 + offset[2]];
        const hit = boards.find(b => !used.has(b) && near(D.boxOf(b), want, TOL_TIM));
        if (hit) { used.add(hit); cua.set(p, hit); }
      }
      if (!ganHeSo(T, hs, M, cua, offset, added, kq)) return kq;
      try { await T.UpdateTemplateTree(); } catch (e) { kq.ghi_chu.push('Chenfeng báo lỗi khi cập nhật module: ' + (e && e.message || e)); }
      await D.settle(400, 20000);
    } catch (e) { kq.ok = false; kq.reason = 'Lỗi khi dựng module: ' + (e && e.message || e); }
    return kq;
  };

  /**
   * Bản 1.16 — TỦ VẼ BẰNG LỆNH GỐC THÀNH MỘT MODULE (anh Jason 03/10/2026: phào, chân, ngăn kéo phải chạy theo khi đổi kích thước).
   * Các tấm rời (phào, phụ trợ, xà chân, khung hộc kéo) → lệnh MODELING gom thành module mẹ T mang L / W / H của CẢ TỦ, gốc = góc nhỏ nhất của tủ;
   * tấm rời co giãn bằng hành động của bảng (ganHeSo); hộp ngăn kéo / suốt treo và từng THÙNG lệnh gốc (左右侧板模板) làm mẫu con của T với biểu thức
   * theo _L / _W / _H (Core.keHoachGoc → b.gan); vách / đợt lệnh gốc lấy khoảng cách bằng biểu thức theo khoảng trống của nó (b.cach_bt).
   * Đã đo trên Chenfeng 2026-09-20: mẫu gốc 左右侧板模板 làm mẫu con được (Parent + PX / PY / PZ + biểu thức L / W / H); tấm tự động lấy độ dày theo $BH của module GỐC;
   * UpdateTemplateTree giữ nguyên đối tượng tấm (không tạo lại) nên tên, mã tủ trên tấm không mất. Mọi thay đổi nằm trong 1 bước lịch sử MNCF_GAN (+ 1 bước MODELING).
   * @param K kế hoạch (Core.keHoachGoc) · offset: độ dời thiết kế → bản vẽ lúc này (chưa xoay) · tamCua: Map tấm thiết kế → tấm thật (cả tấm lệnh gốc lẫn tấm rời) · added: mọi đối tượng của tủ
   */
  const ganModuleGoc = async (K, offset, tamCua, added, id, opt) => {
    const M = K.M, hs = K.hs, kq = { ok: false, steps: 0, ten: '', bien: [], mau_con: 0, thung: 0, ghi_chu: [] };
    const tamRoi = K.con_lai.map(p => tamCua.get(p)).filter(e => e && !e.IsErase);
    if (!tamRoi.length) { kq.reason = 'Tủ không có phào, xà chân hay khung hộc kéo để làm thân module — mỗi thùng vẫn là một mẫu gốc riêng, đổi kích thước từng thùng ở ô Thông số.'; kq.khong_can = true; return kq; }
    if (!hs || !K.gan) { kq.reason = 'Không tính được quy tắc co giãn của tủ.'; return kq; }
    opt.onStatus('Gom cả tủ thành một module (đổi L / W / H là cả tủ chạy theo)…');
    if (D.busy()) await D.cancel();
    try { ed().SelectCtrl.Cancel(); } catch (e) { /* bỏ qua */ }
    const h0 = hmMark();
    const buocDaChay = () => { const h1 = hmMark(); return h0 && h1 && h1.i > h0.i ? h1.i - h0.i : 0; };
    await chayModeling(tamRoi, true);
    const mauCua = b => { try { return (b.Template && b.Template.Object) || null; } catch (e) { return null; } };
    const ds = [...new Set(tamRoi.map(mauCua).filter(Boolean))];
    if (!ds.length || !coMauHet(tamRoi)) { const n = buocDaChay(); if (n) await D.undo(n); kq.reason = 'Chenfeng không gom được các tấm phào / chân thành module (lệnh MODELING).'; return kq; }
    const T = ds.slice().sort((a, b) => b.Objects.length - a.Objects.length)[0];
    let mo = false, loi = '';
    try { const h = hm(); if (h && typeof h.StartCmd === 'function' && typeof h.EndCmd === 'function') { h.StartCmd('MNCF_GAN'); mo = true; } } catch (e) { mo = false; }
    try {
      // các cụm tấm rời không chạm nhau (khung phào / khung hộc kéo từng khoang) thành nhiều module → nhập hết vào T
      for (const t2 of ds) {
        if (t2 === T) continue;
        for (const oid of [...t2.Objects]) T.Objects.push(oid);
        try { t2.Objects.length = 0; root.app.Database.TemplateTable.Remove(t2); } catch (e) { /* bỏ qua */ }
      }
      // gốc module = góc nhỏ nhất của CẢ TỦ (không phải của riêng cụm phào)
      const C4 = ed().UCSMatrix.constructor, goc = [hs.goc[0] + offset[0], hs.goc[1] + offset[1], hs.goc[2] + offset[2]];
      for (const oid of T.Objects) { try { const e = oid.Object; if (e && !e.IsErase) e.SpaceOCS = new C4().setPosition(goc[0], goc[1], goc[2]); } catch (e) { /* bỏ qua */ } }
      try { T.Name = M.spec.ma || M.spec.ten || T.Name; kq.ten = String(T.Name || ''); } catch (e) { /* bỏ qua */ }
      // L / W / H của module = phủ bì cả tủ (MODELING lấy theo hộp bao của riêng các tấm rời) — ghi thẳng giá trị, không qua biểu thức, để không kích hoạt hành động
      [T.LParam, T.WParam, T.HParam].forEach((pr, n) => { pr.expr = ''; pr.value = hs.kich[n]; });
      const cua = new Map(); for (const p of K.con_lai) { const e = tamCua.get(p); if (e && !e.IsErase) cua.set(p, e); }
      if (!ganHeSo(T, hs, M, cua, offset, added, kq)) throw new Error('không đọc được kiểu hành động co giãn của module');
      // tham số nào đổi là đổi số tấm: không để hành động mặc định của Chenfeng kéo riêng phào trong khi thùng đứng yên
      for (const ten of ['L', 'W', 'H']) if (!hs.bien[ten]) { try { T.GetParam(ten).actions.length = 0; } catch (e) { /* bỏ qua */ } }
      // từng thùng lệnh gốc → mẫu con của T
      const datBT = (pr, bt) => { if (!pr) return; if (isNaN(Number(bt))) pr.expr = bt; else { pr.expr = ''; pr.value = Number(bt); } };
      for (const b of K.buoc) {
        if (b.lenh !== 'LR' || !b.gan) continue;
        const hoi = tamCua.get(M.parts[b.tam[0]]), lr = hoi && mauCua(hoi);
        if (!lr || !lr.LParam || lr === T) throw new Error(`không thấy mẫu gốc của thùng ${b.thung + 1}`);
        if (!T.Children.includes(lr.Id)) T.Children.push(lr.Id);
        if (!lr.Parent || lr.Parent !== T.Id) lr.Parent = T.Id;
        try { if (lr._Positioning) lr.Positioning = undefined; } catch (e) { /* bỏ qua */ }
        datBT(lr.PXParam, b.gan.px); datBT(lr.PYParam, b.gan.py); datBT(lr.PZParam, b.gan.pz);
        datBT(lr.LParam, b.gan.l); datBT(lr.WParam, b.gan.w); datBT(lr.HParam, b.gan.h);
        // nhắc ngay trong bảng Thông số: kích thước của thùng đi theo module mẹ, đừng gõ đè biểu thức ở đây
        try { const nhac = `theo module “${kq.ten}” — sửa L / W / H ở dòng “${kq.ten}” trên cùng`; lr.LParam.description = 'Rộng thùng: ' + nhac; lr.WParam.description = 'Sâu thùng: ' + nhac; lr.HParam.description = 'Cao thùng: ' + nhac; } catch (e) { /* bỏ qua */ }
        kq.thung++;
      }
      // vách, đợt lệnh gốc: khoảng cách là biểu thức theo khoảng trống → khoang chia lại đúng tỉ lệ khi thùng rộng / cao ra
      for (const b of K.buoc) {
        if ((b.lenh !== 'VE' && b.lenh !== 'LY') || b.cach_bt === undefined || !isNaN(Number(b.cach_bt))) continue;
        const tam = tamCua.get(M.parts[b.tam[0]]), tp = tam && mauCua(tam);
        if (!tp || !tp._option || !('calcSpaceSize' in tp._option)) { kq.ghi_chu.push(`${b.lenh === 'VE' ? 'Vách' : 'Đợt'} "${b.ten}" giữ khoảng cách cố định (không đọc được lựa chọn của mẫu).`); continue; }
        try { tp.WriteAllObjectRecord(); } catch (e) { /* bỏ qua */ }
        tp._option.calcSpaceSize = b.cach_bt;
      }
      await T.UpdateTemplateTree();
    } catch (e) { loi = String(e && e.message || e); }
    if (mo) { try { hm().EndCmd(); } catch (e) { /* bỏ qua */ } }
    await D.settle(400, 20000);
    kq.steps = buocDaChay();
    if (loi) { if (kq.steps) await D.undo(kq.steps); kq.steps = 0; kq.reason = 'Lỗi khi gom module: ' + loi; return kq; }
    kq.ok = true;
    return kq;
  };

  /** Xoá các đối tượng bằng lệnh ERASE của Chenfeng (1 bước hoàn tác; Chenfeng tự dọn lỗ khoan dính theo). */
  D.erase = async (ents) => {
    D.boManChe();
    const live = (ents || []).filter(e => e && !e.IsErase && e.DrawObject);
    if (!live.length) return { ok: true, n: 0, steps: 0 };
    if (D.busy()) await D.cancel();
    try { ed().SelectCtrl.Cancel(); } catch (e) { /* bỏ qua */ }
    const h0 = hmMark(), w = watchEnd();
    const con = () => live.filter(e => !e.IsErase).length;
    try {
      D.select(live);
      await sleep(200);
      D.cmd('ERASE');
      let t0 = Date.now();
      while (con() && !w.ended && Date.now() - t0 < 4000) await sleep(100);
      if (con() && !w.ended) { D.input(''); t0 = Date.now(); while (con() && !w.ended && Date.now() - t0 < 6000) await sleep(100); }      // lệnh còn chờ xác nhận lựa chọn → Enter
      t0 = Date.now(); while (!w.ended && w.ok && Date.now() - t0 < 4000) await sleep(100);
    } catch (e) { /* xử lý ở dưới theo số còn lại */ }
    w.off();
    if (D.busy()) await D.cancel();
    await D.settle(400, 20000);
    try { ed().SelectCtrl.Cancel(); } catch (e) { /* bỏ qua */ }
    const h1 = hmMark(), left = con();
    return { ok: left === 0, n: live.length - left, con: left, steps: h0 && h1 && h1.i > h0.i ? h1.i - h0.i : (left === live.length ? 0 : 1) };
  };

  /**
   * Cập nhật một tủ đã vẽ: bỏ tủ cũ rồi vẽ lại tại chỗ theo `spec` mới.
   * @param ref { id, specCu, pick } — mã tủ, thông số LÚC VẼ, tấm đang chọn (không bắt buộc)
   */
  D.update = async (spec, ref, opt) => {
    D.boManChe();
    opt = Object.assign({ onStatus() {} }, opt || {});
    opt.onStatus = guard(opt.onStatus);
    if (!D.available()) return { ok: false, giai_doan: 'nhap', errors: ['Không thấy Chenfeng trong trang này.'], warnings: [] };
    const Mm = Core.build(spec);
    if (Mm.errors.length) return { ok: false, giai_doan: 'thiet_ke', errors: Mm.errors, warnings: Mm.warnings };
    let Mc = Core.build(ref.specCu);
    try {      // tủ đã bị đổi kích thước ngay trong Chenfeng (module) → dò theo kích thước hiện tại
      const moc = ref.pick && !ref.pick.IsErase ? ref.pick : D.all().find(e => D.isBoard(e) && D.tagOf(e) === ref.id);
      const adj = moc && D.specTheoModule(ref.specCu, moc);
      if (adj) Mc = Core.build(adj);
    } catch (e) { /* dùng thông số đã lưu */ }
    const loc = D.locate(ref.id, Mc, ref.pick);
    if (!loc.ok) return { ok: false, giai_doan: 'tim', errors: [loc.reason], warnings: [] };
    const ents = D.cabinetEntities(ref.id, Mc, loc);
    let mauCu = null;      // bản 1.21: tủ cũ đã đổ màu → tủ vẽ lại mang lại đúng màu đó (tấm mới sinh ra là vật liệu mặc định)
    try { mauCu = D.mauCuaTu(ents.filter(D.isBoard)); } catch (e) { mauCu = null; }
    opt.onStatus(`Đang bỏ tủ cũ (${ents.filter(e => D.isBoard(e) || D.isHardware(e)).length} tấm và phụ kiện)…`);
    const er = await D.erase(ents);
    if (!er.ok) {
      if (er.n && er.steps) await D.undo(er.steps);
      return { ok: false, giai_doan: 'xoa', errors: [`Chưa bỏ được tủ cũ (còn ${er.con} đối tượng) — bản vẽ được giữ nguyên. Thử lại, hoặc tự xoá tủ cũ rồi bấm Vẽ.`], warnings: [] };
    }
    // vẽ lại đúng chỗ + đúng hướng cũ: gốc toạ độ thiết kế của tủ cũ trên bản vẽ (tủ xoay thì tính qua khung của module)
    const viTri = loc.khung ? { at: apM(loc.khung.G, loc.offset).map(r2), xoay: loc.khung.xoay } : { at: loc.offset };
    const rep = await D.draw(spec, Object.assign({}, opt, viTri, { corner: undefined, id: ref.id }));
    if (rep.giai_doan !== 'xong') {      // vẽ lại không được → trả tủ cũ về chỗ cũ
      if (er.steps) await D.undo(er.steps);
      rep.errors = (rep.errors || []).concat(['Tủ cũ đã được trả lại nguyên trạng.']);
      return rep;
    }
    if (D.last) D.last.steps = (D.last.steps || 1) + (er.steps || 0);
    rep.so_buoc_hoan_tac = (rep.so_buoc_hoan_tac || 1) + (er.steps || 0);
    rep.cap_nhat = { bo: er.n, thieu: loc.thieu };
    if (mauCu && mauCu.co) { opt.onStatus('Đang đổ lại màu của tủ cũ…'); rep.giu_mau = await giuMau(mauCu); if (rep.giu_mau.ok) rep.so_buoc_hoan_tac += rep.giu_mau.steps || 0; }
    return rep;
  };

  /** Hoàn tác đúng lần vẽ gần nhất — từ chối nếu sau đó bản vẽ đã có thao tác khác (để không hoàn tác nhầm việc của người dùng). */
  D.undoLast = async () => {
    const L = D.last;
    if (!L) return { ok: false, reason: 'Chưa có lần vẽ nào để hoàn tác.' };
    if (D.busy()) await D.cancel();
    // một lệnh đang chạy dở (vd lệnh xem toàn bộ vừa gọi) tạm chiếm 1 ô lịch sử → chờ nó xong rồi mới so
    const moved = () => { const now = hmMark(); return !!(L.mark && now && (now.i !== L.mark.i || now.rec !== L.mark.rec)); };
    for (let i = 0; i < 6 && moved(); i++) await sleep(300);
    if (moved()) return { ok: false, reason: 'Sau lần vẽ đó bản vẽ đã có thao tác khác — hãy dùng Ctrl+Z của Chenfeng để lùi từng bước.' };
    await D.undo(L.steps || 1);
    const left = (L.added || []).filter(e => e && !e.IsErase).length;
    D.last = null;
    return left ? { ok: false, reason: `Đã hoàn tác nhưng còn ${left} đối tượng của lần vẽ — kiểm tra lại bằng Ctrl+Z.` } : { ok: true };
  };

  /* ------------------------------------------------------------------ *
   * PHÒNG HIỆN TRẠNG (bản 1.9): vẽ tường, cửa, cột, dầm bằng LỆNH GỐC của thẻ "House Design" của Chenfeng
   * (DRAWWALLINSIDE, DRAWDOORHOLE / DRAWIHOLE, DRAWPILLAR, DRAWGIRDER) — ra đúng đối tượng phòng của Chenfeng, sửa tiếp bằng lệnh của Chenfeng được.
   * Đã đo trên Chenfeng bản 2026-09-20: đi theo chiều kim đồng hồ thì DRAWWALLINSIDE đặt bề dày tường ra NGOÀI lòng phòng.
   * ------------------------------------------------------------------ */
  const cho = async (dk, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 6000)) { try { if (dk()) return true; } catch (e) { /* thử lại */ } await sleep(80); } return false; };
  const toaDo = p => p.map(v => String(Math.round(v * 1000) / 1000)).join(',');
  const tenLop = e => { try { return e.constructor.name; } catch (err) { return ''; } };
  const hopThoai = () => [...document.querySelectorAll('.bp3-dialog')].find(x => { try { return x.getBoundingClientRect().width > 0 && x.querySelectorAll('input').length >= 1; } catch (e) { return false; } }) || null;
  /** Hộp thoại thông số của Chenfeng (cột, dầm): điền các ô theo thứ tự rồi bấm nút đầu tiên ở chân hộp (OK). */
  const dienHopThoai = async vals => {
    if (!(await cho(() => !!hopThoai(), 5000))) return false;
    const d = hopThoai(), ins = [...d.querySelectorAll('input')].filter(i => i.type === 'text' || i.type === 'number');
    const dat = Object.getOwnPropertyDescriptor(root.HTMLInputElement.prototype, 'value').set;
    vals.forEach((v, i) => {
      const el = ins[i]; if (!el) return;
      el.focus(); dat.call(el, String(v));
      el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); el.dispatchEvent(new FocusEvent('blur', { bubbles: false }));
    });
    await sleep(250);
    const nut = [...d.querySelectorAll('.bp3-dialog-footer button, button')].filter(b => !b.classList.contains('bp3-dialog-close-button'));
    const ok = nut.find(b => /^(OK|确定|确认|Đồng ý|Xác nhận)$/i.test((b.textContent || '').trim())) || nut[0];
    if (!ok) return false;
    ok.click();
    await cho(() => !hopThoai(), 4000);
    return ins.length >= vals.length;
  };
  const dongHopThoai = async () => { const d = hopThoai(); if (!d) return; const c = [...d.querySelectorAll('button')].find(b => /^(Cancel|取消|Huỷ|Hủy)$/i.test((b.textContent || '').trim())) || d.querySelector('.bp3-dialog-close-button'); if (c) { c.click(); await sleep(300); } };
  // gọi một lệnh rồi chờ nó hỏi điểm; lệnh vẽ tường hỏi "chuyển sang nhìn từ trên?" trước → trả lời 1 (có)
  const moLenh = async (ten, coHop) => {
    if (D.busy()) await D.cancel();
    D.cmd(ten);
    if (coHop) { if (!(await dienHopThoai(coHop))) { await dongHopThoai(); if (D.busy()) await D.cancel(); return false; } }
    await cho(() => D.busy(), 5000);
    if (ready(kw()) && !ready(gp())) { D.input('1'); await cho(() => ready(gp()), 8000); }
    if (!ready(gp())) { if (D.busy()) await D.cancel(); return false; }
    await sleep(450);
    return true;
  };
  const datSo = async (phim, so) => { D.input(phim); await sleep(350); D.input(String(Math.round(so * 100) / 100)); await sleep(350); };
  const xongLenh = async ms => { await cho(() => !D.busy(), ms || 6000); if (D.busy()) await D.cancel(); await sleep(150); };

  /** Bỏ dấu tiếng Việt (đ → d) — dùng cho chữ ghi vào nhãn của Chenfeng, phông ở đó thiếu chữ có dấu. */
  D.khongDau = t => String(t == null ? '' : t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/\s+/g, ' ').trim();

  /**
   * Thả một bản vẽ DXF (chuỗi) vào Chenfeng (bản 1.18): Chenfeng tự dựng Line / Circle / Polyline / Text đúng toạ độ trong file — lệnh "CAD图纸导入", 1 bước hoàn tác.
   * Chenfeng hỏi "文件是否插入前视图？" (có xoay file sang mặt trước không) → trả lời N để giữ nguyên toạ độ. Tài khoản bật sẵn "luôn chèn mặt trước" thì Chenfeng không hỏi
   * mà xoay luôn → gọi kèm `hop` (hộp bao mong đợi của các nét) để phát hiện và hoàn tác.
   * @returns { ok, ents, reason }
   */
  D.importDXF = async (text, opt) => {
    opt = opt || {};
    if (!D.available() || !D.editing()) return { ok: false, ents: [], reason: 'Chenfeng chưa ở màn hình vẽ.' };
    if (D.busy()) await D.cancel();
    const truoc = new Set(root.app.Database.ModelSpace.Entitys), h0 = hmMark();
    const moi = () => root.app.Database.ModelSpace.Entitys.filter(e => e && !truoc.has(e) && !e.IsErase);
    let nhan = false;
    try {
      const f = new File([String(text)], opt.ten || 'dien-nuoc.dxf', { type: 'application/dxf' }), dt = new DataTransfer(); dt.items.add(f);
      const ev = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt });
      document.dispatchEvent(ev); nhan = ev.defaultPrevented;
    } catch (e) { return { ok: false, ents: [], reason: String(e && e.message || e) }; }
    if (!nhan) return { ok: false, ents: [], reason: 'Chenfeng không nhận file (trang này chưa mở bản vẽ?).' };
    await cho(() => ready(kw()) || moi().length > 0, 6000);
    if (ready(kw())) { D.input('N'); await sleep(200); }
    await cho(() => !D.busy(), 10000);
    if (D.busy()) await D.cancel();
    await sleep(250);
    const ents = moi();
    if (!ents.length) return { ok: false, ents, reason: 'Chenfeng không dựng được nét nào từ file.' };
    // đối chiếu vị trí: hộp bao các nét (không kể chữ) phải đúng hộp mong đợi
    if (opt.hop) {
      const b = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity];
      for (const e of ents) { if (tenLop(e) === 'Text') continue; try { const x = D.boxOf(e); for (let i = 0; i < 6; i += 2) { b[i] = Math.min(b[i], x[i]); b[i + 1] = Math.max(b[i + 1], x[i + 1]); } } catch (er) { /* bỏ qua */ } }
      const m = [opt.hop.x0, opt.hop.x1, opt.hop.y0, opt.hop.y1, opt.hop.z0, opt.hop.z1];
      if (b.some((v, i) => !isFinite(v) || Math.abs(v - m[i]) > 2)) {
        const h1 = hmMark(); if (h0 && h1 && h1.i > h0.i) await D.undo(h1.i - h0.i);
        return { ok: false, ents: [], lech: true, reason: 'Chenfeng đặt các nét lệch chỗ (tài khoản đang bật tuỳ chọn tự chèn file DXF vào mặt trước?) — đã bỏ các nét vừa dựng.' };
      }
    }
    return { ok: true, ents };
  };

  /**
   * Vẽ phòng hiện trạng vào bản vẽ. H = MNCFPhong.hinhHoc(phòng). opt: { day_tuong (mặc định 110), onStatus, dien_nuoc: MNCFPhong.dienNuocDXF(H) (dấu điện – nước, bản 1.18) }
   * @returns { ok, errors, warnings, dem:{tuong, mo, cot, dam, dn}, so_buoc_hoan_tac }
   */
  D.drawRoom = async (H, opt) => {
    D.boManChe();
    opt = Object.assign({ day_tuong: 110, onStatus() {} }, opt || {});
    opt.onStatus = guard(opt.onStatus);
    const errors = [], warnings = [], dem = { tuong: 0, mo: 0, cot: 0, dam: 0, dn: 0 };
    if (!D.available()) return { ok: false, errors: ['Không thấy bản vẽ Chenfeng trong trang này.'], warnings, dem };
    if (!H || !H.tuong || !H.tuong.length || (H.loi && H.loi.length)) return { ok: false, errors: (H && H.loi && H.loi.length ? H.loi : ['Phòng chưa có tường.']), warnings, dem };
    if (!D.editing()) return { ok: false, errors: ['Chenfeng đang ở trang chủ / màn chào — mở một bản vẽ rồi vẽ phòng.'], warnings, dem };
    const o = (H.p && H.p.goc) || [0, 0, 0], cao = H.p.cao, W = H.tuong.filter(w => w.dai > 0);
    const P = (q, z) => [q[0] + o[0], q[1] + o[1], (z || 0) + o[2]];
    const tren = (w, s, t) => [w.p0[0] + w.d[0] * s + w.n[0] * t, w.p0[1] + w.d[1] * s + w.n[1] * t];
    const dsLop = lop => D.all().filter(e => tenLop(e) === lop);
    const h0 = hmMark(), truoc = new Set(root.app.Database.ModelSpace.Entitys);
    try { ed().SelectCtrl.Cancel(); } catch (e) { /* bỏ qua */ }
    try {
      // 1. tường — đi theo chiều kim đồng hồ quanh lòng phòng
      opt.onStatus('Đang vẽ tường…');
      const n0 = dsLop('RoomWallLine').length;
      if (!(await moLenh('DRAWWALLINSIDE'))) return { ok: false, errors: ['Chenfeng không nhận lệnh vẽ tường (DRAWWALLINSIDE).'], warnings, dem };
      await datSo('G', cao); await datSo('H', opt.day_tuong);
      for (const w of W) { D.input(toaDo(P(w.p0))); await sleep(420); }
      if (H.khep.kin && W.length >= 3) D.input('C');
      else { D.input(toaDo(P(W[W.length - 1].p1))); await sleep(420); D.input(''); }
      await xongLenh(8000);
      await D.settle(400, 15000);
      dem.tuong = dsLop('RoomWallLine').length - n0;
      if (dem.tuong < W.length) errors.push(`Chenfeng chỉ vẽ được ${dem.tuong}/${W.length} tường.`);
      // 2. cửa đi, cửa sổ, ô trống = lỗ trên tường (điểm đặt = TÂM lỗ trên mép trong của tường)
      for (const m of H.mo || []) {
        if (!(m.rong > 0 && m.cao > 0)) continue;
        opt.onStatus(`Đang mở ${m.ten.toLowerCase()} trên tường ${m.w.ten}…`);
        const k0 = dsLop('RoomHolePolyline').length;
        if (!(await moLenh(m.loai === 'cua' ? 'DRAWDOORHOLE' : 'DRAWIHOLE'))) { warnings.push(`Chưa mở được ${m.ten.toLowerCase()} (tường ${m.w.ten}).`); continue; }
        await datSo('H', m.cao); await datSo('L', m.rong); await datSo('D', m.be);
        D.input(toaDo(P(tren(m.w, m.cach + m.rong / 2, 0))));
        await xongLenh(5000);
        if (dsLop('RoomHolePolyline').length > k0) dem.mo++; else warnings.push(`Chưa mở được ${m.ten.toLowerCase()} (tường ${m.w.ten}).`);
      }
      // 3. cột, hộp kỹ thuật (điểm đặt = TÂM cột; Chenfeng tự cho cột cao bằng tường)
      for (const c of (H.can || []).filter(x => x.loai !== 'dam')) {
        if (!(c.rong > 0 && c.nho > 0)) continue;
        opt.onStatus(`Đang vẽ ${c.ten.toLowerCase()}…`);
        const k0 = dsLop('RoomPillar').length, a = ((c.w.a % 180) + 180) % 180, doc = Math.abs(a - 90) < 1;
        if (!doc && a > 1 && a < 179) warnings.push(`${c.ten} nằm trên tường xiên: Chenfeng vẽ cột theo trục bản vẽ — xoay lại bằng lệnh của Chenfeng.`);
        if (!(await moLenh('DRAWPILLAR', doc ? [c.nho, c.rong] : [c.rong, c.nho]))) { warnings.push(`Chưa vẽ được ${c.ten.toLowerCase()} (tường ${c.w.ten}).`); continue; }
        D.input(toaDo(P(tren(c.w, c.cach + c.rong / 2, c.nho / 2))));
        await xongLenh(5000);
        if (dsLop('RoomPillar').length > k0) { dem.cot++; if (c.z0 > 0.5 || c.z1 < cao - 0.5) warnings.push(`${c.ten}: Chenfeng vẽ cột cao hết tường (0 → ${cao}); phần +${c.z0} → +${c.z1} phải tự sửa chiều cao.`); }
        else warnings.push(`Chưa vẽ được ${c.ten.toLowerCase()} (tường ${c.w.ten}).`);
      }
      // 4. dầm (2 điểm dọc mép trong của tường, ở cao độ đáy dầm)
      for (const c of (H.can || []).filter(x => x.loai === 'dam')) {
        if (!(c.rong > 0 && c.nho > 0 && c.z1 > c.z0)) continue;
        opt.onStatus(`Đang vẽ ${c.ten.toLowerCase()}…`);
        const ds0 = new Set(dsLop('RoomGirder'));
        if (!(await moLenh('DRAWGIRDER', [c.nho, c.z1 - c.z0]))) { warnings.push(`Chưa vẽ được ${c.ten.toLowerCase()} (tường ${c.w.ten}).`); continue; }
        D.input(toaDo(P(tren(c.w, c.cach, 0), c.z0))); await sleep(450);
        D.input(toaDo(P(tren(c.w, c.cach + c.rong, 0), c.z0)));
        await xongLenh(5000);
        const moi = dsLop('RoomGirder').find(e => !ds0.has(e));
        if (!moi) { warnings.push(`Chưa vẽ được ${c.ten.toLowerCase()} (tường ${c.w.ten}).`); continue; }
        dem.dam++;
        const b = D.boxOf(moi);
        if (Math.abs(b[4] - (c.z0 + o[2])) > 1 || Math.abs(b[5] - (c.z1 + o[2])) > 1) warnings.push(`${c.ten}: Chenfeng đặt dầm ở cao độ +${r2(b[4] - o[2])} → +${r2(b[5] - o[2])} (muốn +${c.z0} → +${c.z1}) — kéo lại cao độ dầm trong Chenfeng.`);
      }
      // 5. điện – nước (bản 1.18): dấu trên mặt tường / trên sàn, dựng từ một file DXF nhỏ thả vào bản vẽ
      const dn = opt.dien_nuoc;
      if (dn && dn.so > 0 && dn.dxf && dem.tuong > 0) {
        opt.onStatus(`Đang đánh dấu ${dn.so} điểm điện – nước…`);
        await D.settle(300, 8000);
        const r = await D.importDXF(dn.dxf, { hop: dn.hop, ten: 'dien-nuoc.dxf' });
        if (r.ok) dem.dn = dn.so; else warnings.push(`Chưa đánh dấu được ${dn.so} điểm điện – nước lên bản vẽ: ${r.reason} Phòng vẫn vẽ đủ; vị trí các điểm xem ở mặt bằng / mặt đứng trong bảng.`);
      }
    } catch (e) { errors.push('Lỗi khi vẽ phòng: ' + String(e && e.message || e)); await dongHopThoai(); if (D.busy()) await D.cancel(); }
    await D.settle(400, 15000);
    // 6. tên phòng (bản 1.12): Chenfeng tự sinh vùng phòng (RoomRegion) không tên → nhãn "未命名 10.8m²". Ghi tên phòng của bảng vào.
    //    Phông chữ nhãn của Chenfeng thiếu nhiều chữ có dấu tiếng Việt (ủ, ử, ư, đ… hiện thành "?") → ghi KHÔNG DẤU.
    let tenPhong = '';
    try {
      const vung = root.app.Database.ModelSpace.Entitys.filter(e => e && !truoc.has(e) && !e.IsErase && tenLop(e) === 'RoomRegion');
      const ten = D.khongDau(opt.ten != null ? opt.ten : (H.p && H.p.ten) || '').slice(0, 40);
      if (vung.length && ten) {
        let mo = false;
        try { const h = hm(); if (h && typeof h.StartCmd === 'function' && typeof h.EndCmd === 'function') { h.StartCmd('MNCF_TENPHONG'); mo = true; } } catch (e) { mo = false; }
        vung.forEach((v, k) => { try { if (typeof v.WriteAllObjectRecord === 'function') v.WriteAllObjectRecord(); v.TextString = vung.length > 1 ? `${ten} ${k + 1}` : ten; if (String(v.TextString) === (vung.length > 1 ? `${ten} ${k + 1}` : ten)) tenPhong = ten; } catch (e) { /* bỏ qua */ } });
        if (mo) { try { hm().EndCmd(); } catch (e) { /* bỏ qua */ } }
        await sleep(200);
        if (!tenPhong) warnings.push('Chưa ghi được tên phòng vào nhãn của Chenfeng (nhãn còn “未命名”) — bấm đúp vào nhãn trong Chenfeng để đặt tên.');
      }
    } catch (e) { /* tên phòng không ghi được thì thôi, phòng vẫn đủ */ }
    const h1 = hmMark(), added = root.app.Database.ModelSpace.Entitys.filter(e => e && !truoc.has(e) && !e.IsErase);
    const steps = h0 && h1 && h1.i > h0.i ? h1.i - h0.i : (added.length ? 1 : 0);
    D.lastRoom = { added, steps, mark: h1 };
    opt.onStatus('Xong.');
    return { ok: errors.length === 0 && dem.tuong > 0, errors, warnings, dem, ten_phong: tenPhong, so_buoc_hoan_tac: steps, so_doi_tuong: added.length };
  };
  /** Hoàn tác lần vẽ phòng gần nhất (từ chối nếu sau đó bản vẽ đã có thao tác khác). */
  D.undoRoom = async () => {
    const L = D.lastRoom;
    if (!L || !L.steps) return { ok: false, reason: 'Chưa có lần vẽ phòng nào để hoàn tác.' };
    if (D.busy()) await D.cancel();
    const now = hmMark();
    if (L.mark && now && (now.i !== L.mark.i || now.rec !== L.mark.rec)) return { ok: false, reason: 'Sau lần vẽ phòng bản vẽ đã có thao tác khác — dùng Ctrl+Z của Chenfeng để lùi từng bước.' };
    await D.undo(L.steps);
    const left = L.added.filter(e => e && !e.IsErase).length;
    D.lastRoom = null;
    return left ? { ok: false, reason: `Đã hoàn tác nhưng còn ${left} đối tượng của phòng — kiểm tra lại bằng Ctrl+Z.` } : { ok: true };
  };

  /**
   * Xoay một nhóm đối tượng quanh trục đứng đi qua `goc` một góc `do_` độ (dương = ngược chiều kim đồng hồ) bằng lệnh ROTATE của Chenfeng (1 bước hoàn tác).
   * Lệnh hỏi góc bằng một điểm: hướng từ điểm gốc tới điểm đó chính là góc xoay.
   */
  D.rotate = async (ents, goc, do_) => {
    D.boManChe();
    const live = (ents || []).filter(e => e && !e.IsErase && e.DrawObject);
    if (!live.length || !do_) return { ok: true, steps: 0 };
    if (D.busy()) await D.cancel();
    try { ed().SelectCtrl.Cancel(); } catch (e) { /* bỏ qua */ }
    const h0 = hmMark();
    D.cmd('ROTATE');
    if (!(await cho(() => ready(ge()), 5000))) { if (D.busy()) await D.cancel(); return { ok: false, steps: 0, reason: 'Chenfeng không nhận lệnh xoay (ROTATE).' }; }
    D.select(live); await sleep(250); D.input('');
    if (!(await cho(() => ready(gp()), 6000))) { if (D.busy()) await D.cancel(); return { ok: false, steps: 0, reason: 'Lệnh xoay không hỏi điểm gốc.' }; }
    await sleep(450); D.input(toaDo(goc)); await sleep(550);
    const r = do_ * Math.PI / 180;
    D.input(toaDo([goc[0] + 1000 * Math.cos(r), goc[1] + 1000 * Math.sin(r), goc[2]]));
    await xongLenh(15000);
    await D.settle(400, 20000);
    try { ed().SelectCtrl.Cancel(); } catch (e) { /* bỏ qua */ }
    const h1 = hmMark(), steps = h0 && h1 && h1.i > h0.i ? h1.i - h0.i : 0;
    if (D.last && steps) { D.last.steps = (D.last.steps || 1) + steps; D.last.mark = h1; }
    return { ok: steps > 0, steps, reason: steps ? '' : 'Chenfeng không ghi nhận lệnh xoay.' };
  };

  /* ------------------------------------------------------------------ *
   * CHUẨN HOÁ MẪU KHO (bản 1.11) — anh Jason 03/10/2026: "Lấy hết đi r mình chỉnh từng module được".
   * Module chèn từ kho Chenfeng (kết cấu kiểu Trung: hậu dày 18 lọt lòng, hoặc hậu mỏng âm rãnh + thanh giằng)
   * → chuẩn Một Nhà: HẬU 6 LI PHỦ SAU LƯNG THÙNG, lùi mép 1, bắn đinh (không khoan). Làm trên đối tượng thật của bản vẽ:
   *   - hồi / nóc / đáy / vách chạy ra tận lưng, và đợt đang chạm mặt trước hậu: mép sau về (sâu − 6) bằng MoveStretchPoints;
   *   - hậu là "背板(自动)" (TemplateBehindBoard của Chenfeng): đổi lựa chọn của chính mẫu đó — dày 6, ăn ra 4 phía (bề dày ván − 1), cách lưng −6
   *     (số âm = nằm SAU khoảng kẹp) → Chenfeng tự giữ hậu phủ kín khi đổi Rộng / Sâu / Cao, không còn rãnh;
   *   - hậu là tấm thường (hậu dày): đổi dày, dời ra lưng, kéo 4 mép; tính lại phần của hậu trong các động tác tham số (TemplateStretchGripAction)
   *     theo mặt chuẩn: mặt ngoài hồi, mép sau hồi, mặt dưới đáy, mặt trên nóc → hậu không còn dày lên / co lại theo bề dày ván;
   *   - thanh giằng sau hậu mỏng (拉条, tên cũng là 背板): xoá; kiểu khoan của hậu = 不排; khoan lại các tấm còn lại theo kiểu khoan của xưởng.
   * Giới hạn: module phải đang đặt thẳng (chưa xoay), mặt trước quay về −y; tấm xiên, hồi / nóc "tự động" phải cắt mép sau thì báo lý do, không sửa.
   * ------------------------------------------------------------------ */
  const hauTuDong = t => { try { return !!(t && t._option && 'leftExt' in t._option && 'spaceSize' in t._option); } catch (e) { return false; } };
  const tplThuong = t => { try { return !!t && !t._option; } catch (e) { return false; } };
  // tên tấm của mẫu kho là tiếng Trung → tiếng Việt: khi báo cáo (D.tenTamViet) và khi ghi lại tên tấm của mẫu kho vừa vẽ (D.tenTamMoi — bản 1.19).
  // Tên DÀI / RIÊNG đứng trước tên chung chứa trong nó (抽底板 trước 底板, 左开门板 trước 门板…). Tên đo trên các bộ tủ của kho ngày 04/10/2026.
  const TEN_TAM = [
    ['左抽侧', 'Thành trái ngăn kéo'], ['右抽侧', 'Thành phải ngăn kéo'], ['抽侧板', 'Thành ngăn kéo'], ['抽侧', 'Thành ngăn kéo'], ['抽尾板', 'Hậu ngăn kéo'], ['抽尾', 'Hậu ngăn kéo'], ['抽背板', 'Hậu ngăn kéo'],
    ['抽前板', 'Trước ngăn kéo'], ['抽前', 'Trước ngăn kéo'], ['抽面板', 'Mặt ngăn kéo'], ['抽面', 'Mặt ngăn kéo'], ['抽底板', 'Đáy ngăn kéo'], ['抽底', 'Đáy ngăn kéo'],
    ['左开门板', 'Cánh mở trái'], ['右开门板', 'Cánh mở phải'], ['上翻门板', 'Cánh lật lên'], ['下翻门板', 'Cánh lật xuống'], ['假门', 'Cánh giả'],
    ['薄背板', 'Hậu mỏng'], ['厚背板', 'Hậu dày'], ['加强条', 'Thanh tăng cứng'], ['上收口', 'Nẹp bù trên'], ['左收口', 'Nẹp bù trái'], ['右收口', 'Nẹp bù phải'],
    ['左侧板', 'Hồi trái'], ['右侧板', 'Hồi phải'], ['中侧板', 'Vách'], ['侧板', 'Hồi'], ['顶板', 'Nóc'], ['底板', 'Đáy'], ['背板', 'Hậu'], ['固定层板', 'Đợt cố định'], ['活动层板', 'Đợt rời'], ['层板', 'Đợt'], ['中立板', 'Vách'], ['立板', 'Vách'],
    ['后地脚', 'Xà chân sau'], ['前地脚', 'Xà chân trước'], ['地脚线', 'Xà chân'], ['踢脚板', 'Xà chân'], ['前拉条', 'Xà trước'], ['后拉条', 'Xà sau'], ['拉条', 'Thanh giằng'], ['背条', 'Thanh giằng sau'], ['收口条', 'Nẹp'], ['收口板', 'Nẹp bù'], ['收口', 'Nẹp bù'],
    ['垫条', 'Thanh chèn'], ['垫板', 'Tấm đệm'], ['见光板', 'Tấm ốp'], ['门板', 'Cánh'], ['封板', 'Tấm bịt'], ['竖隔板', 'Vách ngăn'], ['横隔板', 'Đợt ngăn'], ['隔板', 'Vách ngăn'], ['挡板', 'Tấm chắn'],
    ['台面', 'Mặt bàn'], ['桌面', 'Mặt bàn'], ['格栅', 'Lam'], ['装饰板', 'Tấm trang trí'], ['护墙板', 'Tấm ốp tường'], ['墙板', 'Tấm ốp tường'], ['搁板', 'Kệ'], ['楣板', 'Diềm trên'], ['顶线', 'Phào đỉnh'], ['罗马柱', 'Cột La Mã']];
  // nhận tấm hậu / cánh / tấm ngăn kéo theo TÊN — cả tên gốc tiếng Trung lẫn tên tiếng Việt mà D.tenTamMoi đã ghi (để chuẩn hoá / đổi dày ván chạy được trên module đã đổi tên)
  const laTenHau = t => (/背/.test(t) || /^Hậu/.test(t)) && !/抽|ngăn kéo/i.test(t);
  const laTenCanhNK = t => /门|抽|^Cánh|ngăn kéo/i.test(t);
  D.tenTamViet = t => { t = String(t || ''); for (const [a, b] of TEN_TAM) if (t.includes(a)) return t === a ? b : `${b} (${t})`; return t; };

  D.chuanHoa = async (ent, opt) => {
    D.boManChe();
    opt = Object.assign({ hau: 6, mep: 1, khoan: '', khoan_lai: true, onStatus() {} }, opt || {});
    opt.onStatus = guard(opt.onStatus);
    const hong = ly_do => ({ ok: false, ly_do });
    if (!D.available()) return hong('Không thấy Chenfeng trong trang này.');
    const T = rootTpl(ent);
    if (!T) return hong('Tấm đang chọn không thuộc module nào — chỉ chuẩn hoá được module chèn từ kho mẫu.');
    if (D.busy()) await D.cancel();
    const cay = []; (function di(t, n) { if (!t || cay.includes(t) || n > 8) return; cay.push(t); for (const c of (t.Children || [])) di(idOf(c), n + 1); })(T, 0);
    const tam = D.all().filter(b => D.isBoard(b) && b.Template && cay.includes(idOf(b.Template)));
    if (!tam.length) return hong('Module không có tấm ván nào.');
    if (tam.some(b => D.tagOf(b))) return hong('Đây là tủ do bảng Một Nhà vẽ — đã đúng chuẩn hậu phủ sau.');
    const E = 0.6, hau = opt.hau, mep = opt.mep;
    const hop = b => { const x = D.boxOf(b); return [[x[0], x[1]], [x[2], x[3]], [x[4], x[5]]]; };
    const truc = b => { try { const e = b.OCS.elements, n = [Math.abs(e[8]), Math.abs(e[9]), Math.abs(e[10])]; const k = n.indexOf(Math.max(...n)); return n[k] > 0.999 ? k : -1; } catch (e) { return -1; } };
    const chong = (a, c) => Math.min(a[1], c[1]) - Math.max(a[0], c[0]);
    const ten = b => String(b.Name || '');
    const info = new Map(tam.map(b => [b, { b, bx: hop(b), tr: truc(b), ten: ten(b), day: r2(b.Thickness) }]));
    const moi = b => { const o = info.get(b); o.bx = hop(b); o.day = r2(b.Thickness); return o; };
    const L = [...info.values()];
    const caoM = Math.max(...L.map(o => o.bx[2][1])) - Math.min(...L.map(o => o.bx[2][0]));
    const laHau = o => laTenHau(o.ten);
    const kc = L.filter(o => (o.tr === 0 || o.tr === 2) && !laHau(o) && !laTenCanhNK(o.ten));
    const ngan = o => { const e = [o.bx[0][1] - o.bx[0][0], o.bx[1][1] - o.bx[1][0], o.bx[2][1] - o.bx[2][0]]; e.splice(o.tr < 0 ? 0 : o.tr, 1); return Math.min(...e); };
    const hauTat = L.filter(o => laHau(o));
    if (hauTat.some(o => o.tr === 0 && ngan(o) > 150)) return hong('Module có hậu đứng theo chiều sâu (tủ góc / hậu hông) — chưa hỗ trợ.');
    const hauY = hauTat.filter(o => o.tr === 1);
    if (!hauY.length) return hong(hauTat.length ? 'Tấm hậu không nằm theo chiều rộng tủ — module đang xoay? Đặt module thẳng (chưa xoay) rồi chuẩn hoá.' : 'Module không có tấm hậu (背板).');
    const mong = hauY.filter(o => o.day < 12 && ngan(o) > 150), dayH = hauY.filter(o => o.day >= 12);
    // thanh giằng SAU hậu mỏng (拉条 / tấm chèn, cũng mang tên 背板): bắt đầu từ mặt trước hậu mỏng trở ra lưng, chồng vùng với hậu mỏng → bỏ khi hậu đã phủ sau.
    // Thanh "背板" dày nằm TRƯỚC hậu mỏng (xà sau trên của tủ bếp dưới — đỡ mặt đá) là kết cấu: giữ nguyên, không coi là hậu.
    const giang = dayH.filter(o => mong.some(m => chong(o.bx[0], m.bx[0]) > 1 && chong(o.bx[2], m.bx[2]) > 1 && o.bx[1][0] >= m.bx[1][0] - 1));
    const laPhu = m => !kc.some(o => chong(o.bx[0], m.bx[0]) > -1 && chong(o.bx[2], m.bx[2]) > -1 && o.bx[1][1] > m.bx[1][1] + E);
    const chinh = dayH.filter(o => !giang.includes(o) && ngan(o) > 150).concat(mong.filter(m => !laPhu(m)));
    if (!chinh.length) return mong.length ? { ok: true, da_chuan: true, ghi_chu: ['Module này hậu mỏng đã phủ sau lưng — không cần sửa.'], so_hau: 0 } : hong('Không thấy tấm hậu chính để chuyển.');
    // --- kế hoạch cho từng tấm hậu: mỗi tấm hậu tự tìm 2 tấm đứng kẹp nó, đáy, nóc và chiều sâu của thùng mình (module nhiều khoang, bộ ghép nhiều thùng sâu khác nhau đều qua đây) ---
    const sua = new Map(), ghi = [];
    const dungTat = kc.filter(o => o.tr === 0);
    const tim = v => r2((v[0] + v[1]) / 2);
    for (const h of chinh) {
      const yT = h.bx[1][0], tpl = idOf(h.b.Template);
      h.auto = hauTuDong(tpl); h.tpl = tpl;
      if (!h.auto && !tplThuong(tpl)) return hong('Tấm hậu thuộc một mẫu tự động loại lạ — chưa hỗ trợ.');
      if (h.auto && tpl._option.boardRelative !== 'back') return hong('Hậu tự động đặt theo mặt trước — chưa hỗ trợ.');
      // tấm đứng ở mép trái / phải của hậu: chạm mép hậu, hoặc chứa mép hậu (hậu ăn rãnh), cao chồng với hậu, chạy ra tới hậu
      const ben = x => dungTat.filter(o => chong(o.bx[2], h.bx[2]) > 1 && o.bx[0][0] <= x + E && o.bx[0][1] >= x - E && o.bx[1][1] >= yT - E);
      const trai = ben(h.bx[0][0]).sort((a, c) => a.bx[0][0] - c.bx[0][0])[0], phai = ben(h.bx[0][1]).sort((a, c) => c.bx[0][1] - a.bx[0][1])[0];
      if (!trai || !phai || trai === phai) return hong('Không tìm được 2 tấm đứng (hồi / vách) kẹp hai bên tấm hậu — module đang xoay, hoặc không phải thùng tủ thường (tủ góc, khối né dầm / cột).');
      h.D = Math.max(trai.bx[1][1], phai.bx[1][1]);
      if (h.D - h.bx[1][1] > 60) return hong('Tấm hậu nằm sâu trong thùng (cách lưng hơn 60) — kết cấu lạ, chưa hỗ trợ.');
      h.ySau = r2(h.D - hau);
      const dinh = kc.filter(o => chong(o.bx[0], [trai.bx[0][0], phai.bx[0][1]]) > 1 && chong(o.bx[2], [h.bx[2][0] - 20, h.bx[2][1] + 20]) > 1 && (Math.abs(o.bx[1][1] - yT) < E || (o.bx[1][1] > h.ySau + 0.01 && o.bx[1][1] <= h.D + E)));
      for (const o of dinh) {
        if (!tplThuong(idOf(o.b.Template))) { if (o.bx[1][1] > h.ySau + 0.01) return hong(`Tấm "${D.tenTamViet(o.ten)}" là tấm tự động của Chenfeng, phải cắt mép sau mới phủ hậu được — chưa hỗ trợ.`); continue; }      // đợt tự động: tự bám theo hậu
        const cu = sua.get(o);
        if (cu) { if (Math.abs(cu.ySau - h.ySau) > 0.01) return hong(`Tấm "${D.tenTamViet(o.ten)}" dùng chung cho 2 thùng sâu khác nhau — chưa hỗ trợ.`); continue; }
        sua.set(o, { y1: o.bx[1][1], ySau: h.ySau, h });
        o.noi = Math.abs(o.bx[1][1] - yT) < E && o.bx[1][1] <= h.ySau;      // noi: tấm đang dừng ở mặt trước hậu, được nối dài ra (sâu − 6)
      }
      const ngang = dinh.filter(o => o.tr === 2);
      if (!ngang.length) return hong('Không có nóc / đáy chạm tấm hậu.');
      // đáy: tấm ngang chứa / chạm mép dưới hậu, không có thì tấm ngang thấp nhất (hậu chạy xuống tận sàn sau đáy). Nóc: tấm ngang chứa / chạm mép trên hậu; không có → đầu hồi (tủ bếp dưới không nóc).
      h.ke = { trai, phai, dinh, ngang };
    }
    for (const h of chinh) {
      const k = h.ke, ngang = k.ngang, z0 = h.bx[2][0], z1 = h.bx[2][1];
      k.day = ngang.filter(o => o.bx[2][0] <= z0 + E && o.bx[2][1] >= z0 - E).sort((a, c) => a.bx[2][0] - c.bx[2][0])[0] || ngang.slice().sort((a, c) => a.bx[2][0] - c.bx[2][0])[0];
      k.noc = ngang.filter(o => o.bx[2][1] >= z1 - E && o.bx[2][0] <= z1 + E && o !== k.day).sort((a, c) => c.bx[2][1] - a.bx[2][1])[0] || null;
    }
    for (const h of chinh) {
      const k = h.ke, khac = chinh.filter(g => g !== h);
      // tấm kẹp dùng chung với một tấm hậu khác (vách giữa 2 khoang, đợt cố định giữa 2 tầng hậu) → mối nối hậu nằm ở tim tấm đó; không thì hậu phủ hết tấm, lùi mép
      k.ngoaiT = !khac.some(g => g.ke.phai === k.trai); k.ngoaiP = !khac.some(g => g.ke.trai === k.phai);
      k.chungD = khac.some(g => g.ke.noc === k.day); k.chungN = !!k.noc && khac.some(g => g.ke.day === k.noc);
      const dauHoi = Math.min(k.trai.bx[2][1], k.phai.bx[2][1]);
      k.dich = [[k.ngoaiT ? r2(k.trai.bx[0][0] + mep) : tim(k.trai.bx[0]), k.ngoaiP ? r2(k.phai.bx[0][1] - mep) : tim(k.phai.bx[0])], [h.ySau, h.D],
        [k.chungD ? tim(k.day.bx[2]) : r2(k.day.bx[2][0] + mep), k.noc ? (k.chungN ? tim(k.noc.bx[2]) : r2(k.noc.bx[2][1] - mep)) : r2(dauHoi - mep)]];
    }
    // --- điểm co giãn TRƯỚC khi sửa (số thứ tự điểm không đổi sau khi sửa) ---
    const diem = new Map();
    const P = b => { if (!diem.has(b)) diem.set(b, b.GetStretchPoints().map(v => [v.x, v.y, v.z])); return diem.get(b); };
    const mat = (o, tr, gt) => { const ks = []; P(o.b).forEach((p, k) => { if (Math.abs(p[tr] - gt) < E) ks.push(k); }); return ks; };
    for (const [o] of sua) o.kSau = mat(o, 1, o.bx[1][1]);
    for (const h of chinh) {
      const k = h.ke;
      k.kSauT = mat(k.trai, 1, k.trai.bx[1][1]); k.kSauP = mat(k.phai, 1, k.phai.bx[1][1]);
      if (h.auto) continue;
      k.kT = k.ngoaiT ? mat(k.trai, 0, k.trai.bx[0][0]) : null; k.kP = k.ngoaiP ? mat(k.phai, 0, k.phai.bx[0][1]) : null;
      k.kD = k.chungD ? null : mat(k.day, 2, k.day.bx[2][0]);
      k.kN = k.noc ? (k.chungN ? null : mat(k.noc, 2, k.noc.bx[2][1])) : mat(k.trai, 2, k.trai.bx[2][1]);
      h.k = { x0: mat(h, 0, h.bx[0][0]), x1: mat(h, 0, h.bx[0][1]), z0: mat(h, 2, h.bx[2][0]), z1: mat(h, 2, h.bx[2][1]), n: P(h.b).length };
      if (h.k.x0.length + h.k.x1.length !== h.k.n || h.k.z0.length + h.k.z1.length !== h.k.n) return hong('Tấm hậu có khuyết (né cột / dầm) — chưa hỗ trợ cho hậu dày; mẫu hậu mỏng âm rãnh thì được.');
    }
    const mauTam = chinh[0].ke.trai.b, V3 = mauTam.GetStretchPoints()[0].constructor, M4 = mauTam.OCS.constructor;
    const vec = (x, y, z) => new V3(x, y, z);
    const h0 = hmMark();
    opt.onStatus('Đang sửa mép sau các tấm và tấm hậu…');
    const ghiLai = b => { try { b.WriteAllObjectRecord(); } catch (e) { /* bỏ qua */ } };
    // Gói mọi thay đổi (tấm + lựa chọn của mẫu + động tác tham số) vào MỘT bước hoàn tác riêng; không mở thì Chenfeng nhét chúng vào bước của lệnh trước đó.
    let moLenh = false;
    try { const h = hm(); if (h && typeof h.StartCmd === 'function' && typeof h.EndCmd === 'function') { h.StartCmd('MNCF_CHUANHOA'); moLenh = true; } } catch (e) { moLenh = false; }
    for (const t of cay) ghiLai(t);
    // --- 1. mép sau hồi / nóc / đáy / vách / đợt ---
    for (const [o, q] of sua) { ghiLai(o.b); o.b.MoveStretchPoints(o.kSau, vec(0, q.ySau - q.y1, 0)); }
    // --- 2. tấm hậu ---
    for (const h of chinh) {
      const k = h.ke, o = h.b.BoardProcessOption;
      ghiLai(h.b);
      if (h.auto) {
        const op = h.tpl._option;
        // phần "ăn ra" mới = phần cũ + khoảng từ mép hậu hiện tại tới đích (không phụ thuộc khoảng kẹp do tấm nào chặn)
        op.leftExt = r2((+op.leftExt || 0) + h.bx[0][0] - k.dich[0][0]); op.rightExt = r2((+op.rightExt || 0) + k.dich[0][1] - h.bx[0][1]);
        op.topExt = r2((+op.topExt || 0) + k.dich[2][1] - h.bx[2][1]); op.bottomExt = r2((+op.bottomExt || 0) + h.bx[2][0] - k.dich[2][0]);
        op.thickness = hau; op.exprThickness = String(hau); op.spaceSize = -hau; op.calcSpaceSize = String(-hau);
        try { const p = h.tpl.GetParam('BH'); if (p) p.expr = String(hau); } catch (e) { /* bỏ qua */ }
      } else {
        h.b.Thickness = hau;
        let bx = hop(h.b);
        if (Math.abs(bx[1][1] - h.D) > 0.01) { h.b.ApplyMatrix(new M4().makeTranslation(0, h.D - bx[1][1], 0)); bx = hop(h.b); }
        const keo = (ks, tr, d) => { if (ks.length && Math.abs(d) > 0.001) h.b.MoveStretchPoints(ks, vec(tr === 0 ? d : 0, 0, tr === 2 ? d : 0)); };
        keo(h.k.x0, 0, k.dich[0][0] - bx[0][0]); keo(h.k.x1, 0, k.dich[0][1] - bx[0][1]); keo(h.k.z0, 2, k.dich[2][0] - bx[2][0]); keo(h.k.z1, 2, k.dich[2][1] - bx[2][1]);
      }
      try { o.drillType = Core.KHONG_KHOAN; if (Array.isArray(o.highDrill)) o.highDrill = o.highDrill.map(() => Core.KHONG_KHOAN); } catch (e) { /* bỏ qua */ }
    }
    // --- 3. động tác tham số: mép sau các tấm đã sửa + tấm hậu thường đi theo mặt chuẩn ---
    let soDT = 0;
    const idx = b => { try { return b.Id.Index; } catch (e) { return -1; } };
    for (const t of cay) for (const p of (t.Params || [])) for (const a of (p.actions || [])) {
      const d = a.StretchDirection; if (!d || !Array.isArray(a.EntityStretchPointMap) || !Array.isArray(a.MoveEntitys)) continue;
      const dv = [d.x, d.y, d.z], tr = [0, 1, 2].find(q => Math.abs(dv[q]) > 0.999);
      if (tr === undefined) continue;
      const doi = new Set(a.MoveEntitys.map(x => x && x.Index)), keo = new Map(a.EntityStretchPointMap.map(x => [x.entity && x.entity.Index, x]));
      const di = (o, k) => doi.has(idx(o.b)) || ((keo.get(idx(o.b)) || {}).indexs || []).includes(k);
      const matDi = (o, ks) => { if (!ks || !ks.length) return 0; const n = ks.filter(k => di(o, k)).length; return n === ks.length ? 1 : n === 0 ? 0 : -1; };
      const truoc = JSON.stringify([[...doi], a.EntityStretchPointMap.map(x => [x.entity && x.entity.Index, x.indexs])]);
      const sauDi = h => matDi(h.ke.trai, h.ke.kSauT) === 1 && matDi(h.ke.phai, h.ke.kSauP) === 1;      // mép sau 2 tấm kẹp của tấm hậu h có đi theo động tác này không
      const dat = (o, ks) => {      // đặt tập điểm bị kéo của tấm o trong động tác này = ks (đủ mọi điểm → dời nguyên tấm)
        const id = idx(o.b), n = P(o.b).length;
        a.MoveEntitys = a.MoveEntitys.filter(x => !x || x.Index !== id); a.EntityStretchPointMap = a.EntityStretchPointMap.filter(x => !x.entity || x.entity.Index !== id);
        if (ks.length >= n) a.MoveEntitys.push(o.b.Id);
        else if (ks.length || keo.has(id)) a.EntityStretchPointMap.push({ entity: o.b.Id, indexs: ks.slice().sort((x, y) => y - x) });
      };
      if (tr === 1) for (const [o, q] of sua) {
        if (!o.noi || doi.has(idx(o.b))) continue;      // tấm vốn đã chạy ra tận lưng thì phần mép sau trong động tác giữ nguyên
        const cu = ((keo.get(idx(o.b)) || {}).indexs || []).filter(k => !o.kSau.includes(k));
        const m = sauDi(q.h) ? cu.concat(o.kSau) : cu;
        if (m.length || keo.has(idx(o.b))) dat(o, m);
      }
      for (const h of chinh) if (!h.auto) {
        const k = h.ke, s = new Set(), n = h.k.n;
        if (tr === 1) { if (sauDi(h)) for (let q = 0; q < n; q++) s.add(q); }
        else if (tr === 0) {
          if (k.ngoaiT ? matDi(k.trai, k.kT) === 1 : doi.has(idx(k.trai.b))) h.k.x0.forEach(q => s.add(q));
          if (k.ngoaiP ? matDi(k.phai, k.kP) === 1 : doi.has(idx(k.phai.b))) h.k.x1.forEach(q => s.add(q));
        } else {
          if (k.chungD ? doi.has(idx(k.day.b)) : matDi(k.day, k.kD) === 1) h.k.z0.forEach(q => s.add(q));
          if (k.noc ? (k.chungN ? doi.has(idx(k.noc.b)) : matDi(k.noc, k.kN) === 1) : matDi(k.trai, k.kN) === 1) h.k.z1.forEach(q => s.add(q));
        }
        dat(h, [...s]);
      }
      if (JSON.stringify([a.MoveEntitys.map(x => x && x.Index), a.EntityStretchPointMap.map(x => [x.entity && x.entity.Index, x.indexs])]) !== truoc) soDT++;
    }
    // --- 4. cập nhật cây mẫu (hậu tự động tự dựng lại theo lựa chọn mới), bỏ thanh giằng, khoan lại ---
    // các tấm "背板(自动)" KHÁC (xà sau trên của tủ bếp dưới, thanh giằng trước hậu…) đo từ lưng khoảng kẹp: hồi vừa lùi 6 thì chúng bị kéo theo → trả về đúng chỗ cũ
    const khacTD = L.filter(o => laHau(o) && !chinh.includes(o) && !giang.includes(o) && hauTuDong(idOf(o.b.Template)) && idOf(o.b.Template)._option.boardRelative === 'back').map(o => ({ o, y1: o.bx[1][1], tpl: idOf(o.b.Template) }));
    const capNhat = async () => { try { await T.UpdateTemplateTree(); } catch (e) { ghi.push('Chenfeng báo lỗi khi cập nhật module: ' + String(e && e.message || e).slice(0, 120)); } await sleep(300); };
    await capNhat();
    let lech = 0;
    for (const q of khacTD) {
      const dy = r2(hop(q.o.b)[1][1] - q.y1); if (Math.abs(dy) < 0.01) continue;
      const op = q.tpl._option, bt = String(op.calcSpaceSize == null ? '' : op.calcSpaceSize).trim();
      op.spaceSize = r2((+op.spaceSize || 0) + dy);
      op.calcSpaceSize = bt === '' || isFinite(Number(bt)) ? String(op.spaceSize) : `(${bt})${dy < 0 ? '-' : '+'}${Math.abs(dy)}`;
      lech++;
    }
    if (lech) await capNhat();
    if (moLenh) { try { hm().EndCmd(); } catch (e) { /* bỏ qua */ } }
    let xoa = 0;
    if (giang.length) { const r = await D.erase(giang.map(o => o.b)); xoa = r.n || 0; if (!r.ok) ghi.push(`Còn ${r.con} thanh giằng sau hậu chưa xoá được — xoá tay.`); }
    let khoan = null;
    const conLai = tam.filter(b => !b.IsErase);
    if (opt.khoan_lai) {
      opt.onStatus('Chenfeng đang khoan lại…');
      try { khoan = await D.finalize(conLai, opt.khoan, { ep: true, kem: chinh.map(h => h.b), onStatus: opt.onStatus }); } catch (e) { khoan = { reason: String(e && e.message || e).slice(0, 160) }; }
      if (khoan && khoan.reason) ghi.push(khoan.reason);
    }
    // --- 5. nghiệm thu ---
    const loi = [];
    for (const h of chinh) {
      const o = moi(h.b), k = h.ke;
      if (Math.abs(o.day - hau) > 0.01) loi.push(`hậu còn dày ${o.day}`);
      const de = conLai.filter(b => b !== h.b).map(b => ({ b, x: hop(b) })).filter(q => chong(q.x[0], o.bx[0]) > 0.5 && chong(q.x[1], o.bx[1]) > 0.5 && chong(q.x[2], o.bx[2]) > 0.5);
      if (de.length) loi.push(`hậu đè lên ${de.slice(0, 3).map(q => D.tenTamViet(ten(q.b))).join(', ')}`);
      if (Math.abs(o.bx[0][0] - k.dich[0][0]) > 0.6 || Math.abs(o.bx[0][1] - k.dich[0][1]) > 0.6 || Math.abs(o.bx[2][0] - k.dich[2][0]) > 0.6 || Math.abs(o.bx[2][1] - k.dich[2][1]) > 0.6 || Math.abs(o.bx[1][0] - h.ySau) > 0.6)
        loi.push(`hậu chưa phủ đúng: ${o.bx.map(x => x.map(r2).join('~')).join(' × ')} (cần ${k.dich.map(x => x.join('~')).join(' × ')})`);
    }
    const h1 = hmMark();
    D.lastChuanHoa = { T, steps: h0 && h1 && h1.i > h0.i ? h1.i - h0.i : 0, mark: h1 };
    if (loi.length) {      // nghiệm thu không đạt → trả module về như cũ, không để lại module sửa dở
      const tra = await D.undoChuanHoa();
      return { ok: false, ly_do: 'Kết cấu module này bảng chưa xử lý đúng (' + loi.join('; ') + ')' + (tra.ok ? ' — đã trả module về như cũ.' : ' — CHƯA trả lại được: bấm Ctrl+Z trong Chenfeng cho tới khi module trở lại, hoặc xoá rồi chèn lại.'), da_tra_lai: !!tra.ok };
    }
    return { ok: true, module: T.Name || '', so_tam: conLai.length, so_hau: chinh.length,
      hau_tu_dong: chinh.filter(h => h.auto).length, sua_mep_sau: [...sua].map(([o, q]) => `${D.tenTamViet(o.ten)} ${r2(q.y1)} → ${q.ySau}`), xoa_giang: xoa, dong_tac: soDT,
      hau: chinh.map(h => { const o = moi(h.b); return `${o.day} li · ${o.bx.map(x => x.map(r2).join('~')).join(' × ')}`; }), khoan, ghi_chu: ghi, so_buoc_hoan_tac: D.lastChuanHoa.steps };
  };

  /** Hoàn tác lần chuẩn hoá vừa rồi (tấm, lựa chọn của mẫu, động tác tham số và lỗ khoan cùng trở lại) — chỉ khi bản vẽ chưa có thao tác nào khác sau đó. */
  D.undoChuanHoa = async () => {
    const L = D.lastChuanHoa;
    if (!L) return { ok: false, reason: 'Chưa có lần chuẩn hoá nào để hoàn tác.' };
    if (D.busy()) await D.cancel();
    const moved = () => { const now = hmMark(); return !!(L.mark && now && (now.i !== L.mark.i || now.rec !== L.mark.rec)); };
    for (let i = 0; i < 6 && moved(); i++) await sleep(300);
    if (moved()) return { ok: false, reason: 'Sau lần chuẩn hoá đó bản vẽ đã có thao tác khác — hãy dùng Ctrl+Z của Chenfeng để lùi từng bước.' };
    if (!L.steps) return { ok: false, reason: 'Chenfeng không ghi được bước hoàn tác cho lần chuẩn hoá này — xoá module rồi chèn lại từ kho.' };
    await D.undo(L.steps);
    try { await L.T.UpdateTemplateTree(); } catch (e) { /* bỏ qua */ }
    await sleep(200);
    // Lần cập nhật mẫu sau khi lùi có thể tự ghi thêm một bước lịch sử (đã gặp trên bản thật) → dời mốc của lần đổi dày ván ngay trước đó
    // theo, để "trả dày ván" vẫn lùi đúng (lùi luôn cả bước phụ đó).
    try { const V = D.lastDayVan, now = hmMark(); if (V && V.T === L.T && V.mark && now && now.i >= V.mark.i) { V.steps += now.i - V.mark.i; V.mark = now; } } catch (e) { /* bỏ qua */ }
    D.lastChuanHoa = null;
    return { ok: true };
  };

  /* ------------------------------------------------------------------ *
   * DÀY VÁN CỦA MODULE KHO (bản 1.12) — anh Jason 03/10/2026 16:16: "nhớ chỉnh dày ván thành 17.5".
   * Mẫu của cửa hàng Chenfeng vẽ với ván 18 (tham số BH 板厚 = 18). Đổi BH của module đang chọn sang bề dày ván của xưởng
   * bằng chính tham số của mẫu (BH.expr = '17.5' → UpdateTemplateTree): các động tác của mẫu tự dời / kéo tấm cho khớp.
   * Mẫu nào BH không nối với tấm nào (đổi xong không tấm nào đổi dày) thì trả lại như cũ và báo rõ — không sửa dở.
   * ------------------------------------------------------------------ */
  D.dayVan = async (ent, day, opt) => {
    D.boManChe();
    opt = Object.assign({ onStatus() {} }, opt || {});
    opt.onStatus = guard(opt.onStatus);
    day = r2(Number(day));
    const hong = ly_do => ({ ok: false, ly_do });
    if (!D.available()) return hong('Không thấy Chenfeng trong trang này.');
    if (!(day >= 3 && day <= 60)) return hong('Bề dày ván không hợp lệ.');
    const T = rootTpl(ent);
    if (!T) return hong('Tấm đang chọn không thuộc module nào.');
    if (D.busy()) await D.cancel();
    const cayCua = () => { const c = []; (function di(t, n) { if (!t || c.includes(t) || n > 8) return; c.push(t); for (const k of (t.Children || [])) di(idOf(k), n + 1); })(T, 0); return c; };
    const tamCua = cay => D.all().filter(b => D.isBoard(b) && !b.IsErase && b.Template && cay.includes(idOf(b.Template)));
    const cay = cayCua(), tam = tamCua(cay);
    if (!tam.length) return hong('Module không có tấm ván nào.');
    if (tam.some(b => D.tagOf(b))) return hong('Đây là tủ do bảng Một Nhà vẽ — dày ván theo cấu hình của bảng.');
    let bh = null; try { bh = T.GetParam('BH'); } catch (e) { bh = null; }
    if (!bh) return hong('Module không có tham số dày ván (BH) — không đổi tự động được.');
    const cu = r2(Number(bh.value));
    const bang = (a, b) => Math.abs(a - b) < 0.01;
    const laHauTen = b => /背|^Hậu/.test(String(b.Name || ''));
    const dem = (ds, t) => ds.filter(b => bang(r2(b.Thickness), t)).length;
    const coCu = dem(tam, cu), coMoi = dem(tam, day);
    if (bang(cu, day)) return { ok: true, da_dung: true, module: T.Name || '', tam: tam[0], tu: cu, day, so_tam: tam.length, doi: 0, con: 0, ten_con: [] };
    if (!coCu) return hong(`Tham số dày ván của module đang là ${cu} nhưng không tấm nào dày ${cu} — module này không theo tham số, giữ nguyên.`);
    opt.onStatus(`Đang đổi dày ván ${cu} → ${day}…`);
    const h0 = hmMark(); let mo = false;
    try { const h = hm(); if (h && typeof h.StartCmd === 'function' && typeof h.EndCmd === 'function') { h.StartCmd('MNCF_DAYVAN'); mo = true; } } catch (e) { mo = false; }
    for (const b of tam) { try { b.WriteAllObjectRecord(); } catch (e) { /* bỏ qua */ } }
    for (const t of cay) { try { if (typeof t.WriteAllObjectRecord === 'function') t.WriteAllObjectRecord(); } catch (e) { /* bỏ qua */ } }
    const exprCu = bh.expr;
    let loi = '';
    try { bh.expr = String(day); await T.UpdateTemplateTree(); } catch (e) { loi = String(e && e.message || e).slice(0, 120); }
    await sleep(300);
    if (mo) { try { hm().EndCmd(); } catch (e) { /* bỏ qua */ } }
    const h1 = hmMark();
    D.lastDayVan = { T, steps: h0 && h1 && h1.i > h0.i ? h1.i - h0.i : 0, mark: h1, bh, exprCu, cu };
    const sau = tamCua(cayCua()), conCu = sau.filter(b => bang(r2(b.Thickness), cu)), daDoi = dem(sau, day) - coMoi;
    if (loi || daDoi <= 0) {      // BH không nối với tấm nào (hoặc Chenfeng báo lỗi) → trả lại, không để tham số ghi 17,5 mà ván vẫn 18
      const tra = await D.undoDayVan();
      if (!tra.ok) { try { bh.expr = exprCu == null ? '' : exprCu; bh.value = cu; await T.UpdateTemplateTree(); } catch (e) { /* bỏ qua */ } }
      return { ok: false, khong_noi: !loi, ly_do: loi ? 'Chenfeng báo lỗi khi đổi dày ván: ' + loi : `Tham số dày ván (BH) của module này không nối với tấm nào — ${coCu} tấm vẫn dày ${cu}. Đổi tay bằng lệnh sửa dày ván của Chenfeng nếu cần.` };
    }
    const ten = {}; for (const b of conCu) { const t = D.tenTamViet(String(b.Name || '')); ten[t] = (ten[t] || 0) + 1; }
    return { ok: true, module: T.Name || '', tam: sau.find(b => !laHauTen(b)) || sau[0], tu: cu, day, so_tam: sau.length, doi: daDoi, con: conCu.length, ten_con: Object.keys(ten).map(k => ten[k] > 1 ? `${k} ×${ten[k]}` : k), so_buoc_hoan_tac: D.lastDayVan.steps };
  };

  /** Hoàn tác lần đổi dày ván vừa rồi — chỉ khi bản vẽ chưa có thao tác nào khác sau đó. */
  D.undoDayVan = async () => {
    const L = D.lastDayVan;
    if (!L) return { ok: false, reason: 'Chưa có lần đổi dày ván nào để hoàn tác.' };
    if (D.busy()) await D.cancel();
    const moved = () => { const now = hmMark(); return !!(L.mark && now && (now.i !== L.mark.i || now.rec !== L.mark.rec)); };
    for (let i = 0; i < 6 && moved(); i++) await sleep(300);
    if (moved()) return { ok: false, reason: 'Sau lần đổi dày ván đó bản vẽ đã có thao tác khác — hãy dùng Ctrl+Z của Chenfeng để lùi từng bước.' };
    if (!L.steps) return { ok: false, reason: 'Chenfeng không ghi được bước hoàn tác cho lần đổi dày ván này.' };
    await D.undo(L.steps);
    try { await L.T.UpdateTemplateTree(); } catch (e) { /* bỏ qua */ }
    D.lastDayVan = null;
    return { ok: true };
  };

  /* ---- kho mẫu của tài khoản — chỉ ĐỌC, dùng chính phiên đăng nhập Chenfeng của trang (để dò mã mẫu ngăn kéo) ---- */
  D.apiHost = () => {
    try { for (const e of root.performance.getEntriesByType('resource')) { const m = /^(https:\/\/[^/]+)\/CAD-[A-Za-z]/.exec(e.name); if (m) return m[1]; } } catch (e) { /* bỏ qua */ }
    return 'https://api.cfcad.cn';
  };
  const post = async (path, data) => {
    // máy chủ Chenfeng có lúc trả lời rất chậm: quá 60 giây thì thôi, báo rõ để người dùng bấm lại
    const ac = typeof AbortController === 'function' ? new AbortController() : null;
    let het = false; const hen = sleep(60000).then(() => { het = true; if (ac) ac.abort(); });
    let r, j;
    try {
      r = await Promise.race([root.fetch(D.apiHost() + '/' + path, { method: 'POST', mode: 'cors', credentials: 'include', body: JSON.stringify(data), signal: ac ? ac.signal : undefined }), hen.then(() => { throw new Error('qua gio'); })]);
      if (!r.ok) throw new Error('Máy chủ Chenfeng trả lời ' + r.status + '.');
      j = await r.json();
    } catch (e) { if (het) throw new Error('Máy chủ Chenfeng không trả lời sau 60 giây (mạng tới Chenfeng đang chậm) — thử lại sau.'); throw e; }
    if (!j || (j.err_code !== 0 && j.err_code !== '0')) throw new Error('Chenfeng báo lỗi' + (j && j.err_msg ? ': ' + j.err_msg : '') + ' — kiểm tra đã đăng nhập chưa.');
    return j;
  };
  const inflate = async b64 => { const bin = Uint8Array.from(root.atob(b64), c => c.charCodeAt(0)); return await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('deflate'))).text(); };
  /** Các thư mục mẫu của tài khoản: [{id, ten, cha}] */
  D.templateDirs = async () => {
    const j = await post('CAD-dirQuery', { dir_type: '5' }), out = [];
    const walk = (a, cha) => { for (const d of a || []) { out.push({ id: String(d.dir_id), ten: String(d.dir_name || '').trim(), cha }); walk(d.childs, String(d.dir_id)); } };
    walk(j.dirs, null);
    return out;
  };
  /** Các mẫu trong một thư mục: [{id, ten, ts}] — ts = tham số của mẫu với giá trị mặc định (đọc từ mô tả mẫu). */
  D.templatesIn = async dirId => {
    const j = await post('CAD-moduleList', { dir_id: String(dirId), page: 1, page_count: 100 }), out = [];
    for (const m of j.modules || []) {
      const ts = {};
      try { for (const r of JSON.parse(await inflate(m.props))) if (Array.isArray(r) && typeof r[1] === 'string' && typeof r[3] === 'number') ts[r[1]] = r[3]; } catch (e) { /* mẫu không đọc được tham số thì thôi */ }
      out.push({ id: Math.round(+m.module_id) || 0, ten: String(m.name || '').trim(), ts });
    }
    return out;
  };
  /** Các mẫu ngăn kéo của tài khoản: thư mục tên "抽屉" trong kho mẫu. */
  D.drawerTemplates = async () => {
    const dirs = await D.templateDirs();
    const d = dirs.find(x => x.ten === '抽屉') || dirs.find(x => /抽屉|ngăn kéo|drawer/i.test(x.ten));
    if (!d) throw new Error('Không thấy thư mục "抽屉" (ngăn kéo) trong kho mẫu của tài khoản Chenfeng này.');
    return { thu_muc: d.ten, mau: await D.templatesIn(d.id) };
  };
  /**
   * Một trang mẫu của MỘT thư mục kho (bản 1.19 — để duyệt kho có hình ngay trong bảng). Chỉ ĐỌC.
   * opt: { trang (1…), moi_trang (≤ 100), ten (lọc theo tên) }. Thư mục rỗng thì Chenfeng không trả `modules`.
   * @returns {{ tong, trang, mau: [{ id, ten, hinh (địa chỉ ảnh nhỏ của mẫu), kt: [L, W, H] | null (kích thước mặc định), bh (dày ván mặc định) }] }}
   */
  D.khoMau = async (dirId, opt) => {
    opt = Object.assign({ trang: 1, moi_trang: 24, ten: '' }, opt || {});
    const trang = Math.max(1, Math.round(opt.trang) || 1), moi = Math.min(100, Math.max(1, Math.round(opt.moi_trang) || 24));
    const body = { dir_id: String(dirId), curr_page: trang, page: trang, page_count: moi };
    if (opt.ten) body.name = String(opt.ten).slice(0, 60);
    const j = await post('CAD-moduleList', body), host = D.apiHost(), out = [];
    for (const m of j.modules || []) {
      const ts = {};
      try { for (const r of JSON.parse(await inflate(m.props))) if (Array.isArray(r) && typeof r[1] === 'string' && typeof r[3] === 'number') ts[r[1]] = r[3]; } catch (e) { /* mẫu không đọc được tham số: vẫn liệt kê, không có kích thước mặc định */ }
      const logo = String(m.logo || '').replace(/^\/+/, '');
      out.push({ id: Math.round(+m.module_id) || 0, ten: String(m.name || '').trim(), hinh: logo ? (/^https?:/i.test(logo) ? logo : host + '/' + logo) : '',
        kt: ts.L > 0 && ts.W > 0 && ts.H > 0 ? [r2(ts.L), r2(ts.W), r2(ts.H)] : null, bh: ts.BH > 0 ? r2(ts.BH) : 0 });
    }
    return { tong: Math.max(Math.round(+j.count) || 0, out.length), trang, mau: out };
  };

  /* ------------------------------------------------------------------ *
   * VẼ BẰNG LỆNH GỐC CỦA CHENFENG (bản 1.15 — anh Jason 03/10/2026 19:01: "em phải vẽ chuẩn chenfeng … thì anh mới chỉnh sửa tiện lợi được")
   * Bảng tự chạy đúng các lệnh vẽ tấm của Chenfeng (LEFTRIGHTBOARD, VERTIALBOARD, TOPBOTTOMBOARD, BEHINDBOARD, LAYERBOARD) theo kế hoạch `Core.keHoachGoc`:
   *   gọi lệnh → hộp thoại lựa chọn của Chenfeng mở → ghi lựa chọn vào kho lựa chọn (store) của hộp thoại → bấm nút OK → trả lời lời nhắc.
   * Đã đo trên Chenfeng bản 2026-09-20:
   *   - kho lựa chọn lấy từ nút OK lần ngược React fiber (memoizedProps.store); `m_Option` là số thật, `m_UiOption` là chuỗi hiển thị (phải ghi cả hai);
   *   - hộp thoại mở xong còn NẠP cấu hình đã lưu của người dùng → phải chờ lựa chọn đứng yên rồi mới ghi đè;
   *   - bề dày, khoảng cách… tính bằng BIỂU THỨC chuỗi: exprThickness, exprCount, calcSpaceSize, calcFrontShrink…;
   *   - LEFTRIGHTBOARD hỏi "请拾取基点:" → gõ toạ độ; các lệnh khác hỏi "点选画板区域" và dò khoảng trống theo VỊ TRÍ CHUỘT
   *     (`MouseCtrl._CurMousePointVCS`, toạ độ màn hình) chứ không theo điểm trả về → đặt hình chiếu màn hình của một điểm nằm trong khoảng trống rồi gõ điểm;
   *   - mặt SAU của tấm hậu cách mép sau khoảng trống `spaceSize` (âm = nằm sau thùng = hậu phủ sau); leftExt… = trùm ra ngoài khoảng trống.
   * Lựa chọn của người dùng trong kho lựa chọn được trả lại nguyên sau mỗi lệnh (không bấm "Lưu cấu hình").
   * ------------------------------------------------------------------ */
  /** Trang này có đủ thứ để chạy lệnh gốc không (Chenfeng thật; trang giả lập thì không). */
  D.gocDuoc = () => { try { const e = ed(), V = root.app.Viewer; return !!(e.ModalManage && e.MouseCtrl && e.MouseCtrl._CurMousePointVCS && typeof V.WorldToScreen === 'function' && typeof V.ViewToFront === 'function' && typeof e.GetPoint === 'function'); } catch (e) { return false; } };
  const khoaFiber = e => Object.keys(e).find(k => k.indexOf('__reactFiber') === 0 || k.indexOf('__reactInternalInstance') === 0);
  const hopGoc = () => {
    const nuts = [...document.querySelectorAll('button')].filter(b => { try { return b.getBoundingClientRect().width > 0 && /^(OK|确定|確定)$/i.test((b.innerText || b.textContent || '').trim()); } catch (e) { return false; } });
    for (let q = nuts.length - 1; q >= 0; q--) {
      let n = nuts[q];
      for (let i = 0; i < 18 && n; i++, n = n.parentElement) {
        const k = khoaFiber(n); if (!k) continue;
        let f = n[k];
        for (let j = 0; j < 90 && f; j++, f = f.return) { const pr = f.memoizedProps; if (pr && pr.store && (typeof pr.store.OnOk === 'function' || (pr.store.m_Option && typeof pr.store.m_Option === 'object'))) return { store: pr.store, ok: nuts[q] }; }
      }
    }
    return null;
  };
  const KHOA_LUA_CHON = ['m_Option', 'm_UiOption', 'topBoardOption', 'bottomBoardOption', 'topUiOption', 'bottomUiOption', 'm_BoardProcessOption', 'ui_BoardProcessOption', 'autoCutOption', 'rectDrillOption'];
  const ganLC = (o, ui, patch) => { for (const k of Object.keys(patch)) { if (o) o[k] = patch[k]; if (ui && k in ui) ui[k] = typeof patch[k] === 'boolean' ? patch[k] : String(patch[k]); } };
  const soLC = v => String(Math.round(v * 1000) / 1000);
  /* CHENFENG DÒ KHOẢNG TRỐNG TRÊN HÌNH ĐANG DỰNG, không phải trên dữ liệu tấm (đọc mã Chenfeng 2026-09-29, PointSelectSpace.PointParseSpace):
   *   - chuột nằm trên một tấm (vd hậu): bắn tia trong các tấm của `Viewer.VisibleObjects` = danh sách dựng hình của KHUNG HÌNH VỪA VẼ;
   *   - chuột nằm chỗ trống: kẻ 4 đường trên màn hình từ chuột ra 4 mép, lấy tấm gần nhất mỗi phía trong `Scene.children` (hình dựng của từng tấm).
   * Hai chỗ Chenfeng làm CHẬM hơn dữ liệu:
   *   (1) tấm mới thêm vào bản vẽ chỉ được đưa hình vào Scene trong một `setTimeout(0)` (+ `Sleep(1)` mỗi 50 đối tượng) — xem Viewer: ModelSpace.AppendEvent;
   *   (2) hình của tấm chỉ được cập nhật khi vẽ một khung hình (Viewer.Render → DeferUpdate từng đối tượng), mà khung hình chạy theo requestAnimationFrame.
   * Tab Chenfeng bị che (người dùng sang tab khác trong lúc chờ): trình duyệt ngừng requestAnimationFrame và dồn setTimeout của trang về 1 lần / giây, trong khi bảng này
   * vẫn chạy nhanh (hẹn giờ trong Worker) → tới lệnh kế, tấm của lệnh trước CHƯA CÓ HÌNH trong Scene → khoảng trống dò sai (đo được 03/10/2026: đợt sau tính từ tấm bên dưới
   * tấm vừa vẽ; hậu trùm qua nóc / đáy). Vì vậy trước mỗi lần dò: tự đưa hình các tấm của tủ vào Scene (đúng việc Chenfeng sắp làm), ép vẽ một khung hình, rê chuột tới điểm
   * như người dùng để Chenfeng DÒ THỬ (hộp xem trước), đọc lại hộp đó, đúng khoảng mong đợi rồi mới trả lời điểm. */
  const hienHinh = ents => {
    let n = 0;
    try {
      const V = root.app.Viewer, sc = V._Scene || V.Scene;
      if (!sc || typeof sc.add !== 'function') return 0;
      for (const e of ents) { try { if (!e || e.IsErase) continue; const o = e.DrawObject; if (o && o.parent !== sc) { sc.add(o); n++; } } catch (er) { /* bỏ qua đối tượng không có hình */ } }
    } catch (e) { /* bỏ qua */ }
    return n;
  };
  const veNgay = () => {
    let V = null; try { V = root.app.Viewer; } catch (e) { V = null; }
    if (!V || typeof V.Render !== 'function') return 'không có Viewer.Render';
    try { V.Render(); return ''; } catch (e) {
      const loi = String(e && e.message || e) || 'lỗi không rõ';
      // Một đối tượng đang dựng dở làm hỏng cả lượt cập nhật hình (các đối tượng xếp sau nó trong hàng chờ không được cập nhật) → cập nhật hình từng đối tượng, bỏ qua cái lỗi,
      // vẽ lại khung hình; cái lỗi trả về hàng chờ để Chenfeng tự cập nhật khi nó dựng xong.
      try {
        const ds = V._NeedUpdateEnts;
        if (ds && typeof ds.clear === 'function') {
          const hong = [];
          for (const en of Array.from(ds)) { try { en.DeferUpdate(); } catch (er) { hong.push(en); } }
          ds.clear();
          try { V.Render(); } catch (e2) { /* khung hình vẫn chưa vẽ được — nơi gọi sẽ thử lại */ }
          for (const en of hong) ds.add(en);
          if (hong.length && typeof V.UpdateRender === 'function') V.UpdateRender();
        }
      } catch (e3) { /* bỏ qua */ }
      return loi;
    }
  };
  /** Ghi thẳng điểm chuột (toạ độ màn hình của điểm p) — lệnh dò khoảng trống đọc điểm này lúc nhận câu trả lời. */
  const datChuot = p => { const V = root.app.Viewer, mc = ed().MouseCtrl, sc = mc._CurMousePointVCS.clone().set(p[0], p[1], p[2]); V.WorldToScreen(sc); mc._CurMousePointVCS.set(sc.x, sc.y, 0); return [sc.x, sc.y]; };
  /** Đưa chuột tới điểm p (toạ độ bản vẽ) như người dùng rê chuột tới: Chenfeng ghi điểm chuột và — khi đang hỏi khoảng trống — dò thử khoảng trống dưới chuột sau 30 ms.
   *  Bắn sự kiện mousemove vào vùng vẽ (đúng cách Chenfeng tự làm cho màn cảm ứng); không ăn thì gọi thẳng bộ nghe chuột; cuối cùng ghi tay điểm chuột. */
  const reChuot = p => {
    const V = root.app.Viewer, mc = ed().MouseCtrl, sc = mc._CurMousePointVCS.clone().set(p[0], p[1], p[2]);
    V.WorldToScreen(sc);
    const toi = () => Math.abs(mc._CurMousePointVCS.x - sc.x) < 1.01 && Math.abs(mc._CurMousePointVCS.y - sc.y) < 1.01;
    let kieu = '';
    try {
      const c = V.Renderer.domElement, r = c.getBoundingClientRect();
      mc._CurMousePointVCS.set(-99999, -99999, 0);
      c.dispatchEvent(new MouseEvent('mousemove', { clientX: r.left + sc.x, clientY: r.top + sc.y, view: root }));
      if (toi()) kieu = 'su_kien';
    } catch (e) { /* thử cách sau */ }
    if (!kieu) { try { if (typeof mc.onMouseMove === 'function') { mc.onMouseMove({ clientX: sc.x, clientY: sc.y, offsetX: sc.x, offsetY: sc.y, button: 0, buttons: 0, preventDefault() {}, stopPropagation() {} }); if (toi()) kieu = 'goi_thang'; } } catch (e) { /* thử cách sau */ } }
    mc._CurMousePointVCS.set(sc.x, sc.y, 0);      // sự kiện làm tròn về điểm ảnh → ghi lại đúng toạ độ lẻ (lần dò thật đọc điểm này)
    return { sc: [sc.x, sc.y], kieu };
  };
  /** Hộp khoảng trống Chenfeng đang xem trước dưới chuột (PointSelectSpace.ShowSpaceBox ghi 3 đường kích thước quanh hộp vào app.MoveTool) → [x0, x1, y0, y1, z0, z1] hoặc null. */
  const hopXemTruoc = () => {
    try {
      const d = root.app.MoveTool && root.app.MoveTool._DrawDimPoints;
      if (!Array.isArray(d) || d.length < 3) return null;
      const b = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity]; let n = 0;
      for (const cap of d) for (const p of cap || []) { if (!p || !isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) continue; n++; b[0] = Math.min(b[0], p.x); b[1] = Math.max(b[1], p.x); b[2] = Math.min(b[2], p.y); b[3] = Math.max(b[3], p.y); b[4] = Math.min(b[4], p.z); b[5] = Math.max(b[5], p.z); }
      return n >= 4 ? b : null;
    } catch (e) { return null; }
  };
  let coXemTruoc = null;      // bản Chenfeng này có cho đọc hộp xem trước không (null = chưa biết)
  /**
   * Dò thử khoảng trống tại `diem` trước khi trả lời lệnh: đưa hình tấm vào Scene → vẽ khung hình → rê chuột → đọc hộp xem trước → so với khoảng mong đợi `mong`.
   *   mong = { x0, x1, z0, z1 }: mặt tấm ĐÃ VẼ gần điểm nhất về 4 phía trên hình chiếu đứng (null = phía đó chưa có tấm) — hộp Chenfeng dò ra không được vượt qua các mặt này.
   *   viec = { hien(): đưa hình các tấm của tủ vào Scene, trả về số tấm vừa thêm; nhin(): nhìn thẳng mặt trước + thu phóng vừa tủ }.
   * Lệch thì chờ rồi thử lại; lần thứ 3 chỉnh lại hướng nhìn (người dùng có thể đã xoay bản vẽ).
   * Không quyết định thay Chenfeng: hết lượt vẫn lệch thì nơi gọi cứ trả lời điểm — tấm vẽ ra sai sẽ bị bước đối chiếu chặn, lời báo lỗi kèm kết quả dò ở đây.
   * @returns {{ lan, hop, khop: true|false|null, lech: string[], loi_ve, kieu }}   khop = null: không đọc được hộp xem trước (không kiểm được)
   */
  const doKhoang = async (diem, mong, viec) => {
    const MT = root.app.MoveTool, g = { lan: 0, hop: null, khop: null, lech: [], loi_ve: '', kieu: '' }, SAI = 0.6;
    let trong = 0;
    for (let lan = 0; lan < 7; lan++) {
      g.lan = lan + 1;
      if (lan) await sleep(lan < 3 ? 250 : 700);
      if (viec && viec.hien) g.them_hinh = (g.them_hinh || 0) + (viec.hien() || 0);
      if (lan === 2 && viec && viec.nhin) { viec.nhin(); await sleep(120); }
      g.loi_ve = veNgay();
      try { g.che = !!root.document.hidden; } catch (e) { /* bỏ qua */ }
      const truoc = MT ? MT._DrawDimPoints : null;
      g.kieu = reChuot(diem).kieu;
      if (!MT || coXemTruoc === false || !mong) return g;
      let hop = null;
      await cho(() => { if (MT._DrawDimPoints !== truoc) hop = hopXemTruoc(); return !!hop; }, coXemTruoc ? 2600 : 1600);
      g.hop = hop ? hop.map(r2) : null;
      if (!hop) {      // Chenfeng không ra hộp xem trước: chỗ đó chưa dò được khoảng trống, hoặc bản Chenfeng này không vẽ hộp
        g.khop = null; g.lech = ['không có hộp xem trước'];
        if (coXemTruoc === null && ++trong >= 2) { coXemTruoc = false; return g; }
        continue;
      }
      coXemTruoc = true;
      const l = [];
      if (diem[0] < hop[0] - SAI || diem[0] > hop[1] + SAI || diem[2] < hop[4] - SAI || diem[2] > hop[5] + SAI) l.push('hộp không chứa điểm dò');
      if (mong.x0 !== null && hop[0] < mong.x0 - SAI) l.push(`trái ${r2(hop[0])} (tấm bên trái ở ${r2(mong.x0)})`);
      if (mong.x1 !== null && hop[1] > mong.x1 + SAI) l.push(`phải ${r2(hop[1])} (tấm bên phải ở ${r2(mong.x1)})`);
      if (mong.z0 !== null && hop[4] < mong.z0 - SAI) l.push(`dưới ${r2(hop[4])} (tấm bên dưới ở ${r2(mong.z0)})`);
      if (mong.z1 !== null && hop[5] > mong.z1 + SAI) l.push(`trên ${r2(hop[5])} (tấm bên trên ở ${r2(mong.z1)})`);
      g.lech = l; g.khop = !l.length;
      if (g.khop) return g;
    }
    return g;
  };
  /** Chạy một lệnh vẽ tấm gốc: `sua(store)` ghi lựa chọn; `diem` = điểm (toạ độ bản vẽ); kieu 'goc' = lệnh hỏi điểm đặt, còn lại = lệnh hỏi khoảng trống.
   *  Lần đầu mở mỗi hộp thoại trong một phiên, Chenfeng còn tải cấu hình đã lưu của người dùng từ máy chủ rồi ghi đè lựa chọn (không biết lúc nào xong)
   *  → chờ danh sách cấu hình về + lựa chọn đứng yên; ghi lựa chọn 2 lần (trước khi bấm OK và ngay trước khi trả lời điểm — lúc Chenfeng thật sự đọc). */
  const daMoGoc = new Set();
  const chayGoc = async (ten, sua, diem, kieu, mong, viec) => {
    if (D.busy()) await D.cancel();
    D.boManChe();
    D.cmd(ten);
    let m = null; await cho(() => !!(m = hopGoc()), 9000);
    if (!m) throw new Error(`Chenfeng không mở hộp thoại của lệnh ${ten} (lệnh khác đang chạy dở, hoặc giao diện Chenfeng đã đổi).`);
    const st = m.store, lanDau = !daMoGoc.has(ten);
    let truoc = '', giong = 0;
    await cho(() => { const now = JSON.stringify([st.m_Option, st.topBoardOption, st.bottomBoardOption, st.m_BoardProcessOption, st.configName]); giong = now === truoc ? giong + 1 : 0; truoc = now; return giong >= (lanDau ? 8 : 3) && (!lanDau || (st.configsNames && st.configsNames.length > 0)); }, lanDau ? 6000 : 2500);
    daMoGoc.add(ten);
    const luu = {}; for (const k of KHOA_LUA_CHON) if (st[k] && typeof st[k] === 'object') { try { luu[k] = JSON.parse(JSON.stringify(st[k])); } catch (e) { /* bỏ qua */ } }
    // CHÚ Ý: Chenfeng đọc lựa chọn SAU khi lời nhắc đã đóng (còn chờ tải vật liệu rồi mới dựng tấm) → chỉ trả lựa chọn của người dùng về khi tấm đã dựng xong (người gọi gọi `tra()`).
    const tra = () => { for (const k of Object.keys(luu)) { try { Object.assign(st[k], luu[k]); } catch (e) { /* bỏ qua */ } } };
    try {
      sua(st);
      m.ok.click();
      if (!(await cho(() => D.busy(), 7000))) throw new Error(`Lệnh ${ten}: bấm OK xong Chenfeng không hỏi điểm (lựa chọn không hợp lệ?).`);
      if (kieu !== 'goc') {
        tra.do_ = await doKhoang(diem, mong || null, viec);
        if (!D.busy()) throw new Error(`Lệnh ${ten}: lời nhắc chọn khoảng trống bị đóng giữa chừng (có thao tác khác chen vào?).`);
        // ngay trước khi trả lời (cùng một nhịp, không chờ gì nữa): hình mới nhất + điểm chuột đúng chỗ — người dùng có thể vừa rê chuột thật qua vùng vẽ
        if (viec && viec.hien) viec.hien();
        veNgay(); datChuot(diem); sua(st);
      } else if (viec && viec.truoc_diem) {
        // LEFTRIGHTBOARD có chế độ "đặt theo phòng" (DrawLeftRight.InsertByPoint): lời nhắc dò tia chuột (Raycast) ngay lúc mở và mỗi lần chuột rê;
        // tia đang trúng một đối tượng PHÒNG (sàn, tường — RoomBase) thì Chenfeng đặt thùng theo chỗ chuột trên mặt đó và BỎ QUA toạ độ gõ vào
        // (đo trên bản thật 04/10/2026: chuột để trên sàn phòng → thùng nhảy về giữa chỗ chuột, lệch chỗ đặt 6 m).
        // → trước khi gõ điểm: quay nhìn thẳng vào đúng vùng sẽ vẽ rồi rê chuột tới đó, để tia chuột không trúng gì của phòng.
        await viec.truoc_diem();
        if (!D.busy()) throw new Error(`Lệnh ${ten}: lời nhắc đặt thùng bị đóng giữa chừng (có thao tác khác chen vào?).`);
      }
      D.input(toaDo(diem));
      if (!(await cho(() => !D.busy(), 20000))) { await D.cancel(); throw new Error(`Lệnh ${ten}: Chenfeng không kết thúc lệnh sau khi nhận điểm.`); }
    } catch (e) { tra(); throw e; }
    return tra;
  };
  /** Lệnh DOOR: chọn sẵn 4 tấm kẹp khoang → gọi lệnh → từ khoá S (框选: dùng các tấm đang chọn làm khoảng kẹp) → hộp thoại "门板" → ghi lựa chọn → OK. */
  const chayCua = async (b, kep) => {
    if (D.busy()) await D.cancel();
    D.boManChe();
    try { ed().SelectCtrl.Cancel(); } catch (e) { /* bỏ qua */ }
    D.select(kep);
    await sleep(150);
    D.cmd('DOOR');
    if (!(await cho(() => D.busy(), 7000))) throw new Error('Lệnh DOOR: Chenfeng không hỏi khoảng trống.');
    D.input('S');
    let m = null; await cho(() => !!(m = hopGoc()) && m.store && m.store.doorDrawersInfo, 9000);
    if (!m || !m.store.doorDrawersInfo) { if (D.busy()) await D.cancel(); throw new Error('Lệnh DOOR: chọn 4 tấm kẹp khoang xong Chenfeng không mở hộp thoại cánh (khoảng kẹp không hợp lệ?).'); }
    const st = m.store, ui = st.UIOption || st.m_UiOption, lanDau = !daMoGoc.has('DOOR');
    let truoc = '', giong = 0;
    await cho(() => { const now = JSON.stringify([st.m_Option, st.configName]); giong = now === truoc ? giong + 1 : 0; truoc = now; return giong >= (lanDau ? 8 : 3) && (!lanDau || (st.configsNames && st.configsNames.length > 0)); }, lanDau ? 6000 : 2500);
    daMoGoc.add('DOOR');
    const luu = {}; for (const k of ['m_Option', 'm_UiOption']) if (st[k] && typeof st[k] === 'object') { try { luu[k] = JSON.parse(JSON.stringify(st[k])); } catch (e) { /* bỏ qua */ } }
    const tra = () => { for (const k of Object.keys(luu)) { try { Object.assign(st[k], luu[k]); } catch (e) { /* bỏ qua */ } } };
    try {
      // trùm ra (ext) ≥ 0; phần âm đưa sang "khe hở" (space) — hộp thoại cộng trùm ra rồi trừ khe hở
      const tach = v => (v >= 0 ? [soLC(v), '0'] : ['0', soLC(-v)]);
      const [lE, lS] = tach(b.ext.trai), [rE, rS] = tach(b.ext.phai), [tE, tS] = tach(b.ext.tren), [dE, dS] = tach(b.ext.duoi);
      ganLC(st.m_Option, ui, { col: b.so, row: 1, isAllSelect: true, topOffset: 0, bottomOffset: 0, doorPosType: 0, offset: '0', leftExt: lE, leftSpace: lS, rightExt: rE, rightSpace: rS, topExt: tE, topSpace: tS, bottomExt: dE, bottomSpace: dS, midSpace: soLC(b.khe), thickness: soLC(b.day), useBoardRoomCabinetName: true, changeTemplateBoardNameOfOpenDir: true });
      if (ui) { ui.col = String(b.so); ui.row = '1'; }
      if (typeof st.CalcInfos === 'function') { try { st.CalcInfos(); } catch (e) { /* bỏ qua */ } }
      await sleep(80);
      try { (st.doorDrawersInfo || []).forEach(d => { if (d.row === 0 && b.mo[d.col]) d.openDir = b.mo[d.col]; }); } catch (e) { /* bỏ qua */ }
      m.ok.click();
    } catch (e) { tra(); throw e; }
    return tra;
  };
  // lựa chọn của từng loại lệnh theo một bước của kế hoạch
  const LUA_CHON = {
    LR: (st, b, o) => {
      ganLC(st.m_Option, st.m_UiOption, { height: b.cao, width: b.sau, thickness: b.day, spaceSize: b.rong, leftShrink: 0, rightShrink: 0, leftBackShrink: 0, leftFrontExt: 0, leftBottomExt: 0, rightBackShrink: 0, rightFrontExt: 0, rightBottomExt: 0, leftBoardName: b.ten[0], rightBoardName: b.ten[1] });
      ganLC(st.m_BoardProcessOption, st.ui_BoardProcessOption, { roomName: b.phong || '', cabinetName: b.tu || '', boardName: '' });
      if (st.m_BoardProcessOption) st.m_BoardProcessOption.useBoardProcessOption = false;
      ganKhoan(st, b.khoan);
      if (st.autoCutOption) { st.autoCutOption.isAutoCut = false; st.autoCutOption.isRelevance = false; }
    },
    VE: (st, b) => {
      ganLC(st.m_Option, st.m_UiOption, { name: b.ten, frontShrink: 0, bottomShrink: 0, calcFrontShrink: '0', calcBottomShrink: '0', isTotalLength: true, isTotalWidth: true, boardRelative: 'left', thickness: b.day, exprThickness: soLC(b.day), count: 1, exprCount: '1', spaceSize: b.cach, calcSpaceSize: soLC(b.cach), cuttingProtrudingPart: false });
    },
    TB: (st, b) => {
      const chung = { isDraw: true, isWrapSide: false, frontDist: 0, behindDistance: 0, leftExt: 0, rightExt: 0 };
      ganLC(st.topBoardOption, st.topUiOption, Object.assign({}, chung, { name: b.noc.ten, thickness: b.noc.day, offset: b.noc.ha }));
      ganLC(st.bottomBoardOption, st.bottomUiOption, Object.assign({}, chung, { name: b.day_.ten, thickness: b.day_.day, offset: b.day_.nang, footThickness: b.day_.day, isDrawFooter: false, isDrawBackFooter: false, isDrawStrengthenStrip: false }));
    },
    BE: (st, b) => {
      ganLC(st.m_Option, st.m_UiOption, { name: b.ten, leftExt: b.ext.trai, rightExt: b.ext.phai, topExt: b.ext.tren, bottomExt: b.ext.duoi, thickness: b.day, exprThickness: soLC(b.day), boardPosition: 'all', moveDist: 0, calcMoveDist: '0', boardRelative: 'back', spaceSize: b.lui, calcSpaceSize: soLC(b.lui), count: 1, exprCount: '1' });
    },
    LY: (st, b) => {
      ganLC(st.m_Option, st.m_UiOption, { name: b.ten, frontShrink: b.lui_truoc || 0, calcFrontShrink: soLC(b.lui_truoc || 0), leftShrink: 0, rightShrink: 0, calcLeftShrink: '0', calcRightShrink: '0', isTotalLength: true, boardRelative: 'bottom', thickness: b.day, exprThickness: soLC(b.day), count: 1, exprCount: '1', spaceSize: b.cach, calcSpaceSize: soLC(b.cach), isActive: false, cuttingProtrudingPart: false });
    },
  };
  // kiểu khoan của tấm sắp vẽ: theo thiết kế (kiểu khoan của xưởng / không khoan cho hậu phủ); kiểu không có trong Chenfeng thì giữ cấu hình của người dùng
  const ganKhoan = (st, khoan) => {
    if (!khoan || !st.m_BoardProcessOption) return;
    if (khoan !== Core.KHONG_KHOAN && !D.drillTypes().includes(khoan)) return;
    st.m_BoardProcessOption.drillType = khoan; if (st.ui_BoardProcessOption && 'drillType' in st.ui_BoardProcessOption) st.ui_BoardProcessOption.drillType = khoan;
    if (st.rectDrillOption) for (const k of ['up', 'down', 'left', 'right']) st.rectDrillOption[k] = khoan;
    if (Array.isArray(st.m_BoardProcessOption.highDrill)) st.m_BoardProcessOption.highDrill = [khoan, khoan, khoan, khoan];
  };
  const TEN_LENH_GOC = { LR: 'LEFTRIGHTBOARD', VE: 'VERTIALBOARD', TB: 'TOPBOTTOMBOARD', BE: 'BEHINDBOARD', LY: 'LAYERBOARD', DO: 'DOOR' };
  const TEN_BUOC = { LR: 'hồi', VE: 'vách', TB: 'nóc + đáy', BE: 'hậu', LY: 'đợt', DO: 'cánh' };

  /* ------------------------------------------------------------------ *
   * KHUNG ĐẶT (bản 1.16): tủ nằm ở đâu và QUAY hướng nào trên bản vẽ.
   * Lệnh gốc của Chenfeng chỉ dựng tủ thẳng trục, và lệnh ROTATE không xoay được cây mẫu gốc. Đã đo (Chenfeng 2026-09-20): áp một ma trận thẳng lên MỌI đối tượng
   * của tủ (`ApplyMatrix`, như chính lệnh ROTATE / MOVE làm) thì cả tủ dời + xoay được, `UpdateTemplateTree` sau đó vẫn giữ, đổi L / W / H ở tư thế đã xoay vẫn đúng.
   * → tủ luôn được vẽ thẳng trục ở một chỗ trống rồi đưa về chỗ đặt bằng một ma trận (1 bước hoàn tác).
   * kh = { goc: [x, y, z] góc trái – trước – dưới của tủ, xoay: độ (ngược chiều kim đồng hồ, trục x của tủ so với trục x bản vẽ), G / Gn: ma trận và nghịch đảo }
   * ------------------------------------------------------------------ */
  const quayZ = (p, do_) => { const r = (do_ || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]; };
  const apM = (m, p) => { const e = m.elements; return [e[0] * p[0] + e[4] * p[1] + e[8] * p[2] + e[12], e[1] * p[0] + e[5] * p[1] + e[9] * p[2] + e[13], e[2] * p[0] + e[6] * p[1] + e[10] * p[2] + e[14]]; };
  const lopM4 = () => ed().UCSMatrix.constructor;
  D.taoKhung = (goc, xoay) => { const C = lopM4(), G = new C().makeRotationZ((xoay || 0) * Math.PI / 180); G.setPosition(goc[0], goc[1], goc[2]); return { goc: goc.map(r2), xoay: xoay || 0, G, Gn: new C().getInverse(G) }; };
  /** Hộp bao của một đối tượng tính trong hệ của khung (gốc = góc tủ, trục theo tủ). kh = null → hộp bao theo bản vẽ. */
  D.hopTheo = (e, kh) => {
    if (!kh) return D.boxOf(e);
    try { const b = e.GetBoundingBoxInMtx(kh.Gn); return [r2(b.min.x), r2(b.max.x), r2(b.min.y), r2(b.max.y), r2(b.min.z), r2(b.max.z)]; }
    catch (err) {      // đối tượng không có GetBoundingBoxInMtx: đưa 8 góc hộp bao bản vẽ về hệ khung (rộng hơn thật khi tủ xoay lẻ)
      const x = D.boxOf(e), m = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity];
      for (const a of [x[0], x[1]]) for (const b of [x[2], x[3]]) for (const c of [x[4], x[5]]) { const q = apM(kh.Gn, [a, b, c]); for (let i = 0; i < 3; i++) { m[2 * i] = Math.min(m[2 * i], q[i]); m[2 * i + 1] = Math.max(m[2 * i + 1], q[i]); } }
      return m.map(r2);
    }
  };
  /** Khung của MODULE chứa tấm b (gốc module = góc nhỏ nhất của tủ, kể cả khi tủ đã bị dời / xoay bằng lệnh của Chenfeng). null nếu tủ không phải module. */
  D.khungCua = b => {
    try {
      const T = rootTpl(b); if (!T || !T.LParam || typeof T.GetTemplateRealitySpaceCS !== 'function') return null;
      if (T.Name === '左右侧板模板' || /LeftRightBoard/.test((T.constructor && T.constructor.name) || '')) return null;
      const e = T.GetTemplateRealitySpaceCS().elements;
      if (Math.abs(e[2]) > 1e-6 || Math.abs(e[6]) > 1e-6 || Math.abs(e[10] - 1) > 1e-6) return null;      // module bị lật / nghiêng: không phải tủ đứng
      const a = Math.atan2(e[1], e[0]) * 180 / Math.PI;
      return D.taoKhung([e[12], e[13], e[14]], Math.abs(a) < 1e-4 ? 0 : Math.round(a * 1e4) / 1e4);
    } catch (err) { return null; }
  };
  /** Dời + xoay một nhóm đối tượng bằng một ma trận — 1 bước hoàn tác. Sau đó cập nhật lại các mẫu gốc để mẫu con bám theo vị trí mới. */
  D.apMaTran = async (ents, Mx, ten) => {
    const live = (ents || []).filter(e => e && !e.IsErase && typeof e.ApplyMatrix === 'function');
    if (!live.length) return { ok: true, steps: 0 };
    if (D.busy()) await D.cancel();
    try { ed().SelectCtrl.Cancel(); } catch (e) { /* bỏ qua */ }
    const h0 = hmMark(); let mo = false, loi = '';
    try { const h = hm(); if (h && typeof h.StartCmd === 'function' && typeof h.EndCmd === 'function') { h.StartCmd(ten || 'MNCF_DAT'); mo = true; } } catch (e) { mo = false; }
    try {
      for (const e of live) e.ApplyMatrix(Mx);
      const goc = new Set(); for (const e of live) if (D.isBoard(e)) { const r = rootTpl(e); if (r && typeof r.UpdateTemplateTree === 'function') goc.add(r); }
      for (const T of goc) { try { await T.UpdateTemplateTree(); } catch (e) { /* mẫu lỗi thì giữ hình học đã áp ma trận */ } }
    } catch (e) { loi = String(e && e.message || e); }
    if (mo) { try { hm().EndCmd(); } catch (e) { /* bỏ qua */ } }
    await D.settle(300, 15000);
    try { root.app.Viewer.UpdateRender(); } catch (e) { /* bỏ qua */ }
    const h1 = hmMark();
    return { ok: !loi, reason: loi, steps: h0 && h1 && h1.i > h0.i ? h1.i - h0.i : (mo && !loi ? 1 : 0) };
  };
  /** Xoay nhóm đối tượng quanh trục đứng qua `goc` (độ, dương = ngược chiều kim đồng hồ) — dùng cho tủ vẽ theo cách nhập tấm. */
  D.xoayQuanh = async (ents, goc, do_) => {
    if (!do_) return { ok: true, steps: 0 };
    const C = lopM4(), Mx = new C().makeRotationZ(do_ * Math.PI / 180); Mx.setPosition(goc[0], goc[1], goc[2]); Mx.multiply(new C().setPosition(-goc[0], -goc[1], -goc[2]));
    return D.apMaTran(ents, Mx, 'MNCF_XOAY');
  };

  /* ------------------------------------------------------------------ *
   * MẪU KHO VÀO BẢN VẼ (bản 1.19 — anh Jason 03/10/2026 20:49: "vách tivi … vách đầu giường chọn các module sẵn, chia ô ra rồi chọn vào từng khu vực";
   *   20:52: "chọn khu vực là tủ áo thì hiện lên các mẫu thư viện luôn"; 23:18: "chọn từ extension rồi nhập kích thước kéo vào").
   * Đã đo trên Chenfeng 04/10/2026:
   *   - cổng nhập nhận mục { Type: 'Template', TempalteId, BoxSize: [L, W, H], Pos } → Chenfeng tải mẫu của kho, đặt L / W / H rồi dựng cả cây mẫu
   *     (bộ tủ 222 tấm mất ~80 giây khi tab bị che); khung module sau đó đúng bằng L × W × H;
   *   - điểm đặt của cổng nhập là góc nhỏ nhất của CẢ CỤM kể cả tay nắm nhô ra trước mặt cánh → gốc module lệch khỏi điểm gõ: phải đo lại rồi dời bằng ma trận;
   *   - mẫu của cửa hàng mang kiểu khoan không có trong cấu hình tài khoản (三合一) → Chenfeng không khoan: đổi sang kiểu khoan của xưởng rồi khoan lại (D.finalize);
   *   - cả module dời + xoay được bằng một ma trận (D.apMaTran), khung module đi theo, đổi L / W / H sau đó vẫn đúng.
   * Cách làm: dựng mẫu THẲNG TRỤC ở một chỗ trống → (tuỳ chọn) dày ván + hậu phủ sau theo chuẩn xưởng → chỉnh L / W / H cho các TẤM vừa đúng kích thước yêu cầu
   *   (mẫu có cánh phủ ngoài thùng thì hộp các tấm lớn hơn L × W × H) → kiểu khoan → tên tấm tiếng Việt → đưa về chỗ đặt (dời + xoay) bằng một ma trận.
   * opt: { id, ten, rong, sau, cao (kích thước phủ bì của các tấm), corner: [x, y, z] góc trái – trước – dưới (bỏ trống = hỏi bấm điểm), xoay (độ),
   *        phong, ma (tên phòng / mã tủ ghi vào tấm), day (dày ván xưởng, 0 = giữ), hau (dày hậu phủ sau, 0 = giữ kết cấu mẫu), mep, khoan (kiểu khoan xưởng), ten_viet, onStatus }
   * ------------------------------------------------------------------ */
  const hopNhieu = (ds, kh) => { const m = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity]; for (const e of ds) { let x; try { x = D.hopTheo(e, kh); } catch (er) { continue; } if (!x.every(isFinite)) continue; for (let i = 0; i < 6; i += 2) { m[i] = Math.min(m[i], x[i]); m[i + 1] = Math.max(m[i + 1], x[i + 1]); } } return m.map(r2); };
  /** Tên tấm của mẫu kho (tiếng Trung) → tên tiếng Việt để ghi vào bản vẽ. Không nhận ra thì trả nguyên tên cũ. */
  D.tenTamMoi = t => {
    t = String(t || '').trim();
    if (!/[㐀-鿿]/.test(t)) return t;
    for (const [a, b] of TEN_TAM) {
      const k = t.indexOf(a); if (k < 0) continue;
      const truoc = t.slice(0, k), sau = t.slice(k + a.length);
      const vi = s => s.replace(/[（(]\s*自动\s*[)）]/g, ' (tự động)').replace(/左/g, ' trái').replace(/右/g, ' phải').replace(/上/g, ' trên').replace(/下/g, ' dưới').replace(/中/g, ' giữa').replace(/前/g, ' trước').replace(/后/g, ' sau').replace(/[（]/g, '(').replace(/[）]/g, ')');
      const tr = vi(truoc), sa = vi(sau);
      if (/[㐀-鿿]/.test(tr + sa)) return `${b} (${t})`;      // còn chữ chưa dịch được: giữ tên gốc trong ngoặc
      return (b + (tr ? ' ' + tr.trim() : '') + (sa ? (/^[\s(]/.test(sa) ? '' : ' ') + sa : '')).replace(/\s+/g, ' ').trim();
    }
    return t;
  };
  const veKhoImpl = async (opt) => {
    opt = Object.assign({ xoay: 0, ten_viet: true, day: 0, hau: 0, mep: 1, khoan: '', onStatus() {} }, opt || {});
    opt.onStatus = guard(opt.onStatus);
    const warnings = [], notes = [];
    const hong = t => ({ ok: false, kho: true, giai_doan: 'nhap', errors: [t], warnings, notes });
    const id = Math.round(Number(opt.id)) || 0;
    if (!(id > 0)) return hong('Chưa chọn mẫu kho.');
    const kt = [opt.rong, opt.sau, opt.cao].map(v => r2(Number(v)));
    if (!kt.every(v => v >= 20 && v <= 30000)) return hong('Kích thước rộng / sâu / cao để vẽ mẫu chưa hợp lệ.');
    if (!D.available()) return hong('Không thấy Chenfeng trong trang này.');
    if (!D.editing()) return hong('Chenfeng chưa ở màn hình vẽ (đang ở trang chủ hoặc có cửa sổ che kín vùng vẽ) — mở bản vẽ rồi bấm lại.');
    const n3 = a => Array.isArray(a) && a.length === 3 && a.every(v => typeof v === 'number' && isFinite(v));
    const xoay = Number(opt.xoay) || 0, ten = String(opt.ten || 'Mẫu kho').trim().slice(0, 60);
    let goc;
    if (opt.corner) { if (!n3(opt.corner)) return hong('Toạ độ đặt mẫu phải là 3 số [x, y, z].'); goc = opt.corner.map(r2); }
    else {
      opt.onStatus('Bấm 1 điểm trên bản vẽ để đặt mẫu (góc trái – trước – dưới).');
      goc = await D.hoiDiem('Một Nhà: bấm điểm đặt mẫu kho (góc trái - trước - dưới):');
      if (!goc) return hong('Đã huỷ — chưa vẽ gì.');
    }
    // CHỖ DỰNG: bên phải mọi thứ đang có 6 m (hộp các tấm đo ở đó không lẫn tấm khác; chuẩn hoá hậu cần module thẳng trục)
    let mx = -Infinity;
    for (const e of D.all()) { try { const b = e.BoundingBox; if (b && isFinite(b.max.x) && Math.abs(b.max.x) < 1e7) mx = Math.max(mx, b.max.x); } catch (er) { /* bỏ qua đối tượng không có hộp bao */ } }
    const X0 = isFinite(mx) ? Math.ceil((mx + 6000) / 500) * 500 : 0;
    const h0 = hmMark();
    const truocVe = new Set(root.app.Database.ModelSpace.Entitys);
    const cuaToi = () => root.app.Database.ModelSpace.Entitys.filter(e => e && !e.IsErase && !truocVe.has(e));
    const errors = [];
    const xong = (gd, them) => {
      const added = cuaToi(), h1 = hmMark(), steps = h0 && h1 && h1.i > h0.i ? h1.i - h0.i : (added.length ? 1 : 0);
      if (added.length) D.last = { added, steps, mark: h1, kho: true };
      opt.onStatus(errors.length ? 'Có lỗi — xem thẻ Kết quả.' : 'Xong.');
      return Object.assign({ ok: errors.length === 0, kho: true, giai_doan: gd, errors, warnings, notes, so_buoc_hoan_tac: steps, mau: { id, ten }, yeu_cau: kt.slice(), goc, xoay_do: xoay, khung: { goc, xoay } }, them || {});
    };
    // 1. NHẬP mẫu qua cổng 晨丰导入, thẳng trục
    opt.onStatus(`Đang tải mẫu “${ten}” từ kho Chenfeng…`);
    let res;
    try {
      res = await D.importCF({ ModelSpace: [{ Type: 'Template', TempalteId: id, Name: ten, BoxSize: kt.slice(), Pos: [0, 0, 0], RoomName: String(opt.phong || ''), CabinetName: String(opt.ma || ten).slice(0, 40), ParamMap: [] }] },
        [X0, 0, 0], { onStatus: opt.onStatus, timeout: 300000, timeout_khoan: 420000, bao_tai: `Chenfeng đang tải và dựng mẫu “${ten}” — mẫu nhiều tấm có thể mất 1–2 phút (để tab Chenfeng mở trên màn hình cho nhanh)…` });
    } catch (e) { errors.push(String(e && e.message || e)); return xong(cuaToi().length ? 'xong' : 'nhap'); }
    if (res.cancelled || !cuaToi().length) { errors.push('Chenfeng không dựng được mẫu này (lệnh nhập bị huỷ, hoặc mẫu không còn trong kho của tài khoản) — chưa vẽ gì.'); return xong('nhap'); }
    const tamCua = () => cuaToi().filter(D.isBoard);
    let boards = tamCua();
    const T = boards.length ? rootTpl(boards[0]) : null;
    const vat = () => { const b = tamCua(); return b.length ? b : cuaToi().filter(e => { try { return isFinite(e.BoundingBox.min.x) && !D.isHole(e); } catch (er) { return false; } }); };
    const khM = () => (boards.length ? D.khungCua(boards[0]) : null);
    if (!boards.length) notes.push('Mẫu này không có tấm ván (mô hình trang trí / phụ kiện): bảng chỉ đặt đúng chỗ, không chỉnh ván, không khoan.');
    // 2. DÀY VÁN theo xưởng (tham số BH của module) — trước khi đo, vì đổi dày ván có thể làm đổi phủ bì
    let dv = null;
    if (boards.length && opt.day > 0) {
      try { dv = await D.dayVan(boards[0], opt.day, { onStatus: opt.onStatus }); } catch (e) { dv = { ok: false, ly_do: String(e && e.message || e).slice(0, 160) }; }
      if (dv.ok && !dv.da_dung) notes.push(`Dày ván: ${dv.tu} → ${dv.day} cho ${dv.doi} tấm (tham số BH của module).${dv.con ? ` Còn ${dv.con} tấm vẫn dày ${dv.tu} (${dv.ten_con.slice(0, 5).join(', ')}) — tham số của mẫu không nối tới các tấm này, đổi tay nếu cần.` : ''}`);
      else if (!dv.ok) notes.push('Dày ván giữ nguyên như mẫu: ' + dv.ly_do);
      boards = tamCua();
    }
    // 3. HẬU PHỦ SAU theo chuẩn xưởng (module đang thẳng trục — xoay rồi thì không chuẩn hoá được)
    let ch = null;
    if (boards.length && opt.hau > 0) {
      try { ch = await D.chuanHoa((dv && dv.tam && !dv.tam.IsErase && dv.tam) || boards[0], { hau: opt.hau, mep: opt.mep, khoan: opt.khoan, khoan_lai: false, onStatus: opt.onStatus }); } catch (e) { ch = { ok: false, ly_do: String(e && e.message || e).slice(0, 200) }; }
      if (ch.ok && ch.da_chuan) notes.push((ch.ghi_chu || [])[0] || 'Hậu của mẫu đã phủ sau lưng sẵn.');
      else if (ch.ok) { notes.push(`Hậu: ${ch.so_hau} tấm chuyển thành hậu ${r2(opt.hau)} li phủ sau lưng thùng (lùi mép ${r2(opt.mep)}), không khoan${ch.sua_mep_sau && ch.sua_mep_sau.length ? `; mép sau của ${ch.sua_mep_sau.length} tấm thùng lùi lại cho hậu phủ lên` : ''}${ch.xoa_giang ? `; đã bỏ ${ch.xoa_giang} thanh giằng sau hậu` : ''}.`); for (const g of (ch.ghi_chu || [])) warnings.push(g); }
      else warnings.push('Hậu giữ nguyên kết cấu của mẫu (chưa chuyển được sang hậu phủ sau): ' + ch.ly_do);
      boards = tamCua();
    }
    // 4. VỪA KÍCH THƯỚC: hộp của các TẤM (trong hệ module) phải đúng rộng × sâu × cao yêu cầu.
    //    Mẫu có cánh / tấm phủ ngoài khung module thì hộp các tấm lớn hơn L × W × H → chỉnh tham số trục đó đúng bằng phần dư rồi đo lại.
    //    Trục nào chỉnh rồi mà các tấm vẫn không về đúng số (mẫu có phần CỐ ĐỊNH theo trục đó — đo trên "Tủ giày 10" của kho: 2 tấm sâu cố định 350) → trả tham số trục đó
    //    về số yêu cầu, không để module lệch nửa vời (thùng nông đi mà tấm cố định vẫn thò ra).
    let kh = khM(), hop = hopNhieu(vat(), kh);
    const tran = () => [r2(hop[1] - hop[0]), r2(hop[3] - hop[2]), r2(hop[5] - hop[4])];
    const lech = () => tran().map((v, i) => r2(kt[i] - v));
    let vua = null;
    if (T && boards.length && lech().some(d => Math.abs(d) > 0.6)) {
      const ps = [T.LParam, T.WParam, T.HParam];
      if (ps.every(p => p && isFinite(Number(p.value)))) {
        const cu = ps.map(p => r2(Number(p.value))), d0 = lech(), moi = cu.map((v, i) => (Math.abs(d0[i]) > 0.6 ? r2(v + d0[i]) : v));
        if (moi.every(v => v > 20)) {
          opt.onStatus(`Chỉnh kích thước module cho vừa: ${moi.join(' × ')}…`);
          let mo = false, loi = '', den = cu.slice();
          try { const h = hm(); if (h && typeof h.StartCmd === 'function' && typeof h.EndCmd === 'function') { h.StartCmd('MNCF_VUA'); mo = true; } } catch (e) { mo = false; }
          const cay = []; (function di(t, n) { if (!t || cay.includes(t) || n > 8) return; cay.push(t); for (const c of (t.Children || [])) di(idOf(c), n + 1); })(T, 0);
          for (const b of boards) { try { b.WriteAllObjectRecord(); } catch (e) { /* bỏ qua */ } }
          for (const t of cay) { try { if (typeof t.WriteAllObjectRecord === 'function') t.WriteAllObjectRecord(); } catch (e) { /* bỏ qua */ } }
          const dat = async gt => { ps.forEach((p, i) => { if (r2(Number(p.value)) !== gt[i] || (p.expr !== '' && p.expr != null && Number(p.expr) !== gt[i])) p.expr = String(gt[i]); }); await T.UpdateTemplateTree(); await sleep(300); boards = tamCua(); kh = khM(); hop = hopNhieu(vat(), kh); den = gt.slice(); };
          try {
            await dat(moi);
            const d1 = lech(), tra = moi.map((v, i) => (v !== cu[i] && Math.abs(d1[i]) > 0.6 ? cu[i] : v));
            if (tra.some((v, i) => v !== moi[i])) await dat(tra);
          } catch (e) { loi = String(e && e.message || e).slice(0, 120); }
          if (mo) { try { hm().EndCmd(); } catch (e) { /* bỏ qua */ } }
          await D.settle(500, 60000);
          boards = tamCua(); kh = khM(); hop = hopNhieu(vat(), kh);
          vua = { tu: cu, den, loi };
          if (loi) warnings.push('Chenfeng báo lỗi khi chỉnh kích thước module: ' + loi);
          else if (den.some((v, i) => v !== cu[i])) notes.push(`Kích thước module (L × W × H) chỉnh từ ${cu.join(' × ')} thành ${den.join(' × ')} để các tấm vừa đúng ${kt.join(' × ')} (mẫu có phần phủ ra ngoài khung module, vd cánh phủ trước thùng).`);
        }
      }
    }
    {
      const d = lech(), tr = tran(), TEN = ['rộng', 'sâu', 'cao'], khac = TEN.map((t, i) => (Math.abs(d[i]) > 0.6 ? `${t} ${tr[i]} (yêu cầu ${kt[i]})` : '')).filter(Boolean);
      if (khac.length) warnings.push(`Mẫu này không co giãn đúng theo kích thước yêu cầu: các tấm đang chiếm ${khac.join(', ')} — mẫu có phần kích thước cố định, hoặc cánh / tấm phủ ngoài khung module mà tham số của mẫu không bù được. Lưng, mép trái và đáy vẫn đặt đúng chỗ; phần chênh nằm ở phía trước / bên phải / phía trên. Chỉnh tiếp ở ô Thông số của Chenfeng.`);
    }
    // 5. KIỂU KHOAN: mẫu của cửa hàng mang kiểu khoan không có trong cấu hình tài khoản → đổi sang kiểu của xưởng, khoan lại (cũng là lần khoan sau khi đổi dày ván / hậu / kích thước)
    let fix = null;
    if (boards.length) {
      const daDoi = !!(vua || (dv && dv.ok && !dv.da_dung) || (ch && ch.ok && !ch.da_chuan));
      const kq = opt.khoan || D.drillTypes()[0] || '';
      try { fix = await D.finalize(boards, kq, { ep: daDoi, kem: boards.filter(b => { try { return (b.BoardProcessOption.highDrill || []).every(x => !x || x === Core.KHONG_KHOAN); } catch (e) { return false; } }), onStatus: opt.onStatus }); } catch (e) { fix = { fixed: 0, normalized: 0, reason: String(e && e.message || e).slice(0, 160) }; }
      if (fix.fixed) notes.push(`Kiểu khoan của mẫu (${(fix.old || []).join(', ')}) không có trong cấu hình tài khoản: đã đổi sang ${fix.to} cho ${fix.fixed} tấm rồi cho Chenfeng khoan lại.`);
      if (fix.reason) warnings.push(fix.reason);
      boards = tamCua();
    }
    // 6. TÊN TẤM tiếng Việt (sau chuẩn hoá — bước đó nhận tấm hậu / cánh theo tên gốc) — 1 bước lịch sử riêng
    let doiTen = 0;
    if (opt.ten_viet && boards.length) {
      const ds = []; for (const b of boards) { const cu = String(b.Name || ''), moi = D.tenTamMoi(cu); if (moi && moi !== cu) ds.push([b, moi]); }
      if (ds.length) {
        let mo = false;
        try { const h = hm(); if (h && typeof h.StartCmd === 'function' && typeof h.EndCmd === 'function') { h.StartCmd('MNCF_TENTAM'); mo = true; } } catch (e) { mo = false; }
        for (const [b, moi] of ds) { try { b.Name = moi; doiTen++; } catch (e) { /* bỏ qua */ } }
        if (mo) { try { hm().EndCmd(); } catch (e) { /* bỏ qua */ } }
      }
    }
    // 7. ĐƯA VỀ CHỖ ĐẶT (dời + xoay quanh trục đứng) — 1 bước hoàn tác. Neo theo LƯNG: mép trái, đáy và mặt SAU của hộp các tấm về đúng mép trái, đáy và
    //    mặt sau của chỗ đặt (lưng tủ là thứ áp tường) — mẫu sâu hơn yêu cầu thì phần dư nhô ra phía trước, không đâm vào tường.
    await D.settle(400, 20000);
    kh = khM(); hop = hopNhieu(vat(), kh);
    const neo = [hop[0], r2(hop[3] - kt[1]), hop[4]];
    const p0 = kh ? apM(kh.G, neo) : neo;
    let dat = null, hopCuoi = null;
    if (p0.every(isFinite)) {
      opt.onStatus(xoay ? `Đưa mẫu về chỗ đặt, xoay ${r2(xoay)}°…` : 'Đưa mẫu về chỗ đặt…');
      try {
        const C = lopM4(), nguon = D.taoKhung(p0, kh ? kh.xoay : 0), Mx = new C().makeRotationZ(xoay * Math.PI / 180);
        Mx.setPosition(goc[0], goc[1], goc[2]); Mx.multiply(nguon.Gn);
        dat = await D.apMaTran(cuaToi(), Mx, 'MNCF_DAT');
        if (dat.ok) {
          hopCuoi = hopNhieu(vat(), D.taoKhung(goc, xoay));
          const lc = [hopCuoi[0], r2(hopCuoi[3] - kt[1]), hopCuoi[4]];
          if (lc.some(v => Math.abs(v) > 0.6)) errors.push(`Đưa mẫu về chỗ đặt xong bị lệch (mép trái / lưng / đáy cách chỗ đặt ${lc.join(' / ')}) — hoàn tác rồi vẽ lại.`);
        } else errors.push(`Mẫu đã dựng xong ở chỗ trống (x ≈ ${r2(p0[0])}) nhưng chưa đưa được về chỗ đặt: ${dat.reason} — dùng lệnh MOVE của Chenfeng để dời.`);
      } catch (e) { errors.push(`Chưa đưa được mẫu về chỗ đặt: ${e && e.message || e}`); }
    } else errors.push('Không đo được hộp bao của mẫu vừa dựng — mẫu đang nằm ở chỗ dựng tạm, dùng lệnh MOVE của Chenfeng để dời.');
    const tat = cuaToi(), ten_tam = {};
    for (const b of tat.filter(D.isBoard)) { const t = String(b.Name || ''); ten_tam[t] = (ten_tam[t] || 0) + 1; }
    const dl = tat.some(D.isBoard) ? doLoiSauVe(tat, errors, opt.kho || null) : null;
    return xong('xong', { do_loi: dl, so_tam: tat.filter(D.isBoard).length, so_phu_kien: tat.filter(D.isHardware).length, so_lo: tat.filter(D.isHole).length, kich: hopCuoi ? [r2(hopCuoi[1] - hopCuoi[0]), r2(hopCuoi[3] - hopCuoi[2]), r2(hopCuoi[5] - hopCuoi[4])] : tran(),
      hop: hopCuoi, vua, day_van: dv, chuan_hoa: ch, sua_khoan: fix, doi_ten: doiTen, ten_tam, dat, module: T ? String(T.Name || '') : '', la_module: !!kh });
  };
  /** Vẽ một mẫu của kho Chenfeng vào bản vẽ theo kích thước + chỗ đặt (xem chú thích ở trên). Giữ Web Lock như D.draw để tab nền không bị đóng băng giữa chừng. */
  D.veKho = async (opt) => {
    D.boManChe();
    let res, ran = false;
    const run = async () => { ran = true; res = await veKhoImpl(opt); return res; };
    try {
      const nav = root.navigator;
      if (nav && nav.locks && typeof nav.locks.request === 'function') { await nav.locks.request('mncf-ve-tu', { mode: 'shared' }, run); return res; }
    } catch (e) { if (ran) throw e; }
    return run();
  };

  /* ------------------------------------------------------------------ *
   * ĐỌC HÌNH NGƯỜI DÙNG VẼ TRÊN BẢN VẼ (bản 1.16 — anh Jason 03/10/2026 20:44: "vẽ hình lên không gian mặt bằng rồi chọn vẽ tủ").
   * Hình chữ nhật (RECTANG) / đa tuyến (POLYLINE) của Chenfeng là `Polyline`: `LineData[{pt: {x, y}, bul}]` trong hệ OCS của nó, `CloseMark`.
   * Vẽ ở hướng nhìn từ trên → pháp tuyến thẳng đứng (hình trên MẶT BẰNG). Nhìn mặt trước + bật Smart UCS + vẽ trên mặt tường → hình bám mặt tường (hình trên MẶT ĐỨNG).
   * ------------------------------------------------------------------ */
  D.docHinh = () => {
    const out = { hinh: [], bo: 0 };
    for (const e of D.selected()) {
      try {
        const ld = e.LineData, m = e.OCS && e.OCS.elements;
        if (!Array.isArray(ld) || ld.length < 3 || !m) { out.bo++; continue; }
        const pts = ld.map(q => apM(e.OCS, [q.pt.x, q.pt.y, 0]));
        const dau = pts[0], cuoi = pts[pts.length - 1], trung = Math.hypot(dau[0] - cuoi[0], dau[1] - cuoi[1], dau[2] - cuoi[2]) < 0.5;
        if (trung && pts.length > 3) pts.pop();
        const phap = [m[8], m[9], m[10]];
        out.hinh.push({ doi_tuong: e, dinh3: pts.map(q => q.map(r2)), kin: e.CloseMark === true || trung, cong: ld.some(q => Math.abs(q.bul || 0) > 1e-6), phap,
          phang: Math.abs(phap[2]) > 0.999 ? 'bang' : Math.abs(phap[2]) < 0.02 ? 'dung' : 'nghieng' });
      } catch (err) { out.bo++; }
    }
    return out;
  };
  /** Tường và cột của phòng đang có trên bản vẽ (thẻ House Design): mặt tường = 2 mặt của từng `RoomWallLine`; cột = hộp bao của `RoomPillar`.
   *  Mỗi mặt tường kèm `ra` = hướng (trên mặt bằng) từ TIM tường ra ngoài mặt đó — tủ áp mặt nào thì quay mặt trước về phía `ra` của mặt đó. */
  D.tuongPhong = () => {
    const tuong = [], cot = [];
    for (const e of D.all()) {
      const lop = tenLop(e);
      try {
        if (lop === 'RoomWallLine') {
          let S = null, E = null; try { S = e.StartPoint; E = e.EndPoint; } catch (er) { S = E = null; }
          for (const c of [].concat(e.LeftCurves || [], e.RightCurves || [])) {
            const a = c.StartPoint, b = c.EndPoint; if (!a || !b) continue;
            const w = { a: [r2(a.x), r2(a.y)], b: [r2(b.x), r2(b.y)], cao: r2(e.Height || 0), z: r2(a.z || 0) };
            if (S && E) {      // chân đường vuông góc từ giữa mặt tường xuống tim tường → hướng ra
              const dx = E.x - S.x, dy = E.y - S.y, L2 = dx * dx + dy * dy, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
              if (L2 > 1) { const t = ((mx - S.x) * dx + (my - S.y) * dy) / L2, nx = mx - (S.x + t * dx), ny = my - (S.y + t * dy), n = Math.hypot(nx, ny); if (n > 1) w.ra = [nx / n, ny / n]; }
            }
            tuong.push(w);
          }
        } else if (lop === 'RoomPillar') { const x = D.boxOf(e); cot.push({ x0: x[0], x1: x[1], y0: x[2], y1: x[3], z0: x[4], z1: x[5] }); }
      } catch (err) { /* bỏ qua đối tượng lạ */ }
    }
    return { tuong, cot };
  };
  /**
   * Hỏi 1 điểm kiểu CAD (bản 1.17): có dây thun từ `opt.goc`, cho Enter không bấm (`opt.cho_enter`), báo vị trí chuột mỗi lần rê (`opt.khi_re([x, y, z])`).
   * Có điểm gốc thì người dùng gõ được MỘT SỐ rồi Enter = điểm cách gốc đúng số đó về phía chuột (Chenfeng tự làm) → trả `go_so` = số đã gõ.
   * @returns {{ diem: number[], chuot: number[]|null, go_so: number|null } | { enter: true, chuot: number[]|null } | null}   null = Esc / lỗi
   */
  D.hoiDiem2 = async (msg, opt) => {
    opt = opt || {};
    if (D.busy()) await D.cancel();
    D.boManChe();
    const o = { Msg: msg || 'Một Nhà: bấm 1 điểm:' };
    let chuot = null;
    const v3 = p => ed().MouseCtrl._CurMousePointVCS.clone().set(p[0], p[1], p[2]);
    if (Array.isArray(opt.goc)) { try { o.BasePoint = v3(opt.goc); o.AllowDrawRubberBand = true; } catch (e) { /* không có dây thun cũng được */ } }
    if (opt.cho_enter) o.AllowNone = true;
    const khiRe = guard(opt.khi_re);
    o.Callback = p => { try { if (p && isFinite(p.x) && isFinite(p.y)) { chuot = [r2(p.x), r2(p.y), r2(p.z || 0)]; khiRe(chuot); } } catch (e) { /* bỏ qua */ } };
    let r = null;
    try { r = await ed().GetPoint(o); } catch (e) { r = null; }
    if (!r) return null;
    if (r.Status === 1 && r.Point && isFinite(r.Point.x) && isFinite(r.Point.y)) {
      const d = [r2(r.Point.x), r2(r.Point.y), r2(r.Point.z || 0)];
      // bấm chuột: điểm trả về chính là điểm chuột vừa báo; gõ số: điểm nằm trên tia gốc → chuột, cách gốc đúng số đã gõ
      let go = null;
      if (Array.isArray(opt.goc) && chuot && Math.hypot(d[0] - chuot[0], d[1] - chuot[1], d[2] - chuot[2]) > 0.5) {
        const a = [d[0] - opt.goc[0], d[1] - opt.goc[1], d[2] - opt.goc[2]], b = [chuot[0] - opt.goc[0], chuot[1] - opt.goc[1], chuot[2] - opt.goc[2]], la = Math.hypot(a[0], a[1], a[2]), lb = Math.hypot(b[0], b[1], b[2]);
        const cheo = Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]);
        if (la > 0.5 && lb > 0.5 && cheo <= 2e-4 * la * lb && a[0] * b[0] + a[1] * b[1] + a[2] * b[2] > 0) go = Math.round(la * 100) / 100;      // (gõ toạ độ x,y thì điểm không nằm trên tia đó → coi là điểm bấm)
      }
      return { diem: d, chuot, go_so: go };
    }
    if (opt.cho_enter && r.Status === 0) return { enter: true, chuot };
    return null;
  };
  /**
   * BÓNG MỜ trên vùng vẽ (bản 1.17): một lớp SVG phủ lên canvas, không bắt chuột — vẽ các đa tuyến theo toạ độ bản vẽ để người dùng thấy tủ sẽ nằm đâu khi đang rê chuột.
   * net = [{ diem: [[x, y, z]…], kieu: 'lien' | 'dut' | 'truoc' }]; chu = dòng chữ ghi cạnh nét đầu. Gọi D.bongMo(null) để gỡ. Không đụng vào Scene của Chenfeng.
   */
  let lopBong = null;
  D.bongMo = (net, chu) => {
    try {
      if (!net || !net.length) { if (lopBong) { lopBong.remove(); lopBong = null; } return false; }
      const V = root.app.Viewer, c = V.Renderer.domElement, kh = c.getBoundingClientRect(), doc = root.document, NS = 'http://www.w3.org/2000/svg';
      if (!lopBong || !lopBong.isConnected) { lopBong = doc.createElementNS(NS, 'svg'); lopBong.setAttribute('aria-hidden', 'true'); lopBong.style.cssText = 'position:fixed;pointer-events:none;z-index:2147482000;overflow:hidden'; doc.body.appendChild(lopBong); }
      lopBong.style.left = kh.left + 'px'; lopBong.style.top = kh.top + 'px'; lopBong.style.width = kh.width + 'px'; lopBong.style.height = kh.height + 'px';
      lopBong.setAttribute('viewBox', `0 0 ${kh.width} ${kh.height}`);
      const v = ed().MouseCtrl._CurMousePointVCS.clone(), tl = kh.width / (V.Width || kh.width);
      const sc = p => { v.set(p[0], p[1], p[2]); V.WorldToScreen(v); return [v.x * tl, v.y * tl]; };
      const MAU = { lien: ['#2f9bff', '2', ''], dut: ['#b8c4d0', '1.4', '6 5'], truoc: ['#ff9f1a', '3', ''] };
      let h = '', dau = null;
      for (const n of net) {
        const q = (n.diem || []).map(sc).filter(x => isFinite(x[0]) && isFinite(x[1])); if (q.length < 2) continue;
        const m = MAU[n.kieu] || MAU.lien; if (!dau) dau = q[0];
        h += `<polyline points="${q.map(x => x[0].toFixed(1) + ',' + x[1].toFixed(1)).join(' ')}" fill="none" stroke="${m[0]}" stroke-width="${m[1]}"${m[2] ? ` stroke-dasharray="${m[2]}"` : ''} stroke-linejoin="round"/>`;
      }
      if (chu && dau) { const t = String(chu).replace(/[<>&]/g, ''); h += `<text x="${(dau[0] + 10).toFixed(1)}" y="${(dau[1] - 10).toFixed(1)}" font-family="system-ui,sans-serif" font-size="13" font-weight="600" fill="#fff" stroke="#10202e" stroke-width="3" paint-order="stroke">${t}</text>`; }
      lopBong.innerHTML = h;
      return true;
    } catch (e) { return false; }
  };
  /** Hỏi người dùng bấm 1 điểm trên bản vẽ. Trả về [x, y, z] hoặc null (Esc). */
  D.hoiDiem = async msg => {
    if (D.busy()) await D.cancel();
    D.boManChe();
    let r = null;
    try { r = await ed().GetPoint({ Msg: msg || 'Một Nhà: bấm 1 điểm:' }); } catch (e) { r = null; }
    return r && r.Status === 1 && r.Point ? [r2(r.Point.x), r2(r.Point.y), r2(r.Point.z)] : null;
  };

  /**
   * Vẽ tủ bằng lệnh gốc của Chenfeng. opt như D.draw: { at | corner, xoay, onStatus }; không có toạ độ thì hỏi người dùng bấm điểm.
   *   xoay (độ): tủ quay quanh trục đứng qua góc trái – trước – dưới (corner) / qua gốc thiết kế (at).
   * Trả về như D.draw, thêm `goc_cf: true`, `module` (kết quả gom cả tủ thành một module), `khung` {goc, xoay}, `buoc` (số lệnh đã chạy).
   */
  D.veGoc = async (spec, opt) => {
    opt = Object.assign({ onStatus() {} }, opt || {});
    opt.onStatus = guard(opt.onStatus);
    const K = Core.keHoachGoc(spec), M = K.M;
    if (K.loi.length) return { ok: false, giai_doan: 'thiet_ke', errors: K.loi, warnings: M.warnings || [] };
    const n3 = a => Array.isArray(a) && a.length === 3 && a.every(v => typeof v === 'number' && isFinite(v));
    const bb = Core.bbox(M.parts), base = [bb.x0, bb.y0, bb.z0];
    const xoay = Number(opt.xoay) || 0, bq = quayZ(base, xoay);
    // CHỖ ĐẶT: atW = vị trí gốc toạ độ thiết kế trên bản vẽ (tủ quay `xoay` độ quanh trục đứng qua điểm đó)
    let atW = null;
    if (opt.corner) { if (!n3(opt.corner)) return { ok: false, giai_doan: 'nhap', errors: ['Toạ độ đặt tủ phải là 3 số [x, y, z].'], warnings: M.warnings }; atW = opt.corner.map((v, i) => r2(v - bq[i])); }
    else if (opt.at) { if (!n3(opt.at)) return { ok: false, giai_doan: 'nhap', errors: ['Toạ độ đặt tủ phải là 3 số [x, y, z].'], warnings: M.warnings }; atW = opt.at.map(r2); }
    else {
      if (D.busy()) await D.cancel();
      D.boManChe();
      opt.onStatus('Bấm 1 điểm trên bản vẽ để đặt tủ (góc trái – trước – dưới).');
      let r = null;
      try { r = await ed().GetPoint({ Msg: 'Một Nhà: bấm điểm đặt tủ (góc trái - trước - dưới):' }); } catch (e) { r = null; }
      if (!r || r.Status !== 1) return { ok: false, giai_doan: 'nhap', errors: ['Đã huỷ — chưa vẽ gì.'], warnings: M.warnings };
      const P0 = r.Point; atW = [r2(P0.x - bq[0]), r2(P0.y - bq[1]), r2(P0.z - bq[2])];
    }
    const gocCuoi = atW.map((v, i) => r2(v + bq[i]));      // góc trái – trước – dưới của tủ sau khi đặt
    // CHỖ VẼ: lệnh gốc dò khoảng trống theo chuột ở hướng nhìn trước (tủ / tường khác đứng chắn sẽ làm lệch) và chỉ dựng thẳng trục.
    // Bản vẽ trống + không xoay → vẽ ngay tại chỗ đặt. Còn lại → vẽ ở chỗ trống bên phải mọi thứ, xong đưa cả tủ về chỗ đặt.
    let offset = atW, canDat = false;
    {
      const san = D.all();
      if (xoay || san.length) {
        let mx = -Infinity;
        for (const e of san) { try { const b = e.BoundingBox; if (b && isFinite(b.max.x) && Math.abs(b.max.x) < 1e7) mx = Math.max(mx, b.max.x); } catch (er) { /* bỏ qua đối tượng không có hộp bao */ } }
        offset = [r2((isFinite(mx) ? Math.ceil((mx + 6000) / 500) * 500 : 0) - base[0]), r2(-base[1]), r2(-base[2])];      // cách mọi thứ 6 m: lúc nhìn thẳng vào chỗ vẽ, phòng / tủ khác nằm ngoài màn hình
        canDat = true;
      }
    }
    const dich = p => [p[0] + offset[0], p[1] + offset[1], p[2] + offset[2]];
    const h0 = hmMark(), id = opt.id ? String(opt.id) : D.newId();
    const truocVe = new Set(root.app.Database.ModelSpace.Entitys);
    const cuaToi = () => root.app.Database.ModelSpace.Entitys.filter(e => e && !e.IsErase && !truocVe.has(e));
    const errors = [], warnings = (M.warnings || []).slice();
    let huongNhin = null; try { huongNhin = root.app.Viewer.CameraControl.Direction.clone(); } catch (e) { huongNhin = null; }
    let xong = 0, daNhin = false;
    const tamCua = new Map(), doiTen = [];      // tấm thiết kế → tấm thật; tấm Chenfeng đặt tên khác thiết kế (cánh: 左开门板…)
    const hien = () => hienHinh(cuaToi().filter(D.isBoard));
    const nhin = () => { try { const V = root.app.Viewer, bs = cuaToi().filter(D.isBoard); hienHinh(bs); V.ViewToFront(); if (bs.length && typeof V.ZoomtoEntitys === 'function') V.ZoomtoEntitys(bs); else V.ZoomAll(); V.UpdateRender(); veNgay(); } catch (e) { /* bỏ qua */ } };
    // nhìn thẳng mặt trước vào đúng vùng sắp vẽ (chưa có tấm nào để ZoomtoEntitys) rồi rê chuột tới điểm đặt — xem chayGoc: tránh chế độ "đặt theo phòng" của LEFTRIGHTBOARD
    const nhinChoVe = async diem => {
      try {
        const V = root.app.Viewer; let B = null;
        for (const e of D.all()) { try { const q = e.BoundingBox; if (q && q.min && q.max && typeof q.clone === 'function') { B = q.clone(); break; } } catch (er) { /* thử đối tượng khác */ } }
        V.ViewToFront();
        if (B && typeof V.ZoomtoEntitys === 'function') {
          B.min.set(bb.x0 + offset[0], bb.y0 + offset[1], bb.z0 + offset[2]); B.max.set(bb.x1 + offset[0], bb.y1 + offset[1], bb.z1 + offset[2]);
          V.ZoomtoEntitys([{ BoundingBox: B }]);
        }
        V.UpdateRender(); veNgay();
      } catch (e) { /* không quay được thì thôi: bước đối chiếu sau lệnh vẫn bắt được thùng lệch chỗ */ }
      await sleep(60);
      try { reChuot(diem); } catch (e) { /* bỏ qua */ }
      await sleep(90);
    };
    // người dùng xoay / thu phóng bản vẽ giữa chừng → lệnh dò theo chuột sẽ lệch: mỗi lần dò kiểm lại hướng nhìn thẳng mặt trước và điểm dò còn nằm trong màn hình
    const lechNhin = p => {
      try {
        const V = root.app.Viewer, d = V.CameraControl.Direction;
        if (!(Math.abs(d.x) < 1e-6 && Math.abs(d.y - 1) < 1e-6 && Math.abs(d.z) < 1e-6)) return true;
        const sc = ed().MouseCtrl._CurMousePointVCS.clone().set(p[0], p[1], p[2]); V.WorldToScreen(sc);
        return !(sc.x > 8 && sc.y > 8 && sc.x < V.Width - 8 && sc.y < V.Height - 8);
      } catch (e) { return false; }
    };
    // khoảng trống mà lệnh phải dò ra tại `diem` (toạ độ thiết kế): mặt các tấm ĐÃ VẼ gần điểm nhất về 4 phía trên hình chiếu đứng → toạ độ bản vẽ
    const mongKhoang = diem => {
      const m = Core.khoangMong([...tamCua.keys()], diem);
      for (const k of ['x0', 'x1']) if (m[k] !== null) m[k] += offset[0];
      for (const k of ['z0', 'z1']) if (m[k] !== null) m[k] += offset[2];
      return m;
    };
    const nk = [];      // nhật ký dò khoảng trống của lần vẽ này (bước nào phải thử lại, vì sao)
    let themHinh = 0;   // số tấm bảng phải tự đưa hình vào Scene trước khi dò (Chenfeng chưa kịp — tab bị che)
    try {
      for (const b of K.buoc) {
        opt.onStatus(`Lệnh gốc ${xong + 1}/${K.buoc.length}: ${TEN_BUOC[b.lenh]}${b.khoang !== undefined ? ' khoang ' + (b.khoang + 1) : ''}…`);
        const coTruoc = new Set(cuaToi());
        let tra = null;
        if (b.lenh === 'LR') { tra = await chayGoc(TEN_LENH_GOC.LR, st => LUA_CHON.LR(st, b), dich(b.goc), 'goc', null, { truoc_diem: () => nhinChoVe(dich(b.goc)) }); daNhin = false; }
        else if (b.lenh === 'DO') {
          const kep = b.kep.map(i => tamCua.get(M.parts[i])).filter(Boolean);
          if (kep.length !== 4) throw new Error(`Cánh khoang ${b.khoang + 1}: không tìm lại đủ 4 tấm kẹp khoang (hồi / vách, đáy, nóc) trên bản vẽ.`);
          tra = await chayCua(b, kep);
        }
        else {
          if (!daNhin || lechNhin(dich(b.diem))) { nhin(); await sleep(120); daNhin = true; }
          tra = await chayGoc(TEN_LENH_GOC[b.lenh], st => { if (st.m_BoardProcessOption) st.m_BoardProcessOption.useBoardProcessOption = true; if (st.autoCutOption) { st.autoCutOption.isAutoCut = false; st.autoCutOption.isRelevance = false; } ganKhoan(st, b.khoan); LUA_CHON[b.lenh](st, b); }, dich(b.diem), 'khoang', mongKhoang(b.diem), { hien, nhin });
          if (tra.do_) { themHinh += tra.do_.them_hinh || 0; if (tra.do_.lan > 1 || tra.do_.khop === false || tra.do_.loi_ve) nk.push(Object.assign({ buoc: xong + 1, lenh: b.lenh }, tra.do_)); }
        }
        // Chenfeng dựng tấm + khoan SAU khi lời nhắc đã đóng → chờ đủ số tấm của bước rồi chờ bản vẽ đứng yên, xong mới trả lựa chọn của người dùng
        const tamMoi = () => cuaToi().filter(e => !coTruoc.has(e) && D.isBoard(e));
        await cho(() => tamMoi().length >= b.tam.length, 12000);
        await D.settle(350, 15000);
        tra();
        // đối chiếu ngay: các tấm bước này phải sinh ra có đúng hộp thiết kế không
        const moi = tamMoi(), dung = new Set();
        for (const i of b.tam) {
          const p = M.parts[i], want = [p.x0 + offset[0], p.x1 + offset[0], p.y0 + offset[1], p.y1 + offset[1], p.z0 + offset[2], p.z1 + offset[2]];
          const hit = moi.find(e => !dung.has(e) && D.boxOf(e).every((v, q) => Math.abs(v - want[q]) < 0.12));
          if (hit) { dung.add(hit); tamCua.set(p, hit); if (hit.Name !== p.ten) doiTen.push([hit, p.ten]); }
          else {
            const d = tra && tra.do_;
            const vi = !d ? '' : d.khop === false ? ` Chenfeng dò khoảng trống lệch (${d.lan} lần thử): ${d.lech.join('; ')}${d.loi_ve ? ' — lỗi dựng hình: ' + d.loi_ve : ''}. Thường do tab Chenfeng bị che hoặc bản vẽ bị xoay / thu phóng lúc đang vẽ: hoàn tác rồi vẽ lại, để tab Chenfeng mở trên màn hình.`
              : d.khop === null && d.lech.length ? ` Chenfeng không dò ra khoảng trống ở điểm đó${d.loi_ve ? ' — lỗi dựng hình: ' + d.loi_ve : ''}.` : '';
            throw new Error(`Lệnh ${TEN_LENH_GOC[b.lenh]} (${TEN_BUOC[b.lenh]}${b.khoang !== undefined ? ' khoang ' + (b.khoang + 1) : ''}) không ra đúng tấm "${p.ten}": cần ${want.map(r2).join(' / ')}, Chenfeng vẽ ${moi.length ? moi.map(e => e.Name + ' ' + D.boxOf(e).join(' / ')).join(' ; ') : 'không tấm nào'}.${vi}`);
          }
        }
        xong++;
      }
    } catch (e) { errors.push(String(e && e.message || e)); }
    await D.settle(700, 20000);
    // tên tấm theo thiết kế (Chenfeng đặt tên cánh theo hướng mở: 左开门板 / 右开门板) — 1 bước lịch sử riêng
    // … và ghi mã tủ vào ghi chú từng tấm (như tấm nhập qua cổng) để "Sửa tủ đang chọn" / "Cập nhật tủ này" tìm lại được cả tủ
    if (tamCua.size) {
      let mo = false;
      try { const h = hm(); if (h && typeof h.StartCmd === 'function' && typeof h.EndCmd === 'function') { h.StartCmd('MNCF_TENTAM'); mo = true; } } catch (e) { mo = false; }
      for (const [e, ten] of doiTen) { try { e.Name = ten; } catch (er) { /* bỏ qua */ } }
      for (const e of tamCua.values()) {
        try { const o = e.BoardProcessOption, rm = (Array.isArray(o.remarks) ? o.remarks : []).filter(r => r && r[0] && r[0] !== D.TAG); rm.unshift([D.TAG, id]); e.BoardProcessOption = Object.assign({}, o, { remarks: rm }); } catch (er) { /* bỏ qua */ }
      }
      if (mo) { try { hm().EndCmd(); } catch (e) { /* bỏ qua */ } }
    }
    const daVe = new Set(); K.buoc.slice(0, xong).forEach(b => b.tam.forEach(i => daVe.add(M.parts[i])));
    // phần không có lệnh gốc (phào, phụ trợ, xà chân, khung hộc kéo, ngăn kéo, suốt treo): nhập qua cổng như trước, rồi gom với các thùng lệnh gốc thành MỘT module (bản 1.16)
    let roi = null;
    const conLai = M.parts.filter(p => !daVe.has(p));
    if (!errors.length && opt.phan_roi !== false && (conLai.length || (M.templates || []).some(tp => tp.id))) {
      opt.onStatus(`Đang vẽ ${conLai.length} tấm còn lại (phào, chân, ngăn kéo…)…`);
      try {
        const Mr = Object.assign({}, M, { parts: conLai });
        const cf = Core.toChenfeng(Mr, { id });
        const pt = conLai.length ? [offset[0] + cf.base[0], offset[1] + cf.base[1], offset[2] + cf.base[2]] : null;
        if (!conLai.length) { cf.json.ModelSpace = cf.json.ModelSpace.slice(); }
        const res = await D.importCF(cf.json, pt || [offset[0] + base[0], offset[1] + base[1], offset[2] + base[2]], opt);
        if (res.cancelled) warnings.push('Phần tấm rời (phào, chân, ngăn kéo…) chưa vẽ: lệnh nhập bị huỷ.');
        else {
          roi = { so_tam: conLai.length, added: res.added };
          try { roi.sua_khoan = await D.finalize(res.added.filter(D.isBoard), M.spec.khoan.thung, opt); } catch (e) { roi.sua_khoan = { fixed: 0, normalized: 0, reason: e.message }; }
          conLai.forEach(p => daVe.add(p));
          // tấm rời thiết kế ↔ tấm thật (để gắn hành động co giãn)
          const dung = new Set(tamCua.values());
          for (const p of conLai) {
            const want = [p.x0 + offset[0], p.x1 + offset[0], p.y0 + offset[1], p.y1 + offset[1], p.z0 + offset[2], p.z1 + offset[2]];
            const hit = res.added.find(e => e && !e.IsErase && D.isBoard(e) && !dung.has(e) && D.tagOf(e) === id && near(D.boxOf(e), want, 0.15));
            if (hit) { dung.add(hit); tamCua.set(p, hit); }
          }
        }
      } catch (e) { warnings.push(`Phần tấm rời (phào, chân, ngăn kéo…) chưa vẽ được: ${e.message}`); }
      await D.settle(700, 20000);
    }
    let added = cuaToi();
    const veDuMau = !!roi;
    const Msub = Object.assign({}, M, { parts: M.parts.filter(p => daVe.has(p)), templates: veDuMau ? M.templates : [], mat_ngan_keo: veDuMau ? M.mat_ngan_keo : [] });
    const v = D.verify(Msub, added, offset);      // đối chiếu TRƯỚC khi gom module và trước khi xoay (gom rồi mọi tấm chung một mẫu; xoay rồi hộp bao không còn thẳng trục)
    if (!errors.length) {
      if (v.thieu.length) errors.push(`Thiếu ${v.thieu.length} tấm so với thiết kế: ${v.thieu.slice(0, 4).join('; ')}${v.thieu.length > 4 ? '…' : ''}`);
      if (v.sai_ten.length) errors.push(...v.sai_ten.slice(0, 4));
    }
    if (v.tam_khong_lo.length) warnings.push(`${v.tam_khong_lo.length} tấm chưa có lỗ khoan: ${v.tam_khong_lo.slice(0, 5).join(', ')}${v.tam_khong_lo.length > 5 ? '…' : ''}.`);
    if (v.hau_co_lo) warnings.push(`Có ${v.hau_co_lo} lỗ khoan dính tới tấm hậu — hậu phủ bắn đinh không cần lỗ: bỏ kiểu khoan của tấm hậu trong hộp thoại 背板 của Chenfeng.`);
    if (v.va_cham.length) errors.push(`${v.va_cham.length} chỗ tấm đè lên nhau: ${v.va_cham.slice(0, 4).join('; ')}${v.va_cham.length > 4 ? '…' : ''}`);
    if (v.mat_ngan_keo_lech.length) warnings.push(`Mẫu ngăn kéo đặt mặt khác thiết kế: ${v.mat_ngan_keo_lech.join(', ')} — xem lại mã mẫu / thông số ngăn kéo.`);
    if (roi && roi.sua_khoan && roi.sua_khoan.reason) warnings.push(roi.sua_khoan.reason);
    // GOM CẢ TỦ THÀNH MỘT MODULE: thùng lệnh gốc + phào, chân, khung hộc kéo, ngăn kéo, suốt treo cùng chạy theo L / W / H
    let mod = null;
    const chua = K.chua;
    if (!errors.length && xong === K.buoc.length && roi && M.spec.module_cf && opt.module !== false) {
      try { mod = await ganModuleGoc(K, offset, tamCua, added, id, opt); } catch (e) { mod = { ok: false, reason: String(e && e.message || e) }; }
      if (mod.ok) {
        added = cuaToi();
        const v2 = D.verify(Msub, added, offset);
        if (v2.thieu.length) { if (mod.steps) await D.undo(mod.steps); mod = { ok: false, reason: `gom module làm lệch ${v2.thieu.length} tấm (${v2.thieu.slice(0, 2).join('; ')}) — đã trả lại như trước khi gom.` }; added = cuaToi(); }
      }
    }
    if (mod && mod.ok) for (const g of mod.ghi_chu) warnings.push(g);
    else if (chua.length) {
      const ly = mod && !mod.khong_can ? ` (chưa gom được thành một module: ${mod.reason})` : mod && mod.khong_can ? '' : (!M.spec.module_cf ? ' (đang tắt "Module Chenfeng" ở Chuẩn xưởng)' : '');
      warnings.push(roi ? `Vẽ dạng TẤM RỜI, không chạy theo khi đổi kích thước tủ trong Chenfeng${ly}: ${chua.map(c => `${c.ten} × ${c.sl}`).join(', ')}.` : `Chưa vẽ: ${chua.map(c => `${c.ten} × ${c.sl}`).join(', ')}.`);
    } else if (mod && mod.khong_can) warnings.push(mod.reason);
    // ĐƯA TỦ VỀ CHỖ ĐẶT (dời + xoay) — 1 bước hoàn tác
    let dat = null;
    const khung = { goc: gocCuoi, xoay };
    if (canDat && added.length) {
      opt.onStatus(xoay ? `Đưa tủ về chỗ đặt, xoay ${r2(xoay)}°…` : 'Đưa tủ về chỗ đặt…');
      try {
        const C = lopM4(), Mx = new C().makeRotationZ(xoay * Math.PI / 180); Mx.setPosition(atW[0], atW[1], atW[2]); Mx.multiply(new C().setPosition(-offset[0], -offset[1], -offset[2]));
        dat = await D.apMaTran(added, Mx, 'MNCF_DAT');
        if (dat.ok) {
          // kiểm lại trong hệ của tủ: gốc khung = góc trái – trước – dưới ↔ góc nhỏ nhất của thiết kế
          const kh = D.taoKhung(gocCuoi, xoay); let lech = 0, vd = '';
          for (const [p, e] of tamCua) { if (!e || e.IsErase) continue; const want = [p.x0 - base[0], p.x1 - base[0], p.y0 - base[1], p.y1 - base[1], p.z0 - base[2], p.z1 - base[2]]; if (!near(D.hopTheo(e, kh), want, 0.25)) { lech++; if (!vd) vd = p.ten; } }
          if (lech) errors.push(`Đưa tủ về chỗ đặt xong có ${lech} tấm lệch vị trí (vd "${vd}") — hoàn tác rồi vẽ lại.`);
        } else errors.push(`Tủ đã vẽ xong ở chỗ trống (x ≈ ${r2(offset[0] + base[0])}) nhưng chưa đưa được về chỗ đặt: ${dat.reason} — dùng lệnh MOVE của Chenfeng để dời.`);
      } catch (e) { errors.push(`Chưa đưa được tủ về chỗ đặt: ${e && e.message || e}`); }
    }
    // trả hướng nhìn về như trước khi vẽ, nhìn vào tủ vừa đặt
    try { const V = root.app.Viewer; if (huongNhin && V.CameraControl && typeof V.CameraControl.LookAt === 'function') V.CameraControl.LookAt(huongNhin); const bs = cuaToi().filter(D.isBoard); if (bs.length && typeof V.ZoomtoEntitys === 'function') V.ZoomtoEntitys(bs); V.UpdateRender(); } catch (e) { /* bỏ qua */ }
    added = cuaToi();
    const dl = added.some(D.isBoard) ? doLoiSauVe(added, errors, { dai: M.spec.van.kho_dai, rong: M.spec.van.kho_rong }) : null;
    const h1 = hmMark();
    const steps = h0 && h1 && h1.i > h0.i ? h1.i - h0.i : xong;
    D.last = { M: Msub, added, offset: atW.slice(), khung, steps, mark: h1, id, goc_cf: true };      // offset = vị trí gốc thiết kế; tủ xoay (khung.xoay ≠ 0) thì toạ độ tấm = xoay(thiết kế) + offset
    opt.onStatus('Xong.');
    return { ok: errors.length === 0, giai_doan: 'xong', id, errors, warnings, notes: M.notes, offset: atW.slice(), goc: gocCuoi, xoay_do: xoay, khung, dat, kiem_tra: v, do_loi: dl, sua_khoan: { fixed: 0, normalized: 0 }, so_buoc_hoan_tac: steps,
      module: mod && (mod.ok || !mod.khong_can) ? mod : null, goc_cf: true, chua, tam_roi: roi ? roi.so_tam : 0, buoc: xong, tong_buoc: K.buoc.length, do_lai: nk, them_hinh: themHinh, kich: [r2(bb.x1 - bb.x0), r2(bb.y1 - bb.y0), r2(bb.z1 - bb.z0)], tom_tat: Core.summary(M) };
  };

  /* ------------------------------------------------------------------ *
   * DÒ LỖI SẢN XUẤT trên tấm và lỗ khoan THẬT (bản 1.20 — anh Jason 04/10/2026: "vẽ phải chuẩn kết cấu, tự động dò lỗi để anh còn sản xuất được").
   * Chỉ ĐỌC bản vẽ: tấm đè / trùng nhau, lỗ khoan giao nhau, lỗ lệch khỏi tấm hoặc khoan thủng tấm, kiểu khoan lạ, tấm không lỗ, mối nối dài không liên kết, tấm vượt khổ, tấm đứng riêng, tấm chưa có tên tủ (Core.doLoiThat).
   * Dùng được cho tủ của bảng, mẫu kho lẫn phần người dùng tự vẽ / tự sửa.
   * Đo trên Chenfeng 04/10/2026: tấm có OBB { ocs (Matrix4: 3 cột đầu = trục riêng, cột 3 = pháp tuyến), halfSizes, center };
   * lỗ CylinderHole: _Matrix cột 4 = MIỆNG lỗ, cột 3 = hướng khoan vào ván, Height = sâu, Radius, GroupId.Index (3 lỗ của một cam chung nhóm), FId = tấm cái, MId = tấm đực.
   * Lệnh CHECKHOLES của Chenfeng cho cùng kết quả với phép dò lỗ ở đây (đã thử cả trường hợp có lỗ giao nhau), nhưng nó cần tab đang hiện và mở hộp thoại riêng.
   * ------------------------------------------------------------------ */
  // đường bao có cung (bul = tan(góc ở tâm / 4), dương = ngược chiều kim đồng hồ): chia mỗi cung thành các đoạn 15°
  const chiaCung = P => {
    const R = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[i], n = P[(i + 1) % P.length], bl = a[2];
      R.push([a[0], a[1]]);
      if (!bl) continue;
      const th = 4 * Math.atan(bl), k = (1 - bl * bl) / (4 * bl), cx = (a[0] + n[0]) / 2 - (n[1] - a[1]) * k, cy = (a[1] + n[1]) / 2 + (n[0] - a[0]) * k;
      const r = Math.hypot(a[0] - cx, a[1] - cy), a0 = Math.atan2(a[1] - cy, a[0] - cx), so = Math.max(2, Math.ceil(Math.abs(th) / (Math.PI / 12)));
      for (let j = 1; j < so; j++) { const g = a0 + th * j / so; R.push([cx + r * Math.cos(g), cy + r * Math.sin(g)]); }
    }
    return R;
  };

  /**
   * Đọc tấm + lỗ thành dữ liệu thuần. `ents` lẫn lộn tấm, lỗ, phụ kiện cũng được. Tấm xoay theo tường xiên vẫn đọc được: mỗi nhóm hướng (góc quanh trục Z, lấy theo 90°) có hệ trục riêng.
   * Mã mẫu (`mau`, để miễn va chạm trong lòng một mẫu kho — rãnh, mộng): tấm do BẢNG vẽ (mang mã tủ) không có mã mẫu, vì thiết kế của bảng không có tấm nào được phép ăn vào nhau;
   * mẫu kho nằm trong module tủ của bảng (ngăn kéo, suốt treo) thì tính theo từng mẫu con; còn lại theo module gốc. opt.nen = mọi tấm của bản vẽ (để nhận ra module tủ khi chỉ kiểm vài tấm).
   */
  D.docThat = (ents, opt) => {
    const tam = [], vt = new Map(), hes = [], maMau = new Map(), entTam = [];
    let lech = 0, cong = 0;
    const gocTu = new Set();
    for (const b of ((opt && opt.nen) || ents || [])) { try { if (b && !b.IsErase && D.isBoard(b) && D.tagOf(b)) { const g0 = rootTpl(b); if (g0) gocTu.add(g0); } } catch (e) { /* bỏ qua */ } }
    const mauCua = b => {
      if (D.tagOf(b)) return null;
      try { let o = b.Template && b.Template.Object, truoc = null, n = 0; while (o && o.Parent && o.Parent.Object && n++ < 40) { truoc = o; o = o.Parent.Object; } return !o ? null : gocTu.has(o) && truoc ? truoc : o; } catch (e) { return null; }
    };
    for (const b of (ents || [])) {
      if (!b || b.IsErase || !D.isBoard(b)) continue;
      let uon = false; try { uon = b.IsArcBoard === true; } catch (e) { uon = false; }
      if (uon) { cong++; continue; }      // tấm uốn theo đường dẫn: hộp bao không nói lên hình thật
      let ob = null; try { ob = b.OBB; } catch (e) { ob = null; }
      const el = ob && ob.ocs && ob.ocs.elements, hs = ob && ob.halfSizes, c = ob && ob.center;
      if (!el || !hs || !c) { lech++; continue; }
      const ax = [[el[0], el[1], el[2]], [el[4], el[5], el[6]], [el[8], el[9], el[10]]], h3 = [hs.x, hs.y, hs.z];
      // tấm của tủ luôn có đúng một trục thẳng đứng và hai trục nằm ngang; khác thế là tấm nghiêng (vát mái…) → bỏ ra, có đếm
      const dung = ax.findIndex(a => Math.abs(Math.abs(a[2]) - 1) < 1e-4);
      if (dung < 0 || ax.some((a, i) => i !== dung && Math.abs(a[2]) > 1e-4)) { lech++; continue; }
      const ng = ax[(dung + 1) % 3];
      let goc = Math.atan2(ng[1], ng[0]) * 180 / Math.PI; goc = ((goc % 90) + 90) % 90; if (goc > 89.99) goc = 0;
      let he = hes.findIndex(g0 => Math.abs(g0 - goc) < 0.02); if (he < 0) { he = hes.length; hes.push(goc); }
      const a = -hes[he] * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a), q = v => [v[0] * cs - v[1] * sn, v[0] * sn + v[1] * cs, v[2]];
      const cc = q([c.x, c.y, c.z]), nua = [0, 0, 0];
      ax.forEach((v, i) => { const w = q(v); for (let k = 0; k < 3; k++) nua[k] += Math.abs(w[k]) * h3[i]; });
      const o = b.BoardProcessOption || {}, hd = Array.isArray(o.highDrill) ? o.highDrill : [];
      const kieu = [...new Set(hd.filter(x => typeof x === 'string' && x && x !== Core.KHONG_KHOAN))];
      const goc0 = mauCua(b); if (goc0 && !maMau.has(goc0)) maMau.set(goc0, maMau.size + 1);
      let W = 0, H = 0; try { W = +b.Width; H = +b.Height; } catch (e) { /* bỏ qua */ }
      if (!(W > 0 && H > 0)) { W = 2 * h3[0]; H = 2 * h3[1]; }
      const hop = [r2(cc[0] - nua[0]), r2(cc[0] + nua[0]), r2(cc[1] - nua[1]), r2(cc[1] + nua[1]), r2(cc[2] - nua[2]), r2(cc[2] + nua[2])];
      // đường bao thật của tấm KHÔNG chữ nhật (khoét góc khấu cột, cắt góc, bo cong): ContourCurve.LineData nằm trong hệ riêng của tấm (OCS) → đưa về hệ trục của nhóm hướng,
      // lấy hai toạ độ nằm trong mặt tấm (cùng quy ước với Core.kiemVaCham). Đo trên Chenfeng 04/10/2026: đáy khấu cột có 6 đỉnh, OCS của tấm đưa (u, v) về toạ độ bản vẽ.
      let bao;
      try {
        const ld = b.ContourCurve && b.ContourCurve.LineData, oe = b.OCS && b.OCS.elements;
        if (Array.isArray(ld) && ld.length >= 3 && oe) {
          const P = ld.map(d0 => [+d0.pt.x, +d0.pt.y, +d0.bul || 0]);
          if (P.length > 3 && Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) < 1e-6) P.pop();      // điểm đầu lặp lại ở cuối
          const chuNhat = P.length === 4 && P.every((d0, i) => { const n = P[(i + 1) % 4]; return !d0[2] && (Math.abs(d0[0] - n[0]) < 1e-6 || Math.abs(d0[1] - n[1]) < 1e-6); });
          if (!chuNhat && P.every(d0 => isFinite(d0[0]) && isFinite(d0[1]) && isFinite(d0[2]))) {
            const kich = [hop[1] - hop[0], hop[3] - hop[2], hop[5] - hop[4]]; let km = 0; if (kich[1] < kich[km]) km = 1; if (kich[2] < kich[km]) km = 2;
            bao = chiaCung(P).map(d0 => { const w = q([oe[12] + d0[0] * oe[0] + d0[1] * oe[4], oe[13] + d0[0] * oe[1] + d0[1] * oe[5], oe[14] + d0[0] * oe[2] + d0[1] * oe[6]]); return [r2(w[(km + 1) % 3]), r2(w[(km + 2) % 3])]; });
          }
        }
      } catch (e) { bao = undefined; }
      vt.set(b, tam.length);
      const t1 = { ten: String(b.Name || ''), tu: String(o.cabinetName || ''), hop,
        day: r2(+b.Thickness > 0 ? +b.Thickness : 2 * h3[2]), khoan: o.drillType !== Core.KHONG_KHOAN && kieu.length > 0, kieu, mau: goc0 ? maMau.get(goc0) : null, kich: [r2(Math.max(W, H)), r2(Math.min(W, H))], he, vl: String(o.material || o.boardName || '') };
      if (bao) t1.bao = bao;
      tam.push(t1); entTam.push(b);
    }
    const lo = [], nhomPhu = new Map();
    for (const h of (ents || [])) {
      if (!h || h.IsErase || !D.isHole(h)) continue;
      const cai = vt.get(idOf(h.FId)), duc = vt.get(idOf(h.MId));
      if (cai === undefined && duc === undefined) continue;
      let el = null; try { el = (h._Matrix || h.OCS).elements; } catch (e) { el = null; }
      const dai = +h.Height, r = +h.Radius;
      if (!el || !(dai > 0) || !(r > 0)) continue;
      const ld = Math.hypot(el[8], el[9], el[10]) || 1;
      let nhom = null; try { const gid = h.GroupId; nhom = gid && typeof gid.Index === 'number' ? gid.Index : null; } catch (e) { nhom = null; }
      if (nhom === null) { const k = (cai === undefined ? -1 : cai) + '|' + (duc === undefined ? -1 : duc); if (!nhomPhu.has(k)) nhomPhu.set(k, 'p' + nhomPhu.size); nhom = nhomPhu.get(k); }      // không đọc được nhóm: coi mọi lỗ nối cùng hai tấm là một nhóm
      lo.push({ p: [el[12], el[13], el[14]], d: [el[8] / ld, el[9] / ld, el[10] / ld], dai, r, nhom, cai: cai === undefined ? -1 : cai, duc: duc === undefined ? -1 : duc });
    }
    const ra = { tam, lo, lech, cong, goc_he: hes.slice() };
    Object.defineProperty(ra, 'ent', { value: entTam, enumerable: false });      // tấm thật ứng với từng dòng của `tam` (cho các việc cần quay lại đối tượng: đổ màu)
    return ra;
  };

  /**
   * Dò lỗi sản xuất. ents bỏ trống = các tấm đang chọn trên bản vẽ; không chọn gì = mọi tấm của bản vẽ. Lỗ khoan của các tấm đó được tự lấy theo.
   * opt.kho = { dai, rong } khổ ván (mặc định 2440 × 1220).
   * @returns phiếu của Core.doLoiThat + { pham_vi: 'chon' | 'tat_ca' | 'dua_vao' }
   */
  D.doLoi = (ents, opt) => {
    opt = opt || {};
    let pv = 'dua_vao';
    if (!ents) { const chon = D.selected().filter(D.isBoard); if (chon.length) { ents = chon; pv = 'chon'; } else { ents = D.all().filter(D.isBoard); pv = 'tat_ca'; } }
    const boards = ents.filter(e => e && !e.IsErase && D.isBoard(e)), bo = new Set(boards);
    let holes = ents.filter(e => e && !e.IsErase && D.isHole(e));
    if (!holes.length) { try { holes = D.all().filter(e => D.isHole(e) && (bo.has(idOf(e.FId)) || bo.has(idOf(e.MId)))); } catch (e) { holes = []; } }
    let nen = null; if (pv !== 'tat_ca') { try { nen = D.all().filter(D.isBoard); } catch (e) { nen = null; } }
    const dl = D.docThat(boards.concat(holes), nen ? { nen } : null);
    const co = D.drillTypes();
    dl.kieu_co = co.length ? co : null;
    dl.kho = opt.kho && opt.kho.dai > 0 ? opt.kho : { dai: Core.DEFAULT_SPEC.van.kho_dai, rong: Core.DEFAULT_SPEC.van.kho_rong };
    const p = Core.doLoiThat(dl);
    p.pham_vi = pv;
    return p;
  };

  /* ------------------------------------------------------------------ *
   * ĐỔ MÀU (bản 1.21 — anh Jason 04/10/2026 09:08: "chọn một tủ: phần thùng một màu riêng, cánh tủ và phào tủ một màu … liệt kê các màu của mình cho nhanh, cho phép tìm kiếm và thay thế").
   * "Màu của xưởng" = kho vật liệu của tài khoản Chenfeng (thư mục loại 2; mỗi vật liệu đặt tên theo mã màu). Chỉ ĐỌC kho; mã nguồn không ghi sẵn mã thư mục / mã vật liệu nào.
   * Đã đo trên Chenfeng thật 04/10/2026:
   *   - `CAD-dirQuery { dir_type: '2' }` → thư mục vật liệu; `CAD-materialList { dir_id, curr_page, page_count ≤ 100 }` → `{ count, materials: [{ material_id, name, logo }] }` (100 mã ≈ 0,3 giây);
   *     ảnh nhỏ 100 × 100 = máy chủ API + '/' + logo; `CAD-materialDetail { material_id }` → `materials.file` (base64 của zlib) — CHẬM, 2–4 giây mỗi mã, nên mỗi mã chỉ tải một lần;
   *   - file vật liệu là một Database thu nhỏ: `new Database(false, false, true).FileRead(new CADFiler(mảng)).MaterialTable.Symbols` có đúng một `PhysicalMaterialRecord`;
   *     lớp Database lấy từ `app.Database.constructor`, lớp CADFiler từ `new Database(…).FileWrite().constructor` — đúng cách chính Chenfeng làm khi kéo vật liệu vào bản vẽ (`MaterialIn` + `WblockCloneObejcts(…, DuplicateRecordCloning.Ignore = 1)`);
   *   - bản vẽ đã có vật liệu cùng tên (`MaterialTable.GetAt(tên)`) thì dùng lại; gán cho tấm: `tấm.Material = bản ghi.Id` (tấm khoá vật liệu thì bỏ qua);
   *   - vật liệu mang "thông tin ván" `GoodsInfo { name, color, material }` (kho của xưởng: MDF / mã màu / MDF) → ghi vào ô 板材名 / 颜色 / 材料 của tấm như Chenfeng làm (`ApplyGoodInfo`) để bảng cắt gom đúng loại ván;
   *   - gán trong `hm.StartCmd … EndCmd` = MỘT bước hoàn tác; đổi L / W / H của module sau đó màu vẫn giữ.
   * ------------------------------------------------------------------ */
  let khoVL = null;
  /** Mọi màu trong kho vật liệu của tài khoản (đọc một lần rồi nhớ; opt.lam_moi = đọc lại). @returns {{ ds: [{ id, ten, nhom (tên thư mục), hinh (ảnh nhỏ) }], nhom: [tên thư mục] }} */
  D.khoVatLieu = async (opt) => {
    if (khoVL && !(opt && opt.lam_moi)) return khoVL;
    const j = await post('CAD-dirQuery', { dir_type: '2' }), dirs = [], host = D.apiHost();
    (function di(a) { for (const d of a || []) { dirs.push({ id: String(d.dir_id), ten: String(d.dir_name || '').trim() }); di(d.childs); } })(j.dirs);
    const CO = 100, trang = (d, tr) => post('CAD-materialList', { dir_id: d.id, curr_page: tr, page: tr, page_count: CO });
    const doi = (d, a) => (a || []).map(m => { const logo = String(m.logo || '').replace(/^\/+/, ''); return { id: String(m.material_id), ten: String(m.name || '').trim(), nhom: d.ten, hinh: logo ? (/^https?:/i.test(logo) ? logo : host + '/' + logo) : '' }; });
    const doc = async d => {
      const r1 = await trang(d, 1), a1 = r1.materials || [], tong = Math.round(+r1.count) || 0, ra = doi(d, a1);
      if (a1.length < CO || (tong && tong <= CO)) return ra;
      // máy chủ Chenfeng có lúc trả lời chậm vài giây mỗi trang (đo 04/10/2026: 0,3 – 6,5 giây) → biết tổng số rồi thì các trang sau hỏi CÙNG LÚC
      if (tong) { const con = await Promise.all(Array.from({ length: Math.min(59, Math.ceil(tong / CO) - 1) }, (x, i) => trang(d, i + 2))); return ra.concat(...con.map(r => doi(d, r.materials))); }
      for (let tr = 2; tr <= 60; tr++) { const a = (await trang(d, tr)).materials || []; ra.push(...doi(d, a)); if (a.length < CO) break; }      // máy chủ không báo tổng số: hỏi lần lượt tới trang thiếu
      return ra;
    };
    const tung = await Promise.all(dirs.map(doc));
    khoVL = { ds: [].concat(...tung), nhom: dirs.filter((d, i) => tung[i].length).map(d => d.ten) };
    return khoVL;
  };
  const tenVL = rec => { try { return String(rec.Name !== undefined && rec.Name !== null ? rec.Name : rec.name || ''); } catch (e) { return ''; } };
  /** Bản ghi vật liệu TRONG BẢN VẼ của màu m = { id, ten }: đã có thì dùng lại, chưa có thì tải file của kho rồi chép vào bảng vật liệu của bản vẽ. */
  D.napVatLieu = async (m) => {
    const db = root.app.Database, ten = String((m && m.ten) || '');
    let rec = ten ? db.MaterialTable.GetAt(ten) : null;
    if (rec) return rec;
    const j = await post('CAD-materialDetail', { material_id: String(m && m.id) });
    const file = j.materials && j.materials.file;
    if (!file) throw new Error('kho không trả file của vật liệu này');
    const DB = db.constructor, F = new DB(false, false, true).FileWrite().constructor, db2 = new DB(false, false, true);
    db2.FileRead(new F(JSON.parse(await inflate(file))));
    const goc = db2.MaterialTable.Symbols.entries().next().value[1];
    if (ten) goc.Name = ten;
    rec = db.MaterialTable.GetAt(tenVL(goc));      // người dùng vừa kéo đúng màu này vào trong lúc chờ tải
    return rec || db.WblockCloneObejcts([goc], db.MaterialTable, new Map(), 1)[0];
  };
  const vlCua = b => { try { const id = b.Material; return (id && id.Object) || null; } catch (e) { return null; } };
  const tenMauCua = b => { let md = null; try { md = root.app.Database.DefaultMaterial; } catch (e) { md = null; } const r = vlCua(b); return !r || r === md ? '' : tenVL(r); };      // '' = chưa đổ màu (vật liệu mặc định của bản vẽ)
  const khoaVL = b => { try { if (b.LockMaterial) return true; const st = typeof b.GetMtlLockedStatus === 'function' ? b.GetMtlLockedStatus() : null; return !!(st && (st.partMtlLocked || st.allMtlLocked)); } catch (e) { return false; } };
  // Gán vật liệu + thông tin ván cho từng tấm trong MỘT bước lịch sử. cap = [[tấm, bản ghi vật liệu, nhóm]…] → { so: { nhóm: số tấm đã gán }, khoa, steps, mark }
  const ganVL = (cap, tenLenh) => {
    const h0 = hmMark(), so = {}; let mo = false, khoa = 0, n = 0;
    try { const h = hm(); if (h && typeof h.StartCmd === 'function' && typeof h.EndCmd === 'function') { h.StartCmd(tenLenh || 'MNCF_MAU'); mo = true; } } catch (e) { mo = false; }
    try {
      for (const [b, rec, nh] of cap) {
        if (!b || b.IsErase || !rec) continue;
        if (khoaVL(b)) { khoa++; continue; }
        b.Material = rec.Id || rec.objectId;
        const g = rec.GoodsInfo || {}, o = b.BoardProcessOption || {};      // vật liệu không mang thông tin ván (vd mua ở cửa hàng): giữ tên ván / vật liệu cũ của tấm, màu = tên vật liệu
        b.BoardProcessOption = Object.assign({}, o, { boardName: String(g.name || o.boardName || ''), material: String(g.material || o.material || ''), color: String(g.color || tenVL(rec)) });
        so[nh] = (so[nh] || 0) + 1; n++;
      }
    } finally { if (mo) { try { hm().EndCmd(); } catch (e) { /* bỏ qua */ } } }
    try { root.app.Viewer.UpdateRender(); } catch (e) { /* bỏ qua */ }
    const h1 = hmMark(), steps = h0 && h1 ? Math.max(0, h1.i - h0.i) : (n ? 1 : 0);
    if (steps) D.lastMau = { steps, mark: h1 };
    return { so, khoa, steps, mark: h1, n };
  };
  const laTam = b => !!(b && !b.IsErase && D.isBoard(b));
  /** Các tấm của (các) TỦ chứa những tấm đưa vào: cùng mã tủ của bảng, cùng module gốc, hoặc (tấm rời) cùng tên phòng + tên tủ. */
  D.tamCuaTu = (ents) => {
    const chon = (ents || []).filter(laTam);
    if (!chon.length) return [];
    const all = D.all().filter(D.isBoard), goc = new Map(all.map(b => [b, rootTpl(b)])), khoa = b => { const o = b.BoardProcessOption || {}; return o.cabinetName ? String(o.roomName || '') + '\u0001' + o.cabinetName : ''; };
    const the = new Set(), mod = new Set(), ten = new Set(), le = new Set();
    for (const b of chon) { const t = D.tagOf(b), g = goc.has(b) ? goc.get(b) : rootTpl(b); if (t) the.add(t); if (g) mod.add(g); if (!t && !g) { if (khoa(b)) ten.add(khoa(b)); else le.add(b); } }
    // tủ của bảng chưa gom module: hộp ngăn kéo (mẫu kho, không mang mã tủ) đi theo tên tủ của các tấm mang mã đó
    if (the.size) for (const b of all) if (the.has(D.tagOf(b)) && !goc.get(b) && khoa(b)) ten.add(khoa(b));
    return all.filter(b => { const t = D.tagOf(b), g = goc.get(b); return (t && the.has(t)) || (g && mod.has(g)) || le.has(b) || (!t && khoa(b) && ten.has(khoa(b))); });
  };
  /** Chia tấm thành nhóm màu (Core.nhomMau): { nhom: ['thung' | 'mat' | 'hau'…] cùng thứ tự, dem: { thung, mat, hau }, ten: { nhóm: { tên tấm: số tấm } } } */
  D.phanNhomMau = (boards) => {
    boards = (boards || []).filter(laTam);
    const dl = D.docThat(boards), vt = new Map(); (dl.ent || []).forEach((b, i) => vt.set(b, i));
    const nhom = Core.nhomMau(boards.map(b => { const i = vt.get(b), t = i === undefined ? null : dl.tam[i]; return t ? { ten: t.ten, hop: t.hop, he: t.he } : { ten: String(b.Name || '') }; }));
    const dem = { thung: 0, mat: 0, hau: 0 }, ten = { thung: {}, mat: {}, hau: {} };
    nhom.forEach((n, i) => { dem[n]++; const t = String(boards[i].Name || ''); ten[n][t] = (ten[n][t] || 0) + 1; });
    return { nhom, dem, ten };
  };
  const napNhieu = async (ds) => { const ra = []; for (const m of ds) { if (!m) { ra.push(null); continue; } try { ra.push(await D.napVatLieu(m)); } catch (e) { return { loi: `Không tải được màu “${m.ten}” từ kho vật liệu của Chenfeng (${String(e && e.message || e).slice(0, 140)}).` }; } } return { rec: ra }; };
  /**
   * Đổ màu theo NHÓM cho các tấm của tủ: mau = { thung, mat, hau } (mỗi cái là { id, ten } của D.khoVatLieu, hoặc bỏ trống = giữ nguyên nhóm đó; hậu bỏ trống = theo màu thùng).
   * Một bước hoàn tác. opt.gop_ve = đang tự đổ màu ngay sau một lần vẽ → cộng bước này vào lần vẽ (để "Hoàn tác lần vẽ này" lùi cả hai).
   * opt.hau_rieng = hậu KHÔNG tự theo màu thùng (dùng khi trả lại màu cũ cho tủ vừa cập nhật: hậu của tủ cũ chưa đổ thì để nguyên).
   * @returns {{ ok, so: { thung, mat, hau }, khoa (số tấm khoá vật liệu bị bỏ qua), steps, mau: { thung, mat, hau } (tên màu đã đổ, '' = giữ nguyên), ten (tên tấm từng nhóm) } | { ok: false, reason }}
   */
  D.doMauTu = async (boards, mau, opt) => {
    opt = opt || {}; mau = mau || {};
    boards = (boards || []).filter(laTam);
    if (!boards.length) return { ok: false, reason: 'Không có tấm nào để đổ màu — chọn 1 tấm của tủ trên bản vẽ rồi bấm lại.' };
    const can = { thung: mau.thung || null, mat: mau.mat || null, hau: mau.hau || (opt.hau_rieng ? null : mau.thung) || null };
    if (!can.thung && !can.mat && !can.hau) return { ok: false, reason: 'Chưa chọn màu nào.' };
    const N = ['thung', 'mat', 'hau'], nap = await napNhieu(N.map(k => can[k]));
    if (nap.loi) return { ok: false, reason: nap.loi };
    const rec = {}; N.forEach((k, i) => { rec[k] = nap.rec[i]; });
    const pn = D.phanNhomMau(boards), lastCu = D.last && D.last.mark ? hmMark() : null;
    const kq = ganVL(boards.map((b, i) => [b, rec[pn.nhom[i]], pn.nhom[i]]));
    if (opt.gop_ve && D.last && kq.steps && lastCu && D.last.mark && lastCu.i === D.last.mark.i && lastCu.rec === D.last.mark.rec) { D.last.steps = (D.last.steps || 1) + kq.steps; D.last.mark = kq.mark; }
    return { ok: true, so: { thung: kq.so.thung || 0, mat: kq.so.mat || 0, hau: kq.so.hau || 0 }, khoa: kq.khoa, steps: kq.steps, mau: { thung: can.thung ? can.thung.ten : '', mat: can.mat ? can.mat.ten : '', hau: can.hau ? can.hau.ten : '' }, ten: pn.ten };
  };
  /** Màu đang mang của một tủ, theo nhóm = màu có NHIỀU TẤM NHẤT của nhóm ('' = nhóm đó chưa đổ màu). lan = các nhóm đang có hơn một màu (có tấm đổ riêng). */
  D.mauCuaTu = (boards) => {
    boards = (boards || []).filter(laTam);
    const pn = D.phanNhomMau(boards), dem = { thung: new Map(), mat: new Map(), hau: new Map() }, mau = {}, lan = [];
    boards.forEach((b, i) => { const t = tenMauCua(b), m = dem[pn.nhom[i]]; m.set(t, (m.get(t) || 0) + 1); });
    for (const k of Object.keys(dem)) { const a = [...dem[k]].sort((x, y) => y[1] - x[1]); mau[k] = a.length ? a[0][0] : ''; if (a.length > 1) lan.push(k); }
    return { mau, lan, co: !!(mau.thung || mau.mat || mau.hau) };
  };
  // Màu của kho theo TÊN (để tải lại nếu bản vẽ không còn bản ghi vật liệu đó); bản vẽ còn bản ghi thì D.napVatLieu dùng lại ngay, không cần mã.
  const mauTheoTen = async ten => {
    if (!ten) return null;
    let m = khoVL && khoVL.ds.find(x => x.ten === ten);
    if (!m && !root.app.Database.MaterialTable.GetAt(ten)) { try { m = (await D.khoVatLieu()).ds.find(x => x.ten === ten); } catch (e) { m = null; } }
    return m || { id: '', ten };
  };
  /** Trả lại màu cũ (cu = D.mauCuaTu của tủ TRƯỚC khi bỏ) cho tủ vừa vẽ lại — D.update gọi; bước đổ màu được cộng vào lần vẽ. */
  const giuMau = async (cu) => {
    try {
      const tam = ((D.last && D.last.added) || []).filter(laTam), m = {};
      for (const k of ['thung', 'mat', 'hau']) m[k] = await mauTheoTen(cu.mau[k]);
      const kq = await D.doMauTu(tam, m, { gop_ve: true, hau_rieng: true });
      return kq.ok ? Object.assign(kq, { lan: cu.lan }) : { ok: false, reason: kq.reason, mau: cu.mau };
    } catch (e) { return { ok: false, reason: String(e && e.message || e), mau: cu.mau }; }
  };
  /** Đổ MỘT màu cho đúng các tấm đưa vào (không chia nhóm). @returns {{ ok, so, khoa, steps } | { ok: false, reason }} */
  D.doMau = async (boards, m) => {
    boards = (boards || []).filter(laTam);
    if (!boards.length) return { ok: false, reason: 'Không có tấm nào để đổ màu — chọn tấm trên bản vẽ rồi bấm lại.' };
    if (!m) return { ok: false, reason: 'Chưa chọn màu nào.' };
    const nap = await napNhieu([m]);
    if (nap.loi) return { ok: false, reason: nap.loi };
    const kq = ganVL(boards.map(b => [b, nap.rec[0], 'x']));
    return { ok: true, so: kq.so.x || 0, khoa: kq.khoa, steps: kq.steps };
  };
  /** Các màu đang dùng trên bản vẽ (hoặc trong các tấm đưa vào): [{ ten ('' = chưa đổ màu), so }] — nhiều tấm trước, "chưa đổ màu" xếp cuối. */
  D.mauDangDung = (boards) => {
    const dem = new Map();
    for (const b of (boards || D.all())) { if (!laTam(b)) continue; const t = tenMauCua(b); dem.set(t, (dem.get(t) || 0) + 1); }
    return [...dem].map(([ten, so]) => ({ ten, so })).sort((a, b) => (a.ten === '') - (b.ten === '') || b.so - a.so || (a.ten < b.ten ? -1 : 1));
  };
  /** Các tấm đang mang màu `ten` ('' = chưa đổ màu), trong cả bản vẽ hoặc trong các tấm đưa vào. */
  D.tamTheoMau = (ten, boards) => (boards || D.all()).filter(b => laTam(b) && tenMauCua(b) === String(ten || ''));
  /** Thay màu `tuTen` bằng màu m trên cả bản vẽ (hoặc chỉ trong các tấm đưa vào). Một bước hoàn tác. */
  D.thayMau = async (tuTen, m, boards) => {
    if (!m) return { ok: false, reason: 'Chưa chọn màu thay vào.' };
    const ds = D.tamTheoMau(tuTen, boards);
    if (!ds.length) return { ok: true, so: 0, khoa: 0, steps: 0 };
    const nap = await napNhieu([m]);
    if (nap.loi) return { ok: false, reason: nap.loi };
    const kq = ganVL(ds.map(b => [b, nap.rec[0], 'x']), 'MNCF_THAYMAU');
    return { ok: true, so: kq.so.x || 0, khoa: kq.khoa, steps: kq.steps };
  };
  /** Hoàn tác lần đổ / thay màu vừa rồi — chỉ khi bản vẽ chưa có thao tác nào khác sau đó. */
  D.undoMau = async () => {
    const L = D.lastMau;
    if (!L || !L.steps) return { ok: false, reason: 'Chưa có lần đổ màu nào để hoàn tác.' };
    if (D.busy()) await D.cancel();
    const moved = () => { const now = hmMark(); return !!(L.mark && now && (now.i !== L.mark.i || now.rec !== L.mark.rec)); };
    for (let i = 0; i < 6 && moved(); i++) await sleep(300);
    if (moved()) return { ok: false, reason: 'Sau lần đổ màu đó bản vẽ đã có thao tác khác — hãy dùng Ctrl+Z của Chenfeng để lùi từng bước.' };
    await D.undo(L.steps);
    D.lastMau = null;
    return { ok: true };
  };

  /* ------------------------------------------------------------------ *
   * XUẤT VÁN (bản 1.22 — anh Jason 04/10/2026 09:09: "thử xuất ván … làm sao để hợp lý nhất nhanh gọn"; 14:14: "làm cả 2").
   * Chạy lệnh TÁCH ĐƠN `CD` (拆单) của Chenfeng thay người dùng: tự chọn đúng tấm + phụ kiện của tủ rồi Enter. Đã đo trên Chenfeng thật 04/10/2026:
   *   - `CD` hỏi "选择板件或者五金"; đang hỏi thì `SelectCtrl.AddSelect` rồi `InputEvent('')` (Enter) là đi tiếp; Chenfeng kiểm 排钻碰撞 + 封边 (≈ 5 ms / tấm),
   *     có lỗi thì HỎI trước (bảng không trả lời hộ), rồi mở hộp "Order Splitting" (`.bp3-dialog` có một khung 350 × 100 trỏ sang trang sản xuất sc.leye.site);
   *   - tới đây CHƯA có gì rời máy: khung nhận dữ liệu tấm bằng postMessage rồi hỏi "是否打开拆单优化窗口?" — chỉ khi NGƯỜI DÙNG bấm 打开 thì tab trang sản xuất
   *     mới mở và dữ liệu mới lên máy chủ. Bảng dừng ở đây, không bấm hộ (cũng không bấm được: khung khác nguồn);
   *   - trang trong khung báo `{ command: 'loaded' }` ~0,25 giây TRƯỚC sự kiện load của khung (thường 1,4 – 3,7 giây sau khi hộp thoại hiện);
   *     khung không tải được thì ~31 giây sau chỉ có sự kiện load (trang lỗi của trình duyệt), không có tin nào → phải đóng, chạy lại `CD`;
   *   - người dùng bấm 打开 → trang sản xuất báo `{ command: 'closeWindow' }` → Chenfeng tự đóng hộp thoại.
   * ------------------------------------------------------------------ */
  const NGUON_SX = /^https:\/\/([a-z0-9-]+\.)*leye\.site$/;      // trang sản xuất của Chenfeng (khung "Order Splitting")
  const hopXuat = () => { try { return [...document.querySelectorAll('.bp3-dialog')].find(d => d.querySelector('iframe')) || null; } catch (e) { return null; } };
  /** Tấm + phụ kiện sẽ xuất: đang chọn tấm nào thì lấy cả (các) tủ chứa tấm đó; không chọn gì = cả bản vẽ. Lỗ khoan không đưa vào (Chenfeng tự lấy theo tấm). */
  D.phamViXuat = () => {
    const chon = D.selected().filter(D.isBoard), all = D.all(), pkAll = all.filter(D.isHardware);
    const tam = chon.length ? D.tamCuaTu(chon) : all.filter(D.isBoard);
    const tenTu = b => String((b.BoardProcessOption || {}).cabinetName || '');
    let pk = pkAll;
    if (chon.length) {      // phụ kiện của tủ = phụ kiện có tâm nằm trong hộp bao của tủ đó (như khi quét chọn quanh tủ)
      const hop = new Map();
      for (const b of tam) { let x; try { x = D.boxOf(b); } catch (e) { continue; } const k = D.tagOf(b) || tenTu(b) || '\u0001', h = hop.get(k); if (!h) hop.set(k, x.slice()); else for (let i = 0; i < 6; i += 2) { h[i] = Math.min(h[i], x[i]); h[i + 1] = Math.max(h[i + 1], x[i + 1]); } }
      const cac = [...hop.values()];
      pk = pkAll.filter(e => { let x; try { x = D.boxOf(e); } catch (err) { return false; } const c = [(x[0] + x[1]) / 2, (x[2] + x[3]) / 2, (x[4] + x[5]) / 2]; return cac.some(h => c[0] >= h[0] - 1 && c[0] <= h[1] + 1 && c[1] >= h[2] - 1 && c[1] <= h[3] + 1 && c[2] >= h[4] - 1 && c[2] <= h[5] + 1); });
    }
    return { pham_vi: chon.length ? 'chon' : 'tat_ca', tam, pk, tu: [...new Set(tam.map(tenTu).filter(Boolean))], khong_ten: tam.filter(b => !tenTu(b)).length };
  };
  /** Đóng hộp "Order Splitting" đang mở (bấm nút × của chính hộp đó). Không có hộp nào → true. */
  D.dongKhungXuat = async () => {
    const h = hopXuat(); if (!h) return true;
    try { const nut = h.querySelector('.bp3-dialog-close-button') || [...h.querySelectorAll('.bp3-dialog-header button')].pop(); if (nut) nut.click(); } catch (e) { /* bỏ qua */ }
    for (let i = 0; i < 25 && h.isConnected; i++) await sleep(100);
    return !h.isConnected;
  };
  /**
   * Chạy `CD` cho phạm vi xuất (opt.pham_vi_san = kết quả D.phamViXuat đã lấy trước; bỏ trống thì tự lấy), dừng khi hộp "Order Splitting" hiện.
   * opt: onStatus; cho_hop (ms chờ hộp thoại, mặc định 90000); cho_khung (ms chờ khung lên tiếng, 45000); tre_loi (ms sau sự kiện load mà khung vẫn im thì coi là trang lỗi, 2500).
   * @returns {{ ok, giai_doan: 'chon' | 'dang_mo' | 'lenh' | 'hoi' | 'khung', pham_vi, so_tam, so_pk, tu: [tên tủ], reason?, hoi? (câu Chenfeng đang hỏi),
   *   san_sang?: Promise<{ ok, ly_do: '' | 'loi' (khung ra trang lỗi) | 'cham' (quá hạn) | 'dong' (hộp bị đóng), ms }>,
   *   da_mo?: Promise<boolean> (true khi trang sản xuất báo closeWindow = người dùng đã bấm 打开) }}
   */
  D.xuatVan = async (opt) => {
    opt = opt || {};
    const st = guard(opt.onStatus), kq = { ok: false, giai_doan: 'chon' };
    const pv = opt.pham_vi_san || D.phamViXuat();
    const tam = (pv.tam || []).filter(laTam), pk = (pv.pk || []).filter(e => e && !e.IsErase && D.isHardware(e));
    kq.pham_vi = pv.pham_vi; kq.so_tam = tam.length; kq.so_pk = pk.length; kq.tu = pv.tu || [];
    if (!tam.length) { kq.reason = 'Bản vẽ chưa có tấm ván nào để xuất.'; return kq; }
    D.boManChe();
    if (hopXuat() && !(await D.dongKhungXuat())) { kq.giai_doan = 'dang_mo'; kq.reason = 'Khung xuất ván (Order Splitting) của lần trước còn mở và bảng không đóng được — bấm × trên khung đó rồi bấm lại.'; return kq; }
    if (D.busy()) await D.cancel();
    try { ed().SelectCtrl.Cancel(); } catch (e) { /* bỏ qua */ }
    await sleep(150);
    // nghe trang sản xuất từ TRƯỚC khi chạy lệnh (khỏi lỡ tin "loaded"); chỉ nhận tin từ nguồn *.leye.site
    const tin = { san: false, mo: false };
    const nghe = e => { try { if (!NGUON_SX.test(String(e.origin || ''))) return; const d = e.data, c = d && typeof d === 'object' ? String(d.command || d.cmd || '') : ''; if (c === 'loaded') tin.san = true; else if (c === 'closeWindow') tin.mo = true; } catch (er) { /* bỏ qua */ } };
    const thoiNghe = () => { try { root.removeEventListener('message', nghe); } catch (e) { /* bỏ qua */ } };
    root.addEventListener('message', nghe);
    const truoc = new Set(document.querySelectorAll('.bp3-dialog, .bp3-alert')), t0 = Date.now();
    kq.giai_doan = 'lenh';
    st(`Đang chạy lệnh tách đơn CD của Chenfeng cho ${tam.length} tấm…`);
    try {
      D.cmd('CD');
      for (let i = 0; i < 30 && !D.busy(); i++) await sleep(100);
      if (!D.busy()) { kq.reason = 'Lệnh CD (tách đơn) của Chenfeng không hỏi chọn tấm — tài khoản này chưa có quyền tách đơn, hoặc Chenfeng đang bận việc khác. Thử gõ CD trực tiếp ở dòng lệnh của Chenfeng.'; thoiNghe(); return kq; }
      D.select(tam.concat(pk));
      await sleep(300);
      D.input('');
    } catch (e) { thoiNghe(); if (D.busy()) await D.cancel(); kq.reason = 'Không chạy được lệnh CD của Chenfeng (' + String(e && e.message || e).slice(0, 120) + ').'; return kq; }
    // chờ hộp "Order Splitting". Chenfeng có thể hỏi trước (tự đánh số tấm, lỗi khoan / dán cạnh, tấm vượt cỡ…): KHÔNG trả lời hộ, chỉ nêu câu hỏi và chờ người dùng.
    const han = opt.cho_hop > 0 ? opt.cho_hop : 90000; let hop = null, hoi = '';
    while (Date.now() - t0 < han) {
      const h = hopXuat(); if (h && !truoc.has(h)) { hop = h; break; }
      let chu = '';
      try { const q = [...document.querySelectorAll('.bp3-alert, .bp3-dialog')].find(d => !truoc.has(d) && d.isConnected && !d.querySelector('iframe')); chu = q ? String(q.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 220) : ''; } catch (e) { chu = ''; }
      if (chu && chu !== hoi) st(`Chenfeng đang hỏi: “${chu}” — anh trả lời trong hộp thoại đó, bảng chờ.`);
      if (chu) hoi = chu;
      await sleep(150);
    }
    if (!hop) {
      thoiNghe();
      if (D.busy()) await D.cancel();
      try { ed().SelectCtrl.Cancel(); } catch (e) { /* bỏ qua */ }
      if (hoi) { kq.giai_doan = 'hoi'; kq.hoi = hoi; kq.reason = `Chenfeng hỏi mà chưa có trả lời: “${hoi}”. Trả lời trong hộp thoại của Chenfeng (hoặc sửa bản vẽ) rồi bấm Xuất ván lại.`; }
      else kq.reason = `Chenfeng không mở khung xuất ván (Order Splitting) sau ${Math.round(han / 1000)} giây.`;
      return kq;
    }
    kq.ok = true; kq.giai_doan = 'khung'; kq.ms_hop = Date.now() - t0;
    const fr = hop.querySelector('iframe'), hanK = opt.cho_khung > 0 ? opt.cho_khung : 45000, tre = opt.tre_loi > 0 ? opt.tre_loi : 2500;
    let luTai = 0; const taiXong = () => { luTai = Date.now(); };
    try { fr.addEventListener('load', taiXong); } catch (e) { /* bỏ qua */ }
    const t1 = Date.now();
    kq.san_sang = (async () => {
      try {
        for (;;) {
          if (tin.san) return { ok: true, ly_do: '', ms: Date.now() - t1 };
          if (!hop.isConnected) return { ok: false, ly_do: tin.mo ? '' : 'dong', ms: Date.now() - t1 };
          if (luTai && Date.now() - luTai >= tre) return { ok: false, ly_do: 'loi', ms: Date.now() - t1 };      // khung tải xong mà trang sản xuất vẫn im = trang lỗi của trình duyệt
          if (Date.now() - t1 >= hanK) return { ok: false, ly_do: 'cham', ms: Date.now() - t1 };
          await sleep(100);
        }
      } finally { try { fr.removeEventListener('load', taiXong); } catch (e) { /* bỏ qua */ } }
    })();
    // người dùng bấm 打开 → trang sản xuất báo closeWindow → hộp thoại đóng. Theo dõi tối đa 10 phút rồi thôi nghe.
    kq.da_mo = (async () => {
      const r = await kq.san_sang;
      try { if (!r.ok) return false; const t2 = Date.now(); while (hop.isConnected && !tin.mo && Date.now() - t2 < 600000) await sleep(200); return tin.mo; } finally { thoiNghe(); }
    })();
    return kq;
  };

  D.zoom = () => { try { D.cmd('ZOOME'); } catch (e) { /* bỏ qua */ } };
  D.undo = async (steps) => { for (let i = 0; i < (steps || 1); i++) { try { if (D.busy()) await D.cancel(); D.cmd('UNDO'); } catch (e) { /* bỏ qua */ } await sleep(400); await D.settle(600, 20000); } };
  D.sleep = sleep;

  root.MNCFDriver = D;
})(typeof self !== 'undefined' ? self : this);

/*!
 * mncf-ui.js — bảng "Một Nhà · Vẽ tủ vào Chenfeng".
 * Chạy 2 chế độ: (1) bảng nổi trong trang Chenfeng (có nút "Vẽ vào Chenfeng"); (2) trang độc lập (chỉ xuất file JSON / bảng kê).
 */
(function (root) {
  'use strict';
  const Core = root.MNCFCore, Drv = root.MNCFDriver, Ph = root.MNCFPhong;
  if (!Core || typeof document === 'undefined') return;
  const LS_KEY = 'mncf.spec.v2', LS_KEY_CU = 'mncf.spec.v1', LS_WIDE = 'mncf.ui.wide', LS_BAN = 'mncf.spec.ban', LS_PHONG = 'mncf.phong.v1', LS_MAU = 'mncf.mau.v1';      // v1 = thông số lưu từ bản 1.0–1.2
  const BUOC_KEO = 5;      // kéo đợt bắt bước 5 mm; gõ số hoặc phím mũi tên thì chính xác tới 1 mm
  const TEN_KIEU = { nk_am: 'ngăn kéo âm', nk_trum: 'ngăn kéo trùm ngoài', suot: 'suốt treo' };
  /* ---- hình của từng loại ngăn kéo (bản 1.13): mặt cắt nhìn từ trước — 2 hồi tủ, hộp ngăn kéo, đáy, ray. Vẽ bằng SVG nên chạy cả ở trang độc lập / artifact (không tải ảnh ngoài).
   * Nhận dạng theo mã loại, tên mẫu Chenfeng hoặc tên loại: ray bi (ray kẹp hai bên hông) / ray âm (ray nằm dưới đáy) · đáy mỏng (lọt rãnh) / đáy dày · hông soi rãnh · chia ô · khung treo quần · Blum (thành kim loại) · khay bàn phím. */
  const dacDiemNK = x => { const t = `${x.ma || ''} ${x.ten_mau || ''} ${x.ten || ''}`; return {
    blum: /blum|百隆|骑马/i.test(t), am: /(^|[\s_])am_|托底|ray âm/i.test(t), day: /_day|厚底|đáy dày/i.test(t), ranh: /_ranh|侧开槽|soi rãnh/i.test(t),
    chia: /chia_o|格抽|chia ô/i.test(t), quan: /ke_quan|裤抽|quần/i.test(t), phim: /ban_phim|键盘|bàn phím/i.test(t), so: (/(16|18)\s*MM/i.exec(t) || /thành\s*(16|18)/i.exec(t) || /blum(16|18)/i.exec(t) || [])[1] || '' }; };
  function anhNganKeo(x) {
    const d = dacDiemNK(x || {}), S = 'stroke="currentColor" stroke-width="1.1"', G = 'fill="currentColor" fill-opacity=".13"', D = 'fill="currentColor" fill-opacity=".72"';
    let o = '<svg viewBox="0 0 96 60" width="96" height="60" aria-hidden="true" focusable="false">';
    o += `<rect x="3" y="3" width="5" height="54" ${G} ${S}/><rect x="88" y="3" width="5" height="54" ${G} ${S}/>`;      // 2 hồi / vách của khoang
    const rayBi = y => `<rect x="8.6" y="${y}" width="6" height="7" ${D}/><rect x="81.4" y="${y}" width="6" height="7" ${D}/>`;
    if (d.quan) {      // khung treo quần: khung + các thanh treo
      o += `<rect x="15" y="20" width="66" height="22" fill="none" ${S}/>`;
      for (let i = 0; i < 6; i++) o += `<line x1="${22 + i * 10.4}" y1="20" x2="${22 + i * 10.4}" y2="42" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`;
      o += rayBi(27.5);
    } else if (d.blum) {      // hộp ray Blum: thành kim loại mảnh, ray liền dưới thành
      const w = d.so === '18' ? 4.2 : 3.2;
      o += `<rect x="16" y="14" width="${w}" height="33" ${D}/><rect x="${80 - w}" y="14" width="${w}" height="33" ${D}/>`;
      o += `<rect x="${16 + w}" y="40" width="${64 - 2 * w}" height="5.5" ${G} ${S}/>`;
      o += `<rect x="9" y="47" width="13" height="4.5" ${D}/><rect x="74" y="47" width="13" height="4.5" ${D}/>`;
      if (d.so) o += `<text x="48" y="33" font-size="13" font-weight="700" text-anchor="middle" fill="currentColor">${d.so}</text>`;
    } else {
      const y0 = d.phim ? 35 : 13, yb = d.day ? 43 : 48;
      o += `<rect x="15" y="${y0}" width="5" height="${yb - y0}" ${G} ${S}/><rect x="76" y="${y0}" width="5" height="${yb - y0}" ${G} ${S}/>`;      // 2 hông hộp
      if (d.day) o += `<rect x="15" y="43" width="66" height="5.5" ${G} ${S}/>`;                                                                      // đáy dày: hông đứng trên đáy
      else o += `<rect x="18" y="43.2" width="60" height="2" ${D}/>`;                                                                                // đáy mỏng lọt rãnh
      if (d.ranh) o += `<path d="M15 ${yb - 6} h2.2 v3 h-2.2 M81 ${yb - 6} h-2.2 v3 h2.2" fill="none" stroke="currentColor" stroke-width="1.6"/>`; // rãnh ở hông cho ray âm
      if (d.chia) o += `<line x1="37" y1="${y0 + 5}" x2="37" y2="43" ${S}/><line x1="59" y1="${y0 + 5}" x2="59" y2="43" ${S}/><line x1="20" y1="${y0 + 5}" x2="76" y2="${y0 + 5}" ${S} stroke-dasharray="2.5 2"/>`;
      if (d.phim) o += `<rect x="28" y="36.5" width="40" height="5" rx="1" fill="none" ${S}/><path d="M32 39h32" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2.2 1.6"/>`;
      if (d.am) { const yr = d.day ? 49.6 : yb + 1.2; o += `<rect x="20.5" y="${yr}" width="12" height="4.2" ${D}/><rect x="63.5" y="${yr}" width="12" height="4.2" ${D}/>`; }  // ray âm: nằm dưới đáy
      else o += rayBi(d.phim ? 36.5 : 26);                                                                                                           // ray bi: kẹp hai bên hông
    }
    return o + '</svg>';
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clone = o => JSON.parse(JSON.stringify(o));
  const esc = v => String(v === undefined || v === null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = v => (typeof v === 'number' ? String(Math.round(v * 100) / 100) : (v === undefined || v === null ? '' : String(v)));
  const hien = v => fmt(v).replace('.', ',');      // số để ĐỌC (dấu phẩy thập phân); số trong ô nhập vẫn dùng fmt (dấu chấm) vì dấu phẩy ở đó là dấu ngăn cách
  const getP = (o, path) => path.split('.').reduce((a, k) => (a === undefined || a === null ? a : a[k]), o);
  const setP = (o, path, v) => { const ks = path.split('.'); let a = o; for (let i = 0; i < ks.length - 1; i++) { if (typeof a[ks[i]] !== 'object' || a[ks[i]] === null) a[ks[i]] = {}; a = a[ks[i]]; } a[ks[ks.length - 1]] = v; };

  const store = {
    // → { spec, doi }: doi = những chỗ đã đổi khi nâng thông số lưu từ bản cũ lên chuẩn xưởng hiện tại (để báo cho người dùng)
    load() {
      try {
        const t = root.localStorage.getItem(LS_KEY); if (t) return Core.nangCap(JSON.parse(t), root.localStorage.getItem(LS_BAN) || '1.5.0');   // chưa có dấu phiên bản = lưu từ bản 1.3–1.5.0
        const cu = root.localStorage.getItem(LS_KEY_CU); if (cu) return Core.nangCap(JSON.parse(cu), '1.2.0');
      } catch (e) { /* không đọc được thì dùng tủ mẫu */ }
      return { spec: null, doi: [] };
    },
    save(s) { try { root.localStorage.setItem(LS_KEY, JSON.stringify(s)); root.localStorage.setItem(LS_BAN, Core.VERSION); } catch (e) { /* không lưu được thì thôi */ } },
  };

  // Thông số của từng tủ ĐÃ VẼ (bản 1.6): khoá = mã ghi trên các tấm của tủ đó. Lưu trong trình duyệt của máy này; giữ 300 tủ gần nhất.
  const LS_TU = 'mncf.tu.';
  const khoTu = {
    get(id) { try { const t = root.localStorage.getItem(LS_TU + id); return t ? JSON.parse(t) : null; } catch (e) { return null; } },
    save(id, spec) {
      try {
        root.localStorage.setItem(LS_TU + id, JSON.stringify({ spec, ban: Core.VERSION, luc: Date.now() }));
        const ks = []; for (let i = 0; i < root.localStorage.length; i++) { const k = root.localStorage.key(i); if (k && k.indexOf(LS_TU) === 0) ks.push(k); }
        if (ks.length > 300) {
          const co = ks.map(k => { let luc = 0; try { luc = JSON.parse(root.localStorage.getItem(k)).luc || 0; } catch (e) { /* bỏ qua */ } return { k, luc }; }).sort((x, y) => x.luc - y.luc);
          for (const x of co.slice(0, ks.length - 300)) root.localStorage.removeItem(x.k);
        }
      } catch (e) { /* không lưu được thì thôi */ }
    },
  };

  // Màu và chữ: mỗi biến lấy giá trị của trang (--mn-*, do bản trang độc lập / artifact khai báo theo giao diện sáng–tối) nếu có,
  // còn không (bảng nổi trong Chenfeng) thì dùng giá trị sáng mặc định ghi ngay đây.
  const CSS = `
:host{all:initial}
*{box-sizing:border-box}
.mn{--bg:var(--mn-bg,#f4f6f2);--card:var(--mn-card,#ffffff);--ink:var(--mn-ink,#1b2420);--muted:var(--mn-muted,#5d6861);--line:var(--mn-line,#cdd4ca);
  --accent:var(--mn-accent,#1c5fb8);--accent-ink:var(--mn-accent-ink,#ffffff);--head:var(--mn-head,#1c2530);--head-ink:var(--mn-head-ink,#e8edf2);--head-dim:var(--mn-head-dim,#a5b4c3);
  --field:var(--mn-field,#ffffff);--foot:var(--mn-foot,#e6eae3);--hover:var(--mn-hover,#e3ebf6);--sheet:var(--mn-sheet,#fbfbf8);--ph:var(--mn-ph,#9aa39c);
  --ok:var(--mn-ok,#17603f);--ok-bg:var(--mn-ok-bg,#dff2e6);--ok-line:var(--mn-ok-line,#2f9e6e);
  --err:var(--mn-err,#8d1f14);--err-bg:var(--mn-err-bg,#fde7e4);--err-line:var(--mn-err-line,#d9402b);
  --warn:var(--mn-warn,#6e4b00);--warn-bg:var(--mn-warn-bg,#fff2cf);--warn-line:var(--mn-warn-line,#e0a100);
  --note:var(--mn-note,#1d4f66);--note-bg:var(--mn-note-bg,#e2eef4);--note-line:var(--mn-note-line,#3b86a8);
  --font:var(--mn-font,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif);--font-data:var(--mn-font-data,var(--font));
  font:13px/1.45 var(--font);color:var(--ink)}
.panel{position:fixed;top:10px;right:10px;bottom:10px;width:448px;max-width:calc(100vw - 20px);display:flex;flex-direction:column;background:var(--bg);border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.5);border:1px solid rgba(0,0,0,.25);overflow:hidden;z-index:2147483000}
.panel[hidden],.launch[hidden],.chip[hidden]{display:none}
header{background:var(--head);color:var(--head-ink);padding:9px 10px 0 12px}
.hrow{display:flex;align-items:center;gap:8px}
.brand{font-weight:700;font-size:14px;letter-spacing:.01em;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.brand span{font-weight:400;color:var(--head-dim)}
.ibtn{background:transparent;border:0;color:inherit;font:inherit;cursor:pointer;padding:4px 8px;border-radius:7px;opacity:.85}
.ibtn:hover{background:rgba(255,255,255,.12);opacity:1}
.tabs{display:flex;gap:1px;margin-top:7px;flex-wrap:wrap}
.tab{background:transparent;border:0;color:var(--head-dim);font:inherit;padding:7px 4px;border-radius:8px 8px 0 0;cursor:pointer;white-space:nowrap;flex:1 1 auto;text-align:center}
.panel.wide .tab,.mn.page .tab{padding:7px 12px;flex:0 0 auto}
.tab:hover{color:var(--head-ink)}
.tab.on{background:var(--bg);color:var(--ink);font-weight:650}
.body{flex:1;overflow:auto;padding:12px;overscroll-behavior:contain}
.pane[hidden]{display:none}
fieldset{border:0;padding:0;margin:0 0 12px;min-width:0}
legend{padding:0;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:6px}
.g{display:grid;gap:8px;align-items:end}
.g2{grid-template-columns:repeat(2,minmax(0,1fr))}.g3{grid-template-columns:repeat(3,minmax(0,1fr))}.g4{grid-template-columns:repeat(4,minmax(0,1fr))}
label{display:flex;flex-direction:column;gap:3px;font-size:11.5px;color:var(--muted);min-width:0}
label.row{flex-direction:row;align-items:center;gap:7px;font-size:12.5px;color:var(--ink)}
input,select{font:13px var(--font-data);padding:5px 7px;border:1px solid var(--line);border-radius:7px;background:var(--field);color:var(--ink);min-width:0;width:100%;height:30px}
select,input[data-text]{font-family:var(--font)}
input[type=checkbox]{width:16px;height:16px;padding:0;accent-color:var(--accent)}
input:focus-visible,select:focus-visible,button:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
input::placeholder{color:var(--ph)}
.bay{border:1px solid var(--line);border-radius:10px;padding:9px 9px 10px;margin-bottom:8px;background:var(--card)}
.bayh{display:flex;align-items:center;gap:8px;margin-bottom:7px}
.bayh b{font-size:13px}.bayh .w{color:var(--muted);font-size:12px;flex:1;font-variant-numeric:tabular-nums}
.x{border:0;background:transparent;color:var(--muted);cursor:pointer;font-size:14px;padding:2px 6px;border-radius:6px}
.x:hover{background:var(--err-bg);color:var(--err)}
.bay .g{margin-bottom:7px}.bay .g:last-child{margin-bottom:0}
.sec{background:var(--field);border:1px solid var(--line);border-radius:8px;padding:6px 10px;cursor:pointer;color:var(--ink);font:inherit}
.sec:hover{border-color:var(--accent);background:var(--hover)}
.view{background:var(--sheet);border:1px solid var(--line);border-radius:10px;padding:6px;margin-bottom:8px;text-align:center;outline:none;user-select:none;-webkit-user-select:none}
.view:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.view svg{display:block;margin:0 auto;max-width:100%;height:auto}
.view [data-dot]:hover{fill-opacity:.3}
.view [data-o]:hover{fill-opacity:.08}
.view.keo{cursor:ns-resize}
.view.keov{cursor:ew-resize}
.view.themvach [data-o],.view.themvach svg{cursor:col-resize !important}
.sec.mini.on{background:var(--accent);border-color:var(--accent);color:var(--accent-ink);font-weight:650}
.edbar,.edprobe{border:1px solid var(--line);border-radius:10px;background:var(--card);padding:8px 10px;margin-bottom:10px;display:flex;flex-direction:column;gap:7px}
.edbar .hint{margin:0}
.edprobe{position:absolute;left:0;right:0;top:0;visibility:hidden;pointer-events:none;margin:0}
.edh{font-size:12.5px;color:var(--ink);font-variant-numeric:tabular-nums}
.seg{display:grid;grid-template-columns:1fr 1fr;gap:4px}
.segb{background:var(--field);border:1px solid var(--line);border-radius:7px;padding:6px 9px;font:inherit;color:var(--ink);cursor:pointer;white-space:nowrap}
.segb:hover{border-color:var(--accent);background:var(--hover)}
.segb.on{background:var(--accent);border-color:var(--accent);color:var(--accent-ink);font-weight:650}
.edrow{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.edrow label{flex-direction:row;align-items:center;gap:6px;font-size:12.5px;color:var(--ink)}
.edrow input{width:84px}
.edrow select{width:auto;min-width:150px;max-width:100%}
.lkr{border:1px solid var(--line);border-radius:8px;background:var(--card);padding:7px 8px;margin-bottom:6px;display:grid;grid-template-columns:minmax(0,1fr) 104px 28px;grid-template-areas:"ten ten x" "ts id id" "md md md";gap:6px 8px;align-items:end}
.lkr .lkt{grid-area:ten}.lkr .lkp{grid-area:ts}.lkr .lki{grid-area:id}.lkr .x{grid-area:x;align-self:center;justify-self:end}
.lkr .lkm{grid-area:md;font-size:11.5px;color:var(--muted);display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.lkr .lkm label{flex-direction:row;align-items:center;gap:5px;font-size:12px;color:var(--ink);white-space:nowrap}
.noi{white-space:pre-line}
.edbar{position:relative}
.lanh{padding:1px 5px;line-height:0;display:inline-flex;align-items:center;gap:5px}
.lanh svg{width:54px;height:34px}
.lanh span{font-size:11.5px;line-height:1.2}
.lgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:6px;margin-bottom:8px}
.ltile{display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 4px;border:1px solid var(--line);border-radius:8px;background:var(--field);color:var(--ink);font:inherit;font-size:11.5px;line-height:1.25;text-align:center;cursor:pointer}
.ltile:hover{border-color:var(--accent);background:var(--hover)}
.ltile.on{outline:2px solid var(--accent);outline-offset:-2px;background:var(--hover);font-weight:650}
.ltile svg{width:84px;height:52px;flex:none}
.lpop{position:absolute;left:0;right:0;bottom:calc(100% + 6px);z-index:6;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 8px 0;box-shadow:0 6px 24px rgba(0,0,0,.28);max-height:56vh;overflow:auto}
.lpop .edh{margin-bottom:6px}
.lkr .lka{color:var(--ink);line-height:0}.lkr .lka svg{width:60px;height:38px}
.cnt{display:inline-flex;align-items:center;gap:6px;font-size:12.5px}
.cnt .sec{min-width:32px;padding:4px 0;text-align:center;font-weight:700}
.cnt output{min-width:22px;text-align:center;font:700 14px var(--font-data)}
.noi{font-size:12px;color:var(--muted);margin-top:6px}
.vtools{display:flex;gap:12px;align-items:center;margin:0 2px 6px;flex-wrap:wrap}
.sec.mini{padding:2px 9px;font-size:12px}
.sec:disabled{opacity:.45;cursor:default;border-color:var(--line);background:var(--field)}
.legend{display:flex;gap:10px;flex-wrap:wrap;font-size:11.5px;color:var(--muted);margin:-4px 2px 10px}
.legend i{display:inline-block;width:11px;height:11px;border-radius:2px;margin-right:4px;vertical-align:-1px;border:1px solid rgba(0,0,0,.35)}
.msg{border-radius:8px;padding:7px 9px;margin-bottom:6px;font-size:12.5px;border-left:3px solid}
.msg.err{background:var(--err-bg);color:var(--err);border-color:var(--err-line)}
.msg.warn{background:var(--warn-bg);color:var(--warn);border-color:var(--warn-line)}
.msg.note{background:var(--note-bg);color:var(--note);border-color:var(--note-line)}
.msg.ok{background:var(--ok-bg);color:var(--ok);border-color:var(--ok-line);font-weight:600}
/* phiếu kiểm (bản 1.20): mục nào bảng đã tự kiểm, kết quả từng mục */
.phieu{font-size:12.5px;margin:0 0 8px;border:1px solid var(--line);border-radius:8px;background:var(--card)}
.phieu:empty{display:none}
.phieu summary{cursor:pointer;padding:6px 9px;min-height:30px;color:var(--ink)}
.phieu ul{list-style:none;margin:0;padding:0 9px 8px}
.phieu li{display:flex;gap:6px;align-items:baseline;padding:1px 0;color:var(--ink)}
.phieu .ky{flex:none;width:14px;text-align:center;font-weight:700}
.phieu li.dat .ky{color:var(--ok)}.phieu li.luu_y .ky{color:var(--warn)}.phieu li.loi .ky{color:var(--err)}.phieu li.chua,.phieu .so{color:var(--muted)}
.phieu li.loi{color:var(--err)}
.phieu h4{margin:6px 9px 2px;font-size:11.5px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
.phieu .gc{margin:0;padding:0 9px 6px;color:var(--muted);font-size:12px}
.dlsx{margin-top:14px;padding-top:10px;border-top:1px solid var(--line)}
.dlsx .frow{align-items:center;margin-bottom:8px}
.dlsx .hint{margin:0;flex:1 1 180px}
.xvan{margin-top:14px;padding-top:10px;border-top:1px solid var(--line)}
.xvan .frow{align-items:center;margin-bottom:8px}
.xvan .hint{margin:0;flex:1 1 180px}
.sum{margin:0 0 10px;padding:0 0 0 16px;color:var(--ink);font-size:12.5px}
.sum li{margin-bottom:2px}
.hint{color:var(--muted);font-size:12px;margin:0 0 8px}
code{font-family:var(--font-data);font-size:.95em;background:var(--foot);padding:0 4px;border-radius:4px}
footer{border-top:1px solid var(--line);padding:10px 12px;background:var(--foot);display:flex;flex-direction:column;gap:8px}
.pri{background:var(--accent);color:var(--accent-ink);font:700 14px var(--font);padding:10px 14px;border:0;border-radius:9px;cursor:pointer}
.pri:hover{filter:brightness(1.1)}.pri:disabled{opacity:.45;cursor:not-allowed;filter:none}
.frow{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.frow .sec{flex:1 1 auto;text-align:center}
.at{display:flex;flex-direction:row;align-items:center;gap:6px;font-size:12px;color:var(--ink);white-space:nowrap}
.at input[type=text]{width:64px;height:26px}
.status{font-size:12.5px;color:var(--note);min-height:18px}
.tunoi{font-size:12.5px;color:var(--ok);background:var(--ok-bg);border:1px solid var(--ok-line);border-radius:8px;padding:6px 9px;display:flex;gap:8px;align-items:center;justify-content:space-between}
.tunoi[hidden]{display:none}
.hinhcho{font-size:12.5px;color:var(--ink,inherit);background:var(--warn-bg,#fff7e6);border:1px solid var(--warn-line,#e6c98a);border-radius:8px;padding:6px 9px;display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.hinhcho[hidden]{display:none}
.datrow{align-items:center;gap:10px}
.datrow .datnut{flex:1 1 auto;font-weight:600}
.datrow .chk{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;white-space:nowrap;cursor:pointer}
.hinhcho button{font:inherit;font-size:12px;background:none;border:0;color:inherit;text-decoration:underline;cursor:pointer;padding:2px 4px;min-height:28px}
.tunoi button{font:inherit;font-size:12px;background:none;border:0;color:inherit;text-decoration:underline;cursor:pointer;padding:2px 4px;min-height:28px}
.launch{position:fixed;right:16px;bottom:92px;height:44px;padding:0 16px;border-radius:22px;background:var(--accent);color:var(--accent-ink);font:700 13px var(--font);border:0;box-shadow:0 8px 22px rgba(0,0,0,.45);cursor:pointer;z-index:2147483000}
.chip{position:fixed;top:14px;left:50%;transform:translateX(-50%);background:var(--head);color:var(--head-ink);padding:9px 16px;border-radius:999px;box-shadow:0 8px 22px rgba(0,0,0,.45);z-index:2147483001;font-size:13px;max-width:80vw}
table{border-collapse:collapse;width:100%;font-size:12px}
td,th{padding:3px 6px;border-bottom:1px solid var(--line);text-align:left}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums;font-family:var(--font-data)}
/* thẻ Phòng */
.prow{display:grid;gap:6px;align-items:end;margin-bottom:6px;grid-template-columns:52px minmax(0,1fr) minmax(0,1.25fr) 28px}
.panel[data-tabon="phong"] footer>:not(.status){display:none}
.pkq:empty{display:none}
/* thẻ Kho mẫu + khung đặt mẫu kho + chia ô trên mặt đứng (bản 1.19) */
.panel[data-tabon="kho"] footer>:not(.status){display:none}
.knhom,.kcon{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
.knhom:empty,.kcon:empty{display:none}
.kcon{margin-top:8px;margin-bottom:0}
.knut{padding:3px 10px;border:1px solid var(--line);border-radius:999px;background:var(--field);color:var(--ink);font:inherit;font-size:12px;cursor:pointer;min-height:28px}
.knut:hover{border-color:var(--accent);background:var(--hover)}
.knut.on{background:var(--accent);color:var(--accent-ink);border-color:var(--accent);font-weight:650}
.kluoi{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:8px;margin:8px 0;min-height:48px}
.kluoi .hint{grid-column:1/-1;margin:6px 0}
.kmc{display:flex;flex-direction:column;gap:3px;padding:5px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--ink);font:inherit;font-size:11.5px;line-height:1.25;text-align:center;cursor:pointer;min-width:0}
.kmc:hover{border-color:var(--accent);background:var(--hover)}
.kmc.on{outline:2px solid var(--accent);outline-offset:-2px;background:var(--hover)}
.kmc img{width:100%;aspect-ratio:1/1;object-fit:contain;background:#fff;border-radius:6px;display:block}
.kmc b{font-weight:600;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow-wrap:anywhere}
.kmc small{color:var(--muted);font-variant-numeric:tabular-nums}
.ktrang{justify-content:center;font-size:12.5px;gap:10px}
.ktrang:empty{display:none}
.ktrang .sec{flex:0 0 auto;min-width:44px}
.kmau{display:flex;gap:10px;align-items:center;margin-bottom:8px;font-size:12.5px;min-width:0}
.kmau img{width:84px;height:84px;object-fit:contain;background:#fff;border:1px solid var(--line);border-radius:8px;flex:none}
.kmau div{min-width:0;overflow-wrap:anywhere}
.khochon{font-size:12.5px;background:var(--note-bg);color:var(--note);border:1px solid var(--note-line);border-radius:8px;padding:6px 9px;margin-bottom:8px;display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.khochon[hidden]{display:none}
.khochon button{font:inherit;font-size:12px;background:none;border:0;color:inherit;text-decoration:underline;cursor:pointer;padding:2px 4px;min-height:28px}
.kopt{display:flex;flex-direction:row;align-items:center;gap:6px;font-size:12.5px;color:var(--ink);margin-top:6px;cursor:pointer}
.pcard .kkho{display:flex;gap:8px;align-items:center;margin:0 0 7px;font-size:12.5px;min-width:0}
.pcard .kkho img{width:54px;height:54px;object-fit:contain;background:#fff;border:1px solid var(--line);border-radius:6px;flex:none}
.pcard .kkho div{min-width:0;overflow-wrap:anywhere}
.pcard .kchia{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px;font-size:12px;color:var(--muted)}
.pcard .kchia select{width:auto;min-width:54px;height:28px}
.pcard .kchia .sec{flex:0 0 auto}
.pmdnut{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 8px;font-size:12px;color:var(--muted)}
.pmdnut .sec{flex:0 0 auto}
.pmdnut .sec[aria-pressed="true"]{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.pmd.ve svg{cursor:crosshair;touch-action:none}
.pmd.ve [data-khung],.pmd.ve [data-sua]{pointer-events:none}
.prow~.prow label{font-size:0;gap:0}
.drow{display:grid;gap:6px;align-items:end;margin-bottom:6px;grid-template-columns:minmax(0,1.3fr) 54px minmax(0,1fr) minmax(0,1fr) 28px}
.drow~.drow>label{font-size:0;gap:0}
.drow .dkhac{grid-column:1/-1;display:grid;gap:6px;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr) minmax(0,1fr)}
.dnhom{margin-bottom:4px}.dnhom:empty{display:none}
.pcard{border:1px solid var(--line);border-radius:10px;padding:8px 9px;margin-bottom:8px;background:var(--card)}
.pcard.on{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.pcard .g{margin-bottom:6px}
.pcard .ph{display:flex;align-items:center;gap:8px;margin-bottom:6px}.pcard .ph b{flex:1;font-size:13px}
.pcard .kinfo{font-size:12px;color:var(--muted);margin:2px 0 7px;font-variant-numeric:tabular-nums}
.drop{border:1.5px dashed var(--line);border-radius:10px;padding:10px;text-align:center;color:var(--muted);font:inherit;font-size:12.5px;background:var(--card);cursor:pointer;width:100%;display:block}
.drop:hover,.drop.keo{border-color:var(--accent);background:var(--hover);color:var(--ink)}
.thumbs{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.thumbs:empty{display:none}
.thumb{position:relative;width:72px;height:72px;border-radius:8px;overflow:hidden;border:1px solid var(--line);background:var(--card)}
.thumb.on{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent)}
.thumb button.im{display:block;width:100%;height:100%;padding:0;border:0;background:none;cursor:zoom-in}
.thumb img{width:100%;height:100%;object-fit:cover;display:block}
.thumb .x{position:absolute;top:2px;right:2px;background:rgba(0,0,0,.6);color:#fff;border-radius:50%;width:22px;height:22px;padding:0;font-size:11px;line-height:22px}
.pmb,.pmd{background:var(--sheet);border:1px solid var(--line);border-radius:10px;padding:6px;margin-bottom:8px;text-align:center}
.pmb svg,.pmd svg{display:block;margin:0 auto;max-width:100%;height:auto}
.pmd:empty{display:none}
.pdim{position:absolute;z-index:5;box-sizing:border-box;height:30px;padding:2px 6px;font:inherit;font-size:14px;text-align:center;border:2px solid var(--accent);border-radius:6px;background:var(--card);color:var(--ink);box-shadow:0 2px 8px rgba(0,0,0,.25)}
.pma{width:100%;min-height:92px;font:12px var(--font-data);padding:6px 8px;border:1px solid var(--line);border-radius:7px;background:var(--field);color:var(--ink);resize:vertical}
.xem{position:fixed;top:10px;bottom:10px;left:10px;right:468px;background:rgba(18,22,26,.95);border-radius:12px;z-index:2147482999;display:flex;flex-direction:column;overflow:hidden;color:#e8edf2;font:13px/1.45 var(--font)}
.xem[hidden]{display:none}
.xem.rong{right:1060px}
.xemh{display:flex;gap:6px;align-items:center;padding:6px 8px 6px 12px}
.xemh span{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.xemb{flex:1;overflow:auto;display:flex;align-items:center;justify-content:center;min-height:0}
.xemb img{max-width:100%;max-height:100%;object-fit:contain;cursor:zoom-in;display:block}
.xemb.to{display:block}.xemb.to img{max-width:none;max-height:none;cursor:zoom-out}
@media (max-width:900px){.xem,.xem.rong{right:10px}}
.mn.page .xem{right:10px}
.panel.wide .psplit{display:grid;grid-template-columns:minmax(0,400px) minmax(0,1fr);column-gap:14px;align-items:start}
.panel.wide .psplit .pview{order:2;position:sticky;top:0}
@media (min-width:900px){.mn.page .psplit{display:grid;grid-template-columns:minmax(0,430px) minmax(0,1fr);column-gap:16px;align-items:start}.mn.page .psplit .pview{order:2;position:sticky;top:12px}}
/* thẻ Màu (bản 1.21): 3 ô màu (thùng / cánh + phào / hậu), danh sách màu của kho vật liệu, màu đang dùng trên bản vẽ */
.panel[data-tabon="mausac"] footer>:not(.status){display:none}
.vlos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:8px}
.vlo{position:relative;display:flex;min-width:0;border:1px solid var(--line);border-radius:9px;background:var(--card)}
.vlo.on{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent);background:var(--hover)}
.vlob{flex:1;min-width:0;display:flex;gap:7px;align-items:center;padding:6px 7px;border:0;border-radius:9px;background:none;color:var(--ink);font:inherit;font-size:12px;line-height:1.25;text-align:left;cursor:pointer}
.vlob img,.vlob i{width:30px;height:30px;flex:none;border-radius:6px;border:1px solid var(--line);object-fit:cover;display:block}
.vlob i,.vlg i,.vld i{background:repeating-linear-gradient(45deg,var(--field),var(--field) 4px,var(--foot) 4px,var(--foot) 8px)}
.vlob span{min-width:0;display:flex;flex-direction:column}
.vlob small{color:var(--muted);font-size:11px;white-space:nowrap}
.vlob b{font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vlob b.tr{font-weight:400;color:var(--muted)}
.vlo .x{position:absolute;top:0;right:0;padding:1px 5px;font-size:11px}
.vlds{display:grid;grid-template-columns:repeat(auto-fill,minmax(58px,1fr));gap:6px;max-height:268px;overflow:auto;padding:2px;margin:8px 0 6px;overscroll-behavior:contain}
.vlds:empty{display:none}
.vlds .hint{grid-column:1/-1;margin:6px 0}
.vlc{display:flex;flex-direction:column;gap:2px;padding:3px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);font:inherit;font-size:10.5px;line-height:1.2;text-align:center;cursor:pointer;min-width:0}
.vlc:hover{border-color:var(--accent);background:var(--hover)}
.vlc.on{outline:2px solid var(--accent);outline-offset:-2px;background:var(--hover)}
.vlc img{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:5px;display:block;background:var(--field)}
.vlc b{font-weight:600;overflow-wrap:anywhere}
.vlgan,.vldung{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0}
.vlgan:empty,.vldung:empty{display:none}
.vlgan>span{font-size:11.5px;color:var(--muted)}
.vldung .hint{margin:0}
.vlg,.vld{display:inline-flex;align-items:center;gap:5px;padding:2px 9px 2px 3px;border:1px solid var(--line);border-radius:999px;background:var(--field);color:var(--ink);font:inherit;font-size:12px;cursor:pointer;min-height:28px}
.vlg:hover,.vld:hover{border-color:var(--accent);background:var(--hover)}
.vlg img,.vlg i,.vld img,.vld i{width:20px;height:20px;flex:none;border-radius:50%;border:1px solid var(--line);object-fit:cover;display:block}
.vld.on{background:var(--accent);color:var(--accent-ink);border-color:var(--accent);font-weight:650}
.vlchan{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;font-size:12px;color:var(--muted)}
.vlchan .frow{gap:6px;margin-left:auto}
.vlthay{font-size:12.5px;margin:8px 0}
.vlthay b{font-family:var(--font-data)}
[data-ui="vl-kq"]{margin-top:8px}
[data-ui="vl-kq"]:empty{display:none}
/* trang độc lập */
.mn.page{display:block}
.mn.page .panel{position:static;width:auto;max-width:1180px;margin:0 auto;box-shadow:0 2px 14px rgba(0,0,0,.14)}
.mn.page .body{overflow:visible}
.dims{grid-area:dims}.colv{grid-area:view;min-width:0;position:relative}.colf{grid-area:rest;min-width:0}
@media (min-width:900px){.mn.page .lkr{grid-template-columns:minmax(0,1.1fr) minmax(0,1.3fr) 104px 28px;grid-template-areas:"ten ts id x" "md md md md"}.mn.page .split{display:grid;grid-template-columns:minmax(0,430px) minmax(0,1fr);grid-template-areas:"dims view" "rest view";grid-template-rows:auto 1fr;column-gap:16px;align-items:start}.mn.page .colv{position:sticky;top:12px}.mn.page .seg{grid-template-columns:repeat(4,auto)}}
/* bảng nổi trong Chenfeng, chế độ rộng: hình đứng to để kéo đợt cho dễ */
.panel.wide{width:1040px}
.panel.wide .split{display:grid;grid-template-columns:minmax(0,380px) minmax(0,1fr);grid-template-areas:"dims view" "rest view";grid-template-rows:auto 1fr;column-gap:14px;align-items:start}
.panel.wide .colv{position:sticky;top:0}
.panel.wide .seg{grid-template-columns:repeat(4,auto)}
.panel.wide .lkr{grid-template-columns:minmax(0,1.1fr) minmax(0,1.3fr) 104px 28px;grid-template-areas:"ten ts id x" "md md md md"}
@media (max-width:520px){.g4{grid-template-columns:repeat(2,minmax(0,1fr))}.g3{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (prefers-reduced-motion:no-preference){.sec,.pri,.tab,.segb{transition:background-color .12s,border-color .12s,filter .12s}}
`;

  const F = (path, label, opt) => Object.assign({ path, label }, opt || {});
  const SETTINGS = [
    ['Tên gọi', [F('ten', 'Tên tủ', { text: 1, span: 2 }), F('ma', 'Mã tủ (tên tủ trong Chenfeng)', { text: 1 }), F('phong', 'Tên phòng', { text: 1 })]],
    ['Ván', [F('van.t', 'Dày ván thùng'), F('van.t_canh', 'Dày cánh / phào mặt'), F('van.kho_dai', 'Khổ ván dài'), F('van.kho_rong', 'Khổ ván rộng'), F('van.dan_canh', 'Dán cạnh (mm)', { text: 1 }), F('van.ten_van', 'Tên ván', { text: 1 }), F('van.vat_lieu', 'Vật liệu', { text: 1 }), F('van.mau', 'Màu', { text: 1 })]],
    ['Hậu', [F('hau.kieu', 'Kiểu hậu', { select: [['phu', 'Mỏng, phủ sau lưng thùng, bắn đinh (chuẩn xưởng)'], ['day', 'Dày, lọt lòng từng khoang (khoan cam)'], ['mong', 'Mỏng, soi rãnh']], span: 2 }),
      F('hau.t', 'Dày hậu'),
      F('hau.mep', 'Mép hậu lùi vào so với mép ngoài thùng', { khi: s => s.hau.kieu === 'phu' }),
      F('hau.chia', 'Chia tấm hậu (mối nối nằm trên vách)', { select: [['khoang', 'Mỗi khoang 1 tấm'], ['kho_van', 'Gộp khoang cho vừa khổ ván (ít tấm nhất)']], span: 2, khi: s => s.hau.kieu === 'phu' }),
      F('hau.lui', 'Hậu cách mép sau thùng', { khi: s => s.hau.kieu === 'mong' }), F('hau.ranh_sau', 'Hậu ăn vào rãnh', { khi: s => s.hau.kieu === 'mong' }), F('hau.ranh_ho', 'Rãnh rộng hơn hậu', { khi: s => s.hau.kieu === 'mong' }),
      F('hau.ten_van', 'Tên ván hậu (trống = như ván thùng)', { text: 1 }), F('hau.vat_lieu', 'Vật liệu hậu', { text: 1 }), F('hau.mau', 'Màu hậu', { text: 1 })],
      s => (s.hau.kieu === 'phu' ? `Hậu ốp lên mép sau của hồi, vách, đáy, nóc rồi bắn đinh từ đằng sau; Chenfeng không khoan cam cho hậu. Thùng lùi lại đúng bằng dày hậu, nên sâu thùng ${hien(s.sau_thung)} = hồi sâu ${hien(s.sau_thung - s.hau.t)} + hậu ${hien(s.hau.t)}.`
        : s.hau.kieu === 'day' ? 'Hậu cùng độ dày ván thùng, lọt lòng từng khoang, bắt cam vào hồi / vách / đáy / nóc.' : 'Hậu mỏng lồng vào rãnh soi trên hồi, vách, đáy, nóc.')],
    ['Phào', [F('phao.phu_tro', 'Rộng thanh phụ trợ (0 = không)'), F('phao.noi', 'Nối thanh ngang dài', { select: [['moi_vach', 'Tại mọi vách (đối xứng)'], ['it_nhat', 'Ít mối nối nhất']], span: 2 })]],
    ['Thùng', [F('thung.rong_max', 'Rộng tối đa một thùng (0 = không tách, thùng liền)', { span: 2 })],
      () => 'Tủ rộng hơn số này được tách thành các thùng rời: mỗi thùng có 2 hồi của nó, chỗ tách là 2 hồi áp lưng; các khoang nhỏ còn nằm trong số này thì chung một thùng (vách chung). Phào và chân trước vẫn là khung chung cho cả dãy.'],
    ['Dò lỗi sản xuất — ngưỡng cảnh báo (0 = không kiểm mục đó)', [F('kiem.dot_max', 'Khoang lọt lòng tối đa (nhịp đợt)'), F('kiem.canh_cao_max', 'Cánh cao tối đa'), F('kiem.nk_rong_max', 'Hộp ngăn kéo rộng tối đa'), F('kiem.suot_sau_min', 'Khoang treo: sâu lọt lòng tối thiểu'), F('kiem.tran', 'Cao trần chỗ đặt tủ (0 = không biết; thẻ Phòng tự điền khi mở khung thành tủ)', { span: 2 })],
      s => `Vượt ngưỡng thì bảng CẢNH BÁO (dòng vàng), tủ vẫn vẽ được: khoang rộng hơn ${hien(s.kiem.dot_max)} thì đợt, đáy, nóc dễ võng; cánh cao hơn ${hien(s.kiem.canh_cao_max)} dễ cong; hộp ngăn kéo rộng hơn ${hien(s.kiem.nk_rong_max)} thì ray và đáy dễ võng; khoang treo nông hơn ${hien(s.kiem.suot_sau_min)} thì móc áo chạm cánh. Biết trần thì bảng kiểm thêm thân tủ ráp nằm rồi lật đứng có lọt trần không. Lỗi thật (tấm vượt khổ ván, tấm đè nhau, tấm lơ lửng…) luôn khoá nút Vẽ, không phụ thuộc các số này.`],
    ['Cách vẽ vào Chenfeng', [F('ve_goc', 'Vẽ bằng LỆNH GỐC của Chenfeng (hồi, vách, nóc đáy, hậu, đợt, cánh là tấm tự động — bấm vào tấm nào sửa được tấm đó như tủ vẽ tay). Bỏ chọn = cách cũ: nhập tấm rồi gom thành module.', { check: 1, span: 2 }), F('module_cf', 'Vẽ xong gom CẢ TỦ thành một module tham số (đổi Rộng / Sâu / Cao ở ô Thông số bên phải của Chenfeng là cả tủ chạy theo) — dùng cho cả hai cách vẽ', { check: 1, span: 2 })]],
    ['Cánh', [F('canh.khe', 'Khe cánh–cánh, cánh–phào'), F('canh.khe_bien', 'Khe mép ngoài (khi không phào)'), F('canh.chen_ban_le', 'Khoét chén bản lề Ø35 (thử nghiệm)', { check: 1, span: 2 }), F('canh.chen.tam_mep', 'Chén: tâm cách mép'), F('canh.chen.sau', 'Chén: sâu'), F('canh.chen.cach_dau', 'Chén: cách đầu cánh'), F('canh.chen.d', 'Chén: đường kính')]],
    ['@loai'],      // bảng "Các loại ngăn kéo" — vẽ riêng (renderLoai)
    ['Ngăn kéo — số chung', [F('ngan_keo.buoc_sau', 'Sâu hộp làm tròn theo bước (dài ray)'), F('ngan_keo.ho_sau', 'Hộp cách hậu ít nhất')]],
    ['Ngăn kéo âm (nằm sau cánh)', [F('ngan_keo.lui', 'Lưng mặt NK cách mặt trước thùng'), F('ngan_keo.khe_ben', 'Khe 2 bên mặt'), F('ngan_keo.dem', 'Vách đệm tránh bản lề: mặt trong cách hồi/vách (0 = không đệm)', { span: 2 }), F('ngan_keo.khe_tren', 'Khe trên'), F('ngan_keo.khe_giua', 'Khe giữa 2 mặt'), F('ngan_keo.khe_duoi', 'Khe dưới'), F('ngan_keo.xa_cao', 'Xà sau khe mặt NK: cao (0 = không làm xà)', { span: 2 }), F('ngan_keo.xa_ho', 'Xà cách lưng mặt NK'), F('ngan_keo.nep_khe', 'Nẹp che khe 2 bên hộc kéo (1 = có, 0 = để hở)', { span: 2 })]],
    ['Suốt treo (mẫu Chenfeng)', [F('suot.mau_id', 'Mã mẫu suốt treo'), F('suot.cach_dot', 'Bas cách đợt trên')]],
    ['Kiểu khoan (tên trong "Khoan hàng lỗ" của Chenfeng)', [F('khoan.thung', 'Thùng, chân (và hậu dày)', { text: 1, list: 'drill' }), F('khoan.phao', 'Phào + thanh phụ trợ', { text: 1, list: 'drill' })]],
    ['Tên tấm', ['hoi_trai', 'hoi_phai', 'vach', 'day', 'noc', 'dot', 'hau', 'chan', 'phao_trai', 'phao_phai', 'phao_tren', 'phu_tro', 'canh_trai', 'canh_phai', 'dem', 'xa', 'nep'].map(k => F('ten_tam.' + k, k.replace(/_/g, ' '), { text: 1 }))],
  ];

  /* ---- đổ màu (bản 1.21): ba nhóm tấm của một tủ + dòng "thùng 21 tấm → 103T · cánh + phào 5 tấm → …" dùng chung cho thẻ Màu và thẻ Kết quả ---- */
  const NHOM_MAU = [['thung', 'Thùng'], ['mat', 'Cánh + phào'], ['hau', 'Hậu']];
  const dongMau = r => NHOM_MAU.filter(([k]) => r.mau && r.mau[k] && r.so && r.so[k] > 0).map(([k, t]) => `${t.toLowerCase()} ${r.so[k]} tấm → ${r.mau[k]}`).join(' · ');
  const khoaMau = r => (r && r.khoa ? ` ${r.khoa} tấm đang khoá vật liệu trong Chenfeng nên giữ màu cũ.` : '');
  // hai dòng của thẻ Kết quả: màu của tủ cũ được giữ khi "Cập nhật tủ này" (rep.giu_mau), và tủ / mẫu kho vẽ mới tự đổ màu theo các ô của thẻ Màu (rep.do_mau)
  function mauVeHTML(rep) {
    const h = [], g = rep.giu_mau, d = rep.do_mau;
    if (g && g.ok) h.push(`<div class="msg note">Đã giữ màu của tủ cũ: ${esc(dongMau(g))}.${esc(khoaMau(g))}${(g.lan || []).map(k => ` ${esc((NHOM_MAU.find(N => N[0] === k) || [0, k])[1])} của tủ cũ có nhiều màu — tủ mới lấy màu nhiều tấm nhất; tấm nào đổ màu riêng thì đổ lại ở thẻ Màu.`).join('')}</div>`);
    else if (g) h.push(`<div class="msg warn">Tủ cũ đã đổ màu (${esc(NHOM_MAU.filter(N => g.mau && g.mau[N[0]]).map(N => `${N[1].toLowerCase()} ${g.mau[N[0]]}`).join(', '))}) nhưng tủ vẽ lại chưa đổ lại được: ${esc(g.reason || '')} Vào thẻ Màu → chọn 1 tấm của tủ → Đổ màu tủ đang chọn.</div>`);
    if (d && d.ok) h.push(`<div class="msg note">Đã tự đổ màu: ${esc(dongMau(d) || 'không có tấm nào thuộc nhóm đã chọn màu')}.${esc(khoaMau(d))} Đổi màu hoặc tắt tự đổ ở thẻ <b>Màu</b>.</div>`);
    else if (d) h.push(`<div class="msg warn">Chưa tự đổ màu được: ${esc(d.reason || '')}</div>`);
    return h.join('');
  }

  /* ---- phiếu kiểm (bản 1.20) ---- */
  const KY_KIEM = { dat: '✓', luu_y: '!', loi: '✗', chua: '…' };
  const phieuTom = d => [d.dat ? `${d.dat} mục đạt` : '', d.luu_y ? `${d.luu_y} mục cần xem` : '', d.loi ? `${d.loi} mục lỗi` : '', d.chua ? `${d.chua} mục chưa kiểm` : ''].filter(Boolean).join(' · ');
  const phieuMuc = ds => ds.filter(m => m.ket !== 'khong').map(m => `<li class="${m.ket}"><span class="ky">${KY_KIEM[m.ket] || ''}</span><span>${esc(m.ten)}${m.tin && m.tin.length ? ` <span class="so">(${m.tin.length} dòng báo)</span>` : m.ket === 'chua' ? ' <span class="so">(chưa kiểm — sửa lỗi trước)</span>' : ''}</span></li>`).join('');
  function phieuHTML(ph, tieuDe) { return `<summary>${esc(tieuDe)}: <b>${esc(phieuTom(ph.dem) || 'chưa kiểm được')}</b></summary><ul>${phieuMuc(ph.muc)}</ul>`; }
  // Phiếu dò lỗi trên TẤM THẬT (bản 1.20 — Core.doLoiThat): phiếu + ghi chú nằm trong <details>; các dòng báo của mục lỗi / lưu ý hiện ngay bên dưới để khỏi phải mở phiếu mới thấy.
  // boDau = bỏ dòng đầu của mỗi mục lỗi (lần vẽ đã nêu dòng đó ở danh sách lỗi).
  function phieuVeHTML(p, tieuDe, ui, mo) { return `<details class="phieu" data-ui="${ui}"${mo ? ' open' : ''}>${phieuHTML(p, tieuDe)}${(p.ghi || []).map(t => `<p class="gc">${esc(t)}</p>`).join('')}</details>`; }
  // boMuc = các mục mà lần vẽ đã có dòng cảnh báo riêng (vd "tấm chưa có lỗ khoan") — khỏi nêu hai lần.
  function dongDoLoi(p, boDau, boMuc) { const h = []; for (const m of p.muc) { if ((m.ket !== 'loi' && m.ket !== 'luu_y') || (boMuc && boMuc.indexOf(m.ma) >= 0)) continue; m.tin.slice(m.ket === 'loi' && boDau ? 1 : 0).forEach(t => h.push(`<div class="msg ${m.ket === 'loi' ? 'err' : 'warn'}">${esc(t)}</div>`)); } return h.join(''); }

  function App(mode) {
    const inCF = mode === 'panel';
    const coKho = inCF && !!Drv && typeof Drv.veKho === 'function' && typeof Drv.khoMau === 'function';      // thẻ Kho mẫu: chỉ trong Chenfeng (đọc kho bằng phiên đăng nhập của trang)
    const coMau = inCF && !!Drv && typeof Drv.khoVatLieu === 'function' && typeof Drv.doMauTu === 'function';      // thẻ Màu: chỉ trong Chenfeng (đọc kho vật liệu bằng phiên đăng nhập của trang)
    // Thẻ Màu nhớ trong máy: màu của 3 ô, ô đang bật, các màu vừa dùng, có tự đổ màu cho tủ vẽ mới không. Mỗi màu = { id (mã vật liệu trong kho), ten (mã màu), nhom, hinh }.
    const mauS = { o: { thung: null, mat: null, hau: null }, bat: 'thung', gan: [], tu_dong: false };
    if (coMau) {
      try {
        const j = JSON.parse(root.localStorage.getItem(LS_MAU) || 'null'), mk = m => (m && m.ten ? { id: String(m.id || ''), ten: String(m.ten), nhom: String(m.nhom || ''), hinh: /^https:\/\//.test(m.hinh || '') ? String(m.hinh) : '' } : null);
        if (j && typeof j === 'object') { for (const [k] of NHOM_MAU) mauS.o[k] = mk(j.o && j.o[k]); if (NHOM_MAU.some(N => N[0] === j.bat)) mauS.bat = j.bat; mauS.gan = (Array.isArray(j.gan) ? j.gan : []).map(mk).filter(Boolean).slice(0, 8); mauS.tu_dong = !!j.tu_dong; }
      } catch (e) { /* không đọc được thì bắt đầu trống */ }
    }
    const luuMau = () => { try { root.localStorage.setItem(LS_MAU, JSON.stringify(mauS)); } catch (e) { /* không lưu được thì thôi */ } };
    const daLuu = store.load();
    let spec = Core.normalize(daLuu.spec || undefined);
    let model = null, showDoors = true, busy = false, lastRep = null;
    let noi = null;            // tủ trên bản vẽ mà bảng đang nối tới: { id, spec (thông số LÚC VẼ), ten } — nút "Cập nhật tủ này" sửa đúng tủ đó
    let sel = null;            // đang chọn: null | {loai:'o', khoang, tu} | {loai:'dot', khoang, idx}
    let drag = null, dragEnd = 0, dotSnap = null, barHTML = null;
    let wide = false; if (inCF) { try { wide = root.localStorage.getItem(LS_WIDE) === '1'; } catch (e) { /* bỏ qua */ } }
    const host = document.createElement('div');
    host.id = 'mncf-host';
    const sh = host.attachShadow({ mode: 'open' });
    const rootEl = document.createElement('div');
    rootEl.className = 'mn' + (inCF ? '' : ' page');
    const style = document.createElement('style'); style.textContent = CSS;
    sh.append(style, rootEl);
    // Chenfeng nghe phím và chuột ở window/document: chặn để gõ trong bảng không thành lệnh CAD
    for (const ev of ['keydown', 'keyup', 'keypress', 'wheel', 'mousedown', 'dblclick', 'contextmenu', 'pointerdown', 'paste', 'copy', 'cut'])
      host.addEventListener(ev, e => e.stopPropagation());
    // Nhả chuột: chỉ chặn khi lần bấm bắt đầu trong bảng. Người dùng đang kéo dở trong Chenfeng (xoay hình, quét chọn…) rồi nhả chuột trên bảng thì Chenfeng phải nhận được, không thì lệnh kéo bị kẹt.
    let bamTrongBang = false;
    const ghiNoiBam = e => { try { bamTrongBang = e.composedPath().indexOf(host) >= 0; } catch (err) { bamTrongBang = false; } };
    root.addEventListener('pointerdown', ghiNoiBam, true); root.addEventListener('mousedown', ghiNoiBam, true);
    for (const ev of ['mouseup', 'pointerup']) host.addEventListener(ev, e => { if (bamTrongBang) e.stopPropagation(); });
    // Không để lỗi nào lọt ra trang: Chenfeng có bộ theo dõi lỗi toàn trang (window.onerror / unhandledrejection) sẽ gửi báo cáo + bản sao bản vẽ về máy chủ của họ.
    const safe = fn => function (e) { try { const r = fn.call(this, e); if (r && typeof r.then === 'function') r.catch(err => setStatus('Lỗi: ' + (err && err.message || err))); } catch (err) { try { setStatus('Lỗi: ' + (err && err.message || err)); } catch (e2) { /* bỏ qua */ } } };

    const fid = k => 'mncf-' + String(k).replace(/[^\w]+/g, '-');
    const numField = (path, label, extra) => `<label>${esc(label)}<input type="text" inputmode="decimal" id="${fid(path)}" data-k="${path}" value="${esc(fmt(getP(spec, path)))}" ${extra || ''}></label>`;

    rootEl.innerHTML = `
<button class="launch" ${inCF ? '' : 'hidden'} title="Mở bảng vẽ tủ (Alt + M)">Một Nhà · Vẽ tủ</button>
<div class="chip" hidden></div>
<section class="panel${wide ? ' wide' : ''}" ${inCF ? 'hidden' : ''} aria-label="Một Nhà — vẽ tủ vào Chenfeng">
  <header>
    <div class="hrow"><div class="brand">Một Nhà <span>· Vẽ tủ vào Chenfeng · v${Core.VERSION}</span></div>
      ${inCF ? `<button class="ibtn" data-act="wide" title="Đổi bề rộng bảng — bảng rộng thì hình đứng to, kéo đợt dễ hơn">${wide ? 'Thu hẹp' : 'Mở rộng'}</button><button class="ibtn" data-act="close" title="Thu gọn (Alt + M)">—</button>` : ''}</div>
    <div class="tabs"><button class="tab on" data-tab="tu">Tủ</button>${Ph ? '<button class="tab" data-tab="phong">Phòng</button>' : ''}${coKho ? '<button class="tab" data-tab="kho">Kho mẫu</button>' : ''}${coMau ? '<button class="tab" data-tab="mausac">Màu</button>' : ''}<button class="tab" data-tab="chuan">Chuẩn xưởng</button><button class="tab" data-tab="kq">Kết quả</button><button class="tab" data-tab="hd">Hướng dẫn</button></div>
  </header>
  <div class="body">
    <div class="pane" data-pane="tu">${inCF ? '' : '<p class="hint">Mở lần đầu là <b>tủ mẫu</b> (tủ áo 3000 × 2800, 3 khoang). Nhập kích thước, rồi <b>kéo đợt ngay trên hình</b> và bấm vào từng ô để đặt ngăn kéo, suốt treo — cảnh báo và bảng kê tự cập nhật.</p>'}<div class="split">
      <fieldset class="dims"><legend>Kích thước phủ bì (mm)</legend><div class="g g3">${numField('rong', 'Rộng (kể cả phào)')}${numField('cao', 'Cao (kể cả phào)')}${numField('sau_thung', 'Sâu thùng (chưa cánh)')}</div></fieldset>
      <div class="colv">
        <div class="vtools"><label class="row"><input type="checkbox" id="mncf-ui-doors" data-ui="doors" checked> Hiện cánh</label><button class="sec mini" data-act="them-vach" aria-pressed="false" title="Bật rồi bấm vào chỗ bất kỳ trong tủ trên hình: thêm một vách đứng (hồi giữa) tại đó, khoang được chia đôi. Bấm lại nút hoặc Esc để thôi.">＋ Vách</button><button class="sec mini" data-act="lui" disabled title="Lùi lại thao tác vừa làm trên hình (Ctrl+Z)">↶ Lùi</button><span class="hint" style="margin:0 0 0 auto">Hình đứng — kéo thả trực tiếp</span></div>
        <div class="view" tabindex="0" role="group" aria-label="Hình đứng của tủ. Kéo đợt để chia ô, bấm vào ô để đặt ngăn kéo hoặc suốt treo. Bàn phím: phím mũi tên để chọn ô."></div>
        <div class="edbar"></div><div class="edprobe" aria-hidden="true"></div>
        <div class="legend" title="Màu theo loại tấm, giống khung nhìn của Chenfeng">${Core.MAU_CHU_GIAI.map(([t, c]) => `<span><i style="background:${c}"></i>${esc(t)}</span>`).join('')}</div>
        <div class="msgs"></div><details class="phieu" data-ui="phieu"></details><ul class="sum"></ul>
      </div>
      <div class="colf">
        <fieldset><legend>Mẫu tủ áo dựng sẵn</legend><div class="frow"><select id="mncf-ui-mau" data-ui="mau" aria-label="Chọn mẫu tủ áo" style="flex:1;min-width:0">${Core.MAU_TU.map(m => `<option value="${esc(m.ma)}" title="${esc(m.mo_ta)}">${esc(m.ten)}</option>`).join('')}</select><button class="sec" data-act="mau" title="Thay kích thước và các khoang bằng mẫu đang chọn. Chuẩn xưởng giữ nguyên.">Dùng mẫu</button></div><p class="hint" data-ui="mau-mota" style="margin:6px 0 0"></p></fieldset>
        <fieldset><legend>Phào, chân, chia thân</legend><div class="g g3">${numField('phao.trai', 'Phào trái')}${numField('phao.phai', 'Phào phải')}${numField('phao.tren', 'Phào trên')}${numField('chan.cao', 'Chân (xà trước)')}${numField('than.cao_duoi', 'Cao thân dưới', 'title="Tủ cao hơn khổ ván thì chia thân dưới + thân kịch trần tại cao độ này. 0 = một thân."')}</div></fieldset>
        <fieldset><legend>Khấu cột (cột sát tường sau: ở góc hoặc giữa tủ)</legend><div class="g g3">${numField('khau.trai.rong', 'Cột TRÁI: lấn ngang', 'placeholder="0 = không" title="Cột lấn vào tủ bao nhiêu theo chiều ngang, đo từ mép ngoài phủ bì bên trái (kể cả phào)"')}${numField('khau.trai.sau', 'Cột TRÁI: lấn sâu', 'title="Cột lấn vào tủ bao nhiêu theo chiều sâu, đo từ lưng tủ"')}${numField('khau.ho', 'Khe hở quanh cột', 'title="Khe chừa giữa cột và tủ, cả mặt bên lẫn mặt trước cột. Mặc định 15; thường để 10–20 để lúc lắp còn chỗ xử lý (cột, tường không phẳng) rồi bắn nẹp / bơm keo che khe"')}${numField('khau.phai.rong', 'Cột PHẢI: lấn ngang', 'placeholder="0 = không" title="Đo từ mép ngoài phủ bì bên phải"')}${numField('khau.phai.sau', 'Cột PHẢI: lấn sâu')}${numField('khau.giua.0.cach', 'Cột GIỮA 1: cách mép trái', 'title="Khoảng cách từ mép ngoài phủ bì bên trái của tủ tới mặt trái của cột"')}${numField('khau.giua.0.rong', 'Cột GIỮA 1: rộng', 'placeholder="0 = không"')}${numField('khau.giua.0.sau', 'Cột GIỮA 1: sâu', 'title="Cột lấn vào tủ bao nhiêu theo chiều sâu, đo từ lưng tủ"')}${numField('khau.giua.1.cach', 'Cột GIỮA 2: cách mép trái')}${numField('khau.giua.1.rong', 'Cột GIỮA 2: rộng', 'placeholder="0 = không"')}${numField('khau.giua.1.sau', 'Cột GIỮA 2: sâu')}</div>
          <div class="frow" style="margin-top:6px"><button class="sec" data-act="vach-cot" title="Dời / thêm vách cho trùng hai mép của cột giữa: khoang trước cột thành khoang nông, mọi tấm cắt thẳng, không phải khoét chữ U">Đặt vách theo mép cột giữa</button></div>
          <p class="hint" style="margin:6px 0 0">Gõ kích thước cột (ngang × sâu), 0 = không khấu. Hồi phía cột nông lại, nóc / đáy / đợt khoét góc chữ L, thêm <b>vách khấu</b> dọc mặt bên cột và <b>hậu khấu</b> trước mặt cột — cả hai đều là <b>ván thùng</b> (không dùng hậu 6 li cho phần khấu) — xem hình "nhìn từ trên xuống" dưới hình đứng. Vách nào có mặt trùng mép cột thì chính vách đó làm vách khấu. <b>Cột giữa tủ</b>: cột lọt giữa một khoang thì đáy / nóc / đợt khoét <b>chữ U</b> và có 2 vách khấu; bấm <b>Đặt vách theo mép cột giữa</b> để hai vách trùng hai mép cột — khoang trước cột thành khoang nông, tấm nào cũng cắt thẳng (dễ làm nhất).</p></fieldset>
        <fieldset><legend>Khoang, từ trái sang phải</legend><div class="bays"></div>
          <div class="frow"><button class="sec" data-act="add">+ Thêm khoang</button><button class="sec" data-act="reset">Về tủ mẫu</button></div></fieldset>
      </div>
    </div></div>
    ${Ph ? `<div class="pane" data-pane="phong" hidden>
      <p class="hint">Dựng <b>phòng hiện trạng</b> theo số đo anh tự điền, rồi đánh dấu các <b>khung không gian</b> (chỗ đặt tủ) và vẽ tủ vào đúng khung. Đi vòng quanh phòng <b>theo chiều kim đồng hồ</b>: đứng trong phòng nhìn vào một tường thì tường kế tiếp nằm bên tay phải. Mọi khoảng "cách trái" đo từ đầu trái của tường. Đơn vị mm.</p>
      <div class="psplit">
        <div class="pview">
          <fieldset><legend>Ảnh hiện trạng (để nhìn mà điền)</legend>
            <button class="drop" data-act="anh-chon">Kéo ảnh vào đây, dán (Ctrl+V) hoặc bấm để chọn ảnh</button>
            <input type="file" id="mncf-ui-anh" accept="image/*" multiple data-ui="anh-file" hidden>
            <div class="thumbs"></div></fieldset>
          <fieldset><legend>Mặt bằng + mặt đứng — bấm vào <b>số đo</b> để gõ lại · bấm vào tường để xem mặt đứng của tường đó</legend><div class="pmb"></div><div class="pmdnut"><button class="sec mini" data-act="k-ve-md" aria-pressed="false" title="Bật rồi KÉO CHUỘT trên mặt đứng bên dưới để vẽ một khung (ô) mới ngay trên mặt tường — vách tivi, đầu giường. Số bắt chẵn 10, bám mép tường và mép khung sẵn có. Bấm lại nút hoặc Esc để thôi.">＋ Vẽ khung trên mặt đứng</button><span>Bấm vào số của khung trên mặt đứng để gõ lại · chia ô, chọn mẫu kho ở thẻ của khung</span></div><div class="pmd"></div><div class="pmsgs"></div><ul class="sum psum"></ul>${inCF ? '<div class="frow" style="margin-bottom:8px"><button class="pri" data-act="p-ve" style="flex:2" title="Vẽ tường, cửa, cột, dầm vào bản vẽ đang mở bằng lệnh phòng của Chenfeng (thẻ House Design). Chenfeng tự chuyển sang nhìn từ trên.">Vẽ phòng vào Chenfeng</button><button class="sec" data-act="p-hoantac" disabled title="Bỏ phòng vừa vẽ khỏi bản vẽ">Hoàn tác phòng</button></div><div class="pkq"></div>' : ''}</fieldset>
        </div>
        <div class="pform"></div>
      </div>
      <div class="frow"><button class="sec" data-act="p-luu" title="Lưu phòng này thành file để dùng lại / gửi cho người khác">Lưu phòng</button><button class="sec" data-act="p-mo" title="Mở file phòng đã lưu">Mở phòng</button><button class="sec" data-act="p-dan" title="Dán mã phòng (JSON) — vd mã do Claude đọc từ ảnh hiện trạng">Dán mã phòng</button><button class="sec" data-act="p-chep" title="Chép mã phòng để gửi đi">Chép mã</button><button class="sec" data-act="p-mau" title="Bỏ phòng đang điền, về phòng mẫu 3600 × 3000">Phòng mẫu</button></div>
      <div class="pdan" hidden style="margin-top:8px"><textarea class="pma" id="mncf-ui-pma" aria-label="Mã phòng" placeholder='Dán mã phòng vào đây, vd {"ten":"Phòng ngủ","cao":2700,"tuong":[{"dai":3600},{"dai":3000},{"dai":3600},{"dai":"auto"}]}'></textarea><div class="frow" style="margin-top:6px"><button class="sec" data-act="p-dan-ok">Dùng mã này</button><button class="sec" data-act="p-dan-huy">Thôi</button></div></div>
      <input type="file" id="mncf-ui-pfile" accept=".json,application/json" data-ui="phong-file" hidden>
    </div>` : ''}
    ${coKho ? `<div class="pane" data-pane="kho" hidden>
      <p class="hint">Chọn một <b>mẫu trong kho Chenfeng</b> của tài khoản (tủ tivi, tủ áo, tủ giày…), gõ kích thước rồi đặt vào bản vẽ — hoặc gán cho một <b>khung</b> ở thẻ Phòng (vách tivi, đầu giường chia ô). Mẫu vào bản vẽ vẫn là module của Chenfeng: đổi L / W / H ở ô Thông số được.</p>
      <div class="khochon" hidden></div>
      <fieldset><legend>Kho mẫu của tài khoản</legend>
        <div class="knhom"></div>
        <div class="g g2"><label>Thư mục<select id="mncf-ui-khodir" data-ui="kho-dir"></select></label><label>Tìm theo tên (trong thư mục)<input type="text" data-text="1" id="mncf-ui-khotim" data-ui="kho-tim" placeholder="vd: tivi 4, sang trọng"></label></div>
        <div class="kcon"></div>
        <div class="kluoi" aria-live="polite"></div>
        <div class="frow ktrang"></div>
      </fieldset>
      <fieldset><legend>Mẫu đang chọn — kích thước vẽ (mm)</legend>
        <div class="kmau"><span class="hint" style="margin:0">Bấm vào một mẫu ở trên.</span></div>
        <div class="g g3"><label>Rộng<input type="text" inputmode="decimal" id="mncf-ui-khorong" data-ui="kho-rong"></label><label>Sâu (cả cánh)<input type="text" inputmode="decimal" id="mncf-ui-khosau" data-ui="kho-sau"></label><label>Cao<input type="text" inputmode="decimal" id="mncf-ui-khocao" data-ui="kho-cao"></label></div>
        <label class="kopt" title="Bật: sau khi dựng, module được đổi dày ván theo Chuẩn xưởng (tham số BH của mẫu) và chuyển hậu sang hậu mỏng phủ sau lưng thùng như nút “Chuẩn hoá mẫu kho”. Mẫu nào kết cấu lạ không chuyển được thì bảng giữ nguyên kết cấu của mẫu và báo lý do."><input type="checkbox" id="mncf-ui-khochuan" data-ui="kho-chuan" checked> <span data-ui="kho-chuan-chu">Theo chuẩn xưởng</span></label>
        <label class="kopt" title="Tên tấm của mẫu kho là tiếng Trung (左侧板, 层板…). Bật: ghi lại tên tiếng Việt cho từng tấm trong bản vẽ — bảng kê, tem nhãn đọc được."><input type="checkbox" id="mncf-ui-khoten" data-ui="kho-ten" checked> Tên tấm tiếng Việt (Hồi trái, Đợt, Cánh…)</label>
        <div class="frow" style="margin-top:10px"><button class="pri" data-act="kho-khung" hidden style="flex:1"></button></div>
        <div class="frow" style="margin-top:8px"><button class="pri" data-act="kho-dat" style="flex:1" title="Bấm 1 điểm ở chân tường (đầu mẫu), rê chuột dọc tường — có bóng mờ chạy theo — rồi: bấm điểm cuối (rộng theo đoạn đó), hoặc gõ bề rộng + Enter, hoặc Enter để dùng bề rộng đang gõ ở ô Rộng. Mẫu tự quay lưng vào tường.">Đặt bằng chuột — bấm vào chân tường</button></div>
        <div class="frow" style="margin-top:8px"><button class="sec" data-act="kho-ve" title="Bấm 1 điểm trên bản vẽ = góc trái – trước – dưới của mẫu; mẫu đặt thẳng trục (không xoay).">Vẽ tại 1 điểm bấm (không xoay)</button></div>
      </fieldset>
    </div>` : ''}
    ${coMau ? `<div class="pane" data-pane="mausac" hidden>
      <p class="hint">Trên bản vẽ bấm chọn <b>1 tấm của tủ</b> → <b>Đổ màu tủ đang chọn</b>: thùng một màu, cánh + phào một màu (xà chân trước, mặt ngăn kéo lộ ngoài, tấm ốp, nẹp đi theo cánh), hậu theo thùng. Màu lấy từ <b>kho vật liệu Chenfeng</b> của tài khoản.</p>
      <fieldset><legend>Màu sẽ đổ — bấm một ô, rồi bấm màu ở danh sách dưới</legend>
        <div class="vlos"></div>
        <div class="frow"><button class="pri" data-act="vl-do" style="flex:1" title="Chọn 1 tấm bất kỳ của tủ trên bản vẽ (chọn tấm của nhiều tủ thì đổ nhiều tủ một lượt) rồi bấm: mọi tấm của tủ đó được đổ màu theo 3 ô ở trên. Ô nào chưa chọn màu thì nhóm đó giữ nguyên. Một bước hoàn tác.">Đổ màu tủ đang chọn</button></div>
        <div class="frow" style="margin-top:8px"><button class="sec" data-act="vl-tam" title="Chỉ đổ đúng các tấm đang chọn trên bản vẽ (không lan ra cả tủ) bằng màu của ô đang bật — dùng khi một vài tấm cần màu khác.">Đổ màu ô đang bật cho riêng các tấm đang chọn</button></div>
        <label class="kopt" title="Bật: tủ vẽ bằng nút “Vẽ vào Chenfeng” và mẫu kho vừa đặt vào bản vẽ được đổ màu ngay theo 3 ô ở trên; “Hoàn tác lần vẽ này” lùi cả bước đổ màu."><input type="checkbox" id="mncf-ui-vltudong" data-ui="vl-tudong"${mauS.tu_dong ? ' checked' : ''}> Tủ và mẫu kho vẽ mới tự đổ màu theo 3 ô này</label>
        <div data-ui="vl-kq" aria-live="polite"></div>
      </fieldset>
      <fieldset><legend>Màu của xưởng (kho vật liệu Chenfeng)</legend>
        <div class="g g2"><label>Tìm mã màu<input type="text" data-text="1" id="mncf-ui-vltim" data-ui="vl-tim" placeholder="vd: 103, lux279" autocomplete="off"></label><label>Nhóm<select id="mncf-ui-vlnhom" data-ui="vl-nhom"><option value="">Mọi nhóm</option></select></label></div>
        <div class="vlgan"></div>
        <div class="vlds" aria-live="polite"></div>
        <div class="vlchan"></div>
      </fieldset>
      <fieldset><legend>Tìm và thay màu trên bản vẽ</legend>
        <div class="frow"><button class="sec" data-act="vl-quet" title="Liệt kê các màu đang có trên bản vẽ kèm số tấm">Xem màu đang dùng trên bản vẽ</button></div>
        <div class="vldung" data-ui="vl-dung"></div>
        <p class="vlthay">Thay <b data-ui="vl-tu"></b> bằng <b data-ui="vl-den"></b> <span class="hint" data-ui="vl-den-o"></span></p>
        <div class="frow"><button class="sec" data-act="vl-xem" title="Chọn (bôi sáng) trên bản vẽ mọi tấm đang mang màu vừa bấm — để xem màu đó nằm ở đâu">Chọn các tấm màu này</button><button class="sec" data-act="vl-thay" data-v="tat" title="Mọi tấm trên bản vẽ đang mang màu đó được đổi sang màu của ô đang bật. Một bước hoàn tác.">Thay trên cả bản vẽ</button><button class="sec" data-act="vl-thay" data-v="chon" title="Quét chọn trước các tấm (một tủ, một phòng…) trên bản vẽ: chỉ những tấm đang chọn mang màu đó mới được đổi.">Chỉ thay trong các tấm đang chọn</button></div>
      </fieldset>
    </div>` : ''}
    <div class="pane" data-pane="chuan" hidden><p class="hint">Số chuẩn của xưởng — chốt một lần, máy này tự nhớ. Đơn vị mm.</p><div class="settings"></div>
      <div class="frow"><button class="sec" data-act="defaults">Khôi phục mặc định</button></div><datalist id="drill"></datalist></div>
    <div class="pane" data-pane="kq" hidden><div class="report"><p class="hint">Chưa vẽ lần nào.</p></div>
      ${inCF ? `<div class="dlsx"><div class="frow"><button class="sec" data-act="doloi" title="Đọc tấm và lỗ khoan thật trên bản vẽ: tấm đè / trùng nhau, lỗ khoan giao nhau, lỗ lệch khỏi tấm hoặc khoan thủng, kiểu khoan lạ, tấm không lỗ, mối nối thiếu liên kết, tấm vượt khổ ván, tấm đứng riêng, tấm chưa có tên tủ">Dò lỗi sản xuất</button><p class="hint">Không chọn gì = dò cả bản vẽ. Chọn vài tấm trên bản vẽ trước = chỉ dò các tấm đó (kể cả phần anh tự vẽ / tự sửa).</p></div><div data-ui="doloi"></div></div>
      ${Drv && typeof Drv.xuatVan === 'function' ? `<div class="xvan"><div class="frow"><button class="sec" data-act="xuatvan" title="Chạy lệnh tách đơn CD của Chenfeng cho đúng các tấm cần xuất: bảng dò lỗi sản xuất trước, tự chọn tấm + phụ kiện của tủ rồi Enter. Tới khung nhỏ “Order Splitting” thì dừng — dữ liệu chỉ lên máy chủ sản xuất của Chenfeng khi anh bấm 打开 trong khung đó.">Xuất ván (tách đơn CD)</button><p class="hint">Chọn 1 tấm của tủ trên bản vẽ = xuất (các) tủ đó. Không chọn gì = cả bản vẽ. Bảng dò lỗi, tự chọn tấm rồi chạy lệnh <code>CD</code>; anh chỉ còn bấm <b>打开</b> ở khung nhỏ.</p></div><div data-ui="xuatvan"></div></div>` : ''}` : ''}</div>
    <div class="pane" data-pane="hd" hidden>${guideHTML(inCF)}</div>
  </div>
  <footer>
    <div class="status"></div>
    ${inCF && Ph && Ph.haiDiemThanhHinh ? `<div class="frow datrow"><button class="sec datnut" data-act="dat" title="Đặt tủ đang mở trong bảng vào bản vẽ bằng chuột: bấm 1 điểm ở chân tường (đầu tủ), rê chuột dọc tường — có bóng mờ của tủ chạy theo — rồi: bấm điểm cuối (tủ rộng theo đoạn tường đó), hoặc gõ bề rộng + Enter, hoặc Enter để dùng bề rộng đang gõ trong bảng. Tủ tự quay lưng vào tường, tự khấu cột của phòng. Chỗ không có tường thì bảng hỏi thêm 1 điểm phía trước tủ.">Đặt tủ bằng chuột — bấm vào chân tường</button><label class="chk" title="Bật: đặt xong là vẽ luôn. Tắt: đặt xong xem lại khoang / đợt rồi tự bấm Vẽ vào Chenfeng."><input type="checkbox" data-ui="veNgay" checked> vẽ ngay</label></div>` : ''}
    ${inCF && Ph && Ph.hinhThanhKhung ? `<div class="frow"><button class="sec" data-act="hinh" title="Trên mặt bằng của Chenfeng, vẽ một hình chữ nhật hoặc đa tuyến kín đúng chỗ tủ đứng (bắt điểm vào tường, cột; chỗ vướng cột vẽ khuyết góc hoặc khuyết giữa — hoặc cứ vẽ chữ nhật trùm qua cột của phòng). Chọn hình đó rồi bấm nút này: bảng lấy rộng, sâu, vị trí, hướng xoay và khấu cột theo hình. Chia khoang, đợt xong bấm Vẽ vào Chenfeng — tủ dựng đúng chỗ hình.">Tủ theo hình đang chọn trên mặt bằng</button></div>
    <div class="hinhcho" hidden></div>` : ''}
    ${inCF ? `<button class="pri" data-act="draw">Vẽ vào Chenfeng</button>
    <div class="tunoi" hidden></div>
    <div class="frow"><button class="sec" data-act="redraw" disabled title="Sửa số trong bảng rồi bấm: tủ đang nối trên bản vẽ được bỏ đi và vẽ lại ĐÚNG CHỖ CŨ theo số mới — không bấm điểm đặt lại. Dùng được cả khi đã vẽ thêm thứ khác, đã di chuyển tủ, đã lưu rồi mở lại bản vẽ.">Cập nhật tủ này trên bản vẽ</button><button class="sec" data-act="pick" title="Trên bản vẽ, bấm chọn 1 tấm bất kỳ của tủ cần sửa (hồi, đợt, cánh…) rồi bấm nút này: bảng mở lại đúng thông số của tủ đó.">Sửa tủ đang chọn</button></div>
    <div class="frow"><button class="sec" data-act="chuanhoa" title="Dùng cho module chèn từ Kho mẫu Chenfeng (kết cấu kiểu Trung: hậu dày lọt lòng, hoặc hậu mỏng âm rãnh). Trên bản vẽ, bấm chọn 1 tấm của module đó rồi bấm nút này: hậu thành 6 li phủ sau lưng thùng (lùi mép 1, không khoan), hồi / nóc / đáy / đợt lùi mép sau cho vừa, thanh giằng sau hậu được bỏ, lỗ khoan được khoan lại theo kiểu khoan của xưởng. Module vẫn đổi Rộng / Sâu / Cao được ở ô Thông số của Chenfeng. Chỉ sửa module trên bản vẽ — mẫu trong kho giữ nguyên.">Chuẩn hoá mẫu kho đang chọn → hậu phủ sau</button></div>
    <div class="frow"><label class="at" title="Toạ độ góc trái – trước – dưới của cả tủ (mặt cánh). Bỏ chọn = bấm 1 điểm trên bản vẽ."><input type="checkbox" id="mncf-ui-useat" data-ui="useAt"> Đặt tại toạ độ</label><span class="at">x <input type="text" id="mncf-ui-ax" data-ui="ax" value="0" aria-label="x"> y <input type="text" id="mncf-ui-ay" data-ui="ay" value="0" aria-label="y"> z <input type="text" id="mncf-ui-az" data-ui="az" value="0" aria-label="z"></span></div>` : `<button class="pri" data-act="json">Tải file JSON để thả vào Chenfeng</button>`}
    <div class="frow">${inCF ? '<button class="sec" data-act="json" title="Tải file JSON của tủ này (để thả vào Chenfeng trên máy khác)">Tải JSON</button>' : ''}<button class="sec" data-act="csv" title="Tải bảng kê tấm, mở bằng Excel">Bảng kê CSV</button><button class="sec" data-act="save" title="Lưu thông số tủ này thành file để dùng lại">Lưu mẫu</button><button class="sec" data-act="open" title="Mở file mẫu tủ đã lưu">Mở mẫu</button></div>
    <input type="file" id="mncf-ui-file" accept=".json,application/json" data-ui="file" hidden>
  </footer>
</section>
<div class="xem${wide ? ' rong' : ''}" hidden role="dialog" aria-label="Ảnh hiện trạng"><div class="xemh"><span></span><button class="ibtn" data-act="xem-truoc" title="Ảnh trước">◂</button><button class="ibtn" data-act="xem-sau" title="Ảnh sau">▸</button><button class="ibtn" data-act="xem-dong" title="Đóng ảnh">✕</button></div><div class="xemb"><img alt="Ảnh hiện trạng đang xem"></div></div>`;

    const $ = q => rootEl.querySelector(q), $$ = q => [...rootEl.querySelectorAll(q)];
    const panel = $('.panel'), launch = $('.launch'), chip = $('.chip'), view = $('.view'), bar = $('.edbar'), probe = $('.edprobe');

    function guideHTML(cf) {
      return `<fieldset><legend>Cách dùng</legend><ol class="sum">
<li><b>Mẫu tủ áo dựng sẵn</b> (tab Tủ): chọn mẫu 2–6 cánh rồi bấm <b>Dùng mẫu</b> — ra ngay tủ đủ khoang treo, đợt, ngăn kéo; sau đó sửa tiếp như thường.</li>
${Ph ? '<li>Thẻ <b>Phòng</b>: tự điền số đo hiện trạng (cao trần, từng tường theo chiều kim đồng hồ, cửa, dầm, cột) → bảng vẽ mặt bằng, mặt đứng và báo phòng có khép kín không. Kéo ảnh hiện trạng vào để vừa nhìn vừa điền. Đánh dấu <b>khung không gian</b> (chỗ đặt tủ) rồi bấm <b>Mở thành tủ</b>' + (cf ? ' hoặc <b>Vẽ tủ vào khung</b>' : '') + ': tủ có phủ bì đúng bằng khung' + (cf ? ', tự xoay theo tường. <b>Vẽ phòng vào Chenfeng</b> dựng tường, cửa, cột, dầm bằng lệnh phòng của Chenfeng.' : '.') + '</li>' : ''}
<li>Tab <b>Tủ</b>: nhập phủ bì, phào, chân; mỗi khoang chọn số cánh. Bề rộng khoang để trống = tự chia sao cho các cánh bằng nhau và tim vách trùng khe cánh.</li>
<li><b>Chia đợt ngay trên hình đứng</b>: nắm một đợt kéo lên xuống (bắt bước ${BUOC_KEO} mm); bấm đúp vào ô để thêm đợt; bấm vào đợt để gõ cao độ chính xác hoặc xoá. Phím ↑ ↓ nhích 1 mm (giữ Shift: 10 mm), Delete xoá đợt.</li>
<li><b>Bấm vào một ô</b> rồi chọn: ngăn kéo âm, ngăn kéo trùm ngoài hoặc suốt treo; chọn "Trống" để bỏ. Với ngăn kéo: chỉnh <b>số ngăn</b> và chọn <b>loại</b> (ray bi, ray âm, hộp ray Blum, ngăn chia ô, khung treo quần…).</li>
<li><b>Vách đứng (hồi giữa)</b> — bản 1.12: bấm nút <b>＋ Vách</b> phía trên hình rồi bấm vào chỗ bất kỳ trong tủ → thêm một vách tại đó (khoang chia đôi, đợt chép sang khoang mới). <b>Kéo vách</b> sang trái / phải để chia lại bề rộng hai khoang kề; bấm vào vách để gõ số lọt lòng hoặc <b>Bỏ vách</b> (gộp 2 khoang). ↶ Lùi trả lại được.</li>
<li><b>Khấu cột</b> — bản 1.13: tủ vướng cột ở góc sau thì gõ kích thước cột lấn vào tủ (ngang × sâu) ở khung <b>Khấu cột</b> của thẻ Tủ. Hồi phía cột nông lại, đáy / nóc / đợt khoét góc chữ L, có vách khấu dọc mặt bên cột và hậu khấu trước mặt cột — từ bản 1.16.1 hậu khấu là <b>ván thùng</b> như vách khấu (lọt giữa 2 tấm đứng hai bên cột, khoan liên kết), chỉ hậu chính sau lưng mới là hậu 6 li; xem hình “Nhìn từ trên xuống” dưới hình đứng. <b>Khe hở quanh cột</b> mặc định <b>15</b> (từ bản 1.17.1; trước là 10) — gõ 10–20 tuỳ công trình để lúc lắp còn chỗ xử lý. Tủ vẽ từ khung của thẻ Phòng thì tự khấu theo cột trùm đầu khung.</li>
${cf ? '<li><b>Vẽ bằng lệnh gốc của Chenfeng, cả tủ là một module</b> — bản 1.15–1.16: hồi, vách, nóc / đáy, hậu, đợt, cánh được dựng bằng chính các lệnh vẽ tấm của Chenfeng (vách chạy suốt, nóc / đáy theo từng khoang); phào, xà chân, khung hộc kéo, ngăn kéo, suốt treo được gom cùng các thùng đó thành <b>một module mang mã tủ</b>. Vẽ xong chọn 1 tấm → thẻ Template (Thông số) của Chenfeng → bấm dòng trên cùng (mã tủ) → đổi L / W / H → Apply: <b>cả tủ chạy theo</b>, Chenfeng khoan lại. Tủ được vẽ ở chỗ trống bên phải bản vẽ rồi tự đưa về chỗ đặt (xoay theo tường được) — trong lúc bảng đang vẽ đừng bấm vào bản vẽ; sang tab khác làm việc thì được (bảng tự chờ Chenfeng dựng hình xong từng bước, chậm hơn một chút). Tủ có khấu cột vẽ theo cách cũ (vẫn là một module). Tắt / bật ở Chuẩn xưởng → Cách vẽ vào Chenfeng.</li>' : ''}
${cf && Ph && Ph.haiDiemThanhHinh ? '<li><b>Đặt tủ bằng chuột</b> — bản 1.17, cách nhanh nhất để đưa tủ vào đúng chỗ trên mặt bằng: chọn mẫu, gõ rộng × cao × sâu ở thẻ Tủ → bấm <b>Đặt tủ bằng chuột</b> → bấm <b>1 điểm ở chân tường</b> (đầu tủ) → rê chuột dọc tường, bóng mờ của tủ chạy theo (cạnh màu cam là mặt cánh) → chọn một trong ba: <b>Enter</b> = dùng bề rộng đang gõ trong bảng; <b>gõ số + Enter</b> (vd 2400) = tủ rộng đúng số đó; <b>bấm điểm cuối</b> = tủ rộng theo đúng đoạn tường (bấm vào góc tường, mép cột đều được). Tủ tự quay lưng vào tường, tự khấu cột của phòng nằm trong đoạn đó; tủ cao hơn trần thì hạ theo trần. Chỗ không có tường, bảng hỏi thêm 1 điểm phía trước tủ. Ô <b>vẽ ngay</b> đang bật thì đặt xong là vẽ luôn; tắt đi nếu muốn xem lại khoang / đợt rồi mới bấm Vẽ.</li>' : ''}
${cf && Ph && Ph.hinhThanhKhung ? '<li><b>Tủ theo hình vẽ trên mặt bằng</b> — bản 1.16: trên mặt bằng của Chenfeng (nhìn từ trên xuống) vẽ một <b>hình chữ nhật hoặc đa tuyến kín</b> đúng chỗ tủ đứng — bắt điểm vào tường, cột; hình là phủ bì của tủ (rộng × sâu, kể cả cánh). Chỗ vướng cột: vẽ khuyết góc / khuyết giữa ở mép sau, hoặc cứ vẽ chữ nhật trùm qua cột của phòng (bảng tự khấu theo cột). Chọn hình → bấm <b>Tủ theo hình đang chọn trên mặt bằng</b>: bảng lấy rộng, sâu, vị trí, hướng xoay, khấu cột; cao lấy theo trần của phòng (sửa được ở ô Cao). Mặt trước tự nhận theo tường / chỗ khuyết, không nhận được thì bảng hỏi bấm 1 điểm phía trước tủ; nhận sai thì bấm “Chọn lại mặt trước”. Chia khoang, đợt xong bấm <b>Vẽ vào Chenfeng</b> — tủ dựng đúng chỗ hình, đúng hướng.</li>' : ''}
${Ph && Ph.chiaKhung ? `<li><b>Vách tivi, đầu giường: chia ô trên mặt đứng + mẫu kho Chenfeng</b> — bản 1.19: ở thẻ <b>Phòng</b>, mỗi <b>khung</b> là một ô trên mặt tường. Tạo ô bằng <b>+ Thêm khung</b>, hoặc bật <b>＋ Vẽ khung trên mặt đứng</b> rồi kéo chuột ngay trên mặt đứng; ở thẻ của khung bấm <b>Chia khung thành N ô</b> (cạnh nhau / chồng lên nhau). <b>Bấm vào số của ô trên mặt đứng</b> (rộng, cao, sâu, cách trái, đáy) để gõ lại — sửa rộng / cao thì ô kề tự nhận phần bù, không hở không chồng. Mỗi ô chọn <b>Đặt gì vào khung</b>: <b>Tủ tự chia khoang</b> (mở ở thẻ Tủ như trước; ô treo thì tủ không chân) hoặc <b>Mẫu kho Chenfeng</b>.${cf ? ' Với mẫu kho: bấm <b>Chọn mẫu kho…</b> → thẻ <b>Kho mẫu</b> hiện mẫu của tài khoản kèm hình (nhóm nhanh Tủ tivi, Tủ áo, Tủ giày…; chọn thư mục; tìm theo tên) → bấm mẫu → <b>Dùng mẫu này cho khung</b> → về thẻ Phòng bấm <b>Vẽ mẫu vào khung</b>: mẫu được dựng đúng rộng × sâu × cao của ô, quay lưng vào tường, đúng cao độ đáy. Không cần khung cũng được: ở thẻ <b>Kho mẫu</b> chọn mẫu, gõ kích thước rồi bấm <b>Đặt bằng chuột</b> (bấm chân tường → rê → bấm điểm cuối / gõ rộng / Enter) hoặc <b>Vẽ tại 1 điểm bấm</b>. Bảng tự làm thêm: đổi kiểu khoan của cửa hàng (三合一…) sang kiểu khoan của xưởng rồi khoan lại; ô <b>Theo chuẩn xưởng</b> (ván 17,5 + hậu mỏng phủ sau — mẫu nào kết cấu lạ thì giữ nguyên và báo); ô <b>Tên tấm tiếng Việt</b>; mẫu có cánh phủ ngoài thùng thì chỉnh W để cả cánh nằm gọn trong chiều sâu ô. Mẫu vào bản vẽ vẫn là <b>module của Chenfeng</b> — đổi L / W / H và các tham số riêng ở ô Thông số. Mẫu nào không co giãn theo kích thước thì bảng báo rõ cần / thực tế. Thẻ Kết quả có nút <b>Hoàn tác lần vẽ này</b>.' : ' Chọn mẫu trong kho và vẽ vào khung làm trong Chenfeng (bảng tiện ích); ở trang này anh chia ô, đặt kích thước trước rồi “Lưu phòng” / “Chép mã” mang sang.'}</li>` : ''}
${Ph && Ph.LOAI_DN ? `<li><b>Điện – nước hiện trạng</b> — bản 1.18: thẻ <b>Phòng</b> → khung <b>Điện – nước</b>: bấm <b>+ Ổ điện / + Công tắc / + Cấp nước / + Thoát nước / + Thoát sàn / + Ống chờ sàn / + Điểm khác</b> (điểm nằm trên tường đang chọn) rồi gõ <b>cách trái</b> (từ đầu trái tường tới tâm điểm) và <b>cao tâm</b> (từ sàn); điểm dưới sàn thì gõ <b>cách tường</b>. Điểm hiện ngay trên mặt bằng và mặt đứng — bấm vào số trên mặt đứng để sửa, bấm vào dấu trên mặt bằng để tới dòng của nó. Khung đặt tủ che điểm nào thì bảng báo dưới mặt bằng. Mở khung thành tủ${cf ? ' (hoặc đặt tủ bằng chuột / theo hình ngay trong phòng đó)' : ''}: hình đứng của tủ có dấu từng điểm — <b>ô nét đứt</b> = chỗ phải khoét hậu, <b>màu đỏ</b> = trúng vách / đợt / hồi (kéo vách, đợt tránh ra là hết đỏ) — kèm dòng ghi khoét tấm nào, tâm cách mép tấm bao nhiêu; công tắc và thoát sàn bị tủ che thì báo riêng.${cf ? ' Bấm <b>Vẽ phòng vào Chenfeng</b> thì các điểm được đánh dấu luôn trên mặt tường / mặt sàn của bản vẽ (nét màu + nhãn như “O1 +300”), nhìn từ trên xuống cũng thấy; thẻ Kết quả của tủ vừa vẽ ghi lại các điểm sau tủ.' : ''}</li>` : ''}
<li><b>Dò lỗi sản xuất</b> — bản 1.20: thẻ Tủ có phiếu <b>Tự kiểm trước khi vẽ</b> ngay dưới các dòng cảnh báo (bấm để mở): kích thước, thân, khổ ván, va chạm, tấm lơ lửng, nhịp đợt, cánh, ngăn kéo, khoang treo, hậu, phào – chân, khấu cột — mỗi mục một dòng ✓ / ! / ✗. Ngưỡng cảnh báo (nhịp đợt 1000, cánh cao 2300, ngăn kéo rộng 1000, khoang treo sâu 480, cao trần) đổi ở <b>Chuẩn xưởng → Dò lỗi sản xuất</b>; để 0 là không kiểm mục đó.${cf ? ' Vẽ xong, bảng <b>tự đọc lại tấm và lỗ khoan thật</b> trên bản vẽ và ghi phiếu ở thẻ Kết quả: tấm đè / trùng nhau, lỗ khoan giao nhau, lỗ lệch khỏi tấm hoặc khoan thủng tấm, kiểu khoan lạ, tấm vượt khổ ván (đỏ — phải sửa trước khi xuất file cắt); tấm không lỗ, mối nối dài không có liên kết, tấm đứng riêng, tấm chưa có tên tủ (vàng — xưởng xem lại). Sau khi anh tự vẽ thêm, sửa tay hay chèn mẫu kho: thẻ <b>Kết quả → Dò lỗi sản xuất</b> — không chọn gì là dò cả bản vẽ, chọn vài tấm trước thì chỉ dò các tấm đó. Phép dò chỉ đọc bản vẽ, không sửa gì.' : ''}</li>
<li><b>Chọn loại ngăn kéo bằng hình</b> — bản 1.13: bấm ô ngăn kéo → bấm nút hình cạnh ô Loại → bấm hình loại cần dùng.</li>
${cf ? '<li><b>Đổ màu</b> — bản 1.21, thẻ <b>Màu</b>: ba ô <b>Thùng</b> / <b>Cánh + phào</b> / <b>Hậu</b> — bấm một ô rồi bấm một màu trong danh sách (màu là vật liệu trong kho vật liệu của tài khoản Chenfeng; gõ mã để tìm, vd <code>103</code>, <code>lux279</code>; chọn nhóm MDF / Acrylic). Trên bản vẽ bấm chọn 1 tấm của tủ → <b>Đổ màu tủ đang chọn</b>: thùng một màu; cánh, phào, xà chân trước, mặt ngăn kéo lộ ngoài, tấm ốp, nẹp một màu; hậu theo thùng (hoặc màu riêng). Mặt ngăn kéo nằm sau cánh và cả hộp ngăn kéo theo màu thùng. Tấm nhận vật liệu hiển thị + tên ván / vật liệu / màu, nên bảng cắt gom đúng loại ván. <b>Đổ màu ô đang bật cho riêng các tấm đang chọn</b> để sửa vài tấm lẻ. Bật <b>Tủ và mẫu kho vẽ mới tự đổ màu</b> thì tủ vẽ ra đã có màu. <b>Tìm và thay</b>: <b>Xem màu đang dùng trên bản vẽ</b> → bấm một màu → <b>Chọn các tấm màu này</b> (bôi sáng trên bản vẽ) hoặc <b>Thay trên cả bản vẽ</b> / <b>Chỉ thay trong các tấm đang chọn</b> bằng màu của ô đang bật. Mỗi lần đổ / thay là một bước, có nút <b>Hoàn tác</b>. “Cập nhật tủ này trên bản vẽ” giữ lại màu của tủ cũ; đổi L / W / H của module trong Chenfeng màu vẫn giữ.</li>' : ''}
${cf ? '<li><b>Xuất ván</b> — bản 1.22, thẻ <b>Kết quả → Xuất ván (tách đơn CD)</b>: chọn 1 tấm của tủ trên bản vẽ = xuất (các) tủ đó, không chọn gì = cả bản vẽ. Bảng <b>dò lỗi sản xuất</b> trên đúng các tấm sắp xuất (còn lỗi thì dừng, có nút “Vẫn xuất”), tự chọn tấm + phụ kiện của tủ rồi chạy lệnh <code>CD</code> của Chenfeng; anh chỉ còn bấm <b>打开</b> trong khung nhỏ “Order Splitting”. Chưa bấm 打开 thì chưa có gì gửi đi. Khung nhỏ tải lâu / không tải được: bảng báo và có nút <b>Thử lại</b>. Bấm 打开 xong, trang sản xuất mở ở tab mới: máy chủ Chenfeng tính khoảng 4 giây + 0,05 giây mỗi tấm (có lúc lâu gấp 2–3), rồi hộp 优化进度 hiện — <b>trợ lý Một Nhà</b> ở góc dưới bên phải trang đó tự bấm 开始优化, tự dừng khi số tờ ván đứng yên (thanh tiến độ của Chenfeng không bao giờ tự dừng) rồi mở sơ đồ cắt; nó cũng tự cứu trang khi trang đứng trắng. Trợ lý <b>không lưu, không xuất NC, không in tem</b> — các nút đó anh tự bấm. Muốn tự tay tối ưu: bỏ chọn “Tự tối ưu khi mở trang” ở bảng báo của trợ lý, hoặc bấm “Để tôi tự làm”. <b>Đừng F5 tab trang sản xuất</b> (tải lại là mất dữ liệu tấm — đóng tab rồi bấm Xuất ván lại). Đổ màu trước khi xuất để trang sản xuất tách đúng loại ván.</li>' : ''}
${cf ? '<li><b>Phím tắt Alt + M</b>: ẩn / hiện bảng này (khi ẩn còn lại nút “Một Nhà · Vẽ tủ” ở góc dưới bên phải).</li>' : ''}
<li>Vẫn gõ được cao độ các đợt trong thẻ khoang: <code>400, 750, 1800</code> (mặt dưới, tính từ sàn) hoặc <code>deu:4</code> để chia đều 4 đợt.</li>
${cf ? '<li>Bấm <b>Vẽ vào Chenfeng</b> rồi bấm 1 điểm trên bản vẽ để đặt tủ (điểm đó là góc trái – trước – dưới). Chenfeng tự khoan lỗ. Tab <b>Kết quả</b> báo số tấm, số lỗ, chỗ cần xem lại.</li><li>Vẽ nhầm: tab Kết quả → <b>Hoàn tác lần vẽ này</b> (hoặc Ctrl+Z).</li><li><b>Sửa ngay trong Chenfeng</b>: tủ vẽ xong là một <b>module tham số của Chenfeng</b>. Chọn 1 tấm của tủ → thẻ <b>Template</b> (Thông số) ở bảng bên phải của Chenfeng hiện Rộng (L) / Sâu (W) / Cao (H) → gõ số mới vào <b>cột cuối “Expression”</b> của dòng đó (cột “Parameter Value” chỉ để xem, không gõ được) → <b>Apply data modifications</b>: tủ co giãn đúng kết cấu (cánh, vách, đợt, hộp ngăn kéo chạy theo), Chenfeng tự khoan lại. Tắt ở Chuẩn xưởng → Module Chenfeng.</li><li><b>Sửa tủ đã vẽ</b>: vẽ xong, bảng tự nối với tủ đó — sửa số rồi bấm <b>Cập nhật tủ này trên bản vẽ</b>: tủ cũ được bỏ, tủ mới nằm đúng chỗ cũ, không bấm điểm lại. Tủ vẽ từ trước: trên bản vẽ bấm chọn 1 tấm của tủ → bấm <b>Sửa tủ đang chọn</b> → bảng mở lại đúng thông số của tủ đó. Dùng được cả khi đã vẽ thêm thứ khác, đã di chuyển tủ, đã lưu rồi mở lại bản vẽ (tủ bị xoay thì không). Thông số từng tủ lưu trong trình duyệt của máy này; mỗi tấm mang một ghi chú ngắn “MNCF: mã tủ” để tìm lại. Bản lề, tay nắm anh tự gắn thêm không bị xoá. (Tấm do bảng này vẽ là tấm rời nên bảng Thông số bên phải của Chenfeng không có tham số — sửa tủ thì sửa ở bảng này.)</li><li>Nút <b>Mở rộng</b> ở góc trên làm bảng rộng ra, hình đứng to hơn để kéo đợt cho dễ.</li>'
    : '<li>Bấm <b>Tải file JSON</b>, mở bản vẽ Chenfeng, kéo file thả vào cửa sổ Chenfeng (hoặc gõ lệnh <code>CF</code> rồi chọn file), bấm 1 điểm để đặt tủ. Chenfeng tự khoan lỗ.</li>'}
</ol></fieldset>
<fieldset><legend>Tủ được dựng thế nào</legend><ul class="sum">
<li>Thùng: tủ rộng tự <b>tách thành các thùng rời</b>, mỗi thùng không quá 2000 (đổi ở Chuẩn xưởng → Thùng) — chỗ tách là 2 hồi áp lưng, phào và chân trước là khung chung. Trong một thùng: hồi chạy suốt, vách dùng chung giữa 2 khoang; đáy, nóc lọt lòng từng khoang.</li>
<li><b>Hậu 6 li phủ sau lưng thùng</b>: hậu ốp lên mép sau của hồi, vách, đáy, nóc; chia thành nhiều tấm, mối nối nằm trên vách; bắn đinh từ đằng sau nên Chenfeng không khoan cam cho hậu. Thùng lùi lại 6 mm, sâu thùng vẫn là sâu phủ bì. Đổi kiểu hậu, độ dày, cách chia tấm ở tab Chuẩn xưởng → Hậu.</li>
<li>Tủ cao hơn khổ ván: chia thân dưới + thân kịch trần tại "cao thân dưới".</li>
<li>Xà chân trước nằm ở mặt phẳng cánh, che hết chân hồi và chân vách. Phào 2 bên + trên có thanh phụ trợ phía sau.</li>
<li><b>Ngăn kéo âm</b> nằm sau cánh mở: mỗi bên có bản lề có một vách đệm cách hồi/vách 50 (khe còn lại là chỗ cho bản lề), ngăn kéo nằm giữa hai vách đệm nên kéo ra không vướng bản lề.</li>
<li><b>Ngăn kéo trùm ngoài</b>: mặt ngăn kéo nằm ở mặt phẳng cánh, phủ lên mép đợt như cánh; cánh của khoang tự cắt ngắn, chừa đúng vùng mặt ngăn kéo; hộp chạy hết lọt lòng khoang nên không cần vách đệm.</li>
<li>Ngăn kéo và suốt treo dùng mẫu có sẵn trong kho mẫu Chenfeng của xưởng. Mỗi <b>loại ngăn kéo</b> là một mẫu trong thư mục 抽屉 của kho mẫu; danh sách loại, mã mẫu và tham số riêng nằm ở tab Chuẩn xưởng${cf ? ' (có nút dò lại mã mẫu từ kho Chenfeng)' : ''}.</li>
<li><b>Hộc ngăn kéo âm là một khung kín</b> (từ bản 1.5): sau khe phía trên mỗi mặt ngăn kéo có một <b>xà</b> (ván đứng cao 60, xà trên cùng sát đợt) — che khe luồn tay của mặt vát và giằng hai vách đệm; khe giữa hồi và vách đệm có <b>nẹp che</b> ngang mặt ngăn kéo (bắn đinh). Vì có nẹp che, bản lề cánh không đặt trong vùng cao độ của hộc kéo. Đổi số hoặc tắt ở Chuẩn xưởng → Ngăn kéo âm.</li>
<li>Đợt nằm ngay trên vách đệm ngăn kéo được đưa cam lên mặt trên (mặt dưới bị đầu vách đệm che, không vặn được).</li>
<li>Tấm nào dài hơn khổ ván, hai tấm đè nhau, đợt nằm ngoài lọt lòng, ô quá thấp cho số ngăn kéo… đều bị chặn trước khi vẽ.</li>
</ul></fieldset>
${cf ? `<fieldset><legend>Module lấy từ Kho mẫu Chenfeng (bản 1.11–1.12)</legend><ul class="sum">
<li><b>Dày ván</b> (bản 1.12): mẫu của Chenfeng vẽ với ván 18. Nút chuẩn hoá đổi luôn tham số dày ván (BH) của module sang ván của xưởng (Chuẩn xưởng → Ván) trước khi chuyển hậu; tấm nào mẫu không nối với BH (thường là cánh) thì thẻ Kết quả nêu tên để đổi tay. Các mẫu một thùng trong kho đã được đặt sẵn BH = 17,5 nên chèn ra là ván 17,5.</li>
<li>Thùng tủ trong kho của Chenfeng làm theo kiểu Trung: <b>hậu dày 18 lọt lòng</b>, hoặc <b>hậu mỏng âm rãnh</b> lùi 17–20 li có thanh giằng. Chèn module vào bản vẽ như thường, bấm chọn 1 tấm của nó rồi bấm <b>Chuẩn hoá mẫu kho đang chọn</b> (dưới nút "Sửa tủ đang chọn").</li>
<li>Bảng đổi module đó sang chuẩn xưởng: <b>hậu 6 li phủ sau lưng thùng</b> (lùi mép 1, không khoan), hồi / nóc / đáy / đợt lùi mép sau cho vừa, bỏ thanh giằng, đổi kiểu khoan sang kiểu của xưởng rồi cho Chenfeng khoan lại. Bề dày hậu và mép lùi lấy ở Chuẩn xưởng → Hậu.</li>
<li>Module vẫn là module tham số của Chenfeng: đổi Rộng / Sâu / Cao, chân, dày ván ở ô <b>Thông số</b> thì hậu vẫn phủ kín. Tổng rộng / sâu / cao của thùng không đổi.</li>
<li>Chỉ sửa module <b>trên bản vẽ</b> — mẫu trong kho giữ nguyên. Làm nhầm: thẻ Kết quả → <b>Hoàn tác lần chuẩn hoá này</b>.</li>
<li>Chưa làm được (bảng báo lý do, không sửa gì): module đang xoay, tủ góc, tủ né dầm / cột có hậu khuyết hoặc hậu nằm sâu, bộ ghép nhiều thùng (tủ sách, tủ sảnh, tatami… — hồi và vách là tấm tự động của Chenfeng).</li>
</ul></fieldset>` : ''}
${cf && root.__MNCF_NAP__ ? `<fieldset><legend>Cập nhật tự động</legend><ul class="sum"><li>Tiện ích trên máy này là <b>bộ nạp</b>: mỗi lần mở / tải lại trang Chenfeng, nó tự lấy bản mới nhất của bảng Một Nhà từ kho GitHub (đối chiếu mã kiểm rồi mới chạy). Không vào được kho thì chạy bản đã cất trong máy. Không phải cài lại khi có bản mới — chỉ cần <b>F5</b>.</li><li>Đang chạy: <b>v${Core.VERSION}</b> — <span class="nap-nguon">${esc(root.__MNCF_NAP__.nguon || 'đang nạp')}</span>.</li>${root.__MNCF_NAP__.ban_nap >= 2 ? '<li>Tiện ích này có kèm <b>trợ lý trang sản xuất</b> (tab mở ra khi bấm 打开 lúc xuất ván): báo trạng thái, tự tối ưu, tự dừng, cứu trang trắng — cũng tự cập nhật từ kho.</li>' : '<li><b>Tiện ích trên máy này là bản cũ, chưa có trợ lý trang sản xuất</b> (tự tối ưu + cứu trang trắng khi xuất ván). Muốn có: tải zip mới ở kho <code>github.com/thanhmotnha/mn-chenfeng</code> (thư mục tai-ve), giải nén đè lên thư mục tiện ích cũ, vào <code>chrome://extensions</code> bấm nút tải lại trên thẻ “Một Nhà · Vẽ tủ vào Chenfeng” — cài lại một lần là xong.</li>'}</ul><div class="frow"><button class="sec" data-act="nap-kt">Kiểm tra bản mới</button></div></fieldset>` : ''}
${cf && root.MNCFDich ? `<fieldset><legend>Ghi chú tham số bằng tiếng Việt</legend><ul class="sum"><li>Cột <b>Ghi chú</b> (Remarks / 备注) của bảng tham số mẫu — bảng bên phải và bảng trong Kho mẫu — được hiện bằng tiếng Việt: 板厚 → Dày ván, 左前缩 → Hồi trái lùi trước… Rê chuột vào ô để xem chữ gốc.</li><li>Chỉ đổi chữ hiển thị trên máy này; mẫu, bản vẽ và tài khoản Chenfeng không bị sửa. Ghi chú lạ chưa có trong bảng dịch thì được ghép từ, có dấu <b>~</b> đứng trước.</li></ul><div class="frow"><button class="sec" data-act="dich">${root.MNCFDich.dangBat ? 'Tắt dịch ghi chú' : 'Bật dịch ghi chú'}</button></div></fieldset>` : ''}
<fieldset><legend>Chưa làm</legend><ul class="sum"><li>Bản lề, tay nắm: bảng này chưa tự gắn — gắn bằng lệnh bản lề / tay nắm của Chenfeng sau khi vẽ. Có tuỳ chọn khoét chén Ø35 ở tab Chuẩn xưởng, mặc định tắt.</li><li>Các ngăn kéo trong một ô cao bằng nhau (muốn cao khác nhau thì chia ô bằng đợt).</li><li>Đợt di động, tủ góc, cánh lùa.</li><li>Thẻ Phòng: nhãn tên phòng trong Chenfeng ghi không dấu (phông nhãn của Chenfeng thiếu chữ có dấu); cột / hộp kỹ thuật vẽ ra luôn cao hết tường; cột trên tường xiên không tự xoay theo tường; tủ đã xoay theo tường thì không dùng được nút “Cập nhật tủ này”.</li></ul></fieldset>`;
    }

    /* ---- khoang ---- */
    function renderBays() {
      $('.bays').innerHTML = spec.khoang.map((k, i) => `
<div class="bay" data-i="${i}">
  <div class="bayh"><b>Khoang ${i + 1}</b><span class="w"></span>${spec.khoang.length > 1 ? '<button class="x" data-act="del" title="Bỏ khoang này">✕</button>' : ''}</div>
  <div class="g g3">
    <label>Rộng lọt lòng<input type="text" inputmode="decimal" id="${fid('b' + i + '-rong')}" data-b="rong" placeholder="tự chia" value="${k.rong === 'auto' ? '' : esc(fmt(k.rong))}"></label>
    <label>Số cánh<select id="${fid('b' + i + '-canh')}" data-b="canh">${[0, 1, 2].map(v => `<option value="${v}"${k.canh === v ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
    <label>Bản lề<select id="${fid('b' + i + '-banle')}" data-b="ban_le"${k.canh === 1 ? '' : ' disabled'}><option value="trai"${k.ban_le === 'trai' ? ' selected' : ''}>trái</option><option value="phai"${k.ban_le === 'phai' ? ' selected' : ''}>phải</option></select></label>
  </div>
  <div class="g"><label>Đợt — cao độ mặt dưới, tính từ sàn (hoặc kéo trên hình)<input type="text" id="${fid('b' + i + '-dot')}" data-b="dot" placeholder="vd 400, 750, 1800 hoặc deu:4" value="${esc((Array.isArray(k.dot) ? k.dot : []).map(fmt).join(', '))}"></label></div>
  <div class="noi"></div>
</div>`).join('');
    }
    function readBay(card) {
      const i = +card.dataset.i, v = n => card.querySelector(`[data-b="${n}"]`).value.trim(), cu = spec.khoang[i] || {};
      const k = { rong: v('rong') || 'auto', canh: +v('canh'), ban_le: v('ban_le'), dot: v('dot'), o: cu.o || [] };
      spec.khoang[i] = k;
      const moi = Core.normalize(spec).khoang[i].dot;      // đợt luôn giữ ở dạng mảng số, kể cả khi ô nhập đang gõ dở
      if (dotSnap && dotSnap.i === i) {
        // đang gõ ô "Đợt": ngăn kéo / suốt treo đi theo đợt cùng thứ tự khi số đợt không đổi (so với lúc bắt đầu gõ)
        k.o = dotSnap.o.map(c => { const j = moi.length === dotSnap.dot.length ? dotSnap.dot.findIndex(z => Math.abs(z - c.tu) < 0.6) : -1; return j >= 0 ? Object.assign({}, c, { tu: moi[j] }) : Object.assign({}, c); });
      }
      k.dot = moi;
      card.querySelector('[data-b="ban_le"]').disabled = k.canh !== 1;
    }

    /* ---- chuẩn xưởng ---- */
    // bảng "Các loại ngăn kéo": mỗi loại = một mẫu trong thư mục 抽屉 của kho mẫu Chenfeng
    function loaiHTML() {
      const nk = spec.ngan_keo;
      return `<fieldset class="lk"><legend>Các loại ngăn kéo (mẫu trong kho Chenfeng)</legend>
<p class="hint">Mỗi loại là một mẫu trong thư mục <b>抽屉</b> của kho mẫu Chenfeng. Chọn loại cho từng ô ở tab Tủ; ô chưa chọn thì dùng loại <b>mặc định</b>. Tham số riêng viết dạng <code>GD=13; SLK=30</code> — bỏ trống thì mẫu dùng số của nó; <code>mat</code> = chiều cao mặt ngăn kéo.</p>
<p class="hint" style="margin:0 0 4px"><b>Loại mặc định</b> — bấm vào hình để chọn:</p>
<div class="lgrid" role="group" aria-label="Loại ngăn kéo mặc định">${nk.loai.map(x => `<button class="ltile${x.ma === nk.mac_dinh ? ' on' : ''}" data-act="lk-md" data-v="${esc(x.ma)}" aria-pressed="${x.ma === nk.mac_dinh}">${anhNganKeo(x)}<span>${esc(x.ten)}</span></button>`).join('')}</div>
${nk.loai.map((x, i) => `<div class="lkr" data-li="${i}">
  <label class="lkt">Tên loại<input type="text" data-text="1" id="${fid('lk' + i + '-ten')}" data-lk="ten" value="${esc(x.ten)}"></label>
  <button class="x" data-act="lk-del" title="Bỏ loại này" aria-label="Bỏ loại ${esc(x.ten)}">✕</button>
  <label class="lkp">Tham số riêng<input type="text" data-text="1" id="${fid('lk' + i + '-ts')}" data-lk="ts" value="${esc(Core.tsText(x.ts))}"></label>
  <label class="lki">Mã mẫu<input type="text" inputmode="numeric" id="${fid('lk' + i + '-id')}" data-lk="mau_id" value="${x.mau_id ? x.mau_id : ''}" placeholder="chưa có"></label>
  <div class="lkm"><span class="lka">${anhNganKeo(x)}</span><label><input type="radio" name="mncf-lk-md" id="${fid('lk' + i + '-md')}" data-lk="md"${x.ma === nk.mac_dinh ? ' checked' : ''}> mặc định</label><span>mẫu Chenfeng: ${x.ten_mau ? esc(x.ten_mau) : '—'}</span></div>
</div>`).join('')}
<div class="frow"><button class="sec" data-act="lk-add">+ Thêm loại</button>${inCF ? '<button class="sec" data-act="lk-do" title="Đọc thư mục 抽屉 trong kho mẫu của tài khoản Chenfeng đang đăng nhập, cập nhật mã mẫu và thêm mẫu mới">Dò mã mẫu từ kho Chenfeng</button>' : ''}</div></fieldset>`;
    }
    // gộp kết quả dò kho mẫu vào danh sách loại: trùng tên mẫu (hoặc mã) thì cập nhật mã; mẫu lạ thì thêm loại mới
    function mergeLoai(found) {
      const L = spec.ngan_keo.loai, D0 = Core.DEFAULT_SPEC.ngan_keo.loai, BO = ['L', 'W', 'H', 'PX', 'PY', 'PZ', 'RX', 'RY', 'RZ', 'BH', 'SYS', 'XYS', 'ZYS', 'YYS'];
      let capNhat = 0, them = 0;
      for (const m of found) {
        if (!m || !m.id || !m.ten) continue;
        const x = L.find(q => q.ten_mau === m.ten) || L.find(q => q.mau_id === m.id);
        if (x) { if (x.mau_id !== m.id || x.ten_mau !== m.ten) capNhat++; x.mau_id = m.id; x.ten_mau = m.ten; continue; }
        const d = D0.find(q => q.ten_mau === m.ten), ts = {};
        for (const k of Object.keys(m.ts || {})) if (BO.indexOf(k) < 0) ts[k] = k === 'CMG' ? 'mat' : m.ts[k];
        L.push({ ma: d && !L.some(q => q.ma === d.ma) ? d.ma : 'm' + m.id, ten: d ? d.ten : m.ten, mau_id: m.id, ten_mau: m.ten, ts: d ? clone(d.ts) : ts }); them++;
      }
      return { capNhat, them };
    }
    function renderSettings() {
      $('.settings').innerHTML = SETTINGS.map(([title, fields, giai], si) => title === '@loai' ? loaiHTML() : `<fieldset><legend>${esc(title)}</legend>${giai ? `<p class="hint" data-giai="${si}">${esc(giai(spec))}</p>` : ''}<div class="g g2">${fields.filter(f => !f.khi || f.khi(spec)).map(f => {
        const v = getP(spec, f.path), sp = f.span ? ` style="grid-column:span ${f.span}"` : '';
        if (f.select) return `<label${sp}>${esc(f.label)}<select id="${fid(f.path)}" data-k="${f.path}">${f.select.map(([a, b]) => `<option value="${a}"${v === a ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select></label>`;
        if (f.check) return `<label class="row"${sp}><input type="checkbox" id="${fid(f.path)}" data-k="${f.path}"${v ? ' checked' : ''}> ${esc(f.label)}</label>`;
        return `<label${sp}>${esc(f.label)}<input type="text" ${f.text ? '' : 'inputmode="decimal"'} id="${fid(f.path)}" data-k="${f.path}" ${f.text ? 'data-text="1"' : ''} ${f.list ? `list="${f.list}"` : ''} value="${esc(fmt(v))}"></label>`;
      }).join('')}</div></fieldset>`).join('');
      const dl = $('#drill'); if (dl && Drv && Drv.available()) dl.innerHTML = Drv.drillTypes().map(n => `<option value="${esc(n)}">`).join('');
    }

    /* ---- lùi lại thao tác trên hình: nhớ đợt + nội dung ô của mọi khoang trước mỗi thao tác ---- */
    let hist = [], nhich = null;
    const chup = () => JSON.stringify(spec.khoang.map(k => ({ rong: k.rong, canh: k.canh, ban_le: k.ban_le, dot: k.dot, o: k.o })));
    const capNut = () => { const b = $('[data-act="lui"]'); if (b) b.disabled = !hist.length; };
    function nho(s) { s = s || chup(); if (hist[hist.length - 1] !== s) hist.push(s); if (hist.length > 80) hist.shift(); nhich = null; capNut(); }
    function lui() {
      const nay = chup(); let s = null;
      while (hist.length && (s = hist.pop()) === nay) s = null;
      capNut(); if (!s) return;
      const st = JSON.parse(s);
      // số khoang khác (vừa thêm / xoá vách trên hình) thì dựng lại cả dãy khoang theo bước đã nhớ
      if (st.length !== spec.khoang.length && spec.thung && Array.isArray(spec.thung.tach)) delete spec.thung.tach;      // chỗ tách thùng đã ghim theo số khoang cũ
      if (st.length !== spec.khoang.length) spec.khoang = st.map(e => ({ rong: e.rong === undefined ? 'auto' : e.rong, canh: e.canh === undefined ? 2 : e.canh, ban_le: e.ban_le || 'trai', dot: e.dot, o: e.o }));
      else st.forEach((e, i) => { const k = spec.khoang[i]; k.dot = e.dot; k.o = e.o; if (e.rong !== undefined) { k.rong = e.rong; k.canh = e.canh; k.ban_le = e.ban_le; } });
      sel = null; nhich = null; renderBays(); rebuild(); setStatus('Đã lùi 1 bước.');
    }

    /* ---- ô và đợt (dùng cho hình đứng tương tác) ---- */
    const cellsOf = i => ((model && model.info.o) || []).filter(c => c.khoang === i).sort((a, b) => a.tu - b.tu);
    // ô mà một nội dung {tu} rơi vào — cùng quy tắc với lõi: ô có `tu` lớn nhất mà ≤ tu, không có thì ô thấp nhất
    const cellFor = (i, tu) => { const cs = cellsOf(i); let r = null; for (const c of cs) if (c.tu <= tu + 0.6) r = c; return r || cs[0] || null; };
    const loaiCua = c => { const L = spec.ngan_keo.loai; return L.find(x => x.ma === c.loai) || L.find(x => x.ma === spec.ngan_keo.mac_dinh) || L[0] || null; };
    const tenO = c => { if (c.kieu === 'suot') return TEN_KIEU.suot; if (!c.kieu) return ''; const lo = loaiCua(c); return `${c.so} ${TEN_KIEU[c.kieu]}${lo ? ' · ' + lo.ten : ''}`; };
    // khoảng cao độ một đợt được phép nằm: trong lọt lòng thân của nó, cách đợt kề ít nhất 20
    function limits(i, j) {
      const d = spec.khoang[i].dot, t = spec.van.t, z = d[j];
      const b = ((model && model.info.than) || []).find(x => z >= x.zb + 30 - 0.01 && z + t <= x.zt - 30 + 0.01);
      if (!b) return [z, z];
      let lo = b.zb + 30, hi = b.zt - 30 - t;
      if (j > 0) lo = Math.max(lo, d[j - 1] + t + 20);
      if (j < d.length - 1) hi = Math.min(hi, d[j + 1] - t - 20);
      return lo <= hi ? [lo, hi] : [z, z];
    }
    // dời đợt: nội dung của ô nằm ngay trên đợt (tu = cao độ đợt) đi theo
    function moveDot(i, j, z) {
      const k = spec.khoang[i], cu = k.dot[j];
      if (cu === undefined || !isFinite(z) || Math.abs(z - cu) < 0.05) return false;
      k.dot[j] = z;
      for (const c of k.o) if (Math.abs(c.tu - cu) < 0.6) c.tu = z;
      return true;
    }
    // thêm đợt vào ô c tại cao độ (mặt dưới) zMuon; suốt treo bám theo tấm phía trên nó nên sang ô trên, ngăn kéo ở lại ô dưới
    function addDot(c, zMuon) {
      const k = spec.khoang[c.khoang], t = spec.van.t, lo = c.z0 + 30, hi = c.z1 - t - 30;
      if (hi < lo) { setStatus(`Ô này chỉ cao ${hien(c.z1 - c.z0)} — không đủ chỗ thêm đợt.`); return false; }
      const z = Math.round(clamp(Math.round(zMuon / BUOC_KEO) * BUOC_KEO, lo, hi) * 10) / 10;
      nho();
      for (const x of k.o) if (x.kieu === 'suot' && cellFor(c.khoang, x.tu) === c) x.tu = z;
      k.dot = k.dot.concat([z]).sort((a, b) => a - b);
      sel = { loai: 'dot', khoang: c.khoang, idx: k.dot.indexOf(z) };
      return true;
    }
    // xoá đợt: 2 ô nhập làm một; nội dung ô trên xuống ô dưới nếu ô dưới còn trống, không thì bỏ
    function delDot(i, j) {
      const k = spec.khoang[i], z = k.dot[j]; if (z === undefined) return;
      const cs = cellsOf(i), duoi = cs.find(c => Math.abs(c.z1 - z) < 0.6), tren = cs.find(c => Math.abs(c.tu - z) < 0.6);
      let bo = '';
      nho();
      if (tren && tren.kieu) {
        if (duoi && !duoi.kieu) { for (const x of k.o) if (cellFor(i, x.tu) === tren) x.tu = duoi.tu; }
        else { k.o = k.o.filter(x => cellFor(i, x.tu) !== tren); bo = tenO(tren); }
      }
      k.dot.splice(j, 1);
      sel = duoi ? { loai: 'o', khoang: i, tu: duoi.tu } : null;
      rebuild();
      setStatus(bo ? `Đã xoá đợt +${hien(z)}; bỏ luôn ${bo} của ô phía trên vì hai ô nhập làm một.` : `Đã xoá đợt +${hien(z)}.`);
    }
    // loai: mã loại ngăn kéo người dùng vừa chọn; bỏ trống = giữ loại ô đang có (ô chưa từng chọn thì theo loại mặc định)
    function setCell(c, kieu, so, loai) {
      const k = spec.khoang[c.khoang];
      nho();
      const cu = k.o.find(x => cellFor(c.khoang, x.tu) === c);
      k.o = k.o.filter(x => cellFor(c.khoang, x.tu) !== c);
      if (kieu) {
        const e = { tu: c.tu, kieu };
        if (kieu !== 'suot') { e.so = clamp(so > 0 ? so : Math.round((c.z1 - c.z0) / 220), 1, 12); const lm = loai || (cu && cu.loai); if (lm) e.loai = lm; }
        k.o.push(e);
      }
      sel = { loai: 'o', khoang: c.khoang, tu: c.tu };
      rebuild();
    }
    function selCell(c) { sel = { loai: 'o', khoang: c.khoang, tu: c.tu }; paintView(); renderBar(); }
    /* ---- vách đứng (bản 1.12): thêm bằng cách bấm vào hình, kéo ngang để chia lại, xoá để gộp 2 khoang ---- */
    const RONG_MIN = 150;      // lọt lòng khoang nhỏ nhất khi chia bằng tay trên hình
    let cheDoVach = false;
    const datCheDoVach = on => { cheDoVach = !!on; const b = $('[data-act="them-vach"]'); if (b) { b.setAttribute('aria-pressed', String(cheDoVach)); b.classList.toggle('on', cheDoVach); } view.classList.toggle('themvach', cheDoVach); if (cheDoVach) setStatus('Bấm vào chỗ muốn đặt vách trong tủ trên hình. Esc hoặc bấm lại nút “＋ Vách” để thôi.'); };
    // ghim bề rộng mọi khoang theo số đang hiển thị (để các vách khác đứng yên), rồi cho đúng một khoang "tự chia" hứng phần lệch
    const ghimRong = () => { const w = (model && model.info.khoang) || []; spec.khoang.forEach((k, i) => { if (w[i] > 0) k.rong = w[i]; }); };
    function themVach(i, x) {
      const k = spec.khoang[i], w = model && model.info.khoang && model.info.khoang[i], x0 = model && model.info.x_khoang && model.info.x_khoang[i], t = spec.van.t;
      if (!k || !(w > 0) || x0 === undefined) return false;
      if (w < 2 * RONG_MIN + t) { setStatus(`Khoang ${i + 1} chỉ rộng ${hien(w)} — không đủ chỗ thêm vách (mỗi bên ít nhất ${RONG_MIN}).`); return false; }
      const wL = clamp(Math.round((x - t / 2 - x0) / BUOC_KEO) * BUOC_KEO, RONG_MIN, Math.floor((w - t - RONG_MIN) / BUOC_KEO) * BUOC_KEO);
      nho(); ghimRong();
      const trai = clone(spec.khoang[i]), canh = k.canh === 2 ? 1 : k.canh;
      trai.rong = wL; trai.canh = canh; if (k.canh === 2) trai.ban_le = 'trai';
      const phai = { rong: 'auto', canh, ban_le: k.canh === 2 ? 'phai' : k.ban_le, dot: (k.dot || []).slice(), o: [] };      // đợt chép sang; ngăn kéo / suốt treo ở lại khoang trái
      spec.khoang.splice(i, 1, trai, phai);
      sel = { loai: 'vach', idx: i + 1 };
      renderBays(); rebuild();
      if (!model.errors.length) setStatus(`Đã thêm vách: khoang ${i + 1} lọt lòng ${hien(model.info.khoang[i])}, khoang ${i + 2} lọt lòng ${hien(model.info.khoang[i + 1])}. Kéo vách sang trái / phải để chỉnh.`);
      return true;
    }
    // dời vách idx (giữa khoang idx−1 và idx) một đoạn d: tổng 2 khoang không đổi
    function doiVach(idx, wL) {
      const w = (model && model.info.khoang) || [], tong = w[idx - 1] + w[idx];
      if (!(tong > 0)) return false;
      wL = clamp(wL, RONG_MIN, tong - RONG_MIN);
      if (Math.abs(wL - w[idx - 1]) < 0.05) return false;
      ghimRong(); spec.khoang[idx - 1].rong = Math.round(wL * 10) / 10; spec.khoang[idx].rong = 'auto';
      return true;
    }
    function xoaVach(idx) {
      const a = spec.khoang[idx - 1], b = spec.khoang[idx]; if (!a || !b) return;
      nho(); ghimRong();
      const bo = (b.o || []).length;
      a.rong = 'auto'; a.canh = Math.min(2, (a.canh || 0) + (b.canh || 0));
      spec.khoang.splice(idx, 1);
      sel = null; renderBays(); rebuild();
      setStatus(`Đã bỏ vách: khoang ${idx} và ${idx + 1} gộp làm một (giữ đợt của khoang trái${bo ? `, bỏ ${bo} ngăn kéo / suốt treo của khoang phải` : ''}).`);
    }
    function fixSel() {
      if (!sel) return;
      const k = spec.khoang[sel.khoang];
      if (sel.loai === 'vach') { if (!(sel.idx >= 1 && sel.idx < spec.khoang.length)) sel = null; return; }
      if (!k) { sel = null; return; }
      if (sel.loai === 'dot') { if (!(sel.idx >= 0 && sel.idx < k.dot.length)) sel = null; return; }
      const c = cellFor(sel.khoang, sel.tu); if (!c) sel = null; else sel.tu = c.tu;
    }

    /* ---- dựng lại + hình ---- */
    // Cỡ hình đứng: rộng hết khung; cao sao cho hình + thanh sửa bên dưới cùng nằm trong phần đang thấy (khỏi phải cuộn mới bấm được "ngăn kéo / suốt treo")
    function viewSize() {
      const w = view.clientWidth - 12, ih = root.innerHeight || 800, pr = probe.offsetHeight;      // khung đang ẩn (clientWidth = 0, pr = 0) thì dùng cỡ mặc định
      let cao = Math.round(ih * (inCF ? 0.42 : 0.74));
      if (pr > 0) {
        const le = 14 + 8 + 10;      // viền + đệm của khung hình, khoảng cách tới thanh sửa, chừa đáy
        if (inCF) { const b = $('.body'); cao = b.clientHeight - (view.getBoundingClientRect().top - b.getBoundingClientRect().top + b.scrollTop) - pr - le; }
        else if (getComputedStyle($('.colv')).position === 'sticky') cao = ih - ($('.split').getBoundingClientRect().top + (root.scrollY || 0)) - $('.vtools').offsetHeight - 6 - pr - le;
      }
      return { rong_px: w > 120 ? w : (inCF ? 410 : 680), cao_px: Math.max(240, cao) };
    }
    /* ---- ĐIỆN – NƯỚC của phòng so với tủ đang mở (bản 1.18) ---- */
    // Chỗ đặt tủ đang biết: khung / hình / điểm bấm đang chờ vẽ (khungCho) → tủ vừa vẽ (noi.dat) → khung của thẻ Phòng đã vẽ đúng tủ đang nối → toạ độ gõ ở "Đặt tại toạ độ".
    function choDatTu() {
      if (khungCho && khungCho.d && Array.isArray(khungCho.d.goc)) return { goc: khungCho.d.goc, xoay: khungCho.d.xoay || 0 };
      if (noi && noi.dat) return noi.dat;
      if (noi && noi.id && phong && Array.isArray(phong.khung)) { const j = phong.khung.findIndex(k => k.tu_id === noi.id); if (j >= 0) { const d = Ph.datKhung(Ph.hinhHoc(phong), j); if (d) return { goc: d.goc, xoay: d.xoay || 0 }; } }
      const ua = $('[data-ui="useAt"]');
      if (ua && ua.checked) { const c = ['ax', 'ay', 'az'].map(n => parseFloat(String($(`[data-ui="${n}"]`).value).replace(',', '.'))); if (c.every(v => isFinite(v))) return { goc: c, xoay: 0 }; }
      return null;
    }
    // → { diem, luu_y, ghi_chu } của MNCFPhong.dienNuocChoTu, hoặc null (phòng chưa khai điểm nào / chưa biết tủ đặt ở đâu / không điểm nào bị tủ che)
    let dnTuHT = null;
    function dnTu() {
      try {
        if (!Ph || !Ph.dienNuocChoTu || !phong || !Array.isArray(phong.dn) || !phong.dn.length || !model || !model.info || !model.info.hop) return null;
        const k = choDatTu(); if (!k) return null;
        const r = Ph.dienNuocChoTu(model, Ph.hinhHoc(phong), k);
        return r.diem.length ? r : null;
      } catch (e) { return null; }      // (phòng chưa nạp xong lúc bảng mới mở)
    }
    function paintView() {
      fixSel();
      dnTuHT = dnTu();
      view.innerHTML = model && model.info.khoang ? Core.elevationSVG(model, Object.assign({ canh: showDoors, tuong_tac: true, chon: sel, dien_nuoc: dnTuHT ? dnTuHT.diem : null }, viewSize())) : '';
    }
    // ô chọn loại ngăn kéo (mẫu Chenfeng) cho ô đang chọn; từ bản 1.13 có thêm nút mở bảng CHỌN BẰNG HÌNH
    let moLoai = false;
    const loaiSel = (c, attr) => {
      const L = spec.ngan_keo.loai; if (!L.length) return '';
      const cur = (loaiCua(c) || {}).ma;
      return `<label>Loại <select ${attr}="loai"${attr === 'data-ed' ? ' id="mncf-ed-loai"' : ''}>${L.map(x => `<option value="${esc(x.ma)}"${x.ma === cur ? ' selected' : ''}>${esc(x.ten)}${x.mau_id ? '' : ' (chưa có mã mẫu)'}</option>`).join('')}</select></label>` + `<button class="sec lanh" ${attr}="loai-hinh" aria-expanded="${moLoai}" title="Chọn loại ngăn kéo bằng hình">${anhNganKeo(loaiCua(c))}<span>Chọn<br>bằng hình</span></button>` + (moLoai && attr === 'data-ed' ? `<div class="lpop"><div class="edh"><b>Loại ngăn kéo</b> — bấm vào hình để chọn</div><div class="lgrid" role="group" aria-label="Loại ngăn kéo">${L.map(x => `<button class="ltile${x.ma === cur ? ' on' : ''}" data-ed="loai-chon" data-v="${esc(x.ma)}" aria-pressed="${x.ma === cur}">${anhNganKeo(x)}<span>${esc(x.ten)}${x.mau_id ? '' : ' (chưa có mã mẫu)'}</span></button>`).join('')}</div></div>` : '');
    };
    // thanh sửa dưới hình: nội dung của ô đang chọn / cao độ của đợt đang chọn
    const cellBarHTML = (c, attr) => `<div class="edh"><b>Khoang ${c.khoang + 1}</b> · ô +${hien(c.z0)} → +${hien(c.z1)} · cao lọt lòng ${hien(c.z1 - c.z0)}</div>
<div class="seg" role="group" aria-label="Nội dung ô">${[['', 'Trống'], ['nk_am', 'Ngăn kéo âm'], ['nk_trum', 'Ngăn kéo trùm ngoài'], ['suot', 'Suốt treo']].map(([v, t]) => `<button class="segb${(c.kieu || '') === v ? ' on' : ''}" ${attr}="kieu" data-v="${v}" aria-pressed="${(c.kieu || '') === v}">${t}</button>`).join('')}</div>
<div class="edrow">${c.kieu === 'nk_am' || c.kieu === 'nk_trum' ? `<span class="cnt">Số ngăn <button class="sec" ${attr}="so-" aria-label="Bớt 1 ngăn kéo">−</button><output>${c.so}</output><button class="sec" ${attr}="so+" aria-label="Thêm 1 ngăn kéo">+</button></span>${loaiSel(c, attr)}` : ''}<button class="sec" ${attr}="split">+ Thêm đợt giữa ô</button></div>`;
    // bản sao ẩn của thanh sửa ở trạng thái cao nhất: đo chiều cao thật (tuỳ phông chữ, bề rộng bảng) để chừa chỗ, hình không nhảy cỡ khi chọn ô
    probe.innerHTML = cellBarHTML({ khoang: 8, z0: 1888.5, z1: 2788.5, kieu: 'nk_trum', so: 12 }, 'data-x');
    function renderBar() {
      let h = '<p class="hint">Kéo đợt lên xuống để chia ô. Bấm đúp vào ô để thêm đợt. Bấm vào ô để đặt ngăn kéo hoặc suốt treo. <b>＋ Vách</b>: bấm nút rồi bấm vào hình để thêm vách đứng; kéo vách sang trái / phải để chia lại khoang.</p>';
      if (sel && sel.loai === 'vach') {
        const w = (model && model.info.khoang) || [], i = sel.idx;
        h = `<div class="edh"><b>Vách giữa khoang ${i} và ${i + 1}</b> · lọt lòng trái ${hien(w[i - 1])} · phải ${hien(w[i])}</div>
<div class="edrow"><label>Lọt lòng khoang ${i} (bên trái vách)<input type="text" inputmode="decimal" id="mncf-ed-wl" data-ed="wl" value="${esc(fmt(w[i - 1]))}"></label><button class="sec" data-ed="del-vach">Bỏ vách (gộp 2 khoang)</button></div>
<p class="hint">Kéo vách trên hình (bước ${BUOC_KEO} mm), hoặc phím ← → nhích 1 mm (giữ Shift: 10 mm), Delete = bỏ vách.</p>`;
      } else
      if (sel && sel.loai === 'o') {
        const c = cellFor(sel.khoang, sel.tu);
        if (c) h = cellBarHTML(c, 'data-ed');
      } else if (sel && sel.loai === 'dot') {
        const k = spec.khoang[sel.khoang], z = k.dot[sel.idx], cs = cellsOf(sel.khoang);
        const duoi = cs.find(c => Math.abs(c.z1 - z) < 0.6), tren = cs.find(c => Math.abs(c.tu - z) < 0.6);
        h = `<div class="edh"><b>Khoang ${sel.khoang + 1}</b> · đợt ${sel.idx + 1}/${k.dot.length}${duoi ? ` · ô dưới cao ${hien(duoi.z1 - duoi.z0)}` : ''}${tren ? ` · ô trên cao ${hien(tren.z1 - tren.z0)}` : ''}</div>
<div class="edrow"><label>Cao độ mặt dưới (từ sàn)<input type="text" inputmode="decimal" id="mncf-ed-z" data-ed="z" value="${esc(fmt(z))}"></label><button class="sec" data-ed="del">Xoá đợt</button></div>
<p class="hint">Kéo trên hình (bước ${BUOC_KEO} mm), hoặc phím ↑ ↓ nhích 1 mm (giữ Shift: 10 mm), Delete = xoá.</p>`;
      }
      if (h === barHTML) return;
      // giữ tiêu điểm bàn phím qua lần vẽ lại (nút vừa bấm / ô cao độ vừa gõ)
      const a = sh.activeElement, giu = a && bar.contains(a) && a.dataset.ed ? `[data-ed="${a.dataset.ed}"]` + (a.dataset.v !== undefined ? `[data-v="${a.dataset.v}"]` : '') : '';
      bar.innerHTML = barHTML = h;
      if (giu) { const n = bar.querySelector(giu); if (n) { n.focus(); if (n.dataset.ed === 'z') n.select(); } else view.focus({ preventScroll: true }); }
    }
    function paint() {
      paintView();
      const m = [];
      model.errors.forEach(t => m.push(`<div class="msg err">${esc(t)}</div>`));
      model.warnings.forEach(t => m.push(`<div class="msg warn">${esc(t)}</div>`));
      model.notes.forEach(t => m.push(`<div class="msg note">${esc(t)}</div>`));
      if (dnTuHT && !model.errors.length) { dnTuHT.luu_y.forEach(t => m.push(`<div class="msg warn dn">${esc(t)}</div>`)); dnTuHT.ghi_chu.forEach(t => m.push(`<div class="msg note dn">${esc(t)}</div>`)); }      // điện – nước sau tủ (bản 1.18)
      if (inCF && Drv && Drv.available() && !model.errors.length) {
        const have = Drv.drillTypes();
        if (have.length) for (const [k, label] of [['thung', 'thùng, chân'], ['phao', 'phào + thanh phụ trợ']])
          if (have.indexOf(spec.khoan[k]) < 0) m.push(`<div class="msg warn">Kiểu khoan "${esc(spec.khoan[k])}" (${label}) không có trong cấu hình khoan của tài khoản Chenfeng này (đang có: ${esc(have.join(', '))}). Sửa ở tab Chuẩn xưởng, nếu không các tấm đó sẽ không được khoan.</div>`);
      }
      $('.msgs').innerHTML = m.join('');
      { const pe = $('[data-ui="phieu"]'); if (pe) { const h = phieuHTML(Core.phieu(model), 'Tự kiểm trước khi vẽ'); if (pe._h !== h) { pe.innerHTML = pe._h = h; } } }      // chỉ thay ruột: người dùng đang mở phiếu thì vẫn mở
      $$('[data-giai]').forEach(p => { const giai = (SETTINGS[+p.dataset.giai] || [])[2]; if (giai) p.textContent = giai(spec); });      // dòng giải thích ở Chuẩn xưởng đi theo số đang gõ
      $('.sum').innerHTML = model.errors.length ? '' : Core.summary(model).map(t => `<li>${esc(t)}</li>`).join('');
      $$('.bay').forEach((c, i) => {
        const k = spec.khoang[i]; if (!k) return;
        const w = model.info.khoang && model.info.khoang[i]; c.querySelector('.w').textContent = w ? `lọt lòng ${hien(w)}` : '';
        const d = c.querySelector('[data-b="dot"]'); if (d && sh.activeElement !== d) d.value = k.dot.map(fmt).join(', ');      // ô đang gõ thì không ghi đè
        const co = cellsOf(i).filter(x => x.kieu).map(x => `ô +${hien(x.z0)} → +${hien(x.z1)}: ${tenO(x)}`);
        c.querySelector('.noi').textContent = co.length ? co.join('\n') : 'Chưa có ngăn kéo, suốt treo — bấm vào ô trên hình để thêm.';
      });
      const d = $('[data-act="draw"]'); if (d) d.disabled = busy || model.errors.length > 0;
      const rd = $('[data-act="redraw"]'); if (rd) rd.disabled = busy || model.errors.length > 0 || !noi;
      const pk = $('[data-act="pick"]'); if (pk) pk.disabled = busy;
      const bh = $('[data-act="hinh"]'); if (bh) bh.disabled = busy;
      const bd = $('[data-act="dat"]'); if (bd) bd.disabled = busy;
      const chb = $('[data-act="chuanhoa"]'); if (chb) { chb.disabled = busy; chb.textContent = `Chuẩn hoá mẫu kho đang chọn → ván ${hien(spec.van.t)} · hậu ${hien(spec.hau.t || 6)} phủ sau`; }
      capNoi(); capHinh();
      const j = $('.pri[data-act="json"]'); if (j) j.disabled = model.errors.length > 0;
      renderBar();
    }
    function rebuild(khongLuu) {
      if (!busy) setStatus('');      // thông báo của thao tác trước không còn đúng nữa (đang vẽ thì giữ lời nhắc của Chenfeng)
      spec = Core.normalize(spec);
      model = Core.build(spec);
      // đưa mốc của nội dung ô về đúng mốc của ô chứa nó (mẫu tủ viết tay có thể ghi mốc lệch) — để khi kéo đợt, nội dung đi theo đúng ô
      spec.khoang.forEach((k, i) => { for (const c of k.o) { const o = cellFor(i, c.tu); if (o) c.tu = o.tu; } });
      if (khongLuu !== true) store.save(spec);
      paint();
    }
    let tmr = 0; const later = () => { clearTimeout(tmr); tmr = setTimeout(safe(() => rebuild()), 160); };

    /* ---- xuất file ---- */
    // Trả về 'saved' | 'declined' | 'failed'. Trang chạy trong khung xem artifact của Claude không tự tải file được → dùng năng lực "downloads" (người xem xác nhận).
    async function download(name, text, mime) {
      try {
        const cl = root.claude;
        if (!inCF && cl && typeof cl.use === 'function') {
          const dl = await cl.use('downloads');
          if (dl && typeof dl.save === 'function') {
            try { await dl.save({ filename: name, data: text }); return 'saved'; }
            catch (e) { return e && e.code === 'declined' ? 'declined' : 'failed'; }
          }
        }
      } catch (e) { /* không có năng lực → tải kiểu thường */ }
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; a.style.display = 'none';
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      return 'saved';
    }
    const saveFile = (name, text, mime, okMsg) => download(name, text, mime).then(r => setStatus(r === 'saved' ? okMsg : r === 'declined' ? 'Đã huỷ lưu file.' : 'Không lưu được file ở đây — mở trang này trong Claude (đã đăng nhập) hoặc dùng file mn-chenfeng.html.'));
    const fileBase = () => (spec.ma || 'tu').replace(/[^\w\-]+/g, '_') + '_' + Math.round(spec.rong) + 'x' + Math.round(spec.cao);
    const setStatus = t => { $('.status').textContent = t || ''; if (!chip.hidden) chip.textContent = t || ''; };

    /* ---- báo cáo sau khi vẽ ---- */
    function showReport(rep) {
      lastRep = rep; const k = rep.kiem_tra, h = [];
      if (rep.ok) h.push(`<div class="msg ok">${rep.cap_nhat ? 'Đã cập nhật tủ tại chỗ' : 'Đã vẽ xong'} — ${k.so_tam_khop}/${k.so_tam_thiet_ke} tấm đúng vị trí, ${k.so_lo} lỗ khoan.</div>`);
      else h.push(`<div class="msg err">${rep.giai_doan === 'thiet_ke' ? 'Thiết kế còn lỗi, chưa vẽ.' : rep.giai_doan === 'nhap' ? 'Chưa vẽ được.' : rep.giai_doan === 'tim' ? 'Không tìm lại được tủ trên bản vẽ.' : rep.giai_doan === 'xoa' ? 'Chưa cập nhật được.' : 'Vẽ xong nhưng còn lỗi phải sửa trước khi sản xuất — xem các dòng đỏ.'}</div>`);
      (rep.errors || []).forEach(t => h.push(`<div class="msg err">${esc(t)}</div>`));
      (rep.warnings || []).forEach(t => h.push(`<div class="msg warn">${esc(t)}</div>`));
      if (rep.sua_khoan && rep.sua_khoan.fixed) h.push(`<div class="msg note">Mẫu ngăn kéo còn mang kiểu khoan cũ (${esc((rep.sua_khoan.old || []).join(', '))}): đã đổi sang ${esc(rep.sua_khoan.to)} cho ${rep.sua_khoan.fixed} tấm rồi cho Chenfeng khoan lại. Nên sửa luôn trong mẫu để lần sau khỏi phải đổi.</div>`);
      if (rep.goc_cf && rep.giai_doan === 'xong' && rep.module && rep.module.ok) h.push(`<div class="msg note mod">Tủ vẽ bằng <b>lệnh gốc của Chenfeng</b> (${rep.buoc}/${rep.tong_buoc} lệnh) và đã gom thành <b>một module “${esc(rep.module.ten)}”</b>: chọn 1 tấm của tủ → thẻ <b>Template</b> (Thông số) ở bảng phải của Chenfeng → trong cây mẫu <b>bấm vào dòng trên cùng “${esc(rep.module.ten)}”</b> (module của cả tủ; các dòng “左右侧板模板” bên dưới là từng thùng, kích thước của chúng tự tính theo module mẹ — đừng gõ đè) → gõ L (rộng) / W (sâu) / H (cao) mới vào <b>cột cuối “Expression”</b> → <b>Apply data modifications</b>. Thùng, vách, đợt, hậu, cánh (tấm tự động của Chenfeng) cùng phào, chân, khung hộc kéo${rep.module.mau_con ? `, ${rep.module.mau_con} hộp ngăn kéo / suốt treo` : ''} đều chạy theo, Chenfeng khoan lại. Bấm đúp vào đợt / vách / cánh để mở lại hộp thoại gốc của tấm đó. Đổi số đợt, số ngăn kéo, kiểu ruột thì sửa ở bảng này rồi bấm “Cập nhật tủ này”.</div>`);
      else if (rep.goc_cf && rep.giai_doan === 'xong') h.push(`<div class="msg note mod">Tủ vẽ bằng <b>lệnh gốc của Chenfeng</b> (${rep.buoc}/${rep.tong_buoc} lệnh): hồi, vách, nóc đáy, hậu, đợt, cánh là tấm tự động trong cây mẫu gốc. Sửa như tủ vẽ tay: chọn 1 tấm → thẻ <b>Template</b> ở bảng phải → đổi L / W / H của “左右侧板模板” (cả thùng chạy theo), hoặc bấm đúp vào đợt / vách / cánh để mở lại hộp thoại của tấm đó.${rep.tam_roi ? ` ${rep.tam_roi} tấm còn lại (phào, chân, khung hộc kéo…) và ngăn kéo / suốt treo là tấm rời — đổi kích thước tủ xong phải kéo lại bằng tay, hoặc sửa số ở bảng này rồi bấm “Cập nhật tủ này”.` : ''}</div>`);
      if (rep.module && rep.module.ok && !rep.goc_cf) h.push(`<div class="msg note mod">Tủ đã là module tham số của Chenfeng “${esc(rep.module.ten)}”: chọn 1 tấm của tủ → thẻ <b>Template</b> (Thông số) ở bảng bên phải của Chenfeng hiện L (rộng) / W (sâu) / H (cao) → gõ số mới vào <b>cột cuối “Expression”</b> của dòng đó (cột “Parameter Value” chỉ để xem) → bấm <b>Apply data modifications</b>, tủ co giãn đúng kết cấu và Chenfeng khoan lại.${rep.module.mau_con ? ` ${rep.module.mau_con} hộp ngăn kéo / suốt treo bám theo tủ.` : ''} Đổi số đợt, số ngăn kéo, kiểu ruột thì sửa ở bảng này rồi bấm “Cập nhật tủ này”.</div>`);
      if (rep.xoay) h.push(rep.xoay.ok ? `<div class="msg note">Đã đặt tủ theo ${rep.xoay.hinh === 'diem' ? 'điểm bấm trên mặt bằng' : rep.xoay.hinh ? 'hình trên mặt bằng' : 'tường ' + esc(rep.xoay.tuong)}, xoay ${hien(rep.xoay.do)}° — tủ nằm đúng ${rep.xoay.hinh === 'diem' ? 'chỗ đã bấm' : rep.xoay.hinh ? 'chỗ hình' : 'khung'}.${rep.module && rep.module.ok ? ' Tủ là module nên vẫn sửa được: đổi L / W / H ở ô Thông số của Chenfeng, hoặc sửa ở bảng này rồi bấm “Cập nhật tủ này”.' : ' Tủ đã xoay mà không phải module: sửa thì xoá tủ rồi vẽ lại.'}</div>`
        : `<div class="msg warn">Chưa xoay được tủ theo ${rep.xoay.hinh ? 'hình' : 'tường ' + esc(rep.xoay.tuong)} (${esc(rep.xoay.reason || '')}). Dùng lệnh xoay của Chenfeng: xoay ${hien(rep.xoay.do)}° quanh điểm ${hien(rep.xoay.goc[0])}; ${hien(rep.xoay.goc[1])} (góc trái–trước của tủ).</div>`);
      if (rep.dien_nuoc && rep.giai_doan === 'xong') { rep.dien_nuoc.luu_y.forEach(t => h.push(`<div class="msg warn dn">Điện – nước: ${esc(t)}</div>`)); rep.dien_nuoc.ghi_chu.forEach(t => h.push(`<div class="msg note dn">Điện – nước: ${esc(t)}</div>`)); }
      if (rep.giai_doan === 'xong') {      // hai phiếu của lần vẽ: thiết kế (trước khi vẽ) và tấm + lỗ khoan thật (sau khi vẽ)
        if (model) h.push(`<details class="phieu" data-ui="phieu-tk">${phieuHTML(Core.phieu(model), 'Tự kiểm trước khi vẽ')}</details>`);
        if (rep.do_loi) h.push(phieuVeHTML(rep.do_loi, 'Dò lỗi sản xuất trên tấm thật', 'phieu-ve', rep.do_loi.dem.loi + rep.do_loi.dem.luu_y > 0) + dongDoLoi(rep.do_loi, true, (rep.warnings || []).some(t => /chưa có lỗ khoan|không có lỗ cam/.test(t)) ? ['khong_lo'] : null));
      }
      h.push(mauVeHTML(rep));
      if (rep.cap_nhat) h.push(`<div class="msg note">Đã bỏ ${rep.cap_nhat.bo} đối tượng của tủ cũ (tấm, hộp ngăn kéo, suốt treo, lỗ khoan) rồi vẽ lại đúng chỗ cũ.${rep.cap_nhat.thieu ? ` Tủ cũ thiếu ${rep.cap_nhat.thieu} tấm so với lúc vẽ (đã bị xoá / sửa tay).` : ''} Bản lề, tay nắm anh tự gắn thêm được giữ nguyên — kiểm tra lại vị trí của chúng.</div>`);
      if (k) {
        const rows = [['Tấm theo thiết kế', `${k.so_tam_khop} / ${k.so_tam_thiet_ke}`], ['Tấm do mẫu sinh (hộp ngăn kéo…)', k.so_tam_mau], ['Lỗ khoan', k.so_lo],
          ['Phụ kiện', Object.keys(k.phu_kien).map(n => `${n} ×${k.phu_kien[n]}`).join(', ') || '—'],
          ['Góc trái – trước – dưới của tủ', rep.goc ? rep.goc.map(fmt).join(', ') : '—'],
          ['Hộp bao thật', k.hop ? `${fmt(k.hop[1] - k.hop[0])} × ${fmt(k.hop[3] - k.hop[2])} × ${fmt(k.hop[5] - k.hop[4])}` : '—']];
        h.push(`<table>${rows.map(r => `<tr><td>${esc(r[0])}</td><td class="n">${esc(r[1])}</td></tr>`).join('')}</table>`);
        h.push(`<div class="frow" style="margin-top:10px"><button class="sec" data-act="undo">Hoàn tác lần vẽ này</button><button class="sec" data-act="zoom">Xem toàn bộ</button></div>`);
      }
      $('.report').innerHTML = h.join('');
      switchTab('kq');
    }

    /* ---- nút "Dò lỗi sản xuất" (bản 1.20): đọc tấm + lỗ khoan thật — không chọn gì = cả bản vẽ, có chọn = các tấm đang chọn ---- */
    function doLoi() {
      const el = $('[data-ui="doloi"]');
      if (!el || !Drv || busy || typeof Drv.doLoi !== 'function') return;
      if (!Drv.available()) { setStatus('Không thấy bản vẽ Chenfeng trong trang này.'); return; }
      let p;
      try { p = Drv.doLoi(null, { kho: { dai: spec.van.kho_dai, rong: spec.van.kho_rong } }); }
      catch (e) { el.innerHTML = `<div class="msg err">Chưa dò được: ${esc(String(e && e.message || e))}</div>`; setStatus('Chưa dò được lỗi sản xuất.'); return; }
      if (!p.so_tam) { el.innerHTML = '<div class="msg note">Bản vẽ chưa có tấm ván nào để dò.</div>'; setStatus('Bản vẽ chưa có tấm ván nào.'); return; }
      const pv = p.pham_vi === 'chon' ? `${p.so_tam} tấm đang chọn` : `${p.so_tam} tấm — cả bản vẽ`;
      const kq = p.dem.loi ? `có ${p.dem.loi} mục LỖI phải sửa trước khi sản xuất${p.dem.luu_y ? `, ${p.dem.luu_y} mục cần xưởng xem lại` : ''}` : p.dem.luu_y ? `không thấy lỗi, có ${p.dem.luu_y} mục cần xưởng xem lại` : 'không thấy lỗi sản xuất nào';
      el.innerHTML = `<div class="msg ${p.dem.loi ? 'err' : p.dem.luu_y ? 'warn' : 'ok'}">Đã dò ${pv}, ${p.so_lo} lỗ khoan: ${kq}.${p.dem.chua ? ' Có mục chưa kiểm được (không đọc được cấu hình khoan của Chenfeng).' : ''}</div>` + phieuVeHTML(p, 'Phiếu dò lỗi sản xuất', 'phieu-do', true) + dongDoLoi(p, false);
      setStatus(p.dem.loi ? `Dò lỗi sản xuất: có ${p.dem.loi} mục lỗi — xem thẻ Kết quả.` : p.dem.luu_y ? `Dò lỗi sản xuất: không lỗi, ${p.dem.luu_y} mục cần xem lại.` : 'Dò lỗi sản xuất: không thấy lỗi.');
    }

    /* ---- nút "Xuất ván" (bản 1.22 — anh Jason 04/10/2026): dò lỗi → tự chọn tấm của tủ đang chọn / cả bản vẽ → lệnh CD → chờ khung "Order Splitting" ---- */
    const xv = { ban: false, pv: null, luot: 0 };      // pv = phạm vi của lần bấm gần nhất: "Vẫn xuất" / "Thử lại" dùng lại đúng tập đó (tập chọn trên bản vẽ đã mất sau lần chạy trước)
    const coTroLy = () => { try { return !!(root.__MNCF_NAP__ && root.__MNCF_NAP__.ban_nap >= 2); } catch (e) { return false; } };      // bộ nạp bản 2 trở lên có kèm trợ lý ở trang sản xuất
    const xvPham = pv => pv.pham_vi === 'chon' ? `${pv.tam.length} tấm của ${pv.tu.length > 1 ? `${pv.tu.length} tủ đang chọn (${pv.tu.join(', ')})` : `tủ ${pv.tu[0] || 'đang chọn'}`}` : `${pv.tam.length} tấm — cả bản vẽ${pv.tu.length ? ` (${pv.tu.length} tủ)` : ''}`;
    const XV_DUNG_F5 = 'Đừng F5 tab trang sản xuất: tải lại là mất dữ liệu tấm, phải bấm Xuất ván lại.';
    const xvNutLai = '<div class="frow"><button class="sec" data-act="xuatvan-lai" title="Đóng khung đang mở rồi chạy lại lệnh CD cho đúng các tấm của lần vừa rồi">Thử lại</button></div>';
    async function xuatVan(che) {      // che: '' = nút chính; 'van' = "Vẫn xuất" (bỏ qua lỗi sản xuất); 'lai' = "Thử lại"
      const el = $('[data-ui="xuatvan"]');
      if (!el || !Drv || typeof Drv.xuatVan !== 'function' || xv.ban) return;
      if (busy) { setStatus('Bảng đang vẽ — chờ vẽ xong rồi xuất ván.'); return; }
      if (!Drv.available()) { setStatus('Không thấy bản vẽ Chenfeng trong trang này.'); return; }
      const luot = ++xv.luot; xv.ban = true;
      try {
        const pv = che && xv.pv ? xv.pv : Drv.phamViXuat();
        xv.pv = pv;
        if (!pv.tam.length) { el.innerHTML = '<div class="msg note">Bản vẽ chưa có tấm ván nào để xuất.</div>'; setStatus('Bản vẽ chưa có tấm ván nào.'); return; }
        const pham = xvPham(pv);
        if (!che && typeof Drv.doLoi === 'function') {      // dò lỗi sản xuất trên đúng các tấm sắp xuất: có LỖI thì dừng, hỏi lại
          let p = null; try { p = Drv.doLoi(pv.tam, { kho: { dai: spec.van.kho_dai, rong: spec.van.kho_rong } }); } catch (e) { p = null; }
          if (p && p.dem.loi) {
            const muc = p.muc.filter(m => m.ket === 'loi').map(m => m.ten).join('; ');
            el.innerHTML = `<div class="msg err">Chưa xuất: ${esc(pham)} còn ${p.dem.loi} mục LỖI sản xuất (${esc(muc)}) — sửa xong hãy xuất, kẻo cắt ra tấm hỏng.</div>${dongDoLoi(p, false)}<div class="frow"><button class="sec" data-act="xuatvan-van" title="Bỏ qua các lỗi vừa nêu và chạy lệnh CD">Vẫn xuất (bỏ qua lỗi)</button></div>`;
            setStatus(`Chưa xuất ván: còn ${p.dem.loi} mục lỗi sản xuất — xem thẻ Kết quả.`);
            return;
          }
        }
        el.innerHTML = `<div class="msg note">Đang chạy lệnh tách đơn CD cho ${esc(pham)}…</div>`;
        const r = await Drv.xuatVan({ pham_vi_san: pv, onStatus: setStatus });
        if (luot !== xv.luot) return;
        if (!r.ok) { el.innerHTML = `<div class="msg err">Chưa xuất được: ${esc(r.reason || '')}</div>${r.giai_doan === 'chon' ? '' : xvNutLai}`; setStatus('Chưa xuất được ván — xem thẻ Kết quả.'); return; }
        const dem = `${pham}${r.so_pk ? `, ${r.so_pk} phụ kiện` : ''}`;
        el.innerHTML = `<div class="msg note">Đã chạy CD cho ${esc(dem)}. Đang chờ khung “Order Splitting” của Chenfeng (thường 2–4 giây)…</div>`;
        setStatus('Đang chờ khung xuất ván của Chenfeng…');
        xv.ban = false;                                   // khung đã mở: cho bấm "Thử lại" trong lúc chờ
        const cham = setTimeout(safe(() => { if (luot === xv.luot && /Đang chờ khung/.test(el.textContent)) el.innerHTML = `<div class="msg warn">Khung “Order Splitting” tải lâu bất thường (bình thường 2–4 giây) — đường truyền tới máy chủ sản xuất của Chenfeng đang chậm. Chờ thêm, hoặc bấm Thử lại.</div>${xvNutLai}`; }), 9000);
        const sn = await r.san_sang;
        clearTimeout(cham);
        if (luot !== xv.luot) return;
        if (sn.ok) {
          const giay = Math.max(5, Math.round((4 + 0.05 * r.so_tam) / 5) * 5);
          const sau = coTroLy()
            ? `Trang sản xuất mở ở tab mới; <b>trợ lý Một Nhà</b> ở đó tự chạy tối ưu, tự dừng khi số tờ ván đứng yên rồi mở sơ đồ cắt (máy chủ Chenfeng tính khoảng ${giay} giây cho ${r.so_tam} tấm).`
            : `Trang sản xuất mở ở tab mới (máy chủ Chenfeng tính khoảng ${giay} giây cho ${r.so_tam} tấm). Ở đó: bảng 优化进度 hiện → <b>开始优化</b> → đếm 3–5 giây → <b>停止优化</b> → <b>确认新优化</b> (thanh tiến độ không bao giờ tự dừng). Tiện ích trên máy này là bản cũ: tải zip mới ở kho và cài lại để có trợ lý tự làm các bước đó.`;
          el.innerHTML = `<div class="msg ok">Khung xuất ván đã mở — ${esc(dem)}. Bấm 打开 trong khung nhỏ “Order Splitting”.</div><div class="msg note">${sau} ${XV_DUNG_F5}</div>`;
          setStatus('Khung xuất ván đã mở — bấm 打开 trong khung nhỏ.');
          r.da_mo.then(safe(mo => { if (!mo || luot !== xv.luot) return; el.innerHTML = `<div class="msg ok">Đã bấm 打开 — trang sản xuất đang mở ở tab mới (${esc(dem)}).</div><div class="msg note">${XV_DUNG_F5} Trang trắng quá 1 phút mà trợ lý không báo gì: đóng tab đó rồi bấm Xuất ván lại.</div>`; setStatus('Trang sản xuất đang mở ở tab mới.'); }));
        } else if (sn.ly_do === 'dong') { el.innerHTML = '<div class="msg note">Khung xuất ván đã bị đóng trước khi sẵn sàng — chưa có gì được gửi đi. Bấm Xuất ván để chạy lại.</div>'; setStatus('Khung xuất ván đã đóng.'); }
        else {
          el.innerHTML = `<div class="msg err">${sn.ly_do === 'loi' ? 'Khung xuất ván không tải được — máy không nối được tới máy chủ sản xuất của Chenfeng (sc.leye.site) lúc này.' : 'Khung xuất ván tải quá lâu mà chưa xong — máy chủ sản xuất của Chenfeng đang chậm.'} Chưa có gì được gửi đi. Bấm Thử lại (bảng tự đóng khung hỏng rồi chạy lại lệnh CD).</div>${xvNutLai}`;
          setStatus('Khung xuất ván không tải được — bấm Thử lại ở thẻ Kết quả.');
        }
      } catch (e) { el.innerHTML = `<div class="msg err">Chưa xuất được: ${esc(String(e && e.message || e))}</div>`; setStatus('Chưa xuất được ván.'); }
      finally { if (luot === xv.luot) xv.ban = false; }
    }

    function switchTab(name) { panel.dataset.tabon = name; $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === name)); $$('.pane').forEach(p => { p.hidden = p.dataset.pane !== name; }); if (name === 'tu' && model) { if (dnTuHT || dnTu()) paint(); else paintView(); } if (name === 'phong') paintPhong(); if (name === 'kho') { veChon(); khoNap(); } if (name === 'mausac') { veO(); veGan(); veDung(); vlNap(); } if (name !== 'phong' && veMD) datVeMD(false); }      // có điện – nước sau tủ: vẽ lại cả dòng báo (phòng có thể vừa sửa ở thẻ Phòng)
    function open() { panel.hidden = false; launch.hidden = true; if (model) paintView(); }
    function close() { panel.hidden = true; launch.hidden = !inCF; if (xem) dongXem(); }
    // PHÍM TẮT ẩn / hiện bảng: Alt + M (bản 1.20.1 — anh Jason 04/10/2026 09:10). Bắt ở pha "capture" của cửa sổ nên tới trước dòng lệnh của Chenfeng và phím không lọt xuống trang.
    // Chenfeng đang dùng Alt + 1…9, Alt + D / S / F / Q / W / E / R, Alt + ` (đã dò trong mã Chenfeng 04/10/2026) — Alt + M còn trống; Chrome trên Windows cũng không dùng.
    if (inCF) root.addEventListener('keydown', safe(e => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.code !== 'KeyM' || e.repeat) return;
      e.preventDefault(); e.stopPropagation();
      if (panel.hidden) open(); else close();
    }), true);

    async function draw(opt) {
      if (!Drv || !Drv.available()) { setStatus('Không thấy bản vẽ Chenfeng trong trang này.'); return null; }
      if (busy) return null;
      busy = true; rebuild();
      // toạ độ gõ trong bảng = góc trái – trước – dưới của cả tủ (giống điểm bấm tay); opt.at / opt.corner dành cho lời gọi bằng mã
      const o = { onStatus: setStatus };
      if (opt && opt.at) o.at = opt.at;
      else if (opt && opt.corner) o.corner = opt.corner;
      else if ($('[data-ui="useAt"]') && $('[data-ui="useAt"]').checked) o.corner = ['ax', 'ay', 'az'].map(n => parseFloat(String($(`[data-ui="${n}"]`).value).replace(',', '.')) || 0);
      if (!o.at && !o.corner) { panel.hidden = true; chip.textContent = 'Đang chuẩn bị…'; chip.hidden = false; }
      // vẽ đúng vị trí của khung đang mở (thẻ Phòng) hoặc của hình vừa lấy trên mặt bằng → tủ quay theo tường / theo hình (bản 1.16: driver tự đặt + xoay, cả tủ lệnh gốc)
      const kc = khungCho && khungCho.d && o.corner && o.corner.every((v, i) => Math.abs(v - khungCho.d.goc[i]) < 0.01) ? khungCho : null;
      if (kc && kc.d.xoay) o.xoay = kc.d.xoay;
      let rep;
      try { rep = await Drv.draw(spec, o); }
      catch (e) { rep = { ok: false, giai_doan: 'nhap', errors: [String(e && e.message || e)], warnings: [] }; }
      if (rep.giai_doan === 'xong') rep.do_mau = await tuDoMau();      // trước lệnh "xem toàn bộ": bước đổ màu phải nối liền lần vẽ thì "Hoàn tác lần vẽ này" mới lùi được cả hai
      khungCho = null; capHinh();
      if (kc && rep.giai_doan === 'xong') { try { ghiKhung(rep, kc); } catch (e) { /* báo ở kết quả */ } }
      chip.hidden = true; panel.hidden = false; launch.hidden = true; busy = false;
      try {
        lastRep = rep;
        if (Ph) paintPhong();      // mở lại các nút của thẻ Phòng (bị khoá trong lúc vẽ), cập nhật "đã vẽ" của khung
        if (rep.giai_doan === 'xong' && rep.id) {
          noi = { id: rep.id, spec: clone(spec), ten: spec.ma || spec.ten || '' }; khoTu.save(rep.id, noi.spec);
          const g0 = o.corner || rep.goc;      // chỗ tủ vừa đặt (góc trái – trước – dưới + góc xoay): để soi điện – nước của phòng lên tủ khi sửa tiếp
          if (Array.isArray(g0) && g0.length === 3 && g0.every(v => isFinite(v))) noi.dat = { goc: g0.slice(), xoay: o.xoay || 0 };
        }
        if (rep.xoay && rep.xoay.ok && !(rep.module && rep.module.ok)) noi = null;      // tủ đã xoay mà không phải module: bảng không dò lại được vị trí → sửa kích thước ở ô Thông số của Chenfeng
        rebuild(); rep.dien_nuoc = dnTuHT; showReport(rep); setStatus(rep.ok ? 'Đã vẽ xong.' : 'Có lỗi — xem tab Kết quả.');   // lastRep trước rebuild: nút "Cập nhật tủ vừa vẽ" bật theo lần vẽ này
        if (rep.giai_doan === 'xong') Drv.zoom();
      } catch (e) { setStatus('Lỗi khi hiện kết quả: ' + (e && e.message || e)); }
      return rep;
    }

    // Sửa số xong vẽ lại đúng chỗ cũ: bỏ lần vẽ trước (nếu còn trên bản vẽ) rồi vẽ tại chính góc cũ
    /* ---- sửa tủ đã vẽ ---- */
    function capNoi() {
      const el = $('.tunoi'); if (!el) return;
      if (!noi) { el.hidden = true; el.textContent = ''; return; }
      el.hidden = false;
      el.innerHTML = `<span>Đang nối với tủ <b>${esc(noi.ten || '?')}</b> trên bản vẽ (mã ${esc(noi.id)}). Sửa số rồi bấm “Cập nhật tủ này”.</span><button data-act="unlink" title="Thôi nối: bảng trở lại vẽ tủ mới, tủ trên bản vẽ giữ nguyên">Bỏ nối</button>`;
    }
    async function redraw() {
      if (!Drv || busy || !noi) return null;
      if (!Drv.available()) { setStatus('Không thấy bản vẽ Chenfeng trong trang này.'); return null; }
      try {      // tủ đang nối đã bị đổi kích thước ngay trong Chenfeng → số nào người dùng chưa sửa ở bảng thì lấy theo Chenfeng
        const moc = noi.pick && !noi.pick.IsErase ? noi.pick : Drv.all().find(e => Drv.isBoard(e) && Drv.tagOf(e) === noi.id);
        const adj = moc && Drv.specTheoModule && Drv.specTheoModule(noi.spec, moc);
        if (adj) { for (const k of ['rong', 'cao', 'sau_thung']) if (spec[k] === noi.spec[k]) spec[k] = adj[k]; noi.spec = adj; spec = Core.normalize(spec); }
      } catch (e) { /* bỏ qua */ }
      busy = true; rebuild();
      let rep;
      try { rep = await Drv.update(spec, { id: noi.id, specCu: noi.spec, pick: noi.pick }, { onStatus: setStatus }); }
      catch (e) { rep = { ok: false, giai_doan: 'nhap', errors: [String(e && e.message || e)], warnings: [] }; }
      if (rep.giai_doan === 'xong' && !rep.giu_mau) rep.do_mau = await tuDoMau();      // tủ cũ đã có màu thì bộ điều khiển giữ màu đó (rep.giu_mau); chưa có thì theo ô "tự đổ màu"
      busy = false;
      try {
        lastRep = rep;
        if (rep.giai_doan === 'xong') { noi = { id: rep.id || noi.id, spec: clone(spec), ten: spec.ma || spec.ten || '' }; khoTu.save(noi.id, noi.spec); }
        rebuild(); showReport(rep); setStatus(rep.ok ? 'Đã cập nhật tủ tại chỗ.' : rep.giai_doan === 'xong' ? 'Đã cập nhật nhưng có chỗ cần xem — tab Kết quả.' : 'Chưa cập nhật được — xem tab Kết quả.');
      } catch (e) { setStatus('Lỗi khi hiện kết quả: ' + (e && e.message || e)); }
      return rep;
    }
    /* ---- bản 1.16: TỦ THEO HÌNH VẼ TRÊN MẶT BẰNG ----
     * Người dùng vẽ hình chữ nhật / đa tuyến kín lên mặt bằng trong Chenfeng (đúng chỗ tủ đứng), chọn hình rồi bấm nút: bảng đọc rộng, sâu, vị trí, hướng xoay, khấu cột.
     * Mặt trước: tự nhận theo tường / chỗ khuyết; không nhận được thì hỏi bấm 1 điểm phía trước tủ. Vị trí đặt giữ ở `khungCho` — bấm "Vẽ vào Chenfeng" là dựng đúng chỗ. */
    function capHinh() {
      const el = $('.hinhcho'); if (!el) return;
      const k = khungCho && khungCho.hinh;
      if (!k) { el.hidden = true; el.textContent = ''; return; }
      const q = k.k, kh = [];
      if (q.khau.trai.rong > 0) kh.push(`trái ${hien(q.khau.trai.rong)} × ${hien(q.khau.trai.sau)}`);
      if (q.khau.phai.rong > 0) kh.push(`phải ${hien(q.khau.phai.rong)} × ${hien(q.khau.phai.sau)}`);
      q.khau.giua_cot.forEach(c => kh.push(`giữa (cách trái ${hien(c.cach)}) ${hien(c.rong)} × ${hien(c.sau)}`));
      el.hidden = false;
      el.innerHTML = `<span>Đang đặt theo <b>${k.nguon === 'diem' ? 'điểm bấm trên mặt bằng' : 'hình trên mặt bằng'}</b>: ${hien(q.rong)} × ${hien(q.sau)}, xoay ${hien(q.xoay)}°${kh.length ? ', khấu cột ' + esc(kh.join('; ')) : ''}. Mặt trước nhận theo ${esc(q.mat_truoc || '')}. Bấm “Vẽ vào Chenfeng” để dựng tủ đúng chỗ đó.</span><button data-act="hinh-truoc" title="Mặt trước tủ bị nhận sai phía: bấm nút này rồi bấm 1 điểm ở phía TRƯỚC tủ trên bản vẽ">Chọn lại mặt trước</button><button data-act="hinh-bo" title="Thôi đặt theo hình">Bỏ hình</button>`;
    }
    async function theoHinh(hoiTruoc) {
      if (!Drv || busy || !Ph || !Ph.hinhThanhKhung) return;
      if (!Drv.available()) { setStatus('Không thấy bản vẽ Chenfeng trong trang này.'); return; }
      let h = null;
      if (hoiTruoc && khungCho && khungCho.hinh) h = khungCho.hinh.h;      // chọn lại mặt trước của hình đang giữ
      else {
        const r = Drv.docHinh(), bang = r.hinh.filter(x => x.phang === 'bang');
        if (!r.hinh.length) { setStatus('Trên mặt bằng của Chenfeng, vẽ một hình chữ nhật (RECTANG) hoặc đa tuyến kín đúng chỗ tủ đứng, bấm chọn hình đó rồi bấm lại nút này.'); return; }
        if (!bang.length) { setStatus(r.hinh.some(x => x.phang === 'dung') ? 'Hình đang chọn nằm trên MẶT ĐỨNG (mặt tường). Nút này nhận hình vẽ trên MẶT BẰNG (nhìn từ trên xuống) — chia ô trên mặt đứng sẽ có ở bản sau.' : 'Hình đang chọn nằm nghiêng — vẽ hình ở hướng nhìn từ trên xuống.'); return; }
        h = bang[0];
        if (!h.kin) { setStatus('Hình đang chọn chưa khép kín — vẽ hình chữ nhật hoặc đa tuyến KÍN (đỉnh cuối trùng đỉnh đầu).'); return; }
        if (h.cong) { setStatus('Hình có đoạn cong — bảng chỉ nhận hình gồm các cạnh thẳng vuông góc nhau.'); return; }
        if (bang.length > 1) setStatus(`Đang chọn ${bang.length} hình — bảng lấy hình đầu tiên; các hình còn lại làm lần lượt sau.`);
      }
      const dinh = h.dinh3.map(q => [q[0], q[1]]), z = h.dinh3[0][2] || 0;
      let ph = { tuong: [], cot: [] };
      try { ph = Drv.tuongPhong(); } catch (e) { ph = { tuong: [], cot: [] }; }
      const tuong = ph.tuong.filter(w => Math.abs((w.z || 0) - z) < 1 || !w.z), cot = ph.cot.filter(c => c.z1 > z + 1);
      let k = hoiTruoc ? null : Ph.hinhThanhKhung(dinh, { tuong, cot });
      if (hoiTruoc || (!k.ok && k.can_diem)) {
        const an = !panel.hidden; panel.hidden = true; chip.textContent = 'Bấm 1 điểm ở phía TRƯỚC tủ (phía đứng mở cánh)…'; chip.hidden = false;
        let p = null; try { p = await Drv.hoiDiem('Một Nhà: bấm 1 điểm ở phía TRƯỚC tủ (phía đứng mở cánh):'); } catch (e) { p = null; }
        chip.hidden = true; if (an) panel.hidden = false;
        if (!p) { setStatus('Đã huỷ — chưa lấy hình.'); return; }
        k = Ph.hinhThanhKhung(dinh, { tuong, cot, truoc: [p[0], p[1]] });
      }
      if (!k.ok) { setStatus(k.loi); return; }
      // cao tủ: theo trần của tường gần hình nhất (có phòng trên bản vẽ); không có thì giữ số đang nhập
      let cao = spec.cao, theoTran = false;
      if (tuong.length) {
        const tam = dinh.reduce((a, q) => [a[0] + q[0] / dinh.length, a[1] + q[1] / dinh.length], [0, 0]);
        const kc = w => { const dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1], L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((tam[0] - w.a[0]) * dx + (tam[1] - w.a[1]) * dy) / L2)); return Math.hypot(tam[0] - w.a[0] - t * dx, tam[1] - w.a[1] - t * dy); };
        const gan = tuong.filter(w => w.cao > 0).sort((a, b) => kc(a) - kc(b))[0];
        if (gan && kc(gan) < Math.max(k.rong, k.sau) + 200) { cao = gan.cao; theoTran = true; }
      }
      // giữ cách chia khoang đang mở nếu còn hợp bề rộng mới (mỗi cánh 330–620); không thì bảng tự chọn ruột theo bề rộng
      const soCanh = spec.khoang.reduce((n, kk) => n + (kk.canh || 0), 0), rongCanh = soCanh ? k.rong / soCanh : 0;
      const giu = soCanh > 0 && rongCanh >= 330 && rongCanh <= 620 && spec.khoang.every(kk => kk.rong === 'auto' || kk.rong === '' || kk.rong === undefined || kk.rong === null);
      const t = Ph.tuChoKhung(Core, spec, { ten: spec.ma || spec.ten || 'TU', rong: k.rong, cao, sau: k.sau, mau: '', khau: k.khau, giu_ruot: giu }, spec.phong || '', null, -1);
      spec = t.spec; noi = null; sel = null;
      const d = { goc: [k.goc[0], k.goc[1], z], xoay: k.xoay, tuong: 'hình vẽ' };
      const nguonCu = hoiTruoc && khungCho && khungCho.hinh ? khungCho.hinh.nguon : undefined;      // "Chọn lại mặt trước" của tủ đặt bằng chuột: vẫn là đặt theo điểm bấm
      khungCho = { j: -1, d, hinh: { k, h, nguon: nguonCu } };
      renderAll(); switchTab('tu');
      const ua = $('[data-ui="useAt"]');
      if (ua) { ua.checked = true; ['ax', 'ay', 'az'].forEach((n, i) => { $(`[data-ui="${n}"]`).value = fmt(d.goc[i]); }); }
      capHinh();
      setStatus(`Đã lấy hình: rộng ${hien(k.rong)} × sâu ${hien(k.sau)}, cao ${hien(cao)}${theoTran ? ' (theo trần — tủ thấp hơn thì sửa ô Cao)' : ''}, xoay ${hien(k.xoay)}°. ${k.ghi_chu.concat(t.ghi_chu).join(' ')}${model && model.errors.length ? ' Tủ còn lỗi (ô đỏ) — sửa rồi bấm Vẽ.' : ' Chỉnh khoang / đợt rồi bấm “Vẽ vào Chenfeng”.'}`);
    }

    /* ---- bản 1.17: ĐẶT TỦ BẰNG CHUỘT (anh Jason 03/10/2026 23:13 "vẽ hình chữ nhật chọn rất khó"; 23:18 "chọn từ extension rồi nhập kích thước kéo vào") ----
     * Bấm điểm đầu ở chân tường → rê chuột dọc tường (bóng mờ của tủ chạy theo) → bấm điểm cuối / gõ bề rộng + Enter / Enter = bề rộng đang gõ trong bảng.
     * Lưng tủ áp mặt tường đi qua điểm đầu, mặt trước quay ra phòng; không có tường thì hỏi thêm 1 điểm phía trước. Cột của phòng nằm trong đoạn đó → tự khấu.
     * Sâu, cao lấy theo tủ đang mở trong bảng. Đặt xong: giữ chỗ ở `khungCho` như "tủ theo hình"; ô "vẽ ngay" bật thì vẽ luôn. */
    /** Hỏi CHỖ ĐẶT bằng chuột — dùng chung cho tủ của bảng (bản 1.17) và mẫu kho (bản 1.19): điểm đầu ở chân tường → rê dọc tường (bóng mờ chạy theo) → điểm cuối / gõ rộng / Enter.
     *  kt = { rong, sau, cao, vat: 'tủ' | 'mẫu' }. Trả về { k (kết quả hinhThanhKhung: rong, sau, goc, xoay, khau…), h, z, cao, haCao } hoặc null (đã huỷ / không đặt được — lý do đã ghi ở dòng trạng thái). */
    async function hoiChoDat(kt) {
      const sau = kt.sau, rongBang = kt.rong, vat = kt.vat || 'tủ';
      let ph = { tuong: [], cot: [] };
      try { ph = Drv.tuongPhong(); } catch (e) { ph = { tuong: [], cot: [] }; }
      const an = !panel.hidden; panel.hidden = true; chip.hidden = false;
      const dong = () => { try { Drv.bongMo(null); } catch (e) { /* bỏ qua */ } chip.hidden = true; if (an) panel.hidden = false; };
      chip.textContent = `Bấm điểm ĐẦU của ${vat} ở chân tường… (Esc = thôi)`;
      let r1 = null; try { r1 = await Drv.hoiDiem2(`Một Nhà: bấm điểm ĐẦU của ${vat} (chân tường):`); } catch (e) { r1 = null; }
      if (!r1 || !r1.diem) { dong(); setStatus(`Đã huỷ — chưa đặt ${vat}.`); return null; }
      const p1 = r1.diem, p12 = [p1[0], p1[1]];
      // sàn: lấy cao độ chân của mặt tường đi qua điểm đầu (bấm bắt vào đỉnh tường trên trần thì điểm vẫn về sàn); không có tường thì theo điểm bấm
      const ganTuong = ph.tuong.filter(w => { const dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1], L = Math.hypot(dx, dy) || 1, t = ((p1[0] - w.a[0]) * dx + (p1[1] - w.a[1]) * dy) / L; return t > -30 && t < L + 30 && Math.abs(-(p1[0] - w.a[0]) * dy + (p1[1] - w.a[1]) * dx) / L <= 30; });
      const z = ganTuong.length ? (ganTuong[0].z || 0) : p1[2];
      const tuong = ph.tuong.filter(w => Math.abs((w.z || 0) - z) < 1 || !w.z), cot = ph.cot.filter(c => c.z1 > z + 1);
      const tinh = (c, rong, truoc) => {
        let h = Ph.haiDiemThanhHinh(p12, [c[0], c[1]], sau, { tuong, rong, truoc });
        if (!h.ok && h.can_diem && !truoc) { const h2 = Ph.haiDiemThanhHinh(p12, [c[0], c[1]], sau, { tuong, rong, truoc: [p1[0] - (c[1] - p1[1]), p1[1] + (c[0] - p1[0])] }); if (h2.ok) { h2.tam = true; return h2; } }
        return h;
      };
      const caoXem = Math.max(100, Number(kt.cao) || 2400);
      const netHop = (d, kieu) => {
        const P = zz => d.map(q => [q[0], q[1], zz]), day = P(z), noc = P(z + caoXem), net = [{ diem: day.concat([day[0]]), kieu }, { diem: noc.concat([noc[0]]), kieu }];
        day.forEach((q, i) => net.push({ diem: [q, noc[i]], kieu }));
        if (kieu === 'lien') net.push({ diem: [day[3], day[2]], kieu: 'truoc' }, { diem: [noc[3], noc[2]], kieu: 'truoc' });      // cạnh màu cam = mặt TRƯỚC (cánh)
        return net;
      };
      const khiRe = c => {
        const hB = tinh(c, 0), hE = tinh(c, rongBang), net = [];
        if (hB.ok) net.push(...netHop(hB.dinh, 'lien'));
        if (hE.ok) net.push(...netHop(hE.dinh, hB.ok ? 'dut' : 'lien'));
        Drv.bongMo(net.length ? net : [{ diem: [p1, c], kieu: 'dut' }], hB.ok ? `bấm: rộng ${hien(hB.rong)} · Enter: rộng ${hien(rongBang)} · sâu ${hien(sau)}${hB.tam ? ' · chưa rõ phía trước — sẽ hỏi' : ''}` : `Enter: rộng ${hien(rongBang)} · sâu ${hien(sau)} — hoặc rê tiếp rồi bấm điểm cuối`);
      };
      chip.textContent = `Rê chuột dọc tường: bấm điểm CUỐI · gõ bề rộng + Enter · Enter = rộng ${hien(rongBang)} ${vat === 'tủ' ? 'đang gõ trong bảng' : 'ở ô Rộng'}`;
      let r2 = null; try { r2 = await Drv.hoiDiem2(`Một Nhà: điểm CUỐI / gõ rộng / Enter = rộng ${fmt(rongBang)}:`, { goc: p1, cho_enter: true, khi_re: khiRe }); } catch (e) { r2 = null; }
      try { Drv.bongMo(null); } catch (e) { /* bỏ qua */ }
      if (!r2) { dong(); setStatus(`Đã huỷ — chưa đặt ${vat}.`); return null; }
      let rong = 0, c2 = null;
      if (r2.enter) { rong = rongBang; c2 = r2.chuot; }
      else if (r2.go_so) { rong = r2.go_so; c2 = r2.chuot || r2.diem; }
      else c2 = r2.diem;
      if (!c2) { dong(); setStatus(`Chưa rõ ${vat} chạy về phía nào — bấm lại nút, bấm điểm đầu rồi rê chuột dọc tường trước khi Enter.`); return null; }
      let h = Ph.haiDiemThanhHinh(p12, [c2[0], c2[1]], sau, { tuong, rong });
      if (!h.ok && h.can_diem) {
        chip.textContent = 'Bấm 1 điểm ở phía TRƯỚC tủ (phía đứng mở cánh)…';
        let p3 = null; try { p3 = await Drv.hoiDiem('Một Nhà: bấm 1 điểm ở phía TRƯỚC tủ (phía đứng mở cánh):'); } catch (e) { p3 = null; }
        if (!p3) { dong(); setStatus(`Đã huỷ — chưa đặt ${vat}.`); return null; }
        h = Ph.haiDiemThanhHinh(p12, [c2[0], c2[1]], sau, { tuong, rong, truoc: [p3[0], p3[1]] });
      }
      if (!h.ok) { dong(); setStatus(h.loi); return null; }
      const k = Ph.hinhThanhKhung(h.dinh, { tuong, cot, truoc: h.truoc });
      if (!k.ok) { dong(); setStatus(k.loi); return null; }
      k.mat_truoc = h.mat_truoc || k.mat_truoc;
      // cao: giữ số đang gõ trong bảng; cao hơn trần của tường phía sau thì hạ xuống bằng trần
      let cao = Number(kt.cao) || 2400, haCao = false;
      const tran = h.bam_tuong && ganTuong.length ? Math.max(...ganTuong.map(w => w.cao || 0)) : 0;
      if (tran > 0 && cao > tran + 0.5) { cao = tran; haCao = true; }
      dong();
      return { k, h, z, cao, haCao };
    }
    async function datBangChuot() {
      if (!Drv || busy || !Ph || !Ph.haiDiemThanhHinh || typeof Drv.hoiDiem2 !== 'function') return;
      if (!Drv.available()) { setStatus('Không thấy bản vẽ Chenfeng trong trang này.'); return; }
      const bb = model && model.parts.length ? Core.bbox(model.parts) : null;
      const sau = bb ? Math.round((bb.y1 - bb.y0) * 10) / 10 : (Number(spec.sau_thung) || 580) + 20, rongBang = Number(spec.rong) || 0;
      if (!(sau >= 100 && rongBang >= 200)) { setStatus('Gõ rộng / sâu của tủ ở thẻ Tủ trước đã.'); return; }
      const cho = await hoiChoDat({ rong: rongBang, sau, cao: Number(spec.cao) || 2400 });
      if (!cho) return;
      const { k, h, z, cao, haCao } = cho;
      const coKhau = k.khau.trai.rong > 0 || k.khau.phai.rong > 0 || k.khau.giua_cot.length > 0;
      const ghi = [];
      if (Math.abs(k.rong - rongBang) > 0.05 || coKhau || haCao) {
        const soCanh = spec.khoang.reduce((n, kk) => n + (kk.canh || 0), 0), rongCanh = soCanh ? k.rong / soCanh : 0;
        const giu = soCanh > 0 && rongCanh >= 330 && rongCanh <= 620 && spec.khoang.every(kk => kk.rong === 'auto' || kk.rong === '' || kk.rong === undefined || kk.rong === null);
        const t = Ph.tuChoKhung(Core, spec, { ten: spec.ma || spec.ten || 'TU', rong: k.rong, cao, sau: k.sau, mau: '', khau: k.khau, giu_ruot: giu }, spec.phong || '', null, -1);
        spec = t.spec; ghi.push(...t.ghi_chu);
      }
      noi = null; sel = null;
      const d = { goc: [k.goc[0], k.goc[1], z], xoay: k.xoay, tuong: 'điểm bấm' };
      khungCho = { j: -1, d, hinh: { k, h: { dinh3: h.dinh.map(q => [q[0], q[1], z]) }, nguon: 'diem' } };
      renderAll(); switchTab('tu');
      const ua = $('[data-ui="useAt"]');
      if (ua) { ua.checked = true; ['ax', 'ay', 'az'].forEach((n, i) => { $(`[data-ui="${n}"]`).value = fmt(d.goc[i]); }); }
      capHinh();
      const tom = `rộng ${hien(k.rong)} × sâu ${hien(k.sau)} × cao ${hien(cao)}${haCao ? ' (hạ theo trần)' : ''}, xoay ${hien(k.xoay)}°${coKhau ? ', có khấu cột' : ''}`;
      const veNgay = $('[data-ui="veNgay"]');
      if (model && !model.errors.length && veNgay && veNgay.checked) { setStatus(`Đã đặt: ${tom}. Đang vẽ…`); return draw(); }
      setStatus(`Đã đặt: ${tom}. ${k.ghi_chu.concat(ghi).join(' ')}${model && model.errors.length ? ' Tủ còn lỗi (ô đỏ) — sửa rồi bấm Vẽ.' : ' Xem lại khoang / đợt rồi bấm “Vẽ vào Chenfeng”.'}`);
    }

    /** Người dùng chọn 1 tấm của tủ đã vẽ → mở lại thông số của tủ đó để sửa. */
    function pick() {
      if (!Drv || busy) return;
      if (!Drv.available()) { setStatus('Không thấy bản vẽ Chenfeng trong trang này.'); return; }
      const chon = Drv.selected();
      if (!chon.length) { setStatus('Trên bản vẽ, bấm chọn 1 tấm của tủ cần sửa (hồi, đợt, cánh…) rồi bấm lại nút “Sửa tủ đang chọn”.'); return; }
      const tam = chon.find(e => Drv.tagOf(e));
      if (!tam) { setStatus('Tấm đang chọn không mang mã tủ của tiện ích (tủ vẽ từ bản trước 1.6, hoặc vẽ tay / từ mẫu Chenfeng). Tủ đó phải xoá rồi vẽ lại một lần bằng bản này thì các lần sau mới sửa tại chỗ được.'); return; }
      const id = Drv.tagOf(tam), luu = khoTu.get(id);
      let specCu = null, nguon = '';
      if (luu && luu.spec) { specCu = Core.normalize(Core.specDaVe(luu.spec, luu.ban)); nguon = 'luu'; }      // tủ vẽ bằng bản < 1.10 là thùng liền
      else {      // máy này không có thông số của tủ đó → thử chính thông số đang mở trong bảng (vd vừa bấm "Mở mẫu" file tủ đó)
        const thu = Drv.locate(id, Core.build(spec), tam);
        if (thu.ok && thu.thieu <= Math.floor(thu.tong * 0.1)) { specCu = clone(spec); nguon = 'bang'; }
      }
      if (!specCu) { setStatus('Tủ này được vẽ ở máy / trình duyệt khác nên máy này không có thông số của nó. Bấm “Mở mẫu” mở file mẫu của tủ (nếu đã lưu) rồi bấm lại “Sửa tủ đang chọn”.'); return; }
      let doiKT = '';
      const theoModule = Drv.specTheoModule && Drv.specTheoModule(specCu, tam);      // tủ là module và đã được đổi Rộng / Sâu / Cao ngay trong Chenfeng
      if (theoModule) { specCu = theoModule; doiKT = ` Kích thước lấy theo module trong Chenfeng: ${hien(specCu.rong)} × ${hien(specCu.cao)}, sâu thùng ${hien(specCu.sau_thung)}.`; }
      const loc = Drv.locate(id, Core.build(specCu), tam);
      if (!loc.ok) { setStatus(loc.reason); return; }
      spec = clone(specCu); noi = { id, spec: clone(specCu), ten: specCu.ma || specCu.ten || '', pick: tam };
      sel = null; renderAll(); switchTab('tu');
      setStatus(`Đã mở thông số của tủ “${noi.ten}” (${loc.boards.length} tấm trên bản vẽ${loc.thieu ? `, thiếu ${loc.thieu} tấm so với lúc vẽ` : ''})${nguon === 'bang' ? ' — lấy theo thông số đang mở vì khớp với tủ' : ''}.${doiKT} Sửa số rồi bấm “Cập nhật tủ này trên bản vẽ”.`);
    }

    /** Bản 1.11 — module chèn từ kho Chenfeng (kết cấu kiểu Trung) → hậu mỏng phủ sau lưng theo chuẩn xưởng. Sửa ngay trên bản vẽ, mẫu trong kho giữ nguyên. */
    async function chuanHoa() {
      if (!Drv || busy) return null;
      if (!Drv.available()) { setStatus('Không thấy bản vẽ Chenfeng trong trang này.'); return null; }
      const chon = Drv.selected().filter(e => Drv.isBoard(e));
      if (!chon.length) { setStatus('Trên bản vẽ, bấm chọn 1 tấm của module lấy từ kho mẫu (hồi, nóc, hậu…) rồi bấm lại nút “Chuẩn hoá mẫu kho đang chọn”.'); return null; }
      busy = true; rebuild();
      let r, dv = null;
      // bản 1.12: mẫu kho vẽ với ván 18 → trước hết đổi tham số dày ván (BH) của module sang ván của xưởng, rồi mới chuyển hậu
      if (typeof Drv.dayVan === 'function' && spec.van.t > 0) {
        try { dv = await Drv.dayVan(chon[0], spec.van.t, { onStatus: setStatus }); } catch (e) { dv = { ok: false, ly_do: String(e && e.message || e) }; }
      }
      try { r = await Drv.chuanHoa((dv && dv.tam) || chon[0], { hau: spec.hau.t || 6, mep: spec.hau.mep, khoan: spec.khoan.thung, onStatus: setStatus }); }
      catch (e) { r = { ok: false, ly_do: String(e && e.message || e) }; }
      busy = false; rebuild();
      const h = [], dvDoi = !!(dv && dv.ok && !dv.da_dung);
      if (dvDoi) h.push(`<div class="msg ok">Dày ván: ${hien(dv.tu)} → ${hien(dv.day)} cho ${dv.doi} tấm (tham số BH của module).${dv.con ? ` Còn ${dv.con} tấm vẫn dày ${hien(dv.tu)} — ${esc(dv.ten_con.slice(0, 6).join(', '))}: tham số của mẫu không nối tới các tấm này (thường là cánh), đổi tay nếu cần.` : ''}</div>`);
      else if (dv && !dv.ok && dv.khong_noi) h.push(`<div class="msg warn">Dày ván chưa đổi: ${esc(dv.ly_do)}</div>`);
      if (r.ok && r.da_chuan) h.push(`<div class="msg ok">${esc((r.ghi_chu || [])[0] || 'Module đã đúng chuẩn.')}</div>`);
      else if (r.ok) {
        h.push(`<div class="msg ok">Đã chuẩn hoá module “${esc(r.module)}”: ${r.so_hau} tấm hậu → ${esc(r.hau.join('; '))} — phủ sau lưng thùng, không khoan.</div>`);
        if (r.sua_mep_sau.length) h.push(`<div class="msg note">Mép sau của ${r.sua_mep_sau.length} tấm đã về đúng chỗ để hậu phủ lên: ${esc(r.sua_mep_sau.join('; '))}.</div>`);
        if (r.xoa_giang) h.push(`<div class="msg note">Đã bỏ ${r.xoa_giang} thanh giằng sau hậu (hậu phủ bắn đinh không cần).</div>`);
        if (r.khoan && r.khoan.fixed) h.push(`<div class="msg note">Kiểu khoan cũ của mẫu (${esc((r.khoan.old || []).join(', '))}) đã đổi sang ${esc(r.khoan.to)} cho ${r.khoan.fixed} tấm; Chenfeng đã khoan lại.</div>`);
        h.push(`<div class="msg note mod">Module vẫn là module tham số: đổi Rộng / Sâu / Cao ở ô <b>Thông số</b> của Chenfeng thì hậu vẫn phủ kín${r.hau_tu_dong ? '' : ` (${r.dong_tac} động tác tham số của mẫu đã được tính lại)`}. Mẫu trong kho không bị sửa — lần sau chèn lại thì chuẩn hoá lại.</div>`);
      } else h.push(`<div class="msg err">Chưa chuẩn hoá được: ${esc(r.ly_do || '')}</div>`);
      (r.ghi_chu || []).slice(r.da_chuan ? 1 : 0).forEach(t => h.push(`<div class="msg warn">${esc(t)}</div>`));
      if (r.ok && !r.da_chuan) h.push(`<div class="frow" style="margin-top:10px"><button class="sec" data-act="undo-ch"${dvDoi ? ' data-dv="1"' : ''}>Hoàn tác lần chuẩn hoá này</button><button class="sec" data-act="zoom">Xem toàn bộ</button></div>`);
      else if (dvDoi) h.push(`<div class="frow" style="margin-top:10px"><button class="sec" data-act="undo-dv">Trả dày ván về ${hien(dv.tu)}</button><button class="sec" data-act="zoom">Xem toàn bộ</button></div>`);
      $('.report').innerHTML = h.join(''); lastRep = null;
      switchTab('kq');
      setStatus(r.ok ? (r.da_chuan ? 'Module này đã đúng chuẩn hậu phủ sau.' : `Đã chuẩn hoá module “${r.module}”.`) : (dvDoi ? `Đã đổi dày ván sang ${hien(dv.day)}; hậu chưa chuyển được — xem thẻ Kết quả.` : 'Chưa chuẩn hoá được — xem thẻ Kết quả.'));
      r.day_van = dv;
      return r;
    }

    /* ================= PHÒNG HIỆN TRẠNG (bản 1.8) ================= */
    // Phòng do người dùng tự điền số đo; lưu trong trình duyệt của máy này (khoá mncf.phong.v1). Ảnh hiện trạng chỉ để nhìn mà điền, lưu trong IndexedDB của máy này.
    let phong = null, hinh = null, selTuong = 0, selKhung = -1, anh = [], xemId = null;
    const gocKhac = new Set();      // tường đang gõ góc rẽ bằng số (khác ±90)
    const phongStore = {
      load() { try { const t = root.localStorage.getItem(LS_PHONG); return t ? Ph.docMa(t) : null; } catch (e) { return null; } },
      save() { try { root.localStorage.setItem(LS_PHONG, JSON.stringify(Ph.chuanHoa(phong))); } catch (e) { /* không lưu được thì thôi */ } },
    };
    const khoAnh = (() => {
      let dbp = null;
      const mo = () => dbp || (dbp = new Promise((res, rej) => { try { const r = root.indexedDB.open('mncf_phong', 1); r.onupgradeneeded = () => { r.result.createObjectStore('anh', { keyPath: 'id', autoIncrement: true }); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }));
      const tx = (mode, fn) => mo().then(db => new Promise((res, rej) => { const t = db.transaction('anh', mode), q = fn(t.objectStore('anh')); t.oncomplete = () => res(q && q.result); t.onerror = t.onabort = () => rej(t.error); }));
      return { tat: () => tx('readonly', st => st.getAll()), them: o => tx('readwrite', st => st.add(o)), xoa: id => tx('readwrite', st => st.delete(id)) };
    })();

    const pf = (path, label, extra) => { const v = getP(phong, path); return `<label>${esc(label)}<input type="text" inputmode="decimal" data-p="${path}" value="${esc(v === 'auto' ? '' : fmt(v))}" ${extra || ''}></label>`; };
    const pt = (path, label, extra) => `<label>${esc(label)}<input type="text" data-text="1" data-p="${path}" value="${esc(getP(phong, path))}" ${extra || ''}></label>`;
    const psel = (path, label, opts, cur) => `<label>${esc(label)}<select data-p="${path}">${opts.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
    const dsTuong = () => phong.tuong.map((t, i) => [i, t.ten]);
    function renderPhong() {
      if (!Ph) return;
      phong = Ph.chuanHoa(phong); if (!phong.goc) phong.goc = [0, 0, 0];
      const P = phong, h = [];
      h.push(`<fieldset><legend>Phòng</legend><div class="g g3">${pt('ten', 'Tên phòng')}${pf('cao', 'Cao trần (sàn → trần)')}${pf('day', 'Dày tường', 'title="Bề dày tường khi vẽ vào Chenfeng — nằm ngoài lòng phòng, không ảnh hưởng số đo lọt lòng"')}</div></fieldset>`);
      h.push(`<fieldset><legend>Tường — theo chiều kim đồng hồ</legend>${P.tuong.map((t, i) => {
        const le = gocKhac.has(i) || (t.re !== 90 && t.re !== -90);
        return `<div class="prow" data-ti="${i}">${pt(`tuong.${i}.ten`, 'Tên')}${pf(`tuong.${i}.dai`, 'Dài', 'placeholder="tự tính"')}${le ? pf(`tuong.${i}.re`, 'Cuối tường rẽ phải (độ)', 'title="90 = góc phòng bình thường; số âm = rẽ trái (góc lồi)"') : psel(`tuong.${i}.re`, 'Cuối tường rẽ', [[90, 'phải 90° (góc phòng)'], [-90, 'trái 90° (góc lồi)'], ['khac', 'góc khác…']], t.re)}<button class="x" data-act="t-del" title="Bỏ tường ${esc(t.ten)}" aria-label="Bỏ tường ${esc(t.ten)}">✕</button></div>`;
      }).join('')}<div class="frow"><button class="sec" data-act="t-add">+ Thêm tường</button></div><p class="hint" style="margin:6px 0 0">Để trống chiều dài <b>một</b> tường thì bảng tự tính cho phòng khép kín. Góc lồi (cột, hộp kỹ thuật nhô ra thành hình chữ L) = rẽ trái.</p></fieldset>`);
      h.push(`<fieldset><legend>Cửa, cửa sổ, ô trống</legend>${P.mo.map((m, j) => `<div class="pcard" data-mj="${j}"><div class="ph"><b>${esc(Ph.LOAI_MO[m.loai])} ${j + 1}</b><button class="x" data-act="m-del" title="Bỏ" aria-label="Bỏ ${esc(Ph.LOAI_MO[m.loai])} ${j + 1}">✕</button></div>
<div class="g g2">${psel(`mo.${j}.tuong`, 'Tường', dsTuong(), m.tuong)}${psel(`mo.${j}.loai`, 'Loại', Object.keys(Ph.LOAI_MO).map(k => [k, Ph.LOAI_MO[k]]), m.loai)}</div>
<div class="g g4">${pf(`mo.${j}.cach`, 'Cách trái')}${pf(`mo.${j}.rong`, 'Rộng')}${pf(`mo.${j}.cao`, 'Cao')}${pf(`mo.${j}.be`, 'Bệ (từ sàn)')}</div></div>`).join('')}<div class="frow"><button class="sec" data-act="m-add">+ Thêm cửa / ô trống</button></div></fieldset>`);
      h.push(`<fieldset><legend>Dầm, cột, hộp kỹ thuật</legend>${P.can.map((c, j) => `<div class="pcard" data-cj="${j}"><div class="ph"><b>${esc(Ph.LOAI_CAN[c.loai])} ${j + 1}</b><button class="x" data-act="c-del" title="Bỏ" aria-label="Bỏ ${esc(Ph.LOAI_CAN[c.loai])} ${j + 1}">✕</button></div>
<div class="g g2">${psel(`can.${j}.tuong`, 'Tường', dsTuong(), c.tuong)}${psel(`can.${j}.loai`, 'Loại', Object.keys(Ph.LOAI_CAN).map(k => [k, Ph.LOAI_CAN[k]]), c.loai)}</div>
<div class="g g3">${pf(`can.${j}.cach`, 'Cách trái')}${pf(`can.${j}.rong`, 'Rộng (dọc tường)')}${pf(`can.${j}.nho`, 'Nhô vào phòng')}</div>
<div class="g g2">${pf(`can.${j}.z0`, 'Từ cao độ (đáy dầm)')}${pf(`can.${j}.z1`, 'Đến cao độ')}</div></div>`).join('')}<div class="frow"><button class="sec" data-act="c-add" data-v="cot">+ Cột</button><button class="sec" data-act="c-add" data-v="dam">+ Dầm</button><button class="sec" data-act="c-add" data-v="hop">+ Hộp kỹ thuật</button></div></fieldset>`);
      // ĐIỆN – NƯỚC (bản 1.18): mỗi điểm một dòng; hai nhóm (trên tường / dưới sàn) vì cột số thứ tư khác nghĩa. Dòng "Điểm khác" có thêm tên + cỡ ô.
      if (Ph.LOAI_DN) {
        const LD = Ph.LOAI_DN, loaiCua = san => Object.keys(LD).filter(k => !!LD[k].san === san).map(k => [k, LD[k].ten]);
        const dong = (d, j) => { const L = LD[d.loai];
          return `<div class="drow" data-dj="${j}">${psel(`dn.${j}.loai`, 'Loại', loaiCua(!!L.san), d.loai)}${psel(`dn.${j}.tuong`, 'Tường', dsTuong(), d.tuong)}${pf(`dn.${j}.cach`, 'Cách trái', 'title="Từ đầu trái của tường (đứng trong phòng nhìn vào tường) tới TÂM điểm"')}${L.san ? pf(`dn.${j}.ra`, 'Cách tường', 'title="Từ mặt tường ra tới TÂM điểm trên sàn"') : pf(`dn.${j}.cao`, 'Cao tâm', 'title="Từ sàn lên tới TÂM điểm"')}<button class="x" data-act="d-del" title="Bỏ điểm này" aria-label="Bỏ ${esc(L.ten)} trên tường ${esc((P.tuong[d.tuong] || {}).ten || '')}">✕</button>${d.loai === 'khac' ? `<div class="dkhac">${pt(`dn.${j}.ghi`, 'Tên (vd tủ điện, ổ mạng, ống gas)')}${pf(`dn.${j}.rong`, 'Rộng ô', `placeholder="${L.rong}"`)}${pf(`dn.${j}.cao_o`, 'Cao ô', `placeholder="${L.cao_o}"`)}</div>` : ''}</div>`; };
        const nhom = san => P.dn.map((d, j) => (!!LD[d.loai].san === san ? dong(d, j) : '')).join('');
        h.push(`<fieldset><legend>Điện – nước (ổ điện, công tắc, cấp – thoát nước)</legend><div class="dnhom">${nhom(false)}</div><div class="dnhom">${nhom(true)}</div>
<div class="frow">${Object.keys(LD).map(k => `<button class="sec" data-act="d-add" data-v="${k}">+ ${esc(LD[k].ten)}</button>`).join('')}</div>
<p class="hint" style="margin:6px 0 0">Điểm mới nằm trên <b>tường đang chọn</b>. Số đo tới <b>tâm</b> điểm: “cách trái” từ đầu trái tường, “cao tâm” từ sàn; thoát sàn / ống chờ sàn thì “cách tường” từ mặt tường ra. Khung đặt tủ che điểm nào thì bảng báo ngay dưới mặt bằng; mở khung thành tủ sẽ thấy điểm rơi vào khoang nào, khoét tấm nào.</p></fieldset>`);
      }
      const dsMau = [['', 'Tự chọn theo bề rộng']].concat(Core.MAU_TU.map(m => [m.ma, m.ten]));
      // bản 1.19: mỗi khung chọn ĐẶT GÌ — tủ tự chia khoang (thẻ Tủ) hoặc một mẫu của kho Chenfeng; chia khung thành các ô cạnh nhau / chồng lên nhau (vách tivi, đầu giường)
      const dsKieu = [['tu', 'Tủ tự chia khoang (thẻ Tủ)'], ['kho', 'Mẫu kho Chenfeng']];
      const theKho = k => { const m = k.kho; return `<div class="kkho">${m ? `${m.hinh ? `<img src="${esc(m.hinh)}" alt="">` : ''}<div><b>${esc(m.ten)}</b>${m.kt ? `<br><span class="hint" style="margin:0">kích thước mặc định ${m.kt.map(hien).join(' × ')} → vẽ theo khung</span>` : ''}</div>` : `<span class="hint" style="margin:0">Chưa chọn mẫu — ${coKho ? 'bấm “Chọn mẫu kho…”.' : 'mở bảng này trong Chenfeng để chọn mẫu của kho.'}</span>`}</div>`; };
      h.push(`<fieldset><legend>Khung không gian (chỗ đặt tủ / mẫu kho)</legend>${P.khung.map((k, j) => { const laKho = k.kieu === 'kho'; return `<div class="pcard${j === selKhung ? ' on' : ''}" data-kj="${j}"><div class="ph"><b>Khung ${esc(k.ten)}</b><button class="x" data-act="k-del" title="Bỏ khung" aria-label="Bỏ khung ${esc(k.ten)}">✕</button></div>
<div class="g g3">${pt(`khung.${j}.ten`, 'Tên (= mã tủ)')}${psel(`khung.${j}.tuong`, 'Tường', dsTuong(), k.tuong)}${pf(`khung.${j}.cach`, 'Cách trái')}</div>
<div class="g g4">${pf(`khung.${j}.rong`, 'Rộng')}${pf(`khung.${j}.cao`, 'Cao')}${pf(`khung.${j}.sau`, 'Sâu (cả cánh)')}${pf(`khung.${j}.z`, 'Đáy (từ sàn)')}</div>
<div class="g g2">${psel(`khung.${j}.kieu`, 'Đặt gì vào khung', dsKieu, laKho ? 'kho' : 'tu')}${laKho ? '' : psel(`khung.${j}.mau`, 'Ruột tủ', dsMau, k.mau)}</div>
${laKho ? theKho(k) : ''}<div class="kinfo"></div>
<div class="frow">${laKho ? (coKho ? '<button class="sec" data-act="k-kho" title="Mở thẻ Kho mẫu để chọn một mẫu trong kho Chenfeng của tài khoản cho khung này">Chọn mẫu kho…</button><button class="sec" data-act="k-ve-kho" title="Dựng mẫu kho đã chọn đúng kích thước khung (rộng × sâu × cao) rồi đặt vào đúng vị trí khung, quay lưng vào tường">Vẽ mẫu vào khung</button>' : '') : `<button class="sec" data-act="k-mo" title="Mở khung này thành tủ ở tab Tủ (kích thước phủ bì = khung) để chia đợt, đặt ngăn kéo">Mở thành tủ</button>${inCF ? '<button class="sec" data-act="k-ve" title="Dựng tủ vừa khung rồi vẽ vào Chenfeng tại đúng vị trí khung">Vẽ tủ vào khung</button>' : ''}`}</div>
<div class="kchia">Chia khung thành <select data-ui="k-chia-n" aria-label="Số ô khi chia khung ${esc(k.ten)}">${[2, 3, 4, 5, 6].map(n => `<option>${n}</option>`).join('')}</select> ô <button class="sec mini" data-act="k-chia" data-v="doc" title="Thay khung này bằng các ô bằng nhau đứng CẠNH NHAU dọc theo tường (trái → phải). Sau đó bấm vào số của từng ô trên mặt đứng để chỉnh — ô kề tự nhận phần bù.">cạnh nhau ▯▯</button><button class="sec mini" data-act="k-chia" data-v="ngang" title="Thay khung này bằng các ô bằng nhau CHỒNG LÊN NHAU (dưới → trên): vd kệ tivi phía dưới + tủ treo phía trên.">chồng lên nhau ▭</button></div></div>`; }).join('')}<div class="frow"><button class="sec" data-act="k-add">+ Thêm khung ở tường đang chọn</button></div></fieldset>`);
      h.push(`<fieldset><legend>Điểm đặt phòng trong bản vẽ</legend><div class="g g3">${pf('goc.0', 'x đầu trái tường ' + (P.tuong[0] ? P.tuong[0].ten : 'A'))}${pf('goc.1', 'y')}${pf('goc.2', 'z (sàn)')}</div><p class="hint" style="margin:6px 0 0">Toạ độ trong bản vẽ Chenfeng của đầu trái tường đầu tiên, ở cao độ sàn. Vị trí các tủ tính theo điểm này.</p></fieldset>`);
      $('.pform').innerHTML = h.join('');
      paintPhong();
    }
    function paintPhong() {
      if (!Ph || !phong) return;
      hinh = Ph.hinhHoc(phong);
      const n = hinh.tuong.length;
      selTuong = clamp(selTuong, 0, Math.max(0, n - 1)); if (selKhung >= hinh.p.khung.length) selKhung = -1;
      const pv = $('.pview'), w = pv.clientWidth - 14, rong = w > 120 ? w : (inCF ? 410 : 560);
      dongSuaDim();
      $('.pmb').innerHTML = Ph.matBangSVG(hinh, { rong_px: rong, cao_px: 400, chon_tuong: selTuong, chon_khung: selKhung, sua: true });
      $('.pmd').innerHTML = Ph.matDungSVG(hinh, selTuong, { rong_px: rong, cao_px: 340, chon_khung: selKhung, sua: true });
      $('.pmsgs').innerHTML = hinh.loi.map(t => `<div class="msg err">${esc(t)}</div>`).concat(hinh.luu_y.map(t => `<div class="msg warn">${esc(t)}</div>`), (hinh.ghi_chu || []).map(t => `<div class="msg note">${esc(t)}</div>`)).join('');
      $('.psum').innerHTML = Ph.tomTat(hinh).map(t => `<li>${esc(t)}</li>`).join('');
      // tường tự tính: ghi số tính được vào chữ mờ của ô
      $$('.prow').forEach(r => { const i = +r.dataset.ti, inp = r.querySelector(`[data-p="tuong.${i}.dai"]`), tw = hinh.tuong[i]; if (inp && tw) inp.placeholder = tw.tu_tinh && tw.dai > 0 ? 'tự tính: ' + hien(tw.dai) : 'tự tính'; });
      $$('.pcard[data-kj]').forEach(c => {
        const j = +c.dataset.kj, d = Ph.datKhung(hinh, j), q = hinh.p.khung[j];
        c.classList.toggle('on', j === selKhung);
        const info = c.querySelector('.kinfo');
        if (info) info.textContent = d ? `Tường ${d.tuong} · góc trái–trước–dưới của tủ tại ${d.goc.map(hien).join('; ')}${d.xoay ? ` · xoay ${hien(d.xoay)}°` : ''}${q && q.tu_id ? ' · đã vẽ' : ''}` : '';
        const ve = c.querySelector('[data-act="k-ve"]'); if (ve) ve.disabled = busy || hinh.loi.length > 0;
        const vk = c.querySelector('[data-act="k-ve-kho"]'); if (vk) vk.disabled = busy || hinh.loi.length > 0 || !(q && q.kho);
        const ck = c.querySelector('[data-act="k-kho"]'); if (ck) ck.disabled = busy;
      });
      const vp = $('[data-act="p-ve"]'); if (vp) vp.disabled = busy || hinh.loi.length > 0;
    }
    /** Bản 1.12 — gõ số đo ngay trên hình: bấm vào số đo của mặt bằng / mặt đứng → ô nhập hiện đúng chỗ đó; Enter ghi, Esc bỏ. */
    let oSua = null;
    function dongSuaDim() { if (oSua) { const o = oSua; oSua = null; try { o.remove(); } catch (e) { /* đã gỡ */ } } }
    function suaDim(el) {
      if (!phong || !el) return;
      const path = el.dataset.sua, ks = path.split('.'); let host = el.closest('.pmb,.pmd'); if (!host) return;
      dongSuaDim();
      // tường của số đo đang sửa sáng lên trên mặt bằng, mặt đứng đổi sang tường đó (vẽ lại xong mới đặt ô nhập)
      const tw = ks[0] === 'tuong' ? +ks[1] : ((ks[0] === 'mo' || ks[0] === 'can' || ks[0] === 'dn' || ks[0] === 'khung') && phong[ks[0]][+ks[1]] ? phong[ks[0]][+ks[1]].tuong : selTuong);
      if (ks[0] === 'khung') selKhung = +ks[1];
      if (tw !== selTuong && host.classList.contains('pmb')) { selTuong = tw; paintPhong(); el = $(`.pmb [data-sua="${path}"]`); if (!el) return; host = el.closest('.pmb'); }
      const khung = host.parentElement, r = el.getBoundingClientRect(), kr = khung.getBoundingClientRect();
      khung.style.position = 'relative';
      const cu = getP(phong, path), laDai = ks[0] === 'tuong' && ks[2] === 'dai';
      const inp = document.createElement('input');
      inp.type = 'text'; inp.inputMode = 'decimal'; inp.className = 'pdim'; inp.setAttribute('aria-label', 'Sửa số đo'); inp.id = 'mncf-ui-pdim';
      inp.value = cu === 'auto' || cu === undefined || cu === null ? '' : fmt(cu);
      if (laDai) inp.placeholder = 'tự tính';
      const rong = 96;
      inp.style.left = Math.max(2, Math.min(kr.width - rong - 2, r.left - kr.left + r.width / 2 - rong / 2)) + 'px';
      inp.style.top = Math.max(2, r.top - kr.top + r.height / 2 - 15) + 'px';
      inp.style.width = rong + 'px';
      khung.appendChild(inp); oSua = inp;
      let xong = false;
      const ghi = () => {
        if (xong) return; xong = true;
        const t = String(inp.value).trim().replace(',', '.');
        let v;
        if (t === '') { if (!laDai) return dongSuaDim(); v = 'auto'; }
        else { v = Number(t); if (!isFinite(v) || v < 0) { dongSuaDim(); return setStatus('Số đo không hợp lệ — giữ số cũ.'); } }
        dongSuaDim();
        if (v === cu) return;
        if (laDai && v === 'auto') phong.tuong.forEach((w, i) => { if (i !== +ks[1] && w.dai === 'auto') { const tw = hinh && hinh.tuong[i]; w.dai = tw && tw.dai > 0 ? tw.dai : 0; } });      // chỉ một tường tự tính: tường tự tính cũ nhận số đang hiển thị
        // bản 1.19 — sửa RỘNG / CAO của một ô trên mặt đứng: ô kề (chạm mép, cùng hàng / cùng cột) nhận phần bù, tổng không đổi (không hở, không chồng)
        if (ks[0] === 'khung' && (ks[2] === 'rong' || ks[2] === 'cao') && Ph.doiCoKhung) {
          const r = Ph.doiCoKhung(phong, +ks[1], ks[2], v);
          if (!r || r.loi) return setStatus(r && r.loi ? r.loi : 'Số đo không hợp lệ — giữ số cũ.');
          const tenK = phong.khung[+ks[1]].ten;
          phong = r.p; phongStore.save(); renderPhong();
          return setStatus(`Khung ${tenK}: ${ks[2] === 'rong' ? 'rộng' : 'cao'} ${hien(v)}${r.ke ? ` — ô kề ${r.ke} nhận phần bù` : ''}.`);
        }
        setP(phong, path, v); phongStore.save(); renderPhong();
        const tenO = ks[0] === 'khung' ? `khung ${phong.khung[+ks[1]] ? phong.khung[+ks[1]].ten : ''} (${ks[2] === 'sau' ? 'sâu' : ks[2] === 'cach' ? 'cách trái' : ks[2] === 'z' ? 'đáy từ sàn' : ks[2]})` : laDai ? `tường ${phong.tuong[+ks[1]].ten}` : ks[0] === 'mo' ? (ks[2] === 'cach' ? 'khoảng cách tới cửa' : 'rộng cửa') : ks[0] === 'can' ? 'cột / hộp / dầm' : ks[0] === 'dn' ? (ks[2] === 'cach' ? 'cách trái của điểm điện – nước' : ks[2] === 'ra' ? 'khoảng cách từ tường của điểm dưới sàn' : 'cao độ điểm điện – nước') : 'chiều cao';
        setStatus(`Đã sửa ${tenO}: ${v === 'auto' ? 'tự tính' : hien(v)}.`);
      };
      inp.addEventListener('keydown', safe(e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); ghi(); } else if (e.key === 'Escape') { e.preventDefault(); xong = true; dongSuaDim(); } }));
      inp.addEventListener('blur', safe(() => ghi()));
      inp.focus(); inp.select();
    }
    let tmrP = 0; const laterPhong = () => { clearTimeout(tmrP); tmrP = setTimeout(safe(() => { phongStore.save(); paintPhong(); }), 160); };
    function phongInput(t) {
      const path = t.dataset.p, ks = path.split('.'); let v = t.value;
      if (ks[0] === 'tuong' && ks[2] === 're' && v === 'khac') { gocKhac.add(+ks[1]); renderPhong(); const inp = $(`[data-p="${path}"]`); if (inp) { inp.focus(); inp.select(); } return; }
      if (ks[0] === 'tuong' && ks[2] === 'dai' && String(v).trim() === '') v = 'auto';
      if (ks[0] === 'goc' && !Array.isArray(phong.goc)) phong.goc = [0, 0, 0];
      if (ks[2] === 'tuong' || ks[0] === 'goc') v = parseFloat(String(v).replace(',', '.')) || 0;
      if (ks[0] === 'dn' && ks[2] === 'loai' && Ph.LOAI_DN && Ph.LOAI_DN[v] && phong.dn[+ks[1]]) {
        const d = phong.dn[+ks[1]], cu = Ph.LOAI_DN[d.loai] || {}, moi = Ph.LOAI_DN[v];
        delete d.rong; delete d.cao_o; if (v !== 'khac') delete d.ghi;
        if (!moi.san && (d.cao === undefined || Number(d.cao) === cu.cao)) d.cao = moi.cao;      // cao độ còn là số điền sẵn của loại cũ → theo loại mới; đã gõ số riêng thì giữ
        if (moi.san && (d.ra === undefined || Number(d.ra) === cu.ra)) d.ra = moi.ra;
      }
      setP(phong, path, v);
      if (t.tagName === 'SELECT') { if (ks[0] === 'khung' && ks[2] === 'tuong') { selKhung = +ks[1]; selTuong = v; } phongStore.save(); renderPhong(); }      // đổi tường / loại: tên thẻ, hình đổi theo
      else laterPhong();
    }
    const boKhoi = (ds, i) => ds.filter(x => x.tuong !== i).map(x => (x.tuong > i ? Object.assign(x, { tuong: x.tuong - 1 }) : x));
    function phongAct(act, b) {
      phong = Ph.chuanHoa(phong);
      const H = Ph.hinhHoc(phong), tw = H.tuong[selTuong];
      if (act === 't-add') {
        const moi = { ten: '', dai: 3000, re: 90 }, k = phong.tuong.findIndex(t => t.dai === 'auto');
        if (k >= 0 && k === phong.tuong.length - 1) phong.tuong.splice(k, 0, moi); else phong.tuong.push(moi);      // tường tự tính luôn nằm cuối
        phong.tuong.forEach((t, i) => { if (!t.ten || phong.tuong.filter(x => x.ten === t.ten).length > 1) t.ten = Ph.tenTuong(i); });
        gocKhac.clear();
      } else if (act === 't-del') {
        const i = +b.closest('.prow').dataset.ti;
        if (phong.tuong.length <= 1) return setStatus('Phải giữ lại ít nhất một tường.');
        const mat = phong.mo.concat(phong.can, phong.khung, phong.dn).filter(x => x.tuong === i).length, ten = phong.tuong[i].ten;
        phong.tuong.splice(i, 1); phong.mo = boKhoi(phong.mo, i); phong.can = boKhoi(phong.can, i); phong.khung = boKhoi(phong.khung, i); phong.dn = boKhoi(phong.dn, i);
        gocKhac.clear(); selKhung = -1; setStatus(`Đã bỏ tường ${ten}${mat ? ` cùng ${mat} cửa / dầm cột / điểm điện – nước / khung nằm trên tường đó` : ''}.`);
      } else if (act === 'm-add') phong.mo.push({ tuong: selTuong, loai: 'cua', cach: 100, rong: 900, cao: 2200, be: 0 });
      else if (act === 'm-del') phong.mo.splice(+b.closest('.pcard').dataset.mj, 1);
      else if (act === 'c-add') { const loai = b.dataset.v || 'cot', dam = loai === 'dam'; phong.can.push({ tuong: selTuong, loai, cach: 0, rong: dam && tw ? tw.dai : 300, nho: dam ? 250 : 200, z0: dam ? Math.max(0, phong.cao - 350) : 0, z1: phong.cao }); }
      else if (act === 'c-del') phong.can.splice(+b.closest('.pcard').dataset.cj, 1);
      else if (act === 'd-add') {
        // điểm mới: trên tường đang chọn, cách điểm cùng nhóm vừa thêm 300 (không chồng lên nhau trên hình), cao độ / cách tường điền sẵn theo loại
        const LD = Ph.LOAI_DN, loai = LD[b.dataset.v] ? b.dataset.v : 'o_dien', L = LD[loai], dai = tw && tw.dai > 0 ? tw.dai : 2000;
        const cung = phong.dn.filter(d => d.tuong === selTuong && !!LD[d.loai].san === !!L.san), cuoi = cung[cung.length - 1];
        const d = { tuong: selTuong, loai, cach: Math.round(clamp(cuoi ? cuoi.cach + 300 : Math.min(500, dai / 2), 0, dai)) };
        if (L.san) d.ra = L.ra; else d.cao = L.cao;
        phong.dn.push(d); dnMoi = phong.dn.length - 1;
      } else if (act === 'd-del') phong.dn.splice(+b.closest('.drow').dataset.dj, 1);
      else if (act === 'k-add') {
        // khung mới: phần tường còn trống bên phải các khung đã có trên tường đang chọn
        const da = phong.khung.filter(k => k.tuong === selTuong), tu = da.reduce((m, k) => Math.max(m, k.cach + k.rong), 0), dai = tw ? tw.dai : 2000;
        let ten = 'K' + (phong.khung.length + 1); while (phong.khung.some(k => k.ten === ten)) ten += "'";
        phong.khung.push({ ten, tuong: selTuong, cach: tu < dai - 300 ? tu : 0, z: 0, rong: Math.max(300, tu < dai - 300 ? dai - tu : dai), cao: tw ? tw.cao : phong.cao, sau: 600, mau: '' });
        selKhung = phong.khung.length - 1;
      } else if (act === 'k-del') { phong.khung.splice(+b.closest('.pcard').dataset.kj, 1); selKhung = -1; }
      phongStore.save(); renderPhong();
      if (dnMoi >= 0) { const inp = $(`[data-p="dn.${dnMoi}.cach"]`); dnMoi = -1; if (inp) { inp.focus(); inp.select(); } }      // điểm vừa thêm: con trỏ vào ô "cách trái" để gõ số đo luôn
    }
    let dnMoi = -1;
    /** Khung → tủ vừa khung, mở ở tab Tủ. Trả về vị trí đặt {goc, xoay, tuong} hoặc null. */
    function moKhung(j) {
      phong = Ph.chuanHoa(phong); hinh = Ph.hinhHoc(phong);
      const q = hinh.p.khung[j]; if (!q) return null;
      if (!(q.rong > 0 && q.cao > 0 && q.sau > 0)) { setStatus(`Khung ${q.ten} chưa đủ rộng / cao / sâu.`); return null; }
      // khung treo (đáy cao hơn sàn) thì tủ không có chân; mở lại một khung đứng sàn thì trả chân về số trước đó
      if (q.z > 0.5) { if (spec.chan && spec.chan.cao > 0) chanSan = spec.chan.cao; } else if (chanSan > 0 && spec.chan && !(spec.chan.cao > 0)) spec.chan = Object.assign({}, spec.chan, { cao: chanSan });
      const r = Ph.tuChoKhung(Core, spec, q, hinh.p.ten, hinh, j), d = Ph.datKhung(hinh, j);
      spec = r.spec; noi = null; selKhung = j; khungCho = d ? { j, d } : null; renderAll();
      const ua = $('[data-ui="useAt"]');
      if (ua && d) { ua.checked = true; ['ax', 'ay', 'az'].forEach((k, i) => { $(`[data-ui="${k}"]`).value = fmt(d.goc[i]); }); }
      return { d, q, ghi: r.ghi_chu };
    }
    let chanSan = 0;          // cao chân tủ trước khi mở một khung treo (khung treo đặt chân = 0)
    let khungCho = null;      // khung vừa mở thành tủ: vẽ đúng toạ độ khung thì tự xoay theo tường và ghi "đã vẽ" cho khung
    async function vePhong() {
      if (!Drv || busy) return;
      if (!Drv.available()) return setStatus('Không thấy bản vẽ Chenfeng trong trang này.');
      phong = Ph.chuanHoa(phong); hinh = Ph.hinhHoc(phong);
      if (hinh.loi.length) return setStatus('Phòng còn lỗi (ô đỏ dưới mặt bằng) — sửa xong rồi vẽ.');
      busy = true; paintPhong();
      let r;
      try { r = await Drv.drawRoom(hinh, { day_tuong: hinh.p.day, onStatus: setStatus, dien_nuoc: Ph.dienNuocDXF ? Ph.dienNuocDXF(hinh) : null }); }
      catch (e) { r = { ok: false, errors: [String(e && e.message || e)], warnings: [], dem: { tuong: 0, mo: 0, cot: 0, dam: 0 } }; }
      busy = false;
      const d = r.dem || {}, h = [];
      if (r.ok) h.push(`<div class="msg ok">Đã vẽ phòng: ${d.tuong} tường${d.mo ? `, ${d.mo} cửa / ô trống` : ''}${d.cot ? `, ${d.cot} cột / hộp` : ''}${d.dam ? `, ${d.dam} dầm` : ''}${d.dn ? `, ${d.dn} dấu điện – nước (nét + nhãn trên mặt tường / trên sàn)` : ''}. Sửa tiếp bằng các lệnh ở thẻ House Design của Chenfeng.</div>`);
      else h.push('<div class="msg err">Chưa vẽ xong phòng.</div>');
      (r.errors || []).forEach(t => h.push(`<div class="msg err">${esc(t)}</div>`));
      (r.warnings || []).forEach(t => h.push(`<div class="msg warn">${esc(t)}</div>`));
      $('.pkq').innerHTML = h.join('');
      const ht = $('[data-act="p-hoantac"]'); if (ht) ht.disabled = !(r.so_buoc_hoan_tac > 0);
      paintPhong(); setStatus(r.ok ? 'Đã vẽ phòng vào Chenfeng.' : 'Vẽ phòng chưa xong — xem ô báo dưới mặt bằng.');
      if (r.ok) Drv.zoom();
      return r;
    }
    // sau khi vẽ tủ đúng vị trí một khung / một hình: ghi kết quả đặt + xoay vào báo cáo, ghi nhớ khung đã vẽ
    function ghiKhung(rep, k) {
      const d = k.d;
      if (d.xoay) {
        const kq = rep.goc_cf ? (rep.dat || { ok: false, reason: 'tủ chưa được đưa về chỗ đặt' }) : (rep.xoay_kq || { ok: false, reason: 'lệnh xoay không chạy' });
        rep.xoay = { do: d.xoay, tuong: d.tuong, goc: d.goc, ok: !!kq.ok, reason: kq.reason || '', hinh: k.hinh ? (k.hinh.nguon || true) : false };
      }
      if (rep.id && k.j >= 0 && phong.khung[k.j]) { phong.khung[k.j].tu_id = rep.id; phongStore.save(); }
    }
    async function veKhung(j) {
      if (busy) return;
      if (hinh && hinh.loi.length) return setStatus('Phòng còn lỗi (ô đỏ dưới mặt bằng) — sửa xong rồi vẽ.');
      const m = moKhung(j); if (!m) return;
      if (model && model.errors.length) { switchTab('tu'); return setStatus(`Tủ vừa khung ${m.q.ten} còn lỗi — sửa ở tab Tủ rồi bấm “Vẽ vào Chenfeng”.`); }
      await draw({ corner: m.d.goc });
      paintPhong();
    }
    /* ---- bản 1.19: CHIA Ô, KÉO VẼ KHUNG TRÊN MẶT ĐỨNG ---- */
    function chiaO(j, n, chieu) {
      phong = Ph.chuanHoa(phong);
      const q = phong.khung[j]; if (!q) return;
      const r = Ph.chiaKhung(phong, j, n, chieu);
      if (!r) return setStatus(`Khung ${q.ten} quá nhỏ để chia thành ${n} ô (mỗi ô phải từ 50 trở lên).`);
      phong = r.p; selKhung = r.tu; selTuong = phong.khung[r.tu].tuong; phongStore.save(); renderPhong();
      setStatus(`Đã chia khung ${q.ten} thành ${n} ô ${chieu === 'ngang' ? 'chồng lên nhau (từ dưới lên)' : 'cạnh nhau (từ trái sang)'}: ${phong.khung.slice(r.tu, r.den + 1).map(k => k.ten).join(', ')}. Bấm vào số của từng ô trên mặt đứng để chỉnh — ô kề tự nhận phần bù.`);
    }
    // Kéo chuột trên mặt đứng của tường đang chọn → khung mới đúng chỗ kéo. Toạ độ: s = dọc tường từ đầu trái, z = cao từ sàn (mm); bắt chẵn 10, bám mép tường / cửa / cột / khung sẵn có trong 30 mm.
    let veMD = false, keoMD = null;
    const pmd = $('.pmd');
    function datVeMD(on) {
      veMD = !!on && !!pmd; keoMD = null;
      if (pmd) pmd.classList.toggle('ve', veMD);
      const b = $('[data-act="k-ve-md"]'); if (b) b.setAttribute('aria-pressed', veMD ? 'true' : 'false');
    }
    const diemMD = e => {
      const sv = pmd && pmd.querySelector('svg'), w = hinh && hinh.tuong[selTuong]; if (!sv || !w || !(w.dai > 0)) return null;
      let m = null; try { m = sv.getScreenCTM(); } catch (er) { m = null; } if (!m) return null;
      const p = sv.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(m.inverse()), C = w.cao || hinh.p.cao || 2700;
      return { sv, s: q.x, z: C - q.y, L: w.dai, C };
    };
    const mocMD = () => {
      const s = [0], z = [0], w = hinh.tuong[selTuong]; s.push(w.dai); z.push(w.cao || hinh.p.cao);
      for (const k of hinh.khung || []) if (k.tuong === selTuong) { s.push(k.cach, k.cach + k.rong); z.push(k.z, k.z + k.cao); }
      for (const m of hinh.mo || []) if (m.tuong === selTuong) { s.push(m.cach, m.cach + m.rong); z.push(m.be, m.be + m.cao); }
      for (const c of hinh.can || []) if (c.tuong === selTuong) { s.push(c.cach, c.cach + c.rong); z.push(c.z0, c.z1); }
      return { s, z };
    };
    const batMD = (v, moc, max) => { v = clamp(v, 0, max); let gan = null; for (const m of moc) if (Math.abs(v - m) <= 30 && (gan === null || Math.abs(v - m) < Math.abs(v - gan))) gan = m; return gan === null ? Math.round(v / 10) * 10 : gan; };
    if (pmd) {
      pmd.addEventListener('pointerdown', safe(e => {
        if (!veMD || e.button > 0) return;
        const d = diemMD(e); if (!d || d.s < -200 || d.s > d.L + 200 || d.z < -200 || d.z > d.C + 200) return;
        e.preventDefault();
        const moc = mocMD(), s0 = batMD(d.s, moc.s, d.L), z0 = batMD(d.z, moc.z, d.C);
        const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        r.setAttribute('fill', '#1c5fb8'); r.setAttribute('fill-opacity', '.18'); r.setAttribute('stroke', '#1c5fb8'); r.setAttribute('stroke-width', String(Math.max(d.L, d.C) / 260)); r.setAttribute('stroke-dasharray', `${Math.max(d.L, d.C) / 60} ${Math.max(d.L, d.C) / 110}`); r.setAttribute('pointer-events', 'none'); r.setAttribute('class', 'kve');
        d.sv.appendChild(r);
        keoMD = { id: e.pointerId, s0, z0, s1: s0, z1: z0, r, moc, L: d.L, C: d.C };
        try { pmd.setPointerCapture(e.pointerId); } catch (er) { /* bỏ qua */ }
      }));
      pmd.addEventListener('pointermove', safe(e => {
        const k = keoMD; if (!k || e.pointerId !== k.id) return;
        const d = diemMD(e); if (!d) return;
        k.s1 = batMD(d.s, k.moc.s, k.L); k.z1 = batMD(d.z, k.moc.z, k.C);
        const x = Math.min(k.s0, k.s1), rong = Math.abs(k.s1 - k.s0), zd = Math.min(k.z0, k.z1), cao = Math.abs(k.z1 - k.z0);
        k.r.setAttribute('x', String(x)); k.r.setAttribute('y', String(k.C - zd - cao)); k.r.setAttribute('width', String(rong)); k.r.setAttribute('height', String(cao));
        setStatus(`Khung mới: rộng ${hien(rong)} × cao ${hien(cao)} · cách trái ${hien(x)} · đáy +${hien(zd)} — nhả chuột để tạo.`);
      }));
      const nhaMD = safe(e => {
        const k = keoMD; if (!k || e.pointerId !== k.id) return;
        keoMD = null; try { k.r.remove(); } catch (er) { /* đã gỡ */ }
        try { pmd.releasePointerCapture(e.pointerId); } catch (er) { /* bỏ qua */ }
        if (e.type !== 'pointerup') return;
        const cach = Math.min(k.s0, k.s1), rong = Math.abs(k.s1 - k.s0), z = Math.min(k.z0, k.z1), cao = Math.abs(k.z1 - k.z0);
        if (rong < 100 || cao < 100) return setStatus('Khung kéo quá nhỏ (dưới 100) — kéo lại từ góc này tới góc đối diện của ô.');
        phong = Ph.chuanHoa(phong);
        const mau = selKhung >= 0 && phong.khung[selKhung] ? phong.khung[selKhung] : phong.khung.filter(x => x.tuong === selTuong).slice(-1)[0];
        let ten = 'K' + (phong.khung.length + 1); while (phong.khung.some(x => x.ten === ten)) ten += "'";
        const moi = { ten, tuong: selTuong, cach, z, rong, cao, sau: mau ? mau.sau : 400, mau: '' };
        if (mau && mau.kieu === 'kho') { moi.kieu = 'kho'; if (mau.nhom) moi.nhom = mau.nhom; }
        phong.khung.push(moi); selKhung = phong.khung.length - 1; phongStore.save(); renderPhong();
        setStatus(`Đã thêm khung ${ten}: ${hien(rong)} × ${hien(cao)}, sâu ${hien(moi.sau)}, cách trái ${hien(cach)}, đáy +${hien(z)}. Kéo tiếp để vẽ ô khác · Esc hoặc bấm lại nút để thôi.`);
      });
      pmd.addEventListener('pointerup', nhaMD); pmd.addEventListener('pointercancel', nhaMD);
    }

    /* ================= KHO MẪU (bản 1.19) =================
     * anh Jason 03/10/2026 20:49 / 20:52 / 23:18: chọn mẫu thư viện cho từng khu vực của vách (tivi, đầu giường…), hoặc chọn mẫu → gõ kích thước → đặt bằng chuột.
     * Thư mục + mẫu đọc từ kho của TÀI KHOẢN đang đăng nhập Chenfeng (mã nguồn không ghi sẵn mã thư mục nào); nhóm nhanh dò theo TÊN thư mục. */
    const NHOM_KHO = [['ao', 'Tủ áo', /tủ áo|quần áo|thay đồ|衣柜|衣帽/i], ['tivi', 'Tủ tivi', /ti ?vi|电视/i], ['sach', 'Tủ sách – bàn', /sách|书柜|书桌|bàn học|bàn làm/i], ['giay', 'Tủ giày – sảnh', /giày|sảnh|鞋柜|玄关/i],
      ['bep', 'Tủ bếp', /bếp|橱柜/i], ['an', 'Tủ rượu – tủ ăn', /rượu|tủ ăn|酒柜|餐边/i], ['lavabo', 'Lavabo', /lavabo|浴室|卫浴/i], ['bancong', 'Ban công', /ban công|阳台/i], ['giuong', 'Giường – tab', /giường|床|榻榻米|tatami/i], ['roi', 'Đồ rời', /đồ rời/i]];
    const MOI_TRANG = 12;
    const kho = { dirs: null, dangDirs: false, loiDirs: '', dir: '', nhom: '', tim: '', trang: 1, tat: null, cho: false, lan: 0, loi: '', chon: null, choKhung: -1, nho: new Map() };
    const boDau = t => String(t == null ? '' : t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
    // TOÀN BỘ mẫu của một thư mục: đọc một lần rồi nhớ. Tìm theo tên + chia trang làm ngay trong bảng — máy chủ Chenfeng lọc tên kiểu "trúng một từ là được"
    // (đo 04/10/2026: gõ "Tủ giày 10" trả về mọi mẫu có chữ "Tủ") nên không dùng bộ lọc của máy chủ.
    async function docDir(id) {
      if (kho.nho.has(id)) return kho.nho.get(id);
      let mau = [];
      for (let tr = 1; tr <= 6; tr++) { const r = await Drv.khoMau(id, { trang: tr, moi_trang: 100 }); mau = mau.concat(r.mau); if (!r.mau.length || mau.length >= r.tong) break; }
      const o = { mau }; kho.nho.set(id, o); return o;
    }
    const locKho = () => { const all = kho.tat ? kho.tat.mau : [], tu = boDau(kho.tim).split(/\s+/).filter(Boolean); return tu.length ? all.filter(m => { const t = boDau(m.ten); return tu.every(x => t.includes(x)); }) : all; };
    const dirCon = id => (kho.dirs || []).filter(d => d.cha === id);
    const oKT = () => ['kho-rong', 'kho-sau', 'kho-cao'].map(n => $(`[data-ui="${n}"]`));
    const datKTKho = kt => { const o = oKT(); if (o[0]) kt.forEach((v, i) => { o[i].value = fmt(v); }); };
    const docKTKho = () => {
      const o = oKT(); if (!o[0]) return null;
      const kt = o.map(i => parseFloat(String(i.value).replace(',', '.')));
      if (!kt.every(v => isFinite(v) && v >= 50 && v <= 20000)) { setStatus('Gõ đủ Rộng / Sâu / Cao của mẫu (mỗi số từ 50 trở lên).'); return null; }
      return kt;
    };
    // khung đang chờ chọn mẫu (mở thẻ Kho mẫu từ thẻ của khung): nhớ chỉ số + tên; khung đó bị xoá / đổi tên / đổi chỗ trong danh sách thì thôi chế độ chọn
    const khungDangChon = () => { const K = kho.choKhung >= 0 && phong && phong.khung[kho.choKhung] ? phong.khung[kho.choKhung] : null; if (K && K.ten === kho.choTen) return K; kho.choKhung = -1; return null; };
    function veLuoi() {
      const el = $('.kluoi'), tr = $('.ktrang'); if (!el) return;
      const thuLai = ' <button class="knut" data-act="kho-lai">Thử lại</button>';
      if (!kho.dirs) { el.innerHTML = `<p class="hint">${kho.dangDirs ? 'Đang đọc kho mẫu của tài khoản…' : kho.loiDirs ? esc('Không đọc được kho mẫu: ' + kho.loiDirs) + thuLai : ''}</p>`; tr.innerHTML = ''; return; }
      if (kho.cho) { el.innerHTML = '<p class="hint">Đang đọc mẫu…</p>'; tr.innerHTML = ''; return; }
      if (kho.loi) { el.innerHTML = `<p class="hint">${esc('Không đọc được mẫu: ' + kho.loi)}${thuLai}</p>`; tr.innerHTML = ''; return; }
      if (!kho.tat) { el.innerHTML = ''; tr.innerHTML = ''; return; }
      const tatCa = kho.tat.mau, ds = locKho();
      if (!ds.length) { el.innerHTML = `<p class="hint">${tatCa.length ? `Không có mẫu nào tên chứa “${esc(kho.tim)}” trong thư mục này (${tatCa.length} mẫu).` : dirCon(kho.dir).length ? 'Thư mục này không có mẫu trực tiếp — chọn một thư mục con ở trên.' : 'Thư mục này chưa có mẫu.'}</p>`; tr.innerHTML = ''; return; }
      const soTrang = Math.max(1, Math.ceil(ds.length / MOI_TRANG)); kho.trang = clamp(kho.trang, 1, soTrang);
      el.innerHTML = ds.slice((kho.trang - 1) * MOI_TRANG, kho.trang * MOI_TRANG).map(m => `<button class="kmc${kho.chon && kho.chon.id === m.id ? ' on' : ''}" data-act="kho-chon" data-v="${m.id}" title="${esc(m.ten)}${m.kt ? ' — mặc định ' + m.kt.map(hien).join(' × ') : ''}">${m.hinh ? `<img src="${esc(m.hinh)}" alt="">` : ''}<b>${esc(m.ten)}</b>${m.kt ? `<small>${m.kt.map(hien).join(' × ')}</small>` : ''}</button>`).join('');
      tr.innerHTML = soTrang > 1 ? `<button class="sec" data-act="kho-trang" data-v="-1"${kho.trang <= 1 ? ' disabled' : ''} aria-label="Trang trước">◂</button><span>Trang ${kho.trang} / ${soTrang} · ${ds.length} mẫu</span><button class="sec" data-act="kho-trang" data-v="1"${kho.trang >= soTrang ? ' disabled' : ''} aria-label="Trang sau">▸</button>` : `<span>${ds.length} mẫu</span>`;
    }
    function veChon() {
      const el = $('.kmau'); if (!el) return;
      const m = kho.chon, K = khungDangChon();
      el.innerHTML = m ? `${m.hinh ? `<img src="${esc(m.hinh)}" alt="">` : ''}<div><b>${esc(m.ten)}</b>${m.kt ? `<br>Kích thước mặc định của mẫu: ${m.kt.map(hien).join(' × ')} (rộng × sâu × cao)` : ''}</div>` : '<span class="hint" style="margin:0">Bấm vào một mẫu ở trên.</span>';
      const chu = $('[data-ui="kho-chuan-chu"]'); if (chu) chu.textContent = `Theo chuẩn xưởng: ván ${hien(spec.van.t)}${spec.hau.kieu === 'phu' ? ` · hậu ${hien(spec.hau.t || 6)} li phủ sau` : ''}`;
      const bk = $('[data-act="kho-khung"]'), bd = $('[data-act="kho-dat"]'), bv = $('[data-act="kho-ve"]'), ban = $('.khochon');
      if (bk) { bk.hidden = !K; bk.disabled = !m || busy; if (K) bk.textContent = `Dùng mẫu này cho khung ${K.ten}`; }
      if (bd) { bd.disabled = !m || busy; bd.className = K ? 'sec' : 'pri'; }
      if (bv) bv.disabled = !m || busy;
      if (ban) { ban.hidden = !K; ban.innerHTML = K ? `<span>Đang chọn mẫu cho <b>khung ${esc(K.ten)}</b> (${hien(K.rong)} × ${hien(K.cao)}, sâu ${hien(K.sau)}) — bấm một mẫu rồi bấm “Dùng mẫu này cho khung ${esc(K.ten)}”.</span><button data-act="kho-thoi">Thôi</button>` : ''; }
    }
    function renderKho() {
      if (!coKho) return;
      const nh = $('.knhom'), selDir = $('[data-ui="kho-dir"]'), con = $('.kcon');
      if (!kho.dirs) { nh.innerHTML = ''; selDir.innerHTML = '<option value="">—</option>'; con.innerHTML = ''; veLuoi(); veChon(); return; }
      nh.innerHTML = NHOM_KHO.filter(N => kho.dirs.some(d => N[2].test(d.ten))).map(N => `<button class="knut${kho.nhom === N[0] ? ' on' : ''}" data-act="kho-nhom" data-v="${N[0]}">${esc(N[1])}</button>`).join('');
      const sau = d => { let n = 0; while (d && d.cha && n < 10) { n++; const c = d.cha; d = kho.dirs.find(x => x.id === c); } return n; };
      selDir.innerHTML = kho.dirs.map(d => `<option value="${esc(d.id)}"${d.id === kho.dir ? ' selected' : ''}>${'   '.repeat(sau(d))}${esc(d.ten)}</option>`).join('');
      const cs = dirCon(kho.dir), cha = (kho.dirs.find(d => d.id === kho.dir) || {}).cha;
      con.innerHTML = (cha ? `<button class="knut" data-act="kho-dir" data-v="${esc(cha)}" title="Lên thư mục chứa">↑ lên</button>` : '') + cs.map(d => `<button class="knut" data-act="kho-dir" data-v="${esc(d.id)}">${esc(d.ten)} ›</button>`).join('');
      veLuoi(); veChon();
    }
    async function khoTai() {      // đọc mẫu của thư mục đang chọn (lần đầu; các lần sau lấy trong trí nhớ)
      if (!kho.dirs || !kho.dir) return;
      const lan = ++kho.lan; kho.cho = true; kho.loi = ''; veLuoi();
      let r = null, loi = '';
      try { r = await docDir(kho.dir); } catch (e) { loi = String(e && e.message || e); }
      if (lan !== kho.lan) return;      // đã có yêu cầu mới hơn
      kho.cho = false; kho.tat = r; kho.loi = loi;
      veLuoi();
    }
    async function khoNhom(ma) {      // nhóm nhanh: thư mục đầu tiên CÓ MẪU trong các thư mục tên khớp nhóm (kho hay có thư mục trùng tên mà rỗng)
      const N = NHOM_KHO.find(x => x[0] === ma); if (!N || !kho.dirs) return;
      kho.nhom = ma; kho.tim = ''; kho.trang = 1; const tim = $('[data-ui="kho-tim"]'); if (tim) tim.value = '';
      const ung = kho.dirs.filter(d => N[2].test(d.ten));
      const lan = ++kho.lan; kho.cho = true; kho.loi = ''; kho.tat = null; renderKho();
      let chon = null, ds = null, loi = '';
      for (const d of ung) {
        try { const r = await docDir(d.id); if (lan !== kho.lan) return; if (r.mau.length) { chon = d; ds = r; break; } }
        catch (e) { loi = String(e && e.message || e); break; }
      }
      if (lan !== kho.lan) return;
      kho.cho = false; kho.loi = loi;
      if (chon) { kho.dir = chon.id; kho.tat = ds; } else if (!loi) { kho.tat = { mau: [] }; if (ung[0]) kho.dir = ung[0].id; }
      renderKho();
    }
    async function khoNap() {      // lần đầu mở thẻ: đọc cây thư mục kho của tài khoản
      if (!coKho || kho.dirs || kho.dangDirs) return;
      kho.dangDirs = true; kho.loiDirs = ''; renderKho();
      try { kho.dirs = await Drv.templateDirs(); } catch (e) { kho.loiDirs = String(e && e.message || e); kho.dirs = null; }
      kho.dangDirs = false;
      if (!kho.dirs) return renderKho();
      const nhomDau = kho.nhom || (NHOM_KHO.find(N => kho.dirs.some(d => N[2].test(d.ten))) || [])[0];
      if (nhomDau) return khoNhom(nhomDau);
      kho.dir = kho.dirs.length ? kho.dirs[0].id : ''; renderKho(); return khoTai();
    }
    function khoDoiDir(id) { kho.dir = String(id); kho.nhom = ''; kho.trang = 1; kho.tim = ''; kho.tat = null; const tim = $('[data-ui="kho-tim"]'); if (tim) tim.value = ''; renderKho(); return khoTai(); }
    let tmrKho = 0; const laterKho = () => { clearTimeout(tmrKho); tmrKho = setTimeout(safe(() => { const t = $('[data-ui="kho-tim"]'); kho.tim = t ? String(t.value).trim() : ''; kho.trang = 1; veLuoi(); }), 160); };
    function khoChon(id) {
      const m = kho.tat && kho.tat.mau.find(x => x.id === id); if (!m) return;
      kho.chon = m;
      const K = khungDangChon();
      if (K) datKTKho([K.rong, K.sau, K.cao]); else if (m.kt) datKTKho(m.kt);
      veLuoi(); veChon();
      setStatus(K ? `Mẫu “${m.ten}” — bấm “Dùng mẫu này cho khung ${K.ten}”.` : `Mẫu “${m.ten}”${m.kt ? ` (mặc định ${m.kt.map(hien).join(' × ')})` : ''} — sửa kích thước nếu cần rồi bấm “Đặt bằng chuột”.`);
    }
    /** Từ thẻ của khung: mở thẻ Kho mẫu để chọn mẫu cho khung j. */
    function khoChoKhung(j) {
      phong = Ph.chuanHoa(phong);
      const K = phong.khung[j]; if (!K || !coKho) return;
      kho.choKhung = j; kho.choTen = K.ten; selKhung = j;
      if (K.kho && (!kho.chon || kho.chon.id !== K.kho.id)) kho.chon = { id: K.kho.id, ten: K.kho.ten, hinh: K.kho.hinh, kt: K.kho.kt || null };
      datKTKho([K.rong, K.sau, K.cao]);
      // khung đã có nhóm mẫu (lần chọn trước) → mở đúng nhóm đó; chưa có thì giữ nguyên chỗ đang xem trong kho
      const doiNhom = !!K.nhom && K.nhom !== kho.nhom;
      if (doiNhom && !kho.dirs) kho.nhom = K.nhom;
      switchTab('kho');
      if (doiNhom && kho.dirs) khoNhom(K.nhom);
      setStatus(`Chọn mẫu kho cho khung ${K.ten} (${hien(K.rong)} × ${hien(K.cao)}, sâu ${hien(K.sau)}).`);
    }
    function khoDung() {
      const K = khungDangChon(), j = kho.choKhung, m = kho.chon;
      if (!K || !m) return veChon();
      K.kieu = 'kho'; K.kho = { id: m.id, ten: m.ten, hinh: m.hinh }; if (m.kt) K.kho.kt = m.kt.slice(); if (kho.nhom) K.nhom = kho.nhom; delete K.tu_id;
      kho.choKhung = -1; selKhung = j; selTuong = K.tuong; phongStore.save(); renderPhong(); veChon(); switchTab('phong');
      const c = $(`.pcard[data-kj="${j}"]`); if (c && c.scrollIntoView) c.scrollIntoView({ block: 'nearest' });
      setStatus(`Khung ${K.ten}: dùng mẫu kho “${m.ten}”. Bấm “Vẽ mẫu vào khung” để dựng đúng ${hien(K.rong)} × ${hien(K.cao)}, sâu ${hien(K.sau)} tại chỗ khung.`);
    }
    function showReportKho(rep, ctx) {
      lastRep = rep; const h = [], kt = a => (a || []).map(hien).join(' × '), xongRoi = rep.giai_doan === 'xong';
      if (rep.ok) h.push(`<div class="msg ok">Đã vẽ mẫu kho “${esc(rep.mau.ten)}” — ${kt(rep.kich)} (rộng × sâu × cao): ${rep.so_tam} tấm${rep.so_phu_kien ? `, ${rep.so_phu_kien} phụ kiện` : ''}, ${rep.so_lo} lỗ khoan.</div>`);
      else h.push(`<div class="msg err">${xongRoi ? 'Đã dựng mẫu kho nhưng có chỗ chưa đúng.' : 'Chưa vẽ được mẫu kho.'}</div>`);
      (rep.errors || []).forEach(t => h.push(`<div class="msg err">${esc(t)}</div>`));
      (rep.warnings || []).forEach(t => h.push(`<div class="msg warn">${esc(t)}</div>`));
      (rep.notes || []).forEach(t => h.push(`<div class="msg note">${esc(t)}</div>`));
      if (xongRoi && rep.do_loi) h.push(phieuVeHTML(rep.do_loi, 'Dò lỗi sản xuất trên tấm thật', 'phieu-ve', rep.do_loi.dem.loi + rep.do_loi.dem.luu_y > 0) + dongDoLoi(rep.do_loi, true));
      h.push(mauVeHTML(rep));
      if (xongRoi) {
        const tt = rep.ten_tam || {}, ds = Object.keys(tt);
        if (rep.doi_ten) h.push(`<div class="msg note">Đã ghi tên tiếng Việt cho ${rep.doi_ten} tấm: ${esc(ds.slice(0, 12).map(t => (tt[t] > 1 ? `${t} ×${tt[t]}` : t)).join(', '))}${ds.length > 12 ? '…' : ''}.</div>`);
        if (rep.la_module) h.push(`<div class="msg note mod">Mẫu vẫn là <b>module tham số của Chenfeng</b> “${esc(rep.module)}”: chọn 1 tấm → thẻ <b>Template</b> (Thông số) ở bảng phải → gõ L / W / H mới vào cột <b>Expression</b> → <b>Apply data modifications</b>. Các tham số riêng của mẫu (số đợt, khoang, ngăn kéo…) cũng sửa ở đó.</div>`);
        const rows = [['Mẫu trong kho', `${rep.mau.ten} (mã ${rep.mau.id})`], ['Kích thước yêu cầu (rộng × sâu × cao)', kt(rep.yeu_cau)], ['Các tấm chiếm', kt(rep.kich) + (rep.hop && rep.hop[2] < -0.6 ? ` — mặt trước nhô ra ngoài chiều sâu yêu cầu ${hien(-rep.hop[2])}` : '')], ['Góc trái – trước – dưới', (rep.goc || []).map(fmt).join(', ')], ['Xoay', hien(rep.xoay_do || 0) + '°']];
        if (ctx && ctx.ten) rows.unshift(['Khung', ctx.ten]);
        h.push(`<table>${rows.map(r => `<tr><td>${esc(r[0])}</td><td class="n">${esc(r[1])}</td></tr>`).join('')}</table>`);
      }
      if (rep.so_buoc_hoan_tac > 0) h.push('<div class="frow" style="margin-top:10px"><button class="sec" data-act="undo">Hoàn tác lần vẽ này</button><button class="sec" data-act="zoom">Xem toàn bộ</button></div>');
      $('.report').innerHTML = h.join('');
      switchTab('kq');
    }
    /** Vẽ một mẫu kho: o = { id, ten, rong, sau, cao, corner?, xoay?, phong, ma }; ctx = { j: khung đang vẽ (để ghi "đã vẽ"), ten: tên ghi ở báo cáo, luu_y: [] }. */
    async function veKho(o, ctx) {
      if (!Drv || busy || typeof Drv.veKho !== 'function') return null;
      if (!Drv.available()) { setStatus('Không thấy bản vẽ Chenfeng trong trang này.'); return null; }
      ctx = ctx || {};
      const bat = n => { const el = $(`[data-ui="${n}"]`); return !el || el.checked; }, chuan = bat('kho-chuan');
      const opt = Object.assign({ onStatus: setStatus, khoan: spec.khoan.thung, ten_viet: bat('kho-ten'), day: chuan ? spec.van.t : 0, hau: chuan && spec.hau.kieu === 'phu' ? (spec.hau.t || 6) : 0, mep: spec.hau.mep, kho: { dai: spec.van.kho_dai, rong: spec.van.kho_rong } }, o);
      busy = true; paint(); veChon(); if (Ph) paintPhong();
      if (!opt.corner) { panel.hidden = true; chip.textContent = 'Bấm 1 điểm trên bản vẽ để đặt mẫu (góc trái – trước – dưới)… Esc = thôi'; chip.hidden = false; }
      let rep;
      try { rep = await Drv.veKho(opt); }
      catch (e) { rep = { ok: false, kho: true, giai_doan: 'nhap', errors: [String(e && e.message || e)], warnings: [], notes: [], mau: { id: o.id, ten: o.ten } }; }
      if (rep.giai_doan === 'xong') rep.do_mau = await tuDoMau();
      chip.hidden = true; panel.hidden = false; launch.hidden = true; busy = false;
      try {
        if (ctx.luu_y && ctx.luu_y.length && rep.warnings) rep.warnings.unshift(...ctx.luu_y);
        if (rep.giai_doan === 'xong' && ctx.j >= 0 && phong.khung[ctx.j]) { phong.khung[ctx.j].tu_id = 'kho-' + (rep.mau && rep.mau.id); rep.khung_ve = { j: ctx.j, ten: phong.khung[ctx.j].ten }; phongStore.save(); }      // khung_ve: để "Hoàn tác lần vẽ này" bỏ đúng dấu "đã vẽ" của khung này
        paint(); veChon(); if (Ph) paintPhong();
        showReportKho(rep, ctx);
        setStatus(rep.ok ? `Đã vẽ mẫu kho “${rep.mau.ten}”.` : rep.giai_doan === 'xong' ? 'Đã vẽ mẫu kho nhưng có chỗ cần xem — thẻ Kết quả.' : 'Chưa vẽ được mẫu kho — xem thẻ Kết quả.');
        if (rep.giai_doan === 'xong') Drv.zoom();
      } catch (e) { setStatus('Lỗi khi hiện kết quả: ' + (e && e.message || e)); }
      return rep;
    }
    let veLaiKho = -1;      // khung mẫu kho đã vẽ mà người dùng vừa bấm vẽ lần nữa (bấm lần hai mới vẽ)
    async function veKhoKhung(j) {
      if (busy) return null;
      phong = Ph.chuanHoa(phong); hinh = Ph.hinhHoc(phong);
      if (hinh.loi.length) { setStatus('Phòng còn lỗi (ô đỏ dưới mặt bằng) — sửa xong rồi vẽ.'); return null; }
      const q = hinh.p.khung[j]; if (!q) return null;
      if (!q.kho) { setStatus(`Khung ${q.ten} chưa chọn mẫu kho — bấm “Chọn mẫu kho…”.`); return null; }
      if (!(q.rong > 0 && q.cao > 0 && q.sau > 0)) { setStatus(`Khung ${q.ten} chưa đủ rộng / cao / sâu.`); return null; }
      if (q.tu_id && veLaiKho !== j) { veLaiKho = j; setStatus(`Khung ${q.ten} đã vẽ một lần. Nếu mẫu cũ còn trên bản vẽ thì vẽ nữa sẽ chồng lên — xoá / hoàn tác mẫu cũ trước. Vẫn muốn vẽ: bấm “Vẽ mẫu vào khung” lần nữa.`); return null; }
      veLaiKho = -1;
      const d = Ph.datKhung(hinh, j); selKhung = j;
      return veKho({ id: q.kho.id, ten: q.kho.ten, rong: q.rong, sau: q.sau, cao: q.cao, corner: d.goc, xoay: d.xoay, phong: hinh.p.ten, ma: q.ten }, { j, ten: `${q.ten} — tường ${d.tuong}` });
    }
    /** Thẻ Kho mẫu: đặt mẫu đang chọn bằng chuột (bấm chân tường → rê → điểm cuối / gõ rộng / Enter) rồi vẽ luôn. */
    async function khoDat() {
      const m = kho.chon; if (!m || busy || !Ph || !Ph.haiDiemThanhHinh || typeof Drv.hoiDiem2 !== 'function') return null;
      if (!Drv.available()) { setStatus('Không thấy bản vẽ Chenfeng trong trang này.'); return null; }
      const kt = docKTKho(); if (!kt) return null;
      const cho = await hoiChoDat({ rong: kt[0], sau: kt[1], cao: kt[2], vat: 'mẫu' });
      if (!cho) return null;
      const k = cho.k, luu = [];
      if (k.khau.trai.rong > 0 || k.khau.phai.rong > 0 || k.khau.giua_cot.length > 0) luu.push('Chỗ đặt vướng cột của phòng — mẫu kho không khấu cột được: mẫu đang đè lên cột, dời mẫu hoặc đặt lại ở đoạn tường không có cột.');
      if (cho.haCao) luu.push(`Cao mẫu đã hạ xuống ${hien(cho.cao)} cho bằng trần của tường phía sau.`);
      datKTKho([k.rong, k.sau, cho.cao]);
      return veKho({ id: m.id, ten: m.ten, rong: k.rong, sau: k.sau, cao: cho.cao, corner: [k.goc[0], k.goc[1], cho.z], xoay: k.xoay, phong: phong ? phong.ten : '', ma: m.ten }, { j: -1, ten: '', luu_y: luu });
    }
    async function khoVeDiem() {
      const m = kho.chon; if (!m || busy) return null;
      const kt = docKTKho(); if (!kt) return null;
      return veKho({ id: m.id, ten: m.ten, rong: kt[0], sau: kt[1], cao: kt[2], phong: phong ? phong.ten : '', ma: m.ten }, { j: -1, ten: '' });
    }
    /* ---- THẺ MÀU (bản 1.21 — anh Jason 04/10/2026: "chọn một tủ: thùng một màu riêng, cánh + phào một màu … liệt kê các màu của mình cho nhanh, cho phép tìm kiếm và thay thế") ----
     * Màu = vật liệu trong kho vật liệu của tài khoản (Drv.khoVatLieu — chỉ đọc). Ba ô (thùng / cánh + phào / hậu) giữ màu sẽ đổ; "ô đang bật" là ô nhận màu khi bấm vào danh sách
     * và cũng là màu dùng cho "đổ riêng các tấm đang chọn" / "thay màu". Việc gán vào tấm do bộ điều khiển làm (Drv.doMauTu / doMau / thayMau — mỗi lần một bước hoàn tác). */
    const vl = { ds: null, nhom: [], dang: false, loi: '', tim: '', loc: '', het: false, dung: null, tu: null, ban: false };      // dung = màu đang dùng trên bản vẽ (sau khi bấm "Xem…"); tu = màu cần thay (null = chưa bấm, '' = tấm chưa đổ màu)
    const MAU_HIEN = 120;      // kho của xưởng vài trăm mã: dựng 120 ô đầu cho nhẹ; gõ mã để tìm, hoặc bấm "Hiện hết" (vl.het)
    const tenNhomMau = k => (NHOM_MAU.find(N => N[0] === k) || [k, k])[1];
    const mauBat = () => mauS.o[mauS.bat] || (mauS.bat === 'hau' ? mauS.o.thung : null);      // ô Hậu chưa có màu riêng = theo màu thùng
    const anhMau = m => (m && m.hinh ? `<img src="${esc(m.hinh)}" alt="" loading="lazy">` : '<i></i>');
    function veO() {
      const el = $('.vlos'); if (!el) return;
      el.innerHTML = NHOM_MAU.map(([k, ten]) => {
        const m = mauS.o[k], on = mauS.bat === k;
        return `<div class="vlo${on ? ' on' : ''}" data-v="${k}"><button class="vlob" data-act="vl-o" data-v="${k}" aria-pressed="${on}" title="Bấm để bật ô ${esc(ten)}: màu bấm ở danh sách sẽ vào ô này">${anhMau(m)}<span><small>${esc(ten)}</small><b${m ? '' : ' class="tr"'}>${m ? esc(m.ten) : k === 'hau' ? 'như thùng' : 'chưa chọn'}</b></span></button>${m ? `<button class="x" data-act="vl-bo" data-v="${k}" title="Bỏ màu của ô ${esc(ten)}" aria-label="Bỏ màu của ô ${esc(ten)}">✕</button>` : ''}</div>`;
      }).join('');
      veThay();
    }
    function veGan() { const el = $('.vlgan'); if (!el) return; el.innerHTML = mauS.gan.length ? '<span>Vừa dùng:</span>' + mauS.gan.map((m, i) => `<button class="vlg" data-act="vl-gan" data-v="${i}" title="Gán ${esc(m.ten)} cho ô đang bật">${anhMau(m)}${esc(m.ten)}</button>`).join('') : ''; }
    function veNhom() { const el = $('[data-ui="vl-nhom"]'); if (!el) return; el.innerHTML = '<option value="">Mọi nhóm</option>' + vl.nhom.map(n => `<option value="${esc(n)}"${n === vl.loc ? ' selected' : ''}>${esc(n)}</option>`).join(''); }
    function danhDauDS() { const m = mauS.o[mauS.bat], id = m ? m.id : null; $$('.vlds .vlc').forEach(c => c.classList.toggle('on', id !== null && c.dataset.v === id)); }
    function veDS() {
      const el = $('.vlds'), chan = $('.vlchan'); if (!el || !chan) return;
      const datChan = (chu, conNua) => { chan.innerHTML = `<span data-ui="vl-dem">${esc(chu)}</span><span class="frow">${conNua ? '<button class="knut" data-act="vl-het" title="Dựng hết các màu còn lại vào danh sách (để cuộn xem)">Hiện hết</button>' : ''}<button class="knut" data-act="vl-lai" title="Vừa thêm / đổi tên vật liệu trong Chenfeng thì bấm để đọc lại danh sách">↻ Đọc lại kho</button></span>`; };
      datChan('', false);
      if (vl.dang) { el.innerHTML = '<p class="hint">Đang đọc kho vật liệu của tài khoản Chenfeng…</p>'; return; }
      if (vl.loi) { el.innerHTML = `<p class="hint">Không đọc được kho vật liệu: ${esc(vl.loi)} Bấm “Đọc lại kho” để thử lại.</p>`; return; }
      if (!vl.ds) { el.innerHTML = ''; return; }
      const ds = Core.locMau(vl.ds, vl.tim, vl.loc), tong = vl.ds.length, hien_ = vl.het ? ds.length : Math.min(ds.length, MAU_HIEN);
      el.innerHTML = ds.length ? ds.slice(0, hien_).map(m => `<button class="vlc" data-act="vl-chon" data-v="${esc(m.id)}" title="${esc(m.ten)}${m.nhom ? ' — ' + esc(m.nhom) : ''}">${m.hinh ? `<img src="${esc(m.hinh)}" alt="" loading="lazy">` : ''}<b>${esc(m.ten)}</b></button>`).join('')
        : `<p class="hint">${tong ? `Không có mã màu nào khớp “${esc(vl.tim)}”${vl.loc ? ` trong nhóm ${esc(vl.loc)}` : ''}.` : 'Kho vật liệu của tài khoản chưa có màu nào — thêm vật liệu trong Chenfeng (thẻ Material) rồi bấm “Đọc lại kho”.'}</p>`;
      datChan((vl.tim || vl.loc ? `${ds.length} / ${tong} màu` : `${tong} màu`) + (ds.length > hien_ ? ` — đang hiện ${hien_}, còn ${ds.length - hien_} (gõ mã để tìm)` : ''), ds.length > hien_);
      danhDauDS();
    }
    let tmrVL = 0; const laterVL = () => { clearTimeout(tmrVL); tmrVL = setTimeout(safe(() => { const t = $('[data-ui="vl-tim"]'); vl.tim = t ? String(t.value).trim() : ''; veDS(); }), 160); };
    async function vlNap(lamMoi) {      // lần đầu mở thẻ: đọc kho vật liệu của tài khoản (bộ điều khiển nhớ lại; lamMoi = hỏi lại máy chủ)
      if (!coMau || vl.dang || (vl.ds && !lamMoi)) return;
      vl.dang = true; vl.loi = ''; veDS();
      try { const k = await Drv.khoVatLieu(lamMoi ? { lam_moi: true } : undefined); vl.ds = k.ds; vl.nhom = k.nhom; if (vl.loc && vl.nhom.indexOf(vl.loc) < 0) vl.loc = ''; }
      catch (e) { vl.loi = String(e && e.message || e); }
      vl.dang = false; veNhom(); veDS(); veDung();
      if (lamMoi) setStatus(vl.loi ? 'Chưa đọc lại được kho vật liệu.' : `Đã đọc lại kho vật liệu: ${vl.ds.length} màu.`);
    }
    function ganMau(m) {      // bấm một màu (ở danh sách / ở "Vừa dùng") → vào ô đang bật
      if (!m) return;
      const g = { id: String(m.id), ten: String(m.ten), nhom: m.nhom || '', hinh: m.hinh || '' };
      mauS.o[mauS.bat] = g; mauS.gan = [g].concat(mauS.gan.filter(x => x.ten !== g.ten)).slice(0, 8);
      luuMau(); veO(); veGan(); danhDauDS();
      setStatus(`Ô ${tenNhomMau(mauS.bat)}: ${g.ten}.`);
    }
    const tamChon = () => { try { return Drv.selected().filter(Drv.isBoard); } catch (e) { return []; } };
    const tenTuCua = tam => { const t = [...new Set(tam.map(b => { try { return String((b.BoardProcessOption && b.BoardProcessOption.cabinetName) || ''); } catch (e) { return ''; } }).filter(Boolean))]; return t.length && t.length <= 3 ? 'tủ ' + t.join(', ') : t.length ? `${t.length} tủ` : `${tam.length} tấm`; };
    const tenDS = o => Object.keys(o || {}).sort((a, b) => a.localeCompare(b, 'vi')).map(t => (o[t] > 1 ? `${t} ×${o[t]}` : t)).join(', ');
    function vlKQ(html, coHoan) { const el = $('[data-ui="vl-kq"]'); if (el) el.innerHTML = html + (coHoan ? '<div class="frow" style="margin-bottom:8px"><button class="sec" data-act="vl-hoan" title="Lùi đúng lần đổ / thay màu vừa rồi (chỉ khi sau đó bản vẽ chưa có thao tác khác)">Hoàn tác lần đổ màu này</button></div>' : ''); }
    // mọi việc đụng bản vẽ của thẻ Màu đi qua đây: không chạy chồng, không chen vào lúc bảng đang vẽ
    async function vlLam(fn) {
      if (!coMau || vl.ban) return;
      if (busy) { setStatus('Bảng đang vẽ — chờ vẽ xong rồi đổ màu.'); return; }
      if (!Drv.available()) { setStatus('Không thấy bản vẽ Chenfeng trong trang này.'); return; }
      vl.ban = true;
      try { await fn(); }
      catch (e) { vlKQ(`<div class="msg err">Chưa làm được: ${esc(String(e && e.message || e))}</div>`); setStatus('Chưa đổ được màu.'); }
      finally { vl.ban = false; }
    }
    async function vlDoTu() {      // "Đổ màu tủ đang chọn"
      const chon = tamChon();
      if (!chon.length) return setStatus('Chọn 1 tấm của tủ trên bản vẽ (hồi, đợt, cánh… — chọn tấm của nhiều tủ thì đổ nhiều tủ một lượt) rồi bấm lại.');
      if (!mauS.o.thung && !mauS.o.mat && !mauS.o.hau) return setStatus('Chưa chọn màu: bấm một ô (Thùng / Cánh + phào / Hậu) rồi bấm một màu trong danh sách.');
      const tam = Drv.tamCuaTu(chon), tu = tenTuCua(tam);
      vlKQ('<p class="hint">Đang đổ màu…</p>'); setStatus(`Đang đổ màu ${tu} (${tam.length} tấm)… màu dùng lần đầu phải tải từ kho, mất vài giây.`);
      const r = await Drv.doMauTu(tam, mauS.o);
      if (!r.ok) { vlKQ(`<div class="msg err">${esc(r.reason)}</div>`); return setStatus('Chưa đổ được màu.'); }
      const giu = NHOM_MAU.filter(N => !r.mau[N[0]]).map(N => N[1].toLowerCase());
      vlKQ(`<div class="msg ok">Đã đổ màu ${esc(tu)}: ${esc(dongMau(r) || 'không có tấm nào thuộc nhóm đã chọn màu')}.</div>`
        + (r.so.mat ? `<div class="msg note">Cánh + phào gồm: ${esc(tenDS(r.ten.mat))}.</div>` : r.mau.mat ? '<div class="msg note">Tủ này không có tấm nào thuộc nhóm cánh + phào.</div>' : '')
        + (giu.length ? `<div class="msg note">Phần ${esc(giu.join(', '))} giữ nguyên vì ô đó chưa chọn màu.</div>` : '')
        + (r.khoa ? `<div class="msg warn">${esc(khoaMau(r).trim())}</div>` : ''), r.steps > 0);
      setStatus(`Đã đổ màu ${tu}.`); vlQuetLai();
    }
    async function vlDoTam() {      // "Đổ màu ô đang bật cho riêng các tấm đang chọn"
      const chon = tamChon(), m = mauBat();
      if (!m) return setStatus(`Ô ${tenNhomMau(mauS.bat)} chưa có màu — bấm một màu trong danh sách trước.`);
      if (!chon.length) return setStatus('Chọn các tấm cần đổ màu trên bản vẽ rồi bấm lại.');
      vlKQ('<p class="hint">Đang đổ màu…</p>'); setStatus(`Đang đổ màu ${m.ten} cho ${chon.length} tấm…`);
      const r = await Drv.doMau(chon, m);
      if (!r.ok) { vlKQ(`<div class="msg err">${esc(r.reason)}</div>`); return setStatus('Chưa đổ được màu.'); }
      vlKQ(`<div class="msg ok">Đã đổ màu ${esc(m.ten)} cho ${r.so} tấm đang chọn.</div>` + (r.khoa ? `<div class="msg warn">${esc(khoaMau(r).trim())}</div>` : ''), r.steps > 0);
      setStatus(`Đã đổ màu ${m.ten} cho ${r.so} tấm.`); vlQuetLai();
    }
    async function vlHoan() {
      setStatus('Đang hoàn tác…');
      const r = await Drv.undoMau();
      if (!r.ok) return setStatus(r.reason);
      vlKQ('<p class="hint">Đã hoàn tác lần đổ màu vừa rồi.</p>'); setStatus('Đã hoàn tác lần đổ màu vừa rồi.'); vlQuetLai();
    }
    /* tìm và thay */
    function vlQuet() { vl.dung = Drv.mauDangDung(); if (vl.tu !== null && !vl.dung.some(x => x.ten === vl.tu)) vl.tu = null; veDung(); }
    function vlQuetLai() { if (vl.dung) vlQuet(); }
    function veDung() {
      const el = $('[data-ui="vl-dung"]'); if (!el) return;
      el.innerHTML = !vl.dung ? '' : !vl.dung.length ? '<p class="hint">Bản vẽ chưa có tấm ván nào.</p>'
        : vl.dung.map(x => `<button class="vld${vl.tu === x.ten ? ' on' : ''}" data-act="vl-tu" data-v="${esc(x.ten)}" aria-pressed="${vl.tu === x.ten}" title="${x.ten ? 'Màu ' + esc(x.ten) : 'Tấm còn vật liệu mặc định của bản vẽ'} — bấm để chọn tấm hoặc thay màu này">${anhMau(x.ten && vl.ds ? vl.ds.find(q => q.ten === x.ten) : null)}${x.ten ? esc(x.ten) : 'Chưa đổ màu'} · ${x.so} tấm</button>`).join('');
      veThay();
    }
    function veThay() {
      const tu = $('[data-ui="vl-tu"]'), den = $('[data-ui="vl-den"]'), o = $('[data-ui="vl-den-o"]'); if (!tu || !den) return;
      const m = mauBat();
      tu.textContent = vl.tu === null ? '(bấm một màu đang dùng)' : vl.tu === '' ? 'tấm chưa đổ màu' : vl.tu;
      den.textContent = m ? m.ten : '(chưa có màu)';
      if (o) o.textContent = `— màu của ô đang bật: ${tenNhomMau(mauS.bat)}`;
    }
    function vlXem() {
      if (!coMau || !Drv.available()) return;
      if (vl.tu === null) return setStatus('Bấm “Xem màu đang dùng trên bản vẽ” rồi bấm vào một màu trước.');
      const ds = Drv.tamTheoMau(vl.tu);
      if (!ds.length) { vlQuet(); return setStatus('Không còn tấm nào mang màu đó trên bản vẽ.'); }
      Drv.chonRieng(ds);      // bỏ chọn cũ trước: lệnh chọn của Chenfeng cộng thêm vào tập đang chọn
      setStatus(`Đã chọn ${ds.length} tấm ${vl.tu ? 'màu ' + vl.tu : 'chưa đổ màu'} trên bản vẽ.`);
    }
    async function vlThay(phamVi) {
      const m = mauBat(), tuTen = vl.tu;
      if (tuTen === null) return setStatus('Bấm “Xem màu đang dùng trên bản vẽ” rồi bấm vào màu cần thay.');
      if (!m) return setStatus(`Ô ${tenNhomMau(mauS.bat)} chưa có màu — bấm ô đó rồi bấm màu thay vào trong danh sách.`);
      if (m.ten === tuTen) return setStatus(`Màu thay vào (${m.ten}) trùng với màu cần thay — bật ô khác hoặc chọn màu khác.`);
      let pv = null;
      if (phamVi === 'chon') { pv = tamChon(); if (!pv.length) return setStatus('Trên bản vẽ, quét chọn các tấm cần thay màu (một tủ, một phòng…) rồi bấm lại.'); }
      const chuTu = tuTen || 'chưa đổ màu', cho = pv ? 'trong các tấm đang chọn' : 'trên cả bản vẽ';
      vlKQ('<p class="hint">Đang thay màu…</p>'); setStatus(`Đang thay ${chuTu} → ${m.ten}…`);
      const r = pv ? await Drv.thayMau(tuTen, m, pv) : await Drv.thayMau(tuTen, m);
      if (!r.ok) { vlKQ(`<div class="msg err">${esc(r.reason)}</div>`); return setStatus('Chưa thay được màu.'); }
      if (!r.so && !r.khoa) { vlKQ(`<div class="msg note">Không có tấm nào ${tuTen ? 'màu ' + esc(tuTen) : 'chưa đổ màu'} ${cho}.</div>`); setStatus('Không có tấm nào để thay.'); return vlQuetLai(); }
      vlKQ(`<div class="msg ok">Đã thay ${esc(chuTu)} → ${esc(m.ten)}: ${r.so} tấm ${cho}.</div>` + (r.khoa ? `<div class="msg warn">${esc(khoaMau(r).trim())}</div>` : ''), r.steps > 0);
      setStatus(`Đã thay ${chuTu} → ${m.ten}: ${r.so} tấm.`); vlQuetLai();
    }
    /** Tủ / mẫu kho vừa vẽ xong: đổ màu ngay theo 3 ô (khi ô "tự đổ màu" đang bật). → null (không làm) | kết quả Drv.doMauTu. Không ném lỗi. */
    async function tuDoMau() {
      if (!coMau || !mauS.tu_dong || !(mauS.o.thung || mauS.o.mat || mauS.o.hau)) return null;
      let tam = [];
      try { tam = ((Drv.last && Drv.last.added) || []).filter(e => e && !e.IsErase && Drv.isBoard(e)); } catch (e) { tam = []; }
      if (!tam.length) return null;
      setStatus('Đang đổ màu tủ vừa vẽ…');
      try { return await Drv.doMauTu(tam, mauS.o, { gop_ve: true }); } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
    }

    /* ---- ảnh hiện trạng ---- */
    function veAnh() {
      const el = $('.thumbs'); if (!el) return;
      el.innerHTML = anh.map(a => `<div class="thumb${a.id === xemId ? ' on' : ''}" data-aid="${esc(a.id)}"><button class="im" data-act="anh-xem" title="${esc(a.ten)} — bấm để xem to"><img src="${esc(a.url)}" alt="${esc(a.ten)}"></button><button class="x" data-act="anh-xoa" title="Bỏ ảnh này" aria-label="Bỏ ảnh ${esc(a.ten)}">✕</button></div>`).join('');
    }
    let soTam = 0;
    async function themAnh(files) {
      const ds = [...(files || [])].filter(f => f && /^image\//.test(f.type || ''));
      if (!ds.length) return 0;
      for (const f of ds) {
        const ten = f.name || 'ảnh dán';
        let id = null; try { id = await khoAnh.them({ blob: f, ten, luc: Date.now() }); } catch (e) { /* không lưu được: chỉ giữ trong phiên này */ }
        anh.push({ id: id === null || id === undefined ? 't' + (++soTam) : id, ten, url: URL.createObjectURL(f) });
      }
      veAnh(); setStatus(`Đã thêm ${ds.length} ảnh hiện trạng — bấm vào ảnh để xem to bên cạnh bảng.`);
      return ds.length;
    }
    function xoaAnh(id) {
      const i = anh.findIndex(a => String(a.id) === String(id)); if (i < 0) return;
      const a = anh[i]; anh.splice(i, 1); try { URL.revokeObjectURL(a.url); } catch (e) { /* bỏ qua */ }
      if (typeof a.id === 'number') khoAnh.xoa(a.id).catch(() => {});
      if (String(xemId) === String(id)) dongXem();
      veAnh();
    }
    const xem = $('.xem');
    function moXem(id) {
      const a = anh.find(x => String(x.id) === String(id)); if (!a || !xem) return;
      xemId = a.id; xem.hidden = false; xem.querySelector('img').src = a.url; xem.querySelector('.xemh span').textContent = `${a.ten} (${anh.indexOf(a) + 1}/${anh.length}) — bấm vào ảnh để phóng to`;
      xem.querySelector('.xemb').classList.remove('to'); veAnh();
    }
    function dongXem() { if (xem) { xem.hidden = true; xem.querySelector('img').removeAttribute('src'); } xemId = null; veAnh(); }
    function buocXem(k) { if (!anh.length) return; const i = anh.findIndex(a => String(a.id) === String(xemId)); moXem(anh[(i + k + anh.length) % anh.length].id); }
    if (Ph) {
      // kéo thả ảnh vào bảng: bắt ở window (pha bắt) để Chenfeng không hiểu là thả file vào bản vẽ
      const trongBang = e => { try { return e.composedPath().indexOf(host) >= 0; } catch (err) { return false; } };
      const coFile = e => { try { return [...(e.dataTransfer && e.dataTransfer.types || [])].indexOf('Files') >= 0; } catch (err) { return false; } };
      const dz = () => $('.drop');
      root.addEventListener('dragover', safe(e => { if (!trongBang(e) || !coFile(e)) { if (dz()) dz().classList.remove('keo'); return; } e.preventDefault(); e.stopImmediatePropagation(); if (dz()) dz().classList.add('keo'); }), true);
      root.addEventListener('drop', safe(e => { if (!trongBang(e) || !coFile(e)) return; e.preventDefault(); e.stopImmediatePropagation(); if (dz()) dz().classList.remove('keo'); switchTab('phong'); return themAnh(e.dataTransfer.files).then(n => { if (!n) setStatus('File vừa thả không phải ảnh.'); }); }), true);
      rootEl.addEventListener('paste', safe(e => { const fs = e.clipboardData && e.clipboardData.files; if (fs && fs.length && [...fs].some(f => /^image\//.test(f.type))) { e.preventDefault(); return themAnh(fs); } }));
      phong = phongStore.load() || Ph.macDinh();
      khoAnh.tat().then(ds => { for (const r of ds || []) if (r && r.blob) anh.push({ id: r.id, ten: r.ten || 'ảnh', url: URL.createObjectURL(r.blob) }); veAnh(); }).catch(() => {});
    }

    /* ---- sự kiện: ô nhập ---- */
    rootEl.addEventListener('input', safe(e => {
      const t = e.target;
      if (t.dataset.p) { if (t.tagName !== 'SELECT') phongInput(t); return; }      // thẻ Phòng (ô chọn xử lý ở 'change')
      if (t.dataset.lk) {      // bảng loại ngăn kéo
        const i = +t.closest('.lkr').dataset.li, x = spec.ngan_keo.loai[i]; if (!x) return;
        if (t.dataset.lk === 'md') { if (t.checked) spec.ngan_keo.mac_dinh = x.ma; }
        else if (t.dataset.lk === 'mau_id') x.mau_id = Math.max(0, Math.round(parseFloat(t.value) || 0));
        else if (t.dataset.lk === 'ts') x.ts = Core.parseTS(t.value);
        else x.ten = t.value;
        later();
      }
      else if (t.dataset.k) { setP(spec, t.dataset.k, t.type === 'checkbox' ? t.checked : t.value); if (t.dataset.k === 'hau.kieu') { setP(spec, 'hau.t', t.value === 'mong' ? 5 : t.value === 'day' ? getP(spec, 'van.t') : Core.DEFAULT_SPEC.hau.t); spec = Core.normalize(spec); renderSettings(); } later(); }
      else if (t.dataset.b) { readBay(t.closest('.bay')); later(); }
      else if (t.dataset.ui === 'doors') { showDoors = t.checked; paintView(); }
      else if (t.dataset.ui === 'kho-tim') laterKho();
      else if (t.dataset.ui === 'vl-tim') laterVL();
      else if (t.dataset.ui === 'vl-tudong') { mauS.tu_dong = !!t.checked; luuMau(); setStatus(mauS.tu_dong ? 'Đã bật: tủ và mẫu kho vẽ mới tự đổ màu theo 3 ô của thẻ Màu.' : 'Đã tắt tự đổ màu cho tủ vẽ mới.'); }
    }));
    // ô "Đợt": nhớ trạng thái lúc bắt đầu gõ để ngăn kéo / suốt treo đi theo đợt; rời ô thì ghi lại danh sách đã chuẩn hoá
    rootEl.addEventListener('focusin', safe(e => {
      const t = e.target;
      // thẻ Phòng: đang gõ ở dòng tường / cửa / cột nào thì tường đó sáng lên trên mặt bằng (để biết đang sửa cạnh nào của hình)
      if (t.dataset && t.dataset.p && phong && t.closest) {
        const ks = t.dataset.p.split('.'); let i = -1;
        if (ks[0] === 'tuong') i = +ks[1]; else if ((ks[0] === 'mo' || ks[0] === 'can' || ks[0] === 'khung' || ks[0] === 'dn') && phong[ks[0]] && phong[ks[0]][+ks[1]]) i = phong[ks[0]][+ks[1]].tuong;
        if (i >= 0 && i !== selTuong) { selTuong = i; paintPhong(); }
      }
      if (!t.dataset || t.dataset.b !== 'dot') return;
      const i = +t.closest('.bay').dataset.i, k = spec.khoang[i];
      dotSnap = k ? { i, dot: k.dot.slice(), o: clone(k.o || []), truoc: chup() } : null;
    }));
    rootEl.addEventListener('focusout', safe(e => {
      const t = e.target; if (!t.dataset || t.dataset.b !== 'dot') return;
      const truoc = dotSnap && dotSnap.truoc; dotSnap = null;
      clearTimeout(tmr); rebuild();
      if (truoc && truoc !== chup()) nho(truoc);
    }));
    function applyZ(inp) {
      if (!sel || sel.loai !== 'dot') return;
      const i = sel.khoang, j = sel.idx, cu = spec.khoang[i].dot[j], v = parseFloat(String(inp.value).replace(',', '.'));
      if (!isFinite(v)) { inp.value = fmt(cu); return; }
      const [lo, hi] = limits(i, j), z = Math.round(clamp(v, lo, hi) * 10) / 10, truoc = chup();
      if (moveDot(i, j, z)) { nho(truoc); rebuild(); } else inp.value = fmt(cu);
      if (Math.abs(z - v) > 0.05) setStatus(`Đợt này chỉ đặt được trong khoảng +${hien(lo)} … +${hien(hi)}.`);
    }
    function applyWL(inp) {
      if (!sel || sel.loai !== 'vach') return;
      const w = (model && model.info.khoang) || [], cu = w[sel.idx - 1], v = parseFloat(String(inp.value).replace(',', '.'));
      if (!isFinite(v)) { inp.value = fmt(cu); return; }
      const truoc = chup();
      if (doiVach(sel.idx, v)) { nho(truoc); renderBays(); rebuild(); } else inp.value = fmt(cu);
      const tong = cu + w[sel.idx];
      if (v < RONG_MIN - 0.05 || v > tong - RONG_MIN + 0.05) setStatus(`Vách này chỉ dời được để khoang trái lọt lòng ${hien(RONG_MIN)} … ${hien(tong - RONG_MIN)}.`);
    }
    rootEl.addEventListener('change', safe(e => {
      const t = e.target;
      if (t.dataset.ui === 'file' && t.files && t.files[0]) {
        t.files[0].text().then(txt => { try { const o = JSON.parse(txt), nc = Core.nangCap(o.spec || o, o.spec ? o.mncf : undefined); spec = Core.normalize(nc.spec); renderAll(); setStatus(['Đã mở mẫu tủ.'].concat(nc.doi).join(' ')); } catch (err) { setStatus('File không đọc được.'); } t.value = ''; }).catch(() => setStatus('File không đọc được.'));
      } else if (t.dataset.ui === 'phong-file' && t.files && t.files[0]) {
        t.files[0].text().then(txt => { const o = Ph.docMa(txt); if (o) { phong = o; selTuong = 0; selKhung = -1; gocKhac.clear(); phongStore.save(); renderPhong(); setStatus(`Đã mở phòng “${o.ten}”.`); } else setStatus('File không phải file phòng.'); t.value = ''; }).catch(() => setStatus('File không đọc được.'));
      } else if (t.dataset.ui === 'anh-file') { const fs = [...(t.files || [])]; t.value = ''; return themAnh(fs); }
      else if (t.dataset.p) { if (t.tagName === 'SELECT') phongInput(t); else if (/\.ten$/.test(t.dataset.p)) { phongStore.save(); renderPhong(); } }
      else if (t.dataset.ui === 'mau') capMau();
      else if (t.dataset.ui === 'kho-dir') { if (t.value) return khoDoiDir(t.value); }
      else if (t.dataset.ui === 'vl-nhom') { vl.loc = t.value; veDS(); }
      else if (t.dataset.ed === 'z') applyZ(t);
      else if (t.dataset.ed === 'wl') applyWL(t);
      else if (t.dataset.ed === 'loai') { const c = sel && sel.loai === 'o' ? cellFor(sel.khoang, sel.tu) : null; if (c && c.kieu && c.kieu !== 'suot') setCell(c, c.kieu, c.so, t.value); }
    }));
    rootEl.addEventListener('keydown', safe(e => {
      if (e.key === 'Escape' && xem && !xem.hidden) { e.preventDefault(); dongXem(); }
      else if (xem && !xem.hidden && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) { e.preventDefault(); buocXem(e.key === 'ArrowRight' ? 1 : -1); }
      else if (e.key === 'Enter' && e.target.dataset && e.target.dataset.ed === 'z') { e.preventDefault(); applyZ(e.target); }
      else if (e.key === 'Enter' && e.target.dataset && e.target.dataset.ed === 'wl') { e.preventDefault(); applyWL(e.target); }
      else if (e.key === 'Escape' && cheDoVach) { e.preventDefault(); datCheDoVach(false); setStatus(''); }
      else if (e.key === 'Escape' && veMD) { e.preventDefault(); datVeMD(false); setStatus('Đã thôi vẽ khung trên mặt đứng.'); }
      else if (e.key === 'Enter' && e.target.dataset && e.target.dataset.ui === 'kho-tim') { e.preventDefault(); clearTimeout(tmrKho); kho.tim = String(e.target.value).trim(); kho.trang = 1; veLuoi(); }
      else if (e.key === 'Enter' && e.target.dataset && e.target.dataset.ui === 'vl-tim') { e.preventDefault(); clearTimeout(tmrVL); vl.tim = String(e.target.value).trim(); veDS(); }
      else if (e.key === 'Escape' && moLoai) { e.preventDefault(); moLoai = false; renderBar(); }
      // Ctrl+Z ngoài ô nhập = lùi thao tác trên hình (trong ô nhập thì để trình duyệt lùi chữ đang gõ)
      else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && String(e.key).toLowerCase() === 'z' && !/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) { e.preventDefault(); lui(); }
    }));

    /* ---- sự kiện: hình đứng (kéo đợt, chọn ô / đợt, bàn phím) ---- */
    const svgScale = () => { const g = view.querySelector('svg'); if (!g) return null; const r = g.getBoundingClientRect(), vb = g.viewBox.baseVal; return r.height > 0 && vb.height > 0 ? { k: r.height / vb.height, top: r.top, y0: vb.y } : null; };
    const zAt = y => { const s = svgScale(); return s ? spec.cao - (s.y0 + (y - s.top) / s.k) : 0; };
    const xAt = x => { const g = view.querySelector('svg'); if (!g) return 0; const r = g.getBoundingClientRect(), vb = g.viewBox.baseVal; return r.width > 0 ? vb.x + (x - r.left) * vb.width / r.width : 0; };
    view.addEventListener('pointerdown', safe(e => {
      if (e.button || drag) return;
      const v = !cheDoVach && e.target.closest && e.target.closest('[data-vach]');
      if (v) {
        const idx = +v.dataset.vach, s = svgScale(), w = (model && model.info.khoang) || [];
        if (!s || !(w[idx - 1] > 0) || !(w[idx] > 0)) return;
        drag = { vach: idx, id: e.pointerId, x0: e.clientX, w0: w[idx - 1], k: s.k, moved: false };
        try { view.setPointerCapture(e.pointerId); } catch (err) { /* bỏ qua */ }
        return;
      }
      if (cheDoVach) return;
      const d = e.target.closest && e.target.closest('[data-dot]'); if (!d) return;
      const [i, j] = d.dataset.dot.split(':').map(Number), s = svgScale();
      if (!s || !spec.khoang[i] || spec.khoang[i].dot[j] === undefined) return;
      drag = { i, j, id: e.pointerId, y0: e.clientY, z0: spec.khoang[i].dot[j], k: s.k, moved: false };
      try { view.setPointerCapture(e.pointerId); } catch (err) { /* bỏ qua */ }
    }));
    // Màn hình cảm ứng: Chromium không áp dụng touch-action cho phần tử con của SVG (đã thử: vẫn cuộn trang rồi huỷ thao tác kéo),
    // nên chặn cuộn ngay từ touchstart khi ngón tay đặt lên một đợt; chạm chỗ khác trên hình thì trang vẫn cuộn bình thường.
    view.addEventListener('touchstart', safe(e => { if (e.cancelable && e.target.closest && e.target.closest('[data-dot],[data-vach]')) e.preventDefault(); }), { passive: false });
    // đưa đợt đang kéo tới vị trí con trỏ (bắt bước, chặn trong giới hạn); trả về true nếu hình đã vẽ lại
    function dragTo(y, x) {
      if (drag.vach) {      // kéo vách sang trái / phải
        if (!drag.moved && Math.abs(x - drag.x0) < 3) return false;
        if (!drag.moved) { drag.moved = true; view.classList.add('keov'); sel = { loai: 'vach', idx: drag.vach }; nho(); }
        if (!doiVach(drag.vach, Math.round((drag.w0 + (x - drag.x0) / drag.k) / BUOC_KEO) * BUOC_KEO)) return false;
        rebuild(true); return true;
      }
      if (!drag.moved && Math.abs(y - drag.y0) < 3) return false;      // rung tay khi bấm chưa tính là kéo
      if (!drag.moved) { drag.moved = true; view.classList.add('keo'); sel = { loai: 'dot', khoang: drag.i, idx: drag.j }; nho(); }
      const [lo, hi] = limits(drag.i, drag.j);
      const z = clamp(Math.round((drag.z0 + (drag.y0 - y) / drag.k) / BUOC_KEO) * BUOC_KEO, lo, hi);
      if (!moveDot(drag.i, drag.j, z)) return false;
      rebuild(true); return true;
    }
    view.addEventListener('pointermove', safe(e => { if (drag && e.pointerId === drag.id) dragTo(e.clientY, e.clientX); }));
    const endDrag = safe(e => {
      if (!drag || e.pointerId !== drag.id) return;
      if (e.type === 'pointerup') dragTo(e.clientY, e.clientX);      // màn hình cảm ứng có thể gộp mất lần di chuyển cuối: lấy vị trí lúc nhấc tay
      const d = drag; drag = null; view.classList.remove('keo'); view.classList.remove('keov');
      try { view.releasePointerCapture(e.pointerId); } catch (err) { /* bỏ qua */ }
      if (d.vach) { sel = { loai: 'vach', idx: d.vach }; dragEnd = Date.now(); if (d.moved) { renderBays(); rebuild(); } else { paintView(); renderBar(); } return; }
      sel = { loai: 'dot', khoang: d.i, idx: d.j };
      if (d.moved) { dragEnd = Date.now(); rebuild(); } else { paintView(); renderBar(); }
    });
    view.addEventListener('pointerup', endDrag); view.addEventListener('pointercancel', endDrag); view.addEventListener('lostpointercapture', endDrag);
    view.addEventListener('keydown', safe(e => {
      const key = e.key;
      if (key === 'Escape') { if (sel) { e.preventDefault(); sel = null; paintView(); renderBar(); } return; }
      if (!/^Arrow/.test(key) && key !== 'Delete' && key !== 'Backspace') return;
      e.preventDefault();
      if (sel && sel.loai === 'vach') {
        if (key === 'ArrowLeft' || key === 'ArrowRight') {
          const w = (model && model.info.khoang) || [], truoc = chup(), gop = nhich && nhich.v === sel.idx && Date.now() - nhich.t < 2500;
          if (doiVach(sel.idx, w[sel.idx - 1] + (e.shiftKey ? 10 : 1) * (key === 'ArrowRight' ? 1 : -1))) { if (!gop) nho(truoc); nhich = { v: sel.idx, t: Date.now() }; renderBays(); rebuild(); }
        } else if (key === 'Delete' || key === 'Backspace') xoaVach(sel.idx);
        return;
      }
      if (sel && sel.loai === 'dot') {
        const i = sel.khoang, j = sel.idx;
        if (key === 'ArrowUp' || key === 'ArrowDown') {
          const [lo, hi] = limits(i, j), truoc = chup(), gop = nhich && nhich.i === i && nhich.j === j && Date.now() - nhich.t < 2500;      // nhích liên tiếp cùng một đợt = 1 bước lùi
          if (moveDot(i, j, clamp(spec.khoang[i].dot[j] + (e.shiftKey ? 10 : 1) * (key === 'ArrowUp' ? 1 : -1), lo, hi))) { if (!gop) nho(truoc); nhich = { i, j, t: Date.now() }; rebuild(); }
        }
        else if (key === 'Delete' || key === 'Backspace') delDot(i, j);
        return;
      }
      const cur = sel ? cellFor(sel.khoang, sel.tu) : null;
      if (!cur) { const c = cellsOf(0)[0]; if (c && /^Arrow/.test(key)) selCell(c); return; }      // chưa chọn gì: mũi tên chọn ô đầu tiên
      if (key === 'Delete' || key === 'Backspace') { if (cur.kieu) setCell(cur, ''); return; }
      if (key === 'ArrowUp' || key === 'ArrowDown') { const cs = cellsOf(cur.khoang), c = cs[cs.indexOf(cur) + (key === 'ArrowUp' ? 1 : -1)]; if (c) selCell(c); return; }
      const cs = cellsOf(cur.khoang + (key === 'ArrowRight' ? 1 : -1)), mid = (cur.z0 + cur.z1) / 2;
      if (cs.length) selCell(cs.find(c => mid >= c.z0 - 20 && mid <= c.z1 + 20) || cs[0]);
    }));
    let rz = 0;
    root.addEventListener('resize', safe(() => { clearTimeout(rz); rz = setTimeout(safe(() => { if (model && !panel.hidden) { paintView(); if (Ph && !$('[data-pane="phong"]').hidden) paintPhong(); } }), 150); }));

    /* ---- sự kiện: bấm ---- */
    rootEl.addEventListener('click', safe(e => {
      // bảng chọn loại bằng hình đang mở mà bấm ra ngoài → đóng
      if (moLoai && !e.target.closest('.lpop,[data-ed="loai-hinh"]')) { moLoai = false; renderBar(); }
      // nút trên thanh sửa
      const ed = e.target.closest('[data-ed]');
      if (ed) {
        const a = ed.dataset.ed;
        if (sel && sel.loai === 'o') {
          const c = cellFor(sel.khoang, sel.tu); if (!c) return;
          if (a === 'kieu') setCell(c, ed.dataset.v, c.so);
          else if ((a === 'so-' || a === 'so+') && c.kieu && c.kieu !== 'suot') setCell(c, c.kieu, clamp(c.so + (a === 'so+' ? 1 : -1), 1, 12));
          else if (a === 'split') { if (addDot(c, (c.z0 + c.z1 - spec.van.t) / 2)) rebuild(); }
          else if (a === 'loai-hinh') { moLoai = !moLoai; renderBar(); }
          else if (a === 'loai-chon') { moLoai = false; barHTML = null; if (c.kieu && c.kieu !== 'suot') setCell(c, c.kieu, c.so, ed.dataset.v); else renderBar(); }
        } else if (sel && sel.loai === 'dot' && a === 'del') delDot(sel.khoang, sel.idx);
        else if (sel && sel.loai === 'vach' && a === 'del-vach') xoaVach(sel.idx);
        return;
      }
      // chế độ "＋ Vách": bấm vào đâu trong tủ thì thêm vách đứng tại đó
      if (cheDoVach && e.target.closest('.view')) {
        const x = xAt(e.clientX), xk = (model && model.info.x_khoang) || [], wk = (model && model.info.khoang) || [];
        let i = xk.findIndex((x0, j) => x >= x0 && x <= x0 + wk[j]);
        if (i < 0) { const o2 = e.target.closest('[data-o]'); if (o2) i = +o2.dataset.o.split(':')[0]; }
        if (i < 0) { setStatus('Bấm vào bên trong một khoang của tủ để đặt vách.'); return; }
        themVach(i, x);
        return;
      }
      if (e.target.closest('[data-vach]')) return;      // chọn vách đã làm ở pointerup
      // bấm vào ô trên hình: chọn ô; bấm đúp: thêm đợt tại chỗ bấm
      const o = e.target.closest('[data-o]');
      if (o) {
        if (Date.now() - dragEnd < 250) return;
        const [i, tu] = o.dataset.o.split(':').map(Number), c = cellFor(i, tu); if (!c) return;
        if (e.detail === 2) { if (addDot(c, zAt(e.clientY) - spec.van.t / 2)) rebuild(); }
        else if (!(sel && sel.loai === 'o' && sel.khoang === c.khoang && Math.abs(sel.tu - c.tu) < 0.6)) selCell(c);
        return;
      }
      // thẻ Phòng: bấm tường / khung trên mặt bằng, mặt đứng; bấm ảnh đang xem để phóng to
      const psu = e.target.closest('[data-sua]');
      if (psu) return suaDim(psu);
      const pdn = e.target.closest('[data-dn]');
      if (pdn) { const j = +pdn.dataset.dn, d = phong && phong.dn && phong.dn[j]; if (d) { selTuong = d.tuong; paintPhong(); const inp = $(`[data-p="dn.${j}.cach"]`); if (inp) { if (inp.scrollIntoView) inp.scrollIntoView({ block: 'nearest' }); inp.focus(); inp.select(); } } return; }
      const pk = e.target.closest('[data-khung]');
      if (pk) { selKhung = +pk.dataset.khung; const q = hinh && hinh.p.khung[selKhung]; if (q) selTuong = q.tuong; paintPhong(); const c = $(`.pcard[data-kj="${selKhung}"]`); if (c && c.scrollIntoView) c.scrollIntoView({ block: 'nearest' }); return; }
      const ptg = e.target.closest('[data-tuong]');
      if (ptg) { selTuong = +ptg.dataset.tuong; paintPhong(); return; }
      if (e.target.closest('.xemb')) { e.target.closest('.xemb').classList.toggle('to'); return; }
      const b = e.target.closest('[data-act],[data-tab],.launch'); if (!b) return;
      if (b.classList.contains('launch')) return open();
      if (b.dataset.tab) return switchTab(b.dataset.tab);
      const act = b.dataset.act;
      if (/^[tmckd]-(add|del)$/.test(act)) return phongAct(act, b);
      if (act === 'k-mo') { const m = moKhung(+b.closest('.pcard').dataset.kj); if (m) { switchTab('tu'); setStatus(`Đã mở khung ${m.q.ten} thành tủ ${hien(m.q.rong)} × ${hien(m.q.cao)}, sâu ${hien(m.q.sau)}. ${m.ghi.join(' ')}${inCF ? ` Ô “Đặt tại toạ độ” đã điền vị trí khung — bấm “Vẽ vào Chenfeng”${m.d.xoay ? `, tủ tự xoay ${hien(m.d.xoay)}° theo tường ${m.d.tuong}` : ''}.` : ''}`); } return; }
      if (act === 'k-ve') return veKhung(+b.closest('.pcard').dataset.kj);
      // bản 1.19: khung đặt mẫu kho, chia ô, vẽ khung trên mặt đứng, thẻ Kho mẫu
      if (act === 'k-kho') return khoChoKhung(+b.closest('.pcard').dataset.kj);
      if (act === 'k-ve-kho') return veKhoKhung(+b.closest('.pcard').dataset.kj);
      if (act === 'k-chia') { const c = b.closest('.pcard'), n = +(c.querySelector('[data-ui="k-chia-n"]') || {}).value || 2; return chiaO(+c.dataset.kj, n, b.dataset.v === 'ngang' ? 'ngang' : 'doc'); }
      if (act === 'k-ve-md') { datVeMD(!veMD); return setStatus(veMD ? `Kéo chuột trên mặt đứng tường ${hinh && hinh.tuong[selTuong] ? hinh.tuong[selTuong].ten : ''} để vẽ khung mới (từ góc này tới góc đối diện). Esc để thôi.` : ''); }
      if (act === 'kho-nhom') return khoNhom(b.dataset.v);
      if (act === 'kho-dir') return khoDoiDir(b.dataset.v);
      if (act === 'kho-chon') return khoChon(+b.dataset.v);
      if (act === 'kho-trang') { kho.trang = Math.max(1, kho.trang + (+b.dataset.v || 0)); return veLuoi(); }
      if (act === 'kho-lai') { if (!kho.dirs) return khoNap(); kho.nho.delete(kho.dir); return khoTai(); }
      if (act === 'kho-thoi') { kho.choKhung = -1; veChon(); switchTab('phong'); return; }
      if (act === 'kho-khung') return khoDung();
      if (act === 'kho-dat') return khoDat();
      if (act === 'kho-ve') return khoVeDiem();
      if (act === 'vl-o') { mauS.bat = b.dataset.v; luuMau(); veO(); return danhDauDS(); }
      if (act === 'vl-bo') { mauS.o[b.dataset.v] = null; luuMau(); veO(); return danhDauDS(); }
      if (act === 'vl-chon') return ganMau(vl.ds && vl.ds.find(m => m.id === b.dataset.v));
      if (act === 'vl-gan') return ganMau(mauS.gan[+b.dataset.v]);
      if (act === 'vl-do') return vlLam(vlDoTu);
      if (act === 'vl-tam') return vlLam(vlDoTam);
      if (act === 'vl-hoan') return vlLam(vlHoan);
      if (act === 'vl-thay') return vlLam(() => vlThay(b.dataset.v));
      if (act === 'vl-quet') { vlQuet(); return setStatus(vl.dung && vl.dung.length ? `Bản vẽ đang dùng ${vl.dung.filter(x => x.ten).length} màu — bấm vào một màu để chọn tấm hoặc thay.` : 'Bản vẽ chưa có tấm ván nào.'); }
      if (act === 'vl-tu') { vl.tu = b.dataset.v; return veDung(); }
      if (act === 'vl-xem') return vlXem();
      if (act === 'vl-lai') return vlNap(true);
      if (act === 'vl-het') { vl.het = true; return veDS(); }
      if (act === 'p-ve') return vePhong();
      if (act === 'p-hoantac') { if (!Drv || busy) return; setStatus('Đang hoàn tác phòng…'); return Drv.undoRoom().then(r => { setStatus(r.ok ? 'Đã bỏ phòng vừa vẽ khỏi bản vẽ.' : r.reason); if (r.ok) { $('.pkq').innerHTML = ''; b.disabled = true; } }); }
      if (act === 'anh-chon') return $('[data-ui="anh-file"]').click();
      if (act === 'anh-xem') return moXem(b.closest('.thumb').dataset.aid);
      if (act === 'anh-xoa') return xoaAnh(b.closest('.thumb').dataset.aid);
      if (act === 'xem-dong') return dongXem();
      if (act === 'xem-truoc' || act === 'xem-sau') return buocXem(act === 'xem-sau' ? 1 : -1);
      if (act === 'p-luu') return saveFile((Ph.chuanHoa(phong).ten || 'phong').replace(/[^\wÀ-ỹ\-]+/g, '_') + '_phong.json', JSON.stringify(Ph.chuanHoa(phong), null, 1), 'application/json', 'Đã lưu phòng — lần sau bấm “Mở phòng” để dùng lại.');
      if (act === 'p-mo') return $('[data-ui="phong-file"]').click();
      if (act === 'p-mau') { phong = Ph.macDinh(); selTuong = 0; selKhung = -1; gocKhac.clear(); phongStore.save(); renderPhong(); return setStatus('Đã về phòng mẫu 3600 × 3000.'); }
      if (act === 'p-dan') { const d = $('.pdan'); d.hidden = !d.hidden; if (!d.hidden) $('.pma').focus(); return; }
      if (act === 'p-dan-huy') { $('.pdan').hidden = true; return; }
      if (act === 'p-dan-ok') { const o = Ph.docMa($('.pma').value); if (!o) return setStatus('Không đọc được mã phòng — mã phải là JSON có danh sách "tuong".'); phong = o; selTuong = 0; selKhung = -1; gocKhac.clear(); phongStore.save(); renderPhong(); $('.pdan').hidden = true; $('.pma').value = ''; return setStatus(`Đã dùng mã phòng “${o.ten}” — soát lại từng số trên mặt bằng.`); }
      if (act === 'p-chep') { const txt = JSON.stringify(Ph.chuanHoa(phong)); const xong = () => setStatus('Đã chép mã phòng.'), hong = () => { const d = $('.pdan'); d.hidden = false; $('.pma').value = txt; $('.pma').focus(); $('.pma').select(); setStatus('Không chép tự động được — mã nằm trong ô bên dưới, bấm Ctrl+C.'); }; try { return root.navigator.clipboard.writeText(txt).then(xong, hong); } catch (err) { return hong(); } }
      if (act === 'close') close();
      else if (act === 'lui') lui();
      else if (act === 'them-vach') datCheDoVach(!cheDoVach);
      else if (act === 'lk-md') { const x = spec.ngan_keo.loai.find(q => q.ma === b.dataset.v); if (x) { spec.ngan_keo.mac_dinh = x.ma; rebuild(); renderSettings(); setStatus(`Loại ngăn kéo mặc định: ${x.ten}.`); } }
      else if (act === 'nap-kt') { const N = root.__MNCF_NAP__; if (N && N.kiemTra) { setStatus('Đang hỏi kho…'); N.kiemTra().then(r => setStatus(!r.ok ? 'Không vào được kho GitHub — đang dùng v' + Core.VERSION + '. Kiểm tra mạng rồi thử lại.' : r.co_moi ? 'Có bản mới v' + r.phien_ban + ' trên kho (' + r.nguon + ') — bấm F5 tải lại trang Chenfeng để dùng (nhớ lưu bản vẽ trước).' : 'Đang dùng bản mới nhất: v' + Core.VERSION + '.'), () => setStatus('Không kiểm tra được bản mới.')); } }
      else if (act === 'dich') { const Dc = root.MNCFDich; if (Dc) { if (Dc.dangBat) Dc.tat(); else Dc.bat(); b.textContent = Dc.dangBat ? 'Tắt dịch ghi chú' : 'Bật dịch ghi chú'; setStatus(Dc.dangBat ? 'Đã bật: ghi chú tham số mẫu hiện bằng tiếng Việt.' : 'Đã tắt: ghi chú tham số mẫu hiện chữ gốc.'); } }
      else if (act === 'wide') { wide = !wide; panel.classList.toggle('wide', wide); if (xem) xem.classList.toggle('rong', wide); b.textContent = wide ? 'Thu hẹp' : 'Mở rộng'; try { root.localStorage.setItem(LS_WIDE, wide ? '1' : '0'); } catch (err) { /* bỏ qua */ } paintView(); paintPhong(); }
      else if (act === 'mau') { const ma = $('[data-ui="mau"]').value, moi = Core.apMau(spec, ma); if (moi) { spec = moi; renderAll(); const m = Core.MAU_TU.find(x => x.ma === ma); setStatus(`Đã dùng mẫu "${m.ten}" — ${m.mo_ta}. Sửa tiếp kích thước, đợt, ngăn kéo tuỳ ý.`); } }
      else if (act === 'vach-cot') {
        const r = Core.vachTheoCot(spec);
        if (r.loi) return setStatus('Chưa đặt được vách theo mép cột: ' + r.loi);
        const truoc = chup(); spec = r.spec; sel = null; nho(truoc); renderBays(); rebuild();
        setStatus(r.doi.length ? `Đã đặt vách theo mép cột: ${r.doi.join('; ')}. Khoang trước cột là khoang nông, các tấm cắt thẳng.` : 'Hai vách đã trùng hai mép cột sẵn rồi.');
      }
      else if (act === 'add') { spec.khoang.push({ rong: 'auto', canh: 2, dot: [], o: [] }); sel = null; hist = []; capNut(); renderBays(); rebuild(); }
      else if (act === 'del') { spec.khoang.splice(+b.closest('.bay').dataset.i, 1); sel = null; hist = []; capNut(); renderBays(); rebuild(); }
      else if (act === 'reset') { const keep = clone(spec); spec = Core.normalize(Object.assign(keep, { rong: Core.DEFAULT_SPEC.rong, cao: Core.DEFAULT_SPEC.cao, sau_thung: Core.DEFAULT_SPEC.sau_thung, khoang: clone(Core.DEFAULT_SPEC.khoang), than: clone(Core.DEFAULT_SPEC.than), chan: clone(Core.DEFAULT_SPEC.chan), phao: Object.assign({}, keep.phao, { trai: 50, phai: 50, tren: 50 }) })); renderAll(); }
      else if (act === 'lk-add') { let n = 1; while (spec.ngan_keo.loai.some(x => x.ma === 'rieng' + n)) n++; spec.ngan_keo.loai.push({ ma: 'rieng' + n, ten: 'Loại mới ' + n, mau_id: 0, ten_mau: '', ts: {} }); renderSettings(); rebuild(); const inp = $(`#${fid('lk' + (spec.ngan_keo.loai.length - 1) + '-ten')}`); if (inp) { inp.focus(); inp.select(); } }
      else if (act === 'lk-del') { const i = +b.closest('.lkr').dataset.li; if (spec.ngan_keo.loai.length <= 1) return setStatus('Phải giữ lại ít nhất một loại ngăn kéo.'); spec.ngan_keo.loai.splice(i, 1); rebuild(); renderSettings(); }
      else if (act === 'lk-do') {
        if (!Drv || !Drv.available() || busy) return;
        setStatus('Đang đọc kho mẫu của tài khoản Chenfeng…');
        return Drv.drawerTemplates().then(r => { const k = mergeLoai(r.mau); rebuild(); renderSettings(); setStatus(`Thư mục ${r.thu_muc} có ${r.mau.length} mẫu — cập nhật mã cho ${k.capNhat} loại, thêm ${k.them} loại mới.`); });
      }
      else if (act === 'defaults') { spec = Core.normalize(Object.assign(clone(Core.DEFAULT_SPEC), { rong: spec.rong, cao: spec.cao, sau_thung: spec.sau_thung, khoang: spec.khoang, than: spec.than, chan: spec.chan })); renderAll(); switchTab('chuan'); }
      else if (act === 'json') { if (model && !model.errors.length) return saveFile(fileBase() + '_chenfeng.json', JSON.stringify(Core.toChenfeng(model).json), 'application/json', 'Đã tải file JSON — kéo thả vào cửa sổ Chenfeng, rồi bấm 1 điểm để đặt.'); }
      else if (act === 'csv') { if (model && !model.errors.length) return saveFile(fileBase() + '_bang_ke.csv', Core.cutListCSV(model), 'text/csv;charset=utf-8', 'Đã tải bảng kê tấm (CSV, mở bằng Excel).'); }
      else if (act === 'save') return saveFile(fileBase() + '_mau_tu.json', JSON.stringify({ mncf: Core.VERSION, spec }, null, 1), 'application/json', 'Đã lưu mẫu tủ — lần sau bấm "Mở mẫu" để dùng lại.');
      else if (act === 'open') $('[data-ui="file"]').click();
      else if (act === 'draw') return draw();
      else if (act === 'redraw') return redraw();
      else if (act === 'pick') return pick();
      else if (act === 'dat') return datBangChuot();
      else if (act === 'hinh') return theoHinh(false);
      else if (act === 'hinh-truoc') return theoHinh(true);
      else if (act === 'hinh-bo') { khungCho = null; capHinh(); setStatus('Đã bỏ hình — bảng trở lại đặt tủ theo điểm bấm / toạ độ.'); }
      else if (act === 'chuanhoa') return chuanHoa();
      else if (act === 'undo-ch') { if (Drv && !busy) { const coDV = b.dataset.dv === '1'; setStatus('Đang hoàn tác…'); return Drv.undoChuanHoa().then(r => (r.ok && coDV && Drv.undoDayVan ? Drv.undoDayVan().then(d => (d.ok ? r : { ok: true, luu_y: d.reason })) : r)).then(r => { if (r.ok) { setStatus('Đã hoàn tác lần chuẩn hoá vừa rồi.'); $('.report').innerHTML = `<p class="hint">Đã hoàn tác lần chuẩn hoá vừa rồi — module trở lại kết cấu gốc của mẫu${r.luu_y ? ` (riêng dày ván chưa trả lại: ${esc(r.luu_y)})` : ''}.</p>`; } else setStatus(r.reason); }); } }
      else if (act === 'undo-dv') { if (Drv && !busy && Drv.undoDayVan) { setStatus('Đang hoàn tác…'); return Drv.undoDayVan().then(r => { if (r.ok) { setStatus('Đã trả dày ván của module về như mẫu.'); $('.report').innerHTML = '<p class="hint">Đã trả dày ván của module về như mẫu gốc.</p>'; } else setStatus(r.reason); }); } }
      else if (act === 'unlink') { noi = null; rebuild(); setStatus('Đã bỏ nối — bấm “Vẽ vào Chenfeng” sẽ vẽ một tủ mới.'); }
      else if (act === 'undo') { if (Drv && lastRep && !busy) { const laKho = !!lastRep.kho, kv = lastRep.khung_ve; setStatus('Đang hoàn tác…'); return Drv.undoLast().then(r => { if (r.ok) { setStatus('Đã hoàn tác lần vẽ vừa rồi.'); $('.report').innerHTML = '<p class="hint">Đã hoàn tác lần vẽ vừa rồi.</p>'; lastRep = null; if (laKho) { if (kv && phong && phong.khung[kv.j] && phong.khung[kv.j].ten === kv.ten && /^kho-/.test(phong.khung[kv.j].tu_id || '')) { delete phong.khung[kv.j].tu_id; phongStore.save(); paintPhong(); } return; } noi = null; const rd = $('[data-act="redraw"]'); if (rd) rd.disabled = true; capNoi(); } else setStatus(r.reason); }); } }
      else if (act === 'zoom') { if (Drv) Drv.zoom(); }
      else if (act === 'doloi') return doLoi();
      else if (act === 'xuatvan') return xuatVan('');
      else if (act === 'xuatvan-van') return xuatVan('van');
      else if (act === 'xuatvan-lai') return xuatVan('lai');
    }));

    function capMau() { const m = Core.MAU_TU.find(x => x.ma === $('[data-ui="mau"]').value), el = $('[data-ui="mau-mota"]'); if (el) el.textContent = m ? `${m.rong} × ${m.cao}${m.cao_duoi ? '' : ' (một thân)'} — ${m.mo_ta}` : ''; }
    function renderAll() {
      sel = null; hist = []; nhich = null; capNut();
      $$('[data-k]').forEach(i => { if (i.closest('.settings')) return; i.value = fmt(getP(spec, i.dataset.k)); });
      renderBays(); renderSettings(); rebuild();
    }
    (inCF ? document.documentElement : document.body).appendChild(host);
    renderAll(); capMau();
    if (coMau) { veO(); veGan(); veDung(); }
    if (Ph) renderPhong();
    if (daLuu.doi.length) setStatus(daLuu.doi.join(' '));
    // phông chữ tải xong có thể làm thanh sửa đổi chiều cao → tính lại cỡ hình một lần
    try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(safe(() => { if (model && !panel.hidden) paintView(); })).catch(() => {}); } catch (e) { /* bỏ qua */ }

    return { host, open, close, toggle: () => (panel.hidden ? open() : close()), getSpec: () => clone(spec), setSpec: s => { spec = Core.normalize(s); renderAll(); return clone(spec); }, getModel: () => model, draw, switchTab, rebuild: () => rebuild(),
      // thẻ Phòng — cũng là chỗ để app hiện trạng (sx.motnha.vn) nối vào sau: đặt phòng, thêm ảnh
      getPhong: () => (Ph ? Ph.chuanHoa(phong) : null), setPhong: p => { if (!Ph) return null; const o = Ph.docMa(p); if (!o) return null; phong = o; selTuong = 0; selKhung = -1; gocKhac.clear(); phongStore.save(); renderPhong(); return Ph.chuanHoa(phong); },
      themAnh: files => themAnh(files), moKhung, veKhung, chuanHoa };
  }

  /* ---- khởi động ---- */
  const API = root.MNCF = root.MNCF || {};
  Object.assign(API, { version: Core.VERSION, core: Core, driver: Drv, app: null,
    build: s => Core.build(s === undefined && API.app ? API.app.getSpec() : s),
    draw: (s, opt) => Drv.draw(s === undefined && API.app ? API.app.getSpec() : s, opt),
    open: () => API.app && API.app.open(), close: () => API.app && API.app.close(),
    phong: { lay: () => API.app && API.app.getPhong(), dat: p => API.app && API.app.setPhong(p), themAnh: f => API.app && API.app.themAnh(f), core: Ph } });

  function boot() {
    if (API.app || root.__MNCF_BOOTING__) return; root.__MNCF_BOOTING__ = true;
    const page = document.documentElement.hasAttribute('data-mncf-page');
    if (page) { try { API.app = App('page'); } catch (e) { document.body.textContent = 'Lỗi khởi động: ' + (e && e.message || e); } return; }
    if (!/(^|\.)cfcad\.(cn|com)$/.test(location.hostname) || /^\/help/.test(location.pathname)) return;
    const tryMount = () => { if (API.app) return true; try { if (Drv && Drv.available()) { API.app = App('panel'); return true; } } catch (e) { try { console.warn('[Một Nhà · Vẽ tủ] không khởi động được bảng:', e); } catch (e2) { /* bỏ qua */ } return true; } return false; };
    if (!tryMount()) { const iv = setInterval(() => { if (tryMount()) clearInterval(iv); }, 1500); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof self !== 'undefined' ? self : this);

}).call(typeof self !== 'undefined' ? self : this);
