# Yabai Minimized Windows (Raycast extension)

Lists every minimized window (via `yabai -m query --windows | jq`) with app name +
window title, and deminimizes + focuses whichever one you pick.

## Setup

1. Move this folder somewhere permanent, e.g. `~/dev/yabai-minimized`.
2. `cd` into it and install deps:
   ```bash
   npm install
   ```
3. Confirm your `yabai`/`jq` paths (Apple Silicon Homebrew default is `/opt/homebrew/bin/...`,
   Intel is usually `/usr/local/bin/...`). Check with:
   ```bash
   which yabai jq
   ```
   If they differ from the defaults, you can change them later in Raycast's extension
   preferences — no code edit needed.
4. Run it in dev mode, which hot-loads it into Raycast:
   ```bash
   npm run dev
   ```
5. Open Raycast, search "List Minimized Windows", hit Enter.

## Usage

- `Enter` on a window → deminimizes it and focuses it, then refreshes the list.
- `Cmd+R` → manually refresh (useful if you deminimized something outside Raycast).
- Type to fuzzy-filter by app name or title (Raycast's built-in list search).

## Notes

- Requires yabai's scripting-addition to be loaded for `--deminimize`/`--focus` to work
  reliably on window IDs (same requirement you already have for skhd window management).
- If yabai's `--deminimize` seems to no-op on a specific app, that's usually the app
  itself ignoring AX restore calls, not this extension — worth checking `yabai -m query
  --windows --window <id>` after triggering it.
