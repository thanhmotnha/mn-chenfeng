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

  const VERSION = '1.31.1';
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
    than: { cao_duoi: 2200 },  // cao thân dưới tính từ sàn; 0 = một thân
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
    { ma: 'tu_chon', ten: 'Tự gõ số', d: 35, sau: 12, k: 4, day: [0, 99], goc: 0, nguon: '' },
  ];
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
  const NHOM = { DE: 'Thùng', HOI: 'Thùng', VACH: 'Thùng', DAY: 'Thùng', NOC: 'Thùng', DOT: 'Thùng', DEM: 'Thùng', XA: 'Thùng', NEP: 'Thùng', HAU: 'Hậu', CHAN: 'Chân trước', PHAO: 'Phào mặt', PHU: 'Phụ trợ phào', CANH: 'Cánh' };

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
    const phuHoi = s.thung.noc_day === 'phu_hoi';      // (bản 1.31) nóc, đáy phủ hồi: hồi / vách kẹp giữa nóc và đáy
    for (const b of bodies) {
      const dHoi = phuHoi ? b.zt - b.zb : b.z1 - b.z0;
      if (dHoi > s.van.kho_dai + TOL) err(`Thân ${b.code === 'D' ? 'dưới' : 'trên'}: hồi dài ${g(dHoi)} > khổ ván ${g(s.van.kho_dai)} — hồi không cắt được. Giảm "cao thân dưới" hoặc chia thêm thân.`);
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
      const zD0 = phuHoi ? b.zb : b.z0, zD1 = phuHoi ? b.zt : b.z1;      // (bản 1.31) phủ hồi: hồi / vách đứng trên đáy, dưới nóc
      for (let j = 0; j <= n; j++) {
        if (j > 0 && j < n && kep(j)) {      // chỗ tách thùng: hồi phải của thùng bên trái + hồi trái của thùng bên phải, áp lưng nhau
          vR[j - 1] = P({ loai: 'HOI', ten: NM.hoi_phai, than: b.code, tu: b.tu, type: 1, x0: xs[j], x1: xs[j] + t, y0: 0, y1: sauDung(xs[j], xs[j] + t), z0: zD0, z1: zD1, big: 1, vi_tri: j, thung: thungCua[j - 1] });
          vL[j] = P({ loai: 'HOI', ten: NM.hoi_trai, than: b.code, tu: b.tu, type: 1, x0: xs[j] + t, x1: xs[j] + 2 * t, y0: 0, y1: sauDung(xs[j] + t, xs[j] + 2 * t), z0: zD0, z1: zD1, big: 0, vi_tri: j, thung: thungCua[j] });
          continue;
        }
        const ngoai = j === 0 || j === n;
        const p = P({ loai: ngoai ? 'HOI' : 'VACH', ten: j === 0 ? NM.hoi_trai : j === n ? NM.hoi_phai : NM.vach, than: b.code, tu: b.tu, type: 1,
          x0: xs[j], x1: xs[j] + t, y0: 0, y1: sauDung(xs[j], xs[j] + t), z0: zD0, z1: zD1, big: j === n ? 1 : 0, vi_tri: j, thung: thungCua[Math.min(j, n - 1)] });
        if (j > 0) vR[j - 1] = p;
        if (j < n) vL[j] = p;
      }
      // (bản 1.31) phủ hồi: MỖI THÙNG một tấm đáy + một tấm nóc chạy từ mặt ngoài hồi trái tới mặt ngoài hồi phải (khoang = khoang đầu, den_khoang = khoang cuối)
      const dayT = [], nocT = [];
      if (phuHoi) for (const q of M.info.thung) {
        const a = q.khoang[0], z = q.khoang[1], x0 = vL[a].x0, x1 = vR[z].x1;
        dayT.push(khauNgang(P({ loai: 'DAY', ten: NM.day, than: b.code, tu: b.tu, type: 0, x0, x1, y0: 0, y1: Dc, z0: b.zb - t, z1: b.zb, big: 1, khoang: a, den_khoang: z })));
        nocT.push(khauNgang(P({ loai: 'NOC', ten: NM.noc, than: b.code, tu: b.tu, type: 0, x0, x1, y0: 0, y1: Dc, z0: b.zt, z1: b.z1, big: 0, khoang: a, den_khoang: z })));
      }
      for (let i = 0; i < n; i++) {
        const bx = bayX(i), c = widths[i];
        const day = phuHoi ? dayT[thungCua[i]] : khauNgang(P({ loai: 'DAY', ten: NM.day, than: b.code, tu: b.tu, type: 0, x0: bx, x1: bx + c, y0: 0, y1: Dc, z0: b.zb - t, z1: b.zb, big: 1, khoang: i }));
        const noc = phuHoi ? nocT[thungCua[i]] : khauNgang(P({ loai: 'NOC', ten: NM.noc, than: b.code, tu: b.tu, type: 0, x0: bx, x1: bx + c, y0: 0, y1: Dc, z0: b.zt, z1: b.z1, big: 0, khoang: i }));
        if (phu) continue;
        // hậu dày lọt lòng / hậu soi rãnh: mỗi khoang 1 tấm
        const hau = P({ loai: 'HAU', ten: NM.hau, than: b.code, tu: b.tu, type: 2, x0: bx - gS, x1: bx + c + gS, y0: yb0, y1: yb1, z0: b.zb - gS, z1: b.zt + gS,
          big: 1, fd: false, bd: thin ? false : true, khoan: thin ? KHONG_KHOAN : KT, khoang: i, mong: thin });
        if (thin) {
          // rãnh trên 2 tấm đứng hai bên, đáy (mặt trên), nóc (mặt dưới) — toạ độ riêng của từng tấm
          const zg0 = hau.z0, zg1 = hau.z1;
          const L = vL[i], R = vR[i];
          // (1.31.1) rãnh trên tấm đứng nằm GỌN trong tấm: phủ hồi thì hồi / vách đứng trên đáy, hậu ăn xuống rãnh đáy chứ không xuống hồi
          const rd = (T, a, b) => { const v0 = Math.max(a, T.z0), v1 = Math.min(b, T.z1); return { v: rn(v0 - T.z0), h: rn(v1 - v0) }; };
          { const q = rd(L, zg0, zg1); L.holes.push({ kieu: 'ranh', u: yb0, v: q.v, w: grooveW, h: q.h, z: t - gS, sau: gS }); }      // mặt x lớn của tấm trái
          { const q = rd(R, zg0, zg1); R.holes.push({ kieu: 'ranh', u: yb0, v: q.v, w: grooveW, h: q.h, z: 0, sau: gS }); }          // mặt x nhỏ của tấm phải
          if (phuHoi) {
            // đáy / nóc liền thùng: rãnh phủ cả 2 góc hậu ăn vào (bx − gS … bx + c + gS); tấm nằm trong Chenfeng có trục v tính từ mép PHẢI (v = x1 − x, đã đo — xem dinhKhoet)
            const a = rn(bx - gS), b = rn(bx + c + gS);
            day.holes.push({ kieu: 'ranh', u: yb0, v: rn(day.x1 - b), w: grooveW, h: rn(b - a), z: t - gS, sau: gS });      // mặt trên đáy
            noc.holes.push({ kieu: 'ranh', u: yb0, v: rn(noc.x1 - b), w: grooveW, h: rn(b - a), z: 0, sau: gS });           // mặt dưới nóc
          } else {
            day.holes.push({ kieu: 'ranh', u: yb0, v: 0, w: grooveW, h: c, z: t - gS, sau: gS });                    // mặt trên đáy
            noc.holes.push({ kieu: 'ranh', u: yb0, v: 0, w: grooveW, h: c, z: 0, sau: gS });                         // mặt dưới nóc
          }
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
        P({ loai: 'CHAN', ten: NM.chan, than: lower.code, tu: lower.tu, type: 2, x0: J[k], x1: J[k + 1], y0: -tc, y1: 0, z0: 0, z1: chan, big: 1, lines: 1, ...(phuHoi ? { khoan: KHONG_KHOAN, vit_de: true } : {}) });      // (bản 1.31) phủ hồi: chân trước áp mặt vào đế trước — bắt vít từ sau, không khoan cam
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
    const doorCols = [], daBaoBL = new Set();      // {khoang, x, w, open}; daBaoBL: (1.31.1) cảnh báo bản lề — mỗi khoang / cỡ cánh một lần
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
    // Suốt treo ở khoang dính vùng khấu cột (bản 1.23 — cột nằm TRONG khoang): hộp che cột chỉ chiếm phần SAU của một đoạn khoang. Thanh suốt nằm giữa chiều sâu khoang; nếu nó
    // (kể cả bas đỡ, hở SUOT_HO) đi lọt TRƯỚC mặt hộp che cột thì suốt vẫn đặt như khoang thường — hai đầu bắt vào tấm đứng hai bên khoang (tấm bị khấu vẫn sâu tới mặt hộp).
    // Không lọt thì suốt lùi ra phần nông trước cột như trước (kiemSX cảnh báo khoang treo nông).
    const SUOT_HO = 30, sauDay = shelfDepth, daNhacCot = new Set();
    const cotChe = i => { const a = bayX(i), b2 = a + widths[i]; let che = 0; for (const K of KH) if (!kNgoai(K, a, b2)) che += Math.max(0, Math.min(b2, K.xb + K.eB) - Math.max(a, K.xa - K.eA)); return rn(che); };
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
        const lot = shelfDepth < sauDay - TOL && sauDay / 2 + SUOT_HO <= shelfDepth + TOL;      // khoang dính cột mà thanh suốt đi lọt trước hộp che cột
        M.templates.push({ loai: 'SUOT', id: s.suot.mau_id, ten: s.suot.ten_mau, tu: c.b.tu, khoang: i,
          box: [rn(widths[i]), rn(lot ? sauDay : shelfDepth), rn(cao)], pos: [bayX(i), 0, rn(za)], params: { BH: t, JS: s.suot.cach_dot, YGKC: 0 } });
        if (lot && !daNhacCot.has(i)) { daNhacCot.add(i); const che = cotChe(i); if (che >= 100) warn(`Khoang ${i + 1}: hộp che cột chiếm ${g(che)} trong ${g(widths[i])} bề ngang ở phía sau — đoạn suốt treo nằm trước cột không treo được móc áo ngang (còn ${g(rn(widths[i] - che))} treo được).`, 'suot'); }
        continue;
      }
      if (c.kieu === 'nk_am') {
        // (bản 1.31) khung mặt: thanh ngang `ray` phẳng mặt ngăn kéo thay cho khe trên / khe giữa; mặt cách thanh `khe_ben`
        const khung = !!nk.khung_mat && nk.ray > 0, R = nk.ray, gk = nk.khe_ben;
        const kTren = khung ? R + gk : nk.khe_tren, kGiua = khung ? R + 2 * gk : nk.khe_giua;
        const tongMat = cao - kTren - nk.khe_duoi - kGiua * (m - 1);
        const mat = Math.floor(tongMat / m * 2 + 1e-9) / 2, duMat = rn(tongMat - mat * m);      // mặt chẵn 0,5 mm; phần dư dồn vào khe trên cùng
        if (mat < 60) { err(`${viTri}: mặt ngăn kéo chỉ cao ${g(mat)} — giảm số ngăn hoặc nới ô.`); continue; }
        if (hopCao(lo, mat) < 40) { err(`${viTri}: mặt ngăn kéo cao ${g(mat)} thì hộp ngăn kéo chỉ còn ${g(hopCao(lo, mat))} (loại "${lo.ten}") — giảm số ngăn hoặc nới ô.`); continue; }
        if (mat > 450) warn(`${viTri}: mặt ngăn kéo cao ${g(mat)} (> 450) — nên thêm ngăn hoặc hạ đợt phía trên.`);
        const sauNK = Math.floor((shelfDepth - nk.lui - nk.ho_sau) / nk.buoc_sau + 1e-9) * nk.buoc_sau;
        if (sauNK < 200) { const viCot = shelfDepth < yb0 - TOL; if (viCot && M.info.nk_vuong_cot.indexOf(i) < 0) M.info.nk_vuong_cot.push(i); err(`${viTri}: thùng quá nông cho ngăn kéo (sâu hộp ${g(sauNK)})${viCot ? ` — khoang này có cột phía sau, thùng trước cột chỉ sâu ${g(shelfDepth)}: chuyển ngăn kéo sang khoang khác` : ''}.`); continue; }
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
        // có nẹp che (bản 1.28): vách đệm bắt đầu ngay sau lưng nẹp — nẹp che kín cạnh trước của nó
        const coNep = !!nk.nep_khe && dem > 0, yDem = coNep ? nk.lui : nk.lui - t;
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
          M.mat_ngan_keo.push({ khoang: i, x: rn(x0 + nk.khe_ben), z: rn(z + duoi), w: rn(L - 2 * nk.khe_ben), h: rn(mat), y: rn(nk.lui - t), t, trum: false });
          M.templates.push({ loai: 'NGAN_KEO', kieu: 'nk_am', id: lo.mau_id, ten: lo.ten_mau, ma_loai: lo.ma, ten_loai: lo.ten, tu: c.b.tu, than: c.than, khoang: i, o: [rn(za), rn(zb)], mat: M.mat_ngan_keo.length - 1,
            bac_sau: { tu: rn(shelfDepth - nk.lui - nk.ho_sau), buoc: nk.buoc_sau },      // sâu hộp = floor(tu / buoc) × buoc — nhảy bậc theo cỡ ray
            box: [L, sauNK, rn(h)], pos: [x0, nk.lui, rn(z)],     // gốc mẫu = lưng mặt ngăn kéo; mặt NK dày BH nằm phía trước gốc (y = lùi − BH … lùi), hộp từ y = lùi
            params: thamSo(lo, t, mat, { SYS: -tren, XYS: -duoi, ZYS: -nk.khe_ben, YYS: -nk.khe_ben }) });
          z += h;
        }
        // Xà ngăn kéo: ván đứng nằm ngay SAU lưng mặt ngăn kéo, che khe phía trên mỗi mặt (khe luồn tay của mặt vát) và giằng 2 vách đệm lại.
        // Xà phải nằm lọt trong khoảng trống giữa 2 hộp ngăn kéo: hộp thấp hơn mép trên mặt SLK, cao hơn mép dưới mặt XLK (mẫu không khai thì coi như 0).
        if (khung) {
          // thanh ngang khung mặt: giữa 2 mặt kề nhau (lọt giữa 2 nẹp / vách đệm) + thanh trên sát mặt dưới đợt (có nẹp thì chạy suốt bề ngang khoang, nẹp dừng dưới nó)
          // thanh giữa: CẢ HAI đầu tì vào cạnh nẹp (nẹp bắn đinh, không khoan) → keo + đinh như nẹp. Đầu nào tì vào vách đệm / hồi / vách thì khoan cam như ván thùng —
          // nhưng mối nối chỉ dài bằng bề cao thanh: dưới 60 thì không khoan cam được (trang giả lập theo quy tắc khoảng của Chenfeng: mối nối < 60 không khoan — CHƯA ĐO trên bản thật)
          // → bắt vít / chốt gỗ, ghi rõ trong bảng kê. (1.31.1: trước xét cờ chung nep_khe nên khoang không cánh / 1 cánh cũng ghi oan "giữa 2 nẹp, keo + đinh")
          const haiNep = coNep && demL > 0 && demR > 0, ngan = R < 60;
          for (let q = 0; q + 1 < m; q++) { const z0 = rn(matZ[q][1] + gk); P({ loai: 'XA', ten: NM.xa, than: c.than, tu: c.b.tu, type: 2, x0, x1: x0 + L, y0: rn(nk.lui - t), y1: nk.lui, z0, z1: rn(z0 + R), big: 0, khoang: i, khung_mat: true, ...(haiNep ? { khoan: KHONG_KHOAN, fd: false, bd: false, keo_nep: true } : ngan ? { khoan: KHONG_KHOAN, vit_ray: true } : {}) }); }
          const xa = coNep ? bayX(i) : x0, xb = coNep ? rn(bayX(i) + widths[i]) : rn(x0 + L);
          P({ loai: 'XA', ten: NM.xa, than: c.than, tu: c.b.tu, type: 2, x0: xa, x1: xb, y0: rn(nk.lui - t), y1: nk.lui, z0: rn(zb - R), z1: zb, big: 0, khoang: i, tren: true, khung_mat: true });
        } else if (nk.xa_cao > 0) {
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
        // Nẹp che khe: ván đứng ngang mặt ngăn kéo, che từ hồi/vách tới mép trong vách đệm — bịt khe bản lề VÀ cạnh trước vách đệm (hẹp nên bắn đinh, không khoan cam).
        if (coNep) {
          const nep = (xa, xb) => P({ loai: 'NEP', ten: NM.nep, than: c.than, tu: c.b.tu, type: 2, x0: xa, x1: xb, y0: nk.lui - t, y1: nk.lui, z0: za, z1: khung ? rn(zb - R) : zb, big: 0, fd: false, bd: false, khoan: KHONG_KHOAN, khoang: i });
          if (demL) nep(bayX(i), x0);
          if (demR) nep(x0 + L, bayX(i) + widths[i]);
          // (bản 1.30.1 — anh Thanh 08/10/2026: "vùng hộc thụt vào 5 cm sẽ không bị ảnh hưởng gì cả") vùng hộc kéo âm có vách đệm không cấn bản lề → không dời bản lề, không ghi chú
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
      if (sauNK < 200) { const viCot = shelfDepth < yb0 - TOL; if (viCot && M.info.nk_vuong_cot.indexOf(i) < 0) M.info.nk_vuong_cot.push(i); err(`${viTri}: thùng quá nông cho ngăn kéo (sâu hộp ${g(sauNK)})${viCot ? ` — khoang này có cột phía sau, thùng trước cột chỉ sâu ${g(shelfDepth)}: chuyển ngăn kéo sang khoang khác` : ''}.`); continue; }
      const [fx0, fx1] = vungMat(i);
      if (fx1 - fx0 > 1200) { warn(`${viTri}: mặt ngăn kéo rộng ${g(fx1 - fx0)} (> 1200) — nên chia khoang nhỏ hơn.`); nkRongDaBao.add(i); }
      vungTrum.push({ khoang: i, b: c.b, f0, f1 });
      for (let q = 0, zq = f0; q < m; q++) {
        const fz0 = zq, fz1 = rn(fz0 + caoMat(q)); zq = rn(fz1 + khe);
        const bz0 = q === 0 ? za : rn(fz0 - khe / 2), bz1 = q === m - 1 ? zb : rn(fz1 + khe / 2);     // khe hộp: chia ô theo tim khe giữa 2 mặt
        M.mat_ngan_keo.push({ khoang: i, x: fx0, z: fz0, w: rn(fx1 - fx0), h: rn(fz1 - fz0), y: -tc, t: tc, trum: true });
        M.templates.push({ loai: 'NGAN_KEO', kieu: 'nk_trum', id: lo.mau_id, ten: lo.ten_mau, ma_loai: lo.ma, ten_loai: lo.ten, tu: c.b.tu, than: c.than, khoang: i, o: [rn(za), rn(zb)], mat: M.mat_ngan_keo.length - 1,
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
            { // (bản 1.30) bản lề: số + vị trí cho MỌI cánh (vẽ trên hình, kê trong bảng); khoét chén chỉ khi bật chen_ban_le
              const ch = s.canh.chen, hh = z1 - z0, r = ch.d / 2, benTrai = dc.open !== 2;      // cánh mở trái = bản lề bên trái
              const tranh = [];
              // tấm nằm chạy tới hồi / vách (đợt cố định; 1.31.1: cả đáy, nóc — cánh thấp) → đế bản lề (chữ thập, cao ~40–50) bắt trên hồi / vách cấn nó: tâm bản lề cách mặt tấm ít nhất DE_BL / 2
              for (const d of M.parts) if ((d.loai === 'DOT' || d.loai === 'DAY' || d.loai === 'NOC') && d.khoang <= dc.khoang && dc.khoang <= (d.den_khoang === undefined ? d.khoang : d.den_khoang) && d.z1 > z0 - DE_BL && d.z0 < z1 + DE_BL) tranh.push([rn(d.z0 - z0 - (DE_BL / 2 - r)), rn(d.z1 - z0 + (DE_BL / 2 - r))]);
              const bl = banLeCanh(hh, dc.w, { cach_dau: ch.cach_dau, r, tranh });
              p.ban_le = { so: bl.so, z: bl.z, ben: benTrai ? 'trai' : 'phai', loai: s.canh.loai_ban_le };
              if (bl.ket) { const kb = dc.khoang + '|' + rn(hh); if (!daBaoBL.has(kb)) { daBaoBL.add(kb); warn(bl.vung ? `Cánh khoang ${dc.khoang + 1} cao ${g(hh)}: không đủ chỗ đặt ${bl.so} bản lề tránh đợt / nóc / đáy (đế bản lề cấn tấm nằm) — xem lại vị trí bản lề trên hình.` : `Cánh khoang ${dc.khoang + 1} cao ${g(hh)}: quá thấp cho ${bl.so} bản lề — xem lại vị trí bản lề trên hình.`); } }
              if (s.canh.chen_ban_le) { const u = benTrai ? ch.tam_mep : dc.w - ch.tam_mep; for (const v of bl.z) p.holes.push({ kieu: 'tron', u, v, r, z: 0, sau: ch.sau }); }
            }
          }
        }
      }
    }
    { const lb = LOAI_BAN_LE.find(l => l.ma === s.canh.loai_ban_le); if (lb && lb.ma !== 'tu_chon' && doorCols.length && (tc < lb.day[0] - TOL || tc > lb.day[1] + TOL)) warn(`Cánh dày ${g(tc)} nằm ngoài khoảng dày cánh của bản lề ${lb.ten} (${g(lb.day[0])}–${g(lb.day[1])}).`); }
    for (const dc of doorCols) {
      if (dc.w > 600 && !dc._w) { dc._w = 1; warn(`Cánh rộng ${g(dc.w)} (> 600) ở khoang ${dc.khoang + 1}: dễ xệ, nên chia 2 cánh.`); }
      if (dc.w < 150 && !dc._n) { dc._n = 1; warn(`Cánh chỉ rộng ${g(dc.w)} ở khoang ${dc.khoang + 1}.`); }
    }
    M.info.canh = { rong: [...new Set(doorCols.map(d => rn(d.w)))], cao: [...caoCanh].sort((a, b) => b - a), so: M.parts.filter(p => p.loai === 'CANH').length, ban_le: M.parts.filter(p => p.loai === 'CANH' && p.ban_le).reduce((n, p) => n + p.ban_le.so, 0) };

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

  const THUNG = ['HOI', 'VACH', 'DAY', 'NOC', 'DOT', 'DEM', 'XA', 'HAU', 'DE'];      // tấm của thùng: lơ lửng là lỗi dựng, không phải chuyện xưởng tự xử lý

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
        if (ap(q, p, 2) > 0 || ap(p, q, 2) > 0) { if (q.x0 <= p.x0 + TOL && q.x1 > p.x0 + TOL) trai = true; if (q.x1 >= p.x1 - TOL && q.x0 < p.x1 - TOL) phai = true; }
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
  function nhomThuMuc(ten) {
    const t = String(ten == null ? '' : ten).toLowerCase();
    if (/phụ kiện|bản lề|tay nắm|tay co|ray|ke |^ke$|chân|đèn|led|kho[áa]|suốt|pát|bát|móc|rổ|giá treo|vít|nẹp|gioăng|giảm chấn|nâng|五金|铰链|拉手|滑轨|导轨|脚|灯|锁|挂衣|衣杆|配件|拉篮|hardware|hinge|handle|rail/.test(t)) return 'pk';
    if (/tủ|cánh|ngăn kéo|hộc|kệ|giường|bàn|vách|lavabo|thùng|柜|门|抽屉|床|桌|架|cabinet|door|drawer/.test(t)) return 'tu';
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
    const M = build(s), buoc = [], loi = [], nk = [];
    if (M.errors.length) return { M, spec: s, buoc, loi: M.errors.slice(), chua: [], nk };
    if (s.hau.kieu !== 'phu') loi.push('hậu không phải kiểu phủ sau');
    if ((M.info.khau || []).length) loi.push('tủ có khấu cột');
    if (s.thung.noc_day === 'phu_hoi') loi.push('nóc, đáy phủ hồi — lệnh nóc / đáy của Chenfeng chưa đo kiểu bọc hồi');
    if (s.canh.chen_ban_le && M.parts.some(p => p.loai === 'CANH' && p.holes && p.holes.length)) loi.push('khoét chén bản lề — lệnh cánh của Chenfeng không nhận lỗ chén của bảng');      // (1.31.1) cánh lệnh gốc không mang lỗ → vẽ bằng nhập tấm
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
  function tempNganKeo(banGhi, hang, ts) {
    const id = banGhi ? Math.round(+banGhi.module_id) || 0 : 0;
    if (!id || !Array.isArray(hang) || !hang.length) return null;
    const props = [];
    for (const r of hang) {
      if (!Array.isArray(r) || r[0] !== 3 || typeof r[1] !== 'string' || r[6] !== 1) return null;
      const p = { name: r[1], value: r[3], description: r[5], expr: r[2] || '', isLock: false, type: 1, option: [], isOptionOnly: false, minCompareType: '>=', maxCompareType: '<=', defaultDir: '', defaultDirId: '',
        min: r[7] === undefined ? null : r[7], max: r[8] === undefined ? null : r[8] };
      // ghi đè = ghi cả BIỂU THỨC: đo trên Chenfeng thật 05/10/2026, lệnh DRAWER áp `expr` của từng tham số chứ không áp `value` (để biểu thức rỗng thì Chenfeng vẫn dùng số mặc định của mẫu)
      if (ts && typeof ts[p.name] === 'number' && (p.expr === '' || !isNaN(Number(p.expr)))) { p.value = ts[p.name]; p.expr = String(Math.round(ts[p.name] * 1000) / 1000); }
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
  function mauCF(M) {
    return M.templates.filter(tp => tp.id).map(tp => ({ tp, json: templateToCF(tp, M.spec), mat: (tp.mat >= 0 && M.mat_ngan_keo[tp.mat]) || null }));
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
      const key = [nhom, p.tu, p.ten, c.dai, c.rong, c.day, p.khoan, p.holes && p.holes.length ? 'x' : '', kh, bl, p.keo_nep ? 'kn' : p.vit_ray ? 'vr' : p.vit_de ? 'vd' : ''].join('|');      // (1.31.1) cùng cỡ mà cách bắt khác thì dòng riêng
      const r = rows.get(key) || { nhom, tu: p.tu, ten: p.ten, dai: c.dai, rong: c.rong, day: c.day, sl: 0, m2: 0, khoan: p.khoan === KHONG_KHOAN ? 'không khoan' : p.khoan,
        ghi_chu: kh || (p.phu ? 'ốp sau lưng thùng, bắn đinh' : p.vit_de ? 'áp mặt trước đế trước, bắt vít từ sau' : p.keo_nep ? 'thanh ngang khung mặt giữa 2 nẹp, keo + đinh' : p.vit_ray ? 'thanh ngang khung mặt — bắt vít / chốt gỗ vào hồi, vách (mối nối ngắn hơn 60, không khoan cam)' : p.van_thung ? 'tấm trước mặt cột — ván thùng, lọt giữa 2 tấm đứng hai bên cột' : p.khau_cot ? 'vách đứng dọc mặt bên cột' : p.holes && p.holes.length ? (p.holes[0].kieu === 'tron' ? (bl ? bl + ', khoét chén' : 'khoét chén bản lề') : 'soi rãnh hậu') : bl) };
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
    { // (bản 1.30) bản lề: tổng số theo loại đang chọn ở Chuẩn xưởng
      const n = sum(M.parts.filter(p => p.ban_le).map(p => p.ban_le.so)), lb = LOAI_BAN_LE.find(l => l.ma === M.spec.canh.loai_ban_le), ch = M.spec.canh.chen;
      if (n) phu_kien.push({ ten: `Bản lề ${lb && lb.ma !== 'tu_chon' ? lb.ten : 'chén Ø' + g(ch.d)}`, sl: n, ghi_chu: `chén Ø${g(ch.d)} sâu ${g(ch.sau)}, tâm chén cách mép cánh ${g(ch.tam_mep)}; ${M.parts.filter(p => p.ban_le).length} cánh` });
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
  const MAU = { DE: '#e6b0a7', HOI: '#dd9a90', VACH: '#e6b0a7', DEM: '#e6b0a7', XA: '#8fbf86', NEP: '#8fbf86', DAY: '#e6d25e', NOC: '#e6d25e', DOT: '#f0e390', HAU: '#eef3ec', CHAN: '#7fb87a', PHAO: '#93c78d', PHU: '#f0e390', CANH: '#4d9a57' };
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
    const order = ['HAU', 'PHU', 'DE', 'DOT', 'DAY', 'NOC', 'DEM', 'NEP', 'HOI', 'VACH', 'CHAN', 'PHAO'];
    for (const loai of order) for (const p of M.parts) if (p.loai === loai) {
      if (loai === 'PHU' && p.type !== 0) continue;
      o += R(p, `fill="${MAU[loai]}" stroke="#39424a" stroke-width="${f(fs / 9)}"${loai === 'HAU' ? ' stroke-opacity=".25"' : ''}`);
    }
    for (const q of M.mat_ngan_keo) if (!q.trum) {
      o += `<rect x="${f(q.x)}" y="${f(Y(q.z + q.h))}" width="${f(q.w)}" height="${f(q.h)}" fill="#d9eed5" stroke="#2d6b38" stroke-width="${f(fs / 7)}"/>`;
      o += `<text x="${f(q.x + q.w / 2)}" y="${f(Y(q.z + q.h / 2) + fs * 0.35)}" font-size="${f(fs)}" text-anchor="middle" fill="#1f4d29">ngăn kéo ${g(q.w)}×${g(q.h)}</text>`;
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
      // PHÀO (bản 1.28 — anh Thanh 06/10/2026: "chọn trên ảnh thêm phào sửa phào luôn cho nhanh"): bấm vào phào để sửa / bỏ; mép nào chưa có phào thì có dải "+ phào" nét đứt ngay ngoài mép đó
      const TEN_PHAO = { trai: 'trái', phai: 'phải', tren: 'trên' };
      for (const ben of ['trai', 'phai', 'tren']) {
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
      for (const b of khoiTam(p)) them(b, MAU[p.loai] || '#ccc', p.loai === 'CANH' ? 0.45 : p.loai === 'HAU' ? 0.9 : 1, attr);
    }
    for (const q of M.mat_ngan_keo || []) {
      if (q.trum && !opts.canh) { /* mặt trùm nằm ở mặt phẳng cánh: vẫn vẽ như hình đứng */ }
      const y0 = q.y != null ? q.y : (q.trum ? -(q.t || 18) : 0);
      them([q.x, y0, q.z, q.x + q.w, y0 + (q.t || 18), q.z + q.h], q.trum ? MAU.CHAN : '#d9eed5', 1, '');
    }
    for (const tp of M.templates || []) if (tp.loai === 'SUOT') {
      const z = tp.pos[2] + tp.box[2] - s.suot.cach_dot - 15, yc = tp.pos[1] + tp.box[1] / 2;
      them([tp.pos[0] + 8, yc - 8, z - 8, tp.pos[0] + tp.box[0] - 8, yc + 8, z + 8], '#59616b', 1, '');
    }
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
          const A = hop[i];
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
    const hau = s.hau.kieu === 'phu' ? `hậu ${g(s.hau.t)} phủ sau lưng thùng, bắn đinh (hồi sâu ${g(s.sau_thung - s.hau.t)} + hậu ${g(s.hau.t)})` : s.hau.kieu === 'mong' ? `hậu mỏng soi rãnh ${g(s.hau.t)}` : `hậu dày lọt lòng ${g(s.hau.t)}`;
    L.push(`${s.ten} — phủ bì ${g(s.rong)} × ${g(s.cao)}, thùng sâu ${g(s.sau_thung)}, ván ${g(s.van.t)}, ${hau}.`);
    if (M.info.than) L.push(`Thân: ${M.info.than.map(b => `${b.tu} cao ${g(b.z1 - b.z0)}`).join(' + ')}${s.phao.tren ? ` + phào trên ${g(s.phao.tren)}` : ''}.`);
    if (M.info.khoang) L.push(`Khoang lọt lòng: ${M.info.khoang.map(g).join(' / ')}.`);
    if (M.info.thung && M.info.thung.length > 1) L.push(`Thùng: ${M.info.thung.length} thùng rời — ${M.info.thung.map(q => `${g(q.rong)} (${q.khoang[1] - q.khoang[0] + 1} khoang)`).join(' + ')}, ghép cạnh nhau trong khung phào chung.`);
    if (M.info.canh && M.info.canh.so) L.push(`Cánh: ${M.info.canh.so} tấm, rộng ${M.info.canh.rong.map(g).join(' / ')}, cao ${M.info.canh.cao.map(g).join(' / ')}${M.info.canh.ban_le ? `, ${M.info.canh.ban_le} bản lề` : ''}.`);
    const matNK = a => [...new Set(a.map(q => `${g(q.w)}×${g(q.h)}`))].join(', ');
    const am = M.mat_ngan_keo.filter(q => !q.trum), tr = M.mat_ngan_keo.filter(q => q.trum);
    if (am.length || tr.length) {
      const dem = {}; for (const x of M.templates) if (x.loai === 'NGAN_KEO') dem[x.ten_loai] = (dem[x.ten_loai] || 0) + 1;
      L.push(`Ngăn kéo: ${[am.length ? `${am.length} âm (mặt ${matNK(am)})` : '', tr.length ? `${tr.length} trùm ngoài (mặt ${matNK(tr)})` : ''].filter(Boolean).join(', ')} — ${Object.keys(dem).map(k => `${k} ×${dem[k]}`).join(', ')}.`);
      const nXa = M.parts.filter(p => p.loai === 'XA' && !p.khung_mat).length, nKm = M.parts.filter(p => p.loai === 'XA' && p.khung_mat).length, nNep = M.parts.filter(p => p.loai === 'NEP').length;
      if (nXa || nKm || nNep) L.push(`Hộc ngăn kéo âm: ${[nKm ? `${nKm} thanh ngang khung mặt (phẳng mặt ngăn kéo)` : '', nXa ? `${nXa} xà sau khe mặt` : '', nNep ? `${nNep} nẹp che khe hai bên` : ''].filter(Boolean).join(', ')}.`);
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
    const giong = m => !m.errors.length && m.parts.length === M0.parts.length && m.templates.length === M0.templates.length && m.parts.every((p, i) => p.loai === M0.parts[i].loai && p.type === M0.parts[i].type && (p.khau || []).length === (M0.parts[i].khau || []).length) && m.templates.every((t, i) => t.id === M0.templates[i].id);
    // đổi kích thước không được làm đổi cách tách thùng → giữ nguyên chỗ tách của tủ gốc
    const dung = (khoa, d) => { const s1 = clone(s0); s1[khoa] = s0[khoa] + d; s1.thung = Object.assign({}, s1.thung, { tach: M0.info.tach || [] }); const m = build(s1); return giong(m) ? m : null; };
    // (bản 1.26.1) Tủ có cột GIỮA không co giãn theo Rộng bằng module: cột khai theo khoảng cách tới mép TRÁI tủ nên đứng yên, còn khoang thì chia lại — vách khấu / hậu khấu
    // lúc bám vách khoang (giữ cách vách ≥ 30, vách lọt vùng cột thì nông lại), lúc bám mép cột → từng đoạn một quy tắc, không bộ hệ số tuyến tính nào đúng cả hai chiều.
    // Đo trên Chenfeng thật 05/10/2026 (tủ 3000, cột cách 1000 rộng 300): gõ L 3000 → 2900 ở ô Thông số thì vách khấu còn cách vách khoang 2,09 (thiết kế cần 30); thu thêm nữa là hai tấm đè nhau.
    // Xét theo cột KHAI trong thông số (kể cả cột dính hồi được khấu như cột góc): nó vẫn neo theo mép trái. Cột góc trái / phải thì bám hồi của nó — co giãn đúng. Sâu / Cao không dính.
    const cotGiua = !!(s0.khau && Array.isArray(s0.khau.giua) && s0.khau.giua.length);
    [['L', 'rong', 0], ['W', 'sau_thung', 1], ['H', 'cao', 2]].forEach(([ten, khoa, truc]) => {
      if (ten === 'L' && cotGiua) { out.ly_do[ten] = 'cot_giua'; return; }
      let M1 = null, d = 0;
      for (const thu of [120, -120, 60, -60]) { M1 = dung(khoa, thu); if (M1) { d = thu; break; } }
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

  return { VERSION, DEFAULT_SPEC, LOAI_BAN_LE, banLeCanh, vuaKhoVan, KHONG_KHOAN, KHOA_TU, nhanTu, maTuCuaGhiChu, NHOM, MAU_CHU_GIAI, MAU_TU, apMau, heSo, specDaVe, normalize, build, toChenfeng, mauCF, cutList, cutListCSV, elevationSVG, summary, expectedBoxes, bbox, cutSize, overlap, parseDot, parseTS, tsText, merge, nangCap, KIEU_HAU, vachTheoCot, dinhKhoet, keHoachGoc, lcNganKeo, tempNganKeo, bieuThucTT, khoangMong, MUC_KIEM, phieu, kiemLienKet, kiemVaCham, kiemLoGiao, kiemLoLech, kiemMoiNoi, MUC_VE, doLoiThat, nhomMau, locMau, danhGiaMang, tomTatGoi, nhomThuMuc, hinh3D, benPhao };
});
