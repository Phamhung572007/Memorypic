# MemoryPic MongoDB Compass Import

Cac file trong thu muc nay duoc tao tu `.json` va giu dinh dang Extended JSON, vi du `{ "$oid": "..." }`.

Cach import bang MongoDB Compass:

1. Tao database ten `memorypic`.
2. Tao collection theo cot `collection` ben duoi.
3. Vao collection > Add Data > Import JSON or CSV file.
4. Chon file JSON tu thu muc nay va import dang JSON.
5. Sau khi import xong, chay backend voi `STORAGE_MODE=mongodb` va `MONGODB_URI`.

Vi du `.env` trong `backend`:

```env
PORT=3000
JWT_SECRET=mysecret
STORAGE_MODE=mongodb
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=memorypic
```

| collection | file | records |
| --- | --- | ---: |
| users | users.json | 5 |
| auth_accounts | auth_accounts.json | 5 |
| auth_sessions | auth_sessions.json | 4 |
| boards | boards.json | 10 |
| pins | pins.json | 16 |
| tags | tags.json | 36 |
| likes | likes.json | 22 |
| saves | saves.json | 25 |
| comments | comments.json | 10 |
| followers | followers.json | 16 |
| notifications | notifications.json | 10 |
| conversations | conversations.json | 6 |
| messages | messages.json | 9 |
| image_uploads | image_uploads.json | 4 |
| downloads | downloads.json | 3 |
| profile_summaries | profile_summaries.json | 5 |
