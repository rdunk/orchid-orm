import { change } from '../dbScript';

change(async (db) => {
  await db.createExtension('citext');
});
