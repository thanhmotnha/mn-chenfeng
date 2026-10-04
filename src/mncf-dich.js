/*!
 * mncf-dich.js — hiện GHI CHÚ tham số của mẫu / module Chenfeng bằng tiếng Việt.
 * Chỉ đổi chữ HIỂN THỊ ở cột "Ghi chú" (Remarks / 备注) của bảng tham số: bảng bên phải (模块参数) và bảng trong Kho mẫu (模块管理).
 * Không sửa bản vẽ, không sửa mẫu, không gửi gì lên máy chủ. Rê chuột vào ô để xem chữ gốc tiếng Trung.
 * Tắt: MNCF.dich.tat()  ·  bật lại: MNCF.dich.bat()   (ghi nhớ trong localStorage 'mncf.dich')
 */
(function (root) {
  'use strict';
  const LS = 'mncf.dich';
  const CJK = /[㐀-鿿]/;

  /* ---- 1. Câu dịch sẵn: ghi chú lấy từ 749 mẫu trong kho của xưởng + các mẫu Chenfeng tự sinh (bản 2026-09-29) + mẫu của cửa hàng Chenfeng (10/2026) ---- */
  const CAU = {
    '宽': 'Rộng', '高': 'Cao', '深': 'Sâu', '长': 'Dài', '板厚': 'Dày ván', '深度': 'Sâu', '半径': 'Bán kính', '圆弧': 'Cung tròn',
    // thùng
    '背板厚': 'Dày hậu', '底板厚': 'Dày đáy', '底板厚度': 'Dày đáy', '门厚': 'Dày cánh', '门板厚': 'Dày cánh', '芯板厚': 'Dày pa-nô', '补板厚': 'Dày tấm bù',
    '板厚参数': 'Tham số dày ván', '板最参数': 'Tham số dày ván', '手动板厚': 'Dày ván (nhập tay)', '手动厚度': 'Dày (nhập tay)', '板厚调整': 'Chỉnh dày ván',
    '调整背板': 'Chỉnh hậu', '板厚调整背板': 'Chỉnh hậu theo dày ván', '板厚调背板': 'Chỉnh hậu theo dày ván', '板最调整背板': 'Chỉnh hậu theo dày ván', '板最调背板': 'Chỉnh hậu theo dày ván',
    '脚线': 'Xà chân', '脚线高': 'Cao xà chân', '地脚线': 'Xà chân', '地脚高': 'Cao chân tủ', '底板高度': 'Cao đáy', '底板上升': 'Đáy nâng lên',
    '顶底包背': 'Nóc đáy bọc hậu', '顶包背': 'Nóc bọc hậu', '顶包左侧': 'Nóc phủ hồi trái', '顶包右侧': 'Nóc phủ hồi phải',
    '顶底内缩': 'Nóc đáy lùi vào', '顶底板内缩': 'Nóc đáy lùi vào', '顶底板内退': 'Nóc đáy lùi vào', '顶板内缩': 'Nóc lùi vào', '底板内缩': 'Đáy lùi vào',
    '顶板后缩': 'Nóc lùi sau', '顶板后延': 'Nóc kéo dài ra sau', '底板后延': 'Đáy kéo dài ra sau', '底后延': 'Đáy kéo dài ra sau', '背板上延伸': 'Hậu kéo dài lên',
    '左侧': 'Bên trái', '右侧': 'Bên phải', '左侧深': 'Sâu bên trái', '右侧深': 'Sâu bên phải', '侧宽': 'Rộng hông', '侧板深': 'Sâu hồi', '立板高': 'Cao vách',
    '左侧内缩': 'Hồi trái lùi vào', '右侧内缩': 'Hồi phải lùi vào', '左侧板内缩': 'Hồi trái lùi vào', '右侧板内缩': 'Hồi phải lùi vào', '左侧后缩': 'Hồi trái lùi sau', '右侧后缩': 'Hồi phải lùi sau',
    '左前缩': 'Hồi trái lùi trước', '右前缩': 'Hồi phải lùi trước', '左后缩': 'Hồi trái lùi sau', '右后缩': 'Hồi phải lùi sau',
    '左上延伸': 'Hồi trái kéo dài lên', '左下延伸': 'Hồi trái kéo dài xuống', '右上延伸': 'Hồi phải kéo dài lên', '右下延伸': 'Hồi phải kéo dài xuống',
    '上柜高': 'Cao tủ trên', '右柜宽': 'Rộng tủ phải', '右柜后缩': 'Tủ phải lùi sau', '左柜后缩': 'Tủ trái lùi sau', '下台面高': 'Cao mặt bàn dưới',
    '开放柜宽': 'Rộng tủ hở', '开放格宽': 'Rộng ô hở', '开格放宽': 'Rộng ô hở', '上层高': 'Cao tầng trên', '上1高': 'Cao tầng trên 1',
    '层板前缩': 'Đợt lùi trước', '层板居下': 'Đợt nằm dưới', '辅助板深': 'Sâu tấm phụ', '垫板宽': 'Rộng tấm đệm', '虚拟板件': 'Tấm ảo',
    // dịch chuyển, kéo dài, lùi
    '左右平移': 'Dịch trái–phải', '左右移动': 'Dịch trái–phải', '左上右下移': 'Dịch trái-lên / phải-xuống', '上移': 'Dịch lên', '后移': 'Dịch ra sau', '右移': 'Dịch phải', '左移': 'Dịch trái', '外移': 'Dịch ra ngoài',
    '左延伸': 'Kéo dài trái', '右延伸': 'Kéo dài phải', '上延伸': 'Kéo dài trên', '下延伸': 'Kéo dài dưới',
    '左缩': 'Lùi trái', '右缩': 'Lùi phải', '上缩': 'Lùi trên', '下缩': 'Lùi dưới', '前缩': 'Lùi trước', '后缩': 'Lùi sau', '内缩': 'Lùi vào trong', '左右缩': 'Lùi trái–phải', '退后': 'Lùi sau', '拉出': 'Kéo ra',
    '板左缩': 'Ván lùi trái', '板右缩': 'Ván lùi phải', '内缩值': 'Giá trị lùi vào', '前缩参数': 'Tham số lùi trước', '后缩参数': 'Tham số lùi sau',
    // hở, lọt lòng, khe
    '上留空': 'Hở trên', '下留空': 'Hở dưới', '底留空': 'Hở đáy', '前留空': 'Hở trước', '左右留空': 'Hở trái–phải', '底板下留空': 'Hở dưới đáy', '下层空': 'Trống tầng dưới',
    '左内空': 'Lọt lòng trái', '前内空': 'Lọt lòng trước', '上内空': 'Lọt lòng trên', '下内空': 'Lọt lòng dưới', '上层内空': 'Lọt lòng tầng trên', '下层内空': 'Lọt lòng tầng dưới', '上1内空': 'Lọt lòng trên 1',
    '后门内空': 'Lọt lòng sau cánh', '下门内空深': 'Sâu lọt lòng cánh dưới',
    '左间隙': 'Khe trái', '右间隙': 'Khe phải', '左右间隙': 'Khe trái–phải', '门缝': 'Khe cánh', '缝隙值': 'Giá trị khe', '减缝隙': 'Trừ khe',
    '上预留间隙': 'Khe chừa trên', '下预留间隙': 'Khe chừa dưới', '左预留间隙': 'Khe chừa trái', '右预留间隙': 'Khe chừa phải', '中预留间隙': 'Khe chừa giữa',
    '距上': 'Cách trên', '距下': 'Cách dưới', '距前': 'Cách trước', '距后': 'Cách sau', '距边': 'Cách mép', '边距': 'Cách mép', '下距': 'Cách dưới', '距顶板': 'Cách nóc', '距底板': 'Cách đáy',
    '靠左': 'Sát trái', '靠前': 'Sát trước', '靠顶': 'Sát nóc', '靠底': 'Sát đáy', '靠左参数': 'Tham số sát trái', '靠底参数': 'Tham số sát đáy', '靠下参数': 'Tham số sát dưới', '靠上参数': 'Tham số sát trên',
    '距离参数': 'Tham số khoảng cách', '减尺': 'Trừ kích thước', '下扣': 'Trừ dưới',
    // cánh, cửa lùa, tấm bịt
    '上盖': 'Phủ trên', '下盖': 'Phủ dưới', '左盖': 'Phủ trái', '右盖': 'Phủ phải', '左盖修正': 'Hiệu chỉnh phủ trái', '右盖修正': 'Hiệu chỉnh phủ phải',
    '盖板上延伸': 'Tấm phủ kéo dài trên', '盖板下延伸': 'Tấm phủ kéo dài dưới', '盖板左延伸': 'Tấm phủ kéo dài trái', '盖板右延伸': 'Tấm phủ kéo dài phải',
    '左门右移': 'Cánh trái dịch phải', '右门左移': 'Cánh phải dịch trái', '门板深': 'Sâu cánh', '下门高': 'Cao cánh dưới',
    '移门内缩': 'Cửa lùa lùi vào', '移门外移': 'Cửa lùa dịch ra ngoài', '滑轮高': 'Cao bánh xe', '镜子厚度': 'Dày gương',
    '边框': 'Khung viền', '边框宽': 'Rộng khung viền', '边高': 'Cao viền', '腰线高': 'Cao đai giữa', '腰线宽': 'Rộng đai giữa', '腰线上移': 'Đai giữa dịch lên',
    '封板宽': 'Rộng tấm bịt', '封板内退': 'Tấm bịt lùi vào', '左封板': 'Tấm bịt trái', '右封板': 'Tấm bịt phải', '顶封板': 'Tấm bịt trên',
    // lỗ khoan, bản lề
    '孔半径': 'Bán kính lỗ', '孔深': 'Sâu lỗ', '孔距': 'Khoảng cách lỗ', '孔距边': 'Lỗ cách mép', '打孔深度': 'Sâu khoan', '开孔深': 'Sâu lỗ khoét', '开孔边距': 'Lỗ khoét cách mép',
    '挖孔深度': 'Sâu lỗ khoét', '挖孔参数': 'Tham số lỗ khoét', '孔位前后缩': 'Lỗ lùi trước–sau', '孔上下距离': 'Khoảng cách lỗ trên–dưới', '孔靠下': 'Lỗ sát dưới', '孔靠上': 'Lỗ sát trên',
    '引孔深': 'Sâu lỗ mồi', '左引孔': 'Lỗ mồi trái', '右引孔': 'Lỗ mồi phải', '第一引孔': 'Lỗ mồi 1', '第二引孔': 'Lỗ mồi 2', '引孔前': 'Lỗ mồi trước', '引孔后': 'Lỗ mồi sau',
    '引孔1位置': 'Vị trí lỗ mồi 1', '引孔2位置': 'Vị trí lỗ mồi 2', '侧引孔前': 'Lỗ mồi hông phía trước', '侧引孔靠下': 'Lỗ mồi hông sát dưới',
    '侧板孔距边': 'Lỗ hồi cách mép', '侧板孔间距': 'Khoảng cách lỗ hồi', '侧板孔左右移': 'Lỗ hồi dịch trái–phải', '侧板孔深': 'Sâu lỗ hồi', '侧板孔深度': 'Sâu lỗ hồi', '侧板孔距下': 'Lỗ hồi cách dưới',
    '门板孔间距': 'Khoảng cách lỗ cánh', '门板孔距圆心': 'Lỗ cánh cách tâm chén', '门板孔深': 'Sâu lỗ cánh', '孔杯深度': 'Sâu chén bản lề', '铰链长': 'Dài bản lề',
    '预埋件半径': 'Bán kính ốc cấy', '预埋孔深度': 'Sâu lỗ ốc cấy',
    '前孔距前': 'Lỗ trước cách mép trước', '后孔距前': 'Lỗ sau cách mép trước', '前孔深度': 'Sâu lỗ trước', '后孔距下': 'Lỗ sau cách dưới',
    '侧孔后前孔距离': 'Khoảng cách lỗ hông trước–sau', '后板孔靠边': 'Lỗ tấm sau sát mép', '后板孔距下': 'Lỗ tấm sau cách dưới',
    // rãnh, cắt góc, khuyết, bo
    '槽深': 'Sâu rãnh', '槽宽': 'Rộng rãnh', '槽长': 'Dài rãnh', '槽深度': 'Sâu rãnh', '槽高度': 'Cao rãnh', '上槽宽': 'Rộng rãnh trên', '上槽深': 'Sâu rãnh trên', '槽总深': 'Tổng sâu rãnh',
    '切角深': 'Sâu cắt góc', '切角宽': 'Rộng cắt góc', '切角高': 'Cao cắt góc', '切口宽': 'Rộng vết cắt', '切口距左': 'Vết cắt cách trái', '左切': 'Cắt trái', '右切': 'Cắt phải', '深多切': 'Cắt thêm chiều sâu', '高多切': 'Cắt thêm chiều cao',
    '缺口加大': 'Nới rộng khuyết', '缺口深': 'Sâu khuyết', '缺宽': 'Rộng khuyết', '缺高': 'Cao khuyết', '缺左': 'Khuyết trái', '缺前右': 'Khuyết trước phải',
    '圆弧半径': 'Bán kính cung', '弧形半径': 'Bán kính cung', '圆半径': 'Bán kính tròn', '前外圆': 'Bo ngoài phía trước', '后内圆': 'Bo trong phía sau', '前宽': 'Rộng phía trước',
    // tay nắm
    '拉手长': 'Dài tay nắm', '拉手长度': 'Dài tay nắm', '拉手高': 'Cao tay nắm', '拉手宽': 'Rộng tay nắm', '拉手深': 'Sâu tay nắm', '把手参数': 'Tham số tay nắm',
    '拉手长参数': 'Tham số dài tay nắm', '拉手长度参数': 'Tham số dài tay nắm', '拉手靠上': 'Tay nắm sát trên', '拉手靠下': 'Tay nắm sát dưới',
    '左装拉手': 'Lắp tay nắm bên trái', '左装参数': 'Tham số lắp trái', '下装': 'Lắp dưới', '下装参数': 'Tham số lắp dưới',
    '拉位高': 'Cao hốc tay nắm', '拉位下留空': 'Hở dưới hốc tay nắm',
    // ngăn kéo, ray
    '轨道': 'Ray', '轨道宽': 'Rộng ray', '轨道宽度': 'Rộng ray', '轨道长': 'Dài ray', '轨道延后': 'Ray lùi sau', '轨道上延': 'Ray kéo dài lên', '导轨宽': 'Rộng ray', '导轨厚度': 'Dày ray',
    '抽盒高': 'Cao hộp ngăn kéo', '抽屉高': 'Cao ngăn kéo', '抽面高': 'Cao mặt ngăn kéo', '抽面厚': 'Dày mặt ngăn kéo', '抽底厚': 'Dày đáy ngăn kéo', '抽锁': 'Khoá ngăn kéo',
    '抽盒后退': 'Hộp ngăn kéo lùi sau', '抽屉底上提': 'Đáy ngăn kéo nâng lên', '抽侧下掉': 'Thành ngăn kéo hạ xuống', '抽屉深扣尺': 'Trừ sâu ngăn kéo', '抽帮上减尺': 'Trừ trên thành ngăn kéo',
    '前后抽堵缩减': 'Trừ tấm trước–sau ngăn kéo', '前后抽堵上缩减': 'Trừ trên tấm trước–sau ngăn kéo', '减高抽前后板': 'Giảm cao tấm trước–sau ngăn kéo',
    '抽侧板前孔距边': 'Lỗ trước thành ngăn kéo cách mép', '抽侧板前孔': 'Lỗ trước thành ngăn kéo', '抽侧板后孔': 'Lỗ sau thành ngăn kéo',
    '拉条高': 'Cao thanh giằng', '背条高': 'Cao thanh lưng', '衣杆扣长': 'Trừ dài suốt treo',
    // khác
    '判断': 'Điều kiện', '判断1': 'Điều kiện 1', '判断2': 'Điều kiện 2', '必须': 'Bắt buộc',
    '模板': 'Mẫu', '模板ID': 'Mã mẫu', '拉手模板': 'Mẫu tay nắm', '拉手模板ID': 'Mã mẫu tay nắm', '铰链模板': 'Mẫu bản lề', '铰链模板ID': 'Mã mẫu bản lề',
    // gặp trong mẫu con (mẫu lồng trong mẫu) của kho xưởng
    '宽度': 'Rộng', '立板深度': 'Sâu vách', '门板厚度': 'Dày cánh', '抽屉深度': 'Sâu ngăn kéo', '抽屉内缩': 'Ngăn kéo lùi vào', '槽加宽': 'Nới rộng rãnh', '上下移动': 'Dịch lên–xuống',
    '拉手上下居中': 'Tay nắm canh giữa trên–dưới', '拉手左右居中': 'Tay nắm canh giữa trái–phải', '拉手上距': 'Tay nắm cách trên', '拉手下距': 'Tay nắm cách dưới', '拉手左距': 'Tay nắm cách trái', '拉手右距': 'Tay nắm cách phải',
    '左开门': 'Cánh mở trái', '右开门': 'Cánh mở phải', '铰链上距': 'Bản lề cách trên', '铰链下距': 'Bản lề cách dưới', 'X轴个数': 'Số lượng theo X', 'Y轴个数': 'Số lượng theo Y', 'Z轴个数': 'Số lượng theo Z',
    '左留空': 'Hở trái', '右留空': 'Hở phải', '后留空': 'Hở sau',
    // gặp trong các mẫu mua (已购买)
    '板宽': 'Rộng ván', '立板厚': 'Dày vách', '门板高': 'Cao cánh', '倒角': 'Vát góc', '前移': 'Dịch ra trước', '距左': 'Cách trái',
    '左侧上伸': 'Hồi trái kéo dài lên', '右侧上伸': 'Hồi phải kéo dài lên', '左侧前延': 'Hồi trái kéo dài ra trước', '左侧后延': 'Hồi trái kéo dài ra sau', '左侧上延': 'Hồi trái kéo dài lên', '左侧下延': 'Hồi trái kéo dài xuống',
    '右侧前延': 'Hồi phải kéo dài ra trước', '右侧后延': 'Hồi phải kéo dài ra sau', '右侧上延': 'Hồi phải kéo dài lên', '右侧下延': 'Hồi phải kéo dài xuống',
    '顶板前延': 'Nóc kéo dài ra trước', '顶板左延': 'Nóc kéo dài trái', '顶板右延': 'Nóc kéo dài phải', '底板前延': 'Đáy kéo dài ra trước', '底板左延': 'Đáy kéo dài trái', '底板右延': 'Đáy kéo dài phải',
    '底板左延动作': 'Đáy kéo dài trái (động tác)', '底板右延动作': 'Đáy kéo dài phải (động tác)', '顶板左延动作': 'Nóc kéo dài trái (động tác)', '顶板右延动作': 'Nóc kéo dài phải (động tác)',
    '顶板左盖动作': 'Nóc phủ trái (động tác)', '顶板右盖动作': 'Nóc phủ phải (động tác)', '底板左盖动作': 'Đáy phủ trái (động tác)', '底板右盖动作': 'Đáy phủ phải (động tác)',
    '地脚内缩': 'Chân tủ lùi vào', '后地脚内缩': 'Chân sau lùi vào', '地脚前缩': 'Chân tủ lùi trước', '地脚后缩': 'Chân tủ lùi sau', '顶底前缩': 'Nóc đáy lùi trước', '顶底后缩': 'Nóc đáy lùi sau', '底板前缩': 'Đáy lùi trước',
    '垫板上缩': 'Tấm đệm lùi trên', '垫板下缩': 'Tấm đệm lùi dưới', '垫条宽': 'Rộng thanh đệm', '垫条左缩': 'Thanh đệm lùi trái', '垫条右缩': 'Thanh đệm lùi phải',
    // tên các mẫu Chenfeng tự sinh (cây bên phải)
    '左右侧板模板': 'Mẫu hai hồi', '顶底板模板': 'Mẫu nóc đáy', '背板模板': 'Mẫu hậu', '立板模板': 'Mẫu vách', '层板模板': 'Mẫu đợt', '门板模板': 'Mẫu cánh', '抽屉模板': 'Mẫu ngăn kéo',
    '左右侧板(自动)': 'Hai hồi (tự động)', '背板(自动)': 'Hậu (tự động)', '层板(自动)': 'Đợt (tự động)', '立板(自动)': 'Vách (tự động)', '格子抽(自动)': 'Ngăn kéo ô (tự động)', '酒格(自动)': 'Ô rượu (tự động)', '弧形窗(自动)': 'Cửa sổ vòm (tự động)',
    // ---- ghi chú của mẫu lấy từ cửa hàng Chenfeng (kho store, 03/10/2026) ----
    '侧板内缩': 'Hồi lùi vào', '背板左缩': 'Hậu lùi trái', '背板右缩': 'Hậu lùi phải', '顶板下移': 'Nóc dịch xuống', '底板上移': 'Đáy dịch lên', '左侧前缩': 'Hồi trái lùi trước',
    '左侧左缩': 'Hồi trái lùi trái', '右侧前缩': 'Hồi phải lùi trước', '右侧右缩': 'Hồi phải lùi phải', '左侧板上延': 'Hồi trái kéo dài lên', '左侧板下延': 'Hồi trái kéo dài xuống',
    '左侧板前延': 'Hồi trái kéo dài ra trước', '左侧板后延': 'Hồi trái kéo dài ra sau', '右侧板上延': 'Hồi phải kéo dài lên', '右侧板下延': 'Hồi phải kéo dài xuống',
    '右侧板前延': 'Hồi phải kéo dài ra trước', '右侧板后延': 'Hồi phải kéo dài ra sau', '中板厚': 'Dày ván giữa', '中板前缩': 'Ván giữa lùi trước', '高度': 'Cao',
    '拉手距上': 'Tay nắm cách trên', '拉手距下': 'Tay nắm cách dưới', '圆弧距下': 'Cung cách dưới', '圆弧距上': 'Cung cách trên', '层板距下': 'Đợt cách dưới', '立板靠右': 'Vách sát phải',
    '板高': 'Cao ván', '抽封板下延伸': 'Tấm bịt ngăn kéo kéo dài dưới', '背板距后': 'Hậu cách lưng', '后延伸': 'Kéo dài sau', '顶板前延伸': 'Nóc kéo dài ra trước',
    '顶板左延伸': 'Nóc kéo dài trái', '顶板右延伸': 'Nóc kéo dài phải', '前延伸': 'Kéo dài trước', '底板距下': 'Đáy cách dưới', '距右': 'Cách phải', '前距': 'Cách trước', '后距': 'Cách sau',
    '上距': 'Cách trên', '左延': 'Kéo dài trái', '右延': 'Kéo dài phải', '顶板前缩': 'Nóc lùi trước', '底板后缩': 'Đáy lùi sau', '上下板厚': 'Dày ván trên–dưới',
    '中板后缩': 'Ván giữa lùi sau', '中板左缩': 'Ván giữa lùi trái', '中板右缩': 'Ván giữa lùi phải', '拉手上移': 'Tay nắm dịch lên', '柜深': 'Sâu tủ', '层板深': 'Sâu đợt',
    '层板右缩': 'Đợt lùi phải', '层板左缩': 'Đợt lùi trái', '左右边框': 'Khung viền trái–phải', '上边框': 'Khung viền trên', '缝隙': 'Khe hở', '右侧高': 'Cao bên phải',
    '左侧高': 'Cao bên trái', '上延': 'Kéo dài lên', '侧板前延': 'Hồi kéo dài ra trước', '侧板上延': 'Hồi kéo dài lên', '背板右延': 'Hậu kéo dài phải', '背板上延': 'Hậu kéo dài lên',
    '底板上缩': 'Đáy lùi trên', '地脚下缩': 'Chân tủ lùi dưới', '左上缩': 'Lùi trên bên trái', '右上缩': 'Lùi trên bên phải', '左宽': 'Rộng bên trái', '顶左宽': 'Rộng nóc bên trái',
    '侧板左缩': 'Hồi lùi trái', '底板下缩': 'Đáy lùi dưới', '侧板右缩': 'Hồi lùi phải', '上下边框': 'Khung viền trên–dưới', '左柜深': 'Sâu tủ trái', '右柜深': 'Sâu tủ phải',
    '引孔间距': 'Khoảng cách lỗ mồi', '抽屉深': 'Sâu ngăn kéo', '抽底上移': 'Đáy ngăn kéo dịch lên', '轨道高': 'Cao ray', '抽屉后缩': 'Ngăn kéo lùi sau', '轨道厚': 'Dày ray',
    '轨道深': 'Sâu ray', '高留空': 'Hở chiều cao', '中门左移': 'Cánh giữa dịch trái', '中左门左移': 'Cánh giữa-trái dịch trái', '中右门右移': 'Cánh giữa-phải dịch phải', '中宽': 'Rộng giữa',
    '下移': 'Dịch xuống', '下延': 'Kéo dài xuống', '下高': 'Cao phần dưới', '内距边': 'Cách mép trong', '上芯板高': 'Cao pa-nô trên', '下芯板高': 'Cao pa-nô dưới',
    '左右宽': 'Rộng trái–phải', '前板左缩': 'Tấm trước lùi trái', '侧板后缩': 'Hồi lùi sau', '板上缩': 'Ván lùi trên', '板下缩': 'Ván lùi dưới', '侧板上缩': 'Hồi lùi trên',
    '板后缩': 'Ván lùi sau', '后板左缩': 'Tấm sau lùi trái', '后板右缩': 'Tấm sau lùi phải', '前板下缩': 'Tấm trước lùi dưới', '后板下缩': 'Tấm sau lùi dưới', '前板上缩': 'Tấm trước lùi trên',
    '后板上缩': 'Tấm sau lùi trên', '前板右缩': 'Tấm trước lùi phải', '侧板下缩': 'Hồi lùi dưới', '拉条距背': 'Thanh giằng cách hậu', '拉条宽': 'Rộng thanh giằng', '面板厚': 'Dày tấm mặt',
    '弧高': 'Cao cung', '边宽': 'Rộng viền', '框架下缩': 'Khung lùi dưới', '框架左右延': 'Khung kéo dài trái–phải', '框架上缩': 'Khung lùi trên', '型号(6,7,8)': 'Kiểu (6, 7, 8)',
    '固定板圆弧': 'Cung tấm cố định', '门框': 'Khung cánh', '圆角': 'Bo góc', '脚条高': 'Cao thanh chân', '后圆半径': 'Bán kính bo sau', '前圆半径': 'Bán kính bo trước',
    '下空间高': 'Cao khoang dưới', '顶线高': 'Cao phào đỉnh', '中立内缩': 'Vách giữa lùi vào', '中立右移': 'Vách giữa dịch phải', '左侧后伸': 'Hồi trái kéo dài ra sau',
    '右侧后伸': 'Hồi phải kéo dài ra sau', '左侧前伸': 'Hồi trái kéo dài ra trước', '右侧前伸': 'Hồi phải kéo dài ra trước', '左侧板抬高': 'Hồi trái nâng lên',
    '右侧板抬高': 'Hồi phải nâng lên', '背板抬高': 'Hậu nâng lên', '左延伸动作': 'Kéo dài trái (động tác)', '右延伸动作': 'Kéo dài phải (động tác)', '后延伸动作': 'Kéo dài sau (động tác)',
    '垫条上缩': 'Thanh đệm lùi trên', '垫条下缩': 'Thanh đệm lùi dưới', '上升': 'Nâng lên', '上开门': 'Cánh mở lên', '下开门': 'Cánh mở xuống', '背包侧': 'Hậu phủ hồi', '绘制方式': 'Cách vẽ',
    '插入个数': 'Số lượng chèn', '最小间距': 'Khoảng cách nhỏ nhất', '插入深度': 'Độ sâu chèn', '加深': 'Thêm sâu', '顶板左伸': 'Nóc kéo dài trái', '顶板右伸': 'Nóc kéo dài phải',
    '弧形高': 'Cao phần cong', '条子厚': 'Dày nẹp', '左留': 'Chừa trái', '右留': 'Chừa phải', '上留': 'Chừa trên', '下留': 'Chừa dưới', '凸出': 'Nhô ra', '前收': 'Thu trước',
    '后收': 'Thu sau', '左空': 'Hở trái', '右空': 'Hở phải', '收口下伸': 'Nẹp bịt kéo dài xuống', '柜体内缩': 'Thùng tủ lùi vào', '弧宽': 'Rộng cung', '盖侧板': 'Phủ hồi',
    '辅助条宽': 'Rộng thanh phụ', '左柱宽': 'Rộng cột trái', '左柱深': 'Sâu cột trái', '右柱宽': 'Rộng cột phải', '右柱深': 'Sâu cột phải', '左倒角': 'Vát góc trái', '右倒角': 'Vát góc phải',
    '中柱宽': 'Rộng cột giữa', '中柱深': 'Sâu cột giữa', '中柱距左': 'Cột giữa cách trái', '梁柱深': 'Sâu dầm cột', '后梁高': 'Cao dầm sau', '包柱动作': 'Bọc cột (động tác)',
    '后梁深': 'Sâu dầm sau', '前梁深': 'Sâu dầm trước', '前梁高': 'Cao dầm trước', '左梁宽': 'Rộng dầm trái', '左梁高': 'Cao dầm trái', '缺角包柱动作': 'Khuyết góc bọc cột (động tác)',
    '左包柱动作': 'Bọc cột trái (động tác)', '右包柱动作': 'Bọc cột phải (động tác)', '缺角深': 'Sâu khuyết góc', '缺角高': 'Cao khuyết góc', '缺角宽': 'Rộng khuyết góc',
    '左缺角宽': 'Rộng khuyết góc trái', '左缺角高': 'Cao khuyết góc trái', '右缺角宽': 'Rộng khuyết góc phải', '右缺角高': 'Cao khuyết góc phải', '左缺角深': 'Sâu khuyết góc trái',
    '右缺角深': 'Sâu khuyết góc phải', '下弧形深': 'Sâu phần cong dưới', '中背拉条下移': 'Thanh giằng hậu giữa dịch xuống', '中背拉下移动作': 'Giằng hậu giữa dịch xuống (động tác)',
    '左上缩动作': 'Lùi trên bên trái (động tác)', '右上缩动作': 'Lùi trên bên phải (động tác)', '收口宽': 'Rộng nẹp bịt', '键盘抽宽': 'Rộng khay bàn phím', '键盘抽深': 'Sâu khay bàn phím',
    '键盘抽高': 'Cao khay bàn phím', '侧抽高': 'Cao thành ngăn kéo', '侧抽后留': 'Thành ngăn kéo chừa sau', '侧板拉槽': 'Rãnh trên hồi', '后伸': 'Kéo dài ra sau',
    '抽屉加深': 'Ngăn kéo thêm sâu', '推门总深': 'Tổng sâu cửa lùa', '重叠位': 'Phần chồng mí', '轮高': 'Cao bánh xe', '轮深': 'Sâu bánh xe', '轮距边': 'Bánh xe cách mép',
    '侧板上伸': 'Hồi kéo dài lên', '背拉条高': 'Cao thanh giằng hậu', '背拉条宽': 'Rộng thanh giằng hậu', '距下空间': 'Cách khoang dưới', '玻璃厚': 'Dày kính', '装饰条宽': 'Rộng nẹp trang trí',
    '斜边延伸': 'Cạnh vát kéo dài', '上下留缝': 'Chừa khe trên–dưới', '左右上留': 'Chừa trái–phải–trên', '板四边加大': 'Ván nới rộng 4 cạnh', '波浪左移': 'Sóng dịch trái',
    '板加大': 'Ván nới rộng', '波浪总宽': 'Tổng rộng sóng', '波浪总实宽': 'Tổng rộng thực của sóng', '波浪总宽加大': 'Tổng rộng sóng nới thêm', '波浪右移': 'Sóng dịch phải', '柱深': 'Sâu cột',
    '柱宽': 'Rộng cột', '柱上延': 'Cột kéo dài lên', '柱下延': 'Cột kéo dài xuống', '梁宽': 'Rộng dầm', '梁高': 'Cao dầm', '梁后延': 'Dầm kéo dài ra sau', '梁深': 'Sâu dầm',
    '梁距下': 'Dầm cách dưới', '梁左延': 'Dầm kéo dài trái', '梁右延': 'Dầm kéo dài phải', '柱左移': 'Cột dịch trái', '柱距前': 'Cột cách trước', '梁右移': 'Dầm dịch phải',
    '梁左移': 'Dầm dịch trái', '柱右移': 'Cột dịch phải', '手拉位长': 'Dài hốc tay nắm', '手拉位左移': 'Hốc tay nắm dịch trái', '手拉位下移': 'Hốc tay nắm dịch xuống',
    '手拉位上移': 'Hốc tay nắm dịch lên', '手拉位右移': 'Hốc tay nắm dịch phải', '中角距下': 'Góc giữa cách dưới', '左上角上缩': 'Góc trên-trái lùi trên', '右上角上缩': 'Góc trên-phải lùi trên',
    '左下角下缩': 'Góc dưới-trái lùi dưới', '右下角下缩': 'Góc dưới-phải lùi dưới', '左上角左缩': 'Góc trên-trái lùi trái', '右上角右缩': 'Góc trên-phải lùi phải',
    '左下角左缩': 'Góc dưới-trái lùi trái', '右下角右缩': 'Góc dưới-phải lùi phải', '左右厚': 'Dày trái–phải', '总厚': 'Tổng dày', '层板厚': 'Dày đợt', '左右槽深': 'Sâu rãnh trái–phải',
    '上下槽深': 'Sâu rãnh trên–dưới', '拉条槽深': 'Sâu rãnh thanh giằng', '中板上缩': 'Ván giữa lùi trên', '中板下缩': 'Ván giữa lùi dưới', '层板内缩': 'Đợt lùi vào',
    '层板左右缩': 'Đợt lùi trái–phải', '下梁高': 'Cao dầm dưới', '下梁深': 'Sâu dầm dưới', '右柱宽1': 'Rộng cột phải 1', '右柱深1': 'Sâu cột phải 1', '左柱宽1': 'Rộng cột trái 1',
    '左柱深1': 'Sâu cột trái 1', '立条宽': 'Rộng nẹp đứng', '防尘板内缩': 'Tấm chắn bụi lùi vào', '电器高': 'Cao thiết bị', '底板宽': 'Rộng đáy', '左右孔深': 'Sâu lỗ trái–phải',
    '检修口长': 'Dài cửa thăm', '检修口宽': 'Rộng cửa thăm', '盒深': 'Sâu hộp', '盒高': 'Cao hộp', '盒宽': 'Rộng hộp', '左门数': 'Số cánh trái', '右门数': 'Số cánh phải',
    '判断3': 'Điều kiện 3', '判断4': 'Điều kiện 4', '左门': 'Cánh trái', '右门': 'Cánh phải', '左门缝': 'Khe cánh trái', '右门缝': 'Khe cánh phải', '左中门缝': 'Khe cánh giữa-trái',
    '右中门缝': 'Khe cánh giữa-phải', '右宽': 'Rộng bên phải', '左台面宽': 'Rộng mặt bàn trái', '右台面宽': 'Rộng mặt bàn phải', '水槽距右': 'Chậu rửa cách phải', '台面厚': 'Dày mặt bàn',
    '含下扣高': 'Cao kể cả gờ dưới', '后档高': 'Cao gờ chắn sau', '烟机宽': 'Rộng máy hút mùi', '层板左右缩进': 'Đợt lùi trái–phải', '背板内缩': 'Hậu lùi vào', '水槽距左': 'Chậu rửa cách trái',
    '冰箱柜宽': 'Rộng tủ tủ lạnh', '冰箱柜高': 'Cao tủ tủ lạnh', '下柜高': 'Cao tủ dưới', '拉篮柜宽': 'Rộng tủ giá kéo', '下柜上延伸': 'Tủ dưới kéo dài lên', '台面高': 'Cao mặt bàn',
    '上柜深': 'Sâu tủ trên', '开放柜高': 'Cao tủ hở', '中台面宽': 'Rộng mặt bàn giữa', '居前': 'Sát trước', '左右延伸': 'Kéo dài trái–phải', '地板预留': 'Chừa sàn', '冰箱高': 'Cao tủ lạnh',
    '高柜深': 'Sâu tủ cao', '左台面深': 'Sâu mặt bàn trái', '左下柜深': 'Sâu tủ dưới trái', '右台面深': 'Sâu mặt bàn phải', '右下柜深': 'Sâu tủ dưới phải', '烟机柜宽': 'Rộng tủ máy hút mùi',
    '柜体左延伸': 'Thùng tủ kéo dài trái', '前后留': 'Chừa trước–sau', '层距': 'Khoảng cách đợt', '变量1': 'Biến 1', '变量2': 'Biến 2', '层板后缩': 'Đợt lùi sau', '门板宽': 'Rộng cánh',
    '孔宽': 'Rộng lỗ', '孔高': 'Cao lỗ', '槽距边': 'Rãnh cách mép', '拉直器距左': 'Thanh chống cong cách trái', '拉直器距右': 'Thanh chống cong cách phải', '槽间距': 'Khoảng cách rãnh',
    '拉手位': 'Vị trí tay nắm', '拉手位宽': 'Rộng vị trí tay nắm', '拉手位距下': 'Vị trí tay nắm cách dưới', '拉手位距上': 'Vị trí tay nắm cách trên', '左中柜高': 'Cao tủ giữa trái',
    '左下柜高': 'Cao tủ dưới trái', '右上柜高': 'Cao tủ trên phải', '下空': 'Hở dưới', '顶板前伸': 'Nóc kéo dài ra trước', '左上柜高': 'Cao tủ trên trái', '右中柜高': 'Cao tủ giữa phải',
    '右下柜高': 'Cao tủ dưới phải', '上缺角高': 'Cao khuyết góc trên', '下缺角高': 'Cao khuyết góc dưới', '面板厚度': 'Dày tấm mặt', '内收': 'Thu vào trong', '离地': 'Cách sàn',
    '地板厚度': 'Dày sàn', '圆弧距后': 'Cung cách sau', '柜体右延伸': 'Thùng tủ kéo dài phải', '中缺口高': 'Cao khuyết giữa', '中缺口深': 'Sâu khuyết giữa', '底板缺口深': 'Sâu khuyết đáy',
    '横条深': 'Sâu thanh ngang', '弧形距下': 'Phần cong cách dưới', '左垫条下缩': 'Thanh đệm trái lùi dưới', '右垫条下缩': 'Thanh đệm phải lùi dưới', '内弧形上延伸': 'Cong trong kéo dài lên',
    '中柜高': 'Cao tủ giữa', '缺角距下': 'Khuyết góc cách dưới', '弧形距左': 'Phần cong cách trái', '弧形距后': 'Phần cong cách sau', '造型高': 'Cao phần tạo hình',
    '桌面左延伸': 'Mặt bàn kéo dài trái', '桌面右延伸': 'Mặt bàn kéo dài phải', '桌面前延伸': 'Mặt bàn kéo dài ra trước', '背板前移': 'Hậu dời ra trước', '左角弧度': 'Độ cong góc trái',
    '右角弧度': 'Độ cong góc phải', '门套': 'Khuôn bao cửa', '母门宽': 'Rộng cánh lớn (cửa mẹ con)', '逃跑距离': 'Khoảng lùi tránh', '中柜下留空': 'Tủ giữa hở dưới',
    '中柜倒角': 'Vát góc tủ giữa', '左上弧形高': 'Cao phần cong trên trái', '左下弧形高': 'Cao phần cong dưới trái', '缺角距上': 'Khuyết góc cách trên', '靠右': 'Sát phải',
    '右上弧形高': 'Cao phần cong trên phải', '右下弧形高': 'Cao phần cong dưới phải', '左半径': 'Bán kính trái', '右半径': 'Bán kính phải', '左侧板上延伸': 'Hồi trái kéo dài lên',
    '右侧板上延伸': 'Hồi phải kéo dài lên', '后留空判断': 'Kiểm tra hở sau', '背板判断': 'Kiểm tra hậu', '左延伸判断': 'Kiểm tra kéo dài trái', '右延伸判断': 'Kiểm tra kéo dài phải',
    '左延伸判断立板': 'Kiểm tra kéo dài trái (vách đứng)', '右延伸判断立板': 'Kiểm tra kéo dài phải (vách đứng)', '背板封边': 'Dán cạnh hậu', '左前延伸': 'Kéo dài trước bên trái',
    '右前延伸': 'Kéo dài trước bên phải', '电器宽': 'Rộng thiết bị', '左收口宽': 'Rộng nẹp trái', '右收口宽': 'Rộng nẹp phải', '台盆右移': 'Chậu dời sang phải', '洗手台高': 'Cao bàn lavabo',
    '银镜柜高': 'Cao tủ gương', '银镜柜深': 'Sâu tủ gương', '侧边柜宽': 'Rộng tủ bên', '侧边柜高': 'Cao tủ bên', '浴室柜高': 'Cao tủ lavabo', '抽屉柜1高': 'Cao tủ ngăn kéo 1',
    '抽屉柜2高': 'Cao tủ ngăn kéo 2', '抽屉柜2宽': 'Rộng tủ ngăn kéo 2', '洗手台宽': 'Rộng bàn lavabo', '吊柜高': 'Cao tủ treo', '吊柜宽': 'Rộng tủ treo', '吊柜深': 'Sâu tủ treo',
    '水槽左移': 'Chậu rửa dời sang trái', '下悬空高': 'Cao hở dưới (treo)', '抽屉柜高': 'Cao tủ ngăn kéo', '楣板高': 'Cao tấm mi', '楣板上移': 'Tấm mi dời lên',
    '楣板左延': 'Tấm mi kéo dài trái', '楣板右延': 'Tấm mi kéo dài phải', '楣板前缩': 'Tấm mi lùi trước', '门洞间隙': 'Khe hở ô cửa', '线条宽': 'Rộng phào chỉ',
    '子门宽': 'Rộng cánh nhỏ (cửa mẹ con)', '下窗高': 'Cao cửa sổ dưới', '左下窗高': 'Cao cửa sổ dưới trái', '中窗宽': 'Rộng cửa sổ giữa', '门高': 'Cao cửa', '门宽': 'Rộng cửa',
    '窗高': 'Cao cửa sổ', '窗宽': 'Rộng cửa sổ', '窗台高': 'Cao bệ cửa sổ', '墙厚': 'Dày tường', '窗到墙': 'Cửa sổ cách tường', '门垛宽': 'Rộng má cửa', '窗帘位': 'Vị trí rèm',
    '预留衣柜': 'Chừa chỗ tủ áo', '固定窗高': 'Cao cửa sổ cố định', '飘窗高': 'Cao cửa sổ lồi', '飘窗深': 'Sâu cửa sổ lồi', '垭口宽': 'Rộng ô thông', '垭口高': 'Cao ô thông',
    '垭口墙厚': 'Dày tường ô thông', '垭口到墙': 'Ô thông cách tường', '阳台宽': 'Rộng ban công', '卫生间宽': 'Rộng nhà vệ sinh', '过道宽': 'Rộng lối đi', '卫门宽': 'Rộng cửa vệ sinh',
    '卫门垛宽': 'Rộng má cửa vệ sinh', '飘窗墙厚': 'Dày tường cửa sổ lồi', '外前孔距边': 'Lỗ trước ngoài cách mép', '内前孔距边': 'Lỗ trước trong cách mép', '外引孔': 'Lỗ mồi ngoài',
    '内引孔': 'Lỗ mồi trong', '外引孔内移': 'Lỗ mồi ngoài dời vào trong', '引孔距下': 'Lỗ mồi cách dưới', '引孔内移': 'Lỗ mồi dời vào trong', '背孔深': 'Sâu lỗ sau',
    '背孔距边': 'Lỗ sau cách mép', '背孔距下': 'Lỗ sau cách dưới', '衣杆扣尺': 'Trừ dài suốt treo', '左距后': 'Trái cách sau', '右距后': 'Phải cách sau', '左侧右移': 'Bên trái dời sang phải',
    '右侧左移': 'Bên phải dời sang trái', '灯带深': 'Sâu rãnh đèn', '灯带高': 'Cao rãnh đèn', '左右移': 'Dời trái–phải', '调节高': 'Cao điều chỉnh', '调节脚高': 'Cao chân tăng chỉnh',
    '反弹器相距': 'Khoảng cách nhấn mở', '左前移': 'Trái dời ra trước', '右前移': 'Phải dời ra trước', '架深': 'Sâu giá', '托架深': 'Sâu giá đỡ', '镜高': 'Cao gương', '镜宽': 'Rộng gương',
    '孔间距': 'Khoảng cách giữa các lỗ',
    // bổ sung 04/10/2026: ghi chú của các bộ tủ mẫu lấy từ cửa hàng (tủ áo, tủ tivi, bếp, bàn học, giường tầng, tatami…)
    '灯槽宽': 'Rộng rãnh đèn', '灯槽深': 'Sâu rãnh đèn', '上1空间': 'Khoang trên 1', '上2空间': 'Khoang trên 2', '轨道孔': 'Lỗ ray', '抽侧高': 'Cao thành ngăn kéo', '槽下距': 'Rãnh cách mép dưới',
    '抽底判断1': 'Điều kiện đáy ngăn kéo 1', '抽底判断2': 'Điều kiện đáy ngăn kéo 2', '抽底封边判断': 'Điều kiện dán cạnh đáy ngăn kéo', '顶底判断': 'Điều kiện nóc đáy',
    '左右判断': 'Điều kiện trái phải', '上判断': 'Điều kiện trên', '下判断': 'Điều kiện dưới', '踢脚高': 'Cao xà chân', '上3空间': 'Khoang trên 3', '踢脚': 'Xà chân',
    '拉手下留空': 'Hở dưới tay nắm', '上4空间': 'Khoang trên 4', '收口': 'Nẹp bù', '柜体前伸': 'Thùng tủ kéo dài ra trước', '上5空间': 'Khoang trên 5', '扣尺': 'Trừ kích thước',
    '左柜宽': 'Rộng tủ trái', '居上': 'Cách trên', '收口高': 'Cao nẹp bù', '向右偏': 'Lệch sang phải', '上伸': 'Kéo dài lên', '背板下判断': 'Điều kiện hậu dưới', '判断底板': 'Điều kiện đáy',
    '柜体高': 'Cao thùng tủ', '书桌高': 'Cao bàn', '榻榻米高': 'Cao tatami', '榻榻米宽': 'Rộng tatami', '中心距左': 'Tâm cách trái', '衣柜深': 'Sâu tủ áo', '左侧板后缩': 'Hồi trái lùi sau',
    '左侧板前伸': 'Hồi trái kéo dài ra trước', '右侧板前伸': 'Hồi phải kéo dài ra trước', '造型长': 'Dài tạo hình', '造型宽': 'Rộng tạo hình', '柜体后缩': 'Thùng tủ lùi sau', '吊沿高': 'Cao diềm',
    '左侧前延伸': 'Hồi trái kéo dài ra trước', '检修口大小': 'Cỡ ô thăm', '检修口距右': 'Ô thăm cách phải', '右侧前延伸': 'Hồi phải kéo dài ra trước', '鞋凳高': 'Cao ghế thay giày',
    '左侧上延伸': 'Hồi trái kéo dài lên', '外飘': 'Nhô ra ngoài', '下床高': 'Cao giường dưới', '右侧上延伸': 'Hồi phải kéo dài lên', '电视柜高': 'Cao tủ tivi', '拉位上留空': 'Hở trên chỗ tay nắm',
    '右墙板宽': 'Rộng tấm ốp tường phải', '台面宽': 'Rộng mặt bàn', '龙头距后': 'Vòi cách sau', '要开孔请输240': 'Cần khoét lỗ thì nhập 240', '龙头孔距前': 'Lỗ vòi cách trước', '上空': 'Hở trên',
    '台面深': 'Sâu mặt bàn', '上墙板高': 'Cao tấm ốp tường trên', '地台高': 'Cao bục', '上1空': 'Khoảng trên 1', '上2空': 'Khoảng trên 2', '上3空': 'Khoảng trên 3', '上4空': 'Khoảng trên 4',
    '上5空': 'Khoảng trên 5', '上6空': 'Khoảng trên 6', '床宽': 'Rộng giường', '左柜1宽': 'Rộng tủ trái 1', '左柜2宽': 'Rộng tủ trái 2', '左墙板宽': 'Rộng tấm ốp tường trái',
    '检修口据后': 'Ô thăm cách sau', '检修口距后': 'Ô thăm cách sau', '左柜3宽': 'Rộng tủ trái 3', '开放格高': 'Cao ô hở', '门洞深': 'Sâu ô cửa', '桌面高': 'Cao mặt bàn',
    '前封板高': 'Cao tấm bịt trước', '背板下伸': 'Hậu kéo dài xuống', '书柜深': 'Sâu tủ sách', '炉台柜宽': 'Rộng tủ bếp nấu', '右柜1宽': 'Rộng tủ phải 1', '背条上缩': 'Thanh giằng sau lùi trên',
    '背条下缩': 'Thanh giằng sau lùi dưới', '柜子前缩': 'Tủ lùi trước', '顶前伸': 'Nóc kéo dài ra trước', '顶右延伸': 'Nóc kéo dài phải', '顶左延伸': 'Nóc kéo dài trái', '桌面宽': 'Rộng mặt bàn',
    '书桌深': 'Sâu bàn', '顶板后伸': 'Nóc kéo dài ra sau', '左弧角': 'Góc bo trái', '右弧角': 'Góc bo phải', '书桌宽': 'Rộng bàn', '顶板加深': 'Nóc sâu thêm', '电脑桌高': 'Cao bàn máy tính',
    '格栅宽': 'Rộng lam', '左柜4宽': 'Rộng tủ trái 4', '榻榻米收口': 'Nẹp bù tatami', '侧板前缩': 'Hồi lùi trước', '封边': 'Dán cạnh', '右开放格宽': 'Rộng ô hở phải', '中心距后': 'Tâm cách sau',
    '左格宽': 'Rộng ô trái', '右格宽': 'Rộng ô phải', '侧柜深': 'Sâu tủ bên', '侧开柜深': 'Sâu tủ mở bên', '梯高': 'Cao thang', '床深': 'Sâu giường', '右柜2宽': 'Rộng tủ phải 2',
    '顶柜高': 'Cao tủ nóc', '背板高': 'Cao hậu', '左格栅宽': 'Rộng lam trái', '电视格高': 'Cao ô tivi', '板深': 'Sâu tấm', '左开放柜宽': 'Rộng tủ hở trái', '右开放柜宽': 'Rộng tủ hở phải',
    '地柜高': 'Cao tủ dưới', '鞋凳宽': 'Rộng ghế thay giày', '中下柜高': 'Cao tủ giữa dưới', '顶底左延伸': 'Nóc đáy kéo dài trái', '顶底右延伸': 'Nóc đáy kéo dài phải',
    '背板后移判断': 'Điều kiện dời hậu ra sau', '距左内空': 'Cách lọt lòng trái', '前缺高': 'Cao khuyết trước', '前缺深': 'Sâu khuyết trước', '前内缩': 'Trước lùi vào', '后缺高': 'Cao khuyết sau',
    '下抽屉高': 'Cao ngăn kéo dưới', '烤箱格高': 'Cao ô lò nướng', '蒸箱格高': 'Cao ô lò hấp', '中间柜深': 'Sâu tủ giữa', '踢脚宽': 'Rộng xà chân', '上下框高': 'Cao khung trên dưới',
    '梳妆台高': 'Cao bàn trang điểm', '弧形柜宽': 'Rộng tủ cong', '左衣柜宽': 'Rộng tủ áo trái', '书柜宽': 'Rộng tủ sách', '底板左延伸': 'Đáy kéo dài trái', '底板右延伸': 'Đáy kéo dài phải',
    '1空间': 'Khoang 1', '2空间': 'Khoang 2', '中间留空高': 'Cao khoảng hở giữa', '下墙板高': 'Cao tấm ốp tường dưới', '电视柜宽': 'Rộng tủ tivi', '右门宽': 'Rộng cánh phải',
    '左柜5宽': 'Rộng tủ trái 5', '背板后留空': 'Hở sau hậu', '左深': 'Sâu trái', '右深': 'Sâu phải', '中上柜高': 'Cao tủ giữa trên', '悬空高': 'Cao treo cách sàn', '右柜3宽': 'Rộng tủ phải 3',
    '洗衣机宽': 'Rộng máy giặt', '左侧宽': 'Rộng bên trái', '右侧宽': 'Rộng bên phải', '中柜深': 'Sâu tủ giữa', '桌面前伸': 'Mặt bàn kéo dài ra trước', '柜体前缩': 'Thùng tủ lùi trước',
    '层板距上': 'Đợt cách trên', '左边宽': 'Rộng cạnh trái', '中间格宽': 'Rộng ô giữa', '背条左缩': 'Thanh giằng sau lùi trái', '背条右缩': 'Thanh giằng sau lùi phải', '下部份高': 'Cao phần dưới',
    '中间空': 'Hở giữa', '侧板前伸': 'Hồi kéo dài ra trước', '内嵌': 'Âm vào trong', '下降': 'Hạ xuống', '左边厚': 'Dày cạnh trái', '左背板厚/含槽': 'Dày hậu trái / gồm rãnh',
    '右边厚': 'Dày cạnh phải', '右背板厚/含槽': 'Dày hậu phải / gồm rãnh', '左转角宽': 'Rộng góc trái', '转角深': 'Sâu góc', '右转角宽': 'Rộng góc phải', '左侧下延伸': 'Hồi trái kéo dài xuống',
    '右侧下延伸': 'Hồi phải kéo dài xuống', '封板上延伸': 'Tấm bịt kéo dài trên', '收口条': 'Nẹp bù', '左侧柜深': 'Sâu tủ bên trái', '抽屉总高': 'Tổng cao ngăn kéo',
    '柜子前延伸': 'Tủ kéo dài ra trước', '右柜高': 'Cao tủ phải', '中间柜宽': 'Rộng tủ giữa', '台面前延伸': 'Mặt bàn kéo dài ra trước', '书桌厚': 'Dày bàn', '转角宽': 'Rộng góc', '1格高': 'Cao ô 1',
    '2格高': 'Cao ô 2', '4格高': 'Cao ô 4', '梯宽': 'Rộng thang', '梯深': 'Sâu thang', '勾距上': 'Móc cách trên', '左梯宽': 'Rộng thang trái', '上床高': 'Cao giường trên',
    '前板左伸': 'Tấm trước kéo dài trái', '前板右伸': 'Tấm trước kéo dài phải', '开放高': 'Cao phần hở', '左侧后延伸': 'Hồi trái kéo dài ra sau', '右侧后延伸': 'Hồi phải kéo dài ra sau',
    '顶板后延伸': 'Nóc kéo dài ra sau', '底板后延伸': 'Đáy kéo dài ra sau', '底左侧板判断': 'Điều kiện hồi trái dưới', '底左底板判断': 'Điều kiện đáy trái dưới',
    '底右侧板判断': 'Điều kiện hồi phải dưới', '底右底板判断': 'Điều kiện đáy phải dưới', '上左侧板判断': 'Điều kiện hồi trái trên', '上左顶板判断': 'Điều kiện nóc trái trên',
    '上右侧板判断': 'Điều kiện hồi phải trên', '上右顶板判断': 'Điều kiện nóc phải trên', '背板槽判断': 'Điều kiện rãnh hậu', '背板封边判断': 'Điều kiện dán cạnh hậu', '吊柜右留空': 'Tủ treo hở phải',
    '右格栅宽': 'Rộng lam phải', '3空间': 'Khoang 3', '弧度': 'Độ cong', '立板距右': 'Vách cách phải', '衣柜宽': 'Rộng tủ áo', '左衣柜深': 'Sâu tủ áo trái', '抽屉柜宽': 'Rộng tủ ngăn kéo',
    '下柜深': 'Sâu tủ dưới', '右板宽': 'Rộng tấm phải', '中留空': 'Hở giữa', '电视柜长': 'Dài tủ tivi', '中墙板宽': 'Rộng tấm ốp tường giữa', '下抽屉柜高': 'Cao tủ ngăn kéo dưới',
    '上抽屉柜高': 'Cao tủ ngăn kéo trên', '右上柜宽': 'Rộng tủ trên phải', '餐桌高': 'Cao bàn ăn', '右吊柜宽': 'Rộng tủ treo phải', '左开放格宽': 'Rộng ô hở trái', '左吊柜宽': 'Rộng tủ treo trái',
    '上柜宽': 'Rộng tủ trên', '抽屉柜延伸': 'Tủ ngăn kéo kéo dài', '弧形封板宽': 'Rộng tấm bịt cong', '右前延': 'Kéo dài trước phải', '凳子高': 'Cao ghế', '右上高': 'Cao trên phải',
    '左柜深度': 'Sâu tủ trái', '右柜深度': 'Sâu tủ phải', '左柜1': 'Tủ trái 1', '左柜2': 'Tủ trái 2', '下柜离地高': 'Tủ dưới cách sàn', '吊柜离台面高': 'Tủ treo cách mặt bàn', '转角柜深': 'Sâu tủ góc',
    '右上柜深': 'Sâu tủ trên phải', '床头柜高': 'Cao tab đầu giường', '床头柜延伸': 'Tab đầu giường kéo dài', '左上柜深': 'Sâu tủ trên trái', '烟机吊柜宽': 'Rộng tủ treo máy hút mùi',
    '拉篮地柜宽': 'Rộng tủ dưới có giá kéo', '收口宽度': 'Rộng nẹp bù', '书柜高': 'Cao tủ sách', '开放宽': 'Rộng phần hở', '洗衣机高': 'Cao máy giặt', '水槽柜高': 'Cao tủ chậu rửa',
    '洗衣机柜宽': 'Rộng tủ máy giặt', '左封板宽': 'Rộng tấm bịt trái', '拉手槽长度': 'Dài rãnh tay nắm', '桌背留空': 'Hở sau bàn', '后踢脚前移': 'Xà chân sau dời ra trước',
    '拉槽判断': 'Điều kiện rãnh tay nắm', '背板判断上': 'Điều kiện hậu trên', '背板判断下': 'Điều kiện hậu dưới', '封边判断': 'Điều kiện dán cạnh', '上开放格高': 'Cao ô hở trên', '延伸': 'Kéo dài',
    '左侧下留空': 'Hồi trái hở dưới', '右侧下留空': 'Hồi phải hở dưới', '背板左延伸': 'Hậu kéo dài trái', '背板右延伸': 'Hậu kéo dài phải', '整体前缩': 'Cả tủ lùi trước', '水槽开孔长': 'Dài lỗ chậu rửa',
    '水槽开孔宽': 'Rộng lỗ chậu rửa', '水槽距后': 'Chậu rửa cách sau', '灶上移': 'Bếp dời lên', '柜体前延伸': 'Thùng tủ kéo dài ra trước', '左抽屉宽': 'Rộng ngăn kéo trái',
    '中抽屉柜宽': 'Rộng tủ ngăn kéo giữa', '右柜柜门宽': 'Rộng cánh tủ phải', '罗马柱宽': 'Rộng cột La Mã', '梳妆台深': 'Sâu bàn trang điểm', '玻璃框宽': 'Rộng khung kính',
    '左右倒角': 'Vát góc trái phải', '桌侧左缩': 'Hông bàn lùi trái', '房门宽': 'Rộng cửa phòng', '靠背高': 'Cao tựa lưng', '衣柜下高': 'Cao phần dưới tủ áo', '衣柜深度': 'Sâu tủ áo',
    '书桌抽屉高含桌面': 'Cao ngăn kéo bàn (gồm mặt bàn)', '上格栅高': 'Cao lam trên', '错层深': 'Sâu lệch tầng', '立板距左': 'Vách cách trái', '左后留空': 'Hở sau trái', '右后留空': 'Hở sau phải',
    '衣柜总宽': 'Tổng rộng tủ áo', '背板后距': 'Hậu cách sau', '左柜高': 'Cao tủ trái', '抽屉柜下留空': 'Tủ ngăn kéo hở dưới', '左下高': 'Cao dưới trái', '左边开放格宽': 'Rộng ô hở bên trái',
    '下留空高': 'Cao khoảng hở dưới', '上收口': 'Nẹp bù trên', '右柜门宽': 'Rộng cánh tủ phải', '中间开放高': 'Cao phần hở giữa', '开放柜深': 'Sâu tủ hở', '右书柜宽': 'Rộng tủ sách phải',
    '右书柜深': 'Sâu tủ sách phải', '左1宽': 'Rộng trái 1', '左2宽': 'Rộng trái 2', '左3宽': 'Rộng trái 3', '左4宽': 'Rộng trái 4', '左5宽': 'Rộng trái 5', '左6宽': 'Rộng trái 6',
    '电视左柜宽': 'Rộng tủ bên trái tivi', '电视右柜宽': 'Rộng tủ bên phải tivi', '矮柜高': 'Cao tủ thấp', '左电视柜宽': 'Rộng tủ tivi trái', '下格栅高': 'Cao lam dưới', '腰线柜高': 'Cao tủ ngang eo',
    '有柜宽': 'Rộng tủ phải', '墙板高': 'Cao tấm ốp tường', '电视格宽': 'Rộng ô tivi', '吊柜总高': 'Tổng cao tủ treo', '中间条子宽': 'Rộng nẹp giữa', '左上柜宽': 'Rộng tủ trên trái',
    '开放格深度': 'Sâu ô hở', '加强条高': 'Cao thanh tăng cứng', '餐桌宽': 'Rộng bàn ăn', '餐桌长': 'Dài bàn ăn', '开放格宽度': 'Rộng ô hở', '开放上柜': 'Tủ trên hở', '抽屉宽': 'Rộng ngăn kéo',
    '餐柜深': 'Sâu tủ ăn', '加强条': 'Thanh tăng cứng', '双抽高': 'Cao 2 ngăn kéo', '柜1宽': 'Rộng tủ 1', '柜2宽': 'Rộng tủ 2', '柜3宽': 'Rộng tủ 3', '柜4宽': 'Rộng tủ 4', '柜5宽': 'Rộng tủ 5',
    '柜6宽': 'Rộng tủ 6', '柜1': 'Tủ 1', '柜2': 'Tủ 2', '柜3': 'Tủ 3', '柜4': 'Tủ 4', '右吊柜高': 'Cao tủ treo phải', '键盘深': 'Sâu khay bàn phím', '总宽': 'Tổng rộng', '总高': 'Tổng cao',
    '引孔': 'Lỗ mồi', '左柜6宽': 'Rộng tủ trái 6', '下弧形封板高': 'Cao tấm bịt cong dưới', '左前延': 'Kéo dài trước trái', '凳子深': 'Sâu ghế', '鞋柜深': 'Sâu tủ giày',
    '左上吊柜高': 'Cao tủ treo trên trái', '小上柜高': 'Cao tủ trên nhỏ', '左边柜宽': 'Rộng tủ bên trái', '中柜宽': 'Rộng tủ giữa', '左上高': 'Cao trên trái', '侧柜深度': 'Sâu tủ bên',
    '左柜3': 'Tủ trái 3', '台面上高': 'Cao trên mặt bàn', '造型空间宽': 'Rộng khoang tạo hình', '中间封板宽': 'Rộng tấm bịt giữa', '下柜抽屉宽': 'Rộng ngăn kéo tủ dưới', '银镜宽': 'Rộng gương',
    '右开门宽': 'Rộng cánh mở phải', '梳妆台宽': 'Rộng bàn trang điểm', '楣条高': 'Cao diềm trên', '拉条下降': 'Thanh giằng hạ xuống', '左书柜深': 'Sâu tủ sách trái',
    '桌上开放柜宽': 'Rộng tủ hở trên bàn', '衣柜下柜高': 'Cao tủ dưới của tủ áo', '衣柜开放柜高': 'Cao tủ hở của tủ áo', '书桌开放柜宽': 'Rộng tủ hở của bàn', '右柜4宽': 'Rộng tủ phải 4',
    '右柜5宽': 'Rộng tủ phải 5', '中下柜宽': 'Rộng tủ giữa dưới', '转角柜宽': 'Rộng tủ góc', '延伸衣柜宽': 'Rộng tủ áo nối dài', '桌面深': 'Sâu mặt bàn', '左开放柜高': 'Cao tủ hở trái',
    '右开放柜高': 'Cao tủ hở phải', '垫板前缩': 'Tấm đệm lùi trước', '垫板后缩': 'Tấm đệm lùi sau', '下切': 'Cắt dưới', '上切': 'Cắt trên', '吊柜左留空': 'Tủ treo hở trái',
    '灶下柜宽': 'Rộng tủ dưới bếp', '洗衣机位宽': 'Rộng chỗ máy giặt', '上柜深度': 'Sâu tủ trên', '左上收口宽': 'Rộng nẹp bù trên trái', '左柜宽度': 'Rộng tủ trái', '下柜高度': 'Cao tủ dưới',
    '吊柜深度': 'Sâu tủ treo', '开放柜高度': 'Cao tủ hở', '踢脚高度': 'Cao xà chân', '地柜深': 'Sâu tủ dưới', '封板上延': 'Tấm bịt kéo dài trên', '桌侧右缩': 'Hông bàn lùi phải',
    '桌面左伸': 'Mặt bàn kéo dài trái', '桌面右伸': 'Mặt bàn kéo dài phải', '背板后缩': 'Hậu lùi sau', '中倒角': 'Vát góc giữa', '前盖': 'Phủ trước', '后盖': 'Phủ sau', '封板高': 'Cao tấm bịt',
    '整体往前加深': 'Cả tủ sâu thêm ra trước', '下柜总高': 'Tổng cao tủ dưới', '上层空间': 'Khoang tầng trên', '4空间': 'Khoang 4', '左柜上延伸': 'Tủ trái kéo dài lên',
    '右柜上延伸': 'Tủ phải kéo dài lên', '电视位宽': 'Rộng chỗ tivi', '拉手条高': 'Cao thanh tay nắm', '抽屉离地高': 'Ngăn kéo cách sàn', '双抽高度': 'Cao 2 ngăn kéo', '门板宽度': 'Rộng cánh',
    '档条高': 'Cao thanh chắn', '下开放格高': 'Cao ô hở dưới', '立板': 'Vách', '左侧缩': 'Hồi trái lùi', '右侧缩': 'Hồi phải lùi', '左侧厚': 'Dày hồi trái', '右侧厚': 'Dày hồi phải',
    '挂钩距上': 'Móc treo cách trên', '柜子深': 'Sâu tủ', '台面厚度': 'Dày mặt bàn', '柜子后缩': 'Tủ lùi sau', '弧形': 'Cong', '抽上到底距离': 'Khoảng từ mép trên ngăn kéo tới đáy',
    '台面长': 'Dài mặt bàn', '靠墙距离': 'Khoảng cách tới tường', '右上升': 'Nâng lên bên phải', '顶包背动作': 'Động tác nóc phủ hậu', '后地脚后缩': 'Chân sau lùi sau',
    '前地脚内缩': 'Chân trước lùi vào', '前背板左延伸': 'Hậu trước kéo dài trái', '前背板右延伸': 'Hậu trước kéo dài phải',
  };

  /* ---- 2. Ghép từ: cho ghi chú lạ chưa có trong bảng trên (kết quả có dấu ~ phía trước để biết là dịch ghép) ---- */
  // loại: N = danh từ (bộ phận) · D = hướng · A = hành động / trạng thái · M = số đo (đứng đầu câu tiếng Việt) · S = hậu tố
  const TU = [
    ['左右侧板', 'hai hồi', 'N'], ['左侧板', 'hồi trái', 'N'], ['右侧板', 'hồi phải', 'N'], ['侧板', 'hồi', 'N'], ['顶底板', 'nóc đáy', 'N'], ['顶底', 'nóc đáy', 'N'], ['顶板', 'nóc', 'N'], ['底板', 'đáy', 'N'], ['背板', 'hậu', 'N'], ['立板', 'vách', 'N'], ['层板', 'đợt', 'N'],
    ['门板', 'cánh', 'N'], ['移门', 'cửa lùa', 'N'], ['门', 'cánh', 'N'], ['抽屉', 'ngăn kéo', 'N'], ['抽盒', 'hộp ngăn kéo', 'N'], ['抽面', 'mặt ngăn kéo', 'N'], ['抽底', 'đáy ngăn kéo', 'N'], ['抽侧板', 'thành ngăn kéo', 'N'], ['抽侧', 'thành ngăn kéo', 'N'], ['抽帮', 'thành ngăn kéo', 'N'], ['抽', 'ngăn kéo', 'N'],
    ['拉手', 'tay nắm', 'N'], ['把手', 'tay nắm', 'N'], ['铰链', 'bản lề', 'N'], ['轨道', 'ray', 'N'], ['导轨', 'ray', 'N'], ['封板', 'tấm bịt', 'N'], ['盖板', 'tấm phủ', 'N'], ['垫板', 'tấm đệm', 'N'], ['辅助板', 'tấm phụ', 'N'], ['芯板', 'pa-nô', 'N'],
    ['地脚线', 'xà chân', 'N'], ['脚线', 'xà chân', 'N'], ['地脚', 'chân tủ', 'N'], ['腰线', 'đai giữa', 'N'], ['边框', 'khung viền', 'N'], ['衣杆', 'suốt treo', 'N'], ['裤杆', 'thanh treo quần', 'N'], ['镜子', 'gương', 'N'], ['灯带', 'đèn LED', 'N'],
    ['开放柜', 'tủ hở', 'N'], ['开放格', 'ô hở', 'N'], ['上柜', 'tủ trên', 'N'], ['下柜', 'tủ dưới', 'N'], ['柜', 'tủ', 'N'], ['台面', 'mặt bàn', 'N'], ['引孔', 'lỗ mồi', 'N'], ['预埋件', 'ốc cấy', 'N'], ['孔', 'lỗ', 'N'], ['槽', 'rãnh', 'N'],
    ['切角', 'cắt góc', 'N'], ['切口', 'vết cắt', 'N'], ['缺口', 'khuyết', 'N'], ['圆弧', 'cung', 'N'], ['板', 'ván', 'N'], ['模板', 'mẫu', 'N'], ['上层', 'tầng trên', 'N'], ['下层', 'tầng dưới', 'N'],
    ['左右', 'trái–phải', 'D'], ['前后', 'trước–sau', 'D'], ['上下', 'trên–dưới', 'D'], ['左侧', 'bên trái', 'D'], ['右侧', 'bên phải', 'D'], ['左', 'trái', 'D'], ['右', 'phải', 'D'], ['上', 'trên', 'D'], ['下', 'dưới', 'D'], ['前', 'trước', 'D'], ['后', 'sau', 'D'], ['内', 'trong', 'D'], ['外', 'ngoài', 'D'], ['中', 'giữa', 'D'], ['顶', 'nóc', 'D'], ['底', 'đáy', 'D'],
    ['预留间隙', 'khe chừa', 'A'], ['间隙', 'khe', 'A'], ['缝隙', 'khe', 'A'], ['留空', 'hở', 'A'], ['内空', 'lọt lòng', 'A'], ['内缩', 'lùi vào', 'A'], ['内退', 'lùi vào', 'A'], ['延伸', 'kéo dài', 'A'], ['平移', 'dịch', 'A'], ['移动', 'dịch', 'A'], ['移', 'dịch', 'A'], ['缩', 'lùi', 'A'], ['延', 'kéo dài', 'A'],
    ['距边', 'cách mép', 'A'], ['边距', 'cách mép', 'A'], ['间距', 'khoảng cách', 'A'], ['距离', 'khoảng cách', 'A'], ['距', 'cách', 'A'], ['靠', 'sát', 'A'], ['调整', 'chỉnh', 'A'], ['修正', 'hiệu chỉnh', 'A'], ['减', 'trừ', 'A'], ['扣', 'trừ', 'A'], ['包', 'bọc', 'A'], ['装', 'lắp', 'A'], ['位置', 'vị trí', 'A'],
    ['厚度', 'dày', 'M'], ['宽度', 'rộng', 'M'], ['高度', 'cao', 'M'], ['深度', 'sâu', 'M'], ['长度', 'dài', 'M'], ['半径', 'bán kính', 'M'], ['厚', 'dày', 'M'], ['宽', 'rộng', 'M'], ['高', 'cao', 'M'], ['深', 'sâu', 'M'], ['长', 'dài', 'M'],
    ['参数', 'tham số', 'S'], ['值', 'giá trị', 'S'], ['自动', 'tự động', 'X'],
  ].sort((a, b) => b[0].length - a[0].length);

  function ghep(s) {
    const ds = [];
    for (let i = 0; i < s.length;) {
      if (/[0-9A-Za-z\s\-_.+*/()（）]/.test(s[i])) { let j = i; while (j < s.length && /[0-9A-Za-z\s\-_.+*/()（）]/.test(s[j])) j++; ds.push([s.slice(i, j).trim(), 'X']); i = j; continue; }
      const t = TU.find(x => s.startsWith(x[0], i));
      if (!t) return null;      // còn chữ không biết → để nguyên tiếng Trung, không đoán
      ds.push([t[1], t[2]]); i += t[0].length;
    }
    // trật tự tiếng Việt: [tham số / giá trị] [số đo cuối câu] đưa lên đầu; chuỗi danh từ đảo ngược; hướng đứng sau danh từ / hành động
    const dau = [];
    while (ds.length && ds[ds.length - 1][1] === 'S') dau.push(ds.pop()[0]);
    if (ds.length && ds[ds.length - 1][1] === 'M') dau.push(ds.pop()[0]);
    const than = []; let cho = [];
    for (let k = 0; k < ds.length; k++) {
      const [v, l] = ds[k];
      if (!v) continue;
      if (l === 'D') { cho.push(v); continue; }
      if (l === 'N') { let j = k; const ns = []; while (j < ds.length && ds[j][1] === 'N') ns.unshift(ds[j++][0]); k = j - 1; than.push(...ns, ...cho); cho = []; continue; }
      than.push(v, ...cho); cho = [];
    }
    than.push(...cho);
    const out = dau.concat(than).join(' ').replace(/\s+/g, ' ').trim();
    return out ? '~' + out.charAt(0).toUpperCase() + out.slice(1) : null;
  }

  /** Dịch một ghi chú. Trả về chuỗi tiếng Việt, hoặc chính chuỗi cũ nếu không dịch được / không phải tiếng Trung. */
  function dich(s) {
    if (typeof s !== 'string') return s;
    const t = s.trim();
    if (!t || !CJK.test(t)) return s;
    if (Object.prototype.hasOwnProperty.call(CAU, t)) return CAU[t];
    return ghep(t) || s;
  }

  /* ---- 3. Đổi chữ hiển thị trong trang Chenfeng ---- */
  // ô ghi chú: cột thứ 3 của bảng tham số (bảng phải .template-params, bảng kho mẫu .template-detail) + tên nút trong cây mẫu bên phải
  const KHONG_TD = 'li:not(.template-params-header):not(.template-detail-header) > span:nth-child(3)';
  const CHON = '.template-params ' + KHONG_TD + ', .template-detail ' + KHONG_TD;
  let bat = true, mo = null, hen = 0;
  const doc = () => root.document;

  function doiO(el) {
    const n = el.firstChild;
    if (!n || n.nodeType !== 3 || el.childNodes.length !== 1) return 0;      // chỉ đụng ô có đúng một đoạn chữ
    const goc = n.nodeValue;
    if (!CJK.test(goc)) return 0;
    const vi = dich(goc);
    if (vi === goc) return 0;
    n.nodeValue = vi;                         // đổi nội dung nút chữ sẵn có (không thay nút) để React vẫn giữ đúng tham chiếu
    el.setAttribute('data-mncf-goc', goc);
    el.title = goc + ' → ' + vi;
    return 1;
  }
  function quet() {
    hen = 0;
    if (!bat) return 0;
    let n = 0;
    try {
      for (const el of doc().querySelectorAll(CHON)) n += doiO(el);
      // ô đã dịch nhưng Chenfeng vừa ghi chữ khác vào (đổi sang mẫu khác) → bỏ chú thích cũ
      for (const el of doc().querySelectorAll('[data-mncf-goc]')) { const t = el.firstChild; if (!t || t.nodeType !== 3 || t.nodeValue !== dich(el.getAttribute('data-mncf-goc'))) { el.removeAttribute('data-mncf-goc'); el.removeAttribute('title'); } }
    } catch (e) { /* không để lỗi lọt ra trang */ }
    return n;
  }
  function traLai() {
    try {
      for (const el of doc().querySelectorAll('[data-mncf-goc]')) {
        const n = el.firstChild, goc = el.getAttribute('data-mncf-goc');
        if (n && n.nodeType === 3 && el.childNodes.length === 1 && n.nodeValue === dich(goc)) n.nodeValue = goc;
        el.removeAttribute('data-mncf-goc'); el.removeAttribute('title');
      }
    } catch (e) { /* bỏ qua */ }
  }
  function henQuet() { if (!hen && bat) hen = root.setTimeout(quet, 60); }
  function khoiDong() {
    if (mo || typeof root.MutationObserver !== 'function' || !doc() || !doc().documentElement) return;
    try { bat = root.localStorage.getItem(LS) !== '0'; } catch (e) { bat = true; }
    mo = new root.MutationObserver(() => { try { henQuet(); } catch (e) { /* bỏ qua */ } });
    mo.observe(doc().documentElement, { childList: true, subtree: true, characterData: true });
    henQuet();
  }

  const API = {
    dich, ghep, CAU,
    get dangBat() { return bat; },
    bat() { bat = true; try { root.localStorage.removeItem(LS); } catch (e) { /* bỏ qua */ } return quet(); },
    tat() { bat = false; try { root.localStorage.setItem(LS, '0'); } catch (e) { /* bỏ qua */ } traLai(); },
    quet, khoiDong,
  };
  root.MNCFDich = API;
  (root.MNCF = root.MNCF || {}).dich = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

  try {
    const d = doc();
    if (d && root.location && /(^|\.)cfcad\.(cn|com)$/.test(root.location.hostname) && !/^\/help/.test(root.location.pathname) && !d.documentElement.hasAttribute('data-mncf-page')) {
      if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', khoiDong); else khoiDong();
    }
  } catch (e) { /* bỏ qua */ }
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));
