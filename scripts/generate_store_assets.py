import os
from PIL import Image, ImageEnhance, ImageFilter

def generate_assets():
    base_dir = "/Users/ajitprajapati/Afoodoo"
    store_dir = os.path.join(base_dir, "store_assets")
    os.makedirs(store_dir, exist_ok=True)
    
    # 1. Generate 512x512 App Icon
    icon_src = os.path.join(base_dir, "mobile", "assets", "icon.png")
    icon_out = os.path.join(store_dir, "playstore_icon_512x512.png")
    
    with Image.open(icon_src) as img:
        img_512 = img.resize((512, 512), Image.Resampling.LANCZOS)
        img_512.save(icon_out, "PNG", optimize=True)
        print(f"Generated Icon: {icon_out} ({img_512.size})")

    # 2. Generate 1024x500 Feature Graphic
    # Source AI banner
    banner_src = "/Users/ajitprajapati/.gemini/antigravity-ide/brain/ceadc99f-1376-4a8a-bca1-b5eb2e10932b/play_store_feature_graphic_1790437789451.jpg"
    logo_src = os.path.join(base_dir, "mobile", "assets", "afoodoo-logo-light.png")
    feature_out = os.path.join(store_dir, "feature_graphic_1024x500.png")
    
    with Image.open(banner_src) as banner:
        # Target aspect ratio: 1024 / 500 = 2.048
        # Banner is 1376 x 768 (ratio 1.791)
        # We need to crop height to match 1024x500:
        target_height = int(banner.width / 2.048) # 1376 / 2.048 = 671
        
        top = (banner.height - target_height) // 2
        bottom = top + target_height
        cropped_banner = banner.crop((0, top, banner.width, bottom))
        
        # Resize to exact 1024 x 500
        feature_img = cropped_banner.resize((1024, 500), Image.Resampling.LANCZOS).convert("RGBA")
        
        # Load logo to overlay on the right side
        if os.path.exists(logo_src):
            with Image.open(logo_src) as logo:
                logo_rgba = logo.convert("RGBA")
                # Target logo width ~ 340px
                target_w = 340
                ratio = target_w / logo_rgba.width
                target_h = int(logo_rgba.height * ratio)
                resized_logo = logo_rgba.resize((target_w, target_h), Image.Resampling.LANCZOS)
                
                # Position on the right side over the dark ambient glow
                # feature_img is 1024 wide, left side has the tiffin up to ~ 550px
                x_pos = 1024 - target_w - 60
                y_pos = (500 - target_h) // 2 - 10
                
                # Composite with alpha
                feature_img.paste(resized_logo, (x_pos, y_pos), resized_logo)
        
        # Save as PNG
        feature_img.convert("RGB").save(feature_out, "PNG", optimize=True)
        print(f"Generated Feature Graphic: {feature_out} ({feature_img.size})")

if __name__ == "__main__":
    generate_assets()
