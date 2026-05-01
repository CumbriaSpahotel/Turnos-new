
$url = "https://drvmxranbpumianmlzqr.supabase.co"
$key = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ"
$headers = @{
    "apikey" = $key
    "Authorization" = "Bearer $key"
}

$date = "2026-04-06"
$emps = "'Dani','Diana','Macarena'"

Write-Host "--- TURNOS BASE 06/04 ---"
$turnosUrl = $url + "/rest/v1/turnos?fecha=eq." + $date + "&empleado_id=in.(" + $emps + ")"
$turnos = Invoke-RestMethod -Uri $turnosUrl -Headers $headers -Method Get
$turnos | ForEach-Object { Write-Host "- $($_.empleado_id): $($_.turno) (Hotel: $($_.hotel_id))" }

Write-Host "`n--- EVENTOS 06/04 ---"
$eventosUrl = $url + "/rest/v1/eventos_cuadrante?fecha_inicio=eq." + $date + "&or=(empleado_id.in.(" + $emps + "),empleado_destino_id.in.(" + $emps + "))"
$eventos = Invoke-RestMethod -Uri $eventosUrl -Headers $headers -Method Get
$eventos | ForEach-Object {
    Write-Host "- ID: $($_.id)"
    Write-Host "  Tipo: $($_.tipo)"
    Write-Host "  Estado: $($_.estado)"
    Write-Host "  Origen: $($_.empleado_id) (Turno: $($_.turno_original))"
    Write-Host "  Destino: $($_.empleado_destino_id) (Turno: $($_.turno_nuevo))"
    # Handling payload carefully
    $payloadJson = if ($_.payload) { $_.payload | ConvertTo-Json -Compress } else { "{}" }
    Write-Host "  Payload: $payloadJson"
}

Write-Host "`n--- DISTRIBUCIÓN COMPLETA SERCOTEL 06/04 ---"
$allUrl = $url + "/rest/v1/turnos?fecha=eq." + $date + "&hotel_id=eq.Sercotel%20Guadiana"
$all = Invoke-RestMethod -Uri $allUrl -Headers $headers -Method Get
$all | ForEach-Object { Write-Host "- $($_.empleado_id): $($_.turno)" }
