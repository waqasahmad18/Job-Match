import dns from "dns";
import mongoose from "mongoose";

dns.setServers(["8.8.8.8", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & {
  mongooseCache?: MongooseCache;
};

const cache: MongooseCache = globalForMongoose.mongooseCache ?? {
  conn: null,
  promise: null,
};

if (!globalForMongoose.mongooseCache) {
  globalForMongoose.mongooseCache = cache;
}

export function hasMongoUri() {
  return Boolean(process.env.MONGODB_URI);
}

export async function connectMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  if (cache.conn) {
    return cache.conn;
  }

  const options = {
    bufferCommands: false,
    dbName: process.env.MONGODB_DB || "fast_and_slow_pos",
    family: 4 as const,
    serverSelectionTimeoutMS: 20000,
  };

  if (!cache.promise) {
    const preferred = process.env.MONGODB_URI_STANDARD || uri;
    cache.promise = mongoose.connect(preferred, options).catch((error) => {
      if (preferred === uri || !uri) throw error;
      return mongoose.connect(uri, options);
    });
  }

  cache.conn = await cache.promise;
  const { ensureLocalWatcher } = await import("./startWatcher");
  ensureLocalWatcher();
  return cache.conn;
}

export async function pingMongo() {
  if (!hasMongoUri()) return false;
  try {
    const conn = await connectMongo();
    return conn.connection.readyState === 1;
  } catch {
    return false;
  }
}
