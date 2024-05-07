"use strict"

import { deepValue } from './utils.js';

/**
 * @typedef XPlayerDataObject
 * @property
 * @property { Function|undefined } cb
 */

/**
 * @typedef { Object } XPlayerData
 * @param { boolean } objects
 */

const KEYS = {
    INTERACTION_DOORS_ON:   'interaction-doors-on',
    // INTERACTION_DOORS:      'interaction-doors',
    INTERACTION_DOORS_RANGE:'interaction-doors-range',

    MOVE_ON:                'move-on',
    MOVE_COMBAT_ONLY:       'move-combat-only',
    MOVE_ATTRIBUTE:         'move-attribute',
    MOVE_REQUEST:           'move-request',
    MOVE_PAN:               'move-pan',
}

export default class XRestrict {
    static NAMESPACE = 'xaro-restrict';

    static instance;

    static config = {};
    ticker;
    
    _await = false;

    _rect;

    /**
     * @var { { [userId: string]: XPlayerData } }
     */
    _player = {};
    
    _cb;

    constructor() {
        if (XRestrict.instance) throw new Error('XRestrict instance already exists!!! Press F5');
        XRestrict.instance = this;
        
        this.ticker = new PIXI.Ticker;
    }

    static cacheConfig() {
        for (const _ in KEYS) {
            const key = KEYS[_];
            this.config[key] = game.settings.get(XRestrict.NAMESPACE, key);
        }
    }

    static updateConfig(key, value) {
        console.log(key, value);
        if (key in this.config === false) {
            throw new Error(`Unknown config key (${key})`);
        }

        this.config[key] = value;
    }

    static registerSettings() {
        // doors

        game.settings.register(XRestrict.NAMESPACE, KEYS.INTERACTION_DOORS_ON, {
            name:           game.i18n.localize('xaro-restrict.settings.' + KEYS.INTERACTION_DOORS_ON),
            scope:          'world',
            config:         true,
            requiresReload: false,
            type:           Boolean,
            default:        true,
            onChange: value => this.updateConfig(KEYS.INTERACTION_DOORS_ON, value),
        });
        game.settings.register(XRestrict.NAMESPACE, KEYS.INTERACTION_DOORS_RANGE, {
            name:           game.i18n.localize('xaro-restrict.settings.' + KEYS.INTERACTION_DOORS_RANGE),
            scope:          'world',
            config:         true,
            requiresReload: false,
            type:           Number,
            default:        7.5,
            range: {
                min:    0,
                max:    60,
                step:   0.5
            },
            onChange: value => this.updateConfig(KEYS.INTERACTION_DOORS_RANGE, value),
        });


        // movement

        game.settings.register(XRestrict.NAMESPACE, KEYS.MOVE_ON, {
            name:           game.i18n.localize('xaro-restrict.settings.' + KEYS.MOVE_ON),
            hint:           game.i18n.localize('xaro-restrict.hints.reload-require'),
            scope:          'world',
            config:         true,
            requiresReload: true,
            type:           Boolean,
            default:        true,
            // onChange: value => this.updateConfig(KEYS.MOVE_ON, value),
        });
        game.settings.register(XRestrict.NAMESPACE, KEYS.MOVE_COMBAT_ONLY, {
            name:           game.i18n.localize('xaro-restrict.settings.' + KEYS.MOVE_COMBAT_ONLY),
            hint:           game.i18n.localize('xaro-restrict.hints.reload-require'),
            scope:          'world',
            config:         true,
            requiresReload: true,
            type:           Boolean,
            default:        true,
            // onChange: value => this.updateConfig(KEYS.MOVE_ON, value),
        });
        // TODO: сделать выбор (для ГМ и/или игрока) или что-то такое
        game.settings.register(XRestrict.NAMESPACE, KEYS.MOVE_ATTRIBUTE, {
            name:           game.i18n.localize('xaro-restrict.settings.' + KEYS.MOVE_ATTRIBUTE),
            scope:          'world',
            config:         true,
            requiresReload: false,
            type:           String,
            default:        'actor.system.attributes.movement.walk',
            onChange: value => this.updateConfig(KEYS.MOVE_ATTRIBUTE, value),
        });
        game.settings.register(XRestrict.NAMESPACE, KEYS.MOVE_REQUEST, {
            name:           game.i18n.localize('xaro-restrict.settings.' + KEYS.MOVE_REQUEST),
            hint:           game.i18n.localize('xaro-restrict.hints.gm-require-permission'),
            scope:          'world',
            config:         true,
            requiresReload: false,
            type:           Boolean,
            default:        true,
            onChange: value => this.updateConfig(KEYS.MOVE_REQUEST, value),
        });
        game.settings.register(XRestrict.NAMESPACE, KEYS.MOVE_PAN, {
            name:           game.i18n.localize('xaro-restrict.settings.' + KEYS.MOVE_PAN),
            hint:           game.i18n.localize('xaro-restrict.hints.gm-only'),
            scope:          'world',
            config:         true,
            requiresReload: false,
            type:           Boolean,
            default:        true,
            onChange: value => this.updateConfig(KEYS.MOVE_PAN, value),
        });
    }
    
    static on_renderSettingsConfig(app, html, data) {
        // els
        const checkbox_doors_on = $(`input[type="checkbox"][name="${XRestrict.NAMESPACE}.${KEYS.INTERACTION_DOORS_ON}"]`);
        const inputs_doors = $(`
            input[name="${XRestrict.NAMESPACE}.${KEYS.INTERACTION_DOORS_RANGE}"]
        `);
        const wraps_range_doors = $(`.form-group[data-setting-id="${XRestrict.NAMESPACE}.${KEYS.INTERACTION_DOORS_RANGE}"]`);

        const checkbox_move_on = $(`input[type="checkbox"][name="${XRestrict.NAMESPACE}.${KEYS.MOVE_ON}"]`);
        const inputs_move = $(`
            input[name="${XRestrict.NAMESPACE}.${KEYS.MOVE_COMBAT_ONLY}"],
            input[name="${XRestrict.NAMESPACE}.${KEYS.MOVE_ATTRIBUTE}"],
            input[name="${XRestrict.NAMESPACE}.${KEYS.MOVE_REQUEST}"],
            input[name="${XRestrict.NAMESPACE}.${KEYS.MOVE_PAN}"]
        `);
        const wraps_move = $(`
            .form-group[data-setting-id="${XRestrict.NAMESPACE}.${KEYS.MOVE_COMBAT_ONLY}"],
            .form-group[data-setting-id="${XRestrict.NAMESPACE}.${KEYS.MOVE_ATTRIBUTE}"],
            .form-group[data-setting-id="${XRestrict.NAMESPACE}.${KEYS.MOVE_REQUEST}"],
            .form-group[data-setting-id="${XRestrict.NAMESPACE}.${KEYS.MOVE_PAN}"]
        `);

        // init state
        if (! checkbox_doors_on.is(":checked")) {
            inputs_doors.prop('disabled', true);
            wraps_range_doors.css('opacity', .2);
        }
        if (! checkbox_move_on.is(":checked")) {
            inputs_move.prop('disabled', true);
            wraps_move.css('opacity', .2);
        }

        // handlers
        checkbox_doors_on.on('change', event => {
            if (event.currentTarget.checked) {
                inputs_doors.prop('disabled', false);
                wraps_range_doors.css('opacity', 1);
            } else {
                inputs_doors.prop('disabled', true);
                wraps_range_doors.css('opacity', .2);
            }
        });
        checkbox_move_on.on('change', event => {
            if (event.currentTarget.checked) {
                inputs_move.prop('disabled', false);
                wraps_move.css('opacity', 1);
            } else {
                inputs_move.prop('disabled', true);
                wraps_move.css('opacity', .2);
            }
        });

        // captions
        $('<div>').addClass('form-group group-header')
            .html(game.i18n.localize('xaro-restrict.titles.doors'))
            .insertBefore(checkbox_doors_on.parents('div.form-group:first'));
        $('<div>').addClass('form-group group-header')
            .html(game.i18n.localize('xaro-restrict.titles.restrict-move'))
            .insertBefore(checkbox_move_on.parents('div.form-group:first'));
    }

    async on_ready() {
        game.socket.on(`module.${XRestrict.NAMESPACE}`, data => {
            if (data.type === KEYS.MOVE_REQUEST) {
                if (game.user.isGM) {
                    console.log(data);
                    
                    if (XRestrict.config[KEYS.MOVE_REQUEST]) {
                        const [rect, cb] = this.createHighlightedSquare({
                            origin:     data.destination,
                            distance:   data.distance,
                        });

                        if (XRestrict.config[KEYS.MOVE_PAN]) {
                            canvas.pan(Object.assign({}, data.snapDestination, { scale: 0.5 }));
                        }

                        new Dialog({
                            title: game.i18n.localize('xaro-restrict.titles.player-move-request'),
                            content: game.i18n.format('xaro-restrict.contents.player-moves', {
                                name:           game.users.get(data.sender).name,
                                beforeDistance: data.distance - data.lastDistance,
                                lastDistance:   data.lastDistance,
                                distance:       data.distance
                            }),
                            buttons: {
                                one: {
                                    label: game.i18n.localize('xaro-restrict.yes'),
                                    callback: () => {
                                        this.removeRect(rect, cb);
                                        const token = canvas.tokens.get(data.tokenId);
                                        if (token) {
                                            // console.log(token);
                                            token.document.update(data.destination).then(() => {
                                                game.socket.emit(`module.${XRestrict.NAMESPACE}`, {
                                                    // sender: game.user.id,
                                                    target: data.sender,
                                                    type:   KEYS.MOVE_REQUEST,
                                                    success: true,
                                                });
                                                ui.notifications.notify(game.i18n.format(
                                                    'xaro-restrict.notifications.gm-moved-token',
                                                    { name: game.users.get(data.sender).name }
                                                ));
                                            });
                                        } else {
                                            ui.notifications.error(game.i18n.localize('xaro-restrict.notifications.token-not-found'));
                                        }
                                    },
                                },
                                two: {
                                    label: game.i18n.localize('xaro-restrict.no'),
                                    callback: () => {
                                        this.removeRect(rect, cb);
                                        game.socket.emit(`module.${XRestrict.NAMESPACE}`, {
                                            target:     data.sender,
                                            type:       KEYS.MOVE_REQUEST,
                                            success:    false,
                                        });
                                    }
                                }
                            },
                            render: html => {
                                console.log(html);
                                html.parent().prev().find('.close').css('display', 'none');
                                $('<button class="dialog-button two">').html(game.i18n.localize('xaro-restrict.buttons.pan-destination')).on('click', () => {
                                    canvas.pan(Object.assign({}, data.snapDestination, { scale: 0.5 }));
                                }).prependTo(html[2]);
                            }
                        }).render(true, {
                            // top: (window.innerHeight / 2) + 100
                            top: 100,
                        });
                    } else {
                        const token = canvas.tokens.get(data.tokenId);

                        if (token) {
                            // console.log(token);
                            token.document.update(data.destination).then(() => {
                                game.socket.emit(`module.${XRestrict.NAMESPACE}`, {
                                    target:     data.sender,
                                    type:       KEYS.MOVE_REQUEST,
                                    success:    true,
                                });
                                ui.notifications.notify(game.i18n.format(
                                    'xaro-restrict.notifications.player-exceeded-speed',
                                    { name: game.users.get(data.sender).name }
                                ));
                            });
                        } else {
                            game.socket.emit(`module.${XRestrict.NAMESPACE}`, {
                                target:     data.sender,
                                type:       KEYS.MOVE_REQUEST,
                                success:    true,
                            });
                            ui.notifications.error('Токен для обновления не найден');
                        }
                    }
                } else if (data.target === game.user.id) {
                    this.removeRect(this._rect, this._cb);
                    this._rect = this._cb = undefined;
                    this._await = false;
                    if (data.success) {
                        ui.notifications.notify(game.i18n.localize(
                            'xaro-restrict.notifications.' + 
                            (XRestrict.config[KEYS.MOVE_REQUEST] ? 'allowed-to-move' : 'success-moved')
                        ));
                    } else {
                        ui.notifications.error(game.i18n.localize('xaro-restrict.no'));
                    }
                }
            }
        });
    }

    async on_preUpdateToken(token, update, scene, userId) {
        console.log(token, update, scene, userId);

        if (
            !XRestrict.config[KEYS.MOVE_ON] ||
            game.user.isGM ||
            (XRestrict.config[KEYS.MOVE_COMBAT_ONLY] && (!game.combat || !game.combat.started))
        ) {
            return true;
        }

        if (!Number.isNumeric(update.x) && !Number.isNumeric(update.y)) return true;

        if (game.combat !== null && token._id !== game.combat.current.tokenId) {
            delete update.x;
            delete update.y;
            ui.notifications.error(game.i18n.localize('xaro-restrict.notifications.not-your-turn'));
            return true;
        }

        if (this._await) {
            delete update.x;
            delete update.y;
            ui.notifications.error(game.i18n.localize('xaro-restrict.notifications.await'));
            return true;
        }

        const _x = Number.isNumeric(update.x) ? update.x : token.x;
        const _y = Number.isNumeric(update.y) ? update.y : token.y;

        const hW = canvas.grid.grid.w / 2;
        const hH = canvas.grid.grid.h / 2;

        const currentSegment = {
            x: token.x + hW,
            y: token.y + hH,
            isPrevious: true,
        };

        const snapDestination = {
            x: _x + hW,
            y: _y + hH,
        }

        const distance = this.getComputedDistance(currentSegment, snapDestination, game.combat === null);

        console.log('distance, ft', distance);

        // if (distance > game.combat.combatant.token.actor.system.attributes.movement.walk) {

        let speedAttribute = Number.parseFloat(deepValue(token, XRestrict.config[KEYS.MOVE_ATTRIBUTE]));
        if (Number.isNaN(speedAttribute)) {
            speedAttribute = 30;
            ui.notifications.warning(game.i18n.localize('xaro-restrict.notifications.invalid-speed-attr'));
        }

        if (distance > speedAttribute) {
            this._await = true;

            const destination = {
                x: _x,
                y: _y,
            };

            const [ rect, cb ] = this.createHighlightedSquare({
                origin: destination,
                distance,
            });
            this._rect = rect;
            this._cb = cb;

            const lastDistance = game.combat === null
                ? distance
                : canvas.grid.measureDistance(
                    currentSegment,
                    snapDestination,
                    { ignoreGrid: false, gridSpaces: true }
                );
            console.log('last distance, ft', lastDistance);

            new Dialog({
                title: game.i18n.localize('xaro-restrict.titles.you-exceeded-speed'),
                content: '<p>' + game.i18n.localize(
                    'xaro-restrict.contents.' +
                    (XRestrict.config[KEYS.MOVE_REQUEST] ? 'gm-move-request' : 'move-request')
                ) + '</p>',
                buttons: {
                    yes: {
                        label: game.i18n.localize('xaro-restrict.yes'),
                        callback: () => {
                            game.socket.emit(`module.${XRestrict.NAMESPACE}`, {
                                target:     game.users.activeGM.id,
                                type:       KEYS.MOVE_REQUEST,
                                tokenId:    token.id,
                                sender:     game.user.id,
                                destination,
                                snapDestination,
                                distance,
                                lastDistance,
                            });
                            ui.notifications.info(game.i18n.localize('xaro-restrict.notifications.wait-gm-response'));
                        }
                    },
                    no: {
                        label: game.i18n.localize('xaro-restrict.no'),
                        callback: () => {
                            this._await = false;
                            this.removeRect(rect, cb);
                        }
                    }
                },
                render: html => html.parent().prev().find('.close').css('display', 'none')
            }).render(true, {
                top: 100,
            });

            delete update.x;
            delete update.y;
        }
    }

    async on_preUpdateWall(wall, update, options, userId) {
        // console.log(wall, update, options, userId);

        // Проверка на то, заблокирована дверь или нет не нужна
        // Хук просто не триггерит в таком случае

        if (XRestrict.config[KEYS.INTERACTION_DOORS_ON] && !game.user.isGM && wall.door === 1 && 'ds' in update) {
            const tokens = canvas.tokens.controlled;
            const maxRange = XRestrict.config[KEYS.INTERACTION_DOORS_RANGE];
            const measureOptions = {
                ignoreGrid: true,
                gridSpaces: false
            };

            let ok = false;

            // Поиск токена подконтрольного игроку, который стоит на расстоянии открытия двери
            tokens_loop:
            for (const token of tokens) {
                const tokenPos = { x: token.x, y: token.y };

                for (let i = 0; i < 4; i += 2) {
                    const d = canvas.grid.measureDistance(
                        tokenPos,
                        { x: wall.c[i], y: wall.c[i + 1] },
                        measureOptions
                    );
                    if (d < maxRange) {
                        ok = true;
                        break tokens_loop;
                    }
                }
            }

            if (! ok) {
                delete update.ds;
                ui.notifications.error(game.i18n.localize('xaro-restrict.notifications.door-range'));
            }
        }

        return true;
    }

    getComputedDistance(current, destination, oneSegment) {
        /** @var { number } */
        let totalDistance;
        const measureOptions = {
            ignoreGrid: false,
            gridSpaces: true
        };

        if (oneSegment) {
            totalDistance = canvas.grid.measureDistance(current, destination);
        } else {
            const combat = game.combat;
            const combatant = combat.combatant;
            if (combat.round > combatant.flags.dragRuler.trackedRound) {
                combatant.flags.dragRuler.passedWaypoints = [];
                combatant.flags.dragRuler.trackedRound = combat.round;
            }
            const segments = this.getMeasuredSegments(combatant.flags.dragRuler.passedWaypoints, current, destination);
            
            // console.log(segments);
            const distances = canvas.grid.measureDistances(segments, measureOptions);
            // console.log(distances);
            totalDistance = 0;
            for (let [ i, d ] of distances.entries()) {
                totalDistance += d;
                let s = segments[i];
                s.last = i === (segments.length - 1);
                s.distance = d;
            }
        }

        return totalDistance;
    }

    getMeasuredSegments(waypoints, current, destination) {
        const _waypoints = waypoints.concat([current, destination]);
        return _waypoints.reduce((segments, p1, i) => {
            if (i === 0) return segments;
            const p0 = _waypoints[i - 1];
            const ray = new Ray(p0, p1);
            if (ray.distance < 10) {
                return segments;
            }
            segments.push({ ray });
            return segments;
        }, []);
    }

    /**
     * 
     * @param { Object } options
     * @param { { x: number, y: number } } options.origin x,y origin
     * @param { number } [options.distance] distance in ft
     * @param { number } [options.color] linestyle color in hex (default: 0xffffff)
     * @returns 
     */
    createHighlightedSquare(options) {
        const hW = canvas.grid.grid.w / 2;
        const hH = canvas.grid.grid.h / 2;

        const outer = new PIXI.Container();
        canvas.stage.addChild(outer);

        const inner_rect = new PIXI.Container();
        outer.addChild(inner_rect);

        const inner_text = new PIXI.Container();
        outer.addChild(inner_text);

        const style = new PIXI.TextStyle({
            fill: "#ffffff",
            fontVariant: "small-caps",
            fontSize: 27,
        });
        const text = new PIXI.Text(`${options.distance} ft`, style);
        inner_text.addChild(text);
        window.d = text;

        const rect = new PIXI.Graphics();
        inner_rect.addChild(rect);

        rect.lineStyle(
            5,
            options.color || 0xffffff,
            1,
            .5,
            false
        );
        rect.drawRect(
            0,
            0,
            canvas.grid.grid.w,
            canvas.grid.grid.h
        );

        inner_rect.pivot.set(hW, hH);
        inner_rect.position.set(0, hH);

        inner_text.pivot.set(hW, hH);
        inner_text.position.set(0, hH);
        
        outer.pivot.set(0, hH);

        outer.position.set(
            options.origin.x + hW,
            options.origin.y + hH
        );

        window.a = outer;
        window.b = inner_rect;
        window.c = rect;

        let count = 0;
        const hPI = Math.PI / 2;
        const cb = () => {
            const abs = Math.abs( Math.sin(count) );
            const dXY = 1 + abs;
            inner_rect.scale.set(dXY, dXY);
            inner_rect.alpha = 1 - abs;
            count += .025;
            if (count > hPI) {
                count = 0;
            }
            // count = (count + .025) % (hPI + .025);
        }
        // this.tickers[userId] = cb;
        this.ticker.add(cb);
        if (! this.ticker.started) {
            this.ticker.start();
        }

        return [ outer, cb ];
    }

    removeRect(rect, cb) {
        console.log('remove rect');
        canvas.stage.removeChild(rect);
        this.ticker.remove(cb)
        if (! this.ticker.count) {
            this.ticker.stop();
        }
    }
}