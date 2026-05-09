#!/bin/bash
ffmpeg -y -i seg1_problem_v2.mp4 -vf "scale=1080:1080,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black" -c:v libx264 -c:a aac -ar 44100 -ac 1 -r 25 norm1.mp4
ffmpeg -y -i seg2_pivot_v2.mp4 -vf "scale=1080:1080,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black" -c:v libx264 -c:a aac -ar 44100 -ac 1 -r 25 norm2.mp4
ffmpeg -y -i seg3_architecture_animated_min.mp4 -vf "scale=1080:1080,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black" -c:v libx264 -c:a aac -ar 44100 -ac 1 -r 25 norm3.mp4
ffmpeg -y -i norm4_new.mp4 -vf "scale=1920:1080" -c:v libx264 -c:a aac -ar 44100 -ac 1 -r 25 norm4.mp4
echo -e "file 'norm1.mp4'\nfile 'norm2.mp4'\nfile 'norm3.mp4'\nfile 'norm4.mp4'" > master_concat.txt
ffmpeg -y -f concat -safe 0 -i master_concat.txt -c copy master_presentation_final.mp4
