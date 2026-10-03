'use strict';
// Kiểm tra bản 1.19 — MẪU KHO vào bản vẽ + khung đặt mẫu kho + chia ô trên mặt đứng, trên trang GIẢ LẬP Chenfeng (tiện ích thật nạp vào trang giả lập).
//   NODE_PATH=<node_modules có playwright> PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node test/kho.test.js
const path = require('path'), fs = require('fs'), os = require('os'), zlib = require('zlib');
const { chromium } = require('playwright');
const DIST = path.join(__dirname, '..', 'dist'), EXT = path.join(DIST, 'extension');
const MOCK = fs.readFileSync(path.join(__dirname, 'mock-chenfeng.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) pass++; else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); } };
const eq = (a, b, name) => ok(JSON.stringify(a) === JSON.stringify(b), name, { co: a, can: b });

/* ---- KHO GIẢ của tài khoản: cây thư mục + mẫu (props nén deflate như máy chủ Chenfeng trả về) ---- */
const props = (L, W, H, bh) => zlib.deflateSync(Buffer.from(JSON.stringify([[0, 'L', '', L, 0, 'Rộng'], [0, 'W', '', W, 0, 'Sâu'], [0, 'H', '', H, 0, 'Cao'], [0, 'BH', '', bh || 18, 0, 'Dày ván']]))).toString('base64');
const mau = (id, ten, L, W, H) => ({ module_id: String(id), shop_id: '1', dir_id: '', name: ten, logo: `CAD/logos/aa/${id}.jpg`, size: '1000', props: props(L, W, H), zip_type: 'deflate' });
const DIRS = [{ dir_id: '11', dir_name: '抽屉', childs: [] },
  { dir_id: '20', dir_name: 'Kho Chenfeng (store)', childs: [
    { dir_id: '21', dir_name: 'Tủ tivi', childs: [] },      // thư mục trùng tên mà RỖNG (như kho thật)
    { dir_id: '30', dir_name: 'Shop mẫu', childs: [{ dir_id: '31', dir_name: 'Tủ tivi', childs: [] }, { dir_id: '32', dir_name: 'Tủ giày - sảnh', childs: [] }, { dir_id: '33', dir_name: 'Tủ áo - phòng thay đồ', childs: [] }] }] }];
const MAU = {
  31: [mau(9001, 'Tủ tivi 1', 2800, 350, 2400), mau(9002, 'Tủ tivi 2 (cánh phủ)', 2000, 400, 600), mau(9003, 'Vách nền sofa 1', 800, 300, 700)].concat(Array.from({ length: 11 }, (x, i) => mau(9100 + i, 'Kệ tivi ' + (i + 1), 1800 + i * 100, 350, 450))),
  32: [mau(9201, 'Tủ giày thấp 2', 1200, 350, 1000)],
};
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const goiAPI = [];
const phucVuAPI = r => {
  const u = new URL(r.request().url()), h = { 'access-control-allow-origin': 'https://cfcad.cn', 'access-control-allow-credentials': 'true' };
  if (u.pathname.startsWith('/CAD/logos/')) return r.fulfill({ status: 200, contentType: 'image/png', headers: h, body: PNG });
  let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch (e) { body = {}; }
  goiAPI.push([u.pathname, body]);
  let j = { err_code: 1, err_msg: 'no' };
  if (u.pathname === '/CAD-dirQuery') j = { err_code: 0, err_msg: '', dirs: DIRS };
  else if (u.pathname === '/CAD-moduleList') {
    let ds = (MAU[body.dir_id] || []).slice();
    if (body.name) ds = ds.filter(m => m.name.toLowerCase().includes(String(body.name).toLowerCase()));
    const tr = Math.max(1, +body.curr_page || 1), n = +body.page_count || 20, trang = ds.slice((tr - 1) * n, tr * n);
    j = ds.length ? { err_code: 0, err_msg: '', count: String(ds.length), modules: trang } : { err_code: 0, err_msg: '', count: '0' };      // thư mục rỗng: không có `modules`
  }
  return r.fulfill({ status: 200, contentType: 'application/json', headers: h, body: JSON.stringify(j) });
};
const KHO_GIA = { 9001: {}, 9002: { cua: true, tay: true }, 9003: { co_dinh: [800, 300, 700] }, 9004: { cua: true, khong_W: true }, 9201: { tay: true } };
const PHONG = { ten: 'Phòng khách', cao: 2700, tuong: [{ dai: 3600 }, { dai: 3000 }, { dai: 3600 }, { dai: 'auto' }], mo: [{ tuong: 2, loai: 'cua', cach: 200, rong: 900, cao: 2200 }], khung: [], goc: [10000, 2000, 0] };

async function chay() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mncf-kho-'));
  const ctx = await chromium.launchPersistentContext(dir, { channel: 'chromium', headless: true, viewport: { width: 1500, height: 900 }, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  try {
    await ctx.route('https://api.cfcad.cn/**', phucVuAPI);
    await require('./kho-gia.js')(ctx);      // bộ nạp của tiện ích lấy bản gộp vừa dựng trong máy
    await ctx.route('https://cfcad.cn/**', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: MOCK }));
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
    await page.goto('https://cfcad.cn/');
    await page.waitForFunction(() => window.MNCF && window.MNCF.app, null, { timeout: 15000 });
    await page.evaluate(k => { window.__MOCK_KHO__ = k; }, KHO_GIA);
    const H = page.locator('#mncf-host'), st = () => H.locator('.status').textContent();
    const tam = () => page.evaluate(() => window.__MOCK__.ents.filter(e => !e.IsErase && e instanceof window.__MOCK__.Board).map(b => [b.Name, ...b.box.map(v => Math.round(v * 100) / 100), b.Thickness, b.BoardProcessOption.highDrill[0]]));
    const dem = () => page.evaluate(() => { const M = window.__MOCK__, a = M.ents.filter(e => !e.IsErase); return { tam: a.filter(e => e instanceof M.Board).length, lo: a.filter(e => e instanceof M.CylinderHole).length, pk: a.filter(e => e instanceof M.HardwareCompositeEntity).length }; });
    const hop = ds => [0, 2, 4].flatMap(i => [Math.min(...ds.map(b => b[1 + i])), Math.max(...ds.map(b => b[2 + i]))]);

    /* ================= A. BỘ ĐIỀU KHIỂN ================= */
    console.log('— Bộ điều khiển: đọc kho, vẽ mẫu kho');
    ok(await page.evaluate(() => { const D = window.MNCFDriver; return typeof D.khoMau === 'function' && typeof D.veKho === 'function' && typeof D.tenTamMoi === 'function'; }), 'bộ điều khiển có khoMau / veKho / tenTamMoi');
    let r = await page.evaluate(async () => { const D = window.MNCFDriver; return { a: await D.khoMau('31', { trang: 1, moi_trang: 12 }), b: await D.khoMau('31', { trang: 2, moi_trang: 12 }), c: await D.khoMau('21'), d: await D.khoMau('31', { ten: 'sofa' }) }; });
    ok(r.a.tong === 14 && r.a.mau.length === 12 && r.a.mau[0].id === 9001 && r.a.mau[0].ten === 'Tủ tivi 1', 'khoMau: trang 1 có 12 / 14 mẫu, đủ mã + tên', r.a.mau[0]);
    eq(r.a.mau[0].kt, [2800, 350, 2400], 'khoMau: kích thước mặc định L × W × H đọc từ tham số nén của mẫu');
    ok(r.a.mau[0].hinh === 'https://api.cfcad.cn/CAD/logos/aa/9001.jpg' && r.a.mau[0].bh === 18, 'khoMau: địa chỉ ảnh nhỏ + dày ván mặc định', r.a.mau[0]);
    ok(r.b.mau.length === 2 && r.b.trang === 2, 'khoMau: trang 2 còn 2 mẫu');
    eq([r.c.tong, r.c.mau.length], [0, 0], 'khoMau: thư mục rỗng (máy chủ không trả `modules`) → danh sách rỗng, không lỗi');
    ok(r.d.tong === 1 && r.d.mau[0].ten === 'Vách nền sofa 1', 'khoMau: lọc theo tên');
    const goi31 = goiAPI.filter(g => g[0] === '/CAD-moduleList' && g[1].dir_id === '31');
    ok(goi31[1][1].curr_page === 2 && goi31[1][1].page_count === 12 && goi31[2][1].name === 'sofa', 'khoMau: gửi đúng số trang, cỡ trang, tên lọc', goi31.map(g => g[1]));

    eq(await page.evaluate(() => ['左侧板', '层板1', '左开门板', '抽底板', '薄背板', '背板(自动)', '加强条2', '上收口', 'Đợt', '神秘板', '左抽侧'].map(window.MNCFDriver.tenTamMoi)),
      ['Hồi trái', 'Đợt 1', 'Cánh mở trái', 'Đáy ngăn kéo', 'Hậu mỏng', 'Hậu (tự động)', 'Thanh tăng cứng 2', 'Nẹp bù trên', 'Đợt', '神秘板', 'Thành trái ngăn kéo'], 'tenTamMoi: tên tấm tiếng Trung → tiếng Việt (tên riêng trước tên chung, số / “tự động” giữ lại, tên lạ giữ nguyên)');

    // 1) mẫu thường, không xoay, giữ kết cấu của mẫu
    r = await page.evaluate(async () => { const D = window.MNCFDriver, nk = []; const k = await D.veKho({ id: 9001, ten: 'Tủ tivi 1', rong: 1200, sau: 350, cao: 1000, corner: [5000, 2000, 0], phong: 'Phòng khách', ma: 'TV1', khoan: 'Cam3Tp', onStatus: t => nk.push(t) }); return { k, nk, moc: window.__MOCK__.lastTemplates }; });
    ok(r.k.ok && r.k.kho && r.k.giai_doan === 'xong' && !r.k.errors.length && !r.k.warnings.length, 'veKho: mẫu thường vẽ xong, không lỗi, không cảnh báo', r.k);
    eq(r.moc.map(o => [o.Type, o.TempalteId, o.BoxSize, o.Pos, o.RoomName, o.CabinetName]), [['Template', 9001, [1200, 350, 1000], [0, 0, 0], 'Phòng khách', 'TV1']], 'veKho: gửi cho cổng nhập đúng mã mẫu + kích thước + tên phòng / mã tủ');
    let B = await tam();
    eq(hop(B), [5000, 6200, 2000, 2350, 0, 1000], 'veKho: hộp các tấm nằm đúng chỗ đặt, đúng rộng × sâu × cao');
    eq(r.k.kich, [1200, 350, 1000], 'veKho: báo kích thước các tấm chiếm'); eq(r.k.hop, [0, 1200, 0, 350, 0, 1000], 'veKho: hộp trong hệ của chỗ đặt');
    ok(B.length === 7 && r.k.so_tam === 7 && B.every(b => b[8] === 'Cam3Tp') && r.k.sua_khoan.fixed === 7 && r.k.so_lo === 42, 'veKho: kiểu khoan của cửa hàng (三合一) đổi sang kiểu của xưởng, Chenfeng khoan lại đủ lỗ', { n: B.length, lo: r.k.so_lo, fix: r.k.sua_khoan });
    eq(B.map(b => b[0]).sort(), ['Hậu', 'Hồi phải', 'Hồi trái', 'Nóc', 'Xà chân', 'Xà chân sau', 'Đáy'], 'veKho: tên tấm ghi lại bằng tiếng Việt');
    ok(r.k.doi_ten === 7 && r.k.la_module && r.k.module === 'Tủ tivi 1' && r.k.vua === null, 'veKho: 7 tấm đổi tên; vẫn là module; không phải chỉnh L / W / H', r.k);
    ok(r.nk.some(t => /Đang tải mẫu “Tủ tivi 1”/.test(t)) && r.nk.some(t => /Đổi kiểu khoan cũ \(三合一\) → Cam3Tp/.test(t)) && r.nk[r.nk.length - 1] === 'Xong.', 'veKho: báo tiến độ từng bước', r.nk);
    const buoc1 = r.k.so_buoc_hoan_tac;
    ok(buoc1 >= 3 && await page.evaluate(() => window.MNCFDriver.last && window.MNCFDriver.last.kho === true), 'veKho: ghi lại lần vẽ để hoàn tác (nhập + khoan + tên + đặt)', buoc1);
    // đổi L sau khi đặt (như gõ ở ô Thông số của Chenfeng): module co giãn tại chỗ
    eq(await page.evaluate(async () => { const M = window.__MOCK__, T = M.templates[M.templates.length - 1]; T.LParam.expr = '1500'; await T.UpdateTemplateTree(); const bs = M.ents.filter(e => !e.IsErase && e instanceof M.Board); return [Math.min(...bs.map(b => b.box[0])), Math.max(...bs.map(b => b.box[1]))]; }), [5000, 6500], 'sau khi đặt: đổi L của module → tủ giãn tại chỗ');
    r = await page.evaluate(async () => window.MNCFDriver.undoLast());
    ok(r.ok, 'undoLast: hoàn tác lần vẽ mẫu kho', r);
    eq(await dem(), { tam: 0, lo: 0, pk: 0 }, 'lùi đủ số bước của lần vẽ: bản vẽ sạch');

    // 2) mẫu có cánh phủ ngoài khung module + tay nắm, đặt xoay −90° (áp tường bên phải)
    r = await page.evaluate(async () => { const D = window.MNCFDriver; const k = await D.veKho({ id: 9002, ten: 'Tủ tivi 2 (cánh phủ)', rong: 2000, sau: 400, cao: 600, corner: [13200, 1300, 300], xoay: -90, khoan: 'Cam3Tp' }); const M = window.__MOCK__, T = M.templates[M.templates.length - 1], bs = M.ents.filter(e => !e.IsErase && e instanceof M.Board), kh = D.khungCua(bs[0]);
      return { k, lwh: [T.LParam.value, T.WParam.value, T.HParam.value], kh: kh && { goc: kh.goc, xoay: kh.xoay }, pk: M.ents.filter(e => !e.IsErase && e instanceof M.HardwareCompositeEntity).map(e => e.box.map(v => Math.round(v * 10) / 10)) }; });
    ok(r.k.ok && r.k.vua && JSON.stringify(r.k.vua.tu) === '[2000,400,600]' && JSON.stringify(r.k.vua.den) === '[2000,382,600]', 'cánh phủ ngoài thùng 18: module được chỉnh W 400 → 382 để CÁC TẤM (kể cả cánh) vừa đúng sâu 400', r.k.vua);
    eq(r.lwh, [2000, 382, 600], 'tham số L / W / H của module sau khi chỉnh');
    ok(r.k.notes.some(t => /Kích thước module \(L × W × H\) chỉnh từ 2000 × 400 × 600 thành 2000 × 382 × 600/.test(t)), 'có dòng ghi việc chỉnh kích thước module', r.k.notes);
    B = await tam();
    eq(hop(B), [13200, 13600, -700, 1300, 300, 900], 'xoay −90°: tủ chạy dọc theo −y từ điểm đặt, lưng về +x (áp tường bên phải), đáy ở +300');
    eq(r.k.hop, [0, 2000, 0, 400, 0, 600], 'trong hệ của chỗ đặt: các tấm chiếm đúng 2000 × 400 × 600');
    eq(r.kh, { goc: [13218, 1300, 300], xoay: -90 }, 'khung module đi theo: gốc module lùi sau mặt cánh 18, xoay −90°');
    ok(r.pk.length === 1 && r.pk[0][0] === 13170 && r.pk[0][1] === 13200, 'tay nắm (phụ kiện) nhô 30 TRƯỚC mặt cánh, không làm lệch chỗ đặt các tấm', r.pk);
    ok(B.some(b => b[0] === 'Cánh mở trái') && B.filter(b => b[8] === 'Cam3Tp').length === 7, 'cánh có tên tiếng Việt; 7 tấm thùng đổi kiểu khoan, cánh không khoan', B.map(b => [b[0], b[8]]));
    r = await page.evaluate(async () => { const u = await window.MNCFDriver.undoLast(); return u; });
    ok(r.ok && (await dem()).tam === 0 && (await dem()).pk === 0, 'undoLast: bỏ sạch lần vẽ mẫu kho (tấm, lỗ, phụ kiện)', r);

    // 3) mẫu không co giãn → cảnh báo, vẫn đặt đúng góc
    r = await page.evaluate(async () => window.MNCFDriver.veKho({ id: 9003, ten: 'Vách nền sofa 1', rong: 1000, sau: 400, cao: 900, corner: [20000, 0, 0], khoan: 'Cam3Tp' }));
    ok(r.ok && r.warnings.length === 1 && /không co giãn đúng theo kích thước yêu cầu: các tấm đang chiếm rộng 800 \(yêu cầu 1000\), sâu 300 \(yêu cầu 400\), cao 700 \(yêu cầu 900\)/.test(r.warnings[0]), 'mẫu kích thước cố định: báo rõ từng chiều thực tế / yêu cầu', r.warnings);
    eq(hop(await tam()), [20000, 20800, 100, 400, 0, 700], 'mẫu cố định: neo theo LƯNG — mép trái, đáy và mặt sau đúng chỗ đặt (lưng ở đúng chiều sâu yêu cầu 400)');
    eq([r.vua.tu, r.vua.den], [[800, 300, 700], [800, 300, 700]], 'tham số module trả về như mẫu khi không trục nào co giãn');
    await page.evaluate(() => window.MNCFDriver.undoLast());
    // 3b) mẫu có cánh phủ ngoài mà chiều sâu KHÔNG theo tham số W (đo trên "Tủ giày 10" của kho thật): thử chỉnh W không ăn → trả W về, lưng vẫn áp đúng chỗ, cánh nhô ra trước
    r = await page.evaluate(async () => { const D = window.MNCFDriver; const k = await D.veKho({ id: 9004, ten: 'Tủ sâu cố định', rong: 1000, sau: 400, cao: 900, corner: [22000, 0, 0], khoan: 'Cam3Tp' }); const M = window.__MOCK__, T = M.templates[M.templates.length - 1]; return { k, lwh: [T.LParam.value, T.WParam.value, T.HParam.value, T.WParam.expr] }; });
    ok(r.k.ok && r.k.warnings.length === 1 && /các tấm đang chiếm sâu 418 \(yêu cầu 400\)/.test(r.k.warnings[0]) && !/rộng|cao 9/.test(r.k.warnings[0].split('—')[0]), 'chiều sâu không co theo W: chỉ báo chiều sâu lệch', r.k.warnings);
    eq(r.lwh.slice(0, 3), [1000, 400, 900], 'thử chỉnh W không ăn → tham số W trả về 400 (không để module lệch nửa vời)');
    eq(hop(await tam()), [22000, 23000, -18, 400, 0, 900], 'lưng ở đúng chiều sâu yêu cầu (y = 400), cánh nhô ra trước 18');
    eq(r.k.hop, [0, 1000, -18, 400, 0, 900], 'báo hộp các tấm trong hệ chỗ đặt');
    await page.evaluate(() => window.MNCFDriver.undoLast());

    // 4) theo chuẩn xưởng: dày ván 17,5 + hậu 6 li phủ sau, rồi mới đo / đặt
    r = await page.evaluate(async () => window.MNCFDriver.veKho({ id: 9001, ten: 'Tủ tivi 1', rong: 800, sau: 500, cao: 2000, corner: [30000, 0, 0], khoan: 'Cam3Tp', day: 17.5, hau: 6, mep: 1 }));
    B = await tam();
    const tamTen = n => B.find(b => b[0] === n);
    ok(r.ok && r.day_van && r.day_van.ok && r.day_van.doi === 5 && r.chuan_hoa && r.chuan_hoa.ok && !r.chuan_hoa.da_chuan, 'chuẩn xưởng: đổi dày ván (BH) rồi chuyển hậu sang phủ sau', { dv: r.day_van, ch: r.chuan_hoa && r.chuan_hoa.ly_do, w: r.warnings });
    ok(tamTen('Hồi trái')[7] === 17.5 && tamTen('Hậu')[7] === 6 && tamTen('Hậu')[8] === '不排', 'hồi dày 17,5; hậu 6 li không khoan', [tamTen('Hồi trái'), tamTen('Hậu')]);
    eq(hop(B), [30000, 30800, 0, 500, 0, 2000], 'chuẩn hoá xong phủ bì vẫn đúng 800 × 500 × 2000 tại chỗ đặt');
    ok(r.notes.some(t => /^Dày ván: 18 → 17.5 cho 5 tấm/.test(t)) && r.notes.some(t => /^Hậu: 1 tấm chuyển thành hậu 6 li phủ sau lưng thùng \(lùi mép 1\), không khoan; mép sau của 4 tấm thùng lùi lại/.test(t)) && !r.notes.some(t => /\d{5}~/.test(t)), 'báo cáo ghi dày ván + hậu', r.notes);
    ok(r.so_lo > 0 && !B.some(b => /[\u3400-\u9fff]/.test(b[0])), 'khoan lại sau khi chuẩn hoá; không còn tên tấm tiếng Trung', { lo: r.so_lo, ten: B.map(b => b[0]) });
    // chuẩn hoá lại module ĐÃ ĐỔI TÊN (nút “Chuẩn hoá mẫu kho đang chọn”): vẫn nhận ra tấm hậu theo tên tiếng Việt
    r = await page.evaluate(async () => { const M = window.__MOCK__, b = M.ents.find(e => !e.IsErase && e instanceof M.Board && e.Name === 'Nóc'); const k = await window.MNCFDriver.chuanHoa(b, { hau: 6, mep: 1, khoan: 'Cam3Tp' }); return { ok: k.ok, da: k.da_chuan, ly: k.ly_do }; });
    ok(r.ok && r.da, 'module đã đổi tên tiếng Việt: chuẩn hoá lần nữa vẫn nhận ra hậu (“đã đúng chuẩn”)', r);
    await page.evaluate(async () => { const D = window.MNCFDriver; for (let i = 0; i < 12 && window.__MOCK__.ents.some(e => !e.IsErase); i++) await D.undo(1); });
    eq(await dem(), { tam: 0, lo: 0, pk: 0 }, 'dọn bản vẽ');

    // 5) lỗi: thiếu mã, kích thước sai, Chenfeng không dựng được mẫu; giữ tên gốc khi tắt đổi tên
    r = await page.evaluate(async () => { const D = window.MNCFDriver; const a = await D.veKho({ rong: 1000, sau: 400, cao: 900, corner: [0, 0, 0] }), b = await D.veKho({ id: 9001, rong: 5, sau: 400, cao: 900, corner: [0, 0, 0] }), c = await D.veKho({ id: 9001, rong: 1000, sau: 400, cao: 900, corner: [0, 0] });
      window.__MOCK_FAIL_IMPORT__ = true; const d = await D.veKho({ id: 9001, ten: 'Tủ tivi 1', rong: 1000, sau: 400, cao: 900, corner: [0, 0, 0] }); window.__MOCK_FAIL_IMPORT__ = false;
      const e = await D.veKho({ id: 9201, ten: 'Tủ giày thấp 2', rong: 1200, sau: 350, cao: 1000, corner: [0, 0, 0], khoan: 'Cam3Tp', ten_viet: false });
      return { a, b, c, d, e, ten: window.__MOCK__.ents.filter(x => !x.IsErase && x instanceof window.__MOCK__.Board).map(x => x.Name) }; });
    ok(!r.a.ok && /Chưa chọn mẫu kho/.test(r.a.errors[0]) && !r.b.ok && /Kích thước/.test(r.b.errors[0]) && !r.c.ok && /3 số/.test(r.c.errors[0]), 'veKho: thiếu mã mẫu / kích thước sai / toạ độ sai → từ chối, không vẽ', [r.a.errors, r.b.errors, r.c.errors]);
    ok(!r.d.ok && r.d.giai_doan === 'nhap' && r.d.errors.length === 1 && r.d.so_buoc_hoan_tac === 0, 'Chenfeng không dựng được mẫu → báo lỗi, không để lại gì', r.d);
    ok(r.e.ok && r.e.doi_ten === 0 && r.ten.includes('左侧板') && r.e.so_phu_kien === 1, 'tắt “tên tấm tiếng Việt”: giữ tên gốc của mẫu', r.ten);
    eq(hop(await tam()), [0, 1200, 0, 350, 0, 1000], 'mẫu có tay nắm nhô trước: các tấm vẫn đúng chỗ (điểm đặt của cổng nhập bị tay nắm làm lệch, bảng dời lại)');
    await page.evaluate(() => window.MNCFDriver.undoLast());
    eq(await dem(), { tam: 0, lo: 0, pk: 0 }, 'dọn bản vẽ');

    /* ================= B. GIAO DIỆN ================= */
    console.log('— Giao diện: thẻ Kho mẫu');
    await H.locator('.launch').click();
    eq(await H.locator('.tab').allTextContents(), ['Tủ', 'Phòng', 'Kho mẫu', 'Chuẩn xưởng', 'Kết quả', 'Hướng dẫn'], 'trong Chenfeng có thẻ “Kho mẫu”');
    goiAPI.length = 0;
    await H.locator('.tab[data-tab="kho"]').click();
    await page.waitForFunction(() => /chưa có mẫu/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.kluoi').textContent), null, { timeout: 8000 });
    eq(await H.locator('.knhom .knut').allTextContents(), ['Tủ áo', 'Tủ tivi', 'Tủ giày – sảnh'], 'nhóm nhanh: chỉ hiện nhóm có thư mục khớp tên trong kho của tài khoản');
    // nhóm đầu (Tủ áo) được mở sẵn — ở kho giả thư mục đó rỗng → báo; bấm Tủ tivi: bỏ qua thư mục trùng tên mà rỗng
    ok((await H.locator('.knut.on').textContent()) === 'Tủ áo' && (await H.locator('[data-ui="kho-dir"]').inputValue()) === '33' && (await H.locator('[data-ui="kho-dir"] option').count()) === 7, 'mở thẻ lần đầu: đọc cây thư mục (7 thư mục), mở sẵn nhóm đầu tiên', await H.locator('[data-ui="kho-dir"]').inputValue());
    eq(goiAPI.map(g => g[0]), ['/CAD-dirQuery', '/CAD-moduleList'], 'chỉ gọi lệnh ĐỌC kho: cây thư mục + danh sách mẫu');
    await H.locator('.knut[data-v="tivi"]').click();
    await page.waitForFunction(() => document.getElementById('mncf-host').shadowRoot.querySelectorAll('.kmc').length === 12, null, { timeout: 8000 });
    ok((await H.locator('.knut.on').textContent()) === 'Tủ tivi' && (await H.locator('[data-ui="kho-dir"]').inputValue()) === '31', 'nhóm Tủ tivi: bỏ qua thư mục “Tủ tivi” rỗng, mở thư mục có mẫu', await H.locator('[data-ui="kho-dir"]').inputValue());
    ok(/Trang 1 \/ 2 · 14 mẫu/.test(await H.locator('.ktrang').innerText()) && (await H.locator('.kmc b').first().textContent()) === 'Tủ tivi 1' && (await H.locator('.kmc small').first().textContent()) === '2800 × 350 × 2400', 'lưới mẫu: 12 mẫu / trang, có tên + kích thước mặc định, có phân trang', await H.locator('.ktrang').innerText());
    ok(await H.locator('.kmc img').first().evaluate(i => i.complete && i.naturalWidth > 0 && /\/CAD\/logos\/aa\/9001\.jpg$/.test(i.src)), 'ảnh nhỏ của mẫu tải được');
    ok(await H.locator('[data-act="kho-dat"]').isDisabled() && await H.locator('[data-act="kho-ve"]').isDisabled() && !(await H.locator('[data-act="kho-khung"]').isVisible()), 'chưa chọn mẫu: các nút vẽ còn khoá');
    await H.locator('[data-act="kho-trang"][data-v="1"]').click();
    await page.waitForFunction(() => document.getElementById('mncf-host').shadowRoot.querySelectorAll('.kmc').length === 2, null, { timeout: 8000 });
    ok(/Trang 2 \/ 2/.test(await H.locator('.ktrang').innerText()) && await H.locator('[data-act="kho-trang"][data-v="1"]').isDisabled(), 'sang trang 2: còn 2 mẫu, nút trang sau khoá');
    await H.locator('[data-ui="kho-tim"]').fill('sofa');
    await page.waitForFunction(() => { const s = document.getElementById('mncf-host').shadowRoot; return s.querySelectorAll('.kmc').length === 1 && /sofa/.test(s.querySelector('.kmc b').textContent); }, null, { timeout: 8000 });
    ok(/1 mẫu/.test(await H.locator('.ktrang').innerText()), 'tìm theo tên “sofa”: còn 1 mẫu');
    await H.locator('[data-ui="kho-tim"]').fill('ke tivi 10');
    await page.waitForFunction(() => { const q = document.getElementById('mncf-host').shadowRoot.querySelectorAll('.kmc b'); return q.length === 1 && q[0].textContent === 'Kệ tivi 10'; }, null, { timeout: 8000 });
    ok(true, 'tìm nhiều từ, không cần gõ dấu (“ke tivi 10”): ra đúng 1 mẫu “Kệ tivi 10” — lọc ngay trong bảng, phải khớp ĐỦ các từ');
    eq(goiAPI.filter(g => g[0] === '/CAD-moduleList' && g[1].name).length, 0, 'không dùng bộ lọc tên của máy chủ (lọc kiểu “trúng một từ là được”)');
    await H.locator('[data-ui="kho-tim"]').fill('khongco'); await H.locator('[data-ui="kho-tim"]').press('Enter');
    await page.waitForFunction(() => /Không có mẫu nào tên chứa/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.kluoi').textContent), null, { timeout: 8000 });
    ok(true, 'tìm không ra: báo rõ');
    // thư mục con + lên thư mục chứa
    await H.locator('[data-ui="kho-dir"]').selectOption('30');
    await page.waitForFunction(() => { const sr = document.getElementById('mncf-host').shadowRoot; return sr.querySelectorAll('.kcon .knut').length === 4 && /không có mẫu trực tiếp/.test(sr.querySelector('.kluoi').textContent); }, null, { timeout: 8000 });
    ok(/không có mẫu trực tiếp/.test(await H.locator('.kluoi').innerText()) && (await H.locator('[data-ui="kho-tim"]').inputValue()) === '', 'chọn thư mục mẹ: báo chọn thư mục con, ô tìm được xoá');
    eq(await H.locator('.kcon .knut').allTextContents(), ['↑ lên', 'Tủ tivi ›', 'Tủ giày - sảnh ›', 'Tủ áo - phòng thay đồ ›'], 'có nút lên + các thư mục con');
    await H.locator('.kcon .knut', { hasText: 'Tủ giày' }).click();
    await page.waitForFunction(() => { const s = document.getElementById('mncf-host').shadowRoot; return s.querySelectorAll('.kmc').length === 1 && /giày/.test(s.querySelector('.kmc b').textContent); }, null, { timeout: 8000 });
    await H.locator('.kmc').first().click();
    eq(await Promise.all(['kho-rong', 'kho-sau', 'kho-cao'].map(n => H.locator(`[data-ui="${n}"]`).inputValue())), ['1200', '350', '1000'], 'bấm mẫu: ô kích thước điền sẵn kích thước mặc định của mẫu');
    ok(/Tủ giày thấp 2/.test(await H.locator('.kmau').innerText()) && !(await H.locator('[data-act="kho-dat"]').isDisabled()) && (await H.locator('.kmc.on').count()) === 1, 'mẫu đang chọn hiện ở khung dưới, các nút vẽ mở');
    ok(/Theo chuẩn xưởng: ván 17,5 · hậu 6 li phủ sau/.test(await H.locator('[data-ui="kho-chuan-chu"]').textContent()), 'ô “theo chuẩn xưởng” ghi rõ dày ván + hậu đang đặt ở Chuẩn xưởng');

    // vẽ tại 1 điểm bấm (không xoay)
    await H.locator('[data-ui="kho-chuan"]').uncheck();
    await H.locator('[data-ui="kho-rong"]').fill('1500');
    await H.locator('[data-act="kho-ve"]').click();
    await page.waitForFunction(() => window.app.Editor.GetPointServices.IsReady === true, null, { timeout: 5000 });
    ok(/Bấm 1 điểm trên bản vẽ để đặt mẫu/.test(await H.locator('.chip').textContent()) && !(await H.locator('.panel').isVisible()), 'vẽ tại điểm bấm: bảng thu lại, có lời nhắc bấm điểm');
    await page.evaluate(() => window.__MOCK__.clickPoint(40000, 500, 0));
    await page.waitForFunction(() => /Đã vẽ mẫu kho/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 20000 });
    eq(hop(await tam()), [40000, 41500, 500, 850, 0, 1000], 'mẫu nằm đúng điểm bấm với bề rộng đã gõ (1500)');
    let rep = await H.locator('.report').innerText();
    ok(/Đã vẽ mẫu kho “Tủ giày thấp 2” — 1500 × 350 × 1000 \(rộng × sâu × cao\): 7 tấm, 1 phụ kiện, 42 lỗ khoan/.test(rep) && /Đã ghi tên tiếng Việt cho 7 tấm/.test(rep) && /module tham số của Chenfeng/.test(rep) && /Kiểu khoan của mẫu \(三合一\)/.test(rep), 'báo cáo ở thẻ Kết quả', rep);
    ok((await H.locator('.panel').getAttribute('data-tabon')) === 'kq' && !/Dày ván|Hậu:/.test(rep), 'tắt “theo chuẩn xưởng”: không đổi dày ván, không chuyển hậu');
    await H.locator('.report [data-act="undo"]').click();
    await page.waitForFunction(() => /Đã hoàn tác/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 15000 });
    eq(await dem(), { tam: 0, lo: 0, pk: 0 }, 'nút “Hoàn tác lần vẽ này” bỏ sạch mẫu vừa vẽ');

    /* ---- khung đặt mẫu kho, chia ô, sửa số trên mặt đứng ---- */
    console.log('— Giao diện: khung đặt mẫu kho, chia ô trên mặt đứng');
    await H.locator('.tab[data-tab="phong"]').click();
    await page.evaluate(p => window.MNCF.phong.dat(p), PHONG);
    const P = () => page.evaluate(() => window.MNCF.phong.lay());
    const kh = async () => (await P()).khung.map(k => [k.ten, k.cach, k.z, k.rong, k.cao, k.sau, k.kieu || 'tu']);
    await H.locator('[data-act="k-add"]').click();
    await H.locator('[data-p="khung.0.sau"]').fill('400'); await page.waitForTimeout(260);
    eq(await kh(), [['K1', 0, 0, 3600, 2700, 400, 'tu']], 'khung mới phủ hết tường A');
    ok((await H.locator('.pcard[data-kj="0"] [data-p="khung.0.kieu"]').inputValue()) === 'tu' && await H.locator('.pcard[data-kj="0"] [data-act="k-mo"]').isVisible() && (await H.locator('.pcard[data-kj="0"] [data-act="k-kho"]').count()) === 0, 'khung mặc định là “tủ tự chia khoang”');
    await H.locator('.pcard[data-kj="0"] [data-ui="k-chia-n"]').selectOption('3');
    await H.locator('.pcard[data-kj="0"] [data-act="k-chia"][data-v="doc"]').click();
    eq(await kh(), [['K1.1', 0, 0, 1200, 2700, 400, 'tu'], ['K1.2', 1200, 0, 1200, 2700, 400, 'tu'], ['K1.3', 2400, 0, 1200, 2700, 400, 'tu']], 'chia 3 ô cạnh nhau');
    ok(/Đã chia khung K1 thành 3 ô cạnh nhau/.test(await st()) && (await H.locator('.pmd [data-khung]').count()) === 3 && (await H.locator('.pmsgs .err').count()) === 0, 'mặt đứng có 3 ô, không báo chồng nhau', await st());
    // sửa rộng ô trái trên mặt đứng: ô kề nhận bù
    const suaMD = async (p, v) => { await H.locator(`.pmd [data-sua="${p}"]`).click(); await H.locator('.pdim').fill(v); await H.locator('.pdim').press('Enter'); await page.waitForTimeout(120); };
    await suaMD('khung.0.rong', '600');
    ok(/Khung K1\.1: rộng 600 — ô kề K1\.2 nhận phần bù/.test(await st()), 'sửa rộng trên mặt đứng: báo ô kề nhận bù', await st());
    await suaMD('khung.2.rong', '600');
    eq((await kh()).map(k => k.slice(0, 4)), [['K1.1', 0, 0, 600], ['K1.2', 600, 0, 2400], ['K1.3', 3000, 0, 600]], 'vách tivi 600 | 2400 | 600 sau 2 lần gõ, không hở không chồng');
    await H.locator('.pcard[data-kj="1"] [data-act="k-chia"][data-v="ngang"]').click();
    await suaMD('khung.1.cao', '450');
    eq((await kh()).map(k => k.slice(0, 5)), [['K1.1', 0, 0, 600, 2700], ['K1.2.1', 600, 0, 2400, 450], ['K1.2.2', 600, 450, 2400, 2250], ['K1.3', 3000, 0, 600, 2700]], 'ô giữa chia 2 tầng: kệ dưới 450 + ô trên 2250');
    await suaMD('khung.1.cao', '2680');
    ok(/Ô kề K1\.2\.2 chỉ còn 20/.test(await st()) && (await kh())[1][4] === 450, 'ô kề không đủ chỗ: từ chối, giữ số cũ', await st());
    await suaMD('khung.2.sau', '350');
    eq((await kh())[2][5], 350, 'sửa sâu của một ô ngay trên mặt đứng');
    ok((await H.locator('.pmd [data-sua="khung.2.z"]').textContent()).startsWith('+450'), 'ô treo ghi cao độ đáy (+450) trên mặt đứng');

    // ô trên: đặt mẫu kho
    await H.locator('.pcard[data-kj="2"] [data-p="khung.2.kieu"]').selectOption('kho');
    ok(/Chưa chọn mẫu — bấm “Chọn mẫu kho…”/.test(await H.locator('.pcard[data-kj="2"] .kkho').innerText()) && await H.locator('.pcard[data-kj="2"] [data-act="k-ve-kho"]').isDisabled() && (await H.locator('.pcard[data-kj="2"] [data-act="k-mo"]').count()) === 0, 'đổi khung sang “mẫu kho”: có nút chọn mẫu, nút vẽ khoá tới khi chọn');
    ok(/mẫu kho — chưa chọn/.test(await H.locator('.pmd').innerText()), 'mặt đứng ghi ô này là mẫu kho, chưa chọn');
    await H.locator('.pcard[data-kj="2"] [data-act="k-kho"]').click();
    ok((await H.locator('.panel').getAttribute('data-tabon')) === 'kho' && /Đang chọn mẫu cho khung K1\.2\.2 \(2400 × 2250, sâu 350\)/.test(await H.locator('.khochon').innerText()), 'mở thẻ Kho mẫu ở chế độ chọn cho khung', await H.locator('.khochon').innerText());
    await H.locator('.knut[data-v="tivi"]').click();
    await page.waitForFunction(() => document.getElementById('mncf-host').shadowRoot.querySelectorAll('.kmc').length === 12, null, { timeout: 8000 });
    await H.locator('.kmc', { hasText: 'Tủ tivi 2 (cánh phủ)' }).click();
    eq(await Promise.all(['kho-rong', 'kho-sau', 'kho-cao'].map(n => H.locator(`[data-ui="${n}"]`).inputValue())), ['2400', '350', '2250'], 'chọn mẫu cho khung: kích thước vẽ = kích thước khung');
    ok((await H.locator('[data-act="kho-khung"]').textContent()) === 'Dùng mẫu này cho khung K1.2.2', 'có nút “Dùng mẫu này cho khung …”');
    await H.locator('[data-act="kho-khung"]').click();
    let p = await P();
    ok((await H.locator('.panel').getAttribute('data-tabon')) === 'phong' && p.khung[2].kieu === 'kho' && p.khung[2].kho.id === 9002 && p.khung[2].kho.ten === 'Tủ tivi 2 (cánh phủ)' && JSON.stringify(p.khung[2].kho.kt) === '[2000,400,600]' && p.khung[2].nhom === 'tivi', 'mẫu gán vào khung, quay về thẻ Phòng', p.khung[2]);
    ok(/Tủ tivi 2 \(cánh phủ\)/.test(await H.locator('.pcard[data-kj="2"] .kkho').innerText()) && !(await H.locator('.pcard[data-kj="2"] [data-act="k-ve-kho"]').isDisabled()) && /mẫu: Tủ tivi 2/.test(await H.locator('.pmd').innerText()), 'thẻ khung + mặt đứng ghi tên mẫu; nút vẽ mở');
    ok(/mẫu kho: Tủ tivi 2 \(cánh phủ\)/.test(await H.locator('.psum').innerText()), 'tóm tắt phòng ghi khung nào đặt mẫu kho');
    await H.locator('.tab[data-tab="kho"]').click(); await H.locator('[data-ui="kho-chuan"]').uncheck(); await H.locator('.tab[data-tab="phong"]').click();
    await H.locator('.pcard[data-kj="2"] [data-act="k-ve-kho"]').click();
    await page.waitForFunction(() => /Đã vẽ mẫu kho/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 20000 });
    eq(hop(await tam()), [10600, 13000, 1650, 2000, 450, 2700], 'mẫu nằm đúng ô K1.2.2 trên tường A: rộng 2400, sâu 350 (kể cả cánh), đáy +450, cao tới trần');
    rep = await H.locator('.report').innerText();
    ok(/Đã vẽ mẫu kho “Tủ tivi 2 \(cánh phủ\)” — 2400 × 350 × 2250/.test(rep) && /K1\.2\.2 — tường A/.test(rep) && /chỉnh từ 2400 × 350 × 2250 thành 2400 × 332 × 2250/.test(rep), 'báo cáo: đúng khung, có ghi chỉnh W vì cánh phủ ngoài', rep);
    await H.locator('.tab[data-tab="phong"]').click();
    ok(/đã vẽ/.test(await H.locator('.pcard[data-kj="2"] .kinfo').textContent()), 'khung ghi “đã vẽ”');
    // tường B (xoay −90°)
    await H.locator('.pmb [data-tuong="1"]').click({ force: true });
    await H.locator('[data-act="k-add"]').click();
    p = await P(); const jB = p.khung.length - 1;
    await H.locator(`[data-p="khung.${jB}.rong"]`).fill('1200'); await H.locator(`[data-p="khung.${jB}.cao"]`).fill('1000'); await H.locator(`[data-p="khung.${jB}.sau"]`).fill('350'); await H.locator(`[data-p="khung.${jB}.cach"]`).fill('500'); await page.waitForTimeout(300);
    await H.locator(`.pcard[data-kj="${jB}"] [data-p="khung.${jB}.kieu"]`).selectOption('kho');
    await H.locator(`.pcard[data-kj="${jB}"] [data-act="k-kho"]`).click();
    await H.locator('.knut[data-v="giay"]').click();
    await page.waitForFunction(() => { const s = document.getElementById('mncf-host').shadowRoot; return s.querySelectorAll('.kmc').length === 1 && /giày/.test(s.querySelector('.kmc b').textContent); }, null, { timeout: 8000 });
    await H.locator('.kmc').first().click(); await H.locator('[data-act="kho-khung"]').click();
    const truocB = (await tam()).length;
    await H.locator(`.pcard[data-kj="${jB}"] [data-act="k-ve-kho"]`).click();
    await page.waitForFunction(n => window.__MOCK__.ents.filter(e => !e.IsErase && e instanceof window.__MOCK__.Board).length > n && /Đã vẽ mẫu kho/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), truocB, { timeout: 20000 });
    eq(hop((await tam()).slice(truocB)), [13250, 13600, 300, 1500, 0, 1000], 'khung trên tường B: mẫu xoay −90°, lưng áp tường B (x = 13600), chạy từ cách đầu tường 500 tới 1700');
    ok(/Xoay\s*-90°/.test((await H.locator('.report').innerText()).replace(/\n/g, ' ')), 'báo cáo ghi góc xoay');
    await H.locator('.report [data-act="undo"]').click();
    await page.waitForFunction(() => /Đã hoàn tác/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 15000 });
    p = await P();
    ok((await tam()).length === truocB && !p.khung[jB].tu_id && p.khung[2].tu_id === 'kho-9002', 'hoàn tác lần vẽ: mẫu trên tường B biến mất, bỏ dấu “đã vẽ” của ĐÚNG khung đó (khung K1.2.2 vẽ trước vẫn giữ)', p.khung.map(k => k.tu_id));

    // khung đã có nhóm mẫu: mở lại thẻ Kho mẫu thì về đúng nhóm của khung đó; khung đã vẽ thì bấm vẽ lần đầu chỉ nhắc
    await H.locator('.tab[data-tab="phong"]').click();
    await H.locator('.pcard[data-kj="2"] [data-act="k-kho"]').click();      // khung K1.2.2 (nhóm tivi) — thẻ Kho mẫu đang ở nhóm giày
    await page.waitForFunction(() => { const s = document.getElementById('mncf-host').shadowRoot, on = s.querySelector('.knut.on'); return on && on.textContent === 'Tủ tivi' && s.querySelectorAll('.kmc').length === 12; }, null, { timeout: 8000 });
    ok(/Đang chọn mẫu cho khung K1\.2\.2/.test(await H.locator('.khochon').innerText()) && (await H.locator('.kmc.on b').textContent()) === 'Tủ tivi 2 (cánh phủ)', 'mở lại chọn mẫu cho khung đã có mẫu: về đúng nhóm của khung, mẫu đang dùng được tô');
    await H.locator('[data-act="kho-thoi"]').click();
    ok((await H.locator('.panel').getAttribute('data-tabon')) === 'phong', '“Thôi”: về thẻ Phòng, khung giữ mẫu cũ');
    const soTam = (await tam()).length;
    await H.locator('.pcard[data-kj="2"] [data-act="k-ve-kho"]').click();
    ok(/Khung K1\.2\.2 đã vẽ một lần/.test(await st()) && (await tam()).length === soTam, 'khung đã vẽ: bấm vẽ lần đầu chỉ nhắc (tránh vẽ chồng), chưa vẽ gì', await st());
    // xoá khung đang chờ chọn mẫu → thẻ Kho mẫu thôi chế độ chọn cho khung
    await H.locator(`.pcard[data-kj="${jB}"] [data-act="k-kho"]`).click();
    await H.locator('.tab[data-tab="phong"]').click();
    await H.locator(`.pcard[data-kj="${jB}"] [data-act="k-del"]`).click();
    await H.locator('.tab[data-tab="kho"]').click();
    ok(!(await H.locator('.khochon').isVisible()) && !(await H.locator('[data-act="kho-khung"]').isVisible()), 'khung đang chờ chọn mẫu bị xoá: thẻ Kho mẫu thôi chế độ chọn cho khung');

    // kéo chuột trên mặt đứng để vẽ khung mới
    await H.locator('.tab[data-tab="phong"]').click();
    await H.locator('.pmb [data-tuong="2"]').click({ force: true });      // tường C: có cửa 900 × 2200 cách trái 200
    const truocK = (await P()).khung.length;
    await H.locator('[data-act="k-ve-md"]').click();
    ok((await H.locator('[data-act="k-ve-md"]').getAttribute('aria-pressed')) === 'true' && /Kéo chuột trên mặt đứng tường C/.test(await st()), 'bật chế độ vẽ khung trên mặt đứng');
    await H.locator('.pmd svg').scrollIntoViewIfNeeded(); await page.waitForTimeout(150);
    const diem = (s, z) => page.evaluate(([s2, z2]) => { const sv = document.getElementById('mncf-host').shadowRoot.querySelector('.pmd svg'), m = sv.getScreenCTM(), q = sv.createSVGPoint(); q.x = s2; q.y = 2700 - z2; const t = q.matrixTransform(m); return [t.x, t.y]; }, [s, z]);
    const a = await diem(1112, 4), b2 = await diem(2607, 1193);      // góc dưới trái sát mép cửa (1100) + sàn; góc trên phải ~ (2610, 1190)
    await page.mouse.move(a[0], a[1]); await page.mouse.down(); await page.mouse.move((a[0] + b2[0]) / 2, (a[1] + b2[1]) / 2); await page.mouse.move(b2[0], b2[1]);
    ok(/Khung mới: rộng 1510 × cao 1190 · cách trái 1100 · đáy \+0/.test(await st()) && (await H.locator('.pmd svg rect.kve').count()) === 1, 'đang kéo: có hình xem trước + số đo; mép trái bám mép cửa (1100), số bắt chẵn 10', await st());
    await page.mouse.up();
    p = await P();
    ok(p.khung.length === truocK + 1 && JSON.stringify([p.khung[truocK].tuong, p.khung[truocK].cach, p.khung[truocK].z, p.khung[truocK].rong, p.khung[truocK].cao]) === '[2,1100,0,1510,1190]', 'nhả chuột: thêm khung đúng chỗ kéo trên tường C', p.khung[truocK]);
    ok(/Đã thêm khung/.test(await st()) && (await H.locator('.pmd svg rect.kve').count()) === 0, 'báo đã thêm khung, hình xem trước được gỡ', await st());
    await page.keyboard.press('Escape');
    ok((await H.locator('[data-act="k-ve-md"]').getAttribute('aria-pressed')) === 'false', 'Esc: thôi chế độ vẽ khung');

    /* ---- đặt mẫu kho bằng chuột (bấm chân tường) ---- */
    console.log('— Giao diện: đặt mẫu kho bằng chuột');
    await page.evaluate(() => window.MNCF.phong.dat({ ten: 'Phòng 2', cao: 2700, tuong: [{ dai: 3600 }, { dai: 3000 }, { dai: 3600 }, { dai: 'auto' }], mo: [], khung: [], goc: [60000, 3000, 0] }));
    await H.locator('.tab[data-tab="phong"]').click();
    await H.locator('[data-act="p-ve"]').click();
    await page.waitForFunction(() => /Đã vẽ phòng/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 30000 });
    await H.locator('.tab[data-tab="kho"]').click();
    await H.locator('.knut[data-v="giay"]').click();
    await page.waitForFunction(() => { const s = document.getElementById('mncf-host').shadowRoot; return s.querySelectorAll('.kmc').length === 1 && /giày/.test(s.querySelector('.kmc b').textContent); }, null, { timeout: 8000 });
    await H.locator('.kmc').first().click();
    const truocD = (await tam()).length;
    await H.locator('[data-act="kho-dat"]').click();
    await page.waitForFunction(() => window.app.Editor.GetPointServices.IsReady === true, null, { timeout: 5000 });
    ok(/Bấm điểm ĐẦU của mẫu ở chân tường/.test(await H.locator('.chip').textContent()), 'đặt bằng chuột: lời nhắc nói “mẫu”', await H.locator('.chip').textContent());
    await page.evaluate(() => window.__MOCK__.clickPoint(63600, 2500, 0));      // điểm đầu trên mặt tường B (x = 63600)
    await page.waitForFunction(() => /Rê chuột dọc tường/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.chip').textContent), null, { timeout: 5000 });
    ok(/Enter = rộng 1200 ở ô Rộng/.test(await H.locator('.chip').textContent()), 'lời nhắc điểm cuối ghi bề rộng đang gõ ở ô Rộng', await H.locator('.chip').textContent());
    await page.evaluate(() => { window.__MOCK__.reChuot(63600, 1500, 0); window.app.Editor.InputEvent(''); });      // rê xuôi theo tường rồi Enter = dùng bề rộng ở ô Rộng
    await page.waitForFunction(() => /Đã vẽ mẫu kho/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 25000 });
    eq(hop((await tam()).slice(truocD)), [63250, 63600, 1300, 2500, 0, 1000], 'đặt bằng chuột: mẫu rộng 1200 chạy từ điểm đầu dọc tường B, lưng áp tường, mặt trước quay vào phòng');
    ok(/Xoay\s*-90°/.test((await H.locator('.report').innerText()).replace(/\n/g, ' ')), 'mẫu tự xoay theo tường');

    ok(errs.length === 0, 'không có lỗi JS', errs);
    await page.close();
  } finally { await ctx.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* bỏ qua */ } }
}

/* trang độc lập (không có Chenfeng): không có thẻ Kho mẫu; khung vẫn chọn được loại, chia ô, sửa số trên mặt đứng */
async function trangDocLap(browser) {
  console.log('— Trang độc lập: khung mẫu kho không có kho');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const html = fs.readFileSync(path.join(DIST, 'mn-chenfeng.html'), 'utf8');
  await page.route('http://mn.test/**', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
  await page.goto('http://mn.test/');
  await page.waitForFunction(() => window.MNCF && window.MNCF.app && window.MNCF.app.getModel());
  const H = page.locator('#mncf-host');
  ok((await H.locator('.tab[data-tab="kho"]').count()) === 0, 'trang độc lập không có thẻ Kho mẫu');
  await H.locator('.tab[data-tab="phong"]').click();
  await H.locator('[data-act="k-add"]').click();
  await H.locator('.pcard[data-kj="0"] [data-p="khung.0.kieu"]').selectOption('kho');
  ok(/mở bảng này trong Chenfeng để chọn mẫu của kho/.test(await H.locator('.pcard[data-kj="0"] .kkho').innerText()) && (await H.locator('[data-act="k-kho"]').count()) === 0 && (await H.locator('[data-act="k-ve-kho"]').count()) === 0, 'khung “mẫu kho” ở trang độc lập: nhắc mở trong Chenfeng, không có nút chọn / vẽ');
  await H.locator('.pcard[data-kj="0"] [data-act="k-chia"][data-v="ngang"]').click();
  const p = await page.evaluate(() => window.MNCF.phong.lay());
  eq(p.khung.map(k => [k.ten, k.z, k.cao, k.kieu]), [['K1.1', 0, 1350, 'kho'], ['K1.2', 1350, 1350, 'kho']], 'chia 2 ô chồng nhau: ô con giữ loại “mẫu kho”');
  // mã phòng mang theo mẫu đã chọn (soạn ở Chenfeng, mở lại ở trang độc lập)
  const p2 = await page.evaluate(() => window.MNCF.phong.dat({ ten: 'P', cao: 2700, tuong: [{ dai: 3600 }, { dai: 3000 }, { dai: 3600 }, { dai: 'auto' }], khung: [{ ten: 'TV', tuong: 0, cach: 0, rong: 2400, cao: 2250, sau: 350, z: 450, kieu: 'kho', kho: { id: 9002, ten: 'Tủ tivi 2', hinh: 'https://api.cfcad.cn/CAD/logos/aa/9002.jpg', kt: [2000, 400, 600] } }] }));
  ok(p2.khung[0].kho.id === 9002 && /Tủ tivi 2/.test(await H.locator('.pcard[data-kj="0"] .kkho').innerText()) && /mẫu: Tủ tivi 2/.test(await H.locator('.pmd').innerText()), 'mã phòng giữ mẫu kho đã chọn; thẻ khung + mặt đứng ghi tên mẫu');
  await page.setViewportSize({ width: 400, height: 800 }); await page.waitForTimeout(300);
  ok((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0, 'rộng 400: không tràn ngang');
  ok(errs.length === 0, 'không có lỗi JS', errs);
  await ctx.close();
}

(async () => {
  await chay();
  const browser = await chromium.launch();
  try { await trangDocLap(browser); } finally { await browser.close(); }
  console.log(`\nkho.test: ${pass} đạt, ${fail} hỏng`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
