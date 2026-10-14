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
const eq_ = (a, b, name) => ok(JSON.stringify(a) === JSON.stringify(b), name, { co: a, can: b });
// thẻ nằm sau nút ⚙ (bản 1.27 — Màu, Chuẩn xưởng, Hướng dẫn): hàng thẻ phụ chưa mở thì bấm ⚙ trước rồi mới bấm thẻ
const theSau = async (H, t) => { const tab = H.locator('.tab[data-tab="' + t + '"]'); if (!(await tab.isVisible())) await H.locator('[data-act="the-them"]').click(); await tab.click(); };
const TU_2000 = { ma: 'TA2', rong: 2000, cao: 2800, chan: { cao: 50 }, hau: { t: 6 }, khoang: [
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
    // bản 1.25 — CHÂN BẢNG GỌN (anh Thanh 05/10/2026 08:25: "rối rắm quá khó sử dụng, các nút thành icon cho nó nhanh đi"; 08:32: "cho bảng thao tác rộng ra cũng được"):
    // chỉ còn một nút chữ (Vẽ vào Chenfeng); mọi nút khác là nút biểu tượng có chú thích ngắn; bảng mặc định rộng hơn.
    const chan = await page.evaluate(() => {
      const r = document.getElementById('mncf-host').shadowRoot, ft = r.querySelector('footer'), hien = b => b.getClientRects().length > 0;
      const nut = [...ft.querySelectorAll('button')].filter(hien), ic = nut.filter(b => b.classList.contains('ic'));
      return { rong: Math.round(r.querySelector('.panel').getBoundingClientRect().width), chu: nut.filter(b => !b.classList.contains('ic')).map(b => b.dataset.act), ic: ic.map(b => b.dataset.act),
        du: ic.map(b => (b.querySelector('svg') ? '' : 'thiếu hình ') + (b.getAttribute('aria-label') ? '' : 'thiếu tên ') + (b.title ? '' : 'thiếu giải thích ') + (b.querySelector('.nh') && b.querySelector('.nh').textContent.trim() && b.querySelector('.nh').textContent.trim().length <= 10 ? '' : 'thiếu chú thích ngắn')).filter(Boolean),
        nho: ic.filter(b => { const q = b.getBoundingClientRect(); return q.width < 40 || q.height < 40; }).map(b => b.dataset.act),
        cao: Math.round(ft.getBoundingClientRect().height - ft.querySelector('.status').getBoundingClientRect().height), hang: new Set(ic.map(b => Math.round(b.getBoundingClientRect().top))).size,
        tran: [...ft.children].filter(e => e.getClientRects().length && !e.classList.contains('goiy') && e.scrollWidth > e.clientWidth + 1).map(e => e.className) };      // (dòng gợi ý cố ý cắt bằng dấu …)
    });
    ok(chan.rong >= 540 && chan.rong <= 640, 'bảng mặc định rộng hơn (≈ 560) cho hình đứng và hàng nút đỡ chật', chan.rong);
    ok(JSON.stringify(chan.chu) === '["draw"]', 'chân bảng chỉ còn MỘT nút chữ: Vẽ vào Chenfeng', chan.chu);
    // bản 1.27 — BẢNG ÍT CHỮ, ÍT NÚT (anh Thanh 05/10/2026 20:17: "giao diện hơi rườm rà"; 20:52: "nhiều chữ quá a đọc k quen"): cạnh nút Vẽ chỉ còn 3 cách đặt tủ, Sửa tủ và nút ⋯;
    // Chuẩn hoá / JSON / CSV / Lưu / Mở / ô toạ độ nằm sau nút ⋯; nút Cập nhật chỉ hiện khi bảng đang nối với một tủ trên bản vẽ.
    ok(JSON.stringify(chan.ic) === '["dat-tuong","dat","hinh","pick","nut-them"]', 'cạnh nút Vẽ chỉ còn: 3 cách đặt tủ, Sửa tủ, nút ⋯', chan.ic);
    ok(chan.du.length === 0 && chan.nho.length === 0, 'nút biểu tượng nào cũng có hình, chú thích ngắn, tên đọc được (aria-label), lời giải thích (title) và đủ to để bấm (≥ 40 × 40)', [chan.du, chan.nho]);
    ok(chan.cao <= 110 && chan.hang === 1 && chan.tran.length === 0, 'chân bảng: ngoài dòng trạng thái chỉ còn MỘT hàng nút (bản 1.25: 2 hàng + hàng toạ độ, 185 px), không tràn ngang', chan);
    const hienAn = () => page.evaluate(() => { const r = document.getElementById('mncf-host').shadowRoot, v = q => { const e = r.querySelector(q); return !!e && e.getClientRects().length > 0; };
      return ['footer [data-act="redraw"]', '[data-act="chuanhoa"]', 'footer [data-act="json"]', '[data-act="csv"]', '[data-act="save"]', '[data-act="open"]', '#mncf-ui-ax', '#mncf-ui-useat'].map(v).map(Number).join(''); });
    ok((await hienAn()) === '00000000' && (await H.locator('[data-act="nut-them"]').getAttribute('aria-expanded')) === 'false', 'mặc định: Cập nhật, Chuẩn hoá, JSON, CSV, Lưu, Mở, ô toạ độ đều ẩn', await hienAn());
    await H.locator('[data-act="nut-them"]').click();
    ok((await hienAn()) === '01111111' && (await H.locator('[data-act="nut-them"]').getAttribute('aria-expanded')) === 'true', 'bấm ⋯: hiện Chuẩn hoá, JSON, CSV, Lưu, Mở, ô toạ độ (Cập nhật vẫn ẩn — bảng chưa nối tủ nào)', await hienAn());
    await H.locator('[data-act="nut-them"]').click();
    ok((await hienAn()) === '00000000', 'bấm ⋯ lần nữa: gọn lại', await hienAn());
    // thẻ: chỉ còn các thẻ làm việc + nút ⚙; Màu / Chuẩn xưởng / Hướng dẫn / Đo mạng nằm ở hàng thẻ phụ sau nút ⚙
    const theHien = () => page.evaluate(() => [...document.getElementById('mncf-host').shadowRoot.querySelectorAll('header .tab')].filter(b => b.getClientRects().length > 0).map(b => b.dataset.tab || b.dataset.act).join(' '));
    ok((await theHien()) === 'tu phong kho kq the-them', 'hàng thẻ: Tủ · Phòng · Kho mẫu · Kết quả · ⚙', await theHien());
    await H.locator('[data-act="the-them"]').click();
    ok((await theHien()) === 'tu phong kho kq the-them mausac chuan hd do-mang' && (await H.locator('[data-act="the-them"]').getAttribute('aria-expanded')) === 'true', 'bấm ⚙: hiện hàng thẻ phụ Màu · Chuẩn xưởng · Hướng dẫn · Đo mạng', await theHien());
    await H.locator('.tab[data-tab="chuan"]').click();
    ok(await H.locator('.pane[data-pane="chuan"]').isVisible() && /\bon\b/.test(await H.locator('[data-act="the-them"]').getAttribute('class')) && /chuan/.test(await theHien()), 'chọn Chuẩn xưởng: mở thẻ đó, nút ⚙ sáng, hàng thẻ phụ còn hiện');
    await H.locator('[data-act="the-them"]').click();
    ok(/chuan/.test(await theHien()) && await H.locator('.pane[data-pane="chuan"]').isVisible(), 'đang ở một thẻ phụ mà bấm ⚙: hàng thẻ phụ không gọn mất (kẻo thẻ đang mở không còn nút)', await theHien());
    await H.locator('.tab[data-tab="tu"]').click();
    ok((await theHien()) === 'tu phong kho kq the-them' && await H.locator('.pane[data-pane="tu"]').isVisible(), 'về thẻ Tủ: hàng thẻ phụ tự gọn lại', await theHien());
    // Đo mạng tới Chenfeng (anh Thanh 05/10/2026 20:14: "làm sao hết lag nhỉ"; 21:56: "làm sao để máy chủ ổn định được" — để anh tự so các đường VPN). Đã đo trên máy anh: đường tới Chenfeng
    // RỚT GÓI từng đợt (lượt rớt gói lâu gấp 2 – 10 lần, có lúc đứt hẳn) → một lượt làm nóng (mở kết nối, KHÔNG tính) + 20 lượt hỏi máy chủ Chenfeng (chỉ ĐỌC, lần lượt);
    // dòng trạng thái: xếp loại + SỐ LẦN chậm hoặc rớt (con số để so hai đường mạng) + kết quả lần đo trước.
    let lanDo = 0, treDo = [300].concat(Array.from({ length: 20 }, (_, i) => (i === 3 || i === 9 || i === 15 ? 900 : i === 12 ? 0 : 40)));      // ms; 0 = rớt (máy chủ không trả lời); lượt đầu = làm nóng
    await ctx.route('https://api.cfcad.cn/CAD-dirQuery', async r => { const t = treDo[lanDo++ % treDo.length]; if (!t) return r.abort('connectionreset'); await new Promise(q => setTimeout(q, t)); r.fulfill({ status: 200, contentType: 'application/json', body: '{"err_code":1,"err_msg":"no"}' }); });
    const doMang = async cho => { await H.locator('[data-act="do-mang"]').click(); await page.waitForFunction(c => new RegExp(c).test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), cho, { timeout: 30000 }).catch(() => {}); return H.locator('.status').innerText(); };
    await page.evaluate(() => { window.MNCFDriver.CH.do_cach = 20; });      // (thật: các lượt cách nhau 0,4 giây)
    await H.locator('[data-act="the-them"]').click();
    let dm = await doMang('^Mạng tới Chenfeng: ');
    ok(/^Mạng tới Chenfeng: tạm được — 4\/20 lần chậm hoặc rớt · bình thường 0,1 s · lâu nhất (0,9|1,0|1,1) s\.$/.test(dm), 'Đo mạng: xếp loại + số lần chậm hoặc rớt trong 20 lượt (3 lượt chậm + 1 lượt rớt), lượt bình thường, lượt lâu nhất', dm);
    ok(lanDo === 21, '… một lượt làm nóng (không tính — lượt này chậm vì còn mở kết nối) + đúng 20 lượt hỏi máy chủ', lanDo);
    treDo = [40];
    dm = await doMang('Lần trước');
    ok(/^Mạng tới Chenfeng: tốt — 0\/20 lần chậm hoặc rớt · bình thường 0,1 s · lâu nhất 0,[123] s\. Lần trước: 4\/20\.$/.test(dm), 'đo lần nữa (đường khác): kèm kết quả lần đo trước để so', dm);
    ok(lanDo === 42, '… lại 1 + 20 lượt', lanDo);
    treDo = [0];
    dm = await doMang('đứt');
    ok(/^Mạng tới Chenfeng: đứt — 3 lần liền không trả lời\. Kiểm tra mạng \/ VPN\. Lần trước: 0\/20\.$/.test(dm), 'đường đứt: 3 lần liền không trả lời thì dừng và báo đứt (không bắt chờ đủ 20 lượt × hạn chờ)', dm);
    ok(lanDo === 45, '… chỉ hỏi 3 lượt', lanDo);
    treDo = [40];
    await H.locator('[data-act="do-mang"]').click();      // bấm thêm lần nữa lúc đang đo: không chạy loạt đo thứ hai chồng lên (hai loạt cùng hỏi máy chủ thì số đo sai, lượt nọ chen lượt kia)
    await page.waitForFunction(() => /Đang đo mạng/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 5000 }).catch(() => {});
    dm = await doMang('^Mạng tới Chenfeng: tốt');
    await page.waitForTimeout(1500);
    ok(/^Mạng tới Chenfeng: tốt — 0\/20 lần chậm hoặc rớt · bình thường 0,1 s · lâu nhất 0,[123] s\. Lần trước: đứt\.$/.test(dm) && /Lần trước: đứt\.$/.test(await H.locator('.status').innerText()), 'đo lại sau lần đứt: "Lần trước: đứt"', dm);
    ok(lanDo === 66, '… bấm "Đo mạng" lần nữa khi đang đo: vẫn chỉ một loạt 1 + 20 lượt', lanDo);
    // 3 lượt rớt RẢI RÁC (giữa chúng có lượt trả lời): đường rớt gói chứ không đứt — đo đủ 20 lượt, xếp kém, không báo "đứt"
    lanDo = 0; treDo = [40].concat(Array.from({ length: 20 }, (_, i) => (i === 3 || i === 9 || i === 15 ? 0 : 40)));
    dm = await doMang('Lần trước: 0/20');
    ok(/^Mạng tới Chenfeng: kém — 3\/20 lần chậm hoặc rớt · bình thường 0,1 s · lâu nhất 0,[123] s\. Lần trước: 0\/20\.$/.test(dm) && lanDo === 21, '3 lượt rớt rải rác trong 20: kém 3/20, đo đủ 1 + 20 lượt (không coi là đứt)', [dm, lanDo]);
    // (bản 1.29) GIỮ SẴN KẾT NỐI: lúc bảng đang vẽ mà đường tới máy chủ im quá D.CH.am_cach thì hỏi một câu chỉ đọc cho kết nối còn mở; vẽ xong thì thôi hỏi.
    lanDo = 0; treDo = [10];
    await page.evaluate(() => { window.MNCFDriver.CH.am_cach = 300; });
    const tha = await page.evaluate(() => { window.__thaGiu = window.MNCFDriver.giuKetNoi(); window.__thaGiu2 = window.MNCFDriver.giuKetNoi(); return 1; });
    await page.waitForTimeout(1600);
    const lanGiu = lanDo;
    ok(tha && lanGiu >= 3 && lanGiu <= 6, 'đang giữ kết nối (hai việc lồng nhau): đường im quá 0,3 s thì hỏi máy chủ một câu — 1,6 giây được 3 – 6 câu, không dồn dập', lanGiu);
    await page.evaluate(() => window.__thaGiu());
    await page.waitForTimeout(800);
    ok(lanDo > lanGiu, 'còn một việc đang giữ: vẫn hỏi tiếp', [lanGiu, lanDo]);
    await page.evaluate(() => { window.__thaGiu2(); window.__thaGiu2(); });      // thả hai lần cũng chỉ tính một
    await page.waitForTimeout(400); const lanTha = lanDo; await page.waitForTimeout(1000);
    ok(lanDo === lanTha, 'thả hết: thôi hỏi máy chủ', [lanTha, lanDo]);
    // Chenfeng tự gọi máy chủ (XHR, như khi tải mẫu): đường không im → bảng không hỏi chen; Đo mạng tóm tắt các lần gọi của CHENFENG (không đếm lời gọi của bảng)
    await ctx.route('https://api.cfcad.cn/CAD-moduleDetail', r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': 'https://cfcad.cn', 'access-control-allow-credentials': 'true' }, body: '{"err_code":0}' }));
    lanDo = 0;
    await page.evaluate(async () => {
      const goi = () => new Promise(q => { const x = new XMLHttpRequest(); x.open('POST', 'https://api.cfcad.cn/CAD-moduleDetail'); x.withCredentials = true; x.onloadend = q; x.send('{}'); });
      const tha = window.MNCFDriver.giuKetNoi(); for (let i = 0; i < 8; i++) { await goi(); await new Promise(q => setTimeout(q, 150)); } tha();
    });
    ok(lanDo === 0, 'Chenfeng đang gọi máy chủ dồn dập (cách nhau dưới 0,3 s): bảng không hỏi chen', lanDo);
    const gcf = await page.evaluate(() => window.MNCFDriver.goiCF().filter(g => g.ten === 'CAD-moduleDetail').map(g => g.kieu));
    ok(gcf.length === 8 && gcf.every(k => k === 'xmlhttprequest') && !(await page.evaluate(() => window.MNCFDriver.goiCF().some(g => g.ten === 'CAD-dirQuery'))), 'ghi lại đúng 8 lần Chenfeng gọi mẫu (XHR); lời gọi của chính bảng không lẫn vào', gcf);
    treDo = [40];
    dm = await doMang('Chenfeng đã gọi');
    ok(/Chenfeng đã gọi máy chủ 8 lần \(xmlhttprequest 8 · [^)]*\) — tải mẫu 8 lần: thường \d+,\d s, lâu nhất \d+,\d s\.$/.test(dm), 'Đo mạng kèm tóm tắt các lần Chenfeng gọi máy chủ (gọi bằng gì, giao thức, mẫu tải lâu bao nhiêu)', dm);
    await ctx.unroute('https://api.cfcad.cn/CAD-moduleDetail');
    await page.evaluate(() => { window.MNCFDriver.CH.am_cach = 0; });      // các phép thử sau đếm đúng số lời gọi đọc kho
    // (bản 1.29.1) Thăm dò lõi (cuối thẻ Hướng dẫn — việc hiếm làm, không thêm nút vào hàng thẻ): chỉ ĐỌC mã nguồn các lớp lệnh của Chenfeng → tải một tệp chữ; bản vẽ không đổi, không lỗi JS
    {
      await H.locator('.tab[data-tab="hd"]').click();
      ok(await H.locator('.pane[data-pane="hd"] [data-act="tham-do"]').isVisible() && (await theHien()) === 'tu phong kho kq the-them mausac chuan hd do-mang', 'nút Thăm dò lõi nằm cuối thẻ Hướng dẫn, hàng thẻ phụ vẫn 4 nút');
      const truoc = await page.evaluate(() => window.__MOCK__.ents.length);
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }).catch(() => null), H.locator('[data-act="tham-do"]').click()]);
      const txt = dl ? fs.readFileSync(await dl.path(), 'utf8') : '';
      ok(dl && /^chenfeng-loi-\d{4}-\d\d-\d\d\.txt$/.test(dl.suggestedFilename()) && /==== DANH SÁCH LỚP ====/.test(txt) && /\n\/\/ ==== HandleInput ====\n\S/.test(txt) && (await page.evaluate(() => window.__MOCK__.ents.length)) === truoc,
        'Thăm dò lõi: tải tệp chữ có mã nguồn các lớp / hàm lệnh (vd HandleInput của CommandStore), bản vẽ không đổi', dl && dl.suggestedFilename());
      ok(/Đã tải tệp mã lõi Chenfeng \(\d+ lớp/.test(await H.locator('.status').innerText()), '… dòng báo nói số lớp + bảo gửi tệp cho Claude', await H.locator('.status').innerText());

      await H.locator('.tab[data-tab="tu"]').click(); await H.locator('[data-act="the-them"]').click();      // về trạng thái trước khối này: thẻ Tủ, hàng thẻ phụ đang mở
    }
    await ctx.unroute('https://api.cfcad.cn/CAD-dirQuery');
    await H.locator('[data-act="the-them"]').click();
    ok((await theHien()) === 'tu phong kho kq the-them', 'bấm ⚙ lần nữa: hàng thẻ phụ gọn lại', await theHien());
    // ít chữ: chữ hướng dẫn, chú giải màu, dòng mô tả tủ ẩn sẵn; nút "?" bật lại, máy nhớ lựa chọn
    const chuHien = () => page.evaluate(() => { const r = document.getElementById('mncf-host').shadowRoot, v = e => !!e && e.getClientRects().length > 0, p = r.querySelector('.pane[data-pane="tu"]');
      return [[...p.querySelectorAll('.hint:not(.tt)')].filter(v).length > 0, v(p.querySelector('.legend')), v(p.querySelector('.sum')), r.querySelector('[data-act="chu"]').getAttribute('aria-pressed'), localStorage.getItem('mncf.ui.chu')]; });
    ok(JSON.stringify(await chuHien()) === '[false,false,false,"false",null]', 'mặc định ÍT CHỮ: thẻ Tủ không hiện chữ hướng dẫn, chú giải màu, dòng mô tả tủ', await chuHien());
    // (bản 1.30.1) tủ mặc định không còn dòng ghi chú nào (dòng "bản lề không đặt trong vùng hộc kéo" đã bỏ) → hạ ngưỡng nhịp đợt cho tủ có dòng cảnh báo để thử, xong trả lại
    const spTruocMsg = await page.evaluate(() => window.MNCF.app.getSpec());
    await page.evaluate(sp => window.MNCF.app.setSpec(Object.assign({}, sp, { kiem: Object.assign({}, sp.kiem, { dot_max: 500 }) })), spTruocMsg);
    ok((await H.locator('.msgs .msg').count()) > 0 && await H.locator('.msgs .msg').first().isVisible() && (await H.locator('[data-ui="phieu"]').isVisible() || await H.locator('[data-act="tu-kiem"]').isVisible()), '(bản 1.28: phiếu đạt hết thì thu thành nút ✓ Tự kiểm) … dòng cảnh báo và phiếu tự kiểm vẫn hiện');
    await H.locator('[data-act="chu"]').click();
    ok(JSON.stringify(await chuHien()) === '[true,true,true,"true","1"]', 'bấm "?": hiện lại chữ hướng dẫn + chú giải + mô tả, máy nhớ', await chuHien());
    await H.locator('[data-act="chu"]').click();
    ok(JSON.stringify(await chuHien()) === '[false,false,false,"false","0"]', 'bấm "?" lần nữa: ít chữ lại', await chuHien());
    // dòng báo dài: thu còn 2 dòng, bấm vào thì xổ hết
    const kep = () => page.evaluate(() => { const m = document.getElementById('mncf-host').shadowRoot.querySelector('.msgs .msg'); return [getComputedStyle(m).webkitLineClamp, m.classList.contains('mo')]; });
    ok(JSON.stringify(await kep()) === '["2",false]', 'dòng báo ở thẻ Tủ thu còn 2 dòng', await kep());
    await H.locator('.msgs .msg').first().click();
    ok(JSON.stringify(await kep()) === '["none",true]', 'bấm vào dòng báo: xổ hết', await kep());
    await page.evaluate(sp => window.MNCF.app.setSpec(sp), spTruocMsg);
    await H.locator('[data-act="nut-them"]').click();      // mở sẵn hàng nút phụ cho các phép thử phía sau (ô toạ độ, JSON, Chuẩn hoá…)
    // rê chuột vào nút biểu tượng: dòng gợi ý ngay trên hàng nút nói liền nút đó làm gì (khỏi chờ tooltip của trình duyệt)
    await H.locator('[data-act="pick"]').hover();
    ok(/Sửa tủ đang chọn/.test(await H.locator('footer .goiy').innerText()), 'rê chuột vào nút biểu tượng: dòng gợi ý ghi nút đó làm gì', await H.locator('footer .goiy').innerText());
    await H.locator('[data-act="chuanhoa"]').focus();
    ok(/Chuẩn hoá mẫu kho đang chọn → ván 17,5 · hậu 6,5 phủ sau/.test(await H.locator('footer .goiy').innerText()) && /Chuẩn hoá mẫu kho đang chọn → ván 17,5 · hậu 6,5 phủ sau/.test(await H.locator('[data-act="chuanhoa"]').getAttribute('aria-label')), 'đưa con trỏ bàn phím vào nút cũng hiện gợi ý; nút Chuẩn hoá ghi đúng dày ván + hậu đang dùng', await H.locator('footer .goiy').innerText());
    await H.locator('#mncf-rong').focus(); await H.locator('.brand').hover();
    ok((await H.locator('footer .goiy').innerText()).trim() === '', 'rời nút: dòng gợi ý trống lại');
    ok((await H.locator('[data-dot]').count()) > 0 && (await H.locator('[data-o]').count()) > 0, 'hình đứng tương tác trong bảng nổi');

    // gõ phím trong bảng không lọt ra Chenfeng
    await page.evaluate(() => { window.__keys = 0; window.addEventListener('keydown', () => window.__keys++); });
    await H.locator('#mncf-rong').click(); await page.keyboard.type('1');
    ok((await page.evaluate(() => window.__keys)) === 0, 'phím gõ trong bảng không lan ra trang Chenfeng');

    /* --- vẽ tại toạ độ --- */
    await page.evaluate(s => window.MNCF.app.setSpec(s), TU_2000);
    await H.locator('#mncf-ui-useat').check(); await H.locator('#mncf-ui-ax').fill('5000');
    ok(/^Vẽ tại 5000, \S+, \S+$/.test(await H.locator('footer [data-act="draw"]').innerText()), '(bản 1.28) "Đặt tại toạ độ" đang tích: nút xanh ghi rõ "Vẽ tại 5000, …"', await H.locator('footer [data-act="draw"]').innerText());
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
    ok(/L \(rộng\) \/ W \(sâu\) \/ H \(cao\)/.test(await H.locator('.report .mod').innerText()) && !/Riêng /.test(await H.locator('.report .mod').innerText()), 'tủ thường: cả L / W / H đều đổi được ở ô Thông số, không có câu "Riêng … chỉ để xem"', await H.locator('.report .mod').innerText());
    ok(JSON.stringify(rep.dem) === JSON.stringify([[6041.5, 6059, 47.5, 591.5, 67.5, 520], [6882.5, 6900, 47.5, 591.5, 67.5, 520]]), '2 vách đệm nằm đúng chỗ (đã cộng độ dời; bản 1.28: lùi sau nẹp)', rep.dem);
    // hậu chuẩn xưởng: 4 tấm 6 li nằm sau thùng (y 574…580 + độ dời 17,5), không có lỗ khoan nào
    ok(JSON.stringify(rep.hau) === JSON.stringify([[6, 5051, 6000, 591.5, 597.5, 51, 2199], [6, 6000, 6949, 591.5, 597.5, 51, 2199], [6, 5051, 6000, 591.5, 597.5, 2201, 2749], [6, 6000, 6949, 591.5, 597.5, 2201, 2749]]) && rep.loHau === 0, 'hậu 6 li phủ sau lưng thùng: đúng chỗ, không lỗ khoan', [rep.hau, rep.loHau]);
    ok(!/tấm hậu/.test(await H.locator('.report').innerText()), 'hậu không có lỗ → báo cáo không nhắc gì tới hậu');
    ok(/Đã sửa kiểu khoan cho 10 tấm ngăn kéo/.test(await H.locator('.report').innerText()) && /đã đổi sang Cam3Tp/.test(await H.locator('.report .msg.note[title*="kiểu khoan"]').first().getAttribute('title')), 'báo cáo nêu việc đổi kiểu khoan của mẫu (chi tiết ở title)');
    ok((await page.evaluate(() => window.__MOCK_ZOOM__)) >= 1, 'vẽ xong gọi xem toàn bộ');

    // bản 1.15: trang giả lập không có lệnh gốc của Chenfeng → bảng tự vẽ theo cách nhập tấm (không báo lỗi)
    ok((await page.evaluate(() => [window.MNCFDriver.gocDuoc(), window.MNCF.app.getSpec().ve_goc, typeof window.MNCFDriver.veGoc, !!window.MNCFDriver.last.goc_cf].join())) === 'false,true,function,false', 'trang không có lệnh gốc → D.draw dùng cách nhập tấm dù ve_goc đang bật');
    /* --- hoàn tác --- */
    await H.locator('[data-act="undo"]').click();
    await page.waitForFunction(() => /Đã hoàn tác/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 15000 });
    ok((await page.evaluate(() => window.MNCFDriver.all().length)) === 0, 'hoàn tác: bản vẽ sạch trở lại');

    /* --- (bản 1.32) giường có ngăn kéo / vách đầu giường: nhập tấm + gom MỘT module (đổi Rộng / Dài / Cao ngay ở ô Thông số của Chenfeng) --- */
    for (const [ma, ten, moW] of [['G16-NK', 'G1', /Dài phủ bì/], ['V2800-1200', 'VD1', /Dày/]]) {
      await H.locator('.tab[data-tab="tu"]').click();
      if (!(await H.locator('#mncf-ui-ax').isVisible())) await H.locator('[data-act="nut-them"]').click();
      // (1.32) đổi loại sản phẩm qua ô Thư viện: chỗ đặt của món trước (ô toạ độ đang bật) bị bỏ
      await H.locator('#mncf-ui-ax').fill('4000'); if (!(await H.locator('#mncf-ui-useat').isChecked())) await H.locator('#mncf-ui-useat').check();
      await H.locator('#mncf-ui-mau').selectOption(ma); await H.locator('[data-act="mau"]').click();
      ok(!(await H.locator('#mncf-ui-useat').isChecked()) && /bỏ chỗ đặt của món trước/.test(await page.evaluate(() => document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent)), `${ma}: đổi loại sản phẩm — bỏ chỗ đặt cũ, có báo`);
      ok(!(await H.locator('.vehang [data-act="dat-tuong"]').isVisible()) && !(await H.locator('.vehang [data-act="hinh"]').isVisible()) && await H.locator('.vehang [data-act="dat"]').isVisible(), `${ma}: giấu nút Tường / Hình (khung của tủ), còn nút Chuột`);
      const sp = await page.evaluate(() => { const s = window.MNCF.app.getSpec(); s.hau = Object.assign({}, s.hau, { t: 6 }); return s; });
      await page.evaluate(s => window.MNCF.app.setSpec(s), sp);
      await H.locator('#mncf-ui-useat').check();
      await H.locator('#mncf-ui-ax').fill('9000');
      await H.locator('[data-act="draw"]').click();
      await page.waitForFunction(() => { const L = window.MNCFDriver.last; return L && L.offset && L.offset[0] === 9000; }, null, { timeout: 30000 });
      await H.locator('.report .msg').first().waitFor({ timeout: 30000 });
      const g = await page.evaluate(() => { const D = window.MNCFDriver, L = D.last, bs = L.added.filter(D.isBoard), T = bs[0] && bs[0].Template && bs[0].Template.Object;
        return { n: bs.length, mod: !!T && bs.every(b => b.Template && b.Template.Object === T), ten: T && T.Name, L: T && T.GetParam('L').actions.length, W: T && T.GetParam('W').actions.length, H: T && T.GetParam('H').actions.length, moTa: T && [T.GetParam('W').description, T.GetParam('H').description], goc: !!L.goc_cf, ve_goc: window.MNCF.app.getSpec().ve_goc }; });
      const nThiet = await page.evaluate(() => window.MNCF.app.getModel().parts.length), bc = await H.locator('.report').innerText();
      ok(new RegExp(`Đã vẽ xong — ${nThiet}/${nThiet} tấm`).test(bc), `${ma}: ${nThiet}/${nThiet} tấm đúng vị trí`, bc);
      ok(g.mod && g.ten === ten && g.L > 0 && g.H > 0 && moW.test(g.moTa[0]) && !g.goc && !/rơi về|lệnh gốc/.test(bc), `${ma}: gom thành MỘT module ${ten}, L / H có hành động co giãn, mô tả tham số theo loại; vẽ bằng nhập tấm (không báo "rơi về")`, [g, bc]);
      ok(ma !== 'G16-NK' || (g.W > 0 && /Giường đã là module tham số/.test(bc) && /W \(dài\)/.test(bc)), `${ma}: đổi được cả Dài (W) — báo cáo nói "Giường", "W (dài)"`, bc);
      await H.locator('[data-act="undo"]').click();
      await page.waitForFunction(() => /Đã hoàn tác/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 15000 });
      ok((await page.evaluate(() => window.MNCFDriver.all().length)) === 0, `${ma}: hoàn tác sạch`);
      await H.locator('.tab[data-tab="tu"]').click();
    }
    /* --- (bản 1.33) TỦ BẾP: 3 module cạnh nhau — tủ chậu (nhập tấm), tủ 3 ngăn kéo, tủ trên treo ở z 1550 (bảng tự cộng cao độ treo vào toạ độ) --- */
    {
      await H.locator('.tab[data-tab="tu"]').click();
      if (!(await H.locator('#mncf-ui-ax').isVisible())) await H.locator('[data-act="nut-them"]').click();
      const bd = async () => page.evaluate(() => { const D = window.MNCFDriver, L = D.last, bs = L.added.filter(e => D.isBoard(e) && !e.IsErase), b = bs.map(D.boxOf), T = bs[0] && bs[0].Template && bs[0].Template.Object;
        return { n: bs.length, z0: Math.round(Math.min(...b.map(x => x[4])) * 10) / 10, x0: Math.round(Math.min(...b.map(x => x[0])) * 10) / 10, mod: !!T && bs.filter(e => D.tagOf(e)).every(e => e.Template && e.Template.Object === T), ten: T && T.Name, moTa: T && [T.GetParam('L').description, T.GetParam('H').description], id: L.id, off: L.offset }; });
      const kq = {};
      for (const [ma, x, z, ten] of [['BD-CHAU-900', 30000, 0, 'BD'], ['BD-NK3-600', 31000, 0, 'BD'], ['BT-CANH-800', 32000, 1550, 'BT'], ['BC-KHO-400', 33000, 0, 'BC']]) {
        await H.locator('.tab[data-tab="tu"]').click();      // vẽ xong bảng sang thẻ Kết quả
        await H.locator('#mncf-ui-mau').selectOption(ma); await H.locator('[data-act="mau"]').click();
        await page.waitForFunction(m => window.MNCF.app.getSpec().ten === window.MNCFCore.apMau(window.MNCFCore.DEFAULT_SPEC, m).ten, ma);
        await page.evaluate(() => { const s = window.MNCF.app.getSpec(); s.hau = Object.assign({}, s.hau, { t: 6 }); window.MNCF.app.setSpec(s); });
        ok(!(await H.locator('.vehang [data-act="dat-tuong"]').isVisible()) && !(await H.locator('.vehang [data-act="hinh"]').isVisible()) && await H.locator('.vehang [data-act="dat"]').isVisible(), `${ma}: giấu nút Tường / Hình (khung của tủ áo), còn nút Chuột`);
        if (!(await H.locator('#mncf-ui-ax').isVisible())) await H.locator('[data-act="nut-them"]').click();
        // (1.33 vòng soát) toạ độ GÕ là toạ độ thật: tủ trên gõ z = cao độ đáy tủ (1550) — bảng không cộng cao độ treo lần nữa; nút xanh ghi đúng chỗ sẽ vẽ
        if (await H.locator('footer [data-act="unlink"]').isVisible()) await H.locator('footer [data-act="unlink"]').click();      // đang nối tủ vừa vẽ thì nút xanh là "Tủ mới"
        await H.locator('#mncf-ui-ax').fill(String(x)); await H.locator('#mncf-ui-ay').fill('0'); await H.locator('#mncf-ui-az').fill(String(z));
        if (!(await H.locator('#mncf-ui-useat').isChecked())) await H.locator('#mncf-ui-useat').check();
        ok((await H.locator('footer [data-act="draw"]').innerText()).trim() === `Vẽ tại ${x}, 0, ${z}`, `${ma}: nút xanh ghi "Vẽ tại ${x}, 0, ${z}"`, await H.locator('footer [data-act="draw"]').innerText());
        if (z) ok(/đáy tủ/.test(await H.locator('#mncf-ui-az').getAttribute('title') || ''), `${ma}: ô z nói rõ là cao độ đáy tủ trên`, await H.locator('#mncf-ui-az').getAttribute('title'));
        await H.locator('[data-act="draw"]').click();
        await page.waitForFunction(x0 => { const L = window.MNCFDriver.last; return L && L.offset && Math.abs(L.offset[0] - x0) < 1; }, x, { timeout: 30000 });
        await H.locator('.report .msg').first().waitFor({ timeout: 30000 });
        const g = await bd(), nThiet = await page.evaluate(() => window.MNCF.app.getModel().parts.length), bc = await H.locator('.report').innerText();
        kq[ma] = g;
        ok(new RegExp(`Đã vẽ xong — ${nThiet}/${nThiet} tấm`).test(bc) && (await H.locator('.report .msg.err').count()) === 0, `${ma}: ${nThiet}/${nThiet} tấm đúng vị trí, không dòng lỗi`, bc.slice(0, 600));
        ok(g.mod && g.ten === ten && g.z0 === z && g.x0 === x, `${ma}: một module tên ${ten}, đặt ở x ${x}, đáy tủ ở z ${z}${z ? ' (gõ z 1550: không cộng cao độ treo hai lần)' : ''}`, g);
        ok(/Rộng/.test(g.moTa[0]) && (ma[1] === 'T' ? /đáy giữ nguyên/.test(g.moTa[1]) : ma[1] === 'C' ? /Cao phủ bì/.test(g.moTa[1]) && /không có đá/.test(g.moTa[1]) : /chưa gồm đá/.test(g.moTa[1])), `${ma}: mô tả tham số module theo tủ bếp`, g.moTa);
        ok(!/(Xà chân|Giằng|Thanh treo|Mặt ngăn kéo \(rổ)[^\n]*(chưa có lỗ|lơ lửng|đè lên|va chạm)/.test(bc), `${ma}: dò lỗi sau vẽ không báo oan xà chân / giằng / thanh treo / mặt rổ`, bc);
      }
      ok(await page.evaluate(() => { const D = window.MNCFDriver; return new Set(D.all().filter(e => D.isBoard(e) && D.tagOf(e)).map(D.tagOf)).size === 4; }), '4 module tủ bếp (dưới, trên, tủ cao) cùng nằm trên bản vẽ, mỗi cái một mã tủ');
      // tên tấm tủ bếp của kho Chenfeng (tiếng Trung) → tiếng Việt; tên riêng đứng trước tên chung (台面板 là mặt đá, không phải "Mặt bàn")
      eq_(await page.evaluate(() => ['踢脚线', '吊柜侧板', '左地柜侧板', '吊柜底板', '吊柜顶板', '挡水条', '地柜见光侧板', '吊柜见光侧板', '转角封板', '橱柜台面板'].map(window.MNCFDriver.tenTamMoi)), ['Xà chân', 'Hồi', 'Hồi trái', 'Đáy', 'Nóc', 'Gờ chắn nước', 'Tấm ốp hông', 'Tấm ốp hông', 'Tấm bịt góc', 'Mặt đá'], 'tên tấm tủ bếp của kho Chenfeng đổi sang tiếng Việt');
      // (1.33 vòng soát) tên trần (không có chữ tủ bếp) giữ như 1.32: mặt bàn học / bàn trang điểm không thành "Mặt đá" (bị bỏ khỏi đổ màu), 见光侧板 vẫn là Hồi (nhóm thùng)
      eq_(await page.evaluate(() => { const D = window.MNCFDriver, ts = ['书桌台面板', '台面板', '梳妆台台面板', '见光侧板'].map(D.tenTamMoi); return ts.concat(window.MNCFCore.nhomMau(ts.map(ten => ({ ten })))); }),
        ['Mặt bàn (书桌台面板)', 'Mặt bàn (台面板)', 'Mặt bàn (梳妆台台面板)', 'Hồi (见光侧板)', 'mat', 'mat', 'mat', 'thung'], 'tên trần 台面板 / 见光侧板 của tủ áo, bàn: giữ tên + nhóm màu như 1.32');
      // Sửa tủ đang chọn: chọn một tấm của tủ trên → bảng mở lại đúng loại + tầng; Cập nhật (rộng 900) giữ đáy ở z 1550
      await H.locator('.tab[data-tab="tu"]').click();
      if (await H.locator('footer [data-act="unlink"]').isVisible()) await H.locator('footer [data-act="unlink"]').click();
      await page.evaluate(id => { const D = window.MNCFDriver; window.__MOCK__.userSelect([D.all().find(e => D.isBoard(e) && D.tagOf(e) === id && /Đáy/.test(e.Name))]); }, kq['BT-CANH-800'].id);
      await H.locator('[data-act="pick"]').click();
      ok((await page.evaluate(() => { const s = window.MNCF.app.getSpec(); return s.loai_sp === 'bep' && s.bep.tang === 'tren' && s.rong === 800; })) && (await H.locator('.panel').getAttribute('data-loai')) === 'bep' && /Đã mở thông số/.test(await H.locator('.status').innerText()), 'Sửa tủ đang chọn (tủ trên): mở lại đúng tủ bếp, tầng trên', await H.locator('.status').innerText());
      await page.evaluate(() => { const s = window.MNCF.app.getSpec(); s.rong = 900; window.MNCF.app.setSpec(s); });
      await H.locator('[data-act="redraw"]').click();
      await page.waitForFunction(() => /Đã cập nhật|Chưa cập nhật/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 60000 });
      const u = await bd();
      ok(/Đã cập nhật tủ tại chỗ/.test(await H.locator('.status').innerText()) && u.z0 === 1550 && u.x0 === 32000 && u.id === kq['BT-CANH-800'].id, 'Cập nhật tủ trên (rộng 900): vẫn treo ở z 1550, đúng chỗ, giữ mã tủ', u);
      // (1.33 vòng soát) đổi "Cách mặt đá" 700 → 750 rồi Cập nhật: tủ trên lên theo (đáy 1600) — khớp dòng tóm tắt và phép kiểm khoảng cách hút mùi
      await H.locator('.tab[data-tab="tu"]').click();
      await H.locator('[data-bep="cach_tren"]').fill('750');
      await page.waitForFunction(() => window.MNCF.app.getSpec().bep.cach_tren === 750, null, { timeout: 5000 }).catch(() => {});
      await H.locator('[data-act="redraw"]').click();
      await page.waitForFunction(() => /Đã cập nhật|Chưa cập nhật/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 60000 });
      const u15 = await bd();
      ok(/Đã cập nhật tủ tại chỗ/.test(await H.locator('.status').innerText()) && u15.z0 === 1600 && u15.x0 === 32000 && u15.id === kq['BT-CANH-800'].id, 'Cập nhật sau khi đổi Cách mặt đá 750: đáy tủ trên lên z 1600, x giữ 32000', u15);
      // (1.33 vòng soát) module tủ bếp đổi Rộng trong Chenfeng sang cỡ phụ kiện không vừa (giá xoong 600 → tủ 650): Sửa / Cập nhật lấy đúng 650 (lỗi phụ kiện báo ở bảng), không trả về 600
      { const r = await page.evaluate(() => { const C = window.MNCFCore, D = window.MNCFDriver, s = C.normalize(C.apMau(C.DEFAULT_SPEC, 'BD-XN-600')), k = C.heSo(s).kich;
          const T = { Name: 'BD', LParam: { value: k[0] + 50 }, WParam: { value: k[1] }, HParam: { value: k[2] }, GetParam: () => ({ description: '' }) };
          const n = D.specTheoModule(s, { Template: { Object: T } }), M = n && C.build(n);
          return { rong: n && n.rong, loiBep: !!M && M.kq.some(q => q.muc === 'loi' && q.ma === 'bep'), loiKhac: !!M && M.kq.some(q => q.muc === 'loi' && q.ma !== 'bep') }; });
        ok(r.rong === 650 && r.loiBep && !r.loiKhac, 'specTheoModule: module giá xoong đổi Rộng 600 → 650 trong Chenfeng → thông số rộng 650 (lỗi phụ kiện), không null', r); }
      // tủ dưới: Sửa → Cập nhật giữ z 0
      await H.locator('.tab[data-tab="tu"]').click();
      await page.evaluate(id => { const D = window.MNCFDriver; window.__MOCK__.userSelect([D.all().find(e => D.isBoard(e) && D.tagOf(e) === id && /Hồi/.test(e.Name))]); }, kq['BD-NK3-600'].id);
      await H.locator('[data-act="pick"]').click();
      ok((await page.evaluate(() => { const s = window.MNCF.app.getSpec(); return s.bep.tang === 'duoi' && s.bep.chuc_nang === 'nk'; })) && (await H.locator('.panel').getAttribute('data-loai')) === 'bep-duoi', 'Sửa tủ đang chọn (tủ 3 ngăn kéo): mở lại tủ dưới');
      await H.locator('[data-act="redraw"]').click();
      await page.waitForFunction(() => /Đã cập nhật|Chưa cập nhật/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 60000 });
      const u2 = await bd();
      ok(u2.z0 === 0 && u2.x0 === 31000, 'Cập nhật tủ dưới: vẫn đứng ở z 0', u2);
      // (1.33 vòng soát 2) tủ trên đặt bằng CHUỘT: ô z điền cao độ treo thật (1560); sửa ô x sau đó thì tủ vẫn treo ở 1560 (trước: rơi xuống sàn)
      { await H.locator('.tab[data-tab="tu"]').click();
        if (await H.locator('footer [data-act="unlink"]').isVisible()) await H.locator('footer [data-act="unlink"]').click();
        await H.locator('#mncf-ui-mau').selectOption('BT-CANH-600'); await H.locator('[data-act="mau"]').click();
        await page.waitForFunction(() => { const s = window.MNCF.app.getSpec(); return s.loai_sp === 'bep' && s.bep.tang === 'tren' && s.rong === 600; });
        // (bản vá 1.33.1) chuẩn bếp chỉ có MỘT nguồn = bản lưu: "Cách mặt đá 750" gõ ở khối Tủ bếp phía trên là chuẩn người dùng đã chọn → mẫu mới theo 750 (trước: Sửa tủ dưới
        // ghi đè cả chuẩn bằng số của tủ đó). Đặt lại 700 cho phép thử dưới đây.
        ok((await page.evaluate(() => window.MNCF.app.getSpec().bep.cach_tren)) === 750, 'mẫu tủ trên mới theo chuẩn đã lưu (Cách mặt đá 750 gõ ở trên), không theo tủ vừa Sửa');
        await H.locator('[data-bep="cach_tren"]').fill('700');
        await page.waitForFunction(() => window.MNCF.app.getSpec().bep.cach_tren === 700, null, { timeout: 5000 }).catch(() => {});
        const soHoi = () => page.evaluate(() => (window.__MOCK_HOI__ || []).length), choHoi = n => page.waitForFunction(k => (window.__MOCK_HOI__ || []).length >= k && window.MNCFDriver.busy(), n, { timeout: 8000 });
        const st = () => page.evaluate(() => document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent);
        const h0 = await soHoi();
        await H.locator('.vehang [data-act="dat"]').click(); await choHoi(h0 + 1);
        await page.evaluate(() => window.__MOCK__.clickPoint(60000, 0, 0)); await choHoi(h0 + 2);
        await page.evaluate(() => window.__MOCK__.clickPoint(61000, 0, 0));
        await page.waitForFunction(k => /Đã đặt/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent) || ((window.__MOCK_HOI__ || []).length >= k && window.MNCFDriver.busy()), h0 + 3, { timeout: 8000 });
        if (!/Đã đặt/.test(await st())) { await page.evaluate(() => window.__MOCK__.clickPoint(60000, -500, 0)); await page.waitForFunction(() => /Đã đặt/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 8000 }); }
        if (await H.locator('[data-act="hop-dong"]').isVisible()) await H.locator('[data-act="hop-dong"]').click();
        if (!(await H.locator('#mncf-ui-ax').isVisible())) await H.locator('[data-act="nut-them"]').click();
        const o = async () => ({ ax: await H.locator('#mncf-ui-ax').inputValue(), az: await H.locator('#mncf-ui-az').inputValue(), nut: (await H.locator('footer [data-act="draw"]').innerText()).trim() });
        let v = await o();
        ok(v.ax === '60000' && v.az === '1560' && /^Vẽ tại 60000, [-\d.]+, 1560$/.test(v.nut), 'tủ trên đặt bằng chuột: ô z = 1560 (cao độ đáy tủ thật, như nút xanh), không phải 0 ở sàn', v);
        await H.locator('[data-bep="cach_tren"]').fill('750');
        await page.waitForFunction(() => window.MNCF.app.getSpec().bep.cach_tren === 750, null, { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(400);
        await H.locator('#mncf-ui-ax').focus();
        v = await o();
        ok(v.az === '1610' && /, 1610$/.test(v.nut), 'đổi Cách mặt đá 750 sau khi đặt: ô z theo kịp (1610)', v);
        await H.locator('[data-bep="cach_tren"]').fill('700');
        await page.waitForFunction(() => window.MNCF.app.getSpec().bep.cach_tren === 700, null, { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(400);
        await H.locator('#mncf-ui-ax').fill('60100');
        v = await o();
        ok(v.az === '1560' && /^Vẽ tại 60100, [-\d.]+, 1560$/.test(v.nut), 'sửa ô x sau khi đặt bằng chuột: nút xanh vẫn ghi z 1560', v);
        await H.locator('footer [data-act="draw"]').click();
        await page.waitForFunction(() => { const L = window.MNCFDriver.last; return L && L.offset && Math.abs(L.offset[0] - 60100) < 1; }, null, { timeout: 30000 });
        await H.locator('.report .msg').first().waitFor({ timeout: 30000 });
        const g = await bd();
        ok(g.z0 === 1560 && g.x0 === 60100, 'vẽ: tủ trên treo ở z 1560, x 60100 (không rơi xuống sàn)', g);
        await H.locator('.tab[data-tab="tu"]').click();
        if (!(await H.locator('#mncf-ui-ax').isVisible())) await H.locator('[data-act="nut-them"]').click();
        await H.locator('#mncf-ui-ay').fill('0'); await H.locator('#mncf-ui-az').fill('0'); }      // các phép thử sau chỉ gõ x
      await page.evaluate(async () => { const D = window.MNCFDriver; await D.erase(D.all()); });
      await H.locator('.tab[data-tab="tu"]').click();
      if (await H.locator('footer [data-act="unlink"]').isVisible()) await H.locator('footer [data-act="unlink"]').click();
      ok((await page.evaluate(() => window.MNCFDriver.all().length)) === 0, 'tủ bếp: dọn sạch bản vẽ cho các phép thử sau');
    }
    // (soát 1.34.1) táp CHÂN GỖ rời: chân không phải tấm (không vào lệnh nhập) — góc đặt (ô toạ độ / điểm bấm) là ở SÀN, bảng nâng thân lên cao chân (trước: thân rơi xuống sàn, mất 150)
    { await H.locator('.tab[data-tab="tu"]').click();
      if (await H.locator('footer [data-act="unlink"]').isVisible()) await H.locator('footer [data-act="unlink"]').click();
      await H.locator('#mncf-ui-mau').selectOption('TAP-CHAN2-500'); await H.locator('[data-act="mau"]').click();
      await page.waitForFunction(() => { const s = window.MNCF.app.getSpec(); return s.loai_sp === 'tap' && s.tap && s.tap.chan_go === 150; });
      await page.evaluate(() => { const s = window.MNCF.app.getSpec(); s.hau = Object.assign({}, s.hau, { t: 6 }); window.MNCF.app.setSpec(s); });
      const bdT = async () => page.evaluate(() => { const D = window.MNCFDriver, L = D.last, bs = L.added.filter(e => D.isBoard(e) && !e.IsErase), b = bs.map(D.boxOf), T = bs[0] && bs[0].Template && bs[0].Template.Object;
        return { z0: Math.round(Math.min(...b.map(x => x[4])) * 10) / 10, z1: Math.round(Math.max(...b.map(x => x[5])) * 10) / 10, x0: Math.round(Math.min(...b.map(x => x[0])) * 10) / 10, moTaH: T && T.GetParam('H').description }; });
      if (!(await H.locator('#mncf-ui-ax').isVisible())) await H.locator('[data-act="nut-them"]').click();
      await H.locator('#mncf-ui-ax').fill('40000'); await H.locator('#mncf-ui-ay').fill('0'); await H.locator('#mncf-ui-az').fill('0');
      if (!(await H.locator('#mncf-ui-useat').isChecked())) await H.locator('#mncf-ui-useat').check();
      ok(/sàn/.test(await H.locator('#mncf-ui-az').getAttribute('title') || ''), 'táp chân gỗ: ô z nói rõ là sàn dưới chân', await H.locator('#mncf-ui-az').getAttribute('title'));
      await H.locator('footer [data-act="draw"]').click();
      await page.waitForFunction(() => { const L = window.MNCFDriver.last; return L && L.offset && Math.abs(L.offset[0] - 40000) < 1; }, null, { timeout: 30000 });
      await H.locator('.report .msg').first().waitFor({ timeout: 30000 });
      let g = await bdT();
      ok(g.z0 === 150 && g.z1 === 580 && g.x0 === 40000, 'táp chân gỗ gõ z 0: đáy ở 150, đỉnh 580 (không rơi xuống sàn)', g);
      ok(/chân gỗ/.test(g.moTaH || ''), 'táp chân gỗ: tham số H của module nói rõ chưa gồm chân gỗ', g.moTaH);
      // đặt bằng điểm bấm (không ô toạ độ): bấm ở sàn → thân nâng lên cao chân
      await H.locator('.tab[data-tab="tu"]').click();
      if (await H.locator('footer [data-act="unlink"]').isVisible()) await H.locator('footer [data-act="unlink"]').click();
      if (!(await H.locator('#mncf-ui-ax').isVisible())) await H.locator('[data-act="nut-them"]').click();
      await H.locator('#mncf-ui-useat').uncheck();
      const h0 = await page.evaluate(() => (window.__MOCK_HOI__ || []).length);
      await H.locator('footer [data-act="draw"]').click();
      await page.waitForFunction(k => (window.__MOCK_HOI__ || []).length >= k && window.MNCFDriver.busy(), h0 + 1, { timeout: 8000 });
      await page.evaluate(() => window.__MOCK__.clickPoint(42000, 0, 0));
      await page.waitForFunction(() => { const L = window.MNCFDriver.last; return L && L.offset && Math.abs(L.offset[0] - 42000) < 1; }, null, { timeout: 30000 });
      await H.locator('.report .msg').first().waitFor({ timeout: 30000 });
      g = await bdT();
      ok(g.z0 === 150 && g.z1 === 580 && g.x0 === 42000, 'táp chân gỗ bấm điểm ở sàn: đáy ở 150 (bảng nâng lên cao chân)', g);
      await page.evaluate(async () => { const D = window.MNCFDriver; await D.erase(D.all()); });
      await H.locator('.tab[data-tab="tu"]').click();
      if (await H.locator('footer [data-act="unlink"]').isVisible()) await H.locator('footer [data-act="unlink"]').click();
      ok((await page.evaluate(() => window.MNCFDriver.all().length)) === 0, 'táp chân gỗ: dọn sạch bản vẽ'); }
    // (1.32) mở file giường khi đang giữ chỗ đặt của món khác loại: bỏ chỗ đặt (góc trước tính theo sâu của món cũ)
    { if (!(await H.locator('#mncf-ui-useat').isChecked())) await H.locator('#mncf-ui-useat').check();
      const g = await page.evaluate(() => window.MNCFCore.apMau(window.MNCFCore.DEFAULT_SPEC, 'G16-T'));
      await H.locator('[data-ui="file"]').setInputFiles({ name: 'giuong.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ spec: g })) });
      await page.waitForFunction(() => window.MNCF.app.getSpec().loai_sp === 'giuong');
      const st = await page.evaluate(() => document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent);
      ok(!(await H.locator('#mncf-ui-useat').isChecked()) && /Đã mở file giường; bỏ chỗ đặt của món trước/.test(st), 'mở file giường khi đang giữ chỗ đặt của vách: bỏ chỗ đặt, có báo', st); }
    await page.evaluate(s => window.MNCF.app.setSpec(s), TU_2000);
    if (!(await H.locator('#mncf-ui-ax').isVisible())) await H.locator('[data-act="nut-them"]').click();
    await H.locator('#mncf-ui-useat').check();
    await H.locator('#mncf-ui-ax').fill('5000');

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
    await H.locator('.tab[data-tab="tu"]').click();      // (bản 1.28) nút Hoàn tác nằm ở chân thẻ Kết quả: bấm xong vẫn ở thẻ đó
    if (!(await H.locator('#mncf-ui-useat').isVisible())) await H.locator('[data-act="nut-them"]').click();
    await H.locator('#mncf-ui-useat').uncheck();
    // (bản 1.29) đang chờ bấm điểm: dòng nhắc có nút "Thôi" — bấm là bỏ lời nhắc bấm điểm, bảng mở lại (anh Thanh 07/10: "bấm vẽ rồi kích vào vị trí là stop lệnh, extension tự tắt")
    await H.locator('[data-act="draw"]').click();
    await page.waitForFunction(() => window.app.Editor.GetPointServices.IsReady);
    await H.locator('.chip [data-act="chip-thoi"]').waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
    ok(await H.locator('.chip [data-act="chip-thoi"]').isVisible(), 'chờ bấm điểm: dòng nhắc có nút "Thôi"');
    await H.locator('.chip [data-act="chip-thoi"]').click();
    await H.locator('.panel').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    ok(await H.locator('.panel').isVisible() && !(await H.locator('.chip').isVisible()) && !(await page.evaluate(() => window.app.Editor.GetPointServices.IsReady)), 'bấm "Thôi": Chenfeng thôi hỏi điểm, bảng mở lại, dòng nhắc tắt', await H.locator('.status').innerText());
    await H.locator('.tab[data-tab="tu"]').click();
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
    await H.locator('.tab[data-tab="tu"]').click();      // (bản 1.28) chân thẻ Kết quả là hàng việc làm tiếp; nút Cập nhật ở chân thẻ Tủ
    ok(await H.locator('footer [data-act="redraw"]').isVisible(), 'bản 1.27: bảng nối với tủ vừa vẽ → nút Cập nhật tự hiện cạnh nút Vẽ');
    { // (bản 1.28) đang nối với tủ đã vẽ — tủ vẫn đứng chỗ cũ, cột vẫn ở đó: "Về tủ mẫu" GIỮ khấu cột (Cập nhật không được vẽ tủ đè vào cột)
      const the0 = await page.evaluate(() => document.getElementById('mncf-host').shadowRoot.querySelector('.panel').dataset.tabon), sp0 = await page.evaluate(() => window.MNCF.app.getSpec());
      await page.evaluate(sp => window.MNCF.app.setSpec(Object.assign({}, sp, { khau: { trai: { rong: 0, sau: 0 }, phai: { rong: 0, sau: 0 }, giua: [{ cach: 300, rong: 200, sau: 150 }], ho: 15 } })), sp0);
      await H.locator('.tab[data-tab="tu"]').click(); await H.locator('#mncf-ui-mau').selectOption(''); await H.locator('[data-act="mau"]').click();
      ok((await page.evaluate(() => window.MNCF.app.getSpec().khau.giua.length)) === 1 && await H.locator('footer [data-act="unlink"]').isVisible(), 'đang nối với tủ đã vẽ: "Tủ mặc định" giữ khấu cột');
      await page.evaluate(sp => window.MNCF.app.setSpec(sp), sp0);
      if (the0 && the0 !== 'tu') await H.locator('.tab[data-tab="' + the0 + '"]').click();
    }
    // bản 1.27 — thẻ Kết quả có nút "Xem 3D" cạnh "Xem toàn bộ": xoay góc nhìn Chenfeng sang 3D (SWISO) rồi thu phóng
    await page.waitForTimeout(300);
    const z0 = await page.evaluate(() => { window.__MOCK_NHIN__ = []; return window.__MOCK_ZOOM__ || 0; });
    const theTruoc = await page.evaluate(() => document.getElementById('mncf-host').shadowRoot.querySelector('.panel').dataset.tabon);
    await H.locator('.tab[data-tab="kq"]').click();
    ok(await H.locator('footer [data-act="xem3d"]').isVisible() && await H.locator('footer [data-act="undo"]').isVisible() && await H.locator('footer [data-act="xuatvan"]').isVisible() && !(await H.locator('footer [data-act="draw"]').isVisible()), '(bản 1.28) thẻ Kết quả: chân bảng là hàng Hoàn tác · Dò lại · Vừa màn · Chenfeng 3D · Xuất ván (không còn hàng vẽ tủ)');
    await H.locator('footer [data-act="xem3d"]').click();
    await page.waitForFunction(z => (window.__MOCK_ZOOM__ || 0) > z, z0, { timeout: 5000 }).catch(() => {});
    ok(JSON.stringify(await page.evaluate(() => window.__MOCK_NHIN__)) === '["SWISO"]' && (await page.evaluate(() => window.__MOCK_ZOOM__ || 0)) === z0 + 1, 'bấm "Xem 3D": Chenfeng nhận SWISO rồi thu phóng', await page.evaluate(() => [window.__MOCK_NHIN__, window.__MOCK_ZOOM__]));
    if (theTruoc && theTruoc !== 'kq') await H.locator('.tab[data-tab="' + theTruoc + '"]').click();      // trả lại thẻ đang mở cho các phép thử sau
    ok(!(await H.locator('footer [data-act="redraw"]').isDisabled()) && /^Cập nhật tủ \S+/.test(await H.locator('footer [data-act="redraw"]').innerText()), 'vẽ xong → bảng nối với tủ vừa vẽ, nút "Cập nhật tủ …" bật');
    // (bản 1.28) đang nối: "Cập nhật tủ X" là nút chính (to nhất, đứng đầu hàng), nút vẽ thu thành "Tủ mới", có nút "Thôi sửa"
    await H.locator('.tab[data-tab="tu"]').click();
    { const vh = await page.evaluate(() => { const r = document.getElementById('mncf-host').shadowRoot, q = s => r.querySelector('footer ' + s), w = e => Math.round(e.getBoundingClientRect().width), x = e => Math.round(e.getBoundingClientRect().left);
        return { cn: w(q('[data-act="redraw"]')), ve: w(q('[data-act="draw"]')), dau: x(q('[data-act="redraw"]')) < x(q('[data-act="draw"]')), chuVe: q('[data-act="draw"]').textContent, thoi: !!q('[data-act="unlink"]').getClientRects().length }; });
      ok(vh.cn > vh.ve && vh.dau && vh.chuVe === 'Tủ mới' && vh.thoi, 'đang nối: "Cập nhật tủ …" là nút chính, nút vẽ thành "Tủ mới", có "Thôi sửa"', vh); }
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
    ok(await H.locator('footer [data-act="redraw"]').isDisabled() && !(await H.locator('footer [data-act="redraw"]').isVisible()) && !(await H.locator('footer [data-act="unlink"]').isVisible()) && /^Vẽ /.test(await H.locator('footer [data-act="draw"]').innerText()), 'Thôi sửa → nút Cập nhật tắt và ẩn lại, nút xanh trở lại vẽ tủ mới');
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
    await theSau(H, 'chuan');
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
    // bản 1.26.1 — tủ có cột giữa: ô Rộng (L) của module CHỈ ĐỂ XEM. Cột đứng yên còn khoang chia lại nên vách khấu / hậu khấu không chạy đều theo L
    // (đo trên Chenfeng thật 05/10/2026: tủ 3000 cột cách 1000, gõ L 3000 → 2900 thì vách khấu còn cách vách khoang 2,09 — thiết kế cần 30; đã đo luôn: tham số L không còn hành động nào
    // và mẫu con không bám _L thì gõ L mới không tấm nào chạy, Chenfeng không báo lỗi). Hành động mặc định của lệnh MODELING cũng phải gỡ (nó kéo thô: cánh không giãn).
    const km = await page.evaluate(() => { const D = window.MNCFDriver, tag = D.last.added.filter(D.isBoard).filter(D.tagOf), T = tag[0].Template.Object, P = n => T.GetParam(n);
      return { hd: [P('L').actions.length, P('W').actions.length > 0, P('H').actions.length > 0], moTa: ['L', 'W', 'H'].map(n => P(n).description),
        con: T.Children.map(c => c.Object).map(c => c.Params.map(p => String(p.expr == null ? '' : p.expr)).filter(Boolean).join(' | ')), dims: D.moduleDims(tag[0]) }; });
    ok(JSON.stringify(km.hd) === '[0,true,true]', 'tủ có cột giữa: tham số L của module không còn hành động nào (kể cả hành động mặc định của MODELING); W / H vẫn co giãn', km.hd);
    ok(/chỉ xem/.test(km.moTa[0]) && /cột giữa/.test(km.moTa[0]) && /bảng Một Nhà/.test(km.moTa[0]) && km.moTa[1] === 'Sâu phủ bì (cả cánh)' && km.moTa[2] === 'Cao phủ bì', 'ô ghi chú của L trong bảng Thông số nói ngay tại chỗ: chỉ xem, tủ có cột giữa, đổi ở bảng', km.moTa);
    ok(km.con.length === 4 && km.con.every(c => !/_L\b/.test(c)) && km.con.filter(c => /_W\b/.test(c)).length === 4, 'hộp ngăn kéo / suốt treo (mẫu con) không bám theo _L nữa — cả 4 vẫn bám _W', km.con);
    ok(JSON.stringify(km.dims) === '[2000,597.5,2800]', 'kích thước module vẫn là phủ bì tủ', km.dims);
    // người dùng vẫn gõ số mới vào ô L đã khoá rồi Apply (bản thật, đo 05/10/2026: ô nhận số mới, không tấm nào chạy) → số đó KHÔNG phải bề rộng thật của tủ:
    // "Sửa tủ đang chọn" / "Cập nhật tủ này" phải dò tủ theo kích thước lúc vẽ. Tham số không khoá (W) đổi ở module thì vẫn lấy theo module như trước.
    const kl = await page.evaluate(() => { const D = window.MNCFDriver, C = window.MNCFCore, tag = D.last.added.filter(D.isBoard).filter(D.tagOf), T = tag[0].Template.Object, s = C.normalize(D.last.M.spec);
      const gan = (n, v, e) => { const p = T.GetParam(n); p.expr = e === undefined ? String(v) : e; p.value = v; };
      gan('L', 2100); const chiL = D.specTheoModule(s, tag[0]);
      gan('W', 647.5); const caW = D.specTheoModule(s, tag[0]);
      gan('W', 597.5, ''); gan('L', 2000, '');
      return { chiL: chiL && [chiL.rong, chiL.sau_thung, chiL.cao], caW: caW && [caW.rong, caW.sau_thung, caW.cao], sau: D.specTheoModule(s, tag[0]) }; });
    ok(kl.chiL === null && JSON.stringify(kl.caW) === '[2000,630,2800]' && kl.sau === null, 'gõ L mới vào ô đã khoá: bảng không coi đó là bề rộng thật của tủ; W (không khoá) đổi ở module thì vẫn lấy theo module — sâu thùng 580 → 630, rộng giữ 2000', kl);
    const rgm = await H.locator('.report .mod').innerText();
    ok(/Riêng Rộng \(L\) chỉ để xem/.test(rgm) && /cột giữa/.test(rgm) && /Cập nhật tủ này/.test(rgm) && /W \(sâu\) \/ H \(cao\)/.test(rgm) && !/L \(rộng\) \/ W \(sâu\)/.test(rgm), 'thẻ Kết quả nói rõ: ở ô Thông số chỉ đổi được Sâu / Cao; Rộng thì sửa ở bảng rồi bấm Cập nhật', rgm);
    await H.locator('[data-act="undo"]').click();
    await page.waitForFunction(() => /Đã hoàn tác/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 15000 });
    // … kích thước nào module không co giãn đều được vì lý do KHÁC cũng khoá y như vậy (ở đây: mọi khoang đều rộng cố định → đổi Rộng là thiết kế hỏng), không để hành động mặc định của MODELING kéo thô
    const kc = await page.evaluate(async () => {
      const r = await window.MNCF.draw({ ma: 'TC1', rong: 1000, cao: 2000, than: { cao_duoi: 0 }, khoang: [{ rong: 400, canh: 1, dot: [800], o: [] }, { rong: 447.5, canh: 1, dot: [800], o: [] }] }, { at: [80000, 0, 0] });
      const D = window.MNCFDriver, tag = D.last.added.filter(D.isBoard).filter(D.tagOf), T = tag[0].Template.Object;
      const o = { ok: r.ok, loi: r.errors, khoa: r.module && r.module.khoa, bien: r.module && r.module.bien, hd: ['L', 'W', 'H'].map(n => T.GetParam(n).actions.length > 0), moTa: T.GetParam('L').description };
      const u = await D.undoLast(); o.hoan_tac = !!(u && u.ok); return o; });
    ok(kc.ok && JSON.stringify(kc.khoa) === JSON.stringify([{ ten: 'L', ly_do: 'khong_deu' }]) && JSON.stringify(kc.bien) === '["W","H"]' && JSON.stringify(kc.hd) === '[false,true,true]' && /chỉ xem/.test(kc.moTa) && /bảng Một Nhà/.test(kc.moTa) && !/cột giữa/.test(kc.moTa) && kc.hoan_tac,
      'tủ mọi khoang rộng cố định: L của module bị khoá (lý do khong_deu, không nhắc cột giữa), W / H vẫn co giãn', kc);
    // … "Cập nhật tủ này" khi ô L của module đang ghi số người dùng gõ vào (tủ thật vẫn rộng như lúc vẽ): vẫn tìm ra tủ cũ, bỏ nó, vẽ lại đúng bề rộng mới sửa ở BẢNG
    const ku = await page.evaluate(async s => { const D = window.MNCFDriver, C = window.MNCFCore, n0 = D.all().length;
      const r0 = await window.MNCF.draw(s, { at: [84000, 0, 0] }); if (!r0.ok) return { loi: r0.errors };
      const tag = D.last.added.filter(D.isBoard).filter(D.tagOf), T = tag[0].Template.Object, id = D.last.id, cu = C.normalize(D.last.M.spec);
      const p = T.GetParam('L'); p.expr = '2100'; p.value = 2100;
      const q = await D.update(Object.assign({}, cu, { rong: 2100 }), { id, specCu: cu }, {});
      const tag2 = q.giai_doan === 'xong' && D.last ? D.last.added.filter(D.isBoard).filter(D.tagOf) : [];
      const o = { ok: q.ok, gd: q.giai_doan, loi: q.errors, khop: q.kiem_tra && [q.kiem_tra.so_tam_khop, q.kiem_tra.so_tam_thiet_ke], dims: tag2.length ? D.moduleDims(tag2[0]) : null, conCu: tag.filter(b => !b.IsErase).length };
      if (q.giai_doan === 'xong') { const u = await D.undoLast(); o.hoan_tac = !!(u && u.ok); }
      await D.undo(r0.so_buoc_hoan_tac); o.sach = D.all().length === n0; return o; }, Object.assign({}, TU_GIUA, { ma: 'TG2' }));
    ok(ku.ok && ku.gd === 'xong' && ku.khop && ku.khop[0] === ku.khop[1] && JSON.stringify(ku.dims) === '[2100,597.5,2800]' && ku.conCu === 0 && ku.hoan_tac && ku.sach,
      'tủ cột giữa mà ô L của module đang ghi số gõ tay: “Cập nhật tủ này” vẫn tìm ra tủ cũ và vẽ lại đúng rộng 2100 (hoàn tác được, bản vẽ sạch lại)', ku);
    const hdK = await page.evaluate(() => { const li = [...document.getElementById('mncf-host').shadowRoot.querySelectorAll('[data-pane="hd"] li')].find(x => /^Khấu cột/.test(x.textContent.trim())); return li ? li.textContent : ''; });
    ok(/Rộng \(L\)[^.]*chỉ để xem/.test(hdK) && /1\.26\.1/.test(hdK) && /Cập nhật tủ này/.test(hdK) && /Sâu \/ Cao vẫn đổi được/.test(hdK), 'hướng dẫn, mục Khấu cột: tủ có cột giữa thì Rộng (L) của module chỉ để xem, đổi ở bảng', hdK.slice(-420));
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

    /* --- (bản 1.34) BỘ BẾP: vẽ cả dãy vào Chenfeng — D.veDay (mỗi tủ một module, cạnh B chữ L xoay −90), dừng + Vẽ tiếp, Cập nhật bộ (chỉ tủ đổi), Hoàn tác bộ theo mã tủ --- */
    {
      const st = () => page.evaluate(() => document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent);
      const choSt = (re, ms) => page.waitForFunction(r => new RegExp(r).test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), re, { timeout: ms || 240000 });
      const soHoi = () => page.evaluate(() => (window.__MOCK_HOI__ || []).length), choHoi = n => page.waitForFunction(k => (window.__MOCK_HOI__ || []).length >= k && window.MNCFDriver.busy(), n, { timeout: 8000 });
      await page.evaluate(async () => { const D = window.MNCFDriver; await D.erase(D.all()); });
      await H.locator('.tab[data-tab="tu"]').click();
      if (await H.locator('footer [data-act="unlink"]').isVisible()) await H.locator('footer [data-act="unlink"]').click();
      // "việc của người dùng": một tủ tự vẽ trước khi vẽ bộ
      const nguoi = await page.evaluate(async s => { const D = window.MNCFDriver, r = await D.draw(s, { at: [-30000, 0, 0] }); return { id: r.id, n: D.all().filter(e => D.isBoard(e) && D.tagOf(e) === r.id).length }; }, TU_2000);
      const conNguoi = id => page.evaluate(i => { const D = window.MNCFDriver; return D.all().filter(e => D.isBoard(e) && D.tagOf(e) === i).length; }, id);
      // đếm lời gọi: dò lỗi, Cập nhật tủ, lệnh gửi cho Chenfeng
      await page.evaluate(() => { const D = window.MNCFDriver; window.__dem = { doLoi: 0, update: 0, lenh: [] };
        for (const k of ['doLoi', 'update']) { const f = D[k]; D[k] = function () { window.__dem[k]++; return f.apply(this, arguments); }; }
        const cs = window.app.Editor.CommandStore, h = cs.HandleInput; cs.HandleInput = function (n) { window.__dem.lenh.push(String(n).toUpperCase()); return h.apply(this, arguments); }; });
      const dem = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__dem)));
      // hộp bao THẾ GIỚI từng tủ của bộ (theo mã trên tấm) so với chỗ tính ở lõi (Core.datDay → at + xoay): tấm của thiết kế, quay quanh at
      const soViTri = () => page.evaluate(() => {
        const D = window.MNCFDriver, C = window.MNCFCore, R = window.MNCF.app.getBoVe(), out = { tu: [], lech: [], chong: [], xoay: {} };
        const hop = es => es.reduce((a, e) => { const b = D.boxOf(e); return [Math.min(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.max(a[3], b[3]), Math.min(a[4], b[4]), Math.max(a[5], b[5])]; }, [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity]);
        for (const y of R.da_ve) {
          const sp = JSON.parse(localStorage.getItem('mncf.tu.' + y.id)).spec, M = C.build(sp), r = y.xoay * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), q = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity];
          for (const p of M.parts) for (const X of [p.x0, p.x1]) for (const Y of [p.y0, p.y1]) { const wx = y.at[0] + X * c - Y * s, wy = y.at[1] + X * s + Y * c; q[0] = Math.min(q[0], wx); q[1] = Math.max(q[1], wx); q[2] = Math.min(q[2], wy); q[3] = Math.max(q[3], wy); }
          for (const p of M.parts) { q[4] = Math.min(q[4], y.at[2] + p.z0); q[5] = Math.max(q[5], y.at[2] + p.z1); }
          const es = D.all().filter(e => D.isBoard(e) && D.tagOf(e) === y.id), h = hop(es);
          out.tu.push({ vt: y.vt, id: y.id, n: es.length, can: M.parts.length, h: h.map(v => Math.round(v * 10) / 10), z0: Math.round(h[4]) });
          if (!es.length || h.some((v, i) => Math.abs(v - q[i]) > 1)) out.lech.push([y.vt, h.map(Math.round), q.map(Math.round)]);
          out.xoay[y.vt] = y.xoay;
        }
        for (let i = 0; i < out.tu.length; i++) for (let j = i + 1; j < out.tu.length; j++) { const a = out.tu[i].h, b = out.tu[j].h; if (a[0] < b[1] - 0.5 && b[0] < a[1] - 0.5 && a[2] < b[3] - 0.5 && b[2] < a[3] - 0.5 && a[4] < b[5] - 0.5 && b[4] < a[5] - 0.5) out.chong.push([out.tu[i].vt, out.tu[j].vt]); }
        return out; });
      // vào Bộ bếp chữ I — E1 (4500, tủ lạnh 830 đầu trái, ống 3700)
      await H.locator('#mncf-ui-mau').selectOption('@BO-I'); await H.locator('[data-act="mau"]').click();
      const bo1 = { kieu: 'I', canh: [{ dai: 4500 }], tl: { may: 'bon_canh_830', dau: 'dau', ban_le: 'tuong' }, ong: { canh: 0, s: 3700 } };
      await page.evaluate(b => window.MNCF.app.setBo(b), bo1);
      ok(await H.locator('footer .bohang').isVisible() && !(await H.locator('footer [data-act="draw"]').isVisible()) && await H.locator('footer [data-act="bo-cho"]').isVisible(), 'Bộ bếp: chân bảng là hàng của bộ (Vẽ bộ bếp, Chỗ, Cập nhật, Hoàn tác) — nút vẽ tủ lẻ ẩn');
      ok(await H.locator('[data-act="bo-ve"]').isDisabled() && /Chỗ/.test(await H.locator('[data-act="bo-ve"]').getAttribute('title')), 'chưa chọn chỗ: nút Vẽ bộ bếp khoá, nói bấm “Chỗ”');
      // chọn chỗ: bấm đầu trái dãy ở chân tường (10000, 5000) rồi một điểm dọc tường
      { const h0 = await soHoi();
        await H.locator('[data-act="bo-cho"]').click(); await choHoi(h0 + 1);
        await page.evaluate(() => window.__MOCK__.clickPoint(10000, 5000, 0)); await choHoi(h0 + 2);
        ok((await page.evaluate(k => window.__MOCK_HOI__[k].goc, h0 + 1)), 'điểm thứ hai: có dây thun từ điểm đầu');
        await page.evaluate(() => window.__MOCK__.clickPoint(14000, 5000, 0));
        await choSt('Đã chọn chỗ', 8000); }
      eq_(await page.evaluate(() => window.MNCF.app.getBoCho()), { goc: [10000, 5000, 0], xoay: 0 }, 'chỗ đặt: đầu trái (10000, 5000), hướng 0°');
      const N1 = (await page.evaluate(() => window.MNCF.app.getBoKq())).pa[0].ds.length;
      ok(!(await H.locator('[data-act="bo-ve"]').isDisabled()) && new RegExp(`Vẽ bộ bếp \\(${N1} tủ\\)`).test(await H.locator('[data-act="bo-ve"]').innerText()), `có chỗ: nút "Vẽ bộ bếp (${N1} tủ)" bật`, await H.locator('[data-act="bo-ve"]').innerText());
      ok(/dài đo được ≈ 4000/.test(await st()), 'điểm thứ hai gần hơn dài bảng: nói rõ dài lấy theo ô Dài', await st());
      // vẽ: tủ thứ 2 hỏng (máy chủ / mẫu lỗi) → dừng sau 1 tủ, KHÔNG hoàn tác gì
      const r1 = await page.evaluate(() => window.MNCF.app.veBo({ onTu: i => { if (i === 0) window.__MOCK_FAIL_IMPORT__ = true; } }));
      await page.evaluate(() => { window.__MOCK_FAIL_IMPORT__ = false; });
      ok(r1 && !r1.ok && r1.xong === 1 && r1.da_ve === 1 && r1.dung && r1.dung.i === 1 && r1.dung.ly_do === 'hong', 'tủ thứ 2 hỏng: dừng, 1 tủ đã vẽ', r1);
      ok(new RegExp(`Đã vẽ 1/${N1} tủ — dừng`).test(await st()) && /Vẽ tiếp/.test(await st()) && await H.locator('[data-act="bo-ve-tiep"]').isVisible(), 'báo "Đã vẽ 1/N — dừng … Vẽ tiếp", hiện nút Vẽ tiếp', await st());
      ok(!(await dem()).lenh.includes('UNDO') && (await conNguoi(nguoi.id)) === nguoi.n, 'dừng: không gửi UNDO nào, tủ của người dùng còn nguyên', (await dem()).lenh);
      // Vẽ tiếp — người dùng chen một lệnh của họ (đang hỏi chọn tấm) sau tủ thứ 2: bảng dừng, KHÔNG Esc lệnh đó
      const huy0 = await page.evaluate(() => window.__MOCK_CANCELS__ || 0);
      const r2 = await page.evaluate(() => window.MNCF.app.veBo({ tiep: true, onTu: async i => { if (i === 1) { await new Promise(q => setTimeout(q, 200)); window.app.Editor.CommandStore.HandleInput('DRAWHOLE'); } } }));
      ok(r2 && r2.dung && r2.dung.ly_do === 'ban' && r2.xong === 2 && r2.da_ve === 3 && (await page.evaluate(() => window.__MOCK_CANCELS__ || 0)) === huy0 && (await page.evaluate(() => window.MNCFDriver.busy())), 'người dùng chen lệnh: dừng trước tủ kế, không Esc lệnh của họ (lệnh vẫn đang hỏi)', [r2, huy0]);
      ok(/Chenfeng đang chạy dở một lệnh khác/.test(await st()), 'báo: Chenfeng đang chạy dở lệnh khác — làm xong rồi Vẽ tiếp', await st());
      await page.evaluate(async () => { await window.MNCFDriver.cancel(); });      // người dùng tự Esc lệnh của họ
      await page.evaluate(() => { window.__dem.doLoi = 0; window.__dem.lenh = []; });
      await H.locator('[data-act="bo-ve-tiep"]').click();
      await choSt('Đã vẽ bộ bếp B\\d');
      { const d = await dem(), v = await soViTri(), R = await page.evaluate(() => window.MNCF.app.getBoVe());
        ok(R.da_ve.length === N1 && new Set(R.da_ve.map(y => y.vt)).size === N1 && new Set(R.da_ve.map(y => y.id)).size === N1, `Vẽ tiếp: đủ ${N1} tủ, mỗi mã vị trí một tủ (tủ đã có không vẽ lại)`, R.da_ve.map(y => y.vt));
        ok(v.tu.every(t => t.n === t.can) && v.lech.length === 0, 'mỗi tủ đủ tấm, đúng chỗ tính ở lõi (lưng sát tường y 5000)', [v.tu.filter(t => t.n !== t.can), v.lech]);
        ok(v.tu.filter(t => /T\d/.test(t.vt)).every(t => t.z0 === 1560) && v.tu.filter(t => !/T\d/.test(t.vt)).every(t => t.z0 === 0) && Object.values(v.xoay).every(a => a === 0), 'tủ trên treo z 1560, tủ dưới / cao đứng sàn, xoay 0', v.tu.map(t => [t.vt, t.z0]));
        eq_(v.chong, [], 'các tủ của bộ không chồng nhau');
        ok(d.doLoi === 1, 'dò lỗi sản xuất MỘT lần cuối dãy (không dò sau từng tủ)', d.doLoi);
        ok(await page.evaluate(ids => { const D = window.MNCFDriver; return ids.every(id => D.all().some(e => D.isBoard(e) && D.tagOf(e) === id && e.Template)); }, R.da_ve.map(y => y.id)), 'mỗi tủ là một module (tấm nằm trong mẫu của Chenfeng)');
        ok(/Bộ B\d đã vẽ/.test(await H.locator('[data-act="bo-ve"]').innerText()) && await H.locator('[data-act="bo-ve"]').isDisabled() && !(await H.locator('[data-act="bo-cap-nhat"]').isDisabled()) && !(await H.locator('[data-act="bo-hoan-tac"]').isDisabled()) && !(await H.locator('[data-act="bo-ve-tiep"]').isVisible()), 'vẽ xong: nút chính ghi "Bộ … đã vẽ", bật Cập nhật / Hoàn tác, ẩn Vẽ tiếp'); }
      // Cập nhật bộ: ghim A4 (tủ cánh 400) thành tủ 3 ngăn kéo 400 → CHỈ một lần Cập nhật tủ
      { const p = (await page.evaluate(() => window.MNCF.app.getBoKq())).pa[0], a4 = p.ds.find(m => m.ma === 'BD-CANH-400' && m.tang === 'duoi'), R0 = await page.evaluate(() => window.MNCF.app.getBoVe());
        await page.evaluate(([b, vt, s0]) => window.MNCF.app.setBo(Object.assign({}, b, { khoa: { [vt]: { ma: 'BD-NK3-400', s0, canh: 0 } } })), [bo1, a4.vt, a4.s0]);
        await page.evaluate(() => { window.__dem.doLoi = 0; window.__dem.update = 0; window.__dem.lenh = []; });
        await H.locator('[data-act="bo-cap-nhat"]').click();
        await choSt('Đã cập nhật bộ|Cập nhật bộ .* dừng');
        const d = await dem(), R = await page.evaluate(() => window.MNCF.app.getBoVe()), v = await soViTri();
        ok(/Đã cập nhật bộ B\d: 1 tủ cập nhật tại chỗ, 0 tủ bỏ, 0 tủ vẽ mới/.test(await st()) && d.update === 1 && d.doLoi === 1, 'Cập nhật bộ: đổi 1 tủ → đúng MỘT lần Cập nhật tủ, một lần dò lỗi', [await st(), d.update, d.doLoi]);
        const id4 = R0.da_ve.find(y => y.vt === a4.vt).id;
        ok(JSON.stringify(R.da_ve.map(y => y.id).sort()) === JSON.stringify(R0.da_ve.map(y => y.id).sort()) && (await page.evaluate(id => JSON.parse(localStorage.getItem('mncf.tu.' + id)).spec.bep.chuc_nang, id4)) === 'nk', 'tủ đổi giữ mã tủ, thông số đã lưu là tủ ngăn kéo; các tủ khác giữ mã', R.da_ve.map(y => y.vt));
        ok(v.lech.length === 0 && v.chong.length === 0 && v.tu.every(t => t.n === t.can), 'sau Cập nhật: mọi tủ đúng chỗ, không chồng', [v.lech, v.chong]);
        await H.locator('[data-act="bo-cap-nhat"]').click();
        await choSt('đã đúng như bảng', 8000);
        ok(true, 'bấm Cập nhật lần nữa: không có gì để làm'); }
      // người dùng vẽ thêm sau khi vẽ bộ; Hoàn tác bộ: bỏ đúng các tủ của bộ theo mã, việc của người dùng còn nguyên, không UNDO
      { const nguoi2 = await page.evaluate(async s => { const D = window.MNCFDriver, r = await D.draw(s, { at: [-40000, 0, 0] }); return { id: r.id, n: D.all().filter(e => D.isBoard(e) && D.tagOf(e) === r.id).length }; }, TU_2000);
        const ids = (await page.evaluate(() => window.MNCF.app.getBoVe())).da_ve.map(y => y.id);
        await page.evaluate(() => { window.__dem.lenh = []; });
        await H.locator('[data-act="bo-hoan-tac"]').click();
        await choSt('Đã bỏ bộ bếp|Hoàn tác bộ .* dừng', 120000);
        const con = await page.evaluate(ids => { const D = window.MNCFDriver; return [D.all().filter(e => D.isBoard(e) && ids.includes(D.tagOf(e))).length, D.all().filter(e => !e.IsErase && e.box && e.box[0] > 9000 && e.box[1] < 15000).length]; }, ids);
        ok(/Đã bỏ bộ bếp B\d khỏi bản vẽ/.test(await st()) && con[0] === 0 && con[1] === 0, 'Hoàn tác bộ: mọi tấm / mẫu / lỗ của bộ đã bỏ', [await st(), con]);
        ok((await conNguoi(nguoi.id)) === nguoi.n && (await conNguoi(nguoi2.id)) === nguoi2.n && !(await dem()).lenh.includes('UNDO'), 'Hoàn tác bộ theo mã tủ: hai tủ người dùng (vẽ trước + vẽ chen sau) còn nguyên, không UNDO', (await dem()).lenh);
        ok(await page.evaluate(() => window.MNCF.app.getBoVe() === null) && !(await H.locator('[data-act="bo-ve"]').isDisabled()) && await H.locator('[data-act="bo-hoan-tac"]').isDisabled(), 'sau Hoàn tác: bộ chưa vẽ, nút Vẽ bộ bếp bật lại'); }
      // CHỮ L — E2 (A 3050, B 2450 đầu hở, góc Higold 900 / 400, bếp cạnh B): góc trong (80000, 0), tường A về bên trái, tường B đi xuống −y → rẽ phải
      { const bo2 = { kieu: 'L', canh: [{ dai: 3050, dau: 'tuong' }, { dai: 2450, cuoi: 'ho' }], tl: null, ong: { canh: 0, s: 3050 - 2130 }, bep: { canh: 1 } };
        await page.evaluate(b => window.MNCF.app.setBo(b), bo2);
        const h0 = await soHoi();
        await H.locator('[data-act="bo-cho"]').click(); await choHoi(h0 + 1);
        await page.evaluate(() => window.__MOCK__.clickPoint(80000, 0, 0)); await choHoi(h0 + 2);
        await page.evaluate(() => window.__MOCK__.clickPoint(80000 - 3050, 0, 0)); await choHoi(h0 + 3);
        await page.evaluate(() => window.__MOCK__.clickPoint(80000, -2450, 0));
        await choSt('Đã chọn chỗ', 8000);
        eq_(await page.evaluate(() => window.MNCF.app.getBoCho()), { goc: [80000, 0, 0], xoay: 0 }, 'chữ L: chỗ đặt = góc trong, hướng cạnh A 0°');
        ok((await page.evaluate(() => window.MNCF.app.getBo().canh[1].re)) === 'phai', 'chữ L: rẽ phải theo điểm bấm');
        const N2 = (await page.evaluate(() => window.MNCF.app.getBoKq())).pa[0].ds.length;
        await page.evaluate(() => { window.__dem.doLoi = 0; });
        await H.locator('[data-act="bo-ve"]').click();
        await choSt('Đã vẽ bộ bếp B\\d|dừng');
        const v = await soViTri(), R = await page.evaluate(() => window.MNCF.app.getBoVe());
        ok(R && R.da_ve.length === N2 && /Đã vẽ bộ bếp/.test(await st()), `chữ L: đủ ${N2} tủ`, [await st(), R && R.da_ve.length]);
        ok(R.da_ve.filter(y => /^B/.test(y.vt)).every(y => y.xoay === -90) && R.da_ve.filter(y => /^A/.test(y.vt)).every(y => y.xoay === 0) && R.da_ve.some(y => /^B/.test(y.vt)), 'chữ L: tủ cạnh B xoay −90, cạnh A xoay 0', R.da_ve.map(y => [y.vt, y.xoay]));
        ok(v.lech.length === 0 && v.tu.every(t => t.n === t.can), 'chữ L: mọi tủ đủ tấm, đúng chỗ (cạnh B quay lưng vào tường B ở x 80000)', [v.lech, v.tu.filter(t => t.n !== t.can)]);
        eq_(v.chong, [], 'chữ L: tủ góc mù cạnh A và các tủ cạnh B không chồng nhau');
        ok((await dem()).doLoi === 1, 'chữ L: dò lỗi một lần cuối dãy', (await dem()).doLoi);
        // Cập nhật một tủ cạnh B (đã xoay −90): ghim tủ gia vị thành tủ cùng rộng khác → chỉ tủ đó vẽ lại, giữ mã tủ, vẫn đúng chỗ
        { const p = (await page.evaluate(() => window.MNCF.app.getBoKq())).pa[0], g = p.ds.find(m => m.canh === 1 && m.tang === 'duoi' && m.chuc === 'gv'), R0 = await page.evaluate(() => window.MNCF.app.getBoVe());
          const ma = await page.evaluate(w => window.MNCFCore.MAU_BEP_DUOI.find(x => new RegExp(`-${w}$`).test(x.ma) && ['gv', 'chau', 'bep', 'goc'].indexOf(x.chuc_nang) < 0).ma, g.rong);
          await page.evaluate(([b, vt, s0, ma]) => { const o = window.MNCF.app.getBo(); o.khoa = { [vt]: { ma, s0, canh: 1 } }; window.MNCF.app.setBo(o); }, [bo2, g.vt, g.s0 + ((g.nep && g.nep.trai) || 0), ma]);
          await page.evaluate(() => { window.__dem.update = 0; window.__dem.lenh = []; });
          await H.locator('[data-act="bo-cap-nhat"]').click();
          await choSt('Đã cập nhật bộ|Cập nhật bộ .* dừng');
          const R = await page.evaluate(() => window.MNCF.app.getBoVe()), v2 = await soViTri(), id = R0.da_ve.find(y => y.vt === g.vt).id;
          ok(/Đã cập nhật bộ B\d: 1 tủ cập nhật tại chỗ, 0 tủ bỏ, 0 tủ vẽ mới/.test(await st()) && (await dem()).update === 1 && R.da_ve.find(y => y.vt === g.vt).id === id, `chữ L: đổi tủ ${g.vt} cạnh B (${ma}) → chỉ tủ đó, giữ mã tủ`, [await st(), ma]);
          ok(v2.lech.length === 0 && v2.chong.length === 0 && v2.tu.every(t => t.n === t.can) && (await page.evaluate(i => JSON.parse(localStorage.getItem('mncf.tu.' + i)).spec.bep.chuc_nang, id)) !== 'gv', 'chữ L sau Cập nhật: tủ mới đúng chỗ, xoay −90, không chồng', [v2.lech, v2.chong]); }
        await H.locator('[data-act="bo-hoan-tac"]').click();
        await choSt('Đã bỏ bộ bếp|Hoàn tác bộ .* dừng', 120000);
        ok((await page.evaluate(() => { const D = window.MNCFDriver; return D.all().filter(e => !e.IsErase && e.box && e.box[0] > 70000).length; })) === 0, 'chữ L: Hoàn tác bộ sạch'); }
      // (vòng soát 1.34) bộ E3 (3170) ở chỗ trống x 120000: (a) sửa bộ sau lần vẽ dừng → không Vẽ tiếp lên bố cục cũ, Cập nhật sửa + vẽ nốt;
      // (b) máy mất thông số lúc vẽ của một tủ bị bỏ khỏi dãy → Cập nhật vẫn bỏ nó (tìm theo mã); (c) bấm đổi món giữa lúc vẽ bộ → không cho, bộ vẫn ghi đủ
      { const bo3 = { ma: 'B7', kieu: 'I', canh: [{ dai: 3170 }], tl: null, ong: { canh: 0, s: 2300 } };
        const tamCua = id => page.evaluate(i => { const D = window.MNCFDriver; return D.all().filter(e => D.isBoard(e) && D.tagOf(e) === i).length; }, id);
        await page.evaluate(b => window.MNCF.app.setBo(b), bo3);
        await page.evaluate(() => window.MNCF.app.setBoCho({ goc: [120000, 5000, 0], xoay: 0 }));
        const r1 = await page.evaluate(() => window.MNCF.app.veBo({ onTu: i => { if (i === 0) window.__MOCK_FAIL_IMPORT__ = true; } }));
        await page.evaluate(() => { window.__MOCK_FAIL_IMPORT__ = false; });
        ok(r1 && r1.da_ve === 1 && r1.dung, 'B7: vẽ dừng sau 1 tủ', r1);
        await page.evaluate(b => window.MNCF.app.setBo(Object.assign({}, b, { canh: [{ dai: 3300 }] })), bo3);
        ok(!(await H.locator('[data-act="bo-ve-tiep"]').isVisible()), 'sửa bộ sau lần vẽ dừng (tủ A1 đã vẽ khác dãy mới): ẩn Vẽ tiếp');
        const r2 = await page.evaluate(() => window.MNCF.app.veBo({ tiep: true }));
        ok(r2 && !r2.ok && r2.lech && r2.xong === 0 && r2.da_ve === 1 && /Cập nhật/.test(await st()), 'Vẽ tiếp lên bố cục đã đổi: không vẽ, nói bấm Cập nhật', [r2, await st()]);
        await H.locator('[data-act="bo-cap-nhat"]').click();
        await choSt('Đã cập nhật bộ|Cập nhật bộ .* dừng');
        { const v = await soViTri(), R = await page.evaluate(() => window.MNCF.app.getBoVe()), N = (await page.evaluate(() => window.MNCF.app.getBoKq())).pa[0].ds.length;
          ok(/Đã cập nhật bộ B7/.test(await st()) && R.da_ve.length === N && v.lech.length === 0 && v.chong.length === 0 && v.tu.every(t => t.n === t.can), `Cập nhật: tủ đã vẽ theo dãy mới + vẽ nốt — đủ ${N} tủ, đúng chỗ, không chồng`, [await st(), R.da_ve.length, v.lech, v.chong]); }
        // (b) A6 (tủ cánh 450 của dãy 3300) không còn ở dãy 2600; máy đã mất thông số lúc vẽ của nó
        { const R0 = await page.evaluate(() => window.MNCF.app.getBoVe()), a6 = R0.da_ve.find(y => y.vt === 'A6');
          ok(a6 && (await tamCua(a6.id)) > 0, 'A6 đang có trên bản vẽ', R0.da_ve.map(y => y.vt));
          await page.evaluate(id => localStorage.removeItem('mncf.tu.' + id), a6.id);
          await page.evaluate(b => window.MNCF.app.setBo(Object.assign({}, b, { canh: [{ dai: 2600 }] })), bo3);
          await page.evaluate(() => { document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent = ''; });      // dòng báo của lần Cập nhật trước khớp sẵn mẫu chờ — xoá để chờ đúng lần này
          await H.locator('[data-act="bo-cap-nhat"]').click();
          await choSt('Đã cập nhật bộ|Cập nhật bộ .* dừng');
          const R = await page.evaluate(() => window.MNCF.app.getBoVe()), v = await soViTri();
          ok((await tamCua(a6.id)) === 0 && !R.da_ve.some(y => y.vt === 'A6') && R.da_ve.length === R.tong && v.chong.length === 0, 'Cập nhật bỏ cả tủ máy đã mất thông số (tìm theo mã tủ): không còn trên bản vẽ, không còn trong bản ghi', [await st(), R.da_ve.map(y => y.vt)]); }
        await H.locator('[data-act="bo-hoan-tac"]').click();
        await choSt('Đã bỏ bộ bếp|Hoàn tác bộ .* dừng', 120000);
        // (c) đổi món giữa lúc vẽ bộ
        const r3 = await page.evaluate(() => window.MNCF.app.veBo({ onTu: i => { if (i === 1) { const h = document.getElementById('mncf-host').shadowRoot; h.querySelector('#mncf-ui-mau').value = ''; h.querySelector('[data-act="mau"]').click(); } } }));
        { const R = await page.evaluate(() => window.MNCF.app.getBoVe()), luu = await page.evaluate(() => JSON.parse(localStorage.getItem('mncf.tu.bo:B7')).spec);
          ok(r3 && r3.ok && R && R.da_ve.length === r3.tong && luu.da_ve.length === r3.tong && (await page.evaluate(() => window.MNCF.app.getBo())) !== null, 'bấm "Dùng mẫu" giữa lúc vẽ bộ: không đổi món, bộ vẽ xong và ghi đủ mọi tủ', [r3, R && R.da_ve.length, luu.da_ve.length]); }
        await H.locator('[data-act="bo-hoan-tac"]').click();
        await choSt('Đã bỏ bộ bếp|Hoàn tác bộ .* dừng', 120000);
        ok((await page.evaluate(() => { const D = window.MNCFDriver; return D.all().filter(e => !e.IsErase && e.box && e.box[0] > 110000).length; })) === 0, 'B7: Hoàn tác bộ sạch'); }
      // (vòng soát 2 — 1.34) mỗi lỗi một phép thử: phương án đã vẽ nhớ được; đổi kiểu I ↔ L là bộ mới; tủ chưa trọn (chưa xoay / thiếu mẫu / chưa gom module) không bị nuốt;
      // Hoàn tác bộ khi tủ chưa gom được module vẫn bỏ sạch hộp ngăn kéo
      { const vung = x0 => page.evaluate(x => { const D = window.MNCFDriver; return D.all().filter(e => !e.IsErase && e.box && e.box[0] > x).length; }, x0);
        const bo8 = { ma: 'B8', kieu: 'I', canh: [{ dai: 3170 }], tl: null, ong: { canh: 0, s: 2300 } };
        await page.evaluate(b => window.MNCF.app.setBo(b), bo8);
        await page.evaluate(() => window.MNCF.app.setBoCho({ goc: [160000, 5000, 0], xoay: 0 }));
        ok((await page.evaluate(() => window.MNCF.app.getBoKq())).pa.length > 1, 'B8: có ≥ 2 phương án');
        await H.locator('[data-act="bo-pa"][data-v="1"]').first().click();
        const r8 = await page.evaluate(() => window.MNCF.app.veBo({}));
        ok(r8 && r8.ok && (await page.evaluate(() => window.MNCF.app.getBoKq().i)) === 1, 'B8: vẽ theo phương án 2', r8);
        // (10) rời bộ rồi vào lại: bảng chọn đúng phương án đã vẽ — Cập nhật không xếp lại cả dãy
        await H.locator('#mncf-ui-mau').selectOption(''); await H.locator('[data-act="mau"]').click();
        await H.locator('#mncf-ui-mau').selectOption('@BO-I'); await H.locator('[data-act="mau"]').click();
        ok((await page.evaluate(() => window.MNCF.app.getBo().ma)) === 'B8' && (await page.evaluate(() => window.MNCF.app.getBoKq().i)) === 1 && (await page.evaluate(() => (window.MNCF.app.getBoVe() || { da_ve: [] }).da_ve.length)) === r8.tong, 'vào lại bộ B8: phương án đang xem = phương án đã vẽ (2)', await page.evaluate(() => window.MNCF.app.getBoKq().i));
        await H.locator('[data-act="bo-cap-nhat"]').click();
        await choSt('đã đúng như bảng|Đã cập nhật bộ|Cập nhật bộ .* dừng');
        ok(/đã đúng như bảng/.test(await st()), 'vào lại rồi Cập nhật (không sửa gì): không tủ nào phải vẽ lại', await st());
        // (8) đổi sang chữ L (Thư viện "Bộ bếp chữ L" hoặc chip Chữ L): bộ MỚI, không bám bản ghi + chỗ đặt của bộ chữ I đã vẽ
        await H.locator('#mncf-ui-mau').selectOption('@BO-L'); await H.locator('[data-act="mau"]').click();
        { const b = await page.evaluate(() => window.MNCF.app.getBo());
          ok(b.kieu === 'L' && b.ma !== 'B8' && (await page.evaluate(() => window.MNCF.app.getBoVe())) === null && (await page.evaluate(() => window.MNCF.app.getBoCho())) === null && !/đã vẽ/.test(await H.locator('[data-act="bo-ve"]').innerText()) && await H.locator('[data-act="bo-cap-nhat"]').isDisabled(), 'Thư viện → Bộ bếp chữ L: bộ mới (mã khác), chưa vẽ, chưa có chỗ — Cập nhật khoá', [b.ma, await H.locator('[data-act="bo-ve"]').innerText()]); }
        await H.locator('[data-act="lui"]').click();
        ok((await page.evaluate(() => window.MNCF.app.getBo().ma)) === 'B8' && (await page.evaluate(() => (window.MNCF.app.getBoVe() || { da_ve: [] }).da_ve.length)) === r8.tong, '↶ Lùi: về bộ B8 đã vẽ');
        await H.locator('[data-act="bo-kieu"][data-v="L"]').click();
        { const b = await page.evaluate(() => window.MNCF.app.getBo());
          ok(b.kieu === 'L' && b.ma !== 'B8' && (await page.evaluate(() => window.MNCF.app.getBoVe())) === null && (await page.evaluate(() => window.MNCF.app.getBoCho())) === null && await H.locator('[data-act="bo-cap-nhat"]').isDisabled() && /bộ mới/.test(await st()), 'chip Chữ L: bộ mới, chọn lại chỗ — không Cập nhật được lên bộ chữ I', [b.ma, await st()]); }
        await H.locator('[data-act="lui"]').click();
        ok((await page.evaluate(() => window.MNCF.app.getBo().kieu)) === 'I' && (await page.evaluate(() => (window.MNCF.app.getBoVe() || { da_ve: [] }).da_ve.length)) === r8.tong, '↶ Lùi: về bộ B8');
        await H.locator('[data-act="bo-hoan-tac"]').click();
        await choSt('Đã bỏ bộ bếp|Hoàn tác bộ .* dừng', 120000);
        ok((await vung(150000)) === 0, 'B8: Hoàn tác bộ sạch');
        // (9a) ROTATE hỏng: tủ cạnh B nằm thẳng trục — bộ không báo xong trọn, bản ghi ghi đúng xoay thật, Cập nhật xoay lại
        const bo9 = { ma: 'B9', kieu: 'L', canh: [{ dai: 3050, dau: 'tuong' }, { dai: 2450, cuoi: 'ho', re: 'phai' }], tl: null, ong: { canh: 0, s: 3050 - 2130 }, bep: { canh: 1 } };
        await page.evaluate(b => window.MNCF.app.setBo(b), bo9);
        await page.evaluate(() => window.MNCF.app.setBoCho({ goc: [200000, 0, 0], xoay: 0 }));
        await page.evaluate(() => { const D = window.MNCFDriver; window.__rotGoc = D.rotate; D.rotate = async () => ({ ok: false, steps: 0, reason: 'giả lập: lệnh xoay không chạy' }); });
        const r9 = await page.evaluate(() => window.MNCF.app.veBo({}));
        await page.evaluate(() => { window.MNCFDriver.rotate = window.__rotGoc; });
        { const R = await page.evaluate(() => window.MNCF.app.getBoVe());
          ok(r9 && !r9.ok && r9.van_de.some(q => /^B/.test(q.vt) && q.tin.some(t => /xoay/.test(t))) && /chưa trọn/.test(await st()) && /xoay/.test(await st()), 'ROTATE hỏng: bộ không báo trọn — nói tủ nào chưa xoay', [r9 && r9.van_de, await st()]);
          ok(R.da_ve.filter(y => /^B/.test(y.vt)).every(y => y.xoay === 0), 'bản ghi: tủ cạnh B ghi xoay thật (0), không ghi −90', R.da_ve.map(y => [y.vt, y.xoay])); }
        await H.locator('[data-act="bo-cap-nhat"]').click();
        await choSt('Đã cập nhật bộ|Cập nhật bộ .* dừng');
        { const v = await soViTri(); ok(/Đã cập nhật bộ B9/.test(await st()) && !/chưa trọn/.test(await st()) && v.lech.length === 0 && v.chong.length === 0 && Object.entries(v.xoay).every(([vt, a]) => a === (/^B/.test(vt) ? -90 : 0)), 'Cập nhật: tủ cạnh B vẽ lại, xoay −90, đúng chỗ', [await st(), v.lech, v.xoay]); }
        await H.locator('[data-act="bo-hoan-tac"]').click();
        await choSt('Đã bỏ bộ bếp|Hoàn tác bộ .* dừng', 120000);
        ok((await vung(190000)) === 0, 'B9: Hoàn tác bộ sạch');
        // (9b) mẫu ngăn kéo tải hỏng: tủ thiếu hộp ngăn kéo — bộ nói rõ, Cập nhật (mạng ổn lại) vẽ lại đúng các tủ đó
        await page.evaluate(b => window.MNCF.app.setBo(Object.assign({}, b, { ma: 'B10' })), bo8);
        await page.evaluate(() => window.MNCF.app.setBoCho({ goc: [240000, 5000, 0], xoay: 0 }));
        await page.evaluate(() => { window.__MOCK_MAU_LOI__ = new Proxy({}, { get: (t, k) => (t[k] = t[k] || { lan: 99, kieu: 'may_chu' }) }); });
        const r10 = await page.evaluate(() => window.MNCF.app.veBo({}));
        await page.evaluate(() => { window.__MOCK_MAU_LOI__ = null; });
        const thieu = (r10 && r10.van_de || []).filter(q => q.tin.some(t => /thiếu \d+ mẫu/.test(t))).map(q => q.vt);
        ok(r10 && !r10.ok && thieu.length > 0 && /chưa trọn/.test(await st()) && /thiếu \d+ mẫu/.test(await st()), 'mẫu ngăn kéo hỏng: bộ nói tủ nào thiếu mẫu, không báo xong trọn', [r10, await st()]);
        await page.evaluate(() => { window.__dem.update = 0; });
        await H.locator('[data-act="bo-cap-nhat"]').click();
        await choSt('Đã cập nhật bộ|Cập nhật bộ .* dừng');
        ok(new RegExp(`Đã cập nhật bộ B10: ${thieu.length} tủ cập nhật tại chỗ`).test(await st()) && !/chưa trọn/.test(await st()) && (await dem()).update === thieu.length, 'mạng ổn, Cập nhật: đúng các tủ thiếu mẫu được vẽ lại tại chỗ', [await st(), thieu]);
        await H.locator('[data-act="bo-cap-nhat"]').click();
        await choSt('đã đúng như bảng', 8000);
        ok(true, 'B10: Cập nhật lần nữa không còn gì');
        await H.locator('[data-act="bo-hoan-tac"]').click();
        await choSt('Đã bỏ bộ bếp|Hoàn tác bộ .* dừng', 120000);
        // (11) tủ không gom được module (MODELING hỏng) + cạnh B không dò lại được: Hoàn tác bộ vẫn bỏ sạch hộp ngăn kéo / lỗ
        await page.evaluate(b => window.MNCF.app.setBo(Object.assign({}, b, { ma: 'B11' })), bo9);
        await page.evaluate(() => window.MNCF.app.setBoCho({ goc: [300000, 0, 0], xoay: 0 }));
        await page.evaluate(() => { window.__MOCK_MODELING_FAIL__ = true; });
        const r11 = await page.evaluate(() => window.MNCF.app.veBo({}));
        await page.evaluate(() => { window.__MOCK_MODELING_FAIL__ = false; });
        ok(r11 && r11.da_ve === r11.tong && r11.van_de.some(q => q.tin.some(t => /module/.test(t))), 'MODELING hỏng: bộ nói tủ chưa gom được module', r11 && r11.van_de);
        ok((await vung(290000)) > 0, 'B11 có trên bản vẽ');
        await H.locator('[data-act="bo-hoan-tac"]').click();
        await choSt('Đã bỏ bộ bếp|Hoàn tác bộ .* dừng', 120000);
        ok(/Đã bỏ bộ bếp B11/.test(await st()) && (await vung(290000)) === 0, 'tủ chưa thành module: Hoàn tác bộ bỏ sạch cả hộp ngăn kéo, phụ kiện, lỗ', [await st(), await vung(290000)]); }
      // (vòng soát 3 — 1.34) mỗi lỗi một phép thử: Vẽ tiếp sau tủ chưa trọn; ↶ Lùi về bộ kiểu kia cùng mã; bản vẽ khác không xoá bản ghi; chip kiểu lúc đang vẽ; Thôi sửa bỏ bep.day
      { const vung = x0 => page.evaluate(x => { const D = window.MNCFDriver; return D.all().filter(e => !e.IsErase && e.box && e.box[0] > x).length; }, x0);
        const boI = { kieu: 'I', canh: [{ dai: 3170 }], tl: null, ong: { canh: 0, s: 2300 } };
        const hoanTac = async () => { await H.locator('[data-act="bo-hoan-tac"]').click(); await choSt('Đã bỏ bộ bếp|Hoàn tác bộ .* dừng', 120000); };
        // (10) tủ thiếu mẫu (chưa trọn) rồi một tủ hỏng → dừng: nút Vẽ tiếp hiện, lời báo nêu tủ chưa trọn; Vẽ tiếp vẽ nốt; Cập nhật vẽ lại tủ chưa trọn
        await page.evaluate(b => window.MNCF.app.setBo(Object.assign({}, b, { ma: 'B12' })), boI);
        await page.evaluate(() => window.MNCF.app.setBoCho({ goc: [400000, 5000, 0], xoay: 0 }));
        await page.evaluate(() => { window.__MOCK_MAU_LOI__ = new Proxy({}, { get: (t, k) => (t[k] = t[k] || { lan: 99, kieu: 'may_chu' }) }); });
        const r12 = await page.evaluate(() => window.MNCF.app.veBo({ onTu: i => { if (i === 4) { window.__MOCK_MAU_LOI__ = null; window.__MOCK_FAIL_IMPORT__ = true; } } }));
        await page.evaluate(() => { window.__MOCK_MAU_LOI__ = null; window.__MOCK_FAIL_IMPORT__ = false; });
        const ct = (r12 && r12.van_de || []).map(q => q.vt);
        ok(r12 && r12.dung && ct.length > 0, 'B12: có tủ chưa trọn rồi dừng', r12);
        ok(await H.locator('[data-act="bo-ve-tiep"]').isVisible() && /Vẽ tiếp/.test(await st()) && new RegExp(ct[0]).test(await st()) && /chưa trọn/.test(await st()), 'dừng sau tủ chưa trọn: nút Vẽ tiếp HIỆN, lời báo nêu tủ chưa trọn', [await st(), await H.locator('[data-act="bo-ve-tiep"]').isVisible()]);
        const r12b = await page.evaluate(() => window.MNCF.app.veBo({ tiep: true }));
        ok(r12b && !r12b.lech && r12b.da_ve === r12b.tong && !/đã sửa sau lần vẽ dừng/.test(await st()) && /Cập nhật/.test(await st()) && new RegExp(ct[0]).test(await st()), 'Vẽ tiếp: vẽ nốt (không từ chối "đã sửa"), lời báo nhắc Cập nhật tủ chưa trọn', [r12b, await st()]);
        await H.locator('[data-act="bo-cap-nhat"]').click();
        await choSt('Đã cập nhật bộ|Cập nhật bộ .* dừng');
        ok(new RegExp(`Đã cập nhật bộ B12: ${ct.length} tủ cập nhật tại chỗ`).test(await st()), 'Cập nhật: vẽ lại đúng tủ chưa trọn', [await st(), ct]);
        // (5) Sửa một tủ của dãy → Thôi sửa: tủ vẽ mới là tủ lẻ — không còn bep.day, bảng kê có lại dòng Mặt đá
        { const id = (await page.evaluate(() => window.MNCF.app.getBoVe())).da_ve.find(y => y.vt === 'A1').id;
          await page.evaluate(id => { const D = window.MNCFDriver; window.__MOCK__.userSelect([D.all().find(e => D.isBoard(e) && D.tagOf(e) === id)]); }, id);
          await H.locator('.tab[data-tab="tu"]').click();
          await H.locator('#mncf-ui-mau').selectOption(''); await H.locator('[data-act="mau"]').click();      // rời bộ: chân bảng về hàng tủ lẻ (nút Sửa tủ)
          if (!(await H.locator('[data-act="pick"]').isVisible())) await H.locator('[data-act="nut-them"]').click();      // nút Sửa tủ nằm sau ⋯
          await H.locator('[data-act="pick"]').click();
          ok((await page.evaluate(() => { const s = window.MNCF.app.getSpec(); return !!(s.bep && s.bep.day && s.bep.day.ma === 'B12'); })), 'Sửa tủ A1 của bộ: thông số mang bep.day (vẫn thuộc dãy)');
          // (vòng soát 4) đang Sửa A1 mà bấm "Tủ mới" và lần vẽ hỏng: bep.day GIỮ (Cập nhật A1 không biến nó thành tủ lẻ — đá kê hai lần)
          await page.evaluate(() => { window.__MOCK_FAIL_IMPORT__ = true; });
          const rh = await page.evaluate(() => window.MNCF.app.draw({ corner: [900000, 0, 0] }));
          await page.evaluate(() => { window.__MOCK_FAIL_IMPORT__ = false; });
          ok((await page.evaluate(() => document.getElementById('mncf-host').shadowRoot.querySelector('.panel').dataset.tabon)) === 'kq', 'Tủ mới hỏng: bảng chuyển sang thẻ Kết quả (nút chân thẻ Tủ ẩn theo thẻ)');
          await H.locator('.tab[data-tab="tu"]').click();      // nút Cập nhật / Thôi sửa là nút chân thẻ Tủ
          ok(rh && rh.giai_doan !== 'xong' && (await page.evaluate(() => { const s = window.MNCF.app.getSpec(); return !!(s.bep && s.bep.day && s.bep.day.ma === 'B12'); })) && await H.locator('footer [data-act="redraw"]').isVisible(), 'Sửa A1 → Tủ mới hỏng: thông số vẫn mang bep.day, vẫn nối A1', rh && rh.giai_doan);
          await H.locator('footer [data-act="unlink"]').click();
          ok(await page.evaluate(() => { const s = window.MNCF.app.getSpec(), C = window.MNCFCore; return !(s.bep && s.bep.day) && !!C.cutList(C.build(s)).gia_cong_da; }), 'Thôi sửa: bỏ bep.day — tủ lẻ có lại dòng Mặt đá'); }
        await H.locator('#mncf-ui-mau').selectOption('@BO-I'); await H.locator('[data-act="mau"]').click();
        ok((await page.evaluate(() => window.MNCF.app.getBo().ma)) === 'B12' && ((await page.evaluate(() => window.MNCF.app.getBoVe())) || { da_ve: [] }).da_ve.length > 0, 'về bộ B12 (đã vẽ)');
        // (9) "bản vẽ khác" (không tủ nào của bộ trên bản vẽ): vào Bộ bếp KHÔNG xoá bản ghi; về bản vẽ cũ vẫn Hoàn tác / Cập nhật được
        await H.locator('#mncf-ui-mau').selectOption(''); await H.locator('[data-act="mau"]').click();
        await H.locator('#mncf-ui-mau').selectOption('@BO-I'); await H.locator('[data-act="mau"]').click();
        { const n0 = await page.evaluate(() => JSON.parse(localStorage.getItem('mncf.tu.bo:B12')).spec.da_ve.length);
          await page.evaluate(() => { const D = window.MNCFDriver; window.__allGoc = D.all; D.all = () => []; });
          await H.locator('#mncf-ui-mau').selectOption(''); await H.locator('[data-act="mau"]').click();
          await H.locator('#mncf-ui-mau').selectOption('@BO-I'); await H.locator('[data-act="mau"]').click();
          const ma = (await page.evaluate(() => window.MNCF.app.getBo())).ma, n1 = await page.evaluate(() => JSON.parse(localStorage.getItem('mncf.tu.bo:B12')).spec.da_ve.length);
          ok(ma === 'B12' && n0 > 0 && n1 === n0 && (await page.evaluate(() => window.MNCF.app.getBoVe())) === null, 'bản vẽ khác: bộ B12 không có ở đây (không nhận) nhưng bản ghi giữ nguyên', [ma, n0, n1]);
          await page.evaluate(() => { const D = window.MNCFDriver; D.all = window.__allGoc; });
          await H.locator('#mncf-ui-mau').selectOption(''); await H.locator('[data-act="mau"]').click();
          await H.locator('#mncf-ui-mau').selectOption('@BO-I'); await H.locator('[data-act="mau"]').click();
          ok(((await page.evaluate(() => window.MNCF.app.getBoVe())) || { da_ve: [] }).da_ve.length === n0 && !(await H.locator('[data-act="bo-hoan-tac"]').isDisabled()), 'về bản vẽ cũ: nhận lại bộ B12, Hoàn tác bộ bật', await page.evaluate(() => window.MNCF.app.getBoVe())); }
        await hoanTac();
        ok((await vung(390000)) === 0, 'B12: Hoàn tác bộ sạch');
        // (11) bấm chip Chữ L lúc đang vẽ tủ đầu: bị chặn — bộ đang vẽ giữ mã + kiểu, bản ghi đủ
        await page.evaluate(b => window.MNCF.app.setBo(Object.assign({}, b, { ma: 'B14' })), boI);
        await page.evaluate(() => window.MNCF.app.setBoCho({ goc: [500000, 5000, 0], xoay: 0 }));
        await page.evaluate(() => { window.__p14 = window.MNCF.app.veBo({}); });
        await page.waitForTimeout(300);
        await H.locator('[data-act="bo-kieu"][data-v="L"]').click();
        { const b = await page.evaluate(() => window.MNCF.app.getBo());
          ok(b.kieu === 'I' && b.ma === 'B14' && /Đang vẽ bộ/.test(await st()), 'chip Chữ L lúc đang vẽ: bị chặn, nói rõ', [b.kieu, b.ma, await st()]); }
        const r14 = await page.evaluate(() => window.__p14);
        ok(r14 && r14.ok && (await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('mncf.tu.bo:B14')).spec; return s.kieu === 'I' && s.da_ve.length; })) === r14.tong, 'bộ B14 vẽ xong, bản ghi kiểu I đủ tủ', r14);
        await hoanTac();
        ok((await vung(490000)) === 0, 'B14: Hoàn tác bộ sạch');
        // (8) bộ chữ L chưa vẽ → chip Chữ I (cùng mã) → vẽ → ↶ Lùi (về chữ L cùng mã): KHÔNG giữ bản ghi bộ chữ I — Cập nhật khoá, bộ chữ I còn nguyên
        await H.locator('#mncf-ui-mau').selectOption('@BO-L'); await H.locator('[data-act="mau"]').click();
        await page.evaluate(() => { const o = window.MNCF.app.getBo(); o.ma = 'B15'; window.MNCF.app.setBo(o); });
        await H.locator('[data-act="bo-kieu"][data-v="I"]').click();
        await page.evaluate(() => window.MNCF.app.setBoCho({ goc: [550000, 5000, 0], xoay: 0 }));
        const r15 = await page.evaluate(() => window.MNCF.app.veBo({}));
        ok(r15 && r15.ok && (await page.evaluate(() => window.MNCF.app.getBo())).kieu === 'I', 'B15 chữ I vẽ xong', r15);
        const n15 = await vung(540000);
        await H.locator('[data-act="lui"]').click();
        { const b = await page.evaluate(() => window.MNCF.app.getBo()), R = await page.evaluate(() => window.MNCF.app.getBoVe());
          ok(b.kieu === 'L' && (R === null || R.kieu === 'L') && await H.locator('[data-act="bo-cap-nhat"]').isDisabled(), '↶ Lùi về chữ L cùng mã: không nhận bản ghi bộ chữ I, Cập nhật khoá', [b.kieu, b.ma, R && R.kieu]); }
        ok((await vung(540000)) === n15 && n15 > 0, 'bộ chữ I trên bản vẽ còn nguyên');
        await H.locator('[data-act="bo-kieu"][data-v="I"]').click();
        ok(((await page.evaluate(() => window.MNCF.app.getBoVe())) || { da_ve: [] }).da_ve.length === r15.tong, 'chip Chữ I: về đúng bộ B15 đã vẽ');
        await hoanTac();
        ok((await vung(540000)) === 0, 'B15: Hoàn tác bộ sạch');
        // (vòng soát 4) mã bộ còn bản ghi của bản vẽ khác → lần vẽ lấy mã mới; ↶ Lùi về bước trước lần vẽ vẫn nhận bộ vừa vẽ (không mời vẽ chồng)
        await page.evaluate(() => localStorage.setItem('mncf.tu.bo:B16', JSON.stringify({ spec: { ma: 'B16', kieu: 'I', cho: { goc: [0, 0, 0], xoay: 0 }, da_ve: [{ vt: 'A1', id: 'ZZZ999', sig: 'x', at: [0, 0, 0], xoay: 0 }], tong: 1, dung: null }, ban: '1.34.0', luc: Date.now() })));
        await page.evaluate(b => window.MNCF.app.setBo(Object.assign({}, b, { ma: 'B16' })), boI);
        await H.locator('[data-act="bo-ke"]').click();      // một bước ↶ Lùi trước lần vẽ (mang mã B16)
        await page.evaluate(() => window.MNCF.app.setBoCho({ goc: [600000, 5000, 0], xoay: 0 }));
        const r16 = await page.evaluate(() => window.MNCF.app.veBo({}));
        const ma16 = (await page.evaluate(() => window.MNCF.app.getBo())).ma, n16 = await vung(590000);
        ok(r16 && r16.ok && ma16 !== 'B16' && n16 > 0 && JSON.parse(await page.evaluate(() => localStorage.getItem('mncf.tu.bo:B16'))).spec.da_ve[0].id === 'ZZZ999', 'mã B16 của bản vẽ khác: bộ vẽ lấy mã mới, bản ghi B16 giữ nguyên', [ma16, await st()]);
        await H.locator('[data-act="lui"]').click();
        { const R = await page.evaluate(() => window.MNCF.app.getBoVe());
          ok((await page.evaluate(() => window.MNCF.app.getBo())).ma === ma16 && R && R.ma === ma16 && R.da_ve.length === r16.tong && !(await H.locator('[data-act="bo-hoan-tac"]').isDisabled()), '↶ Lùi sau lần vẽ đổi mã: vẫn nhận bộ vừa vẽ, Hoàn tác bộ bật', [(await page.evaluate(() => window.MNCF.app.getBo())).ma, R && R.ma]); }
        const r16b = await page.evaluate(() => window.MNCF.app.veBo({}));
        ok(!(r16b && r16b.ok) && (await vung(590000)) === n16, 'bấm Vẽ lần nữa: không vẽ chồng bộ thứ hai', [r16b, await vung(590000), n16]);
        await hoanTac();
        ok((await vung(590000)) === 0, 'bộ đổi mã: Hoàn tác bộ sạch'); }
      await page.evaluate(async () => { const D = window.MNCFDriver; await D.erase(D.all()); });
      await page.evaluate(s => window.MNCF.app.setSpec(s), TU_2000);
      ok((await H.locator('.panel').getAttribute('data-loai')) !== 'bo-bep' && await H.locator('footer [data-act="draw"]').isVisible() && !(await H.locator('footer .bohang').isVisible()), 'rời bộ bếp: chân bảng về hàng tủ lẻ');
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
    await theSau(H, 'hd');
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
