"use strict";

import XRestrict from './XRestrict.js';

window.XRestrict = XRestrict;

const xRestrict = new XRestrict;

Hooks.on('ready', () => {
    console.log(xRestrict);
    XRestrict.registerSettings();

    XRestrict.cacheConfig();

    xRestrict.on_ready();
});

Hooks.on('renderSettingsConfig', (app, html, data) => {
    XRestrict.on_renderSettingsConfig(app, html, data);
});

Hooks.on('preUpdateToken', async (token, update, scene, userId) => {
    xRestrict.on_preUpdateToken(token, update, scene, userId);
});

Hooks.on('preUpdateWall', (wall, update, options, userId) => {
    xRestrict.on_preUpdateWall(wall, update, options, userId);
})