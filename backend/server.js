const crypto = require('crypto');
const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');

dotenv.config();

const app = express();

const {
  PORT = 3000,
  JWT_SECRET = 'mysecret',
  API_PREFIX = '/api',
  MONGODB_URI,
  MONGODB_DB = 'Memorypic',
  STORAGE_MODE,
  GOOGLE_CLIENT_ID
} = process.env;

const storageMode = (STORAGE_MODE || (MONGODB_URI ? 'mongodb' : 'json')).toLowerCase();

const DATA_DIR = path.join(__dirname, '..', '.json');
const COLLECTIONS = {
  users: 'users.json',
  authAccounts: 'auth_accounts.json',
  authSessions: 'auth_sessions.json',
  boards: 'boards.json',
  pins: 'pins.json',
  tags: 'tags.json',
  likes: 'likes.json',
  saves: 'saves.json',
  comments: 'comments.json',
  followers: 'followers.json',
  notifications: 'notifications.json',
  conversations: 'conversations.json',
  messages: 'messages.json',
  imageUploads: 'image_uploads.json'
};

const MONGO_COLLECTIONS = {
  users: 'users',
  authAccounts: 'auth_accounts',
  authSessions: 'auth_sessions',
  boards: 'boards',
  pins: 'pins',
  tags: 'tags',
  likes: 'likes',
  saves: 'saves',
  comments: 'comments',
  followers: 'followers',
  notifications: 'notifications',
  conversations: 'conversations',
  messages: 'messages',
  imageUploads: 'image_uploads'
};

const fs = require('fs');
const fsp = fs.promises;
let mongoClient = null;
let mongoDb = null;

app.use(express.json({ limit: '30mb' }));
app.use(
  cors({
    origin: true,
    credentials: true
  })
);
app.use(express.static(path.join(__dirname, '..')));

function dataPath(collection) {
  return path.join(DATA_DIR, COLLECTIONS[collection]);
}

async function getMongoDb() {
  if (storageMode !== 'mongodb') return null;
  if (!MONGODB_URI) throw new Error('Missing MONGODB_URI while STORAGE_MODE=mongodb');
  if (mongoDb) return mongoDb;

  mongoClient = new MongoClient(MONGODB_URI);
  await mongoClient.connect();
  mongoDb = mongoClient.db(MONGODB_DB);
  console.log(`Connected to MongoDB database "${MONGODB_DB}"`);
  return mongoDb;
}

function isObjectIdLike(value) {
  return value instanceof ObjectId || value?._bsontype === 'ObjectId';
}

function serializeFromMongo(value) {
  if (Array.isArray(value)) return value.map(serializeFromMongo);
  if (isObjectIdLike(value)) return { $oid: value.toString() };
  if (value && typeof value === 'object') {
    const out = {};
    Object.entries(value).forEach(([key, item]) => {
      out[key] = serializeFromMongo(item);
    });
    return out;
  }
  return value;
}

function isObjectIdHex(value) {
  return typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
}

function convertForMongo(value) {
  if (Array.isArray(value)) return value.map(convertForMongo);
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === '$oid' && isObjectIdHex(value.$oid)) {
      return new ObjectId(value.$oid);
    }

    const out = {};
    Object.entries(value).forEach(([key, item]) => {
      out[key] = convertForMongo(item);
    });
    return out;
  }
  return value;
}

async function readCollection(collection) {
  if (storageMode === 'mongodb') {
    const db = await getMongoDb();
    const rows = await db.collection(MONGO_COLLECTIONS[collection]).find({}).sort({ _id: 1 }).toArray();
    return serializeFromMongo(rows);
  }

  const raw = await fsp.readFile(dataPath(collection), 'utf8');
  return JSON.parse(raw);
}

async function writeCollection(collection, rows) {
  if (storageMode === 'mongodb') {
    const db = await getMongoDb();
    const mongoRows = rows.map(convertForMongo);
    const target = db.collection(MONGO_COLLECTIONS[collection]);
    await target.deleteMany({});
    if (mongoRows.length) await target.insertMany(mongoRows, { ordered: true });
    return;
  }

  await fsp.writeFile(dataPath(collection), JSON.stringify(rows, null, 2) + '\n', 'utf8');
}

function oid(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value.$oid) return String(value.$oid);
  if (value._id) return oid(value._id);
  return String(value);
}

function ref(id) {
  const normalized = oid(id);
  return normalized ? { $oid: normalized } : null;
}

function newId() {
  return crypto.randomBytes(12).toString('hex');
}

function nowIso() {
  return new Date().toISOString();
}

function toPublicRecord(row) {
  return {
    ...row,
    _id: oid(row._id),
    id: oid(row._id)
  };
}

function findById(rows, id) {
  const wanted = oid(id);
  if (!wanted) return null;
  const exact = rows.find((row) => oid(row._id) === wanted);
  if (exact) return exact;

  const asNumber = Number(wanted);
  if (Number.isInteger(asNumber) && asNumber > 0) {
    return rows[asNumber - 1] || null;
  }

  return null;
}

function sanitizeUser(user, counts = {}) {
  if (!user) return null;
  const id = oid(user._id);
  return {
    id,
    _id: id,
    username: user.username,
    email: user.email,
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    display_name: user.display_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username,
    phone: user.phone || '',
    birthdate: user.birthdate || '',
    avatar_url: user.avatar_url || 'https://i.pravatar.cc/150?img=1',
    cover_url: user.cover_url || 'https://picsum.photos/1200/360?random=101',
    bio: user.bio || '',
    website: user.website || '',
    location: user.location || '',
    followers_count: counts.followers_count ?? 0,
    following_count: counts.following_count ?? 0,
    boards_count: counts.boards_count ?? 0,
    pins_count: counts.pins_count ?? 0,
    is_active: user.is_active !== false,
    created_at: user.created_at || user.createdAt || null,
    updated_at: user.updated_at || user.updatedAt || null
  };
}

async function buildUser(user) {
  const [followers, boards, pins] = await Promise.all([
    readCollection('followers'),
    readCollection('boards'),
    readCollection('pins')
  ]);
  const userId = oid(user._id);
  return sanitizeUser(user, {
    followers_count: followers.filter((f) => oid(f.following_id) === userId).length,
    following_count: followers.filter((f) => oid(f.follower_id) === userId).length,
    boards_count: boards.filter((b) => oid(b.user_id) === userId).length,
    pins_count: pins.filter((p) => oid(p.user_id) === userId).length
  });
}

function verifyPassword(input, saved) {
  if (!saved || saved.algorithm !== 'scrypt') return false;
  const keyLength = saved.key_length || 64;
  const hash = crypto.scryptSync(input, saved.salt, keyLength);
  const expected = Buffer.from(saved.hash, 'hex');
  return hash.length === expected.length && crypto.timingSafeEqual(hash, expected);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const keyLength = 64;
  return {
    algorithm: 'scrypt',
    salt,
    hash: crypto.scryptSync(password, salt, keyLength).toString('hex'),
    key_length: keyLength
  };
}

function signToken(userId) {
  return jwt.sign({ user_id: oid(userId) }, JWT_SECRET, { expiresIn: '7d' });
}

function uniqueUsername(seed, users, accounts) {
  const usedUsernames = new Set([
    ...users.map((u) => String(u.username || '').toLowerCase()),
    ...accounts.map((a) => String(a.login_username || '').toLowerCase())
  ]);
  const base = String(seed || 'memorypic').toLowerCase().replace(/[^a-z0-9_.-]/g, '') || 'memorypic';
  let username = base;
  let suffix = 2;
  while (usedUsernames.has(username)) username = `${base}_${suffix++}`;
  return username;
}

function defaultBoardForUser(userId) {
  return {
    _id: ref(newId()),
    user_id: ref(userId),
    name: 'Mac dinh',
    description: 'Bang mac dinh',
    cover_image: null,
    is_private: false,
    created_at: nowIso(),
    updated_at: nowIso()
  };
}

function authSessionForUser(userId, req, token) {
  return {
    _id: ref(newId()),
    user_id: ref(userId),
    refresh_token_hash: crypto.createHash('sha256').update(token).digest('hex'),
    device_name: req.headers['user-agent'] || 'Browser',
    ip_address: req.ip,
    user_agent: req.headers['user-agent'] || '',
    created_at: nowIso(),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    revoked_at: null,
    is_active: true
  };
}

async function saveAuthSession(userId, req) {
  const token = signToken(userId);
  const session = authSessionForUser(userId, req, token);

  if (storageMode === 'mongodb') {
    const db = await getMongoDb();
    await db.collection(MONGO_COLLECTIONS.authSessions).insertOne(convertForMongo(session));
  } else {
    const sessions = await readCollection('authSessions');
    sessions.unshift(session);
    await writeCollection('authSessions', sessions);
  }

  return token;
}

async function verifyGoogleCredential(credential) {
  if (!GOOGLE_CLIENT_ID) {
    const err = new Error('Missing GOOGLE_CLIENT_ID');
    err.statusCode = 503;
    err.publicMessage = 'Chua cau hinh GOOGLE_CLIENT_ID tren server';
    throw err;
  }

  if (!credential) {
    const err = new Error('Missing Google credential');
    err.statusCode = 400;
    err.publicMessage = 'Thieu credential tu Google';
    throw err;
  }

  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(payload.error_description || payload.error || 'Invalid Google token');
    err.statusCode = 401;
    err.publicMessage = 'Phien dang nhap Google khong hop le';
    throw err;
  }

  if (payload.aud !== GOOGLE_CLIENT_ID) {
    const err = new Error('Google token audience mismatch');
    err.statusCode = 401;
    err.publicMessage = 'Google Client ID khong khop voi server';
    throw err;
  }

  if (payload.email_verified !== true && payload.email_verified !== 'true') {
    const err = new Error('Google email is not verified');
    err.statusCode = 401;
    err.publicMessage = 'Email Google chua duoc xac minh';
    throw err;
  }

  if (payload.exp && Number(payload.exp) * 1000 < Date.now()) {
    const err = new Error('Expired Google token');
    err.statusCode = 401;
    err.publicMessage = 'Phien dang nhap Google da het han';
    throw err;
  }

  return {
    sub: payload.sub,
    email: String(payload.email || '').trim().toLowerCase(),
    first_name: payload.given_name || '',
    last_name: payload.family_name || '',
    display_name: payload.name || '',
    avatar_url: payload.picture || ''
  };
}

async function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Missing token' });
  }

  try {
    const payload = jwt.verify(header.slice('Bearer '.length), JWT_SECRET);
    const users = await readCollection('users');
    const user = findById(users, payload.user_id);
    if (!user || user.is_active === false) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    req.userId = oid(user._id);
    req.currentUser = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return next();
  try {
    const payload = jwt.verify(header.slice('Bearer '.length), JWT_SECRET);
    req.userId = oid(payload.user_id);
  } catch (_err) {
    req.userId = null;
  }
  next();
}

async function buildPin(pin, viewerId = null) {
  const [users, boards, tags, likes, saves, comments] = await Promise.all([
    readCollection('users'),
    readCollection('boards'),
    readCollection('tags'),
    readCollection('likes'),
    readCollection('saves'),
    readCollection('comments')
  ]);

  const pinId = oid(pin._id);
  const user = findById(users, oid(pin.user_id));
  const board = findById(boards, oid(pin.board_id));
  const pinTags = tags.filter((tag) => oid(tag.pin_id) === pinId).map((tag) => tag.tag_text);
  const likeRows = likes.filter((like) => oid(like.pin_id) === pinId);
  const saveRows = saves.filter((save) => oid(save.pin_id) === pinId);
  const commentRows = comments.filter((comment) => oid(comment.pin_id) === pinId);

  return {
    ...toPublicRecord(pin),
    user_id: oid(pin.user_id),
    board_id: oid(pin.board_id),
    upload_id: oid(pin.upload_id),
    user: sanitizeUser(user),
    board: board ? { ...toPublicRecord(board), user_id: oid(board.user_id) } : null,
    tags: pinTags,
    likes_count: likeRows.length,
    saves_count: saveRows.length,
    comments_count: commentRows.length,
    isLiked: viewerId ? likeRows.some((like) => oid(like.user_id) === viewerId) : false,
    isSaved: viewerId ? saveRows.some((save) => oid(save.user_id) === viewerId) : false,
    created_at: pin.created_at || pin.createdAt || null,
    updated_at: pin.updated_at || pin.updatedAt || null
  };
}

async function createNotification({ userId, type, actorId, pinId }) {
  if (!userId || oid(userId) === oid(actorId)) return;
  const notifications = await readCollection('notifications');
  notifications.unshift({
    _id: ref(newId()),
    user_id: ref(userId),
    type,
    payload: {
      actor_id: oid(actorId),
      related_pin_id: pinId ? oid(pinId) : null
    },
    is_read: false,
    created_at: nowIso()
  });
  await writeCollection('notifications', notifications);
}

function buildNotificationText(notification, users, pins) {
  const payload = notification.payload || {};
  const actor = findById(users, payload.actor_id);
  const pin = findById(pins, payload.related_pin_id);
  const actorName = actor?.display_name || actor?.username || 'Nguoi dung';
  const pinTitle = pin?.title || 'pin';

  const templates = {
    like: `<strong>${actorName}</strong> da thich pin <strong>${pinTitle}</strong> cua ban`,
    follow: `<strong>${actorName}</strong> da bat dau theo doi ban`,
    comment: `<strong>${actorName}</strong> da binh luan ve pin <strong>${pinTitle}</strong>`,
    save: `<strong>${actorName}</strong> da luu pin <strong>${pinTitle}</strong>`,
    system: `<strong>MemoryPic</strong> co thong bao moi cho ban`
  };

  return {
    text: templates[notification.type] || templates.system,
    avatar_url: actor?.avatar_url || 'https://i.pravatar.cc/96?img=1',
    pin_image: pin?.image_url || null
  };
}

app.get(`${API_PREFIX}/health`, (_req, res) => {
  res.json({
    success: true,
    storage: storageMode,
    data_dir: DATA_DIR,
    mongodb_db: storageMode === 'mongodb' ? MONGODB_DB : null
  });
});

app.get(`${API_PREFIX}/auth/google/config`, (_req, res) => {
  res.json({
    success: true,
    enabled: !!GOOGLE_CLIENT_ID,
    clientId: GOOGLE_CLIENT_ID || null
  });
});

app.post(`${API_PREFIX}/auth/login`, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const login = String(email || '').trim().toLowerCase();
    if (!login || !password) {
      return res.status(400).json({ success: false, message: 'email and password are required' });
    }

    const [users, accounts, sessions] = await Promise.all([
      readCollection('users'),
      readCollection('authAccounts'),
      readCollection('authSessions')
    ]);

    const account = accounts.find((a) => {
      const isLocal = !a.provider || a.provider === 'local';
      return isLocal && (
        String(a.login_email || '').toLowerCase() === login ||
        String(a.login_username || '').toLowerCase() === login
      );
    });

    if (!account || !verifyPassword(password, account.password)) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác' });
    }

    const user = findById(users, account.user_id);
    if (!user || user.is_active === false) {
      return res.status(401).json({ success: false, message: 'Tài khoản không tồn tại hoặc đã bị khóa' });
    }

    account.last_login_at = nowIso();
    const token = signToken(user._id);
    sessions.unshift({
      _id: ref(newId()),
      user_id: ref(user._id),
      refresh_token_hash: crypto.createHash('sha256').update(token).digest('hex'),
      device_name: req.headers['user-agent'] || 'Browser',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'] || '',
      created_at: nowIso(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      revoked_at: null,
      is_active: true
    });

    await Promise.all([
      writeCollection('authAccounts', accounts),
      writeCollection('authSessions', sessions)
    ]);

    res.json({ success: true, message: 'Logged in', token, user: await buildUser(user) });
  } catch (err) {
    console.error('login error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post(`${API_PREFIX}/auth/google`, async (req, res) => {
  try {
    const profile = await verifyGoogleCredential(req.body?.credential || '');
    if (!profile.email) {
      return res.status(400).json({ success: false, message: 'Google khong tra ve email' });
    }

    const [users, accounts, boards] = await Promise.all([
      readCollection('users'),
      readCollection('authAccounts'),
      readCollection('boards')
    ]);

    const googleAccount = accounts.find((account) => {
      return account.provider === 'google' &&
        (String(account.provider_user_id || '') === profile.sub ||
          String(account.login_email || '').toLowerCase() === profile.email);
    });

    let user = googleAccount ? findById(users, googleAccount.user_id) : null;
    let accountToInsert = null;
    let userToInsert = null;
    let boardToInsert = null;
    const now = nowIso();

    if (!user) {
      user = users.find((row) => String(row.email || '').toLowerCase() === profile.email);
    }

    if (!user) {
      const userId = newId();
      const accountId = newId();
      const username = uniqueUsername(profile.email.split('@')[0], users, accounts);
      user = {
        _id: ref(userId),
        auth_account_id: ref(accountId),
        username,
        email: profile.email,
        first_name: profile.first_name,
        last_name: profile.last_name,
        display_name: profile.display_name || `${profile.first_name} ${profile.last_name}`.trim() || username,
        phone: '',
        birthdate: '',
        avatar_url: profile.avatar_url || `https://i.pravatar.cc/150?u=${encodeURIComponent(profile.email)}`,
        cover_url: 'https://picsum.photos/1200/360?random=200',
        bio: '',
        website: '',
        location: '',
        profile_visibility: 'public',
        is_active: true,
        email_verified: true,
        role: 'user',
        settings: {
          allow_messages: true,
          allow_downloads: true,
          show_email: false
        },
        created_at: now,
        updated_at: now
      };
      userToInsert = user;
      accountToInsert = {
        _id: ref(accountId),
        user_id: ref(userId),
        provider: 'google',
        provider_user_id: profile.sub,
        login_email: profile.email,
        login_username: username,
        password: null,
        is_email_verified: true,
        failed_login_count: 0,
        locked_until: null,
        last_login_at: now,
        password_updated_at: null,
        created_at: now
      };
      boardToInsert = defaultBoardForUser(userId);
    } else if (user.is_active === false) {
      return res.status(401).json({ success: false, message: 'Tai khoan da bi khoa' });
    } else if (!googleAccount) {
      accountToInsert = {
        _id: ref(newId()),
        user_id: ref(user._id),
        provider: 'google',
        provider_user_id: profile.sub,
        login_email: profile.email,
        login_username: user.username || uniqueUsername(profile.email.split('@')[0], users, accounts),
        password: null,
        is_email_verified: true,
        failed_login_count: 0,
        locked_until: null,
        last_login_at: now,
        password_updated_at: null,
        created_at: now
      };
    }

    if (storageMode === 'mongodb') {
      const db = await getMongoDb();
      const writes = [];
      if (userToInsert) writes.push(db.collection(MONGO_COLLECTIONS.users).insertOne(convertForMongo(userToInsert)));
      if (accountToInsert) writes.push(db.collection(MONGO_COLLECTIONS.authAccounts).insertOne(convertForMongo(accountToInsert)));
      if (boardToInsert) writes.push(db.collection(MONGO_COLLECTIONS.boards).insertOne(convertForMongo(boardToInsert)));
      if (googleAccount) {
        writes.push(db.collection(MONGO_COLLECTIONS.authAccounts).updateOne(
          { _id: convertForMongo(googleAccount._id) },
          { $set: { last_login_at: now, login_email: profile.email, provider_user_id: profile.sub } }
        ));
      }
      await Promise.all(writes);
    } else {
      if (userToInsert) users.push(userToInsert);
      if (accountToInsert) accounts.push(accountToInsert);
      if (boardToInsert) boards.push(boardToInsert);
      if (googleAccount) {
        googleAccount.last_login_at = now;
        googleAccount.login_email = profile.email;
      }
      await Promise.all([
        writeCollection('users', users),
        writeCollection('authAccounts', accounts),
        writeCollection('boards', boards)
      ]);
    }

    const token = await saveAuthSession(user._id, req);
    res.json({ success: true, message: 'Google login success', token, user: await buildUser(user) });
  } catch (err) {
    console.error('google auth error', err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.publicMessage || 'Khong the dang nhap bang Google luc nay'
    });
  }
});

app.post(`${API_PREFIX}/auth/signup`, async (req, res) => {
  try {
    const body = req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    let username = String(body.username || email.split('@')[0] || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email || !username || !password) {
      return res.status(400).json({ success: false, message: 'username, email and password are required' });
    }

    const [users, accounts, boards] = await Promise.all([
      readCollection('users'),
      readCollection('authAccounts'),
      readCollection('boards')
    ]);

    const emailExists = users.some((u) => String(u.email || '').toLowerCase() === email) ||
      accounts.some((a) => String(a.login_email || '').toLowerCase() === email);

    if (emailExists) {
      return res.status(409).json({ success: false, message: 'Email này đã được đăng ký' });
    }

    const usedUsernames = new Set([
      ...users.map((u) => String(u.username || '').toLowerCase()),
      ...accounts.map((a) => String(a.login_username || '').toLowerCase())
    ]);
    const usernameBase = username.replace(/[^a-z0-9_.-]/g, '') || 'memorypic';
    username = usernameBase;
    let usernameSuffix = 2;
    while (usedUsernames.has(username)) {
      username = `${usernameBase}_${usernameSuffix++}`;
    }

    const userId = newId();
    const accountId = newId();
    const user = {
      _id: ref(userId),
      auth_account_id: ref(accountId),
      username,
      email,
      first_name: body.first_name || '',
      last_name: body.last_name || '',
      display_name: `${body.first_name || ''} ${body.last_name || ''}`.trim() || username,
      phone: body.phone || '',
      birthdate: body.birthdate || '',
      avatar_url: `https://i.pravatar.cc/150?u=${encodeURIComponent(email)}`,
      cover_url: 'https://picsum.photos/1200/360?random=200',
      bio: '',
      website: '',
      location: '',
      profile_visibility: 'public',
      is_active: true,
      email_verified: false,
      role: 'user',
      settings: {
        allow_messages: true,
        allow_downloads: true,
        show_email: false
      },
      created_at: nowIso(),
      updated_at: nowIso()
    };

    const account = {
      _id: ref(accountId),
      user_id: ref(userId),
      provider: 'local',
      login_email: email,
      login_username: username,
      password: hashPassword(password),
      is_email_verified: false,
      failed_login_count: 0,
      locked_until: null,
      last_login_at: null,
      password_updated_at: nowIso(),
      created_at: nowIso()
    };

    const board = {
      _id: ref(newId()),
      user_id: ref(userId),
      name: 'Mac dinh',
      description: 'Bang mac dinh',
      cover_image: null,
      is_private: false,
      created_at: nowIso(),
      updated_at: nowIso()
    };

    if (storageMode === 'mongodb') {
      const db = await getMongoDb();
      await Promise.all([
        db.collection(MONGO_COLLECTIONS.users).insertOne(convertForMongo(user)),
        db.collection(MONGO_COLLECTIONS.authAccounts).insertOne(convertForMongo(account)),
        db.collection(MONGO_COLLECTIONS.boards).insertOne(convertForMongo(board))
      ]);
    } else {
      users.push(user);
      accounts.push(account);
      boards.push(board);

      await Promise.all([
        writeCollection('users', users),
        writeCollection('authAccounts', accounts),
        writeCollection('boards', boards)
      ]);
    }

    const token = signToken(userId);
    res.json({ success: true, message: 'Account created', token, user: await buildUser(user) });
  } catch (err) {
    console.error('signup error', err);
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email này đã được đăng ký' });
    }
    res.status(500).json({ success: false, message: 'Không thể tạo tài khoản lúc này' });
  }
});

app.get(`${API_PREFIX}/auth/me`, authRequired, async (req, res) => {
  res.json({ success: true, data: await buildUser(req.currentUser) });
});

app.get(`${API_PREFIX}/pins/search`, optionalAuth, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    if (!q) return res.json({ success: true, data: [] });

    const pins = await readCollection('pins');
    const tags = await readCollection('tags');
    const matched = pins.filter((pin) => {
      const pinId = oid(pin._id);
      const pinTags = tags.filter((tag) => oid(tag.pin_id) === pinId).map((tag) => tag.tag_text);
      return [pin.title, pin.description, ...pinTags]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });

    const data = await Promise.all(matched.slice(0, 50).map((pin) => buildPin(pin, req.userId)));
    res.json({ success: true, data });
  } catch (err) {
    console.error('search error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get(`${API_PREFIX}/pins`, optionalAuth, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const category = String(req.query.category || '').trim().toLowerCase();
    const tags = await readCollection('tags');
    let pins = await readCollection('pins');

    if (category) {
      const pinIds = new Set(tags.filter((tag) => String(tag.tag_text).toLowerCase() === category).map((tag) => oid(tag.pin_id)));
      pins = pins.filter((pin) => String(pin.category || '').toLowerCase() === category || pinIds.has(oid(pin._id)));
    }

    pins = pins.sort((a, b) => String(b.created_at || oid(b._id)).localeCompare(String(a.created_at || oid(a._id))));
    const total = pins.length;
    const pageRows = pins.slice((page - 1) * limit, page * limit);
    const data = await Promise.all(pageRows.map((pin) => buildPin(pin, req.userId)));

    res.json({ success: true, data, meta: { page, limit, total } });
  } catch (err) {
    console.error('get pins error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get(`${API_PREFIX}/pins/:id`, optionalAuth, async (req, res) => {
  try {
    const pins = await readCollection('pins');
    const pin = findById(pins, req.params.id);
    if (!pin) return res.status(404).json({ success: false, message: 'Pin not found' });
    res.json({ success: true, data: await buildPin(pin, req.userId) });
  } catch (err) {
    console.error('get pin error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post(`${API_PREFIX}/pins`, authRequired, async (req, res) => {
  try {
    const body = req.body || {};
    const title = String(body.title || '').trim();
    const imageUrl = String(body.image_url || '').trim();
    const allowedCategories = new Set(['interior', 'nature', 'food', 'travel', 'fashion', 'pets', 'art', 'fitness']);
    const category = String(body.category || '').trim().toLowerCase();
    if (!title || !imageUrl || !allowedCategories.has(category)) {
      return res.status(400).json({ success: false, message: 'title, image_url and a valid category are required' });
    }

    const [pins, tags, uploads] = await Promise.all([
      readCollection('pins'),
      readCollection('tags'),
      readCollection('imageUploads')
    ]);

    const pinId = newId();
    const uploadId = newId();
    const pin = {
      _id: ref(pinId),
      user_id: ref(req.userId),
      board_id: body.board_id ? ref(body.board_id) : null,
      upload_id: ref(uploadId),
      title,
      description: body.description || '',
      category,
      image_url: imageUrl,
      image_height: Number(body.image_height) || 520,
      link_url: body.link_url || null,
      source_credit: body.source_credit || null,
      allow_comments: body.allow_comments !== false,
      allow_downloads: body.allow_downloads !== false,
      is_hidden: !!body.is_hidden,
      created_at: nowIso(),
      updated_at: nowIso()
    };

    uploads.unshift({
      _id: ref(uploadId),
      user_id: ref(req.userId),
      original_filename: body.original_filename || 'browser-upload',
      storage_path: imageUrl.startsWith('data:') ? null : imageUrl,
      public_url: imageUrl,
      thumbnail_url: imageUrl,
      width: body.image_width || null,
      height: pin.image_height,
      mime_type: imageUrl.startsWith('data:image/') ? imageUrl.slice(5, imageUrl.indexOf(';')) : null,
      checksum: crypto.createHash('sha256').update(imageUrl).digest('hex'),
      created_at: nowIso()
    });

    pins.unshift(pin);
    [...new Set([category, ...(Array.isArray(body.tags) ? body.tags : [])])]
      .map((tag) => String(tag).trim().toLowerCase())
      .filter(Boolean)
      .forEach((tag) => {
        tags.push({
          _id: ref(newId()),
          pin_id: ref(pinId),
          tag_text: tag,
          created_at: nowIso()
        });
      });

    await Promise.all([
      writeCollection('pins', pins),
      writeCollection('tags', tags),
      writeCollection('imageUploads', uploads)
    ]);

    res.status(201).json({ success: true, message: 'Pin created', data: await buildPin(pin, req.userId) });
  } catch (err) {
    console.error('create pin error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put(`${API_PREFIX}/pins/:id`, authRequired, async (req, res) => {
  try {
    const pins = await readCollection('pins');
    const pin = findById(pins, req.params.id);
    if (!pin || oid(pin.user_id) !== req.userId) {
      return res.status(404).json({ success: false, message: 'Pin not found' });
    }

    ['title', 'description', 'image_url', 'image_height', 'link_url', 'source_credit', 'allow_comments'].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) pin[key] = req.body[key];
    });
    pin.updated_at = nowIso();
    await writeCollection('pins', pins);
    res.json({ success: true, message: 'Pin updated', data: await buildPin(pin, req.userId) });
  } catch (err) {
    console.error('update pin error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.delete(`${API_PREFIX}/pins/:id`, authRequired, async (req, res) => {
  try {
    const pins = await readCollection('pins');
    const pin = findById(pins, req.params.id);
    if (!pin || oid(pin.user_id) !== req.userId) {
      return res.status(404).json({ success: false, message: 'Pin not found' });
    }

    const pinId = oid(pin._id);
    await Promise.all([
      writeCollection('pins', pins.filter((row) => oid(row._id) !== pinId)),
      writeCollection('tags', (await readCollection('tags')).filter((row) => oid(row.pin_id) !== pinId)),
      writeCollection('likes', (await readCollection('likes')).filter((row) => oid(row.pin_id) !== pinId)),
      writeCollection('saves', (await readCollection('saves')).filter((row) => oid(row.pin_id) !== pinId)),
      writeCollection('comments', (await readCollection('comments')).filter((row) => oid(row.pin_id) !== pinId))
    ]);

    res.json({ success: true, message: 'Pin deleted' });
  } catch (err) {
    console.error('delete pin error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post(`${API_PREFIX}/pins/:id/like`, authRequired, async (req, res) => {
  try {
    const [pins, likes] = await Promise.all([readCollection('pins'), readCollection('likes')]);
    const pin = findById(pins, req.params.id);
    if (!pin) return res.status(404).json({ success: false, message: 'Pin not found' });

    const pinId = oid(pin._id);
    const exists = likes.some((like) => oid(like.pin_id) === pinId && oid(like.user_id) === req.userId);
    if (!exists) {
      likes.push({ _id: ref(newId()), user_id: ref(req.userId), pin_id: ref(pinId), created_at: nowIso() });
      await writeCollection('likes', likes);
      await createNotification({ userId: pin.user_id, type: 'like', actorId: req.userId, pinId });
    }

    res.json({ success: true, liked: true, likes_count: likes.filter((like) => oid(like.pin_id) === pinId).length });
  } catch (err) {
    console.error('like error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post(`${API_PREFIX}/pins/:id/save`, authRequired, async (req, res) => {
  try {
    const [pins, saves] = await Promise.all([readCollection('pins'), readCollection('saves')]);
    const pin = findById(pins, req.params.id);
    if (!pin) return res.status(404).json({ success: false, message: 'Pin not found' });

    const pinId = oid(pin._id);
    const boardId = req.body?.boardId || req.body?.board_id || null;
    const existing = saves.find((save) => oid(save.pin_id) === pinId && oid(save.user_id) === req.userId);
    if (existing) {
      existing.board_id = boardId ? ref(boardId) : existing.board_id || null;
      existing.updated_at = nowIso();
    } else {
      saves.push({
        _id: ref(newId()),
        user_id: ref(req.userId),
        pin_id: ref(pinId),
        board_id: boardId ? ref(boardId) : null,
        created_at: nowIso()
      });
      await createNotification({ userId: pin.user_id, type: 'save', actorId: req.userId, pinId });
    }

    await writeCollection('saves', saves);
    res.json({ success: true, saved: true, saves_count: saves.filter((save) => oid(save.pin_id) === pinId).length });
  } catch (err) {
    console.error('save error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get(`${API_PREFIX}/pins/:id/comments`, async (req, res) => {
  try {
    const [comments, users] = await Promise.all([readCollection('comments'), readCollection('users')]);
    const pinId = oid(req.params.id);
    const data = comments
      .filter((comment) => oid(comment.pin_id) === pinId)
      .map((comment) => {
        const user = findById(users, comment.user_id);
        return {
          ...toPublicRecord(comment),
          pin_id: oid(comment.pin_id),
          user_id: oid(comment.user_id),
          user: sanitizeUser(user),
          text: comment.comment_text,
          comment_text: comment.comment_text,
          created_at: comment.created_at || null
        };
      })
      .reverse();

    res.json({ success: true, data });
  } catch (err) {
    console.error('get comments error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post(`${API_PREFIX}/pins/:id/comments`, authRequired, async (req, res) => {
  try {
    const text = String(req.body?.text || req.body?.comment_text || '').trim();
    if (!text) return res.status(400).json({ success: false, message: 'text is required' });

    const [pins, comments] = await Promise.all([readCollection('pins'), readCollection('comments')]);
    const pin = findById(pins, req.params.id);
    if (!pin) return res.status(404).json({ success: false, message: 'Pin not found' });

    const comment = {
      _id: ref(newId()),
      pin_id: ref(pin._id),
      user_id: ref(req.userId),
      comment_text: text,
      created_at: nowIso()
    };
    comments.push(comment);
    await writeCollection('comments', comments);
    await createNotification({ userId: pin.user_id, type: 'comment', actorId: req.userId, pinId: pin._id });

    res.status(201).json({
      success: true,
      data: {
        ...toPublicRecord(comment),
        pin_id: oid(comment.pin_id),
        user_id: req.userId,
        user: sanitizeUser(req.currentUser),
        text,
        comment_text: text,
        created_at: comment.created_at
      }
    });
  } catch (err) {
    console.error('add comment error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get(`${API_PREFIX}/boards`, optionalAuth, async (req, res) => {
  try {
    const userId = req.query.user_id || req.userId || null;
    const [boards, pins] = await Promise.all([readCollection('boards'), readCollection('pins')]);
    const rows = userId ? boards.filter((board) => oid(board.user_id) === oid(userId)) : boards;
    const data = rows.map((board) => {
      const boardId = oid(board._id);
      const boardPins = pins.filter((pin) => oid(pin.board_id) === boardId);
      return {
        ...toPublicRecord(board),
        user_id: oid(board.user_id),
        pins_count: boardPins.length,
        cover_image: board.cover_image || boardPins[0]?.image_url || null
      };
    });
    res.json({ success: true, data });
  } catch (err) {
    console.error('get boards error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post(`${API_PREFIX}/boards`, authRequired, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'name is required' });

    const boards = await readCollection('boards');
    const board = {
      _id: ref(newId()),
      user_id: ref(req.userId),
      name,
      description: req.body?.description || '',
      cover_image: req.body?.cover_image || null,
      is_private: !!req.body?.is_private,
      created_at: nowIso(),
      updated_at: nowIso()
    };
    boards.push(board);
    await writeCollection('boards', boards);
    res.status(201).json({ success: true, message: 'Board created', data: { ...toPublicRecord(board), user_id: req.userId } });
  } catch (err) {
    console.error('create board error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get(`${API_PREFIX}/messages/conversations`, authRequired, async (req, res) => {
  try {
    const [conversations, messages, users] = await Promise.all([
      readCollection('conversations'),
      readCollection('messages'),
      readCollection('users')
    ]);

    const rows = conversations
      .filter((conv) => oid(conv.user1_id) === req.userId || oid(conv.user2_id) === req.userId)
      .map((conv) => {
        const id = oid(conv._id);
        const otherId = oid(conv.user1_id) === req.userId ? oid(conv.user2_id) : oid(conv.user1_id);
        const other = findById(users, otherId);
        const convMessages = messages.filter((msg) => oid(msg.conversation_id) === id);
        const last = convMessages[convMessages.length - 1];
        return {
          id,
          _id: id,
          user_id: otherId,
          name: other?.display_name || other?.username || 'User',
          avatar_url: other?.avatar_url || 'https://i.pravatar.cc/96?img=1',
          online: false,
          last_message: last?.message_text || '',
          last_message_at: last?.created_at || '',
          unread: 0
        };
      })
      .sort((a, b) => String(b.last_message_at || '').localeCompare(String(a.last_message_at || '')));

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('conversations error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post(`${API_PREFIX}/messages/conversations`, authRequired, async (req, res) => {
  try {
    const targetUserId = oid(req.body?.user_id || req.body?.recipient_id);
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'user_id is required' });
    }
    if (targetUserId === req.userId) {
      return res.status(400).json({ success: false, message: 'Cannot message yourself' });
    }

    const [users, conversations] = await Promise.all([
      readCollection('users'),
      readCollection('conversations')
    ]);
    const target = findById(users, targetUserId);
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });

    let conversation = conversations.find((conv) => {
      const user1 = oid(conv.user1_id);
      const user2 = oid(conv.user2_id);
      return (user1 === req.userId && user2 === targetUserId) || (user1 === targetUserId && user2 === req.userId);
    });

    if (!conversation) {
      conversation = {
        _id: ref(newId()),
        user1_id: ref(req.userId),
        user2_id: ref(targetUserId),
        created_at: nowIso(),
        updated_at: nowIso()
      };
      conversations.push(conversation);
      await writeCollection('conversations', conversations);
    }

    res.status(201).json({
      success: true,
      data: {
        id: oid(conversation._id),
        _id: oid(conversation._id),
        user_id: targetUserId,
        name: target.display_name || target.username,
        avatar_url: target.avatar_url || 'https://i.pravatar.cc/96?img=1',
        online: false,
        last_message: '',
        last_message_at: conversation.updated_at || conversation.created_at || '',
        unread: 0
      }
    });
  } catch (err) {
    console.error('create conversation error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get(`${API_PREFIX}/messages/conversations/:id`, authRequired, async (req, res) => {
  try {
    const messages = await readCollection('messages');
    const data = messages
      .filter((msg) => oid(msg.conversation_id) === oid(req.params.id))
      .map((msg) => ({
        ...toPublicRecord(msg),
        conversation_id: oid(msg.conversation_id),
        sender_id: oid(msg.sender_id),
        recipient_id: oid(msg.recipient_id),
        text: msg.message_text,
        message_text: msg.message_text,
        mine: oid(msg.sender_id) === req.userId,
        created_at: msg.created_at || ''
      }));

    res.json({ success: true, data });
  } catch (err) {
    console.error('messages error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post(`${API_PREFIX}/messages`, authRequired, async (req, res) => {
  try {
    const conversationId = req.body?.conversationId || req.body?.conversation_id;
    const text = String(req.body?.text || req.body?.message_text || '').trim();
    if (!conversationId || !text) {
      return res.status(400).json({ success: false, message: 'conversationId and text are required' });
    }

    const [conversations, messages] = await Promise.all([
      readCollection('conversations'),
      readCollection('messages')
    ]);
    const conv = findById(conversations, conversationId);
    if (!conv) return res.status(404).json({ success: false, message: 'Conversation not found' });

    const recipientId = oid(conv.user1_id) === req.userId ? oid(conv.user2_id) : oid(conv.user1_id);
    const message = {
      _id: ref(newId()),
      sender_id: ref(req.userId),
      recipient_id: ref(recipientId),
      conversation_id: ref(conv._id),
      message_text: text,
      message_type: req.body?.message_type || 'text',
      created_at: nowIso()
    };
    messages.push(message);
    conv.updated_at = message.created_at;
    await writeCollection('messages', messages);
    await writeCollection('conversations', conversations);
    res.status(201).json({ success: true, message: 'Message sent', data: { ...toPublicRecord(message), text, mine: true } });
  } catch (err) {
    console.error('send message error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get(`${API_PREFIX}/notifications`, authRequired, async (req, res) => {
  try {
    const [notifications, users, pins] = await Promise.all([
      readCollection('notifications'),
      readCollection('users'),
      readCollection('pins')
    ]);

    const data = notifications
      .filter((notification) => oid(notification.user_id) === req.userId)
      .map((notification) => {
        const view = buildNotificationText(notification, users, pins);
        return {
          ...toPublicRecord(notification),
          user_id: req.userId,
          type: notification.type || 'system',
          payload: notification.payload || {},
          is_read: !!notification.is_read,
          unread: !notification.is_read,
          created_at: notification.created_at || '',
          ...view
        };
      });

    res.json({ success: true, data });
  } catch (err) {
    console.error('notifications error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put(`${API_PREFIX}/notifications/read-all`, authRequired, async (req, res) => {
  try {
    const notifications = await readCollection('notifications');
    let updated = 0;
    notifications.forEach((notification) => {
      if (oid(notification.user_id) === req.userId && !notification.is_read) {
        notification.is_read = true;
        notification.read_at = nowIso();
        updated += 1;
      }
    });
    await writeCollection('notifications', notifications);
    res.json({ success: true, updated });
  } catch (err) {
    console.error('notification read-all error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put(`${API_PREFIX}/notifications/:id/read`, authRequired, async (req, res) => {
  try {
    const notifications = await readCollection('notifications');
    const notification = findById(notifications, req.params.id);
    if (!notification || oid(notification.user_id) !== req.userId) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    notification.is_read = true;
    notification.read_at = nowIso();
    await writeCollection('notifications', notifications);
    res.json({ success: true });
  } catch (err) {
    console.error('notification read error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get(`${API_PREFIX}/users`, authRequired, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    const users = await readCollection('users');
    const data = await Promise.all(
      users
        .filter((user) => oid(user._id) !== req.userId)
        .filter((user) => {
          if (!q) return true;
          return [user.username, user.display_name, user.email, user.first_name, user.last_name]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(q));
        })
        .slice(0, 30)
        .map((user) => buildUser(user))
    );
    res.json({ success: true, data });
  } catch (err) {
    console.error('list users error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get(`${API_PREFIX}/users/:id`, optionalAuth, async (req, res) => {
  try {
    const users = await readCollection('users');
    const user = findById(users, req.params.id) ||
      users.find((u) => String(u.username).toLowerCase() === String(req.params.id).toLowerCase());
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: await buildUser(user) });
  } catch (err) {
    console.error('get user error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get(`${API_PREFIX}/users/:id/pins`, optionalAuth, async (req, res) => {
  try {
    const [users, pins] = await Promise.all([readCollection('users'), readCollection('pins')]);
    const user = findById(users, req.params.id) ||
      users.find((u) => String(u.username).toLowerCase() === String(req.params.id).toLowerCase());
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const data = await Promise.all(
      pins
        .filter((pin) => oid(pin.user_id) === oid(user._id))
        .map((pin) => buildPin(pin, req.userId))
    );
    res.json({ success: true, data });
  } catch (err) {
    console.error('user pins error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get(`${API_PREFIX}/users/:id/saved`, optionalAuth, async (req, res) => {
  try {
    const [users, saves, pins] = await Promise.all([
      readCollection('users'),
      readCollection('saves'),
      readCollection('pins')
    ]);
    const user = findById(users, req.params.id) ||
      users.find((u) => String(u.username).toLowerCase() === String(req.params.id).toLowerCase());
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const savedPinIds = new Set(saves.filter((save) => oid(save.user_id) === oid(user._id)).map((save) => oid(save.pin_id)));
    const data = await Promise.all(pins.filter((pin) => savedPinIds.has(oid(pin._id))).map((pin) => buildPin(pin, req.userId)));
    res.json({ success: true, data });
  } catch (err) {
    console.error('user saved pins error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get(`${API_PREFIX}/users/:id/liked`, optionalAuth, async (req, res) => {
  try {
    const [users, likes, pins] = await Promise.all([
      readCollection('users'),
      readCollection('likes'),
      readCollection('pins')
    ]);
    const user = findById(users, req.params.id) ||
      users.find((u) => String(u.username).toLowerCase() === String(req.params.id).toLowerCase());
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const likedPinIds = new Set(likes.filter((like) => oid(like.user_id) === oid(user._id)).map((like) => oid(like.pin_id)));
    const data = await Promise.all(pins.filter((pin) => likedPinIds.has(oid(pin._id))).map((pin) => buildPin(pin, req.userId)));
    res.json({ success: true, data });
  } catch (err) {
    console.error('user liked pins error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post(`${API_PREFIX}/users/:id/follow`, authRequired, async (req, res) => {
  try {
    const users = await readCollection('users');
    const target = findById(users, req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });
    if (oid(target._id) === req.userId) return res.status(400).json({ success: false, message: 'Cannot follow yourself' });

    const followers = await readCollection('followers');
    const exists = followers.some((row) => oid(row.follower_id) === req.userId && oid(row.following_id) === oid(target._id));
    if (!exists) {
      followers.push({
        _id: ref(newId()),
        follower_id: ref(req.userId),
        following_id: ref(target._id),
        created_at: nowIso()
      });
      await writeCollection('followers', followers);
      await createNotification({ userId: target._id, type: 'follow', actorId: req.userId });
    }

    res.json({ success: true, following: true });
  } catch (err) {
    console.error('follow error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put(`${API_PREFIX}/users/profile`, authRequired, async (req, res) => {
  try {
    const users = await readCollection('users');
    const user = findById(users, req.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    ['first_name', 'last_name', 'phone', 'birthdate', 'avatar_url', 'cover_url', 'bio', 'website', 'location'].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) user[key] = req.body[key] || '';
    });
    user.display_name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
    user.updated_at = nowIso();

    await writeCollection('users', users);
    res.json({ success: true, data: await buildUser(user) });
  } catch (err) {
    console.error('profile update error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Server error' });
});

app.listen(PORT, () => {
  console.log(`MemoryPic API listening on port ${PORT}${API_PREFIX}`);
});
