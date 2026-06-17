# Import JSON vao MongoDB Compass

Du lieu import da duoc tao trong thu muc:

```txt
C:\Memorypic\mongo-import
```

Trong MongoDB Compass:

1. Ket noi local MongoDB, vi du `mongodb://127.0.0.1:27017`.
2. Tao database ten `memorypic`.
3. Tao lan luot cac collection theo ten file trong `mongo-import`, bo duoi `.json`.
   Vi du: file `pins.json` import vao collection `pins`.
4. Vao tung collection > `Add Data` > `Import JSON or CSV file` > chon file JSON tu `mongo-import`.
5. Chon dinh dang `JSON`, roi import.

Sau khi import local xong, sua `backend\.env`:

```env
STORAGE_MODE=mongodb
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=memorypic
```

Chay backend:

```bash
cd C:\Memorypic\backend
npm start
```

Neu muon tao lai bo file import sau khi web da co du lieu moi:

```bash
cd C:\Memorypic\backend
npm run prepare:mongo-import
```

Neu muon dua du lieu len MongoDB Atlas de nguoi khac vao web van thay du lieu, xem:

```txt
C:\Memorypic\MONGODB_ATLAS.md
```
