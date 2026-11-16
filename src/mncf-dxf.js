/*!
 * mncf-dxf.js — Một Nhà · nạp bản vẽ CAD (DXF) của nhà thiết kế (bản 1.41.1 — anh Thanh 16/11/2026: "Nạp bản vẽ CAD").
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
  const TRANG_MA = { ANSI_1250: 'windows-1250', ANSI_1251: 'windows-1251', ANSI_1252: 'windows-1252', ANSI_1253: 'windows-1253', ANSI_1254: 'windows-1254', ANSI_1255: 'windows-1255', ANSI_1256: 'windows-1256', ANSI_1257: 'windows-1257', ANSI_1258: 'windows-1258', ANSI_874: 'windows-874', ANSI_932: 'shift_jis', ANSI_936: 'gbk', ANSI_949: 'euc-kr', ANSI_950: 'big5', DOS437: 'ibm866', UTF8: 'utf-8' };
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

  // đọc chuỗi thực thể tới ENDSEC / ENDBLK; POLYLINE gom VERTEX; INSERT có ATTRIB thì bỏ ATTRIB (không phải nét vẽ của tủ)
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
      if (T === 'ATTRIB' || T === 'SEQEND' || T === 'VERTEX') continue;
      ds.push(chuyen(r));
    }
    return [ds, i];
  }

  /** chữ DXF → { header, lop: {tên: {}}, kieu_dim: {tên: {dec}}, khoi: {tên: {base, ds}}, ds } */
  function docMoHinh(chu) {
    const C = capMa(chu);
    const header = {}, lop = {}, kieuDim = {}, khoi = {}; let ds = [];
    let i = 0, coDauMuc = false;
    while (i < C.ma.length) {
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
          if (C.ma[i] === 0 && (C.gt[i].trim() === 'LAYER' || C.gt[i].trim() === 'DIMSTYLE')) {
            let r; const T = C.gt[i].trim(); [r, i] = docThucThe(C, i);
            const n = layChu(r, 2, '');
            if (T === 'LAYER' && n) lop[n] = { mau: layS(r, 62, 7), tat: layS(r, 62, 7) < 0, dong: (layS(r, 70, 0) & 1) === 1 };
            if (T === 'DIMSTYLE' && n) kieuDim[n] = { dec: layS(r, 271, NaN), lfac: layS(r, 144, NaN) };
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
      }
      while (i < C.ma.length && !(C.ma[i] === 0 && C.gt[i].trim() === 'ENDSEC')) i++;
      i++;
    }
    if (!coDauMuc) throw new LoiFile('File không phải DXF (không có SECTION).');
    return { header, lop, kieu_dim: kieuDim, khoi, ds };
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
    return o.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
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
  /** mô hình → danh sách nét đã đưa về toạ độ thật (WCS), khối INSERT đã bung (≤ 4 tầng). Mỗi nét có `khoi` = các chỗ chèn chứa nó. */
  function lamPhang(MH) {
    const out = { net: [], chu: [], dim: [], chen: [], tron: [], loi: [] };
    let canhBaoSau = false, demChen = 0;
    const di = (ds, M, sau, lopCha, duong) => {
      for (const e of ds) {
        if (e.paper) continue;
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
        } else if (e.type === 'TEXT' || e.type === 'MTEXT') {
          if (!e.text) continue;
          const k = Math.sqrt(Math.abs(M[0] * M[3] - M[1] * M[2])) || 1;
          out.chu.push({ layer: L, p: ap(M, e.p), h: e.h * k, text: NFC(e.text), f: boDau(e.text), mtext: e.type === 'MTEXT', dinh: e.dinh || 0, can: e.can || 0, tu_khoi: duong.length > 0 });
        } else if (e.type === 'DIMENSION') {
          if (duong.length) continue;      // kích thước nằm trong khối: bỏ (hiếm)
          out.dim.push(Object.assign({}, e, { layer: L }));
        }
      }
    };
    di(MH.ds, I0, 0, null, []);
    if (canhBaoSau) out.loi.push({ muc: 'luu_y', cau: `Có khối lồng nhau sâu hơn ${KHOI_MAX} tầng — phần sâu hơn không đọc.` });
    return out;
  }

  /* ================= hình chữ nhật ================= */
  /** đỉnh → { x0, x1, y0, y1 } khi là hình chữ nhật thẳng trục (4 đỉnh sau khi bỏ đỉnh trùng / thẳng hàng), không thì null */
  function hcn(pts) {
    let p = pts.slice();
    const trung = (a, b) => Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01;
    p = p.filter((q, i) => i === 0 || !trung(q, p[i - 1]));
    if (p.length > 1 && trung(p[0], p[p.length - 1])) p.pop();
    for (let lap = 0; lap < 3 && p.length > 4; lap++) {
      p = p.filter((q, i) => { const a = p[(i - 1 + p.length) % p.length], b = p[(i + 1) % p.length]; return Math.abs((q[0] - a[0]) * (b[1] - a[1]) - (q[1] - a[1]) * (b[0] - a[0])) > 0.5 * Math.max(1, Math.hypot(b[0] - a[0], b[1] - a[1])); });
    }
    if (p.length !== 4) return null;
    for (let i = 0; i < 4; i++) { const a = p[i], b = p[(i + 1) % 4]; if (Math.abs(a[0] - b[0]) > 0.05 && Math.abs(a[1] - b[1]) > 0.05) return null; }
    const xs = p.map(q => q[0]), ys = p.map(q => q[1]);
    const r = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    if (r.x1 - r.x0 < 0.5 || r.y1 - r.y0 < 0.5) return null;
    return r;
  }

  /* ================= phân lớp ================= */
  const RE_LOP_NT = /noi ?that|noithat|furn|cabinet|joiner|mobili|\bgo\b|\bvan\b|\btu\b|家具|柜/;
  const RE_LOP_BO = /dim|kich ?thuoc|text|\bchu\b|tuong|wall|hatch|den|led|light|chieu sang|khuat|hidden|defpoint|thay|tpl|khung ten|frame|vport|ghi ?chu|axis|truc|cua|door|thiet ?bi/;
  const RE_LOP_LED = /\bden\b|den ?dien|\bled\b|light|chieu ?sang/;
  const RE_LOP_KHUAT = /khuat|hidden|\ban\b/;

  const MIEN_T = [2.5, 60];       // tấm ván: cạnh ngắn 2,5 … 60
  function chonLopNoiThat(net) {
    const dem = {};
    for (const n of net) { const r = hcn(n.pts); if (!r || n.line) continue; const t = Math.min(r.x1 - r.x0, r.y1 - r.y0); if (t >= MIEN_T[0] && t <= MIEN_T[1]) dem[n.layer] = (dem[n.layer] || 0) + 1; }
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
      const F = lamPhang(MH);
      KQ.loi_file.push(...F.loi);
      if (k !== 1) {
        const s = p => [p[0] * k, p[1] * k];
        for (const n of F.net) n.pts = n.pts.map(s);
        for (const c of F.chu) { c.p = s(c.p); c.h *= k; }
        for (const c of F.tron) { c.c = s(c.c); c.r *= k; }
        for (const c of F.chen) { c.x0 *= k; c.x1 *= k; c.y0 *= k; c.y1 *= k; }
        for (const d of F.dim) { d.p10 = s(d.p10); d.p13 = s(d.p13); d.p14 = s(d.p14); d.do *= k; d.k = k; }
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
    const lopLED = l => RE_LOP_LED.test(boDau(l)), lopKhuat = l => RE_LOP_KHUAT.test(boDau(l));
    // hình chữ nhật trên lớp nội thất (bỏ trùng)
    const daCo = new Set(), R = [], soLine = { nt: 0 };
    for (const n of F.net) {
      if (!laNT(n.layer)) continue;
      if (n.line || n.pts.length === 2) { soLine.nt++; continue; }
      const r = hcn(n.pts); if (!r) continue;
      const key = [r.x0, r.x1, r.y0, r.y1].map(v => Math.round(v * 2)).join(',');
      if (daCo.has(key)) continue; daCo.add(key);
      const t = Math.min(r.x1 - r.x0, r.y1 - r.y0);
      R.push(Object.assign(r, { tam: t >= MIEN_T[0] && t <= MIEN_T[1], cong: n.cong }));
    }
    const khuat = [];
    for (const n of F.net) if (lopKhuat(n.layer) && !n.line) { const r = hcn(n.pts); if (r) khuat.push(r); }
    // suốt treo: khối chèn mảnh, dài, không chứa tấm nội thất
    const chenTam = new Set();
    for (const n of F.net) if (laNT(n.layer)) for (const ch of n.khoi) chenTam.add(ch.id);
    const suot = F.chen.filter(ch => isFinite(ch.x0) && !chenTam.has(ch.id) && (() => {
      const w = ch.x1 - ch.x0, h = ch.y1 - ch.y0, ten = boDau(ch.name);
      return (/suot|thanh treo|treo|rail|hanger/.test(ten) && w > h) || (h <= 70 && w >= 250 && w / Math.max(h, 1) >= 6);
    })());
    // gom mặt đứng
    const nhom = gom(R, 2).filter(ds => ds.filter(r => r.tam).length >= 3).map(ds => ({ ds, b: hop(ds) })).filter(v => v.b.x1 - v.b.x0 >= 150 && v.b.y1 - v.b.y0 >= 150);
    if (!nhom.length) { KQ.loi_file.push({ muc: 'loi', cau: 'Không tìm thấy mặt đứng tủ nào (cần ít nhất 3 tấm ván liền nhau).' }); return; }
    if (soLine.nt > R.length) KQ.loi_file.push({ muc: 'luu_y', cau: `Lớp nội thất có ${soLine.nt} nét thẳng rời — tấm vẽ bằng nét rời không đọc được, chỉ đọc hình chữ nhật.` });
    // chữ: nhãn trong mặt đứng / tên dưới (trên) mặt đứng
    const chu = F.chu.filter(c => !c.tu_khoi);
    // nhãn: chữ trong hình, hoặc sát hai bên hình (≤ 500, ghi chú kéo ra ngoài) mà không phải tên tủ
    for (const v of nhom) v.nhan = chu.filter(c => trong(c.p, v.b, 5) || (!RE_TEN.test(c.f) && c.p[1] >= v.b.y0 && c.p[1] <= v.b.y1 && c.p[0] >= v.b.x0 - 500 && c.p[0] <= v.b.x1 + 500));
    const laNhan = new Set(); for (const v of nhom) for (const c of v.nhan) laNhan.add(c);
    const ungVien = chu.filter(c => !laNhan.has(c) && RE_TEN.test(c.f)).map(c => Object.assign({}, c, { hb: hopChu(c) }));
    // mặt cắt (cho chiều sâu): nhóm có chữ "mặt cắt" ở gần
    for (const v of nhom) v.cat = chu.some(c => RE_CAT.test(c.f) && trong(c.p, v.b, 400) && !RE_TEN.test(c.f.replace(RE_CAT, '')));
    const mat = nhom.filter(v => !v.cat), cat = nhom.filter(v => v.cat);
    // khung tờ giấy: khối chèn lớn (khung tên) / hình chữ nhật lớn không thuộc lớp nội thất chứa trọn mặt đứng — tên tờ thường nằm ở góc tờ, không ngay dưới hình
    const khung = [];
    for (const ch of F.chen) if (ch.sau === 0 && isFinite(ch.x0) && !chenTam.has(ch.id) && ch.x1 - ch.x0 >= 1500 && ch.y1 - ch.y0 >= 1000) khung.push({ x0: ch.x0, x1: ch.x1, y0: ch.y0, y1: ch.y1 });
    for (const n of F.net) if (!laNT(n.layer) && !n.line && !n.khoi.length) { const r = hcn(n.pts); if (r && r.x1 - r.x0 >= 1500 && r.y1 - r.y0 >= 1000) khung.push(r); }
    const chua = (k, b) => b.x0 >= k.x0 - 1 && b.x1 <= k.x1 + 1 && b.y0 >= k.y0 - 1 && b.y1 <= k.y1 + 1;
    const dt = k => (k.x1 - k.x0) * (k.y1 - k.y0);
    for (const v of mat) {
      v.khung = khung.filter(k => chua(k, v.b)).sort((a, c) => dt(a) - dt(c))[0] || null;
      let tot = null, dTot = Infinity;
      const cx0 = v.b.x0, cx1 = v.b.x1, H = v.b.y1 - v.b.y0;
      for (const c of ungVien) {
        if (khung.some(k => trong(c.p, k) && !chua(k, v.b))) continue;      // tên của tờ khác
        const ox = Math.min(cx1, c.hb.x1) - Math.max(cx0, c.hb.x0);
        if (ox < -0.25 * (cx1 - cx0)) continue;
        let d = c.hb.y1 <= v.b.y0 + 1 ? v.b.y0 - c.hb.y1 : c.hb.y0 >= v.b.y1 - 1 ? (c.hb.y0 - v.b.y1) * 1.6 + 200 : Infinity;
        if (d > Math.max(2500, 1.2 * H)) continue;
        d -= c.h * 2;      // chữ to hơn được ưu tiên
        if (d < dTot) { dTot = d; tot = c; }
      }
      if (!tot && v.khung) tot = ungVien.filter(c => trong(c.p, v.khung)).sort((a, c) => c.h - a.h || a.p[1] - c.p[1])[0] || null;      // tên to nhất của tờ
      v.ten = tot;
      // mặt cắt gần nhất cùng hàng, cao xấp xỉ
      let mc = null, dm = Infinity;
      for (const c of cat) { const dx = Math.max(c.b.x0 - v.b.x1, v.b.x0 - c.b.x1); const hc = c.b.y1 - c.b.y0; if (dx < 3000 && Math.abs(hc - H) < 0.2 * H && dx < dm) { dm = dx; mc = c; } }
      if (mc) v.sau = rn(mc.b.x1 - mc.b.x0, 1);
    }
    // bếp: tủ dưới và tủ trên cách nhau mảng tường ốp → hai nhóm chồng nhau cùng một tên → gộp thành một mặt đứng
    for (let i = 0; i < mat.length; i++) for (let j = mat.length - 1; j > i; j--) {
      const A = mat[i], B = mat[j];
      if (!A.ten || A.ten !== B.ten || loaiCua(A.ten.text, A.nhan.map(c => ({ f: c.f }))) !== 'bep') continue;
      const ox = Math.min(A.b.x1, B.b.x1) - Math.max(A.b.x0, B.b.x0), gap = Math.max(A.b.y0 - B.b.y1, B.b.y0 - A.b.y1);
      if (ox < 0.5 * Math.min(A.b.x1 - A.b.x0, B.b.x1 - B.b.x0) || gap > 1500) continue;
      A.ds = A.ds.concat(B.ds); A.b = hop([A.b, B.b]); A.nhan = A.nhan.concat(B.nhan); A.sau = A.sau || B.sau; mat.splice(j, 1);
    }
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
    let stt = 0;
    for (const v of mat) {
      stt++;
      let ten = v.ten ? v.ten.text.replace(/\s*\n\s*/g, ' ').trim() : `Mặt đứng ${stt}`;
      if (v.ten && demTen.get(khoaTen(v)) > 1) { const n = (thu.get(khoaTen(v)) || 0) + 1; thu.set(khoaTen(v), n); ten += ` (${n})`; }
      const ctx = { F, MH, dec, khuat, suot, led: F.net.filter(n => lopLED(n.layer)), laNT, opt };
      KQ.muc.push(dungMuc(v, ten, 'D' + stt, ctx));
    }
    // bếp chữ L: hai mặt đứng bếp → thêm một mục ghép
    const bep = KQ.muc.filter(m => m.loai === 'bep' && m.bo);
    if (bep.length === 2) KQ.muc.push(ghepL(bep[0], bep[1], 'D' + (++stt)));
  }

  /* ================= 7. DỰNG LẠI MỘT MẶT ĐỨNG ================= */
  const CO_SAU = { tu: 580, ke: 400, bep: 560 };
  function loaiCua(ten, nhan) {
    // từ khoá ĐẦU TIÊN của tên quyết định: "VÁCH SOFA … BẾP" là vách, "TỦ BẾP" là bếp, "BÀN ĐẢO BẾP" là bàn
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
    const them = (muc, cau, x, y, them2) => loi.push(Object.assign({ muc, cau, x: x === undefined ? null : rn(x), y: y === undefined ? null : rn(y) }, them2 || {}));
    const nhan = v.nhan.map(c => ({ text: c.text, f: c.f, x: rn(c.p[0] - b.x0), z: rn(c.p[1] - b.y0) }));
    const loai = loaiCua(ten, nhan);
    const muc = { id, ten, loai, rong: W, cao: H, sau: v.sau || null, tin_cay: 1, loi, doan, nhan: nhan.map(n => n.text) };
    // LED
    const led = ctx.led.filter(n => n.pts.every(p => trong(p, b, 30)));
    if (led.length) { const dai = led.reduce((s, n) => s + Math.hypot(n.pts[n.pts.length - 1][0] - n.pts[0][0], n.pts[n.pts.length - 1][1] - n.pts[0][1]), 0); them('luu_y', `Có ${led.length} dải đèn / LED (lớp ${[...new Set(led.map(n => n.layer))].join(', ')}, tổng dài khoảng ${g(Math.round(dai))}) — chưa dựng, ghi lại để làm điện.`); }
    const P = v.ds.map(r => Object.assign(L(r), { tam: r.tam, cong: r.cong })).map(r => Object.assign(r, { w: rn(r.x1 - r.x0), h: rn(r.z1 - r.z0), t: rn(Math.min(r.x1 - r.x0, r.z1 - r.z0)), dung: r.z1 - r.z0 > r.x1 - r.x0 }));
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
    const spec = specTu(D, W, H, ten, v.sau, loai, doan, them, nhan);
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
        const M = Core.build(spec);
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
      const lf = ctx.dec.lfac(q.d), k = (q.d.k || 1) / lf, dc = ctx.dec(q.d), buoc = Math.pow(10, -dc);
      const dl = Math.abs(q.sg.v * k - q.hinh);
      q.ghi = q.sg.v * k;
      const xy = q.ngang ? [X((q.lo + q.hi) / 2), Z(q.lech)] : [X(q.lech), Z((q.lo + q.hi) / 2)];
      if (dl < 0.01) continue;
      if (dl <= buoc * k / 2 + 0.01 && q.sg.tu !== 'sua') { lamTron.push(q); continue; }
      them('loi', `Kích thước ghi ${g(q.sg.v)} nhưng hình đo được ${g(q.hinh)} (lệch ${g(dl)}${q.sg.tu === 'sua' ? ' — chữ số bị gõ tay' : ''}).`, xy[0], xy[1]);
    }
    if (lamTron.length) {
      const vd = lamTron.slice(0, 6).map(q => `${g(q.sg.v)} (hình ${g(q.hinh)})`).join(', ');
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
    for (const ngang of [true, false]) {
      const nh = [];
      for (const q of ds.filter(q => q.ngang === ngang)) { let c = nh.find(c => Math.abs(c.lech - q.lech) < 2); if (!c) { c = { lech: q.lech, ds: [] }; nh.push(c); } c.ds.push(q); }
      for (const c of nh) {
        if (c.ds.length < 2) continue;
        c.ds.sort((p, q) => p.lo - q.lo);
        for (let i = 1; i < c.ds.length; i++) {
          const ho = c.ds[i].lo - c.ds[i - 1].hi;
          if (Math.abs(ho) > 0.5) {
            const at = ngang ? [X(c.ds[i].lo), Z(c.lech)] : [X(c.lech), Z(c.ds[i].lo)];
            them('canh_bao', `Chuỗi kích thước ${ngang ? 'ngang' : 'đứng'} ${ho > 0 ? 'hở' : 'chồng'} ${g(Math.abs(ho))} giữa đoạn ${g(c.ds[i - 1].hinh)} và đoạn ${g(c.ds[i].hinh)}.`, at[0], at[1]);
          }
        }
        c.lo = c.ds[0].lo; c.hi = Math.max(...c.ds.map(q => q.hi));
        c.tongHinh = c.hi - c.lo; c.tongGhi = c.ds.reduce((s, q) => s + (isFinite(q.ghi) ? q.ghi : q.hinh), 0);
        // kích thước tổng: một kích thước cùng hướng phủ đúng cả chuỗi, ở đường khác
        const tong = ds.find(q => q.ngang === ngang && Math.abs(q.lech - c.lech) >= 2 && Math.abs(q.lo - c.lo) < 1 && Math.abs(q.hi - c.hi) < 1);
        const at = ngang ? [X((c.lo + c.hi) / 2), Z(c.lech)] : [X(c.lech), Z((c.lo + c.hi) / 2)];
        if (tong && isFinite(tong.ghi)) {
          const dGhi = rn(c.tongGhi - tong.ghi, 2), dHinh = rn(c.tongHinh - tong.hinh, 2);
          if (Math.abs(dGhi) > 0.01) {
            if (Math.abs(dHinh) <= 0.5 && Math.abs(c.tongGhi - c.tongHinh) <= c.ds.length * 0.5 + 0.01) them('luu_y', `Chuỗi kích thước ${ngang ? 'ngang' : 'đứng'} cộng các số ghi ra ${g(c.tongGhi)}, tổng ghi ${g(tong.ghi)} — chỉ do làm tròn số (hình khớp ${g(c.tongHinh)}).`, at[0], at[1], { lam_tron: true });
            else them('loi', `Chuỗi kích thước ${ngang ? 'ngang' : 'đứng'} cộng ra ${g(c.tongGhi)} nhưng kích thước tổng ghi ${g(tong.ghi)} (lệch ${g(Math.abs(dGhi))}).`, at[0], at[1]);
          }
        }
        // chuỗi phủ gần hết mặt đứng mà tổng khác hình tủ
        const Wb = ngang ? b.x1 - b.x0 : b.y1 - b.y0, a0 = ngang ? b.x0 : b.y0;
        if (c.tongHinh > 0.9 * Wb && Math.abs(c.lo - a0) < 5 && Math.abs(c.tongHinh - Wb) > 1) them('canh_bao', `Chuỗi kích thước ${ngang ? 'ngang' : 'đứng'} dài ${g(c.tongHinh)} khác ${ngang ? 'bề rộng' : 'chiều cao'} hình tủ ${g(Wb)}.`, at[0], at[1]);
      }
    }
  }

  /* ---- ván, hồi, vách, đợt, ngăn kéo, suốt ---- */
  const mode = ds => { const c = {}; for (const v of ds) { const k = rn(v * 2, 0) / 2; c[k] = (c[k] || 0) + 1; } let tot = null; for (const k of Object.keys(c)) if (tot === null || c[k] > c[tot] || (c[k] === c[tot] && +k < +tot)) tot = k; return tot === null ? null : +tot; };
  function dungTu(P, W, H, v, b, ctx, them, doan, loai) {
    const tam = P.filter(p => p.tam);
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
    const phaoTren = nam.filter(p => p.z1 >= H - 1 && p.z0 > 1 && p.w >= 0.8 * W && p.h <= 200 && !ganT(p.h)).sort((p, q) => q.h - p.h)[0];
    if (H - (phaoTren ? phaoTren.h : 0) < 250) { them('loi', `Mặt đứng chỉ cao ${g(H)} — không phải thân tủ (dải ngăn kéo / kệ treo rời?), chưa dựng được.`); return null; }
    const pT = phaoTren ? phaoTren.h : 0;
    const chanTam = nam.filter(p => p.z0 <= 1 && p.h >= 25 && p.h <= 200 && !ganT(p.h) && p.w > p.h);
    let chan = chanTam.reduce((s, p) => s + p.w, 0) >= 0.4 * W ? Math.max(...chanTam.map(p => p.h)) : 0;
    if (!chan) chanTam.length = 0;
    const daChon = new Set([phaoTren, ...chanTam].filter(Boolean));
    // phào trái / phải: cột ở mép, cao gần suốt, dày khác ván
    const full = cot.filter(c => c.z1 - c.z0 >= 0.6 * (H - pT - chan));
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
    for (const s of moMep) them('canh_bao', `Khoang ngoài cùng bên ${s} không có hồi trên bản vẽ — dựng thêm hồi.`, s === 'trái' ? XL2 : XR2, H / 2);
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
    const nhanAll = v.nhan.map(c => ({ f: c.f, text: c.text, x: c.p[0] - b.x0, z: c.p[1] - b.y0 }));
    const khuat = ctx.khuat.map(r => ({ x0: r.x0 - b.x0, x1: r.x1 - b.x0, z0: r.y0 - b.y0, z1: r.y1 - b.y0 }));
    const suot = ctx.suot.map(ch => ({ x: (ch.x0 + ch.x1) / 2 - b.x0, z: (ch.y0 + ch.y1) / 2 - b.y0, w: ch.x1 - ch.x0 })).filter(s => s.x >= 0 && s.x <= W && s.z >= 0 && s.z <= H);
    const doiDay = new Set();
    const hsCua = k => ngang.filter(p => !daChon.has(p) && vung(p, k) && p.h <= 60);
    // không vẽ xà chân mà đáy mọi khoang cùng nâng 30 … 200 → chân = cao đáy
    if (!chan) {
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
      if (!day) them('canh_bao', `${ten}: không có đáy trên bản vẽ (tấm ngang thấp nhất ở +${g(hs.length ? hs[0].z0 : Ztop)}).`, (k.x0 + k.x1) / 2, chan);
      if (!noc && loai !== 'bep') them('canh_bao', `${ten}: không có nóc trên bản vẽ.`, (k.x0 + k.x1) / 2, Ztop);      // tủ bếp dưới: mặt đá thay nóc
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
        const chuTreo = nh.some(n => /treo/.test(n.f)), chuHo = nh.some(n => /\bho\b|ke ho|khoang ho|de trong/.test(n.f));
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
      t, pL: rn(pL), pR: rn(pR), pT: rn(pT), chan: rn(chan), caoDuoi, kepTach, suot,
      khoang: khoang.map(k => ({ x0: rn(k.x0), x1: rn(k.x1), lot: k.lot, khong_hoi: k.khongHoi || null, o: k.o.map(o => Object.assign({ tu: rn(o.tu), z0: rn(o.z0), z1: rn(o.z1), nhan: o.nhan }, o.kieu ? { kieu: o.kieu } : {}, o.so ? { so: o.so } : {}, o.ho ? { ho: true } : {})), nhan: k.nhan.map(n => n.text) })),
      cot: cotRa.map(c => Object.assign(c, { x0: rn(c.x0), x1: rn(c.x1), z0: rn(c.z0), z1: rn(c.z1) })),
      nhanAll,
    };
  }

  /* ---- thông số tủ (Core.normalize nhận được) ---- */
  function specTu(D, W, H, ten, sauCat, loai, doan, them, nhan) {
    const kieuTen = boDau(ten);
    let sau = sauCat;
    if (!sau) { sau = /(^|[^a-z])(ke|gia)([^a-z]|$)/.test(kieuTen) && !/tu/.test(kieuTen.split(' ')[0]) ? CO_SAU.ke : CO_SAU.tu; doan.push(`Sâu thùng ${g(sau)} (bản vẽ không có mặt cắt)`); }
    const canhDoan = [];
    const khoang = D.khoang.map((k, i) => {
      const ho = k.o.length && k.o.every(o => o.ho) || k.nhan.some(n => /ke ho|khoang ho|\bho\b/.test(boDau(n))) && k.o.every(o => o.ho || !o.kieu || o.kieu === 'suot');
      let canh;
      if (ho) canh = 0;
      else if (k.lot < 150) { canh = 0; canhDoan.push(`K${i + 1} hở (hẹp ${g(k.lot)})`); }
      else if (k.lot <= 600) { canh = 1; canhDoan.push(`K${i + 1} 1 cánh bản lề trái`); }
      else { canh = 2; canhDoan.push(`K${i + 1} 2 cánh`); }
      const dot = [], o = [];
      for (const c of k.o) {
        if (c.tu > 0 && c.tu !== D.caoDuoi) dot.push(c.tu);
        if (c.kieu) o.push(Object.assign({ tu: c.tu, kieu: c.kieu }, c.kieu === 'nk_am' ? { so: c.so || 1 } : {}));
      }
      return Object.assign({ rong: k.lot, canh, dot, o }, canh === 1 ? { ban_le: 'trai' } : {});
    });
    if (canhDoan.length) doan.push(`Cánh: ${canhDoan.join(', ')} — tự đoán theo bề rộng (bản vẽ không vẽ cánh)`);
    // một khoang 'auto' (rộng nhất) đón phần chênh dày ván Chuẩn xưởng ≠ bản vẽ
    let iMax = 0; khoang.forEach((k, i) => { if (k.rong > khoang[iMax].rong) iMax = i; });
    khoang[iMax].rong = 'auto';
    if (Math.abs(D.t - ((Core && Core.DEFAULT_SPEC && Core.DEFAULT_SPEC.van.t) || 17.5)) > 0.01) them('luu_y', `Ván chính trên bản vẽ dày ${g(D.t)} — dựng theo dày ván Chuẩn xưởng; khoang ${iMax + 1} tự chia phần chênh.`);
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
    if (tl.length) bo.tl = { dau: tl[0].x < W / 2 ? 'dau' : 'cuoi' }; else bo.tl = null;
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
    if (A.bo.tl || B.bo.tl) raw.tl = { canh: A.bo.tl ? 0 : 1 };
    else raw.tl = null;
    if (A.bo.mrb || B.bo.mrb) raw.mrb = 600;
    const loi = [{ muc: 'luu_y', cau: 'Góc chữ L dựng bằng tủ góc liên hoàn như Bộ bếp — kiểm lại đầu nào là góc.', x: null, y: null }];
    let bo = raw;
    if (Core && Core.chuanBo) { try { bo = Core.chuanBo(raw); } catch (e) { loi.push({ muc: 'canh_bao', cau: 'Bộ bếp chưa nhận dãy ghép: ' + e.message, x: null, y: null }); } }
    return { id, ten: `Bếp chữ L (ghép ${A.ten} + ${B.ten})`, loai: 'bep', rong: A.rong, cao: Math.max(A.cao, B.cao), sau: null, tin_cay: rn(Math.min(A.tin_cay, B.tin_cay) * 0.8, 2), loi, doan, bo, ghep: [A.id, B.id] };
  }

  return { doc, giaiMa, capMa, docMoHinh, lamPhang, docMText, docText, boDau, hcn, chonLopNoiThat, gom, soGhi, TRANG_MA, CO_SAU };
});
