export const PAYMENT_PACKAGES={
  start:{code:"start",name:"البداية",guestLimit:50,amount:2900,currency:"SAR"},
  basic:{code:"basic",name:"الأساسية",guestLimit:200,amount:9900,currency:"SAR"},
  royal:{code:"royal",name:"الملكية",guestLimit:500,amount:14900,currency:"SAR"}
};
export function packageFor(codeOrName){
  const raw=String(codeOrName||"");
  const byCode=PAYMENT_PACKAGES[raw];
  if(byCode)return byCode;
  return Object.values(PAYMENT_PACKAGES).find(x=>x.name===raw)||null;
}
export function supervisorAddonHalalas(){
  const raw=Number(Netlify.env.get("HALA_SUPERVISOR_ADDON_SAR")||199);
  return Math.max(0,Math.round((Number.isFinite(raw)?raw:199)*100));
}
export function quote(packageCode,requestSupervisor=false){
  const p=packageFor(packageCode);if(!p)return null;
  const addon=requestSupervisor?supervisorAddonHalalas():0;
  return {...p,baseAmount:p.amount,supervisorAddonAmount:addon,totalAmount:p.amount+addon,amountSar:(p.amount+addon)/100};
}
export function publicPackages(){return Object.values(PAYMENT_PACKAGES).map(p=>({...p,amountSar:p.amount/100}))}
