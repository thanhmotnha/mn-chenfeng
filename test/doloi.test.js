'use strict';
// Bản 1.20 — DÒ LỖI SẢN XUẤT trên tấm và lỗ khoan thật (sau khi vẽ, hoặc dò các tấm đang chọn / cả bản vẽ).
//   NODE_PATH=<node_modules có playwright> PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node test/doloi.test.js
// Chạy tiện ích thật (dist/extension) trên trang giả lập Chenfeng có bật cam "thật" (window.__MOCK_CAM__: tấm đực tì cạnh lên mặt tấm cái thì có 2 cam, mỗi cam 3 lỗ đúng hình học đo trên Chenfeng).
const path = require('path'), fs = require('fs'), os = require('os');
const { chromium } = require('playwright');
const EXT = path.join(__dirname, '..', 'dist', 'extension');
const MOCK = fs.readFileSync(path.join(__dirname, 'mock-chenfeng.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) pass++; else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); } };
const eq = (a, b, name) => ok(JSON.stringify(a) === JSON.stringify(b), name, { co: a, can: b });
// tủ 1000 × 1200, 2 khoang hở, mỗi khoang 1 đợt (cao độ khác nhau); vẽ theo cách nhập tấm, không gom module (để mỗi tấm là một đối tượng rời, cam do trang giả lập khoan)
const TU = { ma: 'DL', rong: 1000, cao: 1200, than: { cao_duoi: 0 }, ve_goc: false, module_cf: false, khoang: [{ rong: 'auto', canh: 0, dot: [600] }, { rong: 'auto', canh: 0, dot: [700] }] };
const ket = (p, ma) => ((p && p.muc || []).find(m => m.ma === ma) || {}).ket;
const tin = (p, ma) => ((p && p.muc || []).find(m => m.ma === ma) || { tin: [] }).tin;

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mncf-dl-'));
  const ctx = await chromium.launchPersistentContext(dir, { channel: 'chromium', headless: true, viewport: { width: 1500, height: 900 }, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  try {
    await ctx.route('https://api.cfcad.cn/**', r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': 'https://cfcad.cn', 'access-control-allow-credentials': 'true' }, body: JSON.stringify({ err_code: 1, err_msg: 'no' }) }));
    await require('./kho-gia.js')(ctx);      // bộ nạp của tiện ích lấy bản gộp vừa dựng trong máy
    await ctx.route('https://cfcad.cn/**', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: MOCK }));
    await ctx.addInitScript(() => { window.__MOCK_CAM__ = true; });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    await page.goto('https://cfcad.cn/');
    await page.waitForFunction(() => window.MNCF && window.MNCF.app && window.MNCFDriver, null, { timeout: 15000 });
    const H = page.locator('#mncf-host');
    const ve = (spec, x) => page.evaluate(async ([s, x0]) => { const r = await window.MNCF.draw(s, { at: [x0, 0, 0] }); return { ok: r.ok, gd: r.giai_doan, errors: r.errors, warnings: r.warnings, dl: r.do_loi, tam: r.kiem_tra && r.kiem_tra.so_tam_khop }; }, [spec, x]);

    console.log('— Vẽ xong tự dò lỗi trên tấm thật');
    let r = await ve(TU, 0);
    ok(r.ok && r.gd === 'xong' && r.dl && r.dl.muc.length === 9, 'kết quả vẽ có phiếu dò lỗi 9 mục', [r.ok, r.errors, r.dl && r.dl.muc.length]);
    ok(r.dl.so_tam === r.tam && r.dl.so_lo > 0 && r.dl.so_lo % 3 === 0, 'dò đúng số tấm đã vẽ; mỗi cam 3 lỗ', [r.dl.so_tam, r.tam, r.dl.so_lo]);
    eq(['vc_that', 'lo_giao', 'lo_lech', 'kieu_khoan', 'khong_lo', 'moi_noi', 'kho_van_that', 'lo_lung_that', 'ten_tu'].map(m => ket(r.dl, m)), ['dat', 'dat', 'dat', 'dat', 'dat', 'dat', 'dat', 'dat', 'dat'], 'tủ đúng kết cấu: 9 mục đều đạt');

    console.log('— Mối nối bị sót cam: lưu ý, không phải lỗi');
    await page.evaluate(() => { window.__MOCK_KHONG_CAM__ = 'Đợt'; });
    r = await ve(Object.assign({}, TU, { ma: 'DL2' }), 3000);
    await page.evaluate(() => { window.__MOCK_KHONG_CAM__ = null; });
    ok(r.ok && ket(r.dl, 'moi_noi') === 'luu_y' && tin(r.dl, 'moi_noi').length === 4 && tin(r.dl, 'moi_noi').every(t => /“Đợt”/.test(t)), '2 đợt không cam: 4 đầu đợt được nêu, lần vẽ vẫn "ok"', tin(r.dl, 'moi_noi'));
    ok(ket(r.dl, 'khong_lo') === 'luu_y' && /2 tấm/.test(tin(r.dl, 'khong_lo')[0]), '2 đợt không có lỗ nào', tin(r.dl, 'khong_lo'));
    eq(ket(r.dl, 'lo_giao'), 'dat', 'không có lỗ giao nhau');

    console.log('— Lỗ khoan giao nhau: lỗi của lần vẽ');
    await page.evaluate(() => { window.__MOCK_LO_GIAO__ = true; });
    r = await ve(Object.assign({}, TU, { ma: 'DL3' }), 6000);
    await page.evaluate(() => { window.__MOCK_LO_GIAO__ = false; });
    ok(r.ok === false && ket(r.dl, 'lo_giao') === 'loi' && tin(r.dl, 'lo_giao').length === 1 && /Ø5/.test(tin(r.dl, 'lo_giao')[0]), 'có 1 cặp lỗ mồi Ø5 giao nhau: phiếu lỗi, lần vẽ không "ok"', [r.ok, tin(r.dl, 'lo_giao')]);
    ok(r.errors.some(t => /lỗ khoan giao nhau/i.test(t)), 'lỗi được nêu trong danh sách lỗi của lần vẽ', r.errors);

    console.log('— Nút "Dò lỗi sản xuất" ở thẻ Kết quả: không chọn gì = cả bản vẽ; có chọn = chỉ các tấm đang chọn');
    await H.locator('.launch').click();
    await H.locator('.tab[data-tab="kq"]').click();
    ok(await H.locator('[data-act="doloi"]').isVisible(), 'có nút dò lỗi');
    const tong = await page.evaluate(() => window.MNCFDriver.all().filter(window.MNCFDriver.isBoard).length);
    await H.locator('[data-act="doloi"]').click();
    await H.locator('[data-ui="doloi"] .msg').first().waitFor({ timeout: 10000 });
    let dong = await H.locator('[data-ui="doloi"] .msg').first().innerText();
    ok(new RegExp(`${tong} tấm`).test(dong) && /cả bản vẽ/.test(dong) && /có 1 mục lỗi/i.test(dong), 'dò cả bản vẽ: ghi số tấm, phạm vi, có lỗi (tủ thứ ba có lỗ giao nhau)', dong);
    ok((await H.locator('[data-ui="doloi"] .phieu li').count()) === 9 && (await H.locator('[data-ui="doloi"] .phieu li.loi').count()) === 1, 'phiếu 9 mục, 1 mục lỗi');
    ok(/Lỗ khoan không giao nhau/.test(await H.locator('[data-ui="doloi"] .phieu li.loi').textContent()), 'mục lỗi là lỗ giao nhau');
    ok((await H.locator('[data-ui="doloi"] .msg.err').count()) >= 2, 'dòng đỏ nêu chỗ lỗ giao nhau');
    // chọn các tấm của tủ đầu tiên (tủ đúng) → chỉ dò tủ đó: đạt
    const soChon = await page.evaluate(() => { const D = window.MNCFDriver, ds = D.all().filter(e => D.isBoard(e) && e.BoardProcessOption.cabinetName === 'DL'); window.__MOCK__.userSelect(ds); return ds.length; });
    await H.locator('[data-act="doloi"]').click();
    await page.waitForFunction(() => /tấm đang chọn/.test(document.getElementById('mncf-host').shadowRoot.querySelector('[data-ui="doloi"] .msg').textContent));
    dong = await H.locator('[data-ui="doloi"] .msg').first().innerText();
    ok(new RegExp(`${soChon} tấm`).test(dong) && /tấm đang chọn/.test(dong) && /không thấy lỗi/.test(dong), 'dò tấm đang chọn: tủ đúng thì không thấy lỗi', dong);
    ok((await H.locator('[data-ui="doloi"] .phieu li.loi').count()) === 0 && (await H.locator('[data-ui="doloi"] .phieu li.dat').count()) === 9, '9 mục đạt');
    await page.evaluate(() => window.__MOCK__.userSelect([]));

    console.log('— Vẽ bằng nút của bảng: thẻ Kết quả có phiếu dò lỗi sau khi vẽ');
    await page.evaluate(s => window.MNCF.app.setSpec(s), Object.assign({}, TU, { ma: 'DL4' }));
    await H.locator('.tab[data-tab="tu"]').click();
    if (!(await H.locator('#mncf-ui-ax').isVisible())) await H.locator('[data-act="nut-them"]').click();      // (bản 1.27) ô toạ độ nằm sau nút ⋯
    await H.locator('#mncf-ui-useat').check(); await H.locator('#mncf-ui-ax').fill('9000');
    await H.locator('[data-act="draw"]').click();
    await H.locator('.report [data-ui="phieu-ve"]').waitFor({ timeout: 30000 });
    const tomVe = await page.evaluate(() => document.getElementById('mncf-host').shadowRoot.querySelector('.report [data-ui="phieu-ve"]').textContent);
    ok(/không thấy lỗi|đạt/.test(tomVe) && /✓ 9 mục đạt/.test(tomVe), 'phiếu sau khi vẽ: 9 mục đạt (bản 1.28: gom một dòng)', tomVe.slice(0, 200));
    ok(/Tự kiểm trước khi vẽ/.test(await H.locator('.report').innerText()) || (await H.locator('.report [data-ui="phieu-tk"]').count()) === 1, 'thẻ Kết quả có cả phiếu thiết kế');

    console.log('— Kiểu khoan không có trong cấu hình: lần vẽ có lỗi sản xuất; chuyện "tấm không lỗ" không nêu hai lần');
    await page.evaluate(s => window.MNCF.app.setSpec(s), Object.assign({}, TU, { ma: 'KL', khoan: { thung: 'KieuLa' } }));
    await H.locator('.tab[data-tab="tu"]').click();
    await H.locator('#mncf-ui-useat').check(); await H.locator('#mncf-ui-ax').fill('21000');
    await H.locator('[data-act="draw"]').click();
    await page.waitForFunction(() => /KieuLa/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.report').textContent), null, { timeout: 30000 });
    const dongR = await H.locator('.report .msg').allInnerTexts();
    ok(/còn lỗi phải sửa trước khi sản xuất/.test(dongR[0]) && dongR.some(t => /Dò lỗi sản xuất — kiểu khoan không có trong cấu hình/.test(t) && /KieuLa/.test(t)), 'kiểu khoan lạ: báo cáo ghi rõ còn lỗi sản xuất', dongR.slice(0, 3));
    eq(dongR.filter(t => /chưa có lỗ khoan|có kiểu khoan mà không có lỗ nào/.test(t)).length, 1, 'chuyện "tấm không có lỗ" chỉ nêu một lần');
    ok(await H.locator('.report [data-ui="phieu-ve"]').evaluate(d => d.open), 'phiếu tự mở khi có mục lỗi / cần xem');
    await page.evaluate(s => window.MNCF.app.setSpec(s), Object.assign({}, TU, { ma: 'DL5' }));      // trả kiểu khoan về mặc định cho các phép thử sau

    console.log('— Người dùng sửa tay sau khi vẽ: hạ đợt mà chưa khoan lại; chép đè một tấm');
    r = await page.evaluate(() => {
      const D = window.MNCFDriver, M = window.__MOCK__, muc = (p, ma) => p.muc.find(m => m.ma === ma);
      const tu = D.all().filter(e => D.isBoard(e) && e.BoardProcessOption.cabinetName === 'DL'), dot = tu.find(b => b.Name === 'Đợt'), hoi = tu.find(b => b.Name === 'Hồi trái');
      dot.move([0, 0, -100]);                                   // hạ đợt 100 mm: tấm đi, lỗ cam cũ ở lại
      const p1 = D.doLoi(tu);
      dot.move([0, 0, 100]);                                    // trả về chỗ cũ
      const p2 = D.doLoi(tu);
      const chep = M.them(new M.Board(hoi.Name, hoi.BoardType, hoi.box.slice(), hoi.Thickness, 'DL', '', hoi.BoardProcessOption.highDrill));      // chép đè hồi trái lên chính nó
      const p3 = D.doLoi(tu.concat([chep]));
      chep.IsErase = true;
      return { lech: muc(p1, 'lo_lech'), sau: muc(p2, 'lo_lech').ket, trung: muc(p3, 'vc_that') };
    });
    ok(r.lech.ket === 'loi' && r.lech.tin.length === 1 && /8 lỗ khoan của “Đợt”/.test(r.lech.tin[0]), 'đợt bị hạ mà chưa khoan lại: 8 lỗ (chén + thân của 4 cam) nằm ngoài tấm, gán đúng cho đợt', r.lech);
    eq(r.sau, 'dat', 'trả đợt về chỗ cũ: hết lỗi');
    ok(r.trung.ket === 'loi' && r.trung.tin.length === 1 && /trùng khít/.test(r.trung.tin[0]) && /Hồi trái/.test(r.trung.tin[0]), 'tấm chép đè: báo trùng khít', r.trung);

    console.log('— Tủ khấu cột: tấm khoét góc không bị báo nhầm là đè lên vách / hậu khấu');
    const KC = { rong: 1600, cao: 2400, khau: { phai: { rong: 300, sau: 250 } }, khoang: [{ rong: 'auto', canh: 0, dot: [600, 1200] }, { rong: 'auto', canh: 0, dot: [700] }] };
    r = await ve(Object.assign({ ma: 'KC' }, KC), 12000);
    ok(r.ok && ket(r.dl, 'vc_that') === 'dat' && ket(r.dl, 'lo_lech') === 'dat' && ket(r.dl, 'lo_giao') === 'dat', 'tủ khấu cột bên phải: đọc đúng đường bao tấm khoét, không có va chạm giả', [r.ok, r.errors, tin(r.dl, 'vc_that'), tin(r.dl, 'lo_lech'), tin(r.dl, 'lo_giao')]);
    // đối chứng: Chenfeng dựng tấm chữ nhật (không khoét) → tấm nằm đâm vào vách / hậu khấu, phiếu phải bắt được
    await page.evaluate(() => { window.__MOCK_BO_KHOET__ = true; });
    r = await ve(Object.assign({ ma: 'KC2' }, KC), 15000);
    await page.evaluate(() => { window.__MOCK_BO_KHOET__ = false; });
    ok(r.ok === false && ket(r.dl, 'vc_that') === 'loi' && r.errors.some(t => /Dò lỗi sản xuất — tấm đè lên nhau/.test(t)), 'đối chứng — tấm không được khoét: va chạm thật, là lỗi của lần vẽ', [r.ok, r.errors, ket(r.dl, 'vc_that')]);

    // (Tủ vẽ bằng lệnh gốc Chenfeng — D.veGoc — cũng gọi phép dò này sau khi vẽ; trang giả lập không có lệnh gốc nên phần đó thử trên Chenfeng thật.)

    /* Bản 1.23 — đo trên Chenfeng thật 05/10/2026 (tủ khấu cột 76 tấm + 2 hộp ngăn kéo, vẽ theo cách nhập tấm rồi xoay theo tường): lệnh MODELING khoan lại các tấm được gom
     * (558 lỗ đổi thành đối tượng khác, 48 lỗ trong lòng hộp ngăn kéo giữ nguyên), lệnh ROTATE khoan lại mọi tấm được xoay. Bảng giữ danh sách lỗ cũ nên phiếu sau khi vẽ
     * báo oan "56 tấm có kiểu khoan mà không có lỗ nào" trong khi tủ đủ 606 lỗ. Danh sách đối tượng của tủ phải đọc lại sau các lệnh đó. */
    console.log('— Tủ có ngăn kéo gom thành module: lệnh MODELING khoan lại tấm (lỗ cũ bị bỏ) — phiếu sau khi vẽ dò trên lỗ đang có, không báo oan "không có lỗ"');
    const TU_NK = { ma: 'MD', rong: 1000, cao: 1200, than: { cao_duoi: 0 }, ve_goc: false, khoang: [{ rong: 'auto', canh: 0, dot: [600], o: [{ tu: 0, kieu: 'nk_am', so: 2 }] }, { rong: 'auto', canh: 0, dot: [700] }] };
    const veXem = (spec, opt) => page.evaluate(async ([s, o]) => {
      const D = window.MNCFDriver, r = await window.MNCF.draw(s, o), L = D.last, cua = L ? L.added : [];
      const tam = cua.filter(e => !e.IsErase && D.isBoard(e)), tamTu = tam.filter(e => D.tagOf(e));
      const loSong = D.all().filter(e => D.isHole(e) && !e.IsErase && (tam.includes(e.FId.Object) || tam.includes(e.MId.Object)));
      const lai = L ? D.doLoi(cua) : null;      // dò lại trên chính danh sách bảng giữ sau lần vẽ (kể cả sau khi xoay)
      return { ok: r.ok, gd: r.giai_doan, errors: r.errors, module: !!(r.module && r.module.ok), xoay: r.xoay_kq || null, dl: r.do_loi, lai, tam: tam.length, tam_tu: tamTu.length, tam_mau: tam.length - tamTu.length,
        da_bo: cua.filter(e => e.IsErase).length, lo_giu: cua.filter(e => D.isHole(e) && !e.IsErase).length, lo_song: loSong.length, lo_sot: loSong.filter(h => !cua.includes(h)).length, lo_hop: loSong.filter(h => !D.tagOf(h.FId.Object) && !D.tagOf(h.MId.Object)).length };
    }, [spec, opt]);
    r = await veXem(TU_NK, { at: [30000, 0, 0] });
    ok(r.ok && r.gd === 'xong' && r.module && r.tam_mau === 12, 'tủ 2 khoang có 2 ngăn kéo: vẽ xong, đã gom module, có 12 tấm của 2 hộp ngăn kéo', [r.ok, r.errors, r.module, r.tam_mau]);
    ok(r.lo_hop > 0 && r.lo_song > r.lo_hop, 'điều kiện của phép thử: hộp ngăn kéo có lỗ riêng (giữ nguyên qua MODELING), thùng tủ có lỗ của nó', [r.lo_hop, r.lo_song]);
    eq([ket(r.dl, 'khong_lo'), tin(r.dl, 'khong_lo')], ['dat', []], 'phiếu sau khi vẽ: không báo oan “tấm có kiểu khoan mà không có lỗ nào”');
    eq(['lo_lech', 'lo_giao', 'moi_noi'].map(m => ket(r.dl, m)), ['dat', 'dat', 'dat'], '… lỗ nằm đúng tấm, không giao nhau, mối nối đủ cam');
    eq([r.da_bo, r.lo_sot, r.lo_giu], [0, 0, r.lo_song], 'danh sách đối tượng bảng giữ sau lần vẽ: không còn lỗ đã bị bỏ, đủ mọi lỗ đang có của tủ');

    console.log('— Tủ đó xoay theo tường: lệnh ROTATE khoan lại mọi tấm — danh sách bảng giữ vẫn là lỗ đang có, dò lại vẫn đạt');
    r = await veXem(Object.assign({}, TU_NK, { ma: 'MD2' }), { corner: [36000, 0, 0], xoay: 90 });
    ok(r.ok && r.gd === 'xong' && r.module && r.xoay && r.xoay.ok, 'tủ vẽ xong, gom module, xoay 90° được', [r.ok, r.errors, r.module, r.xoay]);
    eq([r.da_bo, r.lo_sot, r.lo_giu], [0, 0, r.lo_song], 'sau khi xoay: danh sách bảng giữ không còn lỗ đã bị bỏ, đủ mọi lỗ đang có của tủ');
    eq(['khong_lo', 'lo_lech', 'lo_giao', 'moi_noi', 'vc_that'].map(m => ket(r.lai, m)), ['dat', 'dat', 'dat', 'dat', 'dat'], 'dò lại tủ đã xoay trên danh sách đó: 5 mục về tấm – lỗ đều đạt');

    ok(errs.length === 0, 'không lỗi JS lọt ra trang', errs);
  } catch (e) { fail++; console.log('  ✗ ném lỗi:', e && e.stack || e); }
  await ctx.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* bỏ qua */ }
  console.log(`\ndoloi.test: ${pass} đạt, ${fail} hỏng`);
  process.exit(fail ? 1 : 0);
})();
