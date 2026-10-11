
import dns from "node:dns";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

if (!process.env.MONGODB_URI) {
  dotenv.config({ path: ".env.local" });
  dotenv.config();
}

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("Missing MONGODB_URI in .env.local");
}

try {
  // Use public DNS fallback if system resolver refuses SRV records
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
} catch {
  // Ignore in environments where setServers is not permitted
}

const globalWithMongo = globalThis;

const client =
  globalWithMongo._mongoClient ??
  new MongoClient(uri, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
  });

if (process.env.NODE_ENV !== "production") {
  globalWithMongo._mongoClient = client;
}

const connectedClientPromise =
  globalWithMongo._mongoClientPromise ??
  client.connect();

if (process.env.NODE_ENV !== "production") {
  globalWithMongo._mongoClientPromise = connectedClientPromise;
}

const db = client.db("farmwise_ai");

export { client, db, connectedClientPromise };
