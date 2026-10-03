'use strict';
// Kho GitHub GIẢ cho các bộ thử nạp tiện ích thật (dist/extension): bộ nạp của tiện ích hỏi raw.githubusercontent.com / cdn.jsdelivr.net để lấy bản gộp.
// Không chặn thì phép thử sẽ chạy BẢN ĐÃ PHÁT HÀNH trên mạng chứ không phải bản vừa dựng trong máy. Mọi bộ thử nạp tiện ích phải gọi khoGia(ctx).
const path = require('path'), fs = require('fs');
const DIST = path.join(__dirname, '..', 'dist');
module.exports = async function khoGia(ctx) {
  await ctx.route(/^https:\/\/(raw\.githubusercontent\.com|cdn\.jsdelivr\.net)\//, r => {
    const n = new URL(r.request().url()).pathname.split('/').pop(), f = path.join(DIST, n);
    return /^(phien-ban\.json|mn-chenfeng\.js)$/.test(n) && fs.existsSync(f)
      ? r.fulfill({ status: 200, contentType: n.endsWith('.json') ? 'application/json' : 'text/plain; charset=utf-8', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(f) })
      : r.fulfill({ status: 404, body: 'không có' });
  });
};
