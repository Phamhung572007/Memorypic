const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..', '..');
const sourceDir = path.join(rootDir, '.json');
const outputDir = path.join(rootDir, 'mongo-import');

const collections = [
  ['users.json', 'users'],
  ['auth_accounts.json', 'auth_accounts'],
  ['auth_sessions.json', 'auth_sessions'],
  ['boards.json', 'boards'],
  ['pins.json', 'pins'],
  ['tags.json', 'tags'],
  ['likes.json', 'likes'],
  ['saves.json', 'saves'],
  ['comments.json', 'comments'],
  ['followers.json', 'followers'],
  ['notifications.json', 'notifications'],
  ['conversations.json', 'conversations'],
  ['messages.json', 'messages'],
  ['image_uploads.json', 'image_uploads'],
  ['downloads.json', 'downloads'],
  ['profile_summaries.json', 'profile_summaries']
];

function readJsonArray(fileName) {
  const fullPath = path.join(sourceDir, fileName);
  const rows = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  if (!Array.isArray(rows)) {
    throw new Error(`${fileName} must contain a JSON array`);
  }
  return rows;
}

function writeJson(fileName, rows) {
  fs.writeFileSync(path.join(outputDir, fileName), JSON.stringify(rows, null, 2) + '\n', 'utf8');
}

function writeReadme(summary) {
  const lines = [
    '# MemoryPic MongoDB Compass Import',
    '',
    'Cac file trong thu muc nay duoc tao tu `.json` va giu dinh dang Extended JSON, vi du `{ "$oid": "..." }`.',
    '',
    'Cach import bang MongoDB Compass:',
    '',
    '1. Tao database ten `memorypic`.',
    '2. Tao collection theo cot `collection` ben duoi.',
    '3. Vao collection > Add Data > Import JSON or CSV file.',
    '4. Chon file JSON tu thu muc nay va import dang JSON.',
    '5. Sau khi import xong, chay backend voi `STORAGE_MODE=mongodb` va `MONGODB_URI`.',
    '',
    'Vi du `.env` trong `backend`:',
    '',
    '```env',
    'PORT=3000',
    'JWT_SECRET=mysecret',
    'STORAGE_MODE=mongodb',
    'MONGODB_URI=mongodb://127.0.0.1:27017',
    'MONGODB_DB=memorypic',
    '```',
    '',
    '| collection | file | records |',
    '| --- | --- | ---: |',
    ...summary.map((item) => `| ${item.collection} | ${item.file} | ${item.count} |`),
    ''
  ];
  fs.writeFileSync(path.join(outputDir, 'README.md'), lines.join('\n'), 'utf8');
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

const summary = [];

for (const [sourceFile, collectionName] of collections) {
  const rows = readJsonArray(sourceFile);
  const outputFile = `${collectionName}.json`;
  writeJson(outputFile, rows);
  summary.push({
    collection: collectionName,
    file: outputFile,
    count: rows.length
  });
}

writeReadme(summary);

console.log(`Prepared MongoDB Compass import files in ${outputDir}`);
summary.forEach((item) => {
  console.log(`${item.collection}: ${item.count} records -> ${item.file}`);
});
