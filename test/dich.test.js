'use strict';
// Kiểm tra bảng dịch ghi chú tham số mẫu (Node thuần):  node test/dich.test.js
const D = require('../src/mncf-dich.js');
let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) pass++; else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); } };
const eq = (a, b, name) => ok(a === b, name, { got: a, want: b });
const CJK = /[㐀-鿿]/;

// ghi chú hay gặp nhất trong kho mẫu của xưởng (749 mẫu, đếm ngày 2026-10-02) + ghi chú của các mẫu Chenfeng tự sinh
const THAT = ['宽', '高', '深', '板厚', '左右平移', '孔半径', '孔深', '左上右下移', '孔距边', '引孔深', '侧板孔距边', '门板孔间距', '门板孔距圆心', '右延伸', '左延伸', '侧板孔间距', '侧板孔左右移', '下延伸', '上延伸', '下留空', '拉手长', '上留空', '拉手高', '槽深', '槽宽', '背板厚', '脚线高', '槽长', '拉出', '上移', '拉手宽', '退后', '后移', '铰链长', '距上', '门缝', '轨道', '距下', '左缩', '右缩', '调整背板', '判断', '轨道宽', '缺口加大', '切角深', '圆弧半径', '距边', '门厚', '前缩', '右移', '拉位高', '拉位下留空', '切角宽', '内缩', '左间隙', '右间隙',
  '左前缩', '右前缩', '左后缩', '右后缩', '左上延伸', '左下延伸', '右上延伸', '右下延伸', '上预留间隙', '中预留间隙', '虚拟板件', '模板ID', '铰链模板', '盖板上延伸', '必须', '补板厚', '左右侧板模板', '层板(自动)'];
for (const s of THAT) { const v = D.dich(s); ok(v !== s && !CJK.test(v) && v[0] !== '~', 'có câu dịch sẵn: ' + s, v); }

// mọi câu dịch sẵn: không còn chữ Trung, không rỗng, viết hoa chữ đầu, không dài quá (cột ghi chú hẹp)
for (const [k, v] of Object.entries(D.CAU)) ok(typeof v === 'string' && v && !CJK.test(v) && v.length <= 36 && v[0] === v[0].toUpperCase(), 'câu dịch hợp lệ: ' + k, v);
ok(Object.keys(D.CAU).length >= 320, 'bảng dịch sẵn đủ lớn', Object.keys(D.CAU).length);

eq(D.dich('板厚'), 'Dày ván', '板厚');
eq(D.dich('左前缩'), 'Hồi trái lùi trước', '左前缩');
eq(D.dich(' 背板厚 '), 'Dày hậu', 'bỏ khoảng trắng đầu cuối');
// không phải tiếng Trung → giữ nguyên
for (const s of ['Rộng', 'L1', '', '*', '**', 'Depth 580']) eq(D.dich(s), s, 'giữ nguyên: ' + JSON.stringify(s));
ok(D.dich(undefined) === undefined && D.dich(null) === null && D.dich(12) === 12, 'không phải chuỗi → trả lại nguyên');
// ghép từ cho ghi chú lạ: có dấu ~, đúng trật tự tiếng Việt
eq(D.dich('右门内缩'), '~Cánh phải lùi vào', 'ghép: hướng đứng sau danh từ');
eq(D.dich('抽屉底板厚度'), '~Dày đáy ngăn kéo', 'ghép: số đo lên đầu, chuỗi danh từ đảo');
eq(D.dich('拉手高度参数'), '~Tham số cao tay nắm', 'ghép: "tham số" lên đầu');
eq(D.dich('上柜门高'), '~Cao cánh tủ trên', 'ghép: 上柜门高');
// còn chữ không biết → không đoán, để nguyên
eq(D.dich('未知字符串'), '未知字符串', 'chữ lạ → để nguyên tiếng Trung');
eq(D.dich('左边奇怪'), '左边奇怪', 'biết một nửa → vẫn để nguyên');

console.log(`\n${pass} đạt, ${fail} hỏng`);
process.exit(fail ? 1 : 0);
