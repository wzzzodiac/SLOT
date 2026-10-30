import { HttpError } from './core.mjs';

export async function consume(db, {id, hash, digest, proposal, now, limit = 20}) {
  const day = Math.floor(now/86400000)*86400000;
  // A single INSERT plus transactional triggers is the entire acceptance boundary.
  // UNIQUE(code_hash) also protects it independently from the invitation flag.
  await db.prepare(`INSERT INTO requests(id,code_hash,digest,payload,created_at)
    SELECT ?,hash,?,?,? FROM invitations
    WHERE hash=? AND used_request_id IS NULL AND revoked_at IS NULL AND expires_at>?
    AND (SELECT count(*) FROM requests WHERE created_at>=?)<?
    ON CONFLICT DO NOTHING`).bind(id,digest,JSON.stringify(proposal),now,hash,now,day,limit).run();
  const row = await db.prepare('SELECT id,code_hash,digest FROM requests WHERE id=?').bind(id).first();
  if(row?.code_hash === hash && row?.digest === digest) return {id,accepted:true};
  if(row) throw new HttpError(409,'This retry changed. Refresh before sending a different proposal.');
  throw new HttpError(403,'That code is unavailable. Ask Walter for a new one.');
}

export async function claimMail(db, now, lease) {
  // preparing is safe to reclaim: no Gmail POST has started in this state.
  return db.prepare(`UPDATE outbox SET state='preparing',lease=?,lease_until=?,attempts=attempts+1
    WHERE request_id=(SELECT request_id FROM outbox WHERE
      (state='pending' AND available_at<=?) OR (state='preparing' AND lease_until<?)
      ORDER BY available_at LIMIT 1)
    RETURNING request_id,attempts`).bind(lease,now+120000,now,now).first();
}

export async function markSending(db,id,lease,now=Date.now()) {
  const row = await db.prepare(`UPDATE outbox SET state='sending',lease_until=NULL,sending_at=?
    WHERE request_id=? AND lease=? AND state='preparing' RETURNING request_id`).bind(now,id,lease).first();
  return !!row;
}
