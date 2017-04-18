/** vim: et:ts=4:sw=4:sts=4
 * @license RequireJS 2.3.3 Copyright jQuery Foundation and other contributors.
 * Released under MIT license, https://github.com/requirejs/requirejs/blob/master/LICENSE
 */
//Not using strict: uneven strict support in browsers, #392, and causes
//problems with requirejs.exec()/transpiler plugins that may not be strict.
/*jslint regexp: true, nomen: true, sloppy: true */
/*global window, navigator, document, importScripts, setTimeout, opera */

var requirejs, require, define;
(function (global, setTimeout) {
    var req, s, head, baseElement, dataMain, src,
        interactiveScript, currentlyAddingScript, mainScript, subPath,
        version = '2.3.3',
        commentRegExp = /\/\*[\s\S]*?\*\/|([^:"'=]|^)\/\/.*$/mg,
        cjsRequireRegExp = /[^.]\s*require\s*\(\s*["']([^'"\s]+)["']\s*\)/g,
        jsSuffixRegExp = /\.js$/,
        currDirRegExp = /^\.\//,
        op = Object.prototype,
        ostring = op.toString,
        hasOwn = op.hasOwnProperty,
        isBrowser = !!(typeof window !== 'undefined' && typeof navigator !== 'undefined' && window.document),
        isWebWorker = !isBrowser && typeof importScripts !== 'undefined',
        //PS3 indicates loaded and complete, but need to wait for complete
        //specifically. Sequence is 'loading', 'loaded', execution,
        // then 'complete'. The UA check is unfortunate, but not sure how
        //to feature test w/o causing perf issues.
        readyRegExp = isBrowser && navigator.platform === 'PLAYSTATION 3' ?
                      /^complete$/ : /^(complete|loaded)$/,
        defContextName = '_',
        //Oh the tragedy, detecting opera. See the usage of isOpera for reason.
        isOpera = typeof opera !== 'undefined' && opera.toString() === '[object Opera]',
        contexts = {},
        cfg = {},
        globalDefQueue = [],
        useInteractive = false;

    //Could match something like ')//comment', do not lose the prefix to comment.
    function commentReplace(match, singlePrefix) {
        return singlePrefix || '';
    }

    function isFunction(it) {
        return ostring.call(it) === '[object Function]';
    }

    function isArray(it) {
        return ostring.call(it) === '[object Array]';
    }

    /**
     * Helper function for iterating over an array. If the func returns
     * a true value, it will break out of the loop.
     */
    function each(ary, func) {
        if (ary) {
            var i;
            for (i = 0; i < ary.length; i += 1) {
                if (ary[i] && func(ary[i], i, ary)) {
                    break;
                }
            }
        }
    }

    /**
     * Helper function for iterating over an array backwards. If the func
     * returns a true value, it will break out of the loop.
     */
    function eachReverse(ary, func) {
        if (ary) {
            var i;
            for (i = ary.length - 1; i > -1; i -= 1) {
                if (ary[i] && func(ary[i], i, ary)) {
                    break;
                }
            }
        }
    }

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    function getOwn(obj, prop) {
        return hasProp(obj, prop) && obj[prop];
    }

    /**
     * Cycles over properties in an object and calls a function for each
     * property value. If the function returns a truthy value, then the
     * iteration is stopped.
     */
    function eachProp(obj, func) {
        var prop;
        for (prop in obj) {
            if (hasProp(obj, prop)) {
                if (func(obj[prop], prop)) {
                    break;
                }
            }
        }
    }

    /**
     * Simple function to mix in properties from source into target,
     * but only if target does not already have a property of the same name.
     */
    function mixin(target, source, force, deepStringMixin) {
        if (source) {
            eachProp(source, function (value, prop) {
                if (force || !hasProp(target, prop)) {
                    if (deepStringMixin && typeof value === 'object' && value &&
                        !isArray(value) && !isFunction(value) &&
                        !(value instanceof RegExp)) {

                        if (!target[prop]) {
                            target[prop] = {};
                        }
                        mixin(target[prop], value, force, deepStringMixin);
                    } else {
                        target[prop] = value;
                    }
                }
            });
        }
        return target;
    }

    //Similar to Function.prototype.bind, but the 'this' object is specified
    //first, since it is easier to read/figure out what 'this' will be.
    function bind(obj, fn) {
        return function () {
            return fn.apply(obj, arguments);
        };
    }

    function scripts() {
        return document.getElementsByTagName('script');
    }

    function defaultOnError(err) {
        throw err;
    }

    //Allow getting a global that is expressed in
    //dot notation, like 'a.b.c'.
    function getGlobal(value) {
        if (!value) {
            return value;
        }
        var g = global;
        each(value.split('.'), function (part) {
            g = g[part];
        });
        return g;
    }

    /**
     * Constructs an error with a pointer to an URL with more information.
     * @param {String} id the error ID that maps to an ID on a web page.
     * @param {String} message human readable error.
     * @param {Error} [err] the original error, if there is one.
     *
     * @returns {Error}
     */
    function makeError(id, msg, err, requireModules) {
        var e = new Error(msg + '\nhttp://requirejs.org/docs/errors.html#' + id);
        e.requireType = id;
        e.requireModules = requireModules;
        if (err) {
            e.originalError = err;
        }
        return e;
    }

    if (typeof define !== 'undefined') {
        //If a define is already in play via another AMD loader,
        //do not overwrite.
        return;
    }

    if (typeof requirejs !== 'undefined') {
        if (isFunction(requirejs)) {
            //Do not overwrite an existing requirejs instance.
            return;
        }
        cfg = requirejs;
        requirejs = undefined;
    }

    //Allow for a require config object
    if (typeof require !== 'undefined' && !isFunction(require)) {
        //assume it is a config object.
        cfg = require;
        require = undefined;
    }

    function newContext(contextName) {
        var inCheckLoaded, Module, context, handlers,
            checkLoadedTimeoutId,
            config = {
                //Defaults. Do not set a default for map
                //config to speed up normalize(), which
                //will run faster if there is no default.
                waitSeconds: 7,
                baseUrl: './',
                paths: {},
                bundles: {},
                pkgs: {},
                shim: {},
                config: {}
            },
            registry = {},
            //registry of just enabled modules, to speed
            //cycle breaking code when lots of modules
            //are registered, but not activated.
            enabledRegistry = {},
            undefEvents = {},
            defQueue = [],
            defined = {},
            urlFetched = {},
            bundlesMap = {},
            requireCounter = 1,
            unnormalizedCounter = 1;

        /**
         * Trims the . and .. from an array of path segments.
         * It will keep a leading path segment if a .. will become
         * the first path segment, to help with module name lookups,
         * which act like paths, but can be remapped. But the end result,
         * all paths that use this function should look normalized.
         * NOTE: this method MODIFIES the input array.
         * @param {Array} ary the array of path segments.
         */
        function trimDots(ary) {
            var i, part;
            for (i = 0; i < ary.length; i++) {
                part = ary[i];
                if (part === '.') {
                    ary.splice(i, 1);
                    i -= 1;
                } else if (part === '..') {
                    // If at the start, or previous value is still ..,
                    // keep them so that when converted to a path it may
                    // still work when converted to a path, even though
                    // as an ID it is less than ideal. In larger point
                    // releases, may be better to just kick out an error.
                    if (i === 0 || (i === 1 && ary[2] === '..') || ary[i - 1] === '..') {
                        continue;
                    } else if (i > 0) {
                        ary.splice(i - 1, 2);
                        i -= 2;
                    }
                }
            }
        }

        /**
         * Given a relative module name, like ./something, normalize it to
         * a real name that can be mapped to a path.
         * @param {String} name the relative name
         * @param {String} baseName a real name that the name arg is relative
         * to.
         * @param {Boolean} applyMap apply the map config to the value. Should
         * only be done if this normalization is for a dependency ID.
         * @returns {String} normalized name
         */
        function normalize(name, baseName, applyMap) {
            var pkgMain, mapValue, nameParts, i, j, nameSegment, lastIndex,
                foundMap, foundI, foundStarMap, starI, normalizedBaseParts,
                baseParts = (baseName && baseName.split('/')),
                map = config.map,
                starMap = map && map['*'];

            //Adjust any relative paths.
            if (name) {
                name = name.split('/');
                lastIndex = name.length - 1;

                // If wanting node ID compatibility, strip .js from end
                // of IDs. Have to do this here, and not in nameToUrl
                // because node allows either .js or non .js to map
                // to same file.
                if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                    name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                }

                // Starts with a '.' so need the baseName
                if (name[0].charAt(0) === '.' && baseParts) {
                    //Convert baseName to array, and lop off the last part,
                    //so that . matches that 'directory' and not name of the baseName's
                    //module. For instance, baseName of 'one/two/three', maps to
                    //'one/two/three.js', but we want the directory, 'one/two' for
                    //this normalization.
                    normalizedBaseParts = baseParts.slice(0, baseParts.length - 1);
                    name = normalizedBaseParts.concat(name);
                }

                trimDots(name);
                name = name.join('/');
            }

            //Apply map config if available.
            if (applyMap && map && (baseParts || starMap)) {
                nameParts = name.split('/');

                outerLoop: for (i = nameParts.length; i > 0; i -= 1) {
                    nameSegment = nameParts.slice(0, i).join('/');

                    if (baseParts) {
                        //Find the longest baseName segment match in the config.
                        //So, do joins on the biggest to smallest lengths of baseParts.
                        for (j = baseParts.length; j > 0; j -= 1) {
                            mapValue = getOwn(map, baseParts.slice(0, j).join('/'));

                            //baseName segment has config, find if it has one for
                            //this name.
                            if (mapValue) {
                                mapValue = getOwn(mapValue, nameSegment);
                                if (mapValue) {
                                    //Match, update name to the new value.
                                    foundMap = mapValue;
                                    foundI = i;
                                    break outerLoop;
                                }
                            }
                        }
                    }

                    //Check for a star map match, but just hold on to it,
                    //if there is a shorter segment match later in a matching
                    //config, then favor over this star map.
                    if (!foundStarMap && starMap && getOwn(starMap, nameSegment)) {
                        foundStarMap = getOwn(starMap, nameSegment);
                        starI = i;
                    }
                }

                if (!foundMap && foundStarMap) {
                    foundMap = foundStarMap;
                    foundI = starI;
                }

                if (foundMap) {
                    nameParts.splice(0, foundI, foundMap);
                    name = nameParts.join('/');
                }
            }

            // If the name points to a package's name, use
            // the package main instead.
            pkgMain = getOwn(config.pkgs, name);

            return pkgMain ? pkgMain : name;
        }

        function removeScript(name) {
            if (isBrowser) {
                each(scripts(), function (scriptNode) {
                    if (scriptNode.getAttribute('data-requiremodule') === name &&
                            scriptNode.getAttribute('data-requirecontext') === context.contextName) {
                        scriptNode.parentNode.removeChild(scriptNode);
                        return true;
                    }
                });
            }
        }

        function hasPathFallback(id) {
            var pathConfig = getOwn(config.paths, id);
            if (pathConfig && isArray(pathConfig) && pathConfig.length > 1) {
                //Pop off the first array value, since it failed, and
                //retry
                pathConfig.shift();
                context.require.undef(id);

                //Custom require that does not do map translation, since
                //ID is "absolute", already mapped/resolved.
                context.makeRequire(null, {
                    skipMap: true
                })([id]);

                return true;
            }
        }

        //Turns a plugin!resource to [plugin, resource]
        //with the plugin being undefined if the name
        //did not have a plugin prefix.
        function splitPrefix(name) {
            var prefix,
                index = name ? name.indexOf('!') : -1;
            if (index > -1) {
                prefix = name.substring(0, index);
                name = name.substring(index + 1, name.length);
            }
            return [prefix, name];
        }

        /**
         * Creates a module mapping that includes plugin prefix, module
         * name, and path. If parentModuleMap is provided it will
         * also normalize the name via require.normalize()
         *
         * @param {String} name the module name
         * @param {String} [parentModuleMap] parent module map
         * for the module name, used to resolve relative names.
         * @param {Boolean} isNormalized: is the ID already normalized.
         * This is true if this call is done for a define() module ID.
         * @param {Boolean} applyMap: apply the map config to the ID.
         * Should only be true if this map is for a dependency.
         *
         * @returns {Object}
         */
        function makeModuleMap(name, parentModuleMap, isNormalized, applyMap) {
            var url, pluginModule, suffix, nameParts,
                prefix = null,
                parentName = parentModuleMap ? parentModuleMap.name : null,
                originalName = name,
                isDefine = true,
                normalizedName = '';

            //If no name, then it means it is a require call, generate an
            //internal name.
            if (!name) {
                isDefine = false;
                name = '_@r' + (requireCounter += 1);
            }

            nameParts = splitPrefix(name);
            prefix = nameParts[0];
            name = nameParts[1];

            if (prefix) {
                prefix = normalize(prefix, parentName, applyMap);
                pluginModule = getOwn(defined, prefix);
            }

            //Account for relative paths if there is a base name.
            if (name) {
                if (prefix) {
                    if (isNormalized) {
                        normalizedName = name;
                    } else if (pluginModule && pluginModule.normalize) {
                        //Plugin is loaded, use its normalize method.
                        normalizedName = pluginModule.normalize(name, function (name) {
                            return normalize(name, parentName, applyMap);
                        });
                    } else {
                        // If nested plugin references, then do not try to
                        // normalize, as it will not normalize correctly. This
                        // places a restriction on resourceIds, and the longer
                        // term solution is not to normalize until plugins are
                        // loaded and all normalizations to allow for async
                        // loading of a loader plugin. But for now, fixes the
                        // common uses. Details in #1131
                        normalizedName = name.indexOf('!') === -1 ?
                                         normalize(name, parentName, applyMap) :
                                         name;
                    }
                } else {
                    //A regular module.
                    normalizedName = normalize(name, parentName, applyMap);

                    //Normalized name may be a plugin ID due to map config
                    //application in normalize. The map config values must
                    //already be normalized, so do not need to redo that part.
                    nameParts = splitPrefix(normalizedName);
                    prefix = nameParts[0];
                    normalizedName = nameParts[1];
                    isNormalized = true;

                    url = context.nameToUrl(normalizedName);
                }
            }

            //If the id is a plugin id that cannot be determined if it needs
            //normalization, stamp it with a unique ID so two matching relative
            //ids that may conflict can be separate.
            suffix = prefix && !pluginModule && !isNormalized ?
                     '_unnormalized' + (unnormalizedCounter += 1) :
                     '';

            return {
                prefix: prefix,
                name: normalizedName,
                parentMap: parentModuleMap,
                unnormalized: !!suffix,
                url: url,
                originalName: originalName,
                isDefine: isDefine,
                id: (prefix ?
                        prefix + '!' + normalizedName :
                        normalizedName) + suffix
            };
        }

        function getModule(depMap) {
            var id = depMap.id,
                mod = getOwn(registry, id);

            if (!mod) {
                mod = registry[id] = new context.Module(depMap);
            }

            return mod;
        }

        function on(depMap, name, fn) {
            var id = depMap.id,
                mod = getOwn(registry, id);

            if (hasProp(defined, id) &&
                    (!mod || mod.defineEmitComplete)) {
                if (name === 'defined') {
                    fn(defined[id]);
                }
            } else {
                mod = getModule(depMap);
                if (mod.error && name === 'error') {
                    fn(mod.error);
                } else {
                    mod.on(name, fn);
                }
            }
        }

        function onError(err, errback) {
            var ids = err.requireModules,
                notified = false;

            if (errback) {
                errback(err);
            } else {
                each(ids, function (id) {
                    var mod = getOwn(registry, id);
                    if (mod) {
                        //Set error on module, so it skips timeout checks.
                        mod.error = err;
                        if (mod.events.error) {
                            notified = true;
                            mod.emit('error', err);
                        }
                    }
                });

                if (!notified) {
                    req.onError(err);
                }
            }
        }

        /**
         * Internal method to transfer globalQueue items to this context's
         * defQueue.
         */
        function takeGlobalQueue() {
            //Push all the globalDefQueue items into the context's defQueue
            if (globalDefQueue.length) {
                each(globalDefQueue, function(queueItem) {
                    var id = queueItem[0];
                    if (typeof id === 'string') {
                        context.defQueueMap[id] = true;
                    }
                    defQueue.push(queueItem);
                });
                globalDefQueue = [];
            }
        }

        handlers = {
            'require': function (mod) {
                if (mod.require) {
                    return mod.require;
                } else {
                    return (mod.require = context.makeRequire(mod.map));
                }
            },
            'exports': function (mod) {
                mod.usingExports = true;
                if (mod.map.isDefine) {
                    if (mod.exports) {
                        return (defined[mod.map.id] = mod.exports);
                    } else {
                        return (mod.exports = defined[mod.map.id] = {});
                    }
                }
            },
            'module': function (mod) {
                if (mod.module) {
                    return mod.module;
                } else {
                    return (mod.module = {
                        id: mod.map.id,
                        uri: mod.map.url,
                        config: function () {
                            return getOwn(config.config, mod.map.id) || {};
                        },
                        exports: mod.exports || (mod.exports = {})
                    });
                }
            }
        };

        function cleanRegistry(id) {
            //Clean up machinery used for waiting modules.
            delete registry[id];
            delete enabledRegistry[id];
        }

        function breakCycle(mod, traced, processed) {
            var id = mod.map.id;

            if (mod.error) {
                mod.emit('error', mod.error);
            } else {
                traced[id] = true;
                each(mod.depMaps, function (depMap, i) {
                    var depId = depMap.id,
                        dep = getOwn(registry, depId);

                    //Only force things that have not completed
                    //being defined, so still in the registry,
                    //and only if it has not been matched up
                    //in the module already.
                    if (dep && !mod.depMatched[i] && !processed[depId]) {
                        if (getOwn(traced, depId)) {
                            mod.defineDep(i, defined[depId]);
                            mod.check(); //pass false?
                        } else {
                            breakCycle(dep, traced, processed);
                        }
                    }
                });
                processed[id] = true;
            }
        }

        function checkLoaded() {
            var err, usingPathFallback,
                waitInterval = config.waitSeconds * 1000,
                //It is possible to disable the wait interval by using waitSeconds of 0.
                expired = waitInterval && (context.startTime + waitInterval) < new Date().getTime(),
                noLoads = [],
                reqCalls = [],
                stillLoading = false,
                needCycleCheck = true;

            //Do not bother if this call was a result of a cycle break.
            if (inCheckLoaded) {
                return;
            }

            inCheckLoaded = true;

            //Figure out the state of all the modules.
            eachProp(enabledRegistry, function (mod) {
                var map = mod.map,
                    modId = map.id;

                //Skip things that are not enabled or in error state.
                if (!mod.enabled) {
                    return;
                }

                if (!map.isDefine) {
                    reqCalls.push(mod);
                }

                if (!mod.error) {
                    //If the module should be executed, and it has not
                    //been inited and time is up, remember it.
                    if (!mod.inited && expired) {
                        if (hasPathFallback(modId)) {
                            usingPathFallback = true;
                            stillLoading = true;
                        } else {
                            noLoads.push(modId);
                            removeScript(modId);
                        }
                    } else if (!mod.inited && mod.fetched && map.isDefine) {
                        stillLoading = true;
                        if (!map.prefix) {
                            //No reason to keep looking for unfinished
                            //loading. If the only stillLoading is a
                            //plugin resource though, keep going,
                            //because it may be that a plugin resource
                            //is waiting on a non-plugin cycle.
                            return (needCycleCheck = false);
                        }
                    }
                }
            });

            if (expired && noLoads.length) {
                //If wait time expired, throw error of unloaded modules.
                err = makeError('timeout', 'Load timeout for modules: ' + noLoads, null, noLoads);
                err.contextName = context.contextName;
                return onError(err);
            }

            //Not expired, check for a cycle.
            if (needCycleCheck) {
                each(reqCalls, function (mod) {
                    breakCycle(mod, {}, {});
                });
            }

            //If still waiting on loads, and the waiting load is something
            //other than a plugin resource, or there are still outstanding
            //scripts, then just try back later.
            if ((!expired || usingPathFallback) && stillLoading) {
                //Something is still waiting to load. Wait for it, but only
                //if a timeout is not already in effect.
                if ((isBrowser || isWebWorker) && !checkLoadedTimeoutId) {
                    checkLoadedTimeoutId = setTimeout(function () {
                        checkLoadedTimeoutId = 0;
                        checkLoaded();
                    }, 50);
                }
            }

            inCheckLoaded = false;
        }

        Module = function (map) {
            this.events = getOwn(undefEvents, map.id) || {};
            this.map = map;
            this.shim = getOwn(config.shim, map.id);
            this.depExports = [];
            this.depMaps = [];
            this.depMatched = [];
            this.pluginMaps = {};
            this.depCount = 0;

            /* this.exports this.factory
               this.depMaps = [],
               this.enabled, this.fetched
            */
        };

        Module.prototype = {
            init: function (depMaps, factory, errback, options) {
                options = options || {};

                //Do not do more inits if already done. Can happen if there
                //are multiple define calls for the same module. That is not
                //a normal, common case, but it is also not unexpected.
                if (this.inited) {
                    return;
                }

                this.factory = factory;

                if (errback) {
                    //Register for errors on this module.
                    this.on('error', errback);
                } else if (this.events.error) {
                    //If no errback already, but there are error listeners
                    //on this module, set up an errback to pass to the deps.
                    errback = bind(this, function (err) {
                        this.emit('error', err);
                    });
                }

                //Do a copy of the dependency array, so that
                //source inputs are not modified. For example
                //"shim" deps are passed in here directly, and
                //doing a direct modification of the depMaps array
                //would affect that config.
                this.depMaps = depMaps && depMaps.slice(0);

                this.errback = errback;

                //Indicate this module has be initialized
                this.inited = true;

                this.ignore = options.ignore;

                //Could have option to init this module in enabled mode,
                //or could have been previously marked as enabled. However,
                //the dependencies are not known until init is called. So
                //if enabled previously, now trigger dependencies as enabled.
                if (options.enabled || this.enabled) {
                    //Enable this module and dependencies.
                    //Will call this.check()
                    this.enable();
                } else {
                    this.check();
                }
            },

            defineDep: function (i, depExports) {
                //Because of cycles, defined callback for a given
                //export can be called more than once.
                if (!this.depMatched[i]) {
                    this.depMatched[i] = true;
                    this.depCount -= 1;
                    this.depExports[i] = depExports;
                }
            },

            fetch: function () {
                if (this.fetched) {
                    return;
                }
                this.fetched = true;

                context.startTime = (new Date()).getTime();

                var map = this.map;

                //If the manager is for a plugin managed resource,
                //ask the plugin to load it now.
                if (this.shim) {
                    context.makeRequire(this.map, {
                        enableBuildCallback: true
                    })(this.shim.deps || [], bind(this, function () {
                        return map.prefix ? this.callPlugin() : this.load();
                    }));
                } else {
                    //Regular dependency.
                    return map.prefix ? this.callPlugin() : this.load();
                }
            },

            load: function () {
                var url = this.map.url;

                //Regular dependency.
                if (!urlFetched[url]) {
                    urlFetched[url] = true;
                    context.load(this.map.id, url);
                }
            },

            /**
             * Checks if the module is ready to define itself, and if so,
             * define it.
             */
            check: function () {
                if (!this.enabled || this.enabling) {
                    return;
                }

                var err, cjsModule,
                    id = this.map.id,
                    depExports = this.depExports,
                    exports = this.exports,
                    factory = this.factory;

                if (!this.inited) {
                    // Only fetch if not already in the defQueue.
                    if (!hasProp(context.defQueueMap, id)) {
                        this.fetch();
                    }
                } else if (this.error) {
                    this.emit('error', this.error);
                } else if (!this.defining) {
                    //The factory could trigger another require call
                    //that would result in checking this module to
                    //define itself again. If already in the process
                    //of doing that, skip this work.
                    this.defining = true;

                    if (this.depCount < 1 && !this.defined) {
                        if (isFunction(factory)) {
                            //If there is an error listener, favor passing
                            //to that instead of throwing an error. However,
                            //only do it for define()'d  modules. require
                            //errbacks should not be called for failures in
                            //their callbacks (#699). However if a global
                            //onError is set, use that.
                            if ((this.events.error && this.map.isDefine) ||
                                req.onError !== defaultOnError) {
                                try {
                                    exports = context.execCb(id, factory, depExports, exports);
                                } catch (e) {
                                    err = e;
                                }
                            } else {
                                exports = context.execCb(id, factory, depExports, exports);
                            }

                            // Favor return value over exports. If node/cjs in play,
                            // then will not have a return value anyway. Favor
                            // module.exports assignment over exports object.
                            if (this.map.isDefine && exports === undefined) {
                                cjsModule = this.module;
                                if (cjsModule) {
                                    exports = cjsModule.exports;
                                } else if (this.usingExports) {
                                    //exports already set the defined value.
                                    exports = this.exports;
                                }
                            }

                            if (err) {
                                err.requireMap = this.map;
                                err.requireModules = this.map.isDefine ? [this.map.id] : null;
                                err.requireType = this.map.isDefine ? 'define' : 'require';
                                return onError((this.error = err));
                            }

                        } else {
                            //Just a literal value
                            exports = factory;
                        }

                        this.exports = exports;

                        if (this.map.isDefine && !this.ignore) {
                            defined[id] = exports;

                            if (req.onResourceLoad) {
                                var resLoadMaps = [];
                                each(this.depMaps, function (depMap) {
                                    resLoadMaps.push(depMap.normalizedMap || depMap);
                                });
                                req.onResourceLoad(context, this.map, resLoadMaps);
                            }
                        }

                        //Clean up
                        cleanRegistry(id);

                        this.defined = true;
                    }

                    //Finished the define stage. Allow calling check again
                    //to allow define notifications below in the case of a
                    //cycle.
                    this.defining = false;

                    if (this.defined && !this.defineEmitted) {
                        this.defineEmitted = true;
                        this.emit('defined', this.exports);
                        this.defineEmitComplete = true;
                    }

                }
            },

            callPlugin: function () {
                var map = this.map,
                    id = map.id,
                    //Map already normalized the prefix.
                    pluginMap = makeModuleMap(map.prefix);

                //Mark this as a dependency for this plugin, so it
                //can be traced for cycles.
                this.depMaps.push(pluginMap);

                on(pluginMap, 'defined', bind(this, function (plugin) {
                    var load, normalizedMap, normalizedMod,
                        bundleId = getOwn(bundlesMap, this.map.id),
                        name = this.map.name,
                        parentName = this.map.parentMap ? this.map.parentMap.name : null,
                        localRequire = context.makeRequire(map.parentMap, {
                            enableBuildCallback: true
                        });

                    //If current map is not normalized, wait for that
                    //normalized name to load instead of continuing.
                    if (this.map.unnormalized) {
                        //Normalize the ID if the plugin allows it.
                        if (plugin.normalize) {
                            name = plugin.normalize(name, function (name) {
                                return normalize(name, parentName, true);
                            }) || '';
                        }

                        //prefix and name should already be normalized, no need
                        //for applying map config again either.
                        normalizedMap = makeModuleMap(map.prefix + '!' + name,
                                                      this.map.parentMap,
                                                      true);
                        on(normalizedMap,
                            'defined', bind(this, function (value) {
                                this.map.normalizedMap = normalizedMap;
                                this.init([], function () { return value; }, null, {
                                    enabled: true,
                                    ignore: true
                                });
                            }));

                        normalizedMod = getOwn(registry, normalizedMap.id);
                        if (normalizedMod) {
                            //Mark this as a dependency for this plugin, so it
                            //can be traced for cycles.
                            this.depMaps.push(normalizedMap);

                            if (this.events.error) {
                                normalizedMod.on('error', bind(this, function (err) {
                                    this.emit('error', err);
                                }));
                            }
                            normalizedMod.enable();
                        }

                        return;
                    }

                    //If a paths config, then just load that file instead to
                    //resolve the plugin, as it is built into that paths layer.
                    if (bundleId) {
                        this.map.url = context.nameToUrl(bundleId);
                        this.load();
                        return;
                    }

                    load = bind(this, function (value) {
                        this.init([], function () { return value; }, null, {
                            enabled: true
                        });
                    });

                    load.error = bind(this, function (err) {
                        this.inited = true;
                        this.error = err;
                        err.requireModules = [id];

                        //Remove temp unnormalized modules for this module,
                        //since they will never be resolved otherwise now.
                        eachProp(registry, function (mod) {
                            if (mod.map.id.indexOf(id + '_unnormalized') === 0) {
                                cleanRegistry(mod.map.id);
                            }
                        });

                        onError(err);
                    });

                    //Allow plugins to load other code without having to know the
                    //context or how to 'complete' the load.
                    load.fromText = bind(this, function (text, textAlt) {
                        /*jslint evil: true */
                        var moduleName = map.name,
                            moduleMap = makeModuleMap(moduleName),
                            hasInteractive = useInteractive;

                        //As of 2.1.0, support just passing the text, to reinforce
                        //fromText only being called once per resource. Still
                        //support old style of passing moduleName but discard
                        //that moduleName in favor of the internal ref.
                        if (textAlt) {
                            text = textAlt;
                        }

                        //Turn off interactive script matching for IE for any define
                        //calls in the text, then turn it back on at the end.
                        if (hasInteractive) {
                            useInteractive = false;
                        }

                        //Prime the system by creating a module instance for
                        //it.
                        getModule(moduleMap);

                        //Transfer any config to this other module.
                        if (hasProp(config.config, id)) {
                            config.config[moduleName] = config.config[id];
                        }

                        try {
                            req.exec(text);
                        } catch (e) {
                            return onError(makeError('fromtexteval',
                                             'fromText eval for ' + id +
                                            ' failed: ' + e,
                                             e,
                                             [id]));
                        }

                        if (hasInteractive) {
                            useInteractive = true;
                        }

                        //Mark this as a dependency for the plugin
                        //resource
                        this.depMaps.push(moduleMap);

                        //Support anonymous modules.
                        context.completeLoad(moduleName);

                        //Bind the value of that module to the value for this
                        //resource ID.
                        localRequire([moduleName], load);
                    });

                    //Use parentName here since the plugin's name is not reliable,
                    //could be some weird string with no path that actually wants to
                    //reference the parentName's path.
                    plugin.load(map.name, localRequire, load, config);
                }));

                context.enable(pluginMap, this);
                this.pluginMaps[pluginMap.id] = pluginMap;
            },

            enable: function () {
                enabledRegistry[this.map.id] = this;
                this.enabled = true;

                //Set flag mentioning that the module is enabling,
                //so that immediate calls to the defined callbacks
                //for dependencies do not trigger inadvertent load
                //with the depCount still being zero.
                this.enabling = true;

                //Enable each dependency
                each(this.depMaps, bind(this, function (depMap, i) {
                    var id, mod, handler;

                    if (typeof depMap === 'string') {
                        //Dependency needs to be converted to a depMap
                        //and wired up to this module.
                        depMap = makeModuleMap(depMap,
                                               (this.map.isDefine ? this.map : this.map.parentMap),
                                               false,
                                               !this.skipMap);
                        this.depMaps[i] = depMap;

                        handler = getOwn(handlers, depMap.id);

                        if (handler) {
                            this.depExports[i] = handler(this);
                            return;
                        }

                        this.depCount += 1;

                        on(depMap, 'defined', bind(this, function (depExports) {
                            if (this.undefed) {
                                return;
                            }
                            this.defineDep(i, depExports);
                            this.check();
                        }));

                        if (this.errback) {
                            on(depMap, 'error', bind(this, this.errback));
                        } else if (this.events.error) {
                            // No direct errback on this module, but something
                            // else is listening for errors, so be sure to
                            // propagate the error correctly.
                            on(depMap, 'error', bind(this, function(err) {
                                this.emit('error', err);
                            }));
                        }
                    }

                    id = depMap.id;
                    mod = registry[id];

                    //Skip special modules like 'require', 'exports', 'module'
                    //Also, don't call enable if it is already enabled,
                    //important in circular dependency cases.
                    if (!hasProp(handlers, id) && mod && !mod.enabled) {
                        context.enable(depMap, this);
                    }
                }));

                //Enable each plugin that is used in
                //a dependency
                eachProp(this.pluginMaps, bind(this, function (pluginMap) {
                    var mod = getOwn(registry, pluginMap.id);
                    if (mod && !mod.enabled) {
                        context.enable(pluginMap, this);
                    }
                }));

                this.enabling = false;

                this.check();
            },

            on: function (name, cb) {
                var cbs = this.events[name];
                if (!cbs) {
                    cbs = this.events[name] = [];
                }
                cbs.push(cb);
            },

            emit: function (name, evt) {
                each(this.events[name], function (cb) {
                    cb(evt);
                });
                if (name === 'error') {
                    //Now that the error handler was triggered, remove
                    //the listeners, since this broken Module instance
                    //can stay around for a while in the registry.
                    delete this.events[name];
                }
            }
        };

        function callGetModule(args) {
            //Skip modules already defined.
            if (!hasProp(defined, args[0])) {
                getModule(makeModuleMap(args[0], null, true)).init(args[1], args[2]);
            }
        }

        function removeListener(node, func, name, ieName) {
            //Favor detachEvent because of IE9
            //issue, see attachEvent/addEventListener comment elsewhere
            //in this file.
            if (node.detachEvent && !isOpera) {
                //Probably IE. If not it will throw an error, which will be
                //useful to know.
                if (ieName) {
                    node.detachEvent(ieName, func);
                }
            } else {
                node.removeEventListener(name, func, false);
            }
        }

        /**
         * Given an event from a script node, get the requirejs info from it,
         * and then removes the event listeners on the node.
         * @param {Event} evt
         * @returns {Object}
         */
        function getScriptData(evt) {
            //Using currentTarget instead of target for Firefox 2.0's sake. Not
            //all old browsers will be supported, but this one was easy enough
            //to support and still makes sense.
            var node = evt.currentTarget || evt.srcElement;

            //Remove the listeners once here.
            removeListener(node, context.onScriptLoad, 'load', 'onreadystatechange');
            removeListener(node, context.onScriptError, 'error');

            return {
                node: node,
                id: node && node.getAttribute('data-requiremodule')
            };
        }

        function intakeDefines() {
            var args;

            //Any defined modules in the global queue, intake them now.
            takeGlobalQueue();

            //Make sure any remaining defQueue items get properly processed.
            while (defQueue.length) {
                args = defQueue.shift();
                if (args[0] === null) {
                    return onError(makeError('mismatch', 'Mismatched anonymous define() module: ' +
                        args[args.length - 1]));
                } else {
                    //args are id, deps, factory. Should be normalized by the
                    //define() function.
                    callGetModule(args);
                }
            }
            context.defQueueMap = {};
        }

        context = {
            config: config,
            contextName: contextName,
            registry: registry,
            defined: defined,
            urlFetched: urlFetched,
            defQueue: defQueue,
            defQueueMap: {},
            Module: Module,
            makeModuleMap: makeModuleMap,
            nextTick: req.nextTick,
            onError: onError,

            /**
             * Set a configuration for the context.
             * @param {Object} cfg config object to integrate.
             */
            configure: function (cfg) {
                //Make sure the baseUrl ends in a slash.
                if (cfg.baseUrl) {
                    if (cfg.baseUrl.charAt(cfg.baseUrl.length - 1) !== '/') {
                        cfg.baseUrl += '/';
                    }
                }

                // Convert old style urlArgs string to a function.
                if (typeof cfg.urlArgs === 'string') {
                    var urlArgs = cfg.urlArgs;
                    cfg.urlArgs = function(id, url) {
                        return (url.indexOf('?') === -1 ? '?' : '&') + urlArgs;
                    };
                }

                //Save off the paths since they require special processing,
                //they are additive.
                var shim = config.shim,
                    objs = {
                        paths: true,
                        bundles: true,
                        config: true,
                        map: true
                    };

                eachProp(cfg, function (value, prop) {
                    if (objs[prop]) {
                        if (!config[prop]) {
                            config[prop] = {};
                        }
                        mixin(config[prop], value, true, true);
                    } else {
                        config[prop] = value;
                    }
                });

                //Reverse map the bundles
                if (cfg.bundles) {
                    eachProp(cfg.bundles, function (value, prop) {
                        each(value, function (v) {
                            if (v !== prop) {
                                bundlesMap[v] = prop;
                            }
                        });
                    });
                }

                //Merge shim
                if (cfg.shim) {
                    eachProp(cfg.shim, function (value, id) {
                        //Normalize the structure
                        if (isArray(value)) {
                            value = {
                                deps: value
                            };
                        }
                        if ((value.exports || value.init) && !value.exportsFn) {
                            value.exportsFn = context.makeShimExports(value);
                        }
                        shim[id] = value;
                    });
                    config.shim = shim;
                }

                //Adjust packages if necessary.
                if (cfg.packages) {
                    each(cfg.packages, function (pkgObj) {
                        var location, name;

                        pkgObj = typeof pkgObj === 'string' ? {name: pkgObj} : pkgObj;

                        name = pkgObj.name;
                        location = pkgObj.location;
                        if (location) {
                            config.paths[name] = pkgObj.location;
                        }

                        //Save pointer to main module ID for pkg name.
                        //Remove leading dot in main, so main paths are normalized,
                        //and remove any trailing .js, since different package
                        //envs have different conventions: some use a module name,
                        //some use a file name.
                        config.pkgs[name] = pkgObj.name + '/' + (pkgObj.main || 'main')
                                     .replace(currDirRegExp, '')
                                     .replace(jsSuffixRegExp, '');
                    });
                }

                //If there are any "waiting to execute" modules in the registry,
                //update the maps for them, since their info, like URLs to load,
                //may have changed.
                eachProp(registry, function (mod, id) {
                    //If module already has init called, since it is too
                    //late to modify them, and ignore unnormalized ones
                    //since they are transient.
                    if (!mod.inited && !mod.map.unnormalized) {
                        mod.map = makeModuleMap(id, null, true);
                    }
                });

                //If a deps array or a config callback is specified, then call
                //require with those args. This is useful when require is defined as a
                //config object before require.js is loaded.
                if (cfg.deps || cfg.callback) {
                    context.require(cfg.deps || [], cfg.callback);
                }
            },

            makeShimExports: function (value) {
                function fn() {
                    var ret;
                    if (value.init) {
                        ret = value.init.apply(global, arguments);
                    }
                    return ret || (value.exports && getGlobal(value.exports));
                }
                return fn;
            },

            makeRequire: function (relMap, options) {
                options = options || {};

                function localRequire(deps, callback, errback) {
                    var id, map, requireMod;

                    if (options.enableBuildCallback && callback && isFunction(callback)) {
                        callback.__requireJsBuild = true;
                    }

                    if (typeof deps === 'string') {
                        if (isFunction(callback)) {
                            //Invalid call
                            return onError(makeError('requireargs', 'Invalid require call'), errback);
                        }

                        //If require|exports|module are requested, get the
                        //value for them from the special handlers. Caveat:
                        //this only works while module is being defined.
                        if (relMap && hasProp(handlers, deps)) {
                            return handlers[deps](registry[relMap.id]);
                        }

                        //Synchronous access to one module. If require.get is
                        //available (as in the Node adapter), prefer that.
                        if (req.get) {
                            return req.get(context, deps, relMap, localRequire);
                        }

                        //Normalize module name, if it contains . or ..
                        map = makeModuleMap(deps, relMap, false, true);
                        id = map.id;

                        if (!hasProp(defined, id)) {
                            return onError(makeError('notloaded', 'Module name "' +
                                        id +
                                        '" has not been loaded yet for context: ' +
                                        contextName +
                                        (relMap ? '' : '. Use require([])')));
                        }
                        return defined[id];
                    }

                    //Grab defines waiting in the global queue.
                    intakeDefines();

                    //Mark all the dependencies as needing to be loaded.
                    context.nextTick(function () {
                        //Some defines could have been added since the
                        //require call, collect them.
                        intakeDefines();

                        requireMod = getModule(makeModuleMap(null, relMap));

                        //Store if map config should be applied to this require
                        //call for dependencies.
                        requireMod.skipMap = options.skipMap;

                        requireMod.init(deps, callback, errback, {
                            enabled: true
                        });

                        checkLoaded();
                    });

                    return localRequire;
                }

                mixin(localRequire, {
                    isBrowser: isBrowser,

                    /**
                     * Converts a module name + .extension into an URL path.
                     * *Requires* the use of a module name. It does not support using
                     * plain URLs like nameToUrl.
                     */
                    toUrl: function (moduleNamePlusExt) {
                        var ext,
                            index = moduleNamePlusExt.lastIndexOf('.'),
                            segment = moduleNamePlusExt.split('/')[0],
                            isRelative = segment === '.' || segment === '..';

                        //Have a file extension alias, and it is not the
                        //dots from a relative path.
                        if (index !== -1 && (!isRelative || index > 1)) {
                            ext = moduleNamePlusExt.substring(index, moduleNamePlusExt.length);
                            moduleNamePlusExt = moduleNamePlusExt.substring(0, index);
                        }

                        return context.nameToUrl(normalize(moduleNamePlusExt,
                                                relMap && relMap.id, true), ext,  true);
                    },

                    defined: function (id) {
                        return hasProp(defined, makeModuleMap(id, relMap, false, true).id);
                    },

                    specified: function (id) {
                        id = makeModuleMap(id, relMap, false, true).id;
                        return hasProp(defined, id) || hasProp(registry, id);
                    }
                });

                //Only allow undef on top level require calls
                if (!relMap) {
                    localRequire.undef = function (id) {
                        //Bind any waiting define() calls to this context,
                        //fix for #408
                        takeGlobalQueue();

                        var map = makeModuleMap(id, relMap, true),
                            mod = getOwn(registry, id);

                        mod.undefed = true;
                        removeScript(id);

                        delete defined[id];
                        delete urlFetched[map.url];
                        delete undefEvents[id];

                        //Clean queued defines too. Go backwards
                        //in array so that the splices do not
                        //mess up the iteration.
                        eachReverse(defQueue, function(args, i) {
                            if (args[0] === id) {
                                defQueue.splice(i, 1);
                            }
                        });
                        delete context.defQueueMap[id];

                        if (mod) {
                            //Hold on to listeners in case the
                            //module will be attempted to be reloaded
                            //using a different config.
                            if (mod.events.defined) {
                                undefEvents[id] = mod.events;
                            }

                            cleanRegistry(id);
                        }
                    };
                }

                return localRequire;
            },

            /**
             * Called to enable a module if it is still in the registry
             * awaiting enablement. A second arg, parent, the parent module,
             * is passed in for context, when this method is overridden by
             * the optimizer. Not shown here to keep code compact.
             */
            enable: function (depMap) {
                var mod = getOwn(registry, depMap.id);
                if (mod) {
                    getModule(depMap).enable();
                }
            },

            /**
             * Internal method used by environment adapters to complete a load event.
             * A load event could be a script load or just a load pass from a synchronous
             * load call.
             * @param {String} moduleName the name of the module to potentially complete.
             */
            completeLoad: function (moduleName) {
                var found, args, mod,
                    shim = getOwn(config.shim, moduleName) || {},
                    shExports = shim.exports;

                takeGlobalQueue();

                while (defQueue.length) {
                    args = defQueue.shift();
                    if (args[0] === null) {
                        args[0] = moduleName;
                        //If already found an anonymous module and bound it
                        //to this name, then this is some other anon module
                        //waiting for its completeLoad to fire.
                        if (found) {
                            break;
                        }
                        found = true;
                    } else if (args[0] === moduleName) {
                        //Found matching define call for this script!
                        found = true;
                    }

                    callGetModule(args);
                }
                context.defQueueMap = {};

                //Do this after the cycle of callGetModule in case the result
                //of those calls/init calls changes the registry.
                mod = getOwn(registry, moduleName);

                if (!found && !hasProp(defined, moduleName) && mod && !mod.inited) {
                    if (config.enforceDefine && (!shExports || !getGlobal(shExports))) {
                        if (hasPathFallback(moduleName)) {
                            return;
                        } else {
                            return onError(makeError('nodefine',
                                             'No define call for ' + moduleName,
                                             null,
                                             [moduleName]));
                        }
                    } else {
                        //A script that does not call define(), so just simulate
                        //the call for it.
                        callGetModule([moduleName, (shim.deps || []), shim.exportsFn]);
                    }
                }

                checkLoaded();
            },

            /**
             * Converts a module name to a file path. Supports cases where
             * moduleName may actually be just an URL.
             * Note that it **does not** call normalize on the moduleName,
             * it is assumed to have already been normalized. This is an
             * internal API, not a public one. Use toUrl for the public API.
             */
            nameToUrl: function (moduleName, ext, skipExt) {
                var paths, syms, i, parentModule, url,
                    parentPath, bundleId,
                    pkgMain = getOwn(config.pkgs, moduleName);

                if (pkgMain) {
                    moduleName = pkgMain;
                }

                bundleId = getOwn(bundlesMap, moduleName);

                if (bundleId) {
                    return context.nameToUrl(bundleId, ext, skipExt);
                }

                //If a colon is in the URL, it indicates a protocol is used and it is just
                //an URL to a file, or if it starts with a slash, contains a query arg (i.e. ?)
                //or ends with .js, then assume the user meant to use an url and not a module id.
                //The slash is important for protocol-less URLs as well as full paths.
                if (req.jsExtRegExp.test(moduleName)) {
                    //Just a plain path, not module name lookup, so just return it.
                    //Add extension if it is included. This is a bit wonky, only non-.js things pass
                    //an extension, this method probably needs to be reworked.
                    url = moduleName + (ext || '');
                } else {
                    //A module that needs to be converted to a path.
                    paths = config.paths;

                    syms = moduleName.split('/');
                    //For each module name segment, see if there is a path
                    //registered for it. Start with most specific name
                    //and work up from it.
                    for (i = syms.length; i > 0; i -= 1) {
                        parentModule = syms.slice(0, i).join('/');

                        parentPath = getOwn(paths, parentModule);
                        if (parentPath) {
                            //If an array, it means there are a few choices,
                            //Choose the one that is desired
                            if (isArray(parentPath)) {
                                parentPath = parentPath[0];
                            }
                            syms.splice(0, i, parentPath);
                            break;
                        }
                    }

                    //Join the path parts together, then figure out if baseUrl is needed.
                    url = syms.join('/');
                    url += (ext || (/^data\:|^blob\:|\?/.test(url) || skipExt ? '' : '.js'));
                    url = (url.charAt(0) === '/' || url.match(/^[\w\+\.\-]+:/) ? '' : config.baseUrl) + url;
                }

                return config.urlArgs && !/^blob\:/.test(url) ?
                       url + config.urlArgs(moduleName, url) : url;
            },

            //Delegates to req.load. Broken out as a separate function to
            //allow overriding in the optimizer.
            load: function (id, url) {
                req.load(context, id, url);
            },

            /**
             * Executes a module callback function. Broken out as a separate function
             * solely to allow the build system to sequence the files in the built
             * layer in the right sequence.
             *
             * @private
             */
            execCb: function (name, callback, args, exports) {
                return callback.apply(exports, args);
            },

            /**
             * callback for script loads, used to check status of loading.
             *
             * @param {Event} evt the event from the browser for the script
             * that was loaded.
             */
            onScriptLoad: function (evt) {
                //Using currentTarget instead of target for Firefox 2.0's sake. Not
                //all old browsers will be supported, but this one was easy enough
                //to support and still makes sense.
                if (evt.type === 'load' ||
                        (readyRegExp.test((evt.currentTarget || evt.srcElement).readyState))) {
                    //Reset interactive script so a script node is not held onto for
                    //to long.
                    interactiveScript = null;

                    //Pull out the name of the module and the context.
                    var data = getScriptData(evt);
                    context.completeLoad(data.id);
                }
            },

            /**
             * Callback for script errors.
             */
            onScriptError: function (evt) {
                var data = getScriptData(evt);
                if (!hasPathFallback(data.id)) {
                    var parents = [];
                    eachProp(registry, function(value, key) {
                        if (key.indexOf('_@r') !== 0) {
                            each(value.depMaps, function(depMap) {
                                if (depMap.id === data.id) {
                                    parents.push(key);
                                    return true;
                                }
                            });
                        }
                    });
                    return onError(makeError('scripterror', 'Script error for "' + data.id +
                                             (parents.length ?
                                             '", needed by: ' + parents.join(', ') :
                                             '"'), evt, [data.id]));
                }
            }
        };

        context.require = context.makeRequire();
        return context;
    }

    /**
     * Main entry point.
     *
     * If the only argument to require is a string, then the module that
     * is represented by that string is fetched for the appropriate context.
     *
     * If the first argument is an array, then it will be treated as an array
     * of dependency string names to fetch. An optional function callback can
     * be specified to execute when all of those dependencies are available.
     *
     * Make a local req variable to help Caja compliance (it assumes things
     * on a require that are not standardized), and to give a short
     * name for minification/local scope use.
     */
    req = requirejs = function (deps, callback, errback, optional) {

        //Find the right context, use default
        var context, config,
            contextName = defContextName;

        // Determine if have config object in the call.
        if (!isArray(deps) && typeof deps !== 'string') {
            // deps is a config object
            config = deps;
            if (isArray(callback)) {
                // Adjust args if there are dependencies
                deps = callback;
                callback = errback;
                errback = optional;
            } else {
                deps = [];
            }
        }

        if (config && config.context) {
            contextName = config.context;
        }

        context = getOwn(contexts, contextName);
        if (!context) {
            context = contexts[contextName] = req.s.newContext(contextName);
        }

        if (config) {
            context.configure(config);
        }

        return context.require(deps, callback, errback);
    };

    /**
     * Support require.config() to make it easier to cooperate with other
     * AMD loaders on globally agreed names.
     */
    req.config = function (config) {
        return req(config);
    };

    /**
     * Execute something after the current tick
     * of the event loop. Override for other envs
     * that have a better solution than setTimeout.
     * @param  {Function} fn function to execute later.
     */
    req.nextTick = typeof setTimeout !== 'undefined' ? function (fn) {
        setTimeout(fn, 4);
    } : function (fn) { fn(); };

    /**
     * Export require as a global, but only if it does not already exist.
     */
    if (!require) {
        require = req;
    }

    req.version = version;

    //Used to filter out dependencies that are already paths.
    req.jsExtRegExp = /^\/|:|\?|\.js$/;
    req.isBrowser = isBrowser;
    s = req.s = {
        contexts: contexts,
        newContext: newContext
    };

    //Create default context.
    req({});

    //Exports some context-sensitive methods on global require.
    each([
        'toUrl',
        'undef',
        'defined',
        'specified'
    ], function (prop) {
        //Reference from contexts instead of early binding to default context,
        //so that during builds, the latest instance of the default context
        //with its config gets used.
        req[prop] = function () {
            var ctx = contexts[defContextName];
            return ctx.require[prop].apply(ctx, arguments);
        };
    });

    if (isBrowser) {
        head = s.head = document.getElementsByTagName('head')[0];
        //If BASE tag is in play, using appendChild is a problem for IE6.
        //When that browser dies, this can be removed. Details in this jQuery bug:
        //http://dev.jquery.com/ticket/2709
        baseElement = document.getElementsByTagName('base')[0];
        if (baseElement) {
            head = s.head = baseElement.parentNode;
        }
    }

    /**
     * Any errors that require explicitly generates will be passed to this
     * function. Intercept/override it if you want custom error handling.
     * @param {Error} err the error object.
     */
    req.onError = defaultOnError;

    /**
     * Creates the node for the load command. Only used in browser envs.
     */
    req.createNode = function (config, moduleName, url) {
        var node = config.xhtml ?
                document.createElementNS('http://www.w3.org/1999/xhtml', 'html:script') :
                document.createElement('script');
        node.type = config.scriptType || 'text/javascript';
        node.charset = 'utf-8';
        node.async = true;
        return node;
    };

    /**
     * Does the request to load a module for the browser case.
     * Make this a separate function to allow other environments
     * to override it.
     *
     * @param {Object} context the require context to find state.
     * @param {String} moduleName the name of the module.
     * @param {Object} url the URL to the module.
     */
    req.load = function (context, moduleName, url) {
        var config = (context && context.config) || {},
            node;
        if (isBrowser) {
            //In the browser so use a script tag
            node = req.createNode(config, moduleName, url);

            node.setAttribute('data-requirecontext', context.contextName);
            node.setAttribute('data-requiremodule', moduleName);

            //Set up load listener. Test attachEvent first because IE9 has
            //a subtle issue in its addEventListener and script onload firings
            //that do not match the behavior of all other browsers with
            //addEventListener support, which fire the onload event for a
            //script right after the script execution. See:
            //https://connect.microsoft.com/IE/feedback/details/648057/script-onload-event-is-not-fired-immediately-after-script-execution
            //UNFORTUNATELY Opera implements attachEvent but does not follow the script
            //script execution mode.
            if (node.attachEvent &&
                    //Check if node.attachEvent is artificially added by custom script or
                    //natively supported by browser
                    //read https://github.com/requirejs/requirejs/issues/187
                    //if we can NOT find [native code] then it must NOT natively supported.
                    //in IE8, node.attachEvent does not have toString()
                    //Note the test for "[native code" with no closing brace, see:
                    //https://github.com/requirejs/requirejs/issues/273
                    !(node.attachEvent.toString && node.attachEvent.toString().indexOf('[native code') < 0) &&
                    !isOpera) {
                //Probably IE. IE (at least 6-8) do not fire
                //script onload right after executing the script, so
                //we cannot tie the anonymous define call to a name.
                //However, IE reports the script as being in 'interactive'
                //readyState at the time of the define call.
                useInteractive = true;

                node.attachEvent('onreadystatechange', context.onScriptLoad);
                //It would be great to add an error handler here to catch
                //404s in IE9+. However, onreadystatechange will fire before
                //the error handler, so that does not help. If addEventListener
                //is used, then IE will fire error before load, but we cannot
                //use that pathway given the connect.microsoft.com issue
                //mentioned above about not doing the 'script execute,
                //then fire the script load event listener before execute
                //next script' that other browsers do.
                //Best hope: IE10 fixes the issues,
                //and then destroys all installs of IE 6-9.
                //node.attachEvent('onerror', context.onScriptError);
            } else {
                node.addEventListener('load', context.onScriptLoad, false);
                node.addEventListener('error', context.onScriptError, false);
            }
            node.src = url;

            //Calling onNodeCreated after all properties on the node have been
            //set, but before it is placed in the DOM.
            if (config.onNodeCreated) {
                config.onNodeCreated(node, config, moduleName, url);
            }

            //For some cache cases in IE 6-8, the script executes before the end
            //of the appendChild execution, so to tie an anonymous define
            //call to the module name (which is stored on the node), hold on
            //to a reference to this node, but clear after the DOM insertion.
            currentlyAddingScript = node;
            if (baseElement) {
                head.insertBefore(node, baseElement);
            } else {
                head.appendChild(node);
            }
            currentlyAddingScript = null;

            return node;
        } else if (isWebWorker) {
            try {
                //In a web worker, use importScripts. This is not a very
                //efficient use of importScripts, importScripts will block until
                //its script is downloaded and evaluated. However, if web workers
                //are in play, the expectation is that a build has been done so
                //that only one script needs to be loaded anyway. This may need
                //to be reevaluated if other use cases become common.

                // Post a task to the event loop to work around a bug in WebKit
                // where the worker gets garbage-collected after calling
                // importScripts(): https://webkit.org/b/153317
                setTimeout(function() {}, 0);
                importScripts(url);

                //Account for anonymous modules
                context.completeLoad(moduleName);
            } catch (e) {
                context.onError(makeError('importscripts',
                                'importScripts failed for ' +
                                    moduleName + ' at ' + url,
                                e,
                                [moduleName]));
            }
        }
    };

    function getInteractiveScript() {
        if (interactiveScript && interactiveScript.readyState === 'interactive') {
            return interactiveScript;
        }

        eachReverse(scripts(), function (script) {
            if (script.readyState === 'interactive') {
                return (interactiveScript = script);
            }
        });
        return interactiveScript;
    }

    //Look for a data-main script attribute, which could also adjust the baseUrl.
    if (isBrowser && !cfg.skipDataMain) {
        //Figure out baseUrl. Get it from the script tag with require.js in it.
        eachReverse(scripts(), function (script) {
            //Set the 'head' where we can append children by
            //using the script's parent.
            if (!head) {
                head = script.parentNode;
            }

            //Look for a data-main attribute to set main script for the page
            //to load. If it is there, the path to data main becomes the
            //baseUrl, if it is not already set.
            dataMain = script.getAttribute('data-main');
            if (dataMain) {
                //Preserve dataMain in case it is a path (i.e. contains '?')
                mainScript = dataMain;

                //Set final baseUrl if there is not already an explicit one,
                //but only do so if the data-main value is not a loader plugin
                //module ID.
                if (!cfg.baseUrl && mainScript.indexOf('!') === -1) {
                    //Pull off the directory of data-main for use as the
                    //baseUrl.
                    src = mainScript.split('/');
                    mainScript = src.pop();
                    subPath = src.length ? src.join('/')  + '/' : './';

                    cfg.baseUrl = subPath;
                }

                //Strip off any trailing .js since mainScript is now
                //like a module name.
                mainScript = mainScript.replace(jsSuffixRegExp, '');

                //If mainScript is still a path, fall back to dataMain
                if (req.jsExtRegExp.test(mainScript)) {
                    mainScript = dataMain;
                }

                //Put the data-main script in the files to load.
                cfg.deps = cfg.deps ? cfg.deps.concat(mainScript) : [mainScript];

                return true;
            }
        });
    }

    /**
     * The function that handles definitions of modules. Differs from
     * require() in that a string for the module should be the first argument,
     * and the function to execute after dependencies are loaded should
     * return a value to define the module corresponding to the first argument's
     * name.
     */
    define = function (name, deps, callback) {
        var node, context;

        //Allow for anonymous modules
        if (typeof name !== 'string') {
            //Adjust args appropriately
            callback = deps;
            deps = name;
            name = null;
        }

        //This module may not have dependencies
        if (!isArray(deps)) {
            callback = deps;
            deps = null;
        }

        //If no name, and callback is a function, then figure out if it a
        //CommonJS thing with dependencies.
        if (!deps && isFunction(callback)) {
            deps = [];
            //Remove comments from the callback string,
            //look for require calls, and pull them into the dependencies,
            //but only if there are function args.
            if (callback.length) {
                callback
                    .toString()
                    .replace(commentRegExp, commentReplace)
                    .replace(cjsRequireRegExp, function (match, dep) {
                        deps.push(dep);
                    });

                //May be a CommonJS thing even without require calls, but still
                //could use exports, and module. Avoid doing exports and module
                //work though if it just needs require.
                //REQUIRES the function to expect the CommonJS variables in the
                //order listed below.
                deps = (callback.length === 1 ? ['require'] : ['require', 'exports', 'module']).concat(deps);
            }
        }

        //If in IE 6-8 and hit an anonymous define() call, do the interactive
        //work.
        if (useInteractive) {
            node = currentlyAddingScript || getInteractiveScript();
            if (node) {
                if (!name) {
                    name = node.getAttribute('data-requiremodule');
                }
                context = contexts[node.getAttribute('data-requirecontext')];
            }
        }

        //Always save off evaluating the def call until the script onload handler.
        //This allows multiple modules to be in a file without prematurely
        //tracing dependencies, and allows for anonymous module support,
        //where the module name is not known until the script onload event
        //occurs. If no context, use the global queue, and get it processed
        //in the onscript load callback.
        if (context) {
            context.defQueue.push([name, deps, callback]);
            context.defQueueMap[name] = true;
        } else {
            globalDefQueue.push([name, deps, callback]);
        }
    };

    define.amd = {
        jQuery: true
    };

    /**
     * Executes the text. Normally just uses eval, but can be modified
     * to use a better, environment-specific call. Only used for transpiling
     * loader plugins, not for plain JS modules.
     * @param {String} text the text to execute/evaluate.
     */
    req.exec = function (text) {
        /*jslint evil: true */
        return eval(text);
    };

    //Set up with config info.
    req(cfg);
}(this, (typeof setTimeout === 'undefined' ? undefined : setTimeout)));

define("requirejs", function(){});

define('ImageServiceAttributesFactory',[],function () {
    /**
     * Factory class for creating Attributes Components
     * @param data {Object}
     * @param data.attribute {Object} Model of a single Attribute (Field)
     * @param data.events {Object} Events that the Attribute will listen to and fire
     * @param data.model {Object} DataModel of an Image
     */
    return function(data) {

        var that = this;
        var Attribute = data.attribute;
        var Events = data.events;
        var Model = data.model;

        that.create = function (options) {
            return new Model(Object.assign({
                config: {
                    events: Events
                },
                model: {
                    attribute: Attribute
                }
            }, options))
        }
    }
});
define('ImageServiceImageModelFactory',[],function() {

    /**
     * Factory for creating Data objects that represent and Image
     * @param options {Object}
     * @param options.config {Object} Configuration Object
     * @param options.config.events {Object} Events that the component knows: PRESETTERREGISTER - Registers an object that hass an apply method TODO: Make an Interface for it
     * @param options.host {Object} jQuery element where events will be fired and listened to
     * @param options.presetters {Object} A set of Presseters that will manipulate the initializatialized new Model
     */
    return function(options) {

        var that = this;
        var presetters = options.presetters || [];
        var host = options.host;
        var Events = options.config.events;

        that.statuses = {
            DELETED: 'deleted',
            NEW: 'new',
            CLEAN: 'clean',
            DIRTY: 'dirty',
            EXCLUDE: 'exclude'
        };

        var model = {

            id: null,
            service: "cloudinary",
            status: that.statuses.NEW,
            attributes: {},
            tags: [],
            options: [],
            info: {
                height: null,
                width: null,
                size: null,
                format: null,
                source: null,
                created: null
            }

        };

        /**
         * Initialisation
         */
        that.init = function () {
            // Registers a listener for a new model presetter
            host.on(Events.PRESETTERREGISTER, function (event, presetter) {
                presetters.push(presetter);
            });
        };

        /**
         * Returns a full model containing all the default values
         * @param defaults
         * @returns {*}
         */
        that.create = function (defaults) {

            defaults = defaults || {};

            var result = Object.assign({}, model);
            presetters.forEach(function (presetter) {
                presetter.apply(result);
            });

            return Object.assign(result, defaults);
        };

        that.init();
    }
});
define('ImageServiceListItemFactory',[],function () {

    /**
     * Factory for creating a List Items (List Rows)
     * @param data {Object}
     * @param data.definitions {Object} Set of definitions
     * @param data.definitions.attributes {Object} Definition of the attributes that a List Item has
     * @param data.model {Object} ListItem Component (ImageServiceListItem)
     * @param data.events {Object} The event names that the ListItem fires
     * @param data.actions {Object} The Actions Component (ImageServiceEntityActions) of a ListItem
     * @param data.preview {Object} The Preview Component (ImageServicePreview) of a List Item
     * @param data.attributes {Object} The Attributes Factory of a ListItem
     * @param data.dataModel {Object} DataModel of an Image
     * @param data.dataService {Object} Backend Service
     */
    return function(data) {
        var that = this;

        var Model = data.model;
        var Events = data.events;
        var Actions = data.actions;
        var Preview = data.preview;
        var Attributes = data.attributes;
        var DataModel = data.dataModel;

        var attributeDefinition = data.definitions.attributes;
        var service = data.dataService;

        that.create = function (options) {
            return new Model(
                Object.assign({
                        config: {
                            events: Events
                        },
                        factory: {
                            dataModel: DataModel,
                            attributes: Attributes
                        },
                        model: {
                            actions: Actions,
                            preview: Preview
                        },
                        definitions: attributeDefinition,
                        dataService: service
                    },
                    options
                )
            );
        };
    }
});
define('ImageServiceConnector',[],function () {

    /**
     * Backend Connector
     * @param data {Object}
     * @param data.factory {Object} Holds the Factories needed by the class - in this case the ErrorsFactory
     */
    return function(data) {

        var that = this;

        /**
         * Error Factory
         */
        var Errors = data.factory.errors;

        /**
         * Used as a cache. Right now its only used to get the urls of the current saved items
         * @type {*|{}}
         */
        that.defaults = data.defaults || {};

        /**
         * Where the backened services reside
         */
        that.baseUrl = data.baseUrl;

        /**
         * Save a list of items. the new items expact a corresponding memebr of the files array.
         * @param data {{items: array, files: array, callback: function, async: bool}}
         */
        that.imageSave = function (data) {

            var items = data.items,
                files = data.files,
                callback = data.callback,
                warningCallback = data.warning,
                errorCallback = data.error,
                async = data.async || true,
                formData = new FormData(),
                slugifiedName = '';

            // Format data to fit the backend
            if (files instanceof Object) {
                for (var i in files) {

                    if (items[i].status == 'new' && !files[i]) {
                        errorCallback('nofile');
                        console.error('[ImageServiceConnector::imageSave] One of the new items does not have a valid file attached');
                        return;
                    }

                    if (items[i].status == 'new') {
                        slugifiedName = that.slugify(files[i].name);
                        items[i].id = slugifiedName;
                        formData.append(slugifiedName, files[i], files[i].name);
                    }
                }
            }

            // adds the files
            formData.append('items', JSON.stringify(items));

            // sends the ajax request
            return $.ajax({

                type: 'POST',
                url: that.baseUrl + '/imageprocess',
                data: formData,
                dataType: 'json',
                contentType: false,
                processData: false,
                async: async,

                success: function (response) {

                    if (response.success === true && response.messages && response.messages.length)
                        warningCallback(response.messages);

                    if (response.success === false && response.messages && response.messages.length)
                        return errorCallback(Errors.create(response.messages[0].code));

                    if (response.success === true && typeof(callback) === 'function')
                        return callback(response.items);

                },

                error: function (jqXHR, textStatus, errorThrown) {
                    return errorCallback(errorThrown);
                }

            });
        };

        // TODO: Remove as its not needed. The url comes back on item create
        that.getImageUrl = function (imageId, service) {

            var deferred = {};
            deferred.promise = new Promise(function (resolve, reject) {
                deferred.resolve = resolve;
                deferred.reject = reject;
            });

            if (that.defaults.hasOwnProperty('urls') && that.defaults.urls.hasOwnProperty(imageId)) {
                deferred.resolve(that.defaults.urls[imageId]);
            } else {

                $.ajax({
                    url: that.baseUrl + '/imageurl',
                    data: {
                        imageid: imageId,
                        width: null,
                        height: null,
                        service: service
                    },
                    success: function (data) {
                        deferred.resolve(data.url);
                    }
                });

            }

            return deferred.promise;
        };

        /**
         * Cleans data for the backend. Its only needed to clean the File name
         * @param str
         * @returns {*}
         */
        that.slugify = function (str) {
            return str.replace(/[^a-z0-9\_\-]+/igm, '');
        };

        return that;
    }
});
define('ImageServiceUploader',[],function () {

    /**
     * Component that generates an upload button, for adding new images
     * @param data {Object}
     * @param data.config {Object} System configurations
     * @param data.config.events {Object} Event names that the component fires
     * @param data.config.labels {Object} Labels that the component uses
     * @param data.factory {Object} Collection of factories that the component needs
     * @param data.factory.model {Object} Factory for the DataModel used by all other components
     * @param data.host {Object} The place where the componenet adds its HTML and fires the events MESSAGEERROR, ITEMADDED
     * @param data.maxFileSize {Integer} The max file size allowed
     * @param data.allowedExtensions {Array} The set of allowed file extensions
     */
    return function(data) {
        var that = this;
        var Events = data.config.events;
        var Model = data.factory.model;
        var Labels = data.config.labels;

        /**
         * jQuery object which hosts all new elements generated by the Item Service
         * @type {jQuery|HTMLElement}
         */
        var host = data.host;

        /**
         * jQuery Object holding the upload field and all additional help elements if needed
         * @type {null}
         */
        var container = null;

        /**
         * the jQuery Upload Field
         * @type {null}
         */
        var uploadField = null;

        /**
         * The max filesize
         * @type {string|*|string|number}
         */
        var maxFileSize = data.maxFileSize || null;

        /**
         * Allowed extensions
         * @type {*|string[]}
         */
        var allowedExtensions = data.allowedExtensions || ['jpg', 'jpeg', 'png', 'gif'];

        /**
         * Class initialisation
         */
        that.init = function () {
            var uploadElement = that.render();
            host.append(uploadElement);
        };

        /**
         * File Validation checks the size and extension of the file
         * @param file
         * @returns {boolean}
         */
        that.validateFile = function (file) {

            if (!file)
                return true;

            if (maxFileSize && file.size > maxFileSize) {
                container.trigger(Events.MESSAGEERROR, 'File size too big ' + file.size + ' File: ' + file.name);
                return false;
            } else if (allowedExtensions.indexOf(file.type.replace('image/', '')) < 0) {
                container.trigger(Events.MESSAGEERROR, 'File type not known ' + file.type + ' File: ' + file.name);
                return false;
            } else {
                return true;
            }
        };

        /**
         * File processing - validates and triggers an ITEMADDED event
         * @param file
         */
        that.processFile = function (file) {

            if (!that.validateFile(file))
                return;

            var name = file.name;

            // Creates a copy of the Item model, as javascript only works with pointers.
            var newImage = Model.create({
                id: name,
                info: {
                    source: null,
                    height: null,
                    width: null,
                    size: file.size,
                    format: file.type
                }
            });

            // The host is used as Events controller
            host.trigger(Events.ITEMADDED, {
                item: newImage,
                file: file
            });

        };

        /**
         * Adds another upload field for multi-upload
         * @param element
         */
        that.addFieldListener = function (element) {
            element.on('change', function () {
                var filesCount = uploadField[0].files.length;

                for (var i = 0; i < filesCount; i++) {
                    that.processFile(uploadField[0].files[i]);
                }

                $(this).val(null);

                // Resets the Upload field
                //that.render();
            });
        };

        /**
         * Adds another upload field
         */
        that.addUploadField = function () {
            uploadField = $('<input name="files[]" type="file" multiple/>');
            that.addFieldListener(uploadField);
            container.append(uploadField);
        };

        /**
         * Renders the Upload container
         * @returns {*}
         */
        that.render = function () {

            container = $('<span class="btn btn-primary fileinput-button"><i class="fa fa-plus"></i><span> ' + Labels.button.itemUpload + ' </span></span>');
            that.addUploadField();
            return $('<div class="imageservice-uploader col-xs-12 col-md-2"></div>').append(container);
        };

        this.init();
    }
});
define('ImageServiceSettings',['require'],function(options) {

    /**
     * A Component that renders a Settings Module, where the settings sub-blocks can register themselves
     * The component saves the data in the json store.
     * @param options {Object}
     * @param options.data {Object} Initial data for the Component
     * @param options.config {Object} System-wide config
     * @param options.config.event {Object} Event names that the component uses, SETTINGREGISTER
     * @param options.config.labels {Object} Labels for the component
     */
    return function(options) {

        var that = this;
        var host = options.host;
        var components = [];
        var container = null;
        var store = options.data || {};
        var Events = options.config.events;
        var Labels = options.config.labels;

        this.init = function () {

            var containerControl = $('<div class="col-sm-1 col-xs-12 imageservice-settings-trigger"><button class="btn btn-secondary"><i class="fa fa-cogs" aria-hidden="true"></i></button></div>');
            container = $('<div class="col-xs-12 imageservice-settings" ><h4>' + Labels.title + '</h4></div>');

            containerControl.on('click', function (event) {
                event.preventDefault();
                event.stopPropagation();

                $(container).animate({height: 'toggle'});
            });

            host.append(containerControl);
            host.append(container.hide());

            host.on(Events.SETTINGREGISTER, function (event, data) {
                data.setValues(store[data.getIdentifier()] || {});
                that.addComponent(data);
            });

        };

        this.addComponent = function (component) {
            var newElement = $('<div class="imageservice-settings-component"></div>').append(component.render());
            components.push(component);
            container.append(newElement);
        };

        this.getData = function () {

            components.forEach(function (el) {
                store[el.getIdentifier()] = el.getValues();
            });

            return store;
        };

        this.init();
    }
});
define('ImageServiceFinder',['require'],function (data) {

    /**
     * Component used for image search. Send a search parameter to the Backened and shows the results.
     * @param data {Object}
     * @param data.config {Object} config object holding some system settings that the class needs
     * @param data.config.events {Object} key value Object containing the events that component fires. The Component needs only ITEMADDED as key
     * @param data.config.labels {Object} Labels that the class will use for its component, { fields.itemFind: string }
     *
     */
    return function(data) {

        var that = this;
        var Events = data.config.events;
        var Labels = data.config.labels;

        that.host = data.host;
        that.dataService = data.service;
        that.container = null;
        that.select = null;
        that.containerClass = data.containerClass;

        /**
         * The template of a single row in the suggestion list
         * @param state
         * @returns {*}
         */
        that.rowTemplate = function (state) {
            if (state.hasOwnProperty('id')) {
                var row = $('<div class="imageservice-finder-result col-xs-12"></div>');
                var preview = $('<div class="col-xs-3 preview" style="background-image: url(' + state.info.source + ');"></div>');
                var text = $('<ul class="col-xs-9" ></ul>');

                for (var x in state.attributes) {
                    text.append($('<li><span>' + state.attributes[x] + '</span></li>'));
                }

                row.append(preview);
                row.append(text);
                return row;

            } else {
                return state.text;
            }
        };

        /**
         * The template of the current selection
         * @param repo
         * @returns {*}
         */
        that.repoTemplate = function (repo) {
            if (repo.hasOwnProperty('text'))
                return repo.text;
        };

        /**
         * Adds the Listener that notifies the list that a new items has been selected
         */
        that.addEventListeners = function () {
            that.select.select2().on('select2:select', function (event) {
                if (event.params.data) {
                    that.host.trigger(Events.ITEMADDED, {item: jQuery.extend({}, event.params.data)});
                }
            });
        };

        /**
         * Initiates external UI functionality
         */
        that.initScelect2 = function () {

            that.select.select2({
                width: '100%',
                placeholder: Labels.fields.itemFind,
                allowClear: true,
                ajax: {
                    url: that.dataService.baseUrl + "/imagesearch",
                    dataType: 'json',
                    delay: 120,
                    data: function (params) {
                        return {
                            q: params.term.replace(/(^\s+)|(\s+$)/igm, ''), // search term, trimmed
                            page: params.page
                        };
                    },
                    processResults: function (data, params) {

                        var items = [];

                        params.page = params.page || 1;

                        for (var i in data.items)
                            items.push(data.items[i]);

                        return {
                            results: items,
                            pagination: {
                                more: false
                            }
                        };
                    },
                    cache: true
                },
                minimumInputLength: 1,
                templateResult: that.rowTemplate,
                templateSelection: that.repoTemplate
            });

        };

        /**
         * Initiates HTML
         */
        that.initHTML = function () {
            that.container = $('<div class="imageservice-finder col-xs-12 col-md-9"></div>');
            that.select = $('<select></select>');
            that.container.append(that.select);
            that.addEventListeners();
            $(that.host).append(that.container);
        };

        /**
         * Inits the object and the HTML
         */
        that.init = function () {
            that.initHTML();
            that.initScelect2();
        };

        that.init();

        return that;
    }
});
define('ImageServiceSettingsInterface',[],function(){

    /**
     * Interface / Abstract object for Settings-Blocks
     * @param data {Object}
     * @param data.attributes {Object} Definition of the attributes that the Settings Component
     * @param data.host {Object} jQuery element hosting the events and components html
     * @param data.service {Object} Backened Service
     * @param data.name {Object} Identifier of the settings block
     * @param data.values {Object} Initial values of the Settings component
     * @param data.config {Object} System configuration for the Component
     * @param data.config.events {Object} Component Event-names
     * @param data.factory {Object} Collection of factory objects that the component needs
     * @param data.factory.attributes {Object} Factory Object for generating Attributes Components.
     */
    return function(data) {

        this.Events = data.config.events;

        // The host where the events go
        this.host = data.host;

        this.name = 'ImageServiceSettings';

        // Creates an attributes object this will be used for the UI
        this.attributes = data.factory.attributes.create({
            definitions: data.attributes,
            dataService: data.service,
            values: data.values,
            prefix: this.name
        });

        this.getIdentifier = function () {
            return this.name;
        };

        this.getValues = function () {
            return this.attributes.getValues();
        };

        this.setValues = function (values) {
            this.attributes.setValues(values);
        };

        /**
         * Renders the frontend part
         * @returns {null|jQuery|HTMLElement|*}
         */
        this.render = function () {};

        /**
         * Initialization
         */
        this.registerSetting = function () {
            this.host.trigger(this.Events.SETTINGREGISTER, this);
        };

    }
});
define('ImageServicePresets',['ImageServiceSettingsInterface'], function (ImageServiceSettingsInterface) {

    /**
     * A Component that renders a Settings Block with fields, whose values will be used as Defualt ListItem Attributes Values
     * The component notifies the world that it is a Settings Component and it also is a Presetter, that means that it implements an apply method
     * @param data {Object}
     * @param data.config {Object} System-wide configurations
     * @param data.config.labels {Object} Labels of the Component
     * @param data.factory.attributes {Object} Factory generating an Attributes Componenet based on the Attributes definition
     * @param data.service {Object} Backend service for the attributes
     * @param data.values {Object} Initial values for the Attribute fields
     *
     */
    return function(data) {

        var that = this;

        ImageServiceSettingsInterface.call(this, data);

        var Labels = data.config.labels;

        // Where the UI resides
        that.container = null;

        that.name = 'ImageServicePresets';

        that.attributes = {};

        /**
         * Makes the preset changes of the model
         * @param model
         * @returns {*}
         */
        that.apply = function (model) {

            if (!model.hasOwnProperty('attributes'))
                return model;

            var values = that.attributes.getValues();
            model.tags = values.tags;

            return Object.assign(model.attributes, values);
        };

        /**
         * Renders the frontend part
         * @returns {null|jQuery|HTMLElement|*}
         */
        that.render = function () {

            if (that.container)
                that.container.remove();

            that.container = $('<div class="imageservice-attributes-global"><h5>' + Labels.title + '</h5><hr/></div>');
            that.container.append(that.attributes.render());
            that.host.append(that.container);

            return that.container;
        };

        /**
         * Initialization
         */
        that.init = function () {

            // Creates an attributes object that will be used for the UI
            that.attributes = data.factory.attributes.create({
                definitions: data.attributes,
                dataService: data.service,
                values: data.values,
                prefix: that.name
            });

            this.registerSetting();
            that.host.trigger(that.Events.PRESETTERREGISTER, that);
        };

        that.init();
    };

});
define('ImageServiceMessaging',[],function () {

    /**
     * Component that shows messages inside the host element
     * @param data {Object}
     * @param data.host {Object} Where the new messages will appear
     * @param data.messageLife {Object} Time before the message automatically disappears
     * @param data.events {{error: string, warning: string, info: string}} Events for the diffetent message types.
     * is shown if some component fires an event on the host element
     *
     */
    return function(data) {

        var that = {};

        /**
         * The Host Element where all events endup
         * @type {jQuery|HTMLElement|*|jQuery|HTMLElement|string}
         */
        that.host = data.host;

        /**
         * The number of milliseconds for which the message will be shown.
         * @type {number}
         */
        that.messageLife = data.messageLife || 1500000;

        /**
         * The element holding all shown messages
         * @type {jQuery|HTMLElement}
         */
        that.container = $('<div class="imageservice-message"></div>');

        /**
         * Known Message Types
         * @type {{ERROR: string, INFO: string, WARNING: string}}
         */
        that.events = {
            error: data.events.error,
            warning: data.events.warning,
            info: data.events.info
        };

        /**
         * Constructor
         */
        that.init = function () {

            that.host.append(that.container);

            that.host.on(that.events.error, function (event, data) {
                that.error(data);
            });

            that.host.on(that.events.info, function (event, data) {
                that.info(data);
            });

            that.host.on(that.events.warning, function (event, data) {
                that.warning(data);
            });

        };

        /**
         * Removes a spcecific message
         * @param messageBox
         */
        that.remove = function (messageBox) {
            $(messageBox).animate({height: 0, opacity: 0}, 500, function () {
                messageBox.remove();
            });

        };

        /**
         * Adds the auto remove and remove on click functionality
         * @param element
         */
        that.addListeners = function (element) {

            setTimeout(
                function () {
                    that.remove(element);
                },
                that.messageLife
            );

            element.on('click', function () {
                that.remove(element);
            });

        };

        /**
         * Error message
         * @param message
         */
        that.error = function (message) {
            var messageBox = $('<div class="alert alert-danger alert-dismissible"><button type="button" class="close" data-dismiss="alert">×</button>' + message + '</div>');
            that.addListeners(messageBox);
            that.container.append(messageBox);

        };

        /**
         * Simple info
         * @param message
         */
        that.info = function (message) {
            var messageBox = $('<div class="alert alert-success alert-dismissible"><button type="button" class="close" data-dismiss="alert">×</button>' + message + '</div>');
            that.addListeners(messageBox);
            that.container.append(messageBox);
        };

        /**
         * Warning
         * @param message
         */
        that.warning = function (message) {
            var messageBox = $('<div class="alert alert-warning alert-dismissible"><button type="button" class="close" data-dismiss="alert">×</button>' + message + '</div>');
            that.addListeners(messageBox);
            that.container.append(messageBox);
        };

        that.init();

        return that;
    }
});
define('ImageServiceList',[],function () {

    /**
     * A Component that renders a list.
     *
     * @param data {object}
     * @param data.config {object} Configuration object that brings system-wide settings to the component
     * @param data.config.events {object} Key-Value pairs of events that the Component uses.
     *     - LISTSAVED, list saved
     *     - ITEMADDED, item removed
     *     - ITEMDELETED, item deleted
     *     - ITEMEXCLUDED, item excluded form the list without deleting it form the service
     *     - MESSAGEWARNING, shows a warning
     *
     * @param data.factory {object} object holding the factories that the component needs.
     * @param data.factory.listItem {object} the factory for creating a new ImageServiceListItems that render a new list row.
     * @param data.factory.model {object} Factory for Creating a Data-Model for the ListItem
     * @param data.hostElement {object} jQuery object where the list will add its HTML code and where the events will be fires/listened to
     *
     */
    return function(data) {

        var that = this;

        // Events
        var Events = data.config.events;

        // ListItem Factory
        var ListItem = data.factory.listItem;

        // Image Data Model
        var Model = data.factory.model;

        /**
         * Indicates a form change
         * @type {boolean}
         */
        that.dirty = false;

        /**
         * jQuery element that hosts the current instance of the service
         * @type {jQuery|HTMLElement}
         */
        that.host = data.hostElement;

        /**
         * Generated Item entities
         * @type {Array}
         */
        that.imageEntities = [];

        /**
         * jQuery object - the list html instance
         * @type {null}
         */
        that.container = null;

        /**
         * The maximal number of items in the list null == without a limit
         * @type {int|null}
         */
        that.maxItems = data.maxItems || null;

        /**
         * Constructor
         */
        that.init = function () {
            that.reset(data.items.items);
            that.addListeners();
        };

        /**
         * Resets the content of the list with new content
         * @param newItems
         */
         that.reset = function (newItems) {

            newItems = newItems || [];

            if (that.container != null)
                that.container.remove();

            that.container = $('<div class="imageservice-list"></div>');
            $(that.host).append(that.container);

            that.imageEntities = [];

            // Add the data to the internal array
            for (var i = 0; i < newItems.length; i++) {
                that.addItem(newItems[i]);
            }

            // Makes the list sortable
            if ($.fn.sortable) {
                that.container.sortable({
                    update: that.onListSorted
                });
            }
        };

        /**
         * Registers the listeners
         */
        that.addListeners = function () {

            // On list saved
            $(that.host).on(Events.LISTSAVED, function (event, newItems) {
                that.dirty = false;
                that.reset(newItems.items);
            });

            // On element change
            $(that.host).on('change', function () {
                that.dirty = true;
            });

            // On new item added
            $(that.host).on(Events.ITEMADDED, function (event, data) {
                if (data.hasOwnProperty('item')) {
                    var newItem = that.addItem(
                        data.item,
                        data.file || null
                    );

                    if (!newItem)
                        return;

                    var offsets = newItem.getOffsets();

                    that.container.animate({scrollTop: offsets.top}, 500);
                    that.dirty = true;
                }
            });

            $(that.host).on(Events.ITEMDELETED, function (event, item) {
                that.dirty = true;
                if (item.getData().status == Model.statuses.EXCLUDE)
                    that.removeItem(item);
            });

            $(that.host).on(Events.ITEMEXCLUDED, function (event, item) {
                that.dirty = true;
                that.removeItem(item);
            });

        };

        /**
         * TODO: Move to a Sorter class
         * @param event
         * @param ui
         */
        that.onListSorted = function (event, ui) {
            var ids = that.container.sortable('toArray');
            var newEntityArray = [];

            that.imageEntities.forEach(function (el) {
                var newIndex = ids.indexOf(el.getId());
                newEntityArray[newIndex] = el;
            });

            that.imageEntities = newEntityArray;
            that.dirty = true;

        };

        /**
         * Return the current data of the list
         * @returns {{items: Array, files: Array}}
         */
        that.getData = function () {

            var items = [];
            var files = [];

            that.imageEntities.forEach(function (entity) {
                items.push(entity.getData());
                files.push(entity.getFile() || null);
            });

            return {
                items: items,
                files: files
            };
        };

        /**
         * Removes an element form the list
         * @param item
         */
        that.removeItem = function (item) {
            var itemIndex = that.imageEntities.indexOf(item);
            if (itemIndex >= 0) {
                that.imageEntities.splice(itemIndex, 1);
            }
        };

        /**
         * Adds a single item to the list
         * @param imageData
         * @param fileData
         * @returns {ImageServiceListItem}
         */
        that.addItem = function (imageData, fileData) {

            if (imageData.status == Model.statuses.DELETED) {
                that.container.trigger(Events.MESSAGEWARNING, 'Added image has a delete status');
                return;
            }

            // Limits the number of files in the list
            if (that.maxItems && that.getListLength() >= that.maxItems) {
                that.container.trigger(Events.MESSAGEWARNING, 'Maximal number of list items reached.');
                return;
            }

            var newEntity = ListItem.create({
                item: jQuery.extend({}, imageData),
                file: fileData,
                prefix: that.host.attr('id') + '_' + that.imageEntities.length
            });

            that.imageEntities.push(newEntity);
            that.container.append(newEntity.render());

            return newEntity;

        };

        /**
         * Returns the active items in the list. Those marked for deletion are not counteted in
         * @returns {*}
         */
        that.getListLength = function () {
            // Gets all items that are not set for deletion
            // TODO: Find a more efficient way to check that
            var activeItems = $(that.imageEntities).filter(function (index, obj) {
                if (obj.getData().status != Model.statuses.DELETED)
                    return true;
            });

            return activeItems.length;
        };

        that.init();

        return that;
    }
});
/**
 * A Module holding the default app settings
 */
define('ImageServiceConfig',{

    /**
     * Definition of the system fields
     * @type {{tags: {type: string, label: string}}}
     */
    systemAttributes: {
        tags: {
            type: 'tag',
            label: 'Tags'
        }
    },

    /**
     * Labels for the Classes
     */
    labels: {

        ImageServiceFinder: {
            fields: {
                itemFind: 'Search in the library'
            }
        },
        ImageServiceUploader: {
            button: {
                itemUpload: 'Upload Image'
            }
        },
        ImageServicePresets: {
            title: 'Defaults'
        },
        ImageServiceGlobals: {
            title: 'Globals'
        },
        ImageServiceSettings: {
            title: 'Settings'
        }

    },

    /**
     * Events the classes use
     */
    events: {
        LISTSAVED: 'imageservice-listsaved',
        LISTCHANGED: 'imageservice-listchanged',
        ITEMUPLOADED: 'imageservice-itemuploaded',
        ITEMCHANGED: 'imageservice-itemchanged',
        ITEMSAVED: 'imageservice-itemsaved',
        ITEMADDED: 'imageservice-itemadded',
        ITEMDELETED: 'imageservice-itemdeleted',
        ITEMDELETE: 'imageservice-itemdelete',
        ITEMTOGGLE: 'imageservice-itemtoggle',
        ITEMEXCLUDE: 'imageservice-itemexclude',
        ITEMEXCLUDED: 'imageservice-itemexcluded',
        PREVIEWREADY: 'imageservice-preview-ready',
        ATTRIBUTERENDERED: 'imageservice-attribute-rendered',
        MESSAGEERROR: 'imageservice-message-error',
        MESSAGEWARNING: 'imageservice-message-warning',
        MESSAGEINFO: 'imageservice-message-info',
        PRESETTERREGISTER: 'imageservice-presetter-register',
        SETTINGREGISTER: 'imageservice-setting-register'

    }

});
define('ImageServiceErrors',[],function(){
    /**
     * Error Factory Class
     * Translates the system errors in to human messages
     * Mainly used by the Backend Service
     * @param options {Object}
     * @param options.errors {Object} A set of error: message key value pairs
     */
    return function(options) {

        var that = this;

        /**
         * Default errors
         * @type {{fileexists: string, filesize: string, nofile: string, fileext: string, status: string, unknown: string, fileinvalid: string, accessdenied: string}}
         */
        var errors = {
            fileexists:  'The file already exists. Please add it via the search field',
            filesize:    'The uploaded file is too big. Please choose a smaller one',
            nofile:      'No file has been fount, for the new image',
            fileext:     'The files extension is unknown',
            status:      'Invalid image status',
            unknown:     'Something went wrong. Try again and if the problem persits call an administrator',
            fileinvalid: 'File is invalid. Either too big or the of an unsuported type',
            accessdenied: 'You are not logged in!'
        };

        if(options instanceof Object && options.hasOwnProperty('errors'))
            errors = Object.assign(errors, options.errors);

        /**
         * Returns a meaningful error
         * @param error System known error code
         * @returns {String} A human readable error message
         */
        that.create = function(error) {
            return errors.hasOwnProperty(error)? errors[error]: errors['unknown'];
        }

    }

});

define('ImageServiceGlobals',['ImageServiceSettingsInterface'], function (ImageServiceSettingsInterface) {

    /**
     * Component that renders the Globals Settings Block. Used for configuring the collection of images. It is compatible with an Interface needed by the ImageServiceSettingsInterface
     * @param data {object}
     * @param data.host {object} jQuery object where the component will render its contents, and fire the its events
     * @param data.attributes {object} An object containing the definition of the attributes that the component will render.
     * @param data.service {object} The backend service/connector that the attributes may use for the typeahead fields
     * @param data.values {object} The initial values for the Attributes
     *
     * @param data.config {object} Config cor the Component
     * @param data.config.events {object} Event names that the component needs - SETTINGREGISTER. This event will be fired to notify any Settings Components.
     * @param data.config.labels {object}
     * @param data.factory {object}
     * @param data.factory.attributes {object}
     *
     */
    return function(data) {

        ImageServiceSettingsInterface.call(this, data);

        var that = this;
        var Labels = data.config.labels;

        // Where the UI resides
        that.container = null;
        that.name = 'ImageServiceGlobals';

        /**
         * Renders the frontend part
         * @returns {null|jQuery|HTMLElement|*}
         */
        this.render = function () {

            if (that.container)
                that.container.remove();

            that.container = $('<div class="imageservice-attributes-global"><h5>' + Labels.title + '</h5><hr/></div>');
            that.container.append(that.attributes.render());
            that.host.append(that.container);

            return that.container;
        };

        that.init = function() {
            that.attributes.prefix = that.getIdentifier();
            that.registerSetting();
        };

        that.init();

    };

});
define('ImageServiceListItem',[],function () {

    /**
     * A Component that renders a row for the ImageServiceList Component.
     * @param data.config {Object}
     * @param data.config.events {Object} Event names that the component knows and fires, ITEMDELETE, ITEMDELETED, ITEMEXCLUDE, ITEMEXCLUDED, PREVIEWREADY
     * @param data.model {Object} An Object containing all the models that Component uses actions and preview:
     * @param data.model.actions {Object} A Component that renders the actions block TODO: Make it a factory
     * @param data.model.preview {Object} A Component that renders the preview TODO: Make it a factory
     * @param data.factory {Object} An Object holding the factories that the Component needs
     * @param data.factory.attributes {Object} The Factory that generates the Attributes Component
     * @param data.factory.dataModel {Object} The Factory that generates an Image Data Model
     *
     * @param data.definitions {Object} Attributes definitions of the Image
     * @param data.dataService {Object} Backend Service
     * @param data.file {Object} The File attached to the ListItem, used for Preview and Save
     *
     */
    return function(data) {

        var that = this;
        var Events = data.config.events;
        var Actions = data.model.actions;
        var Preview = data.model.preview;
        var Attributes = data.factory.attributes;
        var DataModel = data.factory.dataModel;

        /**
         * Has the info been changed flag
         * @type {boolean}
         */
        var dirty = false;

        /**
         * Item data
         * @type {*|{id: null, service: string, status: string, attributes: {}, tags: Array, options: Array, info: {height: null, width: null, size: null, format: null, source: null, created: null}}}
         */
        var item = DataModel.create(data.item);

        /**
         * The source file for new Items
         * @type {*|CKEDITOR.ui.dialog.file|null}
         */
        var file = data.file || null;

        /**
         * Field definitions
         * @type {*|*|{type: string, label: string}}
         */
        var definitions = data.definitions;

        /**
         * Communication service with the backened
         * @type {*|ImageServiceConnector|string|ImageServiceConnector|string}
         */
        var dataService = data.dataService;

        /**
         * jQuery Object of the Entity
         * @type {null}
         */
        var container = null;

        /**
         * The unique id of the element
         * @type {string}
         */
        var id = '';

        /**
         * The preview object
         * @type {null}
         */
        var preview = null;

        /**
         * Attributes object
         * @type {null}
         */
        var attributes = null;

        /**
         * The actions object
         * @type {null}
         */
        var actions = null;

        /**
         * Initiates the object
         */
        that.init = function () {

            // creates an unique id of the entity
            id = data.prefix + '_' + item.id.replace(/[^a-z0-9\_\-]+/ig, '_');

            // Prepares the attributes
            var attrValues = jQuery.extend({}, item.attributes, {tags: item.tags});

            // tries to retrieve the item url
            that.presetImage();

            // Loads the standart components
            container = $('<div id="' + id + '" class="col-xs-12 col-sm-12 col-md-12 imageservice-entity"></div>');
            actions = new Actions({
                config: {
                    events: Events
                }
            });
            preview = new Preview({
                item: item,
                config: {
                    events: Events
                },
                factory: {
                    dataModel: DataModel
                }
            });
            attributes = Attributes.create({
                prefix: id,
                values: attrValues,
                definitions: data.definitions,
                dataService: dataService
            });

            // adds the listeners
            that.addListeners();

            // Loads the source file
            if (file)
                that.loadTheFile();
        };

        /**
         * Returns the generated unique element id
         * @returns {string}
         */
        that.getId = function () {
            return id;
        };

        /**
         * Returns the Data of the Entity
         * @returns {*|{id: null, service: string, status: string, attributes: {}, tags: Array, options: Array, info: {height: null, width: null, size: null, format: null, source: null, created: null}}}
         */
        that.getData = function () {

            var attrValues = attributes.getValues();

            // Gets the internal values
            item.tags = attrValues.tags;

            for (var i in definitions)
                item.attributes[i] = attrValues[i];

            return item;
        };

        /**
         * Returns the loaded file. Needed when saving the new entities
         * @returns {*|CKEDITOR.ui.dialog.file|null}
         */
        that.getFile = function () {
            return file;
        };

        /**
         * Gets the offsets related to the parent element
         */
        that.getOffsets = function () {
            return {
                left: container[0].offsetLeft,
                top: container[0].offsetTop
            };
        };

        /**
         * Add listeners to react on attrbutes change and item delete
         */
        that.addListeners = function () {

            // change
            container.on('change', function (event) {
                that.onImageUpdate(event)
            });

            // delete
            container.on(Events.ITEMDELETE, function () {
                that.onItemDelete(true);
            });

            // delete
            $(window).on(Events.ITEMDELETED, function (event, item) {
                that.onItemDeleted(item);
            });

            // exclude
            container.on(Events.ITEMEXCLUDE, function () {
                that.onItemDelete(false);
            });

            // exclude
            $(window).on(Events.ITEMEXCLUDED, function (event, item) {
                that.onItemExcluded(item);
            });

        };

        /**
         * TODO: Move this logic to the Item service
         */
        that.presetImage = function () {

            if (!item.info.source) {
                item.info.source = dataService.getImageUrl(item.id, item.service);
            }

            if (item.attributes instanceof Array) {
                item.attributes = {};
            }
        };

        /**
         * Code to execute on data update
         * @param event
         */
        that.onImageUpdate = function (event) {
            dirty = true;
            if (item.status != DataModel.statuses.NEW)
                item.status = DataModel.statuses.DIRTY;
        };

        /**
         * Code to execute on entity delete
         */
        that.onItemDelete = function (hard) {

            dirty = true;

            if (hard && item.status != DataModel.statuses.NEW) {
                // Delete existing already uploaded images
                item.status = DataModel.statuses.DELETED;
                var responseEvent = Events.ITEMDELETED;
            }
            else {
                // Delete of images that not been uploaded
                var responseEvent = Events.ITEMEXCLUDED;
            }

            that.hide(function () {
                container.trigger(responseEvent, that);
            });

        };

        /**
         * Code to execute on entity delete
         */
        that.onItemDeleted = function (deletedItem) {

            dirty = true;

            if (deletedItem.getData().id != item.id)
                return;

            if (item.status != DataModel.statuses.DELETED) {
                item.status = DataModel.statuses.EXCLUDE;
                container.trigger(Events.ITEMEXCLUDED, that);
            }

            that.hide();
        };


        /**
         * Code to execute on entity delete
         * still no other action required
         */
        that.onItemExcluded = function (excludedItem) {
            return;
        };

        /**
         * Hide the element
         */
        that.hide = function (success) {
            $(container).animate({height: 0, opacity: 0}, 300, function () {
                $(container).hide();
                if (typeof(success) == 'function')
                    success();
            });
        };

        /**
         * Loads the File for the preview
         */
        that.loadTheFile = function () {
            var reader = new FileReader();
            reader.addEventListener("load", function () {
                var URL = window.URL || window.webkitURL || false;
                item.info.source = URL ? URL.createObjectURL(file) : reader.result;
                preview.update(item);
                container.trigger(Events.PREVIEWREADY, item);
            });
            reader.readAsDataURL(file);
        };

        /**
         * Renders the Entity HTML
         * @returns {*}
         */
        that.render = function () {

            container.append(preview.render());
            container.append(attributes.render());
            container.append(actions.render());

            return container;
        };

        that.init();
    }
});
define('ImageServiceEntityAction',[],function () {

    /**
     * Component for rendering an Actions block for an Item.
     * @param data {Object}
     * @param data.config {Object} Configuration class
     * @param data.config.events {{ITEMDELETE: String, ITEMEXCLUDE: String}} Event names that will be sent on actions
     * @param data.item {Object} The boject that will be sent along with the event
     */
    return function(data) {

        var that = this;
        var Events = data.config.events;

        /**
         * The item data of the entity
         */
        var item = data.item;

        /**
         * Generates the delete button
         * @returns {jQuery|HTMLElement}
         */
        that.renderDelete = function () {

            var actionDelete = $('<button class="btn delete btn-danger"><i class="fa fa-trash"></i></button>');

            actionDelete.on('click', function (event) {

                event.stopPropagation();
                event.preventDefault();

                if (confirm('Are you sure you want to delete this item from the service?'))
                    actionDelete.trigger(Events.ITEMDELETE, that.item);

            });

            return actionDelete;
        };

        /**
         * Generates the delete button
         * @returns {jQuery|HTMLElement}
         */
        that.renderExclude = function () {

            var action = $('<button class="btn btn-warning remove"><i class="fa fa-minus"></i></button>');

            action.on('click', function (event) {

                event.stopPropagation();
                event.preventDefault();

                if (confirm('Are you sure you want to exclude this item from the list?'))
                    action.trigger(Events.ITEMEXCLUDE, that.item);

            });

            return action;
        };

        /**
         * Renders HTML containing the actions
         * @returns {jQuery|HTMLElement}
         */
        that.render = function () {
            var actions = $('<div class="col-xs-12 col-sm-1 col-md-1 imageservice-entity-actions"></div>');
            actions.append(that.renderDelete());
            actions.append(that.renderExclude());
            return actions;
        }
    }
});
define('ImageServicePreview',[],function () {

    /**
     * Preview Component, shows a Thumbnail for an ListItem Component.
     * @param data {Object}
     * @param data.item {Object} Data Model of the Previewed Data
     * @param data.config {Object} System-wide config settings
     * @param data.config.events {Object} Event names that the componenet knows. ITEMTOGGLE
     * @param data.factory {Object} Collection of the needed factories
     * @param data.factory.dataModel {Object} A data-model factory needed to retrieve the possible item statuses
     */
    return function(data) {

        var that = this;
        var item = data.item;
        var preview = null;
        var container = null;
        var Events = data.config.events;
        var DataModel = data.factory.dataModel;

        /**
         * Tries to get the item path form the
         */
        that.init = function () {

            container = $('<div class="col-xs-12 col-sm-3 col-md-3 imageservice-preview"></div>');
            preview = $('<img/>');

            that.update(item);

            preview.on('click', function () {
                $(this).trigger(Events.ITEMTOGGLE);
            });

            container.append(preview);

        };

        /**
         * Updates the preview data
         * @param newImage
         */
        that.update = function (newImage) {

            item = newImage;

            if (item.info.source instanceof Promise && item.status != DataModel.statuses.NEW) {
                item.info.source.then(function (url) {
                    preview.attr('src', url);
                    item.info.source = url;
                });
            } else if (!(item.info.source instanceof Promise)) {
                preview.attr('src', item.info.source);
            }

        };

        /**
         * Renders the HTML
         * @returns {jQuery|HTMLElement}
         */
        that.render = function () {
            return container;
        };

        that.init();

        return that;
    }
});
define('ImageServiceAttribute',[],function () {

    /**
     * A component representing a form attribute.
     * The type parameter defines which template would be generated.
     * @param data {Object}
     * @param data.prefix {String}, a String prefix added to the field to ensure an unique name
     * @param data.definition {Object}, the attribute definition,
     * @param data.definition.type {text, textarea, select, checkbox, select, tag}
     * @param data.definition.label {String} Label of the attributes field
     * @param data.definition.value {String} Value for the checkbox option
     * @param data.definition.options {Object}, key:value object used for generation the select options
     * @param data.name {String} the field name
     * @param data.value {String}, the value saved in the Store for the current field
     * @param data.dataService {ImageServiceConnector} The backend connector, delivering data for the autocomplete
     */
    return function (data) {

        var that = this;

        /**
         * Set of available events that the system knows and the
         * class sends
         */
        var Events = data.config.events;

        /**
         * A prefix that guaranties uniqueness of the field
         * @type {string}
         */
        that.prefix = data.prefix || '';

        /**
         * Definitions of the attribute
         */
        that.definition = data.definition;

        /**
         * Attribute name
         * @type {*|c}
         */
        that.name = data.name;

        /**
         * The attribute value
         */
        that.value = data.value;

        /**
         * HTML of the field - jQuery object
         * @type {null}
         */
        that.container = null;

        /**
         * Connector/service to the backend - needed for the select2 tag UI
         * @type {ImageServiceConnector}
         */
        that.dataService = data.dataService;

        /**
         * Triggers an event on the attribute
         * @param event
         * @param data
         */
        that.trigger = function (event, data) {
            that.container.trigger(event, data);
        };

        /**
         * Return the attribute value
         * @returns {*|jQuery}
         */
        that.getValue = function () {
            return that.value;
        };

        /**
         * Return the attribute value
         * @returns {*|jQuery}
         */
        that.setValue = function (value) {
            that.value = value;
            that.render();
        };

        /**
         * Generates a string for the label
         * @returns {*|c}
         */
        that.generateLabel = function () {
            return that.definition.label || that.name
        };

        /**
         * Generates a string for the field name
         * @returns {string}
         */
        that.generateFieldName = function () {
            return that.prefix + '_' + that.name;
        };

        /**
         * Builds the Attribute object based on the attribute definitions
         * @returns {*}
         */
        that.render = function () {

            if (that.hasOwnProperty(that.definition.type)) {
                that.container = that[that.definition.type](that.value, that.definition);
            }

            return that.container;
        };

        /**
         * Generates a tag field
         * @param fieldValue
         */
        that.tag = function (fieldValue) {

            var fieldName = that.generateFieldName();
            var fieldLabel = that.generateLabel();

            var container = $('<li class="row"></li>');
            var label = $('<label class="col-xs-12 col-sm-3 col-md-3" for="' + fieldName + '">' + fieldLabel + '</label>');
            var bootstrapContainer = $('<div class="col-xs-12 col-sm-9 col-md-9" ></div>');
            var select = $('<select name="' + fieldName + '" multiple ></select>');

            (fieldValue || []).forEach(function (el) {
                select.append($('<option value="' + el + '" selected>' + el + '</option>'));
            });

            // TODO: Find a way to move that code to the connector/service
            // After render, initiates the external Tag UI
            container.on(Events.ATTRIBUTERENDERED, function (event) {
                select.select2({
                    tags: true,
                    tokenSeparators: [',', ' '],
                    ajax: {
                        url: that.dataService.baseUrl + "/tagsearch",
                        dataType: 'json',
                        delay: 100,
                        data: function (params) {
                            return {
                                q: params.term, // search term
                                page: params.page
                            };
                        },
                        processResults: function (data, params) {

                            params.page = params.page || 1;

                            var items = [];

                            for (var i = 0; i < data.items.length; i++) {
                                items.push({
                                    id: data.items[i],
                                    text: data.items[i]
                                });
                            }

                            return {
                                results: items,
                                pagination: {
                                    more: true
                                }
                            };
                        },
                        cache: false
                    }
                    //templateResult: function(state) { return $('<span>'+(state.text || state)+'</span>'); },
                    //templateSelection: function(state) { return state.text || state; }
                });
            });

            // Updates the object value on change of tags
            select.on('change', function () {
                that.value = $(this).val();
            });

            // Appneds the components of the field
            container.append(label);
            bootstrapContainer.append(select);
            container.append(bootstrapContainer);

            return container;
        };

        /**
         * Generates a simple input field
         * @param fieldValue
         * @returns {jQuery|HTMLElement}
         */
        that.select = function (fieldValue) {

            var fieldName = that.generateFieldName();
            var fieldLabel = that.generateLabel();
            var options = data.definition.options || [];

            var container = $('<li class="row">' +
                '<label class="col-xs-12 col-sm-3 col-md-3" for="' + fieldName + '">' + fieldLabel + '</label>' +
                '<div class="col-xs-12 col-sm-9 col-md-9 field-container" ></div>' +
                '</li>');

            var select = $('<select name="' + fieldName + '"></select>');
            for (x in options) {
                var option = $('<option value="' + x + '">' + data.definition.options[x] + '</option>');
                if (x == fieldValue)
                    option.attr('selected', 'selected');
                select.append(option);
            }

            container.find('.field-container').append(select);
            container.on('change', function (event) {
                that.value = $(event.target).val();
            });

            return container;
        };

        /**
         * Generates a simple input field
         * @param fieldValue
         * @returns {jQuery|HTMLElement}
         */
        that.checkbox = function (fieldValue) {

            var fieldName = that.generateFieldName();
            var fieldLabel = that.generateLabel();
            var checkboxValue = that.definition.value || '';

            var container = $('<li class="row"><label class="col-xs-12 col-sm-3 col-md-3" for="' + fieldName + '">' + fieldLabel + '</label><div class="col-xs-12 col-sm-9 col-md-9" ><input type="checkbox" name="' + fieldName + '" value="' + checkboxValue + '"></div></li>');

            container.on('click', function (event) {
                that.value = event.target.checked ? checkboxValue : '';
            });

            if (fieldValue == checkboxValue){
                container.find('input').attr('checked', 'checked').prop('checked', true);
            }

            return container;
        };

        /**
         * Generates a simple input field
         * @param fieldValue
         * @returns {jQuery|HTMLElement}
         */
        that.text = function (fieldValue) {

            var fieldName = that.generateFieldName();
            var fieldLabel = that.generateLabel();

            var container = $('<li class="row"><label class="col-xs-12 col-sm-3 col-md-3" for="' + fieldName + '">' + fieldLabel + '</label><div class="col-xs-12 col-sm-9 col-md-9" ><input type="text" name="' + fieldName + '" value="' + fieldValue + '"></div></li>');

            container.on('change', function (event) {
                that.value = $(event.target).val();
            });

            return container;
        };

        /**
         * Generates a textarea
         * @param fieldValue
         * @returns {jQuery|HTMLElement}
         */
        that.textarea = function (fieldValue) {

            var fieldName = that.generateFieldName();
            var fieldLabel = that.generateLabel();

            var container = $('<li class="row"><label class="col-xs-12 col-sm-3 col-md-3" for="' + fieldName + '">' + fieldLabel + '</label><div class="col-xs-12 col-sm-9 col-md-9"><textarea name="' + fieldName + '" >' + fieldValue + '</textarea></div></li>');

            container.on('change', function (event) {
                that.value = $(event.target).val();
            });

            return container;
        };

        return that;
    }
});
define('ImageServiceAttributes',[],function () {

    /**
     * A component which renders a set of Attributes and ahndeles them as one thing. Used by the ImageServicePresets,
     * ImageServiceGlobals and ImageServiceListItem.
     * @param data {Object}
     * @param data.model {Object} Holds all the Model Classes needed by the Class
     * @param data.model.attribute {ImageServiceAttribte} The model of a single attribute, used for rendering the Attributes
     * @param data.config {Object} Holds some global configs for the Instance
     * @param data.config.events {Object} Key-Value object, holding the events used by the class. So Far nur ATTRIBUTERENDERED is needed
     * @param data.values {Object} Key-Value object, holding the attributes initial values
     * @param data.definitions {Object} A set of Attributes definitions.
     * @param data.prefix {String} Prefix used for the unique names of the attributes
     * @param data.dataService {ImageSeviceConnector} Data service for the type-a-head fields
     *
     */
    return function(data) {

        var that = this;

        /**
         * Attributes Class/Factory that used to generate the single attribute fields
         * @type {*}
         */
        var Attribute = data.model.attribute;

        /**
         * Event names that the class knows
         */
        var Events = data.config.events;

        /**
         * Initial state
         * @type {Array}
         */
        that.values = data.values || [];

        /**
         * Fields name prefix
         * @type {string}
         */
        that.prefix = data.prefix || '';

        /**
         * Field Definitions
         */
        that.definitions = data.definitions;

        /**
         * The attributes
         * @type {Array}
         */
        that.attributes = [];

        /**
         * Data Service where the attributes get their data from
         */
        that.dataService = data.dataService;

        /**
         * The DOM element containing all the attributes
         * @type {null}
         */
        that.container = null;

        /**
         * Gets the set of attribute values
         * @returns {Array|*}
         */
        that.getValues = function () {
            return that.values;
        };

        /**
         * Sets the attribute values
         * @param values
         */
        that.setValues = function (values) {
            that.attributes.forEach(function (el) {
                el.setValue(values[el.name] || el.value);
            });
        };

        /**
         * Creates the attributes of the item
         */
        that.init = function () {
            for (var key in that.definitions) {
                var definition = that.definitions[key];
                that.attributes.push(
                    new Attribute({
                        prefix: that.prefix,
                        value: that.values[key] || '',
                        definition: definition,
                        name: key,
                        dataService: that.dataService,
                        config: {
                            events: Events
                        }
                    })
                );
            }
        };

        /**
         * Gets the item
         * @returns {{}|*|values|_.values}
         */
        that.getValues = function () {

            that.attributes.forEach(function (attribute) {
                that.values[attribute.name] = attribute.getValue();
            });

            return that.values;
        };

        /**
         * Generates the HTML object containing the editable attributes
         * @param imageData
         * @param fieldDefinitions
         * @returns {jQuery|HTMLElement}
         */
        that.render = function (imageData, fieldDefinitions) {

            that.container = $('<ul class="col-xs-12 col-sm-8 col-md-8 imageservice-attributes"></ul>');

            that.attributes.forEach(function (el, index) {
                that.container.append(el.render());
                el.trigger(Events.ATTRIBUTERENDERED, el);
            });

            return that.container;
        };

        that.init();
    }
});
define('ImageServiceSirTrevor',[],function(){

    return  function(options) {
        var that = this;
        var extensionUrl = options.extensionUrl;
        var ImageServiceModel = options.model.imageService;
        var protoBlock = {

            imageServiceInstance: null,

            type: 'imageservice',
            title: function() { return 'Image'; },
            icon_name: 'default',
            toolbarEnabled: true,
            // Custom html that is shown when a block is being edited.
            textable: true,
            editorHTML: '<div class="frontend-target"></div><textarea type="text" class="data-target">{"items":[]}</textarea>',

            /**
             * Loads the json data in to the field
             * @param data
             */
            loadData: function(data){
                data = data || { items:[] };
                $(this.$('.data-target')).html(JSON.stringify(data));

            },

            /**
             * Sets the data form the ImageService into the Block store
             */
            save: function(){

                if(!this.imageServiceInstance)
                    return;

                var listData = this.imageServiceInstance.list.getData();
                var settingsData = this.imageServiceInstance.settings.getData();

                this.setData({
                    items: listData.items,
                    settings: settingsData
                });

            },

            /**
             * Creates the new image service block
             */
            onBlockRender: function() {

                // Gives the container an unique id
                $(this.$('.frontend-target')).attr('id', 'ImageService' + String(new Date().valueOf()));

                // Merges the Field config with the defaults
                var defaults = {
                    dataElement: this.$('.data-target'),
                    hostElement: this.$('.frontend-target'),
                    serviceUrl: extensionUrl + '/image'
                };
                var config = SirTrevor.getInstance(this.instanceID).options.options.Imageservice || {};

                // Inits the Image Service
                var customInstance = new ImageServiceModel(Object.assign(config, defaults ));

                // Adds the on-save
                // TODO: Replace with a better event/catchcancel process
                $('#sidebarsavecontinuebutton, #savecontinuebutton').bind('click', {} ,function (event) {
                    customInstance.onSave(event);
                });

                this.imageServiceInstance = customInstance;

            }
        };

        that.init = function(blockOptions) {
            if( typeof(SirTrevor) == "object" ) {
                SirTrevor.Blocks.Imageservice = SirTrevor.Block.extend(protoBlock);
            }
        };

        return that;
    };

});





require.config({
    paths: {
        "ImageServiceSettingsInterface": "interfaces/ImageServiceSettingsInterface",
        "ImageServiceAttributesFactory": "factories/ImageServiceAttributes",
        "ImageServiceImageModelFactory": "factories/ImageServiceImageModel",
        "ImageServiceListItemFactory": "factories/ImageServiceListItem",
        "ImageServiceErrors": "factories/ImageServiceErrors",
        "ImageServiceConnector": "components/ImageServiceConnector",
        "ImageServiceUploader": "components/ImageServiceUploader",
        "ImageServiceSettings": "components/ImageServiceSettings",
        "ImageServiceFinder": "components/ImageServiceFinder",
        "ImageServicePresets": "components/ImageServicePresets",
        "ImageServiceMessaging": "components/ImageServiceMessaging",
        "ImageServiceList": "components/ImageServiceList",
        "ImageServiceConfig": "components/ImageServiceConfig",
        "ImageServiceGlobals": "components/ImageServiceGlobals",
        "ImageServiceListItem": "components/ImageServiceListItem",
        "ImageServiceEntityAction": "components/ImageServiceEntityActions",
        "ImageServicePreview": "components/ImageServicePreview",
        "ImageServiceAttribute": "components/ImageServiceAttribute",
        "ImageServiceAttributes": "components/ImageServiceAttributes",
        "ImageServiceSirTrevor": "extension/sir-trevor/extension"
    }
});

var CnImageService = {};
var baseUrl = document.currentScript.getAttribute('data-extension-url');

require([
    "ImageServiceAttributesFactory",
    "ImageServiceImageModelFactory",
    "ImageServiceListItemFactory",
    "ImageServiceConnector",
    "ImageServiceUploader",
    "ImageServiceSettings",
    "ImageServiceFinder",
    "ImageServicePresets",
    "ImageServiceMessaging",
    "ImageServiceList",
    "ImageServiceConfig",
    "ImageServiceErrors",
    "ImageServiceGlobals",
    "ImageServiceListItem",
    "ImageServiceEntityAction",
    "ImageServicePreview",
    "ImageServiceAttribute",
    "ImageServiceAttributes",
    "ImageServiceSirTrevor"
], function (
     ImageServiceAttributesFactory,
     ImageServiceImageModelFactory,
     ImageServiceListItemFactory,
     ImageServiceConnector,
     ImageServiceUploader,
     ImageServiceSettings,
     ImageServiceFinder,
     ImageServicePresets,
     ImageServiceMessaging,
     ImageServiceList,
     ImageServiceConfig,
     ImageServiceErrors,
     ImageServiceGlobals,
     ImageServiceListItem,
     ImageServiceEntityAction,
     ImageServicePreview,
     ImageServiceAttribute,
     ImageServiceAttributes,
     ImageServiceSirTrevor) {

    CnImageService =  function(data) {
        // ------ Factory --------

        /**
         * Filed Holding the generated JSON
         * @type {jQuery|HTMLElement}
         */
        var store = $(data.dataElement);
        var storeJson = JSON.parse(store.val());

        /**
         * Host HTML Element holding all new generated elements
         * Also used as an Event-Arena
         * @type {jQuery|HTMLElement}
         */
        var host = $(data.hostElement);

        var errors = new ImageServiceErrors(data.errors);
        var config = ImageServiceConfig;

        /**
         * Backend connector
         * @type {ImageServiceConnector}
         */
        var service = new ImageServiceConnector({
            defaults: data.cache,
            baseUrl: data.serviceUrl,
            factory: {
                errors: errors
            }
        });

        /**
         * Constructor
         */
        var init = function () {
            host.addClass('imageservice-container');
            store.hide();
        };

        var modelFactory = new ImageServiceImageModelFactory({
            host: host,
            config: config,
            data: storeJson.settings
        });

        var attributesFactory = new ImageServiceAttributesFactory({
            attribute: ImageServiceAttribute,
            events: config.events,
            model: ImageServiceAttributes
        });

        var listItemFactory = new ImageServiceListItemFactory({
            model: ImageServiceListItem,
            events: config.events,
            actions: ImageServiceEntityAction,
            preview: ImageServicePreview,
            attributes: attributesFactory,
            dataModel: modelFactory,
            config: config,
            dataService: service,
            definitions: {
                attributes: Object.assign({}, data.attributes, config.systemAttributes)
            }
        });

        /**
         * Uploader of items
         * @type {ImageServiceUploader}
         */
        var uploader = new ImageServiceUploader({
            host: host,
            maxFileSize: data.maxFileSize,
            service: service,
            config: {
                events: config.events,
                labels: config.labels.ImageServiceUploader
            },
            factory: {
                model: modelFactory
            }
        });

        /**
         * Finds images on the rmeote service and adds them to the list
         * @type {ImageServiceFinder}
         */
        var finder = new ImageServiceFinder({
            host: host,
            service: service,
            config: {
                events: config.events,
                labels: config.labels.ImageServiceFinder
            }
        });

        var settings = new ImageServiceSettings({
            host: host,
            config: {
                events: config.events,
                labels: config.labels.ImageServiceSettings
            },
            data: storeJson.settings
        });

        /**
         * Global settings concerning the instance
         */
        if(Object.keys(data.globals || {}).length)
            var globals = new ImageServiceGlobals({
                host: host,
                parentContainer: null,
                attributes: data.globals,
                service: service,
                prefix: 'globals',
                config: {
                    events: config.events,
                    labels: config.labels.ImageServiceGlobals
                },
                values: {},
                factory: {
                    attributes: attributesFactory
                }
            });

        /**
         * Presets of the Image attributes
         */
        if(Object.keys(data.attributes || {} ).length)
            var presets = new ImageServicePresets({
                host: host,
                parentContainer: null,
                attributes: jQuery.extend({}, data.attributes, config.systemAttributes),
                service: service,
                prefix: 'presets',
                config: {
                    events: config.events,
                    labels: config.labels.ImageServicePresets
                },
                values: {},
                factory: {
                    attributes: attributesFactory
                }
            });

        /**
         * Massage UI
         * @type {ImageServiceMessaging}
         */
        var messaging = new ImageServiceMessaging({
            host: host,
            events: {
                error: config.events.MESSAGEERROR,
                warning: config.events.MESSAGEWARNING,
                info: config.events.MESSAGEINFO
            }
        });

        /**
         * List of items
         * @type {ImageServiceList}
         */
        var list = new ImageServiceList({
            hostElement: host,
            items: JSON.parse(store.val()),
            maxItems: data.maxFiles || null,
            config: {
                events: config.events
            },
            factory: {
                listItem: listItemFactory,
                model: modelFactory
            }
        });

        /**
         * Action that have to be executed on save. It modifies the event in order to
         * make sure that the ajax call has finished before the actual saving takes place.
         * This set of actions have to happen first.
         * @param event
         * @returns {*}
         */
        var onSave = function (event) {

            if (list.dirty) {
                // Stop the initial save process - syncronious save
                event = event || new Event(config.events.LISTSAVED);
                event.preventDefault();
                event.stopImmediatePropagation();

                // Gets the current list data
                var data = list.getData();

                // Invokes the Backend-Connector Save
                service.imageSave({
                    async: false, // unfortunately, this functionality is deprecated
                    items: data.items,
                    files: data.files,

                    // Updates the JSON-holding element and recalls the save event
                    callback: function (newItems) {
                        // transforms the response to json for the backend-save
                        store.val(JSON.stringify({items: newItems, settings: settings.getData()}));
                        // informs the host that the list has been saved
                        $(host).trigger(config.events.LISTSAVED, {items: newItems});
                        // reinitiates the event
                        $(event.target).trigger(event.type);
                    },

                    // Warning handler, the saving process is not cancelled!
                    warning: function (messages) {
                        messages.forEach(function (message) {
                            console.warn(message);
                            host.trigger(
                                config.events.MESSAGEWARNING,
                                errors.create(message.code) + ' - ' + message.id
                            );
                        });
                    },

                    // Error handler, the saving process is cancelled
                    error: function (error) {
                        console.error(error);
                        host.trigger(config.events.MESSAGEERROR, error);
                    }
                });
            }

        };

        init();

        return {
            service: service,
            uploader: uploader,
            finder: finder,
            list: list,
            messaging: messaging,
            settings: settings,
            onSave: onSave
        }
    };

    var cnImageServiceST = new ImageServiceSirTrevor({
        extensionUrl: baseUrl,
        model: {
            imageService: CnImageService
        }
    });

    $(document).on('SirTrevor.DynamicBlock.All', function(){
        $(document).trigger('SirTrevor.DynamicBlock.Add', [cnImageServiceST] );
    });

    $(document).trigger('SirTrevor.DynamicBlock.Add', [cnImageServiceST] );

});
define("cnImageService", function(){});

