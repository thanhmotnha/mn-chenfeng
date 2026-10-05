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
  eq1(await H.locator('.pdo').count(), 0, 'trang độc lập (không nằm trong Chenfeng): không có khối "Phòng đã đo" — trang này không gọi máy chủ nào');

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
  // bản 1.18 — ĐIỆN – NƯỚC: thêm điểm, gõ số đo, đổi loại, sửa ngay trên mặt đứng, bấm dấu trên mặt bằng, khung che điểm, mở thành tủ
  const tieuDiem = () => page.evaluate(() => { const a = document.getElementById('mncf-host').shadowRoot.activeElement; return a && a.dataset ? a.dataset.p || '' : ''; });
  await H.locator('.pmb [data-tuong="0"]').click({ force: true });
  ok((await H.locator('[data-act="d-add"]').count()) === 7 && (await H.locator('.drow').count()) === 0, 'thẻ Phòng có khung Điện – nước với 7 nút thêm, chưa có điểm nào');
  await H.locator('[data-act="d-add"][data-v="o_dien"]').click();
  p = await P();
  ok(p.dn.length === 1 && JSON.stringify(p.dn[0]) === '{"tuong":0,"loai":"o_dien","cach":500,"cao":300}' && (await tieuDiem()) === 'dn.0.cach', '+ Ổ điện: điểm mới trên tường đang chọn (A), cách trái 500, cao +300; con trỏ vào ô "cách trái"', [p.dn, await tieuDiem()]);
  await go('[data-p="dn.0.cach"]', '950');
  ok((await P()).dn[0].cach === 950 && (await H.locator('.pmb [data-dn="0"]').count()) === 1 && /Ổ1 \+300/.test(await H.locator('.pmd').innerHTML()) && /Điện – nước: 1 ổ điện/.test(await sum()), 'gõ cách trái 950: mặt bằng có dấu, mặt đứng tường A có "Ổ1 +300", tóm tắt đếm 1 ổ điện', await sum());
  await H.locator('[data-act="d-add"][data-v="o_dien"]').click();
  ok((await P()).dn[1].cach === 1250, 'thêm ổ thứ hai cùng tường: tự cách ổ trước 300 (khỏi chồng lên nhau trên hình)', (await P()).dn);
  await H.locator('[data-p="dn.1.loai"]').selectOption('cong_tac');
  p = await P();
  ok(p.dn[1].loai === 'cong_tac' && p.dn[1].cao === 1250, 'đổi loại sang Công tắc: cao độ còn là số điền sẵn (300) → theo loại mới (1250)', p.dn[1]);
  await go('[data-p="dn.1.cao"]', '1400');
  await H.locator('[data-p="dn.1.loai"]').selectOption('cap_nuoc');
  p = await P();
  ok(p.dn[1].loai === 'cap_nuoc' && p.dn[1].cao === 1400, 'đã gõ cao độ riêng (1400) rồi đổi loại: giữ số đã gõ', p.dn[1]);
  await H.locator('[data-act="d-add"][data-v="khac"]').click();
  ok(await H.locator('.drow[data-dj="2"] .dkhac').isVisible() && !(await H.locator('.drow[data-dj="0"] .dkhac').count()), '"Điểm khác": có thêm dòng tên + cỡ ô (các loại khác không có)');
  await H.locator('[data-p="dn.2.ghi"]').fill('Tủ điện'); await H.locator('[data-p="dn.2.rong"]').fill('300'); await go('[data-p="dn.2.cao_o"]', '200');
  p = await P();
  ok(p.dn[2].ghi === 'Tủ điện' && p.dn[2].rong === 300 && p.dn[2].cao_o === 200 && /<title>Tủ điện 1: tường A/.test(await H.locator('.pmb').innerHTML()), 'điểm khác: tên + cỡ ô vào mô hình, hình ghi tên đó', p.dn[2]);
  await H.locator('[data-act="d-add"][data-v="thoat_san"]').click();
  p = await P();
  ok(p.dn[3].loai === 'thoat_san' && p.dn[3].ra === 300 && p.dn[3].cao === undefined && (await H.locator('[data-p="dn.3.ra"]').count()) === 1 && !(await H.locator('[data-p="dn.3.cao"]').count())
    && JSON.stringify(await H.locator('[data-p="dn.3.loai"] option').evaluateAll(os => os.map(o => o.value))) === '["thoat_san","ong_san"]', '+ Thoát sàn: điểm dưới sàn — cột thứ tư là "cách tường" (300), ô Loại chỉ có 2 loại dưới sàn', p.dn[3]);
  ok(JSON.stringify(await H.locator('[data-p="dn.0.loai"] option').evaluateAll(os => os.map(o => o.value))) === '["o_dien","cong_tac","cap_nuoc","thoat_nuoc","khac"]', 'điểm trên tường: ô Loại có 5 loại trên tường');
  // sửa ngay trên mặt đứng
  await H.locator('.pmd [data-sua="dn.0.cao"]').click();
  ok(await H.locator('.pdim').isVisible() && (await H.locator('.pdim').inputValue()) === '300', 'bấm nhãn "Ổ1 +300" trên mặt đứng → ô nhập hiện ngay đó, sẵn số cũ');
  await H.locator('.pdim').fill('450'); await H.locator('.pdim').press('Enter');
  ok((await P()).dn[0].cao === 450 && /Đã sửa cao độ điểm điện – nước: 450/.test(await st()) && (await H.locator('[data-p="dn.0.cao"]').inputValue()) === '450', 'Enter: cao độ ổ 1 = 450, ô dưới form đổi theo', await st());
  await H.locator('.pmd [data-sua="dn.0.cach"]').click(); await H.locator('.pdim').fill('1000'); await H.locator('.pdim').press('Enter');
  await H.locator('.pmd [data-sua="dn.3.ra"]').click(); await H.locator('.pdim').fill('350'); await H.locator('.pdim').press('Enter');
  p = await P();
  ok(p.dn[0].cach === 1000 && p.dn[3].ra === 350, 'sửa cách trái của ổ và cách tường của thoát sàn ngay trên mặt đứng', [p.dn[0], p.dn[3]]);
  // bấm dấu trên mặt bằng → tới dòng của điểm đó
  await H.locator('[data-p="ten"]').focus();
  await H.locator('.pmb [data-dn="1"]').click({ force: true });
  ok((await tieuDiem()) === 'dn.1.cach', 'bấm dấu CN1 trên mặt bằng → con trỏ vào dòng của điểm đó', await tieuDiem());
  // số đo sai → lỗi đỏ
  await go('[data-p="dn.1.cach"]', '9000');
  ok(/Cấp nước 1 nằm ngoài tường A: cách đầu trái 9000 mà tường chỉ dài 3600/.test(await msgs()), 'điểm ra ngoài tường: báo lỗi', await msgs());
  await go('[data-p="dn.1.cach"]', '1340');
  // bỏ điểm; bỏ tường thì điểm trên tường đó đi theo
  await H.locator('.drow[data-dj="2"] [data-act="d-del"]').click();
  p = await P();
  ok(p.dn.length === 3 && p.dn.map(d => d.loai).join() === 'o_dien,cap_nuoc,thoat_san', 'bỏ một điểm', p.dn);
  await page.evaluate(() => { const q = window.MNCF.phong.lay(); q.dn.push({ tuong: 1, loai: 'o_dien', cach: 400, cao: 300 }, { tuong: 2, loai: 'cong_tac', cach: 1300, cao: 1250 }); window.MNCF.phong.dat(q); });
  await H.locator('[data-act="t-add"]').click();      // thêm 1 tường (để còn bỏ được tường B mà phòng vẫn có tường)
  await H.locator('.prow[data-ti="1"] [data-act="t-del"]').click();
  p = await P();
  ok(p.dn.length === 4 && p.dn.map(d => d.tuong).join() === '0,0,0,1' && /Đã bỏ tường B cùng 1 cửa \/ dầm cột \/ điểm điện – nước \/ khung/.test(await st()), 'bỏ tường B: ổ trên tường B mất, công tắc của tường C dồn chỉ số theo', [p.dn, await st()]);
  // khung che điểm → báo ở thẻ Phòng; mở thành tủ → thẻ Tủ báo từng điểm và vẽ dấu lên hình đứng
  await page.evaluate(() => window.MNCF.phong.dat({ ten: 'Bếp', cao: 2700, tuong: [{ dai: 3600 }, { dai: 3000 }, { dai: 3600 }, { dai: 'auto' }],
    dn: [{ tuong: 0, loai: 'o_dien', cach: 950, cao: 300 }, { tuong: 0, loai: 'cong_tac', cach: 2300, cao: 1250 }, { tuong: 0, loai: 'thoat_san', cach: 1500, ra: 300 }, { tuong: 2, loai: 'o_dien', cach: 500, cao: 300 }],
    khung: [{ ten: 'KB', tuong: 0, cach: 0, rong: 2500, cao: 2700, sau: 600 }] }));
  ok(/Khung KB che công tắc 1/.test(await msgs()) && /Khung KB trùm lên thoát sàn 1/.test(await msgs()) && /Khung KB che 3 điểm điện – nước: ổ điện 1 sau lưng tủ — cách mép trái khung 950, cao \+300/.test(await msgs()), 'khung che điểm: thẻ Phòng báo ngay dưới mặt bằng', await msgs());
  await H.locator('.pcard[data-kj="0"] [data-act="k-mo"]').click();
  const dnTu = async () => ({ bao: await H.locator('.msgs .msg.dn').allInnerTexts(), dau: await H.locator('.view text[data-dn]').evaluateAll(es => es.map(e => e.textContent)), loi: await page.evaluate(() => window.MNCF.app.getModel().errors) });
  let dt = await dnTu();
  ok(dt.dau.join() === 'Ổ1,CT1,TS1' && dt.bao.length === 3 && dt.bao.some(t => /^Ổ điện 1/.test(t)) && dt.bao.some(t => /^Công tắc 1.*Tủ che công tắc/.test(t)) && dt.bao.some(t => /^Thoát sàn 1 nằm dưới tủ/.test(t)), 'Mở thành tủ: thẻ Tủ báo 3 điểm sau tủ + 3 dấu trên hình đứng (ổ của tường C không dính)', dt);
  // sửa tủ thì dòng báo tính lại theo tủ mới; bỏ điểm ở thẻ Phòng thì thẻ Tủ hết dấu đó
  await page.evaluate(() => { const sp = window.MNCF.app.getSpec(); sp.khoang.forEach(k => { k.o = []; }); sp.khoang[0].rong = 700; window.MNCF.app.setSpec(sp); });
  dt = await dnTu();
  ok(dt.loi.length === 0 && dt.dau.length === 3 && dt.bao.some(t => /^Ổ điện 1: sau lưng tủ, khoang 2, .*Khoét hậu khoang 2 120 × 80/.test(t)), 'sửa tủ (khoang 1 rộng 700, bỏ ngăn kéo): ổ 1 hết trúng vách, nằm gọn trong khoang 2 — ghi chỗ khoét hậu', dt);
  await H.locator('.tab[data-tab="phong"]').click();
  await H.locator('.drow[data-dj="1"] [data-act="d-del"]').click();
  await H.locator('.tab[data-tab="tu"]').click();
  dt = await dnTu();
  ok(dt.dau.join() === 'Ổ1,TS1' && dt.bao.length === 2, 'bỏ công tắc ở thẻ Phòng → về thẻ Tủ: còn 2 dấu, 2 dòng báo', dt);
  await H.locator('.tab[data-tab="phong"]').click();
  await H.locator('[data-act="p-mau"]').click();
  await H.locator('.tab[data-tab="tu"]').click();
  dt = await dnTu();
  ok(dt.dau.length === 0 && dt.bao.length === 0, 'về phòng mẫu (không có điểm): thẻ Tủ hết dấu, hết dòng báo', dt);
  await H.locator('.tab[data-tab="phong"]').click();
  ok((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0, 'có khung Điện – nước: vẫn không tràn ngang');
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
    await require('./kho-gia.js')(ctx);      // bộ nạp của tiện ích lấy bản gộp vừa dựng trong máy
    await ctx.route('https://cfcad.cn/**', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: MOCK }));
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
    await page.goto('https://cfcad.cn/');
    await page.waitForFunction(() => window.MNCF && window.MNCF.app, null, { timeout: 15000 });
    const H = page.locator('#mncf-host'), st = () => H.locator('.status').textContent();
    await H.locator('.launch').click();
    // bảng thường (chưa mở hộp nào): nút riêng của hộp chỉnh tủ / hộp chọn chỗ KHÔNG được nằm lẫn dưới chân bảng.
    // (Lỗi bản 1.23, anh Thanh chụp màn hình 05/10/2026 08:21 "giao diện rối rắm": `.frow{display:flex}` viết sau đè mất `.dlgnut{display:none}` → thừa 3 hàng nút
    //  "Vẽ vào Chenfeng / Chọn lại chỗ", "Đóng — vẽ sau", "Tiếp — chỉnh tủ rồi vẽ / Thôi" ngay ở thẻ Tủ.)
    const nutHop = () => page.evaluate(() => [...document.getElementById('mncf-host').shadowRoot.querySelectorAll('footer .dlgnut button')].filter(b => b.getClientRects().length > 0).map(b => b.dataset.act));
    eq1(await nutHop(), [], 'thẻ Tủ, không mở hộp nào: nút của hộp chỉnh tủ / hộp chọn chỗ không hiện dưới chân bảng');
    await H.locator('.tab[data-tab="phong"]').click();
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
    await page.waitForFunction(() => /Đã đặt tủ theo tường/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.report').innerText), null, { timeout: 40000 }).catch(() => {});
    ok(/Đã đặt tủ theo tường B, xoay -90° — tủ nằm đúng khung/.test(await H.locator('.report').innerText()), 'khung ở tường B: báo đã đặt theo tường, xoay −90°', (await H.locator('.report').innerText()).slice(0, 300));
    r = await page.evaluate(() => { const D = window.MNCFDriver, a = D.last.added.filter(e => !e.IsErase && D.isBoard(e)).map(D.boxOf), mn = i => Math.min(...a.map(b => b[i])), mx = i => Math.max(...a.map(b => b[i])); return { hop: [mn(0), mx(1), mn(2), mx(3), mn(4), mx(5)].map(v => Math.round(v * 10) / 10), rot: window.__MOCK_ROTATE__, steps: D.last.steps, n: D.last.added.length }; });
    ok(JSON.stringify(r.hop) === JSON.stringify([13050, 13600, 300, 1300, 0, 2400]), 'tủ K2 sau khi xoay: lưng sát tường B (x = 13600), chiếm y 300…1300, sâu 550', r.hop);
    ok(r.rot && r.rot.length === 1 && r.rot[0].do === -90 && JSON.stringify(r.rot[0].goc) === JSON.stringify([13050, 1300, 0]) && r.rot[0].n === r.n, 'lệnh ROTATE: xoay TẤT CẢ đối tượng của tủ, −90° quanh góc trái–trước', r.rot);
    ok(await H.locator('.tunoi').isVisible(), 'tủ đã xoay là module (bản 1.16): bảng vẫn nối để "Cập nhật tủ này"');
    const soTruoc = await page.evaluate(() => window.__MOCK__.ents.filter(e => !e.IsErase).length);
    await H.locator('[data-act="undo"]').click();
    await page.waitForFunction(() => /Đã hoàn tác/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 15000 }).catch(() => {});
    const conLai = await page.evaluate(() => window.MNCFDriver.last);
    ok(/Đã hoàn tác lần vẽ vừa rồi/.test(await st()) && conLai === null && (await page.evaluate(() => window.__MOCK__.ents.filter(e => !e.IsErase).length)) < soTruoc, 'Hoàn tác lần vẽ: lùi cả bước xoay lẫn bước vẽ', await st());
    const p2u = await page.evaluate(() => window.MNCF.phong.lay().khung.map(k => [k.ten, !!k.tu_id]));
    ok(JSON.stringify(p2u) === '[["K1",true],["K2",false]]', 'Hoàn tác lần vẽ khung K2: khung K2 thôi ghi "đã vẽ" (tủ đã rời bản vẽ), khung vẫn còn trong phòng; K1 vẽ trước đó vẫn "đã vẽ"', p2u);

    // Mở thành tủ rồi bấm nút vẽ của thẻ Tủ: cũng đặt đúng khung và tự xoay
    await H.locator('.tab[data-tab="phong"]').click();
    await H.locator('.pcard[data-kj="1"] [data-act="k-mo"]').click();
    ok(/tủ tự xoay -90° theo tường B/.test(await st()) && (await H.locator('#mncf-ui-useat').isChecked()) && (await H.locator('#mncf-ui-ax').inputValue()) === '13050', 'Mở thành tủ: điền toạ độ khung, báo sẽ tự xoay', await st());
    await H.locator('[data-act="draw"]').click();
    await page.waitForFunction(() => /Đã đặt tủ theo tường/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.report').innerText), null, { timeout: 40000 }).catch(() => {});
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
    /* --- bản 1.23 — VẼ LẠI PHÒNG khi phòng đã có trên bản vẽ (anh Jason 04/10/2026 23:06: "vẽ phòng hay bị … Chenfeng chỉ vẽ được 0/4 tường") --- */
    {
      const demPh = () => page.evaluate(() => { const M = window.__MOCK__, n = c => M.ents.filter(e => e instanceof c && !e.IsErase).length; return [n(M.RoomWallLine), n(M.RoomHolePolyline), n(M.RoomPillar), n(M.RoomGirder), n(M.RoomRegion)]; });
      const hopTuong = () => page.evaluate(() => { const M = window.__MOCK__; return M.ents.filter(e => e instanceof M.RoomWallLine && !e.IsErase).map(e => e.box.map(v => Math.round(v))).sort((a, b) => a[0] - b[0] || a[2] - b[2]); });
      const vePh = async nut => { await page.evaluate(() => { document.getElementById('mncf-host').shadowRoot.querySelectorAll('.pkq .msg').forEach(e => e.setAttribute('data-cu', '1')); }); await H.locator(nut || '[data-act="p-ve"]').click(); await page.waitForFunction(() => document.getElementById('mncf-host').shadowRoot.querySelector('.pkq .msg:not([data-cu])'), null, { timeout: 40000 }); await page.waitForFunction(() => !document.getElementById('mncf-host').shadowRoot.querySelector('[data-act="p-ve"]').disabled, null, { timeout: 40000 }); return H.locator('.pkq').innerText(); };
      const doiPh = fn => page.evaluate(src => { const p = window.MNCF.phong.lay(); (new Function('p', src))(p); window.MNCF.phong.dat(p); }, fn);
      const P2 = Object.assign({}, PHONG, { goc: [60000, 0, 0], day: 220, khung: [], dn: [], mo: [{ tuong: 2, loai: 'cua', cach: 200, rong: 900, cao: 2200 }, { tuong: 1, loai: 'cua_so', cach: 400, rong: 1200, cao: 1300, be: 900 }],
        can: [{ tuong: 0, loai: 'cot', cach: 0, rong: 220, nho: 300, z0: 0, z1: 2700 }, { tuong: 0, loai: 'dam', cach: 0, rong: 3600, nho: 250, z0: 2350, z1: 2700 }] });
      const nen = await demPh();
      const cong = d => nen.map((v, i) => v + d[i]);
      await page.evaluate(p => window.MNCF.phong.dat(p), P2);
      let kq2 = await vePh();
      ok(/Đã vẽ phòng: 4 tường, 2 cửa \/ ô trống, 1 cột \/ hộp, 1 dầm/.test(kq2), '(lần đầu) vẽ phòng như cũ', kq2);
      eq1(await demPh(), cong([4, 2, 1, 1, 1]), '(lần đầu) 4 tường, 2 lỗ cửa, 1 cột, 1 dầm, 1 vùng phòng');
      const ghi1 = await page.evaluate(() => window.MNCF.phong.lay().da_ve);
      ok(ghi1 && ghi1.tuong.length === 4 && ghi1.mo.length === 2 && ghi1.cot.length === 1 && ghi1.dam.length === 1 && JSON.stringify(ghi1.tuong[0]) === '[60000,0,63600,0,0,2700,220]', 'phòng ghi nhớ lần vẽ (da_ve): 4 tường, 2 lỗ, 1 cột, 1 dầm — để lần sau đối chiếu', ghi1);
      // 1. bấm Vẽ phòng lần nữa, không đổi gì → KHÔNG báo "chỉ vẽ được 0/4 tường", không vẽ chồng
      kq2 = await vePh();
      ok(/Phòng này đã có đủ trên bản vẽ \(4 tường, 2 cửa \/ ô trống, 1 cột \/ hộp, 1 dầm\) — không vẽ chồng/.test(kq2) && !/Chưa vẽ xong|chỉ vẽ được|chỉ dựng được/.test(kq2), 'vẽ lại phòng y hệt: báo phòng đã có đủ, không báo lỗi tường', kq2);
      eq1(await demPh(), cong([4, 2, 1, 1, 1]), 'vẽ lại phòng y hệt: không thêm lỗ cửa / cột / dầm chồng lên cái cũ');
      ok(!(await H.locator('[data-act="p-hoantac"]').isDisabled()) && (await page.evaluate(() => !!window.MNCFDriver.lastRoom && window.MNCFDriver.lastRoom.steps > 0)), 'lần bấm thừa không ghi đè lần vẽ thật: nút Hoàn tác phòng vẫn lùi được lần vẽ đầu');
      // 2. thêm một cột ở tường C rồi vẽ lại: chỉ vẽ thêm đúng cột đó
      await doiPh("p.can.push({ tuong: 2, loai: 'cot', cach: 1500, rong: 300, nho: 200 });");
      kq2 = await vePh();
      ok(/Đã cập nhật phòng: vẽ thêm 1 cột \/ hộp; giữ nguyên 4 tường, 2 cửa \/ ô trống, 1 cột \/ hộp, 1 dầm/.test(kq2), 'thêm cột rồi vẽ lại: chỉ vẽ thêm cột, giữ nguyên phần còn lại', kq2);
      eq1(await demPh(), cong([4, 2, 2, 1, 1]), '… bản vẽ thêm đúng 1 cột');
      // 3. đổi tường B 3000 → 3400 rồi vẽ lại: tường cũ của lần vẽ trước được thay, không còn tường thừa; cửa, cột theo tường C dời theo
      await doiPh('p.tuong[1].dai = 3400;');
      kq2 = await vePh();
      eq1(await hopTuong(), [[59780, 60000, -3400, 0, 0, 2700], [60000, 63600, -3620, -3400, 0, 2700], [60000, 63600, 0, 220, 0, 2700], [63600, 63820, -3400, 0, 0, 2700]], 'đổi dài tường B: bản vẽ còn đúng 4 tường theo số mới');
      ok(/Đã cập nhật phòng: vẽ thêm 3 tường, 2 cửa \/ ô trống, 1 cột \/ hộp; bỏ 3 tường, 1 cửa \/ ô trống, 1 cột \/ hộp của lần vẽ trước; giữ nguyên 1 tường, 1 cột \/ hộp, 1 dầm/.test(kq2), 'báo rõ đã bỏ gì, vẽ thêm gì, giữ gì', kq2);
      eq1(await demPh(), cong([4, 2, 2, 1, 1]), '… vẫn 2 lỗ cửa, 2 cột, 1 dầm, 1 vùng phòng — không chồng, không thừa');
      const lo3 = await page.evaluate(() => { const M = window.__MOCK__; return M.ents.filter(e => e instanceof M.RoomHolePolyline && !e.IsErase && e.box[0] > 50000).map(e => e.box.map(v => Math.round(v))).sort((a, b) => a[0] - b[0]); });
      eq1(lo3, [[62500, 63400, -3620, -3400, 0, 2200], [63600, 63820, -1600, -400, 900, 2200]], 'cửa đi theo tường C mới (y = −3400); cửa sổ tường B được mở lại trên tường B mới');
      // 4. Hoàn tác phòng: về đúng phòng trước lần cập nhật, bản ghi cũng lùi theo
      await H.locator('[data-act="p-hoantac"]').click();
      await page.waitForFunction(() => /Đã hoàn tác lần cập nhật phòng/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 15000 }).catch(() => {});
      ok(/Đã hoàn tác lần cập nhật phòng — bản vẽ về như trước lần đó/.test(await st()), 'hoàn tác một lần cập nhật: nói rõ là lùi lần cập nhật', await st());
      eq1([await demPh(), (await hopTuong())[0]], [cong([4, 2, 2, 1, 1]), [59780, 60000, -3000, 0, 0, 2700]], 'Hoàn tác phòng sau một lần cập nhật: tường B dài 3000 trở lại, đủ lỗ cửa / cột');
      eq1((await page.evaluate(() => window.MNCF.phong.lay().da_ve.tuong[1])), [63600, 0, 63600, -3000, 0, 2700, 220], '… bản ghi lần vẽ cũng lùi về lần trước');
      kq2 = await vePh();
      ok(/Đã cập nhật phòng/.test(kq2) && JSON.stringify((await hopTuong())[0]) === '[59780,60000,-3400,0,0,2700]', 'vẽ lại sau khi hoàn tác: cập nhật lại được như thường', kq2);
      // 5. sau khi tải lại trang (bản ghi chỉ còn trong phòng đã lưu, máy vẽ không còn nhớ gì): vẫn cập nhật được
      await doiPh('p.tuong[1].dai = 3000;');
      await page.evaluate(() => { window.MNCFDriver.lastRoom = null; });
      kq2 = await vePh();
      ok(/Đã cập nhật phòng/.test(kq2) && JSON.stringify(await hopTuong()) === JSON.stringify([[59780, 60000, -3000, 0, 0, 2700], [60000, 63600, -3220, -3000, 0, 2700], [60000, 63600, 0, 220, 0, 2700], [63600, 63820, -3000, 0, 0, 2700]]), 'chỉ còn bản ghi đi theo phòng: vẫn thay đúng tường cũ', [kq2, await hopTuong()]);
      // 6. KHÔNG có bản ghi (phòng vẽ từ bản trước) + phòng to ra: tường cũ nằm trong lòng phòng mới → bảng dừng lại hỏi, chưa vẽ gì
      await doiPh('delete p.da_ve; p.tuong[1].dai = 3500;');
      await page.evaluate(() => { window.MNCFDriver.lastRoom = null; });
      const truoc6 = await demPh();
      kq2 = await vePh();
      ok(/Chưa vẽ: trên bản vẽ đang có 1 tường khác nằm trong lòng phòng sắp vẽ/.test(kq2) && (await H.locator('[data-act="p-ve-bo"]').count()) === 1, 'không có bản ghi, có tường cũ nằm trong lòng phòng mới: dừng lại, có nút "bỏ tường cũ rồi vẽ"', kq2);
      eq1(await demPh(), truoc6, '… chưa đụng gì vào bản vẽ');
      kq2 = await vePh('[data-act="p-ve-bo"]');
      ok(/Đã cập nhật phòng/.test(kq2) && JSON.stringify(await hopTuong()) === JSON.stringify([[59780, 60000, -3500, 0, 0, 2700], [60000, 63600, -3720, -3500, 0, 2700], [60000, 63600, 0, 220, 0, 2700], [63600, 63820, -3500, 0, 0, 2700]]), 'bấm "bỏ tường cũ rồi vẽ": tường cũ vướng được bỏ, phòng mới đủ 4 tường', [kq2, await hopTuong()]);
      eq1(await demPh(), cong([4, 2, 2, 1, 1]), '… cột cũ nằm lạc trong phòng (theo tường C cũ) cũng được bỏ, không thành cột thừa');
      // 7. Chenfeng không dựng được tường (lệnh bị từ chối): vẫn báo lỗi thật, đếm theo tường CÓ trên bản vẽ
      await doiPh("p.goc = [80000, 0, 0]; delete p.da_ve; p.dn = [{ tuong: 0, loai: 'o_dien', cach: 950, cao: 300 }];");
      await page.evaluate(() => { window.MNCFDriver.lastRoom = null; window.__MOCK_TUONG_HONG__ = true; });
      kq2 = await vePh();
      ok(/Chưa vẽ xong phòng/.test(kq2) && /Chenfeng chỉ dựng được 0\/4 tường/.test(kq2), 'Chenfeng không dựng tường: báo lỗi thật', kq2);
      eq1(await page.evaluate(() => { const M = window.__MOCK__; return M.ents.filter(e => !e.IsErase && (e instanceof M.Line || e instanceof M.Circle || e instanceof M.Polyline || e instanceof M.Text) && e.box[0] > 79000 && e.box[0] < 90000).length; }), 0, '… tường không dựng được thì không đánh dấu điện – nước vào chỗ không có tường');
      await page.evaluate(() => { window.__MOCK_TUONG_HONG__ = false; });
      // 8. phòng vẽ từ BẢN TRƯỚC (không có bản ghi) mà đã bấm "Vẽ phòng" hai lần: lỗ cửa / cột / dầm đang chồng đôi, dấu điện – nước có sẵn → bấm lại: dọn cái trùng, không vẽ chồng dấu
      const dauO = () => page.evaluate(() => { const M = window.__MOCK__, ds = M.ents.filter(e => !e.IsErase && (e instanceof M.Line || e instanceof M.Circle || e instanceof M.Polyline || e instanceof M.Text) && e.box[0] > 99000 && e.box[0] < 110000);
        return { so: ds.length, tx: ds.filter(e => e instanceof M.Text).map(e => e.TextString).sort(), pl: ds.filter(e => e instanceof M.Polyline).map(e => e.box.map(v => Math.round(v))) }; });
      const P3 = Object.assign({}, PHONG, { goc: [100000, 0, 0], day: 220, khung: [], mo: [{ tuong: 2, loai: 'cua', cach: 200, rong: 900, cao: 2200 }],
        can: [{ tuong: 0, loai: 'cot', cach: 0, rong: 220, nho: 300, z0: 0, z1: 2700 }, { tuong: 0, loai: 'dam', cach: 0, rong: 3600, nho: 250, z0: 2350, z1: 2700 }],
        dn: [{ tuong: 0, loai: 'o_dien', cach: 950, cao: 300 }, { tuong: 1, loai: 'cap_nuoc', cach: 1340, cao: 650 }, { tuong: 0, loai: 'thoat_san', cach: 1500, ra: 300 }] });
      const nen8 = await demPh(), cong8 = d => nen8.map((v, i) => v + d[i]);
      await page.evaluate(p => { window.MNCFDriver.lastRoom = null; window.MNCF.phong.dat(p); }, P3);
      kq2 = await vePh();
      ok(/Đã vẽ phòng: 4 tường, 1 cửa \/ ô trống, 1 cột \/ hộp, 1 dầm, 3 dấu điện – nước/.test(kq2) && (await dauO()).so === 20, '(chuẩn bị) phòng có 3 điểm điện – nước: 20 nét + chữ trên bản vẽ', [kq2, await dauO()]);
      // như đo trên Chenfeng thật: lỗ cửa, dầm thừa chồng khít lên cái cũ; cột thừa bị Chenfeng đẩy sang bên theo cạnh ngắn của đáy cột (cột 220 × 300 → +x 220)
      await page.evaluate(() => { const M = window.__MOCK__, nhan = (e, C, dx) => { const c = new C(); Object.assign(c, { box: e.box.map((v, i) => (i < 2 ? v + dx : v)), tuong: e.tuong, tam: e.tam, cfg: e.cfg }); M.ents.push(c); };
        for (const C of [M.RoomHolePolyline, M.RoomPillar, M.RoomGirder]) for (const e of M.ents.filter(x => x instanceof C && !x.IsErase && x.box[0] > 99000 && x.box[0] < 110000)) nhan(e, C, C === M.RoomPillar ? 220 : 0);
        window.MNCFDriver.lastRoom = null; });
      await doiPh('delete p.da_ve;');
      eq1(await demPh(), cong8([4, 2, 2, 2, 1]), '(chuẩn bị) như bản trước bấm hai lần: lỗ cửa, cột, dầm chồng đôi');
      kq2 = await vePh();
      ok(/Đã cập nhật phòng: dọn 1 cửa \/ ô trống, 1 cột \/ hộp, 1 dầm vẽ trùng \(thừa do bấm vẽ nhiều lần ở bản trước\); giữ nguyên 4 tường, 1 cửa \/ ô trống, 1 cột \/ hộp, 1 dầm; đánh lại 3 dấu điện – nước/.test(kq2) && !/Chưa vẽ xong|chỉ vẽ được|chỉ dựng được/.test(kq2), 'phòng cũ không có bản ghi: dọn lỗ cửa / cột / dầm vẽ trùng, giữ phần đúng, đánh lại dấu — không báo lỗi tường', kq2);
      eq1([await demPh(), (await dauO()).so], [cong8([4, 1, 1, 1, 1]), 20], '… bản vẽ còn đúng 1 lỗ cửa, 1 cột, 1 dầm; dấu điện – nước vẫn 20 nét (không thành 40)');
      kq2 = await vePh();
      ok(/Phòng này đã có đủ trên bản vẽ \(4 tường, 1 cửa \/ ô trống, 1 cột \/ hộp, 1 dầm, 3 dấu điện – nước\) — không vẽ chồng/.test(kq2) && (await dauO()).so === 20, 'bấm lần nữa (đã có bản ghi): báo đã có đủ, dấu giữ nguyên', [kq2, await dauO()]);
      // 8b. có bản ghi, số nét không đổi nhưng NỘI DUNG đổi (dời ổ điện 950 → 1300): phải đánh lại — dấu cũ không được nằm lại ở chỗ cũ
      eq1((await dauO()).pl, [[100890, 101010, -2, -2, 260, 340]], '(chuẩn bị) dấu ổ điện đang ở cách 950');
      await doiPh('p.dn[0].cach = 1300;');
      kq2 = await vePh();
      const d8b = await dauO();
      ok(/Đã cập nhật phòng: giữ nguyên 4 tường, 1 cửa \/ ô trống, 1 cột \/ hộp, 1 dầm; đánh lại 3 dấu điện – nước/.test(kq2) && d8b.so === 20 && JSON.stringify(d8b.pl) === '[[101240,101360,-2,-2,260,340]]', 'dời một ổ điện rồi vẽ lại: dấu được đánh lại ở chỗ mới, không sót dấu ở chỗ cũ', [kq2, d8b.so, d8b.pl]);
      // 8c. có bản ghi, phòng DỜI chỗ (điểm đặt lùi 1000 sang trái, vẫn chồng lên chỗ cũ): dấu cũ nằm NGOÀI phòng mới (cấp nước trên tường B cũ, x ≈ 103 598) vẫn phải được nhận ra
      //     theo vùng của lần vẽ trước và bỏ đi — không để sót một bộ dấu lẻ bên ngoài tường mới
      await doiPh('p.goc = [99000, 0, 0];');
      kq2 = await vePh();
      const d8c = await dauO();
      ok(/Đã cập nhật phòng/.test(kq2) && /đánh lại 3 dấu điện – nước/.test(kq2) && d8c.so === 20 && JSON.stringify(d8c.pl) === '[[100240,100360,-2,-2,260,340]]', 'dời phòng 1000 sang trái rồi vẽ lại: dấu cũ nằm ngoài phòng mới cũng được bỏ, bản vẽ còn đúng một bộ dấu ở chỗ mới', [kq2, d8c.so, d8c.pl, d8c.tx]);
      await doiPh('p.goc = [100000, 0, 0];');
      kq2 = await vePh();
      eq1([(await dauO()).so, await demPh()], [20, cong8([4, 1, 1, 1, 1])], '(trả phòng về chỗ cũ) vẫn một bộ dấu, đủ 4 tường, 1 lỗ cửa, 1 cột, 1 dầm');
      // 9. dấu điện – nước bị chồng đôi từ trước (có bản ghi, nội dung không đổi nhưng trên bản vẽ đang có gấp đôi số nét) → đánh lại cho sạch
      await page.evaluate(() => { const M = window.__MOCK__; for (const e of M.ents.filter(x => !x.IsErase && (x instanceof M.Line || x instanceof M.Circle || x instanceof M.Polyline || x instanceof M.Text) && x.box[0] > 99000 && x.box[0] < 110000)) { const c = new e.constructor(); Object.assign(c, e, { box: e.box.slice() }); M.ents.push(c); } });
      eq1((await dauO()).so, 40, '(chuẩn bị) dấu chồng đôi: 40 nét');
      kq2 = await vePh();
      ok(/Đã cập nhật phòng: giữ nguyên 4 tường, 1 cửa \/ ô trống, 1 cột \/ hộp, 1 dầm; đánh lại 3 dấu điện – nước/.test(kq2) && (await dauO()).so === 20, 'dấu chồng đôi: bỏ hết dấu cũ, đánh lại đúng một bộ', [kq2, await dauO()]);
      // 10. không có bản ghi + bỏ bớt một điểm ở xa (cấp nước tường B): dấu cũ của điểm đó cũng đi, không sót lại; nét / chữ của người dùng (màu khác, chữ không phải nhãn của bảng) không bị đụng
      await page.evaluate(() => { const M = window.__MOCK__, l = new M.Line(), t = new M.Text(), l2 = new M.Line(); l.box = [100500, 101500, -1500, -1500, 0, 0]; l.ColorIndex = 7; t.box = [100500, 100500, -1600, -1600, 0, 0]; t.ColorIndex = 30; t.TextString = 'Ghi chu cua toi';
        l2.box = [100500, 100600, 500, 500, 300, 300]; l2.ColorIndex = 30;      // nét cùng màu dấu điện nhưng nằm NGOÀI phòng (sau lưng tường A — dấu của phòng bên)
        M.ents.push(l, t, l2); window.MNCFDriver.lastRoom = null; });
      await doiPh('delete p.da_ve; p.dn.splice(1, 1);');
      kq2 = await vePh();
      const d10 = await dauO();
      ok(/Đã cập nhật phòng: giữ nguyên 4 tường, 1 cửa \/ ô trống, 1 cột \/ hộp, 1 dầm; đánh lại 2 dấu điện – nước/.test(kq2) && d10.so === 15 && JSON.stringify(d10.tx) === '["Ghi chu cua toi","O1","O1 +300","TS1"]', 'bỏ một điểm rồi vẽ lại (không có bản ghi): dấu cũ đi hết, còn đúng 12 nét của 2 điểm + nét, chữ riêng của người dùng + nét cùng màu nằm ngoài phòng', [kq2, d10]);
      // 11. phòng không còn điểm điện – nước nào: dấu cũ trong phòng được bỏ
      await doiPh('p.dn = [];');
      kq2 = await vePh();
      const d11 = await dauO();
      ok(/Đã cập nhật phòng: giữ nguyên 4 tường, 1 cửa \/ ô trống, 1 cột \/ hộp, 1 dầm; bỏ dấu điện – nước cũ/.test(kq2) && d11.so === 3 && JSON.stringify(d11.tx) === '["Ghi chu cua toi"]', 'phòng hết điểm điện – nước: bỏ dấu cũ; nét / chữ của người dùng và nét ngoài phòng còn nguyên', [kq2, d11]);
      await H.locator('[data-act="p-hoantac"]').click();
      await page.waitForFunction(() => /Đã hoàn tác lần cập nhật phòng/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 15000 }).catch(() => {});
      eq1((await dauO()).so, 15, 'Hoàn tác phòng: dấu vừa bỏ trở lại');
      // dọn nét / chữ của khối thử này (các phép thử điện – nước phía sau đếm trên cả bản vẽ)
      await page.evaluate(() => { const M = window.__MOCK__; for (const e of M.ents) if (!e.IsErase && (e instanceof M.Line || e instanceof M.Circle || e instanceof M.Polyline || e instanceof M.Text) && e.box[0] > 99000 && e.box[0] < 110000) e.IsErase = true; window.MNCFDriver.lastRoom = null; });
    }
    // dầm bị Chenfeng ép cao độ (đỉnh dầm không vượt trần của Chenfeng) → báo rõ
    await page.evaluate(p => { window.__MOCK_TRAN__ = 2600; window.MNCF.phong.dat(Object.assign({}, p, { khung: [], mo: [], can: [{ tuong: 0, loai: 'dam', cach: 0, rong: 3600, nho: 250, z0: 2350, z1: 2700 }] })); }, PHONG);
    await H.locator('[data-act="p-ve"]').click();
    await page.waitForFunction(() => /Chenfeng đặt dầm/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.pkq').innerText), null, { timeout: 40000 }).catch(() => {});
    ok(/Dầm 1: Chenfeng đặt dầm ở cao độ \+2250 → \+2600 \(muốn \+2350 → \+2700\)/.test(await H.locator('.pkq').innerText()), 'dầm lệch cao độ: có cảnh báo', await H.locator('.pkq').innerText());

    /* --- bản 1.18: ĐIỆN – NƯỚC — vẽ phòng thì đánh dấu các điểm lên bản vẽ (file DXF thả vào Chenfeng); vẽ tủ vào khung thì báo điểm sau tủ --- */
    const PHONG_DN = Object.assign({}, PHONG, { goc: [40000, 0, 0], mo: [], can: [], khung: [{ ten: 'KD', tuong: 0, cach: 300, rong: 2000, cao: 2400, sau: 600 }],
      dn: [{ tuong: 0, loai: 'o_dien', cach: 950, cao: 300 }, { tuong: 1, loai: 'cap_nuoc', cach: 1340, cao: 650 }, { tuong: 0, loai: 'thoat_san', cach: 1500, ra: 300 }] });
    const soNet = () => page.evaluate(() => { const M = window.__MOCK__, ds = c => M.ents.filter(e => e instanceof c && !e.IsErase); return { pl: ds(M.Polyline).map(e => e.box.map(v => Math.round(v * 10) / 10)), ci: ds(M.Circle).length, tx: ds(M.Text).map(e => e.TextString), li: ds(M.Line).length, mau: [...new Set(ds(M.Circle).concat(ds(M.Polyline), ds(M.Line), ds(M.Text)).map(e => e.ColorIndex))].sort((a, b) => a - b) }; });
    await page.evaluate(p => { window.__MOCK_TRAN__ = 0; window.__MOCK_INPUTS__ = []; window.MNCF.phong.dat(p); }, PHONG_DN);
    const nDn0 = await page.evaluate(() => window.__MOCK__.ents.filter(e => !e.IsErase).length);
    await H.locator('[data-act="p-ve"]').click();
    await page.waitForFunction(() => /Đã vẽ phòng vào Chenfeng|chưa xong/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 40000 });
    let net = await soNet();
    ok(/Đã vẽ phòng: 4 tường, 3 dấu điện – nước \(nét \+ nhãn trên mặt tường \/ trên sàn\)/.test(await H.locator('.pkq').innerText()), 'vẽ phòng có điểm điện – nước: báo số dấu đã đánh', await H.locator('.pkq').innerText());
    ok(JSON.stringify(net.pl) === '[[40890,41010,-2,-2,260,340]]' && net.ci === 4 && net.li === 10 && JSON.stringify(net.tx) === '["O1 +300","O1","CN1 +650","CN1","TS1"]' && JSON.stringify(net.mau) === '[30,34,140]',
      'bản vẽ có: ô 120 × 80 của ổ điện nằm trên mặt tường A (nhô 2 mm vào phòng), 4 vòng tròn, 10 đoạn thẳng, 5 chữ không dấu; màu theo nhóm (30 điện, 140 cấp, 34 thoát)', net);
    ok(JSON.stringify(await page.evaluate(() => (window.__MOCK_DXF__ || []).slice(-1))) === '[{"ten":"dien-nuoc.dxf","so":20,"truoc":false}]' && (await page.evaluate(() => window.__MOCK_INPUTS__.filter(t => t === 'N').length)) === 1, 'Chenfeng hỏi "chèn vào mặt trước?" → bảng trả lời N (giữ nguyên toạ độ)', await page.evaluate(() => window.__MOCK_DXF__));
    await H.locator('[data-act="p-hoantac"]').click();
    await page.waitForFunction(() => /Đã bỏ phòng/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 15000 }).catch(() => {});
    ok((await page.evaluate(() => window.__MOCK__.ents.filter(e => !e.IsErase).length)) === nDn0 && (await soNet()).tx.length === 0, 'Hoàn tác phòng: tường lẫn dấu điện – nước đều đi', await st());
    // tài khoản bật sẵn "chèn file DXF vào mặt trước": Chenfeng không hỏi mà xoay luôn → bảng thấy nét lệch chỗ, tự bỏ và báo; phòng vẫn vẽ đủ
    await page.evaluate(() => { window.__MOCK_DXF_TRUOC__ = true; });
    await H.locator('[data-act="p-ve"]').click();
    await page.waitForFunction(() => /Đã vẽ phòng vào Chenfeng|chưa xong/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 40000 });
    net = await soNet();
    ok(/Đã vẽ phòng: 4 tường\./.test(await H.locator('.pkq').innerText()) && /Chưa đánh dấu được 3 điểm điện – nước lên bản vẽ: Chenfeng đặt các nét lệch chỗ/.test(await H.locator('.pkq').innerText()) && net.tx.length === 0 && net.pl.length === 0 && net.li === 0,
      'Chenfeng tự xoay file: bảng bỏ các nét lệch, báo rõ; phòng vẫn vẽ đủ 4 tường', [await H.locator('.pkq').innerText(), net]);
    await page.evaluate(() => { window.__MOCK_DXF_TRUOC__ = false; });
    await H.locator('[data-act="p-hoantac"]').click();
    await page.waitForFunction(() => /Đã bỏ phòng/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 15000 }).catch(() => {});
    ok((await page.evaluate(() => window.__MOCK__.ents.filter(e => !e.IsErase).length)) === nDn0, 'hoàn tác lần vẽ đó: bản vẽ về như trước');
    // vẽ tủ vào khung có ổ điện sau lưng + thoát sàn dưới đáy → thẻ Kết quả ghi rõ
    await H.locator('.pcard[data-kj="0"] [data-act="k-ve"]').click();
    await H.locator('.report .msg').first().waitFor({ timeout: 40000 });
    await page.waitForFunction(() => /Đã vẽ xong|Có lỗi/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 40000 });
    const bcDn = await H.locator('.report .msg.dn').allInnerTexts();
    ok(/Đã vẽ xong/.test(await H.locator('.report').innerText()) && bcDn.length === 2 && bcDn.some(t => /^Điện – nước: Ổ điện 1/.test(t) && /tâm cách mép trái tủ 650, cao \+300/.test(t)) && bcDn.some(t => /^Điện – nước: Thoát sàn 1 nằm dưới tủ/.test(t)),
      'Vẽ tủ vào khung: thẻ Kết quả ghi ổ điện sau lưng tủ (cách mép trái tủ 650, cao +300) và thoát sàn dưới tủ; cấp nước ở tường B không dính', bcDn);
    await H.locator('.tab[data-tab="tu"]').click();
    ok((await H.locator('.view text[data-dn]').evaluateAll(es => es.map(e => e.textContent))).join() === 'Ổ1,TS1' && (await H.locator('.msgs .msg.dn').count()) === 2, 'vẽ xong: thẻ Tủ vẫn soi điện – nước lên tủ vừa vẽ (để sửa tiếp rồi "Cập nhật tủ này")');
    await H.locator('.tab[data-tab="kq"]').click();
    await H.locator('[data-act="undo"]').click();
    await page.waitForFunction(() => /Đã hoàn tác/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 15000 });
    await page.evaluate(p => { window.__MOCK_TRAN__ = 2600; window.MNCF.phong.dat(Object.assign({}, p, { khung: [], mo: [], can: [{ tuong: 0, loai: 'dam', cach: 0, rong: 3600, nho: 250, z0: 2350, z1: 2700 }] })); }, PHONG);

    /* --- bản 1.17: ĐẶT TỦ BẰNG CHUỘT — bấm điểm đầu ở chân tường, rê chuột dọc tường, rồi Enter / gõ bề rộng / bấm điểm cuối ---
     * Phòng đang có trên bản vẽ giả lập: lòng phòng x 0 … 3600, y −3000 … 0 (tường A: mặt trong y = 0; tường B: mặt trong x = 3600), trần 2700. */
    const sr = () => page.evaluate(() => document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent);
    const choHoi = n => page.waitForFunction(k => (window.__MOCK_HOI__ || []).length >= k && window.MNCFDriver.busy(), n, { timeout: 8000 });
    const soHoi = () => page.evaluate(() => (window.__MOCK_HOI__ || []).length);
    const datXong = re => page.waitForFunction(r => new RegExp(r).test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), re, { timeout: 8000 });
    const oDat = () => page.evaluate(() => { const r = document.getElementById('mncf-host').shadowRoot, q = n => r.querySelector(`[data-ui="${n}"]`).value, hc = r.querySelector('.hinhcho'); const s = window.MNCF.app.getSpec();
      return { goc: [q('ax'), q('ay'), q('az')], rong: s.rong, cao: s.cao, khoang: s.khoang.length, hinhcho: hc && !hc.hidden ? hc.textContent : '', bong: document.querySelectorAll('svg[aria-hidden="true"] polyline').length }; });
    const TU_DAT = { ma: 'DC1', rong: 2000, cao: 2400, sau_thung: 580, khoang: [{ rong: 'auto', canh: 2, dot: [400, 1200], o: [] }, { rong: 'auto', canh: 2, dot: [800], o: [] }] };
    await page.evaluate(sp => window.MNCF.app.setSpec(sp), TU_DAT);
    await H.locator('.tab[data-tab="tu"]').click();
    ok(await H.locator('[data-act="dat"]').isVisible() && await H.locator('[data-act="dat-tuong"]').isVisible() && (await H.locator('[data-ui="veNgay"]').count()) === 0, 'thẻ Tủ có nút "Đặt tủ theo tường" và "Đặt tủ bằng chuột"; không còn ô "vẽ ngay" — đặt xong luôn hiện hộp chỉnh tủ, bấm Vẽ mới vẽ');
    // bản 1.23 (anh Jason 04/10/2026 23:02: "vẽ bằng chuột thì hiện lên popup để chỉnh sửa tủ rồi bấm vẽ mới vẽ")
    const hop = () => page.evaluate(() => { const r = document.getElementById('mncf-host').shadowRoot, p = r.querySelector('.panel'), hien = e => !!e && !e.hidden && e.getClientRects().length > 0, bx = p.getBoundingClientRect();
      return { dlg: p.classList.contains('dlg') ? p.dataset.dlg : '', che: hien(r.querySelector('.manche')), tieu: hien(r.querySelector('.dlgtieu')) ? r.querySelector('.dlgtieu').innerText : '', tab: hien(r.querySelector('.tabs')), paneTu: hien(r.querySelector('.pane[data-pane="tu"]')),
        nut: [...r.querySelectorAll('footer .dlgnut button')].filter(hien).map(x => x.dataset.act), giua: Math.abs((bx.left + bx.right) / 2 - innerWidth / 2) < 3, rong: Math.round(bx.width), nutVe: hien(r.querySelector('footer [data-act="draw"]')), veKhoa: !!(r.querySelector('[data-act="hop-ve"]') || {}).disabled }; });
    const soDoiTuong = () => page.evaluate(() => window.__MOCK__.ents.filter(e => !e.IsErase).length);
    const nDat0 = await soDoiTuong();
    // (1) bấm điểm đầu trên tường A, rê chuột sang phải, Enter → dùng bề rộng đang gõ trong bảng
    let h0 = await soHoi();
    await H.locator('[data-act="dat"]').click(); await choHoi(h0 + 1);
    ok(/Bấm điểm ĐẦU của tủ/.test(await H.locator('.chip').textContent()) && !(await H.locator('.panel').isVisible()), 'bấm nút: bảng thu lại, nhắc bấm điểm đầu');
    await page.evaluate(() => window.__MOCK__.clickPoint(500, 0, 0)); await choHoi(h0 + 2);
    const hoi2 = await page.evaluate(() => window.__MOCK_HOI__[window.__MOCK_HOI__.length - 1]);
    ok(hoi2.goc && hoi2.enter && /Enter = rộng 2000/.test(hoi2.Msg) && /Enter = rộng 2000/.test(await H.locator('.chip').textContent()), 'lời nhắc thứ hai: có dây thun từ điểm đầu, cho Enter, ghi rõ bề rộng đang gõ', hoi2);
    await page.evaluate(() => window.__MOCK__.reChuot(1300, -80, 0));
    const bong = await page.evaluate(() => { const g = document.querySelector('svg[aria-hidden="true"]'); return g ? { n: g.querySelectorAll('polyline').length, chu: (g.querySelector('text') || {}).textContent, cam: g.querySelectorAll('polyline[stroke="#ff9f1a"]').length, dut: g.querySelectorAll('polyline[stroke-dasharray]').length, chuot: getComputedStyle(g).pointerEvents } : null; });
    ok(bong && bong.n === 14 && bong.cam === 2 && bong.dut === 6 && bong.chuot === 'none' && /bấm: rộng 800 · Enter: rộng 2000 · sâu 597,5/.test(bong.chu), 'rê chuột: có bóng mờ 2 hộp (nét liền = bấm tại đây, nét đứt = Enter), cạnh cam là mặt trước, không bắt chuột', bong);
    await page.evaluate(() => window.app.Editor.InputEvent('')); await datXong('Đã đặt: rộng 2000');
    let hp = await hop();
    ok(hp.dlg === 'tu' && hp.che && !hp.tab && hp.paneTu && hp.giua && hp.rong > 900 && JSON.stringify(hp.nut) === '["hop-ve","hop-lai","hop-dong"]' && !hp.nutVe && !hp.veKhoa && /rộng 2000 × cao 2400 × sâu 597,5/.test(hp.tieu) && /điểm bấm/.test(hp.tieu),
      'đặt xong: hiện HỘP CHỈNH TỦ giữa màn hình (có màn che, không còn các thẻ khác), ghi rõ tủ + chỗ đặt, 3 nút Vẽ / Chọn lại chỗ / Đóng', hp);
    ok((await soDoiTuong()) === nDat0 && await H.locator('.view svg').isVisible(), '… chưa vẽ gì vào bản vẽ; trong hộp có hình đứng để chỉnh khoang, đợt');
    let stDat = await sr();
    await H.locator('[data-act="hop-dong"]').click();
    hp = await hop();
    ok(hp.dlg === '' && !hp.che && hp.tab && hp.nutVe && hp.rong < 700, 'bấm "Đóng — vẽ sau": bảng trở lại bình thường, tủ còn mở ở thẻ Tủ cùng chỗ đặt', hp);
    eq1(hp.nut, [], '… và các nút của hộp ẩn đi cùng hộp');
    let d = await oDat();
    ok(JSON.stringify(d.goc) === '["500","-597.5","0"]' && d.rong === 2000 && d.bong === 0 && /Đang đặt theo điểm bấm trên mặt bằng: 2000 × 597,5, xoay 0°\. Mặt trước nhận theo tường phía sau/.test(d.hinhcho) && /rộng 2000 × sâu 597,5 × cao 2400, xoay 0°/.test(stDat) && /Đã đóng hộp, chưa vẽ/.test(await sr()) && await H.locator('.panel').isVisible(),
      'Enter: tủ rộng 2000 theo bảng, lưng áp tường A, mặt trước quay vào phòng, góc trái–trước (500; −597,5); bóng mờ đã gỡ, bảng mở lại', [d, stDat, await sr()]);
    // (2) gõ bề rộng 1800 rồi Enter
    h0 = await soHoi();
    await H.locator('[data-act="dat"]').click(); await choHoi(h0 + 1);
    await page.evaluate(() => window.__MOCK__.clickPoint(500, 0, 0)); await choHoi(h0 + 2);
    await page.evaluate(() => { window.__MOCK__.reChuot(1300, -80, 0); window.app.Editor.InputEvent('1800'); }); await datXong('Đã đặt: rộng 1800');
    await page.keyboard.press('Alt+KeyM');
    ok((await hop()).dlg === 'tu' && await H.locator('.panel').isVisible(), 'Alt + M lúc hộp chỉnh tủ đang mở: bảng không ẩn đi (phải bấm Vẽ / Đóng trước)', await hop());
    await page.keyboard.press('Escape');
    ok((await hop()).dlg === '' && (await soDoiTuong()) === nDat0, 'Esc trong hộp chỉnh tủ = đóng hộp (vẽ sau), không vẽ gì');
    d = await oDat();
    ok(d.rong === 1800 && JSON.stringify(d.goc) === '["500","-597.5","0"]' && d.khoang === 2, 'gõ 1800 + Enter: tủ rộng đúng 1800 dù chuột đang lệch khỏi tường, giữ 2 khoang đang mở', d);
    // (3) bấm điểm cuối (rê sang TRÁI, bấm lệch tường 30): rộng theo đoạn tường; tủ cao hơn trần thì hạ theo trần
    await page.evaluate(sp => window.MNCF.app.setSpec(Object.assign({}, sp, { cao: 2800, than: { cao_duoi: 2100 } })), TU_DAT);
    h0 = await soHoi();
    await H.locator('[data-act="dat"]').click(); await choHoi(h0 + 1);
    await page.evaluate(() => window.__MOCK__.clickPoint(3000, 0, 0)); await choHoi(h0 + 2);
    await page.evaluate(() => window.__MOCK__.clickPoint(600, -30, 0)); await datXong('Đã đặt: rộng 2400');
    ok(/cao 2700/.test((await hop()).tieu), 'hộp chỉnh tủ ghi chiều cao đã hạ theo trần', (await hop()).tieu);
    stDat = await sr();
    await H.locator('[data-act="hop-dong"]').click();
    d = await oDat();
    ok(d.rong === 2400 && d.cao === 2700 && JSON.stringify(d.goc) === '["600","-597.5","0"]' && /cao 2700 \(hạ theo trần\)/.test(stDat), 'bấm điểm cuối bên trái: rộng 2400 theo đoạn tường (điểm bấm lệch 30 được chiếu về mặt tường), cao 2800 hạ còn 2700 theo trần', [d, stDat]);
    // (4) không có tường: hỏi thêm điểm phía trước
    await page.evaluate(sp => window.MNCF.app.setSpec(sp), TU_DAT);
    h0 = await soHoi();
    await H.locator('[data-act="dat"]').click(); await choHoi(h0 + 1);
    await page.evaluate(() => window.__MOCK__.clickPoint(30000, 5000, 0)); await choHoi(h0 + 2);
    await page.evaluate(() => window.__MOCK__.clickPoint(30000, 6600, 0)); await choHoi(h0 + 3);
    ok(/phía TRƯỚC tủ/.test(await H.locator('.chip').textContent()), 'hai điểm ngoài phòng (không bám tường): hỏi bấm 1 điểm phía trước tủ');
    await page.evaluate(() => window.__MOCK__.clickPoint(31000, 5800, 0)); await datXong('Đã đặt: rộng 1600');
    stDat = await sr();
    await H.locator('[data-act="hop-dong"]').click();
    d = await oDat();
    ok(d.rong === 1600 && /xoay 90°/.test(stDat) && JSON.stringify(d.goc) === '["30597.5","5000","0"]', 'điểm phía trước ở bên phải đoạn dọc: tủ quay 90°, mặt trước ở x lớn', [d, stDat]);
    // (5) Esc giữa chừng: không đổi gì, bóng mờ gỡ sạch
    const truocHuy = await page.evaluate(() => JSON.stringify(window.MNCF.app.getSpec()));
    h0 = await soHoi();
    await H.locator('[data-act="dat"]').click(); await choHoi(h0 + 1);
    await page.evaluate(() => window.__MOCK__.clickPoint(500, 0, 0)); await choHoi(h0 + 2);
    await page.evaluate(() => { window.__MOCK__.reChuot(1000, -50, 0); window.app.Editor.Cancel(); }); await datXong('Đã huỷ — chưa đặt tủ');
    ok((await page.evaluate(() => JSON.stringify(window.MNCF.app.getSpec()))) === truocHuy && (await oDat()).bong === 0 && await H.locator('.panel').isVisible() && !(await page.evaluate(() => window.MNCFDriver.busy())) && (await hop()).dlg === '', 'Esc ở lời nhắc thứ hai: tủ trong bảng giữ nguyên, bóng mờ gỡ, bảng mở lại (không hiện hộp chỉnh tủ)');
    // (6) HỘP CHỈNH TỦ: đặt dọc tường B → sửa tủ ngay trong hộp → bấm Vẽ mới vẽ; tủ theo số đã sửa, nằm đúng chỗ, quay theo tường B
    await page.evaluate(sp => window.MNCF.app.setSpec(sp), TU_DAT);
    const nTruoc = await soDoiTuong();
    const hopTu = () => page.evaluate(() => { const D = window.MNCFDriver, a = D.last.added.filter(D.isBoard); let b = null; for (const e of a) { const x = D.boxOf(e); b = b ? [Math.min(b[0], x[0]), Math.max(b[1], x[1]), Math.min(b[2], x[2]), Math.max(b[3], x[3]), Math.min(b[4], x[4]), Math.max(b[5], x[5])] : x.slice(); } return { hop: b.map(v => Math.round(v * 10) / 10), n: a.length, kq: document.getElementById('mncf-host').shadowRoot.querySelector('.report').innerText }; });
    const choVe = async () => { await H.locator('.report .msg').first().waitFor({ timeout: 40000 }); await page.waitForFunction(() => /Đã vẽ xong|Có lỗi/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 40000 }); };
    h0 = await soHoi();
    await H.locator('[data-act="dat"]').click(); await choHoi(h0 + 1);
    await page.evaluate(() => window.__MOCK__.clickPoint(3600, -400, 0)); await choHoi(h0 + 2);
    await page.evaluate(() => { window.__MOCK__.reChuot(3500, -1500, 0); window.app.Editor.InputEvent(''); });
    await datXong('Đã đặt: rộng 2000');
    ok((await hop()).dlg === 'tu' && (await soDoiTuong()) === nTruoc, 'đặt dọc tường B: hộp chỉnh tủ hiện, chưa vẽ');
    await H.locator('#mncf-cao').fill('2300'); await H.locator('#mncf-cao').blur();
    const choTieu = re => page.waitForFunction(r => new RegExp(r).test(document.getElementById('mncf-host').shadowRoot.querySelector('.dlgtieu').innerText), re, { timeout: 5000 }).catch(() => {});
    const choKhoa = on => page.waitForFunction(v => document.getElementById('mncf-host').shadowRoot.querySelector('[data-act="hop-ve"]').disabled === v, on, { timeout: 5000 }).catch(() => {});
    await choTieu('cao 2300');
    hp = await hop();
    ok(/rộng 2000 × cao 2300 × sâu 597,5/.test(hp.tieu) && /xoay -90°/.test(hp.tieu) && hp.dlg === 'tu' && (await soDoiTuong()) === nTruoc, 'sửa Cao ngay trong hộp: hộp vẫn mở, dòng đầu ghi theo số mới, vẫn chưa vẽ', hp.tieu);
    await H.locator('#mncf-b0-dot').fill('500, 510'); await H.locator('#mncf-b0-dot').blur(); await choKhoa(true);
    ok((await hop()).veKhoa, 'tủ trong hộp còn lỗi (hai đợt sát nhau) → nút Vẽ của hộp bị khoá');
    await H.locator('#mncf-b0-dot').fill('400, 1200'); await H.locator('#mncf-b0-dot').blur(); await choKhoa(false);
    await H.locator('[data-act="hop-ve"]').click();
    await choVe();
    const veDat = await hopTu();
    ok(veDat.n > 20 && JSON.stringify(veDat.hop) === '[3002.5,3600,-2400,-400,0,2300]' && /Đã vẽ xong/.test(veDat.kq) && /Đã đặt tủ theo điểm bấm trên mặt bằng, xoay -90° — tủ nằm đúng chỗ đã bấm/.test(veDat.kq) && (await soDoiTuong()) > nTruoc && (await hop()).dlg === '',
      'bấm Vẽ trong hộp: tủ 2000 cao 2300 (số vừa sửa) dựng dọc tường B (x 3002,5 … 3600, y −2400 … −400), xoay −90°; hộp đóng, thẻ Kết quả hiện báo cáo', [veDat.hop, veDat.n, veDat.kq.slice(0, 300)]);
    await H.locator('[data-act="undo"]').click();
    await page.waitForFunction(() => /Đã hoàn tác/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 15000 });
    // (7) "Chọn lại chỗ" trong hộp: bỏ chỗ vừa đặt, hỏi lại điểm đầu
    await page.evaluate(sp => window.MNCF.app.setSpec(sp), TU_DAT);
    await H.locator('.tab[data-tab="tu"]').click();
    h0 = await soHoi();
    await H.locator('[data-act="dat"]').click(); await choHoi(h0 + 1);
    await page.evaluate(() => window.__MOCK__.clickPoint(500, 0, 0)); await choHoi(h0 + 2);
    await page.evaluate(() => { window.__MOCK__.reChuot(1300, -80, 0); window.app.Editor.InputEvent(''); }); await datXong('Đã đặt: rộng 2000');
    await H.locator('[data-act="hop-lai"]').click(); await choHoi(h0 + 3);
    ok((await hop()).dlg === '' && /Bấm điểm ĐẦU của tủ/.test(await H.locator('.chip').textContent()), 'Chọn lại chỗ (tủ đặt bằng chuột): hộp đóng, bảng hỏi lại điểm đầu');
    await page.evaluate(() => window.app.Editor.Cancel()); await datXong('Đã huỷ — chưa đặt tủ');

    /* --- bản 1.23: ĐẶT TỦ THEO TƯỜNG — chọn tường, rồi chọn chỗ ngay trên MẶT ĐỨNG của tường đó (anh Jason 04/10/2026 23:08: "chọn tường rồi chọn không gian tủ thì hợp lý hơn làm chuột hay bị chệch",
     *     "chọn mặt cắt đứng rồi chọn luôn trên đó tiện hơn nhiều"). Không phải bấm điểm nào trong bản vẽ: chỗ đặt tính từ phòng trong bảng. --- */
    {
      const PH_T = { ten: 'Phòng ngủ 2', cao: 2700, day: 110, tuong: [{ dai: 3600 }, { dai: 3000 }, { dai: 3600 }, { dai: 'auto' }], goc: [200000, 0, 0],
        mo: [{ tuong: 2, loai: 'cua', cach: 200, rong: 900, cao: 2200, be: 0 }], can: [{ tuong: 0, loai: 'cot', cach: 1200, rong: 300, nho: 200 }], dn: [], khung: [] };
      await page.evaluate(([p, sp]) => { window.MNCF.phong.dat(p); window.MNCF.app.setSpec(sp); }, [PH_T, TU_DAT]);
      await H.locator('.tab[data-tab="tu"]').click();
      const chon = () => page.evaluate(() => { const r = document.getElementById('mncf-host').shadowRoot, q = n => (r.querySelector(`[data-cs="${n}"]`) || {}).value, hien = e => !!e && !e.hidden && e.getClientRects().length > 0;
        return { tuong: [...r.querySelectorAll('.chontuong [data-ct]')].map(b => b.textContent.replace(/\s+/g, ' ').trim() + (b.getAttribute('aria-pressed') === 'true' ? ' *' : '')), mb: !!r.querySelector('.chonmb svg'), md: !!r.querySelector('.chonmd svg'), tenMD: (r.querySelector('.chonmd svg') || { getAttribute() { return ''; } }).getAttribute('aria-label'),
          so: [q('cach'), q('rong'), q('z'), q('cao'), q('sau')], vung: !!r.querySelector('.chonmd .chonvung'), msg: (r.querySelector('.chonmsg') || {}).innerText || '', tiepKhoa: !!(r.querySelector('[data-act="chon-tiep"]') || {}).disabled, nut: [...r.querySelectorAll('footer .dlgnut button')].filter(hien).map(x => x.dataset.act) }; });
      const diemMD = (s, z) => page.evaluate(([s2, z2]) => { const sv = document.getElementById('mncf-host').shadowRoot.querySelector('.chonmd svg'), m = sv.getScreenCTM(), q = sv.createSVGPoint(); q.x = s2; q.y = 2700 - z2; const t = q.matrixTransform(m); return [t.x, t.y]; }, [s, z]);
      const soKhung = () => page.evaluate(() => window.MNCF.phong.lay().khung.map(k => [k.ten, k.tuong, k.cach, k.rong, k.z, k.cao, k.sau, k.tu_id ? 1 : 0]));
      const n0 = await soDoiTuong(), hoi0 = await soHoi();
      await H.locator('[data-act="dat-tuong"]').click();
      hp = await hop(); let c = await chon();
      ok(hp.dlg === 'chon' && hp.che && !hp.tab && hp.giua && hp.rong > 900 && JSON.stringify(c.nut) === '["chon-tiep","chon-thoi"]' && /Chọn tường/.test(hp.tieu), 'bấm "Đặt tủ theo tường": hiện hộp chọn chỗ giữa màn hình (không thu bảng lại, không hỏi điểm nào trong bản vẽ)', [hp, c.nut]);
      ok(JSON.stringify(c.tuong) === '["A · 3600 *","B · 3000","C · 3600","D · 3000"]' && c.mb && c.md && /tường A/.test(c.tenMD) && !c.vung && c.tiepKhoa && (await soHoi()) === hoi0, 'hộp có: 4 tường để chọn (kèm chiều dài), mặt bằng, mặt đứng tường đang chọn; chưa chọn chỗ thì nút Tiếp khoá', c);
      // chọn tường B rồi CHẠM vào mặt đứng → lấy cả đoạn tường trống, sàn → trần
      await H.locator('.chontuong [data-ct="1"]').click();
      c = await chon();
      ok(c.tuong[1] === 'B · 3000 *' && /tường B/.test(c.tenMD), 'bấm tường B: mặt đứng đổi sang tường B', [c.tuong, c.tenMD]);
      let q = await diemMD(2000, 1000);
      await page.mouse.click(q[0], q[1]);
      c = await chon();
      ok(JSON.stringify(c.so) === '["0","3000","0","2700","600"]' && c.vung && !c.tiepKhoa && /Tường B: cả đoạn trống 0 → 3000, sàn → trần/.test(c.msg), 'chạm vào mặt đứng: lấy cả đoạn tường trống (0 → 3000), cao từ sàn tới trần, sâu 600', c);
      // KÉO trên mặt đứng: lấy đúng ô vừa kéo (bắt chẵn 10, bám mép)
      const a1 = await diemMD(500, 5), b1 = await diemMD(2500, 2400);
      await page.mouse.move(a1[0], a1[1]); await page.mouse.down(); await page.mouse.move((a1[0] + b1[0]) / 2, (a1[1] + b1[1]) / 2); await page.mouse.move(b1[0], b1[1]); await page.mouse.up();
      c = await chon();
      ok(JSON.stringify(c.so) === '["500","2000","0","2400","600"]' && c.vung, 'kéo trên mặt đứng từ (500; sàn) tới (2500; +2400): chỗ đặt 500 → 2500, cao 2400', c.so);
      // gõ số cho đúng: rộng 1800
      await H.locator('[data-cs="rong"]').fill('1800'); await H.locator('[data-cs="rong"]').blur();
      c = await chon();
      ok(JSON.stringify(c.so) === '["500","1800","0","2400","600"]' && /500 → 2300/.test(c.msg), 'gõ lại Rộng 1800: vùng chọn đổi theo', c);
      // Tiếp → hộp chỉnh tủ (tủ vừa khung: 1800 × 2400 × 600), chưa vẽ
      await H.locator('[data-act="chon-tiep"]').click();
      hp = await hop();
      const tuK = await page.evaluate(() => { const s = window.MNCF.app.getSpec(); return [s.rong, s.cao, s.ma]; });
      ok(hp.dlg === 'tu' && /Tường B/.test(hp.tieu) && /rộng 1800 × cao 2400 × sâu 600/.test(hp.tieu) && JSON.stringify(tuK.slice(0, 2)) === '[1800,2400]' && (await soDoiTuong()) === n0, 'Tiếp: hiện hộp chỉnh tủ với tủ vừa đúng chỗ đã chọn (1800 × 2400 × 600) — chưa vẽ', [hp.tieu, tuK]);
      eq1(await soKhung(), [[tuK[2], 1, 500, 1800, 0, 2400, 600, 0]], '… chỗ đã chọn được ghi thành một khung của phòng (mặt đứng ở thẻ Phòng thấy chỗ đó đã có tủ)');
      eq1(await page.evaluate(() => window.MNCF.app.getSpec().khoang.map(k => [k.canh, k.dot])), [[2, [400, 1200]], [2, [800]]], '… tủ giữ cách chia khoang / đợt đang mở trong bảng (4 cánh × 450 vẫn hợp lệ) — không bị thay bằng ruột tự chọn theo bề rộng');
      // Chọn lại chỗ: về hộp chọn chỗ, giữ số vừa chọn, khung vừa tạo được bỏ
      await H.locator('[data-act="hop-lai"]').click();
      hp = await hop(); c = await chon();
      ok(hp.dlg === 'chon' && JSON.stringify(c.so) === '["500","1800","0","2400","600"]' && c.tuong[1] === 'B · 3000 *' && (await soKhung()).length === 0, 'Chọn lại chỗ: về hộp chọn chỗ với đúng tường + số vừa chọn; khung tạm đã bỏ', [hp.dlg, c.so, await soKhung()]);
      await H.locator('[data-cs="rong"]').fill('2000'); await H.locator('[data-cs="rong"]').blur();
      await H.locator('[data-act="chon-tiep"]').click();
      await H.locator('[data-act="hop-ve"]').click();
      await choVe();
      const veT = await hopTu(), kh1 = await soKhung();
      ok(veT.n > 20 && JSON.stringify(veT.hop) === '[203000,203600,-2500,-500,0,2400]' && /Đã vẽ xong/.test(veT.kq) && /Đã đặt tủ theo tường B, xoay -90° — tủ nằm đúng khung/.test(veT.kq) && (await hop()).dlg === '' && (await soHoi()) === hoi0,
        'bấm Vẽ: tủ 2000 × 2400 sâu 600 dựng đúng chỗ đã chọn trên tường B (x 203000 … 203600, y −2500 … −500), xoay −90° — không hỏi điểm nào trong bản vẽ', [veT.hop, veT.kq.slice(0, 260)]);
      ok(kh1.length === 1 && kh1[0][7] === 1 && JSON.stringify(kh1[0].slice(1, 7)) === '[1,500,2000,0,2400,600]', 'khung của phòng ghi "đã vẽ"', kh1);
      // đặt tủ thứ hai: chạm vào chỗ tủ vừa vẽ → báo đã có; chạm chỗ trống bên cạnh → lấy đúng phần còn lại
      await H.locator('.tab[data-tab="tu"]').click();
      await H.locator('[data-act="dat-tuong"]').click();
      c = await chon();
      ok(c.tuong[1] === 'B · 3000 *' && !c.vung, 'mở lại hộp chọn chỗ: vẫn ở tường vừa đặt');
      q = await diemMD(1000, 1000); await page.mouse.click(q[0], q[1]);
      c = await chon();
      ok(!c.vung && c.tiepKhoa && new RegExp('Chỗ đó đã có khung ' + tuK[2]).test(c.msg), 'chạm vào chỗ tủ vừa vẽ: báo chỗ đó đã có khung, không chọn', c.msg);
      q = await diemMD(2800, 1000); await page.mouse.click(q[0], q[1]);
      c = await chon();
      ok(JSON.stringify(c.so) === '["2500","500","0","2700","600"]' && c.vung, 'chạm chỗ trống bên phải: lấy đúng phần còn lại 2500 → 3000', c.so);
      // KÉO một ô chồng lên chỗ tủ vừa vẽ (kéo thì không bị chặn ngay lúc kéo) → bấm Tiếp: báo hai khung chồng nhau, ở lại hộp chọn chỗ, không thêm khung
      const ka = await diemMD(2000, 5), kb = await diemMD(2900, 2400);
      await page.mouse.move(ka[0], ka[1]); await page.mouse.down(); await page.mouse.move((ka[0] + kb[0]) / 2, (ka[1] + kb[1]) / 2); await page.mouse.move(kb[0], kb[1]); await page.mouse.up();
      c = await chon();
      ok(JSON.stringify(c.so) === '["2000","900","0","2400","600"]' && c.vung && !c.tiepKhoa, '(chuẩn bị) kéo một ô 2000 → 2900 chồng lên tủ vừa vẽ (500 → 2500)', c.so);
      await H.locator('[data-act="chon-tiep"]').click();
      hp = await hop(); c = await chon();
      ok(hp.dlg === 'chon' && (await soKhung()).length === 1 && /trên tường B chồng lên nhau/.test(c.msg), 'ô kéo chồng lên khung đã có: bấm Tiếp thì báo chồng khung, ở lại hộp chọn chỗ, không thêm khung', [hp.dlg, c.msg, await soKhung()]);
      // chỗ trống bên phải (2500 → 3000) cho cùng mã tủ: khung mới KHÔNG trùng tên khung đã vẽ (thêm đuôi -2); "Chọn lại chỗ" thì khung tạm đó lại được bỏ
      q = await diemMD(2800, 1000); await page.mouse.click(q[0], q[1]);
      c = await chon();
      ok(JSON.stringify(c.so) === '["2500","500","0","2700","600"]' && !/chồng lên nhau/.test(c.msg), '(chuẩn bị) chạm lại chỗ trống 2500 → 3000: lời báo chồng khung đã hết', [c.so, c.msg]);
      // gõ số vượt ra ngoài tường: bảng chặn lại trong phạm vi tường (rộng không quá phần tường còn lại; cách đầu tường chừa ít nhất 100)
      await H.locator('[data-cs="rong"]').fill('9999'); await H.locator('[data-cs="rong"]').blur();
      c = await chon();
      ok(JSON.stringify(c.so) === '["2500","500","0","2700","600"]', 'gõ bề rộng 9999: chặn lại ở phần tường còn lại (500)', c.so);
      await H.locator('[data-cs="cach"]').fill('2980'); await H.locator('[data-cs="cach"]').blur();
      c = await chon();
      ok(JSON.stringify(c.so) === '["2900","100","0","2700","600"]', 'gõ cách đầu tường 2980 (tường dài 3000): lùi về 2900, rộng còn 100', c.so);
      q = await diemMD(2800, 1000); await page.mouse.click(q[0], q[1]);
      c = await chon();
      ok(JSON.stringify(c.so) === '["2500","500","0","2700","600"]', '(trả lại) chạm chỗ trống: 2500 → 3000', c.so);
      // kéo một ô quá nhỏ (50 × 50): không nhận, chỗ đang chọn giữ nguyên
      const na = await diemMD(2600, 100), nb = await diemMD(2650, 150);
      await page.mouse.move(na[0], na[1]); await page.mouse.down(); await page.mouse.move((na[0] + nb[0]) / 2, (na[1] + nb[1]) / 2); await page.mouse.move(nb[0], nb[1]); await page.mouse.up();
      c = await chon();
      ok(/Ô kéo quá nhỏ/.test(c.msg) && JSON.stringify(c.so) === '["2500","500","0","2700","600"]', 'kéo một ô 50 × 50: báo ô quá nhỏ, chỗ đã chọn trước đó giữ nguyên', [c.msg, c.so]);
      await H.locator('[data-act="chon-tiep"]').click();
      hp = await hop();
      const kh2 = await soKhung();
      ok(hp.dlg === 'tu' && kh2.length === 2 && kh2[1][0] === kh2[0][0] + '-2' && kh2[1][7] === 0, 'đặt thêm cùng mã tủ ở chỗ khác: khung mới mang tên có đuôi -2 (không trùng khung đã vẽ)', [hp.dlg, kh2.map(k => k[0])]);
      await H.locator('[data-act="hop-lai"]').click();
      ok((await hop()).dlg === 'chon' && (await soKhung()).length === 1, '… Chọn lại chỗ: khung tạm -2 được bỏ, khung đã vẽ còn nguyên', await soKhung());
      // chọn tường A: cột 1200 … 1500 không chắn — chạm là lấy cả tường; ghi chú có cột (tủ sẽ khấu cột)
      await H.locator('.chontuong [data-ct="0"]').click();
      q = await diemMD(300, 1000); await page.mouse.click(q[0], q[1]);
      c = await chon();
      ok(JSON.stringify(c.so) === '["0","3000","0","2700","600"]' && /cột/i.test(c.msg), 'tường A: tủ ở tường B (sâu 600) lấn góc nên tường A trống 0 → 3000; cột nằm trong đoạn đó → nhắc tủ sẽ khấu cột', c);
      // chiều sâu đang gõ quyết định cái gì "lấn góc": tủ nông 350 thì tủ ở tường B (cách góc 500) không còn vướng dải sát tường A → chạm tường A lấy cả 3600
      await H.locator('[data-cs="sau"]').fill('350'); await H.locator('[data-cs="sau"]').blur();
      q = await diemMD(300, 1000); await page.mouse.click(q[0], q[1]);
      c = await chon();
      ok(JSON.stringify(c.so) === '["0","3600","0","2700","350"]', 'gõ Sâu 350 rồi chạm lại tường A: tủ nông không vướng tủ ở tường B → tường A trống cả 3600', c.so);
      await H.locator('[data-cs="sau"]').fill('600'); await H.locator('[data-cs="sau"]').blur();
      // Thôi: đóng hộp, không thêm khung, không vẽ
      const nSau = await soDoiTuong();
      await H.locator('[data-act="chon-thoi"]').click();
      ok((await hop()).dlg === '' && (await soKhung()).length === 1 && (await soDoiTuong()) === nSau, 'Thôi: hộp đóng, phòng và bản vẽ giữ nguyên');
      await H.locator('.tab[data-tab="kq"]').click();
      await H.locator('[data-act="undo"]').click();
      await page.waitForFunction(() => /Đã hoàn tác/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 15000 });
      // Hoàn tác tủ đặt theo tường: khung do lần đặt đó tự tạo cũng được bỏ — không để một khung "đã vẽ" ma chiếm tường (thấy khi thử trên Chenfeng thật 05/10/2026)
      eq1(await soKhung(), [], 'Hoàn tác tủ đặt theo tường: khung tạm của lần đặt đó được bỏ khỏi phòng');
      await H.locator('.tab[data-tab="tu"]').click();
      await H.locator('[data-act="dat-tuong"]').click();
      await H.locator('.chontuong [data-ct="1"]').click();
      q = await diemMD(1000, 1000); await page.mouse.click(q[0], q[1]);
      c = await chon();
      ok(JSON.stringify(c.so) === '["0","3000","0","2700","600"]' && c.vung, '… mở lại hộp chọn chỗ, chạm tường B: cả tường 0 → 3000 lại trống', [c.so, c.msg]);
      // "Đóng — vẽ sau" rồi bấm "Đặt tủ theo tường" lần nữa = chọn lại chỗ: khung tạm chưa vẽ của lần chọn trước được bỏ, không chắn chính chỗ vừa chọn
      await H.locator('[data-act="chon-tiep"]').click();
      ok((await hop()).dlg === 'tu' && (await soKhung()).length === 1 && (await soKhung())[0][7] === 0, '(chuẩn bị) Tiếp: có một khung tạm chưa vẽ');
      await H.locator('[data-act="hop-dong"]').click();
      ok((await hop()).dlg === '' && (await soKhung()).length === 1, '"Đóng — vẽ sau": khung tạm còn đó (tủ + chỗ đặt vẫn ở thẻ Tủ để vẽ sau)');
      await H.locator('[data-act="dat-tuong"]').click();
      eq1(await soKhung(), [], 'bấm "Đặt tủ theo tường" lần nữa: khung tạm chưa vẽ của lần chọn trước được bỏ');
      q = await diemMD(1000, 1000); await page.mouse.click(q[0], q[1]);
      c = await chon();
      ok(JSON.stringify(c.so) === '["0","3000","0","2700","600"]' && c.vung, '… chạm tường B: vẫn lấy được cả tường (không bị chính khung tạm cũ chắn)', [c.so, c.msg]);
      await H.locator('[data-act="chon-thoi"]').click();
    }

    // phòng còn lỗi thì không vẽ
    await H.locator('.tab[data-tab="phong"]').click();
    await page.evaluate(p => window.MNCF.phong.dat(Object.assign(p, { khung: [{ ten: 'K1', tuong: 0, cach: 2500, rong: 2000, cao: 2700, sau: 600 }] })), PHONG);
    ok(await H.locator('.pcard[data-kj="0"] [data-act="k-ve"]').isDisabled() && /vượt ra ngoài tường A/.test(await H.locator('.pmsgs').innerText()), 'khung vượt tường: nút vẽ bị khoá, có báo lỗi');
    ok(errs.length === 0, 'không có lỗi JS lọt ra trang', errs);
  } catch (e) { fail++; console.log('  ✗ ném lỗi:', e && e.stack || e); }
  await ctx.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* bỏ qua */ }
}

/* ---- Phòng đã đo trên điện thoại (bản 1.24): bảng ĐỌC kho đo hiện trạng trên máy chủ của xưởng bằng một mã kết nối ---- */
const MA_THU = 'mn-' + 'Ab3_-xY9'.repeat(4), GOC_SX = 'https://sx.test/api/do';      // mã giả đúng dạng; máy chủ giả (tên miền .test không có thật)
// Đúng thứ cửa /phong của kho trả về cho một phòng do trang đo gửi lên (xem test/phong.test.js): số đo thô + gói `gui` máy đo tính sẵn cho máy vẽ.
const PHONG_DO = () => ({ ct: { id: 'ct0000000001', ten: 'Nhà anh Hùng', dia_chi: 'Chiềng Sinh', ngay: '2026-10-04', nguoi_do: 'Thanh' }, nguoi_gui: 'Thanh', sua_luc: 1791100000000,
  muc: { id: 'muc000000001', loai: 'phong', ten: 'Phòng ngủ master', xong: true, ghi_chu: '',
    phong: { ban: 1, ten: 'Phòng ngủ master', cao: 2700, day: 110, tuong: [{ ten: 'A', dai: 3600, re: 90 }, { ten: 'B', dai: 3000, re: 90 }, { ten: 'C', dai: 0, re: 90 }, { ten: 'D', dai: 0, re: 90 }], mo: [], can: [], dn: [], khung: [] },
    gui: { ban: 1,
      phong: { ban: 1, ten: 'Phòng ngủ master', cao: 2700, day: 110, tuong: [{ ten: 'A', dai: 3600, re: 90 }, { ten: 'B', dai: 3000, re: 90 }, { ten: 'C', dai: 3600, re: 90 }, { ten: 'D', dai: 3000, re: 90 }],
        mo: [{ tuong: 2, loai: 'cua', cach: 200, rong: 900, cao: 2200, be: 0 }], can: [{ tuong: 1, loai: 'cot', cach: 1000, rong: 300, nho: 200, z0: 0, z1: 2700 }], dn: [], khung: [] },
      bo: ['Ổ điện 1 (mặt A)'], loi: [],
      anh: [{ id: 'anh000000001', tuong: 0, w: 800, h: 600, ghi: 'mặt có cửa sổ', co: 30.8, net: [[80, 300, 720, 300], [80, 286.1, 80, 313.9], [720, 286.1, 720, 313.9]], chu: [{ text: '3600', x: 400, y: 275.4, co: 30.8, goc: 0 }] },
        { id: 'anh000000002', tuong: null, w: 600, h: 800, ghi: 'toàn cảnh', co: 30.8, net: [], chu: [] }] } },
  anh_co: ['anh000000001'] });

async function tPhongDaDo() {
  console.log('— Tiện ích: phòng đã đo trên điện thoại tự hiện ở thẻ Phòng (máy chủ giả)');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mncf-do-'));
  const ctx = await chromium.launchPersistentContext(dir, { channel: 'chromium', headless: true, viewport: { width: 1500, height: 900 }, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  try {
    await ctx.route('https://api.cfcad.cn/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"err_code":1,"err_msg":"no"}' }));
    await require('./kho-gia.js')(ctx);
    await ctx.route('https://cfcad.cn/**', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: MOCK }));
    // Máy chủ GIẢ của xưởng: chỉ hai cửa ĐỌC mà máy vẽ dùng (/phong, /anh/<mã>), trả lời như kho thật — CORS chỉ mở cho trang Chenfeng, sai mã thì 401.
    const SX = { goi: [], ma: MA_THU, phong: [], anh: {}, che_do: 'ok', tre: 0, tre_ma: {}, toi: [] };      // tre: chậm mọi lời hỏi (ms) · tre_ma: chậm riêng theo mã trình · toi: lời hỏi ghi lúc vừa TỚI máy chủ (goi ghi lúc trả lời)
    // trình duyệt đang giữ một cookie của chính máy chủ đó (vd người vẽ từng mở trang đo trên máy này): bảng KHÔNG được gửi nó đi kèm
    await ctx.addCookies([{ name: 'phien_sx', value: 'bi-mat', domain: 'sx.test', path: '/', secure: true, sameSite: 'None' }]);
    const cors = { 'access-control-allow-origin': 'https://cfcad.cn', vary: 'Origin' };
    await ctx.route('https://sx.test/**', async r => {
      const q = r.request(), u = new URL(q.url()), method = q.method(), hd = await q.allHeaders();
      if (method === 'OPTIONS') return r.fulfill({ status: 204, headers: Object.assign({ 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'authorization' }, cors) });
      SX.toi.push(u.pathname);
      const tre = (hd.authorization || '') in SX.tre_ma ? SX.tre_ma[hd.authorization] : SX.tre;
      if (tre) await new Promise(res => setTimeout(res, tre));      // máy chủ trả lời chậm (mạng xưởng yếu)
      SX.goi.push([method, u.pathname + u.search, hd.authorization || '', hd.cookie ? 'có cookie' : '']);
      if (SX.che_do === 'mang') return r.abort('internetdisconnected');
      if (hd.authorization !== 'Bearer ' + SX.ma) return r.fulfill({ status: 401, contentType: 'application/json', headers: cors, body: JSON.stringify({ error: 'Mã kết nối không đúng hoặc đã bị thu hồi', code: 'UNAUTHENTICATED' }) });
      if (method === 'GET' && u.pathname === '/api/do/phong') return r.fulfill({ status: 200, contentType: 'application/json', headers: Object.assign({ 'cache-control': 'no-store' }, cors), body: JSON.stringify({ phong: SX.phong }) });
      const m = /^\/api\/do\/anh\/([a-z0-9]+)$/.exec(u.pathname);
      if (method === 'GET' && m && SX.anh[m[1]]) return r.fulfill({ status: 200, contentType: 'image/jpeg', headers: cors, body: SX.anh[m[1]] });
      return r.fulfill({ status: 404, contentType: 'application/json', headers: cors, body: '{"error":"Không tìm thấy","code":"NOT_FOUND"}' });
    });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
    await page.goto('https://cfcad.cn/');
    await page.waitForFunction(() => window.MNCF && window.MNCF.app, null, { timeout: 15000 });
    const H = page.locator('#mncf-host'), st = () => H.locator('.status').textContent(), B = H.locator('.pdo');
    const html = () => page.evaluate(() => document.getElementById('mncf-host').shadowRoot.innerHTML);
    const cat = () => page.evaluate(() => JSON.parse(localStorage.getItem('mncf.do.v1') || 'null'));
    const soDT = () => page.evaluate(() => window.__MOCK__.ents.filter(e => !e.IsErase).length);
    const lay = () => page.evaluate(() => window.MNCF.phong.lay());
    const cho = async (fn, ms) => { const het = Date.now() + (ms || 6000); for (;;) { const v = await fn(); if (v || Date.now() > het) return v; await page.waitForTimeout(60); } };
    // ảnh hiện trạng trên máy chủ: JPEG 800 × 600 một màu (dựng ngay trong trang để khỏi cần thư viện ảnh)
    SX.anh.anh000000001 = Buffer.from(await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 800; c.height = 600; const x = c.getContext('2d'); x.fillStyle = '#c9b79c'; x.fillRect(0, 0, 800, 600); const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92)); return [...new Uint8Array(await b.arrayBuffer())]; }));
    SX.phong = [PHONG_DO()];
    await H.locator('.launch').click(); await H.locator('.tab[data-tab="phong"]').click();

    // thẻ Hướng dẫn có nói tới cách nối (người mới cài bảng không biết khối này để làm gì)
    eq1(await page.evaluate(() => { const li = [...document.getElementById('mncf-host').shadowRoot.querySelectorAll('[data-pane="hd"] li')].find(x => /Phòng đã đo trên điện thoại/.test(x.textContent)); return li ? [/1\.24/.test(li.textContent), /chuỗi kết nối/i.test(li.textContent), /Lấy & vẽ/.test(li.textContent), /chỉ đọc/i.test(li.textContent)] : null; }), [true, true, true, true], 'thẻ Hướng dẫn: có mục "Phòng đã đo trên điện thoại" (bản 1.24) — nối thế nào, hai nút làm gì, bảng chỉ đọc');
    // --- chưa nối: có chỗ dán chuỗi kết nối, bảng không gọi đi đâu ---
    ok((await B.isVisible()) && /Phòng đã đo/i.test(await B.innerText()) && (await B.locator('[data-ui="do-chuoi"]').count()) === 1 && (await B.locator('[data-act="do-noi"]').isVisible()), 'thẻ Phòng có khối "Phòng đã đo trên điện thoại": chưa nối thì có ô dán chuỗi kết nối + nút Nối máy chủ', await B.innerText().catch(() => ''));
    eq1(await B.locator('[data-ui="do-chuoi"]').evaluate(e => [e.type, getComputedStyle(e).webkitTextSecurity, e.autocomplete]), ['text', 'disc', 'off'], 'ô dán chuỗi che chữ như ô mật khẩu (mã không nằm phơi trên màn hình) nhưng KHÔNG phải ô mật khẩu — trình duyệt khỏi mời "lưu mật khẩu" cho trang Chenfeng');
    await page.waitForTimeout(400);
    eq1([SX.goi, await cat()], [[], null], 'chưa nối: không gọi máy chủ nào, chưa cất gì');
    await B.locator('[data-ui="do-chuoi"]').fill(MA_THU); await B.locator('[data-ui="do-chuoi"]').press('Enter'); await page.waitForTimeout(200);
    ok(/thiếu địa chỉ máy chủ/i.test(await B.locator('.pdo-bao').innerText()) && SX.goi.length === 0 && (await cat()) === null, 'dán chuỗi thiếu địa chỉ rồi Enter: báo rõ, không gọi đi đâu, không cất gì', await B.locator('.pdo-bao').innerText());
    eq1(await B.locator('[data-ui="do-chuoi"]').inputValue(), MA_THU, 'chuỗi đang gõ còn nguyên trong ô để sửa');

    // --- nối: hỏi đúng cửa, trình mã trong tiêu đề, danh sách phòng hiện ra ---
    await B.locator('[data-ui="do-chuoi"]').fill(`${GOC_SX}#${MA_THU}`); await B.locator('[data-act="do-noi"]').click();
    await B.locator('.pdo-r').first().waitFor({ timeout: 6000 });
    eq1(SX.goi, [['GET', '/api/do/phong', 'Bearer ' + MA_THU, '']], 'nối: hỏi đúng cửa /phong, trình mã trong tiêu đề Authorization, KHÔNG gửi cookie nào theo');
    eq1([(await cat()).goc, (await cat()).ma], [GOC_SX, MA_THU], 'chuỗi kết nối được cất trên máy này (lần sau khỏi dán lại)');
    ok(!(await html()).includes(MA_THU), 'mã không hiện lại ở đâu trên bảng');
    const R = B.locator('.pdo-r').first(), chuR = await R.innerText();
    ok(/Phòng ngủ master/.test(chuR) && /Nhà anh Hùng/.test(chuR) && /Thanh/.test(chuR) && /4 tường/.test(chuR) && /10,8 m²/.test(chuR) && /trần 2700/.test(chuR), 'dòng phòng: tên phòng, công trình, người gửi, tóm tắt số đo', chuR);
    ok((await R.locator('.moi').count()) === 1 && /2 ảnh/.test(chuR) && /1 ảnh chưa lên máy chủ/i.test(chuR) && /chưa đưa sang.*Ổ điện 1 \(mặt A\)/i.test(chuR), 'đánh dấu "mới"; ghi số ảnh, ảnh điện thoại chưa gửi lên, chi tiết máy đo chưa đưa sang', chuR);
    ok(/sx\.test/.test(await B.locator('.pdo-tt').innerText()) && (await B.locator('[data-act="do-moi"]').isVisible()) && (await B.locator('[data-act="do-ngat"]').isVisible()), 'dòng tình trạng: đang nối máy chủ nào, có nút Làm mới + Ngắt', await B.locator('.pdo-tt').innerText());
    ok(!(await R.locator('[data-act="do-lay"]').isDisabled()) && !(await R.locator('[data-act="do-ve"]').isDisabled()), 'phòng đủ số: có "Lấy phòng" và "Lấy & vẽ"');

    // --- Lấy phòng: số đo vào thẻ Phòng, ảnh có nét kích thước vào dãy ảnh; KHÔNG vẽ gì ---
    const n0 = await soDT();
    await R.locator('[data-act="do-lay"]').click();
    await page.waitForFunction(() => document.getElementById('mncf-host').shadowRoot.querySelectorAll('.thumb').length === 1, null, { timeout: 8000 }).catch(() => {});
    let p = await lay();
    eq1([p.ten, p.cao, p.tuong.map(t => t.dai), p.mo.map(m => [m.tuong, m.cach, m.rong, m.cao]), p.can.map(c => [c.tuong, c.cach, c.rong, c.nho])], ['Phòng ngủ master', 2700, [3600, 3000, 3600, 3000], [[2, 200, 900, 2200]], [[1, 1000, 300, 200]]], '"Lấy phòng": số đo máy đo đã tính vào đúng thẻ Phòng (4 cạnh là số thật, cửa, cột)');
    ok(/4 tường · chu vi 13,2 m · diện tích 10,8 m²/.test(await H.locator('.psum').innerText()) && /Phòng ngủ master/.test(await st()), 'mặt bằng vẽ lại theo phòng vừa lấy, dòng trạng thái nói đã lấy phòng nào', await st());
    eq1(await soDT(), n0, 'lấy phòng KHÔNG vẽ gì vào bản vẽ (chưa ai bấm vẽ)');
    eq1(SX.goi.filter(g => /\/anh\//.test(g[1])), [['GET', '/api/do/anh/anh000000001', 'Bearer ' + MA_THU, '']], 'ảnh: chỉ tải ảnh máy chủ đã có (ảnh điện thoại chưa gửi thì không hỏi), có trình mã, không cookie');
    const mau = await page.evaluate(async () => {
      const img = document.getElementById('mncf-host').shadowRoot.querySelector('.thumb img'), i2 = new Image(); i2.src = img.src; await i2.decode();
      const c = document.createElement('canvas'); c.width = i2.naturalWidth; c.height = i2.naturalHeight; const x = c.getContext('2d'); x.drawImage(i2, 0, 0);
      const px = (X, Y) => [...x.getImageData(X, Y, 1, 1).data].slice(0, 3);
      return { co: [c.width, c.height], net: px(250, 300), nen: px(400, 450), nhan: px(362, 262), ten: img.alt };
    });
    const doThat = c => c[0] > 180 && c[1] < 110 && c[2] < 110;
    ok(mau.co[0] === 800 && mau.co[1] === 600 && doThat(mau.net) && !doThat(mau.nen) && mau.nen[0] > 170 && mau.nen[1] > 150, 'ảnh vào dãy "Ảnh hiện trạng" đã có NÉT kích thước kẻ sẵn, đúng chỗ máy đo ghi (nền ảnh giữ nguyên)', mau);
    ok(doThat(mau.nhan), 'và nhãn số của nét đó (ô đỏ, chữ trắng)', mau);
    ok(/Mặt A/.test(mau.ten) && /Phòng ngủ master/.test(mau.ten), 'tên ảnh ghi mặt nào của phòng nào', mau.ten);
    ok((await R.locator('.moi').count()) === 0 && (await cat()).da_lay['ct0000000001/muc000000001'] === 1791100000000, 'lấy rồi thì hết "mới"; máy này nhớ đã lấy bản nào');

    // --- anh đánh dấu một khung tủ trên phòng vừa lấy; máy đo sửa tiếp → Làm mới thấy "mới" lại → lấy bản mới: số đổi, KHUNG của anh còn, ảnh không chồng thêm ---
    await H.locator('[data-act="k-add"]').click(); await page.waitForTimeout(250);
    eq1((await lay()).khung.length, 1, '(chuẩn bị) thêm một khung tủ trên phòng vừa lấy');
    const moi = PHONG_DO(); moi.sua_luc += 60000; moi.muc.gui.phong.tuong[0].dai = 4000; moi.muc.gui.phong.tuong[2].dai = 4000;
    const bep = PHONG_DO(); bep.muc.id = 'muc000000002'; bep.muc.ten = 'Bếp <img src=x onerror="window.__xss=1">'; bep.sua_luc -= 5000; bep.muc.gui.phong.tuong[1].dai = 0; bep.muc.gui.phong.tuong[3].dai = 0; bep.muc.gui.phong.can = []; bep.muc.gui.loi = ['Tường B chưa có chiều dài.', 'Tường D chưa có chiều dài.']; bep.muc.gui.anh = []; bep.anh_co = [];
    const cuKy = PHONG_DO(); cuKy.muc.id = 'muc000000003'; cuKy.muc.ten = 'Phòng thờ'; cuKy.sua_luc -= 9000; delete cuKy.muc.gui;
    SX.phong = [moi, bep, cuKy]; SX.goi.length = 0;
    await B.locator('[data-act="do-moi"]').click();
    ok(await cho(async () => (await B.locator('.pdo-r').count()) === 3 && (await B.locator('.pdo-r').first().locator('.moi').count()) === 1), 'máy đo sửa tiếp: bấm "Làm mới" → 3 phòng, phòng vừa sửa đứng đầu và lại là "mới"', await B.innerText());
    await B.locator('.pdo-r').first().locator('[data-act="do-lay"]').click();
    ok(await cho(async () => (await lay()).tuong[0].dai === 4000), 'lấy bản mới của cùng phòng: số đo đổi theo (A = 4000)');
    p = await lay();
    eq1([p.tuong.map(t => t.dai), p.khung.length], [[4000, 3000, 4000, 3000], 1], 'lấy lại CÙNG phòng: khung tủ anh đã đánh dấu vẫn còn');
    await page.waitForTimeout(500);
    eq1(await H.locator('.thumb').count(), 1, 'ảnh của phòng đó được thay bằng bản mới, không chồng thêm');
    // --- phòng chưa đủ số: lấy về xem được, KHÔNG có "Lấy & vẽ"; tên lạ hiện như chữ ---
    const RB = B.locator('.pdo-r').nth(1), chuB = await RB.innerText();
    ok(/Bếp <img/.test(chuB) && (await page.evaluate(() => window.__xss)) === undefined && (await RB.locator('img').count()) === 0, 'tên phòng có ký tự lạ: hiện như chữ, không thành thẻ HTML', chuB);
    ok(/Tường B chưa có chiều dài/.test(chuB) && (await RB.locator('[data-act="do-ve"]').isDisabled()) && !(await RB.locator('[data-act="do-lay"]').isDisabled()), 'phòng chưa đủ số: nêu thiếu gì, khoá "Lấy & vẽ", vẫn "Lấy phòng" được', chuB);
    // --- trang đo bản cũ (chưa có gói cho máy vẽ): không đoán ---
    const RC = B.locator('.pdo-r').nth(2), chuC = await RC.innerText();
    ok(/Phòng thờ/.test(chuC) && /mở lại phòng này trên điện thoại/i.test(chuC) && (await RC.locator('[data-act="do-lay"]').isDisabled()) && (await RC.locator('[data-act="do-ve"]').isDisabled()), 'phòng gửi từ trang đo bản cũ: nói cách làm (mở lại trên điện thoại), hai nút đều khoá', chuC);

    // --- "Lấy & vẽ": một lần bấm = lấy số đo + vẽ phòng bằng lệnh phòng của Chenfeng ---
    const n1 = await soDT();
    await B.locator('.pdo-r').first().locator('[data-act="do-ve"]').click();
    await page.waitForFunction(() => /Đã vẽ phòng|Chưa vẽ xong/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.pkq').innerText), null, { timeout: 40000 }).catch(() => {});
    const kq = await H.locator('.pkq').innerText();
    ok(/Đã vẽ phòng: 4 tường, 1 cửa \/ ô trống, 1 cột \/ hộp/.test(kq) && (await soDT()) > n1, '"Lấy & vẽ": phòng vào bản vẽ (4 tường, cửa, cột)', kq);
    eq1(await page.evaluate(() => { const M = window.__MOCK__, w = M.ents.filter(e => !e.IsErase && e instanceof M.RoomWallLine); return w.length; }), 4, 'bản vẽ có đúng 4 tường của phòng đó');

    // --- người vẽ đổi sang PHÒNG KHÁC ở thẻ Phòng (phòng mẫu) rồi đánh dấu khung trên đó: lấy phòng đã đo về thì KHÔNG mang khung của phòng lạ theo ---
    await H.locator('[data-act="p-mau"]').click(); await page.waitForTimeout(150);
    await H.locator('[data-act="k-add"]').click(); await page.waitForTimeout(250);
    eq1([(await lay()).tuong.map(t => t.dai), (await lay()).khung.length, (await cat()).nguon], [[3600, 3000, 3600, 'auto'], 1, ''], '(chuẩn bị) về phòng mẫu + thêm một khung: phòng ở thẻ Phòng không còn là phòng lấy từ máy chủ');
    await B.locator('.pdo-r').first().locator('[data-act="do-lay"]').click();
    ok(await cho(async () => (await lay()).tuong[0].dai === 4000), 'lấy lại phòng đã đo');
    eq1([(await lay()).khung.length, (await cat()).nguon], [0, 'ct0000000001/muc000000001'], 'phòng trước đó là phòng KHÁC: khung của nó không bị gán sang phòng vừa lấy');
    await cho(async () => (await H.locator('.thumb').count()) === 1, 4000);
    // --- ↶ Lùi của thẻ Phòng (bản 1.25) giữ đúng "phòng này lấy từ đâu": lùi một bước sửa TRONG phòng đã đo thì nó vẫn là phòng đã đo đó; lùi QUA lần lấy phòng thì không còn ---
    await H.locator('[data-act="k-add"]').click(); await page.waitForTimeout(250);
    await H.locator('[data-act="k-add"]').click(); await page.waitForTimeout(250);
    eq1((await lay()).khung.length, 2, '(chuẩn bị) hai khung trên phòng đã đo');
    await H.locator('[data-act="p-lui"]').click(); await page.waitForTimeout(200);
    eq1([(await lay()).khung.length, (await cat()).nguon], [1, 'ct0000000001/muc000000001'], '↶ Lùi một bước sửa trong phòng đã đo: còn 1 khung, phòng vẫn được nhớ là phòng lấy từ máy chủ');
    await H.locator('[data-act="p-lui"]').click(); await page.waitForTimeout(200);
    eq1([(await lay()).tuong[0].dai, (await lay()).khung.length, (await cat()).nguon], [4000, 0, 'ct0000000001/muc000000001'], '↶ Lùi thêm bước nữa (về lúc vừa lấy phòng, chưa có khung): vẫn là phòng lấy từ máy chủ');
    await H.locator('[data-act="k-add"]').click(); await page.waitForTimeout(250);
    await B.locator('.pdo-r').first().locator('[data-act="do-lay"]').click(); await page.waitForTimeout(400);
    eq1([(await lay()).tuong[0].dai, (await lay()).khung.length], [4000, 1], '… nên lấy lại CÙNG phòng sau khi lùi: khung đã đánh dấu vẫn còn');
    let veMau = false;
    for (let i = 0; i < 8 && !veMau; i++) { if (await H.locator('[data-act="p-lui"]').isDisabled()) break; await H.locator('[data-act="p-lui"]').click(); await page.waitForTimeout(200); veMau = (await lay()).tuong[3].dai === 'auto'; }
    eq1([veMau, (await lay()).tuong.map(t => t.dai), (await lay()).khung.length, (await cat()).nguon], [true, [3600, 3000, 3600, 'auto'], 1, ''], '↶ Lùi tiếp qua lần "Lấy phòng": về phòng mẫu + khung của nó, và phòng ở thẻ Phòng KHÔNG còn là phòng lấy từ máy chủ');
    await B.locator('.pdo-r').first().locator('[data-act="do-lay"]').click();
    ok(await cho(async () => (await lay()).tuong[0].dai === 4000), '(lấy lại phòng đã đo)');
    eq1([(await lay()).khung.length, (await cat()).nguon], [0, 'ct0000000001/muc000000001'], '… nên lấy phòng đã đo về lúc này: khung của phòng mẫu không bị gán sang');
    await cho(async () => (await H.locator('.thumb').count()) === 1, 4000);
    // --- đang tải ảnh của phòng này (máy chủ chậm) mà lấy sang phòng khác: ảnh của phòng trước không được lẫn vào phòng sau ---
    SX.tre = 500;
    await B.locator('.pdo-r').first().locator('[data-act="do-lay"]').click(); await page.waitForTimeout(120);      // phòng ngủ master: 1 ảnh, đang tải…
    await B.locator('.pdo-r').nth(1).locator('[data-act="do-lay"]').click();      // …thì lấy sang Bếp (không có ảnh)
    await page.waitForTimeout(1300); SX.tre = 0;
    eq1([(await lay()).ten.slice(0, 3), await H.locator('.thumb').count()], ['Bếp', 0], 'lấy phòng khác giữa lúc ảnh phòng trước còn đang tải: dãy ảnh là của phòng SAU (không có ảnh), ảnh phòng trước không lẫn vào');
    await B.locator('.pdo-r').first().locator('[data-act="do-lay"]').click();
    await cho(async () => (await H.locator('.thumb').count()) === 1, 4000);

    // --- tự làm mới theo nhịp (không ai bấm) ---
    SX.goi.length = 0;
    await page.evaluate(() => window.MNCF.app.datDo({ lap: 250 }));
    ok(await cho(() => SX.goi.filter(g => g[1] === '/api/do/phong').length >= 2, 3000), 'đang mở thẻ Phòng: bảng tự hỏi lại máy chủ theo nhịp (đo xong là tự thấy, không ai phải bấm)', SX.goi.length);
    await H.locator('.tab[data-tab="tu"]').click(); await page.waitForTimeout(350); SX.goi.length = 0; await page.waitForTimeout(700);
    eq1(SX.goi.length, 0, 'sang thẻ khác: thôi hỏi (không gọi máy chủ khi không ai nhìn)');
    // nhịp 1,5 giây, đã vắng hơn thế (350 + 700 + 600): quay lại là hỏi NGAY — không hẹn thêm một nhịp rồi mới hỏi
    await page.evaluate(() => window.MNCF.app.datDo({ lap: 1500 })); await page.waitForTimeout(600);
    await H.locator('.tab[data-tab="phong"]').click(); await page.waitForTimeout(450);
    eq1(SX.goi.filter(g => g[1] === '/api/do/phong').length, 1, 'quay lại thẻ Phòng sau khi vắng hơn một nhịp: hỏi lại NGAY (không ngồi chờ thêm một nhịp)');
    await H.locator('.tab[data-tab="tu"]').click(); await H.locator('.tab[data-tab="phong"]').click(); await page.waitForTimeout(350);
    eq1(SX.goi.filter(g => g[1] === '/api/do/phong').length, 1, 'vừa hỏi xong mà đổi thẻ qua lại: không hỏi dồn');
    await page.evaluate(() => window.MNCF.app.datDo({ lap: 600000 }));

    // --- mất mạng: giữ danh sách cũ, nói rõ; có mạng lại bấm Làm mới là được ---
    SX.che_do = 'mang';
    await B.locator('[data-act="do-moi"]').click();
    ok(await cho(async () => /không tới được máy chủ/i.test(await B.locator('.pdo-tt').innerText())), 'mất mạng: báo không tới được máy chủ', await B.locator('.pdo-tt').innerText());
    eq1(await B.locator('.pdo-r').count(), 3, 'danh sách đang có vẫn giữ');
    SX.che_do = 'ok';
    await B.locator('[data-act="do-moi"]').click();
    ok(await cho(async () => /đã nối/i.test(await B.locator('.pdo-tt').innerText())), 'có mạng lại: Làm mới → nối lại bình thường', await B.locator('.pdo-tt').innerText());

    // --- mã bị thu hồi: nói rõ, thôi hỏi; ngắt kết nối thì xoá mã khỏi máy ---
    SX.ma = 'mn-' + 'Zz9_-aB1'.repeat(4);
    await B.locator('[data-act="do-moi"]').click();
    ok(await cho(async () => /không đúng hoặc đã bị thu hồi/i.test(await B.locator('.pdo-tt').innerText())), 'mã bị thu hồi: báo rõ, bảo xin chuỗi mới', await B.locator('.pdo-tt').innerText());
    eq1(await B.locator('.pdo-r').count(), 0, 'mã hết hiệu lực: không còn bày danh sách phòng (số đo nhà khách)');
    await page.evaluate(() => window.MNCF.app.datDo({ lap: 200 })); SX.goi.length = 0; await page.waitForTimeout(700);
    eq1(SX.goi.length, 0, 'mã đã bị từ chối: thôi tự hỏi lại (không gõ cửa máy chủ mãi bằng mã hỏng)');
    await H.locator('.tab[data-tab="tu"]').click(); await H.locator('.tab[data-tab="phong"]').click(); await page.waitForTimeout(400);
    eq1(SX.goi.length, 0, 'mã đã bị từ chối: đổi thẻ qua lại cũng không tự hỏi lại (muốn thử lại thì bấm Làm mới)');
    // nối lại bằng chuỗi đúng, rồi NGẮT giữa lúc máy chủ còn chưa trả lời: câu trả lời tới sau không được dựng lại danh sách
    await B.locator('[data-act="do-ngat"]').click();
    await cho(async () => (await B.locator('[data-ui="do-chuoi"]').count()) === 1);
    SX.tre = 500;
    await B.locator('[data-ui="do-chuoi"]').fill(`${GOC_SX}#${SX.ma}`); await B.locator('[data-act="do-noi"]').click(); await page.waitForTimeout(120);
    await B.locator('[data-act="do-ngat"]').click(); await page.waitForTimeout(1100); SX.tre = 0;
    eq1([await B.locator('.pdo-r').count(), await B.locator('[data-ui="do-chuoi"]').count(), await cat()], [0, 1, null], 'ngắt giữa lúc đang hỏi: câu trả lời tới sau bị bỏ — không bày danh sách, không cất gì');
    // ngắt giữa lúc đang hỏi rồi NỐI LẠI ngay bằng chuỗi KHÁC: câu trả lời của lần hỏi cũ (mã cũ, 3 phòng) về trước — không được bày ra dưới kết nối mới
    const MA_KHAC = 'mn-' + 'Qq7_-kL2'.repeat(4);
    SX.tre_ma = { ['Bearer ' + SX.ma]: 400, ['Bearer ' + MA_KHAC]: 2600 }; SX.toi.length = 0;
    await B.locator('[data-ui="do-chuoi"]').fill(`${GOC_SX}#${SX.ma}`); await B.locator('[data-act="do-noi"]').click(); await page.waitForTimeout(100);
    await B.locator('[data-act="do-ngat"]').click();
    await B.locator('[data-ui="do-chuoi"]').fill(`${GOC_SX}#${MA_KHAC}`); await B.locator('[data-act="do-noi"]').click();
    await page.waitForTimeout(900);      // lần hỏi cũ đã về (sau 0,4 giây), lần hỏi mới còn chờ (2,6 giây)
    eq1([await B.locator('.pdo-r').count(), /đang hỏi máy chủ/i.test(await B.locator('.pdo-tt').innerText())], [0, true], 'nối lại bằng chuỗi khác khi lần hỏi cũ chưa về: danh sách của lần hỏi cũ không hiện dưới kết nối mới', await B.locator('.pdo-tt').innerText());
    await B.locator('[data-act="do-moi"]').click(); await page.waitForTimeout(300);
    eq1(SX.toi.filter(p => p === '/api/do/phong').length, 2, 'lần hỏi mới còn đang chờ: bấm Làm mới không gửi thêm lời hỏi thứ ba (lần hỏi cũ kết thúc không được xoá dấu "đang hỏi" của lần mới)');
    ok(await cho(async () => /không đúng hoặc đã bị thu hồi/i.test(await B.locator('.pdo-tt').innerText()), 5000), 'lần hỏi mới về: mã khác đó không đúng → báo rõ', await B.locator('.pdo-tt').innerText());
    eq1(await B.locator('.pdo-r').count(), 0, 'và không có phòng nào được bày');
    SX.tre_ma = {};
    await B.locator('[data-act="do-ngat"]').click();
    await cho(async () => (await B.locator('[data-ui="do-chuoi"]').count()) === 1);
    await B.locator('[data-ui="do-chuoi"]').fill(`${GOC_SX}#${SX.ma}`); await B.locator('[data-act="do-noi"]').click();
    ok(await cho(async () => (await B.locator('.pdo-r').count()) === 3), '(nối lại để thử bước ngắt)');
    await B.locator('[data-act="do-ngat"]').click();
    ok(await cho(async () => (await B.locator('[data-ui="do-chuoi"]').count()) === 1), 'bấm "Ngắt": về lại ô dán chuỗi');
    const sau = await cat();
    ok(!sau || (!sau.ma && !sau.goc), 'ngắt kết nối: mã và địa chỉ bị xoá khỏi máy này', sau);
    ok(!/mn-[A-Za-z0-9_-]{20,}/.test(await page.evaluate(() => JSON.stringify(Object.assign({}, localStorage)))), 'không còn mã nào trong bộ nhớ trình duyệt');
    SX.goi.length = 0; await page.waitForTimeout(600);
    eq1(SX.goi.length, 0, 'đã ngắt: không gọi máy chủ nữa');
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
  await tPhongDaDo();
  console.log(`\n${pass} đạt, ${fail} hỏng`);
  process.exit(fail ? 1 : 0);
})();
