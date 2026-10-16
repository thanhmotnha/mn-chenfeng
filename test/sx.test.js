'use strict';
// Bản 1.22 — TRỢ LÝ TRANG SẢN XUẤT (src/mncf-sx.js) trên trang giả lập tab "晨丰生产管理系统" (test/mock-sanxuat.html + test/mock-cutblock.html).
//   NODE_PATH=<node_modules có playwright> PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node test/sx.test.js
// Kiểm: báo trạng thái khi trang còn trắng, cứu trang trắng (lỗi tranh nhau Invoker / Receiver), tự 开始优化 → 停止优化 khi số tờ đứng yên → 确认新优化,
// nhường khi người dùng tự làm, không bấm nút nào khác, chỉ làm một lần mỗi trang, nhớ lựa chọn bật / tắt; Tiếng Việt cho nút / nhãn (1.36.4, chỉ hiển thị).
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
  const may = { tre_pl: 300, loi_pl: false, tre_cb: 0 };       // máy chủ giả: GetPlanOrder trả sau tre_pl ms; loi_pl = trả 500; tre_cb = khung cut-block tải chậm ngần ấy ms
  const errs = [], moiBam = [];
  const moCtx = async () => {
    const ctx = await br.newContext({ viewport: { width: 1200, height: 1000 } });
    await ctx.route('https://sc.leye.site/**', async r => {
      const u = new URL(r.request().url());
      if (u.pathname === '/modules/cut-block/index.html') { if (may.tre_cb) await ngu(may.tre_cb); return r.fulfill({ contentType: 'text/html; charset=utf-8', body: CB }).catch(() => {}); }
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
    const tHop = (s.moc.find(m => /→ dựng/.test(m[1])) || [0])[0];           // lúc hộp tối ưu hiện
    ok(s.bam[0].luc - tHop >= 1400 && s.bam[0].luc - tHop <= 2700, 'hộp hiện rồi đếm ~1,5 giây mới bấm 开始优化 (kịp cho người dùng ngăn lại)', [tHop, s.bam[0].luc]);
    eq(s.xn.to, [19, 6, 2, 4], 'xác nhận với kết quả cuối (19 tờ), không phải kết quả đầu (20 tờ)');
    const dung = s.bam[1].luc - (s.t_chay + 700);                          // 700 ms = lúc số tờ đổi lần cuối trong lịch "nhanh"
    ok(dung >= 2880 - 300 && dung <= 2880 + 900, 'chỉ bấm 停止优化 sau khi số tờ đứng yên đủ ~2,9 giây (38 tấm)', { dung, t_chay: s.t_chay, bam: s.bam });
    await T.choChu(/Xong/);
    chu = await T.B.locator('.chu').innerText();
    ok(/Xong/.test(chu) && /31 tờ/.test(chu) && /MDF 103T 17\.5: 19 tờ/.test(chu) && /Acrylic LUX279PRL 17\.5: 4 tờ/.test(chu), 'báo xong: tổng số tờ + từng loại ván', chu);
    ok(/chưa lưu/i.test(chu) && /保存优化/.test(chu), 'nhắc rằng chưa lưu gì', chu);
    // (soát 1.36.4) Tiếng Việt bật (mặc định): nút trên trang hiện chữ Việt → lời báo gọi nút bằng chữ Việt kèm chữ gốc, người dùng tìm được nút được nhắc
    ok(/Lưu tối ưu \(保存优化\)/.test(chu) && /NC một chạm \(一键NC\)/.test(chu) && /In nhãn \(打印标签\)/.test(chu), 'Tiếng Việt bật: lời báo nêu chữ Việt của nút kèm chữ gốc', chu);
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
    ok(/máy chủ báo lỗi/.test(chu), 'máy chủ trả mã lỗi (HTTP 500): nói rõ là máy chủ báo lỗi', chu);
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

    console.log('— Trợ lý nạp trễ (sau khi trang đã nhận dữ liệu tấm): vẫn biết số tấm, vẫn làm trọn việc');
    may.tre_pl = 2500;
    T = await mo({ tam: 74 }, { tro_ly: false });
    await T.page.waitForFunction(() => window.__MOCK_SX__.moc.some(m => m[1] === 'nhận webCadData'), null, { timeout: 5000 });
    await T.page.addScriptTag({ path: SX });                                 // như khi bộ nạp tới sau tin nhắn của khung nhỏ
    await T.choChu(/đang tính 74 tấm/, 3000);
    ok(true, 'lỡ tin nhắn dữ liệu: đọc số tấm ở thành phần của trang');
    await T.choXong();
    eq((await T.so()).bam.map(b => b.ten), DUOC_BAM, 'nạp trễ vẫn tối ưu trọn lượt');
    await T.dong();
    may.tre_pl = 300;
    T = await mo({ tam: 74 }, { tro_ly: false });                            // nạp khi hộp tối ưu đã hiện sẵn (như lúc thử trên trang thật)
    await T.hop().waitFor({ state: 'visible', timeout: 10000 });
    await T.page.addScriptTag({ path: SX });
    await T.choXong();
    eq((await T.so()).bam.map(b => b.ten), DUOC_BAM, 'nạp khi hộp tối ưu đã hiện: làm ngay');
    await T.dong();

    console.log('— Tab bị tải lại (F5): không còn dữ liệu tấm');
    T = await mo({ co_dl: false }, { dat: { han_dl: 1200 } });
    await T.choChu(/chưa nhận được dữ liệu tấm/, 8000);
    chu = await T.B.locator('.chu').innerText();
    ok(/F5/.test(chu) && /Xuất ván lại/.test(chu) && (await T.B.locator('.chu.warn').count()) === 1, 'báo: tab không còn dữ liệu, đóng tab rồi xuất lại', chu);
    await T.dong();

    console.log('— Tin "webCadData" từ khung nguồn khác: không tính là dữ liệu tấm');
    T = await mo({ co_dl: false }, { dat: { han_dl: 60000 } });
    await T.ctx.route('https://la.example/**', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><script>parent.postMessage({ command: "webCadData", content: { webCadData: { cadData: { blockList: new Array(999).fill(0) } }, roomList: [] } }, "*")</script>' }));
    await T.page.evaluate(() => { const f = document.createElement('iframe'); f.src = 'https://la.example/gui.html'; f.style.display = 'none'; document.body.appendChild(f); });
    await ngu(2500);
    tt = await T.tt();
    ok(tt.khoa === 'cho_dl' && tt.so_tam === 0, 'vẫn đang chờ dữ liệu tấm, không nhận số tấm của tin lạ', [tt.khoa, tt.so_tam, tt.chu]);
    await T.dong();

    console.log('— Tắt tự tối ưu: không bấm gì, nhắc 3 nút; bật lại tại chỗ thì chạy; lựa chọn được nhớ');
    const ctxNho = await moCtx();
    T = await mo({}, { ls: { tu_dong: false }, ctx: ctxNho });
    await T.hop().waitFor({ state: 'visible', timeout: 10000 });
    await ngu(2500);
    eq((await T.so()).bam, [], 'tự tối ưu tắt: không bấm gì');
    chu = await T.B.locator('.chu').innerText();
    ok(/开始优化/.test(chu) && /停止优化/.test(chu) && /确认新优化/.test(chu), 'nhắc 3 nút phải bấm tay', chu);
    ok(/Bắt đầu tối ưu \(开始优化\)/.test(chu) && /Dừng tối ưu \(停止优化\)/.test(chu) && /Xác nhận tối ưu mới \(确认新优化\)/.test(chu), 'Tiếng Việt bật: nhắc 3 nút bằng chữ Việt kèm chữ gốc', chu);
    ok(!(await T.B.locator('[data-ui="tu-dong"]').isChecked()), 'ô "Tự tối ưu" đang bỏ chọn');
    ok(!(await T.tt()).nhat_ky.some(n => n[0] === 'dem'), 'đang tắt: bảng báo không hề nháy dòng đếm ngược', (await T.tt()).nhat_ky.map(n => n[0]));
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
    T = await mo({ tre_day: 3000 }, { dat: { dem: 2000, cho_cuu: 60000 } });  // người dùng bấm vào hộp TRƯỚC khi trợ lý kịp thấy hộp (nhịp dò thưa, như lúc tab bị trình duyệt hãm): vẫn phải nhường
    await T.page.waitForFunction(() => window.__MOCK_SX__.moc.some(m => m[1] === 'initFinish'), null, { timeout: 10000 });
    await ngu(700);                                                          // trợ lý đã dò qua khung cut-block; hộp tối ưu còn 2 giây nữa mới hiện
    await T.page.evaluate(() => window.MNCF_SX.dat({ nhip: 4000 }));
    await T.hop().waitFor({ state: 'visible', timeout: 10000 });
    await T.page.frameLocator('iframe').locator('.el-checkbox', { hasText: '使用王者优化' }).click();
    tt = await T.tt();
    ok(tt.tu === 'cho', 'lúc người dùng bấm, trợ lý còn chưa thấy hộp tối ưu', tt.tu);
    await ngu(9000);
    s = await T.so(); tt = await T.tt();
    ok(s.bam.length === 0 && tt.tu === 'thoi' && /tự làm/.test(tt.chu), 'bấm vào hộp trước khi trợ lý kịp thấy hộp: trợ lý vẫn nhường', [s.bam, tt.tu, tt.chu]);
    ok(!tt.nhat_ky.some(n => n[0] === 'dem'), 'nhường ngay, không hiện dòng "trợ lý bấm 开始优化 sau…" rồi mới thôi', tt.nhat_ky.map(n => n[0]));
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

    T = await mo({}, { tro_ly: false });                                     // trợ lý tới sau khi người dùng đã tự bấm 开始优化 (tối ưu đang chạy): không đếm, không bấm chồng lên
    await T.hop().waitFor({ state: 'visible', timeout: 10000 });
    await T.page.frameLocator('iframe').locator('.el-dialog button', { hasText: '开始优化' }).click();
    await T.page.addScriptTag({ path: SX });
    await ngu(1000);
    tt = await T.tt();
    ok(tt.tu === 'thoi' && /tự làm/.test(tt.chu), 'thấy hộp tối ưu đang chạy sẵn: coi như người dùng đang tự làm', [tt.tu, tt.chu]);
    await ngu(4000);
    eq((await T.so()).bam.map(b => [b.ten, b.tin]), [['开始优化', true]], 'không dừng hộ, không bấm gì');
    await T.dong();

    console.log('— Đơn lớn, kết quả về dần: chỉ dừng khi MỌI vật liệu có kết quả và số tờ đứng yên');
    T = await mo({ tam: 800, toi_uu: 'cham' }, { dat: { on_dinh_goc: 900, on_dinh_moi_tam: 0 } });
    await T.choXong();
    s = await T.so();
    eq(s.xn.to, [60, 6, 2, 4], 'chờ tới kết quả cuối (62 → 61 → 60 tờ) mới xác nhận');
    ok(s.bam[1].luc - (s.t_chay + 2100) >= 900 - 300, 'dừng sau lần đổi cuối ít nhất ~0,9 giây', [s.bam[1].luc, s.t_chay]);
    await T.dong();

    console.log('— Có vật liệu không ra kết quả: không dừng hộ, không xác nhận hộ, báo cho người dùng');
    T = await mo({ toi_uu: 'khong_ra' }, { dat: { han_chay: 2500, on_dinh_goc: 600, on_dinh_moi_tam: 0 } });      // số tờ đứng yên từ 0,1 giây, ngưỡng đứng yên 0,6 giây: vẫn KHÔNG được dừng vì còn một vật liệu 0 tờ
    await T.choChu(/chưa ra kết quả/, 12000);
    s = await T.so(); tt = await T.tt();
    eq([s.bam.map(b => b.ten), s.xn, tt.tu], [['开始优化'], null, 'thoi'], 'chỉ có lần bấm 开始优化; tối ưu vẫn đang chạy cho người dùng tự xử lý');
    ok(await T.page.frameLocator('iframe').locator('.el-dialog button', { hasText: '停止优化' }).isVisible() && (await T.B.locator('.chu.warn').count()) === 1, 'hộp vẫn ở trạng thái đang chạy, bảng báo màu vàng');
    await T.dong();

    console.log('— Tối ưu tự dừng mà không ai bấm: đủ kết quả thì xác nhận luôn (không bấm chạy lại), thiếu thì để người dùng xem');
    T = await mo({ tu_xong: 1500 });
    await T.choXong();
    s = await T.so();
    eq([s.bam.map(b => b.ten), s.xn.to], [['开始优化', '确认新优化'], [19, 6, 2, 4]], 'tự dừng khi đã đủ kết quả: trợ lý xác nhận, không bấm 开始优化 lần nữa, không bấm 停止优化');
    await T.choChu(/Xong/);
    await T.dong();
    T = await mo({ toi_uu: 'khong_ra', tu_xong: 1500 });
    await T.choChu(/tự dừng/, 12000);
    await ngu(3000);
    s = await T.so(); tt = await T.tt();
    eq([s.bam.map(b => b.ten), s.xn, tt.tu, tt.ly], [['开始优化'], null, 'thoi', 'tu_dung'], 'tự dừng khi còn vật liệu chưa ra kết quả: không chạy lại, không xác nhận hộ');
    ok((await T.B.locator('.chu.warn').count()) === 1 && /chưa ra kết quả/.test(tt.chu), 'bảng báo vàng nêu rõ', tt.chu);
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

    console.log('— Thu gọn bảng báo: nút "–" thành viên nhỏ; xong một lúc thì tự thu, bấm viên thì mở lại và ở yên');
    may.tre_pl = 300;
    T = await mo({}, { dat: { thu_gon: 1500 } });
    await T.B.locator('[data-act="gon"]').click({ timeout: 5000 });
    ok(!(await T.B.locator('.sx').isVisible()) && await T.B.locator('.vien').isVisible(), 'nút "–": bảng báo thu thành viên nhỏ');
    await T.B.locator('.vien').click();
    ok(await T.B.locator('.sx').isVisible() && !(await T.B.locator('.vien').isVisible()), 'bấm viên: bảng báo mở lại');
    await T.choChu(/Xong/, 20000);
    ok(await T.B.locator('.sx').isVisible(), 'vừa xong: bảng báo còn hiện kết quả');
    await T.B.locator('.vien').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    ok(!(await T.B.locator('.sx').isVisible()) && /✓ 31 tờ/.test(await T.B.locator('.vien').innerText().catch(() => '')), 'xong được một lúc: tự thu thành viên ghi số tờ, khỏi che sơ đồ');
    await T.B.locator('.vien').click().catch(() => {});
    await ngu(2500);
    ok(await T.B.locator('.sx').isVisible(), 'người dùng mở lại thì bảng báo ở yên, không tự thu lần nữa');
    await T.dong();

    console.log('— Hộp tối ưu bị đóng giữa chừng (không phải do bấm trong hộp): trợ lý thôi, hộp mở lại cũng không bấm tiếp');
    const anHop = (X, an) => X.page.frames()[1].evaluate(a => { document.querySelector('.el-dialog__wrapper').style.display = a ? 'none' : ''; }, an);
    T = await mo({}, { dat: { dem: 2500 } });
    await T.choChu(/trợ lý bấm Bắt đầu tối ưu \(开始优化\) sau/, 10000);
    await anHop(T, true); await ngu(700);
    tt = await T.tt();
    ok(tt.tu === 'thoi' && tt.ly === 'hop_dong', 'hộp đóng lúc trợ lý đang đếm: trợ lý thôi', [tt.tu, tt.ly]);
    await anHop(T, false); await ngu(3500);
    eq((await T.so()).bam, [], 'hộp mở lại: trợ lý không bấm gì');
    ok(/bằng tay/.test((await T.tt()).chu), 'bảng báo nhắc làm tiếp bằng tay', (await T.tt()).chu);
    await T.dong();
    T = await mo({});
    await T.page.waitForFunction(() => window.__MOCK_SX__.bam.length === 1, null, { timeout: 10000 });
    await anHop(T, true); await ngu(700);
    tt = await T.tt();
    ok(tt.tu === 'thoi' && tt.ly === 'hop_dong', 'hộp đóng lúc tối ưu đang chạy: trợ lý thôi', [tt.tu, tt.ly]);
    await anHop(T, false); await ngu(4500);
    eq((await T.so()).bam.map(b => b.ten), ['开始优化'], 'hộp mở lại: không dừng hộ, không xác nhận hộ');
    await T.dong();

    console.log('— Bỏ chọn "Tự tối ưu" lúc trợ lý đang đếm: không bấm nữa');
    T = await mo({}, { dat: { dem: 2500 } });
    await T.choChu(/trợ lý bấm Bắt đầu tối ưu \(开始优化\) sau/, 10000);
    await T.B.locator('[data-ui="tu-dong"]').uncheck();
    await ngu(3500);
    s = await T.so(); tt = await T.tt();
    ok(s.bam.length === 0 && tt.tu === 'tay' && /đang tắt/.test(tt.chu), 'tắt giữa lúc đếm: trợ lý dừng đếm, nhắc bấm tay', [s.bam, tt.tu, tt.chu]);
    await T.dong();

    console.log('— Bấm 开始优化 mãi mà trang không chạy: thôi sau 3 lần, nhờ người dùng bấm tay');
    T = await mo({ nuot_bam_dau: 99 });
    await T.choChu(/trang không chạy/, 15000);
    await ngu(3000);
    s = await T.so(); tt = await T.tt();
    eq([s.bam.map(b => b.ten), tt.tu, tt.ly], [['开始优化', '开始优化', '开始优化'], 'thoi', 'khong_chay'], 'bấm đúng 3 lần rồi thôi');
    ok((await T.B.locator('.chu.warn').count()) === 1 && /bấm tay/.test(tt.chu), 'bảng báo vàng: nhờ bấm tay', tt.chu);
    await T.dong();

    console.log('— Khung kẹt trắng hẳn (gọi lại cũng không dựng): gọi lại có giới hạn rồi báo, không gọi mãi');
    T = await mo({ kieu: 'trang_mai' }, { dat: { han_bang: 2500, cuu_cach: 300 } });
    await T.choChu(/không mở được bảng tối ưu/, 12000);
    await ngu(3000);
    s = await T.so(); tt = await T.tt();
    ok(tt.cuu === 5 && s.goi.invokeUpdate === 2 + 5, 'gọi lại đúng 5 lần rồi thôi', [tt.cuu, s.goi]);
    ok(/Đóng tab này/.test(tt.chu) && (await T.B.locator('.chu.err').count()) === 1 && s.bam.length === 0, 'dòng đỏ: đóng tab, xuất lại; không bấm gì', tt.chu);
    await T.dong();

    console.log('— Trang hỏi một câu trước khi mở hộp tối ưu: không báo lỗi, không gọi lại khung đã dựng; trả lời xong thì trợ lý vẫn tự làm');
    T = await mo({ hop_hoi: true }, { dat: { han_bang: 1500 } });
    await T.page.frameLocator('iframe').locator('.el-dialog__wrapper.hoi .el-dialog').waitFor({ state: 'visible', timeout: 10000 });
    await ngu(3500);                                                         // quá hạn "bảng tối ưu chưa hiện" từ lâu
    s = await T.so(); tt = await T.tt();
    ok(tt.khoa === 'cho_hop' && tt.loai === 'note' && /优化进度/.test(tt.chu) && !/không mở được/.test(tt.chu), 'khung đã dựng mà hộp tối ưu chưa hiện: trợ lý chờ, không báo lỗi', [tt.khoa, tt.chu]);
    ok(tt.cuu === 0 && s.goi.invokeUpdate === 2 && s.bam.length === 0, 'không gọi lại invokeUpdate trên khung đã dựng, không bấm gì', [tt.cuu, s.goi, s.bam]);
    await T.page.frameLocator('iframe').locator('.el-dialog__wrapper.hoi button', { hasText: '确定' }).click();      // người dùng trả lời câu hỏi của trang (hộp khác, không phải hộp tối ưu)
    await T.choXong();
    eq((await T.so()).bam.map(b => [b.ten, b.tin]), [['确定', true], ['开始优化', false], ['停止优化', false], ['确认新优化', false]], 'trả lời xong: hộp tối ưu hiện, trợ lý tự làm trọn lượt (bấm ở hộp khác không tính là "tự làm")');
    await T.dong();

    console.log('— Khung cut-block tải chậm (đường truyền chậm): chưa có modContext thì chưa gọi lại');
    may.tre_cb = 2500;
    T = await mo({ kieu: 'trang' });
    await T.choXong(25000);
    s = await T.so(); tt = await T.tt();
    ok(tt.cuu === 1 && s.goi.invokeUpdate === 2, 'chỉ gọi lại MỘT lần, sau khi khung đã báo initFinish', [tt.cuu, s.goi, s.moc]);
    may.tre_cb = 0;
    await T.dong();

    console.log('— Tiếng Việt (bản 1.36.4): chữ Việt hiện, chữ gốc còn nguyên trong DOM, trợ lý vẫn dò nút theo chữ gốc');
    // Chỉ HIỂN THỊ: phần tử chứa chữ mang data-mncf-vi (chữ Việt, hiện bằng ::after), chữ gốc thu cỡ 0, title = chữ gốc. Mọi luồng ở trên đã chạy với Tiếng Việt BẬT (mặc định).
    const viKhung = X => X.page.frames()[1].evaluate(() => {
      const ve = el => el ? { vi: el.getAttribute('data-mncf-vi'), goc: el.textContent, it: el.innerText, title: el.getAttribute('title'), co: getComputedStyle(el).fontSize, sau: getComputedStyle(el, '::after').content, rong: el.getBoundingClientRect().width } : null;
      const tim = (sel, t) => [...document.querySelectorAll(sel)].find(e => e.textContent.trim() === t) || null;
      const thanh = [...document.querySelectorAll('.thanh button')].map(b => ({ it: b.innerText.trim(), vi: (b.querySelector('[data-mncf-vi]') || {}).getAttribute ? b.querySelector('[data-mncf-vi]').getAttribute('data-mncf-vi') : null }));
      const o = document.querySelector('input[placeholder]');
      return { thanh, luu: ve(tim('.thanh button span', '保存优化')), dao: ve(tim('.thanh button span', '下刀点')), bp: [...document.querySelectorAll('.ben-phai li span, .ben-phai .el-tabs__item')].map(e => e.getAttribute('data-mncf-vi')),
        duoi: [...document.querySelectorAll('.thanh-duoi .muc, .thanh-duoi span:not(.muc):not(.el-checkbox__input):not(.el-checkbox__inner)')].map(e => e.getAttribute('data-mncf-vi')),
        chan: ve(document.querySelector('.chan-trang')), cao: ve(tim('.el-checkbox__label', '高亮显示可辅助开料的小板')), them: ve(tim('.cong-cu button span', '更多页码')),
        o: o && { ph: o.getAttribute('placeholder'), goc: o.getAttribute('data-mncf-ph'), title: o.getAttribute('title') },
        th: [...document.querySelectorAll('.el-dialog thead th .cell')].map(e => [e.textContent, e.getAttribute('data-mncf-vi')]),
        so: document.querySelectorAll('[data-mncf-vi]').length, css: !!document.getElementById('mncf-vi-css') };
    });
    may.tre_pl = 300;
    T = await mo({});
    await T.hop().waitFor({ state: 'visible', timeout: 10000 });
    await T.page.waitForFunction(() => { const f = document.querySelector('iframe').contentDocument; const b = [...f.querySelectorAll('.el-dialog button span')].find(e => e.textContent === '开始优化'); return b && b.getAttribute('data-mncf-vi'); }, null, { timeout: 5000 });
    let v = await viKhung(T);
    ok(v.th.find(x => x[0] === '大板')[1] === 'Tờ ván' && v.th.find(x => x[0] === '纹路')[1] === 'Vân' && v.th.find(x => x[0] === '余料板')[1] === 'Ván dư' && v.th.find(x => x[0] === '开料刀')[1] === 'Dao cắt', 'hộp 优化进度: đầu bảng ván có chữ Việt (大板 = Tờ ván, 纹路 = Vân, 余料板 = Ván dư, 开料刀 = Dao cắt)', v.th);
    ok(v.th.every(x => x[0]), 'đầu bảng: chữ gốc còn nguyên', v.th);
    await T.page.waitForFunction(() => { const f = document.querySelector('iframe').contentDocument; const b = [...f.querySelectorAll('.el-dialog button span')].find(e => e.textContent === '停止优化'); return b && b.getAttribute('data-mncf-vi') === 'Dừng tối ưu'; }, null, { timeout: 8000 });
    ok(true, 'nút đổi chữ 开始优化 → 停止优化 (trang sửa text node): chữ Việt đổi theo');
    await T.choXong();
    s = await T.so();
    eq([s.bam.map(b => b.ten), s.xn.to], [DUOC_BAM, [19, 6, 2, 4]], 'Tiếng Việt bật: trợ lý vẫn tối ưu trọn lượt như cũ');
    await ngu(800);
    v = await viKhung(T);
    eq(v.thanh.map(b => b.it), ['继续优化', '保存优化', '导出优化', '小板明细', '手动排版', '开料顺序', '下刀点', '导出NC', '打印标签', '一键NC', '一键打印', '导出备料单', 'CNC导出', '系统配置'], 'thanh công cụ: innerText của nút vẫn là chữ gốc (trang / trợ lý dò theo chữ gốc)');
    eq(v.thanh.map(b => b.vi), ['Tối ưu tiếp', 'Lưu tối ưu', 'Xuất tối ưu', 'Chi tiết tấm', 'Xếp tay', 'Thứ tự cắt', 'Điểm vào dao', 'Xuất NC', 'In nhãn', 'NC một chạm', 'In một chạm', 'Xuất phiếu vật tư', 'Xuất CNC', 'Cài đặt hệ thống'], 'thanh công cụ: chữ Việt đúng nghề');
    ok(v.luu.goc === '保存优化' && v.luu.title === '保存优化' && v.luu.co === '0px' && v.luu.sau === '"Lưu tối ưu"' && v.luu.rong > 20, 'nút 保存优化: chữ gốc còn trong DOM, title = chữ gốc, chữ gốc thu cỡ 0, ::after hiện "Lưu tối ưu" (có bề rộng thật)', v.luu);
    ok(v.dao.sau === '"Điểm vào dao"', '下刀点 = Điểm vào dao', v.dao);
    eq(v.bp, ['Chi tiết tấm', 'Thông tin xếp đơn', 'Thông tin đơn hàng', 'Thông tin ván', 'Thông tin tấm', 'Kích thước tấm', 'Thông tin dán cạnh', 'Thuộc tính nâng cao', 'Tình trạng xếp ván', 'Tình trạng cắt', 'Kết nối CNC nâng cao'], 'danh sách bên phải 小板明细');
    eq(v.duoi, ['Quy cách:1220*2440*17.5', 'Số tấm lật:0', 'Số tấm:13/29', 'Tờ số:1/19', 'Diện tích:2.977', 'TB chung:85.2%', 'TB 10 tờ đầu:88.1%', 'Tờ cuối:62.0%', 'Toạ độ:(0,0)', 'Tổng dán cạnh', 'Tấm chừa biên'], 'thanh dưới: nhãn + số trong cùng một dòng chữ (số giữ nguyên; 38 tấm → loại ván đầu 29 tấm)');
    ok(v.chan.vi === 'Quy cách:1220*2440*17.5 Số tấm:13/29 Tờ số:1/19' && /规格/.test(v.chan.goc), 'dòng chữ nhiều nhãn: dịch từng nhãn, chữ gốc còn', v.chan);
    ok(v.cao.vi === 'Tô sáng tấm cắt phụ được' && v.them.vi === 'Xem thêm trang', 'ô 高亮显示可辅助开料的小板 + nút 更多页码', [v.cao, v.them]);
    ok(v.o && v.o.ph === 'Tìm tấm' && v.o.goc === '搜索小板' && v.o.title === '搜索小板', 'ô 搜索小板: chữ mờ tiếng Việt, chữ gốc giữ ở data-mncf-ph + title', v.o);
    // chữ còn sót chữ Hán sau khi dịch: không gắn (nửa Việt nửa Trung khó đọc hơn)
    await T.page.frames()[1].evaluate(() => { const sp = document.createElement('span'); sp.id = 'la'; sp.textContent = '王者排版 规格'; document.querySelector('.ben-phai').appendChild(sp); });
    await ngu(800);
    eq(await T.page.frames()[1].evaluate(() => document.getElementById('la').getAttribute('data-mncf-vi')), null, 'chữ có phần chưa có trong từ điển: để nguyên chữ gốc');
    // (soát 1.36.4) 更多页码 = xem thêm số trang (phân trang), không phải "thêm một trang mới"; mảnh dịch đứng liền nhau thì cách một dấu cách (无纹路 ≠ "KhôngVân")
    eq(await T.page.evaluate(() => ['更多页码', '无纹路', '有余料板', '规格:1220*2440', '有', '前10平均:88%'].map(x => window.MNCF_SX.tinh.dichVi(x))),
      ['Xem thêm trang', 'Không Vân', 'Có Ván dư', 'Quy cách:1220*2440', 'Có', 'TB 10 tờ đầu:88%'], 'dichVi: không dính liền hai mảnh dịch, số / dấu giữ sát');
    console.log('— Tiếng Việt (soát 1.36.4): trang nhiều chữ — mỗi lần đổi chỉ quét phần vừa đổi, không quét lại cả trang');
    { const f = T.page.frames()[1];
      await f.evaluate(() => { const ul = document.createElement('div'); ul.id = 'nhieu'; const ten = ['小板', '大板', '有', '无', '封边汇总']; for (let i = 0; i < 3000; i++) { const sp = document.createElement('span'); sp.textContent = ten[i % 5]; ul.appendChild(sp); } document.body.appendChild(ul); });
      await ngu(900);
      const q0 = await T.page.evaluate(() => window.MNCF_SX.trang_thai().vi_quet);
      // ô 坐标 nhảy số khi rê chuột: đổi 20 lần trong ~1 giây
      for (let i = 0; i < 20; i++) { await f.evaluate(i => { const e = [...document.querySelectorAll('.thanh-duoi span')].find(x => /坐标/.test(x.textContent)); e.textContent = '坐标:(' + i + ',' + i + ')'; }, i); await ngu(50); }
      await ngu(700);
      const q1 = await T.page.evaluate(() => window.MNCF_SX.trang_thai().vi_quet), vz = await f.evaluate(() => [...document.querySelectorAll('.thanh-duoi span')].find(x => /坐标/.test(x.textContent)).getAttribute('data-mncf-vi'));
      ok(q1.lan > q0.lan && q1.nut < 50, 'đổi một ô chữ: lần quét sau chỉ đi qua phần vừa đổi (không đi lại 3000 dòng)', [q0, q1]);
      eq(vz, 'Toạ độ:(19,19)', 'ô vừa đổi vẫn có chữ Việt mới');
      ok(await f.evaluate(() => document.querySelectorAll('#nhieu [data-mncf-vi]').length === 3000), '3000 dòng thêm vào trang đều có chữ Việt');
      await f.evaluate(() => { document.querySelector('#nhieu span').textContent = '王者'; });
      await ngu(700);
      eq(await f.evaluate(() => document.querySelector('#nhieu span').getAttribute('data-mncf-vi')), null, 'chữ đổi thành thứ không dịch được: gỡ chữ Việt (quét theo phần vừa đổi vẫn gỡ)');
      await f.evaluate(() => document.getElementById('nhieu').remove()); }
    console.log('— Tiếng Việt: trang dựng lại thanh công cụ + danh sách → gắn lại');
    await T.page.frames()[1].evaluate(() => window.__MOCK_CB_VE_LAI__());
    await ngu(900);
    v = await viKhung(T);
    ok(v.thanh.every(b => b.vi) && v.bp.every(Boolean) && v.thanh[1].vi === 'Lưu tối ưu', 'phần tử mới của trang: có chữ Việt lại', [v.thanh, v.bp]);
    console.log('— Tiếng Việt: tắt = gỡ sạch, bật lại = gắn lại; lựa chọn được nhớ');
    ok(await T.B.locator('[data-ui="vi"]').isChecked(), 'ô "Tiếng Việt" mặc định bật');
    if (await T.B.locator('.vien').isVisible()) await T.B.locator('.vien').click();
    await T.B.locator('[data-ui="vi"]').uncheck();
    await ngu(500);
    v = await viKhung(T);
    const top = await T.page.evaluate(() => document.querySelectorAll('[data-mncf-vi],[data-mncf-ph],[data-mncf-vt]').length);
    ok(v.so === 0 && !v.css && v.o.ph === '搜索小板' && v.o.goc === null && v.o.title === null && v.luu.title === null && v.luu.co !== '0px' && top === 0, 'tắt: không còn thuộc tính / CSS nào, chữ mờ + title trả về như cũ', v);
    eq(await T.page.frames()[1].evaluate(() => document.querySelectorAll('[data-mncf-fs]').length), 0, 'tắt: không còn data-mncf-fs');
    eq(await T.page.evaluate(() => JSON.parse(localStorage.getItem('mncf.sx.v1')).vi), false, 'tắt được ghi vào mncf.sx.v1');
    await T.page.frames()[1].evaluate(() => window.__MOCK_CB_VE_LAI__());
    await ngu(800);
    eq((await viKhung(T)).so, 0, 'đang tắt mà trang dựng lại: không gắn');
    await T.B.locator('[data-ui="vi"]').check();
    await ngu(800);
    v = await viKhung(T);
    ok(v.thanh[1].vi === 'Lưu tối ưu' && v.o.ph === 'Tìm tấm' && v.css, 'bật lại: gắn lại ngay', v.thanh);
    eq(await T.page.evaluate(() => JSON.parse(localStorage.getItem('mncf.sx.v1'))), { tu_dong: true, vi: true }, 'mncf.sx.v1 giữ cả hai lựa chọn');
    eq((await T.so()).bam.map(b => b.ten), DUOC_BAM, 'bật / tắt / dựng lại: trợ lý không bấm thêm gì');
    await T.dong();
    console.log('— Tiếng Việt tắt sẵn (mncf.sx.v1): không gắn gì, trợ lý vẫn tối ưu');
    T = await mo({}, { ls: { tu_dong: true, vi: false } });
    await T.choXong();
    await ngu(800);
    v = await viKhung(T);
    ok(v.so === 0 && !v.css && v.o.ph === '搜索小板' && !(await T.B.locator('[data-ui="vi"]').isChecked()), 'tắt sẵn: không có chữ Việt, ô bỏ chọn', v.so);
    eq((await T.so()).bam.map(b => b.ten), DUOC_BAM, 'tắt sẵn: trợ lý vẫn tối ưu trọn lượt');
    { const c = await T.B.locator('.chu').innerText(); ok(/保存优化/.test(c) && !/Lưu tối ưu/.test(c), 'Tiếng Việt tắt: lời báo gọi nút bằng chữ gốc (đúng chữ đang hiện trên trang)', c); }
    await T.dong();
    T = await mo({}, { ls: { tu_dong: false } });                            // bản lưu cũ (chưa có khoá vi): Tiếng Việt mặc định bật
    await T.hop().waitFor({ state: 'visible', timeout: 10000 });
    await ngu(800);
    v = await viKhung(T);
    ok(v.th.find(x => x[0] === '大板')[1] === 'Tờ ván' && (await T.tt()).vi === true, 'bản lưu cũ chưa có khoá vi: mặc định bật', v.th);
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
