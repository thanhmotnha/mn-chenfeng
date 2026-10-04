/*
 * Một Nhà · Vẽ tủ vào Chenfeng — BỘ NẠP (cài một lần).
 * Mỗi lần mở Chenfeng: hỏi kho GitHub xem có bản mới không → có thì tải, đối chiếu mã kiểm SHA-256, cất vào bộ nhớ máy rồi chạy;
 * không có mạng / kho không vào được → chạy bản đã cất; chưa cất lần nào → chạy bản kèm sẵn trong tiện ích (du-phong.js).
 * Chạy trong world MAIN của trang cfcad.cn (trang không đặt CSP nên chạy được mã tải về).
 * Bộ nạp bản 2 (bản 1.22): ở TRANG SẢN XUẤT của Chenfeng (sc.leye.site — tab mở ra sau lệnh tách đơn CD → 打开; cũng không đặt CSP, đã kiểm 04/10/2026)
 * thì nạp bản "trợ lý xuất ván" (mn-chenfeng-sx.js, vài chục KB) thay cho bảng vẽ tủ. Ở đó trợ lý phải có từ giây đầu nên bộ nạp CHẠY NGAY bản đang có
 * (bản đã cất, hoặc bản kèm tiện ích du-phong-sx.js — lấy bản mới hơn) rồi mới hỏi kho; kho có bản khác thì tải ngầm + cất, lần mở trang sau dùng.
 */
(function (root) {
  'use strict';
  if (root.__MNCF_NAP__) return;
  var doc = root.document;
  if (!doc || /^\/help/.test(root.location.pathname)) return;
  var SX = /(^|\.)leye\.site$/.test(String(root.location.hostname || ''));
  if (SX) { try { if (root.top !== root) return; } catch (e) { return; } }      // khung nhỏ "Order Splitting" nằm trong trang CAD cũng là sc.leye.site: không nạp gì vào đó

  var NGUON = [
    { ten: 'GitHub', goc: 'https://raw.githubusercontent.com/thanhmotnha/mn-chenfeng/main/dist/' },
    { ten: 'jsDelivr', goc: 'https://cdn.jsdelivr.net/gh/thanhmotnha/mn-chenfeng@main/dist/' }
  ];
  var TEP_BAN = SX ? 'mn-chenfeng-sx.js' : 'mn-chenfeng.js', TEP_TT = 'phien-ban.json';
  var KHOA_NHO = SX ? 'sx' : 'moi', TOAN_CUC = SX ? 'MNCF_SX' : 'MNCF', TEN_DP = SX ? '__MNCF_SX_DU_PHONG__' : '__MNCF_DU_PHONG__';
  var NAP = root.__MNCF_NAP__ = { ban_nap: 2, kho: 'https://github.com/thanhmotnha/mn-chenfeng', phien_ban: '', sha256: '', nguon: '', luc: 0, xong: false, ghi: [] };
  var ghi = function (s) { NAP.ghi.push(s); if (NAP.ghi.length > 40) NAP.ghi.shift(); };

  function soSanh(a, b) {                                   // so phiên bản kiểu 1.15.0 ; >0 nếu a mới hơn b
    var x = String(a || '0').split('.'), y = String(b || '0').split('.');
    for (var i = 0; i < Math.max(x.length, y.length); i++) { var d = (parseInt(x[i], 10) || 0) - (parseInt(y[i], 10) || 0); if (d) return d; }
    return 0;
  }
  function tai(url, ms) {                                   // tải có hạn giờ, không dùng bản đệm của trình duyệt, không gửi cookie
    var ac = typeof AbortController === 'function' ? new AbortController() : null;
    var t = setTimeout(function () { if (ac) ac.abort(); }, ms);
    return root.fetch(url, { cache: 'no-store', credentials: 'omit', signal: ac ? ac.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r; })
      .finally(function () { clearTimeout(t); });
  }
  function bam(buf) {
    return root.crypto.subtle.digest('SHA-256', buf).then(function (h) {
      return Array.prototype.map.call(new Uint8Array(h), function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('');
    });
  }

  /* ---- bộ nhớ máy (IndexedDB của trang cfcad.cn) ---- */
  function moKho() {
    return new Promise(function (ok, loi) {
      var q = root.indexedDB.open('mncf_nap', 1);
      q.onupgradeneeded = function () { q.result.createObjectStore('ban'); };
      q.onsuccess = function () { ok(q.result); }; q.onerror = function () { loi(q.error); }; q.onblocked = function () { loi(new Error('kho nhớ đang bị khoá')); };
    });
  }
  function docNho() {
    return moKho().then(function (db) {
      return new Promise(function (ok, loi) {
        var q = db.transaction('ban').objectStore('ban').get(KHOA_NHO);
        q.onsuccess = function () { db.close(); ok(q.result || null); }; q.onerror = function () { db.close(); loi(q.error); };
      });
    }).catch(function () { return null; });
  }
  function ghiNho(o) {
    return moKho().then(function (db) {
      return new Promise(function (ok) {
        var tx = db.transaction('ban', 'readwrite'); tx.objectStore('ban').put(o, KHOA_NHO);
        tx.oncomplete = function () { db.close(); ok(true); }; tx.onerror = tx.onabort = function () { db.close(); ok(false); };
      });
    }).catch(function () { return false; });
  }

  /* ---- chạy một bản ---- */
  function chay(b, nguon) {
    NAP.nguon = nguon; NAP.sha256 = b.sha256 || ''; NAP.phien_ban = b.phien_ban;   // đặt trước: bảng đọc các ô này ngay khi khởi động
    try {
      if (typeof b.chay === 'function') b.chay(); else (0, eval)(b.ma + '\n//# sourceURL=' + TEP_BAN.replace('.js', '') + '-v' + b.phien_ban + '.js');
      if (!root[TOAN_CUC] || !root[TOAN_CUC].version) throw new Error('bản nạp không khởi động');
      NAP.phien_ban = root[TOAN_CUC].version; NAP.luc = Date.now(); NAP.xong = true;
      try { console.info('[Một Nhà · ' + (SX ? 'trợ lý xuất ván' : 'Vẽ tủ') + '] đang chạy v' + NAP.phien_ban + ' — ' + nguon); } catch (e) { /* bỏ qua */ }
      return true;
    } catch (e) { NAP.nguon = ''; NAP.sha256 = ''; NAP.phien_ban = ''; ghi('chạy ' + nguon + ' lỗi: ' + (e && e.message || e)); return false; }
  }

  function hoiNguon(n) {                                    // → { phien_ban, sha256 } của một nguồn (ở trang sản xuất: mã kiểm của bản trợ lý, mục "sx")
    return tai(n.goc + TEP_TT, 6000).then(function (r) { return r.json(); }).then(function (tt) {
      if (!tt || typeof tt.phien_ban !== 'string' || !/^[0-9a-f]{64}$/.test(tt.sha256 || '')) throw new Error(TEP_TT + ' sai dạng');
      if (!SX) return tt;
      if (!tt.sx || !/^[0-9a-f]{64}$/.test(tt.sx.sha256 || '')) throw new Error('kho chưa có bản trợ lý trang sản xuất');
      return { phien_ban: tt.phien_ban, sha256: tt.sx.sha256 };
    });
  }
  function taiBan(n, tt) {                                  // tải bản gộp, đối chiếu mã kiểm
    return tai(n.goc + TEP_BAN, 30000).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
      return bam(buf).then(function (h) {
        if (h !== tt.sha256) throw new Error('mã tải về không khớp mã kiểm (kho đang cập nhật dở?)');
        return { phien_ban: tt.phien_ban, sha256: h, ma: new TextDecoder('utf-8').decode(buf), luc: Date.now(), nguon: n.ten };
      });
    });
  }

  /* Trang sản xuất: chạy NGAY bản đang có (không chờ mạng), rồi hỏi kho — có bản khác thì tải ngầm + cất cho lần mở trang sau. */
  async function napSX() {
    var nho = await docNho(), dp = root[TEN_DP] || null, ds = [], dang = null;
    if (nho) ds.push([nho, 'bản đã cất trong máy']);
    if (dp) ds.push([dp, 'bản kèm tiện ích']);
    ds.sort(function (a, b2) { return soSanh(b2[0].phien_ban, a[0].phien_ban); });      // bản mới hơn trước; bằng nhau thì bản đã cất (lấy từ kho) trước
    for (var k = 0; k < ds.length && !dang; k++) if (chay(ds[k][0], ds[k][1])) dang = ds[k][0];
    for (var i = 0; i < NGUON.length; i++) {
      var n = NGUON[i];
      try {
        var tt = await hoiNguon(n);
        if ((dang && dang.sha256 === tt.sha256) || (nho && nho.sha256 === tt.sha256)) return;      // đang có đúng bản của kho
        if (dang && soSanh(tt.phien_ban, dang.phien_ban) < 0) { ghi(n.ten + ': đang giữ bản cũ hơn (v' + tt.phien_ban + ') — bỏ qua'); continue; }
        var b = await taiBan(n, tt);
        if (!dang) { if (!chay(b, 'vừa tải từ ' + n.ten)) continue; dang = b; }      // chưa bản nào chạy được (hiếm): chạy luôn bản vừa tải; bản không chạy được thì không cất
        NAP.dang_cat = true; var da = await ghiNho(b); NAP.dang_cat = false; NAP.da_cat = !!da;
        if (da && dang !== b) NAP.cho_lan_sau = b.phien_ban;      // bản mới đã nằm trong máy, lần mở trang sau chạy
        return;
      } catch (e) { ghi(n.ten + ': ' + (e && e.message || e)); }
    }
  }

  async function nap() {
    var nho = await docNho(), dp = root[TEN_DP] || null;
    for (var i = 0; i < NGUON.length; i++) {
      var n = NGUON[i];
      try {
        var tt = await hoiNguon(n);
        if (nho && nho.sha256 === tt.sha256) { if (chay(nho, 'bản mới nhất (đã cất trong máy, đối chiếu với ' + n.ten + ')')) return; nho = null; }
        if (nho && soSanh(tt.phien_ban, nho.phien_ban) < 0) { ghi(n.ten + ': đang giữ bản cũ hơn (v' + tt.phien_ban + ') — bỏ qua'); continue; }
        var b = await taiBan(n, tt);
        if (chay(b, 'vừa tải từ ' + n.ten)) { NAP.dang_cat = true; ghiNho(b).then(function (ok) { NAP.dang_cat = false; NAP.da_cat = !!ok; }); return; }      // chỉ cất bản đã chạy được
      } catch (e) { ghi(n.ten + ': ' + (e && e.message || e)); }
      if (NAP.xong || root.__MNCF_BOOTING__) return;        // bản gộp đã bắt đầu chạy thì không nạp chồng bản khác
    }
    // không lấy được bản mới: dùng bản đã cất, hoặc bản kèm tiện ích (lấy bản mới hơn trong hai)
    var ds = [];
    if (nho) ds.push([nho, 'bản đã cất trong máy (không vào được kho)']);
    if (dp) ds.push([dp, 'bản kèm tiện ích (không vào được kho)']);
    ds.sort(function (a, b2) { return soSanh(b2[0].phien_ban, a[0].phien_ban); });
    for (var k = 0; k < ds.length; k++) { if (chay(ds[k][0], ds[k][1])) return; if (root.__MNCF_BOOTING__) return; }
    try { console.warn('[Một Nhà · Vẽ tủ] không nạp được bảng:', NAP.ghi.join(' | ')); } catch (e) { /* bỏ qua */ }
  }

  /* Hỏi kho xem có bản khác bản đang chạy không (bảng Một Nhà → Hướng dẫn → "Kiểm tra bản mới"). */
  NAP.kiemTra = async function () {
    for (var i = 0; i < NGUON.length; i++) {
      try {
        var tt = await hoiNguon(NGUON[i]);
        return { ok: true, nguon: NGUON[i].ten, phien_ban: tt.phien_ban, dang_chay: NAP.phien_ban, co_moi: !!NAP.sha256 ? tt.sha256 !== NAP.sha256 : soSanh(tt.phien_ban, NAP.phien_ban) > 0 };
      } catch (e) { ghi('kiểm tra ' + NGUON[i].ten + ': ' + (e && e.message || e)); }
    }
    return { ok: false, dang_chay: NAP.phien_ban, co_moi: false };
  };
  NAP.soSanh = soSanh;

  NAP.cho = (SX ? napSX() : nap()).catch(function (e) { ghi('nạp lỗi: ' + (e && e.message || e)); });
})(typeof self !== 'undefined' ? self : this);
