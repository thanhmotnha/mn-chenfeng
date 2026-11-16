/*!
 * mncf-dxf.js — Một Nhà · nạp bản vẽ CAD (DXF) của nhà thiết kế (bản 1.42.0 — anh Thanh 16/11/2026: "Nạp bản vẽ CAD").
 * Đọc file DXF dạng chữ (ASCII), tìm các mặt đứng RUỘT tủ (tấm ván vẽ bằng hình chữ nhật kín trên lớp nội thất), dựng lại thông số tủ
 * (khoang, đợt, ngăn kéo, suốt treo, thân dưới, chân, phào) và soát bản vẽ (chuỗi kích thước, số ghi làm tròn, ván dày lạ, đợt dài, ô thiếu đáy / nóc…).
 *
 * HÀM THUẦN: chạy được trong Node (require) lẫn trình duyệt (MNCFDxf). Không đụng DOM, không gọi mạng — file chỉ đọc trong máy.
 * Đơn vị trả ra luôn là mm. Toạ độ của dòng soát (x, y) tính từ góc dưới trái của mặt đứng đó.
 *
 * Giới hạn đã biết (đọc file mẫu tự tạo, chưa đọc đủ kiểu bản vẽ thật):
 *  - Tấm phải là hình chữ nhật (LWPOLYLINE / POLYLINE 4 đỉnh, có hay không cờ kín); tấm vẽ bằng 4 đường LINE rời không nhận.
 *  - Bản vẽ không có cánh → số cánh đoán theo bề rộng; không có mặt cắt → sâu lấy mặc định. Mọi số đoán nằm trong `doan`.
 *  - Vách lửng chia vùng ngăn kéo thành 2 cột: lõi chưa dựng được → dòng cảnh báo, dựng thành một cột.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./mncf-core.js'));
  else root.MNCFDxf = factory(root.MNCFCore);
})(typeof self !== 'undefined' ? self : this, function (Core) {
  'use strict';
  const rn = (v, d = 1) => { const k = Math.pow(10, d); return Math.round((v + Number.EPSILON) * k) / k; };
  const g = v => String(rn(v, 1)).replace('.', ',');
  const TOL = 0.6;

  /* ================= 1. GIẢI MÃ BYTE → CHỮ ================= */
  // $DWGCODEPAGE của AutoCAD → nhãn TextDecoder. Từ AC1021 (2007) DXF luôn là UTF-8.
  const TRANG_MA = { ANSI_1250: 'windows-1250', ANSI_1251: 'windows-1251', ANSI_1252: 'windows-1252', ANSI_1253: 'windows-1253', ANSI_1254: 'windows-1254', ANSI_1255: 'windows-1255', ANSI_1256: 'windows-1256', ANSI_1257: 'windows-1257', ANSI_1258: 'windows-1258', ANSI_874: 'windows-874', ANSI_932: 'shift_jis', ANSI_936: 'gbk', ANSI_949: 'euc-kr', ANSI_950: 'big5', UTF8: 'utf-8' };      // DOS437 (cp437) không có trong TextDecoder → rơi về windows-1252 + lưu ý
  const TEN_BAN = { AC1009: 'R12', AC1012: 'R13', AC1014: 'R14', AC1015: '2000', AC1018: '2004', AC1021: '2007', AC1024: '2010', AC1027: '2013', AC1032: '2018' };
  const LoiFile = function (cau) { this.cau = cau; };
  const latin1 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return s; };
  const tim1 = (s, ten) => { const m = new RegExp('\\r?\\n\\s*9\\r?\\n\\' + ten + '\\r?\\n\\s*\\d+\\r?\\n([^\\r\\n]*)').exec(s); return m ? m[1].trim() : ''; };

  /** buf (ArrayBuffer | Uint8Array | Buffer | string) → { chu, ban, trang_ma, ghi: [câu lưu ý] }; file DWG / DXF nhị phân / không phải DXF → ném LoiFile. */
  function giaiMa(buf) {
    const ghi = [];
    if (typeof buf === 'string') {
      const ban = tim1(buf.slice(0, 200000), '$ACADVER');
      return { chu: buf, ban, trang_ma: tim1(buf.slice(0, 200000), '$DWGCODEPAGE'), ghi };
    }
    let u8 = buf instanceof Uint8Array ? buf : (buf && typeof buf.byteLength === 'number') ? new Uint8Array(buf) : null;
    if (!u8) throw new LoiFile('Không đọc được file (dữ liệu trống).');
    if (!u8.length) throw new LoiFile('File trống.');
    const dau = latin1(u8.subarray(0, Math.min(u8.length, 4096)));
    if (/^AutoCAD Binary DXF/.test(dau)) throw new LoiFile('Đây là DXF dạng nhị phân — mở bằng AutoCAD rồi Save As → DXF (chọn dạng ASCII).');
    if (/^AC10\d\d/.test(dau)) throw new LoiFile('Đây là file DWG — mở bằng AutoCAD (hoặc phần mềm CAD khác) rồi Save As → DXF.');
    if (dau.indexOf('\0') >= 0) throw new LoiFile('File không phải DXF dạng chữ (có byte nhị phân). Mở bằng CAD rồi Save As → DXF.');
    const dauDai = latin1(u8.subarray(0, Math.min(u8.length, 200000)));
    const ban = tim1(dauDai, '$ACADVER'), cp = tim1(dauDai, '$DWGCODEPAGE').toUpperCase();
    let nhan = 'utf-8';
    if (ban && ban < 'AC1021') nhan = TRANG_MA[cp] || (cp ? '' : 'windows-1252');
    if (!nhan) { ghi.push(`Bảng mã ${cp} chưa biết — đọc chữ theo windows-1252 (chữ có dấu có thể sai).`); nhan = 'windows-1252'; }
    if (u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF) { u8 = u8.subarray(3); nhan = 'utf-8'; }
    let chu;
    try { chu = new TextDecoder(nhan).decode(u8); }
    catch (e) { ghi.push(`Máy không giải được bảng mã ${nhan} — đọc theo windows-1252.`); chu = latin1(u8); }
    return { chu, ban, trang_ma: cp, ghi };
  }

  /* ================= 2. CẶP MÃ NHÓM ================= */
  const thoat = s => s.replace(/\\U\+([0-9A-Fa-f]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
  /** chữ DXF → { ma: Int32Array-like[], gt: string[] } */
  function capMa(chu) {
    const d = chu.split(/\r\n|\n|\r/), ma = [], gt = [];
    for (let i = 0; i + 1 < d.length; i += 2) {
      const c = parseInt(d[i], 10);
      if (!isFinite(c)) { // file hỏng dòng: dò tới dòng mã kế tiếp
        if (!ma.length) throw new LoiFile('File không phải DXF (không có cặp mã nhóm ở đầu file).');
        i--; continue;
      }
      ma.push(c); gt.push(d[i + 1]);
    }
    return { ma, gt };
  }

  /* ================= 3. ĐỌC MÔ HÌNH ================= */
  const so = (v, d) => { const x = parseFloat(v); return isFinite(x) ? x : d; };
  // gom một thực thể (mã 0 … trước mã 0 kế tiếp) thành { type, g: [[mã, giá trị]] }
  function docThucThe(C, i) {
    const r = { type: C.gt[i].trim(), g: [] }; i++;
    while (i < C.ma.length && C.ma[i] !== 0) { r.g.push([C.ma[i], C.gt[i]]); i++; }
    return [r, i];
  }
  const lay = (r, c, d) => { for (const [k, v] of r.g) if (k === c) return v; return d; };
  const layS = (r, c, d) => so(lay(r, c, undefined), d);
  const layChu = (r, c, d) => { const v = lay(r, c, undefined); return v === undefined ? d : thoat(v); };

  function chuyen(r, vert) {
    const L = lay(r, 8, '0').trim() || '0', ez = layS(r, 230, 1);
    const e = { type: r.type, layer: thoat(L), paper: layS(r, 67, 0) === 1, lat: ez < 0 };
    const T = r.type;
    if (T === 'LWPOLYLINE') {
      const pts = []; let cong = false;
      for (const [k, v] of r.g) { if (k === 10) pts.push([so(v, 0), 0]); else if (k === 20 && pts.length) pts[pts.length - 1][1] = so(v, 0); else if (k === 42 && Math.abs(so(v, 0)) > 1e-9) cong = true; }
      e.pts = pts; e.kin = (layS(r, 70, 0) & 1) === 1; e.cong = cong;
      if (e.lat) e.pts = pts.map(p => [-p[0], p[1]]);
    } else if (T === 'POLYLINE') {
      const f = layS(r, 70, 0);
      e.pts = (vert || []).filter(v => !(layS(v, 70, 0) & 16)).map(v => [layS(v, 10, 0), layS(v, 20, 0)]);
      e.kin = (f & 1) === 1; e.bo = (f & (16 | 64)) !== 0;
      e.cong = (vert || []).some(v => Math.abs(layS(v, 42, 0)) > 1e-9);
      if (e.lat) e.pts = e.pts.map(p => [-p[0], p[1]]);
    } else if (T === 'LINE') {
      e.pts = [[layS(r, 10, 0), layS(r, 20, 0)], [layS(r, 11, 0), layS(r, 21, 0)]];
    } else if (T === 'CIRCLE' || T === 'ARC') {
      e.c = [layS(r, 10, 0) * (e.lat ? -1 : 1), layS(r, 20, 0)]; e.r = layS(r, 40, 0);
    } else if (T === 'TEXT' || T === 'ATTRIB') {
      const ca = layS(r, 72, 0) || layS(r, 73, 0);
      e.p = ca ? [layS(r, 11, layS(r, 10, 0)), layS(r, 21, layS(r, 20, 0))] : [layS(r, 10, 0), layS(r, 20, 0)];
      if (e.lat) e.p = [-e.p[0], e.p[1]];
      e.h = layS(r, 40, 0); e.text = docText(layChu(r, 1, '')); e.can = layS(r, 72, 0);
    } else if (T === 'MTEXT') {
      let s = ''; for (const [k, v] of r.g) if (k === 3) s += v; s += lay(r, 1, '');
      e.p = [layS(r, 10, 0), layS(r, 20, 0)]; e.h = layS(r, 40, 0); e.text = docMText(thoat(s)); e.dinh = layS(r, 71, 1); e.rong = layS(r, 41, 0);
    } else if (T === 'DIMENSION') {
      e.khoi = layChu(r, 2, ''); e.kieu_dim = layChu(r, 3, ''); e.loai = layS(r, 70, 0) & 7;
      e.p10 = [layS(r, 10, 0), layS(r, 20, 0)]; e.p13 = [layS(r, 13, 0), layS(r, 23, 0)]; e.p14 = [layS(r, 14, 0), layS(r, 24, 0)];
      e.do = layS(r, 42, NaN); e.ghi = layChu(r, 1, ''); e.goc = layS(r, 50, 0);
    } else if (T === 'INSERT') {
      e.name = layChu(r, 2, '').trim(); e.p = [layS(r, 10, 0), layS(r, 20, 0)];
      e.sx = layS(r, 41, 1); e.sy = layS(r, 42, 1); e.rot = layS(r, 50, 0);
    }
    return e;
  }

  // đọc chuỗi thực thể tới ENDSEC / ENDBLK; POLYLINE gom VERTEX; ATTRIB (thuộc tính của khối chèn — tên tờ thường nằm ở khung tên) đọc như TEXT, bỏ thuộc tính ẩn
  function docDS(C, i, het) {
    const ds = [];
    while (i < C.ma.length) {
      if (C.ma[i] !== 0) { i++; continue; }
      const T = C.gt[i].trim();
      if (het.indexOf(T) >= 0) return [ds, i];
      let r; [r, i] = docThucThe(C, i);
      if (T === 'POLYLINE') {
        const v = [];
        while (i < C.ma.length && C.ma[i] === 0 && C.gt[i].trim() === 'VERTEX') { let x; [x, i] = docThucThe(C, i); v.push(x); }
        if (i < C.ma.length && C.ma[i] === 0 && C.gt[i].trim() === 'SEQEND') { let x; [x, i] = docThucThe(C, i); }
        ds.push(chuyen(r, v)); continue;
      }
      if (T === 'SEQEND' || T === 'VERTEX' || T === 'ATTDEF') continue;
      if (T === 'ATTRIB' && (layS(r, 70, 0) & 1)) continue;
      ds.push(chuyen(r));
    }
    return [ds, i];
  }

  /** chữ DXF → { header, lop: {tên: {}}, kieu_dim: {tên: {dec}}, khoi: {tên: {base, ds}}, ds } */
  function docMoHinh(chu) {
    const C = capMa(chu);
    const header = {}, lop = {}, kieuDim = {}, khoi = {}, kieuChu = []; let ds = [];
    let i = 0, coDauMuc = false, coEOF = false, entHet = true;
    while (i < C.ma.length) {
      if (C.ma[i] === 0 && C.gt[i].trim() === 'EOF') { coEOF = true; break; }
      if (!(C.ma[i] === 0 && C.gt[i].trim() === 'SECTION')) { i++; continue; }
      coDauMuc = true;
      const ten = C.ma[i + 1] === 2 ? C.gt[i + 1].trim() : ''; i += 2;
      if (ten === 'HEADER') {
        let bien = null;
        while (i < C.ma.length && !(C.ma[i] === 0 && C.gt[i].trim() === 'ENDSEC')) {
          if (C.ma[i] === 9) { bien = C.gt[i].trim(); header[bien] = []; } else if (bien) header[bien].push([C.ma[i], C.gt[i]]);
          i++;
        }
      } else if (ten === 'TABLES') {
        while (i < C.ma.length && !(C.ma[i] === 0 && C.gt[i].trim() === 'ENDSEC')) {
          if (C.ma[i] === 0 && (C.gt[i].trim() === 'LAYER' || C.gt[i].trim() === 'DIMSTYLE' || C.gt[i].trim() === 'STYLE')) {
            let r; const T = C.gt[i].trim(); [r, i] = docThucThe(C, i);
            const n = layChu(r, 2, '');
            if (T === 'LAYER' && n) lop[n] = { mau: layS(r, 62, 7), tat: layS(r, 62, 7) < 0, dong: (layS(r, 70, 0) & 1) === 1 };
            if (T === 'DIMSTYLE' && n) kieuDim[n] = { dec: layS(r, 271, NaN), lfac: layS(r, 144, NaN) };
            if (T === 'STYLE') kieuChu.push({ ten: n, font: layChu(r, 3, '') + ' ' + layChu(r, 4, '') });
            continue;
          }
          i++;
        }
      } else if (ten === 'BLOCKS') {
        while (i < C.ma.length && !(C.ma[i] === 0 && C.gt[i].trim() === 'ENDSEC')) {
          if (C.ma[i] === 0 && C.gt[i].trim() === 'BLOCK') {
            let r; [r, i] = docThucThe(C, i);
            const n = layChu(r, 2, '').trim(); let b;
            [b, i] = docDS(C, i, ['ENDBLK', 'ENDSEC']);
            if (i < C.ma.length && C.gt[i].trim() === 'ENDBLK') { let x; [x, i] = docThucThe(C, i); }
            khoi[n] = { base: [layS(r, 10, 0), layS(r, 20, 0)], ds: b };
            continue;
          }
          i++;
        }
      } else if (ten === 'ENTITIES') {
        [ds, i] = docDS(C, i, ['ENDSEC']);
        entHet = i < C.ma.length;      // không gặp ENDSEC của ENTITIES = file bị cắt giữa chừng
      }
      while (i < C.ma.length && !(C.ma[i] === 0 && C.gt[i].trim() === 'ENDSEC')) i++;
      i++;
    }
    if (!coDauMuc) throw new LoiFile('File không phải DXF (không có SECTION).');
    return { header, lop, kieu_dim: kieuDim, kieu_chu: kieuChu, khoi, ds, cut: !coEOF || !entHet };
  }

  /* ================= chữ MTEXT / TEXT ================= */
  /** bỏ mã định dạng của MTEXT: \P xuống dòng, \f…; \H…; \C…; {…}, \S a^b; … */
  function docMText(s) {
    let o = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '{' || c === '}') continue;
      if (c !== '\\') { o += c; continue; }
      const d = s[i + 1];
      if (d === undefined) break;
      if (d === 'P' || d === 'N') { o += '\n'; i++; continue; }
      if (d === '~') { o += ' '; i++; continue; }
      if (d === '\\' || d === '{' || d === '}') { o += d; i++; continue; }
      if ('LlOoKkX'.indexOf(d) >= 0) { i++; continue; }
      if (d === 'S') { const j = s.indexOf(';', i); const t = s.slice(i + 2, j < 0 ? s.length : j); o += t.replace(/[\^#]/, '/').replace(/\^/g, ''); i = j < 0 ? s.length : j; continue; }
      if ('fFHWQTACcp'.indexOf(d) >= 0) { const j = s.indexOf(';', i); i = j < 0 ? s.length : j; continue; }
      if (d === 'U' || d === 'M') { o += c; continue; }
      o += d; i++;
    }
    return o.replace(/\^J/g, '\n').replace(/\^I/g, ' ').replace(/\^ /g, '^').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
  }
  // TEXT: %%c = Ø, %%d = °, %%p = ±, %%u / %%o gạch chân / trên
  const docText = s => s.replace(/%%[cC]/g, 'Ø').replace(/%%[dD]/g, '°').replace(/%%[pP]/g, '±').replace(/%%[uUoOkK]/g, '').replace(/%%%/g, '%').trim();
  /** chữ → không dấu, chữ thường, một dấu cách (so khớp từ khoá) */
  const boDau = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim();
  const NFC = s => String(s || '').normalize('NFC');

  /* ================= 4. LÀM PHẲNG KHỐI ================= */
  const nhan = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
  const ap = (M, p) => [M[0] * p[0] + M[2] * p[1] + M[4], M[1] * p[0] + M[3] * p[1] + M[5]];
  const I0 = [1, 0, 0, 1, 0, 0];
  function maTranChen(e, base) {
    const r = e.rot * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    let M = [1, 0, 0, 1, -base[0], -base[1]];
    M = nhan([e.sx, 0, 0, e.sy, 0, 0], M);
    M = nhan([c, s, -s, c, 0, 0], M);
    M = nhan([1, 0, 0, 1, e.p[0], e.p[1]], M);
    if (e.lat) M = nhan([-1, 0, 0, 1, 0, 0], M);
    return M;
  }
  const KHOI_MAX = 4;
  // trần số nét sau khi bung khối: khối lồng nhau bung theo cấp số nhân (4 tầng × 40 lần chèn = 2,56 triệu bản sao từ một file 46 KB) — quá trần thì thôi bung, báo
  const NET_MAX = 400000;
  /** mô hình → danh sách nét đã đưa về toạ độ thật (WCS), khối INSERT đã bung (≤ 4 tầng). Mỗi nét có `khoi` = các chỗ chèn chứa nó. */
  function lamPhang(MH) {
    const out = { net: [], chu: [], dim: [], chen: [], tron: [], loi: [] };
    let canhBaoSau = false, demChen = 0, dem = 0, tran = false;
    const di = (ds, M, sau, lopCha, duong) => {
      for (const e of ds) {
        if (e.paper) continue;
        if (++dem > NET_MAX) { tran = true; return; }
        const L = (e.layer === '0' && lopCha) ? lopCha : e.layer;
        if (e.type === 'INSERT') {
          const b = MH.khoi[e.name];
          if (!b || /^\*[DT]/i.test(e.name) || /^\*(MODEL|PAPER)_SPACE/i.test(e.name)) continue;
          if (sau >= KHOI_MAX) { canhBaoSau = true; continue; }
          const M2 = nhan(M, maTranChen(e, b.base));
          const ch = { id: demChen++, name: e.name, layer: L, sau, x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, coTron: false, coTam: false };
          out.chen.push(ch);
          di(b.ds, M2, sau + 1, L, duong.concat([ch]));
          continue;
        }
        const mo = (pts) => { for (const ch of duong) for (const p of pts) { if (p[0] < ch.x0) ch.x0 = p[0]; if (p[0] > ch.x1) ch.x1 = p[0]; if (p[1] < ch.y0) ch.y0 = p[1]; if (p[1] > ch.y1) ch.y1 = p[1]; } };
        if (e.type === 'LWPOLYLINE' || e.type === 'POLYLINE' || e.type === 'LINE') {
          if (e.bo) continue;
          const pts = e.pts.map(p => ap(M, p));
          out.net.push({ layer: L, pts, kin: !!e.kin, cong: !!e.cong, line: e.type === 'LINE', khoi: duong });
          mo(pts);
        } else if (e.type === 'CIRCLE' || e.type === 'ARC') {
          const c = ap(M, e.c), k = Math.sqrt(Math.abs(M[0] * M[3] - M[1] * M[2])), r = e.r * k;
          out.tron.push({ layer: L, c, r, khoi: duong });
          for (const ch of duong) ch.coTron = true;
          mo([[c[0] - r, c[1] - r], [c[0] + r, c[1] + r]]);
        } else if (e.type === 'TEXT' || e.type === 'MTEXT' || e.type === 'ATTRIB') {
          if (!e.text) continue;
          const k = Math.sqrt(Math.abs(M[0] * M[3] - M[1] * M[2])) || 1;
          out.chu.push({ layer: L, p: ap(M, e.p), h: e.h * k, text: NFC(e.text), f: boDau(e.text), mtext: e.type === 'MTEXT', dinh: e.dinh || 0, can: e.can || 0, tu_khoi: duong.length > 0, khoi: duong, attrib: e.type === 'ATTRIB' });
        } else if (e.type === 'DIMENSION') {
          if (duong.length) continue;      // kích thước nằm trong khối: bỏ (hiếm)
          out.dim.push(Object.assign({}, e, { layer: L }));
        }
      }
    };
    di(MH.ds, I0, 0, null, []);
    if (tran) out.loi.push({ muc: 'canh_bao', cau: `Bản vẽ có hơn ${NET_MAX / 1000} nghìn nét sau khi bung các khối chèn (khối lồng nhau chèn nhiều lần) — phần sau không đọc; tách bớt tờ hoặc Explode / Purge khối thừa rồi nạp lại.` });
    if (canhBaoSau) out.loi.push({ muc: 'luu_y', cau: `Có khối lồng nhau sâu hơn ${KHOI_MAX} tầng — phần sâu hơn không đọc.` });
    return out;
  }

  /* ================= hình chữ nhật ================= */
  /** đỉnh → { x0, x1, y0, y1 } khi là hình chữ nhật thẳng trục (4 đỉnh sau khi bỏ đỉnh trùng / thẳng hàng), không thì null */
  // bỏ đỉnh trùng / đỉnh cuối trùng đầu / đỉnh thẳng hàng
  function donDinh(pts) {
    let p = pts.slice();
    const trung = (a, b) => Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01;
    p = p.filter((q, i) => i === 0 || !trung(q, p[i - 1]));
    if (p.length > 1 && trung(p[0], p[p.length - 1])) p.pop();
    for (let lap = 0; lap < 3 && p.length > 4; lap++) {
      p = p.filter((q, i) => { const a = p[(i - 1 + p.length) % p.length], b = p[(i + 1) % p.length]; return Math.abs((q[0] - a[0]) * (b[1] - a[1]) - (q[1] - a[1]) * (b[0] - a[0])) > 0.5 * Math.max(1, Math.hypot(b[0] - a[0], b[1] - a[1])); });
    }
    return p;
  }
  /** (bản 1.42.0) tấm VÁT (vách / hồi đỉnh vát của tủ dưới cầu thang): đa giác 4 – 5 đỉnh có hai cạnh thẳng trục song song cách nhau 2,5 … 60, dài ≥ 100
   *  → hình chữ nhật theo PHẦN CHUNG của hai cạnh đó (phần thấp), cờ `vat`. Không thế → null. Tấm nằm nghiêng hẳn (nóc dốc) → { nghieng: true }. */
  function hinhVat(pts) {
    const p = donDinh(pts);
    if (p.length < 4 || p.length > 5) return null;
    const doc = [], nam = [], xien = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      if (Math.abs(a[0] - b[0]) <= 0.05) doc.push({ c: a[0], lo: Math.min(a[1], b[1]), hi: Math.max(a[1], b[1]) });
      else if (Math.abs(a[1] - b[1]) <= 0.05) nam.push({ c: a[1], lo: Math.min(a[0], b[0]), hi: Math.max(a[0], b[0]) });
      else xien.push([a, b]);
    }
    let tot = null;
    const cap = (ds, dung) => { for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) {
      const A = ds[i], B = ds[j], t = Math.abs(A.c - B.c), lo = Math.max(A.lo, B.lo), hi = Math.min(A.hi, B.hi);
      if (t < MIEN_T[0] || t > MIEN_T[1] || A.hi - A.lo < 100 || B.hi - B.lo < 100 || hi - lo < 100) continue;
      if (!tot || hi - lo > tot.dai) tot = dung ? { x0: Math.min(A.c, B.c), x1: Math.max(A.c, B.c), y0: lo, y1: hi, dai: hi - lo } : { x0: lo, x1: hi, y0: Math.min(A.c, B.c), y1: Math.max(A.c, B.c), dai: hi - lo };
    } };
    cap(doc, true); cap(nam, false);
    if (tot) { delete tot.dai; tot.vat = true; return tot; }
    // tấm nằm nghiêng: hai cạnh xiên song song cách nhau 2,5 … 60, dài ≥ 100
    for (let i = 0; i < xien.length; i++) for (let j = i + 1; j < xien.length; j++) {
      const [a, b] = xien[i], [c, d] = xien[j], u = [b[0] - a[0], b[1] - a[1]], v = [d[0] - c[0], d[1] - c[1]], lu = Math.hypot(u[0], u[1]), lv = Math.hypot(v[0], v[1]);
      if (lu < 100 || lv < 100 || Math.abs(u[0] * v[1] - u[1] * v[0]) > 0.01 * lu * lv) continue;
      const kc = Math.abs((c[0] - a[0]) * u[1] - (c[1] - a[1]) * u[0]) / lu;
      if (kc >= MIEN_T[0] && kc <= MIEN_T[1]) { const xs = p.map(q => q[0]), ys = p.map(q => q[1]); return { nghieng: true, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; }
    }
    return null;
  }
  function hcn(pts) {
    const p = donDinh(pts);
    if (p.length !== 4) return null;
    for (let i = 0; i < 4; i++) { const a = p[i], b = p[(i + 1) % 4]; if (Math.abs(a[0] - b[0]) > 0.05 && Math.abs(a[1] - b[1]) > 0.05) return null; }
    const xs = p.map(q => q[0]), ys = p.map(q => q[1]);
    const r = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    if (r.x1 - r.x0 < 0.5 || r.y1 - r.y0 < 0.5) return null;
    return r;
  }

  /* ================= phân lớp ================= */
  const RE_LOP_NT = /noi ?that|noithat|furn|cabinet|joiner|mobili|\bgo\b|\bvan\b|\btu\b|家具|柜/;
  const RE_LOP_BO = /dim|kich ?thuoc|text|\bchu\b|tuong|wall|hatch|\bden\b|led|light|chieu ?sang|khuat|hidden|defpoint|khung ?ten|title|frame|border|vport|ghi ?chu|axis|truc|cua|door|thiet ?bi/;
  const RE_LOP_LED = /\bden\b|\bled\b|light|chieu ?sang/;
  const RE_LOP_KHUAT = /khuat|hidden|\ban\b/;

  const MIEN_T = [2.5, 60];       // tấm ván: cạnh ngắn 2,5 … 60
  function chonLopNoiThat(net) {
    const dem = {};
    for (const n of net) { if (n.line) continue; const r = n._r !== undefined ? n._r : hcn(n.pts); if (!r) continue; const t = Math.min(r.x1 - r.x0, r.y1 - r.y0); if (t >= MIEN_T[0] && t <= MIEN_T[1]) dem[n.layer] = (dem[n.layer] || 0) + 1; }
    const ten = Object.keys(dem);
    let lop = ten.filter(l => RE_LOP_NT.test(boDau(l)) && !RE_LOP_BO.test(boDau(l)));
    if (!lop.length) { const c = ten.filter(l => !RE_LOP_BO.test(boDau(l))).sort((a, b) => dem[b] - dem[a]); if (c.length) lop = [c[0]]; }
    return { lop, dem };
  }

  /* ================= 5. GOM MẶT ĐỨNG ================= */
  function gom(ds, tol) {
    const n = ds.length, cha = ds.map((_, i) => i);
    const goc = i => { while (cha[i] !== i) { cha[i] = cha[cha[i]]; i = cha[i]; } return i; };
    const ix = ds.map((_, i) => i).sort((a, b) => ds[a].x0 - ds[b].x0);
    for (let a = 0; a < n; a++) {
      const A = ds[ix[a]];
      for (let b = a + 1; b < n; b++) {
        const B = ds[ix[b]];
        if (B.x0 > A.x1 + tol) break;
        if (B.y0 <= A.y1 + tol && B.y1 >= A.y0 - tol) { const p = goc(ix[a]), q = goc(ix[b]); if (p !== q) cha[p] = q; }
      }
    }
    const nh = {};
    ds.forEach((r, i) => { const k = goc(i); (nh[k] = nh[k] || []).push(r); });
    return Object.values(nh);
  }
  const hop = ds => ({ x0: Math.min(...ds.map(r => r.x0)), y0: Math.min(...ds.map(r => r.y0)), x1: Math.max(...ds.map(r => r.x1)), y1: Math.max(...ds.map(r => r.y1)) });
  const trong = (p, b, m = 0) => p[0] >= b.x0 - m && p[0] <= b.x1 + m && p[1] >= b.y0 - m && p[1] <= b.y1 + m;
  // hộp gần đúng của dòng chữ (TEXT căn 72 / MTEXT điểm đính 71)
  function hopChu(c) {
    const dong = c.text.split('\n'), w = Math.max(...dong.map(s => s.length)) * c.h * 0.62, hh = dong.length * c.h * 1.4;
    let x0 = c.p[0], y1 = c.p[1] + c.h;
    if (c.mtext) { const d = c.dinh || 1, cot = (d - 1) % 3, hang = Math.floor((d - 1) / 3); x0 = c.p[0] - w * cot / 2; y1 = c.p[1] + hh * hang / 2; return { x0, x1: x0 + w, y0: y1 - hh, y1 }; }
    if (c.can === 1 || c.can === 4) x0 -= w / 2; else if (c.can === 2) x0 -= w;
    return { x0, x1: x0 + w, y0: c.p[1], y1: c.p[1] + c.h };
  }
  const RE_TEN = /(^|[^a-z])(tu|ke|vach|bep|ban|giuong|gia)([^a-z]|$)/;
  const RE_CAT = /mat cat|\bmc\b|section|\bcat\b/;

  /* ================= số ghi của kích thước ================= */
  function soGhi(d, MH, dec, lfac) {
    const b = d.khoi && MH.khoi[d.khoi];
    let t = '';
    if (b) for (const e of b.ds) if ((e.type === 'MTEXT' || e.type === 'TEXT') && e.text) { t = e.text; break; }
    const tu = s => { const m = /(-?\d+(?:[.,]\d+)?)/.exec(String(s).replace(/\s/g, '')); return m ? parseFloat(m[1].replace(',', '.')) : NaN; };
    const o = d.ghi || '';
    // chữ gõ đè (mã 1, không có "<>") → số ghi do người vẽ gõ, không phải CAD đo
    if (o && !/<>/.test(o)) { const v = tu(docMText(o)); if (isFinite(v)) return { v, chu: o, tu: 'sua' }; return null; }
    if (t) { const v = tu(t); if (isFinite(v)) return { v, chu: t, tu: 'khoi' }; }
    const m = isFinite(d.do) ? d.do : NaN; if (!isFinite(m)) return null;
    const k = Math.pow(10, dec); return { v: Math.round(m * (lfac || 1) * k) / k, chu: String(m), tu: 'do' };
  }

  /* ================= font Việt cũ (TCVN3 / VNI) ================= */
  // chữ TCVN3 (.VnTime…) / VNI (VNI-Times…) lưu thành ký tự Latin-1 lạ (¸ µ ¶ ñ ð Û…): bỏ dấu không ra chữ Việt → không nhận được tên / nhãn.
  // Chỉ dò để báo (chưa đổi bảng mã): chữ có ký tự Latin-1 không dùng trong tiếng Việt Unicode mà không có ký tự Việt thật (≥ U+0100).
  const RE_L1_LA = /[\u00A1-\u00BF\u00C4-\u00C7\u00CB\u00CE-\u00D1\u00D6-\u00D8\u00DB\u00DC\u00DE\u00DF\u00E4-\u00E7\u00EB\u00EE-\u00F1\u00F6-\u00F8\u00FB\u00FC\u00FE\u00FF]/;
  const RE_FONT_CU = /(^|[\s\\/])\.?vn[a-z]|vni[-_ ]|\bvni\b/i;
  function phongCu(MH) {
    const font = (MH.kieu_chu || []).filter(k => RE_FONT_CU.test(k.font) || RE_FONT_CU.test(k.ten)).map(k => (k.font.trim() || k.ten));
    let la = 0, viet = 0;
    const xem = ds => { for (const e of ds) if (e.text && /[^\x00-\x7f]/.test(e.text)) { if (/[\u0100-\uffff]/.test(e.text)) viet++; else if (RE_L1_LA.test(e.text)) la++; } };
    xem(MH.ds); for (const k of Object.keys(MH.khoi)) xem(MH.khoi[k].ds);
    if ((la >= 2 && la >= viet) || (font.length && la >= 1)) return `Chữ trong bản vẽ có vẻ dùng font Việt cũ TCVN3 / VNI${font.length ? ` (${[...new Set(font)].slice(0, 3).join(', ')})` : ''} — bảng chỉ hiểu chữ Unicode: tên tủ và nhãn (NGĂN KÉO, TREO, KỆ HỞ…) không nhận được. Trong CAD đổi chữ sang Unicode (Arial / Times New Roman, công cụ đổi mã của Unikey) rồi lưu lại DXF.`;
    return '';
  }

  /* ================= 6. ĐỌC FILE ================= */
  const HE_SO = { 0: 1, 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000, 14: 100 };
  /** buf → { ban, don_vi, muc, loi_file } — không bao giờ ném lỗi */
  function doc(buf, opt) {
    opt = opt || {};
    const KQ = { ban: '', don_vi: 'mm', muc: [], loi_file: [] };
    try {
      const G = giaiMa(buf);
      for (const c of G.ghi) KQ.loi_file.push({ muc: 'luu_y', cau: c });
      const MH = docMoHinh(G.chu);
      const ver = (MH.header.$ACADVER && MH.header.$ACADVER[0] && MH.header.$ACADVER[0][1].trim()) || G.ban;
      KQ.ban = ver ? ver + (TEN_BAN[ver] ? ' (AutoCAD ' + TEN_BAN[ver] + ')' : '') : '';
      const iu = MH.header.$INSUNITS ? Math.round(so(MH.header.$INSUNITS[0][1], 0)) : 0;
      let k = HE_SO[iu];
      if (k === undefined) { KQ.loi_file.push({ muc: 'canh_bao', cau: `Đơn vị bản vẽ ($INSUNITS = ${iu}) lạ — coi là mm.` }); k = 1; }
      if (iu === 0) KQ.loi_file.push({ muc: 'luu_y', cau: 'Bản vẽ không ghi đơn vị — coi là mm.' });
      KQ.don_vi_goc = { 0: 'không ghi', 1: 'inch', 2: 'feet', 4: 'mm', 5: 'cm', 6: 'm', 14: 'dm' }[iu] || String(iu);
      const decH = MH.header.$DIMDEC ? Math.round(so(MH.header.$DIMDEC[0][1], 0)) : 0;
      if (MH.cut) KQ.loi_file.push({ muc: 'loi', cau: 'File bị cắt cụt (không có dấu kết thúc EOF / ENDSEC) — tải lại hoặc lưu lại file từ CAD rồi nạp lại. Phần đọc được vẫn bày ra nhưng có thể thiếu tấm / chữ.' });
      { const f = phongCu(MH); if (f) KQ.loi_file.push({ muc: 'canh_bao', cau: f }); }
      const F = lamPhang(MH);
      KQ.loi_file.push(...F.loi);
      // hình chữ nhật của mọi nét (tính một lần — chọn lớp, gom tấm đều dùng lại)
      for (const n of F.net) n._r = n.line ? null : hcn(n.pts);
      // $INSUNITS không khớp hình (bản vẽ mm lưu bằng mẫu acad.dwt ghi inch): dò theo bề dày tấm — hệ số nào ra nhiều tấm ván 9 … 40 nhất
      {
        const ngan = F.net.filter(n => n._r).map(n => Math.min(n._r.x1 - n._r.x0, n._r.y1 - n._r.y0));
        const diem = h => ngan.reduce((c, t) => c + (t * h >= 9 && t * h <= 40 ? 1 : 0), 0);
        if (diem(k) < 3) {
          const tot = [1, 10, 25.4, 1000, 100].filter(h => h !== k).map(h => [h, diem(h)]).sort((a, b) => b[1] - a[1])[0];
          if (tot && tot[1] >= 3) {
            KQ.loi_file.push({ muc: 'canh_bao', cau: `Đơn vị ghi trong file ($INSUNITS = ${iu}, ${KQ.don_vi_goc}) không khớp hình — bề dày tấm cho thấy hình vẽ theo ${{ 1: 'mm', 10: 'cm', 25.4: 'inch', 1000: 'm', 100: 'dm' }[tot[0]]}: đọc theo đó. Kiểm lại một kích thước.` });
            k = tot[0];
          }
        }
      }
      if (k !== 1) {
        const s = p => [p[0] * k, p[1] * k];
        for (const n of F.net) { n.pts = n.pts.map(s); if (n._r) n._r = { x0: n._r.x0 * k, x1: n._r.x1 * k, y0: n._r.y0 * k, y1: n._r.y1 * k }; }
        for (const c of F.chu) { c.p = s(c.p); c.h *= k; }
        for (const c of F.tron) { c.c = s(c.c); c.r *= k; }
        for (const c of F.chen) { c.x0 *= k; c.x1 *= k; c.y0 *= k; c.y1 *= k; }
        for (const d of F.dim) { d.p10 = s(d.p10); d.p13 = s(d.p13); d.p14 = s(d.p14); d.k = k; }      // d.do giữ đơn vị bản vẽ (như số ghi) — soát nhân k một lần
      }
      const lfacH = MH.header.$DIMLFAC ? so(MH.header.$DIMLFAC[0][1], 1) : 1;
      const dec = d => { const ks = MH.kieu_dim[d.kieu_dim]; return ks && isFinite(ks.dec) ? ks.dec : decH; };
      dec.lfac = d => { const ks = MH.kieu_dim[d.kieu_dim]; const v = ks && isFinite(ks.lfac) && ks.lfac !== 0 ? ks.lfac : lfacH; return Math.abs(v) || 1; };
      timMuc(KQ, F, MH, dec, opt);
    } catch (e) {
      if (e instanceof LoiFile) KQ.loi_file.push({ muc: 'loi', cau: e.cau });
      else KQ.loi_file.push({ muc: 'loi', cau: 'Đọc file hỏng: ' + (e && e.message ? e.message : String(e)) });
    }
    return KQ;
  }

  function timMuc(KQ, F, MH, dec, opt) {
    const { lop } = chonLopNoiThat(F.net);
    if (!lop.length) { KQ.loi_file.push({ muc: 'loi', cau: 'Không thấy lớp nội thất nào có tấm ván (hình chữ nhật dày 2,5 … 60). Tấm phải vẽ bằng polyline kín.' }); return; }
    const laNT = l => lop.indexOf(l) >= 0;
    // bỏ dấu tên lớp một lần cho mỗi lớp (file lớn: hàng chục nghìn nét, vài chục lớp)
    const bdL = new Map(), bdLop = l => { let v = bdL.get(l); if (v === undefined) { v = boDau(l); bdL.set(l, v); } return v; };
    const lopLED = l => RE_LOP_LED.test(bdLop(l)), lopKhuat = l => RE_LOP_KHUAT.test(bdLop(l));
    // hình chữ nhật trên lớp nội thất (bỏ trùng); tấm vát → chữ nhật theo phần thấp (cờ vat); tấm nằm nghiêng → chỉ đếm (nghieng)
    const daCo = new Set(), R = [], soLine = { nt: 0 }, nghieng = [];
    for (const n of F.net) {
      if (!laNT(n.layer)) continue;
      if (n.line || n.pts.length === 2) { soLine.nt++; continue; }
      let r = n._r !== undefined ? n._r : hcn(n.pts), vat = false;
      if (!r) { const q = hinhVat(n.pts); if (!q) continue; if (q.nghieng) { nghieng.push(q); continue; } r = q; vat = true; }
      const key = [r.x0, r.x1, r.y0, r.y1].map(v => Math.round(v * 2)).join(',');
      if (daCo.has(key)) continue; daCo.add(key);
      const t = Math.min(r.x1 - r.x0, r.y1 - r.y0);
      R.push({ x0: r.x0, x1: r.x1, y0: r.y0, y1: r.y1, tam: t >= MIEN_T[0] && t <= MIEN_T[1], cong: n.cong, vat });
    }
    const khuat = [];
    for (const n of F.net) if (lopKhuat(n.layer) && !n.line) { const r = n._r; if (r) khuat.push(r); }
    // suốt treo: khối chèn mảnh, dài, không chứa tấm nội thất
    const chenTam = new Set();
    for (const n of F.net) if (laNT(n.layer)) for (const ch of n.khoi) chenTam.add(ch.id);
    const suot = F.chen.filter(ch => isFinite(ch.x0) && !chenTam.has(ch.id) && (() => {
      const w = ch.x1 - ch.x0, h = ch.y1 - ch.y0, ten = boDau(ch.name);
      return (/suot|thanh treo|treo|rail|hanger/.test(ten) && w > h) || (h <= 70 && w >= 250 && w / Math.max(h, 1) >= 6);
    })());
    // gom mặt đứng: mọi hình chữ nhật chạm nhau (như ≤ 1.41). (bản 1.42.0) trong một nhóm, tách theo TẤM VÁN: tấm ốp dày (ốp tường phía sau) không nối
    // hai khối tủ — nhóm tách được thành ≥ 2 khối dạng thùng (≥ 2 tấm đứng cao) thì giữ các khối (tên quyết định sau: bếp / vách ghép lại như cũ)
    const cham = (a, c, m) => a.x0 <= c.x1 + m && a.x1 >= c.x0 - m && a.y0 <= c.y1 + m && a.y1 >= c.y0 - m;
    const du = v => v.ds.filter(r => r.tam).length >= 3 && v.b.x1 - v.b.x0 >= 150 && v.b.y1 - v.b.y0 >= 150;
    const nhomTam = gom(R, 2).map(ds => ({ ds, b: hop(ds) }));
    const nhom = [];
    nhomTam.filter(du).forEach((G, gi) => {
      G.goc = gi;
      const sub = gom(G.ds.filter(r => r.tam), 2).filter(ds => ds.length >= 3).map(ds => ({ ds, b: hop(ds), goc: gi, G }));
      //   tấm phụ theo khối có tấm chạm nó: nằm (rộng > cao) dày ≤ 200 — xà chân, phào trên; đứng chỉ ≤ 100 (cột ốp dày hai bên không phải của tủ)
      for (const r of G.ds) if (!r.tam && Math.min(r.x1 - r.x0, r.y1 - r.y0) <= (r.x1 - r.x0 > r.y1 - r.y0 ? 200 : 100)) {
        const v = sub.find(v => cham(r, v.b, 2) && v.ds.some(q => q.tam && cham(r, q, 2)));
        if (v) { v.ds.push(r); v.b = hop([v.b, r]); }
      }
      const thung = v => { const H = v.b.y1 - v.b.y0; return v.ds.filter(r => r.tam && r.y1 - r.y0 > r.x1 - r.x0 && r.y1 - r.y0 >= 0.6 * H).length >= 2; };
      const ok = sub.filter(du);
      if (ok.length >= 2 && ok.every(thung)) nhom.push(...ok); else nhom.push(G);
    });
    // chữ: chữ thường + chữ trong khối có tấm nội thất (mặt đứng gói trong khối) + thuộc tính khối (ATTRIB — tên tờ ở khung tên)
    const chu = F.chu.filter(c => !c.tu_khoi || c.khoi.some(ch => chenTam.has(ch.id)) || c.attrib);
    for (const c of chu) { const hb = hopChu(c); c.hb = hb; c.tam = [(hb.x0 + hb.x1) / 2, (hb.y0 + hb.y1) / 2]; }      // TÂM chữ (chữ căn trái đặt ngay mặt vách vẫn rơi đúng khoang)
    // khung tờ giấy: khối chèn lớn (khung tên) / hình chữ nhật lớn không thuộc lớp nội thất — tên tờ thường nằm ở góc tờ, không ngay dưới hình
    const khung = [];
    for (const ch of F.chen) if (ch.sau === 0 && isFinite(ch.x0) && !chenTam.has(ch.id) && ch.x1 - ch.x0 >= 1500 && ch.y1 - ch.y0 >= 1000) khung.push({ x0: ch.x0, x1: ch.x1, y0: ch.y0, y1: ch.y1 });
    for (const n of F.net) if (!laNT(n.layer) && !n.line && !n.khoi.length) { const r = n._r; if (r && r.x1 - r.x0 >= 1500 && r.y1 - r.y0 >= 1000) khung.push(r); }
    const chua = (k, b) => b.x0 >= k.x0 - 1 && b.x1 <= k.x1 + 1 && b.y0 >= k.y0 - 1 && b.y1 <= k.y1 + 1;
    const dt = k => (k.x1 - k.x0) * (k.y1 - k.y0);
    const mat = [], cat = [];
    if (nhom.length) {
      if (soLine.nt > R.length) KQ.loi_file.push({ muc: 'luu_y', cau: `Lớp nội thất có ${soLine.nt} nét thẳng rời — tấm vẽ bằng nét rời không đọc được, chỉ đọc hình chữ nhật.` });
      // nhãn: chữ trong hình, hoặc sát hai bên hình (≤ 500, ghi chú kéo ra ngoài) mà không phải tên tủ
      const nhanCua = b => chu.filter(c => trong(c.tam, b, 5) || (!RE_TEN.test(c.f) && c.tam[1] >= b.y0 && c.tam[1] <= b.y1 && c.tam[0] >= b.x0 - 500 && c.tam[0] <= b.x1 + 500));
      for (const v of nhom) v.nhan = nhanCua(v.b);
      const laNhan = new Set(); for (const v of nhom) for (const c of v.nhan) laNhan.add(c);
      const ungVien = chu.filter(c => !laNhan.has(c) && RE_TEN.test(c.f));
      // mặt cắt (cho chiều sâu): nhóm có chữ "mặt cắt" ở gần
      for (const v of nhom) v.cat = chu.some(c => RE_CAT.test(c.f) && trong(c.tam, v.b, 400) && !RE_TEN.test(c.f.replace(RE_CAT, '')));
      for (const v of nhom) (v.cat ? cat : mat).push(v);
      for (const v of mat) {
        v.khung = khung.filter(k => chua(k, v.b)).sort((a, c) => dt(a) - dt(c))[0] || null;
        let tot = null, dTot = Infinity;
        const cx0 = v.b.x0, cx1 = v.b.x1, H = v.b.y1 - v.b.y0;
        for (const c of ungVien) {
          if (khung.some(k => trong(c.tam, k) && !chua(k, v.b))) continue;      // tên của tờ khác
          const ox = Math.min(cx1, c.hb.x1) - Math.max(cx0, c.hb.x0);
          if (ox < -0.25 * (cx1 - cx0)) continue;
          let d = c.hb.y1 <= v.b.y0 + 1 ? v.b.y0 - c.hb.y1 : c.hb.y0 >= v.b.y1 - 1 ? (c.hb.y0 - v.b.y1) * 1.6 + 200 : Infinity;
          if (d > Math.max(2500, 1.2 * H)) continue;
          d -= c.h * 2;      // chữ to hơn được ưu tiên
          if (d < dTot) { dTot = d; tot = c; }
        }
        if (!tot && v.khung) { tot = ungVien.filter(c => trong(c.tam, v.khung)).sort((a, c) => c.h - a.h || a.p[1] - c.p[1])[0] || null; v.tenTo = !!tot; }      // tên to nhất của tờ
        v.ten = tot;
        // mặt cắt gần nhất cùng hàng, cao xấp xỉ
        let mc = null, dm = Infinity;
        for (const c of cat) { const dx = Math.max(c.b.x0 - v.b.x1, v.b.x0 - c.b.x1); const hc = c.b.y1 - c.b.y0; if (dx < 3000 && Math.abs(hc - H) < 0.2 * H && dx < dm) { dm = dx; mc = c; } }
        if (mc) v.sau = rn(mc.b.x1 - mc.b.x0, 1);
      }
      if (typeof opt.dbg === 'function') opt.dbg(mat, cat);
      // khối tách từ cùng một nhóm: chỉ giữ tách khi tên là tủ / kệ (hộc sàn + hộc treo tường chung một tấm ốp); bếp, vách, bàn… ghép lại như cũ
      for (const gi of [...new Set(mat.map(v => v.goc))]) {
        const ds = mat.filter(v => v.goc === gi); if (ds.length < 2) continue;
        const coTen = ds.filter(v => v.ten), giu = coTen.length && coTen.every(v => loaiCua(v.ten.text, v.nhan.map(c => ({ f: c.f }))) === 'tu');
        if (giu) { for (const v of ds) if (!v.ten) { v.ten = coTen[0].ten; v.tenTo = coTen[0].tenTo; } continue; }
        const A = ds.find(v => v.ten) || ds[0];      // ghép lại = cả nhóm gốc (kể cả tấm ốp dày đã bỏ khi tách)
        for (const B of ds) if (B !== A) { A.sau = A.sau || B.sau; mat.splice(mat.indexOf(B), 1); }
        A.ds = A.G.ds; A.b = A.G.b; A.nhan = nhanCua(A.b);
        A.khung = khung.filter(k => chua(k, A.b)).sort((a, c) => dt(a) - dt(c))[0] || null;
      }
      // (bản 1.42.0) MẶT BÊN không ghi chữ "mặt cắt": nhóm X không có tên riêng (tên của tờ / tên mượn của mặt đứng bên cạnh), cao bằng mặt đứng V (± 2 %),
      // rộng 350 … 750 và < nửa V, cùng tờ (hoặc cùng hàng, cách < 3000) → chiều sâu của V, không thành tủ riêng. Bản vẽ không nói sâu thùng hay cả phần trước → dòng vàng.
      for (const X of mat.slice()) {
        const wX = X.b.x1 - X.b.x0, hX = X.b.y1 - X.b.y0;
        if (wX < 350 || wX > 750) continue;
        if (X.ten && !X.tenTo && !mat.some(V => V !== X && V.ten === X.ten)) continue;
        let tot = null, dTot = Infinity;
        for (const V of mat) {
          if (V === X || mat.indexOf(V) < 0) continue;
          const wV = V.b.x1 - V.b.x0, hV = V.b.y1 - V.b.y0;
          if (Math.abs(hX - hV) > 0.02 * hV || wX >= 0.5 * wV) continue;
          const dx = Math.max(X.b.x0 - V.b.x1, V.b.x0 - X.b.x1);
          if (X.khung !== V.khung || dx > 3000) continue;
          if (Math.abs(X.b.y0 - V.b.y0) > 0.1 * hV) continue;
          if (dx < dTot) { dTot = dx; tot = V; }
        }
        if (!tot) continue;
        const ds = F.dim.filter(d => (d.loai === 0 || d.loai === 1) && trong(d.p13, X.b, 60) && trong(d.p14, X.b, 60)).map(d => ({ lo: Math.min(d.p13[0], d.p14[0]), hi: Math.max(d.p13[0], d.p14[0]) })).filter(q => q.hi - q.lo > 1 && q.hi - q.lo < wX - 1).sort((a, c) => a.lo - c.lo);
        const doanD = []; for (const q of ds) if (!doanD.some(o => Math.abs(o.lo - q.lo) < 1 && Math.abs(o.hi - q.hi) < 1)) doanD.push(q);
        if (!tot.sau) { tot.sau = rn(wX, 1); tot.sauBen = `Sâu ${g(tot.sau)} lấy theo bề rộng mặt bên (hình cạnh mặt đứng, cùng cao)${doanD.length > 1 ? ` — mặt bên chia ${doanD.map(q => g(q.hi - q.lo)).join(' + ')}` : ''}: sâu thùng hay gồm cả phần trước (cánh / dải trước)? kiểm lại`; }
        X.ben = tot; mat.splice(mat.indexOf(X), 1);
      }
      // bếp: tủ dưới và tủ trên cách nhau mảng tường ốp → hai nhóm chồng nhau cùng một tên → gộp thành một mặt đứng
      for (let i = 0; i < mat.length; i++) for (let j = mat.length - 1; j > i; j--) {
        const A = mat[i], B = mat[j];
        if (!A.ten || A.ten !== B.ten || loaiCua(A.ten.text, A.nhan.map(c => ({ f: c.f }))) !== 'bep') continue;
        const ox = Math.min(A.b.x1, B.b.x1) - Math.max(A.b.x0, B.b.x0), gap = Math.max(A.b.y0 - B.b.y1, B.b.y0 - A.b.y1);
        if (ox < 0.5 * Math.min(A.b.x1 - A.b.x0, B.b.x1 - B.b.x0) || gap > 1500) continue;
        A.ds = A.ds.concat(B.ds); A.b = hop([A.b, B.b]); A.nhan = A.nhan.concat(B.nhan); A.sau = A.sau || B.sau; mat.splice(j, 1);
      }
    }
    // (bản 1.42.0) tờ có tên mà không mặt đứng nào đọc được (tấm ốp dày, chỉ 1 – 2 tấm ván) → vẫn một mục, nói lý do: số mục khớp số tờ
    const toTrong = [];
    { const dung = [];
      const ks = khung.slice().sort((a, c) => dt(a) - dt(c));
      for (const k of ks) {
        if (dung.some(u => chua(k, u)) || nhomTam.some(v => v.ds.filter(r => r.tam).length >= 3 && trong([(v.b.x0 + v.b.x1) / 2, (v.b.y0 + v.b.y1) / 2], k))) continue;
        const rs = R.filter(r => chua(k, r)); if (!rs.length) continue;
        const tenC = chu.filter(c => RE_TEN.test(c.f) && trong(c.tam, k)).sort((a, c) => c.h - a.h)[0]; if (!tenC) continue;
        dung.push(k); toTrong.push({ k, rs, ten: tenC });
      }
    }
    if (!mat.length && !toTrong.length) { KQ.loi_file.push({ muc: 'loi', cau: 'Không tìm thấy mặt đứng tủ nào (cần ít nhất 3 tấm ván liền nhau).' }); return; }
    // đánh số các mặt đứng chung một tên
    mat.sort((a, b) => (a.b.y0 - b.b.y0 > 3000 ? 1 : b.b.y0 - a.b.y0 > 3000 ? -1 : a.b.x0 - b.b.x0));
    const demTen = new Map(), khoaTen = v => (v.ten ? v.ten.text.replace(/\s+/g, ' ').trim().toUpperCase() : '');
    for (const v of mat) if (v.ten) demTen.set(khoaTen(v), (demTen.get(khoaTen(v)) || 0) + 1);
    const thu = new Map();
    // kích thước theo mặt đứng
    const dims = F.dim.filter(d => d.loai === 0 || d.loai === 1);
    for (const v of mat) v.dim = [];
    for (const d of dims) {
      let tot = null;
      for (const v of mat) if (trong(d.p13, v.b, 60) && trong(d.p14, v.b, 60)) { if (!tot || (v.b.x1 - v.b.x0) * (v.b.y1 - v.b.y0) < (tot.b.x1 - tot.b.x0) * (tot.b.y1 - tot.b.y0)) tot = v; }
      if (tot) tot.dim.push(d);
    }
    const ctx0 = { F, MH, dec, khuat, suot, led: F.net.filter(n => lopLED(n.layer)), nghieng, laNT, opt };
    let stt = 0;
    for (const v of mat) {
      stt++;
      let ten = v.ten ? v.ten.text.replace(/\s*\n\s*/g, ' ').trim() : `Mặt đứng ${stt}`;
      if (v.ten && demTen.get(khoaTen(v)) > 1) { const n = (thu.get(khoaTen(v)) || 0) + 1; thu.set(khoaTen(v), n); ten += ` (${n})`; }
      KQ.muc.push(dungMuc(tiLeView(v, ctx0), ten, 'D' + stt, v.ctx || ctx0));
    }
    for (const q of toTrong) {
      stt++;
      const b = hop(q.rs), W = rn(b.x1 - b.x0), H = rn(b.y1 - b.y0), day = q.rs.filter(r => !r.tam).length, mong = q.rs.filter(r => r.tam).length;
      KQ.muc.push({ id: 'D' + stt, ten: q.ten.text.replace(/\s*\n\s*/g, ' ').trim(), loai: 'khac', rong: W, cao: H, sau: null, tin_cay: 0.1, doan: [], nhan: [],
        loi: [{ muc: 'loi', cau: `Không thấy ≥ 3 tấm ván dày 2,5 … 60 liền nhau trên tờ này (${mong} tấm ván${day ? `, ${day} hình vẽ dày hơn 60 — tấm ốp / mặt hộc?` : ''}) — chưa dựng được, vẽ tay trong bảng.`, x: null, y: null }],
        hinh: { r: q.rs.slice(0, 1500).map(r => [rn(r.x0 - b.x0, 1), rn(r.y0 - b.y0, 1), rn(r.x1 - r.x0, 1), rn(r.y1 - r.y0, 1), r.tam ? 1 : 0]), c: [] } });
    }
    // bếp chữ L: hai mặt đứng bếp → thêm một mục ghép
    const bep = KQ.muc.filter(m => m.loai === 'bep' && m.bo);
    if (bep.length === 2) KQ.muc.push(ghepL(bep[0], bep[1], 'D' + (++stt)));
  }

  /** (bản 1.42.0) hình vẽ theo tỉ lệ (mọi kích thước của mặt đứng cùng DIMLFAC ≠ 1: số ghi = hình × hệ số) → nhân hình của mặt đứng đó với hệ số,
   *  soát số ghi với hình đã nhân. Trả lại chính v (đã đổi); v.ctx = ngữ cảnh đã nhân (nét khuất, suốt treo, LED quanh mặt đứng). */
  function tiLeView(v, ctx) {
    if (!v.dim.length) return v;
    const lf = [...new Set(v.dim.map(d => rn(ctx.dec.lfac(d), 4)))];
    if (lf.length !== 1 || Math.abs(lf[0] - 1) < 1e-6) return v;
    const f = lf[0], b0 = v.b, ox = b0.x0, oy = b0.y0, sp = p => [ox + (p[0] - ox) * f, oy + (p[1] - oy) * f];
    const sr = r => Object.assign({}, r, { x0: ox + (r.x0 - ox) * f, x1: ox + (r.x1 - ox) * f, y0: oy + (r.y0 - oy) * f, y1: oy + (r.y1 - oy) * f });
    v.ds = v.ds.map(r => { const q = sr(r); const t = Math.min(q.x1 - q.x0, q.y1 - q.y0); q.tam = t >= MIEN_T[0] && t <= MIEN_T[1]; return q; });
    v.b = sr(b0);
    v.nhan = v.nhan.map(c => Object.assign({}, c, { p: sp(c.p), tam: sp(c.tam), h: c.h * f }));
    v.dim = v.dim.map(d => Object.assign({}, d, { p10: sp(d.p10), p13: sp(d.p13), p14: sp(d.p14) }));
    const quanh = r => r.x0 >= b0.x0 - 30 && r.x1 <= b0.x1 + 30 && r.y0 >= b0.y0 - 30 && r.y1 <= b0.y1 + 30;
    v.ctx = Object.assign({}, ctx, { lf1: true,
      khuat: ctx.khuat.filter(quanh).map(sr), suot: ctx.suot.filter(quanh).map(sr), nghieng: ctx.nghieng.filter(quanh).map(sr),
      led: ctx.led.filter(n => n.pts.every(p => trong(p, b0, 30))).map(n => Object.assign({}, n, { pts: n.pts.map(sp) })) });
    v.tiLe = f;
    return v;
  }

  /* ================= 7. DỰNG LẠI MỘT MẶT ĐỨNG ================= */
  const CO_SAU = { tu: 580, ke: 400, bep: 560 };
  function loaiCua(ten, nhan) {
    // từ khoá ĐẦU TIÊN của tên quyết định: "VÁCH ỐP … BẾP" là vách, "TỦ BẾP" là bếp, "BÀN … BẾP" là bàn
    const f = boDau(ten), nf = nhan.map(c => c.f).join(' | ');
    const m = /(^|[^a-z])(tu|ke|vach|bep|ban|giuong|gia)([^a-z]|$)/.exec(f);
    const coBep = /chau|bon rua|tu lanh|hut mui|may rua bat|\bbep (tu|ga|dien|nau)|\bmrb\b/.test(nf);
    if (!m) return coBep ? 'bep' : 'tu';
    if (m[2] === 'bep') return 'bep';
    if (m[2] === 'tu') return /\bbep\b/.test(f) || coBep ? 'bep' : 'tu';
    return { ke: 'tu', gia: 'tu' }[m[2]] || 'khac';
  }

  function dungMuc(v, ten, id, ctx) {
    const b = v.b, W = rn(b.x1 - b.x0), H = rn(b.y1 - b.y0);
    const L = r => ({ x0: rn(r.x0 - b.x0, 1), x1: rn(r.x1 - b.x0, 1), z0: rn(r.y0 - b.y0, 1), z1: rn(r.y1 - b.y0, 1) });
    const loi = [], doan = [];
    // một câu chỉ ghi một lần (cùng mức + cùng chữ: ba kích thước giống hệt nhau cùng lệch → một dòng)
    const them = (muc, cau, x, y, them2) => { if (loi.some(l => l.muc === muc && l.cau === cau)) return; loi.push(Object.assign({ muc, cau, x: x === undefined || x === null ? null : rn(x), y: y === undefined || y === null ? null : rn(y) }, them2 || {})); };
    const nhan = v.nhan.map(c => ({ text: c.text, f: c.f, x: rn(c.tam[0] - b.x0), z: rn(c.tam[1] - b.y0) }));
    const loai = loaiCua(ten, nhan);
    const muc = { id, ten, loai, rong: W, cao: H, sau: v.sau || null, tin_cay: 1, loi, doan, nhan: nhan.map(n => n.text) };
    if (v.tiLe) them('canh_bao', `Hình vẽ theo tỉ lệ (DIMLFAC ${g(v.tiLe)}: số ghi = hình × ${g(v.tiLe)}) — đã nhân hình ${g(v.tiLe)} lần cho đúng số ghi; kiểm lại một kích thước.`);
    if (v.sauBen) doan.push(v.sauBen);
    { const vat = v.ds.filter(r => r.vat).length, ng = (ctx.nghieng || []).filter(r => trong([(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2], b, 30)).length;
      if (vat || ng) them('canh_bao', `Tủ có nóc / vách vát (${[vat ? `${vat} tấm đỉnh vát` : '', ng ? `${ng} tấm nằm nghiêng bỏ qua` : ''].filter(Boolean).join(', ')}) — dựng chữ nhật theo phần thấp, khoét vát theo bản vẽ.`); }
    // LED
    const led = ctx.led.filter(n => n.pts.every(p => trong(p, b, 30)));
    if (led.length) { const dai = led.reduce((s, n) => s + Math.hypot(n.pts[n.pts.length - 1][0] - n.pts[0][0], n.pts[n.pts.length - 1][1] - n.pts[0][1]), 0); them('luu_y', `Có ${led.length} dải đèn / LED (lớp ${[...new Set(led.map(n => n.layer))].join(', ')}, tổng dài khoảng ${g(Math.round(dai))}) — chưa dựng, ghi lại để làm điện.`); }
    const P = v.ds.map(r => Object.assign(L(r), { tam: r.tam, cong: r.cong, vat: !!r.vat })).map(r => Object.assign(r, { w: rn(r.x1 - r.x0), h: rn(r.z1 - r.z0), t: rn(Math.min(r.x1 - r.x0, r.z1 - r.z0)), dung: r.z1 - r.z0 > r.x1 - r.x0 }));
    // hình gốc cho bảng (bản 1.42.0): hình chữ nhật của mặt đứng [x, z, rộng, cao, là tấm] + chữ [x, z, chữ] — để vẽ lại nhỏ cạnh hình đứng của bảng (so mắt)
    muc.hinh = { r: P.slice(0, 1500).map(r => [r.x0, r.z0, r.w, r.h, r.tam ? 1 : 0]), c: nhan.slice(0, 80).map(n => [n.x, n.z, String(n.text).slice(0, 60)]) };
    // kích thước
    soatKichThuoc(v.dim, b, P, ctx, them);
    if (loai === 'khac') {
      them('luu_y', 'Loại này (vách / bàn / giường…) chưa dựng thành tủ — chỉ lấy kích thước.');
      muc.tin_cay = 0.3; return muc;
    }
    // bếp: chỉ cần dày ván + khoang để ước — dòng soát ruột tủ (đáy / nóc / đợt) của mặt đứng bếp là nhiễu (đá thay nóc, hốc thiết bị) → không ghi
    const D = dungTu(P, W, H, v, b, ctx, loai === 'bep' ? () => {} : them, loai === 'bep' ? [] : doan, loai);
    if (loai === 'bep') {
      if (D) { muc.cot = D.cot; muc.khoang = D.khoang; }
      muc.t = D ? D.t : mode(P.filter(p => p.tam && p.t >= 9 && p.t <= 40).map(p => p.t));
      muc.bo = dungBep(D, nhan, W, H, them, doan);
      muc.tin_cay = rn(Math.max(0.1, 0.55 - 0.05 * loi.filter(x => x.muc === 'loi').length), 2);
      return muc;
    }
    if (!D) { muc.tin_cay = 0.1; return muc; }
    muc.cot = D.cot; muc.khoang = D.khoang; muc.t = D.t;
    // ---- thông số tủ ----
    const spec = specTu(D, W, H, ten, v.sau, loai, doan, them, nhan, ctx.opt || {});
    muc.spec = spec;
    muc.sau = spec.sau_thung;
    let tc = 1;
    if (!v.ten) tc -= 0.15;
    if (D.khoang.length < 1) tc -= 0.4;
    if (!v.sau) tc -= 0.05;
    tc -= Math.min(0.3, 0.1 * loi.filter(x => x.muc === 'loi').length);
    tc -= Math.min(0.2, 0.04 * loi.filter(x => x.muc === 'canh_bao').length);
    if (Core && Core.build) {
      try {
        let M = Core.build(spec);
        // dải hộc sàn thấp: hộp ngăn kéo của Chuẩn xưởng không lọt ô → bỏ ngăn kéo (ô trống), nói rõ — không để cả tủ đỏ vì một chuyện
        if (D.thap && M.errors.length && M.errors.every(e => /ngăn kéo/.test(e))) {
          for (const k of spec.khoang) k.o = k.o.filter(o => o.kieu !== 'nk_am');
          const M2 = Core.build(spec);
          if (M2.errors.length < M.errors.length) { them('canh_bao', `Hộc sàn cao ${g(H)}: hộp ngăn kéo theo Chuẩn xưởng không lọt ô — dựng ô trống, vẽ ngăn kéo tay (hoặc nới cao).`); M = M2; }
        }
        const ds = [...new Set(M.errors)];
        for (const e of ds.slice(0, 6)) them('loi', 'Dựng thử theo Chuẩn xưởng: ' + e);
        if (ds.length > 6) them('loi', `Dựng thử theo Chuẩn xưởng: … và ${ds.length - 6} lỗi khác.`);
        if (M.errors.length) tc -= 0.25;
        muc.dung = { tam: M.parts.length, loi: M.errors.length, canh_bao: M.warnings.length };
      } catch (e) { them('loi', 'Dựng thử hỏng: ' + e.message); tc -= 0.4; }
    }
    muc.tin_cay = rn(Math.max(0.05, Math.min(1, tc)), 2);
    return muc;
  }

  /* ---- soát kích thước ---- */
  // số ghi kèm số mm khi đơn vị bản vẽ không phải mm (cm: "83 (= 830)")
  const ghiMm = q => (Math.abs((q.kq || 1) - 1) > 1e-9 ? `${g(q.sg.v)} (= ${g(q.ghi)} mm)` : g(q.sg.v));
  function soatKichThuoc(dims, b, P, ctx, them) {
    const ds = [];
    for (const d of dims) {
      let u;
      if (d.loai === 1) { const dx = d.p14[0] - d.p13[0], dy = d.p14[1] - d.p13[1], l = Math.hypot(dx, dy) || 1; u = [dx / l, dy / l]; }
      else { const a = d.goc * Math.PI / 180; u = [Math.cos(a), Math.sin(a)]; }
      const ngang = Math.abs(u[0]) > 0.999, dung = Math.abs(u[1]) > 0.999;
      if (!ngang && !dung) continue;
      const a0 = ngang ? d.p13[0] : d.p13[1], a1 = ngang ? d.p14[0] : d.p14[1];
      const hinh = Math.abs(a1 - a0);
      const sg = soGhi(d, ctx.MH, ctx.dec(d), ctx.dec.lfac(d));
      ds.push({ d, ngang, lo: Math.min(a0, a1), hi: Math.max(a0, a1), hinh, sg, lech: ngang ? d.p10[1] : d.p10[0] });
    }
    const X = p => rn(p - b.x0), Z = p => rn(p - b.y0);
    const lamTron = [];
    for (const q of ds) {
      if (!q.sg) continue;
      // DIMLFAC: số ghi = đo × hệ số (chi tiết phóng to / thu nhỏ) → so số ghi ÷ hệ số với hình; k = hệ số đổi đơn vị file → mm
      //   (bản 1.42.0) mặt đứng vẽ theo tỉ lệ đã nhân hình (ctx.lf1) → không chia nữa
      const lf = ctx.lf1 ? 1 : ctx.dec.lfac(q.d), k = (q.d.k || 1) / lf, dc = ctx.dec(q.d), buoc = Math.pow(10, -dc);
      const dl = Math.abs(q.sg.v * k - q.hinh);
      q.ghi = q.sg.v * k; q.kq = k;
      const xy = q.ngang ? [X((q.lo + q.hi) / 2), Z(q.lech)] : [X(q.lech), Z((q.lo + q.hi) / 2)];
      if (dl < 0.01) continue;
      if (dl <= buoc * k / 2 + 0.01 && q.sg.tu !== 'sua') { lamTron.push(q); continue; }
      them('loi', `Kích thước ghi ${ghiMm(q)} nhưng hình đo được ${g(q.hinh)} (lệch ${g(dl)}${q.sg.tu === 'sua' ? ' — chữ số bị gõ tay' : ''}).`, xy[0], xy[1]);
    }
    if (lamTron.length) {
      const vd = lamTron.slice(0, 6).map(q => `${ghiMm(q)} (hình ${g(q.hinh)})`).join(', ');
      them('luu_y', `${lamTron.length} kích thước ghi số làm tròn: ${vd}${lamTron.length > 6 ? ', …' : ''} — dựng theo hình.`, null, null, { lam_tron: true });
    }
    // điểm đo hụt mép tấm 0,5 … 5
    const mep = { x: [], z: [] };
    for (const p of P) { mep.x.push(p.x0, p.x1); mep.z.push(p.z0, p.z1); }
    let hut = 0; const vdHut = [];
    for (const q of ds) for (const a of [q.lo, q.hi]) {
      const v0 = q.ngang ? a - b.x0 : a - b.y0, m = q.ngang ? mep.x : mep.z;
      let dm = Infinity; for (const e of m) dm = Math.min(dm, Math.abs(e - v0));
      if (dm >= 0.5 && dm <= 5) { hut++; if (vdHut.length < 4) vdHut.push(`${q.ngang ? 'x' : 'cao'} ${g(v0)} lệch ${g(dm)}`); }
    }
    if (hut) them('canh_bao', `${hut} điểm đo của kích thước không trúng mép tấm (${vdHut.join('; ')}) — nét vẽ hoặc kích thước bị xê dịch.`);
    // chuỗi kích thước: cùng hướng, cùng đường kích thước
    const t0 = mode(P.filter(p => p.tam && p.t >= 9 && p.t <= 40).map(p => p.t)) || 17;
    for (const ngang of [true, false]) {
      const nh = [];
      for (const q of ds.filter(q => q.ngang === ngang)) { let c = nh.find(c => Math.abs(c.lech - q.lech) < 2); if (!c) { c = { lech: q.lech, ds: [] }; nh.push(c); } c.ds.push(q); }
      const ten = ngang ? 'ngang' : 'đứng', viTri = (a, c) => (ngang ? `x ${g(X(a))} … ${g(X(c))}` : `+${g(Z(a))} … +${g(Z(c))}`);
      for (const c of nh) {
        // (bản 1.42.0) kích thước tổng / tổng phụ nằm CÙNG đường (bao trọn kích thước khác của chuỗi) → không phải một đoạn của chuỗi
        const bao = c.ds.filter(q => c.ds.some(o => o !== q && o.hi - o.lo < q.hi - q.lo - 0.5 && o.lo >= q.lo - 0.5 && o.hi <= q.hi + 0.5));
        c.bao = bao; c.ds = c.ds.filter(q => bao.indexOf(q) < 0);
        if (c.ds.length < 2) continue;
        c.ds.sort((p, q) => p.lo - q.lo);
        let hoTong = 0;
        for (let i = 1; i < c.ds.length; i++) {
          const a0 = c.ds[i - 1].hi, a1 = c.ds[i].lo, ho = a1 - a0;
          if (Math.abs(ho) <= 0.5) continue;
          hoTong += ho;
          const at = ngang ? [X(a1), Z(c.lech)] : [X(c.lech), Z(a1)];
          if (ho < 0) { them('canh_bao', `Chuỗi kích thước ${ten} chồng ${g(-ho)} ở ${viTri(a1, a0)} (giữa đoạn ${g(c.ds[i - 1].hinh)} và đoạn ${g(c.ds[i].hinh)}).`, at[0], at[1]); continue; }
          // tấm nằm trong khoảng hở: tấm đứng (chuỗi ngang) / tấm nằm (chuỗi đứng) có mặt trong khoảng [a0, a1]
          const lo = ngang ? a0 - b.x0 : a0 - b.y0, hi = ngang ? a1 - b.x0 : a1 - b.y0;
          const tamHo = P.filter(p => p.tam && (ngang ? p.dung : !p.dung) && (ngang ? p.x0 : p.z0) >= lo - 0.6 && (ngang ? p.x1 : p.z1) <= hi + 0.6);
          let phu = 0; { const kh = tamHo.map(p => (ngang ? [p.x0, p.x1] : [p.z0, p.z1])).sort((u, v) => u[0] - v[0]); let e = lo; for (const [u, v] of kh) { if (v > e) { phu += v - Math.max(u, e); e = v; } } }
          const day = tamHo.length ? [...new Set(tamHo.map(p => g(p.t)))].join(' + ') : '';
          // số LỚP tấm (tấm nằm cùng cao ở nhiều khoang là một lớp)
          const lop = new Set(tamHo.map(p => (ngang ? [p.x0, p.x1] : [p.z0, p.z1]).map(v => Math.round(v)).join(':'))).size, nTam = lop > 1 ? lop + ' lớp tấm' : 'tấm';
          if (!tamHo.length || phu < 0.2 * ho) them('luu_y', `Chuỗi kích thước ${ten} để trống ${g(ho)} ở ${viTri(a0, a1)} — không có tấm (phần tường / khoảng hở giữa hai tủ?).`, at[0], at[1]);
          else if (Math.abs(phu - ho) <= 1 && tamHo.length === 2 && tamHo.every(p => Math.abs(p.t - t0) <= 1) && Math.abs(ho - 2 * t0) <= 2) them('luu_y', `Chuỗi kích thước ${ten} không ghi hai tấm áp lưng ${g(t0)} + ${g(t0)} ở ${viTri(a0, a1)} (chỗ nối hai thùng).`, at[0], at[1]);
          else if (Math.abs(phu - ho) <= 1 && c.ds.some(q => Math.abs(q.hinh - ho) <= 0.6)) them('canh_bao', `Chuỗi kích thước ${ten} thiếu đoạn ${g(ho)} ở ${viTri(a0, a1)} (${nTam} ${ngang ? 'đứng' : 'ngang'} dày ${day}${ngang ? '' : ' — thanh ray / đợt'}) — chuỗi có ghi đoạn cùng cỡ ở chỗ khác.`, at[0], at[1]);
          else if (Math.abs(phu - ho) <= 1) them('luu_y', `Chuỗi kích thước ${ten} không ghi ${nTam} dày ${day} ở ${viTri(a0, a1)}.`, at[0], at[1]);
          else them('canh_bao', `Chuỗi kích thước ${ten} hở ${g(ho)} ở ${viTri(a0, a1)} (chỉ có tấm phủ ${g(phu)}) — thiếu một đoạn kích thước.`, at[0], at[1]);
        }
        c.lo = c.ds[0].lo; c.hi = Math.max(...c.ds.map(q => q.hi));
        // khoảng hở / chồng đã báo riêng → cộng vào tổng (không báo lần nữa thành "cộng ra … khác tổng")
        c.tongHinh = c.hi - c.lo; c.tongGhi = c.ds.reduce((s, q) => s + (isFinite(q.ghi) ? q.ghi : q.hinh), 0) + hoTong;
        // kích thước tổng: một kích thước cùng hướng phủ đúng cả chuỗi, ở đường khác (hoặc kích thước bao trọn nằm cùng đường)
        const tong = ds.find(q => q.ngang === ngang && (Math.abs(q.lech - c.lech) >= 2 || c.bao.indexOf(q) >= 0) && Math.abs(q.lo - c.lo) < 1 && Math.abs(q.hi - c.hi) < 1);
        const at = ngang ? [X((c.lo + c.hi) / 2), Z(c.lech)] : [X(c.lech), Z((c.lo + c.hi) / 2)];
        if (tong && isFinite(tong.ghi)) {
          const dGhi = rn(c.tongGhi - tong.ghi, 2), dHinh = rn(c.tongHinh - tong.hinh, 2);
          if (Math.abs(dGhi) > 0.01) {
            if (Math.abs(dHinh) <= 0.5 && Math.abs(c.tongGhi - c.tongHinh) <= c.ds.length * 0.5 * (tong.kq || 1) + 0.01) them('luu_y', `Chuỗi kích thước ${ten} cộng các số ghi ra ${g(c.tongGhi)}, tổng ghi ${g(tong.ghi)} — chỉ do làm tròn số (hình khớp ${g(c.tongHinh)}).`, at[0], at[1], { lam_tron: true });
            else them('loi', `Chuỗi kích thước ${ten} cộng ra ${g(c.tongGhi)}${hoTong ? ` (kể cả ${g(hoTong)} không ghi)` : ''} nhưng kích thước tổng ghi ${g(tong.ghi)} (lệch ${g(Math.abs(dGhi))}).`, at[0], at[1]);
          }
        }
        // chuỗi phủ gần hết mặt đứng mà tổng khác hình tủ
        const Wb = ngang ? b.x1 - b.x0 : b.y1 - b.y0, a0 = ngang ? b.x0 : b.y0;
        if (c.tongHinh > 0.9 * Wb && Math.abs(c.lo - a0) < 5 && Math.abs(c.tongHinh - Wb) > 1) them('canh_bao', `Chuỗi kích thước ${ten} dài ${g(c.tongHinh)} khác ${ngang ? 'bề rộng' : 'chiều cao'} hình tủ ${g(Wb)}.`, at[0], at[1]);
      }
    }
  }

  /* ---- ván, hồi, vách, đợt, ngăn kéo, suốt ---- */
  const mode = ds => { const c = {}; for (const v of ds) { const k = rn(v * 2, 0) / 2; c[k] = (c[k] || 0) + 1; } let tot = null; for (const k of Object.keys(c)) if (tot === null || c[k] > c[tot] || (c[k] === c[tot] && +k < +tot)) tot = k; return tot === null ? null : +tot; };
  function dungTu(P, W, H, v, b, ctx, them, doan, loai) {
    const tam = P.filter(p => p.tam), coVat = P.some(p => p.vat) || (ctx.nghieng || []).some(r => trong([(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2], b, 30));
    const t = mode(tam.filter(p => p.t >= 9 && p.t <= 40).map(p => p.t)) || 17;
    const ganT = x => Math.abs(x - t) <= 1;
    // ---- cột đứng: gộp tấm đứng cùng bề ngang chồng lên nhau ----
    const V = tam.filter(p => p.dung).sort((p, q) => p.x0 - q.x0 || p.z0 - q.z0);
    const cot = [];
    for (const p of V) {
      let c = cot.find(c => Math.abs(c.x0 - p.x0) < TOL && Math.abs(c.x1 - p.x1) < TOL && p.z0 <= c.z1 + 1 && p.z1 >= c.z0 - 1);
      if (!c) { c = { x0: p.x0, x1: p.x1, z0: p.z0, z1: p.z1, w: p.w, ds: [], gay: [] }; cot.push(c); }
      else { if (p.z0 >= c.z1 - 1) c.gay.push(rn(c.z1)); else if (p.z1 <= c.z0 + 1) c.gay.push(rn(p.z1)); c.z0 = Math.min(c.z0, p.z0); c.z1 = Math.max(c.z1, p.z1); }
      c.ds.push(p);
    }
    const ngang = tam.filter(p => !p.dung);
    // phào trên / chân (xà chân cao tới 200 — cạnh ngắn > 60 nên không phải "tấm": xét mọi hình chữ nhật nằm)
    const nam = P.filter(p => !p.dung || p.h <= 200);
    //   (bản 1.42.0) phào trên phải phủ cả mép hồi (chạy suốt bề ngang) hoặc nằm TRÊN đỉnh mọi tấm đứng dưới nó — nóc dày lạ (30) lọt giữa hai hồi là NÓC
    const tamDung = tam.filter(p => p.dung);
    const phaoTren = nam.filter(p => p.z1 >= H - 1 && p.z0 > 1 && p.w >= 0.8 * W && p.h <= 200 && !ganT(p.h)
      && ((p.x0 <= 1 && p.x1 >= W - 1) || tamDung.filter(q => q.x1 > p.x0 + 0.5 && q.x0 < p.x1 - 0.5).every(q => q.z1 <= p.z0 + 1))).sort((p, q) => q.h - p.h)[0];
    const pT = phaoTren ? phaoTren.h : 0;
    let thap = false;
    if (H - pT < 250) {
      // (bản 1.42.0) dải thấp có vách đứng chia (hộc kéo sàn, kệ sàn) → tủ thấp không chân; không vách → không phải thân tủ
      if (V.filter(p => p.h >= 0.6 * (H - pT)).length < 2) { them('loi', `Mặt đứng chỉ cao ${g(H)} — không phải thân tủ (dải ngăn kéo / kệ treo rời?), chưa dựng được.`); return null; }
      thap = true; them('canh_bao', `Mặt đứng chỉ cao ${g(H)} — dựng thành tủ thấp không chân (hộc / kệ sàn); kiểm lại.`);
    }
    //   chân: phải có tấm (đáy, hay vách) đặt ngay trên nó — tấm dày lạ sát sàn không có gì đứng trên là ĐÁY dày lạ (25), không phải chân
    const trenNo = p => tam.some(q => q !== p && Math.abs(q.z0 - p.z1) <= 1 && (q.dung ? q.x0 >= p.x0 - 0.5 && q.x1 <= p.x1 + 0.5 : q.x1 > p.x0 + 1 && q.x0 < p.x1 - 1));
    const chanTam = thap ? [] : nam.filter(p => p.z0 <= 1 && p.h >= 25 && p.h <= 200 && !ganT(p.h) && p.w > p.h && trenNo(p));
    let chan = chanTam.reduce((s, p) => s + p.w, 0) >= 0.4 * W ? Math.max(...chanTam.map(p => p.h)) : 0;
    if (!chan) chanTam.length = 0;
    const daChon = new Set([phaoTren, ...chanTam].filter(Boolean));
    // phào trái / phải: cột ở mép, cao gần suốt, dày khác ván
    //   tấm đứng đỉnh vát (tủ dưới cầu thang) thấp dần theo dốc — vẫn là hồi / vách
    const full = cot.filter(c => c.z1 - c.z0 >= 0.6 * (H - pT - chan) || (c.ds.some(p => p.vat) && c.z1 - c.z0 >= 300));
    let pL = 0, pR = 0;
    const cL = full.find(c => c.x0 <= 1 && !ganT(c.w) && c.w > t + 3);
    if (cL) { pL = cL.w; full.splice(full.indexOf(cL), 1); }
    const cR = full.find(c => c.x1 >= W - 1 && !ganT(c.w) && c.w > t + 3);
    if (cR) { pR = cR.w; full.splice(full.indexOf(cR), 1); }
    const chia = full.filter(c => c.w <= 2 * t + 3).sort((p, q) => p.x0 - q.x0);
    if (!chia.length) { them('loi', 'Không nhận ra hồi / vách nào (tấm đứng cao gần suốt tủ) — chưa dựng được.'); return null; }
    // hai tấm đứng áp lưng → một chỗ tách thùng
    const ranh = [];
    for (const c of chia) {
      const tr = ranh[ranh.length - 1];
      if (tr && c.x0 - tr.x1 <= 1) { tr.x1 = c.x1; tr.kep = true; tr.ds.push(c); continue; }
      if (c.w > t + 3) { them('canh_bao', `Tấm đứng ở x ${g(c.x0)} dày ${g(c.w)} — nhận là ${c.w >= 2 * t - 1 ? 'hai tấm áp lưng' : 'một tấm'}.`, c.x0, (c.z0 + c.z1) / 2); }
      ranh.push({ x0: c.x0, x1: c.x1, kep: c.w >= 2 * t - 1, ds: [c] });
    }
    for (const r of ranh) if (r.kep) them('luu_y', `Hai tấm đứng áp lưng ở x ${g(r.x0)} … ${g(r.x1)} (${r.ds.length > 1 ? r.ds.map(c => g(c.w)).join(' + ') : g(r.x1 - r.x0)}) — hai thùng riêng: dựng thành chỗ tách thùng.`, r.x0, H / 2);
    // tấm mép dày (hồi + phào vẽ chung một hình) mà sát nó không có hồi riêng → tách: hồi dày ván + phào phần còn lại
    //   tấm dày chưa tới 2 lần ván (30 với ván 17) thì là HỒI DÀY: không phào, dày lạ ghi vào danh sách ván dày khác
    if (cL && ranh[0].x0 > cL.x1 + 150) {
      if (cL.w >= 2 * t - 1) { pL = rn(cL.w - t); them('luu_y', `Tấm mép trái dày ${g(cL.w)} không có hồi riêng — coi là hồi ${g(t)} + phào ${g(pL)}.`, 0, H / 2); } else { pL = 0; cL.hoi = true; }
      ranh.unshift({ x0: pL, x1: cL.w, kep: false, ds: [cL] });
    }
    if (cR && ranh[ranh.length - 1].x1 < cR.x0 - 150) {
      if (cR.w >= 2 * t - 1) { pR = rn(cR.w - t); them('luu_y', `Tấm mép phải dày ${g(cR.w)} không có hồi riêng — coi là hồi ${g(t)} + phào ${g(pR)}.`, W, H / 2); } else { pR = 0; cR.hoi = true; }
      ranh.push({ x0: cR.x0, x1: rn(W - pR), kep: false, ds: [cR] });
    }
    // mép trái / phải không có tấm
    const XL = pL, XR = W - pR;
    if (ranh[0].x0 > XL + 1 && ranh[0].x0 <= XL + 150) { const k = rn(ranh[0].x0 - XL); them('luu_y', `Mép trái có khe ${g(k)} không có tấm — coi là phào / nẹp ${g(k)}.`, XL, H / 2); pL = rn(pL + k); }
    let rr = ranh[ranh.length - 1];
    if (rr.x1 < XR - 1 && rr.x1 >= XR - 150) { const k = rn(XR - rr.x1); them('luu_y', `Mép phải có khe ${g(k)} không có tấm — coi là phào / nẹp ${g(k)}.`, XR, H / 2); pR = rn(pR + k); }
    const XL2 = pL, XR2 = W - pR;
    // khoang
    const khoang = [];
    const moMep = [];
    if (ranh[0].x0 > XL2 + 1) { khoang.push({ x0: XL2, x1: ranh[0].x0, khongHoi: 'trai' }); moMep.push('trái'); }
    for (let i = 0; i + 1 < ranh.length; i++) khoang.push({ x0: ranh[i].x1, x1: ranh[i + 1].x0, kepTrai: ranh[i].kep && i > 0 });
    if (rr.x1 < XR2 - 1) { khoang.push({ x0: rr.x1, x1: XR2, khongHoi: 'phai' }); moMep.push('phải'); }
    const kepTach = [];      // vị trí tấm đứng (1 … n − 1) là chỗ tách thùng
    { const bien = []; if (khoang[0] && khoang[0].khongHoi === 'trai') bien.push(null); for (const r of ranh) bien.push(r); if (rr.x1 < XR2 - 1) bien.push(null); bien.forEach((r, i) => { if (r && r.kep && i > 0 && i < bien.length - 1) kepTach.push(i); }); }
    for (const s of moMep) them('canh_bao', `Khoang ngoài cùng bên ${s} không có hồi trên bản vẽ (đầu hở — kệ / treo hở?) — dựng thêm hồi theo Chuẩn xưởng: khoang đó hẹp đi một bề dày hồi, để hở không cánh.`, s === 'trái' ? XL2 : XR2, H / 2);
    for (const k of khoang) k.lot = rn(k.x1 - k.x0);
    if (!khoang.length || khoang.some(k => k.lot < 30)) { them('loi', 'Bề rộng khoang không hợp lệ (vách sát nhau) — chưa dựng được.'); return null; }
    // ---- thân dưới / thân trên: chỗ hồi / vách cùng gãy ----
    const gay = {};
    for (const r of ranh) for (const c of r.ds) for (const z of c.gay) { const k = Math.round(z); gay[k] = (gay[k] || 0) + 1; }
    let caoDuoi = 0;
    { const can = Object.keys(gay).map(Number).filter(z => z > 600 && z < H - pT - 150).sort((p, q) => gay[q] - gay[p]); if (can.length && gay[can[0]] >= Math.ceil(ranh.length / 2)) { const z = can[0]; let tot = z, dt = Infinity; for (const r of ranh) for (const c of r.ds) for (const zz of c.gay) if (Math.abs(zz - z) < 1 && Math.abs(zz - z) < dt) { dt = Math.abs(zz - z); tot = zz; } caoDuoi = rn(tot); } }
    // ---- từng khoang ----
    const Ztop = H - pT;
    const vung = (p, k) => p.x0 <= k.x0 + 0.15 * k.lot + 1 && p.x1 >= k.x1 - 0.15 * k.lot - 1;
    const nhanAll = v.nhan.map(c => ({ f: c.f, text: c.text, x: c.tam[0] - b.x0, z: c.tam[1] - b.y0 }));
    const khuat = ctx.khuat.map(r => ({ x0: r.x0 - b.x0, x1: r.x1 - b.x0, z0: r.y0 - b.y0, z1: r.y1 - b.y0 }));
    const suot = ctx.suot.map(ch => ({ x: (ch.x0 + ch.x1) / 2 - b.x0, z: (ch.y0 + ch.y1) / 2 - b.y0, w: ch.x1 - ch.x0 })).filter(s => s.x >= 0 && s.x <= W && s.z >= 0 && s.z <= H);
    const doiDay = new Set();
    const hsCua = k => ngang.filter(p => !daChon.has(p) && vung(p, k) && p.h <= 60);
    // không vẽ xà chân mà đáy mọi khoang cùng nâng 30 … 200 → chân = cao đáy
    if (!chan && !thap) {
      const thap = khoang.map(k => { const ds = hsCua(k).map(p => p.z0); return ds.length ? Math.min(...ds) : null; });
      if (thap.every(z => z !== null && z >= 30 && z <= 200)) { chan = rn(Math.min(...thap)); doiDay.add(chan); }
    }
    khoang.forEach((k, i) => {
      const ten = `Khoang ${i + 1}`;
      k.nhan = nhanAll.filter(n => (n.x >= k.x0 && n.x <= k.x1) || (i === 0 && n.x < k.x0) || (i === khoang.length - 1 && n.x > k.x1));
      // vách đệm + vách lửng (tấm đứng thấp trong khoang)
      const le = tam.filter(p => p.dung && p.x0 >= k.x0 - TOL && p.x1 <= k.x1 + TOL && !chia.some(c => c.ds.indexOf(p) >= 0));
      const dem = le.filter(p => (Math.abs(p.x0 - k.x0) < 1 || Math.abs(p.x1 - k.x1) < 1) && p.h < 0.8 * (Ztop - chan));
      const lung = le.filter(p => dem.indexOf(p) < 0 && p.x0 > k.x0 + 5 && p.x1 < k.x1 - 5 && p.w <= t + 3);
      // vùng ngăn kéo
      k.nk = [];
      if (dem.length) {
        const nhomDem = gom(dem.map(p => ({ x0: k.x0, x1: k.x1, y0: p.z0, y1: p.z1, p })), 1);
        for (const nd of nhomDem) {
          const z0 = Math.min(...nd.map(q => q.y0)), z1 = Math.max(...nd.map(q => q.y1));
          const xa = Math.max(k.x0, ...nd.map(q => (Math.abs(q.p.x0 - k.x0) < 1 ? q.p.x1 : -Infinity))), xb = Math.min(k.x1, ...nd.map(q => (Math.abs(q.p.x1 - k.x1) < 1 ? q.p.x0 : Infinity)));
          k.nk.push({ z0, z1, xa, xb, dem: nd.map(q => q.p) });
        }
      }
      // tấm ngang của khoang
      let hs = hsCua(k);
      const ray = [];
      for (const z of k.nk) {
        const trongNK = hs.filter(p => p.x0 >= z.xa - 1 && p.x1 <= z.xb + 1 && p.z0 >= z.z0 - 1 && p.z1 <= z.z1 + 1 && p.h <= 40);
        for (const p of trongNK) ray.push(Object.assign(p, { nk: z }));
        z.ray = trongNK.sort((p, q) => p.z0 - q.z0);
      }
      hs = hs.filter(p => ray.indexOf(p) < 0).sort((p, q) => p.z0 - q.z0);
      // đáy / nóc / nóc dưới + đáy trên
      const day = hs.find(p => p.z0 <= chan + 40 && p.z0 >= chan - 5) || null;
      const noc = hs.slice().reverse().find(p => p.z1 >= Ztop - 40) || null;
      const tach = caoDuoi ? hs.filter(p => Math.abs(p.z1 - caoDuoi) < 1.5 || Math.abs(p.z0 - caoDuoi) < 1.5) : [];
      // đợt chỉ nhận tấm nằm trong khoang (tấm liền nhiều khoang chỉ làm đáy / nóc)
      hs = hs.filter(p => p === day || p === noc || tach.indexOf(p) >= 0 || (p.x0 >= k.x0 - 2 * t - 2 && p.x1 <= k.x1 + 2 * t + 2));
      // (bản 1.42.0) vùng ngăn kéo có thanh dưới (ray / khung mặt) ngay sát chân: người vẽ không vẽ đáy riêng — chỉ lưu ý
      const thanhDuoi = k.nk.map(z => z.ray[0]).filter(p => p && Math.abs(p.z0 - chan) <= 2)[0];
      if (!day && thanhDuoi) them('luu_y', `${ten}: đáy không vẽ (vùng ngăn kéo có thanh dưới ${g(thanhDuoi.h)} sát chân) — dựng đáy theo Chuẩn xưởng.`, (k.x0 + k.x1) / 2, chan);
      else if (!day) them(thap ? 'luu_y' : 'canh_bao', `${ten}: không có đáy trên bản vẽ (tấm ngang thấp nhất ở +${g(hs.length ? hs[0].z0 : Ztop)})${thap ? ' — hộc sàn: dựng đáy theo Chuẩn xưởng' : ''}.`, (k.x0 + k.x1) / 2, chan);
      //   tủ có tấm vát / nóc dốc (dưới cầu thang): khoang không nóc ngang là chuyện thường → lưu ý
      if (!noc && loai !== 'bep') them(coVat ? 'luu_y' : 'canh_bao', `${ten}: không có nóc trên bản vẽ${coVat ? ' (nóc dốc / vát — dựng nóc ngang theo Chuẩn xưởng)' : ''}.`, (k.x0 + k.x1) / 2, Ztop);      // tủ bếp dưới: mặt đá thay nóc
      const dot = hs.filter(p => p !== day && p !== noc && tach.indexOf(p) < 0);
      k.dot = dot;
      for (const p of [day, noc, ...dot, ...tach].filter(Boolean)) if (!ganT(p.h)) p.lech_t = true;
      // nhịp đợt
      if (k.lot > 1000 && (dot.length || day || noc)) them('canh_bao', `${ten} lọt lòng ${g(k.lot)} > 1000 — đợt / đáy / nóc dễ võng (nên thêm vách chia).`, (k.x0 + k.x1) / 2, dot.length ? dot[0].z0 : chan);
      // vách lửng
      for (const p of lung) {
        const trongNK = k.nk.some(z => p.z0 < z.z1 - 1 && p.z1 > z.z0 + 1);
        const nkHaiBen = k.nhan.filter(n => /ngan keo/.test(n.f) && n.z >= p.z0 && n.z <= p.z1);
        if (trongNK || (nkHaiBen.some(n => n.x < p.x0) && nkHaiBen.some(n => n.x > p.x1))) them('canh_bao', `${ten}: vách lửng ở x ${g(p.x0)} chia vùng ngăn kéo +${g(p.z0)} … +${g(p.z1)} thành 2 cột — chưa dựng được, dựng thành một cột.`, p.x0, (p.z0 + p.z1) / 2, { chua_ho_tro: true });
        else them('canh_bao', `${ten}: vách lửng ở x ${g(p.x0)} (+${g(p.z0)} … +${g(p.z1)}) — chưa dựng được, bỏ qua.`, p.x0, (p.z0 + p.z1) / 2, { chua_ho_tro: true });
      }
      k.lung = lung;
      // ô: các khoảng giữa đợt
      const moc = [];      // { tu, z0, z1 }
      const day0 = day ? day.z1 : chan;
      const ds = dot.map(p => p.z0).filter(z => z > day0 + 1 && z < Ztop - 1);
      const bien = [{ tu: 0, top: day0 }];
      const zs = ds.slice();
      if (caoDuoi) zs.push(caoDuoi);
      zs.sort((p, q) => p - q);
      for (const z of zs) {
        const p = dot.find(q => Math.abs(q.z0 - z) < 0.01);
        const daiDot = p ? p.h : 0;
        if (z === caoDuoi && !p) { const tr = tach.filter(q => q.z0 >= caoDuoi - 1.5).sort((a, c) => a.z1 - c.z1)[0]; bien.push({ tu: caoDuoi, top: tr ? tr.z1 : caoDuoi + t, than: 'T' }); continue; }
        bien.push({ tu: z, top: z + daiDot });
      }
      for (let j = 0; j < bien.length; j++) {
        const z1 = j + 1 < bien.length ? bien[j + 1].tu : (noc ? noc.z0 : Ztop);
        let z1b = z1;
        if (j + 1 < bien.length && bien[j + 1].than === 'T') { const nd = tach.filter(q => q.z1 <= caoDuoi + 1.5).sort((a, c) => a.z0 - c.z0)[0]; if (nd) z1b = nd.z0; }
        moc.push({ tu: bien[j].tu, z0: bien[j].top, z1: z1b });
      }
      k.o = moc.map(o => {
        const cell = Object.assign({}, o, { h: rn(o.z1 - o.z0) });
        const nh = k.nhan.filter(n => n.z >= o.z0 - 5 && n.z <= o.z1 + 5);
        cell.nhan = nh.map(n => n.text);
        const z = k.nk.find(q => q.z0 >= o.z0 - 2 && q.z1 <= o.z1 + 2) || k.nk.find(q => (q.z0 + q.z1) / 2 >= o.z0 && (q.z0 + q.z1) / 2 <= o.z1);
        const suotO = suot.filter(s => s.x >= k.x0 && s.x <= k.x1 && s.z >= o.z0 - 2 && s.z <= o.z1 + 2);
        let chuNK = nh.filter(n => /ngan keo/.test(n.f)).length;
        // vách lửng chia 2 cột ngăn kéo: số ngăn = cột nhiều chữ hơn (chữ ghi ở cả hai cột)
        for (const p of k.lung) { const a = nh.filter(n => /ngan keo/.test(n.f) && n.x < p.x0).length, c = nh.filter(n => /ngan keo/.test(n.f) && n.x > p.x1).length; if (a && c) chuNK = Math.max(a, c); }
        const chuTreo = nh.some(n => /treo/.test(n.f) && !/treo tuong|tivi|\btv\b|tranh|\bden\b/.test(n.f)), chuHo = nh.some(n => /\bho\b|ke ho|khoang ho|de trong/.test(n.f));
        cell.ho = chuHo;
        if (z) {
          const hop = khuat.filter(r => r.x0 >= z.xa - 2 && r.x1 <= z.xb + 2 && r.z0 >= z.z0 - 2 && r.z1 <= z.z1 + 2);
          const soHop = new Set(hop.map(r => Math.round(r.z0))).size;
          const mocRay = [z.z0, ...z.ray.flatMap(p => [p.z0, p.z1]), z.z1].sort((p, q) => p - q);
          let khe = 0; for (let j = 0; j + 1 < mocRay.length; j += 2) if (mocRay[j + 1] - mocRay[j] > 80) khe++;
          const soRay = z.ray.length ? khe : 0;      // khoảng giữa các thanh ray / khung mặt cao hơn 80 = một ngăn
          const so = soHop || soRay || chuNK || 1;      // hình trước, chữ sau (chữ thường chỉ ghi một lần cho cả vùng)
          if (chuNK > 1 && (soHop || soRay) && chuNK !== (soHop || soRay)) them('luu_y', `${ten}: chữ ghi ${chuNK} ngăn kéo, hình có ${soHop || soRay} — lấy ${so}.`, (k.x0 + k.x1) / 2, (z.z0 + z.z1) / 2);
          if (!soHop && !chuNK && !soRay) doan.push(`${ten}: số ngăn kéo ô +${g(o.tu)} = 1 (không đếm được từ hình)`);
          cell.kieu = 'nk_am'; cell.so = so;
          cell.ray = z.ray.length ? rn(mode(z.ray.map(p => p.h))) : 0; cell.dem = rn(mode(z.dem.map(p => p.w)));
          if (chuHo) them('canh_bao', `${ten}: chữ "hở" nằm trong ô ngăn kéo — bản vẽ tự mâu thuẫn.`, (k.x0 + k.x1) / 2, (o.z0 + o.z1) / 2);
          if (suotO.length) them('luu_y', `${ten}: ô +${g(o.tu)} vừa có ngăn kéo vừa có thanh treo — giữ ngăn kéo.`, suotO[0].x, suotO[0].z);
        } else if (suotO.length) {
          cell.kieu = 'suot';
          if (chuNK) them('canh_bao', `${ten}: chữ "ngăn kéo" nằm trong ô có thanh treo, không có ray / vách đệm — dựng suốt treo theo hình.`, (k.x0 + k.x1) / 2, (o.z0 + o.z1) / 2);
          if (o.z1 - o.z0 < 600) them('canh_bao', `${ten}: thanh treo trong ô chỉ cao ${g(o.z1 - o.z0)} — treo đồ không lọt.`, suotO[0].x, suotO[0].z);
        } else if (chuNK) {
          if (o.z1 - o.z0 > 1200) them('canh_bao', `${ten}: chữ "ngăn kéo" nằm trong ô cao ${g(o.z1 - o.z0)} chỉ có đợt — không có ray / vách đệm; chưa dựng ngăn kéo.`, (k.x0 + k.x1) / 2, (o.z0 + o.z1) / 2);
          else { cell.kieu = 'nk_am'; cell.so = chuNK; doan.push(`${ten}: ${chuNK} ngăn kéo ô +${g(o.tu)} lấy theo chữ (hình không có ray / vách đệm)`); }
        } else if (chuTreo) {
          if (o.z1 - o.z0 >= 600) { cell.kieu = 'suot'; doan.push(`${ten}: suốt treo ô +${g(o.tu)} lấy theo chữ (hình không có thanh treo)`); }
          else them('canh_bao', `${ten}: chữ "treo" nằm trong ô chỉ cao ${g(o.z1 - o.z0)} — không dựng suốt treo.`, (k.x0 + k.x1) / 2, (o.z0 + o.z1) / 2);
        }
        return cell;
      });
    });
    // ván dày khác
    const lech = {};
    for (const p of tam) {
      if (daChon.has(p) || p.nk || Math.abs(p.t - t) <= 0.5) continue;
      if ((cL && !cL.hoi && cL.ds.indexOf(p) >= 0) || (cR && !cR.hoi && cR.ds.indexOf(p) >= 0)) continue;      // phào mép (đã ghi riêng)
      if (p.dung && khoang.some(k => k.nk.some(z => z.dem.indexOf(p) >= 0))) continue;
      if (ranh.some(r => r.kep && r.ds.some(c => c.ds.indexOf(p) >= 0) && Math.abs(p.t - t) <= 1)) continue;
      const k = g(p.t); (lech[k] = lech[k] || []).push(p);
    }
    for (const k of Object.keys(lech)) { const ds = lech[k]; them('luu_y', `${ds.length} tấm dày ${k} (khác ván chính ${g(t)}): ${ds.slice(0, 4).map(p => `${p.dung ? 'đứng' : 'ngang'} ${g(p.dung ? p.h : p.w)} ở x ${g(p.x0)}, cao +${g(p.z0)}`).join('; ')}${ds.length > 4 ? '; …' : ''} — dựng theo Chuẩn xưởng.`, ds[0].x0, ds[0].z0); }
    // ray / vách đệm khác Chuẩn xưởng
    const rays = [...new Set(khoang.flatMap(k => k.o.filter(o => o.ray).map(o => o.ray)))], dems = [...new Set(khoang.flatMap(k => k.o.filter(o => o.dem).map(o => o.dem)))];
    if (rays.length || dems.length) them('luu_y', `Vùng ngăn kéo trên bản vẽ: ${dems.length ? 'vách đệm ' + dems.map(g).join(' / ') : ''}${dems.length && rays.length ? ', ' : ''}${rays.length ? 'thanh ray / khung mặt ' + rays.map(g).join(' / ') : ''} — dựng theo Chuẩn xưởng.`);
    if (doiDay.size) doan.push(`Chân cao ${[...doiDay].map(g).join(' / ')} lấy theo cao đáy (bản vẽ không vẽ xà chân)`);
    const cotRa = [];
    if (pL) cotRa.push({ loai: 'phao_trai', x0: 0, x1: pL, z0: 0, z1: H });
    if (pR) cotRa.push({ loai: 'phao_phai', x0: W - pR, x1: W, z0: 0, z1: H });
    if (pT) cotRa.push({ loai: 'phao_tren', x0: phaoTren.x0, x1: phaoTren.x1, z0: phaoTren.z0, z1: phaoTren.z1 });
    for (const p of chanTam) cotRa.push({ loai: 'chan', x0: p.x0, x1: p.x1, z0: p.z0, z1: p.z1 });
    ranh.forEach((r, i) => cotRa.push({ loai: (i === 0 && !(khoang[0] && khoang[0].khongHoi)) ? 'hoi' : (i === ranh.length - 1 && !(khoang[khoang.length - 1].khongHoi)) ? 'hoi' : 'vach', x0: r.x0, x1: r.x1, z0: Math.min(...r.ds.map(c => c.z0)), z1: Math.max(...r.ds.map(c => c.z1)), kep: !!r.kep }));
    khoang.forEach((k, i) => {
      for (const p of k.dot) cotRa.push({ loai: 'dot', khoang: i, x0: p.x0, x1: p.x1, z0: p.z0, z1: p.z1 });
      for (const z of k.nk) { for (const p of z.dem) cotRa.push({ loai: 'vach_dem', khoang: i, x0: p.x0, x1: p.x1, z0: p.z0, z1: p.z1 }); for (const p of z.ray) cotRa.push({ loai: 'thanh', khoang: i, x0: p.x0, x1: p.x1, z0: p.z0, z1: p.z1 }); }
      for (const p of k.lung) cotRa.push({ loai: 'vach_lung', khoang: i, x0: p.x0, x1: p.x1, z0: p.z0, z1: p.z1 });
    });
    return {
      t, pL: rn(pL), pR: rn(pR), pT: rn(pT), chan: rn(chan), caoDuoi, kepTach, suot, thap,
      khoang: khoang.map(k => ({ x0: rn(k.x0), x1: rn(k.x1), lot: k.lot, khong_hoi: k.khongHoi || null, o: k.o.map(o => Object.assign({ tu: rn(o.tu), z0: rn(o.z0), z1: rn(o.z1), nhan: o.nhan }, o.kieu ? { kieu: o.kieu } : {}, o.so ? { so: o.so } : {}, o.ho ? { ho: true } : {})), nhan: k.nhan.map(n => n.text) })),
      cot: cotRa.map(c => Object.assign(c, { x0: rn(c.x0), x1: rn(c.x1), z0: rn(c.z0), z1: rn(c.z1) })),
      nhanAll,
    };
  }

  /* ---- thông số tủ (Core.normalize nhận được) ---- */
  function specTu(D, W, H, ten, sauCat, loai, doan, them, nhan, opt) {
    const kieuTen = boDau(ten);
    // dày ván của Chuẩn xưởng đang dùng (bảng truyền opt.t); không có thì mặc định của lõi
    const tC = isFinite(+opt.t) && +opt.t > 0 ? +opt.t : ((Core && Core.DEFAULT_SPEC && Core.DEFAULT_SPEC.van.t) || 17.5);
    let sau = sauCat;
    if (!sau) { sau = /(^|[^a-z])(ke|gia)([^a-z]|$)/.test(kieuTen) && !/tu/.test(kieuTen.split(' ')[0]) ? CO_SAU.ke : CO_SAU.tu; doan.push(`Sâu thùng ${g(sau)} (bản vẽ không có mặt cắt)`); }
    const canhDoan = [];
    const khoang = D.khoang.map((k, i) => {
      const ho = k.o.length && k.o.every(o => o.ho) || k.nhan.some(n => /ke ho|khoang ho|\bho\b/.test(boDau(n))) && k.o.every(o => o.ho || !o.kieu || o.kieu === 'suot');
      let canh;
      // (bản 1.42.0) khoang ở mép không có hồi = đầu hở (kệ / treo hở): không cánh; lõi dựng thêm hồi Chuẩn xưởng → khoang bớt đúng một bề dày hồi
      //   (ghi số cố định cho khoang này — không để khoang 'auto' bên cạnh co lại)
      if (k.khong_hoi) { canh = 0; canhDoan.push(`K${i + 1} đầu hở bên ${k.khong_hoi === 'trai' ? 'trái' : 'phải'} — kệ hở, không cánh; lọt lòng ${g(k.lot)} trừ hồi ${g(tC)} dựng thêm = ${g(k.lot - tC)}`); }
      else if (ho) canh = 0;
      else if (D.thap && k.o.length && k.o.every(o => o.kieu === 'nk_am')) { canh = 0; canhDoan.push(`K${i + 1} ngăn kéo hộc sàn, không cánh`); }
      else if (k.lot < 150) { canh = 0; canhDoan.push(`K${i + 1} hở (hẹp ${g(k.lot)})`); }
      else if (k.lot <= 600) { canh = 1; canhDoan.push(`K${i + 1} 1 cánh bản lề ${i === D.khoang.length - 1 && D.khoang.length > 1 ? 'phải (phía mép tủ)' : 'trái'}`); }
      else { canh = 2; canhDoan.push(`K${i + 1} 2 cánh`); }
      const dot = [], o = [];
      for (const c of k.o) {
        if (c.tu > 0 && c.tu !== D.caoDuoi) dot.push(c.tu);
        if (c.kieu) o.push(Object.assign({ tu: c.tu, kieu: c.kieu }, c.kieu === 'nk_am' ? { so: c.so || 1 } : {}));
      }
      // bản lề phía mép tủ: khoang 1 cánh ở mép phải mở về bên phải
      return Object.assign({ rong: k.khong_hoi ? rn(Math.max(30, k.lot - tC), 1) : k.lot, canh, dot, o }, canh === 1 ? { ban_le: i === D.khoang.length - 1 && D.khoang.length > 1 ? 'phai' : 'trai' } : {}, k.khong_hoi ? { mo: true } : {});
    });
    if (canhDoan.length) doan.push(`Cánh: ${canhDoan.join(', ')} — tự đoán theo bề rộng (bản vẽ không vẽ cánh)`);
    // một khoang 'auto' (rộng nhất) đón phần chênh dày ván Chuẩn xưởng ≠ bản vẽ
    let iMax = -1; khoang.forEach((k, i) => { if (!k.mo && (iMax < 0 || k.rong > khoang[iMax].rong)) iMax = i; });
    if (iMax < 0) iMax = 0;
    khoang[iMax].rong = 'auto';
    for (const k of khoang) delete k.mo;
    if (Math.abs(D.t - tC) > 0.01) them('luu_y', `Ván chính trên bản vẽ dày ${g(D.t)} — dựng theo dày ván Chuẩn xưởng; khoang ${iMax + 1} tự chia phần chênh.`);
    const spec = {
      ten: ten.replace(/\s+/g, ' ').trim().slice(0, 80), rong: W, cao: H, sau_thung: sau,
      phao: { trai: D.pL, phai: D.pR, tren: D.pT }, chan: { cao: D.chan }, than: { cao_duoi: D.caoDuoi },
      thung: { tach: D.kepTach.slice() }, khoang,
    };
    void loai; void nhan;
    return spec;
  }

  /* ---- bếp (gắng sức): một dãy chữ I theo bề rộng mặt đứng + chỗ chậu / bếp / tủ lạnh / máy rửa bát theo chữ ---- */
  function dungBep(D, nhan, W, H, them, doan) {
    const tim = re => nhan.filter(n => re.test(n.f));
    const chau = tim(/chau|bon rua|sink/), bep = tim(/\bbep (tu|ga|dien|nau|hong ngoai)|^bep$|\bhob\b/), hm = tim(/hut mui/), tl = tim(/tu lanh/), mrb = tim(/may rua bat|\bmrb\b/);
    const bo = { kieu: 'I', canh: [{ dai: W, dau: 'tuong', cuoi: 'tuong' }] };
    if (chau.length) bo.chau = { canh: 0, s: chau[0].x }; else doan.push('Chậu: bản vẽ không ghi — bộ bếp tự đặt');
    const bx = bep.length ? bep[0].x : hm.length ? hm[0].x : null;
    if (bx !== null) bo.bep = { canh: 0, s: bx }; else doan.push('Bếp nấu: bản vẽ không ghi — bộ bếp tự đặt');
    if (tl.length) {
      bo.tl = { dau: tl[0].x < W / 2 ? 'dau' : 'cuoi' };
      // (bản 1.42.0) máy theo ô có chữ "TỦ LẠNH": rộng máy = lọt lòng − 2 × 20 (hở hai bên), cao = ô − 20 — số đoán, gõ máy thật
      const k = D && D.khoang.find(q => tl[0].x >= q.x0 && tl[0].x <= q.x1);
      if (k && k.lot >= 440 && k.lot <= 1440) {
        const o = k.o.find(c => tl[0].z >= c.z0 - 5 && tl[0].z <= c.z1 + 5), cao = o ? Math.max(800, Math.min(2300, rn(o.z1 - o.z0 - 20))) : 1800;
        bo.tl.may = { ma: 'tu_chon', rong: rn(k.lot - 40), sau: 700, cao };
        doan.push(`Tủ lạnh: máy rộng ${g(rn(k.lot - 40))} (ô lọt lòng ${g(k.lot)} − 2 × 20), cao ${g(cao)}${o ? ' theo ô' : ''}, sâu 700 — gõ số máy thật`);
      }
    } else bo.tl = null;
    if (mrb.length) bo.mrb = 600;
    doan.push(`Dãy bếp chữ I dài ${g(W)} (lấy theo bề rộng mặt đứng); sâu, cao theo chuẩn bếp`);
    them('luu_y', 'Bếp: chỉ lấy chiều dài dãy và chỗ chậu / bếp / tủ lạnh / máy rửa bát theo chữ ghi — cách chia tủ do Bộ bếp tự xếp.');
    let out = bo;
    if (Core && Core.chuanBo) {
      try {
        out = Core.chuanBo(bo);
        if (Core.xepBep) { const r = Core.xepBep(out); if (!r || !r.pa || !r.pa.length) them('canh_bao', 'Bộ bếp chưa xếp được phương án nào cho dãy này' + (r && r.loi_chung && r.loi_chung.length ? ': ' + r.loi_chung.slice(0, 2).join(' ') : '.')); }
      } catch (e) { them('canh_bao', 'Bộ bếp chưa nhận được dãy này: ' + e.message); out = bo; }
    }
    void D; void H;
    return out;
  }
  function ghepL(A, B, id) {
    const doan = [`Ghép giả định: "${A.ten}" = cạnh A (góc ở đầu PHẢI), "${B.ten}" = cạnh B (góc ở đầu TRÁI) — sai thì chọn từng mặt đứng`];
    const raw = { kieu: 'L', canh: [{ dai: A.rong, dau: 'tuong', cuoi: 'goc' }, { dai: B.rong, dau: 'goc', cuoi: 'tuong' }] };
    if (A.bo.chau && A.bo.chau.s != null) raw.chau = { canh: 0, s: A.bo.chau.s }; else if (B.bo.chau && B.bo.chau.s != null) raw.chau = { canh: 1, s: B.bo.chau.s };
    if (A.bo.bep && A.bo.bep.s != null) raw.bep = { canh: 0, s: A.bo.bep.s }; else if (B.bo.bep && B.bo.bep.s != null) raw.bep = { canh: 1, s: B.bo.bep.s };
    if (A.bo.tl || B.bo.tl) { const tl = A.bo.tl || B.bo.tl; raw.tl = Object.assign({ canh: A.bo.tl ? 0 : 1, dau: tl.dau }, tl.may && typeof tl.may === 'object' ? { may: tl.may } : {}); }
    else raw.tl = null;
    if (A.bo.mrb || B.bo.mrb) raw.mrb = 600;
    const loi = [{ muc: 'luu_y', cau: 'Góc chữ L dựng bằng tủ góc liên hoàn như Bộ bếp — kiểm lại đầu nào là góc.', x: null, y: null }];
    let bo = raw;
    if (Core && Core.chuanBo) { try { bo = Core.chuanBo(raw); } catch (e) { loi.push({ muc: 'canh_bao', cau: 'Bộ bếp chưa nhận dãy ghép: ' + e.message, x: null, y: null }); } }
    return { id, ten: `Bếp chữ L (ghép ${A.ten} + ${B.ten})`, loai: 'bep', rong: A.rong, cao: Math.max(A.cao, B.cao), sau: null, tin_cay: rn(Math.min(A.tin_cay, B.tin_cay) * 0.8, 2), loi, doan, bo, ghep: [A.id, B.id] };
  }

  return { doc, giaiMa, capMa, docMoHinh, lamPhang, docMText, docText, boDau, hcn, hinhVat, chonLopNoiThat, gom, soGhi, TRANG_MA, CO_SAU };
});
