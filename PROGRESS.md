# สถานะพัฒนา Asset Command Center

วันที่ตรวจ: 13 ตุลาคม 2569 (Asia/Bangkok)

## สรุปแต่ละระยะ

| ระยะ | สิ่งที่ทำได้แล้ว | หลักฐาน | งานที่ยังไม่ครบ/ข้อจำกัด |
|---|---|---|---|
| 1 โครงสร้าง/DB | TypeScript strict, React/Vite/Fastify, SQL migrations, Drizzle identity mapping, PostgreSQL/PGlite, seed 22 คน/22 ชิ้น/10 จุด | lint/typecheck/tests/build ผ่าน; seed ซ้ำไม่เพิ่มข้อมูล; DB กันซ้ำ/รูปแบบ/แก้เลข; transaction rollback | PostgreSQL Server/Docker ยังไม่ได้รันจริงในเครื่องนี้ |
| 2 CRUD | กรม อาคาร ชั้น กอง ห้อง ลิงก์กอง-ห้อง แผนก พื้นที่ บุคลากร ประเภทแบบ parent tree ทะเบียน fixtures; ค้นหา; ตรวจหมวดวน; ห้ามลบ occupied area | API integration; UI เพิ่ม .023 ได้และปฏิเสธซ้ำ/ผิดรูปแบบ | ไม่ย้ายโครงสร้างแม่ผ่าน CRUD ปกติ ต้องวางแผนย้ายองค์กรแยก; ไม่ลบทะเบียนจริง |
| 3 Dashboard/Explorer | ตัวเลขและกราฟประเภท/สถานะ/แผนก/ผู้ดูแล, preview ผังจาก DB, cascading selectors, filter ข้อมูลจริง/SAMPLE | Browser เห็น 22/22/10; admin ค่าเริ่มต้นไม่รวม SAMPLE; build ผ่าน | ยังไม่มีรายงานเชิงประวัติหรือการกรองช่วงวันที่ |
| 4 Master | เพิ่มพื้นที่/รอจัดวาง, canvas drag, resize/rotate ผ่าน Transformer และฟอร์ม, สี/ลำดับภาพ, โครงสร้างผนัง/ประตู/หน้าต่าง/เสา/ทางเดิน/โซน, meters, orientation ไม่สลับพิกัด, draft/publish/revision | UI ลากพื้นที่จาก x=.5,y=3 เป็น 1.25,3.5; แก้ width=3.5, rotation=10; บันทึกได้; geometry integration | รองรับสี่เหลี่ยม v1; ไม่มี polygon อิสระ; ยังไม่ได้ stress-test ผังขนาดใหญ่ |
| 5 Detail | หลายทะเบียนต่อพื้นที่/จุด, fixture แยก, grid 5/10/25/50 ซม., zoom/pan, undo/redo, autosave ร่าง, grouping, แม่แบบแถว, category descendants, สถานะ/คน/แผนก/เลขทะเบียน, presets, ป้ายเลขเต็มพร้อมเส้นเชื่อม | UI วาง .023 เพิ่มในพื้นที่, เลือกกลุ่ม, filter คอมฯ+โต๊ะ, publish แล้ว reload เห็น revision/ตัวกรอง/รายการเดิม; เลขเต็มอ่านได้ | PNG/PDF export และ XLSX import เป็นงานระยะถัดไปตาม SPEC; ไม่จำกัดจำนวนเชิงธุรกิจ แต่ API จำกัด 4 MB ต่อคำขอ |
| 6 โอน/Audit/Access/QA | Transactional transfer/history, immutable asset number, audit, login/scrypt/session, RBAC, บัญชี DEMO ดู SAMPLE, จัดการผู้ใช้, CSV import atomic/export, backup/restore, cleanup SAMPLE แบบ rollback เมื่อผูกข้อมูลจริง | ชุดทดสอบล่าสุด 19 tests ผ่าน; dump ฐานจริงแล้ว restore ใหม่พบ assets=22; browser QA แยกฐานชั่วคราว | ต้องทบทวนสิทธิ์ระดับหน่วยงาน, TLS/production hardening, penetration test และซ้อมกู้คืนในโครงสร้าง production; ยังไม่ production-ready |

ทุกระยะใช้ชุดคำสั่ง `pnpm check` (lint → typecheck → tests → build) มีการแก้ข้อผิดพลาดและรันใหม่ก่อนเดินหน้าต่อ รวมถึงหลังรวมงานระยะ 4–5 ผ่านแล้ว

## ไฟล์ที่เพิ่ม/แก้ตามระยะ

- Phase 1: package/TypeScript/Vite/ESLint, `.env.example`, Docker Compose, `apps/api/src/db.ts`, `db/migrations/*`, `db/seed.ts`, `packages/shared/model.ts`, `tests/database.test.ts`
- Phase 2: `entities.ts`, `service.ts`, `app.ts`, `EntityManager.tsx`, `lib.ts`, `tests/api.test.ts`
- Phase 3: `App.tsx`, `styles.css`, `main.tsx`
- Phase 4–5: `LayoutEditor.tsx`, `editor.css`, published snapshot migration, geometry helpers, `tests/integrity.test.ts`
- Phase 6: `auth.ts`, `orm.ts`, `import.ts`, `sheets.ts`, `sample.ts`, setup/backup/QA scripts, `tests/phase6.test.ts`, `tests/sample.test.ts`, CI workflow, README และเอกสารนี้

## Google Sheets

ไฟล์ผู้ใช้ `1KPlGARW77HWrbAZ2-AWPag_2w_Dv8_C8GOdS3gNUjDM`:

- สร้าง 16 แท็บตาราง + README_ACC โดยไม่ลบชีต1
- อ่านกลับตรวจจำนวนแถวทุกตารางแล้ว: agencies 1, buildings 1, floors 1, divisions 1, rooms 1, division_room_links 1, organizational_departments 4, areas 10, personnel 22, asset_categories 11, assets 22, layouts 11, fixtures 1, asset_movements 0, asset_assignment_history 22, view_presets 4
- ตรวจเลขทะเบียนเป็น string, SAMPLE flag, ชื่อบุคลากรต้น/ท้าย และ header/freeze/format ผ่าน API; ไม่อ้างว่าตรวจ Google-rendered visual ทุกแท็บแล้ว
- ชีตเป็นสำเนาจาก PostgreSQL ซึ่งบังคับ uniqueness/transaction จริง ไม่ใช่ Sheets-only DB
- Runtime sync มีโค้ด/สถานะ/retry แต่ **ยังไม่เชื่อม credentials จริง** ต้องแชร์ชีตให้ service account และตั้ง `.env` ตาม README จึงทดสอบ end-to-end Google sync ได้

## Browser QA

ใช้ฐาน QA ในหน่วยความจำ `http://localhost:3002` แยกจาก `data/postgres`:

1. เข้าระบบ admin → ค่าเริ่มต้นแสดงข้อมูลจริง 0; เปิด SAMPLE → 22 ทะเบียน
2. เพิ่ม `7100.0001.001.023.01` ผ่านฟอร์ม → 23 เฉพาะฐาน QA
3. เพิ่ม .023 ซ้ำ → UI แจ้งเลขซ้ำ; กรอก `123` → UI แจ้งรูปแบบผิด
4. ลาก Master, แก้ขนาด/หมุนผ่าน Inspector, save → revision 2
5. เปิด Detail, วาง .023, ผูกกับจุดตัวอย่าง 5, กรองคอมฯ + โต๊ะ, publish
6. Reload หน้าและกลับเข้า Detail → revision 2, 8 วัตถุที่แสดง/10 ทั้งหมด, สถานะเผยแพร่และ checkbox คงอยู่
7. บัญชี demo ไม่มีปุ่มเขียนและ API ปฏิเสธการเขียน
8. พบและแก้ body JSON ว่างของ login demo, APP_ORIGIN dev URL ไม่ตรง และ sidebar ล้นหน้าจอเตี้ย

ภาพหลักฐาน [Detail QA](docs/screenshots/detail-qa.png) เป็นฐานชั่วคราวที่มีรายการ .023 สำหรับทดสอบ ไม่ปะปนกับข้อมูลที่ส่งมอบ

## Backup ที่ตรวจแล้ว

หลังหยุด API ทำ `pnpm db:backup backups/verified-2026-10-13.tar.gz` และ `pnpm db:restore backups/verified-2026-10-13.tar.gz data/restore-verification` สำเร็จ พบ 22 รายการในฐานที่กู้คืน สำเนาเก็บเฉพาะเครื่องและถูก gitignore ไม่เผยแพร่ credentials หรือข้อมูล session

## ก่อนเปิดใช้จริง

ยังไม่ deploy เป็นเว็บไซต์สาธารณะ; ต้องมีโฮสต์/โดเมน/HTTPS และข้อมูลสิทธิ์องค์กรที่ยืนยันแล้ว การเปิดภายนอก LINE ใช้ query ทางการและหน้า fallback แต่ยังไม่ได้ทดสอบบนเครื่อง Android/iOS จริง ไม่สามารถรับประกันว่าระบบปฏิบัติการทุกเวอร์ชันจะยอมสลับแอปอัตโนมัติ
