'use strict';
// Kiểm tra TIỆN ÍCH Chrome (dist/extension) trên trang GIẢ LẬP Chenfeng (test/mock-chenfeng.html):
//   NODE_PATH=<node_modules có playwright> PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node test/ext.test.js
// Kiểm: tiện ích tự nạp vào trang cfcad.cn (world MAIN), bảng nổi, vẽ tại toạ độ / bấm điểm, sửa kiểu khoan cũ, đối chiếu, hoàn tác, Esc, chặn khi ở trang chủ, không chạy ở /help.
const path = require('path'), fs = require('fs'), os = require('os'), zlib = require('zlib');
const { chromium } = require('playwright');
const EXT = path.join(__dirname, '..', 'dist', 'extension');
const MOCK = fs.readFileSync(path.join(__dirname, 'mock-chenfeng.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) pass++; else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); } };
const TU_2000 = { ma: 'TA2', rong: 2000, cao: 2800, chan: { cao: 50 }, khoang: [
  { rong: 'auto', canh: 2, dot: [1800], o: [{ tu: 0, kieu: 'suot' }] },
  { rong: 'auto', canh: 2, dot: [520, 1800], o: [{ tu: 0, kieu: 'nk_am', so: 2 }, { tu: 520, kieu: 'suot' }] } ] };

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mncf-ext-'));
  const ctx = await chromium.launchPersistentContext(dir, { channel: 'chromium', headless: true, viewport: { width: 1500, height: 900 },
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  try {
    // kho mẫu giả: thư mục 抽屉 có 2 mẫu quen (mã khác) + 1 mẫu lạ
    const props = a => zlib.deflateSync(Buffer.from(JSON.stringify(a.map(([n, v, d]) => [3, n, '', v, null, d || null, 1])))).toString('base64');
    const chung = [['L', 426, '宽'], ['W', 350, '深'], ['H', 200, '高'], ['PX', 0], ['PY', 0], ['PZ', 0], ['BH', 18, '板厚'], ['SYS', 0], ['XYS', 0], ['ZYS', 0], ['YYS', 0]];
    const api = [];
    await ctx.route('https://api.cfcad.cn/**', r => {
      const u = new URL(r.request().url()), body = JSON.parse(r.request().postData() || '{}'); api.push([u.pathname, body]);
      const j = u.pathname === '/CAD-dirQuery' ? { err_code: 0, err_msg: '', dirs: [{ dir_id: '11', dir_name: '门', childs: [] }, { dir_id: '12', dir_name: '抽屉', childs: [{ dir_id: '13', dir_name: '其他', childs: [] }] }] }
        : u.pathname === '/CAD-moduleList' && body.dir_id === '12' ? { err_code: 0, err_msg: '', count: '3', modules: [
          { module_id: '555001', name: '三节轨薄底抽', props: props(chung.concat([['GD', 13, '轨道'], ['LC', 0], ['SLK', 30], ['XLK', 30]])) },
          { module_id: '555002', name: '托底轨厚底抽', props: props(chung.concat([['GDK', 24.5], ['LC', 0], ['SLK', 30], ['XLK', 30]])) },
          { module_id: '555099', name: '自定义抽屉', props: props(chung.concat([['AB', 5], ['CMG', 80]])) }] }
          : { err_code: 1, err_msg: 'no' };
      return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': 'https://cfcad.cn', 'access-control-allow-credentials': 'true' }, body: JSON.stringify(j) });
    });
    await require('./kho-gia.js')(ctx);      // bộ nạp của tiện ích lấy bản gộp vừa dựng trong máy, không lấy bản trên mạng (xem test/nap.test.js cho các tình huống cập nhật)
    await ctx.route('https://cfcad.cn/**', r => { const u = new URL(r.request().url());
      if (u.pathname.startsWith('/help')) return r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>help</title><p>trợ giúp</p>' });
      return r.fulfill({ contentType: 'text/html; charset=utf-8', body: MOCK }); });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    await page.goto('https://cfcad.cn/');
    await page.waitForFunction(() => window.MNCF && window.MNCF.app, null, { timeout: 15000 });
    const H = page.locator('#mncf-host');
    const man = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
    ok((await page.evaluate(() => window.MNCF.version)) === man.version, 'tiện ích tự nạp vào trang (world MAIN), đúng phiên bản manifest');
    ok(await H.locator('.launch').isVisible() && !(await H.locator('.panel').isVisible()), 'chỉ hiện nút mở bảng, bảng đang thu gọn');
    // bản 1.20.1 — phím tắt Alt + M ẩn / hiện bảng (anh Jason 04/10/2026 09:10: "cho anh phím tắt ẩn hiện tool"); phím đó không lọt xuống trang Chenfeng
    await page.evaluate(() => { window.__phimLot = 0; document.addEventListener('keydown', e => { if (e.altKey && e.code === 'KeyM') window.__phimLot++; }); });
    await page.keyboard.press('Alt+KeyM');
    ok(await H.locator('.panel').isVisible() && !(await H.locator('.launch').isVisible()), 'Alt + M: mở bảng');
    await page.keyboard.press('Alt+KeyM');
    ok(!(await H.locator('.panel').isVisible()) && await H.locator('.launch').isVisible(), 'Alt + M lần nữa: thu gọn, còn lại nút mở bảng');
    ok((await page.evaluate(() => window.__phimLot)) === 0, 'phím tắt không lọt xuống trang Chenfeng');
    await page.keyboard.press('Control+Alt+KeyM'); await page.keyboard.press('Alt+Shift+KeyM');
    ok(!(await H.locator('.panel').isVisible()) && (await page.evaluate(() => window.__phimLot)) === 2, 'tổ hợp có thêm Ctrl / Shift không phải phím tắt của bảng: bảng đứng yên, phím vẫn tới Chenfeng');
    ok(/Alt \+ M/.test(await H.locator('.launch').getAttribute('title')) && /Alt \+ M/.test(await H.locator('[data-act="close"]').getAttribute('title')), 'nút mở bảng và nút thu gọn có ghi phím tắt');
    await H.locator('.launch').click();
    ok(await H.locator('[data-act="draw"]').isVisible() && /Vẽ vào Chenfeng/.test(await H.locator('[data-act="draw"]').innerText()), 'bảng nổi có nút "Vẽ vào Chenfeng"');
    ok((await H.locator('[data-dot]').count()) > 0 && (await H.locator('[data-o]').count()) > 0, 'hình đứng tương tác trong bảng nổi');

    // gõ phím trong bảng không lọt ra Chenfeng
    await page.evaluate(() => { window.__keys = 0; window.addEventListener('keydown', () => window.__keys++); });
    await H.locator('#mncf-rong').click(); await page.keyboard.type('1');
    ok((await page.evaluate(() => window.__keys)) === 0, 'phím gõ trong bảng không lan ra trang Chenfeng');

    /* --- vẽ tại toạ độ --- */
    await page.evaluate(s => window.MNCF.app.setSpec(s), TU_2000);
    await H.locator('#mncf-ui-useat').check(); await H.locator('#mncf-ui-ax').fill('5000');
    await H.locator('[data-act="draw"]').click();
    await H.locator('.report .msg').first().waitFor({ timeout: 30000 });
    let rep = await page.evaluate(() => { const L = window.MNCFDriver.last; const a = L.added; const D = window.MNCFDriver; return { n: a.length, boards: a.filter(D.isBoard).length, holes: a.filter(D.isHole).length, hw: a.filter(D.isHardware).length, off: L.offset, steps: L.steps,
      old: a.filter(D.isBoard).filter(b => b.BoardProcessOption.highDrill.includes('三合一')).length, wrongType: a.filter(D.isBoard).filter(b => { const h = b.BoardProcessOption.highDrill; return new Set(h).size === 1 && h[0] !== '不排' && b.BoardProcessOption.drillType !== h[0]; }).length,
      dem: a.filter(D.isBoard).filter(b => b.Name === 'Vách đệm ngăn kéo').map(b => D.boxOf(b)),
      hau: a.filter(D.isBoard).filter(b => b.Name === 'Hậu').map(b => [b.Thickness].concat(D.boxOf(b))), loHau: a.filter(D.isHole).filter(h => h.FId.Object.Name === 'Hậu').length }; });
    ok(/Đã vẽ xong — 46\/46 tấm/.test(await H.locator('.report .msg.ok').innerText()), 'báo cáo: 46/46 tấm đúng vị trí', await H.locator('.report').innerText());
    ok(rep.boards === 46 + 12 && rep.hw === 6, '46 tấm thiết kế + 12 tấm hộp ngăn kéo + 6 phụ kiện', rep);
    ok(JSON.stringify(rep.off) === '[5000,17.5,0]', 'toạ độ gõ = góc trái–trước–dưới của tủ (mặt cánh) → thùng dời (5000; 17,5; 0)', rep.off);
    ok(rep.old === 0 && rep.wrongType === 0, 'đã đổi kiểu khoan cũ 三合一 → Cam3Tp và ghi lại drillType', rep);
    ok(rep.steps === 4, '4 bước hoàn tác (nhập tấm + thêm mẫu ngăn kéo / suốt treo + khoan lại + gom module) — nút Hoàn tác lùi đủ cả 4', rep.steps);
    /* --- tủ vẽ xong là module tham số gốc của Chenfeng --- */
    const mod = await page.evaluate(() => { const D = window.MNCFDriver, bs = D.all().filter(D.isBoard), tag = bs.filter(D.tagOf), T = tag[0].Template && tag[0].Template.Object;
      const ex = n => T.GetParam(n).actions.map(a => a.Expr + ':m' + a.MoveEntitys.length + '/s' + a.EntityStretchPointMap.length).sort();
      const con = T.Children.map(c => c.Object).map(c => ({ ten: c.Name, cha: c.Parent && c.Parent.Object === T, pos: !!c.Positioning, L: c.LParam.expr, PX: c.PXParam.expr, PZ: c.PZParam.expr }));
      return { chung: tag.every(b => b.Template && b.Template.Object === T), ten: T.Name, L: ex('L'), W: ex('W'), H: ex('H'), bh: T.GetParam('BH') ? [T.GetParam('BH').actions.length, T.GetParam('BH').expr, T.GetParam('L').description] : null, con, capNhat: T.capNhat, dims: D.moduleDims(tag[0]), last: window.MNCFDriver.last.steps }; });
    ok(mod.chung && mod.ten === 'TA2' && JSON.stringify(mod.bh) === JSON.stringify([0, '17.5', 'Rộng phủ bì']), 'mọi tấm của tủ thuộc một module tên theo mã tủ; tham số BH: gỡ hành động, ghi đúng 17,5; L có mô tả tiếng Việt', [mod.chung, mod.ten, mod.bh]);
    ok(mod.L.some(x => /^L:/.test(x)) && mod.L.some(x => /^L\*0\.5:/.test(x)) && mod.L.some(x => /^L\*0\.25:/.test(x)) && mod.W.length >= 1 && mod.H.length >= 1, 'hành động co giãn L tính theo kết cấu: nhóm 1, 0,5 (vách giữa), 0,25 (mép cánh)', [mod.L, mod.W, mod.H]);
    ok(mod.con.length === 4 && mod.con.every(c => c.cha && !c.pos) && mod.con.filter(c => /_L\*0\.5/.test(c.L)).length === 4, '2 hộp ngăn kéo + 2 suốt treo thành mẫu con, rộng bám theo _L', mod.con);
    ok(JSON.stringify(mod.dims) === '[2000,597.5,2800]' && mod.capNhat >= 1, 'kích thước module = phủ bì tủ (2000 × 597,5 × 2800)', mod.dims);
    ok(/Tủ đã là module tham số của Chenfeng/.test(await H.locator('.report .mod').innerText()), 'báo cáo nói rõ cách sửa ngay trong ô Thông số của Chenfeng');
    ok(JSON.stringify(rep.dem) === JSON.stringify([[6041.5, 6059, 30, 591.5, 67.5, 520], [6882.5, 6900, 30, 591.5, 67.5, 520]]), '2 vách đệm nằm đúng chỗ (đã cộng độ dời)', rep.dem);
    // hậu chuẩn xưởng: 4 tấm 6 li nằm sau thùng (y 574…580 + độ dời 17,5), không có lỗ khoan nào
    ok(JSON.stringify(rep.hau) === JSON.stringify([[6, 5051, 6000, 591.5, 597.5, 51, 2199], [6, 6000, 6949, 591.5, 597.5, 51, 2199], [6, 5051, 6000, 591.5, 597.5, 2201, 2749], [6, 6000, 6949, 591.5, 597.5, 2201, 2749]]) && rep.loHau === 0, 'hậu 6 li phủ sau lưng thùng: đúng chỗ, không lỗ khoan', [rep.hau, rep.loHau]);
    ok(!/tấm hậu/.test(await H.locator('.report').innerText()), 'hậu không có lỗ → báo cáo không nhắc gì tới hậu');
    ok(/đổi sang Cam3Tp cho 10 tấm/.test(await H.locator('.report').innerText()), 'báo cáo nêu việc đổi kiểu khoan của mẫu');
    ok((await page.evaluate(() => window.__MOCK_ZOOM__)) >= 1, 'vẽ xong gọi xem toàn bộ');

    // bản 1.15: trang giả lập không có lệnh gốc của Chenfeng → bảng tự vẽ theo cách nhập tấm (không báo lỗi)
    ok((await page.evaluate(() => [window.MNCFDriver.gocDuoc(), window.MNCF.app.getSpec().ve_goc, typeof window.MNCFDriver.veGoc, !!window.MNCFDriver.last.goc_cf].join())) === 'false,true,function,false', 'trang không có lệnh gốc → D.draw dùng cách nhập tấm dù ve_goc đang bật');
    /* --- hoàn tác --- */
    await H.locator('[data-act="undo"]').click();
    await page.waitForFunction(() => /Đã hoàn tác/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 15000 });
    ok((await page.evaluate(() => window.MNCFDriver.all().length)) === 0, 'hoàn tác: bản vẽ sạch trở lại');

    /* --- nếu Chenfeng lỡ khoan lỗ vào tấm hậu (hậu bắn đinh, không được có lỗ) → báo cáo phải nêu ra --- */
    await page.evaluate(() => { window.__MOCK_DRILL_BACK__ = true; });
    await H.locator('.tab[data-tab="tu"]').click();
    await H.locator('#mncf-ui-ax').fill('20000');
    await H.locator('[data-act="draw"]').click();
    await page.waitForFunction(() => { const L = window.MNCFDriver.last; return L && L.offset && L.offset[0] === 20000; }, null, { timeout: 30000 });
    await H.locator('.report .msg').first().waitFor({ timeout: 30000 });
    ok(/8 lỗ khoan dính tới tấm hậu/.test(await H.locator('.report').innerText()), 'Chenfeng khoan vào hậu → báo cáo nêu số lỗ dính tới tấm hậu', await H.locator('.report').innerText());
    await page.evaluate(() => { window.__MOCK_DRILL_BACK__ = false; });
    await H.locator('[data-act="undo"]').click();
    await page.waitForFunction(() => /Đã hoàn tác/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 15000 });
    ok((await page.evaluate(() => window.MNCFDriver.all().length)) === 0, 'hoàn tác lần vẽ đó: bản vẽ sạch');

    /* --- bấm điểm trên bản vẽ --- */
    await H.locator('#mncf-ui-useat').uncheck();
    await H.locator('[data-act="draw"]').click();
    await H.locator('.chip').waitFor({ state: 'visible' });
    ok(!(await H.locator('.panel').isVisible()) && /Bấm 1 điểm|đang tải|Đang gửi|Đang chuẩn bị/.test(await H.locator('.chip').innerText()), 'bảng tự thu gọn, hiện lời nhắc bấm điểm', await H.locator('.chip').innerText());
    await page.waitForFunction(() => window.app.Editor.GetPointServices.IsReady);
    await page.waitForFunction(() => /Bấm 1 điểm/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.chip').textContent));
    await page.mouse.click(300, 400);                          // bấm trên vùng vẽ (trang giả lập đặt tại 1000, −17.5, 0)
    await H.locator('.report .msg.ok').waitFor({ timeout: 30000 });
    rep = await page.evaluate(() => ({ off: window.MNCFDriver.last.offset, n: window.MNCFDriver.all().filter(window.MNCFDriver.isBoard).length }));
    ok(JSON.stringify(rep.off) === '[1000,0,0]' && rep.n === 58, 'đặt bằng cách bấm điểm: tự dò ra độ dời (1000; 0; 0)', rep);

    /* --- Sửa tủ đã vẽ: bảng tự nối với tủ vừa vẽ; sửa số rồi cập nhật tại chỗ, không hỏi điểm --- */
    const B = () => page.evaluate(() => { const D = window.MNCFDriver, b = D.all().filter(D.isBoard); return { n: b.length, tag: [...new Set(b.map(D.tagOf))], x0: Math.min.apply(null, b.map(e => e.BoundingBox.min.x)), x1: Math.max.apply(null, b.map(e => e.BoundingBox.max.x)), holes: D.all().filter(D.isHole).length, hw: D.all().filter(D.isHardware).length }; });
    let b0 = await B();
    const id1 = await page.evaluate(() => window.MNCFDriver.last.id);
    ok(/^[2-9A-Z]{8}$/.test(id1) && b0.tag.includes(id1) && b0.tag.includes('') && b0.tag.length === 2, 'tấm tiện ích vẽ mang ghi chú mã tủ; tấm của mẫu ngăn kéo thì không', b0.tag);
    ok(!(await H.locator('[data-act="redraw"]').isDisabled()) && /Đang nối với tủ/.test(await H.locator('.tunoi').innerText()), 'vẽ xong → bảng nối với tủ vừa vẽ, nút "Cập nhật tủ này" bật');
    ok((await page.evaluate(id => { try { return JSON.parse(localStorage.getItem('mncf.tu.' + id)).spec.rong; } catch (e) { return null; } }, id1)) === 2000, 'thông số của tủ được lưu theo mã tủ');
    // người dùng làm việc khác trên bản vẽ (lịch sử đã đổi) + tự gắn thêm 1 tay nắm từ mẫu khác + di chuyển cả tủ 500 theo x
    await page.evaluate(() => {
      const M = window.__MOCK__, D = window.MNCFDriver;
      for (const e of D.all()) e.move([500, 0, 0]);
      const tn = new M.HardwareCompositeEntity('拉手', [1700, 1830, -40, -18, 1000, 1020], 'TA2'); tn.Template = { Object: { Name: '拉手96', Parent: null } }; M.ents.push(tn); window.__TAY_NAM__ = tn;
      window.app.Database.hm.historyRecord.push({ CommandName: 'MOVE', created: [] }); window.app.Database.hm.curIndex++;
    });
    await page.evaluate(s => window.MNCF.app.setSpec(Object.assign({}, s, { rong: 2200 })), TU_2000);
    await H.locator('.tab[data-tab="tu"]').click();
    await H.locator('[data-act="redraw"]').click();
    await page.waitForFunction(() => /Đã cập nhật|Chưa cập nhật/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 60000 });
    let b1 = await B();
    rep = await page.evaluate(() => ({ off: window.MNCFDriver.last.offset, tn: !window.__TAY_NAM__.IsErase, id: window.MNCFDriver.last.id, kq: document.getElementById('mncf-host').shadowRoot.querySelector('.report').innerText }));
    ok(JSON.stringify(rep.off) === '[1500,0,0]' && b1.n === 60 && Math.abs(b1.x1 - b1.x0 - 2200) < 0.6 && Math.abs(b1.x0 - 1500) < 0.6, 'tủ đã bị dời 500 + bản vẽ đã có thao tác khác → vẫn cập nhật đúng chỗ MỚI của tủ, rộng 2000 → 2200', [rep.off, b1]);
    ok(rep.id === id1 && b1.tag.includes(id1) && b1.tag.length === 2, 'tủ sau cập nhật giữ nguyên mã', b1.tag);
    ok(b1.hw === b0.hw + 1 && rep.tn, 'hộp ngăn kéo, suốt treo cũ được bỏ và vẽ lại (không nhân đôi); tay nắm người dùng tự gắn được giữ', [b0.hw, b1.hw, rep.tn]);
    ok(/Đã cập nhật tủ tại chỗ/.test(rep.kq) && /Đã bỏ \d+ đối tượng của tủ cũ/.test(rep.kq), 'báo cáo nêu rõ đã cập nhật tại chỗ', rep.kq.slice(0, 200));
    await page.evaluate(() => { window.__TAY_NAM__.IsErase = true; });

    /* --- Chọn 1 tấm của tủ đã vẽ → bảng mở lại thông số tủ đó --- */
    await H.locator('.tab[data-tab="tu"]').click();
    await H.locator('[data-act="unlink"]').click();
    ok(await H.locator('[data-act="redraw"]').isDisabled() && !(await H.locator('.tunoi').isVisible()), 'Bỏ nối → nút cập nhật tắt');
    await page.evaluate(s => window.MNCF.app.setSpec(Object.assign({}, s, { rong: 3000, cao: 2400 })), TU_2000);      // bảng đang mở một tủ khác hẳn
    await H.locator('[data-act="pick"]').click();
    ok(/bấm chọn 1 tấm/.test(await H.locator('.status').innerText()), 'chưa chọn tấm nào → nhắc chọn');
    await page.evaluate(() => { const D = window.MNCFDriver; window.__MOCK__.userSelect([D.all().find(e => D.isBoard(e) && !D.tagOf(e))]); });
    await H.locator('[data-act="pick"]').click();
    ok(/không mang mã tủ/.test(await H.locator('.status').innerText()), 'chọn tấm không do tiện ích vẽ → nói rõ');
    await page.evaluate(() => { const D = window.MNCFDriver; window.__MOCK__.userSelect([D.all().find(e => D.isBoard(e) && D.tagOf(e) && e.Name === 'Đợt')]); });
    await H.locator('[data-act="pick"]').click();
    let sp2 = await page.evaluate(() => window.MNCF.app.getSpec());
    ok(sp2.rong === 2200 && sp2.cao === 2800 && /Đã mở thông số của tủ/.test(await H.locator('.status').innerText()) && !(await H.locator('[data-act="redraw"]').isDisabled()), 'chọn 1 tấm đợt → bảng mở lại thông số tủ đó (2200 × 2800), nút cập nhật bật', [sp2.rong, sp2.cao]);
    // sửa: thêm 1 đợt ở khoang 1 rồi cập nhật
    await page.evaluate(() => { const s = window.MNCF.app.getSpec(); s.khoang[0].dot = [900, 1800]; window.MNCF.app.setSpec(s); });
    await H.locator('.tab[data-tab="tu"]').click();
    await H.locator('[data-act="redraw"]').click();
    await page.waitForFunction(() => /Đã cập nhật|Chưa cập nhật/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 60000 });
    let b2 = await B();
    ok(b2.n === 61 && Math.abs(b2.x0 - 1500) < 0.6 && Math.abs(b2.x1 - b2.x0 - 2200) < 0.6 && b2.hw === b0.hw, 'thêm 1 đợt rồi cập nhật: 61 tấm (tủ 2200 tách 2 thùng → thêm 2 hồi), đúng chỗ cũ, phụ kiện không nhân đôi', b2);
    // hoàn tác lần cập nhật = trả lại tủ trước khi sửa
    await H.locator('[data-act="undo"]').click();
    await page.waitForFunction(() => /Đã hoàn tác/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 15000 });
    let b3 = await B();
    ok(b3.n === 60 && Math.abs(b3.x1 - b3.x0 - 2200) < 0.6, 'hoàn tác lần cập nhật → tủ trở lại như trước khi sửa (60 tấm)', b3);
    // xoá không được → bản vẽ giữ nguyên, báo rõ
    await page.evaluate(() => { const D = window.MNCFDriver; window.__MOCK__.userSelect([D.all().find(e => D.isBoard(e) && D.tagOf(e))]); });
    await H.locator('.tab[data-tab="tu"]').click();
    await H.locator('[data-act="pick"]').click();
    await page.evaluate(() => { window.__MOCK_ERASE_FAIL__ = true; const s = window.MNCF.app.getSpec(); s.rong = 2400; window.MNCF.app.setSpec(s); });
    await H.locator('[data-act="redraw"]').click();
    await page.waitForFunction(() => /Đã cập nhật|Chưa cập nhật/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 60000 });
    let b4 = await B();
    ok(b4.n === 60 && Math.abs(b4.x1 - b4.x0 - 2200) < 0.6 && /Chưa bỏ được tủ cũ/.test(await H.locator('.report').innerText()), 'Chenfeng không xoá được tủ cũ → không vẽ chồng, bản vẽ giữ nguyên, báo rõ', b4);
    await page.evaluate(() => { window.__MOCK_ERASE_FAIL__ = false; });
    // dọn: xoá tủ, vẽ lại tủ 2000 bằng cách bấm điểm như trước để các phép thử sau giữ nguyên
    await page.evaluate(async s => { const D = window.MNCFDriver; await D.erase(D.all()); window.MNCF.app.setSpec(s); }, TU_2000);
    await H.locator('.tab[data-tab="tu"]').click();
    await H.locator('[data-act="unlink"]').click();
    await H.locator('[data-act="draw"]').click();
    await page.waitForFunction(() => /Bấm 1 điểm/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.chip').textContent));
    await page.mouse.click(300, 400);
    await page.waitForFunction(() => { const D = window.MNCFDriver; return D.last && D.all().filter(D.isBoard).length === 58 && /Đã vẽ xong/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent); }, null, { timeout: 30000 });

    /* --- có thao tác khác sau lần vẽ → không hoàn tác bừa --- */
    await page.evaluate(() => { window.app.Database.hm.historyRecord.push({ CommandName: 'MOVE', created: [] }); window.app.Database.hm.curIndex++; });
    await H.locator('[data-act="undo"]').click();
    await page.waitForFunction(() => /đã có thao tác khác/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 15000 });
    ok((await page.evaluate(() => window.MNCFDriver.all().filter(window.MNCFDriver.isBoard).length)) === 58, 'bản vẽ đã có thao tác khác → từ chối hoàn tác, giữ nguyên');

    /* --- Esc khi đang hỏi điểm --- */
    await H.locator('.tab[data-tab="tu"]').click();
    await H.locator('[data-act="draw"]').click();
    await page.waitForFunction(() => window.app.Editor.GetPointServices.IsReady);
    await page.evaluate(() => window.app.Editor.Cancel());
    await H.locator('.report .msg.err').first().waitFor({ timeout: 15000 });
    ok(/Đã huỷ/.test(await H.locator('.report').innerText()), 'Esc lúc hỏi điểm → báo đã huỷ, không vẽ');
    ok((await page.evaluate(() => window.MNCFDriver.all().filter(window.MNCFDriver.isBoard).length)) === 58, 'không thêm tấm nào');

    /* --- đang ở trang chủ (vùng vẽ bị che) → không thả file --- */
    await page.evaluate(() => { const d = document.createElement('div'); d.id = 'home'; d.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:10'; document.body.appendChild(d); window.__MOCK_HOME__ = true; });
    await H.locator('.tab[data-tab="tu"]').click();
    await H.locator('#mncf-ui-useat').check();
    await H.locator('[data-act="draw"]').click();
    await H.locator('.report .msg.err').first().waitFor({ timeout: 15000 });
    ok(/chưa ở màn hình vẽ/.test(await H.locator('.report').innerText()) && !(await page.evaluate(() => window.__MOCK_UPLOADED__)), 'vùng vẽ bị che → chặn, không thả file');
    await page.evaluate(() => { document.getElementById('home').remove(); window.__MOCK_HOME__ = false; });
    // bản 1.12: "màn che" trong suốt của Chenfeng (hiện sau khi gõ vào ô ở bảng Thông số bên phải) KHÔNG phải màn chào
    const che = await page.evaluate(() => { const m = document.createElement('div'); m.id = 'manche'; m.tabIndex = -1; m.style.cssText = 'display:block;position:fixed;inset:0;height:100%;width:100%;background:rgb(0,0,0);opacity:0;z-index:20'; document.body.appendChild(m); const r = window.MNCFDriver.editing(); m.remove(); return r; });
    ok(che === true, 'màn che trong suốt của Chenfeng không bị coi là trang chủ / màn chào');

    /* --- Chenfeng đang bận lệnh khác → báo rõ, KHÔNG gửi Esc (kẻo huỷ nhầm lệnh đang chạy) --- */
    await page.evaluate(() => { window.__MOCK_BUSY__ = true; window.__MOCK_CANCELS__ = 0; });
    await H.locator('.tab[data-tab="tu"]').click();
    await H.locator('[data-act="draw"]').click();
    await H.locator('.report .msg.err').first().waitFor({ timeout: 15000 });
    ok(/đang bận một lệnh khác/.test(await H.locator('.report').innerText()) && (await page.evaluate(() => window.__MOCK_CANCELS__)) === 0, 'Chenfeng bận → báo "đang bận một lệnh khác", không gửi Esc', await H.locator('.report').innerText());
    await page.evaluate(() => { window.__MOCK_BUSY__ = false; });

    /* --- Chenfeng tự huỷ lệnh nhập vì lỗi (mạng chậm, tải mẫu hỏng) → báo đúng nguyên nhân, không báo "đã huỷ" --- */
    await page.evaluate(() => { window.__MOCK_FAIL_IMPORT__ = true; });
    await H.locator('.tab[data-tab="tu"]').click();
    await H.locator('[data-act="draw"]').click();
    await H.locator('.report .msg.err').first().waitFor({ timeout: 15000 });
    await page.waitForFunction(() => /tự huỷ lệnh/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.report').innerText), null, { timeout: 15000 });
    ok(/Chenfeng gặp lỗi khi nhập và đã tự huỷ lệnh/.test(await H.locator('.report').innerText()) && /bấm vẽ lại/.test(await H.locator('.report').innerText()), 'Chenfeng tự huỷ lệnh nhập → báo rõ, bảo bấm lại', await H.locator('.report').innerText());
    await page.evaluate(() => { window.__MOCK_FAIL_IMPORT__ = false; });

    /* --- các loại ngăn kéo: chọn loại trong bảng nổi, dò mã mẫu từ kho mẫu Chenfeng --- */
    await H.locator('.tab[data-tab="chuan"]').click();
    ok(await H.locator('[data-act="lk-do"]').isVisible(), 'trong Chenfeng có nút "Dò mã mẫu từ kho Chenfeng"');
    await H.locator('[data-act="lk-do"]').click();
    await page.waitForFunction(() => /cập nhật mã cho/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 15000 });
    const st = await H.locator('.status').innerText();
    const L = await page.evaluate(() => window.MNCF.app.getSpec().ngan_keo.loai);
    ok(/Thư mục 抽屉 có 3 mẫu — cập nhật mã cho 2 loại, thêm 1 loại mới/.test(st), 'dò kho mẫu: báo kết quả', st);
    ok(L.find(x => x.ma === 'bi_mong').mau_id === 555001 && L.find(x => x.ma === 'am_day').mau_id === 555002 && L.find(x => x.ma === 'bi_day').mau_id === 20216238, 'cập nhật mã mẫu theo tên mẫu; loại không có trong kho giữ nguyên');
    const moi = L.find(x => x.ten_mau === '自定义抽屉');
    ok(moi && moi.mau_id === 555099 && JSON.stringify(moi.ts) === '{"AB":5,"CMG":"mat"}' && L.length === 12, 'mẫu lạ → thêm loại mới với tham số riêng của mẫu', moi);
    ok((await H.locator('.lkr').count()) === 12 && (await H.locator('#mncf-lk0-id').inputValue()) === '555001', 'bảng loại hiện mã mới');
    ok(api.length === 2 && api[0][0] === '/CAD-dirQuery' && api[0][1].dir_type === '5' && api[1][1].dir_id === '12', 'chỉ gọi 2 lệnh ĐỌC của kho mẫu (thư mục + danh sách mẫu)', api);
    await H.locator('.tab[data-tab="tu"]').click();
    await H.locator('[data-o="1:50"]').click();
    await H.locator('#mncf-ed-loai').selectOption('am_day');
    await H.locator('#mncf-ui-useat').check(); await H.locator('#mncf-ui-ax').fill('9000');
    await H.locator('[data-act="draw"]').click();
    await H.locator('.report .msg.ok').waitFor({ timeout: 30000 });
    ok((await page.evaluate(() => window.__MOCK__.lastTemplates.filter(t => t.TempalteId === 555002).length)) === 2, 'vẽ: ô chọn "ray âm đáy dày" gửi đúng mã mẫu vừa dò (555002)');

    /* --- bản 1.13: KHẤU CỘT — tấm khoét góc chữ L, vách khấu, hậu 2 mặt --- */
    const TU_KHAU = Object.assign({}, TU_2000, { ma: 'TK1', khau: { trai: { rong: 300, sau: 200 }, phai: { rong: 0, sau: 0 }, ho: 10 } });
    await page.evaluate(s => window.MNCF.app.setSpec(s), TU_KHAU);
    await H.locator('.tab[data-tab="tu"]').click();
    ok(/Nhìn từ trên xuống/.test(await H.locator('.elev').innerHTML().catch(() => H.locator('.panel').innerHTML())), 'có khấu cột → hình có thêm mặt nhìn từ trên xuống');
    await H.locator('#mncf-ui-useat').check(); await H.locator('#mncf-ui-ax').fill('40000');
    await H.locator('[data-act="draw"]').click();
    await page.waitForFunction(() => { const L = window.MNCFDriver.last; return L && L.offset && L.offset[0] === 40000; }, null, { timeout: 30000 });
    await H.locator('.report .msg').first().waitFor({ timeout: 30000 });
    const kh = await page.evaluate(() => { const D = window.MNCFDriver, a = D.last.added.filter(D.isBoard);
      const L = a.filter(b => b.dinh && b.dinh.length === 6);
      return { chuL: L.map(b => b.Name).sort(), vach: a.filter(b => b.Name === 'Vách khấu cột').map(b => D.boxOf(b)), hauK: a.filter(b => b.Name === 'Hậu khấu cột').map(b => [b.Thickness].concat(D.boxOf(b))),
        hoi: a.filter(b => b.Name === 'Hồi trái').map(b => D.boxOf(b)), bao: D.last.report && D.last.report.errors }; });
    const rk = await H.locator('.report').innerText();
    ok(/Đã vẽ xong/.test(rk) && !/chưa có góc khoét/.test(rk) && !/va chạm|chồng lên/i.test(rk), 'tủ khấu cột vẽ xong, đối chiếu không báo thiếu khoét / va chạm giả', rk);
    ok(kh.chuL.length >= 2 && kh.chuL.includes('Đáy') && kh.chuL.includes('Nóc'), 'đáy, nóc (và đợt vướng cột) vào Chenfeng là tấm chữ L 6 đỉnh', kh.chuL);
    ok(kh.vach.length === 2 && kh.vach.every(v => v[0] === 40310 && v[3] === 591.5) && kh.hauK.length === 2 && kh.hauK.every(h => h[0] === 17.5 && h[1] === 40067.5 && h[2] === 40310 && h[3] === 370 && h[4] === 387.5), 'mỗi thùng (dưới + trên) có 1 vách khấu dọc mặt bên cột + hậu khấu bằng VÁN THÙNG 17,5 trước mặt cột, lọt giữa hồi và vách khấu', [kh.vach, kh.hauK]);
    ok(kh.hoi.length === 2 && kh.hoi.every(h => Math.abs((h[3] - h[2]) - (580 - 210)) < 0.6), 'hồi bên cột ngắn lại, chạy tới mặt sau hậu khấu: sâu tủ − (cột + hở) = 370', kh.hoi);
    // Chenfeng (giả lập) dựng tấm chữ nhật, bỏ mất góc khoét → đối chiếu phải nêu ra
    await H.locator('[data-act="undo"]').click();
    await page.waitForFunction(() => /Đã hoàn tác/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 15000 });
    await page.evaluate(() => { window.__MOCK_BO_KHOET__ = true; });
    await H.locator('.tab[data-tab="tu"]').click();
    await H.locator('#mncf-ui-ax').fill('50000');
    await H.locator('[data-act="draw"]').click();
    await page.waitForFunction(() => { const L = window.MNCFDriver.last; return L && L.offset && L.offset[0] === 50000; }, null, { timeout: 30000 });
    await H.locator('.report .msg').first().waitFor({ timeout: 30000 });
    ok(/chưa có góc khoét khấu cột/.test(await H.locator('.report').innerText()), 'Chenfeng dựng tấm chữ nhật (mất góc khoét) → báo cáo nêu rõ', await H.locator('.report').innerText());
    await page.evaluate(() => { window.__MOCK_BO_KHOET__ = false; });
    await H.locator('[data-act="undo"]').click();
    await page.waitForFunction(() => /Đã hoàn tác/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 15000 });
    // bản 1.14: cột GIỮA tủ — đáy / nóc / đợt khoét chữ U (8 đỉnh), 2 vách khấu; đổi Rộng bằng tham số module thì vùng khoét đứng yên so với mép trái
    const TU_GIUA = Object.assign({}, TU_2000, { ma: 'TG1', khau: { trai: { rong: 0, sau: 0 }, phai: { rong: 0, sau: 0 }, giua: [{ cach: 350, rong: 250, sau: 200 }], ho: 10 } });
    await page.evaluate(s => window.MNCF.app.setSpec(s), TU_GIUA);
    await H.locator('.tab[data-tab="tu"]').click();
    await H.locator('#mncf-ui-ax').fill('70000');
    await H.locator('[data-act="draw"]').click();
    await page.waitForFunction(() => { const L = window.MNCFDriver.last; return L && L.offset && L.offset[0] === 70000; }, null, { timeout: 30000 });
    await H.locator('.report .msg').first().waitFor({ timeout: 30000 });
    const kg = await page.evaluate(() => { const D = window.MNCFDriver, a = D.last.added.filter(D.isBoard), U = a.filter(b => b.dinh && b.dinh.length === 8), T = a.find(D.tagOf).Template.Object;
      return { chuU: U.map(b => b.Name).sort(), dinh: U[0] && U[0].dinh.map(q => [q[0] - 70000, q[1] - 17.5]), vach: a.filter(b => b.Name === 'Vách khấu cột').map(b => D.boxOf(b).slice(0, 4)), hauK: a.filter(b => b.Name === 'Hậu khấu cột').map(b => D.boxOf(b).slice(0, 4)),
        L: T.GetParam('L').actions.map(x => x.Expr + ':s' + x.EntityStretchPointMap.length).sort() }; });
    const rg = await H.locator('.report').innerText();
    ok(/Đã vẽ xong/.test(rg) && !/chưa có góc khoét/.test(rg) && !/va chạm|chồng lên/i.test(rg), 'tủ có cột giữa vẽ xong, đối chiếu sạch', rg);
    ok(kg.chuU.length >= 4 && kg.chuU.includes('Đáy') && kg.chuU.includes('Nóc') && kg.chuU.includes('Đợt'), 'đáy, nóc, đợt của khoang có cột là tấm chữ U 8 đỉnh', kg.chuU);
    ok(kg.dinh && kg.dinh.some(q => Math.abs(q[0] - 322.5) < 0.6 && Math.abs(q[1] - 352.5) < 0.6) && kg.dinh.some(q => Math.abs(q[0] - 627.5) < 0.6 && Math.abs(q[1] - 352.5) < 0.6), 'góc lõm chữ U đúng chỗ: x 322,5 và 627,5 (mặt ngoài 2 vách khấu), sâu 352,5 (mặt trước hậu khấu ván thùng)', kg.dinh);
    ok(kg.vach.length === 4 && kg.hauK.length === 2 && kg.hauK.every(h => h[0] === 70340 && h[1] === 70610), '2 thân × 2 vách khấu; hậu khấu trước mặt cột 340 … 610', [kg.vach, kg.hauK]);
    await H.locator('[data-act="undo"]').click();
    await page.waitForFunction(() => /Đã hoàn tác/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 15000 });
    await page.evaluate(s => window.MNCF.app.setSpec(s), TU_2000);

    /* --- bản 1.23 — TẤM TRƯỚC, MẪU SAU (anh Jason 04/10/2026 22:57: "vẽ tủ vẫn trục trặc, làm sao phải liên kết máy chủ, vẽ bằng những cái có sẵn đi").
     *     Phần tấm của tủ không cần máy chủ → nhập trước, lúc nào cũng vẽ được. Hộp ngăn kéo / suốt treo là mẫu trong kho (Chenfeng tải TỪNG mẫu từ máy chủ, hỏng một mẫu là huỷ cả lệnh)
     *     → thêm sau bằng lệnh riêng; hỏng thì thêm từng mẫu, thử lại; mẫu nào vẫn hỏng thì chỉ thiếu đúng mẫu đó và báo rõ vì sao. --- */
    {
      const ve = (spec, at, opt) => page.evaluate(async ([s, a, o]) => {
        window.__MOCK_NHAP__ = []; window.__MOCK_MAU_TAI__ = []; window.__MOCK_TU_CHOI__ = 0;
        const r = await window.MNCF.draw(s, Object.assign({ at: a }, o || {})), D = window.MNCFDriver, k = r.kiem_tra || {};
        const pk = D.last && r.giai_doan === 'xong' ? D.last.added.filter(D.isHardware).map(e => [e.HardwareOption.name].concat(D.boxOf(e).map(v => Math.round(v * 10) / 10))) : [];
        // chỗ suốt treo PHẢI nằm theo thiết kế (công thức của mẫu trong trang giả lập: thanh suốt chạy hết bề rộng hộp mẫu, giữa chiều sâu, dưới mặt trên hộp JS + 15)
        const M = window.MNCFCore.build(s), muon = M.templates.filter(t => t.id && t.loai === 'SUOT').map(t => { const zc = t.pos[2] + t.box[2] - t.params.JS - 15; return ['衣杆', t.pos[0] + a[0], t.pos[0] + t.box[0] + a[0], t.pos[1] + t.box[1] / 2 - 7.5 + a[1], t.pos[1] + t.box[1] / 2 + 7.5 + a[1], zc - 15 + a[2], zc + 15 + a[2]].map(v => (typeof v === 'number' ? Math.round(v * 10) / 10 : v)); });
        return { ok: r.ok, giai_doan: r.giai_doan, errors: r.errors, warnings: r.warnings, thieu: (r.mau_thieu || []).map(t => [t.loai, t.khoang, t.ly_do]), khop: k.so_tam_khop, tk: k.so_tam_thiet_ke, tam_mau: k.so_tam_mau, pk: k.phu_kien || {}, lech: k.mat_ngan_keo_lech || [],
          module: !!(r.module && r.module.ok), goc_cf: !!r.goc_cf, nhap: window.__MOCK_NHAP__.map(x => [x.tam, x.mau.length, x.ket]), tai: window.__MOCK_MAU_TAI__.slice(), suot: pk.filter(x => x[0] === '衣杆'), muon_suot: muon, so_lo: k.so_lo, tu_choi: window.__MOCK_TU_CHOI__ || 0 };
      }, [spec, at, opt || null]);
      const TU_K = Object.assign({}, TU_KHAU, { ma: 'TK2' });      // tủ khấu cột → đi đường nhập tấm
      const NK = 20216239, ST = 20650931;
      // 1. mạng tốt: đúng 2 lệnh nhập — tấm (không kèm mẫu nào), rồi cả 4 mẫu trong một lệnh; mẫu nằm đúng chỗ thiết kế dù lệnh đó không có tấm nào để làm mốc
      let r = await ve(TU_K, [90000, 0, 0]);
      ok(r.ok && r.nhap.length === 2 && r.nhap[0][0] > 40 && r.nhap[0][1] === 0 && r.nhap[0][2] === 'ok' && JSON.stringify(r.nhap[1]) === '[0,4,"ok"]', 'vẽ tủ: lệnh 1 chỉ có tấm (không cần máy chủ), lệnh 2 thêm cả 4 mẫu ngăn kéo / suốt treo', r.nhap);
      ok(r.khop === r.tk && r.thieu.length === 0 && r.lech.length === 0 && r.pk['三节轨'] === 2 && r.pk['衣杆'] === 2 && r.tam_mau === 12, 'đủ tấm, đủ 2 hộp ngăn kéo + 2 suốt treo; mặt ngăn kéo đúng chỗ thiết kế', [r.khop, r.tk, r.pk, r.lech, r.tam_mau]);
      ok(r.suot.length === 2 && JSON.stringify(r.suot.slice().sort()) === JSON.stringify(r.muon_suot.slice().sort()), 'suốt treo nằm đúng chỗ thiết kế (lệnh chỉ có mẫu: bảng tính điểm đặt từ khung của mẫu)', [r.suot, r.muon_suot]);
      ok(r.module && r.so_lo > 0, 'tủ vẫn gom thành module, vẫn khoan lỗ như trước', [r.module, r.so_lo]);
      const lo1 = r.so_lo;
      // 2. máy chủ rớt MỘT lần lúc tải mẫu ngăn kéo: lệnh thêm cả cụm bị Chenfeng huỷ → bảng thêm từng mẫu, mẫu nào cũng xong; người dùng không phải làm gì
      await page.evaluate(id => { window.__MOCK_MAU_LOI__ = { [id]: { lan: 1, kieu: 'may_chu' } }; }, NK);
      r = await ve(TU_K, [100000, 0, 0]);
      ok(r.ok && r.thieu.length === 0 && r.pk['三节轨'] === 2 && r.pk['衣杆'] === 2 && r.lech.length === 0 && r.so_lo === lo1, 'máy chủ rớt một lần: tủ vẫn đủ ngăn kéo + suốt treo, số lỗ khoan như lần vẽ suôn sẻ', [r.thieu, r.pk, r.so_lo, lo1]);
      ok(JSON.stringify(r.nhap.map(x => x[2])) === '["ok","loi","ok","ok","ok","ok"]' && r.nhap.slice(2).every(x => x[0] === 0 && x[1] === 1), '… lệnh cả cụm hỏng → 4 lệnh, mỗi lệnh một mẫu', r.nhap);
      ok(JSON.stringify(r.suot.slice().sort()) === JSON.stringify(r.muon_suot.slice().sort()), '… từng mẫu thêm riêng vẫn nằm đúng chỗ', [r.suot, r.muon_suot]);
      // 3. máy chủ KHÔNG trả mẫu suốt treo (thử mấy lần vẫn hỏng): tủ vẫn vẽ đủ tấm + ngăn kéo, chỉ thiếu suốt treo — báo rõ, không còn "Chưa vẽ được"
      await page.evaluate(id => { window.__MOCK_MAU_LOI__ = { [id]: { lan: 99, kieu: 'may_chu' } }; }, ST);
      r = await ve(TU_K, [110000, 0, 0]);
      ok(r.giai_doan === 'xong' && r.ok && r.khop === r.tk && r.pk['三节轨'] === 2 && !r.pk['衣杆'] && r.lech.length === 0, 'máy chủ không trả mẫu suốt treo: tủ vẫn đủ tấm + ngăn kéo', [r.ok, r.errors, r.khop, r.tk, r.pk]);
      ok(JSON.stringify(r.thieu) === '[["SUOT",0,"may_chu"],["SUOT",1,"may_chu"]]', '… ghi rõ thiếu 2 suốt treo vì máy chủ', r.thieu);
      ok(r.warnings.some(w => /Chưa thêm được 2 suốt treo \(khoang 1, khoang 2\)/.test(w) && /máy chủ Chenfeng không trả mẫu/.test(w) && /Cập nhật tủ này/.test(w)) && !r.warnings.some(w => /Không thấy phụ kiện nào|đặt mặt khác thiết kế/.test(w)), '… một dòng báo nói rõ thiếu gì, vì sao, làm gì tiếp; không kèm cảnh báo lạc đề', r.warnings);
      ok(r.tai.filter(id => id === ST).length === 4 && r.tai.filter(id => id === NK).length === 2, '… suốt treo: thử ở lệnh cả cụm + thử riêng từng cái 2 lần rồi thôi (không thử mãi); ngăn kéo tải đúng 2 lần', r.tai);
      // 4. mã mẫu ngăn kéo KHÔNG thuộc tài khoản đang đăng nhập (Chenfeng báo 鉴权失败): không thử lại mã đó; dò theo TÊN mẫu trong kho của tài khoản → dùng mẫu cùng tên
      const soApi = api.length;
      await page.evaluate(() => { window.__MOCK_MAU_LOI__ = { 777001: { lan: 99, kieu: 'tk' } }; window.MNCFDriver.quenMauLoi && window.MNCFDriver.quenMauLoi(); });
      r = await ve(Object.assign({}, TU_K, { ngan_keo: { mau_id: 777001 } }), [120000, 0, 0]);
      ok(r.ok && r.thieu.length === 0 && r.pk['三节轨'] === 2 && r.pk['衣杆'] === 2 && r.lech.length === 0, 'mã mẫu không thuộc tài khoản: bảng tự tìm mẫu cùng tên trong kho của tài khoản và dùng nó — tủ vẫn đủ ngăn kéo', [r.thieu, r.pk, r.warnings]);
      ok(r.warnings.some(w => /mã mẫu 777001/.test(w) && /không thuộc kho mẫu của tài khoản Chenfeng đang đăng nhập/.test(w) && /đã dùng mẫu cùng tên của tài khoản này \(mã 555001\)/.test(w) && /Dò mã mẫu từ kho Chenfeng/.test(w)), '… báo rõ đã đổi sang mã nào, nhắc bấm "Dò mã mẫu" để lưu lại', r.warnings);
      ok(r.tai.filter(id => id === 777001).length === 2 && r.tai.filter(id => id === 555001).length === 2, '… mã lạ chỉ bị thử ở lệnh cả cụm + 1 lần riêng (không thử lại mã không phải của mình); 2 ngăn kéo tải bằng mã của tài khoản', r.tai);
      ok(api.length === soApi + 2 && api[soApi][0] === '/CAD-dirQuery' && api[soApi + 1][0] === '/CAD-moduleList', '… chỉ ĐỌC kho mẫu (thư mục + danh sách) đúng một lượt', api.slice(soApi));
      // 4b. máy chủ rớt hai lần rồi mới trả lời "mã không thuộc tài khoản" (ở lần thử lại): tìm được mẫu cùng tên thì vẫn phải thêm bằng mẫu đó — không vì đã hết lượt thử của mã cũ mà bỏ hộp ngăn kéo này
      await page.evaluate(() => { window.__MOCK_MAU_LOI__ = { 777003: { lan: 3, kieu: ['may_chu', 'may_chu', 'tk'] } }; window.MNCFDriver.quenMauLoi(); });
      r = await ve(Object.assign({}, TU_K, { ngan_keo: { mau_id: 777003 } }), [125000, 0, 0]);
      ok(r.ok && r.thieu.length === 0 && r.pk['三节轨'] === 2 && r.pk['衣杆'] === 2 && r.lech.length === 0, 'máy chủ rớt 2 lần rồi mới báo mã không thuộc tài khoản: cả 2 hộp ngăn kéo vẫn được thêm bằng mẫu cùng tên', [r.thieu, r.pk, r.tai]);
      ok(r.tai.filter(id => id === 777003).length === 3 && r.tai.filter(id => id === 555001).length === 2, '… mã lạ tải 3 lần (cả cụm, riêng, thử lại) rồi chuyển hẳn sang mã của tài khoản', r.tai);
      // 5. tài khoản không có mẫu nào cùng tên: thiếu ngăn kéo, nói rõ vì mã mẫu không phải của tài khoản này
      await page.evaluate(() => { window.__MOCK_MAU_LOI__ = { 777002: { lan: 99, kieu: 'tk' } }; });
      r = await ve(Object.assign({}, TU_K, { ngan_keo: { mau_id: 777002, ten_mau: '别人的抽屉' } }), [130000, 0, 0]);
      ok(r.ok && r.khop === r.tk && JSON.stringify(r.thieu) === '[["NGAN_KEO",1,"khong_thuoc_tk"],["NGAN_KEO",1,"khong_thuoc_tk"]]' && r.pk['衣杆'] === 2, 'tài khoản không có mẫu cùng tên: tủ đủ tấm + suốt treo, thiếu 2 hộp ngăn kéo', [r.thieu, r.pk]);
      ok(r.lech.length === 0 && !r.warnings.some(w => /đặt mặt khác thiết kế|Không thấy phụ kiện nào/.test(w)), '… phép đối chiếu không đòi mặt ngăn kéo của hộp chưa thêm được (không báo "mặt ngăn kéo lệch")', [r.lech, r.warnings]);
      ok(r.warnings.some(w => /Chưa thêm được 2 hộp ngăn kéo \(khoang 2\)/.test(w) && /mã mẫu 777002 \(别人的抽屉\)/.test(w) && /không thuộc kho mẫu của tài khoản Chenfeng đang đăng nhập/.test(w) && /Dò mã mẫu từ kho Chenfeng/.test(w)), '… báo rõ mã mẫu nào không phải của tài khoản, chỉ chỗ sửa', r.warnings);
      ok(r.tai.filter(id => id === 777002).length === 2, '… mã không phải của mình: không thử đi thử lại', r.tai);
      // 6. máy chủ TREO (không trả lời): bảng chờ có hạn theo TIẾN TRIỂN (Chenfeng dựng thêm được mẫu nào thì còn chờ tiếp); đứng im quá hạn thì thôi thêm mẫu — tủ vẫn đủ tấm.
      //    Đo trên Chenfeng thật 05/10/2026: Esc lúc Chenfeng đang tải mẫu không có tác dụng — lệnh nhập cũ vẫn chạy ngầm, máy chủ trả lời thì Chenfeng hỏi điểm đặt. Bảng không chồng thêm lệnh nào
      //    lên lệnh đang treo, và canh để huỷ nó khi nó hiện lời hỏi (không để cụm mẫu bám theo chuột).
      await page.evaluate(() => { window.__MOCK_MAU_LOI__ = null; window.__MOCK_TEMPLATE_DELAY__ = 1200; });
      r = await ve(TU_K, [140000, 0, 0], { cho_mau: 500 });
      ok(r.giai_doan === 'xong' && r.ok && r.khop === r.tk && r.thieu.length === 4 && r.thieu.every(t => t[2] === 'may_chu') && r.nhap.length === 2, 'máy chủ treo: tủ đủ tấm; thiếu cả 4 mẫu; sau lệnh thêm mẫu bị treo bảng không gửi thêm lệnh nhập nào', [r.giai_doan, r.ok, r.khop, r.tk, r.thieu, r.nhap]);
      ok(r.warnings.some(w => /Chưa thêm được 2 hộp ngăn kéo \(khoang 2\), 2 suốt treo \(khoang 1, khoang 2\)/.test(w) && /máy chủ Chenfeng không trả lời/.test(w)), '… báo rõ thiếu gì, vì máy chủ không trả lời', r.warnings);
      await page.waitForTimeout(6500);
      const tre = await page.evaluate(() => { const D = window.MNCFDriver; return { ban: D.busy(), nhap: window.__MOCK_NHAP__.map(x => x.ket), sot: D.all().filter(e => !D.last.added.includes(e) && e.box && e.box[0] > 139000 && e.box[0] < 143000).length }; });
      await page.evaluate(() => { window.__MOCK_TEMPLATE_DELAY__ = 0; });
      ok(!tre.ban && tre.sot === 0 && JSON.stringify(tre.nhap) === '["ok","huy"]', '… lệnh nhập cũ trả lời trễ được bảng huỷ gọn: Chenfeng không đứng chờ điểm đặt, không sót đối tượng', tre);
      ok(r.tu_choi === 0, '… trong lúc lệnh cũ còn chạy ngầm bảng không gửi lệnh nhập nào để Chenfeng phải từ chối', r.tu_choi);
      // 6b. máy chủ treo LÂU hơn bảng chịu chờ (lệnh cũ vẫn chạy ngầm khi lần vẽ kết thúc): bảng không chạy khoan lại / gom module lên trên lệnh đang treo, nói rõ; về sau lệnh cũ hiện lời hỏi điểm thì vẫn được huỷ gọn
      await page.evaluate(() => { window.__MOCK_TEMPLATE_DELAY__ = 1200; });
      r = await ve(TU_K, [147500, 0, 0], { cho_mau: 500, cho_tre: 300 });
      ok(r.giai_doan === 'xong' && r.ok && r.khop === r.tk && r.thieu.length === 4 && !r.module && r.tu_choi === 0, 'máy chủ treo lâu: tủ đủ tấm, chưa gom module, không gửi lệnh nào lên trên lệnh đang treo', [r.giai_doan, r.ok, r.khop, r.tk, r.thieu.length, r.module, r.tu_choi]);
      ok(r.warnings.some(w => /Chenfeng còn đang chờ máy chủ nên chưa nhận lệnh nào khác/.test(w) && /Cập nhật tủ này/.test(w)) && !r.warnings.some(w => /Không gọi được lệnh khoan lại|Chưa gom được tủ/.test(w)), '… báo rõ vì sao chưa khoan lại / chưa gom module và phải làm gì; không kèm lời báo lỗi của các lệnh không chạy', r.warnings);
      await page.waitForTimeout(6500);
      const tre2 = await page.evaluate(() => { const D = window.MNCFDriver; return { ban: D.busy(), nhap: window.__MOCK_NHAP__.map(x => x.ket), sot: D.all().filter(e => !D.last.added.includes(e) && e.box && e.box[0] > 147000 && e.box[0] < 149900).length }; });
      ok(!tre2.ban && tre2.sot === 0 && JSON.stringify(tre2.nhap) === '["ok","huy"]', '… lệnh cũ về sau hiện lời hỏi điểm: bảng huỷ nó, Chenfeng không đứng chờ, không sót đối tượng', tre2);
      await page.evaluate(() => { window.__MOCK_TEMPLATE_DELAY__ = 0; });
      // máy chủ CHẬM nhưng vẫn trả lời (mỗi mẫu lâu hơn hạn chờ một chút thì đã hỏng; ở đây mỗi mẫu 300 ms < hạn 500 ms, cả lệnh 1,2 giây > hạn): còn tiến triển thì còn chờ → đủ mẫu
      await page.evaluate(() => { window.__MOCK_TEMPLATE_DELAY__ = 300; });
      r = await ve(TU_K, [145000, 0, 0], { cho_mau: 500 });
      await page.evaluate(() => { window.__MOCK_TEMPLATE_DELAY__ = 0; });
      ok(r.ok && r.thieu.length === 0 && r.pk['三节轨'] === 2 && r.pk['衣杆'] === 2 && r.nhap.length === 2, 'máy chủ chậm nhưng vẫn trả lời từng mẫu: bảng chờ theo tiến triển, đủ ngăn kéo + suốt treo', [r.thieu, r.pk, r.nhap]);
      // 7. máy chủ rớt với CẢ HAI loại mẫu: thử riêng 2 mẫu đầu (mỗi mẫu đã thử lại một lần) vẫn hỏng thì thôi — không bắt người dùng ngồi chờ thử nốt từng mẫu còn lại
      await page.evaluate(([a, b]) => { window.__MOCK_MAU_LOI__ = { [a]: { lan: 99, kieu: 'may_chu' }, [b]: { lan: 99, kieu: 'may_chu' } }; }, [NK, ST]);
      r = await ve(TU_K, [150000, 0, 0]);
      ok(r.giai_doan === 'xong' && r.ok && r.khop === r.tk && r.thieu.length === 4 && r.thieu.every(t => t[2] === 'may_chu'), 'máy chủ rớt với mọi mẫu: tủ vẫn đủ tấm, thiếu cả 4 mẫu vì máy chủ', [r.giai_doan, r.ok, r.khop, r.tk, r.thieu]);
      ok(r.tai.filter(id => id === ST).length === 3 && r.tai.filter(id => id === NK).length === 2, '… hỏng liền 2 mẫu thì thôi: lệnh cả cụm (1 lần tải) + 2 mẫu đầu thử riêng mỗi mẫu 2 lần; 2 mẫu còn lại không gửi lên máy chủ nữa', r.tai);
      // 8. (phòng xa — không phải điều đã đo) bản Chenfeng đổi cách đặt cụm mẫu → mẫu rơi lệch chỗ thiết kế: bảng bỏ ngay lệnh đó (không để ngăn kéo nằm sai trong tủ),
      //    thử riêng một mẫu vẫn lệch thì thôi hẳn, báo đúng lý do chứ không đổ cho máy chủ
      await page.evaluate(() => { window.__MOCK_MAU_LOI__ = null; window.__MOCK_MAU_LECH__ = [40, 0, 0]; });
      r = await ve(TU_K, [155000, 0, 0]);
      await page.evaluate(() => { window.__MOCK_MAU_LECH__ = null; });
      ok(r.giai_doan === 'xong' && r.ok && r.khop === r.tk && r.thieu.length === 4 && r.thieu.every(t => t[2] === 'lech') && !r.pk['三节轨'] && !r.pk['衣杆'], 'mẫu bị Chenfeng đặt lệch: tủ đủ tấm, không giữ lại mẫu nào nằm sai chỗ', [r.giai_doan, r.ok, r.errors, r.khop, r.tk, r.thieu, r.pk]);
      ok(JSON.stringify(r.nhap.map(x => [x[1], x[2]])) === '[[0,"ok"],[4,"ok"],[1,"ok"]]', '… lệnh cả cụm lệch → thử riêng MỘT mẫu, vẫn lệch thì thôi (không thử cả 4, không thử lại)', r.nhap);
      ok(r.warnings.some(w => /Chưa thêm được 2 hộp ngăn kéo \(khoang 2\), 2 suốt treo \(khoang 1, khoang 2\)/.test(w) && /đặt mẫu lệch chỗ thiết kế/.test(w) && !/máy chủ Chenfeng không trả/.test(w)), '… báo đúng lý do (đặt lệch), không đổ cho máy chủ', r.warnings);
      const sot8 = await page.evaluate(() => { const D = window.MNCFDriver, trong = e => e.box && e.box[0] > 154000 && e.box[0] < 158500; return [D.all().filter(e => D.isHardware(e) && trong(e)).length, D.all().filter(e => D.isBoard(e) && !D.tagOf(e) && trong(e)).length, D.busy()]; });
      ok(JSON.stringify(sot8) === '[0,0,false]', '… các mẫu đặt lệch đã được bỏ khỏi bản vẽ, Chenfeng không còn lệnh dở', sot8);
      const ht8 = await page.evaluate(async () => { const D = window.MNCFDriver, r0 = await D.undoLast(); return [r0.ok, D.all().filter(e => e.box && e.box[0] > 154000 && e.box[0] < 158500).length]; });
      ok(JSON.stringify(ht8) === '[true,0]', '… hoàn tác lần vẽ đó vẫn sạch (các lệnh thêm mẫu đã bỏ không làm lệch số bước)', ht8);
      // (Tủ vẽ bằng lệnh gốc — D.veGoc — dùng chung đúng hàm thêm mẫu này cho phần tấm rời; trang giả lập không có lệnh gốc nên phần đó thử trên Chenfeng thật.)
      // thẻ Kết quả: thiếu mẫu thì dòng đầu nói rõ + có nút vẽ lại kèm ngăn kéo / suốt treo
      await page.evaluate(id => { window.__MOCK_MAU_LOI__ = { [id]: { lan: 99, kieu: 'may_chu' } }; }, ST);
      await page.evaluate(s => window.MNCF.app.setSpec(s), Object.assign({}, TU_KHAU, { ma: 'TK8' }));
      await H.locator('.tab[data-tab="tu"]').click();
      await H.locator('#mncf-ui-useat').check(); await H.locator('#mncf-ui-ax').fill('160000');
      await H.locator('[data-act="draw"]').click();
      await page.waitForFunction(() => { const L = window.MNCFDriver.last; return L && L.offset && L.offset[0] === 160000; }, null, { timeout: 60000 });
      await H.locator('.report .msg').first().waitFor({ timeout: 30000 });
      const bc = await H.locator('.report').innerText();
      ok(/Đã vẽ xong phần tấm — \d+\/\d+ tấm đúng vị trí, \d+ lỗ khoan; còn thiếu 2 suốt treo/.test(bc) && (await H.locator('.report [data-act="redraw"]').count()) === 1 && /Vẽ lại tủ này kèm ngăn kéo \/ suốt treo/.test(await H.locator('.report [data-act="redraw"]').innerText()), 'thẻ Kết quả: dòng đầu nói rõ còn thiếu gì, có nút vẽ lại kèm ngăn kéo / suốt treo', bc.slice(0, 500));
      await page.evaluate(() => { window.__MOCK_MAU_LOI__ = null; });
      await H.locator('.report [data-act="redraw"]').click();
      await page.waitForFunction(() => /Đã cập nhật tủ tại chỗ/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.report').innerText), null, { timeout: 60000 });
      const bc2 = await H.locator('.report').innerText(), pk2 = await page.evaluate(() => { const D = window.MNCFDriver; return D.last.added.filter(D.isHardware).map(e => e.HardwareOption.name).sort().join(); });
      ok(/Đã cập nhật tủ tại chỗ — /.test(bc2) && !/còn thiếu/.test(bc2) && pk2 === '三节轨,三节轨,衣托,衣托,衣杆,衣杆', 'mạng ổn lại, bấm nút: tủ vẽ lại tại chỗ, đủ ngăn kéo + suốt treo', [bc2.slice(0, 200), pk2]);
      await H.locator('[data-act="undo"]').click();
      await page.waitForFunction(() => /Đã hoàn tác/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 15000 });
      await page.evaluate(s => window.MNCF.app.setSpec(s), TU_2000);
    }

    /* --- thiết kế lỗi → nút vẽ khoá --- */
    await H.locator('.tab[data-tab="tu"]').click();
    await H.locator('#mncf-b1-dot').fill('500, 510'); await H.locator('#mncf-b1-dot').blur();
    ok(await H.locator('[data-act="draw"]').isDisabled(), 'thiết kế lỗi → khoá nút vẽ');

    /* --- bảng rộng --- */
    await H.locator('[data-act="wide"]').click();
    ok(await H.locator('.panel.wide').count() === 1 && /Thu hẹp/.test(await H.locator('[data-act="wide"]').innerText()), 'nút Mở rộng / Thu hẹp');

    /* --- ghi chú tham số mẫu hiện bằng tiếng Việt (chỉ đổi chữ hiển thị) --- */
    await page.evaluate(() => {
      const mk = (cls, hd, rows) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = '<ul><li class="' + hd + '"><span>Parameter Name</span><span>Parameter Value</span><span>备注</span><span>Expression</span></li>' + rows.map(r => '<li><span>' + r[0] + '</span><span>' + r[1] + '</span><span>' + r[2] + '</span><div><input></div></li>').join('') + '</ul>'; document.body.appendChild(d); return d; };
      const tp = mk('template-detail', 'x', []); tp.querySelector('ul').remove();
      const inner = mk('template-params', 'template-params-header', [['L', 1200, '宽'], ['BH', 17.5, '板厚'], ['ZS', 0, '左前缩'], ['PX', 0, ''], ['Q', 1, '右门内缩'], ['K', 1, '未知字符串'], ['V', 1, 'Rộng']]); tp.appendChild(inner);
      const kho = mk('template-detail', 'template-detail-header', [['GDK', 21, '轨道宽'], ['LC', 0, '拉出']]); kho.id = 'kho';
      const khac = document.createElement('div'); khac.id = 'khac'; khac.innerHTML = '<ul><li><span>a</span><span>b</span><span>板厚</span></li></ul>'; document.body.appendChild(khac);
    });
    await page.waitForFunction(() => document.querySelector('.template-params li:nth-child(3) span:nth-child(3)').textContent === 'Dày ván', null, { timeout: 5000 });
    const gc = () => page.evaluate(() => [...document.querySelectorAll('.template-params li')].map(li => li.children[2].textContent));
    ok(JSON.stringify(await gc()) === JSON.stringify(['备注', 'Rộng', 'Dày ván', 'Hồi trái lùi trước', '', '~Cánh phải lùi vào', '未知字符串', 'Rộng']), 'bảng tham số bên phải: ghi chú hiện tiếng Việt, dòng tiêu đề / chữ lạ / ô trống giữ nguyên', await gc());
    ok(JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('#kho li')].map(li => li.children[2].textContent))) === JSON.stringify(['备注', 'Rộng ray', 'Kéo ra']), 'bảng tham số trong Kho mẫu cũng được dịch');
    ok((await page.evaluate(() => { const s = document.querySelector('.template-params li:nth-child(3) span:nth-child(3)'); return [s.title, s.getAttribute('data-mncf-goc'), s.childNodes.length]; })).join('|') === '板厚 → Dày ván|板厚|1', 'rê chuột xem được chữ gốc; vẫn là một nút chữ');
    ok((await page.evaluate(() => document.querySelector('#khac span:nth-child(3)').textContent)) === '板厚' && (await page.evaluate(() => document.querySelector('.template-params li:nth-child(3) span:nth-child(2)').textContent)) === '17.5', 'không đụng chữ ở chỗ khác, không đụng cột giá trị');
    // Chenfeng ghi chữ mới vào ô (đổi sang mẫu khác) → dịch lại; ghi chữ không phải tiếng Trung → bỏ chú thích cũ
    await page.evaluate(() => { const li = document.querySelectorAll('.template-params li'); li[2].children[2].firstChild.nodeValue = '背板厚'; li[1].children[2].firstChild.nodeValue = 'Width'; });
    await page.waitForFunction(() => document.querySelector('.template-params li:nth-child(3) span:nth-child(3)').textContent === 'Dày hậu', null, { timeout: 5000 });
    ok((await page.evaluate(() => { const li = document.querySelectorAll('.template-params li'); return [li[2].children[2].getAttribute('data-mncf-goc'), li[1].children[2].textContent, li[1].children[2].hasAttribute('data-mncf-goc'), li[1].children[2].title]; })).join('|') === '背板厚|Width|false|', 'ô bị ghi chữ mới → dịch lại, chú thích cũ được gỡ');
    // nút tắt / bật ở tab Hướng dẫn
    await H.locator('.tab[data-tab="hd"]').click();
    ok(/Tắt dịch ghi chú/.test(await H.locator('[data-act="dich"]').innerText()), 'tab Hướng dẫn có nút Tắt dịch ghi chú');
    await H.locator('[data-act="dich"]').click();
    ok(JSON.stringify((await gc()).slice(2, 4)) === JSON.stringify(['背板厚', '左前缩']) && (await page.evaluate(() => [localStorage.getItem('mncf.dich'), document.querySelectorAll('[data-mncf-goc]').length].join('|'))) === '0|0' && /Bật dịch ghi chú/.test(await H.locator('[data-act="dich"]').innerText()), 'tắt → trả lại chữ gốc, ghi nhớ lựa chọn', await gc());
    await H.locator('[data-act="dich"]').click();
    ok(JSON.stringify((await gc()).slice(2, 4)) === JSON.stringify(['Dày hậu', 'Hồi trái lùi trước']) && (await page.evaluate(() => localStorage.getItem('mncf.dich'))) === null, 'bật lại → dịch lại');
    await H.locator('.tab[data-tab="tu"]').click();

    /* --- /help không chạy --- */
    const p2 = await ctx.newPage(); await p2.goto('https://cfcad.cn/help/'); await p2.waitForTimeout(800);
    ok((await p2.evaluate(() => typeof window.MNCF)) === 'undefined', 'không nạp vào trang trợ giúp /help');
    ok(errs.length === 0, 'không có lỗi JS lọt ra trang', errs);
  } catch (e) { fail++; console.log('  ✗ ném lỗi:', e && e.stack || e); }
  await ctx.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* bỏ qua */ }
  console.log(`\n${pass} đạt, ${fail} hỏng`);
  process.exit(fail ? 1 : 0);
})();
