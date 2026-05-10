#!/usr/bin/env python3
"""
Generate voiceover clips for each commentary line using Fish Audio TTS API,
then composite them onto the screen recording MP4 with precise timing using ffmpeg.
"""
import json
import os
import subprocess
import sys
import urllib.request

# ---- Config ----
FISH_API_KEY = "cfcfa3c247e04d24a29f6eece228c261"
FISH_VOICE_ID = "2fcfdf3229d94dc2bcb02b2c35405545"  # User-specified model
SCRIPT_PATH = os.path.join(os.path.dirname(__file__), "commentary_script_v2.json")
OUTPUT_DIR = "/tmp/aegis_commentary"
RECORDING_PATH = os.path.join(os.path.dirname(__file__), "..", "seg4_recording.mp4")
FINAL_OUTPUT = os.path.join(os.path.dirname(__file__), "..", "seg4_final.mp4")

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ---- Step 1: Load script ----
with open(SCRIPT_PATH) as f:
    lines = json.load(f)

print(f"[Commentary] Loaded {len(lines)} lines from script")

# ---- Step 2: Generate TTS clips ----
for line in lines:
    clip_path = os.path.join(OUTPUT_DIR, f"line_{line['id']}.mp3")
    
    if os.path.exists(clip_path) and os.path.getsize(clip_path) > 1000:
        print(f"  [Skip] line_{line['id']}.mp3 already exists")
        continue
    
    print(f"  [TTS] Generating line {line['id']}: \"{line['text'][:60]}...\"")
    
    payload = json.dumps({
        "text": line["text"],
        "reference_id": FISH_VOICE_ID,
        "format": "mp3",
        "model": "s1",
        "latency": "normal"
    }).encode("utf-8")
    
    req = urllib.request.Request(
        "https://api.fish.audio/v1/tts",
        data=payload,
        headers={
            "Authorization": f"Bearer {FISH_API_KEY}",
            "Content-Type": "application/json",
        }
    )
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            audio_data = resp.read()
            with open(clip_path, "wb") as out:
                out.write(audio_data)
            print(f"  [OK] line_{line['id']}.mp3 ({len(audio_data)} bytes)")
    except Exception as e:
        print(f"  [ERROR] line_{line['id']}: {e}")
        sys.exit(1)

# ---- Step 3: Get clip durations via ffprobe ----
print("\n[Commentary] Probing clip durations...")
for line in lines:
    clip_path = os.path.join(OUTPUT_DIR, f"line_{line['id']}.mp3")
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", clip_path],
        capture_output=True, text=True
    )
    dur = float(result.stdout.strip())
    line["duration"] = dur
    print(f"  line_{line['id']}: {dur:.1f}s (starts at {line['startSec']}s)")

# ---- Step 4: Compose with ffmpeg ----
print("\n[Commentary] Composing final video with ffmpeg...")

# Build ffmpeg command with adelay filters
inputs = ["-i", RECORDING_PATH]
filter_parts = []
mix_labels = []

for line in lines:
    clip_path = os.path.join(OUTPUT_DIR, f"line_{line['id']}.mp3")
    input_idx = len(inputs) // 2  # Each -i adds 2 args
    inputs.extend(["-i", clip_path])
    
    delay_ms = int(line["startSec"] * 1000)
    label = f"a{line['id']}"
    filter_parts.append(f"[{input_idx}]adelay={delay_ms}|{delay_ms}[{label}]")
    mix_labels.append(f"[{label}]")

# Mix all audio tracks
filter_complex = "; ".join(filter_parts)
filter_complex += f"; {''.join(mix_labels)}amix=inputs={len(lines)}:duration=longest:dropout_transition=0[aout]"

cmd = [
    "ffmpeg", "-y",
    *inputs,
    "-filter_complex", filter_complex,
    "-map", "0:v",
    "-map", "[aout]",
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "192k",
    "-shortest",
    FINAL_OUTPUT
]

print(f"  Running ffmpeg ({len(inputs)//2} inputs)...")
result = subprocess.run(cmd, capture_output=True, text=True)

if result.returncode == 0:
    # Verify
    dur_result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", FINAL_OUTPUT],
        capture_output=True, text=True
    )
    print(f"\n[Commentary] ✅ Final video: {FINAL_OUTPUT}")
    print(f"[Commentary] Duration: {float(dur_result.stdout.strip()):.1f}s")
else:
    print(f"\n[Commentary] ❌ ffmpeg failed:")
    print(result.stderr[-1000:])
    sys.exit(1)
