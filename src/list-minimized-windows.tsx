import { ActionPanel, Action, List, Icon, showToast, Toast, getPreferenceValues, Keyboard } from "@raycast/api";
import { useCallback, useEffect, useState } from "react";
import { exec } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";

const execAsync = promisify(exec);

interface Preferences {
  yabaiPath?: string;
}

interface YabaiWindow {
  id: number;
  app: string;
  title: string;
  space: number;
  display: number;
  "is-minimized": boolean;
}

// Resolve yabai path dynamically, checking preferences and standard installation directories
function getAbsoluteYabaiPath(prefPath: string | undefined): string {
  if (prefPath && prefPath.trim() !== "") {
    return prefPath.trim();
  }
  const standardPaths = ["/opt/homebrew/bin/yabai", "/usr/local/bin/yabai", "/usr/bin/yabai", "/bin/yabai"];
  for (const path of standardPaths) {
    if (existsSync(path)) {
      return path;
    }
  }
  return "yabai"; // fallback hoping it is in standard PATH
}

export default function Command() {
  const { yabaiPath: prefYabaiPath } = getPreferenceValues<Preferences>();
  const yabaiPath = getAbsoluteYabaiPath(prefYabaiPath);

  const [windows, setWindows] = useState<YabaiWindow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMinimizedWindows = useCallback(async () => {
    setIsLoading(true);
    try {
      const { stdout } = await execAsync(`${yabaiPath} -m query --windows`);
      const parsed: YabaiWindow[] = JSON.parse(stdout || "[]");
      const minimized = parsed.filter((win) => win["is-minimized"] === true);
      setWindows(minimized);
    } catch (error) {
      console.error("Error querying yabai minimized windows:", error);
      await showToast({
        style: Toast.Style.Failure,
        title: "Couldn't query yabai",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsLoading(false);
    }
  }, [yabaiPath]);

  useEffect(() => {
    fetchMinimizedWindows();
  }, [fetchMinimizedWindows]);

  async function deminimize(win: YabaiWindow) {
    try {
      await execAsync(`${yabaiPath} -m window --deminimize ${win.id}`);

      // Attempt to focus, but don't fail the operation if focus fails
      try {
        await execAsync(`${yabaiPath} -m window --focus ${win.id}`);
      } catch (focusError) {
        console.error(`Failed to focus window ${win.id}:`, focusError);
      }

      await showToast({
        style: Toast.Style.Success,
        title: "Restored window",
        message: `${win.app} — ${win.title}`,
      });
      // Refresh the list so the restored window drops out of it.
      fetchMinimizedWindows();
    } catch (error) {
      console.error(`Error deminimizing window ${win.id}:`, error);
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to deminimize",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Filter minimized windows...">
      {!isLoading && windows.length === 0 ? (
        <List.EmptyView
          icon={Icon.Window}
          title="No minimized windows"
          description="Everything yabai knows about is already visible."
        />
      ) : (
        windows.map((win) => (
          <List.Item
            key={win.id}
            icon={Icon.AppWindow}
            title={win.app}
            subtitle={win.title || "(untitled window)"}
            accessories={[{ text: `Space ${win.space}` }]}
            actions={
              <ActionPanel>
                <Action title="Deminimize & Focus" icon={Icon.Eye} onAction={() => deminimize(win)} />
                <Action
                  title="Refresh"
                  icon={Icon.ArrowClockwise}
                  shortcut={Keyboard.Shortcut.Common.Refresh}
                  onAction={fetchMinimizedWindows}
                />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
