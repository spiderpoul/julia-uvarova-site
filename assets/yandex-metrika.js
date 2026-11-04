/* Shared Yandex.Metrika counter. Safe to include more than once. */
(function (window, document) {
  if (window.__juliaMetrikaInitialized) return;
  window.__juliaMetrikaInitialized = true;
  (function(m,e,t,r,i,k,a){
    m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
    m[i].l=1*new Date();
    for (var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
    k=e.createElement(t);a=e.getElementsByTagName(t)[0];k.async=1;k.src=r;a.parentNode.insertBefore(k,a);
  })(window,document,'script','https://mc.yandex.ru/metrika/tag.js?id=114077657','ym');
  window.ym(114077657,'init',{ssr:true,webvisor:true,clickmap:true,ecommerce:'dataLayer',referrer:document.referrer,url:window.location.href,accurateTrackBounce:true,trackLinks:true});
})(window, document);
