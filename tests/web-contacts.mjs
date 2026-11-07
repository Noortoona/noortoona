import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../web-contacts.js', import.meta.url), 'utf8');
function setup(navigator = {}) {
  const context = {window: {isSecureContext: true}, navigator};
  vm.runInNewContext(source, context);
  return context.window.HALA_WEB_CONTACTS;
}

test('normalize Saudi mobile numbers and Arabic numerals consistently', () => {
  const {normalizePhone} = setup();
  assert.equal(normalizePhone('050 123 4567'), '966501234567');
  assert.equal(normalizePhone('+966 50 123 4567'), '966501234567');
  assert.equal(normalizePhone('٠٥٠١٢٣٤٥٦٧'), '966501234567');
  assert.equal(normalizePhone('00966 50 123 4567'), '966501234567');
});

test('VCF import reads only names and phone numbers, including folded lines and multiple phones', () => {
  const {parseVCard} = setup();
  const file = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'FN:سارة ال',
    ' عامري',
    'TEL;TYPE=CELL:+966501234567',
    'TEL;TYPE=WORK:0551234567',
    'EMAIL:private@example.test',
    'END:VCARD',
    'BEGIN:VCARD',
    'N:Surname;First;;;',
    'TEL;VALUE=uri:tel:+966588888888',
    'END:VCARD'
  ].join('\r\n');
  const imported = parseVCard(file);
  assert.equal(imported.length, 3);
  assert.equal(imported[0].name, 'سارة العامري');
  assert.equal(imported[2].name, 'First Surname');
  assert.equal(imported[2].phone, '+966588888888');
  assert.ok(imported.every(person => !Object.hasOwn(person, 'email')));
});

test('user selected contacts are deduplicated against existing guests', () => {
  const api = setup();
  const contacts = api.rowsFromContacts([{name:['سارة'],tel:['0501234567','+966 50 123 4567']},{name:['ضيف'],tel:['0555555555']}]);
  const result = api.uniqueNewGuests(contacts,[{name:'old',phone:'966501234567'}]);
  assert.equal(result.length,1);
  assert.equal(result[0].phone,'966555555555');
});

test('unsupported browsers are detected; selection only shares requested name and tel', async () => {
  assert.equal(Boolean(setup().supported()), false);
  let selectedProperties, selectedOptions;
  const app = setup({contacts:{select:async(properties,options)=>{
    selectedProperties=properties; selectedOptions=options;
    return [{name:['Guest'],tel:['0512345678']}];
  }}});
  assert.equal(Boolean(app.supported()), true);
  assert.equal((await app.pick())[0].name,'Guest');
  assert.equal(JSON.stringify(selectedProperties),JSON.stringify(['name','tel']));
  assert.equal(selectedOptions.multiple,true);
});
