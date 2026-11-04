(()=>{const button=document.querySelector('.menu'),nav=document.querySelector('.nav');button?.addEventListener('click',()=>{const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'Закрыть меню':'Открыть меню');button.textContent=open?'×':'☰';nav.classList.toggle('is-open',open)});nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('is-open');button?.setAttribute('aria-expanded','false');button?.setAttribute('aria-label','Открыть меню');if(button)button.textContent='☰'}));
const selection=document.getElementById('selection-note'),email=document.getElementById('email-request');
document.querySelectorAll('a[data-training]').forEach(link=>link.addEventListener('click',()=>{
 const training=link.getAttribute('data-training')||'тренинги для IT-команд';
 if(selection){selection.hidden=false;selection.textContent='Вы выбрали: '+training+'. Напишите название тренинга в Telegram или отправьте запрос по email.';}
 if(email){email.href='mailto:julia.bazhura@yandex.ru?subject='+encodeURIComponent('Программа и условия: '+training)+'&body='+encodeURIComponent('Здравствуйте, Юлия! Интересует обучение: '+training+'.\nКоличество участников: \nПредпочтительный формат: ');}
}));})();
