# Windows Runner Test Checklist

**For:** Ahmed (manual testing on Windows)
**Applies to:** RUN_ARPOS.bat, RUN_ACMS.bat, RUN_AHGMS.bat, RUN_APRMS.bat, RUN_ACPMS.bat

The developer cannot run .bat files on Linux. Please run these tests and report results.

## Test 1: Extension Check — All Present (should PASS)
1. Ensure XAMPP PHP has all extensions enabled in `C:\xampp\php\php.ini`:
   - `extension=pdo_sqlite`, `extension=mbstring`, `extension=openssl`, `extension=fileinfo`, `extension=curl`, `extension=zip` (uncommented)
2. Run `RUN_<ACRONYM>.bat` from the project folder
3. **Expected:** `[OK] All required PHP extensions loaded.` — no false "missing" errors
4. **Result:** [ ] PASS / [ ] FAIL — Notes: ___________

## Test 2: Extension Check — One Missing (should show clear ERROR)
1. Temporarily comment out one extension in php.ini: `;extension=curl`
2. Run the BAT
3. **Expected:** `[ERROR] Missing PHP extensions.` with the missing name listed, plus ini path shown
4. Restore php.ini after test
5. **Result:** [ ] PASS / [ ] FAIL — Notes: ___________

## Test 3: No php.ini Loaded (should show ini fix steps)
1. Temporarily rename `C:\xampp\php\php.ini` to `php.ini.bak`
2. Run the BAT
3. **Expected:** `[ERROR] No php.ini loaded!` with instructions to copy php.ini-development
4. Restore php.ini after test
5. **Result:** [ ] PASS / [ ] FAIL — Notes: ___________

## Test 4: Run from System32 (the original bug)
1. Open cmd, `cd C:\Windows\System32`
2. Run `"C:\path\to\project\RUN_<ACRONYM>.bat"` (full path in quotes)
3. **Expected:** BAT finds project files, does NOT say "composer.json not found"
4. **Result:** [ ] PASS / [ ] FAIL — Notes: ___________

## Test 5: Run as Administrator
1. Right-click BAT → "Run as administrator"
2. **Expected:** Works normally (starts in project dir, not System32)
3. **Result:** [ ] PASS / [ ] FAIL — Notes: ___________

## Test 6: Path with Spaces
1. Copy project to `C:\My Projects\<acronym> test\`
2. Run BAT from there
3. **Expected:** All quoted paths work, no "file not found" errors
4. **Result:** [ ] PASS / [ ] FAIL — Notes: ___________

## Test 7: DOCTOR Mode
1. Run `DOCTOR_<ACRONYM>.bat`
2. **Expected:** Prints PHP version, ini path, extensions, DB status, ports, .env state
3. **Result:** [ ] PASS / [ ] FAIL — Notes: ___________

## Test 8: --skip-checks Flag
1. Run `RUN_<ACRONYM>.bat --skip-checks`
2. **Expected:** Skips preflight, goes straight to setup
3. **Result:** [ ] PASS / [ ] FAIL — Notes: ___________
