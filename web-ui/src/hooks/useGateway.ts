import { useEffect, useRef, useState, useCallback } from 'react'

type ServerMessage = {
  type: string
  [key: string]: any
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  agentId?: string
  content: string
  timestamp: number
}

type Workspace = {
  id: string
  name: string
  path: string
  isDefault: boolean
}

type Conversation = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  workspaceId?: string
  workspaceName?: string
}

const STORAGE_KEYS = {
  workspace: 'parallaxai_current_workspace',
  conversation: 'parallaxai_current_conversation',
}

export function useGateway(url: string) {
  const wsRef = useRef<WebSocket | null>(null)
  const conversationIdRef = useRef<string>(
    localStorage.getItem(STORAGE_KEYS.conversation) ?? `conv-${Date.now()}`
  )
  const [connected, setConnected] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [agents, setAgents] = useState<Record<string, string>>({})
  const [streaming, setStreaming] = useState<{ id: string; agentId: string; content: string } | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversationId, setConversationId] = useState<string>(conversationIdRef.current)
  const [delegationTasks, setDelegationTasks] = useState<any[]>([])
  const [cronJobs, setCronJobs] = useState<any[]>([])
  const [cronRuns, setCronRuns] = useState<any[]>([])
  const [costSummary, setCostSummary] = useState<{
    today: { totalUsd: number; totalTokens: number }
  }>({ today: { totalUsd: 0, totalTokens: 0 } })
  const [delegationProposal, setDelegationProposal] = useState<{
    conversationId: string
    delegations: Array<{ target: string; task: string }>
  } | null>(null)

  // Keep ref in sync
  useEffect(() => {
    conversationIdRef.current = conversationId
    localStorage.setItem(STORAGE_KEYS.conversation, conversationId)
  }, [conversationId])

  useEffect(() => {
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      ws.send(JSON.stringify({ type: 'workspace_list' }))
      ws.send(JSON.stringify({ type: 'conversation_list' }))
      ws.send(JSON.stringify({ type: 'conversation_history', conversationId: conversationIdRef.current }))
      ws.send(JSON.stringify({ type: 'cost_summary' }))
    }
    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)

    ws.onmessage = (event) => {
      const msg: ServerMessage = JSON.parse(event.data)
      handleMessage(msg)
    }

    return () => { ws.close() }
  }, [url])

  // Stable handleMessage — uses refs for current state, no useCallback dependency issues
  const handleMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'agent_status':
        if (msg.agentId && msg.status) {
          setAgents(prev => ({ ...prev, [msg.agentId]: msg.status }))
        }
        break

      case 'workspace_list':
        if (msg.workspaces) {
          setWorkspaces(msg.workspaces)
          const savedWsId = localStorage.getItem(STORAGE_KEYS.workspace)
          const active = msg.workspaces.find((w: Workspace) => w.id === savedWsId)
            ?? msg.workspaces.find((w: Workspace) => w.id === msg.activeId)
            ?? msg.workspaces[0]
          if (active) {
            setActiveWorkspace(active)
            localStorage.setItem(STORAGE_KEYS.workspace, active.id)
          }
        }
        break

      case 'workspace_active':
        if (msg.workspace) {
          setActiveWorkspace(msg.workspace)
          localStorage.setItem(STORAGE_KEYS.workspace, msg.workspace.id)
        }
        break

      case 'conversation_list':
        if (msg.conversations) setConversations(msg.conversations)
        break

      case 'conversation_history':
        if (msg.messages) {
          const mapped = msg.messages.map((m: any) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant' | 'system',
            agentId: m.agentId,
            content: m.content,
            timestamp: m.createdAt ?? Date.now(),
          }))
          setMessages(mapped)
        }
        break

      case 'chat_start':
        setStreaming({ id: msg.messageId, agentId: msg.agentId, content: '' })
        break

      case 'chat_chunk':
        setStreaming(prev => prev ? { ...prev, content: prev.content + (msg.chunk ?? '') } : null)
        break

      case 'chat_end':
        setStreaming(prev => {
          if (prev) {
            setMessages(m => [...m, {
              id: prev.id,
              role: 'assistant',
              agentId: prev.agentId,
              content: prev.content,
              timestamp: Date.now(),
            }])
          }
          return null
        })
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'conversation_list' }))
        }
        break

      case 'chat_error':
        setMessages(m => [...m, {
          id: `err-${Date.now()}`,
          role: 'system',
          content: `Error: ${msg.error}`,
          timestamp: Date.now(),
        }])
        setStreaming(null)
        break

      case 'cost_update':
        if (msg.cost) {
          setCostSummary(prev => ({
            today: {
              totalUsd: prev.today.totalUsd + (msg.cost?.costUsd ?? 0),
              totalTokens: prev.today.totalTokens + ((msg.cost?.inputTokens ?? 0) + (msg.cost?.outputTokens ?? 0)),
            }
          }))
        }
        break

      case 'cost_summary':
        if (msg.today) setCostSummary({ today: msg.today })
        break

      case 'delegation_tasks':
        if (msg.tasks) setDelegationTasks(msg.tasks)
        break

      case 'cron_jobs':
        if (msg.jobs) setCronJobs(msg.jobs)
        break

      case 'cron_runs':
        if (msg.runs) setCronRuns(msg.runs)
        break

      case 'delegation_proposal':
        setDelegationProposal({
          conversationId: msg.conversationId,
          delegations: msg.delegations,
        })
        break
    }
  }, []) // No dependencies — all state setters are stable

  const send = useCallback((content: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    setMessages(m => [...m, {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    }])

    const convId = conversationIdRef.current
    wsRef.current.send(JSON.stringify({ type: 'subscribe', conversationId: convId }))
    wsRef.current.send(JSON.stringify({ type: 'chat', content, conversationId: convId }))
  }, [])

  const switchWorkspace = useCallback((workspaceId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'workspace_switch', workspaceId }))
  }, [])

  const createWorkspace = useCallback((path: string, name?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'workspace_create', path, name }))
  }, [])

  const newConversation = useCallback(() => {
    const newId = `conv-${Date.now()}`
    conversationIdRef.current = newId
    setConversationId(newId)
    setMessages([])
    setStreaming(null)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'conversation_list' }))
    }
  }, [])

  const switchConversation = useCallback((id: string) => {
    conversationIdRef.current = id
    setConversationId(id)
    setMessages([])
    setStreaming(null)
    setDelegationProposal(null)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'conversation_select', conversationId: id }))
    }
  }, [])

  const deleteConversation = useCallback((id: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'conversation_delete', conversationId: id }))
    if (id === conversationIdRef.current) {
      const newId = `conv-${Date.now()}`
      conversationIdRef.current = newId
      setConversationId(newId)
      setMessages([])
      setStreaming(null)
    }
  }, [])

  const renameConversation = useCallback((id: string, title: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'conversation_rename', conversationId: id, title }))
  }, [])

  const cancel = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'cancel', conversationId: conversationIdRef.current }))
    setStreaming(null)
  }, [])

  const refreshDelegationTasks = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'delegation_tasks' }))
    }
  }, [])

  const refreshCronData = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'cron_jobs' }))
      wsRef.current.send(JSON.stringify({ type: 'cron_runs' }))
    }
  }, [])

  const refreshCostSummary = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'cost_summary' }))
    }
  }, [])

  const addCronJob = useCallback((job: { name: string; description?: string; scheduleType: string; scheduleValue: string; targetAgent?: string; payloadType?: string; payloadData?: string }) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'cron_add', ...job }))
  }, [])

  const removeCronJob = useCallback((jobId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'cron_remove', jobId }))
  }, [])

  const toggleCronJob = useCallback((jobId: string, enabled: boolean) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'cron_toggle', jobId, enabled }))
  }, [])

  const runCronJob = useCallback((jobId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'cron_run', jobId }))
  }, [])

  const approveDelegation = useCallback((delegations: Array<{ target: string; task: string }>) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({
      type: 'delegation_approve',
      conversationId: conversationIdRef.current,
      delegations,
    }))
    setDelegationProposal(null)
  }, [])

  const rejectDelegation = useCallback((userMessage: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({
      type: 'delegation_reject',
      conversationId: conversationIdRef.current,
      userMessage,
    }))
    setDelegationProposal(null)
  }, [])

  return {
    connected, messages, agents, streaming, send, cancel,
    workspaces, activeWorkspace, conversationId, conversations,
    switchWorkspace, createWorkspace, newConversation, switchConversation,
    deleteConversation, renameConversation,
    delegationTasks, refreshDelegationTasks,
    cronJobs, cronRuns, refreshCronData,
    costSummary, refreshCostSummary,
    setMessages,
    addCronJob, removeCronJob, toggleCronJob, runCronJob,
    delegationProposal, approveDelegation, rejectDelegation,
  }
}
