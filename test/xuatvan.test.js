'use strict';
// Bản 1.22 — XUẤT VÁN: nút "Xuất ván" của bảng dò lỗi → tự chọn tấm của tủ → chạy lệnh tách đơn CD của Chenfeng → chờ khung "Order Splitting".
//   NODE_PATH=<node_modules có playwright> PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node test/xuatvan.test.js
// Chạy tiện ích thật (dist/extension) trên trang giả lập Chenfeng; khung trang sản xuất (sc.leye.site/#/cadIndex) là trang giả do phép thử trả về:
//   'tot'  — trang nhỏ báo { command: 'loaded' } rồi mới tải xong (đúng thứ tự đo trên Chenfeng thật 04/10/2026), có nút 打开 → báo 'closeWindow';
//   'loi'  — yêu cầu hỏng → trình duyệt hiện trang lỗi trong khung (chỉ có sự kiện load);
//   'treo' — không trả lời.
const path = require('path'), fs = require('fs'), os = require('os');
const { chromium } = require('playwright');
const EXT = path.join(__dirname, '..', 'dist', 'extension');
const MOCK = fs.readFileSync(path.join(__dirname, 'mock-chenfeng.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) pass++; else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); } };
const eq = (a, b, name) => ok(JSON.stringify(a) === JSON.stringify(b), name, { co: a, can: b });
// tủ 1000 × 1200, 2 khoang hở, khoang trái có suốt treo (phụ kiện); vẽ theo cách nhập tấm, không gom module
const TU = { rong: 1000, cao: 1200, than: { cao_duoi: 0 }, ve_goc: false, module_cf: false, khoang: [{ rong: 'auto', canh: 0, dot: [900], o: [{ tu: 0, kieu: 'suot' }] }, { rong: 'auto', canh: 0, dot: [700] }] };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const KHUNG_HTML = `<!doctype html><meta charset="utf-8"><title>晨丰生产管理系统</title><body style="margin:0;font:12px sans-serif"><p>是否打开拆单优化窗口?</p><button id="mo">打开</button><button id="huy">取消</button>
<script>parent.postMessage({ command: 'loaded' }, '*'); document.getElementById('mo').onclick = function () { parent.postMessage({ command: 'closeWindow' }, '*'); };</script><img src="/cham.png" width="1" height="1"></body>`;

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mncf-xv-'));
  const ctx = await chromium.launchPersistentContext(dir, { channel: 'chromium', headless: true, viewport: { width: 1500, height: 900 }, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  let khung = 'tot'; const goiKhung = [];
  try {
    await ctx.route('https://api.cfcad.cn/**', r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': 'https://cfcad.cn', 'access-control-allow-credentials': 'true' }, body: JSON.stringify({ err_code: 1, err_msg: 'no' }) }));
    await require('./kho-gia.js')(ctx);      // bộ nạp của tiện ích lấy bản gộp vừa dựng trong máy
    await ctx.route('https://cfcad.cn/**', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: MOCK }));
    await ctx.addInitScript(() => { window.__MOCK_CAM__ = true; });      // cam "thật" của trang giả lập: để dựng được tủ có lỗ khoan giao nhau
    await ctx.route('https://sc.leye.site/**', async r => {
      const u = new URL(r.request().url());
      if (u.pathname === '/cham.png') { await new Promise(k => setTimeout(k, 150)); return r.fulfill({ contentType: 'image/png', body: PNG }).catch(() => {}); }
      goiKhung.push(khung);
      if (khung === 'treo') return;                                           // để treo: phép thử kết thúc thì trình duyệt tự bỏ
      if (khung === 'loi') { await new Promise(k => setTimeout(k, 200)); return r.abort('failed').catch(() => {}); }
      return r.fulfill({ contentType: 'text/html; charset=utf-8', body: KHUNG_HTML }).catch(() => {});
    });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    await page.goto('https://cfcad.cn/');
    await page.waitForFunction(() => window.MNCF && window.MNCF.app && window.MNCFDriver, null, { timeout: 15000 });
    const H = page.locator('#mncf-host');
    const ve = (spec, x) => page.evaluate(async ([s, x0]) => { const r = await window.MNCF.draw(s, { at: [x0, 0, 0] }); return { ok: r.ok, errors: r.errors }; }, [spec, x]);
    const soHop = () => page.evaluate(() => document.querySelectorAll('.bp3-dialog.board-config').length);
    const chonTu = ten => page.evaluate(t => { const D = window.MNCFDriver; window.__MOCK__.userSelect(t ? [D.all().find(e => D.isBoard(e) && e.BoardProcessOption.cabinetName === t)] : []); }, ten);
    const dem = () => page.evaluate(() => { const D = window.MNCFDriver, a = D.all(), n = t => ({ tam: a.filter(e => D.isBoard(e) && e.BoardProcessOption.cabinetName === t).length, pk: a.filter(e => D.isHardware(e) && e.HardwareOption.cabinetName === t).length }); return { tam: a.filter(D.isBoard).length, pk: a.filter(D.isHardware).length, lo: a.filter(D.isHole).length, XA: n('XA'), XB: n('XB') }; });
    const xuat = (opt) => page.evaluate(async (o) => {
      const D = window.MNCFDriver, tt = [];
      const k = await D.xuatVan(Object.assign({ onStatus: t => tt.push(t) }, o || {}));
      const s = k.san_sang ? await k.san_sang : null;
      return { ok: k.ok, gd: k.giai_doan, pv: k.pham_vi, tam: k.so_tam, pk: k.so_pk, tu: k.tu, hoi: k.hoi || '', reason: k.reason || '', ss: s && { ok: s.ok, ly_do: s.ly_do || '' }, cd: (window.__MOCK_CD__ || []).slice(-1)[0] || null, lan: (window.__MOCK_CD__ || []).length, tt };
    }, opt);

    console.log('— Bản vẽ chưa có tấm: không chạy lệnh');
    ok(await page.evaluate(() => typeof window.MNCFDriver.xuatVan === 'function' && typeof window.MNCFDriver.phamViXuat === 'function' && typeof window.MNCFDriver.dongKhungXuat === 'function'), 'bộ điều khiển có xuatVan / phamViXuat / dongKhungXuat');
    let r = await xuat();
    ok(r.ok === false && r.gd === 'chon' && /chưa có tấm/.test(r.reason) && r.lan === 0, 'bản vẽ trống: báo chưa có tấm, không gọi lệnh CD', r);

    r = await ve(Object.assign({ ma: 'XA' }, TU), 0); ok(r.ok, 'vẽ tủ XA', r.errors);
    r = await ve(Object.assign({ ma: 'XB' }, TU), 3000); ok(r.ok, 'vẽ tủ XB', r.errors);
    const D0 = await dem();
    ok(D0.XA.tam > 5 && D0.XA.tam === D0.XB.tam && D0.XA.pk >= 1 && D0.XA.pk === D0.XB.pk && D0.tam === D0.XA.tam + D0.XB.tam && D0.lo > 0, 'hai tủ giống nhau, mỗi tủ có suốt treo (phụ kiện) và lỗ khoan', D0);

    console.log('— Phạm vi xuất: không chọn gì = cả bản vẽ; chọn 1 tấm = cả tủ đó + phụ kiện của tủ đó');
    const pv = () => page.evaluate(() => { const p = window.MNCFDriver.phamViXuat(), D = window.MNCFDriver; return { pv: p.pham_vi, tam: p.tam.length, pk: p.pk.length, tu: p.tu.slice().sort(), toan_tam: p.tam.every(D.isBoard), toan_pk: p.pk.every(D.isHardware), pk_tu: [...new Set(p.pk.map(e => e.HardwareOption.cabinetName))].sort() }; });
    r = await pv();
    ok(r.pv === 'tat_ca' && r.tam === D0.tam && r.pk === D0.pk && r.toan_tam && r.toan_pk, 'không chọn gì: mọi tấm + mọi phụ kiện, không lấy lỗ khoan', r);
    eq(r.tu, ['XA', 'XB'], 'kể đủ tên 2 tủ');
    await chonTu('XA');
    r = await pv();
    ok(r.pv === 'chon' && r.tam === D0.XA.tam && r.pk === D0.XA.pk, 'chọn 1 tấm của XA: đủ tấm của XA + phụ kiện nằm trong XA', r);
    eq([r.tu, r.pk_tu], [['XA'], ['XA']], 'không dính tấm / phụ kiện của XB');

    console.log('— Chạy CD: đúng tập đã định, hộp Order Splitting hiện, khung báo sẵn sàng');
    khung = 'tot';
    r = await xuat();
    ok(r.ok && r.gd === 'khung' && r.pv === 'chon' && r.tam === D0.XA.tam && r.pk === D0.XA.pk, 'kết quả: đã mở khung, phạm vi = tủ đang chọn', r);
    eq(r.tu, ['XA'], 'kết quả ghi tên tủ');
    ok(r.lan === 1 && r.cd.tam === D0.XA.tam && r.cd.pk === D0.XA.pk && r.cd.lo === 0 && r.cd.so === D0.XA.tam + D0.XA.pk, 'lệnh CD nhận đúng tấm + phụ kiện của XA (không lỗ khoan, không tấm của XB)', r.cd);
    eq(r.cd.tu, ['XA'], 'CD chỉ nhận tấm của XA');
    ok(r.ss && r.ss.ok === true && (await soHop()) === 1, 'trang sản xuất báo "loaded" → sẵn sàng bấm 打开', r.ss);
    ok(r.tt.some(t => /CD/.test(t)), 'có báo tiến độ', r.tt);
    ok(await page.evaluate(() => !window.MNCFDriver.busy() && window.MNCFDriver.selected().length === 0), 'xong: không còn lệnh dở, không còn tập chọn');

    console.log('— Đóng khung');
    r = await page.evaluate(async () => ({ kq: await window.MNCFDriver.dongKhungXuat(), dong: window.__MOCK_CD_DONG__ || 0, con: document.querySelectorAll('.bp3-dialog.board-config').length }));
    eq(r, { kq: true, dong: 1, con: 0 }, 'dongKhungXuat bấm nút × của hộp thoại');
    ok(await page.evaluate(async () => (await window.MNCFDriver.dongKhungXuat()) === true), 'không có khung nào: vẫn trả true');

    console.log('— Khung lần trước còn mở mà xuất lần nữa: đóng khung cũ rồi mới chạy (không chồng 2 khung)');
    await chonTu('');
    r = await xuat();
    ok(r.ok && r.pv === 'tat_ca' && r.lan === 2 && r.cd.tam === D0.tam && r.cd.pk === D0.pk && r.ss.ok, 'lần 2: cả bản vẽ', r);
    r = await xuat();
    ok(r.ok && r.lan === 3 && (await soHop()) === 1 && (await page.evaluate(() => window.__MOCK_CD_DONG__)) === 2, 'lần 3 khi khung lần 2 còn mở: khung cũ được đóng, chỉ còn 1 khung', [r.lan, await soHop()]);
    await page.evaluate(() => window.MNCFDriver.dongKhungXuat());

    console.log('— Khung không tải được (trang lỗi của trình duyệt): báo "loi"');
    khung = 'loi';
    r = await xuat({ tre_loi: 500 });
    ok(r.ok && r.gd === 'khung' && r.ss && r.ss.ok === false && r.ss.ly_do === 'loi', 'khung tải ra trang lỗi (có load, không có tin "loaded")', r.ss);
    await page.evaluate(() => window.MNCFDriver.dongKhungXuat());

    console.log('— Khung treo: quá hạn thì báo "cham"; tin "loaded" từ nguồn lạ không được tính');
    khung = 'treo';
    const pTreo = xuat({ cho_khung: 1500 });
    await page.waitForFunction(() => document.querySelector('.bp3-dialog.board-config iframe'), null, { timeout: 5000 });
    await page.evaluate(() => window.postMessage({ command: 'loaded' }, '*'));      // tin giả từ chính trang cfcad.cn
    r = await pTreo;
    ok(r.ok && r.ss && r.ss.ok === false && r.ss.ly_do === 'cham', 'khung không lên tiếng: hết hạn thì báo chậm, tin từ nguồn khác bị bỏ qua', r.ss);
    await page.evaluate(() => window.MNCFDriver.dongKhungXuat());

    console.log('— Người dùng tự đóng khung giữa chừng: báo "dong"');
    const pDong = xuat({ cho_khung: 5000 });
    await page.waitForFunction(() => document.querySelector('.bp3-dialog.board-config iframe'), null, { timeout: 5000 });
    await page.waitForTimeout(500);                                           // người thật không thể đóng khung trong 0,15 giây đầu
    await page.locator('.bp3-dialog.board-config .bp3-dialog-close-button').click();
    r = await pDong;
    ok(r.ss && r.ss.ok === false && r.ss.ly_do === 'dong', 'khung bị đóng trước khi sẵn sàng', r);

    console.log('— Chenfeng hỏi trước khi mở khung: bảng không trả lời hộ, chỉ báo câu hỏi');
    khung = 'tot';
    await page.evaluate(() => { window.__MOCK_CD_HOI__ = '有2处排钻碰撞, 是否先排查(取消则忽略继续提交拆单数据)'; });
    r = await xuat({ cho_hop: 1500 });
    ok(r.ok === false && r.gd === 'hoi' && /排钻碰撞/.test(r.hoi) && /排钻碰撞/.test(r.reason), 'không ai trả lời: dừng, nêu nguyên câu Chenfeng hỏi', r);
    ok(r.tt.some(t => /Chenfeng đang hỏi/.test(t) && /排钻碰撞/.test(t)), 'báo câu hỏi ngay khi nó hiện', r.tt);
    ok(await page.evaluate(() => document.querySelectorAll('.bp3-alert').length === 1 && document.querySelectorAll('.bp3-dialog.board-config').length === 0), 'hộp hỏi còn nguyên — bảng không bấm nút nào');
    await page.locator('.bp3-alert button', { hasText: '确定' }).click();      // người dùng chọn đi sửa trước
    const pHoi = xuat({ cho_hop: 8000 });
    await page.locator('.bp3-alert button', { hasText: '取消' }).click({ timeout: 5000 });      // người dùng chọn bỏ qua → Chenfeng mở khung
    r = await pHoi;
    ok(r.ok && r.gd === 'khung' && r.ss.ok, 'người dùng trả lời xong thì đi tiếp tới khung', r);
    await page.evaluate(() => { window.__MOCK_CD_HOI__ = null; return window.MNCFDriver.dongKhungXuat(); });

    console.log('— Lệnh CD không hỏi chọn tấm (tài khoản không có quyền tách đơn)');
    await page.evaluate(() => { window.__MOCK_CD_KHONG_QUYEN__ = true; });
    let lanTruoc = await page.evaluate(() => window.__MOCK_CD__.length);
    r = await xuat();
    ok(r.ok === false && r.gd === 'lenh' && /CD/.test(r.reason) && r.lan === lanTruoc && (await soHop()) === 0, 'báo không chạy được lệnh, không treo', r);
    await page.evaluate(() => { window.__MOCK_CD_KHONG_QUYEN__ = false; });

    console.log('— Đang dở lệnh khác: huỷ lệnh đó rồi mới chạy CD');
    await page.evaluate(() => window.MNCFDriver.cmd('DRAWHOLE'));
    r = await xuat();
    ok(r.ok && r.ss.ok && (await page.evaluate(() => (window.__MOCK_CANCELS__ || 0) >= 1)), 'lệnh dở bị huỷ, CD vẫn chạy', r);
    await page.evaluate(() => window.MNCFDriver.dongKhungXuat());

    console.log('— Thẻ Kết quả: nút "Xuất ván"');
    await H.locator('.launch').click();
    await H.locator('.tab[data-tab="kq"]').click();
    ok(await H.locator('[data-act="xuatvan"]').isVisible() && /Xuất ván/.test(await H.locator('[data-act="xuatvan"]').innerText()), 'có nút Xuất ván');
    lanTruoc = await page.evaluate(() => window.__MOCK_CD__.length);
    await H.locator('[data-act="xuatvan"]').click();
    await H.locator('[data-ui="xuatvan"] .msg.ok').waitFor({ timeout: 15000 });
    let chu = await H.locator('[data-ui="xuatvan"]').innerText();
    ok(new RegExp(`${D0.tam} tấm`).test(chu) && /cả bản vẽ/.test(chu) && /打开/.test(chu), 'xuất cả bản vẽ: ghi số tấm, phạm vi, nhắc bấm 打开', chu);
    ok(/trợ lý/i.test(chu) && !/停止优化/.test(chu), 'tiện ích bản mới (bộ nạp ≥ 2): nói trợ lý trang sản xuất tự tối ưu, không bắt nhớ các nút tiếng Trung', chu);
    ok((await page.evaluate(() => window.__MOCK_CD__.length)) === lanTruoc + 1 && (await soHop()) === 1, 'đã chạy CD một lần, khung đang mở');
    ok(/打开/.test(await H.locator('.status').innerText()), 'dòng trạng thái cũng nhắc bấm 打开', await H.locator('.status').innerText());
    // người dùng bấm 打开 trong khung → trang sản xuất báo closeWindow → hộp thoại đóng → bảng đổi lời
    await page.frameLocator('.bp3-dialog.board-config iframe').locator('#mo').click();
    ok(!/Đã bấm 打开/.test(chu), 'chưa bấm 打开 thì chưa nói "đã bấm"');
    await page.waitForFunction(() => /Đã bấm 打开/.test(document.getElementById('mncf-host').shadowRoot.querySelector('[data-ui="xuatvan"]').textContent), null, { timeout: 10000 });
    chu = await H.locator('[data-ui="xuatvan"]').innerText();
    ok(/trang sản xuất/i.test(chu) && /tab mới/.test(chu) && /F5/.test(chu), 'sau khi bấm 打开: báo trang sản xuất mở ở tab mới, dặn đừng F5', chu);
    ok((await soHop()) === 0, 'hộp thoại đã đóng');

    console.log('— Bộ nạp cũ (chưa có trợ lý trang sản xuất): chỉ cách bấm tay + nhắc cài lại tiện ích');
    await page.evaluate(() => { window.__nap_cu = window.__MNCF_NAP__.ban_nap; window.__MNCF_NAP__.ban_nap = 1; });
    await chonTu('XB');
    await H.locator('[data-act="xuatvan"]').click();
    await page.waitForFunction(() => /XB/.test(document.getElementById('mncf-host').shadowRoot.querySelector('[data-ui="xuatvan"]').textContent), null, { timeout: 15000 });
    await H.locator('[data-ui="xuatvan"] .msg.ok').waitFor({ timeout: 15000 });
    chu = await H.locator('[data-ui="xuatvan"]').innerText();
    ok(new RegExp(`${D0.XB.tam} tấm`).test(chu) && /tủ XB/.test(chu) && !/cả bản vẽ/.test(chu), 'chọn 1 tấm của XB: chỉ xuất tủ XB', chu);
    ok(/开始优化/.test(chu) && /停止优化/.test(chu) && /确认新优化/.test(chu) && /cài lại/i.test(chu), 'bộ nạp cũ: nêu 3 nút bấm tay và nhắc cài lại tiện ích', chu);
    eq(await page.evaluate(() => window.__MOCK_CD__.slice(-1)[0].tu), ['XB'], 'CD chỉ nhận tủ XB');
    await page.evaluate(() => { window.__MNCF_NAP__.ban_nap = window.__nap_cu; return window.MNCFDriver.dongKhungXuat(); });

    console.log('— Có lỗi sản xuất: chưa chạy CD, nêu lỗi, hỏi "Vẫn xuất"');
    await page.evaluate(() => { window.__MOCK_LO_GIAO__ = true; });
    r = await ve(Object.assign({ ma: 'XC' }, TU), 6000);
    await page.evaluate(() => { window.__MOCK_LO_GIAO__ = false; });
    ok(r.ok === false, 'tủ XC có lỗ khoan giao nhau', r);
    await H.locator('.tab[data-tab="kq"]').click();
    await chonTu('');
    lanTruoc = await page.evaluate(() => window.__MOCK_CD__.length);
    await H.locator('[data-act="xuatvan"]').click();
    await H.locator('[data-ui="xuatvan"] .msg.err').first().waitFor({ timeout: 10000 });
    chu = await H.locator('[data-ui="xuatvan"]').innerText();
    ok(/LỖI/.test(chu) && /Lỗ khoan không giao nhau/.test(chu) && /cắt lỗ/.test(chu) && (await H.locator('[data-act="xuatvan-van"]').isVisible()), 'nêu mục lỗi + dòng báo chỗ lỗ giao nhau + nút "Vẫn xuất"', chu);
    ok((await page.evaluate(() => window.__MOCK_CD__.length)) === lanTruoc && (await soHop()) === 0, 'chưa chạy CD khi còn lỗi');
    await H.locator('[data-act="xuatvan-van"]').click();
    await H.locator('[data-ui="xuatvan"] .msg.ok').waitFor({ timeout: 15000 });
    ok((await page.evaluate(() => window.__MOCK_CD__.length)) === lanTruoc + 1 && (await soHop()) === 1, 'bấm "Vẫn xuất": chạy CD');
    chu = await H.locator('[data-ui="xuatvan"]').innerText();
    ok(/3 tủ/.test(chu) || /XA, XB, XC/.test(chu), 'ghi số tủ được xuất', chu);
    await page.evaluate(() => window.MNCFDriver.dongKhungXuat());
    // chọn tủ sạch → không vướng lỗi của tủ khác
    await chonTu('XA');
    lanTruoc = await page.evaluate(() => window.__MOCK_CD__.length);
    await H.locator('[data-act="xuatvan"]').click();
    await H.locator('[data-ui="xuatvan"] .msg.ok').waitFor({ timeout: 15000 });
    ok((await page.evaluate(() => window.__MOCK_CD__.length)) === lanTruoc + 1 && (await H.locator('[data-act="xuatvan-van"]').count()) === 0, 'chọn tủ XA (không lỗi): xuất thẳng, không bị lỗi của XC chặn');
    await page.evaluate(() => window.MNCFDriver.dongKhungXuat());

    console.log('— Khung không tải được: báo + nút "Thử lại"');
    khung = 'loi';
    await chonTu('XA');
    await H.locator('[data-act="xuatvan"]').click();
    await H.locator('[data-act="xuatvan-lai"]').waitFor({ timeout: 20000 });
    chu = await H.locator('[data-ui="xuatvan"]').innerText();
    ok(/không tải được/i.test(chu) && (await H.locator('[data-ui="xuatvan"] .msg.err, [data-ui="xuatvan"] .msg.warn').count()) >= 1, 'khung lỗi: báo rõ', chu);
    khung = 'tot';
    lanTruoc = await page.evaluate(() => window.__MOCK_CD__.length);
    await H.locator('[data-act="xuatvan-lai"]').click();
    await H.locator('[data-ui="xuatvan"] .msg.ok').waitFor({ timeout: 15000 });
    ok((await page.evaluate(() => window.__MOCK_CD__.length)) === lanTruoc + 1 && (await soHop()) === 1, '"Thử lại": đóng khung hỏng, chạy lại CD, lần này được');
    eq(await page.evaluate(() => window.__MOCK_CD__.slice(-1)[0].tu), ['XA'], '"Thử lại" giữ đúng phạm vi của lần trước (tủ XA) dù tập chọn đã mất');
    await page.evaluate(() => window.MNCFDriver.dongKhungXuat());

    console.log('— Thẻ Hướng dẫn: mục Xuất ván + khung "Cập nhật tự động" nói về trợ lý trang sản xuất');
    await H.locator('.tab[data-tab="hd"]').click();
    chu = await H.locator('[data-pane="hd"]').innerText();
    ok(/Xuất ván/.test(chu) && /bản 1\.22/.test(chu) && /打开/.test(chu), 'có mục hướng dẫn Xuất ván (bản 1.22)');
    let khungCN = await H.locator('fieldset', { hasText: 'Cập nhật tự động' }).innerText();
    ok(/trợ lý trang sản xuất/i.test(khungCN) && !/bản cũ/i.test(khungCN), 'bộ nạp bản 2: khung Cập nhật tự động ghi có trợ lý trang sản xuất', khungCN);
    // máy còn bộ nạp cũ (bản 1): bảng vẫn chạy bản mới nhưng không có trợ lý → nhắc cài lại tiện ích
    const p2 = await ctx.newPage();
    await p2.addInitScript(() => { let v; Object.defineProperty(window, '__MNCF_NAP__', { configurable: true, get() { return v; }, set(x) { if (x && typeof x === 'object') x.ban_nap = 1; v = x; } }); });
    await p2.goto('https://cfcad.cn/');
    await p2.waitForFunction(() => window.MNCF && window.MNCF.app, null, { timeout: 15000 });
    const H2 = p2.locator('#mncf-host');
    await H2.locator('.launch').click(); await H2.locator('.tab[data-tab="hd"]').click();
    khungCN = await H2.locator('fieldset', { hasText: 'Cập nhật tự động' }).innerText();
    ok(/bản cũ/i.test(khungCN) && /cài lại/i.test(khungCN) && /zip/i.test(khungCN), 'bộ nạp bản 1: nhắc tải zip mới, cài lại để có trợ lý', khungCN);
    await p2.close();

    ok(errs.length === 0, 'không lỗi JS lọt ra trang', errs);
  } catch (e) { fail++; console.log('  ✗ ném lỗi:', e && e.stack || e); }
  await ctx.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* bỏ qua */ }
  console.log(`\nxuatvan.test: ${pass} đạt, ${fail} hỏng`);
  process.exit(fail ? 1 : 0);
})();
