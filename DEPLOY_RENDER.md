# Deploy MemoryPic bang GitHub va Render

Muc tieu: nguoi khac mo link web la dung duoc, khong can tai code hay chay `npm start`.

## 1. Truoc khi dua len GitHub

Khong dua cac file nay len GitHub:

```txt
backend/.env
backend/node_modules/
.json/
mongo-import/*.json
backend/*.log
```

Repo chi can code, `backend/package.json`, `backend/package-lock.json`, va file mau `backend/.env.example`.

## 2. Tao repo GitHub

```powershell
cd C:\Memorypic
git add .
git commit -m "Prepare MemoryPic for deployment"
git branch -M main
git remote add origin https://github.com/<ten-github>/<ten-repo>.git
git push -u origin main
```

Neu remote da ton tai thi chi can:

```powershell
git push
```

## 3. Mo MongoDB Atlas cho server cloud

Vao MongoDB Atlas:

```txt
Network Access -> Add IP Address
```

Khi deploy tren Render, cach de test nhanh la them:

```txt
0.0.0.0/0
```

Cach nay tien cho do an/test, nhung neu lam san pham that thi nen gioi han IP hoac dung thiet lap bao mat chat hon.

## 4. Tao Web Service tren Render

Tren Render:

```txt
New -> Web Service -> Connect GitHub repo
```

Cau hinh:

```txt
Root Directory: backend
Build Command: npm install
Start Command: npm start
```

Hoac dung file `render.yaml` trong repo de Render doc cau hinh tu Blueprint.

## 5. Them Environment Variables tren Render

Trong Render, vao service -> Environment, them:

```env
API_PREFIX=/api
STORAGE_MODE=mongodb
MONGODB_DB=Memorypic
JWT_SECRET=<chuoi-bi-mat-tu-dat>
MONGODB_URI=mongodb+srv://<db_username>:<url_encoded_db_password>@memorypic.ncblvxf.mongodb.net/?retryWrites=true&w=majority&appName=Memorypic
```

Neu password co ky tu `@` thi phai URL encode thanh `%40`.

## 6. Kiem tra sau deploy

Render se cap link dang:

```txt
https://memorypic.onrender.com
```

Kiem tra:

```txt
https://memorypic.onrender.com/api/health
https://memorypic.onrender.com/index.html
```

Neu `/api/health` tra ve `storage: "mongodb"` va `mongodb_db: "Memorypic"` thi backend dang lay du lieu tu Atlas.

## 7. Cap nhat web sau nay

Sau moi lan sua code:

```powershell
git add .
git commit -m "Mo ta thay doi"
git push
```

Render se tu deploy lai tu GitHub.
