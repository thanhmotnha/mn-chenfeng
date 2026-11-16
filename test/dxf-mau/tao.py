#!/usr/bin/env python3
# Tạo các file DXF MẪU TỰ BỊA cho test/dxf.test.js (bản 1.42.0 — nạp bản vẽ CAD).
# Mọi tên, số đo ở đây là bịa — KHÔNG chép số / chữ / ảnh từ bản vẽ thật của khách vào đây (kho công khai).
# Chạy:  python3 -I test/dxf-mau/tao.py [tên hàm …]   (cần ezdxf). Không tên = tạo lại mọi file *.dxf / *.dwg trong thư mục này.
import os, sys, unicodedata
import ezdxf

HERE = os.path.dirname(os.path.abspath(__file__))
NT, DIM, TXT, LED, TUONG, KHUAT, TB = 'NT-Noi that', 'KT-Dim', 'KT-Text', 'Den LED', 'Tuong', 'Net khuat', 'Thiet bi'

def moi(ver='R2018'):
    d = ezdxf.new(ver, setup=['dimstyles'])
    d.header['$INSUNITS'] = 4
    for l in (NT, DIM, TXT, LED, TUONG, KHUAT, TB):
        d.layers.add(l)
    ds = d.dimstyles.get('EZDXF'); ds.dxf.dimdec = 0; ds.dxf.dimlfac = 1; ds.dxf.dimtxt = 40; ds.dxf.dimasz = 20; ds.dxf.dimexo = 5
    return d

def hcn(m, x0, y0, x1, y1, lop=NT, kin=True):
    m.add_lwpolyline([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], close=kin, dxfattribs={'layer': lop})

def kt(m, p1, p2, cach, dung=False, text=None):
    if dung:
        dim = m.add_linear_dim(base=(cach, (p1[1] + p2[1]) / 2), p1=p1, p2=p2, angle=90, dimstyle='EZDXF', dxfattribs={'layer': DIM}, **({'text': text} if text else {}))
    else:
        dim = m.add_linear_dim(base=((p1[0] + p2[0]) / 2, cach), p1=p1, p2=p2, angle=0, dimstyle='EZDXF', dxfattribs={'layer': DIM}, **({'text': text} if text else {}))
    dim.render()

def chuoi(m, xs, y, oy=0, ox=0, dung=False):
    for a, b in zip(xs, xs[1:]):
        if dung: kt(m, (ox, a), (ox, b), y, True)
        else: kt(m, (a, oy), (b, oy), y)

def chu(m, s, x, y, h=35, lop=TXT, dinh=5):
    m.add_mtext(s, dxfattribs={'layer': lop, 'char_height': h, 'insert': (x, y), 'attachment_point': dinh})

def khoi_suot(d):
    b = d.blocks.new('SUOT-TREO')
    b.add_lwpolyline([(0, -12), (1000, -12), (1000, 12), (0, 12)], close=True, dxfattribs={'layer': TB})
    b.add_circle((0, 0), 15, dxfattribs={'layer': TB}); b.add_circle((1000, 0), 15, dxfattribs={'layer': TB})
    a = d.blocks.new_anonymous_block('U')      # khối vô danh *U (khối động) — cùng hình
    a.add_lwpolyline([(0, -12), (1000, -12), (1000, 12), (0, 12)], close=True, dxfattribs={'layer': '0'})
    a.add_circle((0, 0), 15, dxfattribs={'layer': '0'}); a.add_circle((1000, 0), 15, dxfattribs={'layer': '0'})
    return b.name, a.name

def luu(d, ten):
    p = os.path.join(HERE, ten); d.saveas(p); print('  ', ten, os.path.getsize(p), 'byte')

# ---------------- 1. tủ áo 3 khoang: ngăn kéo + suốt treo, hai thân, phào phải + phào trên, chân 100 ----------------
def tu_ao():
    d = moi(); m = d.modelspace(); suot, suotU = khoi_suot(d)
    T = 17
    X = [0, 17, 817.5, 834.5, 1784, 1801, 2401, 2418]      # hồi trái | K1 800,5 | vách | K2 949,5 | vách | K3 600 | hồi phải
    W, H, CD, CH = 2468, 2450, 2150, 100
    hcn(m, 2418, 0, 2468, 2400)                    # phào phải 50
    hcn(m, 0, 2400, 2468, 2450)                    # phào trên 50
    hcn(m, 17, 0, 2401, CH)                        # xà chân
    for a, b in [(0, 17), (817.5, 834.5), (1784, 1801), (2401, 2418)]:
        hcn(m, a, 0, b, CD); hcn(m, a, CD, b, 2400)
    K = [(17, 817.5), (834.5, 1784), (1801, 2401)]
    for a, b in K:
        hcn(m, a, CH, b, CH + T); hcn(m, a, CD - T, b, CD); hcn(m, a, CD, b, CD + T); hcn(m, a, 2400 - T, b, 2400)
    # K1: đợt +1600, suốt treo dưới đợt
    hcn(m, 17, 1600, 817.5, 1617)
    m.add_blockref(suot, (27.5, 1520), dxfattribs={'layer': TUONG, 'xscale': 0.78})
    chu(m, 'KHOANG TREO\\PĐỒ DÀI', 417, 900)
    # K2: vùng ngăn kéo (vách đệm 50 hai bên, ray 25), đợt +700, suốt treo trên (khối *U lật gương)
    hcn(m, 834.5, 117, 884.5, 700); hcn(m, 1734, 117, 1784, 700)
    for z in (117, 311, 505):
        hcn(m, 884.5, z, 1734, z + 25, kin=False)
    hcn(m, 834.5, 700, 1784, 717)
    for z in (142, 336, 530):
        hcn(m, 894.5, z + 5, 1724, z + 160, lop=KHUAT)       # hộp ngăn kéo (nét khuất)
        chu(m, 'NGĂN KÉO', 1309, z + 80)
    m.add_blockref(suotU, (1774, 2050), dxfattribs={'layer': TUONG, 'xscale': -0.92})
    # K3: 3 đợt
    for z in (500.3, 900.6, 1300.9):                 # cao lẻ: số ghi làm tròn, chuỗi cộng hụt 1 so với tổng
        hcn(m, 1801, z, 2401, z + 17)
    chuoi(m, [0, 500.3, 900.6, 1300.9, 2450], 2700, ox=2468, dung=True)
    kt(m, (2468, 0), (2468, 2450), 2900, True)
    # đèn LED dưới nóc K1 thân trên, tường (bỏ qua)
    m.add_line((40, 2370), (800, 2370), dxfattribs={'layer': LED})
    hcn(m, -200, -100, 2700, 2680, lop=TUONG)
    # kích thước: chuỗi ngang + tổng, chuỗi đứng + tổng
    chuoi(m, X + [2468], -250)
    kt(m, (0, 0), (2468, 0), -450)
    chuoi(m, [0, CH, CH + T, 1600, 1617, CD, 2400, 2450], -250, ox=0, dung=True)
    kt(m, (0, 0), (0, 2450), -450, True)
    chu(m, '{\\fArial|b1|i0|c0|p34;TỦ ÁO} PHÒNG NGỦ MẪU', 1234, -800, h=70, dinh=2)
    luu(d, 'tu-ao.dxf')

# ---------------- 2. hai tủ trên một tờ, một tên; tủ (1) có 2 hồi áp lưng; tủ (2) có mặt cắt cho sâu ----------------
def hai_tu():
    d = moi('R2010'); m = d.modelspace()
    T = 17
    # tủ (1): hai thùng riêng 600 + 500 áp lưng ở giữa, cao 2000, chân 80
    for a, b in [(0, 17), (617, 634), (634, 651), (1151, 1168)]:
        hcn(m, a, 0, b, 2000)
    for a, b in [(17, 617), (651, 1151)]:
        hcn(m, a, 80, b, 97); hcn(m, a, 2000 - T, b, 2000); hcn(m, a, 1000, b, 1017)
    hcn(m, 17, 0, 617, 80); hcn(m, 651, 0, 1151, 80)
    chu(m, 'KỆ HỞ', 300, 500)
    # tủ (2): 1 khoang 700, cao 1800, không chân
    ox = 1800
    hcn(m, ox, 0, ox + 17, 1800); hcn(m, ox + 717, 0, ox + 734, 1800)
    hcn(m, ox + 17, 0, ox + 717, 17); hcn(m, ox + 17, 1783, ox + 717, 1800); hcn(m, ox + 17, 900, ox + 717, 917)
    # mặt cắt của tủ (2): sâu 450
    sx = 2900
    hcn(m, sx, 0, sx + 450, 17); hcn(m, sx, 1783, sx + 450, 1800); hcn(m, sx, 900, sx + 433, 917); hcn(m, sx + 444, 0, sx + 450, 1800)
    chu(m, 'MẶT CẮT A-A', sx + 225, -150, h=40)
    chu(m, 'TỦ GIÀY SẢNH MẪU', 1484, -300, h=60, dinh=2)
    luu(d, 'hai-tu.dxf')

# ---------------- 3. bản vẽ có lỗi: chuỗi không cộng ra tổng, chữ số gõ tay, ván 30, đợt dài 1100, khoang thiếu nóc ----------------
def loi():
    d = moi(); m = d.modelspace()
    T = 17
    # hồi | K1 1100 | vách | K2 600 | hồi  → W 1751, cao 2000, chân 0
    for a, b in [(0, 17), (1117, 1134), (1734, 1751)]:
        hcn(m, a, 0, b, 2000)
    hcn(m, 17, 0, 1117, 17); hcn(m, 1134, 0, 1734, 17)
    hcn(m, 17, 1983, 1117, 2000)                   # K2 không có nóc
    hcn(m, 17, 800, 1117, 830)                     # đợt dày 30
    hcn(m, 1134, 1000, 1734, 1017)
    kt(m, (0, 0), (17, 0), -250); kt(m, (17, 0), (1117, 0), -250)
    kt(m, (1134, 0), (1734, 0), -250, text='610')  # chữ số gõ tay (hình 600) + chuỗi hở 17 (thiếu đoạn vách)
    kt(m, (1734, 0), (1751, 0), -250)
    kt(m, (0, 0), (1751, 0), -450, text='1760')    # tổng gõ tay
    kt(m, (0, 0), (0, 802), -250, True)            # điểm đo lệch mép đợt 2 mm
    chu(m, 'TỦ SÁCH LỖI MẪU', 875, -700, h=60, dinh=2)
    luu(d, 'loi.dxf')

# ---------------- 4. vách lửng chia vùng ngăn kéo 2 cột + một vách ốp (loại "khác") ----------------
def vach_lung():
    d = moi(); m = d.modelspace()
    for a, b in [(0, 17), (917, 934)]:
        hcn(m, a, 0, b, 2100)
    hcn(m, 17, 100, 917, 117); hcn(m, 17, 2083, 917, 2100); hcn(m, 17, 0, 917, 100)
    hcn(m, 17, 117, 67, 650); hcn(m, 867, 117, 917, 650)      # vách đệm
    hcn(m, 458.5, 117, 475.5, 650)                              # vách lửng giữa vùng ngăn kéo
    hcn(m, 17, 650, 917, 667)
    for x in (240, 690):
        for z in (250, 480):
            chu(m, 'NGĂN KÉO', x, z)
    chu(m, 'TỦ ÁO VÁCH LỬNG MẪU', 467, -300, h=60, dinh=2)
    # vách ốp ở tờ khác
    vx = 4000
    for i in range(5):
        hcn(m, vx + i * 400, 0, vx + i * 400 + 18, 2400)
    hcn(m, vx, 0, vx + 1618, 18); hcn(m, vx, 2382, vx + 1618, 2400)
    chu(m, 'VÁCH ỐP SẢNH MẪU', vx + 800, -300, h=60, dinh=2)
    luu(d, 'vach-lung.dxf')

# ---------------- 5. bếp, file cũ R2000 bảng mã ANSI_1258 (chữ tổ hợp dấu như máy Việt cũ) ----------------
def bep_1258():
    d = moi('R2000'); d.encoding = 'cp1258'; m = d.modelspace()
    nfd = lambda s: unicodedata.normalize('NFD', s)
    def day(ox, W, nhan):
        xs = list(range(0, W + 1, 600))
        for x in xs:
            a = min(x, W - 17)
            hcn(m, ox + a, 100, ox + a + 17, 870)
        for a, b in zip(xs, xs[1:]):
            hcn(m, ox + a + 17, 100, ox + b, 117); hcn(m, ox + a + 17, 0, ox + b, 100)
            hcn(m, ox + a + 17, 470, ox + b, 487)
        for s, x in nhan:
            m.add_text(nfd(s), dxfattribs={'layer': TXT, 'height': 35, 'insert': (ox + x, 300)})
    day(0, 3600, [('CHẬU RỬA', 1300), ('BẾP TỪ', 2600), ('MÁY RỬA BÁT', 700)])
    m.add_text(nfd('TỦ BẾP MẪU'), dxfattribs={'layer': TXT, 'height': 60, 'insert': (1500, -400)})
    day(5000, 2400, [('TỦ LẠNH', 300)])
    m.add_text('T\\U+1EE6 B\\U+1EBEP M\\U+1EAAU', dxfattribs={'layer': TXT, 'height': 60, 'insert': (6000, -400)})
    luu(d, 'bep-1258.dxf')

# ---------------- 6. bản vẽ đơn vị cm ($INSUNITS 5): tủ 1 khoang 800 × 1800 vẽ theo cm ----------------
def tu_cm():
    d = moi(); d.header['$INSUNITS'] = 5; m = d.modelspace()
    c = lambda *v: [x / 10 for x in v]
    for a, b in [(0, 17), (817, 834)]:
        hcn(m, *c(a, 0, b, 1800))
    hcn(m, *c(17, 0, 817, 17)); hcn(m, *c(17, 1783, 817, 1800)); hcn(m, *c(17, 900, 817, 917))
    chu(m, 'TỦ ĐƠN VỊ CM MẪU', 41.7, -30, h=6, dinh=2)
    luu(d, 'tu-cm.dxf')

def dwg():
    p = os.path.join(HERE, 'gia.dwg')
    with open(p, 'wb') as f: f.write(b'AC1032' + bytes(range(256)) * 2)
    print('   gia.dwg', os.path.getsize(p), 'byte')

# ================= bản 1.42.0: vòng soát với bản vẽ thật (mọi tình huống dựng lại bằng số / tên BỊA) =================
KHUNG = 'Khung giay'

def khung(m, x0, y0, w, h):
    hcn(m, x0, y0, x0 + w, y0 + h, lop=KHUNG)

def thung_don(m, ox, oy, rong, cao, khoang, T=17, day=True, noc=True):
    """hồi | khoang … | hồi; khoang = lọt lòng từng khoang; trả các mốc x"""
    x = ox; xs = []
    hcn(m, x, oy, x + T, oy + cao); x += T
    for i, k in enumerate(khoang):
        xs.append((x, x + k))
        if day: hcn(m, x, oy, x + k, oy + T)
        if noc: hcn(m, x, oy + cao - T, x + k, oy + cao)
        x += k
        hcn(m, x, oy, x + T, oy + cao); x += T
    return xs

# 7. MẶT BÊN không ghi "mặt cắt" (cùng tờ, cùng cao) → chiều sâu; tờ chỉ có tấm ốp dày → vẫn một mục; tên tờ ở THUỘC TÍNH khung tên
def mat_ben():
    d = moi(); m = d.modelspace(); d.layers.add(KHUNG)
    khung(m, -600, -1000, 6000, 4000)
    thung_don(m, 0, 0, 1600, 2400, [783, 766])
    hcn(m, 17, 1200, 800, 1217); hcn(m, 817, 900, 1583, 917)
    sx = 2600      # mặt bên: rộng 560 = dải trước 100 + thùng 443 + hậu 17 (bịa)
    hcn(m, sx, 0, sx + 560, 17); hcn(m, sx, 2383, sx + 560, 2400); hcn(m, sx + 543, 0, sx + 560, 2400); hcn(m, sx + 100, 1200, sx + 543, 1217)
    chuoi(m, [sx, sx + 100, sx + 543, sx + 560], -250)
    chu(m, 'TỦ SÁCH PHÒNG MẪU', 800, -500, h=60, dinh=2)
    # tờ 2: chỉ 2 tấm ván + tấm ốp dày 120
    khung(m, 6000, -1000, 5000, 4000)
    for i in range(3): hcn(m, 6500 + i * 1000, 0, 6620 + i * 1000, 2400)
    hcn(m, 6620, 0, 6638, 2400); hcn(m, 7620, 0, 7638, 2400)
    chu(m, 'VÁCH ỐP PHÒNG MẪU', 7500, -500, h=60, dinh=2)
    # tờ 3: khung tên là khối có THUỘC TÍNH (ATTRIB) mang tên tờ; tủ không có chữ nào khác
    b = d.blocks.new('KHUNG-A3')
    b.add_lwpolyline([(0, 0), (5000, 0), (5000, 4000), (0, 4000)], close=True, dxfattribs={'layer': KHUNG})
    b.add_attdef('TEN', (3000, 200), dxfattribs={'height': 80, 'layer': TXT})
    r = m.add_blockref('KHUNG-A3', (12000, -1000), dxfattribs={'layer': KHUNG})
    r.add_attrib('TEN', 'TỦ GIÀY THUỘC TÍNH MẪU', (15000, -800), dxfattribs={'height': 80, 'layer': TXT})
    thung_don(m, 12500, 0, 934, 1500, [900])
    hcn(m, 12517, 700, 13417, 717)
    luu(d, 'mat-ben.dxf')

# 8. khoang mép không hồi (kệ hở), nhãn MTEXT căn trái đặt ngay mặt vách, vùng ngăn kéo có thanh dưới sát sàn (không đáy), khoang 1 cánh mép phải, dải hộc sàn thấp
def ke_mo():
    d = moi(); m = d.modelspace()
    # tủ 1: K1 không hồi trái 300 | vách | K2 ngăn kéo 900 | vách | K3 500 "KỆ HỞ" | hồi  → rộng 1751, cao 2000
    for a, b in [(300, 317), (1217, 1234), (1734, 1751)]: hcn(m, a, 0, b, 2000)
    for a, b in [(0, 300), (317, 1217), (1234, 1734)]: hcn(m, a, 1983, b, 2000)
    hcn(m, 0, 0, 300, 17); hcn(m, 1234, 0, 1734, 17); hcn(m, 1234, 1000, 1734, 1017); hcn(m, 0, 1000, 300, 1017)
    hcn(m, 317, 0, 367, 600); hcn(m, 1167, 0, 1217, 600)       # vách đệm
    for z in (0, 200, 400): hcn(m, 367, z, 1167, z + 25)        # thanh dưới / ray — không có đáy riêng
    hcn(m, 317, 600, 1217, 617)
    chu(m, 'NGĂN KÉO', 767, 300)
    chu(m, 'KỆ HỞ', 1225.5, 1500, h=35, dinh=1)                # điểm chèn (góc trên trái) nằm giữa vách — tâm chữ ở K3
    chu(m, 'TỦ KỆ MỞ MẪU', 875, -400, h=60, dinh=2)
    # tủ 2: hai khoang 700 + 450 (khoang 1 cánh ở mép phải)
    thung_don(m, 3000, 0, 0, 1800, [700, 450])
    hcn(m, 3017, 900, 3717, 917); hcn(m, 3734, 900, 4184, 917)
    chu(m, 'TỦ HAI KHOANG MẪU', 3600, -400, h=60, dinh=2)
    # dải hộc sàn cao 200 có vách chia
    ox = 6000
    hcn(m, ox, 0, ox + 17, 200); hcn(m, ox + 617, 0, ox + 634, 200); hcn(m, ox + 1234, 0, ox + 1251, 200)
    hcn(m, ox + 17, 183, ox + 617, 200); hcn(m, ox + 634, 183, ox + 1234, 200)
    chu(m, 'NGĂN KÉO', ox + 317, 100, h=30); chu(m, 'NGĂN KÉO', ox + 934, 100, h=30)
    chu(m, 'KỆ SÀN MẪU', ox + 625, -400, h=60, dinh=2)
    luu(d, 'ke-mo.dxf')

# 9. tủ dưới cầu thang: hồi / vách đỉnh vát (tứ giác), nóc dốc (hình bình hành)
def vat():
    d = moi(); m = d.modelspace()
    poly = lambda pts: m.add_lwpolyline(pts, close=True, dxfattribs={'layer': NT})
    poly([(0, 0), (17, 0), (17, 1000), (0, 990)])
    poly([(517, 0), (534, 0), (534, 1330), (517, 1320)])
    poly([(1034, 0), (1051, 0), (1051, 1660), (1034, 1650)])
    hcn(m, 1551, 0, 1568, 2000)
    for a, b in [(17, 517), (534, 1034), (1051, 1551)]:
        hcn(m, a, 0, b, 17); hcn(m, a, 500, b, 517)
    poly([(0, 990), (1568, 2000), (1568, 2017), (0, 1007)])     # nóc dốc
    chu(m, 'TỦ VÁT CẦU THANG MẪU', 784, -400, h=60, dinh=2)
    luu(d, 'vat.dxf')

# 10. chuỗi kích thước: thiếu đoạn thanh 25, không ghi hai hồi áp lưng, kích thước tổng nằm cùng đường; bếp có khoảng tường giữa tủ dưới và tủ trên
def chuoi_kt():
    d = moi(); m = d.modelspace()
    for a, b in [(0, 17), (617, 634), (634, 651), (1251, 1268)]: hcn(m, a, 0, b, 2000)
    for a, b in [(17, 617), (651, 1251)]:
        hcn(m, a, 0, b, 17); hcn(m, a, 1983, b, 2000); hcn(m, a, 1200, b, 1217)
    hcn(m, 651, 400, 1251, 425); hcn(m, 651, 800, 1251, 825)
    chuoi(m, [0, 17, 400, 425, 800], 1500, ox=1268, dung=True)          # bỏ đoạn 800 … 825
    chuoi(m, [825, 1200, 1217, 1983, 2000], 1500, ox=1268, dung=True)
    kt(m, (0, 0), (617, 0), -200); kt(m, (651, 0), (1268, 0), -200); kt(m, (0, 0), (1268, 0), -200)   # tổng nằm CÙNG đường
    chu(m, 'TỦ CHUỖI MẪU', 634, -500, h=60, dinh=2)
    ox = 4000      # bếp: tủ dưới 0 … 870, tủ trên 1500 … 2200
    for x in (0, 583, 1183):
        hcn(m, ox + x, 0, ox + x + 17, 870); hcn(m, ox + x, 1500, ox + x + 17, 2200)
    for a, b in [(17, 583), (600, 1183)]:
        hcn(m, ox + a, 0, ox + b, 17); hcn(m, ox + a, 1500, ox + b, 1517); hcn(m, ox + a, 2183, ox + b, 2200)
    chuoi(m, [0, 870], 1400, ox=ox + 1200, dung=True); chuoi(m, [1500, 2200], 1400, ox=ox + 1200, dung=True)
    kt(m, (ox + 1200, 0), (ox + 1200, 2200), ox + 1600, True)
    for xx in (1800, 1900, 2000):                                          # ba kích thước giống hệt nhau, chữ gõ tay → một dòng
        kt(m, (ox, 0), (ox, 870), ox - xx + 1200 - 1000, True, text='880')
    chu(m, 'TỦ BẾP CHUỖI MẪU', ox + 600, -500, h=60, dinh=2)
    luu(d, 'chuoi-kt.dxf')

# 11. đơn vị / tỉ lệ: cm có kích thước không dựng khối (*D), header ghi inch mà hình là mm, hình vẽ tỉ lệ 1:2 với DIMLFAC 2
def tu_don(m, s=1, ox=0, ten='TỦ THỬ MẪU', lop_dim=DIM, render=True, do=None):
    q = lambda *v: [ox + x * s if i % 2 == 0 else x * s for i, x in enumerate(v)]
    for a, b in [(0, 17), (817, 834), (1434, 1451)]: hcn(m, *q(a, 0, b, 1800))
    for a, b in [(17, 817), (834, 1434)]:
        hcn(m, *q(a, 0, b, 17)); hcn(m, *q(a, 1783, b, 1800)); hcn(m, *q(a, 900, b, 917))
    dm = m.add_linear_dim(base=(ox + 700 * s, -200 * s), p1=(ox, 0), p2=(ox + 1451 * s, 0), angle=0, dimstyle='EZDXF', dxfattribs={'layer': lop_dim})
    if render: dm.render()
    else: dm.dimension.dxf.actual_measurement = do if do is not None else 1451 * s
    chu(m, ten, ox + 725 * s, -450 * s, h=60 * s, dinh=2)

def don_vi():
    d = moi(); d.header['$INSUNITS'] = 5; tu_don(d.modelspace(), s=0.1, render=False); luu(d, 'cm-khong-khoi.dxf')
    d = moi(); d.header['$INSUNITS'] = 1; tu_don(d.modelspace()); luu(d, 'inch-hinh-mm.dxf')
    d = moi(); d.dimstyles.get('EZDXF').dxf.dimlfac = 2; tu_don(d.modelspace(), s=0.5); luu(d, 'ti-le-12.dxf')

# 12. nóc dày 30 lọt giữa hồi (không phải phào), đáy dày 25 sát sàn (không phải chân); tên tủ nằm trong khối chèn lật gương
def day_la():
    for ten, nt, dt in [('noc-30.dxf', 30, 17), ('day-25.dxf', 17, 25)]:
        d = moi(); m = d.modelspace()
        for a, b in [(0, 17), (817, 834), (1434, 1451)]: hcn(m, a, 0, b, 2000)
        hcn(m, 17, 2000 - nt, 1434, 2000)
        hcn(m, 17, 0, 817, dt); hcn(m, 834, 0, 1434, dt)
        hcn(m, 17, 1000, 817, 1017); hcn(m, 834, 1000, 1434, 1017)
        chu(m, 'TỦ VÁN LẠ MẪU', 725, -300, h=60, dinh=2)
        luu(d, ten)
    d = moi(); b = d.blocks.new('TU-KHOI'); tu_don(b, ten='TỦ TRONG KHỐI MẪU')
    d.modelspace().add_blockref('TU-KHOI', (9000, 4000), dxfattribs={'xscale': -1})
    luu(d, 'khoi-ten.dxf')

# 13. chữ font Việt cũ TCVN3 (.VnTime): ký tự Latin-1 lạ, không phải chữ Unicode
def tcvn3():
    d = moi('R2000'); d.encoding = 'cp1252'; m = d.modelspace()
    d.styles.add('VN', font='.VnTime.ttf')
    tu_don(m, ten='Tñ S¸CH M©U')
    m.add_text('NG¡N KÐO', dxfattribs={'layer': TXT, 'height': 35, 'insert': (300, 400), 'style': 'VN'})
    m.add_text('Kª H­', dxfattribs={'layer': TXT, 'height': 35, 'insert': (1000, 400), 'style': 'VN'})
    luu(d, 'tcvn3.dxf')

# 14. khối lồng nhau chèn nhiều lần (4 tầng × 40) — file nhỏ, bung ra hàng triệu nét
def long_nhau():
    d = moi(); m = d.modelspace()
    b0 = d.blocks.new('L0')
    for k in range(3): b0.add_lwpolyline([(k * 20, 0), (k * 20 + 17, 0), (k * 20 + 17, 500), (k * 20, 500)], close=True, dxfattribs={'layer': NT})
    prev = 'L0'
    for lv in range(1, 4):
        b = d.blocks.new('L%d' % lv)
        for k in range(40): b.add_blockref(prev, (k * 3000 * lv, 0))
        prev = 'L%d' % lv
    for k in range(40): m.add_blockref(prev, (k * 1e6, 0))
    luu(d, 'long-nhau.dxf')

# 15. nhiều tủ một file (danh sách dài — giao diện giữ chỗ cuộn khi bấm mục ở dưới)
def nhieu_tu():
    d = moi(); m = d.modelspace()
    for i in range(10):
        ox = i * 2000
        thung_don(m, ox, 0, 0, 1200, [600 + 20 * i])
        hcn(m, ox + 17, 600, ox + 617 + 20 * i, 617)
        chu(m, 'TỦ SỐ %d MẪU' % (i + 1), ox + 320, -300, h=60, dinh=2)
    luu(d, 'nhieu-tu.dxf')

MOI = {'mat_ben': mat_ben, 'ke_mo': ke_mo, 'vat': vat, 'chuoi_kt': chuoi_kt, 'don_vi': don_vi, 'day_la': day_la, 'tcvn3': tcvn3, 'long_nhau': long_nhau, 'nhieu_tu': nhieu_tu}

if __name__ == '__main__':
    CU = {'tu_ao': tu_ao, 'hai_tu': hai_tu, 'loi': loi, 'vach_lung': vach_lung, 'bep_1258': bep_1258, 'tu_cm': tu_cm, 'dwg': dwg}
    ds = sys.argv[1:] or list(CU) + list(MOI)
    for t in ds: dict(CU, **MOI)[t]()
