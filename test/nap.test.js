'use strict';
// Kiểm tra BỘ NẠP của tiện ích (src/mncf-nap.js → dist/extension/nap.js): tự lấy bản mới từ kho GitHub, cất vào máy, dự phòng khi mất mạng.
//   NODE_PATH=<node_modules có playwright> PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node test/nap.test.js
// thẻ nằm sau nút ⚙ (bản 1.27 — Màu, Chuẩn xưởng, Hướng dẫn): hàng thẻ phụ chưa mở thì bấm ⚙ trước rồi mới bấm thẻ
const theSau = async (H, t) => { const tab = H.locator('.tab[data-tab="' + t + '"]'); if (!(await tab.isVisible())) await H.locator('[data-act="the-them"]').click(); await tab.click(); };
const path = require('path'), fs = require('fs'), os = require('os'), crypto = require('crypto');
const { chromium } = require('playwright');
const EXT = path.join(__dirname, '..', 'dist', 'extension');
const MOCK = fs.readFileSync(path.join(__dirname, 'mock-chenfeng.html'), 'utf8');
const BAN = fs.readFileSync(path.join(__dirname, '..', 'dist', 'mn-chenfeng.js'), 'utf8');
const TT = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'dist', 'phien-ban.json'), 'utf8'));
const V = TT.phien_ban;
let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) pass++; else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); } };
const sha = s => crypto.createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex');
const doiBan = v => BAN.split("VERSION = '" + V + "'").join("VERSION = '" + v + "'");      // "bản mới" giả: chỉ khác số phiên bản

async function mo(kho) {       // kho = { raw: {tt, ban} | null, jsd: {tt, ban} | null } — null = nguồn chết
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mncf-nap-'));
  const ctx = await chromium.launchPersistentContext(dir, { channel: 'chromium', headless: true, viewport: { width: 1400, height: 900 }, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  const dem = { raw_tt: 0, raw_ban: 0, raw_sx: 0, jsd_tt: 0, jsd_ban: 0, jsd_sx: 0 };
  const phucVu = (ten, re) => ctx.route(re, async r => { const n = new URL(r.request().url()).pathname.split('/').pop(), k = kho[ten];
    if (!k) return r.abort('failed');
    const h = { 'access-control-allow-origin': '*' };
    if (n === 'phien-ban.json') { dem[ten + '_tt']++; if (kho.tre_tt) await new Promise(x => setTimeout(x, kho.tre_tt)); return r.fulfill({ status: 200, contentType: 'application/json', headers: h, body: JSON.stringify(k.tt) }).catch(() => {}); }
    if (n === 'mn-chenfeng.js') { dem[ten + '_ban']++; return r.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', headers: h, body: k.ban }); }
    if (n === 'mn-chenfeng-sx.js' && k.sx) { dem[ten + '_sx']++; return r.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', headers: h, body: k.sx }); }
    return r.fulfill({ status: 404, body: '' }); });
  await phucVu('raw', /^https:\/\/raw\.githubusercontent\.com\//); await phucVu('jsd', /^https:\/\/cdn\.jsdelivr\.net\//);
  await ctx.route('https://api.cfcad.cn/**', r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': 'https://cfcad.cn', 'access-control-allow-credentials': 'true' }, body: '{"err_code":1,"err_msg":"no"}' }));
  await ctx.route('https://cfcad.cn/**', r => new URL(r.request().url()).pathname.startsWith('/help') ? r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>help</title><p>trợ giúp</p>' }) : r.fulfill({ contentType: 'text/html; charset=utf-8', body: MOCK }));
  await ctx.route('https://sc.leye.site/**', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><meta charset="utf-8"><title>晨丰生产管理系统</title><div id="app"></div>' }));      // trang sản xuất giả (trống): chỉ để xem bộ nạp làm gì ở đó
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  // mở / tải lại trang sản xuất, chờ bộ nạp làm xong cả phần cập nhật ngầm
  const taiSX = async () => { if (page.url().startsWith('https://sc.leye.site')) await page.reload(); else await page.goto('https://sc.leye.site/#/cadSingleAdd?stamp=1&type=single&fileName=x');
    await page.waitForFunction(() => window.__MNCF_NAP__ && window.__MNCF_NAP__.cho, null, { timeout: 15000 }); await page.evaluate(() => window.__MNCF_NAP__.cho);
    return page.evaluate(() => ({ v: window.MNCF_SX && window.MNCF_SX.version, bang: typeof window.MNCF, n: { nguon: window.__MNCF_NAP__.nguon, pb: window.__MNCF_NAP__.phien_ban, xong: window.__MNCF_NAP__.xong, sau: window.__MNCF_NAP__.cho_lan_sau || '', ghi: window.__MNCF_NAP__.ghi } })); };
  const tai = async () => { if (page.url().startsWith('https://cfcad.cn')) await page.reload(); else await page.goto('https://cfcad.cn/');
    await page.waitForFunction(() => window.__MNCF_NAP__ && (window.__MNCF_NAP__.xong || window.__MNCF_NAP__.het) && !window.__MNCF_NAP__.dang_cat, null, { timeout: 30000 }).catch(() => {});      // chờ cả việc cất bản vào máy (tải lại trang sớm quá thì lần sau phải tải lại)
    return page.evaluate(() => ({ v: window.MNCF && window.MNCF.version, app: !!(window.MNCF && window.MNCF.app), n: window.__MNCF_NAP__ && { nguon: window.__MNCF_NAP__.nguon, pb: window.__MNCF_NAP__.phien_ban, xong: window.__MNCF_NAP__.xong, ghi: window.__MNCF_NAP__.ghi } })); };
  return { ctx, page, dem, errs, tai, taiSX, kho };
}
const banMoi = v => { const ban = doiBan(v); return { tt: { phien_ban: v, sha256: sha(ban) }, ban }; };
const GOC = { tt: { phien_ban: V, sha256: sha(BAN) }, ban: BAN };

(async () => {
  ok(TT.sha256 === sha(BAN) && TT.kich_thuoc === Buffer.byteLength(BAN), 'dist/phien-ban.json khớp mã kiểm và cỡ của dist/mn-chenfeng.js', TT);
  const man = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  ok(JSON.stringify(man.content_scripts[0].js) === '["du-phong.js","nap.js"]' && man.content_scripts[0].world === 'MAIN' && !fs.existsSync(path.join(EXT, 'mn-chenfeng.js')), 'tiện ích = bản dự phòng + bộ nạp (world MAIN), không còn chạy thẳng bản gộp', man.content_scripts[0]);
  ok(doiBan('9.9.9') !== BAN && /VERSION = '9\.9\.9'/.test(doiBan('9.9.9')), 'tạo được "bản mới" giả để thử');

  /* --- 1. máy mới, có mạng → tải từ GitHub, cất vào máy --- */
  let T = await mo({ raw: GOC, jsd: GOC });
  try {
    let r = await T.tai();
    ok(r.v === V && r.n.xong && /vừa tải từ GitHub/.test(r.n.nguon), 'lần đầu: tải bản từ GitHub và chạy', r);
    ok(T.dem.raw_tt === 1 && T.dem.raw_ban === 1 && T.dem.jsd_tt === 0, 'chỉ hỏi GitHub, không đụng nguồn phụ', T.dem);
    await T.page.waitForFunction(() => window.MNCF && window.MNCF.app, null, { timeout: 15000 });
    ok(await T.page.locator('#mncf-host .launch').isVisible(), 'bảng Một Nhà hiện như cũ (nút mở bảng)');
    /* --- 2. tải lại, kho không đổi → chạy bản đã cất, không tải lại 490 KB --- */
    r = await T.tai();
    ok(r.v === V && /đã cất trong máy/.test(r.n.nguon) && T.dem.raw_ban === 1 && T.dem.raw_tt === 2, 'tải lại trang: kho không đổi → chạy bản đã cất, không tải lại bản gộp', [r.n, T.dem]);
    /* --- 3. kho có bản mới → F5 là có --- */
    T.kho.raw = banMoi('9.9.9');
    const kt = await T.page.evaluate(() => window.__MNCF_NAP__.kiemTra());
    ok(kt.ok && kt.co_moi && kt.phien_ban === '9.9.9' && kt.dang_chay === V, '"Kiểm tra bản mới" thấy bản 9.9.9 trên kho', kt);
    r = await T.tai();
    ok(r.v === '9.9.9' && /vừa tải từ GitHub/.test(r.n.nguon) && T.dem.raw_ban === 2, 'kho có bản mới → F5 là chạy bản mới', [r, T.dem]);
    const kt2 = await T.page.evaluate(() => window.__MNCF_NAP__.kiemTra());
    ok(kt2.ok && !kt2.co_moi, 'đang ở bản mới nhất → "Kiểm tra bản mới" báo không có gì mới', kt2);
    /* --- 4. kho cập nhật dở: phien-ban.json đã mới nhưng bản gộp còn cũ → không chạy mã lệch mã kiểm, giữ bản đang có --- */
    const m2 = banMoi('9.9.10'); T.kho.raw = { tt: m2.tt, ban: doiBan('9.9.9') }; T.kho.jsd = null;
    r = await T.tai();
    ok(r.v === '9.9.9' && /đã cất trong máy \(không vào được kho\)/.test(r.n.nguon) && r.n.ghi.some(g => /không khớp mã kiểm/.test(g)), 'bản tải về lệch mã kiểm → bỏ, chạy bản đã cất', r);
    /* --- 5. GitHub chết, nguồn phụ jsDelivr có bản mới hơn → lấy ở nguồn phụ --- */
    T.kho.raw = null; T.kho.jsd = m2;
    r = await T.tai();
    ok(r.v === '9.9.10' && /vừa tải từ jsDelivr/.test(r.n.nguon), 'GitHub không vào được → lấy bản mới ở jsDelivr', r);
    /* --- 6. nguồn phụ đang giữ bản CŨ hơn bản trong máy → không lùi bản --- */
    T.kho.jsd = banMoi('9.9.9'); const d0 = T.dem.jsd_ban;
    r = await T.tai();
    ok(r.v === '9.9.10' && T.dem.jsd_ban === d0 && r.n.ghi.some(g => /cũ hơn/.test(g)), 'nguồn phụ giữ bản cũ hơn → không lùi bản, chạy bản đã cất', [r, T.dem]);
    /* --- 7. mất mạng hẳn → vẫn chạy bản đã cất --- */
    T.kho.jsd = null;
    r = await T.tai();
    ok(r.v === '9.9.10' && /đã cất trong máy \(không vào được kho\)/.test(r.n.nguon) && r.app !== undefined, 'không vào được kho nào → chạy bản đã cất', r);
    const kt3 = await T.page.evaluate(() => window.__MNCF_NAP__.kiemTra());
    ok(kt3.ok === false && kt3.co_moi === false, 'mất mạng: "Kiểm tra bản mới" báo không vào được kho, không báo nhầm', kt3);
    /* --- 8. thẻ Hướng dẫn có khung "Cập nhật tự động" --- */
    T.kho.raw = banMoi('9.9.11');
    await T.page.waitForFunction(() => window.MNCF && window.MNCF.app, null, { timeout: 15000 });
    const H = T.page.locator('#mncf-host'); await H.locator('.launch').click(); await theSau(H, 'hd');
    const kh = await H.locator('fieldset', { hasText: 'Cập nhật tự động' }).innerText();
    ok(/Đang chạy: v9\.9\.10/.test(kh) && /đã cất trong máy/.test(kh), 'thẻ Hướng dẫn ghi bản đang chạy và nguồn nạp', kh);
    await H.locator('[data-act="nap-kt"]').click();
    await T.page.waitForFunction(() => /Có bản mới v9\.9\.11/.test(document.querySelector('#mncf-host').shadowRoot ? document.querySelector('#mncf-host').shadowRoot.textContent : document.querySelector('#mncf-host').textContent), null, { timeout: 8000 }).then(() => ok(true, 'nút "Kiểm tra bản mới" báo có v9.9.11, nhắc F5'), () => ok(false, 'nút "Kiểm tra bản mới" báo có v9.9.11, nhắc F5'));
    /* --- 9. trang /help không nạp --- */
    await T.page.goto('https://cfcad.cn/help/'); await T.page.waitForTimeout(800);
    ok(await T.page.evaluate(() => !window.__MNCF_NAP__ && !window.MNCF), 'trang trợ giúp /help: bộ nạp không chạy');
    ok(T.errs.length === 0, 'không có lỗi JS lọt ra trang', T.errs);
  } finally { await T.ctx.close(); }

  /* --- 10. máy mới, không vào được kho nào → chạy bản kèm sẵn trong tiện ích --- */
  T = await mo({ raw: null, jsd: null });
  try {
    const r = await T.tai();
    ok(r.v === V && r.n.xong && /bản kèm tiện ích/.test(r.n.nguon), 'máy mới + mất mạng: chạy bản kèm tiện ích', r);
    await T.page.waitForFunction(() => window.MNCF && window.MNCF.app, null, { timeout: 15000 });
    ok(await T.page.locator('#mncf-host .launch').isVisible() && T.errs.length === 0, 'bản kèm tiện ích dựng được bảng, không lỗi', T.errs);
    /* --- 11. có mạng lại, kho trùng bản kèm → tải một lần để cất, lần sau dùng bản cất --- */
    T.kho.raw = GOC;
    let r2 = await T.tai();
    ok(r2.v === V && /vừa tải từ GitHub/.test(r2.n.nguon), 'có mạng lại → lấy bản từ kho', r2);
    r2 = await T.tai();
    ok(/đã cất trong máy, đối chiếu với GitHub/.test(r2.n.nguon) && T.dem.raw_ban === 1, 'lần sau chạy bản đã cất', [r2.n, T.dem]);
    /* --- 12. phien-ban.json hỏng dạng → coi như nguồn lỗi, không chạy mã lạ --- */
    T.kho.raw = { tt: { phien_ban: '99.0.0', sha256: 'khong-phai-ma-kiem' }, ban: 'window.__HONG__ = 1;' };
    r2 = await T.tai();
    ok(r2.v === V && await T.page.evaluate(() => window.__HONG__ === undefined) && r2.n.ghi.some(g => /sai dạng/.test(g)), 'phien-ban.json sai dạng → bỏ nguồn đó, không chạy mã của nó', r2);
    /* --- 13. kho bị thay mã mà mã kiểm không khớp → không chạy --- */
    T.kho.raw = { tt: { phien_ban: '99.0.0', sha256: sha('khác') }, ban: 'window.__HONG__ = 1;' };
    r2 = await T.tai();
    ok(r2.v === V && await T.page.evaluate(() => window.__HONG__ === undefined), 'bản gộp không khớp mã kiểm → không chạy', r2);
    /* --- 14. bản mới trên kho bị lỗi cú pháp (mã kiểm đúng) → rơi về bản đã cất --- */
    const hong = 'window.__HONG2__ = 1; }{ lỗi cú pháp'; T.kho.raw = { tt: { phien_ban: '99.0.1', sha256: sha(hong) }, ban: hong };
    r2 = await T.tai();
    ok(r2.v === V && /đã cất trong máy|bản kèm tiện ích/.test(r2.n.nguon) && r2.n.ghi.some(g => /lỗi/.test(g)), 'bản mới hỏng cú pháp → chạy bản đã cất, bảng vẫn dùng được', r2);
    const nho = await T.page.evaluate(() => new Promise(res => { const q = indexedDB.open('mncf_nap'); q.onsuccess = () => { const g = q.result.transaction('ban').objectStore('ban').get('moi'); g.onsuccess = () => res(g.result && g.result.phien_ban); }; }));
    ok(nho === V, 'bản hỏng không được cất đè lên bản tốt', nho);
  } finally { await T.ctx.close(); }

  /* ===== bản 1.22 — TRANG SẢN XUẤT (sc.leye.site): bộ nạp chạy NGAY bản trợ lý đang có (không chờ mạng), cập nhật ngầm để lần mở trang sau dùng ===== */
  const SXBAN = fs.readFileSync(path.join(__dirname, '..', 'dist', 'mn-chenfeng-sx.js'), 'utf8');
  const doiSX = v => SXBAN.split('__MNCF_SX_PB__ = "' + V + '"').join('__MNCF_SX_PB__ = "' + v + '"');
  const khoSX = (v, sx) => ({ tt: { phien_ban: v, sha256: sha(BAN), sx: { sha256: sha(sx) } }, ban: BAN, sx });
  ok(TT.sx && TT.sx.sha256 === sha(SXBAN) && TT.sx.kich_thuoc === Buffer.byteLength(SXBAN), 'dist/phien-ban.json có mục sx khớp mã kiểm và cỡ của dist/mn-chenfeng-sx.js', TT.sx);
  ok(doiSX('9.9.9') !== SXBAN && SXBAN.length < 40000, 'bản trợ lý nhỏ (dưới 40 KB), tạo được "bản mới" giả', SXBAN.length);
  { const cs = man.content_scripts[1] || {};
    ok(JSON.stringify(cs.matches) === '["https://sc.leye.site/*"]' && JSON.stringify(cs.js) === '["du-phong-sx.js","nap.js"]' && cs.world === 'MAIN' && cs.run_at === 'document_start' && !cs.all_frames, 'manifest: trang sản xuất nạp bản dự phòng của trợ lý + bộ nạp, từ đầu trang, chỉ khung trên cùng', cs);
    ok(JSON.stringify(man.content_scripts[0].js) === '["du-phong.js","nap.js"]' && !man.content_scripts[0].matches.some(m => /leye/.test(m)), 'manifest: trang CAD vẫn nạp như cũ'); }
  T = await mo({ raw: khoSX(V, SXBAN), jsd: null });
  try {
    /* S1. lần đầu: chạy ngay bản kèm tiện ích; kho trùng bản đó → không tải gì thêm; không nạp bảng vẽ tủ ở trang sản xuất */
    T.kho.tre_tt = 1500;                                                     // kho trả lời chậm 1,5 giây
    await T.page.goto('https://sc.leye.site/#/cadSingleAdd?stamp=1&type=single&fileName=x');
    await T.page.waitForFunction(() => window.MNCF_SX, null, { timeout: 1000 }).then(() => ok(true, 'trợ lý có ngay khi trang vừa mở, không chờ kho trả lời'), () => ok(false, 'trợ lý có ngay khi trang vừa mở, không chờ kho trả lời'));
    ok(T.dem.raw_tt <= 1 && (await T.page.evaluate(() => window.__MNCF_NAP__.xong === true)), 'lúc đó kho còn chưa trả lời xong');
    T.kho.tre_tt = 0;
    let r = await T.taiSX();
    ok(r.v === V && /bản kèm tiện ích/.test(r.n.nguon) && r.bang === 'undefined', 'trang sản xuất: chạy trợ lý (bản kèm tiện ích), không nạp bảng vẽ tủ', r);
    ok(T.dem.raw_sx === 0 && T.dem.raw_ban === 0, 'kho trùng bản đang có: không tải lại, không đụng bản gộp của bảng', T.dem);
    ok(await T.page.evaluate(() => window.__MNCF_NAP__.ban_nap === 2), 'bộ nạp bản 2');
    /* S2. kho có bản trợ lý mới: lần này vẫn chạy bản đang có, tải ngầm + cất; lần mở sau chạy bản mới */
    T.kho.raw = khoSX('9.9.9', doiSX('9.9.9'));
    r = await T.taiSX();
    ok(r.v === V && r.n.sau === '9.9.9' && T.dem.raw_sx === 1, 'kho có bản mới: lần này vẫn chạy bản cũ, bản mới được tải ngầm và cất', [r, T.dem]);
    r = await T.taiSX();
    ok(r.v === '9.9.9' && /đã cất trong máy/.test(r.n.nguon) && T.dem.raw_sx === 1, 'lần mở trang sau: chạy bản mới từ bộ nhớ máy, không tải lại', [r, T.dem]);
    /* S3. mất mạng: vẫn chạy bản đã cất */
    T.kho.raw = null;
    r = await T.taiSX();
    ok(r.v === '9.9.9' && r.n.xong, 'không vào được kho: trợ lý vẫn chạy bản đã cất', r);
    /* S4. bản trên kho lệch mã kiểm: không cất */
    T.kho.raw = { tt: { phien_ban: '9.9.10', sha256: sha(BAN), sx: { sha256: sha('khác') } }, ban: BAN, sx: 'window.__HONG_SX__ = 1;' };
    r = await T.taiSX(); r = await T.taiSX();
    ok(r.v === '9.9.9' && (await T.page.evaluate(() => window.__HONG_SX__ === undefined)) && r.n.ghi.some(g => /không khớp mã kiểm/.test(g)), 'bản trợ lý lệch mã kiểm: không cất, không chạy', r);
    /* S5. kho kiểu cũ (phien-ban.json chưa có mục sx): không lỗi, giữ bản đang có */
    T.kho.raw = { tt: { phien_ban: '9.9.11', sha256: sha(BAN) }, ban: BAN };
    r = await T.taiSX();
    ok(r.v === '9.9.9' && r.n.xong && T.errs.length === 0, 'kho chưa có mục sx: bỏ qua, không lỗi', [r, T.errs]);
    /* S6. kho giữ bản CŨ hơn bản đang có: không lùi */
    T.kho.raw = khoSX('9.9.8', doiSX('9.9.8')); const d1 = T.dem.raw_sx;
    r = await T.taiSX(); r = await T.taiSX();
    ok(r.v === '9.9.9' && T.dem.raw_sx === d1, 'kho giữ bản cũ hơn: không tải, không lùi bản', [r, T.dem]);
    /* S7. trang CAD: không có trợ lý; khung nhỏ sc.leye.site nằm trong trang CAD: bộ nạp không chạy trong khung */
    T.kho.raw = khoSX(V, SXBAN);
    await T.tai();
    ok(await T.page.evaluate(() => typeof window.MNCF_SX === 'undefined' && !!window.MNCF), 'trang CAD: có bảng vẽ tủ, không có trợ lý trang sản xuất');
    await T.page.evaluate(() => { const f = document.createElement('iframe'); f.id = 'khung-sx'; f.src = 'https://sc.leye.site/?stamp=1#/cadIndex'; document.body.appendChild(f); });
    await T.page.waitForFunction(() => { const f = document.getElementById('khung-sx'); return !!f; });
    const khung = await (async () => { for (let i = 0; i < 40; i++) { const f = T.page.frames().find(x => /^https:\/\/sc\.leye\.site/.test(x.url())); if (f) return f; await new Promise(k => setTimeout(k, 100)); } return null; })();
    await new Promise(k => setTimeout(k, 600));
    ok(khung && JSON.stringify(await khung.evaluate(() => [typeof window.MNCF_SX, typeof window.__MNCF_NAP__, typeof window.MNCF])) === '["undefined","undefined","undefined"]', 'khung "Order Splitting" trong trang CAD: tiện ích không nạp gì vào đó');
    ok(T.errs.length === 0, 'không có lỗi JS lọt ra trang (phần trang sản xuất)', T.errs);
  } finally { await T.ctx.close(); }

  console.log(`nap.test: ${pass} đạt, ${fail} hỏng`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
