import db from '../db/connection'

export async function logAudit(params: {
  userId?: number
  action: string
  entityType: string
  entityId?: number
  oldData?: unknown
  newData?: unknown
}): Promise<void> {
  try {
    await db('audit_logs').insert({
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      old_data: params.oldData !== undefined ? JSON.stringify(params.oldData) : null,
      new_data: params.newData !== undefined ? JSON.stringify(params.newData) : null,
    })
  } catch (err) {
    console.error('[audit_log] write failed:', err)
  }
}
