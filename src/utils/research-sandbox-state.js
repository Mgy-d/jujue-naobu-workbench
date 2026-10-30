export function acceptsEvent(run, sequence, event) {
  return !!run && ['workspaceId','runId','inputFingerprint'].every(k => run[k] === event[k])
    && Number.isSafeInteger(event.sequence) && event.sequence > sequence
}
export function isRunning(run) { return !!run && ['queued','running'].includes(run.executionStatus) }
