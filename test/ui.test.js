'use strict';
// Kiểm tra giao diện (trang độc lập + bản artifact) bằng Chromium không màn hình:
//   NODE_PATH=<thư mục node_modules có playwright> PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node test/ui.test.js
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const DIST = path.join(__dirname, '..', 'dist');
let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) pass++; else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); } };
const near = (a, b, tol = 0.06) => Math.abs(a - b) <= tol;

const TU_2000 = { ma: 'TA2', rong: 2000, cao: 2800, chan: { cao: 50 }, khoang: [
  { rong: 'auto', canh: 2, dot: [1800], o: [{ tu: 0, kieu: 'suot' }] },
  { rong: 'auto', canh: 2, dot: [520, 1800], o: [{ tu: 0, kieu: 'nk_am', so: 2 }, { tu: 520, kieu: 'suot' }] } ] };

// các hàm chạy trong trang
const inPage = {
  spec: () => window.MNCF.app.getSpec(),
  model: () => { const M = window.MNCF.app.getModel(); return { errors: M.errors, warnings: M.warnings, parts: M.parts.length, mat: M.mat_ngan_keo.map(q => [q.x, q.z, q.w, q.h, q.trum]), o: M.info.o, tpl: M.templates.filter(t => t.loai === 'NGAN_KEO').map(t => [t.khoang, t.kieu, t.id, t.ma_loai, t.params]), canh: M.parts.filter(p => p.loai === 'CANH').map(p => [p.khoang, p.z0, p.z1]), dem: M.parts.filter(p => p.loai === 'DEM').length }; },
  // tâm (px) của một vùng trên hình: data-dot="i:j" hoặc data-o="i:tu"
  center: (sel) => { const sh = document.getElementById('mncf-host').shadowRoot; const e = sh.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height, w: r.width }; },
  scale: () => { const sh = document.getElementById('mncf-host').shadowRoot; const g = sh.querySelector('.view svg'); const r = g.getBoundingClientRect(); return r.height / g.viewBox.baseVal.height; },
  bar: () => { const sh = document.getElementById('mncf-host').shadowRoot; return sh.querySelector('.edbar').innerText; },
  status: () => { const sh = document.getElementById('mncf-host').shadowRoot; return sh.querySelector('.status').textContent; },
  overflow: () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
};
const S = (page, sel) => page.locator('#mncf-host').locator(sel);      // Playwright tự xuyên shadow DOM mở

async function open(browser, file, opt) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }, opt || {}));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('file://' + file);
  await page.waitForFunction(() => window.MNCF && window.MNCF.app && window.MNCF.app.getModel());
  return { ctx, page, errs };
}

async function testPage(browser) {
  console.log('— Trang độc lập: kéo đợt, đặt ngăn kéo các loại');
  const { ctx, page, errs } = await open(browser, path.join(DIST, 'mn-chenfeng.html'));
  ok(/v1\.26\./.test(await S(page, '.brand').innerText()), 'ghi đúng phiên bản');
  let m = await page.evaluate(inPage.model);
  ok(m.errors.length === 0 && m.parts === 71, 'tủ mẫu dựng 71 tấm (2 thùng rời: thêm 2 hồi; có xà + nẹp che khe hộc ngăn kéo), không lỗi', m.parts);
  // bộ mẫu tủ áo: chọn mẫu → bấm Dùng mẫu → kích thước, khoang đổi theo; Chuẩn xưởng giữ nguyên
  ok((await S(page, '#mncf-ui-mau option').count()) >= 8 && /3000 × 2800|1000 × 2800/.test(await S(page, '[data-ui="mau-mota"]').innerText()), 'có danh sách mẫu tủ áo, có dòng mô tả');
  await S(page, '#mncf-ui-mau').selectOption('TA4-2000-2T');
  ok(/2000 × 2800 — 2 cánh: hai tầng treo · 2 cánh: 3 ngăn kéo \+ treo ngắn/.test(await S(page, '[data-ui="mau-mota"]').innerText()), 'đổi mẫu → mô tả đổi theo');
  await S(page, '[data-act="mau"]').click();
  const spMau = await page.evaluate(() => window.MNCF.app.getSpec()); m = await page.evaluate(inPage.model);
  ok(spMau.rong === 2000 && spMau.khoang.length === 2 && spMau.khoang[1].o[0].so === 3 && m.errors.length === 0 && /Đã dùng mẫu/.test(await page.evaluate(inPage.status)), 'Dùng mẫu: ra tủ 4 cánh 2000, 3 ngăn kéo, không lỗi', [spMau.rong, spMau.khoang.length, m.errors]);
  ok((await S(page, 'input[data-k="rong"]').inputValue()) === '2000', 'ô nhập bề rộng cập nhật theo mẫu');
  await S(page, '#mncf-ui-mau').selectOption('TA6-3000'); await S(page, '[data-act="mau"]').click();
  m = await page.evaluate(inPage.model);
  ok(m.errors.length === 0 && m.parts === 70, 'về mẫu 6 cánh 3000: 70 tấm (2 thùng rời)', m.parts);
  ok(await S(page, '.pri[data-act="json"]').isVisible() && !(await S(page, '[data-act="draw"]').count()), 'trang độc lập: có nút tải JSON, không có nút vẽ');

  await page.evaluate(s => window.MNCF.app.setSpec(s), TU_2000);
  m = await page.evaluate(inPage.model);
  ok(m.parts === 46 && m.dem === 2 && JSON.stringify(m.mat) === JSON.stringify([[1061, 69.5, 819.5, 203, false], [1061, 294.5, 819.5, 203, false]]), 'tủ 2000: 2 vách đệm, mặt ngăn kéo 819,5 × 203', m.mat);

  /* 1. kéo đợt +520 của khoang 2 lên 100 mm (bắt bước 5) */
  const k = await page.evaluate(inPage.scale);
  let c = await page.evaluate(inPage.center, '[data-dot="1:0"]');
  ok(c && c.h >= 13, 'vùng kéo của đợt cao ít nhất ~14 px (dễ bắt)', c && c.h);
  await page.mouse.move(c.x, c.y); await page.mouse.down();
  await page.mouse.move(c.x, c.y - 100 * k / 2, { steps: 4 }); await page.mouse.move(c.x, c.y - 100 * k, { steps: 4 });
  await page.mouse.up();
  let sp = await page.evaluate(inPage.spec);
  ok(Math.abs(sp.khoang[1].dot[0] - 620) <= 5 && sp.khoang[1].dot[0] % 5 === 0, 'kéo lên 100 mm → đợt ≈ +620, bắt bước 5', sp.khoang[1].dot);
  const z1 = sp.khoang[1].dot[0];
  ok(JSON.stringify(sp.khoang[1].o) === JSON.stringify([{ tu: 0, kieu: 'nk_am', so: 2 }, { tu: z1, kieu: 'suot' }].map(x => x)) || (sp.khoang[1].o.some(x => x.kieu === 'suot' && x.tu === z1) && sp.khoang[1].o.some(x => x.kieu === 'nk_am')), 'suốt treo đi theo đợt, ngăn kéo vẫn ở ô dưới', sp.khoang[1].o);
  m = await page.evaluate(inPage.model);
  ok(m.errors.length === 0 && m.mat.length === 2 && m.mat[0][3] > 203, 'mặt ngăn kéo tự cao lên theo ô', m.mat);
  ok((await S(page, '#mncf-b1-dot').inputValue()) === `${z1}, 1800`, 'ô nhập "Đợt" của khoang 2 cập nhật theo', await S(page, '#mncf-b1-dot').inputValue());
  ok(/đợt 1\/2/.test(await page.evaluate(inPage.bar)), 'thanh sửa hiện đợt đang chọn');
  ok(!(await S(page, '[data-act="lui"]').isDisabled()), 'nút Lùi bật sau khi kéo');

  /* 2. kéo quá giới hạn: bị chặn dưới đợt +1800 (cách 20 + dày ván) */
  c = await page.evaluate(inPage.center, '[data-dot="1:0"]');
  await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.mouse.move(c.x, Math.max(4, c.y - 1500 * k), { steps: 6 }); await page.mouse.up();      // (giữ con trỏ trong khung nhìn: sự kiện chuột ngoài khung không tới trang khi điều khiển bằng máy)
  await page.waitForTimeout(300);
  sp = await page.evaluate(inPage.spec);
  ok(near(sp.khoang[1].dot[0], 1800 - 17.5 - 20), 'kéo quá tay → dừng cách đợt trên 20 mm', sp.khoang[1].dot);
  m = await page.evaluate(inPage.model);
  ok(m.errors.length > 0 || m.warnings.length > 0, 'ô ngăn kéo cao quá / ô suốt thấp quá → có báo', [m.errors, m.warnings]);

  /* 3. Lùi 2 lần → về +520 */
  await S(page, '[data-act="lui"]').click(); await S(page, '[data-act="lui"]').click();
  sp = await page.evaluate(inPage.spec);
  ok(sp.khoang[1].dot[0] === 520 && sp.khoang[1].o.some(x => x.kieu === 'suot' && x.tu === 520), 'Lùi 2 bước → đợt về +520, suốt treo về theo', sp.khoang[1]);

  /* 4. gõ cao độ chính xác cho đợt đang chọn */
  c = await page.evaluate(inPage.center, '[data-dot="1:0"]');
  await page.mouse.click(c.x, c.y);
  await S(page, '#mncf-ed-z').fill('612,5'); await S(page, '#mncf-ed-z').press('Enter');
  sp = await page.evaluate(inPage.spec);
  ok(sp.khoang[1].dot[0] === 612.5, 'gõ 612,5 → đợt +612,5', sp.khoang[1].dot);
  /* phím mũi tên nhích 1 mm, Shift = 10 mm */
  await S(page, '.view').focus(); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Shift+ArrowDown');
  sp = await page.evaluate(inPage.spec);
  ok(near(sp.khoang[1].dot[0], 603.5), '↑ rồi Shift+↓ → +603,5', sp.khoang[1].dot);

  /* 5. bấm đúp vào ô trên cùng của khoang 1 (thân dưới) → thêm đợt */
  await page.evaluate(s => window.MNCF.app.setSpec(s), TU_2000);
  c = await page.evaluate(inPage.center, '[data-o="0:50"]');
  await page.mouse.dblclick(c.x, c.y);
  sp = await page.evaluate(inPage.spec);
  ok(sp.khoang[0].dot.length === 2 && sp.khoang[0].dot[0] > 300 && sp.khoang[0].dot[0] < 1700 && sp.khoang[0].dot[0] % 5 === 0, 'bấm đúp → thêm 1 đợt giữa ô, bắt bước 5', sp.khoang[0].dot);
  ok(sp.khoang[0].o.length === 1 && sp.khoang[0].o[0].kieu === 'suot' && sp.khoang[0].o[0].tu === sp.khoang[0].dot[0], 'suốt treo theo lên ô trên (bám tấm phía trên)', sp.khoang[0].o);

  /* 6. bấm vào ô dưới mới → đặt ngăn kéo trùm ngoài, tăng số ngăn */
  c = await page.evaluate(inPage.center, '[data-o="0:50"]');
  await page.mouse.click(c.x, c.y);
  ok(/Khoang 1/.test(await page.evaluate(inPage.bar)) && (await S(page, '.edbar .segb').count()) === 4, 'thanh sửa hiện 4 lựa chọn cho ô');
  await S(page, '.edbar .segb[data-v="nk_trum"]').click();
  m = await page.evaluate(inPage.model);
  const trum0 = m.mat.filter(q => q[4]).length;
  ok(trum0 >= 1 && m.errors.length === 0, 'đặt ngăn kéo trùm ngoài (số ngăn tự đề xuất theo chiều cao ô)', m.mat);
  await S(page, '[data-ed="so+"]').click();
  m = await page.evaluate(inPage.model);
  ok(m.mat.filter(q => q[4]).length === trum0 + 1, 'bấm + → thêm 1 ngăn', m.mat.length);
  const canhK0 = m.canh.filter(x => x[0] === 0 && x[2] <= 2200);
  ok(canhK0.length === 2 && canhK0.every(x => x[1] > 300), 'cánh khoang 1 tự cắt ngắn, bắt đầu phía trên mặt ngăn kéo', canhK0);
  ok(/trùm ngoài/.test(await S(page, '.bay[data-i="0"] .noi').innerText()), 'thẻ khoang ghi nội dung ô');

  /* 7. đổi sang ngăn kéo âm → có vách đệm; sang Trống → hết */
  await S(page, '.edbar .segb[data-v="nk_am"]').click();
  m = await page.evaluate(inPage.model);
  ok(m.dem === 4 && m.mat.filter(q => !q[4]).length >= 3, 'đổi sang ngăn kéo âm → thêm 2 vách đệm cho khoang 1', [m.dem, m.mat.length]);
  /* 7b. chọn LOẠI ngăn kéo cho ô (mỗi loại = một mẫu trong kho Chenfeng) */
  ok((await S(page, '#mncf-ed-loai option').count()) === 11 && (await S(page, '#mncf-ed-loai').inputValue()) === 'bi_mong', 'ô ngăn kéo có ô chọn loại: 11 loại, mặc định "ray bi đáy mỏng"');
  await S(page, '#mncf-ed-loai').selectOption('am_day');
  m = await page.evaluate(inPage.model);
  ok(m.errors.length === 0 && m.tpl.filter(t => t[0] === 0).every(t => t[2] === 20216240 && t[3] === 'am_day' && t[4].GDK === 24.5 && !('GD' in t[4])), 'chọn "ray âm đáy dày" → dùng mẫu 托底轨厚底抽, tham số GDK', m.tpl.filter(t => t[0] === 0));
  ok(m.tpl.filter(t => t[0] === 1).every(t => t[2] === 20216239), 'ô khác không bị đổi loại');
  ok(/Ray âm đỡ đáy · đáy dày/.test(await S(page, '.bay[data-i="0"] .noi').innerText()), 'thẻ khoang ghi loại ngăn kéo');
  await S(page, '.edbar [data-ed="so-"]').click();
  m = await page.evaluate(inPage.model);
  ok(m.tpl.filter(t => t[0] === 0).every(t => t[3] === 'am_day') && (await S(page, '#mncf-ed-loai').inputValue()) === 'am_day', 'đổi số ngăn vẫn giữ loại đã chọn');
  // bản 1.13: chọn loại ngăn kéo bằng hình
  ok(await S(page, '.edbar [data-ed="loai-hinh"] svg').isVisible() && !(await S(page, '.lpop').count()), 'thanh sửa có nút "Chọn bằng hình" mang hình của loại đang dùng');
  await S(page, '.edbar [data-ed="loai-hinh"]').click();
  ok((await S(page, '.lpop .ltile').count()) === 11 && (await S(page, '.lpop .ltile svg').count()) === 11 && /\bon\b/.test(await S(page, '.lpop .ltile[data-v="am_day"]').getAttribute('class')), 'bấm nút: mở bảng 11 hình, loại đang dùng được tô');
  ok(new Set(await page.evaluate(() => [...document.getElementById('mncf-host').shadowRoot.querySelectorAll('.lpop .ltile svg')].map(e => e.innerHTML))).size >= 10, 'hình các loại khác nhau (đáy mỏng / dày, ray bi / ray âm, Blum 16 / 18…)');
  await S(page, '.lpop .ltile[data-v="blum18"]').click();
  m = await page.evaluate(inPage.model);
  ok(m.tpl.filter(t => t[0] === 0).every(t => t[3] === 'blum18') && !(await S(page, '.lpop').count()) && (await S(page, '#mncf-ed-loai').inputValue()) === 'blum18', 'bấm hình "Blum thành 18" → ô đổi loại, bảng hình đóng', m.tpl.filter(t => t[0] === 0));
  await S(page, '.edbar [data-ed="loai-hinh"]').click(); await page.keyboard.press('Escape');
  ok(!(await S(page, '.lpop').count()), 'Esc đóng bảng hình');
  await S(page, '.edbar [data-ed="loai-hinh"]').click(); await S(page, '.lpop .ltile[data-v="am_day"]').click();
  ok((await S(page, '#mncf-ed-loai').inputValue()) === 'am_day', 'chọn lại "ray âm đáy dày" bằng hình');
  await S(page, '.edbar .segb[data-v="nk_trum"]').click();
  m = await page.evaluate(inPage.model);
  ok(m.tpl.filter(t => t[0] === 0).every(t => t[1] === 'nk_trum' && t[3] === 'am_day'), 'đổi âm ↔ trùm ngoài vẫn giữ loại');
  await S(page, '.edbar .segb[data-v=""]').click();
  m = await page.evaluate(inPage.model);
  ok(m.dem === 2 && m.mat.length === 2, 'chọn Trống → bỏ ngăn kéo của ô', [m.dem, m.mat.length]);
  // bản 1.13: khấu cột — gõ kích thước cột, hình có thêm mặt nhìn từ trên xuống
  ok(!/Nhìn từ trên xuống/.test(await S(page, '.view').innerHTML()), 'chưa khấu: chưa có hình nhìn từ trên xuống');
  await S(page, '#mncf-khau-trai-rong').fill('300'); await S(page, '#mncf-khau-trai-sau').fill('200'); await S(page, '#mncf-khau-trai-sau').blur();
  await page.waitForFunction(() => window.MNCF.app.getModel().parts.some(p => p.ten === 'Vách khấu cột'), null, { timeout: 5000 }).catch(() => {});
  let kh = await page.evaluate(() => { const M = window.MNCF.app.getModel(); return { loi: M.errors, vach: M.parts.filter(p => p.ten === 'Vách khấu cột').length, hau: M.parts.filter(p => p.ten === 'Hậu khấu cột').length, khoet: M.parts.filter(p => p.khau && p.khau.length).length, info: !!M.info.khau }; });
  ok(kh.loi.length === 0 && kh.vach >= 1 && kh.hau >= 1 && kh.khoet >= 2 && kh.info, 'gõ cột trái 300 × 200 → mô hình có vách khấu, hậu khấu, tấm khoét góc', kh);
  ok(/Nhìn từ trên xuống — khấu cột/.test(await S(page, '.view').innerHTML()) && !/NaN|undefined/.test(await S(page, '.view').innerHTML()), 'hình đứng thêm mặt "Nhìn từ trên xuống — khấu cột"');
  await S(page, '#mncf-khau-trai-sau').fill('700'); await S(page, '#mncf-khau-trai-sau').blur();
  await page.waitForFunction(() => window.MNCF.app.getModel().errors.length > 0, null, { timeout: 5000 }).catch(() => {});
  ok((await page.evaluate(() => window.MNCF.app.getModel().errors)).some(t => /^Khấu cột/.test(t)) && /Khấu cột/.test(await S(page, '.msgs').innerText()), 'cột sâu hơn tủ → báo lỗi "Khấu cột …"', await S(page, '.msgs').innerText());
  await S(page, '#mncf-khau-trai-rong').fill('0'); await S(page, '#mncf-khau-trai-sau').fill('0'); await S(page, '#mncf-khau-trai-sau').blur();
  await page.waitForFunction(() => window.MNCF.app.getModel().errors.length === 0, null, { timeout: 5000 }).catch(() => {});
  kh = await page.evaluate(() => { const M = window.MNCF.app.getModel(); return [M.errors.length, M.parts.filter(p => /khấu cột/.test(p.ten)).length]; });
  ok(kh[0] === 0 && kh[1] === 0 && !/Nhìn từ trên xuống/.test(await S(page, '.view').innerHTML()), 'gõ 0 → bỏ khấu, tủ trở lại như cũ', kh);
  // bản 1.14: cột GIỮA tủ — khoét chữ U, nút "Đặt vách theo mép cột giữa"
  const g0 = await page.evaluate(() => { const M = window.MNCF.app.getModel(); return { x: M.info.x_khoang[0], w: M.info.khoang[0], n: M.info.khoang.length, parts: M.parts.length }; });
  const cach = Math.round(g0.x + 260);
  await S(page, '#mncf-khau-giua-0-cach').fill(String(cach)); await S(page, '#mncf-khau-giua-0-rong').fill('250'); await S(page, '#mncf-khau-giua-0-sau').fill('200'); await S(page, '#mncf-khau-giua-0-sau').blur();
  await page.waitForFunction(() => (window.MNCF.app.getModel().info.khau || []).length === 1, null, { timeout: 5000 }).catch(() => {});
  let kg = await page.evaluate(() => { const M = window.MNCF.app.getModel(); return { loi: M.errors, K: M.info.khau[0], u: M.parts.filter(p => (p.khau || []).some(k => k.ben === 'giua')).length, vk: M.parts.filter(p => p.ten === 'Vách khấu cột').length, n: M.info.khoang.length }; });
  ok(kg.loi.length === 0 && kg.K && kg.K.ben === 'giua' && kg.u >= 2 && kg.vk >= 2, 'gõ cột giữa → đáy / nóc khoét chữ U, có 2 vách khấu', kg);
  ok(/2 vách khấu · sâu/.test(await S(page, '.view').innerHTML()), 'hình nhìn từ trên xuống ghi "2 vách khấu"');
  await S(page, '[data-act="vach-cot"]').click();
  await page.waitForFunction(() => { const K = (window.MNCF.app.getModel().info.khau || [])[0]; return K && K.co_a && K.co_b; }, null, { timeout: 5000 }).catch(() => {});
  kg = await page.evaluate(() => { const M = window.MNCF.app.getModel(); return { loi: M.errors, K: M.info.khau[0], u: M.parts.filter(p => p.khau && p.khau.length).length, vk: M.parts.filter(p => p.ten === 'Vách khấu cột').length, n: M.info.khoang.length, w: M.info.khoang }; });
  ok(kg.loi.length === 0 && kg.K.co_a && kg.K.co_b && kg.u === 0 && kg.vk === 0 && kg.n > g0.n && kg.w.includes(280), 'bấm "Đặt vách theo mép cột giữa" → khoang nông 280 trước cột (cột 250 + 2 khe hở 15), không tấm nào khoét, không vách khấu', kg);
  ok(/Đã đặt vách theo mép cột/.test(await page.evaluate(inPage.status)) && /khoang nông trước cột/.test(await S(page, '.view').innerHTML()), 'báo đã đặt vách; hình ghi "khoang nông trước cột"', await page.evaluate(inPage.status));
  await S(page, '[data-act="lui"]').click();
  await page.waitForFunction(n => window.MNCF.app.getModel().info.khoang.length === n, g0.n, { timeout: 5000 }).catch(() => {});
  ok((await page.evaluate(() => window.MNCF.app.getModel().info.khoang.length)) === g0.n, '↶ Lùi: trả lại cách chia khoang cũ');
  await S(page, '#mncf-khau-giua-0-rong').fill('0'); await S(page, '#mncf-khau-giua-0-cach').fill('0'); await S(page, '#mncf-khau-giua-0-sau').fill('0'); await S(page, '#mncf-khau-giua-0-sau').blur();
  await page.waitForFunction(() => !(window.MNCF.app.getModel().info.khau || []).length, null, { timeout: 5000 }).catch(() => {});
  ok((await page.evaluate(() => { const M = window.MNCF.app.getModel(); return [M.errors.length, (M.info.khau || []).length, M.parts.length].join(); })) === '0,0,' + g0.parts, 'xoá cột giữa → tủ trở lại như cũ');

  /* 8. xoá đợt bằng thanh sửa */
  c = await page.evaluate(inPage.center, '[data-dot="0:0"]');
  await page.mouse.click(c.x, c.y);
  await S(page, '[data-ed="del"]').click();
  sp = await page.evaluate(inPage.spec);
  ok(sp.khoang[0].dot.length === 1 && sp.khoang[0].dot[0] === 1800 && sp.khoang[0].o.length === 1 && sp.khoang[0].o[0].kieu === 'suot', 'xoá đợt → 2 ô nhập một, suốt treo xuống ô dưới', sp.khoang[0]);

  /* 9. gõ trong ô "Đợt" của thẻ khoang */
  await S(page, '#mncf-b0-dot').fill('400, 900, 1800'); await S(page, '#mncf-b0-dot').blur();
  sp = await page.evaluate(inPage.spec);
  ok(JSON.stringify(sp.khoang[0].dot) === '[400,900,1800]', 'gõ danh sách đợt', sp.khoang[0].dot);

  /* 9b. bản 1.12 — vách đứng: bấm vào hình để thêm, kéo ngang để chia lại, bỏ vách để gộp */
  {
    const W = () => page.evaluate(() => window.MNCF.app.getModel().info.khoang);
    const gon = async () => JSON.stringify((await page.evaluate(inPage.spec)).khoang.map(k => [k.rong, k.canh, k.ban_le, k.dot, k.o]));
    const dau = await gon(), w0 = await W(), t = (await page.evaluate(inPage.spec)).van.t;
    ok(w0.length === 2, 'trước khi thêm vách: 2 khoang', w0);
    await S(page, '[data-act="them-vach"]').click();
    ok((await S(page, '[data-act="them-vach"]').getAttribute('aria-pressed')) === 'true' && /Bấm vào chỗ muốn đặt vách/.test(await page.evaluate(inPage.status)), 'nút ＋ Vách bật: có lời nhắc');
    const k = await page.evaluate(inPage.scale), o0 = await page.evaluate(inPage.center, '[data-o^="0:"]');
    await page.mouse.click(o0.x - o0.w / 2 + 300 * k, o0.y);      // bấm cách mép trái lọt lòng khoang 1 đúng 300 mm
    sp = await page.evaluate(inPage.spec); let w = await W();
    ok(sp.khoang.length === 3 && Math.abs(w[0] - (300 - (t / 2 > 5 ? 10 : 0))) <= 5 && Math.abs(w[0] + t + w[1] - w0[0]) < 0.6 && Math.abs(w[2] - w0[1]) < 0.6, 'bấm vào hình: thêm vách tại chỗ bấm, khoang 1 chia đôi, khoang còn lại giữ nguyên', [w, w0]);
    ok(sp.khoang[0].canh === 1 && sp.khoang[1].canh === 1 && sp.khoang[1].ban_le === 'phai' && JSON.stringify(sp.khoang[1].dot) === JSON.stringify(sp.khoang[0].dot) && sp.khoang[1].o.length === 0 && sp.khoang[0].o.length > 0, 'khoang mới: mỗi bên 1 cánh, đợt chép sang, ngăn kéo / suốt treo ở lại khoang trái', sp.khoang.slice(0, 2));
    ok((await page.evaluate(inPage.model)).errors.length === 0 && /Đã thêm vách/.test(await page.evaluate(inPage.status)) && (await S(page, '.bay').count()) === 3, 'tủ dựng không lỗi, form có 3 thẻ khoang');
    await page.keyboard.press('Escape');
    ok((await S(page, '[data-act="them-vach"]').getAttribute('aria-pressed')) === 'false', 'Esc: thôi chế độ thêm vách');
    // kéo vách sang phải 100
    let v = await page.evaluate(inPage.center, '[data-vach="1"]'); const wTruoc = await W();
    await page.mouse.move(v.x, v.y); await page.mouse.down(); await page.mouse.move(v.x + 50 * k, v.y, { steps: 3 }); await page.mouse.move(v.x + 100 * k, v.y, { steps: 3 }); await page.mouse.up();
    w = await W();
    ok(Math.abs(w[0] - wTruoc[0] - 100) <= 5 && Math.abs(w[0] + w[1] - wTruoc[0] - wTruoc[1]) < 0.6 && Math.abs(w[2] - wTruoc[2]) < 0.6, 'kéo vách sang phải 100: khoang trái +100, khoang phải −100, khoang thứ ba đứng yên', [wTruoc, w]);
    ok(/Vách giữa khoang 1 và 2/.test(await page.evaluate(inPage.bar)) && (await S(page, '#mncf-b0-rong').inputValue()) === String(w[0]), 'thanh sửa hiện vách đang chọn; ô "Rộng lọt lòng" của khoang đổi theo', await page.evaluate(inPage.bar));
    await S(page, '#mncf-ed-wl').fill('450'); await S(page, '#mncf-ed-wl').press('Enter');
    w = await W();
    ok(w[0] === 450, 'gõ lọt lòng khoang trái = 450', w);
    await S(page, '.view').focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Shift+ArrowRight');
    w = await W();
    ok(w[0] === 461, 'phím → nhích 1, Shift+→ nhích 10', w);
    await S(page, '#mncf-ed-wl').fill('20'); await S(page, '#mncf-ed-wl').press('Enter');
    ok((await W())[0] === 150 && /chỉ dời được/.test(await page.evaluate(inPage.status)), 'không cho khoang hẹp hơn 150', await W());
    await S(page, '[data-ed="del-vach"]').click();
    sp = await page.evaluate(inPage.spec); w = await W();
    ok(sp.khoang.length === 2 && Math.abs(w[0] - w0[0]) < 0.6 && sp.khoang[0].canh === 2 && /gộp làm một/.test(await page.evaluate(inPage.status)), 'bỏ vách: 2 khoang gộp lại đúng bề rộng cũ, 2 cánh', [w, w0]);
    for (let n = 0; n < 12 && (await gon()) !== dau && !(await S(page, '[data-act="lui"]').isDisabled()); n++) await S(page, '[data-act="lui"]').click();
    ok((await gon()) === dau, 'nút ↶ Lùi đưa tủ về đúng như trước khi thêm vách', [await gon(), dau]);
  }

  /* 10. tải JSON */
  await page.evaluate(s => window.MNCF.app.setSpec(s), TU_2000);
  const [dl] = await Promise.all([page.waitForEvent('download'), S(page, '.pri[data-act="json"]').click()]);
  const f = path.join(__dirname, '..', 'out', 'ui_test_download.json'); await dl.saveAs(f);
  const js = JSON.parse(fs.readFileSync(f, 'utf8'));
  ok(dl.suggestedFilename() === 'TA2_2000x2800_chenfeng.json' && js.ModelSpace.length === 50 && js.ModelSpace.filter(x => x.Name === 'Vách đệm ngăn kéo').length === 2 && js.ModelSpace.filter(x => x.Name === 'Xà ngăn kéo').length === 2 && js.ModelSpace.filter(x => x.Name === 'Nẹp che khe ngăn kéo').length === 2, 'file JSON: 46 tấm + 4 mẫu, có 2 vách đệm, 2 xà, 2 nẹp', [dl.suggestedFilename(), js.ModelSpace.length]);
  fs.unlinkSync(f);

  /* 11. thiết kế lỗi → khoá nút */
  await S(page, '#mncf-b1-dot').fill('500, 510'); await S(page, '#mncf-b1-dot').blur();
  ok(await S(page, '.pri[data-act="json"]').isDisabled() && (await S(page, '.msg.err').count()) > 0, 'đợt quá sát → báo lỗi, khoá nút tải');

  /* 12. tab Chuẩn xưởng: vách đệm + bảng các loại ngăn kéo */
  await page.evaluate(s => window.MNCF.app.setSpec(s), TU_2000);
  await S(page, '.tab[data-tab="chuan"]').click();
  ok((await S(page, '#mncf-ngan_keo-dem').inputValue()) === '50', 'Chuẩn xưởng có ô "vách đệm tránh bản lề" = 50');
  ok((await S(page, '.lkr').count()) === 11 && (await S(page, '#mncf-lk0-id').inputValue()) === '20216239' && (await S(page, '#mncf-lk0-ts').inputValue()) === 'GD=13; LC=0; SLK=30; XLK=30' && await S(page, '#mncf-lk0-md').isChecked(), 'bảng 11 loại ngăn kéo: mã mẫu, tham số riêng, loại mặc định');
  ok(!(await S(page, '[data-act="lk-do"]').count()), 'trang độc lập không có nút dò kho mẫu (chỉ có trong Chenfeng)');
  await S(page, '#mncf-lk0-id').fill('999'); await S(page, '#mncf-lk0-ts').fill('GD=12,5; SLK=28');
  await page.waitForTimeout(350);
  m = await page.evaluate(inPage.model);
  ok(m.tpl.length === 2 && m.tpl.every(t => t[2] === 999 && t[4].GD === 12.5 && t[4].SLK === 28 && !('XLK' in t[4])), 'sửa mã mẫu + tham số riêng của loại mặc định → ngăn kéo dùng số mới', m.tpl);
  await S(page, '#mncf-lk3-md').check(); await page.waitForTimeout(350);
  m = await page.evaluate(inPage.model);
  ok(m.tpl.every(t => t[3] === 'am_day'), 'đổi loại mặc định → ô chưa chọn loại đổi theo', m.tpl.map(t => t[3]));
  // bản 1.13: chọn loại mặc định bằng hình ở Chuẩn xưởng
  ok((await S(page, '.lk .lgrid .ltile').count()) >= 11 && (await S(page, '.lk .lkr .lka svg').count()) >= 11, 'bảng loại ngăn kéo: có lưới hình chọn loại mặc định, mỗi thẻ có hình');
  { const cu = (await page.evaluate(inPage.spec)).ngan_keo.mac_dinh;
    await S(page, '.lk .lgrid .ltile[data-v="am_mong"]').click();
    ok((await page.evaluate(inPage.spec)).ngan_keo.mac_dinh === 'am_mong' && /Loại ngăn kéo mặc định: Ray âm đỡ đáy · đáy mỏng/.test(await page.evaluate(inPage.status)) && /\bon\b/.test(await S(page, '.lk .lgrid .ltile[data-v="am_mong"]').getAttribute('class')), 'bấm hình → đổi loại mặc định');
    await S(page, `.lk .lgrid .ltile[data-v="${cu}"]`).click();
    ok((await page.evaluate(inPage.spec)).ngan_keo.mac_dinh === cu, 'trả lại loại mặc định cũ'); }
  await S(page, '[data-act="lk-add"]').click();
  ok((await S(page, '.lkr').count()) === 12 && (await S(page, '#mncf-lk11-ten').inputValue()) === 'Loại mới 1', 'thêm loại mới');
  await S(page, '.lkr[data-li="11"] [data-act="lk-del"]').click();
  ok((await S(page, '.lkr').count()) === 11, 'bỏ loại');
  await S(page, '[data-act="defaults"]').click();
  ok((await S(page, '#mncf-lk0-id').inputValue()) === '20216239' && await S(page, '#mncf-lk0-md').isChecked(), 'Khôi phục mặc định trả lại bảng loại');
  ok(errs.length === 0, 'không có lỗi JS trên trang', errs);
  await ctx.close();
}

async function testTouchAndThemes(browser) {
  console.log('— Màn hình cảm ứng, sáng/tối, điện thoại');
  for (const [name, opt] of [['điện thoại sáng', { viewport: { width: 390, height: 800 }, colorScheme: 'light', hasTouch: true, isMobile: true }], ['điện thoại tối', { viewport: { width: 390, height: 800 }, colorScheme: 'dark', hasTouch: true, isMobile: true }], ['máy bàn tối', { viewport: { width: 1440, height: 900 }, colorScheme: 'dark' }]]) {
    const { ctx, page, errs } = await open(browser, path.join(DIST, 'mn-chenfeng.html'), opt);
    ok((await page.evaluate(inPage.overflow)) <= 1, name + ': không tràn ngang', await page.evaluate(inPage.overflow));
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    ok(opt.colorScheme === 'dark' ? /rgb\(18, 22, 25\)/.test(bg) : /rgb\(228, 232, 225\)/.test(bg), name + ': nền theo giao diện', bg);
    if (opt.hasTouch) {
      // kéo đợt bằng ngón tay (sự kiện con trỏ kiểu touch qua CDP)
      await page.evaluate(s => window.MNCF.app.setSpec(s), TU_2000);
      await S(page, '.view').scrollIntoViewIfNeeded();
      const k = await page.evaluate(inPage.scale), c = await page.evaluate(inPage.center, '[data-dot="1:0"]');
      const cdp = await ctx.newCDPSession(page);
      const tp = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: c.x, y }] });
      const y1 = c.y - 80 * k;
      await tp('touchStart', c.y); await tp('touchMove', c.y - 30 * k); await tp('touchMove', y1); await tp('touchEnd');
      const sp = await page.evaluate(inPage.spec);
      ok(Math.abs(sp.khoang[1].dot[0] - 600) <= 5, name + ': kéo đợt bằng ngón tay lên 80 mm', sp.khoang[1].dot);
    }
    ok(errs.length === 0, name + ': không lỗi JS', errs);
    await ctx.close();
  }
}

async function testOldSaved(browser) {
  console.log('— Thông số lưu từ bản 1.0–1.1 trong máy vẫn mở được');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const cu = { ma: 'CU', rong: 2000, cao: 2800, ngan_keo: { mau_id: 20216239, ten_mau: '三节轨薄底抽', lui: 30, khe_tren: 22.5, khe_giua: 22, khe_duoi: 2, khe_ben: 2, GD: 12, SLK: 30, XLK: 30, LC: 0, buoc_sau: 50, ho_sau: 5 },
    khoang: [{ rong: 'auto', canh: 2, dot: [1800], suot: 1800 }, { rong: 'auto', canh: 2, dot: [520, 1800], ngan_keo: { so: 2, den: 520 }, suot: 1800 }] };
  await page.addInitScript(v => { try { localStorage.setItem('mncf.spec.v1', JSON.stringify(v)); } catch (e) { /* bỏ qua */ } }, cu);
  // mở qua một địa chỉ http giả (không dùng file://): với file://, Chromium đổi tiến trình khi tải lại trang nên có lúc trang mới chưa thấy dữ liệu localStorage vừa ghi
  await ctx.route('http://mncf.test/**', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(DIST, 'mn-chenfeng.html'), 'utf8') }));
  await page.goto('http://mncf.test/');
  await page.waitForFunction(() => window.MNCF && window.MNCF.app && window.MNCF.app.getModel());
  const m = await page.evaluate(inPage.model), sp = await page.evaluate(inPage.spec);
  ok(m.errors.length === 0 && m.parts === 46 && m.dem === 2 && m.tpl.length === 2 && m.tpl.every(t => t[2] === 20216239 && t[4].GD === 12), 'mẫu cũ: dựng đúng, có vách đệm, giữ GD = 12 của bản cũ', m.tpl);
  ok(sp.ngan_keo.loai.length === 11 && sp.ngan_keo.dem === 50 && !('mau_id' in sp.ngan_keo), 'thông số được nâng lên định dạng mới (11 loại, vách đệm 50)');
  // bản cũ để hậu dày lọt lòng; chuẩn xưởng từ 1.3 là hậu 6 li phủ sau → thông số cũ chuyển theo và báo cho người dùng biết
  const hau = () => page.evaluate(() => window.MNCF.app.getModel().parts.filter(p => p.loai === 'HAU').map(p => [p.t, p.y0, p.y1, p.khoan]));
  let h = await hau();
  ok(sp.hau.kieu === 'phu' && h.length === 4 && h.every(x => x[0] === 6 && x[1] === 574 && x[2] === 580 && x[3] === '不排'), 'thông số bản cũ → hậu 6 li phủ sau lưng thùng', [sp.hau, h]);
  ok(/Hậu đã đổi sang chuẩn xưởng mới/.test(await page.evaluate(inPage.status)), 'có dòng báo hậu đã đổi sang chuẩn mới', await page.evaluate(inPage.status));
  // người dùng chủ động chọn lại hậu dày ở bản 1.3 → lần mở sau phải giữ, không tự đổi lần nữa
  await S(page, '.tab[data-tab="chuan"]').click();
  await S(page, '#mncf-hau-kieu').selectOption('day'); await page.waitForTimeout(350);
  await page.reload();
  await page.waitForFunction(() => window.MNCF && window.MNCF.app && window.MNCF.app.getModel());
  h = await hau();
  ok(h.length === 4 && h.every(x => x[0] === 17.5 && x[3] === 'Cam3Tp') && !/Hậu đã đổi/.test(await page.evaluate(inPage.status)), 'chọn lại hậu dày ở bản mới → mở lại vẫn hậu dày, không báo đổi nữa', h);
  ok(errs.length === 0, 'không lỗi JS', errs);
  await ctx.close();
}

async function testHau(browser) {
  console.log('— Chuẩn xưởng → Hậu: hậu 6 li phủ sau (mặc định), đổi kiểu, mở mẫu lưu từ bản cũ');
  const { ctx, page, errs } = await open(browser, path.join(DIST, 'mn-chenfeng.html'));
  const hau = () => page.evaluate(() => window.MNCF.app.getModel().parts.filter(p => p.loai === 'HAU').map(p => [p.t, p.y0, p.y1, p.khoan, p.x1 - p.x0]));
  await page.evaluate(s => window.MNCF.app.setSpec(s), TU_2000);
  let h = await hau();
  ok(h.length === 4 && h.every(x => x[0] === 6 && x[1] === 574 && x[2] === 580 && x[3] === '不排'), 'mặc định: 4 tấm hậu 6 li nằm sau thùng, không khoan', h);
  await S(page, '.tab[data-tab="chuan"]').click();
  ok((await S(page, '#mncf-hau-kieu').inputValue()) === 'phu' && (await S(page, '#mncf-hau-t').inputValue()) === '6' && (await S(page, '#mncf-hau-mep').inputValue()) === '1' && (await S(page, '#mncf-hau-chia').inputValue()) === 'khoang', 'Chuẩn xưởng → Hậu: kiểu phủ, dày 6, mép lùi 1, mỗi khoang 1 tấm');
  ok((await S(page, '#mncf-hau-lui').count()) === 0 && (await S(page, '#mncf-hau-ranh_sau').count()) === 0, 'các ô của hậu soi rãnh ẩn khi đang chọn hậu phủ');
  await S(page, '#mncf-hau-kieu').selectOption('day'); await page.waitForTimeout(350);
  h = await hau();
  ok((await S(page, '#mncf-hau-t').inputValue()) === '17.5' && h.length === 4 && h.every(x => x[0] === 17.5 && x[1] === 562.5 && x[3] === 'Cam3Tp') && (await S(page, '#mncf-hau-mep').count()) === 0, 'đổi sang hậu dày: dày 17,5, lọt lòng, khoan cam; các ô của hậu phủ ẩn', h);
  await S(page, '#mncf-hau-kieu').selectOption('mong'); await page.waitForTimeout(350);
  ok((await S(page, '#mncf-hau-t').inputValue()) === '5' && (await S(page, '#mncf-hau-lui').count()) === 1, 'đổi sang hậu soi rãnh: dày 5, hiện các ô của hậu soi rãnh');
  await S(page, '#mncf-hau-kieu').selectOption('phu'); await page.waitForTimeout(350);
  ok((await S(page, '#mncf-hau-t').inputValue()) === '6', 'về hậu phủ: dày 6');
  // gộp khoang cho vừa khổ ván: thân dưới cao 2148 vẫn 2 tấm 949; thân trên cao 548 gộp thành 1 tấm 1898
  await S(page, '#mncf-hau-chia').selectOption('kho_van'); await page.waitForTimeout(350);
  h = await hau();
  ok(JSON.stringify(h.map(x => x[4])) === '[949,949,1898]', 'chia "gộp khoang": 2 tấm 949 (thân dưới) + 1 tấm 1898 (thân trên)', h.map(x => x[4]));
  // dày hậu gõ tay
  await S(page, '#mncf-hau-t').fill('9'); await page.waitForTimeout(350);
  h = await hau();
  ok(h.every(x => x[0] === 9 && x[1] === 571 && x[2] === 580), 'gõ dày hậu 9 → thùng lùi 9, sâu phủ bì vẫn 580', h);
  // mở mẫu tủ lưu từ bản 1.2 (hậu dày là mặc định cũ) → chuyển sang chuẩn mới, có báo; mẫu lưu từ bản 1.3 thì giữ nguyên lựa chọn
  const mau = ban => ({ name: 'mau.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ mncf: ban, spec: Object.assign({}, TU_2000, { hau: { kieu: 'day', t: 17.5, lui: 20, ranh_sau: 6, ranh_ho: 0.5 } }) })) });
  await S(page, '#mncf-ui-file').setInputFiles(mau('1.2.0'));
  await page.waitForFunction(() => /Đã mở mẫu tủ/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent));
  h = await hau();
  ok(h.every(x => x[0] === 6) && /Hậu đã đổi sang chuẩn xưởng mới/.test(await page.evaluate(inPage.status)), 'mẫu lưu từ bản 1.2 → hậu 6 li phủ, có dòng báo', [h, await page.evaluate(inPage.status)]);
  await S(page, '#mncf-ui-file').setInputFiles(mau('1.3.0'));
  await page.waitForFunction(() => window.MNCF.app.getSpec().hau.kieu === 'day');
  h = await hau();
  ok(h.every(x => x[0] === 17.5) && !/Hậu đã đổi/.test(await page.evaluate(inPage.status)), 'mẫu lưu từ bản 1.3 chọn hậu dày → giữ hậu dày', h);
  ok(errs.length === 0, 'không có lỗi JS trên trang', errs);
  await ctx.close();
}

async function testArtifact(browser) {
  console.log('— Bản artifact (đoạn HTML không có html/head/body, tải file qua năng lực downloads)');
  const frag = fs.readFileSync(path.join(DIST, 'artifact', 've-tu-chenfeng.html'), 'utf8');
  ok(!/<(html|head|body)[\s>]/i.test(frag) && /^<title>[^<]{3,40}<\/title>/.test(frag), 'đoạn artifact không tự có html/head/body, có <title> ngắn');
  const tmp = path.join(__dirname, '..', 'out', 'artifact_shell.html');
  fs.writeFileSync(tmp, '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>\n' + frag + '\n</body></html>');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.addInitScript(() => { window.__saved = []; window.claude = { use: async name => (name === 'downloads' ? { save: async o => { window.__saved.push({ filename: o.filename, n: o.data.length }); } } : null) }; });
  await page.goto('file://' + tmp);
  await page.waitForFunction(() => window.MNCF && window.MNCF.app && window.MNCF.app.getModel());
  ok((await page.title()) === 'Vẽ tủ Chenfeng', 'tiêu đề trang');
  await S(page, '.pri[data-act="json"]').click(); await S(page, '[data-act="csv"]').click();
  await page.waitForFunction(() => window.__saved.length === 2);
  const saved = await page.evaluate(() => window.__saved);
  ok(/_chenfeng\.json$/.test(saved[0].filename) && /_bang_ke\.csv$/.test(saved[1].filename) && saved[0].n > 5000, 'tải JSON + CSV qua năng lực downloads', saved);
  ok(/Đã tải/.test(await page.evaluate(inPage.status)), 'báo đã tải');
  ok(errs.length === 0, 'không lỗi JS', errs);
  await ctx.close(); fs.unlinkSync(tmp);
}

async function testPhieu(browser) {
  console.log('— Phiếu tự kiểm trước khi vẽ + ngưỡng dò lỗi ở Chuẩn xưởng (bản 1.20)');
  const { ctx, page, errs } = await open(browser, path.join(DIST, 'mn-chenfeng.html'));
  const tom = () => S(page, '[data-ui="phieu"] summary').innerText();
  ok(/13 mục đạt/.test(await tom()) && !/lỗi|cần xem|chưa kiểm/.test(await tom()), 'tủ mẫu: 13 mục đạt, không mục nào cần xem', await tom());
  ok((await S(page, '[data-ui="phieu"] li').count()) === 13, 'liệt kê đúng 13 mục áp dụng (mục khấu cột không áp dụng thì không hiện)', await S(page, '[data-ui="phieu"] li').count());
  // trang rời (không nằm trong Chenfeng) không đọc được tấm thật → không có nút "Dò lỗi sản xuất"; phần hướng dẫn vẫn nói về phiếu tự kiểm
  ok((await S(page, '[data-act="doloi"]').count()) === 0 && (await S(page, '[data-ui="doloi"]').count()) === 0, 'trang rời: không có nút dò lỗi trên tấm thật');
  ok(/Tự kiểm trước khi vẽ/.test(await S(page, '[data-pane="hd"]').textContent()), 'hướng dẫn có mục phiếu tự kiểm');
  // khoang 1100 và 1130: mục nhịp thành "cần xem", các mục khác vẫn đạt; nút tải JSON vẫn bấm được (cảnh báo không khoá)
  await page.evaluate(s => window.MNCF.app.setSpec(s), { ma: 'T', rong: 2400, cao: 2200, than: { cao_duoi: 0 }, khoang: [{ rong: 1100, canh: 0, dot: [1100] }, { rong: 'auto', canh: 0, dot: [1100] }] });
  ok(/1 mục cần xem/.test(await tom()) && !/lỗi/.test(await tom()), 'khoang quá nhịp: 1 mục cần xem', await tom());
  ok(/Nhịp/.test(await S(page, '[data-ui="phieu"] li.luu_y').textContent()), 'mục nhịp được đánh dấu cần xem');      // phiếu đang gập: đọc textContent
  ok((await S(page, '.msgs .msg.warn').count()) === 2, '2 dòng cảnh báo vàng (mỗi khoang một dòng)');
  ok(await S(page, '.pri[data-act="json"]').isEnabled(), 'cảnh báo không khoá nút xuất file');
  // nâng ngưỡng ở Chuẩn xưởng → hết cảnh báo; máy tự nhớ như các số chuẩn khác
  await S(page, '.tab[data-tab="chuan"]').click();
  ok((await S(page, 'input[data-k="kiem.dot_max"]').inputValue()) === '1000', 'Chuẩn xưởng có ô ngưỡng nhịp đợt, mặc định 1000');
  for (const k of ['kiem.canh_cao_max', 'kiem.nk_rong_max', 'kiem.suot_sau_min', 'kiem.tran']) ok((await S(page, `input[data-k="${k}"]`).count()) === 1, 'có ô ' + k);
  await S(page, 'input[data-k="kiem.dot_max"]').fill('1200'); await S(page, 'input[data-k="kiem.dot_max"]').blur();
  await page.waitForFunction(() => window.MNCF.app.getModel().warnings.length === 0);
  await S(page, '.tab[data-tab="tu"]').click();
  // tủ này hở, không ngăn kéo, không suốt treo: 14 mục − khấu cột − cánh − ngăn kéo − suốt − mã mẫu = 9 mục áp dụng
  ok(/9 mục đạt/.test(await tom()) && !/cần xem|lỗi/.test(await tom()), 'ngưỡng 1200: 9 mục áp dụng đều đạt', await tom());
  // lỗi (tổng khoang lệch phủ bì) → phiếu ghi mục lỗi, nút xuất bị khoá
  await page.evaluate(s => window.MNCF.app.setSpec(s), { ma: 'T', rong: 1000, cao: 2200, than: { cao_duoi: 0 }, khoang: [{ rong: 500, canh: 0 }, { rong: 500, canh: 0 }] });
  const mucLoi = await S(page, '[data-ui="phieu"] li.loi').allTextContents();
  ok(/mục lỗi/.test(await tom()) && mucLoi.some(t => /Phủ bì/.test(t)), 'tổng khoang lệch: mục phủ bì lỗi', [await tom(), mucLoi]);
  ok(!(await S(page, '.pri[data-act="json"]').isEnabled()), 'có lỗi thì khoá nút xuất');
  ok(errs.length === 0, 'không lỗi JS', errs);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try { await testPage(browser); await testHau(browser); await testTouchAndThemes(browser); await testOldSaved(browser); await testArtifact(browser); await testPhieu(browser); }
  catch (e) { fail++; console.log('  ✗ ném lỗi:', e && e.stack || e); }
  await browser.close();
  console.log(`\n${pass} đạt, ${fail} hỏng`);
  process.exit(fail ? 1 : 0);
})();
