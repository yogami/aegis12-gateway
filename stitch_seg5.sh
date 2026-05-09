#!/bin/bash
set -e

IMG1="/Users/user1000/.gemini/antigravity/brain/7f7d6692-e3a7-4eba-bc5a-e748ec55a6ae/seg5_frame1_1778313797918.png"
IMG2="/Users/user1000/.gemini/antigravity/brain/7f7d6692-e3a7-4eba-bc5a-e748ec55a6ae/seg5_frame2_1778313819120.png"
IMG3="/Users/user1000/.gemini/antigravity/brain/7f7d6692-e3a7-4eba-bc5a-e748ec55a6ae/seg5_frame3_1778313852964.png"
IMG4="/Users/user1000/.gemini/antigravity/brain/7f7d6692-e3a7-4eba-bc5a-e748ec55a6ae/seg5_frame4_1778313867270.png"
AUDIO="seg5_audio.mp3"

echo "Creating concat file..."
cat << 'TXT' > seg5_images.txt
file '$IMG1'
duration 13.0
file '$IMG2'
duration 13.0
file '$IMG3'
duration 13.0
file '$IMG4'
duration 12.3
file '$IMG4'
TXT

echo "Generating seg5_gtm.mp4..."
ffmpeg -y -f concat -safe 0 -i seg5_images.txt -i "$AUDIO" \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p" \
  -c:v libx264 -c:a aac -shortest seg5_gtm.mp4

echo "Stitching seg5 to master presentation..."
cat << 'TXT' > ultimate_concat.txt
file 'master_presentation_final.mp4'
file 'seg5_gtm.mp4'
TXT

ffmpeg -y -f concat -safe 0 -i ultimate_concat.txt -c copy master_presentation_ultimate.mp4

echo "Done!"
