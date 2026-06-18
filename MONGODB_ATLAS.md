# Dua MemoryPic len MongoDB Atlas

Backend da doc MongoDB tu `backend/.env`, nen khong can hard-code URI vao `server.js`.

## 1. Tao database user tren Atlas

Trong MongoDB Atlas:

1. Vao `Database Access`.
2. Tao user, vi du `memorypic_user`.
3. Dat password va copy lai.
4. Vao `Network Access`.
5. Them IP may chay backend. Khi dev co the tam dung `0.0.0.0/0`.

## 2. Doi backend sang Atlas

Sua `backend/.env`:

```env
STORAGE_MODE=mongodb
MONGODB_URI=mongodb+srv://memorypic_user:<url_encoded_password>@memorypic.ncblvxf.mongodb.net/?retryWrites=true&w=majority&appName=Memorypic
MONGODB_DB=memorypic
```

Thay `<url_encoded_password>` bang password da URL encode. Vi du password `Memorypic@123` thi ghi `Memorypic%40123`.

## 3. Import du lieu hien tai len Atlas

Neu chua tao lai file import moi nhat:

```bash
cd C:\Memorypic\backend
npm run prepare:mongo-import
```

Import len Atlas va xoa du lieu cu trong cac collection truoc khi nap:

```bash
cd C:\Memorypic\backend
npm run import:mongodb:drop
```

Neu chi muon chen them, khong xoa du lieu cu:

```bash
npm run import:mongodb
```

## 4. Chay backend

```bash
cd C:\Memorypic\backend
npm start
```

Khi backend hien:

```txt
Connected to MongoDB database "memorypic"
```

la web dang dung Atlas. Nguoi khac vao website qua backend nay se thay cung du lieu tren cloud.
