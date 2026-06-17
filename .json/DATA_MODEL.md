# MemoryPic data model notes

Thu muc nay hien la bo du lieu JSON mau. Khong thay source frontend/backend, nen phan sua truc tiep la mo rong seed data de app co the lam cac man hinh giong Pinterest: dang nhap, upload anh, luu anh, tai anh va profile.

## Collections chinh

- `users.json`: thong tin user de hien profile: username, display name, avatar, cover, bio, website, location, settings.
- `auth_accounts.json`: thong tin dang nhap local, tach rieng khoi profile. Mat khau mau duoc hash bang `scrypt`, khong luu plain text trong JSON.
- `auth_sessions.json`: phien dang nhap sau khi login thanh cong. Dung de quan ly refresh token, thiet bi, het han, dang xuat.
- `pins.json`: du lieu anh/pin de render masonry grid. Khi upload anh moi, tao mot record pin moi va gan `upload_id`.
- `image_uploads.json`: metadata file anh da upload: ten file goc, duong dan luu tru, public URL, thumbnail, kich thuoc, mime type, checksum.
- `saves.json`: quan he user luu pin vao board. File nay da co san, minh them them record cho cac pin upload moi.
- `downloads.json`: lich su tai anh. Dung de thong ke `download_count` va audit ai da tai file nao.
- `profile_summaries.json`: view-model cho trang profile. Backend co the tinh tu `users`, `pins`, `saves`, `boards`, `followers`; frontend mock co the doc truc tiep file nay.

## Dang nhap

Demo password cho cac account mau: `MemoryPic@123`.

Flow backend nen lam:

1. Tim user theo email hoac username trong `users.json`.
2. Tim auth account bang `auth_account_id` hoac `user_id` trong `auth_accounts.json`.
3. Verify password bang `password.algorithm`, `password.salt`, `password.hash`.
4. Tao access token ngan han va refresh token.
5. Luu hash cua refresh token vao `auth_sessions.json`.

Vi du verify password voi Node:

```js
const crypto = require("crypto");

function verifyPassword(inputPassword, savedPassword) {
  const hash = crypto
    .scryptSync(inputPassword, savedPassword.salt, savedPassword.key_length)
    .toString("hex");

  return crypto.timingSafeEqual(
    Buffer.from(hash, "hex"),
    Buffer.from(savedPassword.hash, "hex")
  );
}
```

Endpoint goi y:

```txt
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

## Upload anh

Khi user upload anh:

1. Luu file vao `uploads/pins/<pin_id>/original.jpg` hoac cloud storage.
2. Tao thumbnail vao `uploads/pins/<pin_id>/thumb.webp`.
3. Tao record trong `image_uploads.json`.
4. Tao record trong `pins.json`, gan `upload_id`, `image_url`, `thumbnail_url`.

Endpoint goi y:

```txt
POST /api/pins
Content-Type: multipart/form-data
fields: image, title, description, board_id, allow_comments, allow_downloads
```

Neu dung Express, nen dung `multer` cho upload local hoac S3-compatible storage cho production.

## Luu anh

Khi user bam Save:

1. Kiem tra `pin_id` ton tai trong `pins.json`.
2. Kiem tra board co thuoc ve user dang login.
3. Tao record trong `saves.json` gom `user_id`, `pin_id`, `board_id`, `created_at`.
4. Neu can, cap nhat `save_count` tren pin hoac tinh count bang query.

Endpoint goi y:

```txt
POST   /api/pins/:pinId/save
DELETE /api/pins/:pinId/save
GET    /api/users/:username/saved
```

## Tai anh

Khi user bam Download:

1. Kiem tra pin co `allow_downloads: true`.
2. Tim file trong `image_uploads.json`.
3. Tra file bang URL hoac stream file ve client.
4. Tao record trong `downloads.json`.
5. Tang `download_count` neu ban muon luu count truc tiep tren `pins.json`.

Endpoint goi y:

```txt
GET /api/pins/:pinId/download?variant=original
```

## Profile giong Pinterest

Trang profile nen lay:

- Header: `users.display_name`, `username`, `avatar_url`, `cover_url`, `bio`, `website`, `location`.
- Stats: followers, following, boards, created pins, saved pins.
- Tabs: Created, Saved, Boards.
- Created tab: pins co `user_id` cua profile user.
- Saved tab: join `saves` theo `user_id`, sau do lay pins tu `pin_id`.
- Boards tab: boards co `user_id` cua profile user.

Endpoint goi y:

```txt
GET /api/users/:username/profile
GET /api/users/:username/pins
GET /api/users/:username/saved
GET /api/users/:username/boards
```

Neu chua co backend, frontend mock co the doc `profile_summaries.json` de render nhanh, sau do doc `pins.json` theo cac id trong `created_pin_ids` va `saved_pin_ids`.
