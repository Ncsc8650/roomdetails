# Codex Project Instructions — Asset Command Center

1. Read `SPEC.md` fully before implementing any feature. Treat user-confirmed items as requirements and AI invented fixtures as SAMPLE only.
2. Reply and write user-facing UI labels and developer handoff in Thai; code identifiers and technical comments may use English.
3. Implement real functioning features, not screenshots/mock-only placeholders. If a feature is not yet working, label it TODO/not implemented.
4. Follow phases in SPEC.md. Do not make destructive data-model assumptions. Keep agencies, buildings, floors, divisions, rooms, areas, assets, and personnel distinct entities.
5. Use TypeScript, strict mode, migrations, seed scripts, tests. Maintain database constraints and transactional transfer logic.
6. Assets must have unique immutable asset numbers with DB-level uniqueness and validation. Support the original `7xxx.xxxx.xxx.xxx.xx` format and user-approved legacy workbook formats in SPEC section 17. Preserve source codes exactly; quarantine duplicate source rows until reviewed. Sample fixture numbers use `is_sample` and are never represented as official records.
7. Master Layout is not Detail Layout. Allow free-positioned department/room/zone points, and assets are nested within those areas. Support unlimited custom area additions.
8. Never delete asset registry records as a side effect of hiding an object or deleting a layout placement. Require explicit transfer/reconciliation for occupied area removal.
9. React-Konva canvas drag, resize, rotate and label visibility must persist through API/database, not client state only.
10. After each phase run lint, typecheck, tests, build; report failures and how to fix. Add README setup commands for Windows, .env.example and explicit ports.
11. Protect personal data and restrict demo account privileges. Before real deployment require authentication, authorization, backup strategy and audit logs.
12. Do not change confirmed Thai organizational names; uncertain agency values must be marked as provisional.
