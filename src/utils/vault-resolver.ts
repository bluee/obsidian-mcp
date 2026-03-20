import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

export interface VaultResolutionResult {
  vaultPath: string;
  vaultName: string;
}

export class VaultResolver {
  private vaults: Map<string, string>;
  constructor(vaults: Map<string, string>) {
    if (!vaults || vaults.size === 0) {
      throw new McpError(ErrorCode.InvalidRequest, "At least one vault is required");
    }
    this.vaults = vaults;
  }

  /**
   * Resolves a single vault name to its path and validates it exists
   */
  resolveVault(vaultName: string): VaultResolutionResult {
    const vaultPath = this.vaults.get(vaultName);

    if (!vaultPath) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Unknown vault: ${vaultName}. Available vaults: ${Array.from(this.vaults.keys()).join(', ')}`
      );
    }

    return { vaultPath, vaultName };
  }

  /**
   * Returns a list of available vault names
   */
  getAvailableVaults(): string[] {
    return Array.from(this.vaults.keys());
  }
}
