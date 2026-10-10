const Database = require('better-sqlite3');
const db = new Database('data/maa.db');
db.prepare("DELETE FROM attendance_records WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@maganghub.kemnaker.go.id')").run();
db.prepare("DELETE FROM sync_runs WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@maganghub.kemnaker.go.id')").run();
db.prepare("DELETE FROM users WHERE email LIKE '%@maganghub.kemnaker.go.id'").run();
console.log('Cleaned test records successfully.');
