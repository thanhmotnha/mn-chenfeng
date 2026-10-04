'use strict';
// Đổ màu (bản 1.21) — phần HÀM THUẦN (Node, không cần thư viện):  node test/mau.test.js
// Chia tấm của một tủ thành nhóm màu (thùng / mặt = cánh + phào / hậu) theo tên tấm + hình học, lọc danh sách màu khi tìm, gom màu đang dùng.
// Phần đọc kho vật liệu của tài khoản + gán màu trên trang giả lập: test/mau-ui.test.js
const C = require('../src/mncf-core.js');
let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) { pass++; } else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); } };
const eq = (a, b, name) => ok(JSON.stringify(a) === JSON.stringify(b), name, { got: a, want: b });
const T = (name, fn) => { const f0 = fail; try { fn(); } catch (e) { fail++; console.log('  ✗', name, '— ném lỗi:', e.message); } console.log((fail === f0 ? '✓ ' : '✗ ') + name); };
const nhom = ds => C.nhomMau(ds.map(t => (typeof t === 'string' ? { ten: t } : t)));

T('Tủ do bảng vẽ: thùng một nhóm, cánh + phào + xà chân trước một nhóm, hậu một nhóm', () => {
  const ten = Object.values(C.DEFAULT_SPEC.ten_tam);
  const kq = nhom(ten), theo = {}; ten.forEach((t, i) => { (theo[kq[i]] = theo[kq[i]] || []).push(t); });
  eq(theo.mat, ['Chân trước', 'Phào trái', 'Phào phải', 'Phào trên', 'Cánh trái', 'Cánh phải'], 'mặt tủ: xà chân trước, 3 phào, 2 cánh');
  eq(theo.hau, ['Hậu'], 'hậu');
  eq(theo.thung, ['Hồi trái', 'Hồi phải', 'Vách', 'Đáy', 'Nóc', 'Đợt', 'Phụ trợ phào', 'Vách đệm ngăn kéo', 'Xà ngăn kéo', 'Nẹp che khe ngăn kéo', 'Vách khấu cột', 'Hậu khấu cột'],
    'thùng: phần còn lại — kể cả phụ trợ phào (nằm khuất sau phào), nẹp che khe ngăn kéo, vách / hậu khấu cột (ván thùng)');
});

T('Mẫu kho: tên đã dịch sang tiếng Việt và tên gốc tiếng Trung đều nhận đúng nhóm', () => {
  const mat = ['Cánh mở trái', 'Cánh mở phải', 'Cánh lật lên', 'Cánh giả', 'Cánh', '左开门板', '门板', '假门', 'Phào đỉnh', '顶线', 'Diềm trên', 'Cột La Mã', 'Xà chân trước', 'Xà chân', '踢脚板',
    'Tấm ốp', '见光板', 'Nẹp bù trái', '左收口', 'Nẹp', 'Nẹp (收口条)', 'Tấm bịt', 'Lam', 'Lam (格栅板)', 'Tấm trang trí', 'Tấm ốp tường', 'Mặt bàn', 'Mặt ngăn kéo', '抽面板'];
  eq(nhom(mat).filter(n => n !== 'mat'), [], 'phần nhìn thấy ở mặt tủ');
  const thung = ['Hồi', '左侧板', 'Vách ngăn', 'Đợt cố định', 'Đợt rời', '层板', 'Xà chân sau', '后地脚', 'Xà trước', 'Thanh giằng', 'Thanh chèn', 'Tấm đệm', 'Thành ngăn kéo', '抽侧板', 'Hậu ngăn kéo', '抽背板', 'Đáy ngăn kéo', '抽底板', 'Trước ngăn kéo', 'Kệ', 'Nẹp che khe ngăn kéo', 'Tấm lạ không rõ tên', ''];
  eq(nhom(thung).filter(n => n !== 'thung'), [], 'phần thùng — hộp ngăn kéo (kể cả "hậu ngăn kéo") là thùng; tên lạ cũng xếp vào thùng');
  eq(nhom(['Hậu', 'Hậu mỏng', 'Hậu dày', '背板', '薄背板']), ['hau', 'hau', 'hau', 'hau', 'hau'], 'hậu');
});

T('Mặt ngăn kéo nằm SAU cánh (ngăn kéo âm) theo màu thùng; mặt ngăn kéo lộ ra mặt tủ theo màu cánh', () => {
  // hộp = [x0, x1, y0, y1, z0, z1]; mặt tủ ở phía y nhỏ. Cánh dày 18 phủ khoang trái x 0…500; khoang phải 500…1000 không có cánh
  const canh = { ten: 'Cánh trái', hop: [0, 500, -20, -2, 0, 2000], he: 0 };
  const matAm = { ten: '抽面板', hop: [70, 430, 20, 38, 300, 480], he: 0 };            // trong lòng tủ, sau cánh
  const matLo = { ten: 'Mặt ngăn kéo', hop: [502, 998, -20, -2, 300, 480], he: 0 };   // ngăn kéo trùm ngoài ở khoang không cánh
  eq(nhom([canh, matAm, matLo]), ['mat', 'thung', 'mat'], 'sau cánh → thùng; lộ ngoài → mặt');
  eq(nhom([matAm]), ['mat'], 'tủ không có cánh nào: mặt ngăn kéo là mặt tủ');
  // cánh chỉ che một góc nhỏ của mặt ngăn kéo (dưới nửa diện tích): vẫn coi là lộ
  eq(nhom([{ ten: 'Cánh trái', hop: [0, 120, -20, -2, 0, 2000], he: 0 }, matAm]), ['mat', 'mat'], 'cánh che 50 / 360 bề ngang: mặt ngăn kéo vẫn lộ');
  // cánh của tủ khác hướng (nhóm hướng khác) không được tính
  eq(nhom([Object.assign({}, canh, { he: 1 }), matAm]), ['mat', 'mat'], 'cánh khác nhóm hướng: không so');
  // cánh hông (trục dày khác trục dày của mặt ngăn kéo) không che mặt ngăn kéo
  eq(nhom([{ ten: 'Cánh', hop: [-20, -2, 0, 500, 0, 2000], he: 0 }, matAm]), ['mat', 'mat'], 'cánh nằm ở mặt hông: không che');
  // không đọc được hộp của mặt ngăn kéo (tấm nghiêng): chỉ theo tên
  eq(nhom([canh, { ten: '抽面板' }]), ['mat', 'mat'], 'không có hộp: theo tên');
});

T('Tìm màu: lọc theo mã (không phân biệt hoa thường, bỏ qua dấu cách / gạch), theo nhóm; khớp đầu mã xếp trước', () => {
  const ds = [{ id: '1', ten: '388EV', nhom: 'MDF' }, { id: '2', ten: 'LUX 279-PRL', nhom: 'ACRYLIC' }, { id: '3', ten: '103T', nhom: 'MDF' }, { id: '4', ten: 'MS 103', nhom: 'MDF' }, { id: '5', ten: '1038SH', nhom: 'ACRYLIC' }];
  eq(C.locMau(ds, '').map(m => m.id), ['1', '2', '3', '4', '5'], 'không gõ gì: giữ nguyên thứ tự kho');
  eq(C.locMau(ds, '103').map(m => m.id), ['3', '5', '4'], 'gõ 103: mã bắt đầu bằng 103 trước (theo thứ tự kho), mã chứa 103 sau');
  eq(C.locMau(ds, 'lux279').map(m => m.id), ['2'], 'bỏ qua hoa thường, dấu cách, gạch nối');
  eq(C.locMau(ds, '103', 'ACRYLIC').map(m => m.id), ['5'], 'lọc thêm theo nhóm');
  eq(C.locMau(ds, '', 'MDF').map(m => m.id), ['1', '3', '4'], 'chỉ lọc nhóm');
  eq(C.locMau(ds, 'zzz'), [], 'không khớp: rỗng');
});

console.log(`\nmau.test: ${pass} đạt, ${fail} hỏng`);
process.exit(fail ? 1 : 0);
