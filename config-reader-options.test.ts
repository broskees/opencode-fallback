import { describe, test, expect } from "bun:test"
import { getFallbackModelsForSession, readFallbackModels, readFallbackVariant } from "./config-reader"

describe("config-reader fallback variants", () => {
	const agents = {
		builder: {
			model: "claude-code/claude-opus-5-5",
			variant: "xhigh",
			options: {
				fallback_models: [
					{ model: "openai/gpt-6.1-sol", variant: "high" },
					"openai/gpt-5.6-sol",
					{ model: "openrouter/xiaomi/mimo-v2.6-pro" },
				],
			},
		},
	}

	test("#then object entries count as models in the chain, in order", () => {
		expect(readFallbackModels("builder", agents)).toEqual([
			"openai/gpt-6.1-sol",
			"openai/gpt-5.6-sol",
			"openrouter/xiaomi/mimo-v2.6-pro",
		])
	})

	test("#then an entry's variant is returned for its model", () => {
		expect(readFallbackVariant("builder", agents, "openai/gpt-6.1-sol")).toBe("high")
	})

	test("#then entries without a variant return undefined", () => {
		expect(readFallbackVariant("builder", agents, "openai/gpt-5.6-sol")).toBeUndefined()
		expect(readFallbackVariant("builder", agents, "openrouter/xiaomi/mimo-v2.6-pro")).toBeUndefined()
	})

	test("#then recovering to the primary model uses the agent's own variant", () => {
		expect(readFallbackVariant("builder", agents, "claude-code/claude-opus-5-5")).toBe("xhigh")
	})

	test("#then unknown agents and models return undefined", () => {
		expect(readFallbackVariant("nobody", agents, "openai/gpt-6.1-sol")).toBeUndefined()
		expect(readFallbackVariant("builder", agents, "openai/gpt-4o")).toBeUndefined()
		expect(readFallbackVariant("builder", undefined, "openai/gpt-6.1-sol")).toBeUndefined()
	})
})

describe("config-reader agent options fallback_models", () => {
	describe("#given readFallbackModels", () => {
		describe("#when fallback_models is stored in agent options", () => {
			test("#then returns models from options", () => {
				const agents = {
					review: {
						model: "anthropic/claude-sonnet-4-5",
						options: {
							fallback_models: [
								"openai/gpt-5.4",
								"kimi-for-coding/k2p5",
							],
						},
					},
				}

				const result = readFallbackModels("review", agents)

				expect(result).toEqual([
					"openai/gpt-5.4",
					"kimi-for-coding/k2p5",
				])
			})
		})

		describe("#when fallback_models is stored in request body", () => {
			test("#then returns models from request body", () => {
				const agents = {
					review: {
						model: "anthropic/claude-sonnet-4-5",
						request: {
							body: {
								fallback_models: [
									"openai/gpt-5.4",
									"kimi-for-coding/k2p5",
								],
							},
						},
					},
				}

				const result = readFallbackModels("review", agents)

				expect(result).toEqual([
					"openai/gpt-5.4",
					"kimi-for-coding/k2p5",
				])
			})
		})

		describe("#when fallback_models is stored in options as a string", () => {
			test("#then normalizes to an array", () => {
				const agents = {
					review: {
						model: "anthropic/claude-sonnet-4-5",
						options: {
							fallback_models: "openai/gpt-5.4",
						},
					},
				}

				const result = readFallbackModels("review", agents)

				expect(result).toEqual(["openai/gpt-5.4"])
			})
		})

		describe("#when fallback_models exists in multiple locations", () => {
			test("#then direct fallback_models wins over options and request body", () => {
				const agents = {
					review: {
						model: "anthropic/claude-sonnet-4-5",
						fallback_models: ["direct/model"],
						options: {
							fallback_models: ["options/model"],
						},
						request: {
							body: {
								fallback_models: ["request-body/model"],
							},
						},
					},
				}

				const result = readFallbackModels("review", agents)

				expect(result).toEqual(["direct/model"])
			})

			test("#then options fallback_models wins over request body", () => {
				const agents = {
					review: {
						model: "anthropic/claude-sonnet-4-5",
						options: {
							fallback_models: ["options/model"],
						},
						request: {
							body: {
								fallback_models: ["request-body/model"],
							},
						},
					},
				}

				const result = readFallbackModels("review", agents)

				expect(result).toEqual(["options/model"])
			})
		})
	})

	describe("#given getFallbackModelsForSession", () => {
		describe("#when fallback_models is stored in agent options", () => {
			test("#then returns option models with primary model prepended", () => {
				const agents = {
					review: {
						model: "anthropic/claude-sonnet-4-5",
						options: {
							fallback_models: ["openai/gpt-5.4"],
						},
					},
				}

				const result = getFallbackModelsForSession(
					"ses_123",
					"review",
					agents
				)

				expect(result).toEqual([
					"anthropic/claude-sonnet-4-5",
					"openai/gpt-5.4",
				])
			})
		})

		describe("#when nested fallback_models is empty but global exists", () => {
			test("#then falls back to global models", () => {
				const agents = {
					review: {
						model: "anthropic/claude-sonnet-4-5",
						options: {
							fallback_models: [],
						},
					},
				}
				const globalModels = ["openai/gpt-5.4"]

				const result = getFallbackModelsForSession(
					"ses_123",
					"review",
					agents,
					globalModels
				)

				expect(result).toEqual(globalModels)
			})
		})
	})
})
