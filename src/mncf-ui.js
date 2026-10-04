/*!
 * mncf-ui.js — bảng "Một Nhà · Vẽ tủ vào Chenfeng".
 * Chạy 2 chế độ: (1) bảng nổi trong trang Chenfeng (có nút "Vẽ vào Chenfeng"); (2) trang độc lập (chỉ xuất file JSON / bảng kê).
 */
(function (root) {
  'use strict';
  const Core = root.MNCFCore, Drv = root.MNCFDriver, Ph = root.MNCFPhong;
  if (!Core || typeof document === 'undefined') return;
  const LS_KEY = 'mncf.spec.v2', LS_KEY_CU = 'mncf.spec.v1', LS_WIDE = 'mncf.ui.wide', LS_BAN = 'mncf.spec.ban', LS_PHONG = 'mncf.phong.v1';      // v1 = thông số lưu từ bản 1.0–1.2
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
.tab{background:transparent;border:0;color:var(--head-dim);font:inherit;padding:7px 6.5px;border-radius:8px 8px 0 0;cursor:pointer;white-space:nowrap}
.panel.wide .tab,.mn.page .tab{padding:7px 12px}
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
    <div class="tabs"><button class="tab on" data-tab="tu">Tủ</button>${Ph ? '<button class="tab" data-tab="phong">Phòng</button>' : ''}${coKho ? '<button class="tab" data-tab="kho">Kho mẫu</button>' : ''}<button class="tab" data-tab="chuan">Chuẩn xưởng</button><button class="tab" data-tab="kq">Kết quả</button><button class="tab" data-tab="hd">Hướng dẫn</button></div>
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
    <div class="pane" data-pane="chuan" hidden><p class="hint">Số chuẩn của xưởng — chốt một lần, máy này tự nhớ. Đơn vị mm.</p><div class="settings"></div>
      <div class="frow"><button class="sec" data-act="defaults">Khôi phục mặc định</button></div><datalist id="drill"></datalist></div>
    <div class="pane" data-pane="kq" hidden><div class="report"><p class="hint">Chưa vẽ lần nào.</p></div>
      ${inCF ? `<div class="dlsx"><div class="frow"><button class="sec" data-act="doloi" title="Đọc tấm và lỗ khoan thật trên bản vẽ: tấm đè / trùng nhau, lỗ khoan giao nhau, lỗ lệch khỏi tấm hoặc khoan thủng, kiểu khoan lạ, tấm không lỗ, mối nối thiếu liên kết, tấm vượt khổ ván, tấm đứng riêng, tấm chưa có tên tủ">Dò lỗi sản xuất</button><p class="hint">Không chọn gì = dò cả bản vẽ. Chọn vài tấm trên bản vẽ trước = chỉ dò các tấm đó (kể cả phần anh tự vẽ / tự sửa).</p></div><div data-ui="doloi"></div></div>` : ''}</div>
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
${cf && root.__MNCF_NAP__ ? `<fieldset><legend>Cập nhật tự động</legend><ul class="sum"><li>Tiện ích trên máy này là <b>bộ nạp</b>: mỗi lần mở / tải lại trang Chenfeng, nó tự lấy bản mới nhất của bảng Một Nhà từ kho GitHub (đối chiếu mã kiểm rồi mới chạy). Không vào được kho thì chạy bản đã cất trong máy. Không phải cài lại khi có bản mới — chỉ cần <b>F5</b>.</li><li>Đang chạy: <b>v${Core.VERSION}</b> — <span class="nap-nguon">${esc(root.__MNCF_NAP__.nguon || 'đang nạp')}</span>.</li></ul><div class="frow"><button class="sec" data-act="nap-kt">Kiểm tra bản mới</button></div></fieldset>` : ''}
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

    function switchTab(name) { panel.dataset.tabon = name; $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === name)); $$('.pane').forEach(p => { p.hidden = p.dataset.pane !== name; }); if (name === 'tu' && model) { if (dnTuHT || dnTu()) paint(); else paintView(); } if (name === 'phong') paintPhong(); if (name === 'kho') { veChon(); khoNap(); } if (name !== 'phong' && veMD) datVeMD(false); }      // có điện – nước sau tủ: vẽ lại cả dòng báo (phòng có thể vừa sửa ở thẻ Phòng)
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
    }));

    function capMau() { const m = Core.MAU_TU.find(x => x.ma === $('[data-ui="mau"]').value), el = $('[data-ui="mau-mota"]'); if (el) el.textContent = m ? `${m.rong} × ${m.cao}${m.cao_duoi ? '' : ' (một thân)'} — ${m.mo_ta}` : ''; }
    function renderAll() {
      sel = null; hist = []; nhich = null; capNut();
      $$('[data-k]').forEach(i => { if (i.closest('.settings')) return; i.value = fmt(getP(spec, i.dataset.k)); });
      renderBays(); renderSettings(); rebuild();
    }
    (inCF ? document.documentElement : document.body).appendChild(host);
    renderAll(); capMau();
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
