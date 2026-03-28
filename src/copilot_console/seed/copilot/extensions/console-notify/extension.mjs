import { joinSession } from "@github/copilot-sdk";
import { execSync } from "child_process";

await joinSession({
  slashCommands: [
    {
      name: "notify",
      description: "Toggle mobile push notifications for CLI sessions (on/off)",
      action: async (session, params) => {
        const arg = (params?.prompt || "").trim().toLowerCase();

        if (arg === "on") {
          const output = execSync("cli-notify on", { encoding: "utf-8", timeout: 10000 }).trim();
          // Check if Console is running
          let status = "";
          try {
            status = execSync("cli-notify", { encoding: "utf-8", timeout: 5000 }).trim();
          } catch {}
          await session.send({ prompt: `[System] ${output}\n${status}` });
        } else if (arg === "off") {
          const output = execSync("cli-notify off", { encoding: "utf-8", timeout: 10000 }).trim();
          await session.send({ prompt: `[System] ${output}` });
        } else {
          // No arg — show status
          try {
            const output = execSync("cli-notify", { encoding: "utf-8", timeout: 5000 }).trim();
            await session.send({ prompt: `[System] ${output}\nUsage: /notify on | /notify off` });
          } catch {
            await session.send({ prompt: "[System] Could not check notification status. Is copilot-console installed?" });
          }
        }
      },
    },
  ],
  tools: [],
  hooks: {},
});
