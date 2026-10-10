
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("Missing MONGODB_URI in .env.local");
}

const client = new MongoClient(uri);

const db = client.db("farmwise_ai");

export { client, db };
