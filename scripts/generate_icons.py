"""生成古诗小达人APP图标"""
from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, filepath, maskable=False):
    """创建一个可爱的狗狗图标"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = size // 2, size // 2

    # maskable 模式需要更大的安全边距
    if maskable:
        r = int(size * 0.42)
    else:
        r = int(size * 0.48)

    # 绘制渐变背景圆
    for i in range(r, 0, -1):
        ratio = i / r
        # 从橙色到粉色的渐变
        red = int(255 * (1 - ratio * 0.1))
        green = int(140 + 50 * (1 - ratio))
        blue = int(90 + 100 * (1 - ratio))
        draw.ellipse(
            [cx - i, cy - i, cx + i, cy + i],
            fill=(red, green, blue, 255)
        )

    # 耳朵位置（更靠两侧、更圆润）
    ear_r = int(r * 0.28)
    ear_cx_offset = int(r * 0.55)
    ear_cy = cy - int(r * 0.45)

    # 左耳 - 棕色圆
    draw.ellipse(
        [cx - ear_cx_offset - ear_r, ear_cy - ear_r,
         cx - ear_cx_offset + ear_r, ear_cy + ear_r],
        fill=(160, 90, 50, 255)
    )
    # 左耳内
    draw.ellipse(
        [cx - ear_cx_offset - ear_r * 0.55, ear_cy - ear_r * 0.55,
         cx - ear_cx_offset + ear_r * 0.55, ear_cy + ear_r * 0.55],
        fill=(220, 140, 110, 255)
    )

    # 右耳
    draw.ellipse(
        [cx + ear_cx_offset - ear_r, ear_cy - ear_r,
         cx + ear_cx_offset + ear_r, ear_cy + ear_r],
        fill=(160, 90, 50, 255)
    )
    draw.ellipse(
        [cx + ear_cx_offset - ear_r * 0.55, ear_cy - ear_r * 0.55,
         cx + ear_cx_offset + ear_r * 0.55, ear_cy + ear_r * 0.55],
        fill=(220, 140, 110, 255)
    )

    # 脸（白色椭圆）
    face_r = int(r * 0.62)
    face_cy = cy + int(r * 0.05)
    draw.ellipse(
        [cx - face_r, face_cy - face_r * 0.95,
         cx + face_r, face_cy + face_r * 0.95],
        fill=(255, 255, 255, 255)
    )

    # 眼睛（黑色圆点 + 白色高光）
    eye_r = max(3, int(r * 0.10))
    eye_offset_x = int(r * 0.28)
    eye_y = face_cy - int(r * 0.05)

    # 左眼
    draw.ellipse(
        [cx - eye_offset_x - eye_r, eye_y - eye_r,
         cx - eye_offset_x + eye_r, eye_y + eye_r],
        fill=(35, 35, 35, 255)
    )
    # 右眼
    draw.ellipse(
        [cx + eye_offset_x - eye_r, eye_y - eye_r,
         cx + eye_offset_x + eye_r, eye_y + eye_r],
        fill=(35, 35, 35, 255)
    )

    # 眼睛高光
    hl_r = max(1, int(r * 0.04))
    hl_offset = int(r * 0.04)
    draw.ellipse(
        [cx - eye_offset_x + hl_offset - hl_r, eye_y - eye_r + hl_offset,
         cx - eye_offset_x + hl_offset + hl_r, eye_y - eye_r + hl_offset + hl_r * 2],
        fill=(255, 255, 255, 255)
    )
    draw.ellipse(
        [cx + eye_offset_x + hl_offset - hl_r, eye_y - eye_r + hl_offset,
         cx + eye_offset_x + hl_offset + hl_r, eye_y - eye_r + hl_offset + hl_r * 2],
        fill=(255, 255, 255, 255)
    )

    # 鼻子（黑色心形/椭圆）
    nose_w = int(r * 0.13)
    nose_h = int(r * 0.10)
    nose_y = face_cy + int(r * 0.18)
    draw.ellipse(
        [cx - nose_w, nose_y - nose_h, cx + nose_w, nose_y + nose_h],
        fill=(35, 35, 35, 255)
    )

    # 嘴巴（微笑）
    mouth_y = face_cy + int(r * 0.28)
    mouth_w = int(r * 0.18)
    mouth_h = int(r * 0.18)
    # 左侧弧线
    draw.arc(
        [cx - mouth_w, mouth_y, cx, mouth_y + mouth_h],
        0, 90, fill=(35, 35, 35, 255), width=max(2, int(r * 0.04))
    )
    # 右侧弧线
    draw.arc(
        [cx, mouth_y, cx + mouth_w, mouth_y + mouth_h],
        90, 180, fill=(35, 35, 35, 255), width=max(2, int(r * 0.04))
    )

    # 腮红
    cheek_w = int(r * 0.11)
    cheek_h = int(r * 0.07)
    cheek_y = face_cy + int(r * 0.12)
    cheek_offset = int(r * 0.42)
    draw.ellipse(
        [cx - cheek_offset - cheek_w, cheek_y - cheek_h,
         cx - cheek_offset + cheek_w, cheek_y + cheek_h],
        fill=(255, 182, 193, 220)
    )
    draw.ellipse(
        [cx + cheek_offset - cheek_w, cheek_y - cheek_h,
         cx + cheek_offset + cheek_w, cheek_y + cheek_h],
        fill=(255, 182, 193, 220)
    )

    img.save(filepath, 'PNG')
    print(f"Generated: {filepath} ({size}x{size})")

# 生成各种尺寸的图标
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
icons_dir = os.path.join(base_dir, 'icons')
os.makedirs(icons_dir, exist_ok=True)

create_icon(192, os.path.join(icons_dir, 'icon-192.png'))
create_icon(512, os.path.join(icons_dir, 'icon-512.png'))
create_icon(512, os.path.join(icons_dir, 'icon-512-maskable.png'), maskable=True)

print("\nAll icons generated successfully!")
