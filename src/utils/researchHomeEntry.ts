export interface ResearchEntryTarget {
  path: '/research/replay'
  query: { task: string; autoStart: '1' }
}

/** Keep the original case-replay interface and never put topic text in the URL. */
export function researchEntryTarget(background: string, localTaskId: string): ResearchEntryTarget | null {
  if (!background.trim() || !localTaskId.trim()) return null
  return {
    path: '/research/replay',
    query: { task: localTaskId, autoStart: '1' },
  }
}
