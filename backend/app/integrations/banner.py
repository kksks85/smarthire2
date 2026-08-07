import io
import os
from pathlib import Path
from typing import Optional
from PIL import Image, ImageDraw, ImageFont
import qrcode


def generate_hiring_banner(
    title: str,
    location: str,
    salary_min: Optional[int] = None,
    salary_max: Optional[int] = None,
    employment_type: str = "Full-Time",
    company_name: str = "SMART HIRE BY LAYAM GROUP",
    apply_url: Optional[str] = None,
) -> bytes:
    """
    Generate a 1080x1350 4:5 Vertical Portrait Canva-Grade Hiring Poster.
    Bundles local TTF fonts so typography is ALWAYS 100% vector sharp at full size (48px - 125px)
    across all environments (Docker, Windows, Linux, production).
    """
    width, height = 1080, 1350

    # 1. Base Canvas - Pure Crisp White (#FFFFFF)
    img = Image.new("RGB", (width, height), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)

    # Bulletproof Font Loader using bundled TTF font
    def load_font(size: int, bold: bool = True):
        font_filename = "Roboto-Bold.ttf" if bold else "Roboto-Regular.ttf"
        bundled_font_path = Path(__file__).parent / "fonts" / font_filename
        
        if bundled_font_path.is_file():
            try:
                return ImageFont.truetype(str(bundled_font_path), size)
            except Exception:
                pass
                
        # System font fallbacks
        font_paths = [
            r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
            r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        ]
        for path in font_paths:
            if os.path.exists(path):
                try:
                    return ImageFont.truetype(path, size)
                except Exception:
                    continue
        try:
            return ImageFont.load_default(size=size)
        except Exception:
            return ImageFont.load_default()

    font_company = load_font(38, bold=True)
    font_were = load_font(65, bold=True)
    font_hiring = load_font(125, bold=True)
    font_job_title = load_font(72, bold=True)
    font_label = load_font(48, bold=True)
    font_value = load_font(48, bold=True)
    font_cta = load_font(58, bold=True)
    font_footer = load_font(26, bold=True)

    # 2. Top Header Banner - Royal Blue (#1D4ED8)
    header_h = 360
    draw.rectangle([0, 0, width, header_h], fill=(29, 78, 216))

    # Top Geometric Wave Accents
    draw.polygon([(550, 0), (1080, 0), (1080, 360), (720, 180)], fill=(37, 99, 235))
    draw.polygon([(780, 0), (1080, 0), (1080, 280)], fill=(96, 165, 250))
    draw.ellipse([880, 40, 1020, 180], fill=(255, 255, 255, 220))

    # Company Branding Header
    draw.text((60, 45), company_name.upper(), fill=(191, 219, 254), font=font_company, stroke_width=1, stroke_fill=(191, 219, 254))

    # Main Header Text: "WE'RE HIRING"
    draw.text((60, 105), "WE'RE", fill=(255, 255, 255), font=font_were, stroke_width=2, stroke_fill=(255, 255, 255))
    draw.text((60, 175), "HIRING", fill=(255, 255, 255), font=font_hiring, stroke_width=3, stroke_fill=(255, 255, 255))

    # Accent Gold Badge on Header
    draw.rounded_rectangle([560, 215, 880, 290], radius=20, fill=(245, 158, 11))
    draw.text((585, 232), "URGENT HIRING", fill=(255, 255, 255), font=load_font(28, bold=True), stroke_width=1, stroke_fill=(255, 255, 255))

    # 3. Main White Content Card (#FFFFFF)
    card_rect = [45, 410, 1035, 1120]

    # Card Shadow
    draw.rounded_rectangle([49, 414, 1039, 1124], radius=28, fill=(226, 232, 240))
    # White Card Body
    draw.rounded_rectangle(card_rect, radius=28, fill=(255, 255, 255), outline=(203, 213, 225), width=4)

    # Position Label & Title
    draw.text((80, 440), "OPEN POSITION:", fill=(100, 116, 139), font=load_font(34, bold=True), stroke_width=1, stroke_fill=(100, 116, 139))
    
    display_title = title.title() if len(title) <= 20 else title[:18].title() + "..."
    draw.text((80, 490), display_title, fill=(15, 23, 42), font=font_job_title, stroke_width=2, stroke_fill=(15, 23, 42))

    # Accent Underline Bar
    draw.line([(80, 580), (360, 580)], fill=(37, 99, 235), width=10)

    # Details Container (#F8FAFC)
    box_rect = [80, 610, 1000, 1090]
    draw.rounded_rectangle(box_rect, radius=22, fill=(248, 250, 252), outline=(203, 213, 225), width=3)

    row_y = 645

    # Location Row
    draw.text((110, row_y), "📍  LOCATION", fill=(15, 23, 42), font=font_label, stroke_width=2, stroke_fill=(15, 23, 42))
    loc_text = location if len(location) <= 22 else location[:20] + "..."
    draw.text((460, row_y), loc_text, fill=(15, 23, 42), font=font_value, stroke_width=2, stroke_fill=(15, 23, 42))
    row_y += 140

    # Thick Row Divider Line
    draw.line([(110, row_y - 30), (970, row_y - 30)], fill=(203, 213, 225), width=3)

    # Salary Row
    if salary_min and salary_max:
        salary_str = f"₹{salary_min:,} - ₹{salary_max:,}/mo"
    elif salary_min:
        salary_str = f"₹{salary_min:,}/mo"
    else:
        salary_str = "Best in Industry"

    draw.text((110, row_y), "💰  SALARY", fill=(15, 23, 42), font=font_label, stroke_width=2, stroke_fill=(15, 23, 42))
    draw.text((460, row_y), salary_str, fill=(4, 120, 87), font=font_value, stroke_width=2, stroke_fill=(4, 120, 87))
    row_y += 140

    # Thick Row Divider Line
    draw.line([(110, row_y - 30), (970, row_y - 30)], fill=(203, 213, 225), width=3)

    # Job Type Row
    draw.text((110, row_y), "💼  JOB TYPE", fill=(15, 23, 42), font=font_label, stroke_width=2, stroke_fill=(15, 23, 42))
    draw.text((460, row_y), employment_type.title(), fill=(15, 23, 42), font=font_value, stroke_width=2, stroke_fill=(15, 23, 42))

    # 4. Apply CTA Button ("APPLY NOW" Emerald Green Pill)
    cta_rect = [45, 1150, 1035, 1265]
    draw.rounded_rectangle(cta_rect, radius=26, fill=(5, 150, 105))
    draw.text((395, 1178), "APPLY NOW", fill=(255, 255, 255), font=font_cta, stroke_width=2, stroke_fill=(255, 255, 255))

    if apply_url:
        qr = qrcode.make(apply_url).convert("RGB")
        qr.thumbnail((100, 100))
        qr_frame = Image.new("RGB", (110, 110), "white")
        qr_frame.paste(qr, ((110 - qr.width) // 2, (110 - qr.height) // 2))
        img.paste(qr_frame, (60, 1153))

    # 5. Bottom Footer Text
    draw.text((200, 1285), "Click apply link in description or scan QR code to register", fill=(100, 116, 139), font=font_footer, stroke_width=1, stroke_fill=(100, 116, 139))

    output = io.BytesIO()
    img.save(output, format="JPEG", quality=85, optimize=True)
    return output.getvalue()
