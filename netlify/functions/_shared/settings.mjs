import { getDatabase } from "@netlify/database";
export async function supervisorAddonHalalas(db=getDatabase()){
  let raw=Number(Netlify.env.get("HALA_SUPERVISOR_ADDON_SAR")||299);
  try{const rows=await db.sql`SELECT value FROM platform_settings WHERE key='supervisor_addon_sar' LIMIT 1`;if(rows[0]?.value!==undefined)raw=Number(rows[0].value)}catch{}
  if(!Number.isFinite(raw)||raw<0)raw=299;
  return Math.round(raw*100);
}
