
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="272914b1-8765-5566-87f4-d2c64921dbda")}catch(e){}}();
function e(e,t){let n=Math.max(0,Math.floor((t-e)/1e3));return n<60?`now`:n<3600?`${Math.floor(n/60)}m`:n<86400?`${Math.floor(n/3600)}h`:`${Math.floor(n/86400)}d`}function t(e){let t=Number.isFinite(e)?Math.max(0,Math.floor(e/1e3)):0;if(t<60)return`${t}s`;if(t<3600){let e=Math.floor(t/60),n=t%60;return n===0?`${e}m`:`${e}m ${n}s`}let n=Math.floor(t/3600),r=Math.floor(t%3600/60);return r===0?`${n}h`:`${n}h ${r}m`}export{e as n,t};
//# debugId=272914b1-8765-5566-87f4-d2c64921dbda
