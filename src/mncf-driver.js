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
        if (!told && Date.now() - t0 > 4000) { told = true; opt.onStatus('Chenfeng đang tải mẫu ngăn kéo / suốt treo từ máy chủ…'); }
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

  /** Chọn đối tượng bằng mã (giống người dùng quét chọn). */
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
    opt.onStatus('Xong.');
    const h1 = hmMark();
    let steps = 1 + ((fix.fixed || fix.normalized) ? 1 : 0);
    if (h0 && h1 && h1.i > h0.i && h1.i - h0.i <= 6) steps = h1.i - h0.i;
    D.last = { M, added, offset, steps, mark: h1, id };
    return { ok: errors.length === 0, giai_doan: 'xong', id, errors, warnings, notes: M.notes, offset, goc: offset.map((x, i) => r2(x + cf.base[i])), kiem_tra: v, sua_khoan: fix, so_buoc_hoan_tac: steps, module: mod, kich: Core.heSo(M.spec).kich, tom_tat: Core.summary(M) };
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
   * Vẽ phòng hiện trạng vào bản vẽ. H = MNCFPhong.hinhHoc(phòng). opt: { day_tuong (mặc định 110), onStatus }
   * @returns { ok, errors, warnings, dem:{tuong, mo, cot, dam}, so_buoc_hoan_tac }
   */
  D.drawRoom = async (H, opt) => {
    D.boManChe();
    opt = Object.assign({ day_tuong: 110, onStatus() {} }, opt || {});
    opt.onStatus = guard(opt.onStatus);
    const errors = [], warnings = [], dem = { tuong: 0, mo: 0, cot: 0, dam: 0 };
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
    } catch (e) { errors.push('Lỗi khi vẽ phòng: ' + String(e && e.message || e)); await dongHopThoai(); if (D.busy()) await D.cancel(); }
    await D.settle(400, 15000);
    // 5. tên phòng (bản 1.12): Chenfeng tự sinh vùng phòng (RoomRegion) không tên → nhãn "未命名 10.8m²". Ghi tên phòng của bảng vào.
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
  // tên tấm của mẫu kho là tiếng Trung → đổi sang tiếng Việt khi báo cáo (không đổi tên trong bản vẽ)
  const TEN_TAM = [['左侧板', 'Hồi trái'], ['右侧板', 'Hồi phải'], ['中侧板', 'Vách'], ['侧板', 'Hồi'], ['顶板', 'Nóc'], ['底板', 'Đáy'], ['背板', 'Hậu'], ['固定层板', 'Đợt cố định'], ['活动层板', 'Đợt rời'], ['层板', 'Đợt'], ['中立板', 'Vách'], ['立板', 'Vách'],
    ['后地脚', 'Xà chân sau'], ['地脚线', 'Xà chân'], ['踢脚板', 'Xà chân'], ['前拉条', 'Xà trước'], ['后拉条', 'Xà sau'], ['拉条', 'Thanh giằng'], ['收口条', 'Nẹp'], ['垫条', 'Thanh chèn'], ['见光板', 'Tấm ốp'], ['门板', 'Cánh']];
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
    const laHau = o => /背/.test(o.ten) && !/抽/.test(o.ten);
    const kc = L.filter(o => (o.tr === 0 || o.tr === 2) && !laHau(o) && !/门|抽/.test(o.ten));
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
    const laHauTen = b => /背/.test(String(b.Name || ''));
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
        offset = [r2((isFinite(mx) ? Math.ceil((mx + 3000) / 500) * 500 : 0) - base[0]), r2(-base[1]), r2(-base[2])];
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
        if (b.lenh === 'LR') { tra = await chayGoc(TEN_LENH_GOC.LR, st => LUA_CHON.LR(st, b), dich(b.goc), 'goc'); daNhin = false; }
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
    const h1 = hmMark();
    const steps = h0 && h1 && h1.i > h0.i ? h1.i - h0.i : xong;
    D.last = { M: Msub, added, offset: atW.slice(), khung, steps, mark: h1, id, goc_cf: true };      // offset = vị trí gốc thiết kế; tủ xoay (khung.xoay ≠ 0) thì toạ độ tấm = xoay(thiết kế) + offset
    opt.onStatus('Xong.');
    return { ok: errors.length === 0, giai_doan: 'xong', id, errors, warnings, notes: M.notes, offset: atW.slice(), goc: gocCuoi, xoay_do: xoay, khung, dat, kiem_tra: v, sua_khoan: { fixed: 0, normalized: 0 }, so_buoc_hoan_tac: steps,
      module: mod && (mod.ok || !mod.khong_can) ? mod : null, goc_cf: true, chua, tam_roi: roi ? roi.so_tam : 0, buoc: xong, tong_buoc: K.buoc.length, do_lai: nk, them_hinh: themHinh, kich: [r2(bb.x1 - bb.x0), r2(bb.y1 - bb.y0), r2(bb.z1 - bb.z0)], tom_tat: Core.summary(M) };
  };

  D.zoom = () => { try { D.cmd('ZOOME'); } catch (e) { /* bỏ qua */ } };
  D.undo = async (steps) => { for (let i = 0; i < (steps || 1); i++) { try { if (D.busy()) await D.cancel(); D.cmd('UNDO'); } catch (e) { /* bỏ qua */ } await sleep(400); await D.settle(600, 20000); } };
  D.sleep = sleep;

  root.MNCFDriver = D;
})(typeof self !== 'undefined' ? self : this);
