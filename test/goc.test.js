'use strict';
// VẼ TỦ BẰNG LỆNH GỐC của Chenfeng (D.veGoc) chạy TRỌN trên trang giả lập — có từ bản 1.26.
//   NODE_PATH=<node_modules có playwright> PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node test/goc.test.js
// Trang giả lập bật window.__MOCK_GOC__: có các lệnh LEFTRIGHTBOARD / VERTIALBOARD / TOPBOTTOMBOARD / BEHINDBOARD / LAYERBOARD / DOOR / DRAWER dựng theo các điều đã đo trên Chenfeng thật
// (ghi trong chú thích của mock-chenfeng.html, kèm phần giản lược). Kiểm cả chuỗi: lệnh gốc từng tấm → tấm rời → ngăn kéo lệnh gốc → suốt treo → khoan lại → gom module → đưa về chỗ đặt.
const path = require('path'), fs = require('fs'), os = require('os'), zlib = require('zlib');
const { chromium } = require('playwright');
const EXT = path.join(__dirname, '..', 'dist', 'extension');
const MOCK = fs.readFileSync(path.join(__dirname, 'mock-chenfeng.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) pass++; else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); } };
const eq = (a, b, name) => ok(JSON.stringify(a) === JSON.stringify(b), name, { co: a, can: b });

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mncf-goc-'));
  const ctx = await chromium.launchPersistentContext(dir, { channel: 'chromium', headless: true, viewport: { width: 1500, height: 900 }, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  try {
    // kho mẫu giả của tài khoản (mã giả): thư mục 抽屉 có mẫu ngăn kéo cùng TÊN với mẫu mặc định của bảng
    const props = a => zlib.deflateSync(Buffer.from(JSON.stringify(a.map(([n, v, e]) => [3, n, e || '', v, null, null, 1, null, null])))).toString('base64');
    await ctx.route('https://api.cfcad.cn/**', r => {
      const u = new URL(r.request().url()), body = JSON.parse(r.request().postData() || '{}');
      let j = { err_code: 1, err_msg: 'no' };
      if (u.pathname === '/CAD-dirQuery') j = { err_code: 0, err_msg: '', dirs: [{ dir_id: '12', dir_name: '抽屉', childs: [] }] };
      else if (u.pathname === '/CAD-moduleList' && body.dir_id === '12') j = { err_code: 0, err_msg: '', count: '1', modules: [{ module_id: '555001', name: '三节轨薄底抽', logo: '', diy_logo: '', props: props([['L', 426], ['W', 350], ['H', 200], ['BH', 18, '$BH'], ['GD', 13], ['LC', 0], ['SLK', 30], ['XLK', 30]]) }] };
      return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': 'https://cfcad.cn', 'access-control-allow-credentials': 'true' }, body: JSON.stringify(j) });
    });
    await require('./kho-gia.js')(ctx);      // bộ nạp của tiện ích lấy bản gộp vừa dựng trong máy
    await ctx.route('https://cfcad.cn/**', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: MOCK }));
    await ctx.addInitScript(() => { window.__MOCK_GOC__ = true; window.__MOCK_NGON__ = 'vi'; });      // (bản 1.29) giao diện Chenfeng tiếng Việt: nút "Xác nhận / Hủy" — bản ≤ 1.28 kẹt ở hộp "Hông tủ trái/phải"
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    await page.goto('https://cfcad.cn/');
    await page.waitForFunction(() => window.MNCF && window.MNCF.app && window.MNCFDriver && window.MNCFCore, null, { timeout: 15000 });
    // (bản 1.31) chuẩn xưởng mới: nóc, đáy phủ hồi + khung mặt hộc kéo — lệnh gốc chỉ vẽ kết cấu cũ (hồi phủ nóc đáy) và số đo của bộ này là hộc kéo khe + xà ẩn → ghim cả hai
    await page.evaluate(() => { window.MNCFCore.DEFAULT_SPEC.thung.noc_day = 'lot'; window.MNCFCore.DEFAULT_SPEC.ngan_keo.khung_mat = 0; });
    await page.evaluate(() => {
      const D = window.MNCFDriver, E = () => window.app.Database.ModelSpace.Entitys, song = () => E().filter(e => e && !e.IsErase);
      const lc = () => JSON.stringify(Object.keys(window.__MOCK__.gocSt).map(k => { const st = window.__MOCK__.gocSt[k]; return [k, st.m_Option, st.m_UiOption, st.topBoardOption, st.bottomBoardOption, st.m_BoardProcessOption, st.rectDrillOption, st.autoCutOption]; }));
      window.__thu = { lc0: lc(), lc,
        async ve(spec, opt) {
          const g0 = (window.__MOCK_GOC_LOG__ || []).length, i0 = (window.__MOCK_NHAP__ || []).length, n0 = (window.__MOCK_NK__ || []).length, h0 = window.app.Database.hm.curIndex, e0 = song().length;
          const r = await window.MNCF.draw(spec, opt), k = r.kiem_tra || {};
          this.rep = r;
          return { ok: r.ok, gd: r.giai_doan, errors: r.errors, warnings: r.warnings, goc: !!r.goc_cf, buoc: [r.buoc, r.tong_buoc], khop: [k.so_tam_khop, k.so_tam_thiet_ke], thieu: k.thieu, mat_lech: k.mat_ngan_keo_lech, khong_lo: k.tam_khong_lo, hau_lo: k.hau_co_lo, va_cham: k.va_cham,
            module: r.module ? [!!r.module.ok, r.module.thung, r.module.mau_con, r.module.reason || ''] : null, nk: r.nk_goc, chua: (r.chua || []).map(c => c.ten + '×' + c.sl), mau_thieu: r.mau_thieu, mau_doi: (r.mau_doi || []).map(d => d.sang), dat: r.dat ? !!r.dat.ok : null,
            do_lai: (r.do_lai || []).length, them_hinh: r.them_hinh, lenh: (window.__MOCK_GOC_LOG__ || []).slice(g0).map(x => x.lenh.slice(0, 2) + x.so_tam).join(' '), nhap: (window.__MOCK_NHAP__ || []).slice(i0).map(x => [x.tam, x.mau.length, x.ket]),
            lenh_nk: (window.__MOCK_NK__ || []).slice(n0).map(x => x.ket), buoc_ls: window.app.Database.hm.curIndex - h0, hoan_tac: r.so_buoc_hoan_tac, moi: song().length - e0, thua: window.__MOCK_GOC_THUA__ || 0, lc: lc() === this.lc0, bao_loi: window.__MOCK_BAO_LOI__ || 0, dl: r.do_loi ? r.do_loi.dem : null };
        },
        // hộp bao (làm tròn) của các tấm mang tên `ten` thuộc lần vẽ gần nhất
        hop(ten) { return D.last.added.filter(e => D.isBoard(e) && !e.IsErase && e.Name === ten).map(e => D.boxOf(e).map(v => Math.round(v * 10) / 10)).sort((a, b) => a[4] - b[4] || a[0] - b[0]); },
        async hoanTac() { const n0 = song().length; const r = await D.undoLast(); return { ok: r.ok, reason: r.reason || '', con: song().length, truoc: n0 }; } };
    });
    const ve = (spec, opt) => page.evaluate(([s, o]) => window.__thu.ve(s, o), [spec, opt || {}]);
    ok(await page.evaluate(() => window.MNCFDriver.gocDuoc()), 'trang giả lập bật lệnh gốc: bảng nhận ra là vẽ được bằng lệnh gốc');

    console.log('— Tủ 2 khoang không ngăn kéo: 11 lệnh gốc, đủ tấm, gom thành một module');
    const TU2 = { ma: 'G1', rong: 1600, cao: 2200, khoang: [{ rong: 'auto', canh: 2, dot: [1100], o: [] }, { rong: 'auto', canh: 2, dot: [600, 1400], o: [] }] };
    let r = await ve(TU2, { at: [0, 0, 0] });
    eq([r.ok, r.gd, r.errors, r.goc], [true, 'xong', [], true], 'vẽ xong bằng lệnh gốc, không lỗi');
    eq([r.lenh, r.buoc], ['LE2 VE1 TO2 BE1 LA1 TO2 BE1 LA1 LA1 DO2 DO2', [11, 11]], 'đúng thứ tự: hồi → vách → từng khoang (nóc đáy → hậu → đợt) → cánh sau cùng; mỗi lệnh ra đúng số tấm');
    eq([r.khop[0] === r.khop[1], r.thieu, r.va_cham, r.hau_lo, r.thua, r.lc, r.nk], [true, [], [], 0, 0, true, { tong: 0, so: 0, lui: [] }], 'mọi tấm thiết kế có tấm thật đúng hộp, đúng tên; hậu không lỗ; cấu hình hộp thoại của người dùng không lọt vào tấm nào và được trả lại nguyên');
    eq([r.module && r.module.slice(0, 2), r.nhap, r.chua.length > 0], [[true, 1], [[7, 0, 'ok']], true], 'phào + chân (7 tấm rời) nhập một lệnh rồi gom với thùng lệnh gốc thành một module');
    let ht = await page.evaluate(() => window.__thu.hoanTac());
    eq([ht.ok, ht.con], [true, 0], '"Hoàn tác lần vẽ này": bản vẽ sạch trở lại');

    console.log('— Tủ mặc định của bảng (2 thân, tách thùng, ngăn kéo âm + suốt treo): ngăn kéo bằng lệnh DRAWER, suốt treo chèn mẫu');
    const MD = await page.evaluate(() => { const C = window.MNCFCore, K = C.keHoachGoc(C.DEFAULT_SPEC); return { buoc: K.buoc.length, thung: K.buoc.filter(b => b.lenh === 'LR').length, nk: K.nk.length, mat: K.M.mat_ngan_keo.length, suot: K.M.templates.filter(t => t.loai === 'SUOT').length, roi: K.con_lai.length, tam: K.M.parts.length }; });
    r = await ve(await page.evaluate(() => window.MNCFCore.DEFAULT_SPEC), { at: [0, 0, 0] });
    eq([r.ok, r.gd, r.errors, r.buoc, r.khop], [true, 'xong', [], [MD.buoc, MD.buoc], [MD.tam, MD.tam]], 'vẽ xong, đủ mọi lệnh gốc và mọi tấm');
    eq([r.nk, r.lenh_nk, r.mat_lech, r.nhap], [{ tong: MD.nk, so: MD.nk, lui: [] }, ['ok'], [], [[MD.roi, 0, 'ok'], [0, MD.suot, 'ok']]], 'ô ngăn kéo vẽ bằng lệnh DRAWER (mặt đúng chỗ thiết kế); lệnh nhập mẫu chỉ còn suốt treo');
    eq([r.module && r.module.slice(0, 3), r.mau_thieu, r.mau_doi, r.bao_loi, r.lc, r.thua], [[true, MD.thung, MD.suot], [], [555001], 0, true, 0], 'gom module: các thùng + suốt treo là mẫu con (ngăn kéo lệnh gốc đã nằm trong cây mẫu của thùng); ghi lại việc dùng mẫu cùng tên của tài khoản');
    ok(!r.chua.some(c => /^Ngăn kéo/.test(c)) && !r.warnings.some(w => /đặt mặt khác thiết kế|chưa vẽ được bằng lệnh ngăn kéo/.test(w)), 'không lời báo nào về ngăn kéo', [r.chua, r.warnings]);
    const mat0 = await page.evaluate(() => window.__thu.hop('抽面板'));
    eq(mat0.length, MD.mat, 'đủ số mặt ngăn kéo');
    ht = await page.evaluate(() => window.__thu.hoanTac());
    eq([ht.ok, ht.con], [true, 0], 'hoàn tác cả lần vẽ (lệnh gốc + tấm rời + ngăn kéo + suốt treo + khoan lại + module): sạch');

    console.log('— Ngăn kéo trùm ngoài 3 ngăn, mặt cao khác nhau (141 / 140,5 / 140,5): vẫn là lệnh DRAWER — bảng khoá cao từng ô');
    const TR3 = { ma: 'G3', rong: 1000, cao: 2200, khoang: [{ rong: 'auto', canh: 2, dot: [520], o: [{ tu: 0, kieu: 'nk_trum', so: 3 }] }] };
    r = await ve(TR3, { at: [0, 0, 0] });
    eq([r.ok, r.gd, r.errors, r.nk, r.lenh_nk, r.mat_lech, r.nhap.filter(x => x[1] > 0)], [true, 'xong', [], { tong: 1, so: 1, lui: [] }, ['ok'], [], []], 'vẽ xong; ô ngăn kéo vẽ bằng lệnh gốc, không chèn mẫu nào');
    eq(await page.evaluate(() => window.__thu.hop('抽面板').map(b => [b[4], b[5]])), [[102, 243], [245, 385.5], [387.5, 528]], 'ba mặt đúng cao độ thiết kế (mặt dưới cùng cao hơn 0,5)');
    eq([r.module && r.module[0], r.lc, r.bao_loi, r.warnings.filter(w => /đặt mặt khác thiết kế|chưa vẽ được bằng lệnh ngăn kéo|chưa gom được/.test(w))], [true, true, 0, []], 'gom module được, lựa chọn của người dùng được trả lại, không lời báo nào về ngăn kéo vẽ hỏng');
    ht = await page.evaluate(() => window.__thu.hoanTac());
    eq([ht.ok, ht.con], [true, 0], 'hoàn tác: sạch');

    console.log('— Đặt tủ có ngăn kéo lệnh gốc ở chỗ khác + xoay 90°: vẽ ở chỗ trống rồi đưa về, ngăn kéo theo tủ');
    const NK1 = { ma: 'G3', rong: 1000, cao: 2200, khoang: [{ rong: 'auto', canh: 2, dot: [520], o: [{ tu: 0, kieu: 'nk_am', so: 2 }] }] };
    r = await ve(TU2, { at: [0, 0, 0] });      // một tủ có sẵn trên bản vẽ → tủ sau phải vẽ ở chỗ trống rồi dời về
    r = await ve(NK1, { corner: [5000, 3000, 0], xoay: 90 });
    eq([r.ok, r.errors, r.dat, r.nk, r.mat_lech], [true, [], true, { tong: 1, so: 1, lui: [] }, []], 'vẽ xong, đưa về chỗ đặt được; ngăn kéo lệnh gốc đủ');
    const matX = await page.evaluate(() => window.__thu.hop('抽面板'));
    // tủ xoay 90° quanh góc trái – trước – dưới (5000, 3000, 0): trục x của tủ → trục y bản vẽ, chiều sâu → −x. Mặt ngăn kéo 761 × 17,5 × 178 của thiết kế (x 119,5…880,5, y 12,5…30 tính từ mặt thùng; cánh nhô 17,5 trước thùng)
    eq(matX, [[4952.5, 4970, 3119.5, 3880.5, 119.5, 297.5], [4952.5, 4970, 3119.5, 3880.5, 319.5, 497.5]], 'hai mặt ngăn kéo nằm đúng chỗ sau khi xoay (không lệch khỏi tủ)');
    ht = await page.evaluate(() => window.__thu.hoanTac());
    ok(ht.ok && ht.con < ht.truoc, 'hoàn tác tủ xoay', ht);

    console.log('— Lệnh ngăn kéo gốc hỏng giữa lần vẽ tủ → ô đó chèn mẫu, tủ vẫn xong');
    await page.evaluate(() => { window.__MOCK_NK_LECH__ = 3; });
    r = await ve(Object.assign({}, NK1, { ma: 'G4' }), { corner: [9000, 0, 0] });
    await page.evaluate(() => { delete window.__MOCK_NK_LECH__; });
    eq([r.ok, r.errors, r.nk, r.mat_lech, r.mau_thieu], [true, [], { tong: 1, so: 0, lui: [{ khoang: 0, ly_do: 'lech' }] }, [], []], 'lệnh gốc ra lệch → đã hoàn tác bước đó, chèn 2 hộp ngăn kéo bằng mẫu; mặt đúng chỗ, không thiếu mẫu');
    ok(r.warnings.some(w => /^Ngăn kéo khoang 1 \(2 ngăn\): chưa vẽ được bằng lệnh ngăn kéo của Chenfeng/.test(w)), '… có lời báo ô nào phải chèn mẫu', r.warnings);
    eq([r.nhap.map(x => x[1]), r.module && r.module.slice(0, 3)], [[0, 2], [true, 1, 2]], 'hai hộp ngăn kéo chèn mẫu làm mẫu con của module như bản trước');
    ok(r.chua.includes('Ngăn kéo×2'), '… và được kể vào phần "không có lệnh gốc" của lần vẽ', r.chua);
    ht = await page.evaluate(() => window.__thu.hoanTac());

    console.log('— Ngăn kéo lệnh gốc bị lệch khi gom module / khi dời tủ → bảng phát hiện');
    await page.evaluate(() => { window.__MOCK_NK_LECH_MODULE__ = true; });
    r = await ve(Object.assign({}, NK1, { ma: 'G4b' }), { corner: [9000, 0, 0] });
    await page.evaluate(() => { delete window.__MOCK_NK_LECH_MODULE__; });
    ok(r.ok && r.module && r.module[0] === false && /gom module làm lệch mặt ngăn kéo/.test(r.module[3]), 'gom module làm lệch mặt ngăn kéo → trả lại như trước khi gom, tủ vẫn đúng', [r.ok, r.errors, r.module]);
    eq(await page.evaluate(() => window.__thu.hop('抽面板').map(x => [x[4], x[5]])), [[119.5, 297.5], [319.5, 497.5]], '… mặt ngăn kéo về lại đúng cao độ');
    ht = await page.evaluate(() => window.__thu.hoanTac());
    await page.evaluate(() => { window.__MOCK_NK_KHONG_THEO__ = true; });
    r = await ve(Object.assign({}, NK1, { ma: 'G4c' }), { corner: [9000, 0, 0] });
    await page.evaluate(() => { delete window.__MOCK_NK_KHONG_THEO__; });
    ok(!r.ok && r.errors.some(t => /Đưa tủ về chỗ đặt xong có 2 tấm lệch vị trí \(vd "mặt ngăn kéo khoang 1"\)/.test(t)), 'dời tủ về chỗ đặt mà ngăn kéo không theo → lần vẽ báo lỗi, nêu mặt ngăn kéo', [r.ok, r.errors]);
    await page.evaluate(async () => { const D = window.MNCFDriver; await D.erase(D.all().filter(e => D.boxOf(e)[0] > 4000)); });

    console.log('— Mẫu chèn (không phải lệnh gốc) đặt mặt khác thiết kế từ trước: chỉ là lưu ý — không vì thế mà bỏ module hay báo lệch khi dời tủ');
    // "hở sau" 10 → kế hoạch không có bước NK, ngăn kéo chèn mẫu như bản 1.23; mẫu của tài khoản đặt mặt thấp hơn thiết kế 1 mm
    await page.evaluate(() => { window.__MOCK_MAT_KHAC__ = 1; });
    const NK10 = await page.evaluate(s0 => Object.assign({}, s0, { ma: 'G4d', ngan_keo: Object.assign({}, window.MNCFCore.DEFAULT_SPEC.ngan_keo, { ho_sau: 10 }) }), NK1);
    r = await ve(NK10, { corner: [9000, 0, 0] });
    await page.evaluate(() => { delete window.__MOCK_MAT_KHAC__; });
    eq([r.ok, r.errors, r.nk, r.mat_lech.length, r.module && r.module[0], r.dat], [true, [], { tong: 0, so: 0, lui: [] }, 2, true, true], 'tủ vẫn xong: 2 mặt lệch chỉ là lưu ý; module vẫn gom, dời về chỗ đặt không báo lỗi');
    ok(r.warnings.some(w => /Mẫu ngăn kéo đặt mặt khác thiết kế/.test(w)), '… có dòng lưu ý mẫu đặt mặt khác thiết kế', r.warnings);
    ht = await page.evaluate(() => window.__thu.hoanTac());

    console.log('— Lệnh gốc hỏng và chèn mẫu cũng hỏng: hộp ngăn kéo ghi là thiếu, không kể vào phần "đã vẽ dạng rời"');
    await page.evaluate(() => { window.__MOCK_MAU_LOI__ = { 555001: { lan: 99, kieu: 'may_chu' } }; });
    // (mã mẫu ở Chuẩn xưởng trùng mã trong kho tài khoản → cả lệnh gốc lẫn lệnh chèn mẫu đều hỏi máy chủ đúng mã đó)
    const NK55 = await page.evaluate(s0 => { const nk = JSON.parse(JSON.stringify(window.MNCFCore.DEFAULT_SPEC.ngan_keo)); nk.loai[0].mau_id = 555001; return Object.assign({}, s0, { ma: 'G4e', ngan_keo: nk }); }, NK1);
    r = await ve(NK55, { corner: [9000, 0, 0] });
    await page.evaluate(() => { delete window.__MOCK_MAU_LOI__; });
    eq([r.gd, r.nk, r.mau_thieu.length, r.chua.filter(c => /^Ngăn kéo/.test(c))], ['xong', { tong: 1, so: 0, lui: [{ khoang: 0, ly_do: 'may_chu' }] }, 2, []], 'máy chủ không trả mẫu cho cả hai cách: 2 hộp ngăn kéo thiếu; danh sách "không có lệnh gốc" không kể chúng');
    ht = await page.evaluate(() => window.__thu.hoanTac());

    console.log('— Máy chủ treo ở lệnh ngăn kéo giữa lần vẽ tủ');
    await page.evaluate(() => { window.__MOCK_TEMPLATE_DELAY__ = 1500; });
    r = await ve(Object.assign({}, NK1, { ma: 'G5' }), { corner: [9000, 0, 0], cho_mau: 400, cho_tre: 200 });
    eq([r.gd, r.nk, r.mau_thieu.map(x => [x.loai, x.ly_do]), r.module], ['xong', { tong: 1, so: 0, lui: [{ khoang: 0, ly_do: 'treo' }] }, [['NGAN_KEO', 'may_chu'], ['NGAN_KEO', 'may_chu']], null], 'phần tấm vẫn xong; 2 hộp ngăn kéo ghi là thiếu vì máy chủ; không gom module (Chenfeng còn bận)');
    ok(r.warnings.some(w => /Chenfeng còn đang chờ máy chủ/.test(w)) && r.nhap.every(x => x[1] === 0), '… có lời báo Chenfeng còn bận, không lệnh chèn mẫu nào được gửi', [r.warnings, r.nhap]);
    await page.waitForTimeout(1700);
    await page.evaluate(() => { delete window.__MOCK_TEMPLATE_DELAY__; });
    await page.evaluate(async () => { const D = window.MNCFDriver; await D.erase(D.all()); });

    console.log('— Tab Chenfeng bị che (hình của tấm mới vào Scene trễ cả giây): bảng tự đưa hình vào trước khi dò khoảng trống');
    await page.evaluate(() => { window.__MOCK_GOC_TRE__ = 1500; });
    r = await ve(Object.assign({}, NK1, { ma: 'G6' }), { at: [0, 0, 0] });
    await page.evaluate(() => { delete window.__MOCK_GOC_TRE__; });
    eq([r.ok, r.errors, r.khop[0] === r.khop[1], r.nk.so], [true, [], true, 1], 'vẫn vẽ đúng mọi tấm + ngăn kéo');
    ok(r.them_hinh > 0, '… và bảng đã phải tự đưa hình của tấm vào Scene', r.them_hinh);

    console.log('— "Cập nhật tủ này" trên tủ có ngăn kéo lệnh gốc: không để lại ngăn kéo cũ');
    const upd = await page.evaluate(async () => {
      const D = window.MNCFDriver, C = window.MNCFCore, L = D.last, dem = () => { const a = D.all(); return [a.filter(e => D.isBoard(e) && e.Name === '抽面板').length, a.filter(D.isBoard).length, a.filter(D.isHardware).length]; };
      const cu = { ma: 'G6', rong: 1000, cao: 2200, khoang: [{ rong: 'auto', canh: 2, dot: [520], o: [{ tu: 0, kieu: 'nk_am', so: 2 }] }] }, moi = JSON.parse(JSON.stringify(cu)); moi.khoang[0].o[0].so = 3;
      const truoc = dem(), q = await D.update(moi, { id: L.id, specCu: cu }, {});
      return { truoc, sau: dem(), ok: q.ok, gd: q.giai_doan, errors: q.errors, nk: q.nk_goc, mat_lech: q.kiem_tra && q.kiem_tra.mat_ngan_keo_lech };
    });
    eq([upd.ok, upd.gd, upd.errors, upd.nk, upd.mat_lech], [true, 'xong', [], { tong: 1, so: 1, lui: [] }, []], 'cập nhật 2 ngăn → 3 ngăn: vẽ lại xong, ngăn kéo lệnh gốc');
    eq([upd.truoc[0], upd.sau[0], upd.sau[2]], [2, 3, 3], 'trước 2 mặt ngăn kéo, sau đúng 3 mặt + 3 ray — không còn mặt / ray nào của tủ cũ');

    console.log('— Tủ có khấu cột: lệnh gốc chưa làm được → vẽ theo cách nhập tấm; lời báo nói đúng module đổi được kích thước nào (bản 1.26.1)');
    await page.evaluate(async () => { const D = window.MNCFDriver; await D.erase(D.all()); });
    const KG = { ma: 'G7', rong: 2000, cao: 2200, khoang: [{ rong: 'auto', canh: 2, dot: [1100], o: [] }, { rong: 'auto', canh: 2, dot: [600, 1400], o: [] }] };
    r = await ve(Object.assign({}, KG, { khau: { trai: { rong: 300, sau: 200 } } }), { at: [0, 0, 0] });
    eq([r.ok, r.gd, r.errors, r.goc, r.module && r.module[0]], [true, 'xong', [], false, true], 'khấu cột GÓC: vẽ xong theo cách nhập tấm, vẫn gom thành module');
    ok(r.warnings.some(w => /chưa vẽ được bằng lệnh gốc Chenfeng \(tủ có khấu cột\)/.test(w) && /module đổi được Rộng \/ Sâu \/ Cao ở ô Thông số/.test(w)) && !r.warnings.some(w => /chỉ để xem/.test(w)), '… lời báo: module đổi được cả Rộng / Sâu / Cao', r.warnings);
    eq(await page.evaluate(() => window.__thu.rep.module.khoa), [], '… không tham số nào bị khoá');
    ht = await page.evaluate(() => window.__thu.hoanTac());
    // cột GIỮA: cột đứng yên còn khoang chia lại → module không co giãn đúng theo Rộng (đo trên Chenfeng thật 05/10/2026) → L chỉ để xem, lời báo phải nói thật
    r = await ve(Object.assign({}, KG, { ma: 'G8', khau: { giua: [{ cach: 350, rong: 250, sau: 200 }] } }), { at: [0, 0, 0] });
    eq([r.ok, r.gd, r.errors, r.goc, r.module && r.module[0]], [true, 'xong', [], false, true], 'khấu cột GIỮA: vẽ xong theo cách nhập tấm, vẫn gom thành module');
    ok(r.warnings.some(w => /chưa vẽ được bằng lệnh gốc Chenfeng \(tủ có khấu cột\)/.test(w) && /module đổi được Sâu \/ Cao ở ô Thông số/.test(w) && /Rộng chỉ để xem/.test(w) && /cột giữa/.test(w) && /Cập nhật tủ này/.test(w)) && !r.warnings.some(w => /đổi được Rộng/.test(w)),
      '… lời báo: module chỉ đổi được Sâu / Cao; Rộng chỉ để xem vì tủ có cột giữa, đổi ở bảng rồi bấm Cập nhật', r.warnings);
    eq(await page.evaluate(() => window.__thu.rep.module.khoa), [{ ten: 'L', ly_do: 'cot_giua' }], '… kết quả ghi tham số bị khoá + lý do');
    ht = await page.evaluate(() => window.__thu.hoanTac());
    eq([ht.ok, ht.con], [true, 0], '… hoàn tác: sạch');

    // (bản 1.31 — anh Thanh: "phải vẽ đúng theo của Chenfeng") nút ĐO lệnh nóc / đáy bọc hồi: vẽ thử 3 lượt ở chỗ trống, ghi lại, hoàn tác sạch, trả tệp chữ
    console.log('— Đo lệnh nóc / đáy bọc hồi (Hướng dẫn → Đo bọc hồi): vẽ thử, ghi lại, hoàn tác');
    {
      ok((await page.locator('#mncf-host').locator('.pane[data-pane="hd"] [data-act="do-boc-hoi"]').count()) === 1, 'thẻ Hướng dẫn có nút Đo bọc hồi');
      const truoc = await page.evaluate(() => window.app.Database.ModelSpace.Entitys.filter(e => e && !e.IsErase).length);
      const d = await page.evaluate(async () => { const r = await window.MNCFDriver.doBocHoi(); return { ok: r.ok, so: r.so_luot, nd: r.noi_dung || '', busy: window.MNCFDriver.busy(), lc: window.__thu.lc() === window.__thu.lc0, con: window.app.Database.ModelSpace.Entitys.filter(e => e && !e.IsErase).length }; });
      ok(d.ok && d.so === 3 && ['=== Lượt A', '=== Lượt B', '=== Lượt C', 'Sau LEFTRIGHTBOARD (2 hồi):', 'Sau TOPBOTTOMBOARD', 'Lựa chọn hộp nóc / đáy của người dùng'].every(k => d.nd.includes(k)), 'đo đủ 3 lượt; tệp ghi tấm sau lệnh hồi, sau lệnh nóc đáy và cấu hình hộp của người dùng', d.nd.slice(0, 600));
      ok((d.nd.match(/Đã hoàn tác lượt này/g) || []).length === 3 && d.con === truoc && !d.busy, 'mỗi lượt hoàn tác sạch: bản vẽ như trước, Chenfeng rảnh', [d.con, truoc]);
      ok(d.lc, 'lựa chọn hộp thoại của người dùng được trả lại nguyên');
      if (process.env.MNCF_IN) console.log(d.nd);
      ok(/Nóc \(đo\) \| dày 17,5|Nóc \(đo\) \| dày 17.5/.test(d.nd) && /x 0 … 17.5/.test(d.nd), 'tệp ghi tên, dày, hộp từng tấm (toạ độ tính từ góc thùng thử)', d.nd.split('\n').filter(l => /Nóc|Hồi/.test(l)).slice(0, 4));
    }
    // (1.31.1) đo trên Chenfeng của người dùng: không đụng hộp người dùng đang mở; lệnh tới trễ / hộp không nhận OK thì dọn sạch, trả lại lựa chọn đúng lúc
    {
      const song = () => page.evaluate(() => window.app.Database.ModelSpace.Entitys.filter(e => e && !e.IsErase).length);
      await page.evaluate(() => window.app.Editor.CommandStore.HandleInput('TOPBOTTOMBOARD'));      // người dùng tự mở lệnh nóc / đáy của Chenfeng
      await page.waitForSelector('.mock-goc');
      const h = await page.evaluate(async () => { const n0 = (window.__MOCK_INPUTS__ || []).length; const r = await window.MNCFDriver.doBocHoi(); return { ok: r.ok, loi: r.loi, gui: (window.__MOCK_INPUTS__ || []).slice(n0), hop: document.querySelectorAll('.mock-goc').length }; });
      ok(!h.ok && /đang mở hộp "TOPBOTTOMBOARD"/.test(h.loi) && !h.gui.length && h.hop === 1, 'Chenfeng đang mở hộp nóc / đáy của người dùng: không đo, không gửi lệnh nào, không bấm OK hộ — nói tên hộp', h);
      await page.evaluate(() => document.querySelector('.mock-goc .nut-huy').click()); await page.waitForTimeout(150);
      const n0 = await song();
      // lệnh hồi dựng tấm trễ hơn hạn chờ (Chenfeng còn tải vật liệu): không trả lựa chọn sớm (thùng thử dựng theo cấu hình người dùng), canh tới khi lệnh xong rồi xoá thùng thử
      const tre = await page.evaluate(async () => {
        const D = window.MNCFDriver, ch0 = D.CH.cho_tam, st0 = window.setTimeout; let cham = 3500;
        window.setTimeout = function (fn, ms, ...a) { if (cham && ms === 40 && typeof fn === 'function' && /dungGoc/.test(String(fn))) { ms = cham; cham = 0; } return st0.call(this, fn, ms, ...a); };
        D.CH.cho_tam = 1200;
        let r; try { r = await D.doBocHoi(); } finally { D.CH.cho_tam = ch0; window.setTimeout = st0; }
        const dem = () => window.app.Database.ModelSpace.Entitys.filter(e => e && !e.IsErase).length, n0 = dem(), lcNgay = window.__thu.lc() === window.__thu.lc0, lai = await D.doBocHoi();
        let thay = 0, tenThu = ''; const t0 = Date.now();
        while (Date.now() - t0 < 15000) { await new Promise(res => st0(res, 150)); const ds = window.app.Database.ModelSpace.Entitys.filter(e => e && !e.IsErase && e.Name); if (dem() > n0) { thay = 1; tenThu = tenThu || ds.map(e => e.Name).join(','); } if (thay && dem() === n0 && window.__thu.lc() === window.__thu.lc0 && !D.dangLenhTre()) break; }
        return { ok: r.ok, tre: r.tre, con: r.con, tep: /hiện ra trễ/.test(r.noi_dung || ''), lcNgay, lai: lai.loi || '', thay, tenThu, sau: dem() - n0, lc: window.__thu.lc() === window.__thu.lc0, busy: D.busy(), canh: D.dangLenhTre() };
      });
      ok(!tre.ok && tre.tre && tre.con === 0 && tre.tep && !tre.lcNgay && /chạy dở lệnh trước/.test(tre.lai), 'lệnh hồi tới trễ: dừng đo, báo "hiện ra trễ", CHƯA trả lựa chọn (Chenfeng chưa đọc); bấm đo lại lúc đó thì từ chối', tre);
      ok(tre.thay && /Hồi trái \(đo\)/.test(tre.tenThu) && tre.sau === 0 && tre.lc && !tre.busy && !tre.canh, '… lệnh tới: thùng thử dựng theo lựa chọn đo (không phải của người dùng), bảng tự xoá, rồi trả lựa chọn của người dùng nguyên vẹn', tre);
      // lệnh trễ vừa xong thì người dùng mở ngay lệnh của họ (cùng tên LEFTRIGHTBOARD — _cmdName không đổi, chỉ có dòng COMMAND mới): bảng trả lựa chọn, KHÔNG gửi ERASE vào lệnh đó, báo xoá tay
      const nhuong = await page.evaluate(async () => {
        const D = window.MNCFDriver, ch0 = D.CH.cho_tam, st0 = window.setTimeout, ngu = ms => new Promise(res => st0(res, ms)); let cham = 2500;
        window.setTimeout = function (fn, ms, ...a) { if (cham && ms === 40 && typeof fn === 'function' && /dungGoc/.test(String(fn))) { ms = cham; cham = 0; } return st0.call(this, fn, ms, ...a); };
        D.CH.cho_tam = 800;
        let r; try { r = await D.doBocHoi(); } finally { D.CH.cho_tam = ch0; window.setTimeout = st0; }
        const thu = () => window.app.Database.ModelSpace.Entitys.filter(e => e && !e.IsErase && /\(đo\)/.test(e.Name || ''));
        for (let i = 0; i < 300 && !thu().length; i++) await ngu(20);
        const n0 = (window.__MOCK_INPUTS__ || []).length;
        window.app.Editor.CommandStore.HandleInput('LEFTRIGHTBOARD');      // người dùng vẽ hồi của họ
        for (let i = 0; i < 100 && !(r.canh.xong && document.querySelector('.mock-goc')); i++) await ngu(100);      // hộp của họ mở có khi chậm hơn lúc bảng thôi canh (máy bận)
        const hop = !!document.querySelector('.mock-goc'), luaChonHop = window.__thu.lc() === window.__thu.lc0, gui = (window.__MOCK_INPUTS__ || []).slice(n0);
        const huy = document.querySelector('.mock-goc .nut-huy'); if (huy) huy.click();
        for (let i = 0; i < 50 && (document.querySelector('.mock-goc') || D.busy()); i++) await ngu(100); await ngu(200);
        const con = thu().length; await D.erase(thu());      // dọn cho các phép thử sau
        return { tre: r.tre, xong: r.canh.xong, xoa: r.canh.xoa, conBao: r.canh.con, con, hop, luaChonHop, gui };
      });
      ok(nhuong.tre && nhuong.xong && !nhuong.xoa && nhuong.conBao === 2 && nhuong.con === 2 && nhuong.hop && nhuong.luaChonHop && !nhuong.gui.some(x => /ERASE/i.test(x) || x === ''),
        'lệnh trễ xong mà người dùng đã mở lệnh hồi của họ: hộp của họ mang lựa chọn của họ, bảng không gửi ERASE / Enter vào lệnh đó, báo còn 2 tấm thử để xoá tay', nhuong);
      // lệnh hồi CỦA NGƯỜI DÙNG đang chờ dựng tấm (không hỏi, không hộp — D.busy() false): chữ LEFTRIGHTBOARD của bảng rơi vào lệnh đó (không có dòng COMMAND) → dừng ngay, không UNDO / Esc / đóng hộp
      const ban = await page.evaluate(async () => {
        const D = window.MNCFDriver, E = window.app.Editor, st0 = window.setTimeout, ngu = ms => new Promise(res => st0(res, ms)); let cham = 3000;
        const lr = window.__MOCK__.gocSt.LEFTRIGHTBOARD.m_Option, ten0 = [lr.leftBoardName, lr.rightBoardName];
        E.CommandStore.HandleInput('LEFTRIGHTBOARD');
        for (let i = 0; i < 50 && !document.querySelector('.mock-goc'); i++) await ngu(50);
        document.querySelector('.mock-goc .nut-ok').click();
        for (let i = 0; i < 50 && !D.busy(); i++) await ngu(50);
        window.setTimeout = function (fn, ms, ...a) { if (cham && ms === 40 && typeof fn === 'function' && /dungGoc/.test(String(fn))) { ms = cham; cham = 0; } return st0.call(this, fn, ms, ...a); };
        try { E.InputEvent('-6000,0,0'); await ngu(100); } finally { window.setTimeout = st0; }
        const h0 = window.app.Database.hm.curIndex, c0 = window.__MOCK_CANCELS__ || 0, t0 = Date.now(), r = await D.doBocHoi(), ms = Date.now() - t0;
        for (let i = 0; i < 60 && !window.app.Database.ModelSpace.Entitys.some(e => e && !e.IsErase && e.Name === ten0[0]); i++) await ngu(100);
        await ngu(300);
        const cua = window.app.Database.ModelSpace.Entitys.filter(e => e && ten0.includes(e.Name));
        const kq = { ok: r.ok, ban: r.ban, ms, cuaHo: cua.map(e => e.IsErase ? 'xoá' : 'còn'), lui: window.app.Database.hm.curIndex - h0, esc: (window.__MOCK_CANCELS__ || 0) - c0, khongDoi: /bản vẽ không đổi/.test(r.noi_dung || '') };
        await D.erase(cua.filter(e => !e.IsErase));      // dọn cho các phép thử sau
        return kq;
      });
      ok(!ban.ok && ban.ban === 'LEFTRIGHTBOARD' && ban.ms < 3000 && ban.cuaHo.length === 2 && ban.cuaHo.every(x => x === 'còn') && ban.lui >= 1 && !ban.esc && ban.khongDoi,
        'lệnh của người dùng đang chờ máy chủ: không đo, nêu tên lệnh, không Esc / UNDO — 2 hồi của họ dựng xong vẫn còn', ban);
      // lệnh thử tới trễ mà người dùng đang chọn tấm của họ: không bỏ / không cộng vào tập chọn đó (ERASE xoá cả tập chọn) — để thùng thử lại, báo xoá tay
      const chon = await page.evaluate(async () => {
        const D = window.MNCFDriver, M = window.__MOCK__, ch0 = D.CH.cho_tam, st0 = window.setTimeout, ngu = ms => new Promise(res => st0(res, ms)); let cham = 2500;
        const u = M.them(new M.Board('Tấm của tôi', 0, [-3000, -2000, 0, 500, 0, 18], 18, '', '', ['不排', '不排', '不排', '不排']));
        window.setTimeout = function (fn, ms, ...a) { if (cham && ms === 40 && typeof fn === 'function' && /dungGoc/.test(String(fn))) { ms = cham; cham = 0; } return st0.call(this, fn, ms, ...a); };
        D.CH.cho_tam = 800;
        let r; try { r = await D.doBocHoi(); } finally { D.CH.cho_tam = ch0; window.setTimeout = st0; }
        window.app.Editor.SelectCtrl.AddSelect({ SelectEntityList: [u] });      // người dùng bấm chọn tấm của họ
        for (let i = 0; i < 100 && !r.canh.xong; i++) await ngu(100);
        const kq = { tre: r.tre, xoa: r.canh.xoa, con: r.canh.con, chon: window.app.Editor.SelectCtrl.SelectSet.SelectEntityList.map(e => e.Name), uCon: !u.IsErase };
        window.app.Editor.SelectCtrl.Cancel();
        await D.erase([u].concat(window.app.Database.ModelSpace.Entitys.filter(e => e && !e.IsErase && /\(đo\)/.test(e.Name || ''))));
        return kq;
      });
      ok(chon.tre && !chon.xoa && chon.con === 2 && chon.uCon && JSON.stringify(chon.chon) === '["Tấm của tôi"]', 'người dùng đang chọn tấm của họ: tập chọn giữ nguyên, tấm của họ còn, thùng thử để lại + báo 2 tấm xoá tay', chon);
      // hộp nóc / đáy không nhận OK (Chenfeng giữ hộp): đóng hộp bằng nút huỷ của nó rồi mới hoàn tác (UNDO gửi lúc hộp còn mở bị nuốt) — không còn hồi thử
      const k = await page.evaluate(async () => {
        const id = setInterval(() => { const h = [...document.querySelectorAll('.mock-goc')].find(d => d.querySelector('h4').textContent === 'TOPBOTTOMBOARD'); if (h) { h.querySelector('.nut-ok').onclick = () => {}; clearInterval(id); } }, 20);
        const dem = () => window.app.Database.ModelSpace.Entitys.filter(e => e && !e.IsErase).length, n0 = dem();
        let r; try { r = await window.MNCFDriver.doBocHoi(); } finally { clearInterval(id); }
        return { ok: r.ok, loi: r.loi, con: r.con, hoan: /Đã hoàn tác lượt này/.test(r.noi_dung || ''), hop: document.querySelectorAll('.mock-goc').length, moi: dem() - n0, busy: window.MNCFDriver.busy(), lc: window.__thu.lc() === window.__thu.lc0 };
      });
      ok(!k.ok && k.con === 0 && k.hoan && k.hop === 0 && k.moi === 0 && !k.busy && k.lc, 'hộp nóc / đáy không nhận OK: đóng hộp, hoàn tác 2 hồi thử, bản vẽ như trước, lựa chọn trả lại', k);
      eq(await song(), n0, '… bản vẽ đúng số đối tượng như trước 3 lần đo hỏng');
    }

    eq(errs, [], 'không có lỗi JS nào lọt ra trang');
  } finally { await ctx.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* bỏ qua */ } }
  console.log(`\n${pass} đạt, ${fail} hỏng`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
