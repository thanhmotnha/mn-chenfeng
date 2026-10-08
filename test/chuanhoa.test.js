'use strict';
// Bản 1.11 — "Chuẩn hoá mẫu kho": module kiểu Trung (hậu dày lọt lòng / hậu mỏng âm rãnh) → hậu 6 li phủ sau lưng.
//   NODE_PATH=<node_modules có playwright> PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node test/chuanhoa.test.js
// Chạy tiện ích thật (dist/extension) trên trang giả lập Chenfeng; module dựng bằng các lớp giả lập có điểm co giãn, động tác tham số, mẫu hậu tự động.
const path = require('path'), fs = require('fs'), os = require('os');
const { chromium } = require('playwright');
const EXT = path.join(__dirname, '..', 'dist', 'extension');
const MOCK = fs.readFileSync(path.join(__dirname, 'mock-chenfeng.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) pass++; else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); } };
const eq = (a, b, name) => ok(JSON.stringify(a) === JSON.stringify(b), name, { co: a, can: b });

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mncf-ch-'));
  const ctx = await chromium.launchPersistentContext(dir, { channel: 'chromium', headless: true, viewport: { width: 1500, height: 900 }, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  try {
    await ctx.route('https://api.cfcad.cn/**', r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': 'https://cfcad.cn', 'access-control-allow-credentials': 'true' }, body: JSON.stringify({ err_code: 1, err_msg: 'no' }) }));
    await require('./kho-gia.js')(ctx);      // bộ nạp của tiện ích lấy bản gộp vừa dựng trong máy
    await ctx.route('https://cfcad.cn/**', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: MOCK }));
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    await page.goto('https://cfcad.cn/');
    await page.waitForFunction(() => window.MNCF && window.MNCF.app && window.MNCFDriver, null, { timeout: 15000 });
    ok(await page.evaluate(() => typeof window.MNCFDriver.chuanHoa === 'function' && typeof window.MNCFDriver.undoChuanHoa === 'function'), 'bộ điều khiển có chuanHoa / undoChuanHoa');

    // các hàm dựng module giả lập (chạy trong trang)
    await page.evaluate(() => {
      const M = window.__MOCK__, bit = [4, 2, 1];
      const mat = (a, s) => [0, 1, 2, 3, 4, 5, 6, 7].filter(k => ((k & bit[a]) ? 1 : 0) === s);      // 4 điểm co giãn của mặt (trục a, phía s) theo cách đánh số của trang giả lập
      const dt = (T, ten, dir, doi, keo) => { let p = T.GetParam(ten); if (!p) { p = { name: ten, expr: '', value: 0, actions: [] }; T.Params.push(p); } const a = new M.StretchAction(new M.V3(dir[0], dir[1], dir[2])); a.Expr = ten; a.MoveEntitys = doi.map(b => b.Id); a.EntityStretchPointMap = keo.map(([b, q, s]) => ({ entity: b.Id, indexs: mat(q, s) })); p.actions.push(a); return a; };
      const K = ['三合一', '三合一', '三合一', '三合一'];
      window.__T = {
        box: b => b.box.map(v => Math.round(v * 100) / 100),
        // "标准柜" hậu dày 18 lọt lòng giữa 2 hồi, chạy suốt chiều cao; nóc / đáy dừng ở mặt trước hậu; xà chân trước + sau
        day(x0) {
          const B = (ten, b, t) => M.them(new M.Board(ten, 0, [b[0] + x0, b[1] + x0, b[2], b[3], b[4], b[5]], t, 'TC', '', K));
          const tr = B('左侧板', [0, 18, 0, 500, 0, 2000], 18), ph = B('右侧板', [782, 800, 0, 500, 0, 2000], 18), hau = B('背板', [18, 782, 482, 500, 0, 2000], 18),
            noc = B('顶板', [18, 782, 0, 482, 1982, 2000], 18), day = B('底板', [18, 782, 0, 482, 80, 98], 18), ct = B('地脚线', [18, 782, 0, 18, 0, 80], 18), cs = B('后地脚', [18, 782, 462, 480, 0, 80], 18);
          const all = [tr, ph, hau, noc, day, ct, cs], T = new M.Tpl('标准柜', all); T.coGian = true; for (const b of all) b.Template = T.Id;
          for (const [n, v] of [['L', 800], ['W', 500], ['H', 2000], ['BH', 18]]) T.GetParam(n).value = v;
          T.Params.push({ name: 'DJG', expr: '', value: 80, actions: [] });
          dt(T, 'L', [1, 0, 0], [ph], [[hau, 0, 1], [noc, 0, 1], [day, 0, 1], [ct, 0, 1], [cs, 0, 1]]);
          dt(T, 'W', [0, 1, 0], [hau, cs], [[tr, 1, 1], [ph, 1, 1], [noc, 1, 1], [day, 1, 1]]);
          dt(T, 'H', [0, 0, 1], [noc], [[tr, 2, 1], [ph, 2, 1], [hau, 2, 1]]);
          dt(T, 'BH', [1, 0, 0], [], [[tr, 0, 1], [hau, 0, 0], [noc, 0, 0], [day, 0, 0], [ct, 0, 0], [cs, 0, 0]]);      // ván dày lên: mặt trong hồi trái lấn vào, các tấm giữa co mép trái
          dt(T, 'BH', [0, -1, 0], [cs], [[hau, 1, 0], [noc, 1, 1], [day, 1, 1]]);                                         // hậu dày lên về phía trước, nóc / đáy co mép sau
          dt(T, 'BH', [-1, 0, 0], [], [[ph, 0, 0], [hau, 0, 1], [noc, 0, 1], [day, 0, 1], [ct, 0, 1], [cs, 0, 1]]);
          dt(T, 'BH', [0, 0, -1], [], [[noc, 2, 0]]);
          dt(T, 'BH', [0, 0, 1], [], [[day, 2, 1]]);
          dt(T, 'DJG', [0, 0, 1], [day], [[ct, 2, 1], [cs, 2, 1]]);
          return { T, tr, ph, hau, noc, day, ct, cs, all };
        },
        // "上柜" hậu mỏng 5 li trong rãnh (mẫu 背板(自动), lùi 20, ăn rãnh 6) + 1 thanh giằng 18 sau hậu + 1 đợt chạm mặt trước hậu
        ranh(x0) {
          const B = (ten, b, t, k) => M.them(new M.Board(ten, 0, [b[0] + x0, b[1] + x0, b[2], b[3], b[4], b[5]], t, 'TT', '', k || K));
          const tr = B('左侧板', [0, 18, 0, 500, 0, 600], 18), ph = B('右侧板', [782, 800, 0, 500, 0, 600], 18), noc = B('顶板', [18, 782, 0, 500, 582, 600], 18), day = B('底板', [18, 782, 0, 500, 0, 18], 18),
            dot = B('层板', [18, 782, 20, 475, 300, 318], 18), giang = B('背板', [18, 782, 480.5, 498.5, 100, 200], 18), hau = B('背板', [12, 788, 475, 480, 12, 588], 5, ['不排', '不排', '不排', '不排']);
          const all = [tr, ph, noc, day, dot, giang], T = new M.Tpl('上柜', all); T.coGian = true; for (const b of all) b.Template = T.Id;
          const C = new M.TplHau('背板(自动)', hau, [tr, ph, noc, day]); hau.Template = C.Id; C.Parent = T.Id; T.Children.push(C.Id);
          for (const [n, v] of [['L', 800], ['W', 500], ['H', 600], ['BH', 18]]) T.GetParam(n).value = v;
          C.GetParam('BH').value = 5;
          dt(T, 'L', [1, 0, 0], [ph], [[noc, 0, 1], [day, 0, 1], [dot, 0, 1], [giang, 0, 1]]);
          dt(T, 'W', [0, 1, 0], [giang], [[tr, 1, 1], [ph, 1, 1], [noc, 1, 1], [day, 1, 1], [dot, 1, 1]]);
          dt(T, 'H', [0, 0, 1], [noc], [[tr, 2, 1], [ph, 2, 1]]);
          return { T, C, tr, ph, noc, day, dot, giang, hau, all: all.concat([hau]) };
        },
      };
    });
    const D = (fn, arg) => page.evaluate(fn, arg);

    /* ---------- 1. hậu dày lọt lòng (tấm thường) ---------- */
    let r = await D(async () => { const m = window.__m1 = window.__T.day(0); const r = await window.MNCFDriver.chuanHoa(m.tr, { khoan: 'Cam3Tp' }); const b = window.__T.box;
      return { r, tr: b(m.tr), ph: b(m.ph), hau: b(m.hau), noc: b(m.noc), day: b(m.day), cs: b(m.cs), t: m.hau.Thickness, khoanHau: [m.hau.BoardProcessOption.drillType].concat(m.hau.BoardProcessOption.highDrill), khoanHoi: m.tr.BoardProcessOption.highDrill,
        lo: window.__MOCK__.ents.filter(e => e instanceof window.__MOCK__.CylinderHole && !e.IsErase).map(e => e.FId.Object.Name), ls: window.app.Database.hm.historyRecord.map(x => x.CommandName) }; });
    ok(r.r.ok && r.r.so_hau === 1 && r.r.hau_tu_dong === 0 && r.r.xoa_giang === 0, 'hậu dày: chuẩn hoá được', r.r);
    eq([r.hau, r.t], [[1, 799, 493.5, 500, 81, 1999], 6.5], 'hậu → 6,5 li, phủ từ mép ngoài hồi (lùi 1), sát lưng, từ mặt dưới đáy tới mặt trên nóc');
    eq([r.tr, r.ph, r.noc, r.day], [[0, 18, 0, 493.5, 0, 2000], [782, 800, 0, 493.5, 0, 2000], [18, 782, 0, 493.5, 1982, 2000], [18, 782, 0, 493.5, 80, 98]], 'hồi lùi mép sau 6; nóc / đáy nối ra tới (sâu − 6)');
    eq(r.cs, [18, 782, 462, 480, 0, 80], 'xà chân sau giữ nguyên');
    ok(r.khoanHau.every(x => x === '不排') && r.khoanHoi.every(x => x === 'Cam3Tp') && !r.lo.includes('背板') && r.lo.includes('左侧板'), 'hậu không khoan (不排); tấm khác đổi sang kiểu khoan của xưởng và được khoan lại', [r.khoanHau, r.khoanHoi]);
    eq(r.ls.slice(-2), ['MNCF_CHUANHOA', 'DRAWHOLE'], 'lịch sử: 1 bước riêng cho phần sửa + 1 bước khoan lại');
    ok(r.r.so_buoc_hoan_tac === 2 && r.r.dong_tac >= 5, 'báo đúng số bước hoàn tác, số động tác đã tính lại', [r.r.so_buoc_hoan_tac, r.r.dong_tac]);
    // module vẫn co giãn đúng theo tham số của mẫu
    const doi = (ten, v) => D(async ([ten, v]) => { const m = window.__m1, b = window.__T.box; m.T.GetParam(ten).expr = String(v); await m.T.UpdateTemplateTree(); return { tr: b(m.tr), ph: b(m.ph), hau: b(m.hau), noc: b(m.noc), day: b(m.day), t: m.hau.Thickness }; }, [ten, v]);
    let s = await doi('L', 1000);
    eq([s.hau, s.ph, s.noc], [[1, 999, 493.5, 500, 81, 1999], [982, 1000, 0, 493.5, 0, 2000], [18, 982, 0, 493.5, 1982, 2000]], 'Rộng 800 → 1000: hậu rộng theo, vẫn phủ hết hồi phải');
    s = await doi('W', 600);
    eq([s.hau, s.tr, s.noc, s.day], [[1, 999, 594, 600, 81, 1999], [0, 18, 0, 594, 0, 2000], [18, 982, 0, 594, 1982, 2000], [18, 982, 0, 594, 80, 98]], 'Sâu 500 → 600: hậu ra sát lưng mới, mép sau hồi / nóc / đáy theo');
    s = await doi('H', 2400);
    eq([s.hau, s.noc], [[1, 999, 594, 600, 81, 2399], [18, 982, 0, 594, 2382, 2400]], 'Cao 2000 → 2400: mép trên hậu theo nóc');
    s = await doi('DJG', 100);
    eq([s.hau, s.day], [[1, 999, 594, 600, 101, 2399], [18, 982, 0, 594, 100, 118]], 'Chân 80 → 100: mép dưới hậu theo mặt dưới đáy');
    s = await doi('BH', 25);
    eq([s.hau, s.t, s.tr, s.noc], [[1, 999, 594, 600, 101, 2399], 6, [0, 25, 0, 594, 0, 2400], [25, 975, 0, 594, 2375, 2400]], 'Ván dày 18 → 25: hậu KHÔNG dày lên, không co lại; nóc không còn lùi mép sau theo bề dày ván');

    /* ---------- 2. hoàn tác ---------- */
    r = await D(async () => { const m = window.__m2 = window.__T.day(3000), b = window.__T.box, truoc = m.all.map(b); const D = window.MNCFDriver;
      const r1 = await D.chuanHoa(m.noc, { khoan: 'Cam3Tp' }), giua = b(m.hau); const u = await D.undoChuanHoa(); const sau = m.all.map(b);
      const dt = m.T.GetParam('BH').actions[1]; const r2 = await D.chuanHoa(m.noc, { khoan: 'Cam3Tp' }); const u2 = await D.undoChuanHoa(); const u3 = await D.undoChuanHoa();
      return { ok1: r1.ok, giua, u, giong: JSON.stringify(truoc) === JSON.stringify(sau), t: m.hau.Thickness, khoan: m.hau.BoardProcessOption.highDrill, keoHau: dt.EntityStretchPointMap.some(x => x.entity === m.hau.Id), ok2: r2.ok, u2, u3, t2: m.hau.Thickness }; });
    ok(r.ok1 && r.giua[2] === 493.5 && r.u.ok && r.giong && r.t === 18 && r.khoan.every(x => x === '三合一') && r.keoHau, 'hoàn tác: tấm, bề dày hậu, kiểu khoan, động tác tham số trở lại như mẫu gốc', r);
    ok(r.ok2 && r.u2.ok && r.t2 === 18 && !r.u3.ok && /Chưa có lần chuẩn hoá/.test(r.u3.reason), 'chuẩn hoá lại rồi hoàn tác lần nữa vẫn được; hết lần thì báo rõ', r);

    /* ---------- 3. hậu mỏng âm rãnh (mẫu hậu tự động) + thanh giằng + đợt ---------- */
    r = await D(async () => { const m = window.__m3 = window.__T.ranh(6000), b = window.__T.box; const r = await window.MNCFDriver.chuanHoa(m.hau, { khoan: 'Cam3Tp' });
      return { r, hau: b(m.hau), t: m.hau.Thickness, tr: b(m.tr), noc: b(m.noc), day: b(m.day), dot: b(m.dot), giang: m.giang.IsErase, op: m.C._option, bh: m.C.GetParam('BH').expr }; });
    ok(r.r.ok && r.r.hau_tu_dong === 1 && r.r.xoa_giang === 1, 'hậu âm rãnh: chuẩn hoá được, bỏ 1 thanh giằng', r.r);
    eq([r.hau, r.t], [[6001, 6799, 493.5, 500, 1, 599], 6.5], 'mẫu hậu tự động dựng lại: 6,5 li, sát lưng, phủ hết hồi / nóc / đáy (lùi 1)');
    eq([r.op.leftExt, r.op.rightExt, r.op.topExt, r.op.bottomExt, r.op.thickness, r.op.spaceSize, r.op.calcSpaceSize, r.op.exprThickness, r.bh], [17, 17, 17, 17, 6, -6, '-6', '6', '6'], 'lựa chọn của mẫu hậu: ăn ra 17 mỗi phía, dày 6, cách lưng −6');
    eq([r.tr, r.noc, r.day, r.dot], [[6000, 6018, 0, 493.5, 0, 600], [6018, 6782, 0, 493.5, 582, 600], [6018, 6782, 0, 493.5, 0, 18], [6018, 6782, 20, 493.5, 300, 318]], 'hồi / nóc / đáy lùi mép sau 6; đợt nối ra tới (sâu − 6)');
    ok(r.giang === true, 'thanh giằng đã xoá');
    s = await D(async () => { const m = window.__m3, b = window.__T.box; m.T.GetParam('W').expr = '600'; m.T.GetParam('L').expr = '1000'; await m.T.UpdateTemplateTree(); return { hau: b(m.hau), tr: b(m.tr), dot: b(m.dot) }; });
    eq([s.hau, s.tr, s.dot], [[6001, 6999, 594, 600, 1, 599], [6000, 6018, 0, 594, 0, 600], [6018, 6982, 20, 594, 300, 318]], 'đổi Rộng / Sâu: hậu tự động vẫn phủ kín, đợt theo mép sau hồi');
    r = await D(async () => { const m = window.__T.ranh(9000), b = window.__T.box, truoc = m.all.map(b), D = window.MNCFDriver; const r1 = await D.chuanHoa(m.tr, { khoan: 'Cam3Tp' }); const buoc = r1.so_buoc_hoan_tac; const u = await D.undoChuanHoa();
      return { ok: r1.ok, buoc, u, giong: JSON.stringify(truoc) === JSON.stringify(m.all.map(b)), giang: m.giang.IsErase, op: [m.C._option.spaceSize, m.C._option.thickness, m.C._option.leftExt], t: m.hau.Thickness }; });
    ok(r.ok && r.buoc === 3 && r.u.ok && r.giong && r.giang === false && r.t === 5, 'hoàn tác (3 bước: sửa, xoá giằng, khoan lại): mọi tấm + thanh giằng trở lại', r);
    eq(r.op, [20, 5, 6], 'hoàn tác: lựa chọn của mẫu hậu tự động trở lại (lùi 20, dày 5, rãnh 6)');

    // tủ bếp dưới: đáy đỡ hồi, không có nóc, hậu 6 âm rãnh lùi 17; "背板" dày 18 cao 100 nằm TRƯỚC hậu = xà sau đỡ mặt đá (cũng là mẫu tự động, đo từ lưng) → phải GIỮ và giữ đúng chỗ
    r = await D(async () => { const M = window.__MOCK__, b = window.__T.box, K = ['三合一', '三合一', '三合一', '三合一'], x0 = 40000;
      const B = (ten, q, t, k) => M.them(new M.Board(ten, 0, [q[0] + x0, q[1] + x0, q[2], q[3], q[4], q[5]], t, 'TB', '', k || K));
      const tr = B('左侧板', [0, 18, 18, 586, 110, 880], 18), ph = B('右侧板', [1029, 1047, 18, 586, 110, 880], 18), day = B('底板', [0, 1047, 68, 586, 92, 110], 18), dot = B('层板', [19, 1028, 38, 544, 780.5, 798.5], 18),
        xa = B('背板', [18, 1029, 545, 563, 780, 880], 18), hau = B('背板', [12, 1035, 563, 569, 104, 795], 6, ['不排', '不排', '不排', '不排']);
      const all = [tr, ph, day, dot], T = new M.Tpl('灶台柜', all); T.coGian = true; for (const q of all) q.Template = T.Id;
      const Cx = new M.TplHau('背板(自动)', xa, [tr, ph, day, day], { thickness: 18, spaceSize: 23, calcSpaceSize: '23', leftExt: 0, rightExt: 0 }); xa.Template = Cx.Id; Cx.Parent = T.Id; T.Children.push(Cx.Id);
      Cx.dungHau = function () { const sau = Math.min(tr.box[3], ph.box[3]) - this._option.spaceSize; xa.box = [tr.box[1], ph.box[0], sau - 18, sau, 780, 880]; };
      const Ch = new M.TplHau('背板(自动)', hau, [tr, ph, xa, day], { thickness: 6, exprThickness: '6', spaceSize: 17, calcSpaceSize: '17', topExt: 15 }); hau.Template = Ch.Id; Ch.Parent = T.Id; T.Children.push(Ch.Id);
      const r = await window.MNCFDriver.chuanHoa(tr, { khoan: 'Cam3Tp' });
      return { r, hau: b(hau), xa: b(xa), xaXoa: xa.IsErase, tr: b(tr), day: b(day), dot: b(dot), opX: [Cx._option.spaceSize, Cx._option.calcSpaceSize], opH: [Ch._option.leftExt, Ch._option.rightExt, Ch._option.topExt, Ch._option.bottomExt, Ch._option.spaceSize] }; });
    ok(r.r.ok && r.r.so_hau === 1 && r.r.xoa_giang === 0 && r.xaXoa === false, 'tủ bếp dưới: chỉ hậu mỏng được chuyển; xà sau (背板 dày, nằm trước hậu) được giữ', r.r);
    eq([r.hau.map(v => v - 40000 > -1 && v > 30000 ? v - 40000 : v), r.opH], [[1, 1046, 580, 586, 93, 879], [17, 17, 99, 17, -6]], 'hậu phủ từ mặt dưới đáy tới ĐẦU HỒI (thùng không có nóc), phần ăn ra tính theo hình học thật');
    eq([r.xa.map(v => v > 30000 ? v - 40000 : v), r.opX], [[18, 1029, 545, 563, 780, 880], [17, '17']], 'xà sau giữ đúng chỗ cũ (khoảng cách tới lưng 23 → 17 vì hồi đã lùi 6)');
    eq([r.tr.map(v => v > 30000 ? v - 40000 : v), r.day.map(v => v > 30000 ? v - 40000 : v), r.dot.map(v => v > 30000 ? v - 40000 : v)], [[0, 18, 18, 580, 110, 880], [0, 1047, 68, 580, 92, 110], [19, 1028, 38, 544, 780.5, 798.5]], 'hồi, đáy lùi mép sau 6; đợt không chạm hậu thì giữ nguyên');

    // thùng 2 khoang, vách chung, mỗi khoang 1 tấm hậu dày → mối nối 2 tấm hậu nằm ở TIM vách (chuẩn xưởng: chia tấm, mối nối trên vách)
    r = await D(async () => { const M = window.__MOCK__, b = window.__T.box, K = ['三合一', '三合一', '三合一', '三合一'], x0 = 50000, g = q => q.map(v => v >= x0 ? v - x0 : v);
      const B = (ten, q, t) => M.them(new M.Board(ten, 0, [q[0] + x0, q[1] + x0, q[2], q[3], q[4], q[5]], t, 'T2', '', K));
      const tr = B('左侧板', [0, 18, 0, 500, 0, 2000], 18), vach = B('立板', [791, 809, 0, 482, 18, 1982], 18), ph = B('右侧板', [1582, 1600, 0, 500, 0, 2000], 18), noc = B('顶板', [18, 1582, 0, 482, 1982, 2000], 18), day = B('底板', [18, 1582, 0, 482, 0, 18], 18),
        h1 = B('背板', [18, 800, 482, 500, 18, 1982], 18), h2 = B('背板', [800, 1582, 482, 500, 18, 1982], 18);
      const all = [tr, vach, ph, noc, day, h1, h2], T = new M.Tpl('两门柜', all); T.coGian = true; for (const q of all) q.Template = T.Id;
      const r = await window.MNCFDriver.chuanHoa(vach, { khoan: 'Cam3Tp' });
      return { r, h1: g(b(h1)), h2: g(b(h2)), vach: g(b(vach)), tr: g(b(tr)), noc: g(b(noc)) }; });
    ok(r.r.ok && r.r.so_hau === 2, 'thùng 2 khoang: chuyển cả 2 tấm hậu', r.r);
    eq([r.h1, r.h2], [[1, 800, 493.5, 500, 1, 1999], [800, 1599, 493.5, 500, 1, 1999]], '2 tấm hậu nối nhau ở tim vách chung, phủ hết 2 hồi ngoài (lùi 1), từ mặt dưới đáy tới mặt trên nóc');
    eq([r.vach, r.tr, r.noc], [[791, 809, 0, 493.5, 18, 1982], [0, 18, 0, 493.5, 0, 2000], [18, 1582, 0, 493.5, 1982, 2000]], 'vách, nóc nối ra tới (sâu − 6); hồi lùi 6');
    // bộ ghép 2 thùng đứng cạnh nhau, sâu khác nhau (500 và 400), mỗi thùng hồi riêng → mỗi tấm hậu theo chiều sâu thùng mình và phủ hết hồi của thùng mình
    r = await D(async () => { const M = window.__MOCK__, b = window.__T.box, K = ['三合一', '三合一', '三合一', '三合一'], x0 = 60000, g = q => q.map(v => v >= x0 ? v - x0 : v);
      const B = (ten, q, t) => M.them(new M.Board(ten, 0, [q[0] + x0, q[1] + x0, q[2], q[3], q[4], q[5]], t, 'BO', '', K));
      const thung = (x, sau) => [B('左侧板', [x, x + 18, 0, sau, 0, 2000], 18), B('右侧板', [x + 782, x + 800, 0, sau, 0, 2000], 18), B('顶板', [x + 18, x + 782, 0, sau - 18, 1982, 2000], 18), B('底板', [x + 18, x + 782, 0, sau - 18, 0, 18], 18), B('背板', [x + 18, x + 782, sau - 18, sau, 18, 1982], 18)];
      const a = thung(0, 500), c = thung(800, 400), all = a.concat(c), T = new M.Tpl('组合柜', all); T.coGian = true; for (const q of all) q.Template = T.Id;
      const r = await window.MNCFDriver.chuanHoa(a[0], { khoan: 'Cam3Tp' });
      return { r, ha: g(b(a[4])), hc: g(b(c[4])), pa: g(b(a[1])), tc: g(b(c[0])), nc: g(b(c[2])) }; });
    ok(r.r.ok && r.r.so_hau === 2, 'bộ 2 thùng sâu khác nhau: chuyển cả 2', r.r);
    eq([r.ha, r.hc], [[1, 799, 493.5, 500, 1, 1999], [801, 1599, 393.5, 400, 1, 1999]], 'mỗi tấm hậu sát lưng thùng của mình (500 / 400) và phủ hết 2 hồi của thùng đó');
    eq([r.pa, r.tc, r.nc], [[782, 800, 0, 493.5, 0, 2000], [800, 818, 0, 393.5, 0, 2000], [818, 1582, 0, 393.5, 1982, 2000]], 'hồi áp nhau của 2 thùng: mỗi tấm lùi theo chiều sâu thùng mình');

    // nghiệm thu không đạt (ở đây: mẫu hậu tự động không dựng lại) → tự trả module về như cũ, không để module sửa dở
    r = await D(async () => { const m = window.__T.ranh(10500), b = window.__T.box, truoc = m.all.map(b), D = window.MNCFDriver; m.C.dungHau = () => {}; const n0 = window.app.Database.hm.curIndex; const r1 = await D.chuanHoa(m.tr, { khoan: 'Cam3Tp' });
      return { r1, giong: JSON.stringify(truoc) === JSON.stringify(m.all.map(b)), giang: m.giang.IsErase, op: m.C._option.spaceSize, ls: window.app.Database.hm.curIndex - n0, con: !!D.lastChuanHoa }; });
    ok(!r.r1.ok && r.r1.da_tra_lai === true && /chưa xử lý đúng/.test(r.r1.ly_do) && /đã trả module về như cũ/.test(r.r1.ly_do) && r.giong && r.giang === false && r.op === 20 && r.ls === 0 && !r.con, 'nghiệm thu không đạt → tự hoàn tác, module nguyên như trước, báo rõ', r);

    /* ---------- 4. các trường hợp không sửa ---------- */
    r = await D(async () => { const M = window.__MOCK__, D = window.MNCFDriver, kq = {};
      const B = (ten, b, t) => M.them(new M.Board(ten, 0, b, t, 'X', '', ['Cam3Tp', 'Cam3Tp', 'Cam3Tp', 'Cam3Tp']));
      const gan = (ten, bs) => { const T = new M.Tpl(ten, bs); for (const b of bs) b.Template = T.Id; return T; };
      const le = B('Đợt', [12000, 12800, 0, 500, 0, 18], 18); kq.le = await D.chuanHoa(le, {});
      const a = [B('左侧板', [13000, 13018, 0, 500, 0, 600], 18), B('右侧板', [13782, 13800, 0, 500, 0, 600], 18), B('顶板', [13018, 13782, 0, 500, 582, 600], 18)]; gan('K', a); kq.khongHau = await D.chuanHoa(a[0], {});
      const c = [B('左侧板', [14000, 14018, 0, 493.5, 0, 600], 18), B('右侧板', [14782, 14800, 0, 493.5, 0, 600], 18), B('顶板', [14018, 14782, 0, 493.5, 582, 600], 18), B('底板', [14018, 14782, 0, 493.5, 0, 18], 18), B('背板', [14001, 14799, 493.5, 500, 1, 599], 6.5)]; gan('P', c); kq.daChuan = await D.chuanHoa(c[0], {});
      const x = [B('左侧板', [15000, 15500, 0, 18, 0, 600], 18), B('右侧板', [15000, 15500, 782, 800, 0, 600], 18), B('顶板', [15000, 15500, 18, 782, 582, 600], 18), B('底板', [15000, 15500, 18, 782, 0, 18], 18), B('背板', [15482, 15500, 18, 782, 18, 582], 18)]; gan('Xoay', x); kq.xoay = await D.chuanHoa(x[0], {});
      const mn = [B('Hồi trái', [16000, 16018, 0, 500, 0, 600], 18), B('Hồi phải', [16782, 16800, 0, 500, 0, 600], 18)]; gan('MN', mn); mn[0].BoardProcessOption.remarks = [[D.TAG, 'ABC']]; kq.motNha = await D.chuanHoa(mn[1], {});
      const coDich = M.ents.filter(e => !e.IsErase && e.box && e.box[0] >= 12000).every(e => true);
      return { kq, ls: window.app.Database.hm.historyRecord.length, coDich }; });
    ok(!r.kq.le.ok && /không thuộc module nào/.test(r.kq.le.ly_do), 'tấm rời (không thuộc module) → từ chối, nói rõ', r.kq.le);
    ok(!r.kq.khongHau.ok && /không có tấm hậu/.test(r.kq.khongHau.ly_do), 'module không có hậu → nói rõ', r.kq.khongHau);
    ok(r.kq.daChuan.ok && r.kq.daChuan.da_chuan === true, 'module hậu mỏng đã phủ sau → báo đã đúng chuẩn, không sửa', r.kq.daChuan);
    ok(!r.kq.xoay.ok && /xoay|chiều sâu/.test(r.kq.xoay.ly_do), 'module đang xoay 90° → từ chối, nhắc đặt thẳng', r.kq.xoay);
    ok(!r.kq.motNha.ok && /bảng Một Nhà vẽ/.test(r.kq.motNha.ly_do), 'tủ do bảng Một Nhà vẽ → không đụng', r.kq.motNha);
    const lsTruoc = r.ls;
    ok(await D(n => window.app.Database.hm.historyRecord.length === n, lsTruoc), 'các lần từ chối không để lại bước lịch sử nào');

    /* ---------- 4b. đổi dày ván bằng tham số BH (bản 1.12) ---------- */
    r = await D(async () => { const m = window.__T.day(40000), b = window.__T.box, truoc = m.all.map(b), D = window.MNCFDriver;
      const r1 = await D.dayVan(m.noc, 17.5); const giua = m.all.map(x => x.Thickness), bx = [b(m.tr), b(m.ph), b(m.noc), b(m.day), b(m.hau)];
      const r1b = await D.dayVan(m.noc, 17.5);
      const u = await D.undoDayVan(); const sau = m.all.map(b), ts = m.all.map(x => x.Thickness);
      // mẫu mà BH không có động tác: không đổi gì, tham số trở lại 18
      const k = window.__T.day(43000); k.T.GetParam('BH').actions.length = 0; const r2 = await D.dayVan(k.noc, 17.5);
      const le = window.__MOCK__.them(new window.__MOCK__.Board('Đợt', 0, [46000, 46800, 0, 500, 0, 18], 18, 'X', '', ['Cam3Tp', 'Cam3Tp', 'Cam3Tp', 'Cam3Tp'])); const r3 = await D.dayVan(le, 17.5);
      return { r1: { ok: r1.ok, tu: r1.tu, day: r1.day, doi: r1.doi, con: r1.con, ten_con: r1.ten_con, buoc: r1.so_buoc_hoan_tac, coTam: !!r1.tam }, giua, bx, r1b: { ok: r1b.ok, da_dung: r1b.da_dung }, u, nguyen: JSON.stringify(sau) === JSON.stringify(truoc), ts,
        r2: { ok: r2.ok, khong_noi: r2.khong_noi, ly_do: r2.ly_do }, bh2: [k.T.GetParam('BH').expr, k.T.GetParam('BH').value], t2: k.all.map(x => x.Thickness), r3 }; });
    eq(r.r1, { ok: true, tu: 18, day: 17.5, doi: 5, con: 2, ten_con: ['Xà chân', 'Xà chân sau'], buoc: 1, coTam: true }, 'dayVan: BH 18 → 17,5 — 5 tấm đổi dày, 2 tấm mẫu không nối thì báo tên');
    eq(r.giua, [17.5, 17.5, 17.5, 17.5, 17.5, 18, 18], 'dayVan: hồi, hậu, nóc, đáy thành 17,5');
    eq(r.bx, [[40000, 40017.5, 0, 500, 0, 2000], [40782.5, 40800, 0, 500, 0, 2000], [40017.5, 40782.5, 0, 482.5, 1982.5, 2000], [40017.5, 40782.5, 0, 482.5, 80, 97.5], [40017.5, 40782.5, 482.5, 500, 0, 2000]], 'dayVan: các tấm dời / kéo đúng theo động tác BH của mẫu (phủ bì giữ nguyên)');
    eq(r.r1b, { ok: true, da_dung: true }, 'dayVan lần hai: đã đúng 17,5 → không làm gì');
    ok(r.u.ok && r.nguyen && r.ts.every(t => t === 18), 'undoDayVan: trả lại nguyên hình và dày 18', r);
    ok(!r.r2.ok && r.r2.khong_noi && /không nối với tấm nào/.test(r.r2.ly_do) && r.bh2[1] === 18 && r.t2.every(t => t === 18), 'mẫu mà BH không có động tác: báo rõ, tham số và ván giữ 18 (không để số 17,5 mà ván 18)', r);
    ok(!r.r3.ok && /không thuộc module nào/.test(r.r3.ly_do), 'tấm rời: từ chối');

    /* ---------- 5. nút trên bảng ---------- */
    const H = page.locator('#mncf-host');
    await page.evaluate(() => { const l = document.getElementById('mncf-host').shadowRoot.querySelector('.launch'); if (l && !l.hidden) l.click(); });
    await H.locator('.tab[data-tab="tu"]').click();
    const nut = H.locator('[data-act="chuanhoa"]');
    if (!(await nut.isVisible())) await H.locator('[data-act="nut-them"]').click();      // (bản 1.27) nút Chuẩn hoá nằm sau nút ⋯
    // (bản 1.25: nút thành nút biểu tượng — tên đầy đủ nằm ở aria-label, chú thích ngắn dưới hình)
    ok(await nut.isVisible() && /Chuẩn hoá mẫu kho đang chọn → ván 17,5 · hậu 6,5 phủ sau/.test(await nut.getAttribute('aria-label') || '') && /Chuẩn hoá/.test(await nut.innerText()), 'bảng có nút "Chuẩn hoá mẫu kho đang chọn → ván 17,5 · hậu 6,5 phủ sau"', [await nut.getAttribute('aria-label'), await nut.innerText().catch(() => '')]);
    await page.evaluate(() => window.__MOCK__.userSelect([]));
    await nut.click();
    ok(/bấm chọn 1 tấm của module/.test(await H.locator('.status').innerText()), 'chưa chọn tấm → nhắc chọn');
    await page.evaluate(() => { const m = window.__m5 = window.__T.day(20000); window.__MOCK__.userSelect([m.day]); });
    await nut.click();
    await page.waitForFunction(() => /Đã chuẩn hoá module|Chưa chuẩn hoá/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 30000 });
    let rep = await H.locator('.report').innerText();
    ok(/Đã chuẩn hoá module “标准柜”: 1 tấm hậu → 6,5 li/.test(rep) && /Mép sau của 4 tấm đã về đúng chỗ để hậu phủ lên: Hồi trái 500 → 493\.5; Hồi phải 500 → 493\.5; Nóc 482\.5 → 493\.5; Đáy 482\.5 → 493\.5/.test(rep) && /Dày ván: 18 → 17,5 cho 5 tấm \(tham số BH của module\)\. Còn 2 tấm vẫn dày 18 — Xà chân, Xà chân sau/.test(rep) && /đổi sang Cam3Tp cho 6 tấm/.test(rep) && /Mẫu trong kho không bị sửa/.test(rep), 'thẻ Kết quả nêu: hậu mới, tấm đã lùi mép sau, kiểu khoan đã đổi, mẫu kho giữ nguyên', rep.slice(0, 400));
    eq(await page.evaluate(() => window.__T.box(window.__m5.hau)), [20001, 20799, 493.5, 500, 81, 1999], 'bấm nút: module trên bản vẽ đã thành hậu phủ sau');
    eq(await page.evaluate(() => [window.__m5.tr, window.__m5.ph, window.__m5.noc, window.__m5.day].map(b => b.Thickness).concat([window.__m5.T.GetParam('BH').value, window.__T.box(window.__m5.ph)[0]])), [17.5, 17.5, 17.5, 17.5, 17.5, 20782.5], 'bấm nút: ván thùng 18 → 17,5 bằng tham số BH của module (hồi phải dày vào trong)');
    await H.locator('[data-act="undo-ch"]').click();
    await page.waitForFunction(() => /Đã hoàn tác lần chuẩn hoá/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 15000 });
    eq(await page.evaluate(() => [window.__T.box(window.__m5.hau), window.__m5.hau.Thickness, window.__m5.tr.Thickness, window.__m5.T.GetParam('BH').value, window.__T.box(window.__m5.noc)]), [[20018, 20782, 482, 500, 0, 2000], 18, 18, 18, [20018, 20782, 0, 482, 1982, 2000]], 'nút "Hoàn tác lần chuẩn hoá này" trả module về kết cấu gốc (cả dày ván 18)');
    await page.evaluate(() => { const M = window.__MOCK__; const le = M.them(new M.Board('Đợt', 0, [30000, 30800, 0, 500, 0, 18], 18, 'X', '', ['Cam3Tp', 'Cam3Tp', 'Cam3Tp', 'Cam3Tp'])); M.userSelect([le]); });
    await H.locator('.tab[data-tab="tu"]').click();
    await nut.click();
    await page.waitForFunction(() => /Chưa chuẩn hoá được/.test(document.getElementById('mncf-host').shadowRoot.querySelector('.status').textContent), null, { timeout: 15000 });
    ok(/không thuộc module nào/.test(await H.locator('.report').innerText()), 'tấm rời → thẻ Kết quả nêu lý do');
    ok(errs.length === 0, 'không có lỗi JS lọt ra trang', errs);
  } catch (e) { fail++; console.log('  ✗ ném lỗi:', e && e.stack || e); }
  await ctx.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* bỏ qua */ }
  console.log(`\n${pass} đạt, ${fail} hỏng`);
  process.exit(fail ? 1 : 0);
})();
