'use strict';
// Bản 1.22 — TRỢ LÝ TRANG SẢN XUẤT (src/mncf-sx.js) trên trang giả lập tab "晨丰生产管理系统" (test/mock-sanxuat.html + test/mock-cutblock.html).
//   NODE_PATH=<node_modules có playwright> PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node test/sx.test.js
// Kiểm: báo trạng thái khi trang còn trắng, cứu trang trắng (lỗi tranh nhau Invoker / Receiver), tự 开始优化 → 停止优化 khi số tờ đứng yên → 确认新优化,
// nhường khi người dùng tự làm, không bấm nút nào khác, chỉ làm một lần mỗi trang, nhớ lựa chọn bật / tắt.
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const SX = path.join(__dirname, '..', 'src', 'mncf-sx.js');
const TOP = fs.readFileSync(path.join(__dirname, 'mock-sanxuat.html'), 'utf8'), CB = fs.readFileSync(path.join(__dirname, 'mock-cutblock.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) pass++; else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); } };
const eq = (a, b, name) => ok(JSON.stringify(a) === JSON.stringify(b), name, { co: a, can: b });
const ngu = ms => new Promise(k => setTimeout(k, ms));
const DUOC_BAM = ['开始优化', '停止优化', '确认新优化'];

(async () => {
  const br = await chromium.launch({ channel: 'chromium', headless: true });
  const may = { tre_pl: 300, loi_pl: false };                  // máy chủ giả: GetPlanOrder trả sau tre_pl ms; loi_pl = trả 500
  const errs = [], moiBam = [];
  const moCtx = async () => {
    const ctx = await br.newContext({ viewport: { width: 1200, height: 1000 } });
    await ctx.route('https://sc.leye.site/**', async r => {
      const u = new URL(r.request().url());
      if (u.pathname === '/modules/cut-block/index.html') return r.fulfill({ contentType: 'text/html; charset=utf-8', body: CB });
      if (u.pathname.startsWith('/api/v1/')) {
        if (u.pathname.endsWith('/GetPlanOrder')) { const m = Object.assign({}, may); await ngu(m.tre_pl); return r.fulfill({ status: m.loi_pl ? 500 : 200, contentType: 'application/json', body: '{}' }).catch(() => {}); }
        return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }).catch(() => {});
      }
      return r.fulfill({ contentType: 'text/html; charset=utf-8', body: TOP });
    });
    return ctx;
  };
  // mo(cấu hình trang giả, { tro_ly: false = không nạp trợ lý, dat: chỉnh ngưỡng của trợ lý, ls: giá trị localStorage mncf.sx.v1 đặt trước, ctx, hash })
  const mo = async (cfg, opt) => {
    opt = opt || {};
    const ctx = opt.ctx || await moCtx(), page = await ctx.newPage();
    page.on('pageerror', e => errs.push(String(e)));
    await page.addInitScript(c => { window.__MOCK_SX_CFG__ = c; }, cfg || {});
    if (opt.ls) await page.addInitScript(v => { try { if (window.top === window && !localStorage.getItem('mncf.sx.v1')) localStorage.setItem('mncf.sx.v1', JSON.stringify(v)); } catch (e) { /* bỏ qua */ } }, opt.ls);
    if (opt.tro_ly !== false) { await page.addInitScript({ path: SX }); await page.addInitScript(d => { if (window.MNCF_SX) window.MNCF_SX.dat(d); }, opt.dat || {}); }
    await page.goto('https://sc.leye.site/' + (opt.hash || '#/cadSingleAdd?stamp=1&type=single&fileName=x'));
    const T = { ctx, page, B: page.locator('#mncf-sx-host'),
      so: () => page.evaluate(() => { const s = window.__MOCK_SX__; return { bam: s.bam.slice(), xn: s.xac_nhan || null, goi: s.goi, t_chay: s.t_chay || 0, moc: s.moc }; }),
      tt: () => page.evaluate(() => window.MNCF_SX ? window.MNCF_SX.trang_thai() : null),
      choXong: (ms) => page.waitForFunction(() => window.__MOCK_SX__ && window.__MOCK_SX__.xac_nhan, null, { timeout: ms || 20000 }),
      choChu: (re, ms) => page.waitForFunction(s => { const t = window.MNCF_SX && window.MNCF_SX.trang_thai(); return !!t && new RegExp(s).test(t.chu); }, re.source, { timeout: ms || 10000 }),
      hop: () => page.frameLocator('iframe').locator('.el-dialog'),
      dong: async () => { try { const s = await T.so(); moiBam.push(...s.bam); } catch (e) { /* trang đã đóng */ } await page.close(); if (!opt.ctx) await ctx.close(); } };
    return T;
  };

  try {
    console.log('— Ngưỡng "đứng yên": 2,5 giây + 10 ms mỗi tấm, trần 12 giây');
    let T = await mo({ tam: 38 }, { hash: '#/order/list' });
    eq(await T.page.evaluate(() => [38, 228, 0, 5000].map(n => window.MNCF_SX.tinh.onDinh(n))), [2880, 4780, 2500, 12000], 'onDinh(38 / 228 / 0 / 5000 tấm)');
    eq(await T.page.evaluate(() => [38, 228, 1000].map(n => window.MNCF_SX.tinh.uocTinh(n))), [6, 15, 54], 'ước giây máy chủ tính: 4 + 0,05 × số tấm');

    console.log('— Tuyến khác của trang sản xuất: trợ lý nằm im');
    await ngu(1200);
    let tt = await T.tt();
    ok(tt.giai === 'nghi' && !(await T.B.locator('.sx').isVisible().catch(() => false)), 'không phải #/cadSingleAdd: không hiện bảng báo, không làm gì', tt);
    await T.dong();

    console.log('— Luồng thường (38 tấm): báo trạng thái → tự 开始优化 → dừng khi số tờ đứng yên → 确认新优化');
    may.tre_pl = 1500; may.loi_pl = false;
    T = await mo({ tam: 38 });
    await T.choChu(/đang tính 38 tấm/);
    ok(await T.B.locator('.sx').isVisible(), 'bảng báo hiện ngay khi trang còn trắng');
    let chu = await T.B.locator('.chu').innerText();
    ok(/Máy chủ Chenfeng đang tính 38 tấm/.test(chu) && /khoảng 6 giây/.test(chu), 'đang chờ máy chủ: nêu số tấm + ước giây', chu);
    await T.choXong();
    let s = await T.so(); tt = await T.tt();
    eq(s.bam.map(b => b.ten), DUOC_BAM, 'trợ lý bấm đúng 3 nút, đúng thứ tự');
    ok(s.bam.every(b => b.noi === 'hop' && b.tin === false), 'cả 3 lần bấm đều trong hộp 优化进度 (không đụng thanh công cụ)', s.bam);
    eq(s.xn.to, [19, 6, 2, 4], 'xác nhận với kết quả cuối (19 tờ), không phải kết quả đầu (20 tờ)');
    const dung = s.bam[1].luc - (s.t_chay + 700);                          // 700 ms = lúc số tờ đổi lần cuối trong lịch "nhanh"
    ok(dung >= 2880 - 300 && dung <= 2880 + 900, 'chỉ bấm 停止优化 sau khi số tờ đứng yên đủ ~2,9 giây (38 tấm)', { dung, t_chay: s.t_chay, bam: s.bam });
    await T.choChu(/Xong/);
    chu = await T.B.locator('.chu').innerText();
    ok(/Xong/.test(chu) && /31 tờ/.test(chu) && /MDF 103T 17\.5: 19 tờ/.test(chu) && /Acrylic LUX279PRL 17\.5: 4 tờ/.test(chu), 'báo xong: tổng số tờ + từng loại ván', chu);
    ok(/chưa lưu/i.test(chu) && /保存优化/.test(chu), 'nhắc rằng chưa lưu gì', chu);
    tt = await T.tt();
    ok(tt.so_tam === 38 && tt.cuu === 0, 'không phải cứu trang lần nào', tt);
    ok(['cho_dl', 'tinh', 'dem', 'chay', 'xong'].every(k => tt.nhat_ky.some(n => n[0] === k)), 'nhật ký đi đủ các bước', tt.nhat_ky.map(n => n[0]));
    ok(await T.hop().isHidden() && await T.page.frameLocator('iframe').locator('canvas').isVisible(), 'hộp tối ưu đã đóng, sơ đồ hiện');
    eq(await T.page.frames()[1].evaluate(() => typeof window.MNCF_SX), 'undefined', 'trợ lý không chạy trong khung con');

    console.log('— Chỉ làm một lần mỗi trang: người dùng mở lại hộp tối ưu thì trợ lý không bấm nữa');
    await T.page.frameLocator('iframe').locator('.thanh button', { hasText: '继续优化' }).click();
    await T.hop().waitFor({ state: 'visible', timeout: 5000 });
    await ngu(3500);
    s = await T.so();
    eq(s.bam.map(b => [b.ten, b.tin]), [['开始优化', false], ['停止优化', false], ['确认新优化', false], ['继续优化', true]], 'mở lại hộp: không có lần bấm tự động nào thêm');
    await T.dong();

    console.log('— Trang trắng do lỗi tranh nhau (initFinish tới sau sự kiện load của khung)');
    may.tre_pl = 300;
    T = await mo({ kieu: 'trang' }, { tro_ly: false });
    await ngu(3000);
    s = await T.so();
    ok(s.goi.invokeUpdate === 1 && s.goi.initFinish === 1 && (await T.page.frameLocator('iframe').locator('.el-dialog').count()) === 0, 'đối chứng — không có trợ lý: lần đẩy duy nhất bị nuốt, khung trắng mãi', [s.goi, s.moc]);
    await T.dong();
    T = await mo({ kieu: 'trang' });
    await T.choXong();
    s = await T.so(); tt = await T.tt();
    ok(s.goi.invokeUpdate >= 2 && tt.cuu >= 1, 'có trợ lý: gọi lại invokeUpdate → bảng tối ưu hiện', [s.goi, tt.cuu]);
    ok(tt.nhat_ky.some(n => n[0] === 'cuu' && /trắng/.test(n[1])), 'bảng báo có nói đã cứu trang trắng', tt.nhat_ky);
    eq([s.bam.map(b => b.ten), s.xn.to], [DUOC_BAM, [19, 6, 2, 4]], 'cứu xong thì tối ưu như thường');
    await T.dong();

    console.log('— Máy chủ Chenfeng lỗi sau GetPlanOrder: báo đóng tab, xuất lại, đừng F5');
    may.loi_pl = true;
    T = await mo({});
    await T.choChu(/không mở được bảng tối ưu/, 12000);
    chu = await T.B.locator('.chu').innerText();
    ok(/Đóng tab này/.test(chu) && /Xuất ván lại/.test(chu) && /F5/.test(chu) && (await T.B.locator('.chu.err').count()) === 1, 'dòng đỏ: đóng tab, bấm Xuất ván lại, đừng F5', chu);
    eq((await T.so()).bam, [], 'không bấm gì');
    await T.dong();
    may.loi_pl = false;
    T = await mo({ kieu: 'loi_may_chu', loi_chu: '拆单数据异常,请联系管理员', loi_ms: 1500 });      // máy chủ trả 200 nhưng trang hiện thông báo đỏ (1,5 giây), báo lỗi (Account/Reporting) rồi đứng trắng
    await T.choChu(/không mở được bảng tối ưu/, 12000);
    ok(true, 'trang báo lỗi về máy chủ (Account/Reporting) mà không hiện bảng: cũng báo');
    await ngu(1800);                                                         // thông báo đỏ của trang đã tự mất
    chu = await T.B.locator('.chu').innerText();
    ok((await T.page.locator('.el-notification').count()) === 0 && /拆单数据异常,请联系管理员/.test(chu) && /Trang báo/.test(chu), 'bảng báo giữ lại nguyên văn dòng lỗi của trang (dòng đó chỉ hiện vài giây)', chu);
    await T.dong();

    console.log('— Tab bị tải lại (F5): không còn dữ liệu tấm');
    T = await mo({ co_dl: false }, { dat: { han_dl: 1200 } });
    await T.choChu(/chưa nhận được dữ liệu tấm/, 8000);
    chu = await T.B.locator('.chu').innerText();
    ok(/F5/.test(chu) && /Xuất ván lại/.test(chu) && (await T.B.locator('.chu.warn').count()) === 1, 'báo: tab không còn dữ liệu, đóng tab rồi xuất lại', chu);
    await T.dong();

    console.log('— Tắt tự tối ưu: không bấm gì, nhắc 3 nút; bật lại tại chỗ thì chạy; lựa chọn được nhớ');
    const ctxNho = await moCtx();
    T = await mo({}, { ls: { tu_dong: false }, ctx: ctxNho });
    await T.hop().waitFor({ state: 'visible', timeout: 10000 });
    await ngu(2500);
    eq((await T.so()).bam, [], 'tự tối ưu tắt: không bấm gì');
    chu = await T.B.locator('.chu').innerText();
    ok(/开始优化/.test(chu) && /停止优化/.test(chu) && /确认新优化/.test(chu), 'nhắc 3 nút phải bấm tay', chu);
    ok(!(await T.B.locator('[data-ui="tu-dong"]').isChecked()), 'ô "Tự tối ưu" đang bỏ chọn');
    await T.B.locator('[data-ui="tu-dong"]').check();
    await T.choXong();
    eq((await T.so()).bam.map(b => b.ten), DUOC_BAM, 'bật lại tại chỗ: trợ lý chạy tối ưu');
    eq(await T.page.evaluate(() => JSON.parse(localStorage.getItem('mncf.sx.v1')).tu_dong), true, 'lựa chọn bật được ghi vào localStorage mncf.sx.v1');
    await T.B.locator('[data-ui="tu-dong"]').uncheck();
    eq(await T.page.evaluate(() => JSON.parse(localStorage.getItem('mncf.sx.v1')).tu_dong), false, 'bỏ chọn cũng được ghi');
    await T.dong();
    T = await mo({}, { ctx: ctxNho });                                       // lần mở trang sau (cùng hồ sơ trình duyệt): vẫn tắt
    await T.hop().waitFor({ state: 'visible', timeout: 10000 });
    await ngu(2500);
    eq([(await T.so()).bam, (await T.tt()).tu_dong], [[], false], 'lần sau mở trang: vẫn tắt như đã chọn');
    await T.dong(); await ctxNho.close();

    console.log('— Người dùng tự làm: bấm trong hộp lúc trợ lý đang đếm → trợ lý thôi');
    T = await mo({}, { dat: { dem: 2000 } });
    await T.hop().waitFor({ state: 'visible', timeout: 10000 });
    await T.page.frameLocator('iframe').locator('.el-checkbox', { hasText: '使用王者优化' }).click();
    await ngu(3500);
    s = await T.so(); tt = await T.tt();
    ok(s.bam.length === 0 && tt.tu === 'thoi' && /tự làm/.test(tt.chu), 'người dùng đụng vào hộp: trợ lý không bấm gì nữa', [s.bam, tt.tu, tt.chu]);
    await T.dong();
    T = await mo({}, { dat: { dem: 2500 } });
    await T.B.locator('[data-act="tu-lam"]').click({ timeout: 10000 });
    await ngu(3500);
    s = await T.so(); tt = await T.tt();
    ok(s.bam.length === 0 && tt.tu === 'thoi', 'nút "Để tôi tự làm": trợ lý không bấm gì', [s.bam, tt.tu]);
    ok((await T.B.locator('[data-act="tu-lam"]').count()) === 0 || !(await T.B.locator('[data-act="tu-lam"]').isVisible()), 'nút đó biến mất sau khi bấm');
    await T.dong();
    T = await mo({});
    await T.page.waitForFunction(() => window.__MOCK_SX__.bam.length === 1, null, { timeout: 10000 });
    await ngu(300);
    await T.page.frameLocator('iframe').locator('.el-dialog button', { hasText: '停止优化' }).click();      // người dùng tự bấm dừng khi trợ lý đang chờ
    await ngu(4000);
    s = await T.so();
    eq(s.bam.map(b => [b.ten, b.tin]), [['开始优化', false], ['停止优化', true]], 'người dùng tự bấm 停止优化: trợ lý không bấm 确认 hộ');
    await T.dong();

    console.log('— Đơn lớn, kết quả về dần: chỉ dừng khi MỌI vật liệu có kết quả và số tờ đứng yên');
    T = await mo({ tam: 800, toi_uu: 'cham' }, { dat: { on_dinh_goc: 900, on_dinh_moi_tam: 0 } });
    await T.choXong();
    s = await T.so();
    eq(s.xn.to, [60, 6, 2, 4], 'chờ tới kết quả cuối (62 → 61 → 60 tờ) mới xác nhận');
    ok(s.bam[1].luc - (s.t_chay + 2100) >= 900 - 300, 'dừng sau lần đổi cuối ít nhất ~0,9 giây', [s.bam[1].luc, s.t_chay]);
    await T.dong();

    console.log('— Có vật liệu không ra kết quả: không dừng hộ, không xác nhận hộ, báo cho người dùng');
    T = await mo({ toi_uu: 'khong_ra' }, { dat: { han_chay: 2500 } });
    await T.choChu(/chưa ra kết quả/, 12000);
    s = await T.so(); tt = await T.tt();
    eq([s.bam.map(b => b.ten), s.xn, tt.tu], [['开始优化'], null, 'thoi'], 'chỉ có lần bấm 开始优化; tối ưu vẫn đang chạy cho người dùng tự xử lý');
    ok(await T.page.frameLocator('iframe').locator('.el-dialog button', { hasText: '停止优化' }).isVisible() && (await T.B.locator('.chu.warn').count()) === 1, 'hộp vẫn ở trạng thái đang chạy, bảng báo màu vàng');
    await T.dong();

    console.log('— Lần bấm đầu bị nuốt (tab vừa mở chưa có tiêu điểm): bấm lại');
    T = await mo({ nuot_bam_dau: true });
    await T.choXong();
    s = await T.so();
    eq([s.bam.map(b => b.ten), s.xn.to], [['开始优化', '开始优化', '停止优化', '确认新优化'], [19, 6, 2, 4]], 'bấm 开始优化 lần nữa rồi làm tiếp như thường');
    await T.dong();

    console.log('— Đóng bảng báo (×): việc tự tối ưu vẫn chạy tiếp');
    may.tre_pl = 1200;
    T = await mo({});
    await T.B.locator('[data-act="dong"]').click({ timeout: 5000 });
    ok(!(await T.B.locator('.sx').isVisible()), 'bảng báo ẩn');
    await T.choXong();
    eq((await T.so()).bam.map(b => b.ten), DUOC_BAM, 'vẫn tối ưu xong');
    ok(!(await T.B.locator('.sx').isVisible()), 'bảng báo không tự hiện lại');
    await T.dong();

    const la = moiBam.filter(b => !b.tin && DUOC_BAM.indexOf(b.ten) < 0);
    eq(la, [], 'qua mọi tình huống: trợ lý không bấm nút nào ngoài 开始优化 / 停止优化 / 确认新优化 (không 保存, 导出NC, 一键NC, 打印标签, 取消优化…)');
    ok(moiBam.filter(b => !b.tin).every(b => b.noi === 'hop'), 'mọi lần bấm tự động đều nằm trong hộp 优化进度');
    ok(errs.length === 0, 'không lỗi JS lọt ra trang', errs);
  } catch (e) { fail++; console.log('  ✗ ném lỗi:', e && e.stack || e); }
  await br.close();

  // Cả chuỗi qua TIỆN ÍCH THẬT (dist/extension): bộ nạp chạy ở sc.leye.site từ đầu trang, nạp bản gộp của trợ lý, trợ lý làm trọn việc trên trang giả lập.
  console.log('— Qua tiện ích thật: bộ nạp + bản gộp trợ lý trên trang sản xuất giả lập');
  const os = require('os'), EXT = path.join(__dirname, '..', 'dist', 'extension');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mncf-sx-'));
  const ctx = await chromium.launchPersistentContext(dir, { channel: 'chromium', headless: true, viewport: { width: 1200, height: 1000 }, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  try {
    await require('./kho-gia.js')(ctx);                                      // kho GitHub giả = dist/ vừa dựng
    await ctx.route('https://sc.leye.site/**', async r => {
      const u = new URL(r.request().url());
      if (u.pathname === '/modules/cut-block/index.html') return r.fulfill({ contentType: 'text/html; charset=utf-8', body: CB });
      if (u.pathname.startsWith('/api/v1/')) { if (u.pathname.endsWith('/GetPlanOrder')) await ngu(600); return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }).catch(() => {}); }
      return r.fulfill({ contentType: 'text/html; charset=utf-8', body: TOP });
    });
    const page = await ctx.newPage(); const loi = []; page.on('pageerror', e => loi.push(String(e)));
    await page.addInitScript(() => { window.__MOCK_SX_CFG__ = { tam: 228, kieu: 'trang' }; });      // 228 tấm + trang trắng do lỗi tranh nhau
    await page.goto('https://sc.leye.site/#/cadSingleAdd?stamp=1&type=single&fileName=x');
    await page.waitForFunction(() => window.__MOCK_SX__ && window.__MOCK_SX__.xac_nhan, null, { timeout: 30000 });
    const man = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
    const r = await page.evaluate(() => ({ v: window.MNCF_SX.version, nap: window.__MNCF_NAP__ && { nguon: window.__MNCF_NAP__.nguon, ban: window.__MNCF_NAP__.ban_nap }, bang: typeof window.MNCF, tt: window.MNCF_SX.trang_thai(), bam: window.__MOCK_SX__.bam.map(b => b.ten), xn: window.__MOCK_SX__.xac_nhan.to }));
    ok(r.v === man.version && r.nap && r.nap.ban === 2 && r.bang === 'undefined', 'tiện ích nạp trợ lý đúng phiên bản manifest vào trang sản xuất (không nạp bảng vẽ tủ)', r);
    eq([r.bam, r.xn], [DUOC_BAM, [19, 6, 2, 4]], 'trợ lý bản gộp: cứu trang trắng rồi tối ưu trọn lượt');
    ok(r.tt.so_tam === 228 && r.tt.cuu >= 1, 'đọc được số tấm từ tin nhắn của trang (nạp kịp từ đầu trang) + có cứu trang', [r.tt.so_tam, r.tt.cuu]);
    await page.waitForFunction(() => /Xong/.test(window.MNCF_SX.trang_thai().chu), null, { timeout: 10000 });
    ok(await page.locator('#mncf-sx-host .sx').isVisible() && /31 tờ/.test(await page.locator('#mncf-sx-host .chu').innerText()), 'bảng báo hiện kết quả');
    ok(loi.length === 0, 'không lỗi JS lọt ra trang (qua tiện ích)', loi);
  } catch (e) { fail++; console.log('  ✗ ném lỗi:', e && e.stack || e); }
  await ctx.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* bỏ qua */ }
  console.log(`\nsx.test: ${pass} đạt, ${fail} hỏng`);
  process.exit(fail ? 1 : 0);
})();
