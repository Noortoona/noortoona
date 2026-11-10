import {moyasarFeatures} from './payments.mjs';
export function capabilities(){
 const get=k=>Netlify.env.get(k);
 const enabled=get('HALA_WHATSAPP_INVITES_ENABLED')==='true'&&get('HALA_WHATSAPP_TEMPLATES_APPROVED')==='true'&&get('D360_MODE')==='production'&&Boolean(get('D360_API_KEY')&&get('D360_WEBHOOK_TOKEN')&&get('D360_INVITE_TEMPLATE')&&get('D360_TEMPLATE_LANGUAGE'));
 const payments=moyasarFeatures();
 return {whatsappInvites:{enabled,status:enabled?'configured_delivery_unverified':'pending_activation'},reminders:{enabled:false,status:'scheduler_pending'},payments:{enabled:payments.configured,mode:payments.mode},manualSharing:{enabled:true},bespokeDesign:{status:'assisted_service',revisionRounds:2}};
}
