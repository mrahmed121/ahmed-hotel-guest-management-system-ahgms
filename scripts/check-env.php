<?php
/**
 * APMS Environment Checker
 * Called by RUN_*.bat to reliably verify PHP extensions.
 *
 * Usage: php scripts/check-env.php [extensions...]
 * Exit codes:
 *   0 = all extensions loaded
 *   1 = one or more extensions missing (names printed to stdout)
 *   2 = php.ini not loaded
 *
 * This avoids batch quoting/findstr issues by doing the check in PHP natively.
 */

// Find loaded ini file
$iniFile = php_ini_loaded_file();
$iniScanned = php_ini_scanned_files();

if ($iniFile === false) {
    echo "INI_STATUS:NONE\n";
    echo "INI_PATH:(none) - no php.ini loaded\n";
} else {
    echo "INI_STATUS:OK\n";
    echo "INI_PATH:{$iniFile}\n";
}

echo "PHP_VERSION:" . PHP_VERSION . "\n";
echo "PHP_BINARY:" . PHP_BINARY . "\n";

// Check extensions passed as arguments
$missing = [];
$extensions = array_slice($argv, 1);
foreach ($extensions as $ext) {
    $ext = trim($ext);
    if ($ext === '') continue;
    if (!extension_loaded($ext)) {
        $missing[] = $ext;
    }
    echo "EXT:{$ext}:" . (extension_loaded($ext) ? "LOADED" : "MISSING") . "\n";
}

if (!empty($missing)) {
    echo "MISSING:" . implode(',', $missing) . "\n";
    exit(1);
}

if ($iniFile === false) {
    exit(2);
}

echo "STATUS:OK\n";
exit(0);
