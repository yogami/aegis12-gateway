import cv2
import numpy as np

img_path = "/Users/user1000/.gemini/antigravity/brain/7f7d6692-e3a7-4eba-bc5a-e748ec55a6ae/aegis12_dashboard_full_1778311630690.png"
img = cv2.imread(img_path)

def draw_glow_box(image, x, y, w, h, color=(0, 0, 255), thickness=4):
    # Draw multiple semi-transparent rectangles to simulate glow
    overlay = image.copy()
    for t in range(thickness, thickness + 15, 3):
        cv2.rectangle(overlay, (x - t, y - t), (x + w + t, y + h + t), color, 2)
    cv2.addWeighted(overlay, 0.4, image, 0.6, 0, image)
    # Draw solid inner box
    cv2.rectangle(image, (x, y), (x + w, y + h), color, thickness)
    return image

# Frame 1: Base image
cv2.imwrite("seg4_f1.png", img)

# Frame 2: Left Panel (Intent Stream)
f2 = img.copy()
f2 = draw_glow_box(f2, 40, 100, 880, 740)
cv2.imwrite("seg4_f2.png", f2)

# Frame 3: Right Panel (DCAP) + Top Left Logo
f3 = img.copy()
f3 = draw_glow_box(f3, 960, 100, 920, 740) # Right panel
f3 = draw_glow_box(f3, 20, 15, 400, 60) # Top left logo
cv2.imwrite("seg4_f3.png", f3)

# Frame 4: Blocked Intent (Left panel specific entry - simulate by highlighting a row)
f4 = img.copy()
# Let's highlight a row in the left panel
f4 = draw_glow_box(f4, 50, 400, 860, 120) 
cv2.imwrite("seg4_f4.png", f4)

# Frame 5: Escalation Status (Top Right)
f5 = img.copy()
f5 = draw_glow_box(f5, 1400, 15, 480, 80)
cv2.imwrite("seg4_f5.png", f5)

print("Frames generated successfully.")
