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
  // Chữ trên nút OK / Cancel của hộp thoại Chenfeng theo ngôn ngữ giao diện: tiếng Trung, tiếng Anh, tiếng Việt (ảnh anh Thanh 07/10/2026: "Chèn không gian · Xác nhận · Hủy").
  // Bảng bản ≤ 1.28 chỉ nhận "OK / 确定" → giao diện tiếng Việt thì không thấy hộp lệnh gốc, lệnh đứng ở hộp "Hông tủ trái/phải". Nút OK còn nhận theo màu (bp3-intent-success).
  const TEN_OK = /^(OK|确定|確定|确认|確認|Confirm|Xác nhận|Đồng ý)$/i, TEN_HUY = /^(Cancel|取消|Huỷ|Hủy|Hủy bỏ|Huỷ bỏ)$/i;
  const chuNut = b => { try { return String(b.innerText || b.textContent || '').trim(); } catch (e) { return ''; } };
  const laNutOK = b => TEN_OK.test(chuNut(b)) || (!!b.classList && b.classList.contains('bp3-intent-success') && !TEN_HUY.test(chuNut(b)));
  D.dangHoiDiem = () => { try { const g = gp(); return !!(g && g.IsReady); } catch (e) { return false; } };      // Chenfeng đang chờ bấm một điểm (lời nhắc của bảng hoặc của lệnh)
  D.cancel = async () => { try { ed().Cancel(); } catch (e) { /* bỏ qua */ } await sleep(300); };
  // (bản 1.26.1) ĐÃ ĐO trên Chenfeng thật 05/10/2026 + đọc mã CommandStore.HandleInput: (1) đang có lệnh chạy dở thì chữ gửi vào được chuyển cho lời nhắc của lệnh đó — lệnh mới KHÔNG chạy và
  // Chenfeng không báo gì; (2) Chenfeng rảnh nhưng vừa nhận một lệnh chưa tới 88 ms thì lệnh gửi tiếp cũng bị BỎ lặng lẽ (vd bảng vừa gửi ZOOME xong là gửi UNDO).
  // → lệnh của bảng đi qua guiLenh: cách lệnh trước của bảng ít nhất 120 ms. D.cmd (gửi ngay) chỉ còn dùng cho lệnh không cần chắc ăn (ZOOME).
  let lanGui = 0;
  D.cmd = name => { lanGui = Date.now(); return ed().CommandStore.HandleInput(name); };
  const guiLenh = async name => { const con = 120 - (Date.now() - lanGui); if (con > 0) await sleep(con); return D.cmd(name); };
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

  // Chenfeng báo gì khi tải mẫu hỏng → vì sao: mã mẫu không phải của cửa hàng đang đăng nhập (máy chủ trả "不是您店铺的模板，鉴权失败" — thử lại cũng vô ích), còn lại coi là máy chủ / mạng
  const lyDoMau = bao => (/鉴权|不是您店铺|无权|没有权限/.test(String(bao || '')) ? 'khong_thuoc_tk' : 'may_chu');
  /** Khung của các MẪU trong một nhóm đối tượng (đo trên Chenfeng thật 05/10/2026): mẫu gốc của từng đối tượng → GetTemplateRealitySpaceCS() = GỐC HỘP mẫu (đúng `Pos` trong file nhập), L / W / H = `BoxSize`. */
  const gocMauCua = ents => {
    const ds = new Map();
    for (const e of ents || []) {
      const T = rootTpl(e); if (!T || ds.has(T)) continue;
      try { const m = T.GetTemplateRealitySpaceCS().elements, kich = [Number(T.LParam.value), Number(T.WParam.value), Number(T.HParam.value)], goc = [m[12], m[13], m[14]]; if (kich.concat(goc).every(isFinite)) ds.set(T, { kich, goc }); } catch (er) { /* đối tượng không thuộc mẫu nào */ }
    }
    return [...ds.values()];
  };
  /**
   * Điểm trả lời cho một lệnh nhập CHỈ CÓ MẪU. Chenfeng đặt GÓC NHỎ NHẤT của cả cụm vừa tạo vào điểm trả lời; với mẫu thì góc đó nằm đâu so với hộp mẫu là chuyện riêng của từng mẫu
   * (mặt ngăn kéo nhô ra, suốt treo nằm lưng chừng hộp). Lúc lệnh hỏi điểm, cụm đã nằm sẵn ở một chỗ chờ và từng mẫu đã có khung → dời cả cụm sao cho gốc hộp của từng mẫu
   * về đúng `pos + doi`. mau = [{ kich: [L, W, H], pos: [x, y, z] }]. Trả null nếu không khớp được mẫu nào với khung nào.
   */
  const diemChoMau = (moi, mau, doi) => {
    const G = gocMauCua(moi), bs = [];
    for (const e of moi) { try { const b = D.boxOf(e); if (b && b.every(isFinite)) bs.push(b); } catch (er) { /* bỏ qua */ } }
    if (!G.length || !bs.length || !mau.length) return null;
    const gan = (a, b2, t) => a.every((v, i) => Math.abs(v - b2[i]) <= t), dich = q => q.pos.map((v, i) => v + doi[i]);
    for (const c of G.filter(g => gan(g.kich, mau[0].kich, 0.06))) {
      const T = dich(mau[0]).map((v, i) => v - c.goc[i]), dung = new Set([c]);
      const du = mau.slice(1).every(q => { const h = G.find(g => !dung.has(g) && gan(g.kich, q.kich, 0.06) && gan(g.goc.map((v, i) => v + T[i]), dich(q), 0.06)); if (h) dung.add(h); return !!h; });
      if (du) return [0, 2, 4].map((k, i) => Math.min(...bs.map(b => b[k])) + T[i]);
    }
    return null;
  };

  // Lệnh nhập bị bảng bỏ vì chờ máy chủ quá lâu VẪN CHẠY NGẦM trong Chenfeng (đo trên Chenfeng thật 05/10/2026: lúc Chenfeng đang tải mẫu, Esc không có tác dụng và Chenfeng không báo bận);
  // máy chủ rốt cuộc trả lời thì Chenfeng hỏi điểm đặt mà không còn ai trả lời → cụm mẫu bám theo chuột. Canh tối đa 3 phút: lời hỏi điểm hiện ra trong khi lệnh bắt đầu gần nhất
  // của Chenfeng vẫn là lệnh nhập đó (app.CommandReactor._cmdName) và bảng không có lệnh nhập nào đang chạy → gửi Esc (Chenfeng tự bỏ các đối tượng của lệnh đó).
  // Trong lúc lệnh cũ còn chạy ngầm, Chenfeng bỏ qua mọi lệnh khác (khoan lại, gom module… đều không chạy) → `lenhTre.xong` cho nơi gọi biết lúc nào Chenfeng rảnh lại.
  let dangNhap = 0, lenhTre = null;
  const tenLenhCuoi = () => { try { return String(root.app.CommandReactor._cmdName || ''); } catch (e) { return ''; } };
  const canhLenhTre = () => {
    const ten = tenLenhCuoi(), tre = { xong: false }, w = watchEnd(); lenhTre = tre;
    (async () => {
      const t0 = Date.now();
      try {
        while (Date.now() - t0 < 180000) {
          await sleep(300);
          if (w.ended || (ten && tenLenhCuoi() !== ten)) break;      // Chenfeng tự kết thúc lệnh đó (tải hỏng), hoặc đã nhận lệnh khác
          if (!dangNhap && ready(gp())) { ed().Cancel(); await sleep(400); break; }
        }
      } catch (e) { /* bỏ qua */ }
      w.off(); tre.xong = true;
    })();
  };
  /** Chờ lệnh nhập bị bỏ (đang chạy ngầm) kết thúc, tối đa `ms`. true = Chenfeng đã rảnh. */
  const choLenhTre = async ms => { const tre = lenhTre; if (!tre || tre.xong) return true; await cho(() => tre.xong, ms); return tre.xong; };

  /**
   * Nhập một khối dữ liệu {ModelSpace:[…]} bằng cổng 晨丰导入.
   * @param obj   dữ liệu
   * @param point [x,y,z] điểm đặt cho GÓC NHỎ NHẤT của cả cụm; bỏ trống = người dùng tự bấm điểm trên bản vẽ
   * @param opt   { onStatus, timeout, co_mau: dữ liệu có mẫu phải tải từ máy chủ (để báo cho đúng),
   *                cho_im: (bản 1.23, lệnh có mẫu) hạn chờ tính theo TIẾN TRIỂN — Chenfeng dựng thêm được đối tượng nào (tải xong thêm một mẫu) thì tính lại từ đầu; đứng im quá hạn mới bỏ,
   *                mau + doi (bản 1.23): lệnh chỉ có mẫu — bảng tự tính điểm đặt cho gốc hộp từng mẫu về `pos + doi` (xem diemChoMau) }
   * Lỗi ném ra mang `ly_do` ('may_chu' | 'khong_thuoc_tk' | 'lech') và `bao` (các dòng Chenfeng báo) khi Chenfeng tự huỷ lệnh.
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
    dangNhap++;
    try {
      opt.onStatus('Đang gửi dữ liệu cho Chenfeng…');
      const n0 = root.app.Database.ModelSpace.Entitys.length;
      if (!D.dropJSON(obj)) throw new Error('Chenfeng không nhận dữ liệu (trang này chưa mở bản vẽ?).');
      dropped = true;
      const t0 = Date.now(); let told = false, nCu = n0, tCu = t0;
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
        { const nNay = root.app.Database.ModelSpace.Entitys.length; if (nNay !== nCu) { nCu = nNay; tCu = Date.now(); } }      // Chenfeng vừa dựng thêm đối tượng (tải xong thêm một mẫu) → còn đang chạy
        if (opt.cho_im > 0 ? Date.now() - tCu > opt.cho_im : Date.now() - t0 > opt.timeout) {
          const e = new Error(opt.co_mau ? `Máy chủ Chenfeng không trả lời sau ${Math.round((opt.cho_im > 0 ? opt.cho_im : opt.timeout) / 1000)} giây (mạng tới máy chủ Chenfeng đang chậm hoặc rớt).` : 'Chờ quá lâu mà Chenfeng chưa tạo xong tấm.');
          e.ly_do = 'may_chu'; e.qua_gio = true; throw e;
        }
        if (!told && Date.now() - t0 > 4000) { told = true; opt.onStatus(opt.bao_tai || (opt.co_mau === false ? 'Chenfeng đang dựng tấm…' : 'Chenfeng đang tải mẫu ngăn kéo / suốt treo từ máy chủ…')); }
        await sleep(120);
      }
      if (!w.ended) {
        if (!point && opt.mau && opt.doi) {
          const d = diemChoMau(root.app.Database.ModelSpace.Entitys.filter(e => e && !e.IsErase && !before.has(e)), opt.mau, opt.doi);
          if (!d) { const e = new Error('Chenfeng đã tải mẫu nhưng bảng không nhận ra khung của mẫu để đặt đúng chỗ.'); e.ly_do = 'lech'; throw e; }
          point = d;
        }
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
      if (e && e.qua_gio && dropped && !w.ended) canhLenhTre();      // lệnh cũ còn chạy ngầm trong Chenfeng → canh để huỷ khi nó hiện lời hỏi điểm
      throw e;
    } finally { w.off(); dangNhap = Math.max(0, dangNhap - 1); }
    const added = root.app.Database.ModelSpace.Entitys.filter(e => e && !e.IsErase && !before.has(e));
    if (!added.length && failToast()) throw new Error('Chenfeng báo dữ liệu không hợp lệ (导入失败).');
    if (!added.length) {
      // Lệnh nhập kết thúc mà không còn gì: người dùng bấm Esc, hoặc Chenfeng gặp lỗi giữa chừng rồi tự huỷ lệnh (hay gặp khi mạng tới máy chủ Chenfeng chậm, tải mẫu không xong) — lúc đó Chenfeng hiện một thông báo.
      const bao = [...document.querySelectorAll('.bp3-toast')].filter(t => !toastCu.has(t)).map(t => (t.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
      if (bao.length) {
        const e = new Error(`Chenfeng gặp lỗi khi nhập và đã tự huỷ lệnh${opt.co_mau === false ? '' : ' — thường do mạng tới máy chủ Chenfeng chậm nên tải mẫu ngăn kéo / suốt treo không xong'}. Chưa vẽ gì, bấm vẽ lại. (Chenfeng báo: "${bao[0].slice(0, 110)}")`);
        e.bao = bao.map(t => t.slice(0, 200)); e.ly_do = lyDoMau(bao.join(' ')); e.tu_huy = true;
        throw e;
      }
    }
    return { added, cancelled: added.length === 0, logs: logsSince(mark) };
  };

  /** Chọn đối tượng bằng mã (giống người dùng quét chọn). Trên Chenfeng thật `AddSelect` CỘNG THÊM vào tập đang chọn — muốn chọn riêng các đối tượng này thì dùng D.chonRieng. */
  D.chonRieng = (ents) => { try { ed().SelectCtrl.Cancel(); } catch (e) { /* bỏ qua */ } return D.select(ents); };
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
    await guiLenh('DRAWHOLE');
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
      if (s0.ve_goc && !(opt && opt.goc === false) && D.gocDuoc()) { const K = Core.keHoachGoc(s0); if (K.M.errors.length || !K.loi.length) goc = true; else ghiGoc = K.loi.join('; '); }
    } catch (e) { goc = false; }
    // lời báo "rơi về cách nhập tấm": module đổi được kích thước nào thì nói đúng kích thước đó (bản 1.26.1: tủ có cột giữa thì Rộng chỉ để xem — xem ganHeSo)
    const baoNhapTam = mod => {
      const kh = (mod && mod.khoa) || [], TEN = { L: 'Rộng', W: 'Sâu', H: 'Cao' }, duoc = ['L', 'W', 'H'].filter(k => !kh.some(x => x.ten === k)).map(k => TEN[k]);
      const cam = kh.length ? ` (${kh.map(x => TEN[x.ten]).join(' / ')} chỉ để xem${kh.some(x => x.ly_do === 'cot_giua') ? ' — tủ có cột giữa' : ''}: đổi thì sửa ở bảng này rồi bấm “Cập nhật tủ này”)` : '';
      return `Tủ này chưa vẽ được bằng lệnh gốc Chenfeng (${ghiGoc}) → đã vẽ theo cách nhập tấm: tủ là một module${duoc.length ? ` đổi được ${duoc.join(' / ')} ở ô Thông số` : ''}${cam}, nhưng từng tấm không phải tấm tự động của Chenfeng.`;
    };
    const run = async () => {
      ran = true;
      if (goc) res = await D.veGoc(spec, opt);
      else {
        res = await drawImpl(spec, opt);
        // opt.xoay (bản 1.16): tủ nhập tấm vẽ thẳng trục xong thì xoay bằng lệnh ROTATE của Chenfeng quanh điểm đặt (góc tủ, hoặc gốc thiết kế khi gọi bằng `at`)
        const xoay = Number(opt && opt.xoay) || 0;
        if (xoay && res && res.giai_doan === 'xong' && D.last) {
          const tam = opt.at ? opt.at.slice() : res.goc.slice();
          const truocXoay = new Set(root.app.Database.ModelSpace.Entitys);
          let r; try { r = await D.rotate(D.last.added, tam, xoay); } catch (e) { r = { ok: false, steps: 0, reason: String(e && e.message || e) }; }
          if (D.last) D.last.added = docLaiDS(D.last.added, truocXoay);      // lệnh ROTATE khoan lại mọi tấm được xoay
          const bbL = Core.bbox(D.last.M.parts) || { x0: 0, y0: 0, z0: 0 };
          res.xoay_do = xoay; res.khung = { goc: opt.at ? quayZ([bbL.x0, bbL.y0, bbL.z0], xoay).map((v, i) => r2(v + tam[i])) : tam, xoay };
          res.xoay_kq = r;
          if (r.ok) { res.so_buoc_hoan_tac = (res.so_buoc_hoan_tac || 1) + (r.steps || 0); D.last.khung = res.khung; res.goc = res.khung.goc; }
          else res.warnings.push(`Chưa xoay được tủ ${r2(xoay)}° (${r.reason || 'lệnh xoay không chạy'}) — tủ đang nằm thẳng trục tại điểm đặt; dùng lệnh ROTATE của Chenfeng quanh điểm ${tam.map(r2).join(', ')}.`);
        }
      }
      if (ghiGoc && res && Array.isArray(res.warnings)) res.warnings.unshift(baoNhapTam(res.module));
      return res;
    };
    try {
      const nav = root.navigator;
      if (nav && nav.locks && typeof nav.locks.request === 'function') { await nav.locks.request('mncf-ve-tu', { mode: 'shared' }, run); return res; }
    } catch (e) { if (ran) throw e; }
    return run();
  };

  /**
   * Dò lỗi sản xuất NGAY SAU KHI VẼ, trên chính các đối tượng vừa sinh ra (bản 1.20) — xem D.doLoi ở cuối tệp.
   * Mục LỖI của phiếu được đưa vào danh sách lỗi của lần vẽ: tủ vẽ ra mà không sản xuất được thì lần vẽ không "ok". Mục LƯU Ý chỉ nằm trong phiếu.
   * Không bao giờ ném lỗi: phép dò hỏng thì lần vẽ vẫn trả kết quả, chỉ không có phiếu.
   */
  /**
   * Danh sách đối tượng của một tủ SAU một lệnh của Chenfeng = cái còn sống trong danh sách cũ + cái mới sinh ra từ mốc `truoc` (tập đối tượng của bản vẽ lúc trước lệnh).
   * Đo trên Chenfeng thật 05/10/2026 (tủ khấu cột 76 tấm + 2 hộp ngăn kéo): lệnh nào đụng tới tấm cũng KHOAN LẠI tấm đó — lỗ cũ bị bỏ (IsErase), lỗ mới là đối tượng khác:
   * DRAWHOLE (mọi lỗ của tấm được chọn), MODELING (558 lỗ của các tấm được gom; 48 lỗ trong lòng hộp ngăn kéo giữ nguyên), ROTATE (cả 606 lỗ, kể cả lỗ không nằm trong tập chọn);
   * UpdateTemplateTree giữ nguyên đối tượng lỗ. Giữ danh sách cũ thì phép dò lỗi chỉ còn thấy lỗ của hộp ngăn kéo → báo oan "N tấm có kiểu khoan mà không có lỗ nào".
   */
  const docLaiDS = (ds, truoc) => { const co = new Set(ds); return ds.filter(e => e && !e.IsErase).concat(root.app.Database.ModelSpace.Entitys.filter(e => e && !e.IsErase && !truoc.has(e) && !co.has(e))); };
  const TEN_LOI_SX = { vc_that: 'tấm đè lên nhau', lo_giao: 'lỗ khoan giao nhau', lo_lech: 'lỗ khoan lệch khỏi tấm hoặc khoan thủng tấm', kieu_khoan: 'kiểu khoan không có trong cấu hình', kho_van_that: 'tấm vượt khổ ván' };
  const doLoiSauVe = (added, errors, kho) => {
    let p = null;
    try { p = D.doLoi((added || []).filter(e => e && !e.IsErase), { kho }); } catch (e) { return null; }
    try {
      for (const m of p.muc) {
        if (m.ket !== 'loi' || !m.tin.length) continue;
        if (m.ma === 'vc_that' && errors.some(t => /đè lên nhau/.test(t))) continue;      // D.verify đã nêu các chỗ đè nhau
        errors.push(`Dò lỗi sản xuất — ${TEN_LOI_SX[m.ma] || m.ten}: ${m.tin[0]}${m.tin.length > 1 ? ` (và ${m.tin.length - 1} chỗ khác — xem phiếu dò lỗi ở thẻ Kết quả)` : ''}`);
      }
    } catch (e) { /* bỏ qua */ }
    return p;
  };

  /* ------------------------------------------------------------------ *
   * TẤM TRƯỚC, MẪU SAU (bản 1.23 — anh Jason 04/10/2026 22:57: "vẽ tủ vẫn trục trặc, làm sao phải liên kết máy chủ, vẽ bằng những cái có sẵn đi").
   * Đo trên Chenfeng thật 05/10/2026: mỗi mẫu (hộp ngăn kéo, suốt treo) trong một lệnh nhập là MỘT lần Chenfeng gọi máy chủ (CAD-moduleDetail) — không lưu đệm, hai mẫu cùng mã vẫn gọi hai lần;
   * một lần gọi hỏng (mạng chậm / rớt, hoặc mã mẫu không phải của cửa hàng đang đăng nhập) là Chenfeng huỷ CẢ lệnh. Trước bản này tấm và mẫu đi chung một lệnh → hỏng một mẫu là cả tủ "Chưa vẽ được".
   * Nay: phần TẤM (không cần máy chủ) nhập trước, lúc nào cũng vẽ được; mẫu thêm sau — cả cụm một lệnh, hỏng thì thêm từng mẫu (thử lại khi lỗi máy chủ);
   * mẫu nào vẫn hỏng thì tủ chỉ thiếu đúng mẫu đó và báo rõ vì sao. Mã mẫu không thuộc tài khoản → dò mẫu CÙNG TÊN trong kho của tài khoản (chỉ ĐỌC) và dùng nó.
   * ------------------------------------------------------------------ */
  const mauLoi = { khong_thuoc: new Set(), thay: new Map() };      // nhớ trong phiên: mã mẫu không thuộc tài khoản; mã → mã của mẫu cùng tên trong kho tài khoản
  D.quenMauLoi = () => { mauLoi.khong_thuoc.clear(); mauLoi.thay.clear(); };
  const TEN_LOAI_MAU = [['NGAN_KEO', 'hộp ngăn kéo'], ['SUOT', 'suốt treo']];
  const keMau = ds => TEN_LOAI_MAU.map(([loai, ten]) => { const a = ds.filter(x => x.loai === loai); if (!a.length) return ''; const kh = [...new Set(a.map(x => x.khoang + 1))].sort((p, q) => p - q); return `${a.length} ${ten} (${kh.map(k => 'khoang ' + k).join(', ')})`; }).filter(Boolean).join(', ');
  // mẫu cùng tên trong kho của tài khoản đang đăng nhập (chỉ ĐỌC: thư mục + danh sách mẫu). Ngăn kéo: thư mục ngăn kéo; suốt treo: thư mục đã mua / phụ kiện trước, rồi vài thư mục khác. Tối đa 6 thư mục.
  const timMauCungTen = async tp => {
    if (!tp.ten) return 0;
    try {
      const dirs = await D.templateDirs(), nk = dirs.filter(d => /抽屉|ngăn kéo|drawer/i.test(d.ten));
      const ds = tp.loai === 'NGAN_KEO' ? nk : dirs.filter(d => /已购买|đã mua|purchased|五金|phụ kiện|衣/i.test(d.ten)).concat(dirs.filter(d => nk.indexOf(d) < 0 && !/已购买|đã mua|purchased|五金|phụ kiện|衣/i.test(d.ten)));
      for (const d of ds.slice(0, 6)) { let ms = []; try { ms = await D.templatesIn(d.id); } catch (e) { continue; } const m = ms.find(x => x.ten === tp.ten && x.id && x.id !== tp.id); if (m) return m.id; }
    } catch (e) { /* không đọc được kho thì thôi: coi như không có mẫu cùng tên */ }
    return 0;
  };
  /**
   * Thêm các mẫu của tủ (M.templates) vào đúng chỗ thiết kế + `offset`. Phần tấm của tủ phải vẽ xong trước.
   * @returns { added: đối tượng mới, thieu: [{ tp, mat, loai, khoang, id, ten, ly_do: 'may_chu' | 'khong_thuoc_tk' | 'lech' | 'huy', bao }], doi_ma: [{ tu, sang, ten }], so_lenh }
   */
  const themMau = async (M, offset, opt) => {
    const kq = { added: [], thieu: [], doi_ma: [], so_lenh: 0 };
    const ds = Core.mauCF(M).map(x => ({ tp: x.tp, mat: x.mat, json: x.json, xong: false, ly_do: '', bao: '' }));
    if (!ds.length) return kq;
    const ganDiem = (a, b, t) => a.every((v, i) => Math.abs(v - b[i]) <= t);
    const muc = x => { const id = mauLoi.thay.get(x.tp.id); return id ? Object.assign({}, x.json, { TempalteId: id }) : x.json; };
    const boQua = x => mauLoi.khong_thuoc.has(x.tp.id) && !mauLoi.thay.has(x.tp.id);
    const nhap = async nhom => {
      kq.so_lenh++;
      const h0 = hmMark();
      try {
        const res = await D.importCF({ ModelSpace: nhom.map(muc) }, null, Object.assign({}, opt, { mau: nhom.map(x => ({ kich: x.tp.box, pos: x.tp.pos })), doi: offset, co_mau: true, cho_im: opt.cho_mau > 0 ? opt.cho_mau : 40000 }));
        if (res.cancelled) return { ok: false, ly_do: 'huy' };
        // kiểm lại: gốc hộp từng mẫu phải nằm đúng chỗ thiết kế — lệch thì bỏ lệnh vừa rồi, không để ngăn kéo nằm sai chỗ trong tủ
        const G = gocMauCua(res.added), dung = new Set();
        const lech = nhom.some(x => { const h = G.find(g => !dung.has(g) && ganDiem(g.kich, x.tp.box, 0.1) && ganDiem(g.goc, x.tp.pos.map((v, i) => v + offset[i]), 0.1)); if (h) dung.add(h); return !h; });
        if (lech) { const h1 = hmMark(); if (h0 && h1 && h1.i > h0.i) await D.undo(h1.i - h0.i); return { ok: false, ly_do: 'lech', bao: 'Chenfeng đặt mẫu lệch chỗ thiết kế' }; }
        kq.added.push(...res.added); for (const x of nhom) x.xong = true;
        return { ok: true };
      } catch (e) { return { ok: false, ly_do: (e && e.ly_do) || 'may_chu', bao: (e && e.bao && e.bao.join(' | ')) || '', treo: !!(e && e.qua_gio), loi: String(e && e.message || e) }; }
    };
    // máy chủ treo (không trả lời trong hạn): lệnh nhập cũ còn chạy ngầm trong Chenfeng → không gửi thêm lệnh nhập nào nữa, các mẫu còn lại coi như chưa thêm được
    const thoiVi = (r, con) => { for (const y of con) if (!y.xong) { y.ly_do = 'may_chu'; y.treo = true; y.bao = ''; } };
    const thu = ds.filter(x => !boQua(x));
    for (const x of ds) if (boQua(x)) x.ly_do = 'khong_thuoc_tk';
    if (thu.length) {
      opt.onStatus(`Đang thêm ${keMau(thu.map(x => x.tp))} — Chenfeng tải mẫu từ máy chủ…`);
      let r = await nhap(thu);
      if (!r.ok && r.ly_do === 'huy') for (const x of thu) x.ly_do = 'huy';
      else if (!r.ok && r.treo) thoiVi(r, thu);
      else if (!r.ok) {
        // cả cụm hỏng (một mẫu hỏng là Chenfeng huỷ cả lệnh) → thêm TỪNG mẫu: lỗi máy chủ thì thử lại một lần; máy chủ rớt liền 2 mẫu thì thôi, không bắt chờ từng mẫu
        let hongLien = 0; const maHong = new Set();
        for (let i = 0; i < thu.length; i++) {
          const x = thu[i];
          if (boQua(x)) { x.ly_do = 'khong_thuoc_tk'; continue; }
          if (hongLien >= 2) { x.ly_do = 'may_chu'; continue; }
          const soLan = maHong.has(x.tp.id) ? 1 : 2;
          for (let lan = 1; lan <= soLan && !x.xong; lan++) {
            opt.onStatus(`Thêm ${x.tp.loai === 'SUOT' ? 'suốt treo' : 'hộp ngăn kéo'} khoang ${x.tp.khoang + 1} (${i + 1}/${thu.length})${lan > 1 ? ' — thử lại' : ''}…`);
            if (lan > 1) await sleep(1500);
            r = await nhap([x]);
            if (r.ok) break;
            x.ly_do = r.ly_do; x.bao = r.bao || '';
            if (r.ly_do === 'huy' || r.treo || r.ly_do === 'lech') break;      // đặt lệch là chuyện của cách Chenfeng đặt mẫu — thử lại cũng lệch như thế
            if (r.ly_do === 'khong_thuoc_tk') {
              const id0 = x.tp.id;
              if (mauLoi.khong_thuoc.has(id0)) break;      // mẫu thay cũng không dùng được
              mauLoi.khong_thuoc.add(id0);
              opt.onStatus(`Mã mẫu ${id0} không thuộc tài khoản Chenfeng này — đang tìm mẫu cùng tên trong kho của tài khoản…`);
              const id2 = await timMauCungTen(x.tp);
              if (!id2) break;
              mauLoi.thay.set(id0, id2); lan = 0;            // thử lại từ đầu bằng mẫu cùng tên của tài khoản
            }
          }
          if (x.xong) { hongLien = 0; continue; }
          if (r.treo) { thoiVi(r, thu.slice(i)); break; }
          if (x.ly_do === 'huy') { for (const y of thu.slice(i + 1)) if (!y.xong) y.ly_do = 'huy'; break; }
          if (x.ly_do === 'lech') { for (const y of thu.slice(i + 1)) if (!y.xong) { y.ly_do = 'lech'; y.bao = x.bao; } break; }      // một mẫu thêm riêng mà vẫn lệch → các mẫu còn lại cũng sẽ lệch: thôi
          if (x.ly_do === 'may_chu') { hongLien++; maHong.add(x.tp.id); }
        }
      }
    }
    for (const [tu, sang] of mauLoi.thay) { const x = ds.find(y => y.tp.id === tu && y.xong); if (x) kq.doi_ma.push({ tu, sang, ten: x.tp.ten }); }
    kq.thieu = ds.filter(x => !x.xong).map(x => ({ tp: x.tp, mat: x.mat, loai: x.tp.loai, khoang: x.tp.khoang, id: x.tp.id, ten: x.tp.ten, ly_do: x.ly_do || 'may_chu', bao: x.bao, treo: !!x.treo }));
    // máy chủ treo: lệnh thêm mẫu bị bỏ còn chạy ngầm, Chenfeng chưa nhận lệnh nào khác. Chờ nó kết thúc (tối đa 25 giây — máy chủ trả lời trễ thì bảng huỷ lời hỏi điểm của nó);
    // vẫn chưa xong thì `ban` = true: nơi gọi bỏ qua các bước cần lệnh của Chenfeng (khoan lại, gom module) và báo rõ.
    if (kq.thieu.some(x => x.treo)) { opt.onStatus('Máy chủ Chenfeng chưa trả lời — chờ Chenfeng bỏ lệnh thêm mẫu…'); kq.ban = !(await choLenhTre(opt.cho_tre > 0 ? opt.cho_tre : 25000)); }
    return kq;
  };
  const BAO_BAN = 'Chenfeng còn đang chờ máy chủ nên chưa nhận lệnh nào khác: bảng chưa ghi lại kiểu khoan, chưa gom tủ thành module được. Khi Chenfeng hết chờ (hoặc tải lại trang Chenfeng), bấm “Cập nhật tủ này” để bảng vẽ lại cho trọn.';
  /** Lời báo cho người dùng về mẫu chưa thêm được / mẫu đã đổi mã (để đưa vào danh sách lưu ý của lần vẽ). */
  const baoMau = tm => {
    const out = [];
    for (const d of tm.doi_ma) out.push(`Ngăn kéo / suốt treo: mã mẫu ${d.tu} (${d.ten}) ghi ở thẻ Chuẩn xưởng không thuộc kho mẫu của tài khoản Chenfeng đang đăng nhập — đã dùng mẫu cùng tên của tài khoản này (mã ${d.sang}). Bấm “Dò mã mẫu từ kho Chenfeng” ở thẻ Chuẩn xưởng để lưu mã đúng.`);
    const theo = ly => tm.thieu.filter(x => x.ly_do === ly);
    const lech = theo('lech');
    if (lech.length) out.push(`Chưa thêm được ${keMau(lech)}: Chenfeng đặt mẫu lệch chỗ thiết kế nên bảng đã bỏ các mẫu đó (không để ngăn kéo / suốt treo nằm sai trong tủ). Phần tấm của tủ đã vẽ đủ. Có thể bản Chenfeng vừa đổi cách đặt mẫu — báo lại để sửa bảng; trong lúc chờ, chèn ngăn kéo / suốt treo bằng lệnh của Chenfeng.`);
    const mc = theo('may_chu');
    if (mc.length) {
      const b = mc.map(x => x.bao).find(Boolean), treo = mc.some(x => x.treo);
      out.push(`Chưa thêm được ${keMau(mc)}: ${treo ? 'máy chủ Chenfeng không trả lời (mạng tới máy chủ Chenfeng đang chậm hoặc rớt)' : 'máy chủ Chenfeng không trả mẫu (mạng tới máy chủ Chenfeng đang chậm hoặc rớt — bảng đã thử lại)'}. Phần tấm của tủ đã vẽ đủ; lúc mạng ổn bấm “Cập nhật tủ này” để bảng vẽ lại tủ kèm ngăn kéo / suốt treo.${b ? ` (Chenfeng báo: “${String(b).slice(0, 110)}”)` : ''}`);
    }
    const tk = theo('khong_thuoc_tk');
    if (tk.length) { const ma = [...new Map(tk.map(x => [x.id, x.ten])).entries()].map(([id, ten]) => `${id} (${ten})`).join(', '); out.push(`Chưa thêm được ${keMau(tk)}: mã mẫu ${ma} ghi ở thẻ Chuẩn xưởng không thuộc kho mẫu của tài khoản Chenfeng đang đăng nhập, và tài khoản này không có mẫu cùng tên. Vào thẻ Chuẩn xưởng bấm “Dò mã mẫu từ kho Chenfeng” (hoặc gõ mã mẫu của chính tài khoản này), rồi bấm “Cập nhật tủ này”.`); }
    const huy = theo('huy');
    if (huy.length) out.push(`Chưa thêm ${keMau(huy)}: lệnh thêm mẫu bị huỷ (Esc). Bấm “Cập nhật tủ này” để bảng vẽ lại tủ kèm ngăn kéo / suốt treo.`);
    return out;
  };
  // thiết kế chỉ còn những mẫu đã thêm được (để phép đối chiếu không báo "mặt ngăn kéo lệch" cho hộp ngăn kéo chưa có)
  const boMauThieu = (M, tm) => {
    const tp = new Set(tm ? tm.thieu.map(x => x.tp) : []);
    for (const t of M.templates) if (!t.id) tp.add(t);      // loại chưa khai mã mẫu: mẫu đó không được vẽ → không đòi mặt ngăn kéo của nó (trước bản 1.26 báo oan "Mẫu ngăn kéo đặt mặt khác thiết kế")
    if (!tp.size) return M;
    const mat = new Set([...tp].map(t => M.mat_ngan_keo[t.mat]).filter(Boolean));
    return Object.assign({}, M, { templates: M.templates.filter(t => !tp.has(t)), mat_ngan_keo: M.mat_ngan_keo.filter(q => !mat.has(q)) });
  };
  const gonMauThieu = tm => tm.thieu.map(x => ({ loai: x.loai, khoang: x.khoang, id: x.id, ten: x.ten, ly_do: x.ly_do }));

  const drawImpl = async (spec, opt) => {
    opt = Object.assign({ onStatus() {} }, opt || {});
    opt.onStatus = guard(opt.onStatus);
    const M = Core.build(spec);
    if (M.errors.length) return { ok: false, giai_doan: 'thiet_ke', errors: M.errors, warnings: M.warnings };
    const id = opt.id ? String(opt.id) : D.newId();
    const cf = Core.toChenfeng(M, { id, khong_mau: true });      // bản 1.23: chỉ phần TẤM (không cần máy chủ); ngăn kéo / suốt treo thêm sau — xem themMau
    const n3 = a => Array.isArray(a) && a.length === 3 && a.every(v => typeof v === 'number' && isFinite(v));
    if ((opt.corner && !n3(opt.corner)) || (opt.at && !n3(opt.at))) return { ok: false, giai_doan: 'nhap', errors: ['Toạ độ đặt tủ phải là 3 số [x, y, z].'], warnings: M.warnings };
    const point = opt.corner ? opt.corner.slice() : opt.at ? [opt.at[0] + cf.base[0], opt.at[1] + cf.base[1], opt.at[2] + cf.base[2]] : null;
    const h0 = hmMark();
    let res;
    try { res = await D.importCF(cf.json, point, Object.assign({}, opt, { co_mau: false })); }
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
    // ngăn kéo / suốt treo: thêm SAU phần tấm (mẫu hỏng thì tủ vẫn đủ tấm)
    let tm = { added: [], thieu: [], doi_ma: [], so_lenh: 0 };
    try { tm = await themMau(M, offset, opt); } catch (e) { tm.thieu = Core.mauCF(M).map(x => ({ tp: x.tp, mat: x.mat, loai: x.tp.loai, khoang: x.tp.khoang, id: x.tp.id, ten: x.tp.ten, ly_do: 'may_chu', bao: String(e && e.message || e) })); }
    added = added.concat(tm.added);
    const before = new Set(root.app.Database.ModelSpace.Entitys);
    let fix = { fixed: 0, normalized: 0 };
    if (!tm.ban) { try { fix = await D.finalize(added.filter(D.isBoard), M.spec.khoan.thung, opt); } catch (e) { fix = { fixed: 0, normalized: 0, reason: e.message }; } }
    added = docLaiDS(added, before);
    const Mco = boMauThieu(M, tm);
    const v = D.verify(Mco, added, offset);      // đối chiếu TRƯỚC khi gom module (gom rồi thì mọi tấm chung một mẫu, phép dò va chạm bỏ qua tấm cùng mẫu)
    let mod = null;
    if (M.spec.module_cf && opt.module !== false && v.thieu.length === 0 && !tm.ban) {
      try { mod = await D.modelize(M.spec, offset, added, opt); } catch (e) { mod = { ok: false, reason: String(e && e.message || e) }; }
      added = docLaiDS(added, before);      // lệnh MODELING khoan lại các tấm vừa gom: lỗ của tủ giờ là đối tượng khác
      if (mod && mod.ok) { const v2 = D.verify(Mco, added, offset); if (v2.thieu.length) { mod.ok = false; mod.reason = `gom module làm lệch ${v2.thieu.length} tấm (${v2.thieu.slice(0, 2).join('; ')}).`; } }
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
    const want = Mco.templates.filter(tp => tp.id).length;
    const gotHW = Object.values(v.phu_kien).reduce((a, b) => a + b, 0);
    if (want && !gotHW) warnings.push('Không thấy phụ kiện nào của mẫu ngăn kéo / suốt treo — kiểm tra mã mẫu ở tab Chuẩn xưởng.');
    warnings.push(...baoMau(tm));
    if (tm.ban) warnings.push(BAO_BAN);
    const dl = doLoiSauVe(added, errors, { dai: M.spec.van.kho_dai, rong: M.spec.van.kho_rong });
    opt.onStatus('Xong.');
    const h1 = hmMark();
    let steps = 1 + ((fix.fixed || fix.normalized) ? 1 : 0);
    if (h0 && h1 && h1.i > h0.i && h1.i - h0.i <= 6 + tm.so_lenh) steps = h1.i - h0.i;
    D.last = { M, added, offset, steps, mark: h1, id };
    return { ok: errors.length === 0, giai_doan: 'xong', id, errors, warnings, notes: M.notes, offset, goc: offset.map((x, i) => r2(x + cf.base[i])), kiem_tra: v, do_loi: dl, sua_khoan: fix, so_buoc_hoan_tac: steps, module: mod, kich: Core.heSo(M.spec).kich, tom_tat: Core.summary(M),
      mau_thieu: gonMauThieu(tm), mau_doi: tm.doi_ma };
  };

  /* ------------------------------------------------------------------ *
   * SỬA TỦ ĐÃ VẼ (bản 1.6): mỗi tấm tiện ích vẽ mang ghi chú [KHOA_TU, mã lần vẽ] → chọn 1 tấm là tìm lại cả tủ,
   * bỏ đúng các đối tượng của tủ đó bằng lệnh ERASE của Chenfeng rồi vẽ lại tại chỗ theo thông số mới.
   * ------------------------------------------------------------------ */
  D.TAG = Core.KHOA_TU;
  D.newId = () => { let t = ''; const A = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; for (let i = 0; i < 8; i++) t += A[Math.floor(Math.random() * A.length)]; return t; };
  /** Mã tủ ghi trên tấm ('' nếu tấm không do tiện ích vẽ / vẽ từ bản trước 1.6). */
  D.tagOf = e => { try { return Core.maTuCuaGhiChu(e && e.BoardProcessOption && e.BoardProcessOption.remarks); } catch (err) { return ''; } };
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
      // (bản 1.26) ngăn kéo vẽ bằng lệnh DRAWER gốc là một nhánh trong cây mẫu của thùng: … → 抽屉总空间 → 抽屉根空间 → 抽屉空间 → <mẫu ngăn kéo>; mẫu mang tên TRONG KHO của tài khoản
      // (có thể khác tên ghi ở Chuẩn xưởng) → nhận cả theo các nút "抽屉…空间" của nhánh đó
      const mauTen = e => { try { let o = e.Template && e.Template.Object, n = 0; while (o && n++ < 40) { let nm = ''; try { nm = String(o.Name || ''); } catch (er) { /* bỏ qua */ } if (ten.has(nm) || /^抽屉(总|根)?空间$/.test(nm)) return o; o = o.Parent && o.Parent.Object; } } catch (er) { /* bỏ qua */ } return null; };
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
  const DAU_KHOA = '(chỉ xem';      // dấu trong ô ghi chú của tham số module bị khoá (ganHeSo ghi, D.specTheoModule đọc — ghi chú đi theo bản vẽ khi lưu / mở lại)
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
      // (bản 1.26.1) tham số bị KHOÁ (vd Rộng của tủ có cột giữa — ganHeSo ghi dấu "(chỉ xem" vào ô ghi chú của nó): người dùng gõ số mới vào ô đó thì ô nhận số nhưng không tấm nào chạy,
      // nên số đó không phải kích thước thật của tủ → bỏ qua, dò tủ theo số lúc vẽ. Nhận theo DẤU trong ghi chú chứ không theo "không có hành động": tủ lệnh gốc có khi không tấm rời nào
      // chạy theo Sâu (module mẹ không có hành động W) mà thùng vẫn co giãn bằng biểu thức. Tủ vẽ từ bản trước (không có dấu) thì lấy theo module như cũ.
      try { const T = rootTpl(b); ['L', 'W', 'H'].forEach((n, i) => { const p = T && T.GetParam(n); if (p && String(p.description || '').indexOf(DAU_KHOA) >= 0) kt[i] = k0[i]; }); } catch (e) { /* không đọc được thì coi như không khoá */ }
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
      await guiLenh('MODELING');
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
   *  - hộp ngăn kéo / suốt treo (mẫu kho đã chèn, nằm trong `added`): thành mẫu con của T, vị trí và kích thước là biểu thức theo _L / _W / _H
   *    (trừ các mẫu trong `boTp` — ngăn kéo vẽ bằng lệnh DRAWER gốc, bản 1.26).
   * Gốc của T phải là góc nhỏ nhất của cả tủ (hs.goc). kq: nơi ghi { bien[], mau_con, ghi_chu[] }.
   */
  const ganHeSo = (T, hs, M, cua, offset, added, kq, boTp) => {
    const mauHD = [T.LParam, T.WParam, T.HParam].map(pr => pr && pr.actions && pr.actions[0]).find(Boolean);
    if (!mauHD) { kq.ghi_chu.push('Module dùng cách co giãn mặc định của Chenfeng (không đọc được kiểu hành động).'); return false; }
    const HD = mauHD.constructor, V3 = mauHD.StretchDirection.constructor;
    const TRUC = { L: [1, 0, 0], W: [0, 1, 0], H: [0, 0, 1] };
    kq.khoa = kq.khoa || [];
    for (const ten of ['L', 'W', 'H']) {
      const b = hs.bien[ten], pr = T.GetParam(ten);
      if (!pr) continue;
      // (bản 1.26.1) Kích thước module không co giãn ĐÚNG được (tủ có cột giữa: L; đổi là đổi số tấm / thiết kế hỏng) → KHOÁ tham số đó: gỡ mọi hành động, chỉ để xem.
      // Không để lại hành động mặc định của lệnh MODELING (kéo thô: nửa bên kia dời nguyên, cánh không giãn) — gõ số mới ở ô Thông số mà tủ chạy sai kết cấu thì tệ hơn là tủ đứng yên.
      // Đã đo trên Chenfeng thật 05/10/2026: tham số L không hành động + mẫu con không bám _L → gõ L mới rồi Apply: không tấm nào chạy, không lỗi, L của module nhận số mới
      // (D.specTheoModule đọc được → "Sửa tủ đang chọn" mở đúng bề rộng đó để bấm "Cập nhật tủ này").
      if (!b) { pr.actions.length = 0; kq.khoa.push({ ten, ly_do: (hs.ly_do && hs.ly_do[ten]) || 'khong_deu' }); continue; }
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
      // tham số bị khoá: nói ngay tại ô ghi chú của nó trong bảng Thông số (như BH) — người gõ số ở đó thấy liền vì sao tủ không chạy
      const moTa = { L: 'Rộng phủ bì', W: 'Sâu phủ bì (cả cánh)', H: 'Cao phủ bì' }, ngan = { L: 'Rộng', W: 'Sâu', H: 'Cao' };
      for (const k of Object.keys(moTa)) {
        const kh = kq.khoa.find(x => x.ten === k);
        try { const pr = T.GetParam(k); if (pr) pr.description = kh ? `${ngan[k]} ${DAU_KHOA} — ${kh.ly_do === 'cot_giua' ? 'tủ có cột giữa: ' : ''}đổi ở bảng Một Nhà)` : moTa[k]; } catch (e) { /* bỏ qua */ }
      }
    } catch (e) { /* bỏ qua */ }
    // hộp ngăn kéo / suốt treo → mẫu con, kích thước và vị trí bám theo L / W / H của tủ
    // (boTp: chỉ số các mẫu đã vẽ bằng lệnh ngăn kéo gốc — chúng là một nhánh trong cây mẫu của thùng, tự chạy theo thùng)
    const dsMau = M.templates.map((t, i) => ({ t, i })).filter(x => x.t.id && !(boTp && boTp.has(x.i)));
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
    const kq = { ok: true, steps, ten: '', bien: [], khoa: [], mau_con: 0, ghi_chu: [] };
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
  const ganModuleGoc = async (K, offset, tamCua, added, id, opt, boTp) => {
    const M = K.M, hs = K.hs, kq = { ok: false, steps: 0, ten: '', bien: [], khoa: [], mau_con: 0, thung: 0, ghi_chu: [] };
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
      if (!ganHeSo(T, hs, M, cua, offset, added, kq, boTp)) throw new Error('không đọc được kiểu hành động co giãn của module');
      // (tham số nào đổi là đổi số tấm: ganHeSo đã khoá — không để hành động mặc định của Chenfeng kéo riêng phào trong khi thùng đứng yên)
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
      await guiLenh('ERASE');
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
    let mauCu = null;      // bản 1.21: tủ cũ đã đổ màu → tủ vẽ lại mang lại đúng màu đó (tấm mới sinh ra là vật liệu mặc định)
    try { mauCu = D.mauCuaTu(ents.filter(D.isBoard)); } catch (e) { mauCu = null; }
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
    if (mauCu && mauCu.co) { opt.onStatus('Đang đổ lại màu của tủ cũ…'); rep.giu_mau = await giuMau(mauCu); if (rep.giu_mau.ok) rep.so_buoc_hoan_tac += rep.giu_mau.steps || 0; }
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
    const ok = nut.find(b => TEN_OK.test(chuNut(b))) || nut.find(laNutOK) || nut[0];
    if (!ok) return false;
    ok.click();
    await cho(() => !hopThoai(), 4000);
    return ins.length >= vals.length;
  };
  const dongHopThoai = async () => { const d = hopThoai(); if (!d) return; const c = [...d.querySelectorAll('button')].find(b => TEN_HUY.test(chuNut(b))) || d.querySelector('.bp3-dialog-close-button'); if (c) { c.click(); await sleep(300); } };
  // Hạn chờ của các lệnh phòng (ms) — phép thử chỉnh thẳng vào D.CH. han_lenh: lệnh đã bắt đầu thì chờ lời nhắc đầu tiên tối đa chừng này; cho_bat_dau: không rõ Chenfeng đã nhận lệnh chưa thì chờ chừng này;
  // bao_cho: chờ quá chừng này thì nói cho người dùng biết đang chờ gì.
  D.CH = { han_lenh: 60000, cho_bat_dau: 8000, bao_cho: 3000, do_cach: 400 };
  // Vì sao lần moLenh gần nhất không mở được lệnh: '' | 'hop_mo' (Chenfeng đang mở một hộp thoại — tên hộp ở lenhBan; chưa gửi gì) | 'ban' (Chenfeng đang chạy dở một lệnh khác — tên ở lenhBan)
  // | 'khong_bat_dau' (Chenfeng không nhận lệnh — lời nó báo, nếu có, ở lenhBao) | 'het' (Chenfeng nhận lệnh rồi tự kết thúc, không hỏi gì) | 'qua_han' (lệnh đã bắt đầu, quá hạn vẫn chưa hỏi — đang chờ máy chủ)
  // | 'hop' (hộp thông số không nhận số)
  let lyDoLenh = '', lenhBan = '', lenhBao = '', dangLenhPhong = 0;      // lenhBao: dòng báo (toast) Chenfeng hiện ra trong lúc lệnh đó chạy — để nói lại cho người dùng
  const tenHop = () => { try { const d = hopThoai(), h = d && (d.querySelector('.bp3-dialog-header .bp3-heading') || d.querySelector('.bp3-heading') || d.querySelector('.bp3-dialog-header')); return String((h && h.textContent) || '').replace(/\s+/g, ' ').trim().slice(0, 40); } catch (e) { return ''; } };
  // dòng báo mới của Chenfeng (không kể dòng báo "thành công" — vd "đã tạo vật liệu sàn mặc định" hiện ngay trước dòng báo lỗi thật)
  const baoMoi = cu => { try { return [...document.querySelectorAll('.bp3-toast')].filter(t => !cu.has(t) && !t.classList.contains('bp3-intent-success')).map(t => String(t.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 2).join(' / ').slice(0, 120); } catch (e) { return ''; } };
  // Lệnh phòng bị bảng bỏ vì quá hạn VẪN CHẠY NGẦM trong Chenfeng (như lệnh nhập — xem canhLenhTre): máy chủ rốt cuộc trả lời thì lệnh hỏi hướng nhìn / hỏi điểm / mở hộp thông số mà không còn ai trả lời
  // → canh tối đa 3 phút, thấy thì Esc (đã đo: lệnh đang hỏi thì Esc kết thúc được nó) / bấm Cancel của hộp (đã đo: Esc không đóng được hộp thông số). Chỉ làm khi bảng không đang chạy lệnh nào
  // (người dùng bấm vẽ lại thì lần đó tự dùng lời nhắc của lệnh cũ) và lệnh bắt đầu gần nhất của Chenfeng vẫn là lệnh đó.
  const canhLenhPhong = () => {
    const ten = tenLenhCuoi(), tre = { xong: false }, w = watchEnd(); lenhTre = tre;
    (async () => {
      const t0 = Date.now();
      try {
        while (Date.now() - t0 < 180000) {
          await sleep(300);
          if (w.ended || (ten && tenLenhCuoi() !== ten)) break;
          if (dangNhap || dangLenhPhong) continue;
          if (hopThoai()) { await dongHopThoai(); break; }
          if (D.busy()) { ed().Cancel(); await sleep(400); break; }
        }
      } catch (e) { /* bỏ qua */ }
      w.off(); tre.xong = true;
    })();
  };
  /**
   * Gọi một lệnh phòng rồi chờ nó hỏi điểm. coHop = các số điền vào hộp thông số của lệnh (cột, dầm); onCho() được gọi một lần khi đã chờ quá D.CH.bao_cho.
   * Lệnh hỏi "đang không nhìn từ trên — chuyển sang nhìn từ trên?" (và "về hệ toạ độ gốc?") trước → trả lời 1 (có).
   * (bản 1.26.1) ĐÃ ĐO trên Chenfeng thật 05/10/2026 tối (bản 2026-9-29) + đọc mã:
   *  - Lệnh vẽ tường / mở lỗ (đầu lệnh) và vẽ dầm (sau hộp thông số) CHỜ tải vật liệu sàn mặc định từ kho file của Chenfeng khi bản vẽ chưa có (InitWallMaterial), lệnh vẽ tường còn đọc cấu hình
   *    (LoadAndInitConfig) — rồi mới hỏi. Máy đã vẽ phòng rồi thì 0,2 giây (Chrome nhớ file 20 ngày); máy / hồ sơ Chrome mới, mạng tới Chenfeng chậm: 4 giây, có lần quá 20 giây.
   *    Hạn chờ cũ (5 giây chờ lời nhắc) → bảng báo oan "Chenfeng không nhận lệnh vẽ tường" rồi gửi tiếp lệnh cửa, cột trong khi lệnh tường còn chạy ngầm (anh Thanh 05/10/2026 18:17:
   *    "không vẽ được phòng nữa rồi"). Giờ: lệnh ĐÃ BẮT ĐẦU thì chờ tới D.CH.han_lenh; quá hạn thì trả 'qua_han' và canh lệnh tới trễ để huỷ.
   *  - Chenfeng nhận lệnh thì ghi NGAY (cùng nhịp với HandleInput) dòng loại COMMAND ">TÊN" vào dòng lệnh và đổi CommandReactor._cmdName. Đang chạy dở một lệnh khác thì chữ gửi vào bị
   *    chuyển cho lệnh đó, KHÔNG báo gì (dòng 命令:"X"正忙 chỉ có ở đường thả file) → không thấy dòng ">TÊN" = Chenfeng đang chạy dở lệnh _cmdName. Esc không dừng được lệnh đang chờ máy chủ
   *    hay đang mở hộp thông số → không gửi gì thêm, báo tên lệnh đang chạy dở. Lệnh chạy dở CÙNG TÊN (lệnh của lần bấm trước tới trễ) → dùng luôn lời nhắc của nó.
   *  - Hộp thoại của Chenfeng đang mở sẵn: lệnh gửi lúc này sẽ rơi mất, mà hộp đó không chắc của ai → không đụng, báo tên hộp ('hop_mo').
   *  - Sự kiện "lệnh kết thúc" mang tên lệnh; hộp thông số của lệnh cột mở ra KHÔNG phát sự kiện đó.
   * Trả true khi lệnh đang hỏi điểm; false thì lý do nằm ở lyDoLenh.
   */
  const moLenh = async (ten, coHop, onCho) => {
    lyDoLenh = ''; lenhBan = ''; lenhBao = '';
    if (hopThoai()) { lenhBan = tenHop(); lyDoLenh = 'hop_mo'; return false; }
    const toast0 = new Set(document.querySelectorAll('.bp3-toast'));
    if (D.busy()) await D.cancel();
    const moc = logMark(), w = watchEnd(), t0 = Date.now();
    const trungTen = t => String(t == null ? '' : t).replace(/^>/, '').trim().toUpperCase() === ten;
    let daHop = !coHop, traLoi = 0, daBao = false, batDau = false;
    try {
      await guiLenh(ten);
      for (;;) {
        await sleep(80);
        const tg = Date.now() - t0;
        if (!batDau) {
          const dong = logsSince(moc);
          if (dong.some(q => q.type === 'COMMAND' && trungTen(q.msg))) batDau = true;      // Chenfeng đã nhận lệnh
          else {
            const tuChoi = dong.find(q => /^(WARNING|ERROR)$/i.test(String(q.type))), bao = tuChoi ? '' : baoMoi(toast0), dang = tenLenhCuoi();
            if (tuChoi || bao) { lenhBao = tuChoi ? String(tuChoi.msg || '').replace(/^>/, '').replace(/\s+/g, ' ').trim().slice(0, 120) : bao; lyDoLenh = 'khong_bat_dau'; break; }      // Chenfeng từ chối và có nói vì sao (khung nhìn bị khoá, lệnh bị cấm…)
            if (dang && trungTen(dang)) batDau = true;      // lệnh cùng tên đang chạy dở (của lần bấm trước, tới trễ) → dùng luôn lời nhắc của nó
            else if (dang) { lenhBan = dang; lyDoLenh = 'ban'; break; }
            else if (tg > D.CH.cho_bat_dau) { lyDoLenh = 'khong_bat_dau'; break; }
            else continue;
          }
        }
        if (!daHop && hopThoai()) { if (!(await dienHopThoai(coHop))) { lyDoLenh = 'hop'; break; } daHop = true; continue; }
        if (daHop && ready(gp())) break;
        if (ready(kw()) && !ready(gp()) && traLoi < 2) { D.input('1'); traLoi++; await sleep(250); continue; }
        if (w.ok && w.ended && trungTen(w.ended.name)) { lyDoLenh = 'het'; break; }      // Chenfeng tự kết thúc lệnh mà không hỏi gì (lệnh hỏng giữa chừng, khung nhìn bố cục ở bản Chenfeng không cho biết trước…)
        if (tg > D.CH.han_lenh) { lyDoLenh = 'qua_han'; break; }
        if (!daBao && tg > D.CH.bao_cho && onCho) { daBao = true; try { onCho(); } catch (e) { /* bỏ qua */ } }
      }
    } finally { w.off(); }
    if (lyDoLenh) {
      if (!lenhBao) lenhBao = baoMoi(toast0);
      if (lyDoLenh === 'qua_han') canhLenhPhong();                                                  // lệnh vẫn đang chờ máy chủ: canh lúc nó tới trễ để huỷ
      else if (lyDoLenh !== 'ban') { await dongHopThoai(); if (D.busy()) await D.cancel(); }      // 'ban': lệnh đang chạy dở không phải của lần này — không đụng
      return false;
    }
    await sleep(450);
    return true;
  };
  const datSo = async (phim, so) => { D.input(phim); await sleep(350); D.input(String(Math.round(so * 100) / 100)); await sleep(350); };
  const xongLenh = async ms => { await cho(() => !D.busy(), ms || 6000); if (D.busy()) await D.cancel(); await sleep(150); };

  /** Bỏ dấu tiếng Việt (đ → d) — dùng cho chữ ghi vào nhãn của Chenfeng, phông ở đó thiếu chữ có dấu. */
  D.khongDau = t => String(t == null ? '' : t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/\s+/g, ' ').trim();

  /**
   * Thả một bản vẽ DXF (chuỗi) vào Chenfeng (bản 1.18): Chenfeng tự dựng Line / Circle / Polyline / Text đúng toạ độ trong file — lệnh "CAD图纸导入", 1 bước hoàn tác.
   * Chenfeng hỏi "文件是否插入前视图？" (có xoay file sang mặt trước không) → trả lời N để giữ nguyên toạ độ. Tài khoản bật sẵn "luôn chèn mặt trước" thì Chenfeng không hỏi
   * mà xoay luôn → gọi kèm `hop` (hộp bao mong đợi của các nét) để phát hiện và hoàn tác.
   * @returns { ok, ents, reason }
   */
  D.importDXF = async (text, opt) => {
    opt = opt || {};
    if (!D.available() || !D.editing()) return { ok: false, ents: [], reason: 'Chenfeng chưa ở màn hình vẽ.' };
    if (D.busy()) await D.cancel();
    const truoc = new Set(root.app.Database.ModelSpace.Entitys), h0 = hmMark();
    const moi = () => root.app.Database.ModelSpace.Entitys.filter(e => e && !truoc.has(e) && !e.IsErase);
    let nhan = false;
    try {
      const f = new File([String(text)], opt.ten || 'dien-nuoc.dxf', { type: 'application/dxf' }), dt = new DataTransfer(); dt.items.add(f);
      const ev = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt });
      document.dispatchEvent(ev); nhan = ev.defaultPrevented;
    } catch (e) { return { ok: false, ents: [], reason: String(e && e.message || e) }; }
    if (!nhan) return { ok: false, ents: [], reason: 'Chenfeng không nhận file (trang này chưa mở bản vẽ?).' };
    await cho(() => ready(kw()) || moi().length > 0, 6000);
    if (ready(kw())) { D.input('N'); await sleep(200); }
    await cho(() => !D.busy(), 10000);
    if (D.busy()) await D.cancel();
    await sleep(250);
    const ents = moi();
    if (!ents.length) return { ok: false, ents, reason: 'Chenfeng không dựng được nét nào từ file.' };
    // đối chiếu vị trí: hộp bao các nét (không kể chữ) phải đúng hộp mong đợi
    if (opt.hop) {
      const b = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity];
      for (const e of ents) { if (tenLop(e) === 'Text') continue; try { const x = D.boxOf(e); for (let i = 0; i < 6; i += 2) { b[i] = Math.min(b[i], x[i]); b[i + 1] = Math.max(b[i + 1], x[i + 1]); } } catch (er) { /* bỏ qua */ } }
      const m = [opt.hop.x0, opt.hop.x1, opt.hop.y0, opt.hop.y1, opt.hop.z0, opt.hop.z1];
      if (b.some((v, i) => !isFinite(v) || Math.abs(v - m[i]) > 2)) {
        const h1 = hmMark(); if (h0 && h1 && h1.i > h0.i) await D.undo(h1.i - h0.i);
        return { ok: false, ents: [], lech: true, reason: 'Chenfeng đặt các nét lệch chỗ (tài khoản đang bật tuỳ chọn tự chèn file DXF vào mặt trước?) — đã bỏ các nét vừa dựng.' };
      }
    }
    return { ok: true, ents };
  };

  /**
   * Đối tượng phòng đang có trên bản vẽ → dữ liệu thuần cho MNCFPhong.doiChieuPhong (bản 1.23). Chỉ ĐỌC.
   * Đo trên Chenfeng thật 04/10/2026: RoomWallLine có RightCurves / LeftCurves (hai mặt tường, đã cắt theo góc), Thickness, Height, StartPoint (tim tường);
   * lỗ cửa RoomHolePolyline, cột RoomPillar, dầm RoomGirder: hộp bao chính là chỗ nó chiếm (lỗ cửa = bề rộng lỗ × bề dày tường × cao lỗ).
   * `ent` (không liệt kê) = đối tượng thật theo đúng thứ tự của từng danh sách.
   */
  D.docPhong = () => {
    const kq = { tuong: [], lo: [], cot: [], dam: [] }, ent = { tuong: [], lo: [], cot: [], dam: [] };
    for (const e of D.all()) {
      const lop = tenLop(e);
      try {
        if (lop === 'RoomWallLine') {
          const mat = [];
          for (const c of [].concat(e.RightCurves || [], e.LeftCurves || [])) { const a = c.StartPoint, b = c.EndPoint; if (a && b) mat.push([[r2(a.x), r2(a.y)], [r2(b.x), r2(b.y)]]); }
          let z = 0; try { z = r2(e.StartPoint.z || 0); } catch (er) { z = 0; }
          kq.tuong.push({ mat, day: r2(+e.Thickness || 0), cao: r2(+e.Height || 0), z, hop: D.boxOf(e) }); ent.tuong.push(e);
        } else if (lop === 'RoomHolePolyline') { kq.lo.push({ hop: D.boxOf(e) }); ent.lo.push(e); }
        else if (lop === 'RoomPillar') { kq.cot.push({ hop: D.boxOf(e) }); ent.cot.push(e); }
        else if (lop === 'RoomGirder') { kq.dam.push({ hop: D.boxOf(e) }); ent.dam.push(e); }
      } catch (err) { /* bỏ qua đối tượng lạ */ }
    }
    Object.defineProperty(kq, 'ent', { value: ent, enumerable: false });
    return kq;
  };
  // Dấu điện – nước cũ của một phòng: nét / chữ do file DXF của bảng dựng — màu theo nhóm (30 điện, 140 cấp, 34 thoát, 200 khác), nằm trong lòng phòng (`trong(hộp)` — phòng sắp vẽ
  // hoặc vùng của lần vẽ trước); chữ phải đúng mẫu nhãn của bảng ("O1 +300", "CN2", "TS1"…). Nét / chữ khác của người dùng (màu khác, chữ khác, nằm ngoài phòng) thì không đụng tới.
  const MAU_DAU_DN = [30, 140, 34, 200];
  const dauDienNuoc = trong => {
    const out = [];
    for (const e of D.all()) {
      const lop = tenLop(e); if (!/^(Line|Circle|Polyline|Text)$/.test(lop)) continue;
      let mau = null, b = null; try { mau = e.ColorIndex; b = D.boxOf(e); } catch (er) { continue; }
      if (MAU_DAU_DN.indexOf(mau) < 0 || !b || !b.every(isFinite) || !trong(b)) continue;
      if (lop === 'Text') { let t = ''; try { t = String(e.TextString || ''); } catch (er) { t = ''; } if (!/^(O|CT|CN|TN|D|TS|OS)\d+( \+\d+([.,]\d+)?)?$/.test(t)) continue; }
      out.push(e);
    }
    return out;
  };
  const maChuoi = t => { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) >>> 0; return h.toString(36) + '.' + t.length.toString(36); };

  /**
   * Vẽ phòng hiện trạng vào bản vẽ. H = MNCFPhong.hinhHoc(phòng).
   * opt: { day_tuong (mặc định 110), onStatus, dien_nuoc: MNCFPhong.dienNuocDXF(H) (dấu điện – nước, bản 1.18),
   *        da_ve: bản ghi lần vẽ trước của chính phòng này (MNCFPhong.banGhiPhong) — bản 1.23,
   *        bo_chong: người dùng đã đồng ý bỏ các tường / cột / dầm cũ nằm vướng trong lòng phòng sắp vẽ }
   * Bản 1.23 — vẽ lại không vẽ chồng: đối chiếu với phòng đang có (MNCFPhong.doiChieuPhong) → cái gì đã có đúng chỗ thì giữ, phần của lần vẽ trước nay không còn đúng thì bỏ
   * (một lệnh ERASE), chỉ vẽ cái còn thiếu; số tường đếm theo tường CÓ trên bản vẽ sau khi vẽ chứ không theo số đối tượng mới sinh
   * (Chenfeng không dựng đoạn tường trùng tường cũ — bảng cũ vì thế báo nhầm "chỉ vẽ được 0/4 tường").
   * @returns { ok, giai_doan?: 'chan' (dừng lại hỏi, chưa đụng bản vẽ), can_hoi?, errors, warnings, dem: {tuong, mo, cot, dam, dn} = số mục của phòng đang CÓ trên bản vẽ,
   *            them / giu / bo: {tuong, mo, cot, dam, dn} số mục vừa vẽ thêm / giữ nguyên / đã bỏ (bo.dn = số NÉT dấu điện – nước cũ đã bỏ), trung: {mo, cot, dam} số lỗ cửa / cột / dầm vẽ trùng đã dọn,
   *            khong_doi, da_ve: bản ghi mới, so_buoc_hoan_tac }
   */
  D.drawRoom = async (H, opt) => {
    D.boManChe();
    opt = Object.assign({ day_tuong: 110, onStatus() {} }, opt || {});
    opt.onStatus = guard(opt.onStatus);
    const errors = [], warnings = [], dem = { tuong: 0, mo: 0, cot: 0, dam: 0, dn: 0 };
    const them = { tuong: 0, mo: 0, cot: 0, dam: 0, dn: 0 }, giu = { tuong: 0, mo: 0, cot: 0, dam: 0, dn: 0 }, bo = { tuong: 0, mo: 0, cot: 0, dam: 0, dn: 0 }, trung = { mo: 0, cot: 0, dam: 0 };
    const tra = o => Object.assign({ ok: false, errors, warnings, dem, them, giu, bo, trung }, o);
    if (!D.available()) return tra({ errors: ['Không thấy bản vẽ Chenfeng trong trang này.'] });
    if (!H || !H.tuong || !H.tuong.length || (H.loi && H.loi.length)) return tra({ errors: (H && H.loi && H.loi.length ? H.loi : ['Phòng chưa có tường.']) });
    if (!D.editing()) return tra({ errors: ['Chenfeng đang ở trang chủ / màn chào — mở một bản vẽ rồi vẽ phòng.'] });
    // (bản 1.26.1) khung nhìn bố cục: lệnh vẽ tường của Chenfeng ở đó chỉ hiện một dòng báo rồi thôi (đọc mã FixDrawWallDir; app.Viewer.isLayout đã đo là true / false) → xem trước, khỏi gửi lệnh
    let boCuc = false; try { boCuc = root.app.Viewer.isLayout === true; } catch (e) { boCuc = false; }
    if (boCuc) return tra({ errors: ['Chenfeng đang ở khung nhìn bố cục (layout) — ở đó Chenfeng không cho vẽ tường. Chuyển về khung nhìn mô hình rồi bấm “Vẽ phòng vào Chenfeng” lại.'] });
    const Ph = root.MNCFPhong;
    if (!Ph || typeof Ph.doiChieuPhong !== 'function') return tra({ errors: ['Thiếu phần tính phòng (MNCFPhong) — tải lại trang Chenfeng.'] });
    const o = (H.p && H.p.goc) || [0, 0, 0], cao = H.p.cao;
    const P = (q, z) => [q[0] + o[0], q[1] + o[1], (z || 0) + o[2]];
    const tren = (w, s, t) => [w.p0[0] + w.d[0] * s + w.n[0] * t, w.p0[1] + w.d[1] * s + w.n[1] * t];
    const dsLop = lop => D.all().filter(e => tenLop(e) === lop);
    const moi = Ph.phanPhong(H, opt.day_tuong), W = moi.tuong;
    let co = D.docPhong(), K = Ph.doiChieuPhong(moi, co, opt.da_ve || null);
    const cu = K.co_ban_ghi ? opt.da_ve : null;
    // tường khác (không phải của lần vẽ trước) nằm cắt ngang lòng phòng sắp vẽ → dừng lại hỏi, chưa đụng gì vào bản vẽ
    if (K.trong.length && !opt.bo_chong) {
      const kem = [K.chong.length > K.trong.length ? `${K.chong.length - K.trong.length} tường nằm chồng một phần lên tường mới` : '', K.thua.cot.length + K.thua.dam.length ? `${K.thua.cot.length + K.thua.dam.length} cột / dầm không khớp phòng mới` : ''].filter(Boolean);
      return tra({ giai_doan: 'chan', can_hoi: { trong: K.trong.length, chong: K.chong.length - K.trong.length, thua: K.thua.cot.length + K.thua.dam.length },
        errors: [`Chưa vẽ: trên bản vẽ đang có ${K.trong.length} tường khác nằm trong lòng phòng sắp vẽ${kem.length ? ` (cùng ${kem.join(', ')})` : ''} — có vẻ là phòng cũ vẽ từ bản trước hoặc vẽ tay. Bảng không tự xoá thứ không chắc là của nó: bấm nút bên dưới để bỏ các tường cũ đó rồi vẽ, hoặc dời “điểm đặt phòng” sang chỗ trống.`] });
    }
    const h0 = hmMark(), truoc = new Set(root.app.Database.ModelSpace.Entitys);
    try { ed().SelectCtrl.Cancel(); } catch (e) { /* bỏ qua */ }
    const that = { mo: moi.mo.map(() => false), cot: moi.cot.map(() => false), dam: moi.dam.map(() => false) };
    const dn = opt.dien_nuoc, coDn = !!(dn && dn.so > 0 && dn.dxf), maDn = coDn ? maChuoi(dn.dxf) : '';
    let coTuong = W.map(() => false), giuDau = false, soNetDn = 0;
    // (bản 1.26.1) Chenfeng không trả lời một lệnh (đang chờ máy chủ / đang bận lệnh khác) thì DỪNG: không gửi thêm lệnh nào — lệnh gửi lúc đó bị bỏ hết, chỉ sinh thêm dòng báo và lệnh treo.
    // Phần đã vẽ được giữ nguyên, bấm "Vẽ phòng" lại là vẽ nốt (bảng đối chiếu với cái đang có).
    let dung = '', dungVi = '';
    const giayCho = () => Math.round(D.CH.han_lenh / 1000);
    // Chenfeng đang chờ gì ở máy chủ? Đã đo: bản vẽ chưa có vật liệu sàn mặc định (Database.MaterialTable.CurFloorMtl) thì lệnh vẽ tường / mở lỗ / dầm tải vật liệu đó từ kho file của Chenfeng
    // rồi mới hỏi (lệnh vẽ cột thì không) — nói đúng chuyện đó; không thì chỉ nói chung là đang lấy dữ liệu của lệnh.
    const thieuVL = lenh => { if (lenh === 'DRAWPILLAR') return false; try { const mt = root.app.Database.MaterialTable; return !!mt && !mt.CurFloorMtl; } catch (e) { return false; } };
    const choGi = lenh => (thieuVL(lenh) ? 'bản vẽ này chưa có vật liệu sàn mặc định nên Chenfeng đang tải từ máy chủ của nó' : 'Chenfeng đang lấy dữ liệu của lệnh từ máy chủ của nó');
    const baoCho = (viec, lenh) => () => opt.onStatus(`Đang chờ Chenfeng trả lời lệnh ${viec} — ${choGi(lenh)}; mạng tới Chenfeng chậm thì phải chờ…`);
    const loiLenh = (viec, lenh) => (lyDoLenh === 'qua_han' ? `Chenfeng chưa trả lời lệnh ${viec} (${lenh}) sau ${giayCho()} giây — ${choGi(lenh)}, mà mạng tới Chenfeng đang chậm. Chưa có gì được vẽ thêm; đợi một lát rồi bấm “Vẽ phòng vào Chenfeng” lại.`
      : lyDoLenh === 'ban' ? `Chenfeng đang chạy dở lệnh “${lenhBan}” nên không nhận lệnh ${viec} — kết thúc lệnh đó trước (hộp thoại của nó đang mở thì bấm Cancel; nó đang hỏi điểm thì bấm vào vùng vẽ rồi nhấn Esc; chưa thấy hỏi gì thì đợi nó hỏi), rồi bấm “Vẽ phòng vào Chenfeng” lại.`
      : lyDoLenh === 'hop_mo' ? `Chenfeng đang mở ${lenhBan ? `hộp “${lenhBan}”` : 'một hộp thoại'} nên chưa nhận lệnh ${viec} — đóng hộp đó (Cancel) rồi bấm “Vẽ phòng vào Chenfeng” lại.`
      : `Chenfeng không nhận lệnh ${viec} (${lenh})${lenhBao ? ` — Chenfeng báo: “${lenhBao}”` : ''}.`);
    const treo = () => lyDoLenh === 'qua_han' || lyDoLenh === 'ban' || lyDoLenh === 'hop_mo' || lyDoLenh === 'khong_bat_dau';
    const chuaLam = cau => cau + (lyDoLenh === 'qua_han' ? `: Chenfeng chưa trả lời lệnh sau ${giayCho()} giây (máy chủ Chenfeng đang chậm)` : lyDoLenh === 'ban' ? `: Chenfeng đang chạy dở lệnh “${lenhBan}”` : lyDoLenh === 'hop_mo' ? `: Chenfeng đang mở ${lenhBan ? `hộp “${lenhBan}”` : 'một hộp thoại'}` : '') + '.';
    const dungLai = () => { if (treo()) { dung = 'sau'; dungVi = lyDoLenh; } };
    dangLenhPhong++;
    try {
      // dấu điện – nước cũ của phòng này: nằm trong lòng phòng sắp vẽ hoặc trong vùng của lần vẽ trước (phòng đã đổi cỡ / dời chỗ). Không cần bản ghi cũng nhận ra
      // (phòng vẽ từ bản trước) — nhờ thế bấm lại không đánh chồng một bộ dấu nữa. Giữ nguyên khi: có bản ghi, nội dung không đổi, trên bản vẽ còn ĐÚNG số nét đã dựng.
      const vungCu = cu ? Ph.vungBanGhi(cu) : null;
      const dauCu = dauDienNuoc(b => Ph.trongLongPhong(moi, b) || (!!vungCu && Ph.trongLongPhong(vungCu, b)));
      giuDau = coDn && !!(cu && cu.dn) && cu.dn_ma === maDn && dauCu.length > 0 && dauCu.length === cu.dn_so;
      // 0. bỏ phần của lần vẽ trước nay không còn đúng (+ tường / cột / dầm cũ vướng khi người dùng đã đồng ý) + lỗ cửa / cột / dầm vẽ trùng (chồng khít lên cái đang giữ)
      const E = co.ent;
      const boE = [].concat(K.bo.tuong.map(i => E.tuong[i]), K.bo.lo.map(i => E.lo[i]), K.bo.cot.map(i => E.cot[i]), K.bo.dam.map(i => E.dam[i]), K.trung.lo.map(i => E.lo[i]), K.trung.cot.map(i => E.cot[i]), K.trung.dam.map(i => E.dam[i]));
      bo.tuong = K.bo.tuong.length; bo.mo = K.bo.lo.length; bo.cot = K.bo.cot.length; bo.dam = K.bo.dam.length;
      trung.mo = K.trung.lo.length; trung.cot = K.trung.cot.length; trung.dam = K.trung.dam.length;
      if (opt.bo_chong) {
        for (const i of K.chong) if (boE.indexOf(E.tuong[i]) < 0) { boE.push(E.tuong[i]); bo.tuong++; }
        for (const i of K.thua.cot) { boE.push(E.cot[i]); bo.cot++; }
        for (const i of K.thua.dam) { boE.push(E.dam[i]); bo.dam++; }
      }
      if (boE.length) {
        opt.onStatus(bo.tuong + bo.mo + bo.cot + bo.dam ? 'Đang bỏ phần phòng cũ không còn đúng…' : 'Đang dọn lỗ cửa / cột / dầm vẽ trùng…');
        const er = await D.erase(boE);
        if (!er.ok) throw new Error(`chưa bỏ được phần phòng cũ (còn ${er.con} đối tượng) — xoá tay các tường cũ trong Chenfeng rồi bấm vẽ lại`);
        await D.settle(300, 10000);
        co = D.docPhong(); K = Ph.doiChieuPhong(moi, co, cu);
      }
      // 1. tường còn thiếu — đi theo chiều kim đồng hồ quanh lòng phòng (bề dày nằm ngoài); các tường thiếu liền nhau đi chung một lệnh
      giu.tuong = K.tuong.filter(t => t.co >= 0).length;
      for (const c of K.ve_tuong) {
        opt.onStatus('Đang vẽ tường…');
        if (!(await moLenh('DRAWWALLINSIDE', null, baoCho('vẽ tường', 'DRAWWALLINSIDE')))) { errors.push(loiLenh('vẽ tường', 'DRAWWALLINSIDE')); dung = 'tuong'; break; }      // tường không vẽ được thì cửa, cột, dầm cũng thôi
        await datSo('G', cao); await datSo('H', opt.day_tuong);
        for (const q of c.diem) { D.input(toaDo(q)); await sleep(420); }
        D.input(c.khep ? 'C' : '');
        await xongLenh(8000);
        await D.settle(400, 15000);
      }
      // kiểm theo TƯỜNG CÓ TRÊN BẢN VẼ: mặt tường đang có phủ kín từng cạnh lòng phòng
      co = D.docPhong();
      coTuong = W.map(w => Ph.tuongPhuKin(w, co));
      dem.tuong = coTuong.filter(Boolean).length;
      them.tuong = Math.max(0, dem.tuong - giu.tuong);
      if (dem.tuong < W.length && !errors.length) errors.push(`Chenfeng chỉ dựng được ${dem.tuong}/${W.length} tường (thiếu tường ${W.filter((w, i) => !coTuong[i]).map(w => w.ten).join(', ')}).`);
      // 2. đối chiếu lại rồi mới mở lỗ, vẽ cột, dầm (lỗ cửa trên tường vừa bỏ đã mất theo tường)
      K = Ph.doiChieuPhong(moi, co, cu);
      // cửa đi, cửa sổ, ô trống = lỗ trên tường (điểm đặt = TÂM lỗ trên mép trong của tường)
      for (let q = 0; q < moi.mo.length; q++) {
        const m = (H.mo || []).find(x => x.j === moi.mo[q].j), k = K.mo[q].co;
        if (k >= 0) { giu.mo++; dem.mo++; that.mo[q] = co.lo[k].hop; continue; }
        if (dung) continue;
        opt.onStatus(`Đang mở ${m.ten.toLowerCase()} trên tường ${m.w.ten}…`);
        const ds0 = new Set(dsLop('RoomHolePolyline'));
        if (!(await moLenh(m.loai === 'cua' ? 'DRAWDOORHOLE' : 'DRAWIHOLE', null, baoCho('mở lỗ cửa', 'DRAWDOORHOLE')))) { warnings.push(chuaLam(`Chưa mở được ${m.ten.toLowerCase()} (tường ${m.w.ten})`)); dungLai(); continue; }
        await datSo('H', m.cao); await datSo('L', m.rong); await datSo('D', m.be);
        D.input(toaDo(P(tren(m.w, m.cach + m.rong / 2, 0))));
        await xongLenh(5000);
        const lo = dsLop('RoomHolePolyline').find(e => !ds0.has(e));
        if (lo) { dem.mo++; them.mo++; that.mo[q] = D.boxOf(lo); } else warnings.push(`Chưa mở được ${m.ten.toLowerCase()} (tường ${m.w.ten}).`);
      }
      // 3. cột, hộp kỹ thuật (điểm đặt = TÂM cột; Chenfeng tự cho cột cao bằng tường)
      for (let q = 0; q < moi.cot.length; q++) {
        const c = (H.can || []).find(x => x.j === moi.cot[q].j), k = K.cot[q].co;
        if (k >= 0) { giu.cot++; dem.cot++; that.cot[q] = co.cot[k].hop; continue; }
        if (dung) continue;
        opt.onStatus(`Đang vẽ ${c.ten.toLowerCase()}…`);
        const ds0 = new Set(dsLop('RoomPillar')), a = ((c.w.a % 180) + 180) % 180, doc = Math.abs(a - 90) < 1;
        if (!doc && a > 1 && a < 179) warnings.push(`${c.ten} nằm trên tường xiên: Chenfeng vẽ cột theo trục bản vẽ — xoay lại bằng lệnh của Chenfeng.`);
        if (!(await moLenh('DRAWPILLAR', doc ? [c.nho, c.rong] : [c.rong, c.nho], baoCho('vẽ cột', 'DRAWPILLAR')))) { warnings.push(chuaLam(`Chưa vẽ được ${c.ten.toLowerCase()} (tường ${c.w.ten})`)); dungLai(); continue; }
        D.input(toaDo(P(tren(c.w, c.cach + c.rong / 2, c.nho / 2))));
        await xongLenh(5000);
        const cot = dsLop('RoomPillar').find(e => !ds0.has(e));
        if (cot) { dem.cot++; them.cot++; that.cot[q] = D.boxOf(cot); if (c.z0 > 0.5 || c.z1 < cao - 0.5) warnings.push(`${c.ten}: Chenfeng vẽ cột cao hết tường (0 → ${cao}); phần +${c.z0} → +${c.z1} phải tự sửa chiều cao.`); }
        else warnings.push(`Chưa vẽ được ${c.ten.toLowerCase()} (tường ${c.w.ten}).`);
      }
      // 4. dầm (2 điểm dọc mép trong của tường, ở cao độ đáy dầm)
      for (let q = 0; q < moi.dam.length; q++) {
        const c = (H.can || []).find(x => x.j === moi.dam[q].j), k = K.dam[q].co;
        if (k >= 0) { giu.dam++; dem.dam++; that.dam[q] = co.dam[k].hop; continue; }
        if (dung) continue;
        opt.onStatus(`Đang vẽ ${c.ten.toLowerCase()}…`);
        const ds0 = new Set(dsLop('RoomGirder'));
        if (!(await moLenh('DRAWGIRDER', [c.nho, c.z1 - c.z0], baoCho('vẽ dầm', 'DRAWGIRDER')))) { warnings.push(chuaLam(`Chưa vẽ được ${c.ten.toLowerCase()} (tường ${c.w.ten})`)); dungLai(); continue; }
        D.input(toaDo(P(tren(c.w, c.cach, 0), c.z0))); await sleep(450);
        D.input(toaDo(P(tren(c.w, c.cach + c.rong, 0), c.z0)));
        await xongLenh(5000);
        const dam = dsLop('RoomGirder').find(e => !ds0.has(e));
        if (!dam) { warnings.push(`Chưa vẽ được ${c.ten.toLowerCase()} (tường ${c.w.ten}).`); continue; }
        dem.dam++; them.dam++;
        const b = D.boxOf(dam); that.dam[q] = b;
        if (Math.abs(b[4] - (c.z0 + o[2])) > 1 || Math.abs(b[5] - (c.z1 + o[2])) > 1) warnings.push(`${c.ten}: Chenfeng đặt dầm ở cao độ +${r2(b[4] - o[2])} → +${r2(b[5] - o[2])} (muốn +${c.z0} → +${c.z1}) — kéo lại cao độ dầm trong Chenfeng.`);
      }
      // 5. điện – nước (bản 1.18): dấu trên mặt tường / trên sàn, dựng từ một file DXF nhỏ thả vào bản vẽ. Dấu cũ còn nguyên và không đổi thì giữ; không thì bỏ dấu cũ rồi đánh lại
      //    (tường không dựng được thì để yên dấu cũ — không bỏ mà không đánh lại được).
      if (giuDau) { dem.dn = dn.so; giu.dn = dn.so; soNetDn = cu.dn_so; }
      else if (dung) { /* Chenfeng đang không trả lời: để yên dấu cũ, lần bấm sau làm */ }
      else if (dem.tuong > 0 || !coDn) {
        const con = dauCu.filter(e => e && !e.IsErase);
        if (con.length) {
          opt.onStatus('Đang bỏ dấu điện – nước cũ…');
          const er = await D.erase(con);
          if (er.ok) bo.dn = con.length; else warnings.push(`Chưa bỏ hết dấu điện – nước cũ (còn ${er.con} nét) — xoá tay trong Chenfeng.`);
        }
        if (coDn) {
          opt.onStatus(`Đang đánh dấu ${dn.so} điểm điện – nước…`);
          await D.settle(300, 8000);
          const r = await D.importDXF(dn.dxf, { hop: dn.hop, ten: 'dien-nuoc.dxf' });
          if (r.ok) { dem.dn = dn.so; them.dn = dn.so; soNetDn = r.ents.length; } else warnings.push(`Chưa đánh dấu được ${dn.so} điểm điện – nước lên bản vẽ: ${r.reason} Phòng vẫn vẽ đủ; vị trí các điểm xem ở mặt bằng / mặt đứng trong bảng.`);
        }
      }
    } catch (e) { errors.push('Lỗi khi vẽ phòng: ' + String(e && e.message || e)); await dongHopThoai(); if (D.busy()) await D.cancel(); }
    finally { dangLenhPhong--; }
    if (dung === 'sau') warnings.push(`Dừng ở đây vì Chenfeng ${dungVi === 'qua_han' ? 'chưa trả lời' : 'đang bận việc khác'} — phần đã vẽ được giữ nguyên; ${dungVi === 'qua_han' ? '' : 'xong việc đó thì '}bấm “Vẽ phòng vào Chenfeng” lại để vẽ nốt phần còn thiếu.`);
    await D.settle(400, 15000);
    // 6. tên phòng (bản 1.12): Chenfeng tự sinh vùng phòng (RoomRegion) không tên → nhãn "未命名 10.8m²". Ghi tên phòng của bảng vào.
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
    // bản ghi lần vẽ này: chỉ ghi tường thật sự có và do phòng này đứng tên (tường chung nằm trên tường của phòng bên thì không ghi — lần sau không coi là của mình mà bỏ)
    let daVe = null;
    try {
      const cua = W.filter((w, i) => coTuong[i] && !(K.tuong[i] && K.tuong[i].nam_tren));
      daVe = Ph.banGhiPhong(Object.assign({}, moi, { tuong: cua }), { mo: that.mo, cot: that.cot, dam: that.dam, dn: dem.dn > 0 && dn && dn.hop ? [dn.hop.x0, dn.hop.x1, dn.hop.y0, dn.hop.y1, dn.hop.z0, dn.hop.z1] : null, dn_ma: maDn, dn_so: soNetDn });
    } catch (e) { daVe = null; }
    if (steps > 0) D.lastRoom = { added, steps, mark: h1, da_ve: daVe };      // lần bấm thừa (bản vẽ không đổi) không ghi đè lần vẽ thật → "Hoàn tác phòng" vẫn lùi được lần vẽ trước
    opt.onStatus('Xong.');
    return { ok: errors.length === 0 && dem.tuong > 0, errors, warnings, dem, them, giu, bo, trung, khong_doi: steps === 0, dung, da_ve: daVe, ten_phong: tenPhong, so_buoc_hoan_tac: steps, so_doi_tuong: added.length };
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
    await guiLenh('ROTATE');
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
  // tên tấm của mẫu kho là tiếng Trung → tiếng Việt: khi báo cáo (D.tenTamViet) và khi ghi lại tên tấm của mẫu kho vừa vẽ (D.tenTamMoi — bản 1.19).
  // Tên DÀI / RIÊNG đứng trước tên chung chứa trong nó (抽底板 trước 底板, 左开门板 trước 门板…). Tên đo trên các bộ tủ của kho ngày 04/10/2026.
  const TEN_TAM = [
    ['左抽侧', 'Thành trái ngăn kéo'], ['右抽侧', 'Thành phải ngăn kéo'], ['抽侧板', 'Thành ngăn kéo'], ['抽侧', 'Thành ngăn kéo'], ['抽尾板', 'Hậu ngăn kéo'], ['抽尾', 'Hậu ngăn kéo'], ['抽背板', 'Hậu ngăn kéo'],
    ['抽前板', 'Trước ngăn kéo'], ['抽前', 'Trước ngăn kéo'], ['抽面板', 'Mặt ngăn kéo'], ['抽面', 'Mặt ngăn kéo'], ['抽底板', 'Đáy ngăn kéo'], ['抽底', 'Đáy ngăn kéo'],
    ['左开门板', 'Cánh mở trái'], ['右开门板', 'Cánh mở phải'], ['上翻门板', 'Cánh lật lên'], ['下翻门板', 'Cánh lật xuống'], ['假门', 'Cánh giả'],
    ['薄背板', 'Hậu mỏng'], ['厚背板', 'Hậu dày'], ['加强条', 'Thanh tăng cứng'], ['上收口', 'Nẹp bù trên'], ['左收口', 'Nẹp bù trái'], ['右收口', 'Nẹp bù phải'],
    ['左侧板', 'Hồi trái'], ['右侧板', 'Hồi phải'], ['中侧板', 'Vách'], ['侧板', 'Hồi'], ['顶板', 'Nóc'], ['底板', 'Đáy'], ['背板', 'Hậu'], ['固定层板', 'Đợt cố định'], ['活动层板', 'Đợt rời'], ['层板', 'Đợt'], ['中立板', 'Vách'], ['立板', 'Vách'],
    ['后地脚', 'Xà chân sau'], ['前地脚', 'Xà chân trước'], ['地脚线', 'Xà chân'], ['踢脚板', 'Xà chân'], ['前拉条', 'Xà trước'], ['后拉条', 'Xà sau'], ['拉条', 'Thanh giằng'], ['背条', 'Thanh giằng sau'], ['收口条', 'Nẹp'], ['收口板', 'Nẹp bù'], ['收口', 'Nẹp bù'],
    ['垫条', 'Thanh chèn'], ['垫板', 'Tấm đệm'], ['见光板', 'Tấm ốp'], ['门板', 'Cánh'], ['封板', 'Tấm bịt'], ['竖隔板', 'Vách ngăn'], ['横隔板', 'Đợt ngăn'], ['隔板', 'Vách ngăn'], ['挡板', 'Tấm chắn'],
    ['台面', 'Mặt bàn'], ['桌面', 'Mặt bàn'], ['格栅', 'Lam'], ['装饰板', 'Tấm trang trí'], ['护墙板', 'Tấm ốp tường'], ['墙板', 'Tấm ốp tường'], ['搁板', 'Kệ'], ['楣板', 'Diềm trên'], ['顶线', 'Phào đỉnh'], ['罗马柱', 'Cột La Mã']];
  // nhận tấm hậu / cánh / tấm ngăn kéo theo TÊN — cả tên gốc tiếng Trung lẫn tên tiếng Việt mà D.tenTamMoi đã ghi (để chuẩn hoá / đổi dày ván chạy được trên module đã đổi tên)
  const laTenHau = t => (/背/.test(t) || /^Hậu/.test(t)) && !/抽|ngăn kéo/i.test(t);
  const laTenCanhNK = t => /门|抽|^Cánh|ngăn kéo/i.test(t);
  D.tenTamViet = t => { t = String(t || ''); for (const [a, b] of TEN_TAM) if (t.includes(a)) return t === a ? b : `${b} (${t})`; return t; };

  D.chuanHoa = async (ent, opt) => {
    D.boManChe();
    opt = Object.assign({ hau: Core.DEFAULT_SPEC.hau.t, mep: 1, khoan: '', khoan_lai: true, onStatus() {} }, opt || {});
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
    const laHau = o => laTenHau(o.ten);
    const kc = L.filter(o => (o.tr === 0 || o.tr === 2) && !laHau(o) && !laTenCanhNK(o.ten));
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
    const laHauTen = b => /背|^Hậu/.test(String(b.Name || ''));
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
      danhDauGoi(path);
      r = await Promise.race([root.fetch(D.apiHost() + '/' + path, { method: 'POST', mode: 'cors', credentials: 'include', body: JSON.stringify(data), signal: ac ? ac.signal : undefined }), hen.then(() => { throw new Error('qua gio'); })]);
      if (!r.ok) throw new Error('Máy chủ Chenfeng trả lời ' + r.status + '.');
      j = await r.json();
    } catch (e) { if (het) throw new Error('Máy chủ Chenfeng không trả lời sau 60 giây (mạng tới Chenfeng đang chậm) — thử lại sau.'); throw e; }
    if (!j || (j.err_code !== 0 && j.err_code !== '0')) throw new Error('Chenfeng báo lỗi' + (j && j.err_msg ? ': ' + j.err_msg : '') + ' — kiểm tra đã đăng nhập chưa.');
    return j;
  };
  /**
   * Đo mạng tới máy chủ Chenfeng (bản 1.27): một lượt làm nóng rồi `n` lượt hỏi CAD-dirQuery (chỉ ĐỌC) LẦN LƯỢT, cách nhau `D.CH.do_cach` ms, mỗi lượt chờ tối đa `han` ms.
   * Máy chủ trả lời gì cũng tính là có trả lời (đo đường truyền, không đo việc đăng nhập); không trả lời / đứt kết nối = rớt. onBuoc(i, n) sau mỗi lượt.
   * Đã đo trên máy xưởng (05/10/2026): lượt đầu phải mở kết nối (bắt tay TCP + TLS = thêm 2 – 3 lượt đi về) nên KHÔNG tính; các lượt sau cách nhau dưới một giây thì dùng lại kết nối đó
   * (để quá vài giây máy chủ đóng kết nối — mỗi lượt lại thành lượt mở kết nối, số đo sai). Mất liền 3 lượt (kể cả lượt làm nóng) = đường đứt → dừng, khỏi bắt chờ đủ `n` lượt × `han`.
   * Trả { ms: [thời gian từng lượt có trả lời], rot, n: số lượt đã đo, dut }.
   */
  D.doMang = async (n, han, onBuoc) => {
    n = n || 20; han = han || 8000;
    const mot = async () => {
      const ac = typeof AbortController === 'function' ? new AbortController() : null, t0 = Date.now(); let co = false;
      try {
        co = await Promise.race([
          (danhDauGoi('CAD-dirQuery'), root.fetch(D.apiHost() + '/CAD-dirQuery', { method: 'POST', mode: 'cors', credentials: 'include', body: JSON.stringify({ dir_type: '5' }), signal: ac ? ac.signal : undefined })).then(async r => { await r.text(); return true; }),
          sleep(han).then(() => false)]);
      } catch (e) { co = false; }
      if (co) return Date.now() - t0;
      if (ac) { try { ac.abort(); } catch (e) { /* bỏ qua */ } }
      return -1;
    };
    const ms = []; let rot = 0, da = 0, dut = false, lien = (await mot()) < 0 ? 1 : 0;
    while (da < n && !dut) {
      await sleep(D.CH.do_cach);
      const t = await mot(); da++;
      if (t < 0) { rot++; lien++; } else { ms.push(t); lien = 0; }
      if (onBuoc) { try { onBuoc(da, n); } catch (e) { /* bỏ qua */ } }
      if (lien >= 3) dut = true;
    }
    return { ms, rot, n: da, dut };
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
      const ts = {}, mt = {};      // mt = chú thích của tham số (bản 1.29.2 — để người dùng nhận ra tham số dày đáy ngăn kéo)
      try { for (const r of JSON.parse(await inflate(m.props))) if (Array.isArray(r) && typeof r[1] === 'string' && typeof r[3] === 'number') { ts[r[1]] = r[3]; if (typeof r[5] === 'string' && r[5]) mt[r[1]] = r[5]; } } catch (e) { /* mẫu không đọc được tham số thì thôi */ }
      out.push({ id: Math.round(+m.module_id) || 0, ten: String(m.name || '').trim(), ts, mt });
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
  /**
   * Một trang mẫu của MỘT thư mục kho (bản 1.19 — để duyệt kho có hình ngay trong bảng). Chỉ ĐỌC.
   * opt: { trang (1…), moi_trang (≤ 100), ten (lọc theo tên) }. Thư mục rỗng thì Chenfeng không trả `modules`.
   * @returns {{ tong, trang, mau: [{ id, ten, hinh (địa chỉ ảnh nhỏ của mẫu), kt: [L, W, H] | null (kích thước mặc định), bh (dày ván mặc định) }] }}
   */
  D.khoMau = async (dirId, opt) => {
    opt = Object.assign({ trang: 1, moi_trang: 24, ten: '' }, opt || {});
    const trang = Math.max(1, Math.round(opt.trang) || 1), moi = Math.min(100, Math.max(1, Math.round(opt.moi_trang) || 24));
    const body = { dir_id: String(dirId), curr_page: trang, page: trang, page_count: moi };
    if (opt.ten) body.name = String(opt.ten).slice(0, 60);
    const j = await post('CAD-moduleList', body), host = D.apiHost(), out = [];
    for (const m of j.modules || []) {
      const ts = {};
      try { for (const r of JSON.parse(await inflate(m.props))) if (Array.isArray(r) && typeof r[1] === 'string' && typeof r[3] === 'number') ts[r[1]] = r[3]; } catch (e) { /* mẫu không đọc được tham số: vẫn liệt kê, không có kích thước mặc định */ }
      const logo = String(m.logo || '').replace(/^\/+/, '');
      out.push({ id: Math.round(+m.module_id) || 0, ten: String(m.name || '').trim(), hinh: logo ? (/^https?:/i.test(logo) ? logo : host + '/' + logo) : '',
        kt: ts.L > 0 && ts.W > 0 && ts.H > 0 ? [r2(ts.L), r2(ts.W), r2(ts.H)] : null, bh: ts.BH > 0 ? r2(ts.BH) : 0 });
    }
    return { tong: Math.max(Math.round(+j.count) || 0, out.length), trang, mau: out };
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
    const nuts = [...document.querySelectorAll('button')].filter(b => { try { return b.getBoundingClientRect().width > 0 && laNutOK(b); } catch (e) { return false; } });
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
    await guiLenh(ten);
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
      } else if (viec && viec.truoc_diem) {
        // LEFTRIGHTBOARD có chế độ "đặt theo phòng" (DrawLeftRight.InsertByPoint): lời nhắc dò tia chuột (Raycast) ngay lúc mở và mỗi lần chuột rê;
        // tia đang trúng một đối tượng PHÒNG (sàn, tường — RoomBase) thì Chenfeng đặt thùng theo chỗ chuột trên mặt đó và BỎ QUA toạ độ gõ vào
        // (đo trên bản thật 04/10/2026: chuột để trên sàn phòng → thùng nhảy về giữa chỗ chuột, lệch chỗ đặt 6 m).
        // → trước khi gõ điểm: quay nhìn thẳng vào đúng vùng sẽ vẽ rồi rê chuột tới đó, để tia chuột không trúng gì của phòng.
        await viec.truoc_diem();
        if (!D.busy()) throw new Error(`Lệnh ${ten}: lời nhắc đặt thùng bị đóng giữa chừng (có thao tác khác chen vào?).`);
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
    await guiLenh('DOOR');
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
  /* ------------------------------------------------------------------ *
   * NGĂN KÉO BẰNG LỆNH GỐC `DRAWER` (bản 1.26 — anh Jason 05/10/2026 07:00: "phần ngăn kéo vẽ bằng công cụ của chenfeng như vẽ thùng hậu, cánh").
   * Đã đo trên Chenfeng thật 05/10/2026:
   *   - chọn sẵn 4 tấm kẹp (2 tấm đứng + 2 tấm nằm; tấm rời như vách đệm cũng được) → DRAWER → từ khoá S (框选) → hộp "Drawer Design"; kho lựa chọn cùng họ với hộp cánh (lấy qua nút OK);
   *   - ghi lựa chọn (Core.lcNganKeo) vào m_Option + chuỗi hiển thị → InitInfos() dựng lại các ô → SetDrawerDepth() → gán mẫu cho TỪNG ô (bản chép riêng, đủ `props`) → OK;
   *   - ô có mã mẫu mà thiếu `props` thì Chenfeng ném lỗi lúc dựng và gửi báo cáo lỗi về máy chủ của nó → mẫu luôn dựng bằng Core.tempNganKeo từ bản ghi kho mẫu (không dựng được thì không gọi lệnh);
   *   - bấm OK: Chenfeng gọi máy chủ MỘT lần cho cả lệnh (CAD-moduleDetail) rồi dựng; một bước lịch sử; không lời gọi lưu cấu hình nào.
   * Ngăn kéo vẽ cách này là một nhánh trong cây mẫu của thùng (… → 抽屉总空间 → 抽屉空间 → mẫu ngăn kéo) nên sửa được như ngăn kéo vẽ tay và tự chạy theo thùng.
   * ------------------------------------------------------------------ */
  // Bản ghi kho mẫu (CAD-moduleList) của một mẫu ngăn kéo — chỉ ĐỌC kho của tài khoản đang đăng nhập: thư mục ngăn kéo (dò theo TÊN thư mục) và các thư mục con của nó.
  // Dò theo MÃ mẫu; không có thì lấy mẫu CÙNG TÊN (mã ghi ở Chuẩn xưởng là của tài khoản khác). Nhớ trong phiên; lần đọc hỏng thì không nhớ.
  const khoNK = new Map();
  D.quenKhoNK = () => khoNK.clear();
  const banGhiNK = async mau => {
    const khoa = mau.id + '|' + (mau.ten || '');
    if (khoNK.has(khoa)) return khoNK.get(khoa);
    const dirs = await D.templateDirs(), laNK = d => /抽屉|ngăn kéo|drawer/i.test(d.ten), cha = new Map(dirs.map(d => [d.id, d]));
    const thuoc = d => { for (let x = d, n = 0; x && n < 12; x = cha.get(x.cha), n++) if (laNK(x)) return true; return false; };
    let theoMa = null, theoTen = null, hong = 0;
    for (const d of dirs.filter(thuoc).slice(0, 8)) {
      let j; try { j = await post('CAD-moduleList', { dir_id: String(d.id), page: 1, page_count: 100 }); } catch (e) { hong++; continue; }
      for (const m of j.modules || []) {
        if ((Math.round(+m.module_id) || 0) === mau.id) { theoMa = m; break; }
        if (!theoTen && mau.ten && String(m.name || '').trim() === mau.ten) theoTen = m;
      }
      if (theoMa) break;
    }
    const m = theoMa || theoTen;
    let kq = null;
    if (m) { try { kq = { banGhi: { module_id: m.module_id, name: String(m.name || '').trim(), logo: m.logo, diy_logo: m.diy_logo }, hang: JSON.parse(await inflate(m.props)) }; } catch (e) { kq = { banGhi: null, hang: null }; } }
    if (kq || !hong) khoNK.set(khoa, kq);
    else throw new Error('không đọc được danh sách mẫu của thư mục ngăn kéo');
    return kq;
  };
  const laHopNK = m => !!(m && m.store && Array.isArray(m.store.doorDrawersInfo) && typeof m.store.InitInfos === 'function' && typeof m.store.SetDrawerDepth === 'function');
  const dongHop = async m => {      // đóng hộp thoại còn mở (bấm nút huỷ của chính hộp đó) rồi thôi lệnh
    try { const h = m && m.ok && m.ok.isConnected && (m.ok.closest('.bp3-dialog') || m.ok.parentElement); const nut = h && [...h.querySelectorAll('button')].find(x => TEN_HUY.test(chuNut(x))); if (nut) nut.click(); } catch (e) { /* bỏ qua */ }
    await sleep(120);
    if (D.busy()) await D.cancel();
  };
  /** Lệnh DRAWER cho một bước NK. Trả về { tra: trả lại lựa chọn của người dùng (gọi khi Chenfeng đã dựng xong), w: nghe lệnh kết thúc, m: hộp thoại }. Ném lỗi nếu hộp không mở / không nhận lựa chọn. */
  const chayNK = async (b, kep, temp, opt) => {
    if (D.busy()) await D.cancel();
    D.boManChe();
    try { ed().SelectCtrl.Cancel(); } catch (e) { /* bỏ qua */ }
    D.select(kep);
    await sleep(150);
    await guiLenh('DRAWER');
    if (!(await cho(() => D.busy(), 7000))) throw new Error('Chenfeng không nhận lệnh DRAWER (lệnh khác đang chạy dở?)');
    D.input('S');
    let m = null; await cho(() => laHopNK(m = hopGoc()), opt.cho_hop > 0 ? opt.cho_hop : 9000);
    if (!laHopNK(m)) { if (D.busy()) await D.cancel(); throw new Error('chọn 4 tấm kẹp xong Chenfeng không mở hộp "Drawer Design" (khoảng kẹp không hợp lệ?)'); }
    const st = m.store, ui = st.UIOption || st.m_UiOption, lanDau = !daMoGoc.has('DRAWER');
    let truoc = '', giong = 0;
    await cho(() => { const now = JSON.stringify([st.m_Option, st.configName]); giong = now === truoc ? giong + 1 : 0; truoc = now; return giong >= (lanDau ? 8 : 3) && (!lanDau || (st.configsNames && st.configsNames.length > 0)); }, lanDau ? 6000 : 2500);
    daMoGoc.add('DRAWER');
    const luu = [[st.m_Option, JSON.parse(JSON.stringify(st.m_Option))]]; if (ui && typeof ui === 'object') luu.push([ui, JSON.parse(JSON.stringify(ui))]);
    const tra = () => { for (const [o, cu] of luu) { try { Object.assign(o, cu); } catch (e) { /* bỏ qua */ } } };
    let w = null;
    try {
      const L = Core.lcNganKeo(b);
      ganLC(st.m_Option, ui, L.lc);
      if (ui) { ui.row = String(b.so); ui.col = '1'; }
      st.InitInfos();
      st.SetDrawerDepth();
      await sleep(80);
      const o = (st.doorDrawersInfo || []).slice().sort((p, q) => p.row - q.row);
      if (o.length !== b.so || o.some(d => !d || !d.tempInfo)) throw new Error(`hộp "Drawer Design" dựng ${o.length} ô, cần ${b.so}`);
      if (L.cao) {
        // MẶT KHÔNG BẰNG NHAU → khoá cao từng ô (đo trên Chenfeng thật 05/10/2026: gõ số vào ô cao = isLockHeight + showHeight (chuỗi trong ô nhập) + height (số thật); CalcInfos() chia phần còn lại cho các ô "D").
        // Khoá mọi ô trừ ô dưới cùng: ô đó nhận phần còn lại nên tổng luôn khít khoảng. Chia xong mà có ô khác thiết kế (bản Chenfeng khác không nhận cách khoá này) → không bấm OK.
        o.slice(0, -1).forEach((d, i) => { d.isLockHeight = true; d.showHeight = soLC(L.cao[i]); d.height = L.cao[i]; });
        st.CalcInfos();
        const sai = o.findIndex((d, i) => !(Math.abs(Number(d.height) - L.cao[i]) < 0.05));
        if (sai >= 0) throw new Error(`hộp "Drawer Design" chia ô ${sai + 1} (từ trên xuống) cao ${r2(Number(o[sai].height))}, thiết kế cần ${L.cao[sai]}`);
      }
      for (const d of o) d.tempInfo.temp = JSON.parse(JSON.stringify(temp));
      w = watchEnd();
      m.ok.click();
    } catch (e) { tra(); if (w) w.off(); await dongHop(m); throw e; }
    return { tra, w, m };
  };
  // lệnh DRAWER bị bỏ vì máy chủ không trả lời VẪN CHẠY NGẦM trong Chenfeng (như lệnh nhập — xem canhLenhTre): chờ nó kết thúc (tối đa 3 phút) rồi mới trả lựa chọn của người dùng
  const canhNKTre = (w, tra) => {
    const tre = { xong: false }; lenhTre = tre;
    (async () => { const t0 = Date.now(); try { while (Date.now() - t0 < 180000 && !w.ended) await sleep(300); } catch (e) { /* bỏ qua */ } w.off(); tra(); tre.xong = true; })();
  };
  /**
   * Chạy các bước NK của kế hoạch K (Core.keHoachGoc). Phần tấm của tủ — kể cả vách đệm — phải có sẵn trên bản vẽ: tamCua = Map tấm thiết kế → tấm thật; offset = độ dời thiết kế → bản vẽ.
   * opt: { onStatus, cho_mau: hạn chờ máy chủ trả mẫu (ms, mặc định 40000), cho_hop: hạn chờ hộp thoại mở }
   * @returns {{ so: số ô đã vẽ, xong: Set<chỉ số M.templates đã vẽ bằng lệnh gốc>, added: đối tượng mới, hong: [{ khoang, so, ly_do, bao }], doi_ma: [{ tu, sang, ten }], ban: Chenfeng còn đang chờ máy chủ }}
   *   ly_do: 'kep' không tìm lại đủ 4 tấm kẹp · 'kho' không đọc được kho mẫu · 'khong_co' kho tài khoản không có mẫu (cả mã lẫn tên) · 'mau_la' tham số mẫu không đúng dạng đã biết
   *        · 'hop' hộp thoại không mở / không nhận lựa chọn · 'may_chu' | 'khong_thuoc_tk' máy chủ không trả mẫu · 'treo' máy chủ không trả lời trong hạn (Chenfeng còn bận) · 'lech' ngăn kéo ra khác thiết kế (đã hoàn tác).
   * Ô hỏng thì nơi gọi chèn ngăn kéo của ô đó bằng mẫu như bản 1.23 — TRỪ khi `ban`: Chenfeng còn đang chờ máy chủ, chèn thêm là hai ngăn kéo chồng nhau.
   */
  D.veNK = async (K, offset, tamCua, opt) => {
    opt = Object.assign({ onStatus() {} }, opt || {});
    opt.onStatus = guard(opt.onStatus);
    const M = K.M, kq = { so: 0, xong: new Set(), added: [], hong: [], doi_ma: [], ban: false };
    const hongO = (b, ly_do, bao) => kq.hong.push({ khoang: b.khoang, so: b.so, ly_do, bao: bao || '' });
    for (let i = 0; i < K.nk.length; i++) {
      const b = K.nk[i];
      opt.onStatus(`Ngăn kéo khoang ${b.khoang + 1} (${i + 1}/${K.nk.length}): lệnh ngăn kéo của Chenfeng…`);
      const kep = b.kep.map(j => tamCua.get(M.parts[j])).filter(e => e && !e.IsErase);
      if (kep.length !== 4) { hongO(b, 'kep'); continue; }
      let bg;
      try { bg = await banGhiNK(b.mau); } catch (e) { hongO(b, 'kho', String(e && e.message || e)); continue; }
      if (!bg) { hongO(b, 'khong_co'); continue; }
      const temp = Core.tempNganKeo(bg.banGhi, bg.hang, b.ts);
      if (!temp) { hongO(b, 'mau_la'); continue; }
      const truoc = new Set(root.app.Database.ModelSpace.Entitys), h0 = hmMark(), toastCu = new Set(document.querySelectorAll('.bp3-toast'));
      const moi = () => root.app.Database.ModelSpace.Entitys.filter(e => e && !e.IsErase && !truoc.has(e));
      let c;
      try { c = await chayNK(b, kep, temp, opt); } catch (e) { hongO(b, 'hop', String(e && e.message || e)); continue; }
      // chờ Chenfeng tải mẫu + dựng: có đối tượng mới / lệnh kết thúc mà không sinh gì / hộp không chịu đóng / quá hạn
      const t0 = Date.now(), han = opt.cho_mau > 0 ? opt.cho_mau : 40000;
      let ket = '';
      while (!ket) {
        if (moi().length) ket = 'co';
        else if (c.w.ended) ket = 'het';
        else if (Date.now() - t0 > 2500 && laHopNK(hopGoc())) ket = 'hop';
        else if (Date.now() - t0 > han) ket = 'treo';
        else await sleep(100);
      }
      if (ket === 'treo') { hongO(b, 'treo'); kq.ban = true; canhNKTre(c.w, c.tra); break; }
      if (ket === 'hop') { c.tra(); c.w.off(); await dongHop(c.m); hongO(b, 'hop', 'Chenfeng không nhận lựa chọn của hộp "Drawer Design"'); continue; }
      if (ket === 'het') await cho(() => moi().length > 0, 1200);      // "lệnh kết thúc" có thể tới trước khi đối tượng vào bản vẽ một nhịp: chờ thêm rồi mới kết luận là không sinh gì
      if (moi().length) { await cho(() => !!c.w.ended, 15000); await D.settle(350, 15000); }
      c.w.off(); c.tra();
      const ds = moi();
      if (!ds.length) {      // Chenfeng tự thôi lệnh: lấy lời nó báo để biết vì sao
        const bao = [...document.querySelectorAll('.bp3-toast')].filter(t => !toastCu.has(t)).map(t => (t.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
        hongO(b, lyDoMau(bao.join(' ')), bao.map(t => t.slice(0, 200)).join(' | ')); continue;
      }
      // đối chiếu: từng mặt ngăn kéo của thiết kế phải có một tấm mới đúng hộp, và hộp phải sâu đúng thiết kế — lệch thì bỏ lệnh vừa rồi
      const tam = ds.filter(D.isBoard), dung = new Set();
      let lech = '';
      for (const j of b.mat) {
        const q = M.mat_ngan_keo[j], want = [q.x + offset[0], q.x + q.w + offset[0], q.y + offset[1], q.y + q.t + offset[1], q.z + offset[2], q.z + q.h + offset[2]];
        const hit = tam.find(e => !dung.has(e) && near(D.boxOf(e), want, 0.12));
        if (hit) dung.add(hit); else { lech = `mặt ngăn kéo cần ${want.map(r2).join(' / ')}`; break; }
      }
      // SÂU HỘP = tham số W của nút mẫu chứa mặt ngăn kéo (đo trên Chenfeng thật 05/10/2026: W = floor(_W/50)*50 là sâu danh nghĩa của hộp; mẫu ray âm đỡ đáy dựng thành hộp ngắn hơn 10
      // nên không tấm nào dài đúng bằng sâu hộp — đối chiếu theo chiều dài tấm là báo lệch oan). Không đọc được W (bản Chenfeng khác) thì không dám nhận là đúng.
      if (!lech) {
        const sai = [...dung].map(e => { try { const p = e.Template.Object.WParam; return p ? Number(p.value) : NaN; } catch (er) { return NaN; } }).find(w => !(Math.abs(w - b.sau) < 0.6));
        if (sai !== undefined) lech = `hộp ngăn kéo cần sâu ${b.sau} (Chenfeng dựng ${isFinite(sai) ? r2(sai) : 'không rõ'})`;
      }
      if (lech) {
        const ve = tam.slice(0, 6).map(e => `${e.Name} ${D.boxOf(e).join(' / ')}`).join(' ; ');
        const h1 = hmMark(); if (h0 && h1 && h1.i > h0.i) await D.undo(h1.i - h0.i);
        hongO(b, 'lech', `${lech}; Chenfeng vẽ ${ve}`); continue;
      }
      kq.so++; for (const j of b.tp) kq.xong.add(j);
      kq.added.push(...ds);
      if (bg.banGhi && (Math.round(+bg.banGhi.module_id) || 0) !== b.mau.id && !kq.doi_ma.some(d => d.tu === b.mau.id)) kq.doi_ma.push({ tu: b.mau.id, sang: Math.round(+bg.banGhi.module_id) || 0, ten: b.mau.ten });
    }
    return kq;
  };

  /**
   * NGĂN KÉO + SUỐT TREO của tủ vẽ bằng lệnh gốc (bản 1.26): ô ngăn kéo nào kế hoạch có bước NK thì vẽ bằng lệnh DRAWER (D.veNK); ô không vẽ được bằng lệnh gốc, loại ngăn kéo ngoài kế hoạch
   * (chia ô…) và suốt treo thì chèn mẫu qua cổng như bản 1.23 (themMau). Trả về như themMau, thêm `nk`: { tong: số bước NK, so: số ô đã vẽ bằng lệnh gốc, xong: Set chỉ số M.templates, lui: [{ khoang, so, ly_do, bao }],
   * bao: lời báo cho người dùng về các ô phải chèn mẫu thay cho lệnh gốc }.
   * Lệnh DRAWER bị treo vì máy chủ → KHÔNG gửi lệnh nhập nào nữa: Chenfeng còn đang chờ máy chủ (lệnh khác bị bỏ qua), và máy chủ trả lời trễ thì ô đó vẫn được dựng — chèn thêm là hai ngăn kéo chồng nhau.
   */
  const LY_DO_NK = { kep: 'không tìm lại đủ 4 tấm kẹp của ô trên bản vẽ', kho: 'không đọc được kho mẫu của tài khoản', khong_co: 'kho mẫu của tài khoản không có mẫu ngăn kéo này', mau_la: 'tham số của mẫu ngăn kéo không đúng dạng bảng biết',
    hop: 'Chenfeng không mở hoặc không nhận lựa chọn của hộp “Drawer Design”', may_chu: 'máy chủ Chenfeng không trả mẫu', khong_thuoc_tk: 'mẫu không thuộc tài khoản đang đăng nhập',
    lech: 'Chenfeng dựng ngăn kéo khác thiết kế nên bảng đã bỏ lệnh đó' };
  D.themMauNK = async (K, offset, tamCua, opt) => {
    opt = Object.assign({ onStatus() {} }, opt || {});
    opt.onStatus = guard(opt.onStatus);
    const M = K.M;
    const nk = K.nk.length ? await D.veNK(K, offset, tamCua, opt) : { so: 0, xong: new Set(), added: [], hong: [], doi_ma: [], ban: false };
    const Mcon = nk.xong.size ? Object.assign({}, M, { templates: M.templates.filter((t, j) => !nk.xong.has(j)) }) : M;
    let tm;
    if (nk.ban) {
      tm = { added: [], thieu: Core.mauCF(Mcon).map(x => ({ tp: x.tp, mat: x.mat, loai: x.tp.loai, khoang: x.tp.khoang, id: x.tp.id, ten: x.tp.ten, ly_do: 'may_chu', bao: '', treo: true })), doi_ma: [], so_lenh: 0 };
      opt.onStatus('Máy chủ Chenfeng chưa trả lời — chờ Chenfeng bỏ lệnh ngăn kéo…');
      tm.ban = !(await choLenhTre(opt.cho_tre > 0 ? opt.cho_tre : 25000));
    } else tm = await themMau(Mcon, offset, opt);
    tm.added = nk.added.concat(tm.added);
    for (const d of nk.doi_ma) if (!tm.doi_ma.some(x => x.tu === d.tu)) tm.doi_ma.push(d);
    // ô không vẽ được bằng lệnh gốc mà đã chèn được bằng mẫu: nói rõ ô nào, vì sao (ô rốt cuộc không có ngăn kéo thì baoMau đã nói)
    const chen = nk.hong.filter(h => !tm.thieu.some(x => x.loai === 'NGAN_KEO' && x.khoang === h.khoang));
    tm.nk = { tong: K.nk.length, so: nk.so, xong: nk.xong, lui: nk.hong,
      bao: chen.map(h => `Ngăn kéo khoang ${h.khoang + 1} (${h.so} ngăn): chưa vẽ được bằng lệnh ngăn kéo của Chenfeng (${LY_DO_NK[h.ly_do] || h.ly_do}) → đã chèn bằng mẫu như bản trước; ngăn kéo này không sửa được trong hộp “Drawer Design” của Chenfeng.`) };
    return tm;
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
   * MẪU KHO VÀO BẢN VẼ (bản 1.19 — anh Jason 03/10/2026 20:49: "vách tivi … vách đầu giường chọn các module sẵn, chia ô ra rồi chọn vào từng khu vực";
   *   20:52: "chọn khu vực là tủ áo thì hiện lên các mẫu thư viện luôn"; 23:18: "chọn từ extension rồi nhập kích thước kéo vào").
   * Đã đo trên Chenfeng 04/10/2026:
   *   - cổng nhập nhận mục { Type: 'Template', TempalteId, BoxSize: [L, W, H], Pos } → Chenfeng tải mẫu của kho, đặt L / W / H rồi dựng cả cây mẫu
   *     (bộ tủ 222 tấm mất ~80 giây khi tab bị che); khung module sau đó đúng bằng L × W × H;
   *   - điểm đặt của cổng nhập là góc nhỏ nhất của CẢ CỤM kể cả tay nắm nhô ra trước mặt cánh → gốc module lệch khỏi điểm gõ: phải đo lại rồi dời bằng ma trận;
   *   - mẫu của cửa hàng mang kiểu khoan không có trong cấu hình tài khoản (三合一) → Chenfeng không khoan: đổi sang kiểu khoan của xưởng rồi khoan lại (D.finalize);
   *   - cả module dời + xoay được bằng một ma trận (D.apMaTran), khung module đi theo, đổi L / W / H sau đó vẫn đúng.
   * Cách làm: dựng mẫu THẲNG TRỤC ở một chỗ trống → (tuỳ chọn) dày ván + hậu phủ sau theo chuẩn xưởng → chỉnh L / W / H cho các TẤM vừa đúng kích thước yêu cầu
   *   (mẫu có cánh phủ ngoài thùng thì hộp các tấm lớn hơn L × W × H) → kiểu khoan → tên tấm tiếng Việt → đưa về chỗ đặt (dời + xoay) bằng một ma trận.
   * opt: { id, ten, rong, sau, cao (kích thước phủ bì của các tấm), corner: [x, y, z] góc trái – trước – dưới (bỏ trống = hỏi bấm điểm), xoay (độ),
   *        phong, ma (tên phòng / mã tủ ghi vào tấm), day (dày ván xưởng, 0 = giữ), hau (dày hậu phủ sau, 0 = giữ kết cấu mẫu), mep, khoan (kiểu khoan xưởng), ten_viet, onStatus }
   * ------------------------------------------------------------------ */
  const hopNhieu = (ds, kh) => { const m = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity]; for (const e of ds) { let x; try { x = D.hopTheo(e, kh); } catch (er) { continue; } if (!x.every(isFinite)) continue; for (let i = 0; i < 6; i += 2) { m[i] = Math.min(m[i], x[i]); m[i + 1] = Math.max(m[i + 1], x[i + 1]); } } return m.map(r2); };
  /** Tên tấm của mẫu kho (tiếng Trung) → tên tiếng Việt để ghi vào bản vẽ. Không nhận ra thì trả nguyên tên cũ. */
  D.tenTamMoi = t => {
    t = String(t || '').trim();
    if (!/[㐀-鿿]/.test(t)) return t;
    for (const [a, b] of TEN_TAM) {
      const k = t.indexOf(a); if (k < 0) continue;
      const truoc = t.slice(0, k), sau = t.slice(k + a.length);
      const vi = s => s.replace(/[（(]\s*自动\s*[)）]/g, ' (tự động)').replace(/左/g, ' trái').replace(/右/g, ' phải').replace(/上/g, ' trên').replace(/下/g, ' dưới').replace(/中/g, ' giữa').replace(/前/g, ' trước').replace(/后/g, ' sau').replace(/[（]/g, '(').replace(/[）]/g, ')');
      const tr = vi(truoc), sa = vi(sau);
      if (/[㐀-鿿]/.test(tr + sa)) return `${b} (${t})`;      // còn chữ chưa dịch được: giữ tên gốc trong ngoặc
      return (b + (tr ? ' ' + tr.trim() : '') + (sa ? (/^[\s(]/.test(sa) ? '' : ' ') + sa : '')).replace(/\s+/g, ' ').trim();
    }
    return t;
  };
  const veKhoImpl = async (opt) => {
    opt = Object.assign({ xoay: 0, ten_viet: true, day: 0, hau: 0, mep: 1, khoan: '', onStatus() {} }, opt || {});
    opt.onStatus = guard(opt.onStatus);
    const warnings = [], notes = [];
    const hong = t => ({ ok: false, kho: true, giai_doan: 'nhap', errors: [t], warnings, notes });
    const id = Math.round(Number(opt.id)) || 0;
    if (!(id > 0)) return hong('Chưa chọn mẫu kho.');
    const kt = [opt.rong, opt.sau, opt.cao].map(v => r2(Number(v)));
    if (!kt.every(v => v >= 20 && v <= 30000)) return hong('Kích thước rộng / sâu / cao để vẽ mẫu chưa hợp lệ.');
    if (!D.available()) return hong('Không thấy Chenfeng trong trang này.');
    if (!D.editing()) return hong('Chenfeng chưa ở màn hình vẽ (đang ở trang chủ hoặc có cửa sổ che kín vùng vẽ) — mở bản vẽ rồi bấm lại.');
    const n3 = a => Array.isArray(a) && a.length === 3 && a.every(v => typeof v === 'number' && isFinite(v));
    const xoay = Number(opt.xoay) || 0, ten = String(opt.ten || 'Mẫu kho').trim().slice(0, 60);
    let goc;
    if (opt.corner) { if (!n3(opt.corner)) return hong('Toạ độ đặt mẫu phải là 3 số [x, y, z].'); goc = opt.corner.map(r2); }
    else {
      opt.onStatus('Bấm 1 điểm trên bản vẽ để đặt mẫu (góc trái – trước – dưới).');
      goc = await D.hoiDiem('Một Nhà: bấm điểm đặt mẫu kho (góc trái - trước - dưới):');
      if (!goc) return hong('Đã huỷ — chưa vẽ gì.');
    }
    // CHỖ DỰNG: bên phải mọi thứ đang có 6 m (hộp các tấm đo ở đó không lẫn tấm khác; chuẩn hoá hậu cần module thẳng trục)
    let mx = -Infinity;
    for (const e of D.all()) { try { const b = e.BoundingBox; if (b && isFinite(b.max.x) && Math.abs(b.max.x) < 1e7) mx = Math.max(mx, b.max.x); } catch (er) { /* bỏ qua đối tượng không có hộp bao */ } }
    const X0 = isFinite(mx) ? Math.ceil((mx + 6000) / 500) * 500 : 0;
    const h0 = hmMark();
    const truocVe = new Set(root.app.Database.ModelSpace.Entitys);
    const cuaToi = () => root.app.Database.ModelSpace.Entitys.filter(e => e && !e.IsErase && !truocVe.has(e));
    const errors = [];
    const xong = (gd, them) => {
      const added = cuaToi(), h1 = hmMark(), steps = h0 && h1 && h1.i > h0.i ? h1.i - h0.i : (added.length ? 1 : 0);
      if (added.length) D.last = { added, steps, mark: h1, kho: true };
      opt.onStatus(errors.length ? 'Có lỗi — xem thẻ Kết quả.' : 'Xong.');
      return Object.assign({ ok: errors.length === 0, kho: true, giai_doan: gd, errors, warnings, notes, so_buoc_hoan_tac: steps, mau: { id, ten }, yeu_cau: kt.slice(), goc, xoay_do: xoay, khung: { goc, xoay } }, them || {});
    };
    // 1. NHẬP mẫu qua cổng 晨丰导入, thẳng trục
    opt.onStatus(`Đang tải mẫu “${ten}” từ kho Chenfeng…`);
    let res;
    try {
      res = await D.importCF({ ModelSpace: [{ Type: 'Template', TempalteId: id, Name: ten, BoxSize: kt.slice(), Pos: [0, 0, 0], RoomName: String(opt.phong || ''), CabinetName: String(opt.ma || ten).slice(0, 40), ParamMap: [] }] },
        [X0, 0, 0], { onStatus: opt.onStatus, timeout: 300000, timeout_khoan: 420000, bao_tai: `Chenfeng đang tải và dựng mẫu “${ten}” — mẫu nhiều tấm có thể mất 1–2 phút (để tab Chenfeng mở trên màn hình cho nhanh)…` });
    } catch (e) { errors.push(String(e && e.message || e)); return xong(cuaToi().length ? 'xong' : 'nhap'); }
    if (res.cancelled || !cuaToi().length) { errors.push('Chenfeng không dựng được mẫu này (lệnh nhập bị huỷ, hoặc mẫu không còn trong kho của tài khoản) — chưa vẽ gì.'); return xong('nhap'); }
    const tamCua = () => cuaToi().filter(D.isBoard);
    let boards = tamCua();
    const T = boards.length ? rootTpl(boards[0]) : null;
    const vat = () => { const b = tamCua(); return b.length ? b : cuaToi().filter(e => { try { return isFinite(e.BoundingBox.min.x) && !D.isHole(e); } catch (er) { return false; } }); };
    const khM = () => (boards.length ? D.khungCua(boards[0]) : null);
    if (!boards.length) notes.push('Mẫu này không có tấm ván (mô hình trang trí / phụ kiện): bảng chỉ đặt đúng chỗ, không chỉnh ván, không khoan.');
    // 2. DÀY VÁN theo xưởng (tham số BH của module) — trước khi đo, vì đổi dày ván có thể làm đổi phủ bì
    let dv = null;
    if (boards.length && opt.day > 0) {
      try { dv = await D.dayVan(boards[0], opt.day, { onStatus: opt.onStatus }); } catch (e) { dv = { ok: false, ly_do: String(e && e.message || e).slice(0, 160) }; }
      if (dv.ok && !dv.da_dung) notes.push(`Dày ván: ${dv.tu} → ${dv.day} cho ${dv.doi} tấm (tham số BH của module).${dv.con ? ` Còn ${dv.con} tấm vẫn dày ${dv.tu} (${dv.ten_con.slice(0, 5).join(', ')}) — tham số của mẫu không nối tới các tấm này, đổi tay nếu cần.` : ''}`);
      else if (!dv.ok) notes.push('Dày ván giữ nguyên như mẫu: ' + dv.ly_do);
      boards = tamCua();
    }
    // 3. HẬU PHỦ SAU theo chuẩn xưởng (module đang thẳng trục — xoay rồi thì không chuẩn hoá được)
    let ch = null;
    if (boards.length && opt.hau > 0) {
      try { ch = await D.chuanHoa((dv && dv.tam && !dv.tam.IsErase && dv.tam) || boards[0], { hau: opt.hau, mep: opt.mep, khoan: opt.khoan, khoan_lai: false, onStatus: opt.onStatus }); } catch (e) { ch = { ok: false, ly_do: String(e && e.message || e).slice(0, 200) }; }
      if (ch.ok && ch.da_chuan) notes.push((ch.ghi_chu || [])[0] || 'Hậu của mẫu đã phủ sau lưng sẵn.');
      else if (ch.ok) { notes.push(`Hậu: ${ch.so_hau} tấm chuyển thành hậu ${r2(opt.hau)} li phủ sau lưng thùng (lùi mép ${r2(opt.mep)}), không khoan${ch.sua_mep_sau && ch.sua_mep_sau.length ? `; mép sau của ${ch.sua_mep_sau.length} tấm thùng lùi lại cho hậu phủ lên` : ''}${ch.xoa_giang ? `; đã bỏ ${ch.xoa_giang} thanh giằng sau hậu` : ''}.`); for (const g of (ch.ghi_chu || [])) warnings.push(g); }
      else warnings.push('Hậu giữ nguyên kết cấu của mẫu (chưa chuyển được sang hậu phủ sau): ' + ch.ly_do);
      boards = tamCua();
    }
    // 4. VỪA KÍCH THƯỚC: hộp của các TẤM (trong hệ module) phải đúng rộng × sâu × cao yêu cầu.
    //    Mẫu có cánh / tấm phủ ngoài khung module thì hộp các tấm lớn hơn L × W × H → chỉnh tham số trục đó đúng bằng phần dư rồi đo lại.
    //    Trục nào chỉnh rồi mà các tấm vẫn không về đúng số (mẫu có phần CỐ ĐỊNH theo trục đó — đo trên "Tủ giày 10" của kho: 2 tấm sâu cố định 350) → trả tham số trục đó
    //    về số yêu cầu, không để module lệch nửa vời (thùng nông đi mà tấm cố định vẫn thò ra).
    let kh = khM(), hop = hopNhieu(vat(), kh);
    const tran = () => [r2(hop[1] - hop[0]), r2(hop[3] - hop[2]), r2(hop[5] - hop[4])];
    const lech = () => tran().map((v, i) => r2(kt[i] - v));
    let vua = null;
    if (T && boards.length && lech().some(d => Math.abs(d) > 0.6)) {
      const ps = [T.LParam, T.WParam, T.HParam];
      if (ps.every(p => p && isFinite(Number(p.value)))) {
        const cu = ps.map(p => r2(Number(p.value))), d0 = lech(), moi = cu.map((v, i) => (Math.abs(d0[i]) > 0.6 ? r2(v + d0[i]) : v));
        if (moi.every(v => v > 20)) {
          opt.onStatus(`Chỉnh kích thước module cho vừa: ${moi.join(' × ')}…`);
          let mo = false, loi = '', den = cu.slice();
          try { const h = hm(); if (h && typeof h.StartCmd === 'function' && typeof h.EndCmd === 'function') { h.StartCmd('MNCF_VUA'); mo = true; } } catch (e) { mo = false; }
          const cay = []; (function di(t, n) { if (!t || cay.includes(t) || n > 8) return; cay.push(t); for (const c of (t.Children || [])) di(idOf(c), n + 1); })(T, 0);
          for (const b of boards) { try { b.WriteAllObjectRecord(); } catch (e) { /* bỏ qua */ } }
          for (const t of cay) { try { if (typeof t.WriteAllObjectRecord === 'function') t.WriteAllObjectRecord(); } catch (e) { /* bỏ qua */ } }
          const dat = async gt => { ps.forEach((p, i) => { if (r2(Number(p.value)) !== gt[i] || (p.expr !== '' && p.expr != null && Number(p.expr) !== gt[i])) p.expr = String(gt[i]); }); await T.UpdateTemplateTree(); await sleep(300); boards = tamCua(); kh = khM(); hop = hopNhieu(vat(), kh); den = gt.slice(); };
          try {
            await dat(moi);
            const d1 = lech(), tra = moi.map((v, i) => (v !== cu[i] && Math.abs(d1[i]) > 0.6 ? cu[i] : v));
            if (tra.some((v, i) => v !== moi[i])) await dat(tra);
          } catch (e) { loi = String(e && e.message || e).slice(0, 120); }
          if (mo) { try { hm().EndCmd(); } catch (e) { /* bỏ qua */ } }
          await D.settle(500, 60000);
          boards = tamCua(); kh = khM(); hop = hopNhieu(vat(), kh);
          vua = { tu: cu, den, loi };
          if (loi) warnings.push('Chenfeng báo lỗi khi chỉnh kích thước module: ' + loi);
          else if (den.some((v, i) => v !== cu[i])) notes.push(`Kích thước module (L × W × H) chỉnh từ ${cu.join(' × ')} thành ${den.join(' × ')} để các tấm vừa đúng ${kt.join(' × ')} (mẫu có phần phủ ra ngoài khung module, vd cánh phủ trước thùng).`);
        }
      }
    }
    {
      const d = lech(), tr = tran(), TEN = ['rộng', 'sâu', 'cao'], khac = TEN.map((t, i) => (Math.abs(d[i]) > 0.6 ? `${t} ${tr[i]} (yêu cầu ${kt[i]})` : '')).filter(Boolean);
      if (khac.length) warnings.push(`Mẫu này không co giãn đúng theo kích thước yêu cầu: các tấm đang chiếm ${khac.join(', ')} — mẫu có phần kích thước cố định, hoặc cánh / tấm phủ ngoài khung module mà tham số của mẫu không bù được. Lưng, mép trái và đáy vẫn đặt đúng chỗ; phần chênh nằm ở phía trước / bên phải / phía trên. Chỉnh tiếp ở ô Thông số của Chenfeng.`);
    }
    // 5. KIỂU KHOAN: mẫu của cửa hàng mang kiểu khoan không có trong cấu hình tài khoản → đổi sang kiểu của xưởng, khoan lại (cũng là lần khoan sau khi đổi dày ván / hậu / kích thước)
    let fix = null;
    if (boards.length) {
      const daDoi = !!(vua || (dv && dv.ok && !dv.da_dung) || (ch && ch.ok && !ch.da_chuan));
      const kq = opt.khoan || D.drillTypes()[0] || '';
      try { fix = await D.finalize(boards, kq, { ep: daDoi, kem: boards.filter(b => { try { return (b.BoardProcessOption.highDrill || []).every(x => !x || x === Core.KHONG_KHOAN); } catch (e) { return false; } }), onStatus: opt.onStatus }); } catch (e) { fix = { fixed: 0, normalized: 0, reason: String(e && e.message || e).slice(0, 160) }; }
      if (fix.fixed) notes.push(`Kiểu khoan của mẫu (${(fix.old || []).join(', ')}) không có trong cấu hình tài khoản: đã đổi sang ${fix.to} cho ${fix.fixed} tấm rồi cho Chenfeng khoan lại.`);
      if (fix.reason) warnings.push(fix.reason);
      boards = tamCua();
    }
    // 6. TÊN TẤM tiếng Việt (sau chuẩn hoá — bước đó nhận tấm hậu / cánh theo tên gốc) — 1 bước lịch sử riêng
    let doiTen = 0;
    if (opt.ten_viet && boards.length) {
      const ds = []; for (const b of boards) { const cu = String(b.Name || ''), moi = D.tenTamMoi(cu); if (moi && moi !== cu) ds.push([b, moi]); }
      if (ds.length) {
        let mo = false;
        try { const h = hm(); if (h && typeof h.StartCmd === 'function' && typeof h.EndCmd === 'function') { h.StartCmd('MNCF_TENTAM'); mo = true; } } catch (e) { mo = false; }
        for (const [b, moi] of ds) { try { b.Name = moi; doiTen++; } catch (e) { /* bỏ qua */ } }
        if (mo) { try { hm().EndCmd(); } catch (e) { /* bỏ qua */ } }
      }
    }
    // 7. ĐƯA VỀ CHỖ ĐẶT (dời + xoay quanh trục đứng) — 1 bước hoàn tác. Neo theo LƯNG: mép trái, đáy và mặt SAU của hộp các tấm về đúng mép trái, đáy và
    //    mặt sau của chỗ đặt (lưng tủ là thứ áp tường) — mẫu sâu hơn yêu cầu thì phần dư nhô ra phía trước, không đâm vào tường.
    await D.settle(400, 20000);
    kh = khM(); hop = hopNhieu(vat(), kh);
    const neo = [hop[0], r2(hop[3] - kt[1]), hop[4]];
    const p0 = kh ? apM(kh.G, neo) : neo;
    let dat = null, hopCuoi = null;
    if (p0.every(isFinite)) {
      opt.onStatus(xoay ? `Đưa mẫu về chỗ đặt, xoay ${r2(xoay)}°…` : 'Đưa mẫu về chỗ đặt…');
      try {
        const C = lopM4(), nguon = D.taoKhung(p0, kh ? kh.xoay : 0), Mx = new C().makeRotationZ(xoay * Math.PI / 180);
        Mx.setPosition(goc[0], goc[1], goc[2]); Mx.multiply(nguon.Gn);
        dat = await D.apMaTran(cuaToi(), Mx, 'MNCF_DAT');
        if (dat.ok) {
          hopCuoi = hopNhieu(vat(), D.taoKhung(goc, xoay));
          const lc = [hopCuoi[0], r2(hopCuoi[3] - kt[1]), hopCuoi[4]];
          if (lc.some(v => Math.abs(v) > 0.6)) errors.push(`Đưa mẫu về chỗ đặt xong bị lệch (mép trái / lưng / đáy cách chỗ đặt ${lc.join(' / ')}) — hoàn tác rồi vẽ lại.`);
        } else errors.push(`Mẫu đã dựng xong ở chỗ trống (x ≈ ${r2(p0[0])}) nhưng chưa đưa được về chỗ đặt: ${dat.reason} — dùng lệnh MOVE của Chenfeng để dời.`);
      } catch (e) { errors.push(`Chưa đưa được mẫu về chỗ đặt: ${e && e.message || e}`); }
    } else errors.push('Không đo được hộp bao của mẫu vừa dựng — mẫu đang nằm ở chỗ dựng tạm, dùng lệnh MOVE của Chenfeng để dời.');
    const tat = cuaToi(), ten_tam = {};
    for (const b of tat.filter(D.isBoard)) { const t = String(b.Name || ''); ten_tam[t] = (ten_tam[t] || 0) + 1; }
    const dl = tat.some(D.isBoard) ? doLoiSauVe(tat, errors, opt.kho || null) : null;
    return xong('xong', { do_loi: dl, so_tam: tat.filter(D.isBoard).length, so_phu_kien: tat.filter(D.isHardware).length, so_lo: tat.filter(D.isHole).length, kich: hopCuoi ? [r2(hopCuoi[1] - hopCuoi[0]), r2(hopCuoi[3] - hopCuoi[2]), r2(hopCuoi[5] - hopCuoi[4])] : tran(),
      hop: hopCuoi, vua, day_van: dv, chuan_hoa: ch, sua_khoan: fix, doi_ten: doiTen, ten_tam, dat, module: T ? String(T.Name || '') : '', la_module: !!kh });
  };
  /** Vẽ một mẫu của kho Chenfeng vào bản vẽ theo kích thước + chỗ đặt (xem chú thích ở trên). Giữ Web Lock như D.draw để tab nền không bị đóng băng giữa chừng. */
  D.veKho = async (opt) => {
    D.boManChe();
    let res, ran = false;
    const run = async () => { ran = true; res = await veKhoImpl(opt); return res; };
    try {
      const nav = root.navigator;
      if (nav && nav.locks && typeof nav.locks.request === 'function') { await nav.locks.request('mncf-ve-tu', { mode: 'shared' }, run); return res; }
    } catch (e) { if (ran) throw e; }
    return run();
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
        offset = [r2((isFinite(mx) ? Math.ceil((mx + 6000) / 500) * 500 : 0) - base[0]), r2(-base[1]), r2(-base[2])];      // cách mọi thứ 6 m: lúc nhìn thẳng vào chỗ vẽ, phòng / tủ khác nằm ngoài màn hình
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
    // nhìn thẳng mặt trước vào đúng vùng sắp vẽ (chưa có tấm nào để ZoomtoEntitys) rồi rê chuột tới điểm đặt — xem chayGoc: tránh chế độ "đặt theo phòng" của LEFTRIGHTBOARD
    const nhinChoVe = async diem => {
      try {
        const V = root.app.Viewer; let B = null;
        for (const e of D.all()) { try { const q = e.BoundingBox; if (q && q.min && q.max && typeof q.clone === 'function') { B = q.clone(); break; } } catch (er) { /* thử đối tượng khác */ } }
        V.ViewToFront();
        if (B && typeof V.ZoomtoEntitys === 'function') {
          B.min.set(bb.x0 + offset[0], bb.y0 + offset[1], bb.z0 + offset[2]); B.max.set(bb.x1 + offset[0], bb.y1 + offset[1], bb.z1 + offset[2]);
          V.ZoomtoEntitys([{ BoundingBox: B }]);
        }
        V.UpdateRender(); veNgay();
      } catch (e) { /* không quay được thì thôi: bước đối chiếu sau lệnh vẫn bắt được thùng lệch chỗ */ }
      await sleep(60);
      try { reChuot(diem); } catch (e) { /* bỏ qua */ }
      await sleep(90);
    };
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
        if (b.lenh === 'LR') { tra = await chayGoc(TEN_LENH_GOC.LR, st => LUA_CHON.LR(st, b), dich(b.goc), 'goc', null, { truoc_diem: () => nhinChoVe(dich(b.goc)) }); daNhin = false; }
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
        try { const o = e.BoardProcessOption, rm = (Array.isArray(o.remarks) ? o.remarks : []).filter(r => r && r[0] && r[0] !== D.TAG && String(r[0]).indexOf(D.TAG + ' ') !== 0); rm.unshift([Core.nhanTu(id), '']); e.BoardProcessOption = Object.assign({}, o, { remarks: rm }); } catch (er) { /* bỏ qua */ }
      }
      if (mo) { try { hm().EndCmd(); } catch (e) { /* bỏ qua */ } }
    }
    const daVe = new Set(); K.buoc.slice(0, xong).forEach(b => b.tam.forEach(i => daVe.add(M.parts[i])));
    // phần không có lệnh gốc (phào, phụ trợ, xà chân, khung hộc kéo, ngăn kéo, suốt treo): nhập qua cổng như trước, rồi gom với các thùng lệnh gốc thành MỘT module (bản 1.16)
    let roi = null;
    const conLai = M.parts.filter(p => !daVe.has(p));
    let tm = null;      // kết quả thêm mẫu (ngăn kéo, suốt treo) — bản 1.23: tấm rời nhập trước (không cần máy chủ), mẫu thêm sau; mẫu hỏng thì chỉ thiếu mẫu đó
    if (!errors.length && opt.phan_roi !== false && (conLai.length || (M.templates || []).some(tp => tp.id))) {
      try {
        let them = [], huy = false;
        if (conLai.length) {
          opt.onStatus(`Đang vẽ ${conLai.length} tấm còn lại (phào, chân, khung hộc kéo…)…`);
          const cf = Core.toChenfeng(Object.assign({}, M, { parts: conLai }), { id, khong_mau: true });
          const res = await D.importCF(cf.json, [offset[0] + cf.base[0], offset[1] + cf.base[1], offset[2] + cf.base[2]], Object.assign({}, opt, { co_mau: false }));
          if (res.cancelled) { huy = true; warnings.push('Phần tấm rời (phào, chân, ngăn kéo…) chưa vẽ: lệnh nhập bị huỷ.'); }
          else them = res.added;
        }
        if (!huy) {
          // tấm rời thiết kế ↔ tấm thật (để chọn tấm kẹp cho lệnh ngăn kéo — vách đệm là tấm rời — và gắn hành động co giãn)
          const dung = new Set(tamCua.values());
          for (const p of conLai) {
            const want = [p.x0 + offset[0], p.x1 + offset[0], p.y0 + offset[1], p.y1 + offset[1], p.z0 + offset[2], p.z1 + offset[2]];
            const hit = them.find(e => e && !e.IsErase && D.isBoard(e) && !dung.has(e) && D.tagOf(e) === id && near(D.boxOf(e), want, 0.15));
            if (hit) { dung.add(hit); tamCua.set(p, hit); }
          }
          // ngăn kéo bằng lệnh DRAWER gốc (bản 1.26); ô không vẽ được bằng lệnh gốc + suốt treo: chèn mẫu như bản 1.23
          tm = await D.themMauNK(K, offset, tamCua, opt);
          them = them.concat(tm.added);
          roi = { so_tam: conLai.length, added: them };
          if (tm.ban) roi.sua_khoan = { fixed: 0, normalized: 0 };
          else { try { roi.sua_khoan = await D.finalize(them.filter(D.isBoard), M.spec.khoan.thung, opt); } catch (e) { roi.sua_khoan = { fixed: 0, normalized: 0, reason: e.message }; } }
          conLai.forEach(p => daVe.add(p));
          warnings.push(...baoMau(tm), ...tm.nk.bao);
          if (tm.ban) warnings.push(BAO_BAN);
        }
      } catch (e) { warnings.push(`Phần tấm rời (phào, chân, ngăn kéo…) chưa vẽ được: ${e.message}`); }
      await D.settle(700, 20000);
    }
    let added = cuaToi();
    const veDuMau = !!roi, Mcm = veDuMau ? boMauThieu(M, tm) : M;
    const Msub = Object.assign({}, M, { parts: M.parts.filter(p => daVe.has(p)), templates: veDuMau ? Mcm.templates : [], mat_ngan_keo: veDuMau ? Mcm.mat_ngan_keo : [] });
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
    // hộp ngăn kéo kế hoạch định vẽ bằng lệnh gốc nhưng rốt cuộc phải chèn mẫu: cũng là phần "không có lệnh gốc" của lần vẽ này
    const nkChen = tm && tm.nk ? K.nk.reduce((n, b) => n + b.tp.filter(j => !tm.nk.xong.has(j) && !tm.thieu.some(x => x.tp === M.templates[j])).length, 0) : 0;
    const chua = nkChen ? K.chua.filter(c => !(c.loai === 'MAU' && c.ten === 'Ngăn kéo')).concat([{ loai: 'MAU', ten: 'Ngăn kéo', sl: nkChen + ((K.chua.find(c => c.loai === 'MAU' && c.ten === 'Ngăn kéo') || {}).sl || 0) }]) : K.chua;
    if (!errors.length && xong === K.buoc.length && roi && M.spec.module_cf && opt.module !== false && !(tm && tm.ban)) {
      try { mod = await ganModuleGoc(K, offset, tamCua, added, id, opt, tm && tm.nk ? tm.nk.xong : null); } catch (e) { mod = { ok: false, reason: String(e && e.message || e) }; }
      if (mod.ok) {
        added = cuaToi();
        const v2 = D.verify(Msub, added, offset), nkLech = v2.mat_ngan_keo_lech.filter(t => v.mat_ngan_keo_lech.indexOf(t) < 0);      // (bản 1.26: ngăn kéo lệnh gốc nằm trong cây mẫu của thùng — gom xong phải còn đúng chỗ)
        if (v2.thieu.length || nkLech.length) { if (mod.steps) await D.undo(mod.steps); mod = { ok: false, reason: v2.thieu.length ? `gom module làm lệch ${v2.thieu.length} tấm (${v2.thieu.slice(0, 2).join('; ')}) — đã trả lại như trước khi gom.` : `gom module làm lệch ${nkLech.slice(0, 2).join('; ')} — đã trả lại như trước khi gom.` }; added = cuaToi(); }
      }
    }
    if (mod && mod.ok) for (const g of mod.ghi_chu) warnings.push(g);
    else if (chua.length) {
      const ly = mod && !mod.khong_can ? ` (chưa gom được thành một module: ${mod.reason})` : mod && mod.khong_can ? '' : (!M.spec.module_cf ? ' (đang tắt "Module Chenfeng" ở Chuẩn xưởng)' : '');
      warnings.push(roi ? `Vẽ dạng TẤM RỜI, không chạy theo khi đổi kích thước tủ trong Chenfeng${ly}: ${chua.map(c => `${c.ten} × ${c.sl}`).join(', ')}.` : `Chưa vẽ: ${chua.map(c => `${c.ten} × ${c.sl}`).join(', ')}.`);
    } else if (mod && mod.khong_can) warnings.push(mod.reason);
    // mặt ngăn kéo đang nằm đúng chỗ thiết kế (trước khi dời tủ)
    const matDung = [];
    if (canDat && Msub.mat_ngan_keo.length) {
      const tamTK = new Set(tamCua.values()), khac = added.filter(e => D.isBoard(e) && !tamTK.has(e)).map(e => D.boxOf(e));
      for (const q of Msub.mat_ngan_keo) { const tq = q.t > 0 ? q.t : M.spec.van.t, want = [q.x + offset[0], q.x + q.w + offset[0], q.y + offset[1], q.y + tq + offset[1], q.z + offset[2], q.z + q.h + offset[2]]; if (khac.some(x => near(x, want, 0.12))) matDung.push(q); }
    }
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
          // mặt ngăn kéo (trước khi dời đang đúng chỗ) cũng phải theo tủ về đúng chỗ — ngăn kéo lệnh gốc là một nhánh của cây mẫu thùng, không phải tấm của thiết kế
          const tamTK = new Set(tamCua.values()), khac = cuaToi().filter(e => D.isBoard(e) && !tamTK.has(e)).map(e => D.hopTheo(e, kh));
          for (const q of matDung) { const tq = q.t > 0 ? q.t : M.spec.van.t, want = [q.x - base[0], q.x + q.w - base[0], q.y - base[1], q.y + tq - base[1], q.z - base[2], q.z + q.h - base[2]]; if (!khac.some(x => near(x, want, 0.25))) { lech++; if (!vd) vd = `mặt ngăn kéo khoang ${q.khoang + 1}`; } }
          if (lech) errors.push(`Đưa tủ về chỗ đặt xong có ${lech} tấm lệch vị trí (vd "${vd}") — hoàn tác rồi vẽ lại.`);
        } else errors.push(`Tủ đã vẽ xong ở chỗ trống (x ≈ ${r2(offset[0] + base[0])}) nhưng chưa đưa được về chỗ đặt: ${dat.reason} — dùng lệnh MOVE của Chenfeng để dời.`);
      } catch (e) { errors.push(`Chưa đưa được tủ về chỗ đặt: ${e && e.message || e}`); }
    }
    // trả hướng nhìn về như trước khi vẽ, nhìn vào tủ vừa đặt
    try { const V = root.app.Viewer; if (huongNhin && V.CameraControl && typeof V.CameraControl.LookAt === 'function') V.CameraControl.LookAt(huongNhin); const bs = cuaToi().filter(D.isBoard); if (bs.length && typeof V.ZoomtoEntitys === 'function') V.ZoomtoEntitys(bs); V.UpdateRender(); } catch (e) { /* bỏ qua */ }
    added = cuaToi();
    const dl = added.some(D.isBoard) ? doLoiSauVe(added, errors, { dai: M.spec.van.kho_dai, rong: M.spec.van.kho_rong }) : null;
    const h1 = hmMark();
    const steps = h0 && h1 && h1.i > h0.i ? h1.i - h0.i : xong;
    D.last = { M: Msub, added, offset: atW.slice(), khung, steps, mark: h1, id, goc_cf: true };      // offset = vị trí gốc thiết kế; tủ xoay (khung.xoay ≠ 0) thì toạ độ tấm = xoay(thiết kế) + offset
    opt.onStatus('Xong.');
    return { ok: errors.length === 0, giai_doan: 'xong', id, errors, warnings, notes: M.notes, offset: atW.slice(), goc: gocCuoi, xoay_do: xoay, khung, dat, kiem_tra: v, do_loi: dl, sua_khoan: { fixed: 0, normalized: 0 }, so_buoc_hoan_tac: steps,
      module: mod && (mod.ok || !mod.khong_can) ? mod : null, goc_cf: true, chua, tam_roi: roi ? roi.so_tam : 0, buoc: xong, tong_buoc: K.buoc.length, do_lai: nk, them_hinh: themHinh, kich: [r2(bb.x1 - bb.x0), r2(bb.y1 - bb.y0), r2(bb.z1 - bb.z0)], tom_tat: Core.summary(M),
      mau_thieu: tm ? gonMauThieu(tm) : [], mau_doi: tm ? tm.doi_ma : [], nk_goc: tm && tm.nk ? { tong: tm.nk.tong, so: tm.nk.so, lui: tm.nk.lui.map(h => ({ khoang: h.khoang, ly_do: h.ly_do })) } : null };
  };

  /* ------------------------------------------------------------------ *
   * DÒ LỖI SẢN XUẤT trên tấm và lỗ khoan THẬT (bản 1.20 — anh Jason 04/10/2026: "vẽ phải chuẩn kết cấu, tự động dò lỗi để anh còn sản xuất được").
   * Chỉ ĐỌC bản vẽ: tấm đè / trùng nhau, lỗ khoan giao nhau, lỗ lệch khỏi tấm hoặc khoan thủng tấm, kiểu khoan lạ, tấm không lỗ, mối nối dài không liên kết, tấm vượt khổ, tấm đứng riêng, tấm chưa có tên tủ (Core.doLoiThat).
   * Dùng được cho tủ của bảng, mẫu kho lẫn phần người dùng tự vẽ / tự sửa.
   * Đo trên Chenfeng 04/10/2026: tấm có OBB { ocs (Matrix4: 3 cột đầu = trục riêng, cột 3 = pháp tuyến), halfSizes, center };
   * lỗ CylinderHole: _Matrix cột 4 = MIỆNG lỗ, cột 3 = hướng khoan vào ván, Height = sâu, Radius, GroupId.Index (3 lỗ của một cam chung nhóm), FId = tấm cái, MId = tấm đực.
   * Lệnh CHECKHOLES của Chenfeng cho cùng kết quả với phép dò lỗ ở đây (đã thử cả trường hợp có lỗ giao nhau), nhưng nó cần tab đang hiện và mở hộp thoại riêng.
   * ------------------------------------------------------------------ */
  // đường bao có cung (bul = tan(góc ở tâm / 4), dương = ngược chiều kim đồng hồ): chia mỗi cung thành các đoạn 15°
  const chiaCung = P => {
    const R = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[i], n = P[(i + 1) % P.length], bl = a[2];
      R.push([a[0], a[1]]);
      if (!bl) continue;
      const th = 4 * Math.atan(bl), k = (1 - bl * bl) / (4 * bl), cx = (a[0] + n[0]) / 2 - (n[1] - a[1]) * k, cy = (a[1] + n[1]) / 2 + (n[0] - a[0]) * k;
      const r = Math.hypot(a[0] - cx, a[1] - cy), a0 = Math.atan2(a[1] - cy, a[0] - cx), so = Math.max(2, Math.ceil(Math.abs(th) / (Math.PI / 12)));
      for (let j = 1; j < so; j++) { const g = a0 + th * j / so; R.push([cx + r * Math.cos(g), cy + r * Math.sin(g)]); }
    }
    return R;
  };

  /**
   * Đọc tấm + lỗ thành dữ liệu thuần. `ents` lẫn lộn tấm, lỗ, phụ kiện cũng được. Tấm xoay theo tường xiên vẫn đọc được: mỗi nhóm hướng (góc quanh trục Z, lấy theo 90°) có hệ trục riêng.
   * Mã mẫu (`mau`, để miễn va chạm trong lòng một mẫu kho — rãnh, mộng): tấm do BẢNG vẽ (mang mã tủ) không có mã mẫu, vì thiết kế của bảng không có tấm nào được phép ăn vào nhau;
   * mẫu kho nằm trong module tủ của bảng (ngăn kéo, suốt treo) thì tính theo từng mẫu con; còn lại theo module gốc. opt.nen = mọi tấm của bản vẽ (để nhận ra module tủ khi chỉ kiểm vài tấm).
   */
  D.docThat = (ents, opt) => {
    const tam = [], vt = new Map(), hes = [], maMau = new Map(), entTam = [];
    let lech = 0, cong = 0;
    const gocTu = new Set();
    for (const b of ((opt && opt.nen) || ents || [])) { try { if (b && !b.IsErase && D.isBoard(b) && D.tagOf(b)) { const g0 = rootTpl(b); if (g0) gocTu.add(g0); } } catch (e) { /* bỏ qua */ } }
    const mauCua = b => {
      if (D.tagOf(b)) return null;
      try { let o = b.Template && b.Template.Object, truoc = null, n = 0; while (o && o.Parent && o.Parent.Object && n++ < 40) { truoc = o; o = o.Parent.Object; } return !o ? null : gocTu.has(o) && truoc ? truoc : o; } catch (e) { return null; }
    };
    for (const b of (ents || [])) {
      if (!b || b.IsErase || !D.isBoard(b)) continue;
      let uon = false; try { uon = b.IsArcBoard === true; } catch (e) { uon = false; }
      if (uon) { cong++; continue; }      // tấm uốn theo đường dẫn: hộp bao không nói lên hình thật
      let ob = null; try { ob = b.OBB; } catch (e) { ob = null; }
      const el = ob && ob.ocs && ob.ocs.elements, hs = ob && ob.halfSizes, c = ob && ob.center;
      if (!el || !hs || !c) { lech++; continue; }
      const ax = [[el[0], el[1], el[2]], [el[4], el[5], el[6]], [el[8], el[9], el[10]]], h3 = [hs.x, hs.y, hs.z];
      // tấm của tủ luôn có đúng một trục thẳng đứng và hai trục nằm ngang; khác thế là tấm nghiêng (vát mái…) → bỏ ra, có đếm
      const dung = ax.findIndex(a => Math.abs(Math.abs(a[2]) - 1) < 1e-4);
      if (dung < 0 || ax.some((a, i) => i !== dung && Math.abs(a[2]) > 1e-4)) { lech++; continue; }
      const ng = ax[(dung + 1) % 3];
      let goc = Math.atan2(ng[1], ng[0]) * 180 / Math.PI; goc = ((goc % 90) + 90) % 90; if (goc > 89.99) goc = 0;
      let he = hes.findIndex(g0 => Math.abs(g0 - goc) < 0.02); if (he < 0) { he = hes.length; hes.push(goc); }
      const a = -hes[he] * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a), q = v => [v[0] * cs - v[1] * sn, v[0] * sn + v[1] * cs, v[2]];
      const cc = q([c.x, c.y, c.z]), nua = [0, 0, 0];
      ax.forEach((v, i) => { const w = q(v); for (let k = 0; k < 3; k++) nua[k] += Math.abs(w[k]) * h3[i]; });
      const o = b.BoardProcessOption || {}, hd = Array.isArray(o.highDrill) ? o.highDrill : [];
      const kieu = [...new Set(hd.filter(x => typeof x === 'string' && x && x !== Core.KHONG_KHOAN))];
      const goc0 = mauCua(b); if (goc0 && !maMau.has(goc0)) maMau.set(goc0, maMau.size + 1);
      let W = 0, H = 0; try { W = +b.Width; H = +b.Height; } catch (e) { /* bỏ qua */ }
      if (!(W > 0 && H > 0)) { W = 2 * h3[0]; H = 2 * h3[1]; }
      const hop = [r2(cc[0] - nua[0]), r2(cc[0] + nua[0]), r2(cc[1] - nua[1]), r2(cc[1] + nua[1]), r2(cc[2] - nua[2]), r2(cc[2] + nua[2])];
      // đường bao thật của tấm KHÔNG chữ nhật (khoét góc khấu cột, cắt góc, bo cong): ContourCurve.LineData nằm trong hệ riêng của tấm (OCS) → đưa về hệ trục của nhóm hướng,
      // lấy hai toạ độ nằm trong mặt tấm (cùng quy ước với Core.kiemVaCham). Đo trên Chenfeng 04/10/2026: đáy khấu cột có 6 đỉnh, OCS của tấm đưa (u, v) về toạ độ bản vẽ.
      let bao;
      try {
        const ld = b.ContourCurve && b.ContourCurve.LineData, oe = b.OCS && b.OCS.elements;
        if (Array.isArray(ld) && ld.length >= 3 && oe) {
          const P = ld.map(d0 => [+d0.pt.x, +d0.pt.y, +d0.bul || 0]);
          if (P.length > 3 && Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) < 1e-6) P.pop();      // điểm đầu lặp lại ở cuối
          const chuNhat = P.length === 4 && P.every((d0, i) => { const n = P[(i + 1) % 4]; return !d0[2] && (Math.abs(d0[0] - n[0]) < 1e-6 || Math.abs(d0[1] - n[1]) < 1e-6); });
          if (!chuNhat && P.every(d0 => isFinite(d0[0]) && isFinite(d0[1]) && isFinite(d0[2]))) {
            const kich = [hop[1] - hop[0], hop[3] - hop[2], hop[5] - hop[4]]; let km = 0; if (kich[1] < kich[km]) km = 1; if (kich[2] < kich[km]) km = 2;
            bao = chiaCung(P).map(d0 => { const w = q([oe[12] + d0[0] * oe[0] + d0[1] * oe[4], oe[13] + d0[0] * oe[1] + d0[1] * oe[5], oe[14] + d0[0] * oe[2] + d0[1] * oe[6]]); return [r2(w[(km + 1) % 3]), r2(w[(km + 2) % 3])]; });
          }
        }
      } catch (e) { bao = undefined; }
      vt.set(b, tam.length);
      const t1 = { ten: String(b.Name || ''), tu: String(o.cabinetName || ''), hop,
        day: r2(+b.Thickness > 0 ? +b.Thickness : 2 * h3[2]), khoan: o.drillType !== Core.KHONG_KHOAN && kieu.length > 0, kieu, mau: goc0 ? maMau.get(goc0) : null, kich: [r2(Math.max(W, H)), r2(Math.min(W, H))], he, vl: String(o.material || o.boardName || '') };
      if (bao) t1.bao = bao;
      tam.push(t1); entTam.push(b);
    }
    const lo = [], nhomPhu = new Map();
    for (const h of (ents || [])) {
      if (!h || h.IsErase || !D.isHole(h)) continue;
      const cai = vt.get(idOf(h.FId)), duc = vt.get(idOf(h.MId));
      if (cai === undefined && duc === undefined) continue;
      let el = null; try { el = (h._Matrix || h.OCS).elements; } catch (e) { el = null; }
      const dai = +h.Height, r = +h.Radius;
      if (!el || !(dai > 0) || !(r > 0)) continue;
      const ld = Math.hypot(el[8], el[9], el[10]) || 1;
      let nhom = null; try { const gid = h.GroupId; nhom = gid && typeof gid.Index === 'number' ? gid.Index : null; } catch (e) { nhom = null; }
      if (nhom === null) { const k = (cai === undefined ? -1 : cai) + '|' + (duc === undefined ? -1 : duc); if (!nhomPhu.has(k)) nhomPhu.set(k, 'p' + nhomPhu.size); nhom = nhomPhu.get(k); }      // không đọc được nhóm: coi mọi lỗ nối cùng hai tấm là một nhóm
      lo.push({ p: [el[12], el[13], el[14]], d: [el[8] / ld, el[9] / ld, el[10] / ld], dai, r, nhom, cai: cai === undefined ? -1 : cai, duc: duc === undefined ? -1 : duc });
    }
    const ra = { tam, lo, lech, cong, goc_he: hes.slice() };
    Object.defineProperty(ra, 'ent', { value: entTam, enumerable: false });      // tấm thật ứng với từng dòng của `tam` (cho các việc cần quay lại đối tượng: đổ màu)
    return ra;
  };

  /**
   * Dò lỗi sản xuất. ents bỏ trống = các tấm đang chọn trên bản vẽ; không chọn gì = mọi tấm của bản vẽ. Lỗ khoan của các tấm đó được tự lấy theo.
   * opt.kho = { dai, rong } khổ ván (mặc định 2440 × 1220).
   * @returns phiếu của Core.doLoiThat + { pham_vi: 'chon' | 'tat_ca' | 'dua_vao' }
   */
  D.doLoi = (ents, opt) => {
    opt = opt || {};
    let pv = 'dua_vao';
    if (!ents) { const chon = D.selected().filter(D.isBoard); if (chon.length) { ents = chon; pv = 'chon'; } else { ents = D.all().filter(D.isBoard); pv = 'tat_ca'; } }
    const boards = ents.filter(e => e && !e.IsErase && D.isBoard(e)), bo = new Set(boards);
    let holes = ents.filter(e => e && !e.IsErase && D.isHole(e));
    if (!holes.length) { try { holes = D.all().filter(e => D.isHole(e) && (bo.has(idOf(e.FId)) || bo.has(idOf(e.MId)))); } catch (e) { holes = []; } }
    let nen = null; if (pv !== 'tat_ca') { try { nen = D.all().filter(D.isBoard); } catch (e) { nen = null; } }
    const dl = D.docThat(boards.concat(holes), nen ? { nen } : null);
    const co = D.drillTypes();
    dl.kieu_co = co.length ? co : null;
    dl.kho = opt.kho && opt.kho.dai > 0 ? opt.kho : { dai: Core.DEFAULT_SPEC.van.kho_dai, rong: Core.DEFAULT_SPEC.van.kho_rong };
    const p = Core.doLoiThat(dl);
    p.pham_vi = pv;
    return p;
  };

  /* ------------------------------------------------------------------ *
   * ĐỔ MÀU (bản 1.21 — anh Jason 04/10/2026 09:08: "chọn một tủ: phần thùng một màu riêng, cánh tủ và phào tủ một màu … liệt kê các màu của mình cho nhanh, cho phép tìm kiếm và thay thế").
   * "Màu của xưởng" = kho vật liệu của tài khoản Chenfeng (thư mục loại 2; mỗi vật liệu đặt tên theo mã màu). Chỉ ĐỌC kho; mã nguồn không ghi sẵn mã thư mục / mã vật liệu nào.
   * Đã đo trên Chenfeng thật 04/10/2026:
   *   - `CAD-dirQuery { dir_type: '2' }` → thư mục vật liệu; `CAD-materialList { dir_id, curr_page, page_count ≤ 100 }` → `{ count, materials: [{ material_id, name, logo }] }` (100 mã ≈ 0,3 giây);
   *     ảnh nhỏ 100 × 100 = máy chủ API + '/' + logo; `CAD-materialDetail { material_id }` → `materials.file` (base64 của zlib) — CHẬM, 2–4 giây mỗi mã, nên mỗi mã chỉ tải một lần;
   *   - file vật liệu là một Database thu nhỏ: `new Database(false, false, true).FileRead(new CADFiler(mảng)).MaterialTable.Symbols` có đúng một `PhysicalMaterialRecord`;
   *     lớp Database lấy từ `app.Database.constructor`, lớp CADFiler từ `new Database(…).FileWrite().constructor` — đúng cách chính Chenfeng làm khi kéo vật liệu vào bản vẽ (`MaterialIn` + `WblockCloneObejcts(…, DuplicateRecordCloning.Ignore = 1)`);
   *   - bản vẽ đã có vật liệu cùng tên (`MaterialTable.GetAt(tên)`) thì dùng lại; gán cho tấm: `tấm.Material = bản ghi.Id` (tấm khoá vật liệu thì bỏ qua);
   *   - vật liệu mang "thông tin ván" `GoodsInfo { name, color, material }` (kho của xưởng: MDF / mã màu / MDF) → ghi vào ô 板材名 / 颜色 / 材料 của tấm như Chenfeng làm (`ApplyGoodInfo`) để bảng cắt gom đúng loại ván;
   *   - gán trong `hm.StartCmd … EndCmd` = MỘT bước hoàn tác; đổi L / W / H của module sau đó màu vẫn giữ.
   * ------------------------------------------------------------------ */
  let khoVL = null;
  /** Mọi màu trong kho vật liệu của tài khoản (đọc một lần rồi nhớ; opt.lam_moi = đọc lại). @returns {{ ds: [{ id, ten, nhom (tên thư mục), hinh (ảnh nhỏ) }], nhom: [tên thư mục] }} */
  D.khoVatLieu = async (opt) => {
    if (khoVL && !(opt && opt.lam_moi)) return khoVL;
    const j = await post('CAD-dirQuery', { dir_type: '2' }), dirs = [], host = D.apiHost();
    (function di(a) { for (const d of a || []) { dirs.push({ id: String(d.dir_id), ten: String(d.dir_name || '').trim() }); di(d.childs); } })(j.dirs);
    const CO = 100, trang = (d, tr) => post('CAD-materialList', { dir_id: d.id, curr_page: tr, page: tr, page_count: CO });
    const doi = (d, a) => (a || []).map(m => { const logo = String(m.logo || '').replace(/^\/+/, ''); return { id: String(m.material_id), ten: String(m.name || '').trim(), nhom: d.ten, hinh: logo ? (/^https?:/i.test(logo) ? logo : host + '/' + logo) : '' }; });
    const doc = async d => {
      const r1 = await trang(d, 1), a1 = r1.materials || [], tong = Math.round(+r1.count) || 0, ra = doi(d, a1);
      if (a1.length < CO || (tong && tong <= CO)) return ra;
      // máy chủ Chenfeng có lúc trả lời chậm vài giây mỗi trang (đo 04/10/2026: 0,3 – 6,5 giây) → biết tổng số rồi thì các trang sau hỏi CÙNG LÚC
      if (tong) { const con = await Promise.all(Array.from({ length: Math.min(59, Math.ceil(tong / CO) - 1) }, (x, i) => trang(d, i + 2))); return ra.concat(...con.map(r => doi(d, r.materials))); }
      for (let tr = 2; tr <= 60; tr++) { const a = (await trang(d, tr)).materials || []; ra.push(...doi(d, a)); if (a.length < CO) break; }      // máy chủ không báo tổng số: hỏi lần lượt tới trang thiếu
      return ra;
    };
    const tung = await Promise.all(dirs.map(doc));
    khoVL = { ds: [].concat(...tung), nhom: dirs.filter((d, i) => tung[i].length).map(d => d.ten) };
    return khoVL;
  };
  const tenVL = rec => { try { return String(rec.Name !== undefined && rec.Name !== null ? rec.Name : rec.name || ''); } catch (e) { return ''; } };
  /** Bản ghi vật liệu TRONG BẢN VẼ của màu m = { id, ten }: đã có thì dùng lại, chưa có thì tải file của kho rồi chép vào bảng vật liệu của bản vẽ. */
  D.napVatLieu = async (m) => {
    const db = root.app.Database, ten = String((m && m.ten) || '');
    let rec = ten ? db.MaterialTable.GetAt(ten) : null;
    if (rec) return rec;
    const j = await post('CAD-materialDetail', { material_id: String(m && m.id) });
    const file = j.materials && j.materials.file;
    if (!file) throw new Error('kho không trả file của vật liệu này');
    const DB = db.constructor, F = new DB(false, false, true).FileWrite().constructor, db2 = new DB(false, false, true);
    db2.FileRead(new F(JSON.parse(await inflate(file))));
    const goc = db2.MaterialTable.Symbols.entries().next().value[1];
    if (ten) goc.Name = ten;
    rec = db.MaterialTable.GetAt(tenVL(goc));      // người dùng vừa kéo đúng màu này vào trong lúc chờ tải
    return rec || db.WblockCloneObejcts([goc], db.MaterialTable, new Map(), 1)[0];
  };
  const vlCua = b => { try { const id = b.Material; return (id && id.Object) || null; } catch (e) { return null; } };
  const tenMauCua = b => { let md = null; try { md = root.app.Database.DefaultMaterial; } catch (e) { md = null; } const r = vlCua(b); return !r || r === md ? '' : tenVL(r); };      // '' = chưa đổ màu (vật liệu mặc định của bản vẽ)
  const khoaVL = b => { try { if (b.LockMaterial) return true; const st = typeof b.GetMtlLockedStatus === 'function' ? b.GetMtlLockedStatus() : null; return !!(st && (st.partMtlLocked || st.allMtlLocked)); } catch (e) { return false; } };
  // Gán vật liệu + thông tin ván cho từng tấm trong MỘT bước lịch sử. cap = [[tấm, bản ghi vật liệu, nhóm]…] → { so: { nhóm: số tấm đã gán }, khoa, steps, mark }
  const ganVL = (cap, tenLenh) => {
    const h0 = hmMark(), so = {}; let mo = false, khoa = 0, n = 0;
    try { const h = hm(); if (h && typeof h.StartCmd === 'function' && typeof h.EndCmd === 'function') { h.StartCmd(tenLenh || 'MNCF_MAU'); mo = true; } } catch (e) { mo = false; }
    try {
      for (const [b, rec, nh] of cap) {
        if (!b || b.IsErase || !rec) continue;
        if (khoaVL(b)) { khoa++; continue; }
        b.Material = rec.Id || rec.objectId;
        const g = rec.GoodsInfo || {}, o = b.BoardProcessOption || {};      // vật liệu không mang thông tin ván (vd mua ở cửa hàng): giữ tên ván / vật liệu cũ của tấm, màu = tên vật liệu
        b.BoardProcessOption = Object.assign({}, o, { boardName: String(g.name || o.boardName || ''), material: String(g.material || o.material || ''), color: String(g.color || tenVL(rec)) });
        so[nh] = (so[nh] || 0) + 1; n++;
      }
    } finally { if (mo) { try { hm().EndCmd(); } catch (e) { /* bỏ qua */ } } }
    try { root.app.Viewer.UpdateRender(); } catch (e) { /* bỏ qua */ }
    const h1 = hmMark(), steps = h0 && h1 ? Math.max(0, h1.i - h0.i) : (n ? 1 : 0);
    if (steps) D.lastMau = { steps, mark: h1 };
    return { so, khoa, steps, mark: h1, n };
  };
  const laTam = b => !!(b && !b.IsErase && D.isBoard(b));
  /** Các tấm của (các) TỦ chứa những tấm đưa vào: cùng mã tủ của bảng, cùng module gốc, hoặc (tấm rời) cùng tên phòng + tên tủ. */
  D.tamCuaTu = (ents) => {
    const chon = (ents || []).filter(laTam);
    if (!chon.length) return [];
    const all = D.all().filter(D.isBoard), goc = new Map(all.map(b => [b, rootTpl(b)])), khoa = b => { const o = b.BoardProcessOption || {}; return o.cabinetName ? String(o.roomName || '') + '\u0001' + o.cabinetName : ''; };
    const the = new Set(), mod = new Set(), ten = new Set(), le = new Set();
    for (const b of chon) { const t = D.tagOf(b), g = goc.has(b) ? goc.get(b) : rootTpl(b); if (t) the.add(t); if (g) mod.add(g); if (!t && !g) { if (khoa(b)) ten.add(khoa(b)); else le.add(b); } }
    // tủ của bảng chưa gom module: hộp ngăn kéo (mẫu kho, không mang mã tủ) đi theo tên tủ của các tấm mang mã đó
    if (the.size) for (const b of all) if (the.has(D.tagOf(b)) && !goc.get(b) && khoa(b)) ten.add(khoa(b));
    return all.filter(b => { const t = D.tagOf(b), g = goc.get(b); return (t && the.has(t)) || (g && mod.has(g)) || le.has(b) || (!t && khoa(b) && ten.has(khoa(b))); });
  };
  /** Chia tấm thành nhóm màu (Core.nhomMau): { nhom: ['thung' | 'mat' | 'hau'…] cùng thứ tự, dem: { thung, mat, hau }, ten: { nhóm: { tên tấm: số tấm } } } */
  D.phanNhomMau = (boards) => {
    boards = (boards || []).filter(laTam);
    const dl = D.docThat(boards), vt = new Map(); (dl.ent || []).forEach((b, i) => vt.set(b, i));
    const nhom = Core.nhomMau(boards.map(b => { const i = vt.get(b), t = i === undefined ? null : dl.tam[i]; return t ? { ten: t.ten, hop: t.hop, he: t.he } : { ten: String(b.Name || '') }; }));
    const dem = { thung: 0, mat: 0, hau: 0 }, ten = { thung: {}, mat: {}, hau: {} };
    nhom.forEach((n, i) => { dem[n]++; const t = String(boards[i].Name || ''); ten[n][t] = (ten[n][t] || 0) + 1; });
    return { nhom, dem, ten };
  };
  const napNhieu = async (ds) => { const ra = []; for (const m of ds) { if (!m) { ra.push(null); continue; } try { ra.push(await D.napVatLieu(m)); } catch (e) { return { loi: `Không tải được màu “${m.ten}” từ kho vật liệu của Chenfeng (${String(e && e.message || e).slice(0, 140)}).` }; } } return { rec: ra }; };
  /**
   * Đổ màu theo NHÓM cho các tấm của tủ: mau = { thung, mat, hau } (mỗi cái là { id, ten } của D.khoVatLieu, hoặc bỏ trống = giữ nguyên nhóm đó; hậu bỏ trống = theo màu thùng).
   * Một bước hoàn tác. opt.gop_ve = đang tự đổ màu ngay sau một lần vẽ → cộng bước này vào lần vẽ (để "Hoàn tác lần vẽ này" lùi cả hai).
   * opt.hau_rieng = hậu KHÔNG tự theo màu thùng (dùng khi trả lại màu cũ cho tủ vừa cập nhật: hậu của tủ cũ chưa đổ thì để nguyên).
   * @returns {{ ok, so: { thung, mat, hau }, khoa (số tấm khoá vật liệu bị bỏ qua), steps, mau: { thung, mat, hau } (tên màu đã đổ, '' = giữ nguyên), ten (tên tấm từng nhóm) } | { ok: false, reason }}
   */
  D.doMauTu = async (boards, mau, opt) => {
    opt = opt || {}; mau = mau || {};
    boards = (boards || []).filter(laTam);
    if (!boards.length) return { ok: false, reason: 'Không có tấm nào để đổ màu — chọn 1 tấm của tủ trên bản vẽ rồi bấm lại.' };
    const can = { thung: mau.thung || null, mat: mau.mat || null, hau: mau.hau || (opt.hau_rieng ? null : mau.thung) || null };
    if (!can.thung && !can.mat && !can.hau) return { ok: false, reason: 'Chưa chọn màu nào.' };
    const N = ['thung', 'mat', 'hau'], nap = await napNhieu(N.map(k => can[k]));
    if (nap.loi) return { ok: false, reason: nap.loi };
    const rec = {}; N.forEach((k, i) => { rec[k] = nap.rec[i]; });
    const pn = D.phanNhomMau(boards), lastCu = D.last && D.last.mark ? hmMark() : null;
    const kq = ganVL(boards.map((b, i) => [b, rec[pn.nhom[i]], pn.nhom[i]]));
    if (opt.gop_ve && D.last && kq.steps && lastCu && D.last.mark && lastCu.i === D.last.mark.i && lastCu.rec === D.last.mark.rec) { D.last.steps = (D.last.steps || 1) + kq.steps; D.last.mark = kq.mark; }
    return { ok: true, so: { thung: kq.so.thung || 0, mat: kq.so.mat || 0, hau: kq.so.hau || 0 }, khoa: kq.khoa, steps: kq.steps, mau: { thung: can.thung ? can.thung.ten : '', mat: can.mat ? can.mat.ten : '', hau: can.hau ? can.hau.ten : '' }, ten: pn.ten };
  };
  /** Màu đang mang của một tủ, theo nhóm = màu có NHIỀU TẤM NHẤT của nhóm ('' = nhóm đó chưa đổ màu). lan = các nhóm đang có hơn một màu (có tấm đổ riêng). */
  D.mauCuaTu = (boards) => {
    boards = (boards || []).filter(laTam);
    const pn = D.phanNhomMau(boards), dem = { thung: new Map(), mat: new Map(), hau: new Map() }, mau = {}, lan = [];
    boards.forEach((b, i) => { const t = tenMauCua(b), m = dem[pn.nhom[i]]; m.set(t, (m.get(t) || 0) + 1); });
    for (const k of Object.keys(dem)) { const a = [...dem[k]].sort((x, y) => y[1] - x[1]); mau[k] = a.length ? a[0][0] : ''; if (a.length > 1) lan.push(k); }
    return { mau, lan, co: !!(mau.thung || mau.mat || mau.hau) };
  };
  // Màu của kho theo TÊN (để tải lại nếu bản vẽ không còn bản ghi vật liệu đó); bản vẽ còn bản ghi thì D.napVatLieu dùng lại ngay, không cần mã.
  const mauTheoTen = async ten => {
    if (!ten) return null;
    let m = khoVL && khoVL.ds.find(x => x.ten === ten);
    if (!m && !root.app.Database.MaterialTable.GetAt(ten)) { try { m = (await D.khoVatLieu()).ds.find(x => x.ten === ten); } catch (e) { m = null; } }
    return m || { id: '', ten };
  };
  /** Trả lại màu cũ (cu = D.mauCuaTu của tủ TRƯỚC khi bỏ) cho tủ vừa vẽ lại — D.update gọi; bước đổ màu được cộng vào lần vẽ. */
  const giuMau = async (cu) => {
    try {
      const tam = ((D.last && D.last.added) || []).filter(laTam), m = {};
      for (const k of ['thung', 'mat', 'hau']) m[k] = await mauTheoTen(cu.mau[k]);
      const kq = await D.doMauTu(tam, m, { gop_ve: true, hau_rieng: true });
      return kq.ok ? Object.assign(kq, { lan: cu.lan }) : { ok: false, reason: kq.reason, mau: cu.mau };
    } catch (e) { return { ok: false, reason: String(e && e.message || e), mau: cu.mau }; }
  };
  /** Đổ MỘT màu cho đúng các tấm đưa vào (không chia nhóm). @returns {{ ok, so, khoa, steps } | { ok: false, reason }} */
  D.doMau = async (boards, m) => {
    boards = (boards || []).filter(laTam);
    if (!boards.length) return { ok: false, reason: 'Không có tấm nào để đổ màu — chọn tấm trên bản vẽ rồi bấm lại.' };
    if (!m) return { ok: false, reason: 'Chưa chọn màu nào.' };
    const nap = await napNhieu([m]);
    if (nap.loi) return { ok: false, reason: nap.loi };
    const kq = ganVL(boards.map(b => [b, nap.rec[0], 'x']));
    return { ok: true, so: kq.so.x || 0, khoa: kq.khoa, steps: kq.steps };
  };
  /** Các màu đang dùng trên bản vẽ (hoặc trong các tấm đưa vào): [{ ten ('' = chưa đổ màu), so }] — nhiều tấm trước, "chưa đổ màu" xếp cuối. */
  D.mauDangDung = (boards) => {
    const dem = new Map();
    for (const b of (boards || D.all())) { if (!laTam(b)) continue; const t = tenMauCua(b); dem.set(t, (dem.get(t) || 0) + 1); }
    return [...dem].map(([ten, so]) => ({ ten, so })).sort((a, b) => (a.ten === '') - (b.ten === '') || b.so - a.so || (a.ten < b.ten ? -1 : 1));
  };
  /** Các tấm đang mang màu `ten` ('' = chưa đổ màu), trong cả bản vẽ hoặc trong các tấm đưa vào. */
  D.tamTheoMau = (ten, boards) => (boards || D.all()).filter(b => laTam(b) && tenMauCua(b) === String(ten || ''));
  /** Thay màu `tuTen` bằng màu m trên cả bản vẽ (hoặc chỉ trong các tấm đưa vào). Một bước hoàn tác. */
  D.thayMau = async (tuTen, m, boards) => {
    if (!m) return { ok: false, reason: 'Chưa chọn màu thay vào.' };
    const ds = D.tamTheoMau(tuTen, boards);
    if (!ds.length) return { ok: true, so: 0, khoa: 0, steps: 0 };
    const nap = await napNhieu([m]);
    if (nap.loi) return { ok: false, reason: nap.loi };
    const kq = ganVL(ds.map(b => [b, nap.rec[0], 'x']), 'MNCF_THAYMAU');
    return { ok: true, so: kq.so.x || 0, khoa: kq.khoa, steps: kq.steps };
  };
  /** Hoàn tác lần đổ / thay màu vừa rồi — chỉ khi bản vẽ chưa có thao tác nào khác sau đó. */
  D.undoMau = async () => {
    const L = D.lastMau;
    if (!L || !L.steps) return { ok: false, reason: 'Chưa có lần đổ màu nào để hoàn tác.' };
    if (D.busy()) await D.cancel();
    const moved = () => { const now = hmMark(); return !!(L.mark && now && (now.i !== L.mark.i || now.rec !== L.mark.rec)); };
    for (let i = 0; i < 6 && moved(); i++) await sleep(300);
    if (moved()) return { ok: false, reason: 'Sau lần đổ màu đó bản vẽ đã có thao tác khác — hãy dùng Ctrl+Z của Chenfeng để lùi từng bước.' };
    await D.undo(L.steps);
    D.lastMau = null;
    return { ok: true };
  };

  /* ------------------------------------------------------------------ *
   * XUẤT VÁN (bản 1.22 — anh Jason 04/10/2026 09:09: "thử xuất ván … làm sao để hợp lý nhất nhanh gọn"; 14:14: "làm cả 2").
   * Chạy lệnh TÁCH ĐƠN `CD` (拆单) của Chenfeng thay người dùng: tự chọn đúng tấm + phụ kiện của tủ rồi Enter. Đã đo trên Chenfeng thật 04/10/2026:
   *   - `CD` hỏi "选择板件或者五金"; đang hỏi thì `SelectCtrl.AddSelect` rồi `InputEvent('')` (Enter) là đi tiếp; Chenfeng kiểm 排钻碰撞 + 封边 (≈ 5 ms / tấm),
   *     có lỗi thì HỎI trước (bảng không trả lời hộ), rồi mở hộp "Order Splitting" (`.bp3-dialog` có một khung 350 × 100 trỏ sang trang sản xuất sc.leye.site);
   *   - tới đây CHƯA có gì rời máy: khung nhận dữ liệu tấm bằng postMessage rồi hỏi "是否打开拆单优化窗口?" — chỉ khi NGƯỜI DÙNG bấm 打开 thì tab trang sản xuất
   *     mới mở và dữ liệu mới lên máy chủ. Bảng dừng ở đây, không bấm hộ (cũng không bấm được: khung khác nguồn);
   *   - trang trong khung báo `{ command: 'loaded' }` ~0,25 giây TRƯỚC sự kiện load của khung (thường 1,4 – 3,7 giây sau khi hộp thoại hiện);
   *     khung không tải được thì ~31 giây sau chỉ có sự kiện load (trang lỗi của trình duyệt), không có tin nào → phải đóng, chạy lại `CD`;
   *   - người dùng bấm 打开 → trang sản xuất báo `{ command: 'closeWindow' }` → Chenfeng tự đóng hộp thoại.
   * ------------------------------------------------------------------ */
  const NGUON_SX = /^https:\/\/([a-z0-9-]+\.)*leye\.site$/;      // trang sản xuất của Chenfeng (khung "Order Splitting")
  const hopXuat = () => { try { return [...document.querySelectorAll('.bp3-dialog')].find(d => d.querySelector('iframe')) || null; } catch (e) { return null; } };
  /** Hộp "Order Splitting" đang mở (phần tử của Chenfeng) hoặc null — bảng dùng để biết mình có đang che nó không. */
  D.hopXuat = hopXuat;
  /** Tấm + phụ kiện sẽ xuất: đang chọn tấm nào thì lấy cả (các) tủ chứa tấm đó; không chọn gì = cả bản vẽ. Lỗ khoan không đưa vào (Chenfeng tự lấy theo tấm). */
  D.phamViXuat = () => {
    const chon = D.selected().filter(D.isBoard), all = D.all(), pkAll = all.filter(D.isHardware);
    const tam = chon.length ? D.tamCuaTu(chon) : all.filter(D.isBoard);
    const tenTu = b => String((b.BoardProcessOption || {}).cabinetName || '');
    let pk = pkAll;
    if (chon.length) {      // phụ kiện của tủ = phụ kiện có tâm nằm trong hộp bao của tủ đó (như khi quét chọn quanh tủ)
      const hop = new Map();
      for (const b of tam) { let x; try { x = D.boxOf(b); } catch (e) { continue; } const k = D.tagOf(b) || tenTu(b) || '\u0001', h = hop.get(k); if (!h) hop.set(k, x.slice()); else for (let i = 0; i < 6; i += 2) { h[i] = Math.min(h[i], x[i]); h[i + 1] = Math.max(h[i + 1], x[i + 1]); } }
      const cac = [...hop.values()];
      pk = pkAll.filter(e => { let x; try { x = D.boxOf(e); } catch (err) { return false; } const c = [(x[0] + x[1]) / 2, (x[2] + x[3]) / 2, (x[4] + x[5]) / 2]; return cac.some(h => c[0] >= h[0] - 1 && c[0] <= h[1] + 1 && c[1] >= h[2] - 1 && c[1] <= h[3] + 1 && c[2] >= h[4] - 1 && c[2] <= h[5] + 1); });
    }
    return { pham_vi: chon.length ? 'chon' : 'tat_ca', tam, pk, tu: [...new Set(tam.map(tenTu).filter(Boolean))], khong_ten: tam.filter(b => !tenTu(b)).length };
  };
  /** Đóng hộp "Order Splitting" đang mở (bấm nút × của chính hộp đó). Không có hộp nào → true. */
  D.dongKhungXuat = async () => {
    const h = hopXuat(); if (!h) return true;
    try { const nut = h.querySelector('.bp3-dialog-close-button') || [...h.querySelectorAll('.bp3-dialog-header button')].pop(); if (nut) nut.click(); } catch (e) { /* bỏ qua */ }
    for (let i = 0; i < 25 && h.isConnected; i++) await sleep(100);
    return !h.isConnected;
  };
  /**
   * Chạy `CD` cho phạm vi xuất (opt.pham_vi_san = kết quả D.phamViXuat đã lấy trước; bỏ trống thì tự lấy), dừng khi hộp "Order Splitting" hiện.
   * opt: onStatus; cho_hop (ms chờ hộp thoại, mặc định 90000); cho_khung (ms chờ khung lên tiếng, 45000); tre_loi (ms sau sự kiện load mà khung vẫn im thì coi là trang lỗi, 2500).
   * @returns {{ ok, giai_doan: 'chon' | 'dang_mo' | 'lenh' | 'hoi' | 'khung', pham_vi, so_tam, so_pk, tu: [tên tủ], reason?, hoi? (câu Chenfeng đang hỏi),
   *   san_sang?: Promise<{ ok, ly_do: '' | 'loi' (khung ra trang lỗi) | 'cham' (quá hạn) | 'dong' (hộp bị đóng), ms }>,
   *   da_mo?: Promise<'mo' (trang sản xuất báo closeWindow = người dùng đã bấm 打开) | 'dong' (hộp bị đóng mà chưa bấm 打开) | 'cho' (10 phút vẫn chưa bấm)> }}
   */
  D.xuatVan = async (opt) => {
    opt = opt || {};
    const st = guard(opt.onStatus), kq = { ok: false, giai_doan: 'chon' };
    const pv = opt.pham_vi_san || D.phamViXuat();
    const tam = (pv.tam || []).filter(laTam), pk = (pv.pk || []).filter(e => e && !e.IsErase && D.isHardware(e));
    kq.pham_vi = pv.pham_vi; kq.so_tam = tam.length; kq.so_pk = pk.length; kq.tu = pv.tu || [];
    if (!tam.length) { kq.reason = 'Bản vẽ chưa có tấm ván nào để xuất.'; return kq; }
    D.boManChe();
    if (hopXuat() && !(await D.dongKhungXuat())) { kq.giai_doan = 'dang_mo'; kq.reason = 'Khung xuất ván (Order Splitting) của lần trước còn mở và bảng không đóng được — bấm × trên khung đó rồi bấm lại.'; return kq; }
    if (D.busy()) await D.cancel();
    try { ed().SelectCtrl.Cancel(); } catch (e) { /* bỏ qua */ }
    await sleep(150);
    // nghe trang sản xuất từ TRƯỚC khi chạy lệnh (khỏi lỡ tin "loaded"); chỉ nhận tin từ nguồn *.leye.site
    const tin = { san: false, mo: false };
    const nghe = e => { try { if (!NGUON_SX.test(String(e.origin || ''))) return; const d = e.data, c = d && typeof d === 'object' ? String(d.command || d.cmd || '') : ''; if (c === 'loaded') tin.san = true; else if (c === 'closeWindow') tin.mo = true; } catch (er) { /* bỏ qua */ } };
    const thoiNghe = () => { try { root.removeEventListener('message', nghe); } catch (e) { /* bỏ qua */ } };
    root.addEventListener('message', nghe);
    const truoc = new Set(document.querySelectorAll('.bp3-dialog, .bp3-alert')), t0 = Date.now();
    kq.giai_doan = 'lenh';
    st(`Đang chạy lệnh tách đơn CD của Chenfeng cho ${tam.length} tấm…`);
    try {
      await guiLenh('CD');
      for (let i = 0; i < 30 && !D.busy(); i++) await sleep(100);
      if (!D.busy()) { kq.reason = 'Lệnh CD (tách đơn) của Chenfeng không hỏi chọn tấm — tài khoản này chưa có quyền tách đơn, hoặc Chenfeng đang bận việc khác. Thử gõ CD trực tiếp ở dòng lệnh của Chenfeng.'; thoiNghe(); return kq; }
      D.select(tam.concat(pk));
      await sleep(300);
      D.input('');
    } catch (e) { thoiNghe(); if (D.busy()) await D.cancel(); kq.reason = 'Không chạy được lệnh CD của Chenfeng (' + String(e && e.message || e).slice(0, 120) + ').'; return kq; }
    // chờ hộp "Order Splitting". Chenfeng có thể hỏi trước (tự đánh số tấm, lỗi khoan / dán cạnh, tấm vượt cỡ…): KHÔNG trả lời hộ, chỉ nêu câu hỏi và chờ người dùng.
    const han = opt.cho_hop > 0 ? opt.cho_hop : 90000; let hop = null, hoi = '';
    while (Date.now() - t0 < han) {
      const h = hopXuat(); if (h && !truoc.has(h)) { hop = h; break; }
      let chu = '';
      try { const q = [...document.querySelectorAll('.bp3-alert, .bp3-dialog')].find(d => !truoc.has(d) && d.isConnected && !d.querySelector('iframe')); chu = q ? String(q.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 220) : ''; } catch (e) { chu = ''; }
      if (chu && chu !== hoi) st(`Chenfeng đang hỏi: “${chu}” — anh trả lời trong hộp thoại đó, bảng chờ.`);
      if (chu) hoi = chu;
      await sleep(150);
    }
    if (!hop) {
      thoiNghe();
      if (D.busy()) await D.cancel();
      try { ed().SelectCtrl.Cancel(); } catch (e) { /* bỏ qua */ }
      if (hoi) { kq.giai_doan = 'hoi'; kq.hoi = hoi; kq.reason = `Chenfeng hỏi mà chưa có trả lời: “${hoi}”. Trả lời trong hộp thoại của Chenfeng (hoặc sửa bản vẽ) rồi bấm Xuất ván lại.`; }
      else kq.reason = `Chenfeng không mở khung xuất ván (Order Splitting) sau ${Math.round(han / 1000)} giây.`;
      return kq;
    }
    kq.ok = true; kq.giai_doan = 'khung'; kq.ms_hop = Date.now() - t0;
    const fr = hop.querySelector('iframe'), hanK = opt.cho_khung > 0 ? opt.cho_khung : 45000, tre = opt.tre_loi > 0 ? opt.tre_loi : 2500;
    let luTai = 0; const taiXong = () => { luTai = Date.now(); };
    try { fr.addEventListener('load', taiXong); } catch (e) { /* bỏ qua */ }
    const t1 = Date.now();
    kq.san_sang = (async () => {
      try {
        for (;;) {
          if (tin.san) return { ok: true, ly_do: '', ms: Date.now() - t1 };
          if (!hop.isConnected) return { ok: false, ly_do: tin.mo ? '' : 'dong', ms: Date.now() - t1 };
          if (luTai && Date.now() - luTai >= tre) return { ok: false, ly_do: 'loi', ms: Date.now() - t1 };      // khung tải xong mà trang sản xuất vẫn im = trang lỗi của trình duyệt
          if (Date.now() - t1 >= hanK) return { ok: false, ly_do: 'cham', ms: Date.now() - t1 };
          await sleep(100);
        }
      } finally { try { fr.removeEventListener('load', taiXong); } catch (e) { /* bỏ qua */ } }
    })();
    // người dùng bấm 打开 → trang sản xuất báo closeWindow → hộp thoại đóng ('mo'); người dùng tự đóng hộp mà chưa bấm 打开 ('dong'). Theo dõi tối đa 10 phút rồi thôi nghe ('cho').
    kq.da_mo = (async () => {
      const r = await kq.san_sang;
      try { if (!r.ok) return 'dong'; const t2 = Date.now(); while (hop.isConnected && !tin.mo && Date.now() - t2 < 600000) await sleep(200); return tin.mo ? 'mo' : hop.isConnected ? 'cho' : 'dong'; } finally { thoiNghe(); }
    })();
    return kq;
  };

  /**
   * (bản 1.27) Đổi góc nhìn của Chenfeng rồi thu phóng vừa bản vẽ. Đã đo 05/10/2026: SWISO (nhìn 3D từ tây nam, hướng nhìn 0,58 · 0,58 · −0,58) và TOPVIEW (nhìn từ trên) là lệnh
   * "trong suốt" — không ghi dòng lệnh, không vào lịch sử, không đổi bản vẽ. Chenfeng đang hỏi dở / đang mở hộp thoại / còn lệnh trễ đang chờ thì không gửi (chữ gửi vào sẽ thành câu trả lời cho lệnh đó).
   */
  // Lệnh đổi góc nhìn của Chenfeng "trong suốt" (đã đo): không ghi dòng lệnh, không phát sự kiện kết thúc → muốn biết Chenfeng có nhận không thì xem CHÍNH góc nhìn
  // (app.Viewer.CameraControl.Direction; SWISO = nhìn từ tây nam xuống (1, 1, −1), TOPVIEW = (0, 0, −1)). Chenfeng đang chạy dở lệnh khác thì chữ gửi vào bị lệnh đó nuốt, góc nhìn không đổi:
  // trả false, không gửi tiếp lệnh thu phóng.
  const HUONG_NHIN = { SWISO: [1, 1, -1], TOPVIEW: [0, 0, -1] };
  const dungHuong = lenh => { try { const d = root.app.Viewer.CameraControl.Direction, h = HUONG_NHIN[lenh]; return (d.x * h[0] + d.y * h[1] + d.z * h[2]) / (Math.hypot(h[0], h[1], h[2]) * Math.hypot(d.x, d.y, d.z)) > 0.99; } catch (e) { return false; } };
  const doiNhin = async lenh => {
    try {
      if (!D.available() || D.busy() || hopThoai() || (lenhTre && !lenhTre.xong)) return false;
      await guiLenh(lenh);
      for (let i = 0; i < 10 && !dungHuong(lenh); i++) await sleep(100);
      if (!dungHuong(lenh)) return false;
      await guiLenh('ZOOME'); return true;
    } catch (e) { return false; }
  };
  D.xem3D = () => doiNhin('SWISO');
  D.nhinTren = () => doiNhin('TOPVIEW');
  // lệnh của bảng bị bỏ dở còn đang chờ máy chủ (lenhTre) thì thôi không gửi ZOOME: Chenfeng đang chạy dở lệnh đó nên chữ gửi vào chỉ rơi mất — hoặc tệ hơn, thành câu trả lời cho lời nhắc vừa hiện ra của nó
  D.zoom = () => { try { if (lenhTre && !lenhTre.xong) return; D.cmd('ZOOME'); } catch (e) { /* bỏ qua */ } };
  D.undo = async (steps) => { for (let i = 0; i < (steps || 1); i++) { try { if (D.busy()) await D.cancel(); await guiLenh('UNDO'); } catch (e) { /* bỏ qua */ } await sleep(400); await D.settle(600, 20000); } };
  D.sleep = sleep;

  /* ------------------------------------------------------------------ *
   * GIỮ SẴN KẾT NỐI TỚI MÁY CHỦ CHENFENG (bản 1.29 — anh Thanh 07/10/2026: "nghiên cứu phương án kết nối máy chủ chenfeng nhanh hơn").
   * Đã đo (Đo mạng, 05/10/2026): để quá vài giây máy chủ đóng kết nối, lần gọi sau phải mở lại (bắt tay TCP + TLS = thêm 2 – 3 lượt đi về; đường đang rớt gói
   * thì mất gói lúc bắt tay là chờ thêm 1 – 3 giây). Lúc vẽ, phần tấm không cần máy chủ nên tới lượt tải mẫu thì kết nối đã nguội.
   * Cách làm: trong lúc bảng đang vẽ / cập nhật / vẽ phòng / dựng mẫu kho, hễ đường tới máy chủ im quá `D.CH.am_cach` ms thì hỏi một câu CHỈ ĐỌC (CAD-dirQuery) cho kết nối còn mở —
   * lời gọi của Chenfeng (cùng máy chủ, cùng kiểu có cookie) dùng lại được kết nối đó. Có lời gọi của Chenfeng thì không hỏi thêm (đã ấm sẵn). am_cach = 0: tắt.
   * Kèm theo: ghi lại các lần CHENFENG gọi máy chủ (tên, initiatorType, giao thức, thời gian) để Đo mạng tóm tắt — số đo cho việc "tự gửi lại khi rớt gói" (chưa làm).
   * ------------------------------------------------------------------ */
  // lời gọi của chính bảng: đếm theo tên lời gọi — mỗi mục "fetch" cùng tên thấy sau đó trừ một (so theo thời điểm bắt đầu thì lệch: lời gọi bị huỷ / bị chặn CORS có startTime khác)
  const goiCF = [], cuaBang = new Map();
  let lanCuoiMang = 0;
  function danhDauGoi(ten) { try { cuaBang.set(ten, (cuaBang.get(ten) || 0) + 1); lanCuoiMang = root.performance.now(); } catch (e) { /* bỏ qua */ } }
  try {
    if (typeof root.PerformanceObserver === 'function') {
      const po = new root.PerformanceObserver(ds => {
        for (const e of ds.getEntries()) {
          const m = /^https:\/\/[^/]+\/(CAD-[A-Za-z]+)/.exec(e.name || ''); if (!m) continue;
          lanCuoiMang = Math.max(lanCuoiMang, e.responseEnd || e.startTime || 0);
          if (e.initiatorType === 'fetch' && cuaBang.get(m[1]) > 0) { cuaBang.set(m[1], cuaBang.get(m[1]) - 1); continue; }      // lời gọi của chính bảng
          goiCF.push({ ten: m[1], kieu: e.initiatorType || '', gt: e.nextHopProtocol || '', ms: Math.round(e.duration) });
          if (goiCF.length > 300) goiCF.splice(0, goiCF.length - 300);
        }
      });
      po.observe({ type: 'resource', buffered: true });
    }
  } catch (e) { /* trình duyệt không có thì thôi: không tóm tắt được, vẫn giữ kết nối được */ }
  D.goiCF = () => goiCF.slice();

  /* ------------------------------------------------------------------ *
   * ĐO LỆNH NÓC / ĐÁY "BỌC HỒI" CỦA CHENFENG (bản 1.31 — anh Thanh 08/10/2026: "chuyển sang kết cấu nóc, đáy phủ hồi"; rồi "nhưng phải vẽ đúng theo của Chenfeng").
   * Hộp TOPBOTTOMBOARD có ô bọc hồi (isWrapSide), chân trước / chân sau (isDrawFooter / isDrawBackFooter, footThickness) — cấu hình của anh đang bật chúng — nhưng
   * CHƯA ĐO chúng làm gì (cắt ngắn hồi? nóc rộng ra? chân nằm đâu?) nên bảng chưa vẽ được phủ hồi bằng lệnh gốc. Nút này vẽ THỬ ở chỗ trống (cách mọi thứ 6 m) một thùng
   * 800 × 560 × 900 bằng LEFTRIGHTBOARD + TOPBOTTOMBOARD, mỗi lượt một bộ lựa chọn; ghi MỌI tấm Chenfeng dựng / đổi (tên, dày, hộp bao), lựa chọn hộp nóc đáy của người
   * dùng và dòng báo của lệnh; rồi HOÀN TÁC hết lượt đó. Kết quả là tệp chữ để gửi Claude. Không lưu bản vẽ, không bấm "Lưu cấu hình", trả lại lựa chọn như mọi lệnh gốc.
   * ------------------------------------------------------------------ */
  D.doBocHoi = async (opt) => {
    opt = Object.assign({ onStatus() {} }, opt || {});
    opt.onStatus = guard(opt.onStatus);
    if (!D.gocDuoc()) return { ok: false, loi: 'Trang này không chạy được lệnh gốc của Chenfeng.' };
    if (D.busy()) return { ok: false, loi: 'Chenfeng đang chạy dở một lệnh — xong lệnh đó rồi bấm lại.' };
    const t = Core.DEFAULT_SPEC.van.t, W = 800, S = 560, H = 900;
    let mx = -Infinity;
    for (const e of D.all()) { try { const b = e.BoundingBox; if (b && isFinite(b.max.x) && Math.abs(b.max.x) < 1e7) mx = Math.max(mx, b.max.x); } catch (er) { /* bỏ qua */ } }
    const X = isFinite(mx) ? Math.ceil((mx + 6000) / 500) * 500 : 0, E = () => root.app.Database.ModelSpace.Entitys;
    const L = [`Một Nhà · đo lệnh nóc / đáy bọc hồi của Chenfeng — bảng ${Core.VERSION} — ${new Date().toISOString()}`,
      `Thùng thử: góc trái – trước – dưới (${X}, 0, 0); rộng ${W} × sâu ${S} × cao ${H}; ván ${t}. Toạ độ bên dưới tính từ góc đó (x sang phải, y vào trong, z lên).`, ''];
    const ghiTam = ds => ds.filter(D.isBoard).map(e => {
      let ten = '', day = '', b = null; try { ten = e.Name; } catch (er) { /* bỏ qua */ } try { day = r2(e.Thickness); } catch (er) { /* bỏ qua */ } try { b = D.boxOf(e); } catch (er) { b = null; }
      return b ? `  ${ten} | dày ${day} | x ${r2(b[0] - X)} … ${r2(b[1] - X)} | y ${b[2]} … ${b[3]} | z ${b[4]} … ${b[5]}` : `  ${ten} | dày ${day} | (không đọc được hộp)`;
    });
    const nhinVung = async (ds, diem) => {
      try { const V = root.app.Viewer; hienHinh(ds); V.ViewToFront(); if (ds.length && typeof V.ZoomtoEntitys === 'function') V.ZoomtoEntitys(ds); V.UpdateRender(); veNgay(); } catch (e) { /* bỏ qua */ }
      await sleep(80); try { if (diem) reChuot(diem); } catch (e) { /* bỏ qua */ } await sleep(90);
    };
    const LUOT = [
      { ma: 'A', ten: 'nóc + đáy BỌC HỒI, không chân', top: { isWrapSide: true }, bot: { isWrapSide: true } },
      { ma: 'B', ten: 'bọc hồi + CHÂN TRƯỚC + CHÂN SAU, đáy nâng 100', top: { isWrapSide: true }, bot: { isWrapSide: true, offset: 100, isDrawFooter: true, isDrawBackFooter: true, footThickness: t } },
      { ma: 'C', ten: `KHÔNG bọc hồi, nóc / đáy trùm ra 2 bên ${t} (leftExt / rightExt), offset −${t}`, top: { leftExt: t, rightExt: t, offset: -t }, bot: { leftExt: t, rightExt: t, offset: -t } },
    ];
    let soLuot = 0, cauHinh = null;
    for (const lu of LUOT) {
      opt.onStatus(`Đo bọc hồi — lượt ${lu.ma}/${LUOT.length}: vẽ thử thùng ở chỗ trống, ghi lại, hoàn tác…`);
      L.push(`=== Lượt ${lu.ma} — ${lu.ten}`);
      const h0 = hmMark(), truoc = new Set(E()), m0 = logMark();
      const moi = () => E().filter(e => e && !e.IsErase && !truoc.has(e));
      let hoi = [];
      try {
        const goc = [X, 0, 0];
        let tra = await chayGoc('LEFTRIGHTBOARD', st => LUA_CHON.LR(st, { cao: H, sau: S, day: t, rong: W, ten: ['Hồi trái (đo)', 'Hồi phải (đo)'], phong: '', tu: 'MNCF-DO', khoan: null }), goc, 'goc', null, { truoc_diem: () => nhinVung([], goc) });
        await cho(() => moi().filter(D.isBoard).length >= 2, 12000); await D.settle(350, 15000); tra();
        hoi = moi().filter(D.isBoard);
        L.push('Sau LEFTRIGHTBOARD (2 hồi):', ...ghiTam(hoi));
        const hoiTruoc = hoi.map(e => { try { return D.boxOf(e).join(','); } catch (er) { return ''; } });
        const diem = [X + W / 2, S / 2, H / 2], coTruoc = new Set(E());
        await nhinVung(hoi, diem);
        tra = await chayGoc('TOPBOTTOMBOARD', st => {
          if (!cauHinh) { try { cauHinh = JSON.stringify({ nóc: st.topBoardOption, đáy: st.bottomBoardOption }); } catch (e) { cauHinh = '(không đọc được)'; } }
          if (st.m_BoardProcessOption) st.m_BoardProcessOption.useBoardProcessOption = true;
          if (st.autoCutOption) { st.autoCutOption.isAutoCut = false; st.autoCutOption.isRelevance = false; }
          const nen = { isDraw: true, isWrapSide: false, frontDist: 0, behindDistance: 0, leftExt: 0, rightExt: 0, thickness: t, offset: 0 };
          ganLC(st.topBoardOption, st.topUiOption, Object.assign({}, nen, { name: 'Nóc (đo)' }, lu.top));
          ganLC(st.bottomBoardOption, st.bottomUiOption, Object.assign({}, nen, { name: 'Đáy (đo)', footThickness: t, isDrawFooter: false, isDrawBackFooter: false, isDrawStrengthenStrip: false }, lu.bot));
        }, diem, 'khoang', null, { hien: () => hienHinh(moi()), nhin: () => nhinVung(moi().filter(D.isBoard), null) });
        await cho(() => E().some(e => e && !e.IsErase && !coTruoc.has(e) && D.isBoard(e)), 12000); await D.settle(500, 15000); tra();
        const sau = moi().filter(D.isBoard);
        L.push('Sau TOPBOTTOMBOARD — mọi tấm của thùng thử:', ...ghiTam(sau));
        const doi = hoi.filter((e, k) => { try { return e.IsErase || D.boxOf(e).join(',') !== hoiTruoc[k]; } catch (er) { return true; } });
        L.push(doi.length ? `Hồi BỊ ĐỔI bởi lệnh nóc / đáy: ${doi.length} tấm (xem hộp ở trên).` : 'Hồi KHÔNG đổi (cùng đối tượng, cùng hộp).');
        const moiTB = sau.filter(e => !hoi.includes(e)).length; L.push(`Lệnh nóc / đáy sinh ${moiTB} tấm mới.`);
        soLuot++;
      } catch (e) { L.push('LỖI: ' + String(e && e.message || e)); }
      const dong = logsSince(m0).filter(x => x.type !== 'COMMAND' && x.type !== 'INFO' && x.msg).map(x => `  [${x.type}] ${x.msg}`);
      if (dong.length) L.push('Dòng báo của Chenfeng:', ...dong.slice(0, 20));
      if (D.busy()) await D.cancel();
      const h1 = hmMark(); if (h0 && h1 && h1.i > h0.i) { try { await D.undo(h1.i - h0.i); } catch (e) { /* ghi bên dưới */ } }
      await D.settle(300, 8000);
      const con = moi().length;
      L.push(con ? `CHÚ Ý: còn ${con} đối tượng của lượt này chưa hoàn tác được — xoá tay thùng thử ở x ≈ ${X}.` : 'Đã hoàn tác lượt này (bản vẽ như trước).', '');
      if (con) break;
    }
    L.push('Lựa chọn hộp nóc / đáy của người dùng lúc đo (đã trả lại nguyên):', cauHinh || '(chưa mở được hộp)');
    return { ok: soLuot > 0, so_luot: soLuot, noi_dung: L.join('\n') };
  };

  /* ------------------------------------------------------------------ *
   * THĂM DÒ LÕI CHENFENG (bản 1.29.1 — anh Thanh 07/10/2026: "lâu dài bảng gọi thẳng vào phần lõi của Chenfeng thay vì giả bấm hộp và rê chuột"; "lõi thì ít sửa đổi lắm").
   * Chỉ ĐỌC: gom MÃ NGUỒN (Function.prototype.toString) của các lớp lệnh vẽ tấm / mẫu / dò khoảng trống / hộp thông số của Chenfeng thành một tệp chữ để người dùng gửi cho Claude
   * (máy làm việc của Claude không vào được cfcad.cn). Không đọc dữ liệu bản vẽ, không đọc phiên đăng nhập / localStorage, không gọi hàm nào của Chenfeng ngoài toString.
   * Tìm lớp: (1) qua bộ nạp module của trang (webpack: đẩy một gói rỗng vào mảng webpackChunk… để lấy hàm require — gói đó không có module nào), duyệt exports;
   * (2) qua đối tượng đang có: app, app.Editor và các trường của nó, mẫu (Template) của tấm trên bản vẽ. Lớp cha của lớp tìm được thì lấy luôn (cả chuỗi kế thừa).
   * Trả { noi_dung, so_lop, nguon: { webpack, ...}, ten: [...] }.
   * ------------------------------------------------------------------ */
  D.thamDoLoi = (opt) => {
    opt = opt || {};
    const LA = opt.mau || /(LeftRight|Vertial|Vertical|TopBottom|Behind|Layer|Door|Drawer|Space|Template|BoardOption|BoardProcess|DrawBoard|CommandMachine|CommandStore|CommandReactor|PointSelect|Modal|Board$|Wall|Pillar|Girder|Hole|Room|Module|Hinge|Handle)/;
    const lop = new Map(), seen = new Set(), dangKy = [];
    const them = (f, ep) => {
      if (typeof f !== 'function' || seen.has(f)) return;
      const n = String(f.name || '');
      if (!ep && !(n && LA.test(n))) return;
      seen.add(f);
      lop.set(lop.has(n) ? `${n}#${lop.size}` : (n || `(không tên)#${lop.size}`), f);
      let p = null; try { p = Object.getPrototypeOf(f); } catch (e) { p = null; }
      if (p && p !== Function.prototype) them(p, true);      // lớp cha: lấy cả chuỗi
    };
    const quaDT = (o, sau) => {      // các giá trị của một đối tượng: hàm → xét; đối tượng → lớp của nó
      if (!o || (typeof o !== 'object' && typeof o !== 'function')) return;
      let ks = []; try { ks = Object.getOwnPropertyNames(o); } catch (e) { ks = []; }
      for (const k of ks.slice(0, 400)) {
        let v; try { const d = Object.getOwnPropertyDescriptor(o, k); v = d && 'value' in d ? d.value : undefined; } catch (e) { continue; }
        if (typeof v === 'function') them(v);
        else if (v && typeof v === 'object') {
          try { if (v.constructor && v.constructor !== Object) them(v.constructor); } catch (e) { /* bỏ qua */ }
          if (sau > 0) quaDT(v, sau - 1);
          // sổ đăng ký lệnh: Map / đối tượng có khoá LEFTRIGHTBOARD → ghi tên lệnh → tên lớp, lấy lớp của mọi lệnh
          try {
            const laMap = v instanceof Map, coKhoa = laMap ? v.has('LEFTRIGHTBOARD') : Object.prototype.hasOwnProperty.call(v, 'LEFTRIGHTBOARD');
            if (coKhoa && !dangKy.some(x => x.o === v)) {
              const ds = laMap ? [...v.entries()] : Object.keys(v).map(x => [x, v[x]]);
              dangKy.push({ o: v, ds: ds.slice(0, 3000).map(([kk, vv]) => { let tl = ''; try { const c = typeof vv === 'function' ? vv : vv && vv.constructor; tl = c && c.name || ''; if (c && c !== Object) them(c, true); } catch (e) { /* bỏ qua */ } return `${kk} → ${tl}`; }) });
            }
          } catch (e) { /* bỏ qua */ }
        }
      }
    };
    const nguon = { webpack: '', so_module: 0 };
    // (1) webpack
    try {
      let req = null;
      for (const k of Object.keys(root)) {
        if (req) break;
        if (!/^webpackChunk|^webpackJsonp/.test(k) || !Array.isArray(root[k])) continue;
        try {
          if (/^webpackChunk/.test(k)) root[k].push([[`mncf-tham-do-${Date.now()}`], {}, r => { req = r; }]);
          else { const mid = `mncf-tham-do-${Date.now()}`; root[k].push([[mid], { [mid]: (m, e, r) => { req = r; } }, [[mid]]]); }
          if (req) nguon.webpack = k;
        } catch (e) { /* thử mảng khác */ }
      }
      const cache = req && (req.c || req.cache);
      if (cache) for (const id of Object.keys(cache)) {
        nguon.so_module++;
        const ex = cache[id] && cache[id].exports; if (!ex) continue;
        if (typeof ex === 'function') them(ex);
        if (typeof ex === 'object' || typeof ex === 'function') { let ks = []; try { ks = Object.keys(ex); } catch (e) { ks = []; } for (const k of ks.slice(0, 500)) { let v; try { v = ex[k]; } catch (e) { continue; } if (typeof v === 'function') them(v); else if (v && typeof v === 'object') quaDT(v, 0); } }
      }
    } catch (e) { nguon.loi_webpack = String(e && e.message || e); }
    // (2) đối tượng đang có
    try { const app = root.app; if (app) { quaDT(app, 1); try { quaDT(app.Editor, 1); } catch (e) { /* bỏ qua */ } } } catch (e) { /* bỏ qua */ }
    try { for (const e of D.all().slice(0, 400)) { try { const T = e.Template && e.Template.Object; if (T && T.constructor) them(T.constructor, true); if (e.constructor) them(e.constructor, true); } catch (er) { /* bỏ qua */ } } } catch (e) { /* bỏ qua */ }
    // tệp chữ
    const toiDa = opt.toi_da || 8e6, motLop = 300000, ra = [];
    let tong = 0;
    const sc = []; try { for (const s of root.document.scripts) if (s.src) sc.push(s.src.replace(/[?#].*$/, '')); } catch (e) { /* bỏ qua */ }
    ra.push(`// Một Nhà — thăm dò lõi Chenfeng (chỉ mã nguồn các lớp, không có dữ liệu bản vẽ / tài khoản)\n// ${new Date().toISOString()} · bảng ${Core.VERSION}\n// script: ${sc.join(' ')}\n// webpack: ${nguon.webpack || 'không thấy'} · ${nguon.so_module} module · ${lop.size} lớp`);
    for (const r of dangKy) ra.push(`\n// ==== SỔ ĐĂNG KÝ LỆNH (${r.ds.length}) ====\n${r.ds.join('\n')}`);
    ra.push(`\n// ==== DANH SÁCH LỚP ====\n${[...lop.keys()].join('\n')}`);
    for (const [n, f] of lop) {
      let t = ''; try { t = Function.prototype.toString.call(f); } catch (e) { t = '(không đọc được)'; }
      if (t.length > motLop) t = t.slice(0, motLop) + '\n/* … cắt bớt */';
      if (tong + t.length > toiDa) { ra.push(`\n// (đã đủ ${toiDa} ký tự — bỏ các lớp còn lại)`); break; }
      tong += t.length; ra.push(`\n// ==== ${n} ====\n${t}`);
    }
    return { noi_dung: ra.join('\n'), so_lop: lop.size, nguon, ten: [...lop.keys()], so_lenh: dangKy.reduce((a, r) => a + r.ds.length, 0) };
  };
  D.CH.am_cach = 2000;
  let giu = 0, dangGiu = false;
  /** Giữ kết nối trong lúc làm một việc cần máy chủ. Trả hàm thả (gọi đúng một lần). Lồng nhau được. */
  D.giuKetNoi = () => {
    giu++; let tha = false;
    if (!dangGiu) {
      dangGiu = true;
      (async () => {
        try {
          while (giu > 0) {
            await sleep(250);
            const cach = D.CH.am_cach; if (!(cach > 0) || giu <= 0) continue;
            let bay; try { bay = root.performance.now(); } catch (e) { break; }
            if (bay - lanCuoiMang < cach) continue;
            danhDauGoi('CAD-dirQuery');
            const ac = typeof AbortController === 'function' ? new AbortController() : null;
            try {
              await Promise.race([root.fetch(D.apiHost() + '/CAD-dirQuery', { method: 'POST', mode: 'cors', credentials: 'include', body: JSON.stringify({ dir_type: '5' }), signal: ac ? ac.signal : undefined }).then(r => r.text()), sleep(8000)]);
            } catch (e) { /* rớt thì lượt sau hỏi lại */ }
            if (ac) { try { ac.abort(); } catch (e) { /* bỏ qua */ } }
            try { lanCuoiMang = root.performance.now(); } catch (e) { /* bỏ qua */ }
          }
        } finally { dangGiu = false; }
      })();
    }
    return () => { if (!tha) { tha = true; giu--; } };
  };
  for (const k of ['draw', 'update', 'drawRoom', 'veKho']) {
    const f = D[k]; if (typeof f !== 'function') continue;
    D[k] = async function () { const tha = D.giuKetNoi(); try { return await f.apply(this, arguments); } finally { tha(); } };
  }

  root.MNCFDriver = D;
})(typeof self !== 'undefined' ? self : this);
