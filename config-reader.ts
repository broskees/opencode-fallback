/**
 * Config reader for the standalone fallback plugin.
 *
 * Reads `fallback_models` from OpenCode's agent config section
 * (passed via the plugin config hook), NOT from oh-my-opencode.jsonc.
 */

type AgentRecord = Record<string, unknown>

const SESSION_ID_NOISE_WORDS = new Set(["ses", "work", "task", "session"])

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * One entry of a fallback chain. Config accepts either a bare
 * "provider/model" string or `{ model, variant }`, where `variant` is the
 * reasoning-effort level (e.g. "xhigh") to replay that model with.
 */
type FallbackEntry = { model: string; variant?: string }

function toFallbackEntry(item: unknown): FallbackEntry | undefined {
	if (typeof item === "string") return item ? { model: item } : undefined
	if (isRecord(item) && typeof item.model === "string" && item.model) {
		return typeof item.variant === "string" && item.variant
			? { model: item.model, variant: item.variant }
			: { model: item.model }
	}
	return undefined
}

function normalizeFallbackEntries(value: unknown): FallbackEntry[] {
	if (!value) return []
	const items = Array.isArray(value) ? value : [value]
	return items
		.map(toFallbackEntry)
		.filter((entry): entry is FallbackEntry => entry !== undefined)
}

export function normalizeFallbackModelsField(
	value: unknown
): string[] {
	return normalizeFallbackEntries(value).map((entry) => entry.model)
}

function readFallbackEntriesFromAgentConfig(
	agentConfig: Record<string, unknown>
): FallbackEntry[] {
	const directEntries = normalizeFallbackEntries(agentConfig.fallback_models)
	if (directEntries.length > 0) return directEntries

	const options = agentConfig.options
	if (isRecord(options)) {
		const optionEntries = normalizeFallbackEntries(options.fallback_models)
		if (optionEntries.length > 0) return optionEntries
	}

	const request = agentConfig.request
	if (isRecord(request)) {
		const body = request.body
		if (isRecord(body)) {
			const bodyEntries = normalizeFallbackEntries(body.fallback_models)
			if (bodyEntries.length > 0) return bodyEntries
		}
	}

	return []
}

export function readFallbackModels(
	agentName: string,
	agents: AgentRecord | undefined
): string[] {
	if (!agents) return []

	const agentConfig = agents[agentName]
	if (!isRecord(agentConfig)) return []

	return readFallbackEntriesFromAgentConfig(agentConfig).map((entry) => entry.model)
}

/**
 * The variant to replay `model` with for this agent: the variant named on
 * its fallback entry, or the agent's own `variant` when the chain has come
 * back around to the agent's primary model. Undefined means the provider's
 * default effort.
 */
export function readFallbackVariant(
	agentName: string,
	agents: AgentRecord | undefined,
	model: string
): string | undefined {
	if (!agents) return undefined

	const agentConfig = agents[agentName]
	if (!isRecord(agentConfig)) return undefined

	const entry = readFallbackEntriesFromAgentConfig(agentConfig).find(
		(candidate) => candidate.model === model
	)
	if (entry?.variant) return entry.variant

	if (agentConfig.model === model && typeof agentConfig.variant === "string" && agentConfig.variant) {
		return agentConfig.variant
	}

	return undefined
}

export function resolveAgentForSession(
	sessionID: string,
	eventAgent?: string
): string | undefined {
	if (eventAgent && eventAgent.trim().length > 0) {
		return eventAgent.trim().toLowerCase()
	}

	const segments = sessionID.split(/[\s_\-/]+/).filter(Boolean)
	for (const segment of segments) {
		const candidate = segment.toLowerCase()
		const isAlphaOnly = /^[a-z][a-z-]*$/.test(candidate)
		if (candidate.length > 2 && isAlphaOnly && !SESSION_ID_NOISE_WORDS.has(candidate)) {
			return candidate
		}
	}

	return undefined
}

export function getFallbackModelsForSession(
	sessionID: string,
	eventAgent: string | undefined,
	agents: AgentRecord | undefined,
	globalFallbackModels?: string[]
): string[] {
	const resolvedAgent = resolveAgentForSession(sessionID, eventAgent)

	// Tier 1: Per-agent fallback_models
	if (resolvedAgent && agents) {
		const models = readFallbackModels(resolvedAgent, agents)
		
		// Implicitly include the agent's configured primary model as a
		// last-resort fallback candidate — but only when fallback_models
		// was explicitly configured with entries.  If the user didn't set
		// fallback_models at all (or set it to []), we don't inject the
		// primary — they didn't opt into fallback for this agent.
		//
		// This handles the case where the user manually switches to a
		// fallback model and it later fails: the configured primary
		// becomes available as a recovery target instead of the chain
		// appearing exhausted.
		if (models.length > 0) {
			const agentConfig = agents[resolvedAgent]
			if (isRecord(agentConfig) && typeof agentConfig.model === "string") {
				const primaryModel = agentConfig.model
				if (!models.includes(primaryModel)) {
					models.unshift(primaryModel)
				}
			}
			return models
		}
	}

	// Tier 2: Global fallback_models from plugin config
	if (globalFallbackModels && globalFallbackModels.length > 0) {
		return globalFallbackModels
	}

	// Tier 3: No fallback
	return []
}
