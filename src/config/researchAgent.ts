import { agentIdFromName } from '@/utils/nameUuid'

export interface ResearchAgentConfig { name: string; id: string }

/** The research agent has its own configuration; the old modeling configuration stays separate. */
export function resolveResearchAgent(input: { name?: string; id?: string }): ResearchAgentConfig {
  const name = input.name?.trim() || '市调演真'
  const override = input.id?.trim()
  if (override && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(override)) {
    throw new Error('市调智能体编号格式不正确，请检查 VITE_SZ_AGENT_ID。')
  }
  return { name, id: override || agentIdFromName(name) }
}

/** Read environment lazily so an invalid override does not blank the whole workbench. */
export function configuredResearchAgent(): ResearchAgentConfig {
  return resolveResearchAgent({ name: import.meta.env.VITE_SZ_AGENT_NAME, id: import.meta.env.VITE_SZ_AGENT_ID })
}
