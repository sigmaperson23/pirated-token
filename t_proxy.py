import urllib.request,os
os.environ["HTTPS_PROXY"]="http://127.0.0.1:8080"
ctx=None
import ssl
ctx=ssl.create_default_context(cafile=r"C:\Users\sixth\Desktop\Claude\Playground\switchyard\mitm-ca.pem")
op=urllib.request.build_opener(urllib.request.ProxyHandler({"https":"http://127.0.0.1:8080"}),urllib.request.HTTPSHandler(context=ctx))
r=op.open("https://api.bridgemind.ai/health",timeout=20)
print(r.status, r.read()[:100])
