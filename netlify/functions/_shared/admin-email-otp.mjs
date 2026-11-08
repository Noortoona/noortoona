import { sha256 } from "./auth.mjs";
export const normalizeEmail=value=>String(value||"").trim().toLowerCase();
export const validEmail=email=>email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export async function emailHash(email,code){
 const secret=String(Netlify.env.get("HALA_OTP_SECRET")||"");
 if(secret.length<24)throw new Error("OTP_SECRET_REQUIRED");
 return sha256("admin-email:"+email+":"+code+":"+secret);
}
export function allowedEmail(email){
 const allow=String(Netlify.env.get("HALA_ADMIN_EMAILS")||"").split(",").map(normalizeEmail).filter(Boolean);
 return allow.includes(email);
}
