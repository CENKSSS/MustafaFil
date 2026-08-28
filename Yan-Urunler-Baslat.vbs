' ------------------------------------------------------------------
'  Yan Urunler Stok Takip - masaustu baslatici (25.08.2026)
'  1) localhost:8155 kapaliysa yerel sunucuyu GORUNMEZ olarak baslatir
'  2) Uygulamayi normal bir Chrome PENCERESINDE acar (sekmeler + yer isaretleri)
'  Sunucu acik kalir. Durdurmak icin Gorev Yoneticisi > python.exe
' ------------------------------------------------------------------
Option Explicit

Dim fso, sh, KOK, PORT, ADRES, CHROME, PY, i, adaylar, a, hazir

Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")

KOK   = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), "yan-urunler-stok-takip")
PORT  = 8155
ADRES = "http://localhost:" & PORT & "/"

If Not fso.FolderExists(KOK) Then
  MsgBox "Uygulama klasoru bulunamadi:" & vbCrLf & KOK, 16, "Yan Urunler"
  WScript.Quit 1
End If

' --- Chrome yolu: once kayit defteri, sonra bilinen klasorler ---
CHROME = ""
On Error Resume Next
CHROME = sh.RegRead("HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe\")
On Error GoTo 0
If CHROME = "" Then CHROME = ""
If Not fso.FileExists(CHROME) Then
  adaylar = Array( _
    sh.ExpandEnvironmentStrings("%ProgramFiles%\Google\Chrome\Application\chrome.exe"), _
    sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"), _
    sh.ExpandEnvironmentStrings("%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"))
  CHROME = ""
  For Each a In adaylar
    If CHROME = "" Then
      If fso.FileExists(a) Then CHROME = a
    End If
  Next
End If

' --- Python baslaticisi ---
PY = sh.ExpandEnvironmentStrings("%SystemRoot%\py.exe")
If Not fso.FileExists(PY) Then PY = "py"

' --- Sunucu zaten acik mi? ---
' HIZ NOTU (25.08.2026): eskiden burada dogrudan HTTP istegi atiliyordu.
' Kapali portta MSXML once ::1 sonra 127.0.0.1 deniyor ve TEK sinama
' 4,2 saniye suruyordu; kisayoldan acilis bu yuzden yavasti. Artik once
' netstat ile port dinleniyor mu diye bakiliyor (~50 ms), HTTP istegi
' yalnizca port acikken ve BIR KEZ atiliyor.
If Not PortAcik(PORT) Then
  ' Ozel sunucu (27.08.2026): statik servis + gunluk-veriler\ JSON yedek yazimi.
  sh.Run """" & PY & """ """ & fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), "yan-urunler-sunucu.py") & """", 0, False
  For i = 1 To 75                     ' en cok ~15 saniye bekle
    WScript.Sleep 200
    If PortAcik(PORT) Then Exit For
  Next
End If

' Port dinleniyor ama sunucu gercekten sayfa veriyor mu? Tek HTTP istegi
' YALNIZ port acikken atilir (~25 ms). VBScript'te And kisa devre yapmadigi
' icin ic ice yazilir; yoksa kapali portta yine 4 saniye beklenirdi.
hazir = False
If PortAcik(PORT) Then hazir = Ayakta(ADRES)
If Not hazir Then
  MsgBox "Yerel sunucu baslatilamadi." & vbCrLf & vbCrLf & _
         "Python kurulu mu diye bakin (komut satirinda: py --version)." & vbCrLf & _
         "Port " & PORT & " baska bir program tarafindan kullaniliyor olabilir.", _
         16, "Yan Urunler"
  WScript.Quit 1
End If

' --- Normal Chrome penceresi (sekme seridi + yer isaretleri), EKRANI KAPLAR ---
If CHROME <> "" Then
  sh.Run """" & CHROME & """ --new-window --start-maximized " & ADRES, 3, False
  ' Chrome zaten calisiyorsa --start-maximized yok sayilir; pencereyi
  ' acildiktan sonra kesin olarak kaplatan kucuk yardimci gizli calisir.
  sh.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & _
         fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), "Yan-Urunler-Pencere-Kapla.ps1") & """", 0, False
Else
  ' Chrome bulunamazsa varsayilan tarayicida acilir.
  sh.Run ADRES, 1, False
End If

' Port dinleniyor mu? netstat ciktisi gizli calisan bir kabuktan gecici
' dosyaya yazilir; dosya bossa port kapali demektir. ~50 ms surer.
Function PortAcik(port)
  Dim gecici, komut, f
  PortAcik = False
  gecici = fso.BuildPath(sh.ExpandEnvironmentStrings("%TEMP%"), "yu-port-" & port & ".txt")
  komut = "cmd /c netstat -an -p TCP | find "":" & port & """ | find ""LISTENING"" > """ & gecici & """"
  On Error Resume Next
  sh.Run komut, 0, True
  If fso.FileExists(gecici) Then
    Set f = fso.GetFile(gecici)
    If f.Size > 0 Then PortAcik = True
    fso.DeleteFile gecici, True
  End If
  On Error GoTo 0
End Function

' Sunucu ayakta mi diye kisa bir istek atar; hata olursa False doner.
Function Ayakta(u)
  Dim x
  Ayakta = False
  On Error Resume Next
  Set x = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  x.setTimeouts 1000, 1000, 1500, 1500
  x.open "GET", u & "index.html?cb=" & Timer(), False
  x.send
  If Err.Number = 0 Then
    If x.status = 200 Then Ayakta = True
  End If
  Err.Clear
  On Error GoTo 0
End Function
