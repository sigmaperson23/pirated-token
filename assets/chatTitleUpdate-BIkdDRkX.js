
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="e7ff0568-72fa-506d-8a5b-fbf77ef50518")}catch(e){}}();
function e(e,t){if(e.id!==t.id||e.titleOrigin!==`fallback`||t.titleOrigin!==`generated`)return e;let n=e.items.find(e=>e.kind===`user`);if(!n||n.id!==t.items.find(e=>e.kind===`user`)?.id)return e;let r=e.status===`idle`&&t.status===`idle`&&e.updatedAtUnixMs===t.updatedAtUnixMs;return{...e,title:t.title,titleOrigin:`generated`,revision:r?t.revision:e.revision}}export{e as applyGeneratedChatTitle};
//# debugId=e7ff0568-72fa-506d-8a5b-fbf77ef50518
