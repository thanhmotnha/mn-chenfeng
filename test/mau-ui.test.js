'use strict';
// Bản 1.21 — ĐỔ MÀU: đọc kho vật liệu của tài khoản, chọn tủ → thùng một màu, cánh + phào một màu, tìm và thay màu — trên trang GIẢ LẬP Chenfeng (tiện ích thật nạp vào trang).
//   NODE_PATH=<node_modules có playwright> PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node test/mau-ui.test.js
// Kho vật liệu giả: 2 thư mục (MDF 130 mã — 2 trang, ACRYLIC 3 mã). Mã vật liệu trong phép thử là mã GIẢ (7000…), không phải mã của tài khoản nào.
// thẻ nằm sau nút ⚙ (bản 1.27 — Màu, Chuẩn xưởng, Hướng dẫn): hàng thẻ phụ chưa mở thì bấm ⚙ trước rồi mới bấm thẻ
const theSau = async (H, t) => { const tab = H.locator('.tab[data-tab="' + t + '"]'); if (!(await tab.isVisible())) await H.locator('[data-act="the-them"]').click(); await tab.click(); };
const path = require('path'), fs = require('fs'), os = require('os'), zlib = require('zlib');
const { chromium } = require('playwright');
const EXT = path.join(__dirname, '..', 'dist', 'extension');
const MOCK = fs.readFileSync(path.join(__dirname, 'mock-chenfeng.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) pass++; else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); } };
const eq = (a, b, name) => ok(JSON.stringify(a) === JSON.stringify(b), name, { co: a, can: b });

const vl = (id, dir, ten) => ({ material_id: String(id), dir_id: dir, name: ten, logo: `CAD/images/aa/thumbs/${id}_100.jpg`, code: 'c' + id, path: `CAD/materials/aa/c${id}.ms`, zip_type: 'gzip', size: '588', props: '{"useDoubleSidedMaterials":false}' });
const KHO = {
  71: ['103T', '388EV'].concat(Array.from({ length: 128 }, (x, i) => `${200 + i}MD`)).map((t, i) => vl(7000 + i, '71', t)),
  72: ['LUX279PRL', 'LUX 101', 'AC-555'].map((t, i) => vl(7500 + i, '72', t)),
};
const TEN_NHOM = { 71: 'MDF', 72: 'Acrylic' };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const goiAPI = [];
const cham = { ms: 0, dang: 0, max: 0, khongTong: false };      // làm chậm /CAD-materialList (ms) và ghi số yêu cầu đang chờ cùng lúc — để thử việc đọc các trang song song
const phucVuAPI = async r => {
  const u = new URL(r.request().url()), h = { 'access-control-allow-origin': 'https://cfcad.cn', 'access-control-allow-credentials': 'true' };
  if (u.pathname.startsWith('/CAD/images/')) return r.fulfill({ status: 200, contentType: 'image/png', headers: h, body: PNG });
  let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch (e) { body = {}; }
  goiAPI.push([u.pathname, body]);
  let j = { err_code: 1, err_msg: 'no' };
  if (u.pathname === '/CAD-dirQuery') j = { err_code: 0, err_msg: '', dirs: body.dir_type === '2' ? [{ dir_id: '71', dir_type: '2', dir_name: 'MDF', childs: [] }, { dir_id: '72', dir_type: '2', dir_name: 'ACRYLIC', childs: [] }] : [] };
  else if (u.pathname === '/CAD-materialList') {
    const ds = KHO[body.dir_id] || [], tr = Math.max(1, +body.curr_page || 1), n = +body.page_count || 20;
    j = { err_code: 0, err_msg: '', count: cham.khongTong ? '' : String(ds.length), materials: ds.slice((tr - 1) * n, tr * n) };
    if (cham.ms) { cham.dang++; cham.max = Math.max(cham.max, cham.dang); await new Promise(x => setTimeout(x, cham.ms)); cham.dang--; }
  } else if (u.pathname === '/CAD-materialDetail') {
    const m = Object.values(KHO).flat().find(x => x.material_id === String(body.material_id));
    if (m) { const nhom = TEN_NHOM[m.dir_id]; j = { err_code: 0, err_msg: '', materials: Object.assign({}, m, { file: zlib.deflateSync(Buffer.from(JSON.stringify(['MOCK_VL', m.name, nhom, m.name, nhom]))).toString('base64') }) }; }
  }
  return r.fulfill({ status: 200, contentType: 'application/json', headers: h, body: JSON.stringify(j) });
};
const dem = duong => goiAPI.filter(g => g[0] === duong).length;
// tủ 2 khoang: khoang 1 có cánh + 2 ngăn kéo âm sau cánh; khoang 2 hở; có phào, xà chân trước. Vẽ theo cách nhập tấm rồi gom module (trang giả lập không có lệnh gốc).
const TU = { ma: 'A1', rong: 1200, cao: 2000, than: { cao_duoi: 0 }, khoang: [{ rong: 'auto', canh: 1, dot: [700, 1400], o: [{ tu: 0, kieu: 'nk_am', so: 2 }] }, { rong: 'auto', canh: 0, dot: [500, 1000, 1500] }] };

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mncf-mau-'));
  const ctx = await chromium.launchPersistentContext(dir, { channel: 'chromium', headless: true, viewport: { width: 1500, height: 900 }, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  try {
    await ctx.route('https://api.cfcad.cn/**', phucVuAPI);
    await require('./kho-gia.js')(ctx);      // bộ nạp của tiện ích lấy bản gộp vừa dựng trong máy
    await ctx.route('https://cfcad.cn/**', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: MOCK }));
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    await page.goto('https://cfcad.cn/');
    await page.waitForFunction(() => window.MNCF && window.MNCF.app && window.MNCFDriver, null, { timeout: 15000 });
    const H = page.locator('#mncf-host');
    // trạng thái màu của các tấm (tu = chỉ các tấm có tên tủ bắt đầu bằng chữ đó): "vật liệu hiển thị/tên ván/vật liệu/màu" → tên các tấm
    const xem = tu => page.evaluate(t => { const D = window.MNCFDriver, ra = {}; for (const b of D.all().filter(D.isBoard)) { const o = b.BoardProcessOption; if (t && String(o.cabinetName || '').indexOf(t) !== 0) continue; const k = [b.Material.Object.Name, o.boardName, o.material, o.color].join('/'); (ra[k] = ra[k] || []).push(b.Name); } for (const k of Object.keys(ra)) ra[k] = [...new Set(ra[k])].sort().join(', '); return ra; }, tu || '');

    console.log('— Đọc kho vật liệu của tài khoản (chỉ đọc), có nhớ lại');
    let r = await page.evaluate(async () => { const k = await window.MNCFDriver.khoVatLieu(); return { so: k.ds.length, nhom: k.nhom, dau: k.ds[0], cuoi: k.ds[k.ds.length - 1], thu130: k.ds[129] }; });
    eq([r.so, r.nhom], [133, ['MDF', 'ACRYLIC']], 'đủ 133 màu của 2 thư mục (thư mục MDF 130 mã phải đọc 2 trang)');
    eq(r.dau, { id: '7000', ten: '103T', nhom: 'MDF', hinh: 'https://api.cfcad.cn/CAD/images/aa/thumbs/7000_100.jpg' }, 'mỗi màu: mã vật liệu, tên (mã màu), nhóm = tên thư mục, địa chỉ ảnh nhỏ');
    eq([r.thu130.ten, r.cuoi.ten, r.cuoi.nhom], ['327MD', 'AC-555', 'ACRYLIC'], 'đúng thứ tự kho: hết MDF rồi tới ACRYLIC');
    eq([dem('/CAD-dirQuery'), dem('/CAD-materialList'), goiAPI.find(g => g[0] === '/CAD-dirQuery')[1].dir_type], [1, 3, '2'], 'hỏi thư mục vật liệu (dir_type 2) 1 lần, danh sách 3 trang');
    await page.evaluate(() => window.MNCFDriver.khoVatLieu());
    eq(dem('/CAD-materialList'), 3, 'gọi lần hai: dùng danh sách đã nhớ, không hỏi lại máy chủ');
    await page.evaluate(() => window.MNCFDriver.khoVatLieu({ lam_moi: true }));
    eq(dem('/CAD-materialList'), 6, 'lam_moi: đọc lại từ máy chủ');
    ok(goiAPI.every(g => /^\/CAD-(dirQuery|materialList)$/.test(g[0])), 'chỉ gọi lệnh ĐỌC', goiAPI.map(g => g[0]));

    console.log('— Vẽ 2 tủ, chia nhóm màu của một tủ');
    r = await page.evaluate(async s => { const a = await window.MNCF.draw(s, { at: [0, 0, 0] }), b = await window.MNCF.draw(Object.assign({}, s, { ma: 'B2' }), { at: [3000, 0, 0] }); return [a.ok, b.ok, a.errors, b.errors]; }, TU);
    ok(r[0] && r[1], 'vẽ được 2 tủ thử', r);
    r = await page.evaluate(() => { const D = window.MNCFDriver, bs = D.all().filter(D.isBoard), a1 = bs.filter(b => /^A1/.test(b.BoardProcessOption.cabinetName));
      const tu = D.tamCuaTu([a1.find(b => b.Name === 'Đợt')]), pn = D.phanNhomMau(tu);
      return { tong: bs.length, a1: a1.length, tu: tu.length, khac: tu.filter(b => !/^A1/.test(b.BoardProcessOption.cabinetName)).length, dem: pn.dem, mat: pn.ten.mat, hau: pn.ten.hau, nkThung: pn.ten.thung['抽面板'] }; });
    ok(r.tu === r.a1 && r.khac === 0 && r.tong === 2 * r.a1, 'chọn 1 tấm → ra đủ các tấm của ĐÚNG tủ đó (kể cả hộp ngăn kéo), không lẫn tủ bên cạnh', r);
    eq(Object.entries(r.mat).sort(), [['Chân trước', 1], ['Cánh trái', 1], ['Phào phải', 1], ['Phào trái', 1], ['Phào trên', 1]], 'nhóm mặt: cánh, 3 phào, xà chân trước');
    eq([r.hau, r.nkThung], [{ 'Hậu': 2 }, 2], 'hậu 2 tấm; 2 mặt ngăn kéo âm (nằm sau cánh) thuộc thùng');
    eq(r.dem.thung + r.dem.mat + r.dem.hau, r.a1, 'ba nhóm cộng lại đủ số tấm');

    console.log('— Đổ màu tủ: thùng một màu, cánh + phào một màu; một bước hoàn tác');
    const truoc = await page.evaluate(() => ({ hm: window.app.Database.hm.curIndex, chep: window.__MOCK_CHEP_VL__ || 0 }));
    r = await page.evaluate(async () => { const D = window.MNCFDriver, K = await D.khoVatLieu(), m = t => K.ds.find(x => x.ten === t);
      const tu = D.tamCuaTu([D.all().filter(D.isBoard).find(b => /^A1/.test(b.BoardProcessOption.cabinetName))]);
      return await D.doMauTu(tu, { thung: m('103T'), mat: m('LUX279PRL'), hau: null }); });
    ok(r.ok && r.so.mat === 5 && r.so.hau === 2 && r.so.thung > 10 && r.khoa === 0 && r.steps === 1, 'kết quả: số tấm từng nhóm, không tấm khoá, 1 bước hoàn tác', r);
    eq(r.mau, { thung: '103T', mat: 'LUX279PRL', hau: '103T' }, 'hậu không chọn màu riêng thì theo màu thùng');
    let m = await xem();
    eq(Object.keys(m).sort(), ['103T/MDF/MDF/103T', 'LUX279PRL/Acrylic/Acrylic/LUX279PRL', '默认///'], 'tấm mang vật liệu hiển thị + tên ván / vật liệu / màu lấy từ thông tin ván của vật liệu; tủ B2 chưa đổ còn nguyên');
    eq(m['LUX279PRL/Acrylic/Acrylic/LUX279PRL'], 'Chân trước, Cánh trái, Phào phải, Phào trái, Phào trên', 'cánh + phào + xà chân trước mang màu mặt');
    ok(/Hậu/.test(m['103T/MDF/MDF/103T']) && /抽面板/.test(m['103T/MDF/MDF/103T']) && /Hồi trái/.test(m['103T/MDF/MDF/103T']), 'thùng, hậu, mặt ngăn kéo âm mang màu thùng', m['103T/MDF/MDF/103T']);
    let sau = await page.evaluate(() => ({ hm: window.app.Database.hm.curIndex, chep: window.__MOCK_CHEP_VL__ || 0, bang: [...window.app.Database.MaterialTable.Symbols.keys()] }));
    eq([sau.hm - truoc.hm, sau.chep - truoc.chep, dem('/CAD-materialDetail'), sau.bang], [1, 2, 2, ['默认', '103T', 'LUX279PRL']], '1 bước lịch sử; 2 vật liệu được tải (mỗi màu 1 lần) và chép vào bảng vật liệu của bản vẽ');
    // đổ lại cùng màu cho tủ thứ hai: vật liệu đã có trong bản vẽ → không tải lại
    r = await page.evaluate(async () => { const D = window.MNCFDriver, K = await D.khoVatLieu(), m = t => K.ds.find(x => x.ten === t);
      const tu = D.tamCuaTu([D.all().filter(D.isBoard).find(b => /^B2/.test(b.BoardProcessOption.cabinetName))]);
      return await D.doMauTu(tu, { thung: m('103T'), mat: m('LUX279PRL'), hau: m('388EV') }); });
    eq([r.ok, r.mau.hau, dem('/CAD-materialDetail')], [true, '388EV', 3], 'tủ thứ hai: chỉ tải thêm màu hậu (388EV), hai màu kia dùng lại');
    m = await xem('B2'); const mB = await xem();
    ok(mB['388EV/MDF/MDF/388EV'] === 'Hậu' && !mB['默认///'], 'tủ B2: hậu mang màu riêng; không còn tấm nào chưa đổ', mB);
    // hoàn tác lần đổ màu vừa rồi (tủ B2 về như cũ, tủ A1 giữ nguyên)
    r = await page.evaluate(async () => window.MNCFDriver.undoMau());
    m = await xem();
    ok(r.ok && /Hậu/.test(m['默认///'] || '') && m['103T/MDF/MDF/103T'] && !m['388EV/MDF/MDF/388EV'], 'hoàn tác: tủ B2 trở lại chưa đổ (vật liệu mặc định, ô thông tin trống), tủ A1 giữ màu', [r, m]);
    r = await page.evaluate(async () => window.MNCFDriver.undoMau());
    ok(r.ok === false && /Chưa có lần đổ màu nào/.test(r.reason), 'bấm hoàn tác lần nữa: báo không còn lần đổ màu nào (không lùi nhầm việc khác)', r);

    console.log('— Chỉ đổ một nhóm; tấm khoá vật liệu được bỏ qua và có đếm');
    r = await page.evaluate(async () => { const D = window.MNCFDriver, K = await D.khoVatLieu(), m = t => K.ds.find(x => x.ten === t);
      const b2 = D.all().filter(D.isBoard).filter(b => /^B2/.test(b.BoardProcessOption.cabinetName)); b2.find(b => b.Name === 'Phào trên').LockMaterial = true;
      const k = await D.doMauTu(D.tamCuaTu([b2[0]]), { thung: null, mat: m('AC-555'), hau: null }); b2.find(b => b.Name === 'Phào trên').LockMaterial = false; return k; });
    eq([r.ok, r.so, r.khoa, r.mau], [true, { thung: 0, mat: 4, hau: 0 }, 1, { thung: '', mat: 'AC-555', hau: '' }], 'chỉ chọn màu mặt: thùng + hậu giữ nguyên; 1 tấm khoá vật liệu không bị đổi');
    m = await xem();
    ok(m['AC-555/Acrylic/Acrylic/AC-555'] === 'Chân trước, Cánh trái, Phào phải, Phào trái' && /Phào trên/.test(m['默认///']), 'tấm khoá (Phào trên) vẫn là vật liệu cũ', m);

    console.log('— Đổ thẳng một màu cho các tấm đưa vào; màu đang dùng; thay màu');
    r = await page.evaluate(async () => { const D = window.MNCFDriver, K = await D.khoVatLieu(), m = t => K.ds.find(x => x.ten === t);
      const b2 = D.all().filter(D.isBoard).filter(b => /^B2/.test(b.BoardProcessOption.cabinetName) && b.Name === 'Đợt');
      const k = await D.doMau(b2, m('388EV')); return { k, n: b2.length, dung: D.mauDangDung() }; });
    ok(r.k.ok && r.k.so === r.n && r.k.steps === 1, 'đổ thẳng 388EV cho các đợt của tủ B2', r.k);
    ok(r.dung[0].ten === '103T' && r.dung[0].so > 10 && r.dung.find(x => x.ten === '388EV').so === r.n && r.dung.find(x => x.ten === '').so > 0 && r.dung.every((x, i) => i === 0 || x.so <= r.dung[i - 1].so || x.ten === ''), 'màu đang dùng trên bản vẽ: xếp theo số tấm, tấm chưa đổ màu ghi tên rỗng (xếp cuối)', r.dung);
    r = await page.evaluate(async () => { const D = window.MNCFDriver, K = await D.khoVatLieu(), m = t => K.ds.find(x => x.ten === t); const tr = D.mauDangDung().find(x => x.ten === '103T').so;
      const k = await D.thayMau('103T', m('200MD')); return { k, tr, dung: D.mauDangDung().map(x => x.ten + ':' + x.so) }; });
    ok(r.k.ok && r.k.so === r.tr && r.k.steps === 1 && r.dung.includes('200MD:' + r.tr) && !r.dung.some(t => /^103T:/.test(t)), 'thay 103T → 200MD trên cả bản vẽ: đủ số tấm, các màu khác không đổi', r);
    m = await xem();
    ok(m['200MD/MDF/MDF/200MD'] && /Hồi trái/.test(m['200MD/MDF/MDF/200MD']) && m['LUX279PRL/Acrylic/Acrylic/LUX279PRL'], 'tấm đổi cả vật liệu hiển thị lẫn ô thông tin ván', m);
    r = await page.evaluate(async () => { const D = window.MNCFDriver, K = await D.khoVatLieu(), m = t => K.ds.find(x => x.ten === t);
      const a1 = D.all().filter(D.isBoard).filter(b => /^A1/.test(b.BoardProcessOption.cabinetName));
      const k = await D.thayMau('', m('201MD'), a1), k2 = await D.thayMau('KHONG-CO', m('201MD')); return { k, k2 }; });
    eq([r.k.so, r.k2.ok, r.k2.so], [0, true, 0], 'thay trong phạm vi tủ A1 màu "chưa đổ": tủ A1 không có tấm nào như vậy → 0; màu không có trên bản vẽ → 0, không lỗi');
    r = await page.evaluate(async () => { try { return await window.MNCFDriver.doMauTu([], { thung: { id: '999999', ten: 'KHONG-CO' } }); } catch (e) { return { nem: String(e.message) }; } });
    ok(r.ok === false && /không có tấm/i.test(r.reason || '') && !r.nem && dem('/CAD-materialDetail') === 5, 'không có tấm nào: trả lỗi rõ, không ném, không đi tải vật liệu', [r, dem('/CAD-materialDetail')]);
    r = await page.evaluate(async () => { const D = window.MNCFDriver; try { const k = await D.doMau(D.all().filter(D.isBoard).slice(0, 2), { id: '999999', ten: 'KHONG-CO' }); return k; } catch (e) { return { nem: String(e.message) }; } });
    ok(r.ok === false && /KHONG-CO/.test(r.reason || '') && !r.nem, 'vật liệu không tải được từ kho: trả lỗi có tên màu, không ném, không đổi tấm nào', r);

    console.log('— Tủ của bảng CHƯA gom module và tấm rời vẽ tay: vẫn gom đúng "một tủ"');
    r = await page.evaluate(async s => { const D = window.MNCFDriver, M = window.__MOCK__;
      const k = await window.MNCF.draw(Object.assign({}, s, { ma: 'C3', module_cf: false }), { at: [6000, 0, 0] });
      const c3 = D.all().filter(D.isBoard).filter(b => /^C3/.test(b.BoardProcessOption.cabinetName));
      const tu = D.tamCuaTu([c3.find(b => b.Name === 'Hồi trái')]);
      // 3 tấm vẽ tay: 2 tấm cùng tên tủ "Kệ tay" (không module, không mã tủ), 1 tấm không tên tủ
      const t1 = M.them(new M.Board('Đợt', 0, [9000, 9500, 0, 300, 0, 18], 18, 'Kệ tay', 'P1', ['不排', '不排', '不排', '不排'])), t2 = M.them(new M.Board('Hồi', 1, [9000, 9018, 0, 300, 18, 500], 18, 'Kệ tay', 'P1', ['不排', '不排', '不排', '不排'])), t3 = M.them(new M.Board('Tấm lẻ', 0, [9900, 9950, 0, 300, 0, 18], 18, '', '', ['不排', '不排', '不排', '不排']));
      return { ok: k.ok, module: !!(k.module && k.module.ok), c3: c3.length, tu: tu.length, coNK: tu.filter(b => /^抽/.test(b.Name)).length, tay: D.tamCuaTu([t1]).map(b => b.Name).sort(), le: D.tamCuaTu([t3]).map(b => b.Name), haiTu: D.tamCuaTu([t1, c3[0]]).length }; }, TU);
    ok(r.ok && !r.module && r.tu === r.c3 && r.coNK > 0, 'tủ chưa gom module: chọn hồi trái vẫn ra cả hộp ngăn kéo (mẫu kho đi theo tên tủ)', r);
    eq([r.tay, r.le, r.haiTu], [['Hồi', 'Đợt'], ['Tấm lẻ'], r.c3 + 2], 'tấm rời: gom theo tên phòng + tên tủ; tấm không tên tủ chỉ là chính nó; chọn tấm của hai tủ thì ra cả hai');

    console.log('— Thẻ Màu: danh sách màu của xưởng, tìm theo mã, lọc nhóm');
    const SR = () => page.evaluateHandle(() => document.getElementById('mncf-host').shadowRoot);
    const st = () => H.locator('.status').textContent();
    const chon = f => page.evaluate(src => { const D = window.MNCFDriver, ds = D.all().filter(D.isBoard).filter(new Function('b', 'return ' + src)); window.__MOCK__.userSelect(ds); return ds.length; }, f);
    await H.locator('.launch').click();
    await theSau(H, 'mausac');
    await H.locator('.vlds .vlc').first().waitFor({ timeout: 10000 });
    eq(await H.locator('.vlds .vlc').count(), 120, 'kho 133 màu: bảng dựng 120 ô đầu');
    ok(/133 màu/.test(await H.locator('[data-ui="vl-dem"]').innerText()) && /còn 13/.test(await H.locator('[data-ui="vl-dem"]').innerText()), 'ghi tổng số màu và số chưa hiện', await H.locator('[data-ui="vl-dem"]').innerText());
    ok(await H.locator('.vlds .vlc img').first().evaluate(i => /\/CAD\/images\/aa\/thumbs\/7000_100\.jpg$/.test(i.src)) && (await H.locator('.vlds .vlc').first().innerText()).trim() === '103T', 'mỗi ô màu có ảnh nhỏ của kho + mã màu');
    eq(await H.locator('[data-ui="vl-nhom"] option').allInnerTexts(), ['Mọi nhóm', 'MDF', 'ACRYLIC'], 'ô chọn nhóm = các thư mục vật liệu của tài khoản');
    await H.locator('[data-act="vl-het"]').click();
    eq([await H.locator('.vlds .vlc').count(), (await H.locator('[data-ui="vl-dem"]').innerText()).trim(), await H.locator('[data-act="vl-het"]').count()], [133, '133 màu', 0], 'bấm “Hiện hết”: dựng đủ 133 ô, nút biến mất');
    const loc = async chu => { await H.locator('[data-ui="vl-tim"]').fill(chu); await page.waitForTimeout(350); return (await H.locator('.vlds .vlc').allInnerTexts()).map(t => t.trim()); };
    eq(await loc('lux'), ['LUX279PRL', 'LUX 101'], 'gõ "lux": 2 mã');
    eq(await loc('lux101'), ['LUX 101'], 'bỏ qua dấu cách trong mã');
    eq(await loc('103'), ['103T'], 'gõ 103');
    ok(/1 \/ 133/.test(await H.locator('[data-ui="vl-dem"]').innerText()), 'đếm số mã khớp', await H.locator('[data-ui="vl-dem"]').innerText());
    await H.locator('[data-ui="vl-tim"]').fill(''); await H.locator('[data-ui="vl-nhom"]').selectOption('ACRYLIC'); await page.waitForTimeout(350);
    eq((await H.locator('.vlds .vlc').allInnerTexts()).map(t => t.trim()), ['LUX279PRL', 'LUX 101', 'AC-555'], 'lọc theo nhóm ACRYLIC');
    await H.locator('[data-ui="vl-nhom"]').selectOption('');
    // bản 1.25: bảng mặc định rộng 560; màn hình hẹp thì bảng co lại còn 448 (bề rộng cũ). Bản 1.27: hàng thẻ chính 5 nút (Tủ · Phòng · Kho mẫu · Kết quả · ⚙) + hàng thẻ phụ 4 nút
    // (Màu · Chuẩn xưởng · Hướng dẫn · Đo mạng — đang hiện vì thẻ Màu đang mở): MỖI hàng phải nằm trên một dòng ở cả hai bề rộng
    r = await H.locator('.tabs:not(.tabs2)').evaluate(e => { const p = e.closest('.panel'), e2 = p.querySelector('.tabs2'), cao = x => Math.round(x.getBoundingClientRect().height), rong = Math.round(p.getBoundingClientRect().width), c = [cao(e), cao(e2)], cu = p.style.width;
      p.style.width = '448px'; const hep = [cao(e), cao(e2)], rong_hep = Math.round(p.getBoundingClientRect().width); p.style.width = cu; return { cao: c, so: [e.children.length, e2.children.length], rong, hep, rong_hep, phu_hien: !e2.hidden }; });
    ok(JSON.stringify(r.so) === '[5,4]' && r.phu_hien && Math.min(...r.cao) > 0 && Math.max(...r.cao) < 44 && r.rong === 560 && Math.min(...r.hep) > 0 && Math.max(...r.hep) < 44 && r.rong_hep === 448, 'hàng thẻ chính (5 nút) và hàng thẻ phụ (4 nút): mỗi hàng nằm trên MỘT dòng ở bảng mặc định (rộng 560) và cả khi bảng hẹp còn 448', r);
    const truocLai = dem('/CAD-materialList');
    await H.locator('[data-act="vl-lai"]').click();
    await page.waitForFunction(() => /Đã đọc lại kho vật liệu: 133 màu/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 10000 });
    eq(dem('/CAD-materialList') - truocLai, 3, 'nút “Đọc lại kho”: hỏi lại máy chủ (anh vừa thêm màu mới trong Chenfeng thì bấm nút này)');

    console.log('— Chọn màu cho từng ô (Thùng / Cánh + phào / Hậu), máy tự nhớ');
    ok(await H.locator('.vlo[data-v="thung"]').evaluate(e => e.classList.contains('on')), 'ô Thùng bật sẵn');
    ok(/chưa chọn/.test(await H.locator('.vlo[data-v="thung"]').innerText()) && /như thùng/.test(await H.locator('.vlo[data-v="hau"]').innerText()), 'ô chưa có màu: Thùng "chưa chọn", Hậu "như thùng"');
    await loc('103'); await H.locator('.vlds .vlc').first().click();
    ok(/103T/.test(await H.locator('.vlo[data-v="thung"]').innerText()), 'bấm màu → ô Thùng nhận 103T');
    await H.locator('.vlo[data-v="mat"]').click();
    ok(await H.locator('.vlo[data-v="mat"]').evaluate(e => e.classList.contains('on')) && !(await H.locator('.vlo[data-v="thung"]').evaluate(e => e.classList.contains('on'))), 'bấm ô Cánh + phào → ô đó bật');
    await loc('lux279'); await H.locator('.vlds .vlc').first().click();
    ok(/LUX279PRL/.test(await H.locator('.vlo[data-v="mat"]').innerText()) && /103T/.test(await H.locator('.vlo[data-v="thung"]').innerText()), 'ô Cánh + phào nhận LUX279PRL, ô Thùng giữ 103T');
    r = await page.evaluate(() => { try { return JSON.parse(window.localStorage.getItem('mncf.mau.v1')); } catch (e) { return null; } });
    ok(r && r.o.thung.ten === '103T' && r.o.thung.id === '7000' && r.o.mat.ten === 'LUX279PRL' && r.o.hau === null && r.bat === 'mat', 'các ô màu được nhớ trong máy (khoá mncf.mau.v1)', r);
    eq((await H.locator('.vlgan .vlg').allInnerTexts()).map(t => t.trim()), ['LUX279PRL', '103T'], '"Vừa dùng": màu mới bấm đứng trước');
    // ô Hậu: mặc định theo màu thùng; chọn màu riêng được; bấm ✕ thì trở lại "như thùng"
    await H.locator('.vlo[data-v="hau"]').click();
    await loc('388'); await H.locator('.vlds .vlc').first().click();
    r = await page.evaluate(() => JSON.parse(window.localStorage.getItem('mncf.mau.v1')));
    ok(/388EV/.test(await H.locator('.vlo[data-v="hau"]').innerText()) && r.o.hau.ten === '388EV' && r.bat === 'hau', 'ô Hậu nhận màu riêng 388EV', r);
    await H.locator('.vlo[data-v="hau"] [data-act="vl-bo"]').click();
    r = await page.evaluate(() => JSON.parse(window.localStorage.getItem('mncf.mau.v1')));
    ok(/như thùng/.test(await H.locator('.vlo[data-v="hau"]').innerText()) && r.o.hau === null && (await H.locator('.vlo[data-v="hau"] [data-act="vl-bo"]').count()) === 0 && (await H.locator('.vlo[data-v="thung"] [data-act="vl-bo"]').count()) === 1, 'bấm ✕ ở ô Hậu: hậu lại theo màu thùng; ô chưa có màu thì không có nút ✕', r);
    eq((await H.locator('.vlgan .vlg').allInnerTexts()).map(t => t.trim()), ['388EV', 'LUX279PRL', '103T'], '"Vừa dùng" vẫn giữ màu vừa bỏ khỏi ô');
    await H.locator('.vlgan .vlg').first().click();
    ok(/388EV/.test(await H.locator('.vlo[data-v="hau"]').innerText()), 'bấm một màu ở "Vừa dùng" → gán cho ô đang bật (Hậu)');
    eq((await H.locator('.vlgan .vlg').allInnerTexts()).map(t => t.trim()), ['388EV', 'LUX279PRL', '103T'], 'bấm lại màu đã có trong "Vừa dùng": không nhân đôi');
    await H.locator('.vlo[data-v="hau"] [data-act="vl-bo"]').click();
    ok(/103T/.test(await H.locator('[data-ui="vl-den"]').innerText()), 'ô Hậu đang bật mà chưa có màu riêng: màu để đổ riêng / thay vào là màu thùng', await H.locator('[data-ui="vl-den"]').innerText());
    await H.locator('.vlo[data-v="mat"]').click();

    console.log('— Đổ màu tủ đang chọn; hoàn tác');
    await chon('false');
    await H.locator('[data-act="vl-do"]').click();
    ok(/Chọn 1 tấm của tủ/.test(await st()), 'chưa chọn tấm nào: nhắc chọn tấm, không làm gì', await st());
    await chon('/^C3/.test(b.BoardProcessOption.cabinetName) && b.Name === "Hồi trái"');
    await H.locator('[data-act="vl-do"]').click();
    await H.locator('[data-ui="vl-kq"] .msg.ok').waitFor({ timeout: 10000 });
    let kqm = await H.locator('[data-ui="vl-kq"]').innerText();
    ok(/thùng \d+ tấm → 103T/.test(kqm) && /cánh \+ phào 5 tấm → LUX279PRL/.test(kqm) && /hậu 2 tấm → 103T/.test(kqm), 'kết quả ghi số tấm và màu của từng nhóm', kqm);
    ok(/Cánh trái/.test(kqm) && /Chân trước/.test(kqm) && /Phào trái/.test(kqm), 'ghi rõ nhóm cánh + phào gồm những tấm nào', kqm);
    m = await xem('C3');
    eq(Object.keys(m).sort(), ['103T/MDF/MDF/103T', 'LUX279PRL/Acrylic/Acrylic/LUX279PRL'], 'tủ C3 đã mang 2 màu');
    await H.locator('[data-act="vl-hoan"]').click();
    await page.waitForFunction(() => /Đã hoàn tác/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 10000 });
    eq(Object.keys(await xem('C3')), ['默认///'], 'hoàn tác: tủ C3 trở lại chưa đổ màu');
    ok((await H.locator('[data-act="vl-hoan"]').count()) === 0, 'hoàn tác xong thì nút hoàn tác biến mất');

    console.log('— Đổ màu của ô đang bật cho đúng các tấm đang chọn');
    const n2 = await chon('/^C3/.test(b.BoardProcessOption.cabinetName) && b.Name === "Đợt"');
    await H.locator('[data-act="vl-tam"]').click();
    await H.locator('[data-ui="vl-kq"] .msg.ok').waitFor({ timeout: 10000 });
    m = await xem('C3');
    ok(m['LUX279PRL/Acrylic/Acrylic/LUX279PRL'] === 'Đợt' && new RegExp(n2 + ' tấm').test(await H.locator('[data-ui="vl-kq"]').innerText()), 'chỉ các đợt đang chọn nhận màu của ô Cánh + phào (ô đang bật)', [m, await H.locator('[data-ui="vl-kq"]').innerText()]);

    console.log('— Tìm và thay màu trên bản vẽ');
    await H.locator('[data-act="vl-quet"]').click();
    await H.locator('[data-ui="vl-dung"] .vld').first().waitFor({ timeout: 5000 });
    const chip = (await H.locator('[data-ui="vl-dung"] .vld').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());
    ok(chip.some(t => /^200MD · \d+ tấm$/.test(t)) && /^Chưa đổ màu · \d+ tấm$/.test(chip[chip.length - 1]), 'liệt kê màu đang dùng + số tấm; "Chưa đổ màu" đứng cuối', chip);
    const so200 = +/· (\d+) tấm/.exec(chip.find(t => /^200MD/.test(t)))[1];
    await H.locator('[data-ui="vl-dung"] .vld[data-v="200MD"]').click();
    await H.locator('.vlo[data-v="thung"]').click();      // màu thay vào = màu của ô đang bật (Thùng: 103T)
    ok(/200MD/.test(await H.locator('[data-ui="vl-tu"]').innerText()) && /103T/.test(await H.locator('[data-ui="vl-den"]').innerText()), 'dòng "Thay … bằng …" ghi đúng hai màu');
    await H.locator('[data-act="vl-xem"]').click();
    eq(await page.evaluate(() => window.MNCFDriver.selected().length), so200, '"Chọn các tấm màu này": các tấm 200MD được chọn trên bản vẽ');
    await H.locator('[data-act="vl-thay"][data-v="tat"]').click();
    await page.waitForFunction(() => /Đã thay/.test(document.getElementById('mncf-host').shadowRoot.querySelector('[data-ui="vl-kq"]').textContent), null, { timeout: 10000 });
    kqm = await H.locator('[data-ui="vl-kq"]').innerText();
    ok(new RegExp('200MD → 103T').test(kqm) && new RegExp(so200 + ' tấm').test(kqm), 'thay 200MD → 103T trên cả bản vẽ', kqm);
    const chip2 = (await H.locator('[data-ui="vl-dung"] .vld').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());
    ok(!chip2.some(t => /^200MD/.test(t)) && chip2.some(t => new RegExp('^103T · ' + so200 + ' tấm$').test(t)), 'danh sách màu đang dùng tự cập nhật', chip2);

    await H.locator('[data-ui="vl-dung"] .vld[data-v="103T"]').click();
    await H.locator('[data-act="vl-thay"][data-v="tat"]').click();
    ok(/trùng với màu cần thay/.test(await st()) && /Đã thay 200MD/.test(await H.locator('[data-ui="vl-kq"]').innerText()), 'màu thay vào trùng màu cần thay: nhắc, không làm gì', await st());

    console.log('— Thay màu chỉ trong các tấm đang chọn');
    await H.locator('[data-ui="vl-dung"] .vld[data-v="LUX279PRL"]').click();
    await chon('false');
    await H.locator('[data-act="vl-thay"][data-v="chon"]').click();
    ok(/quét chọn các tấm/.test(await st()), 'chưa chọn tấm nào: nhắc quét chọn, không thay gì', await st());
    await chon('/^A1/.test(b.BoardProcessOption.cabinetName)');
    await H.locator('[data-act="vl-thay"][data-v="chon"]').click();
    await page.waitForFunction(() => /LUX279PRL → 103T/.test(document.getElementById('mncf-host').shadowRoot.querySelector('[data-ui="vl-kq"]').textContent), null, { timeout: 10000 });
    kqm = await H.locator('[data-ui="vl-kq"]').innerText();
    ok(/5 tấm/.test(kqm) && /trong các tấm đang chọn/.test(kqm), 'kết quả ghi rõ phạm vi + số tấm', kqm);
    m = await xem();
    ok(JSON.stringify(Object.keys(await xem('A1'))) === '["103T/MDF/MDF/103T"]' && m['LUX279PRL/Acrylic/Acrylic/LUX279PRL'] === 'Đợt', 'chỉ cánh + phào của tủ A1 (đang chọn) đổi sang 103T; các đợt màu LUX279PRL của tủ C3 giữ nguyên', m);

    console.log('— Tủ vẽ mới tự đổ màu theo các ô; hoàn tác lần vẽ lùi cả màu');
    await H.locator('[data-ui="vl-tudong"]').check();
    eq(await page.evaluate(() => JSON.parse(window.localStorage.getItem('mncf.mau.v1')).tu_dong), true, 'lựa chọn tự đổ màu được nhớ');
    const truocVe = await page.evaluate(() => window.MNCFDriver.all().length);
    await page.evaluate(s => window.MNCF.app.setSpec(s), Object.assign({}, TU, { ma: 'D4' }));
    await H.locator('.tab[data-tab="tu"]').click();
    if (!(await H.locator('#mncf-ui-ax').isVisible())) await H.locator('[data-act="nut-them"]').click();      // (bản 1.27) ô toạ độ nằm sau nút ⋯
    await H.locator('#mncf-ui-useat').check(); await H.locator('#mncf-ui-ax').fill('12000');
    await H.locator('[data-act="draw"]').click();
    await page.waitForFunction(() => /Đã tự đổ màu/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.report').textContent), null, { timeout: 30000 });
    m = await xem('D4');
    eq(Object.keys(m).sort(), ['103T/MDF/MDF/103T', 'LUX279PRL/Acrylic/Acrylic/LUX279PRL'], 'tủ vừa vẽ đã mang màu thùng + màu cánh');
    ok(/thùng \d+ tấm → 103T/.test(await H.locator('.report').innerText()), 'thẻ Kết quả ghi đã tự đổ màu');
    await H.locator('footer [data-act="undo"]').click();
    await page.waitForFunction(() => /Đã hoàn tác lần vẽ/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 15000 });
    eq(await page.evaluate(() => window.MNCFDriver.all().length), truocVe, '"Hoàn tác lần vẽ này" lùi cả bước đổ màu lẫn bước vẽ: bản vẽ trở lại như trước');

    console.log('— Cập nhật tủ đã đổ màu: tủ vẽ lại giữ màu của tủ cũ');
    await theSau(H, 'mausac');
    await H.locator('[data-ui="vl-tudong"]').uncheck();
    await page.evaluate(s => window.MNCF.app.setSpec(s), Object.assign({}, TU, { ma: 'E5' }));
    await H.locator('.tab[data-tab="tu"]').click();
    await H.locator('#mncf-ui-ax').fill('15000');
    await H.locator('[data-act="draw"]').click();
    await H.locator('.report .msg.ok').waitFor({ timeout: 30000 });
    ok(!/tự đổ màu/.test(await H.locator('.report').innerText()) && JSON.stringify(Object.keys(await xem('E5'))) === '["默认///"]', 'đã tắt tự đổ màu: tủ vẽ mới giữ vật liệu mặc định');
    const E5 = () => page.evaluate(() => { const D = window.MNCFDriver, bs = D.all().filter(D.isBoard).filter(b => /^E5/.test(b.BoardProcessOption.cabinetName)); return { n: bs.length, rong: Math.round(Math.max(...bs.map(b => b.BoundingBox.max.x)) - Math.min(...bs.map(b => b.BoundingBox.min.x))) }; });
    // tủ cũ: thùng 388EV, cánh + phào AC-555, hậu CHƯA đổ (khác hẳn màu của các ô đang chọn: 103T / LUX279PRL)
    r = await page.evaluate(async () => { const D = window.MNCFDriver, K = await D.khoVatLieu(), m = t => K.ds.find(x => x.ten === t);
      const tu = D.tamCuaTu([D.all().filter(D.isBoard).find(b => /^E5/.test(b.BoardProcessOption.cabinetName))]), pn = D.phanNhomMau(tu);
      const a = await D.doMau(tu.filter((b, i) => pn.nhom[i] === 'thung'), m('388EV')), c = await D.doMau(tu.filter((b, i) => pn.nhom[i] === 'mat'), m('AC-555'));
      return [a.ok, c.ok, D.mauCuaTu(tu)]; });
    eq(r, [true, true, { mau: { thung: '388EV', mat: 'AC-555', hau: '' }, lan: [], co: true }], 'mauCuaTu: màu đang mang của từng nhóm (hậu chưa đổ = rỗng)');
    let taiTruoc = dem('/CAD-materialDetail'); const e0 = await E5();
    await page.evaluate(s => window.MNCF.app.setSpec(s), Object.assign({}, TU, { ma: 'E5', rong: 1300 }));
    await H.locator('.tab[data-tab="tu"]').click();
    await H.locator('[data-act="redraw"]').click();
    await page.waitForFunction(() => /Đã cập nhật|Chưa cập nhật/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 60000 });
    m = await xem('E5'); kqm = await H.locator('.report').innerText(); let e1 = await E5();
    ok(e0.rong === 1200 && e1.rong === 1300 && /Đã cập nhật tủ tại chỗ/.test(kqm), 'tủ E5 đã vẽ lại rộng 1200 → 1300', [e0, e1]);
    eq(Object.keys(m).sort(), ['388EV/MDF/MDF/388EV', 'AC-555/Acrylic/Acrylic/AC-555', '默认///'], 'tủ vẽ lại mang đúng màu của tủ cũ (không phải màu của các ô đang chọn)');
    ok(m['AC-555/Acrylic/Acrylic/AC-555'] === 'Chân trước, Cánh trái, Phào phải, Phào trái, Phào trên' && m['默认///'] === 'Hậu', 'cánh + phào giữ AC-555; hậu của tủ cũ chưa đổ màu thì tủ mới cũng để nguyên (không tự lấy màu thùng)', m);
    ok(/Đã giữ màu của tủ cũ/.test(kqm) && /thùng \d+ tấm → 388EV/.test(kqm) && /cánh \+ phào 5 tấm → AC-555/.test(kqm) && !/hậu \d+ tấm →/.test(kqm), 'thẻ Kết quả ghi đã giữ màu nào', kqm);
    eq(dem('/CAD-materialDetail'), taiTruoc, 'màu đã có sẵn trong bản vẽ: không tải lại từ kho');
    // đổ riêng hậu 201MD + một đợt lẻ 103T rồi cập nhật lần nữa: hậu giữ màu riêng; nhóm thùng lẫn màu thì lấy màu nhiều tấm nhất và có lời nhắc
    r = await page.evaluate(async () => { const D = window.MNCFDriver, K = await D.khoVatLieu(), m = t => K.ds.find(x => x.ten === t), e5 = D.all().filter(D.isBoard).filter(b => /^E5/.test(b.BoardProcessOption.cabinetName));
      const a = await D.doMau(e5.filter(b => b.Name === 'Hậu'), m('201MD')), c = await D.doMau([e5.find(b => b.Name === 'Đợt')], m('103T')); return [a.ok, c.ok, D.mauCuaTu(D.tamCuaTu([e5[0]]))]; });
    eq(r, [true, true, { mau: { thung: '388EV', mat: 'AC-555', hau: '201MD' }, lan: ['thung'], co: true }], 'mauCuaTu: nhóm có tấm đổ màu riêng → lấy màu nhiều tấm nhất, ghi nhóm đó là lẫn màu');
    taiTruoc = dem('/CAD-materialDetail');
    await page.evaluate(s => window.MNCF.app.setSpec(s), Object.assign({}, TU, { ma: 'E5', rong: 1400 }));
    await H.locator('.tab[data-tab="tu"]').click();
    await H.locator('[data-act="redraw"]').click();
    await page.waitForFunction(() => /Đã cập nhật|Chưa cập nhật/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 60000 });
    m = await xem('E5'); kqm = await H.locator('.report').innerText(); e1 = await E5();
    ok(e1.rong === 1400 && m['201MD/MDF/MDF/201MD'] === 'Hậu' && /Đợt/.test(m['388EV/MDF/MDF/388EV']) && Object.keys(m).length === 3 && /hậu 2 tấm → 201MD/.test(kqm) && dem('/CAD-materialDetail') === taiTruoc, 'hậu đổ màu riêng (201MD) được giữ khi cập nhật; đợt lẻ 103T về màu chung của thùng', [e1, m, kqm.slice(0, 300)]);
    ok(/Thùng của tủ cũ có nhiều màu/.test(kqm), 'nhóm lẫn màu: thẻ Kết quả nhắc đổ lại tấm đổ riêng', kqm.slice(0, 400));
    await H.locator('footer [data-act="undo"]').click();
    await page.waitForFunction(() => /Đã hoàn tác lần vẽ/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 15000 });
    m = await xem('E5'); e1 = await E5();
    ok(e1.rong === 1300 && m['201MD/MDF/MDF/201MD'] === 'Hậu' && /Hồi trái/.test(m['388EV/MDF/MDF/388EV']) && m['103T/MDF/MDF/103T'] === 'Đợt' && Object.keys(m).length === 4, 'hoàn tác lần cập nhật (lùi cả bước đổ lại màu): tủ 1300 trở lại nguyên màu cũ, kể cả đợt đổ riêng', [e1, m]);

    console.log('— Cập nhật tủ CHƯA đổ màu khi đang bật tự đổ màu: tủ vẽ lại nhận màu của các ô');
    await page.evaluate(s => window.MNCF.app.setSpec(s), Object.assign({}, TU, { ma: 'G7' }));
    await H.locator('.tab[data-tab="tu"]').click();
    await H.locator('#mncf-ui-ax').fill('20000');
    await H.locator('[data-act="draw"]').click();
    await H.locator('.report .msg.ok').waitFor({ timeout: 30000 });
    eq(Object.keys(await xem('G7')), ['默认///'], 'tủ G7 vẽ lúc đang tắt tự đổ màu: chưa có màu');
    await theSau(H, 'mausac');
    await H.locator('[data-ui="vl-tudong"]').check();
    await page.evaluate(s => window.MNCF.app.setSpec(s), Object.assign({}, TU, { ma: 'G7', rong: 1300 }));
    await H.locator('.tab[data-tab="tu"]').click();
    await H.locator('[data-act="redraw"]').click();
    await page.waitForFunction(() => /Đã cập nhật|Chưa cập nhật/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 60000 });
    kqm = await H.locator('.report').innerText();
    ok(/Đã cập nhật tủ tại chỗ/.test(kqm) && /Đã tự đổ màu: thùng \d+ tấm → 103T/.test(kqm) && !/Đã giữ màu/.test(kqm), 'tủ cũ không có màu để giữ → tủ vẽ lại tự đổ theo các ô', kqm.slice(0, 300));
    eq(Object.keys(await xem('G7')).sort(), ['103T/MDF/MDF/103T', 'LUX279PRL/Acrylic/Acrylic/LUX279PRL'], 'tủ G7 sau cập nhật mang màu của ô Thùng + ô Cánh');
    // tủ ĐÃ có màu (thùng đổi tay sang 388EV) mà ô tự đổ màu vẫn bật: cập nhật phải giữ màu của tủ, không đổ đè theo các ô
    await page.evaluate(async () => { const D = window.MNCFDriver, K = await D.khoVatLieu(), g7 = D.all().filter(D.isBoard).filter(b => /^G7/.test(b.BoardProcessOption.cabinetName)), tu = D.tamCuaTu([g7[0]]), pn = D.phanNhomMau(tu); await D.doMau(tu.filter((b, i) => pn.nhom[i] === 'thung'), K.ds.find(x => x.ten === '388EV')); });
    await page.evaluate(s => window.MNCF.app.setSpec(s), Object.assign({}, TU, { ma: 'G7', rong: 1400 }));
    await H.locator('.tab[data-tab="tu"]').click();
    await H.locator('[data-act="redraw"]').click();
    await page.waitForFunction(() => /Đã cập nhật|Chưa cập nhật/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 60000 });
    kqm = await H.locator('.report').innerText(); m = await xem('G7');
    ok(/Đã giữ màu của tủ cũ: thùng \d+ tấm → 388EV/.test(kqm) && !/Đã tự đổ màu/.test(kqm) && /Hồi trái/.test(m['388EV/MDF/MDF/388EV'] || '') && m['103T/MDF/MDF/103T'] === 'Hậu', 'tủ đã có màu: cập nhật giữ màu của tủ (thùng 388EV, hậu 103T), không đổ đè theo ô dù đang bật tự đổ màu', [kqm.slice(0, 200), m]);

    console.log('— Mẫu kho vẽ vào khung cũng tự đổ màu theo các ô');
    await theSau(H, 'mausac');
    await H.locator('[data-ui="vl-tudong"]').check();
    const truocKho = await page.evaluate(() => { window.__MOCK_KHO__ = { 9001: {} }; window.MNCF.phong.dat({ ten: 'P', cao: 2700, tuong: [{ dai: 3600 }, { dai: 3000 }, { dai: 3600 }, { dai: 'auto' }], khung: [{ ten: 'TV', tuong: 0, cach: 0, rong: 1200, cao: 1000, sau: 350, z: 0, kieu: 'kho', kho: { id: 9001, ten: 'Tủ tivi 1' } }], goc: [30000, 0, 0] }); return window.MNCFDriver.all().length; });
    await H.locator('.tab[data-tab="phong"]').click();
    await H.locator('.pcard[data-kj="0"] [data-act="k-ve-kho"]').click();
    await page.waitForFunction(() => /Đã vẽ mẫu kho|Chưa vẽ được mẫu kho|Đã dựng mẫu kho nhưng/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.report').textContent), null, { timeout: 30000 });
    eq(await xem('TV'), { '103T/MDF/MDF/103T': 'Hậu, Hồi phải, Hồi trái, Nóc, Xà chân sau, Đáy', 'LUX279PRL/Acrylic/Acrylic/LUX279PRL': 'Xà chân' }, 'mẫu kho: thùng + hậu theo màu ô Thùng, xà chân trước theo màu ô Cánh + phào');
    kqm = await H.locator('.report').innerText();
    ok(/Đã tự đổ màu/.test(kqm) && /thùng 5 tấm → 103T/.test(kqm) && /cánh \+ phào 1 tấm → LUX279PRL/.test(kqm) && /hậu 1 tấm → 103T/.test(kqm), 'thẻ Kết quả của mẫu kho ghi đã tự đổ màu', kqm.slice(0, 300));
    await H.locator('footer [data-act="undo"]').click();
    await page.waitForFunction(() => /Đã hoàn tác lần vẽ/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 15000 });
    eq(await page.evaluate(() => window.MNCFDriver.all().length), truocKho, 'hoàn tác lần vẽ mẫu kho: lùi cả bước đổ màu, bản vẽ trở lại như trước');

    console.log('— Kho nhiều màu: các trang sau trang đầu được hỏi cùng lúc (máy chủ Chenfeng có lúc trả lời chậm vài giây mỗi trang)');
    const mdfCu = KHO[71];
    KHO[71] = Array.from({ length: 350 }, (x, i) => vl(8000 + i, '71', `T${1000 + i}`));
    cham.ms = 250; cham.max = 0; const lanTruoc = dem('/CAD-materialList');
    r = await page.evaluate(async () => { const k = await window.MNCFDriver.khoVatLieu({ lam_moi: true }), mdf = k.ds.filter(m => m.nhom === 'MDF'); return { so: k.ds.length, dau: mdf[0].ten, t100: mdf[100].ten, t200: mdf[200].ten, cuoi: mdf[349].ten, sau: k.ds[350].ten, trung: mdf.length - new Set(mdf.map(m => m.id)).size }; });
    eq(r, { so: 353, dau: 'T1000', t100: 'T1100', t200: 'T1200', cuoi: 'T1349', sau: 'LUX279PRL', trung: 0 }, 'thư mục 350 màu (4 trang): đủ màu, đúng thứ tự kho, không trùng');
    ok(dem('/CAD-materialList') - lanTruoc === 5 && cham.max >= 3, 'chỉ hỏi 4 + 1 trang; trang 2–4 của MDF được hỏi cùng lúc (không nối đuôi nhau)', [dem('/CAD-materialList') - lanTruoc, cham.max]);
    cham.khongTong = true; cham.max = 0; const lanTruoc2 = dem('/CAD-materialList');
    r = await page.evaluate(async () => { const k = await window.MNCFDriver.khoVatLieu({ lam_moi: true }); return [k.ds.length, k.ds[349].ten]; });
    ok(r[0] === 353 && r[1] === 'T1349' && dem('/CAD-materialList') - lanTruoc2 === 5 && cham.max <= 2, 'máy chủ không báo tổng số: hỏi lần lượt tới trang thiếu, vẫn đủ 353 màu đúng thứ tự', [r, dem('/CAD-materialList') - lanTruoc2, cham.max]);
    cham.khongTong = false; cham.ms = 0; KHO[71] = mdfCu;
    eq(await page.evaluate(async () => (await window.MNCFDriver.khoVatLieu({ lam_moi: true })).ds.length), 133, 'đọc lại kho cũ: 133 màu');

    console.log('— Tải lại trang: các ô màu, màu vừa dùng, lựa chọn tự đổ màu được nhớ');
    const moLai = async () => { await page.reload(); await page.waitForFunction(() => window.MNCF && window.MNCF.app && window.MNCFDriver, null, { timeout: 15000 }); await H.locator('.launch').click(); await theSau(H, 'mausac'); await H.locator('.vlds .vlc').first().waitFor({ timeout: 10000 }); };
    const trangThai = async () => ({ o: (await H.locator('.vlos .vlo').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').replace(' ✕', '').trim()), bat: await H.locator('.vlo.on').getAttribute('data-v'), tudong: await H.locator('[data-ui="vl-tudong"]').isChecked(), gan: (await H.locator('.vlgan .vlg').allInnerTexts()).map(t => t.trim()), anh: await H.locator('.vlo[data-v="thung"] img').count() ? await H.locator('.vlo[data-v="thung"] img').evaluate(i => i.getAttribute('src')) : '' });
    await moLai();
    eq(await trangThai(), { o: ['Thùng 103T', 'Cánh + phào LUX279PRL', 'Hậu như thùng'], bat: 'thung', tudong: true, gan: ['388EV', 'LUX279PRL', '103T'], anh: 'https://api.cfcad.cn/CAD/images/aa/thumbs/7000_100.jpg' }, 'mở lại trang: 3 ô, ô đang bật, ô tự đổ màu, dãy "Vừa dùng" như trước');
    // dữ liệu nhớ bị hỏng / lạ: không sập, không dùng địa chỉ ảnh lạ
    await page.evaluate(() => window.localStorage.setItem('mncf.mau.v1', JSON.stringify({ o: { thung: { id: 7000, ten: '103T', hinh: 'javascript:alert(1)' }, mat: 'sai', hau: { id: '1' } }, bat: 'la', gan: 'sai', tu_dong: 0 })));
    await moLai();
    eq(await trangThai(), { o: ['Thùng 103T', 'Cánh + phào chưa chọn', 'Hậu như thùng'], bat: 'thung', tudong: false, gan: [], anh: '' }, 'dữ liệu nhớ sai kiểu: lấy phần đọc được (ô Thùng 103T), bỏ địa chỉ ảnh lạ, phần còn lại về mặc định');
    await page.evaluate(() => window.localStorage.setItem('mncf.mau.v1', '{hỏng'));
    await moLai();
    eq((await trangThai()).o, ['Thùng chưa chọn', 'Cánh + phào chưa chọn', 'Hậu như thùng'], 'dữ liệu nhớ không đọc được: bắt đầu trống, bảng vẫn chạy');

    ok(errs.length === 0, 'không lỗi JS lọt ra trang', errs);
  } catch (e) { fail++; console.log('  ✗ ném lỗi:', e && e.stack || e); }
  await ctx.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* bỏ qua */ }
  console.log(`\nmau-ui.test: ${pass} đạt, ${fail} hỏng`);
  process.exit(fail ? 1 : 0);
})();
