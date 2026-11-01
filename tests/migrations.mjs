import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('pending migrations follow the deployed production watermark and preserve existing rows', async t => {
  const pg = new PGlite();
  t.after(() => pg.close());
  const root = new URL('../netlify/database/migrations/', import.meta.url);
  const watermark = '20261101024000';
  const pending = ['20261101063000_customer-free-trial', '20261101063100_catalog-order-entitlements'];
  const names = (await readdir(root)).sort();
  for (const name of pending) {
    assert.ok(name.split('_')[0] > watermark, 'new migrations must sort after the already deployed production version');
    assert.ok(names.includes(name));
  }
  assert.ok(!names.includes('20261031230000_customer-free-trial'));
  assert.ok(!names.includes('20261101010000_catalog-order-entitlements'));
  for (const name of names.filter(name => !pending.includes(name))) {
    await pg.exec(await readFile(new URL(name + '/migration.sql', root), 'utf8'));
  }
  await pg.exec(`
    INSERT INTO users(id,name,phone,role) VALUES('migration-owner','Fixture','966500000001','customer');
    INSERT INTO events(id,owner_token,title,occasion) VALUES('trial-event','fixture-trial','Trial','زواج'),('paid-event','fixture-paid','Paid','زواج');
    INSERT INTO event_members(event_id,user_id,member_role) VALUES('trial-event','migration-owner','owner'),('paid-event','migration-owner','owner');
    INSERT INTO guests(id,event_id,name,code) VALUES('existing-guest','trial-event','Fixture','migration-fixture');
    INSERT INTO whatsapp_messages(event_id,guest_id,status) VALUES('trial-event','existing-guest','delivered');
    INSERT INTO payment_orders(id,event_id,user_id,package_code,amount,status) VALUES('existing-order','paid-event','migration-owner','basic',34900,'paid');
    INSERT INTO supervisor_requests(id,event_id,user_id,amount,status) VALUES('existing-service','paid-event','migration-owner',29900,'requested');
  `);
  const before = (await pg.query('SELECT id,amount,status FROM payment_orders ORDER BY id')).rows;
  for (const name of pending) {
    await pg.exec('BEGIN');
    await pg.exec(await readFile(new URL(name + '/migration.sql', root), 'utf8'));
    await pg.exec('COMMIT');
  }
  assert.deepEqual((await pg.query('SELECT id,amount,status FROM payment_orders ORDER BY id')).rows, before);
  assert.equal((await pg.query("SELECT guest_limit FROM payment_orders WHERE id='existing-order'")).rows[0].guest_limit, 200);
  assert.equal((await pg.query("SELECT user_id FROM customer_free_trials")).rows[0].user_id, 'migration-owner');
  assert.equal((await pg.query('SELECT count(*)::int count FROM guests')).rows[0].count, 1);
  assert.equal((await pg.query('SELECT count(*)::int count FROM events')).rows[0].count, 2);
  assert.equal((await pg.query('SELECT amount FROM supervisor_requests')).rows[0].amount, 29900);
  assert.equal((await pg.query("SELECT value FROM platform_settings WHERE key='supervisor_addon_sar'")).rows[0].value, '599');
});
