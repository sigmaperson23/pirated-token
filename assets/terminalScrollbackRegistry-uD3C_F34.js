
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="b678c79e-2952-5400-9d8a-25f7a9872b86")}catch(e){}}();
var e=new Map;function t(t,n){return e.set(t,n),()=>{e.get(t)===n&&e.delete(t)}}function n(t){let n=e.get(t);if(!n)return null;try{return n()}catch{return null}}export{t as n,n as t};
//# debugId=b678c79e-2952-5400-9d8a-25f7a9872b86
