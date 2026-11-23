import subprocess, json
ps = """
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
$bmp.Save('C:\Users\sixth\Desktop\Claude\Playground\switchyard\capture\screen.png')
"""
subprocess.run(["pwsh", "-NoProfile", "-Command", ps], check=True)
print("shot")
