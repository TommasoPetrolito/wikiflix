# Sharing Flux on Your Local Network

This guide will help you share your Flux app with family members on your local network (WiFi).

## Quick Start

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Find your computer's IP address:**
   - **macOS/Linux:** Open Terminal and run:
     ```bash
     ifconfig | grep "inet " | grep -v 127.0.0.1
     ```
     Or use:
     ```bash
     ipconfig getifaddr en0
     ```
   - **Windows:** Open Command Prompt and run:
     ```bash
     ipconfig
     ```
     Look for "IPv4 Address" under your active network adapter (usually Wi-Fi or Ethernet).

3. **Share the URL with your family:**
   - The app will be accessible at: `http://YOUR_IP_ADDRESS:3000`
   - Example: `http://192.168.1.100:3000`
   - They can open this URL on any device connected to the same WiFi network (PC, TV, tablet, phone)

## Detailed Instructions

### Step 1: Start the Server

Make sure you're in the `flux` directory and run:
```bash
npm run dev
```

You should see output like:
```
  VITE v5.0.8  ready in 500 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: http://192.168.1.100:3000/
```

**Use the "Network" URL** - this is what your family needs!

### Step 2: Find Your IP Address

#### macOS:
```bash
# Quick method
ipconfig getifaddr en0

# Or see all network interfaces
ifconfig | grep "inet " | grep -v 127.0.0.1
```

#### Windows:
```bash
ipconfig
# Look for "IPv4 Address" - usually something like 192.168.1.XXX
```

#### Linux:
```bash
hostname -I
# Or
ip addr show | grep "inet "
```

### Step 3: Share with Family

1. **Make sure all devices are on the same WiFi network**
   - Your computer and their devices must be on the same network
   - This won't work across different networks (like different WiFi routers)

2. **Share the Network URL:**
   - From the Vite output, copy the "Network" URL
   - Or construct it: `http://YOUR_IP:3000`
   - Send this URL to your family via text, email, etc.

3. **They can access it on:**
   - **Smart TVs:** Open the browser app and type the URL
   - **PCs/Laptops:** Open any browser and paste the URL
   - **Phones/Tablets:** Open browser and paste the URL
   - **Gaming Consoles:** Use the console's browser if available

### Step 4: Firewall Configuration

If devices can't connect, you may need to allow the port through your firewall:

#### macOS:
1. Go to **System Settings** → **Network** → **Firewall**
2. Click **Options** → **Add Application**
3. Allow **Terminal** or your code editor
4. Or temporarily disable firewall to test

#### Windows:
1. Go to **Windows Security** → **Firewall & network protection**
2. Click **Allow an app through firewall**
3. Add Node.js or allow port 3000

#### Linux:
```bash
# Ubuntu/Debian
sudo ufw allow 3000

# Or temporarily disable
sudo ufw disable
```

## Troubleshooting

### "Connection Refused" or "Can't Connect"
- ✅ Make sure the server is running (`npm run dev`)
- ✅ Verify all devices are on the same WiFi network
- ✅ Check your firewall settings
- ✅ Try accessing from your own device first using the IP address

### IP Address Changed
- Your IP address may change if you restart your router
- Run `npm run dev` again to see the new Network URL
- Or set a static IP on your router for your computer

### TV Browser Issues
- Some smart TVs have limited browsers
- Try using a Chromecast, Fire TV Stick, or similar device with a browser
- Or use a laptop/phone connected to the TV via HDMI

### Port Already in Use
- If port 3000 is taken, Vite will try the next available port (3001, 3002, etc.)
- Check the console output for the actual port number
- Share the correct port with your family

## Production Build (Optional)

For a more permanent solution, you can build the app:

```bash
npm run build
npm run preview -- --host
```

This creates an optimized production build that's faster and more stable.

## Security Note

⚠️ **Important:** This makes your app accessible to anyone on your local network. Only share the URL with trusted family members. Don't use this method on public WiFi networks.

## Need Help?

- Check that Vite shows a "Network" URL when you start the server
- Ensure your computer and their devices are on the same WiFi
- Try accessing the URL from your phone first to verify it works
- Check firewall/antivirus settings if connections fail

