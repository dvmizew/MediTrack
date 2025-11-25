#!/bin/bash
# Generate PWA icons from a source SVG or PNG

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "ImageMagick not found. Install with: sudo apt-get install imagemagick"
    exit 1
fi

# Create a simple placeholder icon if no source exists
SOURCE="icon-source.png"

if [ ! -f "$SOURCE" ]; then
    echo "Creating placeholder icon..."
    # Create a 1024x1024 base icon with gradient
    convert -size 1024x1024 \
        gradient:'#3b82f6-#2563eb' \
        -gravity center \
        -pointsize 400 \
        -fill white \
        -annotate +0+50 "M" \
        -pointsize 120 \
        -annotate +0+200 "MediTrack" \
        "$SOURCE"
fi

# Generate standard icons
echo "Generating 192x192 icon..."
convert "$SOURCE" -resize 192x192 icon-192.png

echo "Generating 512x512 icon..."
convert "$SOURCE" -resize 512x512 icon-512.png

# Generate maskable icons (with safe zone padding)
echo "Generating 192x192 maskable icon..."
convert "$SOURCE" -resize 154x154 \
    -background '#3b82f6' -gravity center \
    -extent 192x192 icon-192-maskable.png

echo "Generating 512x512 maskable icon..."
convert "$SOURCE" -resize 410x410 \
    -background '#3b82f6' -gravity center \
    -extent 512x512 icon-512-maskable.png

echo "Icons generated successfully!"
ls -lh icon-*.png
