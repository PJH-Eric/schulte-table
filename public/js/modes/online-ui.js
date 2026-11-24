/* 暫時的線上介面（M4 實作前的占位） */
(function (root) {
  'use strict';
  root.OnlineUI = {
    init: function () {}, inRoom: function () { return false; }, relang: function () {}, back: function () { root.App.show('home'); },
    enterLobby: function () { root.Kit.toast(root.I18N.t('net.disabled'), 'bad'); }, exitLobby: function () { root.App.show('home'); },
    renderLobby: function () {}, renderRoom: function () {}
  };
})(typeof self !== 'undefined' ? self : this);
