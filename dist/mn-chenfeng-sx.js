/* Một Nhà · Trợ lý trang sản xuất Chenfeng — v1.36.4 */
;(function(){
var __MNCF_SX_PB__ = "1.36.4";
/*
 * Một Nhà · TRỢ LÝ TRANG SẢN XUẤT (bản 1.22 — anh Jason 04/10/2026 14:14: "làm cả 2").
 * Chạy ở tab "晨丰生产管理系统" (sc.leye.site/#/cadSingleAdd…) mà lệnh tách đơn CD của Chenfeng mở ra sau khi bấm 打开. Ba việc, đều dựa trên số đo trang thật 04/10/2026:
 *   1. BÁO TRẠNG THÁI lúc trang còn trắng: chờ dữ liệu tấm từ khung nhỏ → máy chủ Chenfeng đang tính (≈ 4 giây + 0,05 giây / tấm, có lúc gấp 2–3) → đang mở bảng tối ưu.
 *      Tab bị F5 thì không còn dữ liệu (dữ liệu chỉ được trao một lần lúc bấm 打开) — báo đóng tab, xuất lại.
 *   2. CỨU TRANG TRẮNG: thành phần Invoker của trang chỉ đẩy nội dung sang khung /modules/cut-block một lần lúc khung tải xong; nếu lúc đó khung chưa kịp
 *      gọi initFinish (modContext còn trống) thì lần đẩy bị nuốt và trang trắng mãi. Thấy đúng tình trạng đó (loaded + modContext có rồi mà khung vẫn rỗng)
 *      thì gọi lại chính hàm invokeUpdate() của trang — việc mà trang lẽ ra tự làm.
 *   3. TỰ TỐI ƯU: hộp 优化进度 hiện → bấm 开始优化 → đọc cột 大板 (số tờ) → khi MỌI vật liệu đã có kết quả và số tờ đứng yên đủ lâu thì bấm 停止优化
 *      (thanh tiến độ của trang không bao giờ tự dừng; chạy 3 giây hay 81 giây đều ra cùng số tờ) → bấm 确认新优化 → sơ đồ cắt hiện.
 *      Chỉ làm MỘT lần mỗi trang; người dùng đụng vào hộp hoặc bấm "Để tôi tự làm" thì thôi ngay.
 * KHÔNG bấm nút nào khác (保存优化, 导出NC, 一键NC, 打印标签, 取消优化…), không gửi gì đi đâu, không đọc phiên đăng nhập, không đụng XHR của trang.
 *   4. TIẾNG VIỆT (bản 1.36.4 — anh Thanh 16/10/2026: "cho trợ lý chuyển các nút thành tiếng việt được không cho dễ làm"): nút / nhãn của trang hiện chữ Việt.
 *      CHỈ HIỂN THỊ: không sửa text node nào của trang (Vue dựng lại / so chữ của chính nó sẽ hỏng) — phần tử chứa chữ mang data-mncf-vi, CSS thu chữ gốc về cỡ 0
 *      và hiện chữ Việt bằng ::after; title = chữ gốc. innerText vẫn là chữ gốc → trang và trợ lý vẫn dò nút theo chữ gốc (开始优化…). Xem phần "Tiếng Việt" bên dưới.
 * Lựa chọn bật / tắt (tự tối ưu, Tiếng Việt) nhớ ở localStorage "mncf.sx.v1" của trang sản xuất.
 */
(function (root) {
  'use strict';
  if (root.MNCF_SX) return;
  var doc = root.document;
  try { if (!doc || root.top !== root) return; } catch (e) { return; }      // khung con — kể cả khung nhỏ "Order Splitting" nằm trong trang CAD (cũng là sc.leye.site): không chạy
  var VERSION = typeof __MNCF_SX_PB__ === 'string' ? __MNCF_SX_PB__ : 'thử';      // build.js chèn số phiên bản vào bản gộp
  var LS = 'mncf.sx.v1';
  // ngưỡng (ms). nhip: nhịp dò; han_dl: chờ dữ liệu tấm; han_bang: sau khi máy chủ trả sơ đồ mà bảng tối ưu vẫn chưa hiện; cho_cuu: khung rỗng bao lâu thì gọi lại;
  // cuu_cach: giãn cách giữa hai lần gọi lại (tối đa cuu_toi_da lần); dem: đếm trước khi bấm 开始优化; on_dinh_*: số tờ đứng yên bao lâu thì dừng;
  // han_chay: chạy bao lâu mà chưa đủ kết quả thì để người dùng tự xử lý; bam_lai: bấm mà trang chưa chạy thì bấm lại; thu_gon: xong bao lâu thì bảng báo tự thu thành viên nhỏ;
  // vi_cach: hai lần gắn chữ Việt cách nhau ít nhất ngần ấy (trang đổi DOM liên tục lúc tối ưu — số tờ nhảy mỗi nhịp)
  var CH = { nhip: 200, han_dl: 15000, han_bang: 25000, cho_cuu: 700, cuu_cach: 1500, cuu_toi_da: 5, dem: 1500, on_dinh_goc: 2500, on_dinh_moi_tam: 10, on_dinh_tran: 12000, han_chay: 120000, bam_lai: 1200, thu_gon: 20000, vi_cach: 300 };
  var now = function () { return Date.now(); };
  var onDinh = function (soTam) { return Math.min(CH.on_dinh_tran, Math.max(CH.on_dinh_goc, CH.on_dinh_goc + CH.on_dinh_moi_tam * (soTam > 0 ? soTam : 0))); };
  var uocTinh = function (soTam) { return Math.round(4 + 0.05 * (soTam > 0 ? soTam : 0)); };      // giây máy chủ Chenfeng tính sơ đồ (GetPlanOrder), đo 38 tấm 4–8 giây, 228 tấm 11–15 giây
  var chuoi = function (el) { try { return String(el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim(); } catch (e) { return ''; } };
  var hienThay = function (el) { try { return !!el && (el.offsetWidth > 0 || el.getClientRects().length > 0); } catch (e) { return false; } };

  var cai = { tu_dong: true, vi: true };
  try { var j = JSON.parse(root.localStorage.getItem(LS) || 'null'); if (j && typeof j === 'object') { if (typeof j.tu_dong === 'boolean') cai.tu_dong = j.tu_dong; if (typeof j.vi === 'boolean') cai.vi = j.vi; } } catch (e) { /* không đọc được thì mặc định bật */ }      // bản lưu cũ chưa có khoá vi: Tiếng Việt bật
  var luuCai = function () { try { root.localStorage.setItem(LS, JSON.stringify(cai)); } catch (e) { /* không lưu được thì thôi */ } };

  // S: trước khi bảng tối ưu hiện.  A: tự tối ưu — 'cho' (chưa thấy hộp) → 'tay' (đang tắt) | 'dem' → 'chay' → 'dung' → 'xac' → 'xong'; 'thoi' = nhường người dùng (A.ly: lý do); da_chay: đã thấy nút 停止优化 sau lần bấm chạy
  var S = { t0: now(), dl: 0, so_tam: 0, pl: 0, pl_ms: 0, pl_loi: false, bao: 0, tb: '', cuu: 0, cuu_luc: 0, rong_tu: 0, dung_tu: 0, an: false, gon: false, khoa: '', chu: '', loai: '', nhat_ky: [] };
  var A = { giai: 'cho', t: 0, t_chay: 0, to: '', t_doi: 0, lan_bam: 0, da_chay: false, nguoi: false, ly: '', bang: null, ket: null, t_xong: 0, nghe: null };

  /* ---- nghe trang (thụ động) ---- */
  var demTam = function (o, sau) { try { if (!o || typeof o !== 'object' || sau > 3) return 0; if (Array.isArray(o.blockList)) return o.blockList.length; for (var k in o) { var v = o[k]; if (v && typeof v === 'object' && !Array.isArray(v)) { var n = demTam(v, sau + 1); if (n) return n; } } } catch (e) { /* bỏ qua */ } return 0; };
  root.addEventListener('message', function (e) {      // khung nhỏ trao dữ liệu tấm: { command: 'webCadData', content: { webCadData: { cadData: { blockList… } } } }
    try { var d = e.data; if (!d || d.command !== 'webCadData' || e.origin !== root.location.origin) return; if (!S.dl) S.dl = now(); var n = demTam(d.content, 0); if (n) S.so_tam = n; } catch (er) { /* bỏ qua */ }
  });
  var xemTaiNguyen = function (en) {
    try {
      var n = String(en.name || '').replace(/[?#].*$/, '');
      if (/\/Cad\/GetPlanOrder$/.test(n)) { if (!S.pl) S.pl = now(); S.pl_ms = Math.round(en.duration || 0); if (en.responseStatus >= 400) S.pl_loi = true; }
      else if (/\/Account\/Reporting$/.test(n)) { if (!S.bao) S.bao = now(); }      // trang tự báo lỗi về máy chủ của nó (đo thật: sau đó trang đứng trắng)
    } catch (e) { /* bỏ qua */ }
  };
  try { new root.PerformanceObserver(function (l) { l.getEntries().forEach(xemTaiNguyen); }).observe({ type: 'resource', buffered: true }); } catch (e) { /* trình duyệt cũ: bỏ phần đo */ }

  /* ---- đọc trang ---- */
  var timVm = function (dung) {      // duyệt cây thành phần Vue 2 của trang (#app.__vue__ → $children), tối đa 600 nút
    try {
      var goc = doc.querySelector('#app'); goc = goc && goc.__vue__; if (!goc) return null;
      var hang = [goc], dem = 0;
      while (hang.length && dem++ < 600) { var v = hang.shift(); try { if (dung(v)) return v; } catch (e) { /* bỏ qua */ } var c = v && v.$children; if (c && c.length) for (var i = 0; i < c.length; i++) hang.push(c[i]); }
    } catch (e) { /* bỏ qua */ }
    return null;
  };
  var laInvoker = function (v) { return !!v && typeof v.invokeUpdate === 'function' && 'modContext' in v && 'loaded' in v; };
  var khung = function () {      // khung /modules/cut-block (cùng nguồn): { fr, d }
    try { var ds = doc.querySelectorAll('iframe'); for (var i = 0; i < ds.length; i++) { var d = null; try { d = ds[i].contentDocument; } catch (e) { d = null; } if (d && d.body) return { fr: ds[i], d: d }; } } catch (e) { /* bỏ qua */ }
    return null;
  };
  // khung chưa dựng gì: ít phần tử và không có chữ nào ĐANG HIỆN (innerText — textContent thì dính cả mã <script> của khung). Đo thật: khung trắng 15 phần tử, khung đã dựng hơn 1000.
  var khungRong = function (fr) { try { var d = fr && fr.contentDocument; if (!d || !d.body) return false; return d.querySelectorAll('*').length < 40 && !String(d.body.innerText || '').replace(/\s+/g, ''); } catch (e) { return false; } };
  var nut = function (hop, ten) { try { var bs = hop.querySelectorAll('button'); for (var i = 0; i < bs.length; i++) if (chuoi(bs[i]) === ten) return bs[i]; } catch (e) { /* bỏ qua */ } return null; };
  var hopToiUu = function (d) {      // hộp 优化进度 đang hiện: có nút 确认新优化 và nút 开始优化 / 停止优化
    try { var ds = d.querySelectorAll('.el-dialog'); for (var i = 0; i < ds.length; i++) { var h = ds[i]; if (hienThay(h) && nut(h, '确认新优化') && (nut(h, '开始优化') || nut(h, '停止优化'))) return h; } } catch (e) { /* bỏ qua */ }
    return null;
  };
  var docBang = function (hop) {      // bảng vật liệu của hộp: cột tìm theo chữ ở đầu bảng (小板 / 大板 / 名称 / 颜色 / 板厚)
    var kq = { to: [], tam: [], ten: [] };
    try {
      var bang = hop.querySelector('.el-table'); if (!bang) return kq;
      var dau = [].map.call(bang.querySelectorAll('thead th'), chuoi), cot = function (t) { return dau.indexOf(t); };
      var cTo = cot('大板'), cTam = cot('小板'), cTen = cot('名称'), cMau = cot('颜色'), cDay = cot('板厚');
      if (cTo < 0) return kq;
      var hang = bang.querySelectorAll('.el-table__body-wrapper tbody tr'); if (!hang.length) hang = bang.querySelectorAll('tbody tr');
      for (var i = 0; i < hang.length; i++) {
        var o = [].map.call(hang[i].querySelectorAll('td'), chuoi); if (o.length <= cTo) continue;
        kq.to.push(parseInt(o[cTo], 10) || 0); kq.tam.push(cTam >= 0 ? parseInt(o[cTam], 10) || 0 : 0);
        kq.ten.push([cTen >= 0 ? o[cTen] : '', cMau >= 0 ? o[cMau] : '', cDay >= 0 ? o[cDay] : ''].filter(Boolean).join(' '));
      }
    } catch (e) { /* bỏ qua */ }
    return kq;
  };
  // dòng báo của chính trang (Element UI $notify / $message, tự mất sau ~3 giây — đo thật: showErrorMessage → $notify type "error") → ghi lại để bảng báo nêu nguyên văn
  var thongBao = function () { try { var ds = doc.querySelectorAll('.el-notification, .el-message'), ra = []; for (var i = 0; i < ds.length; i++) { if (!hienThay(ds[i])) continue; var t = chuoi(ds[i]); if (t) ra.push(t.slice(0, 160)); } return ra.join(' · '); } catch (e) { return ''; } };
  var tong = function (a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; };
  var bam = function (el) { try { el.click(); return true; } catch (e) { return false; } };
  // Người dùng tự bấm / gõ TRONG HỘP TỐI ƯU → nhường. Nghe từ lúc khung vừa có tài liệu, kể cả khi trợ lý CHƯA kịp thấy hộp (nhịp dò 200 ms):
  // lần bấm rơi vào đúng khe đó mà bị lỡ thì trợ lý sẽ bấm chồng lên việc người dùng đang làm.
  var ngheNguoi = function (d) {
    if (A.nghe === d) return; A.nghe = d;
    var f = function (e) { try { if (!e.isTrusted || ['cho', 'dem', 'chay', 'dung'].indexOf(A.giai) < 0) return; var h = hopToiUu(d); if (h && e.target && h.contains(e.target)) A.nguoi = true; } catch (er) { /* bỏ qua */ } };      // hộp hỏi khác của trang (tấm vượt cỡ, chọn máy…) không tính
    try { d.addEventListener('mousedown', f, true); d.addEventListener('keydown', f, true); } catch (e) { /* bỏ qua */ }
  };
  var thoi = function (ly) { A.giai = 'thoi'; A.ly = ly; };
  var duKQ = function (b) { return b.to.length > 0 && b.to.every(function (n) { return n > 0; }); };      // mọi vật liệu đã có số tờ

  /* ---- Tiếng Việt cho nút / nhãn của trang (bản 1.36.4) ----
   * Từ điển theo ảnh trang sản xuất anh Thanh gửi 16/10/2026; dịch theo nghề xưởng: 开料 = cắt ván, 封边 = dán cạnh, 下刀点 = điểm vào dao, 余料板 = ván dư,
   * 纹路 = vân, 翻板 = lật tấm, 备料单 = phiếu (chuẩn bị) vật tư, 大板 = tờ ván (2440 × 1220), 小板 = tấm (tấm cắt ra). Thêm chữ: thêm vào TU_VI (khoá = chữ gốc đúng từng chữ).
   * Một dòng chữ có thể chứa nhiều nhãn kèm số ("规格:1220*2440*17.5 小板数:13/38"): thay từng nhãn, số giữ nguyên. Sau khi thay mà còn chữ Hán thì KHÔNG gắn —
   * nửa Việt nửa Trung khó đọc hơn chữ gốc. */
  var TU_VI = {
    '继续优化': 'Tối ưu tiếp', '保存优化': 'Lưu tối ưu', '导出优化': 'Xuất tối ưu', '小板明细': 'Chi tiết tấm', '手动排版': 'Xếp tay', '开料顺序': 'Thứ tự cắt',
    '下刀点': 'Điểm vào dao', '导出NC': 'Xuất NC', '打印标签': 'In nhãn', '一键NC': 'NC một chạm', '一键打印': 'In một chạm', '导出备料单': 'Xuất phiếu vật tư',
    'CNC导出': 'Xuất CNC', '系统配置': 'Cài đặt hệ thống', '搜索小板': 'Tìm tấm', '高亮显示可辅助开料的小板': 'Tô sáng tấm cắt phụ được', '更多页码': 'Xem thêm trang',
    '排单信息': 'Thông tin xếp đơn', '订单信息': 'Thông tin đơn hàng', '板材信息': 'Thông tin ván', '小板信息': 'Thông tin tấm', '小板尺寸': 'Kích thước tấm',
    '板边信息': 'Thông tin dán cạnh', '高级属性': 'Thuộc tính nâng cao', '排版情况': 'Tình trạng xếp ván', '开料情况': 'Tình trạng cắt', 'CNC高级对接': 'Kết nối CNC nâng cao',
    '规格': 'Quy cách', '翻板数': 'Số tấm lật', '小板数': 'Số tấm', '大板号': 'Tờ số', '面积': 'Diện tích', '总平均': 'TB chung', '尾板': 'Tờ cuối', '坐标': 'Toạ độ',
    '封边汇总': 'Tổng dán cạnh', '预留边小板': 'Tấm chừa biên',
    '已排': 'Đã xếp', '名称': 'Tên', '材质': 'Chất liệu', '颜色': 'Màu', '纹路': 'Vân', '板厚': 'Dày', '小板': 'Tấm', '大板': 'Tờ ván', '前N': 'N tờ đầu', '最后': 'Tờ cuối',
    '余料板': 'Ván dư', '新优化': 'Tối ưu mới', '开料刀': 'Dao cắt', '尺寸规格': 'Quy cách kích thước', '操作': 'Thao tác', '修改': 'Sửa', '有': 'Có', '无': 'Không',
    '优化进度': 'Tiến độ tối ưu', '开始优化': 'Bắt đầu tối ưu', '停止优化': 'Dừng tối ưu', '确认新优化': 'Xác nhận tối ưu mới', '取消优化': 'Huỷ tối ưu', '现在优化': 'Đang tối ưu',
    '添加余料板': 'Thêm ván dư', '重新优化': 'Tối ưu lại', '双面优先': 'Ưu tiên hai mặt', '补板(每张小板单独开料)': 'Bù tấm (cắt riêng từng tấm)',
    '板宽': 'Rộng ván', '板长': 'Dài ván', '数量': 'Số lượng', '提示': 'Thông báo', '确定': 'Đồng ý', '取消': 'Huỷ'
  };
  var VI_MAU = [[/前(\d+)平均/g, 'TB $1 tờ đầu'], [/：/g, ':']];      // chữ có số ở giữa (前10平均…) + dấu hai chấm khổ rộng
  var VI_KHOA = Object.keys(TU_VI).sort(function (a, b) { return b.length - a.length; });      // dài trước: 小板明细 trước 小板, 确认新优化 trước 新优化
  var HAN = /[㐀-鿿豈-﫿]/;
  var CHU = /[A-Za-zÀ-ỹ]/;      // chữ cái Latinh / Việt — hai mảnh dịch kề nhau mà cả hai phía là chữ cái thì chèn dấu cách
  var dichVi = function (s) {
    if (!s || !HAN.test(s) || s.length > 120) return null;
    var r = s, i;
    for (i = 0; i < VI_MAU.length; i++) r = r.replace(VI_MAU[i][0], VI_MAU[i][1]);
    // (soát 1.36.4) mỗi mảnh dịch bọc dấu \u0001: hai mảnh chữ đứng liền nhau thì cách một dấu cách (无纹路 → "Không Vân", không "KhôngVân"),
    // cạnh số / dấu (规格:1220…) thì sát như chữ gốc. Dấu không phải chữ Hán nên không cắt ngang lần tìm khoá sau.
    for (i = 0; i < VI_KHOA.length && HAN.test(r); i++) if (r.indexOf(VI_KHOA[i]) >= 0) r = r.split(VI_KHOA[i]).join('\u0001' + TU_VI[VI_KHOA[i]] + '\u0001');
    if (HAN.test(r)) return null;
    return r.replace(/\u0001+/g, function (m, o, x) { return CHU.test(x.charAt(o - 1)) && CHU.test(x.charAt(o + m.length)) ? ' ' : ''; });
  };
  // Phần tử được gắn: phần tử HTML chỉ chứa chữ (không có phần tử con — thu cỡ chữ của nó về 0 không làm mất biểu tượng / số nằm trong phần tử con).
  var VI_BO = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, OPTION: 1, SELECT: 1, INPUT: 1, TITLE: 1, NOSCRIPT: 1 };
  var XHTML = 'http://www.w3.org/1999/xhtml';
  var VI_CSS = '[data-mncf-vi]{font-size:0!important}[data-mncf-vi]::after{content:attr(data-mncf-vi)!important;font-size:12px}';
  var VI = [];      // tài liệu đang gắn: { d, mo (MutationObserver), hen, luc, co: { cỡ chữ: true } }
  var viCss = function (e, fs) {      // cỡ chữ của ::after = cỡ chữ gốc đo lúc gắn; mỗi cỡ một luật (khỏi ghi style vào phần tử của trang)
    try {
      var st = e.d.getElementById('mncf-vi-css');
      if (!st) { st = e.d.createElement('style'); st.id = 'mncf-vi-css'; st.textContent = VI_CSS; (e.d.head || e.d.documentElement).appendChild(st); e.co = {}; }
      if (fs && !e.co[fs]) { e.co[fs] = true; st.textContent += '[data-mncf-vi][data-mncf-fs="' + fs + '"]::after{font-size:' + fs + 'px}'; }
    } catch (er) { /* bỏ qua */ }
  };
  var goTho = function (el) { try { el.removeAttribute('data-mncf-vi'); el.removeAttribute('data-mncf-fs'); if (el.hasAttribute('data-mncf-vt')) { el.removeAttribute('title'); el.removeAttribute('data-mncf-vt'); } } catch (e) { /* bỏ qua */ } };
  var goPh = function (o) { try { var g = o.getAttribute('data-mncf-ph'); if (g !== null && o.getAttribute('placeholder') === dichVi(g)) o.setAttribute('placeholder', g); o.removeAttribute('data-mncf-ph'); if (o.hasAttribute('data-mncf-vt')) { o.removeAttribute('title'); o.removeAttribute('data-mncf-vt'); } } catch (e) { /* bỏ qua */ } };
  var datTitle = function (el, goc) { if (!el.hasAttribute('title')) { el.setAttribute('title', goc); el.setAttribute('data-mncf-vt', '1'); } else if (el.hasAttribute('data-mncf-vt') && el.getAttribute('title') !== goc) el.setAttribute('title', goc); };
  // (soát 1.36.4) Quét THEO PHẦN VỪA ĐỔI: máy nghe ghi các nút bị đổi (MutationRecord.target) vào e.goc, lần quét chỉ đi cây con của chúng. Quét cả trang
  // mỗi 300 ms làm trang nhiều chữ (10 000 dòng) giật — ô 坐标 nhảy số mỗi lần rê chuột là một lần đi lại cả danh sách. Cả trang chỉ khi mới gắn (e.het) hoặc
  // một đợt đổi quá VI_GOC_TRAN nút (trang dựng lại cả khối — đi một lượt từ body rẻ hơn gom từng gốc).
  var VI_GOC_TRAN = 300;
  var VI_DEM = { lan: 0, nut: 0 };      // số lần quét + số text node lần sau cùng đi qua (phép thử đo)
  var gocQuet = function (e, d) {      // gốc cần quét: bỏ gốc đã rời trang, bỏ gốc nằm trong gốc khác
    var q = ++VI_DEM.lan, ds = [], i, r;
    for (i = 0; i < e.goc.length; i++) { r = e.goc[i]; if (r && r.nodeType !== 1) r = r.parentNode; if (r && r.nodeType === 1 && d.body.contains(r)) { r.__mncfQ = q; ds.push(r); } }
    return ds.filter(function (x) { for (var p = x.parentNode; p && p !== d; p = p.parentNode) if (p.__mncfQ === q) return false; return true; });
  };
  function quetVi(e) {
    var d = e.d; if (!d || !d.body) return;
    var goc = e.het ? (++VI_DEM.lan, [d.body]) : gocQuet(e, d);
    e.goc = []; e.het = false;
    if (!goc.length) return;      // đợt đổi chỉ ở <head> (CSS của chính trợ lý) / nút đã rời trang
    var n, ds = [], dem = 0, g, i, j;
    for (g = 0; g < goc.length; g++) {
      var w = d.createTreeWalker(goc[g], 4 /* NodeFilter.SHOW_TEXT */, null, false);
      while ((n = w.nextNode())) {
        dem++;
        var el = n.parentNode;
        if (!el || el.nodeType !== 1 || el.__mncfVi === e.luc || !HAN.test(n.nodeValue)) continue;
        el.__mncfVi = e.luc;
        if (el.namespaceURI !== XHTML || VI_BO[el.tagName] || el.firstElementChild || el.isContentEditable) continue;
        var chu = String(el.textContent || '').replace(/\s+/g, ' ').trim(), vi = dichVi(chu);
        if (vi) ds.push([el, chu, vi]);
      }
    }
    VI_DEM.nut = dem;
    // đo cỡ chữ TRƯỚC khi gắn (đã gắn thì cỡ đang là 0 — giữ số đo cũ), rồi mới gắn: khỏi đo xen ghi làm trình duyệt dàn trang lại từng phần tử
    for (var i = 0; i < ds.length; i++) { var x = ds[i][0]; if (!x.hasAttribute('data-mncf-fs')) { var f = parseFloat(root.getComputedStyle(x).fontSize); ds[i][3] = f > 0 ? String(Math.round(f * 2) / 2) : ''; } else ds[i][3] = x.getAttribute('data-mncf-fs'); }
    for (i = 0; i < ds.length; i++) {
      var t = ds[i][0];
      if (ds[i][3]) { viCss(e, ds[i][3]); if (t.getAttribute('data-mncf-fs') !== ds[i][3]) t.setAttribute('data-mncf-fs', ds[i][3]); }
      if (t.getAttribute('data-mncf-vi') !== ds[i][2]) t.setAttribute('data-mncf-vi', ds[i][2]);
      datTitle(t, ds[i][1]); t.__mncfViOk = e.luc;
    }
    if (ds.length) viCss(e, '');
    var trong = function (r, sel) { var a = [].slice.call(r.querySelectorAll(sel)); if (r.matches && r.matches(sel)) a.unshift(r); return a; };
    for (g = 0; g < goc.length; g++) {
      var cu = trong(goc[g], '[data-mncf-vi]');
      for (i = 0; i < cu.length; i++) if (cu[i].__mncfViOk !== e.luc) goTho(cu[i]);      // chữ đã đổi thành thứ không dịch được (trang đổi nội dung): gỡ
      // chữ mờ của ô nhập (搜索小板): đổi thuộc tính placeholder — không phải text node, không phải giá trị ô; chữ gốc giữ ở data-mncf-ph
      var os = trong(goc[g], 'input[placeholder], textarea[placeholder]');
      for (j = 0; j < os.length; j++) {
        var o = os[j], ph = o.getAttribute('placeholder') || '';
        if (!HAN.test(ph)) continue;                                   // đã là chữ Việt (hoặc không có chữ Hán)
        var pv = dichVi(ph.trim()); if (!pv) continue;
        o.setAttribute('data-mncf-ph', ph); o.setAttribute('placeholder', pv); datTitle(o, ph);
      }
    }
  }
  var lichVi = function (e) {
    if (e.hen) return;
    e.hen = root.setTimeout(function () { e.hen = 0; e.luc = now(); try { quetVi(e); } catch (er) { /* không để lỗi lọt ra trang */ } }, Math.max(0, e.luc + CH.vi_cach - now()));
  };
  function giuVi() {      // gọi mỗi nhịp: gắn vào trang + mọi khung cùng nguồn (khung cut-block); khung tải lại = tài liệu mới
    var ds = [doc];
    try { var fs = doc.querySelectorAll('iframe'); for (var i = 0; i < fs.length; i++) { var d = null; try { d = fs[i].contentDocument; } catch (er) { d = null; } if (d && d.body) ds.push(d); } } catch (er) { /* bỏ qua */ }
    VI = VI.filter(function (e) { if (ds.indexOf(e.d) >= 0) return true; try { e.mo.disconnect(); root.clearTimeout(e.hen); } catch (er) { /* bỏ qua */ } return false; });
    ds.forEach(function (d) {
      if (VI.some(function (e) { return e.d === d; })) return;
      var e = { d: d, mo: null, hen: 0, luc: 0, co: {}, goc: [], het: true };
      try { e.mo = new root.MutationObserver(function (recs) { if (!e.het) { for (var i = 0; i < recs.length; i++) e.goc.push(recs[i].target); if (e.goc.length > VI_GOC_TRAN) { e.het = true; e.goc = []; } } lichVi(e); }); e.mo.observe(d.documentElement, { childList: true, subtree: true, characterData: true }); } catch (er) { /* bỏ qua */ }
      VI.push(e); lichVi(e);
    });
  }
  function goVi() {      // tắt = gỡ sạch: thuộc tính, title do trợ lý đặt, chữ mờ, CSS, máy nghe
    VI.forEach(function (e) {
      try { e.mo && e.mo.disconnect(); root.clearTimeout(e.hen); } catch (er) { /* bỏ qua */ }
      try {
        var d = e.d, st = d.getElementById('mncf-vi-css'); if (st) st.remove();
        [].forEach.call(d.querySelectorAll('[data-mncf-vi], [data-mncf-fs]'), goTho);
        [].forEach.call(d.querySelectorAll('[data-mncf-ph]'), goPh);
        [].forEach.call(d.querySelectorAll('[data-mncf-vt]'), function (x) { x.removeAttribute('title'); x.removeAttribute('data-mncf-vt'); });
      } catch (er) { /* bỏ qua */ }
    });
    VI = [];
  }

  /** (soát 1.36.4) Tên nút trong lời báo: Tiếng Việt bật thì trang đang hiện chữ Việt → nêu chữ Việt kèm chữ gốc ("Lưu tối ưu (保存优化)"), không thì chữ gốc. */
  var tenNut = function (goc) { return cai.vi && TU_VI[goc] ? TU_VI[goc] + ' (' + goc + ')' : goc; };

  /* ---- trước khi bảng tối ưu hiện ---- */
  function truocBang(k, t) {
    if (!S.dl) { var vm = timVm(function (v) { return v.orderData && Array.isArray(v.orderData.blockList) && v.orderData.blockList.length > 0; }); if (vm) { S.dl = t; S.so_tam = vm.orderData.blockList.length; } }      // lỡ tin nhắn (trợ lý nạp trễ): đọc ở thành phần của trang
    var iv = timVm(laInvoker);
    if (iv && !S.pl) S.pl = t;                          // Invoker chỉ có sau khi máy chủ đã trả sơ đồ
    var fr = iv && iv.$el && iv.$el.tagName === 'IFRAME' ? iv.$el : (k && k.fr), rong = !fr || khungRong(fr);      // rong: chưa có khung cut-block, hoặc khung chưa dựng gì
    if (iv && iv.loaded && iv.modContext && fr && rong) {
      if (!S.rong_tu) S.rong_tu = t;
      if (t - S.rong_tu >= CH.cho_cuu && S.cuu < CH.cuu_toi_da && t - S.cuu_luc >= CH.cuu_cach) { S.cuu++; S.cuu_luc = t; try { iv.invokeUpdate(); } catch (e) { /* bỏ qua */ } }
    } else S.rong_tu = 0;
    var giay = Math.round((t - S.t0) / 1000), tb = thongBao();
    if (tb) S.tb = tb;
    // "không mở được" chỉ khi khung còn rỗng: khung đã dựng mà chưa thấy hộp tối ưu là trang đang bận việc khác (hỏi người dùng một câu…), không phải hỏng
    if (S.pl_loi || (rong && ((S.bao && t - S.bao >= 3000) || (S.pl && t - S.pl >= CH.han_bang)))) return dat('loi', 'err', 'Trang sản xuất của Chenfeng không mở được bảng tối ưu' + (S.pl_loi ? ' (máy chủ báo lỗi)' : '') + '.' + (S.tb ? ' Trang báo: “' + S.tb + '”.' : '') + ' Đóng tab này rồi bấm Xuất ván lại trong Chenfeng — đừng F5: tải lại là mất dữ liệu tấm.');
    if (S.pl && !rong) {                                // khung đã dựng; hộp tối ưu thường hiện ngay sau đó — quá 1,5 giây chưa thấy mới đổi lời
      if (!S.dung_tu) S.dung_tu = t;
      if (t - S.dung_tu >= 1500) return dat('cho_hop', 'note', 'Trang sản xuất đã mở — chờ hộp ' + tenNut('优化进度') + ' hiện' + (cai.tu_dong ? ' thì trợ lý tự chạy tối ưu' : '') + '. Trang đang hỏi gì thì anh trả lời trước.');
    }
    if (S.pl) return S.cuu ? dat('cuu', 'note', 'Trang bị kẹt trắng — trợ lý đã gọi lại, bảng tối ưu đang hiện…') : dat('mo_bang', 'note', 'Máy chủ đã trả sơ đồ' + (S.pl_ms ? ' (' + (S.pl_ms / 1000).toFixed(1).replace('.', ',') + ' giây)' : '') + ' — đang mở bảng tối ưu…');
    if (S.dl) { var u = uocTinh(S.so_tam), da = Math.round((t - S.dl) / 1000); return dat('tinh', 'note', 'Máy chủ Chenfeng đang tính ' + (S.so_tam ? S.so_tam + ' tấm' : 'sơ đồ') + '… ' + da + ' giây (thường khoảng ' + u + ' giây).' + (da > 3 * u + 20 ? ' Lâu bất thường — chờ thêm, hoặc đóng tab này rồi bấm Xuất ván lại.' : '')); }
    if (t - S.t0 >= CH.han_dl) return dat('mat_dl', 'warn', 'Trang này chưa nhận được dữ liệu tấm từ Chenfeng CAD. Nếu anh vừa F5 hoặc mở lại tab: đóng tab này rồi bấm Xuất ván lại trong Chenfeng (dữ liệu chỉ được trao một lần lúc bấm 打开).');
    return dat('cho_dl', 'note', 'Đang chờ dữ liệu tấm từ Chenfeng CAD… ' + giay + ' giây');
  }

  /* ---- bảng tối ưu đã hiện ---- */
  var nhacTay = function () { return 'bấm ' + tenNut('开始优化') + ' → đếm 3–5 giây → ' + tenNut('停止优化') + ' → ' + tenNut('确认新优化') + ' (thanh tiến độ không bao giờ tự dừng).'; };
  function toiUu(k, hop, t) {
    var nChay = hop && nut(hop, '开始优化'), nDung = hop && nut(hop, '停止优化'), nXac = hop && nut(hop, '确认新优化');
    if (A.giai === 'cho') {
      if (!hop) return;
      if (!cai.tu_dong) A.giai = 'tay';
      else if (A.nguoi || !nChay) thoi('nguoi');      // người dùng đã đụng vào hộp, hoặc tối ưu đang chạy sẵn (trợ lý tới sau): không đếm, không bấm chồng lên
      else { A.giai = 'dem'; A.t = t; }
    }
    else if (A.giai === 'tay') { if (cai.tu_dong && hop && nChay) { A.giai = 'dem'; A.t = t; A.nguoi = false; } }      // bật lại tại chỗ = bảo trợ lý làm: bỏ qua những lần bấm trước đó
    else if (A.giai === 'dem') {
      if (A.nguoi) thoi('nguoi'); else if (!hop) thoi('hop_dong'); else if (!cai.tu_dong) A.giai = 'tay';
      else if (t - A.t >= CH.dem && nChay && !nChay.disabled) { bam(nChay); A.lan_bam = 1; A.da_chay = false; A.t = t; A.t_chay = t; A.to = ''; A.t_doi = t; A.bang = null; A.giai = 'chay'; }
    } else if (A.giai === 'chay') {
      if (A.nguoi) thoi('nguoi'); else if (!hop) thoi('hop_dong');
      else if (!nDung && A.da_chay) {                    // đã chạy rồi TỰ dừng, không ai bấm (lần đo thật thanh tiến độ quay mãi, nhưng tuỳ chọn khác có thể tự xong): đừng tưởng lần bấm bị nuốt mà bấm chạy lại
        var bx = docBang(hop);
        if (duKQ(bx)) { A.ket = bx; A.giai = 'dung'; A.t = t; } else thoi('tu_dung');
      } else if (!nDung) {                               // bấm rồi mà trang chưa chuyển sang đang chạy (lần bấm đầu trong tab vừa mở có khi bị nuốt)
        if (nChay && t - A.t >= CH.bam_lai) { if (A.lan_bam < 3) { bam(nChay); A.lan_bam++; A.t = t; A.t_chay = t; A.t_doi = t; } else thoi('khong_chay'); }
      } else {
        A.da_chay = true;
        var b = docBang(hop), khoa = b.to.join(',');
        if (khoa !== A.to) { A.to = khoa; A.t_doi = t; }
        A.bang = b;
        var du = duKQ(b);
        if (du && t - A.t_doi >= onDinh(tong(b.tam))) { A.ket = b; bam(nDung); A.giai = 'dung'; A.t = t; }
        else if (t - A.t_chay >= CH.han_chay) thoi('lau');
      }
    } else if (A.giai === 'dung') {
      if (A.nguoi) thoi('nguoi'); else if (!hop) thoi('hop_dong');
      else if (nChay && nXac && !nXac.disabled) { A.ket = docBang(hop); bam(nXac); A.giai = 'xac'; A.t = t; }
      else if (t - A.t >= 6000) thoi('khong_dung');
    } else if (A.giai === 'xac') { if (!hop) { A.giai = 'xong'; A.t_xong = t; } else if (t - A.t >= 8000) thoi('khong_dong'); }

    if (A.giai === 'tay') return dat('tay', 'note', 'Tự tối ưu đang tắt. Bảng tối ưu đã hiện: ' + nhacTay());
    if (A.giai === 'dem') return dat('dem', 'note', 'Bảng tối ưu đã hiện — trợ lý bấm ' + tenNut('开始优化') + ' sau ' + Math.max(1, Math.ceil((CH.dem - (t - A.t)) / 1000)) + ' giây…');
    if (A.giai === 'chay') { var bg = A.bang; return dat('chay', 'note', bg && tong(bg.to) ? 'Đang tối ưu: ' + tong(bg.to) + ' tờ ván (' + bg.to.join(' + ') + ') — số tờ đứng yên ' + (onDinh(tong(bg.tam)) / 1000).toFixed(1).replace('.', ',') + ' giây thì trợ lý dừng và mở sơ đồ.' : 'Đang chạy tối ưu…'); }
    if (A.giai === 'dung' || A.giai === 'xac') return dat('dung', 'note', 'Đã dừng tối ưu — đang mở sơ đồ cắt…');
    if (A.giai === 'xong') {
      var kq = A.ket || { to: [], ten: [] }, ct = kq.to.map(function (n, i) { return (kq.ten[i] || 'loại ' + (i + 1)) + ': ' + n + ' tờ'; }).join('; ');
      if (!S.gon && A.t_xong && t - A.t_xong >= CH.thu_gon) S.gon = true;      // xong lâu rồi: thu lại cho khỏi che sơ đồ
      return dat('xong', 'ok', 'Xong — ' + tong(kq.to) + ' tờ ván' + (ct ? ' (' + ct + ')' : '') + '. Sơ đồ cắt đã mở, CHƯA lưu gì: anh bấm ' + tenNut('保存优化') + ' / ' + tenNut('一键NC') + ' / ' + tenNut('打印标签') + ' khi cần.');
    }
    if (A.ly === 'nguoi') return dat('thoi:nguoi', 'note', 'Anh đang tự làm — trợ lý không bấm gì nữa. Nhớ: ' + nhacTay());
    if (A.ly === 'lau') return dat('thoi:lau', 'warn', 'Tối ưu đã chạy hơn ' + Math.round(CH.han_chay / 1000) + ' giây mà còn vật liệu chưa ra kết quả — trợ lý để nguyên cho anh tự xử lý (' + tenNut('停止优化') + ' rồi ' + tenNut('确认新优化') + ' khi thấy được).');
    if (A.ly === 'tu_dung') return dat('thoi:tu_dung', 'warn', 'Tối ưu đã tự dừng mà còn vật liệu chưa ra kết quả — trợ lý để nguyên cho anh xem: bấm ' + tenNut('开始优化') + ' chạy lại, hoặc ' + tenNut('确认新优化') + ' nếu thấy dùng được.');
    if (A.ly === 'khong_chay') return dat('thoi:khong_chay', 'warn', 'Trợ lý đã bấm ' + tenNut('开始优化') + ' mà trang không chạy — anh bấm tay giúp: ' + nhacTay());
    return dat('thoi:' + A.ly, 'note', 'Trợ lý dừng ở đây — anh làm tiếp bằng tay: ' + nhacTay());
  }

  /* ---- bảng báo (góc dưới bên phải, trong shadow DOM để không dính CSS của trang) ---- */
  var ui = null;
  var CSS = ':host{all:initial}*{box-sizing:border-box}'
    + '.sx{position:fixed;right:14px;bottom:14px;width:340px;max-width:calc(100vw - 28px);background:#fff;color:#1b2420;border:1px solid rgba(0,0,0,.28);border-radius:10px;box-shadow:0 10px 28px rgba(0,0,0,.35);font:13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;z-index:2147483000;overflow:hidden}'
    + '.sx[hidden],.vien[hidden],.nut[hidden]{display:none}'
    + '.dau{display:flex;align-items:center;gap:6px;background:#1c2530;color:#e8edf2;padding:6px 6px 6px 12px;font-weight:700}.dau span{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dau i{font-style:normal;font-weight:400;color:#a5b4c3}'
    + '.dau button{all:unset;cursor:pointer;width:24px;height:24px;line-height:24px;text-align:center;border-radius:6px;color:#e8edf2}.dau button:hover{background:rgba(255,255,255,.16)}'
    + '.than{padding:9px 12px 10px}.chu{margin:0;border-left:3px solid #3b86a8;padding-left:8px}.chu.ok{border-color:#2f9e6e;color:#17603f}.chu.err{border-color:#d9402b;color:#8d1f14}.chu.warn{border-color:#e0a100;color:#6e4b00}'
    + '.duoi{display:flex;align-items:center;gap:10px;margin-top:8px;flex-wrap:wrap}label{display:flex;align-items:center;gap:6px;cursor:pointer;flex:1 1 auto}input{margin:0;width:15px;height:15px}'
    + '.nut{all:unset;cursor:pointer;padding:4px 10px;border:1px solid #cdd4ca;border-radius:6px;background:#f4f6f2;font:inherit}.nut:hover{background:#e3ebf6}'
    + '.vien{position:fixed;right:14px;bottom:14px;height:34px;padding:0 14px;border-radius:17px;border:0;background:#1c5fb8;color:#fff;font:700 12px system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.4);cursor:pointer;z-index:2147483000}';
  function dung() {
    if (ui || !doc.body) return;
    var host = doc.createElement('div'); host.id = 'mncf-sx-host';
    var sh = host.attachShadow({ mode: 'open' });
    sh.innerHTML = '<style>' + CSS + '</style><section class="sx" hidden aria-label="Một Nhà — trợ lý xuất ván"><div class="dau"><span>Một Nhà <i>· trợ lý xuất ván</i></span><button data-act="gon" title="Thu gọn">–</button><button data-act="dong" title="Ẩn bảng báo này (trợ lý vẫn làm tiếp)">×</button></div>'
      + '<div class="than"><p class="chu"></p><div class="duoi"><label title="Bật: hộp Tiến độ tối ưu (优化进度) hiện là trợ lý tự bấm Bắt đầu tối ưu (开始优化), tự dừng khi số tờ ván đứng yên rồi mở sơ đồ. Tắt: anh tự bấm."><input type="checkbox" data-ui="tu-dong"> Tự tối ưu khi mở trang</label><label title="Bật: nút / nhãn của trang sản xuất hiện chữ Việt (chỉ hiển thị — rê chuột thấy chữ gốc). Tắt: trả nguyên chữ Trung."><input type="checkbox" data-ui="vi"> Tiếng Việt</label><button class="nut" data-act="tu-lam" hidden>Để tôi tự làm</button></div></div></section><button class="vien" hidden title="Mở bảng báo của trợ lý">Một Nhà</button>';
    ui = { host: host, sx: sh.querySelector('.sx'), chu: sh.querySelector('.chu'), o: sh.querySelector('[data-ui="tu-dong"]'), oVi: sh.querySelector('[data-ui="vi"]'), tuLam: sh.querySelector('[data-act="tu-lam"]'), vien: sh.querySelector('.vien') };
    ui.o.checked = cai.tu_dong; ui.oVi.checked = cai.vi;
    var an = function (f) { return function (e) { try { f(e); } catch (er) { /* không để lỗi lọt ra trang */ } }; };
    ui.o.addEventListener('change', an(function () { cai.tu_dong = !!ui.o.checked; luuCai(); }));
    ui.oVi.addEventListener('change', an(function () { cai.vi = !!ui.oVi.checked; luuCai(); if (cai.vi) giuVi(); else goVi(); }));
    sh.querySelector('[data-act="dong"]').addEventListener('click', an(function () { S.an = true; ve(); }));
    sh.querySelector('[data-act="gon"]').addEventListener('click', an(function () { S.gon = true; ve(); }));
    ui.vien.addEventListener('click', an(function () { S.gon = false; if (A.giai === 'xong') A.t_xong = 0; ve(); }));
    ui.tuLam.addEventListener('click', an(function () { if (['dem', 'chay', 'dung'].indexOf(A.giai) >= 0) thoi('nguoi'); }));
    doc.body.appendChild(host);
  }
  function dat(khoa, loai, chu) {
    if (khoa !== S.khoa) { S.nhat_ky.push([khoa, chu]); if (S.nhat_ky.length > 40) S.nhat_ky.shift(); }
    S.khoa = khoa; S.loai = loai; S.chu = chu;
  }
  function ve() {
    dung(); if (!ui) return;
    var hien = S.khoa !== 'nghi' && !S.an;
    ui.sx.hidden = !hien || S.gon; ui.vien.hidden = !hien || !S.gon;
    if (!hien) return;
    if (ui.chu.textContent !== S.chu) ui.chu.textContent = S.chu;
    ui.chu.className = 'chu' + (S.loai && S.loai !== 'note' ? ' ' + S.loai : '');
    ui.tuLam.hidden = ['dem', 'chay'].indexOf(A.giai) < 0;
    if (ui.o.checked !== cai.tu_dong) ui.o.checked = cai.tu_dong;
    if (ui.oVi.checked !== cai.vi) ui.oVi.checked = cai.vi;
    ui.vien.textContent = A.giai === 'xong' && A.ket ? 'Một Nhà ✓ ' + tong(A.ket.to) + ' tờ' : 'Một Nhà';
  }

  var vong = 0;
  function nhip() {
    try {
      if (!/^#\/cadSingleAdd/.test(String(root.location.hash || ''))) { S.khoa = 'nghi'; if (VI.length) goVi(); ve(); return; }      // các trang khác của hệ sản xuất: nằm im (kể cả chữ Việt — chỉ làm ở trang tối ưu)
      var k = khung(), hop = k ? hopToiUu(k.d) : null, t = now();
      if (k) ngheNguoi(k.d);
      try { if (cai.vi) giuVi(); else if (VI.length) goVi(); } catch (e) { /* chữ Việt hỏng thì thôi — việc tối ưu vẫn chạy */ }
      if (hop || A.giai !== 'cho') toiUu(k, hop, t); else truocBang(k, t);
      ve();
    } catch (e) { /* không để lỗi lọt ra trang */ }
  }

  root.MNCF_SX = {
    version: VERSION,
    /** Ảnh chụp trạng thái (cho phép thử và khi cần xem bằng tay ở bảng điều khiển). */
    trang_thai: function () { return { giai: S.khoa === 'nghi' ? 'nghi' : (A.giai === 'cho' ? 'truoc_bang' : 'bang'), khoa: S.khoa, tu: A.giai, ly: A.ly, chu: S.chu, loai: S.loai, so_tam: S.so_tam, cuu: S.cuu, tu_dong: cai.tu_dong, vi: cai.vi, vi_quet: { lan: VI_DEM.lan, nut: VI_DEM.nut }, nhat_ky: S.nhat_ky.slice() }; },
    /** Chỉnh ngưỡng (ms) — xem CH ở đầu file. Đổi nhip thì nhịp dò chạy lại theo số mới (không dưới 50 ms). */
    dat: function (o) {
      try {
        var cu = CH.nhip;
        for (var k in o) if (Object.prototype.hasOwnProperty.call(CH, k) && typeof o[k] === 'number' && o[k] >= 0) CH[k] = o[k];
        if (CH.nhip < 50) CH.nhip = 50;
        if (CH.nhip !== cu && vong) { root.clearInterval(vong); vong = root.setInterval(nhip, CH.nhip); }
      } catch (e) { /* bỏ qua */ }
      return Object.assign({}, CH);
    },
    tinh: { onDinh: onDinh, uocTinh: uocTinh, dichVi: dichVi }
  };
  nhip();
  vong = root.setInterval(nhip, CH.nhip);
})(typeof self !== 'undefined' ? self : this);

}).call(typeof self !== 'undefined' ? self : this);
