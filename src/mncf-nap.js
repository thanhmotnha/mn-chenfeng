/*
 * Một Nhà · Vẽ tủ vào Chenfeng — BỘ NẠP (cài một lần).
 * Mỗi lần mở Chenfeng: hỏi kho GitHub xem có bản mới không → có thì tải, đối chiếu mã kiểm SHA-256, cất vào bộ nhớ máy rồi chạy;
 * không có mạng / kho không vào được → chạy bản đã cất; chưa cất lần nào → chạy bản kèm sẵn trong tiện ích (du-phong.js).
 * Chạy trong world MAIN của trang cfcad.cn (trang không đặt CSP nên chạy được mã tải về).
 */
(function (root) {
  'use strict';
  if (root.__MNCF_NAP__) return;
  var doc = root.document;
  if (!doc || /^\/help/.test(root.location.pathname)) return;

  var NGUON = [
    { ten: 'GitHub', goc: 'https://raw.githubusercontent.com/thanhmotnha/mn-chenfeng/main/dist/' },
    { ten: 'jsDelivr', goc: 'https://cdn.jsdelivr.net/gh/thanhmotnha/mn-chenfeng@main/dist/' }
  ];
  var TEP_BAN = 'mn-chenfeng.js', TEP_TT = 'phien-ban.json';
  var NAP = root.__MNCF_NAP__ = { ban_nap: 1, kho: 'https://github.com/thanhmotnha/mn-chenfeng', phien_ban: '', sha256: '', nguon: '', luc: 0, xong: false, ghi: [] };
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
        var q = db.transaction('ban').objectStore('ban').get('moi');
        q.onsuccess = function () { db.close(); ok(q.result || null); }; q.onerror = function () { db.close(); loi(q.error); };
      });
    }).catch(function () { return null; });
  }
  function ghiNho(o) {
    return moKho().then(function (db) {
      return new Promise(function (ok) {
        var tx = db.transaction('ban', 'readwrite'); tx.objectStore('ban').put(o, 'moi');
        tx.oncomplete = function () { db.close(); ok(true); }; tx.onerror = tx.onabort = function () { db.close(); ok(false); };
      });
    }).catch(function () { return false; });
  }

  /* ---- chạy một bản ---- */
  function chay(b, nguon) {
    NAP.nguon = nguon; NAP.sha256 = b.sha256 || ''; NAP.phien_ban = b.phien_ban;   // đặt trước: bảng đọc các ô này ngay khi khởi động
    try {
      if (typeof b.chay === 'function') b.chay(); else (0, eval)(b.ma + '\n//# sourceURL=mn-chenfeng-v' + b.phien_ban + '.js');
      if (!root.MNCF || !root.MNCF.version) throw new Error('bản nạp không khởi động');
      NAP.phien_ban = root.MNCF.version; NAP.luc = Date.now(); NAP.xong = true;
      try { console.info('[Một Nhà · Vẽ tủ] đang chạy v' + NAP.phien_ban + ' — ' + nguon); } catch (e) { /* bỏ qua */ }
      return true;
    } catch (e) { NAP.nguon = ''; NAP.sha256 = ''; NAP.phien_ban = ''; ghi('chạy ' + nguon + ' lỗi: ' + (e && e.message || e)); return false; }
  }

  function hoiNguon(n) {                                    // → { phien_ban, sha256 } của một nguồn
    return tai(n.goc + TEP_TT, 6000).then(function (r) { return r.json(); }).then(function (tt) {
      if (!tt || typeof tt.phien_ban !== 'string' || !/^[0-9a-f]{64}$/.test(tt.sha256 || '')) throw new Error(TEP_TT + ' sai dạng');
      return tt;
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

  async function nap() {
    var nho = await docNho(), dp = root.__MNCF_DU_PHONG__ || null;
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

  NAP.cho = nap().catch(function (e) { ghi('nạp lỗi: ' + (e && e.message || e)); });
})(typeof self !== 'undefined' ? self : this);
