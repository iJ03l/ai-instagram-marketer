
#!/bin/bash
INPUT="/home/x-5194/.gemini/antigravity/brain/a6f4943b-0ac1-4f9e-aef5-783432e889ce/uploaded_media_1770098612036.png"
OUTDIR="/home/x-5194/dump/instagram-ai-comment-assistant/assets/icons"

mkdir -p "$OUTDIR"

ffmpeg -y -i "$INPUT" -vf scale=16:16 "$OUTDIR/icon16.png"
ffmpeg -y -i "$INPUT" -vf scale=32:32 "$OUTDIR/icon32.png"
ffmpeg -y -i "$INPUT" -vf scale=48:48 "$OUTDIR/icon48.png"
ffmpeg -y -i "$INPUT" -vf scale=128:128 "$OUTDIR/icon128.png"

ls -l "$OUTDIR"
