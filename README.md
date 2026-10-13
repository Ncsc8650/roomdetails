# Asset Command Center

เว็บไซต์ภาษาไทยสำหรับกรม → อาคาร → ชั้น → กองงาน/ห้อง → แผนก/จุดพื้นที่ → ผังย่อย → ครุภัณฑ์ ใช้ React, TypeScript strict, React-Konva, Fastify, Drizzle ORM สำหรับบัญชีผู้ใช้ และ parameterized SQL สำหรับธุรกรรมทะเบียน

อ่าน [SPEC.md](SPEC.md), [AGENTS.md](AGENTS.md), [CODEX_START.md](CODEX_START.md) และ [PROGRESS.md](PROGRESS.md) สำหรับขอบเขตกับสถานะการทดสอบ ข้อกำหนดต้นฉบับไม่ได้ถูกแก้ไข

## เริ่มบน Windows 11

เครื่องที่ใช้พัฒนาทดสอบด้วย Node.js 24.19.0 และ pnpm 11.25.0 ติดตั้ง Node.js 24 และ Git ให้เรียกได้จาก PowerShell ก่อน

```powershell
git clone https://github.com/Ncsc8650/roomdetails.git
cd roomdetails
npm install -g pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm setup
pnpm db:migrate
pnpm db:seed
pnpm dev
```

เปิด **http://127.0.0.1:5173/** (frontend 5173, API 3001) ให้เปิด URL ตรงตาม `APP_ORIGIN` ใน `.env` เพื่อผ่านการตรวจต้นทางคำขอ

`pnpm setup` สร้าง `.env` พร้อมรหัสผ่านสุ่มเฉพาะเครื่อง โดยไม่เขียนทับไฟล์ที่มีแล้ว ดูค่า `ADMIN_USERNAME` และ `ADMIN_PASSWORD` ใน `.env` เพื่อเข้าสู่ระบบ รหัสผ่านเริ่มต้นใช้สร้างบัญชีครั้งแรกเท่านั้น การเปลี่ยนค่านี้ภายหลังไม่เปลี่ยนรหัสผ่านบัญชีเดิม เก็บไฟล์นี้เป็นความลับและไม่ commit

ปุ่ม **ดูข้อมูลตัวอย่าง** เป็น viewer อ่าน SAMPLE อย่างเดียว ไม่มีสิทธิ์เพิ่ม/แก้/ลบ ตั้ง `DEMO_LOGIN=false` ก่อนใช้งานข้อมูลจริง

### เปิดแบบ build

```powershell
pnpm check
pnpm start
```

เปิด **http://127.0.0.1:3001/** หลัง build สำเร็จ ปิด dev server ก่อนเพื่อไม่ชนพอร์ต 3001; ไม่ต้องรัน Vite เมื่อใช้ build แล้ว ทั้งสองโหมดใช้ข้อมูลชุดเดียวกัน

หาก `pnpm` ไม่อยู่ใน PATH ให้ปิดและเปิด PowerShell ใหม่ ห้ามรัน seed/backup/restore หรือ API หลาย process พร้อมกันกับโฟลเดอร์ PGlite เดียวกัน

## ฐานข้อมูล

ค่าเริ่มต้นเป็น **PGlite: PostgreSQL engine แบบฝังตัว** บันทึกจริงใน `data/postgres` ไม่ใช้ localStorage เป็นฐานทะเบียน รองรับ SQL migrations, FK, CHECK, UNIQUE และ transaction บน Windows โดยไม่ต้องมี Docker

โครงสร้างแยก `agencies`, `buildings`, `floors`, `divisions`, `rooms`, `division_room_links`, `organizational_departments`, `areas`, `personnel`, `asset_categories`, `assets`, `fixtures`, `layouts`, ประวัติการโอน/ผู้รับผิดชอบ, บัญชี, session, audit และสถานะซิงก์ ผังมี view `master_layouts`/`detail_layouts`; วัตถุในผังเก็บ JSONB พร้อม validation ฝั่ง API และ optimistic revision

เลขทะเบียน STRING รองรับ `7xxx.xxxx.xxx.xxx.xx` และรูปแบบเอกสารเดิมตาม SPEC ข้อ 17 มี UNIQUE และ regex CHECK ใน PostgreSQL; trigger ป้องกันเปลี่ยนเลขหลังสร้าง การจำหน่ายยังเก็บทะเบียนไว้ ไม่ให้ใช้เลขซ้ำ

### ใช้ PostgreSQL Server แทน PGlite

ติดตั้ง Docker Desktop ที่เปิด Linux containers แล้วเพิ่มค่าต่อไปนี้ใน `.env` โดยเปลี่ยนรหัสผ่านเองและ URL-encode อักขระพิเศษใน URL:

```dotenv
POSTGRES_PASSWORD=YOUR_STRONG_PASSWORD
DATABASE_URL=postgresql://asset_admin:YOUR_STRONG_PASSWORD@127.0.0.1:5432/asset_command
```

```powershell
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

โหมดนี้เป็นฐานใหม่ ไม่ย้ายข้อมูลจาก PGlite ให้อัตโนมัติ เส้นทาง PostgreSQL Server เตรียมไว้แล้ว แต่เครื่องพัฒนาไม่มี Docker/psql จึงยังไม่ได้ทดสอบด้วย server แยกจริง

## Google Sheets ที่ผู้ใช้ระบุ

ใช้ไฟล์ [db001](https://docs.google.com/spreadsheets/d/1KPlGARW77HWrbAZ2-AWPag_2w_Dv8_C8GOdS3gNUjDM/edit) มี 16 แท็บตารางและ `README_ACC` พร้อมข้อมูล SAMPLE ตั้งต้น คง `ชีต1` เดิมไว้ ไม่ส่งรหัสผ่าน/session/บัญชีผู้ใช้ไปชีต

**PostgreSQL เป็นทะเบียนหลัก; Google Sheets เป็นสำเนาตารางที่ซิงก์ทางเดียวจากเว็บไซต์** เพราะ Sheets ไม่มี UNIQUE constraint กับ transaction แบบที่ SPEC บังคับ การแก้ชีตโดยตรงไม่เปลี่ยนข้อมูลเว็บไซต์ และอาจถูกเขียนทับเมื่อซิงก์ ชีตไม่ใช่ระบบล็อกทะเบียนหลักหรือไฟล์ backup ทั้งระบบ

เพื่อให้ตัวเว็บซิงก์ได้เอง:

1. สร้าง service account ใน Google Cloud project ของผู้ใช้และเปิด Google Sheets API
2. แชร์ไฟล์ db001 ให้ email ของ service account เป็น Editor
3. เก็บ JSON key นอก Git repository เช่น `C:/acc-secrets/google-service-account.json`
4. ตั้ง `GOOGLE_APPLICATION_CREDENTIALS` ใน `.env` เป็น path นี้ และตรวจ `GOOGLE_SPREADSHEET_ID`
5. รีสตาร์ต API แล้วเข้า **ตั้งค่าและสิทธิ์ → ซิงก์ตอนนี้**

เมื่อมี credentials ระบบตรวจข้อมูลรอซิงก์ทุก 60 วินาที เขียน batch แบบ atomic และแสดงเวลา/error/สถานะ pending การซิงก์ล้มเหลวไม่ทำให้ข้อมูล PostgreSQL หาย มีปุ่ม retry; ไม่มีการอ้างว่าซิงก์สำเร็จเมื่อยังไม่ได้ตั้งค่า credentials

Google connector ในแชตใช้สร้างและตรวจข้อมูลตั้งต้นแล้ว แต่ credentials ของ connector ไม่ได้ถูกดึงมาใช้กับเว็บไซต์ ต้องตั้ง service account ของผู้ใช้แยกต่างหาก การเชื่อมต่ออัตโนมัติจริงยังรอขั้นตอนนี้

## ข้อมูล SAMPLE

- อาคารบริการ ชั้น 11; กองกรรมวิธีข้อมูลทางการเงิน / กกมง.กง.กห.
- 4 แผนกตามชื่อยืนยันใน SPEC, 10 พื้นที่, บุคลากรสมมติ 22 คน, ครุภัณฑ์ 22 รายการ
- เลขตั้งแต่ `7100.0001.001.001.01` ถึง `7100.0001.001.022.01`
- กรมการเงินกลาโหมมี `sample-unverified`; ขนาด 18×12 เมตรเป็นค่าประมาณ
- ห้องเก็บของ **รอจัดวาง**; ไม่สร้างตำแหน่งแทนผู้ใช้
- seed ทำซ้ำได้โดยไม่สร้าง 22 คน/22 ทะเบียนซ้ำ; ไม่ reset ข้อมูลที่แก้ไขแล้ว
- แยก fixture ไม่มีทะเบียนออกจาก assets; 012/016 เป็นทะเบียนปลั๊กไฟตัวอย่างตาม SPEC เท่านั้น

ผู้ดูแลเข้าครั้งแรกจะเห็นเฉพาะข้อมูลจริง (จึงเป็น 0) เปิด **รวมข้อมูล SAMPLE** เพื่อดูชุดตั้งต้น หน้า Settings มีเครื่องมือล้าง SAMPLE ที่ต้องพิมพ์ `DELETE SAMPLE` โดย admin เท่านั้น ถ้ามีข้อมูลจริงเชื่อมอยู่จะ rollback ทั้งชุด ไม่ล้าง audit หรือหมวดประเภทที่ใช้ร่วมกัน สำรองข้อมูลก่อนใช้

## วิธีใช้งาน

1. **โครงสร้างองค์กร:** เพิ่มกรม อาคาร ชั้น กอง ห้อง และเชื่อมกองกับห้องในแท็บ “กองงาน / ห้อง” ก่อนสร้างจุดพื้นที่ แผนกเป็นองค์กรแยกจากห้อง
2. **ทะเบียนครุภัณฑ์:** สร้าง/แก้ข้อมูล ตรวจเลขไม่ซ้ำทั้งระบบ ใช้สถานะ “จำหน่าย” แทนลบ เลขทะเบียนแก้ไม่ได้
3. **บุคลากร:** เพิ่ม/แก้บุคลากร คลิกจำนวนชิ้นเพื่อดูของที่รับผิดชอบ ต้องโอนของก่อนปิดใช้งานบุคลากร
4. **Master:** เลือกสถานที่ตามลำดับ เพิ่มจุดใหม่ แล้วเลือกจาก “รอจัดวาง” ลากจุด/resize/หมุน/เปลี่ยนสี/ลำดับภาพ หรือแก้ค่าตัวเลข คลิกจุดแล้ว “เปิดผังย่อย” หรือดับเบิลคลิก
5. **Detail:** สร้างทะเบียนใหม่สำหรับพื้นที่นั้น หรือเลือกทะเบียนในพื้นที่จากรอจัดวาง เพิ่มจุดย่อย แล้วเลือกกลุ่มให้ครุภัณฑ์หลายชิ้นร่วมกันได้ ไม่มีเพดานจำนวนพื้นที่/ครุภัณฑ์เชิงธุรกิจ (คำขอ API จำกัด 4 MB)
6. เพิ่มผนัง ประตู หน้าต่าง เสา ทางเดิน โซน และปรับรูปสี่เหลี่ยมได้เอง ไม่ต้องอัปโหลดแบบ ใช้ grid 5/10/25/50 ซม., zoom/pan, undo/redo 50 ขั้น แม่แบบเสริมรองรับ 2–8 แถวและ 2–10 จุดต่อแถว
7. **บันทึกร่าง/เผยแพร่:** autosave เป็นร่าง เปิดใช้ได้เอง debounce 1.5 วินาที หยุดเมื่อผิดพลาด ผังมี revision ถ้าชนการแก้ไขอีกหน้าต่างต้องโหลดใหม่ ระบบไม่เขียนทับเงียบ ๆ การออกจากผังที่ยังไม่บันทึกมีคำเตือน
8. **ตัวกรอง:** เลือกหลายประเภท (รวมลูกหมวด), ค้นเลข/ชื่อ, สถานะ, แผนก, ผู้รับผิดชอบ; ตัวกรองไม่ลบข้อมูล ป้ายเต็มใช้เส้นเชื่อมแยกช่องไม่ทับกัน เลือกเลขย่อหรือซ่อนได้ และบันทึก View Preset ได้
9. **การโอน:** กดไอคอนลูกศรในทะเบียน เลือกปลายทาง/ผู้รับผิดชอบ/เหตุผล เก็บประวัติใน transaction และนำวัตถุออกจากผังต้นทาง เลขทะเบียนเดิมไม่เปลี่ยน จัดวางที่ปลายทางจากรอจัดวาง
10. “เอาออกจากผังเท่านั้น” ไม่ลบทะเบียน การลบพื้นที่ที่มีของจะถูกบล็อก พื้นที่ที่มีประวัติอ้างอิงอาจลบไม่ได้เพื่อรักษาประวัติ

orientation เป็น metadata ของมุมมอง ไม่สลับ x/y หรือขนาดที่บันทึกอัตโนมัติ ฟอร์มตัวเลขใช้หน่วยเมตร การสร้างรูปทรงอิสระนอกเหนือสี่เหลี่ยมยังเป็นระยะถัดไป

## นำเข้า/ส่งออก

CSV import ที่ทะเบียนใช้หัวคอลัมน์ภาษาอังกฤษตามปุ่ม **แม่แบบ CSV** เช่น `asset_number,name,category_id,division_id,area_id,custodian_id,is_sample` ค่าที่อ้างอิงต้องเป็น ID ที่มีจริง จำนวน 1–2,000 แถว/ครั้ง ตรวจซ้ำภายในไฟล์และกับ DB หากผิดแม้แต่แถวเดียวจะ rollback ทั้งชุด

CSV สำหรับรายงานใช้หัวภาษาไทยและไม่ใช่ไฟล์นำเข้ากลับโดยตรง มีการป้องกัน formula injection เมื่อเปิดด้วย spreadsheet ส่วน JSON ในหน้าตั้งค่าเป็น export ข้อมูล ไม่ใช่ backup ทั้งระบบ

นำเข้า XLSX แม่แบบ “ทะเบียนครุภัณฑ์” ได้ผ่านสคริปต์ด้านล่าง ส่วนอัปโหลด XLSX ทั่วไปผ่านหน้าเว็บและ PNG/PDF export ยังไม่ทำ

### นำเข้าทะเบียนตาม Excel ต้นฉบับ

ต้องมี Python 3 พร้อม `openpyxl` และเปิด API อยู่แล้ว ใช้บัญชี admin จาก `.env`:

```powershell
python -m pip install openpyxl
python scripts/extract-source.py "C:\path\ทะเบียน.xlsx" imports/source.json
pnpm exec tsx scripts/import-source.ts imports/source.json <division-id-ข้อมูลจริง>
```

สคริปต์อ่าน 10 คอลัมน์ตามแม่แบบเดิม เก็บรหัสตรงต้นฉบับและทุกแถวใน `asset_import_rows` นำเข้าเฉพาะรหัสที่ถูกต้องและไม่ซ้ำเข้าทะเบียน ส่วนรหัสซ้ำ/ผิดรูปแบบ/มีอยู่แล้วเข้าคิวตรวจสอบ โดยไม่เขียนทับข้อมูลเดิม การรันไฟล์เดิมซ้ำไม่สร้างรายการซ้ำ ทั้งชุดทำใน transaction

หน้า **ทะเบียนครุภัณฑ์ → ข้อมูลครุภัณฑ์จากไฟล์ต้นฉบับ** แสดงครบทุกแถว กรองรายการรอตรวจสอบและส่งออก CSV ได้ ผู้ดูแลยืนยันรหัสจากหลักฐานพร้อมเหตุผลเพื่อเพิ่มแถวที่ค้างเข้าทะเบียนได้ โดยต้นฉบับไม่เปลี่ยนและมี audit

สถานะครุภัณฑ์นำเข้าเป็น “รอตรวจสอบ” ข้อมูลห้อง/สถานที่จากไฟล์อยู่ในหมายเหตุและตารางต้นฉบับ ยังไม่ผูกตำแหน่งผังหรือบุคลากร ข้อมูลนำเข้าจริงอยู่ในฐานข้อมูล/โฟลเดอร์ `imports/` ที่ไม่ส่งขึ้น GitHub สำรองฐานข้อมูลก่อนนำเข้า และเมื่อเปิด Google sync จะมีแท็บ `asset_import_batches` กับ `asset_import_rows` เพิ่มจาก 16 ตารางเดิม

## สำรองและกู้คืน

### PGlite

หยุด API/Dev ด้วย Ctrl+C ก่อนเสมอ แล้ว:

```powershell
pnpm db:backup backups/before-change.tar.gz
pnpm db:restore backups/before-change.tar.gz data/restored-postgres
```

backup เก็บทั้ง schema, ข้อมูล, บัญชีและ audit ส่วน restore ยอมรับ **โฟลเดอร์ใหม่ที่ยังไม่มี** เท่านั้น ไม่ล้างหรือเขียนทับฐานเดิม เมื่อผ่านตรวจ count แล้ว เปลี่ยน `DATA_DIR=./data/restored-postgres` ใน `.env` และเปิดระบบใหม่

เก็บ backup นอกเครื่องและจำกัดสิทธิ์ไฟล์ เพราะมีข้อมูลส่วนบุคคลและ password hash ควรสำรองทุกวันและก่อนอัปเดต ซ้อมกู้คืนในเครื่องแยกเป็นระยะ

### PostgreSQL Server

ใช้เครื่องมือ PostgreSQL ที่ติดตั้งแล้ว ใส่รหัสผ่านเมื่อโปรแกรมถาม:

```powershell
pg_dump -h 127.0.0.1 -U asset_admin -d asset_command -Fc -f backups/asset-command.dump
createdb -h 127.0.0.1 -U asset_admin asset_command_restore_test
pg_restore -h 127.0.0.1 -U asset_admin -d asset_command_restore_test --no-owner backups/asset-command.dump
```

ตรวจข้อมูลที่กู้คืนก่อนเปลี่ยน `DATABASE_URL`; ไม่มีสคริปต์ทำลายฐานเดิมอัตโนมัติ

## สิทธิ์และการเปิดใช้งานจริง

admin จัดการบัญชี/สิทธิ์/ซิงก์/ข้อมูลทั้งหมด; editor แก้ข้อมูลธุรกิจและผัง; viewer กับ auditor อ่านข้อมูลและรายงาน บัญชี DEMO เป็น viewer และถูกกรองให้เห็น SAMPLE เท่านั้น รหัสผ่าน scrypt, session ฝั่ง server อายุ 8 ชั่วโมง, cookie HttpOnly/SameSite, rate limit login, ตรวจ Origin และ header ของการเขียน และ audit การเปลี่ยนข้อมูล

ค่าเริ่มต้น bind 127.0.0.1 ใช้เฉพาะเครื่องนี้ ก่อนเปิดผ่านเครือข่าย/Internet ต้องมี HTTPS reverse proxy, `APP_ORIGIN` ที่ตรงโดเมน, `NODE_ENV=production` เพื่อ secure cookie, ปิด DEMO, ยืนยันผู้ดูแล/ขอบเขต editor ตามองค์กร, จำกัด DB user, ทดสอบ backup จริงและทบทวน security การให้สิทธิ์ระดับกอง/แผนกแบบละเอียด และ MFA/SSO ยังไม่มี รุ่นนี้ยังไม่รับรอง production-ready

## เปิดลิงก์ผ่าน LINE

ใช้ปุ่มรูปโซ่เพื่อคัดลอกลิงก์ที่มี `openExternalBrowser=1` ตาม [เอกสาร LINE](https://developers.line.biz/en/docs/messaging-api/using-line-url-scheme/) หากพบ User-Agent LINE ระบบจะแสดงหน้าเปิดเบราว์เซอร์ภายนอกแทนตัวแอป ไม่มีปุ่มใช้ต่อใน LINE

เว็บไซต์ไม่สามารถรับประกันการบังคับเปิดเบราว์เซอร์เริ่มต้นได้ทุกเวอร์ชันของ iOS/Android; มีคำแนะนำเมนู “เปิดในเบราว์เซอร์อื่น” และคัดลอก URL เป็น fallback ยังต้องทดสอบกับ LINE บนโทรศัพท์จริง URL 127.0.0.1 ของเครื่องพัฒนาเปิดจากโทรศัพท์อีกเครื่องไม่ได้ ต้องตั้ง URL เครือข่าย/HTTPS ก่อน

## ทดสอบ

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
# หรือทั้งหมด
pnpm check
```

Tests ใช้ PostgreSQL engine จริงในหน่วยความจำแยกจากข้อมูลผู้ใช้ ตรวจ seed, constraints, concurrent duplicate, rollback, auth/RBAC, category cycle, occupied deletion, transfer history, geometry/publish/revision, CSV atomic import และ dump/restore

สำหรับ QA ผ่าน UI แบบไม่กระทบทะเบียนจริง หลัง build ให้รัน `pnpm exec tsx scripts/qa-server.ts` และเปิด `http://localhost:3002` ใช้บัญชีจาก `.env` แต่ฐานข้อมูลนี้ชั่วคราว ปิด process แล้วข้อมูลทดสอบหาย

CI รันคำสั่งเดียวกันเมื่อ push/PR บน GitHub ดูผลจริงใน Actions ไม่ถือว่าผ่านจนงาน CI จบ

## โครงสร้างไฟล์

```text
apps/api/src/        API, validation, service/transaction, auth, Sheets sync
apps/web/src/        Dashboard, CRUD, location explorer, Konva editors
packages/shared/    validation และ geometry ที่ใช้ร่วมกัน
db/migrations/      SQL migrations
db/seed.ts          SAMPLE seed อิง SPEC.md
scripts/            setup, migration, backup/restore, QA server
tests/              integration และ data-integrity tests
```
