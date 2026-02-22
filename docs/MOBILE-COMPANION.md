# Mobile Companion

Access Agent Console from your phone — check sessions, read messages, and reply to agents on the go.

## Prerequisites

- [devtunnel](https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/get-started) installed and authenticated

**Option A: winget (Windows 10/11)**
```powershell
winget install Microsoft.devtunnel
```

**Option B: npm (any platform)**
```powershell
npm install -g @msdtunnel/devtunnel-cli
```

Then authenticate:
```powershell
devtunnel user login
```

## Quick Start

1. Start Agent Console with `--expose`:
   ```powershell
   agentconsole --expose
   ```

2. Open **Settings** (gear icon) in the desktop UI — you'll see a QR code under **Mobile Companion**.

3. Scan the QR code with your phone's camera. The mobile UI opens in your browser, pre-authenticated.

That's it. Sessions, messages, and agent status are all accessible from your phone.

> **Stable URL:** The dev script automatically creates a persistent devtunnel on first use. The same URL is reused across server restarts — no need to re-scan the QR code each time.

## Install on Phone (Home Screen App)

After scanning the QR code and opening the mobile UI, you can install it as a home screen app for a native-like experience — fullscreen, no browser address bar.

### Android (Chrome / Edge)

1. Open the mobile UI via QR code scan
2. Chrome shows an **"Add to Home Screen"** banner at the bottom — tap **Install**
3. If no banner appears: tap the **⋮** menu (top right) → **Add to Home Screen** → **Install**
4. When prompted with **"Open as Web App"**, keep it **On** (this gives you fullscreen mode without the browser address bar)
5. The **Agent Console** icon appears on your home screen

### iPhone / iPad (Safari)

1. Open the mobile UI via QR code scan **in Safari** (not Chrome — iOS requires Safari for PWA install)
2. Tap the **Share** button (square with arrow, bottom toolbar)
3. Scroll down and tap **Add to Home Screen**
4. When prompted with **"Open as Web App"**, keep it **On** (this gives you fullscreen mode without Safari's address bar)
5. Tap **Add** in the top right
6. The **Agent Console** icon appears on your home screen

### After Installation

- Tap the home screen icon to launch — opens fullscreen, no browser chrome
- Your token is already saved from the QR scan — no re-authentication needed
- If the token is regenerated or the tunnel URL changes, the app shows a **"Session Expired"** or **"Connection Lost"** screen with a prompt to re-scan the QR code from desktop Settings

## How It Works

`--expose` does three things:

1. **Binds the backend to `0.0.0.0`** so it accepts non-localhost connections
2. **Starts a devtunnel** that creates a secure HTTPS tunnel to your machine
3. **Registers the tunnel URL** with the backend so the desktop UI can generate a QR code

The QR code encodes the tunnel URL plus an API token. Your phone's browser opens the mobile UI and stores the token locally — all subsequent API calls include it automatically.

## Security

### Default: Authenticated Tunnel

By default, only the Microsoft account that created the tunnel can access it. When someone opens the tunnel URL, devtunnel prompts for Microsoft login and verifies it matches the tunnel owner. On top of that, all API calls require a bearer token (embedded in the QR code).

### Anonymous Mode

```powershell
agentconsole --expose --allow-anonymous
```

Skips the Microsoft login — anyone with the tunnel URL can reach the server. The bearer token still protects API endpoints. Use this if you want to share access with someone who doesn't have a Microsoft account on the same tenant.

### Token Management

- **Token generation**: A cryptographically random token is auto-generated on first use and stored in `~/.copilot-agent-console/settings.json`
- **Regeneration**: Click "Regenerate" in Settings to invalidate the current token. All connected phones lose access until they scan the new QR code.
- **REST calls**: Token sent in `Authorization: Bearer <token>` header
- **SSE streams**: Token sent as `?token=<token>` query parameter (EventSource API limitation)

## Mobile UI

The mobile interface is purpose-built for phone screens with three tabs:

| Tab | What it shows |
|---|---|
| **Sessions** | All sessions with unread blue dot indicators, pull-to-refresh |
| **Chat** | Message history with live streaming responses, reply and abort |
| **Agents** | Live feed of active agent sessions with auto-reconnect |

### Key behaviors

- **No background polling** — session list loads once on open, refreshed via pull-down gesture or refresh button
- **Push notifications** — get notified when agents complete, even when the app is in the background
- **SSE with backoff** — agent status updates stream in real-time; reconnects with exponential backoff (2s→30s) if the tunnel drops
- **Cached navigation** — going back from chat to session list uses cached data (no re-fetch from SDK)
- **iOS optimized** — safe area insets for notch/home indicator, no zoom on input focus, dynamic viewport height

## Troubleshooting

### iOS: App shows "Zero KB" or blank page when server is down
This is a known iOS/WebKit limitation — iOS bypasses the service worker when the origin is completely unreachable. The dev script uses **persistent devtunnels** (same URL across restarts) to mitigate this. When using a persistent tunnel, even if the server is down, Microsoft's tunnel service still responds at the URL, allowing the service worker to show an offline page instead.

If you see "Zero KB", just wait for the server to restart and reopen the app. The tunnel URL stays the same, so the app reconnects automatically.

> **Note:** This issue does not affect Android — the service worker works correctly there regardless.

### Phone shows "Session Expired" or "Connection Lost"
The API token was regenerated or the tunnel URL changed. Tap **Re-configure Connection**, then scan the new QR code from desktop Settings. If you installed the app on your home screen, you'll need to re-scan once — subsequent launches will use the updated credentials.

### "Add to Home Screen" option not appearing (iPhone)
PWA install only works in **Safari** on iOS. If you opened the link in Chrome, Google, or another browser, copy the URL and open it in Safari, then use Share → Add to Home Screen.

### Phone shows "Connection Setup" screen
The token or URL is missing. Scan the QR code again from the desktop Settings.

### Phone can't load after token regeneration
The old token in your phone's localStorage is now invalid. Scan the new QR code from Settings.

### devtunnel not found
Install with `winget install Microsoft.devtunnel`, then authenticate with `devtunnel user login`.

### Tunnel SSH window warnings in console
Messages like "SshChannel send window is full" are normal devtunnel noise from long-lived SSE connections. They don't affect functionality.

### Phone browser stuck on wrong Microsoft account
Clear cookies in your mobile browser (Settings → Privacy → Clear browsing data → Cookies), or open the tunnel URL in an InPrivate/Incognito tab.
