'use strict';
// Bản 1.26 — NGĂN KÉO BẰNG LỆNH GỐC `DRAWER` của Chenfeng (anh Jason 05/10/2026 07:00: "phần ngăn kéo vẽ bằng công cụ của chenfeng như vẽ thùng hậu, cánh").
//   NODE_PATH=<node_modules có playwright> PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node test/nk.test.js
// Chạy tiện ích thật (dist/extension) trên trang giả lập Chenfeng. Trang giả lập không có các lệnh vẽ thùng gốc (hồi, vách, nóc đáy…) nên phần TẤM của tủ được nhập qua cổng 晨丰导入,
// rồi gọi thẳng MNCFDriver.veNK với kế hoạch của lõi (Core.keHoachGoc) — đúng đoạn mà D.veGoc chạy sau khi tấm rời đã có trên bản vẽ. Lệnh DRAWER của trang giả lập dựng theo các điều đã đo trên Chenfeng thật.
const path = require('path'), fs = require('fs'), os = require('os'), zlib = require('zlib');
const { chromium } = require('playwright');
const EXT = path.join(__dirname, '..', 'dist', 'extension');
const MOCK = fs.readFileSync(path.join(__dirname, 'mock-chenfeng.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) pass++; else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); } };
const eq = (a, b, name) => ok(JSON.stringify(a) === JSON.stringify(b), name, { co: a, can: b });

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mncf-nk-'));
  const ctx = await chromium.launchPersistentContext(dir, { channel: 'chromium', headless: true, viewport: { width: 1500, height: 900 }, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  try {
    // KHO MẪU GIẢ của tài khoản (mã giả): thư mục 抽屉 có mẫu "三节轨薄底抽" (cùng TÊN với mẫu mặc định của bảng, mã khác), một mẫu tham số lạ; thư mục con (tên không nhắc gì tới ngăn kéo) có một mẫu nữa
    const props = a => zlib.deflateSync(Buffer.from(JSON.stringify(a))).toString('base64');
    const hang = a => a.map(([n, v, d, e]) => [3, n, e || '', v, null, d || null, 1, null, null]);
    // (đo trên Chenfeng thật: mẫu ray bi / ray âm ghi BH = $BH — dày ván theo thùng; mẫu hộp ray Blum ghi BH = 18 cố định)
    const chung = [['L', 426, '宽'], ['W', 350, '深'], ['H', 200, '高'], ['BH', 18, '板厚', '$BH']];
    const api = [], cau = { hong: '' };      // cau.hong: 'thu_muc' | 'danh_sach' → máy chủ báo lỗi ở lời gọi đó
    await ctx.route('https://api.cfcad.cn/**', r => {
      const u = new URL(r.request().url()), body = JSON.parse(r.request().postData() || '{}'); api.push([u.pathname, body.dir_id || body.dir_type || '']);
      let j = { err_code: 1, err_msg: 'no' };
      if (u.pathname === '/CAD-dirQuery' && cau.hong !== 'thu_muc') j = { err_code: 0, err_msg: '', dirs: [{ dir_id: '11', dir_name: '门', childs: [] }, { dir_id: '12', dir_name: '抽屉', childs: [{ dir_id: '13', dir_name: '其他', childs: [] }] }] };
      else if (u.pathname === '/CAD-moduleList' && cau.hong !== 'danh_sach' && body.dir_id === '12') j = { err_code: 0, err_msg: '', count: '4', modules: [
        { module_id: '555001', name: '三节轨薄底抽', logo: 'thu/555001.png', diy_logo: '', props: props(hang(chung.concat([['GD', 13, '轨道'], ['LC', 0], ['SLK', 30], ['XLK', 30]]))) },
        { module_id: '555077', name: 'Mẫu tham số lạ', logo: '', diy_logo: '', props: props([[2, 'L', '', 426, null, null, 1]]) },
        { module_id: '555010', name: 'Tên trong kho', logo: '', diy_logo: '', props: props(hang(chung.concat([['GD', 13], ['SLK', 30], ['XLK', 30]]))) },
        { module_id: '555078', name: 'Mẫu hỏng tham số', logo: '', diy_logo: '', props: 'khong-phai-du-lieu-nen' },
        { module_id: '555016', name: '百隆骑马抽中帮16MM', logo: '', diy_logo: '', props: props(hang([['L', 426], ['W', 350], ['H', 195], ['BH', 18], ['LC', 0], ['XLK', 30]])) }] };
      else if (u.pathname === '/CAD-moduleList' && cau.hong !== 'danh_sach' && body.dir_id === '13') j = { err_code: 0, err_msg: '', count: '1', modules: [
        { module_id: '555002', name: '托底轨厚底抽', logo: 'thu/555002.png', diy_logo: '', props: props(hang(chung.concat([['GDK', 24.5], ['LC', 0], ['SLK', 30], ['XLK', 30]]))) }] };
      return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': 'https://cfcad.cn', 'access-control-allow-credentials': 'true' }, body: JSON.stringify(j) });
    });
    await require('./kho-gia.js')(ctx);      // bộ nạp của tiện ích lấy bản gộp vừa dựng trong máy
    await ctx.route('https://cfcad.cn/**', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: MOCK }));
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    await page.goto('https://cfcad.cn/');
    await page.waitForFunction(() => window.MNCF && window.MNCF.app && window.MNCFDriver && window.MNCFCore, null, { timeout: 15000 });
    // (bản 1.31) chuẩn xưởng mới: nóc, đáy phủ hồi + khung mặt hộc kéo — lệnh gốc chỉ vẽ kết cấu cũ (hồi phủ nóc đáy) và số đo của bộ này là hộc kéo khe + xà ẩn → ghim cả hai
    await page.evaluate(() => { window.MNCFCore.DEFAULT_SPEC.thung.noc_day = 'lot'; window.MNCFCore.DEFAULT_SPEC.ngan_keo.khung_mat = 0; });
    await page.evaluate(() => {
      const C = window.MNCFCore, D = window.MNCFDriver, E = () => window.app.Database.ModelSpace.Entitys;
      window.__thu = {
        // lựa chọn đang nằm trong hộp "Drawer Design" (của người dùng). Không kể `depth`: mỗi lần mở hộp Chenfeng tự tính lại theo khoảng trống (isAuto)
        lc() { const st = window.__MOCK__.nkSt, bo = o => { const c = Object.assign({}, o); delete c.depth; return c; }; return JSON.stringify([bo(st.m_Option), bo(st.m_UiOption)]); },
        // tủ một khoang có ô ngăn kéo; mau = mã mẫu ghi ở Chuẩn xưởng cho loại mặc định (0 = giữ mã mặc định của bảng), ts = tham số riêng của loại
        spec(o) {
          o = o || {};
          const nk = JSON.parse(JSON.stringify(C.DEFAULT_SPEC.ngan_keo));
          if (o.mau) nk.loai[0].mau_id = o.mau; if (o.ten_mau) nk.loai[0].ten_mau = o.ten_mau; if (o.ts) nk.loai[0].ts = o.ts; if (o.khung !== undefined) nk.khung_mat = o.khung;
          return { ma: o.ma || 'NK', rong: 1000, cao: 2200, ngan_keo: nk, khoang: o.khoang || [{ rong: 'auto', canh: o.canh === undefined ? 2 : o.canh, dot: [520], o: [{ tu: 0, kieu: o.kieu || 'nk_am', so: o.so || 2 }] }] };
        },
        // nhập phần TẤM của tủ ở x0 rồi ghép tấm thiết kế ↔ tấm thật (việc D.veGoc làm trước khi tới bước ngăn kéo)
        async chuanBi(spec, x0) {
          const K = C.keHoachGoc(spec), M = K.M, cf = C.toChenfeng(M, { id: 'THU' + x0, khong_mau: true });
          const res = await D.importCF(cf.json, [x0 + cf.base[0], cf.base[1], cf.base[2]], { co_mau: false });
          const tamCua = new Map(), dung = new Set();
          for (const p of M.parts) { const want = [p.x0 + x0, p.x1 + x0, p.y0, p.y1, p.z0, p.z1], hit = res.added.find(e => D.isBoard(e) && !dung.has(e) && D.boxOf(e).every((v, i) => Math.abs(v - want[i]) < 0.1)); if (hit) { dung.add(hit); tamCua.set(p, hit); } }
          Object.assign(this, { K, offset: [x0, 0, 0], tamCua, truoc: new Set(E()) });
          return { loi: K.loi, nk: K.nk.length, tam: tamCua.size, tong: M.parts.length };
        },
        async ve(opt) {
          const K = this.K, M = K.M, x0 = this.offset[0], h0 = window.app.Database.hm.curIndex, n0 = (window.__MOCK_NK__ || []).length, t0 = (window.__MOCK_MAU_TAI__ || []).length;
          const kq = await D.veNK(K, this.offset, this.tamCua, opt || {});
          return Object.assign(this.xem(), { so: kq.so, xong: [...kq.xong].sort((a, b) => a - b), hong: kq.hong.map(h => [h.khoang, h.ly_do]), bao: kq.hong.map(h => h.bao || ''), doi_ma: kq.doi_ma, ban: !!kq.ban, added: kq.added.length,
            buoc: window.app.Database.hm.curIndex - h0, nk: (window.__MOCK_NK__ || []).slice(n0), tai: (window.__MOCK_MAU_TAI__ || []).slice(t0) });
        },
        // ngăn kéo (lệnh gốc) + phần mẫu còn lại (suốt treo, ngăn kéo không vẽ được bằng lệnh gốc) — đúng hàm D.veGoc gọi sau khi tấm rời đã có
        async veMau(opt) {
          const n0 = (window.__MOCK_NK__ || []).length, i0 = (window.__MOCK_NHAP__ || []).length, h0 = window.app.Database.hm.curIndex, c0 = window.__MOCK_TU_CHOI__ || 0;
          const tm = await D.themMauNK(this.K, this.offset, this.tamCua, opt || {});
          return Object.assign(this.xem(), { thieu: tm.thieu.map(x => [x.loai, x.khoang, x.ly_do, !!x.treo]), ban: !!tm.ban, doi_ma: tm.doi_ma.map(d => [d.tu > 0, d.sang]), added: tm.added.filter(e => e && !e.IsErase).length,
            nk_goc: [tm.nk.tong, tm.nk.so, [...tm.nk.xong].sort((a, b) => a - b), tm.nk.lui.map(h => [h.khoang, h.ly_do])], bao: tm.nk.bao, buoc: window.app.Database.hm.curIndex - h0,
            lenh_nk: (window.__MOCK_NK__ || []).slice(n0).map(x => x.ket), nhap: (window.__MOCK_NHAP__ || []).slice(i0).map(x => [x.tam, x.mau.length, x.ket]), tu_choi: (window.__MOCK_TU_CHOI__ || 0) - c0 });
        },
        // "Cập nhật tủ này" bỏ tủ cũ bằng danh sách này: phải gồm cả ngăn kéo vẽ bằng lệnh gốc (không thì vẽ lại sẽ thành hai lớp ngăn kéo)
        cuaTu() {
          const M = this.K.M, id = 'THU' + this.offset[0], loc = D.locate(id, M);
          if (!loc.ok) return { loi: loc.reason };
          const ds = D.cabinetEntities(id, M, loc), moi = E().filter(e => e && !e.IsErase && !this.truoc.has(e) && (D.isBoard(e) || D.isHardware(e)));
          return { tam: ds.filter(D.isBoard).length, tong_tam: M.parts.length, sot: moi.filter(e => ds.indexOf(e) < 0).map(e => e.Name || e.HardwareOption.name) };
        },
        // bản vẽ lúc này: đối tượng mới của tủ, mặt ngăn kéo thiết kế nào đã có tấm đúng chỗ, sâu / chỗ đặt của hộp
        xem() {
          const M = this.K.M, x0 = this.offset[0], moi = E().filter(e => e && !e.IsErase && !this.truoc.has(e)), r2 = v => Math.round(v * 100) / 100;
          const mat = M.mat_ngan_keo.map(q => { const want = [q.x + x0, q.x + q.w + x0, q.y, q.y + q.t, q.z, q.z + q.h]; return moi.some(e => D.isBoard(e) && e.Name === '抽面板' && D.boxOf(e).every((v, i) => Math.abs(v - want[i]) < 0.06)); });
          const thanh = moi.filter(e => D.isBoard(e) && e.Name === '抽侧板').map(e => D.boxOf(e));
          return { moi: moi.length, tam: moi.filter(D.isBoard).length, pk: moi.filter(D.isHardware).length, mat, sau: [...new Set(thanh.map(b => r2(b[3] - b[2])))], thanh_x: [...new Set(thanh.map(b => r2(b[0] - x0)))].sort((a, b) => a - b),
            thanh_z: [...new Set(thanh.map(b => r2(b[4]) + '…' + r2(b[5])))].sort(), tu: [...new Set(moi.filter(D.isBoard).map(e => e.BoardProcessOption.cabinetName))],
            lc: window.__thu.lc(), bao_loi: window.__MOCK_BAO_LOI__ || 0, busy: D.busy(), hop: !!document.querySelector('.mock-nk') };
        } };
    });
    const T = { chuanBi: (o, x0) => page.evaluate(([o, x0]) => window.__thu.chuanBi(window.__thu.spec(o), x0), [o, x0]), ve: opt => page.evaluate(opt => window.__thu.ve(opt), opt || {}), xem: () => page.evaluate(() => window.__thu.xem()),
      veMau: opt => page.evaluate(opt => window.__thu.veMau(opt), opt || {}), cuaTu: () => page.evaluate(() => window.__thu.cuaTu()) };
    const LC0 = await page.evaluate(() => window.__thu.lc());
    // số mặc định của từng mẫu trong kho giả ở trên — lệnh DRAWER của trang giả lập dùng số này cho tham số nào ô để biểu thức rỗng (đúng như Chenfeng thật: nó áp biểu thức, không áp giá trị)
    await page.evaluate(() => { window.__MOCK_MAU_MAC_DINH__ = { 555001: { GD: 13, LC: 0, SLK: 30, XLK: 30 }, 555010: { GD: 13, SLK: 30, XLK: 30 }, 555002: { GDK: 24.5, LC: 0, SLK: 30, XLK: 30 }, 555016: { BH: 18, LC: 0, XLK: 30 } }; });

    console.log('— Ngăn kéo âm giữa hai vách đệm: lệnh DRAWER ra đúng mặt + hộp của thiết kế');
    let c = await T.chuanBi({ mau: 555001 }, 0);
    eq([c.loi, c.nk, c.tam === c.tong], [[], 1, true], 'kế hoạch có 1 bước ngăn kéo; phần tấm của tủ đã có đủ trên bản vẽ');
    let r = await T.ve();
    eq([r.so, r.xong, r.hong, r.ban], [1, [0, 1], [], false], 'vẽ xong 1 ô (2 mẫu ngăn kéo của thiết kế) bằng lệnh gốc, không ô nào hỏng');
    eq([r.mat, r.tam, r.pk, r.added], [[true, true], 12, 2, 14], 'hai mặt ngăn kéo nằm đúng hộp thiết kế; mỗi ngăn 6 tấm + 1 ray; danh sách đối tượng mới đủ 14');
    eq([r.sau, r.thanh_x, r.thanh_z], [[500], [130.5, 852], ['149.5…267.5', '349.5…467.5']], 'hộp sâu 500, thành cách vách đệm 13, hộp thấp hơn mép mặt 30 trên / 30 dưới');
    eq([r.buoc, r.tai], [1, [555001]], 'một bước lịch sử; Chenfeng gọi máy chủ đúng MỘT lần cho cả lệnh');
    eq(r.nk.map(x => [x.ket, x.mau, x.lc.row, x.lc.col, x.lc.doorPosType, x.lc.offset, x.lc.leftExt, x.lc.leftSpace, x.lc.rightSpace, x.lc.topSpace, x.lc.bottomSpace, x.lc.midSpace, x.lc.isAuto, x.lc.isFloor50]),
      [['ok', ['555001', '555001'], 2, 1, 1, '0', '0', '2', '2', '22.5', '2', '22', true, true]], 'hộp "Drawer Design" nhận: 2 ô, lọt lòng, offset 0 (bản 1.28: vách đệm lùi sau nẹp — lưng mặt ngang mép vách đệm), khe 2 / 2 / 22,5 / 2 / 22, tự tính sâu bậc 50; cả hai ô có mẫu');
    eq([r.lc === LC0, r.bao_loi, r.busy, r.hop], [true, 0, false, false], 'lựa chọn của người dùng trong hộp được trả lại nguyên; không lỗi nào tới Chenfeng; lệnh đã xong, hộp đã đóng');
    eq(r.tu, ['NK'], 'tấm ngăn kéo mang tên tủ của tấm chung quanh');
    eq(r.nk.map(x => x.bh), [['$BH', '$BH']], 'mẫu ghi dày ván theo thùng (BH = $BH): bảng giữ nguyên công thức đó');
    eq(api, [['/CAD-dirQuery', '5'], ['/CAD-moduleList', '12']], 'chỉ ĐỌC kho mẫu: danh sách thư mục + danh sách mẫu của thư mục ngăn kéo');

    console.log('— (bản 1.31) Khung mặt hộc kéo (thanh ngang phẳng mặt): lệnh DRAWER nhận khe theo mặt thật');
    c = await T.chuanBi({ mau: 555001, ma: 'NKM', khung: 1 }, 58000);
    eq([c.loi, c.nk, c.tam === c.tong], [[], 1, true], 'khung mặt: kế hoạch có 1 bước ngăn kéo; tấm của tủ (cả thanh ngang khung mặt) đã có đủ');
    r = await T.ve();
    eq([r.so, r.xong, r.hong, r.ban, r.mat], [1, [0, 1], [], false, [true, true]], 'khung mặt: vẽ xong 1 ô bằng lệnh gốc, hai mặt ngăn kéo đúng hộp thiết kế');
    eq(r.nk.map(x => [x.ket, x.lc.topSpace, x.lc.midSpace, x.lc.bottomSpace, x.lc.leftSpace, x.lc.rightSpace]), [['ok', '52.5', '54', '2', '2', '2']], 'hộp "Drawer Design" nhận khe trên 52,5 (thanh 50 + khe 2 + dư làm tròn 0,5), khe giữa 54 (thanh 50 + 2 × 2), dưới / hai bên 2');
    console.log('— Kho mẫu chỉ đọc một lần trong phiên');
    c = await T.chuanBi({ mau: 555001, ma: 'NK2' }, 3000);
    r = await T.ve();
    eq([r.so, r.mat, api.length], [1, [true, true], 2], 'tủ thứ hai cùng mẫu: vẽ được, không hỏi lại kho mẫu');

    console.log('— Trùm ngoài');
    c = await T.chuanBi({ mau: 555001, kieu: 'nk_trum', ma: 'NT' }, 6000);
    r = await T.ve();
    eq([r.so, r.hong, r.mat, r.sau, r.buoc], [1, [], [true, true], [550], 1], 'ngăn kéo trùm ngoài: hai mặt đúng hộp thiết kế (nằm trước mép thùng), hộp sâu 550');
    eq(r.nk.map(x => [x.lc.doorPosType, x.lc.leftExt, x.lc.rightExt, x.lc.topExt, x.lc.bottomExt, x.lc.leftSpace, x.lc.topSpace, x.lc.midSpace]), [[0, '15.5', '15.5', '8', '15.5', '0', '0', '2']], 'hộp nhận: trùm ngoài, trùm ra 15,5 / 15,5 / 8 / 15,5, không khe hở, khe giữa 2');
    eq(r.lc === LC0, true, 'lựa chọn của người dùng vẫn được trả lại');

    console.log('— Mặt ngăn kéo không bằng nhau (trùm ngoài 3 ngăn: 141 / 140,5 / 140,5 từ dưới lên) → khoá cao từng ô trong hộp "Drawer Design"');
    c = await T.chuanBi({ mau: 555001, kieu: 'nk_trum', so: 3, ma: 'NK3' }, 7500);
    r = await T.ve();
    eq([r.so, r.xong, r.hong, r.mat, r.buoc, r.added], [1, [0, 1, 2], [], [true, true, true], 1, 21], 'ba mặt cao khác nhau đều nằm đúng hộp thiết kế, vẽ bằng lệnh gốc trong một bước');
    eq(r.nk.map(x => [x.ket, x.lc.row, x.khoa]), [['ok', 3, [140.5, 140.5, 'D']]], 'hộp nhận: 3 ô, hai ô trên khoá cao 140,5 (ô 0 = trên cùng), ô dưới cùng để "D" nhận phần còn lại (141)');
    eq([r.thanh_z, r.lc === LC0, r.bao_loi, r.hop], [['132…213', '275…355.5', '417.5…498'], true, 0, false], 'hộp của từng ngăn theo đúng mặt của nó; lựa chọn của người dùng được trả lại; không lỗi nào tới Chenfeng');
    c = await T.chuanBi({ mau: 555001, kieu: 'nk_trum', so: 3, ma: 'NK3B' }, 4500);
    await page.evaluate(() => { window.__MOCK_NK_KHONG_KHOA__ = true; });      // giả định xấu: bản Chenfeng khác không nhận cách khoá cao đã đo
    r = await T.ve();
    eq([r.so, r.hong, r.moi, r.nk.length, r.hop, r.busy, r.lc === LC0, r.bao_loi], [0, [[0, 'hop']], 0, 0, false, false, true, 0], 'hộp không chia ô theo số đã khoá: KHÔNG bấm OK, đóng hộp, trả lại lựa chọn của người dùng');
    ok(/chia ô/.test(r.bao[0]), '… lời báo nêu ô nào chia khác thiết kế', r.bao);
    await page.evaluate(() => { delete window.__MOCK_NK_KHONG_KHOA__; });
    c = await T.chuanBi({ mau: 555001, kieu: 'nk_trum', ma: 'NK3C' }, 10500);
    r = await T.ve();
    eq([r.so, r.mat, r.nk.map(x => x.khoa)], [1, [true, true], [['D', 'D']]], 'lần vẽ sau (hai mặt bằng nhau): không ô nào còn bị khoá cao');

    console.log('— Mã mẫu ở Chuẩn xưởng không có trong kho tài khoản → dùng mẫu CÙNG TÊN của tài khoản');
    c = await T.chuanBi({ ma: 'NT2' }, 9000);      // mã mặc định của bảng (không có trong kho giả), tên 三节轨薄底抽
    r = await T.ve();
    eq([r.so, r.mat, r.nk.map(x => x.mau), r.doi_ma.map(d => [d.sang, d.ten])], [1, [true, true], [['555001', '555001']], [[555001, '三节轨薄底抽']]], 'vẽ bằng mẫu cùng tên của tài khoản; kết quả ghi lại việc đổi mã');
    ok(r.doi_ma[0].tu > 0 && r.doi_ma[0].tu !== 555001, '… kèm mã cũ ở Chuẩn xưởng', r.doi_ma);

    console.log('— Tham số riêng của loại ngăn kéo (Chuẩn xưởng) ghi đè tham số mặc định của mẫu');
    c = await T.chuanBi({ mau: 555001, ma: 'NS', ts: { GD: 21, LC: 0, SLK: 20, XLK: 10 } }, 12000);
    r = await T.ve();
    eq([r.so, r.mat, r.thanh_x, r.thanh_z], [1, [true, true], [138.5, 844], ['129.5…277.5', '329.5…477.5']], 'thành cách vách đệm 21 (GD), hộp thấp hơn mép mặt 20 trên (SLK) / 10 dưới (XLK)');

    console.log('— Mẫu ở thư mục con của thư mục ngăn kéo');
    c = await T.chuanBi({ mau: 555002, ten_mau: '托底轨厚底抽', ma: 'NC' }, 15000);
    r = await T.ve();
    eq([r.so, r.mat, r.nk.map(x => x.mau), r.doi_ma], [1, [true, true], [['555002', '555002']], []], 'mẫu nằm ở thư mục con: vẫn tìm thấy theo mã (không coi là đổi mã)');
    eq([r.sau, r.hong], [[490], []], 'ray âm đỡ đáy: thành hộp ngắn hơn sâu hộp 10 (không tấm nào dài 500) vẫn là đúng — sâu hộp đối chiếu theo tham số W của mẫu, không theo chiều dài tấm');

    console.log('— Mẫu có dày mặt cố định (hộp ray Blum: BH = 18, không theo thùng) → bảng ghi dày mặt của thiết kế vào BH của mẫu');
    c = await T.chuanBi({ mau: 555016, ten_mau: '百隆骑马抽中帮16MM', ma: 'NBL', ts: { LC: 0, XLK: 30 } }, 13500);
    r = await T.ve();
    eq([r.so, r.hong, r.mat, r.nk.map(x => x.bh)], [1, [], [true, true], [['17.5', '17.5']]], 'mặt ra dày 17,5 đúng thiết kế (không phải 18 của mẫu): bảng ghi BH thành BIỂU THỨC "17.5" — Chenfeng áp biểu thức của tham số, không áp giá trị');

    c = await T.chuanBi({ mau: 555010, ten_mau: '三节轨薄底抽', ma: 'NV7' }, 16500);      // mã trỏ tới một mẫu, tên lại trùng một mẫu KHÁC trong kho
    r = await T.ve();
    eq([r.so, r.nk.map(x => x.mau), r.doi_ma], [1, [['555010', '555010']], []], 'kho có cả mẫu đúng MÃ lẫn mẫu trùng tên: lấy mẫu đúng mã');

    console.log('— Không vẽ được bằng lệnh gốc → trả lý do, không vẽ gì, không gửi dữ liệu lạ cho Chenfeng');
    c = await T.chuanBi({ mau: 555999, ten_mau: 'Không có mẫu này', ma: 'NX' }, 18000);
    r = await T.ve();
    eq([r.so, r.xong, r.hong, r.moi, r.nk.length, r.buoc], [0, [], [[0, 'khong_co']], 0, 0, 0], 'kho tài khoản không có mẫu (cả mã lẫn tên): không gọi lệnh DRAWER');
    c = await T.chuanBi({ mau: 555077, ten_mau: 'Mẫu tham số lạ', ma: 'NL' }, 21000);
    r = await T.ve();
    eq([r.so, r.hong, r.moi, r.nk.length], [0, [[0, 'mau_la']], 0, 0], 'tham số của mẫu không đúng dạng đã biết: không gọi lệnh DRAWER');
    c = await T.chuanBi({ mau: 555078, ten_mau: 'Mẫu hỏng tham số', ma: 'NL2' }, 22500);
    r = await T.ve();
    eq([r.so, r.hong, r.moi, r.nk.length], [0, [[0, 'mau_la']], 0, 0], 'tham số của mẫu không giải nén được: không gọi lệnh DRAWER');
    cau.hong = 'thu_muc';
    c = await T.chuanBi({ mau: 555003, ten_mau: 'Mẫu chưa hỏi lần nào', ma: 'NH' }, 27000);
    r = await T.ve();
    eq([r.so, r.hong, r.moi, r.nk.length], [0, [[0, 'kho']], 0, 0], 'không đọc được kho mẫu (máy chủ báo lỗi): lý do "kho"');
    cau.hong = '';
    r = await T.ve();
    eq(r.hong, [[0, 'khong_co']], '… lần đọc hỏng không bị nhớ: lần sau đọc lại kho');
    cau.hong = 'danh_sach';
    c = await T.chuanBi({ mau: 555001, ten_mau: 'Tên chưa hỏi lần nào', ma: 'NH2' }, 28500);
    r = await T.ve();
    eq([r.so, r.hong, r.nk.length], [0, [[0, 'kho']], 0], 'đọc được thư mục nhưng danh sách mẫu hỏng: lý do "kho" (không kết luận vội là kho không có mẫu)');
    cau.hong = '';
    r = await T.ve();
    eq([r.so, r.hong, r.mat], [1, [], [true, true]], '… máy chủ trả lời lại thì vẽ được');

    console.log('— Máy chủ Chenfeng không trả mẫu lúc dựng');
    c = await T.chuanBi({ mau: 555001, ma: 'NM' }, 30000);
    await page.evaluate(() => { window.__MOCK_MAU_LOI__ = { 555001: { lan: 1, kieu: 'may_chu' } }; });
    r = await T.ve();
    eq([r.so, r.hong, r.moi, r.buoc, r.lc === LC0, r.busy, r.hop], [0, [[0, 'may_chu']], 0, 0, true, false, false], 'máy chủ rớt: không vẽ gì, lịch sử không đổi, lựa chọn của người dùng được trả lại');
    ok(/DRAWER/.test(r.bao[0]), '… kèm lời Chenfeng báo', r.bao);
    await page.evaluate(() => { window.__MOCK_MAU_LOI__ = { 555001: { lan: 1, kieu: 'tk' } }; });
    r = await T.ve();
    eq(r.hong, [[0, 'khong_thuoc_tk']], 'máy chủ báo mẫu không thuộc cửa hàng: lý do "khong_thuoc_tk"');
    r = await T.ve();
    eq([r.so, r.mat], [1, [true, true]], 'lần sau máy chủ trả mẫu: vẽ được');

    console.log('— Chenfeng dựng ngăn kéo khác thiết kế → hoàn tác, báo lệch');
    c = await T.chuanBi({ mau: 555001, ma: 'NLE' }, 33000);
    await page.evaluate(() => { window.__MOCK_NK_LECH__ = 3; });
    r = await T.ve();
    eq([r.so, r.xong, r.hong, r.moi, r.buoc, r.added], [0, [], [[0, 'lech']], 0, 0, 0], 'mặt ngăn kéo lệch 3 mm so với thiết kế: bỏ lệnh vừa rồi (không còn đối tượng nào của nó), không tính là đã vẽ');
    ok(/mặt ngăn kéo/.test(r.bao[0]), '… lời báo nêu mặt nào lệch', r.bao);
    await page.evaluate(() => { delete window.__MOCK_NK_LECH__; window.__MOCK_NK_SAU__ = 450; });
    r = await T.ve();
    eq([r.so, r.hong, r.moi, r.buoc], [0, [[0, 'lech']], 0, 0], 'mặt đúng nhưng hộp sâu 450 thay vì 500 (ray khác cỡ): cũng bỏ lệnh vừa rồi');
    ok(/hộp ngăn kéo cần sâu 500/.test(r.bao[0]) && /450/.test(r.bao[0]), '… lời báo nêu sâu hộp cần và sâu hộp Chenfeng dựng', r.bao);
    await page.evaluate(() => { delete window.__MOCK_NK_SAU__; window.__MOCK_NK_KHONG_W__ = true; });
    r = await T.ve();
    eq([r.so, r.hong, r.moi, r.buoc], [0, [[0, 'lech']], 0, 0], 'nút mẫu ngăn kéo không đọc được sâu hộp (bản Chenfeng khác): không dám nhận là đúng — bỏ lệnh vừa rồi');
    await page.evaluate(() => { delete window.__MOCK_NK_KHONG_W__; });

    console.log('— Hộp "Drawer Design" không mở / không nhận lựa chọn');
    await page.evaluate(() => { window.__MOCK_NK_THUA_O__ = true; });
    r = await T.ve();
    eq([r.so, r.hong, r.moi, r.hop, r.busy, r.lc === LC0, r.nk.length], [0, [[0, 'hop']], 0, false, false, true, 0], 'hộp dựng số ô khác số ngăn cần vẽ: không bấm OK, đóng hộp, trả lại lựa chọn của người dùng');
    await page.evaluate(() => { delete window.__MOCK_NK_THUA_O__; window.__MOCK_NK_KHONG_DONG__ = true; });
    r = await T.ve();
    eq([r.so, r.hong, r.moi, r.hop, r.busy, r.lc === LC0], [0, [[0, 'hop']], 0, false, false, true], 'bấm OK mà hộp không đóng (Chenfeng chê lựa chọn): bảng tự đóng hộp, trả lại lựa chọn của người dùng');
    await page.evaluate(() => { delete window.__MOCK_NK_KHONG_DONG__; });

    await page.evaluate(() => { window.__MOCK_NK_KHONG_MO__ = true; });
    r = await T.ve({ cho_hop: 700 });
    eq([r.so, r.hong, r.moi, r.busy, r.buoc], [0, [[0, 'hop']], 0, false, 0], 'Chenfeng không mở hộp: huỷ lệnh, không vẽ gì');
    await page.evaluate(() => { delete window.__MOCK_NK_KHONG_MO__; });
    await page.evaluate(() => { const t = window.__thu, b = t.K.nk[0], p = t.K.M.parts[b.kep[1]]; t.giu = [p, t.tamCua.get(p)]; t.tamCua.delete(p); });
    r = await T.ve();
    eq([r.so, r.hong, r.nk.length], [0, [[0, 'kep']], 0], 'không tìm lại đủ 4 tấm kẹp trên bản vẽ: không gọi lệnh');
    await page.evaluate(() => { const t = window.__thu; t.tamCua.set(t.giu[0], t.giu[1]); });
    r = await T.ve();
    eq([r.so, r.mat], [1, [true, true]], 'đủ tấm kẹp rồi thì vẽ được');

    console.log('— Chenfeng báo "lệnh kết thúc" sớm hơn lúc đối tượng vào bản vẽ');
    c = await T.chuanBi({ mau: 555001, ma: 'NKT' }, 34500);
    await page.evaluate(() => { window.__MOCK_NK_KET_TRUOC__ = true; });
    r = await T.ve();
    await page.evaluate(() => { delete window.__MOCK_NK_KET_TRUOC__; });
    eq([r.so, r.hong, r.mat, r.added], [1, [], [true, true], 14], 'không kết luận vội "không sinh gì": chờ thêm một nhịp rồi mới đối chiếu');

    console.log('— Nhiều ô: mỗi ô một lệnh');
    c = await T.chuanBi({ mau: 555001, ma: 'N4', khoang: [{ rong: 'auto', canh: 2, dot: [520, 1000], o: [{ tu: 0, kieu: 'nk_am', so: 2 }, { tu: 520, kieu: 'nk_am', so: 3 }] }] }, 36000);
    r = await T.ve();
    eq([c.nk, r.so, r.xong, r.mat, r.buoc, r.tai, r.nk.map(x => x.lc.row)], [2, 2, [0, 1, 2, 3, 4], [true, true, true, true, true], 2, [555001, 555001], [2, 3]], 'hai ô chồng nhau: hai lệnh DRAWER (2 ngăn + 3 ngăn), mỗi lệnh một bước lịch sử và một lần gọi máy chủ; đủ 5 mặt đúng chỗ');

    console.log('— Máy chủ không trả lời (treo): thôi, không chạy tiếp, không chèn chồng');
    c = await T.chuanBi({ mau: 555001, ma: 'N5', khoang: [{ rong: 'auto', canh: 2, dot: [520, 1000], o: [{ tu: 0, kieu: 'nk_am', so: 2 }, { tu: 520, kieu: 'nk_am', so: 2 }] }] }, 39000);
    await page.evaluate(() => { window.__MOCK_TEMPLATE_DELAY__ = 2500; });
    r = await T.ve({ cho_mau: 600 });
    eq([r.so, r.hong, r.ban, r.nk.length, r.moi], [0, [[0, 'treo']], true, 1, 0], 'quá hạn chờ: báo "treo" + Chenfeng còn bận; ô thứ hai KHÔNG chạy (Chenfeng đang chờ máy chủ, lệnh khác sẽ bị bỏ qua)');
    await page.waitForTimeout(2600);
    const tre = await T.xem();
    eq([tre.mat.slice(0, 2), tre.bao_loi], [[true, true], 0], '(máy chủ trả lời trễ thì Chenfeng vẫn dựng ô đó — người dùng thấy ngăn kéo hiện ra sau)');
    await page.evaluate(() => { delete window.__MOCK_TEMPLATE_DELAY__; });

    console.log('— Cả phần mẫu của tủ: ngăn kéo bằng lệnh gốc, suốt treo vẫn chèn mẫu');
    // khoang 1: suốt treo; khoang 2: ngăn kéo âm + suốt treo phía trên
    const HAI = (ma, them) => Object.assign({ mau: 555001, ma, khoang: [{ rong: 'auto', canh: 2, dot: [1800], o: [{ tu: 0, kieu: 'suot' }] }, { rong: 'auto', canh: 2, dot: [520, 1800], o: [{ tu: 0, kieu: 'nk_am', so: 2 }, { tu: 520, kieu: 'suot' }] }] }, them || {});
    c = await T.chuanBi(HAI('H1'), 42000);
    r = await T.veMau();
    eq([c.nk, r.nk_goc, r.lenh_nk, r.nhap, r.thieu, r.ban], [1, [1, 1, [1, 2], []], ['ok'], [[0, 2, 'ok']], [], false], 'ngăn kéo: một lệnh DRAWER; phần chèn mẫu chỉ còn 2 suốt treo (một lệnh nhập, không có hộp ngăn kéo nào trong đó)');
    eq([r.mat, r.pk, r.added === r.moi], [[true, true], 6, true], 'hai mặt ngăn kéo đúng chỗ; 2 ray + 2 × (thanh suốt + bas); danh sách đối tượng mới gồm cả ngăn kéo lẫn suốt treo');
    eq(r.bao, [], 'vẽ được bằng lệnh gốc: không có lời báo nào về ngăn kéo');

    let ct = await T.cuaTu();
    eq([ct.tam - ct.tong_tam, ct.sot], [12, []], '"Cập nhật tủ này" tìm lại đủ đối tượng của tủ: mọi tấm thiết kế + 12 tấm ngăn kéo lệnh gốc + ray + suốt treo (không sót gì)');
    // tên mẫu trong kho tài khoản khác tên ghi ở Chuẩn xưởng (mã đúng): ngăn kéo lệnh gốc mang tên trong kho — vẫn phải nhận ra là của tủ
    c = await T.chuanBi(HAI('H1b', { mau: 555010, ten_mau: 'Tên ở Chuẩn xưởng' }), 44000);
    r = await T.veMau();
    ct = await T.cuaTu();
    eq([r.nk_goc.slice(0, 2), r.mat, ct.sot], [[1, 1], [true, true], []], 'mẫu mang tên khác trong kho: vẽ được bằng lệnh gốc, và danh sách đối tượng của tủ vẫn gồm đủ ngăn kéo (nhận theo nhánh 抽屉空间 của cây mẫu)');

    c = await T.chuanBi(HAI('H1c', { mau: 0 }), 45000);      // mã mặc định của bảng (không có trong kho giả) → lệnh gốc dùng mẫu cùng tên của tài khoản
    r = await T.veMau();
    eq([r.nk_goc.slice(0, 2), r.doi_ma, r.thieu], [[1, 1], [[true, 555001]], []], 'việc đổi sang mẫu cùng tên của tài khoản được ghi vào kết quả chung (để thẻ Kết quả nhắc sửa mã ở Chuẩn xưởng)');

    console.log('— Ô không vẽ được bằng lệnh gốc → chèn ngăn kéo của ô đó bằng mẫu như trước');
    c = await T.chuanBi(HAI('H2'), 46000);
    await page.evaluate(() => { window.__MOCK_NK_LECH__ = 3; });
    r = await T.veMau();
    await page.evaluate(() => { delete window.__MOCK_NK_LECH__; });
    eq([r.nk_goc, r.lenh_nk, r.nhap, r.thieu], [[1, 0, [], [[1, 'lech']]], ['ok'], [[0, 4, 'ok']], []], 'lệnh gốc ra lệch (đã hoàn tác) → lệnh nhập mang cả 2 hộp ngăn kéo + 2 suốt treo; không thiếu mẫu nào');
    eq([r.mat, r.pk], [[true, true], 6], '… hai mặt ngăn kéo (của mẫu chèn) nằm đúng chỗ thiết kế, không có ngăn kéo nào bị vẽ hai lần');
    ok(r.bao.length === 1 && /^Ngăn kéo khoang 2 \(2 ngăn\): chưa vẽ được bằng lệnh ngăn kéo của Chenfeng \(Chenfeng dựng ngăn kéo khác thiết kế/.test(r.bao[0]) && /đã chèn bằng mẫu/.test(r.bao[0]), '… có lời báo: ô nào, vì sao, đã chèn bằng mẫu', r.bao);

    console.log('— Lệnh gốc hỏng và chèn mẫu cũng hỏng → chỉ còn lời báo thiếu mẫu');
    c = await T.chuanBi(HAI('H2b'), 48000);
    await page.evaluate(() => { window.__MOCK_MAU_LOI__ = { 555001: { lan: 99, kieu: 'may_chu' } }; });
    r = await T.veMau();
    await page.evaluate(() => { delete window.__MOCK_MAU_LOI__; });
    eq([r.nk_goc[3], r.thieu.filter(x => x[0] === 'NGAN_KEO').length, r.bao, r.mat], [[[1, 'may_chu']], 2, [], [false, false]], 'máy chủ không trả mẫu ngăn kéo cho cả hai cách: 2 hộp ngăn kéo ghi là thiếu; KHÔNG có lời "đã chèn bằng mẫu"');

    console.log('— Máy chủ treo ở lệnh ngăn kéo → không chèn thêm gì (tránh hai ngăn kéo chồng nhau), báo thiếu cả phần mẫu');
    c = await T.chuanBi(HAI('H3'), 50000);
    await page.evaluate(() => { window.__MOCK_TEMPLATE_DELAY__ = 1800; });
    r = await T.veMau({ cho_mau: 500, cho_tre: 300 });
    eq([r.nk_goc, r.nhap, r.thieu, r.ban], [[1, 0, [], [[1, 'treo']]], [], [['SUOT', 0, 'may_chu', true], ['NGAN_KEO', 1, 'may_chu', true], ['NGAN_KEO', 1, 'may_chu', true], ['SUOT', 1, 'may_chu', true]], true],
      'quá hạn chờ: không lệnh nhập nào được gửi; 2 hộp ngăn kéo + 2 suốt treo đều ghi là chưa thêm được vì máy chủ; Chenfeng còn bận');
    eq(r.bao, [], '… ô bị treo không có lời báo "đã chèn bằng mẫu" (phần thiếu mẫu đã có lời báo riêng)');
    eq(r.tu_choi, 0, '… và bảng không hề thả lệnh nhập nào vào Chenfeng trong lúc nó còn chờ máy chủ (thả vào là bị từ chối, thử lại sau thì thành ngăn kéo chồng nhau)');
    await page.waitForTimeout(1900);
    await page.evaluate(() => { delete window.__MOCK_TEMPLATE_DELAY__; });
    c = await T.chuanBi(HAI('H4'), 54000);
    await page.evaluate(() => { window.__MOCK_TEMPLATE_DELAY__ = 700; });
    r = await T.veMau({ cho_mau: 300, cho_tre: 3000 });
    await page.evaluate(() => { delete window.__MOCK_TEMPLATE_DELAY__; });
    eq([r.nk_goc[3], r.nhap, r.ban, r.thieu.length], [[[1, 'treo']], [], false, 4], 'Chenfeng hết chờ trong lúc bảng đợi thêm: không còn bận (các bước sau như khoan lại, gom module chạy được), phần mẫu vẫn ghi là thiếu');

    console.log('— Tủ không có ô nào vẽ được bằng lệnh gốc (loại ngăn kéo chia ô): chèn mẫu hết như bản 1.23');
    c = await T.chuanBi({ mau: 555001, ma: 'H5', khoang: [{ rong: 'auto', canh: 2, dot: [520], o: [{ tu: 0, kieu: 'nk_am', so: 2, loai: 'chia_o' }] }] }, 58000);
    r = await T.veMau();
    eq([c.nk, r.nk_goc, r.lenh_nk, r.nhap, r.thieu], [0, [0, 0, [], []], [], [[0, 2, 'ok']], []], 'không gọi lệnh DRAWER; 2 hộp ngăn kéo vào bằng một lệnh nhập');

    console.log('— Loại ngăn kéo chưa khai mã mẫu: không vẽ ngăn kéo, và không đòi mặt ngăn kéo của nó');
    const r0 = await page.evaluate(async () => {
      const s = window.__thu.spec({ ma: 'NK0' }); s.ngan_keo.loai.forEach(x => { x.mau_id = 0; }); s.ve_goc = false; s.module_cf = false;
      const q = await window.MNCF.draw(s, { at: [62000, 0, 0] });
      return { ok: q.ok, gd: q.giai_doan, errors: q.errors, warnings: q.warnings, lech: q.kiem_tra.mat_ngan_keo_lech, thieu: q.mau_thieu };
    });
    ok(r0.gd === 'xong' && r0.warnings.some(w => /Chưa khai mã mẫu ngăn kéo/.test(w)), 'tủ vẽ xong, có lời nhắc chưa khai mã mẫu ngăn kéo', [r0.gd, r0.errors, r0.warnings]);
    ok(r0.lech.length === 0 && !r0.warnings.some(w => /đặt mặt khác thiết kế/.test(w)), 'không báo "Mẫu ngăn kéo đặt mặt khác thiết kế" cho ngăn kéo không được vẽ', [r0.lech, r0.warnings]);

    console.log('— Thẻ Kết quả nói rõ ngăn kéo nào vẽ bằng lệnh ngăn kéo của Chenfeng');
    // trang giả lập không vẽ được thùng bằng lệnh gốc → mượn một lần vẽ thật của bảng rồi gắn thêm phần kết quả mà D.veGoc trả về
    await page.evaluate(() => { const D = window.MNCFDriver, goc = D.draw; window.__nkGoc = null;
      D.draw = async (s, o) => { const q = await goc(s, o); if (q && q.giai_doan === 'xong') { q.goc_cf = true; q.buoc = q.tong_buoc = 12; q.nk_goc = window.__nkGoc; } return q; }; });
    const H = page.locator('#mncf-host');
    const veBang = async nk => {
      await page.evaluate(v => { window.__nkGoc = v; window.MNCF.app.setSpec(Object.assign(window.__thu.spec({ ma: 'KQ' + Math.round(Math.random() * 1e6) }), { ve_goc: false, module_cf: false })); }, nk);
      if (await H.locator('.launch').isVisible()) await H.locator('.launch').click();
      await H.locator('.tab', { hasText: 'Tủ' }).first().click();
      await H.locator('[data-act="draw"]').click();
      await page.waitForFunction(() => window.app.Editor.GetPointServices.IsReady, null, { timeout: 15000 });
      await page.evaluate(x => window.__MOCK__.clickPoint(x, -17.5, 0), 70000 + Math.round(Math.random() * 50) * 3000);
      await H.locator('.msg.ok, .msg.err').first().waitFor({ timeout: 60000 });
      return H.locator('.msg.nkg').allInnerTexts();
    };
    let kqNK = await veBang({ tong: 2, so: 2, lui: [] });
    ok(kqNK.length === 1 && /2 ô ngăn kéo/.test(kqNK[0]) && /lệnh ngăn kéo của Chenfeng/.test(kqNK[0]) && /Drawer Design/.test(kqNK[0]) && !/chèn bằng mẫu/.test(kqNK[0]), 'có dòng riêng: mấy ô ngăn kéo vẽ bằng lệnh ngăn kéo của Chenfeng', kqNK);
    kqNK = await veBang({ tong: 3, so: 2, lui: [{ khoang: 1, ly_do: 'lech' }] });
    ok(kqNK.length === 1 && /2 ô ngăn kéo/.test(kqNK[0]) && /1 ô còn lại chèn bằng mẫu/.test(kqNK[0]), 'có ô phải chèn mẫu thì dòng đó nói thêm còn mấy ô', kqNK);
    kqNK = await veBang({ tong: 1, so: 0, lui: [{ khoang: 0, ly_do: 'lech' }] });
    eq(kqNK, [], 'không ô nào vẽ được bằng lệnh gốc: không có dòng đó (lời báo vì sao nằm ở các dòng lưu ý)');
    kqNK = await veBang(null);
    eq(kqNK, [], 'tủ không có bước ngăn kéo: không có dòng đó');

    if (!(await H.locator('.tab', { hasText: 'Hướng dẫn' }).isVisible())) await H.locator('[data-act="the-them"]').click();      // (bản 1.27) thẻ Hướng dẫn nằm ở hàng thẻ phụ sau nút ⚙
    await H.locator('.tab', { hasText: 'Hướng dẫn' }).click();
    const hd = await H.locator('.sum li', { hasText: 'bản 1.26:' }).allInnerTexts();      // (mục Khấu cột có nhắc "bản 1.26.1" — không phải mục này)
    ok(hd.length === 1 && /Ngăn kéo vẽ bằng lệnh ngăn kéo của Chenfeng/.test(hd[0]) && /Drawer Design/.test(hd[0]) && /chèn mẫu/.test(hd[0]), 'thẻ Hướng dẫn có mục của bản 1.26 về ngăn kéo lệnh gốc', hd);
    ok(hd.length === 1 && !/không chia đều/.test(hd[0]) && /mặt cao khác nhau/.test(hd[0]), '… mặt ngăn kéo cao khác nhau không còn nằm trong danh sách "chưa vẽ được" (bảng khoá cao từng ô)', hd);

    eq(errs, [], 'không có lỗi JS nào lọt ra trang');
    eq(await page.evaluate(() => window.__MOCK_BAO_LOI__ || 0), 0, 'suốt bộ thử: Chenfeng không lần nào nhận ô có mã mẫu mà thiếu tham số (không báo cáo lỗi nào bị gửi đi)');
  } finally { await ctx.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* bỏ qua */ } }
  console.log(`\n${pass} đạt, ${fail} hỏng`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
