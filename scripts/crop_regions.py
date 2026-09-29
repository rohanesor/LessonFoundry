import os
from PIL import Image

BASE_DIR = "d:/LessonFoundry/scratch/screenshots/baseline"
CROP_DIR = "d:/LessonFoundry/scratch/screenshots/crops"

os.makedirs(CROP_DIR, exist_ok=True)

# Define crops for specific screenshots: (left, top, right, bottom)
CROPS = {
    # Login Desktop
    "login-desktop.png": [
        ("login-header-desktop", (400, 150, 1040, 320)),
        ("login-form-desktop", (450, 300, 990, 750)),
    ],
    # Login Mobile
    "login-mobile.png": [
        ("login-card-mobile", (20, 100, 370, 700)),
    ],
    # Teacher Dashboard
    "teacher-dashboard-desktop.png": [
        ("teacher-dashboard-header", (0, 0, 1440, 80)),
        ("teacher-classrooms-grid", (100, 80, 1340, 500)),
    ],
    # Teacher Classroom
    "teacher-classroom-desktop.png": [
        ("classroom-header", (100, 60, 1340, 260)),
        ("classroom-packs-list", (100, 260, 1340, 700)),
    ],
    # Pack Studio Overview
    "teacher-pack-overview-desktop.png": [
        ("studio-topbar", (0, 0, 1440, 70)),
        ("studio-sidebar", (0, 70, 240, 900)),
        ("studio-overview-content", (240, 70, 1440, 750)),
    ],
    # Pack Studio Explanation
    "teacher-pack-explanation-desktop.png": [
        ("studio-explanation-editor", (240, 70, 1150, 850)),
        ("studio-explanation-trust", (1150, 70, 1440, 850)),
    ],
    # Pack Studio Validation
    "teacher-pack-validation-desktop.png": [
        ("validation-header-and-table", (240, 70, 1440, 800)),
    ],
    # Student Pack
    "student-pack-desktop.png": [
        ("student-pack-header-and-nav", (0, 0, 1440, 160)),
        ("student-pack-content", (100, 160, 1340, 750)),
    ],
    # Student Dashboard
    "student-dashboard-desktop.png": [
        ("student-dashboard-header", (0, 0, 1440, 80)),
        ("student-dashboard-classrooms", (100, 80, 1340, 600)),
    ],
    # Student Classroom
    "student-classroom-desktop.png": [
        ("student-classroom-header", (0, 0, 1440, 80)),
        ("student-classroom-packs", (100, 80, 1340, 600)),
    ],
    # Teacher Dashboard Mobile
    "teacher-dashboard-mobile.png": [
        ("teacher-dashboard-mobile-header", (0, 0, 390, 80)),
    ],
    # Login Tablet
    "login-tablet.png": [
        ("login-card-tablet", (150, 150, 618, 800)),
    ],
}

count = 0
for filename, crops in CROPS.items():
    img_path = os.path.join(BASE_DIR, filename)
    if not os.path.exists(img_path):
        continue
    with Image.open(img_path) as im:
        w, h = im.size
        for crop_name, box in crops:
            # Bound crop box by image dimensions
            b = (
                max(0, min(box[0], w)),
                max(0, min(box[1], h)),
                max(0, min(box[2], w)),
                max(0, min(box[3], h)),
            )
            cropped = im.crop(b)
            out_file = os.path.join(CROP_DIR, f"{crop_name}.png")
            cropped.save(out_file)
            print(f"Saved crop: {out_file} ({cropped.size[0]}x{cropped.size[1]})")
            count += 1

print(f"Total crops generated: {count}")
