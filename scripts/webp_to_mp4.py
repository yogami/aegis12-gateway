#!/usr/bin/env python3
"""Convert animated WebP to MP4 by piping raw frames directly to ffmpeg (no disk temp files)."""
import subprocess
import sys
from PIL import Image

INPUT = sys.argv[1] if len(sys.argv) > 1 else '/Users/user1000/.gemini/antigravity/brain/7f7d6692-e3a7-4eba-bc5a-e748ec55a6ae/seg4_live_demo_1778352785110.webp'
OUTPUT = sys.argv[2] if len(sys.argv) > 2 else '/Users/user1000/gitprojects/aegis12-gateway/seg4_recording.mp4'

img = Image.open(INPUT)
w, h = img.size
# Ensure even dimensions for h264
w = w if w % 2 == 0 else w - 1
h = h if h % 2 == 0 else h - 1

# Target 1920x1080 for consistency with other segments
target_w, target_h = 1920, 1080

print(f"[webp_to_mp4] Source: {img.n_frames} frames @ {w}x{h}, target {target_w}x{target_h}")

# Use 10fps since that's the native rate
fps = 10

ffmpeg_cmd = [
    'ffmpeg', '-y',
    '-f', 'rawvideo',
    '-vcodec', 'rawvideo',
    '-s', f'{target_w}x{target_h}',
    '-pix_fmt', 'rgb24',
    '-r', str(fps),
    '-i', '-',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-r', '30',  # Output at 30fps for smooth playback
    OUTPUT
]

proc = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)

for i in range(img.n_frames):
    img.seek(i)
    frame = img.convert('RGB').resize((target_w, target_h), Image.LANCZOS)
    proc.stdin.write(frame.tobytes())
    if i % 100 == 0:
        print(f"  Frame {i}/{img.n_frames}...")

proc.stdin.close()
proc.wait()

if proc.returncode == 0:
    print(f"[webp_to_mp4] ✅ Saved to {OUTPUT}")
else:
    stderr = proc.stderr.read().decode()
    print(f"[webp_to_mp4] ❌ ffmpeg failed: {stderr[-500:]}")
    sys.exit(1)
