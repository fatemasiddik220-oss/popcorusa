import mongoose from 'mongoose';

const DEFAULT_MONGO_URI = 'mongodb+srv://mdabulhasan213_db_user:G5okXbvLoHIDly81@cluster0.7ng5wwb.mongodb.net/PopcornUS?retryWrites=true&w=majority&appName=Cluster0';

export function resolveMongoUri(inputUri?: string): { uri: string; dbName: string } {
  const raw = (inputUri || process.env.MONGODB_URI || DEFAULT_MONGO_URI).trim().replace(/^['"]|['"]$/g, '');
  let targetDbName = process.env.MONGODB_DATABASE || 'PopcornUS';
  let cleanUri = raw;

  try {
    const parsed = new URL(raw);
    const pathName = parsed.pathname.replace(/^\//, '').trim();
    if (pathName) {
      targetDbName = pathName;
    } else {
      // If URI pathname was empty (e.g. mongodb+srv://user:pass@cluster0.../?appName=...), inject target db name
      parsed.pathname = `/${targetDbName}`;
      cleanUri = parsed.toString();
    }
  } catch {
    if (cleanUri.includes('.mongodb.net/?')) {
      cleanUri = cleanUri.replace('.mongodb.net/?', `.mongodb.net/${targetDbName}?`);
    } else if (cleanUri.endsWith('.mongodb.net/')) {
      cleanUri = `${cleanUri}${targetDbName}`;
    } else if (cleanUri.endsWith('.mongodb.net')) {
      cleanUri = `${cleanUri}/${targetDbName}`;
    }
  }

  return { uri: cleanUri, dbName: targetDbName };
}

const initialResolved = resolveMongoUri();
export let activeMongoUri = initialResolved.uri;
export let activeDbName = initialResolved.dbName;

let isConnecting = false;
let isConnected = false;
let lastError: string | null = null;
let containerEgressIp: string | null = null;
let connectionStatus: 'connected' | 'connecting' | 'whitelist_required' | 'disconnected' = 'disconnected';

type ConnectionCallback = () => void;
const connectedCallbacks: ConnectionCallback[] = [];

export function onMongoConnected(cb: ConnectionCallback) {
  connectedCallbacks.push(cb);
  if (isConnected) {
    try {
      cb();
    } catch (e) {
      console.warn('[MongoDB Atlas] Callback error:', e);
    }
  }
}

// Fetch public egress IP of the container for easy whitelisting instructions
async function detectContainerIp(): Promise<string | null> {
  if (containerEgressIp) return containerEgressIp;
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data: any = await res.json();
      containerEgressIp = data.ip;
      return containerEgressIp;
    }
  } catch {
    // Ignore fetch failure
  }
  return null;
}

// Automatically detect IP on startup in background
detectContainerIp().catch(() => {});

export async function connectMongo(customUri?: string): Promise<typeof mongoose | null> {
  if (customUri) {
    const resolved = resolveMongoUri(customUri);
    activeMongoUri = resolved.uri;
    activeDbName = resolved.dbName;
    isConnected = false;
  }

  if (isConnected || (mongoose.connection.readyState as number) === 1) {
    isConnected = true;
    connectionStatus = 'connected';
    lastError = null;
    return mongoose;
  }

  if (isConnecting) {
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 200));
      if ((mongoose.connection.readyState as number) === 1) {
        isConnected = true;
        connectionStatus = 'connected';
        lastError = null;
        return mongoose;
      }
    }
  }

  try {
    isConnecting = true;
    connectionStatus = 'connecting';
    console.log(`[MongoDB Atlas] Connecting to cluster (${activeDbName}) with 10s timeout...`);

    await mongoose.connect(activeMongoUri, {
      dbName: activeDbName,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 30000,
      bufferCommands: false, // Prevent hanging buffers when disconnected
    });

    isConnected = true;
    connectionStatus = 'connected';
    lastError = null;
    console.log(`[MongoDB Atlas] ✅ Successfully connected to MongoDB database [${mongoose.connection.db?.databaseName || activeDbName}]!`);

    mongoose.connection.on('error', (err) => {
      console.warn('[MongoDB Atlas] Runtime connection notice:', err?.message || err);
      if ((mongoose.connection.readyState as number) !== 1) {
        isConnected = false;
        connectionStatus = 'disconnected';
      }
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB Atlas] Notice: Disconnected from MongoDB. Fail-safe storage active; will auto-reconnect.');
      isConnected = false;
      connectionStatus = 'disconnected';
    });

    // Notify listeners (e.g., db sync)
    for (const cb of connectedCallbacks) {
      try {
        cb();
      } catch (err) {
        console.warn('[MongoDB Atlas] Error running connected callback:', err);
      }
    }

    return mongoose;
  } catch (err: any) {
    isConnected = false;
    const msg = err?.message || String(err);
    lastError = msg;

    const isWhitelistIssue =
      msg.includes('whitelisted') ||
      msg.includes('whitelist') ||
      msg.includes('Could not connect to any servers');

    if (isWhitelistIssue) {
      connectionStatus = 'whitelist_required';
      const ip = containerEgressIp || 'dynamic cloud IP';
      console.warn(
        `[MongoDB Atlas] Notice: Atlas cluster unreachable (IP whitelist required for ${ip}). ` +
        `To sync with Atlas, allow 0.0.0.0/0 in MongoDB Atlas -> Network Access. ` +
        `Using resilient local persistence in the meantime (all user balances and referrals are safe).`
      );
    } else {
      connectionStatus = 'disconnected';
      console.warn('[MongoDB Atlas] Connection notice:', msg);
    }

    return null;
  } finally {
    isConnecting = false;
  }
}

export function isMongoConnected(): boolean {
  return (mongoose.connection.readyState as number) === 1;
}

export function getMongoStatusDetails() {
  const ready = isMongoConnected();
  const dbName = mongoose.connection.db?.databaseName || activeDbName || 'PopcornUS';
  return {
    isConnected: ready,
    connected: ready,
    status: ready ? 'connected' : connectionStatus,
    activeUri: activeMongoUri.replace(/:([^@:]+)@/, ':****@'),
    error: ready ? null : lastError,
    containerIp: containerEgressIp,
    cluster: `cluster0.7ng5wwb.mongodb.net/${dbName}`,
    database: dbName,
  };
}

// Background auto-reconnect loop (retries every 45s without throwing uncaught errors)
setInterval(() => {
  if (!isMongoConnected() && !isConnecting) {
    connectMongo().catch(() => {});
  }
}, 45000);

