# ------------------------------------------------------------------
#  Yan Urunler - yeni acilan Chrome penceresini ekrana kaplatir.
#  Baslatici (Yan-Urunler-Baslat.vbs) tarafindan gizli olarak cagrilir.
#  Gerekce: Chrome zaten calisiyorken --start-maximized yok sayilir,
#  yeni pencere son pencerenin boyutunu miras alir. Bu betik pencereyi
#  acildiktan sonra kesin olarak kaplatir.
# ------------------------------------------------------------------
Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class YUKapla {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr h);
}
"@
$sb = New-Object System.Text.StringBuilder 256
for ($i = 0; $i -lt 60; $i++) {          # en cok 15 saniye bekler
  Start-Sleep -Milliseconds 250
  $h = [YUKapla]::GetForegroundWindow()
  if ($h -eq [IntPtr]::Zero) { continue }
  $sb.Clear() | Out-Null
  [YUKapla]::GetClassName($h, $sb, 256) | Out-Null
  if ($sb.ToString() -eq 'Chrome_WidgetWin_1') {
    if (-not [YUKapla]::IsZoomed($h)) { [YUKapla]::ShowWindow($h, 3) | Out-Null }
    break
  }
}
