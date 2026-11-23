import sqlite3, shutil, os
src = r'C:\Users\sixth\AppData\Local\ai.bridgemind.one\bridgemind-one.sqlite3'
dst = 'bm.db'
shutil.copy(src, dst)
for ext in ('-wal','-shm'):
    if os.path.exists(src+ext): shutil.copy(src+ext, dst+ext)
c = sqlite3.connect(dst)
rows = c.execute("select name from sqlite_master where type='table' order by 1").fetchall()
print(len(rows))
for (n,) in rows: print(n)
