import { db, AuditLog, User } from '../db/database';
import { randomUUID } from 'crypto';

export function logAudit(
  actor: { id: string; email: string; role: string; name?: string },
  action: string,
  entity: string,
  entity_id?: string,
  before_state?: any,
  after_state?: any
): void {
  const auditLogs = db.get('audit_logs');
  const newLog: AuditLog = {
    id: randomUUID(),
    actor_id: actor.id,
    actor_name: actor.name || actor.email,
    actor_role: actor.role,
    action,
    entity,
    entity_id,
    before_state: before_state ? JSON.parse(JSON.stringify(before_state)) : undefined,
    after_state: after_state ? JSON.parse(JSON.stringify(after_state)) : undefined,
    created_at: new Date().toISOString(),
  };

  auditLogs.unshift(newLog); // newest first
  // keep last 1000 logs
  if (auditLogs.length > 1000) {
    auditLogs.length = 1000;
  }
  db.set('audit_logs', auditLogs);
}
