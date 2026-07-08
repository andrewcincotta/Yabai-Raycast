import { ActionPanel, Action, List, Icon, showToast, Toast, getPreferenceValues, Keyboard } from "@raycast/api";
import { useCallback, useEffect, useState } from "react";
import { exec } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import { userInfo } from "os";

const execAsync = promisify(exec);

// Execute shell command with the USER environment variable set to support yabai socket communication
async function execYabaiCommand(command: string) {
  return execAsync(command, {
    env: {
      ...process.env,
      USER: userInfo().username,
    },
  });
}

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
  "is-floating": boolean;
}

interface YabaiSpace {
  index: number;
  "has-focus": boolean;
  display: number;
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

// Query yabai to determine the space index currently focused by the user
async function getActiveSpaceIndex(yabaiPath: string): Promise<number | null> {
  try {
    const { stdout } = await execYabaiCommand(`${yabaiPath} -m query --spaces --space`);
    const spaceInfo: YabaiSpace = JSON.parse(stdout.trim());
    return spaceInfo.index;
  } catch (error) {
    console.error("Error querying active space index:", error);
    return null;
  }
}

export default function Command() {
  const { yabaiPath: prefYabaiPath } = getPreferenceValues<Preferences>();
  const yabaiPath = getAbsoluteYabaiPath(prefYabaiPath);

  const [windows, setWindows] = useState<YabaiWindow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMinimizedWindows = useCallback(async () => {
    setIsLoading(true);
    try {
      const { stdout } = await execYabaiCommand(`${yabaiPath} -m query --windows`);
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
      // Query the active space index before deminimizing
      const activeSpaceIndex = await getActiveSpaceIndex(yabaiPath);

      await execYabaiCommand(`${yabaiPath} -m window --deminimize ${win.id}`);

      // If we found the active space, move the restored window to it
      if (activeSpaceIndex !== null && win.space !== activeSpaceIndex) {
        try {
          await execYabaiCommand(`${yabaiPath} -m window ${win.id} --space ${activeSpaceIndex}`);
        } catch (moveError) {
          console.error(`Failed to move window ${win.id} to space ${activeSpaceIndex}:`, moveError);
        }
      }

      // Attempt to focus, but don't fail the operation if focus fails
      try {
        await execYabaiCommand(`${yabaiPath} -m window --focus ${win.id}`);
      } catch (focusError) {
        console.error(`Failed to focus window ${win.id}:`, focusError);
      }

      // If the window is floating, toggle float off to tile it in yabai
      if (win["is-floating"] === true) {
        try {
          await execYabaiCommand(`${yabaiPath} -m window ${win.id} --toggle float`);
        } catch (floatError) {
          console.error(`Failed to toggle float off for window ${win.id}:`, floatError);
        }
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
