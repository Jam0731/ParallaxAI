// ── Agent IDs ──
export type AgentId = "munger" | "woz" | "ogilvy" | "taleb" | string

// ── Agent Status ──
export type AgentStatus = "idle" | "busy" | "error" | "offline"

// ── Stop Reasons ──
export type StopReason = "end_turn" | "cancelled" | "timeout" | "error" | "max_tokens"

// ── Message Roles ──
export type MessageRole = "user" | "assistant" | "system" | "tool"

// ── Agent Adapter ──
export interface AgentAdapter {
  readonly id: string
  readonly name: string
  readonly capabilities: string[]

  detect(): Promise<DetectResult>
  initialize(config: AdapterConfig): Promise<void>
  shutdown(): Promise<void>
  healthCheck(): Promise<HealthStatus>

  run(task: AgentTask): Promise<AgentResponse>
  runStream(task: AgentTask): AsyncIterable<AgentChunk>
  cancel(): Promise<void>
}

export interface DetectResult {
  found: boolean
  version?: string
  path?: string
  error?: string
}

export interface HealthStatus {
  healthy: boolean
  latencyMs?: number
  lastError?: string
}

export interface AdapterConfig {
  env?: Record<string, string>
  model?: string
  workDir?: string
}

export interface SessionOpts {
  workDir?: string
  mcpServers?: string[]
}

export interface SessionHandle {
  sessionId: string
  adapter: AgentAdapter
  send(message: string): AsyncIterable<AgentChunk>
  cancel(): Promise<void>
  close(): Promise<void>
}

export interface AgentTask {
  message: string
  context?: string              // skill + 共享记忆 + 跨 agent 上下文
  history?: Message[]           // 对话历史
  workDir?: string
  timeout?: number
  agentId?: string              // 用于 session 路由
  conversationId?: string       // 用于 session 复用
  sessionId?: string            // 持久化的 session ID（由 gateway 从 store 加载）
}

export interface AgentResponse {
  text: string
  toolCalls?: ToolCall[]
  usage?: UsageInfo
  stopReason: StopReason
  durationMs: number
  sessionId?: string  // Session ID captured during execution
}

export interface AgentChunk {
  type: "text" | "thinking" | "tool_call" | "tool_update" | "usage" | "error" | "done"
  content?: string
  toolCallId?: string
  toolTitle?: string
  toolStatus?: "pending" | "running" | "completed" | "failed"
  toolOutput?: string
  usage?: UsageInfo
  error?: string
}

// ── Messages ──
export interface Message {
  id: string
  conversationId: string
  branchId: string
  role: MessageRole
  agentId?: AgentId
  adapterId?: string
  content: string
  metadata?: MessageMetadata
  createdAt: number
  tokensUsed?: number
  costUsd?: number
}

export interface MessageMetadata {
  toolCalls?: ToolCall[]
  delegations?: DelegationTask[]
  isDelegationResult?: boolean
  delegatedBy?: AgentId
}

// ── Tool Calls ──
export interface ToolCall {
  id: string
  title: string
  kind: string
  status: "pending" | "running" | "completed" | "failed"
  output?: string
}

// ── Usage ──
export interface UsageInfo {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costUsd: number
  durationMs: number
}

// ── Cost ──
export interface CostEntry {
  agentId: AgentId
  adapterId: string
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  conversationId?: string
  messageId?: string
  timestamp: number
}

// ── Delegation ──
export interface DelegationTask {
  target: AgentId
  task: string
}

export interface DelegatedTaskRecord {
  id: string
  conversationId: string
  delegatingAgent: AgentId
  targetAgent: AgentId
  task: string
  status: "pending" | "running" | "completed" | "needs_decision"
  result?: string
  createdAt: number
  completedAt?: number
}

// ── Routing ──
export interface RoutingDecision {
  targetAgent: AgentId
  directMessage: string
  isExplicitMention: boolean
  isDebate: boolean
}

// ── Context ──
export interface ContextBundle {
  sharedContext?: string       // 统一共享上下文（shared_context.json）
  conversationSummary?: string
  crossAgentContext?: string
}

// ── Role Config ──
export interface RoleConfig {
  name: string
  skill: string
  preferred: string
  fallback: string[]
}

// ── Conversation ──
export interface Conversation {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  activeBranch: string
  metadata?: Record<string, unknown>
  workspaceId?: string
}

// ── Branch ──
export interface Branch {
  id: string
  conversationId: string
  name: string
  forkPoint: string
  createdAt: number
  isActive: boolean
}

// ── WebSocket Messages ──
export type ClientMessage =
  | { type: "chat"; content: string; conversationId: string }
  | { type: "typing"; conversationId: string }
  | { type: "cancel"; conversationId: string }
  | { type: "ping" }
  | { type: "subscribe"; conversationId: string }
  | { type: "unsubscribe"; conversationId: string }
  | { type: "branch_create"; conversationId: string; fromMessageId: string; name: string }
  | { type: "branch_switch"; conversationId: string; branchId: string }
  | { type: "sync"; conversationId: string; lastMessageId?: string }
  | { type: "workspace_list" }
  | { type: "workspace_switch"; workspaceId: string }
  | { type: "workspace_create"; path: string; name?: string }
  | { type: "conversation_list" }
  | { type: "conversation_history"; conversationId: string }
  | { type: "conversation_select"; conversationId: string }
  | { type: "delegation_tasks"; limit?: number }
  | { type: "cron_jobs" }
  | { type: "cron_runs"; jobId?: string; limit?: number }
  | { type: "cost_summary" }
  | { type: "cron_add"; name: string; description?: string; scheduleType: string; scheduleValue: string; targetAgent?: string; payloadType?: string; payloadData?: string }
  | { type: "cron_remove"; jobId: string }
  | { type: "cron_toggle"; jobId: string; enabled: boolean }
  | { type: "cron_run"; jobId: string }

export type ServerMessage =
  | { type: "chat_start"; conversationId: string; messageId: string; agentId: AgentId }
  | { type: "chat_chunk"; messageId: string; chunk: string; agentId: AgentId }
  | { type: "chat_thinking"; messageId: string; content: string; agentId: AgentId }
  | { type: "chat_tool_call"; messageId: string; toolCallId: string; title: string; status: "pending" | "running" }
  | { type: "chat_tool_update"; messageId: string; toolCallId: string; status: "completed" | "failed"; output?: string }
  | { type: "chat_end"; messageId: string; stopReason: StopReason; usage: UsageInfo }
  | { type: "chat_error"; messageId: string; error: string; recoverable: boolean }
  | { type: "agent_status"; agentId: AgentId; status: AgentStatus }
  | { type: "cost_update"; agentId: AgentId; cost: CostEntry }
  | { type: "pong" }
  | { type: "error"; message: string; code: string }
  | { type: "conversation_list"; conversations: Conversation[] }
  | { type: "conversation_history"; conversationId: string; messages: Message[] }

// ── ACP Protocol ──
export interface AcpRequest {
  jsonrpc: "2.0"
  id: number
  method: string
  params?: unknown
}

export interface AcpResponse {
  jsonrpc: "2.0"
  id: number
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

export interface AcpNotification {
  jsonrpc: "2.0"
  method: string
  params?: unknown
}

export type AcpMessage = AcpRequest | AcpResponse | AcpNotification

export interface AcpInitializeResult {
  protocolVersion: number
  serverInfo: { name: string; version: string }
  agentCapabilities: Record<string, unknown>
}

export interface ContentBlock {
  type: "text" | "resource" | "image" | "audio"
  text?: string
  resource?: { uri: string; text: string }
  data?: string
  mimeType?: string
}
