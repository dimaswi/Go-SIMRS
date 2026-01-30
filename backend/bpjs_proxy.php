<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Debug: test apakah PHP jalan
if (isset($_GET['test'])) {
    header('Content-Type: application/json');
    echo json_encode(['test' => 'OK', 'curl_enabled' => function_exists('curl_init')]);
    exit;
}

header('Content-Type: application/json');

$consID = "30083";
$secretKey = "1fX7C5B078";
$userKey = "4e087515fc09836820cf496fdd787d17";
$baseURL = "https://apijkn-dev.bpjs-kesehatan.go.id/antreanrs_dev";

$endpoint = isset($_GET['endpoint']) ? $_GET['endpoint'] : '/ref/poli';
$method = isset($_GET['method']) ? strtoupper($_GET['method']) : 'GET';

date_default_timezone_set('UTC');
$timestamp = strval(time()-strtotime('1970-01-01 00:00:00'));

$data = $consID . "&" . $timestamp;
$signature = hash_hmac('sha256', $data, $secretKey, true);
$encodedSignature = base64_encode($signature);

$fullURL = $baseURL . $endpoint;

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $fullURL);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_HEADER, true); // Include response headers

$requestHeaders = [
    "X-cons-id: " . $consID,
    "X-timestamp: " . $timestamp,
    "X-signature: " . $encodedSignature,
    "user_key: " . $userKey,
    "Content-Type: application/json"
];
curl_setopt($ch, CURLOPT_HTTPHEADER, $requestHeaders);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "GET");
curl_setopt($ch, CURLOPT_HTTPGET, 1);

$startTime = microtime(true);
$fullResponse = curl_exec($ch);
$duration = round((microtime(true) - $startTime) * 1000);

$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$error = curl_error($ch);
curl_close($ch);

// Separate headers and body
$responseHeaders = substr($fullResponse, 0, $headerSize);
$response = substr($fullResponse, $headerSize);

echo json_encode([
    'success' => $httpCode === 200,
    'status_code' => $httpCode,
    'duration_ms' => $duration,
    'response_headers' => $responseHeaders,
    'body' => $response,
    'request' => [
        'url' => $fullURL,
        'method' => $method,
        'cons_id' => $consID,
        'timestamp' => $timestamp,
        'signature_data' => $data,
        'signature' => $encodedSignature,
        'headers' => $requestHeaders,
        'user_key' => $userKey
    ],
    'error' => $error ?: null
], JSON_PRETTY_PRINT);
