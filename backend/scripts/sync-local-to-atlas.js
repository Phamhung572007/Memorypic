const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');

dotenv.config({ path: '.env' });

const sourceUri = process.env.LOCAL_MONGODB_URI || 'mongodb://127.0.0.1:27017';
const sourceDbName = process.env.LOCAL_MONGODB_DB || 'Memorypic';
const targetUri = process.env.MONGODB_URI;
const targetDbName = process.env.MONGODB_DB || 'memorypic';

async function main() {
  if (!targetUri) {
    throw new Error('Missing MONGODB_URI in backend/.env');
  }

  const sourceClient = new MongoClient(sourceUri, { serverSelectionTimeoutMS: 10000 });
  const targetClient = new MongoClient(targetUri, { serverSelectionTimeoutMS: 20000 });

  await sourceClient.connect();
  await targetClient.connect();

  try {
    const sourceDb = sourceClient.db(sourceDbName);
    const targetDb = targetClient.db(targetDbName);
    const collections = await sourceDb.listCollections().toArray();
    const summary = [];

    console.log(`Sync ${sourceUri}/${sourceDbName} -> Atlas/${targetDbName}`);

    for (const collectionInfo of collections) {
      const name = collectionInfo.name;
      const sourceCollection = sourceDb.collection(name);
      const targetCollection = targetDb.collection(name);
      const documents = await sourceCollection.find({}).toArray();

      await targetCollection.deleteMany({});
      if (documents.length) {
        await targetCollection.insertMany(documents, { ordered: false });
      }

      summary.push({ collection: name, copied: documents.length });
      console.log(`${name}: ${documents.length}`);
    }

    console.log('Sync completed.');
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await sourceClient.close();
    await targetClient.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
