/*
 * guard.js — removes the text-select (I-beam) cursor and text highlighting
 * everywhere on the page. The I-beam cursor and normal text selection are
 * kept only for genuine text-entry fields: text/search/etc. inputs,
 * textareas, and contenteditable elements.
 */
(function () {
  var TEXT_FIELD_SELECTOR = [
    'input:not([type])',
    'input[type="text"]',
    'input[type="search"]',
    'input[type="email"]',
    'input[type="password"]',
    'input[type="number"]',
    'input[type="tel"]',
    'input[type="url"]',
    'textarea',
    '[contenteditable="true"]',
    '[contenteditable=""]'
  ].join(',');

  var style = document.createElement('style');
  style.id = 'ryuu-guard-style';
  style.textContent =
    '*{-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none}' +
    TEXT_FIELD_SELECTOR + '{-webkit-user-select:text!important;-moz-user-select:text!important;-ms-user-select:text!important;user-select:text!important;cursor:text!important}';
  (document.head || document.documentElement).appendChild(style);

  function isTextField(target) {
    return !!(target && target.closest && target.closest(TEXT_FIELD_SELECTOR));
  }

  // Belt-and-suspenders for interactions the CSS rule alone doesn't cover,
  // such as drag-selecting across elements.
  document.addEventListener('selectstart', function (event) {
    if (!isTextField(event.target)) event.preventDefault();
  });
  document.addEventListener('dragstart', function (event) {
    if (!isTextField(event.target)) event.preventDefault();
  });
})();
