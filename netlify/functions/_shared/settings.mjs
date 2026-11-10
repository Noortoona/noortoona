import { getDatabase } from '@netlify/database';
import { readCatalog } from './catalog.mjs';
export async function supervisorAddonHalalas(db=getDatabase()){return (await readCatalog(db)).entry.unitAmount;}
