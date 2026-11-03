/* Единая навигация julia-uvarova.ru */
(function () {
  "use strict";
  if (!document.body || document.getElementById("site-nav")) return;
  var path = window.location.pathname.replace(/index\.html$/i, "").replace(/\/+$/, "") + "/";
  var pages = {
    "/": {kind:"home", title:"Главная"},
    "/trainings/": {kind:"trainings", title:"Тренинги"},
    "/trainings/teamlead/": {kind:"teamlead", title:"Команда есть. А всё снова на вас?"},
    "/teambuilding/lord-of-the-ring/": {kind:"teambuilding", title:"Дебаг команды"},
    "/consultations/": {kind:"service", title:"Консультации"},
    "/corporate-books/": {kind:"service", title:"Корпоративные книги"},
    "/speaking-prep/": {kind:"service", title:"Подготовка выступлений"},
    "/books/": {kind:"books", title:"Книги"},
    "/books/tango-1/": {kind:"tango", title:"Под звуки скрипки"},
    "/books/tango-2/": {kind:"tango", title:"Как разгоралось пламя"},
    "/books/tango-3/": {kind:"tango", title:"В жерле вулкана"},
    "/speaking/": {kind:"service", title:"Выступления"}
  };
  var current = pages[path] || {kind:"other", title:document.title};
  document.body.classList.add("unav-equipped", "unav-page-" + current.kind);
  var sections = [
    {title:"Для компаний и руководителей", links:[
      ["Все тренинги", "/trainings/"],
      ["Команда есть. А всё снова на вас?", "/trainings/teamlead/"],
      ["Тимбилдинг «Дебаг команды»", "/teambuilding/lord-of-the-ring/"],
      ["Корпоративные книги", "/corporate-books/"],
      ["Индивидуальные консультации", "/consultations/"],
      ["Подготовка выступлений и питчей", "/speaking-prep/"]
    ]},
    {title:"Книги", links:[
      ["Все книги", "/books/"],
      ["Дебаг выгорания", "/books/#work"],
      ["От страха к любви", "/books/#life"],
      ["Откровения танго-хулиганки", "/books/#tango"],
      ["Книга 1. Под звуки скрипки", "/books/tango-1/"],
      ["Книга 2. Как разгоралось пламя", "/books/tango-2/"],
      ["Книга 3. В жерле вулкана", "/books/tango-3/"]
    ]},
    {title:"Обо мне и связь", links:[
      ["Выступления и подкасты", "/speaking/"],
      ["Обо мне", "/#about"],
      ["Контакты", "/#contact"],
      ["Главная", "/"]
    ]}
  ];
  function link(label, href, cssClass) {
    return '<a href="' + href + '"' +
      (cssClass ? ' class="' + cssClass + '"' : '') +
      (href === path ? ' aria-current="page"' : '') +
      '>' + label + '</a>';
  }
  var bar = document.createElement("div");
  bar.id = "site-nav";
  bar.innerHTML =
    '<div class="unav-inner">' +
      '<a class="unav-brand" href="/" aria-label="Юлия Уварова — главная страница">' +
        '<span class="unav-brand-mark" aria-hidden="true">Ю</span><span>Юлия Уварова</span></a>' +
      '<nav class="unav-primary" aria-label="Основные разделы">' +
        link("Тренинги", "/trainings/") + link("Книги", "/books/") + link("Выступления", "/speaking/") +
      '</nav>' +
      '<button type="button" class="unav-menu-button" aria-controls="site-nav-panel" aria-expanded="false" aria-label="Открыть все разделы">' +
        '<span class="unav-hamburger" aria-hidden="true"><span></span><span></span><span></span></span>' +
        '<span class="unav-button-label">Всё меню</span></button>' +
      '<div class="unav-panel" id="site-nav-panel" hidden>' +
        '<div class="unav-panel-top"><span class="unav-panel-heading">Разделы сайта</span>' +
        '<a href="/" class="unav-panel-home">На главную</a></div>' +
        '<div class="unav-panel-grid">' +
          sections.map(function (section) {
            return '<section class="unav-group"><div class="unav-group-title">' + section.title +
              '</div><div class="unav-group-links">' +
              section.links.map(function (item) {
                return link(item[0], item[1], "unav-panel-link");
              }).join("") + '</div></section>';
          }).join("") +
        '</div></div></div>';
  document.body.insertBefore(bar, document.body.firstChild);
  var primary = bar.querySelectorAll(".unav-primary a");
  if (current.kind === "tango" || current.kind === "books") primary[1].classList.add("unav-active");
  else if (current.kind === "trainings" || current.kind === "teamlead" || current.kind === "teambuilding") primary[0].classList.add("unav-active");
  else if (path === "/speaking/") primary[2].classList.add("unav-active");

  var toggle = bar.querySelector(".unav-menu-button");
  var panel = bar.querySelector(".unav-panel");
  function setOpen(open, returnFocus) {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Закрыть все разделы" : "Открыть все разделы");
    bar.classList.toggle("unav-open", open);
    if (open) {
      var first = panel.querySelector("a");
      if (first) first.focus();
    } else if (returnFocus) toggle.focus();
  }
  toggle.addEventListener("click", function () { setOpen(panel.hidden, false); });
  document.addEventListener("pointerdown", function (event) {
    if (!panel.hidden && !bar.contains(event.target)) setOpen(false, false);
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !panel.hidden) setOpen(false, true);
  });
  panel.addEventListener("click", function (event) {
    if (event.target.closest("a")) setOpen(false, false);
  });

  var breadcrumbs = {
    "/trainings/": [["Главная", "/"], ["Тренинги"]],
    "/trainings/teamlead/": [["Главная", "/"], ["Тренинги", "/trainings/"], ["Команда есть. А всё снова на вас?"]],
    "/teambuilding/lord-of-the-ring/": [["Главная", "/"], ["Тренинги", "/trainings/"], ["Дебаг команды"]],
    "/consultations/": [["Главная", "/"], ["Консультации"]],
    "/corporate-books/": [["Главная", "/"], ["Для компаний", "/#companies"], ["Корпоративные книги"]],
    "/speaking-prep/": [["Главная", "/"], ["Подготовка выступлений"]],
    "/books/": [["Главная", "/"], ["Книги"]],
    "/speaking/": [["Главная", "/"], ["Выступления"]]
  };
  if (breadcrumbs[path]) {
    var crumbs = document.createElement("nav");
    crumbs.id = "site-breadcrumbs";
    crumbs.setAttribute("aria-label", "Путь по сайту");
    crumbs.innerHTML = '<div class="unav-crumbs-inner">' +
      breadcrumbs[path].map(function (item, i) {
        return (i ? '<span class="unav-crumb-separator" aria-hidden="true">/</span>' : '') +
          (item[1] ? link(item[0], item[1]) : '<span aria-current="page">' + item[0] + '</span>');
      }).join("") + '</div>';
    var oldHeader = document.body.querySelector(":scope > header, :scope > nav");
    if (oldHeader) oldHeader.insertAdjacentElement("afterend", crumbs);
    else bar.insertAdjacentElement("afterend", crumbs);
  } else if (current.kind === "tango") {
    var existingCrumbs = document.querySelector("main .breadcrumb");
    if (existingCrumbs) existingCrumbs.insertAdjacentHTML("afterbegin", '<a href="/">Главная</a> / ');
  }
  if (current.kind === "trainings" || current.kind === "teamlead") {
    var local = current.kind === "trainings" ?
      document.querySelector("body > header .header-inner") :
      document.querySelector("body > nav .nav-inner");
    if (local) {
      var label = document.createElement("span");
      label.className = "unav-local-label";
      label.textContent = "На этой странице";
      var oldBrand = local.querySelector(".brand");
      if (oldBrand) oldBrand.insertAdjacentElement("afterend", label);
    }
    document.documentElement.style.scrollPaddingTop = "150px";
  } else if (current.kind === "teambuilding") {
    document.documentElement.style.scrollPaddingTop = "155px";
  } else document.documentElement.style.scrollPaddingTop = "86px";

  // Обычные ссылки в коротких подвалах, без блоков «Смотрите также».
  var footer = document.querySelector("body > footer");
  if (footer) {
    var internalLinks = Array.prototype.filter.call(footer.querySelectorAll("a[href]"), function (a) {
      return /^(\/|#|\.\.\/|books\/|trainings\/|speaking\/)/.test(a.getAttribute("href"));
    });
    if (internalLinks.length < 3) {
      var footerNav = document.createElement("nav");
      footerNav.className = "unav-footer-links";
      footerNav.setAttribute("aria-label", "Разделы сайта в подвале");
      footerNav.innerHTML = link("Главная", "/") + link("Тренинги", "/trainings/") +
        link("Консультации", "/consultations/") + link("Книги", "/books/") +
        link("Выступления", "/speaking/");
      footer.appendChild(footerNav);
    }
  }
})();