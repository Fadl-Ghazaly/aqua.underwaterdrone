<<<<<<< HEAD
<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
mysqli_report(MYSQLI_REPORT_OFF);

// === KONFIGURASI DATABASE ===
$servername = "localhost";
$username   = "underwat_nihaw";
$password   = "8BEGH8xekQBJEkeAe4P4";
$dbname     = "underwat_nihaw";

// === KONEKSI DATABASE ===
$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    die(json_encode(["status" => "error", "message" => "Connection failed: " . $conn->connect_error]));
}

// ============================================================
// ENDPOINT 1: INSERT DATA DARI DRONE
// Sensor: pH (kualitas_air) + Turbidity (tahan) + Baterai (daya_listrik)
// Contoh: api.php?kualitas_air=7.20&tahan=312.50&daya_listrik=100
// ============================================================
if (isset($_GET['kualitas_air']) && isset($_GET['tahan']) && isset($_GET['daya_listrik'])) {

    $kualitas_air = floatval($_GET['kualitas_air']);
    $tahan        = floatval($_GET['tahan']);
    $daya_listrik = floatval($_GET['daya_listrik']);

    $stmt = $conn->prepare("INSERT INTO drone_logs (kualitas_air, tahan, daya_listrik) VALUES (?, ?, ?)");
    $stmt->bind_param("ddd", $kualitas_air, $tahan, $daya_listrik);

    if ($stmt->execute()) {
        echo json_encode([
            "status"  => "success",
            "message" => "Data inserted successfully",
            "id"      => $conn->insert_id,
            "data"    => [
                "pH"          => $kualitas_air,
                "turbidity"   => $tahan,
                "battery"     => $daya_listrik
            ]
        ]);
    } else {
        echo json_encode(["status" => "error", "message" => "Insert error: " . $stmt->error]);
    }

    $stmt->close();

// ============================================================
// ENDPOINT 2: AMBIL DATA TERBARU (live monitoring)
// Contoh: api.php?get_latest=true
// ============================================================
} elseif (isset($_GET['get_latest'])) {

    $sql    = "SELECT * FROM drone_logs ORDER BY id DESC LIMIT 1";
    $result = $conn->query($sql);

    if ($result && $result->num_rows > 0) {
        echo json_encode($result->fetch_assoc());
    } else {
        echo json_encode(["status" => "empty", "message" => "No data found"]);
    }

// ============================================================
// ENDPOINT 3: LAPORAN RINGKASAN (tab Reports)
// Contoh: api.php?get_reports=true&period=daily|weekly|monthly
// ============================================================
} elseif (isset($_GET['get_reports'])) {

    $period = isset($_GET['period']) ? $_GET['period'] : 'daily';

    switch ($period) {
        case 'weekly':  $interval = "7 DAY";  break;
        case 'monthly': $interval = "30 DAY"; break;
        case 'daily':
        default:        $interval = "1 DAY";  break;
    }

    // Ringkasan statistik
    $sqlSummary = "SELECT 
                        AVG(kualitas_air) AS avg_kualitas_air,
                        MIN(kualitas_air) AS min_ph,
                        MAX(kualitas_air) AS max_ph,
                        AVG(tahan)        AS avg_tahan,
                        MAX(tahan)        AS max_tahan,
                        AVG(daya_listrik) AS avg_daya_listrik,
                        COUNT(*)          AS total_logs
                   FROM drone_logs
                   WHERE timestamp >= NOW() - INTERVAL $interval";

    // 10 data terbaru untuk tabel history
    $sqlHistory = "SELECT id, timestamp, kualitas_air, tahan, daya_listrik
                   FROM drone_logs
                   WHERE timestamp >= NOW() - INTERVAL $interval
                   ORDER BY id DESC
                   LIMIT 10";

    $resSummary = $conn->query($sqlSummary);
    $resHistory = $conn->query($sqlHistory);

    $summary = [];
    $history = [];

    if ($resSummary && $resSummary->num_rows > 0) {
        $summary = $resSummary->fetch_assoc();
    }

    if ($resHistory && $resHistory->num_rows > 0) {
        while ($row = $resHistory->fetch_assoc()) {
            $history[] = $row;
        }
    }

    echo json_encode([
        "status"  => "success",
        "period"  => $period,
        "summary" => $summary,
        "history" => $history
    ]);

// ============================================================
// ENDPOINT 4: DATA HISTORIS UNTUK GRAFIK
// Contoh: api.php?get_history=true&limit=20
// ============================================================
} elseif (isset($_GET['get_history'])) {

    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 20;
    if ($limit > 100) $limit = 100;

    $sql    = "SELECT * FROM drone_logs ORDER BY id DESC LIMIT $limit";
    $result = $conn->query($sql);

    $rows = [];
    if ($result && $result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            $rows[] = $row;
        }
        $rows = array_reverse($rows);
    }

    echo json_encode(["status" => "success", "data" => $rows]);

// ============================================================
// DEFAULT: Tampilkan daftar endpoint yang tersedia
// ============================================================
} else {
    echo json_encode([
        "status"    => "error",
        "message"   => "Parameter tidak dikenali.",
        "endpoints" => [
            "INSERT data drone" => "api.php?kualitas_air=7.2&tahan=312&daya_listrik=100",
            "GET latest data"   => "api.php?get_latest=true",
            "GET reports"       => "api.php?get_reports=true&period=daily|weekly|monthly",
            "GET history chart" => "api.php?get_history=true&limit=20"
        ]
    ]);
}

$conn->close();
?>
=======
<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *"); // Allow cross-origin requests from dashboard
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
mysqli_report(MYSQLI_REPORT_OFF);

// ═══════════════════════════════════════════
// 🌊 SeaPhonk - Underwater Drone API
// ═══════════════════════════════════════════
// Parameter mapping (ESP32 → Database):
//   kualitas_air  → pH Level (0–14)
//   tahan         → Turbidity in NTU (0–1000)
//   udara         → Suhu / Temperature in °C
//   daya_listrik  → Battery / Power Level
// ═══════════════════════════════════════════

// Database Configuration
$servername = "localhost"; 
$username = "underwat_seaphonk"; 
$password = "YPUXnmZjyH8LSamBvcrp"; 
$dbname = "underwat_seaphonk"; 

// Connect to database
$conn = new mysqli($servername, $username, $password, $dbname);
    
// Check connection
if ($conn->connect_error) {
    die(json_encode(["status" => "error", "message" => "Connection failed: " . $conn->connect_error]));
}

// Get parameters from URL (GET request from ESP32)
$kualitas_air = isset($_GET['kualitas_air']) ? floatval($_GET['kualitas_air']) : null;  // pH
$tahan = isset($_GET['tahan']) ? floatval($_GET['tahan']) : null;                        // Turbidity (NTU)
$udara = isset($_GET['udara']) ? floatval($_GET['udara']) : null;                        // Suhu (°C)
$daya_listrik = isset($_GET['daya_listrik']) ? floatval($_GET['daya_listrik']) : null;  // Battery

// ── INSERT DATA (from ESP32) ──
if ($kualitas_air !== null && $tahan !== null && $udara !== null && $daya_listrik !== null) {
    
    $stmt = $conn->prepare("INSERT INTO drone_logs (kualitas_air, tahan, udara, daya_listrik) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("dddd", $kualitas_air, $tahan, $udara, $daya_listrik);

    if ($stmt->execute()) {
        echo json_encode([
            "status" => "success", 
            "message" => "Data inserted successfully",
            "data" => [
                "ph" => $kualitas_air,
                "turbidity_ntu" => $tahan,
                "suhu_celsius" => $udara,
                "battery" => $daya_listrik
            ]
        ]);
    } else {
        echo json_encode(["status" => "error", "message" => "Error: " . $stmt->error]);
    }

    $stmt->close();

// ── GET LATEST DATA (for Dashboard) ──
} elseif (isset($_GET['get_latest'])) {
    $sql = "SELECT * FROM drone_logs ORDER BY id DESC LIMIT 1";
    $result = $conn->query($sql);

    if ($result->num_rows > 0) {
        $row = $result->fetch_assoc();
        echo json_encode($row);
    } else {
        echo json_encode(["status" => "empty", "message" => "No data found. Waiting for drone..."]);
    }

// ── GET HISTORY (for Chart - optional) ──
} elseif (isset($_GET['get_history'])) {
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 20;
    $limit = min($limit, 100); // Max 100 rows
    
    $sql = "SELECT * FROM drone_logs ORDER BY id DESC LIMIT ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $limit);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $data = [];
    while ($row = $result->fetch_assoc()) {
        $data[] = $row;
    }
    
    echo json_encode([
        "status" => "success",
        "count" => count($data),
        "data" => array_reverse($data) // Oldest first for chart
    ]);
    
    $stmt->close();

// ── ERROR: Missing parameters ──
} else {
    echo json_encode([
        "status" => "error", 
        "message" => "Missing parameters. Required: kualitas_air (pH), tahan (NTU), udara (°C), daya_listrik OR get_latest=true OR get_history=true"
    ]);
}

$conn->close();
?>
>>>>>>> 1d212adaff8a7799840fd4e339bdf122d6305fd3
