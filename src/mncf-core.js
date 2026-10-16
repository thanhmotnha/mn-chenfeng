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

  const VERSION = '1.36.4';
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
  // Ruột tủ mặc định 1.3 – 1.36.3 (trước khi anh Thanh đổi tủ mặc định 16/10/2026) — nangCap dùng cho thông số bản cũ thiếu khoá khoang.
  const KHOANG_MAC_DINH_CU = [
    { rong: 'auto', canh: 2, dot: [1800], o: [{ tu: 0, kieu: 'suot' }] },
    { rong: 'auto', canh: 2, dot: [520, 1800], o: [{ tu: 0, kieu: 'nk_am', so: 2 }, { tu: 520, kieu: 'suot' }] },
    { rong: 'auto', canh: 2, dot: [400, 750, 1100, 1450, 1800], o: [] },
  ];
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
      t: 6.5,                  // dày hậu (bỏ trống thì theo kiểu: phủ 6,5, soi rãnh 6,5, dày lọt lòng = dày ván thùng) — bản 1.29.2, anh Thanh 08/10/2026: xưởng chỉ có ván mỏng 6,5, không có 6 hay 5
      mep: 1,                  // (hậu phủ) mép hậu lùi vào so với mép ngoài của thùng, để hậu không lòi ra khỏi hồi / nóc
      chia: 'khoang',          // (hậu phủ) chia tấm: 'khoang' = mỗi khoang 1 tấm | 'kho_van' = gộp các khoang liền nhau cho tới khi vừa khổ ván (ít tấm nhất). Mối nối luôn nằm trên mép sau của vách.
      lui: 20,                 // (hậu soi rãnh) mặt sau tấm hậu cách mép sau thùng
      ranh_sau: 6,             // (hậu soi rãnh) hậu ăn vào rãnh mỗi phía
      ranh_ho: 0.5,            // (hậu soi rãnh) rãnh rộng hơn dày hậu
      ten_van: '', vat_lieu: '', mau: '',      // tên ván / vật liệu / màu của tấm hậu ghi vào Chenfeng (bỏ trống = như ván thùng)
    },
    phao: { trai: 50, phai: 50, tren: 50, phu_tro: 80, noi: 'moi_vach' },   // 0 = không có phào phía đó; phu_tro = bề rộng thanh phụ trợ sau phào
    chan: { cao: 100 },        // cao chân = cao xà chân trước (phào dưới); 0 = không chân. Anh Jason 02/10/2026: mặc định 100 (hoặc 80), không phải 50
    than: { cao_duoi: 2150 },  // cao thân dưới tính từ sàn; 0 = một thân. (1.36.4 — anh Thanh 16/10/2026, ảnh tủ 3000 × 2800: thân dưới 2150 + thân trên 600; trước 2200)
    // Tách thùng theo bề ngang (anh Jason 03/10/2026: "khổ ván 2 m thường sẽ tách thùng, thùng bé thì kẹp khung chung"):
    //   thùng nào rộng quá rong_max thì tách thành các thùng riêng, mỗi thùng có 2 hồi của nó (chỗ tách = 2 hồi áp lưng);
    //   các khoang nhỏ liền nhau còn nằm trong rong_max thì vẫn chung một thùng (vách chung). Phào, chân trước là khung chung cho cả dãy. 0 = không tách.
    // Kết cấu nóc / đáy (bản 1.31 — anh Thanh 08/10/2026: "chuyển sang kết cấu nóc, đáy phủ hồi nhé, kết cấu này không chuẩn lắp đặt, rất yếu"; rồi: "nhưng phải vẽ đúng theo của Chenfeng"):
    //   'phu_hoi' = nóc, đáy LIỀN cả thùng, phủ lên đầu hồi; hồi + vách kẹp giữa nóc và đáy; thân có chân thì đáy nằm trên KHUNG ĐẾ (đế trước, đế sau, 2 đế hông — mỗi thùng một khung);
    //   'lot'     = cách cũ: hồi + vách cao suốt thân (hồi thân dưới chạy xuống sàn), nóc / đáy lọt giữa từng khoang — vẽ được bằng LỆNH GỐC.
    //   Mặc định vẫn 'lot' cho tới khi đo xong lệnh nóc / đáy "bọc hồi" của Chenfeng (nút Đo ở thẻ Hướng dẫn) để phủ hồi cũng vẽ bằng lệnh gốc.
    thung: { rong_max: 2000, noc_day: 'lot' },
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
    // Bản lề (bản 1.30 — anh Thanh 08/10/2026: "tìm bản lề Kolity K53 và bản lề Imundex thép của An Cường cho vào, số bản lề theo tiêu chuẩn"):
    //   loai_ban_le = mã trong LOAI_BAN_LE (khác khoang[i].ban_le = bản lề bên trái / phải của khoang 1 cánh) — chọn loại thì sâu chén / K lấy theo loại (chen.sau, chen.tam_mep = K + Ø/2), dày cánh ngoài khoảng cho phép thì cảnh báo;
    //   số bản lề mỗi cánh theo chiều cao (≤ 900: 2 · ≤ 1600: 3 · ≤ 2000: 4 · còn lại: 5) + 1 khi cánh rộng hơn 600 (Blum, Hettich, Häfele và các xưởng VN cùng mốc);
    //   bản lề đầu / cuối cách đầu cánh `cach_dau` (tâm chén), các bản lề giữa chia đều; tránh đợt cố định (đế bản lề trên hồi cấn đợt). Vùng hộc kéo âm có vách đệm 50 không cấn (bản 1.30.1).
    //   chen_ban_le: có thì khoét chén Ø35 vào cánh khi xuất sang Chenfeng (thử nghiệm); không thì chỉ vẽ vị trí + kê số bản lề.
    canh: { khe: 2, khe_bien: 1, loai_ban_le: 'k53', chen_ban_le: false, chen: { d: 35, sau: 12, tam_mep: 21.5, cach_dau: 100 } },
    // Mỗi khoang: dot = cao độ MẶT DƯỚI từng đợt (tính từ sàn). Các đợt chia khoang thành các ô; o = nội dung ô:
    //   { tu: cao độ mặt dưới của đợt nằm ngay dưới ô (0 = ô sát đáy), kieu: 'nk_am' | 'nk_trum' | 'suot', so: số ngăn kéo, loai: mã loại ngăn kéo (bỏ trống = loại mặc định) }
    // (định dạng cũ ngan_keo: {so, den} và suot: z vẫn nhận, normalize tự đổi)
    // (1.36.4 — anh Thanh 16/10/2026, ảnh tủ 3000 × 2800: "layout tủ ntn nhé") tủ mặc định = K1 hai tầng treo · K2 2 ngăn kéo âm + treo dài · K3 hai tầng treo
    //   Trước: K1 treo dài dưới đợt +1800 · K2 2 ngăn kéo + treo · K3 6 đợt đều.
    //   Số đợt theo ảnh số THẬT anh đang dùng (ảnh 2, 16/10/2026): K1 / K3 đợt +1130 (suốt trong ô +117,5 → 1130 và +1147,5 → 2132,5), K2 đợt +595
    //   (2 ngăn kéo âm ray bi 3 tầng đáy mỏng = loại mặc định + suốt trên) — KHÁC ruột thư viện RUOT.hai_tang_treo (1150) / RUOT.nk_treo (570): các mẫu tủ khác giữ nguyên.
    khoang: [
      { rong: 'auto', canh: 2, dot: [1130], o: [{ tu: 0, kieu: 'suot' }, { tu: 1130, kieu: 'suot' }] },
      { rong: 'auto', canh: 2, dot: [595], o: [{ tu: 0, kieu: 'nk_am', so: 2 }, { tu: 595, kieu: 'suot' }] },
      { rong: 'auto', canh: 2, dot: [1130], o: [{ tu: 0, kieu: 'suot' }, { tu: 1130, kieu: 'suot' }] },
    ],
    // dem: ngăn kéo âm nằm sau cánh mở phải tránh bản lề — ở mỗi bên có bản lề đặt 1 vách đệm, mặt trong vách đệm cách hồi/vách `dem` (khe còn lại dem − dày ván là chỗ cho bản lề); 0 = không đệm
    // Từ bản 1.5 (anh Jason, 02/10/2026: "hở thế này không đúng kết cấu gỗ công nghiệp, ngăn kéo vát phải có xà đỡ"): hộc ngăn kéo âm là một KHUNG kín —
    //   xa_cao  = cao xà ngang (ván đứng) đặt SAU khe trên mỗi mặt ngăn kéo: xà trên sát mặt dưới đợt + xà giữa 2 ngăn; 0 = không làm xà
    //   xa_ho   = mặt trước xà cách lưng mặt ngăn kéo (chỗ luồn tay vào cạnh vát)
    //   nep_khe = 1: có nẹp đứng che khe giữa hồi/vách và vách đệm, ngang mặt ngăn kéo (bắn đinh); 0 = để hở
    //   Bản 1.28 (anh Thanh 06/10/2026: "đang lộ hồi tấm rất xấu phải có xà che" — chọn kiểu B): nẹp rộng ra che LUÔN cạnh trước của vách đệm (rộng = dem, mặt nẹp phẳng mặt ngăn kéo),
    //   vách đệm lùi ra sau nẹp (mép trước = lưng mặt ngăn kéo). Mặt trước chỉ còn: cạnh hồi · nẹp · khe · mặt ngăn kéo. nep_khe = 0 thì vách đệm vẫn ra ngang mặt ngăn kéo như cũ.
    //   Bản 1.31 (anh Thanh 08/10/2026, ảnh mẫu: "ngăn kéo kết cấu như này mới đẹp"): KHUNG MẶT — khung_mat = 1: thanh ngang phẳng mặt ngăn kéo, cao `ray`:
    //   thanh trên chạy suốt bề ngang khoang ngay dưới đợt (nẹp hai bên dừng dưới nó), thanh giữa nằm giữa 2 nẹp; mặt ngăn kéo lọt trong ô, khe quanh mặt = khe_ben
    //   (dưới cùng = khe_duoi). Có khung mặt thì không làm xà ẩn sau khe (thanh ngang đã giằng). khung_mat = 0: như cũ (khe_tren / khe_giua + xà ẩn).
    ngan_keo: {
      lui: 30, dem: 50, khe_tren: 22.5, khe_giua: 22, khe_duoi: 2, khe_ben: 2, buoc_sau: 50, ho_sau: 5, xa_cao: 60, xa_ho: 2, nep_khe: 1, khung_mat: 1, ray: 50,
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
      vach_khau: 'Vách khấu cột', hau_khau: 'Hậu khấu cột', de: 'Đế',
    },
    ve_goc: true,              // (bản 1.15) vẽ bằng LỆNH GỐC của Chenfeng: hồi / vách / nóc đáy / hậu / đợt / cánh là tấm tự động trong cây mẫu gốc, sửa được như tủ vẽ tay; false = cách cũ (nhập tấm rồi gom module L / W / H)
    module_cf: true,           // vẽ xong gom tủ thành module tham số gốc của Chenfeng (sửa Rộng / Sâu / Cao ngay ở ô Thông số của Chenfeng)
    lam_tron: 1,               // làm tròn bề rộng lọt lòng khoang khi tự chia (mm)
  };

  const KHONG_KHOAN = '不排';
  /** Tên ô ghi chú (备注) mà tiện ích gắn vào từng tấm nó vẽ: giá trị = mã của lần vẽ tủ đó → sau này chọn 1 tấm là tìm lại được cả tủ để sửa. */
  const KHOA_TU = 'MNCF';
  /** Ghi chú mang mã tủ (bản 1.29.2 — anh Thanh 08/10/2026: trang sản xuất in "K1-TĐáy29A99WHS", khó chọn): mã nằm ở TÊN ghi chú ("MNCF 29A99WHS"), nội dung để rỗng — trang sản xuất chỉ nối NỘI DUNG vào tên tấm.
   *  Bản ≤ 1.29.1 ghi [KHOA_TU, mã] (mã ở nội dung) — đọc vẫn nhận cả hai dạng (`maTuCuaGhiChu`). */
  const nhanTu = id => `${KHOA_TU} ${id}`;
  function maTuCuaGhiChu(remarks) {
    if (!Array.isArray(remarks)) return '';
    for (const r of remarks) {
      if (!r) continue;
      const ten = String(r[0] == null ? '' : r[0]);
      if (ten === KHOA_TU) return String(r[1] == null ? '' : r[1]);
      if (ten.indexOf(KHOA_TU + ' ') === 0) return ten.slice(KHOA_TU.length + 1).trim();
    }
    return '';
  }
  const KIEU_HAU = ['phu', 'day', 'mong'];
  /** Các loại bản lề chén Ø35 xưởng dùng (bản 1.30). Số liệu tra ngày 08/10/2026 — `nguon` ghi chỗ lấy; `k` (mép cánh → mép lỗ chén) của cả hai hãng CHƯA có tài liệu chính hãng:
   *  Imundex: đại lý ghi "thường 4", Kolity: hãng ghi chỉnh trùm 0–5 → lấy 4 cho cả hai, cần xưởng xác nhận khi khoan thử. Đế cả hai: chữ thập 37 / 32 (hàng lỗ hệ 32 cách mép trước 37). */
  const LOAI_BAN_LE = [
    { ma: 'k53', ten: 'Kolity K53 (giảm chấn, cài, chỉnh 3D)', d: 35, sau: 12, k: 4, day: [15, 25], goc: 105, nguon: 'Kolity (Bolt & Beam, đại lý Singapore): chén Ø35 sâu 12, cánh 15–25, mở 103–105°' },
    { ma: 'imundex', ten: 'Imundex thép 105° (An Cường)', d: 35, sau: 11.5, k: 4, day: [14, 22], goc: 105, nguon: 'imundex.vn + đại lý An Cường: chén Ø35 sâu 11,5, cánh 14–22, mở 105°, đế 37 × 32' },
    // (1.33) tủ bếp: phụ kiện CHỈ Higold / Eurogold (anh Thanh 12/10/2026) — số chén CHƯA có tài liệu chính hãng, lấy như hai loại trên [CĐ]
    { ma: 'hg_eg', ten: 'Higold / Eurogold giảm chấn [CĐ]', d: 35, sau: 12, k: 4, day: [14, 22], goc: 105, bep: true, nguon: '[CĐ] Higold / Eurogold chén Ø35 — chưa có catalogue chính hãng; sâu 12, K 4 lấy như Kolity / Imundex, xưởng đo khi khoan thử' },
    { ma: 'tu_chon', ten: 'Tự gõ số', d: 35, sau: 12, k: 4, day: [0, 99], goc: 0, nguon: '' },
  ];
  /** Loại bản lề ghi vào bảng kê / lời báo: tủ bếp chọn hãng ngoài Higold / Eurogold ở Chuẩn xưởng (chuẩn của tủ áo, không đổi) thì kê theo loại Higold / Eurogold. */
  // (1.33.1) tủ bếp tay nắm ẤN MỞ: bản lề loại KHÔNG giảm chấn (giảm chấn đẩy cánh đóng lại — bộ nhấn mở không bật cánh ra được) — không vào ô Loại bản lề của Chuẩn xưởng
  const BL_AN_MO = Object.assign({}, LOAI_BAN_LE.find(l => l.bep), { ma: 'hg_eg_tn', ten: 'Higold / Eurogold không giảm chấn (cho ấn mở) [CĐ]', nguon: '[CĐ] Higold / Eurogold chén Ø35 loại không giảm chấn, dùng với bộ nhấn mở — số chén lấy như loại giảm chấn' });
  const banLeDung = s => {
    let lb = LOAI_BAN_LE.find(l => l.ma === s.canh.loai_ban_le);
    if (s.bep && lb && lb.ma !== 'tu_chon' && !lb.bep) lb = LOAI_BAN_LE.find(l => l.bep);
    return s.bep && s.bep.tay_nam === 'an_mo' && lb && lb.ma !== 'tu_chon' ? BL_AN_MO : lb;
  };
  /** Số bản lề + toạ độ tâm (tính từ mép DƯỚI cánh) cho một cánh cao `cao`, rộng `rong` (bản 1.30, hàm thuần).
   *  Số: cao ≤ 900 → 2, ≤ 1600 → 3, ≤ 2000 → 4, còn lại 5; rộng > 600 thêm 1. Bản lề đầu / cuối cách đầu cánh `cach_dau` (cánh thấp: cao / 4), giữa chia đều.
   *  tranh = [[a, b]…] khoảng (từ mép dưới cánh) chén không được chạm (đợt cố định, đã nới thêm cho đế bản lề): bản lề chạm thì dời ra phía gần hơn (cách mép vùng 5), rồi các bản lề
   *  không bị dời chia đều lại giữa các bản lề đã chốt. Không xếp được (chồng nhau / vẫn chạm vùng) → ket = true để báo.
   *  @returns {{ so: number, z: number[], ket: boolean }} */
  function banLeCanh(cao, rong, opt) {
    opt = opt || {};
    const r = num(opt.r, 17.5), tranh = [], GAP = 2 * r + 10;
    // (1.31.1) gộp vùng chỉ khi khe giữa hai vùng không lọt nổi một chén (< 2r) — khe lọt chén thì bản lề vẫn đứng được ở đó (trước: < 2r + 10, gộp oan rồi dời bản lề đè lên đáy)
    for (const v of (opt.tranh || []).filter(v => v && v[1] > v[0]).map(v => [v[0], v[1]]).sort((p, q) => p[0] - q[0])) {
      const cu = tranh[tranh.length - 1];
      if (cu && v[0] - cu[1] < 2 * r - TOL) cu[1] = Math.max(cu[1], v[1]); else tranh.push(v);
    }
    let so = cao <= 900 ? 2 : cao <= 1600 ? 3 : cao <= 2000 ? 4 : 5;
    if (rong > 600) so++;
    const dau = Math.max(r, Math.min(num(opt.cach_dau, 100), cao / 4));      // tâm chén không ra ngoài cánh dù gõ "cách đầu cánh" ≤ 0
    while (so > 2 && (cao - 2 * dau) / (so - 1) < GAP) so--;      // (1.31.1) cánh thấp: không nhồi quá số bản lề lọt chỗ (hai chén cách nhau ≥ 2r + 10), ít nhất 2
    const z = []; for (let q = 0; q < so; q++) z.push(rn(dau + q * (cao - 2 * dau) / (so - 1)));
    const cham = v => tranh.some(([a, b]) => v + r > a + TOL && v - r < b - TOL);      // chạm đúng mép vùng (số lẻ sau phép trừ) không tính
    // (1.31.1) chỗ trống cho TÂM chén: [r, cao − r] trừ (a − r, b + r) của từng vùng. Dời bản lề vào điểm trống gần nhất (cách mép chỗ trống 5 khi chỗ đủ rộng) —
    // kể cả khe giữa hai vùng chỉ vừa lọt chén (trước: chỉ thử b + r + 5 / a − r − 5 nên khe 2r … 2r + 10 bị bỏ qua)
    const TRONG = []; { let lo = r; for (const [a, b] of tranh) { if (a - r > lo + TOL) TRONG.push([lo, Math.min(a - r, cao - r)]); lo = Math.max(lo, b + r); } if (cao - r > lo + TOL) TRONG.push([lo, cao - r]); }
    const gan = (v, lb, ub, le = 5) => { let tot = null; for (const [u0, u1] of TRONG) { let lo = u0, hi = u1; if (hi - lo > 2 * le) { lo += le; hi -= le; } if (lb !== undefined) lo = Math.max(lo, lb); if (ub !== undefined) hi = Math.min(hi, ub); if (lo > hi + TOL) continue; const c = Math.min(Math.max(v, lo), hi); if (tot === null || Math.abs(c - v) < Math.abs(tot - v)) tot = c; } return tot; };
    const raNgoai = v => gan(v);
    if (tranh.length) {
      const chot = new Set([0, so - 1]);
      for (let q = 0; q < so; q++) if (cham(z[q])) {
        const m = raNgoai(z[q]); if (m === null) continue;
        const trung = [...chot].some(k => k !== q && !cham(z[k]) && Math.abs(z[k] - m) < GAP);
        if (!trung) { z[q] = rn(m); chot.add(q); }
        else if (q === 0 || q === so - 1) z[q] = rn(m);      // đầu / cuối trùng chỗ bản lề đã chốt: vẫn ra khỏi vùng, chia lại sẽ tách ra
      }
      const P = [...chot].sort((a, b) => a - b);
      for (let i = 0; i + 1 < P.length; i++) { const a = P[i], b = P[i + 1]; for (let q = a + 1; q < b; q++) z[q] = rn(z[a] + (q - a) * (z[b] - z[a]) / (b - a)); }
      for (let q = 0; q < so; q++) if (!chot.has(q) && cham(z[q])) { const m = raNgoai(z[q]); if (m !== null) z[q] = rn(m); }
      z.sort((a, b) => a - b);
    }
    // (1.31.1) còn chạm vùng hoặc hai bản lề sát nhau (< 2r + 10): dàn lại — từ dưới lên, mỗi bản lề ở chỗ trống gần chỗ cũ nhất mà cách bản lề dưới ≥ 2r + 10; không được thì từ trên xuống
    const hong = a => a.some(cham) || a.some((v, q) => q && v - a[q - 1] < GAP - TOL);
    if (hong(z)) {
      const len = le => { const o = []; for (let q = 0; q < so; q++) { const lb = q ? o[q - 1] + GAP : undefined, c = gan(lb === undefined ? z[q] : Math.max(z[q], lb), lb, undefined, le); if (c === null) return null; o.push(rn(c)); } return o; };
      const xuong = le => { const o = []; for (let q = so - 1; q >= 0; q--) { const ub = q < so - 1 ? o[0] - GAP : undefined, c = gan(ub === undefined ? z[q] : Math.min(z[q], ub), undefined, ub, le); if (c === null) return null; o.unshift(rn(c)); } return o; };
      // chừa lề 5 trong chỗ trống trước; chỗ trống chỉ vừa (vd 45 – 55 cho 2 chén) thì bỏ lề
      for (const thu of [() => len(5), () => xuong(5), () => len(0), () => xuong(0)]) { const a = thu(); if (a && !hong(a)) { z.splice(0, so, ...a); break; } }
    }
    let ket = z.some(v => cham(v) || v < r - TOL || v > cao - r + TOL);
    for (let q = 1; q < so; q++) if (z[q] - z[q - 1] < GAP - TOL) ket = true;      // cùng ngưỡng với hong() (cách đúng 2r + 10 mà trừ số lẻ ra 44,999… thì vẫn hợp lệ)
    return { so, z, ket, vung: tranh.length > 0 };
  }
  const DE_BL = 50;      // (bản 1.30) chiều cao đế bản lề chữ thập (lấy dư) — vùng đế không được đè lên đợt cố định
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
  const TB_HOC = ['tl', 'lo', 'vs'], NM_MU = 'Tấm che mù';      // (bản 1.34) thiết bị của ô hốc: tủ lạnh, lò nướng, vi sóng
  const TEN_KIEU = { nk_am: 'ngăn kéo âm', nk_trum: 'ngăn kéo trùm ngoài', suot: 'suốt treo', keo_pk: 'mặt kéo rổ', hoc: 'hốc thiết bị' };      // keo_pk (bản 1.33): chỉ tủ bếp — mặt kéo bắt thẳng vào rổ phụ kiện; hoc (bản 1.34): chỉ tủ bếp — hốc tủ lạnh / lò / vi sóng (không cánh)

  /** Các thân theo chiều cao (thân dưới + thân kịch trần khi tủ cao hơn khổ ván). Hàm thuần, dùng chung cho normalize và build. */
  function tinhThan(s) {
    // (bản 1.34.1) táp: gờ chắn → đỉnh thân (mặt trên nóc) thấp hơn phủ bì `go` (hồi + gờ sau nhô lên); chân gỗ rời → thân bắt đầu ở cao chân
    const TP = s.loai_sp === 'tap' && s.tap ? s.tap : null, z00 = TP ? TP.chan_go : 0;
    const t = s.van.t, Ztop = s.cao - s.phao.tren - (TP ? TP.go : 0), zd = s.than.cao_duoi, chan = s.chan.cao;
    const bodies = [];
    if (zd > 0 && Ztop - zd >= 150) { bodies.push({ code: 'D', z0: z00, z1: zd, chan }); bodies.push({ code: 'T', z0: zd, z1: Ztop, chan: 0 }); }
    else bodies.push({ code: 'D', z0: z00, z1: Ztop, chan });
    for (const b of bodies) { b.tu = bodies.length === 2 ? `${s.ma}-${b.code}` : s.ma; b.zb = b.z0 + b.chan + t; b.zt = b.z1 - t; }
    return bodies;
  }
  const NHOM = { DG: 'Giường', DUG: 'Giường', HG: 'Giường', THH: 'Giường', TH: 'Khung giường', DA: 'Khung giường', DEB: 'Khung giường', PH: 'Phản giường', MNK: 'Ngăn kéo giường', TNK: 'Ngăn kéo giường', HNK: 'Ngăn kéo giường', DNK: 'Ngăn kéo giường', OP: 'Tấm ốp', XU: 'Xương vách', DE: 'Thùng', GO: 'Thùng', HOI: 'Thùng', VACH: 'Thùng', DAY: 'Thùng', NOC: 'Thùng', DOT: 'Thùng', DEM: 'Thùng', XA: 'Thùng', NEP: 'Thùng', HAU: 'Hậu', CHAN: 'Chân trước', PHAO: 'Phào mặt', PHU: 'Phụ trợ phào', CANH: 'Cánh', GIANG: 'Thùng', TREO: 'Thùng', MKP: 'Cánh', LOT: 'Thùng', MU: 'Cánh' };      // MU (bản 1.34): tấm che mù tủ góc — ván + màu như cánh      // GIANG / TREO / MKP: tủ bếp (bản 1.33) — giằng, thanh treo tủ trên, mặt kéo rổ

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
      s.hau.t = num(hIn.t, s.hau.kieu === 'day' ? s.van.t : DEFAULT_SPEC.hau.t);      // phủ sau và soi rãnh đều dùng ván mỏng 6,5 của xưởng
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
    s.thung.noc_day = s.thung.noc_day === 'phu_hoi' || s.thung.noc_day === 'lot' ? s.thung.noc_day : DEFAULT_SPEC.thung.noc_day;
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
    s.canh.loai_ban_le = LOAI_BAN_LE.some(l => l.ma === s.canh.loai_ban_le) ? s.canh.loai_ban_le : DEFAULT_SPEC.canh.loai_ban_le;
    { // chọn loại (không phải "tự gõ") → sâu chén / tâm chén theo loại; "tự gõ" giữ số người dùng
      const lb = LOAI_BAN_LE.find(l => l.ma === s.canh.loai_ban_le), c0 = s.canh.chen = s.canh.chen && typeof s.canh.chen === 'object' ? s.canh.chen : {};
      if (lb.ma !== 'tu_chon') { c0.d = lb.d; c0.sau = lb.sau; c0.tam_mep = rn(lb.k + lb.d / 2); }
    }
    for (const k of Object.keys(DEFAULT_SPEC.canh.chen)) s.canh.chen[k] = num(s.canh.chen[k], DEFAULT_SPEC.canh.chen[k]);
    for (const k of ['lui', 'dem', 'khe_tren', 'khe_giua', 'khe_duoi', 'khe_ben', 'buoc_sau', 'ho_sau', 'xa_cao', 'xa_ho', 'ray']) s.ngan_keo[k] = num(s.ngan_keo[k], DEFAULT_SPEC.ngan_keo[k]);
    s.ngan_keo.ray = Math.max(0, s.ngan_keo.ray);
    { const v = s.ngan_keo.khung_mat; s.ngan_keo.khung_mat = v === undefined || v === null || v === '' ? DEFAULT_SPEC.ngan_keo.khung_mat : (v === 0 || v === '0' || v === false || v === 'false') ? 0 : 1; }
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
    // (bản 1.34.1) khoá riêng của táp (gờ chắn, nóc phủ, chân gỗ, tay nắm…): chỉ táp có, chuẩn hoá TRƯỚC tinhThan (gờ / chân gỗ đổi thân); táp cũ không có khoá → dựng như 1.32
    if (s.loai_sp === 'tap' && s.tap && typeof s.tap === 'object') normTap(s); else delete s.tap;
    const lower = tinhThan(s)[0], laBep = s.loai_sp === 'bep';
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
        if (!c || !TEN_KIEU[c.kieu] || ((c.kieu === 'keo_pk' || c.kieu === 'hoc') && !laBep)) continue;
        const e = { tu: Math.max(0, num(c.tu, 0)), kieu: c.kieu };
        if (c.kieu === 'hoc') {
          // (bản 1.34) hốc thiết bị: tb = tủ lạnh / lò / vi sóng; hau = có hậu sau hốc (mặc định không); san = hốc chạy xuống sàn (không đáy, không xà chân — khoang tủ lạnh), chỉ ô sát đáy
          e.tb = TB_HOC.indexOf(c.tb) >= 0 ? c.tb : 'tl'; e.hau = c.hau === true; e.san = c.san === true && e.tu === 0;
          noi.push(e); continue;
        }
        if (c.kieu === 'keo_pk') {
          // (bản 1.33) mặt kéo rổ: pk = các mã phụ kiện kéo, xếp từ TRÊN xuống (cùng chiều với `cao`); mỗi mã một mặt
          let pk = (Array.isArray(c.pk) ? c.pk : [c.pk]).map(v => String(v == null ? '' : v)).filter(m => LOAI_PK_BEP.some(q => q.ma === m && (q.lap === 'keo' || q.lap === 'canh' || q.lap === 'goc'))).slice(0, 4);
          // rổ cánh mở chiếm cả ô (cánh che cả ô, không chia mặt) → ô chỉ giữ mã đó
          const mc = pk.find(m => LOAI_PK_BEP.some(q => q.ma === m && (q.lap === 'canh' || q.lap === 'goc'))); if (mc) pk = [mc];
          if (!pk.length) continue;
          e.pk = pk; e.so = pk.length;
        } else if (c.kieu !== 'suot') {
          e.so = Math.max(1, Math.min(12, Math.round(num(c.so, 1))));
          if (c.loai !== undefined && c.loai !== null && s.ngan_keo.loai.some(x => x.ma === String(c.loai))) e.loai = String(c.loai);      // loại lạ / bỏ trống = loại mặc định
        }
        // (bản 1.33, chỉ tủ bếp) cao các mặt tính từ TRÊN xuống (mặt nông 180 dưới mặt đá); mặt còn lại chia đều như cũ — tối đa so − 1 số, mỗi số ≥ 60
        if (laBep && (c.kieu === 'nk_trum' || c.kieu === 'keo_pk') && Array.isArray(c.cao)) { const a = c.cao.map(v => num(v, NaN)).filter(v => isFinite(v) && v >= 60).slice(0, e.so - 1).map(v => rn(v, 1)); if (a.length) e.cao = a; }
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
      // (bản 1.34, chỉ tủ bếp) tấm che mù của tủ góc: ben = phía mù; rong = che từ mép module tới đó (khoang có cánh), bỏ trống = che cả mặt khoang (khoang không cánh)
      if (laBep && o.mu && typeof o.mu === 'object') { const r = num(o.mu.rong, 0); o.mu = Object.assign({ ben: o.mu.ben === 'phai' ? 'phai' : 'trai' }, r > 0 ? { rong: rn(r, 1) } : {}); } else delete o.mu;
      o.dot = [...new Set(dots.map(z => rn(z, 1)))].sort((a, b) => a - b);
      o.o = noi;
      return o;
    });
    // (bản 1.32) loại sản phẩm: thiếu / lạ = tủ áo (thông số tủ cũ giữ nguyên, không thêm khoá); giường / vách có khối thông số riêng, vẽ bằng nhập tấm
    // khối thông số của loại khác bỏ đi (đổi giường → tủ không mang theo s.giuong vào ghi chú của tủ)
    { const l = LOAI_SP.indexOf(s.loai_sp) > 0 ? s.loai_sp : ''; if (l) s.loai_sp = l; else delete s.loai_sp; if (l === 'giuong') normGiuong(s); else delete s.giuong; if (l === 'vach') normVach(s); else delete s.vach; if (l === 'bep') normBep(s); else delete s.bep; }
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
    const muc = (M.muc_kiem || MUC_KIEM).concat(ds.some(k => k.ma === 'khac') ? [{ ma: 'khac', ten: 'Khác' }] : []).map(c => {
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
    if (s.loai_sp === 'giuong') return buildGiuong(s);      // (bản 1.32) giường / vách đầu giường: bộ dựng riêng, cùng hợp đồng M
    if (s.loai_sp === 'vach') return buildVach(s);
    // kq = mọi dòng báo kèm MÃ MỤC kiểm (xem MUC_KIEM) — để lập phiếu kiểm: mục nào đạt, mục nào lưu ý, mục nào lỗi. errors / warnings / notes vẫn là chuỗi như cũ.
    const M = { version: VERSION, spec: s, parts: [], templates: [], mat_ngan_keo: [], errors: [], warnings: [], notes: [], kq: [], info: {} };
    const bao = baoCua(M), err = bao.err, warn = bao.warn, note = bao.note;
    // (bản 1.33) tủ bếp: cùng bộ dựng tủ, rẽ nhánh theo s.bep (xà chân lùi, giằng thay nóc, không hậu, thanh treo, mặt kéo rổ). B = null thì mọi nhánh như cũ.
    const B = s.loai_sp === 'bep' ? s.bep : null;
    const khongHau = !!B && (B.chuc_nang === 'chau' || B.chuc_nang === 'hm');      // tủ chậu (ống nước, ẩm) và tủ hút mùi (ống khói ra tường) không hậu
    if (B) M.muc_kiem = MUC_KIEM_BEP;
    // (bản 1.34.1) táp kiểu mới (s.tap): gờ chắn, nóc / đáy phủ hồi, nóc chồm, ngăn kéo lọt lòng phẳng mặt hồi + thanh ngang, xà đế lùi, chân gỗ, tay nắm. null = như cũ
    const TP = s.loai_sp === 'tap' && s.tap ? s.tap : null;

    const W = s.rong, H = s.cao, D = s.sau_thung, t = s.van.t, tc = s.van.t_canh;
    const pL = s.phao.trai, pR = s.phao.phai, pT = s.phao.tren, aux = s.phao.phu_tro, chan = s.chan.cao;
    // (1.36.2) táp kiểu mới: hậu soi rãnh lọt lòng bất kể Chuẩn xưởng (hauCua) — hậu phủ của tủ áo lòi cạnh lên đỉnh gờ / ra hông táp
    const HK = hauCua(s), phu = HK.kieu === 'phu', thin = HK.kieu === 'mong', th = HK.t;
    const khe = s.canh.khe, kb = s.canh.khe_bien;
    const n = s.khoang.length;
    const NM = s.ten_tam, KT = s.khoan.thung, KP = s.khoan.phao;
    // (bản 1.34) ô HỐC thiết bị của tủ bếp (tủ lạnh / lò / vi sóng): hốc chạy xuống sàn (khoang tủ lạnh) → khoang đó không đáy, không xà chân, máy đứng sàn;
    // hốc không hậu → hậu chia đoạn, bỏ đoạn sau hốc. catHau(i) = các đoạn [đợt dưới, đợt trên] (mặt dưới đợt; null = tới đáy / nóc) của hốc không hậu.
    const hocO = i => (B ? (s.khoang[i].o || []).filter(c => c.kieu === 'hoc') : []);
    const sanK = s.khoang.map((k, i) => hocO(i).some(c => c.san));
    const catHau = i => hocO(i).filter(c => !c.hau).map(c => { const zT = (s.khoang[i].dot || []).find(z => z > c.tu + TOL); return [c.tu > 0 ? c.tu : null, zT === undefined ? null : zT]; });
    const doanZ = (a, b2, cuts) => {      // [a, b2] trừ các khoảng cắt → các đoạn còn lại (bỏ đoạn vụn < 50)
      let ds = [[a, b2]];
      for (const [lo, hi] of cuts) { const r = []; for (const [u, v] of ds) { if (hi <= u + TOL || lo >= v - TOL) { r.push([u, v]); continue; } if (lo > u + TOL) r.push([u, lo]); if (hi < v - TOL) r.push([hi, v]); } ds = r; }
      return ds.filter(([u, v]) => v - u >= 50 - TOL).map(([u, v]) => [rn(u), rn(v)]);
    };

    bao.muc('kich_thuoc');
    if (!(W > 0 && H > 0 && D > 0)) { err('Rộng, cao, sâu thùng phải lớn hơn 0.'); return M; }
    if (!(t > 0 && tc > 0 && th > 0)) { err('Độ dày ván phải lớn hơn 0.'); return M; }
    if (n < 1) { err('Tủ phải có ít nhất 1 khoang.'); return M; }

    // (soát 1.34.1) bên nào có phào thì phào thay phần đua bên đó: hồi áp phụ trợ phào như tủ, nóc chồm chạy tới phào (trước: hồi lùi thêm `dua`, phụ trợ phào hở 20 không bắt vào đâu)
    const duaL = TP && !(pL > 0) ? TP.dua : 0, duaR = TP && !(pR > 0) ? TP.dua : 0;
    const X0 = pL + duaL, X1 = W - pR - duaR, Ztop = H - pT - (TP ? TP.go : 0);      // (1.34.1) táp nóc chồm: hồi lùi vào `dua`; gờ chắn: thân thấp hơn phủ bì
    if (X1 - X0 < 2 * t + 50) { err('Bề rộng còn lại sau khi trừ phào quá nhỏ.'); return M; }

    /* ---- chia thân theo chiều cao ---- */
    bao.muc('than');
    const zd = s.than.cao_duoi;
    const bodies = tinhThan(s);
    if (bodies.length === 1 && zd > 0 && zd < Ztop - TOL) warn(`Thân trên chỉ cao ${g(Ztop - zd)} (< 150) nên gộp thành một thân cao ${g(Ztop)}.`);
    const twoBody = bodies.length === 2;
    // (soát 1.34.1) táp kiểu mới (s.tap) có nóc / đáy của riêng nó (tap.noc / tap.day: gờ chắn cần nóc LỌT, xà đế lùi không kèm khung đế) → Chuẩn xưởng phủ hồi không áp
    const phuHoi = s.thung.noc_day === 'phu_hoi' && !s.bep && !TP;
    if (HK.tap && s.hau.kieu !== 'mong') note('Táp: hậu soi rãnh lọt lòng (hậu nằm gọn trong rãnh hồi / nóc / đáy, không lộ cạnh) — Chuẩn xưởng hậu của tủ áo không áp cho táp.', 'hau');
    if (HK.tap_cot) note(`Táp có khấu cột: hậu theo Chuẩn xưởng (${{ phu: 'hậu phủ sau lưng', day: 'hậu dày lọt lòng', mong: 'hậu mỏng soi rãnh' }[s.hau.kieu] || s.hau.kieu}) — khấu cột hiện chỉ dựng với hậu phủ, chưa làm với hậu soi rãnh lọt lòng của táp.`, 'hau');
    if (TP && s.thung.noc_day === 'phu_hoi') note('Táp: nóc / đáy theo kiểu của mẫu táp — Chuẩn xưởng "nóc, đáy phủ hồi" không áp cho táp.', 'than');      // (bản 1.31) nóc, đáy phủ hồi: hồi / vách kẹp giữa nóc và đáy — (1.33) tủ bếp luôn hồi xuống sàn, nóc / đáy lọt (chuẩn xưởng của tủ áo giữ nguyên)
    for (const b of bodies) {
      const dHoi = phuHoi ? b.zt - b.zb : b.z1 - b.z0;
      if (dHoi > s.van.kho_dai + TOL) err(`Thân ${b.code === 'D' ? 'dưới' : 'trên'}: hồi dài ${g(dHoi)} > khổ ván ${g(s.van.kho_dai)} — hồi không cắt được. ${s.bep ? 'Giảm Cao của tủ (hoặc Cao mặt đá / Cách mặt đá / Cao tủ trên ở ô Tủ bếp) cho hồi ≤ khổ ván.' : 'Giảm "cao thân dưới" hoặc chia thêm thân.'}`);
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
    const DL = pL > 0 ? pL + khe : X0 + kb;
    const DR = pR > 0 ? W - pR - khe : X1 - kb;

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
    // (1.36.4 — anh Thanh 16/10/2026, ảnh Chenfeng: thanh ngang trên khung mặt hộc kéo âm có lỗ cam / chốt ở MẶT TRƯỚC — "lỗ cam chốt hở ra ngoài rất xấu")
    // Tấm ĐỨNG (type 2) của thùng mà mặt trước LỘ ra ngoài (thanh khung mặt, xà ẩn sau khe, xà đứng / xà đế táp, xà chân / chân trước, giằng trước, gờ sau táp):
    // FrontDrill tắt, BackDrill bật → lỗ cam / chốt vào mặt TRONG. Căn cứ: hậu dày lọt lòng đã dùng fd false / bd true để giấu lỗ (type 2: Front = mặt y nhỏ, nhìn từ
    // ngoài). CHƯA ĐO trên Chenfeng thật FrontDrill của tấm type 2 đúng là mặt y nhỏ — anh vẽ thử hộc kéo âm rồi xem lỗ đã vào mặt trong chưa. Tấm khuất sau cánh
    // (vách đệm…) không cần. `giau_lo` = dấu cho bảng kê / phép thử biết tấm nào được giấu lỗ.
    const GIAU_LO = { fd: false, bd: true, giau_lo: true };
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
    const Dc = phu && !khongHau ? rn(D - th) : D;              // chiều sâu các tấm thùng (hồi, vách, đáy, nóc) — tủ bếp không hậu: thùng sâu trọn
    const gS = thin ? s.hau.ranh_sau : 0;
    const yb1 = thin ? D - s.hau.lui : D, yb0 = khongHau ? D : rn(yb1 - th);  // mặt trước / sau tấm hậu
    const yG = phu ? Dc : yb0;                                  // (bản 1.33) mặt trước tấm hậu (không hậu: mép sau thùng) — giằng sau / thanh treo áp vào đây
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
    /* Bản 1.23 (anh Jason 04/10/2026 23:02: "khấu cột giữa thì phải cân đối khoang tủ … thường khấu sẽ nằm trong khoang tủ, không can thiệp bổ sung các đợt ngang hay dọc"):
     * KHÔNG dời, KHÔNG thêm vách của tủ vì cột. Mép vùng khấu rơi vào chỗ không dựng được (giữa bề dày một vách, vách khấu quá sát vách của khoang) thì vùng khấu tự NỚI ra xa cột
     * tới vị trí dựng được gần nhất — khe quanh cột chỗ đó rộng hơn, nằm khuất sau hậu khấu:
     *   (A) trùng mặt một cụm tấm đứng quay về phía cột → tấm đó làm vách khấu;
     *   (B) nằm trong một khoang: vách khấu cách tấm đứng phía cột ≥ TRONG_MIN, sau vách khấu còn ≥ CON_MIN tới tấm đứng kế.
     * Cột giữa dính hồi ngoài → khấu như cột góc. Hai cột sát nhau (không đủ chỗ cho 2 vách khấu + một dải CON_MIN) → gộp thành một vùng khấu. */
    const CON_MIN = 100, TRONG_MIN = 30, ho = s.khau.ho;
    // phia = +1: mép PHẢI của vùng cột (thùng nằm bên phải mép này); −1: mép TRÁI. null = hết chỗ (cột trùm tới / qua hồi ngoài phía đó).
    const datMep = (x0, phia) => {
      let best = null;
      const xet = (x, co, khoang) => { if (phia > 0 ? (x >= x0 - 1 && (!best || x < best.x - TOL)) : (x <= x0 + 1 && (!best || x > best.x + TOL))) best = { x: rn(x), co, khoang }; };
      if (phia > 0) {
        for (let j = 1; j <= n; j++) xet(xs[j], true, -1);
        for (let i = 0; i < n; i++) { const lo = bayX(i) + TRONG_MIN, hi = bayX(i) + widths[i] - t - CON_MIN; if (hi >= lo - TOL && x0 <= hi + TOL) xet(Math.max(x0, lo), false, i); }
      } else {
        for (let j = 0; j < n; j++) xet(bayX(j), true, -1);
        for (let i = 0; i < n; i++) { const lo = bayX(i) + t + CON_MIN, hi = bayX(i) + widths[i] - TRONG_MIN; if (hi >= lo - TOL && x0 >= lo - TOL) xet(Math.min(x0, hi), false, i); }
      }
      return best;
    };
    // vùng cột danh nghĩa (cột + khe hở), từ trái sang phải: a … b theo chiều ngang (cột góc: −∞ / +∞), x0 … x1 = chính cây cột
    let vung = [];
    { const q = s.khau.trai; if (q.rong > 0 && q.sau > 0) vung.push({ a: -Infinity, b: rn(q.rong + ho), sau: q.sau, x0: 0, x1: q.rong, ten: 'trái' }); }
    { const ds = (s.khau.giua || []).map((q, i) => ({ q, i })).filter(o => o.q.rong > 0 && o.q.sau > 0);
      ds.slice().sort((u, v) => u.q.cach - v.q.cach).forEach(({ q, i }) => vung.push({ a: rn(q.cach - ho), b: rn(q.cach + q.rong + ho), sau: q.sau, x0: q.cach, x1: rn(q.cach + q.rong), ten: ds.length > 1 ? `giữa ${i + 1}` : 'giữa' })); }
    { const q = s.khau.phai; if (q.rong > 0 && q.sau > 0) vung.push({ a: rn(W - q.rong - ho), b: Infinity, sau: q.sau, x0: rn(W - q.rong), x1: W, ten: 'phải' }); }
    const gopVung = (u, v) => ({ a: Math.min(u.a, v.a), b: Math.max(u.b, v.b), sau: Math.max(u.sau, v.sau), x0: Math.min(u.x0, v.x0), x1: Math.max(u.x1, v.x1), ten: `${u.ten} + ${v.ten}`, gop: (u.gop || 1) + (v.gop || 1) });
    const gopDuoc = (u, v) => isFinite(u.a) || isFinite(v.b);      // cột góc trái với cột góc phải thì không gộp (thành ra cả tủ nằm trước cột)
    // một vùng → K (đã đặt mép) | { loi } | { bo } ; ghi = các dòng ghi chú kèm theo
    const giaiVung = z => {
      const ghi = [], ten = z.ten;
      if (!phu) return { loi: `Khấu cột ${ten}: hiện chỉ làm với kiểu hậu phủ sau (Chuẩn xưởng → Hậu).` };
      let a = z.a, b = z.b;
      const FA = isFinite(a) ? datMep(a, -1) : null, FB = isFinite(b) ? datMep(b, 1) : null;
      if (isFinite(a) && !FA) { ghi.push(`Khấu cột ${ten}: cột cách mép trái ${g(z.x0)} là dính hồi trái — khấu như cột góc trái (lấn ngang ${g(z.x1)}).`); a = -Infinity; }
      if (isFinite(b) && !FB) { ghi.push(`Khấu cột ${ten}: cột tới ${g(z.x1)} là dính hồi phải (tủ rộng ${g(W)}) — khấu như cột góc phải (lấn ngang ${g(W - z.x0)}).`); b = Infinity; }
      if (!isFinite(a) && !isFinite(b)) return { loi: `Khấu cột ${ten}: cột trùm hết bề ngang tủ — không khấu được; làm tủ nông lại (giảm sâu thùng) thay vì khấu.` };
      if (!isFinite(a) && b <= pL + TOL) return { bo: `Cột ${ten} (${g(z.x1)} + hở ${g(ho)}) nằm gọn sau phào trái rộng ${g(pL)} — thùng không phải khấu.` };
      if (!isFinite(b) && a >= W - pR - TOL) return { bo: `Cột ${ten} (${g(W - z.x0)} + hở ${g(ho)}) nằm gọn sau phào phải rộng ${g(pR)} — thùng không phải khấu.` };
      const NY = z.sau + ho, ben = !isFinite(a) ? 'trai' : !isFinite(b) ? 'phai' : 'giua';
      const K = { ben, trai: ben === 'trai', ten, NX: ben === 'trai' ? rn(z.x1 + ho) : ben === 'phai' ? rn(W - z.x0 + ho) : rn(z.x1 - z.x0 + 2 * ho), NY, xa: -Infinity, xb: Infinity, yCot: rn(D - NY), Dn: rn(D - NY - t), coA: false, coB: false, kA: -1, kB: -1, cot: { x0: z.x0, x1: z.x1, sau: z.sau }, ghi };
      if (K.Dn < 150) return { loi: `Khấu cột ${ten}: cột sâu ${g(z.sau)} thì thùng trước cột chỉ còn sâu ${g(K.Dn)} (cần ≥ 150).` };
      if (isFinite(a)) { K.xa = FA.x; K.coA = FA.co; K.kA = FA.khoang; if (a - FA.x > 1) ghi.push(`Khấu cột ${ten}: vùng khấu nới thêm ${g(a - FA.x)} về bên trái ${FA.co ? 'tới mặt tấm đứng kế đó (tấm đó làm vách khấu)' : `để vách khấu đứng cách vách của khoang ${TRONG_MIN}`} — khoang của tủ giữ nguyên.`); }
      if (isFinite(b)) { K.xb = FB.x; K.coB = FB.co; K.kB = FB.khoang; if (FB.x - b > 1) ghi.push(`Khấu cột ${ten}: vùng khấu nới thêm ${g(FB.x - b)} về bên phải ${FB.co ? 'tới mặt tấm đứng kế đó (tấm đó làm vách khấu)' : `để vách khấu đứng cách vách của khoang ${TRONG_MIN}`} — khoang của tủ giữ nguyên.`); }
      K.eA = isFinite(K.xa) && !K.coA ? t : 0; K.eB = isFinite(K.xb) && !K.coB ? t : 0;      // bề dày vách khấu thêm ở từng mặt
      K.x = K.trai ? K.xb : K.xa; K.co_vach = K.trai ? K.coB : K.coA; K.khoang = K.trai ? K.kB : K.kA;      // (tên cũ của bản 1.13, cột góc chỉ có một mặt)
      return K;
    };
    let kqVung = [];
    for (let lan = 0; lan < 16; lan++) {
      for (let i = 0; i + 1 < vung.length; i++) { const u = vung[i], v = vung[i + 1]; if (v.a - u.b < 2 * t + CON_MIN - TOL && gopDuoc(u, v)) { vung.splice(i, 2, gopVung(u, v)); i--; } }
      kqVung = vung.map(giaiVung);
      // hai vùng đã đặt mép mà dải giữa hai vách khấu của chúng còn dưới CON_MIN (cùng nằm trong một khoang) → gộp rồi đặt lại
      let gop = -1;
      for (let i = 0; i + 1 < kqVung.length && gop < 0; i++) {
        const u = kqVung[i], v = kqVung[i + 1]; if (u.loi || u.bo || v.loi || v.bo || !isFinite(u.xb) || !isFinite(v.xa)) continue;
        const dai = (v.xa - v.eA) - (u.xb + u.eB);
        if (dai < CON_MIN - TOL && !(u.coB && v.coA && v.xa - u.xb >= t - TOL) && gopDuoc(vung[i], vung[i + 1])) gop = i;
      }
      if (gop < 0) break;
      vung.splice(gop, 2, gopVung(vung[gop], vung[gop + 1]));
    }
    for (const K of kqVung) {
      if (K.loi) { err(K.loi); continue; }
      if (K.bo) { note(K.bo); continue; }
      if (KH.some(o => Math.min(o.xb, K.xb) - Math.max(o.xa, K.xa) > TOL)) { err(`Khấu cột ${K.ten}: vùng khấu chồng lên vùng khấu của một cột khác — tủ quá hẹp so với hai cột; làm tủ nông lại (giảm sâu thùng) thay vì khấu.`); continue; }
      for (const m of K.ghi) note(m);
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
    M.info.nk_vuong_cot = [];      // khoang có ngăn kéo không đủ sâu VÌ CỘT phía sau (bản 1.23) — thẻ Phòng dùng để đổi chỗ khoang / bỏ ngăn kéo khoang đó
    M.info.khau = KH.map(K => ({ ben: K.ben, x: K.x, y: K.yCot, sau_thung: K.Dn, vach_co_san: K.co_vach, xa: isFinite(K.xa) ? K.xa : null, xb: isFinite(K.xb) ? K.xb : null, co_a: K.coA, co_b: K.coB, cot: K.cot }));
    const tenVachK = K => { const m = []; if (isFinite(K.xa)) m.push(K.coA); if (isFinite(K.xb)) m.push(K.coB); return m.every(Boolean) ? (m.length > 1 ? 'hai vách sẵn có làm vách khấu (khoang nông trước cột)' : 'vách sẵn có làm vách khấu') : m.some(Boolean) ? 'một vách sẵn có + thêm một vách khấu' : (m.length > 1 ? 'thêm hai vách khấu' : 'thêm vách khấu'); };
    if (KH.length) note(`Khấu cột: ${KH.map(K => `${K.ten} ${g(K.NX)} × ${g(K.NY)} (cột + hở ${g(s.khau.ho)}) — thùng trước cột sâu ${g(K.Dn)}, ${tenVachK(K)}`).join('; ')}. Hậu khấu (tấm trước mặt cột) là ván thùng dày ${g(t)}, lọt giữa 2 tấm đứng hai bên cột. Nóc / đáy / đợt vắt qua mép cột được khoét góc chữ L${KH.some(K => K.ben === 'giua') ? ' hoặc chữ U' : ''}.`);

    /* ---- thùng từng thân ---- */
    for (const b of bodies) {
      const vL = [], vR = [];      // tấm đứng bên trái / bên phải của từng khoang
      // (bản 1.34.1) táp: nóc phủ hồi (nóc chồm) ở thân trên cùng, đáy phủ hồi ở thân dưới — riêng từng tấm; phủ hồi của Chuẩn xưởng là cả hai
      const topB = b === bodies[bodies.length - 1], nocPhu = phuHoi || (!!TP && TP.noc === 'phu' && topB), dayPhu = phuHoi || (!!TP && TP.day === 'phu' && b === bodies[0]);
      const goB = TP && TP.go > 0 && topB ? TP.go : 0;      // gờ chắn: hồi ngoài nhô trên nóc
      const zD0 = dayPhu ? b.zb : b.z0, zD1 = nocPhu ? b.zt : b.z1;      // (bản 1.31) phủ hồi: hồi / vách đứng trên đáy, dưới nóc
      for (let j = 0; j <= n; j++) {
        if (j > 0 && j < n && kep(j)) {      // chỗ tách thùng: hồi phải của thùng bên trái + hồi trái của thùng bên phải, áp lưng nhau
          vR[j - 1] = P({ loai: 'HOI', ten: NM.hoi_phai, than: b.code, tu: b.tu, type: 1, x0: xs[j], x1: xs[j] + t, y0: 0, y1: sauDung(xs[j], xs[j] + t), z0: zD0, z1: zD1, big: 1, vi_tri: j, thung: thungCua[j - 1] });
          vL[j] = P({ loai: 'HOI', ten: NM.hoi_trai, than: b.code, tu: b.tu, type: 1, x0: xs[j] + t, x1: xs[j] + 2 * t, y0: 0, y1: sauDung(xs[j] + t, xs[j] + 2 * t), z0: zD0, z1: zD1, big: 0, vi_tri: j, thung: thungCua[j] });
          continue;
        }
        const ngoai = j === 0 || j === n;
        const p = P({ loai: ngoai ? 'HOI' : 'VACH', ten: j === 0 ? NM.hoi_trai : j === n ? NM.hoi_phai : NM.vach, than: b.code, tu: b.tu, type: 1,
          x0: xs[j], x1: xs[j] + t, y0: 0, y1: sauDung(xs[j], xs[j] + t), z0: zD0, z1: ngoai && goB ? rn(zD1 + goB) : zD1, big: j === n ? 1 : 0, vi_tri: j, thung: thungCua[Math.min(j, n - 1)] });
        // (1.34.1) táp gờ chắn: bo tròn góc trên phía trước của hồi — ghi gia công (CNC / máy bo cạnh)
        // (1.36.2, anh Thanh: "vẽ ra lại là vuông góc") tấm cũng mang đường bao cong thật (bo_r → duongBaoBo) để Chenfeng vẽ đúng hình
        if (ngoai && goB && TP.bo > 0) { p.gia_cong = `bo tròn góc trên phía trước R${g(TP.bo)} (gia công CNC)`; p.bo_r = TP.bo; }
        if (j > 0) vR[j - 1] = p;
        if (j < n) vL[j] = p;
      }
      // (bản 1.31) phủ hồi: MỖI THÙNG một tấm đáy + một tấm nóc chạy từ mặt ngoài hồi trái tới mặt ngoài hồi phải (khoang = khoang đầu, den_khoang = khoang cuối)
      const dayT = [], nocT = [];
      if (dayPhu || nocPhu) for (const q of M.info.thung) {
        const a = q.khoang[0], z = q.khoang[1], x0 = vL[a].x0, x1 = vR[z].x1;
        // (1.34.1) táp nóc phẳng mặt ngăn kéo trùm (dua_truoc −1): đáy phủ cũng ra phẳng mặt — hộp có nóc + đáy viền trên dưới mặt (ảnh 9)
        if (dayPhu) dayT.push(khauNgang(P({ loai: 'DAY', ten: NM.day, than: b.code, tu: b.tu, type: 0, x0, x1, y0: TP && TP.day === 'phu' && TP.noc === 'phu' && TP.dua_truoc < 0 ? -tc : 0, y1: Dc, z0: b.zb - t, z1: b.zb, big: 1, khoang: a, den_khoang: z })));
        // (1.34.1) táp nóc chồm: nóc đua ra ngoài hồi ngoài `dua` mỗi bên và `dua_truoc` phía trước (p.dua: phần hẫng — kiemLienKet nhận hồi lùi vào đó là chỗ tì)
        const dT = TP && TP.noc === 'phu' ? TP : null, dL = dT && a === 0 ? duaL : 0, dR = dT && z === n - 1 ? duaR : 0;
        if (nocPhu) nocT.push(khauNgang(P(Object.assign({ loai: 'NOC', ten: NM.noc, than: b.code, tu: b.tu, type: 0, x0: rn(x0 - dL), x1: rn(x1 + dR), y0: dT ? -(dT.dua_truoc < 0 ? tc : dT.dua_truoc) : 0, y1: Dc, z0: b.zt, z1: b.z1, big: 0, khoang: a, den_khoang: z }, dL || dR ? { dua: Math.max(dL, dR) } : {}))));
      }
      for (let i = 0; i < n; i++) {
        const bx = bayX(i), c = widths[i];
        const day = dayPhu ? dayT[thungCua[i]] : sanK[i] ? null : khauNgang(P({ loai: 'DAY', ten: NM.day, than: b.code, tu: b.tu, type: 0, x0: bx, x1: bx + c, y0: 0, y1: Dc, z0: b.zb - t, z1: b.zb, big: 1, khoang: i }));
        // (bản 1.33) tủ chậu / bếp nấu: lỗ khoét đá cắt qua chỗ nóc → 2 GIẰNG đứng (trước sát mép trước, sau áp mặt trước hậu) thay nóc
        const giang = !!B && B.noc === 'giang' && !phuHoi;
        // (soát 1.36.4) giằng sau / thanh treo nằm sát hậu, thường khuất sau cánh; khoang KHÔNG cánh (kệ hở) thì nhìn thẳng thấy mặt trước của chúng, cánh khung
        // kính (B.kinh) thì thấy qua kính → giấu lỗ như tấm lộ mặt trước. Có cánh đặc thì giữ fd / bd như cũ.
        const loSau = !(s.khoang[i] && s.khoang[i].canh > 0) || !!(B && B.kinh) ? GIAU_LO : {};
        const noc = nocPhu ? nocT[thungCua[i]] : giang ? null : khauNgang(P({ loai: 'NOC', ten: NM.noc, than: b.code, tu: b.tu, type: 0, x0: bx, x1: bx + c, y0: 0, y1: Dc, z0: b.zt, z1: b.z1, big: 0, khoang: i }));
        if (giang) {
          const gr = B.giang_rong;
          P({ loai: 'GIANG', ten: 'Giằng trước', than: b.code, tu: b.tu, type: 2, x0: bx, x1: bx + c, y0: 0, y1: t, z0: b.z1 - gr, z1: b.z1, big: 0, khoang: i, ...GIAU_LO });
          P({ loai: 'GIANG', ten: 'Giằng sau', than: b.code, tu: b.tu, type: 2, x0: bx, x1: bx + c, y0: yG - t, y1: yG, z0: b.z1 - gr, z1: b.z1, big: 1, khoang: i, ...loSau });
        }
        // (bản 1.33) tủ trên: THANH TREO ván dày t dọc mép trên phía trong, áp mặt trước hậu, sát nóc — vít nở xuyên qua nó vào tường (hậu 6,5 không chịu được tủ bát 40–60 kg)
        // (vòng soát 2 — 1.34) ô trên cùng thấp hơn thanh treo (khoang tủ lạnh máy cao: đợt trên hốc cách nóc 75) → thanh treo đứng trên đợt đó, không đè vào nó
        if (B && (B.tang === 'tren' || B.chuc_nang === 'tl') && B.treo === 'thanh' && B.thanh_treo > 0) {
          const dTren = Math.max(-Infinity, ...((s.khoang[i] && s.khoang[i].dot) || []).filter(z => z >= b.zb - TOL && z + t <= b.zt + TOL).map(z => z + t)), zTreo = Math.max(b.zt - B.thanh_treo, dTren);
          if (b.zt - zTreo >= 30 - TOL) P({ loai: 'TREO', ten: 'Thanh treo', than: b.code, tu: b.tu, type: 2, x0: bx, x1: bx + c, y0: yG - t, y1: yG, z0: zTreo, z1: b.zt, big: 1, khoang: i, ...loSau, ghi_bep: 'thanh treo — vít nở xuyên qua vào tường, khoan cam vào hồi' });
        }
        if (phu || khongHau) continue;
        // hậu dày lọt lòng / hậu soi rãnh: mỗi khoang 1 tấm
        // (bản 1.34) hốc không hậu (tủ bếp): hậu lọt chia đoạn — đoạn dưới lên tới mặt trên đợt dưới hốc, đoạn trên từ mặt dưới đợt trên hốc (đợt đứng trước hậu)
        const zHL = rn(b.zb - gS), zHH = rn(b.zt + gS);
        for (const [hz0, hz1] of doanZ(zHL, zHH, catHau(i).map(([a, c2]) => [a === null ? -Infinity : a + t, c2 === null ? Infinity : c2]))) {
        const hau = P({ loai: 'HAU', ten: NM.hau, than: b.code, tu: b.tu, type: 2, x0: bx - gS, x1: bx + c + gS, y0: yb0, y1: yb1, z0: hz0, z1: hz1,
          big: 1, fd: false, bd: thin ? false : true, khoan: thin ? KHONG_KHOAN : KT, khoang: i, mong: thin });
        if (thin) {
          // rãnh trên 2 tấm đứng hai bên, đáy (mặt trên), nóc (mặt dưới) — toạ độ riêng của từng tấm
          const zg0 = hau.z0, zg1 = hau.z1;
          const L = vL[i], R = vR[i];
          // (1.31.1) rãnh trên tấm đứng nằm GỌN trong tấm: phủ hồi thì hồi / vách đứng trên đáy, hậu ăn xuống rãnh đáy chứ không xuống hồi
          const rd = (T, a, b) => { const v0 = Math.max(a, T.z0), v1 = Math.min(b, T.z1); return { v: rn(v0 - T.z0), h: rn(v1 - v0) }; };
          { const q = rd(L, zg0, zg1); L.holes.push({ kieu: 'ranh', u: yb0, v: q.v, w: grooveW, h: q.h, z: t - gS, sau: gS }); }      // mặt x lớn của tấm trái
          { const q = rd(R, zg0, zg1); R.holes.push({ kieu: 'ranh', u: yb0, v: q.v, w: grooveW, h: q.h, z: 0, sau: gS }); }          // mặt x nhỏ của tấm phải
          const coDay = day && hz0 <= zHL + TOL, coNoc = noc && hz1 >= zHH - TOL;      // (1.34) đoạn hậu không chạm đáy / nóc thì không soi rãnh tấm đó
          // đáy / nóc liền thùng: rãnh phủ cả 2 góc hậu ăn vào (bx − gS … bx + c + gS); tấm nằm trong Chenfeng có trục v tính từ mép PHẢI (v = x1 − x, đã đo — xem dinhKhoet)
          // (1.34.1) u tính từ mép trước tấm (nóc chồm của táp: mép trước ở −dua_truoc)
          const a = rn(bx - gS), b = rn(bx + c + gS);
          if (coDay) day.holes.push(dayPhu ? { kieu: 'ranh', u: rn(yb0 - day.y0), v: rn(day.x1 - b), w: grooveW, h: rn(b - a), z: t - gS, sau: gS } : { kieu: 'ranh', u: yb0, v: 0, w: grooveW, h: c, z: t - gS, sau: gS });      // mặt trên đáy
          if (coNoc) noc.holes.push(nocPhu ? { kieu: 'ranh', u: rn(yb0 - noc.y0), v: rn(noc.x1 - b), w: grooveW, h: rn(b - a), z: 0, sau: gS } : { kieu: 'ranh', u: yb0, v: 0, w: grooveW, h: c, z: 0, sau: gS });           // mặt dưới nóc
        }
        }
      }
      if (phu) {
        // Hậu phủ: phủ từ mặt dưới đáy tới mặt trên nóc, từ mép ngoài hồi trái tới mép ngoài hồi phải (lùi vào `mep`); không khoan — bắn đinh từ sau vào mép sau của hồi, vách, đáy, nóc, đợt.
        // Chia tấm: mối nối nằm trên mép sau của vách (tim vách, làm tròn 1 mm để tấm ra số chẵn) → mỗi tấm gối lên vách khoảng nửa bề dày ván.
        const mep = s.hau.mep, zA = rn(b.zb - t + mep), zB = rn(b.z1 + goB - mep);      // (1.34.1) táp gờ chắn: hậu phủ lên tới đỉnh gờ
        // mép tấm hậu: ở hồi (hồi ngoài, hoặc hồi tại chỗ tách thùng) hậu phủ hết hồi của thùng mình, lùi `mep`; ở vách chung thì nối tại tim vách
        const trai = i => (i === 0 || kep(i) ? rn(xs[i] + tv[i] - t + mep) : Math.round(xs[i] + t / 2));
        const phai = i => (i === n - 1 || kep(i + 1) ? rn(xs[i + 1] + t - mep) : Math.round(xs[i + 1] + t / 2));
        const vua = (w, h) => Math.max(w, h) <= s.van.kho_dai + TOL && Math.min(w, h) <= s.van.kho_rong + TOL;
        const manh = [];
        for (let i = 0; i < n;) {
          let j = i;
          if (s.hau.chia === 'kho_van') while (j + 1 < n && thungCua[j + 1] === thungCua[i] && !catHau(i).length && !catHau(j + 1).length && vua(phai(j + 1) - trai(i), zB - zA)) j++;      // (1.34) khoang có hốc không hậu: tấm hậu riêng      // tấm hậu không bắc qua 2 thùng
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
          if (m.K || khongHau) continue;      // phần trước mặt cột: hậu khấu bằng ván thùng (bên dưới); tủ bếp không hậu (chậu, hút mùi)
          const w = m.x1 - m.x0;
          // (bản 1.34) hốc không hậu: hậu phủ chia đoạn — mép đoạn dưới phủ lên mép sau đợt dưới hốc, đoạn trên bắt đầu ở mép sau đợt trên hốc (lùi `mep` như ở đáy / nóc)
          const cuts = m.i === m.j ? catHau(m.i).map(([a, c2]) => [a === null ? -Infinity : a + t - mep, c2 === null ? Infinity : c2 + mep]) : [];
          for (const [hz0, hz1] of doanZ(zA, zB, cuts))
            P({ loai: 'HAU', ten: NM.hau, than: b.code, tu: b.tu, type: 2, x0: m.x0, x1: m.x1, y0: Dc, y1: D, z0: hz0, z1: hz1, big: 1, fd: false, bd: false, khoan: KHONG_KHOAN, khoang: m.i, den_khoang: m.j, phu: true,
              lines: (w > s.van.kho_rong + TOL && hz1 - hz0 <= s.van.kho_rong + TOL) ? 1 : 0 });      // tấm rộng hơn khổ ván: vân ngang, nằm dọc theo chiều dài khổ
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
      // (bản 1.34.1) táp gờ chắn: GỜ SAU = ván thùng đứng trên nóc, sát lưng (trước hậu phủ), kẹp giữa 2 hồi ngoài, cao bằng gờ — hồi + gờ sau làm lan can 3 mặt; khoan cam vào hồi
      if (goB) for (const q of M.info.thung) {
        const yS = phu ? Dc : D;
        P({ loai: 'GO', ten: 'Gờ sau', than: b.code, tu: b.tu, type: 2, x0: vL[q.khoang[0]].x1, x1: vR[q.khoang[1]].x0, y0: rn(yS - t), y1: yS, z0: b.z1, z1: rn(b.z1 + goB), big: 1, khoang: q.khoang[0], den_khoang: q.khoang[1], ...GIAU_LO });
      }
      // (bản 1.31) KHUNG ĐẾ dưới đáy phủ hồi (thân có chân): mỗi thùng 2 đế hông chạy suốt chiều sâu, đế trước (ngay sau chân trước) + đế sau (mép sau thùng) KẸP GIỮA 2 đế hông
      // — cao bằng chân, ván thùng. Đế hông ra tới mép trước: phụ trợ phào bắt vào mặt ngoài đế hông, không dồn lỗ khoan vào đầu đế trước (lỗ cắt nhau — phép dò lỗi đã bắt).
      // Cạnh cột (khấu cột): đế sau đoạn trong vùng cột lùi ra trước mặt cột (mép sau = mép sau phần nông K.Dn); đế hông ở đầu dính vùng cột cũng ngắn theo.
      if (phuHoi && b.chan > 0) for (const q of M.info.thung) {
        const x0 = vL[q.khoang[0]].x0, x1 = vR[q.khoang[1]].x1, ch = b.chan;
        const mepSau = (a, c) => { let y = Dc; for (const K of KH) if (Math.min(c, K.xb + K.eB) - Math.max(a, K.xa - K.eA) > TOL) y = Math.min(y, K.Dn); return y; };
        const de = (ten, type, xa, xb, ya, yb) => { if (xb - xa > TOL && yb - ya > TOL) P({ loai: 'DE', ten: `${NM.de} ${ten}`, than: b.code, tu: b.tu, type, x0: rn(xa), x1: rn(xb), y0: rn(ya), y1: rn(yb), z0: b.z0, z1: rn(b.z0 + ch), big: 1, khoang: q.khoang[0], den_khoang: q.khoang[1] }); };
        de('hông', 1, x0, x0 + t, 0, mepSau(x0, x0 + t));
        de('hông', 1, x1 - t, x1, 0, mepSau(x1 - t, x1));
        de('trước', 2, x0 + t, x1 - t, 0, t);
        // đế sau: cắt thành đoạn theo mép các vùng cột
        const moc = [x0 + t, x1 - t]; for (const K of KH) for (const v of [K.xa - K.eA, K.xb + K.eB]) if (isFinite(v) && v > x0 + t + TOL && v < x1 - t - TOL) moc.push(v);
        moc.sort((u, v) => u - v);
        const sau = [];
        for (let k = 0; k + 1 < moc.length; k++) { const a = moc[k], c = moc[k + 1]; if (c - a < 2 * t) continue; const y = mepSau(a, c); de('sau', 2, a, c, y - t, y); sau.push([a, c, y]); }      // (1.31.1) bỏ đoạn vụn (< 2 dày ván) giữa hai vùng cột sát nhau
        // (1.31.1) vách sẵn có làm vách khấu (eA / eB = 0) đứng TRÊN đáy, không xuống sàn → đế sau đoạn trước cột và đoạn sát lưng hở đầu: thêm đế dọc ngay dưới vách đó nối hai đoạn.
        // Hai vùng cột dùng chung MỘT vách (vùng trái co_b, vùng phải co_a) → một đế dọc (gom theo x, chạy từ đoạn trước cột nông hơn); đoạn đế sau ngay dưới vách bị bỏ vì vụn → đế dọc chạy tới mép sau.
        const doc = new Map();
        const themDoc = (xa, xb, ya) => { const k = rn(xa, 1); const c = doc.get(k); if (c) c[2] = Math.min(c[2], ya); else doc.set(k, [xa, xb, ya]); };
        for (const K of KH) {
          if (isFinite(K.xa) && !K.eA && K.xa - t > x0 + t - TOL && K.xa < x1 - t + TOL) themDoc(K.xa - t, K.xa, K.Dn - t);
          if (isFinite(K.xb) && !K.eB && K.xb > x0 + t - TOL && K.xb + t < x1 - t + TOL) themDoc(K.xb, K.xb + t, K.Dn - t);
        }
        for (const [xa, xb, ya] of doc.values()) de('dọc', 1, xa, xb, ya, sau.some(([a, c, y]) => Math.abs(y - Dc) < TOL && a < xb - TOL && c > xa + TOL) ? Dc - t : Dc);
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
    // (1.33, vòng soát 2) tủ bếp giằng thay nóc: ô trên cùng dừng ở MẶT DƯỚI GIẰNG (không ở chỗ nóc đã bỏ) — hộp ngăn kéo / rổ kéo ra phải lọt dưới giằng trước
    const dinhO = b => (B && B.noc === 'giang' && !phuHoi ? rn(b.z1 - B.giang_rong) : b.zt);
    s.khoang.forEach((k, i) => bodies.forEach(b => {
      let lo = { top: sanK[i] && b === lower ? b.z0 : b.zb, tu: rn(b.zb - t), dot: null };      // (1.34) hốc xuống sàn: ô bắt đầu từ sàn
      for (const z of (dotsOf[i][b.code] || []).concat([null])) {
        cells.push({ khoang: i, b, than: b.code, tu: lo.tu, z0: rn(lo.top), z1: rn(z === null ? dinhO(b) : z), zDuoi: lo.dot, zTren: z, x0: bayX(i), x1: rn(bayX(i) + widths[i]) });
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
        if (c0.cao) c.cao = c0.cao; if (c0.pk) c.pk = c0.pk;
        if (c0.kieu === 'hoc') { c.tb = c0.tb; c.hau = c0.hau; c.san = c0.san; }      // (bản 1.34) hốc thiết bị      // (bản 1.33, tủ bếp) cao mặt cố định từ trên xuống; mã rổ của mặt kéo
      }
    });
    M.info.o = cells.map(c => Object.assign({ khoang: c.khoang, than: c.than, tu: c.tu, z0: c.z0, z1: c.z1, kieu: c.kieu || '', so: c.so || 0, loai: c.loai || '', x0: c.x0, x1: c.x1 }, c.pk ? { pk: c.pk.slice() } : {}, c.tb ? { tb: c.tb } : {}));

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
    if (chan > 0 && B) {
      // (bản 1.33) tủ bếp, chân kiểu 'hoi_san': hồi xuống sàn, xà chân LÙI `len_lui` (chỗ để mũi chân) lọt giữa 2 tấm đứng của từng khoang, đỡ dưới đáy; khoan cam vào hồi như thanh giằng
      // (vòng soát 2) lùi < dày xà: xà đặt PHẲNG MẶT HỒI (y 0 … dày), vẫn kẹp giữa hai tấm đứng — không để tấm thò ra trước hồi không tì vào đâu mà vẫn khoan cam
      const lui = Math.max(B.len_lui, tc);
      if (B.len_lui < tc - TOL) note(`Lùi xà chân ${g(B.len_lui)} < dày xà ${g(tc)}: xà chân đặt phẳng mặt hồi (lùi 0), kẹp giữa hai hồi.`, 'bep');
      for (let i = 0; i < n; i++) if (!sanK[i]) P({ loai: 'CHAN', ten: 'Xà chân', than: lower.code, tu: lower.tu, type: 2, x0: bayX(i), x1: rn(bayX(i) + widths[i]), y0: rn(lui - tc), y1: rn(lui), z0: 0, z1: chan, big: 1, lines: 1, khoang: i, ...GIAU_LO, ghi_bep: lui > tc + TOL ? `xà chân lùi ${g(B.len_lui)} giữa hai hồi (hồi xuống sàn)` : 'xà chân phẳng mặt hồi, kẹp giữa hai hồi (hồi xuống sàn)' });
    } else if (chan > 0 && TP) {
      // (bản 1.34.1) táp: XÀ ĐẾ lùi `lui_chan` (≥ dày xà) kẹp giữa 2 tấm đứng của từng khoang, đỡ dưới đáy — hồi xuống sàn, mặt trước chỉ thấy cạnh hồi + mặt ngăn kéo (ảnh mẫu)
      const lui = Math.max(TP.lui_chan, tc);
      for (let i = 0; i < n; i++) P({ loai: 'CHAN', ten: 'Xà đế', than: lower.code, tu: lower.tu, type: 2, x0: bayX(i), x1: rn(bayX(i) + widths[i]), y0: rn(lui - tc), y1: rn(lui), z0: lower.z0, z1: rn(lower.z0 + chan), big: 1, lines: 1, khoang: i, ...GIAU_LO, ghi_bep: `xà đế lùi ${g(lui)} giữa hai hồi (hồi xuống sàn)` });
    } else if (chan > 0) {
      for (let k = 0; k < J.length - 1; k++)
        P({ loai: 'CHAN', ten: NM.chan, than: lower.code, tu: lower.tu, type: 2, x0: J[k], x1: J[k + 1], y0: -tc, y1: 0, z0: 0, z1: chan, big: 1, lines: 1, ...GIAU_LO, ...(phuHoi ? { khoan: KHONG_KHOAN, vit_de: true } : {}) });      // (bản 1.31) phủ hồi: chân trước áp mặt vào đế trước — bắt vít từ sau, không khoan cam
    }

    /* ---- phào mặt + thanh phụ trợ ---- */
    const topBody = bodies[bodies.length - 1];
    const sideSeg = twoBody ? [{ b: bodies[0], z0: 0, z1: zd }, { b: bodies[1], z0: zd, z1: H }] : [{ b: bodies[0], z0: 0, z1: H }];
    for (const sg of sideSeg) if (sg.z1 - sg.z0 > s.van.kho_dai + TOL && (pL > 0 || pR > 0)) err(`Phào đứng dài ${g(sg.z1 - sg.z0)} > khổ ván ${g(s.van.kho_dai)}.`);
    const phaoDung = (trai) => {
      const p = trai ? pL : pR; if (!(p > 0)) return;
      const xa = trai ? 0 : W - p, xb = trai ? p : W, ben = trai ? 'trai' : 'phai';
      // (bản 1.34, tủ bếp) đầu dãy hở: TẤM ỐP HÔNG dày cánh thay phào — phẳng mặt cánh, xuống sàn (che chỗ lùi xà chân), chạy suốt chiều sâu
      if (B && B.op === ben) { P({ loai: 'OP', ten: 'Tấm ốp hông', than: lower.code, tu: lower.tu, type: 1, x0: xa, x1: xb, y0: -tc, y1: D, z0: 0, z1: H, khoan: KHONG_KHOAN, big: 0, ghi_bep: 'ốp hông đầu dãy hở (dày + màu như cánh) — keo + vít từ trong hồi, không khoan cam' }); return; }
      for (const sg of sideSeg) {
        // (bản 1.34, tủ bếp) NẸP BÙ = phào: chạy từ chân lên (xà chân lùi chạy dưới nó tới tường), phụ trợ phào là thanh lùi chống vênh
        const zp = B ? Math.max(sg.z0, chan) : sg.z0;
        P({ loai: 'PHAO', ten: trai ? NM.phao_trai : NM.phao_phai, than: sg.b.code, tu: sg.b.tu, type: 2, x0: xa, x1: xb, y0: -tc, y1: 0, z0: zp, z1: sg.z1, khoan: KP, big: 0 });
        if (B && chan > 0 && sg.b === lower) { const lui = Math.max(B.len_lui, tc); P({ loai: 'CHAN', ten: 'Xà chân', than: lower.code, tu: lower.tu, type: 2, x0: xa, x1: xb, y0: rn(lui - tc), y1: rn(lui), z0: 0, z1: chan, big: 1, lines: 1, khoan: KHONG_KHOAN, ...GIAU_LO, ghi_bep: 'xà chân dưới nẹp bù — chạy tới tường, bắt vít vào hồi (không khoan cam)' }); }
        if (aux > 0) {
          if (p < t) { warn(`Phào ${trai ? 'trái' : 'phải'} rộng ${g(p)} < dày ván ${g(t)}: không đặt được thanh phụ trợ.`); continue; }
          P({ loai: 'PHU', ten: NM.phu_tro, than: sg.b.code, tu: sg.b.tu, type: 1, x0: trai ? p - t : W - p, x1: trai ? p : W - p + t, y0: 0, y1: aux, z0: zp, z1: Math.min(sg.z1, Ztop), khoan: KP, big: 0 });
          // (bản 1.34) nẹp góc chữ L (tủ dưới): phụ trợ chạy SUỐT chiều sâu ở đỉnh thân — đỡ đầu đá cạnh kia tì lên
          if (B && B.tang === 'duoi' && B.nep && B.nep.goc === ben && D - aux > 30) {
            // (vòng soát 3 — 1.34) đầu đá cạnh này (mối nối với đá cạnh kia) nằm ở dua_da tính từ mép module phía góc, thanh đứng ở mép trong nẹp (p − t … p):
            // nẹp góc > dua_da + t thì đầu đá hẫng (nẹp 80: 42,5) suốt chiều sâu → thanh NẰM ở đỉnh từ dưới mối nối tới hồi, gác lên thanh đứng (hạ xuống một dày ván)
            const o = Math.max(0, Math.min(p - t, num(B.dua_da, 0))), nam = p - t - o > 0.5;
            P({ loai: 'PHU', ten: 'Phụ trợ đỡ đá', than: sg.b.code, tu: sg.b.tu, type: 1, x0: trai ? p - t : W - p, x1: trai ? p : W - p + t, y0: aux, y1: D, z0: rn(Ztop - aux), z1: nam ? rn(Ztop - t) : Ztop, khoan: KP, big: 0 });
            if (nam) P({ loai: 'PHU', ten: 'Phụ trợ đỡ đá', than: sg.b.code, tu: sg.b.tu, type: 0, x0: trai ? o : rn(W - p), x1: trai ? p : rn(W - o), y0: aux, y1: D, z0: rn(Ztop - t), z1: Ztop, khoan: KHONG_KHOAN, big: 0, ghi_bep: 'thanh nằm đỡ đầu đá ở mối nối góc — gác lên thanh đỡ đứng, keo + vít (không khoan cam)' });
          }
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
      // (1.34.1) táp chân gỗ: thân bắt đầu ở cao chân; táp đáy phủ (ảnh 9): mặt dưới cùng đứng TRÊN đáy — thấy cạnh đáy dưới mặt như thấy cạnh nóc trên mặt
      const za = isLow ? (TP && TP.day === 'phu' ? rn(b.zb + kb) : (chan > 0 ? chan + khe : kb) + (TP ? b.z0 : 0)) : b.z0 + khe / 2;
      // (1.34.1) táp: nóc phủ → mặt trên cùng dừng dưới nóc (nóc chồm che đầu mặt); gờ chắn → dưới đỉnh thân (nóc thụt), không lên tới đỉnh hồi
      const zb = isTop ? (TP ? rn((TP.noc === 'phu' ? b.zt : b.z1) - kb) : pT > 0 ? H - pT - khe : H - kb) : b.z1 - khe / 2;
      return [za, zb];
    };
    const doorCols = [], daBaoBL = new Set();      // {khoang, x, w, open}; daBaoBL: (1.31.1) cảnh báo bản lề — mỗi khoang / cỡ cánh một lần
    {
      let kdoor = 0;
      for (let i = 0; i < n; i++) {
        const nd = s.khoang[i].canh; if (!nd) continue;
        const mu = B ? s.khoang[i].mu : null;      // (bản 1.34) tủ góc mù: cánh chỉ phủ phần không mù
        if (doorPlan && !mu) {
          for (let d = 0; d < nd; d++) doorCols.push({ khoang: i, x: rn(doorPlan.x0 + (kdoor + d) * (doorPlan.w + khe)), w: doorPlan.w, open: nd === 2 ? (d === 0 ? 1 : 2) : (s.khoang[i].ban_le === 'phai' ? 2 : 1) });
          kdoor += nd;
        } else {
          let L = i === 0 ? DL : xs[i] + tv[i] / 2 + khe / 2;
          let R = i === n - 1 ? DR : xs[i + 1] + tv[i + 1] / 2 - khe / 2;
          if (mu && mu.rong > 0) { if (mu.ben === 'trai') L = Math.max(L, rn(mu.rong + khe)); else R = Math.min(R, rn(W - mu.rong - khe)); }
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
    const nk = s.ngan_keo, nkRongDaBao = new Set(), daBaoXaTap = new Set();      // khoang đã có cảnh báo "mặt ngăn kéo rộng" (quy tắc cũ)
    const vungTrum = [];      // vùng mặt ngăn kéo trùm ngoài: cánh phải tránh ra {khoang, b, f0, f1}
    // loại ngăn kéo của một ô: loại ô chọn → loại mặc định → loại đầu danh sách
    const loaiNK = ma => nk.loai.find(x => x.ma === ma) || nk.loai.find(x => x.ma === nk.mac_dinh) || nk.loai[0] || null;
    const daBao = new Set();
    // tham số gửi cho mẫu: BH + tham số riêng của loại ('mat' → cao mặt) + phần mặt nhô ra do lõi tính
    const thamSo = (lo, bh, mat, nho) => { const o = { BH: bh }; for (const k of Object.keys(lo.ts)) o[k] = lo.ts[k] === 'mat' ? mat : lo.ts[k]; return Object.assign(o, nho); };
    // hộp ngăn kéo (không kể mặt) cao bao nhiêu với mặt cao `mat`: mẫu để hộp thấp hơn mép trên mặt SLK, cao hơn mép dưới mặt XLK
    const hopCao = (lo, mat) => ('CMG' in lo.ts ? Infinity : mat - (typeof lo.ts.SLK === 'number' ? lo.ts.SLK : 0) - (typeof lo.ts.XLK === 'number' ? lo.ts.XLK : 0));
    if (cells.some(c => c.kieu === 'suot') && !s.suot.mau_id) warn('Chưa khai mã mẫu suốt treo (Chuẩn xưởng → Suốt treo): suốt treo sẽ không được vẽ.', 'mau');
    // Suốt treo ở khoang dính vùng khấu cột (bản 1.23 — cột nằm TRONG khoang): hộp che cột chỉ chiếm phần SAU của một đoạn khoang. Thanh suốt nằm giữa chiều sâu khoang; nếu nó
    // (kể cả bas đỡ, hở SUOT_HO) đi lọt TRƯỚC mặt hộp che cột thì suốt vẫn đặt như khoang thường — hai đầu bắt vào tấm đứng hai bên khoang (tấm bị khấu vẫn sâu tới mặt hộp).
    // Không lọt thì suốt lùi ra phần nông trước cột như trước (kiemSX cảnh báo khoang treo nông).
    const SUOT_HO = 30, sauDay = shelfDepth, daNhacCot = new Set();
    const hocBep = [];      // (bản 1.34) ô hốc thiết bị: { khoang, tb, z0, z1, lot, sau } — kiemBep kiểm hốc lò 560 – 568 × ≥ 585, khoang tủ lạnh theo máy
    const roBep = [];      // (bản 1.33) rổ phụ kiện của các mặt kéo: { khoang, pk, z0, z1 (khoảng của rổ), lot, sau } — kiemBep kiểm lọt lòng / sâu / cao
    const cotChe = i => { const a = bayX(i), b2 = a + widths[i]; let che = 0; for (const K of KH) if (!kNgoai(K, a, b2)) che += Math.max(0, Math.min(b2, K.xb + K.eB) - Math.max(a, K.xa - K.eA)); return rn(che); };
    for (const c of cells) {
      if (!c.kieu) continue;
      const i = c.khoang, k = s.khoang[i], za = c.z0, zb = c.z1, cao = zb - za, m = c.so;
      const shelfDepth = sauKhoang[i];      // khoang dính vùng khấu cột: ngăn kéo / vách đệm / suốt treo chỉ sâu tới phần nông
      const viTri = `Khoang ${i + 1}, ô +${g(za)} … +${g(zb)}`;
      if (c.kieu === 'hoc') {
        // (bản 1.34) HỐC THIẾT BỊ: không cánh trong dải của ô (cánh tách quanh nó như quanh mặt ngăn kéo trùm); đợt hai biên là đợt cố định (khoan cam như đợt thùng).
        // Hốc lò: đợt đỡ lò ngắn lại LO_THOAT phía sau — khe thoát nhiệt sau lò (F&P OM60: 560 × 50).
        const [dza, dzb] = doorZ(c.b), tim = z => Math.round(z + t / 2);
        // (bản 1.35) hốc tủ lạnh ÂM: cánh ốp phủ hốc thành một đoạn cánh riêng (như ô rổ cánh mở) — hốc khác: không cánh trong dải của ô
        const opTL = c.tb === 'tl' && B && B.tb && B.tb.tl && B.tb.tl.kieu === 'am' && k.canh > 0;
        vungTrum.push(Object.assign({ khoang: i, b: c.b, f0: c.zDuoi === null ? dza : rn(tim(c.zDuoi) + khe / 2), f1: c.zTren === null ? dzb : rn(tim(c.zTren) - khe / 2) }, opTL ? { canh: true, tl: true } : {}));
        hocBep.push({ khoang: i, tb: c.tb, z0: rn(za), z1: rn(zb), lot: rn(widths[i]), sau: rn(shelfDepth) });
        if (c.tb === 'lo' && c.zDuoi !== null) {
          const d = M.parts.find(p => p.loai === 'DOT' && p.khoang === i && Math.abs(p.z0 - c.zDuoi) < TOL);
          if (d) { d.y1 = rn(d.y1 - LO_THOAT); d.ghi_bep = `đợt đỡ lò — cố định (khoan cam), ngắn ${g(LO_THOAT)} phía sau cho lò thoát nhiệt`; }
        }
        continue;
      }
      const lo = c.kieu === 'suot' || c.kieu === 'keo_pk' ? null : loaiNK(c.loai);
      if (c.kieu !== 'suot' && c.kieu !== 'keo_pk') {
        if (!lo) { if (!daBao.has('')) { daBao.add(''); err('Chưa có loại ngăn kéo nào (Chuẩn xưởng → Các loại ngăn kéo).', 'mau'); } continue; }
        if (!lo.mau_id && !daBao.has(lo.ma)) { daBao.add(lo.ma); warn(`Chưa khai mã mẫu ngăn kéo cho loại "${lo.ten}" (Chuẩn xưởng → Các loại ngăn kéo): ngăn kéo loại này sẽ không được vẽ.`, 'mau'); }
      }
      if (c.kieu === 'suot') {
        if (cao < s.suot.cach_dot + 60) { err(`${viTri}: khoảng treo chỉ cao ${g(cao)} — không đủ chỗ treo suốt.`, 'suot'); continue; }
        const lot = shelfDepth < sauDay - TOL && sauDay / 2 + SUOT_HO <= shelfDepth + TOL;      // khoang dính cột mà thanh suốt đi lọt trước hộp che cột
        M.templates.push({ loai: 'SUOT', id: s.suot.mau_id, ten: s.suot.ten_mau, tu: c.b.tu, khoang: i,
          box: [rn(widths[i]), rn(lot ? sauDay : shelfDepth), rn(cao)], pos: [bayX(i), 0, rn(za)], params: { BH: t, JS: s.suot.cach_dot, YGKC: 0 } });
        if (lot && !daNhacCot.has(i)) { daNhacCot.add(i); const che = cotChe(i); if (che >= 100) warn(`Khoang ${i + 1}: hộp che cột chiếm ${g(che)} trong ${g(widths[i])} bề ngang ở phía sau — đoạn suốt treo nằm trước cột không treo được móc áo ngang (còn ${g(rn(widths[i] - che))} treo được).`, 'suot'); }
        continue;
      }
      if (c.kieu === 'nk_am') {
        // (bản 1.31) khung mặt: thanh ngang `ray` phẳng mặt ngăn kéo thay cho khe trên / khe giữa; mặt cách thanh `khe_ben`
        // (bản 1.34.1) táp: ngăn kéo LỌT LÒNG giữa hai hồi, mặt phẳng mặt hồi (lùi = dày mặt), khe quanh mặt `khe_ben`; giữa 2 mặt là THANH NGANG nằm (ván thùng, phẳng mặt) khi tap.thanh
        // (soát 1.34.1) khoang táp có CÁNH: ngăn kéo nằm SAU cánh như tủ áo (lùi nk.lui, vách đệm / nẹp tránh bản lề, khung mặt theo Chuẩn xưởng), không tay nắm —
        // kiểu lọt lòng phẳng mặt hồi của táp là áp sát lưng cánh (khe 0, núm đâm vào cánh), thanh ngang suốt khoang đâm qua vách đệm / nẹp
        const TPk = TP && !(k.canh > 0) ? TP : null;
        const khung = !TPk && !!nk.khung_mat && nk.ray > 0, R = nk.ray, gk = nk.khe_ben, thanhTP = !!TPk && TPk.thanh > 0;
        const kTren = TPk ? gk : khung ? R + gk : nk.khe_tren, kGiua = TPk ? (thanhTP ? t + 2 * gk : khe) : khung ? R + 2 * gk : nk.khe_giua;
        const luiNK = TPk ? t : nk.lui;
        const tongMat = cao - kTren - nk.khe_duoi - kGiua * (m - 1);
        const mat = Math.floor(tongMat / m * 2 + 1e-9) / 2, duMat = rn(tongMat - mat * m);      // mặt chẵn 0,5 mm; phần dư dồn vào khe trên cùng
        if (mat < 60) { err(`${viTri}: mặt ngăn kéo chỉ cao ${g(mat)} — giảm số ngăn hoặc nới ô.`); continue; }
        if (hopCao(lo, mat) < 40) { err(`${viTri}: mặt ngăn kéo cao ${g(mat)} thì hộp ngăn kéo chỉ còn ${g(hopCao(lo, mat))} (loại "${lo.ten}") — giảm số ngăn hoặc nới ô.`); continue; }
        if (mat > 450) warn(`${viTri}: mặt ngăn kéo cao ${g(mat)} (> 450) — nên thêm ngăn hoặc hạ đợt phía trên.`);
        const sauNK = Math.floor((shelfDepth - luiNK - nk.ho_sau) / nk.buoc_sau + 1e-9) * nk.buoc_sau;
        if (sauNK < 200) { const viCot = shelfDepth < yb0 - TOL; if (viCot && M.info.nk_vuong_cot.indexOf(i) < 0) M.info.nk_vuong_cot.push(i); err(`${viTri}: thùng quá nông cho ngăn kéo (sâu hộp ${g(sauNK)})${viCot ? ` — khoang này có cột phía sau, thùng trước cột chỉ sâu ${g(shelfDepth)}: chuyển ngăn kéo sang khoang khác` : ''}.`); continue; }
        if (luiNK < t) { err(`Ngăn kéo: "lùi" (${g(luiNK)}) phải ≥ dày mặt ngăn kéo (${g(t)}).`); continue; }
        // Ngăn kéo âm nằm sau cánh mở: bản lề bắt trên chính hồi/vách của khoang, nên mặt + hộp ngăn kéo phải lùi vào `dem` ở mỗi bên có bản lề.
        // Bên đó đặt 1 vách đệm (đứng giữa 2 tấm nằm trên dưới ô) để bắt ray; khe giữa hồi/vách và vách đệm là chỗ cho bản lề.
        const banLeTrai = k.canh === 2 || (k.canh === 1 && k.ban_le !== 'phai'), banLePhai = k.canh === 2 || (k.canh === 1 && k.ban_le === 'phai');
        const dem = nk.dem > 0 ? nk.dem : 0;
        if (dem > 0 && dem < t) { err(`Ngăn kéo: khoảng đặt vách đệm (${g(dem)}) phải ≥ dày ván ${g(t)} (Chuẩn xưởng → Ngăn kéo).`); continue; }
        const demL = banLeTrai ? dem : 0, demR = banLePhai ? dem : 0;
        const x0 = rn(bayX(i) + demL), L = rn(widths[i] - demL - demR);
        if (L < 300) {
          // (soát 1.34.1) táp: ngăn kéo lọt lòng giữa hai hồi, không vách đệm / bản lề — nói rộng tối thiểu của TÁP (một khoang: lòng đi 1 : 1 theo rộng phủ bì)
          if (TPk) err(`Khoang ${i + 1}: ngăn kéo lọt lòng của táp chỉ rộng ${g(L)} (cần ≥ 300) — ${s.khoang.length === 1 ? `đặt táp rộng ≥ ${g(Math.ceil((s.rong + 300 - L) / 5 - 1e-9) * 5)}` : 'nới khoang này'}.`);
          else err(`Khoang ${i + 1}: quá hẹp cho ngăn kéo âm — sau khi trừ vách đệm tránh bản lề chỉ còn ${g(L)} (cần ≥ 300).`);
          continue;
        }
        if (k.canh > 0 && !dem) warn(`Khoang ${i + 1}: ngăn kéo âm chạy sát hồi/vách có bản lề (vách đệm = 0) — ngăn kéo sẽ vướng bản lề khi kéo ra.`);
        else if (k.canh > 0 && dem - t < 25) warn(`Khoang ${i + 1}: khe cho bản lề giữa hồi/vách và vách đệm chỉ ${g(dem - t)} (< 25) — dễ cấn tay bản lề.`);
        // có nẹp che (bản 1.28): vách đệm bắt đầu ngay sau lưng nẹp — nẹp che kín cạnh trước của nó
        const coNep = !!nk.nep_khe && dem > 0, yDem = coNep ? luiNK : luiNK - t;
        if (dem > 0) {
          if (demL) P({ loai: 'DEM', ten: NM.dem, than: c.than, tu: c.b.tu, type: 1, x0: x0 - t, x1: x0, y0: yDem, y1: shelfDepth, z0: za, z1: zb, big: 1, khoang: i });
          if (demR) P({ loai: 'DEM', ten: NM.dem, than: c.than, tu: c.b.tu, type: 1, x0: x0 + L, x1: x0 + L + t, y0: yDem, y1: shelfDepth, z0: za, z1: zb, big: 0, khoang: i });
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
          const duoi = q === 0 ? nk.khe_duoi : kGiua / 2, tren = q === m - 1 ? kTren + duMat : kGiua / 2;
          const h = duoi + mat + tren;
          matZ.push([rn(z + duoi), rn(z + duoi + mat)]);
          M.mat_ngan_keo.push(Object.assign({ khoang: i, x: rn(x0 + nk.khe_ben), z: rn(z + duoi), w: rn(L - 2 * nk.khe_ben), h: rn(mat), y: rn(luiNK - t), t, trum: false }, TPk ? { tay_nam: TPk.tay_nam === 'khe' ? 'num' : TPk.tay_nam } : {}));      // khe tay nắm (J) chỉ có giữa mặt TRÙM → mặt lọt lòng dùng núm
          M.templates.push({ loai: 'NGAN_KEO', kieu: 'nk_am', id: lo.mau_id, ten: lo.ten_mau, ma_loai: lo.ma, ten_loai: lo.ten, tu: c.b.tu, than: c.than, khoang: i, o: [rn(za), rn(zb)], mat: M.mat_ngan_keo.length - 1,
            bac_sau: { tu: rn(shelfDepth - luiNK - nk.ho_sau), buoc: nk.buoc_sau },      // sâu hộp = floor(tu / buoc) × buoc — nhảy bậc theo cỡ ray
            box: [L, sauNK, rn(h)], pos: [x0, luiNK, rn(z)],     // gốc mẫu = lưng mặt ngăn kéo; mặt NK dày BH nằm phía trước gốc (y = lùi − BH … lùi), hộp từ y = lùi
            params: thamSo(lo, t, mat, { SYS: -tren, XYS: -duoi, ZYS: -nk.khe_ben, YYS: -nk.khe_ben }) });
          z += h;
        }
        // Xà ngăn kéo: ván đứng nằm ngay SAU lưng mặt ngăn kéo, che khe phía trên mỗi mặt (khe luồn tay của mặt vát) và giằng 2 vách đệm lại.
        // Xà phải nằm lọt trong khoảng trống giữa 2 hộp ngăn kéo: hộp thấp hơn mép trên mặt SLK, cao hơn mép dưới mặt XLK (mẫu không khai thì coi như 0).
        if (TPk) {
          // (1.34.1) táp: thanh ngang giữa 2 mặt ngăn kéo — ván thùng NẰM (thấy cạnh như đợt), sâu `thanh_sau`, kẹp giữa 2 tấm đứng, khoan cam; không xà ẩn / khung mặt
          if (thanhTP) for (let q = 0; q + 1 < m; q++) { const z0 = rn(matZ[q][1] + gk); P({ loai: 'DOT', ten: 'Thanh ngang ngăn kéo', than: c.than, tu: c.b.tu, type: 0, x0: bayX(i), x1: rn(bayX(i) + widths[i]), y0: 0, y1: rn(Math.min(TP.thanh_sau, shelfDepth)), z0, z1: rn(z0 + t), big: 1, khoang: i, thanh_nk: true }); }
        } else if (khung) {
          // thanh ngang khung mặt: giữa 2 mặt kề nhau (lọt giữa 2 nẹp / vách đệm) + thanh trên sát mặt dưới đợt (có nẹp thì chạy suốt bề ngang khoang, nẹp dừng dưới nó)
          // thanh giữa: CẢ HAI đầu tì vào cạnh nẹp (nẹp bắn đinh, không khoan) → keo + đinh như nẹp. Đầu nào tì vào vách đệm / hồi / vách thì khoan cam như ván thùng —
          // nhưng mối nối chỉ dài bằng bề cao thanh: dưới 60 thì không khoan cam được (trang giả lập theo quy tắc khoảng của Chenfeng: mối nối < 60 không khoan — CHƯA ĐO trên bản thật)
          // → bắt vít / chốt gỗ, ghi rõ trong bảng kê. (1.31.1: trước xét cờ chung nep_khe nên khoang không cánh / 1 cánh cũng ghi oan "giữa 2 nẹp, keo + đinh")
          const haiNep = coNep && demL > 0 && demR > 0, ngan = R < 60;
          for (let q = 0; q + 1 < m; q++) { const z0 = rn(matZ[q][1] + gk); P({ loai: 'XA', ten: NM.xa, than: c.than, tu: c.b.tu, type: 2, x0, x1: x0 + L, y0: rn(luiNK - t), y1: luiNK, z0, z1: rn(z0 + R), big: 0, khoang: i, khung_mat: true, ...(haiNep ? { khoan: KHONG_KHOAN, fd: false, bd: false, keo_nep: true } : ngan ? { khoan: KHONG_KHOAN, vit_ray: true, ...GIAU_LO } : GIAU_LO) }); }
          const xa = coNep ? bayX(i) : x0, xb = coNep ? rn(bayX(i) + widths[i]) : rn(x0 + L);
          P({ loai: 'XA', ten: NM.xa, than: c.than, tu: c.b.tu, type: 2, x0: xa, x1: xb, y0: rn(luiNK - t), y1: luiNK, z0: rn(zb - R), z1: zb, big: 0, khoang: i, tren: true, khung_mat: true, ...GIAU_LO });
        } else if (nk.xa_cao > 0) {
          const HO = 5, biet = !('CMG' in lo.ts);
          const slk = biet && typeof lo.ts.SLK === 'number' ? lo.ts.SLK : 0, xlk = biet && typeof lo.ts.XLK === 'number' ? lo.ts.XLK : 0;
          const ya = rn(luiNK + nk.xa_ho);
          let thieu = 0;
          for (let q = 0; q < m; q++) {
            const khe0 = matZ[q][1], khe1 = q === m - 1 ? zb : matZ[q + 1][0];                      // khe cần che
            const lo_ = rn(khe0 - slk + HO), hi_ = q === m - 1 ? zb : rn(khe1 + xlk - HO);         // khoảng trống cho xà
            const hx = Math.min(nk.xa_cao, Math.floor(hi_ - lo_ + 1e-9));
            if (hx < 30 || hx < khe1 - khe0 - TOL) { thieu++; continue; }
            const z0 = q === m - 1 ? zb - hx : Math.max(lo_, Math.min(hi_ - hx, (khe0 + khe1) / 2 - hx / 2));
            P({ loai: 'XA', ten: NM.xa, than: c.than, tu: c.b.tu, type: 2, x0, x1: x0 + L, y0: ya, y1: ya + t, z0, z1: z0 + hx, big: 0, khoang: i, tren: q === m - 1, ...GIAU_LO });
          }
          if (ya + t > shelfDepth) err(`${viTri}: thùng quá nông, không đủ chỗ đặt xà ngăn kéo.`);
          if (thieu) note(`${viTri}: ${thieu} khe mặt ngăn kéo không đủ chỗ đặt xà (loại "${lo.ten}": theo tham số mẫu, hộp ngăn kéo cao gần bằng mặt) — khe đó để hở. Muốn có xà: tăng khe hoặc khai SLK / XLK của loại này ở Chuẩn xưởng.`);
        }
        // Nẹp che khe: ván đứng ngang mặt ngăn kéo, che từ hồi/vách tới mép trong vách đệm — bịt khe bản lề VÀ cạnh trước vách đệm (hẹp nên bắn đinh, không khoan cam).
        if (coNep) {
          const nep = (xa, xb) => P({ loai: 'NEP', ten: NM.nep, than: c.than, tu: c.b.tu, type: 2, x0: xa, x1: xb, y0: luiNK - t, y1: luiNK, z0: za, z1: khung ? rn(zb - R) : zb, big: 0, fd: false, bd: false, khoan: KHONG_KHOAN, khoang: i });
          if (demL) nep(bayX(i), x0);
          if (demR) nep(x0 + L, bayX(i) + widths[i]);
          // (bản 1.30.1 — anh Thanh 08/10/2026: "vùng hộc thụt vào 5 cm sẽ không bị ảnh hưởng gì cả") vùng hộc kéo âm có vách đệm không cấn bản lề → không dời bản lề, không ghi chú
        }
        continue;
      }
      // (bản 1.34.1) táp khe tay nắm: khe giữa các mặt trùm = `khe_tn` (kiểu J — ngón tay luồn vào mép mặt), không tay nắm nổi
      const kheF = TP && TP.tay_nam === 'khe' ? TP.khe_tn : khe;
      // nk_trum — ngăn kéo trùm ngoài: mặt nằm ở mặt phẳng cánh, phủ lên mép đợt/đáy như cánh; khoang không có cánh ở vùng này nên không vướng bản lề
      const [dza, dzb] = doorZ(c.b);
      // đường chia giữa mặt ngăn kéo và cánh (hoặc mặt ngăn kéo ô kề) tại một đợt = tim đợt, làm tròn 1 mm để cánh và mặt ngăn kéo ra số chẵn
      const tim = z => Math.round(z + t / 2);
      const f0 = c.zDuoi === null ? dza : rn(tim(c.zDuoi) + kheF / 2);       // mép dưới mặt dưới cùng
      const f1 = c.zTren === null ? dzb : rn(tim(c.zTren) - kheF / 2);       // mép trên mặt trên cùng
      // (bản 1.33, tủ bếp) c.cao = cao các mặt TRÊN CÙNG, tính từ trên xuống (mặt nông 180 dưới mặt đá); các mặt còn lại chia đều như cũ. Không có c.cao thì như cũ.
      const coDinh = c.cao || [], kD = Math.min(coDinh.length, m - 1), mTu = m - kD, tongD = sum(coDinh.slice(0, kD));
      const hf = Math.floor((f1 - f0 - (m - 1) * kheF - tongD) / mTu * 2 + 1e-9) / 2;       // mặt chẵn 0,5 mm
      const duF = rn(f1 - f0 - tongD - (mTu * hf + (m - 1) * kheF));                        // phần dư: chia 0,5 mm cho các mặt dưới cùng (các mặt lệch nhau không quá 0,5)
      const n05 = Math.floor(duF / 0.5 + 1e-9), le = rn(duF - n05 * 0.5);
      const caoMat = q => (q >= mTu ? coDinh[m - 1 - q] : rn(hf + (q < n05 ? 0.5 : 0) + (q === 0 ? le : 0)));
      // (1.33, vòng soát 2) mặt cố định (c.cao) qua cùng phép kiểm như mặt chia đều: thấp nhất cho "< 60" / hộp quá thấp, cao nhất cho "> 450"
      const hs = coDinh.slice(0, kD).concat([hf]), hMin = Math.min(...hs), hMax = Math.max(...hs);
      if (hMin < 60) { err(`${viTri}: mặt ngăn kéo chỉ cao ${g(hMin)} — giảm số ngăn hoặc nới ô.`); continue; }
      if (c.kieu === 'keo_pk' && c.pk.length === 1 && ['canh', 'goc'].indexOf((LOAI_PK_BEP.find(x => x.ma === c.pk[0]) || {}).lap) >= 0) {      // (1.34) rổ góc: như rổ cánh mở
        // (1.33, vòng soát 2) RỔ CÁNH MỞ (tủ đồ khô 450 / 600): khung rổ bắt hồi, ô có CÁNH + bản lề như cánh thường (phần cánh bên dưới dựng) — không mặt kéo
        const pk = LOAI_PK_BEP.find(x => x.ma === c.pk[0]);
        if (!k.canh) { err(`${viTri}: ${pk.ten.toLowerCase()} cần cánh — đặt số cánh của khoang ${i + 1} ≥ 1.`); continue; }
        vungTrum.push({ khoang: i, b: c.b, f0, f1, canh: true });
        roBep.push({ khoang: i, pk: pk.ma, z0: rn(za), z1: rn(zb), lot: rn(widths[i]), sau: rn(shelfDepth) });
        continue;
      }
      if (c.kieu === 'keo_pk') {
        // MẶT KÉO RỔ: một tấm mặt ở mặt phẳng cánh bắt vít thẳng vào rổ phụ kiện (ray đi theo rổ) — không hộp, không mẫu Chenfeng, không khoan; c.pk xếp từ trên xuống như c.cao
        const [fx0, fx1] = vungMat(i);
        vungTrum.push({ khoang: i, b: c.b, f0, f1 });
        for (let q = 0, zq = f0; q < m; q++) {
          const fz0 = zq, fz1 = rn(fz0 + caoMat(q)); zq = rn(fz1 + kheF);
          const bz0 = q === 0 ? za : rn(fz0 - kheF / 2), bz1 = q === m - 1 ? zb : rn(fz1 + kheF / 2), ma = c.pk[m - 1 - q], pk = LOAI_PK_BEP.find(x => x.ma === ma);
          P({ loai: 'MKP', ten: `Mặt ngăn kéo (rổ ${pk.ten.toLowerCase()})`, than: c.than, tu: c.b.tu, type: 2, x0: fx0, x1: fx1, y0: -tc, y1: 0, z0: fz0, z1: fz1, khoan: KHONG_KHOAN, big: 0, fd: false, bd: false, khoang: i, vit_pk: true, pk: ma,
            ghi_bep: 'mặt kéo bắt vít vào rổ (ray đi theo phụ kiện), không khoan' });
          roBep.push({ khoang: i, pk: ma, z0: bz0, z1: bz1, lot: rn(widths[i]), sau: rn(shelfDepth) });
        }
        continue;
      }
      if (hopCao(lo, hMin) < 40) { err(`${viTri}: mặt ngăn kéo cao ${g(hMin)} thì hộp ngăn kéo chỉ còn ${g(hopCao(lo, hMin))} (loại "${lo.ten}") — giảm số ngăn hoặc nới ô.`); continue; }
      // (1.33, vòng soát 3) ô trên cùng của tủ có GIẰNG (zb = mặt dưới giằng): mặt trên cùng vẫn phủ lên tới mép trên thùng (che giằng), còn HỘP phải lọt dưới giằng
      // trừ KHE_GIANG_NK — kéo ra không vướng giằng trước. Theo mô hình mặt / hộp của mẫu (mặt z −XYS … H + SYS, hộp thấp hơn mép trên mặt SLK) đỉnh hộp thật =
      // pos + box + SYS − SLK = mép trên mặt − SLK → hạ hộp bằng cách ghi SLK riêng cho mẫu trên cùng (ghi vào params; lệnh gốc không vẽ tủ có giằng nên bước NK không cần).
      // Loại không có SLK (hộp ray Blum cố định) / chia ô (hộp = mặt) thì không hạ được → LỖI. Phép kiểm "hộp quá thấp" xét hộp thật đó.
      let slkTren = null;
      if (c.zTren === null && B && B.noc === 'giang' && !phuHoi) {
        const coSLK = typeof lo.ts.SLK === 'number' && !('CMG' in lo.ts), slk0 = coSLK ? lo.ts.SLK : 0, xlk0 = typeof lo.ts.XLK === 'number' ? lo.ts.XLK : 0, lim = rn(zb - KHE_GIANG_NK);
        if (rn(f1 - slk0) > lim + TOL) {
          if (!coSLK) { err(`${viTri}: hộp ngăn kéo loại "${lo.ten}" cao tới +${g(rn(f1 - slk0))}, vướng giằng trước (mặt dưới giằng +${g(zb)}) — loại này không hạ hộp được: ${B.chuc_nang === 'chau' || B.chuc_nang === 'bep' ? '' : 'chọn Nóc liền (khối Tủ bếp → Nóc), '}chọn loại ray bi / ray âm hoặc bỏ ngăn trên cùng.`); continue; }
          slkTren = rn(f1 - lim);
          const hopTren = rn(caoMat(m - 1) - slkTren - xlk0);
          if (hopTren < 40) { err(`${viTri}: mặt trên cùng cao ${g(caoMat(m - 1))} phải che giằng ${g(rn(f1 - zb))} nên hộp ngăn kéo dưới giằng chỉ còn ${g(hopTren)} (loại "${lo.ten}") — tăng cao mặt trên cùng hoặc giảm bề rộng giằng.`); continue; }
        }
      }
      if (hMax > 450) warn(`${viTri}: mặt ngăn kéo cao ${g(hMax)} (> 450) — nên thêm ngăn hoặc hạ đợt phía trên.`);
      const sauNK = Math.floor((shelfDepth - nk.ho_sau) / nk.buoc_sau + 1e-9) * nk.buoc_sau;
      if (sauNK < 200) { const viCot = shelfDepth < yb0 - TOL; if (viCot && M.info.nk_vuong_cot.indexOf(i) < 0) M.info.nk_vuong_cot.push(i); err(`${viTri}: thùng quá nông cho ngăn kéo (sâu hộp ${g(sauNK)})${viCot ? ` — khoang này có cột phía sau, thùng trước cột chỉ sâu ${g(shelfDepth)}: chuyển ngăn kéo sang khoang khác` : ''}.`); continue; }
      const [fx0, fx1] = vungMat(i);
      if (fx1 - fx0 > 1200) { warn(`${viTri}: mặt ngăn kéo rộng ${g(fx1 - fx0)} (> 1200) — nên chia khoang nhỏ hơn.`); nkRongDaBao.add(i); }
      vungTrum.push({ khoang: i, b: c.b, f0, f1 });
      for (let q = 0, zq = f0; q < m; q++) {
        const fz0 = zq, fz1 = rn(fz0 + caoMat(q)); zq = rn(fz1 + kheF);
        const bz0 = q === 0 ? za : rn(fz0 - kheF / 2), bz1 = q === m - 1 ? zb : rn(fz1 + kheF / 2);     // kheF hộp: chia ô theo tim kheF giữa 2 mặt
        M.mat_ngan_keo.push(Object.assign({ khoang: i, x: fx0, z: fz0, w: rn(fx1 - fx0), h: rn(fz1 - fz0), y: -tc, t: tc, trum: true }, TP ? { tay_nam: TP.tay_nam } : {}));
        // (1.34.1, ảnh 9) táp khe tay nắm: THANH NGANG nằm giữa khe (ván thùng, sâu thanh_sau) — nhìn qua khe không thấy xuyên vào lòng tủ.
        // (1.36.2 — anh Thanh: "phải có khe móc như trong tủ áo chứ ai để lòi ra vậy") thanh LÙI `lui_thanh` sau lưng mặt (trước: y 0, cạnh thanh lòi ra ngay
        // sau khe) → rãnh móc tay; thùng nông thì lùi ít lại để thanh vẫn sâu đủ thanh_sau. Thanh nằm giữa HỘP THẬT của hai ngăn kéo (hộp thấp hơn mép trên mặt
        // SLK, cao hơn mép dưới mặt XLK — như xà ngăn kéo tủ áo; chia ô: hộp = mặt): chồng lên hộp thì cảnh báo (lùi sâu nữa không gỡ được — hộp chạy suốt chiều sâu).
        // (1.36.3 — anh Thanh 16/10/2026, ảnh 3D: "ke này hở xấu quá phải có xà 5cm bên trong chứ ai làm xà nằm ngang phải làm xà dọc") thanh NẰM nhìn qua khe
        // thấy mặt trên thanh + khe sáng ở đầu thanh → nay là XÀ ĐỨNG (ván type 2, như xà ẩn tủ áo) cao TAP_XA, kẹp giữa hai tấm đứng của khoang, đứng ở y lui_thanh
        // (rãnh móc tay vẫn sâu như 1.36.2): mặt ván quay ra khe, kín suốt bề ngang lòng. Cao xà = min(TAP_XA, chỗ trống giữa HỘP THẬT hai ngăn kéo − 2 × HO) như
        // xà ẩn tủ áo; dưới max(30, khe) thì không làm xà (cảnh báo). s.tap.xa_dung = 0: thanh nằm kiểu 1.34.1 … 1.36.2 (táp đã vẽ — specDaVe).
        // (soát 1.36.3) xà chỉ nhận khi PHỦ TRỌN khe (mép dưới xà ≤ mép dưới khe, mép trên ≥ mép trên khe): loại không khai SLK (hộp ray Blum, khay bàn phím:
        // hộp cao tới mép trên mặt) hay chia ô (hộp = mặt) thì xà cách hộp HO bị đẩy lên / xuống, hở một dải ở mép khe → rơi về thanh NẰM lọt trong khe như 1.36.2
        // (thanh dày t vẫn lọt khe 25 giữa hai hộp), ghi chú một dòng. Khe rộng hơn TAP_XA: xà cao theo khe + TAP_XA_CHONG mỗi phía (trước: không bao giờ có xà).
        const coThanhKhe = TP && TP.tay_nam === 'khe' && TP.thanh > 0 && q + 1 < m;
        const chiaO = 'CMG' in lo.ts, slk = chiaO ? 0 : typeof lo.ts.SLK === 'number' ? lo.ts.SLK : 0, xlk = chiaO ? 0 : typeof lo.ts.XLK === 'number' ? lo.ts.XLK : 0;
        let coXa = false;
        if (coThanhKhe && TP.xa_dung) {
          const HO = 5, lo_ = rn(fz1 - slk + HO), hi_ = rn(fz1 + kheF + xlk - HO), cho = Math.floor(hi_ - lo_ + 1e-9);
          const hx = Math.min(Math.max(TAP_XA, Math.ceil(kheF + 2 * TAP_XA_CHONG)), cho);
          const y0 = rn(Math.max(0, Math.min(TP.lui_thanh, shelfDepth - t)));
          if (hx >= 30) {
            const z0 = rn(Math.max(lo_, Math.min(hi_ - hx, fz1 + kheF / 2 - hx / 2)));
            if (z0 <= fz1 + TOL && z0 + hx >= fz1 + kheF - TOL) {
              coXa = true;
              // xà là ván thùng: khoan liên kết như xà ẩn tủ áo và xà đế 50 cùng tủ (yêu cầu 1.36.3) — không áp quy tắc "< 60 bắt vít" của thanh khung mặt
              P({ loai: 'XA', ten: NM.xa, than: c.than, tu: c.b.tu, type: 2, x0: bayX(i), x1: rn(bayX(i) + widths[i]), y0, y1: rn(y0 + t), z0, z1: rn(z0 + hx), big: 0, khoang: i, xa_tap: true, ...GIAU_LO,
                ghi_bep: `xà đứng lùi ${g(y0)} sau lưng mặt ngăn kéo, che khe tay nắm — rãnh móc tay` });
            }
          }
          if (!coXa && kheF >= t && !daBaoXaTap.has(i)) { daBaoXaTap.add(i); note(`${viTri}: loại ngăn kéo "${lo.ten}" có hộp sát mép mặt (theo tham số mẫu) — không đủ chỗ cho xà đứng che kín khe tay nắm, dùng thanh nằm lùi ${g(TP.lui_thanh)} lọt trong khe như bản 1.36.2.`); }
          if (!coXa && kheF < t) warn(`${viTri}: khe tay nắm ${g(kheF)} để hở, nhìn thấy lòng tủ — loại ngăn kéo "${lo.ten}" có hộp sát mép mặt nên xà đứng không che kín được khe, mà khe hẹp hơn dày ván ${g(t)} nên không đặt được thanh nằm. Tăng khe tay nắm lên ≥ ${g(t)} hoặc chọn loại ngăn kéo khác (ray bi / ray âm).`);
        }
        if (coThanhKhe && !coXa && kheF >= t) {
          const z0 = rn(fz1 + (kheF - t) / 2), y0 = rn(Math.min(TP.lui_thanh, Math.max(0, shelfDepth - TP.thanh_sau)));
          P({ loai: 'DOT', ten: 'Thanh ngang ngăn kéo', than: c.than, tu: c.b.tu, type: 0, x0: bayX(i), x1: rn(bayX(i) + widths[i]), y0, y1: rn(Math.min(y0 + TP.thanh_sau, shelfDepth)), z0, z1: rn(z0 + t), big: 1, khoang: i, thanh_nk: true, ...(y0 > 0.5 ? { ghi_bep: `thanh lùi ${g(y0)} sau lưng mặt ngăn kéo — rãnh móc tay` } : {}) });
          const hoDuoi = rn(z0 - (fz1 - slk)), hoTren = rn((fz1 + kheF + xlk) - (z0 + t));      // khe giữa thanh và hộp ngăn kéo dưới / trên
          if (Math.min(hoDuoi, hoTren) < -TOL) warn(`${viTri}: thanh ngang giữa khe tay nắm chồng lên hộp ngăn kéo (loại "${lo.ten}": hộp ${hoDuoi < hoTren ? 'dưới' : 'trên'} lấn ${g(-Math.min(hoDuoi, hoTren))}) — tăng khe tay nắm hoặc khai SLK / XLK của loại này ở Chuẩn xưởng.`);
        }
        M.templates.push({ loai: 'NGAN_KEO', kieu: 'nk_trum', id: lo.mau_id, ten: lo.ten_mau, ma_loai: lo.ma, ten_loai: lo.ten, tu: c.b.tu, than: c.than, khoang: i, o: [rn(za), rn(zb)], mat: M.mat_ngan_keo.length - 1,
          bac_sau: { tu: rn(shelfDepth - nk.ho_sau), buoc: nk.buoc_sau },
          box: [rn(widths[i]), sauNK, rn(bz1 - bz0)], pos: [bayX(i), 0, rn(bz0)],                      // gốc mẫu y = 0 → mặt nằm ở y = −dày cánh … 0 (mặt phẳng cánh)
          params: thamSo(lo, tc, rn(fz1 - fz0), Object.assign({ SYS: rn(fz1 - bz1), XYS: rn(bz0 - fz0), ZYS: rn(bayX(i) - fx0), YYS: rn(fx1 - bayX(i) - widths[i]) }, q === m - 1 && slkTren !== null ? { SLK: slkTren } : {})) });
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
        for (const v of cam) { if (v.f0 - khe - cur > TOL) doan.push([cur, rn(v.f0 - khe)]); if (v.canh) doan.push([v.f0, v.f1, !!v.tl]); cur = rn(v.f1 + khe); }      // v.canh (1.33): ô rổ cánh mở = một đoạn cánh riêng
        if (zb - cur > TOL) doan.push([cur, zb]);
        for (const [z0, z1, opTL] of doan) {
          if (z1 - z0 < 100) { err(`Khoang ${i + 1}: đoạn cánh +${g(z0)} … +${g(z1)} chỉ cao ${g(z1 - z0)} (< 100) — dời đợt hoặc đổi ô ngăn kéo trùm ngoài.`); continue; }
          if (z1 - z0 > s.van.kho_dai + TOL) { err(`Cánh cao ${g(z1 - z0)} > khổ ván ${g(s.van.kho_dai)}.`); continue; }
          caoCanh.add(rn(z1 - z0));
          for (const dc of cols) {
            const p = P({ loai: 'CANH', ten: dc.open === 2 ? NM.canh_phai : NM.canh_trai, than: b.code, tu: b.tu, type: 2, x0: dc.x, x1: dc.x + dc.w, y0: -tc, y1: 0, z0, z1,
              khoan: KHONG_KHOAN, big: 0, fd: false, bd: false, open: dc.open, khoang: dc.khoang });
            // (bản 1.35) cánh ốp tủ lạnh âm: treo trên cánh máy qua ray dẫn cánh — không bản lề tủ
            if (opTL) { p.op_tl = 1; p.ghi_bep = 'cánh ốp tủ lạnh âm — gắn vào cánh máy bằng bộ ray dẫn cánh (theo máy), không bản lề tủ, không khoan chén'; }
            else { // (bản 1.30) bản lề: số + vị trí cho MỌI cánh (vẽ trên hình, kê trong bảng); khoét chén chỉ khi bật chen_ban_le
              const ch = s.canh.chen, hh = z1 - z0, r = ch.d / 2, benTrai = dc.open !== 2;      // cánh mở trái = bản lề bên trái
              const tranh = [];
              // tấm nằm chạy tới hồi / vách (đợt cố định; 1.31.1: cả đáy, nóc — cánh thấp) → đế bản lề (chữ thập, cao ~40–50) bắt trên hồi / vách cấn nó: tâm bản lề cách mặt tấm ít nhất DE_BL / 2
              for (const d of M.parts) if ((d.loai === 'DOT' || d.loai === 'DAY' || d.loai === 'NOC' || d.loai === 'GIANG') && d.khoang <= dc.khoang && dc.khoang <= (d.den_khoang === undefined ? d.khoang : d.den_khoang) && d.z1 > z0 - DE_BL && d.z0 < z1 + DE_BL) tranh.push([rn(d.z0 - z0 - (DE_BL / 2 - r)), rn(d.z1 - z0 + (DE_BL / 2 - r))]);
              const bl = banLeCanh(hh, dc.w, { cach_dau: ch.cach_dau, r, tranh });
              p.ban_le = { so: bl.so, z: bl.z, ben: benTrai ? 'trai' : 'phai', loai: s.canh.loai_ban_le };
              if (bl.ket) { const kb = dc.khoang + '|' + rn(hh); if (!daBaoBL.has(kb)) { daBaoBL.add(kb); warn(bl.vung ? `Cánh khoang ${dc.khoang + 1} cao ${g(hh)}: không đủ chỗ đặt ${bl.so} bản lề tránh đợt / nóc / đáy (đế bản lề cấn tấm nằm) — xem lại vị trí bản lề trên hình.` : `Cánh khoang ${dc.khoang + 1} cao ${g(hh)}: quá thấp cho ${bl.so} bản lề — xem lại vị trí bản lề trên hình.`); } }
              if (s.canh.chen_ban_le) { const u = benTrai ? ch.tam_mep : dc.w - ch.tam_mep; for (const v of bl.z) p.holes.push({ kieu: 'tron', u, v, r, z: 0, sau: ch.sau }); }
            }
          }
        }
      }
    }
    // (bản 1.34) TẤM CHE MÙ của tủ góc: cố định, phẳng mặt cánh — khoang có cánh: che từ mép module (phía mù) tới mu.rong; khoang không cánh: che cả mặt khoang
    if (B) for (let i = 0; i < n; i++) {
      const k = s.khoang[i], mu = k.mu; if (!mu) continue;
      const [xa, xb] = k.canh > 0 ? (mu.rong > 0 ? (mu.ben === 'trai' ? [DL, mu.rong] : [rn(W - mu.rong), DR]) : [0, 0]) : vungMat(i);
      if (xb - xa < 30) { if (k.canh > 0) err(`Khoang ${i + 1}: tấm che mù rộng ${g(rn(xb - xa))} — tủ góc hẹp hơn cánh + khe.`, 'bep'); continue; }
      for (const b of bodies) { const [za, zb] = doorZ(b); P({ loai: 'MU', ten: NM_MU, than: b.code, tu: b.tu, type: 2, x0: xa, x1: xb, y0: -tc, y1: 0, z0: za, z1: zb, khoan: KHONG_KHOAN, big: 0, fd: false, bd: false, khoang: i,
        ghi_bep: 'che phần mù tủ góc — cố định, bắt vít từ trong ra (hồi, đáy, giằng / nóc), không khoan cam' }); }
    }
    { const lb = banLeDung(s); if (lb && lb.ma !== 'tu_chon' && doorCols.length && (tc < lb.day[0] - TOL || tc > lb.day[1] + TOL)) warn(`Cánh dày ${g(tc)} nằm ngoài khoảng dày cánh của bản lề ${lb.ten} (${g(lb.day[0])}–${g(lb.day[1])}).`); }
    for (const dc of doorCols) {
      if (dc.w > 600 && !dc._w && !(B && B.chuc_nang === 'tl' && B.tb.tl && B.tb.tl.kieu === 'am')) { dc._w = 1; warn(`Cánh rộng ${g(dc.w)} (> 600) ở khoang ${dc.khoang + 1}: dễ xệ, nên chia 2 cánh.`); }
      if (dc.w < 150 && !dc._n) { dc._n = 1; warn(`Cánh chỉ rộng ${g(dc.w)} ở khoang ${dc.khoang + 1}.`); }
    }
    M.info.canh = { rong: [...new Set(doorCols.map(d => rn(d.w)))], cao: [...caoCanh].sort((a, b) => b - a), so: M.parts.filter(p => p.loai === 'CANH').length, ban_le: M.parts.filter(p => p.loai === 'CANH' && p.ban_le).reduce((n, p) => n + p.ban_le.so, 0) };

    if (B) {
      // (bản 1.33) số liệu cho phép kiểm phụ kiện / thiết bị bếp + đá + phụ kiện kê bảng (đá KHÔNG là tấm: không vào bảng cắt, không vào CD)
      const tren = B.tang === 'tren', treo = M.parts.find(p => p.loai === 'TREO'), gT = M.parts.filter(p => p.loai === 'GIANG');
      // (1.33.1) tủ che ống hút mùi kính: thẳng ĐỈNH dãy tủ trên (đáy nâng lên chừa chỗ thân máy); tủ trên khác thẳng đáy (cách mặt đá)
      const cheOng = tren && B.chuc_nang === 'hm' && B.tb.hm && B.tb.hm.kieu === 'kinh';
      M.info.bep = { tang: B.tang, chuc_nang: B.chuc_nang, lot: rn(Math.max(...widths)), sau_lot: rn(sauKhoang[0]), sau_lot_treo: treo ? rn(treo.y0) : rn(sauKhoang[0]), cao_lot: rn(lower.zt - lower.zb),
        z_dat: tren ? rn(B.cao_mat + B.cach_tren + (B.tang2 ? B.cao_tren : cheOng ? B.cao_tren - s.cao : 0)) : 0, cao_mat: B.cao_mat, ro: roBep, giang: gT.length ? { z0: rn(Math.min(...gT.map(p => p.z0))), truoc: rn(t), sau: rn(yG - t) } : null,
        hoc: hocBep, goc: s.khoang.map((k, i) => (k.mu && k.canh > 0 && k.mu.rong > 0 ? { khoang: i, ben: k.mu.ben, mu: k.mu.rong, c: rn(W - k.mu.rong - khe) } : null)).filter(Boolean)[0] || null,
        khoang: widths.map((w, i) => [rn(bayX(i)), rn(bayX(i) + w)]) };      // (vòng soát 2) lọt lòng từng khoang [x0, x1] — chậu / bếp / hút mùi đặt giữa module kiểm theo khoang nằm dưới nó
      if (B.tang === 'duoi') {
        // (vòng soát 1.34) tâm khoét = tâm THÙNG (giữa hai phào / ốp), không W/2 của module: tủ đầu dãy mang nẹp thì module = thùng + nẹp
        const y0 = rn(-tc - B.dua_da), y1 = rn(D + B.cach_tuong), z = rn(s.cao + B.van_lot), khoet = [], xT = rn((s.phao.trai + W - s.phao.phai) / 2);
        for (const [loai, tb] of [['chau', B.tb.chau], ['bep', B.tb.bep]]) if (tb && (B.chuc_nang === loai)) {
          const ky0 = tb.cach_mep_truoc >= 0 ? rn(y0 + tb.cach_mep_truoc) : rn((y0 + y1) / 2 - tb.khoet[1] / 2);
          khoet.push({ loai, r: tb.khoet[0], s: tb.khoet[1], x: xT, y: rn(ky0 + tb.khoet[1] / 2), y0: ky0, y1: rn(ky0 + tb.khoet[1]), lap: tb.lap || '' });
        }
        // (bản 1.34) đầu dãy hở có ốp hông: đá nhô DA_NHO_HO qua mặt ốp (anh chốt) — x0 = mép trái đá theo toạ độ module
        const nhoT = B.op === 'trai' ? DA_NHO_HO : 0, nhoP = B.op === 'phai' ? DA_NHO_HO : 0;
        M.da = { dai: rn(W + nhoT + nhoP), x0: -nhoT, sau: rn(y1 - y0), day: B.day_da, z, y0, y1, khoet };
        // ván lót đá: tấm thật (vào bảng cắt + lệnh nhập), nằm trên đầu hồi / nóc / giằng, ngay dưới đá — tủ chậu / bếp nấu khoét theo lỗ đá tại xưởng
        if (B.van_lot > 0) P({ loai: 'LOT', ten: 'Ván lót đá', than: lower.code, tu: lower.tu, type: 0, x0: 0, x1: W, y0: 0, y1: D, z0: s.cao, z1: z, big: 0, khoan: KHONG_KHOAN,
          ghi_bep: `ván lót dưới đá dày ${g(B.van_lot)} — bắt vít / keo lên đầu hồi${B.noc === 'giang' ? ' + giằng' : ' + nóc'}, không khoan cam${khoet.length ? `; khoét theo lỗ ${khoet.map(k => (k.loai === 'chau' ? 'chậu' : 'bếp')).join(' + ')} của đá (khoét tại xưởng, chưa khoét trên tấm)` : ''} [CĐ] MDF chống ẩm` });
        M.khoi_phu = [{ ten: 'Mặt đá', b: [-nhoT, y0, z, rn(W + nhoP), y1, rn(z + B.day_da)], mau: '#cfcac2' }];
      }
      if (B.chuc_nang === 'hm' && B.tb.hm) {
        // khoét đáy theo máy, lỗ ống khói trên nóc: CHƯA khoét trên tấm (khoét xuyên chưa đo trên Chenfeng) — ghi vào bảng kê để xưởng khoét tay
        // (vòng soát 2) máy đặt giữa module → khoét trên đáy / nóc của KHOANG nằm dưới / trên tâm máy (tủ nhiều khoang: không ghi lên đáy khoang đầu)
        const xT = (s.phao.trai + W - s.phao.phai) / 2, giua = p => p.x0 <= xT + TOL && p.x1 >= xT - TOL;      // (vòng soát 1.34) tâm thùng, không tâm module (nẹp)
        const hm = B.tb.hm, day = M.parts.find(p => p.loai === 'DAY' && giua(p)), noc = M.parts.find(p => p.loai === 'NOC' && giua(p));
        if (hm.kieu === 'kinh') {
          // (1.33.1) máy kính vát treo tường DƯỚI tủ che ống, ống khói đi lên xuyên đáy + nóc. Máy treo cao nhất có thể trong khoảng cách cho phép tới mặt bếp
          // (đỉnh thân sát đáy tủ — ống khói khuất trong tủ); khoảng trống quá cao thì máy dừng ở khoảng cách tối đa, ống khói lộ phần còn lại.
          const mk = rn(B.cao_mat + 5), can = B.bep_loai === 'gas' ? B.cach_hm_gas : B.cach_hm_tu, zd = M.info.bep.z_dat, dayM = rn(Math.min(zd - hm.cao, mk + can + HM_KINH_DU));      // mặt kính bếp ≈ mặt đá + 5 [CĐ]
          M.info.bep.hm = { kieu: 'kinh', mat_bep: mk, can, max: can + HM_KINH_DU, day: dayM, dinh: rn(dayM + hm.cao), cach: rn(dayM - mk) };
          if (day) day.ghi_bep = `lỗ ống khói Ø${g(hm.ong + 10)} giữa tủ — ống máy hút mùi kính đi qua (khoét tại xưởng, chưa khoét trên tấm)`;
        } else if (day) day.ghi_bep = `khoét ${g(hm.rong)} × ${g(Math.min(hm.sau, rn(day.y1 - day.y0 - 10)))} cho máy hút mùi âm (khoét tại xưởng, chưa khoét trên tấm)`;
        if (noc) noc.ghi_bep = `lỗ ống khói Ø${g(hm.ong + 10)} giữa tủ (khoét tại xưởng, chưa khoét trên tấm)`;
      }
      // (vòng soát 1.35) tủ TẦNG TRÊN kịch trần nằm ngay trên tủ hút mùi: ống khói đi lên xuyên đáy + nóc (B.ong_hm = Ø ống của máy)
      if (B.ong_hm > 0) {
        const xT = (s.phao.trai + W - s.phao.phai) / 2, giua = p => p.x0 <= xT + TOL && p.x1 >= xT - TOL;
        for (const l of ['DAY', 'NOC']) { const q = M.parts.find(p => p.loai === l && giua(p)); if (q) q.ghi_bep = `lỗ ống khói Ø${g(B.ong_hm + 10)} giữa tủ — ống máy hút mùi tủ dưới đi qua${l === 'NOC' ? ' (ống ra tường thì khoét hậu thay lỗ nóc)' : ''} (khoét tại xưởng, chưa khoét trên tấm)`; }
      }
      if (B.tay_nam === 'vat') {
        // (1.33.1) tay nắm vát cạnh: mép cầm vát 45° trên tấm cánh / mặt kéo rổ (gia công khi cắt — bảng kê ghi ở dòng tấm); mặt ngăn kéo của mẫu Chenfeng kê ở phụ kiện bếp
        // (bản vá 1.33.1) mặt kéo rổ của tủ cao (BC-KHO-400: mép trên +1908, quá tầm tay) → vát mép đứng như cánh tủ cao, kèm một dòng ghi
        const mkCao = [];
        for (const p of M.parts) if (p.loai === 'CANH' || p.loai === 'MKP') {
          const cao = p.loai === 'MKP' && B.tang === 'cao';      // mặt kéo rổ của tủ cao: như cánh tủ cao (mép trên ở ~1,9 m không với tới)
          if (cao) mkCao.push(p);
          const mep = cao ? 'mép đứng bên phải' : p.loai === 'MKP' || B.tang === 'duoi' ? 'mép trên' : B.tang === 'tren' ? 'mép dưới' : `mép đứng bên ${p.open === 2 ? 'trái' : 'phải'} (phía mở)`;
          p.gia_cong = `vát cạnh 45° ${mep} làm chỗ cầm (tay nắm vát, ăn ~${g(VAT_SAU)} [CĐ])`;
        }
        if (mkCao.length) bao.note(`Mặt kéo rổ cao tới +${g(rn(Math.max(...mkCao.map(p => p.z1))))} (quá tầm tay ở mép trên): vát mép đứng bên phải làm chỗ cầm — tủ sát tường phải thì xưởng vát bên trái.`, 'bep');
      }
      // (bản 1.35) CÁNH KHUNG KÍNH (tủ trên chọn): cánh trên bản vẽ là tấm phủ bì — xưởng ghép khung 4 thanh bản KINH_KHUNG từ ván cánh + kính (ghi ở dòng cánh, kính ở phụ kiện)
      if (B.kinh) for (const p of M.parts) if (p.loai === 'CANH') {
        const w = rn(p.x1 - p.x0), h = rn(p.z1 - p.z0), k = KINH_KHUNG;
        p.kinh = { thanh: k, rong: rn(w - 2 * k + 2 * KINH_AN), cao: rn(h - 2 * k + 2 * KINH_AN) };
        p.gia_cong = (p.gia_cong ? p.gia_cong + '; ' : '') + `cánh khung kính: ghép khung 4 thanh bản ${g(k)} (đứng ${g(h)} × 2, ngang ${g(rn(w - 2 * k))} × 2) từ ván cánh, soi rãnh ăn kính ${g(KINH_AN)} [CĐ]`;
      }
      // (bản 1.35) LED âm đáy tủ trên: soi rãnh dưới đáy suốt chiều ngang, cách mép trước LED_RANH[2] [CĐ]; dải LED + nguồn ở phụ kiện
      if (B.led && B.tang === 'tren') for (const p of M.parts) if (p.loai === 'DAY') p.gia_cong = (p.gia_cong ? p.gia_cong + '; ' : '') + `soi rãnh LED ${g(LED_RANH[0])} × sâu ${g(LED_RANH[1])} mặt dưới, cách mép trước ${g(LED_RANH[2])}, suốt chiều ngang (đi dây ra sau) [CĐ]`;
      kiemBep(M, bao);
      M.phu_kien = phuKienBep(M);
    }
    if (TP) {
      // (bản 1.34.1) táp: phụ kiện + gia công theo tay nắm / chân — mặt ngăn kéo là của mẫu Chenfeng (không phải tấm của bảng) nên gia công tay nắm khoét kê ở đây
      // (soát 1.34.1) đếm theo tay nắm của TỪNG mặt: mặt sau cánh không tay nắm; táp "khe" mà ô là ngăn kéo lọt lòng thì mặt đó dùng núm
      const theo = tn => M.mat_ngan_keo.filter(q => q.tay_nam === tn), kc = ds => [...new Set(ds.map(q => `${g(q.w)} × ${g(q.h)}`))].join('; '), pk = [];
      const mNum = theo('num'), mKhoet = theo('khoet'), mKhe = theo('khe');
      if (mNum.length) pk.push({ ten: 'Núm tròn (tay nắm núm) cho mặt ngăn kéo', sl: mNum.length, ghi_chu: `bắt vít tâm mặt (${kc(mNum)}) [CĐ]` });
      if (mKhoet.length) pk.push({ ten: 'Gia công tay nắm khoét chữ U mép trên mặt ngăn kéo (CNC)', sl: mKhoet.length, ghi_chu: `khoét ${g(TAP_KHOET[0])} × ${g(TAP_KHOET[1])} giữa mép trên mỗi mặt (${kc(mKhoet)}), dán cạnh lại mép khoét [CĐ] — không tay nắm nổi` });
      if (mKhe.length) note(`Táp: khe tay nắm ${g(TP.khe_tn)} giữa các mặt ngăn kéo trùm (kiểu J) — không tay nắm nổi.`, 'ngan_keo');
      if (TP.tay_nam === 'khe' && mNum.length) note(`Táp: khe tay nắm chỉ có giữa các mặt trùm — ${mNum.length} mặt ngăn kéo lọt lòng dùng núm tròn.`, 'ngan_keo');
      if (TP.chan_go > 0) pk.push({ ten: `Chân gỗ vát cao ${g(TP.chan_go)} (mua sẵn)`, sl: 4, ghi_chu: 'bắt bát chân + vít vào mặt dưới đáy, 4 góc cách mép ~40 [CĐ]' });
      M.phu_kien = pk;
      // chân gỗ: khối phụ cho hình 3D (không phải tấm — không vào bảng cắt / lệnh nhập), 40 × 40 ở 4 góc dưới đáy, cách mép 40
      if (TP.chan_go > 0) { const d = M.parts.find(p => p.loai === 'DAY'), a = 40, e = 40; if (d) for (const [x, y] of [[d.x0 + e, d.y0 + e], [d.x1 - e - a, d.y0 + e], [d.x0 + e, d.y1 - e - a], [d.x1 - e - a, d.y1 - e - a]]) (M.khoi_phu = M.khoi_phu || []).push({ ten: 'Chân gỗ', b: [rn(x), rn(y), 0, rn(x + a), rn(y + a), rn(TP.chan_go)], mau: '#c9a57a', vat: [x < (d.x0 + d.x1) / 2 ? -1 : 1, y < (d.y0 + d.y1) / 2 ? -1 : 1] }); }
      M.info.tap = { go: TP.go, bo: TP.bo, noc: TP.noc, day: TP.day, dua: TP.dua, chan_go: TP.chan_go, tay_nam: TP.tay_nam };
    }
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

  const THUNG = ['HOI', 'VACH', 'DAY', 'NOC', 'DOT', 'DEM', 'XA', 'HAU', 'DE', 'GO', 'GIANG', 'TREO', 'LOT', 'DG', 'DUG', 'HG', 'THH', 'TH', 'DA', 'DEB', 'PH', 'MNK', 'TNK', 'HNK', 'DNK', 'OP', 'XU'];      // tấm của thùng: lơ lửng là lỗi dựng, không phải chuyện xưởng tự xử lý

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
        // (bản 1.31) nóc / đáy phủ hồi: tấm đứng áp mặt trên / dưới ngay ở đầu tấm cũng là chỗ tì
        // (1.34.1) nóc chồm của táp: hồi lùi vào phần đua `p.dua` vẫn là chỗ tì ở đầu tấm
        if (ap(q, p, 2) > 0 || ap(p, q, 2) > 0) { const du = (p.dua || 0) + TOL; if (q.x0 <= p.x0 + du && q.x1 > p.x0 + TOL) trai = true; if (q.x1 >= p.x1 - du && q.x0 < p.x1 - TOL) phai = true; }
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
        : `${p.ten} (${p.tu}) rộng ${g(c.rong)} > khổ ván ${g(s.van.kho_rong)} — ${M.info && M.info.loai_sp === 'giuong' ? 'giảm kích thước tấm này (cao đầu giường / rộng phủ bì; lòng rộng thì bật đà giữa)' : M.info && M.info.loai_sp === 'vach' ? 'tăng số ô / số hàng' : 'phải chia khoang nhỏ hơn'}.`, 'kho_van');
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
    // phủ bì (ván lót đá của tủ bếp nằm trên phủ bì thùng, dưới đá — không tính)
    const bb = bbox(parts.filter(p => p.loai !== 'LOT'));
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
    // (1.36.4 — tờ ván 5 mm lọt ra trang sản xuất mà không ai thấy trước) chỉ LƯU Ý: tấm dày lạ không làm lần vẽ hỏng, nhưng trang sản xuất sẽ tách một loại ván riêng
    { ma: 'day_la', ten: 'Bề dày tấm đúng các loại ván đang dùng' },
  ];
  /** (1.36.4) Các bề dày "đã khai" của một tủ: ván thùng, cánh / phào, hậu + mọi tấm thiết kế (vd thanh ray, ván riêng). Phiếu dò lỗi so tấm thật với danh sách này (dl.day_co). */
  function dayCoCua(M) {
    const s = M.spec || {}, ds = [s.van && s.van.t, s.van && s.van.t_canh, s.hau && s.hau.t].concat((M.parts || []).map(p => p.t));
    return [...new Set(ds.filter(v => typeof v === 'number' && v > 0).map(v => rn(v)))].sort((a, b) => a - b);
  }

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
    opt = Object.assign({ day_min: 12, toi_da: 100, hep: 50 }, opt || {});      // toi_da: (bản 1.28) danh sách nằm trong phiếu, bấm mới xổ — không cắt còn 8 dòng nữa
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
    // bề dày lạ (1.36.4): tấm thật dày khác mọi bề dày đã khai (dl.day_co) — vd đáy hộp ngăn kéo 5 của mẫu Chenfeng. Không có danh sách (dò lỗi bản vẽ bất kỳ) thì không kiểm.
    if (!Array.isArray(dl.day_co) || !dl.day_co.length) kq.day_la.ket = 'khong';
    else {
      const la = new Map(); tam.forEach((t, i) => { if (t.day > 0 && !dl.day_co.some(d => Math.abs(d - t.day) <= 0.05)) them(la, g(rn(t.day, 1)), i); });
      for (const [d, ds] of la) kq.day_la.luu_y.push(`${ds.length} tấm dày ${d} (ván đang dùng: ${dl.day_co.map(g).join(' / ')}): ${ke(ds, 4)} — trang sản xuất sẽ tách riêng một loại ván ${d}.`);
    }
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
  const RE_MAU_MAT = /^(Đầu giường$|Đuôi giường$|Hông giường (trái|phải)$|Thanh hông (trái|phải)$|Cánh|Phào|Diềm|Cột La Mã|Chân trước|Xà chân(?! sau)|Mặt ngăn kéo|Mặt bàn|Tấm ốp|Tấm bịt|Tấm che mù|Tấm trang trí|Nẹp bù|Nẹp$|Nẹp \(|Lam$|Lam \()|门板|假门|抽面|顶线|楣板|罗马柱|前地脚|地脚线|踢脚板|见光板|收口|封板|格栅|装饰板|护墙板|墙板|台面|桌面/;
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
    // (bản 1.29.2 — anh Thanh 08/10/2026: "không có tấm 5 mm nên khi ra file nó nhảy ra nhiều ván quá") tấm MỎNG (≤ 9, theo hộp bao) nào cũng là nhóm hậu — đáy hộp ngăn kéo (抽底板) mỏng
    // đổ cùng vật liệu ván mỏng với hậu, ra trang sản xuất chỉ còn MỘT loại ván mỏng; tấm dày tên 抽底板 (hộp ngăn kéo ván 18) vẫn là thùng
    const mong = t => { if (!t || !Array.isArray(t.hop) || t.hop.length < 6) return false; const k = trucMong(t.hop), d = t.hop[2 * k + 1] - t.hop[2 * k]; return d > 0 && d <= 9; };
    const ra = (ds || []).map(t => { const ten = String((t && t.ten) || ''); return (RE_MAU_HAU.test(ten) && !RE_MAU_HOP_NK.test(ten)) || (mong(t) && !RE_MAU_MAT.test(ten)) ? 'hau' : RE_MAU_MAT.test(ten) ? 'mat' : 'thung'; });
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

  /** Xếp loại một loạt đo mạng tới Chenfeng (bản 1.27). r = { ms: [thời gian các lượt CÓ trả lời], rot: số lượt không trả lời, n: tổng số lượt, dut?: đã dừng sớm vì mất liền mấy lượt }.
   *  Đo thật (05/10/2026): đường tới Chenfeng không chậm đều mà RỚT GÓI từng đợt — lượt mất một gói lâu gấp đôi trở lên (TCP gửi lại), còn các lượt khác vẫn nhanh như thường. Số giữa vì thế không nói lên gì
   *  (và khi rớt nhiều thì chính số giữa đã là lượt chậm): mốc "bình thường" lấy ở 1/4 dưới, "chậm" = hơn gấp đôi mốc đó và hơn nửa giây, xếp loại theo TỈ LỆ lượt chậm hoặc rớt — con số để so hai đường mạng.
   *  Trả { muc: 'tot' | 'tam' | 'kem' | 'dut', x: số lượt chậm hoặc rớt, n, nhanh, cham, tre, rot }. */
  function danhGiaMang(r) {
    const a = ((r && r.ms) || []).filter(v => v >= 0).sort((p, q) => p - q), rot = (r && r.rot) || 0, n = (r && r.n) || a.length + rot;
    if (!a.length || (r && r.dut)) return { muc: 'dut', x: rot, n, nhanh: a.length ? a[0] : 0, cham: a.length ? a[a.length - 1] : 0, tre: 0, rot };
    const nhanh = a[Math.floor((a.length - 1) / 4)], cham = a[a.length - 1], nguong = Math.max(500, 2 * nhanh), tre = a.filter(v => v > nguong).length, x = tre + rot;
    let muc = x * 20 <= n && !rot ? 'tot' : x * 5 <= n && rot * 20 <= n ? 'tam' : 'kem';
    if (nhanh >= 3000) muc = 'kem'; else if (nhanh >= 1500 && muc === 'tot') muc = 'tam';      // đường quá xa: lượt nào cũng lâu
    return { muc, x, n, nhanh, cham, tre, rot };
  }

  /** Nhóm của một thư mục kho mẫu theo TÊN (bản 1.29.1 — kho của tài khoản bày lẫn tủ với phụ kiện): 'pk' phụ kiện | 'tu' tủ và thành phần của tủ (cánh, ngăn kéo) | 'khac'.
   *  Xét phụ kiện trước ("Tủ phụ kiện" là phụ kiện). Thư mục con thì theo thư mục gốc của nó (giao diện lo). */
  /** (bản 1.32) Mẫu kho Chenfeng là giường / vách đầu giường (không có hậu → không phủ hậu chuẩn xưởng). Tên có chữ tủ / táp / tab / kệ / hộc / 柜 thì vẫn là tủ
   *  (táp đầu giường, 床头柜, 背景墙柜) → vẫn phủ hậu. */
  function khoKhongHau(ten) {
    const t = String(ten == null ? '' : ten).trim();
    // tiếng Việt: danh từ chính đứng TRƯỚC ("Giường hộc kéo" là giường, "Táp đầu giường" là táp); tiếng Trung: danh từ chính đứng SAU ("抽屉床" là giường, "床头柜" là tủ)
    const vi = t.search(/giường/i), viTu = t.search(/tủ|t[aá]p|\btab\b|kệ|hộc|bàn|đôn|ngăn kéo/i);
    if (vi >= 0) return viTu < 0 || vi < viTu;
    const cuoi = (re, x) => { let i = -1, m; const r = new RegExp(re.source, 'g'); while ((m = r.exec(x))) i = m.index; return i; };
    const z = t.replace(/带.*$/, ''), zh = cuoi(/床/, z), zhTu = cuoi(/柜|几|桌|抽屉/, z);      // "X带Y" (X kèm Y): danh từ chính là X
    if (zh >= 0) return zh > zhTu;
    return /背景墙/.test(t) && !/柜/.test(t);
  }
  function nhomThuMuc(ten) {
    const t = String(ten == null ? '' : ten).toLowerCase();
    if (/phụ kiện|bản lề|tay nắm|tay co|ray|ke |^ke$|chân|đèn|led|kho[áa]|suốt|pát|bát|móc|rổ|giá treo|vít|nẹp|gioăng|giảm chấn|nâng|五金|铰链|拉手|滑轨|导轨|脚|灯|锁|挂衣|衣杆|配件|拉篮|hardware|hinge|handle|rail/.test(t)) return 'pk';
    if (/tủ|táp|\btab\b|đầu giường|cánh|ngăn kéo|hộc|kệ|giường|bàn|vách|lavabo|thùng|柜|门|抽屉|床|桌|架|cabinet|door|drawer/.test(t)) return 'tu';
    return 'khac';
  }

  /** Tóm tắt các lần Chenfeng gọi máy chủ của nó (bản 1.29). ds = [{ ten: tên lời gọi ("CAD-moduleDetail"…), kieu: initiatorType của trình duyệt, gt: nextHopProtocol ('' = trình duyệt không cho biết), ms }].
   *  Để làm "tự gửi lại khi rớt gói" phải biết Chenfeng gọi bằng XHR hay fetch, có đi HTTP/2 (một kết nối dùng chung) không, và mỗi mẫu tải lâu bao nhiêu khi mạng rớt gói — chưa đo trên bản thật.
   *  Trả { n, kieu: [[loại, số lần]], gt: [[giao thức, số lần]], mau: { n, giua, cham } (CAD-moduleDetail), cham: 3 lần lâu nhất [{ ten, ms }] }. */
  function tomTatGoi(ds) {
    const a = (Array.isArray(ds) ? ds : []).filter(x => x && Number.isFinite(x.ms) && x.ms >= 0);
    const dem = f => { const m = new Map(); for (const x of a) { const k = f(x); m.set(k, (m.get(k) || 0) + 1); } return [...m].sort((p, q) => q[1] - p[1]); };
    const mau = a.filter(x => x.ten === 'CAD-moduleDetail').map(x => x.ms).sort((p, q) => p - q);
    return { n: a.length, kieu: dem(x => String(x.kieu || '?')), gt: dem(x => String(x.gt || '?')),
      mau: { n: mau.length, giua: mau.length ? mau[Math.floor((mau.length - 1) / 2)] : 0, cham: mau.length ? mau[mau.length - 1] : 0 },
      cham: a.slice().sort((p, q) => q.ms - p.ms).slice(0, 3).map(x => ({ ten: String(x.ten || ''), ms: Math.round(x.ms) })) };
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
  /**
   * (1.36.2) Đường bao tấm ĐỨNG dọc (type 1 — hồi / vách) bo tròn góc trên phía trước bán kính r.
   * Hệ riêng của tấm đứng dọc: u = y − y0 (chiều sâu, 0 = mép trước — như rãnh hậu trên hồi), v = z − z0 (chiều cao, 0 = mép dưới) — cùng chiều với rect(w, h)
   * (hệ thuận: trục u = Y, trục v = Z, pháp tuyến = X; tấm nằm đã đo là u = Y, v = −X, pháp tuyến Z — cũng hệ thuận).
   * CHƯA ĐO trên Chenfeng thật: góc bo phải nằm trên–trước; nằm góc khác thì đảo u / v ở đây.
   * Đi ngược chiều kim đồng hồ như rect: (0,0) → (w,0) → (w,h) → (r,h) ⌒ (0,h−r); cung 90° ngược chiều kim đồng hồ → bul = tan(90°/4) đặt ở đỉnh đầu cung.
   */
  function duongBaoBo(w, h, r) {
    r = Math.min(r, w, h);
    return [{ pt: [0, 0], bul: 0 }, { pt: [rn(w), 0], bul: 0 }, { pt: [rn(w), rn(h)], bul: 0 }, { pt: [rn(r), rn(h)], bul: rn(Math.tan(Math.PI / 8), 6) }, { pt: [0, rn(h - r)], bul: 0 }];
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
    if (s.loai_sp === 'giuong' || s.loai_sp === 'vach') return { M: build(s), spec: s, buoc: [], loi: [`${TEN_SP[s.loai_sp].toLowerCase()} chưa có lệnh gốc của Chenfeng — vẽ bằng nhập tấm rồi gom module`], chua: [], nk: [] };
    if (s.hau.chia !== 'khoang') { const c = clone(s); c.hau.chia = 'khoang'; s = normalize(c); }      // mỗi khoang một tấm hậu (lệnh 背板 vẽ theo từng khoảng trống)
    const M = build(s), buoc = [], loi = [], nk = [];
    if (M.errors.length) return { M, spec: s, buoc, loi: M.errors.slice(), chua: [], nk };
    if (s.hau.kieu !== 'phu') loi.push('hậu không phải kiểu phủ sau');
    if ((M.info.khau || []).length) loi.push('tủ có khấu cột');
    if (s.thung.noc_day === 'phu_hoi' && !s.bep) loi.push('nóc, đáy phủ hồi — lệnh nóc / đáy của Chenfeng chưa đo kiểu bọc hồi');
    if (s.tap) loi.push('táp kiểu mới (gờ chắn / nóc chồm, phủ / ngăn kéo lọt lòng phẳng mặt + thanh ngang / xà đế lùi / chân gỗ) — chưa đo lệnh gốc');      // (1.34.1)
    if (s.canh.chen_ban_le && M.parts.some(p => p.loai === 'CANH' && p.holes && p.holes.length)) loi.push('khoét chén bản lề — lệnh cánh của Chenfeng không nhận lỗ chén của bảng');      // (1.31.1) cánh lệnh gốc không mang lỗ → vẽ bằng nhập tấm
    if (s.loai_sp === 'bep') {
      // (bản 1.33) tủ bếp: thùng nóc liền, có hậu thì vẽ bằng lệnh gốc như tủ (xà chân lùi, thanh treo, mặt kéo rổ là tấm rời nhập vào module mẹ); còn lại nhập tấm + gom module, báo lý do
      if (s.bep.noc === 'giang') loi.push('giằng thay nóc — lệnh nóc / đáy của Chenfeng chưa đo kiểu tắt nóc');
      if (s.bep.chuc_nang === 'chau' || s.bep.chuc_nang === 'hm') loi.push('tủ không hậu');
      if (s.bep.chuc_nang === 'hm') loi.push('tủ hút mùi (khoét đáy, lỗ ống chưa đo)');
      // (bản 1.34) chưa đo lệnh gốc: khoang không đáy / hậu chia đoạn / đợt đỡ lò ngắn (hốc thiết bị), tấm che mù + cánh lệch (tủ góc)
      if ((M.info.o || []).some(c => c.kieu === 'hoc')) loi.push('hốc thiết bị (tủ lạnh / lò) — khoang không đáy, hậu chia đoạn, đợt đỡ lò chưa đo lệnh gốc');
      if (M.parts.some(p => p.loai === 'MU')) loi.push('tủ góc mù — tấm che mù + cánh lệch chưa đo lệnh gốc');
    }
    if (loi.length) return { M, spec: s, buoc, loi, chua: [], nk };
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
          const day0 = M.parts.find(p => p.loai === 'DAY' && cua(p)), day = day0, noc0 = M.parts.find(p => p.loai === 'NOC' && cua(p)), noc = noc0;
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
          const canhK = M.parts.filter(p => p.loai === 'CANH' && cua(p)).sort((a, c) => a.x0 - c.x0);
          // (1.33, vòng soát 2, chỉ tủ bếp) khoang có nhiều tầng cánh (tủ đồ khô cánh mở: cánh dưới che rổ, cánh trên che ô đợt) → mỗi tầng một lệnh DOOR
          const tang = s.loai_sp === 'bep' ? [...new Set(canhK.map(c => rn(c.z0) + ':' + rn(c.z1)))].map(k => canhK.filter(c => rn(c.z0) + ':' + rn(c.z1) === k)) : [canhK];
          for (const canh of tang) if (canh.length) {
            const vT = dung.find(p => Math.abs(p.x1 - x0) < TOL), vP = dung.find(p => Math.abs(p.x0 - (x0 + w)) < TOL), c0 = canh[0], cN = canh[canh.length - 1];
            // (bản 1.33, chỉ tủ bếp) cánh chỉ phủ phần trên khoang (tủ cao: mặt kéo rổ đồ khô ở dưới) → kẹp vào tấm nằm ngay dưới cánh (đợt), không kẹp đáy rồi hở vào cả nghìn mm
            const day = s.loai_sp === 'bep' ? M.parts.filter(p => (p.loai === 'DAY' || p.loai === 'DOT') && cua(p) && p.z0 < c0.z0 - TOL).sort((a, c) => c.z1 - a.z1)[0] || day0 : day0;
            const noc = s.loai_sp === 'bep' ? M.parts.filter(p => (p.loai === 'NOC' || p.loai === 'DOT') && cua(p) && p.z1 > c0.z1 + TOL).sort((a, c) => a.z0 - c.z0)[0] || noc0 : noc0;      // tầng cánh dưới kẹp vào đợt ngay trên nó
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
    /* Bản 1.26 — NGĂN KÉO BẰNG LỆNH GỐC `DRAWER` (anh Jason 05/10/2026 07:00: "phần ngăn kéo vẽ bằng công cụ của chenfeng như vẽ thùng hậu, cánh").
     * Mỗi Ô ngăn kéo = MỘT bước NK (một lần chạy lệnh DRAWER cho cả các ngăn của ô), chạy SAU khi các tấm rời (vách đệm, xà, nẹp) đã có trên bản vẽ:
     *   { lenh: 'NK', than, khoang, kieu: 'nk_am' | 'nk_trum', so, kep: [tấm đứng trái, tấm đứng phải, tấm nằm dưới, tấm nằm trên] (chỉ số M.parts — 4 tấm phải chọn trước khi gõ lệnh),
     *     trong: lọt lòng (Inner Cover) hay trùm ngoài (Outer Cover), lui: `offset` của hộp thoại = lưng mặt ngăn kéo cách mép trước KHOẢNG TRỐNG (đo trên Chenfeng: khoảng trống tính từ
     *     mép trước của tấm kẹp LÙI NHẤT — có vách đệm thì là mép vách đệm), ext: { trai, phai, duoi, tren } = mặt trùm ra ngoài khoảng kẹp (âm = khe hở vào trong), khe: khe giữa hai mặt,
     *     day: dày mặt, cao: null (các mặt bằng nhau — để Chenfeng tự chia đều) | [cao từng mặt, từ dưới lên] (phải khoá cao từng ô), sau: sâu hộp,
     *     mau: { id, ten } mẫu ngăn kéo trong kho của tài khoản, ts: tham số ghi vào mẫu = tham số riêng của loại + BH = dày mặt thiết kế (đo 05/10/2026: mẫu hộp ray Blum có BH cố định 18 → không ghi thì mặt ra 18; mẫu có BH = $BH tự theo thùng, tempNganKeo giữ công thức), tp: [chỉ số M.templates], mat: [chỉ số M.mat_ngan_keo] (từ dưới lên) }
     * CHƯA dùng lệnh gốc (vẫn nhập mẫu như bản 1.23): loại có tham số lấy theo cao mặt ('mat' — ngăn kéo chia ô), loại chưa khai mã mẫu, "hở sau" ≠ 5 hoặc "bước sâu" ≠ 50
     * (công thức sâu hộp của Chenfeng là floor((sâu khoảng − offset − 5) / 50) × 50), không tìm đủ 4 tấm kẹp.
     * Các mẫu của một ô nằm liền nhau trong M.templates theo thứ tự `build` đẩy vào: từ dưới lên — `tp` / `mat` của bước giữ thứ tự đó (hộp thoại của Chenfeng thì đánh số ô từ TRÊN xuống). */
    const tpNK = new Set();
    if (s.ngan_keo.ho_sau === 5 && s.ngan_keo.buoc_sau === 50) {
      const nhom = new Map();
      M.templates.forEach((tp, j) => { if (tp.loai !== 'NGAN_KEO' || !tp.id) return; const k = [tp.than, tp.khoang, tp.kieu, tp.o[0], tp.o[1]].join('|'); if (!nhom.has(k)) nhom.set(k, []); nhom.get(k).push(j); });
      for (const js of nhom.values()) {
        const t0 = M.templates[js[0]], lo = s.ngan_keo.loai.find(x => x.ma === t0.ma_loai);
        if (Object.keys(lo.ts).some(k => lo.ts[k] === 'mat')) continue;
        const mats = js.map(j => M.mat_ngan_keo[M.templates[j].mat]), m0 = mats[0], mN = mats[mats.length - 1];
        const i = t0.khoang, za = t0.o[0], zb = t0.o[1], trum = t0.kieu === 'nk_trum', xa = t0.pos[0], xb = rn(xa + t0.box[0]);
        // 4 tấm kẹp: hai tấm ĐỨNG có mặt trùng hai mép khoảng của mẫu và cao trùm hết ô (vách đệm của CHÍNH ô này nếu có, không thì hồi / vách), tấm NẰM ngay dưới và ngay trên ô
        const dung = M.parts.filter(p => (p.loai === 'DEM' || p.loai === 'HOI' || p.loai === 'VACH') && p.z0 <= za + TOL && p.z1 >= zb - TOL);
        const vT = dung.find(p => Math.abs(p.x1 - xa) < TOL), vP = dung.find(p => Math.abs(p.x0 - xb) < TOL);
        const nam = M.parts.filter(p => p.khoang <= i && i <= (p.den_khoang === undefined ? p.khoang : p.den_khoang) && (p.loai === 'DAY' || p.loai === 'NOC' || p.loai === 'DOT'));
        const duoi = nam.find(p => Math.abs(p.z1 - za) < TOL), tren = nam.find(p => Math.abs(p.z0 - zb) < TOL);
        if (!vT || !vP || !duoi || !tren) continue;
        // mép trước của khoảng trống mà Chenfeng dò = mép trước của tấm kẹp lùi nhất
        const yTruoc = Math.max(vT.y0, vP.y0, duoi.y0, tren.y0), lui = rn(m0.y + m0.t - yTruoc);
        const deu = mats.every(q => Math.abs(q.h - m0.h) < 1e-6);
        nk.push({ lenh: 'NK', than: t0.than, khoang: i, kieu: t0.kieu, so: js.length, kep: [I.get(vT), I.get(vP), I.get(duoi), I.get(tren)], trong: !trum, lui,
          ext: { trai: rn(xa - m0.x), phai: rn(m0.x + m0.w - xb), duoi: rn(za - m0.z), tren: rn(mN.z + mN.h - zb) },
          khe: trum ? s.canh.khe : (mats.length > 1 ? rn(mats[1].z - (mats[0].z + mats[0].h)) : s.ngan_keo.khe_giua), day: m0.t, cao: deu ? null : mats.map(q => q.h), sau: t0.box[1],
          mau: { id: t0.id, ten: t0.ten }, ts: Object.assign({}, lo.ts, { BH: m0.t }), tp: js.slice(), mat: js.map(j => M.templates[j].mat) });
        for (const j of js) tpNK.add(j);
      }
    }
    // phần chưa có lệnh gốc: gom theo tên tấm
    const g = new Map();
    for (const p of M.parts) if (!da.has(p)) { const k = p.loai + '|' + p.ten; const r = g.get(k) || { loai: p.loai, ten: p.ten, sl: 0 }; r.sl++; g.set(k, r); }
    (M.templates || []).forEach((tp, j) => { if (tpNK.has(j)) return; const k = 'MAU|' + (tp.loai || ''); const r = g.get(k) || { loai: 'MAU', ten: tp.loai === 'NGAN_KEO' ? 'Ngăn kéo' : tp.loai === 'SUOT' ? 'Suốt treo' : (tp.loai || 'Mẫu kho'), sl: 0 }; r.sl++; g.set(k, r); });
    return { M, spec: s, buoc, loi, chua: [...g.values()], con_lai: M.parts.filter(p => !da.has(p)), gan, hs, nk };
  }

  /**
   * Lựa chọn ghi vào hộp "Drawer Design" của Chenfeng cho một bước NK của kế hoạch (đã đo trên Chenfeng thật 05/10/2026):
   *   lc  = các khoá của `m_Option` (trùm ra / khe hở / offset là CHUỖI): lọt lòng → doorPosType 1, không trùm ra, phần hở vào là "khe hở"; trùm ngoài → doorPosType 0, trùm ra theo thiết kế, không khe hở;
   *         isAuto + isFloor50: Chenfeng tự tính sâu hộp = floor((sâu khoảng − offset − 5) / 50) × 50;
   *   cao = null (mọi ô để "D" — Chenfeng chia đều) | [cao từng ô] xếp từ TRÊN xuống (hộp thoại đánh số ô 0 = trên cùng).
   */
  function lcNganKeo(b) {
    const so = v => String(Math.round(v * 1000) / 1000);
    const tach = v => (v >= 0 ? [so(v), '0'] : ['0', so(-v)]);
    const [lE, lS] = tach(b.ext.trai), [rE, rS] = tach(b.ext.phai), [tE, tS] = tach(b.ext.tren), [dE, dS] = tach(b.ext.duoi);
    return {
      lc: { row: b.so, col: 1, isAllSelect: true, topOffset: 0, bottomOffset: 0, doorPosType: b.trong ? 1 : 0, offset: so(b.lui), leftExt: lE, leftSpace: lS, rightExt: rE, rightSpace: rS,
        topExt: tE, topSpace: tS, bottomExt: dE, bottomSpace: dS, midSpace: so(b.khe), isAuto: true, isFloor50: true },
      cao: b.cao ? b.cao.slice().reverse() : null,
    };
  }

  /**
   * Mẫu ngăn kéo gán vào từng ô của hộp "Drawer Design" (`doorDrawersInfo[i].tempInfo.temp`), dựng từ bản ghi `CAD-moduleList` của kho mẫu tài khoản — khỏi phải mở hộp "Select Template".
   * banGhi = { module_id, name, logo, diy_logo }; hang = các hàng tham số của mẫu (trường `props` đã giải nén): [3 (bản), tên, biểu thức, giá trị, null, ghi chú, kiểu (1), min, max, …].
   * Đã đo 05/10/2026: kết quả trùng từng byte với thứ hộp chọn mẫu của Chenfeng tạo ra; ô có mã mẫu mà THIẾU `props` thì Chenfeng ném lỗi lúc dựng (và gửi báo cáo lỗi về máy chủ của nó).
   * ts = tham số riêng của loại ngăn kéo ở Chuẩn xưởng: ghi đè giá trị mặc định của tham số CÙNG TÊN (tham số là công thức thì giữ nguyên).
   * Hàng không đúng dạng đã đo → null: nơi gọi chèn ngăn kéo bằng mẫu như trước, không đưa dữ liệu lạ cho Chenfeng.
   */
  /**
   * (1.36.4 — anh Thanh 16/10/2026, ảnh trang sản xuất: tờ 2440 × 1220 × 5 — "sao xuất ván vẫn có ván 5mm") đáy hộp ngăn kéo 抽底板 của MẪU ngăn kéo Chenfeng
   * (三节轨薄底抽… "薄底" = đáy mỏng 5) dày 5 → trang sản xuất tách một loại ván 5 riêng (1.29.2 chỉ đổi VẬT LIỆU sang nhóm hậu). Đổi dày đáy = dày hậu (6,5).
   * Tên tham số dày đáy của 11 mẫu ngăn kéo CHƯA BIẾT (chưa đo) → dò lúc chạy theo tên / chú thích tham số: có cả 底 lẫn 厚 (底板厚, 底厚, 抽底厚…) hoặc tên quen
   * (DBH, DBHD, CDH, CDBH, DDH, DBT). Chỉ nhận tham số đang là SỐ MỎNG (3 … dày đích − 0,3): mẫu đáy dày (厚底 9 / 18) không đụng, nhận nhầm một tham số khác (cao, rộng…)
   * thì giá trị của nó không lọt khoảng đó. Không dò ra thì thôi — lưới đỡ sau khi vẽ (driver D.suaDayNK) đặt lại bề dày tấm.
   */
  const TEN_DAY_DAY = /^(DBH|DBHD|CDH|CDBH|DDH|DBT)$/i;
  function laDayDayNK(ten, ghi) {
    const a = String(ten || '').trim(), b = `${a} ${ghi || ''}`;
    return TEN_DAY_DAY.test(a) || (/底/.test(b) && /厚/.test(b));
  }
  const mongDay = (v, day) => typeof v === 'number' && isFinite(v) && v >= 3 && v < day - 0.3;
  /** Tên các tham số dày đáy cần ghi đè, từ các hàng `props` của mẫu ([3, tên, biểu thức, giá trị, null, ghi chú, 1, …]). Biểu thức là công thức thì không đụng (như ts). */
  function dayDayNK(hang, day) {
    if (!(day > 0) || !Array.isArray(hang)) return [];
    return hang.filter(r => Array.isArray(r) && typeof r[1] === 'string' && laDayDayNK(r[1], r[5]) && mongDay(Number(r[3]), day) && (!r[2] || !isNaN(Number(r[2])))).map(r => r[1]);
  }
  /** Như dayDayNK nhưng từ dạng { tên: giá trị } + { tên: chú thích } của D.templatesIn. */
  function dayDayTS(ts, mt, day) {
    if (!(day > 0) || !ts) return [];
    return Object.keys(ts).filter(k => laDayDayNK(k, mt && mt[k]) && mongDay(ts[k], day));
  }

  function tempNganKeo(banGhi, hang, ts, day) {
    const id = banGhi ? Math.round(+banGhi.module_id) || 0 : 0;
    if (!id || !Array.isArray(hang) || !hang.length) return null;
    const props = [], dd = dayDayNK(hang, day);
    for (const r of hang) {
      if (!Array.isArray(r) || r[0] !== 3 || typeof r[1] !== 'string' || r[6] !== 1) return null;
      const p = { name: r[1], value: r[3], description: r[5], expr: r[2] || '', isLock: false, type: 1, option: [], isOptionOnly: false, minCompareType: '>=', maxCompareType: '<=', defaultDir: '', defaultDirId: '',
        min: r[7] === undefined ? null : r[7], max: r[8] === undefined ? null : r[8] };
      // ghi đè = ghi cả BIỂU THỨC: đo trên Chenfeng thật 05/10/2026, lệnh DRAWER áp `expr` của từng tham số chứ không áp `value` (để biểu thức rỗng thì Chenfeng vẫn dùng số mặc định của mẫu)
      if (ts && typeof ts[p.name] === 'number' && (p.expr === '' || !isNaN(Number(p.expr)))) { p.value = ts[p.name]; p.expr = String(Math.round(ts[p.name] * 1000) / 1000); }
      else if (dd.includes(p.name)) { p.value = day; p.expr = String(Math.round(day * 1000) / 1000); }      // (1.36.4) dày đáy mỏng → dày hậu, ghi cả biểu thức (lệnh DRAWER áp expr)
      props.push(p);
    }
    return { id: String(id), name: String(banGhi.name || ''), logo: String(banGhi.logo || ''), title: '选择抽屉', tagName: '', diy_logo: String(banGhi.diy_logo || ''), isHandle: false, isHinge: false, isKuGan: false, props };
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
    const hau = (p.loai === 'HAU' && !p.van_thung) || !!p.van_hau;      // hậu khấu cột là ván thùng: vật liệu, dán cạnh, khoan như tấm thùng; đáy ngăn kéo giường (van_hau) là ván hậu
    const dc = hau && (p.phu || p.mong || p.van_hau) ? '0' : s.van.dan_canh;      // hậu mỏng (phủ / soi rãnh), đáy ngăn kéo giường không dán cạnh
    const chau = !!(s.bep && s.bep.chuc_nang === 'chau' && s.bep.van_chau && NHOM[p.loai] === 'Thùng');      // (bản 1.33) thùng tủ chậu: ván chống ẩm (mặt cánh, xà chân giữ ván mặt)
    const o = {
      Type: 'Board', Name: p.ten, BrType: p.type, PositionType: 1,      // PositionType 1: Pos = góc nhỏ nhất (x, y, z) cho cả 3 loại tấm
      ContourCurve: p.khau && p.khau.length && p.type === 0 ? duongBaoKhau(p) : p.bo_r > 0 && p.type === 1 ? duongBaoBo(w, h, p.bo_r) : rect(w, h), Thickness: rn(t), Pos: [p.x0, p.y0, p.z0],
      RoomName: s.phong, CabinetName: p.tu, BrMatName: (hau && s.hau.ten_van) || (chau && s.bep.van_chau) || s.van.ten_van || '', Matrial: (hau && s.hau.vat_lieu) || (chau && s.bep.van_chau) || s.van.vat_lieu || '', Color: (hau && s.hau.mau) || s.van.mau || '',
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
    if (opts.id) for (const b of boards) b.Remarks = [[nhanTu(opts.id), '']];      // (bản 1.29.2) mã ở TÊN ghi chú, nội dung rỗng — trang sản xuất của Chenfeng nối NỘI DUNG ghi chú vào tên tấm ("K1-TĐáy29A99WHS")
    const tpls = opts.khong_mau ? [] : M.templates.filter(tp => tp.id).map(tp => templateToCF(tp, s));
    const bb = bbox(M.parts);
    return { json: { ModelSpace: boards.concat(tpls) }, base: bb ? [bb.x0, bb.y0, bb.z0] : [0, 0, 0], so_tam: boards.length, so_mau: tpls.length };
  }

  /**
   * Từng MẪU của tủ (hộp ngăn kéo, suốt treo — mẫu trong kho của tài khoản Chenfeng) tách riêng thành một mục nhập (bản 1.23).
   * Chenfeng phải tải từng mẫu từ máy chủ; tải hỏng một mẫu là cả lệnh nhập bị huỷ → bảng nhập phần TẤM trước (không cần máy chủ), mẫu thêm sau.
   * @returns [{ tp: mẫu trong M.templates, json: mục nhập 'Template', mat: mặt ngăn kéo của mẫu đó trong M.mat_ngan_keo | null }]
   */
  function mauCF(M, opt) {
    // (1.36.4) opt.day_day = { [mã mẫu]: [tên tham số dày đáy] } (driver dò từ props / chú thích của kho mẫu đã đọc trong phiên — dayDayNK / dayDayTS): hộp ngăn kéo
    // nhập kèm các tham số đó = dày hậu. Không có thì như cũ (lưới đỡ sau khi vẽ lo).
    const dd = (opt && opt.day_day) || {}, day = M.spec.hau && M.spec.hau.t;
    return M.templates.filter(tp => tp.id).map(tp => {
      const json = templateToCF(tp, M.spec), ten = tp.loai === 'NGAN_KEO' && day > 0 ? (dd[tp.id] || []).filter(k => !(k in tp.params)) : [];
      for (const k of ten) json.ParamMap.push({ name: k, value: String(rn(day)) });
      return { tp, json, mat: (tp.mat >= 0 && M.mat_ngan_keo[tp.mat]) || null };
    });
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
      const bl = p.ban_le ? `${p.ban_le.so} bản lề / cánh` : '';      // (bản 1.30) số bản lề theo cao + rộng cánh → cùng kích thước là cùng số
      const key = [nhom, p.tu, p.ten, c.dai, c.rong, c.day, p.khoan, p.holes && p.holes.length ? 'x' : '', kh, bl, p.keo_nep ? 'kn' : p.vit_ray ? 'vr' : p.vit_de ? 'vd' : p.vit_pk ? 'vp' : ''].concat(p.ghi_bep ? [p.ghi_bep] : [], p.gia_cong ? [p.gia_cong] : []).join('|');      // (1.31.1) cùng cỡ mà cách bắt khác thì dòng riêng
      const r = rows.get(key) || { nhom, tu: p.tu, ten: p.ten, dai: c.dai, rong: c.rong, day: c.day, sl: 0, m2: 0, khoan: p.khoan === KHONG_KHOAN ? 'không khoan' : p.khoan,
        ghi_chu: p.ghi_bep || kh || (p.bat_giuong ? (p.lop_trong ? 'lớp trong — ghép keo + vít với lớp ngoài' : 'bắt bát giường (tháo lắp), không khoan cam') : p.vit_phan ? 'đặt lên vách ngăn gầm + đà giữa, bắt vít' : p.vit_de_giuong ? 'đế giường bay — khung đế ráp cam, thân giường bắt ke góc + vít xuống đế' : p.vit_thang ? 'bắt vít / ke vào hông, đuôi, đầu giường, đà' : p.vit_hoc ? 'hộp ngăn kéo bắt vít' : p.vit_no ? 'xương — bắt vít nở vào tường' : p.op ? 'bắn keo + vít lên xương' : p.phu ? 'ốp sau lưng thùng, bắn đinh' : p.vit_de ? 'áp mặt trước đế trước, bắt vít từ sau' : p.keo_nep ? 'thanh ngang khung mặt giữa 2 nẹp, keo + đinh' : p.vit_ray ? 'thanh ngang khung mặt — bắt vít / chốt gỗ vào hồi, vách (mối nối ngắn hơn 60, không khoan cam)' : p.van_thung ? 'tấm trước mặt cột — ván thùng, lọt giữa 2 tấm đứng hai bên cột' : p.khau_cot ? 'vách đứng dọc mặt bên cột' : p.holes && p.holes.length ? (p.holes[0].kieu === 'tron' ? (bl ? bl + ', khoét chén' : 'khoét chén bản lề') : 'soi rãnh hậu') : bl) };
      if (p.gia_cong && !r.sl) r.ghi_chu = r.ghi_chu ? `${r.ghi_chu}; ${p.gia_cong}` : p.gia_cong;      // (1.33.1) gia công thêm (vát cạnh tay nắm) đi sau ghi chú sẵn có (bản lề…)
      r.sl++; r.m2 += c.dai * c.rong / 1e6; rows.set(key, r);
    }
    const order = ['Thùng', 'Hậu', 'Chân trước', 'Phào mặt', 'Phụ trợ phào', 'Cánh', 'Giường', 'Khung giường', 'Phản giường', 'Ngăn kéo giường', 'Tấm ốp', 'Xương vách'];
    const list = [...rows.values()].sort((a, b) => (order.indexOf(a.nhom) - order.indexOf(b.nhom)) || a.tu.localeCompare(b.tu) || a.ten.localeCompare(b.ten) || (b.dai - a.dai) || (b.rong - a.rong));
    const tong = {};
    for (const r of list) { tong[r.nhom] = tong[r.nhom] || { sl: 0, m2: 0 }; tong[r.nhom].sl += r.sl; tong[r.nhom].m2 += r.m2; }
    // tổng theo độ dày: ván thùng và ván hậu là 2 loại ván khác nhau, phải tách khi tính vật tư
    const theo = new Map();
    for (const r of list) { const e = theo.get(r.day) || { day: r.day, sl: 0, m2: 0 }; e.sl += r.sl; e.m2 += r.m2; theo.set(r.day, e); }
    const theo_day = [...theo.values()].sort((a, b) => b.day - a.day);
    const phu_kien = [];
    const kich = x => `${g(x.box[0])}×${g(x.box[1])}×${g(x.box[2])}`;
    for (const [kieu, ten] of [['nk_am', M.info && M.info.tap ? 'Ngăn kéo lọt lòng' : 'Ngăn kéo âm'], ['nk_trum', 'Ngăn kéo trùm ngoài']]) {      // (1.34.1) táp: hộc âm = ngăn kéo lọt lòng phẳng mặt hồi
      const ds = M.templates.filter(x => x.loai === 'NGAN_KEO' && x.kieu === kieu && x.id);
      for (const ma of [...new Set(ds.map(x => x.ma_loai))]) {
        const a = ds.filter(x => x.ma_loai === ma);
        phu_kien.push({ ten: `${ten} — ${a[0].ten_loai} (mẫu Chenfeng ${a[0].ten}: hộp + ray)`, sl: a.length, ghi_chu: a.map(kich).join('; ') });
      }
    }
    { // (bản 1.30) bản lề: tổng số theo loại đang chọn ở Chuẩn xưởng
      const n = sum(M.parts.filter(p => p.ban_le).map(p => p.ban_le.so)), lb = banLeDung(M.spec), ch = M.spec.canh.chen;
      if (n) phu_kien.push({ ten: `Bản lề ${lb && lb.ma !== 'tu_chon' ? lb.ten : 'chén Ø' + g(ch.d)}`, sl: n, ghi_chu: `chén Ø${g(ch.d)} sâu ${g(ch.sau)}, tâm chén cách mép cánh ${g(ch.tam_mep)}; ${M.parts.filter(p => p.ban_le).length} cánh` });
    }
    for (const x of (M.phu_kien || [])) phu_kien.push(x);      // (bản 1.32) phụ kiện của giường / vách (bát giường, ray, LED, nẹp, vít nở)
    const nS = M.templates.filter(x => x.loai === 'SUOT' && x.id).length;
    if (nS) phu_kien.push({ ten: 'Suốt treo + bas (mẫu Chenfeng)', sl: nS, ghi_chu: M.templates.filter(x => x.loai === 'SUOT').map(x => `dài ${g(x.box[0])}`).join('; ') });
    const out = { rows: list, tong, theo_day, tong_sl: sum(list.map(r => r.sl)), tong_m2: sum(list.map(r => r.m2)), phu_kien };
    if (M.da && !(M.spec.bep && M.spec.bep.day)) {
      // (vòng soát 1.34) tủ thuộc dãy (bep.day): đá kê theo DÃY (daDay — dải liền, mối nối, khoét theo tâm thùng), không in dòng riêng từng tủ (kê hai lần)
      // (bản 1.33) mặt đá: việc gia công riêng (không phải tấm ván, không vào bảng cắt / CD) — kích thước + lỗ khoét đo từ mép trái module, mép trước đá
      const d = M.da, B = M.spec.bep, ghi = [`dày ${g(d.day)}, đua ${g(B.dua_da)} trước mặt cánh${B.cach_tuong ? `, cách tường ${g(B.cach_tuong)}` : ''}${B.van_lot ? `, lót ván ${g(B.van_lot)} dưới đá` : ''}`];
      for (const k of d.khoet) ghi.push(`khoét ${k.loai === 'chau' ? 'chậu' : 'bếp'} ${g(k.r)} × ${g(k.s)}${k.lap === 'am' ? ' (chậu lắp âm — mài bóng mép)' : k.lap === 'duong' ? ' (lắp dương)' : ''} tâm cách mép trái ${g(rn(k.x - (d.x0 || 0)))}, cách mép trước đá ${g(rn(k.y - d.y0))}`);
      out.gia_cong_da = [{ ten: 'Mặt đá', tu: M.spec.ma, dai: d.dai, sau: d.sau, day: d.day, sl: 1, ghi_chu: ghi.join('; ') }];
    }
    return out;
  }

  function cutListCSV(M) {
    const cl = cutList(M), q = v => { v = String(v === undefined || v === null ? '' : v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const lines = [['Nhóm', 'Tên tủ', 'Tên tấm', 'Dài (mm)', 'Rộng (mm)', 'Dày (mm)', 'Số lượng', 'Diện tích (m2)', 'Kiểu khoan', 'Ghi chú'].join(',')];
    for (const r of cl.rows) lines.push([r.nhom, r.tu, r.ten, r.dai, r.rong, r.day, r.sl, r.m2.toFixed(3), r.khoan, r.ghi_chu].map(q).join(','));
    lines.push('');
    for (const k of Object.keys(cl.tong)) lines.push([`Tổng ${k}`, '', '', '', '', '', cl.tong[k].sl, cl.tong[k].m2.toFixed(3), '', ''].map(q).join(','));
    for (const d of cl.theo_day) lines.push([`Tổng ván dày ${g(d.day)}`, '', '', '', '', '', d.sl, d.m2.toFixed(3), '', ''].map(q).join(','));
    lines.push(['TỔNG VÁN (chưa kể hộp ngăn kéo)', '', '', '', '', '', cl.tong_sl, cl.tong_m2.toFixed(3), '', ''].map(q).join(','));
    if (cl.phu_kien.length) { lines.push(''); for (const p of cl.phu_kien) lines.push([p.bep ? 'Phụ kiện bếp' : 'Phụ kiện', '', p.ten, '', '', '', p.sl, '', '', p.ghi_chu].map(q).join(',')); }
    if (cl.gia_cong_da) { lines.push(''); for (const d of cl.gia_cong_da) lines.push(['Gia công đá', d.tu, d.ten, d.dai, d.sau, d.day, d.sl, '', '', d.ghi_chu].map(q).join(',')); }
    return '﻿' + lines.join('\r\n') + '\r\n';
  }

  /* ------------------------------------------------------------------ *
   * HÌNH ĐỨNG (SVG) để xem trước
   * ------------------------------------------------------------------ */
  // Màu theo loại tấm như khung nhìn của Chenfeng (tấm đứng đỏ gạch, tấm nằm vàng, tấm mặt/hậu xanh lá) nhưng dịu hơn để đọc được chữ.
  const MAU = { DG: '#c99a7e', DUG: '#dd9a90', HG: '#dd9a90', THH: '#dd9a90', TH: '#e6b0a7', DA: '#e6b0a7', DEB: '#b9a08f', PH: '#e6d25e', MNK: '#4d9a57', TNK: '#e6b0a7', HNK: '#e6b0a7', DNK: '#eef3ec', OP: '#7fb87a', XU: '#e6b0a7', DE: '#e6b0a7', GO: '#e6b0a7', HOI: '#dd9a90', VACH: '#e6b0a7', DEM: '#e6b0a7', XA: '#8fbf86', NEP: '#8fbf86', DAY: '#e6d25e', NOC: '#e6d25e', DOT: '#f0e390', HAU: '#eef3ec', CHAN: '#7fb87a', PHAO: '#93c78d', PHU: '#f0e390', CANH: '#4d9a57', GIANG: '#f0e390', TREO: '#e6b0a7', MKP: '#7fb87a', LOT: '#d9c9a3', MU: '#6aa866' };
  const MAU_CHU_GIAI = [['tấm đứng', '#dd9a90'], ['tấm nằm', '#e6d25e'], ['tấm mặt (cánh, phào, chân)', '#7fb87a'], ['hậu', '#eef3ec']];

  function elevationSVG(M, opts) {
    opts = Object.assign({ canh: true, kich_thuoc: true, rong_px: 640 }, opts || {});
    const s = M.spec, W = s.rong, H = s.cao, m = Math.max(W, H) * 0.09 + 60;
    const nhieuThung = opts.kich_thuoc && ((M.info && M.info.thung) || []).length > 1;      // tủ tách thùng: thêm 1 hàng kích thước "thùng" dưới hàng khoang
    const dsKhau = (opts.kich_thuoc && M.info && M.info.khau) || [], Dk = s.sau_thung;      // tủ có khấu cột: thêm hình nhìn từ trên xuống ở dưới hình đứng
    const khung = c => [-m, -m * 0.75, W + 2 * m, H + m * 1.5 + (nhieuThung ? c * 2.4 : 0) + (dsKhau.length ? Dk + c * 6 : 0)];
    // bề rộng hình (px): không vượt rong_px, và nếu có cao_px thì hình không cao quá cao_px (tủ hẹp mà cao)
    const coPx = v => rn(opts.cao_px > 0 ? Math.min(opts.rong_px, opts.cao_px * v[2] / v[3]) : opts.rong_px, 1);
    // cỡ chữ theo mm; (bản 1.28) hình nhỏ trên màn thì nâng cho chữ cao ít nhất ~10 px (trước: ~6 px, khó đọc) — tối đa gấp 1,7 để chữ không đè nhau
    const fs0 = Math.max(W, H) / 46, fs = Math.max(fs0, Math.min(fs0 * 1.7, 10 / (coPx(khung(fs0)) / khung(fs0)[2])));
    const vb = khung(fs);
    const Y = z => H - z, f = v => rn(v, 1);
    const rongPx = coPx(vb), tiLe = rongPx / vb[2];      // tiLe = px trên 1 mm
    let o = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(f).join(' ')}" width="${rongPx}" style="max-width:100%;height:auto;font-family:system-ui,Segoe UI,Arial,sans-serif" role="img" aria-label="Hình đứng ${esc(s.ten)}">`;
    o += `<rect x="${f(vb[0])}" y="${f(vb[1])}" width="${f(vb[2])}" height="${f(vb[3])}" fill="#fbfaf7"/>`;
    const R = (p, extra) => `<rect x="${f(p.x0)}" y="${f(Y(p.z1))}" width="${f(p.x1 - p.x0)}" height="${f(p.z1 - p.z0)}" ${extra}/>`;
    const order = ['HAU', 'PHU', 'DE', 'GO', 'DOT', 'DAY', 'NOC', 'GIANG', 'LOT', 'TREO', 'DEM', 'NEP', 'HOI', 'VACH', 'CHAN', 'PHAO', 'MKP', 'MU', 'DG', 'XU', 'OP', 'DEB', 'TH', 'DA', 'PH', 'HNK', 'TNK', 'DNK', 'HG', 'THH', 'DUG', 'MNK'];
    for (const loai of order) for (const p of M.parts) if (p.loai === loai) {
      if (loai === 'PHU' && p.type !== 0) continue;
      o += R(p, `fill="${MAU[loai]}" stroke="#39424a" stroke-width="${f(fs / 9)}"${loai === 'HAU' ? ' stroke-opacity=".25"' : ''}`);
    }
    // (bản 1.35) cánh khung kính: lòng kính trong khung 4 thanh
    for (const p of M.parts) if (p.loai === 'CANH' && p.kinh) { const k = p.kinh.thanh; o += `<rect data-kinh="1" x="${f(p.x0 + k)}" y="${f(Y(p.z1 - k))}" width="${f(Math.max(0, p.x1 - p.x0 - 2 * k))}" height="${f(Math.max(0, p.z1 - p.z0 - 2 * k))}" fill="#d9eef5" fill-opacity=".85" stroke="#39424a" stroke-width="${f(fs / 12)}"/>`; }
    // (1.34.1) tay nắm của táp trên mặt ngăn kéo: núm tròn ở tâm mặt; khoét chữ U giữa mép trên (TAP_KHOET); khe tay nắm / tay nắm nổi thì không vẽ
    const tayNamTap = q => {
      const xc = q.x + q.w / 2;
      if (q.tay_nam === 'num') return `<circle data-num="1" cx="${f(xc)}" cy="${f(Y(q.z + q.h / 2))}" r="${f(Math.min(16, q.h / 6))}" fill="#fff" stroke="#39424a" stroke-width="${f(fs / 8)}"/>`;
      if (q.tay_nam === 'khoet') { const a = Math.min(TAP_KHOET[0], q.w * 0.6) / 2, b = Math.min(TAP_KHOET[1], q.h / 3), y1 = Y(q.z + q.h);
        return `<path data-khoet="1" d="M ${f(xc - a)} ${f(y1)} A ${f(a)} ${f(b)} 0 0 0 ${f(xc + a)} ${f(y1)} Z" fill="#b89b72" stroke="#39424a" stroke-width="${f(fs / 8)}"/>`; }
      return '';
    };
    for (const q of M.mat_ngan_keo) if (!q.trum) {
      o += `<rect x="${f(q.x)}" y="${f(Y(q.z + q.h))}" width="${f(q.w)}" height="${f(q.h)}" fill="#d9eed5" stroke="#2d6b38" stroke-width="${f(fs / 7)}"/>`;
      o += `<text x="${f(q.x + q.w / 2)}" y="${f(Y(q.z + q.h / 2) + fs * 0.35 + (q.tay_nam === 'num' ? Math.min(16, q.h / 6) + fs : 0))}" font-size="${f(fs)}" text-anchor="middle" fill="#1f4d29">ngăn kéo ${g(q.w)}×${g(q.h)}</text>`;
      o += tayNamTap(q);
    }
    // xà ngăn kéo nằm sau mặt ngăn kéo: vẽ nét đứt đè lên để thấy vị trí
    // (bản 1.31) thanh ngang khung mặt nằm PHẲNG mặt ngăn kéo → vẽ đặc như nẹp; xà ẩn sau khe (kiểu cũ) vẫn nét đứt
    for (const p of M.parts) if (p.loai === 'XA') o += p.khung_mat ? R(p, `fill="${MAU.NEP}" stroke="#39424a" stroke-width="${f(fs / 9)}"`) : R(p, `fill="${MAU.XA}" fill-opacity=".3" stroke="#2d6b38" stroke-width="${f(fs / 9)}" stroke-dasharray="${f(fs * 0.7)} ${f(fs * 0.5)}"`);
    for (const tp of M.templates) if (tp.loai === 'SUOT') {
      const z = tp.pos[2] + tp.box[2] - s.suot.cach_dot - 15;
      o += `<line x1="${f(tp.pos[0] + 8)}" y1="${f(Y(z))}" x2="${f(tp.pos[0] + tp.box[0] - 8)}" y2="${f(Y(z))}" stroke="#59616b" stroke-width="${f(fs / 2.2)}" stroke-linecap="round"/>`;
      o += `<text x="${f(tp.pos[0] + tp.box[0] / 2)}" y="${f(Y(z) + fs * 1.5)}" font-size="${f(fs * 0.9)}" text-anchor="middle" fill="#414850">suốt treo</text>`;
    }
    if (opts.canh) for (const p of M.parts) if (p.loai === 'CANH') {
      o += R(p, `fill="${MAU.CANH}" fill-opacity=".14" stroke="#245c2f" stroke-width="${f(fs / 7)}"`);
      const xm = p.open === 2 ? p.x1 : p.x0, xo = p.open === 2 ? p.x0 : p.x1, zc = (p.z0 + p.z1) / 2;
      o += `<polyline points="${f(xm)},${f(Y(p.z1))} ${f(xo)},${f(Y(zc))} ${f(xm)},${f(Y(p.z0))}" fill="none" stroke="#245c2f" stroke-width="${f(fs / 10)}" stroke-dasharray="${f(fs)} ${f(fs * 0.7)}"/>`;
      if (p.ban_le) for (const z of p.ban_le.z) { const xc = p.ban_le.ben === 'trai' ? p.x0 + M.spec.canh.chen.tam_mep : p.x1 - M.spec.canh.chen.tam_mep; o += `<circle data-ban-le="1" cx="${f(xc)}" cy="${f(Y(p.z0 + z))}" r="${f(M.spec.canh.chen.d / 2)}" fill="#fff" fill-opacity=".7" stroke="#245c2f" stroke-width="${f(fs / 8)}"/>`; }
    }
    // mặt ngăn kéo trùm ngoài: nằm ở mặt phẳng cánh nên luôn vẽ (kể cả khi tắt "hiện cánh")
    for (const q of M.mat_ngan_keo) if (q.trum) {
      o += `<rect x="${f(q.x)}" y="${f(Y(q.z + q.h))}" width="${f(q.w)}" height="${f(q.h)}" fill="${MAU.CHAN}" fill-opacity=".8" stroke="#245c2f" stroke-width="${f(fs / 6)}"/>`;
      if (!q.tay_nam) o += `<line x1="${f(q.x + q.w * 0.42)}" y1="${f(Y(q.z + q.h) + Math.min(q.h * 0.28, fs * 1.6))}" x2="${f(q.x + q.w * 0.58)}" y2="${f(Y(q.z + q.h) + Math.min(q.h * 0.28, fs * 1.6))}" stroke="#245c2f" stroke-width="${f(fs / 4)}" stroke-linecap="round"/>`;
      o += `<text x="${f(q.x + q.w / 2)}" y="${f(Y(q.z + q.h / 2) + fs * 0.7)}" font-size="${f(fs)}" text-anchor="middle" fill="#143b1d">ngăn kéo trùm ${g(q.w)}×${g(q.h)}</text>`;
      o += tayNamTap(q);
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
      // PHÀO (bản 1.28 — anh Thanh 06/10/2026: "chọn trên ảnh thêm phào sửa phào luôn cho nhanh"): bấm vào phào để sửa / bỏ; mép nào chưa có phào thì có dải "+ phào" nét đứt ngay ngoài mép đó
      // (1.33 vòng soát 2) tủ bếp không có phào (normBep luôn đặt 0) → không bày vùng "+ phào" để bấm
      const TEN_PHAO = { trai: 'trái', phai: 'phải', tren: 'trên' };
      for (const ben of loaiSP(s) === 'bep' ? [] : ['trai', 'phai', 'tren']) {
        const on = !!(ch && ch.loai === 'phao' && ch.ben === ben), ds = M.parts.filter(p => p.loai === 'PHAO' && benPhao(p, s) === ben);
        const tieu = `<title>Phào ${TEN_PHAO[ben]}${ds.length ? ` rộng ${g(s.phao[ben])} — bấm để sửa / bỏ` : ' — chưa có, bấm để thêm'}</title>`;
        if (ds.length) {
          for (const p of ds) o += `<rect data-phao="${ben}" x="${f(p.x0)}" y="${f(Y(p.z1))}" width="${f(p.x1 - p.x0)}" height="${f(p.z1 - p.z0)}" fill="${acc}" fill-opacity="${on ? '.28' : '0'}"${on ? ` stroke="${acc}" stroke-width="${f(fs / 5)}"` : ''} style="cursor:pointer">${tieu}</rect>`;
        } else {
          const d = fs * 1.3, z0 = s.chan.cao;
          const r = ben === 'tren' ? [0, Y(H) - d - fs * 0.3, W, d] : [ben === 'trai' ? -d - fs * 0.3 : W + fs * 0.3, Y(H), d, H - z0];
          o += `<rect data-phao="${ben}" x="${f(r[0])}" y="${f(r[1])}" width="${f(r[2])}" height="${f(r[3])}" fill="${on ? acc : '#fff'}" fill-opacity="${on ? '.2' : '.6'}" stroke="${acc}" stroke-width="${f(fs / 9)}" stroke-dasharray="${f(fs * 0.5)} ${f(fs * 0.35)}" style="cursor:pointer">${tieu}</rect>`;
          const cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2;
          o += `<text x="${f(cx)}" y="${f(cy + fs * 0.35)}" font-size="${f(fs * 0.9)}" text-anchor="middle" fill="${acc}" font-weight="700" pointer-events="none"${ben === 'tren' ? '' : ` transform="rotate(-90 ${f(cx)} ${f(cy)})"`}>+ phào</text>`;
        }
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
          o += `<text x="${f(c.x0 + rong / 2)}" y="${f(Yp(cy0 + c.sau / 2) + fs * 0.35)}" font-size="${f(fs * 0.95)}" text-anchor="middle" fill="#1b2420" font-weight="700" pointer-events="none">cột ${g(rong)}×${g(c.sau)}</text>`;
          const chu = giua ? (k.co_a && k.co_b ? 'khoang nông trước cột' : k.co_a || k.co_b ? '1 vách sẵn + 1 vách khấu' : '2 vách khấu') : (k.vach_co_san ? 'vách làm vách khấu' : 'vách khấu');
          if (giua) o += `<text x="${f((k.xa + k.xb) / 2)}" y="${f(Yp(k.sau_thung) + fs * 1.25)}" font-size="${f(fs * 0.85)}" text-anchor="middle" fill="${mauK}" pointer-events="none">${chu} · sâu ${g(k.sau_thung)}</text>`;
          else { const trai = k.ben !== 'phai'; o += `<text x="${f(trai ? k.x + s.van.t + fs * 0.5 : k.x - s.van.t - fs * 0.5)}" y="${f(Yp((k.sau_thung + Dk) / 2) + fs * 0.35)}" font-size="${f(fs * 0.85)}" text-anchor="${trai ? 'start' : 'end'}" fill="${mauK}" pointer-events="none">${chu} · thùng trước cột sâu ${g(k.sau_thung)}</text>`; }
        });
        // (bản 1.28) bấm vào cột để bỏ khấu — data-cot = "x0:x1" của cây cột (giao diện tìm cột trong thông số theo khoảng này). Vẽ SAU mọi chữ của hình này: chữ của cột sau không được che chỗ bấm của cột trước
        if (opts.tuong_tac) dsKhau.forEach(k => {
          const c = k.cot, ch = opts.chon, on = !!(ch && ch.loai === 'cot' && Math.abs(ch.x0 - c.x0) < 0.6 && Math.abs(ch.x1 - c.x1) < 0.6), acc = '#1c5fb8';
          o += `<rect data-cot="${f(c.x0)}:${f(c.x1)}" x="${f(c.x0)}" y="${f(Yp(Dk))}" width="${f(c.x1 - c.x0)}" height="${f(c.sau)}" fill="${acc}" fill-opacity="${on ? '.25' : '0'}"${on ? ` stroke="${acc}" stroke-width="${f(fs / 5)}"` : ''} style="cursor:pointer"><title>Cột ${g(c.x1 - c.x0)}×${g(c.sau)} — bấm để bỏ khấu cột này</title></rect>`;
        });
      }
    }
    return o + '</svg>';
  }
  /** Phào nằm ở mép nào của tủ: 'trai' | 'phai' | 'tren' (theo chỗ của tấm — tên tấm có thể đã dịch). */
  function benPhao(p, s) {
    const W = s.rong, e = 0.6;
    if (p.x1 <= s.phao.trai + e && p.x0 <= e) return 'trai';
    if (p.x0 >= W - s.phao.phai - e && p.x1 >= W - e) return 'phai';
    return 'tren';
  }

  /**
   * HÌNH 3D của tủ (bản 1.27.1 — anh Thanh 06/10/2026: "hình minh họa có 3d"): mỗi tấm là một hộp vuông trục, chiếu song song theo góc nhìn
   * az (độ, 0 = nhìn thẳng mặt cánh, dương = vòng sang bên PHẢI tủ) / el (độ, nhìn từ trên xuống). Hộp xa vẽ trước, hộp gần vẽ sau: hai hộp có hình chồng nhau
   * thì xếp theo mặt phẳng tách chúng (hộp nằm phía khuất của mặt phẳng đó vẽ trước) — xếp theo tâm hộp sai với tấm mỏng dài (hậu, đợt).
   * opts: { az, el, canh (vẽ cánh, nửa trong), rong_px, cao_px, tuong_tac (vùng bấm: data-phao = trai | phai | tren trên phào, data-cot = "x0:x1" trên cột) }.
   * Cột của khấu cột (M.info.khau) vẽ thành khối xám mờ sau lưng tủ. Chạy được trong Node (không đụng DOM).
   */
  /** Vỏ lồi của các điểm 2D (thuật toán chuỗi đơn điệu), ngược chiều kim đồng hồ. */
  function voLoi(ds) {
    const p = ds.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const duoi = [], tren = [];
    for (const q of p) { while (duoi.length >= 2 && cr(duoi[duoi.length - 2], duoi[duoi.length - 1], q) <= 1e-9) duoi.pop(); duoi.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (tren.length >= 2 && cr(tren[tren.length - 2], tren[tren.length - 1], q) <= 1e-9) tren.pop(); tren.push(q); }
    return duoi.slice(0, -1).concat(tren.slice(0, -1));
  }

  function hinh3D(M, opts) {
    opts = Object.assign({ az: 30, el: 22, canh: true, rong_px: 640 }, opts || {});
    const s = M.spec, rad = Math.PI / 180, az = Math.max(-89, Math.min(89, +opts.az || 0)) * rad, el = Math.max(0, Math.min(80, +opts.el || 0)) * rad;
    // hướng từ cảnh về phía người nhìn (mặt cánh ở phía y âm), trục ngang và trục đứng của màn hình
    const d = [Math.sin(az) * Math.cos(el), -Math.cos(az) * Math.cos(el), Math.sin(el)];
    const r = [Math.cos(az), Math.sin(az), 0], u = [-Math.sin(az) * Math.sin(el), Math.cos(az) * Math.sin(el), Math.cos(el)];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const hop = [];      // { b: [x0,y0,z0,x1,y1,z1], mau, op, attr }
    const them = (b, mau, op, attr) => { if (b[3] - b[0] > 0.01 && b[4] - b[1] > 0.01 && b[5] - b[2] > 0.01) hop.push({ b, mau, op: op == null ? 1 : op, attr: attr || '' }); };
    // (1.34.1, táp theo ảnh mẫu) KHỐI NHIỀU MẶT — hồi bo góc, núm tròn, mặt ngăn kéo khoét chữ U, chân gỗ vát. mat = [{ pts (đỉnh 3D), n (pháp tuyến ra ngoài) }];
    // b = hộp bao (chỉ để xếp thứ tự với khối khác); trong khối vẽ các mặt hướng về người nhìn, xa trước gần sau. Khối này không bị cắt khi gỡ vòng.
    const themKhoi = (mat, mau, ten) => {
      const all = [].concat(...mat.map(m => m.pts)), b = [0, 1, 2].map(k => Math.min(...all.map(q => q[k]))).concat([0, 1, 2].map(k => Math.max(...all.map(q => q[k]))));
      if (b[3] - b[0] > 0.01 && b[4] - b[1] > 0.01 && b[5] - b[2] > 0.01) hop.push({ b, mau, op: 1, attr: '', mat, ten });
    };
    // lăng trụ: biên dạng 2D (u, v) trên mặt phẳng vuông góc trục `ax` (u = trục ax+1, v = trục ax+2), kéo từ a0 tới a1 theo trục ax
    const langTru = (ax, bd, a0, a1) => {
      const ku = (ax + 1) % 3, kv = (ax + 2) % 3, dt = bd.reduce((S, q, i) => S + q[0] * bd[(i + 1) % bd.length][1] - bd[(i + 1) % bd.length][0] * q[1], 0);
      const P = dt < 0 ? bd.slice().reverse() : bd.slice(), d3 = (q, a) => { const v = [0, 0, 0]; v[ax] = a; v[ku] = q[0]; v[kv] = q[1]; return v; }, out = [];
      const n0 = [0, 0, 0], n1 = [0, 0, 0]; n0[ax] = -1; n1[ax] = 1;
      out.push({ pts: P.map(q => d3(q, a0)).reverse(), n: n0 }, { pts: P.map(q => d3(q, a1)), n: n1 });
      for (let i = 0; i < P.length; i++) { const q = P[i], r2 = P[(i + 1) % P.length], n = [0, 0, 0]; n[ku] = r2[1] - q[1]; n[kv] = -(r2[0] - q[0]); const L = Math.hypot(n[ku], n[kv]); if (L < 1e-9) continue; n[ku] /= L; n[kv] /= L;
        out.push({ pts: [d3(q, a0), d3(r2, a0), d3(r2, a1), d3(q, a1)], n, cong: !!(q.c && r2.c) }); }
      return out;
    };
    const cung = (cu, cv, ru, rv, t0, t1, so) => { const o = []; for (let i = 0; i <= so; i++) { const a = t0 + (t1 - t0) * i / so, q = [cu + ru * Math.cos(a), cv + rv * Math.sin(a)]; q.c = true; o.push(q); } return o; };      // điểm trên cung mang cờ c: dải mặt giữa hai điểm cung vẽ nét mờ
    // tấm khoét quanh cột (đáy / nóc / đợt của tủ khấu cột — p.khau: dải x0 … x1 bị cắt từ y0 tới mép sau): chia theo từng khoảng ngang thành các khối,
    // khối nào nằm trong dải khoét thì chỉ sâu tới y0 của chỗ khoét — không vẽ xuyên qua cột / hộp che cột
    const khoiTam = p => {
      const ks = p.khau || [];
      if (!ks.length) return [[p.x0, p.y0, p.z0, p.x1, p.y1, p.z1]];
      const xs = [...new Set([p.x0, p.x1].concat(...ks.map(k => [k.x0, k.x1])).map(v => Math.max(p.x0, Math.min(p.x1, v))))].sort((a, b) => a - b), out = [];
      for (let i = 0; i + 1 < xs.length; i++) {
        const a = xs[i], b = xs[i + 1], m = (a + b) / 2; if (b - a < 0.01) continue;
        const y1 = Math.min(p.y1, ...ks.filter(k => k.x0 <= m && k.x1 >= m).map(k => k.y0)), cuoi = out[out.length - 1];
        if (cuoi && Math.abs(cuoi[4] - y1) < 0.01 && Math.abs(cuoi[3] - a) < 0.01) cuoi[3] = b; else out.push([a, p.y0, p.z0, b, y1, p.z1]);
      }
      return out;
    };
    for (const p of M.parts) {
      if (p.loai === 'CANH' && !opts.canh) continue;
      const attr = opts.tuong_tac && p.loai === 'PHAO' ? ` data-phao="${benPhao(p, s)}" style="cursor:pointer"` : '';
      const bo = p.loai === 'HOI' && !(p.khau || []).length && /bo tròn góc trên phía trước R(\d+(?:[.,]\d+)?)/.exec(p.gia_cong || '');
      if (bo) {      // (1.34.1) hồi táp bo góc trên phía trước: biên dạng (y, z) bo cung R ở góc (y0, z1), kéo theo bề dày x
        const R = Math.min(+bo[1].replace(',', '.'), p.y1 - p.y0, p.z1 - p.z0);
        themKhoi(langTru(0, [[p.y0, p.z0], [p.y1, p.z0], [p.y1, p.z1]].concat(cung(p.y0 + R, p.z1 - R, R, R, Math.PI / 2, Math.PI, 8)), p.x0, p.x1), MAU.HOI, 'Hồi bo');
        continue;
      }
      for (const b of khoiTam(p)) them(b, MAU[p.loai] || '#ccc', p.loai === 'CANH' ? 0.45 : p.loai === 'HAU' ? 0.9 : 1, attr);
    }
    for (const q of M.mat_ngan_keo || []) {
      if (q.trum && !opts.canh) { /* mặt trùm nằm ở mặt phẳng cánh: vẫn vẽ như hình đứng */ }
      const y0 = q.y != null ? q.y : (q.trum ? -(q.t || 18) : 0), mauMat = q.trum ? MAU.CHAN : '#d9eed5', xc = q.x + q.w / 2;
      if (q.tay_nam === 'khoet') {      // (1.34.1) mặt táp khoét chữ U giữa mép trên: biên dạng (z, x) kéo theo bề dày y
        const a = Math.min(TAP_KHOET[0], q.w * 0.6) / 2, bk = Math.min(TAP_KHOET[1], q.h / 3), z1 = q.z + q.h;
        const U = []; for (let i = 0; i <= 10; i++) { const a2 = Math.PI * i / 10, pt = [z1 - bk * Math.sin(a2), xc + a * Math.cos(a2)]; pt.c = true; U.push(pt); }
        themKhoi(langTru(1, [[q.z, q.x], [q.z, q.x + q.w], [z1, q.x + q.w]].concat(U, [[z1, q.x]]), y0, y0 + (q.t || 18)), mauMat, 'Mặt khoét');
      } else them([q.x, y0, q.z, q.x + q.w, y0 + (q.t || 18), q.z + q.h], mauMat, 1, '');
      if (q.tay_nam === 'num') { const r0 = Math.min(16, q.h / 6); themKhoi(langTru(1, cung(q.z + q.h / 2, xc, r0, r0, 0, 2 * Math.PI, 12).slice(0, 12), y0 - 22, y0), '#f4f1ea', 'Núm'); }
    }
    for (const tp of M.templates || []) if (tp.loai === 'SUOT') {
      const z = tp.pos[2] + tp.box[2] - s.suot.cach_dot - 15, yc = tp.pos[1] + tp.box[1] / 2;
      them([tp.pos[0] + 8, yc - 8, z - 8, tp.pos[0] + tp.box[0] - 8, yc + 8, z + 8], '#59616b', 1, '');
    }
    for (const k of M.khoi_phu || []) {
      if (k.vat) {      // (1.34.1) chân gỗ vát: đầu trên = hộp k.b, đầu dưới nhỏ lại 2/3 và choãi ra ngoài theo k.vat
        const [x0, y0, z0, x1, y1, z1] = k.b, a = (x1 - x0) / 3, dx = k.vat[0] * a, dy = k.vat[1] * a, xm = (x0 + x1) / 2 + dx, ym = (y0 + y1) / 2 + dy, h = (x1 - x0) / 3;
        const T = [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], B = [[xm - h, ym - h, z0], [xm + h, ym - h, z0], [xm + h, ym + h, z0], [xm - h, ym + h, z0]];
        const mat = [{ pts: T, n: [0, 0, 1] }, { pts: B.slice().reverse(), n: [0, 0, -1] }];
        for (let i = 0; i < 4; i++) { const j = (i + 1) % 4, pts = [B[i], B[j], T[j], T[i]], e1 = pts[1].map((v, k2) => v - pts[0][k2]), e2 = pts[3].map((v, k2) => v - pts[0][k2]);
          const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], L = Math.hypot(...n); mat.push({ pts, n: n.map(v => v / L) }); }
        themKhoi(mat, k.mau || '#cfcac2', k.ten);
      } else them(k.b.slice(), k.mau || '#cfcac2', 0.95, '');
    }      // (bản 1.33) mặt đá tủ bếp: khối phụ, không phải tấm
    const D = s.sau_thung;
    for (const k of (M.info && M.info.khau) || []) {
      const c = k.cot; if (!c) continue;
      them([c.x0, D - c.sau, 0, c.x1, D, s.cao], '#8d949c', 0.5, opts.tuong_tac ? ` data-cot="${rn(c.x0, 1)}:${rn(c.x1, 1)}" style="cursor:pointer"` : '');
    }
    // mặt hướng về người nhìn của từng hộp
    const MAT = [[0, -1, 'x0'], [0, 1, 'x1'], [1, -1, 'y0'], [1, 1, 'y1'], [2, -1, 'z0'], [2, 1, 'z1']];
    const dinh = (b, k, mat) => {
      const v = mat > 0 ? b[k + 3] : b[k], a = (k + 1) % 3, c = (k + 2) % 3, out = [];
      for (const [i, j] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { const p = [0, 0, 0]; p[k] = v; p[a] = i ? b[a + 3] : b[a]; p[c] = j ? b[c + 3] : b[c]; out.push(p); }
      return out;
    };
    const chieu = p => [dot(p, r), -dot(p, u)];
    const tinhKhoi = h => {
      const c = [0, 1, 2].map(k => (h.b[k] + h.b[k + 3]) / 2);
      h.sau = dot(c, d);
      const goc = []; for (let i = 0; i < 8; i++) goc.push(chieu([h.b[(i & 1) ? 3 : 0], h.b[(i & 2) ? 4 : 1], h.b[(i & 4) ? 5 : 2]]));
      h.k = [Math.min(...goc.map(q => q[0])), Math.min(...goc.map(q => q[1])), Math.max(...goc.map(q => q[0])), Math.max(...goc.map(q => q[1]))];
      h.vo = voLoi(goc);
    };
    hop.forEach(tinhKhoi);
    // hai hình chiếu (đa giác lồi) có chồng lên nhau thật không — so khung chữ nhật bao ngoài thì thừa quan hệ, mà quan hệ thừa dễ khép thành vòng (tủ khấu cột: đợt · hậu khấu · suốt treo)
    const chongNhau = (P, Q) => {
      for (const D of [P, Q]) for (let i = 0; i < D.length; i++) {
        const a = D[i], b = D[(i + 1) % D.length], nx = a[1] - b[1], ny = b[0] - a[0];
        let p0 = Infinity, p1 = -Infinity, q0 = Infinity, q1 = -Infinity;
        for (const v of P) { const t = v[0] * nx + v[1] * ny; p0 = Math.min(p0, t); p1 = Math.max(p1, t); }
        for (const v of Q) { const t = v[0] * nx + v[1] * ny; q0 = Math.min(q0, t); q1 = Math.max(q1, t); }
        const L = Math.hypot(nx, ny) || 1;
        if (p1 <= q0 + 0.05 * L || q1 <= p0 + 0.05 * L) return false;
      }
      return true;
    };
    // a vẽ trước b? (1 = a ở xa hơn, -1 = a ở gần hơn, 0 = không xét). Hai hộp tách nhau theo trục k: hộp nằm phía người nhìn của mặt tách thì gần hơn.
    const e = 0.5;
    const truoc = (A, B) => {
      let chon = 0;
      for (let k = 0; k < 3; k++) {
        if (Math.abs(d[k]) < 1e-9) continue;
        let v = 0;
        if (A.b[k + 3] <= B.b[k] + e) v = d[k] > 0 ? 1 : -1;
        else if (B.b[k + 3] <= A.b[k] + e) v = d[k] > 0 ? -1 : 1;
        if (v) { if (chon && chon !== v) return 0; chon = v; }      // hai mặt phẳng tách cho hai kết quả ngược nhau: hai khối không thể che nhau → không đặt quan hệ (đặt bừa là sinh vòng lặp)
      }
      return chon;
    };
    // quan hệ "vẽ trước" giữa các khối có hình chồng nhau. Ba khối chồng kiểu móc xích (tủ khấu cột: suốt treo dưới đợt, trước hậu khấu; hậu khấu che đầu đợt) là vòng THẬT —
    // thứ tự nào cũng sai một chỗ → cắt đôi một khối trong vòng tại mép của khối khác rồi xếp lại (tối đa 8 lượt). Không cắt cánh khi còn khối khác để cắt (cánh nửa trong suốt, lộ đường cắt).
    let n = 0, sauHon = [], vao = [];
    const dungDoThi = () => {
      n = hop.length; sauHon = hop.map(() => []); vao = new Array(n).fill(0);
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const A = hop[i], B = hop[j];
        if (A.k[2] <= B.k[0] || B.k[2] <= A.k[0] || A.k[3] <= B.k[1] || B.k[3] <= A.k[1] || !chongNhau(A.vo, B.vo)) continue;      // hình không chồng nhau: thứ tự nào cũng được
        const v = truoc(A, B);
        if (v > 0) { sauHon[i].push(j); vao[j]++; } else if (v < 0) { sauHon[j].push(i); vao[i]++; }
      }
    };
    const timVong = () => {      // các thành phần liên thông mạnh có từ 2 khối (Tarjan)
      let dem = 0; const st = [], tren = [], so = [], thap = [], ds = [];
      const di = v => { so[v] = thap[v] = dem++; st.push(v); tren[v] = true;
        for (const w of sauHon[v]) { if (so[w] === undefined) { di(w); thap[v] = Math.min(thap[v], thap[w]); } else if (tren[w]) thap[v] = Math.min(thap[v], so[w]); }
        if (thap[v] === so[v]) { const c = []; let w; do { w = st.pop(); tren[w] = false; c.push(w); } while (w !== v); if (c.length > 1) ds.push(c); } };
      for (let v = 0; v < n; v++) if (so[v] === undefined) di(v);
      return ds;
    };
    dungDoThi();
    for (let luot = 0; luot < 8 && hop.length < 600; luot++) {
      const vong = timVong(); if (!vong.length) break;
      let daCat = false;
      for (const c of vong) {
        const ung = c.slice().sort((i, j) => ((hop[i].op < 1) - (hop[j].op < 1)) || (Math.max(...[0, 1, 2].map(k => hop[j].b[k + 3] - hop[j].b[k])) - Math.max(...[0, 1, 2].map(k => hop[i].b[k + 3] - hop[i].b[k]))));
        let cat = null;
        for (const i of ung) {
          const A = hop[i]; if (A.mat) continue;
          for (const j of c) if (j !== i) for (let k = 0; k < 3; k++) for (const mp of [hop[j].b[k], hop[j].b[k + 3]]) {
            if (mp > A.b[k] + 1 && mp < A.b[k + 3] - 1) { const lech = Math.abs(mp - (A.b[k] + A.b[k + 3]) / 2) / (A.b[k + 3] - A.b[k]); if (!cat || lech < cat.lech) cat = { i, k, mp, lech }; }
          }
          if (cat) break;
        }
        if (!cat) continue;
        const A = hop[cat.i], b1 = A.b.slice(), b2 = A.b.slice(); b1[cat.k + 3] = cat.mp; b2[cat.k] = cat.mp;
        hop[cat.i] = Object.assign({}, A, { b: b1 }); hop.push(Object.assign({}, A, { b: b2 }));
        tinhKhoi(hop[cat.i]); tinhKhoi(hop[hop.length - 1]); daCat = true;
      }
      if (!daCat) break;
      dungDoThi();
    }
    // xếp theo các quan hệ trên; còn lại / vòng lặp thì theo tâm hộp (xa trước)
    const xep = [], xong = new Array(n).fill(false);      // (n = số khối sau khi cắt)
    while (xep.length < n) {
      let pick = -1;
      for (let i = 0; i < n; i++) if (!xong[i] && vao[i] === 0 && (pick < 0 || hop[i].sau < hop[pick].sau)) pick = i;
      if (pick < 0) for (let i = 0; i < n; i++) if (!xong[i] && (pick < 0 || hop[i].sau < hop[pick].sau)) pick = i;
      xong[pick] = true; xep.push(pick);
      for (const j of sauHon[pick]) vao[j]--;
    }
    if (opts.du_lieu) return { hop, xep, d, r, u };      // cho phép thử: các khối + thứ tự vẽ + hướng nhìn
    // khung hình
    const tatCa = hop.length ? hop.map(h => h.k) : [[0, 0, 1, 1]];
    const x0 = Math.min(...tatCa.map(q => q[0])), y0 = Math.min(...tatCa.map(q => q[1])), x1 = Math.max(...tatCa.map(q => q[2])), y1 = Math.max(...tatCa.map(q => q[3]));
    const m = Math.max(x1 - x0, y1 - y0) * 0.05 + 20, vb = [x0 - m, y0 - m, x1 - x0 + 2 * m, y1 - y0 + 2 * m];
    const rongPx = rn(opts.cao_px > 0 ? Math.min(opts.rong_px, opts.cao_px * vb[2] / vb[3]) : opts.rong_px, 1), f = v => rn(v, 1);
    const sw = f(Math.max(vb[2], vb[3]) / 900);
    // sáng tối theo hướng mặt: mặt trên sáng nhất, mặt bên tối hơn
    const sang = (hex, k) => { const v = parseInt(hex.slice(1), 16), c = [v >> 16, (v >> 8) & 255, v & 255].map(x => Math.max(0, Math.min(255, Math.round(x * k)))); return '#' + c.map(x => x.toString(16).padStart(2, '0')).join(''); };
    let o = `<svg xmlns="http://www.w3.org/2000/svg" data-3d="1" viewBox="${vb.map(f).join(' ')}" width="${rongPx}" style="max-width:100%;height:auto;touch-action:none;cursor:grab;font-family:system-ui,Segoe UI,Arial,sans-serif" role="img" aria-label="Hình 3D ${esc(s.ten)}">`;
    o += `<rect x="${f(vb[0])}" y="${f(vb[1])}" width="${f(vb[2])}" height="${f(vb[3])}" fill="#fbfaf7"/>`;
    for (const i of xep) {
      const h = hop[i];
      let g2 = `<g${h.attr}${h.op < 1 ? ` fill-opacity="${h.op}"` : ''}>`;
      if (h.mat) {
        const tam = m2 => dot([0, 1, 2].map(k => m2.pts.reduce((S, q) => S + q[k], 0) / m2.pts.length), d);
        for (const m2 of h.mat.filter(m2 => dot(m2.n, d) > 1e-9).sort((A, B) => tam(A) - tam(B))) {
          const ks = (Math.abs(m2.n[2]) * 1.08 + Math.abs(m2.n[1]) * 1 + Math.abs(m2.n[0]) * 0.86) / (Math.abs(m2.n[0]) + Math.abs(m2.n[1]) + Math.abs(m2.n[2]));
          g2 += `<polygon points="${m2.pts.map(chieu).map(q => f(q[0]) + ',' + f(q[1])).join(' ')}" fill="${sang(h.mau, ks)}" stroke="#39424a" stroke-width="${sw}" stroke-opacity="${m2.cong ? '.12' : '.55'}" stroke-linejoin="round"/>`;
        }
        o += g2 + '</g>'; continue;
      }
      for (const [k, mat] of MAT) {
        const nn = [0, 0, 0]; nn[k] = mat;
        if (dot(nn, d) <= 1e-9) continue;
        const pts = dinh(h.b, k, mat).map(chieu);
        const ksang = k === 2 ? 1.08 : k === 1 ? 1 : 0.86;
        g2 += `<polygon points="${pts.map(q => f(q[0]) + ',' + f(q[1])).join(' ')}" fill="${sang(h.mau, ksang)}" stroke="#39424a" stroke-width="${sw}" stroke-opacity=".55" stroke-linejoin="round"/>`;
      }
      o += g2 + '</g>';
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
    if (M.tom_tat) return M.tom_tat.concat([`Tấm ván: ${cl.tong_sl} tấm — ${cl.theo_day.map(d => `ván ${g(d.day)}: ${d.sl} tấm, ${m2(d.m2)} m²`).join('; ')} (${Object.keys(cl.tong).map(k => `${k} ${cl.tong[k].sl}`).join(', ')}).`]);
    const HK = hauCua(s);      // (1.36.2) táp: hậu soi rãnh lọt lòng bất kể Chuẩn xưởng
    const hau = s.bep && (s.bep.chuc_nang === 'chau' || s.bep.chuc_nang === 'hm') ? 'không hậu' : HK.kieu === 'phu' ? `hậu ${g(HK.t)} phủ sau lưng thùng, bắn đinh (hồi sâu ${g(s.sau_thung - HK.t)} + hậu ${g(HK.t)})` : HK.kieu === 'mong' ? `hậu mỏng soi rãnh ${g(HK.t)}${HK.tap ? ' (lọt lòng, không lộ cạnh)' : ''}` : `hậu dày lọt lòng ${g(HK.t)}`;
    L.push(`${s.ten} — phủ bì ${g(s.rong)} × ${g(s.cao)}, thùng sâu ${g(s.sau_thung)}, ván ${g(s.van.t)}, ${hau}.`);
    if (M.info.bep) { const B = s.bep, I = M.info.bep; L.push(I.tang === 'duoi' ? `Tủ bếp dưới: chân ${g(B.chan)} (xà chân lùi ${g(B.len_lui)}), ${B.noc === 'giang' ? 'giằng thay nóc' : 'nóc liền'}, mặt đá ${g(B.cao_mat)} (đá ${g(B.day_da)}${B.van_lot ? ` + lót ${g(B.van_lot)}` : ''}), lọt lòng ${g(I.lot)}.` : I.tang === 'tren' ? `Tủ bếp trên: treo cách mặt đá ${g(B.cach_tren)} (đáy tủ ở +${g(I.z_dat)}), thanh treo ${g(B.thanh_treo)}, lọt lòng ${g(I.lot)}.` : `Tủ bếp cao: chân ${g(B.chan)} (xà chân lùi ${g(B.len_lui)}), lọt lòng ${g(I.lot)}.`); }
    if (M.info.tap) { const q = M.info.tap, TN = { num: 'núm tròn', khe: 'khe tay nắm', khoet: 'tay nắm khoét', noi: 'tay nắm nổi' }; L.push(`Táp: ${[q.go ? `gờ chắn ${g(q.go)} (hồi + gờ sau nhô trên nóc)` : '', q.noc === 'phu' ? `nóc phủ hồi${q.dua ? `, đua ${g(q.dua)}` : ''}` : '', q.day === 'phu' ? 'đáy phủ hồi' : '', q.chan_go ? `chân gỗ ${g(q.chan_go)}` : '', TN[q.tay_nam]].filter(Boolean).join(', ')}.`); }
    if (M.info.than) L.push(`Thân: ${M.info.than.map(b => `${b.tu} cao ${g(b.z1 - b.z0)}`).join(' + ')}${s.phao.tren ? ` + phào trên ${g(s.phao.tren)}` : ''}.`);
    if (M.info.khoang) L.push(`Khoang lọt lòng: ${M.info.khoang.map(g).join(' / ')}.`);
    if (M.info.thung && M.info.thung.length > 1) L.push(`Thùng: ${M.info.thung.length} thùng rời — ${M.info.thung.map(q => `${g(q.rong)} (${q.khoang[1] - q.khoang[0] + 1} khoang)`).join(' + ')}, ghép cạnh nhau trong khung phào chung.`);
    if (M.info.canh && M.info.canh.so) L.push(`Cánh: ${M.info.canh.so} tấm, rộng ${M.info.canh.rong.map(g).join(' / ')}, cao ${M.info.canh.cao.map(g).join(' / ')}${M.info.canh.ban_le ? `, ${M.info.canh.ban_le} bản lề` : ''}.`);
    const matNK = a => [...new Set(a.map(q => `${g(q.w)}×${g(q.h)}`))].join(', ');
    const am = M.mat_ngan_keo.filter(q => !q.trum), tr = M.mat_ngan_keo.filter(q => q.trum);
    if (am.length || tr.length) {
      const dem = {}; for (const x of M.templates) if (x.loai === 'NGAN_KEO') dem[x.ten_loai] = (dem[x.ten_loai] || 0) + 1;
      L.push(`Ngăn kéo: ${[am.length ? `${am.length} ${M.info.tap ? 'lọt lòng' : 'âm'} (mặt ${matNK(am)})` : '', tr.length ? `${tr.length} trùm ngoài (mặt ${matNK(tr)})` : ''].filter(Boolean).join(', ')} — ${Object.keys(dem).map(k => `${k} ×${dem[k]}`).join(', ')}.`);
      const nXa = M.parts.filter(p => p.loai === 'XA' && !p.khung_mat).length, nKm = M.parts.filter(p => p.loai === 'XA' && p.khung_mat).length, nNep = M.parts.filter(p => p.loai === 'NEP').length;
      const nXaT = M.parts.filter(p => p.xa_tap).length;
      if (nXaT) L.push(`Táp: ${nXaT} xà đứng sau khe tay nắm (rãnh móc tay).`);
      if (nXa - nXaT || nKm || nNep) L.push(`Hộc ngăn kéo âm: ${[nKm ? `${nKm} thanh ngang khung mặt (phẳng mặt ngăn kéo)` : '', nXa - nXaT ? `${nXa - nXaT} xà sau khe mặt` : '', nNep ? `${nNep} nẹp che khe hai bên` : ''].filter(Boolean).join(', ')}.`);
    }
    L.push(`Tấm ván: ${cl.tong_sl} tấm — ${cl.theo_day.map(d => `ván ${g(d.day)}: ${d.sl} tấm, ${m2(d.m2)} m²`).join('; ')} (${Object.keys(cl.tong).map(k => `${k} ${cl.tong[k].sl}`).join(', ')}).`);
    return L;
  }

  /**
   * (bản 1.30.1 — anh Thanh 08/10/2026: "rất hay báo lỗi bị vượt khổ ván rất mệt"; viết lại 1.31.1) Khoang quá rộng so với khổ ván — thường gặp: chọn "Tủ có sẵn" rồi kéo rộng
   * (vd 4 cánh 2000 đặt rộng 2600 → khoang 1280, hậu 1290 > 1220). Tách đôi khoang TỰ CHIA rộng nhất có tấm vượt khổ VÌ BỀ NGANG (tấm của một khoang — không kể đáy / nóc / đế
   * liền thùng, hậu khấu cột), tối đa 12 lần; một lần tách có thể chưa giảm (cả dãy chia lại theo số cánh) nên đi tiếp và giữ phương án ít tấm vượt nhất. Dừng khi lần tách sinh
   * lỗi khác hoặc cảnh báo "hư" MỚI (khoang / cánh quá hẹp, treo trước hộp che cột — so theo nội dung + khoang gốc). Mỗi nửa giữ số cánh, đợt, nội dung ô (1 cánh: bản lề hai bên).
   * Khoang gõ số cố định không đụng. Hàm thuần.
   * @returns {{ spec, doi: string[], truoc: number, con: number, goi_y: string }} truoc / con = MỌI tấm vượt khổ (cả chiều cao) + lỗi "thanh ngang mặt trước" trước / sau khi chia;
   *   doi = dòng báo khi có chia (rỗng = không chia); goi_y = nhắc "Rộng tối đa một thùng" khi còn tấm liền thùng dài hơn khổ (hiện cả khi không chia được gì)
   */
  function vuaKhoVan(specIn) {
    const s0 = normalize(specIn);
    if (s0.loai_sp === 'giuong' || s0.loai_sp === 'vach' || s0.loai_sp === 'bep') { const M = build(s0), n = M.errors.filter(e => /khổ ván/.test(e)).length; return { spec: s0, doi: [], truoc: n, con: n, goi_y: '' }; }      // tủ bếp: một module theo cỡ phụ kiện — không tự chia khoang
    // (1.31.1) đếm MỌI tấm vượt khổ (cả theo chiều cao) + lỗi "thanh ngang mặt trước"; "gỡ được bằng vách" = tấm vượt vì bề ngang, thuộc MỘT khoang
    // (đáy / nóc / đế liền thùng của phủ hồi, hậu khấu cột không gỡ được bằng cách thêm vách)
    const dem = M => {
      const kd = M.spec.van.kho_dai, kr = M.spec.van.kho_rong;
      const vuot = M.parts.filter(p => { const c = cutSize(p); return c.dai > kd + TOL || c.rong > kr + TOL; });
      const thanh = M.errors.filter(e => /^Thanh ngang mặt trước dài/.test(e)).length;
      const go = vuot.filter(p => p.x1 - p.x0 > kr + TOL && !p.khau_cot && !p.van_thung && (p.den_khoang === undefined || p.den_khoang === p.khoang));
      const lien = vuot.filter(p => p.den_khoang !== undefined && p.den_khoang !== p.khoang && p.x1 - p.x0 > kd + TOL);
      return { tong: vuot.length + thanh, go, thanh, lien };
    };
    // chia mà làm hỏng chỗ khác thì không nhận: lỗi không phải khổ ván, hoặc cảnh báo "hư" (khoang / cánh quá hẹp, treo trước hộp che cột)
    // (1.31.1) so theo NỘI DUNG + KHOANG GỐC: `goc[j]` = khoang ban đầu mà khoang j hiện tại tách ra từ đó. Số khoang trong dòng báo đổi thành khoang gốc, mọi con số khác bỏ
    // (bề ngang, sâu… đổi theo mỗi lần chia). Cảnh báo sẵn có của khoang cũ lặp lại ở các nửa của chính nó (vd "hộp che cột chiếm 265 trong 824") không phải chỗ hỏng mới;
    // cùng loại cảnh báo mà ở khoang gốc KHÁC (vd khoang treo vốn đủ sâu nay lấn vào vùng cột) là hỏng mới. Trước: so số dòng / chỉ bỏ số khoang → từ chối oan / nhận nhầm.
    const RE_HU = /quá hẹp|Cánh chỉ rộng|khoang treo chỉ sâu|hộp che cột|không treo được/;
    const chu = n => (n === undefined ? '?' : String.fromCharCode(97 + (n % 26)) + (n >= 26 ? String.fromCharCode(97 + Math.floor(n / 26)) : ''));
    const khoa = (t, goc) => String(t).replace(/([Kk]hoang) (\d+)(?:\s*[–-]\s*(\d+))?/g, (m, k, a, b) => `khoang @${chu(goc[+a - 1])}${b ? '–@' + chu(goc[+b - 1]) : ''}`).replace(/\d+(?:[.,]\d+)?/g, '#');
    // "hộp che cột" là của CÂY CỘT (cố định), không của khoang: cả dãy chia lại theo số cánh thì cùng cây cột đó có thể nằm sau khoang khác → khoá theo các cột nằm sau khoang đó
    const cotSau = (M, n) => { const x0 = (M.info.x_khoang || [])[n - 1], w = (M.info.khoang || [])[n - 1]; if (!isFinite(x0) || !isFinite(w)) return null; const ds = (M.info.khau || []).filter(K => Math.min(typeof K.xb === 'number' ? K.xb : Infinity, x0 + w) - Math.max(typeof K.xa === 'number' ? K.xa : -Infinity, x0) > TOL).map(K => String(K.cot && isFinite(K.cot.x0) ? Math.round(K.cot.x0) : K.ben)); return ds.length ? ds : null; };      // cột góc: vùng khấu từ mép tủ (M.info.khau ghi xa / xb = null — isFinite(null) là true, đừng dùng)
    // (một khoá cho MỖI cột: khoang có 2 cột góc tách đôi thành 2 khoang mỗi khoang một cột vẫn là 2 chỗ che cũ)
    const khoaW = (M, w, goc) => { const m = /hộp che cột/.test(w) && /^Khoang (\d+):/.exec(w), c = m && cotSau(M, +m[1]); return c ? c.map(x => 'W|hộp che cột|' + x) : ['W|' + khoa(w, goc)]; };
    const hong = (M, goc) => new Set(M.errors.filter(e => !/khổ ván/.test(e)).map(e => 'E|' + khoa(e, goc)).concat(...M.warnings.filter(w => RE_HU.test(w)).map(w => khoaW(M, w, goc))));
    const M0 = build(s0), L0 = dem(M0), n0 = s0.khoang.length, goc0 = s0.khoang.map((k, j) => j), H0 = hong(M0, goc0);
    let goc = goc0;
    let tot = { s: s0, M: M0, L: L0 }, s = s0, M = M0, L = L0;
    for (let lan = 0; lan < 12 && (L.go.length || L.thanh); lan++) {
      const w = M.info.khoang || [], co = new Set(L.go.map(p => p.khoang)), chung = L.thanh > 0 || L.go.some(p => p.khoang === undefined);
      let i = -1;
      s.khoang.forEach((k, j) => { if (k.rong === 'auto' && (chung || co.has(j)) && w[j] > 2 * 150 + s.van.t && (i < 0 || w[j] > w[i])) i = j; });
      if (i < 0) break;
      const k = s.khoang[i], a = clone(k), b = clone(k);
      if (k.canh === 1) { a.ban_le = 'trai'; b.ban_le = 'phai'; }
      const c = clone(s); c.khoang.splice(i, 1, a, b);
      const s2 = normalize(c), M2 = build(s2), goc2 = goc.slice(); goc2.splice(i, 1, goc[i], goc[i]);
      const hu = [...hong(M2, goc2)].some(k => !H0.has(k));
      s = s2; M = M2; L = dem(M2); goc = goc2;
      // cả dãy khoang tự chia theo số cánh nên một lần tách có thể chưa giảm (mọi khoang co đều) — đi tiếp, giữ phương án ít tấm vượt nhất. Bước sinh hư mới cũng đi tiếp
      // (lần chia sau có khi gỡ được: cột lại rơi vào khoang cũ) nhưng không bao giờ nhận làm kết quả
      if (!hu && L.tong < tot.L.tong) tot = { s, M, L };
      if (!L.tong) break;
    }
    const doi = [], con = tot.L.tong;
    if (tot.s !== s0) {
      const n1 = tot.s.khoang.length, t0 = (M0.info.thung || []).length, t1 = (tot.M.info.thung || []).length;
      doi.push(`Đã chia lại ${n0} → ${n1} khoang cho vừa khổ ván ${g(s0.van.kho_dai)} × ${g(s0.van.kho_rong)}: lọt lòng ${[...new Set((tot.M.info.khoang || []).map(v => g(v)))].join(' / ')}${t1 !== t0 ? `; tủ ${t1 > t0 ? 'thành' : 'còn'} ${t1} thùng (chỗ tách là 2 hồi áp lưng)` : ''} — khoang mới giữ số cánh, đợt, ngăn kéo / suốt treo của khoang cũ.`);
    }
    const rm = tot.s.thung.rong_max;
    const goi_y = tot.L.lien.length ? `Còn ${tot.L.lien.length} tấm liền thùng (đáy / nóc / đế) dài hơn khổ ván — thêm vách không gỡ được: ${rm > 0 ? `giảm "Rộng tối đa một thùng" (đang ${g(rm)})` : `đặt "Rộng tối đa một thùng" (đang 0 = không tách) không quá ${g(s0.van.kho_dai)}`} ở Chuẩn xưởng → Thùng.` : '';
    return { spec: tot.s, doi, truoc: L0.tong, con, goi_y };
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
    if (isFinite(v) && v < soBan('1.29.2')) {
      // Bản 1.29.2 (anh Thanh 08/10/2026: "các phần hậu chỉ có 6,5 mm thôi, không có 6 hay 5"): hậu mỏng của xưởng là ván 6,5. Chỉ đổi khi số đang lưu đúng bằng mặc định cũ (phủ 6, soi rãnh 5) — người dùng gõ số khác thì giữ.
      const h = spec.hau && typeof spec.hau === 'object' ? spec.hau : null;
      if (h && h.kieu !== 'day' && h.t !== DEFAULT_SPEC.hau.t && ((h.kieu === 'mong' && h.t === 5) || ((h.kieu === 'phu' || h.kieu === undefined) && h.t === 6))) {
        spec.hau = Object.assign({}, h, { t: DEFAULT_SPEC.hau.t });
        doi.push(`Dày hậu đổi từ ${h.t} sang ${DEFAULT_SPEC.hau.t} (ván mỏng của xưởng chỉ có 6,5). Muốn đổi lại: Chuẩn xưởng → Hậu.`);
      }
    }
    if (isFinite(v) && v < soBan('1.30.0')) {
      // Bản 1.30: chén bản lề theo LOẠI bản lề (mặc định Kolity K53: sâu 12, tâm cách mép 21,5). Số chén bản cũ khác mặc định cũ (sâu 12,5, tâm 22,5, Ø35) = người dùng tự gõ → giữ, loại "Tự gõ số".
      const c = spec.canh && typeof spec.canh === 'object' ? spec.canh : null, ch = c && c.chen && typeof c.chen === 'object' ? c.chen : null;
      if (c && ch && c.loai_ban_le === undefined && ((ch.sau !== undefined && Number(ch.sau) !== 12.5) || (ch.tam_mep !== undefined && Number(ch.tam_mep) !== 22.5) || (ch.d !== undefined && Number(ch.d) !== 35))) {
        spec.canh = Object.assign({}, c, { loai_ban_le: 'tu_chon' });
        if (c.chen_ban_le) doi.push('Chén bản lề giữ số đã gõ (loại bản lề: Tự gõ số). Muốn theo bản lề Kolity K53 / Imundex: Chuẩn xưởng → Cánh → Loại bản lề.');
      } else if (c && c.chen_ban_le && c.loai_ban_le === undefined) doi.push(`Chén bản lề nay theo bản lề Kolity K53: sâu ${g(DEFAULT_SPEC.canh.chen.sau)}, tâm chén cách mép cánh ${g(DEFAULT_SPEC.canh.chen.tam_mep)} (bản cũ: 12,5 / 22,5). Đổi loại: Chuẩn xưởng → Cánh → Loại bản lề.`);
    }
    if (isFinite(v) && v < soBan('1.31.0')) {
      // Bản 1.31 (anh Thanh 08/10/2026): kết cấu chuẩn xưởng đổi sang nóc, đáy phủ hồi. Thông số bản cũ chưa có lựa chọn này → theo chuẩn mới, báo một dòng.
      const q = spec.thung && typeof spec.thung === 'object' ? spec.thung : null;
      if ((!q || q.noc_day === undefined) && DEFAULT_SPEC.thung.noc_day === 'phu_hoi') doi.push('Kết cấu thùng đổi sang nóc, đáy phủ hồi (hồi, vách kẹp giữa; có chân thì đáy nằm trên khung đế). Muốn cách cũ (hồi chạy xuống sàn, nóc đáy lọt từng khoang): Chuẩn xưởng → Thùng.');
      // hộc kéo âm có khung mặt (thanh ngang phẳng mặt) — chỉ báo khi tủ thật sự có ngăn kéo âm
      const nkq = spec.ngan_keo && typeof spec.ngan_keo === 'object' ? spec.ngan_keo : null;
      const coNkAm = Array.isArray(spec.khoang) && spec.khoang.some(k => k && ((Array.isArray(k.o) && k.o.some(c => c && c.kieu === 'nk_am')) || (k.ngan_keo && typeof k.ngan_keo === 'object' && +k.ngan_keo.so > 0)));      // cả dạng cũ khoang.ngan_keo {so, den}
      if (coNkAm && (!nkq || nkq.khung_mat === undefined) && DEFAULT_SPEC.ngan_keo.khung_mat) doi.push(`Hộc kéo âm đổi sang khung mặt: thanh ngang cao ${g(DEFAULT_SPEC.ngan_keo.ray)} phẳng mặt ngăn kéo (thanh trên sát đợt, thanh giữa các mặt), mặt ngăn kéo lọt trong ô. Muốn khe + xà ẩn như cũ: Chuẩn xưởng → Ngăn kéo âm → Khung mặt = 0.`);
    }
    if (isFinite(v) && v < soBan('1.17.1')) {
      // Trước 1.17.1 khe hở quanh cột (khấu cột) mặc định 10. Anh Jason 03/10/2026 23:58: "khe khấu cột để 1-2cm cho sau xử lý cho dễ" → 15. Chỉ đổi khi số đang lưu đúng bằng mặc định cũ.
      const k = spec.khau && typeof spec.khau === 'object' ? spec.khau : null;
      if (k && Number(k.ho) === 10) {
        spec.khau = Object.assign({}, k, { ho: DEFAULT_SPEC.khau.ho });
        if ((k.trai && k.trai.rong > 0) || (k.phai && k.phai.rong > 0) || (Array.isArray(k.giua) && k.giua.some(q => q && q.rong > 0))) doi.push(`Khe hở quanh cột (khấu cột) đã đổi sang mặc định mới: ${DEFAULT_SPEC.khau.ho} (bản cũ: 10) — để lúc lắp còn chỗ xử lý. Muốn số khác (10–20): thẻ Tủ → Khấu cột → Khe hở quanh cột.`);
      }
    }
    if (isFinite(v) && v < soBan('1.33.1')) danhDauChuanCu(spec);
    if (isFinite(v) && v < soBan('1.36.2')) {
      // Bản 1.36.2 (anh Thanh 15/10/2026): thanh ngang giữa hai mặt trùm khe tay nắm của táp lùi DEFAULT_TAP.lui_thanh thành rãnh móc tay. File / mẫu cũ chưa
      // có khoá → theo chuẩn mới (normTap điền mặc định), báo một dòng — chỉ khi táp thật sự có thanh đó (tay nắm khe, có thanh). Tủ ĐÃ VẼ đi specDaVe (giữ 0).
      const q = spec.tap && typeof spec.tap === 'object' ? spec.tap : null;
      // (1.36.2) hậu táp soi rãnh lọt lòng: chỉ báo khi Chuẩn xưởng của file không phải soi rãnh (soi rãnh sẵn thì hậu không đổi chỗ)
      if (q && q.hau_ranh === undefined && !(spec.hau && spec.hau.kieu === 'mong')) doi.push('Táp: hậu nay soi rãnh lọt lòng (nằm gọn trong rãnh hồi / nóc / đáy, không lộ cạnh) — bản cũ theo Chuẩn xưởng hậu của tủ áo.');
      // (1.36.3) file < 1.36.2 cũng chưa có xa_dung → MỘT dòng nói cả hai (lùi + xà đứng), dòng riêng của 1.36.3 bên dưới bỏ qua
      if (q && q.lui_thanh === undefined && q.tay_nam === 'khe' && num(q.thanh, 1)) doi.push(`Táp khe tay nắm: thanh ngang giữa hai mặt ngăn kéo nay ${q.xa_dung === undefined && DEFAULT_TAP.xa_dung ? `là xà đứng cao ${g(TAP_XA)} ` : ''}lùi ${g(DEFAULT_TAP.lui_thanh)} sau lưng mặt — thành rãnh móc tay (bản cũ: ${q.xa_dung === undefined ? 'thanh nằm ' : ''}phẳng sau lưng mặt).`);
    }
    if (isFinite(v) && v >= soBan('1.36.2') && v < soBan('1.36.3')) {
      // Bản 1.36.3 (anh Thanh 16/10/2026): thanh nằm sau khe tay nắm của táp → xà đứng cao TAP_XA. File / mẫu 1.36.2 theo chuẩn mới, báo một dòng (tủ ĐÃ VẼ: specDaVe giữ 0)
      const q = spec.tap && typeof spec.tap === 'object' ? spec.tap : null;
      if (q && q.xa_dung === undefined && q.tay_nam === 'khe' && num(q.thanh, 1) && DEFAULT_TAP.xa_dung) doi.push(`Táp khe tay nắm: thanh nằm giữa hai mặt ngăn kéo nay là xà đứng cao ${g(TAP_XA)} sau rãnh móc tay — nhìn qua khe chỉ thấy mặt xà, không thấy cạnh thanh / khe sáng.`);
    }
    if (isFinite(v) && v < soBan('1.36.4') && !spec.loai_sp && !(spec.than && typeof spec.than === 'object' && spec.than.cao_duoi !== undefined)) {
      // (soát 1.36.4) mặc định thân dưới đổi 2200 → 2150. Thông số bản cũ THIẾU khoá (tệp viết tay; bảng luôn lưu đủ) lúc đó dựng với 2200 — normalize gộp số
      // mới thì tủ đổi lặng lẽ (2250: gộp thân thêm cảnh báo, 2400: thân trên 150 → 200). Ghi lại số cũ, không báo: tủ vẫn y như ở bản đã lưu.
      // Táp / giường / vách / bếp: thân do mẫu / normBep tự đặt — không đụng.
      spec.than = Object.assign({}, spec.than && typeof spec.than === 'object' ? spec.than : {}, { cao_duoi: 2200 });
    }
    if (isFinite(v) && v < soBan('1.36.4') && !spec.loai_sp && !Array.isArray(spec.khoang)) {
      // (soát 1.36.4, lần 2) cùng lý do: thiếu khoá khoang thì normalize gộp ruột mặc định MỚI (1130 / 595 / 1130) lên thân dưới 2200 vừa ghi ở trên → tủ lai,
      // đổi lặng lẽ. Ghi lại ruột tủ mặc định ngay trước 1.36.4 (treo dài · ngăn kéo + treo · 5 đợt đều) — tủ mở ra y như ở bản đã lưu.
      spec.khoang = JSON.parse(JSON.stringify(KHOANG_MAC_DINH_CU));
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
    // (1.31.1) tủ vẽ ở bản < 1.31: hộc kéo âm là khe + xà ẩn (chưa có khung mặt) — dựng lại đúng như lúc vẽ thì mới dò lại được, không báo oan "thiếu tấm"
    // Chỉ khi tủ có ngăn kéo âm: bảng chỉ có MỘT thông số (Chuẩn xưởng nằm trong đó) — tủ không ngăn kéo mà ghi 0 thì mọi tủ vẽ sau khi sửa nó mất khung mặt vô cớ
    const coNkAm = Array.isArray(o.khoang) && o.khoang.some(k => k && ((Array.isArray(k.o) && k.o.some(c => c && c.kieu === 'nk_am')) || (k.ngan_keo && typeof k.ngan_keo === 'object' && +k.ngan_keo.so > 0)));
    if (!(isFinite(v) && v >= soBan('1.31.0')) && coNkAm) { o.ngan_keo = o.ngan_keo && typeof o.ngan_keo === 'object' ? o.ngan_keo : {}; if (o.ngan_keo.khung_mat === undefined) o.ngan_keo.khung_mat = 0; }
    // (soát 1.36.2) táp vẽ ở 1.34.1 … 1.36.1: thanh ngang giữa khe tay nắm phẳng sau lưng mặt (y 0) — thông số chưa có lui_thanh. Không ghi 0 thì normTap
    // điền mặc định 30 → dựng lại lệch đúng tấm thanh: Sửa báo oan "thiếu 1 tấm" (chọn chính thanh thì không dò lại được tủ), Cập nhật dời thanh lặng lẽ.
    if (!(isFinite(v) && v >= soBan('1.36.2')) && o.tap && typeof o.tap === 'object' && o.tap.lui_thanh === undefined) o.tap.lui_thanh = 0;
    // (1.36.2) cũng vậy với hậu: táp vẽ trước 1.36.2 theo Chuẩn xưởng (thường là hậu phủ) — không ghi 0 thì dựng lại ra hậu soi rãnh: hậu khác chỗ, hồi / nóc /
    // đáy sâu khác → Sửa không dò lại được tủ, Cập nhật đổi hậu lặng lẽ.
    if (!(isFinite(v) && v >= soBan('1.36.2')) && o.tap && typeof o.tap === 'object' && o.tap.hau_ranh === undefined) o.tap.hau_ranh = 0;
    // (1.36.3) táp vẽ trước 1.36.3: giữa hai mặt trùm khe tay nắm là thanh NẰM (không phải xà đứng) — ghi 0 để dựng lại đúng tấm như lúc vẽ
    if (!(isFinite(v) && v >= soBan('1.36.3')) && o.tap && typeof o.tap === 'object' && o.tap.xa_dung === undefined) o.tap.xa_dung = 0;
    if (isFinite(v) && v < soBan('1.33.1')) danhDauChuanCu(o);      // (bản vá 1.33.1) tủ bếp vẽ ở 1.33.0: số của tủ giữ nguyên, chỉ đánh dấu chuẩn cũ (không truyền sang mẫu sau)
    return o;
  }

  /* ------------------------------------------------------------------ *
   * GIƯỜNG, VÁCH ĐẦU GIƯỜNG, TÁP (bản 1.32 — anh Thanh 09/10/2026: "làm cho tôi giường + táp đầu giường + vách đầu giường … kiểu thư viện cho ra sản xuất,
   * sửa module của Chenfeng nếu ok thì lấy, không thì vẽ đúng theo kết cấu của VN"; "giường thì có giường bình thường, giường bay, giường có ngăn kéo";
   * "nhớ phải vẽ chuẩn Chenfeng, còn sửa đổi").
   * Cùng hợp đồng M với tủ (parts / templates / errors / kq / info) → nhập tấm, gom MODULE L / W / H (sửa được ở ô Thông số của Chenfeng), "Sửa tủ đang chọn",
   * bảng kê, xuất ván, đổ màu, dò lỗi đều dùng chung. Trục chung với tủ: x = ngang (rong = phủ bì), y = sâu (giường: y = 0 ở ĐUÔI, đầu giường sát tường ở
   * y = sau_thung; vách: mặt tấm ốp ở y = 0, tường ở y = sau_thung), z = cao (cao = đỉnh đầu giường / đỉnh vách). Táp đầu giường = tủ thường (loai_sp 'tap'
   * đi bộ dựng tủ, vẽ được bằng lệnh gốc). Giường / vách: chưa có lệnh gốc → nhập tấm (ve_goc = false).
   * Kết cấu (số tra từ các xưởng gỗ công nghiệp VN — xem README): hông / đuôi giường ghép 2 lớp ván, cao 300; đầu giường chạy suốt bề ngang sát tường;
   * hông kẹp giữa đầu và đuôi, bắt BÁT GIƯỜNG (tháo lắp, không khoan cam); bên trong là vách ngăn gầm (thang) đứng trên sàn + đà giữa ghép 2 lớp đỡ
   * mối nối phản; phản ván thùng chia 2 tấm theo bề ngang, mặt phản lún dưới mặt hông. Giường bay: thân giường đặt trên khung đế lùi vào trong (hắt LED gầm),
   * đầu giường vẫn xuống sàn. Giường ngăn kéo: hai bên hông là thanh hông trên + mặt ngăn kéo, hộp ngăn kéo dựng bằng tấm chạy ray bi giữa các vách ngăn gầm.
   * Vách đầu giường: tấm ốp chia ô (khe 5 cho nẹp U inox) bắn keo + vít lên khung xương ván (dọc ở mép, ở mỗi mối nối ô, cách ≤ 600; ngang trên / dưới / giữa).
   * ------------------------------------------------------------------ */
  const LOAI_SP = ['tu', 'tap', 'giuong', 'vach', 'bep'];
  const TEN_SP = { tu: 'Tủ áo', tap: 'Táp đầu giường', giuong: 'Giường', vach: 'Vách đầu giường', bep: 'Tủ bếp' };
  const KIEU_GIUONG = [['thuong', 'Giường thường'], ['bay', 'Giường bay (đế lùi, LED gầm)'], ['nk', 'Giường có ngăn kéo']];
  // lop = số lớp ván ghép của hông / đuôi; lop_dau = của đầu giường; cao_thanh = mặt trên hông tính từ sàn; lun = mặt phản thấp hơn mặt hông; ho_nem = khe lòng giường mỗi bên so với nệm;
  // so_thang = số vách ngăn gầm (0 = tự: cách ≤ 600; ít nhất 2 — vách ở đầu và ở đuôi); dam_giua = đà giữa (−1 = tự: lòng rộng > 1000 hoặc có ngăn kéo); cao_de / lui_de = đế giường bay; nk_* = ngăn kéo hai bên hông
  const DEFAULT_GIUONG = { kieu: 'thuong', lop: 2, lop_dau: 1, cao_thanh: 300, lun: 40, ho_nem: 10, so_thang: 0, dam_giua: -1, cao_de: 120, lui_de: 150, nk_ben: 'hai', nk_so: 2, nk_sau: 500, nk_khe: 3, nk_ray: 13, thanh_hong: 80 };
  const DEFAULT_VACH = { cach_san: 0, so_o: 0, so_hang: 0, so_ngang: 0, so_doc: 0, so_doc_mep: 0, khe: 5, xuong_rong: 80, xuong_cach: 600, day_op: 0 };
  const loaiSP = s => (s && LOAI_SP.indexOf(s.loai_sp) > 0 ? s.loai_sp : 'tu');
  /* (bản 1.34.1 — anh Thanh 14/10/2026: "các mẫu tab đầu giường như này mà, mẫu của em xấu quá, cập nhật lại" + 5 ảnh mẫu) KẾT CẤU RIÊNG CỦA TÁP — khoá s.tap, chỉ táp có
   * (táp lưu trước 1.34.1 không có khoá này → dựng như 1.32). Số mặc định tra theo táp gỗ công nghiệp bán ở VN, CHƯA ĐO ở xưởng [CĐ]:
   *   go        gờ chắn: hồi ngoài + GỜ SAU (ván thùng) nhô trên mặt nóc bao nhiêu (nóc thụt xuống); 0 = không gờ. Chỉ với nóc lọt.
   *   bo        bán kính bo góc trên phía trước của hồi khi có gờ (ghi gia công + từ 1.36.2 đường bao cong thật `bo_r` — hướng trục của đường bao trên Chenfeng thật CHƯA ĐO)
   *   noc / day 'phu' = nóc / đáy PHỦ hồi (liền, hồi đứng giữa); 'lot' = lọt giữa hai hồi như tủ. dua / dua_truoc = nóc phủ đua ra ngoài hồi hai bên / phía trước (−1 = bằng dày mặt cánh)
   *   chan_go   chân gỗ rời mua sẵn (4 cái, kê phụ kiện): cả thân nâng lên đúng cao chân, không xà đế; 0 = không
   *   lui_chan  xà đế (thân có chân, không chân gỗ) lùi vào giữa hai hồi — hồi xuống sàn
   *   thanh / thanh_sau  thanh ngang NẰM giữa các ngăn kéo lọt lòng (ván thùng, phẳng mặt, sâu thanh_sau); 0 = chỉ khe
   *   tay_nam   'num' núm tròn (kê phụ kiện) | 'khe' khe tay nắm giữa các mặt trùm, rộng khe_tn (kiểu J) | 'khoet' tay nắm khoét chữ U mép trên mặt (gia công CNC) | 'noi' khách chọn, không kê
   *   lui_thanh (1.36.2) thanh ngang giữa hai mặt TRÙM khe tay nắm lùi vào sau lưng mặt ngăn kéo bao nhiêu — thành rãnh móc tay như hộc kéo tủ áo
   *             (anh Thanh 15/10/2026: "chỗ này phải có khe móc như trong tủ áo chứ ai để lòi ra vậy"); thanh vẫn sâu đủ thanh_sau trong lòng thùng
   *   hau_ranh  (1.36.2) 1 = hậu mỏng SOI RÃNH lọt lòng (rãnh trên hồi / vách / nóc / đáy, lùi hau.lui) bất kể Chuẩn xưởng hậu; 0 = theo Chuẩn xưởng
   *             (anh Thanh 15/10/2026, ảnh Chenfeng: hậu phủ lên tới đỉnh gờ, thấy cạnh hậu lòi lên trên và ở hông — "tấm hậu này lòi lên hơi xấu")
   *   xa_dung   (1.36.3) 1 = giữa hai mặt TRÙM khe tay nắm là XÀ ĐỨNG cao TAP_XA (ván đứng, mặt quay ra khe) ở y lui_thanh; 0 = thanh NẰM sâu thanh_sau (1.34.1 … 1.36.2)
   *             (anh Thanh 16/10/2026: "ke này hở xấu quá phải có xà 5cm bên trong chứ ai làm xà nằm ngang phải làm xà dọc") */
  const DEFAULT_TAP = { go: 0, bo: 0, noc: 'lot', dua: 0, dua_truoc: 0, day: 'lot', chan_go: 0, lui_chan: 30, thanh: 1, thanh_sau: 80, lui_thanh: 30, tay_nam: 'num', khe_tn: 25, hau_ranh: 1, xa_dung: 1 };
  // (1.36.3) cao xà đứng sau khe tay nắm của táp (anh Thanh 16/10/2026: "phải có xà 5cm bên trong") [CĐ] — rút thấp hơn khi hộp ngăn kéo không chừa đủ chỗ
  const TAP_XA = 50;
  // (soát 1.36.3) khe tay nắm rộng hơn TAP_XA − 2 × số này: xà cao = khe + 2 × TAP_XA_CHONG (chồng lên mép mỗi mặt) để vẫn che kín khe [CĐ]
  const TAP_XA_CHONG = 10;
  /** Hậu thật của một thông số ĐÃ chuẩn hoá: táp kiểu mới (s.tap, hau_ranh) = soi rãnh, dày hậu mỏng của Chuẩn xưởng (Chuẩn xưởng đang là hậu dày lọt lòng thì
   *  hau.t = dày ván thùng → dùng ván mỏng mặc định); còn lại theo Chuẩn xưởng. `lui` / `ranh_sau` / `ranh_ho` luôn có trong s.hau (normalize điền). */
  function hauCua(s) {
    // (soát 1.36.2) táp có cột KHAI (khấu cột): khấu cột hiện chỉ dựng với hậu PHỦ (hậu khấu đứng trước cột, hậu phủ chạy tới mép vùng cột) — ép soi rãnh thì mọi táp
    // có cột báo "chỉ làm với hậu phủ (Chuẩn xưởng → Hậu)" mà táp lại bỏ qua Chuẩn xưởng hậu → không lối ra. Táp có cột thì hậu theo Chuẩn xưởng (như trước 1.36.2).
    if (s.loai_sp === 'tap' && s.tap && s.tap.hau_ranh && !coCotKhai(s)) return { kieu: 'mong', t: s.hau.kieu === 'day' ? DEFAULT_SPEC.hau.t : s.hau.t, tap: true };
    return { kieu: s.hau.kieu, t: s.hau.t, tap: false, tap_cot: s.loai_sp === 'tap' && !!(s.tap && s.tap.hau_ranh) };
  }
  function coCotKhai(s) {
    const k = s.khau, co = q => !!(q && q.rong > 0 && q.sau > 0);
    return !!k && (co(k.trai) || co(k.phai) || (Array.isArray(k.giua) && k.giua.some(co)));
  }
  /** (soát 1.36.2) Các khoá của táp mà specDaVe ghi 0 cho tủ vẽ ở bản `ban` (thông số lúc vẽ thiếu khoá) — bảng báo một dòng + trả về chuẩn mới khi thôi nối. */
  // khoá → bản đầu tiên có khoá đó (số so như soBan); thông số vẽ ở bản trước đó mà thiếu khoá thì specDaVe ghi 0
  const TAP_KHOA_MOI = { hau_ranh: 1036002, lui_thanh: 1036002, xa_dung: 1036003 }, TAP_KHOA_1362 = Object.keys(TAP_KHOA_MOI);
  function tapKhoaCu(spec, ban) {
    const m = /^(\d+)\.(\d+)(?:\.(\d+))?/.exec(String(ban === undefined || ban === null ? '' : ban)), v = m ? (+m[1]) * 1e6 + (+m[2]) * 1e3 + (+(m[3] || 0)) : NaN;
    const q = spec && spec.tap && typeof spec.tap === 'object' ? spec.tap : null;
    return q ? TAP_KHOA_1362.filter(k => !(isFinite(v) && v >= TAP_KHOA_MOI[k]) && q[k] === undefined) : [];
  }
  /** (soát 1.36.3) Trong các khoá `khoa` (của tapKhoaCu), khoá nào thật sự ĐỔI HÌNH của táp này — để câu báo của Sửa / Thôi sửa không nói oan:
   *  lui_thanh / xa_dung chỉ có nghĩa với tay nắm khe + thanh (táp núm / khoét không có thanh nào sau khe); hau_ranh không có nghĩa khi táp có cột khai
   *  (hậu theo Chuẩn xưởng — hauCua). Việc trả khoá về chuẩn mới (tapVeChuan) vẫn làm với MỌI khoá: bảng chỉ có một thông số, số 0 không được dính sang táp vẽ sau. */
  function tapKhoaAnh(spec, khoa) {
    const q = spec && spec.tap && typeof spec.tap === 'object' ? spec.tap : null;
    if (!q) return [];
    const khe = q.tay_nam === 'khe' && num(q.thanh, DEFAULT_TAP.thanh) > 0;
    return (khoa || []).filter(k => k === 'hau_ranh' ? !coCotKhai(spec) : (k === 'lui_thanh' || k === 'xa_dung') ? khe : true);
  }
  /** Trả các khoá `khoa` của s.tap về chuẩn mới (DEFAULT_TAP) — chỉ khoá còn là 0 (số người dùng / file đã đổi thì giữ). Sửa tại chỗ, trả các khoá đã đổi. */
  function tapVeChuan(s, khoa) {
    const q = s && s.tap && typeof s.tap === 'object' ? s.tap : null;
    if (!q) return [];
    return (khoa || []).filter(k => TAP_KHOA_1362.indexOf(k) >= 0 && q[k] === 0 && (q[k] = DEFAULT_TAP[k], true));
  }
  /** Thông số thử cho Sửa khi máy không có thông số lưu (bảng đang mở file táp cũ, đã theo chuẩn mới): bản sao với từng tổ hợp khoá mới đặt về 0 — tấm trên bản vẽ
   *  có thể dựng theo kiểu trước 1.36.2. Thử lần lượt (ít khoá trước). Không phải táp kiểu mới → []. */
  function tapBienTheCu(s) {
    const q = s && s.loai_sp === 'tap' && s.tap && typeof s.tap === 'object' ? s.tap : null;
    if (!q) return [];
    const co = TAP_KHOA_1362.filter(k => q[k]), out = [];
    for (let m = 1; m < (1 << co.length); m++) { const khoa = co.filter((k, i) => m & (1 << i)), x = clone(s); for (const k of khoa) x.tap[k] = 0; out.push({ khoa, spec: x }); }
    return out.sort((a, b) => a.khoa.length - b.khoa.length);
  }
  // (soát 1.36.2) trần của lui_thanh: rãnh móc tay chỉ cần chỗ cho đầu ngón (~30); số lạ từ file / thông số hỏng (1e9) không được đẩy thanh ra sát hậu
  // thành "rãnh" sâu cả lòng thùng mà không ai báo. 60 = gấp đôi mặc định, vẫn để thanh sâu đủ thanh_sau trong táp nông nhất của KIEU_TAP.
  const LUI_THANH_MAX = 60;
  const TAY_NAM_TAP = { num: 'núm tròn', khe: 'khe tay nắm (J)', khoet: 'tay nắm khoét chữ U (CNC)', noi: 'tay nắm nổi (khách chọn)' };
  const TAP_KHOET = [150, 25];      // tay nắm khoét chữ U: dài × sâu [CĐ]
  function normTap(s) {
    const q = s.tap = Object.assign({}, DEFAULT_TAP, s.tap && typeof s.tap === 'object' ? s.tap : {});
    for (const k of ['go', 'bo', 'dua', 'chan_go', 'lui_chan', 'thanh_sau', 'lui_thanh', 'khe_tn']) q[k] = Math.max(0, num(q[k], DEFAULT_TAP[k]));
    q.lui_thanh = Math.min(LUI_THANH_MAX, q.lui_thanh);
    { const d = num(q.dua_truoc, 0); q.dua_truoc = d < 0 ? -1 : d; }      // −1 = bằng dày mặt cánh (nóc phẳng mặt ngăn kéo trùm)
    q.noc = q.noc === 'phu' ? 'phu' : 'lot'; q.day = q.day === 'phu' ? 'phu' : 'lot';
    q.thanh = num(q.thanh, 1) ? 1 : 0;
    q.hau_ranh = num(q.hau_ranh, 1) ? 1 : 0;
    q.xa_dung = num(q.xa_dung, 1) ? 1 : 0;
    q.tay_nam = TAY_NAM_TAP[q.tay_nam] ? q.tay_nam : DEFAULT_TAP.tay_nam;
    if (q.noc === 'phu') q.go = 0; else { q.dua = 0; q.dua_truoc = 0; }      // gờ cần nóc thụt; nóc lọt không đua
    q.bo = q.go > 0 ? Math.min(q.bo, q.go) : 0;
    if (!(q.khe_tn >= 10)) q.khe_tn = DEFAULT_TAP.khe_tn;
    if (q.chan_go > 0 || q.day === 'phu') s.chan = Object.assign({}, s.chan, { cao: 0 });      // chân gỗ / đáy phủ: không xà đế
    if (!(typeof q.kieu === 'string' && /^[A-E]$/.test(q.kieu))) { delete q.kieu; delete q.tu_dong; }      // (1.34.1) kiểu A … E + dấu ruột tự chia (tapTuDong)
    else if (typeof q.tu_dong !== 'string') delete q.tu_dong;
    return q;
  }
  /** Phủ bì giường theo cỡ nệm (rộng × dài) + kết cấu đang chọn: rong = nệm + 2 khe + 2 hông; sau_thung = nệm + 2 khe + đuôi + đầu. */
  function phuBiGiuong(spec, nemR, nemD) {
    const s = normalize(Object.assign(clone(spec || {}), { loai_sp: 'giuong' })), q = s.giuong, t = s.van.t;
    return { rong: rn(num(nemR, 1600) + 2 * q.ho_nem + 2 * q.lop * t), sau_thung: rn(num(nemD, 2000) + 2 * q.ho_nem + q.lop * t + q.lop_dau * t) };
  }
  function normGiuong(s) {
    const q = s.giuong = Object.assign({}, DEFAULT_GIUONG, s.giuong && typeof s.giuong === 'object' ? s.giuong : {});
    q.kieu = KIEU_GIUONG.some(k => k[0] === q.kieu) ? q.kieu : DEFAULT_GIUONG.kieu;
    q.lop = num(q.lop, 2) >= 2 ? 2 : 1; q.lop_dau = num(q.lop_dau, 1) >= 2 ? 2 : 1;
    for (const k of ['cao_thanh', 'lun', 'ho_nem', 'cao_de', 'lui_de', 'nk_sau', 'nk_khe', 'nk_ray', 'thanh_hong']) q[k] = Math.max(0, num(q[k], DEFAULT_GIUONG[k]));
    { const n = Math.round(num(q.so_thang, 0)); q.so_thang = n <= 0 ? 0 : Math.max(2, Math.min(12, n)); }      // 1 vách thì không chia được nhịp (chia cho 0)
    { const d = num(q.dam_giua, -1); q.dam_giua = d < 0 ? -1 : d ? 1 : 0; }
    q.nk_ben = ['hai', 'trai', 'phai'].indexOf(q.nk_ben) >= 0 ? q.nk_ben : 'hai';
    q.nk_so = Math.max(1, Math.min(4, Math.round(num(q.nk_so, 2))));
    s.khau = khongKhauSP(s);
    return q;
  }
  function normVach(s) {
    const q = s.vach = Object.assign({}, DEFAULT_VACH, s.vach && typeof s.vach === 'object' ? s.vach : {});
    for (const k of Object.keys(DEFAULT_VACH)) q[k] = Math.max(0, num(q[k], DEFAULT_VACH[k]));
    q.so_o = Math.min(20, Math.round(q.so_o)); q.so_hang = Math.min(6, Math.round(q.so_hang));
    if (!(q.xuong_rong > s.van.t)) q.xuong_rong = DEFAULT_VACH.xuong_rong;
    if (!(q.xuong_cach >= 200)) q.xuong_cach = DEFAULT_VACH.xuong_cach;
    q.cach_san = 0;      // vách đứng từ sàn (đặt bằng chuột / theo khung neo góc dưới của hộp bao — cách sàn chưa đặt đúng được)
    q.so_hang = Math.min(6, Math.round(q.so_hang)); for (const k of ['so_ngang', 'so_doc', 'so_doc_mep']) q[k] = Math.min(40, Math.round(q[k]));
    s.sau_thung = rn((q.day_op || s.van.t) + s.van.t);      // tấm ốp + xương: không phải số người dùng gõ
    s.khau = khongKhauSP(s);
    return q;
  }
  // giường / vách không khấu cột (khấu của tủ trước còn trong thông số thì heSo khoá Rộng oan); giữ khe hở cột của người dùng
  const khongKhauSP = s => ({ trai: { rong: 0, sau: 0 }, phai: { rong: 0, sau: 0 }, giua: [], ho: s.khau && s.khau.ho >= 0 ? s.khau.ho : DEFAULT_SPEC.khau.ho });
  /** Số hàng ô + số tầng xương ngang tự chia của vách theo kích thước đang có. Bảng GHI SẴN hai số này vào thông số mỗi lần dựng ở bảng (như so_thang của giường):
   *  module trong Chenfeng co giãn Cao không làm nhảy số tấm; về lại bảng thì chia lại theo cỡ mới. */
  // tâm các xương dọc "bắt buộc": 2 mép + dưới mỗi khe chia ô
  function cotVach(W, so, q) { const pw = (W - (so - 1) * q.khe) / so, c = [q.xuong_rong / 2]; for (let i = 1; i < so; i++) c.push(rn(i * (pw + q.khe) - q.khe / 2)); c.push(rn(W - q.xuong_rong / 2)); return c; }
  // số đoạn chia một khoảng `dai` giữa hai tâm xương cho cách ≤ xuong_cach, chừa thêm `du` (module kéo dài ra trong Chenfeng vẫn đủ xương); mỗi đoạn ≥ bản xương + 10 (xương không chồng nhau)
  const chiaXuong = (dai, du, q) => Math.max(1, Math.min(Math.ceil((dai + du) / q.xuong_cach), Math.floor(dai / (q.xuong_rong + 10))));
  const DU_VACH = 240;      // kéo module vách to thêm tới 240 (Rộng / Cao) trong Chenfeng mà xương vẫn cách ≤ xuong_cach
  function vachTuDong(spec) {
    const s = normalize(Object.assign(clone(spec || {}), { loai_sp: 'vach' })), q = s.vach, Hh = s.cao - q.cach_san;
    const hang = Math.max(1, Math.ceil(Hh / s.van.kho_dai)), ph = (Hh - (hang - 1) * q.khe) / hang, so = q.so_o || Math.max(1, Math.ceil(s.rong / 800));
    const cot = cotVach(s.rong, so, q), khe = cot.slice(1).map((c, i) => c - cot[i]), mep = [khe[0], khe[khe.length - 1]], giua = khe.slice(1, -1);
    return { so_hang: hang, so_ngang: chiaXuong(ph - q.xuong_rong, DU_VACH / hang, q), so_doc_mep: chiaXuong(Math.max(...mep), DU_VACH / so, q), so_doc: giua.length ? chiaXuong(Math.max(...giua), DU_VACH / so, q) : 0 };
  }
  /** Thông số táp / giường / vách → tủ áo: bỏ loại sản phẩm, trả phào trái / phải / trên, cao chân, sâu thùng, khấu cột, mã / tên về mặc định của tủ;
   *  Chuẩn xưởng (phụ trợ phào, cách nối phào, khe hở cột, cách vẽ, ván…) giữ nguyên. */
  function veTuAo(spec) {
    const k = clone(spec || {});
    if (!k.loai_sp) return normalize(k);
    // (bản 1.33) tủ bếp ép một thân, cao theo mặt đá (830) — về tủ áo thì cao + chia thân về mặc định của tủ (tủ áo 830 không ai dùng)
    if (k.loai_sp === 'bep') { k.cao = DEFAULT_SPEC.cao; k.than = Object.assign({}, k.than, { cao_duoi: DEFAULT_SPEC.than.cao_duoi }); }
    delete k.loai_sp; delete k.giuong; delete k.vach; delete k.bep; delete k.tap;
    k.phao = Object.assign({}, k.phao, { trai: DEFAULT_SPEC.phao.trai, phai: DEFAULT_SPEC.phao.phai, tren: DEFAULT_SPEC.phao.tren });
    k.chan = Object.assign({}, k.chan, { cao: DEFAULT_SPEC.chan.cao });
    k.sau_thung = DEFAULT_SPEC.sau_thung; k.ma = DEFAULT_SPEC.ma; k.ten = DEFAULT_SPEC.ten;
    k.khau = khongKhauSP(k);
    return normalize(k);
  }
  const MUC_KIEM_GIUONG = [
    { ma: 'kich_thuoc', ten: 'Phủ bì, lòng giường so với nệm' },
    { ma: 'kho_van', ten: 'Từng tấm vừa khổ ván' },
    { ma: 'va_cham', ten: 'Các tấm không đè lên nhau' },
    { ma: 'lien_ket', ten: 'Tấm nào cũng có chỗ tì (không lơ lửng)' },
    { ma: 'nhip', ten: 'Nhịp phản (khoảng cách vách ngăn gầm, đà giữa)' },
    { ma: 'de', ten: 'Đế giường bay', khi: M => M.spec.giuong.kieu === 'bay' },
    { ma: 'ngan_keo', ten: 'Ngăn kéo hai bên hông', khi: M => M.spec.giuong.kieu === 'nk' },
    { ma: 'phu_kien', ten: 'Liên kết, phụ kiện' },
  ];
  const MUC_KIEM_VACH = [
    { ma: 'kich_thuoc', ten: 'Phủ bì, chia ô' },
    { ma: 'kho_van', ten: 'Từng tấm vừa khổ ván' },
    { ma: 'va_cham', ten: 'Các tấm không đè lên nhau' },
    { ma: 'lien_ket', ten: 'Tấm ốp nào cũng nằm trên xương' },
    { ma: 'xuong', ten: 'Khung xương (khoảng cách, mối nối trên xương)' },
  ];
  /** Khung M chung cho sản phẩm không phải tủ + hàm thêm tấm (như P của tủ: làm tròn toạ độ, t theo kiểu tấm). */
  function moiM(s, loai, muc) {
    const M = { version: VERSION, spec: s, parts: [], templates: [], mat_ngan_keo: [], errors: [], warnings: [], notes: [], kq: [], info: { loai_sp: loai }, muc_kiem: muc, phu_kien: [], tom_tat: [] };
    const P = o => {
      const p = Object.assign({ tu: s.ma, than: 'D', khoan: KHONG_KHOAN, big: 1, lines: 0, open: 0, holes: [] }, o);
      if (p.fd === undefined) p.fd = p.bd = p.khoan !== KHONG_KHOAN;      // tấm bắt vít / bát / ke: mặt cũng không nhận lỗ cam
      if (p.giau_lo) { p.fd = false; p.bd = true; }      // (1.36.4) tấm lộ mặt trước: lỗ cam vào mặt trong (xem GIAU_LO trong build)
      for (const k of ['x0', 'x1', 'y0', 'y1', 'z0', 'z1']) p[k] = rn(p[k]);
      p.t = rn(p.type === 1 ? p.x1 - p.x0 : p.type === 0 ? p.z1 - p.z0 : p.y1 - p.y0);
      // vân (Lines 1 = vân theo bề w của Chenfeng, nằm dọc chiều dài khổ ván): tấm giường / xương — vân theo cạnh DÀI (không đổi khi module kéo qua mốc khổ 1220);
      // tấm ốp vách — vân đứng, chỉ nằm ngang khi ô rộng hơn khổ (heSo khoá kích thước nào làm đổi vân)
      if (o.lines === undefined) { const [w, h] = localSize(p), K = s.van.kho_rong + TOL; p.lines = (p.loai === 'OP' ? w > K : w > h) && h <= K ? 1 : 0; }
      M.parts.push(p); return p;
    };
    return { M, P, bao: baoCua(M) };
  }
  /** Kết thúc lần dựng: tấm lơ lửng, khổ ván, va chạm, phủ bì — như cuối build() của tủ. */
  function xongSP(M, bao) {
    for (const f of kiemLienKet(M.parts)) {
      const p = M.parts[f.tam];
      if (THUNG.indexOf(p.loai) >= 0) bao.err(`${p.ten} (${p.tu}) không áp vào tấm nào — tấm lơ lửng.`, 'lien_ket');
      else bao.warn(`${p.ten} (${p.tu}) không áp vào tấm nào — xưởng tự xử lý cách bắt tấm này.`, 'lien_ket');
    }
    checks(M, bao);
    M.info.hop = bbox(M.parts);
    M.info.so_tam = M.parts.length;
    M.info.kiem_xong = true;
    return M;
  }

  function buildGiuong(s) {
    const { M, P, bao } = moiM(s, 'giuong', MUC_KIEM_GIUONG), q = s.giuong, t = s.van.t, KT = s.khoan.thung;
    const W = s.rong, D = s.sau_thung, H = s.cao, bay = q.kieu === 'bay', nk = q.kieu === 'nk';
    const T = q.lop * t, Tdau = q.lop_dau * t;      // dày hông / đuôi, dày đầu giường
    const zDe = bay ? q.cao_de : 0, zTop = q.cao_thanh, zp = rn(zTop - q.lun), zpb = rn(zp - t);      // đáy thân (giường bay: trên đế), mặt hông, mặt phản, đáy phản
    const lr = rn(W - 2 * T), ld = rn(D - T - Tdau), nemR = rn(lr - 2 * q.ho_nem), nemD = rn(ld - 2 * q.ho_nem);
    const benNK = nk ? (q.nk_ben === 'hai' ? ['trai', 'phai'] : [q.nk_ben]) : [];
    const dam = q.dam_giua === 1 || (q.dam_giua < 0 && (lr > 1000 || nk || lr > s.van.kho_rong));
    const xc = rn(W / 2), xa = dam ? rn(xc - t) : rn(W - T), xb = dam ? rn(xc + t) : T;      // mặt trái / phải của đà giữa (không đà: vách ngăn gầm chạy suốt)
    M.info.giuong = { kieu: q.kieu, nem: [nemR, nemD], long: [lr, ld], mat_phan: zp, dam };
    bao.muc('kich_thuoc');
    if (nemR < 600 || nemD < 1500) { bao.err(`Lòng giường ${g(lr)} × ${g(ld)} quá nhỏ (nệm ${g(nemR)} × ${g(nemD)}) — kiểm lại rộng / dài phủ bì.`); return M; }
    if (bay && (q.cao_de < 40 || q.lui_de < T + 30)) { bao.err(`Giường bay: cao đế ${g(q.cao_de)} (cần ≥ 40), lùi đế ${g(q.lui_de)} (cần ≥ dày hông + 30 = ${g(T + 30)}).`, 'de'); return M; }
    // lùi đế tối đa: đế trái / phải còn nằm ngoài đế giữa (hoặc đế trước còn dài ≥ 100), đế dọc còn dài ≥ 300
    if (bay) { const Lmax = rn(Math.min(dam ? xa - t - 50 : (W - 2 * t - 100) / 2, D - Tdau - 300 - t)); if (q.lui_de > Lmax + TOL) { bao.err(`Giường bay: lùi đế ${g(q.lui_de)} quá lớn — tối đa ${g(Lmax)}.`, 'de'); return M; }
      const luiMax = Math.min(300, Math.floor(W / 4 / 5) * 5);      // đế không hẹp hơn nửa thân, lùi không quá 300
      if (q.lui_de > luiMax + TOL) bao.warn(`Giường bay: đế lùi ${g(q.lui_de)} — đế chỉ rộng ${g(W - 2 * q.lui_de)} dưới thân ${g(W)}, ngồi mép giường dễ lật; nên lùi ≤ ${g(luiMax)}.`, 'de'); }
    if (zpb - zDe < 60) { bao.err(`Cao thành ${g(zTop)} quá thấp: phản (đáy ${g(zpb)}) phải cao hơn ${bay ? 'đế' : 'sàn'} ít nhất 60.`); return M; }
    if (H < zTop + 1) { bao.err(`Cao đầu giường ${g(H)} phải cao hơn mặt hông ${g(zTop)}.`); return M; }
    // thanh hông trên phải thò xuống dưới đáy phản ≥ 20 (đầu vách ngăn gầm / thanh đỡ phản bắt vào nó) — phản lún sâu / ván dày thì thanh tự cao lên
    const thH = nk ? Math.max(q.thanh_hong, rn(q.lun + t + 20)) : q.thanh_hong;
    if (nk && zTop - thH - q.nk_khe - 15 < 100) { bao.err(`Giường ngăn kéo: cao thành ${g(zTop)} trừ thanh hông trên ${g(thH)} không còn chỗ cho mặt ngăn kéo (cần ≥ 100) — tăng Cao thành hoặc giảm Phản lún.`, 'ngan_keo'); return M; }
    if (nk && thH > q.thanh_hong) bao.note(`Thanh hông trên cao ${g(thH)} (phản lún ${g(q.lun)} + dày phản ${g(t)} + 20).`);
    bao.note(`Nệm ${g(nemR)} × ${g(nemD)} (lòng giường ${g(lr)} × ${g(ld)}, khe ${g(q.ho_nem)} mỗi bên); mặt phản cao ${g(zp)}, thấp hơn mặt hông ${g(q.lun)}.`);
    // ĐẦU GIƯỜNG: chạy suốt bề ngang, sát tường, xuống sàn (cả giường bay — đầu giường giữ thân giường)
    for (let k = 0; k < q.lop_dau; k++) P({ loai: 'DG', ten: k ? 'Đầu giường (lớp sau)' : 'Đầu giường', type: 2, x0: 0, x1: W, y0: D - Tdau + k * t, y1: D - Tdau + (k + 1) * t, z0: 0, z1: H, lop_trong: k > 0, bat_giuong: true });
    // ĐUÔI GIƯỜNG: chạy suốt bề ngang (che đầu hông), lớp ngoài là mặt
    for (let k = 0; k < q.lop; k++) P({ loai: 'DUG', ten: k ? 'Đuôi giường (lớp trong)' : 'Đuôi giường', type: 2, x0: 0, x1: W, y0: k * t, y1: (k + 1) * t, z0: zDe, z1: zTop, lop_trong: k > 0, bat_giuong: true });
    // HÔNG GIƯỜNG: kẹp giữa đầu và đuôi, bắt bát giường; bên có ngăn kéo thì chỉ còn THANH HÔNG TRÊN (mặt ngăn kéo nằm dưới)
    for (const ben of ['trai', 'phai']) {
      const coNK = benNK.indexOf(ben) >= 0, ten = coNK ? 'Thanh hông' : 'Hông giường', b = ben === 'trai' ? 'trái' : 'phải';
      for (let k = 0; k < q.lop; k++) {
        const x0 = ben === 'trai' ? k * t : W - (k + 1) * t;
        P({ loai: coNK ? 'THH' : 'HG', ten: `${ten} ${b}${k ? ' (lớp trong)' : ''}`, type: 1, x0, x1: x0 + t, y0: T, y1: D - Tdau, z0: coNK ? zTop - thH : zDe, z1: zTop, lop_trong: k > 0, bat_giuong: true });
      }
    }
    // VÁCH NGĂN GẦM (thang): đứng trên sàn (giường bay: trên đế), từ mặt trong hông tới đà giữa, đỡ phản; giường ngăn kéo: mỗi ngăn kéo một ô giữa 2 vách
    bao.muc('nhip');
    const nT = Math.max(2, nk ? q.nk_so + 1 : (q.so_thang || Math.max(3, Math.ceil(ld / 600) + 1)));
    const yT = []; for (let i = 0; i < nT; i++) yT.push(rn(T + i * (ld - t) / (nT - 1)));
    // giường bay: thêm một vách ngăn gầm đứng ngay trên đế trước (thân giường tì cả chiều dài đế trước, không chỉ chạm ở mép tấm)
    const yThem = bay && q.lui_de > T + t + 30 && q.lui_de + t < yT[1] - 30 ? [rn(q.lui_de)] : [];
    const doan = dam ? [[T, xa], [xb, W - T]] : [[T, W - T]];
    // thân giường (đầu, đuôi, hông, vách ngăn gầm, đà, phản) ráp bằng bát giường / vít / ke — không khoan cam
    for (const y of yT.concat(yThem)) doan.forEach(([a, c]) => P({ loai: 'TH', ten: 'Vách ngăn gầm', type: 2, x0: a, x1: c, y0: y, y1: y + t, z0: zDe, z1: zpb, vit_thang: true }));
    // giường ngăn kéo: mỗi ô ngăn kéo rộng gần 1 m → thêm THANH ĐỠ PHẢN (ván đứng cao CAO_DO ngay dưới phản, nằm trên nóc hộp ngăn kéo) cho nhịp phản ≤ 650
    const CAO_DO = 60, yDo = [];
    if (nk) for (let i = 0; i + 1 < nT; i++) { const a = yT[i] + t, c = yT[i + 1], k = Math.ceil((c - a) / 650) - 1; for (let j = 1; j <= k; j++) yDo.push(rn(a + j * (c - a) / (k + 1) - t / 2)); }
    for (const y of yDo) doan.forEach(([a, c]) => P({ loai: 'TH', ten: 'Thanh đỡ phản', type: 2, x0: a, x1: c, y0: y, y1: y + t, z0: zpb - CAO_DO, z1: zpb, vit_thang: true }));
    const moc = yT.concat(yDo, yThem).sort((a, b) => a - b), nhip = moc.length > 1 ? Math.max(...moc.slice(1).map((y, i) => rn(y - moc[i] - t))) : ld;
    if (nhip > 650 + TOL) bao.warn(`Vách ngăn gầm cách nhau ${g(nhip)} (> 650): phản ${g(t)} dễ võng — tăng số vách ngăn (đang ${nT}).`);
    // ĐÀ GIỮA: 2 lớp ván đứng dọc giữa giường, đỡ mối nối 2 tấm phản (mỗi tấm tì ${t} lên đà)
    if (dam) for (const [x0, x1] of [[xa, xc], [xc, xb]]) P({ loai: 'DA', ten: 'Đà giữa', type: 1, x0, x1, y0: T, y1: D - Tdau, z0: zDe, z1: zpb, vit_thang: true });
    // PHẢN: ván thùng, chia theo đà giữa (mối nối nằm trên đà); lòng dài hơn khổ ván thì chia thêm ở vách ngăn gữa
    {
      const cx = dam ? [[T, xc], [xc, W - T]] : [[T, W - T]];
      let cy = [[T, D - Tdau]];
      if (ld > s.van.kho_dai + TOL && nT >= 3) { const yi = yT[Math.floor(nT / 2)] + t / 2; cy = [[T, yi], [yi, D - Tdau]]; }
      for (const [x0, x1] of cx) for (const [y0, y1] of cy) P({ loai: 'PH', ten: 'Phản giường', type: 0, x0, x1, y0, y1, z0: zpb, z1: zp, vit_phan: true });
      if (!dam && lr > 1000) bao.warn(`Lòng giường rộng ${g(lr)} mà không có đà giữa: phản dễ võng giữa.`);
    }
    // GIƯỜNG BAY: khung đế lùi vào trong lui_de (2 đế dọc + đế trước + đế giữa dưới đà); thân giường đặt trên đế, đầu giường xuống sàn
    if (bay) {
      bao.muc('de');
      const L = q.lui_de;
      // khung đế ráp với nhau bằng cam (đế trước / đế giữa kẹp giữa đế trái / phải); thân giường đặt lên đế bắt ke góc + vít (vit_de_giuong)
      P({ loai: 'DEB', ten: 'Đế giường trái', type: 1, x0: L, x1: L + t, y0: L, y1: D - Tdau, z0: 0, z1: zDe, khoan: KT, vit_de_giuong: true });
      P({ loai: 'DEB', ten: 'Đế giường phải', type: 1, x0: W - L - t, x1: W - L, y0: L, y1: D - Tdau, z0: 0, z1: zDe, khoan: KT, vit_de_giuong: true });
      // (1.36.4) đế trước lộ dưới gầm giường bay: lỗ cam vào mặt trong (như xà chân tủ — xem GIAU_LO trong build)
      P({ loai: 'DEB', ten: 'Đế giường trước', type: 2, x0: L + t, x1: W - L - t, y0: L, y1: L + t, z0: 0, z1: zDe, khoan: KT, vit_de_giuong: true, giau_lo: true });
      if (dam) for (const [x0, x1] of [[xa, xc], [xc, xb]]) P({ loai: 'DEB', ten: 'Đế giường giữa', type: 1, x0, x1, y0: L + t, y1: D - Tdau, z0: 0, z1: zDe, khoan: KT, vit_de_giuong: true });
      const soDe = M.parts.filter(p => p.loai === 'DEB').length;
      M.phu_kien.push({ ten: 'Ke góc + vít bắt thân giường xuống đế', sl: 2 * (yT.length + yThem.length) + 2 * soDe, ghi_chu: 'mỗi chỗ vách ngăn gầm / đà đứng trên đế 1 ke; đế trước + đế giữa thêm ke với vách đứng trên nó' });
      const led = rn(2 * (D - Tdau - L) + (W - 2 * L));
      M.phu_kien.push({ ten: 'LED hắt gầm (dán quanh đế)', sl: 1, ghi_chu: `dài ≈ ${g(led)} mm — 2 bên + phía đuôi; chừa lỗ đi dây ở đế` });
    }
    // NGĂN KÉO hai bên hông: mặt phẳng mặt ngoài hông, hộp ngăn kéo dựng bằng tấm (thành, hậu, đáy mỏng phủ dưới), ray bi giữa 2 vách ngăn gầm
    if (nk) {
      bao.muc('ngan_keo');
      const kh = q.nk_khe, zf0 = 15, zf1 = rn(zTop - thH - kh), dn = s.hau.t, ray = q.nk_ray;
      const fw = rn((ld - (q.nk_so + 1) * kh) / q.nk_so);
      let sau = q.nk_sau; const sauMax = rn((dam ? xa : W / 2) - T - 20);
      if (sau > sauMax) { bao.warn(`Ngăn kéo sâu ${g(sau)} không lọt (đà giữa cách mặt trong hông ${g(sauMax + 20)}) — lấy ${g(Math.floor(sauMax / 50) * 50)}.`); sau = Math.floor(sauMax / 50) * 50; }
      if (sau < 260) { bao.err(`Ngăn kéo sâu ${g(sau)} quá nông — ray bi ngắn nhất 250 (sâu hộp ≥ 260).`, 'ngan_keo'); return M; }
      // sâu hộp bị kẹp theo đà giữa (hay sát chỗ kẹp): đổi Rộng ở module Chenfeng không co giãn đều → heSo khoá Rộng
      const kep = sau < q.nk_sau || sauMax - 240 < q.nk_sau;
      const zb0 = rn(zf0 + 20), hb = Math.min(rn(zf1 - zf0 - 40), rn(zpb - CAO_DO - 10 - zb0), 250), zb1 = rn(zb0 + hb);      // nóc hộp dưới thanh đỡ phản
      if (hb < 80) { bao.err(`Giường ngăn kéo: hộp ngăn kéo chỉ cao ${g(hb)} — tăng cao thành (đang ${g(zTop)}).`); return M; }
      for (const ben of benNK) for (let i = 0; i < q.nk_so; i++) {
        const b = ben === 'trai' ? 'trái' : 'phải', fx = ben === 'trai' ? [0, t] : [W - t, W], bx = ben === 'trai' ? [t, t + sau] : [W - t - sau, W - t];
        const y0 = rn(T + kh + i * (fw + kh)), yb0 = rn(yT[i] + t + ray), yb1 = rn(yT[i + 1] - ray);
        P({ loai: 'MNK', ten: `Mặt ngăn kéo`, type: 1, x0: fx[0], x1: fx[1], y0, y1: y0 + fw, z0: zf0, z1: zf1, vit_hoc: true, nk: { ben: b, i } });
        P({ loai: 'TNK', ten: 'Thành ngăn kéo', type: 2, x0: bx[0], x1: bx[1], y0: yb0, y1: yb0 + t, z0: zb0 + dn, z1: zb1, vit_hoc: true });
        P({ loai: 'TNK', ten: 'Thành ngăn kéo', type: 2, x0: bx[0], x1: bx[1], y0: yb1 - t, y1: yb1, z0: zb0 + dn, z1: zb1, vit_hoc: true });
        P({ loai: 'HNK', ten: 'Hậu ngăn kéo', type: 1, x0: ben === 'trai' ? bx[1] - t : bx[0], x1: ben === 'trai' ? bx[1] : bx[0] + t, y0: yb0 + t, y1: yb1 - t, z0: zb0 + dn, z1: zb1, vit_hoc: true });
        P({ loai: 'DNK', ten: 'Đáy ngăn kéo', type: 0, x0: bx[0], x1: bx[1], y0: yb0, y1: yb1, z0: zb0, z1: zb0 + dn, vit_hoc: true, van_hau: true });      // ván hậu mỏng: vật liệu hậu, không dán cạnh
        if (yb1 - yb0 < 250) bao.warn(`Ngăn kéo ${b} ${i + 1}: hộp chỉ rộng ${g(yb1 - yb0)} (< 250).`);
        else if (i === 0 && ben === benNK[0] && s.kiem.nk_rong_max > 0 && yb1 - yb0 > s.kiem.nk_rong_max + TOL) bao.warn(`Ngăn kéo rộng ${g(yb1 - yb0)} (> ${g(s.kiem.nk_rong_max)}): ray và đáy dễ võng — tăng số ngăn mỗi bên (đang ${q.nk_so}).`, 'ngan_keo');
      }
      const nNK = benNK.length * q.nk_so, rayDai = Math.floor((sau - 10) / 50) * 50;
      M.phu_kien.push({ ten: `Ray bi 3 tầng dài ${g(rayDai)} (cặp)`, sl: nNK, ghi_chu: `bắt vào vách ngăn gầm, khe ray ${g(ray)} mỗi bên` });
      M.phu_kien.push({ ten: 'Tay nắm / nhấn mở cho mặt ngăn kéo', sl: nNK, ghi_chu: `mặt ${g(fw)} × ${g(zf1 - zf0)}` });
      M.info.giuong.nk = { so: nNK, mat: [fw, rn(zf1 - zf0)], hop: [sau, rn(yT[1] - yT[0] - t - 2 * ray), hb], kep };
    }
    bao.muc('phu_kien');
    M.phu_kien.unshift({ ten: 'Bát giường (pát tháo lắp hông – đầu / đuôi)', sl: 4, ghi_chu: 'mỗi góc 1 bộ; hông, đầu, đuôi giường không khoan cam' });
    if (q.lop > 1 || q.lop_dau > 1) M.phu_kien.push({ ten: 'Keo + vít ghép 2 lớp ván (hông, đuôi' + (q.lop_dau > 1 ? ', đầu' : '') + ')', sl: 1, ghi_chu: 'vít ≤ 30 bắt từ lớp trong ra' });
    const tenK = KIEU_GIUONG.find(k => k[0] === q.kieu)[1];
    M.tom_tat.push(`${s.ten} — ${tenK.toLowerCase()}, nệm ${g(nemR)} × ${g(nemD)}; phủ bì ${g(W)} × ${g(D)}, đầu giường cao ${g(H)}, mặt hông ${g(zTop)}, mặt phản ${g(zp)}; ván ${g(t)}${q.lop > 1 ? `, hông / đuôi ghép 2 lớp (${g(T)})` : ''}.`);
    M.tom_tat.push(`Gầm: ${nT} vách ngăn${dam ? ' + đà giữa 2 lớp' : ''}, phản ${M.parts.filter(p => p.loai === 'PH').length} tấm${bay ? `; đế lùi ${g(q.lui_de)}, cao ${g(q.cao_de)}` : ''}${nk ? `; ${benNK.length * q.nk_so} ngăn kéo (${benNK.length === 2 ? 'hai bên' : 'bên ' + (benNK[0] === 'trai' ? 'trái' : 'phải')})` : ''}.`);
    return xongSP(M, bao);
  }

  function buildVach(s) {
    const { M, P, bao } = moiM(s, 'vach', MUC_KIEM_VACH), q = s.vach, t = s.van.t, dop = q.day_op || t;
    const W = s.rong, H = s.cao, z0 = q.cach_san, Hh = rn(H - z0), xr = q.xuong_rong, kh = q.khe;
    bao.muc('kich_thuoc');
    if (W < 300 || Hh < 300) { bao.err(`Vách ${g(W)} × ${g(Hh)} quá nhỏ.`); return M; }
    const so = q.so_o || Math.max(1, Math.ceil(W / 800)), hang = q.so_hang || Math.max(1, Math.ceil(Hh / s.van.kho_dai));
    const pw = rn((W - (so - 1) * kh) / so), ph = rn((Hh - (hang - 1) * kh) / hang);
    M.info.vach = { so_o: so, so_hang: hang, o: [pw, ph] };
    if (pw > s.van.kho_rong + TOL && pw > s.van.kho_dai + TOL || Math.min(pw, ph) > s.van.kho_rong + TOL || Math.max(pw, ph) > s.van.kho_dai + TOL) { bao.err(`Ô ${g(pw)} × ${g(ph)} lớn hơn khổ ván ${g(s.van.kho_rong)} × ${g(s.van.kho_dai)} — tăng số ô${hang > 1 || ph > s.van.kho_dai ? ' / số hàng' : ''}.`, 'kho_van'); return M; }
    // mép tấm ốp phải tì lên xương: xương dọc dưới khe chia ô còn chừa mỗi bên ≥ 10
    // ô hẹp: tâm xương mép (xr/2) và tâm xương dưới khe đầu (pw + kh/2) cách nhau ≥ bản xương + 10; hai xương dưới hai khe liền nhau (cách pw + kh) cũng vậy
    const hep = (n, w) => n > 1 && (w + kh / 2 - xr < xr / 2 + 10 || (n > 2 && w + kh < xr + 10));
    if (hep(so, pw)) { let n = so; while (hep(n, (W - (n - 1) * kh) / n)) n--; bao.err(`Ô ${g(pw)} hẹp quá so với bản xương ${g(xr)} — giảm số ô (≤ ${n}) hoặc giảm bản xương.`, 'xuong'); return M; }
    if (so > 1 && (xr - kh) / 2 < 10) { bao.err(`Khe giữa ô ${g(kh)} gần bằng bản xương ${g(xr)}: mép tấm ốp không nằm trên xương — tăng bản xương (≥ ${g(kh + 20)}) hoặc giảm khe.`, 'xuong'); return M; }
    // TẤM ỐP: chia ô đều, khe kh (nẹp U inox) giữa các ô
    const xs = [], zs = [];
    for (let i = 0; i < so; i++) xs.push(rn(i * (pw + kh)));
    for (let j = 0; j < hang; j++) zs.push(rn(z0 + j * (ph + kh)));
    for (const z of zs) for (const x of xs) P({ loai: 'OP', ten: 'Tấm ốp đầu giường', type: 2, x0: x, x1: x + pw, y0: 0, y1: dop, z0: z, z1: z + ph, op: true });
    // XƯƠNG DỌC: ở 2 mép, dưới mỗi khe chia ô (mối nối tấm nằm trên xương), thêm cho cách nhau ≤ xuong_cach; mỗi hàng ô một đoạn
    bao.muc('xuong');
    let cot = cotVach(W, so, q);
    // giữa hai xương bắt buộc: chia thêm cho cách ≤ xuong_cach (số đoạn ghi sẵn ở so_doc → module co giãn Rộng không nhảy số tấm)
    // khoảng sát hai mép (so_doc_mep) ngắn hơn khoảng giữa các khe (so_doc) — mỗi loại một số
    { const ra = [cot[0]]; for (let i = 1; i < cot.length; i++) { const a = ra[ra.length - 1], b = cot[i], n = Math.min(((i === 1 || i === cot.length - 1) ? q.so_doc_mep : q.so_doc) || chiaXuong(b - a, 0, q), Math.max(1, Math.floor((b - a) / (xr + 10)))); for (let k = 1; k < n; k++) ra.push(rn(a + k * (b - a) / n)); ra.push(b); } cot = ra; }      // số ghi sẵn cũ không làm chồng xương
    const dong = cot.map(c => [rn(Math.max(0, c - xr / 2)), rn(Math.min(W, c + xr / 2))]);
    for (const z of zs) for (const [a, b] of dong) P({ loai: 'XU', ten: 'Xương dọc', type: 2, x0: a, x1: b, y0: dop, y1: dop + t, z0: z, z1: z + ph, vit_no: true });
    // XƯƠNG NGANG: trên / dưới mỗi hàng ô + giữa cho cách nhau ≤ xuong_cach, lọt giữa các xương dọc
    for (const z of zs) {
      const n = Math.min(q.so_ngang || chiaXuong(ph - xr, 0, q), Math.max(1, Math.floor((ph - xr) / (xr + 10)))), lv = [];
      for (let k = 0; k <= n; k++) lv.push(rn(z + xr / 2 + k * (ph - xr) / n));
      for (const c of lv) for (let i = 0; i + 1 < dong.length; i++) {
        const a = dong[i][1], b = dong[i + 1][0];
        if (b - a >= Math.max(50, xr / 2)) P({ loai: 'XU', ten: 'Xương ngang', type: 2, x0: a, x1: b, y0: dop, y1: dop + t, z0: c - xr / 2, z1: c + xr / 2, vit_no: true });
      }
    }
    { const n = Math.min(q.so_ngang || chiaXuong(ph - xr, 0, q), Math.max(1, Math.floor((ph - xr) / (xr + 10)))), cach = rn((ph - xr) / n), cd = Math.max(...cot.slice(1).map((c, i) => rn(c - cot[i])));
      // thưa quá xuong_cach: do bản xương to tới mức chia thêm là chồng xương, hay do số xương ghi sẵn mà kích thước đã đổi ở Chenfeng
      const toQua = (ph - xr) / chiaXuong(ph - xr, 0, q) > q.xuong_cach + TOL || cotVach(W, so, q).slice(1).some((c, i, a) => { const d = c - (i ? a[i - 1] : xr / 2); return d / chiaXuong(d, 0, q) > q.xuong_cach + TOL; });
      if (cach > q.xuong_cach + TOL || cd > q.xuong_cach + TOL) bao.warn(`Xương ${cach > q.xuong_cach + TOL ? `ngang cách nhau ${g(cach)}` : `dọc cách nhau ${g(cd)}`} (> ${g(q.xuong_cach)}) — ${toQua ? `bản xương ${g(xr)} quá to so với khoảng cách: giảm bản xương hoặc tăng Xương cách` : 'kích thước đã đổi ở Chenfeng: gõ lại Rộng / Cao ở bảng để chia lại xương'}.`, 'xuong'); }
    if (kh > 0 && (so > 1 || hang > 1)) M.phu_kien.push({ ten: `Nẹp U inox ${g(kh)} (chỉ âm giữa các ô)`, sl: (so - 1) * hang + (hang - 1) * so, ghi_chu: `${(so - 1) * hang} nẹp dọc dài ${g(ph)}, ${(hang - 1) * so} nẹp ngang dài ${g(pw)}` });
    M.phu_kien.push({ ten: 'Vít nở (tắc kê Ø6 – 8) bắt xương vào tường', sl: dong.length * hang * Math.max(2, Math.ceil(ph / 400)), ghi_chu: 'mỗi xương dọc cách ~400 một vít; khoan cách mép tường ≥ 100' });
    M.tom_tat.push(`${s.ten} — ${g(W)} × ${g(Hh)}${z0 ? ` (cách sàn ${g(z0)})` : ''}: ${so * hang} ô ${g(pw)} × ${g(ph)}, khe ${g(kh)}; tấm ốp ${g(dop)} trên khung xương ván ${g(t)} × ${g(xr)} (dọc ${dong.length} cây, cách ≤ ${g(q.xuong_cach)}), tổng dày ${g(dop + t)}.`);
    return xongSP(M, bao);
  }

  /* ------------------------------------------------------------------ *
   * TỦ BẾP (bản 1.33 — anh Thanh: "tủ bếp chuẩn VN, lấy phụ kiện làm chuẩn", "chậu / bếp nấu 800 / 900, hút mùi 700 / 900", "phụ kiện chỉ Higold và Eurogold").
   * Một module = một thùng có 2 hồi riêng = một spec `loai_sp: 'bep'` = một module Chenfeng (xưởng VN chở và lắp tủ bếp từng thùng; bộ bếp chữ I / L / U là việc của PHÒNG, bản 1.34).
   * Đi bộ dựng tủ, rẽ nhánh theo `spec.bep` (không truyền tham số thứ hai cho build: heSo, keHoachGoc, vuaKhoVan, driver đều gọi build(spec)).
   * Kích thước module là của THÔNG SỐ (s.cao, s.sau_thung, s.chan.cao — module Chenfeng đổi L / W / H là đổi các số này); chuẩn bếp (mặt đá, sâu, chân…) tính ngược lại theo
   * chúng trong normBep. Đổi chuẩn bếp thì gọi datBep(spec, { cao_mat: 860 … }) — tính lại kích thước module rồi mới normalize.
   * Số ghi [CĐ] là CHƯA ĐO ở xưởng; số rổ lấy theo catalogue Eurogold (Higold chưa có số) — xem thiết kế 1.33 và CLAUDE.md.
   * ------------------------------------------------------------------ */
  // ket_cau_chan 'hoi_san' = hồi xuống sàn, đáy lọt ở z = chân, xà chân lùi `len_lui` (lệnh gốc vẽ được); 'nhua' (thùng trên chân nhựa, đáy phủ hồi, len suốt dãy) để 1.34.
  // noc 'lien' | 'giang' (tủ chậu / bếp nấu luôn giằng: lỗ khoét đá cắt qua chỗ nóc). tb = thiết bị (chau | bep | hm), pk = phụ kiện lắp trong tủ trên (giá bát), không phải mặt kéo.
  const DEFAULT_BEP = {
    // (1.33.1) anh Thanh CHỐT 12/10/2026: mặt đá 860 (đá 20 → thân tủ dưới 840, đáy tủ trên 860 + 700 = 1560); MỌI tủ dưới 2 giằng thay nóc ('lien' còn là lựa chọn);
    // tay nắm vát cạnh / ấn mở (không tay nắm nổi). Bản 1.33.0: 850, nóc liền, tay nắm nổi — MAC_DINH_BEP_CU (chuẩn đã lưu ở máy: nangChuanBep).
    tang: 'duoi', chuc_nang: 'canh', ket_cau_chan: 'hoi_san', noc: 'giang',
    cao_mat: 860, day_da: 20, van_lot: 0, chan: 100, len_lui: 50, sau_duoi: 560, dua_da: 20, cach_tuong: 0, vien_da: 0,      // mặt đá 860 + chân 100 + lùi 50 anh đã chốt; [CĐ] lót ván, đua 20
    sau_tren: 350, sau_cao: 560, giang_rong: 100,                                                                            // [CĐ] tủ trên 320 / 350, giằng 80 – 100
    cao_tren: 800, cach_tren: 700, treo: 'thanh', thanh_treo: 80, canh_trum_duoi: 0,                                         // [CĐ] cách mặt đá 650 / 700, thanh treo 80 – 100
    bep_loai: 'tu', cach_hm_tu: 650, cach_hm_gas: 700, nk_nong: 180, nk_cach_bep: 80, canh_1_duoi: 600, canh_1_tren: 500,
    tay_nam: 'vat', nep_tuong: 70, van_chau: '', pk: '', tb: {},
  };
  /** Mặc định của bản 1.33.0 (trước khi anh chốt) — chuẩn đã lưu ở máy mang đúng số này mà lưu trước 1.33.1 thì coi như người dùng chưa chọn (nangChuanBep). */
  const MAC_DINH_BEP_CU = { cao_mat: 850, tay_nam: 'noi' };
  /**
   * (bản vá 1.33.1) Tủ bếp lưu / vẽ trước 1.33.1 mang mặc định cũ (mặt đá 850, tay nắm nổi): ghi các khoá đó vào `bep.chuan_cu`. Số của CHÍNH tủ đó giữ nguyên
   * (tủ đã vẽ phải dựng lại đúng như lúc vẽ), nhưng khoá trong `chuan_cu` không phải lựa chọn của người dùng: mẫu bếp chọn sau (mauBep.ap) và chuẩn nhớ ở máy
   * (bảng: mncf.bep.v1) không lấy chúng. Người dùng gõ lại khoá đó (datBep) = đã chọn → bỏ khỏi `chuan_cu`. normBep giữ dấu chỉ khi số còn đúng mặc định cũ.
   */
  function danhDauChuanCu(o) {
    if (!o || o.loai_sp !== 'bep' || !o.bep || typeof o.bep !== 'object') return o;
    const B = o.bep, ds = Object.keys(MAC_DINH_BEP_CU).filter(k => B[k] === MAC_DINH_BEP_CU[k]);
    if (ds.length) B.chuan_cu = ds; else delete B.chuan_cu;
    return o;
  }
  /** (bản vá 1.33.1) Câu báo khi mẫu bếp vừa chọn bỏ mặc định cũ (khoá trong `doi`) để theo chuẩn anh chốt — gian bếp làm dở ở bản trước lệch mặt đá. Rỗng = không đổi gì. */
  function baoChuanBepMoi(doi) {
    doi = Array.isArray(doi) ? doi.filter(k => k in MAC_DINH_BEP_CU) : [];
    if (!doi.length) return '';
    const TEN_TAY = { vat: 'vát cạnh', an_mo: 'ấn mở', noi: 'tay nắm nổi', gola: 'Gola', j: 'nẹp J' };
    const p = doi.map(k => (k === 'cao_mat' ? `mặt đá ${g(DEFAULT_BEP.cao_mat)} (bản trước ${g(MAC_DINH_BEP_CU.cao_mat)})` : `tay nắm ${TEN_TAY[DEFAULT_BEP.tay_nam]} (bản trước ${TEN_TAY[MAC_DINH_BEP_CU.tay_nam]})`));
    const lai = doi.map(k => (k === 'cao_mat' ? `Cao mặt đá ${g(MAC_DINH_BEP_CU.cao_mat)}` : `Tay nắm: ${TEN_TAY[MAC_DINH_BEP_CU.tay_nam]}`)).join(', ');
    return `Chuẩn bếp mới (anh chốt 12/10/2026): ${p.join(', ')}. Tủ bếp đã vẽ ở bản trước giữ số cũ — gian bếp đang làm dở muốn khớp tủ đã vẽ thì đặt lại ${lai} ở khối Tủ bếp (bảng nhớ cho các tủ sau).`;
  }
  /** Kiểu tay nắm tủ bếp: vat = cánh vát cạnh 45° làm chỗ cầm (mép trên cánh tủ dưới / mép dưới cánh tủ trên / mép đứng phía mở của tủ cao), an_mo = ấn mở (bộ nhấn mở + bản lề
   *  không giảm chấn, ngăn kéo ray nhấn mở), noi = tay nắm nổi (khách chọn mẫu, không kê), gola = rãnh nhôm, j = nẹp J. */
  const TAY_NAM_BEP = ['vat', 'an_mo', 'noi', 'gola', 'j'];
  const VAT_SAU = 10;      // [CĐ] vát 45° ăn vào mặt cánh ~10 mm (xưởng chốt theo dao)
  /** Chuẩn bếp (giữ khi đổi mẫu, bảng nhớ ở localStorage mncf.bep.v1) — khác với các khoá riêng của từng module (tang, chuc_nang, noc, pk, tb). */
  const KHOA_CHUAN_BEP = ['cao_mat', 'day_da', 'van_lot', 'chan', 'len_lui', 'sau_duoi', 'dua_da', 'cach_tuong', 'vien_da', 'sau_tren', 'sau_cao', 'giang_rong', 'cao_tren', 'cach_tren', 'treo', 'thanh_treo', 'canh_trum_duoi',
    'bep_loai', 'cach_hm_tu', 'cach_hm_gas', 'nk_nong', 'nk_cach_bep', 'canh_1_duoi', 'canh_1_tren', 'tay_nam', 'nep_tuong', 'van_chau'];
  const SO_BEP = { cao_mat: [600, 1100], day_da: [0, 80], van_lot: [0, 40], chan: [0, 300], len_lui: [0, 150], sau_duoi: [300, 800], dua_da: [0, 100], cach_tuong: [0, 100], sau_tren: [200, 600], sau_cao: [300, 800],
    giang_rong: [50, 200], cao_tren: [300, 1200], cach_tren: [300, 1200], thanh_treo: [0, 200], canh_trum_duoi: [0, 50], cach_hm_tu: [400, 1000], cach_hm_gas: [400, 1000], nk_nong: [100, 400], nk_cach_bep: [0, 200],
    canh_1_duoi: [300, 1200], canh_1_tren: [300, 1200], nep_tuong: [0, 200] };
  /** Phụ kiện bếp làm chuẩn — CHỈ Eurogold / Higold (anh Thanh). Quy luật của hãng: rổ rộng = cỡ tủ − 36 (tủ ván 18); ván 17,5 → lọt = cỡ − 35 vừa rổ, dư 1.
   *  lot(co) = dải lọt lòng [min, max] rổ bắt được ray (max = cỡ − 34 suy từ dải "W262–268" của hãng — [CĐ]); sau_min / cao_min = chỗ rổ cần; cao_ro = rổ cao thật (kiểm rổ lọt dưới giằng / thân bếp âm).
   *  hang_co = { cỡ: [hãng, nguồn] } — cỡ chỉ một hãng làm (vòng soát 3: bát đĩa 750 / gia vị 450 chỉ Higold): dòng mua ghi đúng hãng đó.
   *  lap: 'keo' = mặt kéo bắt vào rổ (ô keo_pk), 'canh' = rổ cánh mở (ô keo_pk một mã: ô có cánh + bản lề thay mặt kéo), 'tren' = lắp trong tủ trên (spec.bep.pk). */
  // (1.33) Phụ kiện bếp CHỈ hai hãng Higold + Eurogold (anh Thanh 12/10/2026). Cả hai tính lọt lòng = cỡ tủ − 36 (ván 18) — Higold ghi rõ; dải hãng nhận
  // (Eurogold EA300 W262–268, B331 264–268, Higold 307042 264/268) ≈ cỡ − 38 … cỡ − 32 → ván 17 / 17,5 / 18 đều lọt. Số lấy từ trang hãng / đại lý, chưa có catalogue gốc [CĐ].
  // sau_tu = sâu THÙNG tối thiểu hãng ghi (khác sau_min = sâu lọt lòng trước thanh treo): giá bát cố định Higold ghi "thùng sâu ≥ 300", rổ sâu 262 (Higold) / 280 (Eurogold) → lọt lòng ≥ 285 [CĐ]
  const LOAI_PK_BEP = [
    { ma: 'xoong', ten: 'Giá xoong nồi', tang: 'duoi', lap: 'keo', co: [600, 700, 750, 800, 900], lot: co => [co - 38, co - 32], sau_min: 480, cao_min: 220, cao_ro: 210, hang: 'Higold / Eurogold', nguon: 'Higold Martin 2.0 301731–301735 (lọt 564 × 475 × 210), Diamond 301511–301515; Eurogold EU130 / EP60–EP90 (W565–865 × 480 × 175)' },
    // (vòng soát 2) cao_ro = rổ CAO NHẤT trong các hàng ghi ở nguon (kiểm rổ lọt dưới giằng theo hàng nào xưởng mua cũng được): bát đĩa Higold 210 > Eurogold 175;
    // cao_min / sau_min theo khuyến nghị gộp của phụ kiện (pk-higold-eurogold §3): bát đĩa chỗ ≥ 220, thùng rác cao ≥ 530 / sâu ≥ 510, thùng gạo sâu ≥ 500.
    { ma: 'bat_duoi', ten: 'Giá bát đĩa tủ dưới', tang: 'duoi', lap: 'keo', co: [600, 700, 750, 800, 900], lot: co => [co - 38, co - 32], sau_min: 480, cao_min: 220, cao_ro: 210, hang: 'Higold / Eurogold', nguon: 'Higold Diamond 2.0 30152x (lọt 564 / 664 / 714 / 764 / 864 × 475 × 210, có cỡ 750); Eurogold EU133600–900 (cao 175)',
      hang_co: { 750: ['Higold', 'Higold Diamond 2.0 30152x cỡ 750 (lọt 714 × 475 × 210) — Eurogold EU133 không có cỡ 750'] } },
    { ma: 'gia_vi', ten: 'Giá gia vị, dao thớt', tang: 'duoi', lap: 'keo', co: [150, 200, 250, 300, 350, 400, 450], lot: co => [co - 38, co - 32], sau_min: 480, cao_min: 520, cao_ro: 505, hang: 'Higold / Eurogold', nguon: 'Higold Diamond 2.0 306030 / 306029 / 306031, Martin 2.0 (lọt 264 / 314 / 364 × 465 × 505), 304221 (150), Diamond 2.0 tới cỡ 450; Eurogold EP20–EP40 (lọt 164–364 × 475 × 455), EG150',
      hang_co: { 450: ['Higold', 'Higold Diamond 2.0 cỡ 450 — Eurogold (EP20–EP40, EU12xx) chỉ tới cỡ 400'] } },
    { ma: 'gao', ten: 'Thùng gạo', tang: 'duoi', lap: 'keo', co: [300], lot: () => [262, 268], sau_min: 500, cao_min: 540, cao_ro: 520, hang: 'Higold / Eurogold', nguon: 'Higold 307042 (264 / 268 × 490 × 520); Eurogold B331 / B332 (lọt 264–268), EGA300' },
    { ma: 'rac', ten: 'Thùng rác', tang: 'duoi', lap: 'keo', co: [300, 400], lot: co => [co - 38, co - 32], sau_min: 510, cao_min: 530, cao_ro: 520, hang: 'Higold / Eurogold', nguon: 'Eurogold EA300 W262–268 × D505 × H520 (tủ 300), EA400 / BA400 W362–368 × D506 × H470 (tủ 400); Higold 307013 (400, gắn cánh) [CĐ]' },
    // (vòng soát 2) tủ đồ khô tách theo KIỂU MỞ của hàng thật: kéo (mặt kéo bắt vào khung rổ, ray đi theo rổ) chỉ có Eurogold M030640 400 lọt ô ~1780 (khung chỉnh cao 1700 – 2200;
    // Higold cánh kéo 201149 / 201146 / 201106 cần ô 1959 – 2359). Cỡ 450 / 600 của cả hai hãng là rổ CÁNH MỞ: khung rổ bắt hồi, cánh có bản lề — ô dưới là cánh thường (kho_canh).
    // cao_max = khung rổ chỉnh cao tối đa (ô cao hơn: khung không với tới đợt trên — cảnh báo).
    { ma: 'kho', ten: 'Tủ đồ khô kéo', tang: 'cao', lap: 'keo', co: [400], lot: () => [348, 366], sau_min: 500, cao_min: 1720, cao_max: 2200, cao_ro: 1700, hang: 'Eurogold', nguon: 'Eurogold M030640 (400: 350 × 480 × 1700 – 2200, lọt 364); Higold cánh kéo 201149 / 201146 cần ô cao 1959 – 2359 — không lọt ô 1780' },
    { ma: 'kho_canh', ten: 'Tủ đồ khô cánh mở', tang: 'cao', lap: 'canh', co: [450, 600], lot: co => [co - 38, co - 32], sau_min: 500, cao_min: 1835, cao_max: 1950, cao_ro: 1825, hang: 'Higold / Eurogold', nguon: 'Higold 202273 (450: lọt 414 × 500 × 1825), nan dẹt cánh mở 600 (560 × 500 × 1825); Eurogold EPL80645 (450: 415 × 500 × 1650 – 1950), EP80660 (600: 564 × 500 × > 1720)' },
    { ma: 'bat_tren_cd', ten: 'Giá bát đĩa cố định tủ trên', tang: 'tren', lap: 'tren', co: [600, 700, 800, 900], lot: co => [co - 38, co - 32], sau_min: 285, sau_tu: 300, cao_min: 560, cao_ro: 560, hang: 'Higold / Eurogold', nguon: 'Higold 401160–401163 (564–864 × 262 × 150, thùng sâu ≥ 300, cao ≥ 560); Eurogold EPS600–900, EU01060–EU01100 (R565–965 × S280 × C650)' },
    // (bản 1.34) TỦ GÓC MÙ chữ L: rổ góc chiếm cả lọt lòng một khoang (khung rổ bắt hồi + cánh), cánh rộng c phía hở — ô keo_pk một mã, lap 'goc' (như rổ cánh mở).
    // c_min = cánh tối thiểu hãng ghi; lọt cao ≥ 600 / sâu ≥ 510 [CĐ] (Higold sâu rổ 490, Eurogold 480 – 520). Chiều trái / phải mã hãng, bản lề 165° — [CĐ] hỏi đại lý.
    { ma: 'goc_lh_hg', ten: 'Rổ góc liên hoàn', tang: 'duoi', lap: 'goc', co: [900], lot: () => [858, 870], c_min: 400, sau_min: 510, cao_min: 600, cao_ro: 535, hang: 'Higold', nguon: 'Higold Shearer (Magic corner) 101055 / 101056, Diamond 2.0 101032 / 101033 — tủ góc 900, lọt 860 × 490 × 535, cánh ≥ 400' },
    { ma: 'goc_lh_eu', ten: 'Rổ góc liên hoàn', tang: 'duoi', lap: 'goc', co: [900, 950, 990], lot: co => [co - 38, Math.min(960, co - 32)], c_min: 450, sau_min: 510, cao_min: 600, cao_ro: 560, hang: 'Eurogold', nguon: 'Eurogold EPSL-101 / 102, EU101 / 102, EPV101 / 102 — tủ góc 900 – 1000, cánh > 450, rổ (860 – 960) × 480 – 520 × 560' },
    { ma: 'goc_la', ten: 'Mâm xoay góc hình lá', tang: 'duoi', lap: 'goc', co: [900], lot: () => [800, 868], c_min: 450, sau_min: 480, cao_min: 610, cao_ro: 600, hang: 'Eurogold', nguon: 'Eurogold M0202-L / R (785 × 475 × 600) — tủ góc 800 – 900, cánh 450' },
    { ma: 'bat_tren_nh', ten: 'Giá bát đĩa nâng hạ tủ trên', tang: 'tren', lap: 'tren', co: [600, 700, 800, 900], lot: co => [co - 38, co - 32], sau_min: 300, cao_min: 700, cao_ro: 650, hang: 'Higold / Eurogold', nguon: 'Eurogold EVI160–190 (565–865 × 280 × 650, thùng cao ≥ 650); Higold Diamond 2.0 40132x (564–864 × 285 × 525), điện Star Move 401361–401364 (cao ≥ 690) — thùng ≥ 700 cho cả hai [CĐ]' },
  ];

  /** Thiết bị bếp (khách mua): số là VÍ DỤ phổ biến ở đại lý VN — người dùng gõ theo model thật (ma 'tu_chon'). phu_bi / khoet = [rộng, sâu]. */
  const LOAI_TB_BEP = {
    chau: [
      { ma: 'don_600', ten: 'Chậu đơn 600 × 450 lắp dương (ví dụ)', lap: 'duong', phu_bi: [600, 450], khoet: [570, 420] },
      // (1.33.1) chậu âm là chính (anh chốt): tủ 800 lọt 764 — chậu đôi âm 780 cần lọt 800 (phủ bì + 2 × khe tai kẹp) không vào → mẫu 800 dùng chậu đơn âm [CĐ] số ví dụ
      { ma: 'am_don_600', ten: 'Chậu đơn 600 × 440 lắp âm (ví dụ)', lap: 'am', phu_bi: [600, 440], khoet: [570, 410] },
      { ma: 'duong_820', ten: 'Chậu đôi 820 × 480 lắp dương (ví dụ)', lap: 'duong', phu_bi: [820, 480], khoet: [795, 455] },
      { ma: 'am_780', ten: 'Chậu đôi 780 × 430 lắp âm (ví dụ)', lap: 'am', phu_bi: [780, 430], khoet: [750, 400] },
      { ma: 'am_870', ten: 'Chậu đôi 870 × 450 lắp âm (ví dụ)', lap: 'am', phu_bi: [870, 450], khoet: [840, 420] },
    ],
    bep: [
      { ma: 'doi_730', ten: 'Bếp đôi 730 × 430 (ví dụ)', phu_bi: [730, 430], khoet: [680, 400] },
      { ma: 'ba_750', ten: 'Bếp 750 × 450 (ví dụ)', phu_bi: [750, 450], khoet: [710, 430] },
      // (bản 1.35) tủ bếp nấu 700 (chậu = bếp cùng cỡ 700 / 800 / 900 — anh Thanh 14/10/2026): lọt 664 → bếp khoét ≤ 664; máy hút mùi âm 600 (tủ 700) không hẹp hơn bếp quá 50 [CĐ] số ví dụ
      { ma: 'doi_650', ten: 'Bếp đôi 650 × 420 (ví dụ)', phu_bi: [650, 420], khoet: [610, 390] },
    ],
    // (bản 1.34) tủ lạnh khách mua (số VÍ DỤ — gõ máy thật bằng 'tu_chon'); tan_nhiet = máy toả nhiệt mặt trước / dưới ('truoc') hay hai hông ('hong'), '' = chưa khai.
    // Hở quanh máy (ho_hong / ho_tren / ho_sau) mặc định 20 / 50 / 50 [CĐ] — 20 mỗi bên anh chọn, chỉ đúng cho máy toả nhiệt mặt trước (Samsung NZ 50, PH 100)
    tl: [
      { ma: 'hai_canh_700', ten: 'Tủ lạnh 2 cánh 700 (ví dụ)', rong: 700, sau: 700, cao: 1750, tan_nhiet: 'truoc' },
      { ma: 'bon_canh_830', ten: 'Tủ lạnh 4 cánh 830 (ví dụ)', rong: 830, sau: 750, cao: 1850, tan_nhiet: 'truoc' },
      { ma: 'sbs_910', ten: 'Tủ lạnh side-by-side 910 (ví dụ)', rong: 910, sau: 650, cao: 1890, tan_nhiet: 'truoc' },
      // (bản 1.35) tủ lạnh ÂM (lắp trong tủ cao bao quanh, cánh ốp cùng màu theo máy + ray dẫn cánh): hở 5 mỗi hông (anh chốt), trên / sau theo catalogue máy [CĐ]
      { ma: 'am_560', ten: 'Tủ lạnh âm 1 cánh 560 (ví dụ)', kieu: 'am', rong: 560, sau: 545, cao: 1770, tan_nhiet: 'truoc' },
    ],
    hm: [
      { ma: 'am_700', ten: 'Hút mùi âm tủ 700 (ví dụ)', kieu: 'am', lap: 'hop', rong: 700, sau: 330, cao: 180, tam_keo: 50, ong: 150 },
      { ma: 'am_900', ten: 'Hút mùi âm tủ 900 (ví dụ)', kieu: 'am', lap: 'hop', rong: 900, sau: 330, cao: 180, tam_keo: 50, ong: 150 },
      // (bản 1.35) tủ hút mùi rộng ĐÚNG tủ bếp nấu (mối nối tủ trên trùng tủ dưới): tủ 700 lọt 664 → máy 600, tủ 900 lọt 864 → máy 800 [CĐ] số ví dụ
      { ma: 'am_600', ten: 'Hút mùi âm tủ 600 (ví dụ)', kieu: 'am', lap: 'hop', rong: 600, sau: 300, cao: 180, tam_keo: 50, ong: 150 },
      { ma: 'am_800', ten: 'Hút mùi âm tủ 800 (ví dụ)', kieu: 'am', lap: 'hop', rong: 800, sau: 330, cao: 180, tam_keo: 50, ong: 150 },
      // (1.33.1) kính vát / áp tường: máy treo tường trên bếp, ỐNG KHÓI đi lên qua tủ che ống (tủ trên ngắn, đáy ≥ đỉnh thân máy). cao = thân máy (không kể ống khói) [CĐ] số ví dụ
      { ma: 'kinh_700', ten: 'Hút mùi kính vát 700 áp tường (ví dụ)', kieu: 'kinh', lap: 'hop', rong: 700, sau: 500, cao: 442, tam_keo: 0, ong: 150 },
      { ma: 'kinh_900', ten: 'Hút mùi kính vát 900 áp tường (ví dụ)', kieu: 'kinh', lap: 'hop', rong: 900, sau: 500, cao: 442, tam_keo: 0, ong: 150 },
    ],
  };
  const TL_HO = { ho_hong: 20, ho_tren: 50, ho_sau: 50 };      // (bản 1.34) hở quanh tủ lạnh mặc định [CĐ]
  // (bản 1.35) tủ lạnh âm: khít hai hông, hở 5 mỗi bên (anh Thanh 14/10/2026); trên 10 / sau 0 [CĐ] — catalogue máy âm ghi hốc + khe thoát nhiệt riêng
  const TL_HO_AM = { ho_hong: 5, ho_tren: 10, ho_sau: 0 };
  const hoTL = kieu => (kieu === 'am' ? TL_HO_AM : TL_HO);
  const TB_MAC_DINH = { tl: W => (W >= 985 ? 'sbs_910' : W >= 905 ? 'bon_canh_830' : 'hai_canh_700'), chau: W => (W >= 900 ? 'am_780' : 'am_don_600'), bep: W => (W >= 900 ? 'ba_750' : W >= 800 ? 'doi_730' : 'doi_650'),
    hm: W => (W >= 950 ? 'am_900' : W >= 900 ? 'am_800' : W >= 800 ? 'am_700' : 'am_600') };
  const KINH_KHUNG = 60, KINH_AN = 10, LED_RANH = [12, 8, 40], LED_W_M = 10;      // (bản 1.35) cánh khung kính: thanh bản 60, kính ăn rãnh 10; LED: rãnh 12 × 8 cách mép trước 40, 10 W/m [CĐ]
  const CAO_CHE_ONG = 350;      // [CĐ] tủ che ống hút mùi kính cao 350 (mẫu BT-HMK; chọn máy kính cho tủ hút mùi âm cũng ra cỡ này)
  const HM_KINH_DU = 100;      // [CĐ] máy hút mùi kính treo được cao hơn khoảng cách tối thiểu tới mặt bếp thêm tới 100 (từ 650 – 750, gas 700 – 800) — xa hơn hút kém
  const LO_THOAT = 50, DA_NHO_HO = 20, TL_HO_MIN = 10, HOC_LO_RONG = [560, 568], HOC_LO_SAU = 550;      // (bản 1.34) đợt đỡ lò ngắn 50 phía sau (thoát nhiệt — F&P OM60); đá nhô qua ốp hông đầu dãy hở 20 (anh chốt)
  const KHE_CHAU = 10, VANH_AM = 20, DA_TRUOC_MIN = 60, KHE_GIANG_NK = 5;      // [CĐ] khe thân / vành chậu tới hồi; chậu âm: vành ra ngoài lỗ khoét; đá trước lỗ khoét tối thiểu (mỏng hơn dễ nứt); hộp ngăn kéo cách mặt dưới giằng
  const CO_TB = { chau: [700, 800, 900, 1000, 1200], bep: [700, 800, 900, 1000, 1200], hm: [700, 800, 900, 950, 1000, 1200] };      // (1.35) + 700, tủ hút mùi 900 (máy 800)      // cỡ module của thư viện (hút mùi: mối nối trùng tủ bếp nấu 800 bên dưới)
  /** Tủ nhỏ nhất (theo cỡ thư viện) chứa được thiết bị — câu "căn chuẩn" của anh Thanh. tb = { loai: 'chau' | 'bep' | 'hm', lap, phu_bi, khoet, rong }; opt.t = dày ván (mặc định chuẩn xưởng); opt.tren = chỉ xét cỡ lớn hơn số này. @returns số | null */
  function coTuChoTB(tb, opt) {
    tb = tb || {}; const t = num(opt && opt.t, DEFAULT_SPEC.van.t), l = tb.loai, r0 = a => (Array.isArray(a) ? num(a[0], NaN) : NaN);
    const vua = W => {
      const lot = W - 2 * t;
      if (l === 'chau') return tb.lap === 'am' ? r0(tb.phu_bi) + 2 * KHE_CHAU <= lot + TOL : r0(tb.khoet) + KHE_CHAU <= lot + TOL;
      if (l === 'bep') return r0(tb.khoet) <= lot + TOL;
      if (l === 'hm') return num(tb.rong, NaN) + 10 <= lot + TOL;
      return false;
    };
    const tren = num(opt && opt.tren, 0);      // (vòng soát 3) chỉ xét cỡ LỚN HƠN tủ đang có (gợi ý "chuyển sang tủ N")
    for (const W of CO_TB[l] || []) if (W > tren + TOL && vua(W)) return W;
    return null;
  }
  // cỡ rổ dùng cho tủ rộng W: đúng cỡ nếu hãng có; không thì cỡ gần nhất (cách đều thì cỡ nhỏ hơn)
  // bề rộng "cỡ" của khoang có lọt lòng lt (= lọt + 2 ván); một khoang thì đúng bằng rộng module W
  const coKhoang = (lt, W, t) => (Math.abs(lt + 2 * t - W) < 0.5 ? W : rn(lt + 2 * t));
  const coPK = (p, W) => { if (p.co.indexOf(W) >= 0) return W; let b = p.co[0]; for (const c of p.co) if (Math.abs(c - W) < Math.abs(b - W) - TOL) b = c; return b; };
  /** Thiết bị theo danh mục; ma 'tu_chon' = số người dùng gõ (thiếu số nào lấy theo model mặc định); mã lạ = model mặc định theo bề rộng. cach_mep_truoc (chỗ đặt khoét) giữ ở mọi mã. */
  function tbBep(loai, q, W) {
    q = q && typeof q === 'object' ? q : {};
    const ds = LOAI_TB_BEP[loai], m = ds.find(x => x.ma === q.ma), o = clone(m || ds.find(x => x.ma === TB_MAC_DINH[loai](W)));
    if (!m && q.ma === 'tu_chon') {
      o.ma = 'tu_chon'; o.ten = 'Tự gõ số';
      const doi2 = a => (Array.isArray(a) && a.length >= 2 && a.slice(0, 2).every(v => num(v, 0) > 0 && num(v, 0) < 3000) ? a.slice(0, 2).map(v => rn(num(v, 0), 1)) : null);
      for (const k of ['phu_bi', 'khoet']) if (k in o) { const v = doi2(q[k]); if (v) o[k] = v; }
      for (const k of ['rong', 'sau', 'cao', 'tam_keo', 'ong']) if (k in o) { const v = num(q[k], NaN); if (isFinite(v) && v >= 0 && v < 3000) o[k] = rn(v, 1); }
      if (loai === 'chau' && (q.lap === 'am' || q.lap === 'duong')) o.lap = q.lap;
      if (loai === 'hm') { if (q.kieu === 'am' || q.kieu === 'kinh') o.kieu = q.kieu; if (q.lap === 'hop' || q.lap === 'keo') o.lap = q.lap; }
    }
    if (loai === 'tl') {      // (bản 1.34) hở quanh máy + cách toả nhiệt: giữ ở mọi mã (khai riêng cho từng khoang)
      // (bản 1.35) kiểu lắp: 'duong' đứng ngoài (khoang không đáy, không cánh) | 'am' lắp trong tủ cao bao (đáy, hậu, cánh ốp + ray dẫn cánh); hở mặc định theo kiểu
      o.kieu = q.kieu === 'am' || q.kieu === 'duong' ? q.kieu : o.kieu === 'am' ? 'am' : 'duong';
      const H0 = hoTL(o.kieu);
      for (const k of Object.keys(TL_HO)) { const v = num(q[k], NaN); o[k] = isFinite(v) && v >= 0 && v <= 300 ? rn(v, 1) : H0[k]; }
      if (q.tan_nhiet === '' || q.tan_nhiet === 'truoc' || q.tan_nhiet === 'hong') o.tan_nhiet = q.tan_nhiet; else if (!m) o.tan_nhiet = o.ma === 'tu_chon' ? '' : o.tan_nhiet || '';
      return o;
    }
    if (loai !== 'hm') { const v = num(q.cach_mep_truoc, NaN); if (isFinite(v) && v >= 0) o.cach_mep_truoc = rn(v, 1); }
    return o;
  }
  const CHUC_BEP = { duoi: ['canh', 'nk', 'xn', 'gv', 'gao', 'rac', 'chau', 'bep', 'ke', 'goc'], tren: ['canh', 'bat', 'hm', 'ke', 'goc'], cao: ['kho', 'canh', 'tl', 'lo'] };      // (1.34) + kệ hở, tủ góc mù, khoang tủ lạnh, tủ lò
  /**
   * (bản 1.34) Tủ góc mù chữ L — phụ kiện góc: Wg = rộng tủ góc dưới, c = cánh (phía hở), pk = mã rổ trong LOAI_PK_BEP. Mặc định Higold liên hoàn 900 / 400 (anh Thanh chốt 12/10/2026);
   * Eurogold liên hoàn 990 / 450 và mâm xoay lá Eurogold 900 / 450 là lựa chọn.
   */
  const GOC_BEP = {
    hg_lh: { ten: 'Higold liên hoàn — tủ góc 900, cánh 400', Wg: 900, c: 400, pk: 'goc_lh_hg' },
    eu_lh: { ten: 'Eurogold liên hoàn — tủ góc 990, cánh 450', Wg: 990, c: 450, pk: 'goc_lh_eu' },
    eu_la: { ten: 'Eurogold mâm xoay lá — tủ góc 900, cánh 450', Wg: 900, c: 450, pk: 'goc_la' },
  };
  const GOC_MAC_DINH = 'hg_lh';
  const VS_MAC_DINH = 380, HOC_LO = 590, TL_KE = 250;      // (bản 1.34) hốc vi sóng 380 (anh chốt; 460 = lò compact, 0 = không hốc); hốc lò 590 (hãng 585 – 595); ô trên tủ lạnh < 250 thì làm kệ hở [CĐ]
  /**
   * (bản 1.34) Số đo góc chữ L (hàm thuần): tủ góc mù thuộc cạnh A, phần mù chui sau đầu cạnh B; F = sâu phủ bì tủ dưới cạnh B (thùng + cánh + cách tường), N = nẹp góc.
   * X = F + N − (Wg − c − khe) = khoảng tủ góc cách tường B (X < 0: tủ góc quá rộng so với cánh). Tủ trên góc: mối nối trùng tủ dưới —
   * Wg_t = X + Wg − khe tường (20), c_t = X + Wg − (P_t + N_t + khe) với P_t = sâu phủ bì tủ trên.
   * @returns {{ pk, ten, pk_ma, Wg, c, mu, X, X_t, Wg_t, c_t, mu_t, F, P_t, N, N_t, loi: string[] }}
   */
  function gocBep(pk, opt) {
    opt = opt || {};
    const ma = GOC_BEP[pk] ? pk : GOC_MAC_DINH, G = GOC_BEP[ma], B = Object.assign({}, DEFAULT_BEP, opt.chuan && typeof opt.chuan === 'object' ? opt.chuan : {}), n = k => num(B[k], DEFAULT_BEP[k]);
    const tc = num(opt.tc, DEFAULT_SPEC.van.t_canh), khe = num(opt.khe, DEFAULT_SPEC.canh.khe), N = num(opt.nep, 50), Nt = num(opt.nep_tren, 50), Xt = num(opt.khe_tuong, 20);
    const F = rn(n('sau_duoi') + tc + n('cach_tuong')), Pt = rn(n('sau_tren') + tc), mu = rn(G.Wg - G.c - khe), X = rn(F + N - mu);
    const Wg_t = rn(X + G.Wg - Xt), c_t = rn(X + G.Wg - (Pt + Nt + khe)), loi = [];
    if (X < -TOL) loi.push(`Tủ góc ${g(G.Wg)} (cánh ${g(G.c)}): phần mù ${g(mu)} dài hơn sâu tủ cạnh kia + nẹp góc (${g(F)} + ${g(N)}) — tủ góc quá rộng so với cánh; chọn phụ kiện góc khác.`);
    return { pk: ma, ten: G.ten, pk_ma: G.pk, Wg: G.Wg, c: G.c, mu, X, X_t: Xt, Wg_t, c_t, mu_t: rn(Wg_t - c_t - khe), F, P_t: Pt, N, N_t: Nt, loi };
  }
  /** (bản 1.34) Tủ bếp được làm cỡ lẻ (bù dư của dãy): chỉ tủ cánh, kệ hở, tủ che ống hút mùi kính — rổ / ngăn kéo / thiết bị / góc có cỡ cố định của hãng. */
  function leDuocBep(spec) {
    const s = spec && spec.bep ? spec : normalize(spec), B = s.bep;
    if (!B) return false;
    return ((B.chuc_nang === 'canh' || B.chuc_nang === 'ke') && B.tang !== 'cao') || (B.chuc_nang === 'hm' && !!(B.tb && B.tb.hm && B.tb.hm.kieu === 'kinh'));
  }
  function normBep(s) {
    const B = s.bep = Object.assign({}, DEFAULT_BEP, s.bep && typeof s.bep === 'object' ? s.bep : {});
    B.tang = CHUC_BEP[B.tang] ? B.tang : DEFAULT_BEP.tang;
    B.chuc_nang = CHUC_BEP[B.tang].indexOf(B.chuc_nang) >= 0 ? B.chuc_nang : 'canh';
    B.ket_cau_chan = 'hoi_san';      // 'nhua' (chân nhựa + đáy phủ hồi) chưa đo lệnh LEFTRIGHTBOARD ở z > 0 — bản 1.34
    for (const k of Object.keys(SO_BEP)) { const v = num(B[k], DEFAULT_BEP[k]); B[k] = Math.max(SO_BEP[k][0], Math.min(SO_BEP[k][1], v)); }
    B.vien_da = num(B.vien_da, 0) ? 1 : 0;
    B.treo = 'thanh';      // cách (a) hậu lọt soi rãnh + ke treo + ray: bản 1.34 nếu anh chọn
    B.bep_loai = B.bep_loai === 'gas' ? 'gas' : 'tu';
    B.tay_nam = TAY_NAM_BEP.indexOf(B.tay_nam) >= 0 ? B.tay_nam : DEFAULT_BEP.tay_nam;
    B.van_chau = String(B.van_chau == null ? '' : B.van_chau).trim();
    // nóc: tủ chậu / bếp nấu luôn giằng; tủ trên, tủ cao luôn nóc liền; tủ dưới khác: giằng (1.33.1 mặc định) hoặc nóc liền (lựa chọn — lệnh gốc vẽ được)
    B.noc = B.chuc_nang === 'chau' || B.chuc_nang === 'bep' ? 'giang' : B.tang !== 'duoi' ? 'lien' : (B.noc === 'giang' || B.noc === 'lien' ? B.noc : (DEFAULT_BEP.noc === 'lien' ? 'lien' : 'giang'));
    // (bản vá 1.33.1) tủ dưới thường có ô ngăn kéo trên cùng loại KHÔNG hạ hộp được dưới giằng (không SLK / chia ô: hộp ray Blum, khay bàn phím, chia ô) → tự nóc liền,
    // `noc_tu` = tên loại (kiemBep ghi lý do). Hết ô như thế thì về giằng. Người dùng tự chọn Nóc (datBep) thì bỏ dấu — chọn liền là liền mãi; chọn giằng mà còn loại đó thì lại tự liền.
    if (B.tang === 'duoi' && B.chuc_nang !== 'chau' && B.chuc_nang !== 'bep') {
      const kh = nocTuLien(s);
      if (B.noc_tu) { if (kh) { B.noc = 'lien'; B.noc_tu = kh; } else { B.noc = 'giang'; delete B.noc_tu; } }
      else if (kh && B.noc === 'giang') { B.noc = 'lien'; B.noc_tu = kh; }
    } else delete B.noc_tu;
    B.pk = B.tang === 'tren' && LOAI_PK_BEP.some(p => p.ma === B.pk && p.lap === 'tren') ? B.pk : '';
    const tb = B.tb && typeof B.tb === 'object' ? B.tb : {}, W = s.rong;
    B.tb = {};
    if (B.chuc_nang === 'chau') B.tb.chau = tbBep('chau', tb.chau, W);
    if (B.chuc_nang === 'bep' || B.chuc_nang === 'hm') B.tb.bep = tbBep('bep', tb.bep, W);
    if (B.chuc_nang === 'hm') B.tb.hm = tbBep('hm', tb.hm, W);
    if (B.chuc_nang === 'tl') B.tb.tl = tbBep('tl', tb.tl, W);
    // (bản 1.34) khoá riêng theo chức năng: hốc vi sóng của tủ lò, phụ kiện góc của tủ góc — tủ khác không mang
    if (B.chuc_nang === 'lo') { const v = num(B.vs, VS_MAC_DINH); B.vs = [0, 380, 460].indexOf(v) >= 0 ? v : VS_MAC_DINH; } else delete B.vs;
    if (B.chuc_nang === 'goc') B.goc_pk = GOC_BEP[B.goc_pk] ? B.goc_pk : GOC_MAC_DINH; else delete B.goc_pk;
    if (B.chuc_nang !== 'tl') delete B.ke_tu;
    // (bản 1.35) khoá riêng của tủ trên trong dãy: tang2 = tầng trên kịch trần (đặt chồng lên đỉnh tầng dưới), kinh = cánh khung kính, led (+ led_nguon mm: tủ mang nguồn cho cả dãy)
    for (const k of ['tang2', 'kinh', 'led']) if (B.tang === 'tren' && num(B[k], 0)) B[k] = 1; else delete B[k];
    if (B.led && num(B.led_nguon, 0) > 0) B.led_nguon = rn(num(B.led_nguon, 0), 1); else delete B.led_nguon;
    // (vòng soát 1.35) ong_hm = Ø ống khói của máy hút mùi tủ dưới đi qua tủ tầng trên này (lỗ đáy + nóc, không đợt)
    if (B.tang2 && num(B.ong_hm, 0) > 0) B.ong_hm = rn(num(B.ong_hm, 0), 1); else delete B.ong_hm;
    // (bản 1.34) khoá DÃY: day = { ma bộ bếp, vt vị trí } (bảng ghi khi tự chia dãy); op = đầu dãy hở có tấm ốp hông; nep = nẹp bù / nẹp góc (đi bằng phào)
    if (B.day && typeof B.day === 'object' && String(B.day.ma == null ? '' : B.day.ma).trim()) B.day = { ma: String(B.day.ma).trim(), vt: String(B.day.vt == null ? '' : B.day.vt) }; else delete B.day;
    if (B.op !== 'trai' && B.op !== 'phai') delete B.op;
    // khung tủ bếp: một thân, không phào, không khấu cột, hồi chạy xuống sàn (build / keHoachGoc tự dựng kiểu 'lot' cho tủ bếp — KHÔNG ghi đè thung.noc_day:
    // đó là Chuẩn xưởng của tủ áo, ghi đè thì ghé một tủ bếp là mọi tủ áo sau đổi sang nóc / đáy lọt)
    // (bản 1.34) nẹp bù = PHÀO (mặt phẳng cánh + phụ trợ lùi), ốp hông = tấm dày cánh ở đầu hở: module = thùng + nẹp / ốp, thùng giữ cỡ chuẩn (rổ, ngăn kéo không lẻ).
    // nep.thung = bề rộng thùng ghi lần đầu; đổi Rộng của module (ô Thông số Chenfeng / heSo) thì nẹp phía `bu` (phải nếu có, không thì trái) co giãn theo, thùng đứng yên —
    // nẹp hết chỗ (< 0) thì thùng mới hẹp lại. nep.goc = phía nẹp góc chữ L (tủ dưới: phụ trợ đỡ đá chạy suốt sâu).
    const tc = s.van.t_canh;
    let pTr = B.op === 'trai' ? tc : 0, pPh = B.op === 'phai' ? tc : 0;
    if (B.nep && typeof B.nep === 'object') {
      const q = B.nep, v = k => Math.max(0, rn(num(q[k], 0), 1)), ne = { trai: B.op === 'trai' ? 0 : v('trai'), phai: B.op === 'phai' ? 0 : v('phai') };
      if (ne.trai > 0 || ne.phai > 0) {
        if (q.goc === 'trai' || q.goc === 'phai') ne.goc = q.goc;
        ne.bu = q.bu === 'trai' || q.bu === 'phai' ? q.bu : (ne.phai > 0 ? 'phai' : 'trai');
        const opW = pTr + pPh, th = num(q.thung, 0);
        if (th > 0) { const khac = ne.bu === 'phai' ? ne.trai : ne.phai; let bu = rn(s.rong - khac - opW - th); ne.thung = rn(th); if (bu < 0) { ne.thung = rn(th + bu); bu = 0; } ne[ne.bu] = bu; }
        else ne.thung = rn(s.rong - ne.trai - ne.phai - opW);
        B.nep = ne; pTr += ne.trai; pPh += ne.phai;
      } else delete B.nep;
    } else delete B.nep;
    s.phao = Object.assign({}, s.phao, { trai: rn(pTr), phai: rn(pPh), tren: 0 });
    s.than = Object.assign({}, s.than, { cao_duoi: 0 });
    s.khau = khongKhauSP(s);
    if (B.tang === 'tren') s.chan = Object.assign({}, s.chan, { cao: 0 }); else B.chan = s.chan.cao;
    // cao_rieng = chiều cao RIÊNG của module (mẫu H700 / H900, tủ cao gõ Cao khác tổng chuẩn) — không thuộc KHOA_CHUAN_BEP nên không thành chuẩn cho mẫu sau / không lưu vào mncf.bep.v1
    const cr = num(B.cao_rieng, 0); delete B.cao_rieng;
    if (B.tang === 'duoi') { B.cao_mat = rn(s.cao + B.day_da + B.van_lot); B.sau_duoi = s.sau_thung; }
    // (bản vá 1.33.1) tủ che ống hút mùi kính luôn mang chiều cao RIÊNG (đáy nâng theo cao_tren − cao): gõ Cao chỉ đổi tủ này, không đổi chuẩn Cao tủ trên
    else if (B.tang === 'tren') { if (cr > 0 || B.tang2 || (B.chuc_nang === 'hm' && B.tb.hm && B.tb.hm.kieu === 'kinh')) B.cao_rieng = s.cao; else B.cao_tren = s.cao; B.sau_tren = s.sau_thung; }
    else { if (Math.abs(s.cao - (B.cao_mat + B.cach_tren + B.cao_tren)) > TOL) B.cao_rieng = s.cao; B.sau_cao = s.sau_thung; }
    // (bản vá 1.33.1) dấu chuẩn cũ chỉ giữ cho khoá còn đúng mặc định cũ (mặt đá tính ngược ở trên — gõ Cao khác là đã chọn)
    if ('chuan_cu' in B) { const cc = Array.isArray(B.chuan_cu) ? B.chuan_cu.filter((k, i, a) => k in MAC_DINH_BEP_CU && a.indexOf(k) === i && B[k] === MAC_DINH_BEP_CU[k]) : []; if (cc.length) B.chuan_cu = cc; else delete B.chuan_cu; }
    // khoang có rổ: không hộc kéo âm (vách đệm / nẹp làm hẹp lọt lòng rổ)
    for (const k of s.khoang) if (k.o.some(c => c.kieu === 'keo_pk')) k.o = k.o.filter(c => c.kieu !== 'nk_am');
    ruotBep(s, B);
    return B;
  }
  /**
   * (bản 1.34) Ruột CỐ ĐỊNH theo thiết bị — dựng lại mỗi lần normalize (đổi chuẩn bếp / máy / hốc vi sóng là ruột theo ngay; số người dùng gõ là của thiết bị, không của đợt):
   *   tl  khoang tủ lạnh: hốc từ sàn tới đợt = cao máy + hở trên; ô trên cánh (lọt < TL_KE thì kệ hở, ke_tu = tự bỏ cánh)
   *   lo  tủ lò: 2 ngăn kéo | đợt đỡ lò (mặt trên = mặt đá) | hốc lò 590 | đợt | hốc vi sóng `vs` | đợt | ô cánh
   *   goc tủ góc mù dưới: một khoang, tấm che mù rộng (Wg − c − khe) phía mù, một cánh c phía hở (bản lề phía ngoài [CĐ]), rổ góc cả lọt lòng
   */
  function ruotBep(s, B) {
    const goc = B.chuc_nang === 'goc' && B.tang === 'duoi';
    if (B.chuc_nang !== 'lo' && B.chuc_nang !== 'tl' && !goc) return;
    const t = s.van.t, k0 = Object.assign({ canh: 1, ban_le: 'trai' }, s.khoang[0] || {}, { rong: 'auto' });
    if (B.chuc_nang === 'lo') {
      const cm = B.cao_mat, zLo = rn(cm + HOC_LO);
      k0.dot = [rn(cm - t), zLo]; k0.o = [{ tu: 0, kieu: 'nk_trum', so: 2 }, { tu: rn(cm - t), kieu: 'hoc', tb: 'lo', hau: false, san: false }];
      if (B.vs > 0) { k0.dot.push(rn(zLo + t + B.vs)); k0.o.push({ tu: zLo, kieu: 'hoc', tb: 'vs', hau: false, san: false }); }
    } else if (B.chuc_nang === 'tl' && B.tb.tl.kieu === 'am') {
      // (bản 1.35) TỦ LẠNH ÂM: tủ cao bao quanh có đáy + chân + hậu; hốc từ mặt trên đáy tới đợt = cao máy + hở trên; cánh ốp phủ hốc (gắn vào cánh máy qua ray dẫn cánh),
      // ô trên cánh riêng. Số cánh theo máy: rộng > 650 (side-by-side âm) thì 2 [CĐ]
      const tl = B.tb.tl, z0 = rn(num(s.chan && s.chan.cao, 0) + t), z = Math.min(rn(z0 + tl.cao + tl.ho_tren), rn(s.cao - 2 * t - 100));
      k0.dot = [z]; k0.o = [{ tu: 0, kieu: 'hoc', tb: 'tl', hau: true, san: false }];
      k0.canh = tl.rong > 650 ? 2 : 1; delete B.ke_tu;
    } else if (B.chuc_nang === 'tl') {
      const tl = B.tb.tl, z = Math.min(rn(tl.cao + tl.ho_tren), rn(s.cao - 2 * t - 30)), tren = rn(s.cao - t - (z + t));
      k0.dot = [z]; k0.o = [{ tu: 0, kieu: 'hoc', tb: 'tl', hau: false, san: true }];
      if (tren < TL_KE - TOL) { if (k0.canh > 0) { k0.canh = 0; B.ke_tu = 1; } }
      else if (B.ke_tu) { k0.canh = s.rong > 500 ? 2 : 1; delete B.ke_tu; }
    } else {
      const G = GOC_BEP[B.goc_pk], ben = k0.mu && k0.mu.ben === 'phai' ? 'phai' : 'trai';
      k0.canh = 1; k0.ban_le = ben === 'trai' ? 'phai' : 'trai'; k0.mu = { ben, rong: rn(s.rong - G.c - s.canh.khe) };
      k0.dot = []; k0.o = [{ tu: 0, kieu: 'keo_pk', pk: [G.pk], so: 1 }];
    }
    s.khoang = [k0];
  }
  /** (bản vá 1.33.1) Tên loại ngăn kéo của ô TRÊN CÙNG một khoang (sát giằng) mà hộp không hạ được dưới giằng (không có SLK, hay chia ô: hộp = mặt); '' = không có. */
  function nocTuLien(s) {
    const nk = s.ngan_keo || DEFAULT_SPEC.ngan_keo;
    for (const kh of s.khoang || []) {
      const dot = Array.isArray(kh.dot) ? kh.dot : [];
      for (const c of kh.o || []) {
        if (c.kieu !== 'nk_trum' && c.kieu !== 'nk_am') continue;
        if (dot.some(z => z > num(c.tu, 0) + TOL)) continue;      // có đợt phía trên: ô không sát giằng
        const lo = (nk.loai || []).find(x => x.ma === (c.loai || nk.mac_dinh));
        if (lo && !(typeof lo.ts.SLK === 'number' && !('CMG' in lo.ts))) return lo.ten;
      }
    }
    return '';
  }
  /** Kích thước module theo chuẩn bếp + tầng (ngược với normBep): tủ dưới cao = mặt đá − đá − ván lót, tủ trên cao = cao_tren, tủ cao = tới đỉnh tủ trên. */
  function kichBep(s) {
    const B = Object.assign({}, DEFAULT_BEP, s.bep && typeof s.bep === 'object' ? s.bep : {}), n = k => num(B[k], DEFAULT_BEP[k]);
    const cr = num(B.cao_rieng, 0);
    if (B.tang === 'tren') { s.cao = cr > 0 ? cr : n('cao_tren'); s.sau_thung = n('sau_tren'); s.chan = Object.assign({}, s.chan, { cao: 0 }); }
    else if (B.tang === 'cao') { s.cao = cr > 0 ? cr : rn(n('cao_mat') + n('cach_tren') + n('cao_tren')); s.sau_thung = n('sau_cao'); s.chan = Object.assign({}, s.chan, { cao: n('chan') }); }
    else { s.cao = rn(n('cao_mat') - n('day_da') - n('van_lot')); s.sau_thung = n('sau_duoi'); s.chan = Object.assign({}, s.chan, { cao: n('chan') }); }
    return s;
  }
  /** Đổi chuẩn bếp / khoá bếp của một module (vd { cao_mat: 860 }, { tang: 'tren' }) rồi tính lại kích thước module theo chuẩn mới. @returns spec đã normalize */
  function datBep(spec, doi) {
    const s = clone(spec || {}); s.loai_sp = 'bep'; doi = doi || {};
    const B = s.bep = Object.assign({}, s.bep && typeof s.bep === 'object' ? s.bep : {}, doi);
    if (Array.isArray(B.chuan_cu)) { B.chuan_cu = B.chuan_cu.filter(k => !(k in doi)); if (!B.chuan_cu.length) delete B.chuan_cu; }      // gõ lại khoá đó = người dùng đã chọn
    if ('noc' in doi) delete B.noc_tu;      // người dùng tự chọn nóc: không còn là nóc liền tự đặt
    // (bản vá 1.33.1) tủ trên hút mùi đổi máy âm → máy kính: thành tủ che ống (cao riêng CAO_CHE_ONG, thẳng đỉnh dãy — như mẫu BT-HMK); kính → âm: về cao tủ trên chuẩn
    if ('tb' in doi && (B.tang || DEFAULT_BEP.tang) === 'tren' && B.chuc_nang === 'hm') {
      const kinh = q => !!(q && q.hm && tbBep('hm', q.hm, num(s.rong, 0)).kieu === 'kinh'), truoc = kinh(spec && spec.bep && spec.bep.tb), sau = kinh(B.tb);
      if (sau && !truoc) B.cao_rieng = CAO_CHE_ONG; else if (truoc && !sau) delete B.cao_rieng;
    }
    // số gõ ngoài khoảng: kẹp TRƯỚC khi tính kích thước (kẹp sau thì module tính theo số chưa kẹp, normBep lại tính ngược mặt đá… lệch với ô)
    for (const k of Object.keys(doi)) if (SO_BEP[k]) B[k] = Math.max(SO_BEP[k][0], Math.min(SO_BEP[k][1], num(B[k], DEFAULT_BEP[k])));
    // chiều cao riêng của module chỉ bỏ khi đổi đúng số quyết định chiều cao (tủ trên: cao tủ trên; tủ cao: mặt đá + cách mặt đá + cao tủ trên) hoặc đổi tầng
    if ((B.tang === 'tren' ? ['cao_tren', 'tang'] : ['cao_mat', 'cach_tren', 'cao_tren', 'tang']).some(k => k in doi)) delete B.cao_rieng;
    const t = num(s.van && s.van.t, DEFAULT_SPEC.van.t), k0 = { chan: num(s.chan && s.chan.cao, NaN), t };
    const out = normalize(kichBep(s)), k1 = { chan: out.chan.cao, t };
    // (1.33, vòng soát 3) tủ đồ khô: đợt trên ô rổ tính theo CHÂN lúc áp mẫu (chừa đúng chỗ rổ) — đổi chân thì tính lại như áp mẫu lại; đợt người dùng đã dời
    // (khác số áp mẫu cũ) mà vẫn đủ chỗ thì giữ, thiếu chỗ thì nâng lên đúng số cần
    for (const kh of out.khoang || []) {
      const o = (kh.o || [])[0], ma = o && kh.o.length === 1 && o.kieu === 'keo_pk' && (o.tu || 0) === 0 && Array.isArray(o.pk) && o.pk.length === 1 ? o.pk[0] : '';
      if ((ma !== 'kho' && ma !== 'kho_canh') || !Array.isArray(kh.dot) || kh.dot.length !== 1) continue;
      // (vòng soát 4) chỉ khi CHÂN đổi (datBep chạy cho mọi ô của khối Tủ bếp); "đủ chỗ" = ô ≥ cao_min của rổ (không phải số làm tròn của mẫu)
      if (k0.chan === k1.chan) continue;
      const z1 = zKho(ma, k1), du = k1.chan + t + LOAI_PK_BEP.find(x => x.ma === ma).cao_min;
      if (kh.dot[0] === zKho(ma, k0) || kh.dot[0] < du - TOL) kh.dot = [z1];
    }
    return out;
  }
  /**
   * (1.33.1) Chuẩn bếp đã lưu ở máy (localStorage mncf.bep.v1) → chuẩn để áp. Bản lưu trước 1.33.1 (không có `ban` hoặc ban cũ hơn) mà số đúng bằng mặc định CŨ
   * (MAC_DINH_BEP_CU: mặt đá 850, tay nắm nổi) thì coi như người dùng chưa chọn → bỏ, nhận mặc định mới; số người dùng tự đổi thì giữ. Chỉ giữ khoá chuẩn bếp.
   * @returns {{ chuan: object, luu: object (chuan + ban: VERSION — ghi lại vào máy), doi: string[] (khoá đã bỏ) }}
   */
  function nangChuanBep(o) {
    const soBan = v => { const m = /^(\d+)\.(\d+)(?:\.(\d+))?/.exec(String(v == null ? '' : v)); return m ? (+m[1]) * 1e6 + (+m[2]) * 1e3 + (+(m[3] || 0)) : NaN; };
    o = o && typeof o === 'object' && !Array.isArray(o) ? o : {};
    const cu = !(soBan(o.ban) >= soBan('1.33.1')), chuan = {}, doi = [];
    for (const k of KHOA_CHUAN_BEP) if (k in o) { if (cu && k in MAC_DINH_BEP_CU && o[k] === MAC_DINH_BEP_CU[k]) doi.push(k); else chuan[k] = o[k]; }
    // (bản vá 1.33.1) bản lưu cũ không ghi khoá đó = lúc ấy đang theo mặc định cũ → nay đổi sang mặc định mới: cũng là "đã đổi" (để báo)
    if (cu && KHOA_CHUAN_BEP.some(k => k in o)) for (const k of Object.keys(MAC_DINH_BEP_CU)) if (!(k in chuan) && doi.indexOf(k) < 0) doi.push(k);
    return { chuan, luu: Object.assign({}, chuan, { ban: VERSION }), doi };
  }
  const MUC_KIEM_BEP = MUC_KIEM.concat([{ ma: 'bep', ten: 'Phụ kiện, thiết bị bếp (rổ, chậu, bếp nấu, hút mùi)' }]);
  /**
   * Phép kiểm tủ bếp (hàm thuần, chạy trong build khi có s.bep — dòng báo mang mã mục 'bep'). Dùng M.info.bep (build ghi) + M.da.
   * LỖI: lọt lòng ngoài dải rổ, rổ thiếu sâu / cao, chậu / bếp không lọt, khoét đá chạm giằng, hút mùi không lọt, giá bát nâng hạ trong thùng thấp, rổ / hộp ngăn kéo vướng giằng.
   * CẢNH BÁO: tủ không đúng cỡ hãng, khoét chậu sát hồi, rổ / hộp cao quá dưới bếp âm, hút mùi hẹp hơn bếp, hút mùi gần mặt bếp, đua đá thiếu.
   */
  function kiemBep(M, bao) {
    bao = bao || baoCua(M);
    const s = M.spec, B = s.bep, I = M.info.bep, W = s.rong, t = s.van.t;
    if (!B || !I) return M;
    const err = m => bao.err(m, 'bep'), warn = m => bao.warn(m, 'bep'), note = m => bao.note(m, 'bep'), lot = I.lot;
    const PK = ma => LOAI_PK_BEP.find(x => x.ma === ma), daCo = new Set();
    // (1.33, vòng soát) cỡ rổ theo KHOANG chứa nó (lọt lòng + 2 ván), không theo cả module — tủ chia khoang thì rổ đặt trong một khoang
    const kiemPK = (ma, lt, sau, cao, cho) => {
      const p = PK(ma); if (!p) return;
      const Wk = coKhoang(lt, W, t), ten = Wk === W ? 'tủ' : 'khoang', co = coPK(p, Wk), [a, b] = p.lot(co);
      if (co !== Wk && !daCo.has(ma)) { daCo.add(ma); warn(`${p.ten}: ${ten} rộng ${g(Wk)} không có trong các cỡ của hãng (${p.co.map(g).join(' / ')}) — tính theo rổ cỡ ${g(co)}.`); }
      const goi = co !== Wk ? ` Đặt ${ten} rộng ${g(co)}.` : ` Dùng ván thùng ${g(rn((co - (a + b) / 2) / 2, 2))} (lọt = rộng − 2 × ván).`;
      if (lt < a - TOL) err(`${p.ten} cỡ ${g(co)} cần lọt lòng ${g(a)} – ${g(b)}, ${ten} chỉ lọt ${g(lt)} (rộng ${g(Wk)}, ván ${g(t)}) — rổ không lọt.${goi}`);
      else if (lt > b + TOL) err(`${p.ten} cỡ ${g(co)} cần lọt lòng ${g(a)} – ${g(b)}, ${ten} lọt ${g(lt)} (rộng ${g(Wk)}, ván ${g(t)}) — rổ hẹp hơn lọt lòng, ray không bắt khít hồi.${goi}`);
      if (sau < p.sau_min - TOL) err(`${p.ten}: sâu lọt lòng ${g(sau)} < ${g(p.sau_min)} rổ cần — tăng sâu tủ.`);
      else if (p.sau_tu && s.sau_thung < p.sau_tu - TOL) err(`${p.ten}: tủ sâu ${g(s.sau_thung)} < ${g(p.sau_tu)} hãng cần — tăng sâu tủ.`);
      if (cao < p.cao_min - TOL) err(`${p.ten}: ${cho} cao ${g(cao)} < ${g(p.cao_min)} rổ cần.`);
      else if (p.cao_max && cao > p.cao_max + TOL) warn(`${p.ten}: ${cho} cao ${g(cao)} > ${g(p.cao_max)} — khung rổ chỉnh cao không với tới, thêm / hạ đợt phía trên.`);
    };
    // (vòng soát 3) đỉnh rổ (z0 + cao_ro) không được vượt ô của nó (lấn vào rổ / đợt bên trên) — chỉ báo khi ô chưa bị báo thiếu cao (cao_min đã ≥ cao_ro + 10 với rổ kéo)
    for (const r of I.ro) {
      const nLoi = M.errors.length; kiemPK(r.pk, r.lot, r.sau, rn(r.z1 - r.z0), 'chỗ đặt rổ');
      const p = PK(r.pk), top = p ? rn(r.z0 + p.cao_ro) : 0;
      if (p && M.errors.length === nLoi && top > r.z1 + TOL) err(`${p.ten} cao tới +${g(top)} (rổ cao ${g(p.cao_ro)}), vượt ô của nó (+${g(r.z0)} … +${g(r.z1)}) — lấn vào phía trên; nới ô hoặc chọn rổ thấp hơn.`);
    }
    if (B.pk) kiemPK(B.pk, lot, I.sau_lot_treo, s.cao, 'thùng');
    // rổ / hộp ngăn kéo kéo ra phải lọt dưới giằng trước; tủ bếp nấu: thấp hơn đỉnh thùng nk_cach_bep (thân bếp âm thò xuống 55 – 70)
    const hop = I.ro.map(r => ({ ten: PK(r.pk).ten, top: rn(r.z0 + PK(r.pk).cao_ro) }));
    // (vòng soát 3) đỉnh hộp ngăn kéo theo mô hình mặt / hộp của lõi: mép trên mặt = pos + box + SYS, hộp thấp hơn mép trên mặt SLK (của mẫu đó — ô dưới giằng ghi SLK riêng); chia ô: hộp = mặt
    for (const tp of M.templates) if (tp.loai === 'NGAN_KEO') {
      const lo = s.ngan_keo.loai.find(x => x.ma === tp.ma_loai), p = tp.params || {}, sys = typeof p.SYS === 'number' ? p.SYS : 0;
      const slk = lo && 'CMG' in lo.ts ? 0 : typeof p.SLK === 'number' ? p.SLK : lo && typeof lo.ts.SLK === 'number' ? lo.ts.SLK : 0;
      hop.push({ ten: 'Hộp ngăn kéo', top: rn(tp.pos[2] + tp.box[2] + sys - slk) });
    }
    const daBaoTop = new Set();
    for (const h of hop) {
      if (daBaoTop.has(h.ten)) continue;
      if (I.giang && h.top > I.giang.z0 + TOL) { daBaoTop.add(h.ten); err(`${h.ten} cao tới +${g(h.top)}, vướng giằng trước (mặt dưới giằng +${g(I.giang.z0)}) khi kéo ra — hạ ngăn / chọn rổ thấp hơn.`); }
      else if (B.chuc_nang === 'bep' && h.top > s.cao - B.nk_cach_bep + TOL) { daBaoTop.add(h.ten); warn(`${h.ten} cao tới +${g(h.top)}: dưới bếp âm phải thấp hơn đỉnh thùng ${g(B.nk_cach_bep)} (thân bếp thò xuống) — hạ ngăn trên cùng.`); }
    }
    // (vòng soát 2) chậu / bếp / hút mùi đặt GIỮA module (khoét đá x = W/2): kiểm theo khoang nằm dưới tâm — chỗ đối xứng quanh tâm còn lọt trong khoang đó
    // (tủ nhiều khoang: lỗ khoét / thân máy đè lên vách giữa là lỗi, không lấy khoang rộng nhất). Gợi ý "chuyển sang tủ N" chỉ khi N lớn hơn tủ đang có.
    // (vòng soát 1.34) tâm + bề rộng THÙNG (bỏ phào / ốp hai đầu): tủ đầu dãy mang nẹp — chậu / bếp đặt giữa thùng, không giữa module
    const pT = s.phao.trai || 0, Wt = rn(W - pT - (s.phao.phai || 0)), xm = rn(pT + Wt / 2), dsK = I.khoang || [[pT + t, pT + Wt - t]], kc = dsK.find(([a, b]) => a <= xm + TOL && b >= xm - TOL);
    const choTB = kc ? rn(2 * Math.min(xm - kc[0], kc[1] - xm)) : 0, lotMot = rn(Wt - 2 * t);
    const khongLot = (ten, can, tb, loai, khiKhong) => {
      if (!kc) return `${ten} đặt giữa tủ (x ${g(xm)}) đè lên vách giữa hai khoang — gộp khoang (bỏ vách) hoặc dời vách khỏi giữa tủ.`;
      if (dsK.length > 1 && can <= lotMot + TOL) return `${ten} cần lọt lòng ≥ ${g(can)} quanh giữa tủ, khoang ${dsK.indexOf(kc) + 1} chỉ chừa ${g(choTB)} — đè lên vách khoang; gộp khoang (bỏ vách) hoặc dời vách.`;
      const n = coTuChoTB(Object.assign({ loai }, tb), { t, tren: Wt });
      return `${ten} cần lọt lòng ≥ ${g(can)}, tủ ${g(Wt)} chỉ lọt ${g(choTB)}${n ? ` — chuyển sang tủ ${g(n)}` : khiKhong ? ` — ${khiKhong}` : ''}.`;
    };
    // chậu: dương — thân chậu dưới đá cấn hồi (so khoét); âm — phủ bì + tai kẹp cấn hồi (so phủ bì)
    const c = B.chuc_nang === 'chau' && B.tb.chau;
    if (c) {
      const am = c.lap === 'am', can = am ? c.phu_bi[0] + 2 * KHE_CHAU : c.khoet[0] + KHE_CHAU;
      if (can > choTB + TOL) err(khongLot(`Chậu ${am ? `lắp âm phủ bì ${g(c.phu_bi[0])}` : `lắp dương khoét ${g(c.khoet[0])}`}`, can, c, 'chau'));
      else if (!am && c.khoet[0] > choTB - 2 * KHE_CHAU + TOL) warn(`Khoét chậu ${g(c.khoet[0])} sát hồi (lọt ${g(choTB)}): thân chậu cách mỗi hồi chưa tới ${g(KHE_CHAU)} — khó lắp ống, si phông.`);
    }
    const tbB = B.chuc_nang === 'bep' && B.tb.bep;
    if (tbB && tbB.khoet[0] > choTB + TOL) err(khongLot(`Bếp khoét ${g(tbB.khoet[0])}`, tbB.khoet[0], tbB, 'bep'));
    // khoét đá theo y THẬT của lỗ (không theo kiểu giằng): mép trước / sau lỗ (chậu âm: mép vành) không đè lên giằng
    for (const k of (M.da && M.da.khoet) || []) {
      const ten = k.loai === 'chau' ? 'chậu' : 'bếp', vanh = k.lap === 'am' ? VANH_AM : 0, truoc = rn(k.y0 - vanh), sau = rn(k.y1 + vanh), cach = rn(k.y0 - M.da.y0);
      if (cach < DA_TRUOC_MIN - TOL) err(`Khoét ${ten} cách mép trước đá ${g(cach)} (< ${DA_TRUOC_MIN}) — dải đá trước lỗ khoét mỏng, dễ nứt.`);
      if (I.giang && truoc < I.giang.truoc + 5 - TOL) err(`Khoét ${ten} cách mép trước đá ${g(cach)}: mép ${vanh ? 'vành ' : ''}lỗ ở y ${g(truoc)} đè lên giằng trước (mặt sau giằng ở y ${g(I.giang.truoc)}) — lùi lỗ khoét vào.`);
      if (I.giang && sau > I.giang.sau - 5 + TOL) err(`Khoét ${ten}: mép sau ${vanh ? 'vành ' : ''}lỗ ở y ${g(sau)} đè lên giằng sau (mặt trước giằng ở y ${g(I.giang.sau)}) — dời lỗ khoét ra trước hoặc chọn ${ten} nông hơn.`);
    }
    // hút mùi âm loại hộp (máy bắt vào đáy khoét); (1.33.1) hút mùi kính vát áp tường: tủ phía trên là tủ che ống
    const h = B.chuc_nang === 'hm' && B.tb.hm;
    if (h) {
      const treo = M.parts.find(p => p.loai === 'TREO'), r = (h.ong + 10) / 2, sauLo = (treo ? treo.y0 : s.sau_thung) - 10, choLo = rn(sauLo - 10);
      // (vòng soát 2) lỗ ống khói trên nóc phải nằm giữa mép trước nóc và mặt trước thanh treo (chừa 10 mỗi bên) — trước đây kẹp tâm trước rồi mới kiểm nên không bao giờ báo
      const kiemLo = () => { if (2 * r > choLo + TOL) err(`Lỗ ống khói Ø${g(h.ong + 10)} trên nóc cần ${g(2 * r)} giữa mép trước nóc và ${treo ? 'thanh treo' : 'mép sau'}, tủ trên chỉ chừa ${g(choLo)} — tăng sâu tủ trên hoặc chọn ống nhỏ hơn.`); };
      const gas = B.bep_loai === 'gas', can = gas ? B.cach_hm_gas : B.cach_hm_tu;
      if (h.kieu === 'kinh') {
        // máy treo tường dưới tủ che ống: khoảng trống dưới tủ (từ mặt kính bếp) phải đủ khoảng cách tối thiểu + thân máy — không thì đỉnh máy cao hơn đáy tủ
        const Q = I.hm || {}, zd = I.z_dat, dinhRow = rn(zd + s.cao), mk = Q.mat_bep, trong = rn(zd - mk), canTrong = rn(can + h.cao);
        if (B.tang !== 'tren') err('Máy hút mùi kính vát chỉ đi với tủ che ống (tủ trên) — tủ này không phải tủ trên.');
        else if (trong < canTrong - TOL) err(`Máy hút mùi kính thân cao ${g(h.cao)}: đáy máy cách mặt kính bếp ≥ ${g(can)} (bếp ${gas ? 'gas' : 'từ'}) thì đỉnh máy ở +${g(rn(mk + canTrong))}, tủ che ống đáy +${g(zd)} thấp hơn đỉnh máy — khoảng trống dưới tủ chỉ ${g(trong)} < ${g(canTrong)} (khoảng cách + thân máy). Giảm Cao của tủ này (ô Cao — chỉ tủ này, chuẩn Cao tủ trên giữ nguyên) còn ≤ ${g(Math.max(0, rn(dinhRow - mk - canTrong)))}.`);      // (soát 1.33.1 v2) tủ hút mùi kính luôn là tủ che ống (normBep) — không khuyên "chọn mẫu BT-HMK"
        else if (Q.dinh < zd - TOL) note(`Máy hút mùi kính treo cách mặt kính bếp ${g(Q.cach)} (tối đa ${g(Q.max)}): ống khói lộ ${g(rn(zd - Q.dinh))} giữa đỉnh máy (+${g(Q.dinh)}) và đáy tủ che ống (+${g(zd)}) — ống khói của máy che phần này.`);
        kiemLo();
      } else {
        if (h.lap === 'keo') err('Hút mùi âm loại kéo (máy bắt hai hồi, tủ không đáy) chưa làm ở bản này — chọn loại hộp (máy bắt vào đáy khoét).');
        if (h.rong + 10 > choTB + TOL) err(khongLot(`Máy hút mùi âm rộng ${g(h.rong)}`, h.rong + 10, h, 'hm', 'dùng máy kính vát (tủ che ống)'));
        if (h.sau + 10 > I.sau_lot + TOL) err(`Máy hút mùi sâu ${g(h.sau)} cần lọt sâu ≥ ${g(h.sau + 10)}, tủ chỉ sâu ${g(I.sau_lot)} — tăng sâu tủ trên.`);
        kiemLo();
      }
      const tb = B.tb.bep;
      if (tb && h.rong < tb.phu_bi[0] - 50 - TOL) warn(`Máy hút mùi rộng ${g(h.rong)} hẹp hơn bếp ${g(tb.phu_bi[0])} quá 50 — khói tràn hai bên.`);
      if (h.kieu !== 'kinh') {
        const cach = rn(B.cach_tren - 5 - B.canh_trum_duoi);      // mặt kính bếp ≈ mặt đá + 5 [CĐ]
        if (cach < can - TOL) warn(`Đáy máy hút mùi cách mặt kính bếp ${g(cach)} < ${g(can)} (bếp ${gas ? 'gas' : 'từ'})${gas ? ' — bếp gas: đặt tủ trên cách mặt đá 750' : ''}.`);
        note('Cánh tủ hút mùi: dừng trên tấm kéo của máy, hoặc dán mặt gỗ vào tấm kéo — xưởng chốt khi có máy.');
      }
    }
    // (bản 1.34) KHOANG TỦ LẠNH: lọt ≥ máy + 2 × 10; hở hông < 50 thì phải khai cách toả nhiệt; hốc ≥ cao máy + hở trên; ô trên < 250 là kệ hở
    const tl = B.chuc_nang === 'tl' && B.tb.tl;
    if (tl) {
      const hoc = (I.hoc || []).find(x => x.tb === 'tl'), ho = rn((lot - tl.rong) / 2), dung = rn(tl.rong + 2 * tl.ho_hong + 2 * t);
      const am = tl.kieu === 'am', hoMin = am ? Math.min(TL_HO_MIN, tl.ho_hong) : TL_HO_MIN;
      if (lot < tl.rong + 2 * hoMin - TOL) err(`Khoang tủ lạnh lọt ${g(lot)} < máy ${g(tl.rong)} + 2 × ${TL_HO_MIN} — tủ lạnh không vào; đặt rộng khoang ${g(dung)} (máy + 2 × hở hông ${g(tl.ho_hong)} + 2 hồi).`);
      else if (am) { /* (bản 1.35) máy âm: thoát nhiệt theo catalogue máy (khe chân / nóc), không theo hở hông */ }
      else if (ho < 50 - TOL && !tl.tan_nhiet) warn(`Tủ lạnh hở mỗi hông ${g(ho)} (< 50) mà chưa khai máy toả nhiệt mặt trước hay hai hông — máy toả nhiệt hông (tủ 1 – 2 cánh đời cũ) cần ≥ 50 mỗi bên; khai ở ô Tủ lạnh.`);
      else if (ho < 50 - TOL && tl.tan_nhiet === 'hong') warn(`Tủ lạnh toả nhiệt hai hông cần hở mỗi bên ≥ 50, khoang chỉ chừa ${g(ho)} — đặt rộng khoang ${g(rn(tl.rong + 100 + 2 * t))}.`);
      if (!am && hoc && hoc.z1 < tl.cao + tl.ho_tren - TOL) err(`Hốc tủ lạnh cao ${g(hoc.z1)} < máy ${g(tl.cao)} + hở trên ${g(tl.ho_tren)} = ${g(rn(tl.cao + tl.ho_tren))} — tăng Cao tủ hoặc gõ đúng máy thấp hơn.`);
      const k0 = s.khoang[0], d0 = (k0.dot || [])[0], tren = d0 !== undefined ? rn(s.cao - t - (d0 + t)) : 0;
      if (!k0.canh && tren < TL_KE - TOL) warn(`Ô trên tủ lạnh chỉ cao ${g(tren)} (< ${TL_KE}): làm kệ hở, không cánh.`);
      if (am) {
        // (bản 1.35) máy âm nằm TRONG tủ cao: cánh ốp đóng được thì máy + hở sau phải lọt sâu (tới hậu); hốc cao tính từ mặt trên đáy
        const sl = hoc ? hoc.sau : I.sau_lot, z0 = hoc ? hoc.z0 : 0;
        if (tl.sau + tl.ho_sau > sl + TOL) err(`Tủ lạnh âm sâu ${g(tl.sau)} + hở sau ${g(tl.ho_sau)} > lọt sâu ${g(sl)} của tủ cao — cánh ốp không đóng được; tăng Sâu tủ cao hoặc gõ đúng máy.`);
        if (hoc && rn(hoc.z1 - z0) < tl.cao + tl.ho_tren - TOL) err(`Hốc tủ lạnh âm cao ${g(rn(hoc.z1 - z0))} < máy ${g(tl.cao)} + hở trên ${g(tl.ho_tren)} — tăng Cao tủ.`);
        note(`Tủ lạnh âm: tủ cao bao quanh có đáy + hậu, cánh ốp cùng màu gắn vào cánh máy qua bộ ray dẫn cánh; hở ${g(tl.ho_hong)} mỗi hông, ${g(tl.ho_tren)} trên — kiểm catalogue máy âm (kích thước hốc, khe thoát nhiệt chân / nóc, bản lề máy) trước khi cắt [CĐ].`);
      } else {
        const nho = rn(tl.sau + tl.ho_sau - (s.sau_thung + s.van.t_canh + B.cach_tuong));
        if (nho > 0) note(`Tủ lạnh sâu ${g(tl.sau)} + hở sau ${g(tl.ho_sau)}: mặt cánh tủ lạnh nhô ${g(nho)} trước mặt cánh dãy — để vậy, không làm hồi sâu theo máy.`);
        note('Khoang tủ lạnh không đáy, không xà chân, không giằng chân: hai hồi cao bắt ke L xuống sàn, ô trên bắt vít nở vào tường qua thanh treo (anh chốt 12/10/2026).');
      }
    }
    // (bản 1.34) HỐC LÒ / VI SÓNG âm tủ 60: lọt rộng 560 – 568, sâu ≥ 550, hốc lò cao ≥ 585 (Bosch / Siemens / Hafele)
    { const daBao = new Set();
      for (const x of I.hoc || []) if (x.tb === 'lo' || x.tb === 'vs') {
        const ten = x.tb === 'lo' ? 'Hốc lò' : 'Hốc vi sóng', cao = rn(x.z1 - x.z0);
        if ((x.lot < HOC_LO_RONG[0] - TOL || x.lot > HOC_LO_RONG[1] + TOL) && !daBao.has('r')) { daBao.add('r'); err(`${ten} lọt rộng ${g(x.lot)} ngoài ${HOC_LO_RONG[0]} – ${HOC_LO_RONG[1]} (hốc lò / vi sóng âm 60 của hãng) — ván ${g(t)}: ${x.lot < HOC_LO_RONG[0] ? 'tủ rộng hơn hoặc ván mỏng hơn' : 'tủ hẹp hơn hoặc ván dày hơn'}.`); }
        if (x.sau < HOC_LO_SAU - TOL && !daBao.has('s')) { daBao.add('s'); err(`${ten} sâu lọt ${g(x.sau)} < ${HOC_LO_SAU} hãng cần — tăng sâu tủ.`); }
        if (x.tb === 'lo' && cao < 585 - TOL) err(`Hốc lò cao ${g(cao)} < 585 (hốc hãng 585 – 595).`);
      }
      if ((I.hoc || []).some(x => x.tb === 'lo')) note('Đợt đỡ lò cố định, ngắn 50 phía sau (thoát nhiệt); hốc lò / vi sóng không hậu. Hốc theo cỡ phổ biến của hãng (lò 60: 560 – 568 × 585 – 595 × 550) — đối chiếu model khách mua.'); }
    // (bản 1.34) TỦ GÓC MÙ: cánh phía hở ≥ cánh tối thiểu của phụ kiện góc
    if (I.goc) {
      const p = PK((GOC_BEP[B.goc_pk] || {}).pk || '') || (I.ro[0] && PK(I.ro[0].pk));
      if (p && p.c_min && I.goc.c < p.c_min - TOL) err(`Cánh tủ góc chỉ ${g(I.goc.c)} < ${g(p.c_min)} — ${p.ten.toLowerCase()} ${p.hang} cần cánh ≥ ${g(p.c_min)}.`);
      if (p) note(`Tủ góc mù: ${p.ten.toLowerCase()} ${p.hang} — chiều trái / phải của mã hàng và bản lề mở rộng (165°) hỏi đại lý khi đặt [CĐ].`);
    }
    if (B.noc_tu) {      // (soát 1.33.1 v2) lý do theo loại: có SLK mà có CMG (chia ô) = hộp chính là mặt ngăn kéo; không SLK = không hạ được hộp
      const lo = ((s.ngan_keo && s.ngan_keo.loai) || []).find(x => x.ten === B.noc_tu), coSLK = !!(lo && lo.ts && typeof lo.ts.SLK === 'number');
      note(`Nóc liền thay 2 thanh giằng: hộp ngăn kéo loại "${B.noc_tu}" không hạ dưới giằng được (${coSLK ? 'hộp chính là mặt ngăn kéo — hạ hộp là hạ cả mặt' : 'không có tham số SLK để hạ hộp'}) — đổi sang loại ray bi / ray âm thì tủ tự về 2 thanh giằng.`); }
    // (1.33.1) tay nắm ẤN MỞ: rổ kéo của hãng đi kèm ray giảm chấn, hộp ray Blum có giảm chấn — giảm chấn kéo mặt về nên nhấn không bật ra
    if (B.tay_nam === 'an_mo') {
      const roKeo = [...new Set(I.ro.map(r => PK(r.pk)).filter(p => p && p.lap === 'keo').map(p => p.ten))];
      if (roKeo.length) warn(`Ấn mở: ${roKeo.join(', ').toLowerCase()} đi kèm ray giảm chấn của hãng — ray giảm chấn không ấn mở được: mặt kéo rổ cần vát cạnh / tay nắm, hoặc đặt rổ loại ray nhấn mở (hỏi Higold / Eurogold) [CĐ].`);
      // theo Ô của thông số (không theo mẫu đã dựng: ô Blum dưới giằng không hạ hộp được, lỗi + không có mẫu)
      const blum = s.khoang.some(kh => (kh.o || []).some(c => c.kieu === 'nk_trum' && /^blum/.test(c.loai || s.ngan_keo.mac_dinh || '')));      // hộc âm sau cánh: mở cánh rồi kéo, không ấn mở
      if (blum) warn('Ấn mở: hộp ray Blum (giảm chấn) không ấn mở được — chọn loại ray bi / ray âm rồi thay bằng ray nhấn mở Higold / Eurogold.');
    }
    // đá đua trước mặt cánh: J nhô 25 trước cánh; (1.33.1) vát cạnh: ngón tay luồn dưới mép đá vào chỗ vát — đua chuẩn 20 là đủ [CĐ], dưới đó báo kèm lý do vát
    if (B.tang === 'duoi') { const min = 20 + (B.vien_da ? 15 : 0) + (B.tay_nam === 'j' ? 25 : 0), ly = B.tay_nam === 'j' ? ' (tay nắm J)' : B.tay_nam === 'vat' ? ' (tay nắm vát — chỗ ngón tay dưới mép đá)' : ''; if (B.dua_da < min - TOL) warn(`Đá đua ${g(B.dua_da)} trước mặt cánh — nên ≥ ${g(min)}${ly}${B.vien_da ? ' (đá có viền)' : ''}.`); }
    if (I.ro.length || B.pk) note('Số liệu rổ Higold / Eurogold tra từ trang hãng / đại lý (chưa có catalogue gốc), chưa đối chiếu với hàng xưởng đang dùng.');
    if (c || tbB || h) note('Kích thước chậu / bếp / máy hút mùi là ví dụ — gõ theo model khách mua.');
    return M;
  }
  /** Phụ kiện kê bảng của một tủ bếp (dòng mang `bep: true` — bảng kê / CSV ghi "Phụ kiện bếp"). Hãng: chỉ Eurogold / Higold. */
  function phuKienBep(M) {
    const s = M.spec, B = s.bep, I = M.info.bep, W = s.rong, out = [], them = (ten, sl, ghi_chu) => out.push({ ten, sl, ghi_chu, bep: true });
    const dem = new Map(), dat = (ma, lt) => { const p = LOAI_PK_BEP.find(x => x.ma === ma), k = ma + '|' + coPK(p, coKhoang(lt, W, s.van.t)); dem.set(k, (dem.get(k) || 0) + 1); };
    for (const r of I.ro) dat(r.pk, r.lot);
    if (B.pk) dat(B.pk, I.lot);
    for (const [k, sl] of dem) { const [ma, c] = k.split('|'), p = LOAI_PK_BEP.find(x => x.ma === ma), co = Number(c), [a, b] = p.lot(co); const hc = (p.hang_co && p.hang_co[co]) || [p.hang, p.nguon]; them(`${p.ten} cỡ ${g(co)} — ${hc[0]}`, sl, `lọt lòng cần ${g(a)} – ${g(b)}; ${p.lap === 'keo' ? 'ray giảm chấn đi theo rổ, mặt kéo bắt vít vào rổ' : p.lap === 'goc' ? 'khung rổ góc bắt hồi + cánh, cánh mở bản lề — [CĐ] chiều trái / phải mã hàng' : p.lap === 'canh' ? `khung rổ bắt hồi, cánh mở bản lề (ô cao ≥ ${g(p.cao_min)})` : 'lắp trong tủ trên'}; ${hc[1]}`); }
    if (B.chuc_nang === 'chau') {
      them('Ke góc đáy – hồi (chống xô, tủ chậu không hậu)', 2, 'bắt ở hai góc sau, đáy với hai hồi');
      them('Tấm nhôm lót đáy tủ chậu', 1, `${(I.lot * I.sau_lot / 1e6).toFixed(2).replace('.', ',')} m² (lọt ${g(I.lot)} × ${g(I.sau_lot)}) — [CĐ] nhôm composite 3 mm hay nhôm tấm 0,5 – 1 mm`);
      them('Silicone trét mép đáy + lỗ ống nước', 1, 'chống nước đọng ngấm cạnh ván');
    }
    if (B.tang === 'tren' && M.parts.some(p => p.loai === 'TREO')) them('Vít nở treo tủ trên (xuyên thanh treo vào tường)', W <= 900 ? 2 : 3, `tủ ${W <= 900 ? '≤' : '>'} 900 — [CĐ] số vít theo tải tủ bát 40 – 60 kg`);
    if (B.chuc_nang === 'tl' && B.tb.tl && B.tb.tl.kieu === 'am') { const tl = B.tb.tl, nc = M.parts.filter(p => p.loai === 'CANH' && p.op_tl).length;      // (bản 1.35) tủ lạnh âm
      them(`Tủ lạnh âm (khách mua): ${tl.ten}`, 1, `rộng ${g(tl.rong)} × sâu ${g(tl.sau)} × cao ${g(tl.cao)}; hở hông ${g(tl.ho_hong)}, trên ${g(tl.ho_tren)}, sau ${g(tl.ho_sau)} — đối chiếu kích thước hốc + khe thoát nhiệt trong catalogue máy [CĐ]`);
      them('Bộ ray dẫn cánh tủ lạnh âm (nối cánh ốp với cánh máy)', Math.max(1, nc), 'theo máy (thường đi kèm máy âm) — cánh ốp cùng màu dãy [CĐ]');
      them('Vít nở bắt tủ cao tủ lạnh âm vào tường (xuyên thanh treo ô trên)', 2, 'giữ tủ cao khỏi đổ khi mở cánh nặng — [CĐ] cỡ vít'); }
    else if (B.chuc_nang === 'tl' && B.tb.tl) { const tl = B.tb.tl;      // (bản 1.34) khoang tủ lạnh: chân hồi ke L + vít nở (anh chốt), máy khách mua
      them(`Tủ lạnh (khách mua): ${tl.ten}`, 1, `rộng ${g(tl.rong)} × sâu ${g(tl.sau)} × cao ${g(tl.cao)}; hở hông ${g(tl.ho_hong)}, trên ${g(tl.ho_tren)}, sau ${g(tl.ho_sau)}`);
      them('Ke L chân hồi khoang tủ lạnh (bắt sàn)', 2, 'mỗi hồi cao một ke, vít nở xuống sàn — khoang không đáy, không giằng chân [CĐ] cỡ ke');
      them('Vít nở bắt khoang tủ lạnh vào tường (xuyên thanh treo ô trên)', 2, 'giữ hai hồi cao khỏi đổ — [CĐ] cỡ vít'); }
    for (const x of I.hoc || []) if (x.tb === 'lo' || x.tb === 'vs') them(x.tb === 'lo' ? 'Lò nướng âm tủ 60 (khách mua)' : 'Lò vi sóng âm tủ (khách mua)', 1, `hốc ${g(x.lot)} × cao ${g(rn(x.z1 - x.z0))} × sâu ${g(x.sau)}`);
    if (B.chuc_nang === 'bep' && B.bep_loai === 'gas') them('Lỗ thông gió bình gas', 1, 'khoét đáy / hậu tủ bếp nấu — [CĐ] cỡ lỗ');
    // (bản 1.35) cánh khung kính + LED âm đáy tủ trên
    { const ck = M.parts.filter(p => p.loai === 'CANH' && p.kinh); if (ck.length) them('Kính cánh khung (cường lực / kính mờ 5 mm) [CĐ]', ck.length, [...new Set(ck.map(p => `${g(p.kinh.rong)} × ${g(p.kinh.cao)}`))].join('; ') + ` — khung 4 thanh bản ${g(KINH_KHUNG)}, kính ăn rãnh ${g(KINH_AN)} mỗi cạnh`); }
    if (B.led && B.tang === 'tren') {
      const dai = rn(Math.max(0, W - (s.phao.trai || 0) - (s.phao.phai || 0) - 2 * s.van.t - 20));
      them('Dải LED âm đáy tủ trên (12 V, máng nhôm + mica) [CĐ]', 1, `dài ${g(dai)} — nằm trong rãnh ${g(LED_RANH[0])} × ${g(LED_RANH[1])} dưới đáy, cách mép trước ${g(LED_RANH[2])}`);
      if (B.led_nguon > 0) { const w = Math.ceil(B.led_nguon / 1000 * LED_W_M * 1.2 / 10) * 10; them(`Nguồn LED 12 V ${w} W + công tắc cảm biến (cả dãy) [CĐ]`, 1, `cho ${g(rn(B.led_nguon / 1000, 2))} m LED (${LED_W_M} W/m, dư 20 %) — đặt trong tủ này, dây đi sau hậu`); }
    }
    if (B.chuc_nang === 'hm' && B.tb.hm) { const h = B.tb.hm, Q = I.hm;
      them(`Máy hút mùi (khách mua): ${h.ten}`, 1, h.kieu === 'kinh' ? `rộng ${g(h.rong)} × sâu ${g(h.sau)}, thân cao ${g(h.cao)}, ống Ø${g(h.ong)} — treo tường dưới tủ che ống${Q ? `, đáy máy +${g(Q.day)} (cách mặt kính bếp ${g(Q.cach)})` : ''}; lỗ ống trên đáy + nóc tủ ghi ở dòng tấm` : `rộng ${g(h.rong)} × sâu ${g(h.sau)}, ống Ø${g(h.ong)} — khoét đáy + lỗ ống trên nóc ghi ở dòng tấm`); }
    // (1.33.1) tay nắm: vát cạnh — mặt ngăn kéo của mẫu Chenfeng không phải tấm của bảng (không mang ghi chú tấm) → kê gia công ở đây; ấn mở — bộ nhấn mở + ray nhấn mở [CĐ]
    // (bản vá 1.33.1) chỉ mặt LỘ ra ngoài (nk_trum): hộc âm nằm sau cánh — mở cánh rồi kéo, không vát, không ray nhấn mở
    const nkTp = M.templates.filter(tp => tp.loai === 'NGAN_KEO' && tp.kieu === 'nk_trum');
    if (B.tay_nam === 'vat' && nkTp.length) them('Gia công vát cạnh 45° (tay nắm vát) — mặt ngăn kéo mẫu Chenfeng', nkTp.length, `vát mép trên mặt ngăn kéo (${nkTp.map(tp => (M.mat_ngan_keo[tp.mat] ? `${g(M.mat_ngan_keo[tp.mat].w)} × ${g(M.mat_ngan_keo[tp.mat].h)}` : '')).filter(Boolean).join('; ')}), ăn ~${g(VAT_SAU)} [CĐ] — xưởng vát khi cắt mặt`);
    if (B.tay_nam === 'an_mo') {
      const canh = M.parts.filter(p => p.loai === 'CANH');
      if (canh.length) them('Bộ nhấn mở cánh (Higold / Eurogold) [CĐ]', sum(canh.map(p => (p.z1 - p.z0 > 1200 ? 2 : 1))), `mỗi cánh 1 bộ (cánh cao > 1200: 2) bắt trong thùng phía mở; cánh dùng bản lề không giảm chấn; ${canh.length} cánh`);
      const nkRay = nkTp.filter(tp => !/^blum/.test(tp.ma_loai || ''));
      if (nkRay.length) them('Ray nhấn mở ngăn kéo (Higold / Eurogold) [CĐ]', nkRay.length, `thay ray của mẫu Chenfeng (ray giảm chấn không ấn mở được), cùng cỡ sâu hộp: ${[...new Set(nkRay.map(tp => g(tp.box[1])))].join(' / ')}`);
    }
    return out;
  }

  // Mẫu tủ bếp: [mã, tên, chức năng, rộng, số cánh ('tu' = 1 khi ≤ ngưỡng 1 cánh, không thì 2), ruột(B, k) → { dot, o } (k = { cao, chan, t } của module), thêm vào spec.bep]
  const dotGiua = k => Math.round((k.chan + k.t + k.cao - k.t - k.t) / 2);      // một đợt giữa lọt lòng thùng (mặt dưới đợt)
  // đợt trên ô rổ tủ đồ khô (mặt dưới đợt): 400 kéo chừa ô ~1780 (Eurogold M030640 1700 – 2200), 450 / 600 cánh mở chừa đúng cao_min — datBep tính lại khi đổi chân
  const zKho = (ma, k) => Math.ceil((k.chan + k.t + (ma === 'kho' ? 1780 : LOAI_PK_BEP.find(x => x.ma === 'kho_canh').cao_min)) / 10) * 10;
  const RUOT_BEP = {
    trong: () => ({ dot: [], o: [] }),
    dot: (B, k) => ({ dot: [dotGiua(k)], o: [] }),
    nk3: B => ({ dot: [], o: [{ tu: 0, kieu: 'nk_trum', so: 3, cao: [B.nk_nong] }] }),
    // (vòng soát 2) mặt trên 330: giá bát Higold cao 210 + chỗ ≥ 220 lọt dưới giằng của tủ bếp nấu (mặt 300 thì rổ chạm giằng +730)
    xn: () => ({ dot: [], o: [{ tu: 0, kieu: 'keo_pk', pk: ['bat_duoi', 'xoong'], cao: [330] }] }),
    pk: ma => () => ({ dot: [], o: [{ tu: 0, kieu: 'keo_pk', pk: [ma] }] }),
    kho: (B, k) => ({ dot: [zKho('kho', k)], o: [{ tu: 0, kieu: 'keo_pk', pk: ['kho'] }] }),      // 400 kéo (Eurogold M030640 1700 – 2200)
    // (vòng soát 2) 450 / 600 rổ cánh mở: ô dưới ≥ rổ cao nhất (Higold 1825) + 10 → đợt nâng lên, ô dưới có cánh riêng + bản lề, ô trên đợt + cánh
    kho_canh: (B, k) => ({ dot: [zKho('kho_canh', k)], o: [{ tu: 0, kieu: 'keo_pk', pk: ['kho_canh'] }] }),      // ô dưới ≥ 1720 cho rổ đồ khô 6 tầng; ô trên đợt + cánh
    // (bản 1.34) tủ góc mù dưới: ruột do normBep dựng theo phụ kiện góc (ruotBep) — mẫu chỉ ghi phía mù
    goc_duoi: ben => () => ({ dot: [], o: [], mu: { ben } }),
    // (bản 1.34) tủ trên góc mù: hai khoang — khoang mù (che cả mặt bằng tấm che mù, cố định) + khoang 2 cánh c_t; vách giữa ở đúng mép vùng cánh để mối nối trùng tủ dưới
    goc_tren: (pk, ben) => (B, k) => {
      const q = gocBep(pk, { chuan: B, tc: k.tc }), dot = [dotGiua(k)];
      const mu = { rong: rn(k.W - q.c_t - 1.5 * k.t), canh: 0, mu: { ben }, dot, o: [] }, cua = { rong: 'auto', canh: 2, dot, o: [] };
      return { khoang: ben === 'trai' ? [mu, cua] : [cua, mu] };
    },
  };
  const MA_GOC = { hg_lh: 'BD-GOC-900', eu_lh: 'BD-GOC-990', eu_la: 'BD-GOCLA-900' };
  const MA_TANG_BEP = { duoi: 'BD', tren: 'BT', cao: 'BC' };
  // (bản 1.34) rong có thể là hàm (Bm, t, tc) — khoang tủ lạnh theo máy, tủ trên góc theo phụ kiện góc + chuẩn; ruột trả { khoang: [...] } thì thay cả danh sách khoang
  // (1.34.1 — thư viện bếp gọn) ap(keep, doi): doi = { rong, ten } dựng CÙNG ruột / thiết bị / số cánh của mẫu ở bề rộng khác (bepTheoKieu — chip chức năng giữ rộng đang gõ);
  // mẫu rộng theo máy / phụ kiện góc (rong là hàm) không nhận doi.rong. canh là hàm (W) → số cánh theo rộng.
  const mauBep = tang => ([ma, ten, chuc, rong, canh, ruot, them]) => ({ ma, ten, loai_sp: 'bep', tang, chuc_nang: chuc, co: typeof rong === 'number' ? rong : null, mo_ta: `${g(typeof rong === 'function' ? rong(Object.assign({}, DEFAULT_BEP, clone(them || {})), DEFAULT_SPEC.van.t, DEFAULT_SPEC.van.t_canh) : rong)} × ${g(them && them.cao_rieng ? them.cao_rieng : { duoi: DEFAULT_BEP.cao_mat - DEFAULT_BEP.day_da - DEFAULT_BEP.van_lot, tren: DEFAULT_BEP.cao_tren, cao: DEFAULT_BEP.cao_mat + DEFAULT_BEP.cach_tren + DEFAULT_BEP.cao_tren }[tang])}`,
    ap: (keep, doi) => {
      const cu = keep.loai_sp === 'bep' && keep.bep && typeof keep.bep === 'object' ? keep.bep : {}, chuan = {}, cuCu = Array.isArray(cu.chuan_cu) ? cu.chuan_cu : [];
      for (const x of KHOA_CHUAN_BEP) if (x in cu && cuCu.indexOf(x) < 0) chuan[x] = cu[x];      // giữ chuẩn bếp của người dùng khi đổi mẫu — trừ mặc định cũ của tủ làm trước 1.33.1 (chuan_cu)
      // (bản vá 1.33.1) ô ngăn kéo loại không hạ hộp được dưới giằng (hộp ray Blum, chia ô, khay bàn phím): normBep tự lấy nóc liền (nocTuLien)
      const Bm = Object.assign({}, DEFAULT_BEP, chuan, { tang, chuc_nang: chuc, noc: DEFAULT_BEP.noc, pk: '', tb: {} }, clone(them || {}));
      const tV = num(keep.van && keep.van.t, DEFAULT_SPEC.van.t), tcV = num(keep.van && keep.van.t_canh, DEFAULT_SPEC.van.t_canh), W = typeof rong === 'function' ? rong(Bm, tV, tcV) : doi && doi.rong > 0 ? doi.rong : rong;
      const s = Object.assign(keep, { loai_sp: 'bep', ma: MA_TANG_BEP[tang], ten: (doi && doi.ten) || ten, rong: W, bep: Bm });
      kichBep(s);
      const so = typeof canh === 'function' ? canh(W) : canh === 'tu' ? (W <= (tang === 'tren' ? Bm.canh_1_tren : Bm.canh_1_duoi) ? 1 : 2) : canh;
      const r = ruot(Bm, { cao: s.cao, chan: s.chan.cao, t: tV, tc: tcV, W });
      s.khoang = r.khoang ? r.khoang : [Object.assign({ rong: 'auto', canh: so }, r)];
      return s;
    } });
  const canhBat = W => (W <= 600 ? 1 : 2);
  const maTL = m => `BC-TL${m.kieu === 'am' ? 'A' : ''}-${m.rong}`;
  const MAU_BEP_DUOI = [
    // (1.33.1) chậu âm là chính: chậu âm lọt tủ theo kiemBep (phủ bì + 2 × 10 ≤ lọt) — 800: chậu đơn âm 600, 900: chậu đôi âm 780; chậu dương chọn ở ô Chậu
    // (bản 1.35) chậu = bếp cùng cỡ 700 / 800 / 900 (anh Thanh 14/10/2026): + tủ chậu / bếp nấu 700 (lọt 664: chậu đơn âm 600, bếp đôi khoét 650 [CĐ])
    ['BD-CHAU-700', 'Tủ chậu 700 (chậu âm)', 'chau', 700, 2, RUOT_BEP.trong, { tb: { chau: { ma: 'am_don_600' } } }],
    ['BD-CHAU-800', 'Tủ chậu 800 (chậu âm)', 'chau', 800, 2, RUOT_BEP.trong, { tb: { chau: { ma: 'am_don_600' } } }],
    ['BD-CHAU-900', 'Tủ chậu 900 (chậu âm)', 'chau', 900, 2, RUOT_BEP.trong, { tb: { chau: { ma: 'am_780' } } }],
    ['BD-BEP-700', 'Tủ bếp nấu 700 (giá bát + giá xoong)', 'bep', 700, 0, RUOT_BEP.xn, { tb: { bep: { ma: 'doi_650' } } }],
    ['BD-BEP-800', 'Tủ bếp nấu 800 (giá bát + giá xoong)', 'bep', 800, 0, RUOT_BEP.xn, { tb: { bep: { ma: 'doi_730' } } }],
    ['BD-BEP-900', 'Tủ bếp nấu 900 (giá bát + giá xoong)', 'bep', 900, 0, RUOT_BEP.xn, { tb: { bep: { ma: 'ba_750' } } }],
    ...[400, 450, 600, 800, 900].map(w => [`BD-NK3-${w}`, `Tủ 3 ngăn kéo ${w}`, 'nk', w, 0, RUOT_BEP.nk3]),
    ...[600, 700, 750, 800, 900].map(w => [`BD-XN-${w}`, `Tủ giá bát + giá xoong ${w}`, 'xn', w, 0, RUOT_BEP.xn]),
    ...[200, 250, 300, 350, 400, 450].map(w => [`BD-GV-${w}`, `Tủ gia vị, dao thớt ${w}`, 'gv', w, 0, RUOT_BEP.pk('gia_vi')]),
    ['BD-GAO-300', 'Tủ thùng gạo 300', 'gao', 300, 0, RUOT_BEP.pk('gao')],
    ['BD-RAC-300', 'Tủ thùng rác 300', 'rac', 300, 0, RUOT_BEP.pk('rac')],
    ['BD-RAC-400', 'Tủ thùng rác 400', 'rac', 400, 0, RUOT_BEP.pk('rac')],
    ...[300, 400, 450, 600, 800, 900].map(w => [`BD-CANH-${w}`, `Tủ cánh ${w}`, 'canh', w, 'tu', RUOT_BEP.dot]),
    // (bản 1.34) kệ hở (đầu dãy hở / lấp dư lẻ), tủ góc mù chữ L (T / P = phía mù)
    ...[150, 200, 300].map(w => [`BD-KE-${w}`, `Kệ hở dưới ${w}`, 'ke', w, 0, RUOT_BEP.dot]),
    ...Object.keys(MA_GOC).flatMap(pk => [['trai', 'T'], ['phai', 'P']].map(([ben, b]) => [`${MA_GOC[pk]}-${b}`, `Tủ góc mù ${g(GOC_BEP[pk].Wg)}, mù ${ben === 'trai' ? 'trái' : 'phải'} (${GOC_BEP[pk].ten.replace(/ —.*$/, '')})`, 'goc', GOC_BEP[pk].Wg, 1, RUOT_BEP.goc_duoi(ben), { goc_pk: pk }])),
  ].map(mauBep('duoi'));
  const MAU_BEP_TREN = [
    ...[300, 400, 450, 600, 700, 800, 900].map(w => [`BT-CANH-${w}`, `Tủ trên cánh ${w}`, 'canh', w, 'tu', RUOT_BEP.dot]),
    ...[600, 800, 900].flatMap(w => [700, 900].map(h => [`BT-CANH-${w}-H${h}`, `Tủ trên cánh ${w}, cao ${h}`, 'canh', w, 'tu', RUOT_BEP.dot, { cao_rieng: h }])),      // chiều cao riêng của mẫu, không đổi chuẩn Cao tủ trên
    // (1.33.1) giá bát nâng hạ là chính (anh chốt); giá bát cố định giữ làm mẫu riêng
    ...[600, 700, 800, 900].map(w => [`BT-BAT-${w}`, `Tủ trên giá bát nâng hạ ${w}`, 'bat', w, canhBat, RUOT_BEP.trong, { pk: 'bat_tren_nh' }]),
    ...[600, 700, 800, 900].map(w => [`BT-BATCD-${w}`, `Tủ trên giá bát cố định ${w}`, 'bat', w, canhBat, RUOT_BEP.trong, { pk: 'bat_tren_cd' }]),
    // (bản 1.35) tủ hút mùi rộng ĐÚNG tủ bếp nấu bên dưới (mối nối trùng): 700 / 800 / 900; 950 giữ cho tủ lẻ / bộ cũ
    ['BT-HM-700', 'Tủ hút mùi 700 (máy âm 600)', 'hm', 700, 2, RUOT_BEP.trong, { tb: { hm: { ma: 'am_600' }, bep: { ma: 'doi_650' } } }],
    ['BT-HM-800', 'Tủ hút mùi 800 (máy âm 700)', 'hm', 800, 2, RUOT_BEP.trong, { tb: { hm: { ma: 'am_700' }, bep: { ma: 'doi_730' } } }],
    ['BT-HM-900', 'Tủ hút mùi 900 (máy âm 800)', 'hm', 900, 2, RUOT_BEP.trong, { tb: { hm: { ma: 'am_800' }, bep: { ma: 'ba_750' } } }],
    ['BT-HM-950', 'Tủ hút mùi 950 (máy âm 900)', 'hm', 950, 2, RUOT_BEP.trong, { tb: { hm: { ma: 'am_900' }, bep: { ma: 'ba_750' } } }],
    // (1.33.1) hút mùi kính vát áp tường: tủ trên NGẮN che ống khói, thẳng đỉnh dãy tủ trên (z đặt = đỉnh dãy − cao), không đợt, lỗ ống ở đáy + nóc.
    // Cao 350: đáy +2010 ≥ đỉnh máy (mặt kính bếp 865 + 700 gas + thân 442 = 2007) — bếp từ lẫn gas đều lắp được [CĐ] thân máy theo model khách mua
    ...[[700, 'kinh_700', 'doi_730'], [900, 'kinh_900', 'ba_750']].map(([w, hm, bep]) => [`BT-HMK-${w}`, `Tủ che ống hút mùi kính ${w}`, 'hm', w, 2, RUOT_BEP.trong, { cao_rieng: CAO_CHE_ONG, tb: { hm: { ma: hm }, bep: { ma: bep } } }]),
    // (bản 1.34) kệ hở trên, tủ trên góc mù (rộng theo phụ kiện góc của tủ dưới + chuẩn: mối nối trùng tủ dưới — gocBep)
    ...[150, 200, 300].map(w => [`BT-KE-${w}`, `Kệ hở trên ${w}`, 'ke', w, 0, RUOT_BEP.dot]),
    ...Object.keys(MA_GOC).flatMap(pk => [['trai', 'T'], ['phai', 'P']].map(([ben, b]) => [`${MA_GOC[pk].replace(/^BD/, 'BT')}-${b}`, `Tủ trên góc mù, mù ${ben === 'trai' ? 'trái' : 'phải'} (trên ${MA_GOC[pk]})`, 'goc',
      (Bm, t, tc) => gocBep(pk, { chuan: Bm, tc }).Wg_t, 2, RUOT_BEP.goc_tren(pk, ben), { goc_pk: pk }])),
  ].map(mauBep('tren'));
  const MAU_BEP_CAO = [['BC-KHO-400', 'Tủ cao đồ khô kéo 400', 'kho', 400, 'tu', RUOT_BEP.kho],
    ...[450, 600].map(w => [`BC-KHO-${w}`, `Tủ cao đồ khô cánh mở ${w}`, 'kho', w, 'tu', RUOT_BEP.kho_canh]),
    // (bản 1.34) khoang tủ lạnh: rộng = máy + 2 × hở hông 20 + 2 hồi (không làm tròn — dư dồn vào nẹp của dãy); tủ lò + vi sóng 600 (hốc vi sóng 380, anh chốt)
    // (bản 1.35) máy âm: mã BC-TLA-<rộng> — tủ cao bao quanh (hở 5 mỗi hông), cánh ốp
    ...LOAI_TB_BEP.tl.map(m => [maTL(m), `${m.kieu === 'am' ? 'Tủ cao tủ lạnh âm' : 'Khoang tủ lạnh'} ${m.rong} (${m.ten.replace(/ \(ví dụ\)$/, '')})`, 'tl', (Bm, t) => rn(m.rong + 2 * hoTL(m.kieu).ho_hong + 2 * t), 2, RUOT_BEP.trong, { tb: { tl: { ma: m.ma } } }]),
    ['BC-LO-600', 'Tủ cao lò nướng + vi sóng 600', 'lo', 600, 1, RUOT_BEP.trong, { vs: VS_MAC_DINH }]].map(mauBep('cao'));

  /* ------------------------------------------------------------------ *
   * (bản 1.34.1 — anh Thanh 14/10/2026: "làm hệ thư viện để vẽ bếp như tủ áo") THƯ VIỆN BẾP GỌN: ô Thư viện chỉ còn Tủ bếp dưới / trên / cao (+ Bộ bếp I / L);
   * chức năng chọn bằng chip trong khối Tủ bếp (KIEU_BEP), Rộng gõ ở ô Rộng. Đổi chức năng GIỮ rộng đang gõ: bepTheoKieu dựng ruột / thiết bị của mẫu
   * MAU_BEP_* cùng kiểu — đúng cỡ thì Y HỆT mẫu đó, cỡ khác thì mẫu gần nhất (lớn nhất ≤ rộng: thiết bị lọt) dựng lại ở rộng đó. Rổ lệch cỡ hãng: kiemBep báo
   * ("Đặt tủ rộng N") → nút Chuyển tủ N của bảng. Tủ góc rộng theo phụ kiện góc, khoang tủ lạnh rộng theo máy (không giữ rộng gõ).
   * MAU_BEP_* vẫn là dữ liệu của Bộ bếp (xepBep / tuBo), phép thử — chỉ bỏ khỏi ô Thư viện.
   * ------------------------------------------------------------------ */
  const KIEU_BEP = {
    duoi: [['canh', 'Cánh', 'Tủ cánh', 600], ['nk', 'Ngăn kéo', 'Tủ 3 ngăn kéo', 600], ['chau', 'Chậu', 'Tủ chậu', 800], ['bep', 'Bếp nấu', 'Tủ bếp nấu', 800], ['xn', 'Bát + xoong', 'Tủ giá bát + giá xoong', 800],
      ['gv', 'Gia vị', 'Tủ gia vị, dao thớt', 300], ['rac', 'Thùng rác', 'Tủ thùng rác', 300], ['gao', 'Thùng gạo', 'Tủ thùng gạo', 300], ['ke', 'Kệ hở', 'Kệ hở dưới', 300], ['goc', 'Góc mù', 'Tủ góc mù', 900]],
    tren: [['canh', 'Cánh', 'Tủ trên cánh', 600], ['bat', 'Giá bát', 'Tủ trên giá bát nâng hạ', 800], ['hm', 'Hút mùi âm', 'Tủ hút mùi', 800], ['hmk', 'Hút mùi kính', 'Tủ che ống hút mùi kính', 900],
      ['ke', 'Kệ hở', 'Kệ hở trên', 300], ['goc', 'Góc mù', 'Tủ trên góc mù', 900]],
    cao: [['kho', 'Khô kéo', 'Tủ cao đồ khô kéo', 400], ['kho_canh', 'Khô cánh', 'Tủ cao đồ khô cánh mở', 600], ['tl', 'Tủ lạnh', 'Khoang tủ lạnh', 790], ['lo', 'Lò + vi sóng', 'Tủ cao lò nướng + vi sóng', 600]],
  };
  for (const k of Object.keys(KIEU_BEP)) KIEU_BEP[k] = KIEU_BEP[k].map(([ma, nut, ten, rong]) => ({ ma, nut, ten, rong }));
  // mẫu CHÍNH của mỗi kiểu (biến thể H700 / H900, giá bát cố định: không thuộc chip — chọn trong khối / gõ Cao)
  const KIEU_MA_BEP = [[/^BD-CANH-\d+$/, 'canh'], [/^BD-NK3-/, 'nk'], [/^BD-CHAU-/, 'chau'], [/^BD-BEP-/, 'bep'], [/^BD-XN-/, 'xn'], [/^BD-GV-/, 'gv'], [/^BD-RAC-/, 'rac'], [/^BD-GAO-/, 'gao'], [/^BD-KE-/, 'ke'], [/^BD-GOC/, 'goc'],
    [/^BT-CANH-\d+$/, 'canh'], [/^BT-BAT-/, 'bat'], [/^BT-HM-/, 'hm'], [/^BT-HMK-/, 'hmk'], [/^BT-KE-/, 'ke'], [/^BT-GOC/, 'goc'], [/^BC-KHO-400$/, 'kho'], [/^BC-KHO-(450|600)$/, 'kho_canh'], [/^BC-TLA?-/, 'tl'], [/^BC-LO-/, 'lo']];
  for (const m of [...MAU_BEP_DUOI, ...MAU_BEP_TREN, ...MAU_BEP_CAO]) {
    const k = KIEU_MA_BEP.find(([re]) => re.test(m.ma)); if (!k) continue;
    m.kieu = k[1];
    if (k[1] === 'goc') { m.goc_ben = /-T$/.test(m.ma) ? 'trai' : 'phai'; m.goc_pk = Object.keys(MA_GOC).find(pk => m.ma.slice(3).indexOf(MA_GOC[pk].slice(3) + '-') === 0); }
    if (k[1] === 'tl') m.may = (LOAI_TB_BEP.tl.find(x => m.ma === maTL(x)) || {}).ma;
  }
  const MAU_BEP_TANG = { duoi: MAU_BEP_DUOI, tren: MAU_BEP_TREN, cao: MAU_BEP_CAO };
  /** Chip chức năng đang bấm của một tủ bếp ('' = không kiểu nào: tủ cao cánh, tủ chưa phải bếp). */
  function kieuBep(spec) {
    if (!spec || spec.loai_sp !== 'bep' || !spec.bep || typeof spec.bep !== 'object') return '';
    const B = spec.bep, c = B.chuc_nang, ds = KIEU_BEP[B.tang] || [];
    if (c === 'hm') return B.tb && B.tb.hm && B.tb.hm.kieu === 'kinh' ? 'hmk' : 'hm';
    if (c === 'kho') return (spec.khoang || []).some(k => k && (k.o || []).some(o => o && Array.isArray(o.pk) && o.pk.indexOf('kho_canh') >= 0)) ? 'kho_canh' : 'kho';
    return ds.some(x => x.ma === c) ? c : '';
  }
  /**
   * Tủ bếp theo chip chức năng (hàm thuần). opt = { tang, rong, goc_pk, ben, may }: tầng (mặc định tầng của spec), rộng (không có = cỡ mặc định của kiểu),
   * tủ góc: phụ kiện góc + phía mù (mặc định của tủ góc đang mở, không thì Higold liên hoàn / mù trái), khoang tủ lạnh: mã máy (không có thì máy có
   * khoang gần rộng gõ nhất). Chuẩn xưởng + chuẩn bếp trong spec giữ nguyên (như apMau). @returns spec đã normalize | null (kiểu không có ở tầng đó)
   */
  function bepTheoKieu(spec, kieu, opt) {
    opt = opt || {};
    const keep = clone(spec || {}), cu = keep.loai_sp === 'bep' && keep.bep && typeof keep.bep === 'object' ? keep.bep : {};
    const tang = KIEU_BEP[opt.tang] ? opt.tang : KIEU_BEP[cu.tang] ? cu.tang : 'duoi', K = KIEU_BEP[tang].find(x => x.ma === kieu);
    if (!K) return null;
    const ds = MAU_BEP_TANG[tang].filter(m => m.kieu === kieu), Wg = num(opt.rong, NaN), coW = isFinite(Wg) && Wg >= 100 && Wg <= 3000, W = coW ? rn(Wg, 1) : K.rong;
    let m = null;
    if (kieu === 'goc') {
      const kh = (keep.khoang || []).find(k => k && k.mu && typeof k.mu === 'object'), laGoc = cu.chuc_nang === 'goc' && cu.tang === tang;
      const pk = GOC_BEP[opt.goc_pk] ? opt.goc_pk : laGoc && GOC_BEP[cu.goc_pk] ? cu.goc_pk : GOC_MAC_DINH;
      const ben = opt.ben === 'trai' || opt.ben === 'phai' ? opt.ben : laGoc && kh && kh.mu.ben === 'phai' ? 'phai' : 'trai';
      m = ds.find(x => x.goc_pk === pk && x.goc_ben === ben);
    } else if (kieu === 'tl') {
      const t = num(keep.van && keep.van.t, DEFAULT_SPEC.van.t), rTL = x => LOAI_TB_BEP.tl.find(q => q.ma === x.may).rong + 2 * TL_HO.ho_hong + 2 * t;
      // (bản 1.35) gõ rộng: chỉ dò trong khoang tủ lạnh dương (máy âm chọn theo mã máy — tủ cao bao quanh khác hẳn)
      const duong = ds.filter(x => !/^BC-TLA-/.test(x.ma));
      m = ds.find(x => x.may === opt.may) || (coW ? duong.reduce((a, x) => (Math.abs(rTL(x) - W) < Math.abs(rTL(a) - W) - TOL ? x : a)) : ds.find(x => x.may === TB_MAC_DINH.tl(0)));
    } else {
      m = ds.find(x => x.co !== null && Math.abs(x.co - W) < 0.5);
      if (!m) {      // cỡ không có trong thư viện: ruột / thiết bị của mẫu lớn nhất ≤ rộng (máy lọt), không có thì mẫu nhỏ nhất — dựng ở đúng rộng gõ
        const duoi = ds.filter(x => x.co !== null && x.co <= W + TOL), g0 = duoi.length ? duoi.reduce((a, x) => (x.co > a.co ? x : a)) : ds.reduce((a, x) => (x.co < a.co ? x : a));
        return normalize(g0.ap(keep, { rong: W, ten: `${K.ten} ${g(W)}` }));
      }
    }
    return m ? normalize(m.ap(keep)) : null;
  }
  /**
   * (soát 1.34.1 — thư viện bếp gọn: gõ Rộng là đường chính) Tủ bếp vừa đổi rộng từ `rongCu` sang `spec.rong`: số cánh theo luật của CHỨC NĂNG (như chip —
   * bepTheoKieu), chỉ khi tủ một khoang và số cánh đang có = số cánh tự chia ở rộng cũ (người dùng chưa sửa). Góc mù / tủ lạnh (rộng theo phụ kiện / máy) không đụng.
   * Hàm thuần. @returns { spec, doi, so }
   */
  function canhBepTheoRong(spec, rongCu) {
    const khong = { spec, doi: false, so: null }, kieu = kieuBep(spec), W0 = num(rongCu, NaN), W1 = num(spec && spec.rong, NaN);
    if (!kieu || kieu === 'goc' || kieu === 'tl' || !Array.isArray(spec.khoang) || spec.khoang.length !== 1) return khong;
    const hop = w => isFinite(w) && w >= 100 && w <= 3000;
    if (!hop(W0) || !hop(W1) || Math.abs(W0 - W1) < 0.5) return khong;
    const so = w => { const x = bepTheoKieu(spec, kieu, { rong: w }); return x && x.khoang.length === 1 ? x.khoang[0] : null; };
    const a = so(W0), b = so(W1), k = spec.khoang[0];
    if (!a || !b || num(k.canh, 0) !== num(a.canh, 0) || num(a.canh, 0) === num(b.canh, 0)) return khong;
    const n = clone(spec); n.khoang[0].canh = b.canh;
    if (b.ban_le) n.khoang[0].ban_le = b.ban_le; else delete n.khoang[0].ban_le;
    return { spec: normalize(n), doi: true, so: b.canh };
  }
  // mục bếp của ô Thư viện (mã '@BEP-…' — apMau nhận): tủ mặc định của tầng; đổi chức năng / rộng trong khối Tủ bếp
  const MAU_BEP_TV = [['duoi', 'Tủ bếp dưới', 'canh'], ['tren', 'Tủ bếp trên', 'canh'], ['cao', 'Tủ bếp cao', 'kho_canh']].map(([tang, ten, kieu]) => {
    const K = KIEU_BEP[tang].find(x => x.ma === kieu);
    return { ma: '@BEP-' + tang, ten, loai_sp: 'bep', tang, kieu, mo_ta: `${K.ten.toLowerCase()} ${g(K.rong)} — chọn chức năng, gõ Rộng trong khối Tủ bếp`, ap: keep => bepTheoKieu(keep, kieu, { tang }) };
  });

  /* ------------------------------------------------------------------ *
   * (bản 1.34) DÃY BẾP CHỮ I / CHỮ L — bảng tự chia (thiết kế "dãy bếp", anh Thanh 12/10/2026). HÀM THUẦN: chuanBo → xepBep → tuBo / daDay / kiemDay.
   * Mỗi tủ vẫn là MỘT spec = MỘT module; "dãy" chỉ là dữ liệu của bảng. Toạ độ:
   *   u = dọc cạnh, tính từ GÓC TRONG (chữ L: cạnh A đi vào góc, cạnh B đi ra khỏi góc) hoặc từ đầu trái (chữ I);
   *   s = dọc cạnh theo TRỤC x CỦA TỦ (trái → phải khi nhìn mặt tủ) — cái bảng / driver dùng để đặt tủ. lat = true khi s ngược u (s = dài − u).
   *   Chữ L rẽ phải (mặc định): cạnh A có góc ở bên phải tủ (lat), cạnh B có góc ở bên trái; rẽ trái thì ngược lại.
   * Thứ tự cố định: khối cao (tủ lạnh → lò → kho, ở một đầu) → tủ góc → chậu (theo ống / tâm gõ) → bếp → lấp phần còn lại bằng tủ cỡ chuẩn (lưới 50);
   * dư lẻ dồn vào nẹp (đầu tường), nẹp góc / tủ góc phình (chữ L) — "dịch mốc trước, cỡ lẻ sau": chỉ khi không nẹp nào nhận mới làm MỘT tủ cánh cỡ lẻ.
   * Số chưa đo ở xưởng [CĐ]: nẹp góc 50, ngưỡng chậu 900 (đoạn ≥ 3200), bếp cách tủ lạnh 500, mặt đặt đồ cạnh tay nắm 380, khổ đá 3200, mối nối đá cách khoét 150.
   * ------------------------------------------------------------------ */
  const BO_DAU = ['tuong', 'ho'];
  // (bản 1.35) luật chia mới (anh Thanh 14/10/2026): chậu = bếp cùng cỡ 700 / 800 / 900 theo dài dãy (co_900 / co_800 [CĐ]); khoang rổ đúng cỡ rổ; khoang cánh / ngăn kéo
  // CHIA ĐỀU phần còn lại (tròn 5, e_min … e_max), dư dồn vào nẹp đầu sát tường; tủ trên trùng mối nối tủ dưới; tầng trên kịch trần cao trần `tran` (2700 [CĐ]), khe trần 10 [CĐ]
  const BO = { nep_goc: 50, nep_max: 100, nep_qua: 150, chau_cua_so: 150, bep_dau: 300, bep_tl: 500, dat_tl: 380, kho_da: 3200, da_cach: 150, khe_tren_goc: 20, so_che: [600, 800], tam_giac: [4000, 7900], canh_tg: [1200, 2700],
    co_900: 3400, co_800: 2600, e_max: 900, e_min: 150, nk_min: 400, ke_max: 300, tran: 2700, khe_tran: 10, tang2_min: 250 };
  const BO_CO = [900, 800, 700];
  const BO_CAO_CO = { lo: [600], kho: [400, 450, 600] }, BO_KE_DAU = 300;      // "+ Kệ": kệ hở 300 sát mỗi đầu hở (ốp hông bắt vào kệ) [CĐ]
  const DU_CHI = 20;      // (vòng soát 3 — 1.34) phần dư dưới mức này mà không nẹp nào nhận (hai đầu hở): để lại, LƯU Ý nẹp chỉ / silicon (thiết kế B6.5)
  // (bản 1.35) khoang rổ giữ ĐÚNG cỡ rổ chuẩn: gia vị kề bếp phía xa chậu, thùng rác (rồi thùng gạo) kề chậu phía xa bếp — giá bát + giá xoong nằm trong tủ bếp nấu
  const BO_RO = { gv: ['GV', 300], rac: ['RAC', 300], gao: ['GAO', 300] }, BO_RO_MAC_DINH = ['gv', 'rac'];
  const coChuan = (a, w) => a.some(c => Math.abs(c - w) < TOL);
  // (bản 1.35) mẫu tủ dưới của một mã trong dãy: mã thư viện, hoặc khoang chia đều ở mọi bề rộng (BD-CANH-735, BD-NK3-412.5, BD-KE-250) — ghim / "Đổi thành" nhận cả hai
  const mauDuoiBo = ma => { ma = String(ma == null ? '' : ma); const m = MAU_BEP_DUOI.find(x => x.ma === ma); if (m) return m; const k = /^BD-(NK3|CANH|KE)-(\d+(?:\.\d+)?)$/.exec(ma); const w = k ? Number(k[2]) : 0;
    return k && w >= BO.e_min - TOL && w <= BO.e_max + TOL ? { ma, chuc_nang: { NK3: 'nk', CANH: 'canh', KE: 'ke' }[k[1]], co: w } : null; };
  const ceil5 = v => Math.ceil(v / 5 - 1e-9) * 5, floor5 = v => Math.floor(v / 5 + 1e-9) * 5;
  /**
   * Bộ bếp chuẩn hoá (dữ liệu vào của xepBep). Không bao giờ nhận da_ve / tu_id / bo_bep (việc của bảng / Phòng). Chữ L: canh[0] = A (đi vào góc), canh[1] = B.
   * (bản 1.35, v 2) co = cỡ chung chậu = bếp (700 / 800 / 900, null = theo dài dãy) — chau.co / bep.co là bản sao (bảng cũ đọc / ghi); tl2 = tủ lạnh thứ hai ở đầu kia;
   * tl.kieu 'duong' | 'am'; ro = khoang rổ muốn có; tran = cao trần (0 = không tầng trên kịch trần); kinh = 'bat' | 'khong' | [{ canh, s }] (chỗ tủ trên); led = LED âm đáy tủ trên.
   * Bộ lưu ở 1.34 (v 1): tầng trên / kính / LED TẮT (mở lại không mọc thêm tủ), cỡ chậu lấy chau.co, bếp 900 thì 900.
   */
  function chuanBo(o) {
    o = o && typeof o === 'object' && !Array.isArray(o) ? clone(o) : {};
    const cu = num(o.v, 0) === 1;
    const kieu = o.kieu === 'L' ? 'L' : 'I', ca = Array.isArray(o.canh) ? o.canh : [], c0 = ca[0] && typeof ca[0] === 'object' ? ca[0] : {}, c1 = ca[1] && typeof ca[1] === 'object' ? ca[1] : {};
    const dai = (v, d) => rn(Math.max(0, Math.min(20000, num(v, d))), 1), dau = (v, d) => (BO_DAU.indexOf(v) >= 0 ? v : d);
    const canh = kieu === 'I' ? [{ dai: dai(c0.dai, 3600), dau: dau(c0.dau, 'tuong'), cuoi: dau(c0.cuoi, 'tuong') }]
      : [{ dai: dai(c0.dai, 3000), dau: dau(c0.dau, 'tuong'), cuoi: 'goc' }, { dai: dai(c1.dai, 2400), dau: 'goc', cuoi: dau(c1.cuoi, 'tuong'), re: c1.re === 'trai' ? 'trai' : 'phai' }];
    const ci = v => (kieu === 'L' && num(v, 0) === 1 ? 1 : 0), soN = (v, lo, hi) => { const x = num(v, NaN); return isFinite(x) && x >= lo && x <= hi ? rn(x, 1) : null; };
    const tlChuan = q => {
      q = q && typeof q === 'object' ? q : {};
      let may = q.may;
      if (may && typeof may === 'object') { const r = soN(may.rong, 400, 1400), c = soN(may.cao, 800, 2300); may = r && c ? { ma: 'tu_chon', rong: r, sau: soN(may.sau, 300, 1000) || 700, cao: c } : 'hai_canh_700'; }
      else may = LOAI_TB_BEP.tl.some(x => x.ma === may) ? may : (q.kieu === 'am' ? 'am_560' : 'hai_canh_700');
      const mx = typeof may === 'string' ? LOAI_TB_BEP.tl.find(x => x.ma === may) : null;
      const kt = q.kieu === 'am' || q.kieu === 'duong' ? q.kieu : mx && mx.kieu === 'am' ? 'am' : 'duong', H0 = hoTL(kt);
      const tl = { kieu: kt, canh: ci(q.canh), dau: q.dau === 'cuoi' ? 'cuoi' : 'dau', may, ban_le: q.ban_le === 'trong' ? 'trong' : 'tuong', tan_nhiet: ['', 'truoc', 'hong'].indexOf(q.tan_nhiet) >= 0 ? q.tan_nhiet : null };
      for (const k of Object.keys(TL_HO)) { const v = soN(q[k], 0, 300); tl[k] = v === null ? H0[k] : v; }
      return tl;
    };
    let tl = o.tl === null ? null : tlChuan(o.tl), tl2 = o.tl2 && typeof o.tl2 === 'object' ? tlChuan(o.tl2) : null;
    if (!tl && tl2) { tl = tl2; tl2 = null; }
    if (tl && kieu === 'L') tl.dau = tl.canh === 0 ? 'dau' : 'cuoi';      // chữ L: khối cao luôn ở đầu XA góc của cạnh
    if (tl && kieu === 'I') tl.canh = 0;
    // (bản 1.35) tủ lạnh thứ hai: luôn ở đầu KIA của dãy (chữ I: đầu đối diện; chữ L: đầu xa góc của cạnh kia)
    if (tl2) { if (kieu === 'L') { tl2.canh = 1 - tl.canh; tl2.dau = tl2.canh === 0 ? 'dau' : 'cuoi'; } else { tl2.canh = 0; tl2.dau = tl.dau === 'dau' ? 'cuoi' : 'dau'; } }
    const cao = (Array.isArray(o.cao) ? o.cao : []).filter(c => c && typeof c === 'object' && (c.loai === 'lo' || c.loai === 'kho')).slice(0, 3)
      .map(c => ({ loai: c.loai, rong: coChuan(BO_CAO_CO[c.loai], num(c.rong, 0)) ? num(c.rong, 0) : BO_CAO_CO[c.loai][0] }));
    const ch = o.chau && typeof o.chau === 'object' ? o.chau : {}, bp = o.bep && typeof o.bep === 'object' ? o.bep : {};
    // cỡ chung chậu = bếp: bảng mới ghi `co`; bảng cũ ghi chau.co / bep.co (khác `co` = vừa đổi). Bộ 1.34: bep.co luôn có 800 mặc định → chỉ 900 mới là lựa chọn
    const coHop = v => (BO_CO.indexOf(num(v, 0)) >= 0 ? num(v, 0) : null);
    let co;
    // (vòng soát 1.35) bộ 1.34 chọn chậu / bếp 900: 1.35 chậu = bếp cùng cỡ — 900 + 900 có khi không đủ chỗ trên dãy mà 1.34 xếp được (chậu 900 + bếp 800)
    // → co_lui = cỡ đó: thử cỡ đã chọn trước, không xếp được thì lùi cỡ nhỏ hơn (xepBep ghi LƯU Ý). Bảng chọn cỡ khác / "tự" thì bỏ dấu.
    let coLui = false;
    if (cu) { co = coHop(ch.co) || (num(bp.co, 0) === 900 ? 900 : null); coLui = co !== null; }
    else { const c = coHop(o.co); co = coHop(ch.co) !== null && coHop(ch.co) !== c ? coHop(ch.co) : coHop(bp.co) !== null && coHop(bp.co) !== c ? coHop(bp.co) : c; coLui = co !== null && num(o.co_lui, 0) === co; }
    const ong = o.ong && typeof o.ong === 'object' && soN(o.ong.s, -1000, 20000) !== null ? { canh: ci(o.ong.canh), s: soN(o.ong.s, -1000, 20000) } : null;
    const cs = o.cua_so && typeof o.cua_so === 'object' && soN(o.cua_so.s0, 0, 20000) !== null && soN(o.cua_so.s1, 0, 20000) !== null ? { canh: ci(o.cua_so.canh), s0: soN(o.cua_so.s0, 0, 20000), s1: soN(o.cua_so.s1, 0, 20000), be: soN(o.cua_so.be, 0, 3000) } : null;
    const chau = { canh: ci(ch.canh), s: soN(ch.s, 0, 20000), co };
    // chậu theo ống thoát. (vòng soát 2 — 1.34) ống là thứ cố định trên tường: chậu LUÔN ở cạnh có ống (kéo / gõ chậu sang cạnh kia thì tâm gõ đó bỏ)
    if (ong && chau.canh !== ong.canh) { if ('canh' in ch) chau.s = null; chau.canh = ong.canh; }
    const bep = { canh: kieu === 'L' ? (bp.canh === 0 || bp.canh === 1 ? bp.canh : null) : 0, s: soN(bp.s, 0, 20000), co };
    const goc = kieu === 'L' ? { pk: GOC_BEP[o.goc && o.goc.pk] ? o.goc.pk : GOC_MAC_DINH, nep: soN(o.goc && o.goc.nep, 30, 100) || BO.nep_goc, nep_tren: soN(o.goc && o.goc.nep_tren, 30, 100) || BO.nep_goc } : null;
    // (vòng soát 1.34) không nhận ghim tủ góc: chữ L luôn tự đặt tủ góc
    const khoa = {};
    if (o.khoa && typeof o.khoa === 'object') for (const vt of Object.keys(o.khoa)) {
      const q = o.khoa[vt], mq = q && typeof q === 'object' ? mauDuoiBo(q.ma) : null; if (!mq || mq.chuc_nang === 'goc' || soN(q.s0, 0, 20000) === null) continue;
      if (kieu === 'I' && num(q.canh, 0) === 1) continue;      // (vòng soát 2 — 1.34) chữ L → chữ I: tủ ghim ở cạnh B không còn chỗ — bỏ
      khoa[String(vt).slice(0, 12)] = { ma: q.ma, s0: soN(q.s0, 0, 20000), canh: ci(q.canh) };
    }
    // (vòng soát 2 — 1.34) tủ chậu / bếp đã ghim quyết định cạnh của chậu / bếp
    for (const vt of Object.keys(khoa)) { const m = mauDuoiBo(khoa[vt].ma); if (m && m.chuc_nang === 'chau') chau.canh = khoa[vt].canh; else if (m && m.chuc_nang === 'bep' && kieu === 'L') bep.canh = khoa[vt].canh; }
    const chuan = {};
    if (o.chuan && typeof o.chuan === 'object') for (const k of KHOA_CHUAN_BEP) if (k in o.chuan) chuan[k] = o.chuan[k];
    const ro = Array.isArray(o.ro) ? Object.keys(BO_RO).filter(k => o.ro.indexOf(k) >= 0) : BO_RO_MAC_DINH.slice();
    const tran = 'tran' in o ? (num(o.tran, 0) === 0 ? 0 : soN(o.tran, 2000, 4000) || BO.tran) : cu ? 0 : BO.tran;
    // (vòng soát 1.35) tủ cánh kính chọn theo CHỖ { canh, s = điểm dọc cạnh theo trục tủ } — mã vị trí đánh lại sau mỗi lần chia (kính trôi sang tủ khác); dạng mã cũ bỏ
    const kinh = o.kinh === 'bat' || o.kinh === 'khong' ? o.kinh : Array.isArray(o.kinh) ? o.kinh.filter(v => v && typeof v === 'object' && soN(v.s, -1000, 20000) !== null).map(v => ({ canh: ci(v.canh), s: soN(v.s, -1000, 20000) })).slice(0, 40) : cu ? 'khong' : 'bat';
    return { v: 2, ma: String(o.ma == null || o.ma === '' ? 'B1' : o.ma).trim().slice(0, 16) || 'B1', kieu, canh, tl, tl2, cao, chau, bep, co, ro, hm: o.hm === 'kinh' ? 'kinh' : 'am',
      vs: [0, 380, 460].indexOf(num(o.vs, VS_MAC_DINH)) >= 0 ? num(o.vs, VS_MAC_DINH) : VS_MAC_DINH, goc, khoa, ong, cua_so: cs, chuan, tran, kinh, led: typeof o.led === 'boolean' ? o.led : !cu,
      ...(o.ke === true ? { ke: true } : {}), ...(coLui ? { co_lui: co } : {}) };      // ke: "+ Kệ" (kệ hở sát đầu hở) — chỉ có khoá khi bật
  }
  /**
   * (bản 1.35) "+ Tủ lạnh" ở một đầu dãy (bấm lần nữa = bỏ) — hàm thuần. q = { canh (chữ L: 0 = đầu xa góc cạnh A, 1 = cạnh B), dau ('dau' | 'cuoi' — chữ I), may?, kieu? }.
   * Đầu đó đã có tủ lạnh → bỏ (bỏ tủ lạnh chính mà còn tủ lạnh thứ hai thì cái đó thành chính, tủ lò / kho đi theo tủ lạnh chính); chưa có → thêm (máy / kiểu theo q,
   * không có thì 2 cánh 700 dương). Có q.kieu / q.may khi đầu đó đã có tủ lạnh → đổi máy / kiểu (đổi kiểu thì hở về mặc định của kiểu mới). @returns bộ đã chuanBo
   */
  function tlBo(boIn, q) {
    const bo = chuanBo(boIn), o = clone(bo), L = bo.kieu === 'L'; q = q && typeof q === 'object' ? q : {};
    const canh = L && num(q.canh, 0) === 1 ? 1 : 0, dau = L ? (canh === 0 ? 'dau' : 'cuoi') : q.dau === 'cuoi' ? 'cuoi' : 'dau';
    const o1 = x => x && (L ? x.canh === canh : x.dau === dau);
    const doi = 'kieu' in q || 'may' in q, moi = x => { const n = Object.assign({}, x || {}, { canh, dau }); if ('may' in q) n.may = q.may; if ('kieu' in q && (!x || x.kieu !== q.kieu)) { n.kieu = q.kieu; for (const k of Object.keys(TL_HO)) delete n[k]; if (!('may' in q)) delete n.may; } return n; };
    if (o1(o.tl)) { if (doi) o.tl = moi(o.tl); else { o.tl = o.tl2 || null; o.tl2 = null; if (o.tl === null) o.tl = null; } }
    else if (o1(o.tl2)) { if (doi) o.tl2 = moi(o.tl2); else o.tl2 = null; }
    else if (!o.tl) o.tl = moi(null);
    else o.tl2 = moi(null);
    if (o.tl === null) delete o.tl2;
    return chuanBo(o);
  }
  /** Chuẩn bếp của bộ (mặc định + bo.chuan, kẹp như normBep) + các số dùng xuyên suốt. (1.35) zT2 = đỉnh tầng dưới, h2 = cao tầng trên kịch trần (0 = không làm). */
  function soBo(bo, nen) {
    const B = Object.assign({}, DEFAULT_BEP, bo.chuan);
    for (const k of Object.keys(SO_BEP)) B[k] = Math.max(SO_BEP[k][0], Math.min(SO_BEP[k][1], num(B[k], DEFAULT_BEP[k])));
    const v = (nen && nen.van) || DEFAULT_SPEC.van, t = num(v.t, DEFAULT_SPEC.van.t), tc = num(v.t_canh, DEFAULT_SPEC.van.t_canh);
    const F = rn(B.sau_duoi + tc + B.cach_tuong), Pt = rn(B.sau_tren + tc), sauDa = rn(F + B.dua_da), zTren = rn(B.cao_mat + B.cach_tren);
    const zT2 = rn(zTren + B.cao_tren), tran = num(bo.tran, 0), h2r = tran > 0 ? rn(tran - zT2 - BO.khe_tran) : 0, h2 = h2r >= BO.tang2_min - TOL ? h2r : 0;
    return { B, t, tc, F, Pt, sauDa, zTren, zHMK: rn(zTren + B.cao_tren - CAO_CHE_ONG), khe: DEFAULT_SPEC.canh.khe, zT2, h2, h2_thieu: tran > 0 && !h2 ? h2r : null };
  }
  /** Thùng của một tủ trong dãy theo toạ độ u (bỏ nẹp / ốp ở hai đầu) — tâm chậu / bếp / tủ lạnh tính theo thùng, không theo module. */
  const thungU = (m, lat) => { const n = m.nep || {}, a = (lat ? n.phai : n.trai) || 0, b = (lat ? n.trai : n.phai) || 0, op = rn(m.u1 - m.u0 - m.rong - a - b, 2), oa = m.op === (lat ? 'phai' : 'trai') ? op : 0; return [rn(m.u0 + a + oa, 2), rn(m.u0 + a + oa + m.rong, 2)]; };
  const tlMay = tl => Object.assign(tl.may && typeof tl.may === 'object' ? Object.assign({}, tl.may) : { ma: tl.may }, tl.kieu === 'am' ? { kieu: 'am' } : {});
  /** (bản 1.35) khối cao theo đầu dãy: tủ lạnh chính (ngoài cùng) + lò / kho ở một đầu, tủ lạnh thứ hai ở đầu kia. ds xếp từ NGOÀI vào. */
  function khoiCaoBo(bo, t) {
    const L = bo.kieu === 'L', out = [], wTL = tl => rn(tbBep('tl', tlMay(tl), 0).rong + 2 * tl.ho_hong + 2 * t), ben = tl => (L ? 'cuoi' : tl.dau);
    const ds0 = [];
    if (bo.tl) ds0.push({ loai: 'tl', w: wTL(bo.tl), tl: bo.tl, tl_i: 0 });
    for (const c of bo.cao) ds0.push({ loai: c.loai, w: c.rong });
    if (ds0.length) out.push({ canh: bo.tl ? bo.tl.canh : 0, ben: bo.tl ? ben(bo.tl) : (L ? 'cuoi' : 'dau'), ds: ds0 });
    if (bo.tl && bo.tl2) out.push({ canh: bo.tl2.canh, ben: ben(bo.tl2), ds: [{ loai: 'tl', w: wTL(bo.tl2), tl: bo.tl2, tl_i: 1 }] });
    return out;
  }
  /**
   * Tự chia dãy bếp — LUẬT CHIA 1.35 (anh Thanh 14/10/2026, thay hàm chấm điểm 1.34):
   *   1. chậu và bếp CÙNG một cỡ 700 / 800 / 900 (bo.co; tự chọn theo dài phần dãy dưới: ≥ co_900 → 900, ≥ co_800 → 800, còn lại 700 — không xếp được thì lùi cỡ);
   *   2. khoang rổ đúng cỡ rổ: gia vị 300 kề bếp phía xa chậu, thùng rác 300 (rồi gạo) kề chậu phía xa bếp — không đủ chỗ thì bỏ (phương án thiếu rổ đắt hơn);
   *   3. mọi khoang còn lại (cánh / ngăn kéo — ngăn kéo kề bếp) CHIA ĐỀU một bề rộng, tròn 5 mm, 150 … 900 (< 300 thành kệ hở), dư dồn vào nẹp đầu sát tường
   *      (đầu hở / góc nhận khi không tường nào nhận; dư vượt sức nẹp thì +5 vào vài khoang); tủ ghim / tâm chậu gõ là mốc — mỗi đoạn giữa hai mốc chia đều riêng;
   *   4. thứ tự: khối cao (tủ lạnh → lò → kho) ở đầu dãy, chậu theo ống / tâm gõ / cửa sổ (không có: chậu về phía tủ lạnh — tủ lạnh → chậu → sơ chế → bếp), bếp cách
   *      tường / tủ cao ≥ 300, giữa chậu và bếp ít nhất một khoang; chọn phương án: đều nhau > ít khoang > đủ rổ > sơ chế 800 – 1200 > nẹp gần chuẩn.
   * @param bo bộ bếp (chuanBo), opt.nen = spec nền (Chuẩn xưởng: dày ván), opt.so = số phương án (mặc định 3)
   * @returns { bo, pa: [{ ds: [{ vt, canh, tang, ma, rong (thùng), u0, u1, s0, dai, nep?, op?, z, le?, ghim?, ben?, chuc, t2?, cao? }], canh: [{ dai, lat, dau, cuoi }],
   *           da, goc, so_che, cost, tang2, loi, canh_bao, luu_y }], loi_chung: string[] }
   *   chỉ trả phương án KHÔNG có LỖI (kiemDay sạch), tối đa 3, chi phí tăng dần; không có thì loi_chung nói vì sao.
   */
  function xepBep(boIn, opt) {
    const r = xepBep2(boIn, opt), b = r.bo;
    // (bản 1.35) GHIM KHÔNG XÔ LỆCH: tủ ghim / "Đổi thành" đứng đúng chỗ + đúng rộng của một phương án khi KHÔNG ghim → phương án cùng mối nối với phương án đó lên đầu
    // (ghim cắt cạnh thành hai đoạn chia riêng — đoạn sau có khi gộp hai khoang 355 thành một 710 rẻ hơn; người dùng chỉ đổi MỘT tủ, các tủ khác phải đứng yên)
    const ks = Object.keys(b.khoa);
    if (!ks.length || (opt && opt.khong_uu_ghim)) return r;
    const r0 = xepBep(Object.assign({}, boIn, { khoa: {} }), Object.assign({}, opt, { khong_uu_ghim: true }));
    const s0T = m => rn(m.s0 + ((m.nep && m.nep.trai) || 0) + (m.op === 'trai' ? num(((opt && opt.nen) || DEFAULT_SPEC).van.t_canh, DEFAULT_SPEC.van.t_canh) : 0), 2);
    const wMa = ma => { const k = /-(\d+(?:\.\d+)?)(?:-[TP])?$/.exec(ma || ''); return k ? Number(k[1]) : NaN; };
    const vua = pa => ks.every(vt => { const q = b.khoa[vt]; return pa.ds.some(m => m.tang === 'duoi' && m.canh === q.canh && Math.abs(s0T(m) - q.s0) < 0.5 && Math.abs(m.rong - wMa(q.ma)) < 0.5); });
    const moc = pa => JSON.stringify(pa.ds.filter(m => m.tang !== 'tren').map(m => [m.canh, rn(m.s0, 1), rn(m.dai, 1)]).sort((x, y) => x[0] - y[0] || x[1] - y[1]));
    const p0 = r0.pa.find(vua); if (!p0) return r;
    // (vòng soát 1.35) tủ ghim "Đổi thành" đứng đúng chỗ một khoang RỔ của phương án đó (gia vị → thùng gạo): rổ cũ đã được thay — chia lại không đòi lại nó
    const thay = ks.map(vt => { const q = b.khoa[vt], m = p0.ds.find(x => x.tang === 'duoi' && x.canh === q.canh && Math.abs(s0T(x) - q.s0) < 0.5), mq = mauDuoiBo(q.ma);
      return m && BO_RO[m.chuc] && mq && mq.chuc_nang !== m.chuc ? m.chuc : null; }).filter(Boolean);
    let rr = r;
    if (thay.length) { const r2 = xepBep2(boIn, Object.assign({}, opt, { ro_bo: thay })); if (r2.pa.length) rr = r2; }
    const k = rr.pa.findIndex(pa => moc(pa) === moc(p0));
    if (k > 0) rr.pa.unshift(rr.pa.splice(k, 1)[0]);
    return rr;
  }
  function xepBep2(boIn, opt) {
    const r = xepBep1(boIn, opt), b = r.bo;
    // (vòng soát 3 — 1.34) chữ L: chậu không ống / tâm gõ / ghim mà cạnh đang đặt không xếp được → thử cạnh kia
    if (r.pa.length || b.kieu !== 'L' || b.ong || b.chau.s !== null || Object.keys(b.khoa).some(vt => /^BD-CHAU-/.test(b.khoa[vt].ma))) return r;
    const c = 1 - b.chau.canh, r2 = xepBep1(Object.assign({}, boIn, { chau: Object.assign({}, b.chau, { canh: c }) }), opt);
    if (!r2.pa.length) { r.loi_chung = r.loi_chung.concat([`Chậu ở cạnh ${'AB'[c]} cũng không xếp được.`]); return r; }
    for (const p of r2.pa) p.luu_y.unshift(`Cạnh ${'AB'[1 - c]} không đủ chỗ cho chậu — bảng tự đặt chậu ở cạnh ${'AB'[c]} (đổi ở ⋯ → Chậu ở).`);
    r2.chau_tu = c;
    return r2;
  }
  // tổ hợp: mọi cách trộn hai dãy giữ thứ tự từng dãy; mọi cách chia N vào các ô (mỗi ô trong [lo, hi])
  const tronDay = (A, P) => (!A.length ? [P.slice()] : !P.length ? [A.slice()] : tronDay(A.slice(1), P).map(x => [A[0]].concat(x)).concat(tronDay(A, P.slice(1)).map(x => [P[0]].concat(x))));
  function chiaSo(N, lo, hi) {
    const out = [], k = lo.length, cur = [];
    const di = (j, con) => { if (out.length > 400) return; if (j === k - 1) { if (con >= lo[j] && con <= hi[j]) out.push(cur.concat([con])); return; } for (let x = lo[j]; x <= Math.min(hi[j], con); x++) { cur.push(x); di(j + 1, con - x); cur.pop(); } };
    if (k) di(0, N);
    return out;
  }
  function xepBep1(boIn, opt) {
    opt = opt || {};
    const bo = chuanBo(boIn), Q = soBo(bo, opt.nen), { B, t, tc, F } = Q, L = bo.kieu === 'L';
    const G = L ? gocBep(bo.goc.pk, { chuan: B, tc, nep: bo.goc.nep, nep_tren: bo.goc.nep_tren }) : null;
    if (G && G.loi.length) return { bo, pa: [], loi_chung: G.loi.slice() };
    // cạnh theo khung u: dau = phía u = 0 (góc với chữ L), cuoi = phía u = dài; khối cao theo đầu
    const KC = khoiCaoBo(bo, t);
    const E = bo.canh.map((c, i) => {
      const e = { i, ten: 'AB'[i], dai: c.dai, lat: L ? (i === 0) === (bo.canh[1].re !== 'trai') : false, dau: L ? 'goc' : c.dau, cuoi: L ? (i === 0 ? c.dau : c.cuoi) : c.cuoi, cao: { dau: [], cuoi: [] } };
      for (const k of KC) if (k.canh === i) e.cao[k.ben] = e.cao[k.ben].concat(k.ds);
      e.wCao = { dau: rn(sum(e.cao.dau.map(x => x.w)), 2), cuoi: rn(sum(e.cao.cuoi.map(x => x.w)), 2) };
      return e;
    });
    // phần cố định + chỗ nhận dư của từng cạnh (nẹp tường: min chuẩn, tới 150 khi không cách nào khác — cảnh báo; tủ lạnh bản lề phía tường: nẹp ≥ 50)
    for (const e of E) {
      e.fix = 0; e.hut = [];
      for (const b of ['dau', 'cuoi']) {
        const k = e[b];
        if (k === 'ho') e.fix += tc;
        else if (k === 'tuong') { const c0 = e.cao[b][0]; e.hut.push({ k: 'nep_' + b, ben: b, min: c0 && c0.loai === 'tl' && c0.tl.ban_le === 'tuong' ? 50 : B.nep_tuong, max: BO.nep_qua }); }
      }
      e.fix += e.wCao.dau + e.wCao.cuoi;
      if (L && e.i === 0) { e.fix += G.X + G.Wg; e.hut.push({ k: 'delta', ben: 'dau', min: 0, max: 50 }); }
      if (L && e.i === 1) { e.fix += F; e.hut.push({ k: 'nep_goc', ben: 'dau', min: G.N, max: G.N + 50 }); }
      e.fix = rn(e.fix, 2);
      e.hutMin = rn(sum(e.hut.map(h => h.min)), 2);
      e.Lmax = rn(e.dai - e.fix - e.hutMin, 2);
    }
    const vMin = e => { const v = {}; e.hut.forEach(h => { v[h.k] = h.min; }); return v; };
    const r0Cua = (e, v) => rn(e.dau === 'goc' ? (e.i === 0 ? G.X + (v.delta || 0) + G.Wg : F + v.nep_goc) : (e.dau === 'ho' ? tc : v.nep_dau) + e.wCao.dau, 2);
    const r1Cua = (e, v) => rn(e.dai - (e.cuoi === 'ho' ? tc : v.nep_cuoi) - e.wCao.cuoi - (v.du || 0), 2);
    // chia phần dư R (= tổng các chỗ nhận) của một cạnh: hai đầu tường chữ I chia đều (tròn 5, phần lẻ về phía khối cao); còn lại: nẹp tường trước (tới 100),
    // rồi góc (tủ góc phình / nẹp góc), rồi nẹp tới 150; không chỗ nào nhận (hai đầu hở): dư < 20 để ở đầu cuối (LƯU Ý)
    const chia2 = (e, R) => {
      const v = vMin(e);
      let rem = rn(R - e.hutMin, 2);
      if (rem < -TOL) return null;
      const them = (k, x, cap) => { const h = e.hut.find(q => q.k === k); if (!h) return 0; const a = Math.max(0, Math.min(x, h.max - v[k], cap === undefined || !isFinite(cap) ? Infinity : cap)); v[k] = rn(v[k] + a, 2); return a; };
      if (!L && 'nep_dau' in v && 'nep_cuoi' in v) {
        const p = e.cao.cuoi.length && !e.cao.dau.length ? 'nep_cuoi' : 'nep_dau', q = p === 'nep_dau' ? 'nep_cuoi' : 'nep_dau', D = rn(R, 2), hp = e.hut.find(h => h.k === p), hq = e.hut.find(h => h.k === q);
        let a = ceil5(D / 2), b = rn(D - a, 2);
        if (b < hq.min) { b = hq.min; a = rn(D - b, 2); }
        if (a < hp.min) { a = hp.min; b = rn(D - a, 2); }
        v[p] = a; v[q] = b; rem = 0;
      } else {
        for (const h of e.hut) if (h.k === 'nep_dau' || h.k === 'nep_cuoi') rem -= them(h.k, rem, BO.nep_max - v[h.k]);
        for (const h of e.hut) if (h.k === 'delta' || h.k === 'nep_goc') rem -= them(h.k, rem);
        for (const h of e.hut) if (h.k === 'nep_dau' || h.k === 'nep_cuoi') rem -= them(h.k, rem);
      }
      if (!e.hut.length && rem > TOL && rem < DU_CHI - TOL) { v.du = rn(rem, 2); rem = 0; }
      if (Math.abs(rem) > TOL) return null;
      for (const h of e.hut) if (v[h.k] < h.min - TOL || v[h.k] > h.max + TOL) return null;
      return v;
    };
    // phần dư d của đoạn sát một đầu vào chỗ nhận của đầu đó (đoạn có mốc ở giữa)
    const ganBen = (e, v, ben, d) => {
      d = rn(d, 2); if (d < -TOL) return false; if (d < TOL) return true;
      const h = e.hut.find(q => q.ben === ben);
      if (h) { if (v[h.k] + d > h.max + TOL) return false; v[h.k] = rn(v[h.k] + d, 2); return true; }
      if (ben === 'cuoi' && d < DU_CHI - TOL) { v.du = rn((v.du || 0) + d, 2); return true; }
      return false;
    };
    // N khoang chia đều chiều dài len − Fx: bề rộng tròn 5 (xuống), d = phần dư; bump = dồn dư +5 vào các khoang (het: phần lẻ < 5 vào khoang cuối — cỡ lẻ)
    const chiaDeu = (len, Fx, N) => {
      const T = rn(len - Fx, 2);
      if (!N) return T < -TOL ? null : { ws: [], d: Math.max(0, T) };
      const w = floor5(T / N); if (w > BO.e_max + TOL || w < BO.e_min - TOL) return null;
      return { ws: Array(N).fill(w), d: rn(T - N * w, 2) };
    };
    const bump = (ws, d, het) => {
      if (!ws.length) return d > TOL ? null : { ws: [], d: 0 };
      const o = ws.slice(); let k = Math.floor(d / 5 + 1e-9); const r = rn(d - 5 * k, 2);
      for (let j = 0; j < o.length && k > 0; j++, k--) o[j] = rn(o[j] + 5, 2);
      if (het && r > TOL && o.length) o[o.length - 1] = rn(o[o.length - 1] + r, 2);
      return o.some(w => w > BO.e_max + 5 + TOL) ? null : { ws: o, d: het ? 0 : r };
    };
    /** Đặt một cạnh: tok = các thứ có bề rộng cố định (theo u; x.anchor = u0 cố định), n[s] = số khoang chia đều trong ô s (trước tok[s]; n[tok.length] = sau cùng). */
    const datCanh = (e, tok, n) => {
      // mốc (tủ ghim / chậu theo tâm) mà cách chia đều cả cạnh đã đặt đúng chỗ thì giữ cách chia đều đó — ghim lại đúng tủ đang có không làm xê dịch tủ khác
      // tủ ghim là khoang chia đều (cánh / ngăn kéo / kệ): coi như một khoang của phép chia đều — đúng bề rộng + đúng chỗ thì thay khoang đó bằng tủ ghim
      if (tok.some(x => x.anchor !== undefined)) {
        const tok2 = [], n2 = [n[0]], laE = x => x.anchor !== undefined && x.k === 'ghim' && /^BD-(CANH|NK3|KE)-/.test(x.ma);
        tok.forEach((x, i) => { if (laE(x)) n2[n2.length - 1] += 1 + n[i + 1]; else { const y = Object.assign({}, x); delete y.anchor; tok2.push(y); n2.push(n[i + 1]); } });
        const thu = datCanh(e, tok2, n2);
        if (thu) {
          let hop = true;
          for (const x of tok) if (x.anchor !== undefined) {
            const j = thu.items.findIndex(y => Math.abs(y.u0 - x.anchor) < 0.5 && (laE(x) ? y.deu && Math.abs(y.w - x.w) < 0.5 : y.k === x.k && y.ma === x.ma));
            if (j < 0) { hop = false; break; }
            if (laE(x)) { const y = Object.assign({}, x, { u0: thu.items[j].u0, u1: thu.items[j].u1 }); delete y.anchor; delete y.cum; thu.items[j] = y; }
          }
          if (hop) return thu;
        }
      }
      const segs = []; let a = -1;
      tok.forEach((x, j) => { if (x.anchor !== undefined) { segs.push([a, j]); a = j; } }); segs.push([a, tok.length]);
      const v = vMin(e), r0m = r0Cua(e, v), r1m = r1Cua(e, v), cho = [];
      for (const [lo, hi] of segs) {
        const Fx = rn(sum(tok.slice(lo + 1, hi).map(x => x.w)), 2), N = sum(n.slice(lo + 1, hi + 1));
        const st = lo < 0 ? null : rn(tok[lo].anchor + tok[lo].w, 2), en = hi >= tok.length ? null : tok[hi].anchor;
        const q = chiaDeu(st === null && en === null ? r1m - r0m : st === null ? en - r0m : en === null ? r1m - st : en - st, Fx, N); if (!q) return null;
        let ws = q.ws;
        if (st === null && en === null) {
          let vv = chia2(e, rn(e.hutMin + q.d, 2));
          if (!vv) { const b = bump(q.ws, q.d, false); if (!b) return null; vv = chia2(e, rn(e.hutMin + b.d, 2)); ws = b.ws; if (!vv) return null; }
          Object.assign(v, vv);
        } else if (st !== null && en !== null) { if (q.d > TOL) { const b = bump(q.ws, q.d, true); if (!b || (!b.ws.length)) return null; ws = b.ws; } }
        else if (!ganBen(e, v, st === null ? 'dau' : 'cuoi', q.d)) { const b = bump(q.ws, q.d, true); if (!b || !b.ws.length) return null; ws = b.ws; }
        cho.push({ lo, hi, ws, st });
      }
      const r0 = r0Cua(e, v), r1 = r1Cua(e, v), items = [];
      for (const c of cho) {
        let u = c.st === null ? r0 : c.st, wi = 0;
        for (let s = c.lo + 1; s <= c.hi; s++) {
          for (let j = 0; j < n[s]; j++) { const w = c.ws[wi++]; items.push({ k: 'E', w, u0: rn(u, 2), u1: rn(u + w, 2) }); u = rn(u + w, 2); }
          if (s < c.hi) { const x = tok[s]; items.push(Object.assign({}, x, { u0: rn(u, 2), u1: rn(u + x.w, 2) })); u = rn(u + x.w, 2); }
        }
        if (c.hi < tok.length) { const x = tok[c.hi]; if (Math.abs(u - x.anchor) > 0.5) return null; items.push(Object.assign({}, x, { u0: x.anchor, u1: rn(x.anchor + x.w, 2) })); }
        else if (Math.abs(u - r1) > 0.5) return null;
      }
      for (const x of items) { delete x.anchor; delete x.cum; }
      // loại khoang chia đều: < 300 kệ hở; kề bếp (≥ 400) ngăn kéo; còn lại cánh. Bề rộng không tròn 5 (phần lẻ giữa hai mốc) = cỡ lẻ
      items.forEach((x, j) => {
        if (x.k !== 'E') return;
        const keBep = [items[j - 1], items[j + 1]].some(y => y && y.k === 'bep');
        x.k = 'lap'; x.loai = x.w < 300 - TOL ? 'KE' : keBep && x.w >= BO.nk_min - TOL ? 'NK3' : 'CANH'; x.le = Math.abs(x.w / 5 - Math.round(x.w / 5)) > 1e-6; x.deu = true;
      });
      return { v, r0, r1, S: rn(r1 - r0, 2), items };
    };
    // cỡ chậu = bếp
    const runTong = sum(E.map(e => Math.max(0, e.Lmax)));
    const uCua = (e, s) => (e.lat ? rn(e.dai - s, 2) : s);
    const ec = Math.min(bo.chau.canh, E.length - 1), ebs = L ? (bo.bep.canh === null ? [1, 0] : [bo.bep.canh]) : [0];
    const ongU = bo.ong && bo.ong.canh === ec ? uCua(E[ec], bo.ong.s) : null;
    const pins = Object.keys(bo.khoa).map(vt => { const q = bo.khoa[vt], m = mauDuoiBo(q.ma), w = num(/-(\d+(?:\.\d+)?)(?:-[TP])?$/.exec(q.ma)[1], 0), e = E[q.canh];
      return e ? { vt, ma: q.ma, w, e: q.canh, u0: e.lat ? rn(e.dai - q.s0 - w, 2) : q.s0, chuc: m.chuc_nang } : null; }).filter(Boolean);
    const pinChau = pins.find(p => p.chuc === 'chau'), pinBep = pins.find(p => p.chuc === 'bep'), pinKhac = pins.filter(p => p !== pinChau && p !== pinBep);
    const co0 = bo.co || (runTong >= BO.co_900 - TOL ? 900 : runTong >= BO.co_800 - TOL ? 800 : 700);
    let dsCo = bo.co ? (bo.co_lui ? BO_CO.filter(c => c <= bo.co) : [bo.co]) : BO_CO.filter(c => c <= co0);
    if (pinChau || pinBep) dsCo = [pinChau ? pinChau.w : pinBep.w];      // tủ chậu / bếp ghim: đúng cỡ của mẫu đã ghim
    const toiThieu = () => rn(sum(E.map(e => e.fix + e.hutMin)) + BO.bep_dau + 700 + 200 + 700);
    if (L && E[1].dai < F + G.N + BO.bep_dau - TOL) return { bo, pa: [], loi_chung: [`Cạnh B ${g(E[1].dai)} ngắn hơn ${g(rn(F + G.N + BO.bep_dau))} (sâu tủ cạnh A ${g(F)} + nẹp góc ${g(G.N)} + 300) — không đặt được tủ nào sau góc.`] };
    if (E.some(e => e.Lmax < -TOL)) return { bo, pa: [], loi_chung: [`Dãy ngắn hơn tối thiểu ${g(toiThieu())} (khối cao + nẹp + chậu + bếp) — bớt tủ cao hoặc tăng dài.`] };
    // tâm mục tiêu của chậu: tâm gõ > ống > cửa sổ; bếp: tâm gõ
    const tamChau = pinChau ? null : bo.chau.s !== null ? uCua(E[ec], bo.chau.s) : ongU !== null ? ongU : bo.cua_so && bo.cua_so.canh === ec ? uCua(E[ec], (bo.cua_so.s0 + bo.cua_so.s1) / 2) : null;
    // thứ tự mặc định chữ I (không tâm chậu): chậu về phía tủ lạnh (tủ lạnh → chậu → sơ chế → bếp); không / hai tủ lạnh: chậu bên phải
    const chauPhia = !L && tamChau === null ? (bo.tl && !bo.tl2 ? (bo.tl.dau === 'dau' ? 'dau' : 'cuoi') : 'cuoi') : null;
    // (vòng soát 1.35) rổ đã GHIM (cùng loại) là rổ của cụm chậu / bếp — không sinh rổ thứ hai; opt.ro_bo = rổ mà tủ ghim "Đổi thành" đã thay chỗ (xepBep)
    const roGhim = pins.filter(p => BO_RO[p.chuc]).map(p => p.chuc), roBo = Array.isArray(opt.ro_bo) ? opt.ro_bo : [];
    const muonRo = k => bo.ro.indexOf(k) >= 0 && roGhim.indexOf(k) < 0 && roBo.indexOf(k) < 0;
    const tokRo = k => ({ k: 'ro', loai: BO_RO[k][0], w: BO_RO[k][1] });
    // mép của các thứ cố định không phải chậu / bếp (tường / hở / khối cao / mặt tủ cạnh kia) — bếp phải cách ≥ 300
    const bien = (e, r) => ({ a: e.cao.dau.length ? r.r0 : e.dau === 'goc' ? (e.i === 0 ? -Infinity : F) : 0, b: e.cao.cuoi.length ? r.r1 : rn(e.dai - (r.v.du || 0), 2) });
    // mép trong của từng tủ lạnh trên cạnh + "chỉ mình nó ở đầu đó" (mặt đặt đồ cạnh tay nắm)
    const tlCua = (e, r) => { const o = []; for (const b of ['dau', 'cuoi']) { const c0 = e.cao[b][0]; if (c0 && c0.loai === 'tl') o.push({ ben: b, tl: c0.tl, mot: e.cao[b].length === 1, u: b === 'dau' ? rn(r.r0 - e.wCao.dau + c0.w, 2) : rn(r.r1 + e.wCao.cuoi - c0.w, 2) }); } return o; };
    const ung = [];
    for (const co of dsCo) {
      if (ung.length) break;
      const coC = pinChau ? pinChau.w : co, coB = pinBep ? pinBep.w : co, lotC = rn(coC - 2 * t);
      // lượt: 'deu' (chia đều, chậu / bếp quanh tâm ±150) → 'moc' (chậu / bếp là mốc quanh tâm, mỗi đoạn chia đều riêng) → 'doan' (mốc chậu bất kỳ trên lưới 50)
      for (const luot of ['deu', 'moc', 'doan']) {
        if (ung.length) break;
        if (luot === 'moc' && tamChau === null && bo.bep.s === null) continue;
        for (const eb of ebs) {
          const coBepTren = eb, cung = ec === eb;
          // ứng viên từng cạnh
          const ungCanh = E.map((e, i) => {
            const coC_ = i === ec, coB_ = i === eb, out = [];
            const pinE = pinKhac.filter(p => p.e === i).map(p => ({ k: 'ghim', ma: p.ma, w: p.w, ghim: true, vt: p.vt, chuc: p.chuc, anchor: p.u0, ...(/^BD-KE-/.test(p.ma) ? { loai: 'KE' } : {}) }));
            // kệ "+ Kệ" ở đầu hở (không phải đầu có khối cao); tủ ghim ở chỗ kệ thì thay kệ
            const ke = {};
            if (bo.ke) for (const b of ['dau', 'cuoi']) if (e[b] === 'ho' && !e.cao[b].length && e.Lmax >= BO_KE_DAU - TOL) {
              const v0 = vMin(e), u0 = b === 'dau' ? r0Cua(e, v0) : rn(r1Cua(e, v0) - BO_KE_DAU, 2);
              if (pins.some(p => p.e === i && p.u0 < u0 + BO_KE_DAU + 50 - TOL && u0 - 50 < p.u0 + p.w - TOL)) continue;
              ke[b] = { k: 'ke', loai: 'KE', ma: `BD-KE-${BO_KE_DAU}`, w: BO_KE_DAU };
            }
            // phía XA của chậu / bếp (theo u): cùng cạnh — phía không có cái kia; khác cạnh (chữ L) — phía xa góc
            const tokC = (anchor) => Object.assign({ k: 'chau', ma: `BD-CHAU-${coC}`, w: coC }, pinChau ? { ghim: true, vt: pinChau.vt, anchor: pinChau.u0 } : anchor !== undefined ? { anchor } : {});
            const tokB = (anchor) => Object.assign({ k: 'bep', ma: `BD-BEP-${coB}`, w: coB }, pinBep ? { ghim: true, vt: pinBep.vt, anchor: pinBep.u0 } : anchor !== undefined ? { anchor } : {});
            const roC = [[]], roB = [[]];
            { const ds = ['rac', 'gao'].filter(muonRo); for (let j = 1; j <= ds.length; j++) roC.push(ds.slice(0, j)); if (muonRo('gv')) roB.push(['gv']); }
            // mốc của chậu / bếp theo lượt
            const mocC = [undefined], mocB = [undefined];
            if (coC_ && !pinChau && luot !== 'deu') {
              mocC.length = 0;
              if (luot === 'moc' && tamChau !== null) { const u = floor5(tamChau - coC / 2 + 2.5); for (let d = -150; d <= 150; d += 25) mocC.push(rn(u + d, 2)); }
              else if (luot === 'doan') { const r0 = r0Cua(e, vMin(e)); for (let u = r0; u + coC <= r0 + e.Lmax + TOL; u += 50) mocC.push(rn(u, 2)); }
              if (!mocC.length) mocC.push(undefined);
            }
            if (coB_ && !pinBep && luot === 'moc' && bo.bep.s !== null) { mocB.length = 0; const u = floor5(uCua(e, bo.bep.s) - coB / 2 + 2.5); for (let d = -150; d <= 150; d += 25) mocB.push(rn(u + d, 2)); }
            const thuTu = coC_ && coB_ ? [true, false] : [true];      // cùng cạnh: chậu trước (u nhỏ) / bếp trước
            for (const chauTruoc of thuTu) for (const rc of coC_ ? roC : [[]]) for (const rb of coB_ ? roB : [[]]) for (const mc of mocC) for (const mb of mocB) {
              const xaC = coC_ && coB_ ? (chauTruoc ? 'trai' : 'phai') : 'phai', xaB = coC_ && coB_ ? (chauTruoc ? 'phai' : 'trai') : 'phai';
              const unitC = coC_ ? (xaC === 'trai' ? rc.slice().reverse().map(tokRo).concat([tokC(mc)]) : [tokC(mc)].concat(rc.map(tokRo))) : null;
              const unitB = coB_ ? (xaB === 'trai' ? rb.map(tokRo).concat([tokB(mb)]) : [tokB(mb)].concat(rb.map(tokRo))) : null;
              const units = [unitC, unitB].filter(Boolean); if (coC_ && coB_ && !chauTruoc) units.reverse();
              units.forEach((u, j) => u.forEach(x => { x.cum = j + 1; }));      // rổ dính liền chậu / bếp của nó: không khoang nào chen giữa
              const thieuRo = (coC_ ? ['rac', 'gao'].filter(muonRo).length - rc.length : 0) + (coB_ ? (muonRo('gv') ? 1 : 0) - rb.length : 0);
              const anchored = units.filter(u => u.some(x => x.anchor !== undefined));
              // trộn các cụm (chậu / bếp) với tủ ghim giữ thứ tự u; cụm có mốc phải nằm đúng thứ tự mốc
              for (const tr of tronDay(units, pinE.slice().sort((p, q) => p.anchor - q.anchor))) {
                const tok = [].concat(ke.dau ? [ke.dau] : [], ...tr.map(x => (Array.isArray(x) ? x : [x])), ke.cuoi ? [ke.cuoi] : []);
                const an = tok.filter(x => x.anchor !== undefined); if (an.some((x, j) => j && x.anchor < an[j - 1].anchor + an[j - 1].w - TOL)) continue;
                const lo = Array(tok.length + 1).fill(0), hi = Array(tok.length + 1).fill(99);
                for (let s = 1; s < tok.length; s++) { const p = tok[s - 1].k, q = tok[s].k; if ((p === 'chau' && q === 'bep') || (p === 'bep' && q === 'chau')) lo[s] = 1; if (tok[s - 1].cum && tok[s - 1].cum === tok[s].cum) hi[s] = 0; }
                if (ke.dau) hi[0] = 0; if (ke.cuoi) hi[tok.length] = 0;
                if (L && i === 1 && tok.length && (tok[0].k === 'chau' || tok[0].k === 'bep') && tok[0].anchor === undefined) lo[0] = Math.max(lo[0], 1);
                // số khoang từng đoạn (giữa hai mốc): tối thiểu theo e_max, thêm 1 cho phương án khác
                const segs = []; let a0 = -1; tok.forEach((x, j) => { if (x.anchor !== undefined) { segs.push([a0, j]); a0 = j; } }); segs.push([a0, tok.length]);
                const v0 = vMin(e), r0m = r0Cua(e, v0), r1m = r1Cua(e, v0);
                const segN = segs.map(([l, h]) => {
                  const st = l < 0 ? r0m : tok[l].anchor + tok[l].w, en = h >= tok.length ? r1m : tok[h].anchor, T = en - st - sum(tok.slice(l + 1, h).map(x => x.w));
                  const mn = sum(lo.slice(l + 1, h + 1)), mx = sum(hi.slice(l + 1, h + 1)), n0 = Math.max(mn, Math.ceil(T / BO.e_max - 1e-9));
                  return [n0, n0 + 1].concat(mn === 0 ? [0] : []).filter((x, j, A) => x >= mn && x <= mx && A.indexOf(x) === j).map(N => chiaSo(N, lo.slice(l + 1, h + 1), hi.slice(l + 1, h + 1)));
                });
                const nCombos = segN.reduce((acc, ls) => acc.flatMap(pre => [].concat(...ls).map(c => pre.concat(c))), [[]]);
                for (const nn of nCombos) {
                  // nn = các ô nối theo đoạn: đoạn [l, h] có các ô l+1 … h
                  const n = Array(tok.length + 1).fill(0); { let k = 0; for (const [l, h] of segs) for (let s = l + 1; s <= h; s++) n[s] = nn[k++]; }
                  const lay = datCanh(e, tok, n); if (!lay) continue;
                  const it = lay.items, c = it.find(x => x.k === 'chau'), b = it.find(x => x.k === 'bep');
                  // ràng buộc cứng của cạnh
                  if (c && ongU !== null && Math.abs(ongU - (c.u0 + coC / 2)) > lotC / 2 - 50 + TOL) continue;
                  if (c && luot === 'deu' && tamChau !== null && Math.abs(c.u0 + coC / 2 - tamChau) > BO.chau_cua_so + TOL) continue;
                  if (b && luot === 'deu' && !pinBep && bo.bep.s !== null && Math.abs(b.u0 + coB / 2 - uCua(e, bo.bep.s)) > BO.chau_cua_so + TOL) continue;
                  if (b) { const bb = bien(e, lay); if (b.u0 - bb.a < BO.bep_dau - TOL || bb.b - b.u1 < BO.bep_dau - TOL) continue; }
                  if (c && b && !(c.u1 + 200 - TOL <= b.u0 || b.u1 + 200 - TOL <= c.u0)) continue;
                  if (L && i === 1 && it.length && (it[0].k === 'chau' || it[0].k === 'bep') && Math.abs(it[0].u0 - lay.r0) < TOL) continue;
                  // chi phí của cạnh: đều nhau, ít khoang, đủ rổ, khoang hẹp / kệ / cỡ lẻ, nẹp gần chuẩn, lệch tâm gõ, chia theo mốc
                  const ws = it.filter(x => x.deu && !x.le).map(x => x.w);
                  let cost = (ws.length ? Math.max(...ws) - Math.min(...ws) : 0) + 40 * it.filter(x => x.deu).length + 80 * thieuRo;
                  for (const x of it) if (x.deu) cost += (x.loai === 'KE' ? 200 : x.w < 400 - TOL ? 50 : 0) + (x.le ? 300 : 0);
                  for (const k of ['nep_dau', 'nep_cuoi']) if (k in lay.v) cost += Math.abs(lay.v[k] - B.nep_tuong) + 10 * Math.max(0, lay.v[k] - BO.nep_max);
                  if ('delta' in lay.v) cost += lay.v.delta; if ('nep_goc' in lay.v) cost += lay.v.nep_goc - G.N;
                  if (c && tamChau !== null) cost += 5 * Math.abs(c.u0 + coC / 2 - tamChau) / 50;
                  if (b && bo.bep.s !== null) cost += 5 * Math.abs(b.u0 + coB / 2 - uCua(e, bo.bep.s)) / 50;
                  if (anchored.length && !pinChau && !pinBep && luot !== 'deu') cost += 100;
                  out.push({ lay, cost, c, b });
                }
              }
            }
            out.sort((p, q) => p.cost - q.cost);
            return out.slice(0, L ? 25 : 60);
          });
          if (ungCanh.some(x => !x.length)) continue;
          // ghép các cạnh + chi phí chung (sơ chế, tủ lạnh, thứ tự mặc định)
          const ghep = ungCanh.reduce((acc, ls) => acc.flatMap(pre => ls.map(x => pre.concat([x]))), [[]]);
          for (const gp of ghep) {
            const c0 = gp[ec].c, b0 = gp[eb].b; if (!c0 || !b0) continue;
            const c = { e: ec, u0: c0.u0, u1: c0.u1 }, b = { e: eb, u0: b0.u0, u1: b0.u1 };
            let cost = sum(gp.map(x => x.cost));
            const sc = cung ? rn(Math.max(c.u0 - b.u1, b.u0 - c.u1), 2) : rn((c.u0 - F) + (b.u0 - F), 2);
            cost += sc < BO.so_che[0] - TOL ? 500 : sc < BO.so_che[1] - TOL ? 20 : sc > 1800 + TOL ? 20 : 0;
            gp.forEach((x, i) => { for (const q of tlCua(E[i], x.lay)) {
              if (i === eb) { const d = q.ben === 'dau' ? b.u0 - q.u : q.u - b.u1; if (d < BO.bep_tl - TOL) cost += 300; }
              // mặt đặt đồ cạnh tay nắm: từ tủ lạnh tới chậu / bếp gần nhất cùng cạnh (bản lề phía trong / tủ cao khác kề: 0)
              const xs = [c, b].filter(z => z.e === i), dat = q.tl.ban_le === 'trong' || !q.mot ? 0 : q.ben === 'dau' ? (xs.length ? Math.min(...xs.map(z => z.u0)) : x.lay.r1) - x.lay.r0 : x.lay.r1 - (xs.length ? Math.max(...xs.map(z => z.u1)) : x.lay.r0);
              if (dat < BO.dat_tl - TOL) cost += 50;
            } });
            if (chauPhia && cung) { const tr = chauPhia === 'dau' ? c.u0 < b.u0 : c.u0 > b.u0; if (!tr) cost += 15; }
            ung.push({ cost: rn(cost, 3), R: gp.map(x => ({ v: x.lay.v, r0: x.lay.r0, r1: x.lay.r1, S: x.lay.S })), lap: gp.map(x => x.lay.items), c, b, sc, eb: coBepTren });
          }
        }
      }
    }
    if (!ung.length) {
      const tt = toiThieu(), ngan = sum(E.map(e => e.dai)) < tt - TOL;
      return { bo, pa: [], loi_chung: [ngan ? `Dãy ngắn hơn tối thiểu ${g(tt)} (khối cao + nẹp + chậu ${g(dsCo[dsCo.length - 1])} + bếp ${g(dsCo[dsCo.length - 1])}) — bớt tủ cao hoặc tăng dài.`
        : `Không xếp được chậu + bếp ${dsCo.map(g).join(' / ')} trên dãy này${ongU !== null ? ' trong tầm ống thoát' : ''} (bếp cách tường / tủ cao ≥ 300, giữa chậu và bếp ít nhất một tủ${bo.chau.s !== null || bo.bep.s !== null ? ', quanh tâm chậu / bếp đã gõ' : ''}${pins.length ? `, tủ đã ghim ${pins.map(p => p.vt).join(', ')} giữ đúng chỗ` : ''}) — ${pins.length ? 'bỏ ghim (tủ ghim có chỗ cố định, đổi dài là có thể không còn chỗ), ' : ''}dời ống / tâm chậu / tâm bếp${L ? ', đổi cạnh chậu' : ''}, đổi đầu hở, hoặc tăng dài.`] };
    }
    ung.sort((a, b) => a.cost - b.cost);
    // (vòng soát 1.34) đá dài hơn khổ 3200 mà không có mối nối hợp lệ = không sản xuất được: xét tiếp tới khi đủ `so` phương án đá ghép được (tối đa 40)
    const DA_PHAT = 1000, tot = [], daCo = new Set(), so = Math.max(1, Math.min(6, num(opt.so, 3)));
    let loiGan = null;
    for (const x of ung) {
      if (tot.filter(p => !p.da_hong).length >= so) break;
      const p = dungPA(bo, Q, G, E, x);
      const sig = JSON.stringify(p.ds.map(m => [m.ma, m.u0, m.canh, m.tang]));
      if (daCo.has(sig)) continue;
      daCo.add(sig);
      if (daCo.size > 40) break;
      const k = kiemDay(bo, p, { nen: opt.nen });
      p.loi = k.loi; p.canh_bao = k.canh_bao; p.luu_y = k.luu_y;
      if (p.loi.length) { if (!loiGan) loiGan = p.loi.slice(); continue; }
      { const c = p.ds.find(m => m.chuc === 'chau' && m.tang === 'duoi'); if (bo.co_lui && c && c.rong < bo.co - TOL) p.luu_y.unshift(`Bộ lưu ở bản 1.34 chọn chậu / bếp ${g(bo.co)}: từ 1.35 chậu và bếp cùng cỡ — ${g(bo.co)} + ${g(bo.co)} không đủ chỗ trên dãy này, bảng dùng ${g(c.rong)} (chọn lại cỡ ở ô Chậu = bếp).`); }
      if (p.da.some(d => !d.hop_le)) { p.cost = rn(p.cost + DA_PHAT, 3); Object.defineProperty(p, 'da_hong', { value: true, enumerable: false }); }
      tot.push(p);
    }
    const pa = tot.sort((a, b) => a.cost - b.cost).slice(0, so);
    if (!pa.length) return { bo, pa: [], loi_chung: loiGan ? [`Không có phương án nào qua được phép kiểm dãy — phương án gần được nhất còn ${loiGan.length} lỗi:`, ...loiGan.slice(0, 4).concat(loiGan.length > 4 ? [`… và ${loiGan.length - 4} lỗi khác.`] : [])]
      : ['Không có phương án nào qua được phép kiểm dãy.'] };
    return { bo, pa, loi_chung: [] };
  }
  // dựng phương án (danh sách tủ dưới / cao / trên theo toạ độ tủ) từ một ứng viên
  function dungPA(bo, Q, G, E, x) {
    const { B, tc, F, Pt, zTren, zHMK } = Q, L = bo.kieu === 'L';
    const ds = [];
    E.forEach((e, i) => {
      const r = x.R[i], v = r.v, duoi = [], tren = [];
      // dưới: khối cao (từ ngoài vào) + tủ lấp / chậu / bếp / ghim / kệ; góc
      const caoDs = [];
      { let u = rn(r.r0 - e.wCao.dau, 2); for (const c of e.cao.dau) { caoDs.push({ k: 'cao', loai: c.loai, w: c.w, tl: c.tl, tl_i: c.tl_i, u0: u, u1: rn(u + c.w, 2) }); u = rn(u + c.w, 2); } }
      { let u = r.r1; for (const c of e.cao.cuoi.slice().reverse()) { caoDs.push({ k: 'cao', loai: c.loai, w: c.w, tl: c.tl, tl_i: c.tl_i, u0: u, u1: rn(u + c.w, 2) }); u = rn(u + c.w, 2); } }
      if (L && i === 0) duoi.push({ k: 'goc', u0: rn(G.X + v.delta, 2), u1: rn(G.X + v.delta + G.Wg, 2), w: G.Wg });
      for (const m of x.lap[i]) duoi.push(Object.assign({}, m));
      const all = duoi.concat(caoDs).sort((a, b) => a.u0 - b.u0);
      // nẹp / ốp vào tủ ở đầu cạnh
      const dauM = all[0], cuoiM = all[all.length - 1];
      for (const [ben, m] of [['dau', dauM], ['cuoi', cuoiM]]) {
        if (!m) continue;
        if (e[ben] === 'tuong') { m['nep_' + ben] = v['nep_' + ben]; if (ben === 'dau') m.u0 = 0; else m.u1 = e.dai; }
        else if (e[ben] === 'ho') { m['op_' + ben] = 1; if (ben === 'dau') m.u0 = 0; else m.u1 = rn(e.dai - (v.du || 0), 2); }
      }
      if (L && i === 1 && dauM) { dauM.nep_dau = v.nep_goc; dauM.goc = 1; dauM.u0 = F; }
      // trên: theo tủ dưới — mối nối trùng (không trên khối cao); hút mùi rộng đúng tủ bếp nấu; góc chữ L, tủ đầu cạnh B
      const run = all.filter(m => m.k !== 'cao');
      for (let j = 0; j < run.length; j++) {
        const m = run[j], th0 = rn(m.u0 + (m.nep_dau && !m.goc ? m.nep_dau : 0) + (m.op_dau ? tc : 0) + (m.goc ? m.nep_dau : 0), 2), th1 = rn(m.u1 - (m.nep_cuoi || 0) - (m.op_cuoi ? tc : 0), 2);
        let q;
        if (m.k === 'goc') q = { k: 'goc_tren', u0: rn(BO.khe_tren_goc, 2), u1: m.u1 };
        else if (m.k === 'chau') q = { k: 'tu', ma: `BT-BAT-${m.w}`, u0: th0, u1: th1, w: m.w };
        else if (m.k === 'bep') q = bo.hm === 'kinh' ? { k: 'hmk', ma: m.w >= 900 ? 'BT-HMK-900' : 'BT-HMK-700', u0: th0, u1: th1, w: m.w, z: zHMK }
          : { k: 'hm', ma: MAU_BEP_TREN.some(y => y.ma === `BT-HM-${m.w}`) ? `BT-HM-${m.w}` : 'BT-HM-800', u0: th0, u1: th1, w: m.w };
        else if (m.loai === 'KE') q = { k: 'tu', ma: `BT-KE-${m.w}`, u0: th0, u1: th1, w: m.w };
        else q = { k: 'tu', loai: m.loai === 'GV' ? 'GV' : 'CANH', ma: null, u0: th0, u1: th1, w: rn(th1 - th0, 2), le: !!m.le };
        if (L && i === 1 && j === 0) q = { k: 'b1', u0: rn(Pt, 2), u1: th1, nep_dau: G.N_t };
        q.nep_dau = q.nep_dau || (m.nep_dau && !m.goc ? m.nep_dau : 0); q.nep_cuoi = m.nep_cuoi || 0; q.op_dau = m.op_dau; q.op_cuoi = m.op_cuoi;
        if (q.nep_dau && q.k !== 'b1') q.u0 = m.u0; if (q.nep_cuoi || q.op_cuoi) q.u1 = m.u1; if (q.op_dau) q.u0 = m.u0;
        tren.push(q);
      }
      // (bản 1.35) TẦNG TRÊN KỊCH TRẦN: chồng lên đỉnh tầng dưới, mối nối thẳng hàng; trên khối cao (tủ lạnh / lò / kho) cũng có — sâu theo tủ cao
      const tren2 = [];
      if (Q.h2 > 0) {
        for (const q of tren) tren2.push({ k: q.k === 'goc_tren' ? 'goc_tren' : q.k === 'b1' ? 'b1' : 'tu', ke: !!(q.ma && /^BT-KE-/.test(q.ma)), u0: q.u0, u1: q.u1, nep_dau: q.nep_dau, nep_cuoi: q.nep_cuoi, op_dau: q.op_dau, op_cuoi: q.op_cuoi, t2: true, ong: q.k === 'hm' || q.k === 'hmk' });
        for (const m of all.filter(y => y.k === 'cao')) tren2.push({ k: 'tu', u0: m.u0, u1: m.u1, nep_dau: m.nep_dau || 0, nep_cuoi: m.nep_cuoi || 0, op_dau: m.op_dau, op_cuoi: m.op_cuoi, t2: true, sau_cao: true });
      }
      // ra danh sách theo trục tủ
      const ra = (m, tang) => {
        const lat = e.lat, nd = m.nep_dau || 0, nc = m.nep_cuoi || 0, dai = rn(m.u1 - m.u0, 2);
        const nep = {}; const nt = lat ? nc : nd, np = lat ? nd : nc;
        if (nt) nep.trai = nt; if (np) nep.phai = np; if (m.goc && tang === 'duoi') nep.goc = lat ? 'phai' : 'trai';
        const op = m.op_dau ? (lat ? 'phai' : 'trai') : m.op_cuoi ? (lat ? 'trai' : 'phai') : null;
        const rong = rn(dai - nd - nc - (op ? tc : 0), 2), so = x => g(x).replace(',', '.');
        let ma = m.ma, chuc = null, le = !!m.le;
        if (m.k === 'cao') { const tlo = m.tl; ma = m.loai === 'tl' ? `BC-TL${tlo.kieu === 'am' ? 'A' : ''}-${tlMay(tlo).ma === 'tu_chon' ? 'tu_chon' : tbBep('tl', tlMay(tlo), 0).rong}` : m.loai === 'lo' ? 'BC-LO-600' : `BC-KHO-${m.w}`; chuc = m.loai; }
        else if (m.k === 'goc') { ma = `${MA_GOC[G.pk]}-${lat ? 'P' : 'T'}`; chuc = 'goc'; }
        else if (m.k === 'goc_tren') { ma = `${MA_GOC[G.pk].replace(/^BD/, 'BT')}-${lat ? 'P' : 'T'}`; chuc = 'goc'; }
        else if (m.k === 'chau' || m.k === 'bep') chuc = m.k;
        else if (m.k === 'ghim') chuc = m.chuc;
        else if (m.k === 'ke') chuc = 'ke';
        else if (m.k === 'lap' || m.k === 'ro') { ma = `BD-${m.loai}-${so(rong)}`; chuc = { NK3: 'nk', GV: 'gv', RAC: 'rac', GAO: 'gao', CANH: 'canh', KE: 'ke' }[m.loai]; }
        else if (m.k === 'b1' || (m.k === 'tu' && !ma && !m.ke)) { ma = `BT-CANH-${so(rong)}`; chuc = 'canh'; }
        else if (m.k === 'tu' && m.ke) { ma = `BT-KE-${so(rong)}`; chuc = 'ke'; }
        else if (m.k === 'tu') chuc = /BAT/.test(ma) ? 'bat' : /KE/.test(ma) ? 'ke' : 'canh';
        else if (m.k === 'hm' || m.k === 'hmk') chuc = 'hm';
        const o = { vt: '', canh: e.i, tang, ma, rong, u0: rn(m.u0, 2), u1: rn(m.u1, 2), s0: lat ? rn(e.dai - m.u1, 2) : rn(m.u0, 2), dai, z: tang === 'tren' ? (m.t2 ? Q.zT2 : (m.z || zTren)) : 0, chuc };
        if (Object.keys(nep).length) o.nep = nep; if (op) o.op = op; if (le) o.le = true; if (m.ghim) o.ghim = true;
        if (m.k === 'goc' || m.k === 'goc_tren') o.ben = lat ? 'phai' : 'trai';
        if (m.k === 'cao' && m.loai === 'tl') { o.may = tlMay(m.tl); o.tl_i = m.tl_i; }
        if (m.t2) { o.t2 = true; o.cao = Q.h2; if (m.sau_cao) o.sau_cao = true; if (m.ong) o.ong_hm = true; }
        if (m.vt) o.vt_ghim = m.vt;
        return o;
      };
      const out = all.map(m => ra(m, m.k === 'cao' ? 'cao' : 'duoi')).concat(tren.map(m => ra(m, 'tren')), tren2.map(m => ra(m, 'tren')));
      for (const tg of ['duoi', 'cao', 'tren', 't2']) out.filter(m => (tg === 't2' ? m.t2 : m.tang === tg && !m.t2)).sort((a, b) => a.s0 - b.s0).forEach((m, j) => { m.vt = `${e.ten}${tg === 'duoi' ? '' : tg === 'cao' ? 'C' : tg === 't2' ? 'U' : 'T'}${j + 1}`; });
      ds.push(...out);
    });
    const p = { ds, canh: E.map((e, i) => Object.assign({ dai: e.dai, lat: e.lat, dau: e.dau, cuoi: e.cuoi }, x.R[i].v.du ? { du: x.R[i].v.du } : {})), so_che: x.sc, cost: x.cost, goc: null, tang2: Q.h2 > 0 ? { z: Q.zT2, cao: Q.h2 } : null };
    if (L) { const dl = x.R[0].v.delta; p.goc = { pk: G.pk, X: rn(G.X + dl, 2), X_t: BO.khe_tren_goc, Wg: G.Wg, c: G.c, Wg_t: rn(G.Wg_t + dl, 2), c_t: rn(G.c_t + dl, 2), mu: G.mu, d: dl, N: G.N, N_t: G.N_t, F, P_t: Q.Pt, nep_B: x.R[1].v.nep_goc }; }
    p.da = daDay(bo, p);
    return p;
  }
  /** (vòng soát 1.35) tủ trên m đứng ở một chỗ kính đã chọn ({ canh, s }) — dùng chung với bảng. */
  const kinhO = (ds, m) => Array.isArray(ds) && ds.some(k => k && k.canh === m.canh && k.s > m.s0 + TOL && k.s < m.s0 + m.dai - TOL);
  // ---- tủ từng chỗ: mẫu gốc của một mã trong dãy (cỡ lẻ → mẫu cùng loại, cùng số cánh) ----
  function mauGocBo(m, B) {
    const tat = [MAU_BEP_DUOI, MAU_BEP_TREN, MAU_BEP_CAO];
    if (tat.some(ds => ds.some(x => x.ma === m.ma))) return m.ma;
    if (/^BC-TLA?-/.test(m.ma)) return /^BC-TLA-/.test(m.ma) ? 'BC-TLA-560' : 'BC-TL-700';
    if (/^BD-CANH-/.test(m.ma)) return m.rong <= B.canh_1_duoi + TOL ? 'BD-CANH-600' : 'BD-CANH-900';
    // (bản 1.35) khoang chia đều: ngăn kéo / kệ ở mọi bề rộng (ruột như mẫu chuẩn)
    if (/^BD-NK3-/.test(m.ma)) return m.rong <= 600 + TOL ? 'BD-NK3-600' : 'BD-NK3-900';
    if (/^B[DT]-KE-/.test(m.ma)) return m.ma.slice(0, 3) + 'KE-300';
    if (/^BT-CANH-/.test(m.ma)) return m.rong <= B.canh_1_tren + TOL ? 'BT-CANH-450' : 'BT-CANH-900';
    return null;
  }
  const BO_DUNG = new Map();
  function dungBo(spec) {
    const k = JSON.stringify(spec);
    if (BO_DUNG.has(k)) return BO_DUNG.get(k);
    const M = build(spec);
    if (BO_DUNG.size > 800) BO_DUNG.clear();
    BO_DUNG.set(k, M);
    return M;
  }
  /**
   * Spec từng tủ của một phương án (thiết kế §4 "tuBo"): apMau(nền, mẫu) → rộng lẻ / nẹp (phào) / ốp → bep.day = { ma bộ, vt } → datBep.
   * @returns [{ vt, spec, canh, s0, tang, z, P (sâu phủ bì, từ build) }]
   */
  function tuBo(boIn, pa, opt) {
    const bo = chuanBo(boIn), nen = clone((opt && opt.nen) || DEFAULT_SPEC), Q = soBo(bo, nen);
    nen.loai_sp = 'bep'; nen.bep = Object.assign({}, bo.chuan);
    const out = [];
    // (bản 1.35) cánh khung kính: tủ trên tầng dưới — mặc định tủ giá bát (trên chậu), hoặc các vị trí đã chọn
    const laKinh = m => m.tang === 'tren' && !m.t2 && (m.chuc === 'bat' || m.chuc === 'canh') && (bo.kinh === 'bat' ? m.chuc === 'bat' : kinhO(bo.kinh, m));
    for (const m of (pa && pa.ds) || []) {
      const ma = mauGocBo(m, Q.B); if (!ma) continue;
      const s = apMau(nen, ma); if (!s) continue;
      if (ma !== m.ma) s.ten = String(s.ten).replace(/\d+(?=\D*$)/, g(m.rong));      // mẫu gốc khác cỡ: tên theo cỡ thật
      if (m.chuc === 'tl') { const tlo = m.tl_i === 1 && bo.tl2 ? bo.tl2 : bo.tl; s.bep.tb = { tl: Object.assign(tlMay(tlo), { kieu: tlo.kieu, ho_hong: tlo.ho_hong, ho_tren: tlo.ho_tren, ho_sau: tlo.ho_sau }, tlo.tan_nhiet !== null ? { tan_nhiet: tlo.tan_nhiet } : {}) };
        // tủ lạnh âm: cánh ốp bản lề phía tường (đầu dãy) — trừ khi chọn bản lề phía trong
        if (tlo.kieu === 'am' && s.khoang[0]) { const tuong = (m.nep && (m.nep.trai ? 'trai' : m.nep.phai ? 'phai' : '')) || m.op || ''; s.khoang[0].ban_le = tuong && tlo.ban_le !== 'trong' ? tuong : tuong === 'trai' ? 'phai' : 'trai'; } }
      if (m.chuc === 'lo') s.bep.vs = bo.vs;
      s.rong = m.dai;
      // (bản 1.35) tầng trên kịch trần: chồng lên đỉnh tầng dưới (tang2 → z đặt = đỉnh tầng dưới), cao riêng h2; trên tủ cao thì sâu theo tủ cao; thấp thì không đợt
      if (m.t2) {
        s.bep.tang2 = 1; s.bep.cao_rieng = Q.h2; for (const k of s.khoang) k.dot = Q.h2 >= 600 && !m.ong_hm ? [Math.round((Q.h2 - Q.t) / 2)] : [];
        // (vòng soát 1.35) trên tủ cao: sâu ĐÚNG tủ cao bên dưới (tủ lạnh âm sâu theo máy); trên tủ hút mùi: ống khói đi qua (lỗ đáy + nóc, không đợt)
        if (m.sau_cao) { const c = out.find(x => x.tang === 'cao' && x.canh === m.canh && Math.abs(x.s0 - m.s0) < 0.5); s.bep.sau_tren = c ? c.spec.sau_thung : Q.B.sau_cao; }
        if (m.ong_hm) { const h = out.find(x => x.canh === m.canh && x.spec.bep.chuc_nang === 'hm' && x.s0 < m.s0 + m.dai - 1 && x.s0 + x.spec.rong > m.s0 + 1); s.bep.ong_hm = h && h.spec.bep.tb && h.spec.bep.tb.hm ? h.spec.bep.tb.hm.ong : 150; }
      }
      if (laKinh(m)) s.bep.kinh = 1;
      if (bo.led && m.tang === 'tren' && !m.t2 && m.chuc !== 'hm') s.bep.led = 1;
      if (m.nep) s.bep.nep = Object.assign({}, m.nep);
      if (m.op) s.bep.op = m.op;
      // (vòng soát 1.34) tủ trên góc: khoang mù theo nẹp góc TRÊN của bộ (mẫu tính với 50) — cánh = c_t của phương án, phần mù lộ ra khớp nẹp của tủ B1 trên
      if (m.chuc === 'goc' && m.tang === 'tren' && bo.goc) { const G = gocBep(bo.goc.pk, { chuan: Q.B, tc: Q.tc, nep: bo.goc.nep, nep_tren: bo.goc.nep_tren }), km = s.khoang.find(k => k.mu); if (km) km.rong = rn(G.Wg_t - G.c_t - 1.5 * Q.t); }
      if (/^B[DT]-CANH-/.test(m.ma) && s.khoang.length === 1) s.khoang[0].canh = m.rong <= (m.tang === 'tren' ? Q.B.canh_1_tren : Q.B.canh_1_duoi) + TOL ? 1 : 2;
      s.bep.day = { ma: bo.ma, vt: m.vt };
      let sp = datBep(s, {}), M = dungBo(sp);
      // (vòng soát 1.35) TỦ LẠNH ÂM: khoang sinh từ máy gõ (rộng × SÂU × cao) — tủ cao sâu thêm cho máy + hở sau lọt tới hậu (cánh ốp đóng được); tối đa 800
      if (m.chuc === 'tl' && s.bep.tb && s.bep.tb.tl && s.bep.tb.tl.kieu === 'am') {
        const hoc = ((M.info.bep && M.info.bep.hoc) || []).find(h => h.tb === 'tl'), may = sp.bep.tb.tl, thieu = hoc ? rn(may.sau + may.ho_sau - hoc.sau, 2) : 0;
        if (thieu > TOL) { s.bep.sau_cao = Math.min(SO_BEP.sau_cao[1], ceil5(sp.sau_thung + thieu)); sp = datBep(s, {}); M = dungBo(sp); }
      }
      // (vòng soát 3 — 1.34) tủ trên cánh rộng (tủ đầu cạnh B = tủ dưới + phần sâu tủ dưới hơn tủ trên + lẻ: tới ~1160) — lọt lòng > dot_max thì HAI khoang
      // (cảnh báo "thêm vách chia khoang" của tủ lẻ không làm theo được trong bộ: tủ trên không ghim / đổi được, chia lại ra y như cũ)
      if (/^BT-CANH-/.test(m.ma) && s.khoang.length === 1 && sp.kiem && sp.kiem.dot_max > 0 && (M.info.khoang || []).some(w => w > sp.kiem.dot_max + TOL)) {
        const k0 = s.khoang[0], nua = m.rong / 2;
        s.khoang = [0, 1].map(j => Object.assign(clone(k0), { rong: 'auto', canh: nua <= Q.B.canh_1_tren + TOL ? 1 : 2, ban_le: j ? 'phai' : 'trai' }));
        sp = datBep(s, {}); M = dungBo(sp);
      }
      const bb = bbox(M.parts);
      // sâu phủ bì: mặt cánh / mặt ngăn kéo (mẫu Chenfeng — không có trong parts) tới lưng thùng (+ cách tường của tủ dưới)
      // (vòng soát 1.35) tầng trên trên tủ cao: lưng theo tủ cao (cách tường như tủ cao) — mặt trước hai tầng thẳng nhau
      const P = bb ? rn(Math.max(bb.y1, sp.sau_thung) - Math.min(bb.y0, -sp.van.t_canh) + (m.tang === 'tren' && !m.sau_cao ? 0 : sp.bep.cach_tuong), 2) : 0;
      out.push(Object.assign({ vt: m.vt, spec: sp, canh: m.canh, s0: m.s0, tang: m.tang, z: m.tang === 'tren' ? M.info.bep.z_dat : 0, P }, m.sau_cao ? { sau_cao: true } : {}));
    }
    // (bản 1.35) nguồn LED cho cả dãy: tủ trên có LED đầu tiên mang nguồn (tổng chiều dài dải LED của mọi tủ)
    const led = out.filter(x => x.spec.bep && x.spec.bep.led);
    if (led.length) {
      const tong = rn(sum(led.map(x => Math.max(0, x.spec.rong - (x.spec.phao.trai || 0) - (x.spec.phao.phai || 0) - 2 * x.spec.van.t - 20))), 1), x0 = led[0];
      x0.spec = normalize(Object.assign(clone(x0.spec), { bep: Object.assign({}, x0.spec.bep, { led_nguon: tong }) }));
    }
    return out;
  }
  /**
   * Đá theo dãy (thiết kế §6): mỗi cạnh một dải sâu = sâu tủ dưới + cánh + đua (+ cách tường), chạy trên mọi tủ dưới (không trên khối cao);
   * chữ L: cạnh A chạy suốt vào góc (u 0 …), cạnh B bắt đầu ở mép trước đá A. Đầu hở: đá nhô 20 qua ốp (anh chốt). Dải > 3200 thì ghép — mối nối ở mối nối tủ
   * (có 2 hồi đỡ) cách mép khoét chậu / bếp ≥ 150, chọn chỗ chia gần đều nhất.
   * @returns [{ canh, u0, u1, s0, s1, dai, sau, tam: [{ u0, u1, s0, s1, dai }], noi: [s], khoet: [{ loai, u0, u1, s0, s1 }], hop_le }]
   */
  function daDay(boIn, pa) {
    const bo = boIn && boIn.v === 2 && Array.isArray(boIn.canh) ? boIn : chuanBo(boIn), Q = soBo(bo), L = bo.kieu === 'L', out = [];
    (pa.canh || []).forEach((e, i) => {
      const d = pa.ds.filter(m => m.canh === i && (m.tang === 'duoi' || m.tang === 'cao')).sort((a, b) => a.u0 - b.u0), duoi = d.filter(m => m.tang === 'duoi');
      if (!duoi.length) return;
      // dải: từ mép khối cao / tường / mép đá cạnh kia tới mép khối cao / tường (+ nhô 20 ở đầu hở)
      const caoD = d.filter(m => m.tang === 'cao'), dauCao = caoD.some(m => m.u0 < duoi[0].u0), cuoiCao = caoD.some(m => m.u1 > duoi[duoi.length - 1].u1);
      let u0 = L && i === 0 ? 0 : L && i === 1 ? Q.sauDa : dauCao ? duoi[0].u0 : e.dau === 'ho' ? -DA_NHO_HO : 0;
      let u1 = cuoiCao ? duoi[duoi.length - 1].u1 : e.cuoi === 'ho' ? rn(e.dai - (e.du || 0) + DA_NHO_HO, 2) : e.dai;
      if (dauCao && !(L && i === 1)) u0 = duoi[0].u0;
      const khoet = [];
      for (const m of duoi) if (m.chuc === 'chau' || m.chuc === 'bep') {
        const tb = tbBep(m.chuc, null, m.rong), w = tb.khoet[0], th = thungU(m, e.lat), c = rn((th[0] + th[1]) / 2, 2);
        khoet.push({ loai: m.chuc, u0: rn(c - w / 2, 2), u1: rn(c + w / 2, 2) });
      }
      const ung = [];
      for (let j = 1; j < duoi.length; j++) { const x = duoi[j].u0; if (x > u0 + TOL && x < u1 - TOL && Math.abs(x - duoi[j - 1].u1) < TOL && khoet.every(k => x <= k.u0 - BO.da_cach + TOL || x >= k.u1 + BO.da_cach - TOL)) ung.push(x); }
      let hop_le = true;
      const cat = (a, b) => {      // chia [a, b] thành các tấm ≤ khổ đá
        if (b - a <= BO.kho_da + TOL) return [];
        const c = ung.filter(x => x > a + TOL && x < b - TOL && x - a <= BO.kho_da + TOL);
        if (!c.length) { hop_le = false; return []; }
        let best = null; for (const x of c) { const k = Math.max(x - a, b - x); if (!best || k < best.k - TOL) best = { x, k }; }
        return [best.x, ...cat(best.x, b)];
      };
      const noi = cat(u0, u1), mocs = [u0, ...noi, u1], S = u => (e.lat ? rn(e.dai - u, 2) : rn(u, 2));
      const tam = mocs.slice(1).map((x, j) => ({ u0: rn(mocs[j], 2), u1: rn(x, 2), s0: Math.min(S(mocs[j]), S(x)), s1: Math.max(S(mocs[j]), S(x)), dai: rn(x - mocs[j], 2) }));
      if (e.lat) tam.reverse();
      out.push({ canh: i, u0: rn(u0, 2), u1: rn(u1, 2), s0: Math.min(S(u0), S(u1)), s1: Math.max(S(u0), S(u1)), dai: rn(u1 - u0, 2), sau: Q.sauDa, tam, noi: noi.map(S).sort((a, b) => a - b),
        khoet: khoet.map(k => Object.assign(k, { s0: Math.min(S(k.u0), S(k.u1)), s1: Math.max(S(k.u0), S(k.u1)) })), hop_le });
    });
    return out;
  }
  /**
   * (vòng soát 3 — 1.34) Bảng kê đá của DÃY cho xưởng gia công đá — tủ trong dãy không in dòng "Mặt đá" riêng (cutList), nên mọi số đá ra ở đây:
   * mỗi tấm một dòng: dài × sâu × dày, chỗ trên tường (s từ đầu trái khi nhìn vào tường), mối nối, đầu nhô / đầu tì đá cạnh kia, khoét chậu / bếp kèm vị trí
   * (tâm cách mép trái tấm, cách mép trước đá — lấy từ chính tủ chậu / bếp đã dựng: cỡ khoét + cách mép trước của thiết bị).
   * @returns [{ ten, tu, canh, dai, sau, day, sl, ghi_chu }]
   */
  function keDaDay(boIn, pa, opt) {
    const bo = chuanBo(boIn), Q = soBo(bo, opt && opt.nen), L = bo.kieu === 'L', out = [], daTu = {};
    for (const x of tuBo(bo, pa, opt)) { const M = dungBo(x.spec); if (M.da && M.da.khoet.length) daTu[x.vt] = M.da; }
    for (const d of (pa && pa.da) || []) {
      const e = pa.canh[d.canh], ten = 'AB'[d.canh], n = d.tam.length;
      const dauS = e.lat ? d.s1 : d.s0, cuoiS = e.lat ? d.s0 : d.s1;      // đầu u = 0 (góc / đầu trái) và đầu cuối theo s
      const kh = pa.ds.filter(m => m.canh === d.canh && m.tang === 'duoi' && (m.chuc === 'chau' || m.chuc === 'bep')).map(m => {
        const th = thungU(m, e.lat), u = (th[0] + th[1]) / 2, da = daTu[m.vt], k = da && da.khoet.find(q => q.loai === m.chuc);
        return { m, s: rn(e.lat ? e.dai - u : u, 1), k, y: k && da ? rn(k.y - da.y0, 1) : null };
      });
      d.tam.forEach((tm, j) => {
        const ghi = [`cạnh ${ten}, s ${g(tm.s0)} … ${g(tm.s1)} tính từ đầu trái khi nhìn vào tường`];
        const dau = Math.abs(tm.s0 - dauS) < 0.5 || Math.abs(tm.s1 - dauS) < 0.5, cuoi = Math.abs(tm.s0 - cuoiS) < 0.5 || Math.abs(tm.s1 - cuoiS) < 0.5;
        const ben = sv => (Math.abs(sv - tm.s0) < 0.5 ? 'trái' : 'phải');
        if (L && d.canh === 0 && dau) ghi.push(`đầu ${ben(dauS)} chạy suốt vào góc trong (đá cạnh B tì vào mép trước tấm này)`);
        if (L && d.canh === 1 && dau) ghi.push(`đầu ${ben(dauS)} tì mép trước đá cạnh A (mối nối góc)`);
        // (vòng soát 4) chỉ ghi "nhô" khi đá thật sự nhô qua mép dãy — khối cao (tủ lạnh / lò / kho) ở đầu hở thì daDay cho đá dừng ở mép khối cao (tì hồi)
        const nhoDau = d.u0 < -TOL, nhoCuoi = d.u1 > rn(e.dai - (e.du || 0), 2) + TOL;
        if (!L && dau && e.dau === 'ho' && nhoDau) ghi.push(`đầu ${ben(dauS)} nhô ${g(DA_NHO_HO)} qua ốp hông (đầu hở)`);
        if (cuoi && e.cuoi === 'ho' && nhoCuoi) ghi.push(`đầu ${ben(cuoiS)} nhô ${g(DA_NHO_HO)} qua ốp hông (đầu hở)`);
        for (const x of d.noi) if (Math.abs(x - tm.s0) < 0.5 || Math.abs(x - tm.s1) < 0.5) ghi.push(`mối nối ${ben(x)} ở s ${g(x)} (trên mối nối hai tủ)`);
        for (const q of kh) if (q.s > tm.s0 + TOL && q.s < tm.s1 - TOL) {
          ghi.push(`khoét ${q.m.chuc === 'chau' ? 'chậu' : 'bếp'} ${q.k ? `${g(q.k.r)} × ${g(q.k.s)}` : ''}${q.k && q.k.lap === 'am' ? ' (chậu lắp âm — mài bóng mép)' : q.k && q.k.lap === 'duong' ? ' (lắp dương)' : ''} tâm cách mép trái tấm ${g(rn(q.s - tm.s0, 1))}${q.y !== null ? `, cách mép trước đá ${g(q.y)}` : ''} (tủ ${q.m.vt})`);
        }
        out.push({ ten: `Đá cạnh ${ten}${n > 1 ? ` tấm ${j + 1}/${n}` : ''}`, tu: bo.ma, canh: d.canh, dai: tm.dai, sau: d.sau, day: Q.B.day_da, sl: 1, ghi_chu: ghi.join('; ') + (d.hop_le ? '' : '; DÀI QUÁ KHỔ ĐÁ mà không có mối nối hợp lệ') });
      });
    }
    return out;
  }
  function daDayCSV(boIn, pa, opt) {
    const q = v => { v = String(v === undefined || v === null ? '' : v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const lines = [['Nhóm', 'Bộ bếp', 'Tấm đá', 'Dài (mm)', 'Sâu (mm)', 'Dày (mm)', 'Số lượng', 'Ghi chú'].join(',')];
    for (const r of keDaDay(boIn, pa, opt)) lines.push(['Gia công đá', r.tu, r.ten, r.dai, r.sau, r.day, r.sl, r.ghi_chu].map(q).join(','));
    return '\ufeff' + lines.join('\r\n') + '\r\n';
  }
  /** (vòng soát 3 — 1.34) Tủ rời khỏi dãy (Thôi sửa → vẽ mới, Lưu / Mở mẫu, Mở thành tủ): bỏ bep.day — tủ lẻ in lại dòng Mặt đá của nó (cutList). Sửa tại chỗ, trả lại spec. */
  function roiDay(s) { if (s && s.bep && typeof s.bep === 'object' && s.bep.day) delete s.bep.day; return s; }
  /**
   * Kiểm cả dãy (thiết kế §7, hàm thuần). LỖI = không cho vẽ; CẢNH BÁO hiện ở bảng; LƯU Ý chỉ trong phiếu. Dựng từng tủ (tuBo + build, nhớ đệm) để gộp LỖI / cảnh báo của tủ.
   * @returns {{ loi: string[], canh_bao: string[], luu_y: string[] }}
   */
  function kiemDay(boIn, pa, opt) {
    const bo = chuanBo(boIn), Q = soBo(bo, opt && opt.nen), { B, t, F } = Q, L = bo.kieu === 'L', loi = [], canh_bao = [], luu_y = [];
    const ds = (pa && pa.ds) || [], E = (pa && pa.canh) || [];
    const ten = m => `${bo.ma}-${m.vt} ${m.ma}`;
    const G = L ? gocBep(bo.goc.pk, { chuan: B, tc: Q.tc, nep: bo.goc.nep, nep_tren: bo.goc.nep_tren }) : null;
    if (G) for (const x of G.loi) loi.push(x);
    if (L && bo.canh[1].dai < F + G.N + BO.bep_dau - TOL) loi.push(`Cạnh B ${g(bo.canh[1].dai)} ngắn hơn ${g(rn(F + G.N + BO.bep_dau))} (sâu tủ cạnh A + nẹp góc + 300).`);
    E.forEach((e, i) => {
      const d = ds.filter(m => m.canh === i && m.tang !== 'tren').sort((a, b) => a.u0 - b.u0);
      if (!d.length) { loi.push(`Cạnh ${'AB'[i]}: không có tủ nào.`); return; }
      const x0 = L ? (i === 0 ? (pa.goc ? pa.goc.X : 0) : F) : 0;
      const kho = d.some((m, j) => j && Math.abs(m.u0 - d[j - 1].u1) > 0.5) || Math.abs(d[0].u0 - x0) > 0.5 || Math.abs(d[d.length - 1].u1 - (e.dai - (e.du || 0))) > 0.5 || d.some(m => Math.abs(m.u1 - m.u0 - m.dai) > 0.5);
      if (e.du) luu_y.push(`Cạnh ${'AB'[i]}: dư ${g(e.du)} ở đầu ${e.lat ? 'trái' : 'phải'} (< ${g(DU_CHI)}, hai đầu hở — không nẹp nào nhận) — dãy ngắn hơn dài gõ ${g(e.du)}; khít tường / đồ bên cạnh thì nẹp chỉ / silicon.`);
      if (kho) loi.push(`Cạnh ${'AB'[i]}: tổng tủ + nẹp ${g(rn(sum(d.map(m => m.u1 - m.u0)) + x0, 2))} khác dài ${g(e.dai)} (hoặc có chỗ hở / chồng giữa các tủ).`);
      if (L && i === 0 && pa.goc && pa.goc.X < -TOL) loi.push(`Tủ góc cách tường cạnh B ${g(pa.goc.X)} < 0 — tủ góc quá rộng so với cánh.`);
      for (const m of ds.filter(q => q.canh === i)) for (const k of ['trai', 'phai']) {
        const v = m.nep && m.nep[k]; if (!v) continue;
        if (v < 50 - TOL) loi.push(`${ten(m)}: nẹp ${k === 'trai' ? 'trái' : 'phải'} ${g(v)} < 50.`);
        else if (v > BO.nep_max + TOL) canh_bao.push(`${ten(m)}: nẹp ${k === 'trai' ? 'trái' : 'phải'} ${g(v)} > 100 — nên đổi một tủ cánh sang cỡ lẻ.`);
      }
      // bếp: cách tường / đầu hở / khối cao / tủ lạnh / mặt tủ cạnh kia ≥ 300 (cứng); cách tủ lạnh ≥ 500 (nên)
      for (const b of d.filter(m => m.chuc === 'bep')) {
        const cao = d.filter(m => m.tang === 'cao'), trai = [L ? (i === 1 ? F : -Infinity) : (d[0].tang === 'cao' ? -Infinity : 0), ...cao.filter(m => m.u1 <= b.u0 + TOL).map(m => m.u1)], phai = [d[d.length - 1].tang === 'cao' ? Infinity : e.dai - (e.du || 0), ...cao.filter(m => m.u0 >= b.u1 - TOL).map(m => m.u0)];
        const dA = rn(b.u0 - Math.max(...trai), 2), dB = rn(Math.min(...phai) - b.u1, 2), tlMs = cao.filter(m => m.chuc === 'tl');
        if (Math.min(dA, dB) < BO.bep_dau - TOL) loi.push(`${ten(b)}: bếp cách ${tlMs.some(tlM => Math.abs(tlM.u1 - b.u0) < BO.bep_dau || Math.abs(b.u1 - tlM.u0) < BO.bep_dau) ? 'khoang tủ lạnh' : 'tường / tủ cao / đầu dãy'} ${g(Math.min(dA, dB))} < 300.`);
        for (const tlM of tlMs) { const dt = rn(tlM.u1 <= b.u0 + TOL ? b.u0 - tlM.u1 : tlM.u0 - b.u1, 2); if (dt >= BO.bep_dau - TOL && dt < BO.bep_tl - TOL) canh_bao.push(`${ten(b)}: bếp cách hồi khoang tủ lạnh ${g(dt)} < 500 — hơi nóng làm tủ lạnh tốn điện.`); }
      }
      // ống thoát trong lọt tủ chậu
      if (bo.ong && bo.ong.canh === i) for (const c of d.filter(m => m.chuc === 'chau')) {
        const uo = e.lat ? e.dai - bo.ong.s : bo.ong.s, lot = rn(c.rong - 2 * t, 2), th = thungU(c, e.lat), tam = (th[0] + th[1]) / 2;
        if (Math.abs(uo - tam) > lot / 2 - 50 + TOL) loi.push(`${ten(c)}: ống thoát cách tâm chậu ${g(rn(Math.abs(uo - tam), 1))} — nằm ngoài lọt tủ chậu (cho phép ≤ ${g(rn(lot / 2 - 50, 1))}).`);
      }
      // tủ cao kề góc (chữ L)
      if (L) { const tc0 = d.find(m => m.tang === 'cao'); if (tc0 && d.filter(m => m.tang === 'duoi' && m.chuc !== 'goc').length === 0) loi.push(`Cạnh ${'AB'[i]}: tủ cao / khoang tủ lạnh kề góc.`); }
    });
    // (vòng soát 1.34) tâm chậu / bếp đã gõ / kéo (bo.chau.s / bo.bep.s) mà bảng phải dời quá ±150 (lượt "cả đoạn"): nói rõ, không dời lặng lẽ
    for (const [k, ten] of [['chau', 'Chậu'], ['bep', 'Bếp']]) {
      const q = bo[k], m = q && q.s !== null ? ds.find(x => x.chuc === k && x.tang === 'duoi' && !x.ghim) : null, e = m && E[m.canh]; if (!e) continue;
      const th = thungU(m, e.lat), u = (th[0] + th[1]) / 2, sT = rn(e.lat ? e.dai - u : u, 1), lech = rn(Math.abs(sT - q.s), 1);
      if (lech > BO.chau_cua_so + 1) canh_bao.push(`${ten} không đặt được quanh tâm đã chọn ${g(q.s)} — bảng dời về tâm ${g(sT)} (lệch ${g(lech)}); dời ống / tâm, hoặc ghim tủ ${k === 'chau' ? 'chậu' : 'bếp'} đúng chỗ muốn.`);
    }
    if (!ds.some(m => m.chuc === 'chau')) loi.push('Dãy không có tủ chậu.');
    // (vòng soát 2 — 1.34) ống thoát ở cạnh không có tủ chậu: phép kiểm "ống lọt tủ chậu" ở trên chỉ xét chậu cùng cạnh — chậu cạnh kia là ống bị bỏ qua lặng lẽ
    else if (bo.ong && E[bo.ong.canh] && !ds.some(m => m.chuc === 'chau' && m.canh === bo.ong.canh)) loi.push(`Ống thoát ở cạnh ${'AB'[bo.ong.canh]} mà tủ chậu ở cạnh ${'AB'[ds.find(m => m.chuc === 'chau').canh]} — chậu phải trùm ống thoát (dời ống hoặc bỏ ô Ống thoát rồi đặt chậu).`);
    if (!ds.some(m => m.chuc === 'bep')) loi.push('Dãy không có tủ bếp nấu.');
    // hút mùi trên bếp
    for (const h of ds.filter(m => m.chuc === 'hm')) { const b = ds.find(m => m.chuc === 'bep' && m.canh === h.canh && m.u0 < h.u1 && m.u1 > h.u0); if (b && Math.abs((h.u0 + h.u1) / 2 - (b.u0 + b.u1) / 2) > 50 + TOL) canh_bao.push(`${ten(h)}: hút mùi lệch tâm bếp ${g(rn(Math.abs((h.u0 + h.u1) / 2 - (b.u0 + b.u1) / 2), 1))} > 50.`); }
    for (const h of ds.filter(m => m.hm700)) canh_bao.push(`${ten(h)}: tủ hút mùi ${g(h.rong)} trên bếp ${g(h.rong)} dùng máy âm 700 — hai tủ trên kề không bớt được 25 cho tủ 950 (máy 900).`);
    // sơ chế
    if (pa && pa.so_che !== undefined) { if (pa.so_che < BO.so_che[0] - TOL) canh_bao.push(`Mặt sơ chế giữa chậu và bếp ${g(pa.so_che)} < 600.`); else if (pa.so_che < BO.so_che[1] - TOL) luu_y.push(`Mặt sơ chế ${g(pa.so_che)} — nên 800 – 1200.`); }
    // tủ lạnh: mặt đặt đồ phía tay nắm (từng tủ lạnh), tam giác bếp (tủ lạnh gần chậu nhất); (bản 1.35) tủ lạnh âm: nhắc kiểm catalogue máy
    const tlMs = bo.tl ? ds.filter(m => m.chuc === 'tl') : [];
    const pt = m => { const th = thungU(m, E[m.canh].lat), u = (th[0] + th[1]) / 2, dd = F / 2; return L ? (m.canh === 0 ? [u, dd] : [dd, u]) : [u, 0]; };
    const kc = (a, q) => rn(Math.hypot(pt(a)[0] - pt(q)[0], pt(a)[1] - pt(q)[1]), 1);
    for (const tlM of tlMs) {
      const tlo = tlM.tl_i === 1 && bo.tl2 ? bo.tl2 : bo.tl, nhan = tlMs.length > 1 ? ` ${tlM.vt}` : '';
      const d = ds.filter(m => m.canh === tlM.canh && m.tang !== 'tren').sort((a, b) => a.u0 - b.u0), j = d.indexOf(tlM);
      const vao = tlM.u0 < (d[0].u0 + d[d.length - 1].u1) / 2 ? 1 : -1;      // phía vào dãy
      let dat = 0;
      if (tlo.ban_le !== 'trong') for (let q = j + vao; q >= 0 && q < d.length; q += vao) { const m = d[q]; if (m.tang === 'cao' || m.chuc === 'chau' || m.chuc === 'bep') break; dat += m.rong; }
      if (dat < BO.dat_tl - TOL) canh_bao.push(`Mặt đặt đồ cạnh tay nắm tủ lạnh${nhan} ${g(rn(dat, 1))} < 380${tlo.ban_le === 'trong' ? ' (bản lề phía trong: tay nắm phía tường)' : ''}.`);
      if (tlo.kieu === 'am') luu_y.push(`Tủ lạnh âm${nhan}: tủ cao bao quanh hở ${g(tlo.ho_hong)} mỗi hông, cánh ốp cùng màu + bộ ray dẫn cánh — kiểm catalogue máy âm (kích thước hốc, khe thoát nhiệt chân / nóc) trước khi cắt [CĐ].`);
    }
    { const c = ds.find(m => m.chuc === 'chau'), b = ds.find(m => m.chuc === 'bep'), tlM = c && tlMs.length ? tlMs.reduce((a, x) => (kc(x, c) < kc(a, c) ? x : a)) : null;
      if (c && b && tlM) {
        const ca = [['tủ lạnh ↔ chậu', kc(tlM, c)], ['chậu ↔ bếp', kc(c, b)], ['bếp ↔ tủ lạnh', kc(b, tlM)]], tong = rn(sum(ca.map(x => x[1])), 1);
        const ngoai = ca.filter(x => x[1] < BO.canh_tg[0] - TOL || x[1] > BO.canh_tg[1] + TOL);
        if (tong < BO.tam_giac[0] - TOL || tong > BO.tam_giac[1] + TOL || ngoai.length) canh_bao.push(`Tam giác bếp ${g(tong)}${ngoai.length ? ` — cạnh ${ngoai.map(x => `${x[0]} ${g(x[1])}`).join(', ')} ngoài 1200 – 2700` : ' ngoài 4000 – 7900'}.`);
      } }
    // (bản 1.35) tầng trên kịch trần: trần thấp quá thì không làm — nói rõ
    // (vòng soát 1.35) trần THẤP HƠN đỉnh tủ trên / tủ cao: tủ không lọt chỗ đặt — LỖI (không phải chuyện bịt nẹp trần)
    { const Q2 = soBo(bo, opt && opt.nen), dinh = rn(Math.max(Q2.zT2, ...ds.filter(m => m.tang === 'tren' || m.tang === 'cao').map(m => (m.cao > 0 ? rn(m.z + m.cao) : 0)))), kh = rn(bo.tran - dinh);
      if (bo.tran > 0 && kh < -TOL) loi.push(`Trần ${g(bo.tran)} thấp hơn đỉnh tủ trên / tủ cao ${g(dinh)} — tủ không lọt; hạ Cao tủ trên ở Chuẩn bếp (≤ ${g(Math.max(0, rn(bo.tran - Q2.zTren)))}) hoặc gõ lại trần.`);
      else if (Q2.h2_thieu !== null) luu_y.push(`Trần ${g(bo.tran)}: khe ${g(kh)} trên đỉnh tủ trên (+${g(dinh)}) — không đủ làm tầng trên (< ${g(BO.tang2_min)}), bịt nẹp trần.`); }
    // (vòng soát 1.35) tủ tầng trên ngay trên tủ hút mùi: ống khói đi qua
    for (const m of ds.filter(q => q.ong_hm)) luu_y.push(`${ten(m)}: ống khói hút mùi đi qua tủ tầng trên — bảng kê ghi lỗ ống ở đáy + nóc (ống ra tường thì khoét hậu thay lỗ nóc), không đợt.`);
    // tủ cỡ lẻ
    const le = ds.filter(m => m.le); if (le.length) canh_bao.push(`Có tủ cỡ lẻ: ${le.map(m => `${m.vt} ${g(m.rong)}`).join(', ')}.`);
    if (L) canh_bao.push(`Tủ góc ${G.ten}: bản lề cánh tủ góc (165° hay thường) và chiều trái / phải mã rổ góc chưa có nguồn [CĐ] — hỏi đại lý trước khi đặt hàng.`);
    // đá
    for (const d of (pa && pa.da) || []) {
      if (!d.hop_le) canh_bao.push(`Đá cạnh ${'AB'[d.canh]} dài ${g(d.dai)} > ${g(BO.kho_da)} mà không có mối nối hợp lệ (mối nối tủ cách khoét ≥ 150).`);
      if (d.tam.length > 1) luu_y.push(`Đá cạnh ${'AB'[d.canh]}: ghép ${d.tam.length} tấm (${d.tam.map(x => g(x.dai)).join(' + ')}) × ${g(d.sau)}.`);
    }
    // từng tủ: LỖI / cảnh báo / ghi của chính tủ đó
    for (const x of tuBo(bo, pa, opt)) {
      const M = dungBo(x.spec), m = ds.find(q => q.vt === x.vt);
      for (const e of M.errors) loi.push(`${ten(m)}: ${e}`);
      for (const k of M.kq) if (k.muc === 'loi' && M.errors.indexOf(k.t) < 0) loi.push(`${ten(m)}: ${k.t}`);
      for (const w of M.warnings) canh_bao.push(`${ten(m)}: ${w}`);
      for (const n of M.notes || []) if (/nhô/.test(n)) luu_y.push(`${ten(m)}: ${n}`);
      if (m.chuc === 'tl' && x.spec.sau_thung > B.sau_cao + TOL) luu_y.push(`${ten(m)}: tủ cao sâu ${g(x.spec.sau_thung)} theo máy âm (chuẩn ${g(B.sau_cao)}) — mặt cánh nhô ${g(rn(x.spec.sau_thung - B.sau_cao))} trước tủ cao khác.`);
    }
    const uniq = a => a.filter((v, i) => a.indexOf(v) === i);
    return { loi: uniq(loi), canh_bao: uniq(canh_bao), luu_y: uniq(luu_y) };
  }
  /** Kéo chậu / bếp / tủ lạnh trên hình (hàm thuần): vat 'chau' | 'bep' ghi tâm (làm tròn lưới 50) vào bo.chau.s / bo.bep.s; 'tl' chọn đầu gần chỗ thả. x = s hoặc { canh, s, tl_i (1 = tủ lạnh thứ hai) }. */
  function keoBo(boIn, vat, x) {
    const bo = chuanBo(boIn), q = x && typeof x === 'object' ? x : { s: x }, ci = bo.kieu === 'L' && num(q.canh, 0) === 1 ? 1 : (x && typeof x === 'object' && 'canh' in q ? 0 : null);
    const s = num(q.s, NaN); if (!isFinite(s)) return bo;
    const o = clone(bo);
    if (vat === 'chau' || vat === 'bep') {
      o[vat].s = Math.round(s / 50) * 50; if (ci !== null && (vat === 'chau' || bo.kieu === 'L')) o[vat].canh = ci;
      // (vòng soát 2 — 1.34) kéo = chọn chỗ mới: bỏ ghim của chính tủ chậu / bếp (ghim thắng thì lần kéo không có tác dụng, kéo sang cạnh kia thì chậu mang u0 của cạnh cũ)
      for (const vt of Object.keys(o.khoa || {})) { const m = MAU_BEP_DUOI.find(x => x.ma === o.khoa[vt].ma); if (m && m.chuc_nang === vat) delete o.khoa[vt]; }
    }
    else if (vat === 'tl' && o.tl) {
      // (vòng soát 1.35) x.tl_i = 1: kéo tủ lạnh THỨ HAI — thả trong nửa của nó: không đổi; sang đầu kia: hai tủ lạnh đổi đầu (mỗi máy giữ khoang của nó)
      if (num(q.tl_i, 0) === 1 && o.tl2) {
        const L = bo.kieu === 'L', c = ci !== null ? ci : o.tl2.canh, e = o.canh[L ? c : 0], d = L ? (c === 0 ? 'dau' : 'cuoi') : s < e.dai / 2 ? 'dau' : 'cuoi';
        if (L ? c !== o.tl2.canh : d !== o.tl2.dau) { const a = { canh: o.tl2.canh, dau: o.tl2.dau }; o.tl2.canh = o.tl.canh; o.tl2.dau = o.tl.dau; o.tl.canh = a.canh; o.tl.dau = a.dau; }
      } else { if (ci !== null) o.tl.canh = ci; const e = o.canh[o.tl.canh]; o.tl.dau = s < e.dai / 2 ? 'dau' : 'cuoi'; }
    }
    return chuanBo(o);
  }

  /* ---- (bản 1.34, bước 4 — thiết kế §9) CHỖ ĐẶT CẢ DÃY: hàm thuần; driver chỉ việc vẽ từng tủ ở `at` + `xoay` (D.veDay) ----
   * Quy ước hướng (như khung của thẻ Phòng, Ph.datKhung): cạnh chạy theo hướng d = (cos xoay, sin xoay) — trái → phải khi đứng trong phòng nhìn vào tường; lòng phòng ở BÊN PHẢI
   * hướng đó (n = (sin, −cos)); tủ quay `xoay` độ quanh gốc thiết kế thì trục y của tủ (ra sau, về tường) trùng −n. */
  const xoayChuan = a => { let v = rn(num(a, 0) % 360, 6); if (v > 180) v -= 360; if (v <= -180) v += 360; return Object.is(v, -0) ? 0 : v; };
  const huong = a => { const r = a * Math.PI / 180; return [rn(Math.cos(r), 12), rn(Math.sin(r), 12)]; };
  const so3 = p => Array.isArray(p) && p.length >= 2 && isFinite(num(p[0], NaN)) && isFinite(num(p[1], NaN));
  /**
   * Chỗ đặt dãy từ điểm bấm. Chữ I: [lưng đầu trái, một điểm theo hướng dãy]. Chữ L: [góc trong, một điểm trên cạnh A, một điểm trên cạnh B] (hai cạnh vuông góc ± 20°).
   * @returns {{ goc: [x, y, z], xoay, re: null | 'phai' | 'trai', dai: [dài đo theo điểm bấm] }} | null
   */
  function choDiem(kieu, pts) {
    const P = (Array.isArray(pts) ? pts : []).filter(so3).map(p => [num(p[0], 0), num(p[1], 0), num(p[2], 0)]);
    const vec = (a, b) => { const v = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(v[0], v[1]); return l >= 50 ? { e: [v[0] / l, v[1] / l], l } : null; };
    const goc = P[0] ? P[0].map(v => rn(v, 2)) : null, ra = (d, re, dai) => ({ goc, xoay: xoayChuan(rn(Math.atan2(d[1], d[0]) * 180 / Math.PI, 4)), re, dai: dai.map(v => rn(v, 1)) });
    if (kieu !== 'L') { if (P.length < 2) return null; const a = vec(P[0], P[1]); return a ? ra(a.e, null, [a.l]) : null; }
    if (P.length < 3) return null;
    const a = vec(P[0], P[1]), b = vec(P[0], P[2]); if (!a || !b) return null;
    const x = a.e[0] * b.e[1] - a.e[1] * b.e[0];      // A × B: dương = cạnh B đi ra phía phòng ở bên phải khi nhìn vào tường A → góc ở đầu PHẢI cạnh A
    if (Math.abs(x) < Math.cos(20 * Math.PI / 180)) return null;
    return x > 0 ? ra([-a.e[0], -a.e[1]], 'phai', [a.l, b.l]) : ra(a.e, 'trai', [a.l, b.l]);
  }
  // dấu của một tủ trong dãy (FNV-1a 32 bit ×2): spec + chỗ đặt — Cập nhật bộ so theo dấu
  const dauBam = t => { let h1 = 0x811c9dc5, h2 = 0x01000193 ^ t.length; for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0; h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0; } return ('0000000' + h1.toString(16)).slice(-8) + ('0000000' + h2.toString(16)).slice(-8); };
  /**
   * Chỗ đặt từng tủ của một phương án (thiết kế §9). cho = { goc: [x, y, z] (chữ I: lưng đầu trái; chữ L: góc trong), xoay: hướng cạnh A }. Chữ L: rẽ theo bo.canh[1].re.
   * @returns [{ vt, canh, tang, ma, spec, at: gốc thiết kế tủ trên bản vẽ (mép trái, mặt trước thùng, sàn — tủ trên + cao độ treo), xoay, sig }] theo thứ tự vẽ: dưới A → dưới B → cao → trên | null
   */
  function datDay(boIn, pa, cho, opt) {
    if (!pa || !Array.isArray(pa.ds) || !cho || !so3(cho.goc)) return null;
    const bo = chuanBo(boIn), L = bo.kieu === 'L', a = xoayChuan(cho.xoay), G = [num(cho.goc[0], 0), num(cho.goc[1], 0), num(cho.goc[2], 0)];
    const dA = huong(a), nA = [dA[1], -dA[0]], daiA = bo.canh[0].dai;
    // gốc (s = 0) + hướng của từng cạnh
    const E = [];
    if (!L) E.push({ p0: G, a });
    else if (bo.canh[1].re !== 'trai') { E.push({ p0: [G[0] - dA[0] * daiA, G[1] - dA[1] * daiA], a }); E.push({ p0: G, a: xoayChuan(a - 90) }); }
    else { const dB = bo.canh[1].dai; E.push({ p0: G, a }); E.push({ p0: [G[0] + nA[0] * dB, G[1] + nA[1] * dB], a: xoayChuan(a + 90) }); }
    const T = tuBo(bo, pa, opt), out = [];
    for (const x of T) {
      const m = pa.ds.find(q => q.vt === x.vt), e = E[x.canh] || E[0], d = huong(e.a), n = [d[1], -d[0]];
      const M = dungBo(x.spec), bb = bbox(M.parts), lung = Math.max(bb ? bb.y1 : 0, x.spec.sau_thung) + (x.tang === 'tren' && !x.sau_cao ? 0 : num(x.spec.bep && x.spec.bep.cach_tuong, 0));
      const at = [rn(e.p0[0] + d[0] * x.s0 + n[0] * lung, 2), rn(e.p0[1] + d[1] * x.s0 + n[1] * lung, 2), rn(G[2] + x.z, 2)];
      out.push({ vt: x.vt, canh: x.canh, tang: x.tang, ma: m ? m.ma : '', spec: x.spec, at, xoay: e.a, sig: dauBam(JSON.stringify([x.spec, at, e.a])) });
    }
    const hang = x => ['duoi', 'cao', 'tren'].indexOf(x.tang) * 10 + (x.tang === 'cao' ? 0 : x.canh);
    return out.map((x, i) => [x, i]).sort((p, q) => hang(p[0]) - hang(q[0]) || p[1] - q[1]).map(p => p[0]);
  }
  /**
   * So dãy đã vẽ (da_ve: [{ vt, id, sig, at, xoay }]) với dãy mới (datDay) theo mã vị trí: cùng dấu → giữ; cùng chỗ (gốc + hướng) mà spec khác → sửa (Cập nhật tủ, giữ lưng + z);
   * khác chỗ → dời (xoá + vẽ lại); không còn → bỏ; chưa có → thêm.
   */
  function doiDay(daVe, ds) {
    const cu = new Map(), r = { giu: [], sua: [], doi: [], bo: [], them: [] };
    for (const y of Array.isArray(daVe) ? daVe : []) if (y && y.vt) cu.set(y.vt, y);
    const cungCho = (y, x) => Array.isArray(y.at) && y.at.length === 3 && y.at.every((v, i) => Math.abs(num(v, NaN) - x.at[i]) < 0.5) && Math.abs(xoayChuan(num(y.xoay, 0) - x.xoay)) < 0.01;
    for (const x of ds || []) {
      const y = cu.get(x.vt); if (!y) { r.them.push(x); continue; }
      cu.delete(x.vt);
      if (y.sig === x.sig) r.giu.push({ vt: x.vt, id: y.id, x });
      else (cungCho(y, x) ? r.sua : r.doi).push({ vt: x.vt, id: y.id, x });
    }
    for (const y of cu.values()) r.bo.push({ vt: y.vt, id: y.id });
    return r;
  }

  // [mã, tên, rộng, sâu, cao, chân, [ô…]] — bộ mẫu táp 1.32 (tủ 1 khoang không cánh, ngăn kéo trùm phủ kín — "trông như cái hộp", anh Thanh 14/10/2026).
  // (bản 1.34.1) KHÔNG còn trong Thư viện; mã cũ vẫn dựng được (apMau / thông số đã lưu không mang khoá tap → dựng như 1.32)
  const MAU_TAP_CU = [
    ['TAP2-450', 'Táp 2 ngăn kéo 450', 450, 400, 450, 0, () => ({ dot: [], o: [{ tu: 0, kieu: 'nk_trum', so: 2 }] })],
    ['TAP2-500', 'Táp 2 ngăn kéo 500', 500, 420, 500, 0, () => ({ dot: [], o: [{ tu: 0, kieu: 'nk_trum', so: 2 }] })],
    ['TAP2-500-C', 'Táp 2 ngăn kéo 500, chân đế 80', 500, 420, 550, 80, () => ({ dot: [], o: [{ tu: 0, kieu: 'nk_trum', so: 2 }] })],
    ['TAP1H-500', 'Táp 1 ngăn kéo + hộc mở 500', 500, 420, 500, 0, () => ({ dot: [230], o: [{ tu: 230, kieu: 'nk_trum', so: 1 }] })],
    ['TAP3-600', 'Táp 3 ngăn kéo 600', 600, 450, 600, 0, () => ({ dot: [], o: [{ tu: 0, kieu: 'nk_trum', so: 3 }] })],
  ].map(([ma, ten, rong, sau, cao, chan, k]) => ({ ma, ten, loai_sp: 'tap', mo_ta: `${g(rong)} × ${g(sau)} × ${g(cao)}${chan ? `, chân ${g(chan)}` : ''}`,
    ap: keep => Object.assign(keep, { loai_sp: 'tap', ma: 'TAP', ten, rong, cao, sau_thung: sau, khoang: [Object.assign({ rong: 'auto', canh: 0 }, k())], than: Object.assign({}, keep.than, { cao_duoi: 0 }), phao: Object.assign({}, keep.phao, { trai: 0, phai: 0, tren: 0 }), chan: Object.assign({}, keep.chan, { cao: chan }), khau: khongKhauSP(keep) }) }));
  // (bản 1.34.1) táp theo 5 KIỂU ảnh anh Thanh gửi 14/10/2026 — anh duyệt: "chọn mẫu ra rồi điền KT xong vẽ thôi" → Thư viện chỉ có 5 mục theo kiểu,
  // không liệt kê cỡ. Kiểu (KIEU_TAP) = kết cấu (s.tap: gờ / nóc / đáy / chân / tay nắm) + xà đế + luật chia ruột; cỡ mặc định chỉ là chỗ bắt đầu.
  //   A gờ chắn (hồi + gờ sau nhô, bo góc) + hộc mở + 1 ngăn kéo lọt lòng, xà đế lùi · B gờ chắn + 2 ngăn kéo lọt lòng có thanh ngang (1.36.2: xà đế như A)
  //   C nóc chồm (đua 2 bên + trước) + hộc mở + 1 ngăn kéo · D hộp: nóc phủ (1.36.2: đáy lọt trên xà đế), 2 ngăn kéo trùm, khe tay nắm có rãnh móc · E nóc phủ, 2 ngăn kéo tay nắm khoét, chân gỗ rời
  // Ruột chia theo LÒNG thân (mặt trên đáy → mặt dưới nóc) — ruotTap. Số CHƯA ĐO ở xưởng [CĐ] — anh xác nhận rồi ghi lại.
  // (1.36.2 — anh Thanh 15/10/2026, ảnh táp A: "tủ nào cũng phải có cái xà như này") MỌI kiểu có thân đứng trên sàn (A … D) cùng XÀ ĐẾ của A: cao XA_TAP,
  // lùi DEFAULT_TAP.lui_chan, kẹp giữa hai hồi xuống sàn. D trước là đáy phủ sát sàn (không xà đế) → nay đáy LỌT giữa hai hồi như A (đáy phủ không có hồi kẹp xà);
  // B trước đáy sát sàn, C xà 40. Riêng E giữ chân gỗ rời (thân nâng lên, không xà). [CĐ]
  const XA_TAP = 50;
  const KIEU_TAP = {
    A: { ma: 'TAP-GO1', ten: 'Táp gờ chắn · hộc mở + 1 ngăn kéo', nut: 'Gờ · hộc', co: [450, 400, 600], chan: XA_TAP, hoc: true, so: 1, nk: 'nk_am', tap: { go: 80, bo: 40, tay_nam: 'num' } },
    B: { ma: 'TAP-GO2', ten: 'Táp gờ chắn · 2 ngăn kéo lọt lòng', nut: 'Gờ · 2 kéo', co: [450, 400, 560], chan: XA_TAP, hoc: false, so: 2, nk: 'nk_am', tap: { go: 60, bo: 40, tay_nam: 'num' } },
    C: { ma: 'TAP-CHOM', ten: 'Táp nóc chồm · hộc mở + 1 ngăn kéo', nut: 'Nóc chồm', co: [450, 380, 550], chan: XA_TAP, hoc: true, so: 1, nk: 'nk_am', tap: { noc: 'phu', dua: 20, dua_truoc: 20, tay_nam: 'num' } },
    D: { ma: 'TAP-HOP2', ten: 'Táp hộp · 2 ngăn kéo trùm, khe tay nắm', nut: 'Hộp · khe', co: [450, 400, 480], chan: XA_TAP, hoc: false, so: 2, nk: 'nk_trum', tap: { noc: 'phu', dua_truoc: -1, tay_nam: 'khe', khe_tn: 25 } },
    E: { ma: 'TAP-CHAN2', ten: 'Táp chân gỗ · 2 ngăn kéo tay nắm khoét', nut: 'Chân gỗ', co: [500, 400, 580], chan: 0, hoc: false, so: 2, nk: 'nk_am', tap: { noc: 'phu', dua: 15, dua_truoc: 15, day: 'phu', chan_go: 150, tay_nam: 'khoet', thanh: 0 } },
  };
  // luật chia ruột táp [CĐ]: vùng ngăn kéo dưới hộc mở ≈ 42 % lòng thân, trong 140 … 240; hộc mở lọt lòng < 100 thì bỏ hộc (cả lòng là 1 ngăn kéo);
  // táp toàn ngăn kéo: lòng mỗi ngăn 130 … 260 — thấp quá thì bớt ngăn, cao quá thì thêm (tối đa 3)
  const TAP_RUOT = { ti: 0.42, nk_min: 140, nk_max: 240, hoc_min: 100, ngan_min: 130, ngan_max: 260, so_max: 3 };
  const r5 = v => Math.round(v / 5) * 5;
  /** Dấu ruột tự chia của táp (đợt + nội dung ô từng khoang, không tính cánh): còn khớp dấu đã ghi = người dùng chưa sửa ruột → đổi cỡ thì chia lại. */
  //  Ô ghi theo THỨ TỰ ô (số đợt nằm dưới mốc của nó), không theo mốc: bảng dời mốc ô sát đáy về mặt dưới tấm đáy (cellFor) — đó không phải người dùng sửa ruột.
  const sigTap = s => (s.khoang || []).map(k => { const dot = k.dot || []; return `${dot.join(',')}|${(k.o || []).map(o => `${dot.filter(z => z <= num(o.tu, 0) + 0.6).length}:${o.kieu}:${o.so || ''}`).join(',')}`; }).join(';');
  /** Ruột táp theo kiểu s.tap.kieu và cỡ hiện tại của s (đã normalize). Dựng thử thân rỗng để đo lòng (mặt trên đáy → mặt dưới nóc) — hàm thuần. */
  function ruotTap(s) {
    const K = KIEU_TAP[s.tap && s.tap.kieu]; if (!K) return clone(s.khoang);
    const k0 = s.khoang[0] || {}, canh = k0.canh || 0, t = s.van.t, R = TAP_RUOT;
    const thu = clone(s); thu.khoang = [{ rong: 'auto', canh, dot: [], o: [] }];
    const M = build(normalize(thu)), day = M.parts.filter(p => p.loai === 'DAY'), noc = M.parts.filter(p => p.loai === 'NOC');
    const z0 = day.length ? Math.max(...day.map(p => p.z1)) : 0, z1 = noc.length ? Math.min(...noc.map(p => p.z0)) : s.cao, L = z1 - z0;
    let dot = [], o;
    if (K.hoc) {
      const Z = Math.min(R.nk_max, Math.max(R.nk_min, r5(L * R.ti)));
      if (L - Z - t >= R.hoc_min) { const d = r5(z0 + Z); dot = [d]; }
      o = [{ tu: 0, kieu: K.nk, so: 1 }];
    } else {
      let so = K.so;
      while (so > 1 && L / so < R.ngan_min) so--;
      while (so < R.so_max && L / so > R.ngan_max) so++;
      o = [{ tu: 0, kieu: K.nk, so }];
    }
    return [Object.assign({ rong: 'auto', canh, dot, o })];
  }
  /** Táp kiểu `kieu` (A … E) cỡ { rong, sau, cao } (thiếu = cỡ mặc định của kiểu) trên Chuẩn xưởng của `keep`: kết cấu theo kiểu, ruột chia theo cỡ, ghi dấu tự chia. */
  function tapTheoKieu(kieu, co, keep) {
    const K = KIEU_TAP[kieu]; if (!K) return null;
    const c = co || {}, kc = (v, d) => { const x = num(v, d); return x > 0 ? x : d; };
    keep = clone(keep || DEFAULT_SPEC);
    const s = normalize(Object.assign(keep, { loai_sp: 'tap', ma: 'TAP', ten: K.ten, rong: kc(c.rong, K.co[0]), sau_thung: kc(c.sau, K.co[1]), cao: kc(c.cao, K.co[2]),
      khoang: [{ rong: 'auto', canh: 0, dot: [], o: [] }], than: Object.assign({}, keep.than, { cao_duoi: 0 }), phao: Object.assign({}, keep.phao, { trai: 0, phai: 0, tren: 0 }),
      chan: Object.assign({}, keep.chan, { cao: K.chan }), khau: khongKhauSP(keep), tap: Object.assign({}, DEFAULT_TAP, K.tap, { kieu }) }));
    s.khoang = ruotTap(s);
    const n = normalize(s); n.tap.tu_dong = sigTap(n); return n;
  }
  /** Đổi kiểu táp, GIỮ rộng / sâu / cao đang có. */
  //  (soát 1.34.1) GIỮ cả phào (trái / phải / trên) và cánh của khoang đầu — bấm lại nút kiểu là cách chia lại ruột, không được xoá lặng lẽ thứ người dùng đã thêm
  //  (rộng phủ bì giữ nguyên → mất phào là thân phình ra). Xà đế (chan.cao) thì theo kiểu: kiểu định nghĩa xà đế.
  const doiKieuTap = (spec, kieu) => {
    const s = clone(spec || {}), n = tapTheoKieu(kieu, { rong: s.rong, sau: s.sau_thung, cao: s.cao }, s); if (!n) return n;
    const ph = s.phao || {}, k0 = (s.khoang || [])[0] || {}, canh = num(k0.canh, 0);
    if (!(num(ph.trai, 0) > 0 || num(ph.phai, 0) > 0 || num(ph.tren, 0) > 0 || canh > 0)) return n;
    n.phao = Object.assign({}, n.phao, { trai: num(ph.trai, 0), phai: num(ph.phai, 0), tren: num(ph.tren, 0) });
    n.khoang = [Object.assign({}, n.khoang[0], { canh }, k0.ban_le ? { ban_le: k0.ban_le } : {})];
    const m = normalize(n); m.khoang = ruotTap(m);
    const r = normalize(m); r.tap.tu_dong = sigTap(r); return r;
  };
  /** Táp có kiểu mà người dùng chưa sửa ruột (dấu còn khớp): chia lại ruột theo cỡ hiện tại. → { spec, doi } (spec mới khi đổi; không đổi thì spec cũ). */
  function tapTuDong(spec) {
    const s = spec;
    if (!s || s.loai_sp !== 'tap' || !s.tap || !KIEU_TAP[s.tap.kieu] || !s.tap.tu_dong || s.tap.tu_dong !== sigTap(s)) return { spec, doi: false };
    const k = ruotTap(s), n = normalize(Object.assign(clone(s), { khoang: k })), sig = sigTap(n);
    if (sig === s.tap.tu_dong) return { spec, doi: false };
    n.tap.tu_dong = sig; return { spec: n, doi: true };
  }
  const MAU_TAP = Object.keys(KIEU_TAP).map(kieu => { const K = KIEU_TAP[kieu], tap = K.tap; return { ma: K.ma, ten: K.ten, kieu, loai_sp: 'tap',
    mo_ta: `Kiểu ${kieu}: ${tap.go ? `gờ ${g(tap.go)}, ` : ''}${tap.chan_go ? `chân gỗ ${g(tap.chan_go)}, ` : K.chan ? `xà đế ${g(K.chan)}, ` : ''}${TAY_NAM_TAP[tap.tay_nam]} — cỡ đầu ${K.co.map(g).join(' × ')}, gõ Rộng / Sâu / Cao thì ruột tự chia lại`,
    ap: keep => tapTheoKieu(kieu, null, keep) }; });
  // (1.36.2 — anh Thanh 15/10/2026: "chỉ làm 1 hạng mục là táp thôi, trong đó hiện nhiều mẫu có hình ảnh click vào là xong") ô Thư viện chỉ còn MỘT mục táp:
  // dựng táp kiểu A cỡ mặc định, kiểu chọn bằng THẺ HÌNH trong khối Kiểu táp (bảng). MAU_TAP vẫn giữ (apMau 'TAP-GO1'… — file / phép thử cũ không gãy).
  const MAU_TAP_TV = [{ ma: '@TAP', ten: 'Táp đầu giường', loai_sp: 'tap', kieu: 'A', mo_ta: 'chọn kiểu A – E bằng thẻ hình trong khối Kiểu táp, gõ Rộng / Sâu / Cao thì ruột tự chia lại', ap: keep => tapTheoKieu('A', null, keep) }];
  // [mã, tên, kiểu, nệm rộng, nệm dài, cao đầu giường, thêm vào spec.giuong]
  const MAU_GIUONG = [
    ['G12-T', 'Giường 1m2 × 2m', 'thuong', 1200, 2000, 900, {}],
    ['G16-T', 'Giường 1m6 × 2m', 'thuong', 1600, 2000, 1000, {}],
    ['G18-T', 'Giường 1m8 × 2m', 'thuong', 1800, 2000, 1000, {}],
    ['G16-B', 'Giường bay 1m6 × 2m', 'bay', 1600, 2000, 1000, { cao_thanh: 350 }],
    ['G18-B', 'Giường bay 1m8 × 2m', 'bay', 1800, 2000, 1000, { cao_thanh: 350 }],
    ['G16-NK', 'Giường 1m6 × 2m, 4 ngăn kéo', 'nk', 1600, 2000, 1000, { cao_thanh: 350, nk_so: 2 }],
    ['G18-NK', 'Giường 1m8 × 2m, 4 ngăn kéo', 'nk', 1800, 2000, 1000, { cao_thanh: 350, nk_so: 2 }],
  ].map(([ma, ten, kieu, nemR, nemD, cao, them]) => ({ ma, ten, loai_sp: 'giuong', mo_ta: `nệm ${g(nemR)} × ${g(nemD)}, đầu giường cao ${g(cao)}`,
    ap: keep => {
      const s = Object.assign(keep, { loai_sp: 'giuong', ma: 'G1', ten, cao, giuong: Object.assign({}, keep.giuong && keep.giuong.lop ? { lop: keep.giuong.lop, lop_dau: keep.giuong.lop_dau, ho_nem: keep.giuong.ho_nem, lun: keep.giuong.lun } : {}, { kieu }, them) });
      const so = Object.assign({}, s.giuong);
      const pb = phuBiGiuong(s, nemR, nemD); s.rong = pb.rong; s.sau_thung = pb.sau_thung;
      // số vách ngăn gầm ghi sẵn → đổi Dài trong Chenfeng (module) vẫn co giãn đều, không nhảy số tấm
      if (!so.so_thang && kieu !== 'nk') s.giuong.so_thang = Math.max(3, Math.ceil((nemD + 2 * 10) / 600) + 1);
      return s;
    } }));
  // [mã, tên, rộng, cao, số ô] — vách đầu giường: rộng ≈ giường + 2 táp
  const MAU_VACH = [
    ['V2600-1200', 'Vách đầu giường 2600 × 1200 (giường 1m6 + 2 táp)', 2600, 1200, 4],
    ['V2800-1200', 'Vách đầu giường 2800 × 1200 (giường 1m8 + 2 táp)', 2800, 1200, 4],
    ['V3200-1200', 'Vách đầu giường 3200 × 1200', 3200, 1200, 5],
    ['V2800-2400', 'Vách đầu giường kịch trần 2800 × 2400', 2800, 2400, 4],
  ].map(([ma, ten, rong, cao, so]) => ({ ma, ten, loai_sp: 'vach', mo_ta: `${so} ô`,
    ap: keep => { const s = Object.assign(keep, { loai_sp: 'vach', ma: 'VD1', ten, rong, cao, vach: Object.assign({}, keep.vach && typeof keep.vach === 'object' ? keep.vach : {}, { so_o: so, so_hang: 0, so_ngang: 0, cach_san: 0 }) }); Object.assign(s.vach, vachTuDong(s)); return s; } }));
  const THU_VIEN = [
    { loai: 'tu', ten: 'Tủ áo', ds: null },      // MAU_TU (gán bên dưới)
    { loai: 'tap', ten: 'Táp đầu giường', ds: MAU_TAP_TV },
    { loai: 'giuong', ten: 'Giường', ds: MAU_GIUONG },
    { loai: 'vach', ten: 'Vách đầu giường', ds: MAU_VACH },
    { loai: 'bep', ten: 'Bếp', ds: MAU_BEP_TV },      // (1.34.1) 3 mục — chức năng / rộng chọn trong khối Tủ bếp (MAU_BEP_* chỉ còn cho Bộ bếp)
  ];

  /* ------------------------------------------------------------------ *
   * BỘ MẪU TỦ ÁO — chọn là ra tủ; chỉ thay kích thước + khoang, giữ nguyên Chuẩn xưởng của người dùng.
   * Cao độ đợt = MẶT DƯỚI đợt tính từ sàn. Quy ước ruột khoang (thân dưới 2200, chân 100 → mặt trên đáy ở +117,5):
   *   treo dài      : suốt treo dưới đợt +1900 (lọt lòng ~1780 — áo dài, đầm, măng tô), ô trên để chăn / hộp
   *   treo ngắn+đợt : 3 ô xếp đồ cao ~320 (đợt +450 / +785 / +1120) + treo ngắn phía trên (lọt lòng ~1045)
   *   hai tầng treo : đợt +1150 → 2 tầng treo ngắn ~1015–1030 (sơ mi, vest, quần vắt)
   *   ngăn kéo+treo : 2 ngăn kéo âm dưới đợt +570 + treo dài phía trên (lọt lòng ~1595)
   *   ngăn kéo+đợt  : 2 ngăn kéo âm + 4 ô xếp đồ
   *   3 ngăn kéo    : 3 ngăn kéo âm dưới đợt +750, 1 ô xếp đồ, treo ngắn phía trên
   *   khoang trống  : không đợt, không suốt (1.36.4 — anh Thanh 16/10/2026: "thêm khoang thì khoang trống thôi nhiều đợt quá khó xử lý" — thay kiểu 'đợt đều'
   *                   6 ô của bản ≤ 1.36.3: người dùng tự thêm đợt / suốt trên hình, xoá bớt 5 đợt là việc thừa)
   * ------------------------------------------------------------------ */
  const RUOT = {
    treo_dai: () => ({ dot: [1900], o: [{ tu: 0, kieu: 'suot' }] }),
    treo_ngan_dot: () => ({ dot: [450, 785, 1120], o: [{ tu: 1120, kieu: 'suot' }] }),
    hai_tang_treo: () => ({ dot: [1150], o: [{ tu: 0, kieu: 'suot' }, { tu: 1150, kieu: 'suot' }] }),
    nk_treo: () => ({ dot: [570], o: [{ tu: 0, kieu: 'nk_am', so: 2 }, { tu: 570, kieu: 'suot' }] }),
    nk_dot: () => ({ dot: [570, 900, 1230, 1560, 1890], o: [{ tu: 0, kieu: 'nk_am', so: 2 }] }),
    nk3_treo_ngan: () => ({ dot: [750, 1130], o: [{ tu: 0, kieu: 'nk_am', so: 3 }, { tu: 1130, kieu: 'suot' }] }),
    trong: () => ({ dot: [], o: [] }),
  };
  const TEN_RUOT = { treo_dai: 'treo dài', treo_ngan_dot: 'đợt + treo ngắn', hai_tang_treo: 'hai tầng treo', nk_treo: '2 ngăn kéo + treo dài', nk_dot: '2 ngăn kéo + đợt', nk3_treo_ngan: '3 ngăn kéo + treo ngắn', trong: 'khoang trống' };
  // [mã, tên, rộng, cao, cao thân dưới, [[số cánh, ruột, bản lề?], …]]
  const MAU_TU = [
    ['TA2-1000', 'Tủ áo 2 cánh 1000', 1000, 2800, 2200, [[2, 'nk3_treo_ngan']]],
    ['TA2-1100-T', 'Tủ áo 2 cánh 1100, một thân cao 2400', 1100, 2400, 0, [[2, 'nk_treo']]],
    ['TA3-1500', 'Tủ áo 3 cánh 1500', 1500, 2800, 2200, [[2, 'nk_treo'], [1, 'trong', 'phai']]],
    ['TA4-2000', 'Tủ áo 4 cánh 2000', 2000, 2800, 2200, [[2, 'treo_dai'], [2, 'nk_dot']]],
    ['TA4-2000-2T', 'Tủ áo 4 cánh 2000 — hai tầng treo', 2000, 2800, 2200, [[2, 'hai_tang_treo'], [2, 'nk3_treo_ngan']]],
    ['TA5-2500', 'Tủ áo 5 cánh 2500', 2500, 2800, 2200, [[2, 'treo_dai'], [2, 'nk_treo'], [1, 'trong', 'phai']]],
    ['TA6-3000', 'Tủ áo 6 cánh 3000', 3000, 2800, 2200, [[2, 'treo_dai'], [2, 'nk_treo'], [2, 'trong']]],
    ['TA6-3000-VC', 'Tủ áo 6 cánh 3000 — hai người', 3000, 2800, 2200, [[2, 'hai_tang_treo'], [2, 'nk3_treo_ngan'], [2, 'treo_dai']]],
  ].map(([ma, ten, rong, cao, cao_duoi, kh]) => ({ ma, ten, rong, cao, cao_duoi, mo_ta: kh.map(k => `${k[0]} cánh: ${TEN_RUOT[k[1]]}`).join(' · '),
    khoang: () => kh.map(k => Object.assign({ rong: 'auto', canh: k[0] }, k[2] ? { ban_le: k[2] } : {}, RUOT[k[1]]())) }));

  THU_VIEN[0].ds = MAU_TU;
  /** Áp một mẫu tủ áo lên thông số hiện tại: thay mã, tên, rộng, cao, cao thân dưới, khoang; mọi số Chuẩn xưởng khác giữ nguyên. */
  function apMau(specHienTai, ma) {
    let keep = clone(specHienTai || {});
    const k = [MAU_TAP_TV, MAU_TAP, MAU_TAP_CU, MAU_GIUONG, MAU_VACH, MAU_BEP_TV, MAU_BEP_DUOI, MAU_BEP_TREN, MAU_BEP_CAO].map(ds => ds.find(x => x.ma === ma)).find(Boolean);
    if (k) return normalize(k.ap(keep));      // (bản 1.32)
    const m = MAU_TU.find(x => x.ma === ma);
    if (!m) return null;
    // từ táp / giường / vách quay về tủ áo: phào, chân, sâu thùng, khấu về mặc định của tủ; Chuẩn xưởng giữ nguyên (veTuAo)
    if (keep.loai_sp) keep = veTuAo(keep);
    return normalize(Object.assign(keep, { ma: m.ma.replace(/-.*$/, ''), ten: m.ten, rong: m.rong, cao: m.cao, khoang: m.khoang(), than: Object.assign({}, keep.than, { cao_duoi: m.cao_duoi }) }));
  }

  /**
   * Hệ số tuyến tính của từng tấm / từng mẫu theo 3 kích thước phủ bì của tủ — để dựng tủ thành MODULE THAM SỐ GỐC của Chenfeng
   * (tham số L = rộng, W = sâu, H = cao của hộp bao; người dùng sửa ngay ở ô "Thông số" của Chenfeng, tủ co giãn đúng quy tắc kết cấu của bảng này).
   * Toạ độ tính SO VỚI GÓC NHỎ NHẤT của tủ (gốc không gian của module). Với mỗi biến: mép nhỏ / mép lớn của tấm dời a·Δ / b·Δ.
   * @returns {{M, goc:number[], kich:number[], bien:{L,W,H}, ly_do:{L?,W?,H?}}} bien[x] = null nếu module KHÔNG co giãn đúng được theo kích thước đó — ly_do[x] nói vì sao:
   *   'cot_giua' = tủ có cột giữa (chỉ với L) · 'khong_deu' = đổi kích thước đó làm đổi số tấm / thiết kế hỏng (không tuyến tính). Driver khoá tham số đó của module: chỉ để xem.
   *   bien[x] = { tam:[[a,b]…] theo thứ tự M.parts, mau:[{pos, box, params:{k: hệ số}}…] theo thứ tự M.templates có id, sai_so: lệch lớn nhất (mm) khi thử Δ gấp đôi }
   */
  function heSo(spec) {
    const s0 = normalize(spec), M0 = build(s0);
    const hop = p => [p.x0, p.x1, p.y0, p.y1, p.z0, p.z1];
    const r6 = v => Math.round(v * 1e6) / 1e6;
    const bb0 = bbox(M0.parts);
    const out = { M: M0, goc: bb0 ? [bb0.x0, bb0.y0, bb0.z0] : [0, 0, 0], kich: bb0 ? [rn(bb0.x1 - bb0.x0), rn(bb0.y1 - bb0.y0), rn(bb0.z1 - bb0.z0)] : [0, 0, 0], bien: { L: null, W: null, H: null }, ly_do: {} };
    if (M0.errors.length || !bb0) return out;
    const giong = m => !m.kq.some(k => k.muc === 'loi' && k.ma !== 'bep') && m.parts.length === M0.parts.length && m.templates.length === M0.templates.length && m.parts.every((p, i) => p.loai === M0.parts[i].loai && p.type === M0.parts[i].type && (p.khau || []).length === (M0.parts[i].khau || []).length) && m.templates.every((t, i) => t.id === M0.templates[i].id);
    // đổi kích thước không được làm đổi cách tách thùng → giữ nguyên chỗ tách của tủ gốc
    const dung = (khoa, d) => { const s1 = clone(s0); s1[khoa] = s0[khoa] + d; s1.thung = Object.assign({}, s1.thung, { tach: M0.info.tach || [] }); const m = build(s1); return giong(m) && !(m.info.loai_sp === 'vach' && m.kq.some(k => k.ma === 'xuong' && k.muc !== 'ghi')) && !(m.info.loai_sp && m.parts.some((p, i) => p.lines !== M0.parts[i].lines)) ? m : null; };      // giường / vách: vân tấm nào đổi chiều thì không co giãn được      // vách: kéo ra mà xương thưa quá xuong_cach là không co giãn được
    // (bản 1.26.1) Tủ có cột GIỮA không co giãn theo Rộng bằng module: cột khai theo khoảng cách tới mép TRÁI tủ nên đứng yên, còn khoang thì chia lại — vách khấu / hậu khấu
    // lúc bám vách khoang (giữ cách vách ≥ 30, vách lọt vùng cột thì nông lại), lúc bám mép cột → từng đoạn một quy tắc, không bộ hệ số tuyến tính nào đúng cả hai chiều.
    // Đo trên Chenfeng thật 05/10/2026 (tủ 3000, cột cách 1000 rộng 300): gõ L 3000 → 2900 ở ô Thông số thì vách khấu còn cách vách khoang 2,09 (thiết kế cần 30); thu thêm nữa là hai tấm đè nhau.
    // Xét theo cột KHAI trong thông số (kể cả cột dính hồi được khấu như cột góc): nó vẫn neo theo mép trái. Cột góc trái / phải thì bám hồi của nó — co giãn đúng. Sâu / Cao không dính.
    const lsp = loaiSP(s0), sp2 = lsp === 'giuong' || lsp === 'vach';
    const cotGiua = !sp2 && !!(s0.khau && Array.isArray(s0.khau.giua) && s0.khau.giua.length);
    [['L', 'rong', 0], ['W', 'sau_thung', 1], ['H', 'cao', 2]].forEach(([ten, khoa, truc]) => {
      if (ten === 'L' && cotGiua) { out.ly_do[ten] = 'cot_giua'; return; }
      // (bản 1.32) giường ngăn kéo có sâu hộp kẹp theo đà giữa: Rộng không co giãn đều
      if (ten === 'L' && M0.info.giuong && M0.info.giuong.nk && M0.info.giuong.nk.kep) { out.ly_do[ten] = 'khong_deu'; return; }
      // (vòng soát 2 — 1.34) tủ bếp mang nẹp bù (phào): Rộng tăng thì nẹp giãn, thùng đứng yên; thu quá bề nẹp thì thùng hẹp lại + phào mất (normBep) — gãy khúc,
      // module tuyến tính theo nhánh tăng ra phào bề rộng âm khi thu L trong Chenfeng → Rộng chỉ để xem (đổi rộng ở bảng / bộ bếp)
      if (ten === 'L' && s0.bep && s0.bep.nep && s0.bep.nep.thung > 0) { out.ly_do[ten] = 'khong_deu'; return; }
      let M1 = null, d = 0;
      // giường / vách: số tấm (và vân) phải giữ nguyên khi tăng LẪN khi giảm, tới gấp đôi bước thử (module trong Chenfeng kéo được hai chiều)
      for (const thu of [120, -120, 60, -60]) { M1 = dung(khoa, thu); if (M1 && (!sp2 || (dung(khoa, -thu) && dung(khoa, 2 * thu) && dung(khoa, -2 * thu)))) { d = thu; break; } M1 = null; }
      if (!M1) { out.ly_do[ten] = 'khong_deu'; return; }
      const bb1 = bbox(M1.parts), g0 = out.goc[truc], g1 = [bb1.x0, bb1.y0, bb1.z0][truc];
      const dP = [bb1.x1 - bb1.x0, bb1.y1 - bb1.y0, bb1.z1 - bb1.z0][truc] - out.kich[truc];      // thay đổi thật của tham số module
      if (Math.abs(dP) < 1) { out.ly_do[ten] = 'khong_deu'; return; }
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

  return { chuanBo, tlBo, xepBep, kinhO, tuBo, daDay, keDaDay, daDayCSV, roiDay, kiemDay, keoBo, choDiem, datDay, doiDay, GOC_BEP, GOC_MAC_DINH, gocBep, leDuocBep, DEFAULT_BEP, MAC_DINH_BEP_CU, TAY_NAM_BEP, nangChuanBep, baoChuanBepMoi, SO_BEP, KHOA_CHUAN_BEP, LOAI_PK_BEP, LOAI_TB_BEP, MAU_BEP_DUOI, MAU_BEP_TREN, MAU_BEP_CAO, KIEU_BEP, MAU_BEP_TV, kieuBep, bepTheoKieu, canhBepTheoRong, MUC_KIEM_BEP, coTuChoTB, kiemBep, normBep, datBep, khoKhongHau, veTuAo, vachTuDong, LOAI_SP, TEN_SP, KIEU_GIUONG, DEFAULT_GIUONG, DEFAULT_VACH, DEFAULT_TAP, LUI_THANH_MAX, TAP_XA, TAP_XA_CHONG, hauCua, tapKhoaCu, tapKhoaAnh, tapVeChuan, tapBienTheCu, TAY_NAM_TAP, KIEU_TAP, TAP_RUOT, tapTheoKieu, doiKieuTap, tapTuDong, MAU_TAP, MAU_TAP_TV, MAU_TAP_CU, MAU_GIUONG, MAU_VACH, THU_VIEN, loaiSP, phuBiGiuong, MUC_KIEM_GIUONG, MUC_KIEM_VACH, VERSION, DEFAULT_SPEC, LOAI_BAN_LE, banLeCanh, vuaKhoVan, KHONG_KHOAN, KHOA_TU, nhanTu, maTuCuaGhiChu, NHOM, MAU_CHU_GIAI, MAU_TU, apMau, heSo, specDaVe, normalize, build, toChenfeng, mauCF, cutList, cutListCSV, elevationSVG, summary, expectedBoxes, bbox, cutSize, overlap, parseDot, parseTS, tsText, merge, nangCap, KIEU_HAU, vachTheoCot, dinhKhoet, keHoachGoc, lcNganKeo, tempNganKeo, laDayDayNK, dayDayNK, dayDayTS, dayCoCua, bieuThucTT, khoangMong, MUC_KIEM, phieu, kiemLienKet, kiemVaCham, kiemLoGiao, kiemLoLech, kiemMoiNoi, MUC_VE, doLoiThat, nhomMau, locMau, danhGiaMang, tomTatGoi, nhomThuMuc, hinh3D, benPhao };
});
