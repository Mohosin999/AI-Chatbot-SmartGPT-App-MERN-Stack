# Redis for Refresh Token — Implementation Guide

## Context

This project already has Redis running (Docker, client, connection). But refresh tokens are currently stored in MongoDB (`User.refreshToken` + `refreshTokenExpiresAt`). This guide moves all refresh token storage to Redis — faster lookups, automatic TTL-based expiry, and no MongoDB schema bloat.

---

## Current Architecture (MongoDB-based)

### Data flow

```
[Client] → POST /auth/login
              → lib/auth/login()
                  → generateRefreshToken() → { refreshToken: uuid, expiresAt: Date }
                  → User.findByIdAndUpdate(user.id, { refreshToken, refreshTokenExpiresAt })
              → returns { accessToken, refreshToken }

[Client] → POST /auth/refresh (body: { refresh_token })
              → authenticateRefresh middleware
                  → findUserByRefreshToken(refresh_token)
                      → User.findOne({ refreshToken })          ← MongoDB query
                  → checks user.refreshTokenExpiresAt > now
                  → if expired: clears tokens, returns logout
              → refreshToken controller
                  → generateRefreshToken()
                  → User.findByIdAndUpdate(user.id, { refreshToken, refreshTokenExpiresAt })
                  → returns new tokens

[Client] → POST /auth/logout
              → logout controller
                  → User.findByIdAndUpdate(userId, { refreshToken: null, refreshTokenExpiresAt: null })
```

### Files involved

| File | Role |
|------|------|
| `src/models/User.ts` | Schema with `refreshToken`, `refreshTokenExpiresAt` fields |
| `src/lib/token/index.ts` | `generateRefreshToken()` — creates UUID, date |
| `src/lib/auth/index.ts` | `login()`, `googleLogin()` — generate + save to MongoDB |
| `src/api/v1/auth/controllers/register.ts` | Register — generate + save to MongoDB |
| `src/api/v1/auth/controllers/refreshToken.ts` | Refresh — generate + save to MongoDB |
| `src/middlewares/authenticateRefresh.ts` | Lookup + expiry check via MongoDB |
| `src/api/v1/auth/controllers/logout.ts` | Clear refresh token from MongoDB |
| `src/lib/user/index.ts` | `findUserByRefreshToken()` — `User.findOne({ refreshToken })` |

### Problems

1. **Slow lookups** — `User.findOne({ refreshToken })` on every refresh → MongoDB collection scan (even with index, ~10-50ms vs Redis ~0.5ms)
2. **TTL management** — Manual expiry check; stale tokens sit in DB until cleaned
3. **Schema bloat** — Auth tokens don't belong in the User document (frequent writes to a rarely-changed collection)
4. **No multi-device support** — Single `refreshToken` field per user; second login overwrites first

---

## Updated Architecture (Redis-based)

### Principle

Store `refresh_token:{uuid} → userId` in Redis with EX (expire) matching the token lifetime. No MongoDB writes for tokens at all.

```
key:   refresh_token:{uuid}
value: userId (string)
TTL:   7 days (604800 seconds)
```

### Data flow after changes

```
[Client] → POST /auth/login
              → lib/auth/login()
                  → generateRefreshToken()
                      → Redis SETEX refresh_token:{uuid} 604800 userId
                  → returns { accessToken, refreshToken }

[Client] → POST /auth/refresh (body: { refresh_token })
              → authenticateRefresh middleware
                  → Redis GET refresh_token:{uuid}          ← Redis lookup
                  → if null → expired/invalid → logout
                  → User.findById(userId)                    ← one-time lookup
              → refreshToken controller
                  → generateRefreshToken()
                      → Redis SETEX refresh_token:{uuid} 604800 userId
                  → Redis DEL refresh_token:{oldUuid}       ← old token
                  → returns new tokens

[Client] → POST /auth/logout
              → logout controller
                  → Redis DEL refresh_token:{uuid}
```

### Files that change

| File | Change |
|------|--------|
| `src/lib/token/index.ts` | `generateRefreshToken()` now writes to Redis + returns same shape |
| `src/lib/user/index.ts` | Remove `findUserByRefreshToken()` — no longer needed |
| `src/middlewares/authenticateRefresh.ts` | Replace `findUserByRefreshToken` with Redis GET |
| `src/api/v1/auth/controllers/logout.ts` | Replace MongoDB update with Redis DEL |
| `src/api/v1/auth/controllers/register.ts` | Replace MongoDB update with Redis (or keep as-is, delegate to token lib) |
| `src/lib/auth/index.ts` | `login()`, `googleLogin()` — no longer save to MongoDB, token lib handles it |
| `src/api/v1/auth/controllers/refreshToken.ts` | Add old token DEL, no MongoDB save |
| `src/models/User.ts` | Remove `refreshToken`, `refreshTokenExpiresAt` fields (optional but recommended) |

---

## Step-by-Step Code Changes

### Step 1: `src/lib/token/index.ts` — `generateRefreshToken()` persists to Redis

```typescript
// BEFORE
const generateRefreshToken = (): {
  refreshToken: string;
  expiresAt: Date;
} => {
  const refreshToken = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return { refreshToken, expiresAt };
};
```

```typescript
// AFTER
import { getRedisClient } from "../../redis";

const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

const generateRefreshToken = async (userId: string): Promise<{
  refreshToken: string;
  expiresAt: Date;
}> => {
  const refreshToken = uuidv4();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

  const redis = getRedisClient();
  await redis.set(
    `refresh_token:${refreshToken}`,
    userId,
    "EX",
    REFRESH_TOKEN_TTL_SECONDS,
  );

  return { refreshToken, expiresAt };
};
```

Key decisions:
- Accept `userId` as parameter — the token binds to a user
- `SETEX` (via `SET ... EX`) ensures automatic expiry — no manual cleanup
- Return shape unchanged — controllers don't need refactoring

---

### Step 2: `src/lib/user/index.ts` — remove `findUserByRefreshToken()`

```typescript
// BEFORE
const findUserByRefreshToken = async (refreshToken: string) => {
  const user = await User.findOne({ refreshToken });
  return user ?? null;
};

export { findUserByRefreshToken, findUserByEmail, userExist, createUser };
```

```typescript
// AFTER — delete the function entirely
export { findUserByEmail, userExist, createUser };
```

This function becomes dead code. The lookup is now in `authenticateRefresh.ts` directly against Redis.

---

### Step 3: `src/middlewares/authenticateRefresh.ts` — Redis lookup instead of MongoDB

```typescript
// BEFORE
import User from "../models/User";
import * as userService from "../lib/user";

const { refresh_token } = req.body;
if (!refresh_token) { /* logout response */ return; }

const user = await userService.findUserByRefreshToken(refresh_token);
if (!user) { /* logout response */ return; }

if (
  "refreshTokenExpiresAt" in user &&
  user.refreshTokenExpiresAt &&
  new Date(user.refreshTokenExpiresAt) < new Date()
) {
  await User.findByIdAndUpdate(user.id, {
    refreshToken: null,
    refreshTokenExpiresAt: null,
  });
  /* logout response */ return;
}

req.user = { id: user.id, name: user.name, email: user.email };
next();
```

```typescript
// AFTER
import User from "../models/User";
import { getRedisClient } from "../redis";

const { refresh_token } = req.body;
if (!refresh_token) { /* logout response */ return; }

const redis = getRedisClient();
const userId = await redis.get(`refresh_token:${refresh_token}`);

if (!userId) {
  // Token missing or expired (Redis auto-deleted it via TTL)
  res.status(200).json({ message: "Session expired. Logging out...", logout: true });
  return;
}

const user = await User.findById(userId);
if (!user) {
  // User deleted but token lingered (edge case)
  await redis.del(`refresh_token:${refresh_token}`);
  /* logout response */ return;
}

req.user = { id: user.id, name: user.name, email: user.email };
next();
```

Key changes:
- `User.findOne({ refreshToken })` → `Redis GET refresh_token:{uuid}` — O(1), ~0.5ms
- Expiry is handled by Redis TTL — no manual `refreshTokenExpiresAt` check
- Edge case: user deleted → we clean up the orphaned token

---

### Step 4: `src/api/v1/auth/controllers/logout.ts` — Redis DEL instead of MongoDB null

```typescript
// BEFORE
await User.findByIdAndUpdate(userId, {
  refreshToken: null,
  refreshTokenExpiresAt: null,
});
```

```typescript
// AFTER
import { getRedisClient } from "../../../../redis";

// We need the actual token value to delete from Redis.
// Best approach: client sends it in the body, OR we scan for user's tokens.
// Option A (recommended): accept refresh_token in logout body
const { refresh_token } = req.body;
if (refresh_token) {
  const redis = getRedisClient();
  await redis.del(`refresh_token:${refresh_token}`);
}
```

**Important design consideration:** The logout controller doesn't have the refresh token value (only the JWT from `Authorization` header). Two solutions:

| Solution | Pros | Cons |
|----------|------|------|
| **A:** Client sends `refresh_token` in logout body | Simple, targeted delete | Client must store it |
| **B:** Maintain a Redis Set `user:{userId}:refresh_tokens` | No client cooperation needed | More Redis calls |

For this guide, **Solution A** is cleaner. Update the logout route to accept `refresh_token` in the body.

---

### Step 5: `src/lib/auth/index.ts` — `login()` and `googleLogin()` remove MongoDB save

```typescript
// BEFORE — inside login()
const { refreshToken, expiresAt } = generateRefreshToken();
await User.findByIdAndUpdate(user.id, {
  refreshToken,
  refreshTokenExpiresAt: expiresAt,
});
return { accessToken, refreshToken };
```

```typescript
// AFTER
const { refreshToken, expiresAt } = await generateRefreshToken(user.id);
return { accessToken, refreshToken };
```

Same change applies to `googleLogin()`. The `generateRefreshToken()` function now handles the Redis write internally. Also note: `generateRefreshToken` is now `async` and needs `await`.

---

### Step 6: `src/api/v1/auth/controllers/register.ts` — same pattern

```typescript
// BEFORE
const { refreshToken, expiresAt } = generateRefreshToken();
await User.findByIdAndUpdate(user.id, {
  refreshToken,
  refreshTokenExpiresAt: expiresAt,
});
```

```typescript
// AFTER
const { refreshToken, expiresAt } = await generateRefreshToken(user.id);
```

Import note: `generateRefreshToken` is now async, so the import must match. Also this controller imports `generateRefreshToken` directly from `lib/token` — ensure the updated function signature is used.

---

### Step 7: `src/api/v1/auth/controllers/refreshToken.ts` — delete old token, save new

```typescript
// BEFORE
const { refreshToken, expiresAt } = tokenService.generateRefreshToken();
await User.findByIdAndUpdate(req.user!.id, {
  refreshToken,
  refreshTokenExpiresAt: expiresAt,
});
```

```typescript
// AFTER
const { refresh_token: oldToken } = req.body;
const { refreshToken, expiresAt } = await tokenService.generateRefreshToken(req.user!.id);

// Delete old token from Redis
if (oldToken) {
  const redis = getRedisClient();
  await redis.del(`refresh_token:${oldToken}`);
}
```

**Important:** This controller needs access to `getRedisClient`. Either import it directly, or create a `revokeRefreshToken()` helper in `lib/token`.

---

### Step 8 (Optional): `src/models/User.ts` — remove refresh token fields

```typescript
// BEFORE
refreshToken?: string | null;
refreshTokenExpiresAt?: Date | null;
// ...
refreshToken: { type: String, default: null },
refreshTokenExpiresAt: { type: Date, default: null },
```

```typescript
// AFTER — delete both lines above
```

This is optional but recommended. The User model no longer needs auth-token fields, keeping it focused on business data (name, email, password, customInstructions).

---

## Complete File-by-File Diff Summary

### `src/lib/token/index.ts`
```typescript
// Change signature: () → async (userId: string)
// Add: import { getRedisClient } from "../../redis"
// Add: Redis SETEX inside function
```

### `src/lib/user/index.ts`
```typescript
// Delete: findUserByRefreshToken function
// Update: export list
```

### `src/middlewares/authenticateRefresh.ts`
```typescript
// Replace: import userService → import getRedisClient + User
// Replace: findUserByRefreshToken(token) → redis.get(`refresh_token:${token}`)
// Remove: refreshTokenExpiresAt check (Redis TTL handles it)
// Remove: User.findByIdAndUpdate for expired token
// Add: edge case — user deleted, clean up token
```

### `src/api/v1/auth/controllers/logout.ts`
```typescript
// Add: import { getRedisClient }
// Add: read refresh_token from req.body
// Replace: User.findByIdAndUpdate(null) → redis.del(`refresh_token:${token}`)
```

### `src/lib/auth/index.ts`
```typescript
// login(): add await, pass userId to generateRefreshToken
// googleLogin(): same change
// Remove: User.findByIdAndUpdate({ refreshToken, refreshTokenExpiresAt })
```

### `src/api/v1/auth/controllers/register.ts`
```typescript
// Add await to generateRefreshToken
// Pass userId
// Remove: User.findByIdAndUpdate({ refreshToken })
```

### `src/api/v1/auth/controllers/refreshToken.ts`
```typescript
// Add: import { getRedisClient }
// Add: read old refresh_token from body
// Add await to generateRefreshToken with userId
// Add: redis.del(oldToken)
// Remove: User.findByIdAndUpdate({ refreshToken })
```

### `src/api/v1/auth/controllers/index.ts` (if imports change)
Adjust any re-exports if function signatures change.

---

## Redis Key Schema

```
refresh_token:{uuid} → userId
TTL: 604800 (7 days)
```

**Naming convention:** `{entity}:{identifier}` — matches existing Redis patterns.

---

## Migration Strategy

Since tokens in MongoDB have their own expiry date, you can:

1. **Deploy the code** — new tokens are written to Redis
2. **Keep old MongoDB tokens valid** — modify `authenticateRefresh` to fall back to MongoDB if Redis returns null
3. **After 7 days** — all old tokens have expired; remove the MongoDB fallback

```typescript
// Transition-period authenticateRefresh
const userId = await redis.get(`refresh_token:${refresh_token}`);
if (userId) {
  // Redis hit — proceed
} else {
  // Fallback to MongoDB (legacy tokens)
  const user = await User.findOne({ refreshToken: refresh_token });
  if (user && user.refreshTokenExpiresAt > new Date()) {
    // Migrate to Redis on use
    await redis.set(`refresh_token:${refresh_token}`, user.id, "EX", 604800);
  }
}
```

Delete the fallback after one token-lifetime cycle (7 days).

---

## Verification Checklist

| # | Test | Expected |
|---|------|----------|
| 1 | Register → check Redis | Key `refresh_token:{uuid}` exists with TTL |
| 2 | Login → check Redis | Same as above |
| 3 | Google login → check Redis | Same as above |
| 4 | Refresh → check Redis | Old key DEL, new key SET |
| 5 | Authenticate with valid token | `req.user` populated, next() called |
| 6 | Authenticate with expired token | Redis returns null → logout response |
| 7 | Authenticate with non-existent token | Redis returns null → logout response |
| 8 | Logout → check Redis | Key DEL |
| 9 | MongoDB User documents | No `refreshToken` or `refreshTokenExpiresAt` in new users |
| 10 | After 7 days | Token auto-expires from Redis (verify with `TTL` command) |

---

## Rollback

If something goes wrong:

1. Revert code changes
2. If MongoDB `refreshToken` field still exists (you didn't remove it), old tokens still work
3. If you removed the MongoDB field, users will need to re-login