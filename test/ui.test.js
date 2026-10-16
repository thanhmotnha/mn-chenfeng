'use strict';
// Kiểm tra giao diện (trang độc lập + bản artifact) bằng Chromium không màn hình:
//   NODE_PATH=<thư mục node_modules có playwright> PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node test/ui.test.js
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const DIST = path.join(__dirname, '..', 'dist');
let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) pass++; else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); } };
const near = (a, b, tol = 0.06) => Math.abs(a - b) <= tol;

// thẻ nằm sau nút ⚙ (bản 1.27 — Màu, Chuẩn xưởng, Hướng dẫn): hàng thẻ phụ chưa mở thì bấm ⚙ trước rồi mới bấm thẻ
const theSau = async (H, t) => { const tab = H.locator('.tab[data-tab="' + t + '"]'); if (!(await tab.isVisible())) await H.locator('[data-act="the-them"]').click(); await tab.click(); };
const TU_2000 = { ma: 'TA2', rong: 2000, cao: 2800, chan: { cao: 50 }, hau: { t: 6 }, khoang: [
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

// (1.36.4) Thư viện thẻ hình (thay ô chọn + nút Dùng): bấm NHÓM (mở lưới nếu thẻ chưa hiện) rồi bấm THẺ data-ma; táp chỉ một mẫu → bấm nhóm Táp là dùng.
const nhomMa = ma => (ma === '' || /^TA\d/.test(ma) ? 'tu' : /^(@TAP|TAP)/.test(ma) ? 'tap' : /^G\d/.test(ma) ? 'giuong' : /^V\d/.test(ma) ? 'vach' : 'bep');
async function chonMauL(L, ma) {
  const n = nhomMa(ma);
  if (n === 'tap') return L.locator('[data-act="tv-nhom"][data-nhom="tap"]').click();
  const c = L.locator(`[data-act="tv-the"][data-ma="${ma}"]`);
  if (!(await c.isVisible())) await L.locator(`[data-act="tv-nhom"][data-nhom="${n}"]`).click();
  await c.click();
}
const chonMau = (page, ma) => chonMauL(page.locator('#mncf-host'), ma);
// các nhóm của Thư viện + mã từng thẻ: mở từng nhóm (lưới dựng lười) rồi gập lại → [[tên nhóm, [mã…]]…]; nhóm Táp không có lưới (một mẫu) → ['@TAP']
async function tvNhom(page) {
  const out = [];
  for (const b of await S(page, '[data-act="tv-nhom"]').all()) {
    const ten = (await b.innerText()).trim(), n = await b.getAttribute('data-nhom');
    if (n === 'tap') { out.push([ten, ['@TAP']]); continue; }
    await b.click(); const ma = await S(page, '[data-act="tv-the"]').evaluateAll(xs => xs.map(x => x.dataset.ma)); await b.click(); out.push([ten, ma]);
  }
  return out;
}

// (1.34.1 — thư viện bếp gọn) mẫu bếp theo mã (MAU_BEP_*) đi đường của người dùng: Thư viện "Tủ bếp <tầng>" → gõ Rộng → chip chức năng.
// Bước nào đã đúng thì bỏ (Thư viện ra sẵn tủ cánh 600 → "BD-CANH-600" chỉ một bước ↶ Lùi như chọn một mẫu). Trả về dòng trạng thái ngay sau bước Thư viện.
async function chonBep(p, ma) {
  const r = await p.evaluate(ma => { const C = window.MNCFCore, m = [...C.MAU_BEP_DUOI, ...C.MAU_BEP_TREN, ...C.MAU_BEP_CAO].find(x => x.ma === ma); return m ? { tang: m.tang, kieu: m.kieu, rong: m.co, ten: m.ten } : null; }, ma);
  if (!r || !r.kieu || !r.rong) throw new Error('mã bếp không thuộc chip: ' + ma);
  await chonMau(p, '@BEP-' + r.tang);
  await p.waitForFunction(t => { const s = window.MNCF.app.getSpec(); return s.loai_sp === 'bep' && s.bep && s.bep.tang === t; }, r.tang);
  const st = await p.evaluate(inPage.status);
  let go = false;
  if (await p.evaluate(w => window.MNCF.app.getSpec().rong !== w, r.rong)) { go = true; await S(p, '[data-k="rong"]').fill(String(r.rong)); await p.waitForFunction(w => window.MNCF.app.getSpec().rong === w, r.rong); }
  if (go || await p.evaluate(k => window.MNCFCore.kieuBep(window.MNCF.app.getSpec()) !== k, r.kieu)) await S(p, `[data-act="bep-kieu"][data-v="${r.kieu}"]`).click();
  await p.waitForFunction(t => window.MNCF.app.getSpec().ten === t, r.ten);
  return st;
}
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
  ok(/v1\.36\.4/.test(await S(page, '.brand').innerText()), 'ghi đúng phiên bản');
  // bản 1.27 — BẢNG ÍT CHỮ, ÍT THẺ (anh Thanh 05/10/2026 20:17: "giao diện hơi rườm rà"; 20:52: "nhiều chữ quá a đọc k quen").
  // Trang độc lập: thẻ làm việc Tủ · Phòng · Kết quả + nút ⚙ (Chuẩn xưởng, Hướng dẫn nằm ở hàng thẻ phụ); chữ hướng dẫn ẩn sẵn, nút "?" bật lại và máy nhớ.
  {
    const theHien = () => page.evaluate(() => [...document.getElementById('mncf-host').shadowRoot.querySelectorAll('header .tab')].filter(b => b.getClientRects().length > 0).map(b => b.dataset.tab || b.dataset.act).join(' '));
    ok((await theHien()) === 'tu phong kq the-them', 'hàng thẻ: Tủ · Phòng · Kết quả · ⚙', await theHien());
    await S(page, '[data-act="the-them"]').click();
    ok((await theHien()) === 'tu phong kq the-them chuan hd', 'bấm ⚙: thêm hàng thẻ phụ Chuẩn xưởng · Hướng dẫn (trang độc lập không có Màu, Đo mạng)', await theHien());
    await S(page, '.tab[data-tab="hd"]').click();
    ok(await S(page, '.pane[data-pane="hd"]').isVisible() && (await S(page, '.pane[data-pane="hd"] .sum li').first().isVisible()), 'thẻ Hướng dẫn: chữ vẫn hiện đủ (ít chữ không áp vào thẻ này)');
    await S(page, '.tab[data-tab="tu"]').click();
    ok((await theHien()) === 'tu phong kq the-them', 'về thẻ Tủ: hàng thẻ phụ gọn lại', await theHien());
    const chu = () => page.evaluate(() => { const r = document.getElementById('mncf-host').shadowRoot, v = e => !!e && e.getClientRects().length > 0, p = r.querySelector('.pane[data-pane="tu"]');
      return [[...p.querySelectorAll('.hint:not(.tt)')].filter(v).length > 0, v(p.querySelector('.legend')), v(p.querySelector('.sum')), true, r.querySelector('[data-act="chu"]').getAttribute('aria-pressed'), localStorage.getItem('mncf.ui.chu')]; });
    ok(JSON.stringify(await chu()) === '[false,false,false,true,"false",null]', 'mặc định ÍT CHỮ: không hiện chữ hướng dẫn, chú giải màu, dòng mô tả tủ — dòng mô tả của mẫu đang chọn thì vẫn hiện', await chu());
    await S(page, '[data-act="chu"]').click();
    ok(JSON.stringify(await chu()) === '[true,true,true,true,"true","1"]', 'bấm "?": hiện lại đủ chữ, máy nhớ', await chu());
    await page.reload();
    await page.waitForFunction(() => window.MNCF && window.MNCF.app && window.MNCF.app.getModel());
    ok(JSON.stringify(await chu()) === '[true,true,true,true,"true","1"]', 'mở lại trang: vẫn hiện chữ như lần trước đã chọn', await chu());
    await S(page, '[data-act="chu"]').click();
    ok(JSON.stringify(await chu()) === '[false,false,false,true,"false","0"]', 'bấm "?" lần nữa: ít chữ lại', await chu());
  }
  let m = await page.evaluate(inPage.model);
  // (1.36.4) tủ mặc định mới (hai tầng treo · 2 ngăn kéo + treo dài · hai tầng treo, thân dưới 2150): 66 tấm — trước 71 (K1 2 đợt, K3 6 đợt đều)
  ok(m.errors.length === 0 && m.parts === 66, 'tủ mẫu dựng 66 tấm (2 thùng rời: thêm 2 hồi; có nẹp + thanh ngang khung mặt hộc ngăn kéo), không lỗi', m.parts);
  // bộ mẫu tủ áo: chọn mẫu → bấm Dùng mẫu → kích thước, khoang đổi theo; Chuẩn xưởng giữ nguyên
  // bản 1.28: một hàng "Tủ có sẵn" ở cuối thẻ (mục đầu = tủ mặc định), mô tả nằm ở title của từng mục
  // (1.36.4 — anh Thanh 16/10/2026: "Các thư viện này ra có hình được k") Thư viện = hàng NHÓM chip + lưới THẺ HÌNH; bấm thẻ là dùng luôn (không còn ô chọn + nút Dùng)
  { ok((await S(page, '[data-ui="mau"]').count()) === 0 && (await S(page, '[data-act="mau"]').count()) === 0, 'không còn ô chọn chữ + nút Dùng');
    ok(JSON.stringify(await S(page, '[data-act="tv-nhom"]').evaluateAll(bs => bs.map(b => b.textContent.trim()))) === JSON.stringify(['Tủ áo', 'Táp', 'Giường', 'Vách', 'Bếp']), 'hàng nhóm: Tủ áo · Táp · Giường · Vách · Bếp');
    ok(await S(page, '[data-ui="tv-luoi"]').isHidden() && (await S(page, '[data-act="tv-the"]').count()) === 0, 'lúc mở bảng: lưới gập, chưa dựng thẻ nào (dựng lười)');
    const tcs = await S(page, '.tcs').boundingBox(), dims = await S(page, '.dims').boundingBox();
    ok(tcs && dims && tcs.y < dims.y, 'thư viện nằm ĐẦU thẻ Tủ (trên ô kích thước)', [tcs, dims]);
    await S(page, '[data-act="tv-nhom"][data-nhom="tu"]').click();
    const the = await S(page, '[data-act="tv-the"]').evaluateAll(xs => xs.map(x => ({ ma: x.dataset.ma, ten: x.getAttribute('aria-label'), tip: x.title, svg: !!x.querySelector('svg path, svg polygon'), p: x.getAttribute('aria-pressed') })));
    ok(the.length >= 9 && the[0].ma === '' && the[0].ten === 'Tủ mặc định 3 khoang' && the.every(t => t.svg), 'nhóm Tủ áo: tủ mặc định + các mẫu, mỗi thẻ một hình 3D nhỏ', the.map(t => [t.ma, t.svg]));
    ok(/2 cánh: hai tầng treo · 2 cánh: 3 ngăn kéo \+ treo ngắn/.test((the.find(t => t.ma === 'TA4-2000-2T') || {}).tip), 'mô tả mẫu ở title của thẻ');
    ok((await S(page, '[data-act="tv-nhom"][data-nhom="tu"]').getAttribute('aria-expanded')) === 'true' && await S(page, '[data-ui="tv-luoi"]').isVisible(), 'bấm nhóm: lưới mở, nhóm aria-expanded');
    ok(the[0].p === 'true' && the.filter(t => t.p === 'true').length === 1, 'tủ mặc định đang mở: thẻ "Tủ mặc định" aria-pressed', the.map(t => t.p));
  }
  await S(page, '[data-act="tv-the"][data-ma="TA4-2000-2T"]').click();
  const spMau = await page.evaluate(() => window.MNCF.app.getSpec()); m = await page.evaluate(inPage.model);
  ok(spMau.rong === 2000 && spMau.khoang.length === 2 && spMau.khoang[1].o[0].so === 3 && m.errors.length === 0 && /Đã dùng "Tủ áo 4 cánh 2000 — hai tầng treo"/.test(await page.evaluate(inPage.status)), 'Dùng: ra tủ 4 cánh 2000, 3 ngăn kéo, không lỗi', [spMau.rong, spMau.khoang.length, m.errors]);
  ok((await S(page, 'input[data-k="rong"]').inputValue()) === '2000', 'ô nhập bề rộng cập nhật theo mẫu');
  { const p = await S(page, '[data-act="tv-the"]').evaluateAll(xs => xs.filter(x => x.getAttribute('aria-pressed') === 'true').map(x => x.dataset.ma));
    ok(JSON.stringify(p) === '["TA4-2000-2T"]' && await S(page, '[data-ui="tv-luoi"]').isVisible(), 'bấm thẻ: dùng luôn, thẻ đó aria-pressed, lưới vẫn mở', p);
    await S(page, '[data-act="tv-nhom"][data-nhom="tu"]').click();
    ok(await S(page, '[data-ui="tv-luoi"]').isHidden() && (await S(page, '[data-act="tv-nhom"][data-nhom="tu"]').getAttribute('aria-expanded')) === 'false', 'bấm lại nhóm đang mở: lưới gập'); }
  await chonMau(page, 'TA6-3000');
  m = await page.evaluate(inPage.model);
  ok(m.errors.length === 0 && m.parts === 65, 'về mẫu 6 cánh 3000: 65 tấm (2 thùng rời; 1.36.4: khoang 3 trống — trước 70 với 5 đợt đều)', m.parts);
  await S(page, '[data-act="lui"]').click();
  { const sl = await page.evaluate(() => window.MNCF.app.getSpec()); ok(sl.rong === 2000 && sl.khoang.length === 2 && (await S(page, 'input[data-k="rong"]').inputValue()) === '2000', '(bản 1.28) ↶ Lùi sau "Dùng": trở lại tủ 2000 đang làm (cả kích thước lẫn khoang)', [sl.rong, sl.khoang.length]); }
  await chonMau(page, 'TA6-3000');
  ok(await S(page, '.pri[data-act="json"]').isVisible() && !(await S(page, '[data-act="draw"]').count()), 'trang độc lập: có nút tải JSON, không có nút vẽ');

  await page.evaluate(s => window.MNCF.app.setSpec(s), TU_2000);
  m = await page.evaluate(inPage.model);
  ok(m.parts === 46 && m.dem === 2 && JSON.stringify(m.mat) === JSON.stringify([[1061, 69.5, 819.5, 172, false], [1061, 295.5, 819.5, 172, false]]), 'tủ 2000: 2 vách đệm, mặt ngăn kéo 819,5 × 172 (bản 1.31: khung mặt — thanh ngang 50 phẳng mặt thay cho khe)', m.mat);

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
  kg = await page.evaluate(() => { const M = window.MNCF.app.getModel(); return { loi: M.errors, K: M.info.khau[0], u: M.parts.filter(p => p.khau && p.khau.length && p.loai !== 'DAY' && p.loai !== 'NOC').length, vk: M.parts.filter(p => p.ten === 'Vách khấu cột').length, n: M.info.khoang.length, w: M.info.khoang }; });
  ok(kg.loi.length === 0 && kg.K.co_a && kg.K.co_b && kg.u === 0 && kg.vk === 0 && kg.n > g0.n && kg.w.includes(280), 'bấm "Đặt vách theo mép cột giữa" → khoang nông 280 trước cột (cột 250 + 2 khe hở 15), không vách khấu; ngoài nóc / đáy liền thùng (bản 1.31: phủ hồi, khoét chữ U quanh cột) không tấm nào khoét', kg);
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
  await theSau(page.locator('#mncf-host'), 'chuan');
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

// Bản 1.28 (anh Thanh 06/10/2026: "phải có nút trên hình cho nó nhanh, với hình minh họa có 3d hoặc chọn trên ảnh thêm phào sửa phào luôn";
// "vẽ phòng ấy rồi tự khấu cột, giờ muốn vẽ tủ mới vẫn ra tủ khấu cột") — phào và cột sửa ngay trên hình, hình 3D xoay được, "Về tủ mẫu" / "Dùng mẫu" không mang khấu cột cũ.
async function testHinhSua(browser) {
  console.log('— Sửa phào / bỏ cột ngay trên hình, hình 3D, tủ mới không mang khấu cột cũ (bản 1.28)');
  const { ctx, page, errs } = await open(browser, path.join(DIST, 'mn-chenfeng.html'));
  const sp = () => page.evaluate(inPage.spec), bar = () => page.evaluate(inPage.bar), st = () => page.evaluate(inPage.status);
  const KHAU = { trai: { rong: 0, sau: 0 }, phai: { rong: 0, sau: 0 }, giua: [{ cach: 600, rong: 300, sau: 200 }], ho: 20 };
  await page.evaluate(s => window.MNCF.app.setSpec(s), Object.assign({}, TU_2000, { khau: KHAU }));
  // PHÀO: bấm phào trái → thanh sửa dưới hình; Bỏ phào → dải "+ phào" nét đứt ngoài mép trái; bấm dải đó → Thêm phào 50
  ok((await S(page, '.view [data-phao="trai"]').count()) === 2 && (await S(page, '.view [data-phao="tren"]').count()) >= 1, 'hình đứng: phào trái (2 thân), phải, trên đều bấm được');
  await S(page, '.view [data-phao="trai"]').first().click();
  ok(/Phào trái · rộng 50/.test(await bar()) && (await S(page, '#mncf-ed-phao').inputValue()) === '50' && (await S(page, '[data-ed="phao-bo"]').isVisible()), 'bấm phào trái: thanh dưới hình hiện "Phào trái · rộng 50", ô số, nút Bỏ phào', await bar());
  ok((await page.evaluate(() => document.getElementById('mncf-host').shadowRoot.querySelectorAll('.view [data-phao="trai"][stroke]').length)) === 2, '… phào đang chọn được tô viền trên hình');
  await S(page, '[data-ed="phao-bo"]').click();
  let s = await sp();
  ok(s.phao.trai === 0 && s.rong === 2000 && (await S(page, '#mncf-phao-trai').inputValue()) === '0' && /Đã bỏ phào trái/.test(await st()), 'Bỏ phào: phào trái = 0, rộng phủ bì giữ 2000, ô "Phào trái" ở thẻ Tủ cũng về 0', [s.phao, s.rong]);
  ok(/\+ phào/.test(await page.evaluate(() => document.getElementById('mncf-host').shadowRoot.querySelector('.view').innerHTML)) && /chưa có/.test(await bar()) && (await S(page, '[data-ed="phao-them"]').isVisible()), 'mép trái hiện dải "+ phào"; thanh sửa có nút "Thêm phào 50"', await bar());
  await S(page, '[data-ed="phao-them"]').click();
  ok((await sp()).phao.trai === 50, 'Thêm phào: phào trái 50');
  await S(page, '#mncf-ed-phao').fill('30'); await S(page, '#mncf-ed-phao').press('Enter');
  ok((await sp()).phao.trai === 30 && /Phào trái rộng 30/.test(await st()), 'gõ 30 + Enter: phào trái 30');
  await S(page, '[data-ed="phao-ca3"]').click();
  s = await sp(); ok(s.phao.trai === 30 && s.phao.phai === 30 && s.phao.tren === 30, '"Cả 3 phào = 30": trái, phải, trên đều 30', s.phao);
  await S(page, '[data-act="lui"]').click(); await S(page, '[data-act="lui"]').click(); await S(page, '[data-act="lui"]').click();
  s = await sp(); ok(s.phao.trai === 0 && s.phao.phai === 50 && s.phao.tren === 50 && (await S(page, '#mncf-phao-trai').inputValue()) === '0', '↶ Lùi 3 lần: phào trở lại như lúc vừa bỏ phào trái', s.phao);
  await S(page, '[data-act="lui"]').click();
  ok((await sp()).phao.trai === 50, '↶ Lùi thêm 1: phào trái 50 như ban đầu');
  // dải "+ phào" phía trên: bỏ phào trên bằng phím Delete, rồi bấm dải để chọn lại
  await S(page, '.view [data-phao="tren"]').first().click(); await S(page, '.view').press('Delete');
  ok((await sp()).phao.tren === 0, 'chọn phào trên + phím Delete: bỏ phào trên');
  await S(page, '.view [data-phao="tren"]').click();
  ok(/Phào trên · chưa có/.test(await bar()), 'bấm dải "+ phào" phía trên: chọn phào trên (chưa có)', await bar());
  await S(page, '[data-ed="phao-them"]').click(); ok((await sp()).phao.tren === 50, '… Thêm phào 50');
  // CỘT: hình nhìn từ trên xuống có cột bấm được → Bỏ cột này
  ok((await S(page, '.view [data-cot="600:900"]').count()) === 1, 'hình nhìn từ trên xuống: cột 300 × 200 cách trái 600 bấm được');
  await S(page, '.view [data-cot="600:900"]').click();
  ok(/Cột 300 × 200/.test(await bar()) && (await S(page, '[data-ed="cot-bo"]').isVisible()), 'bấm cột: thanh dưới hình "Cột 300 × 200 · tủ đang khấu…", nút Bỏ cột này', await bar());
  await S(page, '[data-ed="cot-bo"]').click();
  s = await sp();
  ok(JSON.stringify(s.khau) === JSON.stringify({ trai: { rong: 0, sau: 0 }, phai: { rong: 0, sau: 0 }, giua: [], ho: 20 }) && (await page.evaluate(() => window.MNCF.app.getModel().info.khau.length)) === 0
    && !/Nhìn từ trên xuống/.test(await page.evaluate(() => document.getElementById('mncf-host').shadowRoot.querySelector('.view').innerHTML)) && /Đã bỏ khấu cột/.test(await st()), 'Bỏ cột: tủ không còn khấu (giữ khe hở đã gõ), hình nhìn từ trên xuống biến mất', s.khau);
  ok((await S(page, '#mncf-khau-giua-0-rong').inputValue()) === '0' || (await S(page, '#mncf-khau-giua-0-rong').inputValue()) === '', '… ô "Cột GIỮA 1: rộng" ở thẻ Tủ cũng trống');
  await S(page, '[data-act="lui"]').click();
  ok((await sp()).khau.giua.length === 1 && (await page.evaluate(() => window.MNCF.app.getModel().info.khau.length)) === 1, '↶ Lùi: cột trở lại');
  // hai cột: nút "Bỏ hết 2 cột"
  await page.evaluate(s2 => window.MNCF.app.setSpec(s2), Object.assign({}, TU_2000, { khau: { trai: { rong: 150, sau: 150 }, phai: { rong: 0, sau: 0 }, giua: [{ cach: 600, rong: 300, sau: 200 }], ho: 15 } }));
  await S(page, '.view [data-cot="600:900"]').click();
  ok((await S(page, '[data-ed="cot-bo-het"]').innerText()) === 'Bỏ hết 2 cột', 'có 2 cột: thêm nút "Bỏ hết 2 cột"');
  await S(page, '[data-ed="cot-bo"]').click();
  s = await sp(); ok(s.khau.trai.rong === 150 && s.khau.giua.length === 0, 'Bỏ cột này: chỉ bỏ cột giữa, cột trái còn', s.khau);
  await S(page, '.view [data-cot="0:150"]').click(); await S(page, '.view').press('Delete');
  ok(!(await sp()).khau.trai.rong, 'chọn cột trái + Delete: bỏ cột trái');
  // HÌNH 3D: bật nút 3D → hình 3D; kéo để xoay; bấm phào trên hình 3D vẫn sửa được; tắt → hình đứng
  await S(page, '[data-act="xem-3d"]').click();
  const svg3 = () => page.evaluate(() => { const g = document.getElementById('mncf-host').shadowRoot.querySelector('.view svg'); return g ? [g.getAttribute('data-3d'), g.innerHTML.length, g.querySelectorAll('polygon').length, g.innerHTML] : null; });
  let g3 = await svg3();
  ok(g3 && g3[0] === '1' && g3[2] > 100 && (await S(page, '[data-act="xem-3d"]').getAttribute('aria-pressed')) === 'true' && (await S(page, '[data-act="them-vach"]').isDisabled()), 'bấm 3D: hình 3D (mỗi tấm một khối), nút sáng lên, "＋ Vách" tạm khoá', g3 && g3.slice(0, 3));
  const bx = await S(page, '.view svg').boundingBox();
  await page.mouse.move(bx.x + bx.width * 0.15, bx.y + 12); await page.mouse.down(); await page.mouse.move(bx.x + bx.width * 0.15 + 120, bx.y + 40, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(100);
  const g3b = await svg3();
  ok(g3b[3] !== g3[3] && g3b[0] === '1', 'kéo trên hình 3D: góc nhìn xoay (hình vẽ lại)');
  await S(page, '.view').press('ArrowLeft'); const g3c = await svg3();
  ok(g3c[3] !== g3b[3], 'phím ← trên hình 3D: xoay tiếp');
  await S(page, '.view svg [data-phao="phai"]').first().click({ force: true });
  ok(/Phào phải · rộng 50/.test(await bar()), 'bấm phào trên hình 3D: thanh sửa phào hiện như hình đứng', await bar());
  const g3d = (await svg3())[3]; await S(page, '.view').press('ArrowRight');
  ok((await svg3())[3] !== g3d && /Phào phải/.test(await bar()), 'đang chọn phào trên hình 3D: phím → vẫn xoay hình (phào vẫn đang chọn)');
  await S(page, '[data-ed="phao-bo"]').click();
  ok((await sp()).phao.phai === 0 && (await svg3())[0] === '1', '… Bỏ phào ngay trong 3D, hình vẫn là 3D');
  { const b3 = await S(page, '.view svg').boundingBox();      // kéo xoay lần nữa rồi về hình đứng: cú bấm đầu tiên trên hình đứng không bị nuốt
    await page.mouse.move(b3.x + b3.width * 0.15, b3.y + 12); await page.mouse.down(); await page.mouse.move(b3.x + b3.width * 0.15 - 90, b3.y + 30, { steps: 5 }); await page.mouse.up(); }
  await S(page, '[data-act="xem-3d"]').click();
  await S(page, '.view [data-phao="trai"]').first().click();
  ok(/Phào trái/.test(await bar()), 'xoay 3D xong, về hình đứng: bấm phào lần đầu là chọn được ngay', await bar());
  await S(page, '[data-act="xem-3d"]').click(); await S(page, '[data-act="xem-3d"]').click();
  ok((await svg3())[0] === null && (await S(page, '.view [data-o]').count()) > 0 && !(await S(page, '[data-act="them-vach"]').isDisabled()), 'bấm 3D lần nữa: về hình đứng (ô bấm được, "＋ Vách" mở lại)');
  // gõ ô Phào ở thẻ Tủ rồi sửa trên hình: ↶ Lùi trả từng bước, không xoá ngầm số vừa gõ
  await page.evaluate(s2 => window.MNCF.app.setSpec(s2), TU_2000);
  await S(page, '#mncf-phao-trai').fill('40'); await S(page, '#mncf-phao-trai').press('Tab');
  ok(+(await sp()).phao.trai === 40, '(chuẩn bị) gõ phào trái 40');
  await S(page, '.view [data-phao="phai"]').first().click(); await S(page, '[data-ed="phao-bo"]').click();
  ok((await sp()).phao.phai === 0, '(chuẩn bị) bỏ phào phải trên hình');
  await S(page, '[data-act="lui"]').click();
  s = await sp(); ok(s.phao.phai === 50 && s.phao.trai === 40, '↶ Lùi: phào phải trở lại 50, phào trái GIỮ 40 vừa gõ', s.phao);
  await S(page, '[data-act="lui"]').click();
  s = await sp(); ok(s.phao.trai === 50 && (await S(page, '#mncf-phao-trai').inputValue()) === '50', '↶ Lùi tiếp: về trước lúc gõ (phào trái 50)', s.phao);
  // "Về tủ mẫu" / "Dùng mẫu" khi không có chỗ đặt nào đang giữ: tủ mới không mang khấu cột cũ
  await page.evaluate(s2 => window.MNCF.app.setSpec(s2), Object.assign({}, TU_2000, { sau_thung: 382.5, khau: KHAU }));
  await chonMau(page, '');      // mục "Tủ mặc định 3 khoang" (bản 1.28: thay nút "Về tủ mẫu")
  s = await sp();
  ok(JSON.stringify(s.khau) === JSON.stringify({ trai: { rong: 0, sau: 0 }, phai: { rong: 0, sau: 0 }, giua: [], ho: 20 }) && s.sau_thung === 580 && !(await page.evaluate(() => window.MNCF.app.getModel().errors.length)),
    '"Về tủ mẫu": bỏ khấu cột (giữ khe hở đã gõ), sâu thùng về 580', [s.khau, s.sau_thung]);
  await page.evaluate(s2 => window.MNCF.app.setSpec(s2), Object.assign({}, TU_2000, { khau: KHAU }));
  await chonMau(page, 'TA4-2000');
  ok((await sp()).khau.giua.length === 0, '"Dùng mẫu": tủ mẫu không mang khấu cột của tủ trước');
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
  ok(sp.hau.kieu === 'phu' && h.length === 4 && h.every(x => x[0] === 6.5 && x[1] === 573.5 && x[2] === 580 && x[3] === '不排'), 'thông số bản cũ → hậu 6,5 phủ sau lưng thùng (bản 1.29.2)', [sp.hau, h]);
  ok(/Hậu đã đổi sang chuẩn xưởng mới/.test(await page.evaluate(inPage.status)), 'có dòng báo hậu đã đổi sang chuẩn mới', await page.evaluate(inPage.status));
  // người dùng chủ động chọn lại hậu dày ở bản 1.3 → lần mở sau phải giữ, không tự đổi lần nữa
  await theSau(page.locator('#mncf-host'), 'chuan');
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
  await theSau(page.locator('#mncf-host'), 'chuan');
  ok((await S(page, '#mncf-hau-kieu').inputValue()) === 'phu' && (await S(page, '#mncf-hau-t').inputValue()) === '6' && (await S(page, '#mncf-hau-mep').inputValue()) === '1' && (await S(page, '#mncf-hau-chia').inputValue()) === 'khoang', 'Chuẩn xưởng → Hậu: kiểu phủ, dày 6, mép lùi 1, mỗi khoang 1 tấm');
  ok((await S(page, '#mncf-hau-lui').count()) === 0 && (await S(page, '#mncf-hau-ranh_sau').count()) === 0, 'các ô của hậu soi rãnh ẩn khi đang chọn hậu phủ');
  await S(page, '#mncf-hau-kieu').selectOption('day'); await page.waitForTimeout(350);
  h = await hau();
  ok((await S(page, '#mncf-hau-t').inputValue()) === '17.5' && h.length === 4 && h.every(x => x[0] === 17.5 && x[1] === 562.5 && x[3] === 'Cam3Tp') && (await S(page, '#mncf-hau-mep').count()) === 0, 'đổi sang hậu dày: dày 17,5, lọt lòng, khoan cam; các ô của hậu phủ ẩn', h);
  await S(page, '#mncf-hau-kieu').selectOption('mong'); await page.waitForTimeout(350);
  ok(/^6[.,]5$/.test(await S(page, '#mncf-hau-t').inputValue()) && (await S(page, '#mncf-hau-lui').count()) === 1, 'đổi sang hậu soi rãnh: dày 6,5 (bản 1.30 — xưởng không có ván 5), hiện các ô của hậu soi rãnh', await S(page, '#mncf-hau-t').inputValue());
  await S(page, '#mncf-hau-kieu').selectOption('phu'); await page.waitForTimeout(350);
  ok(/^6[.,]5$/.test(await S(page, '#mncf-hau-t').inputValue()), 'về hậu phủ: dày 6,5 (bản 1.29.2)', await S(page, '#mncf-hau-t').inputValue());
  // (bản 1.30) Chuẩn xưởng → Cánh → Loại bản lề: chọn loại thì số chén theo loại (ô số ẩn, số ở dòng giải thích); "Tự gõ số" mới hiện ô; hình vẽ một vòng tròn cho mỗi bản lề
  {
    const giai = () => S(page, 'fieldset:has(#mncf-canh-loai_ban_le) [data-giai]').textContent();
    const chen = () => page.evaluate(() => window.MNCF.app.getSpec().canh.chen);
    const vong = () => page.evaluate(() => [document.getElementById('mncf-host').shadowRoot.querySelectorAll('[data-ban-le]').length, window.MNCF.app.getModel().info.canh.ban_le]);
    ok((await S(page, '#mncf-canh-loai_ban_le').inputValue()) === 'k53' && (await S(page, '#mncf-canh-chen-tam_mep').count()) === 0 && /Kolity K53.*sâu 12, tâm chén cách mép cánh 21,5/.test(await giai()), 'mặc định Kolity K53: ô số chén ẩn, dòng giải thích ghi Ø / sâu / tâm', await giai());
    const [n0, t0] = await vong(); ok(n0 === t0 && t0 > 0, 'hình đứng: một vòng tròn cho mỗi bản lề', [n0, t0]);
    await S(page, '#mncf-canh-loai_ban_le').selectOption('imundex'); await page.waitForTimeout(350);
    ok((await chen()).sau === 11.5 && /Imundex.*sâu 11,5.*cánh dày 14–22/.test(await giai()), 'chọn Imundex thép: chén sâu 11,5, cánh 14–22', [await chen(), await giai()]);
    await S(page, '#mncf-canh-loai_ban_le').selectOption('tu_chon'); await page.waitForTimeout(350);
    ok((await S(page, '#mncf-canh-chen-sau').inputValue()) === '11.5' && (await S(page, '#mncf-canh-chen-tam_mep').inputValue()) === '21.5', '"Tự gõ số": hiện ô số, giữ số của loại vừa chọn');
    await S(page, '#mncf-canh-chen-sau').fill('13'); await page.waitForTimeout(350);
    ok((await chen()).sau === 13 && /tự gõ số.*sâu 13/.test(await giai()), 'gõ sâu chén 13', [await chen(), await giai()]);
    await S(page, '#mncf-canh-loai_ban_le').selectOption('k53'); await page.waitForTimeout(350);
    ok((await chen()).sau === 12 && (await S(page, '#mncf-canh-chen-sau').count()) === 0, 'về K53: sâu 12, ô số ẩn lại');
  }
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
  await page.waitForFunction(() => /Đã mở file tủ/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent));
  h = await hau();
  ok(h.every(x => x[0] === 6.5) && /Hậu đã đổi sang chuẩn xưởng mới/.test(await page.evaluate(inPage.status)), 'mẫu lưu từ bản 1.2 → hậu 6,5 phủ, có dòng báo', [h, await page.evaluate(inPage.status)]);
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
  // bản 1.28: mọi mục đạt → phiếu thu vào nút "✓ Tự kiểm" trên thanh công cụ của hình; bấm thì hiện + mở, bấm lần nữa thì gọn lại; ghi chú "tách thùng" nằm trong phiếu
  ok(!(await S(page, '[data-ui="phieu"]').isVisible()) && (await S(page, '[data-act="tu-kiem"]').innerText()) === '✓ Tự kiểm', 'mọi mục đạt: phiếu thu thành nút "✓ Tự kiểm"');
  ok(!/Tủ tách 2 thùng/.test(await S(page, '.msgs').innerText()) && /Tủ tách 2 thùng/.test(await S(page, '[data-ui="phieu"]').textContent()), 'ghi chú "tủ tách 2 thùng" (chỉ để biết) nằm trong phiếu, không chiếm chỗ dưới hình');
  await S(page, '[data-act="tu-kiem"]').click();
  ok(await S(page, '[data-ui="phieu"] li').first().isVisible() && (await S(page, '[data-act="tu-kiem"]').getAttribute('aria-expanded')) === 'true', 'bấm "✓ Tự kiểm": phiếu hiện và mở');
  await S(page, '[data-act="tu-kiem"]').click();
  ok(!(await S(page, '[data-ui="phieu"]').isVisible()), 'bấm lần nữa: phiếu gọn lại');
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
  await theSau(page.locator('#mncf-host'), 'chuan');
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
  ok((await S(page, '[data-act="vua-kho"]').count()) === 0, 'lỗi không phải khổ ván: không có nút "Thêm vách cho vừa khổ ván"');
  // (bản 1.30.1 — anh Thanh: "rất hay báo lỗi bị vượt khổ ván rất mệt") tủ 4 cánh 2 khoang kéo rộng 2600 → khoang 1280, hậu > 1220: một nút tự thêm vách
  await page.evaluate(s => window.MNCF.app.setSpec(s), { ma: 'T', rong: 2600, cao: 2400, hau: { t: 6 }, khoang: [{ rong: 'auto', canh: 2, dot: [1800], o: [{ tu: 0, kieu: 'suot' }] }, { rong: 'auto', canh: 2, dot: [520, 1800], o: [{ tu: 0, kieu: 'nk_am', so: 2 }, { tu: 520, kieu: 'suot' }] }] });
  ok((await page.evaluate(() => window.MNCF.app.getModel().errors.filter(t => /khổ ván/.test(t)).length)) === 2 && await S(page, '[data-act="vua-kho"]').isVisible() && !(await S(page, '[data-act="draw"], .pri[data-act="json"]').first().isEnabled()), 'khoang 1280: 2 dòng đỏ khổ ván (hậu), nút Vẽ khoá, có nút "Thêm vách cho vừa khổ ván"');
  await S(page, '[data-act="vua-kho"]').click();
  await page.waitForFunction(() => window.MNCF.app.getSpec().khoang.length === 3);
  const sp = await page.evaluate(() => window.MNCF.app.getSpec()), md = await page.evaluate(() => ({ e: window.MNCF.app.getModel().errors, w: window.MNCF.app.getModel().info.khoang }));
  ok(md.e.length === 0 && sp.khoang.every(k => k.rong === 'auto' && k.canh === 2) && JSON.stringify(sp.khoang[0].o) === JSON.stringify(sp.khoang[1].o) && sp.khoang[2].o.length === 2 && (await S(page, '[data-act="vua-kho"]').count()) === 0, 'bấm: 3 khoang 2 cánh, khoang tách giữ nội dung ô, hết lỗi, nút biến mất', [md, sp.khoang]);
  ok(/Đã chia lại 2 → 3 khoang cho vừa khổ ván/.test(await page.evaluate(inPage.status)) && await S(page, '.pri[data-act="json"]').isEnabled(), 'dòng báo nói đã chia lại khoang; nút xuất mở lại', await page.evaluate(inPage.status));
  await S(page, '[data-act="lui"]').click();
  ok((await page.evaluate(() => window.MNCF.app.getSpec().khoang.length)) === 2, '↶ Lùi: trả lại 2 khoang');
  // (1.31.1) chỉ còn đáy / nóc / đế liền thùng vượt khổ (phủ hồi, "Rộng tối đa một thùng" = 0): không có nút, nhưng có dòng nhắc đặt số đó
  await page.evaluate(s => window.MNCF.app.setSpec(s), { ma: 'T', rong: 3000, cao: 2400, hau: { t: 6 }, than: { cao_duoi: 0 }, thung: { noc_day: 'phu_hoi', rong_max: 0 }, khoang: [0, 1, 2].map(() => ({ rong: 'auto', canh: 2, dot: [1800], o: [] })) });
  { const nhac = S(page, '.msg.warn').filter({ hasText: 'Rộng tối đa một thùng' });
    ok((await S(page, '[data-act="vua-kho"]').count()) === 0 && await nhac.isVisible() && /đang 0 = không tách/.test(await nhac.textContent()), 'phủ hồi thùng liền dài hơn khổ: không có nút thêm vách, có dòng nhắc đặt "Rộng tối đa một thùng" (đang 0)', await page.evaluate(() => window.MNCF.app.getModel().errors)); }
  ok(errs.length === 0, 'không lỗi JS', errs);
  await ctx.close();
}

async function testThuVien(browser) {
  console.log('— Thư viện: tủ áo, táp, giường (thường / bay / ngăn kéo), vách đầu giường (bản 1.32)');
  const { ctx, page, errs } = await open(browser, path.join(DIST, 'mn-chenfeng.html'));
  const nhom = (await tvNhom(page)).map(x => x[0]);
  ok(['Tủ áo', 'Táp', 'Giường', 'Vách'].every(t => nhom.indexOf(t) >= 0), 'Thư viện chia nhóm Tủ áo / Táp / Giường / Vách', nhom);
  const chon = async ma => { await chonMau(page, ma); await page.waitForFunction(m => (window.MNCF.app.getSpec().loai_sp || 'tu') === m, ma ? (ma[0] === 'G' ? 'giuong' : ma[0] === 'V' ? 'vach' : ma.indexOf('TAP') === 0 || ma === '@TAP' ? 'tap' : 'tu') : 'tu'); };
  const nhan = () => S(page, '.dims label').evaluateAll(ls => ls.map(l => l.textContent.trim()));
  await chon('G16-T');
  ok((await S(page, '.panel').getAttribute('data-loai')) === 'giuong' && await S(page, '.sp').isVisible() && !(await S(page, '.bays').isVisible()), 'giường: ô Giường hiện, phần khoang của tủ ẩn');
  ok(JSON.stringify(await nhan()) === JSON.stringify(['Rộng phủ bì', 'Dài phủ bì', 'Cao đầu giường']), 'giường: ô kích thước đổi tên', await nhan());
  ok((await page.evaluate(() => window.MNCF.app.getModel().errors.length)) === 0 && await S(page, '.view svg').isVisible(), 'giường: dựng được, có hình');
  ok((await S(page, '#mncf-nem-r').inputValue()) === '1600' && (await S(page, '#mncf-nem-d').inputValue()) === '2000', 'ô nệm 1600 × 2000');
  await S(page, '#mncf-nem-r').fill('1800');
  await page.waitForFunction(() => window.MNCF.app.getModel().info.giuong && window.MNCF.app.getModel().info.giuong.nem[0] === 1800);
  { const sp = await page.evaluate(() => window.MNCF.app.getSpec()); ok(near(sp.rong, 1800 + 2 * 10 + 4 * sp.van.t), 'gõ nệm 1800: rộng phủ bì tự tính = nệm + 2 khe + 2 hông 2 lớp', sp.rong); }
  // đổi dày ván (Chuẩn xưởng) hay "Về chuẩn mặc định": cỡ nệm giữ nguyên, phủ bì đi theo
  await theSau(page.locator('#mncf-host'), 'chuan'); await S(page, '.settings input[data-k="van.t"]').fill('18');
  await page.waitForFunction(() => window.MNCF.app.getSpec().van.t === 18);
  { const r = await page.evaluate(() => [window.MNCF.app.getModel().info.giuong.nem, window.MNCF.app.getSpec().rong]); ok(r[0][0] === 1800 && r[0][1] === 2000 && near(r[1], 1800 + 20 + 4 * 18), 'đổi dày ván 18: nệm vẫn 1800 × 2000, rộng phủ bì đi theo', r); }
  await S(page, '[data-act="defaults"]').click();
  { const r = await page.evaluate(() => [window.MNCF.app.getModel().info.giuong.nem, window.MNCF.app.getSpec().van.t]); ok(r[0][0] === 1800 && r[0][1] === 2000 && r[1] === 17.5, '"Về chuẩn mặc định": ván 17,5, nệm vẫn 1800 × 2000', r); }
  await S(page, '.tab[data-tab="tu"]').click();
  await S(page, '[data-k="giuong.kieu"]').selectOption('bay');
  await page.waitForFunction(() => window.MNCF.app.getModel().parts.some(p => p.loai === 'DEB'));
  ok(await S(page, '[data-k="giuong.cao_de"]').isVisible() && await S(page, '[data-k="giuong.lui_de"]').isVisible(), 'kiểu giường bay: hiện ô cao đế / lùi đế');
  await S(page, '[data-k="giuong.kieu"]').selectOption('nk');
  await page.waitForFunction(() => window.MNCF.app.getModel().parts.filter(p => p.loai === 'MNK').length === 4);
  ok(await S(page, '[data-k="giuong.nk_ben"]').isVisible() && (await S(page, '[data-k="giuong.cao_de"]').count()) === 0, 'kiểu ngăn kéo: hiện ô ngăn kéo, bỏ ô đế');
  await S(page, '[data-k="giuong.nk_ben"]').selectOption('trai');
  await page.waitForFunction(() => window.MNCF.app.getModel().parts.filter(p => p.loai === 'MNK').length === 2);
  ok(true, 'ngăn kéo một bên: 2 mặt ngăn kéo');
  await S(page, '[data-act="lui"]').click();
  await page.waitForFunction(() => window.MNCF.app.getSpec().giuong.nk_ben === 'hai');
  ok(true, '↶ Lùi: trả lại ngăn kéo hai bên');
  await chon('V2800-1200');
  ok(JSON.stringify(await nhan()) === JSON.stringify(['Rộng vách', 'Cao vách']) && await S(page, '[data-k="vach.so_o"]').isVisible(), 'vách: 2 ô kích thước + ô số ô', await nhan());
  ok((await page.evaluate(() => { const M = window.MNCF.app.getModel(); return !M.errors.length && M.parts.filter(p => p.loai === 'OP').length === 4; })), 'vách 2800: 4 tấm ốp, không lỗi');
  await chon('G16-B'); await theSau(page.locator('#mncf-host'), 'chuan'); await S(page, '[data-act="defaults"]').click();
  ok((await page.evaluate(() => { const s = window.MNCF.app.getSpec(); return s.loai_sp === 'giuong' && s.giuong.kieu === 'bay' && !window.MNCF.app.getModel().errors.length; })), 'giường bay → "Về chuẩn mặc định": vẫn là giường bay');
  await S(page, '.tab[data-tab="tu"]').click();
  // (1.36.2 — anh Thanh: "chỉ làm 1 hạng mục là táp thôi, trong đó hiện nhiều mẫu có hình ảnh click vào là xong") ô Thư viện: MỘT mục táp (trước: 5 mục TAP-GO1…)
  { const tv = await tvNhom(page), tap = tv.find(x => x[0] === 'Táp');
    ok(tap && JSON.stringify(tap[1]) === JSON.stringify(['@TAP']), 'Thư viện táp: một mục "Táp đầu giường" (bấm nhóm Táp là dùng)', tv);
    const ma = [].concat(...tv.map(x => x[1])); ok(!ma.some(x => /^TAP/.test(x)), 'Thư viện không còn mã táp theo kiểu / cỡ', ma.filter(x => /TAP/.test(x))); }
  await chon('@TAP');
  // (1.34.1) khối táp: KIỂU (A … E), kiểu đang dùng bấm sẵn; gõ cao → ruột chia lại; đổi kiểu giữ cỡ đang gõ; ↶ Lùi về kiểu trước
  // (1.36.2) kiểu là THẺ HÌNH: mỗi thẻ một hình 3D nhỏ (svg dựng tại chỗ, không ảnh ngoài) + tên ngắn; lưới tự xuống dòng, không tràn ngang
  { const nut = S(page, '.sp [data-act="tap-kieu"]');
    ok(await S(page, '.sp').isVisible() && (await nut.count()) === 5 && (await S(page, '.sp [data-act="tap-kieu"][data-kieu="A"]').getAttribute('aria-pressed')) === 'true', 'táp: khối táp có 5 thẻ kiểu, A đang chọn', await nut.count());
    const the = await S(page, '.sp [data-act="tap-kieu"]').evaluateAll(bs => bs.map(b => ({ k: b.dataset.kieu, poly: b.querySelectorAll('svg polygon').length, img: b.querySelectorAll('img').length, chu: b.textContent.trim(), w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height })));
    ok(the.every(x => x.poly >= 10 && !x.img && /^[A-E] · \S/.test(x.chu) && x.w > 40 && x.h > 40), 'mỗi thẻ có hình 3D (svg) + tên ngắn, không ảnh ngoài', the);
    const tran = () => S(page, '.sp').evaluate(e => e.scrollWidth - e.clientWidth);
    ok((await tran()) <= 1, 'lưới thẻ không tràn ngang', await tran());
    { await S(page, '.sp').evaluate(e => { e.style.width = '170px'; });
      const hep = await S(page, '.sp').evaluate(e => ({ tran: e.scrollWidth - e.clientWidth, hang: new Set([...e.querySelectorAll('[data-act="tap-kieu"]')].map(b => Math.round(b.getBoundingClientRect().top))).size }));
      await S(page, '.sp').evaluate(e => { e.style.width = ''; });
      ok(hep.tran <= 1 && hep.hang >= 2, 'bề ngang hẹp (170 px): lưới tự xuống dòng, không tràn', hep); }
    const hinhA = await S(page, '.sp [data-act="tap-kieu"][data-kieu="B"] svg').evaluate(e => e.outerHTML);
    const dot = () => page.evaluate(() => window.MNCF.app.getSpec().khoang[0].dot.slice());
    const muon = await page.evaluate(() => { const s = window.MNCF.app.getSpec(); return window.MNCFCore.tapTheoKieu('A', { rong: s.rong, sau: s.sau_thung, cao: 700 }).khoang[0].dot; });
    await S(page, '#mncf-cao').fill('700');
    await page.waitForFunction(m => JSON.stringify(window.MNCF.app.getSpec().khoang[0].dot) === JSON.stringify(m) && window.MNCF.app.getSpec().cao === 700, muon).catch(() => {});
    ok(JSON.stringify(await dot()) === JSON.stringify(muon) && !(await page.evaluate(() => window.MNCF.app.getModel().errors.length)), 'táp A gõ cao 700: đợt hộc chia lại theo cao', [await dot(), muon]);
    ok((await S(page, '#mncf-b0-dot').inputValue()).replace(/\s/g, '') === muon.join(','), 'ô Đợt của khoang theo kịp', await S(page, '#mncf-b0-dot').inputValue());
    await S(page, '#mncf-rong').fill('520');
    await page.waitForFunction(() => window.MNCF.app.getSpec().rong === 520);
    ok((await S(page, '.sp [data-act="tap-kieu"][data-kieu="B"] svg').evaluate(e => e.outerHTML)) === hinhA, 'hình thẻ dựng một lần ở cỡ mặc định (gõ Rộng không vẽ lại)');
    await S(page, '.sp [data-act="tap-kieu"][data-kieu="B"] svg').click({ force: true });      // bấm trúng hình trong thẻ cũng là chọn kiểu
    await page.waitForFunction(() => window.MNCF.app.getSpec().tap.kieu === 'B');
    ok(await page.evaluate(() => { const s = window.MNCF.app.getSpec(), M = window.MNCF.app.getModel(); return s.rong === 520 && s.cao === 700 && s.khoang[0].o[0].so === 3 && M.mat_ngan_keo.length === 3 && !M.errors.length; }), 'đổi sang B: giữ 520 × 700, ruột theo B (cao 700 → 3 ngăn kéo)', await page.evaluate(() => window.MNCF.app.getSpec().khoang));
    ok((await S(page, '.sp [data-act="tap-kieu"][data-kieu="B"]').getAttribute('aria-pressed')) === 'true' && (await S(page, '#mncf-cao').inputValue()) === '700', 'nút B bấm sẵn, ô Cao vẫn 700');
    await S(page, '#mncf-cao').fill('560');
    await page.waitForFunction(() => window.MNCF.app.getSpec().cao === 560 && window.MNCF.app.getSpec().khoang[0].o[0].so === 2).catch(() => {});
    ok(await page.evaluate(() => { const s = window.MNCF.app.getSpec(); return s.cao === 560 && s.khoang[0].o[0].so === 2 && window.MNCF.app.getModel().mat_ngan_keo.length === 2; }), 'B gõ cao 560: về 2 ngăn kéo');
    await S(page, '[data-act="lui"]').click(); await S(page, '[data-act="lui"]').click();
    ok(await page.evaluate(() => { const s = window.MNCF.app.getSpec(); return s.tap.kieu === 'A' && s.cao === 700; }), '↶ Lùi: về táp A cao 700', await page.evaluate(() => [window.MNCF.app.getSpec().tap.kieu, window.MNCF.app.getSpec().cao]));
    // người dùng sửa ruột (đợt) → gõ cỡ không chia lại nữa
    await page.evaluate(() => { const s = window.MNCF.app.getSpec(); s.khoang[0].dot = [300]; window.MNCF.app.setSpec(s); });
    await S(page, '#mncf-cao').fill('650'); await page.waitForFunction(() => window.MNCF.app.getSpec().cao === 650);
    await page.waitForTimeout(300);
    ok(JSON.stringify(await dot()) === '[300]', 'đã sửa đợt tay: gõ cao không chia lại', await dot());
    // bấm lại kiểu: chia lại theo cỡ đang gõ
    await S(page, '.sp [data-act="tap-kieu"][data-kieu="A"]').click();
    await page.waitForFunction(() => window.MNCF.app.getSpec().khoang[0].dot[0] !== 300);
    ok(JSON.stringify(await dot()) === JSON.stringify(await page.evaluate(() => window.MNCFCore.tapTheoKieu('A', { cao: 650 }).khoang[0].dot)), 'bấm lại kiểu A: ruột chia lại theo cao 650', await dot());
    await chon('@TAP');
    await S(page, '.sp [data-act="tap-kieu"][data-kieu="C"]').click(); await page.waitForFunction(() => window.MNCF.app.getSpec().tap.kieu === 'C');
    // (soát 1.34.1) bấm lại kiểu: giữ phào + cánh, báo xà đế theo kiểu
    await page.evaluate(() => { const s = window.MNCF.app.getSpec(); s.phao.trai = 40; s.phao.phai = 40; s.chan.cao = 80; window.MNCF.app.setSpec(s); });
    await S(page, '.sp [data-act="tap-kieu"][data-kieu="C"]').click(); await page.waitForFunction(() => window.MNCF.app.getSpec().chan.cao === 50);      // (1.36.2) xà đế C = của A (50; trước 40)
    ok(await page.evaluate(() => { const s = window.MNCF.app.getSpec(); return s.phao.trai === 40 && s.phao.phai === 40; }) && /xà đế/.test(await page.evaluate(inPage.status)), 'bấm lại C: giữ phào 40, báo xà đế về cao của kiểu', await page.evaluate(inPage.status));
    // (soát 1.36.2) bàn phím: lưới thẻ hình là chỗ chọn kiểu chính — Enter trên thẻ đổi kiểu mà tiêu điểm không được rơi về BODY (renderSP dựng lại khối .sp)
    await S(page, '.sp [data-act="tap-kieu"][data-kieu="D"]').focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.MNCF.app.getSpec().tap.kieu === 'D');
    const tdiem = await page.evaluate(() => { const h = document.getElementById('mncf-host'), a = h && h.shadowRoot ? h.shadowRoot.activeElement : null; return a ? { act: a.dataset.act, k: a.dataset.kieu, nhan: a.getAttribute('aria-pressed') } : null; });
    ok(tdiem && tdiem.act === 'tap-kieu' && tdiem.k === 'D' && tdiem.nhan === 'true', 'Enter trên thẻ D: tiêu điểm ở lại thẻ D (đang chọn)', tdiem);
    // (soát 1.36.4) đang làm táp thì chip Táp không dựng lại táp mặc định nữa — về kiểu A bằng thẻ kiểu
    await S(page, '.sp [data-act="tap-kieu"][data-kieu="A"]').click(); await page.waitForFunction(() => window.MNCF.app.getSpec().tap.kieu === 'A'); }
  ok(await page.evaluate(() => { const s = window.MNCF.app.getSpec(); return !!(s.tap && s.tap.go > 0) && window.MNCF.app.getModel().parts.some(p => p.loai === 'GO'); }), 'táp gờ chắn: có khoá tap + gờ sau');
  ok((await S(page, '.panel').getAttribute('data-loai')) === 'tap' && !(await S(page, '.sp [data-k^="giuong"]').count()) && await S(page, '.bays').isVisible(), 'táp: như tủ thường (có phần khoang), không ô Giường');
  ok((await page.evaluate(() => { const s = window.MNCF.app.getSpec(); return s.khoang.length === 1 && s.ve_goc === window.MNCFCore.DEFAULT_SPEC.ve_goc && !window.MNCF.app.getModel().errors.length; })), 'táp: 1 khoang, cách vẽ như tủ');
  // (soát 1.34.1) "Về chuẩn mặc định" giữ kết cấu táp mới (khoá tap) — trước: rơi về táp kiểu 1.32 (mất gờ, chân trước phủ mặt) mà không báo
  await theSau(page.locator('#mncf-host'), 'chuan'); await S(page, '[data-act="defaults"]').click();
  ok((await page.evaluate(() => { const s = window.MNCF.app.getSpec(), M = window.MNCF.app.getModel(); return s.loai_sp === 'tap' && !!(s.tap && s.tap.go > 0) && M.parts.some(p => p.loai === 'GO') && !M.errors.length; })), 'táp gờ chắn → "Về chuẩn mặc định": vẫn là táp gờ chắn (giữ khoá tap)');
  // (soát 1.36.2) Chuẩn xưởng → Hậu theo hậu THẬT của táp (soi rãnh lọt lòng): không hiện ô mép / chia của hậu phủ (không tác dụng với táp), hiện ô rãnh táp đang dùng;
  // dòng giải thích nói Kiểu hậu chỉ áp cho tủ áo. Trước: Chuẩn xưởng phủ → bảng mời chỉnh "mép hậu" mà táp bỏ qua, ô rãnh thật sự dùng thì ẩn.
  { const co = k => S(page, `.settings [data-k="${k}"]`).count(), giai = await S(page, '.settings p[data-giai]').evaluateAll(ps => ps.map(p => p.textContent).join(' | '));
    ok((await page.evaluate(() => window.MNCF.app.getSpec().hau.kieu)) === 'phu' && !(await co('hau.mep')) && !(await co('hau.chia')) && (await co('hau.lui')) && (await co('hau.ranh_sau')) && (await co('hau.ranh_ho')), 'táp (Chuẩn xưởng hậu phủ): ô Hậu theo hậu soi rãnh của táp', [await co('hau.mep'), await co('hau.lui')]);
    ok(/Táp: hậu luôn mỏng soi rãnh lọt lòng/.test(giai) && !/Hậu ốp lên mép sau/.test(giai), 'dòng giải thích Hậu nói đúng cho táp', giai); }
  await S(page, '.tab[data-tab="tu"]').click();
  await chon('G16-NK'); await chon('');
  ok((await page.evaluate(() => { const s = window.MNCF.app.getSpec(); return !('loai_sp' in s) && !s.giuong && s.khoang.length === 3 && !window.MNCF.app.getModel().errors.length; })) && (await S(page, '.panel').getAttribute('data-loai')) === 'tu' && await S(page, '.bays').isVisible(), 'giường → tủ mặc định: tủ 3 khoang, không mang thông số giường');
  ok(JSON.stringify(await nhan()) === JSON.stringify(['Rộng phủ bì', 'Cao phủ bì', 'Sâu thùng']), 'tủ: ô kích thước trở lại', await nhan());
  await S(page, '[data-act="lui"]').click();
  await page.waitForFunction(() => window.MNCF.app.getSpec().loai_sp === 'giuong');
  ok((await S(page, '.panel').getAttribute('data-loai')) === 'giuong', '↶ Lùi: trở lại giường ngăn kéo');
  // (1.36.4) thẻ Thư viện: thẻ sáng theo món đang mở; nhóm Táp bấm là dùng; giường / vách / bếp có hình 3D nhỏ, bộ bếp có hình mặt bằng
  { const sang = () => S(page, '[data-act="tv-the"][aria-pressed="true"]').evaluateAll(xs => xs.map(x => x.dataset.ma));
    await chonMau(page, 'G16-NK'); ok(JSON.stringify(await sang()) === '["G16-NK"]', 'giường 1m6 ngăn kéo: thẻ G16-NK sáng', await sang());
    ok((await S(page, '[data-act="tv-the"]').evaluateAll(xs => xs.every(x => x.querySelector('svg')))) && (await S(page, '[data-act="tv-nhom"][data-nhom="giuong"]').getAttribute('aria-expanded')) === 'true', 'nhóm Giường: mỗi thẻ một hình');
    // (soát 1.36.4) giường / vách: thẻ sáng theo tên MẪU + cỡ — gõ Rộng khác thì thẻ thôi sáng (như tủ áo), không báo sai cỡ
    await chonMau(page, 'V2600-1200'); await page.waitForFunction(() => window.MNCF.app.getSpec().loai_sp === 'vach');
    ok(JSON.stringify(await sang()) === '["V2600-1200"]', 'vách 2600 × 1200: thẻ sáng', await sang());
    await S(page, '[data-k="rong"]').fill('3400'); await S(page, '[data-k="rong"]').press('Enter'); await page.waitForFunction(() => window.MNCF.app.getSpec().rong === 3400);
    ok(JSON.stringify(await sang()) === '[]', 'vách gõ Rộng 3400: thẻ V2600-1200 thôi sáng', await sang());
    await chonMau(page, '@BO-I'); await page.waitForFunction(() => window.MNCF.app.getBo && window.MNCF.app.getBo());
    ok(JSON.stringify(await sang()) === '["@BO-I"]' && (await S(page, '[data-act="tv-the"]').evaluateAll(xs => xs.every(x => x.querySelector('svg')))), 'nhóm Bếp: bộ chữ I sáng, mọi thẻ có hình', await sang());
    // (soát 1.36.4) bấm lại thẻ bộ đang dùng: không làm gì — trước đây vaoBo bỏ chỗ đặt + phương án đang xem lặng lẽ
    { await page.evaluate(() => window.MNCF.app.setBoCho({ goc: [1000, 2000, 0], xoay: 0 }));
      const nut = S(page, '[data-act="bo-pa"][data-v="1"]'); if (await nut.isEnabled()) await nut.click();
      const tt0 = await S(page, '[data-ui="bo-tt"]').textContent();
      await S(page, '[data-act="tv-the"][data-ma="@BO-I"]').click();
      const cho = await page.evaluate(() => window.MNCF.app.getBoCho()), tt1 = await S(page, '[data-ui="bo-tt"]').textContent();
      ok(cho && cho.goc[0] === 1000 && tt1 === tt0, 'bấm lại thẻ @BO-I đang sáng: giữ chỗ đặt + phương án đang xem', [cho, tt0, tt1]); }
    await S(page, '[data-act="tv-nhom"][data-nhom="tap"]').click();
    await page.waitForFunction(() => window.MNCF.app.getSpec().loai_sp === 'tap');
    ok(await S(page, '[data-ui="tv-luoi"]').isHidden() && /Đã dùng "Táp đầu giường"/.test(await page.evaluate(inPage.status)) && (await S(page, '.tapthe[data-act="tap-kieu"]').count()) === 5, 'bấm nhóm Táp: dùng luôn táp (lưới gập), khối Kiểu táp có 5 thẻ hình', await page.evaluate(inPage.status));
    ok(await S(page, '[data-act="tv-nhom"][data-nhom="tap"]').evaluate(b => b.classList.contains('on') && b.getAttribute('aria-pressed') === 'true'), 'đang làm táp: nhóm Táp sáng, aria-pressed (trình đọc màn hình biết táp đang làm)');
    // (soát 1.36.4) bấm lại chip Táp đang sáng: không dựng lại táp mặc định (mất kiểu + cỡ đang làm)
    { await S(page, '.tapthe[data-act="tap-kieu"][data-kieu="D"]').click(); await page.waitForFunction(() => window.MNCF.app.getSpec().tap.kieu === 'D');
      await S(page, '[data-k="rong"]').fill('520'); await S(page, '[data-k="rong"]').press('Enter'); await page.waitForFunction(() => window.MNCF.app.getSpec().rong === 520);
      await S(page, '[data-act="tv-nhom"][data-nhom="tap"]').click();
      const sp = await page.evaluate(() => { const s = window.MNCF.app.getSpec(); return [s.tap.kieu, s.rong]; });
      ok(JSON.stringify(sp) === '["D",520]', 'bấm lại chip Táp đang sáng: giữ táp kiểu D rộng 520', sp);
      await S(page, '[data-act="lui"]').click(); await page.waitForFunction(() => window.MNCF.app.getSpec().rong !== 520);
      await S(page, '[data-act="lui"]').click(); await page.waitForFunction(() => window.MNCF.app.getSpec().tap.kieu === 'A'); }
    await S(page, '[data-act="lui"]').click(); await page.waitForFunction(() => window.MNCF.app.getBo && window.MNCF.app.getBo());
    ok((await S(page, '.panel').getAttribute('data-loai')) === 'bo-bep', '↶ Lùi sau nhóm Táp: trở lại bộ bếp');
    await chonMau(page, 'TA2-1000');
    // (1.36.4 — anh Thanh: "thêm khoang thì khoang trống thôi nhiều đợt quá khó xử lý") + Thêm khoang = khoang trống; sửa đợt thì thẻ thôi sáng (món không còn là mẫu)
    await S(page, '[data-act="add"]').click();
    { const sp = await page.evaluate(inPage.spec), k = sp.khoang[sp.khoang.length - 1]; ok(sp.khoang.length === 2 && !k.dot.length && !k.o.length, '+ Thêm khoang: khoang trống (không đợt, không suốt)', k); }
    ok(await S(page, '[data-ui="tv-luoi"]').isVisible(), 'lưới nhóm Tủ áo vẫn mở');
    ok(JSON.stringify(await sang()) === '[]', 'đã thêm khoang: không thẻ nào sáng (món khác mẫu)', await sang());
    // màn hẹp: lưới thẻ tự xuống dòng, không tràn ngang
    await page.setViewportSize({ width: 360, height: 800 }); await page.waitForTimeout(150);
    const bb = await S(page, '[data-ui="tv-luoi"]').boundingBox(), the = await S(page, '[data-act="tv-the"]').evaluateAll(xs => xs.map(x => { const r = x.getBoundingClientRect(); return [r.left, r.right]; }));
    ok((await page.evaluate(inPage.overflow)) <= 0 && bb && the.every(([l, r]) => l >= bb.x - 1 && r <= bb.x + bb.width + 1) && new Set(the.map(t => Math.round(t[0]))).size < the.length, 'màn 360: lưới thẻ nằm gọn, nhiều hàng, không tràn ngang', [bb, the.length, await page.evaluate(inPage.overflow)]);
    await page.setViewportSize({ width: 1280, height: 900 }); }
  ok(errs.length === 0, 'không lỗi JS', errs);
  await ctx.close();
}

// (bản 1.33) TỦ BẾP: ba nhóm thư viện, ô "Tủ bếp" theo chức năng, nút "Chuyển tủ 900 / 1000", chuẩn bếp nhớ qua localStorage mncf.bep.v1
async function testBep(browser) {
  console.log('— Tủ bếp (bản 1.33): thư viện, ô Tủ bếp, nút Chuyển tủ, chuẩn bếp nhớ');
  const { ctx, page, errs } = await open(browser, path.join(DIST, 'mn-chenfeng.html'));
  const window_ver = await page.evaluate(() => window.MNCFCore.VERSION);      // (1.33.1) chuẩn bếp lưu ở máy ghi kèm phiên bản (Core.nangChuanBep)
  const H = page.locator('#mncf-host');
  const nhom = await tvNhom(page);
  // (1.34.1 — thư viện bếp gọn) ô Thư viện: MỘT nhóm Bếp, 3 tủ + 2 bộ; không còn mẫu bếp theo cỡ
  ok(nhom.some(([l, v]) => l === 'Bếp' && JSON.stringify(v) === JSON.stringify(['@BEP-duoi', '@BEP-tren', '@BEP-cao', '@BO-I', '@BO-L'])) && !nhom.some(([, v]) => v.some(x => /^B[DTC]-/.test(x))), 'ô Thư viện: nhóm Bếp = Tủ bếp dưới / trên / cao + Bộ bếp chữ I / L, không mẫu theo cỡ', nhom);
  const chon = async ma => { if (ma) return chonBep(page, ma); await chonMau(page, ''); await page.waitForFunction(() => !window.MNCF.app.getSpec().loai_sp); };
  const chip = () => S(page, '[data-act="bep-kieu"]').evaluateAll(bs => bs.map(b => [b.dataset.v, b.getAttribute('aria-pressed')]));
  const spec = () => page.evaluate(() => window.MNCF.app.getSpec());
  // chip chức năng: tầng dưới 10 chip, mục Thư viện ra tủ cánh 600 (chip Cánh bấm sẵn)
  { await chonMau(page, '@BEP-duoi');
    await page.waitForFunction(() => window.MNCF.app.getSpec().loai_sp === 'bep');
    const c = await chip(), s0 = await spec();
    ok(c.length === 10 && JSON.stringify(c.filter(x => x[1] === 'true').map(x => x[0])) === '["canh"]' && s0.rong === 600 && (await S(page, '[data-bep="chuc_nang"]').count()) === 0, 'Tủ bếp dưới: 10 chip chức năng, Cánh đang bấm, tủ 600, không còn ô chọn Chức năng', [c, s0.rong]);
    // gõ Rộng 550 → chip Ngăn kéo: giữ 550
    await S(page, '[data-k="rong"]').fill('550'); await page.waitForFunction(() => window.MNCF.app.getSpec().rong === 550);
    await S(page, '[data-act="bep-kieu"][data-v="nk"]').click();
    await page.waitForFunction(() => window.MNCF.app.getSpec().bep.chuc_nang === 'nk');
    { const s = await spec(); ok(s.rong === 550 && s.ten === 'Tủ 3 ngăn kéo 550' && s.khoang[0].o.some(o => o.kieu === 'nk_trum') && JSON.stringify((await chip()).filter(x => x[1] === 'true').map(x => x[0])) === '["nk"]' && !(await page.evaluate(() => window.MNCF.app.getModel().errors.length)), 'gõ Rộng 550 rồi bấm Ngăn kéo: tủ 3 ngăn kéo 550 (giữ rộng), chip Ngăn kéo bấm', [s.rong, s.ten]); }
    // chip Gia vị ở 550: rổ lệch cỡ hãng → dòng báo + nút Chuyển tủ 450
    await S(page, '[data-act="bep-kieu"][data-v="gv"]').click();
    await page.waitForFunction(() => window.MNCF.app.getSpec().bep.chuc_nang === 'gv');
    ok((await spec()).rong === 550 && await S(page, '[data-act="bep-co"]').isVisible() && /Chuyển tủ 450/.test(await S(page, '[data-act="bep-co"]').innerText()), 'Gia vị 550: rổ lệch cỡ → nút "Chuyển tủ 450"', await S(page, '.msgs').innerText());
    await S(page, '[data-act="bep-co"]').click(); await page.waitForFunction(() => window.MNCF.app.getSpec().rong === 450);
    ok(!(await page.evaluate(() => window.MNCF.app.getModel().errors.length)) && !(await S(page, '[data-act="bep-co"]').isVisible()), 'bấm Chuyển tủ 450: hết lỗi');
    await S(page, '[data-act="lui"]').click(); await page.waitForFunction(() => window.MNCF.app.getSpec().rong === 550);
    await S(page, '[data-act="lui"]').click(); await page.waitForFunction(() => window.MNCF.app.getSpec().bep.chuc_nang === 'nk');
    ok((await spec()).rong === 550 && JSON.stringify((await chip()).filter(x => x[1] === 'true').map(x => x[0])) === '["nk"]', '↶ Lùi hai bước: về ngăn kéo 550, chip theo kịp');
    // tủ góc: rộng theo phụ kiện góc; ô Phụ kiện góc / Phía mù
    await S(page, '[data-act="bep-kieu"][data-v="goc"]').click();
    await page.waitForFunction(() => window.MNCF.app.getSpec().bep.chuc_nang === 'goc');
    ok((await spec()).rong === 900 && await S(page, '[data-bep="goc_pk"]').isVisible() && await S(page, '[data-bep="goc_ben"]').isVisible(), 'chip Góc mù: tủ 900 (Higold liên hoàn), có ô Phụ kiện góc + Phía mù');
    await S(page, '[data-bep="goc_pk"]').selectOption('eu_lh'); await page.waitForFunction(() => window.MNCF.app.getSpec().rong === 990);
    await S(page, '[data-bep="goc_ben"]').selectOption('phai'); await page.waitForFunction(() => window.MNCF.app.getSpec().khoang[0].mu.ben === 'phai');
    { const r = await page.evaluate(() => { const s = window.MNCF.app.getSpec(); const k = x => JSON.stringify(x, (a, v) => (a === 'tu' ? undefined : v));      // bảng dời mốc ô sát đáy về mặt dưới đáy (quy ước sẵn có)
        return [k(s.khoang), k(window.MNCFCore.apMau(s, 'BD-GOC-990-P').khoang), s.bep.goc_pk]; });
      ok(r[0] === r[1] && r[2] === 'eu_lh', 'Eurogold liên hoàn + mù phải: đúng tủ góc 990 mù phải', r); }
    // tầng cao: khoang tủ lạnh theo máy
    await chonMau(page, '@BEP-cao');
    await page.waitForFunction(() => window.MNCF.app.getSpec().bep.tang === 'cao');
    ok(JSON.stringify((await chip()).map(x => x[0])) === '["kho","kho_canh","tl","lo"]' && (await chip()).find(x => x[0] === 'kho_canh')[1] === 'true', 'Tủ bếp cao: chip Khô kéo / Khô cánh / Tủ lạnh / Lò, mặc định đồ khô cánh', await chip());
    await S(page, '[data-act="bep-kieu"][data-v="tl"]').click();
    await page.waitForFunction(() => window.MNCF.app.getSpec().bep.chuc_nang === 'tl');
    await S(page, '[data-bep="tb.tl.ma"]').selectOption('sbs_910');
    await page.waitForFunction(() => window.MNCF.app.getSpec().bep.tb.tl.ma === 'sbs_910');
    ok(await page.evaluate(() => window.MNCF.app.getSpec().rong === window.MNCFCore.apMau(window.MNCFCore.DEFAULT_SPEC, 'BC-TL-910').rong), 'chọn máy side-by-side 910: khoang rộng theo máy');
  }
  const hienCa = sel => page.evaluate(q => [...document.getElementById('mncf-host').shadowRoot.querySelectorAll(q)].map(e => e.getClientRects().length > 0), sel);
  const loai = () => S(page, '.panel').getAttribute('data-loai');
  // tủ dưới: không phào / khấu cột / chia thân / khoang của tủ áo — ruột theo chức năng; hình mặc định 3D (có đá)
  await chon('BD-NK3-600');
  ok((await loai()) === 'bep-duoi' && (await hienCa('.chi-tu')).every(v => !v), 'tủ bếp dưới: data-loai "bep-duoi", mọi phần riêng của tủ áo (.chi-tu) ẩn', await hienCa('.chi-tu'));
  ok(await S(page, '.sp').isVisible() && /Tủ bếp/.test(await S(page, '.sp legend').textContent()) && (await page.evaluate(() => window.MNCF.app.getModel().errors.length)) === 0, 'ô "Tủ bếp" hiện, tủ không lỗi');
  ok((await S(page, '[data-bep="cao_mat"]').inputValue()) === '860' && await S(page, '[data-bep="chan"]').isVisible() && await S(page, '[data-bep="len_lui"]').isVisible() && (await S(page, '[data-bep="cach_tren"]').count()) === 0, 'tủ dưới: ô mặt đá 860 (1.33.1 anh chốt), chân, lùi xà chân; không có ô "cách mặt đá" của tủ trên');
  // (1.33.1) ô tay nắm (vát / ấn mở / nổi / gola / J — mặc định vát) + nóc tủ dưới (giằng mặc định / liền)
  { const tn = await S(page, '[data-bep="tay_nam"] option').evaluateAll(os => os.map(o => o.value));
    ok(JSON.stringify(tn) === JSON.stringify(['vat', 'an_mo', 'noi', 'gola', 'j']) && (await S(page, '[data-bep="tay_nam"]').inputValue()) === 'vat', 'ô tay nắm: vát / ấn mở / nổi / gola / J, mặc định vát', tn);
    ok(await S(page, '[data-bep="noc"]').isVisible() && (await S(page, '[data-bep="noc"]').inputValue()) === 'giang' && (await page.evaluate(() => window.MNCF.app.getSpec().bep.noc)) === 'giang', 'tủ 3 ngăn kéo: ô nóc hiện, mặc định 2 thanh giằng');
    await S(page, '[data-bep="noc"]').selectOption('lien');
    await page.waitForFunction(() => window.MNCF.app.getSpec().bep.noc === 'lien');
    ok((await page.evaluate(() => !window.MNCF.app.getModel().errors.length)), 'chọn nóc liền: tủ dựng lại, không lỗi');
    await S(page, '[data-act="lui"]').click();
    await page.waitForFunction(() => window.MNCF.app.getSpec().bep.noc === 'giang');
    ok((await S(page, '[data-bep="noc"]').inputValue()) === 'giang', '↶ Lùi: về 2 thanh giằng (ô theo kịp)');
    await S(page, '[data-bep="tay_nam"]').selectOption('an_mo');
    await page.waitForFunction(() => window.MNCF.app.getSpec().bep.tay_nam === 'an_mo');
    await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('mncf.bep.v1')).tay_nam === 'an_mo'; } catch (e) { return false; } }, null, { timeout: 3000 }).catch(() => {});
    const luu = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('mncf.bep.v1')); } catch (e) { return null; } });
    ok(luu && luu.tay_nam === 'an_mo' && luu.ban === window_ver, 'chọn ấn mở: nhớ vào mncf.bep.v1 kèm phiên bản', luu);
    ok(/nhấn mở/i.test(await page.evaluate(() => (window.MNCF.app.getModel().phu_kien || []).map(q => q.ten).join(' | '))), 'ấn mở: phụ kiện có bộ nhấn mở', await page.evaluate(() => (window.MNCF.app.getModel().phu_kien || []).map(q => q.ten)));
    await S(page, '[data-bep="tay_nam"]').selectOption('vat');
    await page.waitForFunction(() => window.MNCF.app.getSpec().bep.tay_nam === 'vat');
  }
  ok((await S(page, '[data-bep^="tb."]').count()) === 0 && await S(page, '[data-bep-nk="so"]').isVisible() && (await S(page, '[data-bep-nk="cao"]').inputValue()) === '180', 'tủ 3 ngăn kéo: ô số ngăn + cao ngăn trên (180), không ô thiết bị');
  ok((await S(page, '[data-act="xem-3d"]').getAttribute('aria-pressed')) === 'true', 'tủ dưới: hình mặc định 3D');
  // (1.33 vòng soát 2) sửa Cao (ô chung) → ô "Cao mặt đá" theo kịp; ô ngăn kéo hiện lại số đang dùng; cao ngăn < 100 không ghi vào chuẩn bếp
  { const giaTri = q => S(page, q).inputValue();
    await S(page, '[data-act="tv-nhom"][data-nhom="tu"]').focus();
    await S(page, '[data-k="cao"]').fill('860');
    await page.waitForFunction(() => window.MNCF.app.getSpec().bep.cao_mat === 880);
    await page.waitForFunction(() => document.getElementById('mncf-host').shadowRoot.querySelector('[data-bep="cao_mat"]').value === '880', null, { timeout: 3000 }).catch(() => {});
    ok((await giaTri('[data-bep="cao_mat"]')) === '880', 'gõ Cao 860 ở ô chung: ô "Cao mặt đá" hiện 880 (= thông số), không đứng ở 850', await giaTri('[data-bep="cao_mat"]'));
    await S(page, '[data-k="cao"]').fill('830');
    await page.waitForFunction(() => window.MNCF.app.getSpec().bep.cao_mat === 850);
    const nong0 = await page.evaluate(() => window.MNCF.app.getSpec().bep.nk_nong);
    await S(page, '[data-bep-nk="cao"]').fill('50'); await S(page, '[data-bep-nk="cao"]').press('Tab');
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => { const s = window.MNCF.app.getSpec(), c = s.khoang[0].o.find(x => x.kieu === 'nk_trum'); let l = null; try { l = JSON.parse(localStorage.getItem('mncf.bep.v1')).nk_nong; } catch (e) { l = null; } return { cao: c.cao || null, nong: s.bep.nk_nong, luu: l }; });
    ok((await giaTri('[data-bep-nk="cao"]')) === '' && !r.cao && r.nong === nong0 && r.luu !== 100, 'gõ ngăn trên 50 rồi rời ô: ô hiện trống (chia đều — số 50 không dùng), chuẩn nk_nong không bị kẹp thành 100', [await giaTri('[data-bep-nk="cao"]'), r, nong0]);
    await S(page, '[data-bep-nk="so"]').fill('9'); await S(page, '[data-bep-nk="so"]').press('Tab');
    await page.waitForTimeout(300);
    ok((await giaTri('[data-bep-nk="so"]')) === '6' && (await page.evaluate(() => window.MNCF.app.getSpec().khoang[0].o.find(x => x.kieu === 'nk_trum').so)) === 6, 'gõ 9 ngăn: ô hiện 6 (số đang dùng)', await giaTri('[data-bep-nk="so"]'));
    await S(page, '[data-bep-nk="so"]').fill('3'); await S(page, '[data-bep-nk="cao"]').fill('180'); await S(page, '[data-bep-nk="cao"]').press('Tab');
    await page.waitForFunction(() => { const c = window.MNCF.app.getSpec().khoang[0].o.find(x => x.kieu === 'nk_trum'); return c.so === 3 && (c.cao || [])[0] === 180; });
  }
  // tủ trên: giữ ô khoang (đợt, cánh), không phào / khấu cột
  await chon('BD-CHAU-800');
  ok((await S(page, '[data-bep="noc"]').count()) === 0 && (await page.evaluate(() => window.MNCF.app.getSpec().bep.noc)) === 'giang', 'tủ chậu: không ô nóc (luôn giằng)');
  ok(/^am_/.test(await page.evaluate(() => window.MNCF.app.getSpec().bep.tb.chau.ma)) && (await page.evaluate(() => !window.MNCF.app.getModel().errors.length)), 'tủ chậu 800: chậu âm là chính, không lỗi', await page.evaluate(() => window.MNCF.app.getSpec().bep.tb.chau));
  await chon('BT-HMK-900');
  ok((await page.evaluate(() => { const s = window.MNCF.app.getSpec(); return s.bep.tb.hm && s.bep.tb.hm.kieu === 'kinh' && !window.MNCF.app.getModel().errors.length; })) && await S(page, '[data-bep="tb.hm.ma"]').isVisible(), 'mẫu tủ che ống hút mùi kính 900: có trong thư viện, ô máy hút mùi, không lỗi');
  await chon('BT-BAT-800');
  ok((await page.evaluate(() => window.MNCF.app.getSpec().bep.pk)) === 'bat_tren_nh', 'tủ giá bát tủ trên: mặc định giá nâng hạ');
  await chon('BT-CANH-800');
  ok((await S(page, '[data-bep="noc"]').count()) === 0 && await S(page, '[data-bep="tay_nam"]').isVisible(), 'tủ trên: không ô nóc, có ô tay nắm');
  ok((await loai()) === 'bep' && await S(page, '.bays').isVisible() && !(await S(page, 'fieldset.khung-tu').first().isVisible()), 'tủ bếp trên: ô khoang hiện; phào / khấu cột ẩn', await loai());
  ok(await S(page, '[data-bep="cach_tren"]').isVisible() && (await S(page, '[data-bep="cao_mat"]').count()) === 1 && (await S(page, '[data-bep="chan"]').count()) === 0, 'tủ trên: có ô cách mặt đá, không có ô chân');
  // ô mặt kéo rổ (keo_pk) của tủ cao kho: dòng nội dung ô ghi "mặt kéo rổ" + tên rổ, không "undefined" / loại ray ngăn kéo
  ok((await S(page, '.view [data-phao]').count()) === 0, 'tủ bếp trên: hình không bày vùng "+ phào" để bấm (tủ bếp không có phào)', await S(page, '.view [data-phao]').count());
  await chon('BC-KHO-400');
  { const noi = (await S(page, '.bay .noi').allInnerTexts()).join('\n');
    ok(/mặt kéo rổ/.test(noi) && !/undefined/.test(noi) && !/Ray bi/.test(noi), 'tủ cao đồ khô kéo 400: ô rổ ghi "mặt kéo rổ", không "undefined", không loại ray ngăn kéo', noi); }
  // (1.33 vòng soát 2) rổ đồ khô 450 / 600 là rổ CÁNH MỞ (khung bắt hồi, cánh bản lề) — không ghi "mặt kéo"
  await chon('BC-KHO-600');
  { const noi = (await S(page, '.bay .noi').allInnerTexts()).join('\n');
    ok(/rổ cánh mở/.test(noi) && !/mặt kéo rổ/.test(noi) && !/undefined/.test(noi), 'tủ cao đồ khô cánh mở 600: ô rổ ghi "rổ cánh mở"', noi); }
  ok((await S(page, '.view [data-phao]').count()) === 0, 'tủ bếp cao: không vùng "+ phào"');
  // tủ chậu: ô thiết bị theo chức năng; chậu không lọt → nút "Chuyển tủ 900" sửa bằng một bước ↶ Lùi
  await chon('BD-CHAU-800');
  ok(await S(page, '[data-bep="tb.chau.ma"]').isVisible() && (await S(page, '[data-bep="tb.hm.ma"]').count()) === 0 && (await S(page, '[data-bep="tb.bep.ma"]').count()) === 0, 'tủ chậu: ô model chậu, không ô bếp nấu / hút mùi');
  await S(page, '[data-bep="tb.chau.ma"]').selectOption('duong_820');
  await page.waitForFunction(() => window.MNCF.app.getModel().errors.some(t => /Chậu/.test(t)));
  ok(await S(page, '[data-act="bep-co"]').isVisible() && /Chuyển tủ 900/.test(await S(page, '[data-act="bep-co"]').innerText()), 'chậu 820 trong tủ 800: dòng lỗi + nút "Chuyển tủ 900"', await S(page, '.msgs').innerText());
  await S(page, '[data-act="bep-co"]').click();
  await page.waitForFunction(() => window.MNCF.app.getSpec().rong === 900);
  ok((await page.evaluate(() => { const s = window.MNCF.app.getSpec(); return s.bep.tb.chau.ma === 'duong_820' && !window.MNCF.app.getModel().errors.length; })) && !(await S(page, '[data-act="bep-co"]').isVisible()), 'bấm: tủ 900, giữ chậu 820, hết lỗi');
  await S(page, '[data-act="lui"]').click();
  await page.waitForFunction(() => window.MNCF.app.getSpec().rong === 800);
  ok((await page.evaluate(() => window.MNCF.app.getSpec().bep.tb.chau.ma)) === 'duong_820' && await S(page, '[data-act="bep-co"]').isVisible(), '↶ Lùi một bước: về tủ 800 (chậu 820, lỗi lại hiện)');
  // gõ "tự gõ số": hiện ô phủ bì / khoét
  await S(page, '[data-bep="tb.chau.ma"]').selectOption('tu_chon');
  ok(await S(page, '[data-bep="tb.chau.khoet.0"]').isVisible() && await S(page, '[data-bep="tb.chau.lap"]').isVisible(), 'chậu "tự gõ số": hiện ô khoét / kiểu lắp');
  // chuẩn bếp: gõ mặt đá 870 → cao tủ 850; đổi sang tủ áo rồi quay lại tủ bếp vẫn 870 (nhớ ở mncf.bep.v1)
  await chon('BD-NK3-600');
  await S(page, '[data-bep="cao_mat"]').fill('870');
  await page.waitForFunction(() => window.MNCF.app.getSpec().cao === 850);
  await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('mncf.bep.v1')).cao_mat === 870; } catch (e) { return false; } }, null, { timeout: 3000 }).catch(() => {});
  ok((await page.evaluate(() => { const s = window.MNCF.app.getSpec(); return s.bep.cao_mat === 870 && JSON.parse(localStorage.getItem('mncf.bep.v1')).cao_mat === 870; })), 'gõ mặt đá 870: cao tủ dưới 850, chuẩn bếp ghi vào mncf.bep.v1');
  await chon('');
  ok((await loai()) === 'tu' && (await page.evaluate(() => { const s = window.MNCF.app.getSpec(); return !s.bep && s.khoang.length === 3; })) && (await hienCa('.chi-tu')).some(v => v) && (await S(page, '[data-act="xem-3d"]').getAttribute('aria-pressed')) === 'false', 'về tủ áo mặc định: không mang thông số bếp, phần của tủ áo hiện lại, hình đứng');
  await S(page, '[data-act="lui"]').click();
  await page.waitForFunction(() => window.MNCF.app.getSpec().loai_sp === 'bep');
  ok((await loai()) === 'bep-duoi' && (await hienCa('.chi-tu')).every(v => !v) && (await page.evaluate(() => window.MNCF.app.getSpec().bep.cao_mat)) === 870, '↶ Lùi qua lần đổi tủ bếp → tủ áo: trở lại tủ bếp dưới (mặt đá 870), ô của tủ áo ẩn lại');
  await chon('');
  await chon('BD-CANH-600');
  ok((await page.evaluate(() => { const s = window.MNCF.app.getSpec(); return [s.bep.cao_mat, s.cao]; })).join() === '870,850', 'quay lại tủ bếp: chuẩn mặt đá 870 vẫn còn', await page.evaluate(() => window.MNCF.app.getSpec().bep.cao_mat));
  await S(page, '[data-act="lui"]').click();
  await page.waitForFunction(() => !window.MNCF.app.getSpec().loai_sp);
  ok((await loai()) === 'tu' && (await hienCa('.chi-tu')).some(v => v), '↶ Lùi qua lần đổi tủ áo → tủ bếp: trở lại tủ áo');
  // (soát 1.34.1) gõ Rộng tủ bếp: số cánh theo luật của chức năng như chip (trước: giữ số cánh của tủ 600 → 2 cánh 148 ở tủ 300)
  { await chonMau(page, '@BEP-tren');
    await page.waitForFunction(() => window.MNCF.app.getSpec().loai_sp === 'bep' && window.MNCF.app.getSpec().bep.tang === 'tren' && window.MNCF.app.getSpec().rong === 600);
    ok((await spec()).khoang[0].canh === 2, 'Tủ bếp trên 600: 2 cánh');
    await S(page, '[data-k="rong"]').fill('300'); await page.waitForFunction(() => window.MNCF.app.getSpec().rong === 300);
    await page.waitForFunction(() => window.MNCF.app.getSpec().khoang[0].canh === 1, null, { timeout: 3000 }).catch(() => {});
    ok(await page.evaluate(() => { const s = window.MNCF.app.getSpec(), M = window.MNCF.app.getModel(); return s.khoang[0].canh === 1 && !M.warnings.some(t => /Cánh chỉ rộng/.test(t)); }), 'gõ Rộng 300: 1 cánh (như chip), không cảnh báo cánh hẹp', await page.evaluate(() => [window.MNCF.app.getSpec().khoang[0].canh, window.MNCF.app.getModel().warnings]));
    await S(page, '[data-k="rong"]').fill('800'); await page.waitForFunction(() => window.MNCF.app.getSpec().rong === 800);
    await page.waitForFunction(() => window.MNCF.app.getSpec().khoang[0].canh === 2, null, { timeout: 3000 }).catch(() => {});
    ok((await spec()).khoang[0].canh === 2, 'gõ lại Rộng 800: 2 cánh');
    ok(/800$/.test((await spec()).ten || ''), 'tên tủ mang cỡ mới (không còn "… 600" khi tủ rộng 800)', (await spec()).ten); }
  // (soát 1.34.1) tủ bếp nấu hẹp: nút Chuyển tủ đi thẳng tới cỡ lọt bếp (800), không dừng ở 600 vì lỗi rổ
  { await chonMau(page, '@BEP-duoi');
    await page.waitForFunction(() => window.MNCF.app.getSpec().bep && window.MNCF.app.getSpec().bep.tang === 'duoi' && window.MNCF.app.getSpec().bep.chuc_nang === 'canh');
    await S(page, '[data-k="rong"]').fill('450'); await page.waitForFunction(() => window.MNCF.app.getSpec().rong === 450);
    await S(page, '[data-act="bep-kieu"][data-v="bep"]').click(); await page.waitForFunction(() => window.MNCF.app.getSpec().bep.chuc_nang === 'bep');
    // (1.35) thư viện có tủ bếp nấu 700 (chậu = bếp cùng cỡ 700 / 800 / 900): bếp nấu 450 lấy bếp của mẫu nhỏ nhất (700, bếp đôi 650) → cỡ lọt bếp là 700
    ok(await S(page, '[data-act="bep-co"]').isVisible() && /Chuyển tủ 700/.test(await S(page, '[data-act="bep-co"]').innerText()), 'bếp nấu 450: nút "Chuyển tủ 700" (cỡ lọt bếp — 1.35), không 600', await S(page, '[data-act="bep-co"]').innerText());
    await S(page, '[data-act="bep-co"]').click(); await page.waitForFunction(() => window.MNCF.app.getSpec().rong === 700);
    ok(!(await page.evaluate(() => window.MNCF.app.getModel().errors.length)), 'bấm một lần: tủ 700, hết lỗi', await page.evaluate(() => window.MNCF.app.getModel().errors)); }
  ok(errs.length === 0, 'không lỗi JS', errs);
  await ctx.close();
  // trình duyệt chặn localStorage (ném lỗi mọi lần đọc / ghi): bảng vẫn dựng tủ bếp, gõ chuẩn bếp vẫn chạy, không lỗi JS
  {
    const c2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await c2.addInitScript(() => { const nem = () => { throw new Error('chặn'); }; Storage.prototype.getItem = nem; Storage.prototype.setItem = nem; Storage.prototype.removeItem = nem; });
    const p2 = await c2.newPage(), e2 = [];
    p2.on('pageerror', e => e2.push(String(e)));
    await p2.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await p2.goto('file://' + path.join(DIST, 'mn-chenfeng.html'));
    await p2.waitForFunction(() => window.MNCF && window.MNCF.app && window.MNCF.app.getModel());
    await chonBep(p2, 'BD-NK3-600');
    await S(p2, '[data-bep="cao_mat"]').fill('870');
    await p2.waitForFunction(() => window.MNCF.app.getSpec().cao === 850);
    ok(e2.length === 0 && (await p2.evaluate(() => !window.MNCF.app.getModel().errors.length)), 'localStorage bị chặn: tủ bếp vẫn dựng, gõ mặt đá 870 vẫn chạy, không lỗi JS', e2);
    await c2.close();
  }
  // (1.33.1) chuẩn bếp lưu ở máy TRƯỚC 1.33.1: số đúng bằng mặc định cũ (mặt đá 850, tay nắm nổi) = chưa chọn → nhận mặc định mới; số tự đổi (870) thì giữ
  for (const [luu, can, ten] of [[{ cao_mat: 850, tay_nam: 'noi', chan: 120 }, { cao_mat: 860, tay_nam: 'vat', chan: 120 }, 'bản lưu cũ 850 + nổi, không phiên bản → nhận 860 + vát, giữ chân 120'],
    [{ cao_mat: 870, tay_nam: 'j' }, { cao_mat: 870, tay_nam: 'j' }, 'bản lưu cũ 870 + J (tự đổi) → giữ 870 + J'],
    [{ cao_mat: 850, tay_nam: 'noi', ban: '1.33.1' }, { cao_mat: 850, tay_nam: 'noi' }, 'bản lưu 1.33.1 chọn 850 + nổi → giữ (người dùng đã chọn)']]) {
    const c3 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await c3.addInitScript(v => { try { if (!sessionStorage.getItem('da_nap')) { localStorage.setItem('mncf.bep.v1', v); sessionStorage.setItem('da_nap', '1'); } } catch (e) { /* bỏ qua */ } }, JSON.stringify(luu));
    const p3 = await c3.newPage(), e3 = [];
    p3.on('pageerror', e => e3.push(String(e)));
    await p3.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await p3.goto('file://' + path.join(DIST, 'mn-chenfeng.html'));
    await p3.waitForFunction(() => window.MNCF && window.MNCF.app && window.MNCF.app.getModel());
    await chonBep(p3, 'BD-NK3-600');
    const r = await p3.evaluate(() => { const s = window.MNCF.app.getSpec(); let l = null; try { l = JSON.parse(localStorage.getItem('mncf.bep.v1')); } catch (e) { l = null; } return { b: { cao_mat: s.bep.cao_mat, tay_nam: s.bep.tay_nam, chan: s.bep.chan }, cao: s.cao, luu: l }; });
    const okB = Object.keys(can).every(k => r.b[k] === can[k]);
    ok(okB && e3.length === 0 && r.cao === r.b.cao_mat - 20 && r.luu && r.luu.ban === window_ver && (r.luu.cao_mat === undefined ? 860 : r.luu.cao_mat) === can.cao_mat, ten + ' (bản lưu ghi lại kèm phiên bản)', [r, e3]);
    await c3.close();
  }
  // (bản vá 1.33.1) máy đang mở sẵn một tủ bếp làm ở 1.33.0 (mặt đá 850, tay nắm nổi — mặc định cũ): tủ đó giữ số; gõ ô Chân KHÔNG chốt 850 / nổi vào chuẩn
  // đã lưu (kèm ban 1.33.1); đổi sang mẫu bếp khác (vẫn đang ở tủ bếp) ra chuẩn mới 860 / vát và báo một dòng
  const lan = async (kho, fn, khongGhi) => {
    const c4 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await c4.addInitScript(kv => { try { if (!sessionStorage.getItem('da_nap')) { for (const [k, v] of kv) localStorage.setItem(k, v); sessionStorage.setItem('da_nap', '1'); } } catch (e) { /* bỏ qua */ } }, kho);
    // khongGhi = khoá localStorage đọc được mà ghi thì ném QuotaExceededError (bộ nhớ đầy)
    if (khongGhi) await c4.addInitScript(k => { const g = Storage.prototype.setItem; Storage.prototype.setItem = function (a, b) { if (a === k) throw new DOMException('đầy', 'QuotaExceededError'); return g.call(this, a, b); }; }, khongGhi);
    const p4 = await c4.newPage(), e4 = [];
    p4.on('pageerror', e => e4.push(String(e)));
    await p4.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await p4.goto('file://' + path.join(DIST, 'mn-chenfeng.html'));
    await p4.waitForFunction(() => window.MNCF && window.MNCF.app && window.MNCF.app.getModel());
    await fn(p4); ok(e4.length === 0, 'không lỗi JS', e4); await c4.close();
  };
  const C = require('../src/mncf-core.js');
  const s133 = C.datBep(C.apMau(C.normalize({ hau: { t: 6 } }), 'BD-NK3-600'), { cao_mat: 850, tay_nam: 'noi' });
  const docLuu = p => p.evaluate(() => { try { return JSON.parse(localStorage.getItem('mncf.bep.v1')); } catch (e) { return null; } });
  const luu0 = JSON.stringify({ cao_mat: 850, tay_nam: 'noi', chan: 100 }), baoRow = p => p.evaluate(() => { const e = document.getElementById('mncf-host').shadowRoot.querySelector('[data-ui="bao-chuan-bep"]'); return e ? e.textContent : ''; });
  await lan([['mncf.spec.v2', JSON.stringify(s133)], ['mncf.spec.ban', '1.33.0'], ['mncf.bep.v1', luu0]], async p4 => {
    const b0 = await p4.evaluate(() => { const s = window.MNCF.app.getSpec(); return [s.loai_sp, s.cao, s.bep.cao_mat, s.bep.tay_nam]; });
    ok(JSON.stringify(b0) === JSON.stringify(['bep', 830, 850, 'noi']), 'tủ bếp 1.33.0 đang mở: giữ mặt đá 850, tay nắm nổi', b0);
    // (bản vá 1.33.1, soát #1) dựng lại tủ (gõ Rộng ở ô chung) KHÔNG ghi chuẩn của tủ đang mở — bản lưu cũ còn nguyên, không bị đóng dấu phiên bản
    await S(p4, '[data-k="rong"]').fill('700');
    await p4.waitForFunction(() => window.MNCF.app.getSpec().rong === 700); await p4.waitForTimeout(300);
    ok((await p4.evaluate(() => localStorage.getItem('mncf.bep.v1'))) === luu0, 'dựng lại tủ bếp 1.33.0: chuẩn lưu ở máy không bị ghi / đóng dấu ban', await p4.evaluate(() => localStorage.getItem('mncf.bep.v1')));
    await S(p4, '[data-bep="chan"]').fill('120');
    await p4.waitForFunction(() => window.MNCF.app.getSpec().chan.cao === 120);
    const l = await docLuu(p4), ch = await p4.evaluate(o => window.MNCFCore.nangChuanBep(o).chuan, l);
    ok(l && l.chan === 120 && ch.cao_mat !== 850 && ch.tay_nam !== 'noi', 'gõ Chân: chuẩn lưu ở máy KHÔNG chốt 850 / nổi (kèm phiên bản mới)', l);
    ok(l && !('cao_mat' in l) && !('tay_nam' in l) && !('sau_duoi' in l), 'gõ Chân: chỉ ghi khoá vừa đổi (gộp vào chuẩn đã nâng), không chép số của tủ đang mở', l);
    // (soát #4) đường GHI tới trước (gõ ô Chân) cũng nâng bản lưu cũ — và báo, không lặng lẽ
    { await p4.waitForTimeout(400); const t = await baoRow(p4); ok(/Chuẩn bếp mới/.test(t) && /Cao mặt đá 850/.test(t), 'gõ Chân (nâng bản lưu cũ): dòng vàng báo chuẩn bếp mới + cách đặt lại 850', t); }
    const st = await chonBep(p4, 'BD-CANH-600');
    const b1 = await p4.evaluate(() => { const s = window.MNCF.app.getSpec(); return [s.cao, s.bep.cao_mat, s.bep.tay_nam, s.chan.cao]; });
    ok(JSON.stringify(b1) === JSON.stringify([840, 860, 'vat', 120]), 'đang ở tủ bếp cũ → mẫu bếp khác: chuẩn mới 860 / vát, giữ chân 120', b1);
    ok(/Chuẩn bếp mới/.test(st) && /860/.test(st) && /850/.test(st), 'báo chuẩn bếp mới (850 → 860)', st);
  });
  // (bản vá 1.33.1) đi từ tủ áo sang tủ bếp với chuẩn lưu trước 1.33.1 (850): nâng lên 860 phải báo, không lặng lẽ
  await lan([['mncf.bep.v1', JSON.stringify({ cao_mat: 850 })]], async p4 => {
    const st = await chonBep(p4, 'BD-CANH-600'), c = await p4.evaluate(() => window.MNCF.app.getSpec().bep.cao_mat);
    ok(c === 860 && /Chuẩn bếp mới/.test(st) && /850/.test(st), 'tủ áo → tủ bếp, chuẩn lưu cũ 850: ra 860 và có dòng báo', [c, st]);
    const t = await baoRow(p4);
    ok(/Cao mặt đá 850/.test(t) && /Tay nắm: tay nắm nổi/.test(t) && /vát/.test(t), 'dòng vàng dưới hình: chuẩn mới (860, tay nắm vát) + cách đặt lại 850 / tay nắm nổi', t);
    // làm theo: gõ lại 850 ở khối Tủ bếp → dòng vàng thôi, mẫu sau theo 850 (người dùng đã chọn)
    await S(p4, '[data-bep="cao_mat"]').fill('850');
    await p4.waitForFunction(() => window.MNCF.app.getSpec().bep.cao_mat === 850); await p4.waitForTimeout(300);
    { const t2 = await baoRow(p4); ok(!/Cao mặt đá 850/.test(t2) && /Tay nắm: tay nắm nổi/.test(t2), 'đặt lại mặt đá 850: thôi báo mặt đá, còn báo tay nắm (chưa đặt lại)', t2); }
    await S(p4, '[data-bep="tay_nam"]').selectOption('noi');
    await p4.waitForFunction(() => window.MNCF.app.getSpec().bep.tay_nam === 'noi'); await p4.waitForTimeout(300);
    ok(!(await baoRow(p4)), 'đặt lại cả tay nắm nổi: thôi báo');
    const st2 = await chonBep(p4, 'BD-NK3-600');
    ok((await p4.evaluate(() => window.MNCF.app.getSpec().bep.cao_mat)) === 850 && !/Chuẩn bếp mới/.test(st2) && !/Chuẩn bếp mới/.test(await p4.evaluate(inPage.status)), 'mẫu sau theo 850 người dùng đặt, không báo lại');
  });
  // (soát #5) tủ bếp đang mở mang 850 / nổi (không dấu phiên bản nào — vd mở từ tệp / setSpec), máy chưa lưu chuẩn: dựng lại không ghi chuẩn; mẫu bếp chọn sau lấy
  // chuẩn đã lưu (= mặc định mới 860 / vát), KHÔNG số của tủ đang mở
  await lan([], async p4 => {
    const s850 = C.datBep(C.apMau(C.normalize({ hau: { t: 6 } }), 'BD-CANH-600'), { cao_mat: 850, tay_nam: 'noi' });
    await p4.evaluate(x => window.MNCF.app.setSpec(x), s850);
    await p4.waitForTimeout(300);
    ok((await p4.evaluate(() => localStorage.getItem('mncf.bep.v1'))) === null, 'mở tủ bếp 850: không ghi gì vào chuẩn lưu ở máy');
    await chonBep(p4, 'BD-CHAU-800');
    const b = await p4.evaluate(() => { const s = window.MNCF.app.getSpec(); return [s.cao, s.bep.cao_mat, s.bep.tay_nam]; });
    ok(JSON.stringify(b) === JSON.stringify([840, 860, 'vat']), 'đang mở tủ bếp 850 → Tủ chậu 800: ra 860 / vát (chuẩn đã lưu), không 850 của tủ đang mở', b);
  });
  // (soát #8) tủ bếp 1.33.0 khôi phục lúc mở bảng (như bấm Sửa một tủ vẽ ở 1.33.0), máy CHƯA có chuẩn lưu: đổi chức năng / chọn mẫu ra 860 / vát + báo; gõ ô bếp chỉ ghi khoá đó
  await lan([['mncf.spec.v2', JSON.stringify(s133)], ['mncf.spec.ban', '1.33.0']], async p4 => {
    await S(p4, '[data-act="bep-kieu"][data-v="canh"]').click();
    await p4.waitForFunction(() => window.MNCF.app.getSpec().bep.chuc_nang === 'canh');
    const b = await p4.evaluate(() => { const s = window.MNCF.app.getSpec(); return [s.cao, s.bep.cao_mat, s.bep.tay_nam]; });
    ok(JSON.stringify(b) === JSON.stringify([840, 860, 'vat']), 'tủ bếp 1.33.0 → đổi chức năng: mẫu của chức năng mới ra 860 / vát', b);
    await S(p4, '[data-bep="len_lui"]').fill('60');
    await p4.waitForFunction(() => window.MNCF.app.getSpec().bep.len_lui === 60);
    const l = await docLuu(p4);
    ok(l && l.len_lui === 60 && l.ban === window_ver && !('cao_mat' in l) && !('tay_nam' in l), 'gõ Lùi xà chân: chuẩn lưu chỉ có khoá đó (+ phiên bản)', l);
    await S(p4, '[data-act="lui"]').click(); await S(p4, '[data-act="lui"]').click();
    await p4.waitForFunction(() => window.MNCF.app.getSpec().bep.cao_mat === 850);
    const st = await chonBep(p4, 'BD-NK3-600');
    const b2 = await p4.evaluate(() => { const s = window.MNCF.app.getSpec(); return [s.bep.cao_mat, s.bep.tay_nam, s.bep.len_lui]; });
    ok(JSON.stringify(b2) === JSON.stringify([860, 'vat', 60]) && /Chuẩn bếp mới/.test(st), 'lùi về tủ 1.33.0 rồi chọn mẫu: 860 / vát, giữ lùi 60 đã lưu, báo chuẩn mới', [b2, st]);
  });
  const chonBepCho = async (p, ma) => { const st = await chonBep(p, ma); await p.waitForTimeout(150); return st; };
  const bepCua = p => p.evaluate(() => { const s = window.MNCF.app.getSpec(); return [s.cao, s.sau_thung, s.bep.cao_mat, s.bep.sau_duoi, s.bep.tay_nam, s.chan.cao]; });
  // (soát 1.33.1 v2 #1) gõ ô chung Cao / Sâu thùng của tủ bếp dưới = đổi mặt đá / sâu tủ dưới → nhớ vào chuẩn, mẫu sau theo (HEAD 1.33.1 cũ: mẫu sau về 860 / 560)
  await lan([], async p4 => {
    await chonBepCho(p4, 'BD-CANH-600');
    await S(p4, '[data-k="cao"]').fill('830'); await p4.waitForFunction(() => window.MNCF.app.getSpec().bep.cao_mat === 850);
    await S(p4, '[data-k="sau_thung"]').fill('540'); await p4.waitForFunction(() => window.MNCF.app.getSpec().bep.sau_duoi === 540); await p4.waitForTimeout(300);
    const l = await docLuu(p4);
    ok(l && l.cao_mat === 850 && l.sau_duoi === 540 && l.ban === window_ver, 'gõ ô Cao / Sâu thùng của tủ bếp dưới: chuẩn mặt đá 850 / sâu 540 nhớ ở máy', l);
    await chonBepCho(p4, 'BD-NK3-600');
    const b = await bepCua(p4); ok(JSON.stringify(b.slice(0, 4)) === JSON.stringify([830, 540, 850, 540]), 'mẫu sau theo mặt đá 850 / sâu 540 vừa gõ', b);
    // tủ che ống (chiều cao riêng): gõ Cao không đổi chuẩn Cao tủ trên
    await chonBepCho(p4, 'BT-HMK-700');
    await S(p4, '[data-k="cao"]').fill('300'); await p4.waitForFunction(() => window.MNCF.app.getSpec().cao === 300); await p4.waitForTimeout(300);
    const l2 = await docLuu(p4); ok(l2 && !('cao_tren' in l2) && l2.cao_mat === 850, 'tủ che ống gõ Cao 300: chuẩn Cao tủ trên không đổi', l2);
  });
  // (soát 1.33.1 v2 #2) bản lưu cũ (850 / nổi), gõ mặt đá ngay lần đầu: dòng báo vẫn còn phần tay nắm (chỉ bỏ khoá vừa đặt), chọn mẫu sau có báo tay nắm vát
  await lan([['mncf.bep.v1', luu0]], async p4 => {
    await p4.evaluate(x => window.MNCF.app.setSpec(x), C.apMau(C.normalize({ hau: { t: 6 } }), 'BD-NK3-600'));
    await S(p4, '[data-bep="cao_mat"]').fill('870'); await p4.waitForFunction(() => window.MNCF.app.getSpec().bep.cao_mat === 870); await p4.waitForTimeout(400);
    const t = await baoRow(p4), l = await docLuu(p4);
    ok(l && l.cao_mat === 870 && !('tay_nam' in l), 'gõ mặt đá 870 (bản lưu cũ): chuẩn 870, tay nắm cũ "nổi" bị bỏ (nâng)', l);
    ok(/Tay nắm: tay nắm nổi/.test(t) && !/Cao mặt đá 850/.test(t), 'dòng vàng còn báo tay nắm (khoá chưa đặt), không báo mặt đá (vừa đặt)', t);
    const st = await chonBepCho(p4, 'BD-CANH-600');
    const b = await bepCua(p4);
    ok(b[2] === 870 && b[4] === 'vat' && /tay nắm nổi/i.test(st) && !/Cao mặt đá 850/.test(st), 'mẫu sau: 870 / vát, dòng trạng thái báo tay nắm đổi', [b, st]);
  });
  // (soát 1.33.1 v2 #4) localStorage đọc được mà ghi không được (đầy): nâng một lần, báo một lần; số gõ ở khối Tủ bếp vẫn sang mẫu sau (nhớ trong phiên)
  await lan([['mncf.bep.v1', luu0]], async p4 => {
    const st0 = await chonBepCho(p4, 'BD-CANH-600');
    ok(/Chuẩn bếp mới/.test(st0), 'bộ nhớ đầy: lần đầu báo chuẩn bếp mới');
    await S(p4, '[data-bep="chan"]').fill('120'); await p4.waitForFunction(() => window.MNCF.app.getSpec().chan.cao === 120); await p4.waitForTimeout(300);
    const st = await chonBepCho(p4, 'BD-NK3-600');
    const b = await bepCua(p4);
    ok(b[5] === 120 && b[2] === 860 && !/Chuẩn bếp mới/.test(st), 'bộ nhớ đầy: mẫu sau giữ chân 120 vừa gõ, không báo lại chuẩn mới', [b, st]);
    const st3 = await chonBepCho(p4, 'BD-CANH-600');
    ok(!/Chuẩn bếp mới/.test(st3) && (await bepCua(p4))[5] === 120, 'bộ nhớ đầy: chọn mẫu lần ba vẫn không báo lại, chân 120');
  }, 'mncf.bep.v1');
  await lan([['mncf.bep.v1', JSON.stringify({ cao_mat: 870, ban: '1.33.1' })]], async p4 => {
    const st = await chonBep(p4, 'BD-CANH-600');
    ok(!/Chuẩn bếp mới/.test(st), 'chuẩn người dùng đã chọn (870): không báo chuẩn mới', st);
  });
}

// (bản 1.34) BỘ BẾP CHỮ I / CHỮ L: chọn ở Thư viện → bảng tự chia (Core.xepBep), hình mặt bằng + mặt đứng, phương án ‹ ›, bấm tủ → ô chọn (Đổi thành / Ghim / Mở thành tủ),
// kéo chậu trên mặt bằng, đầu dãy tường / hở, tủ lạnh / + Lò / + Kho / + Kệ, nút sửa nhanh (một bước ↶ Lùi), nhớ ở localStorage mncf.bobep.v1 (hỏng vẫn chạy)
async function testBoBep(browser) {
  console.log('— Bộ bếp chữ I / chữ L (bản 1.34): tự chia, phương án, bấm tủ để đổi, kéo chậu, nhớ lựa chọn');
  const { ctx, page, errs } = await open(browser, path.join(DIST, 'mn-chenfeng.html'));
  const H = page.locator('#mncf-host');
  const nhom = await tvNhom(page);
  ok(nhom.some(([l, v]) => l === 'Bếp' && v.indexOf('@BO-I') >= 0 && v.indexOf('@BO-L') >= 0), 'ô Thư viện, nhóm Bếp: Bộ bếp chữ I, chữ L (1.34.1)', nhom);
  const vao = async ma => { await chonMau(page, ma); };
  const bo = () => page.evaluate(() => window.MNCF.app.getBo());
  const kq = () => page.evaluate(() => window.MNCF.app.getBoKq());
  const tt = () => S(page, '[data-ui="bo-tt"]').textContent();
  const hien = sel => page.evaluate(q => [...document.getElementById('mncf-host').shadowRoot.querySelectorAll(q)].map(e => e.getClientRects().length > 0), sel);
  const cho = () => page.waitForTimeout(450);      // ô gõ chia lại sau một nhịp ngắn
  await vao('@BO-I');
  ok((await S(page, '.panel').getAttribute('data-loai')) === 'bo-bep' && await S(page, '.bo').isVisible() && (await hien('.chi-tu')).every(v => !v) && !(await S(page, '.view').isVisible()) && !(await S(page, '.dims').isVisible()), 'chọn "Bộ bếp chữ I": data-loai "bo-bep", khối Bộ bếp hiện, phần của tủ lẻ (khoang, ô kích thước, hình đứng) ẩn');
  ok((await S(page, '.bov svg[data-bo="mb"]').count()) === 1 && (await S(page, '.bov svg[data-bo="md"]').count()) === 1, 'có hình mặt bằng + mặt đứng của dãy');
  ok(!(await S(page, '[data-ui="bo-dai-b"]').isVisible()) && !(await S(page, '[data-ui="bo-goc"]').isVisible()), 'chữ I: không có ô Dài B, Góc');
  // gõ dài 4500, tủ lạnh 830 → bảng chia ngay; dòng trạng thái theo đúng phương án của lõi
  await S(page, '[data-ui="bo-dai-a"]').fill('4500'); await cho();
  await S(page, '[data-act="bo-tl"][data-v="bon_canh_830"]').click();
  { const b = await bo(), k = await kq(), C = await page.evaluate(b => { const r = window.MNCFCore.xepBep(b); return [r.pa.length, r.pa[0] && r.pa[0].ds.length, r.pa[0] && r.pa[0].so_che]; }, b);
    ok(b.canh[0].dai === 4500 && b.tl.may === 'bon_canh_830' && k.pa.length === C[0], 'Dài 4500 + tủ lạnh 830 vào bộ; phương án = của lõi', [b.canh, b.tl, k.pa.length, C]);
    const t = await tt(); ok(new RegExp(`Phương án 1/${C[0]} · ${C[1]} tủ · sơ chế ${C[2]}`).test(t), 'dòng trạng thái: Phương án 1/N · số tủ · sơ chế', [t, C]);
    ok((await S(page, '[data-act="bo-tl"][data-v="bon_canh_830"]').getAttribute('aria-pressed')) === 'true', 'chip tủ lạnh 830 đang bật'); }
  // ‹ › đổi phương án (không đổi bộ)
  { const k0 = await kq(); if (k0.pa.length > 1) { await S(page, '[data-act="bo-pa"][data-v="1"]').click(); const k1 = await kq(), t = await tt();
      ok(k1.i === 1 && /Phương án 2\//.test(t), '› sang phương án 2', [k1.i, t]); await S(page, '[data-act="bo-pa"][data-v="-1"]').click(); ok((await kq()).i === 0, '‹ về phương án 1'); }
    else ok(false, 'cần ≥ 2 phương án để thử ‹ ›', k0.pa.length); }
  // localStorage nhớ lựa chọn
  ok(await page.evaluate(() => { try { const o = JSON.parse(localStorage.getItem('mncf.bobep.v1')); return o && o.canh[0].dai === 4500 && o.tl.may === 'bon_canh_830' && !('chuan' in o); } catch (e) { return false; } }), 'mncf.bobep.v1 nhớ lựa chọn (không nhớ chuẩn bếp — chuẩn ở mncf.bep.v1)');
  // bấm một tủ trên mặt đứng → ô chọn nằm NGAY DƯỚI hình (trong dòng chảy), có Đổi thành + Ghim
  { const p = (await kq()).pa[0], m = p.ds.find(x => x.tang === 'duoi' && x.chuc === 'nk') || p.ds.find(x => x.tang === 'duoi' && ['gv', 'canh'].includes(x.chuc) && !x.nep && !x.op);      // (vòng soát 1.34: phương án 1 có khi không có tủ ngăn kéo)
    await S(page, `.bov svg[data-bo="md"] [data-bo-vt="${m.vt}"]`).click();
    ok(await S(page, '.bokpop').isVisible(), 'bấm tủ: ô chọn hiện');
    const viTri = await page.evaluate(() => { const r = document.getElementById('mncf-host').shadowRoot, a = r.querySelector('.bov svg[data-bo="md"]').getBoundingClientRect(), k = r.querySelector('.bokpop'); return [a.bottom, k.getBoundingClientRect().top, getComputedStyle(k).position]; });
    ok(viTri[1] >= viTri[0] - 1 && viTri[2] !== 'absolute' && viTri[2] !== 'fixed', 'ô chọn nằm dưới hình, không nổi phủ lên hình', viTri);
    const doi = await S(page, '.bokpop [data-act="kpop-bo-doi"]').evaluateAll(bs => bs.map(b => b.dataset.v));
    ok(doi.length > 0 && doi.every(v => new RegExp(`-${m.rong}$`).test(v) && v !== m.ma), 'Đổi thành: mẫu cùng tầng đúng rộng', [m.ma, doi]);
    // Ghim → vào khoa, một bước ↶ Lùi
    await S(page, '.bokpop [data-act="kpop-bo-ghim"]').click();
    const b1 = await bo(); ok(Object.values(b1.khoa).some(q => q.ma === m.ma && q.s0 === m.s0), 'Ghim: tủ vào khoa (mẫu + chỗ)', b1.khoa);
    ok((await kq()).pa.every(q => q.ds.some(x => x.ma === m.ma && x.s0 === m.s0 && x.ghim)), 'mọi phương án giữ tủ đã ghim');
    await S(page, '[data-act="lui"]').click();
    ok(Object.keys((await bo()).khoa).length === 0, '↶ Lùi: bỏ ghim (một bước)');
    // Đổi thành một mẫu khác cùng rộng
    await S(page, `.bov svg[data-bo="md"] [data-bo-vt="${m.vt}"]`).click();
    const ma2 = doi.find(v => /CANH|XN|GV|RAC|GAO/.test(v)) || doi[0];
    await S(page, `.bokpop [data-act="kpop-bo-doi"][data-v="${ma2}"]`).click();
    const p2 = (await kq()).pa[0];
    ok(p2 && p2.ds.some(x => x.ma === ma2 && x.s0 === m.s0), 'Đổi thành: tủ đổi mẫu tại đúng chỗ', [ma2, p2 && p2.ds.map(x => x.ma)]);
    await S(page, '[data-act="lui"]').click(); }
  // kéo chậu trên mặt bằng tới tâm s = 2010 (giữa khoảng làm tròn 50 → 2000)
  { const p = (await kq()).pa[0], c = p.ds.find(x => x.chuc === 'chau');
    const px = await page.evaluate(([u0, u1, s]) => { const g = document.getElementById('mncf-host').shadowRoot.querySelector('.bov svg[data-bo="mb"]'), M = g.getScreenCTM(), pt = g.createSVGPoint();
      const f = (x, y) => { pt.x = x; pt.y = y; const q = pt.matrixTransform(M); return [q.x, q.y]; }; return [f((u0 + u1) / 2, 250), f(s, 250)]; }, [c.u0, c.u1, 2010]);
    await page.mouse.move(px[0][0], px[0][1]); await page.mouse.down(); await page.mouse.move((px[0][0] + px[1][0]) / 2, px[0][1], { steps: 4 }); await page.mouse.move(px[1][0], px[1][1], { steps: 4 }); await page.mouse.up();
    await page.waitForTimeout(100);
    const b = await bo(); ok(b.chau.s === 2000, 'kéo chậu: tâm chậu ghi 2000 (làm tròn lưới 50)', b.chau);
    ok(!(await S(page, '.bokpop').isVisible()), 'kéo xong không mở ô chọn'); }
  await S(page, '[data-act="lui"]').click(); ok((await bo()).chau.s === null, '↶ Lùi: chậu về tự đặt');
  // đầu dãy: bấm đầu phải trên mặt bằng → hở (ốp hông), + Kệ → kệ sát đầu hở
  await S(page, '.bov svg[data-bo="mb"] [data-bo-dau="0:cuoi"]').click();
  ok((await bo()).canh[0].cuoi === 'ho' && (await kq()).pa[0].ds.some(x => x.op === 'phai'), 'bấm đầu phải: tường → hở, tủ cuối có ốp hông', (await bo()).canh);
  await S(page, '[data-act="bo-ke"]').click();
  { const p = (await kq()).pa[0]; ok((await bo()).ke === true && p && p.ds.some(x => x.ma === 'BD-KE-300' && x.op === 'phai') && (await S(page, '[data-act="bo-ke"]').getAttribute('aria-pressed')) === 'true', '+ Kệ: kệ hở sát đầu hở', p && p.ds.map(x => x.ma)); }
  // + Lò / + Kho
  await S(page, '[data-act="bo-cao"][data-v="lo"]').click();
  ok(JSON.stringify((await bo()).cao) === JSON.stringify([{ loai: 'lo', rong: 600 }]) && (await kq()).pa.some(q => q.ds.some(x => x.ma === 'BC-LO-600')) && (await S(page, '[data-act="bo-cao"][data-v="lo"]').getAttribute('aria-pressed')) === 'true', '+ Lò: tủ cao lò vào dãy', await bo());
  await S(page, '[data-act="bo-cao"][data-v="lo"]').click(); ok((await bo()).cao.length === 0, 'bấm lại + Lò: bỏ');
  // nút sửa nhanh: tủ lạnh đầu trái, ống thoát sát đầu trái → không xếp được; "Đổi bên tủ lạnh" chỉ hiện khi đỡ hơn, bấm = một bước ↶ Lùi
  await page.evaluate(() => window.MNCF.app.setBo({ kieu: 'I', canh: [{ dai: 3700 }], tl: { may: 'hai_canh_700', dau: 'dau' }, ong: { canh: 0, s: 600 } }));
  await page.waitForFunction(() => !!document.getElementById('mncf-host').shadowRoot.querySelector('[data-act="bo-sua-tl"]'), null, { timeout: 5000 }).catch(() => {});
  ok((await kq()).pa.length === 0 && await S(page, '[data-act="bo-sua-tl"]').isVisible(), 'không xếp được: hiện nút "Đổi bên tủ lạnh"');
  await S(page, '[data-act="bo-sua-tl"]').click();
  ok((await bo()).tl.dau === 'cuoi' && (await kq()).pa.length > 0, 'sửa nhanh: tủ lạnh sang đầu phải, có phương án');
  await S(page, '[data-act="lui"]').click(); ok((await bo()).tl.dau === 'dau', 'sửa nhanh là MỘT bước ↶ Lùi');
  // chữ L: Dài B + Góc, hai cạnh trên mặt bằng, thẻ cạnh A / B ở mặt đứng (bỏ ống thoát của ca sửa nhanh trước)
  await page.evaluate(() => window.MNCF.app.setBo({ kieu: 'I', canh: [{ dai: 3050 }], tl: { may: 'bon_canh_830' }, ke: true }));
  await S(page, '[data-act="bo-kieu"][data-v="L"]').click();
  ok((await bo()).kieu === 'L' && await S(page, '[data-ui="bo-dai-b"]').isVisible() && await S(page, '[data-ui="bo-goc"]').isVisible() && (await S(page, '[data-ui="bo-goc"]').inputValue()) === 'hg_lh', 'chữ L: hiện Dài B + Góc (mặc định Higold 900/400)');
  await S(page, '[data-ui="bo-dai-a"]').fill('3050'); await S(page, '[data-ui="bo-dai-b"]').fill('2450'); await cho();
  { const k = await kq(); ok(k.pa.length > 0 && k.pa[0].ds.some(x => x.chuc === 'goc') && (await S(page, '.bov svg[data-bo="mb"] [data-bo-vt]').evaluateAll(es => new Set(es.map(e => e.dataset.boVt[0])).size)) === 2, 'chữ L: có tủ góc, mặt bằng vẽ cả 2 cạnh', k.loi_chung);
    await S(page, '[data-act="bo-canh"][data-v="1"]').click();
    const vts = await S(page, '.bov svg[data-bo="md"] [data-bo-vt]').evaluateAll(es => es.map(e => e.dataset.boVt));
    ok(vts.length > 0 && vts.every(v => v[0] === 'B'), 'mặt đứng cạnh B', vts); }
  // (vòng soát 2 — 1.34) chữ L, bếp tự chọn cạnh: gõ Tâm bếp theo cạnh đang có bếp → bếp ở lại cạnh đó (không nhảy sang tường kia với cùng số)
  { const b0 = await bo(); await page.evaluate(() => { const o = window.MNCF.app.getBo(); o.canh = [{ dai: 3800 }, { dai: 2600 }]; o.tl = null; o.ke = false; o.bep = { canh: null, s: null }; window.MNCF.app.setBo(o); });
    const m = (await kq()).pa[0].ds.find(x => x.chuc === 'bep');
    const mo = !(await S(page, '[data-ui="bo-bep-s"]').isVisible()); if (mo) await S(page, '[data-act="bo-them"]').click();
    await S(page, '[data-ui="bo-bep-s"]').fill('2150'); await cho();
    const b = await bo(), m2 = (await kq()).pa[0].ds.find(x => x.chuc === 'bep');
    ok(m.canh === 1 && b.bep.canh === m.canh && m2.canh === m.canh, 'gõ Tâm bếp (chữ L): ghi cạnh đang có bếp, bếp ở lại cạnh đó', [m.canh, b.bep, m2.canh]);
    if (mo) await S(page, '[data-act="bo-them"]').click();
    await page.evaluate(o => window.MNCF.app.setBo(o), b0); }
  // (vòng soát 3 — 1.34) chữ L, cạnh A ngắn (tủ lạnh + tủ góc): chậu tự sang cạnh B (có dòng báo), ô "Chậu ở" chọn lại cạnh; nút "Bảng đá" tải bảng gia công đá cả dãy
  { const b0 = await bo();
    await page.evaluate(() => { const o = window.MNCF.app.getBo(); o.canh = [{ dai: 2400 }, { dai: 2800 }]; o.tl = { may: 'hai_canh_700' }; o.ong = null; o.chau = { canh: 0, s: null, co: null }; o.bep = { canh: null, s: null }; o.khoa = {}; o.ke = false; o.cao = []; window.MNCF.app.setBo(o); });
    const k = await kq(), c = k.pa[0] && k.pa[0].ds.find(x => x.chuc === 'chau' && x.tang === 'duoi');
    ok(k.pa.length > 0 && c && c.canh === 1 && await S(page, '[data-ui="bo-chau-tu"]').isVisible(), 'L A 2400 / B 2800 + tủ lạnh: có phương án, chậu tự sang cạnh B, có dòng báo', [k.loi_chung, c && c.canh]);
    const mo = !(await S(page, '[data-ui="bo-chau-canh"]').isVisible()); if (mo) await S(page, '[data-act="bo-them"]').click();
    ok((await S(page, '[data-ui="bo-chau-canh"]').inputValue()) === '1', 'ô "Chậu ở" hiện cạnh chậu thật (B)');
    await S(page, '[data-ui="bo-chau-canh"]').selectOption('1');
    ok((await bo()).chau.canh === 1 && (await kq()).pa.length > 0 && (await S(page, '[data-ui="bo-chau-tu"]').count()) === 0, 'chọn "Chậu ở cạnh B": bộ ghi cạnh B, hết dòng tự sang');
    // gõ Tâm chậu: theo cạnh đang có chậu (B)
    await S(page, '[data-ui="bo-chau-s"]').fill('1900'); await cho();
    { const b = await bo(), m = (await kq()).pa[0]; ok(b.chau.canh === 1 && b.chau.s === 1900 && m && m.ds.find(x => x.chuc === 'chau').canh === 1, 'gõ Tâm chậu: chậu ở lại cạnh B', [b.chau, m && m.ds.find(x => x.chuc === 'chau')]); }
    if (mo) await S(page, '[data-act="bo-them"]').click();
    const [dl] = await Promise.all([page.waitForEvent('download'), S(page, '[data-act="bo-da"]').click()]);
    const f = path.join(__dirname, '..', 'out', 'ui_test_bo_da.csv'); await dl.saveAs(f);
    const csv = fs.readFileSync(f, 'utf8'); fs.unlinkSync(f);
    ok(/_da\.csv$/.test(dl.suggestedFilename()) && /Gia công đá/.test(csv) && /khoét chậu/.test(csv) && /khoét bếp/.test(csv) && /Đá cạnh B/.test(csv), 'Bảng đá: tải CSV gia công đá của dãy (tấm, khoét chậu / bếp)', csv.slice(0, 600));
    await page.evaluate(o => window.MNCF.app.setBo(o), b0); }
  await S(page, '[data-ui="bo-goc"]').selectOption('eu_lh'); await cho();
  ok((await bo()).goc.pk === 'eu_lh' && (await kq()).pa.some(q => q.ds.some(x => /^BD-GOC-990/.test(x.ma))), 'đổi phụ kiện góc → tủ góc 990');
  // Mở thành tủ: tủ đó thành tủ bếp lẻ ở thẻ Tủ (thông số của bộ), ↶ Lùi về bộ
  { const m = (await kq()).pa[0].ds.find(x => x.chuc === 'bep');
    await S(page, '[data-act="bo-canh"][data-v="' + m.canh + '"]').click();
    await S(page, `.bov svg[data-bo="md"] [data-bo-vt="${m.vt}"]`).click(); await S(page, '.bokpop [data-act="kpop-bo-mo"]').click();
    const s = await page.evaluate(() => window.MNCF.app.getSpec());
    ok(s.loai_sp === 'bep' && s.bep.chuc_nang === 'bep' && (await S(page, '.panel').getAttribute('data-loai')) === 'bep-duoi' && !(await S(page, '.bo').isVisible()), 'Mở thành tủ: tủ bếp lẻ đúng thông số của tủ trong bộ', s.bep);
    // (vòng soát 2 — 1.34) tủ lẻ không còn thuộc dãy: bỏ dấu bep.day → bảng kê / CSV có lại dòng Mặt đá (kèm khoét)
    ok(!s.bep.day && await page.evaluate(sp => { const C = window.MNCFCore, M = C.build(sp); return /Gia công đá/.test(C.cutListCSV(M)) && M.da.khoet.length === 1; }, s), 'Mở thành tủ: không mang dấu dãy (bep.day), CSV có dòng Gia công đá + khoét bếp', s.bep.day);
    await S(page, '[data-act="lui"]').click();
    ok((await S(page, '.panel').getAttribute('data-loai')) === 'bo-bep' && (await bo()).kieu === 'L', '↶ Lùi: về bộ bếp'); }
  // (bản 1.35) cỡ chung chậu = bếp, "+ Tủ lạnh" trên mặt bằng (dương / âm, gõ kích thước máy), tủ trên 2 tầng kịch trần, cánh kính, LED
  { const b0 = await bo(), mdCo = q => S(page, `.bov svg[data-bo="md"] ${q}`).count();
    await page.evaluate(() => window.MNCF.app.setBo({ kieu: 'I', canh: [{ dai: 4200 }], tl: null }));
    ok((await S(page, '[data-act="bo-co"][data-v=""]').getAttribute('aria-pressed')) === 'true' && /tự · (700|800|900)/.test(await S(page, '[data-act="bo-co"][data-v=""]').innerText()), 'cỡ chậu = bếp: mặc định "tự", chip ghi cỡ đang dùng', await S(page, '[data-act="bo-co"][data-v=""]').innerText());
    await S(page, '[data-act="bo-co"][data-v="700"]').click();
    { const b = await bo(), p = (await kq()).pa[0]; ok(b.co === 700 && p && p.ds.some(x => x.ma === 'BD-CHAU-700') && p.ds.some(x => x.ma === 'BD-BEP-700') && (await S(page, '[data-act="bo-co"][data-v="700"]').getAttribute('aria-pressed')) === 'true', 'chip 700: tủ chậu và tủ bếp cùng 700', [b.co, p && p.ds.map(x => x.ma)]); }
    await S(page, '[data-act="lui"]').click(); ok((await bo()).co === null, '↶ Lùi: cỡ về tự (một bước)');
    // + Tủ lạnh ở đầu trái trên mặt bằng → khoang tủ lạnh + ô chọn có kích thước máy
    ok((await S(page, '.bov svg[data-bo="mb"] [data-bo-tl]').count()) === 2, 'mặt bằng chữ I: nút "+ Tủ lạnh" ở hai đầu');
    await S(page, '.bov svg[data-bo="mb"] [data-bo-tl="0:dau"]').click();
    { const b = await bo(), p = (await kq()).pa[0]; ok(b.tl && b.tl.dau === 'dau' && !b.tl2 && p.ds.some(x => x.chuc === 'tl' && x.u0 === 0) && (await S(page, '.bov svg[data-bo="mb"] [data-bo-tl="0:dau"]').getAttribute('aria-pressed')) === 'true', '+ Tủ lạnh đầu trái: khoang tủ lạnh ở đầu trái', b.tl);
      ok(await S(page, '.bokpop [data-ui="bok-tl-rong"]').isVisible() && await S(page, '.bokpop [data-act="kpop-bo-tlk"][data-v="am"]').isVisible(), 'thêm xong: ô chọn của khoang tủ lạnh có Dương / Âm + kích thước máy'); }
    await S(page, '.bov svg[data-bo="mb"] [data-bo-tl="0:cuoi"]').click();
    { const b = await bo(), p = (await kq()).pa[0]; ok(b.tl2 && b.tl2.dau === 'cuoi' && p && p.ds.filter(x => x.chuc === 'tl').length === 2, '+ Tủ lạnh đầu phải: tủ lạnh thứ hai, dãy chia lại', [b.tl2, (await kq()).loi_chung]); }
    await S(page, '.bokpop [data-act="kpop-bo-tlk"][data-v="am"]').click();
    { const b = await bo(), p = (await kq()).pa[0]; ok(b.tl2.kieu === 'am' && b.tl2.ho_hong === 5 && b.tl.kieu !== 'am' && p.ds.some(x => /^BC-TLA/.test(x.ma) && x.u1 === 4200), 'Âm: khoang tủ lạnh đầu phải thành khoang âm (hở 5), đầu trái giữ nguyên', [b.tl, b.tl2]); }
    await S(page, '.bokpop [data-ui="bok-tl-rong"]').fill('600'); await S(page, '.bokpop [data-ui="bok-tl-rong"]').press('Enter');
    { const b = await bo(), p = (await kq()).pa[0], m = p && p.ds.find(x => x.chuc === 'tl' && x.u1 === 4200); ok(b.tl2.may && b.tl2.may.rong === 600 && b.tl2.kieu === 'am' && m && /^BC-TLA/.test(m.ma) && m.may.rong === 600 && m.rong > 600 && m.rong < 660 && (await S(page, '.bokpop [data-ui="bok-tl-rong"]').inputValue()) === '600', 'gõ Máy rộng 600: khoang âm sinh theo máy (lòng 600 + 2 × 5 hở)', [b.tl2, m]); }
    // (vòng soát 1.35) máy âm sâu 560 (> lọt sâu 553,5 của tủ cao chuẩn 560): tủ cao sâu theo máy — vẫn có phương án, ô chọn còn nguyên
    await S(page, '.bokpop [data-ui="bok-tl-sau"]').fill('560'); await S(page, '.bokpop [data-ui="bok-tl-sau"]').press('Enter');
    { const r = await kq(), b = await bo(), p = r.pa[0], m = p && p.ds.find(x => x.chuc === 'tl' && x.u1 === 4200);
      const sau = p && await page.evaluate(([b, vt]) => { const C = window.MNCFCore, r = C.xepBep(b), x = C.tuBo(b, r.pa[0]).find(q => q.vt === vt); return x && x.spec.sau_thung; }, [b, m && m.vt]);
      ok(b.tl2.may.sau === 560 && p && m && sau >= 566.5 && await S(page, '.bokpop [data-ui="bok-tl-sau"]').isVisible(), 'gõ Máy sâu 560 (âm): tủ cao sâu theo máy, còn phương án + ô chọn', [b.tl2, r.loi_chung, sau]); }
    // (vòng soát 1.35) kéo nhẹ tủ lạnh THỨ HAI (đầu phải) rồi thả vẫn bên phải: hai tủ lạnh không đổi chỗ
    { const g = S(page, '.bov svg[data-bo="mb"] [data-bo-keo="tl"][data-bo-tli="1"]'), bb = await g.boundingBox();
      ok(!!bb, 'mặt bằng: khoang tủ lạnh thứ hai mang data-bo-tli="1"');
      if (bb) { await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down(); await page.mouse.move(bb.x + bb.width / 2 - 8, bb.y + bb.height / 2, { steps: 3 }); await page.mouse.move(bb.x + bb.width / 2 - 20, bb.y + bb.height / 2, { steps: 3 }); await page.mouse.up(); }
      const b = await bo(); ok(b.tl.dau === 'dau' && b.tl.kieu !== 'am' && b.tl2.dau === 'cuoi' && b.tl2.kieu === 'am' && b.tl2.may.sau === 560, 'kéo nhẹ tủ lạnh thứ hai: không đổi chỗ hai tủ lạnh', [b.tl, b.tl2]); }
    await S(page, '.bov svg[data-bo="mb"] [data-bo-tl="0:dau"]').click();
    { const b = await bo(); ok(b.tl && b.tl.dau === 'cuoi' && b.tl.kieu === 'am' && !b.tl2 && (await kq()).pa[0].ds.filter(x => x.chuc === 'tl').length === 1, 'bấm lại đầu trái: bỏ tủ lạnh đó, tủ lạnh âm đầu phải thành tủ lạnh chính', [b.tl, b.tl2]); }
    // tủ trên 2 tầng kịch trần (mặc định trần 2700)
    { const b = await bo(), p = (await kq()).pa[0]; ok(b.tran === 2700 && (await S(page, '[data-act="bo-t2"]').getAttribute('aria-pressed')) === 'true' && p.ds.some(x => x.t2) && (await S(page, '[data-ui="bo-tran"]').inputValue()) === '2700', '2 tầng: mặc định bật, trần 2700, có tủ tầng trên', b.tran); }
    await S(page, '[data-ui="bo-tran"]').fill('2600'); await cho();
    { const p = (await kq()).pa[0]; ok((await bo()).tran === 2600 && !p.ds.some(x => x.t2) && p.luu_y.some(t => /tầng trên/.test(t)), 'trần 2600: tầng trên < 250 → không làm, có lưu ý nẹp trần', p.luu_y); }
    await S(page, '[data-ui="bo-tran"]').fill('2900'); await cho();
    { const p = (await kq()).pa[0], u = p.ds.filter(x => x.t2); ok(u.length > 0 && u.every(x => Math.abs(x.z + x.cao - 2890) < 0.6) && await page.evaluate(() => { const g = document.getElementById('mncf-host').shadowRoot.querySelector('.bov svg[data-bo="md"]'); return g.viewBox.baseVal.height >= 2890; }), 'trần 2900: tầng trên tới 2890 (khe 10), mặt đứng cao theo', u.map(x => [x.vt, x.z, x.cao])); }
    await S(page, '[data-act="bo-t2"]').click();
    ok((await bo()).tran === 0 && !(await kq()).pa[0].ds.some(x => x.t2) && (await S(page, '[data-ui="bo-tran"]').count()) === 0, 'tắt 2 tầng: trần 0, không tủ tầng trên, ẩn ô Trần');
    await S(page, '[data-act="bo-t2"]').click(); ok((await bo()).tran === 2900, 'bật lại 2 tầng: nhớ trần vừa gõ');
    // kính + LED
    ok((await mdCo('[data-bo-kinh]')) > 0 && (await mdCo('[data-bo-led]')) > 0, 'mặt đứng: lòng kính ở tủ giá bát, dải LED dưới tủ trên');
    await S(page, '[data-act="bo-kinh"]').click();
    ok((await bo()).kinh === 'khong' && (await mdCo('[data-bo-kinh]')) === 0, 'tắt Kính: không cánh kính');
    { const m = (await kq()).pa[0].ds.find(x => x.tang === 'tren' && !x.t2 && x.chuc === 'canh');
      await S(page, `.bov svg[data-bo="md"] [data-bo-vt="${m.vt}"]`).click(); await S(page, '.bokpop [data-act="kpop-bo-kinh"]').click();
      const b = await bo(); ok(Array.isArray(b.kinh) && b.kinh.length === 1 && b.kinh[0].canh === m.canh && b.kinh[0].s > m.s0 && b.kinh[0].s < m.s0 + m.dai && (await mdCo(`[data-bo-vt="${m.vt}"] [data-bo-kinh]`)) === 1 && (await S(page, '[data-act="bo-kinh"]').getAttribute('aria-pressed')) === 'true', 'ô chọn tủ trên: "Cánh kính" → đúng tủ đó cánh kính', [b.kinh, m.vt]);
      ok(await page.evaluate(([b, vt]) => { const C = window.MNCFCore, r = C.xepBep(b), x = C.tuBo(b, r.pa[0]).find(q => q.vt === vt); return !!(x && x.spec.bep.kinh); }, [b, m.vt]), 'tủ đó trong tuBo mang bep.kinh'); }
    await S(page, '[data-act="bo-led"]').click();
    ok((await bo()).led === false && (await mdCo('[data-bo-led]')) === 0, 'tắt LED: không dải LED');
    await S(page, '[data-act="lui"]').click(); ok((await bo()).led === true, '↶ Lùi: LED bật lại');
    await page.evaluate(o => window.MNCF.app.setBo(o), b0); }
  // rời bộ: chọn một tủ lẻ ở Thư viện
  await vao('@BEP-duoi');
  ok((await S(page, '.panel').getAttribute('data-loai')) === 'bep-duoi' && await page.evaluate(() => window.MNCF.app.getBo() === null), 'chọn tủ lẻ: thôi bộ bếp');
  // vào lại: nhớ lựa chọn lần trước (chữ L, góc Eurogold)
  await vao('@BO-L');
  { const b = await bo(); ok(b.kieu === 'L' && b.canh[0].dai === 3050 && b.goc.pk === 'eu_lh', 'vào lại: nhớ lựa chọn lần trước', b); }
  ok(errs.length === 0, 'không lỗi JS', errs);
  await ctx.close();
  // localStorage hỏng (đọc / ghi ném lỗi): bộ bếp vẫn chạy; màn hẹp không tràn ngang
  { const c2 = await browser.newContext({ viewport: { width: 390, height: 860 } });
    await c2.addInitScript(() => { const g = Storage.prototype.getItem, s = Storage.prototype.setItem; Storage.prototype.getItem = function (k) { if (k === 'mncf.bobep.v1') throw new Error('hỏng'); return g.call(this, k); }; Storage.prototype.setItem = function (k, v) { if (k === 'mncf.bobep.v1') throw new Error('hỏng'); return s.call(this, k, v); }; });
    const p2 = await c2.newPage(), e2 = []; p2.on('pageerror', e => e2.push(String(e)));
    await p2.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await p2.goto('file://' + path.join(DIST, 'mn-chenfeng.html')); await p2.waitForFunction(() => window.MNCF && window.MNCF.app && window.MNCF.app.getModel());
    await chonMau(p2, '@BO-I');
    await S(p2, '[data-ui="bo-dai-a"]').fill('4200'); await p2.waitForTimeout(450);
    const k = await p2.evaluate(() => window.MNCF.app.getBoKq());
    ok(k.pa.length > 0 && (await S(p2, '.panel').getAttribute('data-loai')) === 'bo-bep', 'localStorage hỏng: bộ bếp vẫn chia được');
    ok((await p2.evaluate(inPage.overflow)) <= 0, 'màn 390: không tràn ngang', await p2.evaluate(inPage.overflow));
    ok(e2.length === 0, 'không lỗi JS (localStorage hỏng)', e2); await c2.close(); }
}

(async () => {
  const browser = await chromium.launch();
  try { await testPage(browser); await testHinhSua(browser); await testHau(browser); await testTouchAndThemes(browser); await testOldSaved(browser); await testArtifact(browser); await testPhieu(browser); await testThuVien(browser); await testBep(browser); await testBoBep(browser); }
  catch (e) { fail++; console.log('  ✗ ném lỗi:', e && e.stack || e); }
  await browser.close();
  console.log(`\n${pass} đạt, ${fail} hỏng`);
  process.exit(fail ? 1 : 0);
})();
