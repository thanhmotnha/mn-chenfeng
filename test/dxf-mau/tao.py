#!/usr/bin/env python3
# Tạo các file DXF MẪU TỰ BỊA cho test/dxf.test.js (bản 1.41.1 — nạp bản vẽ CAD).
# Mọi tên, số đo ở đây là bịa — KHÔNG chép số / chữ / ảnh từ bản vẽ thật của khách vào đây (kho công khai).
# Chạy:  python3 -I test/dxf-mau/tao.py    (cần ezdxf). Ghi đè các file *.dxf / *.dwg trong thư mục này.
import os, unicodedata
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
    hcn(m, -200, -100, 2700, 2650, lop=TUONG)
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

if __name__ == '__main__':
    tu_ao(); hai_tu(); loi(); vach_lung(); bep_1258(); tu_cm(); dwg()
