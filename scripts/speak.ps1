$s = New-Object -ComObject SAPI.SpVoice
$v = $null
foreach ($i in $s.GetVoices()) {
    if ($i.GetDescription() -like "*Viet*" -or $i.GetDescription() -like "*An*") {
        $v = $i
        break
    }
}
if ($v) {
    $s.Voice = $v
    $s.Speak("Đã hoàn thành xong nhiệm vụ rồi, thưa đại ca!")
} else {
    # Fallback sang tiếng Anh nếu máy chưa cài giọng Việt
    $s.Speak("Mission accomplished, boss! Task is fully completed.")
}
