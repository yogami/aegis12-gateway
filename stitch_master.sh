#!/bin/bash
set -e

cd /Users/user1000/gitprojects/aegis12-gateway

# All segments need to be normalized to 1920x1080@30fps for clean concat
for seg in seg1_new_opener.mp4 seg2_pivot_v2.mp4 seg3_architecture_animated_min.mp4 seg4_final.mp4 seg5_gtm_fixed.mp4; do
    out="norm_${seg}"
    if [ -f "$out" ]; then
        echo "[Skip] $out already exists"
        continue
    fi
    echo "[Normalize] $seg -> $out"
    ffmpeg -y -i "$seg" \
        -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p" \
        -r 30 -c:v libx264 -preset fast -crf 20 \
        -c:a aac -b:a 192k -ar 44100 -ac 2 \
        "$out"
done

# Build concat list
cat > master_concat.txt << 'LIST'
file 'norm_seg1_new_opener.mp4'
file 'norm_seg2_pivot_v2.mp4'
file 'norm_seg3_architecture_animated_min.mp4'
file 'norm_seg4_final.mp4'
file 'norm_seg5_gtm_fixed.mp4'
LIST

echo "[Stitch] Concatenating all segments..."
ffmpeg -y -f concat -safe 0 -i master_concat.txt -c copy master_demo_final.mp4

dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 master_demo_final.mp4)
echo "[Done] master_demo_final.mp4 - Duration: ${dur}s"
