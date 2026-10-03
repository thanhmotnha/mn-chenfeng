'use strict';
// Kiểm tra thẻ "Phòng" (bản 1.8): trang độc lập + tiện ích trên trang GIẢ LẬP Chenfeng.
//   NODE_PATH=<node_modules có playwright> PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node test/phong-ui.test.js
const path = require('path'), fs = require('fs'), os = require('os');
const { chromium } = require('playwright');
const DIST = path.join(__dirname, '..', 'dist'), EXT = path.join(DIST, 'extension');
const MOCK = fs.readFileSync(path.join(__dirname, 'mock-chenfeng.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) pass++; else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); } };
const eq1 = (a, b, name) => ok(JSON.stringify(a) === JSON.stringify(b), name, { co: a, can: b });
const PHONG = { ten: 'Phòng ngủ 1', cao: 2700, tuong: [{ dai: 3600 }, { dai: 3000 }, { dai: 3600 }, { dai: 'auto' }], mo: [{ tuong: 2, loai: 'cua', cach: 200, rong: 900, cao: 2200 }],
  khung: [{ ten: 'K1', tuong: 0, cach: 500, rong: 2000, cao: 2700, sau: 600 }, { ten: 'K2', tuong: 1, cach: 700, rong: 1000, cao: 2400, sau: 550 }] };
const anhGia = () => new Promise(r => { const c = document.createElement('canvas'); c.width = 300; c.height = 200; const x = c.getContext('2d'); x.fillStyle = '#c9b79c'; x.fillRect(0, 0, 300, 200); c.toBlob(b => r(b), 'image/jpeg', 0.8); });

async function trangDocLap(browser) {
  console.log('— Trang độc lập: thẻ Phòng');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  // địa chỉ http giả để localStorage / IndexedDB chạy ổn định (file:// thất thường)
  const html = fs.readFileSync(path.join(DIST, 'mn-chenfeng.html'), 'utf8');
  await page.route('http://mn.test/**', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
  await page.goto('http://mn.test/');
  await page.waitForFunction(() => window.MNCF && window.MNCF.app && window.MNCF.app.getModel());
  const H = page.locator('#mncf-host'), st = () => H.locator('.status').textContent(), sum = () => H.locator('.psum').innerText(), msgs = () => H.locator('.pmsgs').innerText();
  const P = () => page.evaluate(() => window.MNCF.phong.lay());
  const go = async (sel, v) => { await H.locator(sel).fill(v); await page.waitForTimeout(260); };

  ok(await H.locator('.tab[data-tab="phong"]').isVisible(), 'có thẻ Phòng');
  await H.locator('.tab[data-tab="phong"]').click();
  ok((await H.locator('.pmb [data-tuong]').count()) === 4 && /4 tường · chu vi 13,2 m · diện tích 10,8 m² · trần 2700/.test(await sum()), 'phòng mẫu: mặt bằng 4 tường, có tóm tắt', await sum());
  ok(/Mặt đứng tường A/.test(await H.locator('.pmd svg').getAttribute('aria-label')), 'mặt đứng tường đang chọn (A)');
  ok((await H.locator('[data-p="tuong.3.dai"]').getAttribute('placeholder')) === 'tự tính: 3000' && (await H.locator('[data-p="tuong.3.dai"]').inputValue()) === '', 'tường D để trống, ghi số tự tính');
  ok(!(await H.locator('footer [data-act="json"]').first().isVisible()), 'ở thẻ Phòng: ẩn các nút của thẻ Tủ ở chân bảng');

  // gõ số: phòng hở → báo; sửa lại → khép
  await go('[data-p="tuong.0.dai"]', '4000');
  ok(/chưa khép kín: điểm cuối cách điểm đầu 400 mm/.test(await msgs()) && /hở 400/.test(await H.locator('.pmb').innerHTML()), 'A = 4000, C = 3600 → báo hở 400 và vẽ khe hở', await msgs());
  await go('[data-p="tuong.2.dai"]', '4000');
  ok((await msgs()).trim() === '' && /diện tích 12 m²/.test(await sum()), 'C = 4000 → khép kín, diện tích 12 m²', [await msgs(), await sum()]);
  await go('[data-p="cao"]', '2,8');
  ok((await P()).cao === 2.8, 'gõ số kiểu Việt (dấu phẩy)'); await go('[data-p="cao"]', '2700');

  // bấm tường trên mặt bằng → mặt đứng đổi
  await H.locator('.pmb [data-tuong="1"]').click({ force: true });
  ok(/Mặt đứng tường B/.test(await H.locator('.pmd svg').getAttribute('aria-label')), 'bấm tường B trên mặt bằng → mặt đứng tường B');

  // thêm / bỏ tường
  await H.locator('[data-act="t-add"]').click();
  let p = await P();
  ok(p.tuong.length === 5 && p.tuong[4].dai === 'auto' && p.tuong[3].dai === 3000 && new Set(p.tuong.map(t => t.ten)).size === 5, 'thêm tường: chèn trước tường tự tính, tên không trùng', p.tuong);
  await H.locator('.prow[data-ti="3"] [data-act="t-del"]').click();
  ok((await P()).tuong.length === 4, 'bỏ tường');
  await H.locator('[data-p="tuong.1.re"]').selectOption('khac');
  ok((await H.locator('input[data-p="tuong.1.re"]').count()) === 1, 'góc khác…: hiện ô gõ góc rẽ');
  await go('input[data-p="tuong.1.re"]', '80');
  ok(/tổng các góc rẽ là 350°/.test(await msgs()), 'góc rẽ 80 → báo tổng góc', await msgs());
  await go('input[data-p="tuong.1.re"]', '90');

  // cửa, dầm
  await H.locator('.pmb [data-tuong="0"]').click({ force: true });
  await H.locator('[data-act="m-add"]').click(); await H.locator('[data-act="c-add"][data-v="dam"]').click();
  p = await P();
  ok(p.mo.length === 2 && p.mo[1].tuong === 0 && p.can.length === 1 && p.can[0].loai === 'dam' && p.can[0].rong === 4000 && p.can[0].z0 === 2350, 'thêm cửa + dầm ở tường đang chọn (dầm chạy hết tường, đáy dầm = trần − 350)', [p.mo, p.can]);
  await H.locator('[data-p="mo.1.loai"]').selectOption('cua_so');
  ok(/Cửa sổ 2/.test(await H.locator('.pcard[data-mj="1"] .ph').innerText()), 'đổi loại → tên thẻ đổi');
  await H.locator('.pcard[data-mj="1"] [data-act="m-del"]').click();

  // khung
  await H.locator('[data-act="k-add"]').click();
  p = await P();
  ok(p.khung.length === 1 && p.khung[0].rong === 4000 && p.khung[0].cao === 2700 && p.khung[0].tuong === 0, 'thêm khung: kín tường đang chọn, cao tới trần', p.khung);
  ok(/Khung K1 vướng dầm 1/.test(await msgs()), 'khung vướng dầm → cảnh báo', await msgs());
  await go('[data-p="khung.0.cao"]', '2350'); await go('[data-p="khung.0.rong"]', '2400');
  ok(!/vướng/.test(await msgs()) && /Tường A · góc trái–trước–dưới của tủ tại 0; -600; 0/.test(await H.locator('.pcard[data-kj="0"] .kinfo').innerText()), 'hạ khung dưới dầm → hết cảnh báo; ghi vị trí đặt tủ', [await msgs(), await H.locator('.pcard[data-kj="0"] .kinfo').innerText()]);
  await H.locator('[data-act="k-add"]').click();
  p = await P();
  ok(p.khung[1].cach === 2400 && p.khung[1].rong === 1600, 'khung thứ hai: lấp phần tường còn trống bên phải', p.khung[1]);
  ok((await H.locator('.pmb [data-khung]').count()) === 2 && (await H.locator('.pmd [data-khung]').count()) === 2, 'khung hiện trên mặt bằng và mặt đứng');
  await H.locator('.pmb [data-khung="0"]').click({ force: true });
  ok(/\bon\b/.test(await H.locator('.pcard[data-kj="0"]').getAttribute('class')), 'bấm khung trên mặt bằng → thẻ khung sáng lên');
  ok(!(await H.locator('[data-act="k-ve"]').count()) && !(await H.locator('[data-act="p-ve"]').count()), 'trang độc lập không có nút vẽ vào Chenfeng');

  // mở thành tủ
  await H.locator('.pcard[data-kj="0"] [data-act="k-mo"]').click();
  const sp = await page.evaluate(() => window.MNCF.app.getSpec()), M = await page.evaluate(() => { const m = window.MNCF.app.getModel(), b = window.MNCF.core.bbox(m.parts); return { e: m.errors, kt: [b.x1 - b.x0, Math.round((b.y1 - b.y0) * 10) / 10, b.z1 - b.z0] }; });
  ok(sp.rong === 2400 && sp.cao === 2350 && sp.ma === 'K1' && sp.than.cao_duoi === 0 && M.e.length === 0 && JSON.stringify(M.kt) === '[2400,600,2350]', 'Mở thành tủ: phủ bì = khung 2400 × 600 × 2350, một thân, không lỗi', [sp.rong, sp.cao, sp.ma, M]);
  ok(/\bon\b/.test(await H.locator('.tab[data-tab="tu"]').getAttribute('class')) && /Đã mở khung K1 thành tủ 2400 × 2350, sâu 600/.test(await st()), 'chuyển sang thẻ Tủ, có thông báo', await st());
  ok(await H.locator('footer [data-act="json"]').first().isVisible(), 'về thẻ Tủ: nút chân bảng hiện lại');

  // bản 1.12 — gõ số đo ngay trên mặt bằng / mặt đứng
  await H.locator('.tab[data-tab="phong"]').click();
  await page.evaluate(() => window.MNCF.phong.dat({ ten: 'Phòng thử', cao: 2700, tuong: [{ dai: 3600 }, { dai: 3000 }, { dai: 3600 }, { dai: 'auto' }], mo: [{ tuong: 2, loai: 'cua', cach: 200, rong: 900, cao: 2200 }] }));
  await H.locator('.pmb [data-sua="tuong.1.dai"]').click();
  ok(await H.locator('.pdim').isVisible() && (await H.locator('.pdim').inputValue()) === '3000', 'bấm số đo tường B trên mặt bằng → ô nhập hiện ngay đó, sẵn số cũ');
  ok(/stroke-opacity="0"/.test(await H.locator('.pmb [data-tuong="1"]').evaluate(e => e.outerHTML)) && (await H.locator('.pmd').innerText()).includes('Tường B'), 'tường đang sửa được chọn (mặt đứng đổi sang tường B)');
  await H.locator('.pdim').fill('3250'); await H.locator('.pdim').press('Enter');
  p = await P();
  ok(p.tuong[1].dai === 3250 && !(await H.locator('.pdim').count()) && (await H.locator('[data-p="tuong.1.dai"]').inputValue()) === '3250' && /Đã sửa tường B: 3250/.test(await st()), 'Enter: tường B = 3250, ô dưới form đổi theo', [p.tuong[1], await st()]);
  ok(/>3250 \(tự tính\)</.test(await H.locator('.pmb').innerHTML()), 'tường D tự tính lại theo');
  await H.locator('.pmb [data-sua="mo.0.cach"]').click(); await H.locator('.pdim').fill('650'); await H.locator('.pdim').press('Enter');
  await H.locator('.pmb [data-sua="mo.0.rong"]').click(); await H.locator('.pdim').fill('800'); await H.locator('.pdim').press('Enter');
  p = await P();
  ok(p.mo[0].cach === 650 && p.mo[0].rong === 800, 'sửa cách trái + rộng cửa ngay trên hình', p.mo[0]);
  await H.locator('.pmb [data-sua="tuong.0.dai"]').click(); await H.locator('.pdim').fill('4000'); await H.locator('.pdim').press('Escape');
  ok((await P()).tuong[0].dai === 3600 && !(await H.locator('.pdim').count()), 'Esc: bỏ, giữ số cũ');
  await H.locator('.pmb [data-sua="tuong.0.dai"]').click(); await H.locator('.pdim').fill('abc'); await H.locator('.pdim').press('Enter');
  ok((await P()).tuong[0].dai === 3600 && /không hợp lệ/.test(await st()), 'gõ chữ: báo, giữ số cũ');
  await H.locator('.pmb [data-sua="tuong.0.dai"]').click(); await H.locator('.pdim').fill(''); await H.locator('.pdim').press('Enter');
  p = await P();
  ok(p.tuong[0].dai === 'auto' && p.tuong[3].dai === 3250 && p.tuong.filter(t => t.dai === 'auto').length === 1, 'xoá trống số đo tường A → A tự tính, tường tự tính cũ (D) nhận số đang hiện', p.tuong);
  await H.locator('.pmd [data-sua="cao"]').click(); await H.locator('.pdim').fill('2650'); await H.locator('.pdim').press('Enter');
  ok((await P()).cao === 2650, 'sửa cao trần trên mặt đứng');
  await H.locator('[data-p="tuong.2.dai"]').focus(); await page.waitForTimeout(100);
  ok((await H.locator('.pmd').innerText()).includes('Tường C'), 'đưa con trỏ vào dòng tường C ở form → mặt bằng tô tường C, mặt đứng đổi theo');

  // dán mã phòng, chép mã, phòng mẫu
  await H.locator('.tab[data-tab="phong"]').click();
  await H.locator('[data-act="p-dan"]').click(); await H.locator('.pma').fill('mã đây: ' + JSON.stringify(PHONG)); await H.locator('[data-act="p-dan-ok"]').click();
  p = await P();
  ok(p.ten === 'Phòng ngủ 1' && p.khung.length === 2 && p.mo.length === 1 && /Đã dùng mã phòng/.test(await st()), 'dán mã phòng');
  ok(/xoay -90°/.test(await H.locator('.pcard[data-kj="1"] .kinfo').innerText()), 'khung ở tường B: ghi góc xoay −90°', await H.locator('.pcard[data-kj="1"] .kinfo').innerText());
  await H.locator('[data-act="p-dan"]').click(); await H.locator('.pma').fill('không phải mã'); await H.locator('[data-act="p-dan-ok"]').click();
  ok(/Không đọc được mã phòng/.test(await st()) && (await P()).ten === 'Phòng ngủ 1', 'mã hỏng: báo, phòng giữ nguyên');
  ok(JSON.parse(await page.evaluate(() => localStorage.getItem('mncf.phong.v1'))).ten === 'Phòng ngủ 1', 'phòng tự lưu trong máy');

  // ảnh hiện trạng
  const n1 = await page.evaluate(async (src) => { const mk = new Function('return (' + src + ')()'); const b = await mk(); return window.MNCF.phong.themAnh([new File([b], 'tuong-A.jpg', { type: 'image/jpeg' }), new File([b], 'tuong-B.jpg', { type: 'image/jpeg' }), new File(['x'], 'ghi-chu.txt', { type: 'text/plain' })]); }, anhGia.toString());
  ok(n1 === 2 && (await H.locator('.thumb').count()) === 2, 'thêm ảnh: nhận 2 ảnh, bỏ file không phải ảnh');
  await H.locator('.thumb .im').first().click();
  ok(await H.locator('.xem').isVisible() && /tuong-A\.jpg \(1\/2\)/.test(await H.locator('.xemh span').innerText()), 'bấm ảnh → xem to');
  await H.locator('[data-act="xem-sau"]').click();
  ok(/tuong-B\.jpg \(2\/2\)/.test(await H.locator('.xemh span').innerText()), 'chuyển ảnh sau');
  await H.locator('.xemb img').click(); ok(/\bto\b/.test(await H.locator('.xemb').getAttribute('class')), 'bấm ảnh → phóng to');
  await H.locator('[data-act="xem-dong"]').click(); ok(!(await H.locator('.xem').isVisible()), 'đóng ảnh');
  await H.locator('.thumb [data-act="anh-xoa"]').first().click();
  ok((await H.locator('.thumb').count()) === 1, 'bỏ 1 ảnh');
  // tải lại trang: phòng + ảnh còn nguyên
  await page.reload(); await page.waitForFunction(() => window.MNCF && window.MNCF.app && window.MNCF.app.getModel());
  await H.locator('.tab[data-tab="phong"]').click();
  await page.waitForFunction(() => document.getElementById('mncf-host').shadowRoot.querySelectorAll('.thumb').length === 1, null, { timeout: 5000 }).catch(() => {});
  ok((await P()).ten === 'Phòng ngủ 1' && (await H.locator('.thumb').count()) === 1, 'tải lại trang: phòng và ảnh còn nguyên', [(await P()).ten, await H.locator('.thumb').count()]);
  await H.locator('[data-act="p-mau"]').click();
  ok((await P()).khung.length === 0 && (await P()).tuong.length === 4, 'Phòng mẫu: về phòng 3600 × 3000');
  ok((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0, 'không tràn ngang');
  // màn hình hẹp (điện thoại)
  await page.setViewportSize({ width: 400, height: 800 }); await page.waitForTimeout(300);
  ok((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0, 'rộng 400: không tràn ngang');
  ok(errs.length === 0, 'không có lỗi JS', errs);
  await ctx.close();
}

async function tienIch() {
  console.log('— Tiện ích trên trang giả lập Chenfeng: vẽ tủ vào khung');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mncf-ph-'));
  const ctx = await chromium.launchPersistentContext(dir, { channel: 'chromium', headless: true, viewport: { width: 1500, height: 900 }, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  try {
    await ctx.route('https://api.cfcad.cn/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"err_code":1,"err_msg":"no"}' }));
    await ctx.route('https://cfcad.cn/**', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: MOCK }));
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
    await page.goto('https://cfcad.cn/');
    await page.waitForFunction(() => window.MNCF && window.MNCF.app, null, { timeout: 15000 });
    const H = page.locator('#mncf-host'), st = () => H.locator('.status').textContent();
    await H.locator('.launch').click(); await H.locator('.tab[data-tab="phong"]').click();
    await page.evaluate(p => window.MNCF.phong.dat(Object.assign(p, { goc: [10000, 2000, 0] })), PHONG);
    ok((await H.locator('[data-act="k-ve"]').count()) === 2 && !(await H.locator('footer [data-act="draw"]').isVisible()) && await H.locator('[data-act="p-ve"]').isVisible(), 'trong Chenfeng: mỗi khung có nút "Vẽ tủ vào khung", có nút "Vẽ phòng vào Chenfeng"; nút vẽ của thẻ Tủ ẩn');

    // thả ảnh vào bảng: Chenfeng (document) không được nhận sự kiện thả
    await page.evaluate(() => { window.__tha = 0; document.addEventListener('drop', () => window.__tha++, true); document.addEventListener('drop', () => window.__tha++); });
    await page.evaluate(async (src) => {
      const b = await (new Function('return (' + src + ')()'))(), dt = new DataTransfer(); dt.items.add(new File([b], 'tha.jpg', { type: 'image/jpeg' }));
      const el = document.getElementById('mncf-host').shadowRoot.querySelector('.drop');
      el.dispatchEvent(new DragEvent('dragover', { bubbles: true, composed: true, cancelable: true, dataTransfer: dt }));
      el.dispatchEvent(new DragEvent('drop', { bubbles: true, composed: true, cancelable: true, dataTransfer: dt }));
    }, anhGia.toString());
    await page.waitForFunction(() => document.getElementById('mncf-host').shadowRoot.querySelectorAll('.thumb').length === 1, null, { timeout: 5000 }).catch(() => {});
    ok((await H.locator('.thumb').count()) === 1 && (await page.evaluate(() => window.__tha)) === 0, 'thả ảnh vào bảng: bảng nhận ảnh, sự kiện thả không lọt tới Chenfeng', await page.evaluate(() => window.__tha));

    // vẽ khung K1 (tường A, không xoay)
    await H.locator('.pcard[data-kj="0"] [data-act="k-ve"]').click();
    await H.locator('.report .msg').first().waitFor({ timeout: 40000 });
    let r = await page.evaluate(() => { const D = window.MNCFDriver, a = D.last.added.filter(D.isBoard).map(D.boxOf), mn = i => Math.min(...a.map(b => b[i])), mx = i => Math.max(...a.map(b => b[i])); return { hop: [mn(0), mx(1), mn(2), mx(3), mn(4), mx(5)], n: a.length, id: D.last.id }; });
    ok(JSON.stringify(r.hop) === JSON.stringify([10500, 12500, 1400, 2000, 0, 2700]), 'tủ K1 nằm đúng khung: x 10500…12500, y 1400…2000 (lưng sát tường A), z 0…2700', r.hop);
    ok(/Đã vẽ xong/.test(await H.locator('.report').innerText()), 'báo cáo: đã vẽ xong', (await H.locator('.report').innerText()).slice(0, 200));
    const p1 = await page.evaluate(() => window.MNCF.phong.lay());
    ok(p1.khung[0].tu_id === r.id && !p1.khung[1].tu_id, 'khung K1 ghi nhớ mã tủ đã vẽ');
    await H.locator('.tab[data-tab="phong"]').click();
    ok(/đã vẽ/.test(await H.locator('.pcard[data-kj="0"] .kinfo').innerText()), 'thẻ khung ghi "đã vẽ"');

    // vẽ khung K2 (tường B): vẽ xong tự xoay −90° quanh góc trái–trước, tủ nằm đúng khung
    await H.locator('.pcard[data-kj="1"] [data-act="k-ve"]').click();
    await page.waitForFunction(() => /Đã xoay tủ/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.report').innerText), null, { timeout: 40000 }).catch(() => {});
    ok(/Đã xoay tủ -90° theo tường B — tủ nằm đúng khung/.test(await H.locator('.report').innerText()), 'khung ở tường B: báo đã xoay −90°', (await H.locator('.report').innerText()).slice(0, 300));
    r = await page.evaluate(() => { const D = window.MNCFDriver, a = D.last.added.filter(e => !e.IsErase && D.isBoard(e)).map(D.boxOf), mn = i => Math.min(...a.map(b => b[i])), mx = i => Math.max(...a.map(b => b[i])); return { hop: [mn(0), mx(1), mn(2), mx(3), mn(4), mx(5)].map(v => Math.round(v * 10) / 10), rot: window.__MOCK_ROTATE__, steps: D.last.steps, n: D.last.added.length }; });
    ok(JSON.stringify(r.hop) === JSON.stringify([13050, 13600, 300, 1300, 0, 2400]), 'tủ K2 sau khi xoay: lưng sát tường B (x = 13600), chiếm y 300…1300, sâu 550', r.hop);
    ok(r.rot && r.rot.length === 1 && r.rot[0].do === -90 && JSON.stringify(r.rot[0].goc) === JSON.stringify([13050, 1300, 0]) && r.rot[0].n === r.n, 'lệnh ROTATE: xoay TẤT CẢ đối tượng của tủ, −90° quanh góc trái–trước', r.rot);
    ok(!(await H.locator('.tunoi').isVisible()), 'tủ đã xoay: bảng không nối để "Cập nhật tủ này"');
    const soTruoc = await page.evaluate(() => window.__MOCK__.ents.filter(e => !e.IsErase).length);
    await H.locator('[data-act="undo"]').click();
    await page.waitForFunction(() => /Đã hoàn tác/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 15000 }).catch(() => {});
    const conLai = await page.evaluate(() => window.MNCFDriver.last);
    ok(/Đã hoàn tác lần vẽ vừa rồi/.test(await st()) && conLai === null && (await page.evaluate(() => window.__MOCK__.ents.filter(e => !e.IsErase).length)) < soTruoc, 'Hoàn tác lần vẽ: lùi cả bước xoay lẫn bước vẽ', await st());

    // Mở thành tủ rồi bấm nút vẽ của thẻ Tủ: cũng đặt đúng khung và tự xoay
    await H.locator('.tab[data-tab="phong"]').click();
    await H.locator('.pcard[data-kj="1"] [data-act="k-mo"]').click();
    ok(/tủ tự xoay -90° theo tường B/.test(await st()) && (await H.locator('#mncf-ui-useat').isChecked()) && (await H.locator('#mncf-ui-ax').inputValue()) === '13050', 'Mở thành tủ: điền toạ độ khung, báo sẽ tự xoay', await st());
    await H.locator('[data-act="draw"]').click();
    await page.waitForFunction(() => /Đã xoay tủ/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.report').innerText), null, { timeout: 40000 }).catch(() => {});
    ok((await page.evaluate(() => (window.__MOCK_ROTATE__ || []).length)) === 2, 'vẽ từ thẻ Tủ sau "Mở thành tủ": tự xoay');
    await H.locator('#mncf-ui-ax').fill('500');
    await H.locator('[data-act="draw"]').click();
    await page.waitForFunction(() => window.MNCFDriver.last && Math.abs(window.MNCFDriver.last.offset[0] - 500) < 1 && /Đã vẽ xong/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 40000 }).catch(() => {});
    ok((await page.evaluate(() => (window.__MOCK_ROTATE__ || []).length)) === 2 && (await page.evaluate(() => Math.abs(window.MNCFDriver.last.offset[0] - 500) < 1)), 'đổi toạ độ rồi vẽ: không xoay nữa (không còn là vị trí khung)');

    // vẽ phòng: tường, cửa, cột, dầm bằng lệnh phòng của Chenfeng
    await H.locator('.tab[data-tab="phong"]').click();
    await page.evaluate(p => window.MNCF.phong.dat(Object.assign({}, p, { goc: [20000, 0, 0], day: 220, khung: [], mo: [{ tuong: 2, loai: 'cua', cach: 200, rong: 900, cao: 2200 }, { tuong: 1, loai: 'cua_so', cach: 400, rong: 1200, cao: 1300, be: 900 }],
      can: [{ tuong: 0, loai: 'cot', cach: 0, rong: 220, nho: 300, z0: 0, z1: 2700 }, { tuong: 1, loai: 'hop', cach: 2000, rong: 400, nho: 250, z0: 0, z1: 2700 }, { tuong: 0, loai: 'dam', cach: 0, rong: 3600, nho: 250, z0: 2350, z1: 2700 }] })), PHONG);
    ok((await H.locator('[data-p="day"]').inputValue()) === '220' && await H.locator('[data-act="p-hoantac"]').isDisabled(), 'có ô dày tường; nút hoàn tác phòng đang khoá');
    const n0 = await page.evaluate(() => window.__MOCK__.ents.filter(e => !e.IsErase).length);
    await H.locator('[data-act="p-ve"]').click();
    await page.waitForFunction(() => document.getElementById('mncf-host').shadowRoot.querySelector('.pkq .msg'), null, { timeout: 40000 });
    const kq = await H.locator('.pkq').innerText();
    ok(/Đã vẽ phòng: 4 tường, 2 cửa \/ ô trống, 2 cột \/ hộp, 1 dầm/.test(kq), 'báo kết quả vẽ phòng', kq);
    const ph = await page.evaluate(() => { const M = window.__MOCK__, ds = c => M.ents.filter(e => e instanceof c && !e.IsErase).map(e => e.box.map(v => Math.round(v * 10) / 10)); return { tuong: ds(M.RoomWallLine), lo: M.ents.filter(e => e instanceof M.RoomHolePolyline && !e.IsErase).map(e => [e.tam, e.cfg]), cot: ds(M.RoomPillar), dam: ds(M.RoomGirder), day: M.ents.find(e => e instanceof M.RoomWallLine).day, inp: window.__MOCK_INPUTS__.slice(-40) }; });
    ok(JSON.stringify(ph.tuong) === JSON.stringify([[20000, 23600, 0, 220, 0, 2700], [23600, 23820, -3000, 0, 0, 2700], [20000, 23600, -3220, -3000, 0, 2700], [19780, 20000, -3000, 0, 0, 2700]]), 'tường: đi theo chiều kim đồng hồ, bề dày 220 nằm NGOÀI lòng phòng, cao 2700', ph.tuong);
    ok(JSON.stringify(ph.lo) === JSON.stringify([[[22950, -3000, 0], { H: 2200, L: 900, D: 0 }], [[23600, -1000, 0], { H: 1300, L: 1200, D: 900 }]]), 'lỗ cửa: tâm lỗ trên mép trong của tường, đúng cao / rộng / bệ', ph.lo);
    ok(JSON.stringify(ph.cot) === JSON.stringify([[20000, 20220, -300, 0, 0, 2700], [23350, 23600, -2400, -2000, 0, 2700]]), 'cột: tường A dài theo x; hộp ở tường B đổi chiều (dài theo y)', ph.cot);
    ok(JSON.stringify(ph.dam) === JSON.stringify([[20000, 23600, -250, 0, 2350, 2700]]), 'dầm: chạy dọc tường A, nhô 250 vào phòng, +2350 → +2700', ph.dam);
    ok(/Đã vẽ phòng vào Chenfeng/.test(await st()) && !(await H.locator('[data-act="p-hoantac"]').isDisabled()), 'xong: nút hoàn tác phòng mở');
    eq1(await page.evaluate(() => window.__MOCK__.ents.filter(e => e instanceof window.__MOCK__.RoomRegion && !e.IsErase).map(e => e.Nhan)), ['Phong ngu 1 m²'], 'vùng phòng của Chenfeng mang tên phòng (không dấu) — không còn nhãn 未命名');
    await H.locator('[data-act="p-hoantac"]').click();
    await page.waitForFunction(() => /Đã bỏ phòng/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 15000 }).catch(() => {});
    ok((await page.evaluate(() => window.__MOCK__.ents.filter(e => !e.IsErase).length)) === n0 && /Đã bỏ phòng vừa vẽ/.test(await st()), 'Hoàn tác phòng: bản vẽ về như trước', await st());
    // dầm bị Chenfeng ép cao độ (đỉnh dầm không vượt trần của Chenfeng) → báo rõ
    await page.evaluate(p => { window.__MOCK_TRAN__ = 2600; window.MNCF.phong.dat(Object.assign({}, p, { khung: [], mo: [], can: [{ tuong: 0, loai: 'dam', cach: 0, rong: 3600, nho: 250, z0: 2350, z1: 2700 }] })); }, PHONG);
    await H.locator('[data-act="p-ve"]').click();
    await page.waitForFunction(() => /Chenfeng đặt dầm/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.pkq').innerText), null, { timeout: 40000 }).catch(() => {});
    ok(/Dầm 1: Chenfeng đặt dầm ở cao độ \+2250 → \+2600 \(muốn \+2350 → \+2700\)/.test(await H.locator('.pkq').innerText()), 'dầm lệch cao độ: có cảnh báo', await H.locator('.pkq').innerText());

    // phòng còn lỗi thì không vẽ
    await H.locator('.tab[data-tab="phong"]').click();
    await page.evaluate(p => window.MNCF.phong.dat(Object.assign(p, { khung: [{ ten: 'K1', tuong: 0, cach: 2500, rong: 2000, cao: 2700, sau: 600 }] })), PHONG);
    ok(await H.locator('.pcard[data-kj="0"] [data-act="k-ve"]').isDisabled() && /vượt ra ngoài tường A/.test(await H.locator('.pmsgs').innerText()), 'khung vượt tường: nút vẽ bị khoá, có báo lỗi');
    ok(errs.length === 0, 'không có lỗi JS lọt ra trang', errs);
  } catch (e) { fail++; console.log('  ✗ ném lỗi:', e && e.stack || e); }
  await ctx.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* bỏ qua */ }
}

(async () => {
  const browser = await chromium.launch();
  try { await trangDocLap(browser); } catch (e) { fail++; console.log('  ✗ ném lỗi:', e && e.stack || e); }
  await browser.close();
  await tienIch();
  console.log(`\n${pass} đạt, ${fail} hỏng`);
  process.exit(fail ? 1 : 0);
})();
