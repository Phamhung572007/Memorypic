const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const rootDir = path.join(__dirname, '..', '..');
const importDir = path.join(rootDir, 'mongo-import');
const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'memorypic';
const shouldDrop = process.argv.includes('--drop');

async function readJson(filePath) {
  const raw = await fs.promises.readFile(filePath, 'utf8');
  const data = JSON.parse(raw);
  return Array.isArray(data) ? data : [data];
}

async function main() {
  if (!mongoUri) {
    throw new Error('Missing MONGODB_URI in backend/.env');
  }

  const files = (await fs.promises.readdir(importDir))
    .filter((file) => file.endsWith('.json'))
    .sort();

  if (!files.length) {
    throw new Error(`No JSON files found in ${importDir}`);
  }

  const client = new MongoClient(mongoUri);
  await client.connect();

  try {
    const db = client.db(dbName);
    console.log(`Connected to MongoDB database "${dbName}"`);

    for (const file of files) {
      const collectionName = path.basename(file, '.json');
      const collection = db.collection(collectionName);
      const documents = await readJson(path.join(importDir, file));

      if (shouldDrop) {
        await collection.deleteMany({});
      }

      if (documents.length) {
        await collection.insertMany(documents, { ordered: false });
      }

      console.log(`${collectionName}: imported ${documents.length} documents`);
    }

    console.log('Import completed.');
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
