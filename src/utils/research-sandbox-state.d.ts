export function acceptsEvent(run: {workspaceId:string;runId:string;inputFingerprint:string}|null, sequence:number, event:any): boolean
export function isRunning(run: {executionStatus:string}|null): boolean
