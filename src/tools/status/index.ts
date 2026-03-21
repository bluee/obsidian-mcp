import { getVaultIndex } from "../../utils/vault-index.js";
import { createToolResponse } from "../../utils/responses.js";
import { createToolNoArgs } from "../../utils/tool-factory.js";

export function createStatusTool(vaults: Map<string, string>) {
  return createToolNoArgs({
    name: "status",
    description: "Check server health and get note counts per vault",
    handler: async () => {
      const lines: string[] = [];
      lines.push("status: ok");
      lines.push(`vaults: ${vaults.size}`);

      for (const [name, vaultPath] of vaults) {
        const notes = await getVaultIndex(vaultPath);
        lines.push(`  ${name}: ${notes.length} notes`);
      }

      return createToolResponse(lines.join("\n"));
    },
  }, vaults);
}
