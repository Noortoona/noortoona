import { getDatabase } from "@netlify/database";

const encoder = new TextEncoder();
const bytesToHex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");

export async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(String(value)));
  return bytesToHex(new Uint8Array(digest));
}
export async function ensureAuthSchema(){ return getDatabase(); }
export function publicUser(user){
  return {id:user.id,name:user.name||"",email:user.email||"",phone:user.phone||"",role:user.role,status:user.status};
}
export async function createSession(userId){
  const db=getDatabase();
  const token=crypto.randomUUID().replaceAll("-","")+crypto.randomUUID().replaceAll("-","");
  const tokenHash=await sha256(token);
  const expiresAt=new Date(Date.now()+30*24*60*60*1000);
  await db.sql`INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (${tokenHash},${userId},${expiresAt.toISOString()}::timestamptz)`;
  return {token,expiresAt:expiresAt.toISOString()};
}
export function bearerToken(req){
  const h=String(req.headers.get("authorization")||"");
  return h.toLowerCase().startsWith("bearer ")?h.slice(7).trim():"";
}
export async function getAuth(req){
  const token=bearerToken(req); if(!token)return null;
  const db=getDatabase(), tokenHash=await sha256(token);
  const rows=await db.sql`
    SELECT u.id,u.name,u.email,u.phone,u.role,u.status,s.expires_at
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=${tokenHash} LIMIT 1`;
  const u=rows[0]; if(!u)return null;
  if(u.status!=="active"||new Date(u.expires_at).getTime()<=Date.now()){await db.sql`DELETE FROM sessions WHERE token_hash=${tokenHash}`;return null}
  return {user:publicUser(u),tokenHash};
}
export async function requireRole(req,allowed=[]){
  const auth=await getAuth(req);
  if(!auth)return {ok:false,status:401,error:"يجب تسجيل الدخول"};
  if(allowed.length&&!allowed.includes(auth.user.role))return {ok:false,status:403,error:"لا تملك صلاحية لهذا الإجراء"};
  return {ok:true,...auth};
}
export async function linkEventMember(eventId,userId,memberRole="owner"){
  const db=getDatabase();
  await db.sql`INSERT INTO event_members(event_id,user_id,member_role) VALUES(${eventId},${userId},${memberRole})
    ON CONFLICT(event_id,user_id) DO UPDATE SET member_role=EXCLUDED.member_role`;
}
export async function canAccessEvent(user,eventId){
  if(!user)return false;if(user.role==="admin")return true;
  const db=getDatabase();const rows=await db.sql`SELECT 1 FROM event_members WHERE event_id=${eventId} AND user_id=${user.id} LIMIT 1`;
  return Boolean(rows[0]);
}
export async function recordAudit(actorUserId,action,entityType="",entityId="",metadata={}){
  try{const db=getDatabase();await db.sql`INSERT INTO audit_log(id,actor_user_id,action,entity_type,entity_id,metadata)
    VALUES(${crypto.randomUUID()},${actorUserId||null},${String(action).slice(0,100)},${String(entityType).slice(0,60)},${String(entityId).slice(0,160)},${JSON.stringify(metadata).slice(0,4000)}::jsonb)`;}catch{}
}
