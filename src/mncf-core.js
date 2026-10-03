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

  const VERSION = '1.19.0';
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
   * DỰNG TỦ
   * ------------------------------------------------------------------ */
  function build(specIn) {
    const s = normalize(specIn);
    const M = { version: VERSION, spec: s, parts: [], templates: [], mat_ngan_keo: [], errors: [], warnings: [], notes: [], info: {} };
    const err = m => M.errors.push(m), warn = m => M.warnings.push(m), note = m => M.notes.push(m);

    const W = s.rong, H = s.cao, D = s.sau_thung, t = s.van.t, tc = s.van.t_canh;
    const pL = s.phao.trai, pR = s.phao.phai, pT = s.phao.tren, aux = s.phao.phu_tro, chan = s.chan.cao;
    const phu = s.hau.kieu === 'phu', thin = s.hau.kieu === 'mong', th = s.hau.t;
    const khe = s.canh.khe, kb = s.canh.khe_bien;
    const n = s.khoang.length;
    const NM = s.ten_tam, KT = s.khoan.thung, KP = s.khoan.phao;

    if (!(W > 0 && H > 0 && D > 0)) { err('Rộng, cao, sâu thùng phải lớn hơn 0.'); return M; }
    if (!(t > 0 && tc > 0 && th > 0)) { err('Độ dày ván phải lớn hơn 0.'); return M; }
    if (n < 1) { err('Tủ phải có ít nhất 1 khoang.'); return M; }

    const X0 = pL, X1 = W - pR, Ztop = H - pT;
    if (X1 - X0 < 2 * t + 50) { err('Bề rộng còn lại sau khi trừ phào quá nhỏ.'); return M; }

    /* ---- chia thân theo chiều cao ---- */
    const zd = s.than.cao_duoi;
    const bodies = tinhThan(s);
    if (bodies.length === 1 && zd > 0 && zd < Ztop - TOL) warn(`Thân trên chỉ cao ${g(Ztop - zd)} (< 150) nên gộp thành một thân cao ${g(Ztop)}.`);
    const twoBody = bodies.length === 2;
    for (const b of bodies) {
      if (b.z1 - b.z0 > s.van.kho_dai + TOL) err(`Thân ${b.code === 'D' ? 'dưới' : 'trên'} cao ${g(b.z1 - b.z0)} > khổ ván ${g(s.van.kho_dai)}: hồi không cắt được. Giảm "cao thân dưới" hoặc chia thêm thân.`);
      if (b.zt - b.zb < 100) err(`Thân ${b.code === 'D' ? 'dưới' : 'trên'} quá thấp (lọt lòng ${g(b.zt - b.zb)}).`);
    }
    const lower = bodies[0];
    if (chan > 0 && chan < 30) warn(`Chân tủ chỉ cao ${g(chan)}.`);

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
    if (chia.ghi) note(chia.ghi);
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
    if (M.info.thung.length > 1) note(`Tủ tách ${M.info.thung.length} thùng (mỗi thùng rộng không quá ${g(s.thung.rong_max)}): ${M.info.thung.map(q => `${g(q.rong)} (khoang ${q.khoang[0] === q.khoang[1] ? q.khoang[0] + 1 : (q.khoang[0] + 1) + '–' + (q.khoang[1] + 1)})`).join(' + ')}. Chỗ tách là 2 hồi áp lưng; phào và chân trước là khung chung.`);
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
    if (phu && t - s.hau.mep < 8) err(`Hậu phủ: mép hậu lùi vào ${g(s.hau.mep)} thì hậu chỉ còn gối ${g(t - s.hau.mep)} mm lên mép sau của hồi (cần ≥ 8) — giảm số "mép lùi" ở Chuẩn xưởng → Hậu.`);

    /* ---- khấu cột (bản 1.13: cột ở góc sau; bản 1.14: thêm cột GIỮA tủ) ----
     * K = { ben, xa, xb, yCot, Dn, mat }: vùng cột (đã cộng khe hở) chiếm xa < x < xb, y > yCot. Cột góc trái: xa = −∞; cột góc phải: xb = +∞; cột giữa: cả hai hữu hạn.
     * Mỗi mặt bên hữu hạn của vùng cột có một VÁCH KHẤU (dày t) đứng ngay NGOÀI vùng cột: mặt xa → xa−t … xa; mặt xb → xb … xb+t; y từ Dn tới Dc (mép sau thùng chính), cao suốt thân như hồi.
     * Vách / hồi nào có mặt trùng mặt cột thì chính nó là vách khấu (không thêm tấm): K.coA / K.coB.
     * HẬU KHẤU (tấm trước mặt cột) là ván thùng dày t, đứng lọt giữa 2 tấm đứng hai bên vùng cột (vách khấu / vách sẵn có; cột góc: hồi ngoài và vách khấu), y từ Dn = yCot − t tới yCot,
     * cao từ mặt dưới đáy tới đỉnh thân. Nóc / đáy / đợt / vách nằm trong vùng cột kết thúc ở Dn (đâm vào mặt trước hậu khấu); riêng hồi ngoài ở cột góc chạy tới yCot để kẹp hậu khấu. */
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
    const nk = s.ngan_keo;
    const vungTrum = [];      // vùng mặt ngăn kéo trùm ngoài: cánh phải tránh ra {khoang, b, f0, f1}
    // loại ngăn kéo của một ô: loại ô chọn → loại mặc định → loại đầu danh sách
    const loaiNK = ma => nk.loai.find(x => x.ma === ma) || nk.loai.find(x => x.ma === nk.mac_dinh) || nk.loai[0] || null;
    const daBao = new Set();
    // tham số gửi cho mẫu: BH + tham số riêng của loại ('mat' → cao mặt) + phần mặt nhô ra do lõi tính
    const thamSo = (lo, bh, mat, nho) => { const o = { BH: bh }; for (const k of Object.keys(lo.ts)) o[k] = lo.ts[k] === 'mat' ? mat : lo.ts[k]; return Object.assign(o, nho); };
    // hộp ngăn kéo (không kể mặt) cao bao nhiêu với mặt cao `mat`: mẫu để hộp thấp hơn mép trên mặt SLK, cao hơn mép dưới mặt XLK
    const hopCao = (lo, mat) => ('CMG' in lo.ts ? Infinity : mat - (typeof lo.ts.SLK === 'number' ? lo.ts.SLK : 0) - (typeof lo.ts.XLK === 'number' ? lo.ts.XLK : 0));
    if (cells.some(c => c.kieu === 'suot') && !s.suot.mau_id) warn('Chưa khai mã mẫu suốt treo (Chuẩn xưởng → Suốt treo): suốt treo sẽ không được vẽ.');
    for (const c of cells) {
      if (!c.kieu) continue;
      const i = c.khoang, k = s.khoang[i], za = c.z0, zb = c.z1, cao = zb - za, m = c.so;
      const shelfDepth = sauKhoang[i];      // khoang dính vùng khấu cột: ngăn kéo / vách đệm / suốt treo chỉ sâu tới phần nông
      const viTri = `Khoang ${i + 1}, ô +${g(za)} … +${g(zb)}`;
      const lo = c.kieu === 'suot' ? null : loaiNK(c.loai);
      if (c.kieu !== 'suot') {
        if (!lo) { if (!daBao.has('')) { daBao.add(''); err('Chưa có loại ngăn kéo nào (Chuẩn xưởng → Các loại ngăn kéo).'); } continue; }
        if (!lo.mau_id && !daBao.has(lo.ma)) { daBao.add(lo.ma); warn(`Chưa khai mã mẫu ngăn kéo cho loại "${lo.ten}" (Chuẩn xưởng → Các loại ngăn kéo): ngăn kéo loại này sẽ không được vẽ.`); }
      }
      if (c.kieu === 'suot') {
        if (cao < s.suot.cach_dot + 60) { err(`${viTri}: khoảng treo chỉ cao ${g(cao)} — không đủ chỗ treo suốt.`); continue; }
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
      if (fx1 - fx0 > 1200) warn(`${viTri}: mặt ngăn kéo rộng ${g(fx1 - fx0)} (> 1200) — nên chia khoang nhỏ hơn.`);
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

    checks(M);
    M.info.hop = bbox(M.parts);
    M.info.so_tam = M.parts.length;
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

  function checks(M) {
    const s = M.spec, parts = M.parts;
    // khổ ván
    for (const p of parts) {
      const c = cutSize(p);
      if (c.dai > s.van.kho_dai + TOL) M.errors.push(`${p.ten} (${p.tu}) dài ${g(c.dai)} > khổ ván ${g(s.van.kho_dai)}.`);
      if (c.rong > s.van.kho_rong + TOL) M.errors.push(p.phu
        ? `${p.ten} (${p.tu}) rộng ${g(c.rong)} > khổ ván ${g(s.van.kho_rong)} — khoang quá rộng, không có vách để nối hậu: thêm vách (chia khoang nhỏ hơn).`
        : `${p.ten} (${p.tu}) rộng ${g(c.rong)} > khổ ván ${g(s.van.kho_rong)} — phải chia khoang nhỏ hơn.`);
      if (Math.abs(c.day - p.t) > TOL) M.errors.push(`${p.ten}: cạnh nhỏ nhất ${g(c.day)} khác độ dày ${g(p.t)} (tấm quá hẹp).`);
    }
    // va chạm (hậu mỏng ăn rãnh vào tấm bên cạnh là đúng cấu tạo)
    let n = 0;
    for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
      const a = parts[i], b = parts[j];
      const coRanh = q => q.holes && q.holes.some(h => h.kieu === 'ranh');
      if ((a.mong && coRanh(b)) || (b.mong && coRanh(a))) continue;
      const v = overlap(a, b);
      if (v > 0) { n++; if (n <= 8) M.errors.push(`Va chạm: ${a.ten} (${a.tu}) × ${b.ten} (${b.tu}) — ${Math.round(v)} mm³.`); }
    }
    if (n > 8) M.errors.push(`… và ${n - 8} va chạm khác.`);
    // phủ bì
    const bb = bbox(parts);
    if (bb) {
      if (Math.abs(bb.x0) > TOL || Math.abs(bb.x1 - s.rong) > TOL) M.warnings.push(`Bề ngang thực tế ${g(bb.x0)}…${g(bb.x1)} khác phủ bì ${g(s.rong)}.`);
      if (Math.abs(bb.z1 - s.cao) > TOL) M.warnings.push(`Chiều cao thực tế ${g(bb.z1)} khác phủ bì ${g(s.cao)}.`);
    }
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

  return { VERSION, DEFAULT_SPEC, KHONG_KHOAN, KHOA_TU, NHOM, MAU_CHU_GIAI, MAU_TU, apMau, heSo, specDaVe, normalize, build, toChenfeng, cutList, cutListCSV, elevationSVG, summary, expectedBoxes, bbox, cutSize, overlap, parseDot, parseTS, tsText, merge, nangCap, KIEU_HAU, vachTheoCot, dinhKhoet, keHoachGoc, bieuThucTT, khoangMong };
});
