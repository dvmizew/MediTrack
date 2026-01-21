#!/bin/bash

if ! command -v web-push &> /dev/null; then
    echo "Installing web-push..."
    npm install -g web-push
fi

echo "Generating VAPID keys..."
OUTPUT=$(web-push generate-vapid-keys)

PUBLIC_KEY=$(echo "$OUTPUT" | grep "Public Key:" | cut -d' ' -f3)
PRIVATE_KEY=$(echo "$OUTPUT" | grep "Private Key:" | cut -d' ' -f3)

echo ""
echo "Public Key:  $PUBLIC_KEY"
echo "Private Key: $PRIVATE_KEY"
echo ""

ENV_FILE=".env"

if [ -f "$ENV_FILE" ]; then
    # Update existing keys or append if not found
    if grep -q "VAPID_PUBLIC_KEY=" "$ENV_FILE"; then
        sed -i "s|VAPID_PUBLIC_KEY=.*|VAPID_PUBLIC_KEY=$PUBLIC_KEY|" "$ENV_FILE"
    else
        echo "VAPID_PUBLIC_KEY=$PUBLIC_KEY" >> "$ENV_FILE"
    fi
    
    if grep -q "VAPID_PRIVATE_KEY=" "$ENV_FILE"; then
        sed -i "s|VAPID_PRIVATE_KEY=.*|VAPID_PRIVATE_KEY=$PRIVATE_KEY|" "$ENV_FILE"
    else
        echo "VAPID_PRIVATE_KEY=$PRIVATE_KEY" >> "$ENV_FILE"
    fi
    
    if ! grep -q "VAPID_SUBJECT=" "$ENV_FILE"; then
        echo "VAPID_SUBJECT=mailto:admin@meditrack.com" >> "$ENV_FILE"
    fi
    
    echo "✓ Keys updated in $ENV_FILE"
else
    echo "VAPID_PUBLIC_KEY=$PUBLIC_KEY" > "$ENV_FILE"
    echo "VAPID_PRIVATE_KEY=$PRIVATE_KEY" >> "$ENV_FILE"
    echo "VAPID_SUBJECT=mailto:admin@meditrack.com" >> "$ENV_FILE"
    echo "✓ Created $ENV_FILE with VAPID keys"
fi
