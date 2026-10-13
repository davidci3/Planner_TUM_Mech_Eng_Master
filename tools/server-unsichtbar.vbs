' Startet den Hilfsdienst (tools/server.mjs) ohne sichtbares Fenster
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = root
sh.Run "node """ & root & "\tools\server.mjs""", 0, False
