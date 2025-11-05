#!/bin/bash
# Quick script to find your local IP address for sharing Flux

echo "🔍 Finding your local IP address..."
echo ""

# Try different methods based on OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
    if [ -z "$IP" ]; then
        IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1)
    fi
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    IP=$(hostname -I | awk '{print $1}')
    if [ -z "$IP" ]; then
        IP=$(ip addr show | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | cut -d/ -f1 | head -n 1)
    fi
else
    echo "⚠️  Please run 'ipconfig' on Windows to find your IP address"
    exit 1
fi

if [ -z "$IP" ]; then
    echo "❌ Could not find your IP address automatically"
    echo ""
    echo "Please run manually:"
    echo "  macOS: ipconfig getifaddr en0"
    echo "  Linux: hostname -I"
    exit 1
fi

echo "✅ Your local IP address is: $IP"
echo ""
echo "📺 Share this URL with your family:"
echo "   http://$IP:3000"
echo ""
echo "💡 Make sure:"
echo "   - Flux server is running (npm run dev)"
echo "   - All devices are on the same WiFi network"
echo "   - Your firewall allows connections on port 3000"
echo ""

