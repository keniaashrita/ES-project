/**
 * Telemetry Export Utility (CSV & JSON)
 */

export function exportToCSV(telemetryHistory, filename = 'lora_imu_sensor_fusion_log.csv') {
  if (!telemetryHistory || telemetryHistory.length === 0) {
    alert('No telemetry data available to export.');
    return;
  }

  const headers = [
    'timestamp',
    'true_x',
    'true_y',
    'imu_x',
    'imu_y',
    'lora_x',
    'lora_y',
    'fused_x',
    'fused_y',
    'rssi_anchor_1',
    'rssi_anchor_2',
    'rssi_anchor_3',
    'ple',
    'r_value',
    'kalman_gain',
    'position_error'
  ];

  const rows = telemetryHistory.map(d => [
    d.timestamp,
    d.true_x,
    d.true_y,
    d.imu_x,
    d.imu_y,
    d.lora_x !== null ? d.lora_x : '',
    d.lora_y !== null ? d.lora_y : '',
    d.fused_x,
    d.fused_y,
    d.rssi_anchor_1 ?? '',
    d.rssi_anchor_2 ?? '',
    d.rssi_anchor_3 ?? '',
    d.ple,
    d.r_value,
    d.kalman_gain,
    d.position_error
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToJSON(telemetryHistory, filename = 'lora_imu_sensor_fusion_log.json') {
  if (!telemetryHistory || telemetryHistory.length === 0) {
    alert('No telemetry data available to export.');
    return;
  }

  const blob = new Blob([JSON.stringify(telemetryHistory, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}