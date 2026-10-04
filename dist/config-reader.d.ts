/**
 * Config reader for the standalone fallback plugin.
 *
 * Reads `fallback_models` from OpenCode's agent config section
 * (passed via the plugin config hook), NOT from oh-my-opencode.jsonc.
 */
type AgentRecord = Record<string, unknown>;
export declare function normalizeFallbackModelsField(value: unknown): string[];
export declare function readFallbackModels(agentName: string, agents: AgentRecord | undefined): string[];
/**
 * The variant to replay `model` with for this agent: the variant named on
 * its fallback entry, or the agent's own `variant` when the chain has come
 * back around to the agent's primary model. Undefined means the provider's
 * default effort.
 */
export declare function readFallbackVariant(agentName: string, agents: AgentRecord | undefined, model: string): string | undefined;
export declare function resolveAgentForSession(sessionID: string, eventAgent?: string): string | undefined;
export declare function getFallbackModelsForSession(sessionID: string, eventAgent: string | undefined, agents: AgentRecord | undefined, globalFallbackModels?: string[]): string[];
export {};
