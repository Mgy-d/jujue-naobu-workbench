export interface MockBusinessService {
  handle(request: Request): Promise<Response>
}
export declare function createMockBusinessService(options?: { fullStudyChecks?: boolean }): MockBusinessService
export declare function startMockBusinessServer(port?: number): Promise<{
  service: MockBusinessService
  server: unknown
  url: string
  close(): Promise<void>
}>
